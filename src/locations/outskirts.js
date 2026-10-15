/* Outskirts (ref photo 3): forest path, roadside stone cross, lookout rock above the valley,
   fields with haystacks and a scarecrow, the river with a stone bridge and the old water mill. */
'use strict';
(function () {
  var M = BTS.M;
  var RIVER = [[-2, 38], [20, 42], [40, 46.5], [58, 50], [74, 54], [88, 57], [100, 61]];
  var PATHS = [
    { pts: [[96, 20], [84, 21], [74, 17], [62, 18], [50, 15], [40, 12], [31, 11]], w: 2.0, t: 'dirt' },       // forest path to the lookout
    { pts: [[62, 18], [60, 28], [52, 36], [46, 44]], w: 1.8, t: 'dirt' },                                       // down through the fields to the mill
    { pts: [[96, 58.5], [80, 56], [70, 58], [56, 62], [40, 64]], w: 2.4, t: 'dirt' }                            // south road along the river
  ];
  function segDist(px, pz, a, b) { var dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; var t = l2 ? M.clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / l2, 0, 1) : 0; return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t); }
  function polyDist(x, z, pts) { var d = 1e9; for (var i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(x, z, pts[i], pts[i + 1])); return d; }
  function riverD(x, z) { return polyDist(x, z, RIVER); }
  function height(x, z) {
    var h = 2.2 * M.smooth(32, 4, z) + (M.fbm(x * 0.06, z * 0.06, 3) - 0.5) * 1.4;
    h += 2.0 * M.smooth(10, 2, Math.hypot(x - 30, z - 10));            // lookout rock
    var rd = riverD(x, z);
    h -= 2.0 * M.smooth(6, 1.5, rd);
    return h;
  }
  var cache = null;
  function compute(x, z) {
    var rd = riverD(x, z);
    if (rd < 2.4) return 'water';
    if (rd < 3.4) return 'sand';
    if (Math.abs(x - 88) < 2.2 && Math.abs(z - 57) < 4) return 'flags';
    for (var i = 0; i < PATHS.length; i++) if (polyDist(x, z, PATHS[i].pts) < PATHS[i].w / 2 + (M.hash(x | 0, z | 0) - 0.5) * 0.5) return PATHS[i].t;
    if (x > 18 && x < 70 && z > 25 && z < 40) return ((z | 0) % 6 < 4) ? 'field' : 'grass_dry';
    if (z < 26 || x < 8) return M.fbm(x * 0.2, z * 0.2) > 0.55 ? 'grass_dark' : 'grass';
    if (z > 62) return 'grass_meadow';
    return M.fbm(x * 0.12, z * 0.12) > 0.62 ? 'grass_dry' : 'grass';
  }
  function tileAt(x, z) {
    if (!cache) { cache = []; for (var zz = 0; zz < 74; zz++) for (var xx = 0; xx < 100; xx++) cache.push(compute(xx + 0.5, zz + 0.5)); }
    var ix = Math.floor(x), iz = Math.floor(z);
    if (ix < 0 || iz < 0 || ix >= 100 || iz >= 74) return 'grass_dark';
    return cache[iz * 100 + ix];
  }
  BTS.Locations.outskirts = {
    id: 'outskirts', nameKey: 'loc.outskirts', bounds: [3, 4, 97, 70], music: 'village', height: height, tile: tileAt,
    ambience: { wind: 1.2, leaves: 1.4, river: 1, dogs: true, crows: true, reverb: 0.1, sheep: [70, 66] },
    surface: function (x, z) { var t = tileAt(x, z); if (t === 'flags') return 'stone'; if (/water|sand/.test(t)) return 'mud'; if (/dirt|field/.test(t)) return 'dirt'; return 'grass'; },
    build: function (L) {
      var R = BTS.RNG(31);
      // river collision (except the bridge)
      for (var x = 0; x <= 100; x += 1) for (var z = 30; z < 70; z += 1) if (riverD(x + 0.5, z + 0.5) < 2.0 && !(Math.abs(x + 0.5 - 88) < 2 && Math.abs(z + 0.5 - 57) < 4)) L.box(x, z, x + 1, z + 1, 'river');
      // stone bridge
      (function () {
        var mb = L.propMB(88, 57);
        mb.box(88, -0.6, 57, 3.6, 0.85, 8, { all: 'wall_stone', top: 'flags' }, { mat: BTS.MAT.STONE });
        mb.box(86.15, 0.25, 57, 0.3, 0.6, 8, { all: 'wall_stone_grey' }, { mat: BTS.MAT.STONE }); mb.box(89.85, 0.25, 57, 0.3, 0.6, 8, { all: 'wall_stone_grey' }, { mat: BTS.MAT.STONE });
        L.box(85.9, 53, 86.4, 61); L.box(89.6, 53, 90.1, 61);
      })();
      // old water mill ruin
      (function () {
        var mb = L.propMB(45, 48), y = height(45, 48);
        L.stoneWall([[41, 47.5], [41, 43], [48, 43], [48, 45]], { h: 2.2, th: 0.6, tile: 'wall_stone_grey' });
        L.stoneWall([[48, 46.6], [48, 47.5], [44.5, 47.5]], { h: 1.4, th: 0.6, tile: 'wall_stone_grey' });
        L.billboard('wheel', 49.3, 46.5, { scale: 2.2, mat: BTS.MAT.WOOD });
        L.billboard('tree_dead', 39.5, 42, {}); L.circle(39.5, 42, 0.4);
        L.spot('mill', 44.6, 46, 'up'); L.spot('mill_in', 44.5, 45.2, 'down');
      })();
      // roadside stone cross (krajputaš)
      (function () { var mb = L.propMB(63.5, 16), y = height(63.5, 16); mb.box(63.5, y - 0.2, 16, 0.7, 1.7, 0.4, { all: 'wall_stone_grey' }, { mat: BTS.MAT.STONE }); mb.box(63.5, y + 1.0, 16, 1.3, 0.3, 0.4, { all: 'wall_stone_grey' }, { mat: BTS.MAT.STONE }); L.box(63.1, 15.7, 63.9, 16.3); L.spot('cross_stone', 63.5, 17.4, 'up'); })();
      // lookout rock with a bench, view to the valley
      L.billboard('rock_big', 28, 9.5, { scale: 2.5, mat: BTS.MAT.STONE }); L.circle(28, 9.6, 1.8);
      L.bench(33.5, 13.6, 2); L.spot('lookout', 31.5, 12.6, 'down');
      // fields: haystacks, scarecrow, sheaves
      [[26, 30], [36, 33], [52, 29], [61, 35]].forEach(function (p) { var mb = L.propMB(p[0], p[1]), y = height(p[0], p[1]); L.cylinder(mb, p[0], y - 0.1, p[1], 0.9, 1.0, 8, 'hay', BTS.MAT.DEFAULT); for (var k = 0; k < 3; k++) L.cylinder(mb, p[0], y + 0.9 + k * 0.4, p[1], 0.8 - k * 0.25, 0.4, 8, 'hay', BTS.MAT.DEFAULT, { top: 'hay' }); L.circle(p[0], p[1], 1.0); });
      L.billboard('scarecrow', 44, 31, { collide: 0.3, scale: 1.2 }); L.spot('scarecrow', 44, 32.6, 'up');
      L.fence([[18, 25], [70, 25]], { h: 0.9, spacing: 2, rails: 1 });
      L.fence([[18, 40.5], [32, 41.2]], { h: 0.9, spacing: 2, rails: 1 });
      // shepherd's meadow across the river
      L.fence([[60, 64], [78, 64], [78, 70]], { h: 1, rails: 2 });
      // forest
      function belt(x0, z0, x1, z1, n, kinds) { for (var q = 0; q < n; q++) { var tx = x0 + R() * (x1 - x0), tz = z0 + R() * (z1 - z0); if (tileAt(tx, tz) === 'dirt' || riverD(tx, tz) < 3.5 || BTS.Physics.pointBlocked(tx, tz, 1.2, L.colliders)) continue; L.tree(R.pick(kinds), tx, tz, { scale: 1 + R() * 0.35 }); } }
      belt(0, 0, 100, 24, 150, ['tree_pine', 'tree_pine', 'tree_oak', 'tree_birch', 'tree_dead']);
      belt(0, 24, 16, 70, 50, ['tree_oak', 'tree_pine', 'tree_birch']);
      belt(70, 24, 100, 50, 26, ['tree_oak', 'tree_walnut', 'tree_poplar']);
      belt(0, 66, 100, 76, 26, ['tree_poplar', 'tree_oak', 'tree_birch']);
      for (var i = 0; i < 16; i++) { var px = 10 + i * 5.6, pz = polyRiverZ(px) - 4.2; if (!BTS.Physics.pointBlocked(px, pz, 1.2, L.colliders)) L.tree('tree_poplar', px, pz); }
      L.scatter(['reeds'], 0, 34, 100, 66, 240, { avoid: function (x, z) { var d = riverD(x, z); return d < 2.2 || d > 3.6; }, wind: 0.8 });
      L.scatter(['grass_tuft', 'grass_tuft2', 'grass_tall', 'flowers_wild', 'fern'], 4, 4, 96, 70, 800, { avoid: function (x, z) { return /dirt|water|flags|field/.test(tileAt(x, z)) || BTS.Physics.pointBlocked(x, z, 0.4, L.colliders); } });
      L.scatter(['bush', 'bush_dark', 'bush_berry', 'rock'], 4, 4, 96, 70, 70, { avoid: function (x, z) { return /dirt|water|flags/.test(tileAt(x, z)) || BTS.Physics.pointBlocked(x, z, 1, L.colliders); }, wind: 0.2 });
      L.emitter({ type: 'fireflies', x: 50, y: 0.2, z: 50, rate: 2, area: [70, 14], night: true, fx: true });
      L.emitter({ type: 'leaves', x: 50, y: 0, z: 14, rate: 2, area: [80, 16], fx: true });
      L.box(-2, 0, 3.5, 74); L.box(96.5, 0, 102, 17.5); L.box(96.5, 22.5, 102, 55.5); L.box(96.5, 60.5, 102, 74); L.box(0, -2, 100, 4.5); L.box(0, 69.5, 100, 76);
      L.spot('from_village_w', 94, 20, 'left'); L.spot('from_village_s', 93.5, 58.5, 'left'); L.spot('default', 90, 21, 'left');
      L.spot('field_mid', 40, 36, 'down'); L.spot('field_end', 22, 34); L.spot('river_bank', 60, 46.5, 'down'); L.spot('bridge', 88, 54, 'down'); L.spot('forest_mid', 74, 18.5, 'left'); L.spot('pit', 30, 36);
      L.area('forest', 40, 4, 96, 24); L.area('viewpoint', 20, 4, 40, 20); L.area('fields', 16, 24, 70, 41); L.area('river', 4, 41, 96, 62); L.area('mill', 38, 40, 52, 50);
      L.ground(0, 0, 100, 74, { waterLevel: -0.8 });
    },
    exits: [
      { id: 'to_village_w', at: [95.2, 20], to: 'village', spawn: 'from_outskirts_w', label: 'loc.village', verb: 'verb.go', door: false },
      { id: 'to_village_s', at: [95.2, 58.5], to: 'village', spawn: 'from_outskirts_s', label: 'loc.village', verb: 'verb.go', door: false }
    ],
    examine: [
      { id: 'x_os_cross', at: [63.5, 17], label: 'it.stone_cross', dlg: 'x_os_cross' },
      { id: 'x_os_view', at: [31.5, 12], label: 'it.view', dlg: 'x_os_view' },
      { id: 'x_os_mill', at: [44.6, 45.6], label: 'it.mill', dlg: 'x_os_mill' },
      { id: 'x_os_scarecrow', at: [44, 32], label: 'it.scarecrow', dlg: 'x_os_scarecrow' },
      { id: 'x_os_river', at: [62, 47.5], label: 'it.river', dlg: 'x_os_river' }
    ],
    animals: [{ sprite: 'sheep', at: [68, 67], range: 3 }, { sprite: 'sheep', at: [72, 66.5], range: 3 }, { sprite: 'crow', at: [40, 30], range: 4, flee: true }, { sprite: 'crow', at: [52, 33], range: 3, flee: true }]
  };
  function polyRiverZ(x) { for (var i = 0; i < RIVER.length - 1; i++) { var a = RIVER[i], b = RIVER[i + 1]; if (x >= a[0] && x <= b[0]) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return 50; }
})();
