// Economía de los clubes: ingresos, gastos, sponsors, préstamos e infraestructura.
DT.E = (function () {
  const U = DT.U;
  const E = {};
  const WEEKS = 46;

  E.INC = ['Taquilla', 'Socios', 'TV', 'Sponsors', 'Merchandising', 'Premios', 'Venta de jugadores', 'Préstamos'];
  E.EXP = ['Sueldos', 'Staff', 'Mantenimiento', 'Obras', 'Fichajes', 'Viajes', 'Cuotas de préstamos'];
  E.SPONSORS = ['Banco del Sur', 'Andes Energía', 'TelcoSur', 'Pampa Seguros', 'Cóndor Air', 'Mate Cola', 'Atlas Motors', 'NovaPay', 'Litoral Foods', 'Cumbre Cervecería', 'Río Grande Petróleo', 'Pacífico Logística', 'Solaris Paneles', 'Kantu Textil', 'Altiplano Minera', 'Brisa Telecom', 'Ceibo Lácteos', 'Puma Neumáticos', 'Austral Bank', 'Tango Apps'];

  E.mi = (t) => Math.exp((t.rep - 50) / 10.5);
  E.W = (t) => DT.COUNTRIES[t.cc].wealth;

  E.tvAnnual = (t) => {
    const C = DT.COUNTRIES[t.cc];
    const base = C.tv * 1e6 * (0.3 + 0.35 * Math.pow(E.mi(t), 0.4));
    return t.lg ? base : base * 0.25; // fuera de primera cobra mucho menos
  };
  E.sponsorBase = (t) => U.round(0.45 * E.mi(t) * E.W(t) * 1e6 + 60000, 10000);
  E.merchAnnual = (t) => 0.3 * E.mi(t) * E.W(t) * 1e6 + 30000;
  E.socioBase = (t) => 1.92 * Math.exp(0.13 * t.rep) * DT.COUNTRIES[t.cc].smult + 300;
  E.refTicket = (t) => Math.round(DT.COUNTRIES[t.cc].ticket * (0.7 + t.rep / 150));

  E.payroll = (t) => U.sum(t.squad, (pid) => DT.G.players[pid].w);
  E.staffAnnual = (t) => {
    const lv = t.infra.train + t.infra.youth + t.infra.med;
    return (lv * 90000 + 150000) * (0.2 + E.W(t)) + E.baseRevenue(t) * 0.18;
  };
  E.upkeepAnnual = (t) => t.cap * 22 + (t.infra.train + t.infra.youth + t.infra.med) * 6000 * WEEKS * (0.2 + E.W(t)) / 3;

  // Ingresos estructurales (sin premios ni ventas), para gastos de administración.
  E.baseRevenue = (t) => E.tvAnnual(t) + E.sponsorBase(t) * 1.2 + E.socioBase(t) * DT.COUNTRIES[t.cc].socio * 12 + E.merchAnnual(t);

  E.estimateRevenue = function (t) {
    const sponsor = (t.sponsor ? t.sponsor.amt : E.sponsorBase(t)) / 1.35 * 1.2;
    const tickets = Math.min(t.cap, E.demandBase(t)) * E.refTicket(t) * 18 * 0.65;
    return E.tvAnnual(t) + sponsor * 1.35 + t.socios * t.fee * 12 + tickets + E.merchAnnual(t);
  };
  // Tope salarial: nunca por debajo de la masa salarial con la que arrancó la temporada,
  // y se puede ampliar negociando con la directiva.
  E.wageCap = (t) => U.round(Math.max(E.estimateRevenue(t) * 0.68, t.capBase || 0) * (1 + (t.capBonus || 0)), 100000);
  E.resetCap = function (t) {
    t.capBase = Math.round(E.payroll(t) * 1.03);
    t.capBonus = 0;
    t.capAsks = 0;
  };

  E.resetSeasonLedger = function (t) {
    t.fin.cur = { inc: {}, exp: {} };
  };
  E.add = function (t, cat, amt) {
    if (!amt) return;
    t.cash += amt;
    const L = t.fin.cur;
    if (!L) return;
    const bucket = amt >= 0 ? L.inc : L.exp;
    bucket[cat] = (bucket[cat] || 0) + Math.abs(amt);
  };
  E.totals = function (t) {
    const L = t.fin.cur;
    return { inc: U.sum(Object.values(L.inc)), exp: U.sum(Object.values(L.exp)) };
  };

  // Público potencial antes de precio/forma.
  E.demandBase = (t) => 3000 + t.socios * 0.5 + 9000 * Math.sqrt(E.mi(t)) * (0.5 + E.W(t) * 0.5);

  E.attendance = function (home, away, compType, stage) {
    let d = E.demandBase(home);
    const priceF = Math.pow(E.refTicket(home) / Math.max(1, home.ticket), 1.3);
    const pts = U.sum(home.form.slice(-5), (r) => (r === 'G' ? 3 : r === 'E' ? 1 : 0));
    const formF = 0.85 + 0.3 * (pts / 15);
    const oppF = 1 + ((away.rep || 60) - 60) / 150;
    let compF = 1;
    if (compType === 'cont') compF = 1.3;
    else if (compType === 'cup') compF = stage >= 3 ? 1.2 : 0.85;
    else if (compType === 'final') compF = 1.5;
    if (DT.isDerby(home.id, away.id)) compF *= 1.25;
    if (home.anger > 0) compF *= 0.7;
    d *= U.clamp(priceF, 0.2, 2.2) * formF * oppF * compF * U.rf(0.92, 1.06);
    return Math.round(U.clamp(d, 500, home.cap));
  };

  // Taquilla del local.
  E.matchIncome = function (home, away, compType, stage) {
    const att = E.attendance(home, away, compType, stage);
    // recaudación neta: parte del público entra con abono de socio
    E.add(home, 'Taquilla', att * home.ticket * 0.65);
    E.add(home, 'Mantenimiento', -att * 1.2 * (0.3 + E.W(home)));
    return att;
  };

  // Proceso económico semanal.
  E.weekly = function (t) {
    const G = DT.G;
    E.add(t, 'TV', E.tvAnnual(t) / WEEKS);
    const sp = t.sponsor ? t.sponsor.amt : E.sponsorBase(t);
    E.add(t, 'Sponsors', (sp + E.sponsorBase(t) * 0.2) / WEEKS);
    const stars = t.squad.filter((pid) => G.players[pid].ovr >= 80).length;
    E.add(t, 'Merchandising', (E.merchAnnual(t) * (1 + stars * 0.04)) / WEEKS);
    E.add(t, 'Socios', (t.socios * t.fee * 12) / WEEKS);
    E.add(t, 'Sueldos', -E.payroll(t) / WEEKS);
    E.add(t, 'Staff', -E.staffAnnual(t) / WEEKS);
    E.add(t, 'Mantenimiento', -E.upkeepAnnual(t) / WEEKS);
    // Préstamos
    for (const l of t.loans) {
      E.add(t, 'Cuotas de préstamos', -l.pay);
      l.left -= 1;
    }
    t.loans = t.loans.filter((l) => l.left > 0);
    // Obras en curso
    for (const pr of t.proj) {
      pr.left -= 1;
      if (pr.left <= 0) E.finishProject(t, pr);
    }
    t.proj = t.proj.filter((pr) => pr.left > 0);
    // Socios: cada 4 semanas se acercan a su valor objetivo.
    if (G.week % 4 === 0) {
      const ref = DT.COUNTRIES[t.cc].socio;
      const feeF = Math.pow(ref / Math.max(1, t.fee), 0.7);
      const pts = U.sum(t.form.slice(-8), (r) => (r === 'G' ? 3 : r === 'E' ? 1 : 0));
      const succ = 0.88 + 0.24 * (pts / 24);
      const target = E.socioBase(t) * feeF * succ;
      t.socios = Math.max(300, Math.round(t.socios + (target - t.socios) * 0.06));
    }
    if (DT.isUser(t.id)) t.fin.bal.push(Math.round(t.cash));
  };

  // Premios de competiciones.
  E.prize = function (t, amt, label) {
    if (!t || t.eur || !amt) return;
    E.add(t, 'Premios', amt);
    if (DT.isUser(t.id) && label) DT.news(`Premio cobrado: ${label} (${U.money(amt)}).`, 'money');
  };

  // ---------- Sponsors ----------
  E.sponsorOffers = function (t) {
    const base = E.sponsorBase(t);
    const names = U.shuffle(E.SPONSORS.slice()).slice(0, 3);
    const v = () => U.rf(0.92, 1.1);
    return [
      { name: names[0], kind: 'fijo', amt: U.round(base * v(), 10000), bonus: 0, txt: 'Monto fijo, sin premios.' },
      { name: names[1], kind: 'objetivo', amt: U.round(base * 0.78 * v(), 10000), bonus: U.round(base * 0.45, 10000), txt: 'Menos fijo, cobra extra si cumplís el objetivo de la directiva.' },
      { name: names[2], kind: 'titulos', amt: U.round(base * 0.6 * v(), 10000), bonus: U.round(base * 0.55, 10000), txt: 'Paga poco fijo, pero un gran premio por cada título.' },
    ];
  };

  // ---------- Préstamos ----------
  E.debt = (t) => U.sum(t.loans, (l) => l.pay * l.left);
  E.loanOptions = function (t) {
    const rev = E.estimateRevenue(t);
    return [
      { amt: U.round(rev * 0.1, 50000), rate: 0.09, weeks: 46 },
      { amt: U.round(rev * 0.2, 50000), rate: 0.11, weeks: 92 },
      { amt: U.round(rev * 0.35, 50000), rate: 0.14, weeks: 138 },
    ].map((o) => {
      const r = o.rate / WEEKS;
      o.pay = Math.round((o.amt * r) / (1 - Math.pow(1 + r, -o.weeks)));
      o.total = o.pay * o.weeks;
      return o;
    });
  };
  E.canBorrow = (t, opt) => E.debt(t) + opt.total <= E.estimateRevenue(t) * 0.6;
  E.takeLoan = function (t, opt) {
    t.loans.push({ amt: opt.amt, pay: opt.pay, left: opt.weeks, rate: opt.rate });
    E.add(t, 'Préstamos', opt.amt);
  };
  E.repayLoan = function (t, idx) {
    const l = t.loans[idx];
    if (!l) return false;
    // Cancelación anticipada: se paga el capital pendiente aproximado (sin intereses futuros).
    const r = l.rate / WEEKS;
    const remaining = Math.round((l.pay * (1 - Math.pow(1 + r, -l.left))) / r);
    if (t.cash < remaining) return false;
    E.add(t, 'Cuotas de préstamos', -remaining);
    t.loans.splice(idx, 1);
    return true;
  };
  E.loanRemaining = function (l) {
    const r = l.rate / WEEKS;
    return Math.round((l.pay * (1 - Math.pow(1 + r, -l.left))) / r);
  };

  // ---------- Infraestructura ----------
  E.INFRA = {
    train: { n: 'Centro de entrenamiento', d: 'Acelera la evolución de los jugadores y su recuperación física.' },
    youth: { n: 'Divisiones inferiores', d: 'Mejora la calidad y cantidad de juveniles que suben cada año.' },
    med: { n: 'Departamento médico', d: 'Menos lesiones y recuperaciones más rápidas.' },
  };
  E.infraCost = (t, key) => {
    const lvl = t.infra[key];
    const base = [0, 1.2, 3, 6, 11][lvl] || 0;
    return U.round(base * 1e6 * (0.2 + E.W(t)), 50000);
  };
  E.infraWeeks = (t, key) => 6 + t.infra[key] * 3;
  E.STADIUM = [
    { seats: 2000, weeks: 10 },
    { seats: 5000, weeks: 18 },
    { seats: 10000, weeks: 30 },
  ];
  E.stadiumCost = (t, seats) => U.round(seats * 900 * (0.3 + E.W(t)), 50000);
  E.busy = (t, kind) => t.proj.some((p) => p.kind === kind);
  E.startProject = function (t, kind, opt) {
    let cost, weeks, label;
    if (kind === 'stadium') {
      cost = E.stadiumCost(t, opt.seats);
      weeks = opt.weeks;
      label = `Ampliación del estadio (+${U.num(opt.seats)} lugares)`;
    } else {
      cost = E.infraCost(t, kind);
      weeks = E.infraWeeks(t, kind);
      label = `${E.INFRA[kind].n} nivel ${t.infra[kind] + 1}`;
    }
    if (t.cash < cost) return { ok: false, msg: 'No hay caja suficiente para esta obra.' };
    if (E.busy(t, kind)) return { ok: false, msg: 'Ya hay una obra en curso en esa área.' };
    E.add(t, 'Obras', -cost);
    t.proj.push({ kind, left: weeks, total: weeks, seats: opt && opt.seats, label });
    return { ok: true };
  };
  E.finishProject = function (t, pr) {
    if (pr.kind === 'stadium') t.cap = Math.min(110000, t.cap + pr.seats);
    else t.infra[pr.kind] = Math.min(5, t.infra[pr.kind] + 1);
    if (DT.isUser(t.id)) DT.inbox({ title: 'Obra terminada', body: `${pr.label}: la obra quedó terminada.`, kind: 'club' });
  };

  // La IA reinvierte el exceso de caja en obras e infraestructura.
  E.aiInvest = function (t) {
    const rev = E.estimateRevenue(t);
    const excess = t.cash - rev * 0.35;
    if (excess <= 0) return;
    const spend = excess * 0.5;
    E.add(t, 'Obras', -spend);
    const keys = ['train', 'youth', 'med'].filter((k) => t.infra[k] < 5);
    if (keys.length && spend > E.infraCost(t, keys[0]) * 0.8) {
      const k = keys[Math.floor(Math.random() * keys.length)];
      t.infra[k]++;
    }
    if (spend > E.stadiumCost(t, 5000) && t.cap < 70000 && E.demandBase(t) > t.cap * 1.2) t.cap += 5000;
  };

  // Cierre del ejercicio anual.
  E.closeSeason = function (t) {
    if (!DT.isUser(t.id) && t.lg) E.aiInvest(t);
    const tot = E.totals(t);
    t.fin.hist.push({ y: DT.G.year, inc: tot.inc, exp: tot.exp, cash: Math.round(t.cash), detail: JSON.parse(JSON.stringify(t.fin.cur)) });
    if (t.fin.hist.length > 12) t.fin.hist.shift();
    E.resetSeasonLedger(t);
    if (DT.isUser(t.id)) t.fin.bal = [Math.round(t.cash)];
  };

  return E;
})();
