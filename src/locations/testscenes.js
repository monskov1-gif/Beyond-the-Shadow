/* Developer test scenes: rendering, collision, audio and resource loading checks (dev mode). */
'use strict';
BTS.Locations.test_render = {
  id: 'test_render', nameKey: 'loc.test_render', bounds: [0, 0, 40, 30], camera: {},
  height: function (x, z) { return Math.sin(x * 0.2) * 0.4 + Math.max(0, 6 - z) * 0.35; },
  tile: function (x, z) { if (Math.abs(z - 16) < 1.5) return 'cobble'; if (x > 30) return 'dirt'; if (z > 25 && x < 10) return 'water'; return 'grass'; },
  build: function (L) {
    L.house({ id: 'h1', x: 10, z: 12, w: 5, d: 4, h: 2.7, wall: 'wall_plaster', roof: 'roof_tile', chimney: true, windows: [{ side: 's', at: -1.5 }, { side: 's', at: 1.5 }], door: { side: 's', at: 0 } });
    L.house({ id: 'h2', x: 19, z: 11, w: 4.5, d: 4, h: 2.5, wall: 'wall_stone', roof: 'roof_slab', roofType: 'hip', windows: [{ side: 's', at: -1.2 }], door: { side: 's', at: 0.8 }, porch: true });
    L.house({ id: 'h3', x: 28, z: 12, w: 4, d: 5, h: 2.4, wall: 'wall_timber', beams: true, roof: 'roof_tile_brown', roofType: 'gable_z', windows: [{ side: 's', at: 0, tile: 'window_blue' }], door: { side: 'e', at: 0.5 }, shed: 'w' });
    L.well(15, 19);
    L.fence([[3, 22], [10, 22], [12, 26]], { pickets: true });
    L.stoneWall([[24, 22], [30, 21], [34, 23]]);
    L.tree('tree_oak', 5, 7); L.tree('tree_poplar', 34, 6); L.tree('tree_walnut', 36, 18); L.tree('tree_pine', 3, 15);
    L.scatter(['grass_tuft', 'grass_tuft2', 'flowers_wild'], 2, 2, 38, 28, 120);
    L.lanternPost(13, 17); L.brazier(22, 18); L.bonfire(30, 26);
    L.woodpile(6, 18); L.crate(24, 15, 0.7, 2); L.table(18, 23, 2, 1, { cloth: 'cloth_red' }); L.bench(9, 17, 2);
    L.spot('default', 15, 21, 'down');
    L.ground(0, 0, 40, 30);
  }
};
BTS.Locations.test_collision = {
  id: 'test_collision', nameKey: 'loc.test_collision', bounds: [0, 0, 24, 18], camera: { pitch: 0.9 },
  tile: function (x, z) { return ((Math.floor(x / 2) + Math.floor(z / 2)) % 2) ? 'flags' : 'gravel'; },
  build: function (L) {
    for (var i = 0; i < 6; i++) L.crate(4 + i * 3, 6 + (i % 2) * 3, 0.9);
    L.fence([[2, 13], [10, 13], [10, 16]], { pickets: true });
    L.stoneWall([[13, 12], [20, 15]]);
    L.well(18, 6);
    L.spot('default', 12, 9);
    L.ground(0, 0, 24, 18);
  }
};
