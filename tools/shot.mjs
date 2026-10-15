// usage: node tools/shot.mjs <url> <out.png> [w h] [waitMs] [clip x,y,w,h]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [url, out, w='1280', h='720', wait='500', clip] = process.argv.slice(2);
const b = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const p = await b.newPage({viewport:{width:+w,height:+h}});
p.on('console', m => { if (m.type()==='error'||m.type()==='warning') console.log('[console]', m.text().slice(0,500)); });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(url); await p.waitForTimeout(+wait);
console.log('title:', await p.title());
const opt = {path: out}; if (clip){const [x,y,cw,ch]=clip.split(',').map(Number);opt.clip={x,y,width:cw,height:ch};}
await p.screenshot(opt); await b.close();
