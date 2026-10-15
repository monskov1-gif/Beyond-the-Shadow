/* Input: keyboard/mouse/gamepad -> named actions, with rebinding. */
'use strict';
BTS.Input = (function () {
  var I = { down: {}, pressed: {}, released: {}, mouse: { x: 0, y: 0, down: false, clicked: false }, gamepad: null, lastDevice: 'kb', capture: null };
  var keyState = {}, keyPressed = {};
  var padPrev = {};
  var ACTIONS = ['up', 'down', 'left', 'right', 'run', 'interact', 'cancel', 'journal', 'map', 'inventory', 'observe', 'pause'];

  window.addEventListener('keydown', function (e) {
    if (I.capture) { e.preventDefault(); var cb = I.capture; I.capture = null; cb(e.code); return; }
    if (!keyState[e.code]) keyPressed[e.code] = true;
    keyState[e.code] = true;
    I.lastDevice = 'kb';
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(e.code) >= 0 && !(e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName))) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { keyState[e.code] = false; });
  window.addEventListener('blur', function () { keyState = {}; });
  window.addEventListener('mousemove', function (e) { I.mouse.x = e.clientX; I.mouse.y = e.clientY; });
  window.addEventListener('mousedown', function () { I.mouse.down = true; I.mouse.clicked = true; I.lastDevice = 'mouse'; });
  window.addEventListener('mouseup', function () { I.mouse.down = false; });

  function keysFor(action) { var k = BTS.Config.get('keys')[action]; return k || []; }

  function pollPad() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = null;
    for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    I.gamepad = gp;
    var st = {};
    if (gp) {
      var b = function (n) { return gp.buttons[n] && gp.buttons[n].pressed; };
      var ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      st.up = b(12) || ay < -0.5; st.down = b(13) || ay > 0.5; st.left = b(14) || ax < -0.5; st.right = b(15) || ax > 0.5;
      st.interact = b(0); st.cancel = b(1); st.observe = b(2); st.journal = b(3); st.run = b(4) || b(5) || b(7);
      st.map = b(8); st.pause = b(9); st.inventory = b(6);
      I.padAxis = [Math.abs(ax) > 0.2 ? ax : 0, Math.abs(ay) > 0.2 ? ay : 0];
      for (var k in st) if (st[k]) I.lastDevice = 'pad';
    } else I.padAxis = [0, 0];
    return st;
  }

  I.update = function () {
    var pad = pollPad();
    ACTIONS.forEach(function (a) {
      var ks = keysFor(a), d = false, p = false;
      for (var i = 0; i < ks.length; i++) { if (keyState[ks[i]]) d = true; if (keyPressed[ks[i]]) p = true; }
      if (pad[a]) { d = true; if (!padPrev[a]) p = true; }
      I.released[a] = I.down[a] && !d;
      I.down[a] = d; I.pressed[a] = p;
    });
    padPrev = pad;
  };
  I.endFrame = function () { keyPressed = {}; I.mouse.clicked = false; };
  I.consume = function (a) { I.pressed[a] = false; };
  I.axis = function () {
    var x = (I.down.right ? 1 : 0) - (I.down.left ? 1 : 0), z = (I.down.down ? 1 : 0) - (I.down.up ? 1 : 0);
    if (I.padAxis && (I.padAxis[0] || I.padAxis[1])) { x = I.padAxis[0]; z = I.padAxis[1]; }
    var l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
    return [x, z];
  };
  I.captureKey = function (cb) { I.capture = cb; };
  I.keyName = function (code) {
    if (!code) return '—';
    return code.replace(/^Key/, '').replace(/^Digit/, '').replace('ArrowUp', '↑').replace('ArrowDown', '↓').replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('ShiftLeft', 'Shift').replace('ShiftRight', 'R-Shift').replace('Escape', 'Esc');
  };
  I.ACTIONS = ACTIONS;
  return I;
})();
