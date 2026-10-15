/* Cutscene runner: async scripts with a command API (walk, face, say, camera, fade, weather,
   shadows, music, sfx, flags...). Game-time timers respect pause. Saving is blocked while running. */
'use strict';
BTS.Cutscene = (function () {
  var CS = { running: 0, timers: [], skipRequested: false };

  CS.update = function (dt) {
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
  function pos(p) {
    if (typeof p === 'string') { var s = BTS.World.spot(p); return s ? [s.x, s.z] : null; }
    return p;
  }

  /* command API passed to scripts */
  var C = {
    wait: wait,
    ent: ent,
    walk: function (id, p, o) {
      o = o || {};
      var e = ent(id), q = pos(p); if (!e || !q) return Promise.resolve();
      return new Promise(function (res) {
        var path = o.direct ? [q.slice()] : (BTS.World.findPath(e.x, e.z, q[0], q[1]) || [q.slice()]);
        e.path = path; e.pathRun = !!o.run; e.pathSpeed = o.speed || 1;
        if (e.brain) e.brain.paused = true;
        var done = false, timeout = (Math.hypot(q[0] - e.x, q[1] - e.z) / (e.speed * (o.speed || 1))) * 2.5 + 2;
        e.onArrive = function () { if (!done) { done = true; if (o.dir) e.dir = o.dir; res(); } };
        if (e === BTS.World.player) {
          // player path handled by World.update
        }
        wait(timeout).then(function () { if (!done) { done = true; e.x = q[0]; e.z = q[1]; e.path = null; if (o.dir) e.dir = o.dir; res(); } });
        if (o.noWait) res();
      });
    },
    place: function (id, p, dir) { var e = ent(id), q = pos(p); if (!e || !q) return; e.x = q[0]; e.z = q[1]; e.path = null; if (dir) e.dir = dir; e.y = BTS.World.heightAt(e.x, e.z); },
    face: function (id, dir) { var e = ent(id); if (!e) return; if (typeof dir === 'string' && ['up', 'down', 'left', 'right'].indexOf(dir) >= 0) e.dir = dir; else { var o = ent(dir); if (o) e.faceTo(o.x, o.z); } },
    anim: function (id, a) { var e = ent(id); if (e && e.anim) e.anim.lock = a || null; },
    hide: function (id, v) { var e = ent(id); if (e) e.hidden = v !== false; },
    say: function (dlg, o) { return BTS.Dialogue.start(dlg, o); },
    cam: function (o) { if (o.target && typeof o.target === 'string') { var e = ent(o.target), s = BTS.World.spot(o.target); o.target = e ? [e.x, e.y, e.z] : s ? [s.x, BTS.World.heightAt(s.x, s.z), s.z] : null; } return BTS.Camera.cinematic(o); },
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
      if (!CS.running) { BTS.UI && BTS.UI.letterbox(false); BTS.Camera.release(); BTS.World.entities.forEach(function (e) { if (e.brain && !e.keepPaused) e.brain.paused = false; if (e.anim && !e.keepLock) e.anim.lock = null; }); }
      BTS.Events.emit('cutscene', name, false);
    });
  };
  return CS;
})();
