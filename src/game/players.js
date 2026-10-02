// Jugadores: creación, valor de mercado, sueldos, evolución y juveniles.
DT.P = (function () {
  const U = DT.U;
  const P = {};

  P.genName = function (cc) {
    const pool = DT.NAMES[cc] || DT.NAMES.ARG;
    if (cc === 'BRA' && U.chance(0.35)) return U.pick(pool.mono) + (U.chance(0.3) ? ' ' + U.pick(pool.l) : '');
    return U.pick(pool.f) + ' ' + U.pick(pool.l);
  };

  // Potencial según edad: los jóvenes tienen margen de crecimiento.
  P.genPot = function (age, ovr) {
    let extra;
    if (age <= 18) extra = U.ri(8, 24);
    else if (age <= 20) extra = U.ri(5, 18);
    else if (age <= 22) extra = U.ri(3, 12);
    else if (age <= 24) extra = U.ri(1, 7);
    else if (age <= 27) extra = U.ri(0, 3);
    else extra = 0;
    return Math.min(94, ovr + extra);
  };

  P.create = function (o) {
    const G = DT.G;
    const p = {
      id: G.nextPid++,
      n: o.n,
      pos: o.pos,
      age: o.age,
      ovr: o.ovr,
      pot: o.pot || P.genPot(o.age, o.ovr),
      t: o.t || null,
      w: 0,
      cy: o.cy || U.ri(1, 4),
      fit: 100,
      mor: 70,
      inj: 0,
      sus: 0,
      yc: 0,
      xp: 0,
      st: { pj: 0, g: 0, a: 0, rs: 0 },
      car: { pj: 0, g: 0 },
      fm: [],
      real: !!o.real,
      lst: false,
      yt: !!o.yt,
    };
    p.w = P.fairWage(p);
    G.players[p.id] = p;
    return p;
  };

  // Valor de mercado en USD.
  P.value = function (p) {
    let v = 50000 * Math.pow(10, (p.ovr - 50) / 12);
    const a = p.age;
    let af;
    if (a <= 19) af = 1.35;
    else if (a <= 21) af = 1.35;
    else if (a <= 24) af = 1.25;
    else if (a <= 27) af = 1.1;
    else if (a <= 29) af = 0.95;
    else if (a <= 31) af = 0.7;
    else if (a <= 33) af = 0.45;
    else if (a <= 35) af = 0.25;
    else af = 0.12;
    v *= af;
    if (a <= 23) v *= 1 + Math.max(0, p.pot - p.ovr) * 0.045;
    if (p.inj > 4) v *= 0.85;
    return U.round(Math.max(15000, v), v > 1e6 ? 50000 : 5000);
  };

  // Sueldo anual "justo" para la media del jugador.
  P.WAGE_C = { BRA: 1.4, ARG: 1.0, URU: 0.8, CHI: 0.9, COL: 0.8, PAR: 0.8, PER: 0.8, ECU: 0.85, BOL: 0.65, VEN: 0.6, EUR: 3 };
  P.fairWage = function (p, cc) {
    const team = p.t && DT.G.teams[p.t];
    const k = P.WAGE_C[cc || (team && team.cc)] || 1;
    let w = 16000 * k * Math.pow(10, (p.ovr - 50) / 11.5);
    if (p.age <= 20) w *= 0.45;
    else if (p.age <= 23) w *= 0.75;
    else if (p.age >= 34) w *= 0.8;
    return U.round(Math.max(12000, w), 1000);
  };

  P.stars = function (pot) {
    // 1 a 5 estrellas de potencial
    if (pot >= 86) return 5;
    if (pot >= 80) return 4;
    if (pot >= 74) return 3;
    if (pot >= 66) return 2;
    return 1;
  };

  P.available = (p) => p.inj <= 0 && p.sus <= 0;

  P.avgRating = (p) => (p.st.pj ? p.st.rs / p.st.pj : 0);

  // Evolución semanal: los jóvenes progresan, entrenamiento y minutos ayudan.
  P.weeklyDevelop = function (p, trainLvl, played) {
    if (p.ovr >= p.pot) return;
    const gap = p.pot - p.ovr;
    let rate = 0.0055 * gap * (0.8 + 0.1 * trainLvl);
    const a = p.age;
    rate *= a <= 21 ? 1 : a <= 23 ? 0.8 : a <= 26 ? 0.5 : 0.25;
    rate *= played ? 1.3 : 0.8;
    p.xp += rate;
    while (p.xp >= 1 && p.ovr < p.pot) {
      p.xp -= 1;
      p.ovr += 1;
    }
  };

  // Fin de temporada: cumpleaños y declive.
  P.ageUp = function (p) {
    p.age += 1;
    if (p.age >= 31) {
      let drop = 0;
      if (p.age >= 36) drop = U.ri(2, 5);
      else if (p.age >= 34) drop = U.ri(1, 4);
      else if (p.age >= 32) drop = U.ri(0, 3);
      else drop = U.ri(0, 2);
      p.ovr = Math.max(40, p.ovr - drop);
      p.pot = Math.min(p.pot, p.ovr);
    } else if (p.age >= 27) {
      p.pot = Math.min(p.pot, p.ovr + 1);
    }
  };

  P.retireChance = function (p) {
    if (p.age >= 41) return 1;
    if (p.age >= 39) return 0.7;
    if (p.age >= 37) return 0.4;
    if (p.age >= 35) return p.ovr < 68 ? 0.3 : 0.12;
    if (p.age >= 33 && !p.t) return 0.35;
    return 0;
  };

  // Juveniles de la cantera.
  P.youth = function (team) {
    const lvl = team.infra.youth;
    const base = 38 + lvl * 3 + Math.round((team.rep - 50) / 7);
    const pos = U.weighted(['P', 'D', 'M', 'A'], [1, 3, 3, 2.5]);
    const age = U.ri(16, 18);
    const ovr = U.clamp(base + U.ri(-3, 8), 35, 68);
    let pot = ovr + U.ri(10, 26) + lvl * 2;
    if (U.chance(0.04 + lvl * 0.015)) pot += U.ri(5, 10); // joya
    pot = Math.min(93, pot);
    const p = P.create({ n: P.genName(team.cc), pos, age, ovr, pot, t: team.id, cy: 3, yt: true });
    p.w = Math.max(12000, Math.round(p.w * 0.6));
    return p;
  };

  // Lo que pide el jugador para firmar con un club.
  P.demand = function (p, team) {
    let w = P.fairWage(p, team.cc);
    if (p.t) {
      const cur = DT.team(p.t);
      if (cur && cur.rep > team.rep) w *= 1 + (cur.rep - team.rep) * 0.02;
      w = Math.max(w, p.w * 1.1);
    }
    w *= 0.9 + (100 - p.mor) / 500;
    const years = p.age >= 32 ? U.ri(1, 2) : p.age >= 28 ? U.ri(2, 3) : U.ri(3, 5);
    return { w: U.round(w, 1000), years };
  };

  // ¿Acepta el jugador mudarse a este club?
  P.willingToJoin = function (p, team) {
    if (!p.t) return true;
    const cur = DT.team(p.t);
    if (!cur) return true;
    const diff = cur.rep - team.rep;
    if (diff > 22) return false;
    if (diff > 12) return U.chance(0.35);
    return true;
  };

  return P;
})();
