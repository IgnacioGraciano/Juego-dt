// Eventos aleatorios con decisiones: prensa, vestuario, hinchada, directiva y más.
DT.Ev = (function () {
  const U = DT.U;
  const Ev = {};

  const team = () => DT.userTeam();
  const squad = () => team().squad.map((id) => DT.G.players[id]);
  const money = (base) => U.round(base * (0.3 + DT.E.W(team())), 1000);
  const allMor = (d) => squad().forEach((p) => (p.mor = U.clamp(p.mor + d, 10, 100)));
  const conf = (d) => (DT.G.manager.conf = U.clamp(DT.G.manager.conf + d, 0, 100));
  const lastName = (p) => p.n.split(' ').slice(-1)[0];
  const stars = () => squad().filter((p) => !p.loan || p.loan.from === team().id).sort((a, b) => b.ovr - a.ovr);
  const recentResult = (res) => {
    const r = DT.G.lastResult;
    return r && r.y === DT.G.year && DT.G.week - r.w <= 1 && r.res === res ? r : null;
  };
  const nextUserMatch = () => DT.S.userFixtures().find((m) => !m.p);

  // Cada evento: cond() devuelve datos o null; make(d) arma el mensaje; apply(d, i) aplica la opción elegida.
  const DEFS = {
    pressLoss: {
      cond: () => { const r = recentResult(0); return r ? { opp: r.opp, sc: `${r.mine}-${r.theirs}`, derby: r.derby } : null; },
      make: (d) => ({
        title: 'Conferencia de prensa',
        body: `Después de la derrota ${d.sc} ante ${d.opp}${d.derby ? ' en el clásico' : ''}, los periodistas te preguntan por el momento del equipo.`,
        opts: [['Bancar al plantel', 'El vestuario lo valora; la directiva quería autocrítica.'], ['Criticar el rendimiento', 'La directiva aprueba, pero los jugadores se molestan.'], ['Apuntar contra el arbitraje', 'La hinchada lo festeja. Puede haber multa.']],
      }),
      apply: (d, i) => {
        if (i === 0) { allMor(4); conf(-2); return 'El plantel agradece el respaldo. La directiva hubiera preferido otra respuesta.'; }
        if (i === 1) { allMor(-5); conf(3); return 'La directiva valora la exigencia. En el vestuario cayó mal.'; }
        if (U.chance(0.55)) { const f = money(40000); DT.E.add(team(), 'Staff', -f); return `La liga te multó con ${U.money(f)} por tus declaraciones. La hinchada te banca.`; }
        allMor(2); return 'Tus declaraciones encendieron a la hinchada y no hubo sanción.';
      },
    },
    pressWin: {
      cond: () => { const r = recentResult(1); return r && (r.mine - r.theirs >= 2 || r.derby) ? { opp: r.opp, sc: `${r.mine}-${r.theirs}`, derby: r.derby } : null; },
      make: (d) => ({
        title: 'Conferencia de prensa',
        body: `Gran triunfo ${d.sc} sobre ${d.opp}${d.derby ? ' en el clásico' : ''}. Los micrófonos te esperan.`,
        opts: [['Elogiar al plantel', 'Sube el ánimo de los jugadores.'], ['Pedir humildad', 'Mensaje prudente que gusta a la directiva.'], ['Chicanear al rival', 'La hinchada explota de alegría; la directiva no tanto.']],
      }),
      apply: (d, i) => {
        if (i === 0) { allMor(4); return 'Los jugadores salen agrandados.'; }
        if (i === 1) { conf(3); allMor(1); return 'La directiva destaca tu equilibrio.'; }
        const t = team(); t.socios = Math.round(t.socios * 1.015); conf(-2); allMor(3);
        return `Tus frases se hicieron virales: se asociaron ${U.num(Math.round(t.socios * 0.015))} hinchas nuevos, pero la directiva te pidió mesura.`;
      },
    },
    raise: {
      cond: () => {
        const p = stars().slice(0, 6).find((x) => DT.P.avgRating(x) >= 6.9 && x.st.pj >= 5 && x.w < DT.P.fairWage(x) * 0.95 && x.mor >= 35);
        return p ? { pid: p.id } : null;
      },
      make: (d) => { const p = DT.G.players[d.pid]; return {
        title: `${p.n} pide un aumento`,
        body: `${p.n} viene rindiendo (promedio ${DT.P.avgRating(p).toFixed(2)}) y su representante pide mejorar el contrato. Hoy cobra ${U.money(p.w)} por año.`,
        opts: [[`Darle +20% (${U.money(p.w * 1.2)})`, 'Queda feliz.'], [`Ofrecer +10% (${U.money(p.w * 1.1)})`, 'Puede aceptar o no.'], ['Negarse', 'Se va a enojar.']],
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (!p || p.t !== team().id) return 'El jugador ya no está en el club.';
        if (i === 0) { p.w = U.round(p.w * 1.2, 1000); p.mor = Math.min(100, p.mor + 15); return `${p.n} firmó la mejora y está feliz.`; }
        if (i === 1) {
          p.w = U.round(p.w * 1.1, 1000);
          if (U.chance(0.6)) { p.mor = Math.min(100, p.mor + 8); return `${p.n} aceptó el 10%.`; }
          p.mor = Math.max(10, p.mor - 8); return `${p.n} aceptó el 10% de mala gana.`;
        }
        p.mor = Math.max(10, p.mor - 18); return `${p.n} quedó muy molesto.`;
      },
    },
    wantsOut: {
      cond: () => { const p = squad().find((x) => x.mor < 33 && !x.lst && !x.loan && x.ovr >= DT.W.teamLevel(team()) - 2); return p ? { pid: p.id } : null; },
      make: (d) => { const p = DT.G.players[d.pid]; return {
        title: `${p.n} quiere irse`,
        body: `${p.n} está disconforme con su situación y pide que lo dejen salir.`,
        opts: [['Ponerlo en venta', 'Se calma y empiezan a llegar ofertas.'], ['Convencerlo de quedarse', 'Charla mano a mano: puede salir bien o mal.'], ['Negarse', 'Se queda, pero enojado.']],
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (!p || p.t !== team().id) return 'El jugador ya no está en el club.';
        if (i === 0) { p.lst = true; p.mor = Math.min(100, p.mor + 8); return `${p.n} quedó en venta.`; }
        if (i === 1) { if (U.chance(0.5)) { p.mor = Math.min(100, p.mor + 25); return `La charla funcionó: ${p.n} se compromete con el club.`; } p.mor = Math.max(10, p.mor - 5); return `${p.n} no quedó convencido.`; }
        p.mor = Math.max(10, p.mor - 10); allMor(-1); return `${p.n} se queda a disgusto y el vestuario lo nota.`;
      },
    },
    barra: {
      cond: () => { const f = team().form.slice(-4); return f.filter((r) => r === 'P').length >= 3 ? {} : null; },
      make: () => ({
        title: 'La barra presiona',
        body: 'Después de la mala racha, la barra colgó banderas contra el plantel y pide reunirse con vos.',
        opts: [[`Reunirse (${U.money(money(30000))})`, 'Se calman las aguas.'], ['Ignorarlos', 'Riesgo de incidentes y sanción.'], [`Reforzar la seguridad (${U.money(money(70000))})`, 'Evitás problemas en los próximos partidos.']],
      }),
      apply: (d, i) => {
        const t = team();
        if (i === 0) { DT.E.add(t, 'Staff', -money(30000)); conf(2); allMor(2); return 'La reunión bajó la tensión.'; }
        if (i === 2) { DT.E.add(t, 'Mantenimiento', -money(70000)); return 'Los próximos partidos se jugarán sin incidentes.'; }
        if (U.chance(0.45)) { t.anger = 3; conf(-3); return 'Hubo incidentes en la tribuna: la liga sanciona al club y por 3 semanas irá menos gente a la cancha.'; }
        return 'La protesta no pasó a mayores.';
      },
    },
    derbyWeek: {
      cond: () => { const m = nextUserMatch(); if (!m || m.w !== DT.G.week) return null; const n = DT.isDerby(m.h, m.a); return n ? { name: n, opp: DT.team(m.h === DT.G.user ? m.a : m.h).n } : null; },
      make: (d) => ({
        title: `Semana de ${d.name}`,
        body: `Se viene el partido contra ${d.opp}. La ciudad no habla de otra cosa.`,
        opts: [[`Premio especial al plantel (${U.money(money(120000))})`, 'Los jugadores salen motivados.'], ['Concentración extra', 'Más foco, un poco más de cansancio.'], ['Semana normal', 'Sin cambios.']],
      }),
      apply: (d, i) => {
        if (i === 0) { DT.E.add(team(), 'Sueldos', -money(120000)); allMor(10); return 'El plantel está encendido para el clásico.'; }
        if (i === 1) { allMor(5); squad().forEach((p) => (p.fit = Math.max(40, p.fit - 4))); return 'Concentración cerrada: mucho foco, algo de desgaste.'; }
        return 'Semana de trabajo habitual.';
      },
    },
    discipline: {
      cond: () => { const c = squad().filter((p) => p.age < 30 && p.inj <= 0 && p.sus <= 0 && !p.loan); return c.length ? { pid: U.pick(c).id } : null; },
      make: (d) => { const p = DT.G.players[d.pid]; return {
        title: 'Problema de disciplina',
        body: `${p.n} llegó tarde al entrenamiento después de una salida nocturna que se viralizó en redes.`,
        opts: [['Multarlo', 'El jugador se molesta; la directiva aprueba.'], ['Separarlo un partido', 'Mensaje fuerte al vestuario.'], ['Dejarlo pasar', 'Él lo agradece, el resto toma nota.']],
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (!p || p.t !== team().id) return 'El jugador ya no está en el club.';
        if (i === 0) { const f = Math.round(p.w * 0.05); DT.E.add(team(), 'Multas', f); p.mor = Math.max(10, p.mor - 10); conf(1); return `${p.n} pagó una multa de ${U.money(f)}.`; }
        if (i === 1) { p.sus += 1; p.mor = Math.max(10, p.mor - 6); allMor(1); return `${p.n} queda afuera del próximo partido.`; }
        p.mor = Math.min(100, p.mor + 4); allMor(-2); return 'El vestuario siente que hay privilegios.';
      },
    },
    tour: {
      cond: () => { const w = DT.G.week; if (!(w <= 3 || (w >= 20 && w <= 23))) return null; return DT.S.slotMatches(w, 0).some((m) => m.h === DT.G.user || m.a === DT.G.user) ? null : {}; },
      make: () => { const v = U.round(DT.E.sponsorBase(team()) * 0.12 + 50000, 10000); return {
        title: 'Invitación a un amistoso internacional',
        body: `Un organizador ofrece ${U.money(v)} por jugar un amistoso en Estados Unidos esta semana.`,
        opts: [[`Aceptar (+${U.money(v)})`, 'Buena plata, pero el plantel se cansa con el viaje.'], ['Rechazar', 'Priorizás el descanso.']],
        v,
      }; },
      apply: (d, i) => {
        if (i === 0) { DT.E.add(team(), 'Premios', d.v); squad().forEach((p) => (p.fit = Math.max(35, p.fit - 12))); allMor(2); return `Cobraste ${U.money(d.v)}. El plantel volvió cansado.`; }
        return 'El plantel descansa.';
      },
    },
    campaign: {
      cond: () => { const p = stars()[0]; return p && p.ovr >= 70 ? { pid: p.id } : null; },
      make: (d) => { const p = DT.G.players[d.pid]; const v = U.round(DT.E.sponsorBase(team()) * 0.05 + 20000, 5000); return {
        title: 'Campaña publicitaria',
        body: `Una marca quiere a ${p.n} para una campaña. Paga ${U.money(v)} al club, pero le quita horas de descanso.`,
        opts: [[`Aceptar (+${U.money(v)})`, `${lastName(p)} llega más cansado al próximo partido.`], ['Rechazar', 'Prioridad al fútbol.']],
        v,
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (i === 0 && p) { DT.E.add(team(), 'Sponsors', d.v); p.fit = Math.max(40, p.fit - 10); p.mor = Math.min(100, p.mor + 3); return `Cobraste ${U.money(d.v)}.`; }
        return 'Rechazaste la campaña.';
      },
    },
    treatment: {
      cond: () => { const p = stars().slice(0, 14).find((x) => x.inj >= 4); return p ? { pid: p.id } : null; },
      make: (d) => { const p = DT.G.players[d.pid]; const c = U.round(DT.P.value(p) * 0.02 + money(50000), 5000); return {
        title: `Tratamiento para ${p.n}`,
        body: `El médico propone un tratamiento en una clínica del exterior para ${p.n} (${p.inj} semanas de baja). Cuesta ${U.money(c)}.`,
        opts: [[`Pagar (${U.money(c)})`, 'La recuperación se acorta a la mitad.'], ['Esperar', 'Recuperación normal.']],
        c,
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (i === 0 && p && p.inj > 0) { DT.E.add(team(), 'Staff', -d.c); p.inj = Math.ceil(p.inj / 2); return `${p.n} vuelve en ${p.inj} ${p.inj === 1 ? 'semana' : 'semanas'}.`; }
        return 'Se respeta el plazo de recuperación.';
      },
    },
    prices: {
      cond: () => { const t = team(); return t.ticket > DT.E.refTicket(t) * 1.2 || t.fee > DT.COUNTRIES[t.cc].socio * 1.25 ? {} : null; },
      make: () => ({
        title: 'Reclamo de los socios',
        body: 'Las agrupaciones de socios juntaron firmas contra los precios de las entradas y la cuota.',
        opts: [['Bajar precios 15%', 'Se asocia más gente.'], ['Mantener los precios', 'Algunos socios se van.']],
      }),
      apply: (d, i) => {
        const t = team();
        if (i === 0) { t.ticket = Math.max(1, Math.round(t.ticket * 0.85)); t.fee = Math.max(1, Math.round(t.fee * 0.85)); t.socios = Math.round(t.socios * 1.03); conf(1); return 'Bajaste los precios y crecieron los socios.'; }
        t.socios = Math.round(t.socios * 0.97); return 'Se dieron de baja algunos socios.';
      },
    },
    investor: {
      cond: () => { const t = team(); return t.cash < DT.E.estimateRevenue(t) * 0.1 ? {} : null; },
      make: () => { const v = U.round(DT.E.estimateRevenue(team()) * 0.12, 50000); return {
        title: 'Un empresario ofrece plata',
        body: `Un empresario quiere aportar ${U.money(v)} al club a cambio de influir en las decisiones. La directiva te consulta.`,
        opts: [[`Aceptar (+${U.money(v)})`, 'Entra plata, pero la directiva pierde confianza en vos.'], ['Rechazar', 'La directiva valora tu postura.']],
        v,
      }; },
      apply: (d, i) => {
        if (i === 0) { DT.E.add(team(), 'Préstamos', d.v); conf(-6); return `Ingresaron ${U.money(d.v)} a la caja.`; }
        conf(3); return 'La directiva respalda tu decisión.';
      },
    },
    youthStar: {
      cond: () => (DT.G.week >= 8 && DT.G.week <= 36 ? {} : null),
      make: () => {
        const t = team();
        const pos = U.pick(['D', 'M', 'A', 'A']);
        const age = U.ri(16, 17);
        const n = DT.P.genName(t.cc);
        const ovr = U.clamp(Math.round(DT.W.teamLevel(t) - 14 + U.ri(0, 6)), 45, 70);
        const pot = Math.min(92, ovr + U.ri(20, 28));
        return {
          title: 'Una joya en las inferiores',
          body: `Los entrenadores de inferiores hablan maravillas de ${n} (${U.posLong[pos].toLowerCase()}, ${age} años). Dicen que puede ser crack.`,
          opts: [['Subirlo al primer equipo ya', 'Suma minutos de entrenamiento con los grandes.'], ['Dejarlo madurar', 'Sube a fin de temporada, algo más formado.']],
          n, pos, age, ovr, pot,
        };
      },
      apply: (d, i) => {
        const t = team();
        if (i === 0) {
          const p = DT.P.create({ n: d.n, pos: d.pos, age: d.age, ovr: d.ovr, pot: d.pot, t: t.id, cy: 4, yt: true });
          p.w = 15000; t.squad.push(p.id);
          return `${d.n} ya entrena con el primer equipo.`;
        }
        DT.G.pendingYouth = (DT.G.pendingYouth || []).concat([{ n: d.n, pos: d.pos, age: d.age, ovr: d.ovr + 3, pot: Math.min(93, d.pot + 2), t: t.id }]);
        return `${d.n} subirá al plantel a fin de temporada.`;
      },
    },
    callUp: {
      cond: () => { if (![12, 24, 36].includes(DT.G.week)) return null; const p = stars().find((x) => x.ovr >= 75 && x.inj <= 0); return p ? { pid: p.id } : null; },
      make: (d) => { const p = DT.G.players[d.pid]; return {
        title: 'Convocatoria a la selección',
        body: `La selección convocó a ${p.n} para la fecha FIFA. Se perdería el próximo partido.`,
        opts: [['Liberarlo', 'Orgullo para él y el club.'], ['Pedir que no lo convoquen', 'Juega, pero queda molesto.']],
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (!p) return 'Listo.';
        if (i === 0) { p.nt = 1; p.mor = Math.min(100, p.mor + 10); const t = team(); t.socios = Math.round(t.socios * 1.005); return `${p.n} viaja con la selección y no juega el próximo partido.`; }
        p.mor = Math.max(10, p.mor - 15); return `${p.n} se queda, pero no le gustó nada.`;
      },
    },
    poach: {
      cond: () => {
        const G = DT.G;
        if (G.week < 12 || G.week > 38 || G.manager.conf < 55) return null;
        const t = team();
        const c = Object.values(G.teams).filter((x) => x.lg && x.id !== t.id && x.rep > t.rep + 3 && x.rep <= G.manager.rep + 10);
        return c.length ? { tid: U.pick(c).id } : null;
      },
      make: (d) => { const o = DT.team(d.tid); return {
        title: `${o.n} te quiere`,
        body: `${o.n} quiere contratarte ya, en plena temporada. Tu club se enteró.`,
        opts: [[`Aceptar e irte a ${o.n}`, 'Cambio de club inmediato.'], ['Rechazar y quedarte', 'La directiva y los hinchas valoran tu lealtad.']],
      }; },
      apply: (d, i) => {
        const G = DT.G;
        if (i === 0) {
          const me = team();
          G.manager.career.push({ club: me.n, from: G.manager.clubs[G.manager.clubs.length - 1].from, to: G.year, why: 'Se fue a otro club' });
          DT.Board.takeJob(d.tid);
          return `Sos el nuevo DT de ${DT.team(d.tid).n}.`;
        }
        conf(6); allMor(2); return 'Te quedás. La directiva te agradece la lealtad.';
      },
    },
  };

  Ev.weekly = function () {
    const G = DT.G;
    G.evCd = G.evCd || {};
    // eventos sin responder por más de 2 semanas se resuelven con la última opción
    for (const m of G.inbox) {
      if (m.kind === 'event' && !m.done && m.actions && (G.week - m.w >= 3 || m.y !== G.year)) DT.Act.resolve(m.id, m.actions.length - 1);
    }
    if (G.inbox.some((m) => m.kind === 'event' && !m.done)) return;
    if (!U.chance(0.3)) return;
    const now = G.year * 100 + G.week;
    const keys = U.shuffle(Object.keys(DEFS));
    for (const k of keys) {
      if (G.evCd[k] && now - G.evCd[k] < 12) continue;
      const d = DEFS[k].cond();
      if (!d) continue;
      Ev.fire(k, d);
      G.evCd[k] = now;
      return;
    }
  };

  Ev.fire = function (k, d) {
    const m = DEFS[k].make(d);
    const data = Object.assign({ ev: k }, d);
    for (const key of Object.keys(m)) if (!['title', 'body', 'opts'].includes(key)) data[key] = m[key];
    DT.inbox({
      title: m.title,
      body: m.body,
      kind: 'event',
      actions: m.opts.map(([label, sub], i) => ({ id: 'ev', i, label, sub })),
      data,
    });
  };

  Ev.apply = function (data, i) {
    const def = DEFS[data.ev];
    return def ? def.apply(data, i) : 'Listo.';
  };

  Ev.DEFS = DEFS;
  return Ev;
})();
