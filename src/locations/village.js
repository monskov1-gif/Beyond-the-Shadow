/* Pakleštica — the village map. North (small z) is the hill with Đorđe's house; the church sits
   on a rise to the north-east; the main street runs west–east; the fair meadow lies south-east;
   Jaglika's house stands alone at the western forest edge. */
'use strict';
(function () {
  var M = BTS.M;
  var ROADS = [
    { pts: [[0, 47], [20, 46], [40, 46.5], [64, 46], [84, 47], [110, 46]], w: 3.4, t: 'auto' },          // main street
    { pts: [[6, 64], [30, 64.5], [52, 64], [70, 64.5], [90, 64]], w: 2.4, t: 'dirt' },                      // south lane
    { pts: [[55, 46], [55.5, 41], [58.6, 33.2], [48.5, 30], [59.5, 25.5], [51.2, 22.4], [54.8, 19.5], [53.8, 17.4]], w: 2.0, t: 'dirt' },   // serpentine up the hill
    { pts: [[80, 46.5], [83, 36], [86, 29]], w: 2.2, t: 'gravel' },                                         // church path
    { pts: [[62, 64.5], [72, 69], [80, 72]], w: 2.4, t: 'dirt' },                                           // to the fair
    { pts: [[50, 46.5], [49, 56], [52, 64], [53, 76], [53, 100]], w: 2.6, t: 'dirt' },                      // south road (over the creek bridge)
    { pts: [[14, 46.5], [11, 38], [13, 31], [6, 31], [0, 31]], w: 1.8, t: 'dirt' },                         // west path / forest
    { pts: [[13, 31], [12, 27.5]], w: 1.4, t: 'mud' },                                                      // Jaglika's yard path
    { pts: [[30, 46.5], [29, 64.5]], w: 1.6, t: 'dirt' }, { pts: [[90, 47], [91, 64]], w: 1.6, t: 'dirt' },
    { pts: [[38, 46.5], [36, 34], [34, 28]], w: 1.4, t: 'dirt' }, { pts: [[70, 46], [70, 34], [69, 28]], w: 1.4, t: 'dirt' }
  ];
  function segDist(px, pz, a, b) {
    var dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
    var t = l2 ? M.clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / l2, 0, 1) : 0;
    return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
  }
  /* the creek along the southern edge; the south road crosses it on a wooden bridge at x 53 */
  var CREEK = [[2, 91], [10, 88.6], [16, 87.2], [21, 85.9], [27, 86.6], [34, 87.5], [41, 87.1], [47, 86.3], [53, 86.3], [59, 87.1], [65, 88.8], [72, 91.4], [80, 94]];
  function creekD(x, z) {
    var d = 1e9;
    for (var k = 0; k < CREEK.length - 1; k++) d = Math.min(d, segDist(x, z, CREEK[k], CREEK[k + 1]));
    return Math.min(d, Math.hypot(x - 21, z - 85.4) - 1.6);     // the old pond widens it at the fields
  }
  function roadAt(x, z) {
    for (var i = 0; i < ROADS.length; i++) {
      var r = ROADS[i];
      for (var k = 0; k < r.pts.length - 1; k++) {
        var d = segDist(x, z, r.pts[k], r.pts[k + 1]);
        var w = r.w / 2 + (M.hash(Math.floor(x), Math.floor(z)) - 0.5) * 0.5;
        if (d < w) return r.t === 'auto' ? ((x > 26 && x < 84) ? 'cobble' : 'dirt') : r.t;
      }
    }
    return null;
  }
  function height(x, z) {
    var h = 0;
    var dh = Math.hypot(x - 55, (z - 11.5) * 1.1);
    h += 6.6 * M.smooth(27, 5.5, dh);                      // Đorđe's hill: a real rise with a flat top for the house
    h += 2.6 * M.smooth(24, 3, z);                         // northern ridge
    h += 1.3 * M.smooth(13, 4, Math.hypot(x - 87, z - 24)); // church rise
    h += 1.6 * M.smooth(10, 0, x) * M.smooth(50, 20, z);   // western forest slope
    h += (M.fbm(x * 0.07, z * 0.07, 3) - 0.5) * 0.7;
    var meadow = M.smooth(10, 3, Math.max(Math.abs(x - 85) - 14, Math.abs(z - 77) - 8, 0));
    h = M.lerp(h, 0.05, meadow * 0.85);
    h -= 1.5 * M.smooth(2.6, 0.6, creekD(x, z));          // creek bed
    return h;
  }
  var tileCache = null;
  function computeTile(x, z) {
    var cd = creekD(x, z);
    if (cd < 1.35) return 'water';
    var r = roadAt(x, z);
    if (Math.hypot(x - 52, z - 47) < 5.2) return 'cobble';
    if (r) return r;
    if (cd < 2.2) return M.hash(x * 1.3, z) > 0.45 ? 'mud' : 'grass_dark';
    if (x > 66 && x < 104 && z > 67 && z < 97) return ((x * 7 + z * 3) | 0) % 11 === 0 ? 'grass_dry' : 'grass_meadow';
    if (x > 77 && x < 97 && z > 14 && z < 34) return 'grass_dark';                  // churchyard
    if (x < 34 && z > 77 && z < 88) return ((z | 0) % 9 < 7) ? 'field' : 'grass';     // fields
    if (x < 7 || x > 104 || z < 6 || z > 97) return 'grass_dark';
    if (Math.hypot(x - 11, z - 25) < 6) return M.hash(x, z) > 0.6 ? 'mud' : 'grass_dry';  // Jaglika's yard
    var n = M.fbm(x * 0.15 + 3, z * 0.15, 2);
    if (n > 0.66) return 'grass_dry';
    return 'grass';
  }
  function tileAt(x, z) {
    if (!tileCache) { tileCache = []; for (var zz = 0; zz < 100; zz++) for (var xx = 0; xx < 112; xx++) tileCache.push(computeTile(xx + 0.5, zz + 0.5)); }
    var ix = Math.floor(x), iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= 112 || iz >= 100) return 'grass_dark';
    return tileCache[iz * 112 + ix];
  }

  var WALLS = ['wall_plaster', 'wall_plaster_ochre', 'wall_plaster_patchy', 'wall_stone', 'wall_plaster_blue', 'wall_plaster_rose', 'wall_timber', 'wall_plaster'];
  var ROOFS = ['roof_tile', 'roof_tile', 'roof_tile_brown', 'roof_slab', 'roof_tile'];
  var WINS = ['window', 'window_blue', 'window_brown', 'window_plain'];

  BTS.Locations.village = {
    id: 'village', nameKey: 'loc.village', bounds: [3, 4, 107, 89], music: 'village', mapArea: null,
    camera: { padX: 10, padZ0: 2, padZ1: 2 },
    height: height, tile: tileAt,
    ambience: { wind: 1, leaves: 1, dogs: true, rooster: true, sheep: [9, 56], reverb: 0.12, reverbLen: 2.2 },
    surface: function (x, z) {
      var t = tileAt(x, z);
      if (/cobble|gravel/.test(t)) return 'stone';
      if (/mud|water/.test(t) || BTS.Env.wet > 0.5 && /dirt/.test(t)) return 'mud';
      if (/dirt|field|sand/.test(t)) return 'dirt';
      return 'grass';
    },
    build: function (L) {
      var R = BTS.RNG(77);
      function generic(x, z, o) {
        o = o || {};
        var w = o.w || R.range(4.2, 6.2), d = o.d || R.range(3.6, 4.8);
        var wall = o.wall || R.pick(WALLS);
        var roofType = o.roofType || (R() < 0.25 ? 'hip' : (R() < 0.2 ? 'gable_z' : 'gable'));
        var wt = R.pick(WINS);
        var wins = [];
        var n = w > 5 ? 2 : 1;
        var doorAt = o.doorAt !== undefined ? o.doorAt : (R() < 0.5 ? -w * 0.22 : w * 0.22);
        if (n === 2) { wins.push({ side: 's', at: doorAt < 0 ? w * 0.05 : -w * 0.05 - 0.9 }); wins.push({ side: 's', at: doorAt < 0 ? w * 0.3 : -w * 0.32 }); }
        else wins.push({ side: 's', at: -doorAt * 0.9 });
        if (R() < 0.6) wins.push({ side: R() < 0.5 ? 'e' : 'w', at: 0 });
        var h = L.house({
          id: o.id || ('house_' + Math.round(x) + '_' + Math.round(z)), x: x, z: z, w: w, d: d, h: o.h || R.range(2.4, 2.9), wall: wall,
          base: R() < 0.5 ? 'wall_stone_grey' : 'wall_stone', baseH: R.range(0.3, 0.7), roof: o.roof || R.pick(ROOFS), roofType: roofType,
          door: { side: 's', at: doorAt, tile: R() < 0.7 ? 'door' : 'door_grey' }, windows: wins, windowTile: wt, chimney: R() < 0.75,
          beams: wall === 'wall_timber' || R() < 0.15, porch: o.porch !== undefined ? o.porch : R() < 0.22, shed: o.shed !== undefined ? o.shed : (R() < 0.3 ? (R() < 0.5 ? 'e' : 'w') : null),
          lit: o.lit, lived: o.lived, mapLabel: o.mapLabel
        });
        // yard details
        var fx = x - w / 2 - 1, fz = z + d / 2 + 2.6;
        if (o.fence !== false && R() < 0.65) L.fence([[fx, z - d / 2 + 0.6], [fx, fz], [x + doorAt - 1, fz]], { pickets: R() < 0.6, h: 0.9 });
        if (R() < 0.35) L.woodpile(x + w / 2 + 0.8, z + 0.3, 1.6);
        if (R() < 0.3) L.billboard(R.pick(['barrel', 'pot_clay', 'bucket', 'basket']), x + doorAt + 0.9, z + d / 2 + 0.5, { mat: BTS.MAT.WOOD, collide: 0.25 });
        if (R() < 0.25) L.billboard('laundry', x + w / 2 + 1.2, z + d / 2 + 1.6, { mat: BTS.MAT.CLOTH, wind: 0.35, collide: 0.2 });
        if (R() < 0.4) L.tree(R.pick(['tree_plum', 'tree_walnut', 'tree_oak2']), x + (R() < 0.5 ? -1 : 1) * (w / 2 + 2.2), z - d / 2 + R.range(-0.5, 1));
        if (R() < 0.3) L.scatter(['bush', 'bush_berry'], x - w / 2, z + d / 2 + 0.5, x + w / 2, z + d / 2 + 1.4, 2, { wind: 0.2 });
        return h;
      }

      /* ---------- Đorđe's house on the hill: raised on a stone plinth with a covered terrace (trijem) and steps ---------- */
      var dj = L.house({ id: 'h_djordje', x: 55, z: 11, w: 6.5, d: 5, h: 2.8, wall: 'wall_plaster_patchy', base: 'wall_stone', baseH: 0.7, raise: 0.75, noStep: true, roof: 'roof_tile', door: { side: 's', at: -1.2 }, windows: [{ side: 's', at: 1.2 }, { side: 's', at: 2.6, w: 0.7 }, { side: 'e', at: 0 }, { side: 'w', at: 0.6 }], windowTile: 'window', chimney: [-2, 0.5], porch: false, mapLabel: 'area.hill' });
      (function () {
        var fl = dj.floor, tx0 = 51.45, tx1 = 58.55, tz0 = 13.5, tz1 = 15.5, sx0 = 53.0, sx1 = 54.6, sz1 = 17.4;
        var mb = L.propMB(55, 14.5), low = Math.min(height(tx0, tz1), height(tx1, tz1), height(tx0, tz0), height(tx1, tz0)) - 0.3;
        // stone plinth with a plank floor on top
        mb.box(55, low, (tz0 + tz1) / 2, tx1 - tx0, fl - low, tz1 - tz0, { all: 'wall_stone', top: 'floor_wood' }, { mat: BTS.MAT.STONE, ao: 0.6 });
        mb.box(55, fl - 0.12, tz1 + 0.02, tx1 - tx0 + 0.06, 0.12, 0.08, { all: 'wood_dark' }, { mat: BTS.MAT.WOOD });
        L.pad(tx0, tz0 - 0.2, tx1, tz1, fl);
        // steps down to the path, then the terrace edges are solid
        L.stairs(sx0, tz1, sx1, sz1, 'n', height((sx0 + sx1) / 2, sz1), fl, { side: 'wall_stone', top: 'stone_block', rail: 'wood_dark' });
        L.box(tx0 - 0.08, tz1 - 0.08, sx0, tz1 + 0.1, 'terrace'); L.box(sx1, tz1 - 0.08, tx1 + 0.08, tz1 + 0.1, 'terrace');
        L.box(tx0 - 0.12, tz0, tx0 + 0.06, tz1 + 0.1, 'terrace'); L.box(tx1 - 0.06, tz0, tx1 + 0.12, tz1 + 0.1, 'terrace');
        // railing (balusters + hand rail) along the front, broken by the steps
        [[tx0 + 0.05, sx0], [sx1, tx1 - 0.05]].forEach(function (seg) {
          for (var x = seg[0]; x <= seg[1] + 0.01; x += 0.3) mb.post(x, fl, tz1 - 0.05, 0.85, 0.05, 'wood_dark', { mat: BTS.MAT.WOOD });
          L.beam(mb, seg[0], fl + 0.88, tz1 - 0.05, seg[1], fl + 0.88, tz1 - 0.05, 0.08, 'wood_beam');
        });
        [tx0 + 0.05, tx1 - 0.05].forEach(function (x) { for (var z = tz0 + 0.3; z < tz1; z += 0.3) mb.post(x, fl, z, 0.85, 0.05, 'wood_dark', { mat: BTS.MAT.WOOD }); L.beam(mb, x, fl + 0.88, tz0, x, fl + 0.88, tz1 - 0.05, 0.08, 'wood_beam'); });
        // roof posts and the trijem roof: a separate chunk that fades while Đorđe stands under it
        var rb = new BTS.MeshBuilder(), wh = 2.8;
        [tx0 + 0.08, sx0 - 0.05, sx1 + 0.05, 56.9, tx1 - 0.08].forEach(function (x) { rb.post(x, fl, tz1 - 0.08, wh - 0.3, 0.16, 'wood_beam', { mat: BTS.MAT.WOOD }); });
        rb.box(55, fl + wh - 0.42, tz1 - 0.08, tx1 - tx0 + 0.2, 0.16, 0.18, { all: 'wood_dark' }, { mat: BTS.MAT.WOOD });
        rb.quad([[tx0 - 0.3, fl + wh - 0.62, tz1 + 0.35], [tx1 + 0.3, fl + wh - 0.62, tz1 + 0.35], [tx1 + 0.3, fl + wh + 0.02, tz0], [tx0 - 0.3, fl + wh + 0.02, tz0]], BTS.M.norm3([0, 1, 0.7]), [[0, 1.2], [3.6, 1.2], [3.6, 0], [0, 0]], 'roof_tile', null, BTS.MAT.STONE);
        rb.quad([[tx0 - 0.3, fl + wh - 0.74, tz1 + 0.35], [tx1 + 0.3, fl + wh - 0.74, tz1 + 0.35], [tx1 + 0.3, fl + wh - 0.62, tz1 + 0.35], [tx0 - 0.3, fl + wh - 0.62, tz1 + 0.35]], [0, 0, 1], [[0, 0.06], [7, 0.06], [7, 0], [0, 0]], 'wood_dark', null, BTS.MAT.WOOD);
        var rc = L.addChunk(rb, { id: 'h_djordje_trijem', fadeable: true });
        if (rc) rc.base = [tx0 - 0.3, tz1 + 0.3, tx1 + 0.3, tz1 + 0.35, fl + wh];
        // a bench and a pot of geraniums on the terrace
        mb.box(57.4, fl, 13.85, 1.6, 0.42, 0.42, { all: 'wood_light' }, { mat: BTS.MAT.WOOD }); L.box(56.6, 13.6, 58.2, 14.1, 'bench');
        mb.billboard(52.0, fl, 13.9, 'pot_clay', { mat: BTS.MAT.STONE }); mb.billboard(52.0, fl + 0.5, 13.92, 'bush_berry', { scale: 0.45, wind: 0.2 });
        L.light(53.8, fl + 2.2, 14.6, [1.0, 0.66, 0.36], 4.2, 0.7, 'lamp', 0.05);
        L.statics.push({ sprite: 'lantern_hang', x: sx1 + 0.05, y: fl + 1.9, z: tz1 + 0.05, scale: 1.2, emissive: true, night: true });
      })();
      L.spot('djordje_door', dj.doorWorld[0], dj.doorWorld[1] + 0.25, 'down');
      L.spot('djordje_steps', 53.8, 18.0, 'up');
      L.spot('djordje_view', 55, 19.6, 'down');
      L.bench(59.5, 17.8, 2.2);
      L.fence([[49, 15.5], [49, 19.5], [53.3, 19.5]], { pickets: true }); L.fence([[56.7, 19.5], [61.5, 19.5], [61.5, 14]], { pickets: true });
      L.woodpile(60.2, 10.6, 2);
      L.billboard('beehive', 47.5, 12, { mat: BTS.MAT.WOOD, collide: 0.3 }); L.billboard('beehive', 46.6, 13.2, { mat: BTS.MAT.WOOD, collide: 0.3 });
      for (var i = 0; i < 7; i++) L.tree('tree_plum', 40 + (i % 3) * 3.2 + R.range(-0.5, 0.5), 9 + Math.floor(i / 3) * 3.4);     // grandmother's orchard
      L.tree('tree_walnut', 64, 8); L.tree('tree_poplar', 67, 13); L.tree('tree_poplar', 44, 20);
      // spruces sheltering the house from the north wind
      [[49.5, 6.2, 'tree_spruce'], [52.4, 5.4, 'tree_spruce2'], [57.8, 5.6, 'tree_spruce'], [61.2, 6.6, 'tree_spruce2'], [47.2, 8.0, 'tree_spruce_young'], [63.0, 11.2, 'tree_spruce_young']].forEach(function (t) { L.tree(t[2], t[0], t[1], { scale: 1.05 }); });
      L.lanternPost(51.7, 17.8, { radius: 5, intensity: 0.9 });
      // the serpentine: low dry-stone retaining walls on the outside of each bend, rough steps where it is steepest
      L.stoneWall([[60.3, 34.6], [60.4, 33], [59.6, 31.6]], { h: 0.55, th: 0.4 });
      L.stoneWall([[47.4, 31.6], [46.9, 30], [47.6, 28.5]], { h: 0.55, th: 0.4 });
      L.stoneWall([[61.2, 27.0], [61.4, 25.4], [60.6, 24.0]], { h: 0.55, th: 0.4 });
      L.stoneWall([[49.8, 23.9], [49.4, 22.3], [50.3, 21.0]], { h: 0.55, th: 0.4 });
      (function () {
        var steps = [[[58.6, 33.2], [48.5, 30]], [[48.5, 30], [59.5, 25.5]], [[59.5, 25.5], [51.2, 22.4]]];
        steps.forEach(function (sg) {
          for (var t = 0.3; t < 0.8; t += 0.24) {
            var x = sg[0][0] + (sg[1][0] - sg[0][0]) * t, z = sg[0][1] + (sg[1][1] - sg[0][1]) * t, dx = sg[1][0] - sg[0][0], dz = sg[1][1] - sg[0][1], l = Math.hypot(dx, dz);
            var nx = -dz / l * 0.8, nz = dx / l * 0.8, mb = L.propMB(x, z);
            L.beam(mb, x - nx, height(x - nx, z - nz) + 0.06, z - nz, x + nx, height(x + nx, z + nz) + 0.06, z + nz, 0.14, 'bark');
          }
        });
      })();
      ['tree_spruce_young', 'tree_birch', 'tree_spruce2', 'tree_spruce_young', 'tree_spruce_young'].forEach(function (k, n) { var pts = [[62.4, 30.5], [45.2, 27.2], [63.6, 22.6], [53.0, 35.6], [57.2, 37.6]]; L.tree(k, pts[n][0], pts[n][1]); });

      /* ---------- church (ref photo 4) & churchyard ---------- */
      var ch = L.house({ id: 'h_church', x: 87, z: 22.5, w: 5.4, d: 8, h: 4.0, wall: 'wall_stone', base: 'wall_stone_grey', baseH: 0.3, roof: 'roof_slab', roofType: 'gable_z', rise: 2.2, overhang: 0.25, door: { side: 's', at: 0, tile: 'door_arch' }, windows: [{ side: 'e', at: -1.5, y: 2.0, w: 0.5, h: 0.8, tile: 'window_plain' }, { side: 'w', at: -1.5, y: 2.0, w: 0.5, h: 0.8, tile: 'window_plain' }], lit: true, lived: false, noDrip: true, mapLabel: 'area.church' });
      (function () {
        var mb = L.propMB(87, 26.5), fl = ch.floor;
        mb.decal(87, fl + 2.55, 26.5, 0.75, 1.1, 's', 'icon_fresco', BTS.MAT.DEFAULT);
        mb.decal(87, fl + 2.1, 26.5, 1.0, 0.42, 's', 'plaque', BTS.MAT.STONE);
        mb.decal(87, fl + 4.6, 26.5, 0.6, 0.6, 's', 'window_round', BTS.MAT.GLASS);
        // voussoir arch over the door: light stone blocks
        for (var a = 0; a <= 8; a++) { var ang = Math.PI * a / 8; mb.box(87 + Math.cos(ang) * 0.72, fl + 1.95 + Math.sin(ang) * 0.5, 26.55, 0.22, 0.16, 0.08, { all: 'plaster_trim' }, { mat: BTS.MAT.STONE }); }
        mb.billboard(87, fl + 4.0 + 2.2 + 0.05, 22.5, 'cross_wood', { scale: 2.0, mat: BTS.MAT.METAL });
        // semicircular apse on the north (east-facing altar) end with a half-cone roof
        var ar = 2.1, az = 18.5, seg = 8;
        for (var q = 0; q < seg; q++) {
          var a0 = Math.PI + q / seg * Math.PI, a1 = Math.PI + (q + 1) / seg * Math.PI;
          mb.wall(87 + Math.cos(a1) * ar, az + Math.sin(a1) * ar, 87 + Math.cos(a0) * ar, az + Math.sin(a0) * ar, fl - 0.4, fl + 3.1, 'wall_stone', { mat: BTS.MAT.STONE, u0: q * 0.8 });
          mb.tri([[87, fl + 4.3, az], [87 + Math.cos(a1) * (ar + 0.2), fl + 3.05, az + Math.sin(a1) * (ar + 0.2)], [87 + Math.cos(a0) * (ar + 0.2), fl + 3.05, az + Math.sin(a0) * (ar + 0.2)]], BTS.M.norm3([Math.cos((a0 + a1) / 2), 1.2, Math.sin((a0 + a1) / 2)]), [[0.5, 0], [0, 1], [1, 1]], 'roof_slab', null, BTS.MAT.STONE);
        }
        // donation box and table beside the door
        mb.box(85.2, fl - 0.1, 27.1, 0.5, 1.0, 0.4, { all: 'metal' }, { mat: BTS.MAT.METAL });
      })();
      L.table(89.3, 27.2, 1.0, 0.6, { top: 'metal', h: 0.85 });
      L.spot('church_door', 87, 27.8, 'up');
      L.billboard('bell', 91.5, 23.5, { y: 3.2, scale: 1.6, mat: BTS.MAT.METAL });     // small belfry frame beside
      L.propMB(91.5, 23.5).post(90.8, height(90.8, 23.5) - 0.1, 23.5, 4.2, 0.16, 'wood_dark', { mat: BTS.MAT.WOOD });
      L.propMB(91.5, 23.5).post(92.2, height(92.2, 23.5) - 0.1, 23.5, 4.2, 0.16, 'wood_dark', { mat: BTS.MAT.WOOD });
      L.propMB(91.5, 23.5).box(91.5, height(91.5, 23.5) + 4.0, 23.5, 1.8, 0.14, 0.3, { all: 'wood_dark' }, { mat: BTS.MAT.WOOD });
      L.circle(91.5, 23.5, 0.8, 'belfry');
      L.stoneWall([[77, 33.5], [80.5, 34], [83.5, 34]], { h: 0.8 }); L.stoneWall([[89, 34], [97, 33.5], [97.5, 15], [77.5, 14.5], [77, 33.5]], { h: 0.8 });
      // graves: old crosses; new ones appear as the story goes (see story onPopulate)
      var graves = [[80, 18], [82, 18.5], [84, 17.5], [79.5, 21.5], [81.5, 22], [94, 18], [95, 21], [93, 25], [94.5, 28], [80, 26], [82, 27.5], [80.5, 30]];
      graves.forEach(function (g, k) { L.billboard(k % 3 === 0 ? 'headstone' : 'cross_grave', g[0], g[1], { mat: BTS.MAT.STONE, collide: 0.25, scale: 1.1 }); });
      L.spot('grave_zajko', 92, 30.5); L.spot('grave_pecko', 90.5, 31.2); L.spot('grave_gvozdin', 89, 31.6); L.spot('grave_gorazd', 85.3, 31.2); L.spot('grave_jessica', 83.8, 31); L.spot('grave_tihomir', 95.2, 31);
      L.spot('churchyard', 86.5, 30.5, 'up');
      L.tree('tree_spruce', 79, 16); L.tree('tree_spruce2', 96, 32); L.tree('tree_spruce_young', 97.2, 20.5); L.tree('tree_spruce', 78.6, 23.6, { scale: 0.9 }); L.tree('tree_birch', 95.5, 16); L.tree('tree_dead', 78.5, 28.5);
      L.scatter(['grass_tall', 'flowers_wild', 'grass_tuft'], 78, 15, 97, 33, 60, { avoid: function (x, z) { return Math.abs(x - 87) < 3.5 && z > 18; } });
      L.lanternPost(84, 34.8, { radius: 5 });

      /* ---------- north side of main street ---------- */
      var milka = generic(20, 40, { id: 'h_milka', w: 5, d: 4, wall: 'wall_plaster', roof: 'roof_tile_brown', doorAt: -1, porch: true, mapLabel: 'area.milka' });
      L.spot('milka_door', milka.doorWorld[0], milka.doorWorld[1]); L.bench(23, 43.3, 1.8); L.spot('milka_bench', 23, 44, 'down');
      var zh = L.house({ id: 'h_zajko', x: 32, z: 38.5, w: 6.4, d: 5, h: 2.7, wall: 'wall_plaster_ochre', base: 'wall_stone', roof: 'roof_tile', door: { side: 's', at: -1.4 }, windows: [{ side: 's', at: 0.4 }, { side: 's', at: 2.1 }, { side: 'w', at: 0 }], windowTile: 'window_blue', chimney: [1.8, -0.5], porch: true, mapLabel: 'area.zajko' });
      L.spot('zajko_door', zh.doorWorld[0], zh.doorWorld[1] + 0.2); L.spot('zajko_gate', 30.6, 44.2, 'up'); L.spot('zajko_yard', 34, 43, 'down');
      L.fence([[27.6, 36], [27.6, 44.2], [29.8, 44.2]], { pickets: true, h: 1 }); L.fence([[31.4, 44.2], [38, 44.2], [38, 41.5]], { pickets: true, h: 1 });
      // smithy (open forge shed) and bread oven
      (function () {
        var x = 40.8, z = 39.5, y = height(x, z), mb = L.propMB(x, z);
        [[39.2, 38], [42.4, 38], [39.2, 41], [42.4, 41]].forEach(function (p) { mb.post(p[0], height(p[0], p[1]) - 0.2, p[1], y + 2.6 - height(p[0], p[1]), 0.2, 'wood_dark', { mat: BTS.MAT.WOOD }); });
        mb.gableRoof(x, z - 0.5, 3.6, 3.8, y + 2.5, 0.8, 'roof_shingle', { mat: BTS.MAT.WOOD, gableTile: 'wall_planks' });
        mb.box(x, y - 0.1, 37.8, 3.4, 2.4, 0.3, { all: 'wall_brick' }, { mat: BTS.MAT.STONE });
        mb.box(41.6, y - 0.05, 38.6, 1.2, 1.0, 1.0, { all: 'wall_stone_grey', top: 'stove_front' }, { mat: BTS.MAT.STONE });
        L.box(39.0, 37.6, 42.6, 38.1); L.box(41.0, 38.1, 42.2, 39.1);
        L.billboard('anvil', 40.2, 40.2, { mat: BTS.MAT.METAL, collide: 0.35 });
        L.light(41.6, y + 1.3, 39.4, [1, 0.45, 0.18], 4.5, 0.9, 'fire', 0.35);
        L.statics.push({ sprite: 'flame', x: 41.6, y: y + 0.95, z: 39.2, scale: 0.8, emissive: true, flicker: true, fire: true });
        L.emitter({ type: 'smoke', x: 41.6, y: y + 2.9, z: 38.4, rate: 1 });
        L.spot('smithy', 40.4, 41.4, 'up');
        // domed bread oven
        var bx = 26.2, bz = 41.5;
        L.cylinder(mb, bx, height(bx, bz) - 0.1, bz, 0.9, 0.9, 9, 'wall_plaster', BTS.MAT.STONE, { top: 'wall_plaster' });
        mb.decal(bx, height(bx, bz) + 0.1, bz + 0.92, 0.6, 0.5, 's', 'stove_front', BTS.MAT.STONE);
        L.circle(bx, bz, 1, 'oven'); L.spot('bakery', bx + 1.4, bz + 1.5, 'left');
      })();
      var kaf = L.house({ id: 'h_kafana', x: 45.5, z: 38.5, w: 7, d: 5.4, h: 3.0, wall: 'wall_timber', beams: true, base: 'wall_stone', roof: 'roof_tile_brown', door: { side: 's', at: 0 }, windows: [{ side: 's', at: -2.3 }, { side: 's', at: 2.3 }, { side: 'e', at: 0 }], windowTile: 'window_brown', chimney: true, porch: true, porchRoof: 'roof_tile', mapLabel: 'area.kafana' });
      L.spot('kafana_door', kaf.doorWorld[0], kaf.doorWorld[1] + 0.3);
      L.table(42.2, 43.7, 1.4, 0.9, { cloth: 'cloth_red' }); L.table(48.6, 43.7, 1.4, 0.9, { cloth: 'cloth_red' });
      L.bench(42.2, 42.7, 1.4); L.bench(48.6, 42.7, 1.4);
      L.spot('kafana_table', 42.2, 42.3, 'down'); L.spot('kafana_table2', 48.6, 42.3, 'down');
      L.lanternPost(50, 43.8);
      var gh = L.house({ id: 'h_guest', x: 64, z: 37, w: 7, d: 5.4, h: 4.3, wall: 'wall_plaster_rose', base: 'wall_stone_grey', roof: 'roof_tile', roofType: 'hip', door: { side: 's', at: -2 }, windows: [{ side: 's', at: 0 }, { side: 's', at: 2.2 }, { side: 's', at: -2.2, y: 2.6 }, { side: 's', at: 0, y: 2.6 }, { side: 's', at: 2.2, y: 2.6 }, { side: 'w', at: 0, y: 2.6 }], windowTile: 'window', chimney: [2, 1], mapLabel: 'area.guest' });
      L.spot('guest_door', gh.doorWorld[0], gh.doorWorld[1] + 0.3); L.bench(66.5, 41.2, 2); L.spot('guest_bench', 66.5, 41.8, 'down');
      L.billboard('easel', 69, 41, { mat: BTS.MAT.WOOD, collide: 0.3 });
      var tih = generic(76.5, 39.5, { id: 'h_tihomir', w: 5, d: 4, wall: 'wall_stone', roof: 'roof_slab', doorAt: 1, fence: false, mapLabel: 'area.tihomir' });
      L.spot('tihomir_door', tih.doorWorld[0], tih.doorWorld[1]); L.spot('tihomir_window', 74.7, 42.4, 'up'); L.spot('tihomir_hide', 71.6, 43.2, 'up');
      var ves = generic(94, 40, { id: 'h_vesna', w: 5.4, d: 4, wall: 'wall_plaster_blue', roof: 'roof_tile', doorAt: -1.2 });
      L.spot('vesna_yard', 97.5, 43.5, 'left');
      L.billboard('laundry', 97, 42.6, { mat: BTS.MAT.CLOTH, wind: 0.45, collide: 0.2, scale: 1.2 }); L.billboard('laundry', 99.4, 43, { mat: BTS.MAT.CLOTH, wind: 0.45, scale: 1.2, flip: true });
      generic(101, 38, { w: 4.4 }); generic(8, 40, { w: 4.6, lived: false, lit: false });
      // second row on the slope
      generic(26, 28.5); generic(41, 26.5, { w: 5 }); generic(68.5, 25); generic(76, 30, { w: 4.4 }); generic(101, 25, { w: 4.6 });

      /* ---------- the square ---------- */
      L.well(52, 47.2);
      L.spot('well', 52, 49.6, 'up'); L.spot('square', 54.5, 48.5, 'down'); L.spot('square_w', 47.5, 49, 'right'); L.spot('square_e', 57.5, 49, 'left');
      L.tree('tree_walnut', 58.8, 43.5); L.bench(46, 50.8, 2);
      L.lanternPost(56.6, 50.5); L.lanternPost(36, 49.4); L.lanternPost(70.5, 49.2); L.lanternPost(22, 49.3); L.lanternPost(86, 49.8);
      L.billboard('cart', 60.8, 50.7, { mat: BTS.MAT.WOOD, collide: 1.0 });
      L.crate(43.8, 50.5, 0.6, 2); L.billboard('sack', 44.8, 50.9, { mat: BTS.MAT.CLOTH, collide: 0.2 });
      ['tree_poplar', 'tree_poplar', 'tree_poplar', 'tree_poplar'].forEach(function (tr, k) { L.tree(tr, 4 + k * 6, 50.5 + (k % 2) * 0.8); });

      /* ---------- between main street and south lane ---------- */
      var rad = generic(16.5, 57, { id: 'h_radoje', w: 5, wall: 'wall_stone', roof: 'roof_shingle', doorAt: 1.2 });
      L.fence([[5, 52], [12, 52], [12, 61], [5, 61], [5, 52]], { h: 1, rails: 2 });
      L.spot('radoje_pen', 13, 60.5, 'left');
      generic(27, 57, { w: 4.6 }); generic(39, 56.5); generic(60.5, 57.5, { w: 5 }); generic(71.5, 56.5); generic(80.5, 57.5, { w: 4.4 });
      var gz = L.house({ id: 'h_gorazd', x: 91.5, z: 56.5, w: 6, d: 4.6, h: 2.6, wall: 'wall_planks_brown', base: 'wall_stone', baseH: 0.6, roof: 'roof_shingle', door: { side: 's', at: 1.2, tile: 'door_grey' }, windows: [{ side: 's', at: -1.3, tile: 'window_plain' }, { side: 'e', at: 0 }], chimney: [-2, 0], shed: 'w', mapLabel: 'area.gorazd' });
      L.spot('gorazd_door', gz.doorWorld[0], gz.doorWorld[1] + 0.2); L.spot('gorazd_yard', 95.5, 61.2, 'left');
      L.woodpile(97.8, 57, 2.4); L.billboard('axe_stump', 95.8, 60.2, { mat: BTS.MAT.WOOD, collide: 0.35 }); L.woodpile(86, 60.6, 1.6);
      L.fence([[84.5, 53], [84.5, 62.5], [91, 62.5]], { h: 1.1 }); L.fence([[93.6, 62.5], [100, 62.5], [100, 53]], { h: 1.1 });
      L.billboard('dog_lie', 99, 61.5, { mat: BTS.MAT.DEFAULT });
      generic(101.5, 69, { w: 4.2 });
      // south of the lane
      generic(18, 70.5); generic(30, 71, { w: 5.4 }); generic(42, 70); generic(60, 72, { w: 4.4 });
      generic(10, 74, { w: 4.4, lived: false, lit: false });

      /* ---------- the fair meadow (ref photo 5) ---------- */
      (function () {
        var px = 84, pz = 76.5, y0 = height(px, pz), mb = L.propMB(px, pz);
        var PH = 10.5;
        mb.post(px, y0 - 0.3, pz, PH + 0.3, 0.28, 'bark', { mat: BTS.MAT.WOOD });
        // dense garland wrapping the pole, thickening toward the crown (ref photo 5)
        for (var k = 0; k < 70; k++) { var a = k * 0.75, tt0 = k / 70, yy = y0 + 0.2 + tt0 * PH, rr = 0.18 + tt0 * 0.12; mb.billboard(px + Math.cos(a) * rr, yy, pz + Math.sin(a) * rr + 0.12, 'garland', { scale: 1.5 + tt0 * 1.2, wind: 0.05 + tt0 * 0.1 }); }
        // leafy crown at the top
        for (k = 0; k < 14; k++) { var ca = k * 2.4; mb.billboard(px + Math.cos(ca) * 0.35, y0 + PH - 0.3 + (k % 4) * 0.22, pz + 0.15 + Math.sin(ca) * 0.2, 'garland', { scale: 2.6, wind: 0.25 }); }
        // two short arms near the top with big hanging flower wreaths
        var cy = y0 + PH * 0.78;
        for (var k2 = -5; k2 <= 5; k2++) if (k2 !== 0) mb.billboard(px + k2 * 0.3, cy, pz + 0.15, 'garland', { scale: 1.8, wind: 0.1 });
        mb.billboard(px - 1.55, cy - 2.75, pz + 0.22, 'wreath', { scale: 2.3, wind: 0.5 }); mb.billboard(px + 1.55, cy - 2.75, pz + 0.22, 'wreath', { scale: 2.3, wind: 0.5 });
        ['ribbon_red', 'ribbon_white', 'ribbon_blue', 'ribbon_red', 'ribbon_white', 'ribbon_blue'].forEach(function (rb, i2) { mb.billboard(px - 0.5 + i2 * 0.2, y0 + PH - 1.6, pz + 0.24, rb, { scale: 1.9, wind: 1.2 }); });
        L.circle(px, pz, 0.45, 'pole');
        L.spot('fair_pole', px, pz + 2.2, 'up');
        // ring of stones for "Hvatanje senke" around the bonfire
        var fx = 90.5, fz = 82;
        L.bonfire(fx, fz);
        for (k = 0; k < 16; k++) { var aa = k / 16 * 6.283; L.billboard('rock', fx + Math.cos(aa) * 4.2, fz + Math.sin(aa) * 3.2, { scale: 0.7, mat: BTS.MAT.STONE }); }
        L.spot('game_ring', fx - 2.2, fz - 1.5, 'right'); L.spot('game_watch', fx - 6.5, fz - 2.5, 'right'); L.spot('fair_bonfire', fx, fz - 2.5, 'down');
        // stalls with cloth awnings
        [[73, 72, 'cloth_white', 'licitar'], [79, 70.2, 'cloth_white', 'bread'], [91.5, 70.5, 'cloth_red', 'stall_goods'], [98, 74, 'cloth_white', 'licitar']].forEach(function (s, i3) {
          var sx = s[0], sz = s[1], sy = height(sx, sz), m2 = L.propMB(sx, sz);
          var top = L.table(sx, sz, 2.6, 1.1, { cloth: s[2] });
          m2.billboard(sx, top, sz, s[3], { scale: 1.6, mat: BTS.MAT.DEFAULT });
          [[-1.3, -0.6], [1.3, -0.6], [-1.3, 0.7], [1.3, 0.7]].forEach(function (o) { m2.post(sx + o[0], sy, sz + o[1], 2.3, 0.1, 'wood_beam', { mat: BTS.MAT.WOOD }); });
          m2.quad([[sx - 1.6, sy + 2.0, sz + 1.1], [sx + 1.6, sy + 2.0, sz + 1.1], [sx + 1.6, sy + 2.45, sz - 0.8], [sx - 1.6, sy + 2.45, sz - 0.8]], BTS.M.norm3([0, 1, 0.4]), [[0, 1], [3.2, 1], [3.2, 0], [0, 0]], s[2], [1, 1, 1, 0], BTS.MAT.CLOTH, [[1, 1, 1, 0.3], [1, 1, 1, 0.3], [1, 1, 1, 0], [1, 1, 1, 0]]);
          L.spot('stall' + i3, sx, sz + 1.3, 'up');
          L.spot('stall' + i3 + '_keeper', sx, sz - 1.1, 'down');
        });
        // lantern strings between posts
        [[70, 70], [76, 68], [83, 69], [96, 68.8], [101, 72], [100, 80], [78, 84]].forEach(function (p, i4) {
          L.propMB(p[0], p[1]).post(p[0], height(p[0], p[1]) - 0.1, p[1], 3.0, 0.12, 'wood_dark', { mat: BTS.MAT.WOOD });
          L.circle(p[0], p[1], 0.2);
          var ly = height(p[0], p[1]) + 2.6;
          L.statics.push({ sprite: 'lantern_paper', x: p[0], y: ly, z: p[1] + 0.12, scale: 1.3, emissive: true, night: true });
          L.light(p[0], ly + 0.2, p[1] + 0.5, [1, 0.6, 0.35], 5.5, 0.8, 'lamp', 0.06);
        });
        // garlands with little flags and flowers from the maypole out to the posts, and between the posts
        var POSTS = [[70, 70], [76, 68], [83, 69], [96, 68.8], [101, 72], [100, 80], [78, 84]];
        var top = [px, y0 + 8.1, pz + 0.05];
        var FL = [['bunt_red', 'bunt_blue', 'bunt_white'], ['bunt_yellow', 'bunt_red', 'bunt_green', 'bunt_white'], ['bunt_white', 'bunt_red', 'bunt_blue', 'bunt_yellow']];
        POSTS.forEach(function (p, i5) { L.bunting(top, [p[0], height(p[0], p[1]) + 2.85, p[1]], { flags: FL[i5 % 3], sag: 1.1 }); });
        for (var i6 = 0; i6 < POSTS.length - 2; i6++) { var a5 = POSTS[i6], b5 = POSTS[i6 + 1]; L.bunting([a5[0], height(a5[0], a5[1]) + 2.8, a5[1]], [b5[0], height(b5[0], b5[1]) + 2.8, b5[1]], { flags: FL[(i6 + 1) % 3], sag: 0.6 }); }
        // stall awnings get short garlands too
        [[73, 72], [79, 70.2], [91.5, 70.5], [98, 74]].forEach(function (st) { var sy = height(st[0], st[1]); L.bunting([st[0] - 1.3, sy + 2.3, st[1] + 0.75], [st[0] + 1.3, sy + 2.3, st[1] + 0.75], { flags: FL[0], sag: 0.25, flagEvery: 0.4, flowerEvery: 0.7 }); });
        // the Serbian flag on a pole at the fair entrance
        (function () {
          var fx2 = 68.4, fz2 = 69.9, fy = height(fx2, fz2), m3 = L.propMB(fx2, fz2), q = 0.9999, fw = 2.25, fh = 1.5, ft = fy + 6.0;
          m3.post(fx2, fy - 0.1, fz2, 6.3, 0.1, 'wood_beam', { mat: BTS.MAT.WOOD });
          m3.box(fx2, fy + 6.2, fz2, 0.18, 0.12, 0.18, { all: 'metal' }, { mat: BTS.MAT.METAL });
          var c0 = [1, 1, 1, 0.02], c1 = [1, 1, 1, 0.55];
          m3.quad([[fx2 + 0.06, ft - fh, fz2 + 0.06], [fx2 + 0.06 + fw, ft - fh - 0.05, fz2 + 0.1], [fx2 + 0.06 + fw, ft - 0.05, fz2 + 0.1], [fx2 + 0.06, ft, fz2 + 0.06]], [0, 0.3, 1], [[0, q], [q, q], [q, 0], [0, 0]], 'flag_serbia', null, BTS.MAT.CLOTH, [c0, c1, c1, c0]);
          L.circle(fx2, fz2, 0.15, 'pole');
        })();
        L.brazier(70.6, 67.6); L.brazier(74.4, 67.2);     // entrance torches (ref photo 2)
        L.bench(76, 80, 2.4); L.bench(96, 84.5, 2.4); L.bench(80.5, 85.5, 2.4, false);
        L.billboard('cart', 102, 79, { mat: BTS.MAT.WOOD, collide: 1 });
        for (k = 0; k < 4; k++) L.propMB(68 + k * 1.3, 84).box(68 + k * 1.3, height(68, 84) - 0.1, 84 + (k % 2) * 0.3, 1.1, 0.9, 0.8, { all: 'hay' }, { mat: BTS.MAT.DEFAULT });
        L.box(67.3, 83.4, 72.6, 84.8, 'hay');
        L.spot('fair_entry', 72.5, 68.8, 'down'); L.spot('fair_edge', 102.8, 85.5, 'left'); L.spot('fair_center', 84.5, 79.5, 'down');
        L.spot('fair_dance', 84, 78.6);
        L.emitter({ type: 'petals', x: 84, y: height(84, 76) + 1, z: 76, rate: 1.5, area: [10, 8], fx: true });
        L.emitter({ type: 'fireflies', x: 86, y: 0.6, z: 80, rate: 2, area: [26, 14], night: true, fx: true });
      })();

      /* ---------- Jaglika's house: isolated at the forest edge ---------- */
      var jg = L.house({ id: 'h_jaglika', x: 11, z: 22.5, w: 5.4, d: 4.4, h: 2.5, wall: 'wall_stone_dark', base: 'wall_stone_dark', baseH: 0.4, roof: 'roof_shingle', rise: 2.6, door: { side: 's', at: 0.9, tile: 'door_dark' }, windows: [{ side: 's', at: -1.4, w: 0.7, h: 0.7, tile: 'window_plain' }, { side: 'e', at: 0.5, w: 0.6, h: 0.6, tile: 'window_plain' }], chimney: [-1.8, -0.8], tint: [0.85, 0.85, 0.9, 0], mapLabel: 'area.jaglika' });
      L.spot('jaglika_door', jg.doorWorld[0], jg.doorWorld[1] + 0.2);
      // back door to the woods (the interior's 'back' exit lands here)
      L.propMB(10, 20).decal(10.0, jg.floor, 22.5 - 2.2, 0.9, 1.8, 'n', 'door_dark', BTS.MAT.WOOD);
      L.propMB(10, 20).box(10.0, height(10, 19.7) - 0.15, 19.95, 1.1, jg.floor - height(10, 19.7) + 0.13, 0.6, { all: 'stone_block' }, { mat: BTS.MAT.STONE });
      L.spot('jaglika_back', 10.0, 19.0, 'up');
      L.tree('tree_spruce2', 6.8, 19.2); L.tree('tree_spruce', 15.4, 16.2, { scale: 1.1 }); L.tree('tree_spruce_young', 8.4, 16.6); L.spot('jaglika_gate', 12.5, 29.5, 'up'); L.spot('jaglika_watch', 19.5, 31.5, 'left');
      L.fence([[6, 26.5], [6, 29], [11.6, 29]], { h: 1.2, rails: 3 }); L.fence([[13.4, 29], [17, 29], [17, 19]], { h: 1.2, rails: 3 });
      L.billboard('herbs_hang', 9.4, 25.2, { y: 1.3, mat: BTS.MAT.CLOTH, wind: 0.3 });
      L.billboard('tree_dead', 16.5, 18, { scale: 1.2 }); L.circle(16.5, 18, 0.4);
      L.billboard('scarecrow', 4.5, 22, { collide: 0.3 });
      L.billboard('pot_clay', 13.5, 25.6, { mat: BTS.MAT.STONE }); L.billboard('jug', 14.1, 25.5, { mat: BTS.MAT.STONE });


      /* ---------- Balkan farmstead details: haystacks on poles (stog), corn cribs (koš), wattle fences (pleter) ---------- */
      function stog(x, z) { var mb = L.propMB(x, z), y = height(x, z); L.cylinder(mb, x, y - 0.1, z, 1.0, 1.1, 9, 'hay', BTS.MAT.DEFAULT); for (var k = 0; k < 4; k++) L.cylinder(mb, x, y + 1.0 + k * 0.42, z, 0.92 - k * 0.24, 0.42, 9, 'hay', BTS.MAT.DEFAULT, { top: 'hay' }); mb.post(x, y + 2.4, z, 1.0, 0.08, 'wood_dark', { mat: BTS.MAT.WOOD }); L.circle(x, z, 1.05); }
      function kos(x, z) { var mb = L.propMB(x, z), y = height(x, z); [[-0.8, -0.5], [0.8, -0.5], [-0.8, 0.5], [0.8, 0.5]].forEach(function (o) { mb.post(x + o[0], y - 0.1, z + o[1], 0.7, 0.14, 'stone_block', { mat: BTS.MAT.STONE }); }); mb.box(x, y + 0.6, z, 2.0, 1.6, 1.2, { all: 'wall_planks' }, { mat: BTS.MAT.WOOD }); mb.gableRoof(x, z, 2.0, 1.2, y + 2.2, 0.6, 'roof_shingle', { mat: BTS.MAT.WOOD, overhang: 0.15, gableTile: 'wall_planks' }); L.box(x - 1, z - 0.6, x + 1, z + 0.6); }
      stog(4.5, 64); stog(8, 67); stog(23, 80.5); stog(36, 79.5); kos(22, 61.5); kos(66, 61); kos(46, 61); kos(104, 33);
      L.fence([[13, 66.5], [24.5, 66.5]], { pickets: true, tile: 'wood_dark', h: 0.8, rails: 1 }); L.fence([[34, 66.5], [46, 66.5]], { pickets: true, tile: 'wood_dark', h: 0.8, rails: 1 });
      // lamb on a spit at the fair
      (function () { var x = 100.5, z = 78, y = height(x, z), mb = L.propMB(x, z); mb.post(x - 0.9, y, z, 1.0, 0.08, 'wood_dark', { mat: BTS.MAT.WOOD }); mb.post(x + 0.9, y, z, 1.0, 0.08, 'wood_dark', { mat: BTS.MAT.WOOD }); mb.box(x, y + 0.85, z, 1.9, 0.05, 0.05, { all: 'metal' }, { mat: BTS.MAT.METAL }); mb.box(x, y + 0.65, z, 1.0, 0.4, 0.4, { all: 'wood_light' }, { mat: BTS.MAT.DEFAULT }); L.billboard('bonfire', x, z + 0.1, { mat: BTS.MAT.WOOD }); L.light(x, y + 0.6, z + 0.4, [1, 0.5, 0.2], 4, 0.9, 'fire', 0.3); L.statics.push({ sprite: 'flame', x: x, y: y + 0.1, z: z + 0.15, scale: 1.2, emissive: true, flicker: true, fire: true }); L.emitter({ type: 'smoke', x: x, y: y + 1.2, z: z, rate: 1.5 }); L.box(x - 1, z - 0.4, x + 1, z + 0.4); })();
      /* ---------- forest belts & boundaries ---------- */
      var tr = BTS.RNG(5);
      function belt(x0, z0, x1, z1, n, kinds) { for (var q = 0; q < n; q++) { var x = x0 + tr() * (x1 - x0), z = z0 + tr() * (z1 - z0); if (roadAt(x, z) || creekD(x, z) < 2.4 || BTS.Physics.pointBlocked(x, z, 1.0, L.colliders)) continue; L.tree(tr.pick(kinds), x, z, { scale: 1 + tr() * 0.3 }); } }
      belt(0, 0, 112, 6, 38, ['tree_spruce', 'tree_oak', 'tree_pine', 'tree_spruce2', 'tree_birch']);
      belt(0, 6, 7, 86, 50, ['tree_spruce', 'tree_oak', 'tree_dead', 'tree_pine', 'tree_spruce2']);
      belt(104, 6, 112, 90, 38, ['tree_oak', 'tree_spruce', 'tree_poplar', 'tree_spruce2']);
      belt(0, 93, 60, 99, 8, ['tree_oak', 'tree_birch']);
      belt(7, 6, 30, 18, 16, ['tree_spruce', 'tree_oak2', 'tree_spruce2']);
      belt(66, 6, 104, 14, 16, ['tree_oak', 'tree_spruce', 'tree_spruce2']);
      // trees inside the village: yards, the square, the lanes, along the creek
      (function () {
        var spotsXZ = Object.keys(L.spots).map(function (k) { return L.spots[k]; });
        function plant(kind, x, z, sc) {
          if (roadAt(x, z) || creekD(x, z) < 2.4 || BTS.Physics.pointBlocked(x, z, 1.1, L.colliders)) return;
          for (var k = 0; k < spotsXZ.length; k++) if (Math.hypot(spotsXZ[k].x - x, spotsXZ[k].z - z) < 1.8) return;
          L.tree(kind, x, z, { scale: sc || 1 });
        }
        [[24.5, 33.5, 'tree_spruce2'], [33.6, 31.8, 'tree_walnut'], [47.6, 25.2, 'tree_spruce_young'], [72.8, 31.2, 'tree_spruce'], [74.2, 21.4, 'tree_spruce2'],
         [12.5, 43.2, 'tree_birch'], [17.5, 51.4, 'tree_plum'], [35.2, 52.8, 'tree_oak2'], [44.2, 54.0, 'tree_spruce2'], [57.8, 53.4, 'tree_birch'], [66.4, 52.6, 'tree_walnut'],
         [77.6, 52.2, 'tree_spruce_young'], [86.6, 52.4, 'tree_plum'], [99.6, 50.8, 'tree_spruce2'], [24.4, 76.4, 'tree_oak2'], [35.5, 75.2, 'tree_spruce_young'], [47.2, 79.6, 'tree_spruce2'],
         [58.6, 80.6, 'tree_oak'], [63.6, 76.8, 'tree_spruce'], [14.2, 80.2, 'tree_birch'], [9.5, 45.0, 'tree_spruce2'], [102.6, 46.2, 'tree_walnut'], [64.8, 14.6, 'tree_spruce2'], [36.0, 17.2, 'tree_spruce'],
         [29.6, 22.4, 'tree_spruce_young'], [21.6, 20.2, 'tree_spruce2'], [92.4, 46.0, 'tree_plum'], [73.8, 62.4, 'tree_birch'], [31.8, 60.4, 'tree_spruce_young']].forEach(function (t) { plant(t[2], t[0], t[1]); });
      })();
      belt(36, 74, 50, 86, 6, ['tree_oak2', 'tree_walnut']);
      // hard edges so the player never walks into the void
      L.box(-2, 0, 3.2, 92); L.box(106.8, 0, 114, 92); L.box(0, -2, 112, 4.5); L.box(0, 88.6, 112, 94);
      for (var cx2 = 3; cx2 < 107; cx2++) for (var cz2 = 80; cz2 < 89; cz2++) if (creekD(cx2 + 0.5, cz2 + 0.5) < 1.15 && Math.abs(cx2 + 0.5 - 53) > 1.4) L.box(cx2, cz2, cx2 + 1, cz2 + 1, 'creek');
      // vegetation scatter (avoid roads)
      L.scatter(['grass_tuft', 'grass_tuft2', 'grass_tall', 'flowers_wild', 'fern'], 4, 6, 106, 88, 900, { avoid: function (x, z) { return !!roadAt(x, z) || Math.hypot(x - 52, z - 47) < 5.5 || BTS.Physics.pointBlocked(x, z, 0.4, L.colliders); } });
      L.scatter(['reeds'], 4, 80, 72, 89, 140, { wind: 0.8, avoid: function (x, z) { var d = creekD(x, z); return d < 1.2 || d > 2.4 || Math.abs(x - 53) < 2; } });
      L.scatter(['bush', 'bush_dark', 'hedge'], 7, 8, 104, 86, 40, { wind: 0.2, avoid: function (x, z) { return !!roadAt(x, z) || BTS.Physics.pointBlocked(x, z, 1.2, L.colliders) || (x > 66 && z > 66); } });
      // wooden bridge over the creek on the south road: humped plank deck on piles, hand rails on both sides
      (function () {
        var bx = 53, z0 = 84.0, z1 = 88.55, mb = L.propMB(53, 86), ya = height(bx, z0), yb = height(bx, z1);
        function deckY(z) { var t = M.clamp((z - z0) / (z1 - z0), 0, 1); return ya + (yb - ya) * t + 0.5 * Math.sin(Math.PI * t) + 0.06; }
        for (var z = z0; z < z1 - 0.01; z += 0.3) { var y = deckY(z + 0.15); mb.box(bx + (M.hash(z, 3) - 0.5) * 0.08, y - 0.09, z + 0.15, 2.3, 0.09, 0.28, { all: 'wood_light' }, { mat: BTS.MAT.WOOD, units: 1.5 }); }
        [-0.75, 0.75].forEach(function (o) { for (var z = z0; z < z1 - 0.3; z += 0.5) L.beam(mb, bx + o, deckY(z) - 0.16, z, bx + o, deckY(z + 0.5) - 0.16, z + 0.5, 0.16, 'wood_dark'); });
        [[85.3], [87.3]].forEach(function (pz2) { [-1.05, 1.05].forEach(function (o) { mb.post(bx + o, -1.8, pz2[0], deckY(pz2[0]) + 1.75, 0.18, 'bark', { mat: BTS.MAT.WOOD }); }); });
        [-1.12, 1.12].forEach(function (o) {
          for (var z = z0 + 0.1; z <= z1; z += 0.75) mb.post(bx + o, deckY(z) - 0.05, z, 0.95, 0.1, 'wood_beam', { mat: BTS.MAT.WOOD });
          for (var zz = z0 + 0.1; zz < z1 - 0.2; zz += 0.75) { var ze = Math.min(z1, zz + 0.75); L.beam(mb, bx + o, deckY(zz) + 0.92, zz, bx + o, deckY(ze) + 0.92, ze, 0.09, 'wood_beam'); L.beam(mb, bx + o, deckY(zz) + 0.45, zz, bx + o, deckY(ze) + 0.45, ze, 0.06, 'wood_dark'); }
        });
        L.pad(bx - 1.15, z0, bx + 1.15, z1, function (x, z) { return deckY(z); });
        L.box(bx - 1.3, z0 + 0.15, bx - 1.06, z1 + 0.1, 'bridge'); L.box(bx + 1.06, z0 + 0.15, bx + 1.3, z1 + 0.1, 'bridge');
        // signpost beyond the bridge where the road leaves the village
        var sy2 = height(55.4, 90.2); mb.post(55.4, sy2 - 0.1, 90.2, 2.3, 0.12, 'wood_dark', { mat: BTS.MAT.WOOD });
        mb.box(55.9, sy2 + 1.8, 90.22, 1.1, 0.24, 0.05, { all: 'wood_light' }, { mat: BTS.MAT.WOOD }); mb.box(54.95, sy2 + 1.45, 90.22, 1.0, 0.22, 0.05, { all: 'wood_light' }, { mat: BTS.MAT.WOOD });
      })();
      // wooden gate where the west path leaves the village for the forest (exit 'west')
      (function () {
        var gx = 5.6, mb = L.propMB(gx, 31), y1 = height(gx, 29.7), y2 = height(gx, 32.3), top = Math.max(y1, y2) + 2.5;
        mb.post(gx, y1 - 0.15, 29.7, top - y1 + 0.15, 0.2, 'wood_dark', { mat: BTS.MAT.WOOD }); mb.post(gx, y2 - 0.15, 32.3, top - y2 + 0.15, 0.2, 'wood_dark', { mat: BTS.MAT.WOOD });
        mb.box(gx, top - 0.05, 31, 0.24, 0.18, 3.2, { all: 'wood_beam' }, { mat: BTS.MAT.WOOD });
        mb.gableRoof(gx, 31, 0.9, 3.4, top + 0.12, 0.45, 'roof_shingle', { mat: BTS.MAT.WOOD, axis: 'z', overhang: 0.12, gableTile: 'wood_dark' });
        mb.billboard(gx + 0.05, top - 0.75, 31.0, 'cross_wood', { scale: 1.2, mat: BTS.MAT.WOOD });
        L.circle(gx, 29.7, 0.2, 'gate'); L.circle(gx, 32.3, 0.2, 'gate');
        L.fence([[gx, 32.5], [gx - 0.3, 35.5]], { h: 1.0, rails: 2 }); L.fence([[gx, 29.5], [gx - 0.2, 27.2]], { h: 1.0, rails: 2 });
      })();

      /* ---------- spots for people & story ---------- */
      L.spot('menu_cam', 60, 44); L.spot('menu_npc0', 50, 50); L.spot('menu_npc1', 56, 52);
      L.spot('street_w', 16, 47.5, 'right'); L.spot('street_mid', 40, 47.5); L.spot('street_e', 82, 48, 'left');
      L.spot('lane_s', 49.5, 58, 'up'); L.spot('south_road', 53, 80, 'up'); L.spot('west_path', 11.5, 36, 'down');
      L.spot('from_outskirts_w', 7.6, 31.1, 'right'); L.spot('from_outskirts_s', 53, 82.8, 'up');
      L.spot('default', 54, 49, 'down');

      /* ---------- map areas ---------- */
      L.area('hill', 38, 4, 68, 22); L.area('church', 76, 12, 100, 36); L.area('center', 38, 34, 64, 54); L.area('west', 4, 34, 38, 66);
      L.area('east', 64, 34, 106, 66); L.area('south', 4, 66, 64, 89); L.area('fair', 64, 66, 106, 89); L.area('jaglika', 4, 12, 24, 34);
      L.area('slope', 22, 18, 76, 34);
      // far skirt: woods and hills beyond the playable map, fading into fog
      belt(-24, -20, 136, 0, 60, ['tree_spruce', 'tree_oak', 'tree_pine', 'tree_spruce2']); belt(-24, 0, 0, 112, 50, ['tree_spruce', 'tree_oak', 'tree_spruce2']); belt(112, 0, 136, 112, 50, ['tree_oak', 'tree_spruce', 'tree_poplar']); belt(-24, 100, 136, 112, 24, ['tree_oak', 'tree_birch']);
      L.ground(-24, -20, 136, 112);
    },
    exits: [
      { id: 'djordje', at: 'djordje_door', to: 'djordje_house', spawn: 'door', label: 'loc.djordje_house' },
      { id: 'zajko', at: 'zajko_door', to: 'zajko_house', spawn: 'door', label: 'loc.zajko_house', cond: 'flag:zajko_house_open', lockedDlg: 'locked_zajko' },
      { id: 'kafana', at: 'kafana_door', to: 'kafana', spawn: 'door', label: 'loc.kafana', cond: '!flag:kafana_closed', lockedDlg: 'locked_kafana' },
      { id: 'guest', at: 'guest_door', to: 'guesthouse', spawn: 'door', label: 'loc.guesthouse', cond: 'flag:guest_open', lockedDlg: 'locked_guest' },
      { id: 'church', at: 'church_door', to: 'church', spawn: 'door', label: 'loc.church', cond: 'flag:church_open', lockedDlg: 'locked_church' },
      { id: 'gorazd', at: 'gorazd_door', to: 'gorazd_house', spawn: 'door', label: 'loc.gorazd_house', cond: 'flag:gorazd_open', lockedDlg: 'locked_gorazd' },
      { id: 'tihomir', at: 'tihomir_door', to: 'tihomir_house', spawn: 'door', label: 'loc.tihomir_house', cond: 'flag:tihomir_open', lockedDlg: 'locked_tihomir' },
      { id: 'jaglika', at: 'jaglika_door', to: 'jaglika_house', spawn: 'door', label: 'loc.jaglika_house', cond: 'flag:jaglika_open', lockedDlg: 'locked_jaglika' },
      { id: 'west', at: [4.2, 31], to: 'outskirts', spawn: 'from_village_w', label: 'loc.outskirts', verb: 'verb.go', door: false, cond: 'flag:outskirts_open', lockedDlg: 'locked_outskirts' },
      { id: 'south', at: [53, 88.2], to: 'outskirts', spawn: 'from_village_s', label: 'loc.outskirts', verb: 'verb.go', door: false, cond: 'flag:outskirts_open', lockedDlg: 'locked_outskirts' }
    ],
    examine: [
      { id: 'x_well', at: [52, 49.4], label: 'it.well', dlg: 'x_well' },
      { id: 'x_pole', at: [84, 77.6], label: 'it.pole', dlg: 'x_pole', when: '..c1_start' },
      { id: 'x_pole_late', at: [84, 77.6], label: 'it.pole', dlg: 'x_pole_late', when: 'c1_start..' },
      { id: 'x_view', at: [57, 19], label: 'it.view', dlg: 'x_view' },
      { id: 'x_beehive', at: [47, 13.4], label: 'it.beehives', dlg: 'x_beehive' },
      { id: 'x_church_plaque', at: [87, 27.6], label: 'it.plaque', dlg: 'x_plaque', r: 1.4, hy: 2.4 },
      { id: 'x_graves', at: [81, 20], label: 'it.old_graves', dlg: 'x_graves' },
      { id: 'x_anvil', at: [40.2, 40.9], label: 'it.anvil', dlg: 'x_anvil' },
      { id: 'x_oven', at: [26.2, 43], label: 'it.oven', dlg: 'x_oven' },
      { id: 'x_cart', at: [60.8, 51.6], label: 'it.cart', dlg: 'x_cart' },
      { id: 'x_scarecrow', at: [4.5, 23], label: 'it.scarecrow', dlg: 'x_scarecrow' },
      { id: 'x_jag_herbs', at: [9.4, 26.2], label: 'it.herbs', dlg: 'x_jag_herbs' },
      { id: 'x_sheep', at: [11.5, 56], label: 'it.sheep', dlg: 'x_sheep' },
      { id: 'x_easel', at: [69, 41.8], label: 'it.easel', dlg: 'x_easel', when: 'c4_start..c4_jessica_dead' },
      { id: 'x_axe', at: [95.8, 61], label: 'it.axe', dlg: 'x_axe' },
      { id: 'x_bridge', at: [53, 86.2], label: 'it.bridge', dlg: 'x_bridge', when: '..c2_bell' },
      { id: 'x_bell', at: [91.5, 24.6], label: 'it.bell', dlg: 'x_bell' }
    ],
    animals: [
      { sprite: 'chicken', at: [29, 42], range: 2.5, flee: true }, { sprite: 'chicken2', at: [33.5, 42.5], range: 2, flee: true }, { sprite: 'chicken', at: [24, 58.5], range: 2, flee: true },
      { sprite: 'sheep', at: [8, 55], range: 2.5 }, { sprite: 'sheep', at: [9.5, 58.5], range: 2.5 }, { sprite: 'sheep', at: [7, 59], range: 2 },
      { sprite: 'cat', at: [47, 44.6], range: 1.5, flee: true, cond: 'before:c9_silence' }, { sprite: 'dog', at: [97.5, 60.5], range: 1.5, cond: 'before:c4_gorazd_dead' },
      { sprite: 'crow', at: [80.5, 25], range: 3, flee: true }, { sprite: 'crow', at: [14, 20], range: 2, flee: true }, { sprite: 'chicken2', at: [62, 60], range: 2, flee: true }
    ]
  };
  BTS.Village = { roadAt: roadAt, height: height };
})();
