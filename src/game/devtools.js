/* Developer mode & test scenes (?test=render|collision|audio|loading|view&loc=..&time=..&weather=..).
   Also exposes a small automation API used by tools/playthrough.mjs. */
'use strict';
BTS.Test = (function () {
  var T = {};
  T.boot = function (name) {
    var q = BTS.Game.query;
    BTS.Config.data.devMode = true;
    BTS.Game.started = true; BTS.Game.mode = 'play';
    BTS.State.reset(); BTS.State.d.beat = BTS.Story.beats.length ? BTS.Story.beats[0].id : null;
    var loc = q.get('loc') || (name === 'collision' ? 'test_collision' : name === 'render' ? 'test_render' : 'village');
    BTS.World.load(loc, q.get('spawn') || 'default');
    BTS.Env.set({ time: q.get('time') || 'evening', weather: q.get('weather') || 'clear', horror: +(q.get('horror') || 0) }, true);
    if (q.get('x')) { var p = BTS.World.player; p.x = +q.get('x'); p.z = +q.get('z'); BTS.Camera.snap([p.x, BTS.World.heightAt(p.x, p.z), p.z]); }
    if (q.get('populate')) BTS.Story.populate(loc);
    if (q.get('hideplayer')) BTS.World.player.hidden = true;
    if (name === 'audio') T.audioTest();
    if (name === 'loading') T.loadingTest();
    if (name === 'collision') T.collisionTest();
    BTS.UI.toast('TEST: ' + name);
    BTS.Music.set(q.get('music') || 'village');
  };
  T.audioTest = function () {
    var names = Object.keys(BTS.SFX).filter(function (k) { return typeof BTS.SFX[k] === 'function'; });
    var i = 0;
    T.audioTimer = setInterval(function () {
      if (!BTS.Audio.ready) return;
      var n = names[i++ % names.length];
      BTS.UI.toast('sfx: ' + n);
      BTS.Audio.play(n, { x: BTS.Camera.target[0] + 3, z: BTS.Camera.target[2], surface: ['stone', 'dirt', 'grass', 'wood', 'mud'][i % 5] });
    }, 1400);
  };
  T.loadingTest = function () {
    var t0 = performance.now(), ids = Object.keys(BTS.Locations), res = [];
    ids.forEach(function (id) { var a = performance.now(); try { BTS.World.prebuild([id]); res.push(id + ': ' + Math.round(performance.now() - a) + 'ms'); } catch (e) { res.push(id + ': ERROR ' + e.message); } });
    T.loadReport = { total: Math.round(performance.now() - t0), items: res, atlasRegions: Object.keys(BTS.Atlas.regions).length };
    BTS.Log.info('loading test', JSON.stringify(T.loadReport));
  };
  /* walk a bot in random directions; report if it ever ends up inside a collider */
  T.collisionTest = function () {
    var p = BTS.World.player, stuck = 0, inside = 0, steps = 0;
    T.collReport = { steps: 0, inside: 0 };
    T.collTimer = setInterval(function () {
      for (var k = 0; k < 20; k++) {
        var a = Math.random() * 6.283;
        p.x += Math.cos(a) * 0.3; p.z += Math.sin(a) * 0.3;
        BTS.Physics.resolve(p, BTS.World.colliders, BTS.World.entities);
        if (BTS.Physics.pointBlocked(p.x, p.z, 0.1, BTS.World.colliders)) inside++;
        steps++;
      }
      T.collReport = { steps: steps, inside: inside };
    }, 50);
  };

  /* ---------- automation API for scripted playthroughs ---------- */
  T.state = function () {
    var W = BTS.World, p = W.player;
    return {
      beat: BTS.State.d.beat, loc: W.locId, x: p && p.x, z: p && p.z, dlg: BTS.Dialogue.active, cut: BTS.Cutscene.running, trans: BTS.Game.transitioning,
      screens: BTS.UI.stack.map(function (s) { return s.name; }), obj: BTS.State.d.objectiveKey, mode: BTS.Game.mode,
      interact: W.interactables.map(function (i) { return { id: i.id, x: i.ent ? i.ent.x : i.x, z: i.ent ? i.ent.z : i.z, ok: !i.cond || i.cond(), hint: !!i.hint }; }),
      ents: W.entities.map(function (e) { return e.id; }), missing: Object.keys(BTS.I18N.missing), clues: BTS.State.d.clueOrder.length, fps: BTS.App.fps
    };
  };
  /* walk to an interactable through the real navigation and press interact */
  T.goInteract = function (id) {
    var W = BTS.World, it = W.interactables.filter(function (i) { return i.id === id; })[0];
    if (!it) return 'no-interact';
    var p = W.player, x = it.ent ? it.ent.x : it.x, z = it.ent ? it.ent.z : it.z;
    var path = W.findPath(p.x, p.z, x, z) || [[x, z]];
    // stop short of the target
    var last = path[path.length - 1];
    var dx = last[0] - p.x, dz = last[1] - p.z;
    path[path.length - 1] = [x - Math.sign(dx) * 0.0, z + 0.0];
    return new Promise(function (res) {
      p.path = path; p.pathSpeed = 2.2;
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        var d = Math.hypot(p.x - x, p.z - z);
        if (d < it.r * 0.85 || !p.path || tries > 400) {
          p.path = null; clearInterval(iv);
          p.faceTo(x, z);
          W.focusInteract = it;
          if (d > it.r + 0.5) { p.x = x; p.z = z + 0.5; }
          BTS.Story.interact(it);
          res('ok:' + d.toFixed(2));
        }
      }, 50);
    });
  };
  T.advance = function () {   // advance dialogue: choose first option / skip typing
    if (!BTS.Dialogue.active) return false;
    var st = BTS.UI.dlgState;
    if (st && st.choices) { BTS.Dialogue.choose(st.choices[T.choicePick ? T.choicePick(st.choices) : 0].i); return 'choice'; }
    if (st && st.full && st.shown < st.full.length) st.shown = st.full.length;
    BTS.Dialogue.next();
    return true;
  };
  T.observe = function (id) {
    var e = BTS.World.get(id); if (!e) return 'no-ent';
    var p = BTS.World.player; p.x = e.x + 1.5; p.z = e.z + 0.5;
    BTS.Story.observe(e); return 'ok';
  };
  T.link = function (a, b) { return BTS.Journal.tryLink(a, b); };
  return T;
})();
