/* Game controller: boot, main menu backdrop, new game / continue / load, location transitions,
   player interaction & shadow observation, hotkeys, footsteps, area discovery, playtime. */
'use strict';
BTS.Game = (function () {
  var G = { started: false, mode: 'boot', transitioning: false, observing: null };

  G.boot = function () {
    var canvas = document.getElementById('game');
    BTS.Renderer.init(canvas);
    BTS.Textures.build(); BTS.CharSprites.build(); BTS.PropSprites.build();
    BTS.Renderer.uploadAtlas();
    BTS.I18N.load();
    BTS.UI.init();
    BTS.World.prebuild(['village']);
    BTS.Events.on('footstep', onFootstep);
    BTS.Events.on('location', function (id, def) {
      if (BTS.Ambience) BTS.Ambience.setProfile(def.ambience || {});
      if (G.started && def.nameKey && !BTS.Cutscene.running) BTS.UI.showBanner(BTS.t(def.nameKey));
    });
    document.getElementById('boot').style.display = 'none';
    var q = new URLSearchParams(location.search);
    G.query = q;
    if (q.get('dev')) BTS.Config.data.devMode = true;
    BTS.App.start(update, render);
    if (q.get('test')) { BTS.Test && BTS.Test.boot(q.get('test')); return; }
    if (!BTS.Config.get('language')) { G.menuBackdrop(); BTS.Screens.language(function () { G.toMenu(); }); }
    else { BTS.I18N.set(BTS.Config.get('language')); G.toMenu(); }
  };

  /* main menu over a living night view of the village */
  G.menuBackdrop = function () {
    G.mode = 'menu'; G.started = false;
    BTS.World.load('village', 'menu_cam');
    BTS.World.player.hidden = true;
    BTS.Env.set({ time: 'night', weather: 'fog', horror: 0.15, interior: false }, true);
    BTS.Env.fadeBlack = 0; BTS.Env.fadeGoal = 0;
    var s = BTS.World.spot('menu_cam');
    BTS.Camera.cinematic({ target: [s.x, 2, s.z], dist: 46, pitch: 0.5, time: 0.01 });
    BTS.Story.populateMenu();
    BTS.Music.set('menu', 2);
  };
  G.toMenu = function () {
    BTS.Dialogue.active && BTS.Dialogue.abort();
    BTS.UI.closeAll();
    BTS.UI.setObjective(null);
    BTS.UI.letterbox(false);
    BTS.Env.sepiaGoal = 0; BTS.Env.sepia = 0;
    BTS.App.timeScale = 1;
    G.menuBackdrop();
    BTS.Screens.main();
  };

  G.newGame = function () {
    BTS.State.reset();
    G.started = true; G.mode = 'play';
    BTS.UI.closeAll();
    BTS.Story.start();
  };
  G.loadSlot = function (slot) {
    var r = BTS.Save.read(slot);
    if (!r.ok) { BTS.UI.toast(BTS.t('ui.slot_corrupt')); return false; }
    BTS.UI.closeAll();
    if (BTS.Dialogue.active) BTS.Dialogue.abort();
    BTS.Cutscene.timers.length = 0; BTS.Cutscene.running = 0; BTS.World.controlLocked = 0;
    BTS.State.d = r.data;
    if (r.data.language) BTS.I18N.set(r.data.language);
    G.started = true; G.mode = 'play';
    BTS.Story.resume();
    return true;
  };

  /* fade, swap location, populate from story state, fade back */
  G.enterLocation = function (loc, spawn, instant) {
    var go = function () {
      BTS.World.load(loc, spawn);
      BTS.Story.populate(loc);
      BTS.Story.applyAudio(loc);
    };
    if (instant) { go(); return Promise.resolve(); }
    if (G.transitioning) return Promise.resolve();
    G.transitioning = true;
    BTS.Audio.play('transition');
    BTS.World.controlLocked++;
    return BTS.Env.fadeTo(1, 3).then(function () {
      go();
      return BTS.Env.fadeTo(0, 2.2);
    }).then(function () { G.transitioning = false; BTS.World.controlLocked = Math.max(0, BTS.World.controlLocked - 1); });
  };

  G.spawnNPC = function (id, at, o) {
    o = o || {};
    var def = BTS.Data.npcs[id] || {};
    var sheet = o.sheet || def.sheet || id;
    BTS.World.removeEntity(id);
    var e = new BTS.Entity({ id: id, kind: 'npc', sheet: sheet, x: at[0], z: at[1], dir: o.dir || 'down', speed: def.speed || 1.9 });
    e.brain = new BTS.Brain(id);
    e.add('brainc', e.brain);
    if (o.act) e.brain.setTask({ at: at.slice(), act: o.act, dir: o.dir, radius: o.radius }, e, true);
    BTS.World.addEntity(e);
    var st = BTS.State.npc(id);
    if (e.shadow) { e.shadow.setStage(o.stage !== undefined ? o.stage : (st.stage || 0)); if (o.beast !== undefined) e.shadow.beast = o.beast; }
    if (!o.noTalk) BTS.World.addInteract({ id: 'talk_' + id, ent: e, r: 1.5, verb: 'verb.talk', label: (BTS.Data.people[id] || BTS.Data.people.villager).name, hy: 1.9, action: function () { BTS.Story.talk(id, e); } });
    return e;
  };

  function onFootstep(e) {
    if (!BTS.Audio.ready) return;
    var c = BTS.Camera.target;
    if (Math.hypot(e.x - c[0], e.z - c[2]) > 16) return;
    var surf = BTS.World.surfaceAt(e.x, e.z);
    var distorted = e.isPlayer && BTS.Env.horror > 0.6 && Math.random() < 0.3;
    BTS.Audio.play(distorted ? 'step_distorted' : 'step', { x: e.x, z: e.z, surface: surf, vol: e.isPlayer ? 0.9 : 0.6, pitch: e.isPlayer ? 1.05 : 0.95, reverb: BTS.World.interior ? 0.9 : 0.3 });
  }

  /* shadow observation: Djordje studies a shadow and sketches it */
  function tryObserve() {
    var p = BTS.World.player, best = null, bd = 6;
    BTS.World.entities.forEach(function (e) { if (e === p || e.hidden || !e.shadow) return; var d = p.dist(e); if (d < bd) { bd = d; best = e; } });
    if (!best) { BTS.Story.observeNothing(); return; }
    G.observing = { ent: best, t: 0 };
    p.faceTo(best.x, best.z);
    p.anim.lock = 'sketch';
    BTS.Audio.play('sketch');
  }

  function update(dt) {
    var I = BTS.Input, U = BTS.UI;
    if (G.mode === 'menu') {
      U.update(dt);
      BTS.World.update(dt, false);
      BTS.Env.update(dt, BTS.Camera.target);
      var tt = BTS.App.time * 0.05, s = BTS.World.spot('menu_cam');
      if (s) { BTS.Camera.cine = null; BTS.Camera.target = [s.x + Math.sin(tt) * 6, 2.5, s.z + Math.cos(tt * 0.7) * 2]; }
      BTS.Camera.update(dt, null);
      BTS.Particles.update(dt, BTS.Camera);
      if (BTS.Ambience) BTS.Ambience.update(dt);
      U.updateHUD();
      return;
    }
    if (G.mode !== 'play') { U.update(dt); return; }
    var menuOpen = U.update(dt);
    if (menuOpen) { U.updateHUD(); if (BTS.Ambience) BTS.Ambience.update(dt); BTS.Env.update(0, BTS.Camera.target); return; }  // paused
    BTS.State.d.playtime += dt;
    var inDialogue = U.updateDialogue(dt);
    var free = !inDialogue && !BTS.Cutscene.running && !G.transitioning && !G.observing;
    // hotkeys
    if (!inDialogue && !G.transitioning) {
      if (I.pressed.pause) { BTS.Screens.pause(); I.consume('pause'); }
      else if (I.pressed.journal) BTS.Journal.open();
      else if (I.pressed.map) BTS.MapUI.open();
      else if (I.pressed.inventory) BTS.Inventory.open();
    }
    if (free) {
      if (I.pressed.interact && BTS.World.focusInteract) { var it = BTS.World.focusInteract; I.consume('interact'); BTS.Story.interact(it); }
      else if (I.pressed.observe) tryObserve();
    }
    if (G.observing) {
      G.observing.t += dt;
      if (G.observing.t > 1.6) { var ob = G.observing; G.observing = null; BTS.World.player.anim.lock = null; BTS.Story.observe(ob.ent); }
    }
    BTS.Cutscene.update(dt);
    BTS.World.update(dt, free);
    BTS.Story.update(dt);
    // area discovery
    var W = BTS.World, p = W.player;
    if (W.loc && p && W.loc.areas) W.loc.areas.forEach(function (a) { var b = a.box; if (p.x > b[0] && p.x < b[2] && p.z > b[1] && p.z < b[3]) BTS.State.reveal(a.id); });
    if (W.loc && W.loc.def.mapArea) BTS.State.reveal(W.loc.def.mapArea);
    BTS.Env.update(dt, BTS.Camera.target);
    BTS.Camera.update(dt, p && !p.hidden ? [p.x, p.y, p.z] : (BTS.Camera.goal || null));
    BTS.Particles.update(dt, BTS.Camera);
    if (BTS.Ambience) BTS.Ambience.update(dt);
    U.updateHUD();
  }
  function render() {
    BTS.Renderer.beginFrame();
    BTS.World.render(BTS.Renderer, BTS.Env);
    BTS.Particles.render(BTS.Renderer, BTS.Env);
    BTS.Renderer.render(BTS.World, BTS.Env, BTS.Camera);
  }
  window.addEventListener('beforeunload', function () { BTS.Config.save(); });
  window.addEventListener('resize', function () { BTS.Renderer.canvas && BTS.Renderer.resize(); });
  return G;
})();
