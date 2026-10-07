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
    const T = M.buyTension(pid);
    const club = G.teams[p.t].n;
    if (T.lock) return { res: 'reject', msg: `${club} está ofendido y no negocia hasta la semana ${T.until}.`, tension: 100 };
    const ask = M.askingPrice(p);
    const ratio = amount / ask;
    if (ratio >= 1 || (ratio >= 0.9 && U.chance(0.5 - T.v / 400))) return { res: 'accept', fee: amount, tension: T.v };
    // la tensión crece cada vez más rápido cuanto más baja es la oferta
    T.v = Math.min(100, T.v + 6 + 220 * Math.pow(Math.max(0, 1 - ratio), 1.6));
    if (T.v >= 100) {
      T.until = G.week + 4;
      return { res: 'reject', msg: `${club} se cansó de las ofertas bajas y corta la negociación por 4 semanas.`, tension: 100 };
    }
    const counter = U.round(Math.max(amount * 1.05, ask * U.rf(0.98, 1.06) * (1 + T.v / 500)), 10000);
    return { res: 'counter', fee: counter, msg: `${club} pide ${U.money(counter)}.`, tension: T.v };
  };
  // Tensión de la negociación por un jugador ajeno (baja con el paso de las semanas).
  M.buyTension = function (pid) {
    const G = DT.G;
    G.buyT = G.buyT || {};
    const now = G.year * 100 + G.week;
    let T = G.buyT[pid];
    if (!T || T.y !== G.year) T = G.buyT[pid] = { v: 0, w: now, y: G.year, until: 0 };
    if (now > T.w) { T.v = Math.max(0, T.v - 15 * (now - T.w)); T.w = now; }
    T.lock = T.until && G.week < T.until;
    if (!T.lock && T.until) { T.until = 0; T.v = 40; }
    return T;
  };

  // Negociación de contrato con el jugador.
  M.contractTalk = function (pid, wage, years, clauseK) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    const d = DT.P.demand(p, me);
    d.w = U.round(d.w * M.clauseOpt(clauseK).wage, 1000);
    if (p.t && p.t !== me.id) {
      G.willing = G.willing || {};
      if (G.willing[pid] === undefined) G.willing[pid] = DT.P.willingToJoin(p, me);
      if (!G.willing[pid]) return { res: 'reject', msg: `${p.n} no quiere jugar en ${me.n}.` };
    }
    const payroll = DT.E.payroll(me) - (p.t === me.id ? p.w : 0);
    if (payroll + wage > DT.E.wageCap(me)) return { res: 'board', msg: `La masa salarial quedaría en ${U.money(payroll + wage)} y el tope es ${U.money(DT.E.wageCap(me))}. Liberá sueldos (vendé, cedé o rescindí) o pedile a la directiva que amplíe el tope.` };
    const r = wage / d.w;
    if (r >= 1 || (r >= 0.92 && U.chance(0.6))) return { res: 'accept', wage, years };
    return { res: 'counter', w: d.w, years: d.years, msg: `${p.n} pide ${U.money(d.w)} por año.` };
  };

  M.completeSigning = function (pid, fee, wage, years, clauseK, byClause) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    const seller = p.t ? G.teams[p.t] : null;
    if (fee) {
      DT.E.add(me, 'Fichajes', -fee);
      if (seller) DT.E.add(seller, 'Venta de jugadores', fee);
      if (seller) M.settleSellOn(p, fee, seller);
    }
    DT.AI.addToTeam(me, p, wage, years);
    p.cl = M.clauseAmount(p, clauseK);
    p.mor = 80;
    if (DT.Ach) {
      if (fee >= 5e6) DT.Ach.unlock('fichaje');
      if (byClause) DT.Ach.unlock('clausula');
    }
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
    M.settleSellOn(p, fee, me);
    if (DT.Ach && fee >= 10e6) DT.Ach.unlock('venta');
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

  // ---------- Cláusulas de rescisión ----------
  // Opciones al firmar o renovar: más baja = el jugador acepta cobrar menos.
  M.CLAUSES = [
    { k: 'low', label: 'Baja', mult: 1.5, wage: 0.95 },
    { k: 'mid', label: 'Media', mult: 2.5, wage: 1 },
    { k: 'high', label: 'Alta', mult: 4, wage: 1.06 },
    { k: 'none', label: 'Sin cláusula', mult: 0, wage: 1.1 },
  ];
  M.clauseOpt = (k) => M.CLAUSES.find((c) => c.k === k) || M.CLAUSES[1];
  M.clauseAmount = (p, k) => { const o = M.clauseOpt(k); return o.mult ? U.round(DT.P.value(p) * o.mult, 50000) : 0; };
  // Cláusula vigente (0 = sin cláusula). Los jugadores de partidas anteriores reciben una al consultarla.
  M.clause = function (p) {
    if (!p || !p.t || p.acad) return 0;
    if (p.cl === undefined) p.cl = U.chance(0.85) ? U.round(DT.P.value(p) * U.rf(1.8, 4), 50000) : 0;
    return p.cl;
  };

  // Renovación de contrato del usuario. Los jóvenes piden aumento casi siempre;
  // los veteranos pueden aceptar bajarse el sueldo (más probable cuanto más grandes).
  M.renewDemand = function (p, clauseK) {
    const G = DT.G;
    const me = DT.userTeam();
    const fair = DT.P.fairWage(p, me.cc);
    const avg = DT.P.avgRating(p);
    const perf = p.st.pj >= 5 ? U.clamp(1 + (avg - 6.6) * 0.12, 0.9, 1.2) : 1;
    const mood = 0.95 + (100 - p.mor) / 600;
    G.renewMood = G.renewMood || {};
    const key = G.year + '_' + p.id;
    if (G.renewMood[key] === undefined) G.renewMood[key] = Math.round(Math.random() * 1000) / 1000;
    const roll = G.renewMood[key];
    const cutChance = p.age >= 30 ? U.clamp((p.age - 29) * 0.13, 0, 0.75) : 0;
    let w, cut = false;
    if (roll < cutChance) {
      w = Math.min(p.w * 0.97, Math.max(fair * perf * 0.95, p.w * (0.7 + roll * 0.3)));
      cut = true;
    } else {
      const raise = p.age >= 30 ? 1.02 + (1 - roll) * 0.06 : 1.08 + roll * 0.14;
      w = Math.max(fair * perf * mood, p.w * raise);
    }
    w *= M.clauseOpt(clauseK || 'mid').wage;
    const years = p.age >= 33 ? 1 : p.age >= 30 ? (roll < 0.5 ? 1 : 2) : p.age >= 27 ? 2 + (roll < 0.5 ? 0 : 1) : 3 + Math.floor(roll * 2.99);
    return { w: U.round(w, 1000), years, cut };
  };
  M.renew = function (pid, wage, years, clauseK) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    if (p.mor < 30) return { res: 'reject', msg: `${p.n} está disconforme y no quiere renovar.` };
    G.renewTries = G.renewTries || {};
    const key = G.year + '_' + pid;
    G.renewTries[key] = (G.renewTries[key] || 0) + 1;
    if (G.renewTries[key] > 5) return { res: 'reject', msg: `${p.n} cortó las negociaciones por esta temporada.` };
    const d = M.renewDemand(p, clauseK);
    const payroll = DT.E.payroll(me) - p.w;
    // renovar sin subir el sueldo siempre está permitido
    if (wage > p.w && payroll + wage > DT.E.wageCap(me)) return { res: 'board', msg: `Ese sueldo supera el tope salarial (${U.money(DT.E.wageCap(me))}). Ofrecé lo mismo que cobra hoy, liberá sueldos o pedile a la directiva que amplíe el tope.` };
    if (wage >= d.w || (wage >= d.w * 0.95 && U.chance(0.5))) {
      p.w = wage;
      p.cy = years;
      p.cl = M.clauseAmount(p, clauseK);
      p.mor = Math.min(100, p.mor + 8);
      return { res: 'accept' };
    }
    return { res: 'counter', w: d.w, years: d.years, msg: `${p.n} pide ${U.money(d.w)} por año${d.cut ? ' (acepta cobrar menos que hoy para seguir en el club)' : ''}.` };
  };

  // ---------- Futura venta ----------
  // Si el jugador tiene un % de futura venta a favor de otro club, se le paga.
  M.settleSellOn = function (p, fee, sellerTeam) {
    const so = p.sellOn;
    if (!so) return;
    delete p.sellOn;
    if (!sellerTeam || so.tid === sellerTeam.id) return;
    const owner = DT.G.teams[so.tid];
    if (!owner) return;
    const amt = Math.round(fee * so.pct);
    DT.E.add(sellerTeam, 'Fichajes', -amt);
    DT.E.add(owner, 'Venta de jugadores', amt);
    if (DT.isUser(owner.id)) DT.inbox({ title: 'Cobraste un porcentaje de futura venta', body: `${p.n} fue transferido por ${U.money(fee)} y te corresponde el ${Math.round(so.pct * 100)}%: ${U.money(amt)}.`, kind: 'money' });
  };

  // ---------- Ojeadores ----------
  M.scoutCost = (t) => U.round(20000 * (0.3 + DT.E.W(t)), 1000);
  M.known = function (p) {
    const G = DT.G;
    return !p.t || DT.isUser(p.t) || (p.loan && p.loan.from === G.user) || !!(G.scouted && G.scouted[p.id]);
  };
  M.scout = function (pid) {
    const G = DT.G;
    const me = DT.userTeam();
    const cost = M.scoutCost(me);
    if (me.cash < cost) return { ok: false, msg: 'No hay caja para pagar el viaje del ojeador.' };
    DT.E.add(me, 'Staff', -cost);
    G.scouted = G.scouted || {};
    G.scouted[pid] = G.year;
    const p = G.players[pid];
    const gap = p.pot - p.ovr;
    const txt = gap >= 15 ? 'Tiene condiciones de crack: puede crecer muchísimo.' : gap >= 8 ? 'Tiene buen margen de mejora.' : gap >= 3 ? 'Puede mejorar un poco más.' : 'Está en su techo: lo que ves es lo que hay.';
    return { ok: true, msg: `Informe del ojeador sobre ${p.n}: ${txt} Techo estimado: media ${Math.max(p.ovr, p.pot - 1)}–${p.pot + 1}.` };
  };

  // ---------- Préstamos de jugadores ----------
  // Ofertas de clubes para llevarse a préstamo a un jugador del usuario.
  M.loanOutOffers = function (pid) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    const cands = Object.values(G.teams).filter((t) => DT.inLeague(t) && !t.eur && t.id !== me.id && t.rep <= me.rep + 4 && t.squad.length < 32 && DT.W.teamLevel(t) <= p.ovr + 6 && t.cash > p.w * 0.5);
    U.shuffle(cands);
    return cands.slice(0, 3).map((t) => ({ tid: t.id, fee: U.round(DT.P.value(p) * U.rf(0, 0.06), 5000), starter: DT.W.teamLevel(t) <= p.ovr + 1 }));
  };
  M.loanOut = function (pid, tid, fee) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    const t = G.teams[tid];
    if (!DT.S.windowOpen()) return { ok: false, msg: 'El libro de pases está cerrado.' };
    if (me.squad.length <= 18) return { ok: false, msg: 'Te quedarías con muy pocos jugadores.' };
    DT.AI.release(me, p);
    p.t = t.id;
    p.num = null;
    p.loan = { from: me.id, y: G.year };
    t.squad.push(p.id);
    if (fee) { DT.E.add(me, 'Venta de jugadores', fee); DT.E.add(t, 'Fichajes', -fee); }
    DT.news(`${me.n} cedió a ${p.n} a ${t.n} hasta fin de temporada.`, 'transfer');
    return { ok: true, msg: `${p.n} se va a préstamo a ${t.n}. ${t.n} paga su sueldo y vuelve a fin de temporada.` };
  };
  // Pedido del usuario para traer a préstamo a un jugador de otro club.
  M.loanInFee = (p) => U.round(DT.P.value(p) * 0.08, 5000);
  M.loanIn = function (pid) {
    const G = DT.G;
    const p = G.players[pid];
    const me = DT.userTeam();
    const owner = G.teams[p.t];
    if (!DT.S.windowOpen()) return { ok: false, msg: 'El libro de pases está cerrado.' };
    if (p.loan) return { ok: false, msg: 'Ese jugador ya está cedido.' };
    if (owner.squad.length <= 20) return { ok: false, msg: `${owner.n} tiene el plantel corto y no cede jugadores.` };
    if (M.importance(p) >= 1.25 && p.age > 21) return { ok: false, msg: `${owner.n} no cede a un titular.` };
    if (!DT.P.willingToJoin(p, me)) return { ok: false, msg: `${p.n} no quiere ir a préstamo a ${me.n}.` };
    const fee = M.loanInFee(p);
    if (fee > M.budget(me)) return { ok: false, msg: `El préstamo cuesta ${U.money(fee)} y no tenés presupuesto.` };
    if (DT.E.payroll(me) + p.w > DT.E.wageCap(me)) return { ok: false, msg: `Su sueldo (${U.money(p.w)}) supera el tope salarial. Liberá sueldos o pedí más tope a la directiva.` };
    if (me.squad.length >= 34) return { ok: false, msg: 'El plantel está lleno.' };
    DT.AI.release(owner, p);
    p.t = me.id;
    p.num = null;
    p.loan = { from: owner.id, y: G.year };
    me.squad.push(p.id);
    if (fee) { DT.E.add(me, 'Fichajes', -fee); DT.E.add(owner, 'Venta de jugadores', fee); }
    DT.news(`${me.n} recibió a préstamo a ${p.n} (${owner.n}).`, 'transfer');
    return { ok: true, msg: `${p.n} llega a préstamo hasta fin de temporada. Pagaste ${U.money(fee)} y te hacés cargo del sueldo.` };
  };
  // Fin de temporada: los cedidos vuelven a su club.
  M.returnLoans = function () {
    const G = DT.G;
    for (const pid in G.players) {
      const p = G.players[pid];
      if (!p.loan) continue;
      const owner = G.teams[p.loan.from];
      const cur = p.t ? G.teams[p.t] : null;
      if (cur) DT.AI.release(cur, p);
      delete p.loan;
      if (owner) {
        p.t = owner.id;
        p.num = null;
        owner.squad.push(p.id);
        if (DT.isUser(owner.id)) DT.news(`${p.n} volvió de su préstamo en ${cur ? cur.n : 'otro club'}.`, 'squad');
      }
    }
  };

  // ---------- IA ----------
  const isForeignTarget = (p) => (p.age <= 23 && p.ovr >= 72) || (p.age <= 26 && p.ovr >= 77) || (p.age <= 29 && p.ovr >= 81);

  M.weekly = function () {
    const G = DT.G;
    if (!DT.S.windowOpen()) {
      if (G.week === 5 || G.week === 27) M.windowClose();
      return;
    }
    const teams = Object.values(G.teams).filter((t) => !t.eur && DT.inLeague(t));
    // Ventas al exterior
    for (const t of teams) {
      if (DT.isUser(t.id)) continue;
      for (const pid of t.squad.slice()) {
        const p = G.players[pid];
        if (p.loan || !isForeignTarget(p) || !U.chance(p.sellOn ? 0.05 : 0.022)) continue;
        const fee = U.round(DT.P.value(p) * U.rf(0.9, 1.4), 50000);
        const club = U.pick(DT.FOREIGN_BUYERS);
        DT.E.add(t, 'Venta de jugadores', fee);
        M.settleSellOn(p, fee, t);
        DT.AI.release(t, p);
        p.from = t.n;
        M.goAbroad(p, fee, club);
        if (p.ovr >= 76 || fee >= 8e6) DT.news(`${club} compró a ${p.n} (${t.n}) por ${U.money(fee)}.`, 'world');
      }
    }
    // Pases entre clubes sudamericanos
    for (let k = 0; k < 14; k++) M.aiTransfer(teams);
    // Ofertas por jugadores del usuario y cláusulas pagadas
    M.expireOffers(false);
    M.offersForUser();
    M.clauseRaids();
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
      const cands = s.squad.map((id) => G.players[id]).filter((p) => !p.loan && p.pos === need && p.ovr >= L + 1 && p.ovr <= L + 9 && p.age <= 31);
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
      M.settleSellOn(p, fee, s);
      DT.AI.addToTeam(buyer, p, Math.max(p.w, DT.P.fairWage(p, buyer.cc)), U.ri(2, 4));
      if (fee >= 3e6 || p.real) DT.news(`${buyer.n} se reforzó con ${p.n} (ex ${s.n}) por ${U.money(fee)}.`, 'transfer');
      DT.AI.trimSquad(buyer, 31);
      return;
    }
  };

  // ---------- Ofertas recibidas por jugadores del usuario ----------
  // Quedan en Mercado → Mis ventas: se aceptan de una o se negocian con una tensión que crece
  // de forma exponencial cuanto más te alejás de lo que el club está dispuesto a pagar.
  M.makeUserOffer = function (p, buyer, fee) {
    const G = DT.G;
    G.offers = G.offers || [];
    if (G.offers.some((o) => o.pid === p.id && o.st === 'open')) return;
    const name = buyer ? buyer.n : U.pick(DT.FOREIGN_BUYERS);
    const o = { id: (G.nextOffer = (G.nextOffer || 0) + 1), pid: p.id, buyer: buyer ? buyer.id : null, name, fee, max: U.round(fee * U.rf(1.1, 1.45), 10000), t: 0, st: 'open', y: G.year, w: G.week, r: 0, log: [] };
    G.offers.unshift(o);
    if (G.offers.length > 30) G.offers.length = 30;
    DT.inbox({ title: `Oferta por ${p.n}`, body: `${name} ofrece ${U.money(fee)} por ${p.n} (${U.posName[p.pos]}, ${p.age} años, media ${p.ovr}). Respondé desde Mercado → Mis ventas.`, kind: 'transfer' });
    G.notices = (G.notices || []).concat([{ kind: 'offer', oid: o.id }]);
  };
  M.openOffers = () => (DT.G.offers || []).filter((o) => o.st === 'open' && DT.G.players[o.pid] && DT.G.players[o.pid].t === DT.G.user);
  M.getOffer = (oid) => (DT.G.offers || []).find((o) => o.id === oid);
  const offerMax = (o, sellOn) => o.max * (sellOn ? 0.88 : 1);
  M.offerAccept = function (oid, sellOn) {
    const G = DT.G;
    const o = M.getOffer(oid);
    if (!o || o.st !== 'open') return { ok: false, msg: 'La oferta ya no está vigente.' };
    const p = G.players[o.pid];
    if (!p || p.t !== G.user) { o.st = 'gone'; return { ok: false, msg: 'El jugador ya no está en el club.' }; }
    if (!DT.S.windowOpen()) return { ok: false, msg: 'El libro de pases está cerrado.' };
    M.sellUser(o.pid, o.buyer, o.fee, o.name);
    if (sellOn && o.buyer) p.sellOn = { tid: G.user, pct: 0.2 };
    o.st = 'done';
    return { ok: true, msg: `Vendiste a ${p.n} a ${o.name} por ${U.money(o.fee)}${sellOn && o.buyer ? ' y te quedás con el 20% de una futura venta' : ''}.` };
  };
  M.offerReject = function (oid) {
    const o = M.getOffer(oid);
    if (!o || o.st !== 'open') return;
    o.st = 'rejected';
    const p = DT.G.players[o.pid];
    if (p && o.fee > DT.P.value(p) * 1.2 && p.ovr >= 70) p.mor = Math.max(10, p.mor - 12);
  };
  // Contrapropuesta del usuario: pide `ask`, opcionalmente con 20% de futura venta.
  M.offerCounter = function (oid, ask, sellOn) {
    const G = DT.G;
    const o = M.getOffer(oid);
    if (!o || o.st !== 'open') return { res: 'gone', msg: 'La oferta ya no está vigente.' };
    const mx = offerMax(o, sellOn && o.buyer);
    o.r++;
    if (ask <= o.fee) return { res: 'accept', fee: o.fee, msg: `${o.name} mantiene ${U.money(o.fee)}.` };
    if (ask <= mx) {
      o.fee = ask;
      o.log.unshift(`Aceptan ${U.money(ask)}.`);
      return { res: 'accept', fee: ask, msg: `${o.name} acepta pagar ${U.money(ask)}.` };
    }
    const gap = ask / mx - 1;
    o.t = Math.min(100, o.t + 8 + 240 * Math.pow(gap, 1.5));
    if (o.t >= 100) {
      o.st = 'walked';
      o.log.unshift('Se retiraron.');
      return { res: 'walk', msg: `${o.name} se levantó de la mesa: la negociación terminó.` };
    }
    const next = U.round(Math.min(mx, o.fee + (ask - o.fee) * U.rf(0.25, 0.5)), 10000);
    if (next > o.fee) o.fee = next;
    const msg = o.r >= 5 ? `${o.name}: "${U.money(o.fee)} es nuestra última oferta."` : `${o.name} sube a ${U.money(o.fee)}.`;
    o.log.unshift(msg);
    return { res: 'counter', fee: o.fee, msg };
  };
  // Ofertas que vencen: dos semanas sin respuesta o el cierre del libro de pases.
  M.expireOffers = function (all) {
    const G = DT.G;
    for (const o of G.offers || []) {
      if (o.st !== 'open') continue;
      if (all || G.year * 100 + G.week - (o.y * 100 + o.w) >= 3) o.st = 'expired';
    }
  };

  // Clubes que pagan la cláusula de un jugador del usuario (no se puede negar).
  M.clauseRaids = function () {
    const G = DT.G;
    const me = DT.userTeam();
    for (const pid of me.squad.slice()) {
      const p = G.players[pid];
      if (!p || p.loan) continue;
      const cl = M.clause(p);
      if (!cl) continue;
      const v = DT.P.value(p);
      let chance = 0;
      if (cl <= v * 1.4) chance = 0.03;
      else if (cl <= v * 2.2 && isForeignTarget(p)) chance = 0.008;
      if (!U.chance(chance)) continue;
      const buyers = Object.values(G.teams).filter((t) => DT.inLeague(t) && !t.eur && t.id !== me.id && t.cash > cl * 1.1 && t.rep >= me.rep - 8);
      const foreign = isForeignTarget(p) || !buyers.length;
      const b = foreign ? null : U.pick(buyers);
      const name = b ? b.n : U.pick(DT.FOREIGN_BUYERS);
      if (b) M.sellUser(pid, b.id, cl, name);
      else { DT.E.add(me, 'Venta de jugadores', cl); M.settleSellOn(p, cl, me); DT.AI.release(me, p); p.from = me.n; M.goAbroad(p, cl, name); }
      const body = `${name} pagó la cláusula de rescisión de ${p.n} (${U.money(cl)}) y se lo lleva. No se puede negar: la plata ya está en la caja.`;
      DT.inbox({ title: `Pagaron la cláusula de ${p.n}`, body, kind: 'money' });
      G.notices = (G.notices || []).concat([{ kind: 'msg', title: `Pagaron la cláusula de ${p.n}`, body }]);
      return;
    }
  };

  M.offersForUser = function () {
    const G = DT.G;
    const me = DT.userTeam();
    const pending = M.openOffers().length;
    if (pending >= 3) return;
    for (const pid of me.squad) {
      const p = G.players[pid];
      if (p.loan) continue;
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
      const cands = t.squad.map((id) => G.players[id]).filter((p) => !p.loan && c[p.pos] > (p.pos === 'P' ? 2 : 5)).sort((a, b) => DT.P.value(b) - DT.P.value(a));
      const p = cands[U.ri(0, Math.min(2, cands.length - 1))];
      if (!p) break;
      const fee = U.round(DT.P.value(p) * U.rf(0.8, 1.05), 10000);
      const club = U.pick(DT.FOREIGN_BUYERS);
      DT.E.add(t, 'Venta de jugadores', fee);
      M.settleSellOn(p, fee, t);
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
    M.expireOffers(true);
  };

  return M;
})();
