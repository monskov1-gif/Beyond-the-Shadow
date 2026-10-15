/* Story director: ordered beats grouped in chapters. A beat sets time/weather/mood, objective,
   NPC placements and states, interactables, triggers, and may play a one-time scene.
   Completed scenes are recorded and never replay after loading. */
'use strict';
BTS.Story = (function () {
  var S = { calls: {}, beats: [], byId: {} };
  var State = BTS.State;

  S.define = function (beats) { beats.forEach(function (b, i) { b.index = S.beats.length; S.beats.push(b); S.byId[b.id] = b; }); };
  S.hasBeat = function (id) { return !!S.byId[id]; };
  S.indexOf = function (id) { var b = S.byId[id]; return b ? b.index : -1; };
  S.beatId = function () { return State.d.beat; };
  S.cur = function () { return S.byId[State.d.beat]; };
  S.chapterKey = function (beatId) { var b = S.byId[beatId]; return 'chap.' + (b ? b.chapter : 'prologue'); };
  S.noSave = function () { var b = S.cur(); return !!(b && b.noSave) || S.busy || !!S.cardActive; };
  S.pastObjectives = function () {
    var out = [], ci = S.indexOf(State.d.beat);
    for (var i = 0; i < ci; i++) { var o = S.beats[i].obj; if (o && out.indexOf(o) < 0 && o !== State.d.objectiveKey) out.push(o); }
    return out.slice(-14);
  };
  /* beat range test: 'a..b' inclusive, or array of ids, or single id */
  S.inRange = function (r) {
    if (!r) return true;
    var ci = S.indexOf(State.d.beat);
    if (Array.isArray(r)) return r.some(S.inRange);
    if (r.indexOf('..') >= 0) { var p = r.split('..'); var a = p[0] ? S.indexOf(p[0]) : 0, b = p[1] ? S.indexOf(p[1]) : 1e9; return ci >= a && ci <= b; }
    if (r.slice(-1) === '*') return State.d.beat.indexOf(r.slice(0, -1)) === 0;
    return State.d.beat === r;
  };

  S.start = function () { S.goto(S.beats[0].id, true); };

  /* enter a beat. fresh=true when coming from the previous beat (not from a load) */
  S.goto = function (id, fresh) {
    var b = S.byId[id];
    if (!b) { BTS.Log.error('unknown beat', id); return; }
    var prev = S.cur();
    State.d.beat = id;
    State.d.chapter = b.chapter;
    if (b.day) State.d.day = b.day;
    if (b.obj !== undefined) { State.d.objectiveKey = b.obj; BTS.UI.setObjective(b.obj); }
    if (b.env) BTS.Env.set(b.env, !!b.envInstant);
    if (b.deaths) b.deaths.forEach(function (n) { State.kill(n); });
    if (b.stages) for (var n in b.stages) State.npc(n).stage = b.stages[n];
    if (b.items) b.items.forEach(function (it) { State.addItem(it); });
    BTS.Log.info('beat ->', id);
    BTS.Events.emit('beat', id);
    var needLoad = b.loc && (BTS.World.locId !== b.loc || b.spawn && b.forceSpawn);
    var run = function () {
      if (b.scene && !State.done('scene:' + id)) {
        S.busy = true;
        return BTS.Cutscene.play(function (C) { return b.scene(C); }, id).then(function () {
          State.markDone('scene:' + id);
          S.busy = false;
          if (State.d.beat === id) S.refresh();
          if (b.after) S.goto(b.after, true);
          else BTS.Save.autosave();
        });
      }
      S.refresh();
      if (fresh) BTS.Save.autosave();
    };
    var card = function () {
      S.cardActive = true; BTS.World.controlLocked = (BTS.World.controlLocked || 0) + 1;
      return BTS.UI.chapterTitle(b.chapterCard, b.chapterSub).then(function () { S.cardActive = false; BTS.World.controlLocked = Math.max(0, BTS.World.controlLocked - 1); });
    };
    if (needLoad) {
      if (b.chapterCard && !State.done('card:' + id)) {
        State.markDone('card:' + id);
        BTS.Env.fadeBlack = 1; BTS.Env.fadeGoal = 1;
        BTS.Game.enterLocation(b.loc, b.spawn, true);
        card().then(function () { BTS.Env.fadeTo(0, 0.8); run(); });
      } else { S.cardActive = true; BTS.Game.enterLocation(b.loc, b.spawn).then(function () { S.cardActive = false; run(); }); }
    } else if (b.chapterCard && !State.done('card:' + id)) {
      State.markDone('card:' + id);
      card().then(run);
    } else run();
  };
  S.next = function () { var b = S.cur(); var n = S.beats[b.index + 1]; if (n) S.goto(n.id, true); };

  /* after loading a save */
  S.resume = function () {
    var d = State.d, b = S.cur();
    BTS.Env.restore(d.env);
    BTS.UI.setObjective(d.objectiveKey);
    var loc = d.location || b.loc;
    BTS.Game.enterLocation(loc, d.player ? { x: d.player.x, z: d.player.z, dir: d.player.dir } : b.spawn, true);
    BTS.Env.restore(d.env);
    BTS.Env.fadeBlack = 1; BTS.Env.fadeTo(0, 1);
    if (b.scene && !State.done('scene:' + b.id)) S.goto(b.id, false);
  };
  S.refresh = function () { if (BTS.World.locId) { S.populate(BTS.World.locId); S.applyAudio(BTS.World.locId); } };

  /* ---------- NPC placement ---------- */
  S.placement = function (id) {
    if (State.isDead(id)) return null;
    var b = S.cur(); if (!b) return null;
    if (b.npcs && b.npcs[id] !== undefined) return b.npcs[id];
    if (b.hideAll && !(b.keep && b.keep.indexOf(id) >= 0)) return null;
    if (b.hide && b.hide.indexOf(id) >= 0) return null;
    var def = BTS.Data.npcs[id]; if (!def || !def.schedule) return null;
    var tn = BTS.Env.timeName();
    for (var i = 0; i < def.schedule.length; i++) {
      var e = def.schedule[i];
      if (!S.inRange(e.beats)) continue;
      if (e.time && e.time.indexOf(tn) < 0) continue;
      if (e.cond && !BTS.Cond.eval(e.cond)) continue;
      return e;
    }
    return null;
  };
  S.populate = function (loc) {
    var W = BTS.World;
    // remove previous npcs & story interactables
    W.entities = W.entities.filter(function (e) { return e.isPlayer || e.persistent; });
    W.interactables = []; W.triggers = [];
    var b = S.cur();
    var ldef = W.loc.def;
    Object.keys(BTS.Data.npcs).forEach(function (id) {
      var p = S.placement(id);
      if (!p || (p.loc !== loc && p.loc !== '*')) return;
      var at = p.loc === '*' ? { x: W.player.x + 0.9, z: W.player.z + 0.7 } : typeof p.at === 'string' ? W.spot(p.at) : (p.at ? { x: p.at[0], z: p.at[1] } : null);
      if (p.loc === '*' && W.blocked(at.x, at.z, 0.25)) at = { x: W.player.x, z: W.player.z + 0.6 };
      if (!at) return;
      var e = BTS.Game.spawnNPC(id, [at.x, at.z], { act: p.act || 'idle', dir: p.dir || at.dir, radius: p.radius, sheet: p.sheet, stage: p.stage, beast: p.beast, noTalk: p.noTalk, follow: p.follow });
      if (p.anim) e.anim.lock = p.anim;
    });
    // static story props (mourning objects, new graves...)
    (b && b.props || []).concat((BTS.Data.globalProps || []).filter(function (g) { return S.inRange(g.beats); })).forEach(function (pr, i) {
      if (pr.loc !== loc) return;
      var at = typeof pr.at === 'string' ? W.spot(pr.at) : { x: pr.at[0], z: pr.at[1] }; if (!at) return;
      var e = new BTS.Entity({ id: 'prop' + i, sprite: pr.sprite, x: at.x, z: at.z, shadow: false });
      e.solid = false; e.lift = pr.y || 0; e.scale = pr.scale; e.emissive = pr.emissive; e.persistent = false;
      W.addEntity(e);
    });
    // crowd extras (fair etc.)
    (b && b.extras || []).forEach(function (x, i) { if (x.loc !== loc) return; var at = typeof x.at === 'string' ? W.spot(x.at) : { x: x.at[0], z: x.at[1] }; if (!at) return; var e = new BTS.Entity({ id: 'extra' + i, kind: 'npc', sheet: x.sheet, x: at.x, z: at.z, dir: x.dir || 'down', speed: 1.4 }); e.brain = new BTS.Brain('villager'); e.brain.setTask({ at: [at.x, at.z], act: x.act || 'idle', dir: x.dir, radius: x.radius || 3 }, e, true); W.addEntity(e); if (x.talk !== false) W.addInteract({ id: 'talkx' + i, ent: e, r: 1.4, verb: 'verb.talk', label: 'name.villager', hy: 1.9, action: function () { S.talkExtra(x, e); } }); });
    // animals
    (ldef.animals || []).forEach(function (a, i) {
      if (a.cond && !BTS.Cond.eval(a.cond)) return;
      var e = new BTS.Entity({ id: 'animal' + i, kind: 'animal', sprite: a.sprite, x: a.at[0], z: a.at[1], radius: 0.2, castShadow: true, speed: a.speed || 0.8 });
      e.solid = false; e.animal = { home: a.at, range: a.range || 2, t: Math.random() * 3, flee: a.flee };
      e.spriteFlip = Math.random() < 0.5;
      W.addEntity(e);
    });
    // exits
    (ldef.exits || []).forEach(function (x) {
      var at = typeof x.at === 'string' ? W.spot(x.at) : { x: x.at[0], z: x.at[1] };
      W.addInteract({ id: 'exit_' + x.id, x: at.x, z: at.z, r: x.r || 1.3, verb: x.verb || 'verb.enter', label: x.label || ('loc.' + x.to), hy: x.hy || 1.6, priority: 0.2, action: function () { S.useExit(x); } });
      if (x.walk) W.addTrigger({ box: x.walk, onEnter: function () { S.useExit(x); } });
    });
    // location examinables (flavor)
    (ldef.examine || []).forEach(function (x) { if (x.when && !S.inRange(x.when)) return; S.addInteract(x, loc); });
    // beat interactables & triggers (beat-local and persistent lists)
    var lists = [];
    if (b && b.interact) lists.push(b.interact);
    (BTS.Data.globalInteract || []).forEach(function (g) { if (S.inRange(g.beats)) lists.push([g]); });
    lists.forEach(function (l) { l.forEach(function (x) { if (x.loc === loc) S.addInteract(x, loc); }); });
    (b && b.triggers || []).forEach(function (tr, i) {
      if (tr.loc !== loc) return;
      var key = 'trig:' + b.id + ':' + (tr.id || i);
      if (tr.once !== false && State.done(key)) return;
      W.addTrigger({ box: tr.box, cond: tr.cond ? function () { return BTS.Cond.eval(tr.cond); } : null, once: tr.once !== false, onEnter: function () { if (tr.once !== false) State.markDone(key); S.runAction(tr, key); } });
    });
    // shadow states from beat
    if (b && b.shadows) for (var id in b.shadows) { var e2 = W.get(id); if (e2 && e2.shadow) { var so = b.shadows[id]; if (so.stage !== undefined) e2.shadow.setStage(so.stage); if (so.beast !== undefined) e2.shadow.beast = so.beast; } }
    if (b && b.onPopulate) b.onPopulate(loc, W);
  };
  S.populateMenu = function () {
    var W = BTS.World;
    ['vil_man1', 'vil_woman1'].forEach(function (sh, i) { var sp = W.spot('menu_npc' + i); if (!sp) return; var e = new BTS.Entity({ id: 'm' + i, kind: 'npc', sheet: sh, x: sp.x, z: sp.z, dir: 'down' }); e.brain = new BTS.Brain('villager'); e.brain.setTask({ at: [sp.x, sp.z], act: 'wander', radius: 4 }, e, true); W.addEntity(e); });
  };

  S.addInteract = function (x, loc) {
    var W = BTS.World;
    var key = 'int:' + (x.id || x.dlg);
    if (x.once && State.done(key)) return;
    if (x.cond && !BTS.Cond.eval(x.cond)) { if (!x.condLive) return; }
    var at = typeof x.at === 'string' ? W.spot(x.at) : { x: x.at[0], z: x.at[1] };
    if (!at) { BTS.Log.warn('interact without position', x.id); return; }
    W.addInteract({
      id: x.id, x: at.x, z: at.z, r: x.r || 1.2, verb: x.verb || 'verb.examine', label: x.label, hy: x.hy, hint: x.hint !== undefined ? x.hint && !State.done(key) : (!!x.clue && !State.done(key)),
      cond: x.condLive ? function () { return BTS.Cond.eval(x.cond); } : null,
      action: function () { S.runAction(x, key); }
    });
  };
  /* run an interactable/trigger: dialogue and/or scripted scene, clue, item, beat change */
  S.runAction = function (x, key) {
    if (x.need && !BTS.Cond.eval(x.need)) { if (x.needDlg) BTS.Cutscene.play(function (C) { return C.say(x.needDlg); }, 'need'); return; }
    var after = function () {
      if (x.clue) [].concat(x.clue).forEach(function (c) { State.addClue(c); });
      if (x.item) [].concat(x.item).forEach(function (c) { State.addItem(c); });
      if (x.set) State.set(x.set);
      if (x.once) { State.markDone(key); BTS.World.removeInteract(x.id); }
      else if (key) State.markDone(key);
      if (x.then) S.goto(x.then, true);
      else if (x.thenIf) { for (var i = 0; i < x.thenIf.length; i++) if (BTS.Cond.eval(x.thenIf[i][0])) { S.goto(x.thenIf[i][1], true); break; } }
      else S.refreshHints();
    };
    if (x.sfx) BTS.Audio.play(x.sfx, { x: BTS.World.player.x, z: BTS.World.player.z });
    else if (x.verb === 'verb.read') BTS.Audio.play('paper', {});
    else if (x.verb === 'verb.take') BTS.Audio.play('cloth', {});
    if (x.run) BTS.Cutscene.play(function (C) { return x.run(C); }, x.id).then(after);
    else if (x.dlg) BTS.Cutscene.play(function (C) { return C.say(typeof x.dlg === 'function' ? x.dlg() : x.dlg); }, x.id).then(after);
    else after();
  };
  S.refreshHints = function () {
    BTS.World.interactables.forEach(function (it) { if (it.hint && State.done('int:' + it.id)) it.hint = false; });
  };
  S.useExit = function (x) {
    if (x.cond && !BTS.Cond.eval(x.cond)) {
      BTS.Cutscene.play(function (C) { return C.say(x.lockedDlg || 'locked_generic'); }, 'locked');
      return;
    }
    var b = S.cur();
    if (b && b.blockExit && b.blockExit[x.id]) { BTS.Cutscene.play(function (C) { return C.say(b.blockExit[x.id]); }, 'blocked'); return; }
    BTS.Audio.play(x.sfx || (x.door === false ? 'step' : 'door_open'), {});
    BTS.Game.enterLocation(x.to, x.spawn).then(function () { if (x.door !== false) BTS.Audio.play('door_close', { vol: 0.6 }); });
  };

  S.interact = function (it) { if (it && it.action) it.action(); };

  /* ---------- talking ---------- */
  S.talk = function (id, e) {
    var list = BTS.Data.talk[id] || [];
    var pick = null;
    for (var i = 0; i < list.length; i++) { var o = list[i]; if (S.inRange(o.beats) && BTS.Cond.eval(o.if)) { pick = o; break; } }
    var dlg = pick ? pick.dlg : 'talk_generic';
    var p = BTS.World.player;
    if (e) { e.brain.state = 'talking'; e.brain.talkTo = p; p.faceTo(e.x, e.z); }
    BTS.Cutscene.play(function (C) { return C.say(dlg); }, 'talk_' + id).then(function () {
      if (e && e.brain) { e.brain.state = 'idle'; e.brain.talkTo = null; }
      if (pick) { if (pick.set) State.set(pick.set); if (pick.clue) [].concat(pick.clue).forEach(function (c) { State.addClue(c); }); if (pick.then) S.goto(pick.then, true); }
    });
  };
  S.talkExtra = function (x, e) {
    var opts = x.lines || ['extra_a', 'extra_b', 'extra_c'];
    var dlg = opts[Math.abs(BTS.strHash(e.id + State.d.beat)) % opts.length];
    var p = BTS.World.player; p.faceTo(e.x, e.z); e.faceTo(p.x, p.z);
    BTS.Cutscene.play(function (C) { return C.say(dlg); }, 'extra');
  };

  /* ---------- shadow observation ---------- */
  S.observe = function (ent) {
    var b = S.cur(), rule = b && b.observe && b.observe[ent.id];
    var stage = ent.shadow ? ent.shadow.stage : 0;
    if (rule && !State.done('obs:' + b.id + ':' + ent.id)) {
      State.markDone('obs:' + b.id + ':' + ent.id);
      S.runAction(rule, null);
      return;
    }
    if (stage > 0 || (ent.shadow && ent.shadow.beast)) BTS.Audio.play('heartbeat', { vol: 0.7 });
    var key = stage === 0 && !(ent.shadow && ent.shadow.beast) ? 'obs_normal' : (ent.shadow && ent.shadow.beast ? 'obs_beast' : 'obs_odd');
    BTS.Cutscene.play(function (C) { return C.say(key); }, 'obs');
  };
  S.observeNothing = function () { BTS.Cutscene.play(function (C) { return C.say('obs_none'); }, 'obs'); };

  /* ---------- per-frame + audio ---------- */
  S.update = function (dt) {
    var b = S.cur();
    if (b && b.tick && !BTS.Cutscene.running) b.tick(dt, BTS.World);
  };
  S.applyAudio = function (loc) {
    var b = S.cur(), def = BTS.World.loc && BTS.World.loc.def;
    if (BTS.Cutscene.running && S.busy) return;
    var m = (b && b.musicByLoc && b.musicByLoc[loc]) || (b && b.music) || (def && def.music) || 'village';
    if (BTS.Ambience && def) { var prof = {}, k; for (k in (def.ambience || {})) prof[k] = def.ambience[k]; if (b && b.ambience && !def.interior) for (k in b.ambience) prof[k] = b.ambience[k]; BTS.Ambience.setProfile(prof); }
    BTS.Music.set(m);
  };
  return S;
})();
