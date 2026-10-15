/* Texture atlas + pixel painter. Every texture in the game is painted procedurally
   into one 2048x2048 atlas at boot (see textures.js / sprites.js). */
'use strict';
BTS.Atlas = (function () {
  var SIZE = 2048;
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  var regions = {};
  var shelfX = 0, shelfY = 0, shelfH = 0;
  var PAD = 2;

  function alloc(name, w, h) {
    if (regions[name]) return regions[name];
    if (shelfX + w + PAD > SIZE) { shelfX = 0; shelfY += shelfH + PAD; shelfH = 0; }
    if (shelfY + h > SIZE) throw new Error('atlas full at ' + name);
    var r = { name: name, x: shelfX, y: shelfY, w: w, h: h };
    r.u0 = (r.x + 0.01) / SIZE; r.v0 = (r.y + 0.01) / SIZE;
    r.du = (w - 0.02) / SIZE; r.dv = (h - 0.02) / SIZE;
    regions[name] = r;
    shelfX += w + PAD;
    if (h > shelfH) shelfH = h;
    return r;
  }

  /* Pixel painter on an RGBA buffer, wrapping coordinates for tileable textures. */
  function Painter(w, h) {
    this.w = w; this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
    this.wrap = true;
  }
  Painter.prototype.idx = function (x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (this.wrap) { x = ((x % this.w) + this.w) % this.w; y = ((y % this.h) + this.h) % this.h; }
    else if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return (y * this.w + x) * 4;
  };
  Painter.prototype.px = function (x, y, c, a) {
    var i = this.idx(x, y); if (i < 0 || !c) return;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a === undefined ? (c[3] === undefined ? 255 : c[3]) : a;
  };
  Painter.prototype.get = function (x, y) { var i = this.idx(x, y); if (i < 0) return null; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; };
  Painter.prototype.alpha = function (x, y) { var i = this.idx(x, y); return i < 0 ? 0 : this.d[i + 3]; };
  Painter.prototype.rect = function (x, y, w, h, c, a) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.px(x + i, y + j, c, a); };
  Painter.prototype.fill = function (c) { this.rect(0, 0, this.w, this.h, c); };
  Painter.prototype.shade = function (x, y, k) { /* multiply rgb */
    var i = this.idx(x, y); if (i < 0) return;
    this.d[i] *= k; this.d[i + 1] *= k; this.d[i + 2] *= k;
  };
  Painter.prototype.line = function (x0, y0, x1, y1, c, a) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
    for (var n = 0; n < 512; n++) {
      this.px(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  };
  Painter.prototype.ellipse = function (cx, cy, rx, ry, c, a) {
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.px(x, y, c, a);
      }
  };
  /* 1px dark outline around opaque pixels (sprites). */
  Painter.prototype.outline = function (c) {
    var w = this.w, h = this.h, src = new Uint8ClampedArray(this.d), self = this;
    var wasWrap = this.wrap; this.wrap = false;
    function op(x, y) { if (x < 0 || y < 0 || x >= w || y >= h) return false; return src[(y * w + x) * 4 + 3] > 0; }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (op(x, y)) continue;
      if (op(x - 1, y) || op(x + 1, y) || op(x, y - 1) || op(x, y + 1)) self.px(x, y, c);
    }
    this.wrap = wasWrap;
  };
  Painter.prototype.flipX = function () {
    var w = this.w, h = this.h, s = new Uint8ClampedArray(this.d);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var a = (y * w + x) * 4, b = (y * w + (w - 1 - x)) * 4;
      this.d[a] = s[b]; this.d[a + 1] = s[b + 1]; this.d[a + 2] = s[b + 2]; this.d[a + 3] = s[b + 3];
    }
  };

  function commit(name, p) {
    var r = alloc(name, p.w, p.h);
    var img = new ImageData(p.d, p.w, p.h);
    ctx.putImageData(img, r.x, r.y);
    r.painter = null;
    return r;
  }

  function paint(name, w, h, fn) {
    var p = new Painter(w, h);
    fn(p);
    return commit(name, p);
  }

  return {
    SIZE: SIZE, canvas: canvas, ctx: ctx, regions: regions,
    Painter: Painter, paint: paint, commit: commit, alloc: alloc,
    get: function (name) {
      var r = regions[name];
      if (!r) { BTS.Log.warn('missing atlas region', name); r = regions['missing']; }
      return r;
    },
    has: function (name) { return !!regions[name]; }
  };
})();

/* Colour helpers for painters. */
BTS.Col = (function () {
  function hex(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)]; }
  function ramp(list) { return list.map(hex); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function pickRamp(r, t) { var i = Math.max(0, Math.min(r.length - 1, Math.floor(t * r.length))); return r[i]; }
  return { hex: hex, ramp: ramp, mix: mix, mul: mul, pick: pickRamp };
})();
