/* In-page autoplay runner: executes tools/walkthrough.js steps through the real interaction paths. */
(function () {
  var T = BTS.Test, log = function () { console.log('[AUTO] ' + Array.prototype.join.call(arguments, ' ')); };
  var steps = BTS.Walk, si = 0, ai = 0, busy = false, waitUntil = 0, stuck = 0, lastKey = '';
  BTS.Auto = { done: false, error: null, log: [] };
  function ready() { var st = T.state(); return !st.dlg && !st.cut && !st.trans && st.mode === 'play' && !st.screens.length; }
  function tick() {
    if (BTS.Auto.done) return;
    if (BTS.State.flag('game_complete')) { BTS.Auto.done = true; log('DONE: game complete, screens', JSON.stringify(T.state().screens)); return; }
    var now = performance.now();
    if (BTS.Dialogue.active) { T.advance(); return; }
    if (busy || now < waitUntil) return;
    if (!ready()) return;
    var step = steps[si];
    if (!step) { BTS.Auto.done = true; log('DONE'); return; }
    var beat = BTS.State.d.beat;
    if (step.beat && beat !== step.beat && BTS.Story.indexOf(beat) > BTS.Story.indexOf(step.beat)) { si++; ai = 0; return; }
    if (step.beat && beat !== step.beat) {
      var key = beat + ':' + step.beat; if (key !== lastKey) { lastKey = key; stuck = 0; }
      if (++stuck > 400) { BTS.Auto.error = 'stuck waiting for beat ' + step.beat + ' (at ' + beat + ')'; BTS.Auto.done = true; log('ERROR', BTS.Auto.error); }
      return;
    }
    var act = step.do[ai];
    if (!act) { si++; ai = 0; log('step ok', step.beat); return; }
    ai++;
    busy = true;
    var p;
    try {
      switch (act[0]) {
        case 'interact': p = T.goInteract(act[1]); break;
        case 'talk': p = T.goInteract('talk_' + act[1]); break;
        case 'exit': p = T.goInteract('exit_' + act[1]); break;
        case 'observe': p = Promise.resolve(T.observe(act[1])); break;
        case 'link': p = Promise.resolve(T.link(act[1], act[2])); break;
        case 'choose': T.choicePick = function (ch) { return Math.min(act[1], ch.length - 1); }; p = Promise.resolve('ok'); break;
        case 'wait': p = new Promise(function (r) { setTimeout(function () { r('ok'); }, act[1] * 1000); }); break;
        case 'walk': p = new Promise(function (r) { var pl = BTS.World.player; pl.path = BTS.World.findPath(pl.x, pl.z, act[1][0], act[1][1]) || [act[1]]; pl.pathSpeed = 2; var n = 0; var iv = setInterval(function () { if (!pl.path || ++n > 600) { clearInterval(iv); if (n > 600) { pl.x = act[1][0]; pl.z = act[1][1]; } r('ok'); } }, 50); }); break;
        case 'eval': p = Promise.resolve(act[1]()); break;
        default: p = Promise.resolve('unknown action ' + act[0]);
      }
    } catch (e) { p = Promise.resolve('error ' + e.message); }
    Promise.resolve(p).then(function (r) { log(step.beat, JSON.stringify(act.slice(0, 2)), '->', r); BTS.Auto.log.push([step.beat, act[0], act[1], String(r)]); if (String(r).indexOf('no-') === 0 && !BTS.AutoTolerant) { BTS.Auto.error = 'action failed ' + act + ' ' + r; BTS.Auto.done = true; } busy = false; waitUntil = performance.now() + 250; });
  }
  setInterval(tick, 60);
})();
