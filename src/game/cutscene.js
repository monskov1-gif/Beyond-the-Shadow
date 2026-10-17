/* Cutscene runner: async scripts with a command API (walk, face, say, camera, fade, weather,
   shadows, music, sfx, flags...). Game-time timers respect pause. Saving is blocked while running. */
'use strict';
BTS.Cutscene = (function () {
  var CS = { running: 0, timers: [], tweens: [], skipRequested: false };
  var keyN = 0;

  CS.update = function (dt) {
    for (var j = CS.tweens.length - 1; j >= 0; j--) {
      var tw = CS.tweens[j]; tw.t += dt; var k = Math.min(1, tw.t / tw.dur);
      try { tw.fn(k); } catch (e) { BTS.Log.error('tween', e); k = 1; }
      if (k >= 1) { CS.tweens.splice(j, 1); if (tw.done) tw.done(); }
    }
    for (var i = CS.timers.length - 1; i >= 0; i--) {
      var t = CS.timers[i]; t.left -= dt;
      if (t.left <= 0) { CS.timers.splice(i, 1); t.res(); }
    }
  };
  function wait(sec) { return new Promise(function (res) { CS.timers.push({ left: sec, res: res }); }); }
  function ent(id) {
    if (id === 'player' || id === 'djordje') return BTS.World.player;
    var e = BTS.World.get(id);
    if (!e) BTS.Log.warn('cutscene: no entity', id);
    return e;
  }
  /* a goal inside a collider is moved to the nearest free navigation cell */
  function freeGoal(q, e) {
    var W = BTS.World;
    if (!W.blocked(q[0], q[1], Math.max(0.2, (e && e.radius || 0.28) - 0.04)) || !W.nav) return q;
    var c = W.nav.nearestFree.apply(W.nav, W.nav.toCell(q[0], q[1]));
    if (!c) return q;
    var cc = W.nav.center(c[0], c[1]);
    return Math.hypot(cc[0] - q[0], cc[1] - q[1]) < 3 ? [cc[0], cc[1]] : q;
  }
  function pos(p) {
    if (typeof p === 'string') { var s = BTS.World.spot(p); return s ? [s.x, s.z] : null; }
    return p;
  }

  /* command API passed to scripts */
  var C = {
    wait: wait,
    ent: ent,
    /* scripted walk: a navigation path to a free goal; blocked actors re-route or slip through (Entity.followPath);
       a walk that takes far too long keeps going through obstacles instead of jumping to the goal. */
    walk: function (id, p, o) {
      o = o || {};
      var e = ent(id), q = pos(p); if (!e || !q) return Promise.resolve();
      q = freeGoal(q, e);
      return new Promise(function (res) {
        var path = o.direct ? [q.slice()] : (BTS.World.findPath(e.x, e.z, q[0], q[1]) || [q.slice()]);
        if (o.via) path = o.via.map(function (v) { return v.slice(); }).concat(path);
        e.path = path; e.pathRun = !!o.run; e.pathSpeed = o.speed || 1;
        if (o.ghost) e.noClip = true;
        if (e.brain) e.brain.paused = true;
        var done = false, timeout = (Math.hypot(q[0] - e.x, q[1] - e.z) / (e.speed * (o.speed || 1))) * 2.5 + 2;
        var finish = function () { if (done) return; done = true; if (o.ghost) e.noClip = false; if (o.dir) e.dir = o.dir; res(); };
        e.onArrive = finish;
        var guard = function (tries) {
          wait(timeout).then(function () {
            if (done) return;
            var d = Math.hypot(q[0] - e.x, q[1] - e.z);
            if (d < 0.6 || tries >= 2) { e.x = q[0]; e.z = q[1]; e.path = null; e.onArrive = null; finish(); return; }
            // never jump: walk the rest in a straight line, through whatever is in the way
            e.path = [q.slice()]; e.noClip = true; e._autoNoClip = true; e._ncPath = e.path;
            timeout = d / (e.speed * (o.speed || 1)) + 1.5;
            guard(tries + 1);
          });
        };
        guard(0);
        if (o.noWait) res();
      });
    },
    /* walk relative to the current position */
    step: function (id, dx, dz, o) { var e = ent(id); if (!e) return Promise.resolve(); o = o || {}; o.direct = true; var dir = e.dir; return C.walk(id, [e.x + dx, e.z + dz], o).then(function () { if (o.keepDir !== false) e.dir = o.dir || dir; }); },
    /* frame several actors/points: centroid target, distance from their spread */
    frame: function (ids, o) {
      o = o || {};
      var xs = [], zs = [];
      [].concat(ids).forEach(function (id) { var q = typeof id === 'string' ? (ent(id) ? [ent(id).x, ent(id).z] : pos(id)) : id; if (q) { xs.push(q[0]); zs.push(q[1]); } });
      if (!xs.length) return Promise.resolve();
      var mnx = Math.min.apply(null, xs), mxx = Math.max.apply(null, xs), mnz = Math.min.apply(null, zs), mxz = Math.max.apply(null, zs);
      var spread = Math.max(mxx - mnx, (mxz - mnz) * 1.6);
      var dist = o.dist || BTS.M.clamp(11 + spread * 1.5, o.min || 11, o.max || 26);
      var cx = (mnx + mxx) / 2 + (o.dx || 0), cz = (mnz + mxz) / 2 + (o.dz || 0);
      return C.cam({ target: [cx, BTS.World.heightAt(cx, cz) + (o.y === undefined ? 0.8 : o.y), cz], dist: dist, pitch: o.pitch, time: o.time || 1.2, raw: o.raw });
    },
    /* camera follows an actor (released with unfollow / at the end of the cutscene) */
    follow: function (id, o) { var e = ent(id); BTS.Camera.cine = null; BTS.Camera.followTarget = e || null; if (o && o.dist) BTS.Camera.setPreset({ dist: o.dist, pitch: o.pitch }); },
    unfollow: function () { BTS.Camera.followTarget = null; },
    /* a temporary key light on an actor so a staged moment reads (removed with unlight / at the end) */
    keyLight: function (x, z, o) {
      o = o || {};
      var l = { id: 'cs_key' + (keyN++), x: x, y: (o.y || 2.4) + BTS.World.heightAt(x, z), z: z + (o.dz === undefined ? 1.2 : o.dz), color: o.color || [1, 0.78, 0.55], radius: o.radius || 5, intensity: o.intensity || 1.1, kind: 'lamp', flicker: o.flicker || 0, important: true, cs: true };
      l.cur = [0, 0, 0]; l.seed = Math.random() * 9; BTS.Env.lights.push(l); return l;
    },
    unlight: function (l) { var i = BTS.Env.lights.indexOf(l); if (i >= 0) BTS.Env.lights.splice(i, 1); },
    /* Đorđe and his own shadow: a glance down, a flinch and a recoil away from where it lies */
    shadowFear: function (o) {
      o = o || {};
      var p = BTS.World.player; if (!p) return Promise.resolve();
      var sh = p.shadow, sl = null;
      if (sh && sh.slots) for (var k in sh.slots) if (!sl || sh.slots[k].a > sl.a) sl = sh.slots[k];
      var dx = sl ? sl.dx : 0, dz = sl ? sl.dz : 1;
      var dir0 = p.dir;
      // look at it: face along the shadow
      p.faceTo(p.x + dx, p.z + dz);
      if (p.anim) p.anim.lock = 'idle';
      C.sfx('heartbeat', { vol: 0.75 });
      return wait(o.look || 0.55).then(function () {
        if (p.anim) p.anim.lock = 'fear'; C.sfx('breath', { vol: 0.5 });
        var bx = p.x - dx * (o.back || 0.45), bz = p.z - dz * (o.back || 0.45);
        if (BTS.World.blocked(bx, bz, 0.25)) { bx = p.x; bz = p.z; }
        var sx = p.x, sz = p.z;   // the recoil is a short slide, not a walk cycle
        return new Promise(function (res) { CS.tweens.push({ t: 0, dur: 0.28, fn: function (k) { p.x = sx + (bx - sx) * k; p.z = sz + (bz - sz) * k; }, done: res }); });
      }).then(function () { return wait(o.hold || 0.7); }).then(function () {
        if (p.anim) p.anim.lock = o.cower ? 'cower' : null;
        if (o.turnAway !== false) p.faceTo(p.x - dx, p.z - dz); else p.dir = dir0;
        return wait(o.cower ? 0.9 : 0.2);
      }).then(function () { if (o.cower && p.anim && !o.keepCower) p.anim.lock = null; });
    },
    /* time-based tween run by the cutscene clock: fn(k) with k 0..1 */
    tween: function (dur, fn) { return new Promise(function (res) { CS.tweens.push({ t: 0, dur: dur, fn: fn, done: res }); }); },
    place: function (id, p, dir) { var e = ent(id), q = pos(p); if (!e || !q) return; e.x = q[0]; e.z = q[1]; e.path = null; e._fpStep = 0; if (e._autoNoClip) { e._autoNoClip = false; e.noClip = false; } if (dir) e.dir = dir; e.y = BTS.World.heightAt(e.x, e.z); },
    face: function (id, dir) { var e = ent(id); if (!e) return; if (typeof dir === 'string' && ['up', 'down', 'left', 'right'].indexOf(dir) >= 0) e.dir = dir; else { var o = ent(dir); if (o) e.faceTo(o.x, o.z); } },
    anim: function (id, a) { var e = ent(id); if (e && e.anim) e.anim.lock = a || null; },
    hide: function (id, v) { var e = ent(id); if (e) e.hidden = v !== false; },
    /* say(dlg, {at: {lineId: fn(C)}}) — staging cues fired when a given line of the dialogue is shown */
    say: function (dlg, o) {
      var cues = o && o.at; if (!cues) return BTS.Dialogue.start(dlg, o);
      var pre = 'dlg.' + dlg + '.';
      var h = function (line) { var k = line && line.key || ''; if (k.indexOf(pre) !== 0) return; var f = cues[k.slice(pre.length)]; if (f) { try { f(C); } catch (e) { BTS.Log.error('cue', k, e); } } };
      BTS.Events.on('dlg_line', h);
      return BTS.Dialogue.start(dlg, o).then(function (r) { BTS.Events.off('dlg_line', h); return r; });
    },
    /* cinematic camera. The dialogue box covers the lower third of the frame, so the aim point is moved toward the
       viewer (raw:true disables it) and the subject sits in the clear upper part of the picture. */
    cam: function (o) {
      if (o.target && typeof o.target === 'string') { var e = ent(o.target), s = BTS.World.spot(o.target); o.target = e ? [e.x, e.y, e.z] : s ? [s.x, BTS.World.heightAt(s.x, s.z), s.z] : null; }
      if (o.target && !o.raw) { var d = o.dist || BTS.Camera.dist || 22; o.target = [o.target[0], o.target[1], o.target[2] + d * 0.15]; }
      return BTS.Camera.cinematic(o);
    },
    camRelease: function () { BTS.Camera.release(); },
    shake: function (k) { BTS.Camera.shake = k || 1; },
    fade: function (v, speed) { return BTS.Env.fadeTo(v, speed); },
    env: function (o, instant) { BTS.Env.set(o, instant); },
    horror: function (v) { BTS.Env.set({ horror: v }); },
    sepia: function (v) { BTS.Env.sepiaGoal = v; },
    supernatural: function (v) { BTS.Env.supernatural = v; },
    load: function (loc, spawn) { BTS.Game.enterLocation(loc, spawn, true); },
    music: function (s, f) { BTS.Music.set(s, f); },
    musicCut: function () { BTS.Music.cut(); },
    intensity: function (v) { BTS.Music.intensity = v; },
    sfx: function (n, o) { BTS.Audio.play(n, o); },
    flag: function (k, v) { BTS.State.set(k, v); },
    clue: function (id) { BTS.State.addClue(id); },
    item: function (id) { BTS.State.addItem(id); },
    removeItem: function (id) { BTS.State.removeItem(id); },
    shadow: function (id, o) { var e = ent(id); if (!e || !e.shadow) return; var s = e.shadow; if (o.stage !== undefined) s.setStage(o.stage); for (var k in o) if (k !== 'stage') s[k] = o[k]; },
    kill: function (id) { BTS.State.kill(id); },
    beat: function (id) { BTS.Story.goto(id); },
    title: function (key, sub) { return BTS.UI.chapterTitle(key, sub); },
    caption: function (key) { BTS.UI.caption(key); },
    notify: function (key) { BTS.UI.toast(BTS.t(key)); },
    spawn: function (id, p, o) { return BTS.Game.spawnNPC(id, pos(p), o || {}); },
    despawn: function (id) { BTS.World.removeEntity(id); },
    particles: function (e) { return BTS.Particles.addEmitter(e); },
    light: function (l) { l.cur = [0, 0, 0]; l.seed = Math.random() * 9; BTS.Env.lights.push(l); return l; },
    lockControl: function (v) { BTS.World.controlLocked = v ? 1 : 0; },
    letterbox: function (v) { BTS.UI.letterbox(v); },
    timeScale: function (v) { BTS.App.timeScale = v; }
  };
  CS.C = C;

  CS.play = function (fn, name) {
    CS.running++;
    BTS.World.controlLocked++;
    BTS.UI && BTS.UI.letterbox(true);
    BTS.Events.emit('cutscene', name, true);
    var p;
    try { p = Promise.resolve(fn(C)); } catch (e) { p = Promise.reject(e); }
    return p.catch(function (e) { BTS.Log.error('cutscene error', name, e); }).then(function () {
      CS.running = Math.max(0, CS.running - 1);
      BTS.World.controlLocked = Math.max(0, BTS.World.controlLocked - 1);
      if (!CS.running) {
        BTS.UI && BTS.UI.letterbox(false); BTS.Camera.release(); BTS.Camera.followTarget = null;
        for (var li = BTS.Env.lights.length - 1; li >= 0; li--) if (BTS.Env.lights[li].cs) BTS.Env.lights.splice(li, 1);
        BTS.World.entities.forEach(function (e) { if (e._autoNoClip) { e._autoNoClip = false; e.noClip = false; } }); BTS.World.entities.forEach(function (e) { if (e.brain && !e.keepPaused) e.brain.paused = false; if (e.anim && !e.keepLock) e.anim.lock = null; }); }
      BTS.Events.emit('cutscene', name, false);
    });
  };
  return CS;
})();
