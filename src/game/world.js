// Creación del mundo: clubes, planteles y estado inicial de la partida.
DT.W = (function () {
  const U = DT.U;
  const W = {};
  const LEVEL_ADJ = { BRA: 1, ARG: 0, URU: -2, CHI: -3, COL: -2, PAR: -3, PER: -4, ECU: -3, BOL: -5, VEN: -6 };
  const SQUAD_TARGET = { P: 3, D: 8, M: 8, A: 6 };

  W.teamLevel = (team) => 40 + team.rep * 0.38 + (LEVEL_ADJ[team.cc] || 0);

  function parseSquad(str) {
    if (!str) return [];
    return str.split('|').map((s) => {
      const [n, pos, age, ovr] = s.split('/');
      return { n, pos, age: +age, ovr: +ovr };
    });
  }

  function makeTeam(cc, row, inLeague) {
    const [code, name, short, stad, cap, rep, c1, c2] = row;
    const C = DT.COUNTRIES[cc];
    const t = {
      id: cc + '_' + code,
      n: name,
      s: short,
      cc,
      lg: inLeague ? cc : null,
      stad,
      cap,
      rep,
      c1,
      c2,
      socios: 0,
      cash: 0,
      ticket: 0,
      fee: C.socio,
      infra: { train: 1, youth: 1, med: 1 },
      tac: { f: '4-4-2', m: 2, p: 1 },
      xi: null,
      squad: [],
      sponsor: null,
      fin: { cur: null, hist: [], bal: [] },
      loans: [],
      proj: [],
      form: [],
    };
    const lvl = U.clamp(Math.round((rep - 45) / 11), 1, 5);
    t.infra = { train: lvl, youth: U.clamp(lvl + U.ri(-1, 1), 1, 5), med: U.clamp(lvl + U.ri(-1, 0), 1, 5) };
    t.socios = Math.round(DT.E.socioBase(t) / 100) * 100;
    t.ticket = Math.round(C.ticket * (0.7 + rep / 150));
    DT.E.resetSeasonLedger(t);
    return t;
  }

  // Completa el plantel con jugadores generados acordes al nivel del club.
  W.fillSquad = function (team, target) {
    const G = DT.G;
    const L = W.teamLevel(team);
    const counts = { P: 0, D: 0, M: 0, A: 0 };
    team.squad.forEach((pid) => counts[G.players[pid].pos]++);
    const goal = target || SQUAD_TARGET;
    for (const pos of ['P', 'D', 'M', 'A']) {
      while (counts[pos] < goal[pos]) {
        const age = U.weighted([18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34], [3, 4, 5, 5, 6, 6, 7, 7, 7, 7, 6, 6, 5, 4, 3, 2, 2]);
        let adj = 0;
        if (age <= 20) adj = -6;
        else if (age <= 23) adj = -2;
        else if (age <= 30) adj = 0.5;
        else if (age >= 33) adj = -2;
        const ovr = U.clamp(Math.round(L - 2 + adj + U.gauss() * 3.5), 38, 86);
        const p = DT.P.create({ n: DT.P.genName(team.cc), pos, age, ovr, t: team.id });
        team.squad.push(p.id);
        counts[pos]++;
      }
    }
  };

  W.newGame = function (userTeamId, managerName) {
    DT.G = {
      v: DT.VERSION,
      year: 2026,
      week: 0,
      slot: 0,
      user: null,
      teams: {},
      players: {},
      nextPid: 1,
      nextMsg: 1,
      news: [],
      inbox: [],
      season: null,
      history: [],
      manager: { n: managerName || 'DT', rep: 50, conf: 60, obj: null, titles: [], career: [], pj: 0, g: 0, e: 0, p: 0, since: 2026, clubs: [] },
      euroChamp: 'PSG',
      holders: { LIB: 'BRA_FLA', SUD: 'ARG_LAN' },
      prevTables: {},
      abroad: [],
      settings: { speed: 2 },
    };
    const G = DT.G;
    for (const cc of DT.COUNTRY_ORDER) {
      const C = DT.COUNTRIES[cc];
      for (const row of DT.TEAMS[cc]) {
        const t = makeTeam(cc, row, true);
        G.teams[t.id] = t;
        for (const pd of parseSquad(row[8])) {
          const p = DT.P.create({ n: pd.n, pos: pd.pos, age: pd.age, ovr: pd.ovr, t: t.id, real: true, cy: pd.age >= 33 ? U.ri(1, 2) : U.ri(1, 4) });
          t.squad.push(p.id);
        }
        W.fillSquad(t);
      }
      for (const row of C.pool) {
        const t = makeTeam(cc, row, false);
        G.teams[t.id] = t;
        W.fillSquad(t, { P: 3, D: 7, M: 7, A: 5 });
      }
    }
    // Europa (solo para la Intercontinental)
    G.europe = {};
    for (const row of DT.EUROPE) {
      const [code, name, short, c1, c2, squad] = row;
      const t = { id: 'EUR_' + code, n: name, s: short, cc: 'EUR', lg: null, stad: '', cap: 0, rep: 99, c1, c2, squad: [], tac: { f: '4-3-3', m: 3, p: 2 }, infra: { train: 5, youth: 5, med: 5 }, form: [], eur: true, fin: { cur: null, hist: [], bal: [] }, loans: [], proj: [] };
      G.teams[t.id] = t;
      for (const pd of parseSquad(squad)) {
        const p = DT.P.create({ n: pd.n, pos: pd.pos, age: pd.age, ovr: pd.ovr, t: t.id, real: true, cy: 5 });
        t.squad.push(p.id);
      }
      G.europe[t.id] = true;
    }
    // Caja inicial según ingresos esperados.
    for (const id in G.teams) {
      const t = G.teams[id];
      if (t.eur) continue;
      t.cash = U.round(DT.E.estimateRevenue(t) * U.rf(0.08, 0.22), 10000);
    }
    W.setUserTeam(userTeamId, true);
    DT.S.startSeason(true);
    return G;
  };

  W.setUserTeam = function (tid, first) {
    const G = DT.G;
    const old = G.user;
    G.user = tid;
    const t = G.teams[tid];
    if (first) G.manager.rep = U.clamp(t.rep - 12, 35, 80);
    G.manager.conf = 60;
    G.manager.clubs.push({ id: tid, n: t.n, from: G.year });
    t.xi = null;
    t.autoXI = true;
    DT.AI.autoLineup(t);
    if (old && old !== tid) DT.news(`${G.manager.n} es el nuevo entrenador de ${t.n}.`, 'club');
  };

  return W;
})();
