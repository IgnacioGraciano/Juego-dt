// Temporada: calendario, ligas, copas, torneos CONMEBOL y avance del tiempo.
DT.S = (function () {
  const U = DT.U;
  const S = {};

  S.LAST_WEEK = 45;
  const GS_WEEKS = [6, 8, 10, 13, 15, 17];
  const PO_WEEKS = [20, 21];
  const R16_WEEKS = [24, 25];
  const QF_WEEKS = [29, 30];
  const SF_WEEKS = [34, 35];
  const FINAL_WEEK = 40;
  const CUP_WEEKS = [4, 11, 19, 27, 32, 37, 42];
  const REC_WEEKS = [1, 2];
  const INT_WEEK = 45;
  S.windowOpen = () => DT.G.week <= 4 || (DT.G.week >= 21 && DT.G.week <= 26);

  S.PRIZES = {
    LIB: { group: 3e6, win: 330000, PO: 0, R16: 1.25e6, QF: 1.7e6, SF: 2.3e6, runner: 7e6, champ: 23e6 },
    SUD: { group: 900000, win: 115000, PO: 500000, R16: 600000, QF: 700000, SF: 1e6, runner: 2.5e6, champ: 6.5e6 },
  };
  S.STAGE_NAMES = { G: 'Fase de grupos', PO: 'Playoffs', R16: 'Octavos de final', QF: 'Cuartos de final', SF: 'Semifinal', F: 'Final' };

  // ---------- utilidades de partidos ----------
  function addMatch(o) {
    const S0 = DT.G.season;
    const m = { i: S0.nextMid++, c: o.c, h: o.h, a: o.a, w: o.w, s: o.s, p: 0, st: o.st, tie: o.tie || null, n: o.neutral ? 1 : 0, leg: o.leg || 0 };
    if (o.g !== undefined) m.g = o.g;
    S0.matches[m.i] = m;
    const k = o.w + '_' + o.s;
    (S0.sched[k] = S0.sched[k] || []).push(m.i);
    return m;
  }
  function addTie(o) {
    const S0 = DT.G.season;
    const t = { id: S0.nextTie++, c: o.c, stage: o.stage, a: o.a, b: o.b, legs: [], winner: null, single: !!o.single };
    S0.ties[t.id] = t;
    if (t.single) {
      const home = o.neutral ? (U.chance(0.5) ? t.a : t.b) : (o.homeFirst || t.a);
      const away = home === t.a ? t.b : t.a;
      t.legs.push(addMatch({ c: o.c, h: home, a: away, w: o.weeks[0], s: 0, st: o.stage, tie: t.id, neutral: o.neutral, leg: 1 }).i);
    } else {
      t.legs.push(addMatch({ c: o.c, h: t.a, a: t.b, w: o.weeks[0], s: 0, st: o.stage, tie: t.id, leg: 1 }).i);
      t.legs.push(addMatch({ c: o.c, h: t.b, a: t.a, w: o.weeks[1], s: 0, st: o.stage, tie: t.id, leg: 2 }).i);
    }
    return t;
  }

  // Calendario todos contra todos (método del círculo).
  function roundRobin(teams, double) {
    const list = teams.slice();
    if (list.length % 2) list.push(null);
    const n = list.length;
    const rounds = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) {
        const a = list[i], b = list[n - 1 - i];
        if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      list.splice(1, 0, list.pop());
    }
    if (double) {
      const second = rounds.map((rd) => rd.map(([a, b]) => [b, a]));
      return rounds.concat(second);
    }
    return rounds;
  }

  function newRow() { return { pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }; }

  S.sortTable = function (table, ids) {
    return ids.slice().sort((x, y) => {
      const a = table[x], b = table[y];
      return b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf || (DT.G.teams[y].rep - DT.G.teams[x].rep);
    });
  };

  function updateRow(table, h, a, hg, ag) {
    const H = table[h], A = table[a];
    if (!H || !A) return;
    H.pj++; A.pj++;
    H.gf += hg; H.gc += ag; A.gf += ag; A.gc += hg;
    if (hg > ag) { H.g++; A.p++; H.pts += 3; }
    else if (hg < ag) { A.g++; H.p++; A.pts += 3; }
    else { H.e++; A.e++; H.pts++; A.pts++; }
  }

  // ---------- creación de la temporada ----------
  S.startSeason = function (first) {
    const G = DT.G;
    G.week = 0;
    G.slot = 0;
    G.season = { year: G.year, comps: {}, matches: {}, ties: {}, sched: {}, nextMid: 1, nextTie: 1, qual: null };
    const SS = G.season;
    for (const cc of DT.COUNTRY_ORDER) {
      const C = DT.COUNTRIES[cc];
      const ids = Object.values(G.teams).filter((t) => t.lg === cc).map((t) => t.id);
      // Liga
      const double = C.format === 2;
      const rounds = roundRobin(U.shuffle(ids.slice()), double);
      const comp = { id: 'L_' + cc, type: 'league', cc, name: C.league, teams: ids, table: {}, rounds: rounds.length };
      ids.forEach((id) => (comp.table[id] = newRow()));
      SS.comps[comp.id] = comp;
      rounds.forEach((rd, r) => {
        const w = Math.floor(1 + (r * 44) / rounds.length);
        rd.forEach(([h, a]) => addMatch({ c: comp.id, h, a, w, s: 1, st: r + 1 }));
      });
      // Copa nacional
      S.createCup(cc, ids);
    }
    // Torneos internacionales
    const qual = first ? S.initialQualifiers() : G.nextQual;
    S.createContinental('LIB', 'Copa Libertadores', qual.LIB);
    S.createContinental('SUD', 'Copa Sudamericana', qual.SUD);
    // Recopa
    const hl = G.holders.LIB, hs = G.holders.SUD;
    if (hl && hs && hl !== hs && G.teams[hl] && G.teams[hs]) {
      SS.comps.REC = { id: 'REC', type: 'tie', name: 'Recopa Sudamericana', champion: null };
      const t = addTie({ c: 'REC', stage: 'F', a: hs, b: hl, weeks: REC_WEEKS });
      SS.comps.REC.tie = t.id;
    }
    // Intercontinental: se define en la semana de la final de la Libertadores
    G.euroChamp = U.pick(Object.keys(G.europe));
    SS.comps.INT = { id: 'INT', type: 'tie', name: 'Copa Intercontinental', champion: null, tie: null };
    // Preparación de equipos
    for (const id in G.teams) {
      const t = G.teams[id];
      if (t.eur) continue;
      if (!DT.isUser(id)) {
        DT.AI.chooseFormation(t);
        if (!t.sponsor || first) t.sponsor = { name: 'Sponsor', amt: DT.E.sponsorBase(t), kind: 'fijo', bonus: 0 };
      }
      for (const pid of t.squad) {
        const p = G.players[pid];
        p.st = { pj: 0, g: 0, a: 0, rs: 0 };
        p.yc = 0;
      }
    }
    DT.Board.seasonStart();
  };

  S.createCup = function (cc, ids) {
    const G = DT.G;
    const C = DT.COUNTRIES[cc];
    const comp = { id: 'C_' + cc, type: 'cup', cc, name: C.cup, round: 0, rounds: 0, alive: ids.slice(), champion: null, ties: [] };
    G.season.comps[comp.id] = comp;
    let B = 1;
    while (B < ids.length) B *= 2;
    comp.rounds = Math.round(Math.log2(B));
    comp.weeks = CUP_WEEKS.slice(CUP_WEEKS.length - comp.rounds);
    // Los de mayor reputación quedan libres en la primera ronda.
    const byes = B - ids.length;
    const sorted = ids.slice().sort((a, b) => G.teams[b].rep - G.teams[a].rep);
    comp.byes = sorted.slice(0, byes);
    const playing = U.shuffle(sorted.slice(byes));
    S.drawCupRound(comp, playing);
  };

  S.drawCupRound = function (comp, teams) {
    const G = DT.G;
    const w = comp.weeks[comp.round];
    const isFinal = comp.round === comp.rounds - 1;
    comp.ties = [];
    for (let i = 0; i + 1 < teams.length; i += 2) {
      let a = teams[i], b = teams[i + 1];
      // juega de local el de menor jerarquía
      if (G.teams[a].rep > G.teams[b].rep) { const x = a; a = b; b = x; }
      const t = addTie({ c: comp.id, stage: isFinal ? 'F' : 'R' + (comp.round + 1), a, b, single: true, weeks: [w], neutral: isFinal, homeFirst: a });
      comp.ties.push(t.id);
    }
  };

  S.cupStageName = function (comp, stage) {
    if (stage === 'F') return 'Final';
    const r = +String(stage).slice(1);
    const left = comp.rounds - r + 1; // rondas restantes incluida esta
    if (left === 2) return 'Semifinal';
    if (left === 3) return 'Cuartos de final';
    if (left === 4) return 'Octavos de final';
    if (left === 5) return '16avos de final';
    return 'Ronda ' + r;
  };

  // Clasificados de la primera temporada: por reputación dentro de cada liga.
  S.initialQualifiers = function () {
    const G = DT.G;
    const res = { LIB: [], SUD: [] };
    for (const cc of DT.COUNTRY_ORDER) {
      const C = DT.COUNTRIES[cc];
      const ids = Object.values(G.teams).filter((t) => t.lg === cc).sort((a, b) => b.rep - a.rep).map((t) => t.id);
      res.LIB.push(...ids.slice(0, C.lib));
      res.SUD.push(...ids.slice(C.lib, C.lib + C.sud));
    }
    return res;
  };

  S.createContinental = function (id, name, teams) {
    const G = DT.G;
    const comp = { id, type: 'cont', name, teams: teams.slice(), groups: [], gtable: {}, stage: 'G', ko: {}, champion: null };
    G.season.comps[id] = comp;
    // Bombos por reputación, intentando no repetir país en un grupo.
    const sorted = teams.slice().sort((a, b) => G.teams[b].rep - G.teams[a].rep);
    const holder = id === 'LIB' ? G.holders.LIB : G.holders.SUD;
    if (holder && sorted.includes(holder)) { sorted.splice(sorted.indexOf(holder), 1); sorted.unshift(holder); }
    const groups = Array.from({ length: 8 }, () => []);
    for (let pot = 0; pot < 4; pot++) {
      const potTeams = U.shuffle(sorted.slice(pot * 8, pot * 8 + 8));
      const order = U.shuffle([0, 1, 2, 3, 4, 5, 6, 7]);
      for (const tid of potTeams) {
        const cc = G.teams[tid].cc;
        let gi = order.findIndex((g) => groups[g].length === pot && !groups[g].some((x) => G.teams[x].cc === cc));
        if (gi < 0) gi = order.findIndex((g) => groups[g].length === pot);
        const g = order[gi];
        groups[g].push(tid);
      }
    }
    comp.groups = groups;
    teams.forEach((t) => (comp.gtable[t] = newRow()));
    groups.forEach((gr, gi) => {
      const rr = roundRobin(gr, true);
      rr.forEach((rd, r) => rd.forEach(([h, a]) => addMatch({ c: id, h, a, w: GS_WEEKS[r], s: 0, st: 'G', g: gi })));
    });
    // Premio por participar
    const P = S.PRIZES[id];
    teams.forEach((t) => DT.E.prize(G.teams[t], P.group, `${name}: fase de grupos`));
  };

  // ---------- simulación de una franja ----------
  S.slotMatches = function (w, s) {
    const G = DT.G;
    return (G.season.sched[w + '_' + s] || []).map((i) => G.season.matches[i]);
  };

  S.userMatchNow = function () {
    const G = DT.G;
    return S.slotMatches(G.week, G.slot).find((m) => !m.p && (m.h === G.user || m.a === G.user)) || null;
  };

  // ¿El partido debe definirse por penales si termina así?
  S.needsPens = function (match, hg, ag) {
    const G = DT.G;
    if (!match.tie) return false;
    const tie = G.season.ties[match.tie];
    if (tie.single) return hg === ag;
    if (match.leg !== 2) return false;
    const l1 = G.season.matches[tie.legs[0]];
    // en la vuelta, local = tie.b
    const aggB = l1.ag + hg, aggA = l1.hg + ag;
    return aggA === aggB;
  };

  function compType(match) {
    const c = match.c;
    if (c.startsWith('L_')) return 'league';
    if (c.startsWith('C_')) return 'cup';
    return 'cont';
  }

  // Registra un partido jugado en su competición.
  S.record = function (match, sim) {
    const G = DT.G;
    const comp = G.season.comps[match.c];
    const home = G.teams[match.h], away = G.teams[match.a];
    // taquilla y viajes
    if (!match.n) {
      const type = compType(match);
      const stage = type === 'cup' ? (comp.round || 0) : 0;
      match.att = DT.E.matchIncome(home, away, type, stage);
    } else {
      match.att = Math.round(U.rf(0.75, 0.98) * 45000);
      if (!home.eur) DT.E.add(home, 'Taquilla', match.att * 15 * 0.3);
      if (!away.eur) DT.E.add(away, 'Taquilla', match.att * 15 * 0.3);
    }
    if (comp.type === 'cont' || comp.type === 'tie') {
      const tr = (t) => { if (!t.eur) DT.E.add(t, 'Viajes', -60000 * (0.5 + DT.E.W(t))); };
      tr(away);
      if (match.n) tr(home);
    }
    if (comp.type === 'league') {
      updateRow(comp.table, match.h, match.a, match.hg, match.ag);
    } else if (comp.type === 'cont' && match.st === 'G') {
      updateRow(comp.gtable, match.h, match.a, match.hg, match.ag);
      const P = S.PRIZES[comp.id];
      if (match.hg > match.ag) DT.E.prize(home, P.win);
      if (match.ag > match.hg) DT.E.prize(away, P.win);
    }
    if (match.tie) S.resolveTie(G.season.ties[match.tie], match);
    // Directiva y estadísticas del DT
    if (DT.isUser(match.h) || DT.isUser(match.a)) DT.Board.afterMatch(match);
  };

  S.resolveTie = function (tie, match) {
    const G = DT.G;
    if (tie.single) {
      if (match.hg !== match.ag) tie.winner = match.hg > match.ag ? match.h : match.a;
      else tie.winner = match.pen[0] > match.pen[1] ? match.h : match.a;
    } else if (match.leg === 2) {
      const l1 = G.season.matches[tie.legs[0]];
      const aggA = l1.hg + match.ag, aggB = l1.ag + match.hg;
      if (aggA !== aggB) tie.winner = aggA > aggB ? tie.a : tie.b;
      else tie.winner = match.pen[0] > match.pen[1] ? match.h : match.a;
    }
  };

  // Simula los partidos pendientes de la franja actual (excepto si se pide).
  S.simulateSlot = function () {
    const G = DT.G;
    for (const m of S.slotMatches(G.week, G.slot)) {
      if (m.p) continue;
      const sim = DT.Match.quick(m);
      if (S.needsPens(m, sim.s[0].goals, sim.s[1].goals)) DT.Match.penalties(sim);
      DT.Match.apply(sim);
      S.record(m, sim);
    }
  };

  // Recuperación física entre franjas.
  function recover() {
    const G = DT.G;
    for (const id in G.teams) {
      const t = G.teams[id];
      const rec = 7.5 + t.infra.train * 0.8;
      for (const pid of t.squad) {
        const p = G.players[pid];
        p.fit = Math.min(100, p.fit + rec * (p.age >= 32 ? 0.85 : 1));
      }
    }
    for (const pid in G.players) {
      const p = G.players[pid];
      if (!p.t) p.fit = Math.min(100, p.fit + 10);
    }
  }

  // Avanza la competencia luego de cada franja.
  S.progress = function () {
    const G = DT.G;
    const SS = G.season;
    const w = G.week;
    // Copas nacionales
    for (const cc of DT.COUNTRY_ORDER) {
      const comp = SS.comps['C_' + cc];
      if (!comp || comp.champion) continue;
      if (comp.weeks[comp.round] === w && G.slot === 0) {
        const winners = comp.ties.map((t) => SS.ties[t].winner);
        if (winners.some((x) => !x)) continue;
        const C = DT.COUNTRIES[cc];
        winners.forEach((tid) => DT.E.prize(G.teams[tid], C.cupPrize * 1e6 * 0.04 * Math.pow(1.6, comp.round)));
        if (comp.round === comp.rounds - 1) {
          comp.champion = winners[0];
          const tie = SS.ties[comp.ties[0]];
          comp.runner = tie.a === comp.champion ? tie.b : tie.a;
          DT.E.prize(G.teams[comp.champion], C.cupPrize * 1e6 * 0.6, `${comp.name}: campeón`);
          S.title(comp.champion, comp.name);
        } else {
          let next = winners;
          if (comp.round === 0) next = winners.concat(comp.byes);
          comp.round++;
          S.drawCupRound(comp, U.shuffle(next));
        }
      }
    }
    if (G.slot !== 0) return;
    // CONMEBOL
    for (const id of ['LIB', 'SUD']) {
      const comp = SS.comps[id];
      if (!comp || comp.champion) continue;
      if (w === GS_WEEKS[5] && comp.stage === 'G') S.endGroups(comp);
      else if (w === PO_WEEKS[1] && id === 'SUD' && comp.stage === 'PO') S.sudR16(comp);
      else if (w === R16_WEEKS[1] && comp.stage === 'R16') S.nextKO(comp, 'QF', QF_WEEKS);
      else if (w === QF_WEEKS[1] && comp.stage === 'QF') S.nextKO(comp, 'SF', SF_WEEKS);
      else if (w === SF_WEEKS[1] && comp.stage === 'SF') S.nextKO(comp, 'F', [FINAL_WEEK], true);
      else if (w === FINAL_WEEK && comp.stage === 'F') S.endContinental(comp);
    }
    if (w === FINAL_WEEK) {
      // armar la Intercontinental
      const lib = SS.comps.LIB;
      if (lib && lib.champion && !SS.comps.INT.tie) {
        const t = addTie({ c: 'INT', stage: 'F', a: lib.champion, b: G.euroChamp, single: true, neutral: true, weeks: [INT_WEEK] });
        SS.comps.INT.tie = t.id;
      }
    }
    if (w === REC_WEEKS[1] && SS.comps.REC && !SS.comps.REC.champion) {
      const t = SS.ties[SS.comps.REC.tie];
      if (t.winner) {
        SS.comps.REC.champion = t.winner;
        DT.E.prize(G.teams[t.winner], 1.65e6, 'Recopa Sudamericana: campeón');
        DT.E.prize(G.teams[t.winner === t.a ? t.b : t.a], 600000);
        S.title(t.winner, 'Recopa Sudamericana');
      }
    }
    if (w === INT_WEEK && SS.comps.INT.tie && !SS.comps.INT.champion) {
      const t = SS.ties[SS.comps.INT.tie];
      if (t.winner) {
        SS.comps.INT.champion = t.winner;
        DT.E.prize(G.teams[t.a], 5e6, 'Copa Intercontinental: participación');
        if (t.winner === t.a) DT.E.prize(G.teams[t.a], 10e6, 'Copa Intercontinental: campeón');
        if (!G.teams[t.winner].eur) S.title(t.winner, 'Copa Intercontinental');
        else DT.news(`${G.teams[t.winner].n} se quedó con la Copa Intercontinental ante ${G.teams[t.a].n}.`, 'world');
      }
    }
  };

  S.groupStandings = function (comp, gi) {
    return S.sortTable(comp.gtable, comp.groups[gi]);
  };

  S.endGroups = function (comp) {
    const G = DT.G;
    const SS = G.season;
    const first = [], second = [], third = [];
    comp.groups.forEach((g, gi) => {
      const st = S.groupStandings(comp, gi);
      first.push({ t: st[0], g: gi }); second.push({ t: st[1], g: gi }); third.push({ t: st[2], g: gi });
    });
    if (comp.id === 'LIB') {
      comp.thirds = third.map((x) => x.t);
      S.pairR16(comp, first, second);
      // Los terceros van a los playoffs de la Sudamericana
      const sud = SS.comps.SUD;
      if (sud) sud.libThirds = comp.thirds;
    } else {
      comp.winners = first.map((x) => x.t);
      comp.stage = 'PO';
      const libThirds = U.shuffle((comp.libThirds || []).slice());
      const runners = U.shuffle(second.map((x) => x.t));
      comp.ko.PO = [];
      for (let i = 0; i < 8; i++) {
        const a = runners[i], b = libThirds[i];
        if (!a || !b) continue;
        const t = addTie({ c: 'SUD', stage: 'PO', a, b, weeks: PO_WEEKS });
        comp.ko.PO.push(t.id);
        DT.E.prize(G.teams[a], S.PRIZES.SUD.PO);
        DT.E.prize(G.teams[b], S.PRIZES.SUD.PO);
      }
      // Los terceros de la Libertadores se suman a la Sudamericana.
      comp.teams.push(...libThirds);
    }
  };

  S.pairR16 = function (comp, first, second) {
    const G = DT.G;
    comp.stage = 'R16';
    const sec = U.shuffle(second.slice());
    // evitar cruces del mismo grupo
    for (let i = 0; i < first.length; i++) {
      if (sec[i].g === first[i].g) {
        const j = (i + 1) % sec.length;
        const x = sec[i]; sec[i] = sec[j]; sec[j] = x;
      }
    }
    comp.ko.R16 = [];
    for (let i = 0; i < 8; i++) {
      // el primero define de local (es "b": juega la vuelta en casa)
      const t = addTie({ c: comp.id, stage: 'R16', a: sec[i].t, b: first[i].t, weeks: R16_WEEKS });
      comp.ko.R16.push(t.id);
      DT.E.prize(G.teams[sec[i].t], S.PRIZES[comp.id].R16, `${comp.name}: octavos de final`);
      DT.E.prize(G.teams[first[i].t], S.PRIZES[comp.id].R16, `${comp.name}: octavos de final`);
    }
  };

  S.sudR16 = function (comp) {
    const G = DT.G;
    const poWinners = comp.ko.PO.map((t) => G.season.ties[t].winner);
    const first = comp.winners.map((t, i) => ({ t, g: i }));
    const second = U.shuffle(poWinners).map((t) => ({ t, g: -1 }));
    S.pairR16(comp, first, second);
  };

  S.nextKO = function (comp, stage, weeks, single) {
    const G = DT.G;
    const prev = comp.ko[comp.stage];
    const winners = prev.map((t) => G.season.ties[t].winner);
    comp.ko[stage] = [];
    comp.stage = stage;
    for (let i = 0; i + 1 < winners.length; i += 2) {
      let a = winners[i], b = winners[i + 1];
      if (G.teams[a].rep > G.teams[b].rep) { const x = a; a = b; b = x; }
      const t = addTie({ c: comp.id, stage, a, b, weeks, single, neutral: single });
      comp.ko[stage].push(t.id);
      if (stage !== 'F') {
        DT.E.prize(G.teams[a], S.PRIZES[comp.id][stage], `${comp.name}: ${S.STAGE_NAMES[stage].toLowerCase()}`);
        DT.E.prize(G.teams[b], S.PRIZES[comp.id][stage], `${comp.name}: ${S.STAGE_NAMES[stage].toLowerCase()}`);
      }
    }
    if (single) comp.venue = U.pick(DT.FINAL_VENUES);
  };

  S.endContinental = function (comp) {
    const G = DT.G;
    const tie = G.season.ties[comp.ko.F[0]];
    if (!tie.winner) return;
    comp.champion = tie.winner;
    comp.runner = tie.winner === tie.a ? tie.b : tie.a;
    comp.stage = 'done';
    DT.E.prize(G.teams[comp.champion], S.PRIZES[comp.id].champ, `${comp.name}: campeón`);
    DT.E.prize(G.teams[comp.runner], S.PRIZES[comp.id].runner, `${comp.name}: subcampeón`);
    S.title(comp.champion, comp.name);
  };

  // Registro de títulos.
  S.title = function (tid, compName) {
    const G = DT.G;
    const t = G.teams[tid];
    if (!t) return;
    t.titles = t.titles || [];
    t.titles.push({ y: G.year, c: compName });
    DT.news(`¡${t.n} campeón de la ${compName} ${G.year}!`, 'title');
    if (DT.isUser(tid)) {
      G.manager.titles.push({ y: G.year, c: compName, t: t.n });
      G.manager.rep = Math.min(100, G.manager.rep + (compName.includes('Libertadores') ? 8 : compName.includes('Intercontinental') ? 6 : compName.includes('Sudamericana') ? 5 : 3));
      DT.inbox({ title: `¡Campeones de la ${compName}!`, body: `El club levanta la ${compName} ${G.year}. La hinchada está de fiesta y la directiva te felicita.`, kind: 'title' });
      if (t.sponsor && t.sponsor.kind === 'titulos' && t.sponsor.bonus) {
        DT.E.add(t, 'Sponsors', t.sponsor.bonus);
        DT.news(`${t.sponsor.name} pagó el premio por título (${U.money(t.sponsor.bonus)}).`, 'money');
      }
    }
  };

  // ---------- avance del tiempo ----------
  // Devuelve {type: 'match'|'inbox'|'seasonEnd'|'fired'} para que la UI sepa qué mostrar.
  S.advance = function (opts) {
    const G = DT.G;
    let guard = 0;
    while (guard++ < 400) {
      if (G.pendingOffers) return { type: 'jobs' };
      if (G.week > S.LAST_WEEK) {
        DT.End.season();
        return { type: 'seasonEnd' };
      }
      const um = S.userMatchNow();
      if (um) return { type: 'match', match: um };
      S.simulateSlot();
      S.progress();
      recover();
      if (G.slot === 0) {
        G.slot = 1;
      } else {
        S.endWeek();
        G.slot = 0;
        G.week++;
        if (G.pendingOffers) return { type: 'jobs' };
        if (G.inbox.some((m) => m.actions && !m.done && !m.seen)) return { type: 'inbox' };
        if (opts && opts.oneWeek) return { type: 'week' };
      }
    }
    return { type: 'week' };
  };

  // Después de jugar el partido del usuario: completa la franja y sigue.
  S.afterUserMatch = function () {
    const G = DT.G;
    S.simulateSlot();
    S.progress();
    recover();
    if (G.slot === 0) G.slot = 1;
    else {
      S.endWeek();
      G.slot = 0;
      G.week++;
    }
  };

  S.endWeek = function () {
    const G = DT.G;
    for (const id in G.teams) {
      const t = G.teams[id];
      if (t.eur) continue;
      DT.E.weekly(t);
      for (const pid of t.squad) {
        const p = G.players[pid];
        if (p.inj > 0) {
          p.inj -= 1;
          if (t.infra.med >= 4 && p.inj > 0 && U.chance(0.15 * (t.infra.med - 3))) p.inj -= 1;
          if (p.inj <= 0 && DT.isUser(id)) DT.news(`${p.n} se recuperó de su lesión.`, 'squad');
        }
        DT.P.weeklyDevelop(p, t.infra.train, p.played);
        p.played = false;
        // la moral vuelve lentamente a 65
        p.mor += (65 - p.mor) * 0.04;
      }
    }
    DT.M.weekly();
    DT.Board.weekly();
  };

  // Partidos de la próxima fecha del usuario.
  S.userFixtures = function () {
    const G = DT.G;
    return Object.values(G.season.matches).filter((m) => m.h === G.user || m.a === G.user).sort((a, b) => a.w - b.w || a.s - b.s);
  };

  S.compName = function (cid) {
    const c = DT.G.season.comps[cid];
    return c ? c.name : cid;
  };

  S.matchLabel = function (m) {
    const G = DT.G;
    const comp = G.season.comps[m.c];
    if (!comp) return '';
    if (comp.type === 'league') return `${comp.name} · Fecha ${m.st}`;
    if (comp.type === 'cup') return `${comp.name} · ${S.cupStageName(comp, m.st)}`;
    if (comp.type === 'cont') return `${comp.name} · ${S.STAGE_NAMES[m.st]}${m.leg && !G.season.ties[m.tie || 0]?.single && m.st !== 'G' ? (m.leg === 1 ? ' (ida)' : ' (vuelta)') : ''}`;
    return `${comp.name}${m.leg === 1 && comp.id === 'REC' ? ' (ida)' : m.leg === 2 ? ' (vuelta)' : ''}`;
  };

  return S;
})();
