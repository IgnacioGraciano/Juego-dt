// Formaciones, selección de once y gestión de planteles de la IA.
DT.FORMATIONS = {
  '4-4-2': { l: 'PDDDDMMMMAA', xy: [[50, 90], [14, 70], [37, 74], [63, 74], [86, 70], [14, 46], [37, 50], [63, 50], [86, 46], [37, 21], [63, 21]], a: 1, d: 1 },
  '4-3-3': { l: 'PDDDDMMMAAA', xy: [[50, 90], [14, 70], [37, 74], [63, 74], [86, 70], [27, 50], [50, 54], [73, 50], [17, 23], [50, 17], [83, 23]], a: 1.02, d: 0.99 },
  '4-2-3-1': { l: 'PDDDDMMMMMA', xy: [[50, 90], [14, 70], [37, 74], [63, 74], [86, 70], [37, 57], [63, 57], [17, 36], [50, 37], [83, 36], [50, 15]], a: 1.03, d: 0.99 },
  '4-5-1': { l: 'PDDDDMMMMMA', xy: [[50, 90], [14, 70], [37, 74], [63, 74], [86, 70], [11, 46], [30, 51], [50, 55], [70, 51], [89, 46], [50, 19]], a: 0.95, d: 1.04 },
  '3-5-2': { l: 'PDDDMMMMMAA', xy: [[50, 90], [27, 73], [50, 76], [73, 73], [10, 48], [31, 53], [50, 57], [69, 53], [90, 48], [37, 21], [63, 21]], a: 1.01, d: 0.98 },
  '3-4-3': { l: 'PDDDMMMMAAA', xy: [[50, 90], [27, 73], [50, 76], [73, 73], [14, 48], [37, 52], [63, 52], [86, 48], [17, 23], [50, 17], [83, 23]], a: 1.04, d: 0.95 },
  '5-3-2': { l: 'PDDDDDMMMAA', xy: [[50, 90], [9, 64], [29, 73], [50, 76], [71, 73], [91, 64], [27, 48], [50, 52], [73, 48], [37, 21], [63, 21]], a: 0.97, d: 1.04 },
  '5-4-1': { l: 'PDDDDDMMMMA', xy: [[50, 90], [9, 64], [29, 73], [50, 76], [71, 73], [91, 64], [14, 44], [37, 48], [63, 48], [86, 44], [50, 19]], a: 0.92, d: 1.07 },
};
DT.MENTALITY = ['Muy defensiva', 'Defensiva', 'Equilibrada', 'Ofensiva', 'Muy ofensiva'];
DT.PRESSURE = ['Baja', 'Media', 'Alta'];

