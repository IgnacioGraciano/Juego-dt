// Cierre de temporada: campeones, clasificados, ascensos/descensos, contratos y juveniles.
DT.End = (function () {
  const U = DT.U;
  const End = {};

  End.season = function () {
    const G = DT.G;
    const SS = G.season;
    const hist = { y: G.year, champs: {}, scorers: {}, user: null };
    const finalPos = {};
    const qual = { LIB: [], SUD: [] };
    const relegatedAll = [];
    const promotedAll = [];
    const userTeam = DT.userTeam();

    // Ligas
    for (const cc of DT.COUNTRY_ORDER) {
      const C = DT.COUNTRIES[cc];
      const comp = SS.comps['L_' + cc];
      const order = DT.S.sortTable(comp.table, comp.teams);
      order.forEach((tid, i) => (finalPos[tid] = i + 1));
      G.prevTables[cc] = order.slice();
      const champ = order[0];
      DT.S.title(champ, comp.name);
      hist.champs['L_' + cc] = [champ, G.teams[champ].n];
      // premios por posición
      order.forEach((tid, i) => {
        const share = Math.pow(1 - i / order.length, 2);
        DT.E.prize(G.teams[tid], C.leaguePrize * 1e6 * share, i === 0 ? `${comp.name}: campeón` : null);
      });
      const cup = SS.comps['C_' + cc];
      if (cup && cup.champion) hist.champs['C_' + cc] = [cup.champion, G.teams[cup.champion].n];
      // goleadores
      const scorers = Object.values(G.players).filter((p) => p.t && G.teams[p.t].lg === cc && p.st.g > 0).sort((a, b) => b.st.g - a.st.g).slice(0, 3);
      hist.scorers[cc] = scorers.map((p) => [p.n, G.teams[p.t].n, p.st.g]);
      // clasificados internacionales
      let lib = order.slice(0, C.lib);
      let sud = order.slice(C.lib, C.lib + C.sud);
      if (cup && cup.champion && !lib.includes(cup.champion)) {
        sud = sud.filter((x) => x !== cup.champion);
        sud.unshift(lib.pop());
        lib.push(cup.champion);
        while (sud.length > C.sud) sud.pop();
      }
      qual.LIB.push(...lib);
      qual.SUD.push(...sud);
      // descensos
      const rel = order.slice(order.length - C.rel);
      relegatedAll.push(...rel.map((tid) => ({ tid, cc })));
      // segunda división: campeón, posiciones y ascensos
      const c2 = SS.comps['B_' + cc];
      if (c2) {
        const o2 = DT.S.sortTable(c2.table, c2.teams);
        o2.forEach((tid, i) => (finalPos[tid] = i + 1));
        G.prevTables['B_' + cc] = o2.slice();
        DT.S.title(o2[0], c2.name);
        hist.champs['B_' + cc] = [o2[0], G.teams[o2[0]].n];
        o2.forEach((tid, i) => DT.E.prize(G.teams[tid], C.leaguePrize * 1e6 * 0.15 * Math.pow(1 - i / o2.length, 2), i === 0 ? `${c2.name}: campeón` : null));
        promotedAll.push(...o2.slice(0, C.rel).map((tid) => ({ tid, cc })));
      }
    }
    for (const id of ['LIB', 'SUD', 'REC', 'INT']) {
      const c = SS.comps[id];
      if (c && c.champion) hist.champs[id] = [c.champion, G.teams[c.champion].n];
    }
    // Campeones vigentes clasifican a la Libertadores
    const lib = SS.comps.LIB, sud = SS.comps.SUD;
    G.holders = { LIB: lib && lib.champion, SUD: sud && sud.champion };
    End.fixQualifiers(qual, [G.holders.LIB, G.holders.SUD].filter(Boolean), relegatedAll.map((r) => r.tid));
    G.nextQual = qual;

    // Evaluación del DT
    const userPos = finalPos[G.user];
    const userRelegated = relegatedAll.some((r) => r.tid === G.user);
    const userComp = SS.comps[DT.divOf(userTeam)];
    hist.user = { team: userTeam.n, pos: userPos, of: userComp ? userComp.teams.length : 0, div: userComp ? userComp.name : '' };
    const userPromoted = promotedAll.some((r) => r.tid === G.user);
    End.reputation(finalPos, relegatedAll, promotedAll);

    // Ascensos y descensos
    for (const cc of DT.COUNTRY_ORDER) {
      const C = DT.COUNTRIES[cc];
      const rel = relegatedAll.filter((r) => r.cc === cc).map((r) => r.tid);
      const up = [];
      if (SS.comps['B_' + cc]) {
        // con segunda división: suben los primeros de la tabla y los que bajan juegan la segunda
        rel.forEach((tid) => { G.teams[tid].lg = null; G.teams[tid].d2 = cc; });
        for (const r of promotedAll.filter((x) => x.cc === cc)) {
          const t = G.teams[r.tid];
          t.d2 = null;
          t.lg = cc;
          up.push(t);
          DT.W.fillSquad(t);
        }
      } else {
        rel.forEach((tid) => (G.teams[tid].lg = null));
        const pool = Object.values(G.teams).filter((t) => t.cc === cc && !t.lg && !t.d2 && !rel.includes(t.id));
        for (let i = 0; i < rel.length && pool.length; i++) {
          const t = U.weighted(pool, pool.map((x) => Math.pow(x.rep - 40, 2)));
          pool.splice(pool.indexOf(t), 1);
          t.lg = cc;
          up.push(t);
          DT.W.fillSquad(t, { P: 3, D: 7, M: 7, A: 5 });
        }
      }
      DT.news(`${DT.COUNTRIES[cc].league}: descienden ${rel.map((id) => G.teams[id].n).join(' y ')}. Ascienden ${up.map((t) => t.n).join(' y ')}.`, 'world');
      hist.champs['REL_' + cc] = rel.map((id) => G.teams[id].n);
      hist.champs['UP_' + cc] = up.map((t) => t.n);
    }

    DT.Board.seasonEnd(userPos, userRelegated, userPromoted);

    // Finanzas: cierre del ejercicio
    for (const id in G.teams) if (!G.teams[id].eur) DT.E.closeSeason(G.teams[id]);

    // Jugadores: edad, retiros, contratos, juveniles
    End.players();

    G.history.unshift(hist);
    G.year++;
    DT.S.startSeason(false);
    DT.inbox({ title: `Arranca la temporada ${G.year}`, body: 'Revisá contratos, el mercado de pases está abierto hasta la semana 4.', kind: 'info' });
  };

  // Ajusta las listas a 32 equipos cada una.
  End.fixQualifiers = function (qual, holders, relegated) {
    const G = DT.G;
    const libSet = new Set(qual.LIB);
    for (const h of holders) {
      if (!libSet.has(h) && G.teams[h]) {
        qual.LIB.push(h);
        libSet.add(h);
        qual.SUD = qual.SUD.filter((x) => x !== h);
      }
    }
    const countBy = (list) => list.reduce((m, id) => ((m[G.teams[id].cc] = (m[G.teams[id].cc] || 0) + 1), m), {});
    while (qual.LIB.length > 32) {
      const c = countBy(qual.LIB);
      const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
      for (let i = qual.LIB.length - 1; i >= 0; i--) {
        const id = qual.LIB[i];
        if (G.teams[id].cc === top && !holders.includes(id)) { qual.LIB.splice(i, 1); qual.SUD.unshift(id); break; }
      }
    }
    while (qual.SUD.length > 32) {
      const c = countBy(qual.SUD);
      const top = Object.keys(c).sort((a, b) => c[b] - c[a])[0];
      for (let i = qual.SUD.length - 1; i >= 0; i--) {
        if (G.teams[qual.SUD[i]].cc === top) { qual.SUD.splice(i, 1); break; }
      }
    }
    if (qual.SUD.length < 32) {
      const used = new Set(qual.LIB.concat(qual.SUD));
      const extra = Object.values(G.teams).filter((t) => t.lg && !used.has(t.id) && !relegated.includes(t.id)).sort((a, b) => b.rep - a.rep);
      while (qual.SUD.length < 32 && extra.length) qual.SUD.push(extra.shift().id);
    }
  };

  End.reputation = function (finalPos, relegated, promoted) {
    const G = DT.G;
    for (const cc of DT.COUNTRY_ORDER) {
      const ids = Object.values(G.teams).filter((t) => t.lg === cc).sort((a, b) => b.rep - a.rep).map((t) => t.id);
      const n = ids.length;
      ids.forEach((tid, expected) => {
        const t = G.teams[tid];
        const pos = finalPos[tid] || n;
        let d = U.clamp(((expected + 1 - pos) / n) * 5, -3, 3);
        if (pos === 1) d += 2;
        t.rep = U.clamp(Math.round((t.rep + d) * 10) / 10, 45, 99);
      });
    }
    for (const r of relegated) G.teams[r.tid].rep = Math.max(45, G.teams[r.tid].rep - 3);
    for (const r of promoted || []) G.teams[r.tid].rep = Math.min(99, Math.max(G.teams[r.tid].rep + 3, 58));
    const SS = G.season;
    for (const [id, bonus] of [['LIB', 3], ['SUD', 2], ['INT', 2], ['REC', 1]]) {
      const c = SS.comps[id];
      if (c && c.champion && G.teams[c.champion] && !G.teams[c.champion].eur) G.teams[c.champion].rep = Math.min(99, G.teams[c.champion].rep + bonus);
    }
    // los equipos de la B tienden a un nivel medio
    for (const id in G.teams) {
      const t = G.teams[id];
      if (!t.lg && !t.eur) t.rep += ((t.d2 ? 57 : 52) - t.rep) * 0.1;
    }
  };

  End.players = function () {
    const G = DT.G;
    const me = DT.userTeam();
    const leaving = [], retired = [];
    DT.M.returnLoans();
    for (const pid in G.players) {
      const p = G.players[pid];
      const team = p.t ? G.teams[p.t] : null;
      if (team && team.eur) continue;
      DT.P.ageUp(p);
      p.fit = 100; p.sus = 0; p.yc = 0;
      p.inj = Math.max(0, p.inj - 6);
      if (U.chance(DT.P.retireChance(p))) {
        if (team) {
          if (DT.isUser(team.id)) retired.push(p.n);
          DT.AI.release(team, p);
        }
        if (p.real && p.car.pj > 150) DT.news(`Se retiró ${p.n} (${p.car.pj} partidos, ${p.car.g} goles).`, 'world');
        delete G.players[pid];
        continue;
      }
      if (team) {
        p.cy -= 1;
        if (p.cy <= 0 && DT.isUser(team.id)) {
          leaving.push(p.n);
          DT.AI.release(team, p);
        }
      }
    }
    // Joyas de inferiores que esperaban a fin de temporada
    const promotedKids = [];
    for (const y of G.pendingYouth || []) {
      const t = G.teams[y.t];
      if (!t || !DT.isUser(t.id)) continue;
      const p = DT.P.create({ n: y.n, pos: y.pos, age: y.age + 1, ovr: y.ovr, pot: y.pot, t: t.id, cy: 4, yt: true });
      p.w = 15000;
      t.squad.push(p.id);
      promotedKids.push(p.id);
    }
    G.pendingYouth = [];
    // IA: renovaciones, juveniles y completar planteles
    for (const id in G.teams) {
      const t = G.teams[id];
      if (t.eur) continue;
      if (!DT.isUser(id)) DT.AI.renewals(t);
      const n = 2 + (t.infra.youth >= 4 ? 1 : 0) + (U.chance(0.4) ? 1 : 0);
      const kids = [];
      for (let i = 0; i < n; i++) {
        const k = DT.P.youth(t);
        t.squad.push(k.id);
        kids.push(k);
      }
      if (DT.isUser(id)) {
        // aviso en pantalla con los juveniles que subieron al plantel
        G.notices = (G.notices || []).concat([{ kind: 'youth', title: 'Suben juveniles al primer equipo', pids: promotedKids.concat(kids.map((k) => k.id)) }]);
        DT.inbox({ title: 'Suben juveniles de la cantera', body: kids.map((k) => `${k.n} (${U.posName[k.pos]}, ${k.age} años, media ${k.ovr}, potencial ${'★'.repeat(DT.P.stars(k.pot))})`).join('. ') + '.', kind: 'squad' });
      } else {
        DT.AI.ensureSquad(t);
        DT.AI.trimSquad(t, 30);
      }
    }
    // Libres: limitar la bolsa
    const free = Object.values(G.players).filter((p) => !p.t);
    if (free.length > 500) {
      free.sort((a, b) => a.ovr - b.ovr).slice(0, free.length - 500).forEach((p) => delete G.players[p.id]);
    }
    if (leaving.length) DT.inbox({ title: 'Contratos vencidos', body: `Se fueron libres: ${leaving.join(', ')}.`, kind: 'squad' });
    if (retired.length) DT.inbox({ title: 'Retiros', body: `Colgaron los botines: ${retired.join(', ')}.`, kind: 'squad' });
    DT.AI.autoLineup(me);
  };

  return End;
})();
