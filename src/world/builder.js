/* LocationBuilder: high-level construction kit used by location scripts — terrain, Balkan
   village houses, fences, stone walls, trees, props, lights, emitters, colliders and spots. */
'use strict';
BTS.LocationBuilder = function (def) {
  this.def = def;
  this.chunks = [];
  this.colliders = [];
  this.lights = [];
  this.emitters = [];
  this.spots = {};
  this.exits = [];
  this.houses = [];
  this.statics = [];       // animated static props (flames, banners) rendered as sprites each frame
  this.areas = [];         // named map areas {id, box}
  this.surfaces = [];      // footstep surface overrides {box, s}
  this.mapShapes = [];     // for the paper map: houses/roads/water
  this.mbProps = {};       // grid-cell -> MeshBuilder
  this.rnd = BTS.RNG(BTS.strHash(def.id));
  this.height = def.height || function () { return 0; };
  this.tileAt = def.tile || function () { return 'grass'; };
  this.aoBoxes = [];
  this.pads = [];          // raised walkable surfaces (terraces, stairs, bridge decks, upper storeys)
};
(function () {
  var LB = BTS.LocationBuilder.prototype;
  var MAT = BTS.MAT;

  LB.propMB = function (x, z) {
    var key = Math.floor(x / 16) + ',' + Math.floor(z / 16);
    return this.mbProps[key] || (this.mbProps[key] = new BTS.MeshBuilder());
  };
  LB.addChunk = function (mb, o) {
    var m = mb.build(); if (!m) return null;
    var c = { mesh: m, min: m.min, max: m.max, fade: 1, fadeGoal: 1, id: o && o.id, fadeable: o && o.fadeable, castShadow: !(o && o.noShadow) };
    this.chunks.push(c);
    return c;
  };
  LB.spot = function (name, x, z, dir) { this.spots[name] = { x: x, z: z, dir: dir || 'down' }; };
  LB.box = function (x0, z0, x1, z1, tag) { var c = { box: [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], tag: tag }; this.colliders.push(c); return c; };
  LB.circle = function (x, z, r, tag) { var c = { circle: [x, z, r], tag: tag }; this.colliders.push(c); return c; };
  LB.light = function (x, y, z, color, radius, intensity, kind, flicker, extra) {
    var l = { x: x, y: y, z: z, color: color, radius: radius || 5, intensity: intensity || 1, kind: kind || 'fire', flicker: flicker || 0 };
    if (extra) for (var k in extra) l[k] = extra[k];
    this.lights.push(l); return l;
  };
  LB.emitter = function (e) { this.emitters.push(e); return e; };
  LB.area = function (id, x0, z0, x1, z1) { this.areas.push({ id: id, box: [x0, z0, x1, z1] }); };

  /* ---------------- walkable heights ----------------
     pad: a raised surface the walkers stand on (y: number or function(x,z)); the highest pad wins over terrain.
     ramp: linear slope; up = walking direction that climbs ('n' = toward -z, 's' = +z, 'e' = +x, 'w' = -x). */
  LB.pad = function (x0, z0, x1, z1, y) { var p = { box: [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)], y: y }; this.pads.push(p); return p; };
  LB.ramp = function (x0, z0, x1, z1, up, yLow, yHigh) {
    var a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(z0, z1), d = Math.max(z0, z1);
    return this.pad(a, c, b, d, function (x, z) {
      var t = up === 'n' ? (d - z) / (d - c) : up === 's' ? (z - c) / (d - c) : up === 'e' ? (x - a) / (b - a) : (b - x) / (b - a);
      return yLow + (yHigh - yLow) * BTS.M.clamp(t, 0, 1);
    });
  };
  LB.walkHeight = function (base) {
    var pads = this.pads;
    return function (x, z) {
      var h = base(x, z);
      for (var i = 0; i < pads.length; i++) {
        var b = pads[i].box;
        if (x < b[0] || x > b[2] || z < b[1] || z > b[3]) continue;
        var v = typeof pads[i].y === 'function' ? pads[i].y(x, z) : pads[i].y;
        if (v > h) h = v;
      }
      return h;
    };
  };
  /* straight flight of steps over the footprint; up as in ramp. o: {tile, side, top, mb, base, sides:[left,right] (true = solid edge
     with collider), rail} — steps are solid blocks down to `base` (default: terrain under them - 0.2). */
  LB.stairs = function (x0, z0, x1, z1, up, yLow, yHigh, o) {
    o = o || {};
    var mb = o.mb || this.propMB((x0 + x1) / 2, (z0 + z1) / 2), H = this.height;
    var a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(z0, z1), d = Math.max(z0, z1);
    var alongZ = up === 'n' || up === 's', len = alongZ ? d - c : b - a;
    var n = o.steps || Math.max(2, Math.round((yHigh - yLow) / 0.2));
    var rise = (yHigh - yLow) / n, run = len / n;
    var faces = { all: o.side || 'stone_block', top: o.top || o.tile || 'stone_block' };
    for (var i = 0; i < n; i++) {
      var y1 = yLow + (i + 1) * rise, s0 = i * run, cx, cz, w, dd;
      // step i spans from the bottom edge (i*run) to the top edge of the flight (so lower steps are fronts of a solid block)
      if (up === 'n') { cz = d - s0 - (len - s0) / 2; dd = len - s0; cx = (a + b) / 2; w = b - a; }
      else if (up === 's') { cz = c + s0 + (len - s0) / 2; dd = len - s0; cx = (a + b) / 2; w = b - a; }
      else if (up === 'e') { cx = a + s0 + (len - s0) / 2; w = len - s0; cz = (c + d) / 2; dd = d - c; }
      else { cx = b - s0 - (len - s0) / 2; w = len - s0; cz = (c + d) / 2; dd = d - c; }
      var y0 = o.base !== undefined ? o.base : Math.min(H(a, c), H(b, c), H(a, d), H(b, d)) - 0.2;
      if (i > 0) y0 = yLow + i * rise - 0.02;
      mb.box(cx, y0, cz, w, y1 - y0, dd, faces, { mat: o.mat === undefined ? BTS.MAT.STONE : o.mat, ao: 0.7 });
    }
    this.ramp(a, c, b, d, up, yLow, yHigh);
    // side edges: thin colliders (and optional hand rails)
    var self = this, sides = o.sides || [true, true];
    var edges = alongZ ? [[a, c, a, d], [b, c, b, d]] : [[a, c, b, c], [a, d, b, d]];
    edges.forEach(function (e, k) {
      if (!sides[k]) return;
      if (alongZ) self.box(e[0] - 0.08, c + (up === 's' ? 0.35 : 0), e[0] + 0.08, d - (up === 'n' ? 0.35 : 0), 'stairs');
      else self.box(a + (up === 'e' ? 0.35 : 0), e[1] - 0.08, b - (up === 'w' ? 0.35 : 0), e[1] + 0.08, 'stairs');
      if (o.rail) {
        var m = Math.max(2, Math.round(len / 0.45));
        for (var q = 0; q <= m; q++) {
          var t = q / m, px = alongZ ? e[0] : a + (b - a) * t, pz = alongZ ? c + (d - c) * t : e[1];
          var tt = up === 'n' ? 1 - (pz - c) / (d - c) : up === 's' ? (pz - c) / (d - c) : up === 'e' ? (px - a) / (b - a) : 1 - (px - a) / (b - a);
          var py = yLow + (yHigh - yLow) * Math.min(1, Math.ceil(tt * n) / n);
          mb.post(px, py - 0.02, pz, 0.92, q === 0 || q === m ? 0.1 : 0.05, o.rail, { mat: BTS.MAT.WOOD });
        }
        var p0 = alongZ ? [e[0], up === 'n' ? d : c] : [up === 'e' ? a : b, e[1]], p1 = alongZ ? [e[0], up === 'n' ? c : d] : [up === 'e' ? b : a, e[1]];
        self.beam(mb, p0[0], yLow + 0.9, p0[1], p1[0], yHigh + 0.9, p1[1], 0.07, o.rail);
      }
    });
  };
  /* a thin square beam between two 3D points (hand rails, ropes, poles) */
  LB.beam = function (mb, xa, ya, za, xb, yb, zb, th, tile, o) {
    o = o || {};
    var dx = xb - xa, dz = zb - za, l = Math.hypot(dx, dz) || 1, nx = dz / l * th / 2, nz = -dx / l * th / 2, h = th / 2;
    var col = o.col, mat = o.mat === undefined ? BTS.MAT.WOOD : o.mat, u = Math.hypot(l, yb - ya);
    var c0 = o.wind ? [1, 1, 1, o.wind[0]] : col, c1 = o.wind ? [1, 1, 1, o.wind[1]] : col;
    var cs = [c0, c1, c1, c0];
    // front (toward camera) and top faces are enough for thin members seen from above
    mb.quad([[xa + nx, ya - h, za + nz], [xb + nx, yb - h, zb + nz], [xb + nx, yb + h, zb + nz], [xa + nx, ya + h, za + nz]], BTS.M.norm3([nx, 0.3, nz + 0.001]), [[0, 0.1], [u, 0.1], [u, 0], [0, 0]], tile, null, mat, cs);
    mb.quad([[xb - nx, yb - h, zb - nz], [xa - nx, ya - h, za - nz], [xa - nx, ya + h, za - nz], [xb - nx, yb + h, zb - nz]], BTS.M.norm3([-nx, 0.3, -nz + 0.001]), [[0, 0.1], [u, 0.1], [u, 0], [0, 0]], tile, null, mat, [c1, c0, c0, c1]);
    mb.quad([[xa - nx, ya + h, za - nz], [xa + nx, ya + h, za + nz], [xb + nx, yb + h, zb + nz], [xb - nx, yb + h, zb - nz]], [0, 1, 0], [[0, 0.1], [0.1, 0.1], [0.1, 0], [0, 0]], tile, null, mat, [c0, c0, c1, c1]);
  };
  /* sagging rope between two 3D points with little flags (bunting) and flowers; o: {sag, flags:[tiles], flagEvery, flowers, flowerEvery} */
  LB.bunting = function (a, b, o) {
    o = o || {};
    var mb = this.propMB((a[0] + b[0]) / 2, (a[2] + b[2]) / 2);
    var len = Math.hypot(b[0] - a[0], b[2] - a[2], b[1] - a[1]), sag = o.sag === undefined ? Math.min(1.4, len * 0.07) : o.sag;
    var n = Math.max(4, Math.round(len / 0.6));
    function at(t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]; }
    for (var i = 0; i < n; i++) {
      var p = at(i / n), q = at((i + 1) / n), wa = 0.15 * Math.sin(Math.PI * i / n), wb = 0.15 * Math.sin(Math.PI * (i + 1) / n);
      this.beam(mb, p[0], p[1], p[2], q[0], q[1], q[2], 0.04, o.rope || 'wood_dark', { wind: [wa, wb] });
    }
    var flags = o.flags || ['bunt_red', 'bunt_blue', 'bunt_white'], fe = o.flagEvery || 0.55, nf = Math.floor(len / fe);
    for (var k = 1; k < nf; k++) {
      var t = k / nf, f = at(t), fw = 0.16, fh = 0.34, wnd = 0.25 + 0.3 * Math.sin(Math.PI * t);
      var tile = flags[k % flags.length];
      var cb = [1, 1, 1, 0.12 * Math.sin(Math.PI * t)], ct = [1, 1, 1, wnd];
      mb.quad([[f[0] - fw, f[1], f[2]], [f[0] + fw, f[1], f[2]], [f[0], f[1] - fh, f[2] + 0.02], [f[0], f[1] - fh, f[2] + 0.02]], [0, 0.3, 1], [[0, 0], [1, 0], [0.5, 1], [0.5, 1]], tile, null, BTS.MAT.CLOTH, [cb, cb, ct, ct]);
    }
    if (o.flowers !== false) {
      var fl = o.flowerEvery || 1.3, nfl = Math.floor(len / fl);
      for (var j = 1; j < nfl; j++) { var g = at((j + 0.5) / nfl); if ((j + 0.5) / nfl >= 1) continue; mb.billboard(g[0], g[1] - 0.22, g[2] + 0.03, 'garland', { scale: 0.9, wind: 0.15, mat: BTS.MAT.FOLIAGE }); }
    }
  };

  /* ---------------- terrain ---------------- */
  LB.ground = function (x0, z0, x1, z1, o) {
    o = o || {};
    var H = this.height, self = this;
    var variants = { grass: ['grass0', 'grass1', 'grass2'], dirt: ['dirt0', 'dirt1'] };
    for (var cz = z0; cz < z1; cz += 16) for (var cx = x0; cx < x1; cx += 16) {
      var mb = new BTS.MeshBuilder(), water = new BTS.MeshBuilder();
      for (var z = cz; z < Math.min(cz + 16, z1); z++) for (var x = cx; x < Math.min(cx + 16, x1); x++) {
        var t = this.tileAt(x + 0.5, z + 0.5);
        if (!t) continue;
        var bx = Math.floor(x / 2), bz = Math.floor(z / 2);
        var name = t;
        if (variants[t]) name = variants[t][Math.floor(BTS.M.hash(bx * 3.1, bz * 7.7) * variants[t].length)];
        var h00 = H(x, z), h10 = H(x + 1, z), h11 = H(x + 1, z + 1), h01 = H(x, z + 1);
        var isWater = t === 'water';
        var wl = o.waterLevel === undefined ? -0.35 : o.waterLevel;
        if (isWater) { name = 'mud'; h00 = Math.min(h00, wl - 0.3); h10 = Math.min(h10, wl - 0.3); h11 = Math.min(h11, wl - 0.3); h01 = Math.min(h01, wl - 0.3); }
        var cols = [[x, z + 1], [x + 1, z + 1], [x + 1, z], [x, z]].map(function (p) { return self.groundTint(p[0], p[1], t); });
        var u0 = x / 2, v0 = z / 2;
        var nrm = BTS.M.norm3([h00 - h10 + h01 - h11, 2, h00 - h01 + h10 - h11]);
        mb.quad([[x, h01, z + 1], [x + 1, h11, z + 1], [x + 1, h10, z], [x, h00, z]], nrm,
          [[u0, v0 + 0.5], [u0 + 0.5, v0 + 0.5], [u0 + 0.5, v0], [u0, v0]], name, null, MAT.GROUND, cols);
        // smooth water surface: plane over water tiles and their neighbours; terrain above it hides the overlap
        var nearWater = Math.min(h00, h10, h11, h01) < wl;
        if (nearWater) water.quad([[x, wl, z + 1], [x + 1, wl, z + 1], [x + 1, wl, z], [x, wl, z]], [0, 1, 0], [[u0, v0 + 0.5], [u0 + 0.5, v0 + 0.5], [u0 + 0.5, v0], [u0, v0]], 'water', null, MAT.WATER);
      }
      var c = this.addChunk(mb, { id: 'ground' }); if (c) c.castShadow = false;
      var w = this.addChunk(water, { id: 'water' }); if (w) w.castShadow = false;
    }
  };
  /* low-frequency tint variation + ambient occlusion near walls */
  LB.groundTint = function (x, z, t) {
    var n = BTS.M.fbm(x * 0.08, z * 0.08, 3);
    var k = 0.86 + n * 0.28;
    var ao = 1;
    for (var i = 0; i < this.aoBoxes.length; i++) {
      var b = this.aoBoxes[i];
      var dx = Math.max(b[0] - x, 0, x - b[2]), dz = Math.max(b[1] - z, 0, z - b[3]);
      var d = Math.hypot(dx, dz);
      if (d < 1.1) ao = Math.min(ao, 0.55 + 0.45 * (d / 1.1));
    }
    var warm = t === 'grass' || t === 'grass_meadow' ? [1.0, 1.02, 0.95] : [1, 1, 1];
    return [k * ao * warm[0], k * ao * warm[1], k * ao * warm[2], 0];
  };

  /* ---------------- buildings ---------------- */
  /* o: {id,x,z,w,d,h,wall,base,roof,roofType:'gable'|'gable_z'|'hip',rise,door:{side,at,tile},windows:[{side,at,y,tile}],
        chimney:true|[dx,dz], lived:true, lit:true, beams:true, porch:true, shed:'w'|'e', mapLabel} */
  LB.house = function (o) {
    var mb = new BTS.MeshBuilder();
    var H = this.height;
    var x = o.x, z = o.z, w = o.w || 5, d = o.d || 4, wh = o.h || 2.6;
    var x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2;
    var hs = [H(x0, z0), H(x1, z0), H(x0, z1), H(x1, z1)];
    var floor = Math.max.apply(null, hs) + 0.15 + (o.raise || 0), low = Math.min.apply(null, hs) - 0.4;
    o.floor = floor;
    var wall = o.wall || 'wall_plaster', base = o.base || 'wall_stone_grey';
    var baseH = o.baseH === undefined ? 0.5 : o.baseH;
    var tint = o.tint || [1, 1, 1, 0];
    var wmat = /stone/.test(wall) ? MAT.STONE : /plank|timber/.test(wall) ? MAT.WOOD : MAT.PLASTER;
    // foundation band (stone) + walls
    if (baseH > 0) mb.box(x, low, z, w + 0.08, floor + baseH - low, d + 0.08, { all: base }, { mat: MAT.STONE, ao: 0.55 });
    mb.box(x, floor + baseH, z, w, wh - baseH, d, { all: wall }, { mat: wmat, col: tint, ao: 0.8 });
    if (o.beams) { // timber corner posts and lintel band
      [[x0, z1], [x1, z1], [x0, z0], [x1, z0]].forEach(function (c) { mb.post(c[0], floor, c[1], wh, 0.18, 'wood_dark', { mat: MAT.WOOD }); });
      mb.box(x, floor + wh - 0.14, z1 + 0.02, w + 0.1, 0.14, 0.06, { all: 'wood_dark' }, { mat: MAT.WOOD });
      mb.box(x, floor + baseH, z1 + 0.02, w + 0.1, 0.12, 0.06, { all: 'wood_dark' }, { mat: MAT.WOOD });
    }
    var roof = o.roof || 'roof_tile', rise = o.rise || Math.min(w, d) * 0.42;
    var ro = { mat: MAT.STONE, gableTile: o.gable || wall, gableCol: tint, gableMat: wmat, overhang: o.overhang, ridgeTile: o.ridge };
    if (o.roofType === 'hip') mb.hipRoof(x, z, w, d, floor + wh, rise, roof, ro);
    else if (o.roofType === 'gable_z') mb.gableRoof(x, z, w, d, floor + wh, rise, roof, Object.assign({ axis: 'z' }, ro));
    else mb.gableRoof(x, z, w, d, floor + wh, rise, roof, ro);
    // door
    var door = o.door || { side: 's', at: 0 };
    var doorPos = this.facePoint(o, door.side, door.at || 0);
    mb.decal(doorPos[0], floor, doorPos[1], 0.95, 1.9, door.side, door.tile || 'door', MAT.WOOD);
    // lintel + step
    var stepY = floor - 0.02;
    if (door.side === 's' && !o.noStep) { mb.box(doorPos[0], floor + 1.9, z1 + 0.05, 1.25, 0.14, 0.1, { all: 'wood_beam' }, { mat: MAT.WOOD }); mb.box(doorPos[0], H(doorPos[0], z1 + 0.4) - 0.1, z1 + 0.32, 1.2, stepY - H(doorPos[0], z1 + 0.4) + 0.12, 0.6, { all: 'stone_block' }, { mat: MAT.STONE }); }
    o.doorWorld = [doorPos[0] + (door.side === 'e' ? 0.6 : door.side === 'w' ? -0.6 : 0), doorPos[1] + (door.side === 's' ? 0.75 : door.side === 'n' ? -0.75 : 0)];
    // windows
    var self = this;
    (o.windows || []).forEach(function (win) {
      var p = self.facePoint(o, win.side, win.at);
      var wy = floor + (win.y || 1.0);
      var ww = win.w || 0.9, whh = win.h || 0.9;
      mb.decal(p[0], wy, p[1], ww, whh, win.side, win.tile || o.windowTile || 'window', MAT.GLASS);
      if (o.lit !== false && o.lived !== false) {
        var off = 0.7, lx = p[0], lz = p[1];
        if (win.side === 's') lz += off; else if (win.side === 'n') lz -= off; else if (win.side === 'e') lx += off; else lx -= off;
        self.light(lx, wy + 0.4, lz, [1.0, 0.62, 0.32], 3.4, 0.7, 'window', 0.05);
      }
    });
    // chimney + smoke
    if (o.chimney) {
      var cdx = Array.isArray(o.chimney) ? o.chimney[0] : w * 0.3, cdz = Array.isArray(o.chimney) ? o.chimney[1] : 0;
      var ctop = floor + wh + rise + 0.5;
      mb.box(x + cdx, floor + wh, z + cdz, 0.5, ctop - floor - wh, 0.5, { all: 'wall_stone_grey' }, { mat: MAT.STONE });
      mb.box(x + cdx, ctop, z + cdz, 0.62, 0.1, 0.62, { all: 'stone_block' }, { mat: MAT.STONE });
      if (o.lived !== false) this.emitter({ type: 'smoke', x: x + cdx, y: ctop + 0.15, z: z + cdz, rate: 1.4 });
    }
    // eave drips when wet
    if (!o.noDrip) this.emitter({ type: 'drip', x: x, y: floor + wh - 0.1, z: z1 + 0.42, area: [w, 0.05], rate: 3, fx: true });
    if (o.porch) {
      var pz = z1 + 0.9;
      [[x0 + 0.3, pz + 0.6], [x1 - 0.3, pz + 0.6]].forEach(function (c) { mb.post(c[0], H(c[0], c[1]), c[1], floor + wh - 0.25 - H(c[0], c[1]), 0.16, 'wood_beam', { mat: MAT.WOOD }); });
      mb.quad([[x0 - 0.1, floor + wh - 0.6, pz + 0.85], [x1 + 0.1, floor + wh - 0.6, pz + 0.85], [x1 + 0.1, floor + wh - 0.05, z1], [x0 - 0.1, floor + wh - 0.05, z1]], BTS.M.norm3([0, 1, 0.6]), [[0, 1], [w / 2, 1], [w / 2, 0], [0, 0]], o.porchRoof || 'roof_shingle', null, MAT.WOOD);
      mb.box(x, floor - 0.05, z1 + 0.85, w, 0.08, 1.7, { all: false, top: 'floor_wood' }, { mat: MAT.WOOD });
      (this.keepClear || (this.keepClear = [])).push([x0 - 0.2, z1, x1 + 0.2, z1 + 1.9]);   // no scattered bushes/grass on the porch deck
    }
    if (o.shed) {
      var sx = o.shed === 'e' ? x1 + 0.9 : x0 - 0.9, sw = 1.8, sd = d * 0.7, sz = z - d * 0.1;
      var sfloor = H(sx, sz);
      mb.box(sx, sfloor - 0.3, sz, sw, 1.9 + 0.3, sd, { all: 'wall_planks' }, { mat: MAT.WOOD });
      var hi = o.shed === 'e' ? -1 : 1;
      mb.quad([[sx - sw / 2 - 0.15, sfloor + 1.75, sz + sd / 2 + 0.2], [sx + sw / 2 + 0.15, sfloor + 1.75, sz + sd / 2 + 0.2], [sx + sw / 2 + 0.15, sfloor + 2.2, sz - sd / 2 - 0.2], [sx - sw / 2 - 0.15, sfloor + 2.2, sz - sd / 2 - 0.2]], BTS.M.norm3([0, 1, 0.3]), [[0, 1], [1, 1], [1, 0], [0, 0]], 'roof_shingle', null, MAT.WOOD);
      this.box(sx - sw / 2, sz - sd / 2, sx + sw / 2, sz + sd / 2, 'shed');
      this.aoBoxes.push([sx - sw / 2, sz - sd / 2, sx + sw / 2, sz + sd / 2]);
    }
    var ch = this.addChunk(mb, { id: o.id || 'house', fadeable: true });
    if (ch) { ch.house = o; ch.base = [x0, z0, x1, z1, floor + wh + rise]; }
    this.box(x0 - 0.04, z0 - 0.04, x1 + 0.04, z1 + 0.04, o.id || 'house');
    this.aoBoxes.push([x0, z0, x1, z1]);
    this.houses.push(o);
    this.mapShapes.push({ t: 'house', box: [x0, z0, x1, z1], id: o.id, label: o.mapLabel });
    return o;
  };
  LB.facePoint = function (o, side, at) {
    var w = o.w || 5, d = o.d || 4;
    if (side === 's') return [o.x + (at || 0), o.z + d / 2];
    if (side === 'n') return [o.x + (at || 0), o.z - d / 2];
    if (side === 'e') return [o.x + w / 2, o.z + (at || 0)];
    return [o.x - w / 2, o.z + (at || 0)];
  };

  /* ---------------- fences & walls ---------------- */
  LB.fence = function (pts, o) {
    o = o || {};
    var H = this.height;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var mb = this.propMB(a[0], a[1]);
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / (o.spacing || 1.2)));
      for (var k = 0; k <= n; k++) {
        if (k === n && i < pts.length - 2) continue;
        var t = k / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        var ph = (o.h || 1.0) + (BTS.M.hash(x, z) - 0.5) * 0.15;
        mb.post(x, H(x, z) - 0.1, z, ph + 0.1, 0.12, o.tile || 'wood_beam', { mat: MAT.WOOD });
      }
      if (o.pickets) {
        var np = Math.round(len / 0.28);
        for (var p = 0; p < np; p++) {
          var tt = (p + 0.5) / np, px = a[0] + (b[0] - a[0]) * tt, pz = a[1] + (b[1] - a[1]) * tt;
          if (o.gap && Math.abs(tt - o.gap) < 0.12 && i === (o.gapSeg || 0)) continue;
          mb.post(px, H(px, pz) - 0.05, pz, (o.h || 1) * (0.85 + BTS.M.hash(px, pz) * 0.2), 0.09, 'wood_light', { mat: MAT.WOOD });
        }
      }
      // rails as thin boxes along segment (approximate by small boxes)
      var rails = o.rails === undefined ? 2 : o.rails;
      for (var r = 0; r < rails; r++) {
        var ry = (o.h || 1.0) * (0.35 + r * 0.4);
        var seg = Math.max(1, Math.round(len / 0.5));
        for (var s = 0; s < seg; s++) {
          var t0 = s / seg, t1 = (s + 1) / seg;
          var xa = a[0] + (b[0] - a[0]) * t0, za = a[1] + (b[1] - a[1]) * t0, xb = a[0] + (b[0] - a[0]) * t1, zb = a[1] + (b[1] - a[1]) * t1;
          var ya = H(xa, za) + ry, yb = H(xb, zb) + ry;
          var nx = (zb - za), nz = -(xb - xa), nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
          var th = 0.05;
          mb.quad([[xa + nx * th, ya - 0.05, za + nz * th], [xb + nx * th, yb - 0.05, zb + nz * th], [xb + nx * th, yb + 0.05, zb + nz * th], [xa + nx * th, ya + 0.05, za + nz * th]], [nx, 0, nz], [[0, 0.1], [1, 0.1], [1, 0], [0, 0]], 'wood_beam', null, MAT.WOOD);
          mb.quad([[xb - nx * th, yb - 0.05, zb - nz * th], [xa - nx * th, ya - 0.05, za - nz * th], [xa - nx * th, ya + 0.05, za - nz * th], [xb - nx * th, yb + 0.05, zb - nz * th]], [-nx, 0, -nz], [[0, 0.1], [1, 0.1], [1, 0], [0, 0]], 'wood_beam', null, MAT.WOOD);
          mb.quad([[xa - nx * th, ya + 0.05, za - nz * th], [xa + nx * th, ya + 0.05, za + nz * th], [xb + nx * th, yb + 0.05, zb + nz * th], [xb - nx * th, yb + 0.05, zb - nz * th]], [0, 1, 0], [[0, 0.1], [0.1, 0.1], [0.1, 0], [0, 0]], 'wood_beam', null, MAT.WOOD);
        }
      }
      if (!o.noCollide) this.segCollider(a, b, 0.12);
    }
  };
  /* dry-stone wall like the curved wall in reference photo 2 */
  LB.stoneWall = function (pts, o) {
    o = o || {};
    var H = this.height, hgt = o.h || 0.9, th = o.th || 0.45;
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1], mb = this.propMB(a[0], a[1]);
      var len = Math.hypot(b[0] - a[0], b[1] - a[1]), seg = Math.max(1, Math.round(len / 0.7));
      var dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len, nx = dz, nz = -dx;
      for (var s = 0; s < seg; s++) {
        var t0 = s / seg, t1 = (s + 1) / seg;
        var xa = a[0] + (b[0] - a[0]) * t0, za = a[1] + (b[1] - a[1]) * t0, xb = a[0] + (b[0] - a[0]) * t1, zb = a[1] + (b[1] - a[1]) * t1;
        var ya = H(xa, za), yb = H(xb, zb);
        var hh = hgt * (0.92 + BTS.M.hash(xa, za) * 0.16);
        var u0 = (i * 10 + s) * 0.7;
        var tile = o.tile || 'wall_stone';
        mb.wall(xa + nx * th / 2, za + nz * th / 2, xb + nx * th / 2, zb + nz * th / 2, Math.min(ya, yb) - 0.2, Math.min(ya, yb) + hh, tile, { mat: MAT.STONE, u0: u0, ao: 0.5 });
        mb.wall(xb - nx * th / 2, zb - nz * th / 2, xa - nx * th / 2, za - nz * th / 2, Math.min(ya, yb) - 0.2, Math.min(ya, yb) + hh, tile, { mat: MAT.STONE, u0: u0, ao: 0.5 });
        var top = Math.min(ya, yb) + hh;
        mb.quad([[xa - nx * th / 2, top, za - nz * th / 2], [xa + nx * th / 2, top, za + nz * th / 2], [xb + nx * th / 2, top, zb + nz * th / 2], [xb - nx * th / 2, top, zb - nz * th / 2]], [0, 1, 0], [[0, 0.25], [0.25, 0.25], [0.25, 0], [0, 0]], 'wall_stone_grey', [0.9, 0.95, 0.85, 0], MAT.STONE);
        if (s === 0 || s === seg - 1) mb.wall(xa - nx * th / 2, za - nz * th / 2, xa + nx * th / 2, za + nz * th / 2, ya - 0.2, ya + hh, tile, { mat: MAT.STONE });
      }
      this.segCollider(a, b, th / 2 + 0.02);
    }
  };
  LB.segCollider = function (a, b, r) {
    var len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 0.5));
    for (var k = 0; k <= n; k++) { var t = k / n; this.circle(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r + 0.12, 'fence'); }
  };

  /* ---------------- vegetation & props ---------------- */
  LB.billboard = function (name, x, z, o) {
    o = o || {};
    var mb = this.propMB(x, z);
    var y = this.height(x, z) - (o.sink || 0.05) + (o.y || 0);
    var dims = mb.billboard(x, y, z, name, { scale: o.scale, wind: o.wind, col: o.col, flip: o.flip, mat: o.mat, lean: o.lean });
    if (o.collide) this.circle(x, z, o.collide, 'prop');
    return dims;
  };
  LB.tree = function (kind, x, z, o) {
    o = o || {};
    var s = (o.scale || 1) * (0.9 + this.rnd() * 0.25);
    var tint = 0.88 + this.rnd() * 0.2;
    this.billboard(kind, x, z, { scale: s, wind: o.wind === undefined ? 0.35 : o.wind, col: [tint, tint, tint * 0.97], flip: this.rnd() < 0.5, sink: 0.15 });
    if (o.collide !== false) this.circle(x, z, 0.35 * s, 'tree');
  };
  LB.scatter = function (names, x0, z0, x1, z1, count, o) {
    o = o || {};
    for (var i = 0; i < count; i++) {
      var x = x0 + this.rnd() * (x1 - x0), z = z0 + this.rnd() * (z1 - z0);
      if (o.avoid && o.avoid(x, z)) continue;
      var n = names[Math.floor(this.rnd() * names.length)];
      var sc = (o.scale || 1) * (0.8 + this.rnd() * 0.4), fl = this.rnd() < 0.5;   // drawn before the porch test so the random sequence is unchanged
      if (this.keepClear && this.keepClear.some(function (b) { return x > b[0] && x < b[2] && z > b[1] && z < b[3]; })) continue;
      this.billboard(n, x, z, { scale: sc, wind: o.wind === undefined ? 0.6 : o.wind, flip: fl, col: o.col, sink: 0.02 });
    }
  };
  LB.cylinder = function (mb, x, y, z, r, h, seg, tile, mat, o) {
    o = o || {};
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      mb.wall(x + Math.cos(a1) * r, z + Math.sin(a1) * r, x + Math.cos(a0) * r, z + Math.sin(a0) * r, y, y + h, tile, { mat: mat, u0: i * r * 0.9, ao: o.ao === undefined ? 0.6 : o.ao });
    }
    if (o.top) for (i = 0; i < seg; i++) {
      var b0 = i / seg * Math.PI * 2, b1 = (i + 1) / seg * Math.PI * 2;
      mb.tri([[x, y + h, z], [x + Math.cos(b0) * r, y + h, z + Math.sin(b0) * r], [x + Math.cos(b1) * r, y + h, z + Math.sin(b1) * r]], [0, 1, 0], [[0.5, 0.5], [0.5 + Math.cos(b0) * 0.5, 0.5 + Math.sin(b0) * 0.5], [0.5 + Math.cos(b1) * 0.5, 0.5 + Math.sin(b1) * 0.5]], o.top, null, o.topMat === undefined ? mat : o.topMat);
    }
  };
  /* covered stone well like reference photo 2 */
  LB.well = function (x, z) {
    var mb = this.propMB(x, z), y = this.height(x, z);
    this.cylinder(mb, x, y - 0.2, z, 0.75, 1.0, 10, 'wall_stone', MAT.STONE);
    this.cylinder(mb, x, y + 0.75, z, 0.55, 0.0, 10, 'water', MAT.WATER, { top: 'water', topMat: MAT.WATER });
    mb.flat(x, y + 0.5, z, 1.1, 1.1, 'water', MAT.WATER);
    mb.post(x - 0.8, y, z, 2.2, 0.14, 'wood_beam', { mat: MAT.WOOD }); mb.post(x + 0.8, y, z, 2.2, 0.14, 'wood_beam', { mat: MAT.WOOD });
    mb.box(x, y + 1.7, z, 1.7, 0.1, 0.1, { all: 'wood_dark' }, { mat: MAT.WOOD });
    mb.gableRoof(x, z, 1.9, 1.5, y + 2.15, 0.6, 'roof_shingle', { mat: MAT.WOOD, overhang: 0.15, gableTile: 'wall_planks' });
    mb.billboard(x + 0.2, y + 1.15, z + 0.1, 'well_bucket', { mat: MAT.WOOD });
    this.circle(x, z, 0.9, 'well');
    this.mapShapes.push({ t: 'well', x: x, z: z });
  };
  LB.table = function (x, z, w, d, o) {
    o = o || {};
    var mb = this.propMB(x, z), y = this.height(x, z) + (o.y || 0), h = o.h || 0.8;
    mb.box(x, y + h - 0.08, z, w, 0.08, d, { all: o.top || 'wood_light' }, { mat: MAT.WOOD });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) { mb.post(x + s[0] * (w / 2 - 0.08), y, z + s[1] * (d / 2 - 0.08), h - 0.08, 0.08, 'wood_dark', { mat: MAT.WOOD }); });
    if (o.cloth) mb.box(x, y + h - 0.3, z + d / 2 + 0.01, w + 0.04, 0.3, 0.02, { all: o.cloth, top: false }, { mat: MAT.CLOTH });
    if (o.collide !== false) this.box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'table');
    return y + h;
  };
  LB.bench = function (x, z, w, rot) {
    var mb = this.propMB(x, z), y = this.height(x, z);
    var bw = rot ? 0.45 : w, bd = rot ? w : 0.45;
    mb.box(x, y + 0.42, z, bw, 0.07, bd, { all: 'wood_light' }, { mat: MAT.WOOD });
    mb.box(x, y, z, rot ? 0.35 : 0.1, 0.42, rot ? 0.1 : 0.35, { all: 'wood_dark' }, { mat: MAT.WOOD });
    if (!rot) { mb.box(x - w / 2 + 0.15, y, z, 0.1, 0.42, 0.35, { all: 'wood_dark' }, { mat: MAT.WOOD }); mb.box(x + w / 2 - 0.15, y, z, 0.1, 0.42, 0.35, { all: 'wood_dark' }, { mat: MAT.WOOD }); }
    this.box(x - bw / 2, z - bd / 2, x + bw / 2, z + bd / 2, 'bench');
  };
  LB.crate = function (x, z, s, stack) {
    var mb = this.propMB(x, z), y = this.height(x, z) - 0.05;
    s = s || 0.7;
    for (var i = 0; i < (stack || 1); i++) mb.box(x + (i % 2) * 0.08, y + i * s, z, s, s, s, { all: 'wall_planks_brown' }, { mat: MAT.WOOD, units: 1.4 });
    this.box(x - s / 2, z - s / 2, x + s / 2, z + s / 2, 'crate');
  };
  LB.woodpile = function (x, z, w) {
    var mb = this.propMB(x, z), y = this.height(x, z);
    w = w || 2;
    mb.box(x, y - 0.05, z, w, 1.0, 0.7, { all: 'logs_end', top: 'bark' }, { mat: MAT.WOOD, units: 1 });
    mb.gableRoof(x, z, w + 0.2, 0.9, y + 1.15, 0.3, 'roof_shingle', { mat: MAT.WOOD, overhang: 0.1, gableTile: 'wood_dark' });
    this.box(x - w / 2, z - 0.35, x + w / 2, z + 0.35, 'woodpile');
  };
  LB.lanternPost = function (x, z, o) {
    o = o || {};
    this.billboard('lantern_post', x, z, { mat: MAT.WOOD, collide: 0.15 });
    var y = this.height(x, z);
    this.light(x, y + 1.85, z + 0.2, o.color || [1.0, 0.68, 0.35], o.radius || 8, o.intensity || 1.5, o.kind || 'lamp', 0.08);
    this.statics.push({ pool: [x, y + 0.04, z + 0.3, 2.6], col: [1, 0.6, 0.3], night: true });
    this.statics.push({ sprite: 'flame', x: x, y: y + 1.62, z: z + 0.05, scale: 0.5, emissive: true, flicker: true, night: o.kind !== 'fire' });
  };
  LB.brazier = function (x, z, o) {
    o = o || {};
    this.billboard('brazier', x, z, { mat: MAT.METAL, collide: 0.35, scale: o.scale || 1.3 });
    var y = this.height(x, z) + (o.scale || 1.3) * 0.62;
    this.light(x, y + 0.6, z + 0.2, [1.0, 0.55, 0.22], o.radius || 8, o.intensity || 1.8, 'fire', 0.25);
    this.statics.push({ pool: [x, this.height(x, z) + 0.04, z + 0.3, 3], col: [1, 0.5, 0.2] });
    this.statics.push({ sprite: 'flame', x: x, y: y - 0.05, z: z + 0.02, scale: 1.6, emissive: true, flicker: true, fire: true });
    this.emitter({ type: 'embers', x: x, y: y + 0.2, z: z, rate: 3, fx: true });
  };
  LB.bonfire = function (x, z) {
    this.billboard('bonfire', x, z, { mat: MAT.WOOD, scale: 1.6 });
    var y = this.height(x, z);
    this.circle(x, z, 0.9, 'fire');
    this.light(x, y + 1.2, z + 0.3, [1.0, 0.52, 0.2], 11, 2.2, 'fire', 0.3, { important: true });
    this.statics.push({ sprite: 'flame', x: x - 0.25, y: y + 0.2, z: z + 0.05, scale: 2.6, emissive: true, flicker: true, fire: true });
    this.statics.push({ sprite: 'flame', x: x + 0.25, y: y + 0.15, z: z + 0.1, scale: 2.0, emissive: true, flicker: true, fire: true });
    this.emitter({ type: 'embers', x: x, y: y + 1, z: z, rate: 9, area: [0.6, 0.6] });
    this.statics.push({ pool: [x, y + 0.04, z, 5.5], col: [1, 0.45, 0.15] });
    this.emitter({ type: 'smoke', x: x, y: y + 1.8, z: z, rate: 2, col: [0.4, 0.38, 0.38] });
  };

  LB.finish = function () {
    var self = this;
    if (this.pads.length) this.height = this.walkHeight(this.height);
    Object.keys(this.mbProps).forEach(function (k) { self.addChunk(self.mbProps[k], { id: 'props' }); });
    return this;
  };
})();
