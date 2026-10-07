// Guardado compacto de la partida (jugadores y partidos como arrays).
DT.Save = (function () {
  const Save = {};
  const KEY = 'dtsud_save_v1';
  const PF = ['id', 'n', 'pos', 'age', 'ovr', 'pot', 't', 'w', 'cy', 'fit', 'mor', 'inj', 'sus', 'yc', 'xp'];
  const MF = ['i', 'c', 'h', 'a', 'w', 's', 'p', 'st', 'tie', 'n', 'leg', 'hg', 'ag', 'att', 'mvp'];

  Save.serialize = function () {
    const G = DT.G;
    const out = Object.assign({}, G);
    out.players = Object.values(G.players).map((p) => {
      const arr = PF.map((k) => (typeof p[k] === 'number' ? Math.round(p[k] * 100) / 100 : p[k]));
      arr.push([p.st.pj, p.st.g, p.st.a, Math.round(p.st.rs * 10) / 10], [p.car.pj, p.car.g], p.fm, (p.real ? 1 : 0) | (p.lst ? 2 : 0) | (p.yt ? 4 : 0) | (p.played ? 8 : 0), p.from || 0, (p.num || p.loan || p.sellOn || p.nt || p.acad || p.cl !== undefined || p.fromAcad) ? { num: p.num, loan: p.loan, sellOn: p.sellOn, nt: p.nt, acad: p.acad, cl: p.cl, fa: p.fromAcad } : 0);
      return arr;
    });
    const S = G.season;
    out.season = Object.assign({}, S);
    out.season.matches = Object.values(S.matches).map((m) => {
      const arr = MF.map((k) => (m[k] === undefined ? null : m[k]));
      arr.push(m.g === undefined ? null : m.g, m.pen || null, m.sc || null, m.ev || null);
      return arr;
    });
    out.teams = {};
    for (const id in G.teams) {
      // los planteles se reconstruyen desde los jugadores
      out.teams[id] = Object.assign({}, G.teams[id], { squad: undefined });
    }
    return out;
  };

  Save.deserialize = function (data) {
    const G = data;
    const players = {};
    for (const arr of data.players) {
      const p = {};
      PF.forEach((k, i) => (p[k] = arr[i]));
      let j = PF.length;
      const st = arr[j++], car = arr[j++];
      p.st = { pj: st[0], g: st[1], a: st[2], rs: st[3] };
      p.car = { pj: car[0], g: car[1] };
      p.fm = arr[j++] || [];
      const fl = arr[j++] || 0;
      p.real = !!(fl & 1); p.lst = !!(fl & 2); p.yt = !!(fl & 4); p.played = !!(fl & 8);
      const from = arr[j++];
      if (from) p.from = from;
      const ex = arr[j++];
      if (ex) {
        if (ex.num) p.num = ex.num;
        if (ex.loan) p.loan = ex.loan;
        if (ex.sellOn) p.sellOn = ex.sellOn;
        if (ex.nt) p.nt = ex.nt;
        if (ex.acad) p.acad = 1;
        if (ex.cl !== undefined && ex.cl !== null) p.cl = ex.cl;
        if (ex.fa) p.fromAcad = 1;
      }
      players[p.id] = p;
    }
    G.players = players;
    for (const id in G.teams) G.teams[id].squad = [];
    for (const pid in players) {
      const p = players[pid];
      if (p.acad) continue; // las inferiores se guardan en team.academy
      if (p.t && G.teams[p.t]) G.teams[p.t].squad.push(p.id);
      else p.t = null;
    }
    const matches = {};
    for (const arr of data.season.matches) {
      const m = {};
      MF.forEach((k, i) => { if (arr[i] !== null) m[k] = arr[i]; });
      let j = MF.length;
      if (arr[j] !== null) m.g = arr[j];
      if (arr[j + 1]) m.pen = arr[j + 1];
      if (arr[j + 2]) m.sc = arr[j + 2];
      if (arr[j + 3]) m.ev = arr[j + 3];
      if (m.tie === undefined) m.tie = null;
      matches[m.i] = m;
    }
    G.season.matches = matches;
    // orden de planteles del usuario: respetar once
    DT.G = G;
    return G;
  };

  Save.toJSON = () => JSON.stringify(Save.serialize());

  // Compresión gzip + base64 cuando el navegador lo permite.
  async function gz(str) {
    if (typeof CompressionStream === 'undefined') return 'J' + str;
    const cs = new CompressionStream('gzip');
    const buf = await new Response(new Blob([str]).stream().pipeThrough(cs)).arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return 'Z' + btoa(bin);
  }
  async function gunz(s) {
    if (s[0] === 'J') return s.slice(1);
    if (s[0] === '{') return s;
    const bin = atob(s.slice(1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ds = new DecompressionStream('gzip');
    return await new Response(new Blob([bytes]).stream().pipeThrough(ds)).text();
  }
  Save.pack = async () => gz(Save.toJSON());
  Save.unpack = async (s) => Save.deserialize(JSON.parse(await gunz(s.trim())));

  // Tres espacios de guardado en el dispositivo (el 1 usa la clave original).
  Save.SLOTS = 3;
  const keyOf = (n) => (n === 1 ? KEY : KEY + '_' + n);
  Save.slot = 1;
  try { Save.slot = Math.min(Save.SLOTS, Math.max(1, +(localStorage.getItem('dtsud_slot') || 1))); } catch (e) { /* sin almacenamiento */ }
  Save.setSlot = function (n) {
    Save.slot = n;
    try { localStorage.setItem('dtsud_slot', String(n)); } catch (e) { /* sin almacenamiento */ }
  };
  Save.local = async function () {
    try {
      const s = await Save.pack();
      localStorage.setItem(keyOf(Save.slot), s);
      localStorage.setItem(keyOf(Save.slot) + '_meta', JSON.stringify(Save.meta()));
      return true;
    } catch (e) {
      return false;
    }
  };
  Save.meta = function () {
    const G = DT.G;
    const t = DT.userTeam();
    return { team: t.n, tid: t.id, year: G.year, week: G.week, mgr: G.manager.n, at: Date.now(), retired: !!G.retired, fired: !!G.pendingOffers, diff: G.settings.diff };
  };
  Save.localMeta = function (n) {
    try { return JSON.parse(localStorage.getItem(keyOf(n || Save.slot) + '_meta') || 'null'); } catch (e) { return null; }
  };
  Save.allMeta = function () {
    const out = [];
    for (let n = 1; n <= Save.SLOTS; n++) out.push(Save.localMeta(n));
    return out;
  };
  Save.loadLocal = async function (n) {
    let s = null;
    try { s = localStorage.getItem(keyOf(n || Save.slot)); } catch (e) { s = null; }
    if (!s) return false;
    await Save.unpack(s);
    if (n) Save.setSlot(n);
    return true;
  };
  Save.clearLocal = function (n) {
    try { localStorage.removeItem(keyOf(n || Save.slot)); localStorage.removeItem(keyOf(n || Save.slot) + '_meta'); } catch (e) { /* sin acceso */ }
  };

  // Guardado en la nube (capability db del artifact), en partes de 200 KB.
  Save.cloud = { db: null, uid: null, ready: false };
  Save.initCloud = async function () {
    try {
      if (typeof window === 'undefined' || !window.claude || !window.claude.use) return false;
      const db = await window.claude.use('db');
      const user = await window.claude.use('user');
      if (!db || !user) return false;
      const uid = await user.id();
      if (!uid) return false;
      Save.cloud = { db, uid, ready: true };
      return true;
    } catch (e) {
      return false;
    }
  };
  const CHUNK = 200000;
  Save.cloudSave = async function () {
    const c = Save.cloud;
    if (!c.ready) return false;
    try {
      const s = await Save.pack();
      const parts = Math.ceil(s.length / CHUNK);
      for (let i = 0; i < parts; i++) {
        await c.db.doc(`data/users/${c.uid}/save_${i}`).set({ d: s.slice(i * CHUNK, (i + 1) * CHUNK) });
      }
      await c.db.doc(`data/users/${c.uid}/meta`).set(Object.assign(Save.meta(), { parts }));
      return true;
    } catch (e) {
      return false;
    }
  };
  Save.cloudMeta = async function () {
    const c = Save.cloud;
    if (!c.ready) return null;
    try {
      const snap = await c.db.doc(`data/users/${c.uid}/meta`).get();
      return snap && snap.exists ? snap.data() : null;
    } catch (e) {
      return null;
    }
  };
  Save.cloudLoad = async function () {
    const c = Save.cloud;
    const meta = await Save.cloudMeta();
    if (!meta) return false;
    let s = '';
    for (let i = 0; i < meta.parts; i++) {
      const snap = await c.db.doc(`data/users/${c.uid}/save_${i}`).get();
      if (!snap || !snap.exists) return false;
      s += snap.data().d;
    }
    await Save.unpack(s);
    return true;
  };

  return Save;
})();
