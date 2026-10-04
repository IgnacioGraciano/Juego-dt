// Cancha animada para el partido en vivo (canvas) y sonidos simples.
DT.Sound = (function () {
  const S = { ctx: null };
  function ctx() {
    if (S.ctx) return S.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { S.ctx = new AC(); } catch (e) { S.ctx = null; }
    return S.ctx;
  }
  const on = () => DT.G && DT.G.settings.sound !== false;
  S.unlock = () => { const c = ctx(); if (c && c.state === 'suspended') c.resume(); };
  function tone(freq, start, dur, vol, type) {
    const c = ctx();
    if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, c.currentTime + start);
    g.gain.setValueAtTime(0, c.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.01);
    g.gain.linearRampToValueAtTime(0, c.currentTime + start + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + start);
    o.stop(c.currentTime + start + dur + 0.02);
  }
  // Silbato: n pitazos
  S.whistle = (n) => {
    if (!on()) return;
    for (let i = 0; i < (n || 1); i++) {
      tone(2900, i * 0.32, i === (n || 1) - 1 ? 0.5 : 0.18, 0.12, 'square');
      tone(3150, i * 0.32, i === (n || 1) - 1 ? 0.5 : 0.18, 0.05, 'sine');
    }
  };
  // Grito de gol: ruido filtrado que crece y se apaga
  S.goal = () => {
    if (!on()) return;
    const c = ctx();
    if (!c) return;
    const len = 2.4;
    const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.6;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.25);
    g.gain.linearRampToValueAtTime(0.25, t + 1.4);
    g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
  };
  S.card = () => { if (on()) tone(1800, 0, 0.12, 0.08, 'square'); };
  return S;
})();

