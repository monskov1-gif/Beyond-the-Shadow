/* Interiors. Rooms float in darkness (cut-away dioramas, ref photo 1): back wall + side walls,
   low front sill, partitions with doorways, furniture, light sources, window shafts. */
'use strict';
(function () {
  var MAT = BTS.MAT;
  var RH = 3.0;  // room height

  /* room kit bound to a LocationBuilder */
  function Kit(L) { this.L = L; this.mb = L.propMB(0, 0); }
  Kit.prototype.floor = function (x0, z0, x1, z1, tile) {
    var mb = new BTS.MeshBuilder();
    for (var z = z0; z < z1; z += 2) for (var x = x0; x < x1; x += 2) {
      var w = Math.min(2, x1 - x), d = Math.min(2, z1 - z);
      var k = 0.9 + BTS.M.hash(x, z) * 0.15;
      mb.quad([[x, 0, z + d], [x + w, 0, z + d], [x + w, 0, z], [x, 0, z]], [0, 1, 0], [[0, d / 2], [w / 2, d / 2], [w / 2, 0], [0, 0]], tile, [k, k, k, 0], MAT.GROUND);
    }
    var c = this.L.addChunk(mb, { id: 'floor' }); if (c) c.castShadow = false;
  };
  /* walls around [x0,z0]-[x1,z1]: back (north) full, sides full, front sill low */
  Kit.prototype.shell = function (x0, z0, x1, z1, tile, o) {
    o = o || {};
    var mb = this.mb, L = this.L, h = o.h || RH, th = 0.3;
    mb.box((x0 + x1) / 2, 0, z0 - th / 2, x1 - x0 + th * 2, h, th, { all: tile, top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.55 });
    mb.box(x0 - th / 2, 0, (z0 + z1) / 2, th, h, z1 - z0, { all: tile, top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.55 });
    mb.box(x1 + th / 2, 0, (z0 + z1) / 2, th, h, z1 - z0, { all: tile, top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.55 });
    // skirting + ceiling beam rim along the back wall
    mb.box((x0 + x1) / 2, 0, z0 + 0.04, x1 - x0, 0.25, 0.08, { all: 'wood_dark' }, { mat: MAT.WOOD });
    if (o.beams === true) for (var bx = x0 + 2; bx < x1; bx += 3) mb.box(bx, h - 0.2, (z0 + z1) / 2, 0.22, 0.22, z1 - z0, { all: 'wood_dark', s: false }, { mat: MAT.WOOD });
    // low front sill (cut-away), leaving gaps for doors
    var gaps = (o.doors || []).slice().sort(function (a, b) { return a - b; });
    var segs = [], cur = x0;
    gaps.forEach(function (g) { segs.push([cur, g - 0.7]); cur = g + 0.7; }); segs.push([cur, x1]);
    segs.forEach(function (s) { if (s[1] - s[0] > 0.1) mb.box((s[0] + s[1]) / 2, 0, z1 + th / 2, s[1] - s[0], 0.35, th, { all: tile, top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.6 }); L.box(s[0], z1, s[1], z1 + th + 0.3); });
    L.box(x0 - th - 0.4, z0 - th - 0.4, x1 + th + 0.4, z0);
    L.box(x0 - th - 0.4, z0, x0, z1 + 1); L.box(x1, z0, x1 + th + 0.4, z1 + 1);
    // exterior darkness skirt: a black floor margin so the room floats
    gaps.forEach(function (g) { mb.flat(g, -0.02, z1 + 0.9, 1.4, 1.4, 'floor_dirt', MAT.GROUND, [0.4, 0.4, 0.4, 0]); });
  };
  /* partition along z at x with a doorway [dz0,dz1] */
  Kit.prototype.partition = function (x, z0, z1, d0, d1, tile) {
    var mb = this.mb, L = this.L;
    if (d0 > z0) { mb.box(x, 0, (z0 + d0) / 2, 0.24, RH, d0 - z0, { all: tile, top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.6 }); L.box(x - 0.15, z0, x + 0.15, d0); }
    if (z1 > d1) { mb.box(x, 0, (d1 + z1) / 2, 0.24, RH * 0.45, z1 - d1, { all: tile, top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.6 }); L.box(x - 0.15, d1, x + 0.15, z1); }
    mb.box(x, RH - 0.5, (d0 + d1) / 2, 0.26, 0.5, d1 - d0, { all: 'wood_dark' }, { mat: MAT.WOOD });
  };
  Kit.prototype.window = function (x, z, o) {
    o = o || {};
    var mb = this.mb, L = this.L, y = o.y || 1.2, side = o.side || 's';
    var face = side === 'back' ? 's' : side;
    mb.decal(x, y, z + 0.02, o.w || 1.0, o.h || 1.0, face, o.tile || 'window_plain', MAT.GLASS);
    if (o.light !== false) {
      L.light(x, y + 0.6, z + 1.0, o.color || [0.55, 0.62, 0.8], 5.5, o.intensity || 0.7, 'day', 0);
      L.statics.push({ beam: [[x - 0.45, y + 0.9, z + 0.05], [x + 0.45, y + 0.9, z + 0.05], [x + 0.9, 0.02, z + 2.6], [x - 0.2, 0.02, z + 2.2]], col: [1, 0.92, 0.75], day: true });
      L.emitter({ type: 'dust', x: x + 0.3, y: 0.3, z: z + 1.4, rate: 0.8, area: [1.2, 1.4], dayOnly: true, fx: true });
    }
  };
  Kit.prototype.decal = function (x, y, z, w, h, tile, mat) { this.mb.decal(x, y, z + 0.02, w, h, 's', tile, mat || MAT.DEFAULT); };
  Kit.prototype.sideDecal = function (x, y, z, w, h, tile, face) { this.mb.decal(x, y, z, w, h, face, tile, MAT.DEFAULT); };
  Kit.prototype.rug = function (x, z, w, d, tile) { this.mb.flat(x, 0.012, z, w, d, tile || 'rug_kilim', MAT.CLOTH); };
  Kit.prototype.table = function (x, z, w, d, o) {
    o = o || {}; var mb = this.mb, h = o.h || 0.8;
    mb.box(x, h - 0.08, z, w, 0.08, d, { all: o.top || 'wood_light' }, { mat: MAT.WOOD });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { mb.post(x + s[0] * (w / 2 - 0.08), 0, z + s[1] * (d / 2 - 0.08), h - 0.08, 0.09, 'wood_dark', { mat: MAT.WOOD }); });
    if (o.cloth) mb.box(x, h - 0.32, z + d / 2 + 0.01, w + 0.04, 0.3, 0.02, { all: o.cloth, top: false }, { mat: MAT.CLOTH });
    this.L.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'table');
    return h;
  };
  Kit.prototype.chair = function (x, z, back) {
    var mb = this.mb;
    mb.box(x, 0.42, z, 0.45, 0.06, 0.45, { all: 'wood_light' }, { mat: MAT.WOOD });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { mb.post(x + s[0] * 0.18, 0, z + s[1] * 0.18, 0.42, 0.06, 'wood_dark', { mat: MAT.WOOD }); });
    if (back !== false) mb.box(x, 0.48, z - 0.2, 0.45, 0.55, 0.05, { all: 'wood_dark' }, { mat: MAT.WOOD });
    this.L.circle(x, z, 0.25, 'chair');
  };
  Kit.prototype.bed = function (x, z, w, d, blanket) {
    var mb = this.mb;
    mb.box(x, 0, z, w, 0.45, d, { all: 'wood_dark', top: blanket || 'blanket' }, { mat: MAT.WOOD });
    mb.box(x, 0.45, z - d / 2 + 0.3, w - 0.1, 0.14, 0.45, { all: 'cloth_white' }, { mat: MAT.CLOTH });
    mb.box(x, 0, z - d / 2 - 0.05, w + 0.1, 0.95, 0.1, { all: 'wood_dark' }, { mat: MAT.WOOD });
    this.L.box(x - w / 2, z - d / 2 - 0.1, x + w / 2, z + d / 2, 'bed');
  };
  Kit.prototype.shelf = function (x, z, w, tile, h) {
    var mb = this.mb;
    mb.box(x, 0, z, w, h || 2.0, 0.45, { all: 'wood_dark' }, { mat: MAT.WOOD });
    mb.decal(x, 0.25, z + 0.25, w - 0.1, (h || 2.0) - 0.4, 's', tile || 'books', MAT.WOOD);
    this.L.box(x - w / 2, z - 0.25, x + w / 2, z + 0.3, 'shelf');
  };
  Kit.prototype.cupboard = function (x, z, w) {
    var mb = this.mb;
    mb.box(x, 0, z, w, 1.7, 0.6, { all: 'wood_light' }, { mat: MAT.WOOD });
    mb.decal(x - w / 4, 0.1, z + 0.31, w / 2 - 0.1, 0.8, 's', 'door', MAT.WOOD); mb.decal(x + w / 4, 0.1, z + 0.31, w / 2 - 0.1, 0.8, 's', 'door', MAT.WOOD);
    mb.decal(x, 1.0, z + 0.31, w - 0.1, 0.6, 's', 'shelf_jars', MAT.GLASS);
    this.L.box(x - w / 2, z - 0.3, x + w / 2, z + 0.35, 'cupboard');
  };
  Kit.prototype.stove = function (x, z, lit) {
    var mb = this.mb;
    mb.box(x, 0, z, 1.2, 1.0, 0.9, { all: 'wall_brick', top: 'metal' }, { mat: MAT.STONE });
    mb.decal(x, 0.15, z + 0.46, 0.7, 0.6, 's', 'stove_front', MAT.METAL);
    mb.post(x + 0.3, 1.0, z - 0.2, RH - 1.0, 0.2, 'metal', { mat: MAT.METAL });
    this.L.box(x - 0.6, z - 0.45, x + 0.6, z + 0.45, 'stove');
    if (lit !== false) { this.L.light(x, 0.6, z + 0.9, [1, 0.5, 0.2], 4.5, 0.9, 'fire', 0.3); this.L.statics.push({ sprite: 'flame', x: x, y: 0.22, z: z + 0.48, scale: 0.7, emissive: true, flicker: true, fire: true }); }
  };
  Kit.prototype.chest = function (x, z) { this.mb.box(x, 0, z, 1.1, 0.6, 0.6, { all: 'wall_planks_brown', top: 'wood_dark' }, { mat: MAT.WOOD, units: 1 }); this.mb.box(x, 0.25, z + 0.31, 0.14, 0.14, 0.03, { all: 'metal' }, { mat: MAT.METAL }); this.L.box(x - 0.55, z - 0.3, x + 0.55, z + 0.3, 'chest'); };
  Kit.prototype.candle = function (x, y, z, o) {
    o = o || {};
    this.mb.billboard(x, y, z, 'candle', { mat: MAT.DEFAULT, scale: o.scale || 1 });
    this.L.statics.push({ sprite: 'flame', x: x, y: y + 0.28 * (o.scale || 1), z: z + 0.02, scale: 0.35 * (o.scale || 1), emissive: true, flicker: true, fire: true, off: o.off });
    if (o.light !== false) return this.L.light(x, y + 0.6, z + 0.3, [1, 0.62, 0.3], o.radius || 3.6, o.intensity || 0.75, 'fire', 0.18);
  };
  Kit.prototype.lamp = function (x, z, radius) {   // hanging oil lamp
    this.L.statics.push({ sprite: 'lantern_hang', x: x, y: RH - 0.9, z: z, scale: 1.4, emissive: true });
    this.L.light(x, RH - 0.8, z + 0.3, [1, 0.66, 0.36], radius || 6, 0.95, 'fire', 0.06);
  };
  Kit.prototype.prop = function (name, x, z, o) { o = o || {}; this.mb.billboard(x, o.y || 0, z, name, { mat: o.mat === undefined ? MAT.DEFAULT : o.mat, scale: o.scale, flip: o.flip }); if (o.collide) this.L.circle(x, z, o.collide); };
  Kit.prototype.door = function (x, z, spot) { this.L.spot(spot || 'door', x, z - 0.6, 'up'); };

  function interior(id, o) {
    o.id = id; o.interior = true; o.camera = o.camera || { padX: 0, padZ0: 0, padZ1: 0 };
    o.music = o.music || 'explore';
    o.ambience = o.ambience || { interior: true, reverb: 0.25, reverbLen: 1.2, dogs: false };
    o.surface = o.surface || function () { return 'wood'; };
    BTS.Locations[id] = o;
  }

  /* ============ Đorđe's house ============ */
  interior('djordje_house', {
    nameKey: 'loc.djordje_house', bounds: [-1, -1, 19, 10], camBounds: [4, 2, 14, 7], mapParent: 'village', mapPos: [55, 12],
    build: function (L) {
      var K = new Kit(L);
      K.floor(0, 0, 18, 9, 'floor_wood');
      K.shell(0, 0, 18, 9, 'wall_int_white', { doors: [3.5] });
      K.partition(10, 0, 9, 4.6, 6.6, 'wall_int_white');
      // living room / kitchen
      K.stove(1.2, 1.0);
      K.cupboard(3.6, 0.45, 2.0);
      K.table(5.6, 4.3, 2.0, 1.1, { cloth: 'cloth_white' }); K.chair(4.8, 3.4); K.chair(6.4, 3.4); K.chair(5.6, 5.3, false);
      K.rug(5.4, 6.3, 4, 2);
      K.decal(8.2, 1.7, 0, 0.6, 0.72, 'icon_corner', MAT.DEFAULT); K.candle(8.2, 1.3, 0.25, { radius: 2.8, intensity: 0.5 });
      K.decal(6.8, 1.6, 0, 0.5, 0.62, 'photo_frame');
      K.window(1.6 + 4.5, 0, { side: 'back', y: 1.3 });
      K.chest(8.7, 7.6);
      K.prop('herbs_hang', 2.3, 0.25, { y: 1.9, mat: MAT.CLOTH });
      K.prop('basket', 1.2, 3.2, { collide: 0.25 }); K.prop('jug', 4.4, 4.1, { y: 0.8 });
      K.lamp(5.6, 4.2, 6.5);
      // Đorđe's room
      K.bed(16.5, 2.0, 1.4, 2.8, 'blanket');
      K.table(12.4, 1.0, 2.2, 0.9); K.chair(12.4, 2.0, false);
      K.prop('papers', 12.0, 1.0, { y: 0.8 }); K.prop('books', 13.0, 0.9, { y: 0.8, scale: 0.6 });
      K.shelf(15.2, 0.3, 1.0, 'books', 1.6);
      K.window(13.6, 0, { side: 'back', y: 1.3, w: 1.1 });
      K.rug(13.8, 5.6, 2, 2, 'rug_plain');
      K.prop('cradle_toy', 17.1, 3.3, { y: 0.45 });
      K.decal(11.2, 1.3, 0, 1.1, 0.85, 'pinned_notes');       // his drawings pinned on the wall
      K.candle(12.9, 0.8, 1.1, { radius: 3.4, intensity: 0.7 });
      K.door(3.5, 9);
      L.spot('bed', 15.5, 4.2, 'down'); L.spot('desk', 12.4, 2.4, 'up'); L.spot('window', 13.6, 1.4, 'up'); L.spot('kitchen', 5.6, 6.6, 'up'); L.spot('table', 4.6, 5.2, 'up');
      L.spot('door_in', 3.5, 7.6, 'up'); L.spot('chest', 8.7, 6.7, 'down'); L.spot('stove', 1.6, 2.4, 'up'); L.spot('default', 5, 7, 'up');
      L.spot('baka_chair', 6.4, 3.8, 'down'); L.spot('lisa_table', 6.4, 5.4, 'left');
    },
    exits: [{ id: 'out', at: [3.5, 8.6], to: 'village', spawn: 'djordje_door', label: 'loc.village', verb: 'verb.go' }],
    examine: [
      { id: 'x_dj_icon', at: [8.2, 1.0], label: 'it.icon', dlg: 'x_dj_icon' },
      { id: 'x_dj_photo', at: [6.8, 1.0], label: 'it.family_photo', dlg: 'x_dj_photo' },
      { id: 'x_dj_stove', at: [1.6, 2.2], label: 'it.stove', dlg: 'x_dj_stove' },
      { id: 'x_dj_drawings', at: [11.2, 1.0], label: 'it.drawings', dlg: 'x_dj_drawings' },
      { id: 'x_dj_shelf', at: [15.2, 1.0], label: 'it.shelf', dlg: 'x_dj_shelf' },
      { id: 'x_dj_cupboard', at: [3.6, 1.2], label: 'it.cupboard', dlg: 'x_dj_cupboard' },
      { id: 'x_dj_rabbit', at: [17.1, 3.6], label: 'it.toy', dlg: 'x_dj_rabbit', when: 'c2_funeral..' }
    ]
  });

  /* ============ Pečko & Gvozdin (Zajko's home) ============ */
  interior('zajko_house', {
    nameKey: 'loc.zajko_house', bounds: [-1, -1, 21, 10], camBounds: [5, 2, 15, 7], mapParent: 'village', mapPos: [32, 38.5],
    build: function (L) {
      var K = new Kit(L);
      K.floor(0, 0, 20, 9, 'floor_stone');
      K.shell(0, 0, 20, 9, 'wall_int_blue', { doors: [4] });
      K.partition(12.5, 0, 9, 5, 7, 'wall_int_blue');
      // big kitchen: bread, flour, smith's tools by the door
      K.stove(1.4, 1.0); K.cupboard(4.0, 0.45, 2.2);
      var th = K.table(7.0, 3.6, 3.2, 1.3, { cloth: 'cloth_red' }); K.chair(6.0, 2.6); K.chair(8.0, 2.6); K.chair(6.0, 4.7, false); K.chair(8.0, 4.7, false);
      K.prop('bread', 7.0, 3.5, { y: th, scale: 0.9 }); K.prop('jug', 8.0, 3.4, { y: th });
      K.shelf(10.6, 0.3, 2.2, 'shelf_jars', 1.9);
      K.prop('sack', 11.6, 1.6, { collide: 0.25 }); K.prop('sack', 11.0, 2.0, { collide: 0.25, flip: true }); K.prop('basket', 9.8, 1.8, { collide: 0.25 });
      K.prop('anvil', 1.6, 7.3, { collide: 0.35, scale: 0.8 });
      K.decal(5.6, 1.8, 0, 0.6, 0.72, 'icon_corner'); K.candle(5.6, 1.4, 0.25, { radius: 2.8, intensity: 0.45 });
      K.window(2.8 + 5.5, 0, { side: 'back', y: 1.3 });
      K.rug(7, 6.5, 4, 2);
      K.lamp(7, 3.6, 7);
      // Zajko's room
      K.bed(18.6, 2.0, 1.3, 2.6, 'blanket');
      K.window(15.5, 0, { side: 'back', y: 1.2 });
      K.prop('kite', 13.8, 0.25, { y: 1.3 }); K.prop('ball', 16.4, 6.6); K.prop('cradle_toy', 18.6, 3.3, { y: 0.45 });
      K.table(15.0, 4.0, 1.6, 0.9); K.chair(15.0, 5.0, false);
      K.prop('papers', 14.8, 3.9, { y: 0.8 });
      K.door(4, 9);
      L.spot('door_in', 4, 7.6, 'up'); L.spot('kitchen', 7, 5.8, 'up'); L.spot('table_n', 7, 2.4, 'down'); L.spot('stove', 1.8, 2.6, 'up'); L.spot('zajko_bed', 17.2, 3.0, 'left'); L.spot('zajko_room', 15.6, 6.4, 'up');
      L.spot('zajko_window', 15.5, 1.3, 'up'); L.spot('sill', 15.5, 0.5); L.spot('default', 6, 7, 'up'); L.spot('pecko_spot', 3.4, 2.5, 'down'); L.spot('gvozdin_spot', 9.2, 4.9, 'left');
    },
    exits: [{ id: 'out', at: [4, 8.6], to: 'village', spawn: 'zajko_door', label: 'loc.village', verb: 'verb.go' }],
    examine: [
      { id: 'x_zh_icon', at: [5.6, 1.0], label: 'it.icon', dlg: 'x_zh_icon' },
      { id: 'x_zh_kite', at: [13.8, 1.0], label: 'it.kite', dlg: 'x_zh_kite' },
      { id: 'x_zh_shelf', at: [10.6, 1.0], label: 'it.shelf', dlg: 'x_zh_shelf' },
      { id: 'x_zh_anvil', at: [1.6, 7.0], label: 'it.anvil', dlg: 'x_zh_anvil' }
    ]
  });

  /* ============ Gorazd ============ */
  interior('gorazd_house', {
    nameKey: 'loc.gorazd_house', bounds: [-1, -1, 15, 9], camBounds: [7, 3, 7, 5], mapParent: 'village', mapPos: [91.5, 56.5],
    build: function (L) {
      var K = new Kit(L);
      K.floor(0, 0, 14, 8, 'floor_wood_dark');
      K.shell(0, 0, 14, 8, 'wall_int_wood', { doors: [10.5] });
      K.stove(1.2, 0.9);
      K.bed(12.7, 2.0, 1.4, 2.6, 'cloth_dark');
      var th = K.table(5.4, 3.4, 2.0, 1.1); K.chair(4.6, 2.5); K.chair(6.4, 4.4, false);
      K.prop('jug', 5.0, 3.3, { y: th }); K.prop('papers', 5.9, 3.4, { y: th });
      K.window(3.6, 0, { side: 'back', y: 1.3, tile: 'window_plain' });
      K.decal(7.4, 1.4, 0, 0.6, 0.85, 'mirror_broken');
      K.prop('axe_stump', 9.0, 1.0, { collide: 0.35 }); K.prop('woodpile', 1.4, 6.4, { collide: 0.6 });
      K.prop('barrel', 8.6, 6.8, { collide: 0.3 });
      K.shelf(10.6, 0.3, 1.4, 'shelf_jars', 1.7);
      K.lamp(5.4, 3.4, 5.5);
      K.door(10.5, 8);
      L.spot('door_in', 10.5, 6.6, 'up'); L.spot('table', 5.4, 5.0, 'up'); L.spot('bed', 11.3, 3.0, 'right'); L.spot('window', 3.6, 1.4, 'up'); L.spot('default', 9, 6, 'up'); L.spot('gorazd_spot', 3.6, 2.4, 'up');
    },
    exits: [{ id: 'out', at: [10.5, 7.6], to: 'village', spawn: 'gorazd_door', label: 'loc.village', verb: 'verb.go' }],
    examine: [{ id: 'x_gh_stove', at: [1.6, 2.0], label: 'it.stove', dlg: 'x_gh_stove' }]
  });

  /* ============ Stana's guesthouse: hall + Jessica's room ============ */
  interior('guesthouse', {
    nameKey: 'loc.guesthouse', bounds: [-1, -1, 19, 10], camBounds: [4, 2, 14, 7], mapParent: 'village', mapPos: [64, 37],
    build: function (L) {
      var K = new Kit(L);
      K.floor(0, 0, 18, 9, 'floor_wood');
      K.shell(0, 0, 18, 9, 'wall_int_white', { doors: [3] });
      K.partition(9, 0, 9, 5, 7, 'wall_int_white');
      // hall: reception counter with guestbook, sofa, stairs prop
      K.mb.box(5.6, 0, 2.4, 3.2, 1.05, 0.7, { all: 'wall_planks_brown', top: 'wood_light' }, { mat: MAT.WOOD }); L.box(4.0, 2.05, 7.2, 2.75);
      K.prop('books', 6.4, 2.3, { y: 1.05, scale: 0.5 });
      K.shelf(2.0, 0.3, 1.6, 'shelf_jars', 1.9);
      K.decal(4.5, 1.5, 0, 1.1, 0.8, 'pinned_notes');
      K.window(7.6, 0, { side: 'back', y: 1.3 });
      K.rug(4.6, 5.9, 4, 2); K.chair(2.2, 5.6); K.chair(2.2, 6.6);
      K.lamp(4.6, 4, 6);
      // Jessica's room
      K.bed(16.6, 2.2, 1.4, 2.8, 'cloth_white');
      K.table(11.6, 1.0, 2.4, 0.9); K.chair(11.6, 2.0, false);
      K.prop('papers', 11.2, 1.0, { y: 0.8 }); K.prop('photo_frame', 12.4, 1.0, { y: 0.8 });
      K.prop('suitcase', 14.6, 6.8, { collide: 0.4 }); K.prop('easel', 10.0, 6.8, { collide: 0.3 });
      K.window(14.0, 0, { side: 'back', y: 1.3 });
      K.decal(10.6, 1.7, 0, 0.9, 0.7, 'pinned_notes');
      K.rug(13.6, 5.4, 2, 2, 'rug_plain');
      K.candle(12.6, 0.8, 1.1, { radius: 3.5, intensity: 0.8 });
      K.door(3, 9);
      L.spot('door_in', 3, 7.6, 'up'); L.spot('counter', 5.6, 3.6, 'up'); L.spot('stana_spot', 5.6, 1.4, 'down'); L.spot('jess_desk', 11.6, 2.2, 'up'); L.spot('jess_bed', 15.2, 3.0, 'right'); L.spot('jess_room', 13.2, 6.0, 'up'); L.spot('default', 4, 7, 'up');
    },
    exits: [{ id: 'out', at: [3, 8.6], to: 'village', spawn: 'guest_door', label: 'loc.village', verb: 'verb.go' }],
    examine: [{ id: 'x_gu_notes', at: [4.5, 1.0], label: 'it.notices', dlg: 'x_gu_notes' }]
  });

  /* ============ Jaglika's house: hearth room, storage, dark records room ============ */
  interior('jaglika_house', {
    nameKey: 'loc.jaglika_house', bounds: [-1, -1, 21, 10], camBounds: [5, 2, 15, 7], mapParent: 'village', mapPos: [11, 22.5], music: 'jaglika',
    ambience: { interior: true, reverb: 0.4, reverbLen: 1.6, dogs: false, hum: 0.6 },
    surface: function (x) { return x > 14 ? 'stone' : 'wood'; },
    build: function (L) {
      var K = new Kit(L);
      K.floor(0, 0, 14, 9, 'floor_wood_dark'); K.floor(14, 0, 20, 9, 'floor_brick');
      K.shell(0, 0, 20, 9, 'wall_int_dark', { doors: [3] });
      K.partition(8, 0, 9, 5.2, 7, 'wall_int_dark');
      K.partition(14, 0, 9, 5.4, 7, 'wall_stone_dark');
      // hearth room
      K.mb.box(1.4, 0, 0.8, 2.2, 1.4, 1.0, { all: 'wall_stone_dark', top: 'stone_block' }, { mat: MAT.STONE }); L.box(0.3, 0.2, 2.5, 1.3);
      L.light(1.4, 0.6, 1.8, [1, 0.42, 0.16], 6.0, 1.0, 'fire', 0.35); L.statics.push({ sprite: 'flame', x: 1.4, y: 0.25, z: 1.32, scale: 0.65, emissive: true, flicker: true, fire: true });
      K.prop('herbs_hang', 3.6, 0.3, { y: 2.0, mat: MAT.CLOTH }); K.prop('herbs_hang', 5.4, 0.3, { y: 2.1, mat: MAT.CLOTH, flip: true });
      var th = K.table(4.6, 3.6, 2.0, 1.0); K.chair(4.6, 4.6, false);
      K.prop('pot_clay', 4.2, 3.5, { y: th }); K.prop('vials', 5.1, 3.5, { y: th });
      K.candle(3.8, th, 3.9, { scale: 0.8, radius: 4.5, intensity: 0.85 });   // oil-lamp glow over the herbs and ampoules
      K.mb.box(6.8, 0, 1.0, 1.2, 1.4, 0.8, { all: 'wood_dark' }, { mat: MAT.WOOD }); K.prop('basket', 6.8, 1.5, { y: 0 }); L.box(6.2, 0.6, 7.4, 1.4);   // loom
      K.window(3.2, 0, { side: 'back', y: 1.4, w: 0.7, h: 0.7, intensity: 0.4 });
      K.rug(4.4, 6.4, 3, 2, 'rug_plain');
      // storage: jars, needles on red cloth
      K.shelf(10.0, 0.3, 2.6, 'shelf_jars', 2.2); K.shelf(12.6, 0.3, 1.6, 'shelf_jars', 2.2);
      K.table(11.0, 3.8, 2.2, 0.9, { top: 'cloth_red' });
      K.prop('needle_bundle', 10.6, 3.7, { y: 0.8 }); K.prop('needle_bundle', 11.5, 3.9, { y: 0.8, flip: true }); K.prop('vials', 11.0, 3.4, { y: 0.8 });
      K.candle(11.9, 0.8, 3.6, { scale: 0.9, radius: 4.2, intensity: 0.9 });   // a stub of candle by the needles: the evidence must read
      K.prop('sack', 9.0, 7.4, { collide: 0.25 }); K.prop('jug', 12.8, 7.2, { collide: 0.2 });
      // dark records room (ref photo 1): notes board, posters, desk with book & quill, candelabra, jars
      K.decal(16.0, 1.2, 0, 2.0, 1.4, 'pinned_notes');
      K.decal(18.5, 1.5, 0, 0.8, 1.0, 'poster_anatomy'); K.decal(14.9, 1.6, 0, 0.6, 0.8, 'poster_anatomy');
      K.mb.box(17.0, 2.0, 0.3, 3.0, 0.1, 0.5, { all: 'wood_dark' }, { mat: MAT.WOOD });
      for (var j = 0; j < 6; j++) K.prop('jug', 15.8 + j * 0.45, 0.3, { y: 2.1, scale: 0.8 });
      var dh = K.table(16.6, 3.8, 2.4, 1.1, { top: 'wood_dark' }); K.prop('books', 16.2, 3.8, { y: dh, scale: 0.5 }); K.prop('papers', 17.2, 3.8, { y: dh });
      K.prop('candelabra', 18.6, 4.9, { collide: 0.25 });
      L.light(18.6, 1.9, 5.2, [1, 0.6, 0.3], 4.5, 0.0, 'fire', 0.2, { id: 'jag_candelabra' });
      L.statics.push({ sprite: 'flame', x: 18.6, y: 1.55, z: 4.92, scale: 0.4, emissive: true, flicker: true, fire: true, id: 'jag_candelabra_flame', off: true });
      K.door(3, 9);
      L.spot('door_in', 3, 7.6, 'up'); L.spot('hearth', 2.2, 2.6, 'up'); L.spot('table', 4.6, 5.2, 'up'); L.spot('storage', 11, 5.2, 'up'); L.spot('records', 16.6, 5.4, 'up'); L.spot('board', 16, 1.4, 'up');
      L.spot('default', 4, 7, 'up'); L.spot('lisa_watch', 6.6, 7.2, 'up'); L.spot('jag_return', 3, 8.2, 'up');
    },
    exits: [{ id: 'out', at: [3, 8.6], to: 'village', spawn: 'jaglika_door', label: 'loc.village', verb: 'verb.go' }]
  });

  /* ============ Church interior ============ */
  interior('church', {
    nameKey: 'loc.church', bounds: [-1, -1, 11, 15], camBounds: [5, 4, 5, 9], mapParent: 'village', mapPos: [87, 22.5], music: 'silence',
    ambience: { interior: true, reverb: 0.75, reverbLen: 4.2, dogs: false },
    surface: function () { return 'stone'; },
    build: function (L) {
      var K = new Kit(L);
      K.floor(0, 0, 10, 14, 'floor_stone');
      K.shell(0, 0, 10, 14, 'wall_stone', { doors: [5], beams: false });
      // iconostasis across the north wall
      K.mb.box(5, 0, 0.6, 9.4, 2.8, 0.3, { all: 'wood_dark' }, { mat: MAT.WOOD }); L.box(0, 0, 10, 0.9);
      for (var i = 0; i < 5; i++) K.decal(1.3 + i * 1.85, 1.0, 0.75, 0.75, 1.1, 'icon_fresco');
      K.decal(5, 0.05, 0.76, 1.1, 1.6, 'door_arch', MAT.WOOD);
      K.mb.decal(5, 2.75, 0.02, 0.8, 0.8, 's', 'window_round', MAT.GLASS);
      // side windows (narrow) with light shafts
      K.sideDecal(0.03, 1.8, 4, 0.5, 1.0, 'window_plain', 'e'); K.sideDecal(9.97, 1.8, 4, 0.5, 1.0, 'window_plain', 'w');
      L.light(1.2, 2.2, 4, [0.7, 0.75, 0.9], 5, 0.6, 'day'); L.light(8.8, 2.2, 4, [0.7, 0.75, 0.9], 5, 0.6, 'day');
      L.statics.push({ beam: [[0.1, 2.3, 3.7], [0.1, 2.3, 4.3], [3.2, 0.02, 5.6], [2.6, 0.02, 4.6]], col: [1, 0.95, 0.85], day: true });
      L.statics.push({ beam: [[9.9, 2.3, 4.3], [9.9, 2.3, 3.7], [7.4, 0.02, 4.6], [6.8, 0.02, 5.6]], col: [1, 0.95, 0.85], day: true });
      // benches along the walls, candle stand of sand near the entrance
      [2.5, 5, 7.5, 10].forEach(function (z) { K.mb.box(0.55, 0.42, z, 0.5, 0.07, 1.6, { all: 'wood_light' }, { mat: MAT.WOOD }); K.mb.box(0.55, 0, z, 0.35, 0.42, 0.1, { all: 'wood_dark' }, { mat: MAT.WOOD }); L.box(0.2, z - 0.8, 0.9, z + 0.8); K.mb.box(9.45, 0.42, z, 0.5, 0.07, 1.6, { all: 'wood_light' }, { mat: MAT.WOOD }); K.mb.box(9.45, 0, z, 0.35, 0.42, 0.1, { all: 'wood_dark' }, { mat: MAT.WOOD }); L.box(9.1, z - 0.8, 9.8, z + 0.8); });
      K.mb.box(3.0, 0, 11.4, 1.2, 0.9, 0.7, { all: 'metal', top: 'sand' }, { mat: MAT.METAL }); L.box(2.4, 11.05, 3.6, 11.75);
      for (var c = 0; c < 6; c++) K.candle(2.6 + (c % 3) * 0.4, 0.9, 11.2 + Math.floor(c / 3) * 0.35, { light: c === 0, radius: 4.5, intensity: 1.0 });
      K.candle(2.2, 0, 1.5, { scale: 1.8, radius: 4, intensity: 0.9 }); K.candle(7.8, 0, 1.5, { scale: 1.8, radius: 4, intensity: 0.9 });
      K.prop('candelabra', 5, 2.4, { collide: 0.3, scale: 1.3 });
      // funeral candles at the head and foot of the bier keep the centre of the nave readable
      K.candle(3.7, 0, 6.6, { scale: 1.6, radius: 5, intensity: 1.1 }); K.candle(6.3, 0, 8.4, { scale: 1.6, radius: 5, intensity: 1.1 });
      L.light(5, 3.0, 3.6, [1, 0.7, 0.4], 5, 0.8, 'fire', 0.12);
      // chandelier (horos)
      L.statics.push({ sprite: 'lantern_hang', x: 5, y: 2.6, z: 6.5, scale: 1.8 }); L.light(5, 2.4, 6.6, [1, 0.72, 0.42], 4, 0.5, 'fire', 0.1);
      K.door(5, 14);
      L.spot('door_in', 5, 12.8, 'up'); L.spot('altar', 5, 3.6, 'up'); L.spot('sava_spot', 5, 2.6, 'down'); L.spot('candles', 3.0, 12.6, 'up'); L.spot('bier', 5, 7.5, 'down');
      L.spot('mourner1', 3.4, 9.0, 'up'); L.spot('mourner2', 6.6, 9.2, 'up'); L.spot('mourner3', 4.2, 10.4, 'up'); L.spot('mourner4', 7.2, 10.6, 'up'); L.spot('mourner5', 2.4, 7.6, 'right'); L.spot('default', 5, 12, 'up');
    },
    exits: [{ id: 'out', at: [5, 13.6], to: 'village', spawn: 'church_door', label: 'loc.village', verb: 'verb.go' }],
    examine: [
      { id: 'x_ch_icons', at: [3.2, 1.4], label: 'it.iconostasis', dlg: 'x_ch_icons' },
      { id: 'x_ch_candles', at: [3.0, 11.8], label: 'it.candles', dlg: 'x_ch_candles' },
      { id: 'x_ch_window', at: [1.0, 4.0], label: 'it.window', dlg: 'x_ch_window' }
    ]
  });

  /* ============ Kafana ============ */
  interior('kafana', {
    nameKey: 'loc.kafana', bounds: [-1, -1, 17, 10], camBounds: [8, 3, 8, 6], mapParent: 'village', mapPos: [45.5, 38.5],
    ambience: { interior: true, reverb: 0.25, reverbLen: 1.2, dogs: false, crowd: 0.25 },
    build: function (L) {
      var K = new Kit(L);
      K.floor(0, 0, 16, 9, 'floor_wood');
      K.shell(0, 0, 16, 9, 'wall_int_wood', { doors: [8] });
      // bar
      K.mb.box(3.0, 0, 2.6, 4.4, 1.1, 0.7, { all: 'wall_planks_brown', top: 'wood_dark' }, { mat: MAT.WOOD }); L.box(0.8, 2.25, 5.2, 2.95);
      K.shelf(2.2, 0.3, 2.6, 'shelf_jars', 2.0); K.shelf(4.6, 0.3, 1.6, 'shelf_jars', 2.0);
      K.prop('jug', 2.0, 2.5, { y: 1.1 }); K.prop('jug', 3.8, 2.6, { y: 1.1, flip: true });
      // tables
      [[8.0, 3.0], [11.5, 3.0], [8.0, 6.0], [12.0, 6.3]].forEach(function (t, i) { var h = K.table(t[0], t[1], 1.5, 1.0, { cloth: i % 2 ? 'cloth_red' : 'cloth_green' }); K.chair(t[0] - 0.9, t[1], false); K.chair(t[0] + 0.9, t[1], false); K.prop('jug', t[0], t[1] - 0.1, { y: h, scale: 0.8 }); });
      K.decal(10, 1.6, 0, 0.9, 0.7, 'photo_frame'); K.decal(12.2, 1.4, 0, 1.2, 0.9, 'pinned_notes');
      K.window(14.4, 0, { side: 'back', y: 1.3 });
      K.stove(14.8, 7.6);
      K.mb.box(15.0, 0.9, 1.0, 1.0, 0.7, 0.6, { all: 'cloth_dark' }, { mat: MAT.DEFAULT }); K.decal(15.0, 1.0, 1.31, 0.8, 0.5, 'window_plain', MAT.GLASS);   // old TV
      K.lamp(6, 4, 6.5); K.lamp(11.5, 4.5, 6.5);
      K.door(8, 9);
      L.spot('door_in', 8, 7.6, 'up'); L.spot('bar', 3.0, 3.6, 'up'); L.spot('dragan_spot', 3.0, 1.6, 'down'); L.spot('table1', 7.0, 3.0, 'right'); L.spot('table2', 12.4, 3.0, 'left'); L.spot('table3', 7.0, 6.0, 'right'); L.spot('table4', 12.9, 6.3, 'left'); L.spot('default', 8, 7, 'up');
    },
    exits: [{ id: 'out', at: [8, 8.6], to: 'village', spawn: 'kafana_door', label: 'loc.village', verb: 'verb.go' }],
    examine: [{ id: 'x_kf_tv', at: [15, 2.2], label: 'it.tv', dlg: 'x_kf_tv' }, { id: 'x_kf_photo', at: [10, 1.0], label: 'it.photos', dlg: 'x_kf_photo' }]
  });

  /* ============ Tihomir's house ============ */
  interior('tihomir_house', {
    nameKey: 'loc.tihomir_house', bounds: [-1, -1, 13, 9], camBounds: [6, 3, 6, 5], mapParent: 'village', mapPos: [76.5, 39.5],
    build: function (L) {
      var K = new Kit(L);
      K.floor(0, 0, 12, 8, 'floor_wood');
      K.shell(0, 0, 12, 8, 'wall_int_white', { doors: [7.5] });
      K.bed(10.8, 2.0, 1.3, 2.6, 'blanket');
      var th = K.table(4.6, 3.0, 1.8, 1.0); K.chair(4.6, 4.0, false);
      K.prop('bell', 4.2, 2.9, { y: th, scale: 0.8 });
      K.decal(2.2, 1.7, 0, 0.6, 0.7, 'icon_corner'); K.candle(2.2, 1.3, 0.25, { radius: 3, intensity: 0.6 });
      K.window(6.8, 0, { side: 'back', y: 1.3 });
      K.stove(1.0, 6.6);
      K.shelf(8.6, 0.3, 1.2, 'books', 1.6);
      K.lamp(5, 3, 5.5);
      K.door(7.5, 8);
      L.spot('door_in', 7.5, 6.6, 'up'); L.spot('table', 4.6, 4.6, 'up'); L.spot('bed', 9.4, 3, 'right'); L.spot('icon', 2.2, 1.4, 'up'); L.spot('default', 7, 6, 'up'); L.spot('needle_spot', 10.8, 0.6);
    },
    exits: [{ id: 'out', at: [7.5, 7.6], to: 'village', spawn: 'tihomir_door', label: 'loc.village', verb: 'verb.go' }]
  });
  BTS.InteriorKit = Kit;
})();
