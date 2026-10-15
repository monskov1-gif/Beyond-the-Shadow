/* Touch controls (phones / tablets): floating virtual joystick + action buttons, and UI scaling to the screen size.
   Feeds BTS.Input through BTS.Input.touch (axis + held/pressed actions), so the game reads it like any other device. */
'use strict';
BTS.Touch = (function () {
  var T = { enabled: false, active: false, el: null, stick: null, axis: [0, 0] };
  var I = BTS.Input, t = function (k) { return BTS.t(k); };
  var stickId = null, stickOrigin = [0, 0], RADIUS = 1;

  T.detect = function () { return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && matchMedia('(pointer: coarse)').matches); };
  T.wanted = function () {
    var m = BTS.Config.get('touchControls') || 0;
    if (BTS.Game && BTS.Game.query && BTS.Game.query.get('touch')) return BTS.Game.query.get('touch') === '1';
    return m === 1 || (m === 0 && T.detect());
  };

  /* ---------- UI scale ---------- */
  T.applyScale = function () {
    var w = window.innerWidth, h = window.innerHeight;
    var s = Math.min(w / 1100, h / 620);
    s = BTS.M.clamp(s, T.enabled ? 0.78 : 0.68, 2.2) * (BTS.Config.get('uiScale') || 1);
    document.documentElement.style.fontSize = (16 * s).toFixed(2) + 'px';
    T.scale = s;
    document.body.classList.toggle('portrait', h > w * 1.05);
    RADIUS = 3.2 * 16 * s;
  };

  function btn(cls, label, action, parent, opts) {
    var b = document.createElement('div');
    b.className = 'tbtn ' + cls; b.innerHTML = label; b.dataset.action = action;
    (parent || T.el).appendChild(b);
    var hold = opts && opts.hold;
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      try { b.setPointerCapture(e.pointerId); } catch (er) { }
      b.classList.add('on'); I.lastDevice = 'touch';
      if (opts && opts.toggle) { T.runToggle = !T.runToggle; b.classList.toggle('lock', T.runToggle); return; }
      I.touch.pressed[action] = true; if (hold) I.touch.down[action] = true;
      if (navigator.vibrate) try { navigator.vibrate(8); } catch (er) { }
    });
    var up = function (e) { b.classList.remove('on'); if (hold) I.touch.down[action] = false; };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    return b;
  }

  T.build = function () {
    if (T.el) return;
    var root = document.getElementById('ui');
    T.el = document.createElement('div'); T.el.className = 'touch hidden';
    root.appendChild(T.el);
    // joystick zone: left 45% of the screen; the stick appears where the thumb lands
    var zone = document.createElement('div'); zone.className = 'tzone'; T.el.appendChild(zone);
    T.stick = document.createElement('div'); T.stick.className = 'tstick'; T.stick.innerHTML = '<i></i>'; T.el.appendChild(T.stick);
    var knob = T.stick.firstChild;
    zone.addEventListener('pointerdown', function (e) {
      if (stickId !== null) return;
      e.preventDefault(); stickId = e.pointerId; I.lastDevice = 'touch';
      try { zone.setPointerCapture(e.pointerId); } catch (er) { }
      stickOrigin = [e.clientX, e.clientY];
      T.stick.style.left = e.clientX + 'px'; T.stick.style.top = e.clientY + 'px'; T.stick.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
    });
    zone.addEventListener('pointermove', function (e) {
      if (e.pointerId !== stickId) return;
      var dx = e.clientX - stickOrigin[0], dy = e.clientY - stickOrigin[1], l = Math.hypot(dx, dy);
      if (l > RADIUS) { dx *= RADIUS / l; dy *= RADIUS / l; }
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
      var m = Math.min(1, l / RADIUS), dead = 0.12;
      var k = m < dead ? 0 : (m - dead) / (1 - dead);
      T.axis = l > 0 ? [dx / Math.max(l, 1e-3) * k, dy / Math.max(l, 1e-3) * k] : [0, 0];
      T.farPush = m > 0.85;
    });
    var end = function (e) { if (e.pointerId !== stickId) return; stickId = null; T.axis = [0, 0]; T.farPush = false; T.stick.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);

    var right = document.createElement('div'); right.className = 'tright'; T.el.appendChild(right);
    T.bAct = btn('big act', '<span class="ic">✋</span><span class="tl"></span>', 'interact', right);
    T.bObs = btn('mid obs', '<span class="ic">◐</span><span class="tl"></span>', 'observe', right);
    T.bRun = btn('mid run', '<span class="ic">»</span><span class="tl"></span>', 'run', right, { toggle: true });
    var top = document.createElement('div'); top.className = 'ttop'; T.el.appendChild(top);
    T.bJr = btn('sm', '<span class="ic">✎</span><span class="tl"></span>', 'journal', top);
    T.bMap = btn('sm', '<span class="ic">⌖</span><span class="tl"></span>', 'map', top);
    T.bInv = btn('sm', '<span class="ic">◫</span><span class="tl"></span>', 'inventory', top);
    T.bPause = btn('sm', '<span class="ic">❚❚</span><span class="tl"></span>', 'pause', top);
    T.rot = document.createElement('div'); T.rot.className = 'trotate'; T.el.appendChild(T.rot);
    T.rot.addEventListener('pointerdown', function (e) { e.stopPropagation(); T.rot.remove(); });
    T.relabel();
    // the floating interaction prompt is tappable too
    var U = BTS.UI;
    if (U && U.prompt) {
      U.prompt.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); I.touch.pressed.interact = true; I.lastDevice = 'touch'; });
    }
    document.addEventListener('touchstart', function () { I.lastDevice = 'touch'; }, { passive: true });
    // block the browser's double-tap zoom / long-press menu on the game surface
    document.addEventListener('contextmenu', function (e) { if (T.enabled) e.preventDefault(); });
    document.addEventListener('dblclick', function (e) { if (T.enabled) e.preventDefault(); }, { passive: false });
  };

  T.relabel = function () {
    if (!T.el) return;
    var set = function (b, k) { b.querySelector('.tl').textContent = t(k); };
    set(T.bAct, 'touch.act'); set(T.bObs, 'touch.observe'); set(T.bRun, 'touch.run');
    if (T.rot) T.rot.textContent = t('touch.rotate');
    set(T.bJr, 'ui.journal'); set(T.bMap, 'ui.map'); set(T.bInv, 'ui.inventory'); set(T.bPause, 'ui.pause');
  };

  T.refresh = function () {
    T.enabled = T.wanted();
    document.body.classList.toggle('touchmode', T.enabled);
    if (T.enabled) T.build();
    T.applyScale();
    if (T.el) T.el.classList.toggle('hidden', !T.enabled);
  };

  /* per-frame: decide which controls are visible */
  T.update = function () {
    if (!T.enabled || !T.el) return;
    var G = BTS.Game, U = BTS.UI;
    var playing = G && G.started && G.mode === 'play' && !U.stack.length;
    var free = playing && !BTS.Dialogue.active && !BTS.Cutscene.running && !G.transitioning && !(BTS.Story && BTS.Story.cardActive);
    T.el.classList.toggle('hidden', !playing);
    T.el.classList.toggle('busy', !free);
    var it = BTS.World && BTS.World.focusInteract;
    T.bAct.classList.toggle('ready', !!(free && it));
    if (!free && stickId !== null) { T.axis = [0, 0]; }
    I.touch.axis = free ? T.axis : [0, 0];
    I.touch.down.run = free && (T.runToggle || T.farPush);
  };

  /* fullscreen on the first interaction with the page (browsers only allow it inside a user gesture) */
  T.autoFullscreen = function () {
    var done = false;
    var go = function () {
      if (done) return; done = true;
      ['pointerup', 'touchend', 'keydown', 'click'].forEach(function (ev) { window.removeEventListener(ev, go, true); });
      if (!BTS.Config.get('autoFullscreen') || document.fullscreenElement || BTS.Game && BTS.Game.query && BTS.Game.query.get('test')) return;
      var el = document.documentElement, rq = el.requestFullscreen || el.webkitRequestFullscreen;
      if (!rq) return;   // iPhone Safari has no fullscreen API for pages
      try {
        var r = rq.call(el, { navigationUI: 'hide' });
        var lock = function () { try { if (T.enabled && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () { }); } catch (e) { } };
        if (r && r.then) r.then(lock).catch(function () { }); else lock();
      } catch (e) { }
    };
    ['pointerup', 'touchend', 'keydown', 'click'].forEach(function (ev) { window.addEventListener(ev, go, true); });
  };

  T.init = function () {
    T.autoFullscreen();
    I.touch = I.touch || { axis: [0, 0], down: {}, pressed: {} };
    window.addEventListener('resize', T.applyScale);
    window.addEventListener('orientationchange', function () { setTimeout(T.applyScale, 200); });
    BTS.Events.on('language', T.relabel);
    T.refresh();
  };
  return T;
})();