// Cancha: cada minuto simulado se convierte en una jugada que se ve. El equipo con la pelota
// avanza con pases y conducciones, el rival presiona y se acomoda, y los remates terminan en
// gol, atajada o afuera según lo que decidió el motor del partido (DT.Match).
DT.Pitch = function (canvas, sim, hooks) {
  hooks = hooks || {};
  const G = DT.G;
  const L = 105, Wd = 68, M = 3; // metros de cancha y margen
  const TW = L + M * 2, TH = Wd + M * 2;
  const U = DT.U;
  let raf = null, last = 0, tickMs = 950, scale = 1;
  const pl = {}; // pid -> estado de dibujo
  const ball = { x: L / 2, y: Wd / 2, z: 0, owner: null, fly: null };
  let poss = 0; // equipo que tiene la pelota en la animación
  let queue = []; // acciones pendientes del minuto
  let act = null; // acción en curso
  let roles = {}; // pid -> destino especial durante la jugada (desmarques, arquero que vuela)
  let mode = 'play'; // play | celebrate | reset
  let modeUntil = 0, holdUntil = 0, celeb = null;
  let shotUntil = 0; // hay un remate pendiente de mostrarse: el reloj del partido espera
  let surge = -1; // equipo que llega al área en este minuto
  const trails = [];
  const marks = [];
  let overlay = null, caption = null;
  const css = getComputedStyle(document.documentElement);
  const grassA = css.getPropertyValue('--pitch-a').trim() || '#2f7d4f';
  const grassB = css.getPropertyValue('--pitch-b').trim() || '#2a7247';

  // Camisetas: si los colores se parecen mucho, el visitante usa la alternativa.
  const hex = (h) => [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  const dist = (a, b) => { const x = hex(a), y = hex(b); return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2); };
  const th = G.teams[sim.s[0].tid], ta = G.teams[sim.s[1].tid];
  // parecido entre camisetas: color principal y color promedio (rayas incluidas)
  const mix = (k) => { const a = hex(k.fill), b = hex(k.stripe); return '#' + a.map((v, i) => Math.round(v * 0.62 + b[i] * 0.38).toString(16).padStart(2, '0')).join(''); };
  const kitGap = (a, b) => Math.min(dist(a.fill, b.fill), dist(mix(a), mix(b)) * 1.15);
  const kits = [{ fill: th.c1, stripe: th.c2 }, { fill: ta.c1, stripe: ta.c2 }];
  if (kitGap(kits[0], kits[1]) < 110) {
    const alts = [{ fill: ta.c2, stripe: ta.c1 }, { fill: '#f1f1f1', stripe: '#3a3a3a' }, { fill: '#1f2833', stripe: '#e6e6e6' }, { fill: '#c62828', stripe: '#ffffff' }, { fill: '#f2c200', stripe: '#1a1a1a' }];
    kits[1] = alts.reduce((best, k) => (kitGap(kits[0], k) > kitGap(kits[0], best) ? k : best), alts[0]);
  }
  const gkKits = [{ fill: '#e8b400', stripe: '#e8b400' }, { fill: '#3b3b3b', stripe: '#3b3b3b' }];
  if (dist(kits[0].fill, gkKits[0].fill) < 80) gkKits[0] = { fill: '#9c27b0', stripe: '#9c27b0' };

  DT.P.ensureNumbers(th);
  DT.P.ensureNumbers(ta);

  // Coordenadas "propias": distancia al arco que defiende cada equipo (el local ataca hacia la derecha).
  const dirOf = (s) => (s === 0 ? 1 : -1);
  const own = (s, x) => (s === 0 ? x : L - x);
  const fromOwn = (s, u) => (s === 0 ? u : L - u);
  const pace = () => 950 / tickMs; // 1 = velocidad normal
  const vmax = () => 15 * Math.pow(pace(), 0.85); // metros por segundo en pantalla
  const short = (id) => {
    const p = G.players[id];
    if (!p) return '';
    const parts = p.n.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : p.n;
  };
  const say = (text, ms) => { caption = { text, until: performance.now() + (ms || Math.max(900, tickMs * 1.4)) }; };

  function basePos(side, idx) {
    const F = DT.FORMATIONS[sim.s[side].tac.f];
    const xy = F.xy[idx] || [50, 50];
    const depth = (90 - xy[1]) / 75;
    let x = 4 + depth * 45;
    let y = (xy[0] / 100) * Wd;
    if (side === 1) { x = L - x; y = Wd - y; }
    return { x, y };
  }

  function sync(initial) {
    // agrega/quita jugadores según los que están en cancha (cambios, expulsiones)
    const alive = new Set();
    for (let s = 0; s < 2; s++) {
      for (const o of sim.s[s].on) {
        alive.add(o.id);
        if (!pl[o.id]) {
          const b = basePos(s, o.i);
          // el que entra de cambio aparece desde el costado de la cancha
          const sx = initial ? b.x : L / 2 + (s === 0 ? -3 : 3), sy = initial ? b.y : Wd + 2;
          pl[o.id] = { x: sx, y: sy, tx: b.x, ty: b.y, side: s, idx: o.i, ph: Math.random() * 6.28 };
        }
        const P = pl[o.id];
        P.side = s; P.idx = o.i; P.gk = o.slot === 'P';
        P.num = G.players[o.id] ? G.players[o.id].num : '';
      }
    }
    for (const id in pl) {
      if (!alive.has(+id)) {
        delete pl[id];
        if (ball.owner === +id) ball.owner = null;
      }
    }
  }

  const ids = (s, outfield) => Object.keys(pl).map(Number).filter((id) => pl[id].side === s && (!outfield || !pl[id].gk));
  const gkOf = (s) => ids(s).find((id) => pl[id].gk);
  function nearest(s, x, y, outfield, except) {
    let best = null, bd = 1e9;
    for (const id of ids(s, outfield)) {
      if (id === except) continue;
      const d = Math.hypot(pl[id].x - x, pl[id].y - y);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  function kickoff(side) {
    sync(true);
    const ks = side === undefined ? (sim.half === 2 ? 1 : 0) : side;
    for (const id in pl) {
      const P = pl[id];
      const b = basePos(P.side, P.idx);
      P.x = P.tx = b.x; P.y = P.ty = b.y;
    }
    placeKickoff(ks);
    queue = []; act = null; roles = {}; mode = 'play'; celeb = null;
  }
  // pelota al medio y la toca el jugador más adelantado del equipo que saca
  function placeKickoff(ks) {
    ball.x = L / 2; ball.y = Wd / 2; ball.z = 0; ball.fly = null;
    const k = nearest(ks, L / 2, Wd / 2, true);
    ball.owner = k;
    poss = ks;
    if (k) { roles = {}; roles[k] = { x: L / 2 - dirOf(ks) * 0.8, y: Wd / 2 }; }
  }

  // ---------- jugada de cada minuto ----------
  function minute() {
    sync();
    const lst = sim.last;
    if (!lst) return;
    const now = performance.now();
    const budget = tickMs * 0.9;
    const a = lst.att;
    const plan = [];
    roles = {};
    const ownerSide = ball.owner && pl[ball.owner] ? pl[ball.owner].side : -1;
    if (ownerSide !== a) plan.push({ k: 'win', s: a, w: 0.7 });
    if (lst.shot) {
      const sh = lst.shot.pid, aid = lst.shot.aid && pl[lst.shot.aid] ? lst.shot.aid : null;
      // desmarques: el que remata entra al área y el que asiste abre la cancha
      if (pl[sh]) roles[sh] = { x: fromOwn(a, U.rf(83, 93)), y: Wd / 2 + U.rf(-9, 9), run: true, v: 2.2 };
      if (aid) roles[aid] = { x: fromOwn(a, U.rf(70, 86)), y: Wd / 2 + (Math.random() < 0.5 ? -1 : 1) * U.rf(10, 24), run: true, v: 2.2 };
      surge = a;
      shotUntil = now + budget * 3 + 1500;
      const build = budget > 1300 ? 2 : budget > 650 ? 1 : 0;
      for (let i = 0; i < build; i++) plan.push(Math.random() < 0.7 ? { k: 'pass', s: a, w: 1 } : { k: 'carry', s: a, w: 0.8 });
      if (aid) plan.push({ k: 'pass', s: a, to: aid, w: 1 });
      plan.push({ k: 'pass', s: a, to: sh, w: 1 });
      if (budget > 500) plan.push({ k: 'carry', s: a, w: 0.5, inward: true });
      const res = lst.shot.goal ? 'goal' : lst.shot.on ? 'save' : 'miss';
      plan.push({ k: 'shot', s: a, res, w: 0.75 });
      plan.push({ k: 'idle', w: 0.5 });
      if (lst.shot.goal) holdUntil = now + budget + 3600; // se ajusta cuando la pelota entra
    } else {
      surge = -1;
      const n = budget > 1300 ? U.ri(2, 4) : budget > 650 ? U.ri(1, 3) : U.ri(1, 2);
      for (let i = 0; i < n; i++) plan.push(Math.random() < 0.72 ? { k: 'pass', s: a, w: 1 } : { k: 'carry', s: a, w: 0.8 });
      if (Math.random() < 0.3) plan.push({ k: 'lose', s: a, w: 1 });
      else plan.push({ k: 'idle', w: 0.3 });
    }
    const tot = plan.reduce((t, x) => t + x.w, 0);
    for (const x of plan) x.dur = (budget * x.w) / tot;
    queue = plan;
    act = null;
    for (const c of lst.cards) {
      marks.push({ pid: c.pid, red: c.red, until: now + Math.max(1800, tickMs * 2) });
      say(`${c.red ? 'Roja' : 'Amarilla'} para ${short(c.pid)}`);
      DT.Sound.card();
    }
  }

  // receptor de un pase: compañero bien ubicado, en lo posible más adelante
  function pickReceiver(s, from) {
    const F = pl[from];
    const d = dirOf(s);
    const cands = ids(s, true).filter((id) => id !== from);
    if (!cands.length) return null;
    const want = U.rf(2, 16);
    const ws = cands.map((id) => {
      const P = pl[id];
      const adv = (P.x - F.x) * d;
      const dd = Math.hypot(P.x - F.x, P.y - F.y);
      let w = Math.exp(-((adv - want) ** 2) / 180);
      if (dd < 6) w *= 0.15;
      if (dd > 38) w *= 0.15;
      return w + 0.01;
    });
    return U.weighted(cands, ws);
  }

  function launch(tx, ty, dur, kind, onEnd) {
    const d = Math.hypot(tx - ball.x, ty - ball.y);
    ball.fly = { fx: ball.x, fy: ball.y, tx, ty, t0: performance.now(), dur: Math.max(60, dur), h: kind === 'pass' && d > 26 ? Math.min(4, d / 10) : kind === 'shot' ? 0.8 : 0, kind, onEnd };
    ball.owner = null;
    if (kind !== 'win') {
      trails.push({ x1: ball.x, y1: ball.y, x2: tx, y2: ty, t: performance.now(), kind });
      if (trails.length > 8) trails.shift();
    }
  }

  function startAction(a, now) {
    // si la pelota todavía viaja, la acción espera
    if (ball.fly) {
      queue.unshift(a);
      act = { k: 'wait', t0: now, dur: Math.max(30, ball.fly.t0 + ball.fly.dur - now) };
      return;
    }
    a.t0 = now;
    act = a;
    if (a.k === 'idle') return;
    let own0 = ball.owner && pl[ball.owner] ? ball.owner : null;
    if (a.k === 'win') {
      const w = (own0 && pl[own0].side === a.s) ? own0 : nearest(a.s, ball.x, ball.y, own(a.s, ball.x) > 16);
      if (!w) return;
      poss = a.s;
      if (own0 && pl[own0].side !== a.s) say(`Recupera ${short(w)}`);
      const P = pl[w];
      launch(P.x, P.y, a.dur * 0.7, 'win', () => { ball.owner = w; });
      return;
    }
    if (!own0 || (a.s !== undefined && pl[own0].side !== a.s)) {
      // la pelota quedó suelta: la toma el más cercano del equipo que ataca
      const s0 = a.s !== undefined ? a.s : poss;
      own0 = nearest(s0, ball.x, ball.y, true);
      if (!own0) return;
      ball.owner = own0;
      poss = s0;
    }
    const O = pl[own0];
    const d = dirOf(O.side);
    if (a.k === 'pass' || a.k === 'lose') {
      let to = a.to && pl[a.to] ? a.to : null;
      if (to === own0) { act.dur = 1; return; } // ya la tiene
      if (!to) to = pickReceiver(O.side, own0);
      if (!to) return;
      const R = pl[to];
      // pase al espacio: a donde va a llegar el receptor cuando le llegue la pelota
      let dest;
      if (roles[to]) {
        const rr = roles[to];
        const gap = Math.hypot(rr.x - R.x, rr.y - R.y);
        const k = Math.min(1, (vmax() * (rr.v || 1) * a.dur * 0.8) / 1000 / Math.max(0.1, gap));
        dest = { x: R.x + (rr.x - R.x) * k, y: R.y + (rr.y - R.y) * k };
      } else dest = { x: U.clamp(R.x + d * U.rf(1, 4), 2, L - 2), y: U.clamp(R.y + U.rf(-2, 2), 2, Wd - 2) };
      if (a.k === 'lose') {
        // pase cortado: un rival se cruza en la línea del pase
        const mx = O.x + (dest.x - O.x) * U.rf(0.45, 0.7), my = O.y + (dest.y - O.y) * U.rf(0.45, 0.7);
        const cut = nearest(1 - O.side, mx, my, true);
        if (!cut) return;
        roles[cut] = { x: mx, y: my };
        launch(mx, my, a.dur * 0.75, 'lost', () => { ball.owner = cut; poss = pl[cut] ? pl[cut].side : poss; say(`La corta ${short(cut)}`); });
        return;
      }
      if (!roles[to]) roles[to] = dest;
      launch(dest.x, dest.y, a.dur * 0.8, 'pass', () => { ball.owner = to; });
      return;
    }
    if (a.k === 'carry') {
      const u = own(O.side, O.x);
      const nu = Math.min(L - 14, u + U.rf(5, 12));
      const ny = a.inward ? O.y + (Wd / 2 - O.y) * 0.4 : O.y + U.rf(-5, 5);
      roles[own0] = { x: fromOwn(O.side, nu), y: U.clamp(ny, 3, Wd - 3), run: true };
      return;
    }
    if (a.k === 'shot') {
      const s = O.side, def = 1 - s;
      const u0 = own(s, O.x);
      if (u0 < 76 && !a.ran) {
        // lejos del arco: primero encara hacia el área
        a.ran = true;
        const tx = fromOwn(s, U.rf(82, 88)), ty = O.y + (Wd / 2 - O.y) * 0.5;
        roles[own0] = { x: tx, y: ty, run: true, v: 2.2 };
        queue.unshift(a);
        act = { k: 'wait', t0: now, dur: Math.max(120, (Math.hypot(tx - O.x, ty - O.y) / (vmax() * 2.2)) * 1000 * 1.15) };
        return;
      }
      const gk = gkOf(def);
      const gx = fromOwn(s, L);
      say(`Remate de ${short(own0)}`);
      if (a.res === 'goal') {
        const gy = Wd / 2 + U.rf(-3, 3);
        if (gk) roles[gk] = { x: fromOwn(def, 1), y: Wd / 2 - Math.sign(gy - Wd / 2 || 1) * 2.5, dive: true };
        const scorer = own0;
        launch(gx + d * 1.6, gy, a.dur * 0.75, 'shot', () => { shotUntil = 0; goal(scorer, s); });
      } else if (a.res === 'save') {
        const gy = Wd / 2 + U.rf(-2.8, 2.8);
        const sx = fromOwn(def, 1.3);
        if (gk) roles[gk] = { x: sx, y: gy, dive: true };
        launch(sx, gy, a.dur * 0.75, 'shot', () => {
          shotUntil = 0;
          if (gk && pl[gk]) { ball.owner = gk; poss = def; say(`¡Ataja ${short(gk)}!`); }
        });
      } else {
        const gy = Wd / 2 + (Math.random() < 0.5 ? -1 : 1) * U.rf(4.6, 10);
        launch(gx + d * 2.6, gy, a.dur * 0.75, 'shot', () => {
          shotUntil = 0;
          say('Afuera. Saque de arco.');
          // saque de arco: la pelota vuelve al área chica del que defiende
          setTimeout(() => {
            if (ball.fly || mode !== 'play') return;
            ball.x = fromOwn(def, 5.5); ball.y = Wd / 2 + (gy > Wd / 2 ? 1 : -1) * 6; ball.z = 0;
            if (gk && pl[gk]) { pl[gk].x = ball.x - dirOf(def) * 0.8; pl[gk].y = ball.y; ball.owner = gk; }
            poss = def;
          }, Math.min(450, tickMs * 0.4));
        });
      }
    }
  }

  function goal(scorer, side) {
    const now = performance.now();
    const p = G.players[scorer];
    overlay = { text: '¡GOL!', sub: p ? p.n : '', until: now + 2300 };
    DT.Sound.goal();
    if (hooks.onGoal) hooks.onGoal();
    mode = 'celebrate';
    modeUntil = now + 2300;
    holdUntil = now + 3300;
    const sp = pl[scorer] || { y: Wd / 2 };
    celeb = { pid: scorer, side, x: fromOwn(side, L - 3), y: sp.y < Wd / 2 ? 3 : Wd - 3 };
    queue = []; act = null; roles = {};
  }

  // ---------- movimiento ----------
  function shapeTarget(id, P, now, pressers) {
    const r = roles[id];
    if (mode === 'celebrate' && celeb) {
      if (P.side === celeb.side && !P.gk) {
        if (id === celeb.pid) return { x: celeb.x, y: celeb.y, v: 1.1 };
        const k = (P.idx * 2.4) % 6.28;
        return { x: celeb.x - dirOf(celeb.side) * (3 + (P.idx % 3) * 1.5) + Math.cos(k) * 1.5, y: celeb.y + Math.sin(k) * 3 + (celeb.y < Wd / 2 ? 3 : -3), v: 0.9 };
      }
      const b = basePos(P.side, P.idx);
      return { x: b.x, y: b.y, v: 0.35 };
    }
    if (mode === 'reset' && id === ball.owner) return { x: L / 2 - dirOf(P.side) * 0.8, y: Wd / 2, v: 1.4 };
    if (mode === 'reset') { const b = basePos(P.side, P.idx); return { x: b.x, y: b.y, v: 1.2 }; }
    if (r) return { x: r.x, y: r.y, v: r.v || (r.dive ? 2.4 : r.run ? 0.9 : 1) };
    const b = basePos(P.side, P.idx);
    const bu = own(P.side, b.x);
    const ub = own(P.side, ball.x);
    const wob = Math.sin(P.ph + now / 700) * 1.1;
    if (P.gk) {
      const u = ub < 25 ? 2 : ub < 55 ? 4 : 9;
      return { x: fromOwn(P.side, u), y: Wd / 2 + (ball.y - Wd / 2) * (ub < 30 ? 0.3 : 0.12), v: 0.8 };
    }
    if (id === ball.owner) return { x: P.x + dirOf(P.side) * 2, y: P.y, v: 0.25 };
    if (pressers[0] === id) return { x: ball.x - dirOf(P.side) * 1.2, y: ball.y + (P.y > ball.y ? 0.9 : -0.9), v: 1 };
    if (pressers[1] === id) {
      const gx = fromOwn(P.side, 0);
      return { x: ball.x + (gx - ball.x) * 0.15, y: ball.y + (Wd / 2 - ball.y) * 0.25, v: 0.9 };
    }
    let u, y;
    if (P.side === poss) {
      u = bu + (ub - 35) * 0.55 + 4 + (surge === P.side ? 9 : 0);
      u = Math.min(u, Math.max(ub + 16, bu + 4), L - 7);
      y = b.y + (ball.y - Wd / 2) * 0.25;
    } else {
      u = bu + (ub - 55) * 0.5;
      u = Math.max(3, Math.min(u, ub + 10));
      y = b.y * 0.8 + (Wd / 2) * 0.2 + (ball.y - Wd / 2) * 0.4;
    }
    return { x: fromOwn(P.side, u) + wob, y: U.clamp(y + Math.cos(P.ph + now / 900), 1.5, Wd - 1.5), v: 0.75 };
  }

  function step(now, dt) {
    // acciones del minuto
    if (mode === 'play') {
      if (!act || now >= act.t0 + act.dur) {
        if (act && act.k === 'carry' && ball.owner && roles[ball.owner] && roles[ball.owner].run) delete roles[ball.owner];
        act = null;
        if (queue.length) startAction(queue.shift(), now);
      }
    } else if (mode === 'celebrate' && now >= modeUntil) {
      mode = 'reset';
      const conceding = celeb ? 1 - celeb.side : 0;
      ball.fly = null;
      placeKickoff(conceding);
      roles = {};
    } else if (mode === 'reset' && now >= holdUntil) {
      mode = 'play';
      celeb = null;
    }
    // presión: los dos rivales más cercanos a la pelota
    const pressers = [];
    if (mode === 'play') {
      const ds = 1 - poss;
      const list = ids(ds, true).map((id) => [id, Math.hypot(pl[id].x - ball.x, pl[id].y - ball.y)]).sort((a, b) => a[1] - b[1]);
      if (list[0]) pressers.push(list[0][0]);
      if (list[1]) pressers.push(list[1][0]);
    }
    const vm = vmax();
    for (const id in pl) {
      const P = pl[id];
      const T = shapeTarget(+id, P, now, pressers);
      P.tx = U.clamp(T.x, -1, L + 1); P.ty = U.clamp(T.y, -1, Wd + 2);
      const dx = P.tx - P.x, dy = P.ty - P.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 0.01) {
        const stp = Math.min(dd, vm * (T.v || 1) * dt * Math.min(1, 0.35 + dd / 5));
        P.x += (dx / dd) * stp; P.y += (dy / dd) * stp;
      }
    }
    // pelota
    if (ball.fly) {
      const f = ball.fly;
      const t = U.clamp((now - f.t0) / f.dur, 0, 1);
      const e = f.kind === 'shot' ? t : 1 - (1 - t) * (1 - t);
      ball.x = f.fx + (f.tx - f.fx) * e;
      ball.y = f.fy + (f.ty - f.fy) * e;
      ball.z = f.h * 4 * t * (1 - t);
      if (t >= 1) { ball.fly = null; ball.z = 0; if (f.onEnd) f.onEnd(); }
    } else if (ball.owner && pl[ball.owner]) {
      const O = pl[ball.owner];
      const fx = O.x + dirOf(O.side) * 0.9, fy = O.y + 0.3;
      const k = Math.min(1, dt * 16);
      ball.x += (fx - ball.x) * k; ball.y += (fy - ball.y) * k;
    }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 340;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round((w * TH / TW) * dpr);
    scale = canvas.width / TW;
  }

  function draw(now) {
    const c = canvas.getContext('2d');
    const s = scale;
    const X = (x) => (x + M) * s, Y = (y) => (y + M) * s;
    // césped a franjas
    c.fillStyle = grassA;
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = grassB;
    for (let i = 0; i < 12; i += 2) c.fillRect(X((L / 12) * i), 0, (L / 12) * s, canvas.height);
    // líneas
    c.strokeStyle = 'rgba(255,255,255,0.6)';
    c.lineWidth = Math.max(1, s * 0.25);
    c.strokeRect(X(0), Y(0), L * s, Wd * s);
    c.beginPath(); c.moveTo(X(L / 2), Y(0)); c.lineTo(X(L / 2), Y(Wd)); c.stroke();
    c.beginPath(); c.arc(X(L / 2), Y(Wd / 2), 9.15 * s, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath(); c.arc(X(L / 2), Y(Wd / 2), s * 0.5, 0, Math.PI * 2); c.fill();
    for (const side of [0, 1]) {
      const x0 = side === 0 ? 0 : L;
      const d = side === 0 ? 1 : -1;
      c.strokeRect(X(Math.min(x0, x0 + d * 16.5)), Y(Wd / 2 - 20.15), 16.5 * s, 40.3 * s);
      c.strokeRect(X(Math.min(x0, x0 + d * 5.5)), Y(Wd / 2 - 9.15), 5.5 * s, 18.3 * s);
      c.beginPath(); c.arc(X(x0 + d * 11), Y(Wd / 2), s * 0.4, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(X(x0 + d * 11), Y(Wd / 2), 9.15 * s, d > 0 ? -0.93 : Math.PI - 0.93, d > 0 ? 0.93 : Math.PI + 0.93); c.stroke();
      // arco: la red se ilumina cuando entra la pelota
      c.save();
      const inNet = mode !== 'play' && celeb && celeb.side !== side && mode === 'celebrate';
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.fillStyle = inNet ? 'rgba(255,227,107,0.45)' : 'rgba(255,255,255,0.12)';
      const gx = side === 0 ? X(-2) : X(L);
      c.fillRect(gx, Y(Wd / 2 - 3.66), 2 * s, 7.32 * s);
      c.strokeRect(gx, Y(Wd / 2 - 3.66), 2 * s, 7.32 * s);
      c.restore();
    }
    // estela de los pases y remates
    const life = Math.max(700, tickMs * 1.6);
    for (const t of trails) {
      const age = (now - t.t) / life;
      if (age >= 1) continue;
      c.save();
      c.globalAlpha = (1 - age) * (t.kind === 'shot' ? 0.9 : 0.6);
      c.strokeStyle = t.kind === 'shot' ? '#ffe36b' : t.kind === 'lost' ? '#ff8a7a' : '#ffffff';
      c.lineWidth = Math.max(1, s * (t.kind === 'shot' ? 0.45 : 0.28));
      c.setLineDash(t.kind === 'shot' ? [] : [s * 1.2, s * 1]);
      c.beginPath(); c.moveTo(X(t.x1), Y(t.y1)); c.lineTo(X(t.x2), Y(t.y2)); c.stroke();
      c.restore();
    }
    // jugadores
    const R = Math.max(7, s * 2.6);
    const list = Object.entries(pl).sort((a, b) => a[1].y - b[1].y);
    const carrier = ball.owner && !ball.fly ? String(ball.owner) : null;
    for (const [id, P] of list) {
      const kit = P.gk ? gkKits[P.side] : kits[P.side];
      const px = X(P.x), py = Y(P.y);
      c.save();
      c.beginPath(); c.arc(px + R * 0.15, py + R * 0.25, R, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
      c.beginPath(); c.arc(px, py, R, 0, Math.PI * 2); c.closePath();
      c.fillStyle = kit.fill; c.fill();
      c.clip();
      if (kit.stripe !== kit.fill) {
        c.fillStyle = kit.stripe;
        for (let k = -2; k <= 2; k += 2) c.fillRect(px + k * R * 0.42 - R * 0.17, py - R, R * 0.34, R * 2);
      }
      c.restore();
      c.beginPath(); c.arc(px, py, R, 0, Math.PI * 2);
      c.lineWidth = id === carrier ? Math.max(2, R * 0.28) : Math.max(1, R * 0.14);
      c.strokeStyle = id === carrier ? '#ffe36b' : 'rgba(20,20,20,0.75)';
      c.stroke();
      // número con fondo para que se lea sobre las rayas
      c.font = `700 ${Math.round(R * 1.05)}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = Math.max(2, R * 0.35);
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.strokeText(String(P.num || ''), px, py + R * 0.05);
      c.fillStyle = '#111';
      c.fillText(String(P.num || ''), px, py + R * 0.05);
      // tarjetas
      const mk = marks.find((m) => m.pid === +id && m.until > now);
      if (mk) {
        c.fillStyle = mk.red ? '#d63a2f' : '#f2c200';
        c.fillRect(px + R * 0.6, py - R * 2.1, R * 0.8, R * 1.1);
      }
    }
    // nombre del que tiene la pelota (o del goleador mientras festeja)
    const tag = mode === 'celebrate' && celeb ? String(celeb.pid) : carrier;
    if (tag && pl[tag]) {
      const P = pl[tag];
      const txt = short(+tag);
      c.font = `700 ${Math.round(R * 0.95)}px 'Barlow', sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.lineWidth = Math.max(2, R * 0.3);
      c.strokeStyle = 'rgba(0,0,0,0.7)';
      c.strokeText(txt, X(P.x), Y(P.y) - R * 1.25);
      c.fillStyle = '#fff';
      c.fillText(txt, X(P.x), Y(P.y) - R * 1.25);
    }
    // pelota (con sombra; sube en los pases largos)
    const br = Math.max(2.6, R * 0.42) * (1 + ball.z * 0.08);
    const lift = ball.z * s * 0.9;
    c.beginPath(); c.arc(X(ball.x) + br * 0.3, Y(ball.y) + br * 0.4, Math.max(2, br * 0.9), 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
    c.beginPath(); c.arc(X(ball.x), Y(ball.y) - lift, br, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill();
    c.lineWidth = 1; c.strokeStyle = '#222'; c.stroke();
    // relato corto de la jugada
    if (caption && caption.until > now && !(overlay && overlay.until > now)) {
      const fs = Math.max(11, Math.round(canvas.height * 0.045));
      c.font = `600 ${fs}px 'Barlow', sans-serif`;
      const w = c.measureText(caption.text).width + fs * 1.2;
      c.globalAlpha = Math.min(1, (caption.until - now) / 250);
      c.fillStyle = 'rgba(8,14,22,0.7)';
      c.fillRect(fs * 0.4, canvas.height - fs * 2.1, w, fs * 1.6);
      c.fillStyle = '#fff';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(caption.text, fs, canvas.height - fs * 1.3);
      c.globalAlpha = 1;
    }
    // cartel de gol / entretiempo
    if (overlay && overlay.until > now) {
      // franja arriba de la cancha para que se siga viendo la jugada y el festejo
      c.fillStyle = 'rgba(8,14,22,0.6)';
      c.fillRect(0, 0, canvas.width, canvas.height * 0.25);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffe36b';
      c.font = `700 ${Math.round(canvas.height * 0.12)}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
      c.fillText(overlay.text, canvas.width / 2, canvas.height * (overlay.sub ? 0.09 : 0.125));
      if (overlay.sub) {
        c.fillStyle = '#fff';
        c.font = `600 ${Math.round(canvas.height * 0.055)}px 'Barlow', sans-serif`;
        c.fillText(overlay.sub, canvas.width / 2, canvas.height * 0.19);
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    step(now, dt);
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  resize();
  kickoff(0);
  return {
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
    setTick(ms) { tickMs = ms; },
    minute,
    kickoff,
    resize,
    holding() { const t = performance.now(); return !!raf && (t < holdUntil || t < shotUntil); },
    banner(text, sub, ms) { overlay = { text, sub, until: performance.now() + (ms || 1800) }; },
  };
};
