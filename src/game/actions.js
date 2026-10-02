// Respuestas a los mensajes del inbox que requieren una decisión.
DT.Act = (function () {
  const U = DT.U;
  const A = {};

  A.resolve = function (msgId, idx) {
    const G = DT.G;
    const msg = G.inbox.find((m) => m.id === msgId);
    if (!msg || msg.done) return 'Este mensaje ya fue resuelto.';
    const act = msg.actions[idx];
    const me = DT.userTeam();
    let result = '';
    switch (act.id) {
      case 'sponsor': {
        const o = msg.data.offers[act.i];
        me.sponsor = Object.assign({}, o);
        result = `Firmaste con ${o.name}.`;
        break;
      }
      case 'sell': {
        const d = msg.data;
        const p = G.players[d.pid];
        if (!p || p.t !== me.id) { result = 'El jugador ya no está en el club.'; break; }
        if (!DT.S.windowOpen()) { result = 'El libro de pases está cerrado.'; break; }
        DT.M.sellUser(d.pid, d.buyer, d.fee, d.buyerName);
        result = `Vendiste a ${p.n} por ${U.money(d.fee)}.`;
        break;
      }
      case 'counter': {
        const d = msg.data;
        const p = G.players[d.pid];
        if (!p || p.t !== me.id) { result = 'El jugador ya no está en el club.'; break; }
        const newFee = U.round(d.fee * 1.25, 10000);
        const ratio = newFee / DT.P.value(p);
        if (U.chance(U.clamp(1.4 - ratio * 0.6, 0.15, 0.8))) {
          DT.M.sellUser(d.pid, d.buyer, newFee, d.buyerName);
          result = `${d.buyerName} aceptó: vendiste a ${p.n} por ${U.money(newFee)}.`;
        } else {
          result = `${d.buyerName} no aceptó la contraoferta y se retiró.`;
        }
        break;
      }
      case 'reject':
        result = 'Rechazaste la oferta.';
        if (msg.data && G.players[msg.data.pid]) {
          const p = G.players[msg.data.pid];
          if (msg.data.fee > DT.P.value(p) * 1.2 && p.ovr >= 70) {
            p.mor = Math.max(10, p.mor - 12);
            result += ` ${p.n} quedó molesto: quería esa transferencia.`;
          }
        }
        break;
      case 'job':
        G.manager.career.push({ club: me.n, from: G.manager.clubs[G.manager.clubs.length - 1].from, to: G.year, why: 'Cambio de club' });
        DT.Board.takeJob(act.tid);
        result = `Sos el nuevo DT de ${G.teams[act.tid].n}.`;
        // cualquier otra oferta de trabajo pendiente queda sin efecto
        for (const m of G.inbox) if (m !== msg && m.actions && m.actions.some((a) => a.id === 'job')) m.done = true;
        break;
      case 'stay':
        result = `Seguís en ${me.n}.`;
        G.manager.conf = Math.min(100, G.manager.conf + 5);
        break;
      default:
        result = 'Listo.';
    }
    msg.done = true;
    msg.result = result;
    msg.read = true;
    return result;
  };

  return A;
})();
