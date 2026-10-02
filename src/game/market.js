// Mercado de pases: compras, ventas, renovaciones y movimientos de la IA.
DT.M = (function () {
  const U = DT.U;
  const M = {};

  M.importance = function (p) {
    const G = DT.G;
    const team = G.teams[p.t];
    if (!team) return 1;
    const sorted = team.squad.map((id) => G.players[id]).sort((a, b) => b.ovr - a.ovr);
    const idx = sorted.findIndex((x) => x.id === p.id);
    return idx < 3 ? 1.5 : idx < 11 ? 1.25 : idx < 18 ? 1.05 : 0.85;
  };

  M.askingPrice = function (p) {
    if (!p.t) return 0;
    const G = DT.G;
    const team = G.teams[p.t];
    let v = DT.P.value(p) * M.importance(p);
    if (p.cy <= 1) v *= 0.7;
    if (p.lst) v *= 0.85;
    const rev = DT.E.estimateRevenue(team);
    if (team.cash > rev * 0.3) v *= 1.1;
    else if (team.cash < 0) v *= 0.85;
    return U.round(v, v > 1e6 ? 50000 : 5000);
  };

  M.reserve = (t) => DT.E.payroll(t) / 46 * 4;
  M.budget = (t) => Math.max(0, Math.round(t.cash - M.reserve(t)));

  // Oferta del usuario por un jugador de otro club.
  M.offer = function (pid, amount) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    if (!p || p.t === me.id) return { res: 'error', msg: 'Jugador no válido.' };
    if (!p.t) return { res: 'free' };
    if (!DT.S.windowOpen()) return { res: 'error', msg: 'El libro de pases está cerrado. Abre en las semanas 0–4 y 21–26.' };
    if (amount > M.budget(me)) return { res: 'error', msg: `La directiva no autoriza gastar más de ${U.money(M.budget(me))} (caja menos reserva para sueldos).` };
    G.offersMade = G.offersMade || {};
    const key = G.year + '_' + G.week + '_' + pid;
    G.offersMade[key] = (G.offersMade[key] || 0) + 1;
    if (G.offersMade[key] > 3) return { res: 'reject', msg: 'El club se cansó de las ofertas y no negocia más esta semana.' };
    const ask = M.askingPrice(p);
    const ratio = amount / ask;
    if (ratio >= 1 || (ratio >= 0.88 && U.chance(0.5))) return { res: 'accept', fee: amount };
    if (ratio >= 0.6) {
      const counter = U.round(Math.max(amount * 1.05, ask * U.rf(0.96, 1.06)), 10000);
      return { res: 'counter', fee: counter, msg: `${G.teams[p.t].n} pide ${U.money(counter)}.` };
    }
    return { res: 'reject', msg: `${G.teams[p.t].n} rechazó la oferta: la considera muy baja.` };
  };

  // Negociación de contrato con el jugador.
  M.contractTalk = function (pid, wage, years) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    const d = DT.P.demand(p, me);
    if (p.t && p.t !== me.id) {
      G.willing = G.willing || {};
      if (G.willing[pid] === undefined) G.willing[pid] = DT.P.willingToJoin(p, me);
      if (!G.willing[pid]) return { res: 'reject', msg: `${p.n} no quiere jugar en ${me.n}.` };
    }
    const payroll = DT.E.payroll(me) - (p.t === me.id ? p.w : 0);
    if (payroll + wage > DT.E.wageCap(me) * 1.05) return { res: 'board', msg: `La directiva no aprueba: la masa salarial superaría el tope de ${U.money(DT.E.wageCap(me))} anuales.` };
    const r = wage / d.w;
    if (r >= 1 || (r >= 0.92 && U.chance(0.6))) return { res: 'accept', wage, years };
    return { res: 'counter', w: d.w, years: d.years, msg: `${p.n} pide ${U.money(d.w)} por año.` };
  };

  M.completeSigning = function (pid, fee, wage, years) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    const seller = p.t ? G.teams[p.t] : null;
    if (fee) {
      DT.E.add(me, 'Fichajes', -fee);
      if (seller) DT.E.add(seller, 'Venta de jugadores', fee);
    }
    DT.AI.addToTeam(me, p, wage, years);
    p.mor = 80;
    DT.news(`${me.n} incorporó a ${p.n}${seller ? ` desde ${seller.n}` : ' (libre)'}${fee ? ` por ${U.money(fee)}` : ''}.`, 'transfer');
    if (seller) DT.AI.ensureSquad(seller);
  };

  // Venta de un jugador del usuario a otro club.
  M.sellUser = function (pid, buyerId, fee, buyerName) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    if (!p || p.t !== me.id) return false;
    DT.E.add(me, 'Venta de jugadores', fee);
    if (buyerId && G.teams[buyerId]) {
      const b = G.teams[buyerId];
      DT.E.add(b, 'Fichajes', -fee);
      DT.AI.addToTeam(b, p, Math.max(p.w, DT.P.fairWage(p, b.cc)), U.ri(2, 4));
      DT.news(`${me.n} vendió a ${p.n} a ${b.n} por ${U.money(fee)}.`, 'transfer');
    } else {
      DT.AI.release(me, p);
      p.from = me.n;
      M.goAbroad(p, fee, buyerName || 'el exterior');
      DT.news(`${me.n} vendió a ${p.n} a ${buyerName || 'el exterior'} por ${U.money(fee)}.`, 'transfer');
    }
    return true;
  };

  M.goAbroad = function (p, fee, club) {
    const G = DT.G;
    G.abroad.unshift({ n: p.n, y: G.year, club, fee, from: p.from || '' });
    if (G.abroad.length > 60) G.abroad.length = 60;
    delete G.players[p.id];
  };

  // Rescindir contrato: se paga la mitad de lo que resta.
  M.releaseCost = (p) => Math.round(p.w * Math.max(1, p.cy) * 0.5);
  M.releaseUser = function (pid) {
    const me = DT.userTeam();
    const p = DT.G.players[pid];
    const cost = M.releaseCost(p);
    DT.E.add(me, 'Sueldos', -cost);
    DT.AI.release(me, p);
    DT.news(`${me.n} rescindió el contrato de ${p.n}.`, 'transfer');
  };

  // Renovación de contrato del usuario.
  M.renewDemand = function (p) {
    const me = DT.userTeam();
    const d = DT.P.demand(p, me);
    d.w = Math.max(d.w, U.round(p.w * 1.05, 1000));
    return d;
  };
  M.renew = function (pid, wage, years) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    if (p.mor < 30) return { res: 'reject', msg: `${p.n} está disconforme y no quiere renovar.` };
    G.renewTries = G.renewTries || {};
    const key = G.year + '_' + pid;
    G.renewTries[key] = (G.renewTries[key] || 0) + 1;
    if (G.renewTries[key] > 4) return { res: 'reject', msg: `${p.n} cortó las negociaciones por esta temporada.` };
    const d = M.renewDemand(p);
    const payroll = DT.E.payroll(me) - p.w;
    if (payroll + wage > DT.E.wageCap(me) * 1.05) return { res: 'board', msg: 'La directiva no aprueba ese sueldo: se supera el tope salarial.' };
    if (wage >= d.w || (wage >= d.w * 0.93 && U.chance(0.5))) {
      p.w = wage;
      p.cy = years;
      p.mor = Math.min(100, p.mor + 8);
      return { res: 'accept' };
    }
    return { res: 'counter', w: d.w, years: d.years, msg: `${p.n} pide ${U.money(d.w)} por año durante ${d.years} años.` };
  };

  // ---------- IA ----------
  const isForeignTarget = (p) => (p.age <= 23 && p.ovr >= 72) || (p.age <= 26 && p.ovr >= 77) || (p.age <= 29 && p.ovr >= 81);

  M.weekly = function () {
    const G = DT.G;
    if (!DT.S.windowOpen()) {
      if (G.week === 5 || G.week === 27) M.windowClose();
      return;
    }
    const teams = Object.values(G.teams).filter((t) => !t.eur && t.lg);
    // Ventas al exterior
    for (const t of teams) {
      if (DT.isUser(t.id)) continue;
      for (const pid of t.squad.slice()) {
        const p = G.players[pid];
        if (!isForeignTarget(p) || !U.chance(0.022)) continue;
        const fee = U.round(DT.P.value(p) * U.rf(0.9, 1.4), 50000);
        const club = U.pick(DT.FOREIGN_BUYERS);
        DT.E.add(t, 'Venta de jugadores', fee);
        DT.AI.release(t, p);
        p.from = t.n;
        M.goAbroad(p, fee, club);
        if (p.ovr >= 76 || fee >= 8e6) DT.news(`${club} compró a ${p.n} (${t.n}) por ${U.money(fee)}.`, 'world');
      }
    }
    // Pases entre clubes sudamericanos
    for (let k = 0; k < 14; k++) M.aiTransfer(teams);
    // Ofertas por jugadores del usuario
    M.offersForUser();
  };

  M.aiTransfer = function (teams) {
    const G = DT.G;
    const buyer = U.pick(teams);
    if (DT.isUser(buyer.id)) return;
    const budget = buyer.cash * 0.45;
    if (budget < 100000) return;
    const L = DT.W.teamLevel(buyer);
    const counts = DT.AI.countPos(buyer);
    const need = U.weighted(['P', 'D', 'M', 'A'], [counts.P < 3 ? 2 : 0.3, Math.max(0.3, 9 - counts.D), Math.max(0.3, 9 - counts.M), Math.max(0.3, 7 - counts.A)]);
    // candidatos: de clubes de igual o menor reputación
    const sellers = teams.filter((t) => t.id !== buyer.id && t.rep <= buyer.rep + 3);
    for (let tries = 0; tries < 6; tries++) {
      const s = U.pick(sellers);
      if (!s) return;
      const cands = s.squad.map((id) => G.players[id]).filter((p) => p.pos === need && p.ovr >= L + 1 && p.ovr <= L + 9 && p.age <= 31);
      if (!cands.length) continue;
      const p = U.pick(cands);
      const fee = M.askingPrice(p);
      if (fee > budget) continue;
      if (!DT.P.willingToJoin(p, buyer)) continue;
      if (DT.isUser(s.id)) {
        M.makeUserOffer(p, buyer, U.round(fee * U.rf(0.8, 1.05), 10000));
        return;
      }
      if (s.squad.length <= 18) continue;
      DT.E.add(buyer, 'Fichajes', -fee);
      DT.E.add(s, 'Venta de jugadores', fee);
      DT.AI.addToTeam(buyer, p, Math.max(p.w, DT.P.fairWage(p, buyer.cc)), U.ri(2, 4));
      if (fee >= 3e6 || p.real) DT.news(`${buyer.n} se reforzó con ${p.n} (ex ${s.n}) por ${U.money(fee)}.`, 'transfer');
      DT.AI.trimSquad(buyer, 31);
      return;
    }
  };

  M.makeUserOffer = function (p, buyer, fee) {
    const G = DT.G;
    if (G.inbox.some((m) => m.data && m.data.pid === p.id && !m.done)) return;
    const name = buyer ? buyer.n : U.pick(DT.FOREIGN_BUYERS);
    DT.inbox({
      title: `Oferta por ${p.n}`,
      body: `${name} ofrece ${U.money(fee)} por ${p.n} (${U.posName[p.pos]}, ${p.age} años, media ${p.ovr}). Valor estimado: ${U.money(DT.P.value(p))}.`,
      kind: 'transfer',
      actions: [
        { id: 'sell', label: `Aceptar ${U.money(fee)}` },
        { id: 'counter', label: `Pedir ${U.money(U.round(fee * 1.25, 10000))}` },
        { id: 'reject', label: 'Rechazar' },
      ],
      data: { pid: p.id, buyer: buyer ? buyer.id : null, buyerName: name, fee },
    });
  };

  M.offersForUser = function () {
    const G = DT.G;
    const me = DT.userTeam();
    const pending = G.inbox.filter((m) => m.kind === 'transfer' && m.actions && !m.done).length;
    if (pending >= 3) return;
    for (const pid of me.squad) {
      const p = G.players[pid];
      let prob = 0.004 + (p.lst ? 0.22 : 0);
      if (isForeignTarget(p)) prob += 0.05;
      if (!U.chance(prob)) continue;
      if (isForeignTarget(p) && U.chance(0.6)) {
        M.makeUserOffer(p, null, U.round(DT.P.value(p) * U.rf(p.lst ? 0.85 : 1, 1.5), 50000));
      } else {
        const buyers = Object.values(G.teams).filter((t) => t.lg && !t.eur && t.id !== me.id && t.cash > DT.P.value(p) * 0.8 && t.rep >= me.rep - 18);
        if (!buyers.length) continue;
        const b = U.pick(buyers);
        M.makeUserOffer(p, b, U.round(DT.P.value(p) * U.rf(p.lst ? 0.7 : 0.85, 1.2), 10000));
      }
      return;
    }
  };

  // La IA con deudas vende jugadores; si la crisis es grave, entra un rescate.
  M.aiFinance = function (t) {
    const G = DT.G;
    let sales = 0;
    while (t.cash < 0 && sales < 3 && t.squad.length > 20) {
      const c = DT.AI.countPos(t);
      const cands = t.squad.map((id) => G.players[id]).filter((p) => c[p.pos] > (p.pos === 'P' ? 2 : 5)).sort((a, b) => DT.P.value(b) - DT.P.value(a));
      const p = cands[U.ri(0, Math.min(2, cands.length - 1))];
      if (!p) break;
      const fee = U.round(DT.P.value(p) * U.rf(0.8, 1.05), 10000);
      const club = U.pick(DT.FOREIGN_BUYERS);
      DT.E.add(t, 'Venta de jugadores', fee);
      DT.AI.release(t, p);
      p.from = t.n;
      M.goAbroad(p, fee, club);
      sales++;
    }
    const rev = DT.E.estimateRevenue(t);
    if (t.cash < -rev * 0.4) {
      const inj = Math.round(-t.cash - rev * 0.1);
      t.cash += inj;
      t.rep = Math.max(45, t.rep - 1.5);
      DT.news(`${t.n} recibió un salvataje financiero de ${U.money(inj)} para evitar la quiebra.`, 'world');
    }
  };

  M.windowClose = function () {
    const G = DT.G;
    for (const id in G.teams) {
      const t = G.teams[id];
      if (t.eur || DT.isUser(id)) continue;
      M.aiFinance(t);
      DT.AI.ensureSquad(t);
      DT.AI.trimSquad(t, 31);
    }
    // ofertas pendientes vencen
    for (const m of G.inbox) if (m.kind === 'transfer' && m.actions && !m.done) { m.done = true; m.result = 'Vencida: se cerró el libro de pases.'; }
  };

  return M;
})();
