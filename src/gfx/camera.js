/* Diorama camera: fixed-ish yaw, high pitch, narrow FOV. Smooth follow, bounds clamp,
   cinematic tweens, shake, frustum culling. */
'use strict';
BTS.Camera = (function () {
  var M = BTS.M;
  var C = {
    target: [0, 0, 0], goal: [0, 0, 0], yaw: 0, pitch: 0.55, dist: 26, fov: 0.5,
    near: 1, far: 160, eye: [0, 10, 10],
    view: M.mat4(), proj: M.mat4(), viewProj: M.mat4(),
    right: [1, 0, 0], up: [0, 1, 0], toward: [0, 0, 1],
    focusDist: 19, focusRange: 5, bounds: null, shake: 0,
    preset: { pitch: 0.55, dist: 26, fov: 0.5, yaw: 0 },
    cine: null, lookOffset: [0, 0, 0]
  };
  var cur = { pitch: 0.55, dist: 26, fov: 0.5, yaw: 0 };

  C.setPreset = function (p, instant) {
    C.preset = { pitch: p.pitch || 0.55, dist: p.dist || 26, fov: p.fov || 0.5, yaw: p.yaw || 0 };
    if (instant) { cur.pitch = C.preset.pitch; cur.dist = C.preset.dist; cur.fov = C.preset.fov; cur.yaw = C.preset.yaw; }
  };
  C.snap = function (pos) {
    C.goal = pos.slice(); C.target = C.clampToBounds(pos.slice());
    cur.pitch = C.preset.pitch; cur.dist = C.preset.dist; cur.fov = C.preset.fov; cur.yaw = C.preset.yaw;
    C.cine = null;
  };
  C.clampToBounds = function (p) {
    var b = C.bounds; if (!b) return p;
    p[0] = M.clamp(p[0], b[0], b[2]); p[2] = M.clamp(p[2], b[1], b[3]);
    return p;
  };
  /* cinematic: {target:[x,y,z], dist, pitch, yaw, fov, time} — eases from current */
  C.cinematic = function (o) {
    C.cine = { from: { t: C.target.slice(), dist: cur.dist, pitch: cur.pitch, yaw: cur.yaw, fov: cur.fov }, to: o, t: 0, time: o.time || 1.5 };
    return new Promise(function (res) { C.cine.done = res; });
  };
  C.release = function () { C.cine = null; };

  C.update = function (dt, followPos) {
    if (C.cine) {
      var c = C.cine;
      c.t = Math.min(1, c.t + dt / c.time);
      var e = c.t < 0.5 ? 4 * c.t * c.t * c.t : 1 - Math.pow(-2 * c.t + 2, 3) / 2;
      var to = c.to;
      var tt = to.target || c.from.t;
      C.target = M.lerp3(c.from.t, tt, e);
      cur.dist = M.lerp(c.from.dist, to.dist || c.from.dist, e);
      cur.pitch = M.lerp(c.from.pitch, to.pitch || c.from.pitch, e);
      cur.yaw = M.lerp(c.from.yaw, to.yaw === undefined ? c.from.yaw : to.yaw, e);
      cur.fov = M.lerp(c.from.fov, to.fov || c.from.fov, e);
      if (c.t >= 1 && c.done) { var d = c.done; c.done = null; d(); }
    } else if (followPos) {
      C.goal = [followPos[0] + C.lookOffset[0], followPos[1] + C.lookOffset[1], followPos[2] + C.lookOffset[2]];
      var g = C.clampToBounds(C.goal.slice());
      C.target[0] = M.damp(C.target[0], g[0], 4.5, dt);
      C.target[1] = M.damp(C.target[1], g[1], 3, dt);
      C.target[2] = M.damp(C.target[2], g[2], 4.5, dt);
      cur.pitch = M.damp(cur.pitch, C.preset.pitch, 2, dt);
      cur.dist = M.damp(cur.dist, C.preset.dist, 2, dt);
      cur.fov = M.damp(cur.fov, C.preset.fov, 2, dt);
      cur.yaw = M.damp(cur.yaw, C.preset.yaw, 2, dt);
    }
    C.pitch = cur.pitch; C.dist = cur.dist; C.fov = cur.fov; C.yaw = cur.yaw;
    var sx = 0, sy = 0;
    if (C.shake > 0) { C.shake = Math.max(0, C.shake - dt * 1.5); sx = (Math.random() - 0.5) * C.shake * 0.4; sy = (Math.random() - 0.5) * C.shake * 0.4; }
    var cp = Math.cos(C.pitch), sp = Math.sin(C.pitch);
    var fx = Math.sin(C.yaw), fz = Math.cos(C.yaw);
    var t = [C.target[0] + sx, C.target[1] + 0.9 + sy, C.target[2]];
    // pixel-grid snap: move the view in whole low-res pixels so textures don't shimmer while walking
    // ...and the leftover fraction of a pixel is applied when the picture is upscaled (C.subpx),
    // so the motion stays smooth while textures don't swim
    C.subpx = [0, 0];
    if (!C.cine && Math.abs(C.yaw) < 1e-3 && BTS.Renderer.internal) {
      var pw = 2 * C.dist * Math.tan(C.fov / 2) / BTS.Renderer.internal[1];
      var sz = pw / Math.max(0.2, Math.sin(C.pitch));
      var sy2 = pw / Math.max(0.2, Math.cos(C.pitch));
      var r0 = Math.round(t[0] / pw) * pw, r1 = Math.round(t[1] / sy2) * sy2, r2 = Math.round(t[2] / sz) * sz;
      var ddx = t[0] - r0, ddy = t[1] - r1, ddz = t[2] - r2;
      C.subpx = [ddx / pw, (ddy * Math.cos(C.pitch) - ddz * Math.sin(C.pitch)) / pw];
      t[0] = r0; t[1] = r1; t[2] = r2;
    }
    C.eye = [t[0] + fx * cp * C.dist, t[1] + sp * C.dist, t[2] + fz * cp * C.dist];
    M.lookAt(C.view, C.eye, t, [0, 1, 0]);
    var asp = BTS.Renderer.internal[0] / BTS.Renderer.internal[1];
    M.perspective(C.proj, C.fov, asp, C.near, C.far);
    M.mul(C.viewProj, C.proj, C.view);
    C.right = [C.view[0], C.view[4], C.view[8]];
    C.up = [C.view[1], C.view[5], C.view[9]];
    C.toward = [fx, 0, fz];
    C.focusDist = C.dist;
    C.focusRange = C.dist * 0.16;
  };

  C.boxVisible = function (mn, mx) {
    var vp = C.viewProj;
    var out = [0, 0, 0, 0, 0, 0];
    for (var i = 0; i < 8; i++) {
      var x = i & 1 ? mx[0] : mn[0], y = i & 2 ? mx[1] : mn[1], z = i & 4 ? mx[2] : mn[2];
      var cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
      var cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
      var cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      if (cx < -cw) out[0]++; if (cx > cw) out[1]++;
      if (cy < -cw) out[2]++; if (cy > cw) out[3]++;
      if (cw < 0.1) out[4]++;
    }
    for (var k = 0; k < 5; k++) if (out[k] === 8) return false;
    return true;
  };
  /* world -> CSS pixel position on the canvas element (for UI prompts) */
  C.toScreen = function (x, y, z) {
    var vp = C.viewProj;
    var cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    var cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    var cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (cw <= 0) return null;
    var R = BTS.Renderer, el = R.canvas, dpr = el.width / el.clientWidth;
    var v = R.viewport;
    var sx = (v[0] + (cx / cw * 0.5 + 0.5) * v[2]) / dpr;
    var sy = (el.height - (v[1] + (cy / cw * 0.5 + 0.5) * v[3])) / dpr;
    return [sx, sy];
  };
  return C;
})();
