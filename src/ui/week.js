// Resumen semanal: al pasar de semana muestra, en una sola pantalla, lo que cambió en el plantel,
// el mercado y la liga desde el último resumen. Es informativo: se cierra con "Seguir".
DT.Week = (function () {
  const U = DT.U;
  const UI = DT.UI;
  const A = UI.A;
  const W = {};
  const key = () => DT.G.year * 100 + DT.G.week;

  function leaguePos(t) {
    const comp = DT.G.season.comps[DT.divOf(t)];
    // sin partidos jugados la posición no dice nada (todos tienen 0 puntos)
    if (!comp || !comp.table[t.id] || !comp.table[t.id].pj) return null;
    return DT.S.sortTable(comp.table, comp.teams).indexOf(t.id) + 1;
  }

  // Foto del estado actual para comparar la semana que viene.
  W.snap = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const inj = {}, acad = {};
    for (const id of t.squad) { const p = G.players[id]; if (p && p.inj > 0) inj[id] = p.inj; }
    for (const p of DT.Acad.list(t)) acad[p.id] = p.ovr;
    G.wkSnap = { k: key(), y: G.year, w: G.week, tid: t.id, inj, acad, pos: leaguePos(t), newsN: G.newsN || 0, offer: G.nextOffer || 0 };
  };

  W.build = function () {
    const G = DT.G;
    const S0 = G.wkSnap;
    const t = DT.userTeam();
    const squad = t.squad.map((id) => G.players[id]).filter(Boolean);
    // plantel
    const plantel = [];
    for (const p of squad) if (p.inj > 0 && !S0.inj[p.id]) plantel.push(['bad', p, `Lesión · ${p.inj} ${p.inj === 1 ? 'semana' : 'semanas'}`]);
    for (const p of squad) if (S0.inj[p.id] && p.inj <= 0) plantel.push(['ok', p, 'Vuelve de lesión']);
    for (const p of squad) if (p.sus > 0) plantel.push(['warn', p, 'Suspendido el próximo partido']);
    const tired = (t.xi || []).map((id) => G.players[id]).filter((p) => p && p.fit < 65 && p.inj <= 0).sort((a, b) => a.fit - b.fit).slice(0, 3);
    if (tired.length) plantel.push(['warn', null, tired.map((p) => `${p.n.split(' ').slice(-1)[0]} ${Math.round(p.fit)}%`).join(' · '), 'Cansados']);
    const kid = DT.Acad.list(t).map((p) => [p, p.ovr - (S0.acad[p.id] || p.ovr)]).filter((x) => x[1] >= 1).sort((a, b) => b[1] - a[1])[0];
    if (kid) plantel.push(['gold', kid[0], `Inferiores · ${kid[0].age} años: subió a ${kid[0].ovr} de media`]);
    // mercado
    const market = [];
    const open = DT.S.windowOpen();
    for (const o of DT.M.openOffers()) if (o.id > S0.offer) market.push(['gold', `Oferta por ${G.players[o.pid].n}`, `${o.name} ofrece ${U.money(o.fee)}`, o.id]);
    const comp = G.season.comps[DT.divOf(t)];
    const names = comp ? comp.teams.map((id) => G.teams[id].n).filter((n) => n !== t.n) : [];
    const moves = G.news.filter((n) => (n.n || 0) > S0.newsN && n.k === 'transfer' && names.some((x) => n.t.includes(x))).slice(0, 2);
    for (const n of moves) market.push(['', n.t, '', null, true]);
    // liga
    let liga = null;
    if (comp) {
      const order = DT.S.sortTable(comp.table, comp.teams);
      const pos = order.indexOf(t.id) + 1;
      const last = (id) => Object.values(G.season.matches).filter((m) => m.c === comp.id && m.p && (m.h === id || m.a === id) && (m.w > S0.w || G.year > S0.y)).sort((a, b) => b.w - a.w)[0];
      const rows = order.slice(0, 3).concat(pos > 3 ? [t.id] : []).map((id) => {
        const m = last(id);
        const tm = G.teams[id];
        let res = '';
        if (m) {
          const home = m.h === id;
          const opp = G.teams[home ? m.a : m.h];
          res = `${home ? m.hg : m.ag}-${home ? m.ag : m.hg} vs ${opp.s}`;
        }
        return { id, i: order.indexOf(id) + 1, n: tm.n, pts: comp.table[id].pts, res };
      });
      liga = { name: comp.name, rows, diff: S0.pos && pos ? S0.pos - pos : 0 };
    }
    return { plantel, market, open, liga };
  };

  // ¿Corresponde mostrar el resumen? (pasó al menos una semana, misma temporada y mismo club)
  W.due = function () {
    const G = DT.G;
    if (!G || G.pendingOffers || G.retired) return false;
    if (!G.wkSnap || G.wkSnap.y !== G.year || G.wkSnap.tid !== G.user) { W.snap(); return false; }
    if (key() <= G.wkSnap.k) return false;
    if (G.settings.weekly === false) { W.snap(); return false; }
    return true;
  };

  W.show = function () {
    const G = DT.G;
    const d = W.build();
    const S0 = G.wkSnap;
    const empty = !d.plantel.length && !d.market.length && !d.liga;
    if (empty) { W.snap(); return false; }
    const line = (dot, title, sub, extra, plain) => `<div class="wk-line"><span class="dotc ${dot}"></span><div class="grow">${plain ? `<span class="small">${U.esc(title)}</span>` : `<b>${U.esc(title)}</b>`}${sub ? `<div class="muted small">${U.esc(sub)}</div>` : ''}</div>${extra || ''}</div>`;
    const plantel = d.plantel.length ? `<section class="card wk-card"><div class="row between"><span class="up">Plantel</span><button class="linkbtn" data-a="wkGo" data-tab="squad">Ver plantel ▸</button></div>
      ${d.plantel.map(([dot, p, sub, title]) => (p ? `<div class="wk-line" data-a="player" data-id="${p.id}"><span class="dotc ${dot}"></span><div class="grow"><b>${U.esc(p.n)}</b><div class="muted small">${U.esc(sub)}</div></div></div>` : line(dot, title, sub))).join('')}</section>` : '';
    const winTxt = d.open ? `Abierto hasta la sem. ${G.week <= 4 ? 4 : 26}` : 'Libro cerrado';
    const market = d.market.length || d.open ? `<section class="card wk-card"><div class="row between"><span class="up">Mercado</span><span class="pill ${d.open ? 'ok' : ''}">${winTxt}</span></div>
      ${d.market.map(([dot, title, sub, oid, plain]) => line(dot, title, sub, oid ? `<button class="btn sm primary" data-a="wkOffer" data-id="${oid}">Ver</button>` : '', plain)).join('') || '<div class="small muted">Sin ofertas nuevas esta semana.</div>'}</section>` : '';
    const L = d.liga;
    const liga = L ? `<section class="card wk-card"><div class="row between"><span class="up">${U.esc(L.name)}</span><button class="linkbtn" data-a="wkGo" data-tab="comp">Ver tabla ▸</button></div>
      <table><tbody>${L.rows.map((r) => `<tr class="${r.id === G.user ? 'me' : ''}"><td>${r.i}</td><td class="team">${U.esc(r.n)}</td><td class="muted">${U.esc(r.res)}</td><td><b>${r.pts}</b></td></tr>`).join('')}</tbody></table>
      ${L.diff ? `<div class="tiny" style="color:${L.diff > 0 ? 'var(--win)' : 'var(--loss)'};font-weight:700">${L.diff > 0 ? '▲' : '▼'} ${Math.abs(L.diff)} ${Math.abs(L.diff) === 1 ? 'puesto' : 'puestos'} desde el último resumen</div>` : ''}</section>` : '';
    const range = S0.w + 1 < G.week ? `Semanas ${S0.w + 1} a ${G.week}` : `Semana ${G.week}`;
    const el = document.getElementById('overlay');
    el.innerHTML = `<div class="wrap wk"><div class="wk-head"><span class="kicker">Resumen de la semana</span><h2>${range} · ${G.year}</h2></div>
      <div class="wk-body">${plantel}${market}${liga}</div>
      <div class="wk-foot"><button class="btn primary block big" data-a="wkDone">Seguir</button><button class="linkbtn" data-a="wkOff">No mostrar más el resumen</button></div></div>`;
    el.hidden = false;
    el.scrollTop = 0;
    W.snap();
    return true;
  };

  function close() {
    const el = document.getElementById('overlay');
    el.hidden = true;
    el.innerHTML = '';
  }
  A.wkDone = () => { close(); UI.render(); };
  A.wkOff = () => { DT.G.settings.weekly = false; close(); UI.toast('Resumen semanal desactivado. Lo podés volver a activar en Club → Partida.', 3500); UI.render(); };
  A.wkGo = (d) => { close(); UI.tab = d.tab; UI.render(); window.scrollTo(0, 0); };
  A.wkOffer = (d) => { close(); UI.tab = 'market'; UI.sub.market = 'mine'; UI.render(); A.offNeg({ id: d.id }); };

  return W;
})();
