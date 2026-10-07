// Récords históricos del club que dirige el usuario y logros de la carrera.
DT.Rec = (function () {
  const U = DT.U;
  const R = {};

  R.of = function (tid) {
    const G = DT.G;
    G.rec = G.rec || {};
    if (!G.rec[tid]) G.rec[tid] = { since: G.year, games: [0, 0, 0, 0, 0, 0], pl: {}, bigW: null, bigL: null, unb: [0, 0, 0], wins: [0, 0, 0], h2h: {}, att: null, seasonG: null, bestPos: null };
    return G.rec[tid];
  };

  // Partido del usuario: totales, rachas, goleadas, historial contra cada rival y jugadores.
  R.match = function (match, sim) {
    const G = DT.G;
    const side = sim.s[0].tid === G.user ? 0 : sim.s[1].tid === G.user ? 1 : -1;
    if (side < 0) return;
    const r = R.of(G.user);
    const me = sim.s[side], opp = sim.s[1 - side];
    const gf = me.goals, ga = opp.goals;
    const oppT = G.teams[opp.tid];
    const comp = DT.S.compName(match.c);
    const res = gf > ga ? 0 : gf === ga ? 1 : 2;
    r.games[0]++; r.games[1 + res]++; r.games[4] += gf; r.games[5] += ga;
    const h = (r.h2h[opp.tid] = r.h2h[opp.tid] || [oppT.n, 0, 0, 0, 0, 0, 0]);
    h[0] = oppT.n; h[1]++; h[2 + res]++; h[5] += gf; h[6] += ga;
    const diff = gf - ga;
    if (diff > 0 && (!r.bigW || diff > r.bigW[0] - r.bigW[1] || (diff === r.bigW[0] - r.bigW[1] && gf > r.bigW[0]))) r.bigW = [gf, ga, oppT.n, G.year, comp];
    if (diff < 0 && (!r.bigL || -diff > r.bigL[1] - r.bigL[0] || (-diff === r.bigL[1] - r.bigL[0] && ga > r.bigL[1]))) r.bigL = [gf, ga, oppT.n, G.year, comp];
    r.unb[0] = res < 2 ? r.unb[0] + 1 : 0;
    if (r.unb[0] > r.unb[1]) { r.unb[1] = r.unb[0]; r.unb[2] = G.year; }
    r.wins[0] = res === 0 ? r.wins[0] + 1 : 0;
    if (r.wins[0] > r.wins[1]) { r.wins[1] = r.wins[0]; r.wins[2] = G.year; }
    if (match.h === G.user && !match.n && match.att && (!r.att || match.att > r.att[0])) r.att = [match.att, oppT.n, G.year];
    for (const pid of me.played) {
      const p = G.players[pid];
      if (!p) continue;
      const x = (r.pl[pid] = r.pl[pid] || [p.n, 0, 0, 0]);
      x[0] = p.n; x[1]++;
    }
    for (const sc of sim.scorers || []) {
      if (sc.side !== side) continue;
      if (r.pl[sc.pid]) r.pl[sc.pid][2]++;
      if (sc.aid && r.pl[sc.aid]) r.pl[sc.aid][3]++;
    }
    DT.Ach.afterMatch(match, sim, side, r);
  };

  // Fin de temporada: goleador de la temporada y mejor posición.
  R.season = function (pos, divName) {
    const G = DT.G;
    const t = DT.userTeam();
    const r = R.of(t.id);
    for (const pid of t.squad) {
      const p = G.players[pid];
      if (p && p.st.g > 0 && (!r.seasonG || p.st.g > r.seasonG[1])) r.seasonG = [p.n, p.st.g, G.year];
    }
    const lvl = t.lg ? 1 : 2;
    if (pos && (!r.bestPos || lvl < r.bestPos[2] || (lvl === r.bestPos[2] && pos < r.bestPos[0]))) r.bestPos = [pos, G.year, lvl, divName];
  };

  return R;
})();

