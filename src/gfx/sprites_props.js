/* Procedural billboard props, vegetation, effects sprites, shadow-creature frames and UI icons. */
'use strict';
BTS.PropSprites = (function () {
  var C = BTS.Col, A = BTS.Atlas, rd = BTS.Textures.rampDither;
  var OUT = [20, 18, 16];
  var defs = {};
  function sprite(name, w, h, fn, opts) {
    var p = new A.Painter(w, h); p.wrap = false;
    fn(p);
    if (!opts || opts.outline !== false) p.outline((opts && opts.outlineCol) || OUT);
    var r = A.commit(name, p);
    defs[name] = r;
    return r;
  }

  /* leafy crown made of shaded blobs, lit from upper-left */
  function crown(p, cx, cy, rx, ry, ramp, seed, density) {
    var rnd = BTS.RNG(seed);
    var blobs = [];
    var n = density || 26;
    for (var i = 0; i < n; i++) {
      var a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
      blobs.push([cx + Math.cos(a) * r * rx * 0.8, cy + Math.sin(a) * r * ry * 0.8, 3 + rnd() * (rx * 0.35)]);
    }
    blobs.sort(function (a, b) { return a[1] - b[1]; });
    for (var y = Math.floor(cy - ry - 4); y < cy + ry + 4; y++) for (var x = Math.floor(cx - rx - 4); x < cx + rx + 4; x++) {
      var best = -1, bi = -1;
      for (var k = 0; k < blobs.length; k++) {
        var b = blobs[k], dx = x - b[0], dy = y - b[1], d = 1 - (dx * dx + dy * dy) / (b[2] * b[2]);
        if (d > 0 && k > bi) { best = d; bi = k; }
      }
      if (bi < 0) continue;
      var bb = blobs[bi];
      var lx = (x - bb[0]) / bb[2], ly = (y - bb[1]) / bb[2];
      var t = 0.55 - lx * 0.25 - ly * 0.3 + (BTS.M.hash(x, y) - 0.5) * 0.25 - ((y - (cy - ry)) / (ry * 2)) * 0.25;
      if (best < 0.18) t -= 0.25;
      p.px(x, y, rd(ramp, t, x, y, 0.25));
    }
  }
  function trunk(p, cx, top, bottom, w, ramp) {
    for (var y = top; y <= bottom; y++) {
      var ww = w + (y > bottom - 3 ? 2 : 0);
      for (var x = -Math.floor(ww / 2); x < Math.ceil(ww / 2); x++) {
        var t = 0.5 - x / ww * 0.6 + (BTS.M.hash(x + cx, y >> 1) - 0.5) * 0.3;
        p.px(cx + x, y, rd(ramp, t, cx + x, y));
      }
    }
  }
  var LEAF = C.ramp(['1c2a16', '26381b', '324820', '405a27', '506d2f', '638339']);
  var LEAF_DARK = C.ramp(['141c12', '1b2617', '23321c', '2c3e22', '364a28']);
  var LEAF_AUT = C.ramp(['3a2414', '55331a', '6f4520', '8a5a28', 'a67232', 'c08c40']);
  var PINE = C.ramp(['101a16', '16241d', '1d3024', '263c2c', '304a34']);
  var BARK = C.ramp(['1e1612', '2c2019', '3a2b21', '4a382a']);
  var BIRCH = C.ramp(['6a665e', '9a968c', 'c4c0b4', 'dedad0']);

  function build() {
    /* ---------- trees ---------- */
    [['tree_oak', 64, 80, LEAF, 1], ['tree_oak2', 64, 80, LEAF, 2], ['tree_walnut', 72, 76, LEAF_DARK, 3], ['tree_autumn', 60, 76, LEAF_AUT, 4]].forEach(function (t) {
      sprite(t[0], t[1], t[2], function (p) {
        var w = t[1], h = t[2];
        trunk(p, w / 2, h * 0.45, h - 1, 5, BARK);
        // branches
        p.line(w / 2, h * 0.55, w / 2 - 9, h * 0.42, BARK[1]); p.line(w / 2, h * 0.5, w / 2 + 10, h * 0.38, BARK[1]);
        crown(p, w / 2, h * 0.36, w * 0.44, h * 0.32, t[3], t[4], 30);
      });
    });
    sprite('tree_poplar', 28, 96, function (p) {
      trunk(p, 14, 74, 95, 3, BARK);
      for (var k = 0; k < 9; k++) { var cy = 10 + k * 8, w = 4 + Math.sin(k / 8 * Math.PI) * 6; crown(p, 14 + (k % 2 ? 1 : -1), cy, w, 7, LEAF, 70 + k, 7); }
    });
    sprite('licitar', 32, 12, function (p) {
      for (var i = 0; i < 4; i++) { var cx = 4 + i * 8, cy = 6; for (var y = 0; y < 9; y++) for (var x = -4; x <= 4; x++) { var hx = Math.abs(x), yy = y - 2; if ((yy < 0 && (Math.pow(hx - 2, 2) + Math.pow(yy + 0.5, 2) < 4.5)) || (yy >= 0 && hx < 4 - yy * 0.7)) p.px(cx + x, cy + y - 4, [176, 30, 34]); } p.px(cx - 1, cy - 2, [240, 230, 210]); p.px(cx + 1, cy, [240, 230, 210]); p.px(cx, cy - 1, [90, 160, 80]); p.px(cx - 2, cy + 1, [240, 200, 60]); }
    });
    sprite('tree_pine', 48, 88, function (p) {
      trunk(p, 24, 70, 87, 4, BARK);
      for (var tier = 0; tier < 6; tier++) {
        var cy = 10 + tier * 11, rw = 6 + tier * 3.4;
        for (var y = 0; y < 14; y++) for (var x = -rw; x <= rw; x++) {
          var edge = rw * (y / 14);
          if (Math.abs(x) > edge + 1) continue;
          var t = 0.6 - x / rw * 0.35 - y / 14 * 0.2 + (BTS.M.hash(x + tier, y) - 0.5) * 0.3;
          p.px(24 + x, cy + y, rd(PINE, t, 24 + x, cy + y));
        }
      }
    });
    sprite('tree_birch', 40, 84, function (p) {
      trunk(p, 20, 30, 83, 3, BIRCH);
      for (var y = 32; y < 83; y += 5) p.px(20 + (y % 3) - 1, y, [40, 36, 30]);
      crown(p, 20, 26, 16, 22, C.ramp(['2a3a1c', '3a4e24', '4a622c', '5c7636', '6e8a40']), 9, 20);
    });
    sprite('tree_plum', 44, 52, function (p) {
      trunk(p, 22, 26, 51, 3, BARK);
      p.line(22, 30, 13, 22, BARK[1]); p.line(22, 28, 31, 20, BARK[1]);
      crown(p, 22, 20, 19, 15, LEAF, 11, 18);
      var rnd = BTS.RNG(3);
      for (var i = 0; i < 12; i++) { var x = rnd.int(8, 36), y = rnd.int(10, 30); if (p.alpha(x, y)) p.px(x, y, [70, 50, 110]); }
    });
    sprite('tree_dead', 48, 72, function (p) {
      trunk(p, 24, 20, 71, 4, BARK);
      p.line(24, 40, 10, 22, BARK[1]); p.line(24, 34, 38, 14, BARK[1]); p.line(16, 30, 12, 12, BARK[1]); p.line(32, 22, 40, 20, BARK[1]); p.line(24, 22, 26, 4, BARK[1]);
    });
    sprite('bush', 32, 22, function (p) { crown(p, 16, 12, 14, 9, LEAF, 13, 12); });
    sprite('bush_dark', 32, 22, function (p) { crown(p, 16, 12, 14, 9, LEAF_DARK, 14, 12); });
    sprite('bush_berry', 28, 20, function (p) {
      crown(p, 14, 11, 12, 8, LEAF, 15, 10);
      var rnd = BTS.RNG(6); for (var i = 0; i < 8; i++) { var x = rnd.int(4, 24), y = rnd.int(5, 16); if (p.alpha(x, y)) p.px(x, y, [150, 30, 40]); }
    });
    sprite('hedge', 48, 20, function (p) { crown(p, 24, 11, 23, 8, LEAF_DARK, 16, 18); });
    function tuft(name, ramp, seed, h, flowers) {
      sprite(name, 12, h, function (p) {
        var rnd = BTS.RNG(seed);
        for (var b = 0; b < 9; b++) {
          var x = rnd.int(1, 10), top = rnd.int(0, h / 2), lean = rnd.int(-2, 2);
          for (var y = top; y < h; y++) { var t = (y - top) / (h - top); p.px(Math.round(x + lean * (1 - t)), y, rd(ramp, 0.8 - t * 0.6, x, y)); }
          if (flowers && b % 3 === 0) p.px(Math.round(x + lean), top, flowers[b % flowers.length]);
        }
      }, { outline: false });
    }
    tuft('grass_tuft', C.ramp(['2a3c1c', '3a5226', '4e6a30', '62803a']), 1, 10);
    tuft('grass_tuft2', C.ramp(['2a3c1c', '3a5226', '4e6a30', '62803a']), 2, 8, [[230, 220, 190], [210, 190, 80]]);
    tuft('grass_tall', C.ramp(['3a3a1c', '50502a', '686636', '7e7c44']), 3, 16);
    tuft('reeds', C.ramp(['2a321a', '3a4622', '4c5a2c', '5e6c36']), 4, 20, [[90, 60, 40]]);
    tuft('flowers_wild', C.ramp(['2a3c1c', '3a5226', '4e6a30']), 5, 9, [[220, 80, 70], [230, 220, 200], [200, 170, 60], [150, 100, 170]]);
    sprite('fern', 16, 10, function (p) { for (var i = -6; i <= 6; i++) { var y = Math.abs(i) / 1.5; p.line(8, 9, 8 + i, Math.round(y), LEAF[3 - (i & 1)]); } }, { outline: false });
    sprite('rock', 20, 14, function (p) {
      for (var y = 0; y < 14; y++) for (var x = 0; x < 20; x++) {
        var dx = (x - 10) / 10, dy = (y - 9) / 8; if (dx * dx + dy * dy > 1 || y > 13) continue;
        p.px(x, y, rd(BTS.Textures.ramps.STONE_GREY, 0.6 - dx * 0.3 - dy * 0.35 + BTS.M.hash(x, y) * 0.15, x, y));
      }
      p.px(6, 4, BTS.Textures.ramps.MOSS[2]); p.px(7, 4, BTS.Textures.ramps.MOSS[1]);
    });
    sprite('rock_big', 36, 24, function (p) {
      for (var y = 0; y < 24; y++) for (var x = 0; x < 36; x++) {
        var dx = (x - 18) / 18, dy = (y - 15) / 14; if (dx * dx + dy * dy > 1 || y > 23) continue;
        var t = 0.62 - dx * 0.3 - dy * 0.35 + (BTS.M.fbm(x / 5, y / 5) - 0.5) * 0.5;
        p.px(x, y, rd(BTS.Textures.ramps.STONE_GREY, t, x, y));
      }
      for (var k = 0; k < 14; k++) p.px(8 + k, 4 + (k % 3), BTS.Textures.ramps.MOSS[k % 3]);
    });

    /* ---------- village props ---------- */
    sprite('lantern_post', 10, 32, function (p) {
      p.rect(4, 8, 2, 24, [40, 32, 26]); p.rect(3, 30, 4, 2, [30, 24, 20]);
      p.rect(2, 3, 6, 6, [40, 36, 30]); p.rect(3, 4, 4, 4, [250, 210, 120]); p.px(4, 5, [255, 240, 190]); p.rect(2, 2, 6, 1, [30, 26, 22]);
    });
    sprite('lantern_hang', 8, 10, function (p) { p.px(4, 0, [40, 36, 30]); p.rect(2, 2, 5, 6, [40, 36, 30]); p.rect(3, 3, 3, 4, [250, 200, 110]); p.px(4, 4, [255, 240, 190]); });
    sprite('lantern_paper', 8, 10, function (p) { p.px(4, 0, [40, 36, 30]); p.ellipse(4, 5, 3.5, 4, [210, 90, 60]); p.ellipse(4, 5, 2, 3, [250, 170, 110]); });
    sprite('brazier', 18, 20, function (p) {   /* torch bowl as in ref photo 2 foreground */
      p.rect(8, 10, 2, 9, [50, 44, 40]); p.rect(5, 18, 8, 2, [40, 36, 32]);
      for (var x = 0; x < 18; x++) for (var y = 4; y < 11; y++) { var dx = (x - 9) / 9, dy = (y - 4) / 7; if (dx * dx + dy * dy <= 1 && y > 4) p.px(x, y, rd(C.ramp(['2a2622', '3e3832', '56504a', '6e6860']), 0.6 - dx * 0.3, x, y)); }
      p.rect(3, 4, 12, 1, [80, 72, 64]);
    });
    sprite('candle', 4, 8, function (p) { p.rect(1, 3, 2, 5, [220, 210, 180]); p.px(1, 3, [240, 236, 220]); p.px(1, 1, [255, 220, 120]); p.px(1, 2, [255, 170, 60]); }, { outline: false });
    sprite('candelabra', 14, 26, function (p) {     /* ref photo 1 */
      var g = [190, 170, 120], gd = [130, 110, 70];
      p.rect(6, 6, 2, 18, g); p.rect(3, 23, 8, 2, gd); p.rect(4, 14, 6, 2, g); p.ellipse(7, 18, 3, 1.5, gd); p.rect(2, 9, 10, 1, g);
      p.rect(6, 2, 2, 4, [230, 220, 190]); p.px(6, 0, [255, 220, 120]); p.px(6, 1, [255, 170, 60]);
    });
    sprite('flame', 6, 10, function (p) { p.ellipse(3, 6, 2.5, 4, [240, 120, 40]); p.ellipse(3, 7, 1.5, 2.5, [255, 210, 110]); p.px(3, 8, [255, 250, 220]); }, { outline: false });
    sprite('bonfire', 22, 12, function (p) {
      p.line(2, 11, 18, 5, [70, 46, 28]); p.line(3, 5, 20, 11, [60, 40, 24]); p.line(10, 3, 11, 11, [80, 54, 32]);
      for (var i = 0; i < 9; i++) p.px(4 + i * 2, 11, [40, 36, 34]);
    });
    sprite('barrel', 12, 16, function (p) {
      for (var y = 0; y < 16; y++) { var w = 10 + (y > 3 && y < 12 ? 1 : 0); for (var x = 0; x < w; x++) p.px(x + (12 - w) / 2, y, rd(BTS.Textures.ramps.WOOD, 0.65 - x / w * 0.5 + (x % 3 === 0 ? -0.1 : 0), x, y)); }
      p.rect(0, 3, 12, 1, [50, 50, 54]); p.rect(0, 12, 12, 1, [50, 50, 54]); p.rect(1, 0, 10, 1, [110, 84, 56]);
    });
    sprite('sack', 10, 12, function (p) { p.ellipse(5, 7, 5, 5, [150, 130, 96]); p.rect(3, 1, 4, 3, [130, 112, 80]); p.px(4, 7, [120, 104, 76]); p.px(6, 9, [170, 150, 112]); });
    sprite('basket', 12, 9, function (p) { for (var y = 3; y < 9; y++) for (var x = 1; x < 11; x++) p.px(x, y, (x + y) % 2 ? [150, 110, 60] : [120, 86, 46]); p.line(2, 3, 6, 0, [110, 80, 46]); p.line(6, 0, 10, 3, [110, 80, 46]); p.px(4, 3, [180, 60, 50]); p.px(7, 3, [200, 170, 60]); });
    sprite('pot_clay', 10, 10, function (p) { p.ellipse(5, 6, 4.5, 4, [150, 80, 50]); p.rect(3, 1, 4, 2, [130, 70, 44]); p.px(3, 5, [190, 110, 70]); });
    sprite('jug', 8, 12, function (p) { p.ellipse(4, 8, 3.5, 3.5, [170, 100, 60]); p.rect(3, 1, 2, 5, [160, 92, 56]); p.px(6, 4, [150, 84, 50]); p.px(3, 7, [210, 140, 90]); });
    sprite('bucket', 9, 9, function (p) { for (var y = 2; y < 9; y++) p.rect(1 + (y < 4 ? 0 : 0), y, 7, 1, rd(C.ramp(['3a3a3e', '55565c', '70727a']), 0.6 - y * 0.03, 0, y)); p.line(1, 2, 4, 0, [40, 40, 44]); p.line(4, 0, 7, 2, [40, 40, 44]); });
    sprite('chicken', 8, 8, function (p) { p.ellipse(4, 5, 3, 2.5, [230, 224, 210]); p.rect(5, 1, 2, 3, [230, 224, 210]); p.px(6, 0, [190, 40, 40]); p.px(7, 2, [220, 160, 40]); p.px(6, 2, [20, 20, 20]); p.px(3, 7, [200, 150, 40]); p.px(5, 7, [200, 150, 40]); });
    sprite('chicken2', 8, 8, function (p) { p.ellipse(4, 5, 3, 2.5, [150, 90, 50]); p.rect(5, 2, 2, 3, [150, 90, 50]); p.px(6, 1, [190, 40, 40]); p.px(7, 3, [220, 160, 40]); p.px(3, 7, [200, 150, 40]); p.px(4, 7, [200, 150, 40]); });
    sprite('dog', 14, 10, function (p) { p.rect(2, 3, 9, 4, [110, 84, 60]); p.rect(9, 1, 4, 4, [110, 84, 60]); p.px(12, 2, [20, 20, 20]); p.px(9, 0, [80, 60, 44]); p.rect(2, 7, 1, 3, [90, 68, 48]); p.rect(9, 7, 1, 3, [90, 68, 48]); p.px(1, 2, [110, 84, 60]); p.rect(3, 3, 6, 1, [140, 110, 80]); });
    sprite('dog_lie', 16, 6, function (p) { p.rect(2, 2, 10, 3, [110, 84, 60]); p.rect(11, 1, 4, 3, [110, 84, 60]); p.px(14, 2, [20, 20, 20]); p.px(1, 3, [110, 84, 60]); });
    sprite('cat', 10, 8, function (p) { p.rect(2, 3, 6, 3, [40, 36, 36]); p.rect(6, 1, 3, 3, [40, 36, 36]); p.px(6, 0, [40, 36, 36]); p.px(8, 0, [40, 36, 36]); p.px(7, 2, [200, 200, 80]); p.line(1, 4, 0, 1, [40, 36, 36]); p.rect(2, 6, 1, 2, [40, 36, 36]); p.rect(6, 6, 1, 2, [40, 36, 36]); });
    sprite('sheep', 14, 11, function (p) { p.ellipse(6, 5, 6, 4, [220, 214, 200]); p.rect(11, 3, 3, 3, [40, 36, 34]); p.rect(3, 8, 1, 3, [40, 36, 34]); p.rect(9, 8, 1, 3, [40, 36, 34]); p.px(4, 3, [240, 236, 226]); });
    sprite('crow', 8, 6, function (p) { p.ellipse(4, 3, 3, 2, [20, 20, 24]); p.px(7, 2, [20, 20, 24]); p.px(7, 3, [60, 60, 40]); }, { outlineCol: [10, 10, 12] });
    sprite('laundry', 24, 14, function (p) {
      p.rect(0, 0, 24, 1, [60, 56, 50]);
      p.rect(1, 1, 7, 10, [220, 214, 200]); p.rect(9, 1, 6, 12, [150, 50, 44]); p.rect(16, 1, 7, 8, [190, 184, 164]);
      p.rect(2, 3, 5, 1, [180, 60, 60]); p.rect(9, 4, 6, 1, [220, 200, 120]);
    });
    sprite('woodpile', 28, 16, function (p) {
      for (var row = 0; row < 4; row++) for (var i = 0; i < 6; i++) {
        var cx = 3 + i * 4.4 + (row % 2) * 2, cy = 13 - row * 3.4;
        p.ellipse(cx, cy, 2.4, 2.1, [150, 112, 70]); p.ellipse(cx, cy, 1.3, 1.1, [178, 138, 88]);
      }
    });
    sprite('axe_stump', 16, 16, function (p) {
      p.rect(2, 9, 12, 7, [80, 60, 40]); p.rect(2, 9, 12, 2, [160, 120, 80]); p.ellipse(8, 10, 5, 1, [180, 140, 96]);
      p.line(8, 9, 12, 1, [110, 80, 50]); p.rect(5, 6, 4, 3, [140, 146, 156]);
    });
    sprite('anvil', 16, 12, function (p) { p.rect(1, 2, 14, 3, [60, 62, 68]); p.rect(0, 2, 3, 2, [60, 62, 68]); p.rect(5, 5, 6, 3, [50, 52, 58]); p.rect(3, 8, 10, 4, [70, 54, 40]); p.rect(2, 2, 12, 1, [110, 114, 124]); });
    sprite('wheel', 14, 14, function (p) { p.ellipse(7, 7, 7, 7, [70, 50, 34]); p.ellipse(7, 7, 5.5, 5.5, [0, 0, 0], 0); for (var a = 0; a < 6; a++) p.line(7, 7, Math.round(7 + Math.cos(a) * 6), Math.round(7 + Math.sin(a) * 6), [90, 66, 44]); });
    sprite('cart', 40, 22, function (p) {
      p.rect(4, 6, 32, 8, [100, 74, 48]); p.rect(4, 6, 32, 2, [130, 98, 64]); for (var x = 6; x < 36; x += 6) p.rect(x, 6, 1, 8, [80, 58, 38]);
      p.ellipse(10, 16, 6, 6, [60, 44, 30]); p.ellipse(10, 16, 4, 4, [0, 0, 0], 0); p.ellipse(30, 16, 6, 6, [60, 44, 30]); p.ellipse(30, 16, 4, 4, [0, 0, 0], 0);
      p.rect(9, 15, 2, 2, [90, 66, 44]); p.rect(29, 15, 2, 2, [90, 66, 44]); p.line(36, 10, 40, 14, [90, 66, 44]);
      for (var k = 0; k < 10; k++) p.px(8 + k * 3, 5, [180, 150, 70]);
    });
    sprite('beehive', 12, 14, function (p) { for (var y = 0; y < 14; y++) { var w = Math.min(12, 6 + y); p.rect(6 - w / 2, y, w, 1, (y % 3) ? [176, 140, 70] : [140, 108, 52]); } p.rect(5, 10, 2, 2, [30, 24, 20]); });
    sprite('scarecrow', 18, 30, function (p) { p.rect(8, 6, 2, 24, [90, 66, 44]); p.rect(1, 10, 16, 2, [90, 66, 44]); p.ellipse(9, 5, 4, 4, [200, 180, 120]); p.rect(4, 0, 10, 2, [60, 50, 40]); p.rect(5, 10, 8, 9, [110, 60, 50]); p.px(7, 5, [30, 24, 20]); p.px(10, 5, [30, 24, 20]); });
    sprite('well_bucket', 6, 6, function (p) { p.rect(0, 1, 6, 5, [90, 70, 50]); p.rect(0, 1, 6, 1, [120, 96, 70]); });
    sprite('stall_goods', 32, 10, function (p) {
      var cols = [[180, 60, 40], [200, 160, 60], [120, 70, 40], [210, 200, 170], [90, 120, 60], [160, 90, 140]];
      for (var i = 0; i < 8; i++) { var c = cols[i % cols.length]; p.ellipse(3 + i * 3.8, 6, 2, 2.5, c); p.px(2 + i * 3.8, 5, C.mul(c, 1.3)); }
    });
    sprite('bread', 24, 8, function (p) { for (var i = 0; i < 4; i++) { p.ellipse(3 + i * 6, 5, 3, 2.5, [170, 110, 50]); p.px(2 + i * 6, 3, [210, 160, 90]); } });
    sprite('wreath', 24, 24, function (p) {
      var rnd = BTS.RNG(21);
      for (var a = 0; a < 80; a++) {
        var ang = a / 80 * Math.PI * 2, r = 9 + rnd() * 2;
        var x = 12 + Math.cos(ang) * r, y = 12 + Math.sin(ang) * r;
        p.px(x, y, LEAF[rnd.int(2, 5)]);
        if (a % 4 === 0) p.px(x + rnd.int(-1, 1), y + rnd.int(-1, 1), rnd.pick([[230, 220, 190], [220, 80, 70], [230, 200, 60], [190, 110, 170], [240, 140, 60]]));
      }
      p.line(12, 2, 12, 21, LEAF[2]);
      p.line(12, 12, 6, 6, LEAF[3]); p.line(12, 12, 18, 6, LEAF[3]);
    }, { outline: false });
    sprite('garland', 8, 8, function (p) {
      var rnd = BTS.RNG(31);
      for (var i = 0; i < 26; i++) { var x = rnd.int(0, 7), y = rnd.int(0, 7); p.px(x, y, LEAF[rnd.int(1, 5)]); }
      for (i = 0; i < 4; i++) p.px(rnd.int(0, 7), rnd.int(0, 7), rnd.pick([[230, 220, 190], [220, 80, 70], [230, 200, 60], [190, 110, 170], [240, 140, 60]]));
    }, { outline: false });
    sprite('ribbon_red', 2, 16, function (p) { p.rect(0, 0, 2, 16, [180, 40, 36]); p.px(0, 15, [0, 0, 0], 0); }, { outline: false });
    sprite('ribbon_white', 2, 16, function (p) { p.rect(0, 0, 2, 16, [230, 226, 214]); }, { outline: false });
    sprite('ribbon_blue', 2, 16, function (p) { p.rect(0, 0, 2, 16, [50, 70, 130]); }, { outline: false });
    sprite('cross_grave', 12, 18, function (p) { p.rect(5, 0, 2, 18, [70, 56, 44]); p.rect(1, 4, 10, 2, [70, 56, 44]); p.px(5, 0, [100, 80, 62]); p.rect(3, 16, 6, 2, [60, 50, 40]); });
    sprite('cross_grave_new', 12, 18, function (p) { p.rect(5, 0, 2, 18, [150, 120, 84]); p.rect(1, 4, 10, 2, [150, 120, 84]); p.px(5, 0, [190, 156, 110]); p.rect(2, 16, 8, 2, [90, 70, 50]); p.px(3, 15, [200, 60, 60]); p.px(8, 15, [230, 220, 200]); });
    sprite('headstone', 12, 14, function (p) { for (var y = 0; y < 14; y++) for (var x = 0; x < 12; x++) { var dx = x - 5.5, dy = y - 4; if (y < 4 && dx * dx + dy * dy > 30) continue; p.px(x, y, rd(BTS.Textures.ramps.STONE_GREY, 0.6 - x / 24 + BTS.M.hash(x, y) * 0.2, x, y)); } p.rect(3, 5, 6, 1, [60, 56, 50]); p.rect(3, 7, 5, 1, [60, 56, 50]); });
    sprite('amulet', 6, 6, function (p) { p.rect(1, 2, 4, 3, [140, 30, 30]); p.px(2, 3, [180, 50, 40]); p.line(0, 0, 5, 5, [220, 220, 230]); }, { outlineCol: [40, 10, 10] });
    sprite('sparkle', 5, 5, function (p) { p.px(2, 0, [255, 255, 230]); p.px(2, 4, [255, 255, 230]); p.px(0, 2, [255, 255, 230]); p.px(4, 2, [255, 255, 230]); p.px(2, 2, [255, 255, 255]); p.px(1, 1, [255, 240, 200], 120); p.px(3, 3, [255, 240, 200], 120); }, { outline: false });
    sprite('icon_shelf', 4, 4, function (p) { p.fill([255, 255, 255]); }, { outline: false });
    sprite('smoke', 16, 16, function (p) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var dx = (x - 7.5) / 8, dy = (y - 7.5) / 8, d = dx * dx + dy * dy; if (d < 1) p.px(x, y, [200, 200, 205], Math.floor((1 - d) * 160 * (BTS.M.hash(x, y) > 0.3 ? 1 : 0.6))); } }, { outline: false });
    sprite('soft_dot', 16, 16, function (p) { for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) { var dx = (x - 7.5) / 8, dy = (y - 7.5) / 8, d = dx * dx + dy * dy; if (d < 1) p.px(x, y, [255, 255, 255], Math.floor(Math.pow(1 - d, 1.5) * 255)); } }, { outline: false });
    sprite('blob_shadow', 16, 8, function (p) { for (var y = 0; y < 8; y++) for (var x = 0; x < 16; x++) { var dx = (x - 7.5) / 8, dy = (y - 3.5) / 4, d = dx * dx + dy * dy; if (d < 1) p.px(x, y, [0, 0, 0], Math.floor((1 - d) * 220)); } }, { outline: false });
    sprite('beam_grad', 8, 32, function (p) { for (var y = 0; y < 32; y++) for (var x = 0; x < 8; x++) { var a = Math.pow(y / 31, 1.6) * (1 - Math.abs(x - 3.5) / 5); p.px(x, y, [255, 255, 255], Math.floor(a * 255)); } }, { outline: false });
    sprite('leaf', 3, 3, function (p) { p.px(1, 0, [150, 90, 40]); p.px(0, 1, [180, 110, 40]); p.px(1, 1, [160, 80, 30]); p.px(2, 2, [120, 70, 30]); }, { outline: false });
    sprite('petal', 2, 2, function (p) { p.px(0, 0, [240, 220, 220]); p.px(1, 1, [220, 120, 140]); }, { outline: false });
    sprite('firefly', 3, 3, function (p) { p.px(1, 1, [255, 250, 180]); p.px(0, 1, [200, 220, 120], 120); p.px(2, 1, [200, 220, 120], 120); p.px(1, 0, [200, 220, 120], 120); p.px(1, 2, [200, 220, 120], 120); }, { outline: false });
    sprite('herbs_hang', 16, 14, function (p) {
      p.rect(0, 0, 16, 1, [60, 46, 34]);
      for (var i = 0; i < 4; i++) { var x = 1 + i * 4; p.rect(x + 1, 1, 1, 3, [140, 120, 80]); p.ellipse(x + 1.5, 7, 2, 4, [[90, 110, 60], [120, 100, 60], [80, 90, 50], [130, 80, 90]][i]); }
    });
    sprite('needle_bundle', 16, 8, function (p) {     /* dozens of needles on red cloth (Jaglika's storage) */
      p.rect(0, 2, 16, 6, [120, 30, 30]); p.rect(0, 2, 16, 1, [150, 44, 40]);
      for (var i = 0; i < 15; i += 2) p.line(i, 7, i + 1, 0, [210, 214, 224]);
    });
    sprite('vials', 16, 10, function (p) {
      for (var i = 0; i < 5; i++) { var x = 1 + i * 3; p.rect(x, 3, 2, 7, [190, 210, 220]); p.rect(x, 2, 2, 1, [200, 60, 60]); p.px(x, 6 + (i % 2), [140, 170, 190]); }
    });
    sprite('papers', 14, 8, function (p) { p.rect(0, 2, 10, 6, [210, 200, 176]); p.rect(4, 0, 10, 7, [226, 218, 196]); for (var y = 2; y < 6; y++) p.rect(5, y, 7, 1, (y % 2) ? [120, 110, 100] : [226, 218, 196]); });
    sprite('photo_frame', 8, 10, function (p) { p.rect(0, 0, 8, 10, [110, 80, 50]); p.rect(1, 1, 6, 8, [180, 168, 140]); p.ellipse(4, 4, 1.5, 1.5, [90, 80, 70]); p.rect(2, 6, 4, 3, [90, 80, 70]); });
    sprite('icon_corner', 10, 12, function (p) { p.rect(0, 0, 10, 12, [130, 96, 50]); p.rect(1, 1, 8, 10, [190, 160, 90]); p.ellipse(5, 4, 2, 2, [214, 176, 64]); p.rect(3, 6, 4, 5, [140, 40, 36]); p.px(5, 4, [200, 150, 120]); });
    sprite('mirror_broken', 10, 14, function (p) { p.rect(0, 0, 10, 14, [80, 60, 40]); p.rect(1, 1, 8, 12, [150, 170, 180]); p.line(2, 2, 7, 11, [60, 70, 80]); p.line(7, 3, 3, 9, [60, 70, 80]); });
    sprite('suitcase', 14, 10, function (p) { p.rect(0, 2, 14, 8, [130, 60, 50]); p.rect(5, 0, 4, 2, [60, 40, 30]); p.rect(0, 5, 14, 1, [90, 40, 34]); p.px(2, 4, [200, 180, 120]); p.px(11, 4, [200, 180, 120]); });
    sprite('tent_cloth', 4, 4, function (p) { p.fill([200, 190, 160]); }, { outline: false });
    sprite('bell', 12, 12, function (p) { for (var y = 2; y < 11; y++) { var w = 4 + Math.floor(y * 0.7); p.rect(6 - w / 2, y, w, 1, rd(C.ramp(['5a4a2a', '7a6436', '9a8044', 'b89a56']), 0.7 - y / 20, 0, y)); } p.rect(5, 0, 2, 2, [60, 50, 30]); p.px(6, 11, [60, 50, 30]); });
    sprite('cradle_toy', 10, 8, function (p) { p.ellipse(5, 5, 4, 3, [180, 150, 110]); p.px(3, 4, [30, 24, 20]); p.px(6, 4, [30, 24, 20]); p.rect(1, 1, 2, 2, [180, 150, 110]); p.rect(7, 1, 2, 2, [180, 150, 110]); });   // Zajko's toy rabbit
    sprite('ball', 6, 6, function (p) { p.ellipse(3, 3, 3, 3, [190, 60, 50]); p.rect(0, 3, 6, 1, [230, 220, 200]); });
    sprite('kite', 12, 16, function (p) { for (var y = 0; y < 12; y++) { var w = y < 5 ? y * 2 : (12 - y) * 1.4; p.rect(6 - w / 2, y, w, 1, y < 5 ? [190, 70, 50] : [230, 200, 80]); } p.line(6, 12, 5, 15, [80, 70, 60]); });
    sprite('easel', 14, 24, function (p) { p.line(2, 23, 7, 0, [110, 80, 50]); p.line(12, 23, 7, 0, [110, 80, 50]); p.rect(2, 4, 10, 9, [220, 210, 186]); p.rect(3, 6, 8, 5, [120, 140, 100]); });

    buildShadowCreature();
    buildIcons();
    BTS.Log.info('prop sprites:', Object.keys(defs).length);
  }

  /* Jaglika's grown shadow: an elongated many-limbed silhouette in 4 writhing frames (white mask,
     tinted black at draw time). Painted with alpha so it doubles as a ground/wall shadow texture. */
  function buildShadowCreature() {
    for (var f = 0; f < 4; f++) (function (f) {
      sprite('shadow_beast_' + f, 64, 96, function (p) {
        var rnd = BTS.RNG(100 + f);
        var W = [255, 255, 255];
        // body: tall hunched spine
        for (var y = 30; y < 96; y++) { var w = 6 + Math.sin(y * 0.1 + f) * 2 + (y > 80 ? (y - 80) * 0.5 : 0); p.rect(32 - w / 2 + Math.sin(y * 0.07 + f * 0.8) * 3, y, w, 1, W); }
        // head: elongated, tilted, with a crooked crown of thorns
        p.ellipse(34 + Math.sin(f) * 2, 22, 7, 11, W);
        for (var k = 0; k < 5; k++) p.line(30 + k * 2, 13, 27 + k * 3 + rnd.int(-2, 2), 2 + rnd.int(0, 5), W);
        // many arms
        for (var a = 0; a < 6; a++) {
          var sy = 36 + a * 7, side = a % 2 ? 1 : -1;
          var x = 32, y = sy;
          for (var s = 0; s < 22; s++) {
            x += side * (1 + rnd() * 0.6); y += Math.sin(s * 0.35 + f * 0.9 + a) * 1.2 + (s > 14 ? 0.8 : -0.2);
            p.rect(x, y, s < 10 ? 2 : 1, s < 10 ? 2 : 1, W);
          }
          for (var fi = 0; fi < 3; fi++) p.line(x, y, x + side * rnd.int(2, 4), y + rnd.int(-3, 3), W);
        }
      }, { outline: false });
    })(f);
  }

  /* 16x16 inventory icons */
  function buildIcons() {
    function icon(name, fn) { sprite('icon_' + name, 16, 16, fn, { outlineCol: [24, 18, 14] }); }
    icon('sketchbook', function (p) { p.rect(2, 2, 12, 12, [120, 84, 54]); p.rect(3, 3, 10, 10, [216, 206, 182]); for (var y = 5; y < 12; y += 2) p.rect(4, y, 8, 1, [140, 130, 116]); p.rect(2, 2, 1, 12, [80, 56, 36]); });
    icon('pencil', function (p) { p.line(2, 13, 12, 3, [200, 160, 60]); p.line(3, 13, 13, 3, [170, 130, 40]); p.px(13, 2, [60, 60, 60]); p.px(2, 14, [220, 190, 160]); });
    icon('photo', function (p) { p.rect(2, 1, 12, 14, [226, 220, 204]); p.rect(3, 2, 10, 9, [120, 110, 90]); p.ellipse(6, 5, 1.5, 1.5, [200, 180, 150]); p.ellipse(10, 5, 1.5, 1.5, [200, 180, 150]); p.rect(5, 7, 3, 4, [70, 60, 60]); p.rect(9, 7, 3, 4, [90, 80, 100]); });
    icon('bread', function (p) { p.ellipse(8, 9, 6, 4, [176, 116, 54]); p.ellipse(7, 8, 4, 2, [210, 160, 90]); p.line(5, 7, 7, 10, [130, 80, 36]); p.line(9, 7, 11, 10, [130, 80, 36]); });
    icon('amulet', function (p) { p.rect(5, 6, 6, 6, [140, 30, 30]); p.rect(6, 7, 4, 1, [190, 60, 50]); p.line(3, 13, 12, 2, [220, 222, 232]); p.px(12, 2, [255, 255, 255]); });
    icon('needle', function (p) { p.line(3, 13, 12, 2, [220, 222, 232]); p.line(4, 13, 13, 2, [160, 164, 176]); p.px(12, 3, [30, 30, 30]); p.line(12, 3, 14, 8, [150, 30, 30]); });
    icon('key', function (p) { p.ellipse(5, 5, 3, 3, [170, 150, 80]); p.ellipse(5, 5, 1.2, 1.2, [0, 0, 0], 0); p.line(7, 7, 13, 13, [170, 150, 80]); p.rect(10, 12, 2, 2, [170, 150, 80]); p.rect(12, 10, 2, 2, [170, 150, 80]); });
    icon('lantern', function (p) { p.rect(6, 1, 4, 2, [50, 46, 40]); p.rect(4, 3, 8, 10, [50, 46, 40]); p.rect(5, 4, 6, 8, [250, 200, 110]); p.rect(7, 6, 2, 4, [255, 240, 200]); p.rect(3, 13, 10, 2, [40, 36, 32]); });
    icon('flashlight', function (p) { p.rect(2, 6, 9, 4, [50, 52, 58]); p.rect(11, 5, 3, 6, [70, 72, 80]); p.rect(14, 6, 1, 4, [255, 240, 180]); p.rect(4, 7, 2, 1, [140, 140, 150]); });
    icon('camera', function (p) { p.rect(2, 5, 12, 8, [40, 40, 44]); p.rect(4, 3, 4, 2, [40, 40, 44]); p.ellipse(8, 9, 3, 3, [90, 110, 130]); p.ellipse(8, 9, 1.5, 1.5, [30, 40, 50]); p.px(12, 6, [200, 60, 50]); });
    icon('letter', function (p) { p.rect(1, 4, 14, 9, [220, 210, 186]); p.line(1, 4, 8, 9, [150, 140, 120]); p.line(14, 4, 8, 9, [150, 140, 120]); p.px(8, 9, [160, 40, 40]); });
    icon('vial', function (p) { p.rect(6, 2, 4, 2, [200, 60, 60]); p.rect(5, 4, 6, 10, [190, 210, 220]); p.rect(6, 8, 4, 5, [120, 160, 180]); p.px(6, 5, [240, 250, 255]); });
    icon('wreath', function (p) { for (var a = 0; a < 40; a++) { var g = a / 40 * 6.283; p.px(8 + Math.cos(g) * 5.5, 8 + Math.sin(g) * 5.5, a % 5 ? [70, 110, 50] : [220, 80, 70]); } });
    icon('candle', function (p) { p.rect(6, 5, 4, 10, [226, 216, 190]); p.px(7, 2, [255, 220, 120]); p.px(7, 3, [255, 160, 50]); p.px(7, 4, [40, 30, 20]); p.rect(4, 14, 8, 2, [140, 110, 70]); });
    icon('book', function (p) { p.rect(2, 2, 12, 12, [90, 40, 34]); p.rect(3, 3, 1, 10, [130, 60, 50]); p.rect(6, 5, 6, 2, [200, 170, 90]); p.rect(13, 3, 1, 11, [220, 210, 186]); });
    icon('toy', function (p) { p.ellipse(8, 10, 5, 4, [200, 170, 130]); p.rect(4, 2, 2, 5, [200, 170, 130]); p.rect(10, 2, 2, 5, [200, 170, 130]); p.ellipse(8, 7, 3.5, 3, [200, 170, 130]); p.px(7, 7, [30, 24, 20]); p.px(9, 7, [30, 24, 20]); p.px(5, 3, [230, 180, 170]); });
    icon('thread', function (p) { p.rect(4, 3, 8, 10, [150, 30, 30]); p.rect(3, 2, 10, 1, [110, 80, 50]); p.rect(3, 13, 10, 1, [110, 80, 50]); for (var y = 4; y < 13; y += 2) p.rect(4, y, 8, 1, [180, 50, 44]); });
    icon('cloth', function (p) { p.rect(2, 3, 12, 10, [226, 220, 204]); for (var x = 3; x < 13; x += 2) p.px(x, 4, [180, 40, 40]); for (x = 3; x < 13; x += 2) p.px(x + 1, 11, [40, 60, 130]); p.ellipse(8, 8, 2, 2, [180, 40, 40]); });
  }

  return { build: build, defs: defs };
})();
