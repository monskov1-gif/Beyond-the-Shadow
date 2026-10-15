/* Collision (circle vs boxes/circles), grid navigation (A* + smoothing), triggers. */
'use strict';
BTS.Physics = (function () {
  var M = BTS.M;
  var P = {};

  /* collider: {box:[x0,z0,x1,z1]} or {circle:[x,z,r]} */
  P.resolve = function (ent, colliders, dynamic) {
    var r = ent.radius || 0.3;
    for (var pass = 0; pass < 3; pass++) {
      var moved = false;
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        if (c.off) continue;
        if (c.box) {
          var b = c.box;
          var cx = M.clamp(ent.x, b[0], b[2]), cz = M.clamp(ent.z, b[1], b[3]);
          var dx = ent.x - cx, dz = ent.z - cz, d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 > 1e-8) { var d = Math.sqrt(d2), push = r - d; ent.x += dx / d * push; ent.z += dz / d * push; }
            else { // centre inside box: push out along smallest axis
              var l = ent.x - b[0], rr = b[2] - ent.x, t = ent.z - b[1], bb = b[3] - ent.z;
              var m = Math.min(l, rr, t, bb);
              if (m === l) ent.x = b[0] - r; else if (m === rr) ent.x = b[2] + r; else if (m === t) ent.z = b[1] - r; else ent.z = b[3] + r;
            }
            moved = true;
          }
        } else if (c.circle) {
          var q = c.circle, ex = ent.x - q[0], ez = ent.z - q[1], dd = Math.hypot(ex, ez), rad = q[2] + r;
          if (dd < rad) { if (dd < 1e-4) { ex = 1; ez = 0; dd = 1; } ent.x = q[0] + ex / dd * rad; ent.z = q[1] + ez / dd * rad; moved = true; }
        }
      }
      if (dynamic) for (var k = 0; k < dynamic.length; k++) {
        var o = dynamic[k]; if (o === ent || !o.solid || o.hidden) continue;
        var ox = ent.x - o.x, oz = ent.z - o.z, od = Math.hypot(ox, oz), orad = (o.radius || 0.3) + r;
        if (od < orad && od > 1e-4) { var pp = (orad - od) * (ent.isPlayer ? 1 : 0.5); ent.x += ox / od * pp; ent.z += oz / od * pp; moved = true; }
      }
      if (!moved) break;
    }
  };
  P.pointBlocked = function (x, z, r, colliders) {
    for (var i = 0; i < colliders.length; i++) {
      var c = colliders[i]; if (c.off) continue;
      if (c.box) { var b = c.box; if (x > b[0] - r && x < b[2] + r && z > b[1] - r && z < b[3] + r) return true; }
      else if (c.circle) { if (Math.hypot(x - c.circle[0], z - c.circle[1]) < c.circle[2] + r) return true; }
    }
    return false;
  };

  /* ---------- navigation grid ---------- */
  P.NavGrid = function (bounds, colliders, cell, inflate) {
    this.cell = cell || 0.5;
    this.x0 = bounds[0]; this.z0 = bounds[1];
    this.w = Math.ceil((bounds[2] - bounds[0]) / this.cell); this.h = Math.ceil((bounds[3] - bounds[1]) / this.cell);
    this.block = new Uint8Array(this.w * this.h);
    var inf = inflate === undefined ? 0.3 : inflate;
    for (var j = 0; j < this.h; j++) for (var i = 0; i < this.w; i++) {
      var x = this.x0 + (i + 0.5) * this.cell, z = this.z0 + (j + 0.5) * this.cell;
      this.block[j * this.w + i] = P.pointBlocked(x, z, inf, colliders) ? 1 : 0;
    }
  };
  var NG = P.NavGrid.prototype;
  NG.toCell = function (x, z) { return [Math.floor((x - this.x0) / this.cell), Math.floor((z - this.z0) / this.cell)]; };
  NG.center = function (i, j) { return [this.x0 + (i + 0.5) * this.cell, this.z0 + (j + 0.5) * this.cell]; };
  NG.free = function (i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && !this.block[j * this.w + i]; };
  NG.nearestFree = function (i, j) {
    if (this.free(i, j)) return [i, j];
    for (var r = 1; r < 12; r++) for (var dj = -r; dj <= r; dj++) for (var di = -r; di <= r; di++) {
      if (Math.abs(di) !== r && Math.abs(dj) !== r) continue;
      if (this.free(i + di, j + dj)) return [i + di, j + dj];
    }
    return null;
  };
  NG.lineFree = function (ax, az, bx, bz) {
    var d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (this.cell * 0.5));
    for (var k = 0; k <= n; k++) {
      var t = n ? k / n : 0, c = this.toCell(ax + (bx - ax) * t, az + (bz - az) * t);
      if (!this.free(c[0], c[1])) return false;
    }
    return true;
  };
  NG.find = function (ax, az, bx, bz) {
    var s = this.nearestFree.apply(this, this.toCell(ax, az)), g = this.nearestFree.apply(this, this.toCell(bx, bz));
    if (!s || !g) return null;
    var W = this.w, start = s[1] * W + s[0], goal = g[1] * W + g[0];
    var open = [start], came = new Int32Array(W * this.h).fill(-1), gs = new Float32Array(W * this.h).fill(1e9), closed = new Uint8Array(W * this.h);
    gs[start] = 0;
    var fsc = {}; fsc[start] = Math.hypot(g[0] - s[0], g[1] - s[1]);
    var iter = 0;
    while (open.length && iter++ < 20000) {
      var bi = 0; for (var q = 1; q < open.length; q++) if (fsc[open[q]] < fsc[open[bi]]) bi = q;
      var cur = open[bi]; open[bi] = open[open.length - 1]; open.pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      var ci = cur % W, cj = (cur / W) | 0;
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        var ni = ci + di, nj = cj + dj;
        if (!this.free(ni, nj)) continue;
        if (di && dj && (!this.free(ci + di, cj) || !this.free(ci, cj + dj))) continue;
        var nidx = nj * W + ni; if (closed[nidx]) continue;
        var ng = gs[cur] + (di && dj ? 1.414 : 1);
        if (ng < gs[nidx]) { gs[nidx] = ng; came[nidx] = cur; fsc[nidx] = ng + Math.hypot(g[0] - ni, g[1] - nj); open.push(nidx); }
      }
    }
    if (came[goal] < 0 && goal !== start) return null;
    var path = [], c = goal;
    while (c !== start && c >= 0) { path.push(this.center(c % W, (c / W) | 0)); c = came[c]; }
    path.reverse();
    if (path.length) path[path.length - 1] = [bx, bz];
    // string-pulling smoothing
    var out = [], from = [ax, az], k = 0;
    while (k < path.length) {
      var far = k;
      for (var t = path.length - 1; t > k; t--) if (this.lineFree(from[0], from[1], path[t][0], path[t][1])) { far = t; break; }
      out.push(path[far]); from = path[far]; k = far + 1;
    }
    return out;
  };
  return P;
})();
