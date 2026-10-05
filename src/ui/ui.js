// Interfaz: helpers, estructura principal, modales y delegación de eventos.
DT.UI = (function () {
  const U = DT.U;
  const UI = {
    tab: 'home',
    sub: { squad: 'xi', comp: 'league', club: 'fin', market: 'search', compView: 'table' },
    compSel: null,
    compCountry: null,
    round: null,
    sel: null,
    filters: { pos: '', max: 0, age: 40, cc: '', free: false, sort: 'ovr', q: '', minOvr: 0 },
    A: {}, // acciones por data-a
  };
  const $ = (s) => document.querySelector(s);
  UI.$ = $;

  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    squad: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.2c2.9.2 5.5 2.5 5.5 5.8"/>',
    comp: '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 21h8M9 17h6v4H9z"/>',
    market: '<path d="M4 7h13l-3-3M20 17H7l3 3"/>',
    club: '<path d="M4 21V9l8-5 8 5v12"/><path d="M9 21v-6h6v6"/><path d="M4 21h16"/>',
  };
  UI.icon = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

  // Color de texto legible sobre un fondo.
  UI.textOn = function (hex) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#111111' : '#ffffff';
  };
  // Escudo real (football-logos.cc) si está en el catálogo; si no carga (sin conexión), el dibujado con los colores del club.
  UI.crestUrl = function (t) {
    const k = t && t.id && DT.CRESTS ? DT.CRESTS[t.id] : null;
    return k && DT.CREST_COUNTRY[t.cc] ? `${DT.CREST_BASE}${DT.CREST_COUNTRY[t.cc]}/512x512/${k}.png` : null;
  };
  UI.badge = function (t, size) {
    if (!t) return '';
    const drawn = `<span class="badge ${size || ''}" style="--c1:${t.c1};--c2:${t.c2};--bt:${UI.textOn(t.c1)}">${U.esc(t.s)}</span>`;
    const url = UI.crestUrl(t);
    if (!url) return `<span class="badge-wrap">${drawn}</span>`;
    return `<span class="badge-wrap crest-wrap ${size || ''}">${drawn}<img class="crest" src="${url}" alt="" loading="lazy" decoding="async" onload="this.parentNode.classList.add('crest-ok')"></span>`;
  };
  UI.teamName = (t, cls) => `<span class="${cls || ''}" data-a="team" data-id="${t.id}">${U.esc(t.n)}</span>`;
  UI.pos = (p) => `<span class="pos ${p.pos}">${U.posName[p.pos]}</span>`;
  UI.stars = (pot) => `<span class="stars" aria-label="Potencial ${DT.P.stars(pot)} de 5">${'★'.repeat(DT.P.stars(pot))}<span style="opacity:.25">${'★'.repeat(5 - DT.P.stars(pot))}</span></span>`;
  // Potencial: solo se ve si es de tu club, es libre o lo ojeaste.
  UI.potOf = (p) => (DT.M.known(p) ? UI.stars(p.pot) : '<span class="pill" title="Mandá un ojeador para conocer su potencial">? ojear</span>');
  UI.fitBar = (fit) => `<div class="bar ${fit < 55 ? 'bad' : fit < 75 ? 'warn' : ''}" style="width:44px" title="Físico ${Math.round(fit)}%"><i style="width:${Math.round(fit)}%"></i></div>`;
  UI.morale = (m) => (m >= 75 ? '<span class="pill ok">Feliz</span>' : m >= 45 ? '' : m >= 30 ? '<span class="pill warn">Molesto</span>' : '<span class="pill bad">Enojado</span>');
  UI.status = (p) => {
    let s = '';
    if (p.inj > 0) s += `<span class="pill bad">Lesión ${p.inj} sem</span>`;
    if (p.sus > 0) s += `<span class="pill bad">Suspendido</span>`;
    if (p.nt > 0) s += `<span class="pill warn">${p.nt === 2 ? 'Descansa esta semana' : 'Con la selección'}</span>`;
    if (p.loan) s += `<span class="pill">${p.loan.from === DT.G.user ? 'Cedido' : 'A préstamo'}</span>`;
    if (p.lst) s += '<span class="pill warn">En venta</span>';
    if (p.cy <= 1 && p.t && DT.isUser(p.t)) s += '<span class="pill warn">Último año</span>';
    return s;
  };
  // Orden por grupos (arqueros, defensores, medios, delanteros) y, dentro de cada grupo, por media.
  UI.byPos = (a, b) => 'PDMA'.indexOf(a.pos) - 'PDMA'.indexOf(b.pos) || b.ovr - a.ovr;
  UI.GROUPS = { P: 'Arqueros', D: 'Defensores', M: 'Mediocampistas', A: 'Delanteros' };
  // Lista con un título por grupo. `items` ya viene ordenada; `posOf` devuelve el puesto de cada item.
  UI.grouped = function (items, row, posOf) {
    posOf = posOf || ((x) => x.pos);
    let cur = null;
    return items.map((x) => {
      const g = posOf(x);
      const head = g !== cur ? `<div class="grp">${UI.GROUPS[g] || ''}</div>` : '';
      cur = g;
      return head + row(x);
    }).join('');
  };
  UI.formChips = (form) => form.slice(-5).map((r) => `<span class="res ${r}">${r}</span>`).join('');
  UI.dateLabel = () => {
    const G = DT.G;
    return G.week === 0 ? `Pretemporada ${G.year}` : `Semana ${G.week} · ${G.year}`;
  };

  UI.toast = function (text, ms) {
    const el = $('#toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(UI._tt);
    UI._tt = setTimeout(() => (el.hidden = true), ms || 2600);
  };

  UI.modal = function (html) {
    const el = $('#modal');
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><button class="btn sm close" data-a="closeModal">Cerrar</button>${html}</div>`;
    el.hidden = false;
    el.querySelector('.sheet').scrollTop = 0;
  };
  UI.closeModal = function () {
    $('#modal').hidden = true;
    $('#modal').innerHTML = '';
  };
  UI.A.closeModal = () => { UI.closeModal(); UI.showNotices(); };

  // Avisos que aparecen solos en pantalla (por ejemplo, juveniles que suben al plantel).
  UI.showNotices = function () {
    const G = DT.G;
    if (!G || !G.notices || !G.notices.length || !$('#modal').hidden) return;
    const n = G.notices.shift();
    if (n.kind === 'youth') {
      const ps = (n.pids || []).map((id) => G.players[id]).filter((p) => p && p.t === G.user).sort(UI.byPos);
      if (!ps.length) { UI.showNotices(); return; }
      UI.modal(`<span class="kicker">Cantera</span><h2>${U.esc(n.title)}</h2>
        <div class="small">${ps.length === 1 ? 'Este chico se suma' : `Estos ${ps.length} chicos se suman`} al plantel profesional. Tocá un jugador para ver su ficha.</div>
        <section class="card"><div class="list">${ps.map((p) => `<div class="li" data-a="player" data-id="${p.id}">${UI.pos(p)}<div class="name">${U.esc(p.n)}<div class="sub">${p.age} años · ${U.money(p.w)}/año</div></div>${UI.stars(p.pot)}<span class="ovr">${p.ovr}</span></div>`).join('')}</div></section>
        <button class="btn primary block" data-a="closeModal">Entendido</button>`);
    } else UI.showNotices();
  };

  // ---------- modo celular / ordenador ----------
  // Se guarda en el dispositivo (no en la partida). Sin preferencia guardada, pantallas anchas arrancan en modo ordenador.
  UI.desk = false;
  UI.setDesk = function (on, save) {
    UI.desk = !!on;
    document.documentElement.classList.toggle('desk', UI.desk);
    if (save) { try { localStorage.setItem('dt-layout', UI.desk ? 'pc' : 'cel'); } catch (e) { /* sin almacenamiento */ } }
  };
  UI.loadLayout = function () {
    let v = null;
    try { v = localStorage.getItem('dt-layout'); } catch (e) { /* sin almacenamiento */ }
    UI.setDesk(v ? v === 'pc' : window.innerWidth >= 1100);
  };
  UI.layoutSwitch = () => `<div class="seg layout-sw" role="group" aria-label="Modo de pantalla">
    <button class="${UI.desk ? '' : 'on'}" data-a="setLayout" data-v="cel" aria-pressed="${!UI.desk}">📱 Modo celular</button>
    <button class="${UI.desk ? 'on' : ''}" data-a="setLayout" data-v="pc" aria-pressed="${UI.desk}">🖥 Modo ordenador</button></div>`;
  UI.A.setLayout = (d) => {
    UI.setDesk(d.v === 'pc', true);
    if (DT.G) UI.render();
    else DT.Main.refreshStart();
  };

  // ---------- estructura ----------
  UI.renderTop = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const pend = G.inbox.filter((m) => m.actions && !m.done).length;
    const tabs = [['home', 'Inicio'], ['squad', 'Plantel'], ['comp', 'Torneos'], ['market', 'Mercado'], ['club', 'Club']];
    const tabBtns = tabs.map(([k, l]) => `<button class="${UI.tab === k ? 'on' : ''}" data-a="tab" data-tab="${k}" aria-label="${l}">${UI.icon(k)}${l}${k === 'home' && pend ? '<span class="dot"></span>' : ''}</button>`).join('');
    // en modo ordenador las pestañas van arriba, dentro de la barra del club
    const top = UI.desk ? `<nav class="toptabs">${tabBtns}</nav>` : '';
    $('#top').innerHTML = `${UI.badge(t)}<div class="club"><b>${U.esc(t.n)}</b><span class="small muted">${UI.dateLabel()}${DT.S.windowOpen() ? ' · <span style="color:var(--accent);font-weight:600">Pases abiertos</span>' : ''}</span></div>${top}<div class="cash"><span class="up" style="display:block">Caja</span><span style="color:${t.cash < 0 ? 'var(--loss)' : 'inherit'}">${U.money(t.cash)}</span></div>`;
    const nav = $('#tabs');
    nav.hidden = UI.desk;
    nav.innerHTML = UI.desk ? '' : `<div class="inner">${tabBtns}</div>`;
  };

  UI.renderCTA = function () {
    const el = $('#cta');
    if (!DT.G || DT.G.pendingOffers) { el.innerHTML = ''; return; }
    const um = DT.S.userMatchNow();
    let label = 'Continuar';
    if (um) {
      const opp = DT.team(um.h === DT.G.user ? um.a : um.h);
      label = `Jugar vs ${opp.s}`;
    } else if (DT.G.week > DT.S.LAST_WEEK) label = 'Cerrar temporada';
    el.innerHTML = um
      ? `<div class="inner" style="display:flex;gap:8px"><button class="btn primary big" style="flex:1" data-a="advance">${label}</button><button class="btn big" style="background:var(--surface);box-shadow:none" data-a="quickMatch">Simular</button></div>`
      : `<div class="inner"><button class="btn primary block big" data-a="advance">${label}</button></div>`;
  };

  UI.render = function () {
    if (!DT.G) return;
    // despedido o retirado: pantalla propia, sin acceso al club
    if (DT.G.pendingOffers || DT.G.retired) { DT.Main.showCareerScreen(); return; }
    UI.renderTop();
    const main = $('#main');
    const scr = DT.Screens[UI.tab] || DT.Screens.home;
    main.innerHTML = scr();
    UI.renderCTA();
    UI.showNotices();
  };

  UI.A.quickMatch = () => {
    const um = DT.S.userMatchNow();
    if (um) DT.MatchUI.quick(um);
  };
  UI.A.tab = (d) => {
    UI.tab = d.tab;
    UI.sel = null;
    UI.render();
    window.scrollTo(0, 0);
  };
  UI.A.sub = (d) => {
    UI.sub[d.k] = d.v;
    UI.sel = null;
    UI.render();
  };

  // Delegación de eventos.
  UI.bind = function () {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-a]');
      if (!el) return;
      const fn = UI.A[el.dataset.a];
      if (fn) {
        e.preventDefault();
        fn(el.dataset, el, e);
      }
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-c]');
      if (!el) return;
      const fn = UI.A[el.dataset.c];
      if (fn) fn(el.dataset, el, e);
    });
    document.addEventListener('input', (e) => {
      const el = e.target.closest('[data-i]');
      if (!el) return;
      const fn = UI.A[el.dataset.i];
      if (fn) fn(el.dataset, el, e);
    });
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') UI.closeModal();
    });
  };

  // Gráfico de línea simple (evolución de caja).
  UI.lineChart = function (values, opts) {
    if (!values || values.length < 2) return '<div class="empty small">El gráfico aparece después de la primera semana.</div>';
    const W = 320, H = 120, pl = 44, pr = 8, pt = 10, pb = 18;
    let min = Math.min(0, ...values), max = Math.max(...values);
    if (max === min) max = min + 1;
    const x = (i) => pl + (i / (values.length - 1)) * (W - pl - pr);
    const y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const area = `${x(0)},${y(Math.max(min, 0))} ${pts} ${x(values.length - 1)},${y(Math.max(min, 0))}`;
    const ticks = [max, (max + min) / 2, min];
    const last = values[values.length - 1];
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${U.esc(opts && opts.label || 'Evolución')}">
      ${ticks.map((t) => `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${pl - 4}" y="${y(t) + 3}" text-anchor="end">${U.money(t, true)}</text>`).join('')}
      ${min < 0 ? `<line x1="${pl}" x2="${W - pr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--loss)" stroke-dasharray="3 3" stroke-width="1"/>` : ''}
      <polygon points="${area}" fill="var(--accent)" fill-opacity="0.12"/>
      <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${x(values.length - 1)}" cy="${y(last)}" r="3.5" fill="var(--accent)"/>
      <text x="${pl}" y="${H - 4}">Semana 0</text><text x="${W - pr}" y="${H - 4}" text-anchor="end">Ahora</text>
    </svg>`;
  };

  return UI;
})();
