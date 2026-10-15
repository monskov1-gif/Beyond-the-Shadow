/* Entities and components: Transform (x,y,z,dir), Animator (sprite sheet state machine with
   frame events), Mover (velocity / path following), ShadowCaster, Interactable, Brain (npc.js). */
'use strict';
BTS.Entity = function (o) {
  this.id = o.id;
  this.kind = o.kind || 'prop';
  this.x = o.x || 0; this.z = o.z || 0; this.y = 0;
  this.dir = o.dir || 'down';
  this.radius = o.radius || 0.28;
  this.solid = o.solid !== false;
  this.hidden = !!o.hidden;
  this.speed = o.speed || 2.2;
  this.tint = o.tint || null;
  this.alpha = 1;
  this.components = {};
  if (o.sheet) this.add('anim', new BTS.Animator(o.sheet));
  if (o.sprite) this.sprite = o.sprite;          // static sprite region name (animals etc.)
  if (o.shadow !== false && (o.sheet || o.castShadow)) this.add('shadow', new BTS.ShadowCaster(this, o.shadowOpts));
  this.path = null; this.vx = 0; this.vz = 0; this.moving = false;
  this.data = o.data || {};
};
(function () {
  var E = BTS.Entity.prototype;
  E.add = function (name, comp) { this.components[name] = comp; comp.entity = this; this[name] = comp; return comp; };
  E.has = function (name) { return !!this.components[name]; };
  E.pos = function () { return [this.x, this.y, this.z]; };
  E.face = function (dir) { this.dir = dir; };
  E.faceTo = function (x, z) {
    var dx = x - this.x, dz = z - this.z;
    if (Math.abs(dx) > Math.abs(dz) * 0.8) this.dir = dx > 0 ? 'right' : 'left'; else this.dir = dz > 0 ? 'down' : 'up';
  };
  E.dist = function (o) { return Math.hypot(this.x - o.x, this.z - o.z); };
  /* follow a path of [x,z] points; returns true when finished */
  E.followPath = function (dt, speedMul) {
    if (!this.path || !this.path.length) { this.moving = false; return true; }
    var t = this.path[0], dx = t[0] - this.x, dz = t[1] - this.z, d = Math.hypot(dx, dz);
    var sp = this.speed * (speedMul || 1);
    if (d < 0.08) { this.path.shift(); if (!this.path.length) { this.moving = false; return true; } return false; }
    var step = Math.min(d, sp * dt);
    this.vx = dx / d * sp; this.vz = dz / d * sp;
    this.x += dx / d * step; this.z += dz / d * step;
    this.moving = true;
    this.faceTo(t[0], t[1]);
    return false;
  };
})();

/* Animator: plays '<anim>_<dir>' clips from a character sheet, emits frame events. */
BTS.Animator = function (sheetId) {
  this.sheetId = sheetId;
  this.sheet = BTS.CharSprites.sheets[sheetId];
  if (!this.sheet) BTS.Log.warn('missing sheet', sheetId);
  this.state = 'idle'; this.t = 0; this.frame = 0; this.lastFrame = -1; this.speed = 1;
  this.lock = null;   // forced animation from scripts
};
(function () {
  var A = BTS.Animator.prototype;
  A.set = function (state) { if (this.state !== state) { this.state = state; this.t = 0; this.lastFrame = -1; } };
  A.clip = function (dir) {
    var s = this.lock || this.state;
    var sh = BTS.CharSprites.sheets[BTS.CharSprites.variant(this.sheetId)] || this.sheet;
    var c = sh && (sh.anims[s + '_' + dir] || sh.anims['idle_' + dir]);
    return c;
  };
  A.update = function (dt, dir) {
    var c = this.clip(dir); if (!c) return;
    this.t += dt * this.speed;
    var f = Math.floor(this.t * c.fps) % c.frames.length;
    if (f !== this.lastFrame) {
      this.lastFrame = f;
      var st = this.lock || this.state;
      if ((st === 'walk' || st === 'run') && (f === 0 || f === 2)) BTS.Events.emit('footstep', this.entity);
    }
    this.frame = f;
  };
  A.region = function (dir) { var c = this.clip(dir); return c ? c.frames[this.frame % c.frames.length] : null; };
})();

/* ShadowCaster: the shadow is its own simulated object — follows the light, can lag, stretch,
   turn on its own, detach, vanish, or (Jaglika) grow into something inhuman. */
BTS.ShadowCaster = function (ent, o) {
  o = o || {};
  this.stage = 0;          // 0 normal, 1 early, 2 middle, 3 late (detaching), 4 gone
  this.history = [];       // past positions/frames for lag
  this.lag = 0; this.lenMul = 1; this.angle = 0; this.alpha = 1; this.wander = [0, 0];
  this.beast = 0;          // 0..1 growth of an inhuman shadow
  this.beastFrame = 0;
  this.wallLean = 0;       // >0 draws a climbing silhouette on the nearest wall
  this.visible = true;
  this.phase = Math.random() * 10;
  this.observeTime = 0;
};
BTS.ShadowCaster.prototype.setStage = function (s) {
  this.stage = s;
  this.lag = [0, 0.18, 0.45, 0.9, 0][s] || 0;
};
