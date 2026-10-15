/* Procedural pixel-art material textures (16 texels per world unit).
   Each entry records how many world units one repeat covers (region.units). */
'use strict';
BTS.Textures = (function () {
  var C = BTS.Col, A = BTS.Atlas;
  var R = BTS.RNG(9137);

  function noiseAt(x, y, s, seed) { return BTS.M.fbm(x / s + seed * 17.3, y / s + seed * 9.1, 3); }
  /* tileable value noise via wrapping the coordinates on a torus */
  function tnoise(p, x, y, period, seed) {
    var fx = x / p.w, fy = y / p.h;
    var a = BTS.M.fbm(Math.cos(fx * 6.2832) * period + seed, Math.sin(fx * 6.2832) * period + Math.cos(fy * 6.2832) * period, 3);
    var b = BTS.M.fbm(Math.sin(fy * 6.2832) * period + seed * 3.1, Math.cos(fx * 6.2832 + 1.3) * period * 0.7 + seed, 3);
    return (a + b) * 0.5;
  }
  var bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dith(x, y) { return (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16; }
  function rampDither(r, t, x, y, amt) {
    t = BTS.M.clamp(t + (dith(x, y) - 0.5) * (amt === undefined ? 0.18 : amt), 0, 0.9999);
    return r[Math.floor(t * r.length)];
  }

  /* irregular stones by wrapped Voronoi */
  function stones(p, o) {
    var rnd = BTS.RNG(o.seed || 1);
    var pts = [];
    for (var i = 0; i < o.count; i++) pts.push([rnd() * p.w, rnd() * p.h, rnd(), rnd()]);
    var cell = new Int16Array(p.w * p.h), edge = new Float32Array(p.w * p.h);
    var sx = o.sx || 1, sy = o.sy || 1;
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) {
      var d1 = 1e9, d2 = 1e9, id = 0;
      for (var k = 0; k < pts.length; k++) {
        var dx = Math.abs(x + 0.5 - pts[k][0]); dx = Math.min(dx, p.w - dx);
        var dy = Math.abs(y + 0.5 - pts[k][1]); dy = Math.min(dy, p.h - dy);
        var d = Math.sqrt(dx * dx * sx + dy * dy * sy);
        if (d < d1) { d2 = d1; d1 = d; id = k; } else if (d < d2) d2 = d;
      }
      cell[y * p.w + x] = id; edge[y * p.w + x] = d2 - d1;
    }
    function cid(x, y) { x = (x + p.w) % p.w; y = (y + p.h) % p.h; return cell[y * p.w + x]; }
    for (y = 0; y < p.h; y++) for (x = 0; x < p.w; x++) {
      var e = edge[y * p.w + x], c = cid(x, y), pt = pts[c];
      if (e < o.mortar) {
        p.px(x, y, rampDither(o.mortarRamp, 0.3 + tnoise(p, x, y, 3, 5) * 0.6, x, y));
        continue;
      }
      var r = o.ramps ? o.ramps[Math.floor(pt[2] * o.ramps.length)] : o.ramp;
      var t = 0.35 + pt[3] * 0.3 + (noiseAt(x, y, 3, c) - 0.5) * 0.35;
      if (cid(x - 1, y - 1) !== c || cid(x, y - 1) !== c) t += 0.28;      // lit top-left bevel
      else if (cid(x + 1, y + 1) !== c || cid(x, y + 1) !== c) t -= 0.3;  // shadowed bottom-right
      p.px(x, y, rampDither(r, t, x, y, 0.12));
    }
    if (o.moss) for (y = 0; y < p.h; y++) for (x = 0; x < p.w; x++)
      if (tnoise(p, x, y, 2.5, 11) > 1 - o.moss && edge[y * p.w + x] < o.mortar + 1.5) p.px(x, y, rampDither(MOSS, tnoise(p, x, y, 5, 2), x, y));
  }

  var MOSS = C.ramp(['2f3b1c', '44532a', '5d6b34']);
  var DEF = {};
  function def(name, w, h, units, fn) {
    var r = A.paint(name, w, h, fn);
    r.units = units;
    DEF[name] = r;
    return r;
  }

  function grass(p, seed, base, flowers) {
    var r = base || C.ramp(['2e4220', '3a5226', '4a632d', '5a7434', '6f8a3e']);
    p.wrap = true;
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) {
      var t = 0.25 + tnoise(p, x, y, 1.6, seed) * 0.5 + (BTS.M.hash(x + seed, y) - 0.5) * 0.25;
      p.px(x, y, rampDither(r, t, x, y, 0.3));
    }
    var rnd = BTS.RNG(seed * 31 + 7);
    for (var i = 0; i < 30; i++) {   // blades
      var bx = rnd.int(0, p.w - 1), by = rnd.int(0, p.h - 1);
      p.px(bx, by, r[4]); p.px(bx, by + 1, r[3]); p.px(bx + 1, by + 2, r[1]);
    }
    if (flowers) for (i = 0; i < flowers; i++) {
      var fx = rnd.int(0, p.w - 1), fy = rnd.int(0, p.h - 1);
      var fc = rnd.pick([[232, 222, 196], [222, 196, 88], [190, 110, 160], [210, 90, 70]]);
      p.px(fx, fy, fc); p.px(fx, fy + 1, r[1]);
    }
  }
  function dirt(p, seed, rr, pebbles) {
    var r = rr || C.ramp(['4a3524', '5c4330', '6e523a', '806248', '927356']);
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) {
      var t = 0.3 + tnoise(p, x, y, 2.2, seed) * 0.45 + (BTS.M.hash(x * 3 + seed, y * 7) - 0.5) * 0.3;
      p.px(x, y, rampDither(r, t, x, y, 0.35));
    }
    var rnd = BTS.RNG(seed + 99);
    for (var i = 0; i < (pebbles || 10); i++) {
      var px = rnd.int(0, p.w - 1), py = rnd.int(0, p.h - 1);
      p.px(px, py, r[4]); p.px(px + 1, py, r[3]); p.px(px, py + 1, r[1]); p.px(px + 1, py + 1, r[0]);
    }
  }
  function planks(p, o) {
    var rnd = BTS.RNG(o.seed);
    var r = o.ramp;
    var pw = o.plank;
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) {
      var a = o.vertical ? x : y, b = o.vertical ? y : x;
      var row = Math.floor(a / pw);
      var off = (row * 37) % p.w;
      var grain = Math.sin((b + off) * 0.7 + Math.sin(a * 1.7 + row) * 2) * 0.12;
      var t = 0.45 + grain + (BTS.M.hash(row, 3) - 0.5) * 0.3 + (BTS.M.hash(x, y) - 0.5) * 0.12;
      if (a % pw === 0) t = 0.02;                       // gap
      else if (a % pw === 1) t += 0.18;                 // lit edge
      else if (a % pw === pw - 1) t -= 0.15;
      var seam = (b + row * 11) % (o.len || p.w);
      if (seam === 0) t = 0.08;
      p.px(x, y, rampDither(r, t, x, y, 0.1));
    }
    if (o.nails) for (var n = 0; n < p.w; n += o.len || p.w) for (var rr = 0; rr < p.h / pw; rr++) {
      var nx = o.vertical ? rr * pw + 2 : n + 2, ny = o.vertical ? n + 2 : rr * pw + 2;
      p.px(nx, ny, [40, 36, 34]);
    }
  }
  function plaster(p, o) {
    var r = o.ramp;
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) {
      var t = 0.55 + (tnoise(p, x, y, 1.4, o.seed) - 0.5) * 0.7 + (BTS.M.hash(x, y + o.seed) - 0.5) * 0.12;
      p.px(x, y, rampDither(r, t, x, y, 0.2));
    }
    if (o.patches) {      // exposed stone under fallen plaster
      var tmp = new A.Painter(p.w, p.h);
      stones(tmp, { count: 14, sx: 0.55, mortar: 1.1, ramp: o.stoneRamp || STONE_WARM, mortarRamp: MORTAR, seed: o.seed + 3 });
      for (y = 0; y < p.h; y++) for (x = 0; x < p.w; x++) {
        var n = tnoise(p, x, y, 1.2, o.seed + 40);
        if (n > 1 - o.patches) p.px(x, y, tmp.get(x, y));
        else if (n > 1 - o.patches - 0.035) p.px(x, y, C.mul(r[1], 0.85));
      }
    }
    var rnd = BTS.RNG(o.seed + 5);
    for (var c = 0; c < (o.cracks || 0); c++) {  // hairline cracks
      var cx = rnd.int(0, p.w), cy = rnd.int(0, p.h);
      for (var s = 0; s < 9; s++) { p.px(cx, cy, r[0]); cx += rnd.int(-1, 1); cy += 1; }
    }
  }
  function roofTiles(p, o) {
    var r = o.ramp, rowH = o.rowH || 6, tw = o.tw || 5;
    for (var y = 0; y < p.h; y++) for (var x = 0; x < p.w; x++) {
      var row = Math.floor(y / rowH), ly = y % rowH;
      var off = (row % 2) * Math.floor(tw / 2);
      var lx = (x + off) % tw;
      var t = 0.6 - (ly / rowH) * 0.25;             // upper part shadowed by previous row
      if (ly === rowH - 1) t = 0.08;                 // drop shadow line
      if (lx === 0) t -= 0.3; else if (lx === 1) t += 0.15; else if (lx === tw - 1) t -= 0.12;
      var id = Math.floor((x + off) / tw) + row * 13;
      t += (BTS.M.hash(id, row) - 0.5) * 0.35;
      var col = rampDither(r, t, x, y, 0.1);
      if (o.moss && tnoise(p, x, y, 2, o.seed) > 1 - o.moss && ly > 1) col = rampDither(MOSS, 0.3 + BTS.M.hash(x, y) * 0.6, x, y);
      p.px(x, y, col);
    }
  }

  var STONE_WARM = C.ramp(['5e4c38', '7b6449', '967c5a', 'ad946c', 'c4ad85', 'd6c39b']);
  var STONE_GREY = C.ramp(['3c3a37', '524f4a', '69655e', '807b72', '978f84', 'aaa293']);
  var STONE_DARK = C.ramp(['211d1c', '2d2826', '3a3330', '4a413c', '5a4f48']);
  var MORTAR = C.ramp(['6b6152', '857a68', '9a8f7b', 'aca28c']);
  var WOOD = C.ramp(['2e1f15', '45301f', '5a4029', '6e5133', '82623f', '98764d']);
  var WOOD_GREY = C.ramp(['2f2a25', '433c34', '585046', '6d6457', '827869']);
  var WOOD_FLOOR = C.ramp(['3d2817', '53371f', '684628', '7c5631', '8f673c']);

  function build() {
    A.paint('missing', 8, 8, function (p) { p.fill([255, 0, 255]); p.rect(0, 0, 4, 4, [0, 0, 0]); p.rect(4, 4, 4, 4, [0, 0, 0]); });
    A.paint('white', 4, 4, function (p) { p.fill([255, 255, 255]); });

    /* ---------- ground ---------- */
    for (var i = 0; i < 3; i++) (function (i) { def('grass' + i, 32, 32, 2, function (p) { grass(p, 10 + i, null, i === 1 ? 3 : 0); }); })(i);
    def('grass_meadow', 32, 32, 2, function (p) { grass(p, 21, C.ramp(['3c5524', '4c662b', '5d7a33', '6f8d3c', '86a24a']), 6); });
    def('grass_dry', 32, 32, 2, function (p) { grass(p, 33, C.ramp(['4d4a26', '615c2e', '757036', '8a8341', '9e964f'])); });
    def('grass_dark', 32, 32, 2, function (p) { grass(p, 37, C.ramp(['1f2e18', '283a1e', '334823', '3e5629', '4b6431'])); });
    for (i = 0; i < 2; i++) (function (i) { def('dirt' + i, 32, 32, 2, function (p) { dirt(p, 50 + i, null, 8 + i * 6); }); })(i);
    def('mud', 32, 32, 2, function (p) { dirt(p, 61, C.ramp(['2b2019', '35281e', '403024', '4b392a', '574332']), 4); });
    def('gravel', 32, 32, 2, function (p) {
      dirt(p, 70, C.ramp(['4c463e', '5d564c', '6e665a', '807768', '938a7a']), 0);
      var rnd = BTS.RNG(4);
      for (var k = 0; k < 70; k++) { var x = rnd.int(0, 31), y = rnd.int(0, 31); p.px(x, y, [150, 142, 128]); p.px(x + 1, y + 1, [70, 64, 56]); }
    });
    def('cobble', 32, 32, 2, function (p) { stones(p, { count: 22, mortar: 1.3, ramps: [STONE_GREY, STONE_WARM], mortarRamp: C.ramp(['2c2822', '3a342c', '473f35']), seed: 3, moss: 0.12 }); });
    def('flags', 32, 32, 2, function (p) { stones(p, { count: 7, sx: 1, mortar: 1.0, ramp: STONE_GREY, mortarRamp: C.ramp(['2c2822', '3a342c']), seed: 8, moss: 0.08 }); });
    def('field', 32, 32, 2, function (p) {
      dirt(p, 80, C.ramp(['3b2a1c', '4b3624', '5a432d', '6a5036', '7a5d40']), 0);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var ly = y % 8; if (ly === 0) p.shade(x, y, 0.6); else if (ly === 1) p.shade(x, y, 0.8); else if (ly === 5) p.shade(x, y, 1.15);
        if (ly === 3 && BTS.M.hash(x, y) > 0.55) p.px(x, y, [96, 120, 52]);
      }
    });
    def('sand', 32, 32, 2, function (p) { dirt(p, 91, C.ramp(['6e6450', '807562', '928672', 'a39883', 'b3a994']), 14); });
    def('water', 32, 32, 2, function (p) {
      var r = C.ramp(['1f2e33', '27393e', '30454a', '3c5459', '4d686c', '6c8a8c']);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var t = 0.35 + Math.sin((x + Math.sin(y * 0.4) * 3) * 0.4) * 0.12 + (tnoise(p, x, y, 2, 4) - 0.5) * 0.4;
        p.px(x, y, rampDither(r, t, x, y, 0.2));
      }
    });
    /* interior floors */
    def('floor_wood', 32, 32, 2, function (p) { planks(p, { seed: 4, ramp: WOOD_FLOOR, plank: 6, len: 32, nails: true }); });
    def('floor_wood_dark', 32, 32, 2, function (p) { planks(p, { seed: 9, ramp: C.ramp(['1d140e', '2a1d14', '37271a', '443120', '523b26']), plank: 5, len: 16 }); });
    def('floor_stone', 32, 32, 2, function (p) { stones(p, { count: 9, mortar: 1.0, ramp: STONE_GREY, mortarRamp: C.ramp(['26221d', '312c26']), seed: 21 }); });
    def('floor_dirt', 32, 32, 2, function (p) { dirt(p, 41, C.ramp(['3a2c20', '463528', '523f30', '5e4938', '6a5441']), 3); });
    def('floor_brick', 32, 32, 2, function (p) {
      var r = C.ramp(['3b2a22', '4e382c', '614637', '725343', '83624f']);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var row = Math.floor(y / 4), lx = (x + (row % 2) * 4) % 8, ly = y % 4;
        var t = 0.5 + (BTS.M.hash(Math.floor((x + (row % 2) * 4) / 8), row) - 0.5) * 0.5;
        if (ly === 3 || lx === 7) t = 0.02; else if (ly === 0) t += 0.15;
        p.px(x, y, rampDither(r, t, x, y, 0.15));
      }
    });
    def('rug_kilim', 64, 32, 4, function (p) {  /* Pirot-style kilim: red field, black/blue geometry */
      var red = [128, 36, 30], dark = [36, 22, 22], cream = [200, 178, 136], blue = [44, 58, 92], ochre = [176, 120, 46];
      p.fill(red);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 64; x++) {
        if (y < 2 || y > 29 || x < 2 || x > 61) { p.px(x, y, dark); continue; }
        if (y < 4 || y > 27 || x < 4 || x > 59) { p.px(x, y, (x + y) % 4 < 2 ? cream : dark); continue; }
        var cx = Math.abs(((x - 4) % 18) - 9), cy = Math.abs(y - 16);
        var d = cx + cy;
        if (d === 8 || d === 9) p.px(x, y, dark);
        else if (d < 3) p.px(x, y, ochre);
        else if (d === 5) p.px(x, y, blue);
        else if (d < 8 && (x + y) % 2 === 0) p.px(x, y, C.mul(red, 0.85));
      }
      for (var k = 0; k < 64; k += 2) { p.px(k, 0, cream); p.px(k, 31, cream); }
    });
    def('rug_plain', 32, 32, 2, function (p) {
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var s = Math.floor(y / 4) % 3;
        p.px(x, y, s === 0 ? [92, 60, 44] : s === 1 ? [70, 52, 42] : [110, 86, 60]);
        if (BTS.M.hash(x, y) > 0.8) p.shade(x, y, 0.85);
      }
    });

    /* ---------- walls ---------- */
    def('wall_stone', 32, 32, 2, function (p) { stones(p, { count: 16, sx: 0.45, mortar: 1.25, ramps: [STONE_WARM, STONE_WARM, STONE_GREY], mortarRamp: MORTAR, seed: 31, moss: 0.06 }); });
    def('wall_stone_grey', 32, 32, 2, function (p) { stones(p, { count: 15, sx: 0.5, mortar: 1.2, ramp: STONE_GREY, mortarRamp: C.ramp(['3f3a33', '4f493f', '5e574b']), seed: 33, moss: 0.1 }); });
    def('wall_stone_dark', 32, 32, 2, function (p) { stones(p, { count: 14, sx: 0.5, mortar: 1.2, ramp: STONE_DARK, mortarRamp: C.ramp(['161312', '1f1a18']), seed: 35, moss: 0.15 }); });
    def('wall_plaster', 32, 32, 2, function (p) { plaster(p, { seed: 1, ramp: C.ramp(['8c8473', 'a39b88', 'b8b09c', 'c9c2ad', 'd8d1bc']), cracks: 2, patches: 0.08 }); });
    def('wall_plaster_ochre', 32, 32, 2, function (p) { plaster(p, { seed: 2, ramp: C.ramp(['8a6c44', 'a08050', 'b4935e', 'c4a46c', 'd2b47c']), cracks: 2, patches: 0.12 }); });
    def('wall_plaster_blue', 32, 32, 2, function (p) { plaster(p, { seed: 3, ramp: C.ramp(['6b7a80', '7f8f94', '93a2a5', 'a6b3b3', 'b8c2c0']), cracks: 3, patches: 0.15 }); });
    def('wall_plaster_rose', 32, 32, 2, function (p) { plaster(p, { seed: 4, ramp: C.ramp(['8c6a60', 'a07c70', 'b38e80', 'c29f90', 'd0b0a0']), cracks: 1, patches: 0.1 }); });
    def('wall_plaster_patchy', 32, 32, 2, function (p) { plaster(p, { seed: 5, ramp: C.ramp(['847b6a', '9a917e', 'ada592', 'bdb6a2', 'cbc4b0']), cracks: 4, patches: 0.32 }); });
    def('wall_timber', 32, 32, 2, function (p) {
      plaster(p, { seed: 6, ramp: C.ramp(['9a9282', 'aea694', 'c0b8a5', 'cfc8b5', 'ddd6c3']), cracks: 1 });
      var b = WOOD;
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var beam = x < 3 || y < 3 || Math.abs((x - 16) - (y - 16)) < 2 && x > 3 && y > 3;
        if (beam) p.px(x, y, rampDither(b, 0.4 + (x < 1 || y < 1 ? 0.25 : 0) + BTS.M.hash(x, y) * 0.15, x, y));
      }
    });
    def('wall_planks', 32, 32, 2, function (p) { planks(p, { seed: 7, ramp: WOOD_GREY, plank: 5, vertical: true, len: 32, nails: true }); });
    def('wall_planks_brown', 32, 32, 2, function (p) { planks(p, { seed: 8, ramp: WOOD, plank: 6, vertical: true, len: 32 }); });
    def('wall_brick', 32, 32, 2, function (p) {
      var r = C.ramp(['3a2a22', '4d3a2f', '604a3c', '725a49', '836a56', '947b65']);
      for (var y = 0; y < 32; y++) for (var x = 0; x < 32; x++) {
        var row = Math.floor(y / 4), lx = (x + (row % 2) * 5) % 10, ly = y % 4;
        var t = 0.5 + (BTS.M.hash(Math.floor((x + (row % 2) * 5) / 10), row) - 0.5) * 0.45 + (BTS.M.hash(x, y) - 0.5) * 0.15;
        if (ly === 3 || lx === 9) t = 0.04; else if (ly === 0) t += 0.15;
        p.px(x, y, rampDither(r, t, x, y, 0.15));
      }
    });
    def('wall_int_white', 32, 32, 2, function (p) { plaster(p, { seed: 9, ramp: C.ramp(['7f786b', '948d7e', 'a7a090', 'b6af9f', 'c3bdac']), cracks: 1 }); });
    def('wall_int_blue', 32, 32, 2, function (p) { plaster(p, { seed: 10, ramp: C.ramp(['56636a', '67757b', '78878b', '89979a', '98a5a6']), cracks: 1 }); });
    def('wall_int_wood', 32, 32, 2, function (p) { planks(p, { seed: 11, ramp: C.ramp(['2a1c13', '3a281b', '4a3523', '5a422c', '6a4f35']), plank: 6, vertical: true, len: 32 }); });
    def('wall_int_dark', 32, 32, 2, function (p) { plaster(p, { seed: 12, ramp: C.ramp(['2b2623', '35302c', '3f3934', '4a433d', '544c45']), cracks: 3, patches: 0.2, stoneRamp: STONE_DARK }); });

    /* ---------- roofs ---------- */
    def('roof_tile', 32, 32, 2, function (p) { roofTiles(p, { ramp: C.ramp(['3e1d14', '5a2b1c', '773a24', '8f4a2d', 'a65c38', 'b86d45']), seed: 1, moss: 0.08 }); });
    def('roof_tile_brown', 32, 32, 2, function (p) { roofTiles(p, { ramp: C.ramp(['2f1d16', '45291e', '5b3727', '704632', '84563d']), seed: 2, moss: 0.15 }); });
    def('roof_slab', 32, 32, 2, function (p) { roofTiles(p, { ramp: C.ramp(['2b2926', '3b3834', '4d4943', '5f5a52', '726c62']), rowH: 8, tw: 11, seed: 3, moss: 0.2 }); });
    def('roof_shingle', 32, 32, 2, function (p) { roofTiles(p, { ramp: C.ramp(['1f1a16', '2d2620', '3c332a', '4a4034', '594d3e']), rowH: 4, tw: 4, seed: 4, moss: 0.12 }); });

    /* ---------- trims & details ---------- */
    def('wood_beam', 16, 16, 1, function (p) { planks(p, { seed: 12, ramp: WOOD, plank: 16, len: 16 }); });
    def('wood_dark', 16, 16, 1, function (p) { planks(p, { seed: 13, ramp: C.ramp(['1c140f', '2a1e15', '38291c', '453323']), plank: 16, len: 16 }); });
    def('wood_light', 16, 16, 1, function (p) { planks(p, { seed: 14, ramp: C.ramp(['5e4630', '735839', '886a44', '9c7c50', 'ad8d5c']), plank: 4, len: 16 }); });
    def('stone_block', 16, 16, 1, function (p) { stones(p, { count: 3, mortar: 1, ramp: STONE_GREY, mortarRamp: C.ramp(['332e28']), seed: 41 }); });
    def('metal', 16, 16, 1, function (p) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.px(x, y, rampDither(C.ramp(['22252a', '30343a', '42474e', '5a6068']), 0.4 + BTS.M.hash(x, y) * 0.3 - y * 0.01, x, y));
    });
    def('cloth_red', 16, 16, 1, function (p) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.px(x, y, (x % 8 < 4) ? [150, 44, 38] : [208, 196, 168]); });
    def('cloth_green', 16, 16, 1, function (p) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.px(x, y, (x % 8 < 4) ? [58, 86, 52] : [196, 186, 150]); });
    def('cloth_white', 16, 16, 1, function (p) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.px(x, y, rampDither(C.ramp(['a29a8a', 'b8b09e', 'cbc4b2', 'dcd6c6']), 0.5 + BTS.M.hash(x, y) * 0.2 + (y % 5 === 0 ? -0.2 : 0), x, y)); });
    def('cloth_dark', 16, 16, 1, function (p) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.px(x, y, rampDither(C.ramp(['1e1a1c', '2a2427', '362f32', '433a3d']), 0.5 + BTS.M.hash(x, y) * 0.25, x, y)); });
    def('blanket', 16, 16, 1, function (p) {
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
        var d = (Math.abs((x % 8) - 4) + Math.abs((y % 8) - 4));
        p.px(x, y, d === 3 ? [40, 30, 28] : d < 2 ? [190, 140, 60] : (x + y) % 2 ? [120, 40, 36] : [104, 36, 32]);
      }
    });
    def('hay', 16, 16, 1, function (p) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.px(x, y, rampDither(C.ramp(['6e5a2a', '8a7236', 'a58a44', 'bea056']), 0.4 + Math.sin(x * 1.3 + y * 0.4) * 0.2 + BTS.M.hash(x, y) * 0.3, x, y)); });
    def('logs_end', 16, 16, 1, function (p) {
      p.fill([40, 28, 20]);
      var pos = [[3, 3], [9, 3], [14, 3], [6, 8], [12, 8], [1, 8], [3, 13], [9, 13], [14, 13]];
      pos.forEach(function (c, k) {
        p.ellipse(c[0], c[1], 2.6, 2.4, [150, 112, 70]);
        p.ellipse(c[0], c[1], 1.6, 1.4, [176, 136, 86]);
        p.px(c[0], c[1], [120, 86, 52]);
      });
    });
    def('bark', 16, 16, 1, function (p) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.px(x, y, rampDither(C.ramp(['221a14', '2f241b', '3d2f23', '4b3a2b']), 0.4 + Math.sin(x * 2.1) * 0.25 + BTS.M.hash(x, y >> 2) * 0.2, x, y)); });
    def('plaster_trim', 16, 16, 1, function (p) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.px(x, y, rampDither(C.ramp(['b5ad9a', 'c7c0ad', 'd8d2c0']), 0.5 + BTS.M.hash(x, y) * 0.2, x, y)); });

    /* doors (1x2 units) */
    function door(name, ramp, arch, seed) {
      def(name, 16, 32, 0, function (p) {
        p.wrap = false;
        planks(p, { seed: seed, ramp: ramp, plank: 4, vertical: true, len: 64 });
        for (var y = 0; y < 32; y++) for (var x = 0; x < 16; x++) {
          if (arch) { var dx = x - 7.5, dy = y - 8; if (y < 8 && dx * dx + dy * dy > 64) p.px(x, y, [0, 0, 0], 0); }
          if (x === 0 || x === 15 || (!arch && y === 0)) p.px(x, y, C.mul(ramp[0], 0.8));
        }
        p.rect(1, 9, 14, 1, ramp[0]); p.rect(1, 22, 14, 1, ramp[0]);
        p.px(12, 17, [30, 26, 22]); p.px(12, 18, [150, 140, 120]); p.px(11, 17, [80, 72, 60]);
      });
    }
    door('door', WOOD, false, 21);
    door('door_grey', WOOD_GREY, false, 22);
    door('door_dark', C.ramp(['140e0b', '1f1610', '2a1e16', '35271c']), false, 23);
    door('door_arch', C.ramp(['2a1a10', '3d2817', '50361f', '644529', '765433']), true, 24);
    /* windows: alpha 160 marks glass (glows at night) */
    function windowTex(name, shutters, frameCol, seed) {
      def(name, 16, 16, 0, function (p) {
        p.wrap = false;
        p.fill([0, 0, 0, 0]);
        var gx0 = shutters ? 4 : 1, gx1 = shutters ? 11 : 14;
        for (var y = 1; y < 15; y++) for (var x = gx0; x <= gx1; x++) {
          var glass = (x === Math.floor((gx0 + gx1) / 2) || y === 7) ? null : [34, 40, 46];
          if (x === gx0 || x === gx1 || y === 1 || y === 14) glass = null;
          if (glass) { var g = (x + y) % 5 === 0 ? [72, 80, 86] : glass; p.px(x, y, g, 160); }
          else p.px(x, y, frameCol);
        }
        p.rect(gx0 - 1, 14, gx1 - gx0 + 3, 2, [150, 140, 120]);  // sill
        if (shutters) {
          planks({ w: 3, h: 14, px: function (x, y, c) { p.px(x, y + 1, c); p.px(x + 13, y + 1, c); } }, { seed: seed, ramp: shutters, plank: 3, vertical: true, len: 64 });
        }
      });
    }
    // simple painter shim for planks() above
    windowTex('window', C.ramp(['3a4a3a', '4c5e48', '5f7258', '6f8466']), [64, 52, 40], 1);
    windowTex('window_blue', C.ramp(['2c3c52', '3a4d66', '4a5f7a', '5a708a']), [60, 50, 42], 2);
    windowTex('window_brown', C.ramp(['3a2618', '4c3220', '5e3f29', '6e4b31']), [50, 40, 32], 3);
    windowTex('window_plain', null, [70, 58, 44], 4);
    def('window_round', 16, 16, 0, function (p) {
      p.wrap = false; p.fill([0, 0, 0, 0]);
      p.ellipse(8, 8, 6, 6, [60, 52, 44]); p.ellipse(8, 8, 4.5, 4.5, [30, 34, 38], 160);
    });
    def('icon_fresco', 16, 24, 0, function (p) {   /* niche fresco of a saint (abstracted, see ref photo 4) */
      p.wrap = false; p.fill([0, 0, 0, 0]);
      for (var y = 0; y < 24; y++) for (var x = 0; x < 16; x++) {
        var dx = x - 7.5, dy = y - 7;
        if (y >= 7 || dx * dx + dy * dy <= 56) p.px(x, y, [196, 168, 118]);
      }
      p.ellipse(7.5, 7, 3.5, 3.5, [214, 176, 64]);           // halo
      p.ellipse(7.5, 7.5, 2, 2.2, [200, 150, 120]);          // face
      p.rect(5, 10, 6, 11, [150, 40, 36]);                   // red robe
      p.rect(6, 12, 4, 8, [52, 70, 120]);                    // blue
      p.rect(2, 13, 3, 3, [214, 200, 170]);                  // wing/book
      p.rect(11, 13, 3, 3, [214, 200, 170]);
    });
    def('plaque', 24, 12, 0, function (p) {
      p.wrap = false; p.fill([120, 108, 86]);
      p.rect(0, 0, 24, 1, [70, 60, 48]); p.rect(0, 11, 24, 1, [70, 60, 48]);
      for (var y = 3; y < 10; y += 2) for (var x = 3; x < 21; x++) if (BTS.M.hash(x, y) > 0.35) p.px(x, y, [60, 52, 40]);
    });
    def('gravestone', 16, 16, 1, function (p) { stones(p, { count: 2, mortar: 0.5, ramp: STONE_GREY, mortarRamp: C.ramp(['555048']), seed: 51, moss: 0.25 }); });
    def('shelf_jars', 32, 16, 0, function (p) {
      p.wrap = false; p.fill([40, 28, 20]);
      for (var x = 2; x < 30; x += 5) {
        var col = [[60, 80, 60], [90, 70, 50], [60, 60, 80], [110, 100, 70], [70, 50, 60], [50, 70, 70]][(x / 5) | 0];
        p.rect(x, 3, 4, 6, col); p.rect(x + 1, 2, 2, 1, [30, 24, 20]); p.px(x, 4, [200, 200, 180]);
        p.rect(x, 11, 4, 4, C.mul(col, 0.9));
      }
      p.rect(0, 9, 32, 2, [70, 50, 34]); p.rect(0, 15, 32, 1, [70, 50, 34]);
    });
    def('books', 32, 16, 0, function (p) {
      p.wrap = false; p.fill([34, 24, 18]);
      var rnd = BTS.RNG(77);
      for (var row = 0; row < 2; row++) for (var x = 1; x < 31;) {
        var w = rnd.int(2, 3), h = rnd.int(5, 7), c = rnd.pick([[96, 40, 34], [52, 60, 44], [110, 90, 60], [60, 50, 70], [140, 120, 90]]);
        p.rect(x, row * 8 + 8 - h, w, h, c); p.px(x, row * 8 + 8 - h + 1, C.mul(c, 1.3)); x += w;
      }
      p.rect(0, 7, 32, 1, [70, 50, 34]); p.rect(0, 15, 32, 1, [70, 50, 34]);
    });
    def('stove_front', 16, 16, 0, function (p) {
      p.wrap = false;
      for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) p.px(x, y, rampDither(C.ramp(['2a2622', '3a3530', '4a443d']), 0.5 + BTS.M.hash(x, y) * 0.2, x, y));
      p.rect(4, 8, 8, 6, [20, 16, 14]); p.rect(5, 10, 6, 3, [160, 70, 30], 200);
    });
    def('pinned_notes', 32, 24, 0, function (p) {   /* board with notes — Jaglika's records */
      p.wrap = false; p.fill([44, 34, 28]);
      p.rect(0, 0, 32, 1, [24, 18, 14]); p.rect(0, 23, 32, 1, [24, 18, 14]);
      var rnd = BTS.RNG(5);
      for (var k = 0; k < 7; k++) {
        var x = rnd.int(1, 24), y = rnd.int(1, 15), w = rnd.int(5, 8), h = rnd.int(6, 8);
        p.rect(x, y, w, h, [196, 184, 156]);
        for (var ly = y + 2; ly < y + h - 1; ly += 2) for (var lx = x + 1; lx < x + w - 1; lx++) if (rnd() > 0.3) p.px(lx, ly, [70, 60, 52]);
        p.px(x + (w >> 1), y, [150, 30, 30]);
      }
      for (k = 0; k < 4; k++) p.line(rnd.int(2, 30), rnd.int(2, 22), rnd.int(2, 30), rnd.int(2, 22), [140, 30, 30]);
    });
    def('poster_anatomy', 16, 20, 0, function (p) {
      p.wrap = false; p.fill([186, 170, 140]);
      p.rect(0, 0, 16, 1, [120, 104, 80]);
      p.ellipse(8, 5, 2, 2, [60, 40, 36]); p.rect(7, 7, 2, 7, [60, 40, 36]); p.rect(4, 8, 8, 1, [60, 40, 36]);
      p.rect(6, 14, 1, 4, [60, 40, 36]); p.rect(9, 14, 1, 4, [60, 40, 36]);
      p.line(3, 3, 6, 5, [120, 30, 30]); p.line(13, 12, 9, 10, [120, 30, 30]);
    });
    def('cross_wood', 8, 16, 0, function (p) { p.wrap = false; p.fill([0, 0, 0, 0]); p.rect(3, 0, 2, 16, [70, 52, 36]); p.rect(0, 4, 8, 2, [70, 52, 36]); p.px(3, 0, [100, 76, 52]); });
    BTS.Log.info('textures painted:', Object.keys(DEF).length);
  }

  return { build: build, defs: DEF, rampDither: rampDither, stones: stones, planks: planks, plaster: plaster, grass: grass, dirt: dirt, ramps: { STONE_WARM: STONE_WARM, STONE_GREY: STONE_GREY, STONE_DARK: STONE_DARK, WOOD: WOOD, WOOD_GREY: WOOD_GREY, MORTAR: MORTAR, MOSS: MOSS } };
})();
