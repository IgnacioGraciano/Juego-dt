// Pantallas: Mercado, Club, fichas de jugador y equipo, negociaciones.
(function () {
  const U = DT.U;
  const UI = DT.UI;
  const A = UI.A;
  const Sc = DT.Screens;

  // ================= MERCADO =================
  Sc.market = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const v = UI.sub.market;
    const open = DT.S.windowOpen();
    const seg = `<div class="seg">${[['search', 'Buscar'], ['free', 'Libres'], ['mine', 'Mis ventas']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-a="sub" data-k="market" data-v="${k}">${l}</button>`).join('')}</div>`;
    const head = `<section class="card">
      <div class="row between"><span class="up">Libro de pases</span>${open ? '<span class="pill ok">Abierto</span>' : '<span class="pill">Cerrado</span>'}</div>
      <div class="small">${open ? 'Podés comprar y vender hasta la semana ' + (G.week <= 4 ? 4 : 26) + '.' : `Abre en la semana ${G.week < 21 ? 21 : 0 + ' de la próxima temporada'}. Los jugadores libres se pueden fichar siempre.`}</div>
      <div class="kv"><div><span>Presupuesto</span><b>${U.money(DT.M.budget(t))}</b></div><div><span>Sueldos/año</span><b>${U.money(DT.E.payroll(t))}</b></div><div><span>Tope sueldos</span><b>${U.money(DT.E.wageCap(t))}</b></div></div>
    </section>`;
    if (v === 'mine') return seg + head + Sc.mySales();
    const f = UI.filters;
    const free = v === 'free';
    let ps = Object.values(G.players).filter((p) => (free ? !p.t : p.t && p.t !== t.id && !G.teams[p.t].eur));
    if (f.pos) ps = ps.filter((p) => p.pos === f.pos);
    if (!free && f.cc) ps = ps.filter((p) => G.teams[p.t].cc === f.cc && DT.inLeague(G.teams[p.t]));
    if (f.age < 40) ps = ps.filter((p) => p.age <= f.age);
    if (f.minOvr) ps = ps.filter((p) => p.ovr >= f.minOvr);
    if (f.q) { const q = f.q.toLowerCase(); ps = ps.filter((p) => p.n.toLowerCase().includes(q)); }
    const withVal = ps.map((p) => ({ p, v: DT.P.value(p) }));
    let list = withVal;
    if (!free && f.max) list = list.filter((x) => x.v <= f.max);
    const sorters = { ovr: (a, b) => b.p.ovr - a.p.ovr, pot: (a, b) => b.p.pot - a.p.pot, val: (a, b) => a.v - b.v, age: (a, b) => a.p.age - b.p.age };
    list.sort(sorters[f.sort] || sorters.ovr);
    const total = list.length;
    list = list.slice(0, 60);
    const opt = (val, cur, label) => `<option value="${val}" ${String(cur) === String(val) ? 'selected' : ''}>${label}</option>`;
    const filters = `<section class="card">
      <div class="chips">${[['', 'Todos'], ['P', 'Arqueros'], ['D', 'Defensores'], ['M', 'Mediocampistas'], ['A', 'Delanteros']].map(([k, l]) => `<button class="chip ${f.pos === k ? 'on' : ''}" data-a="fPos" data-v="${k}">${l}</button>`).join('')}</div>
      <input type="text" id="fq" placeholder="Buscar por nombre" value="${U.esc(f.q)}" data-c="fQ">
      <div class="grid2">
        ${free ? '' : `<select id="fcc" data-c="fSel" data-k="cc" aria-label="Liga">${opt('', f.cc, 'Liga: todas')}${DT.COUNTRY_ORDER.map((c) => opt(c, f.cc, DT.COUNTRIES[c].name)).join('')}</select>`}
        ${free ? '' : `<select id="fmax" data-c="fSel" data-k="max" aria-label="Valor máximo">${[[0, 'Valor: todos'], [300000, 'Hasta $300 K'], [1e6, 'Hasta $1 M'], [3e6, 'Hasta $3 M'], [6e6, 'Hasta $6 M'], [12e6, 'Hasta $12 M'], [25e6, 'Hasta $25 M']].map(([a, b]) => opt(a, f.max, b)).join('')}</select>`}
        <select id="fage" data-c="fSel" data-k="age" aria-label="Edad máxima">${[[40, 'Edad: todas'], [21, 'Sub 21'], [23, 'Sub 23'], [27, 'Hasta 27'], [30, 'Hasta 30']].map(([a, b]) => opt(a, f.age, b)).join('')}</select>
        <select id="fmin" data-c="fSel" data-k="minOvr" aria-label="Media mínima">${[[0, 'Media: todas'], [60, 'Media 60+'], [65, 'Media 65+'], [70, 'Media 70+'], [75, 'Media 75+'], [80, 'Media 80+']].map(([a, b]) => opt(a, f.minOvr, b)).join('')}</select>
        <select id="fsort" data-c="fSel" data-k="sort" aria-label="Ordenar">${[['ovr', 'Orden: media'], ['pot', 'Orden: potencial'], ['val', 'Orden: precio'], ['age', 'Orden: edad']].map(([a, b]) => opt(a, f.sort, b)).join('')}</select>
      </div>
    </section>`;
    const rows = list.map(({ p, v: val }) => {
      const tm = p.t ? G.teams[p.t] : null;
      return `<div class="li" data-a="player" data-id="${p.id}">${UI.pos(p)}
        <div class="name">${U.esc(p.n)}<div class="sub ellipsis">${tm ? U.esc(tm.n) : 'Libre'} · ${p.age} años · ${free ? `pide ${U.money(DT.P.demand(p, t).w)}/año` : U.money(val)}</div></div>
        ${UI.potOf(p)}<span class="ovr">${p.ovr}</span></div>`;
    }).join('');
    return seg + head + filters + `<section class="card"><div class="small muted">${total} jugadores${total > 60 ? ' (se muestran los primeros 60)' : ''}</div><div class="list">${rows || '<div class="empty">No hay jugadores con esos filtros.</div>'}</div></section>`;
  };
  A.fPos = (d) => { UI.filters.pos = d.v; UI.render(); };
  A.fQ = (d, el) => { UI.filters.q = el.value.trim(); UI.render(); };
  A.fSel = (d, el) => { const k = d.k; UI.filters[k] = ['max', 'age', 'minOvr'].includes(k) ? +el.value : el.value; UI.render(); };

  Sc.mySales = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const listed = t.squad.map((id) => G.players[id]).filter((p) => p.lst);
    const old = G.inbox.filter((m) => m.kind === 'transfer' && m.actions && !m.done);
    const offers = DT.M.openOffers();
    const sellOns = Object.values(G.players).filter((p) => p.sellOn && p.sellOn.tid === t.id);
    return `<section class="card"><h3>Ofertas recibidas</h3>${offers.map(Sc.offerCard).join('')}${old.map(Sc.msg).join('')}${offers.length || old.length ? '' : '<div class="small muted">No hay ofertas. Poné jugadores en venta para atraer compradores; las ofertas llegan con el libro de pases abierto y vencen a las 2 semanas.</div>'}</section>
      <section class="card"><h3>Jugadores en venta</h3><div class="list">${listed.map((p) => `<div class="li" data-a="player" data-id="${p.id}">${UI.pos(p)}<div class="name">${U.esc(p.n)}<div class="sub">Valor ${U.money(DT.P.value(p))}</div></div><span class="ovr">${p.ovr}</span></div>`).join('') || '<div class="small muted">Ninguno. Abrí la ficha de un jugador y tocá "Poner en venta".</div>'}</div></section>
      <section class="card"><h3>Porcentajes de futura venta</h3><div class="list">${sellOns.map((p) => `<div class="li" data-a="player" data-id="${p.id}"><div class="name">${U.esc(p.n)}<div class="sub">${p.t ? `En ${U.esc(G.teams[p.t].n)}` : 'Libre'} · valor ${U.money(DT.P.value(p))}</div></div><span class="pill ok">${Math.round(p.sellOn.pct * 100)}%</span></div>`).join('') || '<div class="small muted">Cuando vendas con porcentaje de futura venta, acá ves a quién seguir: si lo vuelven a vender, cobrás tu parte.</div>'}</div></section>
      <section class="card"><h3>Cedidos a préstamo</h3><div class="list">${Object.values(G.players).filter((p) => p.loan && p.loan.from === t.id).map((p) => `<div class="li" data-a="player" data-id="${p.id}">${UI.pos(p)}<div class="name">${U.esc(p.n)}<div class="sub">En ${U.esc(G.teams[p.t].n)} · ${p.st.pj} PJ · ${p.st.g} goles</div></div><span class="ovr">${p.ovr}</span></div>`).join('') || '<div class="small muted">No tenés jugadores cedidos.</div>'}</div></section>
      <section class="card"><h3>Vendidos al exterior</h3><div class="list">${G.abroad.slice(0, 15).map((x) => `<div class="li"><div class="name">${U.esc(x.n)}<div class="sub">${U.esc(x.from || '')} → ${U.esc(x.club)} · ${x.y}</div></div><b class="tab-nums">${U.money(x.fee)}</b></div>`).join('') || '<div class="small muted">Todavía no hubo ventas al exterior.</div>'}</div></section>`;
  };
  const clauseTxt = (p) => { const c = DT.M.clause(p); return c ? ` · cláusula ${U.money(c)}` : ''; };
  Sc.offerCard = function (o) {
    const p = DT.G.players[o.pid];
    return `<div class="msg pending"><div class="row between"><b>${U.esc(o.name)} quiere a ${U.esc(p.n)}</b><span class="tiny muted">S${o.w}</span></div>
      <div class="small">${U.posName[p.pos]} · ${p.age} años · media ${p.ovr} · valor ${U.money(DT.P.value(p))}${clauseTxt(p)}</div>
      <div class="row between"><span class="small">Oferta actual</span><b class="tab-nums" style="font-size:1.1rem">${U.money(o.fee)}</b></div>
      ${o.t ? UI.tension(o.t) : ''}
      <div class="actions"><button class="btn sm primary" data-a="offAccept" data-id="${o.id}">Aceptar ${U.money(o.fee)}</button><button class="btn sm" data-a="offNeg" data-id="${o.id}">Negociar</button><button class="btn sm danger" data-a="offReject" data-id="${o.id}">Rechazar</button></div></div>`;
  };
  // Negociación de una oferta recibida
  const SNEG = {};
  A.offNeg = (d) => {
    const o = DT.M.getOffer(+d.id);
    if (!o || o.st !== 'open') { UI.toast('La oferta ya no está vigente.'); UI.render(); return; }
    const p = DT.G.players[o.pid];
    SNEG.oid = o.id;
    SNEG.ask = U.round(Math.max(o.fee * 1.15, DT.P.value(p)), stepFor(o.fee));
    SNEG.sellOn = false;
    SNEG.msg = '';
    renderSellNeg();
  };
  function renderSellNeg() {
    const o = DT.M.getOffer(SNEG.oid);
    const p = DT.G.players[o.pid];
    const open = o.st === 'open';
    UI.modal(`<span class="kicker">Negociación</span><h3>${U.esc(o.name)} por ${U.esc(p.n)}</h3>
      <div class="small muted">Valor de mercado ${U.money(DT.P.value(p))}. Si pedís más de lo que están dispuestos a pagar, sube la tensión, y cuanto más te pasás, más rápido sube. Si llega al máximo, se retiran.</div>
      <div class="row between"><span class="small">Su oferta</span><b class="tab-nums" style="font-size:1.25rem">${U.money(o.fee)}</b></div>
      ${UI.tension(o.t)}
      ${open ? `<span class="up">Tu pedido</span>
      <div class="stepper"><button class="btn" data-a="snegAsk" data-v="-1">−</button><div class="val">${U.money(SNEG.ask)}</div><button class="btn" data-a="snegAsk" data-v="1">+</button></div>
      <div class="row wrap">${[1.1, 1.25, 1.5].map((k) => `<button class="chip" data-a="snegSet" data-v="${k}">+${Math.round((k - 1) * 100)}% de su oferta</button>`).join('')}</div>
      ${o.buyer ? `<label class="toggle small"><input type="checkbox" data-c="snegSellOn" ${SNEG.sellOn ? 'checked' : ''}> Pedir 20% de una futura venta (pagan algo menos ahora)</label>` : ''}` : ''}
      ${SNEG.msg ? `<div class="msg pending small">${U.esc(SNEG.msg)}</div>` : ''}
      ${o.log.length > 1 ? `<div class="tiny muted">Antes: ${o.log.slice(1, 4).map(U.esc).join(' · ')}</div>` : ''}
      ${open ? `<button class="btn primary block" data-a="snegSend">Pedir ${U.money(SNEG.ask)}</button><button class="btn gold block" data-a="snegAccept">Aceptar ${U.money(o.fee)}${SNEG.sellOn && o.buyer ? ' + 20%' : ''}</button>` : '<button class="btn block" data-a="closeModal">Cerrar</button>'}`);
  }
  A.snegAsk = (d) => { SNEG.ask = Math.max(10000, SNEG.ask + (+d.v) * stepFor(SNEG.ask)); renderSellNeg(); };
  A.snegSet = (d) => { const o = DT.M.getOffer(SNEG.oid); SNEG.ask = U.round(o.fee * +d.v, stepFor(o.fee)); renderSellNeg(); };
  A.snegSellOn = (d, el) => { SNEG.sellOn = el.checked; renderSellNeg(); };
  A.snegSend = () => {
    const r = DT.M.offerCounter(SNEG.oid, SNEG.ask, SNEG.sellOn);
    SNEG.msg = r.msg;
    if (r.res === 'accept') {
      const a = DT.M.offerAccept(SNEG.oid, SNEG.sellOn);
      UI.closeModal();
      UI.toast(a.msg, 4000);
      if (a.ok) DT.Main.autosave();
      UI.render();
      return;
    }
    UI.render();
    renderSellNeg();
  };
  A.snegAccept = () => A.offAccept({ id: SNEG.oid, sellOn: SNEG.sellOn ? '1' : '' });
  A.offAccept = (d) => {
    const r = DT.M.offerAccept(+d.id, d.sellOn === '1');
    UI.closeModal();
    UI.toast(r.msg, 4000);
    if (r.ok) DT.Main.autosave();
    UI.render();
  };
  A.offReject = (d) => { DT.M.offerReject(+d.id); UI.closeModal(); UI.toast('Rechazaste la oferta.'); UI.render(); };

  // ================= FICHA DE JUGADOR =================
  A.player = (d) => {
    const G = DT.G;
    const p = G.players[+d.id];
    if (!p) return;
    const me = DT.userTeam();
    const mine = p.t === me.id;
    const tm = p.t ? G.teams[p.t] : null;
    const val = DT.P.value(p);
    const avg = DT.P.avgRating(p);
    let actions = '';
    const known = DT.M.known(p);
    const cl = DT.M.clause(p);
    if (p.acad && mine) {
      actions = `<div class="small muted">Juega en las inferiores. ${p.age >= DT.Acad.MAX_AGE ? '<b style="color:var(--warn)">Es su último año: si no lo subís, a fin de temporada se va libre.</b>' : `Puede quedarse hasta los ${DT.Acad.MAX_AGE} años.`}</div>
        <button class="btn primary block" data-a="acadPromote" data-id="${p.id}">Subir al primer equipo</button>
        <button class="btn danger block" data-a="acadRelease" data-id="${p.id}">Dejarlo libre</button>`;
    } else if (mine && p.loan) {
      actions = `<div class="small muted">Está a préstamo desde ${U.esc(G.teams[p.loan.from] ? G.teams[p.loan.from].n : 'otro club')} y vuelve a fin de temporada.</div><button class="btn block" data-a="editName" data-id="${p.id}">Editar nombre</button>`;
    } else if (mine) {
      actions = `<div class="grid2">
        <button class="btn" data-a="renewOpen" data-id="${p.id}">Renovar contrato</button>
        <button class="btn" data-a="toggleList" data-id="${p.id}">${p.lst ? 'Quitar de venta' : 'Poner en venta'}</button>
        <button class="btn" data-a="loanOutOpen" data-id="${p.id}">Ceder a préstamo</button>
        <button class="btn" data-a="editName" data-id="${p.id}">Editar nombre</button>
        <button class="btn danger" data-a="releaseOpen" data-id="${p.id}">Rescindir</button>
      </div>`;
    } else if (tm && !tm.eur) {
      actions = `<button class="btn primary block" data-a="buyOpen" data-id="${p.id}">Hacer una oferta</button>
        ${cl ? `<button class="btn gold block" data-a="payClause" data-id="${p.id}">Pagar la cláusula (${U.money(cl)})</button>` : ''}
        <div class="grid2">
          <button class="btn" data-a="loanInOpen" data-id="${p.id}">Pedir a préstamo</button>
          <button class="btn" data-a="compare" data-id="${p.id}">Comparar</button>
          ${known ? '' : `<button class="btn" data-a="scout" data-id="${p.id}">Enviar ojeador (${U.money(DT.M.scoutCost(me))})</button>`}
          <button class="btn" data-a="editName" data-id="${p.id}">Editar nombre</button>
        </div>`;
    } else if (!tm) {
      actions = `<button class="btn primary block" data-a="contractOpen" data-id="${p.id}" data-fee="0">Ofrecer contrato (libre)</button><button class="btn block" data-a="compare" data-id="${p.id}">Comparar con mi plantel</button>`;
    }
    UI.modal(`
      <div class="row">${tm ? UI.badge(tm, 'l') : ''}<div class="grow"><h2>${U.esc(p.n)}</h2><div class="small muted">${U.posLong[p.pos]} · ${p.age} años · ${tm ? `<span data-a="team" data-id="${tm.id}" style="text-decoration:underline">${U.esc(tm.n)}</span>` : 'Jugador libre'}</div></div><div class="score" style="font-size:2.4rem">${p.ovr}</div></div>
      <div class="row wrap">${UI.status(p)} ${UI.morale(p.mor)} ${p.yt ? '<span class="pill">Cantera</span>' : ''}</div>
      <div class="kv">
        <div><span>Potencial</span><b>${UI.potOf(p)}</b></div>
        <div><span>Valor</span><b>${U.money(val)}</b></div>
        <div><span>Sueldo/año</span><b>${U.money(p.w)}</b></div>
        <div><span>Contrato</span><b>${p.acad ? 'Inferiores' : p.t ? `${p.cy} ${p.cy === 1 ? 'año' : 'años'}` : '—'}</b></div>
        <div><span>Cláusula</span><b>${p.acad || !p.t ? '—' : cl ? U.money(cl) : 'No tiene'}</b></div>
        <div><span>Físico</span><b>${Math.round(p.fit)}%</b></div>
        <div><span>Moral</span><b>${Math.round(p.mor)}</b></div>
      </div>
      <h3>Temporada ${G.year}</h3>
      <div class="kv"><div><span>Partidos</span><b>${p.st.pj}</b></div><div><span>Goles</span><b>${p.st.g}</b></div><div><span>Asist.</span><b>${p.st.a}</b></div><div><span>Promedio</span><b>${avg ? avg.toFixed(2) : '—'}</b></div><div><span>Carrera PJ</span><b>${p.car.pj}</b></div><div><span>Carrera goles</span><b>${p.car.g}</b></div></div>
      ${p.fm.length ? `<div class="small">Últimas notas: ${p.fm.map((r) => `<b>${r.toFixed(1)}</b>`).join(' · ')}</div>` : ''}
      ${mine && p.cy <= 1 ? '<div class="small" style="color:var(--warn)">Termina contrato a fin de año: si no renueva, se va libre.</div>' : ''}
      ${actions}`);
  };

  A.team = (d) => {
    const G = DT.G;
    const t = G.teams[d.id];
    if (!t) return;
    const ps = t.squad.map((id) => G.players[id]).sort(UI.byPos);
    const titles = (t.titles || []).slice(-8).reverse();
    UI.modal(`
      <div class="row">${UI.badge(t, 'xl')}<div class="grow"><h2>${U.esc(t.n)}</h2><div class="small muted">${t.eur ? 'Europa' : `${DT.COUNTRIES[t.cc].flag} ${U.esc(DT.COUNTRIES[t.cc].name)} · ${U.esc(DT.divName(t))}`}</div></div></div>
      ${t.eur ? '' : `<div class="kv"><div><span>Media</span><b>${DT.AI.rating(t)}</b></div><div><span>Reputación</span><b>${Math.round(t.rep)}</b></div><div><span>Socios</span><b>${U.num(t.socios)}</b></div><div><span>Estadio</span><b class="ellipsis" style="font-size:.95rem">${U.esc(t.stad)}</b></div><div><span>Capacidad</span><b>${U.num(t.cap)}</b></div><div><span>Formación</span><b>${t.tac.f}</b></div></div>`}
      ${titles.length ? `<div class="small">Títulos recientes: ${titles.map((x) => `${U.esc(x.c)} ${x.y}`).join(' · ')}</div>` : ''}
      <div class="list">${UI.grouped(ps, (p) => `<div class="li" data-a="player" data-id="${p.id}">${UI.pos(p)}<div class="name">${U.esc(p.n)}<div class="sub">${p.age} años · ${U.money(DT.P.value(p))}</div></div>${UI.potOf(p)}<span class="ovr">${p.ovr}</span></div>`)}</div>`);
  };

  A.payClause = (d) => {
    const p = DT.G.players[+d.id];
    const me = DT.userTeam();
    if (!p || !p.t || p.t === me.id) return;
    const cl = DT.M.clause(p);
    if (!DT.S.windowOpen()) { UI.toast('El libro de pases está cerrado. Abre en las semanas 0–4 y 21–26.'); return; }
    if (cl > DT.M.budget(me)) { UI.toast(`No te alcanza: la directiva autoriza hasta ${U.money(DT.M.budget(me))}.`); return; }
    contractStep(p.id, cl, `Vas a pagar la cláusula de ${U.money(cl)}: ${DT.team(p.t).n} no se puede negar. Ahora convencé al jugador.`, true);
  };
  A.acadPromote = (d) => {
    const r = DT.Acad.promote(+d.id);
    UI.closeModal();
    UI.toast(r.msg);
    DT.Main.autosave();
    UI.render();
  };
  A.acadRelease = (d) => {
    const p = DT.G.players[+d.id];
    UI.modal(`<h3>¿Dejar libre a ${U.esc(p.n)}?</h3><div class="small">Se va de las inferiores y su lugar queda libre hasta la próxima camada.</div><button class="btn danger block" data-a="acadReleaseDo" data-id="${p.id}">Sí, dejarlo libre</button>`);
  };
  A.acadReleaseDo = (d) => { DT.Acad.release(+d.id); UI.closeModal(); UI.render(); };

  A.scout = (d) => {
    const r = DT.M.scout(+d.id);
    if (!r.ok) { UI.toast(r.msg); return; }
    A.player(d);
    UI.toast(r.msg, 5200);
  };

  A.compare = (d) => {
    const G = DT.G;
    const p = G.players[+d.id];
    const me = DT.userTeam();
    const mine = me.squad.map((id) => G.players[id]).filter((x) => x.pos === p.pos).sort((a, b) => b.ovr - a.ovr).slice(0, 2);
    const cols = [p].concat(mine);
    const row = (label, f, best) => {
      const vals = cols.map(f);
      const nums = vals.map((v) => (typeof v === 'number' ? v : null));
      const bi = best ? nums.indexOf(best === 'max' ? Math.max(...nums.filter((x) => x !== null)) : Math.min(...nums.filter((x) => x !== null))) : -1;
      return `<tr><td style="text-align:left" class="muted">${label}</td>${vals.map((v, i) => `<td style="${i === bi ? 'color:var(--win);font-weight:700' : ''}">${typeof v === 'number' && label !== 'Edad' && label !== 'Media' && label !== 'Partidos' && label !== 'Goles' && label !== 'Contrato' ? (label === 'Promedio' ? (v ? v.toFixed(2) : '—') : U.money(v)) : v}</td>`).join('')}</tr>`;
    };
    UI.modal(`<h3>Comparar ${U.esc(U.posLong[p.pos].toLowerCase())}s</h3>
      <div class="tablewrap"><table><thead><tr><th></th>${cols.map((c, i) => `<th style="text-align:right;${i === 0 ? 'color:var(--accent)' : ''}">${U.esc(c.n.split(' ').slice(-1)[0])}</th>`).join('')}</tr></thead><tbody>
        ${row('Media', (c) => c.ovr, 'max')}
        ${row('Edad', (c) => c.age)}
        <tr><td style="text-align:left" class="muted">Potencial</td>${cols.map((c) => `<td>${UI.potOf(c)}</td>`).join('')}</tr>
        ${row('Valor', (c) => DT.P.value(c))}
        ${row('Sueldo', (c) => c.w, 'min')}
        ${row('Contrato', (c) => (c.t ? c.cy : 0))}
        ${row('Partidos', (c) => c.st.pj, 'max')}
        ${row('Goles', (c) => c.st.g, 'max')}
        ${row('Promedio', (c) => DT.P.avgRating(c), 'max')}
      </tbody></table></div>
      <div class="small muted">La primera columna es el jugador que estás mirando; las otras, tus mejores ${U.esc(U.posLong[p.pos].toLowerCase())}s.</div>
      <button class="btn block" data-a="player" data-id="${p.id}">Volver a la ficha</button>`);
  };

  A.loanOutOpen = (d) => {
    const G = DT.G;
    const p = G.players[+d.id];
    if (!DT.S.windowOpen()) { UI.toast('Las cesiones se hacen con el libro de pases abierto (semanas 0–4 y 21–26).'); return; }
    const offs = DT.M.loanOutOffers(p.id);
    UI.modal(`<h3>Ceder a ${U.esc(p.n)}</h3><div class="small muted">Se va hasta fin de temporada, el otro club le paga el sueldo y vuelve con más minutos encima.</div>
      <div class="list">${offs.map((o) => `<div class="li" data-a="loanOutDo" data-id="${p.id}" data-tid="${o.tid}" data-fee="${o.fee}">${UI.badge(G.teams[o.tid])}<div class="name">${U.esc(G.teams[o.tid].n)}<div class="sub">${o.starter ? 'Sería titular' : 'Pelearía el puesto'} · ${o.fee ? `paga ${U.money(o.fee)}` : 'sin cargo'}</div></div><span class="btn sm primary">Ceder</span></div>`).join('') || '<div class="empty small">Ningún club lo pidió por ahora.</div>'}</div>
      <button class="btn block" data-a="player" data-id="${p.id}">Volver</button>`);
  };
  A.loanOutDo = (d) => {
    const r = DT.M.loanOut(+d.id, d.tid, +d.fee);
    UI.closeModal();
    UI.toast(r.msg, 4000);
    if (r.ok) DT.Main.autosave();
    UI.render();
  };
  A.loanInOpen = (d) => {
    const G = DT.G;
    const p = G.players[+d.id];
    if (!DT.S.windowOpen()) { UI.toast('Los préstamos se piden con el libro de pases abierto (semanas 0–4 y 21–26).'); return; }
    UI.modal(`<h3>Pedir a préstamo a ${U.esc(p.n)}</h3>
      <div class="small">Viene hasta fin de temporada. Costo del préstamo: <b>${U.money(DT.M.loanInFee(p))}</b> y te hacés cargo de su sueldo (${U.money(p.w)}/año). Los clubes no suelen ceder a sus titulares, salvo juveniles.</div>
      <button class="btn primary block" data-a="loanInDo" data-id="${p.id}">Pedirlo</button><button class="btn block" data-a="player" data-id="${p.id}">Volver</button>`);
  };
  A.loanInDo = (d) => {
    const r = DT.M.loanIn(+d.id);
    UI.closeModal();
    UI.toast(r.msg, 4000);
    if (r.ok) DT.Main.autosave();
    UI.render();
  };
  A.capRaise = () => {
    const r = DT.Board.askCapRaise();
    UI.toast(r.msg, 4500);
    if (NEG.pid && document.querySelector('#modal:not([hidden]) [data-a="negContract"]')) { NEG.msg = r.msg; renderContract(); }
    else UI.render();
  };

  A.toggleList = (d) => {
    const p = DT.G.players[+d.id];
    p.lst = !p.lst;
    UI.toast(p.lst ? `${p.n} está en venta. Las ofertas llegan con el mercado abierto.` : `${p.n} ya no está en venta.`);
    A.player(d);
    UI.render();
  };

  A.editName = (d) => {
    const p = DT.G.players[+d.id];
    UI.modal(`<h3>Editar nombre</h3><div class="small muted">Corregí o actualizá el nombre del jugador.</div><input type="text" id="newname" value="${U.esc(p.n)}" maxlength="40"><button class="btn primary block" data-a="saveName" data-id="${p.id}">Guardar</button>`);
  };
  A.saveName = (d) => {
    const p = DT.G.players[+d.id];
    const v = (document.getElementById('newname').value || '').trim();
    if (v) p.n = v;
    A.player(d);
    UI.render();
  };

  A.releaseOpen = (d) => {
    const p = DT.G.players[+d.id];
    const cost = DT.M.releaseCost(p);
    UI.modal(`<h3>Rescindir a ${U.esc(p.n)}</h3><div class="small">Hay que pagarle la mitad de lo que le queda de contrato: <b>${U.money(cost)}</b>. Queda libre y puede firmar con otro club.</div><button class="btn danger block" data-a="releaseDo" data-id="${p.id}">Confirmar rescisión</button><button class="btn block" data-a="player" data-id="${p.id}">Volver</button>`);
  };
  A.releaseDo = (d) => {
    const me = DT.userTeam();
    if (me.squad.length <= 16) { UI.toast('No podés quedarte con menos de 16 jugadores.'); return; }
    DT.M.releaseUser(+d.id);
    UI.closeModal();
    UI.toast('Contrato rescindido.');
    UI.render();
  };

  // ---------- negociaciones ----------
  const NEG = {};
  function stepFor(v) {
    if (v >= 1e7) return 500000;
    if (v >= 2e6) return 100000;
    if (v >= 5e5) return 25000;
    if (v >= 1e5) return 10000;
    return 2000;
  }
  A.buyOpen = (d) => {
    const G = DT.G;
    const p = G.players[+d.id];
    if (!DT.S.windowOpen()) { UI.toast('El libro de pases está cerrado. Abre en las semanas 0–4 y 21–26.'); return; }
    NEG.pid = p.id;
    NEG.fee = U.round(DT.P.value(p), stepFor(DT.P.value(p)));
    NEG.msg = '';
    NEG.counter = null; // la contraoferta es de otra negociación
    renderBuy();
  };
  function renderBuy() {
    const G = DT.G;
    const p = G.players[NEG.pid];
    const tm = G.teams[p.t];
    const imp = DT.M.importance(p);
    const hint = imp >= 1.5 ? 'Es una de las figuras del equipo: van a pedir bastante más que su valor.' : imp >= 1.25 ? 'Es titular: pedirán algo más que su valor.' : 'No es titular: podrían aceptar cerca de su valor.';
    UI.modal(`<h3>Oferta por ${U.esc(p.n)}</h3>
      <div class="small muted">${U.esc(tm.n)} · media ${p.ovr} · ${p.age} años · contrato ${p.cy} ${p.cy === 1 ? 'año' : 'años'}</div>
      <div class="small">Valor de mercado: <b>${U.money(DT.P.value(p))}</b>. ${hint}${p.cy <= 1 ? ' Le queda poco contrato: puede salir más barato.' : ''}</div>
      <div class="stepper"><button class="btn" data-a="negFee" data-v="-1">−</button><div class="val">${U.money(NEG.fee)}</div><button class="btn" data-a="negFee" data-v="1">+</button></div>
      <div class="row wrap">${[0.8, 1, 1.2, 1.5].map((k) => `<button class="chip" data-a="negFeeSet" data-v="${k}">${k === 1 ? 'Valor' : (k > 1 ? '+' : '') + Math.round((k - 1) * 100) + '%'}</button>`).join('')}</div>
      <div class="small muted">Presupuesto disponible: ${U.money(DT.M.budget(DT.userTeam()))}</div>
      ${UI.tension(DT.M.buyTension(p.id).v)}
      ${NEG.msg ? `<div class="msg pending small">${U.esc(NEG.msg)}</div>` : ''}
      ${NEG.counter ? `<button class="btn gold block" data-a="negAcceptCounter">Aceptar ${U.money(NEG.counter)}</button>` : ''}
      <button class="btn primary block" data-a="negSend">Enviar oferta</button>`);
  }
  A.negFee = (d) => { NEG.fee = Math.max(0, NEG.fee + (+d.v) * stepFor(NEG.fee)); renderBuy(); };
  A.negFeeSet = (d) => { const p = DT.G.players[NEG.pid]; NEG.fee = U.round(DT.P.value(p) * +d.v, stepFor(DT.P.value(p))); renderBuy(); };
  A.negSend = () => {
    const r = DT.M.offer(NEG.pid, NEG.fee);
    NEG.counter = null;
    if (r.res === 'accept') { contractStep(NEG.pid, r.fee, `${DT.team(DT.G.players[NEG.pid].t).n} aceptó ${U.money(r.fee)}. Ahora negociá con el jugador.`); return; }
    if (r.res === 'counter') NEG.counter = r.fee;
    NEG.msg = r.msg || '';
    renderBuy();
  };
  A.negAcceptCounter = () => {
    const me = DT.userTeam();
    if (NEG.counter > DT.M.budget(me)) { NEG.msg = 'No tenés presupuesto para esa cifra.'; renderBuy(); return; }
    contractStep(NEG.pid, NEG.counter, 'Acuerdo entre clubes. Ahora negociá con el jugador.');
  };

  function contractStep(pid, fee, msg, byClause) {
    const p = DT.G.players[pid];
    const d = DT.P.demand(p, DT.userTeam());
    NEG.clause = 'mid';
    NEG.byClause = !!byClause;
    NEG.pid = pid;
    NEG.fee = fee;
    NEG.wage = U.round(d.w * 0.9, 1000);
    NEG.years = d.years;
    NEG.msg = msg || '';
    NEG.mode = 'sign';
    NEG.counter = null;
    renderContract();
  }
  A.contractOpen = (d) => contractStep(+d.id, +d.fee || 0, 'Jugador libre: no hay que pagar transferencia.');
  A.renewOpen = (d) => {
    const p = DT.G.players[+d.id];
    const dm = DT.M.renewDemand(p);
    NEG.pid = p.id; NEG.fee = 0; NEG.wage = U.round(dm.cut ? dm.w * 0.95 : Math.max(p.w, dm.w * 0.92), 1000); NEG.years = dm.years; NEG.mode = 'renew'; NEG.clause = 'mid';
    NEG.msg = p.mor < 30 ? `${p.n} está disconforme y difícilmente quiera renovar.` : '';
    renderContract();
  };
  function renderContract() {
    const p = DT.G.players[NEG.pid];
    const me = DT.userTeam();
    const payroll = DT.E.payroll(me) - (p.t === me.id ? p.w : 0);
    UI.modal(`<h3>${NEG.mode === 'renew' ? 'Renovación' : 'Contrato'}: ${U.esc(p.n)}</h3>
      ${NEG.fee ? `<div class="small">Transferencia acordada: <b>${U.money(NEG.fee)}</b></div>` : ''}
      <div class="small muted">Sueldo actual: ${U.money(p.w)}/año. Masa salarial con este contrato: ${U.money(payroll + NEG.wage)} (tope ${U.money(DT.E.wageCap(me))}).</div>
      <span class="up">Sueldo anual</span>
      <div class="stepper"><button class="btn" data-a="negWage" data-v="-1">−</button><div class="val">${U.money(NEG.wage)}</div><button class="btn" data-a="negWage" data-v="1">+</button></div>
      <span class="up">Años de contrato</span>
      <div class="seg">${[1, 2, 3, 4, 5].map((y) => `<button class="${NEG.years === y ? 'on' : ''}" data-a="negYears" data-v="${y}">${y}</button>`).join('')}</div>
      <span class="up">Cláusula de rescisión</span>
      <div class="seg">${DT.M.CLAUSES.map((c) => `<button class="${NEG.clause === c.k ? 'on' : ''}" data-a="negClause" data-v="${c.k}">${c.label}</button>`).join('')}</div>
      <div class="tiny muted">${NEG.clause === 'none' ? 'Sin cláusula nadie se lo puede llevar sin tu permiso, pero el jugador pide más sueldo.' : `Cualquier club puede pagar ${U.money(DT.M.clauseAmount(p, NEG.clause))} y llevárselo. Más baja = el jugador acepta cobrar menos.`}</div>
      ${NEG.msg ? `<div class="msg pending small">${U.esc(NEG.msg)}</div>` : ''}
      ${payroll + NEG.wage > DT.E.wageCap(me) ? `<button class="btn block" data-a="capRaise">Pedirle a la directiva más tope salarial</button>` : ''}
      <button class="btn primary block" data-a="negContract">Ofrecer contrato</button>`);
  }
  A.negWage = (d) => { NEG.wage = Math.max(12000, NEG.wage + (+d.v) * stepFor(NEG.wage) / 2); renderContract(); };
  A.negYears = (d) => { NEG.years = +d.v; renderContract(); };
  A.negClause = (d) => { NEG.clause = d.v; renderContract(); };
  A.negContract = () => {
    const p = DT.G.players[NEG.pid];
    if (NEG.mode === 'renew') {
      const r = DT.M.renew(NEG.pid, NEG.wage, NEG.years, NEG.clause);
      if (r.res === 'accept') { UI.closeModal(); UI.toast(`${p.n} renovó por ${NEG.years} ${NEG.years === 1 ? 'año' : 'años'}.`); DT.Main.autosave(); UI.render(); return; }
      NEG.msg = r.msg;
      renderContract();
      return;
    }
    const me = DT.userTeam();
    if (me.squad.length >= 34) { NEG.msg = 'El plantel está lleno (34 jugadores). Vendé o rescindí antes.'; renderContract(); return; }
    if (NEG.fee && NEG.fee > DT.M.budget(me)) { NEG.msg = 'Ya no tenés presupuesto para pagar la transferencia.'; renderContract(); return; }
    const r = DT.M.contractTalk(NEG.pid, NEG.wage, NEG.years, NEG.clause);
    if (r.res === 'accept') {
      DT.M.completeSigning(NEG.pid, NEG.fee, NEG.wage, NEG.years, NEG.clause, NEG.byClause);
      UI.closeModal();
      UI.toast(`¡${p.n} es nuevo jugador del club!`);
      DT.Main.autosave();
      UI.render();
      return;
    }
    NEG.msg = r.msg;
    renderContract();
  };

  // ================= CLUB =================
  Sc.club = function () {
    const v = UI.sub.club;
    const seg = `<div class="seg five">${[['fin', 'Finanzas'], ['stad', 'Estadio'], ['board', 'Directiva'], ['hist', 'Historial'], ['game', 'Partida']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-a="sub" data-k="club" data-v="${k}">${l}</button>`).join('')}</div>`;
    const f = { fin: Sc.finance, stad: Sc.stadium, board: Sc.board, hist: Sc.history, game: Sc.gameOpts }[v] || Sc.finance;
    return seg + f();
  };

  Sc.finance = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const L = t.fin.cur;
    const tot = DT.E.totals(t);
    const res = tot.inc - tot.exp;
    const maxCat = Math.max(1, ...Object.values(L.inc), ...Object.values(L.exp));
    const bars = (obj, color) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="stack" style="gap:3px"><div class="row between small"><span>${U.esc(k)}</span><b class="tab-nums">${U.money(v)}</b></div><div class="bar"><i style="width:${(v / maxCat) * 100}%;background:${color}"></i></div></div>`).join('') || '<div class="small muted">Sin movimientos todavía.</div>';
    const rev = DT.E.estimateRevenue(t);
    const lastHome = DT.S.userFixtures().filter((m) => m.p && m.h === t.id && m.att).slice(-1)[0];
    const loans = t.loans.map((l, i) => `<div class="li"><div class="name">Préstamo de ${U.money(l.amt)}<div class="sub">Cuota ${U.money(l.pay)}/semana · faltan ${l.left} semanas · cancelar hoy: ${U.money(DT.E.loanRemaining(l))}</div></div><button class="btn sm" data-a="repay" data-i="${i}">Cancelar</button></div>`).join('');
    const opts = DT.E.loanOptions(t).map((o, i) => `<button class="btn block" data-a="loan" data-i="${i}" ${DT.E.canBorrow(t, o) ? '' : 'disabled'}>${U.money(o.amt)} · ${Math.round(o.rate * 100)}% anual · ${Math.round(o.weeks / 46)} ${o.weeks > 46 ? 'temporadas' : 'temporada'}<span class="tiny" style="display:block;font-weight:500">Cuota ${U.money(o.pay)}/semana · total a devolver ${U.money(o.total)}</span></button>`).join('');
    const hist = t.fin.hist.slice().reverse();
    return `
      <section class="card">
        <div class="kv"><div><span>Caja</span><b style="color:${t.cash < 0 ? 'var(--loss)' : 'inherit'}">${U.money(t.cash)}</b></div><div><span>Para fichajes</span><b>${U.money(DT.M.budget(t))}</b></div><div><span>Deuda</span><b>${U.money(DT.E.debt(t))}</b></div></div>
        <div class="small muted">Ingresos estimados por temporada: ${U.money(rev)}. La directiva reserva 4 semanas de sueldos y no permite compras si la caja es negativa.</div>
        <div class="row between small"><span>Sueldos <b>${U.money(DT.E.payroll(t))}</b>/año</span><span>Tope <b>${U.money(DT.E.wageCap(t))}</b></span></div>
        <div class="bar ${DT.E.payroll(t) > DT.E.wageCap(t) ? 'bad' : DT.E.payroll(t) > DT.E.wageCap(t) * 0.92 ? 'warn' : ''}"><i style="width:${Math.min(100, (DT.E.payroll(t) / DT.E.wageCap(t)) * 100)}%"></i></div>
        <button class="btn block" data-a="capRaise" ${(t.capAsks || 0) >= 2 ? 'disabled' : ''}>Pedir más tope salarial a la directiva (${2 - (t.capAsks || 0)} pedidos disponibles)</button>
        ${UI.lineChart(t.fin.bal, { label: 'Evolución de la caja en la temporada' })}
      </section>
      <section class="card">
        <div class="row between"><h3>Temporada ${G.year}</h3><b class="tab-nums" style="color:${res < 0 ? 'var(--loss)' : 'var(--win)'}">${res >= 0 ? '+' : ''}${U.money(res)}</b></div>
        <div class="up">Ingresos · ${U.money(tot.inc)}</div>${bars(L.inc, 'var(--win)')}
        <div class="up">Gastos · ${U.money(tot.exp)}</div>${bars(L.exp, 'var(--loss)')}
      </section>
      <section class="card">
        <h3>Entradas y socios</h3>
        <div class="row between"><div class="grow"><b>Precio de la entrada</b><div class="small muted">Referencia ${U.money(DT.E.refTicket(t))}${lastHome ? ` · último partido: ${U.num(lastHome.att)} de ${U.num(t.cap)}` : ''}</div></div>
          <div class="stepper" style="width:150px"><button class="btn sm" data-a="price" data-k="ticket" data-v="-1">−</button><div class="val" style="font-size:1.1rem">$${t.ticket}</div><button class="btn sm" data-a="price" data-k="ticket" data-v="1">+</button></div></div>
        <div class="row between"><div class="grow"><b>Cuota mensual de socio</b><div class="small muted">Referencia $${DT.COUNTRIES[t.cc].socio} · ${U.num(t.socios)} socios</div></div>
          <div class="stepper" style="width:150px"><button class="btn sm" data-a="price" data-k="fee" data-v="-1">−</button><div class="val" style="font-size:1.1rem">$${t.fee}</div><button class="btn sm" data-a="price" data-k="fee" data-v="1">+</button></div></div>
        <div class="small muted">Entradas caras llenan menos el estadio. Una cuota alta recauda más por socio pero con el tiempo se van socios; los buenos resultados atraen nuevos.</div>
      </section>
      <section class="card">
        <h3>Sponsor principal</h3>
        <div class="small">${t.sponsor ? `<b>${U.esc(t.sponsor.name)}</b>: ${U.money(t.sponsor.amt)} por temporada${t.sponsor.bonus ? ` + ${U.money(t.sponsor.bonus)} ${t.sponsor.kind === 'titulos' ? 'por cada título' : 'si se cumple el objetivo'}` : ''}. Otros sponsors aportan ${U.money(DT.E.sponsorBase(t) * 0.2)}.` : 'Sin sponsor.'}</div>
      </section>
      <section class="card">
        <h3>Préstamos</h3>
        ${loans ? `<div class="list">${loans}</div>` : '<div class="small muted">No tenés préstamos activos.</div>'}
        <div class="up">Pedir un préstamo</div>${opts}
      </section>
      ${hist.length ? `<section class="card"><h3>Balances anteriores</h3><div class="tablewrap"><table><thead><tr><th>Año</th><th>Resultado</th><th>Ingresos</th><th>Gastos</th><th>Caja</th></tr></thead><tbody>${hist.map((h) => `<tr><td>${h.y}</td><td style="text-align:left;color:${h.inc - h.exp < 0 ? 'var(--loss)' : 'var(--win)'}">${U.money(h.inc - h.exp)}</td><td>${U.money(h.inc)}</td><td>${U.money(h.exp)}</td><td>${U.money(h.cash)}</td></tr>`).join('')}</tbody></table></div></section>` : ''}`;
  };
  A.price = (d) => {
    const t = DT.userTeam();
    if (d.k === 'ticket') t.ticket = U.clamp(t.ticket + +d.v, 1, 200);
    else t.fee = U.clamp(t.fee + +d.v, 1, 80);
    UI.render();
  };
  A.loan = (d) => {
    const t = DT.userTeam();
    const o = DT.E.loanOptions(t)[+d.i];
    if (!DT.E.canBorrow(t, o)) { UI.toast('El banco no presta más: la deuda sería demasiado alta.'); return; }
    DT.E.takeLoan(t, o);
    UI.toast(`Recibiste ${U.money(o.amt)}.`);
    DT.Main.autosave();
    UI.render();
  };
  A.repay = (d) => {
    const t = DT.userTeam();
    if (!DT.E.repayLoan(t, +d.i)) UI.toast('No hay caja suficiente para cancelarlo.');
    else UI.toast('Préstamo cancelado.');
    UI.render();
  };

  Sc.stadium = function () {
    const t = DT.userTeam();
    const pips = (lvl) => `<span class="tab-nums" style="letter-spacing:2px;color:var(--accent)">${'■'.repeat(lvl)}<span style="opacity:.25">${'■'.repeat(5 - lvl)}</span></span>`;
    const proj = t.proj.map((p) => `<div class="stack" style="gap:4px"><div class="row between small"><b>${U.esc(p.label)}</b><span>${p.left} sem.</span></div><div class="bar"><i style="width:${((p.total - p.left) / p.total) * 100}%"></i></div></div>`).join('');
    const stadBusy = DT.E.busy(t, 'stadium');
    const exp = DT.E.STADIUM.map((o, i) => `<button class="btn block" data-a="build" data-k="stadium" data-i="${i}" ${stadBusy || t.cap + o.seats > 110000 ? 'disabled' : ''}>+${U.num(o.seats)} lugares · ${U.money(DT.E.stadiumCost(t, o.seats))}<span class="tiny" style="display:block;font-weight:500">${o.weeks} semanas de obra</span></button>`).join('');
    const fac = Object.keys(DT.E.INFRA).map((k) => {
      const I = DT.E.INFRA[k];
      const lvl = t.infra[k];
      const busy = DT.E.busy(t, k);
      return `<section class="card"><div class="row between"><h3>${I.n}</h3>${pips(lvl)}</div><div class="small muted">${I.d}</div>
        ${lvl >= 5 ? '<div class="small">Nivel máximo.</div>' : `<button class="btn block" data-a="build" data-k="${k}" ${busy ? 'disabled' : ''}>${busy ? 'Obra en curso' : `Mejorar a nivel ${lvl + 1} · ${U.money(DT.E.infraCost(t, k))} · ${DT.E.infraWeeks(t, k)} semanas`}</button>`}</section>`;
    }).join('');
    return `<section class="card"><span class="up">Estadio</span><h2>${U.esc(t.stad)}</h2>
        <div class="kv"><div><span>Capacidad</span><b>${U.num(t.cap)}</b></div><div><span>Socios</span><b>${U.num(t.socios)}</b></div><div><span>Mantenimiento</span><b>${U.money(DT.E.upkeepAnnual(t))}</b></div></div>
        <div class="small muted">Demanda estimada de público: ${U.num(DT.E.demandBase(t))} personas por partido (antes de precio y rendimiento). Ampliar conviene si el estadio se llena seguido.</div>
        ${exp}</section>
      ${proj ? `<section class="card"><h3>Obras en curso</h3>${proj}</section>` : ''}
      ${fac}
      <section class="card flat small muted">Cada nivel de infraestructura suma gastos de staff y mantenimiento. Gasto anual actual en staff: ${U.money(DT.E.staffAnnual(t))}.</section>`;
  };
  A.build = (d) => {
    const t = DT.userTeam();
    const r = d.k === 'stadium' ? DT.E.startProject(t, 'stadium', DT.E.STADIUM[+d.i]) : DT.E.startProject(t, d.k);
    UI.toast(r.ok ? 'Obra iniciada.' : r.msg);
    if (r.ok) DT.Main.autosave();
    UI.render();
  };

  Sc.board = function () {
    const G = DT.G;
    const M = G.manager;
    const t = DT.userTeam();
    const conf = Math.round(M.conf);
    return `<section class="card"><span class="up">Objetivo ${G.year}</span><div>${U.esc(M.obj ? M.obj.text : '')}</div>
        <div class="row between small"><span>Confianza de la directiva</span><b>${conf}/100</b></div><div class="bar ${conf < 30 ? 'bad' : conf < 50 ? 'warn' : ''}"><i style="width:${conf}%"></i></div>
        <div class="small muted">Sube con victorias (sobre todo contra rivales más fuertes), al estar en la tabla por encima del objetivo, al avanzar en las copas y con las finanzas sanas. Baja con derrotas, al estar por debajo del objetivo, con deudas o con sueldos por encima del tope. Por debajo de 25 llega un ultimátum y por debajo de 12 te despiden, salvo que estés a 2 puestos o menos del objetivo.</div></section>
      ${Sc.interestCard()}
      <section class="card"><span class="up">Entrenador</span><h2>${U.esc(M.n)}</h2>
        <div class="kv"><div><span>Reputación</span><b>${Math.round(M.rep)}</b></div><div><span>Partidos</span><b>${M.pj}</b></div><div><span>G-E-P</span><b class="tab-nums" style="font-size:1rem">${M.g}-${M.e}-${M.p}</b></div></div>
        <div class="small">Club actual: <b>${U.esc(t.n)}</b> desde ${M.clubs[M.clubs.length - 1].from}.</div></section>
      <section class="card"><h3>Títulos</h3>${M.titles.length ? `<div class="list">${M.titles.slice().reverse().map((x) => `<div class="li"><span class="pill gold">${x.y}</span><div class="name">${U.esc(x.c)}<div class="sub">${U.esc(x.t)}</div></div></div>`).join('')}</div>` : '<div class="small muted">Todavía sin títulos. ¡A trabajar!</div>'}</section>
      <section class="card"><h3>Trayectoria</h3>${M.career.length ? `<div class="list">${M.career.slice().reverse().map((c) => `<div class="li"><div class="name">${U.esc(c.club)}<div class="sub">${c.y ? `${c.y}: terminó ${c.pos}º · confianza ${c.conf}` : `${c.from}–${c.to} · ${U.esc(c.why)}`}</div></div></div>`).join('')}</div>` : '<div class="small muted">Primera temporada en curso.</div>'}</section>`;
  };

  // Clubes que quieren al DT: se puede renunciar para ir a uno de ellos.
  Sc.interestCard = function () {
    const G = DT.G;
    const ids = DT.Board.interested();
    const rows = ids.map((id) => {
      const t = G.teams[id];
      return `<div class="li" data-a="leaveAsk" data-id="${id}">${UI.badge(t)}<div class="name">${U.esc(t.n)}<div class="sub">${DT.COUNTRIES[t.cc].flag} ${U.esc(DT.divName(t))} · media ${DT.AI.rating(t)} · rep. ${Math.round(t.rep)}</div></div><span class="btn sm">Ver</span></div>`;
    }).join('');
    return `<section class="card" id="interest"><div class="row between"><h3>Clubes interesados en vos</h3><span class="pill">${ids.length}</span></div>
      ${rows ? `<div class="list">${rows}</div>` : '<div class="small muted">Por ahora ningún club preguntó por vos. Con buenos resultados y más reputación van a aparecer interesados.</div>'}
      <div class="tiny muted">La lista se renueva cada 6 semanas. Si aceptás, dejás ${U.esc(DT.userTeam().n)} en el momento.</div></section>`;
  };
  A.leaveAsk = (d) => {
    const G = DT.G;
    const t = G.teams[d.id];
    const me = DT.userTeam();
    if (!t) return;
    UI.modal(`<span class="kicker">Cambio de club</span>
      <div class="row">${UI.badge(t, 'l')}<div class="grow"><h2>${U.esc(t.n)}</h2><div class="small muted">${DT.COUNTRIES[t.cc].flag} ${U.esc(DT.divName(t))}</div></div></div>
      <div class="kv"><div><span>Media</span><b>${DT.AI.rating(t)}</b></div><div><span>Reputación</span><b>${Math.round(t.rep)}</b></div><div><span>Caja</span><b>${U.money(t.cash)}</b></div></div>
      <div class="small">Si aceptás, renunciás a ${U.esc(me.n)} y dirigís a ${U.esc(t.n)} desde ahora, con un nuevo objetivo de la directiva.</div>
      <button class="btn primary block" data-a="leaveDo" data-id="${t.id}">Irme a ${U.esc(t.n)}</button>
      <button class="btn block" data-a="team" data-id="${t.id}">Ver plantel</button>`);
  };
  A.leaveDo = (d) => {
    if (!DT.G.teams[d.id]) return;
    DT.Board.leave(d.id);
    UI.closeModal();
    UI.tab = 'home';
    UI.compSel = null;
    DT.Main.autosave(true);
    UI.render();
    UI.toast(`Nuevo desafío: ${DT.userTeam().n}.`);
  };

  // Historial: temporadas, récords del club y logros.
  Sc.history = function () {
    const v = UI.sub.hist || 'seasons';
    const seg = `<div class="seg">${[['seasons', 'Temporadas'], ['rec', 'Récords'], ['ach', 'Logros']].map(([k, l]) => `<button class="${v === k ? 'on' : ''}" data-a="sub" data-k="hist" data-v="${k}">${l}</button>`).join('')}</div>`;
    return seg + (v === 'rec' ? Sc.records() : v === 'ach' ? Sc.achievements() : Sc.seasons());
  };

  Sc.records = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const r = DT.Rec.of(t.id);
    const [pj, g, e, p, gf, gc] = r.games;
    const pl = Object.values(r.pl);
    const top = (k, n) => pl.filter((x) => x[k] > 0).sort((a, b) => b[k] - a[k]).slice(0, n || 10);
    const list = (rows, k, unit) => (rows.length ? `<div class="list">${rows.map((x, i) => `<div class="li"><span class="muted tab-nums" style="width:20px">${i + 1}</span><div class="name">${U.esc(x[0])}</div><b class="tab-nums">${x[k]} ${unit}</b></div>`).join('')}</div>` : '<div class="small muted">Todavía sin datos.</div>');
    const score = (x) => (x ? `<b>${x[0]}-${x[1]}</b> vs ${U.esc(x[2])} <span class="muted">(${U.esc(x[4])}, ${x[3]})</span>` : '—');
    const h2h = Object.values(r.h2h).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return `<section class="card"><span class="up">${U.esc(t.n)} · desde ${r.since}</span>
        <div class="kv"><div><span>Partidos</span><b>${pj}</b></div><div><span>G-E-P</span><b class="tab-nums" style="font-size:1rem">${g}-${e}-${p}</b></div><div><span>Goles</span><b class="tab-nums" style="font-size:1rem">${gf}-${gc}</b></div></div>
        <div class="stack small">
          <div class="row between"><span class="muted">Mayor goleada</span><span>${score(r.bigW)}</span></div>
          <div class="row between"><span class="muted">Peor derrota</span><span>${score(r.bigL)}</span></div>
          <div class="row between"><span class="muted">Racha invicta</span><b>${r.unb[1]} partidos${r.unb[0] ? ` <span class="muted" style="font-weight:400">(actual ${r.unb[0]})</span>` : ''}</b></div>
          <div class="row between"><span class="muted">Victorias seguidas</span><b>${r.wins[1]}</b></div>
          <div class="row between"><span class="muted">Goleador en una temporada</span><span>${r.seasonG ? `<b>${U.esc(r.seasonG[0])}</b> ${r.seasonG[1]} goles (${r.seasonG[2]})` : '—'}</span></div>
          <div class="row between"><span class="muted">Mejor campaña</span><span>${r.bestPos ? `<b>${r.bestPos[0]}º</b> en ${U.esc(r.bestPos[3] || '')} (${r.bestPos[1]})` : '—'}</span></div>
          <div class="row between"><span class="muted">Récord de público</span><span>${r.att ? `<b>${U.num(r.att[0])}</b> vs ${U.esc(r.att[1])} (${r.att[2]})` : '—'}</span></div>
        </div></section>
      <section class="card"><h3>Máximos goleadores</h3>${list(top(2), 2, 'goles')}</section>
      <section class="card"><h3>Más partidos</h3>${list(top(1), 1, 'PJ')}</section>
      <section class="card"><h3>Más asistencias</h3>${list(top(3, 5), 3, 'asist.')}</section>
      <section class="card"><h3>Historial contra rivales</h3>${h2h.length ? `<div class="tablewrap"><table><thead><tr><th>#</th><th>Rival</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th></tr></thead><tbody>${h2h.map((x, i) => `<tr><td>${i + 1}</td><td class="team">${U.esc(x[0])}</td><td>${x[1]}</td><td>${x[2]}</td><td>${x[3]}</td><td>${x[4]}</td><td>${x[5]}</td><td>${x[6]}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Todavía sin partidos.</div>'}</section>
      <section class="card flat small muted">Los récords cuentan los partidos con vos como DT de ${U.esc(t.n)}.</section>`;
  };

  Sc.achievements = function () {
    const G = DT.G;
    const got = G.ach || {};
    const n = DT.Ach.LIST.filter((x) => got[x[0]]).length;
    return `<section class="card"><div class="row between"><h2>Logros</h2><span class="pill gold">${n}/${DT.Ach.LIST.length}</span></div><div class="bar"><i style="width:${(n / DT.Ach.LIST.length) * 100}%;background:var(--gold)"></i></div></section>
      <section class="card"><div class="achs">${DT.Ach.LIST.map(([id, ic, ti, de]) => `<div class="ach ${got[id] ? 'on' : ''}"><span class="ic">${got[id] ? ic : '🔒'}</span><div class="grow"><b>${U.esc(ti)}</b><div class="tiny muted">${U.esc(de)}${got[id] ? ` · ${got[id][0]}` : ''}</div></div></div>`).join('')}</div></section>`;
  };

  Sc.seasons = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const names = { LIB: 'Libertadores', SUD: 'Sudamericana', REC: 'Recopa', INT: 'Intercontinental' };
    const seasons = G.history.map((h) => {
      const main = ['LIB', 'SUD', 'REC', 'INT'].filter((k) => h.champs[k]).map((k) => `<div class="row between small"><span class="muted">${names[k]}</span><b>${U.esc(h.champs[k][1])}</b></div>`).join('');
      const leagues = DT.COUNTRY_ORDER.map((cc) => (h.champs['L_' + cc] ? `<div class="row between small"><span class="muted">${DT.COUNTRIES[cc].flag} ${U.esc(DT.COUNTRIES[cc].league)}</span><b>${U.esc(h.champs['L_' + cc][1])}</b></div>` : '')
        + (h.champs['B_' + cc] ? `<div class="row between small"><span class="muted">${DT.COUNTRIES[cc].flag} ${U.esc(DT.COUNTRIES[cc].div2.name)}</span><b>${U.esc(h.champs['B_' + cc][1])}</b></div>` : '')).join('');
      const cups = DT.COUNTRY_ORDER.map((cc) => h.champs['C_' + cc] ? `<div class="row between small"><span class="muted">${DT.COUNTRIES[cc].flag} ${U.esc(DT.COUNTRIES[cc].cup)}</span><b>${U.esc(h.champs['C_' + cc][1])}</b></div>` : '').join('');
      const sc = h.scorers[t.cc] && h.scorers[t.cc][0];
      return `<section class="card"><div class="row between"><h3>Temporada ${h.y}</h3>${h.user ? `<span class="pill">${U.esc(h.user.team)}: ${h.user.pos}º</span>` : ''}</div>${main}<details><summary class="small" style="cursor:pointer;font-weight:600">Ligas y copas nacionales</summary><div class="stack" style="margin-top:8px">${leagues}${cups}</div></details>${sc ? `<div class="small muted">Goleador de ${DT.COUNTRIES[t.cc].name}: ${U.esc(sc[0])} (${U.esc(sc[1])}), ${sc[2]} goles.</div>` : ''}</section>`;
    }).join('');
    const titles = (t.titles || []).slice().reverse();
    return `<section class="card"><h3>Vitrina de ${U.esc(t.n)}</h3>${titles.length ? `<div class="list">${titles.map((x) => `<div class="li"><span class="pill gold">${x.y}</span><div class="name">${U.esc(x.c)}</div></div>`).join('')}</div>` : '<div class="small muted">Los títulos ganados desde que empezó la partida aparecen acá.</div>'}</section>${seasons || '<div class="empty">El historial se completa al terminar la primera temporada.</div>'}`;
  };

  Sc.gameOpts = function () {
    const G = DT.G;
    const cloud = DT.Save.cloud.ready;
    return `<section class="card"><h3>Guardado</h3>
        <div class="small muted">La partida se guarda sola en este dispositivo después de cada partido. ${cloud ? 'También se guarda en tu cuenta de Claude cada pocas semanas.' : ''}</div>
        <button class="btn primary block" data-a="saveNow">Guardar ahora</button>
        ${cloud ? '<button class="btn block" data-a="cloudLoad">Cargar desde la nube</button>' : ''}
      </section>
      <section class="card"><h3>Copia de seguridad</h3>
        <div class="small muted">Exportá la partida para pasarla a otro dispositivo o guardarla aparte.</div>
        <button class="btn block" data-a="exportSave">Exportar partida</button>
        <button class="btn block" data-a="importOpen">Importar partida</button>
      </section>
      <section class="card"><h3>Dificultad</h3><div class="small">${G.settings.diff === 'real' ? '<b>Realista</b>: arrancaste en un club modesto y las ofertas de clubes más grandes dependen de tu reputación como DT.' : '<b>Arcade</b>: elegiste libremente el club.'} Se elige al empezar una partida nueva.</div></section>
      <section class="card"><h3>Pantalla</h3>
        <div class="small muted">El modo ordenador usa todo el ancho de la pantalla. Se recuerda en este dispositivo.</div>
        ${UI.layoutSwitch()}
      </section>
      <section class="card"><h3>Partidos</h3>
        <span class="up">Velocidad del partido en vivo</span>
        <div class="seg">${[[1, 'x1'], [2, 'x2'], [4, 'x4']].map(([v, l]) => `<button class="${G.settings.speed === v ? 'on' : ''}" data-a="setSpeed" data-v="${v}">${l}</button>`).join('')}</div>
        <label class="toggle small"><input type="checkbox" data-c="setWeekly" ${G.settings.weekly === false ? '' : 'checked'}> Mostrar el resumen semanal al pasar de semana</label>
        <span class="up">Cámara del partido</span>
        <div class="seg">${[['tv', 'Cámara TV (sigue la jugada)'], ['full', 'Cancha entera']].map(([v, l]) => `<button class="${(G.settings.cam || 'tv') === v ? 'on' : ''}" data-a="setCam" data-v="${v}">${l}</button>`).join('')}</div>
      </section>
      <section class="card"><h3>Otras carreras</h3><div class="small muted">Podés tener hasta 3 carreras guardadas. Esta está en el espacio ${DT.Save.slot}.</div><button class="btn block" data-a="newGameAsk">Volver al inicio</button></section>
      <section class="card flat small muted">Planteles aproximados a la temporada 2025/26. Los clubes con pocos datos completan su plantel con jugadores generados. Podés corregir cualquier nombre desde la ficha del jugador.</section>`;
  };
  A.setSpeed = (d) => { DT.G.settings.speed = +d.v; UI.render(); };
  A.setCam = (d) => { DT.G.settings.cam = d.v; UI.render(); };
  A.setWeekly = (d, el) => { DT.G.settings.weekly = el.checked; if (el.checked) DT.Week.snap(); };
  A.saveNow = async () => {
    const ok = await DT.Main.autosave(true);
    UI.toast(ok ? 'Partida guardada.' : 'No se pudo guardar en este dispositivo. Exportá la partida para no perderla.');
  };
  A.cloudLoad = async () => {
    const meta = await DT.Save.cloudMeta();
    if (!meta) { UI.toast('No hay partida guardada en la nube.'); return; }
    UI.modal(`<h3>Cargar desde la nube</h3><div class="small">Partida de ${U.esc(meta.mgr)} con ${U.esc(meta.team)}, temporada ${meta.year}, semana ${meta.week}. Reemplaza la partida actual.</div><button class="btn primary block" data-a="cloudLoadDo">Cargar</button>`);
  };
  A.cloudLoadDo = async () => {
    const ok = await DT.Save.cloudLoad();
    UI.closeModal();
    UI.toast(ok ? 'Partida cargada.' : 'No se pudo cargar.');
    DT.Main.afterLoad();
  };
  A.exportSave = async () => {
    const s = await DT.Save.pack();
    const dl = DT.Main.downloads;
    if (dl) {
      try {
        await dl.save({ filename: `dt-sudamericano-${DT.G.year}-s${DT.G.week}.txt`, data: s });
        return;
      } catch (e) { /* si no se puede descargar, se muestra el texto */ }
    }
    UI.modal(`<h3>Exportar partida</h3><div class="small muted">Copiá este texto y guardalo. Para recuperarla, usá "Importar partida" y pegalo.</div><textarea id="exporttxt" readonly>${s}</textarea><button class="btn primary block" data-a="copyExport">Copiar</button>`);
  };
  A.copyExport = () => {
    const ta = document.getElementById('exporttxt');
    const done = () => UI.toast('Copiado.');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); UI.toast('Seleccionado: copialo con el menú del teléfono.'); });
    else { ta.select(); UI.toast('Seleccionado: copialo con el menú del teléfono.'); }
  };
  A.importOpen = () => {
    UI.modal(`<h3>Importar partida</h3><div class="small muted">Elegí el archivo exportado o pegá el texto. Reemplaza la partida actual.</div><input type="file" id="importfile" accept=".txt,text/plain"><textarea id="importtxt" placeholder="Pegá acá el texto de la partida"></textarea><button class="btn primary block" data-a="importDo">Importar</button>`);
  };
  A.importDo = async () => {
    let s = document.getElementById('importtxt').value.trim();
    const f = document.getElementById('importfile').files[0];
    if (!s && f) s = (await f.text()).trim();
    if (!s) { UI.toast('Elegí un archivo o pegá el texto.'); return; }
    try {
      await DT.Save.unpack(s);
      UI.closeModal();
      UI.toast('Partida importada.');
      DT.Main.afterLoad();
    } catch (e) {
      UI.toast('El texto no es una partida válida.');
    }
  };
  A.newGameAsk = () => {
    UI.modal(`<h3>Volver al inicio</h3><div class="small">Tu carrera actual queda guardada en el espacio ${DT.Save.slot}. En el inicio podés seguir otra carrera o empezar una nueva en cualquiera de los 3 espacios.</div><button class="btn primary block" data-a="newGameDo">Guardar y volver al inicio</button>`);
  };
  A.newGameDo = async () => {
    await DT.Main.autosave(true);
    UI.closeModal();
    DT.Main.showStart(false);
  };
})();
