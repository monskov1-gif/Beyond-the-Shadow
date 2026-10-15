/* CHAPTER 8 — the legend. CHAPTER 9 — rising threat. CHAPTER 10 — the rite. CHAPTER 11 — release. EPILOGUE. */
'use strict';
(function () {
  var D = BTS.D, U = BTS.StoryUtil, when = U.when, add = U.add, S = BTS.State;
  var LISA_FOLLOW = { loc: '*', follow: true, act: 'idle' };
  function setSheet(id) { var p = BTS.World.player; p.add('anim', new BTS.Animator(id)); }

  /* ---------- the rite (chapter 10): a writhing shadow-beast whose head must be pierced ---------- */
  var R = null;
  var RING = [90.5, 82];
  BTS.Rite = { get: function () { return R; } };
  function riteStart(W) {
    R = { t: 0, head: [RING[0] + 3, RING[1] - 1], ang: 0, freeze: 0, nextStrike: 5, misses: 0, knock: 0, onShadow: 0, said: {}, done: false, cool: 0 };
    var j = W.get('jaglika');
    if (j) { j.shadow.beast = 0.9; j.shadow.visible = false; if (j.brain) { j.brain.paused = true; j.keepPaused = true; } j.anim.lock = 'point'; }
    W.extraRender = riteRender;
  }
  function headPos(t) { var a = t * 0.45, r = 3.2 + Math.sin(t * 0.7) * 1.1; return [RING[0] + Math.cos(a) * r, RING[1] + Math.sin(a) * r * 0.75]; }
  function riteTick(dt, W) {
    if (!R || R.done || W.locId !== 'village') return;
    var p = W.player, j = W.get('jaglika'); if (!j) return;
    R.t += dt; R.cool -= dt;
    if (R.freeze > 0) { R.freeze -= dt; if (R.freeze <= 0) BTS.Env.supernatural = 0.8; }
    else { R.head = headPos(R.t); R.nextStrike -= dt; }
    if (R.freeze <= 0 && R.nextStrike <= 0) {
      BTS.Env.strike();
      R.freeze = R.misses >= 2 ? 2.8 : 1.8; R.nextStrike = 6 + Math.random() * 3; BTS.Env.supernatural = 0;
      BTS.Audio.play('shadow_stretch', {});
      if (!R.said.freeze) { R.said.freeze = true; say('c10_hint_freeze'); }
    }
    // standing on the beast's body slows Đorđe and whispers at him
    var hx = R.head[0], hz = R.head[1];
    var segd = distToSeg(p.x, p.z, j.x, j.z, hx, hz);
    var on = segd < 1.1;
    W.speedMul = on ? 0.55 : 1;
    if (on) { R.onShadow += dt; if (R.onShadow > 0.8 && !R.said.fear) { R.said.fear = true; say('c10_fear'); } }
    var dh = Math.hypot(p.x - hx, p.z - hz);
    if (BTS.Input.pressed.interact && R.cool <= 0 && !BTS.Cutscene.running) {
      BTS.Input.consume('interact');
      if (dh < 1.6 && R.freeze > 0) { R.done = true; W.speedMul = 1; BTS.Story.goto('c11_release', true); return; }
      R.cool = 1.2; R.misses++;
      var ax = p.x - j.x, az = p.z - j.z, al = Math.hypot(ax, az) || 1;
      p.x += ax / al * 2.5; p.z += az / al * 2.5; BTS.Physics.resolve(p, W.colliders, W.entities);
      BTS.Camera.shake = 1; BTS.Audio.play('shadow_detach', {});
      if (p.shadow) p.shadow.setStage(Math.min(2, R.misses));
      say(dh < 1.6 ? 'c10_miss_early' : 'c10_miss_far');
    }
    if (dh < 2.2 && R.freeze > 0 && !R.said.now) { R.said.now = true; say('c10_now'); }
  }
  function say(id) { BTS.Cutscene.play(function (C) { return C.say(id); }, id); }
  function distToSeg(px, pz, ax, az, bx, bz) { var dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, t = l ? BTS.M.clamp(((px - ax) * dx + (pz - az) * dz) / l, 0, 1) : 0; return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
  function riteRender(Rd, env) {
    if (!R) return;
    var W = BTS.World, j = W.get('jaglika'); if (!j || j.hidden) return;
    var t = BTS.App.time, hx = R.head[0], hz = R.head[1];
    var reg = BTS.Atlas.get('shadow_beast_' + (R.freeze > 0 ? 1 : Math.floor(t * 4) % 4));
    var dx = hx - j.x, dz = hz - j.z, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
    var w = 2.6 + (R.freeze > 0 ? 0.6 : Math.sin(t * 3) * 0.4), px = -uz * w / 2, pz = ux * w / 2;
    var y0 = W.heightAt(j.x, j.z) + 0.05, y1 = W.heightAt(hx, hz) + 0.05, hl = len + 1.2;
    var ex = j.x + ux * hl, ez = j.z + uz * hl;
    var a = R.freeze > 0 ? 0.92 : 0.7;
    Rd.pushFx(0, [[j.x - px, y0, j.z - pz], [j.x + px, y0, j.z + pz], [ex + px, y1, ez + pz], [ex - px, y1, ez - pz]], reg, [0.01, 0, 0.02, a]);
    // the head: a pulsing dark knot; during the freeze a faint pale rim marks the moment
    var hr = 0.9 + (R.freeze > 0 ? 0.25 : Math.sin(t * 6) * 0.1);
    Rd.pushFx(3, [[hx - hr, y1 + 0.02, hz + hr], [hx + hr, y1 + 0.02, hz + hr], [hx + hr, y1 + 0.02, hz - hr], [hx - hr, y1 + 0.02, hz - hr]], BTS.Atlas.get('soft_dot'), [0, 0, 0.02, 0.95]);
    if (R.freeze > 0) Rd.pushFx(2, [[hx - 1.4, y1 + 0.03, hz + 1.4], [hx + 1.4, y1 + 0.03, hz + 1.4], [hx + 1.4, y1 + 0.03, hz - 1.4], [hx - 1.4, y1 + 0.03, hz - 1.4]], BTS.Atlas.get('soft_dot'), [0.6, 0.65, 0.9, 0.18 + 0.1 * Math.sin(t * 20)]);
    // shadow climbing the maypole and stalls (walls)
    var sway = Math.sin(t * 1.4) * 0.5, wy = W.heightAt(84, 76.5);
    Rd.pushFx(3, [[83.2, wy, 76.9], [84.8, wy, 76.9], [85.2 + sway, wy + 6, 76.9], [82.8 + sway, wy + 6, 76.9]], BTS.Atlas.get('shadow_beast_2'), [0.01, 0, 0.02, 0.55]);
  }

  /* ---------- climax helpers ---------- */
  var VICTIMS = ['zajko', 'pecko', 'gvozdin', 'gorazd', 'jessica', 'tihomir', 'vil_man1', 'vil_woman1', 'vil_old', 'vil_woman2', 'vil_man2', 'vil_boy', 'dancer1', 'dancer2', 'vil_old', 'vil_woman1', 'vil_man1', 'vil_woman2'];
  function spawnShades(cx, cz, n, rad) {
    var list = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * 6.283, sh = VICTIMS[i % VICTIMS.length];
      var e = new BTS.Entity({ id: 'shade' + i, kind: 'npc', sheet: sh, x: cx + Math.cos(a) * rad, z: cz + Math.sin(a) * rad * 0.8, speed: 3.4 + Math.random() * 0.6, shadow: false });
      e.tint = [0.03, 0.03, 0.06]; e.solid = false; e.pathRun = true;
      BTS.World.addEntity(e); list.push(e);
    }
    return list;
  }
  function chase(list, target, spread) {
    list.forEach(function (e, i) { var a = i * 2.4; e.path = [[target[0] + Math.cos(a) * spread, target[1] + Math.sin(a) * spread * 0.7]]; e.pathRun = true; e.pathSpeed = 1; });
  }

  BTS.Story.define([
    /* ================= CHAPTER 8 ================= */
    { id: 'c8_chest', chapter: 'ch8', obj: 'obj.c8_chest', env: { time: 'night', weather: 'overcast', horror: 0.35 }, music: 'explore',
      npcs: { lisa: { loc: 'djordje_house', at: 'lisa_table', act: 'idle', dir: 'left' } },
      interact: [{ loc: 'djordje_house', id: 'chest', at: [8.7, 6.9], label: 'it.chest', verb: 'verb.open', dlg: 'c8_chest', item: 'grandma_cloth', hint: true, sfx: 'drawer', then: 'c8_memory' }]
    },
    { id: 'c8_memory', chapter: 'ch8', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'loc.memory', chapterSub: 'sub.c8', obj: 'obj.c8_memory', music: 'memory', noSave: true,
      env: { time: 'evening', weather: 'clear', horror: 0 }, envInstant: true,
      npcs: { baka: { loc: 'djordje_house', at: 'baka_chair', act: 'sit', dir: 'down' }, lisa: null },
      onPopulate: function () { setSheet('djordje_young'); BTS.Env.sepiaGoal = 0.85; BTS.Env.sepia = 0.85; },
      scene: function (C) { return C.say('c8_mem_in'); }
    },
    { id: 'c8_back', chapter: 'ch8', loc: 'djordje_house', spawn: 'chest', forceSpawn: true, obj: null, env: { time: 'night', weather: 'overcast', horror: 0.35 }, envInstant: true, music: 'explore',
      npcs: { lisa: { loc: 'djordje_house', at: 'lisa_table', act: 'idle', dir: 'left' } },
      onPopulate: function () { setSheet('djordje'); BTS.Env.sepiaGoal = 0; BTS.Env.sepia = 0; },
      scene: function (C) { return C.say('c8_back').then(function () { C.clue('hyp_needle_rule'); return C.fade(1, 0.6); }); }, after: 'c9_silence'
    },
    /* ================= CHAPTER 9 ================= */
    { id: 'c9_silence', chapter: 'ch9', loc: 'djordje_house', spawn: 'bed', forceSpawn: true, chapterCard: 'chap.ch9', chapterSub: 'sub.c9', day: 91, deaths: ['tihomir'],
      env: { time: 'morning', weather: 'overcast', horror: 0.5 }, envInstant: true, obj: 'obj.c9_silence', music: 'silence',
      npcs: { lisa: LISA_FOLLOW },
      scene: function (C) { C.anim('player', 'sit'); return C.wait(2.5).then(function () { return C.say('c9_wake'); }); },
      extras: [{ loc: 'village', sheet: 'vil_man1', at: [76, 44], act: 'mourn', dir: 'up', lines: ['extra_fear_c'] }],
      triggers: [{ loc: 'village', box: [68, 38, 84, 50], run: function (C) {
        C.spawn('vesna', [70.5, 49.8], { act: 'idle', dir: 'left', noTalk: true }); C.spawn('radoje', [62.5, 50.6], { act: 'idle', dir: 'right', noTalk: true });
        return C.cam({ target: [72, 1, 45], time: 1.5 }).then(function () { return C.say('c9_village'); });
      }, clue: 'fact_tihomir_death', then: 'c9_dusk' }]
    },
    { id: 'c9_dusk', chapter: 'ch9', obj: 'obj.c9_dusk', env: { time: 'evening', weather: 'overcast', horror: 0.55, transition: 25 }, music: 'jaglika',
      npcs: { lisa: LISA_FOLLOW, jaglika: { loc: 'village', at: [83.6, 30.2], act: 'idle', dir: 'up', noTalk: true, beast: 0.55 } },
      hide: ['vesna', 'radoje', 'mila', 'luka'],
      triggers: [{ loc: 'village', box: [72, 33, 96, 50], run: function (C) {
        C.shadow('jaglika', { beast: 0.6, wall: { x: 87, z: 26.6, y: BTS.World.heightAt(87, 26.6) } }); C.supernatural(0.6);
        C.sfx('shadow_move', { x: 86, z: 28 }); C.sfx('crow', { x: 88, z: 24 });
        return C.cam({ target: [86, 2, 28], time: 1.8 }).then(function () { C.sfx('sting_low', {}); return C.say('c9_beast'); })
          .then(function () { return C.walk('jaglika', [78, 36], { noWait: true }); }).then(function () { return C.wait(1.5); })
          .then(function () { C.despawn('jaglika'); C.supernatural(0); });
      }, clue: 'sk_jaglika_beast', then: 'c9_lisa' }],
      blockExit: { west: 'block_night', south: 'block_night' }
    },
    { id: 'c9_lisa', chapter: 'ch9', obj: 'obj.c9_lisa', music: 'tension', env: { time: 'night', weather: 'overcast', horror: 0.55 },
      npcs: { lisa: { loc: 'djordje_house', at: 'lisa_table', act: 'idle', dir: 'left' } },
      triggers: [{ loc: 'djordje_house', box: [-1, -1, 19, 10], run: function (C) {
        C.place('lisa', 'lisa_table', 'left');
        return C.say('c9_decide');
      }, set: 'tihomir_open', then: 'c9_needle' }],
      blockExit: { west: 'block_night', south: 'block_night' }
    },
    { id: 'c9_needle', chapter: 'ch9', obj: 'obj.c9_needle', music: 'tension', npcs: { lisa: LISA_FOLLOW },
      props: [{ loc: 'tihomir_house', sprite: 'cloth_dark', at: [4.6, 0.3], y: 1.2, scale: 2.5 }],
      interact: [{ loc: 'tihomir_house', id: 'pillow', at: [10.8, 1.2], label: 'it.pillow', verb: 'verb.take', dlg: 'c9_pillow', item: 'ritual_needle', hint: true, then: 'c9_prepare' }],
      blockExit: { west: 'block_night', south: 'block_night' }
    },
    { id: 'c9_prepare', chapter: 'ch9', obj: 'obj.c9_prepare', music: 'tension', npcs: { lisa: LISA_FOLLOW },
      interact: [{ loc: 'djordje_house', id: 'lantern', at: [1.6, 2.4], label: 'it.lantern', verb: 'verb.take', dlg: 'c9_lantern', item: 'lantern', hint: true, once: true }],
      tick: when('c9_ready', 'item:lantern', function (C) { return C.say('c9_ready').then(function () { return C.fade(1, 0.6); }); }, 'c10_meadow'),
      blockExit: { west: 'block_night', south: 'block_night' }
    },
    /* ================= CHAPTER 10 ================= */
    { id: 'c10_meadow', chapter: 'ch10', loc: 'village', spawn: 'fair_entry', forceSpawn: true, chapterCard: 'chap.ch10', chapterSub: 'sub.c10', day: 94,
      env: { time: 'night', weather: 'storm', horror: 0.6 }, envInstant: true, obj: 'obj.c10_meadow', music: 'tension', noSave: false,
      npcs: { lisa: LISA_FOLLOW }, hideAll: true, keep: ['lisa'],
      onPopulate: function (loc, W) { if (loc !== 'village') return; W.speedMul = 1; var lit = S.flag('fire_lit'); BTS.Env.lights.forEach(function (l) { if (Math.hypot(l.x - 90.5, l.z - 82.3) < 1 && l.kind === 'fire') l.off = !lit; }); W.statics.forEach(function (s) { if (s.fire && Math.hypot(s.x - 90.5, s.z - 82) < 1.5) s.off = !lit; if (s.pool && Math.hypot(s.pool[0] - 90.5, s.pool[2] - 82) < 1) s.off = !lit; }); },
      interact: [{ loc: 'village', id: 'light_fire', at: [90.5, 82], label: 'it.bonfire', verb: 'verb.use', r: 1.8, dlg: 'c10_fire', set: 'fire_lit', sfx: 'match', hint: true, then: 'c10_rite' }],
      blockExit: { west: 'block_night', south: 'block_night', djordje: 'block_night' }
    },
    { id: 'c10_rite', chapter: 'ch10', obj: 'obj.c10_rite', music: 'ritual', noSave: true,
      npcs: { lisa: { loc: 'village', at: [84.5, 85.6], act: 'fear', dir: 'up' }, jaglika: { loc: 'village', at: [96.5, 81.5], act: 'idle', dir: 'left', noTalk: true, beast: 0.9 } },
      hideAll: true, keep: ['lisa', 'jaglika'],
      onPopulate: function (loc, W) {
        if (loc !== 'village') return;
        BTS.Env.lights.forEach(function (l) { if (Math.hypot(l.x - 90.5, l.z - 82.3) < 1) { l.off = false; l.radius = 15; l.intensity = 2.9; } }); W.statics.forEach(function (s) { if (s.fire || s.pool) s.off = false; });
      },
      scene: function (C) {
        C.intensity(0.2);
        return C.cam({ target: [93, 1, 82], time: 1.6 }).then(function () { return C.say('c10_arrive'); })
          .then(function () { C.shadow('jaglika', { beast: 0.95 }); C.sfx('shadow_tear', {}); C.shake(0.8); C.intensity(0.6); return C.say('c10_grow'); })
          .then(function () { riteStart(BTS.World); C.intensity(0.8); });
      },
      tick: function (dt, W) { if (!R && W.get('jaglika') && S.done('scene:c10_rite')) riteStart(W); riteTick(dt, W); BTS.Music.intensity = Math.min(1, 0.6 + (R ? R.t / 90 : 0)); }
    },
    /* ================= CHAPTER 11 ================= */
    { id: 'c11_release', chapter: 'ch11', obj: null, music: 'silence', noSave: true,
      npcs: { lisa: { loc: 'village', at: [84.5, 85.6], act: 'idle', dir: 'up' }, jaglika: { loc: 'village', at: [96.5, 81.5], act: 'idle', dir: 'left', noTalk: true } },
      hideAll: true, keep: ['lisa', 'jaglika'],
      scene: function (C) {
        var W = BTS.World, j = C.ent('jaglika'), shades;
        W.extraRender = null;
        C.musicCut(); C.timeScale(0.35); C.sfx('shadow_tear', {}); C.shake(1.4);
        if (j) { j.shadow.beast = 0; j.shadow.visible = false; j.anim.lock = 'fear'; }
        return C.say('c11_pierce').then(function () {
          C.timeScale(1); C.sfx('shadow_release', {}); C.music('release', 0.5);
          shades = spawnShades(j.x, j.z, 18, 1.2);
          chase(shades, [j.x, j.z], 3.5);
          return C.cam({ target: [93, 1, 81], dist: 28, time: 1.5 });
        }).then(function () { return C.say('c11_shades'); }).then(function () { return C.wait(3); })
          .then(function () {
            C.anim('jaglika', null); C.music('chase', 2); C.env({ weather: 'rain' });
            BTS.Camera.followTarget = j; C.camRelease();
            var route = [[100, 70], [91, 64.5], [70, 64.5], [52, 64], [49, 56], [30, 47], [14, 46.6], [11, 38], [6, 31.2]];
            var step = function (k) {
              if (k >= route.length) return Promise.resolve();
              chase(shades, route[Math.max(0, k - 1)], 2.5);
              return C.walk('jaglika', route[k], { run: true, direct: true }).then(function () { return step(k + 1); });
            };
            j.speed = 3.6;
            return step(0);
          })
          .then(function () { return C.fade(1, 2.5); })
          .then(function () {
            BTS.Camera.followTarget = null;
            C.load('outskirts', 'from_village_w'); C.env({ time: 'night', weather: 'rain', horror: 0.8 }, true);
            C.hide('player', true);
            var j2 = C.spawn('jaglika', [94, 21], { noTalk: true, dir: 'left' }); j2.speed = 3.4;
            shades = spawnShades(97, 21, 18, 1.4);
            BTS.Camera.followTarget = j2;
            return C.fade(0, 2).then(function () {
              var route2 = [[84, 21], [74, 17.5], [62, 18], [60, 28], [46, 34], [36, 35.5]];
              var step2 = function (k) { if (k >= route2.length) return Promise.resolve(); chase(shades, route2[Math.max(0, k - 1)], 2.5); return C.walk('jaglika', route2[k], { run: true, direct: true }).then(function () { return step2(k + 1); }); };
              return step2(0);
            }).then(function () {
              var jj = C.ent('jaglika'); jj.anim.lock = 'fear';
              chase(shades, [jj.x, jj.z], 1.6);
              return C.cam({ target: [jj.x, 0.5, jj.z], dist: 22, time: 1.5 });
            }).then(function () { return C.say('c11_fall'); })
              .then(function () {
                var jj = C.ent('jaglika'); jj.anim.lock = 'lie';
                C.particles({ type: 'wisps', x: jj.x, y: BTS.World.heightAt(jj.x, jj.z) + 0.1, z: jj.z, rate: 14, area: [2, 1.5] });
                C.sfx('shadow_absorb', {}); C.shake(1);
                var t0 = 0;
                return new Promise(function (res) { var iv = setInterval(function () { t0 += 0.05; jj.lift = -t0 * 0.9; shades.forEach(function (s) { s.lift = -t0 * 0.9; }); if (t0 > 3) { clearInterval(iv); res(); } }, 50); });
              })
              .then(function () { C.despawn('jaglika'); shades.forEach(function (s) { C.despawn(s.id); }); C.musicCut(); BTS.Particles.clear(); C.env({ weather: 'clear', horror: 0.1 }); return C.wait(2.5); })
              .then(function () { return C.say('c11_silence'); })
              .then(function () { BTS.Camera.followTarget = null; return C.fade(1, 1.2); });
          });
      }, after: 'e_dawn'
    },
    /* ================= EPILOGUE ================= */
    { id: 'e_dawn', chapter: 'epilogue', loc: 'village', spawn: 'fair_center', forceSpawn: true, chapterCard: 'chap.epilogue', chapterSub: 'sub.e', day: 95, deaths: ['jaglika'],
      env: { time: 'morning', weather: 'fog', horror: 0 }, envInstant: true, obj: 'obj.e_dawn', music: 'epilogue',
      npcs: { lisa: LISA_FOLLOW, milka: { loc: 'village', at: 'milka_bench', act: 'sit', dir: 'down' }, sava: { loc: 'village', at: 'churchyard', act: 'pray', dir: 'up' }, stana: { loc: 'village', at: 'guest_bench', act: 'sit', dir: 'down' }, dragan: { loc: 'village', at: 'kafana_table', act: 'idle', dir: 'down' } },
      hideAll: true, keep: ['lisa', 'milka', 'sava', 'stana', 'dragan'],
      onPopulate: function (loc) { BTS.World.player.hidden = false; if (BTS.World.player.shadow) BTS.World.player.shadow.setStage(0); },
      scene: function (C) { C.hide('player', false); return C.say('e_dawn'); },
      interact: [{ loc: 'village', id: 'leave_toy', at: 'grave_zajko', label: 'it.grave_zajko', verb: 'verb.leave', dlg: 'e_toy', hint: true, once: true, need: 'item:zajko_toy' }],
      tick: when('e_ready', 'flag:e_toy_left&flag:e_milka', function (C) { return C.say('e_ready'); }, 'e_leave')
    },
    { id: 'e_leave', chapter: 'epilogue', obj: 'obj.e_leave', music: 'epilogue',
      npcs: { lisa: LISA_FOLLOW, milka: { loc: 'village', at: 'milka_bench', act: 'sit', dir: 'down' } }, hideAll: true, keep: ['lisa', 'milka'],
      triggers: [{ loc: 'village', box: [49, 82, 57, 89], run: function (C) {
        return C.say('e_bridge').then(function () { return C.fade(1, 1.2); }).then(function () { return C.title('e.card1', 'e.card1b'); }).then(function () { return C.title('e.card2', 'e.card2b'); });
      }, then: 'e_final' }]
    },
    { id: 'e_final', chapter: 'epilogue', ambience: { crowd: 0.8, fire: 0.8, firePos: [90.5, 82] }, loc: 'village', spawn: 'fair_edge', forceSpawn: true, chapterCard: 'date.next_june', chapterSub: 'sub.e_final', day: 365,
      env: { time: 'night', weather: 'clear', horror: 0.1 }, envInstant: true, obj: null, music: 'fair', noSave: true,
      npcs: { mila: { loc: 'village', at: [89.4, 80.4], act: 'wander', radius: 1.6, stage: 1 }, luka: { loc: 'village', at: [92, 81.8], act: 'wander', radius: 1.5 }, milka: { loc: 'village', at: [76.2, 79.6], act: 'sit', dir: 'down' } },
      hideAll: true, keep: ['mila', 'luka', 'milka'],
      extras: [
        { loc: 'village', sheet: 'dancer1', at: [82.6, 78.2], act: 'wander', radius: 1.6 }, { loc: 'village', sheet: 'dancer2', at: [85.6, 78.6], act: 'wander', radius: 1.6 },
        { loc: 'village', sheet: 'vil_man1', at: [75, 73.8], act: 'idle', dir: 'up' }, { loc: 'village', sheet: 'vil_boy', at: [88, 83], act: 'wander', radius: 2 },
        { loc: 'village', sheet: 'vil_woman2', at: [103, 86.2], act: 'idle', dir: 'left', talk: false }
      ],
      onPopulate: function (loc, W) { W.player.hidden = true; var s = W.get('extra4'); if (s && s.add) { s.tint = [0.5, 0.5, 0.55]; } },
      scene: function (C) {
        return C.cam({ target: [90, 0.5, 81], dist: 28, time: 0.1 }).then(function () { return C.wait(2); })
          .then(function () { return C.say('e_final'); })
          .then(function () { return C.cam({ target: [101, 1, 85], dist: 20, time: 3 }); })
          .then(function () { var o = C.ent('extra4'); if (o && o.shadow) { o.shadow.lag = 0.6; o.shadow.lenMul = 1.8; } return C.wait(2.5); })
          .then(function () { return C.say('e_question'); })
          .then(function () { return C.fade(1, 0.5); })
          .then(function () { BTS.Music.set('epilogue', 1); return C.title('ui.the_end'); })
          .then(function () { S.set('game_complete'); S.markDone('scene:e_final'); BTS.Save.write('auto', BTS.Save.snapshot()); BTS.Screens.credits(true); });
      }
    }
  ]);

  /* memory: talking to grandmother */
  add('baka', [{ beats: 'c8_memory', dlg: 'c8_legend', clue: 'fact_legend', then: 'c8_back' }]);
  add('lisa', [
    { beats: 'c8_chest', dlg: 'c8_lisa' }, { beats: 'c9_silence..c9_prepare', dlg: 'c9_lisa_any' }, { beats: 'c10_meadow', dlg: 'c10_lisa' },
    { beats: 'e_dawn..e_leave', dlg: 'e_lisa' }
  ]);
  add('milka', [{ beats: 'e_dawn', dlg: 'e_milka', set: 'e_milka' }, { beats: 'e_leave', dlg: 'e_milka2' }, { beats: 'c9_silence..c10_meadow', dlg: 'c9_milka' }]);
  add('sava', [{ beats: 'e_dawn..e_leave', dlg: 'e_sava' }, { beats: 'c9_silence..c9_prepare', dlg: 'c9_sava' }]);
  add('stana', [{ beats: 'e_dawn..e_leave', dlg: 'e_stana' }]);
  add('dragan', [{ beats: 'e_dawn..e_leave', dlg: 'e_dragan' }, { beats: 'c9_silence..c9_prepare', dlg: 'c9_dragan' }]);
  BTS.Data.globalProps.push({ beats: 'c9_dusk..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_tihomir', scale: 1.1 });
  BTS.Story.calls.leaveToy = function () { S.removeItem('zajko_toy'); S.set('e_toy_left'); };

  D('c8_chest', [['*', '1'], ['>', '2'], ['*', '3'], ['>', '4'], ['>', '5']]);
  D('c8_lisa', [['lisa', '1', { p: 'worried' }]]);
  D('c8_mem_in', [['*', '1'], ['baka', '2', { p: 'smile' }], ['>', '3']]);
  D('c8_legend', [
    ['baka', '1', { p: 'smile' }], ['baka', '2'], ['baka', '3'], ['*', '4'], ['baka', '5'],
    { label: 'q' }, { choice: [['c1', 'eat', { once: true }], ['c2', 'needle', { once: true }], ['c3', 'kill', { once: true }], ['c4', 'you', { once: true }], ['c5', 'end']] },
    { label: 'eat' }, ['dj', '6'], ['baka', '7'], ['baka', '8'], { goto: 'q' },
    { label: 'needle' }, ['dj', '9'], ['baka', '10'], ['baka', '11'], { goto: 'q' },
    { label: 'kill' }, ['dj', '12'], ['baka', '13', { p: 'worried' }], ['*', '14'], ['baka', '15'], ['baka', '16'], ['baka', '17'], ['*', '18'], ['baka', '19'], { goto: 'q' },
    { label: 'you' }, ['dj', '20'], ['baka', '21', { p: 'sad' }], ['baka', '22'], { goto: 'q' },
    { label: 'end' }, { if: 'flag:chose.c8_legend.dlg.c8_legend.c3', then: 'fin' }, ['baka', '23'], { goto: 'q' },
    { label: 'fin' }, ['baka', '24', { p: 'smile' }], ['baka', '25'], ['>', '26']
  ]);
  D('c8_back', [['*', '1'], ['lisa', '2', { p: 'worried' }], ['dj', '3'], ['dj', '4'], ['lisa', '5', { p: 'worried' }], ['dj', '6'], ['lisa', '7'], ['>', '8'], ['>', '9']]);
  D('c9_wake', [['>', '1'], ['>', '2'], ['>', '3'], ['lisa', '4', { p: 'worried' }], ['lisa', '6', { p: 'sad' }], ['>', '5']]);
  D('c9_village', [['*', '1'], ['vesna', '2', { p: 'sad' }], ['radoje', '3'], ['*', '4'], ['>', '5'], ['>', '6']]);
  D('c9_beast', [['*', '1'], ['*', '2'], ['lisa', '3', { p: 'scared' }], ['>', '4'], ['>', '5'], ['*', '6']]);
  D('c9_decide', [['lisa', '1', { p: 'tired' }], ['lisa', '2'], ['lisa', '3'], { choice: [['c1', 'a'], ['c2', 'b']] },
    { label: 'a' }, ['dj', '4'], { goto: 'm' }, { label: 'b' }, ['*', '5'], ['>', '6'], ['dj', '7'],
    { label: 'm' }, ['lisa', '8', { p: 'worried' }], ['*', '9'], ['dj', '10'], ['dj', '11'], ['lisa', '12', { p: 'sad' }], ['lisa', '13'], ['dj', '14'], ['lisa', '15', { p: 'worried' }], ['lisa', '16'], ['>', '17']]);
  D('c9_pillow', [['*', '1'], ['>', '2'], ['>', '3'], ['lisa', '4', { p: 'worried' }]]);
  D('c9_lantern', [['*', '1'], ['>', '2']]);
  D('c9_ready', [['lisa', '1'], ['dj', '2'], ['lisa', '3', { p: 'worried' }], ['>', '4']]);
  D('c9_lisa_any', [['lisa', '1', { p: 'worried' }]]);
  D('c9_milka', [['milka', '1', { p: 'worried' }], ['milka', '2']]);
  D('c9_sava', [['sava', '1', { p: 'worried' }]]);
  D('c9_dragan', [['dragan', '1', { p: 'worried' }]]);
  D('c10_fire', [['*', '1'], ['>', '2'], ['lisa', '3', { p: 'scared' }]]);
  D('c10_lisa', [['lisa', '1', { p: 'scared' }]]);
  D('c10_arrive', [['*', '1'], ['jaglika', '2'], ['jaglika', '3'], ['dj', '4'], ['jaglika', '5'], ['jaglika', '6'], ['>', '7']]);
  D('c10_grow', [['*', '1'], ['*', '2'], ['lisa', '3', { p: 'scared' }], ['>', '4'], ['>', '5']]);
  D('c10_hint_freeze', [['>', '1']]);
  D('c10_fear', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c10_now', [['>', '1']]);
  D('c10_miss_early', [['lisa', '1', { p: 'scared' }]]);
  D('c10_miss_far', [['>', '1']]);
  D('c11_pierce', [['*', '1'], ['*', '2'], ['>', '3']]);
  D('c11_shades', [['*', '1'], ['>', '2'], ['jaglika', '3'], ['*', '4']]);
  D('c11_fall', [['*', '1'], ['jaglika', '2'], ['*', '3']]);
  D('c11_silence', [['*', '1'], ['>', '2']]);
  D('e_dawn', [['*', '1'], ['lisa', '2', { p: 'tired' }], ['dj', '3'], ['lisa', '4'], ['>', '5']]);
  D('e_toy', [['*', '1'], ['>', '2'], ['>', '3'], { call: 'leaveToy' }]);
  D('e_milka', [['milka', '1', { p: 'sad' }], ['milka', '2'], ['dj', '3'], ['milka', '4', { p: 'smile' }]]);
  D('e_milka2', [['milka', '1', { p: 'smile' }]]);
  D('e_sava', [['sava', '1'], ['sava', '2']]);
  D('e_stana', [['stana', '1', { p: 'sad' }]]);
  D('e_dragan', [['dragan', '1', { p: 'tired' }]]);
  D('e_lisa', [['lisa', '1']]);
  D('e_ready', [['lisa', '1'], ['>', '2']]);
  D('e_bridge', [['*', '1'], ['>', '2'], ['>', '3'], ['lisa', '4', { p: 'smile' }], ['dj', '5'], ['*', '6']]);
  D('e_final', [['*', '1'], ['*', '2'], ['mila', '3', { p: 'smile' }], ['*', '4']]);
  D('e_question', [['*', '1']]);
})();
