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
    man:    { S: 41, oy: 98, crown: -1.64, skullW: 1.10, temple: 0.05, cheekY: 0.2, cheekW: 1.0, jawY: 0.98, jawW: 0.86, chinY: 1.4, chinW: 0.4, chinB: 1.56, faceZ: 0.9, eyeX: 0.43, eyeW: 0.22, eyeH: 0.085, eyeTilt: 0.0, browY: -0.3, browT: 0.085, noseY: 0.72, noseZ: 0.36, noseW: 0.21, noseTip: 0.09, mouthY: 1.08, mouthW: 0.31, ulip: 0.045, llip: 0.065, neckW: 0.66, earY: -0.12, earH: 0.8, hollow: 0.1 },
    woman:  { S: 42, oy: 98, crown: -1.6, skullW: 1.08, temple: 0.04, cheekY: 0.2, cheekW: 1.0, jawY: 0.94, jawW: 0.82, chinY: 1.3, chinW: 0.36, chinB: 1.45, faceZ: 0.9, eyeX: 0.42, eyeW: 0.235, eyeH: 0.115, eyeTilt: 0.02, browY: -0.32, browT: 0.06, noseY: 0.6, noseZ: 0.26, noseW: 0.17, noseTip: 0.075, mouthY: 0.92, mouthW: 0.29, ulip: 0.055, llip: 0.08, neckW: 0.52, earY: -0.1, earH: 0.72, hollow: 0 },
    boy:    { S: 42, oy: 99, crown: -1.64, skullW: 1.10, temple: 0.03, cheekY: 0.2, cheekW: 1.0, jawY: 0.88, jawW: 0.82, chinY: 1.24, chinW: 0.42, chinB: 1.39, faceZ: 0.88, eyeX: 0.42, eyeW: 0.25, eyeH: 0.125, eyeTilt: 0.0, browY: -0.31, browT: 0.065, noseY: 0.56, noseZ: 0.2, noseW: 0.16, noseTip: 0.07, mouthY: 0.93, mouthW: 0.27, ulip: 0.045, llip: 0.068, neckW: 0.5, earY: -0.1, earH: 0.7, hollow: 0 },
    girl:   { S: 41, oy: 102, crown: -1.72, skullW: 1.12, temple: 0.02, cheekY: 0.24, cheekW: 1.0, jawY: 0.82, jawW: 0.8, chinY: 1.15, chinW: 0.44, chinB: 1.31, faceZ: 0.86, eyeX: 0.41, eyeW: 0.26, eyeH: 0.14, eyeTilt: 0.0, browY: -0.32, browT: 0.05, noseY: 0.5, noseZ: 0.17, noseW: 0.14, noseTip: 0.065, mouthY: 0.8, mouthW: 0.23, ulip: 0.042, llip: 0.062, neckW: 0.44, earY: -0.08, earH: 0.62, hollow: 0 },
    small:  { S: 40, oy: 106, crown: -1.84, skullW: 1.14, temple: 0.0, cheekY: 0.26, cheekW: 1.02, jawY: 0.72, jawW: 0.86, chinY: 1.02, chinW: 0.5, chinB: 1.19, faceZ: 0.86, eyeX: 0.4, eyeW: 0.27, eyeH: 0.155, eyeTilt: 0.0, browY: -0.32, browT: 0.045, noseY: 0.42, noseZ: 0.14, noseW: 0.13, noseTip: 0.065, mouthY: 0.7, mouthW: 0.2, ulip: 0.036, llip: 0.058, neckW: 0.42, earY: -0.06, earH: 0.58, hollow: 0 },
    old:    { S: 42, oy: 98, crown: -1.6, skullW: 1.08, temple: 0.06, cheekY: 0.2, cheekW: 1.0, jawY: 0.96, jawW: 0.82, chinY: 1.34, chinW: 0.36, chinB: 1.49, faceZ: 0.9, eyeX: 0.42, eyeW: 0.225, eyeH: 0.1, eyeTilt: -0.01, browY: -0.31, browT: 0.05, noseY: 0.7, noseZ: 0.32, noseW: 0.19, noseTip: 0.085, mouthY: 1.04, mouthW: 0.28, ulip: 0.04, llip: 0.065, neckW: 0.52, earY: -0.1, earH: 0.8, age: 0.8, hollow: 0.08, jowl: 0.4 },
    oldman: { S: 41, oy: 98, crown: -1.64, skullW: 1.10, temple: 0.06, cheekY: 0.2, cheekW: 1.0, jawY: 1.04, jawW: 0.86, chinY: 1.48, chinW: 0.4, chinB: 1.64, faceZ: 0.9, eyeX: 0.43, eyeW: 0.205, eyeH: 0.08, eyeTilt: -0.01, browY: -0.29, browT: 0.08, noseY: 0.74, noseZ: 0.38, noseW: 0.22, noseTip: 0.1, mouthY: 1.1, mouthW: 0.3, ulip: 0.032, llip: 0.055, neckW: 0.64, earY: -0.14, earH: 0.88, age: 0.8, hollow: 0.18, jowl: 0.4 }
  };
  P.FACES = FACES;

  /* ---------------- expressions ---------------- */
  var EXP = {
    neutral: {},
    sad: { browIn: 0.95, browOut: -0.35, browKnit: 0.3, lid: 0.8, gazeY: 0.6, gazeX: -0.2, curve: -0.75, pout: 0.8, pitch: 0.07, roll: -0.035, lowLid: 0.15, asym: 0.3, shine: 0.7 },
    scared: { browIn: 1.15, browOut: 0.55, browKnit: 0.55, lid: 1.3, lowLid: -0.15, pupil: 0.6, open: 0.62, openTop: 0.38, teeth: 0.7, wide: 1.06, curve: -0.45, stretch: 1, pitch: -0.04, gazeX: -0.35, pale: 0.45, flare: 0.4, asym: 0.25 },
    angry: { browIn: -1.25, browOut: 0.2, browKnit: 1.0, lid: 1.0, lowLid: 0.55, curve: -0.45, press: 1, flare: 1, pitch: 0.07, wide: 0.9, glare: 1, asym: 0.35 },
    smile: { curve: 1.25, open: 0.36, openTop: 0.2, teeth: 1, lowLid: 1.0, lid: 0.8, cheek: 1.2, browIn: 0.05, browOut: -0.05, roll: 0.03, wide: 1.2, asym: 0.12 },
    blank: { lid: 0.86, gazeX: -0.55, gazeY: 0.2, pupil: 0.55, curve: -0.1, browIn: -0.05, browOut: -0.2, open: 0.08, pale: 0.55, stare: 1, yaw: -0.04 },
    worried: { browIn: 0.75, browOut: -0.1, browKnit: 0.55, lid: 1.04, gazeX: 0.6, gazeY: 0.05, curve: -0.3, wave: 1, roll: 0.025, lowLid: 0.12, press: 0.4, asym: 0.4 },
    tired: { lid: 0.6, browIn: 0.3, browOut: -0.3, curve: -0.25, open: 0.06, gazeY: 0.4, pitch: 0.06, roll: -0.045, bags: 0.45, droop: 1 }
  };
  P.EXP = EXP;
  function expression(name, pd) {
    var e = Object.assign({ browIn: 0, browOut: 0, browKnit: 0, lid: 1, lowLid: 0, pout: 0, stretch: 0, glare: 0, asym: 0, droop: 0, shine: 0, gazeX: 0, gazeY: 0, pupil: 1, curve: 0, open: 0, wide: 1, teeth: 0, press: 0, flare: 0, cheek: 0, pitch: 0, roll: 0, wave: 0, pale: 0, bags: 0, stare: 0 }, EXP[name] || {});
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
    a.full = pd.full !== undefined ? pd.full : ({ boy: 0.8, girl: 0.9, small: 1, woman: 0.6, man: 0.45, old: 0.45, oldman: 0.3 }[pd.face] || 0.5);
    fc.full = a.full;
    if (!/old/.test(pd.face)) { fc.chinY -= a.full * 0.05; fc.chinB -= a.full * 0.06; fc.jawY -= a.full * 0.03; }
    a.S = fc.S * 1.16 * (pd.scale || 1);
    a.ox = 116 + (pd.ox || 0); a.oy = fc.oy - 6 + (pd.oy || 0);
    a.yaw = (pd.yaw === undefined ? 0.44 - (pd.full || 0) * 0.08 : pd.yaw) + (ex.yaw || 0);
    if (P.debug && P.debug.yaw !== undefined) a.yaw = P.debug.yaw;
    a.pitch = (pd.pitch || 0) + ex.pitch;
    a.roll = (pd.roll || 0) + ex.roll;
    a.cy = Math.cos(a.yaw); a.sy = Math.sin(a.yaw); a.cp = Math.cos(a.pitch); a.sp = Math.sin(a.pitch);
    a.layers = {}; a.defs = []; a.nid = 0;
    a.n = fc.n || 2.5;
    a.skin = skinTones(hx(pd.skin || def.skin || [227, 180, 143]), pd);
    a.line = rgb(pd.line || mix(mul(a.skin.base, 0.22), [30, 14, 12], 0.7));
  }
  function skinTones(base, pd) {
    base = desat(base, 0.04);
    var sh = mix(mul(base, 0.8), [150, 76, 70], 0.22);
    return {
      base: base,
      light: mix(base, [255, 238, 222], 0.3),
      hi: mix(base, [255, 248, 238], 0.55),
      shadow: sh,
      deep: mix(mul(base, 0.6), [96, 50, 60], 0.25),
      blush: mix(base, [218, 100, 92], 0.5),
      lip: pd.lipCol ? hx(pd.lipCol) : mix(mul(base, 0.84), [176, 82, 84], /man/.test(pd.face) ? 0.24 : pd.face === 'boy' ? 0.32 : 0.42),
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
    var fu = c.full || 0, ad = /small|girl/.test(this.pd.face) ? 0 : this.pd.face === 'boy' ? 0.4 : 1;
    var W = [[cr + 0.18, sw * 0.62], [cr + 0.45, sw * 0.88], [-0.85, sw], [-0.4, sw - c.temple], [c.cheekY, c.cheekW], [mj, lerp(c.cheekW, c.jawW, 0.36) - (c.hollow || 0) * 0.05 + (c.jowl || 0) * 0.01 + fu * 0.07 + 0.02 * ad], [c.jawY, c.jawW + (c.jowl || 0) * 0.04 + fu * 0.012 + 0.03 * ad], [mc, lerp(c.jawW, c.chinW, 0.5) + (c.jowl || 0) * 0.05 + fu * 0.02 + 0.03 * ad], [c.chinY, c.chinW + fu * 0.02 + 0.03 * ad]];
    var Zf = [[cr + 0.18, 0.5], [-0.9, 0.84], [-0.35, 0.9], [0, 0.84], [0.35, 0.88], [c.mouthY, 0.92], [c.chinY, 0.9]];
    this._pf = { W: W, Zf: Zf };
    return this._pf;
  };
  R.sec = function (Y) {
    var c = this.fc, pf = this.profile(), cr = c.crown, sw = c.skullW;
    /* upper skull: an ellipsoid dome; it blends into the face below the temples */
    var Yc = -0.5, Ay = Yc - cr, Zc = -0.5, Az = 1.36;
    if (Y < Yc) {
      var k = Math.sqrt(Math.max(0, 1 - Math.pow((Y - Yc) / Ay, 2)));
      var kw = Math.pow(k, 0.85);
      var fW = catmull(pf.W, Math.max(Y, -0.85)), bl = ss((Y - (Yc - 0.45)) / 0.45);
      var W0 = sw * kw;
      return { W: Math.max(0.001, lerp(W0, Math.min(W0, fW), bl)), zf: Zc + Az * k * (0.98 + 0.04 * k), zb: Zc - Az * 1.0 * k - 0.02 * k };
    }
    if (Y > c.chinY) { var v = clamp((Y - c.chinY) / (c.chinB - c.chinY), 0, 1), e = Math.sqrt(Math.max(0, 1 - v * v)); return { W: Math.max(c.chinW * e, 0.001), zf: c.faceZ - v * v * 0.3, zb: lerp(0.15, 0.55, v) }; }
    var W = catmull(pf.W, Y), zf = Y < 0 ? lerp(Zc + Az, c.faceZ, ss((Y - Yc) / -Yc)) : c.faceZ + (Y > c.mouthY ? -0.03 * (Y - c.mouthY) : 0);
    var zb;
    var y1 = Math.min(0.35, c.jawY - 0.4);
    if (Y < y1) zb = Zc - Az - 0.02;
    else if (Y < c.jawY) zb = lerp(Zc - Az - 0.02, -0.75, Math.pow((Y - y1) / (c.jawY - y1), 0.7));
    else zb = lerp(-0.75, 0.15, ss((Y - c.jawY) / (c.chinY - c.jawY)));
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
      var e = this.ext(Y), bm = this.farBump(Y); Rr.push([e.r[0] + bm * this.S, e.r[1]]); L.push(e.l);
    }
    this._ol = { R: Rr, L: L, all: Rr.concat(L.slice().reverse()) };
    return this._ol;
  };
  /* the far cheek's silhouette: brow ridge, temple dip, cheekbone, hollow under it (3/4 view) */
  R.farBump = function (Y) {
    var c = this.fc, k = Math.min(1, this.yaw / 0.35), hol = (c.hollow || 0) + (this.pd.gaunt || 0) * 0.6;
    function g(m, w) { return Math.exp(-Math.pow((Y - m) / w, 2)); }
    var fu = this.full || 0, t = clamp((Y - c.cheekY) / (c.chinB - c.cheekY), 0, 1), kid = /small|girl|boy/.test(this.pd.face) ? 1 : 0.7;
    var round = (0.03 + fu * 0.01) * kid * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.7) * (1 - Math.max(0, hol - 0.3)) + 0.02 * g(c.chinY, 0.1);
    return k * round + k * (0.035 * g(c.browY + 0.02, 0.1) - 0.03 * g(c.browY - 0.3, 0.14) - 0.035 * g(0.0, 0.08) + (0.045 - fu * 0.02 + hol * 0.03) * g(c.cheekY, 0.13) - Math.max(0, hol - 0.2) * 0.08 * g(c.cheekY + 0.42, 0.16) + (fu * 0.02 + 0.012) * g(c.cheekY + 0.3, 0.22));
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
    if (o.mode) s += ' style="mix-blend-mode:' + o.mode + '"';
    return s + '>' + inner + '</g>';
  };
  /* a tapered ink line */
  R.ink = function (pts, w, o) { o = o || {}; return this.el(taper(pts, w, o.per), o.col || this.line, o); };
  /* the colour that, multiplied over the skin, turns it into the given shadow tone */
  R.mulTint = function (target, base) { base = base || this.skin.base; target = hx(target); return [0, 1, 2].map(function (i) { return clamp(255 * target[i] / Math.max(1, base[i]), 0, 255); }); };
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
    /* F: a point at a fraction of the local half-width, so planes follow the face's contour */
    function F(xf, Y, dz) { var w = a.sec(clamp(Y, fc.crown + 0.05, fc.chinB - 0.01)).W; return a.on(xf * w, Y, dz || 0); }
    function FL(l) { return l.map(function (p) { return F(p[0], p[1]); }); }
    var hol = (fc.hollow || 0) + (a.pd.gaunt || 0) * 0.5, L = o.L, Rr = o.R;
    var shCol = sk.shadow, dpCol = sk.deep;
    // light comes from the upper right, in front of the face: soft fall-off toward the ear side
    var g0 = a.on(-1.0, 0.2), g1 = a.on(0.6, -0.4);
    sh.push(a.el(skinD, a.lin(g0[0], g0[1], g1[0], g1[1], [[0, sk.shadow, 0.35], [0.45, sk.base, 0], [1, sk.light, 0.35]])));
    // 1. the side plane of the head on the ear side: temple, outer socket, under the cheekbone, along the jaw
    var jy = fc.jawY, cy2 = fc.chinY;
    var term = [[-0.66, fc.crown + 0.1], [-0.7, -1.0], [-0.76, -0.55], [-0.8, -0.3], [-0.68, -0.08], [-0.7, 0.08], [-0.8, 0.24], [-0.72 + hol * 0.12 - a.full * 0.06, 0.44], [-0.7 + hol * 0.12 - a.full * 0.06, 0.64], [-0.74 + hol * 0.06 - a.full * 0.04, 0.84], [-0.76 - a.full * 0.04, jy], [-0.66, (jy + cy2) / 2], [-0.5, cy2 - 0.02], [-0.2, fc.chinB - 0.01]];
    term = term.map(function (q) { return [q[0] - a.full * 0.1 * Math.max(0, Math.min(1, (q[1] + 0.3) / 0.6)), q[1]]; });
    var tp = FL(term), far = tp.concat([[tp[tp.length - 1][0] - S * 0.2, tp[tp.length - 1][1] + S * 0.5], [tp[0][0] - S * 3, tp[tp.length - 1][1] + S], [tp[0][0] - S * 3, tp[0][1] - S * 2]]);
    sh.push(a.el(smooth(far, true, 0.75), mix(shCol, sk.blush, 0.18), { op: (0.42 - a.full * 0.1) * (a.pd.shadeK || 1), blur: 2 + a.full * 0.8 }));
    // darker core along the terminator under the cheekbone and the jaw
    var core = FL([[-0.9, 0.32], [-0.74, 0.46], [-0.68, 0.7], [-0.7, jy - 0.05], [-0.56, (jy + cy2) / 2], [-0.46, cy2], [-0.76, cy2], [-0.95, jy], [-0.98, 0.6]]);
    sh.push(a.el(smooth(core, true), dpCol, { op: (0.08 + Math.max(0, hol - 0.15) * 0.4) * (1 - a.full * 0.7), blur: 2.4 }));
    // warm transition (light scattering in skin) along the terminator
    sh.push(a.el(smooth(tp.slice(3, 11), false), 'none', { stroke: sk.blush, sw: S * 0.05, op: 0.28, blur: 1.4 }));
    // 2. far side: the cheek turns away under the cheekbone, and the far jaw
    var fh = FL([[0.94, 0.3], [0.72, 0.42], [0.66 - hol * 0.05, 0.66], [0.7, jy - 0.05], [0.62, (jy + cy2) / 2], [1.2, (jy + cy2) / 2], [1.2, 0.3]]);
    if (hol > 0.15) sh.push(a.el(smooth(fh, true), shCol, { op: (hol - 0.1) * 0.5, blur: 2 }));
    // temples turn away from the front plane
    [-1, 1].forEach(function (sd) { sh.push(a.el(smooth(FL([[sd * 0.95, -0.9], [sd * 0.78, -0.72], [sd * 0.78, -0.3], [sd * 0.98, -0.22]]), true), shCol, { op: sd < 0 ? 0.22 : 0.14, blur: 2.4 })); });
    // gaunt temples
    if (hol > 0.2) [-1, 1].forEach(function (sd) {
      sh.push(a.el(smooth(FL([[sd * 0.92, -0.85], [sd * 0.74, -0.7], [sd * 0.72, -0.32], [sd * 0.95, -0.24]]), true), shCol, { op: 0.4 * hol, blur: 1.4 }));
    });
    // 3. eye sockets: the brow ridge shades the upper lid, deepest at the inner corner
    [-1, 1].forEach(function (sd) {
      var exx = sd * fc.eyeX, w = fc.eyeW * 1.25;
      var pts = a.onL([[exx - sd * w, 0.02], [exx - sd * w * 1.05, -0.14], [exx - sd * w * 0.4, -0.24], [exx + sd * w * 0.5, -0.22], [exx + sd * w * 1.15, -0.08], [exx + sd * w * 0.9, 0.02], [exx + sd * w * 0.2, -0.08], [exx - sd * w * 0.5, -0.06]]);
      sh.push(a.el(smooth(pts, true), shCol, { op: (sd < 0 ? 0.5 : 0.36) + a.age * 0.1 + hol * 0.2 + (a.pd.bags || 0) * 0.1 + ex.glare * 0.2, blur: 1.4 }));
      var ic = a.on(sd * (fc.eyeX - fc.eyeW - 0.05), -0.05);
      sh.push('<ellipse cx="' + f(ic[0]) + '" cy="' + f(ic[1]) + '" rx="' + f(S * 0.06) + '" ry="' + f(S * 0.1) + '" fill="' + rgb(dpCol) + '" opacity="0.4" filter="url(#' + a.blur(1.2) + ')"/>');
      // under-eye fold
      var ue = a.onL([[exx - sd * w * 0.7, 0.13], [exx, 0.19], [exx + sd * w * 0.8, 0.12], [exx + sd * w * 0.6, 0.2], [exx, 0.26], [exx - sd * w * 0.6, 0.2]]);
      sh.push(a.el(smooth(ue, true), shCol, { op: 0.18 + a.age * 0.2 + (a.pd.bags || 0) * 0.3, blur: 1.2 }));
    });
    // 4. cheek warmth
    var bl = a.pd.blush === undefined ? 0.25 : a.pd.blush;
    if (bl > 0) [-1, 1].forEach(function (sd) {
      var c2 = a.on(sd * 0.56, 0.38 - ex.cheek * 0.05);
      sh.push('<ellipse cx="' + f(c2[0]) + '" cy="' + f(c2[1]) + '" rx="' + f(S * (sd > 0 ? 0.2 : 0.26)) + '" ry="' + f(S * 0.15) + '" fill="' + rgb(sk.blush) + '" opacity="' + fo(Math.min(0.7, bl * 0.55)) + '" filter="url(#' + a.blur(3) + ')"/>');
    });
    // 4b. cheek volume: the apple of the cheek catches light, a reflected light lifts the near jaw out of the shadow
    var vol = 0.25 + a.full * 0.35 - hol * 0.3;
    if (vol > 0.05) {
      [[0.5, 0.36, 0.24, 0.17], [-0.48, 0.38, 0.2, 0.16]].forEach(function (q, i) { var c3 = a.on(q[0], q[1] - ex.cheek * 0.08); sh.push('<ellipse cx="' + f(c3[0]) + '" cy="' + f(c3[1]) + '" rx="' + f(S * q[2] * (1 + ex.cheek * 0.15)) + '" ry="' + f(S * q[3]) + '" fill="' + rgb(sk.light) + '" opacity="' + fo((i ? 0.22 : 0.35) * vol + ex.cheek * 0.12) + '" filter="url(#' + a.blur(2.6) + ')"/>'); });
      sh.push(a.el(smooth(FL([[-0.92, 0.62], [-0.8, jy - 0.06], [-0.62, (jy + cy2) / 2], [-0.66, (jy + cy2) / 2 + 0.06], [-0.9, jy + 0.02], [-1.0, 0.66]]), true), mix(sk.base, sk.blush, 0.4), { op: 0.25 * vol, blur: 1.8 }));
    }
    // 5. lit planes: forehead, far cheekbone, chin (crisp-edged, low opacity)
    var lite = sk.hi;
    sh.push(a.el(smooth(FL([[-0.3, -1.25], [0.3, -1.3], [0.6, -0.95], [0.55, -0.5], [0.15, -0.42], [-0.3, -0.5], [-0.45, -0.85]]), true), lite, { op: 0.32, blur: 1.6 }));
    sh.push(a.el(smooth(FL([[0.32, 0.12], [0.62, 0.08], [0.82, 0.2], [0.6, 0.32], [0.38, 0.3]]), true), lite, { op: 0.35, blur: 1.2 }));
    sh.push(a.el(smooth(FL([[-0.38, 0.2], [-0.2, 0.18], [-0.24, 0.3], [-0.44, 0.34]]), true), lite, { op: 0.18, blur: 1.2 }));
    var ch = a.on(0.06, fc.chinY - 0.04);
    sh.push('<ellipse cx="' + f(ch[0]) + '" cy="' + f(ch[1]) + '" rx="' + f(S * fc.chinW * 0.55) + '" ry="' + f(S * 0.07) + '" fill="' + rgb(lite) + '" opacity="0.3" filter="url(#' + a.blur(1.2) + ')"/>');
    // 6. the underside of the jaw turns away
    var jl = [], Y;
    for (Y = jy - 0.15; Y <= fc.chinB; Y += 0.04) jl.push(a.ext(Y).l);
    for (Y = fc.chinB; Y >= jy - 0.15; Y -= 0.04) jl.push(a.ext(Y).r);
    var band = jl.concat(jl.slice().reverse().map(function (p, i, arr) { var u = i / (arr.length - 1); return [p[0] + S * 0.02 * (u - 0.5), p[1] - S * (0.05 + 0.07 * Math.sin(Math.PI * u))]; }));
    sh.push(a.el(smooth(band, true), dpCol, { op: 0.45, blur: 0.9 }));
    s += a.g(sh.join(''), { clip: cp });
    a.add('head', s);
    // contour: heavier on the shadow side and under the jaw
    var lw = a.pd.lineW || 1;
    var Rl = Rr.filter(function (p, i) { return i > Rr.length * 0.36; });
    var Ll = L.filter(function (p, i) { return i > L.length * 0.36; });
    var chinPt = Rr[Rr.length - 1];
    lw *= (1 - a.full * 0.3) * (1 - (a.pd.doubleChin || 0) * 0.35);
    a.add('lines', a.ink(Rl.concat([chinPt]), function (t) { return (1.1 + t * 0.9) * lw; }, { per: 1 }));
    a.add('lines', a.ink(Ll.concat([chinPt]), function (t) { return (1.6 + t * 0.6) * lw; }, { per: 1 }));
    // a hint of the chin's form
    var cz = [a.on(-0.14, fc.chinY + 0.02, 0.02), a.on(0.0, fc.chinY + 0.04, 0.02), a.on(0.12, fc.chinY + 0.01, 0.02)];
    a.add('lines', a.ink(cz, [0.1, 0.8, 0.1], { op: 0.35 }));
  }

  /* ---------------- neck ---------------- */
  function neck(a) {
    var fc = a.fc, S = a.S, sk = a.skin, nw = fc.neckW * (a.pd.neckK || 1) * 1.42 + a.full * 0.04, nwF = fc.neckW * (a.pd.neckK || 1) * (1.26 + a.full * 0.06);
    var y0 = 0.5, yc = fc.chinB - 0.08, y1 = fc.chinB + 0.7 * (a.pd.neckLen || 1);
    var zc = -0.42;
    function cx(Y) { return a.P(0, Y, zc)[0]; }
    var nk = a.pd.napeK || 1, l0 = [cx(y0) - nwF * S * 0.92 * nk, a.P(0, y0 + 0.15, zc)[1]], l1 = [cx(y1) - nwF * S * (1.16 - (1 - nk) * 0.6), a.P(0, y1, zc)[1]];
    var r0 = [cx(yc) + nwF * S * 0.98, a.P(0, yc, zc)[1]], r1 = [cx(y1) + nwF * S * 1.1, a.P(0, y1, zc)[1]];
    var lm = [lerp(l0[0], l1[0], 0.55) + S * 0.03, lerp(l0[1], l1[1], 0.55)], rm = [lerp(r0[0], r1[0], 0.5) - S * 0.02, lerp(r0[1], r1[1], 0.5)];
    var bot = [cx(y1 + 0.3), a.P(0, y1 + 0.3, zc)[1]];
    var d = smooth([K(l0), lm, K(l1), [l1[0] - S * 0.3, l1[1] + S * 0.3], bot, [r1[0] + S * 0.3, r1[1] + S * 0.3], K(r1), rm, K(r0)], true);
    var s = a.el(d, sk.base);
    var cp = a.clip(d);
    var inner = '';
    // the neck turns away from the light on the ear side
    inner += a.el(d, a.lin(l0[0], 0, r0[0], 0, [[0, sk.deep, 0.8], [0.45, sk.shadow, 0.6], [0.8, sk.base, 0], [1, sk.light, 0.3]]));
    // the nape turns away into the shadow under the skull
    inner += a.el(smooth([[l0[0] - S * 0.3, l0[1] - S * 0.5], [l0[0] + S * 0.5, l0[1] - S * 0.2], [l1[0] + S * 0.55, l1[1] + S * 0.1], [l1[0] - S * 0.3, l1[1] + S * 0.3]], true), mix(sk.deep, [60, 36, 40], 0.25), { op: 0.8, blur: 3 });
    // the head's cast shadow on the neck: a crisp shape following the jaw
    var o = a.outline(), jaw = [];
    o.L.forEach(function (p, i) { if (i > o.L.length * 0.5) jaw.push(p); });
    var jr = o.R.filter(function (p, i) { return i > o.R.length * 0.55; }).reverse();
    var shp = jaw.concat(jr).map(function (p, i, arr) { var u = i / (arr.length - 1); return [p[0] - S * 0.08 * (1 - u), p[1] + S * (0.16 + 0.22 * Math.sin(Math.PI * u * 0.8))]; });
    inner += a.el(smooth(shp.concat([[r0[0] + S, r0[1] - S], [l0[0] - S, l0[1] - S]]), true), sk.shadow, { op: 0.9, blur: 0.7 });
    inner += a.el(smooth(shp.slice(0, Math.floor(shp.length * 0.6)).concat([[l0[0] - S, l0[1] - S]]), true), sk.deep, { op: 0.35, blur: 1 });
    // sternocleidomastoid: from behind the ear down to the pit of the neck
    var sA = a.P(-nw * 0.6, 0.65, zc - 0.1), sB = [lerp(r1[0], l1[0], 0.42), r1[1] + S * 0.05];
    inner += a.ink([sA, [lerp(sA[0], sB[0], 0.5) - S * 0.02, lerp(sA[1], sB[1], 0.5)], sB], [0.1, 0.9 + a.age * 0.4, 0.2], { op: 0.22 + a.age * 0.25 });
    inner += a.el(smooth([sA, sB, [sB[0] - S * 0.25, sB[1]], [sA[0] - S * 0.2, sA[1]]], true), sk.shadow, { op: 0.25, blur: 2 });
    if (a.age > 0.4 || (fc.hollow || 0) > 0.2) {
      var tA = [r0[0] - S * 0.2, r0[1] + S * 0.2], tB = [lerp(r1[0], l1[0], 0.25), r1[1]];
      inner += a.ink([tA, tB], [0, 0.9, 0.2], { op: 0.3 * a.age + 0.15 });
      inner += a.ink([[r0[0] - S * 0.08, r0[1] + S * 0.35], [r0[0] - S * 0.02, r0[1] + S * 0.5], [r0[0] - S * 0.1, r0[1] + S * 0.62]], [0.1, 0.8, 0.1], { op: 0.35 * a.age });
    }
    s += a.g(inner, { clip: cp });
    s += a.ink([l0, lm, l1], [1.4, 1.8, 2]);
    s += a.ink([r0, rm, r1], [1.0, 1.3, 1.5]);
    a.neckBase = { l: l1, r: r1, m: [lerp(l1[0], r1[0], 0.5), l1[1]], top: a.P(0, y0, 0) };
    a.add('neck', s);
  }

  /* ---------------- ears ---------------- */
  function ears(a) {
    var fc = a.fc, S = a.S, sk = a.skin;
    if (a.pd.noEars) return;
    // the near ear (screen left) sits on the side of the head, behind the jaw hinge
    var y0 = fc.earY - 0.04, h = fc.earH * 1.02, ez = -0.62;
    var Wt = a.sec(y0 + 0.1).W, Wb = a.sec(y0 + h * 0.8).W;
    var top = a.P(-Wt * 0.98, y0 + 0.05, ez + 0.05), bot = a.P(-Wb * 0.96, y0 + h, ez + 0.12);
    var wv = S * (0.2 + a.yaw * 0.22);
    var hx0 = top[0], hy = top[1], H = bot[1] - top[1];
    function E(u, v) { return [hx0 - wv * u + (bot[0] - top[0]) * v, hy + H * v]; }
    // helix outline: from the front top, over the rim, down the back, round the lobe to the front
    var pts = [E(0.05, 0.02), E(0.45, -0.07), E(0.85, 0.02), E(1.02, 0.25), E(0.95, 0.52), E(0.72, 0.76), E(0.5, 0.95), E(0.28, 1.02), E(0.08, 0.95), E(0.0, 0.78)];
    var d = smooth(pts, false) + 'Z';
    var s = a.el(d, mix(mix(sk.base, sk.shadow, 0.3), sk.blush, 0.3));
    var inner = '';
    // the bowl of the ear (concha) and the antihelix
    inner += a.el(smooth([E(0.18, 0.3), E(0.5, 0.22), E(0.68, 0.42), E(0.55, 0.66), E(0.3, 0.7), E(0.15, 0.55)], true), sk.deep, { op: 0.55, blur: 0.7 });
    inner += a.el(smooth([E(0.82, 0.12), E(0.92, 0.35), E(0.82, 0.6), E(0.72, 0.5), E(0.76, 0.3)], true), sk.light, { op: 0.4, blur: 0.8 });
    s += a.g(inner, { clip: a.clip(d) });
    s += a.ink(pts.concat([E(0.06, 0.6)]), function (t) { return t < 0.1 ? 0.6 : t > 0.85 ? 0.8 : 1.5; }, { per: 3 });
    s += a.ink([E(0.25, 0.12), E(0.65, 0.12), E(0.78, 0.32), E(0.62, 0.62), E(0.42, 0.74)], [0.2, 1.0, 0.3], { op: 0.75 });
    s += a.ink([E(0.2, 0.42), E(0.32, 0.36), E(0.36, 0.5)], [0.2, 0.8, 0.2], { op: 0.6 });
    a.add('ears', s);
    a.ear = { top: top, bot: E(0.3, 1.0), wv: wv, E: E };
  }

  /* ---------------- eyes ---------------- */
  function lidUp(u, open) { var k = Math.pow(Math.max(0, 1 - u * u), 0.72); return -k * (1 + 0.22 * -u) * open; }
  function lidLo(u, h) { var k = Math.pow(Math.max(0, 1 - u * u), 0.95); return k * (1 + 0.18 * u) * h; }
  function eyes(a) {
    var fc = a.fc, ex = a.ex, pd = a.pd, S = a.S, sk = a.skin;
    var irisCol = hx(pd.eyes || [90, 80, 64]);
    if (ex.stare) irisCol = mix(irisCol, [158, 160, 164], 0.45);
    var heavy = pd.heavyLids || 0, lashes = pd.lashes === undefined ? (/woman|girl|old$/.test(pd.face) ? 1 : 0) : pd.lashes;
    var s = '', top = '';
    [-1, 1].forEach(function (sd) {
      var cx = sd * fc.eyeX, cyy = 0, w = fc.eyeW * (pd.eyeK || 1) * 1.1, h = Math.max(fc.eyeH * (pd.eyeHK || 1), 0.094) * 1.1;
      var as = 1 + sd * ex.asym * 0.07;
      var tilt = (fc.eyeTilt || 0);
      var open0 = h * clamp(1 - heavy * 0.12 - a.age * 0.05, 0.12, 1.5), open = h * clamp(ex.lid * as - heavy * 0.12 - a.age * 0.05 - ex.droop * 0.05, 0.12, 1.5);
      var lowH = h * (0.62 - ex.lowLid * 0.3 + a.age * 0.06) * (1 - ex.cheek * 0.12);
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
      var scl = mix([242, 236, 228], sk.base, 0.12);
      if (ex.pale) scl = mix(scl, [230, 230, 230], 0.3);
      var e = a.el(od, scl);
      // iris: a disc on the eyeball, foreshortened by the projection
      var gx = ex.gazeX * 0.55 + (pd.lookX || 0), gy = ex.gazeY * 0.5 + (pd.lookY || 0);
      var ir = (pd.irisR || 0.45) * w, icx = cx + w * gx * 0.55 + (sd < 0 ? 0.012 : -0.018), icy = cyy - open0 + ir * 0.74 + h * gy * 0.5 - tilt * 0.5;
      var ipts = [];
      for (var k = 0; k < 24; k++) { var t = k / 24 * Math.PI * 2; ipts.push(a.on(icx + Math.cos(t) * ir, icy + Math.sin(t) * ir * 1.02, 0.07)); }
      var id = smooth(ipts, true);
      var ic = a.on(icx, icy, 0.07), irPx = ir * S * (sd > 0 ? a.cy * 0.9 + 0.1 : 1);
      var irisFill = a.rad(ic[0] - irPx * 0.15, ic[1] + irPx * 0.25, irPx * 1.15, [[0, mix(irisCol, [255, 245, 220], 0.28)], [0.55, irisCol], [0.9, mul(irisCol, 0.55)], [1, mul(irisCol, 0.4)]]);
      e += a.el(id, irisFill);
      e += a.el(id, 'none', { stroke: mix(mul(irisCol, 0.3), [20, 16, 20], 0.5), sw: 1.3 });
      var pr = ir * 0.42 * ex.pupil * (pd.pupil || 1);
      var pp = []; for (k = 0; k < 16; k++) { t = k / 16 * Math.PI * 2; pp.push(a.on(icx + Math.cos(t) * pr, icy + Math.sin(t) * pr, 0.075)); }
      e += a.el(smooth(pp, true), mix(mul(irisCol, 0.2), [10, 8, 10], 0.7));
      // shadow of the upper lid and lashes across the eyeball
      var lidSh = U.concat(offset(U.slice().reverse(), 0, S * (0.05 + h * 0.9)));
      e += a.el(smooth(lidSh, true), mix(sk.shadow, [60, 40, 50], 0.3), { op: 0.65, blur: 1.4 });
      // catchlights (light from upper left)
      if (!ex.stare) {
        var cl1 = a.on(icx + ir * 0.3, icy - ir * 0.4, 0.09), cl2 = a.on(icx - ir * 0.4, icy + ir * 0.35, 0.09);
        e += '<ellipse cx="' + f(cl1[0]) + '" cy="' + f(cl1[1]) + '" rx="' + f(Math.max(1.1, irPx * 0.28)) + '" ry="' + f(Math.max(1, irPx * 0.24)) + '" fill="#fbf8f2"/>';
        e += '<circle cx="' + f(cl2[0]) + '" cy="' + f(cl2[1]) + '" r="' + f(Math.max(0.5, irPx * 0.11)) + '" fill="#fbf8f2" opacity="0.8"/>';
      } else {
        var cl3 = a.on(icx + ir * 0.3, icy - ir * 0.3, 0.09);
        e += '<circle cx="' + f(cl3[0]) + '" cy="' + f(cl3[1]) + '" r="' + f(Math.max(0.6, irPx * 0.13)) + '" fill="#e8e4dc" opacity="0.55"/>';
      }
      s += a.g(e, { clip: ocp });
      // upper lid (skin above the line), crease, lower lid
      var hood = heavy + ex.droop * 0.4 + a.age * 0.2;
      var creaseH = h * (0.62 + hood * 0.08) + (1 - Math.min(1, ex.lid)) * h * 0.25;
      var C1 = [];
      for (i = 1; i < N; i++) { u = -1 + 2 * i / N; var tl2 = -tilt * (u + 1) * 0.5; C1.push(a.on(cx + sd * u * w * 1.06, cyy + tl2 + lidUp(u, open) - creaseH * Math.pow(1 - u * u, 0.4) * (1 + heavy * 0.35 * Math.max(0, u)), 0.04)); }
      // lid fold tone
      var fold = U.slice(1, N).concat(C1.slice().reverse());
      top += a.el(smooth(fold, true), sk.shadow, { op: 0.3 + hood * 0.2, blur: 1.0 });
      // the skin of the lid just above the lash line catches light
      top += a.ink(U.slice(2, N - 1).map(function (p) { return [p[0], p[1] - S * 0.025]; }), [0.2, 1.2, 0.2], { col: rgb(sk.light), op: 0.35 });
      // upper lash line: heavy, thickest toward the outer corner
      var lw = (pd.lidW || 1) * (lashes ? 1.15 : 1);
      top += a.ink(U, function (t) { return (t < 0.15 ? lerp(0.8, 1.9, t / 0.15) : t > 0.82 ? lerp(2.9, 1.5, (t - 0.82) / 0.18) : lerp(1.9, 2.9, (t - 0.15) / 0.67)) * lw; }, { per: 2, col: rgb(mix([20, 12, 12], sk.line, 0.3)) });
      if (lashes) {
        for (var q = 0; q < 3; q++) {
          var uu = 0.55 + q * 0.2, base = a.on(cx + sd * uu * w, cyy - tilt * (uu + 1) * 0.5 + lidUp(uu, open), 0.05);
          var tip = [base[0] + sd * S * (0.04 + q * 0.025), base[1] - S * (0.05 - q * 0.008)];
          top += a.ink([base, [lerp(base[0], tip[0], 0.6), lerp(base[1], tip[1], 0.4)], tip], [1.1, 0.8, 0.1], { col: '#1c1212' });
        }
      }
      top += a.ink(C1, [0.1, (0.9 + heavy * 0.4) * (pd.creaseK || 1), 0.3], { op: Math.min(1, 0.75 * (pd.creaseK || 1)) });
      if (a.age > 0.5) top += a.ink(C1.map(function (p) { return [p[0], p[1] - S * 0.035]; }).slice(Math.floor(N * 0.4)), [0.1, 0.6, 0.1], { op: 0.35 + a.age * 0.2 });
      // lower lid line, softer
      top += a.ink(Lo, function (t) { return t < 0.1 ? 0.3 : t > 0.85 ? 1.1 : lerp(0.5, 1.1, t); }, { per: 2, op: 0.55 });
      // tear line / lower lid rim
      var rim = Lo.slice(1, N).map(function (p) { return [p[0], p[1] + 0.7]; });
      top += a.el(smooth(rim, false), 'none', { stroke: ex.shine ? [250, 246, 240] : sk.light, sw: 0.7 + ex.shine * 0.5, op: 0.5 + ex.shine * 0.35 });
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
        var oc = a.on(cx + sd * w * 1.12, cyy + 0.0, 0.0), n3 = a.age > 0.3 || ex.cheek > 1 ? 3 : 1;
        for (q = 0; q < n3; q++) {
          var ang = (-0.35 + q * 0.38) , len = S * (0.1 + a.age * 0.06);
          var p1 = [oc[0] + sd * S * 0.02, oc[1] + q * S * 0.03 - S * 0.02], p2 = [p1[0] + sd * Math.cos(ang) * len * (sd > 0 ? 0.6 : 1), p1[1] + Math.sin(ang) * len];
          top += a.ink([p1, [lerp(p1[0], p2[0], 0.5), lerp(p1[1], p2[1], 0.5) - 0.5], p2], [0.15, 0.85, 0.05], { op: 0.45 * Math.max(a.age, ex.cheek * 0.55) });
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
    var thick = fc.browT * 1.22 * Math.pow(pd.browThick || 1, 0.8), s = '';
    [-1, 1].forEach(function (sd) {
      var inX = sd * (fc.eyeX - fc.eyeW * 1.05), outX = sd * (fc.eyeX + fc.eyeW * 1.35);
      var by = fc.browY + 0.03;
      var ak = 1 + sd * ex.asym * 0.18, raiseIn = ex.browIn * 0.11 * ak, raiseOut = ex.browOut * 0.08 * ak, knit = ex.browKnit * 0.045;
      var arch = pd.browStraight ? 0.015 : (pd.browArch === undefined ? 0.04 : pd.browArch);
      var pts = [];
      for (var i = 0; i <= 8; i++) {
        var t = i / 8, X = lerp(inX + sd * knit, outX, t);
        var Y = by - lerp(raiseIn, raiseOut, ss(t)) - arch * Math.sin(Math.PI * Math.min(1, t * 1.25)) * 1 + t * t * 0.05 * (pd.browStraight ? 0.3 : 1) - (pd.browY || 0);
        if (ex.browIn < 0) Y -= ex.browIn * 0.05 * (1 - t) * (1 - t) * 0;
        pts.push(a.on(X, Y, 0.02));
      }
      var wf = function (t) { return S * thick * (t < 0.12 ? lerp(0.75, 1.0, t / 0.12) : lerp(1.0, 0.25, Math.pow((t - 0.12) / 0.88, 1.3))) * (sd > 0 ? 0.9 : 1); };
      // soft feathered underlay, then the denser body of the brow
      s += a.el(taper(pts, function (t) { return wf(t) * 1.35; }, 2), mix(bc, sk.shadow, 0.35), { op: 0.45, blur: 0.9 });
      s += a.el(taper(pts, wf, 2), bc, { op: 0.9 });
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
    function ridgeZ(t) { return nz * (Math.pow(t, 1.3) + bump * 0.2 * Math.sin(Math.PI * t * 0.9)); }
    function rp(t, x, dz) { var Y = lerp(-0.1, ny - tipR * 0.4, t); return a.P(x || 0, Y, a.depth(0, Y) + ridgeZ(t) + (dz || 0)); }
    var s = '', base = a.depth(0, ny);
    var tip = a.P(0.01, ny - tipR * 0.3, base + nz);
    var nl = rgb(mix(sk.line, sk.deep, 0.25));
    // shadow on the near side plane of the nose (light from the upper right)
    var side = [];
    for (var i = 0; i <= 8; i++) side.push(rp(i / 8, -0.04 - 0.05 * i / 8, 0));
    var sp = [a.on(-0.13, -0.1, 0)].concat(side).concat([[tip[0] - S * 0.04, tip[1] + S * 0.05], a.on(-nw * 0.7, ny + 0.05, 0.06), a.on(-nw * 1.05, ny - 0.02, 0.04), a.on(-nw * 0.95, ny - 0.22, 0.01), a.on(-0.2, 0.1, 0)]);
    s += a.el(smooth(sp, true, 0.8), sk.shadow, { op: 0.7, blur: 0.8 });
    // the under-plane of the nose and its cast shadow on the upper lip (down and to the left)
    var u0 = a.on(-nw * 1.15, ny + 0.03, 0.03), u1 = a.on(nw * 0.7, ny + 0.05, 0.03), u2 = a.on(nw * 0.2, ny + 0.17, 0), u3 = a.on(-nw * 0.9, ny + 0.16, 0);
    s += a.el(smooth([u0, u1, u2, u3], true), sk.deep, { op: 0.5, blur: 1 });
    // light on the bridge and the tip (the side facing the light)
    var hl = []; for (i = 1; i <= 7; i++) hl.push(rp(i / 8, 0.035, 0.0));
    s += a.ink(hl, [0.2, 1.8, 0.5], { col: rgb(sk.hi), op: 0.55 });
    s += '<ellipse cx="' + f(tip[0]) + '" cy="' + f(tip[1] + S * 0.01) + '" rx="' + f(S * (tipR + nw * 0.4)) + '" ry="' + f(S * tipR * 0.9) + '" fill="' + rgb(sk.blush) + '" opacity="0.3" filter="url(#' + a.blur(1.4) + ')"/>';
    s += '<ellipse cx="' + f(tip[0] + S * 0.02) + '" cy="' + f(tip[1] - S * 0.025) + '" rx="' + f(S * tipR * 0.5) + '" ry="' + f(S * tipR * 0.36) + '" fill="' + rgb(sk.hi) + '" opacity="0.7" filter="url(#' + a.blur(0.6) + ')"/>';
    // nostrils
    var nCol = rgb(mix(sk.deep, [50, 20, 22], 0.55));
    [-1, 1].forEach(function (sd) {
      var c = a.on(sd * nw * 0.48, ny + 0.03, 0.08 + (sd < 0 ? 0.02 : 0));
      var rx = S * nw * 0.32 * (sd > 0 ? a.cy * 0.7 : 1) * (1 + ex.flare * 0.2), ry = S * 0.024 * (1 + ex.flare * 0.3);
      s += '<ellipse cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" transform="rotate(' + (sd * 12) + ' ' + f(c[0]) + ' ' + f(c[1]) + ')" fill="' + nCol + '" opacity="0.9"/>';
    });
    // ink: the ridge seen against the far cheek, the tip's underside, the wings
    var rl = []; for (i = 4; i <= 8; i++) rl.push(rp(i / 8, 0.06, -0.01));
    rl.push([tip[0] + S * 0.04, tip[1] + S * 0.04]);
    s += a.ink(rl, [0.1, 0.9, 1.1], { col: nl, op: 0.45 + bump * 0.35 });
    var under = [a.on(-nw * 0.45, ny + 0.065, 0.09), [tip[0] - S * 0.01, tip[1] + S * tipR * 1.1], a.on(nw * 0.5, ny + 0.06, 0.09)];
    s += a.ink(under, [0.3, 1.2, 0.3], { col: nl, op: 0.75 });
    var wl = [a.on(-nw * 0.75, ny - 0.15, 0.03), a.on(-nw * 1.1, ny - 0.05, 0.04), a.on(-nw * 1.02, ny + 0.04, 0.05), a.on(-nw * 0.6, ny + 0.07, 0.07)];
    s += a.ink(wl, [0.2, 1.4, 0.5], { col: nl, op: 0.85 });
    var wr = [a.on(nw * 0.85, ny - 0.08, 0.03), a.on(nw * 1.0, ny + 0.01, 0.05), a.on(nw * 0.68, ny + 0.065, 0.07)];
    s += a.ink(wr, [0.2, 1.1, 0.4], { col: nl, op: 0.7 });
    // the near side of the bridge where it meets the eye socket
    var bl = [a.on(-0.1, -0.12, 0.02), a.on(-0.12, 0.12, 0.03), rp(0.55, -0.1, 0)];
    s += a.ink(bl, [0.1, 0.7, 0.1], { col: nl, op: 0.3 });
    a.add('nose', s);
    a.noseInfo = { tip: tip, ny: ny, nw: nw };
  }

  /* ---------------- mouth ---------------- */
  function mouth(a) {
    var fc = a.fc, ex = a.ex, pd = a.pd, S = a.S, sk = a.skin;
    var my = fc.mouthY, mw = fc.mouthW * 1.12 * (pd.mouthK || 1) * ex.wide, ul = fc.ulip * 1.75 * (pd.lipK || 1), ll = fc.llip * 1.55 * (pd.lipK || 1);
    var curve = clamp(ex.curve + (pd.mouthCurve || 0), -1.4, 1.4), open = clamp(ex.open, 0, 1), press = ex.press;
    if (press) { ul *= 0.6; ll *= 0.65; }
    if (curve > 0.3) { ul *= 1 - curve * 0.3; ll *= 1 - curve * 0.2; }
    if (open > 0.3) { ul *= 0.8; ll *= 0.8; }
    var cornerLift = curve * 0.1, wave = ex.wave, asy = ex.asym * (curve > 0 ? 0.35 : 0.2);
    if (ex.pout) { ll *= 1 + ex.pout * 0.2; }
    var N = 12, M = [], UT = [], LB = [], UI = [], LI = [];
    function mY(u) {
      var c = -cornerLift * (1 + asy * (u > 0 ? 1 : -1)) * Math.pow(Math.abs(u), 2.2) + (curve > 0 ? curve * 0.03 * (1 - u * u) : 0) - ex.pout * 0.018 * (1 - u * u) + ex.stretch * 0.02 * Math.pow(Math.abs(u), 3);
      c += wave * 0.012 * Math.sin(u * Math.PI * 2);
      return my + c;
    }
    var gap = open * 0.3 * (1 + Math.max(0, curve) * 0.15), gT = ex.openTop === undefined ? 0.4 : ex.openTop, gB = 1 - gT, kx = ex.openRound ? 0.42 : 0.6;
    for (var i = 0; i <= N; i++) {
      var u = -1 + 2 * i / N, X = u * mw, Y = mY(u), k = Math.pow(1 - u * u, kx);
      var bow = 1 - 0.35 * Math.exp(-u * u / 0.012) + 0.12 * Math.exp(-Math.pow(Math.abs(u) - 0.28, 2) / 0.02);
      var kl = Math.pow(1 - u * u, 0.6);
      UT.push(a.on(X * 1.0, Y - gap * gT * k - ul * kl * bow - 0.005, 0.07 * kl));
      UI.push(a.on(X * 0.98, Y - gap * gT * k, 0.07 * kl));
      LI.push(a.on(X * 0.98, Y + gap * gB * k, 0.07 * kl));
      LB.push(a.on(X * 0.96, Y + gap * gB * k + ll * Math.pow(1 - u * u, 0.75) * (1 - open * 0.25), 0.07 * kl));
      M.push(a.on(X, Y, 0.07 * k));
    }
    var s = '';
    var lip = ex.pale ? mix(sk.lip, sk.base, 0.45) : sk.lip;
    var lipU = mix(lip, sk.deep, 0.42), lipL = mix(lip, sk.light, 0.05);
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
        var tt = UI.map(function (p) { return [p[0], p[1] + S * 0.07 * (ex.teeth || 0.6)]; });
        var td = smooth(UI.concat(tt.slice().reverse()), true);
        inner += a.el(td, '#e8e0d4') + a.el(td, mix(sk.shadow, [200, 190, 180], 0.5), { op: 0.0 });
        inner += a.el(smooth(UI.concat(offset(UI.slice().reverse(), 0, S * 0.016)), true), '#9a8a80', { op: 0.5, blur: 0.6 });
      }
      if (open > 0.2) { var tg = a.on(0.05, my + gap * 0.5, 0.05); inner += '<ellipse cx="' + f(tg[0]) + '" cy="' + f(tg[1]) + '" rx="' + f(S * mw * 0.55) + '" ry="' + f(S * gap * 0.35) + '" fill="#8a3a3c"/>'; }
      s += a.g(inner, { clip: mcp });
    }
    s += a.el(upD, lipU) + a.el(loD, lipL);
    // the upper lip's border and the cupid's bow catch a little line
    s += a.ink(UT.slice(1, N), function (t) { return 0.3 + 0.6 * Math.sin(Math.PI * t); }, { col: rgb(mix(lip, sk.deep, 0.7)), op: 0.5 });
    s += a.g(a.el(loD, a.lin(LI[0][0], LI[0][1], LB[N >> 1][0], LB[N >> 1][1] + S * 0.04, [[0, mix(lip, sk.deep, 0.3), 0.6], [0.5, lipL, 0], [1, lipL, 0]])), {});
    // lower lip highlight
    var lh = a.on(mw * 0.2, my + gap * 0.6 + ll * 0.45, 0.09);
    s += '<ellipse cx="' + f(lh[0]) + '" cy="' + f(lh[1]) + '" rx="' + f(S * mw * 0.35) + '" ry="' + f(S * ll * 0.22) + '" fill="' + rgb(mix(lipL, [255, 240, 230], 0.45)) + '" opacity="0.65" filter="url(#' + a.blur(0.8) + ')"/>';
    // philtrum and the light ridge of the upper lip
    var ph = a.on(0.01, my - ul - 0.07, 0.06), ph2 = a.on(0.02, fc.noseY + 0.1, 0.04);
    s += a.ink([ph2, ph], [0.6, 1.4 * (pd.philtrum || 1), 0.8], { col: rgb(sk.shadow), op: Math.min(0.9, 0.45 * (pd.philtrum || 1)) });
    if (pd.philtrum > 1) [-1, 1].forEach(function (sd) { s += a.ink([a.on(sd * 0.05, fc.noseY + 0.12, 0.04), a.on(sd * 0.07, my - ul - 0.04, 0.06)], [0.2, 0.7, 0.3], { col: rgb(sk.shadow), op: 0.35 }); });
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
    [0, N].forEach(function (i2) { var p = M[i2], sd = i2 ? 1 : -1, c4 = [p[0] + sd * S * 0.03, p[1] - S * 0.01 * curve]; s += '<ellipse cx="' + f(c4[0]) + '" cy="' + f(c4[1]) + '" rx="' + f(S * 0.045) + '" ry="' + f(S * 0.06) + '" fill="' + rgb(sk.shadow) + '" opacity="' + fo(0.35 + Math.abs(curve) * 0.15 + press * 0.15) + '" filter="url(#' + a.blur(1.2) + ')"/>'; });
    // lip outline: soft lower contour
    s += a.ink(LB.slice(3, N - 2), [0.1, 0.7, 0.1], { op: 0.35 });
    // smile folds / age folds
    var age = a.age, nl = Math.max(age * 0.8, ex.cheek * (0.3 + age * 0.4), (pd.folds || 0));
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
    if (ex.pout > 0.2 || ex.press > 0.5) {
      // the chin muscle bunches: a dimpled, lit boss and a crease under the lower lip
      var cb = a.on(0.03, fc.chinY - 0.08, 0.04), k3 = Math.max(ex.pout, ex.press * 0.6);
      s += '<ellipse cx="' + f(cb[0]) + '" cy="' + f(cb[1]) + '" rx="' + f(S * 0.17) + '" ry="' + f(S * 0.1) + '" fill="' + rgb(sk.light) + '" opacity="' + fo(0.35 * k3) + '" filter="url(#' + a.blur(1.4) + ')"/>';
      s += a.ink([a.on(-0.14, my + ll + 0.1, 0.06), a.on(0.02, my + ll + 0.13, 0.07), a.on(0.16, my + ll + 0.1, 0.06)], [0.1, 0.9, 0.1], { op: 0.35 * k3 });
    }
    if (ex.cheek > 0.2) {
      // smiling cheeks bunch up
      [-1, 1].forEach(function (sd) { var c = a.on(sd * 0.5, 0.36, 0.03); s += '<ellipse cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" rx="' + f(S * 0.2) + '" ry="' + f(S * 0.12) + '" fill="' + rgb(sk.hi) + '" opacity="' + fo(0.3 * ex.cheek) + '" filter="url(#' + a.blur(2.2) + ')"/>';
        s += a.el(smooth([a.on(sd * 0.28, 0.5, 0.02), a.on(sd * 0.5, 0.56, 0.02), a.on(sd * 0.74, 0.48, 0.02), a.on(sd * 0.5, 0.62, 0.02)], true), sk.shadow, { op: 0.3 * ex.cheek, blur: 1.6 }); });
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
      ptsS = [a.on(-0.94, 0.4)].concat(jawL).concat(jawR).concat([a.on(0.95, 0.42), a.on(0.62, 0.72), a.on(0.25, fc.mouthY + 0.12), a.on(-0.25, fc.mouthY + 0.12), a.on(-0.66, 0.74)]);
      s += a.g(a.el(smooth(ptsS, true), st, { op: 0.26, blur: 5 }), { clip: a.skinClip });
    }
    if (pd.mole) { var m = a.on(pd.mole[0], pd.mole[1], 0.02); s += '<circle cx="' + f(m[0]) + '" cy="' + f(m[1]) + '" r="1.3" fill="' + rgb(mix(sk.deep, [60, 30, 20], 0.5)) + '"/>'; }
    if (pd.doubleChin) {
      var dc = pd.doubleChin, jaw = [], low = [], Yj;
      for (Yj = fc.jawY + 0.12; Yj <= fc.chinB; Yj += 0.05) jaw.push(a.ext(Yj).l);
      for (Yj = fc.chinB; Yj >= fc.jawY + 0.2; Yj -= 0.05) jaw.push(a.ext(Yj).r);
      var n2 = jaw.length;
      jaw.forEach(function (p, i) { var u = i / (n2 - 1), k = Math.sin(Math.PI * Math.min(1, u * 1.1)); low.push([p[0] + S * 0.05 * (u - 0.4), p[1] + S * (0.03 + 0.16 * dc * k)]); });
      var dcd = smooth(jaw.concat(low.slice().reverse()), true);
      var lowD = low.slice(Math.floor(n2 * 0.3), Math.floor(n2 * 0.85));
      a.add('chin2', a.el(dcd, sk.base) + a.g(a.el(dcd, sk.shadow, { op: 0.55 }) + a.el(smooth(low.concat(jaw.slice().reverse().map(function (p) { return [p[0], p[1] + S * 0.12]; })), true), sk.deep, { op: 0.4, blur: 1 }), { clip: a.clip(dcd) }) + a.ink(lowD, [0.1, 1.1, 0.1], { op: 0.5 }));
    }
    a.add('marks', s);
  }

  /* ---------------- composition ---------------- */
  var ORDER = [['bg', 0], ['hairBack', 1], ['bodyBack', 0], ['neck', 0], ['body', 0], ['bodyTop', 0], ['hairMid', 1], ['chin2', 1], ['head', 1], ['marks', 1], ['ears', 1], ['earAcc', 1], ['eyes', 1], ['brows', 1], ['nose', 1], ['mouth', 1], ['lines', 1], ['beard', 1], ['hairShadow', 1], ['hair', 1], ['hairTop', 1], ['hat', 1], ['glasses', 1], ['acc', 1], ['front', 0], ['fx', 0]];
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
    if (pd.look) pd = Object.assign({}, pd, pd.look, { f: Object.assign({}, pd.f, pd.look.f) });
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
    if (P.debug && P.debug.grid) {
      var gs = '';
      for (var gy = -1.75; gy <= 1.6; gy += 0.25) for (var gx = -1; gx <= 1.01; gx += 0.25) { var gp = a.on(gx, gy, 0); gs += '<circle cx="' + f(gp[0]) + '" cy="' + f(gp[1]) + '" r="0.8" fill="' + (Math.abs(gx) < 0.01 || Math.abs(gy) < 0.01 ? '#f00' : '#0f0') + '"/>'; }
      for (var ga = 0; ga < 360; ga += 30) { var rp = a.rim(ga, 0); gs += '<circle cx="' + f(rp[0]) + '" cy="' + f(rp[1]) + '" r="1.2" fill="#00f"/><text x="' + f(rp[0]) + '" y="' + f(rp[1]) + '" font-size="5" fill="#ff0">' + ga + '</text>'; }
      a.add('fx', gs);
    }
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
        cv.width = cv.height = 0;   // free the backing store now (iOS counts live canvas memory)
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
    if (!def || !def.portrait) return null;
    if (def.portrait.image) return def.portrait.image;   // hand-supplied portrait (client reference), same for every expression
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
