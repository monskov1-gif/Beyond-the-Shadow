/* Application: boot, main loop with clamped delta time, error handling, dev overlay. */
'use strict';
BTS.App = (function () {
  var A = { time: 0, dt: 0, frame: 0, running: false, fps: 0, frameMs: 0, paused: false };
  var last = 0, fpsAcc = 0, fpsN = 0, raf = 0;
  var devEl = null;

  function showFatal(err) {
    BTS.Log.error('FATAL', err);
    var el = document.getElementById('fatal');
    if (!el) return;
    var ru = (BTS.Config.get('language') || 'ru') === 'ru';
    var msg = String(err && err.message || err);
    var head = ru ? 'Произошла ошибка' : 'An error occurred';
    var hint = msg === 'webgl2_unsupported'
      ? (ru ? 'Ваш браузер не поддерживает WebGL2. Попробуйте свежий Chrome, Firefox или Edge.' : 'Your browser does not support WebGL2. Please try a recent Chrome, Firefox or Edge.')
      : msg === 'webgl_lost'
      ? (ru ? 'Графика устройства перезапустилась (не хватило памяти). Перезагрузите страницу — игра включит облегчённый режим. Прогресс сохранён в последней точке сохранения.' : 'The device graphics were reset (out of memory). Reload the page and the game will switch to a lighter mode. Progress is kept at the last save point.')
      : (ru ? 'Прогресс сохранён в последней точке сохранения. Перезагрузите страницу.' : 'Progress is kept at the last save point. Please reload the page.');
    el.innerHTML = '<h2>' + head + '</h2><p>' + hint + '</p><pre></pre><button onclick="location.reload()">' + (ru ? 'Перезагрузить' : 'Reload') + '</button>';
    el.querySelector('pre').textContent = msg;
    el.style.display = 'flex';
  }
  A.fatal = showFatal;

  window.addEventListener('error', function (e) { BTS.Log.error('window error', e.message, e.filename + ':' + e.lineno); if (A.running && A.strictErrors) showFatal(e.error || e.message); });
  window.addEventListener('unhandledrejection', function (e) { BTS.Log.error('unhandled rejection', e.reason); });

  A.start = function (update, render) {
    A.update = update; A.render = render;
    A.running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  A.stop = function () { A.running = false; cancelAnimationFrame(raf); };

  function loop(now) {
    if (!A.running) return;
    raf = requestAnimationFrame(loop);
    var t0 = performance.now();
    var dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (A.timeScale !== undefined) dt *= A.timeScale;
    A.dt = dt; A.time += dt; A.frame++;
    try {
      if (BTS.Touch) BTS.Touch.update();
      BTS.Input.update();
      A.update(dt);
      A.render(dt);
      BTS.Input.endFrame();
    } catch (e) {
      A.errors = (A.errors || 0) + 1;
      BTS.Log.error('frame error', e);
      if (A.errors > 3) { A.stop(); showFatal(e); }
    }
    A.frameMs = performance.now() - t0;
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 0.5) { A.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; updateDev(); }
  }

  function updateDev() {
    if (!BTS.Config.get('devMode')) { if (devEl) devEl.style.display = 'none'; return; }
    if (!devEl) { devEl = document.getElementById('dev'); }
    if (!devEl) return;
    devEl.style.display = 'block';
    var R = BTS.Renderer.stats, W = BTS.World, p = W.player;
    devEl.textContent = 'FPS ' + A.fps.toFixed(0) + '  frame ' + A.frameMs.toFixed(1) + 'ms\n' +
      'draws ' + R.draws + ' tris ' + Math.round(R.tris) + ' sprites ' + R.sprites + ' fx ' + R.fx + '\n' +
      'res ' + BTS.Renderer.internal.join('x') + ' x' + BTS.Renderer.scale + '  particles ' + BTS.Particles.list.length + '\n' +
      'loc ' + W.locId + (p ? '  pos ' + p.x.toFixed(1) + ',' + p.z.toFixed(1) : '') + '\n' +
      'time ' + BTS.Env.hour.toFixed(1) + ' ' + BTS.Env.weather + ' wet ' + BTS.Env.wet.toFixed(2) + ' lights ' + BTS.Env.activeLights.length + '/' + BTS.Env.lights.length + '\n' +
      (BTS.Story ? 'beat ' + BTS.Story.beatId() : '');
  }
  return A;
})();
