// Directiva: objetivos, confianza en el DT, despidos y ofertas de trabajo.
DT.Board = (function () {
  const U = DT.U;
  const B = {};

  B.leagueRank = function (team) {
    const G = DT.G;
    const div = DT.divOf(team);
    const ids = Object.values(G.teams).filter((t) => DT.divOf(t) === div).sort((a, b) => DT.AI.rating(b) + b.rep * 0.05 - (DT.AI.rating(a) + a.rep * 0.05));
    return { rank: ids.findIndex((t) => t.id === team.id) + 1, n: ids.length };
  };

  B.makeObjective = function (team) {
    const C = DT.COUNTRIES[team.cc];
    const { rank, n } = B.leagueRank(team);
    let o;
    if (team.d2) {
      // segunda división: el objetivo gira alrededor del ascenso (no hay descenso)
      if (rank <= C.rel + 1) o = { target: C.rel, text: `Ascender a ${C.league}: terminar entre los ${C.rel} primeros de la ${C.div2.name}.` };
      else if (rank <= Math.ceil(n * 0.4)) o = { target: Math.max(C.rel + 2, 6), text: `Pelear el ascenso: terminar entre los ${Math.max(C.rel + 2, 6)} primeros.` };
      else o = { target: Math.ceil(n / 2), text: `Terminar en la mitad de arriba de la ${C.div2.name} (top ${Math.ceil(n / 2)}).` };
      o.rank = rank;
      return o;
    }
    if (rank <= 2) o = { target: 2, text: 'Pelear el campeonato: terminar entre los 2 primeros de la liga.' };
    else if (rank <= C.lib) o = { target: C.lib, text: `Clasificar a la Copa Libertadores: terminar entre los ${C.lib} primeros.` };
    else if (rank <= C.lib + C.sud) o = { target: C.lib + C.sud, text: `Clasificar a una copa internacional: terminar entre los ${C.lib + C.sud} primeros.` };
    else if (rank <= Math.ceil(n * 0.65)) o = { target: Math.ceil(n / 2), text: `Terminar en la mitad de arriba de la tabla (top ${Math.ceil(n / 2)}).` };
    else o = { target: n - C.rel, text: 'Evitar el descenso.' };
    o.rank = rank;
    return o;
  };

  B.seasonStart = function () {
    const G = DT.G;
    const t = DT.userTeam();
    if (!t) return;
    G.manager.obj = B.makeObjective(t);
    DT.inbox({
      title: `Objetivo de la temporada ${G.year}`,
      body: `La directiva de ${t.n} espera: ${G.manager.obj.text} El plantel es el ${G.manager.obj.rank}º más fuerte de la liga.`,
      kind: 'board',
    });
    const offers = DT.E.sponsorOffers(t);
    DT.inbox({
      title: 'Elegí el sponsor principal',
      body: 'Tres marcas quieren estar en la camiseta esta temporada. Si no elegís, la directiva firma la primera.',
      kind: 'money',
      actions: offers.map((o, i) => ({ id: 'sponsor', i, label: `${o.name}: ${U.money(o.amt)}${o.bonus ? ` + ${U.money(o.bonus)} ${o.kind === 'titulos' ? 'por título' : 'por objetivo'}` : ''}`, sub: o.txt })),
      data: { offers },
    });
    t.sponsor = Object.assign({}, offers[0]);
  };

  B.expected = function (match) {
    const G = DT.G;
    const me = DT.userTeam();
    const opp = G.teams[match.h === me.id ? match.a : match.h];
    const home = !match.n && match.h === me.id ? 1.5 : !match.n ? -1.5 : 0;
    return U.clamp(0.5 + (DT.AI.rating(me) - DT.AI.rating(opp) + home) * 0.045, 0.08, 0.92);
  };

  B.afterMatch = function (match) {
    const G = DT.G;
    const me = G.user;
    const mine = match.h === me ? match.hg : match.ag;
    const theirs = match.h === me ? match.ag : match.hg;
    const res = mine > theirs ? 1 : mine < theirs ? 0 : 0.5;
    const M = G.manager;
    M.pj++;
    if (res === 1) M.g++; else if (res === 0) M.p++; else M.e++;
    const exp = B.expected(match);
    const derby = DT.isDerby(match.h, match.a);
    M.conf = U.clamp(M.conf + (res - exp) * 7 * (derby ? 1.6 : 1), 0, 100);
    const opp = G.teams[match.h === me ? match.a : match.h];
    G.lastResult = { res, derby, opp: opp.n, mine, theirs, w: G.week, y: G.year };
    if (derby) {
      // los clásicos pegan fuerte en el ánimo del plantel
      const d = res === 1 ? 5 : res === 0 ? -5 : 0;
      for (const pid of DT.userTeam().squad) { const p = G.players[pid]; p.mor = U.clamp(p.mor + d, 10, 100); }
    }
  };

  // Pedido de ampliación del tope salarial.
  B.askCapRaise = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const M = G.manager;
    t.capAsks = t.capAsks || 0;
    if (t.capAsks >= 2) return { ok: false, msg: 'La directiva ya escuchó dos pedidos esta temporada. Volvé a intentarlo el año que viene.' };
    t.capAsks++;
    const rev = DT.E.estimateRevenue(t);
    if (t.cash < -rev * 0.1) return { ok: false, msg: 'Con la caja en rojo, la directiva rechaza subir el tope. Primero hay que vender o recortar.' };
    if (M.conf >= 70 || (t.cash > rev * 0.4 && M.conf >= 45)) {
      t.capBonus = (t.capBonus || 0) + 0.12;
      return { ok: true, msg: `Aprobado: el tope sube 12% (${U.money(DT.E.wageCap(t))} anuales). La directiva confía en vos.` };
    }
    if (M.conf >= 40) {
      t.capBonus = (t.capBonus || 0) + 0.06;
      M.conf = Math.max(0, M.conf - 4);
      return { ok: true, msg: `Aprobado a regañadientes: el tope sube 6% (${U.money(DT.E.wageCap(t))}), pero la directiva espera resultados.` };
    }
    return { ok: false, msg: 'Rechazado: la directiva no confía lo suficiente en tu gestión para gastar más en sueldos.' };
  };

  B.weekly = function () {
    const G = DT.G;
    const t = DT.userTeam();
    const M = G.manager;
    const rev = DT.E.estimateRevenue(t);
    if (t.cash < -rev * 0.25) {
      M.conf -= 1.5;
      if (G.week % 6 === 0) DT.inbox({ title: 'Alarma financiera', body: `La deuda del club es preocupante (${U.money(t.cash)}). La directiva exige vender o recortar gastos. Mientras haya saldo negativo grande, no se aprueban compras.`, kind: 'board' });
    } else if (t.cash < 0) {
      M.conf -= 0.5;
    }
    if (DT.E.payroll(t) > DT.E.wageCap(t) * 1.1) M.conf -= 0.4;
    M.conf = U.clamp(M.conf, 0, 100);
    if (G.week === 20) {
      DT.inbox({ title: 'Mitad de temporada', body: `La directiva evalúa tu trabajo: confianza ${Math.round(M.conf)}/100. ${M.conf >= 60 ? 'Están conformes con el rumbo.' : M.conf >= 35 ? 'Esperan una mejora en la segunda mitad.' : 'Tu puesto corre peligro.'}`, kind: 'board' });
    }
    if (G.week === 30) {
      const ending = t.squad.map((id) => G.players[id]).filter((p) => p.cy <= 1);
      if (ending.length) DT.inbox({ title: 'Contratos que vencen', body: `Terminan contrato a fin de año: ${ending.map((p) => `${p.n} (${p.ovr})`).join(', ')}. Renovalos desde su ficha o se irán libres.`, kind: 'squad' });
    }
    if (G.week >= 10 && M.conf < 12 && !G.pendingOffers) B.fire('La directiva perdió la confianza en tu trabajo y decidió rescindir tu contrato.');
  };

  B.fire = function (reason) {
    const G = DT.G;
    const t = DT.userTeam();
    G.manager.career.push({ club: t.n, from: G.manager.clubs[G.manager.clubs.length - 1].from, to: G.year, why: 'Despedido' });
    G.manager.rep = Math.max(20, G.manager.rep - 6);
    DT.news(`${t.n} despidió a ${G.manager.n}.`, 'club');
    G.pendingOffers = { reason, offers: B.jobOffers(t.id, true) };
  };

  // Ofertas de clubes acordes a la reputación del DT.
  B.jobOffers = function (excludeId, fired) {
    const G = DT.G;
    const rep = G.manager.rep;
    const pool = Object.values(G.teams).filter((t) => DT.inLeague(t) && t.id !== excludeId && t.id !== G.user);
    const max = fired ? rep + 2 : rep + 8;
    const min = fired ? rep - 30 : rep - 6;
    let cands = pool.filter((t) => t.rep <= max && t.rep >= min);
    if (cands.length < 3) cands = pool.slice().sort((a, b) => a.rep - b.rep).slice(0, 12);
    U.shuffle(cands);
    return cands.slice(0, fired ? 4 : 2).map((t) => t.id);
  };

  // Clubes interesados en el DT: se renuevan cada 6 semanas y dependen de su reputación.
  B.interested = function () {
    const G = DT.G;
    const M = G.manager;
    const key = G.year * 100 + Math.floor(G.week / 6);
    const valid = (id) => G.teams[id] && id !== G.user && DT.inLeague(G.teams[id]);
    if (G.interest && G.interest.key === key && G.interest.ids.every(valid)) return G.interest.ids;
    const pool = Object.values(G.teams).filter((t) => valid(t.id));
    const cands = U.shuffle(pool.filter((t) => t.rep <= M.rep + 6 && t.rep >= M.rep - 14));
    // con buena imagen ante la directiva actual hay más clubes atentos
    const n = U.clamp(Math.round(M.rep / 25) + (M.conf >= 60 ? 1 : 0) + U.ri(-1, 1), 0, 5);
    G.interest = { key, ids: cands.slice(0, n).map((t) => t.id) };
    return G.interest.ids;
  };

  // Renunciar para dirigir a un club interesado.
  B.leave = function (tid) {
    const G = DT.G;
    const me = DT.userTeam();
    G.manager.career.push({ club: me.n, from: G.manager.clubs[G.manager.clubs.length - 1].from, to: G.year, why: `Renunció para ir a ${G.teams[tid].n}` });
    DT.news(`${G.manager.n} deja ${me.n} y se va a ${G.teams[tid].n}.`, 'club');
    for (const m of G.inbox) if (m.actions && !m.done && m.actions.some((a) => a.id === 'job')) m.done = true;
    G.interest = null;
    B.takeJob(tid);
  };

  // Retiro del DT: termina la carrera.
  B.retire = function () {
    const G = DT.G;
    G.pendingOffers = null;
    G.retired = { y: G.year, w: G.week };
    DT.news(`${G.manager.n} anunció su retiro como entrenador.`, 'club');
  };

  B.takeJob = function (tid) {
    const G = DT.G;
    G.pendingOffers = null;
    G.interest = null;
    DT.W.setUserTeam(tid);
    const t = DT.userTeam();
    if (G.week === 0) {
      B.seasonStart();
      return;
    }
    G.manager.obj = B.makeObjective(t);
    DT.inbox({ title: `Bienvenido a ${t.n}`, body: `Firmaste como nuevo DT. Objetivo: ${G.manager.obj.text}`, kind: 'board' });
  };

  // Evaluación de fin de temporada (antes de ascensos/descensos).
  B.seasonEnd = function (finalPos, relegated, promoted) {
    const G = DT.G;
    const M = G.manager;
    const t = DT.userTeam();
    const o = M.obj;
    let msg;
    if (relegated) {
      M.conf = 0;
      msg = `${t.n} descendió. La directiva te despide.`;
    } else if (promoted) {
      M.conf = Math.min(100, M.conf + 35);
      M.rep = Math.min(100, M.rep + 6);
      msg = `¡Ascenso! ${t.n} terminó ${finalPos}º y vuelve a jugar en ${DT.COUNTRIES[t.cc].league}. La directiva está feliz.`;
    } else if (o && finalPos <= o.target) {
      M.conf = Math.min(100, M.conf + 25);
      M.rep = Math.min(100, M.rep + (finalPos < o.target ? 4 : 2));
      msg = `Objetivo cumplido: terminaste ${finalPos}º. La directiva está muy conforme.`;
      if (t.sponsor && t.sponsor.kind === 'objetivo' && t.sponsor.bonus) {
        DT.E.add(t, 'Sponsors', t.sponsor.bonus);
        msg += ` ${t.sponsor.name} pagó el premio por objetivo (${U.money(t.sponsor.bonus)}).`;
      }
    } else {
      const miss = finalPos - (o ? o.target : finalPos);
      const titles = M.titles.filter((x) => x.y === G.year).length;
      M.conf = Math.max(0, M.conf - (titles ? 8 : 18 + miss * 3));
      M.rep = Math.max(20, M.rep - (titles ? 0 : 2));
      msg = `No se cumplió el objetivo (terminaste ${finalPos}º).${titles ? ' Los títulos conseguidos suavizan la evaluación.' : ''}`;
    }
    M.career.push({ club: t.n, y: G.year, pos: finalPos, conf: Math.round(M.conf) });
    DT.inbox({ title: 'Evaluación de la temporada', body: msg + ` Confianza: ${Math.round(M.conf)}/100.`, kind: 'board' });
    if (relegated || M.conf < 22) {
      B.fire(relegated ? 'El equipo descendió y la directiva decidió cambiar de entrenador.' : 'La directiva decidió no renovar tu ciclo.');
      return;
    }
    // Ofertas de clubes más grandes si el DT está en alza.
    if (M.rep > t.rep - 4 && U.chance(0.6)) {
      const offers = B.jobOffers(t.id, false).filter((id) => G.teams[id].rep > t.rep);
      if (offers.length) {
        DT.inbox({
          title: 'Te quieren otros clubes',
          body: 'Tu trabajo llamó la atención. Podés aceptar una propuesta o seguir en tu club.',
          kind: 'board',
          actions: offers.map((id) => ({ id: 'job', tid: id, label: `Aceptar oferta de ${G.teams[id].n}`, sub: `Reputación ${G.teams[id].rep} · ${DT.COUNTRIES[G.teams[id].cc].name}` })).concat([{ id: 'stay', label: `Quedarme en ${t.n}` }]),
        });
      }
    }
  };

  return B;
})();
