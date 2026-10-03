// Recorrido de la interfaz en un navegador con tamaño de celular.
// Uso: NODE_PATH=$(npm root -g) node tools/ui_test.js [carpeta_capturas]
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const out = process.argv[2] || path.join(__dirname, '..', 'shots');
  require('fs').mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: process.env.DARK ? 'dark' : 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'));
  const shot = async (n) => page.screenshot({ path: path.join(out, n + '.png'), fullPage: false });
  const click = async (sel) => { await page.click(sel); await page.waitForTimeout(150); };

  await page.waitForSelector('#mgrname');
  await shot('01-inicio');
  await page.fill('#mgrname', 'Prueba');
  await click('[data-a="stCountry"][data-cc="ARG"]');
  await click('[data-a="stNext"]');
  await shot('02-clubes');
  await click('[data-a="stPick"][data-code="RAC"]');
  await shot('03-home');
  // elegir sponsor
  const sp = await page.$('[data-a="msgAct"]');
  if (sp) await click('[data-a="msgAct"]');
  // tabs
  for (const t of ['squad', 'comp', 'market', 'club']) {
    await click(`[data-a="tab"][data-tab="${t}"]`);
    await shot('04-' + t);
  }
  await click('[data-a="tab"][data-tab="squad"]');
  await click('[data-a="sub"][data-v="tac"]');
  await shot('05-tactica');
  await click('[data-a="sub"][data-v="list"]');
  await click('.li[data-a="player"]');
  await shot('06-ficha');
  await click('[data-a="closeModal"]');
  // mercado: oferta
  await click('[data-a="tab"][data-tab="market"]');
  await click('#main .li[data-a="player"]');
  await click('[data-a="buyOpen"]');
  await shot('07-oferta');
  await click('[data-a="closeModal"]');
  // avanzar hasta el primer partido
  await click('[data-a="tab"][data-tab="home"]');
  for (let i = 0; i < 6; i++) {
    await click('[data-a="advance"]');
    if (await page.$('#overlay:not([hidden])')) break;
    const ms = await page.$$('[data-a="msgAct"]');
    if (ms.length) await click('[data-a="msgAct"]');
  }
  await shot('08-previa');
  await click('[data-a="mLive"]');
  await shot('09a-cancha-inicio');
  await click('[data-a="mToggle"]');
  await page.waitForTimeout(4000);
  await shot('09-envivo');
  await click('[data-a="mEnd"]');
  await page.waitForTimeout(300);
  await shot('10-final');
  await click('[data-a="mDone"]');
  // varias semanas más con resultado rápido
  for (let i = 0; i < 25; i++) {
    const ms = await page.$$('[data-a="msgAct"]');
    if (ms.length) await click('[data-a="msgAct"]');
    await click('[data-a="advance"]');
    if (await page.$('#overlay:not([hidden])')) {
      await click('[data-a="mQuick"]');
      await click('[data-a="mDone"]');
    }
  }
  await shot('11-home-semana');
  await click('[data-a="tab"][data-tab="comp"]');
  await shot('12-tabla');
  await click('[data-a="compSel"][data-id="LIB"]');
  await shot('13-libertadores');
  await click('[data-a="tab"][data-tab="club"]');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('14-finanzas');
  await click('[data-a="sub"][data-v="stad"]');
  await shot('15-estadio');
  const saved = await page.evaluate(() => localStorage.getItem('dtsud_save_v1') ? localStorage.getItem('dtsud_save_v1').length : 0);
  const week = await page.evaluate(() => DT.G.week + ' ' + DT.G.year);
  // recargar y continuar
  await page.reload();
  await page.waitForSelector('[data-a="loadLocal"]');
  await click('[data-a="loadLocal"]');
  const week2 = await page.evaluate(() => DT.G.week + ' ' + DT.G.year);
  await shot('16-recargado');
  if (process.env.LONG) {
    // jugar hasta el final de la temporada
    for (let i = 0; i < 200; i++) {
      if (await page.evaluate(() => DT.G.history.length > 0)) break;
      if (await page.$('#modal:not([hidden]) [data-a="takeJob"]')) { await click('[data-a="takeJob"]'); continue; }
      if (await page.$('#modal:not([hidden])')) await click('#modal [data-a="closeModal"]');
      const ms = await page.$$('[data-a="msgAct"]');
      if (ms.length) await click('[data-a="msgAct"]');
      await click('[data-a="advance"]');
      if (await page.$('#overlay:not([hidden])')) { await click('[data-a="mQuick"]'); await click('[data-a="mDone"]'); }
    }
    await shot('17-fin-temporada');
    if (await page.$('#modal:not([hidden])')) await click('#modal [data-a="closeModal"]');
    await click('[data-a="tab"][data-tab="club"]');
    await click('[data-a="sub"][data-v="hist"]');
    await shot('18-historial');
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  console.log(JSON.stringify({ saved, week, week2, overflow, errors }, null, 1));
  await browser.close();
})();
