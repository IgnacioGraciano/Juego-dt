// Prueba sin interfaz: simula varias temporadas completas y muestra estadísticas.
// Uso: node tools/sim_test.js [temporadas] [equipo]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const files = require('./files');

const root = path.join(__dirname, '..');
const ctx = { console, Math, Date, JSON, Object, Array, Set, Map, setTimeout, performance };
vm.createContext(ctx);
for (const f of files.game) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  vm.runInContext(fs.readFileSync(p, 'utf8'), ctx, { filename: f });
}
const DT = vm.runInContext('DT', ctx);
const seasons = +(process.argv[2] || 2);
const teamId = process.argv[3] || 'ARG_RIV';

const t0 = Date.now();
DT.W.newGame(teamId, 'Test');
const G = () => DT.G;
console.log('Equipos:', Object.keys(G().teams).length, 'Jugadores:', Object.keys(G().players).length, 'creación ms', Date.now() - t0);

let goals = 0, matches = 0, homeW = 0, draws = 0, shots = 0;
const origApply = DT.Match.apply;
DT.Match.apply = function (sim) {
  goals += sim.s[0].goals + sim.s[1].goals;
  shots += sim.s[0].shots + sim.s[1].shots;
  matches++;
  if (sim.s[0].goals > sim.s[1].goals) homeW++;
  else if (sim.s[0].goals === sim.s[1].goals) draws++;
  return origApply(sim);
};

const startYear = G().year;
let steps = 0;
const t1 = Date.now();
while (G().year < startYear + seasons && steps < 20000) {
  steps++;
  // resolver decisiones pendientes automáticamente
  for (const m of G().inbox) if (m.actions && !m.done) DT.Act.resolve(m.id, 0);
  const ev = DT.S.advance();
  if (ev.type === 'match') {
    const sim = DT.Match.quick(ev.match);
    if (DT.S.needsPens(ev.match, sim.s[0].goals, sim.s[1].goals)) DT.Match.penalties(sim);
    DT.Match.apply(sim);
    DT.S.record(ev.match, sim);
    DT.S.afterUserMatch();
  } else if (ev.type === 'jobs') {
    console.log('Despedido:', G().pendingOffers.reason);
    DT.Board.takeJob(G().pendingOffers.offers[0]);
  } else if (ev.type === 'seasonEnd') {
    const h = G().history[0];
    console.log(`\n=== Temporada ${h.y} ===`);
    for (const k of Object.keys(h.champs)) if (!k.startsWith('REL') && !k.startsWith('UP')) console.log(k.padEnd(8), h.champs[k][1]);
    console.log('Usuario:', h.user, 'conf', Math.round(G().manager.conf));
    for (const cc of ['ARG', 'BRA']) console.log('Goleadores', cc, JSON.stringify(h.scorers[cc]));
  }
}
console.log('\nSimulación ms', Date.now() - t1, 'steps', steps);
console.log(`Partidos ${matches} · goles/partido ${(goals / matches).toFixed(2)} · remates/partido ${(shots / matches).toFixed(1)} · local gana ${(100 * homeW / matches).toFixed(1)}% · empates ${(100 * draws / matches).toFixed(1)}%`);
const sample = ['BRA_FLA', 'ARG_RIV', 'ARG_BOC', 'ARG_RIE', 'URU_PEN', 'VEN_TAC', 'BOL_ABB', 'PER_UNI', 'COL_NAL'];
for (const id of sample) {
  const t = G().teams[id];
  const last = t.fin.hist[t.fin.hist.length - 1];
  console.log(t.n.padEnd(22), 'caja', DT.U.money(t.cash).padEnd(10), 'ing', last ? DT.U.money(last.inc).padEnd(10) : '', 'gas', last ? DT.U.money(last.exp).padEnd(10) : '', 'sueldos/año', DT.U.money(DT.E.payroll(t)).padEnd(10), 'plantel', t.squad.length, 'media', DT.AI.rating(t), 'rep', t.rep.toFixed(1), 'socios', t.socios);
}
const neg = Object.values(G().teams).filter((t) => !t.eur && t.cash < 0).length;
console.log('Clubes con caja negativa:', neg, '/', Object.values(G().teams).filter((t) => !t.eur).length);
console.log('Jugadores totales:', Object.keys(G().players).length, 'Libres:', Object.values(G().players).filter((p) => !p.t).length);
console.log('Ventas al exterior registradas:', G().abroad.length);
const json = JSON.stringify(DT.Save ? DT.Save.serialize() : G());
console.log('Tamaño del guardado (KB):', Math.round(json.length / 1024));
const u = DT.userTeam();
for (const id of ['BRA_FLA', 'ARG_RIV', 'ARG_RIE']) {
  const t = G().teams[id];
  const d = t.fin.hist[t.fin.hist.length - 1].detail;
  const f = (o) => Object.entries(o).map(([k, v]) => k + ' ' + DT.U.money(v)).join(', ');
  console.log(t.n, '\n  ING:', f(d.inc), '\n  GAS:', f(d.exp));
}

// Ida y vuelta del guardado
const blob = JSON.stringify(DT.Save.serialize());
DT.Save.deserialize(JSON.parse(blob));
const blob2 = JSON.stringify(DT.Save.serialize());
console.log('Guardado ida/vuelta idéntico:', blob === blob2, 'KB', Math.round(blob.length / 1024));
for (let i = 0; i < 6; i++) {
  for (const m of G().inbox) if (m.actions && !m.done) DT.Act.resolve(m.id, 0);
  const ev = DT.S.advance();
  if (ev.type === 'match') {
    const sim = DT.Match.quick(ev.match);
    if (DT.S.needsPens(ev.match, sim.s[0].goals, sim.s[1].goals)) DT.Match.penalties(sim);
    DT.Match.apply(sim); DT.S.record(ev.match, sim); DT.S.afterUserMatch();
  }
}
console.log('Sigue jugando tras cargar: semana', G().week, 'año', G().year);
// Nivel medio por liga (para detectar inflación o caída de nivel con los años)
for (const cc of DT.COUNTRY_ORDER) {
  const ts = Object.values(G().teams).filter((t) => t.lg === cc);
  const avg = ts.reduce((s, t) => s + DT.AI.rating(t), 0) / ts.length;
  const cash = ts.reduce((s, t) => s + t.cash, 0) / ts.length;
  console.log(cc, 'media', avg.toFixed(1), 'caja prom.', DT.U.money(cash), 'top', ts.sort((a, b) => DT.AI.rating(b) - DT.AI.rating(a)).slice(0, 3).map((t) => t.s + ' ' + DT.AI.rating(t)).join(', '));
}
