/* Portrait component library for the vector portrait rig (portraits.js): hair styles, beards, hats, outfits and
   accessories. Every piece is drawn with points placed on the rig's 3D head (a.on / a.rim) or the body frame (a.bp)
   so it follows the 3/4 view. Which pieces a character wears is data: the `portrait` entry in data/characters.js. */
'use strict';
BTS.PortraitLib = (function () {
  var G = BTS.Portraits.geo, Cc = BTS.Portraits.col;
  var clamp = G.clamp, smooth = G.smooth, taper = G.taper, K = G.K, f = G.f, lerp = G.lerp, ss = G.ss, spline = G.spline, offset = G.offset, poly = G.poly;
  var hx = Cc.hx, rgb = Cc.rgb, mix = Cc.mix, mul = Cc.mul, lum = Cc.lum, desat = Cc.desat;

  function rnd(seed) { var s = seed || 1; return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function mid(p, q, t) { return [lerp(p[0], q[0], t), lerp(p[1], q[1], t)]; }
  function quad(p0, c, p1, n) { var o = []; for (var i = 0; i <= n; i++) { var t = i / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } return o; }

  /* material tones for hair */
  function hairTones(c) {
    c = hx(c); var L = lum(c);
    if (L < 45) return { base: c, shadow: mix(mul(c, 0.55), [6, 6, 12], 0.4), deep: [8, 7, 11], light: mix(c, [96, 100, 120], 0.35), hi: mix(c, [150, 156, 178], 0.62), line: [8, 6, 10] };
    if (L < 110) return { base: c, shadow: mix(mul(c, 0.66), [40, 18, 30], 0.25), deep: mix(mul(c, 0.42), [24, 10, 18], 0.3), light: mix(mul(c, 1.12), [236, 214, 190], 0.18), hi: mix(mul(c, 1.25), [246, 234, 214], 0.42), line: mix(mul(c, 0.3), [20, 8, 8], 0.5) };
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
  var LDIR = [0.62, -0.78];
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

  /* ================= HAIR KIT: curtains of hair between two guide curves ================= */
  function arcLen(p) { var L = [0]; for (var i = 1; i < p.length; i++) L.push(L[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return L; }
  /* resample a Catmull-Rom curve through pts to n evenly spaced points */
  function resample(pts, n) {
    var q = spline(pts, 8), L = arcLen(q), tot = L[L.length - 1] || 1, out = [], j = 0;
    for (var i = 0; i < n; i++) {
      var d = tot * i / (n - 1);
      while (j < q.length - 2 && L[j + 1] < d) j++;
      var t = (d - L[j]) / ((L[j + 1] - L[j]) || 1);
      out.push([lerp(q[j][0], q[j + 1][0], t), lerp(q[j][1], q[j + 1][1], t)]);
    }
    return out;
  }
  /* curtain: the hair between guide A and guide B (both root -> tip). o: { layer, n strands, shade: 'A'|'B' (dark side),
     hi: [t0, t1] highlight band along the length, tipJag, lw, drop (cast shadow), clip, fill, sheenW } */
  function curtain(a, A, B, T, o) {
    o = o || {};
    var N = o.res || 24, ra = resample(A, N), rb = resample(B, N), S = a.S, r = rnd(o.seed || 17);
    // a jagged tip: the ends of the strands break into points
    var tip = [];
    var nj = o.tipJag === undefined ? 4 : o.tipJag;
    for (var k = 1; k < nj; k++) {
      var u = k / nj, base = mid(ra[N - 1], rb[N - 1], u), back = mid(ra[N - 4], rb[N - 4], u);
      if (k % 2) tip.push(K(base)); else tip.push(mid(back, base, 0.55));
    }
    var outline = ra.concat(nj > 1 ? tip : []).concat(rb.slice().reverse());
    var d = smooth(outline, true, 0.6), cp = a.clip(d), s = '', inner = '';
    if (o.drop) s += a.g(a.el(smooth(offset(outline, o.drop[0] * S, o.drop[1] * S), true), a.mulTint ? T.deep : T.deep, { op: o.dropOp || 0.45, blur: 1.4 }), { clip: o.dropClip });
    s += a.el(d, o.fill || T.base);
    // shading across the curtain: the dark side, a lit band, and the root
    var m0 = ra[Math.floor(N * 0.4)], m1 = rb[Math.floor(N * 0.4)];
    var dk = o.shade === 'B' ? [[0, T.shadow, 0.25], [0.3, T.base, 0], [0.7, T.shadow, 0.45], [1, T.deep, 0.75]] : [[0, T.deep, 0.75], [0.3, T.shadow, 0.45], [0.7, T.base, 0], [1, T.shadow, 0.25]];
    if (o.shade !== 'none') inner += a.el(d, a.lin(m0[0], m0[1], m1[0], m1[1], dk));
    // lengthwise: darker at the root (buried under the mass) and at the tips
    inner += a.el(d, a.lin(ra[0][0], ra[0][1], ra[N - 1][0], ra[N - 1][1], [[0, T.deep, o.rootDark === undefined ? 0.15 : o.rootDark], [0.2, T.base, 0], [0.75, T.base, 0], [1, T.shadow, 0.5]]));
    // strands
    var ns = o.n || 12;
    for (var i = 0; i < ns; i++) {
      var u2 = (i + 0.3 + r() * 0.4) / ns, st = [];
      for (var j = 0; j < N; j++) st.push(mid(ra[j], rb[j], u2 + (r() - 0.5) * 0.015));
      var j0 = Math.floor(r() * N * 0.35), j1 = Math.min(N, j0 + Math.floor(N * (0.45 + r() * 0.55)));
      var seg = st.slice(j0, j1);
      if (seg.length > 2) inner += a.ink(seg, [0, (o.lw || 1.0) * (0.6 + r() * 0.8), 0], { col: rgb(r() > 0.3 ? T.deep : T.line), op: 0.55 + r() * 0.35, per: 2 });
    }
    // highlight band: light strands where the hair turns toward the light
    var hi = o.hi || [0.12, 0.42], nh = o.nh === undefined ? Math.ceil(ns * 0.7) : o.nh;
    for (i = 0; i < nh; i++) {
      var u3 = o.hiSide !== undefined ? clamp(o.hiSide + (r() - 0.5) * (o.hiSpread || 0.5), 0.03, 0.97) : (i + r()) / nh;
      var h0 = Math.floor(N * (hi[0] + (r() - 0.5) * 0.1)), h1 = Math.floor(N * (hi[1] + (r() - 0.5) * 0.12));
      var hs = []; for (j = Math.max(0, h0); j < Math.min(N, h1); j++) hs.push(mid(ra[j], rb[j], u3));
      if (hs.length > 2) inner += a.el(taper(hs, [0, (o.sheenW || 1.6) * (0.5 + r()), 0], 3), T.hi, { op: (o.hiOp || 0.55) * (0.5 + r() * 0.5) });
    }
    if (o.inner) inner += o.inner;
    s += a.g(inner, { clip: cp });
    // ink: heavier on the edges, light at the tips
    var lw = o.edge || 1.5;
    if (o.inkA !== false) s += a.ink(ra, [lw * 0.5, lw, lw * 0.6], { col: rgb(T.line) });
    if (o.inkB !== false) s += a.ink(rb, [lw * 0.5, lw * 1.1, lw * 0.6], { col: rgb(T.line) });
    if (nj > 1 && o.inkTip !== false) s += a.ink([ra[N - 1]].concat(tip).concat([rb[N - 1]]), [0.6, 1.0, 0.6], { col: rgb(T.line), op: 0.9, per: 1 });
    a.add(o.layer || 'hair', s);
    return { A: ra, B: rb, d: d, clip: cp };
  }
  /* a fan of strand lines from a root point (a part or crown) to points along a hairline / rim */
  function fanStrands(a, root, ends, T, o) {
    o = o || {};
    var s = '', r = rnd(o.seed || 5);
    ends.forEach(function (e, i) {
      var c = mid(root, e, 0.5), dx = e[0] - root[0], dy = e[1] - root[1], l = Math.hypot(dx, dy) || 1, b = (o.bend || 0.12) * (r() * 0.6 + 0.7);
      var cc = [c[0] - dy / l * b * l * (o.dir || 1), c[1] + dx / l * b * l * (o.dir || 1)];
      var q = quad(root, cc, e, 10), t0 = Math.floor(r() * 3) + (o.skip || 1);
      s += a.ink(q.slice(t0), [0, (o.w || 1.0) * (0.6 + r() * 0.7), 0.1], { col: rgb(r() > 0.35 ? T.deep : T.line), op: (o.op || 0.7) * (0.6 + r() * 0.4), per: 2 });
    });
    return s;
  }
  function sheenFan(a, root, ends, T, t0, t1, o) {
    o = o || {};
    var s = '', r = rnd(o.seed || 8);
    ends.forEach(function (e, i) {
      if (o.every && i % o.every) return;
      var c = mid(root, e, 0.5), dx = e[0] - root[0], dy = e[1] - root[1], l = Math.hypot(dx, dy) || 1, b = (o.bend || 0.12) * (o.dir || 1);
      var q = quad(root, [c[0] - dy * b, c[1] + dx * b], e, 14);
      var a0 = Math.floor(14 * (t0 + (r() - 0.5) * 0.1)), a1 = Math.ceil(14 * (t1 + (r() - 0.5) * 0.1));
      var seg = q.slice(Math.max(0, a0), Math.min(15, a1));
      if (seg.length > 2) s += a.el(taper(seg, [0, (o.w || 1.8) * (0.5 + r() * 0.8), 0], 3), o.col || T.hi, { op: (o.op || 0.6) * (0.5 + r() * 0.5) });
    });
    return s;
  }
  /* points along a curve, evenly */
  function along(pts, n) { return resample(pts, n); }
  /* the skull cap of hair: from a hairline (on the face) round the top of the head (rim). Strands fan from the part. */
  function hairCap(a, T, o) {
    var S = a.S;
    var rim = a.rims(o.rim), line = o.line;
    var pts = rim.concat(line);
    var d = smooth(pts, true, o.ten === undefined ? 0.85 : o.ten), cp = a.clip(d), b = bbox(pts), inner = '';
    inner += a.el(d, a.lin(b.x0, b.y0, b.x1, b.y0 + (b.y1 - b.y0) * 0.4, [[0, T.shadow, 0.85], [0.45, T.base, 0], [1, T.light, 0.45]]));
    var part = o.part;
    // radiating strands to the rim and the hairline
    var ends = along(rim, o.nRim || 16).concat(along(line, o.nLine || 12));
    inner += fanStrands(a, part, ends, T, { bend: o.bend || 0.1, w: o.w || 1.0, op: 0.65, seed: o.seed || 3 });
    inner += sheenFan(a, part, along(rim, o.nSheen || 18), T, o.s0 || 0.32, o.s1 || 0.62, { w: o.shW || 2.0, op: o.shOp || 0.6, bend: o.bend || 0.1 });
    if (o.inner) inner += o.inner(d);
    var s = a.el(d, T.base) + a.g(inner, { clip: cp });
    if (o.inkRim !== false) s += a.ink(rim, [1.0, 1.7, 1.2], { col: rgb(T.line) });
    s += a.ink(line, [1.0, 1.4, 1.0], { col: rgb(T.line), op: 0.9 });
    a.add(o.layer || 'hair', s);
    return { d: d, clip: cp };
  }
  /* soft shadow the hair casts on the face/skin */
  function castOnSkin(a, pts, op, blur) { a.add('hairShadow', a.g(a.g(a.el(smooth(pts, true), a.mulTint(a.skin.deep), { op: op || 0.6 }), { clip: a.skinClip, blur: blur || 1.2 }), { mode: 'multiply' })); }

  /* ================= HAIR STYLES ================= */
  var HAIR = {};
  /* Đorđe: thick shaggy black hair, heavy bangs to the eyes, covering the ears, messy tufts */
  HAIR.shaggy = function (a, c, o) {
    o = o || {};
    var S = a.S, T = hairTones(c), young = a.pd.face === 'small', r = rnd(7);
    var low = young ? 0.38 : 0.62;
    // the mass behind the head, falling to the nape and over the collar
    var back = [a.rim(118, 0.08), a.P(-1.05, low + 0.22, -1.15), a.P(-0.6, low + 0.3, -1.7), a.P(0.4, low + 0.15, -1.6), a.P(1.1, low - 0.1, -0.9), a.rim(28, 0.14), a.rim(330, 0.2), a.rim(240, 0.2), a.rim(180, 0.18)];
    var bd = smooth(back, true);
    a.add('hairBack', a.el(bd, T.deep) + a.g(fanStrands(a, a.P(-0.4, -1.4, -1.0), along(back.slice(0, 5), 14), T, { w: 1.0, op: 0.5 }), { clip: a.clip(bd) }) + a.el(bd, 'none', { stroke: rgb(T.line), sw: 1.5 }));
    // the cap: big volume, tufted rim, covering the ears
    var hl = [[0.97, 0.05], [0.95, -0.45], [0.8, -0.8], [0.4, -0.98], [0.0, -1.02], [-0.45, -0.98], [-0.82, -0.8], [-0.98, -0.45], [-1.0, 0.1], [-1.0, low - 0.1]];
    var cap = shortCap(a, T, { pad: 0.07, tuft: 0.03, step: 7, a0: 122, a1: 368, hairline: hl, ear: false, seed: 5, shW: 2.4, shOp: 0.6, whorl: a.P(-0.2, -1.62, -1.0), cast: false });
    // locks hanging over the near ear and down the far cheek
    var sides = [[-0.95, -0.75, -1.02, low + 0.0, 0.08, 0.36], [-0.9, -0.7, -0.98, low + 0.1, 0.05, 0.32], [-0.85, -0.6, -0.95, low - 0.06, -0.04, 0.28], [-0.78, -0.62, -0.88, low - 0.25, -0.08, 0.24],
      [0.86, -0.7, 0.96, low - 0.18, -0.06, 0.26], [0.92, -0.6, 1.02, low - 0.04, 0.05, 0.3]];
    if (young) sides = sides.filter(function (q, i) { return i % 2 === 0; });
    sides.forEach(function (q, i) { drawLock(a, 'hair', a.on(q[0], q[1], 0.25), a.on(q[2], q[3], 0.08), S * q[5], q[4], T, { hi0: 0.1, hi1: 0.4, hiOp: 0.55, tipPow: 0.85, lw: 1.3, seed: i }); });
    // the crown: big locks spilling from the whorl over the back and the top of the head
    var wh = a.P(-0.25, -1.62, -0.95);
    [[126, 0.08, 0.1], [142, 0.1, -0.1], [158, 0.12, 0.12], [174, 0.14, -0.08], [192, 0.15, 0.1], [210, 0.16, -0.1], [228, 0.16, 0.08], [248, 0.16, -0.08], [268, 0.16, 0.06], [290, 0.17, -0.06], [312, 0.17, 0.08], [334, 0.17, -0.06], [354, 0.15, 0.06]].forEach(function (q, i) {
      var rt = a.rim(q[0], -0.05), root = mid(wh, rt, 0.2), tip = a.rim(q[0], q[1] - (young ? 0.05 : 0) + (r() - 0.5) * 0.05);
      tip = [tip[0] + (q[0] < 200 ? S * 0.02 : S * 0.04), tip[1] + S * (q[0] < 200 ? 0.22 : q[0] < 250 ? 0.12 : 0.05)];
      drawLock(a, 'hair', root, tip, S * 0.62, q[2], T, { hiOp: 0.5, hi0: 0.25, hi1: 0.6, drop: true, dropOp: 0.4, rootDark: 0, tipPow: 1.25, mid: true, lw: 1.3 });
    });
    // the heavy fringe, parted a little right of centre, falling to the eyes
    var fy = young ? 0.02 : -0.02, part = 0.18;
    var fr = [[-0.98, fy - 0.2, 0.44], [0.92, fy - 0.24, 0.4], [-0.72, fy - 0.06, 0.46], [0.7, fy - 0.1, 0.42], [-0.46, fy + 0.02, 0.46], [0.46, fy - 0.04, 0.44], [-0.2, fy - 0.08, 0.44], [0.22, fy + 0.0, 0.4], [0.02, fy - 0.14, 0.36]];
    fr.forEach(function (q, i) {
      var side = q[0] < part ? -1 : 1;
      var root = a.on(part + (q[0] - part) * 0.4, -1.32, 0.42), tip = a.on(q[0] + side * 0.05, q[1] + (r() - 0.5) * 0.06, 0.16);
      drawLock(a, 'hair', root, tip, S * q[2], side * -0.06 + (r() - 0.5) * 0.06, T, { hi0: 0.08, hi1: 0.38, hiOp: 0.8, tipPow: 0.95, lw: 1.5, hiW: 0.16 });
    });
    // fringe shadow on the face: the eyes sit in the shade of the bangs
    var shp = [a.on(-1.05, -1.2, 0.1)].concat(fr.slice().sort(function (p, q) { return p[0] - q[0]; }).map(function (q) { return a.on(q[0], q[1] + 0.12, 0.1); })).concat([a.on(1.05, -1.2, 0.1)]);
    castOnSkin(a, shp, 0.7, 1.4);
    // stray strands
    var wis = [[[0.12, -0.6], [0.18, -0.25], [0.12, 0.12]], [[-0.34, -0.6], [-0.4, -0.25], [-0.36, 0.1]], [[0.62, -0.5], [0.7, -0.2], [0.75, 0.08]]];
    if (young) wis = wis.slice(0, 1);
    wis.forEach(function (w) { a.add('hairTop', a.ink(a.onL(w, 0.18), [1.2, 0.9, 0.05], { col: rgb(T.line) })); });
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

  /* ---------- short hair cap: rim of the skull (with volume) + hairline across the face + round the ear ---------- */
  function earWrap(a, o) {
    var E = a.ear && a.ear.E; if (!E) return a.onL([[-1.0, 0.1], [-1.0, 0.4]], 0.02);
    o = o || {};
    var lo = o.low || 0;
    return [a.on(-0.99, 0.1 + lo, 0.02), E(-0.04, 0.22), E(0.06, -0.06), E(0.5, -0.2), E(0.95, -0.08), E(1.16, 0.3), E(1.16, 0.75 + lo)];
  }
  function shortCap(a, T, o) {
    o = o || {};
    var S = a.S, pad = o.pad === undefined ? 0.1 : o.pad, r = rnd(o.seed || 13), a0 = o.a0 || 132, a1 = o.a1 || 356, step = o.step || 8;
    var rim = [];
    for (var ang = a0, i = 0; ang <= a1 + 0.1; ang += step, i++) {
      var pp = pad + (o.tuft ? (i % 2 ? o.tuft : -o.tuft * 0.3) * (0.6 + r() * 0.8) : 0);
      if (ang < 160) pp *= (ang - a0) / (160 - a0) * 0.8 + 0.2;
      rim.push(a.rim(ang, pp));
    }
    var fy = o.hairY === undefined ? -1.02 : o.hairY, rec = o.recede || 0;
    var hl = a.onL(o.hairline || [[0.95, -0.5], [0.82, -0.78 - rec * 0.2], [0.5, fy + 0.02 - rec * 0.25], [0.1, fy - rec * 0.05], [-0.3, fy - rec * 0.05], [-0.62, fy + 0.08 - rec * 0.25], [-0.84, -0.78 - rec * 0.2], [-0.96, -0.5], [-0.99, -0.2]], 0.03);
    var pts = rim.concat(hl).concat(o.ear === false ? [] : earWrap(a, o));
    var d = smooth(pts, true, 0.8), cp = a.clip(d), b = bbox(pts), inner = '';
    // light from the upper right: the crown and the far side catch it
    inner += a.el(d, a.lin(b.x0, b.y1, b.x1, b.y0, [[0, T.deep, 0.8], [0.4, T.shadow, 0.35], [0.65, T.base, 0], [1, T.light, 0.5]]));
    var whorl = o.whorl || a.P(-0.35, -1.55, -1.25);
    var ends = along(rim, o.nRim || 18).concat(along(hl, o.nLine || 10));
    inner += fanStrands(a, whorl, ends, T, { bend: o.bend || 0.08, w: o.w || 1.0, op: 0.7, seed: (o.seed || 13) + 1 });
    inner += fanStrands(a, whorl, along(hl, 14).concat(along(rim.slice(Math.floor(rim.length * 0.5)), 10)), T, { bend: -0.06, w: 0.8, op: 0.5, seed: (o.seed || 13) + 2 });
    // a sheen band round the top
    inner += sheenFan(a, whorl, along(rim.slice(Math.floor(rim.length * 0.45)), 16).concat(along(hl.slice(0, 5), 6)), T, o.s0 || 0.45, o.s1 || 0.8, { w: o.shW || 2.0, op: o.shOp || 0.65, bend: 0.08 });
    // under the near edge the hair is darker
    inner += a.ink(rim.slice(0, Math.floor(rim.length * 0.4)).map(function (p) { return [p[0] + S * 0.04, p[1]]; }), [S * 0.08, S * 0.14, S * 0.05], { col: rgb(T.deep), op: 0.5 });
    if (o.inner) inner += o.inner;
    var s = a.el(d, T.base) + a.g(inner, { clip: cp });
    s += a.ink(rim, function (t) { return 1.2 + Math.sin(Math.PI * t) * 0.8; }, { col: rgb(T.line) });
    s += a.ink(hl, [0.8, 1.2, 0.8], { col: rgb(T.line), op: 0.85 });
    if (o.ear !== false) s += a.ink(earWrap(a, o), [0.8, 1.1, 1.0], { col: rgb(T.line), op: 0.8 });
    a.add(o.layer || 'hair', s);
    // the cast shadow of the hairline on the forehead
    if (o.cast !== false) castOnSkin(a, hl.map(function (p) { return [p[0] - S * 0.02, p[1] + S * 0.06]; }).concat([a.on(-1.2, -1.6), a.on(1.2, -1.6)]), 0.45, 1.0);
    return { rim: rim, hl: hl, d: d, clip: cp, whorl: whorl };
  }
  /* fringe locks that fall from the top of the head across the forehead; spec: [[x, tipY, width, bend], ...] */
  function fringeLocks(a, T, list, o) {
    o = o || {};
    var S = a.S, r = rnd(o.seed || 9), root0 = o.root || [-0.1, -1.45];
    list.forEach(function (q, i) {
      var root = a.on(root0[0] + q[0] * (o.spread || 0.4), root0[1], 0.25), tip = a.on(q[0], q[1], 0.12);
      drawLock(a, o.layer || 'hair', root, tip, S * q[2], q[3] === undefined ? (r() - 0.5) * 0.2 : q[3], T, { tipPow: o.tipPow || 0.9, hi0: 0.1, hi1: 0.5, hiOp: 0.75, lw: o.lw || 1.3, rootDark: 0.1, drop: o.drop });
    });
  }
  HAIR.short = function (a, c, o) {
    o = o || {};
    var T = hairTones(c), kid = /boy|girl|small/.test(a.pd.face), messy = o.messy || 0, S = a.S;
    var cap = shortCap(a, T, { pad: (kid ? 0.14 : 0.1) + (o.volume || 0), tuft: messy ? 0.07 : 0.025, hairY: kid ? -0.88 : -1.0, step: messy ? 7 : 9, seed: kid ? 21 : 13 });
    if (messy) {
      // tousled fringe over the forehead and a couple of tufts sticking up
      fringeLocks(a, T, [[-0.62, -0.62, 0.36, 0.1], [0.55, -0.66, 0.34, -0.1], [-0.3, -0.56, 0.4], [0.22, -0.6, 0.38], [-0.02, -0.52, 0.4, 0.05]], { root: [-0.05, -1.4], spread: 0.45, seed: 7 });
      [[250, 0.26, 0.15], [282, 0.24, -0.12], [312, 0.22, 0.12], [205, 0.22, -0.1]].forEach(function (q, i) { drawLock(a, 'hair', a.rim(q[0] + (i % 2 ? 12 : -12), 0.05), a.rim(q[0], q[1] + 0.06), S * 0.28, q[2], T, { hiOp: 0.5, drop: false, rootDark: 0, tipPow: 1.2, mid: false }); });
      castOnSkin(a, [a.on(-0.9, -1.0), a.on(-0.6, -0.5), a.on(0, -0.42), a.on(0.6, -0.55), a.on(0.95, -1.0)], 0.5, 1.2);
    } else {
      // short hair combed back and to the side, a soft wave at the front
      fringeLocks(a, T, [[0.62, -0.82, 0.42, -0.12], [0.32, -0.92, 0.44, -0.1], [0.0, -0.98, 0.4, -0.08]], { root: [-0.45, -1.32], spread: 0.2, seed: 5, tipPow: 1.3 });
    }
  };
  /* receding crop (Gorazd without his cap) */
  HAIR.crop = function (a, c, o) {
    var T = hairTones(c);
    shortCap(a, T, { pad: 0.06, tuft: 0.012, recede: 1, hairY: -0.98, step: 10, shOp: 0.45, seed: 5 });
  };
  /* bald on top, a horseshoe of hair round the back and sides (Dragan) */
  HAIR.bald = function (a, c, o) {
    var T = hairTones(c), S = a.S, E = a.ear.E;
    var rim = a.rims([[130, 0.06], [145, 0.07], [160, 0.07], [175, 0.06], [190, 0.02]]);
    var inner = [a.P(-0.98, -0.62, -1.3), a.P(-1.06, -0.5, -0.85), a.P(-1.04, -0.42, -0.45), a.on(-0.98, -0.35, 0.02)];
    var pts = rim.concat(inner).concat(earWrap(a));
    var d = smooth(pts, true, 0.8);
    a.add('hair', a.el(d, T.base) + a.g(a.el(d, T.shadow, { op: 0.5 }) + fanStrands(a, a.P(-0.6, -0.4, -1.8), along(pts, 16), T, { w: 0.8, op: 0.6 }), { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.2 }));
    // far side: a sliver above the far ear
    var fb = a.rims([[8, 0.05], [18, 0.06], [28, 0.05]]).concat(a.onL([[0.96, 0.15], [0.95, -0.25]], 0.02));
    a.add('hair', a.el(smooth(fb, true), T.base, { stroke: rgb(T.line), sw: 1 }));
    // shine on the scalp
    var hp = a.on(0.25, -1.2, 0.02);
    a.add('hairTop', '<ellipse cx="' + f(hp[0]) + '" cy="' + f(hp[1]) + '" rx="' + f(S * 0.32) + '" ry="' + f(S * 0.13) + '" transform="rotate(20 ' + f(hp[0]) + ' ' + f(hp[1]) + ')" fill="' + rgb(a.skin.hi) + '" opacity="0.6" filter="url(#' + a.blur(1.6) + ')"/>');
  };
  /* long straight hair with an off-centre part, falling in front of the shoulders (Lisa) */
  HAIR.long = function (a, c, o) {
    o = o || {};
    var S = a.S, T = hairTones(c), px = o.part === undefined ? -0.22 : o.part;
    var part = a.on(px, -1.36, 0.06);
    var len = o.len || 3.7;
    // the mass behind the neck and shoulders
    var back = [a.rim(150, 0.3), a.P(-1.55, 1.8, -0.7), a.P(-1.6, len, -0.6), a.P(1.35, len, -0.7), a.P(1.35, 1.6, -0.8), a.rim(30, 0.24), a.rim(300, 0.22), a.rim(230, 0.26)];
    curtain(a, [back[0], back[1], back[2]], [back[7], back[6], back[5], back[4], back[3]], { base: T.shadow, shadow: T.deep, deep: T.deep, light: T.base, hi: T.light, line: T.line }, { layer: 'hairBack', n: 10, shade: 'A', tipJag: 0, hi: [0.1, 0.3], hiOp: 0.3, res: 20 });
    // the cap over the top of the skull, under the two curtains
    var cap = [part, a.rim(250, 0.15), a.rim(270, 0.16), a.rim(295, 0.15), a.on(px + 0.2, -1.3, 0.06)];
    a.add('hair', a.el(smooth(cap, true), T.shadow));
    // the far curtain: behind the face, in front of the far shoulder
    var farA = [part, a.rim(292, 0.16), a.rim(325, 0.17), a.rim(355, 0.16), a.rim(20, 0.16), a.P(1.32, 1.15, -0.1), a.P(1.42, 2.2, 0.0), a.P(1.5, len - 0.05, 0.1)];
    var farB = [part, a.on(0.05, -1.2, 0.08), a.on(0.45, -1.05, 0.1), a.on(0.74, -0.78, 0.1), a.on(0.86, -0.35, 0.08), a.on(0.9, 0.25, 0.06), a.on(0.86, 0.85, 0.04), a.P(0.95, 1.5, 0.3), a.P(1.0, 2.4, 0.5), a.P(1.02, len, 0.55)];
    curtain(a, farB, farA, T, { layer: 'hair', n: 16, shade: 'B', hi: [0.08, 0.3], hiSide: 0.45, nh: 10, tipJag: 5, seed: 23 });
    // the near curtain sweeps from the part over the temple and the ear, down in front of the near shoulder
    var nearA = [part, a.on(-0.5, -1.13, 0.1), a.on(-0.76, -0.78, 0.12), a.on(-0.9, -0.32, 0.12), a.on(-0.94, 0.2, 0.12), a.on(-0.92, 0.72, 0.08), a.on(-0.86, 1.18, 0.06), a.P(-0.95, 1.85, 0.4), a.P(-1.02, 2.7, 0.55), a.P(-1.05, len, 0.6)];
    var nearB = [part, a.rim(255, 0.17), a.rim(222, 0.2), a.rim(192, 0.22), a.rim(165, 0.24), a.P(-1.62, 1.2, -0.1), a.P(-1.82, 2.3, 0.1), a.P(-1.9, len - 0.05, 0.2)];
    curtain(a, nearA, nearB, T, { layer: 'hair', n: 18, shade: 'B', hi: [0.06, 0.28], hiSide: 0.3, nh: 12, tipJag: 6, seed: 31 });
    // a few loose strands over the shoulder and across the curtain edges
    wisp(a, [a.on(0.84, 0.5, 0.15), a.P(0.92, 1.4, 0.35), a.P(0.86, 2.0, 0.5)], T, 'hairTop', 0.7);
    // the part itself and short strands at its edge
    a.add('hairTop', a.ink([part, a.on(px + 0.04, -1.55, 0.0), a.on(px + 0.1, -1.7, -0.2)], [1.2, 1.0, 0.2], { col: rgb(T.deep) }));
    // cast shadow of the hair on the forehead and cheeks
    castOnSkin(a, [a.on(-1.0, -1.4), a.on(-0.42, -1.05), a.on(-0.7, -0.68), a.on(-0.82, -0.2), a.on(-0.86, 0.6), a.on(-0.78, 1.2), a.on(-1.2, 1.4)], 0.55);
    castOnSkin(a, [a.on(1.1, -1.3), a.on(0.3, -1.1), a.on(0.62, -0.72), a.on(0.76, -0.3), a.on(0.8, 0.5), a.on(0.78, 1.0), a.on(1.2, 1.2)], 0.5);
    if (o.clip !== false) {
      // a small barrette on the near side
      var c0 = a.on(-0.74, -0.86, 0.2), ang = -55;
      a.add('hairTop', '<rect x="' + f(c0[0] - S * 0.2) + '" y="' + f(c0[1] - S * 0.04) + '" width="' + f(S * 0.4) + '" height="' + f(S * 0.09) + '" rx="' + f(S * 0.03) + '" transform="rotate(' + ang + ' ' + f(c0[0]) + ' ' + f(c0[1]) + ')" fill="#2a2628" stroke="#0e0c0c" stroke-width="0.9"/>' + '<rect x="' + f(c0[0] - S * 0.16) + '" y="' + f(c0[1] - S * 0.025) + '" width="' + f(S * 0.2) + '" height="' + f(S * 0.022) + '" transform="rotate(' + ang + ' ' + f(c0[0]) + ' ' + f(c0[1]) + ')" fill="#8a8488" opacity="0.8"/>');
    }
  };
  /* Jessica: short blonde pixie, a side-swept fringe, wisps in front of the ear */
  HAIR.pixie = function (a, c, o) {
    var S = a.S, T = hairTones(c);
    shortCap(a, T, { pad: 0.13, tuft: 0.012, step: 8, seed: 22, hairY: -0.98, whorl: a.P(-0.3, -1.6, -1.1), shW: 2.4 });
    // short layered tufts over the crown and the nape
    [[150, 0.1], [172, 0.13], [196, 0.15], [222, 0.16], [250, 0.16], [280, 0.16], [310, 0.15], [338, 0.13]].forEach(function (q, i) {
      var back = q[0] < 265, rt = a.rim(q[0] + (back ? 22 : -22), -0.03), tip = a.rim(q[0], q[1] - 0.02);
      drawLock(a, 'hair', rt, tip, S * 0.44, back ? -0.08 : 0.08, T, { hiOp: 0.55, hi0: 0.2, hi1: 0.6, drop: false, rootDark: 0, tipPow: 1.3, mid: false, lw: 1.1 });
    });
    // the swept fringe: from a part on the near side across the forehead to the far temple
    [[-0.42, -1.3, 0.92, -0.42, 0.46, -0.1], [-0.5, -1.25, 0.66, -0.4, 0.44, -0.12], [-0.58, -1.2, 0.38, -0.46, 0.42, -0.1], [-0.64, -1.1, 0.1, -0.52, 0.38, -0.1], [-0.7, -1.02, -0.22, -0.56, 0.32, -0.08]].forEach(function (q, i) {
      drawLock(a, 'hair', a.on(q[0], q[1], 0.3), a.on(q[2], q[3], 0.14), S * q[4], q[5], T, { tipPow: 1.0, hi0: 0.1, hi1: 0.55, hiOp: 0.8, lw: 1.3, rootDark: 0.05 });
    });
    // wispy sideburn pieces and the nape
    [[-0.94, -0.5, -1.0, 0.05, 0.2], [-0.9, -0.55, -0.92, -0.05, 0.16]].forEach(function (q) { drawLock(a, 'hair', a.on(q[0], q[1], 0.1), a.on(q[2], q[3], 0.04), S * q[4], 0.05, T, { hiOp: 0.5, tipPow: 1.1, lw: 1.1 }); });
    drawLock(a, 'hair', a.on(0.88, -0.65, 0.1), a.on(0.95, -0.1, 0.04), S * 0.2, -0.06, T, { hiOp: 0.5, tipPow: 1.1, lw: 1.1 });
    castOnSkin(a, [a.on(-1.0, -1.1), a.on(-0.62, -0.42), a.on(0.1, -0.4), a.on(0.95, -0.3), a.on(1.1, -1.2)], 0.5, 1.2);
  };
  /* Jaglika: a copper bob, straight-cut bangs to the brows, ends turned under at the jaw */
  HAIR.bob = function (a, c, o) {
    var S = a.S, T = hairTones(c), len = 1.02;
    // back of the bob behind the neck
    var back = [a.rim(128, 0.28), a.P(-1.32, len + 0.05, -1.0), a.P(-0.6, len + 0.15, -1.6), a.P(0.7, len, -1.2), a.P(1.22, len - 0.05, -0.3), a.rim(30, 0.28), a.rim(300, 0.3), a.rim(220, 0.32)];
    curtain(a, [back[0], back[1], back[2], back[3]], [back[7], back[6], back[5], back[4]], { base: T.shadow, shadow: T.deep, deep: T.deep, light: T.base, hi: T.base, line: T.line }, { layer: 'hairBack', n: 10, tipJag: 0, res: 16 });
    // the cap: smooth and round
    var cap = shortCap(a, T, { pad: 0.24, tuft: 0.0, step: 10, a0: 126, a1: 366, hairline: [[0.94, -0.3], [0.85, -0.75], [0.4, -1.02], [0, -1.06], [-0.45, -1.02], [-0.84, -0.75], [-0.96, -0.3], [-0.99, 0.3]], ear: false, seed: 4, whorl: a.P(0.0, -1.62, -0.6), shW: 2.6, shOp: 0.7, s0: 0.35, s1: 0.75, cast: false });
    // side curtains to the jaw, the ends curving under
    var nA = [a.on(-0.86, -0.7, 0.2), a.on(-0.92, -0.2, 0.18), a.on(-0.94, 0.4, 0.16), a.on(-0.9, 0.85, 0.15), a.on(-0.84, len + 0.02, 0.15)];
    var nB = [a.rim(212, 0.28), a.rim(186, 0.32), a.rim(160, 0.32), a.P(-1.4, 0.7, -0.6), a.P(-1.36, len + 0.08, -0.5)];
    curtain(a, nA, nB, T, { layer: 'hair', n: 16, shade: 'B', hi: [0.06, 0.3], hiSide: 0.45, nh: 10, tipJag: 3, seed: 3 });
    var fA = [a.on(0.86, -0.75, 0.2), a.on(0.94, -0.2, 0.16), a.on(0.95, 0.4, 0.1), a.on(0.9, 0.85, 0.05), a.P(0.86, len, 0.1)];
    var fB = [a.rim(330, 0.28), a.rim(355, 0.3), a.rim(18, 0.3), a.P(1.32, 0.75, -0.4), a.P(1.25, len + 0.04, -0.3)];
    curtain(a, fA, fB, T, { layer: 'hair', n: 12, shade: 'A', hi: [0.06, 0.3], hiSide: 0.6, nh: 8, tipJag: 3, seed: 6 });
    // straight bangs, cut just above the brows
    var by = (o.bangY || -0.38);
    var top = resample([a.rim(205, 0.18), a.rim(240, 0.24), a.rim(275, 0.25), a.rim(310, 0.24), a.rim(345, 0.2)], 9), bot = resample([a.on(-0.86, by - 0.08, 0.18), a.on(-0.4, by + 0.02, 0.2), a.on(0.3, by, 0.2), a.on(0.88, by - 0.12, 0.17)], 9);
    var bang = top.concat(bot.slice().reverse());
    var r = rnd(4), bt = [];
    for (var i = 0; i < 18; i++) { var u = i / 17, p = mid(bot[Math.floor(u * 8)], bot[Math.min(8, Math.floor(u * 8) + 1)], (u * 8) % 1); bt.push(i % 2 ? [p[0], p[1] - S * 0.05] : K([p[0], p[1] + S * 0.02 * r()])); }
    var pts = top.concat(bt.slice().reverse()), d = smooth(pts, true, 0.5), inner = '';
    inner += a.el(d, a.lin(top[0][0], top[0][1], top[8][0], top[8][1], [[0, T.shadow, 0.6], [0.5, T.base, 0], [1, T.light, 0.3]]));
    for (i = 0; i < 16; i++) { var u2 = (i + 0.5) / 16, t0 = mid(top[Math.floor(u2 * 8)], top[Math.min(8, Math.floor(u2 * 8) + 1)], (u2 * 8) % 1), b0 = mid(bot[Math.floor(u2 * 8)], bot[Math.min(8, Math.floor(u2 * 8) + 1)], (u2 * 8) % 1);
      inner += a.ink([mid(t0, b0, 0.2 + r() * 0.2), b0], [0, 1.1, 0.6], { col: rgb(T.deep), op: 0.6 });
      if (i % 2) inner += a.el(taper([mid(t0, b0, 0.15), mid(t0, b0, 0.45)], [0, 1.8, 0], 2), T.hi, { op: 0.6 }); }
    a.add('hair', a.el(d, T.base) + a.g(inner, { clip: a.clip(d) }) + a.ink(bt.concat([]), [1.0, 1.4, 1.0], { col: rgb(T.line), per: 1 }));
    castOnSkin(a, [a.on(-1.0, -1.3), a.on(-0.86, by + 0.06), a.on(0, by + 0.16), a.on(0.9, by + 0.04), a.on(1.1, -1.3)], 0.55, 1.2);
    castOnSkin(a, [a.on(-1.2, -0.5), a.on(-0.86, -0.3), a.on(-0.86, 1.0), a.on(-1.3, 1.2)], 0.45, 1.2);
  };
  /* Jaglika late: a navy head-wrap, wound in folds to a knot above the forehead; the ear lobes show */
  HAIR.wrap = function (a, c, o) {
    var S = a.S, T = clothTones(c), Tl = clothTones(mix(c, [120, 140, 190], 0.2));
    var rim = [];
    [[140, 0.14], [155, 0.22], [175, 0.3], [200, 0.36], [228, 0.42], [255, 0.46], [280, 0.46], [305, 0.42], [330, 0.34], [350, 0.24], [8, 0.14], [20, 0.06]].forEach(function (q) { rim.push(a.rim(q[0], q[1])); });
    var edge = a.onL([[0.96, 0.02], [0.92, -0.42], [0.72, -0.74], [0.3, -0.84], [-0.3, -0.84], [-0.78, -0.72], [-0.96, -0.42], [-0.99, -0.1]], 0.12);
    var E = a.ear.E;
    var pts = rim.concat(edge).concat([E(0.05, -0.02), E(0.5, -0.12), E(1.0, -0.02), E(1.2, 0.3)]);
    var d = smooth(pts, true, 0.85), b = bbox(pts), inner = '';
    inner += a.el(d, a.lin(b.x0, b.y1, b.x1, b.y0, [[0, T.deep, 0.8], [0.45, T.base, 0], [1, Tl.light, 0.6]]));
    var knot = a.on(0.12, -1.32, 0.62);
    // wound bands: each fold is a curve from the lower edge up across the head to the knot
    [[-1.0, -0.15, -0.1], [-0.98, -0.5, 0.0], [-0.8, -0.78, 0.1], [-0.45, -0.86, 0.12], [0.95, -0.2, 0.0], [0.8, -0.62, 0.08], [0.45, -0.85, 0.12], [-1.05, 0.2, -0.4]].forEach(function (q, i) {
      var st = q[2] < -0.2 ? a.rim(160 + i * 4, 0.2) : a.on(q[0], q[1], 0.12), m = a.on(q[0] * 0.75, (q[1] - 1.35) / 2, 0.45 + q[2]);
      var cv = quad(st, m, knot, 12);
      inner += a.el(taper(cv.slice(1, 11), [S * 0.04, S * 0.12, S * 0.02], 3), T.deep, { op: 0.6, blur: 0.6 });
      inner += a.el(taper(offset(cv.slice(2, 9), S * 0.05, -S * 0.05), [0, S * 0.07, 0], 3), Tl.hi, { op: 0.4 });
      inner += a.ink(cv.slice(1, 11), [0.3, 1.2, 0.3], { col: rgb(T.line), op: 0.75 });
    });
    // the rolled lower edge over the forehead
    inner += a.el(taper(offset(edge.slice(1, 7), 0, -S * 0.1), [S * 0.03, S * 0.1, S * 0.03], 3), Tl.light, { op: 0.45 });
    // a fine woven texture
    var r = rnd(9);
    for (var k = 0; k < 60; k++) { var px = lerp(b.x0, b.x1, r()), py = lerp(b.y0, b.y1, r()); inner += '<circle cx="' + f(px) + '" cy="' + f(py) + '" r="0.5" fill="' + rgb(Tl.light) + '" opacity="0.35"/>'; }
    a.add('hair', a.el(d, T.base) + a.g(inner, { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.6 }));
    // the knot: two twisted lobes and a tucked end
    var kk = '';
    [[-0.3, -0.06, 0.34, 0.22, -25], [0.22, -0.02, 0.32, 0.22, 25], [-0.02, 0.08, 0.2, 0.17, 0]].forEach(function (q) {
      var cx = knot[0] + S * q[0], cy = knot[1] + S * q[1], rx = S * q[2], ry = S * q[3];
      var e = '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" transform="rotate(' + q[4] + ' ' + f(cx) + ' ' + f(cy) + ')"';
      kk += e + ' fill="' + rgb(T.base) + '"/>' + e + ' fill="' + a.rad(cx + rx * 0.35, cy - ry * 0.5, rx * 1.4, [[0, Tl.light], [0.6, T.base], [1, T.deep]]) + '"/>' + e + ' fill="none" stroke="' + rgb(T.line) + '" stroke-width="1.3"/>';
    });
    kk += a.ink([[knot[0] - S * 0.1, knot[1] - S * 0.14], [knot[0] + S * 0.0, knot[1] + S * 0.02], [knot[0] + S * 0.12, knot[1] + S * 0.14]], [0.3, 1.3, 0.3], { col: rgb(T.line), op: 0.85 });
    a.add('hairTop', kk);
    castOnSkin(a, edge.map(function (p) { return [p[0] - S * 0.02, p[1] + S * 0.1]; }).concat([a.on(-1.2, -1.5), a.on(1.2, -1.5)]), 0.6, 1.2);
    // the back of the wrap behind the neck
    var bk = [a.rim(126, 0.1), a.P(-1.1, 0.6, -1.4), a.P(-0.4, 0.7, -1.9), a.P(0.6, 0.55, -1.5), a.rim(30, 0.08), a.rim(270, 0.4)];
    a.add('hairBack', a.el(smooth(bk, true), T.deep, { stroke: rgb(T.line), sw: 1.4 }));
  };
  /* headscarf: tied at the nape (Pečko) or under the chin (Baka) */
  HAIR.scarf = function (a, c, o) {
    var S = a.S, def = a.def, T = clothTones(def.scarf || [200, 180, 140]), pat = def.scarfPattern ? hx(def.scarfPattern) : null, chin = o.tie === 'chin', E = a.ear.E;
    var hairT = hairTones(c);
    var fy = -0.86, r = rnd(55);
    if (!chin) {
      // hair shows at the front, parted and pulled back
      shortCap(a, hairT, { pad: 0.04, tuft: 0, step: 12, seed: 3, hairY: -1.02, whorl: a.on(0.0, -1.5, 0.2), cast: true, layer: 'hair' });
    }
    var rim = chin ? a.rims([[96, 0.3], [112, 0.34], [130, 0.38], [150, 0.4], [175, 0.4], [205, 0.36], [235, 0.32], [265, 0.3], [295, 0.3], [325, 0.3], [350, 0.32], [15, 0.32], [40, 0.3], [60, 0.24]])
      : a.rims([[150, 0.1], [165, 0.2], [185, 0.25], [210, 0.28], [240, 0.28], [270, 0.27], [300, 0.27], [328, 0.24], [350, 0.18], [8, 0.1], [18, 0.04]]);
    var edge = chin ? a.onL([[0.62, 1.12], [0.9, 0.6], [0.96, 0.0], [0.86, -0.52], [0.5, -0.86], [0.0, fy - 0.04], [-0.5, -0.84], [-0.86, -0.56], [-0.98, -0.1], [-0.96, 0.5], [-0.82, 1.06]], 0.14)
      : a.onL([[0.95, -0.1], [0.92, -0.5], [0.66, -0.8], [0.2, fy - 0.08], [-0.35, fy - 0.06], [-0.78, -0.74], [-0.98, -0.42]], 0.12).concat([E(0.2, -0.12), E(0.8, -0.18), E(1.2, 0.1)]);
    var pts = rim.concat(edge), d = smooth(pts, true, 0.85), b = bbox(pts), inner = '';
    inner += a.el(d, a.lin(b.x0, b.y1, b.x1, b.y0, [[0, T.shadow, 0.9], [0.45, T.base, 0], [1, T.light, 0.6]]));
    if (pat) {
      for (var k = 0; k < (chin ? 110 : 80); k++) {
        var px = b.x0 + r() * (b.x1 - b.x0), py = b.y0 + r() * (b.y1 - b.y0), rr = S * (0.04 + r() * 0.03);
        if (chin) inner += '<g transform="translate(' + f(px) + ' ' + f(py) + ') rotate(' + Math.round(r() * 90) + ')" fill="' + rgb(pat) + '" opacity="0.9">' + [0, 72, 144, 216, 288].map(function (an) { return '<ellipse cx="0" cy="' + f(-rr) + '" rx="' + f(rr * 0.5) + '" ry="' + f(rr) + '" transform="rotate(' + an + ')"/>'; }).join('') + '<circle r="' + f(rr * 0.4) + '" fill="#e8d890"/></g>';
        else inner += '<circle cx="' + f(px) + '" cy="' + f(py) + '" r="' + f(rr * 0.7) + '" fill="' + rgb(pat) + '" opacity="0.85"/>' + '<circle cx="' + f(px + rr * 1.3) + '" cy="' + f(py + rr * 0.4) + '" r="' + f(rr * 0.35) + '" fill="' + rgb(mix(pat, [240, 220, 160], 0.4)) + '" opacity="0.8"/>';
      }
      inner += a.el(taper(offset(edge.slice(chin ? 2 : 1, chin ? 9 : 6), 0, -S * 0.08), S * 0.08, 3), pat, { op: 0.8 });
    }
    // folds radiating from the tie
    var tieP = chin ? a.P(0.05, a.fc.chinB + 0.25, 0.7) : a.P(-0.8, 0.5, -1.8);
    for (k = 0; k < 7; k++) {
      var ang = (chin ? 130 : 175) + k * (chin ? 34 : 22), q = a.rim(ang, 0.2);
      var cv = strand(q, tieP, S * 0.25, 12);
      inner += a.ink(cv.slice(1, 8), [0.3, 1.4, 0.1], { col: rgb(T.deep), op: 0.5 });
      inner += a.el(taper(offset(cv.slice(2, 7), 2, -1.5), [0, 2.4, 0], 3), T.hi, { op: 0.35 });
    }
    a.add('hair', a.el(d, T.base) + a.g(inner, { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.6 }));
    var kn = '';
    if (chin) {
      // knot under the chin, the two ends hanging over the chest
      var kc = a.P(0.08, a.fc.chinB + 0.14, 0.62);
      var e1 = [[kc[0] - S * 0.1, kc[1]], [kc[0] - S * 0.45, kc[1] + S * 0.35], K([kc[0] - S * 0.36, kc[1] + S * 0.8]), [kc[0] - S * 0.05, kc[1] + S * 0.25]];
      var e2 = [[kc[0] + S * 0.1, kc[1]], [kc[0] + S * 0.5, kc[1] + S * 0.32], K([kc[0] + S * 0.48, kc[1] + S * 0.74]), [kc[0] + S * 0.05, kc[1] + S * 0.22]];
      [e1, e2].forEach(function (e, i) { var dd = smooth(e, true); kn += a.el(dd, T.base) + a.g(a.el(dd, a.lin(e[0][0], e[0][1], e[2][0], e[2][1], [[0, i ? T.light : T.shadow], [1, T.deep]])) + (pat ? a.el(taper([e[1], e[2]], S * 0.05, 3), pat, { op: 0.7 }) : ''), { clip: a.clip(dd) }) + a.el(dd, 'none', { stroke: rgb(T.line), sw: 1.3 }); });
      kn += '<ellipse cx="' + f(kc[0]) + '" cy="' + f(kc[1]) + '" rx="' + f(S * 0.17) + '" ry="' + f(S * 0.13) + '" fill="' + rgb(T.base) + '" stroke="' + rgb(T.line) + '" stroke-width="1.3"/>';
      a.add('front', '<g transform="rotate(' + f(a.roll * 57.3) + ' ' + f(a.ox) + ' ' + f(a.oy + a.S * (a.fc.chinY + 0.4)) + ')">' + kn + '</g>');
      // the cloth under the jaw and behind the neck
      var under = [edge[0], a.P(0.3, a.fc.chinB + 0.25, 0.4), a.P(-0.5, a.fc.chinB + 0.2, 0.2), edge[edge.length - 1], a.rim(110, 0.36), a.P(-1.4, 1.9, -0.6), a.P(1.2, 1.9, -0.4)];
      a.add('chin2', a.el(smooth(under, true), T.shadow, { stroke: rgb(T.line), sw: 1.3 }));
      castOnSkin(a, edge.map(function (p) { return [p[0] + S * (p[0] < a.ox ? 0.06 : -0.04), p[1] + S * 0.06]; }).concat([a.on(-2, -2), a.on(2, -2)]), 0.0, 1);
      castOnSkin(a, edge.slice(5).map(function (p) { return [p[0] + S * 0.1, p[1] + S * 0.04]; }).concat([a.on(-1.5, 1.5)]), 0.5, 1.2);
    } else {
      // the knot at the nape and the tails
      var kc2 = a.P(-0.7, 0.3, -1.85);
      var t1 = [[kc2[0], kc2[1]], [kc2[0] - S * 0.32, kc2[1] + S * 0.45], K([kc2[0] - S * 0.2, kc2[1] + S * 0.95]), [kc2[0] + S * 0.1, kc2[1] + S * 0.3]];
      var dd2 = smooth(t1, true);
      kn += a.el(dd2, T.shadow) + a.el(dd2, 'none', { stroke: rgb(T.line), sw: 1.3 });
      kn += '<ellipse cx="' + f(kc2[0]) + '" cy="' + f(kc2[1]) + '" rx="' + f(S * 0.2) + '" ry="' + f(S * 0.15) + '" fill="' + rgb(T.base) + '" stroke="' + rgb(T.line) + '" stroke-width="1.3"/>';
      a.add('hairBack', kn);
      var bk = [a.rim(140, 0.12), a.P(-1.0, 0.6, -1.5), a.P(0.0, 0.62, -1.9), a.rim(30, 0.05), a.rim(270, 0.3)];
      a.add('hairBack', a.el(smooth(bk, true), T.deep, { stroke: rgb(T.line), sw: 1.4 }));
      castOnSkin(a, edge.slice(0, 7).map(function (p) { return [p[0] - S * 0.02, p[1] + S * 0.1]; }).concat([a.on(-1.2, -1.5), a.on(1.2, -1.5)]), 0.5, 1.2);
    }
  };
  /* hair pulled back into a bun at the back of the head (Stana, Zlatko) */
  HAIR.bun = function (a, c, o) {
    var S = a.S, T = hairTones(c);
    var cap = shortCap(a, T, { pad: 0.08, tuft: 0.0, step: 10, seed: 13, hairY: -1.02, whorl: a.P(-0.55, -1.25, -1.9), shW: 2.2, shOp: 0.7, s0: 0.25, s1: 0.65, bend: 0.04 });
    // the bun sits high at the back
    var bc = a.rim(o.bunAng || 208, 0.42), R = S * 0.4, pts = [];
    for (var k = 0; k < 16; k++) { var t = k / 16 * Math.PI * 2; pts.push([bc[0] + Math.cos(t) * R * (1 + 0.05 * Math.sin(t * 3)), bc[1] + Math.sin(t) * R * 0.86]); }
    var d = smooth(pts, true), inner = '';
    inner += a.el(d, a.rad(bc[0] + R * 0.35, bc[1] - R * 0.4, R * 1.4, [[0, T.light], [0.5, T.base], [1, T.deep]]));
    for (k = 0; k < 8; k++) { var ang = k / 8 * Math.PI * 2; inner += a.ink([[bc[0] + Math.cos(ang) * R * 0.1, bc[1] + Math.sin(ang) * R * 0.1], [bc[0] + Math.cos(ang + 0.9) * R * 0.55, bc[1] + Math.sin(ang + 0.9) * R * 0.5], [bc[0] + Math.cos(ang + 1.7) * R * 0.95, bc[1] + Math.sin(ang + 1.7) * R * 0.82]], [0, 1.2, 0.2], { col: rgb(T.deep), op: 0.75 }); }
    inner += a.el(taper([[bc[0] - R * 0.1, bc[1] - R * 0.6], [bc[0] + R * 0.4, bc[1] - R * 0.45], [bc[0] + R * 0.65, bc[1] - R * 0.05]], [0, 2.2, 0], 3), T.hi, { op: 0.6 });
    a.add('hairBack', a.el(d, T.base) + a.g(inner, { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.5 }));
    // a few loose strands at the temples
    wisp(a, a.onL([[-0.9, -0.75], [-1.0, -0.35], [-0.97, 0.05]], 0.08), T, 'hairTop', 0.8);
    wisp(a, a.onL([[0.86, -0.72], [0.95, -0.4], [0.93, -0.1]], 0.08), T, 'hairTop', 0.7);
  };
  /* a single braid over the near shoulder (Vesna, Mila); hair parted in the middle and pulled back */
  HAIR.braid = function (a, c, o) {
    var S = a.S, T = hairTones(c);
    shortCap(a, T, { pad: 0.08, tuft: 0.0, step: 10, seed: 17, hairY: -1.02, whorl: a.on(0.02, -1.45, 0.1), shW: 2.2, shOp: 0.65, s0: 0.2, s1: 0.55, bend: 0.03 });
    a.add('hairTop', a.ink(a.onL([[0.02, -1.04], [0.02, -1.3], [0.0, -1.55]], 0.06), [1.0, 0.9, 0.2], { col: rgb(T.deep) }));
    var root = a.P(-0.95, 0.65, -1.2);
    var path = spline([root, a.bp(-1.45, 0.25), a.bp(-1.3, 1.4), a.bp(-1.15, 2.6), a.bp(-1.08, 3.6)], 3), s = '';
    var n = path.length, ww = S * (a.pd.face === 'girl' ? 0.28 : 0.32);
    for (var i = 0; i < n - 1; i++) {
      var q = path[i], q2 = path[i + 1], w = ww * (1 - i / n * 0.4), sd = i % 2 ? 1 : -1;
      var dx = q2[0] - q[0], dy = q2[1] - q[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      var lobe = [[q[0] + nx * w * 0.55 * sd, q[1] + ny * w * 0.55 * sd - dy * 0.1], [q[0] - nx * w * 0.2 * sd + dx * 0.5, q[1] - ny * w * 0.2 * sd + dy * 0.5], K([q2[0] - nx * w * 0.6 * sd + dx * 0.25, q2[1] - ny * w * 0.6 * sd + dy * 0.25]), [q[0] + nx * w * 0.1 * sd + dx * 0.85, q[1] + ny * w * 0.1 * sd + dy * 0.85]];
      var dd = smooth(lobe, true);
      s += a.el(dd, T.base) + a.g(a.el(dd, a.lin(lobe[0][0], lobe[0][1], lobe[2][0], lobe[2][1], [[0, T.light], [0.5, T.base], [1, T.deep]])) + a.ink([lobe[0], lobe[1], lobe[2]], [0, 0.8, 0], { col: rgb(T.deep), op: 0.6 }), { clip: a.clip(dd) }) + a.el(dd, 'none', { stroke: rgb(T.line), sw: 1.1 });
    }
    var end = path[n - 1], rc = o.ribbon || a.def.ribbon || [176, 48, 48];
    s += a.ink([end, [end[0] - S * 0.04, end[1] + S * 0.25], [end[0] + S * 0.03, end[1] + S * 0.45]], [S * 0.16, S * 0.12, 0], { col: rgb(T.base) });
    s += '<ellipse cx="' + f(end[0]) + '" cy="' + f(end[1]) + '" rx="' + f(S * 0.16) + '" ry="' + f(S * 0.08) + '" fill="' + rgb(rc) + '" stroke="#2a0e0e" stroke-width="1"/>';
    a.add('front', s);
    // the hair behind the ear gathering into the braid
    drawLock(a, 'hairMid', a.rim(175, 0.05), path[1], S * 0.4, 0.15, T, { hiOp: 0.4, tipPow: 0.4, wTip: S * 0.2, drop: false });
  };
  /* Milka: dark wavy hair to the shoulders, going grey, side part */
  HAIR.wavy = function (a, c, o) {
    var S = a.S, grey = a.pd.grey || 0, T = hairTones(c), Tg = hairTones(mix(c, [176, 172, 166], 0.5 + grey));
    var px = -0.32, part = a.on(px, -1.36, 0.08), len = 2.0;
    function wave(pts, amp, ph) { return pts.map(function (p, i) { if (i < 2) return p; return [p[0] + Math.sin(i * 1.7 + ph) * amp * a.S, p[1]]; }); }
    var back = [a.rim(130, 0.36), a.P(-1.6, 1.4, -0.9), a.P(-1.5, len, -1.0), a.P(1.2, len - 0.1, -1.0), a.P(1.4, 1.2, -0.5), a.rim(30, 0.34), a.rim(300, 0.34), a.rim(220, 0.38)];
    curtain(a, [back[0], back[1], back[2]], [back[7], back[6], back[5], back[4], back[3]], { base: T.shadow, shadow: T.deep, deep: T.deep, light: T.base, hi: Tg.base, line: T.line }, { layer: 'hairBack', n: 10, tipJag: 5, res: 18, hiOp: 0.4 });
    var cap = [part, a.rim(250, 0.3), a.rim(272, 0.3), a.rim(295, 0.3), a.on(px + 0.25, -1.3, 0.06)];
    a.add('hair', a.el(smooth(cap, true), T.shadow));
    var farA = [part, a.rim(285, 0.32), a.rim(318, 0.34), a.rim(350, 0.34), a.rim(18, 0.36), a.P(1.45, 0.9, -0.2), a.P(1.5, 1.5, -0.1), a.P(1.4, len, 0.0)];
    var farB = [part, a.on(0.0, -1.2, 0.1), a.on(0.5, -1.0, 0.14), a.on(0.82, -0.7, 0.14), a.on(0.92, -0.25, 0.1), a.on(0.95, 0.3, 0.06), a.on(0.94, 0.8, 0.04), a.P(1.02, 1.4, 0.2), a.P(1.05, len - 0.05, 0.3)];
    curtain(a, wave(farB, 0.06, 0), wave(farA, 0.07, 0.4), T, { layer: 'hair', n: 16, shade: 'B', hi: [0.06, 0.3], hiSide: 0.5, nh: 8, tipJag: 5, seed: 23, inner: '' });
    var nearA = [part, a.on(-0.62, -1.1, 0.14), a.on(-0.86, -0.75, 0.16), a.on(-0.96, -0.3, 0.16), a.on(-1.0, 0.2, 0.16), a.on(-0.96, 0.75, 0.12), a.P(-1.05, 1.35, 0.2), a.P(-1.15, len, 0.25)];
    var nearB = [part, a.rim(255, 0.32), a.rim(222, 0.36), a.rim(192, 0.4), a.rim(165, 0.42), a.P(-1.75, 1.0, -0.3), a.P(-1.8, 1.6, -0.2), a.P(-1.75, len, -0.1)];
    curtain(a, wave(nearA, 0.07, 1.0), wave(nearB, 0.09, 1.6), T, { layer: 'hair', n: 18, shade: 'B', hi: [0.05, 0.28], hiSide: 0.35, nh: 10, tipJag: 6, seed: 31 });
    // grey streaks running back from the temples and in the waves
    if (grey) {
      [[nearA, nearB, 0.2], [nearA, nearB, 0.65], [farB, farA, 0.35]].forEach(function (g, i) {
        var A = resample(wave(g[0], 0.07, 1.0), 16), B = resample(wave(g[1], 0.09, 1.6), 16), st = [];
        for (var j = 1; j < 14; j++) st.push(mid(A[j], B[j], g[2]));
        a.add('hairTop', a.el(taper(st, [0, S * 0.12 * grey * 2, S * 0.03], 3), Tg.light, { op: 0.75 }) + a.ink(st, [0, 0.8, 0], { col: rgb(Tg.hi), op: 0.6 }));
      });
    }
    castOnSkin(a, [a.on(-1.0, -1.4), a.on(-0.62, -1.0), a.on(-0.82, -0.66), a.on(-0.9, -0.2), a.on(-0.9, 0.7), a.on(-1.3, 1.2)], 0.55);
    castOnSkin(a, [a.on(1.1, -1.3), a.on(0.3, -1.1), a.on(0.7, -0.7), a.on(0.84, -0.3), a.on(0.88, 0.6), a.on(1.2, 1.0)], 0.5);
  };
  /* Father Sava: long grey hair drawn back behind the ears, gathered at the nape */
  HAIR.priest = function (a, c, o) {
    var S = a.S, T = hairTones(c);
    var back = [a.rim(120, 0.2), a.P(-1.35, 1.3, -1.2), a.P(-1.2, 2.6, -1.4), a.P(0.2, 2.6, -1.8), a.P(1.1, 1.0, -0.9), a.rim(30, 0.16), a.rim(300, 0.2), a.rim(220, 0.24)];
    curtain(a, [back[0], back[1], back[2]], [back[7], back[6], back[5], back[4], back[3]], { base: T.shadow, shadow: T.deep, deep: T.deep, light: T.base, hi: T.light, line: T.line }, { layer: 'hairBack', n: 12, tipJag: 5, res: 18, hiOp: 0.5 });
    shortCap(a, T, { pad: 0.12, tuft: 0.02, step: 9, seed: 3, hairY: -1.0, whorl: a.P(-0.6, -1.0, -2.0), shW: 2.0, bend: 0.05, ear: true, low: 0.0 });
  };

  /* ================= HATS ================= */
  var HAT = {};
  function shapeFill(a, layer, pts, T, o) {
    o = o || {};
    var d = o.d || smooth(pts, true, o.ten === undefined ? 0.9 : o.ten), b = bbox(pts);
    var s = a.el(d, T.base) + a.g(a.el(d, a.lin(b.x0, b.y1, b.x1, b.y0, [[0, T.deep, o.dk === undefined ? 0.75 : o.dk], [0.5, T.base, 0], [1, T.light, o.lt === undefined ? 0.6 : o.lt]])) + (o.inner || ''), { clip: a.clip(d) });
    if (o.line !== false) s += a.el(d, 'none', { stroke: rgb(T.line), sw: o.lw || 1.6 });
    a.add(layer, s);
    return d;
  }
  function multShadow(a, pts, op, blur) { castOnSkin(a, pts, op, blur || 1.2); }
  /* an ellipse ring round the head's vertical axis: Y height, rx/rz radii, zc centre depth, tilt (front dips by tilt) */
  function ring(a, Y, rx, rz, zc, tilt, n, t0, t1) {
    var out = []; n = n || 24; t0 = t0 === undefined ? 0 : t0; t1 = t1 === undefined ? Math.PI * 2 : t1;
    for (var k = 0; k <= n; k++) { var t = t0 + (t1 - t0) * k / n, X = Math.cos(t) * rx, Z = zc + Math.sin(t) * rz; out.push(a.P(X, Y + (tilt || 0) * Math.sin(t), Z)); }
    return out;
  }
  /* flat cap (Gorazd, Tihomir): soft crown pulled forward over a short peak */
  HAT.flatcap = function (a, c) {
    var S = a.S, T = clothTones(c), r = rnd(61);
    var crown = [a.rim(166, 0.04), a.rim(190, 0.14), a.rim(215, 0.2), a.rim(240, 0.24), a.rim(265, 0.26), a.rim(290, 0.26), a.rim(315, 0.22), a.P(0.6, -1.3, 1.0), a.P(1.02, -1.02, 0.92), a.on(0.97, -0.64, 0.12)];
    var band = [a.on(0.6, -0.88, 0.1), a.on(0.0, -0.98, 0.1), a.on(-0.62, -0.9, 0.08), a.on(-0.98, -0.66, 0.06), a.P(-1.1, -0.48, -1.0)];
    var pts = crown.concat(band);
    var inner = '';
    // tweed: short flecks
    var b = bbox(pts);
    for (var k = 0; k < 120; k++) { var px = lerp(b.x0, b.x1, r()), py = lerp(b.y0, b.y1, r()); inner += a.ink([[px, py], [px + 2.2, py + 1.1]], [0.2, 0.9, 0.2], { col: rgb(r() > 0.5 ? T.light : T.deep), op: 0.4 }); }
    // the seam where the crown folds over the band and the fold across the top
    inner += a.ink([a.P(-1.05, -0.62, -0.6), a.P(-0.5, -1.05, 0.9), a.P(0.4, -1.12, 1.2), a.P(1.0, -0.9, 0.9)], [0.4, 1.6, 0.4], { col: rgb(T.deep), op: 0.75 });
    inner += a.ink([a.rim(230, 0.22), a.P(-0.5, -1.35, 0.4), a.P(0.2, -1.32, 0.9)], [0.2, 1.2, 0.2], { col: rgb(T.deep), op: 0.55 });
    inner += a.el(taper([a.P(-0.3, -1.4, 0.2), a.P(0.3, -1.38, 0.8), a.P(0.85, -1.15, 0.9)], [0, S * 0.12, 0], 3), T.hi, { op: 0.4 });
    var bt = a.P(-0.15, -1.48, 0.1);
    inner += '<circle cx="' + f(bt[0]) + '" cy="' + f(bt[1]) + '" r="' + f(S * 0.07) + '" fill="' + rgb(T.shadow) + '" stroke="' + rgb(T.line) + '" stroke-width="0.8"/>';
    shapeFill(a, 'hat', pts, T, { inner: inner, ten: 0.8 });
    // the peak: stiff, short, tipped down
    var pk = [a.on(-0.86, -0.78, 0.12), a.P(-0.3, -0.88, 1.15), a.P(0.4, -0.84, 1.35), a.P(1.0, -0.7, 1.05), K(a.P(1.12, -0.6, 0.7)), a.on(0.92, -0.58, 0.12), a.on(0.3, -0.84, 0.14)];
    shapeFill(a, 'hat', pk, clothTones(mul(hx(c), 0.82)), { lt: 0.3, ten: 0.8 });
    a.add('hat', a.ink([pk[1], pk[2], pk[3]].map(function (p) { return [p[0], p[1] + 1.5]; }), [0.6, 1.2, 0.6], { col: rgb(T.light), op: 0.4 }));
    multShadow(a, [a.on(-1.2, -1.0, 0), a.on(-0.95, -0.4, 0), a.on(-0.3, -0.25), a.on(0.5, -0.32, 0), a.on(1.0, -0.3, 0), a.on(1.2, -1.0, 0)], 0.75, 1.4);
  };
  /* kamilavka: the Orthodox priest's tall black cylinder hat with a flat top */
  HAT.kamilavka = function (a, c) {
    var S = a.S, T = clothTones(c);
    var zc = -0.55, rx = 1.18, rz = 1.5, y0 = -0.9, h = 0.82;
    var bot = ring(a, y0, rx, rz, zc, 0.06, 28, 0, Math.PI), top = ring(a, y0 - h, rx * 1.06, rz * 1.06, zc, 0.04, 28, 0, Math.PI);
    var botB = ring(a, y0, rx, rz, zc, 0.06, 28, Math.PI, Math.PI * 2), topB = ring(a, y0 - h, rx * 1.06, rz * 1.06, zc, 0.04, 28, Math.PI, Math.PI * 2);
    // silhouette: left and right extremes of the two rings
    function ext(list) { var l = list[0], rr = list[0]; list.forEach(function (p) { if (p[0] < l[0]) l = p; if (p[0] > rr[0]) rr = p; }); return { l: l, r: rr }; }
    var eb = ext(bot.concat(botB)), et = ext(top.concat(topB));
    var front = bot.filter(function (p) { return p[0] >= eb.l[0] && p[0] <= eb.r[0]; }).sort(function (p, q) { return q[0] - p[0]; });
    var tfront = top.slice().sort(function (p, q) { return p[0] - q[0]; });
    var pts = [K(eb.l), K(et.l)].concat(topB.slice().sort(function (p, q) { return p[0] - q[0]; }).filter(function (p, i) { return i % 3 === 0; })).concat([K(et.r), K(eb.r)]).concat(front);
    var d = smooth(pts, true, 0.4), b = bbox(pts), inner = '';
    inner += a.el(d, a.lin(b.x0, 0, b.x1, 0, [[0, [6, 5, 7], 0.9], [0.45, T.base, 0], [0.75, T.light, 0.35], [0.9, T.base, 0], [1, T.deep, 0.5]]));
    inner += a.el(taper([[lerp(b.x0, b.x1, 0.68), b.y0 + S * 0.15], [lerp(b.x0, b.x1, 0.7), b.y1 - S * 0.2]], [S * 0.06, S * 0.1, S * 0.06], 2), T.hi, { op: 0.3, blur: 1 });
    // a little brim seam at the top
    inner += a.ink(tfront, 1.2, { col: rgb(T.light), op: 0.35 });
    a.add('hat', a.el(d, T.base) + a.g(inner, { clip: a.clip(d) }) + a.el(d, 'none', { stroke: '#050405', sw: 1.6 }));
    a.add('hat', a.ink(front, [1.4, 2.0, 1.4], { col: '#050405' }));
    multShadow(a, [a.on(-1.2, -1.2, 0), a.on(-0.95, -0.55, 0), a.on(0, -0.7, 0), a.on(0.95, -0.6, 0), a.on(1.2, -1.2, 0)], 0.65, 1.4);
  };
  /* felt hat with a brim (Radoje) */
  HAT.brim = function (a, c) {
    var S = a.S, T = clothTones(c);
    var zc = -0.55, yb = -0.92;
    var brimF = ring(a, yb, 1.95, 2.15, zc, 0.12, 24, -0.15, Math.PI + 0.15), brimB = ring(a, yb, 1.95, 2.15, zc, 0.12, 24, Math.PI, Math.PI * 2);
    var brimAll = ring(a, yb, 1.95, 2.15, zc, 0.12, 36);
    a.add('hairBack', a.el(smooth(brimAll, true), T.shadow, { stroke: rgb(T.line), sw: 1.4 }));
    // crown with a pinched crease
    var cb = ring(a, yb - 0.02, 1.2, 1.45, zc, 0.04, 16, 0, Math.PI), ct = ring(a, yb - 0.95, 1.05, 1.3, zc, 0.04, 16, 0, Math.PI);
    var crown = [ring(a, yb, 1.2, 1.45, zc, 0.04, 1, Math.PI, Math.PI)[0], a.P(-1.12, yb - 0.75, zc), a.P(-0.7, yb - 1.08, zc + 0.2), a.P(0.0, yb - 0.92, zc + 1.0), a.P(0.6, yb - 1.1, zc + 0.6), a.P(1.12, yb - 0.75, zc + 0.2), ring(a, yb, 1.2, 1.45, zc, 0.04, 1, 0, 0)[0]].concat(cb.slice().sort(function (p, q) { return q[0] - p[0]; }));
    var inner = a.ink([a.P(-0.35, yb - 1.05, zc + 0.6), a.P(0.0, yb - 0.85, zc + 1.1), a.P(0.4, yb - 1.05, zc + 0.9)], [0.4, 1.6, 0.4], { col: rgb(T.deep), op: 0.8 });
    // band
    var bandTop = ring(a, yb - 0.2, 1.2, 1.45, zc, 0.04, 16, 0, Math.PI), bandBot = ring(a, yb - 0.02, 1.2, 1.45, zc, 0.04, 16, 0, Math.PI);
    shapeFill(a, 'hat', crown, T, { inner: inner, ten: 0.7 });
    var band = bandTop.concat(bandBot.slice().reverse());
    a.add('hat', a.el(smooth(band, true), mul(hx(c), 0.5)));
    // the front of the brim over the face
    var fb = brimF.concat(cb.slice().sort(function (p, q) { return q[0] - p[0]; }).map(function (p) { return [p[0], p[1] + 1]; }));
    shapeFill(a, 'hat', brimF.concat(bandBot.slice().sort(function (p, q) { return p[0] - q[0]; }).reverse()), clothTones(mul(hx(c), 1.1)), { lt: 0.5, ten: 0.7 });
    multShadow(a, [a.on(-1.3, -1.0, 0), a.on(-1.0, -0.15, 0), a.on(0, -0.05, 0), a.on(1.0, -0.15, 0), a.on(1.3, -1.0, 0)], 0.7, 1.6);
  };
  /* a boy's peaked cap (Luka) */
  HAT.peaked = function (a, c) {
    var S = a.S, T = clothTones(c);
    var crown = a.rims([[140, 0.08], [160, 0.16], [185, 0.22], [215, 0.26], [245, 0.28], [275, 0.28], [305, 0.26], [330, 0.22], [352, 0.16], [8, 0.1]]);
    var front = [a.on(0.96, -0.6, 0.1), a.on(0.6, -0.88, 0.12), a.on(0.0, -0.98, 0.12), a.on(-0.6, -0.9, 0.1), a.on(-0.97, -0.66, 0.08), a.P(-1.1, -0.45, -1.0)];
    var inner = '';
    [[-0.5], [0.15], [0.7]].forEach(function (q) { inner += a.ink([a.on(q[0], -0.95, 0.14), a.on(q[0] * 0.6, -1.45, 0.4), a.P(q[0] * 0.2, -1.7, -0.3)], [0.4, 1.0, 0.2], { col: rgb(T.deep), op: 0.6 }); });
    shapeFill(a, 'hat', crown.concat(front), T, { inner: inner });
    var pk = [a.on(-0.75, -0.86, 0.14), a.P(0.0, -0.9, 1.25), a.P(0.8, -0.78, 1.25), K(a.P(1.15, -0.62, 0.8)), a.on(0.9, -0.62, 0.14), a.on(0.2, -0.9, 0.15)];
    shapeFill(a, 'hat', pk, clothTones(mul(hx(c), 0.75)), { lt: 0.3, ten: 0.8 });
    var bt = a.P(-0.1, -1.72, -0.2);
    a.add('hat', '<circle cx="' + f(bt[0]) + '" cy="' + f(bt[1]) + '" r="' + f(S * 0.07) + '" fill="' + rgb(T.shadow) + '" stroke="' + rgb(T.line) + '" stroke-width="0.8"/>');
    multShadow(a, [a.on(-1.2, -0.9, 0), a.on(-0.85, -0.45, 0), a.on(0.1, -0.3, 0), a.on(0.9, -0.4, 0), a.on(1.2, -0.9, 0)], 0.7, 1.4);
  };
  /* flower wreath (Mila) */
  HAT.wreath = function (a) {
    var S = a.S, s = '', sb = '', r = rnd(88);
    var cols = [[196, 52, 48], [236, 226, 206], [70, 96, 170], [222, 170, 60], [196, 52, 48]];
    var zc = -0.5, rx = 1.2, rz = 1.5;
    for (var k = 0; k <= 22; k++) {
      var t = k / 22 * Math.PI * 2, X = Math.cos(t) * rx, Z = zc + Math.sin(t) * rz, Y = -1.12 - Math.sin(t) * 0.12;
      var p = a.P(X, Y, Z), front = Math.sin(t) > -0.15;
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
  /* o: { pad (how far it stands off the jaw), drop (below the chin), top (cheek line height), long, cheek } */
  function beardGeneric(a, c, o) {
    var S = a.S, T = hairTones(c), fc = a.fc, my = fc.mouthY, mw = fc.mouthW * 1.12, ny = fc.noseY, ol = a.outline(), r = rnd(71);
    var E = a.ear && a.ear.E;
    // top edge across the near cheek: from in front of the ear down to the corner of the mouth, then the far cheek
    var nearTop = [a.on(-0.99, 0.12 - (o.side || 0), 0.02), a.on(-0.86, o.cheek - 0.08, 0.03), a.on(-0.62, o.cheek + 0.06, 0.03), a.on(-mw - 0.1, my - 0.12, 0.05)];
    var farTop = [a.on(mw + 0.08, my - 0.12, 0.05), a.on(0.62, o.cheek + 0.04, 0.03), a.on(0.86, o.cheek - 0.1, 0.03)];
    // bottom: the jaw silhouette pushed outward and down
    var jl = [], jr = [], Y;
    for (Y = 0.3; Y <= fc.chinB - 0.01; Y += 0.06) { var e = a.ext(Y), t = (Y - 0.3) / (fc.chinB - 0.3); jl.push([e.l[0] - S * o.pad * t * 0.8, e.l[1] + S * o.pad * t * 0.9]); }
    for (Y = fc.chinB - 0.01; Y >= fc.cheekY + 0.05; Y -= 0.06) { var e2 = a.ext(Y), t2 = (Y - 0.3) / (fc.chinB - 0.3); jr.push([e2.r[0] + a.farBump(Y) * S + S * o.pad * Math.max(0, t2) * 0.5, e2.r[1] + S * o.pad * Math.max(0, t2) * 0.9]); }
    var chin = a.P(0.05, fc.chinB + o.drop, 0.7);
    var bottom;
    if (o.long) {
      var cl = a.bp ? a.bp(-0.55, o.long) : [chin[0] - S * 0.4, chin[1] + S * 1.5], cr = a.bp ? a.bp(0.55, o.long - 0.1) : [chin[0] + S * 0.3, chin[1] + S * 1.4], ct = a.bp ? a.bp(0.0, o.long + 0.35) : chin;
      bottom = [[jl[jl.length - 1][0] - S * 0.2, jl[jl.length - 1][1] + S * 0.3], cl, K(ct), cr, [jr[0][0] + S * 0.15, jr[0][1] + S * 0.25]];
    } else bottom = [chin];
    var pts = nearTop.slice().reverse().concat([]);
    pts = jl.concat(bottom).concat(jr).concat(farTop.slice().reverse()).concat(nearTop.slice().reverse());
    // the mouth shows through: a hole below the lower lip
    var mi = a.mouthInfo, hole = '';
    if (mi && !o.noHole) { var hp = mi.LB.slice(2, mi.LB.length - 2).map(function (p) { return [p[0], p[1] + S * 0.05]; }); hole = smooth(hp.concat(mi.UT.slice(2, mi.UT.length - 2).reverse()), true); }
    var d = smooth(pts, true, 0.8), b = bbox(pts), inner = '';
    inner += a.el(d, a.lin(b.x0, b.y0, b.x1, b.y0, [[0, T.deep, 0.75], [0.45, T.base, 0], [0.8, T.light, 0.35]]));
    // hair flowing down from the cheeks, curling under the chin
    var n = o.long ? 50 : 40;
    for (var k = 0; k < n; k++) {
      var u = r(), v = r(), x = lerp(b.x0, b.x1, u), y = lerp(b.y0, b.y1, v * 0.95), len = S * (o.long ? 0.25 + v * 0.35 : 0.12 + v * 0.08);
      var dir = (x - (b.x0 + b.x1) / 2) / (b.x1 - b.x0) * 0.6;
      inner += a.ink([[x, y], [x + dir * len * 0.5, y + len * 0.5], [x + dir * len - 0.5, y + len]], [0.2, (o.long ? 1.2 : 1.0), 0.1], { col: rgb(r() > 0.4 ? T.deep : T.line), op: 0.6 });
    }
    for (k = 0; k < (o.long ? 18 : 12); k++) {
      var u2 = 0.5 + r() * 0.45, v2 = r() * 0.8, x2 = lerp(b.x0, b.x1, u2), y2 = lerp(b.y0, b.y1, v2), l2 = S * (o.long ? 0.3 : 0.12);
      inner += a.el(taper([[x2, y2], [x2 + 0.5, y2 + l2 * 0.5], [x2 + 1, y2 + l2]], [0, 1.4, 0], 3), T.hi, { op: 0.55 });
    }
    // the jaw's shadow under the mouth
    if (mi) inner += a.el(smooth(mi.LB.map(function (p) { return [p[0], p[1] + S * 0.08]; }).concat([[mi.LB[mi.LB.length - 1][0], mi.LB[0][1] + S * 0.3]]), true), T.deep, { op: 0.5, blur: 1.2 });
    var full = d + (hole ? ' ' + hole : '');
    var s = '<path d="' + full + '" fill="' + rgb(T.base) + '" fill-rule="evenodd"/>';
    var cid = a.id('cp'); a.addDef('<clipPath id="' + cid + '"><path d="' + full + '" clip-rule="evenodd"/></clipPath>');
    s += a.g(inner, { clip: 'url(#' + cid + ')' });
    // a soft, broken outline: hair edges are not hard lines
    s += a.ink(jl.concat(bottom).concat(jr), [0.8, 1.6, 0.8], { col: rgb(T.line), op: 0.9 });
    s += a.ink(nearTop, [0.3, 0.9, 0.5], { col: rgb(T.line), op: 0.5 });
    s += a.ink(farTop, [0.5, 0.8, 0.2], { col: rgb(T.line), op: 0.45 });
    a.add('beard', s);
    MUST.thick(a, c, { beard: 1 });
  }
  BEARD.full = function (a, c, o) { beardGeneric(a, c, { pad: 0.2, drop: 0.32, cheek: 0.42, side: 0.1 }); };
  BEARD.short = function (a, c, o) { beardGeneric(a, c, { pad: 0.08, drop: 0.12, cheek: 0.55 }); };
  BEARD.long = function (a, c, o) { beardGeneric(a, c, { pad: 0.22, drop: 0.5, cheek: 0.45, long: 2.6, side: 0.1 }); };
  var MUST = {};
  /* two halves sweeping from under the nose to past the corners of the mouth */
  function mustache(a, c, o) {
    var S = a.S, T = hairTones(c), fc = a.fc, my = fc.mouthY, mw = fc.mouthW * 1.12 * (o.w || 1), ny = fc.noseY, dr = o.droop || 0, th = o.th || 0;
    var s = '';
    [-1, 1].forEach(function (sd) {
      var top = a.onL([[sd * 0.03, ny + 0.1], [sd * mw * 0.5, ny + 0.1], [sd * (mw + 0.04), my - 0.08 + dr * 0.3], [sd * (mw + 0.1), my + dr]], 0.1);
      var bot = a.onL([[sd * 0.02, my - 0.05 + (o.cover || 0)], [sd * mw * 0.5, my - 0.04 + (o.cover || 0)], [sd * (mw + 0.02), my - 0.01 + dr * 0.6], [sd * (mw + 0.1), my + dr]], 0.11);
      var pts = top.concat(bot.slice(0, 3).reverse());
      var d = smooth(pts, true, 0.75), b = bbox(pts), inner = '';
      inner += a.el(d, a.lin(b.x0, b.y0, b.x0, b.y1, [[0, T.light, 0.5], [0.5, T.base, 0], [1, T.deep, 0.7]]));
      for (var k = 0; k <= 8; k++) {
        var u = k / 8, X = sd * lerp(0.03, mw + 0.06, u);
        var q0 = a.on(X * 0.85, ny + 0.1, 0.12), q1 = a.on(X, lerp(my - 0.04, my + dr * 0.9, u * u), 0.12);
        inner += a.ink([q0, q1], [0.3, 1.0, 0.2], { col: rgb(k % 2 ? T.deep : T.line), op: 0.7 });
        if (k % 3 === 1) inner += a.el(taper([mid(q0, q1, 0.15), mid(q0, q1, 0.55)], [0, 1.3, 0], 2), T.hi, { op: 0.6 });
      }
      s += a.el(d, T.base) + a.g(inner, { clip: a.clip(d) }) + a.ink(top.slice(1).concat([bot[3]]), [0.6, 1.2, 0.8], { col: rgb(T.line), op: 0.85 }) + a.ink(bot.slice(0, 4), [0.4, 1.0, 0.8], { col: rgb(T.line), op: 0.9 });
    });
    a.add('beard', s);
  }
  MUST.thick = function (a, c, o) { mustache(a, c, { droop: o && o.beard ? 0.04 : 0.08, w: 1.0, cover: 0.0 }); };
  MUST.walrus = function (a, c, o) { mustache(a, c, { droop: 0.18, w: 1.15, cover: 0.05 }); };

  /* ================= OUTFITS ================= */
  var OUT = {};
  /* body frame: x, y in head units from the pit of the neck (y down); the chest is a shallow curved surface and
     the torso turns less than the head, so the near (screen-left) shoulder looks broader */
  function bodyFrame(a) {
    var nb = a.neckBase, yb = a.yaw * 0.62, S = a.S * (a.pd.bodyK || 1);
    var cx = nb.m[0] + S * 0.12, cy = nb.m[1] - S * 0.5;
    a.byaw = yb;
    a.bp = function (x, y, z) {
      var zz = z === undefined ? 0.95 * (Math.sqrt(Math.max(0, 1 - Math.pow(x / 2.5, 2))) - 1) : z;
      return [cx + S * (x * Math.cos(yb) + zz * Math.sin(yb)), cy + S * y];
    };
    a.bpL = function (l) { return l.map(function (p) { var q = a.bp(p[0], p[1], p[2]); if (p.s) q.s = 1; return q; }); };
  }
  function fillBody(a, pts, T, layer, extra, o) {
    o = o || {};
    var d = smooth(pts, true, o.ten === undefined ? 0.8 : o.ten), cp = a.clip(d), b = bbox(pts);
    var s = a.el(d, T.base);
    // light from the upper right: the near side of the body turns into shadow
    var inner = a.el(d, a.lin(b.x0, b.y0, b.x1, b.y0 + (b.x1 - b.x0) * 0.3, [[0, T.shadow, 0.9], [0.35, T.shadow, 0.35], [0.55, T.base, 0], [1, T.light, 0.55]]));
    inner += extra || '';
    s += a.g(inner, { clip: cp });
    s += a.el(d, 'none', { stroke: rgb(T.line), sw: o.lw || 1.6, op: 0.95 });
    a.add(layer || 'body', s);
    return { d: d, clip: cp };
  }
  function fold(a, pts, T, w, op) { return a.ink(a.bpL(pts), w || [0, 1.4, 0], { col: rgb(T.deep), op: op || 0.7 }); }
  function foldLight(a, pts, T, w, op) { return a.ink(a.bpL(pts), w || [0, 1.6, 0], { col: rgb(T.light), op: op || 0.5 }); }
  /* cel-shaded plane inside a garment */
  function plane(a, pts, col, op, blur) { return a.el(smooth(a.bpL(pts), true), col, { op: op, blur: blur === undefined ? 0.6 : blur }); }
  function shoulders(a, o) {
    var sw = (o.sw || 2.2) * (a.pd.shoulders || 1), sl = o.slope === undefined ? 0.36 : o.slope, nB = o.nB || 0.62;
    return { sw: sw, sl: sl, nB: nB,
      L: [[-sw - 0.55, 4.6], [-sw - 0.28, 1.7], [-sw - 0.05, 0.85], [-sw + 0.22, 0.44], [-sw + 0.85, sl * 0.42], [-nB - 0.12, -0.02]],
      R: [[nB + 0.12, -0.02], [sw - 0.85, sl * 0.42], [sw - 0.22, 0.44], [sw + 0.05, 0.85], [sw + 0.28, 1.7], [sw + 0.55, 4.6]] };
  }
  function neckline(kind, nB, depth) {
    if (kind === 'v') return [[-nB, -0.04], [-nB * 0.62, 0.3], K([0, depth || 1.0]), [nB * 0.62, 0.3], [nB, -0.04]];
    if (kind === 'scoop') return [[-nB - 0.05, -0.04], [-nB * 0.8, 0.4], [0, depth || 0.65], [nB * 0.8, 0.4], [nB + 0.05, -0.04]];
    if (kind === 'crew') return [[-nB, -0.06], [-nB * 0.7, 0.16], [0, 0.26], [nB * 0.7, 0.16], [nB, -0.06]];
    return [[-nB, -0.12], [0, 0.04], [nB, -0.12]];
  }
  /* skin of the chest showing in an open neckline, with collarbones */
  function chest(a, depth) {
    var sk = a.skin, S = a.S;
    var pts = a.bpL([[-0.8, -0.1], [0.8, -0.1], [0.7, depth + 0.3], [-0.7, depth + 0.3]]);
    var d = smooth(pts, true), inner = '';
    inner += a.el(d, a.lin(pts[0][0], 0, pts[1][0], 0, [[0, sk.shadow, 0.8], [0.45, sk.base, 0], [1, sk.light, 0.3]]));
    inner += plane(a, [[-0.9, -0.3], [0.5, -0.3], [0.4, 0.05], [0, 0.22], [-0.5, 0.18], [-0.9, 0.1]], sk.shadow, 0.75, 0.8);
    inner += a.ink(a.bpL([[-0.75, 0.2], [-0.4, 0.28], [-0.12, 0.3]]), [0.1, 0.9, 0.2], { op: 0.45 });
    inner += a.ink(a.bpL([[0.12, 0.3], [0.4, 0.27], [0.72, 0.18]]), [0.2, 0.8, 0.1], { op: 0.35 });
    inner += plane(a, [[-0.08, 0.32], [0.08, 0.32], [0.04, 0.5], [-0.04, 0.5]], sk.shadow, 0.35, 1);
    a.add('bodyBack', a.el(d, sk.base) + a.g(inner, { clip: a.clip(d) }));
  }
  /* a garment for the torso: o = { col, neck: crew|v|scoop|high, depth, sw, slope, sleeveSeam, folds, back: collar behind the neck } */
  function garment(a, o) {
    var T = clothTones(o.col), sh = shoulders(a, o), nB = sh.nB;
    var nl = neckline(o.neck || 'crew', nB, o.depth);
    if (o.neck === 'v' || o.neck === 'scoop') chest(a, o.depth || 0.8);
    // the back of the garment seen behind the neck
    if (o.back !== false) {
      var bk = a.bpL([[-nB - 0.14, 0.02], [-nB * 0.95, -0.28], [-0.2, -0.42], [nB * 0.8, -0.34], [nB + 0.14, 0.02]]);
      a.add('bodyBack', a.el(smooth(bk, true), T.deep) + a.el(smooth(bk, true), 'none', { stroke: rgb(T.line), sw: 1.3 }));
    }
    var pts = a.bpL(sh.L.concat(nl).concat(sh.R));
    var ex = '';
    // cast shadow of the head and neck on the chest
    ex += plane(a, [[-nB - 0.3, -0.1], [nB * 0.4, -0.1], [nB * 0.5, 0.25], [0, 0.55], [-0.6, 0.6], [-nB - 0.5, 0.45]], T.shadow, 0.7, 0.9);
    // near shoulder top catches some light; under the near arm, a deep plane
    ex += plane(a, [[-sh.sw - 0.6, 1.0], [-sh.sw + 0.55, 1.1], [-sh.sw + 0.7, 4.6], [-sh.sw - 0.8, 4.6]], T.deep, 0.45, 1.2);
    ex += plane(a, [[sh.sw - 0.95, 0.2], [sh.sw - 0.3, 0.38], [sh.sw + 0.02, 0.8], [sh.sw - 0.5, 0.7], [sh.sw - 1.0, 0.45]], T.hi, 0.3, 1.2);
    // sleeve seams (armholes)
    if (o.sleeveSeam !== false) {
      ex += a.ink(a.bpL([[-sh.sw + 0.6, 0.18], [-sh.sw + 0.45, 0.9], [-sh.sw + 0.62, 1.8]]), [0.2, 1.2, 0.4], { col: rgb(T.line), op: 0.7 });
      ex += a.ink(a.bpL([[sh.sw - 0.6, 0.2], [sh.sw - 0.45, 0.9], [sh.sw - 0.62, 1.8]]), [0.2, 1.0, 0.4], { col: rgb(T.line), op: 0.55 });
    }
    // folds: from the armpits toward the middle
    if (o.folds !== false) {
      ex += fold(a, [[-sh.sw + 0.6, 1.4], [-1.0, 1.8], [-0.5, 2.4]], T, [0, 1.3, 0], 0.55);
      ex += fold(a, [[sh.sw - 0.6, 1.3], [1.1, 1.8], [0.7, 2.3]], T, [0, 1.1, 0], 0.45);
      ex += foldLight(a, [[sh.sw - 0.7, 1.45], [1.15, 1.95]], T, [0, 1.6, 0], 0.4);
    }
    if (o.extra) ex += o.extra(T, sh);
    fillBody(a, pts, T, 'body', ex);
    return { T: T, sh: sh };
  }
  /* an outer layer open at the front: blazer, coat, cardigan, vest, jacket. o = { col, open, lapel, vest, closeY, buttons, collarUp } */
  function outer(a, o) {
    var T = clothTones(o.col), sh = shoulders(a, { sw: (o.sw || 2.2) + 0.08, slope: o.slope, nB: (o.nB || 0.62) + 0.06 }), nB = sh.nB, sw = sh.sw;
    var op = o.open === undefined ? 0.5 : o.open, cy = o.closeY || 2.2;
    // standing collar behind the neck
    if (o.collarBack !== false) {
      var cb = a.bpL([[-nB - 0.2, 0.1], [-nB - 0.05, -0.4], [-0.1, -0.58], [nB * 0.8, -0.46], [nB + 0.2, 0.1]]);
      a.add('bodyBack', a.el(smooth(cb, true), T.shadow) + a.g(a.el(smooth(cb, true), T.deep, { op: 0.5 }), {}) + a.el(smooth(cb, true), 'none', { stroke: rgb(T.line), sw: 1.4 }));
    }
    [-1, 1].forEach(function (sd) {
      var side = sd < 0 ? sh.L.slice() : sh.R.slice().reverse();
      if (o.vest) side = sd < 0 ? [[-sw + 0.25, 4.6], [-sw + 0.55, 1.8], [-sw + 0.45, 0.9], [-sw + 0.75, 0.24], [-nB - 0.12, -0.02]] : [[sw - 0.25, 4.6], [sw - 0.55, 1.8], [sw - 0.45, 0.9], [sw - 0.75, 0.26], [nB + 0.12, -0.02]];
      // edge of the opening, from the neck down
      var edge = [[sd * (nB + 0.0), 0.0], [sd * (nB * 0.55 + op * 0.4), 0.55], [sd * op, cy], [sd * (op + 0.05), 4.6]];
      if (sd > 0 && o.overlap) edge = [[nB, 0.0], [nB * 0.5, 0.6], [-op * 0.2, cy], [-op * 0.2, 4.6]];
      var pts = side.concat(edge.slice().reverse());
      if (sd > 0) pts = edge.concat(side);
      var ex = '';
      if (sd < 0) {
        ex += plane(a, [[-sw - 0.6, 0.6], [-sw + 0.6, 0.9], [-sw + 0.75, 4.6], [-sw - 0.8, 4.6]], T.deep, 0.5, 1.2);
        ex += fold(a, [[-sw + 0.5, 1.2], [-1.3, 1.9], [-0.95, 2.8]], T, [0, 1.4, 0], 0.55);
        if (!o.vest) ex += a.ink(a.bpL([[-sw + 0.62, 0.2], [-sw + 0.46, 0.95], [-sw + 0.62, 1.9]]), [0.2, 1.3, 0.4], { col: rgb(T.line), op: 0.75 });
      } else {
        ex += plane(a, [[sw - 1.0, 0.18], [sw - 0.3, 0.36], [sw + 0.05, 0.85], [sw - 0.5, 0.75], [sw - 1.1, 0.45]], T.hi, 0.35, 1.2);
        ex += fold(a, [[sw - 0.5, 1.2], [1.4, 1.9], [1.1, 2.6]], T, [0, 1.2, 0], 0.45);
        if (!o.vest) ex += a.ink(a.bpL([[sw - 0.62, 0.22], [sw - 0.46, 0.95], [sw - 0.62, 1.9]]), [0.2, 1.1, 0.4], { col: rgb(T.line), op: 0.6 });
      }
      // the layer below casts a shadow along the opening
      ex += a.ink(a.bpL(edge.slice(1)).map(function (p) { return [p[0] + sd * 1.5, p[1]]; }), [1.5, 2.5, 2.5], { col: rgb(T.deep), op: 0.5 });
      if (o.texture) ex += o.texture(T, sd);
      fillBody(a, a.bpL(pts), T, 'bodyTop', ex);
      if (o.lapel) {
        var lp = [[sd * (nB + 0.1), -0.06], [sd * (nB + 0.32), 0.3], K([sd * (nB + 0.12), 0.42]), [sd * (op + 0.55), 1.0], K([sd * op, cy]), [sd * (nB * 0.5 + op * 0.45), 0.6], [sd * (nB - 0.02), 0.02]];
        if (o.lapel === 'shawl') lp = [[sd * (nB + 0.12), -0.06], [sd * (nB + 0.42), 0.5], [sd * (op + 0.45), 1.3], K([sd * op, cy]), [sd * (nB * 0.5 + op * 0.45), 0.6], [sd * (nB - 0.02), 0.02]];
        var Tl = clothTones(mix(T.base, sd > 0 ? T.light : T.shadow, 0.35));
        var lex = a.ink(a.bpL([[sd * (nB + 0.25), 0.3], [sd * (op + 0.45), 1.05], [sd * (op + 0.05), cy - 0.1]]).map(function (p) { return [p[0] - sd * 1.2, p[1] + 1.5]; }), [1, 2.2, 1], { col: rgb(T.deep), op: 0.5 });
        fillBody(a, a.bpL(lp), Tl, 'bodyTop', lex, { lw: 1.4 });
      }
    });
    if (o.buttons) for (var i = 0; i < o.buttons; i++) {
      var bpnt = a.bp(op + 0.25, cy + 0.15 + i * 0.75);
      a.add('bodyTop', '<circle cx="' + f(bpnt[0]) + '" cy="' + f(bpnt[1]) + '" r="' + f(a.S * 0.07) + '" fill="' + rgb(T.shadow) + '" stroke="' + rgb(T.line) + '" stroke-width="0.9"/>');
    }
    return T;
  }
  /* a waistcoat: two front panels with deep armholes, buttoned below a V */
  function vest(a, o) {
    var T = clothTones(o.col), nB = 0.62, sw = (o.sw || 2.25) * (a.pd.shoulders || 1), op = o.open === undefined ? 0.06 : o.open, cy = o.closeY || 1.5;
    [-1, 1].forEach(function (sd) {
      var pts = [K([sd * (nB + 0.02), -0.08]), K([sd * (nB + 0.55), 0.04]), [sd * (sw - 0.9), 0.45], [sd * (sw - 0.78), 1.1], K([sd * (sw - 0.6), 1.75]), K([sd * (sw - 0.45), 4.6]), K([sd * op, 4.6]), K([sd * op, cy]), [sd * (nB * 0.3 + op * 0.5), 0.75]];
      var ex = '';
      if (sd < 0) {
        ex += plane(a, [[-sw, 0.4], [-sw + 0.95, 0.6], [-sw + 1.1, 4.6], [-sw, 4.6]], T.deep, 0.55, 0.8);
        ex += fold(a, [[-sw + 0.6, 2.2], [-1.2, 2.6], [-0.7, 3.2]], T, [0, 1.3, 0], 0.5);
      } else {
        ex += plane(a, [[nB + 0.2, 0.0], [nB + 0.6, 0.1], [sw - 0.8, 0.6], [sw - 0.9, 1.4], [nB + 0.4, 0.8]], T.hi, 0.3, 1);
        ex += fold(a, [[sw - 0.6, 2.2], [1.3, 2.6]], T, [0, 1.1, 0], 0.4);
      }
      // the shirt casts a soft shadow along the front edge
      if (o.texture) ex += o.texture(T, sd);
      var bp = a.bpL(pts);
      fillBody(a, bp, sd < 0 ? clothTones(mul(T.base, 0.92)) : T, 'bodyTop', ex, { ten: 0.5 });
      // welt pocket
      var pk = a.bpL([[sd * (sw * 0.45), 2.6], [sd * (sw * 0.45 + 0.55), 2.55]]);
      a.add('bodyTop', a.ink(pk, 1.3, { col: rgb(T.line), op: 0.7 }));
    });
    for (var i = 0; i < 4; i++) {
      var b = a.bp(op + 0.2, cy + 0.15 + i * 0.7);
      a.add('bodyTop', '<circle cx="' + f(b[0]) + '" cy="' + f(b[1]) + '" r="' + f(a.S * 0.065) + '" fill="' + rgb(o.button || T.light) + '" stroke="' + rgb(T.line) + '" stroke-width="0.8"/>');
    }
  }
  /* a shirt collar: two points turned down at the throat, and the placket */
  function shirtCollar(a, col, o) {
    o = o || {};
    var T = clothTones(col), nB = (o.nB || 0.62);
    var spread = o.spread || 0.25;
    [-1, 1].forEach(function (sd) {
      var pts = [[sd * (nB + 0.08), -0.32], [sd * (nB + 0.22), 0.12], K([sd * (spread + 0.18), 0.62]), [sd * 0.06, 0.28], [sd * (nB - 0.1), -0.08]];
      var lex = a.ink(a.bpL([[sd * (nB + 0.2), 0.14], [sd * (spread + 0.2), 0.6]]).map(function (p) { return [p[0] + 1, p[1] + 2]; }), [1.2, 2, 1], { col: rgb(T.deep), op: 0.4 });
      fillBody(a, a.bpL(pts), sd > 0 ? T : clothTones(mul(T.base, 0.9)), 'bodyTop', lex, { lw: 1.3 });
    });
    // collar band behind the neck
    var cb = a.bpL([[-nB - 0.1, 0.0], [-nB * 0.95, -0.38], [-0.2, -0.5], [nB * 0.8, -0.42], [nB + 0.1, 0.0]]);
    a.add('bodyBack', a.el(smooth(cb, true), T.shadow) + a.el(smooth(cb, true), 'none', { stroke: rgb(T.line), sw: 1.3 }));
    if (o.placket !== false) {
      var pl = a.bpL([[0.04, 0.45], [0.08, 2.0], [0.1, 4.6]]);
      a.add('body', a.ink(pl, [1.0, 1.2, 1.2], { col: rgb(T.line), op: 0.6 }));
      for (var i = 0; i < 3; i++) { var b = a.bp(0.2, 0.95 + i * 0.85); a.add('body', '<circle cx="' + f(b[0]) + '" cy="' + f(b[1]) + '" r="' + f(a.S * 0.05) + '" fill="' + rgb(mix(T.base, [240, 236, 224], 0.5)) + '" stroke="' + rgb(T.line) + '" stroke-width="0.6"/>'); }
    }
  }
  /* embroidered band: little cross-stitch diamonds along a body-frame path */
  function embroidery(a, path, col, o) {
    o = o || {};
    var q = spline(a.bpL(path), 6), s = '', S = a.S, n = o.n || 10, step = Math.max(1, Math.floor(q.length / n)), c = hx(col), c2 = o.col2 ? hx(o.col2) : mul(c, 0.55), r = S * (o.r || 0.07);
    for (var i = 1; i < q.length - 1; i += step) {
      var p = q[i];
      s += '<path d="M' + f(p[0]) + ' ' + f(p[1] - r) + 'L' + f(p[0] + r) + ' ' + f(p[1]) + 'L' + f(p[0]) + ' ' + f(p[1] + r) + 'L' + f(p[0] - r) + ' ' + f(p[1]) + 'Z" fill="' + rgb(c) + '" stroke="' + rgb(c2) + '" stroke-width="0.6"/>';
      if (o.dots !== false) s += '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + f(r * 0.3) + '" fill="' + rgb(o.dotCol || [230, 200, 90]) + '"/>';
    }
    if (o.line !== false) { s += a.ink(offset(q, 0, -r * 1.4), 0.8, { col: rgb(c), op: 0.85 }); s += a.ink(offset(q, 0, r * 1.4), 0.8, { col: rgb(c), op: 0.85 }); }
    a.add(o.layer || 'bodyTop', s);
  }
  function apron(a, col, o) {
    o = o || {};
    var T = clothTones(col), w0 = o.w0 || 0.8, y0 = o.y0 || 0.9;
    var pts = [K([-w0, y0]), K([w0 * 1.02, y0 - 0.05]), K([w0 + 0.12, 4.6]), K([-w0 - 0.15, 4.6])];
    var ex = fold(a, [[-0.3, y0 + 0.4], [-0.35, 2.4]], T, [0, 1.1, 0], 0.4) + fold(a, [[0.4, y0 + 0.6], [0.45, 2.6]], T, [0, 1.0, 0], 0.35);
    if (o.extra) ex += o.extra(T);
    fillBody(a, a.bpL(pts), T, 'bodyTop', ex);
    // straps to the neck
    [-1, 1].forEach(function (sd) {
      var st = a.bpL([[sd * (w0 - 0.15), y0 + 0.02], [sd * 0.72, -0.05], [sd * 0.6, -0.4]]);
      a.add('bodyTop', a.ink(st, [S0(a) * 0.14, S0(a) * 0.12, S0(a) * 0.1], { col: rgb(T.line) }) + a.ink(st, [S0(a) * 0.1, S0(a) * 0.08, S0(a) * 0.06], { col: rgb(sd > 0 ? T.base : T.shadow) }));
    });
  }
  function S0(a) { return a.S; }

  OUT.hoodie = function (a, c, o) {
    var T = clothTones(c), S = a.S, Th = clothTones(mul(hx(c), 0.82));
    // hood bunched behind the neck
    var hood = a.bpL([[-1.75, 0.6], [-1.6, -0.15], [-1.2, -0.6], [-0.5, -0.8], [0.3, -0.78], [0.95, -0.6], [1.35, -0.15], [1.45, 0.5], [0.6, 0.6], [-0.6, 0.6]]);
    var hd = smooth(hood, true);
    a.add('bodyBack', a.el(hd, Th.shadow) + a.g(a.el(hd, a.lin(hood[1][0], hood[1][1], hood[6][0], hood[6][1], [[0, Th.deep], [1, Th.base]])) + a.ink(a.bpL([[-1.2, -0.3], [-0.6, -0.55], [0.2, -0.55]]), [0, 1.4, 0], { col: rgb(Th.line), op: 0.6 }), { clip: a.clip(hd) }) + a.el(hd, 'none', { stroke: rgb(T.line), sw: 1.6 }));
    garment(a, { col: c, neck: 'high', sw: 2.3, slope: 0.4, back: false });
    // the hood's front roll around the neck, meeting in a V
    var roll = a.bpL([[-1.35, 0.15], [-1.1, -0.3], [-0.6, -0.42], [-0.45, 0.1], [-0.12, 0.72], K([0.04, 0.88]), [0.2, 0.72], [0.5, 0.12], [0.62, -0.38], [1.05, -0.26], [1.2, 0.12], [0.8, 0.6], [0.1, 1.2], [-0.1, 1.2], [-0.9, 0.6]]);
    var rd = smooth(roll, true);
    var s2 = a.el(rd, T.base) + a.g(a.el(rd, a.lin(roll[0][0], roll[0][1], roll[10][0], roll[10][1], [[0, T.shadow], [0.5, T.base], [1, T.light]])) + a.ink(a.bpL([[-1.0, 0.0], [-0.75, 0.45], [-0.15, 1.05]]), [0, 1.5, 0], { col: rgb(T.deep), op: 0.65 }) + a.ink(a.bpL([[0.95, -0.05], [0.72, 0.4], [0.2, 1.0]]), [0, 1.4, 0], { col: rgb(T.deep), op: 0.55 }), { clip: a.clip(rd) }) + a.el(rd, 'none', { stroke: rgb(T.line), sw: 1.6 });
    // a dark t-shirt in the V
    var tv = a.bpL([[-0.45, 0.1], [0.5, 0.1], [0.05, 0.85]]);
    a.add('body', a.el(smooth(tv, true, 0.5), mul(hx(c), 0.55)));
    // zip and drawstrings
    s2 += a.ink(a.bpL([[0.04, 1.1], [0.06, 2.4], [0.08, 4.6]]), [1.4, 1.4, 1.4], { col: rgb(T.deep) });
    s2 += a.ink(a.bpL([[0.02, 1.1], [0.04, 2.4], [0.06, 4.6]]), [0.5, 0.5, 0.5], { col: rgb(T.light), op: 0.6 });
    var cord = mix(T.base, [200, 200, 205], 0.5);
    s2 += a.ink(a.bpL([[-0.36, 0.6], [-0.42, 1.2], [-0.36, 1.8]]), [1.6, 1.5, 1.3], { col: rgb(cord) }) + a.ink(a.bpL([[0.4, 0.55], [0.44, 1.1], [0.42, 1.6]]), [1.5, 1.4, 1.2], { col: rgb(mix(cord, T.shadow, 0.35)) });
    s2 += a.ink(a.bpL([[-0.36, 1.78], [-0.36, 1.95]]), 2.4, { col: rgb(T.line) }) + a.ink(a.bpL([[0.42, 1.58], [0.42, 1.74]]), 2.2, { col: rgb(T.line) });
    a.add('bodyTop', s2);
  };
  /* knitted jumper (children) */
  OUT.sweater = function (a, c, o) {
    o = o || {};
    var r = garment(a, { col: c, neck: 'crew', sw: o.sw || 2.0, slope: 0.4, extra: function (T, sh) {
      var s = '';
      // rib knit at the neckline
      s += a.ink(a.bpL([[-0.66, 0.06], [-0.45, 0.32], [0, 0.42], [0.45, 0.32], [0.66, 0.06]]), [1, 1.4, 1], { col: rgb(T.deep), op: 0.6 });
      for (var i = -6; i <= 6; i++) { var x = i / 6 * 0.62, y = 0.3 - Math.abs(x) * 0.3 + 0.08; s += a.ink(a.bpL([[x, y - 0.18], [x * 1.04, y + 0.06]]), [0.3, 0.8, 0.3], { col: rgb(T.deep), op: 0.4 }); }
      return s;
    } });
    if (o.under) {
      // a shirt collar peeking out
      var Tu = clothTones(o.under);
      [-1, 1].forEach(function (sd) { var pts = a.bpL([[sd * 0.58, -0.06], [sd * 0.66, 0.12], K([sd * 0.3, 0.42]), [sd * 0.02, 0.24], [sd * 0.45, 0.02]]); fillBody(a, pts, Tu, 'bodyTop', '', { lw: 1.1 }); });
    }
  };
  OUT.tshirt = function (a, c, o) { garment(a, { col: c, neck: 'crew', sw: (o && o.sw) || 2.05, slope: 0.38 }); };
  /* collared shirt, optionally with a waistcoat over it */
  OUT.shirt = function (a, c, o) {
    o = o || {};
    garment(a, { col: c, neck: o.open ? 'v' : 'high', depth: o.open || 0.5, sw: o.sw || 2.25, slope: 0.36, extra: o.sleevesRolled ? null : null });
    shirtCollar(a, c, { spread: o.spread, placket: !o.vest || true });
    if (o.vest) vest(a, { col: o.vest, sw: o.sw, texture: o.vestTexture });
  };
  OUT.shirtvest = function (a, c, o) { o = o || {}; OUT.shirt(a, o.shirt || a.pd.under || c, { vest: a.pd.vest || a.def.vest || c, open: o.open, sw: o.sw }); };
  /* blazer / coat over a top. o = { top, neck, lapel, open, len } */
  OUT.blazer = function (a, c, o) {
    o = o || {};
    if (o.neck === 'turtle') OUT.turtle(a, o.top, { sw: 2.15 }); else garment(a, { col: o.top || [80, 60, 80], neck: o.neck || 'v', depth: o.depth || 0.95, sw: 2.15, folds: false });
    outer(a, { col: c, lapel: o.lapel === undefined ? true : o.lapel, open: o.open || 0.5, closeY: o.closeY || 2.6, buttons: o.buttons, sw: o.sw || 2.3, collarBack: o.collarBack });
  };
  OUT.turtle = function (a, c, o) {
    o = o || {};
    var r = garment(a, { col: c, neck: 'high', sw: o.sw || 2.15, back: false });
    var T = clothTones(c), S = a.S, nb = a.neckBase;
    // the rolled collar is a short tube round the neck
    var nw = (nb.r[0] - nb.l[0]) / S / 2 + 0.12, mx = (nb.l[0] + nb.r[0]) / 2;
    var y0 = nb.m[1] - S * 0.62, y1 = nb.m[1] + S * 0.12;
    var pts = [[mx - nw * S, y0 + S * 0.08], [mx, y0 + S * 0.18], [mx + nw * S, y0 + S * 0.04], [mx + nw * S * 1.05, y1 - S * 0.1], [mx, y1 + S * 0.08], [mx - nw * S * 1.08, y1 - S * 0.06]];
    var d = smooth([K(pts[0]), pts[1], K(pts[2]), K(pts[3]), pts[4], K(pts[5])], true), ex = '';
    ex += a.el(d, a.lin(pts[0][0], 0, pts[2][0], 0, [[0, T.shadow, 0.9], [0.5, T.base, 0], [1, T.light, 0.5]]));
    for (var i = 1; i < 4; i++) { var yy = lerp(y0, y1, i / 4); ex += a.ink([[mx - nw * S, yy + S * 0.06], [mx, yy + S * 0.16], [mx + nw * S, yy + S * 0.02]], [0, 1.2, 0], { col: rgb(T.deep), op: 0.6 }); }
    a.add('bodyTop', a.el(d, T.base) + a.g(ex, { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.5 }));
    var top = [[mx - nw * S, y0 + S * 0.08], [mx, y0 - S * 0.02], [mx + nw * S, y0 + S * 0.04], [mx, y0 + S * 0.18]];
    a.add('bodyBack', a.el(smooth(top, true), T.deep));
  };
  /* Jaglika: green wool coat open over a purple turtleneck */
  OUT.coat = function (a, c, o) {
    o = o || {};
    if (o.turtle) OUT.turtle(a, a.pd.under || [90, 42, 120], {});
    else garment(a, { col: a.pd.under || [200, 196, 186], neck: o.neck || 'crew', depth: o.depth, sw: 2.15, folds: false });
    outer(a, { col: c, lapel: o.lapel === undefined ? true : o.lapel, open: o.open === undefined ? 0.55 : o.open, closeY: o.closeY || 2.4, sw: 2.35, buttons: o.buttons, collarBack: o.collarBack });
  };
  /* zip-up jacket with a stand collar (Jaglika late) */
  OUT.zipjacket = function (a, c, o) {
    var T = clothTones(c), S = a.S;
    garment(a, { col: c, neck: 'high', sw: 2.15, back: false, extra: function (T2) {
      var s = a.ink(a.bpL([[0.06, 0.1], [0.08, 2.2], [0.1, 4.6]]), [2.6, 2.6, 2.6], { col: rgb(T2.line) });
      s += a.ink(a.bpL([[0.06, 0.1], [0.08, 2.2], [0.1, 4.6]]), [1.2, 1.2, 1.2], { col: rgb(mix(T2.base, [190, 170, 180], 0.6)), op: 0.9 });
      s += a.ink(a.bpL([[-1.5, 2.6], [-0.5, 2.7]]), [1, 1.2, 1], { col: rgb(T2.line), op: 0.5 });
      return s;
    } });
    // stand collar wrapped round the neck
    var nb = a.neckBase, nw = (nb.r[0] - nb.l[0]) / S / 2 + 0.14, mx = (nb.l[0] + nb.r[0]) / 2, y0 = nb.m[1] - S * 0.42, y1 = nb.m[1] + S * 0.1;
    var pts = [[mx - nw * S, y0 + S * 0.06], [mx + S * 0.1, y0 + S * 0.2], [mx + nw * S, y0], [mx + nw * S * 1.05, y1 - S * 0.1], [mx + S * 0.1, y1 + S * 0.08], [mx - nw * S * 1.08, y1 - S * 0.06]];
    var d = smooth([K(pts[0]), pts[1], K(pts[2]), K(pts[3]), pts[4], K(pts[5])], true);
    var ex = a.el(d, a.lin(pts[0][0], 0, pts[2][0], 0, [[0, T.shadow, 0.9], [0.5, T.base, 0], [1, T.light, 0.5]]));
    ex += a.ink([[mx + S * 0.1, y0 + S * 0.2], [mx + S * 0.12, y1 + S * 0.08]], 2.2, { col: rgb(T.line) });
    a.add('bodyTop', a.el(d, T.base) + a.g(ex, { clip: a.clip(d) }) + a.el(d, 'none', { stroke: rgb(T.line), sw: 1.5 }));
    var top = [[mx - nw * S, y0 + S * 0.06], [mx, y0 - S * 0.06], [mx + nw * S, y0], [mx, y0 + S * 0.16]];
    a.add('bodyBack', a.el(smooth(top, true), T.deep));
    // zip pull
    var zp = [mx + S * 0.12, y1 + S * 0.15];
    a.add('bodyTop', '<rect x="' + f(zp[0] - S * 0.05) + '" y="' + f(zp[1]) + '" width="' + f(S * 0.1) + '" height="' + f(S * 0.24) + '" rx="1" fill="' + rgb(a.pd.zip || [180, 160, 166]) + '" stroke="' + rgb(T.line) + '" stroke-width="0.8"/>');
  };
  /* dress with an open neck (village women): o = { neck, cardigan, apron, lace, shawl } */
  OUT.dress = function (a, c, o) {
    o = o || {};
    var top = a.pd.top || c;
    garment(a, { col: top, neck: o.neck || 'scoop', depth: o.depth || 0.6, sw: 2.1 });
    if (o.lace) OUT.lace(a, a.pd.lace || [221, 212, 194]);
    if (o.cardigan) outer(a, { col: a.pd.cardigan || mul(hx(top), 0.8), open: 0.75, closeY: 3, lapel: false, sw: 2.2, collarBack: false, texture: function (T) { return ''; } });
    if (o.apron) apron(a, a.pd.apron || a.def.apron || [216, 208, 188], { y0: 1.4 });
    if (o.shawl) OUT.shawl(a, a.pd.shawl || a.def.shawl || [138, 106, 74]);
  };
  OUT.lace = function (a, col) {
    var T = clothTones(col), s = '';
    [-1, 1].forEach(function (sd) {
      var pts = [[sd * 0.64, -0.08], [sd * 0.9, 0.12], [sd * 0.95, 0.42], [sd * 0.62, 0.68], [sd * 0.18, 0.62], K([sd * 0.02, 0.38]), [sd * 0.32, 0.22]];
      var ex = '';
      var edge = spline(a.bpL([[sd * 0.92, 0.3], [sd * 0.8, 0.58], [sd * 0.4, 0.68], [sd * 0.08, 0.5]]), 4);
      edge.forEach(function (p, i) { if (i % 2 === 0) ex += '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + f(a.S * 0.035) + '" fill="' + rgb(T.shadow) + '" opacity="0.8"/>'; });
      ex += a.ink(a.bpL([[sd * 0.7, 0.1], [sd * 0.75, 0.38], [sd * 0.45, 0.5], [sd * 0.2, 0.42]]), [0.3, 0.8, 0.3], { col: rgb(T.shadow), op: 0.7 });
      fillBody(a, a.bpL(pts), T, 'bodyTop', ex, { lw: 1.1 });
    });
  };
  OUT.shawl = function (a, col) {
    var T = clothTones(col);
    var pts = [[-2.4, 0.5], [-1.8, 0.15], [-0.8, -0.05], [-0.3, 0.5], [0.0, 1.5], [0.3, 0.5], [0.85, -0.04], [1.9, 0.15], [2.5, 0.55], [2.5, 2.2], [0.9, 2.4], K([0.1, 3.1]), [-0.9, 2.4], [-2.5, 2.3]];
    var ex = fold(a, [[-1.8, 0.6], [-1.2, 1.4], [-0.5, 2.0]], T, [0, 1.4, 0], 0.6) + fold(a, [[1.7, 0.6], [1.1, 1.3], [0.6, 2.0]], T, [0, 1.2, 0], 0.5);
    for (var i = 0; i < 12; i++) { var x = -2.3 + i * 0.4; ex += a.ink(a.bpL([[x, 1.0 + Math.abs(x) * 0.1], [x + 0.25, 0.95 + Math.abs(x) * 0.1]]), [0.3, 0.9, 0.3], { col: rgb(T.light), op: 0.4 }); }
    fillBody(a, a.bpL(pts), T, 'bodyTop', ex);
    var kn = a.bp(0.0, 1.55);
    a.add('bodyTop', '<ellipse cx="' + f(kn[0]) + '" cy="' + f(kn[1]) + '" rx="' + f(a.S * 0.2) + '" ry="' + f(a.S * 0.16) + '" fill="' + rgb(T.shadow) + '" stroke="' + rgb(T.line) + '" stroke-width="1.2"/>');
  };
  /* folk blouse: white linen, gathered neckline, embroidery on the yoke and the shoulders */
  OUT.blouse = function (a, c, o) {
    o = o || {};
    var col = a.pd.top || c || [226, 220, 204], emb = a.pd.emb || a.def.embroidery || [176, 48, 48];
    garment(a, { col: col, neck: 'scoop', depth: o.depth || 0.5, sw: o.sw || 2.05, slope: 0.42, extra: function (T) {
      var s = '';
      for (var i = -5; i <= 5; i++) { var x = i / 5 * 0.85; s += a.ink(a.bpL([[x * 0.95, 0.5 - Math.abs(x) * 0.25 + 0.05], [x * 1.1, 0.95 - Math.abs(x) * 0.2]]), [0.2, 0.9, 0.1], { col: rgb(T.shadow), op: 0.6 }); }
      return s;
    } });
    embroidery(a, [[-0.92, 0.0], [-0.8, 0.4], [-0.4, 0.66], [0, 0.72], [0.4, 0.66], [0.8, 0.4], [0.92, 0.0]], emb, { n: 9, r: 0.075 });
    embroidery(a, [[-1.95, 0.42], [-1.95, 1.1], [-2.05, 1.9]], emb, { n: 4, r: 0.08 });
    embroidery(a, [[1.85, 0.44], [1.9, 1.1], [1.98, 1.9]], emb, { n: 4, r: 0.07 });
    if (o.vest) outer(a, { col: o.vest, vest: true, open: 0.75, closeY: 2.5, collarBack: false });
    if (o.apron) apron(a, a.pd.apron || [106, 90, 122], { y0: 1.6 });
  };
  /* Gvozdin: linen shirt with the sleeves rolled, heavy leather apron */
  OUT.smith = function (a, c, o) {
    garment(a, { col: c || [110, 106, 94], neck: 'v', depth: 0.75, sw: 2.45, slope: 0.32 });
    var lt = clothTones(a.pd.apron || [90, 58, 36]);
    apron(a, a.pd.apron || [90, 58, 36], { y0: 1.2, w0: 1.0, extra: function (T) {
      var s = '';
      // scuffs and burn marks on the leather
      var r = rnd(4);
      for (var i = 0; i < 10; i++) { var x = -0.8 + r() * 1.6, y = 1.5 + r() * 2.5; s += a.ink(a.bpL([[x, y], [x + 0.2, y + 0.05]]), [0.2, 1.2, 0.2], { col: rgb(r() > 0.5 ? T.light : T.deep), op: 0.5 }); }
      s += a.ink(a.bpL([[-0.9, 1.35], [0.95, 1.3]]), 0.7, { col: rgb(T.light), op: 0.6 });
      return s;
    } });
  };
  /* Father Sava: black cassock with a stand collar */
  OUT.cassock = function (a, c, o) {
    garment(a, { col: c || [28, 26, 30], neck: 'high', sw: 2.25, back: false, extra: function (T) {
      var s = a.ink(a.bpL([[0.05, 0.2], [0.08, 4.6]]), 1.2, { col: rgb(T.line), op: 0.8 });
      for (var i = 0; i < 5; i++) { var b = a.bp(0.18, 0.45 + i * 0.65); s += '<circle cx="' + f(b[0]) + '" cy="' + f(b[1]) + '" r="' + f(a.S * 0.045) + '" fill="' + rgb(T.light) + '" stroke="#0a080a" stroke-width="0.6"/>'; }
      return s;
    } });
    var T = clothTones(c || [28, 26, 30]), S = a.S, nb = a.neckBase, nw = (nb.r[0] - nb.l[0]) / S / 2 + 0.1, mx = (nb.l[0] + nb.r[0]) / 2, y0 = nb.m[1] - S * 0.36, y1 = nb.m[1] + S * 0.1;
    var pts = [[mx - nw * S, y0 + S * 0.05], [mx + S * 0.1, y0 + S * 0.16], [mx + nw * S, y0], [mx + nw * S * 1.04, y1 - S * 0.1], [mx + S * 0.1, y1 + S * 0.06], [mx - nw * S * 1.06, y1 - S * 0.06]];
    var d = smooth([K(pts[0]), pts[1], K(pts[2]), K(pts[3]), pts[4], K(pts[5])], true);
    a.add('bodyTop', a.el(d, T.base) + a.g(a.el(d, a.lin(pts[0][0], 0, pts[2][0], 0, [[0, T.deep], [1, T.light]])), { clip: a.clip(d) }) + a.el(d, 'none', { stroke: '#060506', sw: 1.4 }));
    a.add('bodyBack', a.el(smooth([[mx - nw * S, y0 + S * 0.05], [mx, y0 - S * 0.05], [mx + nw * S, y0], [mx, y0 + S * 0.15]], true), T.deep));
  };

  /* ================= ACCESSORIES ================= */
  var ACC = {};
  ACC.strap = function (a) {
    var T = clothTones([30, 29, 34]);
    var pts = a.bpL([[-1.75, 0.12], [-1.28, 0.12], [-1.12, 1.4], [-1.08, 4.6], [-1.62, 4.6], [-1.7, 1.4]]);
    var d = smooth([K(pts[0]), K(pts[1]), pts[2], K(pts[3]), K(pts[4]), pts[5]], true);
    var s = a.el(d, T.base) + a.g(a.el(d, a.lin(pts[0][0], 0, pts[1][0], 0, [[0, T.shadow], [1, T.light]])), { clip: a.clip(d) }) + a.el(d, 'none', { stroke: '#0a090c', sw: 1.5 });
    s += '<path d="' + smooth(a.bpL([[-1.64, 0.3], [-1.6, 1.4], [-1.56, 4.4]]), false) + '" fill="none" stroke="#6a6a74" stroke-width="0.7" stroke-dasharray="2 2" opacity="0.8"/>';
    s += '<path d="' + smooth(a.bpL([[-1.34, 0.3], [-1.22, 1.4], [-1.18, 4.4]]), false) + '" fill="none" stroke="#6a6a74" stroke-width="0.7" stroke-dasharray="2 2" opacity="0.8"/>';
    var b = a.bpL([[-1.72, 2.5], [-1.1, 2.5], [-1.1, 2.85], [-1.72, 2.85]]);
    s += a.el(poly(b, true), '#55555e', { stroke: '#121014', sw: 1 }) + a.el(poly(a.bpL([[-1.6, 2.58], [-1.22, 2.58], [-1.22, 2.77], [-1.6, 2.77]]), true), '#1a1a1e');
    a.add('bodyTop', s);
  };
  /* Jaglika's big rectangular glasses */
  ACC.glasses = function (a) {
    var S = a.S, fc = a.fc, col = hx(a.pd.glassesCol || [142, 166, 178]), s = '', lens = '';
    var frame = rgb(mul(col, 0.62)), frameL = rgb(mix(col, [255, 255, 255], 0.3));
    [-1, 1].forEach(function (sd) {
      var cx = sd * fc.eyeX, w = 0.32, h = 0.2, cy = 0.02;
      var p = [a.on(cx - w, cy - h, 0.22), a.on(cx + w, cy - h, 0.22), a.on(cx + w, cy + h, 0.22), a.on(cx - w, cy + h, 0.22)];
      var d = smooth([p[0], mid(p[0], p[1], 0.5), p[1], mid(p[1], p[2], 0.5), p[2], mid(p[2], p[3], 0.5), p[3], mid(p[3], p[0], 0.5)].map(function (q, i) { return i % 2 ? q : K(q); }), true, 0.3);
      lens += a.el(d, mix(col, [230, 240, 245], 0.5), { op: 0.16 });
      // a glare across the lens (light from the upper right)
      lens += a.g(a.el(poly([mid(p[1], p[0], 0.15), mid(p[1], p[0], 0.45), mid(p[2], p[3], 0.75), mid(p[2], p[3], 0.45)], true), '#ffffff', { op: 0.22 }), { clip: a.clip(d) });
      s += a.el(d, 'none', { stroke: frame, sw: S * 0.06 }) + a.el(d, 'none', { stroke: frameL, sw: S * 0.02, op: 0.7 });
      a['lens' + (sd < 0 ? 'L' : 'R')] = p;
    });
    // bridge and the near arm to the ear
    var br = [a.on(-fc.eyeX + 0.32, -0.08, 0.24), a.on(0, -0.12, 0.42), a.on(fc.eyeX - 0.32, -0.08, 0.24)];
    s += a.ink(br, S * 0.05, { col: frame });
    var E = a.ear && a.ear.E, arm0 = a.on(-fc.eyeX - 0.32, -0.12, 0.2);
    if (E) s += a.ink([arm0, a.on(-0.86, -0.1, 0.1), a.on(-0.94, -0.08, 0.04)], [S * 0.06, S * 0.05, S * 0.04], { col: frame });
    var far0 = a.on(fc.eyeX + 0.32, -0.12, 0.2); s += a.ink([far0, a.on(0.97, -0.1, 0.0)], [S * 0.05, S * 0.04, S * 0.02], { col: frame });
    a.add('glasses', lens + s);
    // the frames cast a thin shadow on the cheeks
    castOnSkin(a, a.lensL ? [a.lensL[3], a.lensL[2], [a.lensL[2][0], a.lensL[2][1] + S * 0.08], [a.lensL[3][0], a.lensL[3][1] + S * 0.08]] : [], 0.35, 0.8);
  };
  /* a necklace of round beads at the base of the neck */
  ACC.beads = function (a, o) {
    var S = a.S, col = hx(a.pd.jewel || [47, 138, 134]), s = '';
    [[0.5, 0.048], [0.74, 0.056]].forEach(function (q, j) {
      var path = spline(a.bpL([[-0.72, -0.12 + j * 0.05], [-0.45, q[0] * 0.7], [0.05, q[0] + 0.04], [0.5, q[0] * 0.7], [0.74, -0.1 + j * 0.05]]), 8);
      var L = arcLen(path), tot = L[L.length - 1], step = S * q[1] * 2.05, k = 0;
      for (var d = step / 2; d < tot; d += step) {
        while (k < L.length - 2 && L[k + 1] < d) k++;
        var t = (d - L[k]) / ((L[k + 1] - L[k]) || 1), p = [lerp(path[k][0], path[k + 1][0], t), lerp(path[k][1], path[k + 1][1], t)], rr = S * q[1];
        s += '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + f(rr) + '" fill="' + rgb(col) + '" stroke="' + rgb(mul(col, 0.35)) + '" stroke-width="0.7"/>';
        s += '<circle cx="' + f(p[0] + rr * 0.3) + '" cy="' + f(p[1] - rr * 0.35) + '" r="' + f(rr * 0.35) + '" fill="#e8fffa" opacity="0.7"/>';
      }
    });
    a.add('acc', s);
  };
  ACC.earrings = function (a, o) {
    var S = a.S, E = a.ear && a.ear.E; if (!E) return;
    var lobe = E(0.3, 1.0), kind = (o && o.kind) || 'bead', col = hx(a.pd.jewel || [47, 138, 134]), s = '';
    if (kind === 'pearl') {
      s += '<circle cx="' + f(lobe[0]) + '" cy="' + f(lobe[1] + S * 0.03) + '" r="' + f(S * 0.075) + '" fill="#ece6da" stroke="#5a544a" stroke-width="0.7"/><circle cx="' + f(lobe[0] + S * 0.025) + '" cy="' + f(lobe[1]) + '" r="' + f(S * 0.025) + '" fill="#fff"/>';
    } else if (kind === 'star') {
      var top = [lobe[0], lobe[1] + S * 0.02], c = [lobe[0] + S * 0.02, lobe[1] + S * 0.36], R = S * 0.14, pts = [];
      s += a.ink([top, [top[0] + S * 0.01, top[1] + S * 0.12], [c[0], c[1] - R]], 0.9, { col: rgb(mul(col, 0.7)) });
      for (var k = 0; k < 10; k++) { var t = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.45 : R; pts.push(K([c[0] + Math.cos(t) * rr, c[1] + Math.sin(t) * rr])); }
      s += a.el(poly(pts, true), col, { stroke: rgb(mul(col, 0.35)), sw: 0.8 }) + '<circle cx="' + f(c[0] + R * 0.2) + '" cy="' + f(c[1] - R * 0.2) + '" r="' + f(R * 0.22) + '" fill="#fff" opacity="0.6"/>';
    } else {
      var bc = [lobe[0], lobe[1] + S * 0.16];
      s += a.ink([[lobe[0], lobe[1] + S * 0.01], [bc[0] + S * 0.01, bc[1] - S * 0.08]], 0.9, { col: '#8a7a50' });
      s += '<circle cx="' + f(bc[0]) + '" cy="' + f(bc[1]) + '" r="' + f(S * 0.09) + '" fill="' + rgb(col) + '" stroke="' + rgb(mul(col, 0.35)) + '" stroke-width="0.8"/><circle cx="' + f(bc[0] + S * 0.03) + '" cy="' + f(bc[1] - S * 0.03) + '" r="' + f(S * 0.03) + '" fill="#e8fffa" opacity="0.75"/>';
    }
    a.add('earAcc', s);
  };
  /* Jessica's camera on its strap */
  ACC.camera = function (a) {
    var S = a.S, s = '';
    var strap = a.bpL([[-1.2, -0.02], [-0.5, 0.8], [0.45, 1.75], [1.3, 2.55]]);
    s += a.ink(strap, S * 0.14, { col: '#18161a' }) + a.ink(strap.map(function (p) { return [p[0] + 0.6, p[1] - 0.6]; }), S * 0.04, { col: '#4a4650', op: 0.8 });
    var c = a.bp(1.45, 2.95), w = S * 1.3, h = S * 0.78;
    s += '<rect x="' + f(c[0] - w / 2) + '" y="' + f(c[1] - h / 2) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + f(S * 0.1) + '" fill="#222024" stroke="#08070a" stroke-width="1.4"/>';
    s += '<rect x="' + f(c[0] - w / 2) + '" y="' + f(c[1] - h / 2) + '" width="' + f(w) + '" height="' + f(h * 0.28) + '" rx="' + f(S * 0.08) + '" fill="#7a7880" opacity="0.6"/>';
    s += '<circle cx="' + f(c[0] - w * 0.08) + '" cy="' + f(c[1] + h * 0.08) + '" r="' + f(h * 0.36) + '" fill="#121014" stroke="#5a5862" stroke-width="1.6"/><circle cx="' + f(c[0] - w * 0.08) + '" cy="' + f(c[1] + h * 0.08) + '" r="' + f(h * 0.2) + '" fill="#2a3442"/><circle cx="' + f(c[0] - w * 0.02) + '" cy="' + f(c[1] - h * 0.02) + '" r="' + f(h * 0.07) + '" fill="#dfe8f0" opacity="0.8"/>';
    a.add('front', s);
  };
  /* a pectoral cross on a chain */
  ACC.cross = function (a) {
    var S = a.S, s = '';
    var chain = a.bpL([[-0.66, -0.05], [-0.45, 1.0], [0.05, 2.05], [0.5, 1.0], [0.7, -0.05]]);
    s += '<path d="' + smooth(chain, false) + '" fill="none" stroke="#b89a50" stroke-width="1.2" stroke-dasharray="1.5 1"/>';
    var c = a.bp(0.05, 2.5), u = S * 0.1;
    var cr = [[-1, -3.4], [1, -3.4], [1, -1.4], [2.6, -1.4], [2.6, 0.4], [1, 0.4], [1, 3.6], [-1, 3.6], [-1, 0.4], [-2.6, 0.4], [-2.6, -1.4], [-1, -1.4]].map(function (p) { return K([c[0] + p[0] * u, c[1] + p[1] * u]); });
    s += a.el(poly(cr, true), '#c8a858', { stroke: '#3a2a10', sw: 1 }) + a.el(poly(cr.slice(0, 3).concat([K([c[0] - u * 0.2, c[1] + u * 3])]), true), '#f0dca0', { op: 0.5 });
    a.add('front', s);
  };
  ACC.brooch = function (a, o) {
    var S = a.S, c = a.bp(o.x || 0, o.y || 1.0), st = hx(o.stone || [110, 28, 44]);
    a.add('front', '<ellipse cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" rx="' + f(S * 0.17) + '" ry="' + f(S * 0.13) + '" fill="#c8a858" stroke="#3a2a10" stroke-width="0.9"/><ellipse cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" rx="' + f(S * 0.1) + '" ry="' + f(S * 0.075) + '" fill="' + rgb(st) + '"/><circle cx="' + f(c[0] + S * 0.03) + '" cy="' + f(c[1] - S * 0.03) + '" r="' + f(S * 0.025) + '" fill="#fff" opacity="0.7"/>');
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

  return { dress: dress, HAIR: HAIR, HAT: HAT, BEARD: BEARD, MUST: MUST, OUT: OUT, ACC: ACC, hairTones: hairTones, clothTones: clothTones, paintMass: paintMass, strand: strand, sheen: sheen, fringe: fringe, garment: garment, outer: outer, fillBody: fillBody, bodyFrame: bodyFrame };
})();
