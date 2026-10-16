/* Dialogue portraits: a small 2.5D "paint engine". Every character is built from 3D primitives (ellipsoids)
   in a 3/4 view, rendered into a height field, lit from the upper left with soft cel shading
   (4-6 hue-shifted tones per material, cast shadows, cavity occlusion, selective outlines) and then
   detailed by hand-written feature painters that work in the head's own surface coordinates
   (eyes with lids and irises, brows, nose, lips, wrinkles, freckles...). Painted at 120x120, shown at 120 CSS px.
   The cast (hair styles, hats, outfits, accessories) lives in portraits_hero.js; appearance data in data/characters.js. */
'use strict';
BTS.Portraits = (function () {
  var C = BTS.Col, P = {}, cache = {};
  var EXPR = ['neutral', 'sad', 'scared', 'angry', 'smile', 'blank', 'worried', 'tired'];
  P.EXPR = EXPR;
  var S = 120; P.SIZE = S;
  var NONE = -1e9;
  var LIGHT = nrm([-0.6, -0.55, 0.58]);
  var HALF = nrm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  /* ---------------- maths ---------------- */
  function nrm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(a, b) { var n = Math.sin(a * 127.1 + b * 311.7 + 0.5) * 43758.5453; return n - Math.floor(n); }
  function vnoise(x, y, sd) {
    var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    var a = hash(ix + sd * 17, iy), b = hash(ix + 1 + sd * 17, iy), c = hash(ix + sd * 17, iy + 1), d = hash(ix + 1 + sd * 17, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function smax(a, b, k) {
    if (a <= NONE) return b; if (b <= NONE) return a;
    var h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.max(a, b) + h * h * k * 0.25;
  }
  function g2(dx, dy) { var r = dx * dx + dy * dy; return r > 9 ? 0 : Math.exp(-r); }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, s], [0, -s, c]]; }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; }
  function mm(a, b) { var r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]; return r; }
  function rot(yaw, pitch, roll) { return mm(rotY(yaw || 0), mm(rotX(pitch || 0), rotZ(roll || 0))); }
  function col(c) { return [clamp(Math.round(c[0]), 0, 255), clamp(Math.round(c[1]), 0, 255), clamp(Math.round(c[2]), 0, 255)]; }

  /* A frame: local units (head half-width = 1) -> world pixels. Local X right (character's left), Y down, Z forward. */
  function Frame(o) {
    var R = rot(o.yaw, o.pitch, o.roll), s = o.s, c = [o.x, o.y, o.z || 0];
    return {
      R: R, s: s, c: c,
      w: function (X, Y, Z) { return [c[0] + s * (R[0][0] * X + R[0][1] * Y + R[0][2] * Z), c[1] + s * (R[1][0] * X + R[1][1] * Y + R[1][2] * Z), c[2] + s * (R[2][0] * X + R[2][1] * Y + R[2][2] * Z)]; },
      l: function (x, y, z) { var dx = (x - c[0]) / s, dy = (y - c[1]) / s, dz = (z - c[2]) / s; return [R[0][0] * dx + R[1][0] * dy + R[2][0] * dz, R[0][1] * dx + R[1][1] * dy + R[2][1] * dz, R[0][2] * dx + R[1][2] * dy + R[2][2] * dz]; }
    };
  }
  /* ellipsoid primitive {c:[X,Y,Z], r:[a,b,c], rot:[yaw,pitch,roll], clip:fn(X,Y,Z)} compiled for a frame */
  function E(c, r, o) { o = o || {}; return { c: c, r: r, rot: o.rot, clip: o.clip }; }
  function compile(F, e) {
    var A = e.rot ? mm(F.R, rot(e.rot[0], e.rot[1], e.rot[2])) : F.R;
    var w = F.w(e.c[0], e.c[1], e.c[2]);
    var d = [1 / Math.pow(F.s * e.r[0], 2), 1 / Math.pow(F.s * e.r[1], 2), 1 / Math.pow(F.s * e.r[2], 2)];
    function m(i, j) { return A[i][0] * d[0] * A[j][0] + A[i][1] * d[1] * A[j][1] + A[i][2] * d[2] * A[j][2]; }
    var mr = Math.max(e.r[0], e.r[1], e.r[2]) * F.s + 1;
    return { cx: w[0], cy: w[1], cz: w[2], m00: m(0, 0), m01: m(0, 1), m02: m(0, 2), m11: m(1, 1), m12: m(1, 2), m22: m(2, 2),
      x0: Math.floor(w[0] - mr), x1: Math.ceil(w[0] + mr), y0: Math.floor(w[1] - mr), y1: Math.ceil(w[1] + mr), clip: e.clip, F: F };
  }
  function hit(p, x, y) {
    if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) return NONE;
    var dx = x + 0.5 - p.cx, dy = y + 0.5 - p.cy;
    var a = p.m22, b = 2 * (p.m02 * dx + p.m12 * dy), c = p.m00 * dx * dx + 2 * p.m01 * dx * dy + p.m11 * dy * dy - 1;
    var disc = b * b - 4 * a * c; if (disc < 0) return NONE;
    var z = p.cz + (-b + Math.sqrt(disc)) / (2 * a);
    if (p.clip) { var l = p.F.l(x + 0.5, y + 0.5, z); if (!p.clip(l[0], l[1], l[2])) return NONE; }
    return z;
  }

  /* ---------------- materials ---------------- */
  /* hue-shifted ramp: shadows drift toward a cool violet, lights toward warm cream */
  function ramp(base, n, o) {
    o = o || {};
    var sh = o.shadow || [46, 36, 74], li = o.light || [255, 238, 205], out = [];
    var lo = o.lo === undefined ? 0.36 : o.lo, hi = o.hi === undefined ? 1.24 : o.hi;
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1), k = lo + (hi - lo) * t, c = C.mul(base, k);
      if (k < 1) c = C.mix(c, C.mul(sh, k * 1.3), (1 - k) * (o.shift === undefined ? 0.55 : o.shift));
      else c = C.mix(c, li, (k - 1) * (o.warm === undefined ? 0.9 : o.warm));
      out.push(col(c));
    }
    return out;
  }
  function mat(base, o) {
    o = o || {};
    var n = o.n || 5;
    return { ramp: ramp(base, n, o), n: n, spec: o.spec || 0, shine: o.shine || 20, hi: o.hiCol ? col(o.hiCol) : col(C.mix(C.mul(base, 1.35), [255, 250, 240], 0.45)),
      dither: o.dither === undefined ? 0.5 : o.dither, line: o.line, rim: o.rim === undefined ? 0.35 : o.rim, flat: o.flat, base: base };
  }
  P.mat = mat; P.ramp = ramp;

  /* ---------------- scene evaluation ---------------- */
  function evalPart(pt) {
    var N = S * S, z = new Float32Array(N).fill(NONE), loc = new Float32Array(N * 3);
    var prims = pt.prims.map(function (e) { return compile(pt.F, e); });
    var k = (pt.k === undefined ? 0.1 : pt.k) * pt.F.s, F = pt.F, zoff = (pt.zoff || 0) * F.s;
    var bx0 = S, bx1 = -1, by0 = S, by1 = -1;
    prims.forEach(function (p) { bx0 = Math.min(bx0, p.x0); bx1 = Math.max(bx1, p.x1); by0 = Math.min(by0, p.y0); by1 = Math.max(by1, p.y1); });
    bx0 = Math.max(0, bx0); by0 = Math.max(0, by0); bx1 = Math.min(S - 1, bx1); by1 = Math.min(S - 1, by1);
    for (var y = by0; y <= by1; y++) for (var x = bx0; x <= bx1; x++) {
      var zz = NONE;
      for (var j = 0; j < prims.length; j++) { var h = hit(prims[j], x, y); if (h > NONE) zz = smax(zz, h, k); }
      if (zz <= NONE) continue;
      var l = F.l(x + 0.5, y + 0.5, zz);
      if (pt.mask && !pt.mask(l[0], l[1], l[2], x, y)) continue;
      if (pt.disp) zz += pt.disp(l[0], l[1], l[2], x, y) * F.s;
      var i = y * S + x;
      z[i] = zz + zoff; loc[i * 3] = l[0]; loc[i * 3 + 1] = l[1]; loc[i * 3 + 2] = l[2];
    }
    pt.z = z; pt.loc = loc;
  }

  function render(sc) {
    var N = S * S, parts = sc.parts, mats = sc.mats;
    parts.forEach(evalPart);
    var top = new Int16Array(N).fill(-1), Z = new Float32Array(N).fill(NONE);
    parts.forEach(function (pt, pi) { var z = pt.z; for (var i = 0; i < N; i++) if (z[i] > Z[i]) { Z[i] = z[i]; top[i] = pi; } });
    var zmin = 1e9; for (var i = 0; i < N; i++) if (top[i] >= 0 && Z[i] < zmin) zmin = Z[i];
    // cavity occlusion from a blurred depth
    var Zf = new Float32Array(N), Zb = new Float32Array(N), tmp = new Float32Array(N), R = 3;
    for (i = 0; i < N; i++) Zf[i] = top[i] >= 0 ? Z[i] : zmin - 6;
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) { var s = 0, n = 0; for (var d = -R; d <= R; d++) { var xx = x + d; if (xx < 0 || xx >= S) continue; s += Zf[y * S + xx]; n++; } tmp[y * S + x] = s / n; }
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) { s = 0; n = 0; for (d = -R; d <= R; d++) { var yy = y + d; if (yy < 0 || yy >= S) continue; s += tmp[yy * S + x]; n++; } Zb[y * S + x] = s / n; }
    var out = new Uint8ClampedArray(N * 4), V = new Float32Array(N), NX = new Float32Array(N), NY = new Float32Array(N), NZ = new Float32Array(N), TONE = new Int8Array(N);
    // background
    sc.bg(out);
    var lxy = Math.hypot(LIGHT[0], LIGHT[1]), sdx = LIGHT[0] / lxy, sdy = LIGHT[1] / lxy, rise = LIGHT[2] / lxy;
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
      i = y * S + x; var pi = top[i]; if (pi < 0) continue;
      var pt = parts[pi], pz = pt.z;
      function zat(xx, yy) { if (xx < 0 || yy < 0 || xx >= S || yy >= S) return NONE; return pz[yy * S + xx]; }
      var zl = zat(x - 1, y), zr = zat(x + 1, y), zu = zat(x, y - 1), zd = zat(x, y + 1), z0 = pz[i];
      var gx = zl > NONE && zr > NONE ? (zr - zl) / 2 : zl > NONE ? z0 - zl : zr > NONE ? zr - z0 : 0;
      var gy = zu > NONE && zd > NONE ? (zd - zu) / 2 : zu > NONE ? z0 - zu : zd > NONE ? zd - z0 : 0;
      // silhouette pixels: tilt the normal outward
      if (zl <= NONE) gx = Math.max(gx, 2.2); if (zr <= NONE) gx = Math.min(gx, -2.2);
      if (zu <= NONE) gy = Math.max(gy, 2.2); if (zd <= NONE) gy = Math.min(gy, -2.2);
      gx = clamp(gx, -4, 4); gy = clamp(gy, -4, 4);
      var nv = nrm([-gx, -gy, 1]);
      NX[i] = nv[0]; NY[i] = nv[1]; NZ[i] = nv[2];
      var M = mats[typeof pt.mat === 'function' ? pt.mat(pt.loc[i * 3], pt.loc[i * 3 + 1], pt.loc[i * 3 + 2], x, y) : pt.mat] || mats.skin;
      var nl = nv[0] * LIGHT[0] + nv[1] * LIGHT[1] + nv[2] * LIGHT[2];
      var dif = clamp((nl + 0.3) / 1.3, 0, 1);
      // cast shadow by marching the height field toward the light
      var sh = 0;
      if (pt.noShadow !== true) for (var st = 2; st < 22; st++) {
        var sx = Math.round(x + sdx * st), sy = Math.round(y + sdy * st);
        if (sx < 0 || sy < 0 || sx >= S || sy >= S) break;
        var j2 = sy * S + sx;
        if (top[j2] >= 0 && parts[top[j2]].cast !== false && Z[j2] > z0 + rise * st + 1.5) { sh = 1; break; }
      }
      var cav = Math.max(0, Zb[i] - Z[i]);
      var occ = 1 - Math.min(0.45, cav * 0.045);
      var v = (0.16 + 0.84 * dif * (sh ? 0.42 : 1)) * occ;
      // cool rim from the back right
      if (nv[0] > 0.45 && M.rim) v += M.rim * 0.25 * (nv[0] - 0.45);
      if (pt.vmul) v *= pt.vmul;
      V[i] = v;
      var dth = (BAYER[(x & 3) + (y & 3) * 4] / 16 - 0.47) * M.dither / M.n;
      var ti = clamp(Math.floor((v + dth) * M.n * 0.999), 0, M.n - 1);
      if (M.flat) ti = clamp(ti, 1, M.n - 2);
      var c = M.ramp[ti];
      if (M.spec) { var sp = Math.pow(Math.max(0, nv[0] * HALF[0] + nv[1] * HALF[1] + nv[2] * HALF[2]), M.shine) * M.spec * (sh ? 0.2 : 1); if (sp > 0.5) c = M.hi; else if (sp > 0.3 && ti < M.n - 1) c = M.ramp[ti + 1]; }
      TONE[i] = ti;
      var o4 = i * 4; out[o4] = c[0]; out[o4 + 1] = c[1]; out[o4 + 2] = c[2]; out[o4 + 3] = 255;
    }
    // selective outline: front pixels at a depth break get a darker tone of their own ramp
    var outl = new Uint8ClampedArray(out);
    for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
      i = y * S + x; pi = top[i]; if (pi < 0) continue;
      pt = parts[pi]; if (pt.line === false) continue;
      var bgEdge = false, inEdge = false;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dd) {
        var xx = x + dd[0], yy = y + dd[1];
        if (xx < 0 || yy < 0 || xx >= S || yy >= S) return;
        var j = yy * S + xx;
        if (top[j] < 0) bgEdge = true;
        else if (top[j] !== pi && Z[i] - Z[j] > (pt.lineGap || 3)) inEdge = true;
      });
      if (!bgEdge && !inEdge) continue;
      M = mats[typeof pt.mat === 'function' ? pt.mat(pt.loc[i * 3], pt.loc[i * 3 + 1], pt.loc[i * 3 + 2], x, y) : pt.mat] || mats.skin;
      var lc = M.line || C.mul(M.ramp[0], bgEdge ? 0.62 : 0.8);
      var t2 = TONE[i];
      c = bgEdge ? (NX[i] < -0.2 && t2 >= 2 ? M.ramp[Math.max(0, t2 - 2)] : lc) : (t2 >= 2 ? M.ramp[t2 - 2] : lc);
      if (bgEdge && sc.lineCol) c = C.mix(c, sc.lineCol, 0.3);
      var o = i * 4; outl[o] = c[0]; outl[o + 1] = c[1]; outl[o + 2] = c[2]; outl[o + 3] = 255;
    }
    var ctx = { out: outl, top: top, Z: Z, V: V, NX: NX, NY: NY, NZ: NZ, parts: parts, mats: mats, sc: sc };
    return ctx;
  }

  /* ---------------- painting helpers for features ---------------- */
  function Pen(ctx) {
    var out = ctx.out;
    var pen = {
      ctx: ctx,
      px: function (x, y, c, a) {
        x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= S || y >= S || !c) return;
        var o = (y * S + x) * 4;
        if (a === undefined || a >= 1) { out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255; }
        else { out[o] += (c[0] - out[o]) * a; out[o + 1] += (c[1] - out[o + 1]) * a; out[o + 2] += (c[2] - out[o + 2]) * a; out[o + 3] = 255; }
      },
      get: function (x, y) { var o = (y * S + x) * 4; return [out[o], out[o + 1], out[o + 2]]; },
      /* paint with a material, using the light value already computed for that pixel */
      lit: function (x, y, M, dv) {
        if (x < 0 || y < 0 || x >= S || y >= S) return;
        var i = y * S + x, v = ctx.V[i] + (dv || 0);
        var dth = (BAYER[(x & 3) + (y & 3) * 4] / 16 - 0.47) * M.dither / M.n;
        pen.px(x, y, M.ramp[clamp(Math.floor((v + dth) * M.n * 0.999), 0, M.n - 1)]);
      },
      shade: function (x, y, k) { if (x < 0 || y < 0 || x >= S || y >= S) return; var c = pen.get(x, y); pen.px(x, y, C.mul(c, k)); },
      tint: function (x, y, c, a) { pen.px(x, y, c, a); },
      /* depth-tested disc / point for jewellery etc. */
      zpx: function (x, y, z, c) { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= S || y >= S) return false; if (ctx.Z[y * S + x] > z) return false; pen.px(x, y, c); return true; }
    };
    return pen;
  }
  /* iterate over pixels of a given part that are visible (front-most) */
  function eachVisible(ctx, part, fn, bb) {
    var pi = ctx.parts.indexOf(part); if (pi < 0) return;
    var x0 = bb ? Math.max(0, bb[0]) : 0, y0 = bb ? Math.max(0, bb[1]) : 0, x1 = bb ? Math.min(S - 1, bb[2]) : S - 1, y1 = bb ? Math.min(S - 1, bb[3]) : S - 1;
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var i = y * S + x; if (ctx.top[i] !== pi) continue;
      fn(x, y, part.loc[i * 3], part.loc[i * 3 + 1], part.loc[i * 3 + 2], i);
    }
  }

  /* ---------------- background ---------------- */
  function background(spec) {
    var base = spec.bg || [60, 56, 62], sepia = spec.sepia;
    var dark = C.mix(C.mul(base, 0.42), [14, 12, 20], 0.35), light = C.mix(C.mul(base, 1.25), [230, 214, 180], 0.12);
    var tones = [dark, C.mix(dark, base, 0.5), base, C.mix(base, light, 0.55), light].map(col);
    var seed = spec.seed || 1;
    return function (out) {
      for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
        // light falls from the upper left; a soft brushed texture, darker toward the lower right
        var gx = x / S, gy = y / S;
        var v = 0.78 - gx * 0.38 - gy * 0.22;
        var dx = (gx - 0.28) / 0.6, dy = (gy - 0.3) / 0.55;
        v += 0.25 * Math.exp(-(dx * dx + dy * dy));
        var stroke = vnoise(x / 14 + y / 40, y / 6, seed) * 0.55 + vnoise(x / 30, y / 22, seed + 3) * 0.45;
        v += (stroke - 0.5) * 0.22;
        v = clamp(v, 0, 0.999);
        var dth = (BAYER[(x & 3) + (y & 3) * 4] / 16 - 0.47) * 0.45 / 5;
        var c = tones[clamp(Math.floor((v + dth) * 5), 0, 4)];
        if (sepia) c = C.mix(c, [C.mul(c, 1)[0] * 0.393 + c[1] * 0.769 + c[2] * 0.189, c[0] * 0.349 + c[1] * 0.686 + c[2] * 0.168, c[0] * 0.272 + c[1] * 0.534 + c[2] * 0.131].map(function (q) { return q * 0.8; }), sepia);
        var o = (y * S + x) * 4; out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
      }
    };
  }

  /* ---------------- the head ---------------- */
  /* face types: proportions in head units (half head width = 1, eye line at Y = 0) */
  var FACES = {
    man:    { cran: 1.0, fw: 1.0, jawX: 0.56, jawY: 0.8, jawR: 1.0, chinY: 1.3, chinW: 0.3, brow: 0.16, nose: 1.0, noseW: 1.0, lip: 1.0, lipW: 1.0, eye: 1.0, neck: 0.5, sh: 1.08, age: 0, fem: 0, mouthY: 0.9, noseY: 0.6, chinZ: 0.5 },
    woman:  { cran: 0.98, fw: 0.94, jawX: 0.46, jawY: 0.78, jawR: 0.85, chinY: 1.24, chinW: 0.24, brow: 0.07, nose: 0.88, noseW: 0.85, lip: 1.2, lipW: 0.95, eye: 1.08, neck: 0.4, sh: 0.9, age: 0, fem: 1, mouthY: 0.86, noseY: 0.57, chinZ: 0.46 },
    boy:    { cran: 1.0, fw: 0.94, jawX: 0.46, jawY: 0.7, jawR: 0.85, chinY: 1.14, chinW: 0.26, brow: 0.05, nose: 0.78, noseW: 0.85, lip: 1.05, lipW: 0.9, eye: 1.12, neck: 0.38, sh: 0.8, age: 0, fem: 0.3, mouthY: 0.8, noseY: 0.52, chinZ: 0.44, child: 1 },
    girl:   { cran: 1.0, fw: 0.92, jawX: 0.44, jawY: 0.7, jawR: 0.8, chinY: 1.12, chinW: 0.24, brow: 0.04, nose: 0.75, noseW: 0.8, lip: 1.15, lipW: 0.9, eye: 1.15, neck: 0.36, sh: 0.76, age: 0, fem: 1, mouthY: 0.79, noseY: 0.5, chinZ: 0.42, child: 1 },
    small:  { cran: 1.04, fw: 0.95, jawX: 0.42, jawY: 0.6, jawR: 0.8, chinY: 0.98, chinW: 0.26, brow: 0.0, nose: 0.6, noseW: 0.8, lip: 1.1, lipW: 0.85, eye: 1.25, neck: 0.34, sh: 0.66, age: 0, fem: 0.6, mouthY: 0.7, noseY: 0.42, chinZ: 0.42, child: 2 },
    old:    { cran: 0.98, fw: 0.94, jawX: 0.48, jawY: 0.82, jawR: 0.9, chinY: 1.26, chinW: 0.25, brow: 0.08, nose: 0.96, noseW: 0.92, lip: 0.85, lipW: 0.95, eye: 0.98, neck: 0.4, sh: 0.88, age: 1, fem: 1, mouthY: 0.9, noseY: 0.6, chinZ: 0.45 },
    oldman: { cran: 1.0, fw: 1.0, jawX: 0.55, jawY: 0.82, jawR: 1.0, chinY: 1.3, chinW: 0.3, brow: 0.15, nose: 1.08, noseW: 1.05, lip: 0.8, lipW: 1.0, eye: 0.95, neck: 0.46, sh: 1.0, age: 1, fem: 0, mouthY: 0.92, noseY: 0.62, chinZ: 0.48 }
  };
  P.FACES = FACES;

  function faceParams(spec) {
    var f = {}, base = FACES[spec.face] || FACES.man, k;
    for (k in base) f[k] = base[k];
    if (spec.faceTweak) for (k in spec.faceTweak) f[k] = spec.faceTweak[k];
    f.gaunt = spec.gaunt || 0; f.stout = spec.stout || 0;
    if (spec.age !== undefined) f.age = spec.age;
    return f;
  }

  function headParts(F, f, ex) {
    var sw = f.fw, st = f.stout, ga = f.gaunt;
    var cranY = f.child === 2 ? -0.5 : f.child ? -0.44 : -0.38;
    var prims = [
      E([0, cranY, -0.1], [0.98 * f.cran, 1.0 * f.cran, 1.05 * f.cran]),                  // cranium
      E([0, 0.3, 0.06], [0.8 * sw + st * 0.08, 0.95 * (f.chinY / 1.3), 0.8]),               // mid face
      E([-f.jawX - st * 0.08, f.jawY, -0.05], [0.3 * f.jawR + st * 0.1, 0.42, 0.45]),      // jaw angles
      E([f.jawX + st * 0.08, f.jawY, -0.05], [0.3 * f.jawR + st * 0.1, 0.42, 0.45]),
      E([0, f.chinY - 0.18, f.chinZ + 0.02], [f.chinW + st * 0.08, 0.2, 0.26]),           // chin
      E([-0.47, 0.18, 0.5 - ga * 0.03], [0.3, 0.2, 0.3]), E([0.47, 0.18, 0.5 - ga * 0.03], [0.3, 0.2, 0.3]), // cheekbones
      E([0, -0.25, 0.7], [0.62, 0.12 + f.brow * 0.3, 0.2 + f.brow * 0.25]),                // brow ridge
      E([0, f.noseY * 0.38, 0.84], [0.085 * f.noseW, 0.34 * f.nose, 0.12], { rot: [0, -0.32, 0] }),       // nose bridge
      E([0, f.noseY - 0.08, 0.86 + 0.1 * f.nose], [0.115 * f.noseW, 0.105, 0.115]),       // nose tip
      E([-0.12 * f.noseW, f.noseY - 0.03, 0.84], [0.085 * f.noseW, 0.07, 0.08]),          // nostril wings
      E([0.12 * f.noseW, f.noseY - 0.03, 0.84], [0.085 * f.noseW, 0.07, 0.08]),
      E([0, f.mouthY - 0.04, 0.6], [0.42, 0.3, 0.33]),                                      // muzzle
      E([0, f.mouthY - 0.045, 0.87], [0.21 * f.lipW, 0.05 * f.lip, 0.08]),                  // upper lip
      E([0, f.mouthY + 0.06, 0.86], [0.18 * f.lipW, 0.06 * f.lip, 0.085])                   // lower lip
    ];
    if (st) { // full cheeks, double chin
      prims.push(E([-0.52, 0.6, 0.35], [0.38, 0.4, 0.42]), E([0.52, 0.6, 0.35], [0.38, 0.4, 0.42]));
      prims.push(E([0, f.chinY + 0.02, 0.18], [0.5, 0.26, 0.42]));
    }
    var my = f.mouthY, ny = f.noseY;
    var head = {
      name: 'head', F: F, mat: 'skin', k: 0.1, prims: prims,
      disp: function (X, Y, Z) {
        if (Z < -0.2) return 0;
        var ax = Math.abs(X), d = 0;
        d -= (0.07 + ga * 0.03) * g2((ax - 0.36) / 0.21, (Y + 0.02) / 0.15);                // eye sockets
        d += 0.025 * g2((ax - 0.36) / 0.13, (Y - 0.01) / 0.07);                             // eyeballs
        d -= (0.035 + ga * 0.05) * g2((ax - 0.8) / 0.16, (Y + 0.38) / 0.26);                // temples
        d -= ga * 0.07 * g2((ax - 0.56) / 0.14, (Y - 0.58) / 0.2);                          // hollow cheeks
        d -= 0.012 * g2(X / 0.035, (Y - (ny + my) / 2) / 0.07);                             // philtrum
        d -= 0.022 * g2(X / 0.16, (Y - my - 0.17) / 0.045);                                 // under-lip groove
        // nasolabial folds: from the nose wing down past the mouth corner
        var fold = 0.008 + f.age * 0.022 + ex.cheek * 0.02 + ga * 0.01 + st * 0.008;
        var t = clamp((Y - ny) / (my + 0.1 - ny), 0, 1), fx = 0.2 + t * 0.12 + st * 0.04;
        if (Y > ny - 0.05 && Y < my + 0.18) d -= fold * g2((ax - fx) / 0.03, 0);
        d += ex.cheek * 0.045 * g2((ax - 0.42) / 0.15, (Y - 0.42) / 0.14);                  // smile lifts the cheeks
        if (f.age) { d += f.age * 0.03 * g2((ax - 0.36) / 0.13, (Y - 0.17) / 0.05); d += f.age * 0.03 * g2((ax - 0.42) / 0.12, (Y - my - 0.12) / 0.12); } // bags, jowls
        if (ex.mouthOpen) d -= ex.mouthOpen * g2(X / 0.12, (Y - my) / 0.05);
        return d;
      }
    };
    var ear = { name: 'ear', F: F, mat: 'skin', k: 0.05, prims: [
      E([-0.93, 0.17, -0.12], [0.11, 0.3, 0.23], { rot: [-0.25, 0, -0.12] }), E([0.93, 0.17, -0.12], [0.11, 0.3, 0.23], { rot: [0.25, 0, 0.12] })
    ], lineGap: 1.5 };
    var neck = { name: 'neck', F: F, mat: 'skin', k: 0.1, prims: [E([0, 1.5, -0.22], [f.neck + f.stout * 0.15, 1.0, f.neck * 0.95 + f.stout * 0.1])], vmul: 0.92 };
    return { head: head, ear: ear, neck: neck };
  }

  /* expression parameters */
  var EXP = {
    neutral: { open: 1, browIn: 0, browOut: 0, mouth: 0, curve: 0, cheek: 0, look: 0, lower: 0 },
    sad:     { open: 0.78, browIn: -0.075, browOut: 0.035, curve: -0.05, cheek: 0, look: 0.03, lower: 0, droop: 0.4, lookY: 0.02 },
    scared:  { open: 1.45, browIn: -0.09, browOut: -0.06, curve: -0.02, mouthOpen: 0.03, open2: 1, cheek: 0, pupil: 0.65, look: 0 },
    angry:   { open: 0.72, browIn: 0.085, browOut: -0.035, curve: -0.035, cheek: 0, flat: 1, furrow: 1, tight: 1 },
    smile:   { open: 0.78, browIn: -0.015, browOut: 0, curve: 0.06, cheek: 1, lower: 0.035, smile: 1 },
    blank:   { open: 0.9, browIn: 0, browOut: 0.01, curve: -0.008, cheek: 0, dull: 1 },
    worried: { open: 1.08, browIn: -0.075, browOut: 0.015, curve: -0.025, cheek: 0, look: -0.05, furrow: 0.5 },
    tired:   { open: 0.52, browIn: -0.02, browOut: 0.03, curve: -0.02, cheek: 0, bags: 1 }
  };
  P.EXP = EXP;

  /* ---------------- face feature painter ---------------- */
  function paintFace(pen, ctx, spec, f, ex, parts, mats) {
    var head = parts.head, F = head.F, s = F.s;
    var skinM = mats.skin, lipM = mats.lip;
    var irisC = spec.eyes || [70, 60, 50];
    var hairC = spec.browCol || spec.hairCol || [60, 40, 30];
    var ink = C.mix(C.mul(skinM.ramp[0], 0.45), [20, 12, 22], 0.5);
    var eyeS = f.eye, ew = 0.165 * eyeS, eyeX = 0.36 + (f.child ? -0.01 : 0), open = ex.open * (spec.lidOpen || 1);
    var hu0 = 0.075 * eyeS * open, hl0 = 0.045 * eyeS * Math.min(1.2, 0.6 + open * 0.4);
    var irisR = 0.072 * eyeS * (f.child ? 1.08 : 1);
    var lookX = (ex.look || 0) + (spec.look || 0), lookY = (ex.lookY || 0) + (spec.lookY || 0);
    var lidLow = (spec.heavyLids || 0) + (ex.flat ? 0.25 : 0);
    var sclera = ex.dull ? [196, 192, 186] : [232, 226, 218], scleraD = C.mul(sclera, 0.78);
    var irisD = C.mul(irisC, 0.55), irisL = C.mix(irisC, [240, 240, 230], 0.25);
    if (ex.dull) { irisC = C.mix(irisC, [140, 140, 146], 0.55); irisL = irisC; }
    var px1 = 1 / s; // one pixel in head units (vertical)

    function eyeShape(X, Y, side) {
      // t: 0 inner corner -> 1 outer corner
      var cx = side * eyeX, t = (side * (X - cx) + ew) / (2 * ew);
      if (t < -0.05 || t > 1.05) return null;
      var tt = clamp(t, 0, 1);
      var inner = 0.01, outer = -0.012 - (ex.droop || 0) * 0.04 * side * side;
      var base = inner + (outer - inner) * tt;
      var up = Math.pow(Math.sin(Math.PI * clamp((tt - 0.02) / 0.98, 0, 1)), 0.75);
      var upPeak = Math.pow(Math.sin(Math.PI * clamp(tt * 0.92 + 0.02, 0, 1)), 0.8);
      var hu = hu0 * (0.55 + 0.45 * upPeak) * up / Math.max(0.01, (0.55 + 0.45 * upPeak));
      hu = hu0 * up * (1 - lidLow * 0.3 * (1 - tt));
      var hl = hl0 * Math.pow(Math.sin(Math.PI * tt), 0.9) * (1 - (ex.lower || 0) * 8);
      var yU = base - hu, yL = base + Math.max(hl, 0.008);
      return { t: t, yU: yU, yL: yL, base: base };
    }
    var socketY0 = -0.2, bb = null;
    eachVisible(ctx, head, function (x, y, X, Y, Z, i) {
      if (Z < 0) return;
      var side = X < 0 ? -1 : 1;
      var e = eyeShape(X, Y, side);
      if (!e) return;
      var dU = (Y - e.yU) * s, dL = (e.yL - Y) * s;
      if (dU >= 0 && dL >= 0 && e.t >= 0 && e.t <= 1) {
        // inside the eye opening
        var cx = side * eyeX + lookX, cy = e.base + 0.005 + lookY;
        var rx = (X - cx) / irisR, ry = (Y - cy) / irisR, r = Math.sqrt(rx * rx + ry * ry);
        var c;
        if (r <= 1) {
          c = r > 0.78 ? irisD : (ry > 0.15 ? irisL : irisC);
          var pr = (ex.pupil || 1) * 0.42 * (ex.dull ? 1.15 : 1);
          if (r < pr) c = [18, 14, 18];
          if (dU < 1.6) c = C.mul(c, 0.7);                                             // shadow of the upper lid
        } else {
          c = dU < 1.4 || e.t < 0.12 || e.t > 0.9 ? scleraD : sclera;
          if (e.t > 0.82 || e.t < 0.08) c = C.mul(scleraD, 0.92);
        }
        pen.px(x, y, c);
        // catch-light: upper left of the iris
        if (!ex.dull && Math.abs(rx + 0.32) < 0.25 * 1 && Math.abs(ry + 0.38) < 0.22 && r < 0.9) pen.px(x, y, [250, 250, 246]);
        return;
      }
      // upper lid line / lashes
      if (e.t > -0.04 && e.t < 1.04 && dU < 0 && dU >= -1.15 - (e.t > 0.6 ? 0.5 * (f.fem || 0) : 0)) { pen.px(x, y, C.mix(ink, C.mul(hairC, 0.5), 0.2)); return; }
      // eyelid crease above
      var crease = (Y - (e.yU - 0.045 - 0.02 * open)) * s;
      if (e.t > 0.1 && e.t < 0.98 && crease > -0.6 && crease < 0.5) { pen.lit(x, y, skinM, -0.2); return; }
      // lower lid
      if (e.t > 0.15 && e.t < 0.95 && dL < 0 && dL > -1) { pen.lit(x, y, skinM, -0.1); return; }
      if ((ex.bags || f.age > 0.5 || spec.bags) && e.t > 0.15 && e.t < 0.85 && dL < -1.6 && dL > -2.6) pen.lit(x, y, skinM, -0.12 * (ex.bags ? 1.4 : spec.bags || f.age));
    }, null);

    // brows: tapered strokes following the brow ridge, expression moves the inner/outer ends
    var browY = -0.27 + (spec.browY || 0), browT = (spec.browThick || 1) * (f.fem ? 0.85 : 1.1);
    var browC = spec.browCol || C.mul(hairC, 0.85);
    var browM = mat(browC, { n: 4, lo: 0.5, hi: 1.15, dither: 0 });
    eachVisible(ctx, head, function (x, y, X, Y, Z) {
      if (Z < 0.05) return;
      var side = X < 0 ? -1 : 1, ax = Math.abs(X);
      var t = (ax - 0.12) / 0.48; if (t < -0.02 || t > 1.02) return;
      var arch = (spec.browStraight ? 0.012 : 0.04) * Math.sin(Math.PI * Math.min(1, t * 1.15));
      var cy = browY - arch + ex.browIn * (1 - t) + ex.browOut * t;
      var th = (0.042 * (1 - t * 0.55)) * browT;
      var d = Math.abs(Y - cy);
      if (d < th) { var hairy = hash(x, y) < 0.18 && t > 0.5 ? -0.12 : 0; pen.lit(x, y, browM, (Y < cy ? 0.05 : -0.08) + hairy); }
      if (ex.furrow && ax < 0.1 && Y > cy - 0.02 && Y < cy + 0.13 && Math.abs(ax - 0.05) * s < 0.6 * ex.furrow) pen.lit(x, y, skinM, -0.2);
      if ((ex.browIn < -0.05) && ax < 0.17 && Math.abs(Y - (browY - 0.12)) * s < 0.5 && ax > 0.05) pen.lit(x, y, skinM, -0.12); // worry lines
    });

    // nose: nostril shadows and the wing crease
    var ny = f.noseY;
    eachVisible(ctx, head, function (x, y, X, Y, Z) {
      if (Z < 0.5) return;
      var ax = Math.abs(X);
      var nn = g2((ax - 0.085 * f.noseW) / 0.045, (Y - ny - 0.015) / 0.028);
      if (nn > 0.45) pen.lit(x, y, skinM, -0.42);
      else if (nn > 0.2) pen.lit(x, y, skinM, -0.2);
      var wing = Math.abs(Math.hypot((ax - 0.12 * f.noseW) / 0.1, (Y - ny + 0.04) / 0.075) - 1) * s * 0.075;
      if (wing < 0.55 && Y > ny - 0.08 && X * 1 > -1 && ax > 0.1 && Y < ny + 0.02) pen.lit(x, y, skinM, -0.15);
    });

    // mouth: lips shaded with the lip material, parting line shaped by the expression
    var my = f.mouthY, mw = 0.205 * f.lipW * (1 + (ex.smile ? 0.12 : 0) - (ex.tight ? 0.08 : 0));
    var curve = ex.curve + (spec.mouthCurve || 0);
    var openA = ex.mouthOpen ? 0.05 + (ex.open2 ? 0.02 : 0) : (ex.smile && spec.teeth ? 0.025 : 0);
    var upH = 0.045 * f.lip * (ex.tight ? 0.6 : 1), loH = 0.06 * f.lip * (ex.tight ? 0.6 : 1);
    eachVisible(ctx, head, function (x, y, X, Y, Z) {
      if (Z < 0.3) return;
      var u = X / mw; if (Math.abs(u) > 1.2) return;
      var au = Math.min(1, Math.abs(u));
      var line = my - curve * (au * au) + curve * 0.25;                       // corners up for positive curve
      var dy = (Y - line) * s;
      var opH = openA * (1 - au * au) * s;
      if (Math.abs(u) <= 1) {
        if (opH > 0.5 && dy > -opH * 0.4 && dy < opH * 0.6) { pen.px(x, y, dy < -opH * 0.4 + 1.2 && spec.teeth !== false ? [214, 206, 196] : [62, 26, 30]); return; }
        if (dy > -0.5 - opH * 0.4 && dy < 0.5 + opH * 0.6 - (opH > 0.5 ? 0 : 0)) { pen.px(x, y, au > 0.85 ? C.mix(ink, skinM.ramp[1], 0.4) : ink); return; }
        var bow = 0.012 * Math.cos(au * Math.PI * 2.2) * (1 - au);
        var uTop = line - opH * 0.4 / s - upH * (1 - au * au * 0.7) - bow;
        if (Y < line && Y >= uTop && au < 0.95) { pen.lit(x, y, lipM, -0.12); return; }
        var lBot = line + opH * 0.6 / s + loH * Math.sqrt(Math.max(0, 1 - au * au * 1.1));
        if (Y > line && Y <= lBot) { pen.lit(x, y, lipM, (Y - line) / (lBot - line) < 0.45 ? 0.1 : -0.02); return; }
        if (Y > lBot && Y < lBot + 1.2 / s && au < 0.7) pen.lit(x, y, skinM, -0.15);
      }
      // smile / sad corner creases
      if (Math.abs(u) > 1 && Math.abs(u) < 1.18) {
        var cdy = (Y - (line + (curve > 0.02 ? -0.01 : 0.015))) * s;
        if (Math.abs(cdy) < 0.6 && (curve > 0.02 || curve < -0.03 || f.age)) pen.lit(x, y, skinM, -0.2);
      }
    });

    // age: forehead lines, crow's feet; freckles; blush
    eachVisible(ctx, head, function (x, y, X, Y, Z) {
      if (Z < 0.1) return;
      var ax = Math.abs(X);
      if (f.age > 0.3 || spec.lines) {
        var a = f.age || spec.lines;
        [-0.52, -0.62, -0.72].forEach(function (ly, k) { if (k < 1 + Math.round(a * 2) && ax < 0.42 - k * 0.04 && Math.abs((Y - ly - 0.02 * Math.cos(X * 4)) * s) < 0.5 && hash(x, k) > 0.18) pen.lit(x, y, skinM, -0.12); });
        if (ax > 0.53 && ax < 0.66 && Y > -0.06 && Y < 0.08) { var cf = (Y + (ax - 0.53) * (Math.round(hash(Math.floor(Y * 30), 3) * 2) - 1) * 0.8) * s; if (hash(x, y) < 0.35 * a) pen.lit(x, y, skinM, -0.12); }
        if (a > 0.6 && ax > 0.15 && ax < 0.42 && Math.abs((Y - 0.16 - (ax - 0.3) * (ax - 0.3) * 0.8) * s) < 0.5) pen.lit(x, y, skinM, -0.1);
      }
      if (spec.freckles) {
        var fq = Math.floor(X * 26), fr = Math.floor(Y * 26);
        if (ax > 0.08 && ax < 0.62 && Y > 0.08 && Y < 0.5 && hash(fq, fr) > 0.8 && hash(x, y) > 0.4) pen.lit(x, y, mats.freckle || skinM, -0.06);
      }
      if (spec.blush || f.child || ex.cheek) {
        var bl = g2((ax - 0.5) / 0.16, (Y - 0.36) / 0.12) * (spec.blush || 0.6) * (f.child ? 1 : 0.7);
        if (bl > 0.25) pen.tint(x, y, [200, 80, 80], Math.min(0.22, bl * 0.3));
      }
    });
    // stubble / shaved beard shadow
    if (spec.stubble) eachVisible(ctx, head, function (x, y, X, Y, Z) {
      if (Z < -0.1) return;
      var ax = Math.abs(X); var inBeard = Y > f.noseY + 0.05 && (Y > f.mouthY + 0.05 || ax > 0.25 || Y < f.mouthY - 0.05 && ax < 0.3) && ax < 0.85 && !(Y > f.mouthY - 0.08 && Y < f.mouthY + 0.12 && ax < 0.23);
      if (inBeard && hash(x * 3, y * 7) > 0.45) pen.tint(x, y, C.mul(spec.stubble, 0.9), 0.35);
    });
    // ear detail: inner shadow
    eachVisible(ctx, parts.ear, function (x, y, X, Y, Z) {
      var ex2 = (Math.abs(X) - 0.93), ey = (Y - 0.17);
      if (Math.abs(ey) < 0.17 && Z > -0.13 && Z < 0.02 && hash(x, y) > -1) { var q = (ey / 0.17) * (ey / 0.17) + ((Z + 0.06) / 0.07) * ((Z + 0.06) / 0.07); if (q < 1) pen.lit(x, y, skinM, q < 0.35 ? -0.35 : -0.18); }
    });
  }

  /* ---------------- build a scene from a character ---------------- */
  function build(id, expr) {
    var d = BTS.Data.characters[id];
    var pd = d.portrait || {};
    var spec = {};
    var k;
    for (k in pd) spec[k] = pd[k];
    spec.id = id;
    spec.skin = pd.skin || d.skin;
    spec.hairCol = pd.hairCol || d.hair;
    if (spec.face === undefined) spec.face = 'man';
    var f = faceParams(spec);
    var ex = {}, e0 = EXP[expr] || EXP.neutral;
    for (k in e0) ex[k] = e0[k];
    if (spec.mood) for (k in spec.mood) if (typeof spec.mood[k] === 'number') ex[k] = (ex[k] || 0) + spec.mood[k];
    if (spec.moodExpr && spec.moodExpr[expr]) for (k in spec.moodExpr[expr]) ex[k] = spec.moodExpr[expr][k];
    ex.cheek = ex.cheek || 0;

    var yaw = spec.yaw === undefined ? 0.5 : spec.yaw;
    var s = spec.scale || (f.child === 2 ? 22 : 23);
    var hx = spec.hx || 57, hy = spec.hy || (f.child === 2 ? 50 : 46);
    var tiltR = (spec.roll || 0) + (expr === 'sad' ? 0.03 : expr === 'tired' ? 0.045 : expr === 'worried' ? -0.02 : 0);
    var pitch = (spec.pitch || 0) + (expr === 'sad' || expr === 'tired' ? 0.08 : expr === 'scared' ? -0.03 : 0);
    var Fh = Frame({ x: hx, y: hy, s: s, yaw: yaw, pitch: pitch, roll: tiltR });
    var Fb = Frame({ x: hx + 1, y: hy, s: s, yaw: yaw * 0.6, pitch: 0, roll: 0 });

    var skin = spec.skin;
    var mats = {
      skin: mat(skin, { n: 6, lo: 0.42, hi: 1.16, shadow: [120, 50, 70], light: [255, 236, 210], shift: 0.5, warm: 0.6, dither: 0.35, rim: 0.3 }),
      lip: mat(spec.lipCol || C.mix(skin, [176, 70, 72], f.fem ? 0.42 : 0.28), { n: 5, lo: 0.5, hi: 1.12, shadow: [90, 30, 50], dither: 0.2 }),
      freckle: mat(C.mix(skin, [150, 80, 40], 0.4), { n: 5, lo: 0.5, hi: 1.1, dither: 0 })
    };
    var hp = headParts(Fh, f, ex);
    var parts = [hp.head, hp.ear, hp.neck];
    var lib = BTS.PortraitLib;
    var api = { E: E, F: Fh, Fb: Fb, f: f, spec: spec, d: d, ex: ex, expr: expr, mats: mats, mat: mat, hash: hash, vnoise: vnoise, g2: g2, clamp: clamp, C: C, parts: parts, hp: hp, overlays: [] };
    if (lib) lib.dress(api);
    var sc = { parts: parts, mats: mats, bg: background({ bg: spec.bg || lib && lib.bgFor(spec) || [70, 64, 70], seed: id.length * 7 + id.charCodeAt(0), sepia: spec.sepia }), lineCol: [16, 12, 18] };
    var ctx = render(sc);
    var pen = Pen(ctx);
    paintFace(pen, ctx, spec, f, ex, hp, mats);
    api.overlays.forEach(function (fn) { fn(pen, ctx, eachVisible); });
    // frame
    var out = ctx.out;
    for (var i = 0; i < S; i++) { pen.px(i, 0, [96, 80, 60]); pen.px(0, i, [96, 80, 60]); pen.px(i, S - 1, [44, 36, 30]); pen.px(S - 1, i, [44, 36, 30]); }
    return out;
  }
  P.Frame = Frame; P.E = E; P.eachVisible = eachVisible;

  var ALIAS = { jaglika_needle: 'jaglika', jaglika_needle_late: 'jaglika_late', djordje_child: 'djordje_young' };
  function resolve(id) {
    var base = ALIAS[id] || id;
    if (BTS.CharSprites && BTS.CharSprites.variant) base = BTS.CharSprites.variant(base);
    base = ALIAS[base] || base;
    return base;
  }
  P.render = function (id, expr) {
    var px = build(id, expr);
    var cv = document.createElement('canvas'); cv.width = cv.height = S;
    cv.getContext('2d').putImageData(new ImageData(px, S, S), 0, 0);
    return cv;
  };
  P.get = function (id, expr) {
    if (!id) return null;
    var base = resolve(id);
    var def = BTS.Data.characters[base];
    if (!def || def.portrait === false) return null;
    expr = EXPR.indexOf(expr) >= 0 ? expr : 'neutral';
    var k = base + ':' + expr;
    if (!cache[k]) {
      try { cache[k] = P.render(base, expr).toDataURL(); }
      catch (err) { BTS.Log && BTS.Log.warn('portrait failed', base, expr, err && err.message); return null; }
    }
    return cache[k];
  };
  P.clearCache = function () { cache = {}; };
  return P;
})();
