// node tools/savetest.mjs <targetBeat> [continueBeats] — play to a beat, save, reload page, load, verify, continue.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import path from 'path';
const target = process.argv[2] || 'c1_river', cont = +(process.argv[3] || 2);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 800, height: 450 } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { if (!localStorage.getItem('bts.settings.v1')) localStorage.setItem('bts.settings.v1', JSON.stringify({ language: 'en', textSpeed: 3, effects: 0 })); });
async function boot() { await p.goto('file://' + root + '/index.html'); await p.waitForFunction(() => window.BTS && BTS.Game && BTS.Game.mode === 'menu', null, { timeout: 60000 }); }
async function auto() { await p.addScriptTag({ path: root + '/tools/walkthrough.js' }); await p.addScriptTag({ path: root + '/tools/autoplay.js' }); }
await boot();
await p.evaluate(() => { BTS.App.timeScale = 2; BTS.UI.closeAll(); BTS.Game.newGame(); });
await auto();
const t0 = Date.now();
while (Date.now() - t0 < 1500000) {
  await p.waitForTimeout(1500);
  const s = await p.evaluate(() => ({ beat: BTS.State.d.beat, ok: BTS.Save.canSave(), err: BTS.Auto.error }));
  if (s.err) { console.log('autoplay error', s.err); process.exit(1); }
  if (s.beat === target && s.ok) break;
}
const before = await p.evaluate(() => { BTS.Auto.done = true; BTS.Save.save('2'); return { beat: BTS.State.d.beat, loc: BTS.World.locId, inv: BTS.State.d.inventory.map(i => i.id), clues: BTS.State.d.clueOrder.length, dead: Object.keys(BTS.State.d.npc).filter(k => BTS.State.d.npc[k].dead) }; });
console.log('SAVED', JSON.stringify(before));
await boot();
const after = await p.evaluate(() => { const ok = BTS.Game.loadSlot('2'); return new Promise(r => setTimeout(() => { const inv = BTS.State.d.inventory.map(i => i.id); r({ ok, beat: BTS.State.d.beat, loc: BTS.World.locId, inv, dupes: inv.length !== new Set(inv).size, clues: BTS.State.d.clueOrder.length, deadPresent: BTS.World.entities.filter(e => BTS.State.isDead(e.id) && !e.hidden).map(e => e.id), lang: BTS.I18N.lang }); }, 5000)); });
console.log('LOADED', JSON.stringify(after));
const pass = after.ok && after.beat === before.beat && after.loc === before.loc && !after.dupes && after.clues === before.clues && after.deadPresent.length === 0;
// corrupted file handling
const corrupt = await p.evaluate(() => { localStorage.setItem('bts.save.3', '{"v":3,"sum":"x","body":"{}"}'); return BTS.Save.read('3').error; });
console.log('corrupt slot ->', corrupt);
// continue playing a few beats after load
await p.evaluate(() => { BTS.App.timeScale = 2; BTS.AutoTolerant = true; });  // steps done before the save are gone after loading
await auto();
let seen = 0, last = after.beat; const t1 = Date.now();
while (Date.now() - t1 < 900000 && seen < cont) { await p.waitForTimeout(2000); const s = await p.evaluate(() => ({ beat: BTS.State.d.beat, err: BTS.Auto.error })); if (s.err) { console.log('continue error', s.err); break; } if (s.beat !== last) { seen++; last = s.beat; console.log('continued ->', s.beat); } }
console.log(pass && corrupt === 'corrupt' ? 'SAVE TEST PASS' : 'SAVE TEST FAIL', 'page errors:', errs.length, errs.slice(0, 3));
await b.close();
