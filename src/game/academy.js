// Inferiores del club del usuario: 18 juveniles de 14 a 21 años que solo suben al primer equipo
// cuando el DT los asciende. Al cumplir 22 se van libres.
DT.Acad = (function () {
  const U = DT.U;
  const A = {};
  A.SIZE = 18;
  A.MIN_AGE = 14;
  A.MAX_AGE = 21;

  A.list = (team) => ((team && team.academy) || []).map((id) => DT.G.players[id]).filter(Boolean);

  // Un juvenil: la media depende de la edad; el potencial, del nivel de las inferiores y del club.
  A.kid = function (team, age) {
    const lvl = team.infra.youth;
    const at18 = 38 + lvl * 3 + Math.round((team.rep - 50) / 7);
    const ovr = U.clamp(Math.round(at18 - (18 - age) * 4.5 + U.ri(-4, 6)), 22, 72);
    let pot = at18 + U.ri(8, 24) + lvl * 2;
    if (U.chance(0.04 + lvl * 0.015)) pot += U.ri(5, 10); // joya
    pot = U.clamp(pot, ovr + 4, 93);
    const pos = U.weighted(['P', 'D', 'M', 'A'], [1, 3, 3, 2.5]);
    const p = DT.P.create({ n: DT.P.genName(team.cc), pos, age, ovr, pot, t: team.id, cy: 1, yt: true });
    p.acad = 1;
    p.w = 0;
    p.cl = 0;
    return p;
  };
  const youngAge = () => U.weighted([14, 15, 16, 17, 18, 19, 20, 21], [4, 4, 3.5, 3, 2.5, 2, 1.5, 1]);

  // Arma las inferiores si el club no tiene (club nuevo del usuario o partidas anteriores).
  // Los lugares que quedan libres al subir o soltar chicos se llenan con la camada de fin de año.
  A.ensure = function (team) {
    if (team.academy) { team.academy = team.academy.filter((id) => DT.G.players[id]); return; }
    team.academy = [];
    while (team.academy.length < A.SIZE) team.academy.push(A.kid(team, youngAge()).id);
  };

  // Al dejar un club, sus inferiores dejan de seguirse.
  A.drop = function (team) {
    for (const id of team.academy || []) delete DT.G.players[id];
    team.academy = [];
  };

  A.promote = function (pid) {
    const G = DT.G;
    const team = DT.userTeam();
    const p = G.players[pid];
    if (!p || !p.acad || p.t !== team.id) return { ok: false, msg: 'El juvenil ya no está en las inferiores.' };
    team.academy = team.academy.filter((id) => id !== pid);
    delete p.acad;
    p.cy = 3;
    p.w = Math.max(12000, U.round(DT.P.fairWage(p, team.cc) * 0.6, 1000));
    p.cl = U.round(DT.P.value(p) * 3, 5000);
    p.mor = 85;
    p.num = null;
    team.squad.push(pid);
    p.fromAcad = 1;
    DT.news(`${p.n} (${p.age} años) sube al primer equipo de ${team.n}.`, 'squad');
    if (DT.Ach) DT.Ach.unlock('debut');
    return { ok: true, msg: `${p.n} ya es parte del primer equipo (contrato por 3 años).` };
  };

  A.release = function (pid) {
    const team = DT.userTeam();
    const p = DT.G.players[pid];
    if (!p || !p.acad) return;
    team.academy = team.academy.filter((id) => id !== pid);
    delete DT.G.players[pid];
  };

  A.weekly = function (team) {
    for (const p of A.list(team)) DT.P.weeklyDevelop(p, team.infra.youth, U.chance(0.6));
  };

  // Fin de temporada (después de los cumpleaños): se van los mayores de 21 y llegan chicos nuevos.
  A.seasonEnd = function (team) {
    const G = DT.G;
    const left = [], arrived = [], cut = [];
    for (const p of A.list(team)) {
      if (p.age > A.MAX_AGE) {
        team.academy = team.academy.filter((id) => id !== p.id);
        left.push(p.n);
        // queda libre: otro club lo puede fichar
        delete p.acad;
        p.t = null;
        p.w = DT.P.fairWage(p, team.cc);
        p.cy = 0;
      }
    }
    const n = Math.max(3 + (team.infra.youth >= 4 ? 1 : 0), A.SIZE - team.academy.length);
    for (let i = 0; i < n; i++) {
      const k = A.kid(team, U.chance(0.75) ? 14 : 15);
      team.academy.push(k.id);
      arrived.push(k.id);
    }
    // cupo de 18: quedan afuera los de menor proyección (no los recién llegados)
    while (team.academy.length > A.SIZE) {
      const worst = A.list(team).filter((p) => !arrived.includes(p.id)).sort((a, b) => a.pot - b.pot)[0];
      if (!worst) break;
      cut.push(worst.n);
      A.release(worst.id);
    }
    return { left, arrived, cut };
  };

  return A;
})();
