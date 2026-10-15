/* Pakleštica — the village map. North (small z) is the hill with Đorđe's house; the church sits
   on a rise to the north-east; the main street runs west–east; the fair meadow lies south-east;
   Jaglika's house stands alone at the western forest edge. */
'use strict';
(function () {
  var M = BTS.M;
  var ROADS = [
    { pts: [[0, 47], [20, 46], [40, 46.5], [64, 46], [84, 47], [110, 46]], w: 3.4, t: 'auto' },          // main street
    { pts: [[6, 64], [30, 64.5], [52, 64], [70, 64.5], [90, 64]], w: 2.4, t: 'dirt' },                      // south lane
    { pts: [[55, 46], [53, 38], [58, 30], [52, 22], [55, 16]], w: 2.0, t: 'dirt' },                         // hill path
    { pts: [[80, 46.5], [83, 36], [86, 29]], w: 2.2, t: 'gravel' },                                         // church path
    { pts: [[62, 64.5], [72, 69], [80, 72]], w: 2.4, t: 'dirt' },                                           // to the fair
    { pts: [[50, 46.5], [49, 56], [52, 64], [53, 76], [53, 90]], w: 2.6, t: 'dirt' },                       // south road
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
    var dh = Math.hypot(x - 55, (z - 12) * 1.1);
    h += 4.6 * M.smooth(24, 7, dh);                       // Đorđe's hill
    h += 2.6 * M.smooth(24, 3, z);                         // northern ridge
    h += 1.3 * M.smooth(13, 4, Math.hypot(x - 87, z - 24)); // church rise
    h += 1.6 * M.smooth(10, 0, x) * M.smooth(50, 20, z);   // western forest slope
    h += (M.fbm(x * 0.07, z * 0.07, 3) - 0.5) * 0.7;
    var meadow = M.smooth(10, 3, Math.max(Math.abs(x - 85) - 14, Math.abs(z - 77) - 8, 0));
    h = M.lerp(h, 0.05, meadow * 0.85);
    h -= 1.2 * M.smooth(84, 92, z) * M.smooth(30, 0, Math.abs(x - 30));   // dip to the creek
    return h;
  }
  var tileCache = null;
  function computeTile(x, z) {
    var r = roadAt(x, z);
    if (Math.hypot(x - 52, z - 47) < 5.2) return 'cobble';
    if (r) return r;
    if (x > 66 && x < 104 && z > 67 && z < 97) return ((x * 7 + z * 3) | 0) % 11 === 0 ? 'grass_dry' : 'grass_meadow';
    if (x > 77 && x < 97 && z > 14 && z < 34) return 'grass_dark';                  // churchyard
    if (x < 34 && z > 77 && z < 88) return ((z | 0) % 9 < 7) ? 'field' : 'grass';     // fields
    if (Math.hypot(x - 22, z - 86) < 5 || (z > 86 && x > 10 && x < 40)) return 'water';    // creek pond
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

      /* ---------- Đorđe's house on the hill ---------- */
      var dj = L.house({ id: 'h_djordje', x: 55, z: 11, w: 6.5, d: 5, h: 2.8, wall: 'wall_plaster_patchy', base: 'wall_stone', baseH: 0.7, roof: 'roof_tile', door: { side: 's', at: -1.2 }, windows: [{ side: 's', at: 1.2 }, { side: 's', at: 2.6, w: 0.7 }, { side: 'e', at: 0 }, { side: 'w', at: 0.6 }], windowTile: 'window', chimney: [-2, 0.5], porch: true, mapLabel: 'area.hill' });
      L.spot('djordje_door', dj.doorWorld[0], dj.doorWorld[1] + 0.3, 'down');
      L.spot('djordje_view', 55, 19.5, 'down');
      L.bench(59.5, 17.8, 2.2);
      L.fence([[49, 15.5], [49, 19.5], [53.3, 19.5]], { pickets: true }); L.fence([[56.7, 19.5], [61.5, 19.5], [61.5, 14]], { pickets: true });
      L.woodpile(60.2, 10.6, 2);
      L.billboard('beehive', 47.5, 12, { mat: BTS.MAT.WOOD, collide: 0.3 }); L.billboard('beehive', 46.6, 13.2, { mat: BTS.MAT.WOOD, collide: 0.3 });
      for (var i = 0; i < 7; i++) L.tree('tree_plum', 40 + (i % 3) * 3.2 + R.range(-0.5, 0.5), 9 + Math.floor(i / 3) * 3.4);     // grandmother's orchard
      L.tree('tree_walnut', 64, 8); L.tree('tree_poplar', 67, 13); L.tree('tree_poplar', 44, 20);
      L.lanternPost(53.5, 17.2, { radius: 5, intensity: 0.9 });

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
      L.tree('tree_pine', 79, 16); L.tree('tree_pine', 96, 32); L.tree('tree_birch', 95.5, 16); L.tree('tree_dead', 78.5, 28.5);
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
      L.spot('jaglika_door', jg.doorWorld[0], jg.doorWorld[1] + 0.2); L.spot('jaglika_gate', 12.5, 29.5, 'up'); L.spot('jaglika_watch', 19.5, 31.5, 'left');
      L.fence([[6, 26.5], [6, 29], [11.6, 29]], { h: 1.2, rails: 3 }); L.fence([[13.4, 29], [17, 29], [17, 19]], { h: 1.2, rails: 3 });
      L.billboard('herbs_hang', 9.4, 25.2, { y: 1.3, mat: BTS.MAT.CLOTH, wind: 0.3 });
      L.billboard('tree_dead', 16.5, 18, { scale: 1.2 }); L.circle(16.5, 18, 0.4);
      L.billboard('scarecrow', 4.5, 22, { collide: 0.3 });
      L.billboard('pot_clay', 13.5, 25.6, { mat: BTS.MAT.STONE }); L.billboard('jug', 14.1, 25.5, { mat: BTS.MAT.STONE });

      /* ---------- forest belts & boundaries ---------- */
      var tr = BTS.RNG(5);
      function belt(x0, z0, x1, z1, n, kinds) { for (var q = 0; q < n; q++) { var x = x0 + tr() * (x1 - x0), z = z0 + tr() * (z1 - z0); if (roadAt(x, z) || BTS.Physics.pointBlocked(x, z, 1.0, L.colliders)) continue; L.tree(tr.pick(kinds), x, z, { scale: 1 + tr() * 0.3 }); } }
      belt(0, 0, 112, 6, 34, ['tree_pine', 'tree_oak', 'tree_pine', 'tree_birch']);
      belt(0, 6, 7, 86, 46, ['tree_pine', 'tree_oak', 'tree_dead', 'tree_pine']);
      belt(104, 6, 112, 90, 36, ['tree_oak', 'tree_pine', 'tree_poplar']);
      belt(0, 93, 60, 99, 8, ['tree_oak', 'tree_birch']);
      belt(7, 6, 30, 18, 14, ['tree_pine', 'tree_oak2']);
      belt(66, 6, 104, 14, 14, ['tree_oak', 'tree_pine']);
      belt(36, 74, 50, 86, 6, ['tree_oak2', 'tree_walnut']);
      // hard edges so the player never walks into the void
      L.box(-2, 0, 3.2, 92); L.box(106.8, 0, 114, 92); L.box(0, -2, 112, 4.5); L.box(0, 88.6, 112, 94);
      L.box(9, 85.5, 40, 92, 'creek');
      // vegetation scatter (avoid roads)
      L.scatter(['grass_tuft', 'grass_tuft2', 'grass_tall', 'flowers_wild', 'fern'], 4, 6, 106, 88, 900, { avoid: function (x, z) { return !!roadAt(x, z) || Math.hypot(x - 52, z - 47) < 5.5 || BTS.Physics.pointBlocked(x, z, 0.4, L.colliders); } });
      L.scatter(['reeds'], 10, 84, 40, 87, 40, { wind: 0.8 });
      L.scatter(['bush', 'bush_dark', 'hedge'], 7, 8, 104, 86, 40, { wind: 0.2, avoid: function (x, z) { return !!roadAt(x, z) || BTS.Physics.pointBlocked(x, z, 1.2, L.colliders) || (x > 66 && z > 66); } });
      // footbridge over the creek on the south road
      (function () { var mb = L.propMB(53, 87); mb.box(53, -0.2, 88, 3, 0.15, 3, { all: 'wood_light' }, { mat: BTS.MAT.WOOD }); })();

      /* ---------- spots for people & story ---------- */
      L.spot('menu_cam', 60, 44); L.spot('menu_npc0', 50, 50); L.spot('menu_npc1', 56, 52);
      L.spot('street_w', 16, 47.5, 'right'); L.spot('street_mid', 40, 47.5); L.spot('street_e', 82, 48, 'left');
      L.spot('lane_s', 49.5, 58, 'up'); L.spot('south_road', 53, 80, 'up'); L.spot('west_path', 11.5, 36, 'down');
      L.spot('from_outskirts_w', 4.5, 31, 'right'); L.spot('from_outskirts_s', 53, 85.5, 'up');
      L.spot('default', 54, 49, 'down');

      /* ---------- map areas ---------- */
      L.area('hill', 38, 4, 68, 22); L.area('church', 76, 12, 100, 36); L.area('center', 38, 34, 64, 54); L.area('west', 4, 34, 38, 66);
      L.area('east', 64, 34, 106, 66); L.area('south', 4, 66, 64, 89); L.area('fair', 64, 66, 106, 89); L.area('jaglika', 4, 12, 24, 34);
      L.area('slope', 22, 18, 76, 34);
      // far skirt: woods and hills beyond the playable map, fading into fog
      belt(-24, -20, 136, 0, 60, ['tree_pine', 'tree_oak', 'tree_pine']); belt(-24, 0, 0, 112, 50, ['tree_pine', 'tree_oak']); belt(112, 0, 136, 112, 50, ['tree_oak', 'tree_pine', 'tree_poplar']); belt(-24, 100, 136, 112, 24, ['tree_oak', 'tree_birch']);
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
      { id: 'west', at: [4.5, 31], to: 'outskirts', spawn: 'from_village_w', label: 'loc.outskirts', verb: 'verb.go', door: false, cond: 'flag:outskirts_open', lockedDlg: 'locked_outskirts' },
      { id: 'south', at: [53, 87.2], to: 'outskirts', spawn: 'from_village_s', label: 'loc.outskirts', verb: 'verb.go', door: false, cond: 'flag:outskirts_open', lockedDlg: 'locked_outskirts' }
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
