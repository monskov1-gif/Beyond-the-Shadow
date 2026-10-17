/* Dialogue portraits: vector illustrations. Each portrait is an SVG drawn from a shared parametric face rig
   (a 3D head of stacked super-elliptic cross-sections seen in a gentle 3/4 view; every feature is a curve placed on
   that surface and projected, so the far side foreshortens naturally) with flat colour planes, soft cel shading,
   gradients and dark-brown line art of varying weight. The SVG is rasterised to a 240x240 PNG (2x for retina);
   until that finishes, get() hands out the SVG data URL itself, which browsers draw just as well.
   Components (hair, hats, beards, outfits, accessories) live in portraits_hero.js; per-character data in data/characters.js. */
'use strict';
BTS.Portraits = (function () {
  var P = {}, cache = {}, svgs = {}, busy = {};
  var EXPR = ['neutral', 'sad', 'scared', 'angry', 'smile', 'blank', 'worried', 'tired'];
  P.EXPR = EXPR;
  var RES = 240; P.SIZE = 120; P.RES = RES;

  /* ---------------- colour ---------------- */
  function hx(c) {
    if (!c) return [128, 128, 128];
    if (typeof c === 'string') { var s = c.replace('#', ''); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
    return c;
  }
  function cl(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
  function rgb(c) { c = hx(c); return '#' + ((1 << 24) | (cl(c[0]) << 16) | (cl(c[1]) << 8) | cl(c[2])).toString(16).slice(1); }
  function mix(a, b, t) { a = hx(a); b = hx(b); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mul(a, k) { a = hx(a); return [a[0] * k, a[1] * k, a[2] * k]; }
  function lum(c) { c = hx(c); return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; }
  function desat(c, k) { c = hx(c); var l = lum(c); return mix(c, [l, l, l], k); }
  /* tone ramp for a material: light from the upper left, shadows drift cool/violet, lights warm */
  function tones(base, o) {
    o = o || {}; base = hx(base);
    var L = lum(base), dark = L < 60;
    var shCol = o.shadowHue || [70, 48, 92], liCol = o.lightHue || [255, 240, 214];
    var k1 = dark ? 1.0 : 1;
    return {
      base: base,
      hi: mix(mul(base, dark ? 1.9 : 1.22), liCol, dark ? 0.32 : 0.28),
      light: mix(mul(base, dark ? 1.4 : 1.1), liCol, dark ? 0.12 : 0.12),
      shadow: mix(mul(base, dark ? 0.72 : 0.74 * k1), shCol, dark ? 0.12 : 0.18),
      deep: mix(mul(base, dark ? 0.5 : 0.52), shCol, dark ? 0.2 : 0.26),
      line: mix(mul(base, 0.3), [24, 14, 12], 0.6)
    };
  }
  P.col = { hx: hx, rgb: rgb, mix: mix, mul: mul, lum: lum, desat: desat, tones: tones };

  /* ---------------- geometry / paths ---------------- */
  function f(n) { return (Math.round(n * 10) / 10).toString(); }
  function fo(n) { return (Math.round(Math.max(0, n) * 100) / 100).toString(); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ss(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  /* Catmull-Rom through points -> cubic Bezier path. A point with .s = 1 is a sharp corner. */
  function smooth(pts, closed, ten) {
    var n = pts.length; if (n < 2) return '';
    var t = (ten === undefined ? 1 : ten) / 6;
    var d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = pts[closed ? (i - 1 + n) % n : Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[closed ? (i + 2) % n : Math.min(i + 2, n - 1)];
      var a1 = p1.s ? 0 : t, a2 = p2.s ? 0 : t;
      d += 'C' + f(p1[0] + (p2[0] - p0[0]) * a1) + ' ' + f(p1[1] + (p2[1] - p0[1]) * a1) + ' ' + f(p2[0] - (p3[0] - p1[0]) * a2) + ' ' + f(p2[1] - (p3[1] - p1[1]) * a2) + ' ' + f(p2[0]) + ' ' + f(p2[1]);
    }
    return d + (closed ? 'Z' : '');
  }
  function poly(pts, closed) { var d = ''; pts.forEach(function (p, i) { d += (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1]); }); return d + (closed ? 'Z' : ''); }
  function K(p) { var q = [p[0], p[1]]; q.s = 1; return q; }
  /* sample a Catmull-Rom spline into a dense polyline */
  function spline(pts, per) {
    per = per || 6; var n = pts.length, out = [];
    if (n < 3) { for (var j = 0; j < n - 1; j++) for (var k = 0; k < per; k++) { var u = k / per; out.push([lerp(pts[j][0], pts[j + 1][0], u), lerp(pts[j][1], pts[j + 1][1], u)]); } out.push(pts[n - 1]); return out; }
    for (var i = 0; i < n - 1; i++) {
      var p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, n - 1)];
      for (var s = 0; s < per; s++) {
        var t = s / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(function (c) { return 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3); }));
      }
    }
    out.push(pts[n - 1]); return out;
  }
  /* a tapered brush stroke along pts: w is a number, [w0, wmax, w1] or a function of t (0..1) */
  function taper(pts, w, per) {
    var q = spline(pts, per || 5), n = q.length, Lp = [], Rp = [];
    var wf = typeof w === 'function' ? w : Array.isArray(w) ? function (t) { return t < 0.5 ? lerp(w[0], w[1], ss(t * 2)) : lerp(w[1], w[2], ss((t - 0.5) * 2)); } : function () { return w; };
    for (var i = 0; i < n; i++) {
      var a = q[Math.max(i - 1, 0)], b = q[Math.min(i + 1, n - 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
      var nx = -ty / l, ny = tx / l, ww = wf(i / (n - 1)) / 2;
      Lp.push([q[i][0] + nx * ww, q[i][1] + ny * ww]); Rp.push([q[i][0] - nx * ww, q[i][1] - ny * ww]);
    }
    return poly(Lp.concat(Rp.reverse()), true);
  }
  function offset(pts, dx, dy) { return pts.map(function (p) { var q = [p[0] + dx, p[1] + dy]; if (p.s) q.s = 1; return q; }); }
  P.geo = { smooth: smooth, poly: poly, spline: spline, taper: taper, K: K, f: f, lerp: lerp, clamp: clamp, ss: ss, offset: offset };

  /* ---------------- face presets (units: half the cheekbone width = 1; eye line Y = 0, Y down, Z toward viewer) ---------------- */
  var FACES = {
    man:    { S: 41, oy: 98, crown: -1.64, skullW: 1.04, temple: 0.05, cheekY: 0.2, cheekW: 1.0, jawY: 1.02, jawW: 0.84, chinY: 1.48, chinW: 0.34, chinB: 1.64, faceZ: 0.9, eyeX: 0.43, eyeW: 0.21, eyeH: 0.085, eyeTilt: 0.0, browY: -0.3, browT: 0.085, noseY: 0.72, noseZ: 0.36, noseW: 0.21, noseTip: 0.09, mouthY: 1.08, mouthW: 0.31, ulip: 0.045, llip: 0.065, neckW: 0.66, earY: -0.12, earH: 0.8, hollow: 0.3 },
    woman:  { S: 42, oy: 98, crown: -1.6, skullW: 1.02, temple: 0.04, cheekY: 0.2, cheekW: 1.0, jawY: 0.98, jawW: 0.74, chinY: 1.38, chinW: 0.27, chinB: 1.53, faceZ: 0.9, eyeX: 0.42, eyeW: 0.22, eyeH: 0.105, eyeTilt: 0.02, browY: -0.32, browT: 0.06, noseY: 0.66, noseZ: 0.3, noseW: 0.17, noseTip: 0.075, mouthY: 1.0, mouthW: 0.29, ulip: 0.055, llip: 0.08, neckW: 0.52, earY: -0.1, earH: 0.72, hollow: 0.15 },
    boy:    { S: 42, oy: 99, crown: -1.64, skullW: 1.04, temple: 0.03, cheekY: 0.2, cheekW: 1.0, jawY: 0.92, jawW: 0.76, chinY: 1.3, chinW: 0.28, chinB: 1.45, faceZ: 0.88, eyeX: 0.42, eyeW: 0.22, eyeH: 0.108, eyeTilt: 0.0, browY: -0.31, browT: 0.065, noseY: 0.6, noseZ: 0.27, noseW: 0.16, noseTip: 0.07, mouthY: 0.93, mouthW: 0.27, ulip: 0.045, llip: 0.068, neckW: 0.5, earY: -0.1, earH: 0.7, hollow: 0.05 },
    girl:   { S: 41, oy: 102, crown: -1.72, skullW: 1.06, temple: 0.02, cheekY: 0.24, cheekW: 1.0, jawY: 0.82, jawW: 0.8, chinY: 1.15, chinW: 0.32, chinB: 1.31, faceZ: 0.86, eyeX: 0.41, eyeW: 0.22, eyeH: 0.122, eyeTilt: 0.0, browY: -0.32, browT: 0.05, noseY: 0.5, noseZ: 0.19, noseW: 0.14, noseTip: 0.065, mouthY: 0.8, mouthW: 0.23, ulip: 0.042, llip: 0.062, neckW: 0.44, earY: -0.08, earH: 0.62, hollow: 0 },
    small:  { S: 40, oy: 106, crown: -1.84, skullW: 1.08, temple: 0.0, cheekY: 0.26, cheekW: 1.02, jawY: 0.72, jawW: 0.86, chinY: 1.02, chinW: 0.36, chinB: 1.19, faceZ: 0.86, eyeX: 0.4, eyeW: 0.215, eyeH: 0.128, eyeTilt: 0.0, browY: -0.32, browT: 0.045, noseY: 0.42, noseZ: 0.14, noseW: 0.13, noseTip: 0.065, mouthY: 0.7, mouthW: 0.2, ulip: 0.036, llip: 0.058, neckW: 0.42, earY: -0.06, earH: 0.58, hollow: 0 },
    old:    { S: 42, oy: 98, crown: -1.6, skullW: 1.02, temple: 0.06, cheekY: 0.2, cheekW: 1.0, jawY: 1.0, jawW: 0.8, chinY: 1.4, chinW: 0.29, chinB: 1.55, faceZ: 0.9, eyeX: 0.42, eyeW: 0.21, eyeH: 0.092, eyeTilt: -0.01, browY: -0.31, browT: 0.05, noseY: 0.7, noseZ: 0.32, noseW: 0.19, noseTip: 0.085, mouthY: 1.04, mouthW: 0.28, ulip: 0.04, llip: 0.065, neckW: 0.52, earY: -0.1, earH: 0.8, age: 0.8, hollow: 0.2, jowl: 0.4 },
    oldman: { S: 41, oy: 98, crown: -1.64, skullW: 1.04, temple: 0.06, cheekY: 0.2, cheekW: 1.0, jawY: 1.04, jawW: 0.84, chinY: 1.48, chinW: 0.34, chinB: 1.64, faceZ: 0.9, eyeX: 0.43, eyeW: 0.205, eyeH: 0.08, eyeTilt: -0.01, browY: -0.29, browT: 0.08, noseY: 0.74, noseZ: 0.38, noseW: 0.22, noseTip: 0.1, mouthY: 1.1, mouthW: 0.3, ulip: 0.032, llip: 0.055, neckW: 0.64, earY: -0.14, earH: 0.88, age: 0.8, hollow: 0.3, jowl: 0.4 }
  };
  P.FACES = FACES;

  /* ---------------- expressions ---------------- */
  var EXP = {
    neutral: {},
    sad: { browIn: 0.75, browOut: -0.25, browKnit: 0.15, lid: 0.78, gazeY: 0.55, gazeX: -0.15, curve: -0.7, pitch: 0.06, roll: -0.035, lowLid: 0.1 },
    scared: { browIn: 0.95, browOut: 0.55, browKnit: 0.35, lid: 1.3, lowLid: -0.15, pupil: 0.72, open: 0.42, wide: 0.86, curve: -0.25, pitch: -0.03, gazeX: -0.25 },
    angry: { browIn: -0.85, browOut: 0.25, browKnit: 0.8, lid: 0.74, lowLid: 0.4, curve: -0.55, press: 1, flare: 1, pitch: 0.05, wide: 0.92 },
    smile: { curve: 1, open: 0.16, teeth: 1, lowLid: 0.5, lid: 0.86, cheek: 1, browIn: 0.12, browOut: 0.12, roll: 0.035, wide: 1.1 },
    blank: { lid: 0.7, gazeX: 0, gazeY: 0.05, pupil: 0.62, curve: -0.05, browIn: -0.05, browOut: -0.12, open: 0.06, pale: 0.35, stare: 1 },
    worried: { browIn: 0.6, browOut: -0.05, browKnit: 0.45, lid: 0.98, gazeX: 0.55, gazeY: 0.1, curve: -0.35, wave: 1, roll: 0.025, lowLid: 0.05 },
    tired: { lid: 0.55, browIn: 0.22, browOut: -0.3, curve: -0.25, open: 0.07, gazeY: 0.35, pitch: 0.05, roll: -0.045, bags: 0.4 }
  };
  P.EXP = EXP;
  function expression(name, pd) {
    var e = Object.assign({ browIn: 0, browOut: 0, browKnit: 0, lid: 1, lowLid: 0, gazeX: 0, gazeY: 0, pupil: 1, curve: 0, open: 0, wide: 1, teeth: 0, press: 0, flare: 0, cheek: 0, pitch: 0, roll: 0, wave: 0, pale: 0, bags: 0, stare: 0 }, EXP[name] || {});
    var m = pd.mood || {}, mn = name === 'neutral' ? (pd.moodNeutral || {}) : {}, mw = name === 'neutral' ? 1 : (pd.moodWeight === undefined ? 0.35 : pd.moodWeight);
    Object.keys(m).forEach(function (k) { e[k] = (e[k] || 0) + m[k] * mw; });
    Object.keys(mn).forEach(function (k) { e[k] = (k === 'lid' || k === 'wide' || k === 'pupil') ? mn[k] : (e[k] || 0) + mn[k]; });
    var ov = (pd.expr || {})[name]; if (ov) Object.keys(ov).forEach(function (k) { e[k] = ov[k]; });
    e.name = name;
    return e;
  }

  /* ---------------- the rig ---------------- */
  function Rig(def, pd, ex) {
    var a = this;
    a.def = def; a.pd = pd; a.ex = ex;
    var fc = Object.assign({}, FACES[pd.face] || FACES.woman, pd.f || {});
    a.fc = fc;
    a.age = pd.age !== undefined ? pd.age : (fc.age || 0);
    a.S = fc.S * (pd.scale || 1);
    a.ox = 120 + (pd.ox || 0); a.oy = fc.oy + (pd.oy || 0);
    a.yaw = (pd.yaw === undefined ? 0.3 : pd.yaw) + (ex.yaw || 0);
    a.pitch = (pd.pitch || 0) + ex.pitch;
    a.roll = (pd.roll || 0) + ex.roll;
    a.cy = Math.cos(a.yaw); a.sy = Math.sin(a.yaw); a.cp = Math.cos(a.pitch); a.sp = Math.sin(a.pitch);
    a.layers = {}; a.defs = []; a.nid = 0;
    a.n = fc.n || 2.5;
    a.skin = skinTones(hx(def.skin || [227, 180, 143]), pd);
    a.line = rgb(pd.line || mix(mul(a.skin.base, 0.22), [30, 14, 12], 0.7));
  }
  function skinTones(base, pd) {
    base = desat(base, 0.12);
    var sh = mix(mul(base, 0.74), [128, 62, 88], 0.26);
    return {
      base: base,
      light: mix(base, [255, 238, 222], 0.3),
      hi: mix(base, [255, 248, 238], 0.55),
      shadow: sh,
      deep: mix(mul(base, 0.6), [100, 44, 70], 0.3),
      blush: mix(base, [214, 96, 96], 0.5),
      lip: pd.lipCol ? hx(pd.lipCol) : mix(mul(base, 0.84), [176, 82, 84], 0.42),
      line: mix(mul(base, 0.32), [40, 16, 14], 0.6)
    };
  }
  var R = Rig.prototype;
  /* cross-section of the head at height Y: half width W, front depth zf, back depth zb */
  /* the head's width profile as control points, from the crown to the bottom of the chin */
  function catmull(pts, x) {
    for (var i = 0; i < pts.length - 1; i++) if (x <= pts[i + 1][0]) break;
    i = Math.min(i, pts.length - 2);
    var p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    var t = clamp((x - p1[0]) / (p2[0] - p1[0] || 1), 0, 1), t2 = t * t, t3 = t2 * t;
    var m1 = (p2[1] - p0[1]) / ((p2[0] - p0[0]) || 1) * (p2[0] - p1[0]), m2 = (p3[1] - p1[1]) / ((p3[0] - p1[0]) || 1) * (p2[0] - p1[0]);
    return (2 * t3 - 3 * t2 + 1) * p1[1] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2[1] + (t3 - t2) * m2;
  }
  R.profile = function () {
    if (this._pf) return this._pf;
    var c = this.fc, cr = c.crown, sw = c.skullW, mj = (c.cheekY + c.jawY) / 2, mc = (c.jawY + c.chinY) / 2;
    var W = [[cr + 0.18, sw * 0.62], [cr + 0.45, sw * 0.88], [-0.85, sw], [-0.4, sw - c.temple], [c.cheekY, c.cheekW], [mj, lerp(c.cheekW, c.jawW, 0.42) - (c.hollow || 0) * 0.035 + (c.jowl || 0) * 0.01], [c.jawY, c.jawW + (c.jowl || 0) * 0.04], [mc, lerp(c.jawW, c.chinW, 0.55) + (c.jowl || 0) * 0.05], [c.chinY, c.chinW]];
    var Zf = [[cr + 0.18, 0.5], [-0.9, 0.84], [-0.35, 0.9], [0, 0.84], [0.35, 0.88], [c.mouthY, 0.92], [c.chinY, 0.9]];
    this._pf = { W: W, Zf: Zf };
    return this._pf;
  };
  R.sec = function (Y) {
    var c = this.fc, pf = this.profile(), cr = c.crown, W, zf, zb;
    if (Y < cr + 0.18) { var u = clamp((Y - cr) / 0.18, 0, 1), k = Math.sqrt(Math.max(0, 1 - (1 - u) * (1 - u))); W = c.skullW * 0.62 * k; zf = 0.5 * k; zb = -0.75 * k; return { W: W, zf: zf, zb: zb }; }
    if (Y > c.chinY) { var v = clamp((Y - c.chinY) / (c.chinB - c.chinY), 0, 1), e = Math.sqrt(Math.max(0, 1 - v * v)); W = c.chinW * e; zf = 0.9 - v * v * 0.32; zb = lerp(0.2, 0.55, v); return { W: Math.max(W, 0.001), zf: zf, zb: zb }; }
    W = catmull(pf.W, Y); zf = catmull(pf.Zf, Y) * (c.faceZ / 0.9);
    var dome = Math.sqrt(Math.max(0, 1 - Math.pow((Y + 0.25) / (cr + 0.25), 2)));
    if (Y < -0.25) zb = -1.12 * Math.max(dome, 0.66) * (Y < cr + 0.45 ? 1 : 1);
    else if (Y < 0.35) zb = -1.12;
    else if (Y < c.jawY) zb = lerp(-1.12, -0.35, ss((Y - 0.35) / (c.jawY - 0.35)));
    else zb = lerp(-0.35, 0.2, (Y - c.jawY) / (c.chinY - c.jawY));
    return { W: W, zf: zf, zb: zb };
  };
  /* project head-space point to screen */
  R.P = function (X, Y, Z) {
    var x1 = X * this.cy + Z * this.sy, z1 = -X * this.sy + Z * this.cy;
    var y2 = Y * this.cp + z1 * this.sp;
    return [this.ox + this.S * x1, this.oy + this.S * y2];
  };
  R.depth = function (X, Y) {
    var s = this.sec(Y), zc = (s.zf + s.zb) / 2, hd = (s.zf - s.zb) / 2, n = this.n;
    var u = Math.min(1, Math.abs(X) / Math.max(s.W, 1e-3));
    return zc + hd * Math.pow(1 - Math.pow(u, n), 1 / n);
  };
  /* point on the face surface (dz lifts it off the skin) */
  R.on = function (X, Y, dz) { return this.P(X, Y, this.depth(X, Y) + (dz || 0)); };
  R.onL = function (list, dz) { var a = this; return list.map(function (p) { var q = a.on(p[0], p[1], (p[2] || 0) + (dz || 0)); if (p.s) q.s = 1; return q; }); };
  /* screen-space extents of the section at Y */
  R.ext = function (Y) {
    var s = this.sec(Y), zc = (s.zf + s.zb) / 2, hd = (s.zf - s.zb) / 2, n = this.n, lo = [1e9, 0], hi = [-1e9, 0];
    for (var i = 0; i < 64; i++) {
      var t = i / 64 * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
      var X = s.W * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), Z = zc + hd * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n);
      var p = this.P(X, Y, Z);
      if (p[0] < lo[0]) lo = p; if (p[0] > hi[0]) hi = p;
    }
    return { l: lo, r: hi };
  };
  /* outline of the bare head (skull + face): right side top->bottom, then left bottom->top */
  R.outline = function () {
    if (this._ol) return this._ol;
    var c = this.fc, top = c.crown + 0.005, bot = c.chinB - 0.003, L = [], Rr = [], N = 80;
    for (var i = 0; i <= N; i++) {
      var t = i / N, Y = top + (bot - top) * (1 - Math.cos(t * Math.PI)) / 2;
      var e = this.ext(Y); Rr.push(e.r); L.push(e.l);
    }
    this._ol = { R: Rr, L: L, all: Rr.concat(L.slice().reverse()) };
    return this._ol;
  };
  /* point on the head silhouette in direction ang (degrees, 0 = screen right, 90 = down) from the skull centre, pushed out by pad units */
  R.rim = function (ang, pad) {
    var o = this.outline().all, c = this.P(0, -0.35, -0.12), a = ang * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), best = 0;
    for (var i = 0; i < o.length; i++) {
      var p = o[i], q = o[(i + 1) % o.length];
      var ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex; if (Math.abs(den) < 1e-9) continue;
      var wx = p[0] - c[0], wy = p[1] - c[1];
      var tt = (wx * ey - wy * ex) / den, u = (wx * dy - wy * dx) / den;
      if (tt > 0 && u >= 0 && u <= 1 && tt > best) best = tt;
    }
    var r = best + (pad || 0) * this.S;
    return [c[0] + dx * r, c[1] + dy * r];
  };
  R.rims = function (list) { var a = this; return list.map(function (p) { var q = a.rim(p[0], p[1]); if (p.s) q.s = 1; return q; }); };
  R.add = function (layer, s) { (this.layers[layer] = this.layers[layer] || []).push(s); };
  R.id = function (p) { return (p || 'g') + (this.nid++); };
  R.addDef = function (s) { this.defs.push(s); };
  R.lin = function (x1, y1, x2, y2, stops) {
    var id = this.id('lg');
    this.addDef('<linearGradient id="' + id + '" gradientUnits="userSpaceOnUse" x1="' + f(x1) + '" y1="' + f(y1) + '" x2="' + f(x2) + '" y2="' + f(y2) + '">' + stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + rgb(s[1]) + '"' + (s[2] !== undefined ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') + '</linearGradient>');
    return 'url(#' + id + ')';
  };
  R.rad = function (cx, cy, r, stops, o) {
    var id = this.id('rg'); o = o || {};
    this.addDef('<radialGradient id="' + id + '" gradientUnits="userSpaceOnUse" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"' + (o.fx !== undefined ? ' fx="' + f(o.fx) + '" fy="' + f(o.fy) + '"' : '') + (o.tr ? ' gradientTransform="' + o.tr + '"' : '') + '>' + stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + rgb(s[1]) + '"' + (s[2] !== undefined ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') + '</radialGradient>');
    return 'url(#' + id + ')';
  };
  R.clip = function (d) { var id = this.id('cp'); this.addDef('<clipPath id="' + id + '"><path d="' + d + '"/></clipPath>'); return 'url(#' + id + ')'; };
  /* path element. o: {op, blur (std dev px), stroke, sw, clip, extra} */
  R.el = function (d, fill, o) {
    o = o || {};
    var s = '<path d="' + d + '" fill="' + (fill === 'none' || !fill ? 'none' : (typeof fill === 'string' ? fill : rgb(fill))) + '"';
    if (o.op !== undefined && o.op < 1) s += ' opacity="' + fo(o.op) + '"';
    if (o.stroke) s += ' stroke="' + (typeof o.stroke === 'string' ? o.stroke : rgb(o.stroke)) + '" stroke-width="' + (o.sw || 1) + '" stroke-linecap="round" stroke-linejoin="round"';
    if (o.blur) s += ' filter="url(#' + this.blur(o.blur) + ')"';
    if (o.clip) s += ' clip-path="' + o.clip + '"';
    if (o.mode) s += ' style="mix-blend-mode:' + o.mode + '"';
    return s + '/>';
  };
  R.blur = function (sd) {
    var k = 'bl' + String(sd).replace('.', '_'); this._bl = this._bl || {};
    if (!this._bl[k]) { this._bl[k] = 1; this.addDef('<filter id="' + k + '" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + sd + '"/></filter>'); }
    return k;
  };
  R.g = function (inner, o) {
    o = o || {}; var s = '<g';
    if (o.clip) s += ' clip-path="' + o.clip + '"';
    if (o.op !== undefined) s += ' opacity="' + fo(o.op) + '"';
    if (o.blur) s += ' filter="url(#' + this.blur(o.blur) + ')"';
    if (o.tr) s += ' transform="' + o.tr + '"';
    return s + '>' + inner + '</g>';
  };
  /* a tapered ink line */
  R.ink = function (pts, w, o) { o = o || {}; return this.el(taper(pts, w, o.per), o.col || this.line, o); };
  R.c = { hx: hx, rgb: rgb, mix: mix, mul: mul, lum: lum, desat: desat, tones: tones };

  /* ---------------- head ---------------- */
  function head(a) {
    var fc = a.fc, sk = a.skin, ex = a.ex, S = a.S, o = a.outline();
    var skinD = smooth(o.all, true, 0.9);
    a.skinD = skinD;
    var cp = a.clip(skinD); a.skinClip = cp;
    var base = ex.pale ? mix(sk.base, desat(sk.light, 0.6), ex.pale * 0.35) : sk.base;
    var s = a.el(skinD, base);
    var sh = [];
    // broad light: soft warm light on the lit side of the face, cool fall-off on the far side
    var c0 = a.on(-0.35, -0.2), c1 = a.on(0.9, 0.3);
    sh.push(a.el(skinD, a.lin(c0[0], c0[1], c1[0] + S * 0.3, c1[1], [[0, sk.light, 0.45], [0.55, sk.base, 0], [1, sk.shadow, 0.35]])));
    // form shadow on the far side plane: temple, outer socket, under the cheekbone, along the jaw
    var hol = fc.hollow || 0;
    var edge = [[0.48, -1.5], [0.54, -1.0], [0.6, -0.6], [0.66, -0.3], [0.74, -0.04], [0.8, 0.16], [0.7 - hol * 0.12, 0.36], [0.6 - hol * 0.12, 0.56], [0.54, 0.78], [0.46, 1.0], [0.32, 1.22], [0.16, 1.5]];
    var ept = edge.map(function (p) { var s2 = a.sec(Math.min(p[1], fc.chinB * 0.8)); return a.on(p[0] * Math.max(s2.W, 0.2), p[1]); });
    var far = ept.concat([[ept[ept.length - 1][0] + S * 2, ept[ept.length - 1][1] + S], [ept[0][0] + S * 2, ept[0][1] - S]]);
    var farD = smooth(far, true, 0.7);
    sh.push(a.el(farD, sk.shadow, { op: 0.55, blur: 2.2 }));
    sh.push(a.el(farD, sk.shadow, { op: 0.5, blur: 0.7 }));
    // hollow cheeks (gaunt): shadow pockets under both cheekbones
    if (hol > 0) {
      [-1, 1].forEach(function (sd) {
        var pts = a.onL([[sd * 0.88, 0.3], [sd * 0.62, 0.36], [sd * 0.5, 0.58], [sd * 0.62, 0.8], [sd * 0.86, 0.72]]);
        sh.push(a.el(smooth(pts, true), sk.deep, { op: 0.32 * hol * (sd > 0 ? 1.2 : 0.85), blur: 3.2 }));
      });
      [-1, 1].forEach(function (sd) {
        var pts = a.onL([[sd * 0.86, -0.75], [sd * 0.72, -0.6], [sd * 0.74, -0.25], [sd * 0.9, -0.2]]);
        sh.push(a.el(smooth(pts, true), sk.shadow, { op: 0.35 * hol, blur: 2.6 }));
      });
    }
    // eye sockets
    [-1, 1].forEach(function (sd) {
      var ey = 0, exx = sd * fc.eyeX;
      var pts = a.onL([[exx - sd * 0.24, ey - 0.05], [exx - sd * 0.08, ey - 0.2], [exx + sd * 0.16, ey - 0.2], [exx + sd * 0.27, ey - 0.02], [exx + sd * 0.12, ey + 0.13], [exx - sd * 0.12, ey + 0.12]]);
      sh.push(a.el(smooth(pts, true), sk.shadow, { op: (sd > 0 ? 0.42 : 0.3) + a.age * 0.1 + (hol * 0.2) + (a.pd.bags || 0) * 0.15, blur: 2.4 }));
      // inner corner pocket beside the nose bridge
      var ic = a.on(sd * (fc.eyeX - fc.eyeW - 0.04), -0.04);
      sh.push('<ellipse cx="' + f(ic[0]) + '" cy="' + f(ic[1]) + '" rx="' + f(S * 0.07) + '" ry="' + f(S * 0.09) + '" fill="' + rgb(sk.deep) + '" opacity="0.3" filter="url(#' + a.blur(1.6) + ')"/>');
    });
    // cheek warmth
    var bl = a.pd.blush === undefined ? 0.25 : a.pd.blush;
    if (bl > 0) [-1, 1].forEach(function (sd) {
      var c2 = a.on(sd * 0.56, 0.36 - ex.cheek * 0.05);
      sh.push('<ellipse cx="' + f(c2[0]) + '" cy="' + f(c2[1]) + '" rx="' + f(S * (sd > 0 ? 0.2 : 0.27)) + '" ry="' + f(S * 0.17) + '" fill="' + rgb(sk.blush) + '" opacity="' + fo(Math.min(0.75, bl * 0.6)) + '" filter="url(#' + a.blur(3.5) + ')"/>');
    });
    // nose bridge/forehead/cheekbone lights
    var lp = [[-0.25, -0.85, 0.32, 0.2], [-0.55, 0.12, 0.2, 0.12]];
    lp.forEach(function (q) { var c3 = a.on(q[0], q[1]); sh.push('<ellipse cx="' + f(c3[0]) + '" cy="' + f(c3[1]) + '" rx="' + f(S * q[2]) + '" ry="' + f(S * q[3]) + '" fill="' + rgb(sk.hi) + '" opacity="' + fo(0.35 + (hol * 0.15)) + '" filter="url(#' + a.blur(3) + ')"/>'); });
    // under the chin: the jaw's underside turns away from the light
    var jl = [];
    for (var Y = fc.jawY - 0.1; Y <= fc.chinB; Y += 0.04) jl.push(a.ext(Y).l);
    var jr = [];
    for (Y = fc.chinB; Y >= fc.jawY - 0.1; Y -= 0.04) jr.push(a.ext(Y).r);
    var und = jl.concat(jr).map(function (p) { return [p[0], p[1] + S * 0.06]; });
    sh.push(a.el(smooth(und, true), sk.shadow, { op: 0.45, blur: 2.2 }));
    s += a.g(sh.join(''), { clip: cp });
    a.add('head', s);
    // contour: heavier on the shadow side and under the jaw
    var lw = a.pd.lineW || 1;
    var Rr = o.R.filter(function (p, i) { return i > o.R.length * 0.36; });
    var Ll = o.L.filter(function (p, i) { return i > o.L.length * 0.36; });
    var chinPt = o.R[o.R.length - 1];
    var cont = Rr.concat([chinPt]);
    a.add('lines', a.ink(cont, function (t) { return (1.5 + t * 0.9) * lw; }, { per: 1 }));
    a.add('lines', a.ink(Ll.concat([chinPt]), function (t) { return (0.9 + t * 1.2) * lw; }, { per: 1, op: 0.9 }));
  }

  /* ---------------- neck ---------------- */
  function neck(a) {
    var fc = a.fc, S = a.S, sk = a.skin, nw = fc.neckW * (a.pd.neckK || 1);
    var y0 = fc.jawY - 0.1, y1 = fc.chinB + 0.62;
    var l0 = a.P(-nw, y0, -0.2), l1 = a.P(-nw * 1.08, y1, -0.15), r0 = a.P(nw * 0.92, y0, -0.15), r1 = a.P(nw * 1.04, y1, -0.1);
    var mid = a.P(0, y1 + 0.25, 0.3);
    var d = smooth([K(l0), [lerp(l0[0], l1[0], 0.5) + S * 0.02, lerp(l0[1], l1[1], 0.5)], K(l1), [mid[0], mid[1]], K(r1), [lerp(r0[0], r1[0], 0.5) - S * 0.01, lerp(r0[1], r1[1], 0.5)], K(r0)], true);
    var s = a.el(d, sk.base);
    var cp = a.clip(d);
    var inner = '';
    inner += a.el(d, a.lin(l0[0], 0, r0[0], 0, [[0, sk.light, 0.3], [0.45, sk.base, 0], [1, sk.deep, 0.6]]));
    // the head's cast shadow on the neck
    var o = a.outline(), jaw = [];
    o.L.forEach(function (p, i) { if (i > o.L.length * 0.55) jaw.push(p); });
    var jr = o.R.filter(function (p, i) { return i > o.R.length * 0.55; }).reverse();
    var shp = jaw.concat(jr).map(function (p) { return [p[0] + S * 0.12, p[1] + S * 0.3]; });
    inner += a.el(smooth(shp.concat([[r0[0] + S, r0[1] - S], [l0[0] - S, l0[1] - S]]), true), sk.shadow, { op: 0.85, blur: 2.4 });
    if (a.age > 0.4 || (fc.hollow || 0) > 0) {
      // tendons and the throat for older faces
      var tA = a.P(-nw * 0.55, fc.chinY + 0.1, 0.1), tB = a.P(-nw * 0.1, y1, 0.3);
      inner += a.ink([tA, [lerp(tA[0], tB[0], 0.5) - S * 0.03, lerp(tA[1], tB[1], 0.5)], tB], [0, 1.1, 0.2], { op: 0.35 * a.age + 0.1 * (fc.hollow || 0) });
      var tC = a.P(nw * 0.5, fc.chinY + 0.1, 0.1), tD = a.P(nw * 0.08, y1, 0.3);
      inner += a.ink([tC, tD], [0, 1, 0.2], { op: 0.3 * a.age });
      inner += a.el(smooth([a.P(-0.1, y1 - 0.2, 0.3), a.P(0.06, y1 - 0.45, 0.35), a.P(0.18, y1 - 0.15, 0.3)], false), 'none', { stroke: a.line, sw: 0.8, op: 0.3 * a.age });
    }
    s += a.g(inner, { clip: cp });
    s += a.ink([l0, [lerp(l0[0], l1[0], 0.5) + S * 0.02, lerp(l0[1], l1[1], 0.5)], l1], [1.2, 1.4, 1.6]);
    s += a.ink([r0, [lerp(r0[0], r1[0], 0.5) - S * 0.01, lerp(r0[1], r1[1], 0.5)], r1], [1.6, 1.8, 1.8]);
    a.neckBase = { l: l1, r: r1, m: mid, top: a.P(0, y0, 0) };
    a.add('neck', s);
  }

  /* ---------------- ears ---------------- */
  function ears(a) {
    var fc = a.fc, S = a.S, sk = a.skin;
    if (a.pd.noEars) return;
    // near ear (screen left) is the visible one in this 3/4 view
    var y0 = fc.earY, h = fc.earH, sx = a.sy * 1.15 + 0.35;
    var top = a.P(-a.sec(y0).W * 0.97, y0, -0.18), bot = a.P(-a.sec(y0 + h).W * 0.95, y0 + h, -0.12);
    var wv = S * 0.24 * sx;
    var pts = [top, [top[0] - wv * 0.75, top[1] - S * 0.02], [top[0] - wv, top[1] + S * h * 0.3], [bot[0] - wv * 0.75, bot[1] - S * h * 0.25], [bot[0] - wv * 0.25, bot[1] + S * 0.02], bot];
    var d = smooth(pts, false) + 'Z';
    var s = a.el(d, sk.base);
    s += a.g(a.el(d, sk.shadow, { op: 0.5 }) + a.el(smooth([[top[0] - wv * 0.15, top[1] + S * 0.12], [top[0] - wv * 0.6, top[1] + S * 0.1], [top[0] - wv * 0.7, top[1] + S * h * 0.4], [bot[0] - wv * 0.35, bot[1] - S * h * 0.3], [bot[0] - wv * 0.1, bot[1] - S * h * 0.4]], true), sk.deep, { op: 0.55, blur: 0.8 }), { clip: a.clip(d) });
    s += a.ink(pts, [0.8, 1.6, 1.2]);
    s += a.ink([[top[0] - wv * 0.3, top[1] + S * 0.1], [top[0] - wv * 0.62, top[1] + S * 0.14], [top[0] - wv * 0.6, top[1] + S * h * 0.42], [bot[0] - wv * 0.2, bot[1] - S * h * 0.3]], [0.2, 1.0, 0.2], { op: 0.7 });
    a.add('ears', s);
    a.ear = { top: top, bot: bot, wv: wv };
    // far ear: just a sliver behind the cheek when the head is nearly frontal
    if (a.yaw < 0.22) {
      var t2 = a.ext(y0 + 0.08).r, b2 = a.ext(y0 + h * 0.85).r, wv2 = S * 0.1 * (0.6 - a.yaw * 2);
      var p2 = [[t2[0] - 1, t2[1]], [t2[0] + wv2, t2[1] + S * 0.02], [t2[0] + wv2 * 1.1, t2[1] + S * h * 0.4], [b2[0] + wv2 * 0.4, b2[1]], [b2[0] - 1, b2[1]]];
      var d2 = smooth(p2, false) + 'Z';
      a.add('ears', a.el(d2, sk.shadow) + a.ink(p2.slice(1), [0.8, 1.4, 0.8]));
    }
  }

  /* ---------------- eyes ---------------- */
  function lidUp(u, open) { var k = Math.pow(Math.max(0, 1 - u * u), 0.72); return -k * (1 + 0.22 * -u) * open; }
  function lidLo(u, h) { var k = Math.pow(Math.max(0, 1 - u * u), 0.95); return k * (1 + 0.18 * u) * h; }
  function eyes(a) {
    var fc = a.fc, ex = a.ex, pd = a.pd, S = a.S, sk = a.skin;
    var irisCol = hx(pd.eyes || [90, 80, 64]);
    var heavy = pd.heavyLids || 0, lashes = pd.lashes === undefined ? (/woman|girl|old$/.test(pd.face) ? 1 : 0) : pd.lashes;
    var s = '', top = '';
    [-1, 1].forEach(function (sd) {
      var cx = sd * fc.eyeX, cyy = 0, w = fc.eyeW * (pd.eyeK || 1), h = fc.eyeH * (pd.eyeHK || 1);
      var tilt = (fc.eyeTilt || 0);
      var open = h * clamp(ex.lid - heavy * 0.25 - a.age * 0.08, 0.12, 1.5);
      var lowH = h * (0.62 - ex.lowLid * 0.35 + a.age * 0.05) * (1 - ex.cheek * 0.15);
      var N = 13, U = [], Lo = [];
      function pt(u, v, dz) { return a.on(cx + sd * u * w, cyy + v - tilt * sd * u * (sd > 0 ? 1 : 1) * 0 + tilt * (u > 0 ? -u : 0), (dz || 0) + 0.05 * (1 - u * u) - 0.02); }
      for (var i = 0; i <= N; i++) {
        var u = -1 + 2 * i / N;
        var tl = -tilt * (u + 1) * 0.5;
        U.push(a.on(cx + sd * u * w, cyy + tl + lidUp(u, open) * (u > 0 ? 1 : 1), 0.04 * (1 - u * u)));
        Lo.push(a.on(cx + sd * u * w, cyy + tl + lidLo(u, lowH), 0.03 * (1 - u * u)));
      }
      var inner = U[0], outer = U[N];
      // the eye opening
      var opening = U.concat(Lo.slice(1, N).reverse());
      var od = smooth(opening, true, 0.9);
      var ocp = a.clip(od);
      var scl = mix([236, 228, 218], sk.base, 0.22);
      if (ex.pale) scl = mix(scl, [230, 230, 230], 0.3);
      var e = a.el(od, scl);
      // iris: a disc on the eyeball, foreshortened by the projection
      var gx = ex.gazeX * 0.55 + (pd.lookX || 0), gy = ex.gazeY * 0.5 + (pd.lookY || 0);
      var ir = (pd.irisR || 0.47) * w * (ex.stare ? 1 : 1), icx = cx + sd * 0 + w * gx * 0.55 + (sd < 0 ? 0.01 : -0.015), icy = cyy - open * 0.1 + h * gy * 0.6 - tilt * 0.5;
      var ipts = [];
      for (var k = 0; k < 24; k++) { var t = k / 24 * Math.PI * 2; ipts.push(a.on(icx + Math.cos(t) * ir, icy + Math.sin(t) * ir * 1.02, 0.07)); }
      var id = smooth(ipts, true);
      var ic = a.on(icx, icy, 0.07), irPx = ir * S * (sd > 0 ? a.cy * 0.9 + 0.1 : 1);
      var irisFill = a.rad(ic[0] - irPx * 0.15, ic[1] + irPx * 0.25, irPx * 1.15, [[0, mix(irisCol, [255, 245, 220], 0.28)], [0.55, irisCol], [0.9, mul(irisCol, 0.55)], [1, mul(irisCol, 0.4)]]);
      e += a.el(id, irisFill);
      e += a.el(id, 'none', { stroke: mul(irisCol, 0.35), sw: 0.9 });
      var pr = ir * 0.42 * ex.pupil * (pd.pupil || 1);
      var pp = []; for (k = 0; k < 16; k++) { t = k / 16 * Math.PI * 2; pp.push(a.on(icx + Math.cos(t) * pr, icy + Math.sin(t) * pr, 0.075)); }
      e += a.el(smooth(pp, true), mix(mul(irisCol, 0.2), [10, 8, 10], 0.7));
      // shadow of the upper lid and lashes across the eyeball
      var lidSh = U.concat(offset(U.slice().reverse(), 0, S * (0.05 + h * 0.9)));
      e += a.el(smooth(lidSh, true), mix(sk.shadow, [60, 40, 50], 0.3), { op: 0.65, blur: 1.4 });
      // catchlights (light from upper left)
      if (!ex.stare) {
        var cl1 = a.on(icx - ir * 0.35, icy - ir * 0.4, 0.09), cl2 = a.on(icx + ir * 0.4, icy + ir * 0.35, 0.09);
        e += '<ellipse cx="' + f(cl1[0]) + '" cy="' + f(cl1[1]) + '" rx="' + f(Math.max(1.1, irPx * 0.28)) + '" ry="' + f(Math.max(1, irPx * 0.24)) + '" fill="#fbf8f2"/>';
        e += '<circle cx="' + f(cl2[0]) + '" cy="' + f(cl2[1]) + '" r="' + f(Math.max(0.5, irPx * 0.11)) + '" fill="#fbf8f2" opacity="0.8"/>';
      } else {
        var cl3 = a.on(icx - ir * 0.3, icy - ir * 0.3, 0.09);
        e += '<circle cx="' + f(cl3[0]) + '" cy="' + f(cl3[1]) + '" r="' + f(Math.max(0.6, irPx * 0.13)) + '" fill="#e8e4dc" opacity="0.55"/>';
      }
      s += a.g(e, { clip: ocp });
      // upper lid (skin above the line), crease, lower lid
      var creaseH = h * (0.62 + heavy * 0.05) + (1 - ex.lid) * h * 0.25;
      var C1 = [];
      for (i = 1; i < N; i++) { u = -1 + 2 * i / N; var tl2 = -tilt * (u + 1) * 0.5; C1.push(a.on(cx + sd * u * w * 1.06, cyy + tl2 + lidUp(u, open) - creaseH * Math.pow(1 - u * u, 0.4) * (1 + heavy * 0.35 * Math.max(0, u)), 0.04)); }
      // lid fold tone
      var fold = U.slice(1, N).concat(C1.slice().reverse());
      top += a.el(smooth(fold, true), sk.shadow, { op: 0.35 + heavy * 0.25, blur: 0.9 });
      // upper lash line: heavy, thickest toward the outer corner
      var lw = (pd.lidW || 1) * (lashes ? 1.15 : 1);
      top += a.ink(U, function (t) { return (t < 0.15 ? lerp(0.6, 1.6, t / 0.15) : t > 0.8 ? lerp(2.5, 1.4, (t - 0.8) / 0.2) : lerp(1.6, 2.5, (t - 0.15) / 0.65)) * lw; }, { per: 2, col: rgb(mix([20, 12, 12], sk.line, 0.3)) });
      if (lashes) {
        for (var q = 0; q < 3; q++) {
          var uu = 0.55 + q * 0.2, base = a.on(cx + sd * uu * w, cyy - tilt * (uu + 1) * 0.5 + lidUp(uu, open), 0.05);
          var tip = [base[0] + sd * S * (0.04 + q * 0.025), base[1] - S * (0.05 - q * 0.008)];
          top += a.ink([base, [lerp(base[0], tip[0], 0.6), lerp(base[1], tip[1], 0.4)], tip], [1.1, 0.8, 0.1], { col: '#1c1212' });
        }
      }
      top += a.ink(C1, [0.1, 0.9 + heavy * 0.4, 0.3], { op: 0.75 });
      if (heavy > 0.3 || a.age > 0.5) top += a.ink(C1.map(function (p) { return [p[0], p[1] - S * 0.035]; }).slice(Math.floor(N * 0.4)), [0.1, 0.6, 0.1], { op: 0.35 + a.age * 0.2 });
      // lower lid line, softer
      top += a.ink(Lo, function (t) { return t < 0.1 ? 0.3 : t > 0.85 ? 1.1 : lerp(0.5, 1.1, t); }, { per: 2, op: 0.55 });
      // tear line / lower lid rim
      var rim = Lo.slice(1, N).map(function (p) { return [p[0], p[1] + 0.7]; });
      top += a.el(smooth(rim, false), 'none', { stroke: sk.light, sw: 0.7, op: 0.5 });
      // under-eye: bags, dark circles, smile cheek push
      var bags = (pd.bags || 0) + ex.bags + a.age * 0.5;
      if (bags > 0.05) {
        var B = [];
        for (i = 1; i < N; i++) { u = -1 + 2 * i / N; B.push(a.on(cx + sd * u * w * 1.05, cyy + lidLo(u, lowH) + h * (0.6 + bags * 0.4) * Math.pow(1 - u * u, 0.5) + 0.02, 0.03)); }
        var bagD = smooth(Lo.slice(1, N).concat(B.slice().reverse()), true);
        top += a.el(bagD, pd.circles ? hx(pd.circles) : mix(sk.shadow, [110, 80, 120], 0.25), { op: Math.min(0.75, 0.25 + bags * 0.4), blur: 1.6 });
        top += a.ink(B.slice(1, N - 2), [0.1, 0.8, 0.1], { op: Math.min(0.55, bags * 0.45) });
      }
      // crow's feet
      if (a.age > 0.3 || ex.cheek > 0.5) {
        var oc = a.on(cx + sd * w * 1.12, cyy + 0.0, 0.0), n3 = a.age > 0.3 ? 3 : 1;
        for (q = 0; q < n3; q++) {
          var ang = (-0.35 + q * 0.38) , len = S * (0.1 + a.age * 0.06);
          var p1 = [oc[0] + sd * S * 0.02, oc[1] + q * S * 0.03 - S * 0.02], p2 = [p1[0] + sd * Math.cos(ang) * len * (sd > 0 ? 0.6 : 1), p1[1] + Math.sin(ang) * len];
          top += a.ink([p1, [lerp(p1[0], p2[0], 0.5), lerp(p1[1], p2[1], 0.5) - 0.5], p2], [0.15, 0.85, 0.05], { op: 0.45 * Math.max(a.age, ex.cheek * 0.4) });
        }
      }
      a['eye' + (sd < 0 ? 'L' : 'R')] = { U: U, Lo: Lo, inner: inner, outer: outer, cx: cx, w: w, open: open };
    });
    a.add('eyes', s + top);
  }

  /* ---------------- brows ---------------- */
  function brows(a) {
    var fc = a.fc, ex = a.ex, pd = a.pd, S = a.S, sk = a.skin;
    var bc = hx(pd.browCol || mix(hx(pd.hairCol || a.def.hair || [60, 40, 30]), [30, 20, 20], 0.3));
    var thick = fc.browT * (pd.browThick || 1), s = '';
    [-1, 1].forEach(function (sd) {
      var inX = sd * (fc.eyeX - fc.eyeW * 1.05), outX = sd * (fc.eyeX + fc.eyeW * 1.35);
      var by = fc.browY;
      var raiseIn = ex.browIn * 0.11, raiseOut = ex.browOut * 0.08, knit = ex.browKnit * 0.04;
      var arch = pd.browStraight ? 0.02 : 0.06;
      var pts = [];
      for (var i = 0; i <= 8; i++) {
        var t = i / 8, X = lerp(inX + sd * knit, outX, t);
        var Y = by - lerp(raiseIn, raiseOut, ss(t)) - arch * Math.sin(Math.PI * Math.min(1, t * 1.25)) * 1 + t * t * 0.05 * (pd.browStraight ? 0.3 : 1) - (pd.browY || 0);
        if (ex.browIn < 0) Y -= ex.browIn * 0.05 * (1 - t) * (1 - t) * 0;
        pts.push(a.on(X, Y, 0.02));
      }
      var wf = function (t) { return S * thick * (t < 0.12 ? lerp(0.75, 1.0, t / 0.12) : lerp(1.0, 0.25, Math.pow((t - 0.12) / 0.88, 1.3))) * (sd > 0 ? 0.9 : 1); };
      s += a.el(taper(pts, wf, 2), bc);
      // hair texture: a few strands at the head of the brow
      for (var k = 0; k < 4; k++) {
        var p0 = pts[Math.min(k, 7)], p1 = pts[Math.min(k + 2, 8)];
        s += a.ink([[p0[0], p0[1] + S * thick * 0.35], [lerp(p0[0], p1[0], 0.6), p0[1] - S * thick * 0.25]], [0.2, 0.7, 0.1], { col: rgb(mix(bc, [0, 0, 0], 0.4)), op: 0.7 });
      }
      a['brow' + (sd < 0 ? 'L' : 'R')] = pts;
    });
    // frown lines between the brows
    if (ex.browKnit > 0.3 || (pd.frown || 0) > 0) {
      var k2 = Math.max(ex.browKnit - 0.2, pd.frown || 0);
      [-0.06, 0.07].forEach(function (x) { var p1 = a.on(x, fc.browY - 0.02), p2 = a.on(x * 0.6, fc.browY - 0.16); s += a.ink([p1, p2], [0.2, 1.0, 0.1], { op: Math.min(0.7, k2 * 0.8) }); });
    }
    a.add('brows', s);
  }

  /* ---------------- nose ---------------- */
  function nose(a) {
    var fc = a.fc, ex = a.ex, pd = a.pd, S = a.S, sk = a.skin;
    var ny = fc.noseY, nz = fc.noseZ * (pd.noseK || 1), nw = fc.noseW * (pd.noseWK || 1) * (1 + ex.flare * 0.08), tipR = fc.noseTip * (pd.noseTipK || 1);
    var bump = pd.noseBump || 0;
    function ridgeZ(t) { return nz * (Math.pow(t, 1.25) + bump * 0.18 * Math.sin(Math.PI * t * 0.9)) ; }
    function rp(t, x, dz) { var Y = lerp(-0.12, ny - tipR * 0.35, t); return a.P(x || 0, Y, a.depth(0, Y) + ridgeZ(t) + (dz || 0)); }
    var s = '', base = a.depth(0, ny);
    var tip = a.P(0, ny - tipR * 0.3, base + nz);
    // shadow plane on the far side of the nose (light from the upper left)
    var side = [];
    for (var i = 0; i <= 8; i++) side.push(rp(i / 8, 0.025, 0.0));
    var wingR = a.on(nw * 0.95, ny - 0.02, 0.05), wingRb = a.on(nw * 0.75, ny + 0.05, 0.06);
    var sp = side.concat([[tip[0] + S * 0.05, tip[1] + S * 0.06], wingRb, wingR, a.on(nw * 0.9, ny - 0.18, 0.01), a.on(0.2, 0.05, 0)]);
    s += a.el(smooth(sp, true, 0.8), sk.shadow, { op: 0.75, blur: 1.6 });
    // under-nose cast shadow on the upper lip, falling down and right
    var u0 = a.on(-nw * 0.6, ny + 0.06, 0.04), u1 = a.on(nw * 1.2, ny + 0.06, 0.02), u2 = a.on(nw * 0.9, ny + 0.2, 0), u3 = a.on(-nw * 0.2, ny + 0.17, 0);
    s += a.el(smooth([u0, u1, u2, u3], true), sk.deep, { op: 0.55, blur: 1.8 });
    // tip and wings
    var bL = a.on(-nw, ny - 0.02, 0.05), bR = a.on(nw * 0.95, ny - 0.02, 0.05);
    var under = [bL, a.on(-nw * 0.55, ny + 0.06, 0.08), [tip[0] - S * 0.02, tip[1] + S * tipR * 1.15], a.on(nw * 0.55, ny + 0.06, 0.09), bR];
    // tip highlight
    s += '<ellipse cx="' + f(tip[0] - S * 0.035) + '" cy="' + f(tip[1] - S * 0.02) + '" rx="' + f(S * tipR * 0.55) + '" ry="' + f(S * tipR * 0.4) + '" fill="' + rgb(sk.hi) + '" opacity="0.55" filter="url(#' + a.blur(1) + ')"/>';
    // bridge highlight on the lit side
    var hl = []; for (i = 2; i <= 6; i++) hl.push(rp(i / 8, -0.035, 0.0));
    s += a.ink(hl, [0.3, 1.6, 0.4], { col: rgb(sk.hi), op: 0.45 });
    // nostrils
    [-1, 1].forEach(function (sd) {
      var c = a.on(sd * nw * 0.48, ny + 0.035, 0.08 + (sd < 0 ? 0.02 : 0));
      var rx = S * nw * 0.32 * (sd > 0 ? a.cy * 0.85 : 1) * (1 + ex.flare * 0.15), ry = S * 0.026;
      s += '<ellipse cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" transform="rotate(' + (sd * 12) + ' ' + f(c[0]) + ' ' + f(c[1]) + ')" fill="' + rgb(mix(sk.deep, [40, 16, 20], 0.5)) + '"/>';
    });
    // line work: the tip's underside, the near wing, a hint of the far ridge
    s += a.ink(under.slice(1, 4), [0.4, 1.3, 0.4], { op: 0.85 });
    var wl = [a.on(-nw * 0.85, ny - 0.13, 0.03), a.on(-nw * 1.1, ny - 0.04, 0.04), a.on(-nw * 1.02, ny + 0.035, 0.05), a.on(-nw * 0.62, ny + 0.06, 0.07)];
    s += a.ink(wl, [0.3, 1.4, 0.6], { op: 0.9 });
    var wr = [a.on(nw * 0.82, ny - 0.1, 0.03), a.on(nw * 1.0, ny - 0.01, 0.05), a.on(nw * 0.7, ny + 0.06, 0.07)];
    s += a.ink(wr, [0.3, 1.2, 0.5], { op: 0.8 });
    var rl = []; for (i = 3; i <= 8; i++) rl.push(rp(i / 8, 0.05, -0.01));
    s += a.ink(rl, [0.1, 0.9, 0.5], { op: 0.45 + bump * 0.2 });
    a.add('nose', s);
    a.noseInfo = { tip: tip, ny: ny, nw: nw };
  }

  /* ---------------- mouth ---------------- */
  function mouth(a) {
    var fc = a.fc, ex = a.ex, pd = a.pd, S = a.S, sk = a.skin;
    var my = fc.mouthY, mw = fc.mouthW * (pd.mouthK || 1) * ex.wide, ul = fc.ulip * (pd.lipK || 1), ll = fc.llip * (pd.lipK || 1);
    var curve = clamp(ex.curve + (pd.mouthCurve || 0), -1.4, 1.4), open = clamp(ex.open, 0, 1), press = ex.press;
    if (press) { ul *= 0.6; ll *= 0.65; }
    var cornerLift = curve * 0.075, wave = ex.wave;
    var N = 12, M = [], UT = [], LB = [], UI = [], LI = [];
    function mY(u) {
      var c = -cornerLift * Math.pow(Math.abs(u), 2.2) + (curve > 0 ? curve * 0.03 * (1 - u * u) : 0);
      c += wave * 0.012 * Math.sin(u * Math.PI * 2);
      return my + c;
    }
    var gap = open * 0.13 * (1 + curve * 0.2);
    for (var i = 0; i <= N; i++) {
      var u = -1 + 2 * i / N, X = u * mw, Y = mY(u), k = Math.pow(1 - u * u, 0.6);
      var bow = 1 - 0.35 * Math.exp(-u * u / 0.012) + 0.12 * Math.exp(-Math.pow(Math.abs(u) - 0.28, 2) / 0.02);
      UT.push(a.on(X * 1.0, Y - gap * 0.4 * k - ul * k * bow - 0.005, 0.07 * k));
      UI.push(a.on(X * 0.98, Y - gap * 0.4 * k, 0.07 * k));
      LI.push(a.on(X * 0.98, Y + gap * 0.6 * k, 0.07 * k));
      LB.push(a.on(X * 0.96, Y + gap * 0.6 * k + ll * Math.pow(1 - u * u, 0.75), 0.07 * k));
      M.push(a.on(X, Y, 0.07 * k));
    }
    var s = '';
    var lip = ex.pale ? mix(sk.lip, sk.base, 0.45) : sk.lip;
    var lipU = mix(lip, sk.deep, 0.25), lipL = mix(lip, sk.light, 0.12);
    // lips
    var upD = smooth(UT.concat(UI.slice(1, N).reverse()), true, 0.9);
    var loD = smooth(LI.concat(LB.slice(1, N).reverse()), true, 0.9);
    // shadow under the lower lip and the chin dimple
    var cs = a.on(0, my + gap * 0.6 + ll + 0.08, 0.05);
    s += '<ellipse cx="' + f(cs[0] + S * 0.02) + '" cy="' + f(cs[1]) + '" rx="' + f(S * mw * 0.6) + '" ry="' + f(S * 0.05) + '" fill="' + rgb(sk.shadow) + '" opacity="0.7" filter="url(#' + a.blur(1.6) + ')"/>';
    if (open > 0.02) {
      var inD = smooth(UI.concat(LI.slice(1, N).reverse()), true, 0.9);
      var mcp = a.clip(inD);
      var inner = a.el(inD, '#3a1618');
      if (ex.teeth || open > 0.25) {
        var tt = UI.map(function (p) { return [p[0], p[1] + S * 0.045 * (ex.teeth ? 1 : 0.6)]; });
        var td = smooth(UI.concat(tt.slice().reverse()), true);
        inner += a.el(td, '#e8e0d4') + a.el(td, mix(sk.shadow, [200, 190, 180], 0.5), { op: 0.0 });
        inner += a.el(smooth(UI.concat(offset(UI.slice().reverse(), 0, S * 0.016)), true), '#9a8a80', { op: 0.5, blur: 0.6 });
      }
      if (open > 0.2) { var tg = a.on(0.05, my + gap * 0.5, 0.05); inner += '<ellipse cx="' + f(tg[0]) + '" cy="' + f(tg[1]) + '" rx="' + f(S * mw * 0.55) + '" ry="' + f(S * gap * 0.35) + '" fill="#8a3a3c"/>'; }
      s += a.g(inner, { clip: mcp });
    }
    s += a.el(upD, lipU) + a.el(loD, lipL);
    // lower lip highlight
    var lh = a.on(-mw * 0.25, my + gap * 0.6 + ll * 0.45, 0.09);
    s += '<ellipse cx="' + f(lh[0]) + '" cy="' + f(lh[1]) + '" rx="' + f(S * mw * 0.35) + '" ry="' + f(S * ll * 0.22) + '" fill="' + rgb(mix(lipL, [255, 240, 230], 0.45)) + '" opacity="0.65" filter="url(#' + a.blur(0.8) + ')"/>';
    // philtrum and the light ridge of the upper lip
    var ph = a.on(0.01, my - ul - 0.07, 0.06), ph2 = a.on(0.02, fc.noseY + 0.1, 0.04);
    s += a.ink([ph2, ph], [0.6, 1.4, 0.8], { col: rgb(sk.shadow), op: 0.45 });
    s += a.el(smooth(UT.slice(2, N - 1), false), 'none', { stroke: sk.light, sw: 1.0, op: 0.5 });
    // mouth line
    var lineCol = rgb(mix(sk.deep, [40, 10, 14], 0.6));
    if (open > 0.02) {
      s += a.ink(UI, [0.6, 1.5, 0.6], { col: lineCol });
      s += a.ink(LI.slice(2, N - 1), [0.2, 0.8, 0.2], { col: lineCol, op: 0.6 });
    } else {
      s += a.ink(M, function (t) { return (t < 0.08 || t > 0.92 ? 1.4 : 0.9 + 0.7 * Math.sin(Math.PI * t)) * (press ? 1.3 : 1); }, { col: lineCol });
    }
    // corners
    [0, N].forEach(function (i2) { var p = M[i2], sd = i2 ? 1 : -1; s += a.ink([[p[0] - sd * S * 0.02, p[1] - S * 0.005], [p[0] + sd * S * 0.03, p[1] - S * (0.02 * curve + 0.005)]], [0.9, 0.7, 0.1], { col: lineCol, op: 0.8 }); });
    // lip outline: soft lower contour
    s += a.ink(LB.slice(3, N - 2), [0.1, 0.7, 0.1], { op: 0.35 });
    // smile folds / age folds
    var age = a.age, nl = Math.max(age * 0.8, ex.cheek * 0.6, (pd.folds || 0));
    if (nl > 0.1) {
      [-1, 1].forEach(function (sd) {
        var p0 = a.on(sd * (fc.noseW + 0.08), fc.noseY - 0.04, 0.02), p1 = a.on(sd * (mw + 0.14 + ex.cheek * 0.04), (fc.noseY + my) / 2 + 0.06, 0.0), p2 = a.on(sd * (mw + 0.08), my + 0.12 + age * 0.08, 0);
        s += a.ink([p0, p1, p2], [0.2, 1.3 * nl + 0.3, 0.05], { op: Math.min(0.75, nl * 0.85) });
        var sh2 = [p0, p1, p2, a.on(sd * (mw + 0.22), my + 0.05), a.on(sd * (fc.noseW + 0.25), fc.noseY + 0.05)];
        if (sd > 0 || age > 0.5) s += a.el(smooth(sh2, true), sk.shadow, { op: 0.35 * nl, blur: 1.6 });
      });
    }
    if (age > 0.55) {
      // marionette lines and lip wrinkles
      [-1, 1].forEach(function (sd) {
        var q0 = a.on(sd * (mw + 0.03), my + 0.05, 0.02), q1 = a.on(sd * (mw + 0.1), my + 0.32, 0);
        s += a.ink([q0, q1], [0.3, 1.0, 0.05], { op: (age - 0.45) * 0.8 });
      });
      for (i = -2; i <= 2; i++) { if (!i) continue; var w0 = a.on(i * 0.07, my - ul - 0.01, 0.07), w1 = a.on(i * 0.075, my - ul - 0.07, 0.06); s += a.ink([w0, w1], [0.3, 0.6, 0.05], { op: (age - 0.5) * 0.6 }); }
    }
    if (ex.cheek > 0.2) {
      // smiling cheeks bunch up
      [-1, 1].forEach(function (sd) { var c = a.on(sd * 0.5, 0.42, 0.03); s += '<ellipse cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" rx="' + f(S * 0.2) + '" ry="' + f(S * 0.12) + '" fill="' + rgb(sk.hi) + '" opacity="' + fo(0.3 * ex.cheek) + '" filter="url(#' + a.blur(2.2) + ')"/>'; });
    }
    a.mouthInfo = { M: M, my: my, mw: mw, LB: LB, UT: UT, gap: gap };
    a.add('mouth', s);
  }

  /* ---------------- age, freckles, extras ---------------- */
  function skinMarks(a) {
    var fc = a.fc, pd = a.pd, S = a.S, sk = a.skin, s = '';
    if (a.age > 0.4) {
      // forehead lines
      for (var i = 0; i < 3; i++) {
        var Y = fc.browY - 0.22 - i * 0.11, pts = [];
        for (var k = 0; k <= 6; k++) { var X = lerp(-0.5, 0.5, k / 6) + (i % 2) * 0.05; pts.push(a.on(X, Y + Math.sin(k * 0.9 + i) * 0.012 - a.ex.browIn * 0.05)); }
        s += a.ink(pts, [0.05, 0.75, 0.05], { op: 0.3 * (a.age - 0.3) + a.ex.browIn * 0.15 });
      }
    }
    if (pd.freckles) {
      var fr = pd.freckles === true ? 1 : pd.freckles, seed = 3;
      for (var j = 0; j < 34 * fr; j++) {
        seed = (seed * 9301 + 49297) % 233280; var r1 = seed / 233280; seed = (seed * 9301 + 49297) % 233280; var r2 = seed / 233280;
        var sd = j % 2 ? 1 : -1, Xf = sd * (0.12 + r1 * 0.6), Yf = 0.14 + r2 * 0.32 - Math.abs(Xf) * 0.12;
        var p = a.on(Xf, Yf, 0.02);
        s += '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + f(0.55 + r1 * 0.55) + '" fill="' + rgb(mix(sk.base, [150, 70, 40], 0.55)) + '" opacity="' + fo(0.45 + r2 * 0.35) + '"/>';
      }
    }
    if (pd.stubble) {
      var st = hx(pd.stubble), o = a.outline(), ptsS = [];
      var sd2 = [a.on(-0.86, 0.35), a.on(-0.5, 0.62), a.on(-0.35, 1.0)];
      var jawL = o.L.filter(function (p, i2) { return i2 > o.L.length * 0.5; });
      var jawR = o.R.filter(function (p, i2) { return i2 > o.R.length * 0.5; }).reverse();
      ptsS = [a.on(-0.92, 0.32)].concat(jawL).concat(jawR).concat([a.on(0.95, 0.32), a.on(0.6, 0.62), a.on(0.25, 1.02), a.on(-0.25, 1.02), a.on(-0.6, 0.62)]);
      s += a.el(smooth(ptsS, true), st, { op: 0.28, blur: 2, clip: a.skinClip });
    }
    if (pd.mole) { var m = a.on(pd.mole[0], pd.mole[1], 0.02); s += '<circle cx="' + f(m[0]) + '" cy="' + f(m[1]) + '" r="1.3" fill="' + rgb(mix(sk.deep, [60, 30, 20], 0.5)) + '"/>'; }
    if (pd.doubleChin) {
      var dc = pd.doubleChin, c = fc.chinB;
      var l = a.ext(c - 0.25).l, r = a.ext(c - 0.25).r, b = a.on(0.05, c + 0.18 * dc, -0.1);
      var dcd = [a.on(-0.72, c - 0.38, -0.25), [l[0] - S * 0.04, l[1] + S * 0.18], [b[0] - S * 0.2, b[1]], [b[0] + S * 0.1, b[1] - S * 0.01], [r[0] + S * 0.03, r[1] + S * 0.15], a.on(0.7, c - 0.42, -0.2)];
      a.add('chin2', a.el(smooth(dcd, false) + 'Z', sk.base) + a.el(smooth(dcd, false) + 'Z', sk.shadow, { op: 0.45 }) + a.ink(dcd.slice(1, 5), [0.4, 1.6, 0.6], { op: 0.85 }));
    }
    a.add('marks', s);
  }

  /* ---------------- composition ---------------- */
  var ORDER = [['bg', 0], ['hairBack', 1], ['bodyBack', 0], ['neck', 0], ['body', 0], ['bodyTop', 0], ['chin2', 1], ['head', 1], ['marks', 1], ['ears', 1], ['earAcc', 1], ['eyes', 1], ['brows', 1], ['nose', 1], ['mouth', 1], ['lines', 1], ['beard', 1], ['hairShadow', 1], ['hair', 1], ['hairTop', 1], ['hat', 1], ['glasses', 1], ['acc', 1], ['front', 0], ['fx', 0]];
  function background(a) {
    var pd = a.pd, bg = hx(pd.bg || [90, 84, 76]);
    bg = desat(bg, 0.25);
    var lt = mix(bg, [236, 222, 196], 0.32), dk = mix(mul(bg, 0.45), [20, 16, 24], 0.4);
    var s = '<rect width="240" height="240" fill="' + rgb(mix(bg, dk, 0.25)) + '"/>';
    s += '<rect width="240" height="240" fill="' + a.rad(92, 80, 190, [[0, lt], [0.45, bg], [1, dk]]) + '"/>';
    // soft painterly mottling
    s += '<rect width="240" height="240" fill="' + rgb(dk) + '" filter="url(#tx)" opacity="0.16"/>';
    a.add('bg', s);
  }
  function compose(a) {
    var head = 'rotate(' + f(a.roll * 57.3) + ' ' + f(a.ox) + ' ' + f(a.oy + a.S * (a.fc.chinY + 0.4)) + ')';
    var out = '';
    ORDER.forEach(function (o) {
      var L = a.layers[o[0]]; if (!L || !L.length) return;
      out += o[1] ? '<g transform="' + head + '">' + L.join('') + '</g>' : L.join('');
    });
    var defs = '<filter id="tx" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="' + ((a.pd.seed || 7)) + '"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1.4 -0.5"/></filter>' + a.defs.join('');
    // frame
    var fr = '<rect x="0.75" y="0.75" width="238.5" height="238.5" fill="none" stroke="#1a1412" stroke-width="1.5"/><rect x="2.5" y="2.5" width="235" height="235" fill="none" stroke="#6a5a48" stroke-width="1" opacity="0.6"/>';
    var vig = '<rect width="240" height="240" fill="' + a.rad(120, 110, 175, [[0.55, [0, 0, 0], 0], [1, [10, 6, 8], 0.45]]) + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><defs>' + defs + '</defs>' + out + vig + fr + '</svg>';
  }

  function build(id, expr) {
    var def = BTS.Data.characters[id], pd = def.portrait || {};
    var ex = expression(expr, pd);
    var a = new Rig(def, pd, ex);
    var Lib = BTS.PortraitLib || {};
    background(a);
    neck(a);
    head(a);
    ears(a);
    eyes(a);
    brows(a);
    nose(a);
    mouth(a);
    skinMarks(a);
    if (Lib.dress) Lib.dress(a);
    if (P.debug && P.debug.nohair) ['hair', 'hairTop', 'hairBack', 'hairShadow', 'hat'].forEach(function (k) { a.layers[k] = []; });
    return compose(a);
  }
  P.build = build;
  P.Rig = Rig;

  /* ---------------- public API ---------------- */
  var ALIAS = { jaglika_needle: 'jaglika', jaglika_needle_late: 'jaglika_late', djordje_child: 'djordje_young' };
  function resolve(id) {
    var base = ALIAS[id] || id;
    if (BTS.CharSprites && BTS.CharSprites.variant) base = BTS.CharSprites.variant(base);
    base = ALIAS[base] || base;
    return base;
  }
  function svgUrl(svg) {
    try { return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))); }
    catch (e) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  }
  /* rasterise in the background; the SVG url is a perfectly good stand-in until the PNG is ready */
  function raster(k) {
    if (busy[k] || cache[k] || typeof Image === 'undefined') return;
    busy[k] = 1;
    var img = new Image();
    img.onload = function () {
      try {
        var cv = document.createElement('canvas'); cv.width = cv.height = RES;
        var g = cv.getContext('2d'); g.drawImage(img, 0, 0, RES, RES);
        cache[k] = cv.toDataURL('image/png');
      } catch (e) { cache[k] = svgs[k]; }
      busy[k] = 0;
    };
    img.onerror = function () { busy[k] = 0; cache[k] = svgs[k]; };
    img.src = svgs[k];
  }
  P.svg = function (id, expr) {
    var base = resolve(id), def = BTS.Data.characters[base];
    if (!def || def.portrait === false) return null;
    return build(base, EXPR.indexOf(expr) >= 0 ? expr : 'neutral');
  };
  P.get = function (id, expr) {
    if (!id) return null;
    var base = resolve(id);
    var def = BTS.Data.characters[base];
    if (!def || def.portrait === false) return null;
    expr = EXPR.indexOf(expr) >= 0 ? expr : 'neutral';
    var k = base + ':' + expr;
    if (cache[k]) return cache[k];
    if (!svgs[k]) {
      try { svgs[k] = svgUrl(build(base, expr)); }
      catch (err) { BTS.Log && BTS.Log.warn('portrait failed', base, expr, err && err.message); return null; }
    }
    raster(k);
    return svgs[k];
  };
  /* warm the cache a few portraits at a time while the game is idle */
  P.preload = function (ids) {
    ids = ids || Object.keys(BTS.Data.characters).filter(function (k) { var d = BTS.Data.characters[k]; return d.portrait && d.portrait !== false; });
    var q = []; ids.forEach(function (id) { EXPR.forEach(function (e) { q.push([id, e]); }); });
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(function () { fn({ timeRemaining: function () { return 8; } }); }, 30); };
    (function step(dl) {
      var n = 0;
      while (q.length && (n++ < 1 || (dl && dl.timeRemaining && dl.timeRemaining() > 6))) {
        var it = q.shift(), k = it[0] + ':' + it[1];
        if (cache[k] || svgs[k]) continue;
        try { svgs[k] = svgUrl(build(it[0], it[1])); raster(k); } catch (e) { /* drawn on demand instead */ }
      }
      if (q.length) idle(step);
    })();
  };
  P.clearCache = function () { cache = {}; svgs = {}; busy = {}; };
  /* the dialogue box shows a 240px painting at 120 CSS px: smooth scaling, not nearest-neighbour */
  if (typeof document !== 'undefined') {
    var st = document.createElement('style'); st.textContent = '.dialogue .portrait{image-rendering:auto;background-size:cover}';
    (document.head || document.documentElement).appendChild(st);
    if (window.addEventListener) window.addEventListener('load', function () { setTimeout(function () { try { P.preload(); } catch (e) { /* lazy fallback */ } }, 1500); });
  }
  return P;
})();
