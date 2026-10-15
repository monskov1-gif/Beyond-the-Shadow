/* MeshBuilder: accumulates interleaved vertices (pos3 nrm3 uv2 tile4 col4 mat1 = 17 floats).
   tile = atlas rect, uv = repeat coordinates (fract'ed in the shader). */
'use strict';
BTS.MAT = { DEFAULT: 0, STONE: 1, WOOD: 2, CLOTH: 3, METAL: 4, GLASS: 5, GROUND: 6, WATER: 7, FOLIAGE: 8, EMISSIVE: 9, SPRITE: 10, PLASTER: 11 };
BTS.LAYOUT = [['aPos', 3], ['aNrm', 3], ['aUV', 2], ['aTile', 4], ['aCol', 4], ['aMat', 1]];
BTS.STRIDE = 17;

BTS.MeshBuilder = function () {
  this.v = [];
  this.min = [1e9, 1e9, 1e9]; this.max = [-1e9, -1e9, -1e9];
};
(function () {
  var MB = BTS.MeshBuilder.prototype;
  var DEFCOL = [1, 1, 1, 0];

  function region(t) { return typeof t === 'string' ? BTS.Atlas.get(t) : t; }

  MB.vert = function (x, y, z, nx, ny, nz, u, v, r, col, mat) {
    var c = col || DEFCOL;
    this.v.push(x, y, z, nx, ny, nz, u, v, r.u0, r.v0, r.du, r.dv, c[0], c[1], c[2], c[3] === undefined ? 0 : c[3], mat || 0);
    if (x < this.min[0]) this.min[0] = x; if (y < this.min[1]) this.min[1] = y; if (z < this.min[2]) this.min[2] = z;
    if (x > this.max[0]) this.max[0] = x; if (y > this.max[1]) this.max[1] = y; if (z > this.max[2]) this.max[2] = z;
  };
  /* quad from 4 corners (counter-clockwise seen from the front), uv per corner; cols optional per corner */
  MB.quad = function (p, n, uv, tile, col, mat, cols) {
    var r = region(tile);
    var c0 = cols ? cols[0] : col, c1 = cols ? cols[1] : col, c2 = cols ? cols[2] : col, c3 = cols ? cols[3] : col;
    this.vert(p[0][0], p[0][1], p[0][2], n[0], n[1], n[2], uv[0][0], uv[0][1], r, c0, mat);
    this.vert(p[1][0], p[1][1], p[1][2], n[0], n[1], n[2], uv[1][0], uv[1][1], r, c1, mat);
    this.vert(p[2][0], p[2][1], p[2][2], n[0], n[1], n[2], uv[2][0], uv[2][1], r, c2, mat);
    this.vert(p[0][0], p[0][1], p[0][2], n[0], n[1], n[2], uv[0][0], uv[0][1], r, c0, mat);
    this.vert(p[2][0], p[2][1], p[2][2], n[0], n[1], n[2], uv[2][0], uv[2][1], r, c2, mat);
    this.vert(p[3][0], p[3][1], p[3][2], n[0], n[1], n[2], uv[3][0], uv[3][1], r, c3, mat);
  };
  MB.tri = function (p, n, uv, tile, col, mat) {
    var r = region(tile);
    for (var i = 0; i < 3; i++) this.vert(p[i][0], p[i][1], p[i][2], n[0], n[1], n[2], uv[i][0], uv[i][1], r, col, mat);
  };

  /* Vertical wall segment from (x0,z0) to (x1,z1), facing to the right of the direction (outward for CCW footprints). */
  MB.wall = function (x0, z0, x1, z1, y0, y1, tile, o) {
    o = o || {};
    var r = region(tile), units = o.units || r.units || 2;
    var dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    var nx = -dz / len, nz = dx / len;
    var u0 = (o.u0 || 0) / units, u1 = u0 + len / units;
    var v0 = (o.v0 || 0) / units, v1 = v0 + (y1 - y0) / units;
    var base = o.col || [1, 1, 1, 0];
    var ao = o.ao === undefined ? 0.62 : o.ao;
    var bot = [base[0] * ao, base[1] * ao, base[2] * ao, 0], top = [base[0], base[1], base[2], 0];
    if (o.y0b !== undefined) { // sloped bottom edge (terrain)
      this.quad([[x0, o.y0a, z0], [x1, o.y0b, z1], [x1, y1, z1], [x0, y1, z0]], [nx, 0, nz],
        [[u0, v0 + (y1 - o.y0a) / units], [u1, v0 + (y1 - o.y0b) / units], [u1, v0], [u0, v0]], r, null, o.mat, [bot, bot, top, top]);
      return;
    }
    // v grows downward in atlas: map top of wall to v=0
    this.quad([[x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]], [nx, 0, nz],
      [[u0, v1], [u1, v1], [u1, v0], [u0, v0]], r, null, o.mat, [bot, bot, top, top]);
  };

  /* Axis-aligned box. faces: {top,bottom,n,s,e,w} tiles (string) or false to skip. */
  MB.box = function (x, y, z, w, h, d, faces, o) {
    o = o || {};
    var t = typeof faces === 'string' ? { all: faces } : faces;
    function f(k) { return t[k] === undefined ? t.all : t[k]; }
    var x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y0 = y, y1 = y + h;
    var wo = { mat: o.mat, col: o.col, ao: o.ao === undefined ? 0.85 : o.ao, units: o.units };
    if (f('s')) this.wall(x0, z1, x1, z1, y0, y1, f('s'), wo);      // south faces +z (camera)
    if (f('n')) this.wall(x1, z0, x0, z0, y0, y1, f('n'), wo);
    if (f('e')) this.wall(x1, z1, x1, z0, y0, y1, f('e'), wo);
    if (f('w')) this.wall(x0, z0, x0, z1, y0, y1, f('w'), wo);
    if (f('top')) {
      var r = region(f('top')), u = o.units || r.units || 2;
      var c = o.col ? [o.col[0], o.col[1], o.col[2], 0] : null;
      this.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[0, d / u], [w / u, d / u], [w / u, 0], [0, 0]], r, c, o.mat);
    }
  };

  /* Gable roof over rectangle; ridge along X (axis='x') or Z. overhang added. */
  MB.gableRoof = function (x, z, w, d, yEave, rise, tile, o) {
    o = o || {};
    var oh = o.overhang === undefined ? 0.35 : o.overhang;
    var r = region(tile), u = r.units || 2;
    var col = o.col || [1, 1, 1, 0];
    var gable = o.gableTile || 'wall_plaster';
    if (o.axis === 'z') {
      var xa = x - w / 2 - oh, xb = x + w / 2 + oh, za = z - d / 2 - oh, zb = z + d / 2 + oh, yr = yEave + rise;
      var slope = Math.hypot(w / 2 + oh, rise);
      // west slope (faces -x,+y)
      var n1 = BTS.M.norm3([-rise, w / 2 + oh, 0]);
      this.quad([[xa, yEave - oh * rise / (w / 2), za], [xa, yEave - oh * rise / (w / 2), zb], [x, yr, zb], [x, yr, za]], n1,
        [[0, slope / u], [(d + 2 * oh) / u, slope / u], [(d + 2 * oh) / u, 0], [0, 0]], r, col, o.mat);
      var n2 = BTS.M.norm3([rise, w / 2 + oh, 0]);
      this.quad([[xb, yEave - oh * rise / (w / 2), zb], [xb, yEave - oh * rise / (w / 2), za], [x, yr, za], [x, yr, zb]], n2,
        [[0, slope / u], [(d + 2 * oh) / u, slope / u], [(d + 2 * oh) / u, 0], [0, 0]], r, C(col, 0.82), o.mat);
      // gable triangles at z faces
      var g = region(gable), gu = g.units || 2;
      this.tri([[x - w / 2, yEave, z + d / 2], [x + w / 2, yEave, z + d / 2], [x, yr, z + d / 2]], [0, 0, 1], [[0, rise / gu], [w / gu, rise / gu], [w / 2 / gu, 0]], g, o.gableCol, o.gableMat);
      this.tri([[x + w / 2, yEave, z - d / 2], [x - w / 2, yEave, z - d / 2], [x, yr, z - d / 2]], [0, 0, -1], [[0, rise / gu], [w / gu, rise / gu], [w / 2 / gu, 0]], g, o.gableCol, o.gableMat);
      this.ridge(x, yr, za, x, yr, zb, o);
    } else {
      var xa2 = x - w / 2 - oh, xb2 = x + w / 2 + oh, za2 = z - d / 2 - oh, zb2 = z + d / 2 + oh, yr2 = yEave + rise;
      var slope2 = Math.hypot(d / 2 + oh, rise);
      var dropS = oh * rise / (d / 2);
      // south slope faces camera
      var ns = BTS.M.norm3([0, d / 2 + oh, rise]);
      this.quad([[xa2, yEave - dropS, zb2], [xb2, yEave - dropS, zb2], [xb2, yr2, z], [xa2, yr2, z]], ns,
        [[0, slope2 / u], [(w + 2 * oh) / u, slope2 / u], [(w + 2 * oh) / u, 0], [0, 0]], r, col, o.mat);
      var nn = BTS.M.norm3([0, d / 2 + oh, -rise]);
      this.quad([[xb2, yEave - dropS, za2], [xa2, yEave - dropS, za2], [xa2, yr2, z], [xb2, yr2, z]], nn,
        [[0, slope2 / u], [(w + 2 * oh) / u, slope2 / u], [(w + 2 * oh) / u, 0], [0, 0]], r, C(col, 0.7), o.mat);
      var g2 = region(gable), gu2 = g2.units || 2;
      this.tri([[x + w / 2, yEave, z + d / 2], [x + w / 2, yEave, z - d / 2], [x + w / 2, yr2, z]], [1, 0, 0], [[0, rise / gu2], [d / gu2, rise / gu2], [d / 2 / gu2, 0]], g2, o.gableCol, o.gableMat);
      this.tri([[x - w / 2, yEave, z - d / 2], [x - w / 2, yEave, z + d / 2], [x - w / 2, yr2, z]], [-1, 0, 0], [[0, rise / gu2], [d / gu2, rise / gu2], [d / 2 / gu2, 0]], g2, o.gableCol, o.gableMat);
      // eave thickness strip under south edge (fascia)
      this.quad([[xa2, yEave - dropS - 0.12, zb2], [xb2, yEave - dropS - 0.12, zb2], [xb2, yEave - dropS, zb2], [xa2, yEave - dropS, zb2]], [0, 0, 1], [[0, 0.06], [(w + 2 * oh), 0.06], [(w + 2 * oh), 0], [0, 0]], 'wood_dark', null, BTS.MAT.WOOD);
      this.ridge(xa2, yr2, z, xb2, yr2, z, o);
    }
  };
  /* Hip roof (4 slopes) — used for some houses for variety */
  MB.hipRoof = function (x, z, w, d, yEave, rise, tile, o) {
    o = o || {};
    var oh = o.overhang === undefined ? 0.35 : o.overhang;
    var r = region(tile), u = r.units || 2, col = o.col || [1, 1, 1, 0];
    var xa = x - w / 2 - oh, xb = x + w / 2 + oh, za = z - d / 2 - oh, zb = z + d / 2 + oh, yr = yEave + rise;
    var ridgeHalf = Math.max(0, (w - d) / 2);
    var r0 = [x - ridgeHalf, yr, z], r1 = [x + ridgeHalf, yr, z];
    var ye = yEave - oh * 0.5;
    var ns = BTS.M.norm3([0, 1, rise / (d / 2)]);
    this.quad([[xa, ye, zb], [xb, ye, zb], r1, r0], ns, [[0, (d / 2 + oh) / u], [(w + 2 * oh) / u, (d / 2 + oh) / u], [(w / 2 + oh + ridgeHalf) / u, 0], [(w / 2 + oh - ridgeHalf) / u, 0]], r, col, o.mat);
    this.quad([[xb, ye, za], [xa, ye, za], r0, r1], BTS.M.norm3([0, 1, -rise / (d / 2)]), [[0, (d / 2 + oh) / u], [(w + 2 * oh) / u, (d / 2 + oh) / u], [(w / 2 + oh + ridgeHalf) / u, 0], [(w / 2 + oh - ridgeHalf) / u, 0]], r, C(col, 0.7), o.mat);
    this.tri([[xb, ye, zb], [xb, ye, za], r1], BTS.M.norm3([1, 1, 0]), [[0, 1], [(d + 2 * oh) / u, 1], [(d / 2 + oh) / u, 0]], r, C(col, 0.85), o.mat);
    this.tri([[xa, ye, za], [xa, ye, zb], r0], BTS.M.norm3([-1, 1, 0]), [[0, 1], [(d + 2 * oh) / u, 1], [(d / 2 + oh) / u, 0]], r, C(col, 0.95), o.mat);
  };
  MB.ridge = function (x0, y, z0, x1, y1, z1, o) {
    var w = 0.16;
    if (Math.abs(x1 - x0) > Math.abs(z1 - z0)) this.box((x0 + x1) / 2, y - 0.05, z0, Math.abs(x1 - x0), 0.14, w * 2, { all: o.ridgeTile || 'roof_tile_brown', bottom: false }, { mat: o.mat });
    else this.box(x0, y - 0.05, (z0 + z1) / 2, w * 2, 0.14, Math.abs(z1 - z0), { all: o.ridgeTile || 'roof_tile_brown', bottom: false }, { mat: o.mat });
  };
  function C(c, k) { return [c[0] * k, c[1] * k, c[2] * k, c[3] || 0]; }

  /* Decal on a wall plane facing +z/-z/+x/-x: rect centred at (x,y,z) */
  MB.decal = function (x, y, z, w, h, facing, tile, mat, col) {
    var r = region(tile), e = 0.02;
    var q = 0.9999;
    if (facing === 's') this.quad([[x - w / 2, y, z + e], [x + w / 2, y, z + e], [x + w / 2, y + h, z + e], [x - w / 2, y + h, z + e]], [0, 0, 1], [[0, q], [q, q], [q, 0], [0, 0]], r, col, mat);
    else if (facing === 'n') this.quad([[x + w / 2, y, z - e], [x - w / 2, y, z - e], [x - w / 2, y + h, z - e], [x + w / 2, y + h, z - e]], [0, 0, -1], [[0, q], [q, q], [q, 0], [0, 0]], r, col, mat);
    else if (facing === 'e') this.quad([[x + e, y, z + w / 2], [x + e, y, z - w / 2], [x + e, y + h, z - w / 2], [x + e, y + h, z + w / 2]], [1, 0, 0], [[0, q], [q, q], [q, 0], [0, 0]], r, col, mat);
    else this.quad([[x - e, y, z - w / 2], [x - e, y, z + w / 2], [x - e, y + h, z + w / 2], [x - e, y + h, z - w / 2]], [-1, 0, 0], [[0, q], [q, q], [q, 0], [0, 0]], r, col, mat);
  };
  /* flat decal lying on ground/top surface */
  MB.flat = function (x, y, z, w, d, tile, mat, col, rot) {
    var r = region(tile), q = 0.9999;
    if (rot) this.quad([[x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2], [x + w / 2, y, z - d / 2], [x - w / 2, y, z - d / 2]], [0, 1, 0], [[q, q], [q, 0], [0, 0], [0, q]], r, col, mat);
    else this.quad([[x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2], [x + w / 2, y, z - d / 2], [x - w / 2, y, z - d / 2]], [0, 1, 0], [[0, q], [q, q], [q, 0], [0, 0]], r, col, mat);
  };
  /* Camera-facing (XY-plane) billboard anchored at bottom centre. scale: world units per texel (1/16 default). */
  MB.billboard = function (x, y, z, tile, o) {
    o = o || {};
    var r = region(tile), s = (o.scale || 1) / 16;
    var w = r.w * s, h = r.h * s, q = 0.9999;
    var wind = o.wind || 0, col = o.col || [1, 1, 1];
    var lean = o.lean || 0; // tilt toward camera (z) at top
    var cb = [col[0], col[1], col[2], 0], ct = [col[0], col[1], col[2], wind];
    var fx = o.flip ? 1 : 0;
    var nrm = o.nrm || [0, 0.25, 1];
    this.quad([[x - w / 2, y, z], [x + w / 2, y, z], [x + w / 2, y + h, z + lean], [x - w / 2, y + h, z + lean]], nrm,
      [[fx ? q : 0, q], [fx ? 0 : q, q], [fx ? 0 : q, 0], [fx ? q : 0, 0]], r, null, o.mat === undefined ? BTS.MAT.FOLIAGE : o.mat, [cb, cb, ct, ct]);
    return { w: w, h: h };
  };
  /* thin cylinder-ish post approximated by a box */
  MB.post = function (x, y, z, h, thick, tile, o) { this.box(x, y, z, thick, h, thick, { all: tile, bottom: false }, o); };

  MB.count = function () { return this.v.length / BTS.STRIDE; };
  MB.build = function () {
    if (!this.v.length) return null;
    var m = BTS.GL.mesh(BTS.LAYOUT, new Float32Array(this.v), false);
    m.min = this.min.slice(); m.max = this.max.slice();
    return m;
  };
  MB.append = function (other) {
    for (var i = 0; i < other.v.length; i++) this.v.push(other.v[i]);
    for (var k = 0; k < 3; k++) { this.min[k] = Math.min(this.min[k], other.min[k]); this.max[k] = Math.max(this.max[k], other.max[k]); }
  };
})();
