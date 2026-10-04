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

    agentOffer: {
      cond: () => (DT.G.week >= 2 && DT.G.week <= 40 && team().squad.length < 32 ? {} : null),
      make: () => {
        const t = team();
        const pos = U.pick(['D', 'M', 'A', 'M', 'A']);
        const age = U.ri(24, 31);
        const n = DT.P.genName(U.pick(DT.COUNTRY_ORDER));
        const ovr = U.clamp(Math.round(DT.W.teamLevel(t) + U.ri(-1, 4)), 50, 84);
        const w = U.round(DT.P.fairWage({ ovr, age, pos, pot: ovr }, t.cc) * 1.15, 1000);
        const fee = U.round(w * 0.6 + 20000, 5000);
        return {
          title: 'Un representante te ofrece un jugador',
          body: `El representante de ${n} (${U.posLong[pos].toLowerCase()}, ${age} años, media ${ovr}) dice que está libre y quiere jugar en tu club. Pide ${U.money(w)} por año y una comisión de ${U.money(fee)}.`,
          opts: [[`Ficharlo (comisión ${U.money(fee)})`, 'Llega ya, con contrato por 2 años.'], ['No me interesa', 'Seguís con el plantel que tenés.']],
          n, pos, age, ovr, w, fee,
        };
      },
      apply: (d, i) => {
        if (i !== 0) return 'Le agradeciste al representante y no avanzaste.';
        const t = team();
        const p = DT.P.create({ n: d.n, pos: d.pos, age: d.age, ovr: d.ovr, pot: d.ovr + U.ri(0, 3), t: t.id, cy: 2 });
        p.w = d.w;
        t.squad.push(p.id);
        DT.E.add(t, 'Fichajes', -d.fee);
        return `${d.n} firmó por 2 años. Pagaste ${U.money(d.fee)} de comisión.`;
      },
    },
    concert: {
      cond: () => (team().cap >= 15000 ? {} : null),
      make: () => { const v = U.round(team().cap * U.rf(4, 7) + 30000, 10000); return {
        title: 'Recital en el estadio',
        body: `Una productora quiere alquilar el estadio para un recital y paga ${U.money(v)}. El cuerpo técnico avisa que el césped va a quedar a la miseria un par de semanas.`,
        opts: [[`Alquilar (+${U.money(v)})`, 'Entra plata; el plantel se queja del campo.'], ['No alquilar', 'El césped queda impecable.']],
        v,
      }; },
      apply: (d, i) => {
        if (i === 0) { DT.E.add(team(), 'Taquilla', d.v); allMor(-3); return `Cobraste ${U.money(d.v)}. Los jugadores protestan por el estado de la cancha.`; }
        allMor(1); return 'El césped queda en perfectas condiciones.';
      },
    },
    fatigueStar: {
      cond: () => { const p = stars().slice(0, 11).find((x) => x.fit < 72 && x.inj <= 0); const m = nextUserMatch(); return p && m && m.w === DT.G.week ? { pid: p.id } : null; },
      make: (d) => { const p = DT.G.players[d.pid]; return {
        title: `Alerta física: ${p.n}`,
        body: `El preparador físico avisa que ${p.n} está al límite (${Math.round(p.fit)}% de físico) y hay riesgo de lesión si juega esta semana.`,
        opts: [['Darle descanso', 'No juega el próximo partido y recupera todo el físico.'], ['Que juegue igual', 'Puede rendir... o romperse.']],
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (!p || p.t !== team().id) return 'El jugador ya no está en el club.';
        if (i === 0) { p.fit = 100; p.nt = 2; return `${p.n} descansa esta semana y vuelve a full.`; }
        if (U.chance(0.35)) { p.inj = U.ri(2, 4); return `${p.n} se resintió en la práctica: ${p.inj} semanas afuera.`; }
        p.mor = Math.min(100, p.mor + 4); return `${p.n} agradece la confianza y está disponible.`;
      },
    },
    lockerFight: {
      cond: () => { const s = stars().filter((p) => p.age >= 26 && !p.loan); return s.length >= 2 ? { a: s[0].id, b: s[1].id } : null; },
      make: (d) => { const a = DT.G.players[d.a], b = DT.G.players[d.b]; return {
        title: 'Pelea en el vestuario',
        body: `${a.n} y ${b.n} discutieron fuerte después de la práctica y casi se van a las manos. El vestuario espera tu reacción.`,
        opts: [[`Respaldar a ${lastName(a)}`, `${lastName(b)} se enoja.`], [`Respaldar a ${lastName(b)}`, `${lastName(a)} se enoja.`], ['Multar a los dos', 'Mensaje de autoridad: nadie queda contento.']],
      }; },
      apply: (d, i) => {
        const a = DT.G.players[d.a], b = DT.G.players[d.b];
        if (!a || !b) return 'La situación se resolvió sola.';
        if (i === 0) { a.mor = Math.min(100, a.mor + 8); b.mor = Math.max(10, b.mor - 15); return `${a.n} se siente respaldado; ${b.n} quedó dolido.`; }
        if (i === 1) { b.mor = Math.min(100, b.mor + 8); a.mor = Math.max(10, a.mor - 15); return `${b.n} se siente respaldado; ${a.n} quedó dolido.`; }
        a.mor = Math.max(10, a.mor - 6); b.mor = Math.max(10, b.mor - 6); conf(2);
        DT.E.add(team(), 'Multas', Math.round((a.w + b.w) * 0.03));
        return 'Multaste a los dos. La directiva aprueba la mano dura.';
      },
    },
    charity: {
      cond: () => (DT.G.week >= 3 && DT.G.week <= 42 ? {} : null),
      make: () => ({
        title: 'Visita solidaria',
        body: 'Una fundación invita al plantel a visitar un hospital de chicos y a donar camisetas firmadas en la semana.',
        opts: [['Ir con todo el plantel', 'Gran imagen, un poco menos de descanso.'], ['Mandar a una delegación', 'Algo intermedio.'], ['No ir', 'Sin cambios.']],
      }),
      apply: (d, i) => {
        const t = team();
        if (i === 0) { t.socios = Math.round(t.socios * 1.01); allMor(4); squad().forEach((p) => (p.fit = Math.max(40, p.fit - 3))); conf(2); return 'La visita emocionó a todos: suben los socios y el ánimo del plantel.'; }
        if (i === 1) { allMor(2); conf(1); return 'Una delegación representó al club. Buena repercusión.'; }
        return 'El plantel siguió con la rutina.';
      },
    },
    tvSchedule: {
      cond: () => { const m = nextUserMatch(); return m && m.h === DT.G.user && m.c.startsWith('L_') ? { mid: m.i } : null; },
      make: () => { const v = U.round(DT.E.tvAnnual(team()) * 0.03 + 20000, 5000); return {
        title: 'La TV quiere cambiar el horario',
        body: `La televisión ofrece ${U.money(v)} extra para pasar tu próximo partido de local a un lunes a las 22. Los hinchas ya protestan en redes.`,
        opts: [[`Aceptar (+${U.money(v)})`, 'Menos gente en la cancha y socios molestos.'], ['Rechazar', 'Se juega en el horario de siempre.']],
        v,
      }; },
      apply: (d, i) => {
        const t = team();
        if (i === 0) { DT.E.add(t, 'TV', d.v); t.anger = Math.max(t.anger || 0, 1); t.socios = Math.round(t.socios * 0.995); return `Cobraste ${U.money(d.v)}. Va a ir menos gente al partido.`; }
        t.socios = Math.round(t.socios * 1.003); return 'Los hinchas valoran que defiendas el horario.';
      },
    },
    youthCoach: {
      cond: () => (team().infra.youth >= 2 ? {} : null),
      make: () => { const c = money(90000); return {
        title: 'Quieren llevarse al coordinador de inferiores',
        body: `Otro club le ofrece el doble de sueldo al coordinador de las inferiores. Para retenerlo hay que pagarle ${U.money(c)} más por año.`,
        opts: [[`Retenerlo (${U.money(c)})`, 'La cantera sigue igual.'], ['Dejarlo ir', 'Puede bajar el nivel de las inferiores.']],
        c,
      }; },
      apply: (d, i) => {
        const t = team();
        if (i === 0) { DT.E.add(t, 'Staff', -d.c); return 'El coordinador se queda y la cantera sigue trabajando bien.'; }
        if (U.chance(0.45) && t.infra.youth > 1) { t.infra.youth--; return `Se fue y se notó: las divisiones inferiores bajan a nivel ${t.infra.youth}.`; }
        return 'Se fue, pero su reemplazo está a la altura.';
      },
    },
    boardChallenge: {
      cond: () => { const M = DT.G.manager; return DT.G.week >= 4 && DT.G.week <= 20 && M.obj && M.obj.target >= 4 && M.conf >= 50 ? {} : null; },
      make: () => { const M = DT.G.manager; const v = U.round(DT.E.estimateRevenue(team()) * 0.06, 50000); const nt = Math.max(1, M.obj.target - 2); return {
        title: 'La directiva te propone un desafío',
        body: `El presidente ofrece ${U.money(v)} extra para reforzar el plantel si te comprometés a terminar entre los ${nt} primeros (hoy el objetivo es top ${M.obj.target}).`,
        opts: [[`Aceptar (+${U.money(v)})`, 'Más plata, objetivo más exigente.'], ['Mantener el objetivo', 'Sin cambios.']],
        v, nt,
      }; },
      apply: (d, i) => {
        const M = DT.G.manager;
        if (i === 0) {
          DT.E.add(team(), 'Préstamos', d.v);
          M.obj.target = d.nt;
          M.obj.text = `Objetivo exigente: terminar entre los ${d.nt} primeros.`;
          conf(3);
          return `Ingresaron ${U.money(d.v)}. Nuevo objetivo: top ${d.nt}.`;
        }
        return 'Seguís con el objetivo original.';
      },
    },
    veteran: {
      cond: () => { const p = squad().find((x) => x.age >= 34 && x.cy <= 1 && x.t && !x.loan); return p && DT.G.week >= 25 ? { pid: p.id } : null; },
      make: (d) => { const p = DT.G.players[d.pid]; return {
        title: `${p.n} piensa en el retiro`,
        body: `${p.n} (${p.age} años) te confiesa que está pensando en colgar los botines a fin de año. Es una voz importante en el vestuario.`,
        opts: [['Convencerlo de seguir un año más', 'Renueva por un año con el mismo sueldo.'], ['Respetar su decisión', 'Se despide a fin de temporada.']],
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (!p || p.t !== team().id) return 'El jugador ya no está en el club.';
        if (i === 0) { p.cy += 1; p.mor = Math.min(100, p.mor + 10); allMor(2); return `${p.n} renovó por un año más.`; }
        allMor(1); return `${p.n} jugará sus últimos partidos con el club. El vestuario se lo agradece.`;
      },
    },
    socialPost: {
      cond: () => { const c = squad().filter((p) => p.mor < 50 && !p.loan); return c.length ? { pid: U.pick(c).id } : null; },
      make: (d) => { const p = DT.G.players[d.pid]; return {
        title: 'Polémica en redes',
        body: `${p.n} publicó un mensaje criticando sus pocos minutos. Se hizo viral y los periodistas preguntan.`,
        opts: [['Hablar en privado y darle más minutos', 'Se calma, pero el resto lo nota.'], ['Multarlo', 'Autoridad; él se enoja.'], ['Ignorar el tema', 'Puede seguir creciendo.']],
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (!p || p.t !== team().id) return 'El jugador ya no está en el club.';
        if (i === 0) { p.mor = Math.min(100, p.mor + 15); allMor(-1); return `${p.n} se comprometió a hablar puertas adentro.`; }
        if (i === 1) { const f = Math.round(p.w * 0.04); DT.E.add(team(), 'Multas', f); p.mor = Math.max(10, p.mor - 10); conf(1); return `${p.n} fue multado con ${U.money(f)}.`; }
        if (U.chance(0.5)) { p.mor = Math.max(10, p.mor - 8); allMor(-2); return 'El tema siguió en los medios y enrareció el clima.'; }
        return 'La polémica se apagó sola.';
      },
    },
    pitchFlood: {
      cond: () => { const m = nextUserMatch(); return m && m.h === DT.G.user && m.w === DT.G.week && !m.n ? {} : null; },
      make: () => { const c = money(60000); return {
        title: 'Tormenta sobre el estadio',
        body: `Una tormenta dejó el campo anegado y dañó una tribuna. Repararlo de urgencia cuesta ${U.money(c)}.`,
        opts: [[`Reparar ya (${U.money(c)})`, 'El partido se juega con público completo.'], ['Jugar igual', 'Una tribuna clausurada: menos recaudación.']],
        c,
      }; },
      apply: (d, i) => {
        const t = team();
        if (i === 0) { DT.E.add(t, 'Mantenimiento', -d.c); return 'Las cuadrillas trabajaron toda la noche: el estadio está listo.'; }
        t.anger = Math.max(t.anger || 0, 1); return 'Se juega con una tribuna clausurada.';
      },
    },
    rivalTalks: {
      cond: () => { const p = squad().filter((x) => x.age <= 23 && x.pot >= 78 && !x.loan).sort((a, b) => b.pot - a.pot)[0]; return p ? { pid: p.id } : null; },
      make: (d) => { const p = DT.G.players[d.pid]; return {
        title: `Le hablan al oído a ${p.n}`,
        body: `Un club grande contactó a ${p.n} a espaldas tuyas y el chico está distraído. Cobra ${U.money(p.w)} por año y le quedan ${p.cy} ${p.cy === 1 ? 'año' : 'años'} de contrato.`,
        opts: [[`Renovarlo con aumento (+30%, ${p.cy + 2} años)`, 'Asegurás a la promesa.'], ['Charla motivacional', 'Gratis, pero puede no alcanzar.'], ['Dejar que decida', 'Puede pedir irse.']],
      }; },
      apply: (d, i) => {
        const p = DT.G.players[d.pid];
        if (!p || p.t !== team().id) return 'El jugador ya no está en el club.';
        if (i === 0) { p.w = U.round(p.w * 1.3, 1000); p.cy += 2; p.mor = Math.min(100, p.mor + 15); return `${p.n} renovó y está enfocado.`; }
        if (i === 1) { if (U.chance(0.55)) { p.mor = Math.min(100, p.mor + 10); return `${p.n} se quedó tranquilo.`; } p.mor = Math.max(10, p.mor - 8); return `${p.n} sigue con la cabeza en otro lado.`; }
        p.mor = Math.max(10, p.mor - 18); return `${p.n} está molesto y podría pedir salir.`;
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
    if (!U.chance(0.35)) return;
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