DT.AI = (function () {
  const U = DT.U;
  const AI = {};

  // Factor por jugar fuera de puesto.
  AI.posFactor = function (natural, slot) {
    if (natural === slot) return 1;
    if (natural === 'P' || slot === 'P') return 0.35;
    const order = { D: 0, M: 1, A: 2 };
    return Math.abs(order[natural] - order[slot]) === 1 ? 0.86 : 0.7;
  };

  const selScore = (p) => p.ovr * (0.55 + 0.45 * p.fit / 100);

  // Arma el mejor once disponible para la formación del equipo.
  AI.pickXI = function (team, formation, ignoreFitness) {
    const G = DT.G;
    const F = DT.FORMATIONS[formation || team.tac.f];
    const avail = team.squad.map((id) => G.players[id]).filter(DT.P.available);
    const used = new Set();
    const xi = new Array(11).fill(null);
    const score = ignoreFitness ? (p) => p.ovr : selScore;
    // Primero cada puesto con jugadores naturales, empezando por el arquero.
    for (const pos of ['P', 'A', 'D', 'M']) {
      const slots = [];
      for (let i = 0; i < 11; i++) if (F.l[i] === pos) slots.push(i);
      const cands = avail.filter((p) => p.pos === pos && !used.has(p.id)).sort((a, b) => score(b) - score(a));
      for (const i of slots) {
        const c = cands.shift();
        if (c) { xi[i] = c.id; used.add(c.id); }
      }
    }
    // Huecos: el mejor disponible considerando el factor de puesto.
    for (let i = 0; i < 11; i++) {
      if (xi[i]) continue;
      let best = null, bs = -1;
      for (const p of avail) {
        if (used.has(p.id)) continue;
        const s = score(p) * AI.posFactor(p.pos, F.l[i]);
        if (s > bs) { bs = s; best = p; }
      }
      if (best) { xi[i] = best.id; used.add(best.id); }
    }
    return xi;
  };

  AI.pickBench = function (team, xi, n) {
    const G = DT.G;
    const inXI = new Set(xi);
    const rest = team.squad.map((id) => G.players[id]).filter((p) => !inXI.has(p.id) && DT.P.available(p));
    rest.sort((a, b) => selScore(b) - selScore(a));
    const bench = [];
    const gk = rest.find((p) => p.pos === 'P');
    if (gk) bench.push(gk.id);
    for (const p of rest) {
      if (bench.length >= (n || 9)) break;
      if (!bench.includes(p.id)) bench.push(p.id);
    }
    return bench;
  };

  AI.autoLineup = function (team) {
    team.xi = AI.pickXI(team);
    team.bench = AI.pickBench(team, team.xi);
  };

  // Valida el once del usuario: devuelve problemas encontrados.
  AI.lineupIssues = function (team) {
    const G = DT.G;
    const issues = [];
    if (!team.xi || team.xi.length !== 11) return ['No hay once titular armado.'];
    const seen = new Set();
    team.xi.forEach((pid) => {
      const p = pid && G.players[pid];
      if (!p || p.t !== team.id) { issues.push('Hay un puesto vacío en el once.'); return; }
      if (seen.has(pid)) issues.push(`${p.n} está repetido.`);
      seen.add(pid);
      if (p.inj > 0) issues.push(`${p.n} está lesionado.`);
      if (p.sus > 0) issues.push(`${p.n} está suspendido.`);
    });
    return issues;
  };

  // Avisos antes del partido: problemas graves y cosas a revisar.
  AI.lineupWarnings = function (team) {
    const G = DT.G;
    const warn = [];
    if (!team.xi) return warn;
    const F = DT.FORMATIONS[team.tac.f];
    const tired = [], outPos = [];
    team.xi.forEach((pid, i) => {
      const p = G.players[pid];
      if (!p || !DT.P.available(p)) return;
      if (p.fit < 70) tired.push(`${p.n.split(' ').slice(-1)[0]} (${Math.round(p.fit)}%)`);
      if (AI.posFactor(p.pos, F.l[i]) < 1) outPos.push(p.n.split(' ').slice(-1)[0]);
    });
    if (tired.length) warn.push(`Cansados en el once: ${tired.join(', ')}.`);
    if (outPos.length) warn.push(`Fuera de su puesto: ${outPos.join(', ')}.`);
    const unhappy = team.xi.map((id) => G.players[id]).filter((p) => p && p.mor < 30);
    if (unhappy.length) warn.push(`Con la moral por el piso: ${unhappy.map((p) => p.n.split(' ').slice(-1)[0]).join(', ')}.`);
    return warn;
  };

  // Media del equipo (mejor once sin importar estado físico).
  AI.rating = function (team) {
    const G = DT.G;
    const ovrs = team.squad.map((id) => G.players[id].ovr).sort((a, b) => b - a).slice(0, 14);
    return Math.round(U.avg(ovrs) * 10) / 10;
  };

  // La IA elige la formación que mejor se adapta a su plantel.
  AI.chooseFormation = function (team) {
    const G = DT.G;
    let best = '4-4-2', bs = -1;
    for (const f of ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-5-1']) {
      const xi = AI.pickXI(team, f, true);
      const F = DT.FORMATIONS[f];
      let s = 0;
      xi.forEach((pid, i) => { if (pid) s += G.players[pid].ovr * AI.posFactor(G.players[pid].pos, F.l[i]); });
      s *= (F.a + F.d) / 2 + U.rf(-0.006, 0.006);
      if (s > bs) { bs = s; best = f; }
    }
    team.tac.f = best;
  };

  // Mentalidad de la IA según la diferencia de nivel con el rival.
  AI.mentalityVs = function (team, opp, home) {
    const d = AI.rating(team) - AI.rating(opp) + (home ? 1.5 : -1.5);
    if (d > 6) return 3;
    if (d < -7) return 1;
    return 2;
  };

  // ---------- Gestión de plantel ----------
  const MIN = { P: 2, D: 6, M: 6, A: 4 };

  AI.countPos = function (team) {
    const c = { P: 0, D: 0, M: 0, A: 0 };
    team.squad.forEach((id) => c[DT.G.players[id].pos]++);
    return c;
  };

  AI.release = function (team, p) {
    team.squad = team.squad.filter((id) => id !== p.id);
    p.t = null;
    p.lst = false;
    if (team.xi) team.xi = team.xi.map((id) => (id === p.id ? null : id));
    if (team.bench) team.bench = team.bench.filter((id) => id !== p.id);
  };

  AI.addToTeam = function (team, p, wage, years) {
    if (p.t) {
      const old = DT.team(p.t);
      if (old) AI.release(old, p);
    }
    p.t = team.id;
    p.num = null;
    delete p.cl; // contrato nuevo: la cláusula se genera de nuevo
    p.w = wage;
    p.cy = years;
    p.lst = false;
    p.mor = Math.max(p.mor, 75);
    team.squad.push(p.id);
  };

  // Completa huecos con libres o regens.
  AI.ensureSquad = function (team) {
    const G = DT.G;
    const c = AI.countPos(team);
    const L = DT.W.teamLevel(team);
    for (const pos of ['P', 'D', 'M', 'A']) {
      while (c[pos] < MIN[pos] || (team.squad.length < 22 && c[pos] < MIN[pos] + 2)) {
        // libre que encaje
        const free = Object.values(G.players).filter((p) => !p.t && p.pos === pos && p.ovr <= L + 4 && p.ovr >= L - 10 && p.age < 34);
        let p;
        if (free.length) {
          p = U.pick(free);
          AI.addToTeam(team, p, DT.P.fairWage(p, team.cc), U.ri(1, 3));
        } else {
          const age = U.ri(18, 30);
          const ovr = U.clamp(Math.round(L - 3 + U.gauss() * 3 + (age < 21 ? -4 : 0)), 38, 82);
          p = DT.P.create({ n: DT.P.genName(team.cc), pos, age, ovr, t: team.id, cy: U.ri(1, 3) });
          team.squad.push(p.id);
        }
        c[pos]++;
        if (team.squad.length > 34) break;
      }
    }
  };

  AI.trimSquad = function (team, max) {
    const G = DT.G;
    max = max || 30;
    while (team.squad.length > max) {
      const c = AI.countPos(team);
      const cands = team.squad.map((id) => G.players[id]).filter((p) => !p.loan && c[p.pos] > MIN[p.pos]);
      if (!cands.length) break;
      cands.sort((a, b) => (a.ovr + (a.age < 22 ? 6 : 0)) - (b.ovr + (b.age < 22 ? 6 : 0)));
      AI.release(team, cands[0]);
    }
  };

  // Renovaciones de la IA a fin de temporada (los contratos con cy=0 vencen).
  AI.renewals = function (team) {
    const G = DT.G;
    const L = DT.W.teamLevel(team);
    for (const pid of team.squad.slice()) {
      const p = G.players[pid];
      if (p.cy > 0) continue;
      const keep = (p.ovr >= L - 7 && p.age <= 33 && U.chance(0.85)) || (p.age <= 22 && p.pot >= L) || (p.ovr >= L + 3 && U.chance(0.7));
      if (keep) {
        p.cy = p.age >= 31 ? 1 : U.ri(2, 4);
        p.w = Math.max(p.w, DT.P.fairWage(p));
      } else {
        AI.release(team, p);
      }
    }
  };

  return AI;
})();
