// node tools/playthrough.mjs [ru|en] [maxSeconds] [screenshotDir]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'path';
const lang = process.argv[2] || 'ru', maxS = +(process.argv[3] || 900), shots = process.argv[4];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
p.on('pageerror', e => { errors.push(e.message); console.log('[pageerror]', e.message); });
p.on('console', m => { const t = m.text(); if (t.startsWith('[AUTO]') || m.type() === 'error' || /WARN/.test(t)) console.log(t.slice(0, 300)); });
await p.addInitScript(l => { localStorage.setItem('bts.settings.v1', JSON.stringify({ language: l, textSpeed: 3, effects: 1 })); }, lang);
await p.goto('file://' + root + '/index.html');
await p.waitForFunction(() => window.BTS && BTS.Game && BTS.Game.mode === 'menu', null, { timeout: 60000 });
await p.evaluate(() => { BTS.App.timeScale = 2; BTS.UI.closeAll(); BTS.Game.newGame(); });
await p.addScriptTag({ path: root + '/tools/walkthrough.js' });
await p.addScriptTag({ path: root + '/tools/autoplay.js' });
const t0 = Date.now(); let lastBeat = '', n = 0;
while (Date.now() - t0 < maxS * 1000) {
  await p.waitForTimeout(2000);
  const st = await p.evaluate(() => ({ beat: BTS.State.d.beat, done: BTS.Auto.done, err: BTS.Auto.error, loc: BTS.World.locId, missing: Object.keys(BTS.I18N.missing), play: BTS.State.d.playtime }));
  if (st.beat !== lastBeat) { lastBeat = st.beat; console.log('BEAT', st.beat, 'loc', st.loc, 'game-time', st.play.toFixed(0) + 's'); if (shots) await p.screenshot({ path: `${shots}/${String(++n).padStart(2, '0')}_${st.beat}.png` }); }
  if (st.done) { console.log(st.err ? 'FAILED: ' + st.err : 'PLAYTHROUGH COMPLETE'); console.log('missing keys:', JSON.stringify(st.missing)); break; }
}
console.log('page errors:', errors.length);
await b.close();
