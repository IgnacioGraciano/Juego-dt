// Núcleo: espacio de nombres, utilidades y formato.
var DT = (typeof DT !== 'undefined') ? DT : {};
DT.TEAMS = DT.TEAMS || {};
DT.VERSION = 1;

DT.U = (function () {
  const U = {};
  U.r = Math.random;
  U.ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  U.rf = (a, b) => a + Math.random() * (b - a);
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  U.gauss = () => {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  // Elige un elemento según pesos (array de números).
  U.weighted = (items, weights) => {
    let tot = 0;
    for (const w of weights) tot += w;
    let x = Math.random() * tot;
    for (let i = 0; i < items.length; i++) {
      x -= weights[i];
      if (x <= 0) return items[i];
    }
    return items[items.length - 1];
  };
  U.sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  U.avg = (arr, f) => (arr.length ? U.sum(arr, f) / arr.length : 0);
  U.round = (v, step) => Math.round(v / step) * step;

  // Dinero en USD → "$12,4 M" / "$850 K"
  U.money = (v, short) => {
    const neg = v < 0;
    const a = Math.abs(v);
    let s;
    if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2).replace('.', ',') + ' M';
    else if (a >= 1e3) s = Math.round(a / 1e3) + ' K';
    else s = Math.round(a) + '';
    if (short) s = s.replace(',00 M', ' M');
    return (neg ? '-' : '') + '$' + s;
  };
  U.num = (v) => Math.round(v).toLocaleString('es-AR');
  U.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.posName = { P: 'POR', D: 'DEF', M: 'MED', A: 'DEL' };
  U.posLong = { P: 'Arquero', D: 'Defensor', M: 'Mediocampista', A: 'Delantero' };
  return U;
})();

// Estado global de la partida.
DT.G = null;

DT.team = (id) => DT.G.teams[id];
DT.player = (id) => DT.G.players[id];
DT.userTeam = () => DT.G.teams[DT.G.user];
DT.isUser = (tid) => DT.G && DT.G.user === tid;

// Noticias e inbox.
DT.news = function (text, kind) {
  const G = DT.G;
  G.news.unshift({ y: G.year, w: G.week, t: text, k: kind || 'info' });
  if (G.news.length > 80) G.news.length = 80;
};

// Mensaje al usuario. Si tiene `actions`, queda pendiente de decisión.
DT.inbox = function (msg) {
  const G = DT.G;
  msg.id = G.nextMsg++;
  msg.y = G.year; msg.w = G.week;
  msg.read = false;
  G.inbox.unshift(msg);
  if (G.inbox.length > 60) {
    // conserva pendientes
    G.inbox = G.inbox.filter((m, i) => i < 40 || (m.actions && !m.done));
  }
  return msg;
};
