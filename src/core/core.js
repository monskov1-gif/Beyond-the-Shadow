/* Beyond the Shadows — core: namespace, logging, config, events, math, rng.
   All engine modules attach themselves to the global BTS namespace so the game
   runs from file:// without a bundler or server. */
'use strict';
var BTS = window.BTS = window.BTS || {};
BTS.VERSION = '1.0.0';
BTS.SAVE_VERSION = 3;

/* ---------- logging ---------- */
BTS.Log = (function () {
  var lines = [];
  var levels = { debug: 0, info: 1, warn: 2, error: 3 };
  var minLevel = 1;
  function write(level, args) {
    if (levels[level] < minLevel) return;
    var msg = Array.prototype.map.call(args, function (a) {
      if (a instanceof Error) return a.stack || a.message;
      if (typeof a === 'object') { try { return JSON.stringify(a); } catch (e) { return String(a); } }
      return String(a);
    }).join(' ');
    var line = '[' + (performance.now() / 1000).toFixed(2) + '] ' + level.toUpperCase() + ' ' + msg;
    lines.push(line);
    if (lines.length > 400) lines.shift();
    (console[level] || console.log).call(console, line);
  }
  return {
    debug: function () { write('debug', arguments); },
    info: function () { write('info', arguments); },
    warn: function () { write('warn', arguments); },
    error: function () { write('error', arguments); },
    setLevel: function (l) { minLevel = levels[l] || 0; },
    lines: lines
  };
})();

/* ---------- events ---------- */
BTS.Events = (function () {
  var map = {};
  return {
    on: function (name, fn) { (map[name] = map[name] || []).push(fn); return fn; },
    off: function (name, fn) { var l = map[name]; if (!l) return; var i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    emit: function (name, a, b, c) {
      var l = map[name]; if (!l) return;
      l = l.slice();
      for (var i = 0; i < l.length; i++) {
        try { l[i](a, b, c); } catch (e) { BTS.Log.error('event handler', name, e); }
      }
    }
  };
})();

/* ---------- config / settings ---------- */
BTS.Config = (function () {
  var defaults = {
    language: null,          // null => ask on first launch
    musicVolume: 0.7, sfxVolume: 0.8, ambienceVolume: 0.75, uiVolume: 0.6, masterVolume: 0.9,
    textSpeed: 2,            // 0 slow .. 3 instant
    pixelScale: 0,           // 0 auto, else internal height
    effects: 2,              // 0 low, 1 medium, 2 high
    fullscreen: false,
    subtitles: true,
    devMode: false,
    keys: {
      up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
      run: ['ShiftLeft', 'ShiftRight'], interact: ['KeyE', 'Space', 'Enter'], cancel: ['Escape', 'Backspace'],
      journal: ['KeyJ'], map: ['KeyM'], inventory: ['KeyI', 'Tab'], observe: ['KeyF'], pause: ['Escape']
    }
  };
  var KEY = 'bts.settings.v1';
  var data = JSON.parse(JSON.stringify(defaults));
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var loaded = JSON.parse(raw);
      for (var k in loaded) if (k in defaults) data[k] = loaded[k];
      if (!data.keys || typeof data.keys !== 'object') data.keys = JSON.parse(JSON.stringify(defaults.keys));
      for (var a in defaults.keys) if (!Array.isArray(data.keys[a])) data.keys[a] = defaults.keys[a].slice();
    }
  } catch (e) { BTS.Log.warn('settings corrupted, using defaults', e); }
  return {
    data: data,
    defaults: defaults,
    get: function (k) { return data[k]; },
    set: function (k, v) { data[k] = v; this.save(); BTS.Events.emit('config', k, v); },
    save: function () { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { BTS.Log.warn('settings save failed', e); } },
    resetKeys: function () { data.keys = JSON.parse(JSON.stringify(defaults.keys)); this.save(); }
  };
})();

/* ---------- math ---------- */
BTS.M = (function () {
  var M = {};
  M.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  M.lerp = function (a, b, t) { return a + (b - a) * t; };
  M.smooth = function (a, b, x) { var t = M.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  M.damp = function (a, b, lambda, dt) { return M.lerp(a, b, 1 - Math.exp(-lambda * dt)); };
  M.dist2 = function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };
  M.angleLerp = function (a, b, t) { var d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; return a + d * t; };
  M.lerp3 = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  M.hex = function (h) {
    if (typeof h !== 'string') return h;
    h = h.replace('#', '');
    return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255];
  };
  M.norm3 = function (v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  M.hash = function (x, y) { var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return h - Math.floor(h); };
  M.noise2 = function (x, y) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    var a = M.hash(ix, iy), b = M.hash(ix + 1, iy), c = M.hash(ix, iy + 1), d = M.hash(ix + 1, iy + 1);
    var ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  M.fbm = function (x, y, oct) { var s = 0, a = 0.5, f = 1; for (var i = 0; i < (oct || 4); i++) { s += a * M.noise2(x * f, y * f); f *= 2; a *= 0.5; } return s; };
  /* mat4 (column-major, Float32Array) */
  M.mat4 = function () { var m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; };
  M.perspective = function (out, fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    out.fill(0);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
    return out;
  };
  M.ortho = function (out, l, r, b, t, n, f) {
    out.fill(0);
    out[0] = 2 / (r - l); out[5] = 2 / (t - b); out[10] = -2 / (f - n);
    out[12] = -(r + l) / (r - l); out[13] = -(t + b) / (t - b); out[14] = -(f + n) / (f - n); out[15] = 1;
    return out;
  };
  M.lookAt = function (out, eye, c, up) {
    var zx = eye[0] - c[0], zy = eye[1] - c[1], zz = eye[2] - c[2];
    var l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
    var xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
    out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
    out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
    out[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
    out[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
    out[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
    out[15] = 1;
    return out;
  };
  M.mul = function (out, a, b) {
    var r = new Float32Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      r[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
    }
    out.set(r); return out;
  };
  M.transform = function (m, x, y, z) {
    var w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w, w];
  };
  return M;
})();

/* ---------- deterministic RNG ---------- */
BTS.RNG = function (seed) {
  var s = (seed >>> 0) || 1;
  var r = function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    var t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  r.range = function (a, b) { return a + (b - a) * r(); };
  r.int = function (a, b) { return Math.floor(a + (b - a + 1) * r()); };
  r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
  r.chance = function (p) { return r() < p; };
  return r;
};
BTS.strHash = function (str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
