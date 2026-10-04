// Arranque, pantalla inicial, avance del juego y guardado automático.
DT.Main = (function () {
  const U = DT.U;
  const UI = DT.UI;
  const A = UI.A;
  const Main = { downloads: null };
  let saveCount = 0;
  const start = { step: 1, cc: 'ARG', name: '', team: null };

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
    UI.tab = 'home';
    UI.compSel = null;
    UI.compCountry = null;
    UI.closeModal();
    document.getElementById('overlay').hidden = true;
    if (DT.G.pendingOffers) Main.showJobs();
    UI.render();
  };

  // ---------- pantalla inicial ----------
  Main.showStart = async function (fresh) {
    DT.G = null;
    document.getElementById('tabs').hidden = true;
    document.getElementById('cta').innerHTML = '';
    document.getElementById('top').innerHTML = '';
    const meta = fresh ? null : DT.Save.localMeta();
    const cloudMeta = fresh ? null : await DT.Save.cloudMeta();
    start.step = 1;
    renderStart(meta, cloudMeta);
  };

  function renderStart(meta, cloudMeta) {
    const main = document.getElementById('main');
    if (start.step === 1) {
      main.innerHTML = `
        <div class="hero">
          <svg class="trophy" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" aria-hidden="true"><path d="M20 8h24v14a12 12 0 0 1-24 0z"/><path d="M20 12h-8a8 8 0 0 0 10 12M44 12h8a8 8 0 0 1-10 12"/><path d="M32 34v10M24 56h16M26 44h12v12H26z"/></svg>
          <h1>DT <span>Sudamericano</span></h1>
          <div class="muted">Dirigí a tu club en las 10 ligas de Sudamérica, la Libertadores y la Sudamericana.</div>
          ${UI.layoutSwitch()}
        </div>
        ${meta ? `<section class="card"><span class="up">Partida guardada</span><div><b>${U.esc(meta.team)}</b> · ${U.esc(meta.mgr)} · temporada ${meta.year}, semana ${meta.week}</div><button class="btn primary block big" data-a="loadLocal">Continuar partida</button></section>` : ''}
        ${cloudMeta && (!meta || cloudMeta.at > meta.at) ? `<section class="card"><span class="up">En tu cuenta</span><div><b>${U.esc(cloudMeta.team)}</b> · temporada ${cloudMeta.year}, semana ${cloudMeta.week}</div><button class="btn block" data-a="loadCloud">Cargar desde la nube</button></section>` : ''}
        <section class="card">
          <h2>Nueva partida</h2>
          <label class="small" for="mgrname">Tu nombre de entrenador</label>
          <input type="text" id="mgrname" maxlength="30" placeholder="Ej: Marcelo Gallardo" value="${U.esc(start.name)}">
          <span class="up">Elegí el país</span>
          <div class="chips" style="flex-wrap:wrap">${DT.COUNTRY_ORDER.map((cc) => `<button class="chip ${start.cc === cc ? 'on' : ''}" data-a="stCountry" data-cc="${cc}">${DT.COUNTRIES[cc].flag} ${DT.COUNTRIES[cc].name}</button>`).join('')}</div>
          <button class="btn primary block" data-a="stNext">Elegir club</button>
        </section>
        <section class="card flat small muted">Tu partida se guarda sola en este dispositivo. Desde Club → Partida podés exportarla como copia de seguridad.</section>`;
      return;
    }
    const C = DT.COUNTRIES[start.cc];
    const rows = DT.TEAMS[start.cc].map((r) => ({ code: r[0], n: r[1], s: r[2], stad: r[3], cap: r[4], rep: r[5], c1: r[6], c2: r[7] })).sort((a, b) => b.rep - a.rep);
    const diff = (rep) => (rep >= 85 ? ['Grande', 'gold'] : rep >= 74 ? ['Competitivo', 'ok'] : rep >= 64 ? ['Medio', ''] : ['Chico: difícil', 'warn']);
    main.innerHTML = `
      <div class="row between"><button class="btn sm" data-a="stBack">◀ Volver</button><h2>${C.flag} ${U.esc(C.league)}</h2></div>
      <div class="small muted">Los clubes grandes tienen más plata y planteles fuertes, pero la directiva exige títulos. Los chicos son un desafío financiero.</div>
      <section class="card"><div class="list">${rows.map((r) => {
        const [lbl, cls] = diff(r.rep);
        return `<div class="li" data-a="stPick" data-code="${r.code}">${UI.badge({ c1: r.c1, c2: r.c2, s: r.s })}<div class="name">${U.esc(r.n)}<div class="sub">${U.esc(r.stad)} · ${U.num(r.cap)}</div></div><span class="pill ${cls}">${lbl}</span></div>`;
      }).join('')}</div></section>`;
  }
  // vuelve a dibujar la pantalla inicial (al cambiar entre modo celular y ordenador)
  Main.refreshStart = async function () {
    if (start.step === 1) renderStart(DT.Save.localMeta(), DT.Save.cloud.ready ? await DT.Save.cloudMeta() : null);
    else renderStart();
  };
  A.stCountry = (d) => {
    start.name = (document.getElementById('mgrname') || {}).value || start.name;
    start.cc = d.cc;
    renderStart(DT.Save.localMeta(), null);
  };
  A.stNext = () => {
    start.name = (document.getElementById('mgrname') || {}).value || '';
    start.step = 2;
    renderStart();
    window.scrollTo(0, 0);
  };
  A.stBack = () => { start.step = 1; renderStart(DT.Save.localMeta(), null); };
  A.stPick = (d) => {
    const name = (start.name || '').trim() || 'El Profe';
    DT.W.newGame(start.cc + '_' + d.code, name);
    UI.tab = 'home';
    Main.autosave(true);
    UI.render();
    window.scrollTo(0, 0);
  };
  A.loadLocal = async () => {
    try {
      const ok = await DT.Save.loadLocal();
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
      UI.render();
      DT.MatchUI.open(ev.match);
    } else if (ev.type === 'seasonEnd') {
      Main.autosave(true);
      Main.showSeasonSummary(G.history[0]);
      UI.render();
    } else if (ev.type === 'jobs') {
      Main.showJobs();
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
      <h2>${myTitles.length ? `¡${myTitles.length} ${myTitles.length === 1 ? 'título' : 'títulos'} para ${U.esc(h.user.team)}!` : `${U.esc(h.user.team)} terminó ${h.user.pos}º`}</h2>
      ${myTitles.length ? `<div class="stack">${myTitles.map((x) => `<span class="pill gold">${U.esc(x.c)}</span>`).join('')}</div>` : ''}
      <section class="card">
        ${Object.keys(names).filter((k) => h.champs[k]).map((k) => `<div class="row between small"><span class="muted">${names[k]}</span><b>${U.esc(h.champs[k][1])}</b></div>`).join('')}
        ${h.champs['L_' + cc] ? `<div class="row between small"><span class="muted">${U.esc(DT.COUNTRIES[cc].league)}</span><b>${U.esc(h.champs['L_' + cc][1])}</b></div>` : ''}
        ${h.champs['C_' + cc] ? `<div class="row between small"><span class="muted">${U.esc(DT.COUNTRIES[cc].cup)}</span><b>${U.esc(h.champs['C_' + cc][1])}</b></div>` : ''}
        ${h.scorers[cc] && h.scorers[cc][0] ? `<div class="row between small"><span class="muted">Goleador</span><b>${U.esc(h.scorers[cc][0][0])} (${h.scorers[cc][0][2]})</b></div>` : ''}
        ${h.champs['REL_' + cc] ? `<div class="small muted">Descienden: ${h.champs['REL_' + cc].map(U.esc).join(', ')}. Ascienden: ${(h.champs['UP_' + cc] || []).map(U.esc).join(', ')}.</div>` : ''}
      </section>
      <div class="small">Arranca la temporada ${G.year}: revisá los mensajes (sponsor, juveniles y contratos) y el mercado de pases.</div>
      <button class="btn primary block" data-a="closeModal">Seguir</button>`);
  };

  Main.showJobs = function () {
    const G = DT.G;
    const po = G.pendingOffers;
    if (!po) return;
    UI.modal(`<h2>Te quedaste sin club</h2><div class="small">${U.esc(po.reason)}</div><div class="small muted">Elegí tu próximo desafío:</div>
      <div class="list">${po.offers.map((id) => {
        const t = G.teams[id];
        return `<div class="li" data-a="takeJob" data-id="${id}">${UI.badge(t)}<div class="name">${U.esc(t.n)}<div class="sub">${DT.COUNTRIES[t.cc].flag} ${U.esc(DT.COUNTRIES[t.cc].league)} · media ${DT.AI.rating(t)}</div></div><span class="btn sm primary">Aceptar</span></div>`;
      }).join('')}</div>`);
    // el modal de ofertas no se puede cerrar sin elegir
    const close = document.querySelector('#modal .close');
    if (close) close.remove();
  };
  A.takeJob = (d) => {
    DT.Board.takeJob(d.id);
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
        if (cm) renderStart(DT.Save.localMeta(), cm);
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
