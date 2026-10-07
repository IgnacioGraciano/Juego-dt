// Arranque, pantalla inicial, avance del juego y guardado automático.
DT.Main = (function () {
  const U = DT.U;
  const UI = DT.UI;
  const A = UI.A;
  const Main = { downloads: null };
  let saveCount = 0;
  const start = { step: 1, cc: 'ARG', name: '', team: null, diff: 'arcade', slot: 1 };
  const DIFFS = [
    ['arcade', 'Arcade', 'Elegís cualquier club, de los grandes a los chicos.'],
    ['real', 'Realista', 'Arrancás en un club modesto y hacés carrera hasta llegar a los grandes.'],
  ];
  // Clubes para empezar: en modo realista solo la segunda división y los más modestos de primera.
  Main.startClubs = function (cc, diff) {
    const C = DT.COUNTRIES[cc];
    const mk = (r, div) => ({ code: r[0], n: r[1], s: r[2], stad: r[3], cap: r[4], rep: r[5], c1: r[6], c2: r[7], div, id: cc + '_' + r[0], cc });
    const first = DT.TEAMS[cc].map((r) => mk(r, 1)).sort((a, b) => b.rep - a.rep);
    const second = ((DT.TEAMS2 || {})[cc] || []).map((r) => mk(r, 2)).sort((a, b) => b.rep - a.rep);
    if (diff === 'real') {
      const k = Math.ceil(first.length * (second.length ? 0.2 : 0.3));
      const cut = first[first.length - k].rep;
      first.forEach((x) => (x.ok = x.rep <= cut));
      second.forEach((x) => (x.ok = true));
    } else first.concat(second).forEach((x) => (x.ok = true));
    return { first, second, C };
  };

  Main.autosave = async function (force) {
    if (!DT.G) return false;
    const ok = await DT.Save.local();
    saveCount++;
    if (DT.Save.cloud.ready && (force || saveCount % 4 === 0)) DT.Save.cloudSave();
    return ok;
  };

  Main.afterLoad = function () {
    // partidas guardadas con versiones anteriores
    const ut = DT.userTeam();
    if (ut.capBase === undefined) DT.E.resetCap(ut);
    if (DT.G.settings.speed === 8) DT.G.settings.speed = 4;
    if (!DT.G.retired) DT.Acad.ensure(ut);
    if (!DT.G.wkSnap && !DT.G.retired && !DT.G.pendingOffers) DT.Week.snap();
    // la directiva se volvió más justa: las partidas ya empezadas se reevalúan una vez
    if (!DT.G.boardV2 && !DT.G.retired && !DT.G.pendingOffers) {
      DT.G.boardV2 = 1;
      const M = DT.G.manager;
      const st = DT.Board.standing();
      const before = Math.round(M.conf);
      if (st && st.pj >= 3 && st.pos <= st.target) M.conf = Math.max(M.conf, 50);
      else if (M.conf < 35) M.conf = Math.min(35, M.conf + 10);
      if (Math.round(M.conf) > before) {
        DT.G.notices = (DT.G.notices || []).concat([{ kind: 'msg', title: 'La directiva revisó tu evaluación', body: `Con los nuevos criterios (posición frente al objetivo, avance en las copas y finanzas), tu confianza pasa de ${before} a ${Math.round(M.conf)}.` }]);
      }
    }
    UI.tab = 'home';
    UI.compSel = null;
    UI.compCountry = null;
    UI.closeModal();
    document.getElementById('overlay').hidden = true;
    UI.render();
  };

  // ---------- pantalla inicial ----------
  Main.showStart = async function (fresh) {
    DT.G = null;
    document.getElementById('tabs').hidden = true;
    document.getElementById('cta').innerHTML = '';
    document.getElementById('top').innerHTML = '';
    const cloudMeta = await DT.Save.cloudMeta();
    start.step = 1;
    const metas = DT.Save.allMeta();
    const free = metas.findIndex((m) => !m);
    start.slot = free >= 0 ? free + 1 : DT.Save.slot;
    renderStart(cloudMeta);
    window.scrollTo(0, 0);
  };

  // Las 3 carreras guardadas en el dispositivo.
  function slotsCard(metas) {
    const any = metas.some(Boolean);
    return `<section class="card"><h2>Tus carreras</h2>${metas.map((m, i) => {
      const n = i + 1;
      if (!m) return `<div class="slot empty"><span class="slotn">${n}</span><div class="grow muted small">Espacio libre</div></div>`;
      const tm = { id: m.tid, cc: m.tid ? m.tid.split('_')[0] : '', s: (m.team || '?').slice(0, 3).toUpperCase(), c1: '#8b95a3', c2: '#3a4656' };
      return `<div class="slot"><span class="slotn">${n}</span>${m.tid ? UI.badge(tm) : ''}<div class="grow"><b>${U.esc(m.team)}</b><div class="tiny muted">${U.esc(m.mgr)} · temporada ${m.year}, semana ${m.week}${m.diff === 'real' ? ' · Realista' : ''}${m.retired ? ' · <span class="pill">Retirado</span>' : m.fired ? ' · <span class="pill bad">Sin club</span>' : ''}</div></div>
        <button class="btn sm primary" data-a="loadSlot" data-n="${n}">${m.retired ? 'Ver' : 'Jugar'}</button><button class="btn sm" data-a="delSlotAsk" data-n="${n}" aria-label="Borrar la carrera ${n}">Borrar</button></div>`;
    }).join('')}${any ? '' : '<div class="small muted">Todavía no tenés carreras guardadas. Empezá una nueva acá abajo.</div>'}</section>`;
  }

  function renderStart(cloudMeta) {
    const main = document.getElementById('main');
    const metas = DT.Save.allMeta();
    const meta = metas.find(Boolean);
    if (start.step === 1) {
      main.innerHTML = `
        <div class="hero">
          <svg class="trophy" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><path d="M20 8h24v14a12 12 0 0 1-24 0z"/><path d="M20 12h-8a8 8 0 0 0 10 12M44 12h8a8 8 0 0 1-10 12"/><path d="M32 34v10M24 56h16M26 44h12v12H26z"/></svg>
          <h1>DT <span>Sudamericano</span></h1>
          <div class="muted">Dirigí a tu club en las 10 ligas de Sudamérica, la Libertadores y la Sudamericana.</div>
          ${UI.layoutSwitch()}
        </div>
        ${slotsCard(metas)}
        ${cloudMeta && (!meta || cloudMeta.at > meta.at) ? `<section class="card"><span class="up">En tu cuenta</span><div><b>${U.esc(cloudMeta.team)}</b> · temporada ${cloudMeta.year}, semana ${cloudMeta.week}</div><button class="btn block" data-a="loadCloud">Cargar desde la nube</button></section>` : ''}
        <section class="card">
          <h2>Nueva partida</h2>
          <label class="small" for="mgrname">Tu nombre de entrenador</label>
          <input type="text" id="mgrname" maxlength="30" placeholder="Ej: Marcelo Gallardo" value="${U.esc(start.name)}">
          <span class="up">Dificultad</span>
          <div class="diffpick">${DIFFS.map(([k, l, d]) => `<button class="${start.diff === k ? 'on' : ''}" data-a="stDiff" data-v="${k}" aria-pressed="${start.diff === k}"><b>${l}</b><span>${d}</span></button>`).join('')}</div>
          <span class="up">Guardar en el espacio</span>
          <div class="seg">${metas.map((m, i) => `<button class="${start.slot === i + 1 ? 'on' : ''}" data-a="stSlot" data-v="${i + 1}">${i + 1}${m ? ' · ocupado' : ' · libre'}</button>`).join('')}</div>
          ${metas[start.slot - 1] ? `<div class="tiny" style="color:var(--warn)">Se va a reemplazar la carrera con ${U.esc(metas[start.slot - 1].team)}.</div>` : ''}
          <span class="up">Elegí el país</span>
          <div class="chips" style="flex-wrap:wrap">${DT.COUNTRY_ORDER.map((cc) => `<button class="chip ${start.cc === cc ? 'on' : ''}" data-a="stCountry" data-cc="${cc}">${DT.COUNTRIES[cc].flag} ${DT.COUNTRIES[cc].name}</button>`).join('')}</div>
          <button class="btn primary block" data-a="stNext">Elegir club</button>
        </section>
        <section class="card flat small muted">Tu partida se guarda sola en este dispositivo. Desde Club → Partida podés exportarla como copia de seguridad.</section>`;
      return;
    }
    const { first, second, C } = Main.startClubs(start.cc, start.diff);
    const real = start.diff === 'real';
    const diff = (r) => (r.div === 2 ? ['Ascenso', ''] : r.rep >= 85 ? ['Grande', 'gold'] : r.rep >= 74 ? ['Competitivo', 'ok'] : r.rep >= 64 ? ['Medio', ''] : ['Chico: difícil', 'warn']);
    const list = (rows) => rows.filter((r) => r.ok).map((r) => {
      const [lbl, cls] = diff(r);
      return `<div class="li" data-a="stPick" data-code="${r.code}">${UI.badge(r)}<div class="name">${U.esc(r.n)}<div class="sub">${U.esc(r.stad)} · ${U.num(r.cap)}</div></div><span class="pill ${cls}">${lbl}</span></div>`;
    }).join('');
    const block = (title, rows, note) => (rows.some((r) => r.ok) ? `<section class="card"><h3>${U.esc(title)}</h3>${note ? `<div class="small muted">${note}</div>` : ''}<div class="list">${list(rows)}</div></section>` : '');
    main.innerHTML = `
      <div class="row between"><button class="btn sm" data-a="stBack">◀ Volver</button><h2>${C.flag} ${U.esc(C.name)}</h2></div>
      <div class="small muted">${real ? 'Modo realista: solo podés arrancar en clubes modestos. Con buenas campañas te van a llamar clubes más grandes.' : 'Los clubes grandes tienen más plata y planteles fuertes, pero la directiva exige títulos. Los chicos son un desafío financiero.'}</div>
      ${block(C.league, first, real ? 'Los más modestos de primera: pelean por no descender.' : '')}
      ${C.div2 ? block(C.div2.name, second, `Segunda división: suben los ${C.rel} primeros.`) : ''}`;
  }
  // vuelve a dibujar la pantalla inicial (al cambiar entre modo celular y ordenador)
  Main.refreshStart = async function () {
    if (start.step === 1) renderStart(DT.Save.cloud.ready ? await DT.Save.cloudMeta() : null);
    else renderStart();
  };
  A.stCountry = (d) => {
    start.name = (document.getElementById('mgrname') || {}).value || start.name;
    start.cc = d.cc;
    renderStart(null);
  };
  A.stNext = () => {
    start.name = (document.getElementById('mgrname') || {}).value || '';
    start.step = 2;
    renderStart();
    window.scrollTo(0, 0);
  };
  A.stDiff = (d) => {
    start.name = (document.getElementById('mgrname') || {}).value || start.name;
    start.diff = d.v === 'real' ? 'real' : 'arcade';
    renderStart(null);
  };
  A.stBack = () => { start.step = 1; renderStart(null); };
  A.stPick = (d) => {
    const name = (start.name || '').trim() || 'El Profe';
    DT.Save.setSlot(start.slot || 1);
    DT.W.newGame(start.cc + '_' + d.code, name, start.diff);
    DT.Week.snap();
    UI.tab = 'home';
    Main.autosave(true);
    UI.render();
    window.scrollTo(0, 0);
  };
  A.stSlot = (d) => {
    start.name = (document.getElementById('mgrname') || {}).value || start.name;
    start.slot = +d.v;
    renderStart(null);
  };
  A.delSlotAsk = (d) => {
    const m = DT.Save.localMeta(+d.n);
    UI.modal(`<h3>¿Borrar la carrera ${d.n}?</h3><div class="small">Se borra la carrera de ${U.esc(m ? m.mgr : '')} con ${U.esc(m ? m.team : '')}. No se puede deshacer.</div><button class="btn danger block" data-a="delSlotDo" data-n="${d.n}">Borrar</button>`);
  };
  A.delSlotDo = (d) => {
    DT.Save.clearLocal(+d.n);
    UI.closeModal();
    Main.showStart(false);
  };
  A.loadSlot = (d) => A.loadLocal(d);
  A.loadLocal = async (d) => {
    try {
      const ok = await DT.Save.loadLocal(d && d.n ? +d.n : 0);
      if (!ok) { UI.toast('No se encontró la partida.'); return; }
      Main.afterLoad();
    } catch (e) {
      UI.toast('La partida guardada está dañada. Empezá una nueva o importá una copia.');
    }
  };
  A.loadCloud = async () => {
    const ok = await DT.Save.cloudLoad();
    if (!ok) { UI.toast('No se pudo cargar desde la nube.'); return; }
    Main.afterLoad();
  };

  // ---------- avance ----------
  A.advance = () => {
    if (UI.busy) return;
    const G = DT.G;
    const um = DT.S.userMatchNow();
    if (um) { DT.MatchUI.open(um); return; }
    UI.busy = true;
    let ev;
    try {
      ev = DT.S.advance();
    } finally {
      UI.busy = false;
    }
    if (ev.type === 'match') {
      // el resumen de la semana se muestra después del partido
      UI.skipWeek = true;
      UI.render();
      UI.skipWeek = false;
      DT.MatchUI.open(ev.match);
    } else if (ev.type === 'seasonEnd') {
      Main.autosave(true);
      Main.showSeasonSummary(G.history[0]);
      UI.render();
    } else if (ev.type === 'jobs') {
      Main.autosave(true);
      UI.render();
    } else {
      if (ev.type === 'inbox') {
        UI.tab = 'home';
        UI.toast('Tenés decisiones pendientes.');
      }
      Main.autosave();
      UI.render();
    }
  };

  Main.showSeasonSummary = function (h) {
    const G = DT.G;
    const t = DT.userTeam();
    const cc = t.cc;
    const names = { LIB: 'Copa Libertadores', SUD: 'Copa Sudamericana', REC: 'Recopa', INT: 'Intercontinental' };
    const myTitles = G.manager.titles.filter((x) => x.y === h.y);
    UI.modal(`<span class="kicker">Fin de temporada ${h.y}</span>
      <h2>${myTitles.length ? `¡${myTitles.length} ${myTitles.length === 1 ? 'título' : 'títulos'} para ${U.esc(h.user.team)}!` : `${U.esc(h.user.team)} terminó ${h.user.pos}º${h.user.div ? ` en ${U.esc(h.user.div)}` : ''}`}</h2>
      ${myTitles.length ? `<div class="stack">${myTitles.map((x) => `<span class="pill gold">${U.esc(x.c)}</span>`).join('')}</div>` : ''}
      <section class="card">
        ${Object.keys(names).filter((k) => h.champs[k]).map((k) => `<div class="row between small"><span class="muted">${names[k]}</span><b>${U.esc(h.champs[k][1])}</b></div>`).join('')}
        ${h.champs['L_' + cc] ? `<div class="row between small"><span class="muted">${U.esc(DT.COUNTRIES[cc].league)}</span><b>${U.esc(h.champs['L_' + cc][1])}</b></div>` : ''}
        ${h.champs['B_' + cc] ? `<div class="row between small"><span class="muted">${U.esc(DT.COUNTRIES[cc].div2.name)}</span><b>${U.esc(h.champs['B_' + cc][1])}</b></div>` : ''}
        ${h.champs['C_' + cc] ? `<div class="row between small"><span class="muted">${U.esc(DT.COUNTRIES[cc].cup)}</span><b>${U.esc(h.champs['C_' + cc][1])}</b></div>` : ''}
        ${h.scorers[cc] && h.scorers[cc][0] ? `<div class="row between small"><span class="muted">Goleador</span><b>${U.esc(h.scorers[cc][0][0])} (${h.scorers[cc][0][2]})</b></div>` : ''}
        ${h.champs['REL_' + cc] ? `<div class="small muted">Descienden: ${h.champs['REL_' + cc].map(U.esc).join(', ')}. Ascienden: ${(h.champs['UP_' + cc] || []).map(U.esc).join(', ')}.</div>` : ''}
      </section>
      <div class="small">Arranca la temporada ${G.year}: revisá los mensajes (sponsor, juveniles y contratos) y el mercado de pases.</div>
      <button class="btn primary block" data-a="closeModal">Seguir</button>`);
  };

  // ---------- despido y retiro ----------
  // Pantalla completa: mientras estás sin club no se puede tocar nada del equipo anterior.
  let careerView = 'main';
  const careerStats = () => {
    const M = DT.G.manager;
    return `<div class="kv"><div><span>Partidos</span><b>${M.pj}</b></div><div><span>G-E-P</span><b class="tab-nums" style="font-size:1rem">${M.g}-${M.e}-${M.p}</b></div><div><span>Títulos</span><b>${M.titles.length}</b></div><div><span>Reputación</span><b>${Math.round(M.rep)}</b></div><div><span>Clubes</span><b>${M.clubs.length}</b></div><div><span>Desde</span><b>${M.since}</b></div></div>`;
  };
  const careerList = () => {
    const M = DT.G.manager;
    const rows = M.career.filter((c) => !c.y).slice().reverse();
    return rows.length ? `<div class="list">${rows.map((c) => `<div class="li"><div class="name">${U.esc(c.club)}<div class="sub">${c.from}–${c.to} · ${U.esc(c.why)}</div></div></div>`).join('')}</div>` : '';
  };
  function showOverlay(html) {
    const el = document.getElementById('overlay');
    el.innerHTML = `<div class="wrap career">${html}</div>`;
    el.hidden = false;
    el.scrollTop = 0;
    document.getElementById('tabs').hidden = true;
    document.getElementById('cta').innerHTML = '';
  }
  Main.showCareerScreen = function () {
    const G = DT.G;
    const M = G.manager;
    UI.closeModal();
    if (G.retired) {
      showOverlay(`<div class="hero"><svg class="trophy" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><path d="M20 8h24v14a12 12 0 0 1-24 0z"/><path d="M20 12h-8a8 8 0 0 0 10 12M44 12h8a8 8 0 0 1-10 12"/><path d="M32 34v10M24 56h16M26 44h12v12H26z"/></svg>
        <span class="kicker">Fin de la carrera · ${G.retired.y}</span><h1>${U.esc(M.n)}</h1><div class="muted">Colgó el buzo de entrenador después de ${G.retired.y - M.since + 1} ${G.retired.y - M.since ? 'temporadas' : 'temporada'}.</div></div>
        <section class="card">${careerStats()}</section>
        <section class="card"><h3>Títulos</h3>${M.titles.length ? `<div class="list">${M.titles.map((x) => `<div class="li"><span class="pill gold">${x.y}</span><div class="name">${U.esc(x.c)}<div class="sub">${U.esc(x.t)}</div></div></div>`).join('')}</div>` : '<div class="small muted">Sin títulos.</div>'}</section>
        ${careerList() ? `<section class="card"><h3>Trayectoria</h3>${careerList()}</section>` : ''}
        <button class="btn primary block big" data-a="newCareer">Empezar una nueva partida</button>`);
      return;
    }
    const po = G.pendingOffers;
    const old = DT.userTeam();
    if (careerView === 'clubs') {
      showOverlay(`<div class="row between"><button class="btn sm" data-a="careerView" data-v="main">◀ Volver</button><span class="kicker">Clubes interesados</span></div>
        <h2>Te quieren dirigir</h2><div class="small muted">Solo aparecen los clubes que preguntaron por vos. Al aceptar arrancás de inmediato con un nuevo objetivo.</div>
        ${po.offers.map((id) => {
          const t = G.teams[id];
          return `<section class="card"><div class="row">${UI.badge(t, 'l')}<div class="grow"><b style="font-family:var(--display);font-size:1.15rem">${U.esc(t.n)}</b><div class="small muted">${DT.COUNTRIES[t.cc].flag} ${U.esc(DT.divName(t))}</div></div></div>
            <div class="kv"><div><span>Media</span><b>${DT.AI.rating(t)}</b></div><div><span>Reputación</span><b>${Math.round(t.rep)}</b></div><div><span>Caja</span><b>${U.money(t.cash)}</b></div></div>
            <button class="btn primary block" data-a="takeJob" data-id="${id}">Aceptar a ${U.esc(t.n)}</button></section>`;
        }).join('') || '<div class="empty">Por ahora ningún club preguntó por vos.</div>'}`);
      return;
    }
    if (careerView === 'retire') {
      showOverlay(`<span class="kicker">Retiro</span><h2>¿Colgar el buzo?</h2>
        <div class="small">Termina tu carrera como entrenador. Vas a ver el resumen de tu trayectoria y después podés empezar una partida nueva.</div>
        <button class="btn danger block big" data-a="retireDo">Sí, me retiro</button><button class="btn block" data-a="careerView" data-v="main">Volver</button>`);
      return;
    }
    showOverlay(`<div class="hero">${UI.badge(old, 'xl')}<span class="kicker" style="color:var(--loss)">Despedido</span><h1 style="font-size:2.2rem">Te quedaste sin club</h1><div class="muted">${U.esc(po.reason)}</div></div>
      <section class="card"><span class="up">${U.esc(M.n)}</span>${careerStats()}</section>
      <button class="btn primary block big" data-a="careerView" data-v="clubs">Ver clubes interesados (${po.offers.length})</button>
      <button class="btn block big" data-a="careerView" data-v="retire">Retirarme</button>
      <div class="small muted" style="text-align:center">Ya no podés dirigir partidos ni manejar el plantel de ${U.esc(old.n)}.</div>`);
  };
  A.careerView = (d) => { careerView = d.v; Main.showCareerScreen(); };
  A.retireDo = () => {
    DT.Board.retire();
    careerView = 'main';
    Main.autosave(true);
    Main.showCareerScreen();
  };
  A.newCareer = () => {
    document.getElementById('overlay').hidden = true;
    Main.showStart(true);
  };
  A.takeJob = (d) => {
    DT.Board.takeJob(d.id);
    careerView = 'main';
    document.getElementById('overlay').hidden = true;
    UI.closeModal();
    UI.tab = 'home';
    UI.compSel = null;
    Main.autosave(true);
    UI.render();
    UI.toast(`Nuevo desafío: ${DT.userTeam().n}.`);
  };

  // ---------- arranque ----------
  Main.boot = async function (hotData) {
    UI.loadLayout();
    UI.bind();
    // capacidades opcionales del visor (nube y descargas)
    const capInit = (async () => {
      try {
        if (window.claude && window.claude.use) {
          await DT.Save.initCloud();
          Main.downloads = await window.claude.use('downloads');
        }
      } catch (e) { /* sin capacidades: se usa solo el guardado local */ }
    })();
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
      window.claude.hot.snapshot(() => ({ json: DT.G ? DT.Save.toJSON() : null }));
    }
    if (hotData && hotData.json) {
      try {
        DT.Save.deserialize(JSON.parse(hotData.json));
        Main.afterLoad();
        return;
      } catch (e) { /* sigue al inicio normal */ }
    }
    await Main.showStart(false);
    capInit.then(async () => {
      if (!DT.G && DT.Save.cloud.ready) {
        const cm = await DT.Save.cloudMeta();
        if (cm) renderStart(cm);
      }
    });
  };

  return Main;
})();

(function () {
  const go = (data) => DT.Main.boot(data || {});
  const hot = typeof window !== 'undefined' && window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(go);
  else go(hot && hot.data);
})();
