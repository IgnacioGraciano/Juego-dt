// Motor de partidos: simulación minuto a minuto.
DT.Match = (function () {
  const U = DT.U;
  const M = {};

  const LINES = { P: 0, D: 1, M: 2, A: 3 };

  function sideSetup(team, isUser, oppTeam, home) {
    const G = DT.G;
    let xi, bench, tac;
    if (isUser) {
      if (team.autoXI || DT.AI.lineupIssues(team).length) DT.AI.autoLineup(team);
      xi = team.xi.slice();
      bench = (team.bench || DT.AI.pickBench(team, xi)).filter((id) => G.players[id] && G.players[id].t === team.id && DT.P.available(G.players[id]) && !xi.includes(id)).slice(0, 9);
      tac = { f: team.tac.f, m: team.tac.m, p: team.tac.p };
    } else {
      xi = DT.AI.pickXI(team);
      bench = DT.AI.pickBench(team, xi);
      tac = { f: team.tac.f, m: DT.AI.mentalityVs(team, oppTeam, home), p: team.tac.p };
    }
    const F = DT.FORMATIONS[tac.f];
    const on = xi.map((pid, i) => ({ id: pid, slot: F.l[i], i })).filter((x) => x.id);
    return {
      tid: team.id,
      user: isUser,
      tac,
      on, // {id, slot}
      bench,
      subs: 0,
      out: [], // expulsados / reemplazados
      goals: 0,
      shots: 0,
      sot: 0,
      poss: 0,
      yel: 0,
      red: 0,
      rating: {},
      played: new Set(on.map((x) => x.id)),
    };
  }

  // Valores de ataque/medio/defensa de un once (0-100) para mostrar en la UI.
  M.preview = function (team, tac, xi) {
    const G = DT.G;
    const sim = { s: [{ tac: tac || team.tac, on: [] }], neutral: true };
    const F = DT.FORMATIONS[(tac || team.tac).f];
    (xi || team.xi || []).forEach((pid, i) => { if (pid && G.players[pid]) sim.s[0].on.push({ id: pid, slot: F.l[i] }); });
    const st = strength(sim, 0);
    return { att: Math.round(st.att / 4), mid: Math.round(st.mid / 5.5), def: Math.round(st.def / 5.6), gk: Math.round(st.gk) };
  };

  // Clima del partido (decorativo) según país y época del año.
  M.weather = function (home) {
    const w = DT.G ? DT.G.week : 10;
    const cold = { ARG: 1, URU: 1, CHI: 1, BRA: 0, PAR: 0, BOL: 1, PER: 0, ECU: 0, COL: 0, VEN: 0 }[home.cc];
    // semanas 14-30 ≈ otoño/invierno austral
    const winter = cold && w >= 14 && w <= 30;
    const base = home.cc === 'BOL' ? 8 : winter ? 6 : cold ? 17 : 22;
    const min = base + U.ri(-3, 3), max = min + U.ri(5, 9);
    const sky = U.weighted(['Despejado', 'Nublado', 'Parcialmente nublado', 'Lluvia', 'Llovizna'], [5, 2, 3, 1.2, 1]);
    return { sky, min, max };
  };

  M.create = function (match, opts) {
    const G = DT.G;
    const h = G.teams[match.h], a = G.teams[match.a];
    const hu = DT.isUser(h.id) && !(opts && opts.aiOnly), au = DT.isUser(a.id) && !(opts && opts.aiOnly);
    const sim = {
      match,
      min: 0,
      half: 1,
      added1: U.ri(0, 3),
      added2: U.ri(1, 5),
      done: false,
      events: [],
      neutral: !!match.neutral,
      s: [sideSetup(h, hu, a, true), sideSetup(a, au, h, false)],
      verbose: hu || au || (opts && opts.verbose),
      weather: M.weather(h),
      derby: DT.isDerby(h.id, a.id),
    };
    for (const side of sim.s) for (const x of side.on) side.rating[x.id] = 6.2;
    return sim;
  };

  function eff(p, slot) {
    return p.ovr * DT.AI.posFactor(p.pos, slot) * (0.7 + 0.3 * p.fit / 100) * (0.96 + 0.08 * p.mor / 100);
  }

  function strength(sim, i) {
    const G = DT.G;
    const side = sim.s[i];
    const F = DT.FORMATIONS[side.tac.f];
    let A = 0, Mi = 0, D = 0, gk = 30;
    for (const x of side.on) {
      const p = G.players[x.id];
      const e = eff(p, x.slot);
      if (x.slot === 'P') gk = e;
      else if (x.slot === 'D') { D += e; Mi += 0.25 * e; A += 0.1 * e; }
      else if (x.slot === 'M') { Mi += e; D += 0.35 * e; A += 0.4 * e; }
      else { A += e; Mi += 0.25 * e; D += 0.1 * e; }
    }
    const m = side.tac.m, pr = side.tac.p;
    const attM = [0.8, 0.9, 1, 1.1, 1.2][m];
    const defM = [1.18, 1.09, 1, 0.92, 0.84][m];
    const midM = [0.95, 1, 1.06][pr];
    let home = 1;
    if (!sim.neutral) home = i === 0 ? 1.035 : 0.98;
    return { att: A * attM * F.a * home, mid: Mi * midM * home, def: D * defM * F.d * home, gk: gk * home };
  }

  function addEvent(sim, side, type, text, pid) {
    if (!sim.verbose) return;
    sim.events.push({ m: sim.min, side, type, text, pid });
  }

  function pickWeighted(sim, i, weights, exclude) {
    const G = DT.G;
    const list = sim.s[i].on.filter((x) => x.id !== exclude);
    if (!list.length) return null;
    const ws = list.map((x) => (weights[x.slot] || 0.1) * G.players[x.id].ovr);
    return U.weighted(list, ws).id;
  }

  const shortName = (p) => {
    const parts = p.n.split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : p.n;
  };

  const GOAL_TXT = [
    (s, a) => `¡GOOOL! ${s} define cruzado${a ? ` tras el pase de ${a}` : ''}.`,
    (s, a) => `¡GOL! ${s} la clava al ángulo${a ? `, asistido por ${a}` : ''}.`,
    (s, a) => `¡Golazo de ${s}! Remate desde afuera del área${a ? ` después de una pared con ${a}` : ''}.`,
    (s, a) => `¡GOL! Cabezazo de ${s}${a ? ` tras el centro de ${a}` : ''}.`,
    (s, a) => `¡Adentro! ${s} empuja la pelota en el área chica${a ? ` tras la jugada de ${a}` : ''}.`,
    (s) => `¡GOL de penal! ${s} cambia por gol y no le da chances al arquero.`,
  ];
  const MISS_TXT = [
    (s) => `${s} remata desviado por poco.`,
    (s) => `Disparo de ${s} que se va por arriba del travesaño.`,
    (s) => `¡Palo! ${s} estuvo muy cerca.`,
    (s) => `${s} se perfila y le pega mordido.`,
  ];
  const SAVE_TXT = [
    (s, g) => `¡Atajadón de ${g}! Le sacó el remate a ${s}.`,
    (s, g) => `${g} contiene sin problemas el tiro de ${s}.`,
    (s, g) => `Mano a mano de ${s}, pero ${g} achica bien y tapa.`,
  ];

  function gkOf(sim, i) {
    const x = sim.s[i].on.find((o) => o.slot === 'P');
    return x ? DT.G.players[x.id] : null;
  }

  // Un minuto de partido.
  M.step = function (sim) {
    const G = DT.G;
    if (sim.done) return;
    sim.min++;
    sim.last = null;
    const limit1 = 45 + sim.added1, limit2 = 90 + sim.added2;
    if (sim.half === 1 && sim.min > limit1) {
      sim.half = 2;
      sim.min = 45;
      addEvent(sim, -1, 'ht', `Entretiempo. ${sim.s[0].goals}-${sim.s[1].goals}.`);
      sim.paused = sim.verbose ? 'ht' : null;
      return;
    }
    if (sim.half === 2 && sim.min > limit2) {
      M.finish(sim);
      return;
    }
    const st = [strength(sim, 0), strength(sim, 1)];
    // IA ajusta la mentalidad según el resultado.
    if (sim.min >= 65) {
      for (let i = 0; i < 2; i++) {
        const side = sim.s[i];
        if (side.user) continue;
        const diff = side.goals - sim.s[1 - i].goals;
        if (diff < 0) side.tac.m = Math.min(4, Math.max(side.tac.m, 3));
        else if (diff > 0 && sim.min >= 75) side.tac.m = Math.min(side.tac.m, 1);
      }
      if (sim.min % 5 === 0) for (let i = 0; i < 2; i++) if (!sim.s[i].user || sim.autoSubs) M.aiSubs(sim, i);
    }
    // Posesión del minuto
    const m0 = Math.pow(st[0].mid, 2), m1 = Math.pow(st[1].mid, 2);
    const att = U.chance(m0 / (m0 + m1)) ? 0 : 1;
    const def = 1 - att;
    sim.s[att].poss++;
    const r = st[att].att / Math.max(1, st[def].def) / 0.78;
    // lo que pasó en el minuto, para la cancha animada
    sim.last = { att, r, shot: null, cards: [] };
    const c = 0.24 * Math.pow(U.clamp(r, 0.25, 3), 1.5);
    if (U.chance(c)) {
      const shooterId = pickWeighted(sim, att, { A: 5, M: 2, D: 0.45, P: 0 });
      if (shooterId) {
        const sh = G.players[shooterId];
        const gk = gkOf(sim, def);
        const gkEff = gk ? eff(gk, 'P') : 25;
        const q = U.clamp(0.098 * Math.pow(sh.ovr / Math.max(20, gkEff), 1.25), 0.03, 0.3);
        sim.s[att].shots++;
        const onTarget = U.chance(0.35 + q);
        if (onTarget) sim.s[att].sot++;
        sim.last.shot = { pid: shooterId, on: onTarget, goal: false };
        if (onTarget && U.chance((q * 1.1) / (0.35 + q))) {
          // gol
          sim.s[att].goals++;
          sim.last.shot.goal = true;
          const asId = U.chance(0.75) ? pickWeighted(sim, att, { M: 3, A: 2, D: 1, P: 0.05 }, shooterId) : null;
          sim.last.shot.aid = asId;
          const as = asId ? G.players[asId] : null;
          sim.s[att].rating[shooterId] = (sim.s[att].rating[shooterId] || 6) + 1.1;
          if (asId) sim.s[att].rating[asId] = (sim.s[att].rating[asId] || 6) + 0.6;
          if (gk) sim.s[def].rating[gk.id] = (sim.s[def].rating[gk.id] || 6) - 0.4;
          (sim.scorers = sim.scorers || []).push({ side: att, pid: shooterId, aid: asId, m: sim.min });
          const tx = U.pick(GOAL_TXT)(shortName(sh), as ? shortName(as) : null);
          addEvent(sim, att, 'goal', tx, shooterId);
        } else if (onTarget) {
          if (gk) sim.s[def].rating[gk.id] = (sim.s[def].rating[gk.id] || 6) + 0.15;
          if (U.chance(0.35)) addEvent(sim, att, 'save', U.pick(SAVE_TXT)(shortName(sh), gk ? shortName(gk) : 'el arquero'));
        } else if (U.chance(0.3)) {
          addEvent(sim, att, 'miss', U.pick(MISS_TXT)(shortName(sh)));
        }
      }
    }
    // Tarjetas y lesiones
    for (let i = 0; i < 2; i++) {
      const side = sim.s[i];
      const pf = [0.85, 1, 1.25][side.tac.p];
      if (U.chance(0.021 * pf)) {
        const pid = pickWeighted(sim, i, { D: 3, M: 2, A: 1, P: 0.15 });
        if (pid) M.card(sim, i, pid, false);
      } else if (U.chance(0.0006 * pf)) {
        const pid = pickWeighted(sim, i, { D: 3, M: 2, A: 1, P: 0.15 });
        if (pid) M.card(sim, i, pid, true);
      }
      const injRisk = 0.0011 * (1.25 - 0.1 * G.teams[side.tid].infra.med) * pf;
      if (U.chance(injRisk)) {
        const pid = pickWeighted(sim, i, { D: 1, M: 1, A: 1, P: 0.3 });
        if (pid) M.injury(sim, i, pid);
      }
      // Cansancio
      const tire = [0.15, 0.18, 0.23][side.tac.p];
      for (const x of side.on) {
        const p = G.players[x.id];
        p.fit = Math.max(5, p.fit - tire * (p.age >= 32 ? 1.15 : 1) * U.rf(0.7, 1.3));
      }
    }
  };

  M.card = function (sim, i, pid, straightRed) {
    const G = DT.G;
    if (sim.last) sim.last.cards.push({ side: i, pid, red: !!straightRed });
    const side = sim.s[i];
    const p = G.players[pid];
    side.cards = side.cards || {};
    if (!straightRed) {
      side.cards[pid] = (side.cards[pid] || 0) + 1;
      side.yel++;
      p.yc++;
      side.rating[pid] = (side.rating[pid] || 6) - 0.3;
      if (side.cards[pid] >= 2) {
        addEvent(sim, i, 'red', `Segunda amarilla para ${p.n}. ¡Expulsado!`, pid);
        M.sendOff(sim, i, pid, 1);
      } else {
        addEvent(sim, i, 'yellow', `Amarilla para ${p.n}.`, pid);
      }
    } else {
      addEvent(sim, i, 'red', `¡Roja directa para ${p.n}!`, pid);
      M.sendOff(sim, i, pid, U.ri(1, 3));
    }
  };

  M.sendOff = function (sim, i, pid, ban) {
    const side = sim.s[i];
    side.red++;
    side.rating[pid] = (side.rating[pid] || 6) - 1;
    side.on = side.on.filter((x) => x.id !== pid);
    side.out.push(pid);
    DT.G.players[pid].sus += ban;
    // Si echan al arquero, un jugador de campo va al arco.
    if (!side.on.some((x) => x.slot === 'P') && side.on.length) {
      if (!side.user || sim.autoSubs) {
        const gk = side.bench.map((id) => DT.G.players[id]).find((p) => p.pos === 'P');
        if (gk && side.subs < 5) {
          const outX = side.on.filter((x) => x.slot !== 'P').sort((a, b) => DT.G.players[a.id].ovr - DT.G.players[b.id].ovr)[0];
          M.sub(sim, i, outX.id, gk.id);
          return;
        }
      }
      side.on[side.on.length - 1].slot = 'P';
    }
  };

  M.injury = function (sim, i, pid) {
    const G = DT.G;
    const side = sim.s[i];
    const p = G.players[pid];
    const med = G.teams[side.tid].infra.med;
    const weeks = Math.max(1, Math.round(U.weighted([1, 2, 3, 4, 6, 8, 12, 20], [30, 22, 15, 11, 9, 6, 4, 2]) * (1.2 - med * 0.08)));
    p.inj = weeks;
    addEvent(sim, i, 'inj', `${p.n} se lesiona (${weeks} ${weeks === 1 ? 'semana' : 'semanas'} de baja).`, pid);
    sim.injuries = sim.injuries || [];
    sim.injuries.push({ side: i, pid, weeks });
    if (!side.user || sim.autoSubs) {
      const repl = M.bestBenchFor(sim, i, side.on.find((x) => x.id === pid).slot);
      if (repl && side.subs < 5) M.sub(sim, i, pid, repl);
      else { side.on = side.on.filter((x) => x.id !== pid); side.out.push(pid); }
    } else {
      sim.paused = 'inj';
      sim.injuredPid = pid;
    }
  };

  M.bestBenchFor = function (sim, i, slot) {
    const G = DT.G;
    const side = sim.s[i];
    let best = null, bs = -1;
    for (const id of side.bench) {
      const p = G.players[id];
      if (!p || p.inj > 0) continue;
      const s = p.ovr * DT.AI.posFactor(p.pos, slot);
      if (s > bs) { bs = s; best = id; }
    }
    return best;
  };

  M.sub = function (sim, i, outId, inId) {
    const G = DT.G;
    const side = sim.s[i];
    if (side.subs >= 5) return false;
    const x = side.on.find((o) => o.id === outId);
    if (!x || !side.bench.includes(inId)) return false;
    x.id = inId;
    side.bench = side.bench.filter((b) => b !== inId);
    side.out.push(outId);
    side.played.add(inId);
    side.rating[inId] = side.rating[inId] || 6.1;
    side.subs++;
    addEvent(sim, i, 'sub', `Cambio: entra ${G.players[inId].n} por ${G.players[outId].n}.`, inId);
    return true;
  };

  // Cambios automáticos: cansados o resultado.
  M.aiSubs = function (sim, i) {
    const G = DT.G;
    const side = sim.s[i];
    if (side.subs >= 5 || !side.bench.length) return;
    const tired = side.on.filter((x) => x.slot !== 'P').map((x) => ({ x, p: G.players[x.id] })).sort((a, b) => a.p.fit - b.p.fit);
    for (const t of tired) {
      if (side.subs >= 5) break;
      if (t.p.fit > 62 && !(sim.min >= 70 && U.chance(0.25))) continue;
      const repl = M.bestBenchFor(sim, i, t.x.slot);
      if (!repl) break;
      const rp = G.players[repl];
      if (rp.ovr * DT.AI.posFactor(rp.pos, t.x.slot) < t.p.ovr * 0.82 && t.p.fit > 45) continue;
      M.sub(sim, i, t.x.id, repl);
      if (U.chance(0.5)) break;
    }
  };

  M.finish = function (sim) {
    sim.done = true;
    // notas finales: resultado, valla invicta y rendimiento individual
    for (let i = 0; i < 2; i++) {
      const side = sim.s[i];
      const gf = side.goals, ga = sim.s[1 - i].goals;
      for (const pid of side.played) {
        const p = DT.G.players[pid];
        if (!p) continue;
        let rt = side.rating[pid] || 6;
        rt += gf > ga ? 0.4 : gf < ga ? -0.3 : 0;
        if (ga === 0 && (p.pos === 'D' || p.pos === 'P')) rt += 0.5;
        rt += U.gauss() * 0.45 + (p.ovr - 70) * 0.015;
        side.rating[pid] = Math.round(U.clamp(rt, 3.5, 10) * 10) / 10;
      }
    }
    sim.min = Math.min(sim.min, 90 + sim.added2);
    addEvent(sim, -1, 'end', `¡Final del partido! ${sim.s[0].goals}-${sim.s[1].goals}.`);
  };

  // Penales (para llaves empatadas).
  M.penalties = function (sim) {
    const G = DT.G;
    const shooters = sim.s.map((side) => side.on.filter((x) => x.slot !== 'P').map((x) => G.players[x.id]).sort((a, b) => b.ovr - a.ovr));
    const gks = [gkOf(sim, 0), gkOf(sim, 1)];
    const score = [0, 0];
    const log = [];
    let k = 0;
    const kick = (i) => {
      const list = shooters[i].length ? shooters[i] : [G.players[sim.s[i].on[0].id]];
      const sh = list[k % list.length];
      const gk = gks[1 - i];
      const p = U.clamp(0.76 + (sh.ovr - (gk ? gk.ovr : 60)) * 0.004, 0.6, 0.9);
      const ok = U.chance(p);
      if (ok) score[i]++;
      log.push({ side: i, n: sh.n, ok });
    };
    for (; k < 5; k++) {
      kick(0);
      if (score[0] > score[1] + (5 - k)) break;
      kick(1);
      if (score[1] > score[0] + (4 - k) || score[0] > score[1] + (4 - k)) break;
    }
    while (score[0] === score[1]) {
      kick(0); kick(1); k++;
      if (k > 30) { score[U.ri(0, 1)]++; }
    }
    sim.pens = score;
    sim.pensLog = log;
    addEvent(sim, -1, 'pens', `Penales: ${score[0]}-${score[1]}.`);
    return score;
  };

  M.quick = function (match) {
    const sim = M.create(match, { aiOnly: false });
    sim.autoSubs = true;
    sim.verbose = false;
    while (!sim.done) {
      M.step(sim);
      sim.paused = null;
    }
    return sim;
  };

  // Aplica el resultado: estadísticas, moral, suspensiones.
  M.apply = function (sim) {
    const G = DT.G;
    const match = sim.match;
    match.hg = sim.s[0].goals;
    match.ag = sim.s[1].goals;
    match.p = 1;
    if (sim.pens) match.pen = sim.pens.slice();
    if (sim.scorers) match.sc = sim.scorers.map((s) => [s.side, s.pid, s.m]);
    for (let i = 0; i < 2; i++) {
      const side = sim.s[i];
      const team = G.teams[side.tid];
      const gf = side.goals, ga = sim.s[1 - i].goals;
      const res = gf > ga ? 'G' : gf < ga ? 'P' : 'E';
      team.form.push(res);
      if (team.form.length > 10) team.form.shift();
      const delta = res === 'G' ? 4 : res === 'P' ? -4 : 0;
      for (const pid of side.played) {
        const p = G.players[pid];
        if (!p) continue;
        const rt = side.rating[pid] || 6;
        p.st.pj++; p.car.pj++;
        p.st.rs += rt;
        p.fm.push(Math.round(rt * 10) / 10);
        if (p.fm.length > 5) p.fm.shift();
        p.mor = U.clamp(p.mor + delta * 0.6 + (rt - 6.5) * 2, 10, 100);
        p.played = true;
      }
      // los que no juegan: los importantes pierden un poco de moral
      for (const pid of team.squad) {
        const p = G.players[pid];
        if (!side.played.has(pid) && p.ovr >= DT.W.teamLevel(team) + 2 && p.inj <= 0) p.mor = Math.max(10, p.mor - 1.2);
      }
      // suspensiones: cumplen fecha los que no jugaron estando suspendidos
      for (const pid of team.squad) {
        const p = G.players[pid];
        if (p.sus > 0 && !side.played.has(pid) && !side.out.includes(pid)) p.sus--;
        if (p.yc >= 5) { p.yc = 0; p.sus += 1; }
      }
    }
    if (sim.scorers) {
      for (const s of sim.scorers) {
        const p = G.players[s.pid];
        if (p) { p.st.g++; p.car.g++; }
        if (s.aid && G.players[s.aid]) G.players[s.aid].st.a++;
      }
    }
    // Figura del partido
    let best = null, br = 0;
    for (let i = 0; i < 2; i++) for (const pid in sim.s[i].rating) {
      const r = sim.s[i].rating[pid];
      if (r > br) { br = r; best = +pid; }
    }
    match.mvp = best;
  };

  return M;
})();