DT.Ach = (function () {
  const A = {};
  // [id, emoji, título, descripción]
  A.LIST = [
    ['win1', '⚽', 'Primer triunfo', 'Ganá tu primer partido como DT.'],
    ['goleada', '🔥', 'Baile', 'Ganá un partido por 4 goles o más.'],
    ['batacazo', '😱', 'Batacazo', 'Ganale a un rival con 6 puntos más de media que tu equipo.'],
    ['clasico', '🏟️', 'Dueño de la ciudad', 'Ganá un clásico.'],
    ['remontada', '🔄', 'Remontada épica', 'Ganá un partido que ibas perdiendo por 2 goles.'],
    ['penales', '🧤', 'Nervios de acero', 'Ganá una serie por penales.'],
    ['racha5', '📈', 'Racha', 'Ganá 5 partidos seguidos.'],
    ['invicto10', '🛡️', 'Invicto', 'Llegá a 10 partidos sin perder.'],
    ['dt100', '💯', 'Centenario', 'Dirigí 100 partidos.'],
    ['dt300', '🎖️', 'Leyenda del banco', 'Dirigí 300 partidos.'],
    ['liga', '🏆', 'Campeón', 'Ganá una liga de primera división.'],
    ['copa', '🥇', 'Copero', 'Ganá una copa nacional.'],
    ['doblete', '✌️', 'Doblete', 'Ganá la liga y la copa nacional en la misma temporada.'],
    ['lib', '🌎', 'Gloria eterna', 'Ganá la Copa Libertadores.'],
    ['sud', '🌐', 'Sudamericano', 'Ganá la Copa Sudamericana.'],
    ['rec', '🔁', 'Recopa', 'Ganá la Recopa Sudamericana.'],
    ['int', '🌍', 'Campeón del mundo', 'Ganá la Copa Intercontinental.'],
    ['ascenso', '⬆️', 'Ascenso', 'Ascendé a primera división.'],
    ['chico', '🐜', 'Hazaña', 'Salí campeón de liga con un club de reputación menor a 72.'],
    ['trotamundos', '🧳', 'Trotamundos', 'Dirigí clubes de 3 países distintos.'],
    ['debut', '🌱', 'Semillero', 'Subí un juvenil de las inferiores al primer equipo.'],
    ['joya', '💎', 'Joya de la casa', 'Que un jugador surgido de tus inferiores llegue a 80 de media.'],
    ['fichaje', '💰', 'Fichaje bomba', 'Pagá 5 millones o más por un jugador.'],
    ['venta', '🤑', 'Venta millonaria', 'Vendé un jugador por 10 millones o más.'],
    ['clausula', '📝', 'Cláusula ejecutada', 'Pagá la cláusula de rescisión de un jugador.'],
  ];
  const byId = Object.fromEntries(A.LIST.map((x) => [x[0], x]));

  A.unlock = function (id) {
    const G = DT.G;
    if (!G || !byId[id]) return;
    G.ach = G.ach || {};
    if (G.ach[id]) return;
    G.ach[id] = [G.year, G.week];
    G.achNew = (G.achNew || []).concat([id]);
    DT.news(`Logro desbloqueado: ${byId[id][2]}.`, 'club');
  };
  A.info = (id) => byId[id];

  A.afterMatch = function (match, sim, side, r) {
    const G = DT.G;
    const me = sim.s[side], opp = sim.s[1 - side];
    const won = me.goals > opp.goals || (sim.pens && sim.pens[side] > sim.pens[1 - side]);
    if (me.goals > opp.goals) {
      A.unlock('win1');
      if (me.goals - opp.goals >= 4) A.unlock('goleada');
      if (DT.AI.rating(G.teams[opp.tid]) - DT.AI.rating(G.teams[me.tid]) >= 6) A.unlock('batacazo');
      if (DT.isDerby(match.h, match.a)) A.unlock('clasico');
      // remontada: en algún momento perdía por 2
      let a = 0, b = 0, down2 = false;
      for (const sc of (sim.scorers || []).slice().sort((x, y) => x.m - y.m)) {
        if (sc.side === side) a++; else b++;
        if (b - a >= 2) down2 = true;
      }
      if (down2) A.unlock('remontada');
    }
    if (sim.pens && won) A.unlock('penales');
    if (r.wins[0] >= 5) A.unlock('racha5');
    if (r.unb[0] >= 10) A.unlock('invicto10');
    const pj = G.manager.pj;
    if (pj >= 100) A.unlock('dt100');
    if (pj >= 300) A.unlock('dt300');
  };

  A.title = function (compName, team) {
    const G = DT.G;
    const C = DT.COUNTRIES[team.cc];
    if (compName.includes('Libertadores')) A.unlock('lib');
    else if (compName.includes('Sudamericana')) A.unlock('sud');
    else if (compName.includes('Recopa')) A.unlock('rec');
    else if (compName.includes('Intercontinental')) A.unlock('int');
    else if (C && compName === C.cup) A.unlock('copa');
    else if (C && compName === C.league) {
      A.unlock('liga');
      if (team.rep < 72) A.unlock('chico');
    }
    const mine = G.manager.titles.filter((x) => x.y === G.year).map((x) => x.c);
    if (C && mine.includes(C.league) && mine.includes(C.cup)) A.unlock('doblete');
  };

  A.season = function (promoted) {
    const G = DT.G;
    if (promoted) A.unlock('ascenso');
    const t = DT.userTeam();
    if (t && t.squad.some((id) => G.players[id] && G.players[id].fromAcad && G.players[id].ovr >= 80)) A.unlock('joya');
  };
  A.job = function () {
    const G = DT.G;
    const cc = new Set(G.manager.clubs.map((c) => (G.teams[c.id] ? G.teams[c.id].cc : null)).filter(Boolean));
    if (cc.size >= 3) A.unlock('trotamundos');
  };

  return A;
})();
