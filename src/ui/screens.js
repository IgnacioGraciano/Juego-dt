// Pantallas: Inicio, Plantel y Torneos.
DT.Screens = (function () {
  const U = DT.U;
  const UI = DT.UI;
  const A = UI.A;
  const Sc = {};

  // ================= INICIO =================
  Sc.home = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const parts = [];
    const pending = G.inbox.filter((m) => m.actions && !m.done);
    if (pending.length) {
      parts.push(`<section class="card"><div class="row between"><h2>Decisiones pendientes</h2><span class="pill gold">${pending.length}</span></div>${pending.map(Sc.msg).join('')}</section>`);
    }
    parts.push(Sc.nextMatchCard());
    // Directiva
    const M = G.manager;
    const conf = Math.round(M.conf);
    parts.push(`<section class="card">
      <div class="row between"><span class="up">Directiva</span><span class="small ${conf < 30 ? '' : 'muted'}" style="${conf < 30 ? 'color:var(--loss);font-weight:700' : ''}">Confianza ${conf}/100</span></div>
      <div class="bar ${conf < 30 ? 'bad' : conf < 50 ? 'warn' : ''}"><i style="width:${conf}%"></i></div>
      <div class="small">${M.obj ? U.esc(M.obj.text) : ''}</div>
    </section>`);
    // Tabla resumida
    if (t.lg) {
      const comp = G.season.comps['L_' + t.lg];
      const order = DT.S.sortTable(comp.table, comp.teams);
      const me = order.indexOf(t.id);
      const show = new Set([0, 1, 2, me - 1, me, me + 1].filter((i) => i >= 0 && i < order.length));
      const rows = [...show].sort((a, b) => a - b).map((i) => {
        const id = order[i], r = comp.table[id], tm = G.teams[id];
        return `<tr class="${id === t.id ? 'me' : ''}"><td>${i + 1}</td><td class="team" data-a="team" data-id="${id}">${U.esc(tm.n)}</td><td>${r.pj}</td><td>${r.gf - r.gc > 0 ? '+' : ''}${r.gf - r.gc}</td><td><b>${r.pts}</b></td></tr>`;
      }).join('');
      parts.push(`<section class="card"><div class="row between"><h3>${U.esc(comp.name)}</h3><button class="btn sm" data-a="tab" data-tab="comp">Ver tabla</button></div><div class="tablewrap"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table></div></section>`);
    }
    // Últimos resultados
    const played = DT.S.userFixtures().filter((m) => m.p).slice(-5).reverse();
    if (played.length) {
      parts.push(`<section class="card"><h3>Últimos partidos</h3><div class="list">${played.map(Sc.fixtureRow).join('')}</div></section>`);
    }
    // Mensajes y noticias
    const msgs = G.inbox.filter((m) => !(m.actions && !m.done)).slice(0, 6);
    if (msgs.length) parts.push(`<section class="card"><h3>Mensajes</h3>${msgs.map(Sc.msg).join('')}</section>`);
    parts.push(`<section class="card"><h3>Noticias</h3><ul class="news">${G.news.slice(0, 10).map((n) => `<li><span class="tiny muted">S${n.w} · </span>${U.esc(n.t)}</li>`).join('') || '<li class="muted">Todavía no hay noticias.</li>'}</ul></section>`);
    return parts.join('');
  };

  Sc.msg = function (m) {
    const pending = m.actions && !m.done;
    m.seen = true;
    return `<div class="msg ${pending ? 'pending' : ''} ${m.kind === 'title' ? 'title' : ''}">
      <div class="row between"><b>${U.esc(m.title)}</b><span class="tiny muted">S${m.w} ${m.y}</span></div>
      <div class="small">${U.esc(m.body)}</div>
      ${pending ? `<div class="actions">${m.actions.map((a, i) => `<button class="btn sm ${i === 0 ? 'primary' : ''}" data-a="msgAct" data-id="${m.id}" data-i="${i}">${U.esc(a.label)}${a.sub ? `<span class="tiny" style="display:block;font-weight:500;opacity:.8">${U.esc(a.sub)}</span>` : ''}</button>`).join('')}</div>` : ''}
      ${m.result ? `<div class="tiny muted">${U.esc(m.result)}</div>` : ''}
    </div>`;
  };
  A.msgAct = (d) => {
    const res = DT.Act.resolve(+d.id, +d.i);
    UI.toast(res);
    DT.Main.autosave();
    UI.render();
  };

  Sc.nextMatchCard = function () {
    const G = DT.G;
    const next = DT.S.userFixtures().find((m) => !m.p);
    if (!next) {
      return `<section class="card"><span class="kicker">Temporada ${G.year}</span><div class="small">No te quedan partidos esta temporada. Tocá Continuar para avanzar hasta el cierre.</div></section>`;
    }
    const h = G.teams[next.h], a = G.teams[next.a];
    const now = next.w === G.week && next.s === G.slot;
    const when = now ? 'Hoy' : next.w === G.week ? 'Este fin de semana' : `Semana ${next.w}`;
    const comp = G.season.comps[next.c];
    const venue = next.n ? (comp.venue || 'Cancha neutral') : h.stad;
    return `<section class="card">
      <div class="row between"><span class="kicker">${U.esc(DT.S.matchLabel(next))}</span><span class="pill ${now ? 'gold' : ''}">${when}</span></div>
      <div class="matchup">
        <div class="t" data-a="team" data-id="${h.id}">${UI.badge(h, 'l')}<b>${U.esc(h.n)}</b><span class="tiny muted">Media ${DT.AI.rating(h)}</span><span>${UI.formChips(h.form)}</span></div>
        <div class="vs">vs</div>
        <div class="t" data-a="team" data-id="${a.id}">${UI.badge(a, 'l')}<b>${U.esc(a.n)}</b><span class="tiny muted">Media ${DT.AI.rating(a)}</span><span>${UI.formChips(a.form)}</span></div>
      </div>
      <div class="small muted" style="text-align:center">${U.esc(venue)}</div>
      ${(() => {
        if (next.w !== G.week) return '';
        const t = DT.userTeam();
        const list = (t.autoXI ? [] : DT.AI.lineupIssues(t)).concat(DT.AI.lineupWarnings(t));
        return list.length ? `<div class="msg pending small">${list.map(U.esc).join('<br>')}<div><button class="btn sm" data-a="tab" data-tab="squad">Revisar el once</button></div></div>` : '';
      })()}
      ${DT.isDerby(next.h, next.a) ? `<div style="text-align:center"><span class="pill gold">${U.esc(DT.isDerby(next.h, next.a))}</span></div>` : ''}
    </section>`;
  };

  Sc.fixtureRow = function (m) {
    const G = DT.G;
    const h = G.teams[m.h], a = G.teams[m.a];
    let res = '';
    if (m.p) {
      const mine = m.h === G.user ? m.hg : m.ag, theirs = m.h === G.user ? m.ag : m.hg;
      let r = mine > theirs ? 'G' : mine < theirs ? 'P' : 'E';
      if (m.pen) { const pm = m.h === G.user ? m.pen[0] : m.pen[1], pt = m.h === G.user ? m.pen[1] : m.pen[0]; r = pm > pt ? 'G' : 'P'; }
      res = `<span class="res ${r}">${r}</span>`;
    }
    return `<div class="li" data-a="matchInfo" data-id="${m.i}">
      ${res}<div class="name">${U.esc(h.s)} ${m.p ? `${m.hg}-${m.ag}${m.pen ? ` (${m.pen[0]}-${m.pen[1]} p)` : ''}` : 'vs'} ${U.esc(a.s)}<div class="sub ellipsis">${U.esc(DT.S.matchLabel(m))} · S${m.w}</div></div>
    </div>`;
  };

  A.matchInfo = (d) => {
    const G = DT.G;
    const m = G.season.matches[+d.id];
    if (!m) return;
    const h = G.teams[m.h], a = G.teams[m.a];
    const scorers = (m.sc || []).map(([side, pid, min]) => {
      const p = G.players[pid];
      return `<div class="small">${min}' ${p ? U.esc(p.n) : 'Jugador'} <span class="muted">(${U.esc(side === 0 ? h.s : a.s)})</span></div>`;
    }).join('');
    const mvp = m.mvp && G.players[m.mvp] ? `<div class="small">Figura: <b>${U.esc(G.players[m.mvp].n)}</b></div>` : '';
    UI.modal(`<span class="kicker">${U.esc(DT.S.matchLabel(m))}</span>
      <div class="matchup"><div class="t">${UI.badge(h, 'l')}<b>${U.esc(h.n)}</b></div><div class="score">${m.p ? `${m.hg}-${m.ag}` : 'vs'}</div><div class="t">${UI.badge(a, 'l')}<b>${U.esc(a.n)}</b></div></div>
      ${m.pen ? `<div class="small" style="text-align:center">Penales ${m.pen[0]}-${m.pen[1]}</div>` : ''}
      ${m.att ? `<div class="small muted" style="text-align:center">Público: ${U.num(m.att)}</div>` : ''}
      <div class="stack">${scorers || (m.p ? '<div class="small muted">Sin goles.</div>' : `<div class="small muted">Se juega en la semana ${m.w}.</div>`)}${mvp}</div>`);
  };

  // ================= PLANTEL =================
  Sc.squad = function () {
    const v = UI.sub.squad;
    const seg = `<div class="seg">${[['xi', 'Once'], ['tac', 'Táctica'], ['list', 'Plantel']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-a="sub" data-k="squad" data-v="${k}">${l}</button>`).join('')}</div>`;
    return seg + (v === 'xi' ? Sc.xi() : v === 'tac' ? Sc.tactics() : Sc.squadList());
  };

  const shortN = (p) => {
    const parts = p.n.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : p.n;
  };

  Sc.xi = function () {
    const G = DT.G;
    const t = DT.userTeam();
    if (!t.xi || t.xi.length !== 11) DT.AI.autoLineup(t);
    if (!t.bench) t.bench = DT.AI.pickBench(t, t.xi);
    const F = DT.FORMATIONS[t.tac.f];
    const issues = DT.AI.lineupIssues(t);
    const toks = t.xi.map((pid, i) => {
      const p = G.players[pid];
      const [x, y] = F.xy[i];
      if (!p) return `<button class="tok ${UI.sel && UI.sel.type === 'xi' && UI.sel.i === i ? 'sel' : ''}" style="left:${x}%;top:${y}%" data-a="pickXI" data-i="${i}"><span class="c">?</span><span class="n">Vacío</span></button>`;
      const bad = !DT.P.available(p) || DT.AI.posFactor(p.pos, F.l[i]) < 1;
      return `<button class="tok ${UI.sel && UI.sel.type === 'xi' && UI.sel.i === i ? 'sel' : ''} ${bad ? 'bad' : ''}" style="left:${x}%;top:${y}%;--c:${t.c1}" data-a="pickXI" data-i="${i}" aria-label="${U.esc(p.n)}">
        <span class="c">${p.ovr}</span><span class="n">${U.esc(shortN(p))}</span><span class="f"><i style="width:${Math.round(p.fit)}%;background:${p.fit < 60 ? '#ff9a8a' : p.fit < 78 ? '#f5c86a' : '#7be0a6'}"></i></span></button>`;
    }).join('');
    const inXI = new Set(t.xi);
    const bench = (t.bench || []).filter((id) => G.players[id] && !inXI.has(id));
    const reserves = t.squad.filter((id) => !inXI.has(id) && !bench.includes(id)).map((id) => G.players[id]).sort((a, b) => 'PDMA'.indexOf(a.pos) - 'PDMA'.indexOf(b.pos) || b.ovr - a.ovr);
    const row = (p, type) => `<div class="li ${UI.sel && UI.sel.pid === p.id ? 'sel' : ''}" data-a="pickRes" data-id="${p.id}" data-type="${type}">
      ${UI.pos(p)}<div class="name">${U.esc(p.n)}<div class="sub">${p.age} años ${UI.status(p)}</div></div>${UI.fitBar(p.fit)}<span class="ovr">${p.ovr}</span></div>`;
    const prev = DT.Match.preview(t);
    return `
      <section class="card">
        <div class="row between"><h2>${U.esc(t.tac.f)}</h2><span class="small muted">${DT.MENTALITY[t.tac.m]} · Presión ${DT.PRESSURE[t.tac.p].toLowerCase()}</span></div>
        <div class="grid3 small tab-nums" style="text-align:center"><div><span class="up">Ataque</span><br><b>${prev.att}</b></div><div><span class="up">Medio</span><br><b>${prev.mid}</b></div><div><span class="up">Defensa</span><br><b>${prev.def}</b></div></div>
        <label class="toggle small"><input type="checkbox" id="autoxi" data-c="autoXI" ${t.autoXI ? 'checked' : ''}> Elegir el once automáticamente antes de cada partido</label>
        ${issues.length ? `<div class="small" style="color:var(--loss)">${issues.map(U.esc).join(' ')}</div>` : ''}
        <div class="pitch"><div class="lines"></div><div class="box top"></div><div class="box bot"></div>${toks}</div>
        <div class="small muted">Tocá un jugador y después otro (en la cancha, el banco o los suplentes) para intercambiarlos. En rojo: lesionado, suspendido o fuera de su puesto.</div>
        <button class="btn block" data-a="autoXI">Armar el mejor once</button>
      </section>
      <section class="card"><h3>Banco de suplentes</h3><div class="list">${bench.map((id) => row(G.players[id], 'bench')).join('') || '<div class="empty small">Sin suplentes.</div>'}</div></section>
      <section class="card"><h3>Resto del plantel</h3><div class="list">${reserves.map((p) => row(p, 'res')).join('') || '<div class="empty small">No hay más jugadores.</div>'}</div></section>`;
  };

  function manualEdit(t) {
    t.autoXI = false;
  }
  A.autoXI = (d, el) => {
    const t = DT.userTeam();
    if (el && el.type === 'checkbox') {
      t.autoXI = el.checked;
      if (t.autoXI) DT.AI.autoLineup(t);
    } else {
      DT.AI.autoLineup(t);
      UI.toast('Once armado con los mejores disponibles.');
    }
    UI.sel = null;
    UI.render();
  };
  A.pickXI = (d) => {
    const t = DT.userTeam();
    const i = +d.i;
    const s = UI.sel;
    if (!s) { UI.sel = { type: 'xi', i }; UI.render(); return; }
    if (s.type === 'xi') {
      if (s.i !== i) { const x = t.xi[i]; t.xi[i] = t.xi[s.i]; t.xi[s.i] = x; manualEdit(t); }
    } else {
      const old = t.xi[i];
      t.xi[i] = s.pid;
      if (s.from === 'bench') t.bench = t.bench.map((b) => (b === s.pid ? old : b)).filter(Boolean);
      manualEdit(t);
    }
    UI.sel = null;
    UI.render();
  };
  A.pickRes = (d) => {
    const t = DT.userTeam();
    const pid = +d.id;
    const s = UI.sel;
    if (!s) { UI.sel = { type: 'res', pid, from: d.type }; UI.render(); return; }
    if (s.pid === pid) { UI.sel = null; DT.UI.A.player({ id: pid }); UI.render(); return; }
    if (s.type === 'xi') {
      const old = t.xi[s.i];
      t.xi[s.i] = pid;
      if (d.type === 'bench') t.bench = t.bench.map((b) => (b === pid ? old : b)).filter(Boolean);
      manualEdit(t);
    } else if (s.from !== d.type) {
      // banco <-> resto
      const benchPid = s.from === 'bench' ? s.pid : pid;
      const resPid = s.from === 'bench' ? pid : s.pid;
      t.bench = t.bench.map((b) => (b === benchPid ? resPid : b));
    }
    UI.sel = null;
    UI.render();
  };

  Sc.tactics = function () {
    const t = DT.userTeam();
    const prev = DT.Match.preview(t);
    const forms = Object.keys(DT.FORMATIONS);
    const MDESC = ['Todos atrás: muy difícil de vencer, casi no ataca.', 'Prioriza el orden defensivo y sale de contra.', 'Balance entre ataque y defensa.', 'Busca el arco rival con más gente, deja espacios.', 'Todo al ataque: muchas llegadas para ambos lados.'];
    const PDESC = ['Espera en su campo: menos desgaste y menos tarjetas.', 'Presión normal.', 'Presiona arriba: gana el medio, pero cansa más y suma tarjetas.'];
    return `
      <section class="card">
        <h3>Formación</h3>
        <div class="chips" style="flex-wrap:wrap">${forms.map((f) => `<button class="chip ${t.tac.f === f ? 'on' : ''}" data-a="setForm" data-f="${f}">${f}</button>`).join('')}</div>
        <div class="grid3 small tab-nums" style="text-align:center"><div><span class="up">Ataque</span><br><b style="font-size:1.3rem">${prev.att}</b></div><div><span class="up">Medio</span><br><b style="font-size:1.3rem">${prev.mid}</b></div><div><span class="up">Defensa</span><br><b style="font-size:1.3rem">${prev.def}</b></div></div>
      </section>
      <section class="card">
        <h3>Mentalidad</h3>
        <div class="seg">${DT.MENTALITY.map((m, i) => `<button class="${t.tac.m === i ? 'on' : ''}" data-a="setMent" data-v="${i}">${['M. def', 'Def', 'Equil', 'Of', 'M. of'][i]}</button>`).join('')}</div>
        <div class="small"><b>${DT.MENTALITY[t.tac.m]}.</b> ${MDESC[t.tac.m]}</div>
      </section>
      <section class="card">
        <h3>Presión</h3>
        <div class="seg">${DT.PRESSURE.map((m, i) => `<button class="${t.tac.p === i ? 'on' : ''}" data-a="setPress" data-v="${i}">${m}</button>`).join('')}</div>
        <div class="small">${PDESC[t.tac.p]}</div>
      </section>
      <section class="card flat small muted">Consejo: si jugás dos partidos por semana, rotá a los cansados (barra de físico baja). Un jugador fuera de su puesto rinde bastante menos.</section>`;
  };
  A.setForm = (d) => {
    const t = DT.userTeam();
    t.tac.f = d.f;
    // reacomodar el once a la nueva formación
    if (t.autoXI) DT.AI.autoLineup(t);
    else t.xi = DT.AI.pickXI(t);
    UI.render();
  };
  A.setMent = (d) => { DT.userTeam().tac.m = +d.v; UI.render(); };
  A.setPress = (d) => { DT.userTeam().tac.p = +d.v; UI.render(); };

  Sc.squadList = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const sort = UI.sub.squadSort || 'pos';
    const ps = t.squad.map((id) => G.players[id]);
    const sorters = {
      pos: (a, b) => 'PDMA'.indexOf(a.pos) - 'PDMA'.indexOf(b.pos) || b.ovr - a.ovr,
      ovr: (a, b) => b.ovr - a.ovr,
      age: (a, b) => a.age - b.age,
      val: (a, b) => DT.P.value(b) - DT.P.value(a),
      w: (a, b) => b.w - a.w,
      cy: (a, b) => a.cy - b.cy,
      g: (a, b) => b.st.g - a.st.g,
    };
    ps.sort(sorters[sort]);
    const payroll = DT.E.payroll(t), cap = DT.E.wageCap(t);
    return `
      <section class="card">
        <div class="kv"><div><span>Jugadores</span><b>${ps.length}</b></div><div><span>Edad prom.</span><b>${U.avg(ps, (p) => p.age).toFixed(1)}</b></div><div><span>Media</span><b>${DT.AI.rating(t)}</b></div></div>
        <div class="row between small"><span>Masa salarial: <b>${U.money(payroll)}</b>/año · tope ${U.money(cap)}</span><button class="btn sm" data-a="capRaise">Pedir más</button></div>
        <div class="bar ${payroll > cap ? 'bad' : payroll > cap * 0.9 ? 'warn' : ''}"><i style="width:${Math.min(100, (payroll / cap) * 100)}%"></i></div>
        <div class="chips">${[['pos', 'Puesto'], ['ovr', 'Media'], ['age', 'Edad'], ['val', 'Valor'], ['w', 'Sueldo'], ['cy', 'Contrato'], ['g', 'Goles']].map(([k, l]) => `<button class="chip ${sort === k ? 'on' : ''}" data-a="squadSort" data-v="${k}">${l}</button>`).join('')}</div>
      </section>
      <section class="card"><div class="list">${ps.map((p) => `<div class="li" data-a="player" data-id="${p.id}">
        ${UI.pos(p)}<div class="name">${U.esc(p.n)}<div class="sub">${p.age} años · ${U.money(p.w)}/año · ${p.cy} ${p.cy === 1 ? 'año' : 'años'} ${sort === 'g' ? `· ${p.st.g} goles` : ''} ${UI.status(p)}</div></div>
        <div class="stack" style="gap:3px;align-items:flex-end">${UI.stars(p.pot)}${UI.fitBar(p.fit)}</div><span class="ovr">${p.ovr}</span></div>`).join('')}</div></section>`;
  };
  A.squadSort = (d) => { UI.sub.squadSort = d.v; UI.render(); };

  // ================= TORNEOS =================
  Sc.comp = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const SS = G.season;
    if (!UI.compSel || !SS.comps[UI.compSel]) UI.compSel = t.lg ? 'L_' + t.lg : 'LIB';
    const cc = UI.compCountry || t.cc;
    const chips = [
      ['L_' + cc, 'Liga'],
      ['C_' + cc, 'Copa'],
      ['LIB', 'Libertadores'],
      ['SUD', 'Sudamericana'],
      ['OTH', 'Recopa e Intercontinental'],
      ['CAL', 'Mi calendario'],
    ];
    const head = `<div class="chips">${DT.COUNTRY_ORDER.map((c) => `<button class="chip ${cc === c ? 'on' : ''}" data-a="compCountry" data-cc="${c}">${DT.COUNTRIES[c].flag} ${c}</button>`).join('')}</div>
      <div class="chips">${chips.map(([id, l]) => `<button class="chip ${UI.compSel === id ? 'on' : ''}" data-a="compSel" data-id="${id}">${l}</button>`).join('')}</div>`;
    let body = '';
    const sel = UI.compSel;
    if (sel === 'CAL') body = Sc.calendar();
    else if (sel === 'OTH') body = Sc.otherComps();
    else {
      const comp = SS.comps[sel];
      if (!comp) body = '<div class="empty">Competencia no disponible.</div>';
      else if (comp.type === 'league') body = Sc.league(comp);
      else if (comp.type === 'cup') body = Sc.cup(comp);
      else if (comp.type === 'cont') body = Sc.continental(comp);
    }
    return head + body;
  };
  A.compCountry = (d) => {
    UI.compCountry = d.cc;
    if (UI.compSel && (UI.compSel.startsWith('L_') || UI.compSel.startsWith('C_'))) UI.compSel = UI.compSel.slice(0, 2) + d.cc;
    UI.round = null;
    UI.render();
  };
  A.compSel = (d) => { UI.compSel = d.id; UI.round = null; UI.render(); };

  Sc.league = function (comp) {
    const G = DT.G;
    const v = UI.sub.compView;
    const C = DT.COUNTRIES[comp.cc];
    const seg = `<div class="seg">${[['table', 'Tabla'], ['round', 'Fechas'], ['scorers', 'Goleadores']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-a="sub" data-k="compView" data-v="${k}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (v === 'table') {
      const order = DT.S.sortTable(comp.table, comp.teams);
      const n = order.length;
      const rows = order.map((id, i) => {
        const r = comp.table[id], tm = G.teams[id];
        const zone = i < C.lib ? 'lib' : i < C.lib + C.sud ? 'sud' : i >= n - C.rel ? 'rel' : '';
        return `<tr class="${DT.isUser(id) ? 'me' : ''}"><td class="zone ${zone}">${i + 1}</td><td class="team" data-a="team" data-id="${id}">${U.esc(tm.n)}</td><td>${r.pj}</td><td>${r.g}</td><td>${r.e}</td><td>${r.p}</td><td>${r.gf - r.gc > 0 ? '+' : ''}${r.gf - r.gc}</td><td><b>${r.pts}</b></td></tr>`;
      }).join('');
      body = `<section class="card"><h3>${U.esc(comp.name)} ${G.year}</h3><div class="tablewrap"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>DG</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="legend"><span><i style="background:var(--lib)"></i>Libertadores</span><span><i style="background:var(--sud)"></i>Sudamericana</span><span><i style="background:var(--rel)"></i>Descenso</span></div>
        <div class="tiny muted">El campeón de la ${U.esc(C.cup)} también clasifica a la Libertadores.</div></section>`;
    } else if (v === 'round') {
      const all = Object.values(G.season.matches).filter((m) => m.c === comp.id);
      const nextR = (all.filter((m) => !m.p).sort((a, b) => a.st - b.st)[0] || { st: comp.rounds }).st;
      const r = U.clamp(UI.round || nextR, 1, comp.rounds);
      const ms = all.filter((m) => m.st === r);
      body = `<section class="card">
        <div class="row between"><button class="btn sm" data-a="round" data-v="${r - 1}" ${r <= 1 ? 'disabled' : ''}>◀</button><h3>Fecha ${r} <span class="small muted">· semana ${ms[0] ? ms[0].w : ''}</span></h3><button class="btn sm" data-a="round" data-v="${r + 1}" ${r >= comp.rounds ? 'disabled' : ''}>▶</button></div>
        <div class="list">${ms.map(Sc.resultRow).join('')}</div></section>`;
    } else {
      const ps = Object.values(G.players).filter((p) => p.t && G.teams[p.t].lg === comp.cc && p.st.g > 0).sort((a, b) => b.st.g - a.st.g || a.st.pj - b.st.pj).slice(0, 20);
      body = `<section class="card"><h3>Goleadores</h3><div class="list">${ps.map((p, i) => `<div class="li" data-a="player" data-id="${p.id}"><span class="muted tab-nums" style="width:20px">${i + 1}</span>${UI.badge(G.teams[p.t], 's')}<div class="name">${U.esc(p.n)}<div class="sub">${U.esc(G.teams[p.t].n)} · ${p.st.pj} PJ · ${p.st.a} asist.</div></div><span class="ovr">${p.st.g}</span></div>`).join('') || '<div class="empty small">Todavía no hubo goles.</div>'}</div></section>`;
    }
    return seg + body;
  };
  A.round = (d) => { UI.round = +d.v; UI.render(); };

  Sc.resultRow = function (m) {
    const G = DT.G;
    const h = G.teams[m.h], a = G.teams[m.a];
    const me = DT.isUser(m.h) || DT.isUser(m.a);
    return `<div class="li" data-a="matchInfo" data-id="${m.i}" style="${me ? 'background:var(--accent-soft)' : ''}">
      <div class="name" style="text-align:right">${U.esc(h.n)}</div>${UI.badge(h, 's')}
      <b class="tab-nums" style="min-width:52px;text-align:center">${m.p ? `${m.hg} - ${m.ag}` : '–'}</b>
      ${UI.badge(a, 's')}<div class="name">${U.esc(a.n)}</div></div>`;
  };

  Sc.tieRow = function (tid) {
    const G = DT.G;
    const tie = G.season.ties[tid];
    const a = G.teams[tie.a], b = G.teams[tie.b];
    const legs = tie.legs.map((i) => G.season.matches[i]);
    let detail;
    if (tie.single) {
      const m = legs[0];
      detail = m.p ? `${G.teams[m.h].s} ${m.hg}-${m.ag} ${G.teams[m.a].s}${m.pen ? ` (pen. ${m.pen[0]}-${m.pen[1]})` : ''}` : `Semana ${m.w}`;
    } else {
      detail = legs.map((m, k) => (m.p ? `${k === 0 ? 'Ida' : 'Vuelta'} ${m.hg}-${m.ag}${m.pen ? ` (pen. ${m.pen[0]}-${m.pen[1]})` : ''}` : `${k === 0 ? 'Ida' : 'Vuelta'} S${m.w}`)).join(' · ');
    }
    const me = DT.isUser(tie.a) || DT.isUser(tie.b);
    const w = tie.winner;
    return `<div class="li" style="${me ? 'background:var(--accent-soft)' : ''}" data-a="matchInfo" data-id="${tie.legs[tie.legs.length - 1]}">
      <div class="name"><span style="${w && w !== tie.a ? 'opacity:.5' : ''}">${U.esc(a.n)}</span> <span class="muted">vs</span> <span style="${w && w !== tie.b ? 'opacity:.5' : ''}">${U.esc(b.n)}</span><div class="sub">${detail}</div></div>
      ${w ? `<span class="pill ok">${U.esc(G.teams[w].s)}</span>` : ''}</div>`;
  };

  Sc.cup = function (comp) {
    const G = DT.G;
    const ties = Object.values(G.season.ties).filter((t) => t.c === comp.id);
    const stages = [...new Set(ties.map((t) => t.stage))];
    const body = stages.reverse().map((st) => `<section class="card"><h3>${DT.S.cupStageName(comp, st)}</h3><div class="list">${ties.filter((t) => t.stage === st).map((t) => Sc.tieRow(t.id)).join('')}</div></section>`).join('');
    return `<section class="card"><div class="row between"><h3>${U.esc(comp.name)} ${G.year}</h3>${comp.champion ? `<span class="pill gold">Campeón: ${U.esc(G.teams[comp.champion].n)}</span>` : ''}</div><div class="small muted">Eliminación directa a un partido; empate se define por penales. ${comp.byes.length ? `Arrancan en la 2ª ronda: ${comp.byes.map((id) => G.teams[id].s).join(', ')}.` : ''}</div></section>${body}`;
  };

  Sc.continental = function (comp) {
    const G = DT.G;
    const v = UI.sub.contView || 'groups';
    const seg = `<div class="seg">${[['groups', 'Grupos'], ['ko', 'Eliminatorias']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-a="sub" data-k="contView" data-v="${k}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (v === 'groups') {
      body = comp.groups.map((g, gi) => {
        const order = DT.S.groupStandings(comp, gi);
        return `<section class="card"><h3>Grupo ${'ABCDEFGH'[gi]}</h3><div class="tablewrap"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>DG</th><th>Pts</th></tr></thead><tbody>${order.map((id, i) => {
          const r = comp.gtable[id];
          const zone = i < 2 ? 'lib' : i === 2 ? 'sud' : '';
          return `<tr class="${DT.isUser(id) ? 'me' : ''}"><td class="zone ${zone}">${i + 1}</td><td class="team" data-a="team" data-id="${id}">${DT.COUNTRIES[G.teams[id].cc].flag} ${U.esc(G.teams[id].n)}</td><td>${r.pj}</td><td>${r.gf - r.gc}</td><td><b>${r.pts}</b></td></tr>`;
        }).join('')}</tbody></table></div></section>`;
      }).join('');
      body = `<div class="legend"><span><i style="background:var(--lib)"></i>Octavos</span><span><i style="background:var(--sud)"></i>${comp.id === 'LIB' ? 'Pasa a playoffs de la Sudamericana' : 'Playoffs vs. terceros de la Libertadores'}</span></div>` + body;
    } else {
      const order = ['F', 'SF', 'QF', 'R16', 'PO'];
      body = order.filter((st) => comp.ko[st]).map((st) => `<section class="card"><h3>${DT.S.STAGE_NAMES[st]}${st === 'F' && comp.venue ? ` <span class="small muted">· ${U.esc(comp.venue)}</span>` : ''}</h3><div class="list">${comp.ko[st].map(Sc.tieRow).join('')}</div></section>`).join('') || '<div class="empty">Las eliminatorias empiezan después de la fase de grupos (semana 17).</div>';
    }
    const champ = comp.champion ? `<span class="pill gold">Campeón: ${U.esc(G.teams[comp.champion].n)}</span>` : '';
    return `<section class="card"><div class="row between"><h3>${U.esc(comp.name)} ${G.year}</h3>${champ}</div><div class="small muted">32 equipos en 8 grupos. Octavos, cuartos y semis a ida y vuelta; final única.</div></section>${seg}${body}`;
  };

  Sc.otherComps = function () {
    const G = DT.G;
    const SS = G.season;
    const parts = [];
    if (SS.comps.REC && SS.comps.REC.tie) parts.push(`<section class="card"><h3>Recopa Sudamericana</h3><div class="small muted">Campeón de la Libertadores vs. campeón de la Sudamericana del año anterior.</div><div class="list">${Sc.tieRow(SS.comps.REC.tie)}</div></section>`);
    else parts.push('<section class="card"><h3>Recopa Sudamericana</h3><div class="small muted">No se disputa este año.</div></section>');
    const it = SS.comps.INT;
    parts.push(`<section class="card"><h3>Copa Intercontinental</h3><div class="small muted">El campeón de la Libertadores enfrenta al campeón de Europa (${U.esc(G.teams[G.euroChamp].n)}) en la semana 45.</div>${it.tie ? `<div class="list">${Sc.tieRow(it.tie)}</div>` : ''}</section>`);
    return parts.join('');
  };

  Sc.calendar = function () {
    const fx = DT.S.userFixtures();
    return `<section class="card"><h3>Mis partidos ${DT.G.year}</h3><div class="list">${fx.map(Sc.fixtureRow).join('') || '<div class="empty">Sin partidos.</div>'}</div></section>`;
  };

  return Sc;
})();
