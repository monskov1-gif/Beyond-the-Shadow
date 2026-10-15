/* World: location loading/unloading (static geometry cached), entities, player control,
   collisions, triggers, interactables, occlusion fading and per-frame render preparation. */
'use strict';
BTS.Locations = {};
BTS.World = (function () {
  var M = BTS.M;
  var W = {
    loc: null, locId: null, chunks: [], colliders: [], entities: [], interactables: [], triggers: [],
    player: null, statics: [], nav: null, cache: {}, focusInteract: null, controlLocked: 0, time: 0,
    heightAt: function () { return 0; }
  };

  function buildStatic(id) {
    if (W.cache[id]) return W.cache[id];
    var def = BTS.Locations[id];
    if (!def) throw new Error('unknown location ' + id);
    var t0 = performance.now();
    var L = new BTS.LocationBuilder(def);
    def.build(L);
    L.finish();
    var st = {
      def: def, chunks: L.chunks, colliders: L.colliders, lights: L.lights, emitters: L.emitters, spots: L.spots,
      statics: L.statics, areas: L.areas, mapShapes: L.mapShapes, houses: L.houses, heightAt: L.height, tileAt: L.tileAt
    };
    st.bounds = def.bounds;
    st.nav = new BTS.Physics.NavGrid(def.bounds, st.colliders, def.navCell || 0.5, 0.32);
    W.cache[id] = st;
    BTS.Log.info('built location', id, 'chunks', st.chunks.length, 'colliders', st.colliders.length, Math.round(performance.now() - t0) + 'ms');
    return st;
  }

  W.prebuild = function (ids) { ids.forEach(buildStatic); };

  /* Load location; spawn: spot name or {x,z,dir}. Population is delegated to Story. */
  W.load = function (id, spawn) {
    var st = buildStatic(id);
    W.locId = id; W.loc = st;
    W.chunks = st.chunks.slice();
    W.colliders = st.colliders.slice();
    W.heightAt = st.def.walkHeight || st.heightAt;
    W.nav = st.nav;
    W.statics = st.statics;
    W.entities = []; W.interactables = []; W.triggers = []; W.extraRender = null; W.speedMul = 1;
    W.interior = !!st.def.interior;
    BTS.Env.set({ interior: W.interior });
    BTS.Env.setLights(st.lights.map(function (l) { var c = {}; for (var k in l) c[k] = l[k]; return c; }));
    BTS.Particles.clear();
    st.emitters.forEach(function (e) { var c = {}; for (var k in e) c[k] = e[k]; BTS.Particles.addEmitter(c); });
    var cp = st.def.camera || {};
    if (W.interior && !cp.dist) cp.dist = 21;
    BTS.Renderer.zoom = (cp.dist || 26) / 44; BTS.Renderer.resize();
    BTS.Camera.setPreset(cp, true);
    var b = st.def.camBounds || st.def.bounds;
    BTS.Camera.bounds = [b[0] + (cp.padX || 6), b[1] + (cp.padZ0 || 4), b[2] - (cp.padX || 6), b[3] - (cp.padZ1 || 2)];
    if (BTS.Camera.bounds[0] > BTS.Camera.bounds[2]) { var mx = (b[0] + b[2]) / 2; BTS.Camera.bounds[0] = BTS.Camera.bounds[2] = mx; }
    if (BTS.Camera.bounds[1] > BTS.Camera.bounds[3]) { var mz = (b[1] + b[3]) / 2; BTS.Camera.bounds[1] = BTS.Camera.bounds[3] = mz; }
    // player
    var p = W.player || new BTS.Entity({ id: 'player', kind: 'player', sheet: 'djordje', radius: 0.28, speed: 2.5 });
    p.isPlayer = true; p.hidden = false; p.solid = true;
    W.player = p;
    var sp = typeof spawn === 'string' ? st.spots[spawn] : spawn;
    if (!sp) { BTS.Log.warn('missing spawn', spawn, 'in', id); sp = st.spots.default || { x: (b[0] + b[2]) / 2, z: (b[1] + b[3]) / 2 }; }
    p.x = sp.x; p.z = sp.z; p.dir = sp.dir || 'down'; p.path = null;
    p.y = W.heightAt(p.x, p.z);
    W.entities.push(p);
    if (st.def.onLoad) st.def.onLoad(W);
    BTS.Events.emit('location', id, st.def);
    BTS.Camera.snap([p.x, p.y, p.z]);
    return st;
  };

  W.light = function (id) { return BTS.Env.lights.filter(function (l) { return l.id === id; })[0]; };
  W.static = function (id) { return W.statics.filter(function (s) { return s.id === id; })[0]; };
  W.spot = function (name) { var s = W.loc && W.loc.spots[name]; if (!s) BTS.Log.warn('missing spot', name, W.locId); return s; };
  W.addEntity = function (e) { e.y = W.heightAt(e.x, e.z); W.entities.push(e); return e; };
  W.removeEntity = function (id) { W.entities = W.entities.filter(function (e) { return e.id !== id; }); };
  W.get = function (id) { for (var i = 0; i < W.entities.length; i++) if (W.entities[i].id === id) return W.entities[i]; return null; };
  W.addInteract = function (it) {
    it.r = it.r || 1.1;
    if (it.y === undefined) it.y = W.heightAt(it.x, it.z);
    W.interactables.push(it); return it;
  };
  W.removeInteract = function (id) { W.interactables = W.interactables.filter(function (i) { return i.id !== id; }); };
  W.addTrigger = function (t) { t.inside = false; W.triggers.push(t); return t; };
  W.blocked = function (x, z, r) { return BTS.Physics.pointBlocked(x, z, r || 0.3, W.colliders); };
  W.findPath = function (ax, az, bx, bz) { return W.nav ? W.nav.find(ax, az, bx, bz) : [[bx, bz]]; };
  W.surfaceAt = function (x, z) {
    var d = W.loc && W.loc.def;
    if (d && d.surface) return d.surface(x, z);
    var t = W.loc ? W.loc.tileAt(x, z) : 'grass';
    if (/cobble|flags|stone|gravel/.test(t)) return 'stone';
    if (/wood/.test(t)) return 'wood';
    if (/mud|water/.test(t)) return 'mud';
    if (/dirt|field|sand/.test(t)) return 'dirt';
    return 'grass';
  };

  /* ---------------- update ---------------- */
  W.update = function (dt, canControl) {
    if (!W.loc) return;
    W.time += dt;
    var p = W.player, I = BTS.Input;
    var control = canControl && W.controlLocked <= 0;
    // player
    if (p && p.anim) {
      if (control && !p.path) {
        var ax = I.axis();
        var run = I.down.run;
        var sp = (run ? 4.3 : 2.5) * (W.speedMul || 1);
        if (ax[0] || ax[1]) {
          var ox = p.x, oz = p.z;
          p.x += ax[0] * sp * dt; p.z += ax[1] * sp * dt;
          if (Math.abs(ax[0]) > Math.abs(ax[1]) * 0.9) p.dir = ax[0] > 0 ? 'right' : 'left'; else p.dir = ax[1] > 0 ? 'down' : 'up';
          BTS.Physics.resolve(p, W.colliders, W.entities);
          var b = W.loc.bounds;
          p.x = M.clamp(p.x, b[0] + 0.5, b[2] - 0.5); p.z = M.clamp(p.z, b[1] + 0.5, b[3] - 0.5);
          var moved = Math.hypot(p.x - ox, p.z - oz) > 0.001;
          p.anim.set(moved ? (run ? 'run' : 'walk') : 'idle');
          p.moving = moved;
        } else { if (!p.anim.lock) p.anim.set(W.playerIdle || 'idle'); p.moving = false; }
      } else if (p.path) {
        p.followPath(dt, p.pathSpeed || 1);
        p.anim.set(p.path ? (p.pathRun ? 'run' : 'walk') : 'idle');
        if (!p.path || !p.path.length) { p.path = null; if (p.onArrive) { var cb = p.onArrive; p.onArrive = null; cb(); } }
      } else if (!p.anim.lock) p.anim.set(W.playerIdle || 'idle');
    }
    // npcs and entity components
    for (var i = 0; i < W.entities.length; i++) {
      var e = W.entities[i];
      if (e.follow && !BTS.Cutscene.running) {   // companion following the player
        if (e.brain) { e.brain.paused = true; e.keepPaused = true; }
        var fd = Math.hypot(e.follow.x - e.x, e.follow.z - e.z);
        e._rp = (e._rp || 0) - dt;
        if (fd > 2.6 && e._rp <= 0) { var fp = W.findPath(e.x, e.z, e.follow.x, e.follow.z); if (fp && fp.length) { fp.pop(); if (!fp.length) fp = null; } e.path = fp || [[e.follow.x - Math.sign(e.follow.x - e.x) * 1.2, e.follow.z - Math.sign(e.follow.z - e.z) * 1.2]]; e._rp = 0.5; e.pathRun = fd > 6; }
        if (fd < 1.7) { e.path = null; e.faceTo(e.follow.x, e.follow.z); }
        if (fd > 25) { e.x = e.follow.x - 1; e.z = e.follow.z + 0.8; e.path = null; }
      }
      if (e.brain && !e.brain.paused) e.brain.update(dt, e, W);
      else if (e !== p && e.path) { e.followPath(dt, e.pathSpeed || 1); if (e.anim) { e.anim.set(e.path && e.path.length ? (e.pathRun ? 'run' : 'walk') : (e.idleAnim || 'idle')); e.anim.speed = e.pathSpeed && e.pathSpeed < 1 ? 0.65 : 1; } if (!e.path || !e.path.length) { e.path = null; if (e.onArrive) { var c2 = e.onArrive; e.onArrive = null; c2(); } } }
      if (e.animal) W.updateAnimal(e, dt);
      if (e !== p && e.moving && e.solid) BTS.Physics.resolve(e, W.colliders, null);
      e.y = W.heightAt(e.x, e.z) + (e.lift || 0);
      if (e.anim) e.anim.update(dt, e.dir);
    }
    // triggers
    if (p) for (i = 0; i < W.triggers.length; i++) {
      var t = W.triggers[i], bx = t.box;
      var inside = p.x > bx[0] && p.x < bx[2] && p.z > bx[1] && p.z < bx[3] && (!t.cond || t.cond());
      if (inside && !t.inside) { t.inside = true; if (t.onEnter) t.onEnter(t); if (t.once) t.dead = true; }
      else if (!inside && t.inside) { t.inside = false; if (t.onExit) t.onExit(t); }
    }
    W.triggers = W.triggers.filter(function (t) { return !t.dead; });
    // interactable focus
    W.focusInteract = null;
    if (p && control) {
      var best = null, bs = 1e9;
      var fdx = p.dir === 'left' ? -1 : p.dir === 'right' ? 1 : 0, fdz = p.dir === 'up' ? -1 : p.dir === 'down' ? 1 : 0;
      for (i = 0; i < W.interactables.length; i++) {
        var it = W.interactables[i];
        if (it.cond && !it.cond()) continue;
        var ix = it.ent ? it.ent.x : it.x, iz = it.ent ? it.ent.z : it.z;
        var d = Math.hypot(ix - p.x, iz - p.z);
        if (d > it.r) continue;
        var facing = d < 0.3 ? 1 : ((ix - p.x) * fdx + (iz - p.z) * fdz) / d;
        var score = d - facing * 0.6 - (it.priority || 0);
        if (score < bs) { bs = score; best = it; }
      }
      W.focusInteract = best;
    }
    // occlusion fading for houses in front of the player
    for (i = 0; i < W.chunks.length; i++) {
      var ch = W.chunks[i];
      if (!ch.fadeable || !ch.base || !p) continue;
      var B = ch.base, reach = (B[4] - W.heightAt(p.x, p.z)) * 1.25 + 0.5;
      var behind = p.x > B[0] - 0.7 && p.x < B[2] + 0.7 && p.z < B[1] + 0.3 && p.z > B[1] - reach;
      // houses between the player and the bottom of the frame are softened too, so roofs don't blot out the foreground
      var front = !behind && ch.min && ch.min[2] > p.z + 0.8 && ch.min[2] < p.z + 9 && ch.max[0] > p.x - 7 && ch.min[0] < p.x + 7;
      ch.fadeGoal = behind ? 0.2 : (front ? 0.55 : 1);
      ch.fade = M.damp(ch.fade, ch.fadeGoal, 6, dt);
    }
  };

  W.updateAnimal = function (e, dt) {
    var a = e.animal;
    a.t -= dt;
    if (a.t <= 0) {
      a.t = 2 + Math.random() * 5;
      if (Math.random() < 0.6) { var ang = Math.random() * 6.283, d = Math.random() * a.range; var gx = a.home[0] + Math.cos(ang) * d, gz = a.home[1] + Math.sin(ang) * d; if (!W.blocked(gx, gz, 0.2)) e.path = [[gx, gz]]; }
    }
    if (e.path) { e.followPath(dt, 1); if (!e.path || !e.path.length) e.path = null; }
    if (W.player && a.flee && W.player.dist(e) < 1.6) { var fx = e.x - W.player.x, fz = e.z - W.player.z, fl = Math.hypot(fx, fz) || 1; e.path = [[e.x + fx / fl * 2, e.z + fz / fl * 2]]; }
  };

  /* ---------------- render prep ---------------- */
  W.render = function (R, env) {
    if (!W.loc) return;
    var t = BTS.App.time;
    for (var i = 0; i < W.entities.length; i++) {
      var e = W.entities[i];
      if (e.hidden) continue;
      var reg = e.anim ? e.anim.region(e.dir) : (e.sprite ? BTS.Atlas.get(e.spriteAnim ? e.spriteAnim[Math.floor(t * 4) % e.spriteAnim.length] : e.sprite) : null);
      if (!reg) continue;
      var tint = e.tint;
      if (e.alpha < 1) tint = [(tint ? tint[0] : 1), (tint ? tint[1] : 1), (tint ? tint[2] : 1)];
      R.pushSprite(reg, e.x, e.y, e.z + 0.02, { tint: tint, flip: e.spriteFlip, scale: e.scale, tilt: e.anim ? 0.18 : 0.05, emissive: e.emissive, mat: e.anim ? undefined : (e.emissive ? undefined : BTS.MAT.DEFAULT) });
    }
    // animated statics: flames, hanging lanterns
    for (i = 0; i < W.statics.length; i++) {
      var s = W.statics[i];
      if (s.night && !(env.lampOn > 0.25)) continue;
      if (s.off) continue;
      if (s.pool) {
        var pa = (s.night ? env.lampOn : 1) * 0.16 * (0.92 + 0.08 * Math.sin(t * 9 + i));
        if (pa > 0.01) { var P = s.pool; R.pushFx(2, [[P[0] - P[3], P[1], P[2] + P[3]], [P[0] + P[3], P[1], P[2] + P[3]], [P[0] + P[3], P[1], P[2] - P[3]], [P[0] - P[3], P[1], P[2] - P[3]]], BTS.Atlas.get('soft_dot'), [s.col[0], s.col[1], s.col[2], pa]); }
        continue;
      }
      if (s.beam) {
        var ba = s.day ? Math.max(0, 1 - env.lampOn * 1.2) * 0.2 : 0.2;
        if (env.weather !== 'clear') ba *= 0.5;
        if (ba > 0.005) R.pushFx(2, s.beam, BTS.Atlas.get('beam_grad'), [s.col[0], s.col[1], s.col[2], ba]);
        continue;
      }
      var sc = s.scale || 1;
      if (s.flicker) sc *= 0.92 + 0.12 * Math.sin(t * 17 + i * 3.1) * Math.sin(t * 5 + i);
      R.pushSprite(BTS.Atlas.get(s.sprite), s.x, s.y, s.z, { scale: sc, emissive: s.emissive, tilt: 0 });
    }
    // interactable hints: subtle sparkle over unexamined clues (accessibility)
    for (i = 0; i < W.interactables.length; i++) {
      var it = W.interactables[i];
      if (!it.hint || (it.cond && !it.cond())) continue;
      var a = 0.45 + 0.35 * Math.sin(t * 3 + i);
      R.pushParticle(2, BTS.Atlas.get('sparkle'), it.x, it.y + (it.hy || 0.9) + Math.sin(t * 2 + i) * 0.05, it.z, 0.22, [1.0, 0.9, 0.6, a]);
    }
    BTS.Shadows.render(R, env, W.entities, W);
    if (W.extraRender) W.extraRender(R, env);
  };

  return W;
})();
