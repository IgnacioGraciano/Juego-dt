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

DT.Pitch = function (canvas, sim) {
  const G = DT.G;
  const L = 105, Wd = 68, M = 3; // metros de cancha y margen
  const TW = L + M * 2, TH = Wd + M * 2;
  const U = DT.U;
  let raf = null, last = 0, tickMs = 400, scale = 1;
  const pl = {}; // pid -> estado de dibujo
  const ball = { x: L / 2, y: Wd / 2, path: [], t0: 0, dur: 1 };
  let overlay = null;
  const marks = [];
  const css = getComputedStyle(document.documentElement);
  const grassA = css.getPropertyValue('--pitch-a').trim() || '#2f7d4f';
  const grassB = css.getPropertyValue('--pitch-b').trim() || '#2a7247';

  // Camisetas: si los colores se parecen mucho, el visitante usa la alternativa.
  const hex = (h) => [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  const dist = (a, b) => { const x = hex(a), y = hex(b); return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2); };
  const th = G.teams[sim.s[0].tid], ta = G.teams[sim.s[1].tid];
  const kits = [{ fill: th.c1, stripe: th.c2 }, { fill: ta.c1, stripe: ta.c2 }];
  if (dist(th.c1, ta.c1) < 110) {
    kits[1] = dist(th.c1, ta.c2) > 110 ? { fill: ta.c2, stripe: ta.c1 } : { fill: '#f1f1f1', stripe: '#3a3a3a' };
  }
  const gkKits = [{ fill: '#e8b400', stripe: '#e8b400' }, { fill: '#3b3b3b', stripe: '#3b3b3b' }];
  if (dist(kits[0].fill, gkKits[0].fill) < 80) gkKits[0] = { fill: '#9c27b0', stripe: '#9c27b0' };

  DT.P.ensureNumbers(th);
  DT.P.ensureNumbers(ta);

  function basePos(side, idx) {
    const F = DT.FORMATIONS[sim.s[side].tac.f];
    const xy = F.xy[idx] || [50, 50];
    const depth = (90 - xy[1]) / 75;
    let x = 4 + depth * 45;
    let y = (xy[0] / 100) * Wd;
    if (side === 1) { x = L - x; y = Wd - y; }
    return { x, y };
  }

  function sync() {
    // agrega/quita jugadores según los que están en cancha
    const alive = new Set();
    for (let s = 0; s < 2; s++) {
      for (const o of sim.s[s].on) {
        alive.add(o.id);
        if (!pl[o.id]) {
          const b = basePos(s, o.i);
          pl[o.id] = { x: b.x, y: b.y, tx: b.x, ty: b.y, side: s, idx: o.i, ph: Math.random() * 6.28 };
        }
        const P = pl[o.id];
        P.side = s; P.idx = o.i; P.gk = o.slot === 'P';
        P.num = G.players[o.id] ? G.players[o.id].num : '';
      }
    }
    for (const id in pl) if (!alive.has(+id)) delete pl[id];
  }

  function kickoff() {
    sync();
    for (const id in pl) {
      const P = pl[id];
      const b = basePos(P.side, P.idx);
      P.tx = b.x; P.ty = b.y;
    }
    ball.path = [];
    ball.x = L / 2; ball.y = Wd / 2;
  }

  // Cada minuto de juego: posiciones objetivo y recorrido de la pelota.
  function minute() {
    sync();
    const lst = sim.last;
    const now = performance.now();
    if (!lst) return;
    const a = lst.att;
    const push = 9 + 9 * U.clamp(lst.r - 0.6, 0, 1);
    for (const id in pl) {
      const P = pl[id];
      const b = basePos(P.side, P.idx);
      const dir = P.side === 0 ? 1 : -1;
      const k = P.gk ? 0.15 : 1;
      const shift = P.side === a ? dir * push * k : -dir * 5 * k;
      P.tx = U.clamp(b.x + shift + Math.sin(P.ph + now / 900) * 1.5, 1.5, L - 1.5);
      P.ty = U.clamp(b.y + (ball.y - Wd / 2) * (P.gk ? 0.1 : 0.22) + Math.cos(P.ph + now / 1100) * 1.5, 1.5, Wd - 1.5);
    }
    // pases entre jugadores del equipo con la pelota, avanzando hacia el arco rival
    const dir = a === 0 ? 1 : -1;
    const mates = Object.entries(pl).filter(([, P]) => P.side === a && !P.gk).map(([id, P]) => ({ id: +id, P }));
    mates.sort((x, y) => (x.P.tx - y.P.tx) * dir);
    const path = [];
    if (mates.length) {
      const n = lst.shot ? 2 : U.ri(2, 3);
      const from = Math.floor(mates.length * (lst.shot ? 0.45 : 0.15));
      for (let k = 0; k < n; k++) {
        const lo = Math.min(mates.length - 1, from + Math.floor((k * (mates.length - from)) / n));
        const hi = Math.min(mates.length - 1, lo + 2);
        const m = mates[U.ri(lo, hi)];
        path.push({ x: m.P.tx, y: m.P.ty });
      }
    }
    if (lst.shot) {
      const shooter = pl[lst.shot.pid];
      if (shooter) path.push({ x: shooter.tx, y: shooter.ty });
      const gx = a === 0 ? L : 0;
      let gy;
      if (lst.shot.goal) gy = Wd / 2 + U.rf(-3, 3);
      else if (lst.shot.on) gy = Wd / 2 + U.rf(-2.5, 2.5);
      else gy = Wd / 2 + (Math.random() < 0.5 ? -1 : 1) * U.rf(4.5, 10);
      const into = lst.shot.goal ? dir * 1.6 : lst.shot.on ? -dir * 1.2 : dir * 2.5;
      path.push({ x: gx + into, y: gy });
      if (lst.shot.goal) {
        const p = G.players[lst.shot.pid];
        overlay = { text: '¡GOL!', sub: p ? p.n : '', until: now + Math.max(2200, tickMs * 2.5), side: a };
        DT.Sound.goal();
        ball.reset = true;
      }
    }
    for (const c of lst.cards) {
      marks.push({ pid: c.pid, red: c.red, until: now + Math.max(1800, tickMs * 2) });
      DT.Sound.card();
    }
    ball.path = path;
    ball.from = { x: ball.x, y: ball.y };
    ball.t0 = now;
    ball.dur = tickMs * 0.85;
  }

  function ballPos(now) {
    if (!ball.path.length) return { x: ball.x, y: ball.y };
    const t = U.clamp((now - ball.t0) / ball.dur, 0, 1);
    const pts = [ball.from].concat(ball.path);
    const seg = Math.min(pts.length - 2, Math.floor(t * (pts.length - 1)));
    const lt = t * (pts.length - 1) - seg;
    const e = lt < 0.5 ? 2 * lt * lt : 1 - Math.pow(-2 * lt + 2, 2) / 2;
    const A = pts[seg], B = pts[seg + 1];
    return { x: A.x + (B.x - A.x) * e, y: A.y + (B.y - A.y) * e };
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
      // arco
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.9)';
      c.fillStyle = 'rgba(255,255,255,0.12)';
      const gx = side === 0 ? X(-2) : X(L);
      c.fillRect(gx, Y(Wd / 2 - 3.66), 2 * s, 7.32 * s);
      c.strokeRect(gx, Y(Wd / 2 - 3.66), 2 * s, 7.32 * s);
      c.restore();
    }
    // jugadores
    const R = Math.max(7, s * 2.6);
    const bp = ballPos(now);
    let carrier = null, cd = 9;
    const list = Object.entries(pl).sort((a, b) => a[1].y - b[1].y);
    for (const [id, P] of list) {
      const dd = Math.hypot(P.x - bp.x, P.y - bp.y);
      if (dd < cd) { cd = dd; carrier = id; }
    }
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
    // pelota
    const br = Math.max(2.6, R * 0.42);
    c.beginPath(); c.arc(X(bp.x) + br * 0.3, Y(bp.y) + br * 0.4, br, 0, Math.PI * 2); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fill();
    c.beginPath(); c.arc(X(bp.x), Y(bp.y), br, 0, Math.PI * 2); c.fillStyle = '#ffffff'; c.fill();
    c.lineWidth = 1; c.strokeStyle = '#222'; c.stroke();
    // cartel de gol / entretiempo
    if (overlay && overlay.until > now) {
      c.fillStyle = 'rgba(8,14,22,0.55)';
      c.fillRect(0, canvas.height * 0.32, canvas.width, canvas.height * 0.36);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffe36b';
      c.font = `700 ${Math.round(canvas.height * 0.15)}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
      c.fillText(overlay.text, canvas.width / 2, canvas.height * 0.46);
      if (overlay.sub) {
        c.fillStyle = '#fff';
        c.font = `600 ${Math.round(canvas.height * 0.065)}px 'Barlow', sans-serif`;
        c.fillText(overlay.sub, canvas.width / 2, canvas.height * 0.59);
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    const k = Math.min(1, dt * Math.max(2.2, 1800 / tickMs));
    for (const id in pl) {
      const P = pl[id];
      P.x += (P.tx - P.x) * k;
      P.y += (P.ty - P.y) * k;
    }
    const bp = ballPos(now);
    if (ball.path.length && now - ball.t0 >= ball.dur) {
      const end = ball.path[ball.path.length - 1];
      ball.x = end.x; ball.y = end.y; ball.path = [];
      if (ball.reset) { ball.reset = false; setTimeout(kickoff, Math.min(1200, tickMs * 1.5)); }
    } else if (!ball.path.length) { ball.x = bp.x; ball.y = bp.y; }
    draw(now);
    raf = requestAnimationFrame(frame);
  }

  resize();
  kickoff();
  return {
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = null; },
    setTick(ms) { tickMs = ms; },
    minute,
    kickoff,
    resize,
    banner(text, sub, ms) { overlay = { text, sub, until: performance.now() + (ms || 1800) }; },
  };
};
