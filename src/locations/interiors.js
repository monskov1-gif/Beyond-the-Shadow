/* Interiors. Rooms float in darkness (cut-away dioramas, ref photo 1): back wall + side walls,
   low front sill, partitions with doorways, furniture, light sources, window shafts. */
'use strict';
(function () {
  var MAT = BTS.MAT;
  var RH = 3.0;  // room height

  /* room kit bound to a LocationBuilder */
  /* oy: storey height offset — an upper floor gets its own mesh shifted up (see guesthouse); call done() for it */
  function Kit(L, oy) {
    this.L = L; this.oy = oy || 0;
    if (this.oy) { this.mb = new BTS.MeshBuilder(); this.mb.oy = this.oy; this.own = true; } else this.mb = L.propMB(0, 0);
  }
  Kit.prototype.done = function () { if (this.own) this.L.addChunk(this.mb, { id: 'props' }); };
  Kit.prototype.floor = function (x0, z0, x1, z1, tile) {
    var mb = new BTS.MeshBuilder(); mb.oy = this.oy;
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
    if (!o.noWest) mb.box(x0 - th / 2, 0, (z0 + z1) / 2, th, h, z1 - z0, { all: tile, top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.55 });
    if (!o.noEast) mb.box(x1 + th / 2, 0, (z0 + z1) / 2, th, h, z1 - z0, { all: tile, top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.55 });
    // skirting + ceiling beam rim along the back wall
    mb.box((x0 + x1) / 2, 0, z0 + 0.04, x1 - x0, 0.25, 0.08, { all: 'wood_dark' }, { mat: MAT.WOOD });
    if (o.beams === true) for (var bx = x0 + 2; bx < x1; bx += 3) mb.box(bx, h - 0.2, (z0 + z1) / 2, 0.22, 0.22, z1 - z0, { all: 'wood_dark', s: false }, { mat: MAT.WOOD });
    // low front sill (cut-away), leaving gaps for doors
    var gaps = (o.doors || []).slice().sort(function (a, b) { return a - b; });
    var segs = [], cur = x0;
    gaps.forEach(function (g) { segs.push([cur, g - 0.7]); cur = g + 0.7; }); segs.push([cur, x1]);
    segs.forEach(function (s) { if (s[1] - s[0] > 0.1) mb.box((s[0] + s[1]) / 2, 0, z1 + th / 2, s[1] - s[0], 0.35, th, { all: tile, top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.6 }); L.box(s[0], z1, s[1], z1 + th + 0.3); });
    L.box(x0 - th - 0.4, z0 - th - 0.4, x1 + th + 0.4, z0);
    if (!o.noWest) L.box(x0 - th - 0.4, z0, x0, z1 + 1);
    if (!o.noEast) L.box(x1, z0, x1 + th + 0.4, z1 + 1);
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
    var mb = this.mb, L = this.L, side = o.side || 's';
    var face = side === 'back' ? 's' : side;
    // windows sized to the hero (~1.5 m): about 1.6 x 1.3 m, sill at ~0.75 m
    var ww = Math.max(1.6, (o.w || 1.0) * 1.6), wh = Math.max(1.3, (o.h || 1.0) * 1.3), y = Math.max(1.4, (o.y || 1.2) + 0.1);
    mb.decal(x, y, z + 0.02, ww, wh, face, o.tile || 'window_plain', MAT.GLASS);
    if (o.light !== false) {
      var oy = this.oy;
      L.light(x, y + 0.6 + oy, z + 1.0, o.color || [0.55, 0.62, 0.8], 5.5, o.intensity || 0.7, 'day', 0);
      L.statics.push({ beam: [[x - ww * 0.42, y + wh * 0.45 + oy, z + 0.05], [x + ww * 0.42, y + wh * 0.45 + oy, z + 0.05], [x + ww * 0.75, 0.02 + oy, z + 2.8], [x - ww * 0.25, 0.02 + oy, z + 2.4]], col: [1, 0.92, 0.75], day: true });
      L.emitter({ type: 'dust', x: x + 0.3, y: 0.3 + oy, z: z + 1.4, rate: 0.8, area: [1.2, 1.4], dayOnly: true, fx: true });
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
  Kit.prototype.chair = function (x, z, back, noCollide) {
    var mb = this.mb;
    mb.box(x, 0.42, z, 0.45, 0.06, 0.45, { all: 'wood_light' }, { mat: MAT.WOOD });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { mb.post(x + s[0] * 0.18, 0, z + s[1] * 0.18, 0.42, 0.06, 'wood_dark', { mat: MAT.WOOD }); });
    if (back !== false) mb.box(x, 0.48, z - 0.2, 0.45, 0.55, 0.05, { all: 'wood_dark' }, { mat: MAT.WOOD });
    if (!noCollide) this.L.circle(x, z, 0.25, 'chair');
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
    if (lit !== false) { this.L.light(x, 0.6 + this.oy, z + 0.9, [1, 0.5, 0.2], 4.5, 0.9, 'fire', 0.3); this.L.statics.push({ sprite: 'flame', x: x, y: 0.22 + this.oy, z: z + 0.48, scale: 0.7, emissive: true, flicker: true, fire: true }); }
  };
  Kit.prototype.chest = function (x, z) { this.mb.box(x, 0, z, 1.1, 0.6, 0.6, { all: 'wall_planks_brown', top: 'wood_dark' }, { mat: MAT.WOOD, units: 1 }); this.mb.box(x, 0.25, z + 0.31, 0.14, 0.14, 0.03, { all: 'metal' }, { mat: MAT.METAL }); this.L.box(x - 0.55, z - 0.3, x + 0.55, z + 0.3, 'chest'); };
  Kit.prototype.candle = function (x, y, z, o) {
    o = o || {};
    this.mb.billboard(x, y, z, 'candle', { mat: MAT.DEFAULT, scale: o.scale || 1 });
    this.L.statics.push({ sprite: 'flame', x: x, y: y + 0.28 * (o.scale || 1) + this.oy, z: z + 0.02, scale: 0.35 * (o.scale || 1), emissive: true, flicker: true, fire: true, off: o.off });
    if (o.light !== false) return this.L.light(x, y + 0.6 + this.oy, z + 0.3, [1, 0.62, 0.3], o.radius || 3.6, o.intensity || 0.75, 'fire', 0.18);
  };
  Kit.prototype.lamp = function (x, z, radius) {   // hanging oil lamp
    this.L.statics.push({ sprite: 'lantern_hang', x: x, y: RH - 0.9 + this.oy, z: z, scale: 1.4, emissive: true });
    this.L.light(x, RH - 0.8 + this.oy, z + 0.3, [1, 0.66, 0.36], radius || 6, 0.95, 'fire', 0.06);
  };
  Kit.prototype.prop = function (name, x, z, o) { o = o || {}; this.mb.billboard(x, o.y || 0, z, name, { mat: o.mat === undefined ? MAT.DEFAULT : o.mat, scale: o.scale, flip: o.flip }); if (o.collide) this.L.circle(x, z, o.collide); };
  Kit.prototype.door = function (x, z, spot) { this.L.spot(spot || 'door', x, z - 0.6, 'up'); };
  /* tall wardrobe (orman); face: side its doors open to */
  Kit.prototype.wardrobe = function (x, z, w, d, face, h) {
    var mb = this.mb; h = h || 2.2;
    mb.box(x, 0, z, w, h, d, { all: 'wall_planks_brown', top: 'wood_dark' }, { mat: MAT.WOOD, units: 1.5 });
    mb.box(x, h, z, w + 0.1, 0.12, d + 0.1, { all: 'wood_dark' }, { mat: MAT.WOOD });
    var along = face === 'e' || face === 'w' ? d : w, fx = face === 'e' ? x + w / 2 : face === 'w' ? x - w / 2 : x, fz = face === 's' ? z + d / 2 : face === 'n' ? z - d / 2 : z;
    var off = along / 4;
    [-off, off].forEach(function (o) { mb.decal(fx + (face === 's' || face === 'n' ? o : 0), 0.15, fz + (face === 'e' || face === 'w' ? o : 0), along / 2 - 0.08, h - 0.35, face, 'door', MAT.WOOD); });
    this.L.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'wardrobe');
  };
  /* domed bread oven (furuna) with a glowing mouth facing the camera */
  Kit.prototype.breadOven = function (x, z, r) {
    var mb = this.mb, L = this.L; r = r || 0.85;
    L.cylinder(mb, x, 0, z, r + 0.08, 0.55, 10, 'wall_stone_grey', MAT.STONE);
    L.cylinder(mb, x, 0.55, z, r, 0.45, 10, 'wall_plaster', MAT.STONE);
    for (var k = 0; k < 3; k++) L.cylinder(mb, x, 1.0 + k * 0.18, z, r * (0.86 - k * 0.24), 0.18, 10, 'wall_plaster', MAT.STONE, { top: k === 2 ? 'wall_plaster' : null });
    mb.decal(x, 0.6, z + r + 0.02, 0.55, 0.45, 's', 'stove_front', MAT.STONE);
    L.circle(x, z, r + 0.12, 'oven');
    L.light(x, 0.9 + this.oy, z + r + 0.5, [1, 0.48, 0.2], 3.6, 0.75, 'fire', 0.3);
    L.statics.push({ sprite: 'flame', x: x, y: 0.62 + this.oy, z: z + r + 0.05, scale: 0.55, emissive: true, flicker: true, fire: true });
  };
  /* hanging curtain from (x0,z)-(x1,z) on a rod (facing the camera); collide: solid */
  Kit.prototype.curtain = function (x0, x1, z, h, collide) {
    var mb = this.mb;
    mb.box((x0 + x1) / 2, 0.04, z, x1 - x0, h, 0.06, { all: 'curtain', top: false }, { mat: MAT.CLOTH, units: 1 });
    this.L.beam(mb, x0 - 0.15, h + 0.08, z, x1 + 0.15, h + 0.08, z, 0.05, 'metal', { mat: MAT.METAL });
    if (collide !== false) this.L.box(x0, z - 0.1, x1, z + 0.1, 'curtain');
  };

  function interior(id, o) {
    o.id = id; o.interior = true; o.camera = o.camera || { padX: 0, padZ0: 0, padZ1: 0 };
    o.music = o.music || 'explore';
    o.ambience = o.ambience || { interior: true, reverb: 0.25, reverbLen: 1.2, dogs: false };
    o.surface = o.surface || function () { return 'wood'; };
    BTS.Locations[id] = o;
  }

  /* ============ Đorđe's house: the family home of Pečko (baker) and Gvozdin (smith) ============
     row of rooms (west → east): parents' bedroom | hall with the back door and the pantry corner |
     kitchen with the bread oven (front door from the terrace) | family room ("kuća") | Đorđe's room */
  interior('djordje_house', {
    nameKey: 'loc.djordje_house', bounds: [-11.2, -1, 19, 10], camBounds: [-7.4, 2, 14, 7], mapParent: 'village', mapPos: [55, 12],
    surface: function (x) { return x > -4.2 && x < 4.3 ? 'stone' : 'wood'; },
    build: function (L) {
      var K = new Kit(L);
      K.floor(-10.2, 0, -4.2, 9, 'floor_wood_dark'); K.floor(-4.2, 0, 0, 9, 'floor_brick'); K.floor(0, 0, 4.3, 9, 'floor_stone'); K.floor(4.3, 0, 18, 9, 'floor_wood');
      K.shell(-10.2, 0, 18, 9, 'wall_int_white', { doors: [3.5] });
      K.partition(-4.2, 0, 9, 5.2, 7.0, 'wall_int_white');
      K.partition(0, 0, 9, 2.8, 4.6, 'wall_int_white');
      K.partition(4.3, 0, 9, 4.6, 7.4, 'wall_int_white');
      K.partition(10, 0, 9, 4.6, 6.6, 'wall_int_white');

      /* --- parents' bedroom --- */
      K.bed(-7.2, 1.75, 2.1, 2.7, 'blanket');
      K.mb.box(-7.2, 0.45, 0.55, 1.9, 0.14, 0.45, { all: 'cloth_white' }, { mat: MAT.CLOTH });   // second pillow
      [-8.65, -5.75].forEach(function (x) { K.mb.box(x, 0, 0.55, 0.55, 0.6, 0.5, { all: 'wood_dark', top: 'cloth_white' }, { mat: MAT.WOOD }); L.box(x - 0.28, 0.3, x + 0.28, 0.8, 'nightstand'); });
      K.candle(-5.75, 0.6, 0.6, { scale: 0.8, radius: 3.2, intensity: 0.55 });
      K.decal(-9.55, 1.6, 0, 0.6, 0.72, 'icon_corner'); L.statics.push({ sprite: 'kandilo', x: -9.55, y: 1.05, z: 0.3, scale: 1.1 });
      L.statics.push({ sprite: 'flame', x: -9.55, y: 1.42, z: 0.32, scale: 0.28, emissive: true, flicker: true, fire: true }); L.light(-9.5, 1.5, 0.8, [1, 0.45, 0.3], 2.6, 0.45, 'fire', 0.2);
      K.window(-4.95 - 0.5, 0, { side: 'back', y: 1.3, w: 0.8 });
      K.wardrobe(-9.8, 5.3, 0.75, 2.0, 'e');
      K.chest(-7.2, 3.55);                                                       // dowry chest at the foot of the bed
      K.mb.box(-9.75, 0, 7.9, 0.8, 0.95, 1.3, { all: 'wood_light', top: 'cloth_white' }, { mat: MAT.WOOD }); L.box(-10.2, 7.25, -9.35, 8.55, 'dresser');
      K.sideDecal(-10.16, 1.2, 7.9, 0.7, 0.9, 'window_plain', 'e');              // mirror over the dresser
      K.prop('photo_frame', -9.7, 7.7, { y: 0.95, scale: 0.8 });
      K.prop('basket', -5.0, 3.0, { collide: 0.25 });                           // Pečko's knitting
      K.sideDecal(-4.36, 1.0, 2.0, 0.9, 1.2, 'cloth_white', 'w');               // her apron on a peg
      K.sideDecal(-4.36, 1.0, 3.2, 0.8, 1.3, 'cloth_dark', 'w');                // his leather apron
      K.rug(-7.0, 5.6, 3.6, 2.0, 'rug_kilim');
      K.lamp(-7.0, 4.2, 5.5);

      /* --- hall: coats, the back door to the yard, the pantry corner --- */
      K.prop('coat_rack', -3.6, 0.55, { collide: 0.28 });
      K.decal(-2.0, 0, 0, 0.95, 1.9, 'door_grey', MAT.WOOD); K.mb.box(-2.0, 1.9, 0.08, 1.2, 0.12, 0.12, { all: 'wood_beam' }, { mat: MAT.WOOD });
      K.mb.box(-0.75, 0, 0.45, 1.1, 0.42, 0.42, { all: 'wood_light' }, { mat: MAT.WOOD }); L.box(-1.3, 0.24, -0.2, 0.66, 'bench');
      K.prop('bucket', -1.0, 0.5, { y: 0.42, scale: 0.9 });
      K.shelf(-3.25, 8.35, 1.6, 'shelf_jars', 1.9);                           // pantry: preserves (zimnica)
      K.prop('peppers', -1.9, 8.6, { y: 1.3, mat: MAT.CLOTH }); K.prop('peppers', -1.5, 8.6, { y: 1.4, mat: MAT.CLOTH, flip: true });
      K.prop('sack_flour', -0.7, 8.1, { collide: 0.28 }); K.prop('barrel', -1.5, 7.5, { collide: 0.3 }); K.prop('cheese_shelf', -2.6, 8.55, { y: 1.95 });
      K.lamp(-2.1, 4.2, 4.5);

      /* --- kitchen: stove, Pečko's bread oven, kneading trough, cupboard --- */
      K.stove(1.2, 1.0);
      K.cupboard(3.15, 0.45, 1.9);
      K.breadOven(1.1, 6.9, 0.85);
      K.prop('kneading_trough', 3.3, 2.3, { collide: 0.45 });
      K.prop('bread', 3.3, 2.25, { y: 0.72, scale: 0.6 });
      K.prop('peel', 2.15, 8.35);
      K.prop('sack_flour', 0.55, 5.1, { collide: 0.28 }); K.prop('sack_flour', 0.5, 4.5, { flip: true });
      K.prop('herbs_hang', 2.3, 0.25, { y: 1.9, mat: MAT.CLOTH }); K.prop('peppers', 0.4, 0.3, { y: 1.3, mat: MAT.CLOTH });
      K.prop('basket', 1.2, 3.2, { collide: 0.25 });

      /* --- family room --- */
      K.table(5.6, 4.3, 2.0, 1.1, { cloth: 'cloth_white' }); K.chair(4.8, 3.3); K.chair(6.4, 3.25, true, true); K.chair(5.6, 5.3, false);   // grandmother's chair: no collider, she sits on it
      K.prop('jug', 4.9, 4.1, { y: 0.8 });
      K.rug(7.0, 6.5, 4.2, 2);
      K.decal(8.2, 1.7, 0, 0.6, 0.72, 'icon_corner', MAT.DEFAULT); K.candle(8.2, 1.3, 0.25, { radius: 2.8, intensity: 0.5 });
      K.decal(9.35, 1.6, 0, 0.5, 0.62, 'photo_frame');
      K.window(6.1, 0, { side: 'back', y: 1.3 });
      K.mb.box(9.5, 0, 2.5, 0.8, 0.45, 2.4, { all: 'wood_dark', top: 'rug_kilim' }, { mat: MAT.WOOD }); K.mb.box(9.82, 0.45, 2.5, 0.16, 0.5, 2.4, { all: 'rug_plain' }, { mat: MAT.CLOTH }); L.box(9.1, 1.3, 9.85, 3.7, 'sofa');
      K.chest(8.7, 7.6);
      K.lamp(5.6, 4.2, 6.5);

      /* --- Đorđe's room --- */
      K.bed(16.5, 2.0, 1.4, 2.8, 'blanket');
      K.table(12.4, 1.0, 2.2, 0.9); K.chair(12.4, 2.0, false);
      K.prop('papers', 12.0, 1.0, { y: 0.8 }); K.prop('books', 13.0, 0.9, { y: 0.8, scale: 0.6 });
      K.shelf(15.2, 0.3, 1.0, 'books', 1.6);
      K.window(13.6, 0, { side: 'back', y: 1.3, w: 1.1 });
      K.rug(13.8, 5.6, 2, 2, 'rug_plain');
      K.decal(11.2, 1.3, 0, 1.1, 0.85, 'pinned_notes');                         // his drawings pinned on the wall
      K.sideDecal(10.14, 1.0, 2.6, 1.6, 1.15, 'pinned_notes', 'e');             // notes board: sketches, a map of the village
      K.wardrobe(17.5, 6.6, 0.8, 1.6, 'w', 2.0);
      K.candle(12.9, 0.8, 1.1, { radius: 3.4, intensity: 0.7 });
      K.door(3.5, 9);
      L.spot('bed', 15.5, 4.2, 'down'); L.spot('desk', 12.4, 2.4, 'up'); L.spot('window', 13.6, 1.4, 'up'); L.spot('table', 4.6, 5.2, 'up');
      L.spot('kitchen', 2.6, 4.9, 'left'); L.spot('hall', -2.1, 5.0, 'up'); L.spot('pantry', -2.4, 6.9, 'down'); L.spot('parents_room', -7.0, 6.6, 'up');
      L.spot('oven', 2.4, 6.9, 'left');
      L.spot('door_in', 3.5, 7.6, 'up'); L.spot('chest', 8.7, 6.7, 'down'); L.spot('stove', 1.6, 2.4, 'up'); L.spot('default', 5, 7, 'up');
      L.spot('baka_chair', 6.4, 3.25, 'down'); L.spot('lisa_table', 6.4, 5.4, 'left');
    },
    exits: [{ id: 'out', at: [3.5, 8.6], to: 'village', spawn: 'djordje_door', label: 'loc.village', verb: 'verb.go' }],
    examine: [
      { id: 'x_dj_icon', at: [8.2, 1.0], label: 'it.icon', dlg: 'x_dj_icon' },
      { id: 'x_dj_photo', at: [9.35, 1.0], label: 'it.family_photo', dlg: 'x_dj_photo' },
      { id: 'x_dj_stove', at: [1.6, 2.2], label: 'it.stove', dlg: 'x_dj_stove' },
      { id: 'x_dj_drawings', at: [11.2, 1.0], label: 'it.drawings', dlg: 'x_dj_drawings' },
      { id: 'x_dj_shelf', at: [15.2, 1.0], label: 'it.shelf', dlg: 'x_dj_shelf' },
      { id: 'x_dj_cupboard', at: [3.15, 1.2], label: 'it.cupboard', dlg: 'x_dj_cupboard' },
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

  /* ============ Stana's guesthouse: two storeys ============
     ground floor (y 0): kitchen | dining room | reception (front door) | stair hall
     upper floor (y 3, laid out to the east of the stair, reached by a walkable flight): the landing opens onto a hall
     (x 9.8-11.8) that turns into a corridor along the front (z 6.9-9). Jessica's room (x 11.8-18) has its own door
     off the hall; Lisa's room (x 18-25.6) has its own door at the corridor's end. The rooms no longer connect.
     The story's desk interactables follow the 'jess_desk' spot (BTS.SpotAt), so they stay on her desk. */
  var GH_UP = 3.0;
  interior('guesthouse', {
    nameKey: 'loc.guesthouse', bounds: [-11, -1, 27, 10], camBounds: [-7, 2, 23, 7], mapParent: 'village', mapPos: [64, 37],
    build: function (L) {
      var K = new Kit(L), U = new Kit(L, GH_UP), MB = K.mb;
      /* ---- ground floor ---- */
      K.floor(-10, 0, 0, 9, 'floor_stone'); K.floor(0, 0, 9.8, 9, 'floor_wood');
      K.shell(-10, 0, 9.8, 9, 'wall_int_white', { doors: [3], noEast: true });
      K.partition(-5, 0, 9, 5.0, 7.0, 'wall_int_white');
      K.partition(0, 0, 9, 5.0, 7.0, 'wall_int_white');
      // kitchen
      K.stove(-9.0, 1.0); K.cupboard(-6.6, 0.45, 2.2);
      var kt = K.table(-7.4, 4.0, 2.2, 1.0, { top: 'wood_light' });
      K.prop('bread', -7.6, 3.9, { y: kt, scale: 0.8 }); K.prop('jug', -6.7, 3.8, { y: kt }); K.prop('pot_clay', -8.2, 3.9, { y: kt, scale: 0.8 });
      K.prop('herbs_hang', -8.0, 0.3, { y: 2.0, mat: MAT.CLOTH }); K.prop('peppers', -5.6, 0.3, { y: 1.85, mat: MAT.CLOTH });
      K.prop('sack_flour', -9.5, 7.9, { collide: 0.28 }); K.prop('barrel', -8.7, 8.1, { collide: 0.3 }); K.prop('bucket_milk', -5.8, 8.2, { collide: 0.2 });
      K.lamp(-7.4, 4.2, 5);
      // dining room
      [[-2.5, 2.8, 'cloth_red'], [-2.5, 6.4, 'cloth_green']].forEach(function (t, i) {
        var h = K.table(t[0], t[1], 2.2, 1.0, { cloth: t[2] });
        K.chair(t[0] - 1.45, t[1], false); K.chair(t[0] + 1.45, t[1], false); if (!i) { K.chair(t[0] - 0.5, t[1] - 0.85); K.chair(t[0] + 0.5, t[1] - 0.85); }
        K.prop('jug', t[0] + 0.3, t[1] - 0.1, { y: h, scale: 0.8 }); K.candle(t[0] - 0.4, h, t[1], { scale: 0.7, radius: 3, intensity: 0.5 });
      });
      K.window(-2.5, 0, { side: 'back', y: 1.3 });
      K.decal(-4.5, 1.7, 0, 0.6, 0.72, 'icon_corner');
      K.decal(-0.7, 1.5, 0, 0.6, 0.75, 'photo_frame');
      // reception: counter with the guestbook, key board, notices, a sitting corner
      MB.box(5.6, 0, 2.4, 3.2, 1.05, 0.7, { all: 'wall_planks_brown', top: 'wood_light' }, { mat: MAT.WOOD }); L.box(4.0, 2.05, 7.2, 2.75);
      K.prop('books', 6.4, 2.3, { y: 1.05, scale: 0.5 }); K.prop('bell', 4.5, 2.3, { y: 1.05, scale: 0.45 });
      K.shelf(1.5, 0.3, 1.6, 'shelf_jars', 1.9);
      K.decal(4.5, 1.5, 0, 1.1, 0.8, 'pinned_notes');
      K.decal(3.1, 1.55, 0, 0.8, 0.5, 'shelf_jars');                    // key board
      K.window(6.4, 0, { side: 'back', y: 1.4, w: 0.7 });
      K.rug(2.8, 6.0, 3.2, 2); K.chair(0.9, 2.7); K.chair(0.9, 3.6); K.table(0.9, 4.4, 0.7, 0.6, { h: 0.6 });
      K.prop('bush', 6.9, 7.6, { scale: 0.55, collide: 0.3 }); K.prop('pot_clay', 6.9, 7.62, { scale: 0.9 });
      K.lamp(3.6, 4, 6);
      /* ---- stair hall: a flight climbing north to the landing ---- */
      var sx0 = 7.6, sx1 = 9.8;
      L.stairs(sx0, 3.6, sx1, 7.6, 'n', 0, GH_UP, { mb: MB, base: 0, side: 'wood_dark', top: 'floor_wood', mat: MAT.WOOD, sides: [true, false], rail: 'wood_dark' });
      MB.box((sx0 + sx1) / 2, 0, 1.8, sx1 - sx0, GH_UP, 3.6, { all: 'wall_int_white', top: 'floor_wood' }, { mat: MAT.PLASTER, ao: 0.6 });   // landing on its wall
      L.pad(sx0, 0, sx1, 3.6, GH_UP);
      L.box(sx0 - 0.15, 0, sx0 + 0.15, 3.6, 'wall');                                                                   // landing edge / wall under it
      for (var bz = 0.3; bz < 3.6; bz += 0.3) MB.post(sx0 + 0.05, GH_UP, bz, 0.9, 0.05, 'wood_dark', { mat: MAT.WOOD });
      L.beam(MB, sx0 + 0.05, GH_UP + 0.92, 0, sx0 + 0.05, GH_UP + 0.92, 3.6, 0.08, 'wood_beam');
      MB.box((sx0 + sx1) / 2, GH_UP, -0.15, sx1 - sx0 + 0.3, 3.0, 0.3, { all: 'wall_int_white', top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.55 });
      L.statics.push({ sprite: 'lantern_hang', x: 8.7, y: GH_UP + 1.9, z: 4.6, scale: 1.4, emissive: true }); L.light(8.7, GH_UP + 2.0, 5.0, [1, 0.66, 0.36], 6, 0.9, 'fire', 0.06);
      /* ---- upper floor block: the storey below shown in section, floor on top ---- */
      var ux0 = 9.8, ux1 = 25.6;
      MB.box((ux0 + ux1) / 2, 0, 4.5, ux1 - ux0, GH_UP, 9, { all: 'wall_plaster', top: false, n: false }, { mat: MAT.PLASTER, col: [0.62, 0.6, 0.56, 0], ao: 0.5 });
      MB.box((ux0 + ux1) / 2, GH_UP - 0.28, 9.02, ux1 - ux0, 0.28, 0.05, { all: 'wood_dark' }, { mat: MAT.WOOD });
      for (var jx = ux0 + 0.4; jx < ux1; jx += 0.9) MB.box(jx, GH_UP - 0.24, 9.06, 0.16, 0.16, 0.04, { all: 'wood_beam' }, { mat: MAT.WOOD });
      L.box(ux0, 3.6, ux0 + 0.3, 9.6, 'wall');
      U.floor(ux0, 0, ux1, 9, 'floor_wood');
      U.shell(ux0, 0, ux1, 9, 'wall_int_white', { noWest: true });
      L.pad(ux0, 0, ux1, 9, GH_UP);
      U.partition(ux0, 0, 9, 0, 3.6, 'wall_int_white');               // landing -> hall: open; low rail along the stairwell
      var jx = 11.8, jz = 6.9;                                           // Jessica's room: x jx..18, z 0..jz
      U.partition(jx, 0, jz, 3.4, 5.2, 'wall_int_white');               // hall | Jessica's room, her door at z 3.4-5.2
      U.mb.box((jx + 18) / 2, 0, jz, 18 - jx, 1.0, 0.22, { all: 'wall_int_white', top: 'wood_dark' }, { mat: MAT.PLASTER, ao: 0.6 });   // low (cut-away) wall to the corridor
      L.box(jx, jz - 0.12, 18, jz + 0.12, 'wall');
      U.partition(18, 0, 9, 7.1, 8.9, 'wall_int_white');                // Lisa's room: her door at the corridor's end
      U.cupboard(10.8, 0.45, 1.2); U.rug(10.8, 6.0, 1.4, 3.6, 'rug_kilim'); U.lamp(10.8, 5.6, 4.5); U.lamp(15.0, 8.0, 4);
      // Jessica's room
      U.bed(16.8, 2.2, 1.4, 2.8, 'cloth_white');
      U.table(13.6, 1.0, 2.4, 0.9); U.chair(13.6, 2.0, false);
      U.prop('papers', 13.2, 1.0, { y: 0.8 }); U.prop('photo_frame', 14.4, 1.0, { y: 0.8 });
      U.prop('suitcase', 16.9, 5.8, { collide: 0.4 }); U.prop('easel', 12.5, 6.1, { collide: 0.3 });
      U.window(15.6, 0, { side: 'back', y: 1.3 });
      U.decal(12.3, 1.7, 0, 0.8, 0.65, 'pinned_notes');
      U.rug(14.6, 4.6, 2, 2, 'rug_plain');
      U.candle(14.6, 0.8, 1.1, { radius: 3.5, intensity: 0.8 });
      // Lisa's room
      U.bed(24.3, 2.2, 1.4, 2.8, 'blanket');
      var lt = U.table(20.2, 1.0, 2.0, 0.9); U.chair(20.2, 2.0, false);
      U.prop('typewriter', 19.8, 1.0, { y: lt }); U.prop('papers', 20.7, 1.1, { y: lt });
      U.prop('suitcase', 22.6, 7.4, { collide: 0.4 }); U.prop('coat_rack', 25.0, 7.3, { collide: 0.28 });
      U.window(22.4, 0, { side: 'back', y: 1.3 });
      U.decal(18.9, 1.55, 0, 0.9, 0.7, 'pinned_notes');
      U.rug(21.4, 5.2, 2.4, 2, 'rug_kilim');
      U.lamp(21.4, 4.4, 5.5); U.lamp(14.6, 4.0, 5.0);
      U.done();
      K.door(3, 9);
      L.spot('door_in', 3, 7.6, 'up'); L.spot('counter', 5.6, 3.6, 'up'); L.spot('stana_spot', 5.6, 1.4, 'down'); L.spot('default', 4, 7, 'up');
      L.spot('guest_kitchen', -7.4, 5.8, 'up'); L.spot('dining', -2.5, 4.6, 'up'); L.spot('stairs', 8.7, 8.2, 'up'); L.spot('upstairs', 8.7, 2.0, 'right');
      L.spot('jess_desk', 13.6, 2.2, 'up'); L.spot('jess_bed', 15.4, 3.0, 'right'); L.spot('jess_room', 14.4, 5.4, 'up');
      L.spot('upper_hall', 10.8, 4.4, 'right'); L.spot('upper_corridor', 15.0, 8.0, 'right');
      L.spot('lisa_room', 21.4, 6.3, 'up'); L.spot('lisa_bed', 22.9, 3.0, 'right'); L.spot('lisa_desk', 20.2, 2.5, 'up');
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
      K.partition(8, 0, 9, 2.8, 4.6, 'wall_int_dark');
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
      K.shelf(9.8, 0.3, 2.4, 'shelf_jars', 2.2);
      K.table(11.6, 3.3, 2.2, 0.9, { top: 'cloth_red' });
      K.prop('needle_bundle', 11.0, 3.2, { y: 0.8 }); K.prop('needle_bundle', 11.9, 3.4, { y: 0.8, flip: true }); K.prop('vials', 11.5, 2.95, { y: 0.8 });
      K.candle(12.4, 0.8, 3.1, { scale: 0.9, radius: 4.2, intensity: 0.9 });   // a stub of candle by the needles: the evidence must read
      K.prop('jug', 13.2, 7.4, { collide: 0.2 }); K.prop('sack', 13.3, 6.6, { collide: 0.25 });
      // curtained sleeping alcove in the corner (the hiding place): plank bed, heavy curtain, a tall wardrobe closing its east side
      K.mb.box(8.6, 0, 7.45, 0.8, 0.38, 2.3, { all: 'wood_dark', top: 'blanket' }, { mat: MAT.WOOD }); L.box(8.15, 6.3, 9.0, 8.6, 'bed');
      K.mb.box(8.6, 0.38, 6.55, 0.7, 0.12, 0.4, { all: 'cloth_white' }, { mat: MAT.CLOTH });
      K.curtain(8.15, 9.75, 5.95, 2.05);
      K.mb.box(9.82, 0.04, 5.95, 0.2, 2.0, 0.22, { all: 'curtain' }, { mat: MAT.CLOTH, units: 1 });   // the drawn-aside panel
      K.wardrobe(11.0, 7.45, 0.7, 1.9, 'e', 2.25);
      K.prop('herbs_hang', 8.9, 6.1, { y: 2.2, mat: MAT.CLOTH, scale: 0.7 });
      // back door to the woods behind the house
      K.decal(12.9, 0, 0, 0.95, 1.9, 'door_dark', MAT.WOOD); K.mb.box(12.9, 1.9, 0.08, 1.2, 0.12, 0.14, { all: 'wood_dark' }, { mat: MAT.WOOD });
      K.mb.flat(12.9, 0.015, 0.7, 1.0, 0.9, 'floor_dirt', MAT.GROUND);
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
      L.spot('hide_in', 9.75, 7.55, 'left'); L.spot('hide_spot', 10.1, 5.2, 'down'); L.spot('back_door', 12.9, 1.0, 'up');
    },
    exits: [{ id: 'out', at: [3, 8.6], to: 'village', spawn: 'jaglika_door', label: 'loc.village', verb: 'verb.go' },
      { id: 'back', at: [12.9, 0.55], to: 'village', spawn: 'jaglika_back', label: 'loc.village', verb: 'verb.go' }]
  });

  /* ============ Church interior: tall nave, gilded iconostasis with royal doors, frescoes, horos ============ */
  interior('church', {
    nameKey: 'loc.church', bounds: [-1, -1, 11, 15], camBounds: [5, 4, 5, 9], mapParent: 'village', mapPos: [87, 22.5], music: 'silence',
    ambience: { interior: true, reverb: 0.75, reverbLen: 4.2, dogs: false },
    surface: function () { return 'stone'; },
    build: function (L) {
      var K = new Kit(L), MB = K.mb, WH = 6.2, IZ = 2.1;
      K.floor(0, 0, 10, 14, 'floor_stone');
      K.shell(0, 0, 10, 14, 'wall_plaster', { doors: [5], beams: false, h: WH });
      // stone wainscot and pilasters carrying the vault ribs
      MB.box(0.06, 0, 7, 0.12, 1.0, 14, { all: 'wall_stone', top: 'plaster_trim' }, { mat: MAT.STONE }); MB.box(9.94, 0, 7, 0.12, 1.0, 14, { all: 'wall_stone', top: 'plaster_trim' }, { mat: MAT.STONE });
      [6.3, 11.3].forEach(function (z) {
        [[0.18, 1], [9.82, -1]].forEach(function (w) {
          MB.box(w[0], 0, z, 0.36, 4.5, 0.6, { all: 'plaster_trim' }, { mat: MAT.STONE, ao: 0.7 });
          L.box(w[0] - 0.18, z - 0.3, w[0] + 0.18, z + 0.3, 'pilaster');
        });
      });
      // cornice where the (cut-away) barrel vault springs from the walls
      MB.box(0.14, 4.5, 7, 0.28, 0.2, 14, { all: 'plaster_trim' }, { mat: MAT.STONE }); MB.box(9.86, 4.5, 7, 0.28, 0.2, 14, { all: 'plaster_trim' }, { mat: MAT.STONE });
      // frescoes on the side walls: rows of saints between the pilasters, high windows above
      [[3.9, 'e', 0.03], [8.8, 'e', 0.03], [3.9, 'w', 9.97], [8.8, 'w', 9.97]].forEach(function (f) { K.sideDecal(f[2], 1.6, f[0], 3.6, 1.8, 'fresco_saints', f[1]); });
      [[12.6, 'e', 0.03], [12.6, 'w', 9.97]].forEach(function (f) { K.sideDecal(f[2], 1.6, f[0], 2.0, 1.4, 'icon_saint2', f[1]); });
      [5.0, 9.6].forEach(function (z) {
        K.sideDecal(0.03, 3.6, z, 0.55, 1.4, 'window_plain', 'e'); K.sideDecal(9.97, 3.6, z, 0.55, 1.4, 'window_plain', 'w');
        L.light(1.2, 3.8, z, [0.7, 0.75, 0.9], 5.5, 0.55, 'day'); L.light(8.8, 3.8, z, [0.7, 0.75, 0.9], 5.5, 0.55, 'day');
        L.statics.push({ beam: [[0.1, 4.2, z - 0.25], [0.1, 4.2, z + 0.25], [3.6, 0.02, z + 1.8], [3.0, 0.02, z + 0.8]], col: [1, 0.95, 0.85], day: true });
        L.statics.push({ beam: [[9.9, 4.2, z + 0.25], [9.9, 4.2, z - 0.25], [7.0, 0.02, z + 0.8], [6.4, 0.02, z + 1.8]], col: [1, 0.95, 0.85], day: true });
      });
      /* iconostasis: gilded screen of three tiers, royal doors in the middle, deacon doors at the sides */
      MB.box(5, 0, IZ - 0.15, 10, 4.7, 0.3, { all: 'wood_dark', top: 'gilt' }, { mat: MAT.WOOD }); L.box(0, 0, 10, IZ);
      [0.0, 2.55, 3.45, 4.35].forEach(function (y) { MB.box(5, y, IZ + 0.04, 10, 0.12, 0.1, { all: 'gilt' }, { mat: MAT.METAL }); });
      [0.12, 1.75, 2.85, 4.15, 5.85, 7.15, 8.25, 9.88].forEach(function (x) { MB.box(x, 0, IZ + 0.04, 0.16, 2.6, 0.1, { all: 'gilt' }, { mat: MAT.METAL }); });
      MB.decal(5, 0.02, IZ + 0.06, 1.6, 2.4, 's', 'royal_doors', MAT.METAL);
      MB.decal(2.3, 0.02, IZ + 0.06, 0.8, 1.95, 's', 'deacon_door', MAT.WOOD); MB.decal(7.7, 0.02, IZ + 0.06, 0.8, 1.95, 's', 'deacon_door', MAT.WOOD);
      [[3.5, 'icon_theotokos'], [6.5, 'icon_christ'], [0.95, 'icon_saint2'], [9.05, 'icon_fresco']].forEach(function (ic) { MB.decal(ic[0], 0.75, IZ + 0.06, 0.95, 1.45, 's', ic[1], MAT.DEFAULT); });
      MB.decal(2.6, 2.7, IZ + 0.06, 4.8, 0.7, 's', 'icon_row', MAT.DEFAULT); MB.decal(7.4, 2.7, IZ + 0.06, 4.8, 0.7, 's', 'icon_row', MAT.DEFAULT);
      MB.decal(2.6, 3.6, IZ + 0.06, 4.8, 0.7, 's', 'icon_row', MAT.DEFAULT); MB.decal(7.4, 3.6, IZ + 0.06, 4.8, 0.7, 's', 'icon_row', MAT.DEFAULT);
      MB.billboard(5, 4.7, IZ - 0.1, 'cross_wood', { scale: 2.6, mat: MAT.WOOD });
      // lampadas burning before Christ and the Theotokos
      [3.5, 6.5].forEach(function (x) { L.statics.push({ sprite: 'kandilo', x: x, y: 2.25, z: IZ + 0.45, scale: 1.3 }); L.statics.push({ sprite: 'flame', x: x, y: 2.62, z: IZ + 0.48, scale: 0.3, emissive: true, flicker: true, fire: true }); L.light(x, 2.6, IZ + 0.9, [1, 0.45, 0.3], 3.2, 0.6, 'fire', 0.2); });
      // apse conch with the Theotokos above the screen, a round window over it
      MB.decal(5, 4.75, 0.02, 4.2, 2.1, 's', 'fresco_apse', MAT.DEFAULT);
      [2.7, 7.3].forEach(function (x) { MB.box(x, 4.6, 0.12, 0.4, WH - 4.6, 0.24, { all: 'plaster_trim' }, { mat: MAT.STONE }); });
      // red runner from the door to the soleas
      MB.flat(5, 0.014, 8.2, 1.4, 11.6, 'rug_runner', MAT.CLOTH);
      /* stasidia (wall stalls) with tall backs along both walls */
      [2.9, 4.9, 7.6, 10.0].forEach(function (z) {
        [[0.55, 0.16], [9.45, 9.84]].forEach(function (b) {
          MB.box(b[0], 0.42, z, 0.5, 0.07, 1.4, { all: 'wood_light' }, { mat: MAT.WOOD }); MB.box(b[0], 0, z, 0.35, 0.42, 0.1, { all: 'wood_dark' }, { mat: MAT.WOOD });
          MB.box(b[1], 0, z, 0.1, 1.5, 1.45, { all: 'wood_dark' }, { mat: MAT.WOOD });
          MB.box(b[0], 0, z - 0.7, 0.5, 0.95, 0.06, { all: 'wood_dark' }, { mat: MAT.WOOD }); MB.box(b[0], 0, z + 0.7, 0.5, 0.95, 0.06, { all: 'wood_dark' }, { mat: MAT.WOOD });
          L.box(b[0] - 0.35, z - 0.72, b[0] + 0.3, z + 0.72);
        });
      });
      /* analoy with the feast icon, tall candlesticks before the screen */
      K.prop('analoy', 5, 4.6, { collide: 0.32, scale: 1.1 });
      [2.0, 8.0].forEach(function (x) { K.prop('candle_stand', x, 2.75, { collide: 0.22, scale: 1.1 }); L.statics.push({ sprite: 'flame', x: x, y: 2.08, z: 2.79, scale: 0.42, emissive: true, flicker: true, fire: true }); L.light(x, 2.4, 3.2, [1, 0.62, 0.3], 4.2, 0.85, 'fire', 0.18); });
      // sand tray for candles of the living (near the door) and a low one for the dead
      MB.box(3.0, 0, 11.4, 1.2, 0.9, 0.7, { all: 'metal', top: 'sand' }, { mat: MAT.METAL }); L.box(2.4, 11.05, 3.6, 11.75);
      for (var c = 0; c < 6; c++) K.candle(2.6 + (c % 3) * 0.4, 0.9, 11.2 + Math.floor(c / 3) * 0.35, { light: c === 0, radius: 4.5, intensity: 1.0 });
      MB.box(7.0, 0, 11.6, 1.2, 0.45, 0.7, { all: 'metal', top: 'sand' }, { mat: MAT.METAL }); L.box(6.4, 11.25, 7.6, 11.95);
      for (c = 0; c < 4; c++) K.candle(6.65 + c * 0.24, 0.45, 11.5 + (c % 2) * 0.2, { light: c === 1, radius: 3.2, intensity: 0.6, scale: 0.8 });
      // funeral candles at the head and foot of the bier keep the centre of the nave readable
      K.candle(3.7, 0, 6.6, { scale: 1.6, radius: 5, intensity: 1.1 }); K.candle(6.3, 0, 8.4, { scale: 1.6, radius: 5, intensity: 1.1 });
      /* horos: the great round chandelier hanging in the middle of the nave */
      var hy = 3.4, hz = 8.7;
      L.statics.push({ sprite: 'horos', x: 5, y: hy, z: hz, scale: 1.0 });
      [-1.1, 1.1].forEach(function (o) { L.beam(MB, 5 + o, hy + 0.45, hz, 5, WH + 0.6, hz - 0.4, 0.025, 'metal', { mat: MAT.METAL }); });
      for (var k = 0; k < 9; k++) L.statics.push({ sprite: 'flame', x: 5 - 1.08 + k * 0.266, y: hy + 0.55 - (k % 2) * 0.04, z: hz + 0.02, scale: 0.26, emissive: true, flicker: true, fire: true });
      L.light(5, hy + 0.4, hz + 0.4, [1, 0.72, 0.42], 7, 1.0, 'fire', 0.1);
      L.light(5, 3.2, 3.4, [1, 0.7, 0.4], 5, 0.7, 'fire', 0.12);
      K.door(5, 14);
      L.spot('door_in', 5, 12.8, 'up'); L.spot('altar', 5, 3.6, 'up'); L.spot('sava_spot', 5, 2.65, 'down'); L.spot('candles', 3.0, 12.6, 'up'); L.spot('bier', 5, 7.5, 'down');
      L.spot('analoy', 5, 5.5, 'up'); L.spot('candles_dead', 7.0, 12.7, 'up');
      L.spot('mourner1', 3.4, 9.0, 'up'); L.spot('mourner2', 6.6, 9.2, 'up'); L.spot('mourner3', 4.2, 10.4, 'up'); L.spot('mourner4', 7.2, 10.6, 'up'); L.spot('mourner5', 2.4, 7.6, 'right'); L.spot('default', 5, 12, 'up');
    },
    exits: [{ id: 'out', at: [5, 13.6], to: 'village', spawn: 'church_door', label: 'loc.village', verb: 'verb.go' }],
    examine: [
      { id: 'x_ch_icons', at: [3.5, 2.6], label: 'it.iconostasis', dlg: 'x_ch_icons' },
      { id: 'x_ch_candles', at: [3.0, 11.8], label: 'it.candles', dlg: 'x_ch_candles' },
      { id: 'x_ch_window', at: [1.0, 5.0], label: 'it.window', dlg: 'x_ch_window', hy: 3.6 }
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
