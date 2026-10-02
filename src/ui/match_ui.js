// Pantalla de partido: previa, partido en vivo con cambios, y resultado.
DT.MatchUI = (function () {
  const U = DT.U;
  const UI = DT.UI;
  const A = UI.A;
  const MU = {};
  const SPEED_MS = { 1: 480, 2: 230, 4: 110, 8: 45 };
  let sim = null, match = null, timer = null, side = 0, selOut = null, seen = 0;

  const ov = () => document.getElementById('overlay');
  function show(html) {
    const el = ov();
    el.innerHTML = `<div class="wrap">${html}</div>`;
    el.hidden = false;
  }
  function hide() {
    const el = ov();
    el.hidden = true;
    el.innerHTML = '';
  }

  function oppPreview(team, opp, home) {
    const xi = DT.AI.pickXI(team);
    return DT.Match.preview(team, { f: team.tac.f, m: DT.AI.mentalityVs(team, opp, home), p: team.tac.p }, xi);
  }

  function compareBar(label, a, b) {
    const tot = Math.max(1, a + b);
    return `<div class="statline"><b class="tab-nums">${a}</b><div class="stack" style="gap:2px"><span class="tiny muted" style="text-align:center">${label}</span><div class="bars"><i style="width:${(a / tot) * 100}%"></i><i style="width:${(b / tot) * 100}%"></i></div></div><b class="tab-nums" style="text-align:right">${b}</b></div>`;
  }

  // ---------- previa ----------
  MU.open = function (m) {
    const G = DT.G;
    match = m;
    const me = DT.userTeam();
    side = m.h === me.id ? 0 : 1;
    if (me.autoXI || DT.AI.lineupIssues(me).length) DT.AI.autoLineup(me);
    const h = G.teams[m.h], a = G.teams[m.a];
    const ph = side === 0 ? DT.Match.preview(me) : oppPreview(h, a, true);
    const pa = side === 1 ? DT.Match.preview(me) : oppPreview(a, h, false);
    const comp = G.season.comps[m.c];
    const issues = DT.AI.lineupIssues(me);
    let tieInfo = '';
    if (m.tie && m.leg === 2) {
      const tie = G.season.ties[m.tie];
      const l1 = G.season.matches[tie.legs[0]];
      tieInfo = `<div class="small" style="text-align:center">Ida: ${G.teams[l1.h].s} ${l1.hg}-${l1.ag} ${G.teams[l1.a].s}. Si empatan en el global, penales.</div>`;
    } else if (m.tie && G.season.ties[m.tie].single) tieInfo = '<div class="small muted" style="text-align:center">Partido único: si empatan, penales.</div>';
    show(`
      <div class="row between"><span class="kicker">${U.esc(DT.S.matchLabel(m))}</span><button class="btn sm" data-a="mClose">Volver</button></div>
      <div class="matchup">
        <div class="t">${UI.badge(h, 'xl')}<b>${U.esc(h.n)}</b><span>${UI.formChips(h.form)}</span></div>
        <div class="vs">vs</div>
        <div class="t">${UI.badge(a, 'xl')}<b>${U.esc(a.n)}</b><span>${UI.formChips(a.form)}</span></div>
      </div>
      <div class="small muted" style="text-align:center">${U.esc(m.n ? (comp.venue || 'Cancha neutral') : h.stad)}</div>
      ${tieInfo}
      <section class="card">
        ${compareBar('Media', DT.AI.rating(h), DT.AI.rating(a))}
        ${compareBar('Ataque', ph.att, pa.att)}
        ${compareBar('Mediocampo', ph.mid, pa.mid)}
        ${compareBar('Defensa', ph.def, pa.def)}
      </section>
      <section class="card">
        <div class="row between"><b>Tu equipo: ${U.esc(me.tac.f)}</b><button class="btn sm" data-a="mEditXI">Editar once</button></div>
        ${issues.length ? `<div class="small" style="color:var(--loss)">${issues.map(U.esc).join(' ')}</div>` : `<div class="small muted">${me.xi.map((id) => G.players[id]).filter(Boolean).map((p) => U.esc(p.n.split(' ').slice(-1)[0])).join(', ')}</div>`}
        <span class="up">Mentalidad</span>
        <div class="seg">${DT.MENTALITY.map((x, i) => `<button class="${me.tac.m === i ? 'on' : ''}" data-a="mMent" data-v="${i}">${['M. def', 'Def', 'Equil', 'Of', 'M. of'][i]}</button>`).join('')}</div>
        <span class="up">Presión</span>
        <div class="seg">${DT.PRESSURE.map((x, i) => `<button class="${me.tac.p === i ? 'on' : ''}" data-a="mPress" data-v="${i}">${x}</button>`).join('')}</div>
      </section>
      <button class="btn primary block big" data-a="mLive">Jugar en vivo</button>
      <button class="btn block" data-a="mQuick">Simular resultado</button>`);
  };
  A.mClose = () => { hide(); UI.render(); };
  A.mEditXI = () => { hide(); UI.tab = 'squad'; UI.sub.squad = 'xi'; UI.render(); };
  A.mMent = (d) => { DT.userTeam().tac.m = +d.v; MU.open(match); };
  A.mPress = (d) => { DT.userTeam().tac.p = +d.v; MU.open(match); };

  // ---------- en vivo ----------
  A.mLive = () => {
    sim = DT.Match.create(match);
    sim.autoSubs = false;
    selOut = null;
    seen = 0;
    renderLive();
    play();
  };
  A.mQuick = () => {
    sim = DT.Match.create(match);
    sim.autoSubs = true;
    while (!sim.done) { DT.Match.step(sim); sim.paused = null; }
    finish();
  };

  function play() {
    stop();
    const ms = SPEED_MS[DT.G.settings.speed] || 230;
    timer = setInterval(tick, ms);
    sim.running = true;
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (sim) sim.running = false;
  }
  function tick() {
    if (!sim) return stop();
    DT.Match.step(sim);
    if (sim.done) { stop(); finish(); return; }
    if (sim.paused) { stop(); }
    updateLive();
  }

  function scoreboard() {
    const G = DT.G;
    const h = G.teams[match.h], a = G.teams[match.a];
    const min = sim.min > 90 ? `90+${sim.min - 90}'` : sim.half === 1 && sim.min > 45 ? `45+${sim.min - 45}'` : `${sim.min}'`;
    return `<div class="scoreboard" id="sb">
      <div class="t">${UI.badge(h, 'l')}<b>${U.esc(h.s)}</b></div>
      <div><div class="sc tab-nums">${sim.s[0].goals} - ${sim.s[1].goals}</div><div class="min">${sim.done ? 'Final' : sim.paused === 'ht' ? 'Entretiempo' : min}</div></div>
      <div class="t">${UI.badge(a, 'l')}<b>${U.esc(a.s)}</b></div></div>`;
  }
  function stats() {
    const s0 = sim.s[0], s1 = sim.s[1];
    const pt = Math.max(1, s0.poss + s1.poss);
    const p0 = Math.round((s0.poss / pt) * 100);
    const line = (l, a, b, pa, pb) => `<div class="statline"><b class="tab-nums">${a}</b><div class="stack" style="gap:2px"><span class="tiny muted" style="text-align:center">${l}</span><div class="bars"><i style="width:${pa}%"></i><i style="width:${pb}%"></i></div></div><b class="tab-nums" style="text-align:right">${b}</b></div>`;
    const sh = Math.max(1, s0.shots + s1.shots), so = Math.max(1, s0.sot + s1.sot);
    return line('Posesión', p0 + '%', 100 - p0 + '%', p0, 100 - p0) + line('Remates', s0.shots, s1.shots, (s0.shots / sh) * 100, (s1.shots / sh) * 100) + line('Al arco', s0.sot, s1.sot, (s0.sot / so) * 100, (s1.sot / so) * 100);
  }
  function feed() {
    const evs = sim.events.slice().reverse().slice(0, 40);
    const fresh = sim.events.length - seen;
    seen = sim.events.length;
    return evs.map((e, i) => {
      const ic = e.type === 'yellow' ? '<span class="ic yellow"></span>' : e.type === 'red' ? '<span class="ic red"></span>' : '';
      const team = e.side >= 0 ? DT.G.teams[sim.s[e.side].tid].s : '';
      return `<div class="ev ${e.type} ${i < fresh ? 'new' : ''}"><span class="m">${e.m}'</span>${ic}<span class="grow">${team ? `<b class="tiny muted">${U.esc(team)}</b> ` : ''}${U.esc(e.text)}</span></div>`;
    }).join('') || '<div class="small muted">Rueda la pelota…</div>';
  }
  function controls() {
    const sp = DT.G.settings.speed;
    const paused = !sim.running;
    let note = '';
    if (sim.paused === 'ht') note = '<div class="msg pending small">Entretiempo. Hacé cambios o ajustá la táctica antes del segundo tiempo.</div>';
    if (sim.paused === 'inj') note = `<div class="msg pending small">${U.esc(DT.G.players[sim.injuredPid].n)} se lesionó. Elegí un reemplazo abajo.</div>`;
    return `${note}<div class="grid3">
      <button class="btn ${paused ? 'primary' : ''}" data-a="mToggle">${paused ? (sim.paused === 'ht' ? '2º tiempo' : 'Seguir') : 'Pausa'}</button>
      <button class="btn" data-a="mSpeed">Vel. ${sp}x</button>
      <button class="btn" data-a="mEnd">Ir al final</button></div>`;
  }
  function panel() {
    const G = DT.G;
    const s = sim.s[side];
    const on = s.on.map((x) => {
      const p = G.players[x.id];
      return `<div class="li ${selOut === x.id ? 'sel' : ''}" data-a="mSelOut" data-id="${x.id}"><span class="pos ${x.slot}">${U.posName[x.slot]}</span><div class="name">${U.esc(p.n)}${p.inj > 0 ? ' <span class="pill bad">Lesionado</span>' : ''}${s.cards && s.cards[x.id] ? ' <span class="ic yellow" style="display:inline-block;width:9px;height:12px;background:#f2c200;border-radius:2px"></span>' : ''}<div class="sub">Nota ${(s.rating[x.id] || 6).toFixed(1)}</div></div>${UI.fitBar(p.fit)}<span class="ovr">${p.ovr}</span></div>`;
    }).join('');
    const bench = s.bench.map((id) => G.players[id]).filter(Boolean).map((p) => `<div class="li" data-a="mSelIn" data-id="${p.id}">${UI.pos(p)}<div class="name">${U.esc(p.n)}</div>${UI.fitBar(p.fit)}<span class="ovr">${p.ovr}</span></div>`).join('');
    return `<section class="card">
      <div class="row between"><h3>Cambios</h3><span class="pill">${5 - s.subs} disponibles</span></div>
      <div class="small muted">${selOut ? 'Ahora tocá el suplente que entra.' : 'Tocá el jugador que sale y después el que entra.'}</div>
      <div class="list">${on}</div>
      <div class="up">Banco</div><div class="list">${bench || '<div class="small muted">Sin suplentes.</div>'}</div>
      <span class="up">Mentalidad</span>
      <div class="seg">${DT.MENTALITY.map((x, i) => `<button class="${s.tac.m === i ? 'on' : ''}" data-a="mLiveMent" data-v="${i}">${['M. def', 'Def', 'Equil', 'Of', 'M. of'][i]}</button>`).join('')}</div>
      <span class="up">Presión</span>
      <div class="seg">${DT.PRESSURE.map((x, i) => `<button class="${s.tac.p === i ? 'on' : ''}" data-a="mLivePress" data-v="${i}">${x}</button>`).join('')}</div>
      <label class="toggle small"><input type="checkbox" id="autosubs" data-c="mAutoSubs" ${sim.autoSubs ? 'checked' : ''}> Cambios automáticos por cansancio</label>
    </section>`;
  }
  function renderLive() {
    show(`<span class="kicker">${U.esc(DT.S.matchLabel(match))}</span>
      ${scoreboard()}
      <div id="ctl">${controls()}</div>
      <section class="card"><div id="stats">${stats()}</div></section>
      <section class="card"><div class="feed" id="feed">${feed()}</div></section>
      <div id="panel">${panel()}</div>`);
  }
  function updateLive() {
    const sb = document.getElementById('sb');
    if (!sb) return renderLive();
    sb.outerHTML = scoreboard();
    document.getElementById('stats').innerHTML = stats();
    if (sim.events.length !== seen) document.getElementById('feed').innerHTML = feed();
    document.getElementById('ctl').innerHTML = controls();
    if (sim.paused || sim.min % 5 === 0) document.getElementById('panel').innerHTML = panel();
  }

  A.mToggle = () => {
    if (sim.running) { stop(); updateLive(); return; }
    // al reanudar, si quedó un lesionado en cancha, entra el mejor suplente
    if (sim.paused === 'inj' && sim.injuredPid) {
      const s = sim.s[side];
      const x = s.on.find((o) => o.id === sim.injuredPid);
      if (x) {
        const repl = DT.Match.bestBenchFor(sim, side, x.slot);
        if (repl && s.subs < 5) DT.Match.sub(sim, side, x.id, repl);
        else { s.on = s.on.filter((o) => o.id !== x.id); s.out.push(x.id); }
      }
    }
    sim.paused = null;
    sim.injuredPid = null;
    play();
    updateLive();
  };
  A.mSpeed = () => {
    const order = [1, 2, 4, 8];
    const G = DT.G;
    G.settings.speed = order[(order.indexOf(G.settings.speed) + 1) % order.length];
    if (sim.running) play();
    updateLive();
  };
  A.mEnd = () => {
    stop();
    sim.autoSubs = true;
    while (!sim.done) { DT.Match.step(sim); sim.paused = null; }
    finish();
  };
  A.mSelOut = (d) => { selOut = +d.id; document.getElementById('panel').innerHTML = panel(); };
  A.mSelIn = (d) => {
    if (!selOut) { UI.toast('Primero tocá el jugador que sale.'); return; }
    const s = sim.s[side];
    if (s.subs >= 5) { UI.toast('Ya hiciste los 5 cambios.'); return; }
    const outId = selOut;
    if (DT.Match.sub(sim, side, outId, +d.id)) {
      if (sim.injuredPid === outId) { sim.injuredPid = null; }
      selOut = null;
      updateLive();
      document.getElementById('panel').innerHTML = panel();
    }
  };
  A.mLiveMent = (d) => { sim.s[side].tac.m = +d.v; document.getElementById('panel').innerHTML = panel(); };
  A.mLivePress = (d) => { sim.s[side].tac.p = +d.v; document.getElementById('panel').innerHTML = panel(); };
  A.mAutoSubs = (d, el) => { sim.autoSubs = el.checked; };

  // ---------- final ----------
  function finish() {
    const G = DT.G;
    stop();
    if (DT.S.needsPens(match, sim.s[0].goals, sim.s[1].goals)) DT.Match.penalties(sim);
    DT.Match.apply(sim);
    DT.S.record(match, sim);
    const slotW = G.week, slotS = G.slot;
    DT.S.afterUserMatch();
    const h = G.teams[match.h], a = G.teams[match.a];
    const s = sim.s[side];
    const mine = s.goals, theirs = sim.s[1 - side].goals;
    let res = mine > theirs ? 'Victoria' : mine < theirs ? 'Derrota' : 'Empate';
    if (sim.pens) res = sim.pens[side] > sim.pens[1 - side] ? 'Clasificado por penales' : 'Eliminado por penales';
    const tie = match.tie ? G.season.ties[match.tie] : null;
    if (tie && tie.winner && !sim.pens) res += tie.winner === G.user ? ' · ¡Avanzás de ronda!' : (tie.single || match.leg === 2 ? ' · Eliminado' : '');
    const scorers = (sim.scorers || []).map((x) => `<div class="small">${x.m}' ${U.esc(G.players[x.pid] ? G.players[x.pid].n : '')} <span class="muted">(${U.esc(G.teams[sim.s[x.side].tid].s)})</span></div>`).join('');
    const pens = sim.pens ? `<div class="small"><b>Penales ${sim.pens[0]}-${sim.pens[1]}</b>: ${sim.pensLog.map((k) => `${k.ok ? '✓' : '✗'} ${U.esc(k.n.split(' ').slice(-1)[0])}`).join(', ')}</div>` : '';
    const ratings = [...s.played].map((pid) => ({ p: G.players[pid], r: s.rating[pid] || 6 })).filter((x) => x.p).sort((x, y) => y.r - x.r);
    const others = DT.S.slotMatches(slotW, slotS).filter((m) => m.c === match.c && m.i !== match.i && m.p).slice(0, 15);
    const mvp = match.mvp && G.players[match.mvp];
    show(`<span class="kicker">${U.esc(DT.S.matchLabel(match))}</span>
      <div class="scoreboard"><div class="t">${UI.badge(h, 'l')}<b>${U.esc(h.s)}</b></div><div><div class="sc tab-nums">${sim.s[0].goals} - ${sim.s[1].goals}</div><div class="min">Final</div></div><div class="t">${UI.badge(a, 'l')}<b>${U.esc(a.s)}</b></div></div>
      <h2 style="text-align:center;color:${res.startsWith('Victoria') || res.startsWith('Clasificado') ? 'var(--win)' : res.startsWith('Derrota') || res.startsWith('Eliminado') ? 'var(--loss)' : 'var(--ink)'}">${res}</h2>
      <section class="card">${scorers || '<div class="small muted">Sin goles.</div>'}${pens}${mvp ? `<div class="small">Figura: <b>${U.esc(mvp.n)}</b></div>` : ''}${match.att ? `<div class="small muted">Público: ${U.num(match.att)}${match.h === G.user && !match.n ? ` · recaudación ${U.money(match.att * h.ticket * 0.65)}` : ''}</div>` : ''}</section>
      <section class="card"><h3>Notas de tu equipo</h3><div class="list">${ratings.map((x) => `<div class="li" data-a="player" data-id="${x.p.id}">${UI.pos(x.p)}<div class="name">${U.esc(x.p.n)}</div>${UI.fitBar(x.p.fit)}<span class="ovr" style="color:${x.r >= 7.5 ? 'var(--win)' : x.r < 5.5 ? 'var(--loss)' : 'inherit'}">${x.r.toFixed(1)}</span></div>`).join('')}</div></section>
      ${others.length ? `<section class="card"><h3>Otros resultados</h3><div class="list">${others.map(DT.Screens.resultRow).join('')}</div></section>` : ''}
      <button class="btn primary block big" data-a="mDone">Continuar</button>`);
    ov().scrollTop = 0;
    sim = null;
    DT.Main.autosave();
  }
  A.mDone = () => {
    hide();
    UI.render();
    window.scrollTo(0, 0);
  };

  return MU;
})();
