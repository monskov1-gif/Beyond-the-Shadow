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
    a.add('hairShadow', a.g(a.el(smooth(offset(pts, S * (dx || 0.05), S * (dy || 0.12)), true), a.skin.deep, { op: op || 0.5 }), { clip: a.skinClip, blur: 2.2 }));
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
    // highlight streak on the lit half
    var h0 = o.hi0 === undefined ? 0.22 : o.hi0, h1 = o.hi1 === undefined ? 0.6 : o.hi1;
    if (o.hi !== false) {
      var hs = [];
      for (var i = Math.round(h0 * 14); i <= Math.round(h1 * 14); i++) hs.push(mid(g.cen[i], g.litSide[i], 0.45));
      if (hs.length > 2) inner += a.el(taper(hs, [0, w * (o.hiW || 0.22), 0], 3), T.hi, { op: o.hiOp || 0.75 });
      if (hs.length > 3 && w > S * 0.18) { var hs2 = hs.map(function (p, j) { return mid(p, g.cen[Math.round(h0 * 14) + j], 0.9); }); inner += a.el(taper(hs2.slice(1), [0, w * 0.1, 0], 3), T.hi, { op: (o.hiOp || 0.75) * 0.5 }); }
    }
    // a strand line down the middle
    if (w > S * 0.14 && o.mid !== false) inner += a.ink(g.cen.slice(3, 13).map(function (p, j) { return mid(p, g.darkSide[j + 3], 0.25); }), [0, 0.9, 0], { col: rgb(T.deep), op: 0.55 });
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
  HAIR.shaggy = function (a, c, o) {
    var S = a.S, T = hairTones(c), young = a.pd.face === 'small', r = rnd(7);
    var sideY = young ? 0.42 : 0.52;
    // base mass hugging the skull
    var cap = a.rims([[150, 0.12], [165, 0.17], [185, 0.2], [205, 0.22], [228, 0.22], [250, 0.22], [272, 0.21], [295, 0.22], [318, 0.21], [340, 0.18], [358, 0.14], [14, 0.1], [24, 0.04]]);
    var capIn = a.onL([[0.95, 0.2], [0.9, -0.3], [0.75, -0.8], [0.3, -1.0], [-0.3, -1.0], [-0.8, -0.78], [-0.95, -0.2], [-1.0, 0.25]], 0.05);
    var capPts = cap.concat(capIn);
    var crown = a.P(0.2, -1.25, 0.55);
    // sheen strokes across the crown: thin light arcs following the flow
    var inner = '';
    for (var k = 0; k < 16; k++) {
      var ang = 190 + k * 8.5, q = a.rim(ang, 0.16), st = strand(crown, q, -S * 0.1, 10);
      var lo = 0.35 + r() * 0.15, hi = lo + 0.25 + r() * 0.15;
      inner += a.el(taper(st.slice(Math.floor(lo * 10), Math.ceil(hi * 10) + 1), [0, 1.2 + r() * 1.2, 0], 3), T.hi, { op: 0.35 + r() * 0.35 });
      inner += a.ink(strand(crown, a.rim(ang + 4, 0.2), -S * 0.12, 8), [0, 1.0, 0.2], { col: rgb(T.deep), op: 0.6 });
    }
    paintMass(a, capPts, T, { inner: inner, center: crown, lw: 1.5, layer: 'hair' });
    // back hair behind the neck and ears
    var back = [a.rim(150, 0.14), a.P(-1.12, sideY + 0.2, -0.4), a.P(-0.7, sideY + 0.45, -0.85), a.P(0.4, sideY + 0.4, -0.9), a.P(0.95, sideY + 0.2, -0.5), a.rim(25, 0.08), a.rim(270, 0.2)];
    a.add('hairBack', a.el(smooth(back, true), T.deep) + a.el(smooth(back, true), 'none', { stroke: rgb(T.line), sw: 1.4 }));
    // messy locks on the outer silhouette, sticking out a little
    var outer = [[160, 0.36, -0.08], [178, 0.42, 0.1], [200, 0.4, -0.1], [224, 0.4, 0.12], [244, 0.38, -0.1], [300, 0.36, 0.1], [322, 0.38, -0.12], [345, 0.32, 0.1], [5, 0.24, -0.1]];
    outer.forEach(function (q, i) {
      var tip = a.rim(q[0], q[1]), root = a.rim(q[0] + (i % 2 ? 12 : -12), -0.15);
      drawLock(a, 'hair', root, tip, S * 0.32, q[2], T, { hiOp: 0.45, drop: false, rootDark: 0.2 });
    });
    // side locks over the ears (near side) and down the far cheek
    var sides = [[-0.98, -0.55, -1.12, sideY + 0.12, 0.08], [-0.9, -0.6, -1.0, sideY + 0.2, 0.05], [-0.82, -0.6, -0.9, sideY, -0.04], [0.82, -0.6, 0.92, sideY - 0.04, 0.05], [0.9, -0.55, 1.0, sideY + 0.1, -0.06]];
    sides.forEach(function (q) { drawLock(a, 'hair', a.on(q[0], q[1], 0.18), a.on(q[2], q[3], 0.08), S * 0.36, q[4], T, { hi0: 0.15, hi1: 0.45, hiOp: 0.55 }); });
    // the fringe: heavy locks from the top of the head down over the brows and eyes
    var fy = young ? -0.02 : 0.02;
    var fr = [[-0.78, -0.08], [0.82, -0.06], [-0.5, fy + 0.04], [0.56, fy], [-0.22, fy + 0.08], [0.3, fy + 0.06], [0.04, fy + 0.1], [-0.36, fy - 0.02], [0.68, -0.1]];
    var tipsFront = [];
    fr.forEach(function (q, i) {
      var rootX = q[0] * 0.6 + 0.1, root = a.on(rootX, -1.12, 0.32), tip = a.on(q[0] - 0.06, q[1] + (r() - 0.5) * 0.06, 0.12);
      var g = drawLock(a, 'hair', root, tip, S * (0.4 + r() * 0.08), (q[0] < 0 ? 0.06 : -0.06), T, { hi0: 0.12, hi1: 0.45, hiOp: 0.7, tipPow: 0.85 });
      tipsFront.push(g);
    });
    // fringe cast shadow on the face
    var shp = [a.on(-0.95, -0.9, 0.1)].concat(fr.slice().sort(function (p, q) { return p[0] - q[0]; }).map(function (q) { return a.on(q[0] - 0.02, q[1] + 0.08, 0.1); })).concat([a.on(0.95, -0.9, 0.1)]);
    a.add('hairShadow', a.g(a.el(smooth(shp, true), a.skin.deep, { op: 0.6 }), { clip: a.skinClip, blur: 2.4 }));
    // stray wisps
    var wis = [[[0.12, -0.5], [0.2, -0.15], [0.16, 0.12]], [[-0.4, -0.5], [-0.46, -0.15], [-0.42, 0.1]], [[0.62, -0.4], [0.7, -0.1], [0.76, 0.1]], [[-0.9, -0.3], [-1.05, 0.2], [-1.12, 0.62]]];
    if (young) wis = wis.slice(0, 2);
    wis.forEach(function (w) { a.add('hairTop', a.ink(a.onL(w, 0.14), [1.1, 0.9, 0.05], { col: rgb(T.line) }) + a.ink(a.onL(w, 0.14).map(function (p) { return [p[0] - 0.6, p[1] - 0.4]; }), [0.4, 0.5, 0.0], { col: rgb(T.light), op: 0.6 })); });
  };

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
    (pd.acc || []).forEach(function (x) { var t = typeof x === 'string' ? x : x.type; if (ACC[t]) ACC[t](a, typeof x === 'string' ? {} : x); });
  }

  return { dress: dress, HAIR: HAIR, OUT: OUT, ACC: ACC, hairTones: hairTones, clothTones: clothTones, paintMass: paintMass, strand: strand, sheen: sheen, fringe: fringe, torso: torso, fillBody: fillBody, bodyFrame: bodyFrame };
})();
