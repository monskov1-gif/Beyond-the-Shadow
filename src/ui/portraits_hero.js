/* Portrait component library for the vector portrait rig (portraits.js): hair styles, beards, hats, outfits and
   accessories. Every piece is drawn with points placed on the rig's 3D head (a.on / a.rim) or the body frame (a.bp)
   so it follows the 3/4 view. Which pieces a character wears is data: the `portrait` entry in data/characters.js. */
'use strict';
BTS.PortraitLib = (function () {
  var G = BTS.Portraits.geo, Cc = BTS.Portraits.col;
  var smooth = G.smooth, taper = G.taper, K = G.K, f = G.f, lerp = G.lerp, ss = G.ss, spline = G.spline, offset = G.offset, poly = G.poly;
  var hx = Cc.hx, rgb = Cc.rgb, mix = Cc.mix, mul = Cc.mul, lum = Cc.lum, desat = Cc.desat;

  function rnd(seed) { var s = seed || 1; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function mid(p, q, t) { return [lerp(p[0], q[0], t), lerp(p[1], q[1], t)]; }
  function quad(p0, c, p1, n) { var o = []; for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } return o; }

  /* material tones for hair */
  function hairTones(c) {
    c = hx(c); var L = lum(c);
    if (L < 45) return { base: c, shadow: mix(mul(c, 0.55), [6, 6, 12], 0.4), deep: [8, 7, 11], light: mix(c, [96, 100, 120], 0.35), hi: mix(c, [150, 156, 178], 0.62), line: [8, 6, 10] };
    if (L < 110) return { base: c, shadow: mix(mul(c, 0.66), [40, 18, 30], 0.25), deep: mix(mul(c, 0.42), [24, 10, 18], 0.3), light: mix(mul(c, 1.25), [255, 220, 170], 0.12), hi: mix(mul(c, 1.6), [255, 236, 200], 0.38), line: mix(mul(c, 0.3), [20, 8, 8], 0.5) };
    return { base: c, shadow: mix(mul(c, 0.74), [90, 60, 80], 0.25), deep: mix(mul(c, 0.52), [70, 40, 60], 0.3), light: mix(c, [255, 250, 235], 0.25), hi: mix(c, [255, 255, 245], 0.55), line: mix(mul(c, 0.35), [40, 24, 20], 0.5) };
  }
  function clothTones(c) {
    c = hx(c); var L = lum(c);
    if (L < 50) return { base: c, shadow: mix(mul(c, 0.6), [8, 8, 16], 0.3), deep: mix(mul(c, 0.4), [4, 4, 10], 0.4), light: mix(mul(c, 1.35), [150, 150, 170], 0.18), hi: mix(mul(c, 1.8), [190, 190, 205], 0.3), line: [12, 10, 14] };
    return { base: c, shadow: mix(mul(c, 0.72), [60, 40, 80], 0.2), deep: mix(mul(c, 0.5), [40, 24, 50], 0.3), light: mix(c, [255, 244, 225], 0.18), hi: mix(c, [255, 250, 240], 0.4), line: mix(mul(c, 0.3), [24, 14, 14], 0.6) };
  }

  /* ---------- generic hair painter ----------
     mass: closed point list (screen), crown: screen point the strands spring from, tips: lock tips (screen),
     o: { layer, tones, sheen: [angle from, to] band, strands } */
  function paintMass(a, pts, T, o) {
    o = o || {};
    var d = smooth(pts, true, o.ten === undefined ? 0.85 : o.ten), S = a.S, cp = a.clip(d), s = '';
    var c = o.center || a.P(0, -0.6, 0.2);
    s += a.el(d, T.base);
    var inner = '';
    // light from upper left, form shadow lower right and underneath
    var b = bbox(pts);
    inner += a.el(d, a.lin(b.x0, b.y0, b.x1, b.y1, [[0, T.light, 0.55], [0.45, T.base, 0], [0.8, T.shadow, 0.7], [1, T.deep, 0.85]]));
    if (o.under) inner += o.under;
    // lock strands
    var rr = rnd(o.seed || 11);
    (o.strands || []).forEach(function (st) {
      inner += a.ink(st.pts, st.w || [0, 1.1, 0], { col: rgb(st.col || T.shadow), op: st.op === undefined ? 0.8 : st.op, per: 4 });
    });
    if (o.inner) inner += o.inner;
    s += a.g(inner, { clip: cp });
    if (o.line !== false) s += a.el(d, 'none', { stroke: rgb(T.line), sw: o.lw || 1.5, op: o.lineOp === undefined ? 0.9 : o.lineOp });
    a.add(o.layer || 'hair', s);
    return { d: d, clip: cp };
  }
  function bbox(pts) { var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }); return { x0: x0, y0: y0, x1: x1, y1: y1 }; }
  /* strand curve from a root to a tip, bulging away from the head */
  function strand(root, tip, bulge, n) {
    var m = mid(root, tip, 0.5), dx = tip[0] - root[0], dy = tip[1] - root[1], l = Math.hypot(dx, dy) || 1;
    var c = [m[0] - dy / l * bulge, m[1] + dx / l * bulge];
    return quad(root, c, tip, n || 6);
  }
  /* sheen: short light strokes following strands in a band */
  function sheen(list, T, t0, t1, w, op, col) {
    var s = '';
    list.forEach(function (st, i) {
      var p = st.pts, n = p.length, a0 = Math.floor(n * (t0 + (i % 3) * 0.03)), a1 = Math.ceil(n * (t1 - (i % 2) * 0.05));
      if (a1 - a0 < 2) return;
      s += '<path d="' + taper(p.slice(a0, a1), [0, w * (0.7 + (i % 3) * 0.2), 0], 3) + '" fill="' + rgb(col || T.hi) + '" opacity="' + (op * (0.6 + (i % 4) * 0.12)).toFixed(2) + '"/>';
    });
    return s;
  }
  /* cast shadow of the front hair on the skin */
  function hairShadow(a, pts, dx, dy, op) {
    var S = a.S;
    a.add('hairShadow', a.g(a.g(a.el(smooth(offset(pts, S * (dx || 0.05), S * (dy || 0.12)), true), a.mulTint(a.skin.deep), { op: op || 0.5 }), { clip: a.skinClip, blur: 2.2 }), { mode: 'multiply' }));
  }
  /* fringe edge across the forehead: alternating tips and notches on the head surface */
  function fringe(a, tips, dz) {
    var out = [];
    tips.forEach(function (t) { var p = a.on(t[0], t[1], dz === undefined ? 0.1 : dz); if (t[2]) p = K(p); out.push(p); });
    return out;
  }

  /* ---------- locks: a lock of hair is a tapered, slightly bent ribbon with its own light, highlight and ink ---------- */
  var LDIR = [-0.62, -0.78];
  function lockGeom(root, tip, w, bend, o) {
    o = o || {};
    var dx = tip[0] - root[0], dy = tip[1] - root[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    var c = [root[0] + dx * 0.5 + nx * bend * L, root[1] + dy * 0.5 + ny * bend * L];
    if (o.ctrl) c = o.ctrl;
    var n = 14, cen = quad(root, c, tip, n), Lp = [], Rp = [];
    var tipP = o.tipPow || 1.0, sw = o.swell === undefined ? 0.25 : o.swell, w1 = o.wTip || 0;
    for (var i = 0; i <= n; i++) {
      var t = i / n, a0 = cen[Math.max(i - 1, 0)], a1 = cen[Math.min(i + 1, n)], tx = a1[0] - a0[0], ty = a1[1] - a0[1], l = Math.hypot(tx, ty) || 1;
      var ww = (w * Math.pow(1 - t, tipP) * (1 + sw * Math.sin(Math.PI * t)) + w1 * t) / 2;
      Lp.push([cen[i][0] - ty / l * ww, cen[i][1] + tx / l * ww]); Rp.push([cen[i][0] + ty / l * ww, cen[i][1] - tx / l * ww]);
    }
    var tp = K(cen[n]);
    var pts = Lp.slice(0, n).concat([tp]).concat(Rp.slice(0, n).reverse());
    // which side faces the light
    var mx = -ty0(cen), lit = (Lp[n >> 1][0] - Rp[n >> 1][0]) * LDIR[0] + (Lp[n >> 1][1] - Rp[n >> 1][1]) * LDIR[1] > 0;
    return { pts: pts, cen: cen, litSide: lit ? Lp : Rp, darkSide: lit ? Rp : Lp, tip: cen[n] };
  }
  function ty0() { return 0; }
  function drawLock(a, layer, root, tip, w, bend, T, o) {
    o = o || {};
    var g = lockGeom(root, tip, w, bend, o), d = smooth(g.pts, true, 0.9), S = a.S, s = '';
    if (o.drop !== false) s += a.el(smooth(offset(g.pts, 1.6, 2.6), true), T.deep, { op: o.dropOp || 0.55, blur: 1.6 });
    s += a.el(d, o.fill || T.base);
    var inner = '';
    var c0 = g.litSide[7], c1 = g.darkSide[7];
    inner += a.el(d, a.lin(c0[0], c0[1], c1[0], c1[1], [[0, T.light, 0.75], [0.5, T.base, 0], [1, T.shadow, 0.85]]));
    // darker toward the root (where locks bury into the mass) and the tip
    var r0 = g.cen[0], r1 = g.cen[g.cen.length - 1];
    inner += a.el(d, a.lin(r0[0], r0[1], r1[0], r1[1], [[0, T.deep, o.rootDark === undefined ? 0.55 : o.rootDark], [0.3, T.base, 0], [0.85, T.base, 0], [1, T.shadow, 0.5]]));
    // highlight: two thin streaks along the lit half, plus fine strand lines
    var h0 = o.hi0 === undefined ? 0.18 : o.hi0, h1 = o.hi1 === undefined ? 0.62 : o.hi1, n0 = Math.round(h0 * 14), n1 = Math.round(h1 * 14);
    if (o.hi !== false && n1 - n0 > 2) {
      var hs = [], hs2 = [];
      for (var i = n0; i <= n1; i++) { hs.push(mid(g.cen[i], g.litSide[i], 0.5)); hs2.push(mid(g.cen[i], g.litSide[i], 0.05)); }
      inner += a.el(taper(hs, [0, Math.min(w * (o.hiW || 0.13), 2.6), 0], 3), T.hi, { op: o.hiOp || 0.7 });
      inner += a.el(taper(hs2.slice(2), [0, Math.min(w * 0.07, 1.3), 0], 3), T.hi, { op: (o.hiOp || 0.7) * 0.6 });
    }
    if (w > S * 0.14 && o.mid !== false) {
      inner += a.ink(g.cen.slice(2, 13).map(function (p, j) { return mid(p, g.darkSide[j + 2], 0.3); }), [0, 0.9, 0], { col: rgb(T.deep), op: 0.6 });
      inner += a.ink(g.cen.slice(4, 12).map(function (p, j) { return mid(p, g.litSide[j + 4], 0.75); }), [0, 0.6, 0], { col: rgb(T.shadow), op: 0.5 });
    }
    s += a.g(inner, { clip: a.clip(d) });
    // ink: firm on the shadow side and the tip, light on the lit side
    s += a.ink(g.darkSide.slice(2).concat([g.tip]), [0.2, (o.lw || 1.3), 0.7], { col: rgb(T.line), op: 0.9 });
    s += a.ink(g.litSide.slice(5).concat([g.tip]), [0.1, (o.lw || 1.3) * 0.6, 0.6], { col: rgb(T.line), op: 0.55 });
    a.add(layer, s);
    return g;
  }

  /* ================= HAIR STYLES ================= */
  var HAIR = {};
  /* Đorđe: thick shaggy black hair, heavy bangs over the eyes, messy strands, covers the ears */
  /* a bumpy (clumped) silhouette: angles a0..a1 with pads oscillating between p0 and p1 */
  function clumps(a, a0, a1, step, p0, p1, seed) {
    var r = rnd(seed || 3), out = [];
    for (var ang = a0, i = 0; ang <= a1 + 0.01; ang += step, i++) {
      var pad = (i % 2 ? p1 : p0) + (r() - 0.5) * 0.04;
      var pt = a.rim(ang, typeof pad === 'number' ? pad : pad);
      out.push(pt);
    }
    return out;
  }
  /* the sheen ring: short light streaks in a band, oriented from the crown outward */
  function sheenRing(a, crown, a0, a1, n, r0, r1, pad, T, o) {
    o = o || {};
    var r = rnd(o.seed || 9), s = '';
    for (var k = 0; k < n; k++) {
      var ang = a0 + (a1 - a0) * (k + r() * 0.6) / n, q = a.rim(ang, pad), st = strand(crown, q, -a.S * (o.bend || 0.12), 12);
      var lo = r0 + (r() - 0.5) * 0.12, hi = r1 + (r() - 0.5) * 0.12;
      var seg = st.slice(Math.floor(lo * 12), Math.ceil(hi * 12) + 1);
      if (seg.length > 2) s += a.el(taper(seg, [0, (o.w || 1.6) * (0.6 + r() * 0.8), 0], 3), o.col || T.hi, { op: (o.op || 0.6) * (0.5 + r() * 0.6) });
    }
    return s;
  }
  function strandLines(a, crown, a0, a1, n, r0, pad, T, o) {
    o = o || {};
    var r = rnd(o.seed || 4), s = '';
    for (var k = 0; k < n; k++) {
      var ang = a0 + (a1 - a0) * (k + r()) / n, q = a.rim(ang, pad), st = strand(crown, q, -a.S * (o.bend || 0.12), 12);
      s += a.ink(st.slice(Math.floor((r0 + r() * 0.15) * 12)), [0, o.w || 1.1, 0.2], { col: rgb(o.col || T.deep), op: (o.op || 0.6) * (0.6 + r() * 0.5) });
    }
    return s;
  }
  /* Đorđe: thick shaggy black hair, heavy bangs over the eyes, messy strands, covers the ears */
  HAIR.shaggy = function (a, c, o) {
    var S = a.S, T = hairTones(c), young = a.pd.face === 'small', r = rnd(7);
    var sideY = young ? 0.5 : 0.62;
    // base mass hugging the skull, with a clumpy outline
    var cap = clumps(a, 150, 392, 10, 0.17, 0.25, 5);
    var capIn = a.onL([[1.0, 0.3], [0.92, -0.3], [0.75, -0.85], [0.3, -1.05], [-0.3, -1.05], [-0.82, -0.8], [-1.0, -0.2], [-1.05, 0.35]], 0.05);
    var capPts = cap.concat(capIn);
    var crown = a.P(0.25, -1.45, -0.2);
    var inner = '';
    inner += strandLines(a, crown, 160, 380, 22, 0.45, 0.25, T, { op: 0.7 });
    inner += sheenRing(a, crown, 196, 320, 26, 0.42, 0.66, 0.22, T, { w: 2.2, op: 0.7 });
    inner += sheenRing(a, crown, 200, 300, 14, 0.5, 0.62, 0.22, T, { w: 1.2, op: 0.6, col: mix(T.hi, [220, 225, 240], 0.4), seed: 21 });
    paintMass(a, capPts, T, { inner: inner, center: crown, lw: 1.6, layer: 'hair', ten: 1 });
    // back hair behind the neck and ears
    var back = [a.rim(150, 0.15), a.P(-1.15, sideY + 0.25, -0.4), a.P(-0.7, sideY + 0.5, -0.85), a.P(0.4, sideY + 0.45, -0.9), a.P(1.0, sideY + 0.2, -0.5), a.rim(32, 0.12), a.rim(270, 0.2)];
    a.add('hairBack', a.el(smooth(back, true), T.deep) + a.el(smooth(back, true), 'none', { stroke: rgb(T.line), sw: 1.4 }));
    // a few flyaway clumps on the top and back of the head
    [[176, 0.36, 0.14], [206, 0.32, -0.12], [334, 0.3, 0.14], [356, 0.3, -0.1]].forEach(function (q, i) {
      var tip = a.rim(q[0], q[1]), root = a.rim(q[0] + (i % 2 ? 16 : -16), 0.0);
      drawLock(a, 'hair', root, tip, S * 0.3, q[2], T, { hiOp: 0.4, drop: false, rootDark: 0.0, tipPow: 1.2, mid: false });
    });
    // side locks over the ears (near side) and down the far cheek
    var sides = [[-1.0, -0.5, -1.16, sideY + 0.1, 0.1, 0.38], [-0.95, -0.6, -1.05, sideY + 0.18, 0.06, 0.34], [-0.88, -0.55, -0.94, sideY - 0.04, -0.02, 0.3], [-0.8, -0.6, -0.84, sideY - 0.22, -0.08, 0.26],
      [0.86, -0.6, 0.92, sideY - 0.1, 0.06, 0.3], [0.94, -0.5, 1.02, sideY + 0.06, -0.06, 0.34]];
    sides.forEach(function (q) { drawLock(a, 'hair', a.on(q[0], q[1], 0.2), a.on(q[2], q[3], 0.1), S * q[5], q[4], T, { hi0: 0.12, hi1: 0.42, hiOp: 0.6 }); });
    // the fringe: heavy locks from the top of the head down over the brows, parted a little right of centre
    var lo = young ? 0.04 : 0;
    var fr = [[-0.92, 0.06], [0.9, 0.0], [-0.68, -0.03], [0.68, -0.05], [-0.44, -0.16], [0.44, -0.17], [-0.2, -0.05], [0.24, -0.1], [0.03, 0.04]];
    fr.forEach(function (q, i) {
      var part = 0.12, side = q[0] < part ? -1 : 1;
      var root = a.on(part + (q[0] - part) * 0.45, -1.2, 0.36), tip = a.on(q[0] + side * 0.04, q[1] + lo + (r() - 0.5) * 0.04, 0.12);
      drawLock(a, 'hair', root, tip, S * (0.36 + r() * 0.08), side * -0.07, T, { hi0: 0.1, hi1: 0.4, hiOp: 0.75, tipPow: 0.9, lw: 1.4 });
    });
    // fringe cast shadow on the face
    var shp = [a.on(-1.0, -1.0, 0.1)].concat(fr.slice().sort(function (p, q) { return p[0] - q[0]; }).map(function (q) { return a.on(q[0], q[1] + 0.1, 0.1); })).concat([a.on(1.0, -1.0, 0.1)]);
    a.add('hairShadow', a.g(a.g(a.el(smooth(shp, true), a.mulTint(a.skin.deep), { op: 0.75 }), { clip: a.skinClip, blur: 2.6 }), { mode: 'multiply' }));
    // stray strands
    var wis = [[[0.14, -0.6], [0.2, -0.25], [0.15, 0.08]], [[-0.3, -0.6], [-0.36, -0.25], [-0.31, 0.06]], [[0.6, -0.5], [0.66, -0.2], [0.72, 0.06]], [[-0.92, -0.3], [-1.08, 0.2], [-1.14, 0.75]], [[0.95, -0.3], [1.05, 0.2], [1.06, 0.6]]];
    if (young) wis = wis.slice(0, 2);
    wis.forEach(function (w) { a.add('hairTop', a.ink(a.onL(w, 0.15), [1.2, 0.9, 0.05], { col: rgb(T.line) })); });
  };

  /* generic cap: clumpy outline over the skull plus a hairline across the face */
  function capMass(a, T, o) {
    var S = a.S, r = rnd(o.seed || 3);
    var cap = clumps(a, o.a0 || 150, o.a1 || 390, o.step || 10, o.p0 === undefined ? 0.14 : o.p0, o.p1 === undefined ? 0.2 : o.p1, o.seed || 5);
    var line = a.onL(o.hairline, o.lift === undefined ? 0.06 : o.lift);
    var crown = o.crown || a.P(0.2, -1.5, -0.3);
    var inner = '';
    inner += strandLines(a, crown, (o.a0 || 150) + 6, (o.a1 || 390) - 6, o.nLines || 22, 0.42, o.p1 || 0.2, T, { op: o.lineOp || 0.6, bend: o.bend });
    inner += sheenRing(a, crown, o.sh0 || 196, o.sh1 || 315, o.nSheen || 24, o.r0 || 0.42, o.r1 || 0.66, (o.p1 || 0.2), T, { w: o.shW || 2.0, op: o.shOp || 0.65, bend: o.bend });
    // flow lines from the hairline back toward the crown
    if (o.sweep) for (var k = 0; k < o.sweep; k++) {
      var t = (k + 0.5) / o.sweep, i = Math.min(line.length - 1, Math.floor(t * (line.length - 1))), p = mid(line[i], line[Math.min(i + 1, line.length - 1)], t * (line.length - 1) - i);
      inner += a.ink(strand(p, crown, a.S * 0.15 * (t < 0.5 ? 1 : -1), 10).slice(0, 7), [0.2, 1.0, 0], { col: rgb(T.deep), op: 0.55 });
      inner += a.el(taper(strand(p, crown, a.S * 0.15 * (t < 0.5 ? 1 : -1), 10).slice(1, 5).map(function (q) { return [q[0] - 1.2, q[1] - 0.6]; }), [0, 1.4, 0], 3), T.hi, { op: 0.45 });
    }
    if (o.inner) inner += o.inner;
    return paintMass(a, cap.concat(line), T, { inner: inner, center: crown, lw: o.lw || 1.5, layer: o.layer || 'hair', ten: 1 });
  }
  function hairBackMass(a, T, pts, o) {
    o = o || {};
    var d = smooth(pts, true), b = bbox(pts);
    var s = a.el(d, T.shadow) + a.g(a.el(d, a.lin(b.x0, b.y0, b.x1, b.y1, [[0, T.base], [0.6, T.shadow], [1, T.deep]])) + (o.inner || ''), { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.4 });
    a.add(o.layer || 'hairBack', s);
  }
  function wisp(a, pts, T, layer, w) { a.add(layer || 'hairTop', a.ink(pts, [w || 1.1, (w || 1.1) * 0.8, 0.05], { col: rgb(T.line), op: 0.9 }) + a.ink(offset(pts, -0.5, -0.4), [0.3, 0.5, 0], { col: rgb(T.light), op: 0.6 })); }

  /* Jaglika: copper bob with straight bangs */
  HAIR.bob = function (a, c, o) {
    var S = a.S, T = hairTones(c), r = rnd(12);
    hairBackMass(a, T, [a.rim(150, 0.3), a.P(-1.28, 1.1, -0.2), a.P(-1.05, 1.26, -0.6), a.P(0.9, 1.22, -0.6), a.P(1.2, 1.05, -0.1), a.rim(30, 0.3), a.rim(270, 0.3)]);
    capMass(a, T, { p0: 0.22, p1: 0.28, a0: 150, a1: 390, hairline: [[1.05, 0.3], [0.95, -0.5], [0.4, -1.0], [-0.4, -1.0], [-0.95, -0.5], [-1.08, 0.3]], seed: 4, nSheen: 28, shW: 2.4 });
    // side curtains ending at the jaw, curving under
    var sides = [[-0.98, -0.75, -1.22, 1.12, -0.06, 0.5], [-0.92, -0.7, -1.08, 1.2, -0.08, 0.46], [-0.86, -0.6, -0.95, 1.1, -0.1, 0.38], [0.86, -0.65, 0.94, 1.08, 0.1, 0.36], [0.94, -0.7, 1.08, 1.15, 0.08, 0.42]];
    sides.forEach(function (q) { drawLock(a, 'hair', a.on(q[0], q[1], 0.3), a.on(q[2], q[3], q[2] < 0 ? -0.05 : 0.0), S * q[5], q[4], T, { hi0: 0.1, hi1: 0.45, tipPow: 0.55, wTip: S * 0.08, hiOp: 0.7 }); });
    // straight bangs just above the brows
    var by = (o.bangY || -0.44);
    [[-0.82, by + 0.04], [0.82, by], [-0.55, by + 0.02], [0.55, by - 0.01], [-0.27, by + 0.03], [0.27, by + 0.01], [0.0, by + 0.04]].forEach(function (q) {
      drawLock(a, 'hair', a.on(q[0] * 0.55, -1.25, 0.4), a.on(q[0], q[1] + (r() - 0.5) * 0.03, 0.14), S * 0.42, (q[0] < 0 ? 0.04 : -0.04), T, { tipPow: 0.5, wTip: S * 0.12, hi0: 0.08, hi1: 0.45, hiOp: 0.75 });
    });
    var shp = [a.on(-1.1, -1.1, 0.1), a.on(-0.85, by + 0.12, 0.1), a.on(0, by + 0.14, 0.1), a.on(0.85, by + 0.1, 0.1), a.on(1.1, -1.1, 0.1)];
    a.add('hairShadow', a.g(a.g(a.el(smooth(shp, true), a.mulTint(a.skin.deep), { op: 0.65 }), { clip: a.skinClip, blur: 2.4 }), { mode: 'multiply' }));
    var shs = [a.on(-1.2, -0.5, 0), a.on(-0.84, 0.0, 0), a.on(-0.86, 1.0, 0), a.on(-1.3, 1.2, 0)];
    a.add('hairShadow', a.g(a.g(a.el(smooth(shs, true), a.mulTint(a.skin.deep), { op: 0.5 }), { clip: a.skinClip, blur: 2.4 }), { mode: 'multiply' }));
  };

  /* short boyish hair: tousled for kids, neat for men; o.volume, o.fringeY, o.recede */
  HAIR.short = function (a, c, o) {
    var S = a.S, T = hairTones(c), r = rnd(31), kid = /boy|girl|small/.test(a.pd.face), messy = o.messy || (kid ? 1 : 0);
    var vol = o.volume || 0, fy = o.fringeY || (kid ? -0.58 : -0.8);
    var hl = [[1.02, 0.1], [0.98, -0.45], [0.82, -0.82], [0.45, fy - 0.2], [0, fy - 0.24], [-0.45, fy - 0.2], [-0.84, -0.8], [-1.0, -0.4], [-1.04, 0.12]];
    if (o.cap) hl = [[1.02, -0.2], [0.9, -0.62], [0.6, -0.78], [-0.6, -0.78], [-0.9, -0.62], [-1.02, -0.2]];
    capMass(a, T, { p0: 0.1 + vol + messy * 0.04, p1: 0.15 + vol + messy * 0.08, a0: 150, a1: 392, hairline: hl, seed: 8, nSheen: 22, shW: 1.8, step: messy ? 9 : 12 });
    hairBackMass(a, T, [a.rim(150, 0.12), a.P(-1.05, 0.45, -0.5), a.P(-0.6, 0.62, -0.9), a.P(0.5, 0.6, -0.9), a.P(1.0, 0.4, -0.5), a.rim(30, 0.1), a.rim(270, 0.15)]);
    if (o.cap) return;
    // sideburns in front of the ear
    [-1, 1].forEach(function (sd) {
      var sb = [a.on(sd * 0.98, -0.35, 0.04), a.on(sd * 0.86, -0.3, 0.04), a.on(sd * (kid ? 0.9 : 0.88), kid ? 0.05 : 0.22, 0.03), a.on(sd * 0.97, kid ? 0.1 : 0.26, 0.02)];
      a.add('hair', a.el(smooth(sb, true), T.shadow) + a.ink(sb.slice(1, 3), [0.3, 1.0, 0.2], { col: rgb(T.line), op: 0.7 }));
    });
    // fringe locks
    var n = messy ? 7 : 5, part = o.part === undefined ? -0.25 : o.part;
    for (var i = 0; i < n; i++) {
      var X = -0.85 + 1.7 * (i + 0.5) / n, side = X < part ? -1 : 1;
      var tipY = fy + (messy ? (r() - 0.3) * 0.18 : 0.06 * Math.abs(X));
      var root = a.on(X * 0.5 + part * 0.2, -1.35, 0.42), tip = a.on(X + side * (messy ? 0.12 : 0.22), tipY, 0.12);
      drawLock(a, 'hair', root, tip, S * (messy ? 0.4 : 0.46), side * (messy ? (r() - 0.5) * 0.3 : -0.08), T, { tipPow: messy ? 0.9 : 1.1, hi0: 0.1, hi1: 0.5, hiOp: 0.7, lw: 1.2 });
    }
    if (messy) [[178, 0.3, 0.12], [214, 0.28, -0.1], [330, 0.26, 0.12], [356, 0.24, -0.08]].forEach(function (q, i) {
      drawLock(a, 'hair', a.rim(q[0] + (i % 2 ? 14 : -14), 0.02), a.rim(q[0], q[1]), S * 0.26, q[2], T, { hiOp: 0.4, drop: false, rootDark: 0, tipPow: 1.2, mid: false });
    });
    var shp = [a.on(-1.05, -1.2, 0.1), a.on(-0.85, fy + 0.0, 0.1), a.on(0, fy + 0.1, 0.1), a.on(0.85, fy + 0.05, 0.1), a.on(1.05, -1.2, 0.1)];
    a.add('hairShadow', a.g(a.g(a.el(smooth(shp, true), a.mulTint(a.skin.deep), { op: 0.55 }), { clip: a.skinClip, blur: 2.4 }), { mode: 'multiply' }));
  };
  /* receding crop (Gorazd without his cap) */
  HAIR.crop = function (a, c, o) {
    var T = hairTones(c), r = rnd(5), S = a.S;
    capMass(a, T, { p0: 0.07, p1: 0.09, a0: 150, a1: 390, step: 14, hairline: [[1.02, 0.15], [0.98, -0.5], [0.78, -0.72], [0.5, -1.12], [0.15, -1.02], [-0.15, -1.04], [-0.5, -1.14], [-0.8, -0.74], [-1.0, -0.5], [-1.04, 0.15]], seed: 6, nSheen: 10, shOp: 0.35, nLines: 30, lineOp: 0.5 });
    hairBackMass(a, T, [a.rim(150, 0.08), a.P(-1.02, 0.4, -0.5), a.P(-0.6, 0.55, -0.9), a.P(0.5, 0.55, -0.9), a.P(1.0, 0.35, -0.5), a.rim(30, 0.08), a.rim(270, 0.1)]);
    // scalp showing through on top
    var top = a.on(0.0, -1.2, 0.02);
    a.add('hairTop', '<ellipse cx="' + f(top[0]) + '" cy="' + f(top[1]) + '" rx="' + f(S * 0.32) + '" ry="' + f(S * 0.14) + '" fill="' + rgb(a.skin.base) + '" opacity="0.35" filter="url(#' + a.blur(2) + ')"/>');
    [-1, 1].forEach(function (sd) {
      var sb = [a.on(sd * 0.98, -0.4, 0.03), a.on(sd * 0.88, -0.35, 0.03), a.on(sd * 0.88, 0.2, 0.02), a.on(sd * 0.97, 0.24, 0.02)];
      a.add('hair', a.el(smooth(sb, true), T.shadow, { op: 0.9 }));
    });
  };
  /* bald crown with a fringe of hair around the back and sides (Dragan) */
  HAIR.bald = function (a, c, o) {
    var T = hairTones(c), S = a.S;
    var band = a.rims([[148, 0.08], [165, 0.12], [182, 0.13], [196, 0.1]]).concat(a.onL([[-1.0, -0.5], [-0.95, -0.3], [-0.92, 0.0], [-0.95, 0.2]], 0.03));
    paintMass(a, band, T, { lw: 1.2, ten: 0.9, inner: strandLines(a, a.P(-0.5, -0.5, -0.8), 140, 200, 10, 0.3, 0.12, T, { op: 0.5 }) });
    var fb = a.rims([[18, 0.06], [8, 0.1], [355, 0.1], [345, 0.07]]).concat(a.onL([[0.98, -0.42], [0.92, -0.2], [0.92, 0.1]], 0.03));
    paintMass(a, fb, T, { lw: 1.2, ten: 0.9 });
    hairBackMass(a, T, [a.rim(148, 0.08), a.P(-1.02, 0.4, -0.5), a.P(-0.6, 0.55, -0.9), a.P(0.5, 0.55, -0.9), a.P(1.0, 0.35, -0.5), a.rim(25, 0.05), a.rim(200, 0.1)]);
    // shine on the scalp
    var hp = a.on(-0.3, -1.15, 0.02);
    a.add('hairTop', '<ellipse cx="' + f(hp[0]) + '" cy="' + f(hp[1]) + '" rx="' + f(S * 0.4) + '" ry="' + f(S * 0.2) + '" transform="rotate(-20 ' + f(hp[0]) + ' ' + f(hp[1]) + ')" fill="' + rgb(a.skin.hi) + '" opacity="0.55" filter="url(#' + a.blur(3) + ')"/>');
    var o2 = a.outline();
    a.add('hairTop', a.ink(o2.L.slice(2, Math.floor(o2.L.length * 0.3)).concat(o2.R.slice(0, Math.floor(o2.R.length * 0.3)).reverse()).reverse(), [0.8, 1.6, 0.8]));
  };
  /* Jessica: blonde pixie with a side-swept fringe */
  HAIR.pixie = function (a, c, o) {
    var S = a.S, T = hairTones(c), r = rnd(17);
    capMass(a, T, { p0: 0.16, p1: 0.22, a0: 152, a1: 388, step: 9, hairline: [[1.02, 0.05], [0.96, -0.5], [0.6, -0.9], [-0.2, -1.0], [-0.85, -0.78], [-1.02, -0.3], [-1.04, 0.1]], seed: 22, nSheen: 26, shW: 2.2 });
    hairBackMass(a, T, [a.rim(150, 0.16), a.P(-1.05, 0.55, -0.5), a.P(-0.6, 0.7, -0.9), a.P(0.5, 0.65, -0.9), a.P(1.0, 0.4, -0.5), a.rim(30, 0.12), a.rim(270, 0.2)]);
    // layered side pieces over the ears
    [[-0.98, -0.6, -1.08, 0.18, 0.06, 0.32], [-0.9, -0.6, -0.96, 0.08, -0.04, 0.28], [0.9, -0.6, 0.98, 0.06, -0.06, 0.3]].forEach(function (q) { drawLock(a, 'hair', a.on(q[0], q[1], 0.2), a.on(q[2], q[3], 0.06), S * q[5], q[4], T, { hiOp: 0.6 }); });
    // the swept fringe
    [[-0.4, -1.25, 0.86, -0.32, 0.5], [-0.5, -1.2, 0.58, -0.38, 0.46], [-0.6, -1.15, 0.3, -0.48, 0.42], [-0.62, -1.05, 0.02, -0.56, 0.36], [-0.7, -1.0, -0.3, -0.62, 0.32]].forEach(function (q, i) {
      drawLock(a, 'hair', a.on(q[0], q[1], 0.4), a.on(q[2], q[3], 0.14), S * q[4], -0.12, T, { tipPow: 1.0, hi0: 0.15, hi1: 0.55, hiOp: 0.75 });
    });
    var shp = [a.on(-1.0, -1.2, 0.1), a.on(-0.5, -0.55, 0.1), a.on(0.3, -0.38, 0.1), a.on(0.9, -0.22, 0.1), a.on(1.05, -1.2, 0.1)];
    a.add('hairShadow', a.g(a.g(a.el(smooth(shp, true), a.mulTint(a.skin.deep), { op: 0.5 }), { clip: a.skinClip, blur: 2.4 }), { mode: 'multiply' }));
  };
  /* hair pulled back: ponytail (Lisa) or bun (Stana, Zlatko) */
  function pulledBack(a, T, o) {
    var S = a.S, part = o.part === undefined ? -0.3 : o.part;
    var hl = [[1.02, 0.1], [0.97, -0.45], [0.8, -0.8], [0.4, -0.98], [part, -1.04], [-0.45, -0.97], [-0.84, -0.78], [-1.0, -0.4], [-1.04, 0.12]];
    capMass(a, T, { p0: 0.1, p1: 0.13, a0: 150, a1: 390, step: 14, hairline: hl, seed: 13, sweep: 9, crown: a.P(-0.2, -1.2, -0.95), nSheen: 22, nLines: 14, shW: 1.8 });
    // the part
    a.add('hairTop', a.ink([a.on(part, -1.04, 0.07), a.on(part * 0.8, -1.3, 0.1), a.on(part * 0.6, -1.5, 0.05)], [0.8, 1.1, 0.2], { col: rgb(T.deep), op: 0.8 }));
    // loose strands at the temples
    wisp(a, a.onL([[-0.9, -0.75], [-1.0, -0.3], [-0.98, 0.1]], 0.08), T, 'hairTop', 0.9);
    wisp(a, a.onL([[0.85, -0.75], [0.95, -0.35], [0.92, -0.05]], 0.08), T, 'hairTop', 0.8);
    hairBackMass(a, T, [a.rim(150, 0.1), a.P(-1.02, 0.42, -0.5), a.P(-0.6, 0.55, -0.9), a.P(0.5, 0.55, -0.9), a.P(1.0, 0.35, -0.5), a.rim(30, 0.08), a.rim(270, 0.12)]);
  }
  HAIR.ponytail = function (a, c, o) {
    var S = a.S, T = hairTones(c);
    pulledBack(a, T, o);
    // the tail falls behind the near shoulder
    var root = a.rim(206, 0.1), tip = a.P(-1.75, 2.6, -0.9);
    drawLock(a, 'hairBack', root, tip, S * 0.62, 0.18, T, { tipPow: 0.9, swell: 0.6, hi0: 0.1, hi1: 0.55, hiOp: 0.6 });
    drawLock(a, 'hairBack', mid(root, tip, 0.15), [tip[0] - S * 0.1, tip[1] - S * 0.3], S * 0.3, 0.3, T, { tipPow: 1, hiOp: 0.5, drop: false });
    var tie = mid(root, tip, 0.1);
    a.add('hairBack', '<ellipse cx="' + f(tie[0]) + '" cy="' + f(tie[1]) + '" rx="' + f(S * 0.16) + '" ry="' + f(S * 0.09) + '" transform="rotate(60 ' + f(tie[0]) + ' ' + f(tie[1]) + ')" fill="#2a2228" stroke="#120c0e" stroke-width="1"/>');
  };
  HAIR.bun = function (a, c, o) {
    var S = a.S, T = hairTones(c);
    // the bun sits high at the back
    var bc = a.rim(o.bunAng || 218, 0.32), R = S * 0.42, pts = [];
    for (var k = 0; k < 14; k++) { var t = k / 14 * Math.PI * 2; pts.push([bc[0] + Math.cos(t) * R * (1 + 0.06 * Math.sin(t * 3)), bc[1] + Math.sin(t) * R * 0.88]); }
    var inner = '';
    for (k = 0; k < 7; k++) { var ang = k / 7 * Math.PI * 2; inner += a.ink([[bc[0] + Math.cos(ang) * R * 0.15, bc[1] + Math.sin(ang) * R * 0.15], [bc[0] + Math.cos(ang + 0.9) * R * 0.6, bc[1] + Math.sin(ang + 0.9) * R * 0.55], [bc[0] + Math.cos(ang + 1.6) * R * 0.95, bc[1] + Math.sin(ang + 1.6) * R * 0.85]], [0, 1.2, 0.2], { col: rgb(T.deep), op: 0.7 }); }
    inner += a.el(taper([[bc[0] - R * 0.7, bc[1] - R * 0.1], [bc[0] - R * 0.4, bc[1] - R * 0.6], [bc[0] + R * 0.2, bc[1] - R * 0.75]], [0, 2.4, 0], 4), T.hi, { op: 0.6 });
    paintMass(a, pts, T, { layer: 'hairBack', inner: inner, lw: 1.5 });
    pulledBack(a, T, o);
  };
  /* braid over the near shoulder (Vesna, Mila) */
  HAIR.braid = function (a, c, o) {
    var S = a.S, T = hairTones(c);
    pulledBack(a, T, { part: 0.05 });
    var p0 = a.P(-0.95, 0.5, -0.35), p1 = a.bp ? a.bp(-1.25, 0.6) : [p0[0] - S * 0.3, p0[1] + S * 1.2], p2 = a.bp ? a.bp(-1.0, 1.6) : [p0[0], p0[1] + S * 2.4];
    var path = spline([a.P(-0.98, 0.1, -0.4), p0, p1, p2], 4), s = '';
    var n = path.length;
    for (var i = 0; i < n - 1; i++) {
      var q = path[i], q2 = path[i + 1], w = S * 0.3 * (1 - i / n * 0.45), sd = i % 2 ? 1 : -1;
      var dx = q2[0] - q[0], dy = q2[1] - q[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      var c1 = [q[0] + nx * w * 0.55 * sd, q[1] + ny * w * 0.55 * sd], tipP = [q2[0] - nx * w * 0.35 * sd + dx * 0.6, q2[1] - ny * w * 0.35 * sd + dy * 0.6];
      var lobe = [[q[0] - nx * w * 0.5 * sd, q[1] - ny * w * 0.5 * sd], c1, [q2[0] + nx * w * 0.5 * sd + dx * 0.4, q2[1] + ny * w * 0.5 * sd + dy * 0.4], tipP];
      var d = smooth(lobe, true);
      s += a.el(d, T.base) + a.g(a.el(d, a.lin(c1[0], c1[1], tipP[0], tipP[1], [[0, T.light], [1, T.deep]])), { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1 });
    }
    var end = path[n - 1];
    // ribbon and tassel
    var rc = o.ribbon || a.def.ribbon || [176, 48, 48];
    s += a.ink([end, [end[0] - S * 0.05, end[1] + S * 0.3], [end[0] + S * 0.02, end[1] + S * 0.5]], [S * 0.18, S * 0.12, 0], { col: rgb(T.base) });
    s += '<ellipse cx="' + f(end[0]) + '" cy="' + f(end[1]) + '" rx="' + f(S * 0.15) + '" ry="' + f(S * 0.07) + '" fill="' + rgb(rc) + '" stroke="#2a0e0e" stroke-width="1"/>';
    s += a.ink([end, [end[0] + S * 0.2, end[1] + S * 0.18], [end[0] + S * 0.22, end[1] + S * 0.4]], [2.4, 2.0, 0.6], { col: rgb(rc) });
    a.add('bodyTop', s);
  };
  /* Milka: dark wavy shoulder-length hair going grey, side part */
  HAIR.wavy = function (a, c, o) {
    var S = a.S, T = hairTones(c), r = rnd(41), grey = a.pd.grey || 0;
    var Tg = hairTones(mix(c, [190, 186, 180], 0.55));
    hairBackMass(a, T, [a.rim(150, 0.38), a.P(-1.5, 1.4, -0.3), a.P(-1.35, 2.0, -0.5), a.P(-0.6, 2.05, -0.9), a.P(0.8, 1.95, -0.8), a.P(1.4, 1.6, -0.2), a.rim(30, 0.36), a.rim(270, 0.35)]);
    var part = -0.35;
    capMass(a, T, { p0: 0.26, p1: 0.32, a0: 148, a1: 392, step: 13, hairline: [[1.04, 0.2], [0.96, -0.4], [0.75, -0.82], [0.2, -1.0], [part, -1.05], [-0.7, -0.9], [-0.98, -0.5], [-1.06, 0.2]], seed: 19, sweep: 6, crown: a.P(part, -1.6, 0.2), nSheen: 18, shW: 2.2, inner: grey ? strandLines(a, a.P(part, -1.5, 0.3), 160, 380, 14, 0.25, 0.3, Tg, { col: Tg.light, op: 0.6 * grey * 2, w: 1.3 }) : '' });
    // waves down both sides
    var L = [[-0.98, -0.6, -1.42, 1.85, 0.14, 0.5], [-0.92, -0.5, -1.25, 1.95, -0.12, 0.44], [-0.85, -0.4, -1.05, 1.75, 0.1, 0.38], [0.88, -0.5, 1.2, 1.72, -0.12, 0.4], [0.95, -0.55, 1.36, 1.6, 0.12, 0.44]];
    L.forEach(function (q, i) {
      var root = a.on(q[0], q[1], 0.3), tip = a.on(q[2], q[3], -0.25), m = mid(root, tip, 0.5);
      var ctrl = [m[0] + (i % 2 ? -1 : 1) * S * 0.25 * (q[0] < 0 ? 1 : -1), m[1]];
      drawLock(a, 'hair', root, tip, S * q[5], q[4], i % 3 === 1 && grey ? Tg : T, { hi0: 0.12, hi1: 0.5, tipPow: 0.8, hiOp: 0.6, ctrl: ctrl });
    });
    // the swept wave across the forehead from the part
    drawLock(a, 'hair', a.on(part, -1.15, 0.4), a.on(0.95, -0.55, 0.12), S * 0.55, -0.16, T, { tipPow: 1.1, hi0: 0.15, hi1: 0.6, hiOp: 0.7 });
    drawLock(a, 'hair', a.on(part - 0.1, -1.1, 0.35), a.on(-1.0, -0.4, 0.12), S * 0.44, 0.14, grey ? Tg : T, { tipPow: 1.1, hiOp: 0.6 });
    var shp = [a.on(-1.1, -1.2, 0.1), a.on(-0.9, -0.45, 0.1), a.on(0.0, -0.72, 0.1), a.on(0.95, -0.45, 0.1), a.on(1.1, -1.2, 0.1)];
    a.add('hairShadow', a.g(a.g(a.el(smooth(shp, true), a.mulTint(a.skin.deep), { op: 0.5 }), { clip: a.skinClip, blur: 2.4 }), { mode: 'multiply' }));
    var shs = [a.on(-1.2, -0.5, 0), a.on(-0.84, 0.0, 0), a.on(-0.86, 1.2, 0), a.on(-1.3, 1.4, 0)];
    a.add('hairShadow', a.g(a.g(a.el(smooth(shs, true), a.mulTint(a.skin.deep), { op: 0.45 }), { clip: a.skinClip, blur: 2.4 }), { mode: 'multiply' }));
  };
  /* Father Sava: long grey hair gathered back under the kamilavka */
  HAIR.priest = function (a, c, o) {
    var S = a.S, T = hairTones(c);
    hairBackMass(a, T, [a.rim(160, 0.15), a.P(-1.3, 1.2, -0.4), a.P(-1.1, 2.4, -0.8), a.P(0.6, 2.3, -0.9), a.P(1.2, 1.1, -0.4), a.rim(20, 0.12), a.rim(270, 0.2)]);
    capMass(a, T, { p0: 0.12, p1: 0.16, a0: 150, a1: 390, step: 14, hairline: [[1.03, 0.2], [0.98, -0.45], [0.75, -0.85], [0, -1.0], [-0.75, -0.85], [-1.0, -0.45], [-1.05, 0.2]], seed: 3, sweep: 7, crown: a.P(0, -1.3, -0.9), nSheen: 14 });
    drawLock(a, 'hair', a.on(-0.96, -0.7, 0.2), a.on(-1.22, 1.25, -0.2), S * 0.45, 0.06, T, { hiOp: 0.55, tipPow: 0.8 });
    drawLock(a, 'hair', a.on(0.92, -0.7, 0.2), a.on(1.05, 1.0, -0.2), S * 0.32, -0.06, T, { hiOp: 0.5, tipPow: 0.8 });
  };

  /* head-wrap (Jaglika late): navy cloth wound around the head with folds and a knot */
  HAIR.wrap = function (a, c, o) {
    var S = a.S, T = clothTones(c), Tl = clothTones(mix(c, [120, 140, 190], 0.18));
    var out = a.rims([[148, 0.12], [160, 0.24], [178, 0.32], [198, 0.38], [222, 0.42], [248, 0.44], [272, 0.44], [296, 0.42], [320, 0.38], [342, 0.3], [0, 0.22], [16, 0.12], [26, 0.04]]);
    var edge = a.onL([[0.98, 0.12], [0.95, -0.35], [0.75, -0.66], [0.3, -0.76], [-0.3, -0.76], [-0.8, -0.64], [-1.0, -0.3], [-1.04, 0.16]], 0.1);
    var pts = out.concat(edge), d = smooth(pts, true, 0.9), b = bbox(pts), inner = '';
    inner += a.el(d, a.lin(b.x0, b.y0, b.x1, b.y1, [[0, Tl.light, 0.7], [0.5, T.base, 0], [1, T.deep, 0.8]]));
    // wound bands: each fold is a curve from the lower left up across the head to the knot
    var knot = a.on(0.18, -1.32, 0.55);
    var bands = [[-1.0, 0.0, 0.0], [-0.98, -0.42, 0.04], [-0.75, -0.72, 0.1], [0.98, -0.1, 0.0], [0.85, -0.55, 0.08], [0.4, -0.8, 0.12]];
    bands.forEach(function (q, i) {
      var st = a.on(q[0], q[1], 0.12), m = a.on(q[0] * 0.55, (q[1] - 1.3) / 2, 0.4 + q[2]);
      var cv = quad(st, m, knot, 10);
      inner += a.el(taper(cv.slice(0, 9), [S * 0.05, S * 0.11, S * 0.02], 3), T.deep, { op: 0.6, blur: 0.8 });
      inner += a.el(taper(offset(cv.slice(1, 8), -S * 0.05, -S * 0.04), [0, S * 0.06, 0], 3), Tl.hi, { op: 0.35 });
      inner += a.ink(cv.slice(0, 9), [0.4, 1.2, 0.3], { col: rgb(T.line), op: 0.7 });
    });
    // the fold along the lower edge, rolled over the forehead
    inner += a.el(taper(offset(edge.slice(2, 6), 0, -S * 0.1), [S * 0.04, S * 0.1, S * 0.04], 3), Tl.light, { op: 0.4 });
    a.add('hair', a.el(d, T.base) + a.g(inner, { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.6 }));
    // knot: two twisted lobes and a tucked end
    var k = '';
    [[-0.32, -0.1, 0.34, 0.2, -20], [0.18, -0.05, 0.32, 0.22, 25], [-0.02, 0.06, 0.2, 0.16, 0]].forEach(function (q) {
      var cx = knot[0] + S * q[0], cy = knot[1] + S * q[1], rx = S * q[2], ry = S * q[3];
      var e = '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" transform="rotate(' + q[4] + ' ' + f(cx) + ' ' + f(cy) + ')"';
      k += e + ' fill="' + rgb(T.base) + '"/>' + e + ' fill="' + a.rad(cx - rx * 0.4, cy - ry * 0.5, rx * 1.3, [[0, Tl.light], [0.6, T.base], [1, T.deep]]) + '"/>' + e + ' fill="none" stroke="' + rgb(T.line) + '" stroke-width="1.3"/>';
    });
    k += a.ink([[knot[0] - S * 0.08, knot[1] - S * 0.12], [knot[0] + S * 0.02, knot[1] + S * 0.02], [knot[0] + S * 0.12, knot[1] + S * 0.12]], [0.3, 1.2, 0.3], { col: rgb(T.line), op: 0.8 });
    a.add('hairTop', k);
    var shp = edge.map(function (p) { return [p[0] + S * 0.04, p[1] + S * 0.1]; }).concat([a.on(-1.2, -1.4, 0), a.on(1.2, -1.4, 0)]);
    a.add('hairShadow', a.g(a.g(a.el(smooth(shp, true), a.mulTint(a.skin.deep), { op: 0.55 }), { clip: a.skinClip, blur: 2.2 }), { mode: 'multiply' }));
    hairBackMass(a, T, [a.rim(148, 0.12), a.P(-1.05, 0.45, -0.5), a.P(-0.5, 0.6, -0.9), a.P(0.5, 0.55, -0.9), a.P(1.0, 0.3, -0.5), a.rim(26, 0.06), a.rim(270, 0.3)]);
  };
  /* headscarf: tied at the nape (Pečko) or under the chin (Baka) */
  HAIR.scarf = function (a, c, o) {
    var S = a.S, def = a.def, T = clothTones(def.scarf || [200, 180, 140]), pat = def.scarfPattern ? hx(def.scarfPattern) : null, chin = o.tie === 'chin';
    var hairT = hairTones(c);
    // a little hair shows at the front
    if (!chin) {
      var hp = a.onL([[0.9, -0.45], [0.6, -0.86], [0.0, -0.96], [-0.6, -0.86], [-0.94, -0.42], [-0.96, -0.3], [-0.6, -0.72], [0.0, -0.82], [0.6, -0.72], [0.88, -0.32]], 0.04);
      paintMass(a, hp, hairT, { lw: 1.0, inner: a.ink(a.onL([[0, -0.96], [0, -0.82]], 0.05), [0.6, 0.9, 0.3], { col: rgb(hairT.deep) }) });
    }
    var fy = chin ? -0.82 : -0.84;
    var out = chin ? a.rims([[124, 0.24], [140, 0.3], [160, 0.34], [182, 0.36], [210, 0.34], [240, 0.3], [270, 0.28], [300, 0.28], [330, 0.3], [356, 0.32], [20, 0.3], [40, 0.24], [56, 0.18]])
      : a.rims([[150, 0.14], [168, 0.22], [190, 0.26], [215, 0.28], [245, 0.28], [272, 0.27], [300, 0.27], [328, 0.25], [352, 0.2], [14, 0.12], [26, 0.05]]);
    var edge = chin ? a.onL([[0.64, 1.0], [0.9, 0.5], [0.98, -0.2], [0.75, -0.72], [0.2, fy - 0.04], [-0.4, fy - 0.02], [-0.85, -0.6], [-1.02, -0.1], [-0.98, 0.6], [-0.8, 1.05]], 0.12)
      : a.onL([[0.92, 0.0], [0.94, -0.42], [0.72, -0.78], [0.2, fy - 0.04], [-0.4, fy - 0.02], [-0.85, -0.7], [-1.0, -0.38], [-1.02, 0.02]], 0.1);
    var pts = out.concat(edge), d = smooth(pts, true, 0.9), b = bbox(pts), inner = '';
    inner += a.el(d, a.lin(b.x0, b.y0, b.x1, b.y1, [[0, T.light, 0.8], [0.5, T.base, 0], [1, T.shadow, 0.9]]));
    if (pat) {
      var r = rnd(55);
      for (var k = 0; k < 90; k++) {
        var px = b.x0 + r() * (b.x1 - b.x0), py = b.y0 + r() * (b.y1 - b.y0), rr = S * (0.035 + r() * 0.03);
        if (chin) { inner += '<g transform="translate(' + f(px) + ' ' + f(py) + ')" fill="' + rgb(pat) + '" opacity="0.85">' + [0, 72, 144, 216, 288].map(function (an) { return '<ellipse cx="0" cy="' + f(-rr) + '" rx="' + f(rr * 0.55) + '" ry="' + f(rr) + '" transform="rotate(' + an + ')"/>'; }).join('') + '<circle r="' + f(rr * 0.45) + '" fill="#e8d890"/></g>'; }
        else inner += '<circle cx="' + f(px) + '" cy="' + f(py) + '" r="' + f(rr * 0.8) + '" fill="' + rgb(pat) + '" opacity="0.8"/>';
      }
      // a printed border along the front edge
      inner += a.el(taper(offset(edge.slice(chin ? 2 : 1, chin ? 8 : 7), 0, -S * 0.06), S * 0.07, 3), pat, { op: 0.75 });
    }
    // folds radiating from the tie
    var tieP = chin ? a.P(0.1, a.fc.chinB + 0.2, 0.7) : a.P(-0.9, 0.55, -0.85);
    for (k = 0; k < 6; k++) {
      var ang = (chin ? 200 : 180) + k * (chin ? 26 : 22), q = a.rim(ang, 0.15);
      inner += a.ink(strand(q, tieP, S * 0.2, 10).slice(0, 7), [0.3, 1.3, 0.1], { col: rgb(T.deep), op: 0.45 });
      inner += a.el(taper(offset(strand(q, tieP, S * 0.2, 10).slice(1, 6), -2, -1.5), [0, 2.2, 0], 3), T.hi, { op: 0.35 });
    }
    a.add('hair', a.el(d, T.base) + a.g(inner, { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.5 }));
    // the knot and its ends
    var kn = '';
    if (chin) {
      var kc = a.P(0.12, a.fc.chinB + 0.12, 0.6);
      var e1 = [[kc[0] - S * 0.1, kc[1]], [kc[0] - S * 0.45, kc[1] + S * 0.35], [kc[0] - S * 0.3, kc[1] + S * 0.75], [kc[0] - S * 0.05, kc[1] + S * 0.2]];
      var e2 = [[kc[0] + S * 0.1, kc[1]], [kc[0] + S * 0.5, kc[1] + S * 0.3], [kc[0] + S * 0.45, kc[1] + S * 0.7], [kc[0] + S * 0.05, kc[1] + S * 0.2]];
      [e1, e2].forEach(function (e) { var dd = smooth(e, true); kn += a.el(dd, T.base) + a.g(a.el(dd, a.lin(e[0][0], e[0][1], e[2][0], e[2][1], [[0, T.light], [1, T.shadow]])), { clip: a.clip(dd) }) + a.el(dd, 'none', { stroke: rgb(T.line), sw: 1.3 }); });
      kn += '<ellipse cx="' + f(kc[0]) + '" cy="' + f(kc[1]) + '" rx="' + f(S * 0.16) + '" ry="' + f(S * 0.12) + '" fill="' + rgb(T.base) + '" stroke="' + rgb(T.line) + '" stroke-width="1.3"/>';
      a.add('front', '<g transform="rotate(' + f(a.roll * 57.3) + ' ' + f(a.ox) + ' ' + f(a.oy + a.S * (a.fc.chinY + 0.4)) + ')">' + kn + '</g>');
      // cloth going down behind the neck
      hairBackMass(a, T, [a.rim(120, 0.25), a.P(-1.3, 1.6, -0.3), a.P(-0.8, 2.3, -0.5), a.P(0.8, 2.3, -0.5), a.P(1.25, 1.5, -0.2), a.rim(60, 0.2), a.rim(270, 0.3)]);
    } else {
      var kc2 = a.P(-0.95, 0.55, -0.9);
      var t1 = [[kc2[0], kc2[1]], [kc2[0] - S * 0.3, kc2[1] + S * 0.5], [kc2[0] - S * 0.15, kc2[1] + S * 1.0], [kc2[0] + S * 0.08, kc2[1] + S * 0.3]];
      var dd2 = smooth(t1, true);
      kn += a.el(dd2, T.shadow) + a.el(dd2, 'none', { stroke: rgb(T.line), sw: 1.3 });
      kn += '<ellipse cx="' + f(kc2[0]) + '" cy="' + f(kc2[1]) + '" rx="' + f(S * 0.18) + '" ry="' + f(S * 0.14) + '" fill="' + rgb(T.base) + '" stroke="' + rgb(T.line) + '" stroke-width="1.3"/>';
      a.add('hairBack', kn);
      hairBackMass(a, T, [a.rim(150, 0.14), a.P(-1.05, 0.55, -0.5), a.P(-0.6, 0.65, -0.9), a.P(0.5, 0.6, -0.9), a.P(1.0, 0.35, -0.5), a.rim(26, 0.05), a.rim(270, 0.27)]);
    }
    var shp = edge.map(function (p) { return [p[0] + S * 0.05, p[1] + S * 0.1]; }).concat(chin ? [a.on(-1.5, 1.6, 0), a.on(1.5, 1.6, 0)] : [a.on(-1.2, -1.4, 0), a.on(1.2, -1.4, 0)]);
    if (!chin) a.add('hairShadow', a.g(a.g(a.el(smooth(shp, true), a.mulTint(a.skin.deep), { op: 0.5 }), { clip: a.skinClip, blur: 2.2 }), { mode: 'multiply' }));
    else {
      var o2 = edge.slice(0, 4).concat(edge.slice(6));
      a.add('hairShadow', a.g(a.g(a.el(smooth(edge.map(function (p) { return [p[0] + S * 0.04, p[1] + S * 0.06]; }).concat([a.on(-2, 2, 0), a.on(2, 2, 0)]), true), a.mulTint(a.skin.deep), { op: 0 }), { clip: a.skinClip }), { mode: 'multiply' }));
    }
  };

  /* ================= HATS ================= */
  var HAT = {};
  function shapeFill(a, layer, pts, T, o) {
    o = o || {};
    var d = o.d || smooth(pts, true, o.ten === undefined ? 0.9 : o.ten), b = bbox(pts);
    var s = a.el(d, T.base) + a.g(a.el(d, a.lin(b.x0, b.y0, b.x1, b.y1, [[0, T.light, o.lo === undefined ? 0.7 : o.lo], [0.5, T.base, 0], [1, T.deep, o.hiOp === undefined ? 0.8 : o.hiOp]])) + (o.inner || ''), { clip: a.clip(d) });
    if (o.line !== false) s += a.el(d, 'none', { stroke: rgb(T.line), sw: o.lw || 1.5 });
    a.add(layer, s);
    return d;
  }
  function multShadow(a, pts, op, blur) { a.add('hairShadow', a.g(a.g(a.el(smooth(pts, true), a.mulTint(a.skin.deep), { op: op }), { clip: a.skinClip, blur: blur || 2.4 }), { mode: 'multiply' })); }
  /* flat cap: soft crown pulled forward over a short stiff peak */
  HAT.flatcap = function (a, c) {
    var S = a.S, T = clothTones(c), r = rnd(61);
    var crown = a.rims([[156, 0.12], [172, 0.26], [195, 0.34], [225, 0.36], [255, 0.34], [285, 0.3], [312, 0.27], [338, 0.24], [356, 0.16], [12, 0.06]]);
    var front = a.onL([[1.02, -0.45], [0.75, -0.7, 0.35], [0.2, -0.8, 0.55], [-0.45, -0.78, 0.48], [-0.9, -0.66, 0.3], [-1.05, -0.45, 0.15]], 0.12);
    var pts = crown.concat(front), inner = '';
    // tweed: fine hatching
    for (var k = 0; k < 70; k++) { var p = a.rim(160 + r() * 200, r() * 0.25); inner += a.ink([p, [p[0] + 2.5, p[1] + 1.2]], [0.2, 0.9, 0.2], { col: rgb(r() > 0.5 ? T.light : T.deep), op: 0.45 }); }
    // the seam where the crown folds over the band, and the button
    inner += a.ink(a.onL([[-1.0, -0.62], [-0.4, -0.95], [0.2, -1.0], [0.85, -0.82]], 0.4), [0.4, 1.4, 0.4], { col: rgb(T.deep), op: 0.7 });
    var bt = a.on(-0.05, -1.25, 0.6);
    inner += '<circle cx="' + f(bt[0]) + '" cy="' + f(bt[1]) + '" r="' + f(S * 0.07) + '" fill="' + rgb(T.shadow) + '" stroke="' + rgb(T.line) + '" stroke-width="0.8"/>';
    shapeFill(a, 'hat', pts, T, { inner: inner });
    // the peak
    var pk = a.onL([[-0.92, -0.66, 0.3], [-0.45, -0.76, 0.5], [0.2, -0.78, 0.6], [0.78, -0.66, 0.38], [0.98, -0.5, 0.2], [0.72, -0.58, 0.62], [0.15, -0.62, 0.86], [-0.45, -0.62, 0.74], [-0.85, -0.56, 0.45]], 0.12);
    shapeFill(a, 'hat', pk, clothTones(mul(hx(c), 0.85)), { lo: 0.4 });
    multShadow(a, [a.on(-1.2, -0.7, 0), a.on(-0.9, -0.42, 0), a.on(0, -0.36, 0), a.on(0.9, -0.38, 0), a.on(1.2, -0.7, 0)], 0.7, 3);
  };
  HAT.kamilavka = function (a, c) {
    var S = a.S, T = clothTones(c);
    var bl = a.rim(188, 0.08), br = a.rim(352, 0.06), front = a.on(0.05, -1.0, 0.25);
    var h = S * 1.15, wid = 1.08;
    var bot = [bl, [lerp(bl[0], front[0], 0.5), front[1] + S * 0.05], front, [lerp(front[0], br[0], 0.5), front[1] + S * 0.02], br];
    var tl = [bl[0] - S * 0.12, bl[1] - h], tr = [br[0] + S * 0.1, br[1] - h];
    var pts = [K(bl), K(tl), [lerp(tl[0], tr[0], 0.5), tl[1] - S * 0.04], K(tr), K(br)].concat(bot.slice(1, 4).reverse());
    var inner = '';
    inner += a.el(poly([[tl[0] + S * 0.3, tl[1]], [tl[0] + S * 0.5, tl[1]], [bl[0] + S * 0.55, bl[1] + S * 0.1], [bl[0] + S * 0.32, bl[1] + S * 0.1]], true), T.hi, { op: 0.3, blur: 2 });
    shapeFill(a, 'hat', pts, T, { inner: inner, ten: 0.6 });
    // the flat top seen just from below its rim
    var top = [tl, [lerp(tl[0], tr[0], 0.5), tl[1] - S * 0.07], tr, [lerp(tl[0], tr[0], 0.5), tl[1] + S * 0.06]];
    a.add('hat', a.el(smooth(top, true), T.shadow, { stroke: rgb(T.line), sw: 1.3 }));
    a.add('hat', a.ink(bot, [1.4, 2, 1.4], { col: rgb(T.line) }));
    multShadow(a, [a.on(-1.2, -1.0, 0), a.on(-0.9, -0.82, 0), a.on(0, -0.78, 0), a.on(0.9, -0.82, 0), a.on(1.2, -1.0, 0)], 0.6, 2.6);
  };
  /* felt hat with a brim (Radoje) */
  HAT.brim = function (a, c) {
    var S = a.S, T = clothTones(c);
    // brim: an ellipse ring around the head, tipped down at the front
    var ring = [];
    for (var k = 0; k < 24; k++) { var t = k / 24 * Math.PI * 2, X = Math.cos(t) * 1.75, Z = Math.sin(t) * 1.7 - 0.05, Y = -0.95 + Math.max(0, Math.sin(t)) * 0.18; ring.push(a.P(X, Y, Z)); }
    var back = ring.filter(function (p, i) { return i >= 12; }), frontR = ring.filter(function (p, i) { return i <= 12; });
    var bd = smooth(ring, true);
    a.add('hairBack', a.el(bd, T.shadow, { stroke: rgb(T.line), sw: 1.4 }));
    // crown with a pinched crease
    var cr = [a.P(-0.95, -0.95, 0.05), a.P(-0.98, -1.55, 0.0), a.P(-0.6, -2.0, 0.0), a.P(0, -1.85, 0.1), a.P(0.6, -2.0, 0.0), a.P(0.96, -1.55, 0.05), a.P(0.95, -0.95, 0.05), a.P(0, -0.9, 1.0)];
    var inner = a.ink([a.P(-0.4, -1.95, 0.4), a.P(0, -1.75, 0.6), a.P(0.4, -1.95, 0.4)], [0.4, 1.6, 0.4], { col: rgb(T.deep), op: 0.8 });
    // band
    var band = [a.P(-0.97, -1.18, 0.05), a.P(0, -1.1, 1.0), a.P(0.97, -1.18, 0.05), a.P(0.96, -0.98, 0.05), a.P(0, -0.92, 1.0), a.P(-0.96, -0.98, 0.05)];
    shapeFill(a, 'hat', cr, T, { inner: inner });
    shapeFill(a, 'hat', band, clothTones(mul(hx(c), 0.6)), { lw: 1 });
    // front of the brim over the face
    var fb = frontR.concat([a.P(1.0, -0.96, 0.4), a.P(0, -0.9, 1.05), a.P(-1.0, -0.96, 0.4)]);
    shapeFill(a, 'hat', fb, clothTones(mul(hx(c), 1.1)), { lo: 0.5 });
    multShadow(a, [a.on(-1.3, -1.0, 0), a.on(-1.0, -0.2, 0), a.on(0, -0.12, 0), a.on(1.0, -0.2, 0), a.on(1.3, -1.0, 0)], 0.65, 3.5);
  };
  /* a boy's peaked cap (Luka) */
  HAT.peaked = function (a, c) {
    var S = a.S, T = clothTones(c);
    var crown = a.rims([[158, 0.1], [175, 0.2], [200, 0.25], [230, 0.27], [260, 0.27], [290, 0.26], [320, 0.23], [345, 0.18], [5, 0.1], [18, 0.04]]);
    var front = a.onL([[1.0, -0.5], [0.6, -0.78, 0.3], [0, -0.84, 0.45], [-0.6, -0.8, 0.35], [-1.0, -0.55, 0.15]], 0.1);
    var inner = '';
    [[-0.5], [0.15], [0.7]].forEach(function (q) { inner += a.ink(a.onL([[q[0], -0.85, 0.42], [q[0] * 0.6, -1.4, 0.5], [q[0] * 0.2, -1.7, 0.2]], 0.15), [0.4, 1.0, 0.2], { col: rgb(T.deep), op: 0.6 }); });
    shapeFill(a, 'hat', crown.concat(front), T, { inner: inner });
    var pk = a.onL([[-0.75, -0.76, 0.35], [0, -0.84, 0.5], [0.7, -0.74, 0.35], [0.85, -0.62, 0.7], [0.1, -0.6, 1.25], [-0.6, -0.64, 0.95]], 0.1);
    shapeFill(a, 'hat', pk, clothTones(mul(hx(c), 0.75)), { lo: 0.4 });
    var bt = a.on(0, -1.62, 0.35);
    a.add('hat', '<circle cx="' + f(bt[0]) + '" cy="' + f(bt[1]) + '" r="' + f(S * 0.07) + '" fill="' + rgb(T.shadow) + '" stroke="' + rgb(T.line) + '" stroke-width="0.8"/>');
    multShadow(a, [a.on(-1.2, -0.7, 0), a.on(-0.8, -0.4, 0), a.on(0.1, -0.3, 0), a.on(0.9, -0.42, 0), a.on(1.2, -0.7, 0)], 0.7, 3);
  };
  /* flower wreath (Mila) */
  HAT.wreath = function (a) {
    var S = a.S, s = '', sb = '', r = rnd(88);
    var cols = [[196, 52, 48], [236, 226, 206], [70, 96, 170], [222, 170, 60], [196, 52, 48]];
    for (var k = 0; k <= 16; k++) {
      var t = Math.PI * (0.98 + k / 16 * 1.04), X = Math.cos(t) * 1.1, Z = -Math.sin(t) * 1.05 - 0.15, Y = -1.18 + Math.sin(t) * -0.05;
      var p = a.P(X, Y, Z), front = Z > -0.2, out = front ? s : sb;
      var rr = S * (0.1 + r() * 0.04);
      var leaf = '<ellipse cx="' + f(p[0] + rr) + '" cy="' + f(p[1] + rr * 0.3) + '" rx="' + f(rr * 1.1) + '" ry="' + f(rr * 0.45) + '" transform="rotate(' + Math.round(r() * 180) + ' ' + f(p[0]) + ' ' + f(p[1]) + ')" fill="#4a6a34" stroke="#1e2a14" stroke-width="0.7"/>';
      var cc = cols[k % cols.length], fl = '<g transform="translate(' + f(p[0]) + ' ' + f(p[1]) + ')">';
      for (var j = 0; j < 5; j++) fl += '<ellipse cx="0" cy="' + f(-rr * 0.6) + '" rx="' + f(rr * 0.45) + '" ry="' + f(rr * 0.65) + '" transform="rotate(' + (j * 72 + k * 11) + ')" fill="' + rgb(cc) + '" stroke="' + rgb(mul(cc, 0.4)) + '" stroke-width="0.6"/>';
      fl += '<circle r="' + f(rr * 0.3) + '" fill="#e8c850"/></g>';
      if (front) s += leaf + fl; else sb += leaf + fl;
    }
    a.add('hairBack', sb); a.add('hat', s);
  };

  /* ================= BEARDS ================= */
  var BEARD = {};
  function beardShape(a, o) {
    var fc = a.fc, b = fc.chinB;
    var outer = [];
    var o2 = a.outline();
    var top = o.top || 0.15;
    o2.L.forEach(function (p, i) { var Y = lerp(fc.crown, b, 0.5 - 0.5 * Math.cos(i / (o2.L.length - 1) * Math.PI)); if (Y > top) outer.push(p); });
    var Ls = outer.map(function (p, i) { var t = i / (outer.length - 1); return [p[0] - a.S * o.pad * t, p[1] + a.S * o.pad * t * 1.2]; });
    var Rs = [];
    o2.R.forEach(function (p, i) { var Y = lerp(fc.crown, b, 0.5 - 0.5 * Math.cos(i / (o2.R.length - 1) * Math.PI)); if (Y > top) Rs.push(p); });
    Rs = Rs.map(function (p, i) { var t = i / (Rs.length - 1); return [p[0] + a.S * o.pad * t * 0.6, p[1] + a.S * o.pad * t * 1.2]; });
    var chin = a.P(0.02, b + o.drop, 0.75);
    return { L: Ls, R: Rs, chin: chin };
  }
  BEARD.full = function (a, c, o) { beardGeneric(a, c, { pad: 0.2, drop: 0.38, top: 0.05, cheek: 0.48, inner: 0.8 }); };
  BEARD.short = function (a, c, o) { beardGeneric(a, c, { pad: 0.07, drop: 0.14, top: 0.2, cheek: 0.62, inner: 0.5 }); };
  BEARD.long = function (a, c, o) { beardGeneric(a, c, { pad: 0.22, drop: 1.6, top: 0.05, cheek: 0.5, inner: 0.9, long: 1 }); };
  function beardGeneric(a, c, o) {
    var S = a.S, T = hairTones(c), fc = a.fc, g = beardShape(a, o), my = fc.mouthY, mw = fc.mouthW;
    var cheekL = a.onL([[-0.9, o.top + 0.05], [-0.7, o.cheek], [-mw - 0.12, my - 0.08]], 0.05), cheekR = a.onL([[mw + 0.12, my - 0.08], [0.68, o.cheek], [0.9, o.top + 0.05]], 0.05);
    var bot = o.long ? [[g.L[g.L.length - 1][0] - S * 0.2, g.L[g.L.length - 1][1] + S * 0.6], [g.chin[0] - S * 0.3, g.chin[1]], K([g.chin[0] + S * 0.05, g.chin[1] + S * 0.25]), [g.chin[0] + S * 0.4, g.chin[1] - S * 0.05], [g.R[g.R.length - 1][0] + S * 0.1, g.R[g.R.length - 1][1] + S * 0.5]] : [g.chin];
    var pts = g.L.concat(bot).concat(g.R.slice().reverse()).concat(cheekR.slice().reverse().concat([])).concat([]);
    pts = g.L.concat(bot).concat(g.R.slice().reverse()).concat(cheekR.slice().reverse()).concat(cheekL.slice().reverse());
    // mouth hole: below the lower lip
    var mi = a.mouthInfo, hole = '';
    if (mi) { var hp = mi.LB.slice(2, mi.LB.length - 2).map(function (p) { return [p[0], p[1] + S * 0.04]; }); hole = smooth(hp.concat(mi.UT.slice(2, mi.UT.length - 2).reverse()), true); }
    var d = smooth(pts, true, 0.8), b = bbox(pts), r = rnd(71), inner = '';
    inner += a.el(d, a.lin(b.x0, b.y0, b.x1, b.y1, [[0, T.light, 0.6], [0.5, T.base, 0], [1, T.deep, 0.8]]));
    for (var k = 0; k < (o.long ? 46 : 34); k++) {
      var u = r(), v = r(), x = lerp(b.x0, b.x1, u), y = lerp(b.y0, b.y1, v), len = S * (o.long ? 0.3 + v * 0.3 : 0.15);
      var dir = (x - (b.x0 + b.x1) / 2) * 0.012;
      inner += a.ink([[x, y], [x + dir * len, y + len * 0.5], [x + dir * len * 1.5 - 1, y + len]], [0.2, 1.1, 0.1], { col: rgb(r() > 0.35 ? T.deep : T.hi), op: 0.6 });
    }
    var full = d + (hole ? ' ' + hole : '');
    var s = '<path d="' + full + '" fill="' + rgb(T.base) + '" fill-rule="evenodd"/>';
    var cid = a.id('cp'); a.addDef('<clipPath id="' + cid + '"><path d="' + full + '" clip-rule="evenodd"/></clipPath>');
    s += a.g(inner, { clip: 'url(#' + cid + ')' });
    s += '<path d="' + full + '" fill="none" fill-rule="evenodd" stroke="' + rgb(T.line) + '" stroke-width="1.3" opacity="0.85"/>';
    a.add('beard', s);
    MUST.thick(a, c, { beard: 1 });
  }
  var MUST = {};
  function mustache(a, c, o) {
    var S = a.S, T = hairTones(c), fc = a.fc, my = fc.mouthY, mw = fc.mouthW * (o.w || 1), ny = fc.noseY;
    var dr = o.droop || 0;
    var top = a.onL([[-mw - 0.05, my + 0.02 + dr], [-mw * 0.6, ny + 0.12], [0, ny + 0.09], [mw * 0.6, ny + 0.12], [mw + 0.05, my + 0.02 + dr]], 0.1);
    var botm = a.onL([[mw + 0.08 + dr * 0.2, my + 0.08 + dr], [mw * 0.55, my + 0.0 + (o.cover || 0)], [0, my - 0.02 + (o.cover || 0)], [-mw * 0.55, my + 0.0 + (o.cover || 0)], [-mw - 0.08 - dr * 0.2, my + 0.08 + dr]], 0.12);
    var pts = [K(top[0])].concat(top.slice(1, 4)).concat([K(top[4])]).concat([K(botm[0])]).concat(botm.slice(1, 4)).concat([K(botm[4])]);
    var b = bbox(pts), d = smooth(pts, true, 0.9), inner = '';
    inner += a.el(d, a.lin(b.x0, b.y0, b.x1, b.y1, [[0, T.light, 0.7], [0.6, T.base, 0], [1, T.deep, 0.7]]));
    for (var k = -6; k <= 6; k++) { var X = k / 6 * mw, q0 = a.on(X * 0.3, ny + 0.1, 0.12), q1 = a.on(X, my + 0.03 + Math.abs(k / 6) * dr, 0.12); inner += a.ink([q0, q1], [0.3, 1.1, 0.1], { col: rgb(k % 2 ? T.deep : T.hi), op: 0.6 }); }
    a.add('beard', a.el(d, T.base) + a.g(inner, { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.3 }));
  }
  MUST.thick = function (a, c, o) { mustache(a, c, { droop: o && o.beard ? 0.06 : 0.08, w: 1.05, cover: 0.02 }); };
  MUST.walrus = function (a, c, o) { mustache(a, c, { droop: 0.2, w: 1.2, cover: 0.06 }); };

  /* ================= OUTFITS ================= */
  var OUT = {};
  /* body frame: x in head units from the head axis, y in head units below the neck base; the torso turns less than the head */
  function bodyFrame(a) {
    var nb = a.neckBase, yw = a.yaw * 0.55, S = a.S * (a.pd.bodyK || 1);
    var cx = (nb.l[0] + nb.r[0]) / 2, cy = Math.max(nb.l[1], nb.r[1]) - S * 0.15;
    a.bp = function (x, y, z) { return [cx + S * (x * Math.cos(yw) + (z || 0) * Math.sin(yw)), cy + S * y]; };
    a.bpL = function (l) { return l.map(function (p) { var q = a.bp(p[0], p[1], p[2]); if (p.s) q.s = 1; return q; }); };
  }
  /* the torso silhouette: shoulders sloping from the neck */
  function torso(a, o) {
    o = o || {};
    var sw = (o.sw || 2.2) * (a.pd.shoulders || 1), sl = o.slope || 0.42, nw = a.fc.neckW * 1.05;
    return a.bpL([[-sw - 0.5, 4], [-sw - 0.1, 1.6], [-sw, sl + 0.5], [-sw + 0.3, sl], [-sw + 0.9, sl * 0.45], [-nw - 0.25, 0.05], [nw + 0.25, 0.05], [sw - 0.9, sl * 0.45], [sw - 0.3, sl], [sw, sl + 0.5], [sw + 0.1, 1.6], [sw + 0.5, 4]]);
  }
  function fillBody(a, pts, T, layer, extra) {
    var d = smooth(pts, true, 0.8), cp = a.clip(d), b = bbox(pts);
    var s = a.el(d, T.base);
    var inner = a.el(d, a.lin(b.x0, b.y0, b.x1, b.y1, [[0, T.light, 0.6], [0.4, T.base, 0], [1, T.shadow, 0.8]]));
    inner += extra || '';
    s += a.g(inner, { clip: cp });
    s += a.el(d, 'none', { stroke: rgb(T.line), sw: 1.5, op: 0.9 });
    a.add(layer || 'body', s);
    return { d: d, clip: cp };
  }
  function fold(a, pts, T, w, op) { return a.ink(a.bpL(pts), w || [0, 1.4, 0], { col: rgb(T.deep), op: op || 0.7 }); }
  function foldLight(a, pts, T, w, op) { return a.ink(a.bpL(pts), w || [0, 1.6, 0], { col: rgb(T.light), op: op || 0.5 }); }

  OUT.hoodie = function (a, c, o) {
    var T = clothTones(c), S = a.S, Th = clothTones(mul(hx(c), 0.82));
    var body = torso(a, { sw: 2.25, slope: 0.4 });
    // hood bunched behind the neck
    var hood = a.bpL([[-1.55, 0.55], [-1.45, -0.05], [-1.1, -0.45], [-0.5, -0.62], [0.3, -0.62], [0.95, -0.48], [1.3, -0.1], [1.4, 0.5], [0.6, 0.6], [-0.6, 0.6]]);
    var hd = smooth(hood, true);
    a.add('bodyBack', a.el(hd, Th.shadow) + a.g(a.el(hd, a.lin(hood[1][0], hood[1][1], hood[6][0], hood[6][1], [[0, Th.base], [1, Th.deep]])), { clip: a.clip(hd) }) + a.el(hd, 'none', { stroke: rgb(T.line), sw: 1.5 }));
    var ex = '';
    ex += fold(a, [[-1.7, 0.6], [-1.3, 1.2], [-1.25, 2.2]], T, [0, 1.8, 0]);
    ex += fold(a, [[1.6, 0.6], [1.25, 1.3], [1.3, 2.4]], T, [0, 1.8, 0]);
    ex += fold(a, [[-0.9, 1.4], [-0.6, 1.9], [-0.7, 2.6]], T, [0, 1.3, 0], 0.5);
    ex += fold(a, [[0.7, 1.2], [0.95, 1.9]], T, [0, 1.3, 0], 0.5);
    ex += foldLight(a, [[-2.0, 0.55], [-1.6, 0.4], [-1.1, 0.42]], T, [0, 2.2, 0], 0.45);
    fillBody(a, body, T, 'body', ex);
    // the hood's front roll around the neck, meeting in a V
    var roll = a.bpL([[-1.25, 0.1], [-1.05, -0.25], [-0.55, -0.35], [-0.42, 0.15], [-0.1, 0.75], K([0.04, 0.9]), [0.2, 0.75], [0.48, 0.15], [0.58, -0.32], [1.0, -0.22], [1.15, 0.12], [0.75, 0.55], [0.1, 1.15], [-0.1, 1.15], [-0.85, 0.55]]);
    var rd = smooth(roll, true);
    var s2 = a.el(rd, T.base) + a.g(a.el(rd, a.lin(roll[0][0], roll[0][1], roll[10][0], roll[10][1], [[0, T.light], [0.5, T.base], [1, T.shadow]])) + a.ink(a.bpL([[-0.95, 0.0], [-0.7, 0.45], [-0.15, 1.0]]), [0, 1.4, 0], { col: rgb(T.deep), op: 0.6 }) + a.ink(a.bpL([[0.9, -0.05], [0.68, 0.4], [0.2, 0.95]]), [0, 1.4, 0], { col: rgb(T.deep), op: 0.6 }), { clip: a.clip(rd) }) + a.el(rd, 'none', { stroke: rgb(T.line), sw: 1.5 });
    // zip and drawstrings
    s2 += a.ink(a.bpL([[0.04, 0.95], [0.06, 2.0], [0.08, 3.5]]), [1.4, 1.4, 1.4], { col: rgb(T.deep) });
    s2 += a.ink(a.bpL([[0.02, 0.95], [0.04, 2.0], [0.06, 3.5]]), [0.5, 0.5, 0.5], { col: rgb(T.light), op: 0.6 });
    var cord = mix(T.base, [200, 200, 205], 0.55);
    s2 += a.ink(a.bpL([[-0.32, 0.55], [-0.38, 1.1], [-0.33, 1.6]]), [1.6, 1.5, 1.3], { col: rgb(cord) }) + a.ink(a.bpL([[0.38, 0.5], [0.42, 1.0], [0.4, 1.45]]), [1.5, 1.4, 1.2], { col: rgb(mix(cord, T.shadow, 0.35)) });
    s2 += a.ink(a.bpL([[-0.33, 1.58], [-0.33, 1.72]]), 2.4, { col: rgb(T.line) }) + a.ink(a.bpL([[0.4, 1.43], [0.4, 1.56]]), 2.2, { col: rgb(T.line) });
    a.add('bodyTop', s2);
  };

  /* ================= ACCESSORIES ================= */
  var ACC = {};
  ACC.strap = function (a) {
    var T = clothTones([28, 27, 32]);
    var pts = a.bpL([[-1.95, 0.25], [-1.6, 0.25], [-1.35, 1.4], [-1.3, 4], [-1.85, 4], [-1.9, 1.4]]);
    var d = smooth([K(pts[0]), K(pts[1]), pts[2], K(pts[3]), K(pts[4]), pts[5]], true);
    var s = a.el(d, T.base) + a.g(a.el(d, a.lin(pts[0][0], 0, pts[1][0], 0, [[0, T.light], [1, T.shadow]])), { clip: a.clip(d) }) + a.el(d, 'none', { stroke: '#0a090c', sw: 1.4 });
    // stitching and a buckle
    s += '<path d="' + smooth(a.bpL([[-1.86, 0.4], [-1.82, 1.4], [-1.78, 3.6]]), false) + '" fill="none" stroke="#5a5a64" stroke-width="0.7" stroke-dasharray="2 2" opacity="0.8"/>';
    s += '<path d="' + smooth(a.bpL([[-1.52, 0.4], [-1.43, 1.4], [-1.38, 3.6]]), false) + '" fill="none" stroke="#5a5a64" stroke-width="0.7" stroke-dasharray="2 2" opacity="0.8"/>';
    var b = a.bpL([[-1.9, 2.3], [-1.4, 2.3], [-1.4, 2.6], [-1.9, 2.6]]);
    s += a.el(poly(b, true), '#4a4a52', { stroke: '#121014', sw: 1 });
    a.add('bodyTop', s);
  };

  /* ================= DRESS: put a character together ================= */
  function dress(a) {
    var pd = a.pd, def = a.def;
    bodyFrame(a);
    var hairCol = pd.hairCol || def.hair;
    pd.hairCol = hairCol;
    if (pd.outfit && OUT[pd.outfit]) OUT[pd.outfit](a, pd.top || def.topColor, pd.outfitOpt || {});
    if (pd.hair && HAIR[pd.hair]) HAIR[pd.hair](a, hairCol, pd.hairOpt || {});
    if (pd.beard && BEARD[pd.beard]) BEARD[pd.beard](a, pd.beardCol || def.beard || hairCol, {});
    else if (pd.mustache && MUST[pd.mustache]) MUST[pd.mustache](a, pd.mustacheCol || def.mustache || hairCol, {});
    if (pd.hat && HAT[pd.hat]) HAT[pd.hat](a, pd.hatCol || def.hatColor || [60, 54, 48], {});
    (pd.acc || []).forEach(function (x) { var t = typeof x === 'string' ? x : x.type; if (ACC[t]) ACC[t](a, typeof x === 'string' ? {} : x); });
  }

  return { dress: dress, HAIR: HAIR, HAT: HAT, BEARD: BEARD, MUST: MUST, OUT: OUT, ACC: ACC, hairTones: hairTones, clothTones: clothTones, paintMass: paintMass, strand: strand, sheen: sheen, fringe: fringe, torso: torso, fillBody: fillBody, bodyFrame: bodyFrame };
})();
