/* CHAPTER 5 — Gorazd and Jessica (September 11–17): his notes match a death; Lisa believes and stays.
   CHAPTER 6 — watching. CHAPTER 7 — Jaglika's house. */
'use strict';
(function () {
  var D = BTS.D, U = BTS.StoryUtil, when = U.when, add = U.add, S = BTS.State, A = BTS.SpotAt;
  var LISA_FOLLOW = { loc: '*', follow: true, act: 'idle' };

  /* ---------- chapter 6: following Jaglika (freeze when she looks back) ---------- */
  var ROUTE = [[12.6, 30.5], [13.2, 40], [14.5, 46.8], [26, 47.3], [40, 47.3], [52, 49.4], [62, 47], [70.5, 46.4], [73.2, 43.4], [74.7, 42.3]];
  var stalk = null;
  function stalkReset(W) {
    var j = W.get('jaglika'); if (!j) return;
    var cp = stalk ? stalk.check : 0;
    stalk = { i: cp + 1, check: cp, phase: 'walk', t: 0, warned: false, fails: stalk ? stalk.fails : 0, lostWarn: false, moving: false };
    j.x = ROUTE[cp][0]; j.z = ROUTE[cp][1]; j.path = null; j.dir = 'down';
    j.speed = 1.25; if (j.brain) { j.brain.paused = true; j.keepPaused = true; }
  }
  function stalkTick(dt, W) {
    if (W.locId !== 'village') return;
    var j = W.get('jaglika'), p = W.player; if (!j || !p) return;
    if (!stalk) stalkReset(W);
    var st = stalk, d = Math.hypot(p.x - j.x, p.z - j.z);
    st.t += dt;
    if (st.phase === 'walk') {
      if (!st.moving) {
        if (st.i >= ROUTE.length) { st.phase = 'done'; S.set('stalk_done'); return; }
        j.path = [ROUTE[st.i].slice()]; j.pathSpeed = 0.75; st.moving = true;
      } else if (!j.path) {
        st.moving = false; st.check = st.i; st.i++;
        if (st.i < ROUTE.length && st.i % 2 === 0) { st.phase = 'pause'; st.t = 0; }
      }
      if (d > 20 && !st.lostWarn) { st.lostWarn = true; BTS.Cutscene.play(function (C) { return C.say('c6_losing'); }, 'lose'); }
      if (d > 27) fail(W, 'c6_lost');
      if (d < 3.2) fail(W, 'c6_too_close');
    } else if (st.phase === 'pause') {
      j.anim.set('idle');
      if (st.t > 0.1 && !st.warned) { st.warned = true; BTS.UI.caption('cap.stop', { force: true }); BTS.Env.flash = Math.max(BTS.Env.flash, 0.15); BTS.Audio.play('breath', { vol: 0.6 }); }
      if (st.t > 1.1) { st.phase = 'look'; st.t = 0; j.faceTo(p.x, p.z); BTS.Audio.play('whisper', { vol: 0.4, dur: 1.2 }); }
    } else if (st.phase === 'look') {
      j.anim.set('idle'); j.faceTo(p.x, p.z);
      if (p.moving && d < 14) { fail(W, 'c6_seen'); return; }
      if (st.t > 2.4) { st.phase = 'walk'; st.t = 0; st.warned = false; }
    }
  }
  function fail(W, dlg) {
    if (BTS.Cutscene.running) return;
    stalk.fails++;
    BTS.Cutscene.play(function (C) {
      return C.say(dlg).then(function () { return C.fade(1, 2); }).then(function () {
        stalkReset(W);
        var cp = ROUTE[stalk.check], back = ROUTE[Math.max(0, stalk.check - 1)];
        var dx = cp[0] - back[0], dz = cp[1] - back[1], dl = Math.hypot(dx, dz) || 1;
        var px = cp[0] - dx / dl * 7, pz = cp[1] - dz / dl * 7;
        if (stalk.check === 0) { px = 19.5; pz = 31.5; }
        if (BTS.World.blocked(px, pz, 0.3)) { var fp = BTS.World.nav.nearestFree.apply(BTS.World.nav, BTS.World.nav.toCell(px, pz)); if (fp) { var c = BTS.World.nav.center(fp[0], fp[1]); px = c[0]; pz = c[1]; } }
        C.place('player', [px, pz], 'left'); C.place('lisa', [px + 0.8, pz + 0.8]);
        return C.fade(0, 2);
      });
    }, 'stalk_fail');
  }


  var GORAZD_FIELD = { loc: 'outskirts', at: [41.5, 35.5], act: 'lie', stage: 4, noTalk: true, get sheet() { return U.sheetOr('gorazd_bare', 'gorazd'); } };

  BTS.Story.define([
    /* ================= CHAPTER 5 ================= */
    { id: 'c4_gorazd_dead', chapter: 'ch5', loc: 'outskirts', spawn: 'from_village_w', forceSpawn: true, chapterCard: 'chap.ch5', chapterSub: 'sub.c5', day: 76,
      env: { time: 'morning', weather: 'fog', horror: 0.4 }, envInstant: true, obj: 'obj.c4_gorazd_dead', music: 'symptoms',
      npcs: { gorazd: GORAZD_FIELD, radoje: { loc: 'outskirts', at: [43.5, 37], act: 'mourn', dir: 'left' }, sava: { loc: 'outskirts', at: [39.5, 37.4], act: 'pray', dir: 'right' },
        dragan: { loc: 'outskirts', at: [42, 38.5], act: 'idle', dir: 'up' }, lisa: { loc: 'outskirts', at: [44.6, 35.4], act: 'idle', dir: 'left', noTalk: true } },
      props: [{ loc: 'outskirts', sprite: 'lantern_hang', at: [40.6, 35.2], scale: 1.4, emissive: true }],
      triggers: [{ loc: 'outskirts', box: [33, 28, 52, 42], run: function (C) {
        return C.cam({ target: [41.5, 0.5, 36], time: 1.6 }).then(function () { return C.say('c4_field'); })
          .then(function () { C.walk('lisa', U.nearPlayer(0.9, -0.5)); return C.wait(1.2); })
          .then(function () { C.face('lisa', 'player'); C.face('player', 'lisa'); return C.say('c5_turn'); });
      }, clue: ['fact_gorazd_death', 'fact_prediction'], then: 'c5_proof' }]
    },
    { id: 'c5_proof', chapter: 'ch5', loc: 'djordje_house', spawn: 'table', forceSpawn: true, obj: 'obj.c5_proof', deaths: ['gorazd'],
      env: { time: 'day', weather: 'overcast', horror: 0.35 }, envInstant: true, music: 'explore',
      npcs: { lisa: { loc: 'djordje_house', at: A('lisa_table', [6.4, 5.4]), act: 'idle', dir: 'left' } }
    },
    { id: 'c4_jessica', chapter: 'ch5', obj: 'obj.c4_jessica', music: 'symptoms', env: { time: 'evening', weather: 'drizzle', horror: 0.4 },
      npcs: { lisa: LISA_FOLLOW, jessica: { loc: 'guesthouse', at: 'jess_bed', act: 'weak', dir: 'right', stage: 3 }, stana: { loc: 'guesthouse', at: 'stana_spot', act: 'work', dir: 'down' } },
      interact: [
        { loc: 'guesthouse', id: 'camera', at: A('jess_desk', [12.4, 1.6], 0.8, -0.6), label: 'it.camera', dlg: 'c4_camera', item: 'jessica_photo', clue: 'obs_jessica_photos', hint: true, once: true, condLive: true, cond: 'flag:jessica_talked' },
        { loc: 'guesthouse', id: 'diary', at: A('jess_desk', [11.2, 1.6], -0.4, -0.6), label: 'it.diary', verb: 'verb.read', dlg: 'c4_diary', clue: 'obs_jessica_diary', hint: true, once: true, condLive: true, cond: 'flag:jessica_talked' },
        { loc: 'guesthouse', id: 'guestbook', at: A('counter', [6.4, 3.0], 0.8, -0.6), label: 'it.guestbook', verb: 'verb.read', dlg: 'c5_guestbook', clue: 'fact_guestbook', once: true }
      ],
      observe: { jessica: { run: function (C) { return C.say('c4_observe_jessica'); }, clue: 'sk_jessica' } },
      tick: when('c4_jess_done', 'clue:obs_jessica_photos&clue:obs_jessica_diary&clue:sk_jessica', function (C) { return C.say('c4_jess_out').then(function () { return C.fade(1, 0.6); }); }, 'c4_jessica_dead')
    },
    { id: 'c4_jessica_dead', chapter: 'ch5', loc: 'village', spawn: 'well', forceSpawn: true, chapterCard: 'sub.c5b', day: 80, deaths: ['jessica'],
      env: { time: 'evening', weather: 'drizzle', horror: 0.45 }, envInstant: true, obj: 'obj.c4_jessica_dead', music: 'symptoms',
      npcs: { stana: { loc: 'village', at: [61.5, 41.5], act: 'mourn', dir: 'down' }, milka: { loc: 'village', at: [59.5, 42.2], act: 'idle', dir: 'right' }, lisa: { loc: 'village', at: [63.6, 42.6], act: 'mourn', dir: 'left', noTalk: true } },
      triggers: [{ loc: 'village', box: [56, 38, 70, 46], run: function (C) {
        return C.cam({ target: [62, 1, 41], time: 1.4 }).then(function () { return C.say('c4_guest'); }).then(function () { return C.fade(1, 0.7); });
      }, clue: 'fact_jessica_death', then: 'c5_ally' }]
    },
    { id: 'c5_ally', chapter: 'ch5', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'sub.c5c', day: 82,
      env: { time: 'evening', weather: 'overcast', horror: 0.35 }, envInstant: true, obj: null, music: 'explore',
      npcs: { lisa: { loc: 'djordje_house', at: A('lisa_table', [6.4, 5.4]), act: 'idle', dir: 'left', noTalk: true } },
      scene: function (C) { C.anim('player', 'sit'); C.face('lisa', 'player'); return C.say('c5_convinced').then(function () { return C.fade(1, 0.7); }); }, after: 'c6_plan'
    },
    /* ================= CHAPTER 6 ================= */
    { id: 'c6_plan', chapter: 'ch6', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'chap.ch6', chapterSub: 'sub.c6', day: 85,
      env: { time: 'night', weather: 'fog', horror: 0.4 }, envInstant: true, obj: 'obj.c6_plan', music: 'tension', musicByLoc: { djordje_house: 'explore' },
      npcs: { lisa: LISA_FOLLOW },
      scene: function (C) { C.place('lisa', U.spot('lisa_table', [6.4, 5.4]), 'left'); return C.say('c6_plan'); },
      triggers: [{ loc: 'village', box: [16.5, 28.5, 22, 34.5], run: function (C) { return C.say('c6_hide'); }, then: 'c6_follow' }],
      blockExit: { south: 'block_night', west: 'block_night' }
    },
    { id: 'c6_follow', chapter: 'ch6', obj: 'obj.c6_follow', music: 'tension', noSave: true,
      npcs: { lisa: LISA_FOLLOW, jaglika: { loc: 'village', at: [12.6, 28.8], act: 'idle', noTalk: true, stage: 2 } },
      hideAll: true, keep: ['lisa', 'jaglika'],
      onPopulate: function (loc, W) { stalk = null; if (loc === 'village') stalkReset(W); },
      tick: function (dt, W) {
        stalkTick(dt, W);
        if (S.flag('stalk_done') && !S.done('c6_window_go')) { S.markDone('c6_window_go'); BTS.Story.goto('c6_window', true); }
      },
      blockExit: { south: 'block_night', west: 'block_night', djordje: 'block_lisa', zajko: 'block_lisa', kafana: 'block_lisa', guest: 'block_lisa', church: 'block_lisa', gorazd: 'block_lisa', tihomir: 'block_lisa', jaglika: 'block_lisa' }
    },
    { id: 'c6_window', chapter: 'ch6', obj: null, music: 'jaglika',
      npcs: { lisa: { loc: 'village', at: [72.2, 43.6], act: 'idle', dir: 'up' }, jaglika: { loc: 'village', at: [74.7, 42.3], act: 'idle', dir: 'up', noTalk: true, stage: 2 }, tihomir: null },
      hideAll: true, keep: ['lisa', 'jaglika'],
      scene: function (C) {
        C.place('player', 'tihomir_hide', 'up');
        return C.cam({ target: [75, 1.4, 41], time: 1.6 }).then(function () { return C.say('c6_window_a'); })
          .then(function () { C.hide('jaglika', true); C.sfx('creak', { x: 75, z: 41 }); return C.wait(3.0); })
          .then(function () { return C.say('c6_window_b'); })
          .then(function () { C.hide('jaglika', false); C.place('jaglika', [74.7, 42.3], 'down'); C.shadow('jaglika', { stage: 2, wall: { x: 76, z: 41.5, y: 0.3 } }); C.sfx('shadow_move', { x: 75, z: 42 }); return C.say('c6_window_c'); })
          .then(function () { C.clue('sk_jaglika'); return C.walk('jaglika', [62, 47], { noWait: true }); }).then(function () { return C.wait(2.4); })
          .then(function () { C.despawn('jaglika'); return C.say('c6_window_d'); }).then(function () { return C.fade(1, 0.6); });
      }, after: 'c7_wait'
    },
    /* ================= CHAPTER 7 ================= */
    { id: 'c7_wait', chapter: 'ch7', loc: 'village', spawn: 'jaglika_watch', forceSpawn: true, chapterCard: 'chap.ch7', chapterSub: 'sub.c7', day: 86, items: ['matches'],
      env: { time: 'morning', weather: 'fog', horror: 0.4 }, envInstant: true, obj: null, music: 'tension',
      npcs: { lisa: { loc: 'village', at: [20.4, 32.3], act: 'idle', dir: 'left' }, jaglika: { loc: 'village', at: [11.9, 25.6], act: 'idle', dir: 'down', noTalk: true, stage: 2 } },
      hideAll: true, keep: ['lisa', 'jaglika'],
      scene: function (C) {
        C.clue('obs_jag_tihomir'); C.clue('hyp_tihomir_next');
        return C.say('c7_wait').then(function () { return C.walk('jaglika', [12.6, 30.5]); })
          .then(function () { return C.walk('jaglika', [4.5, 31.2], { noWait: true }); }).then(function () { return C.wait(3.5); })
          .then(function () { C.despawn('jaglika'); C.flag('jaglika_open'); return C.say('c7_go'); });
      }, after: 'c7_inside'
    },
    { id: 'c7_inside', chapter: 'ch7', obj: 'obj.c7_inside', music: 'jaglika', noSave: false,
      npcs: { lisa: { loc: 'village', at: [14.6, 30.4], act: 'look' } }, hideAll: true, keep: ['lisa'],
      onPopulate: function (loc, W) {
        if (loc !== 'jaglika_house') return;
        var lit = S.flag('candle_lit'), L = W.light('jag_candelabra'), F = W.static('jag_candelabra_flame');
        if (L) L.intensity = lit ? 1.0 : 0.0; if (F) F.off = !lit;
      },
      interact: [
        { loc: 'jaglika_house', id: 'herbs_j', at: [4.5, 1.0], label: 'it.herbs', dlg: 'c7_herbs', clue: 'obs_herbs', hint: true, once: true },
        { loc: 'jaglika_house', id: 'vials_j', at: [5.1, 3.0], label: 'it.vials', dlg: 'c7_vials', sfx: 'glass', item: 'vial', clue: 'fact_medicines', hint: true, once: true },
        { loc: 'jaglika_house', id: 'needles_j', at: [11, 3.3], label: 'it.needles', dlg: 'c7_needles', clue: 'fact_needles', hint: true, once: true },
        { loc: 'jaglika_house', id: 'candelabra', at: [18.6, 4.4], label: 'it.candelabra', verb: 'verb.use', dlg: 'c7_candle', set: 'candle_lit', hint: true, once: true, sfx: 'match' },
        { loc: 'jaglika_house', id: 'board_dark', at: [16, 1.0], label: 'it.board', dlg: 'c7_board_dark', cond: '!flag:candle_lit', condLive: true },
        { loc: 'jaglika_house', id: 'board', at: [16.2, 1.0], label: 'it.board', verb: 'verb.read', dlg: 'c7_board', item: 'jaglika_list', clue: ['fact_list', 'obs_grandma_named'], hint: true, once: true, cond: 'flag:candle_lit', condLive: true }
      ],
      tick: function (dt, W) {
        if (W.locId === 'jaglika_house' && S.flag('candle_lit')) { var L = W.light('jag_candelabra'), F = W.static('jag_candelabra_flame'); if (L) L.intensity = 1.0; if (F) F.off = false; }
        if (W.locId === 'jaglika_house') when('c7_return', 'item:jaglika_list&clue:fact_medicines&clue:fact_needles', function (C) {
          C.sfx('footsteps_other', { x: 3, z: 9 }); C.horror(0.6);
          return C.say('c7_steps').then(function () { C.flag('must_hide'); });
        }, 'c7_hide')();
      }
    },
    { id: 'c7_hide', chapter: 'ch7', obj: 'obj.c7_hide', music: 'jaglika', noSave: true,
      npcs: { lisa: { loc: 'village', at: [14.6, 30.4], act: 'look' } }, hideAll: true, keep: ['lisa'],
      interact: [{ loc: 'jaglika_house', id: 'hide', at: A('hide_spot', [10.1, 5.2]), label: 'it.hide', verb: 'verb.hide', hint: true, r: 1.6, run: function (C) {
        C.place('player', U.spot('hide_in', [9.75, 7.55]), 'right'); C.anim('player', 'cower');
        C.spawn('jaglika', 'jag_return', { dir: 'up', noTalk: true, stage: 2 });
        C.cam({ target: [7.6, 0.6, 6.4], dist: 16, time: 1.2 });   // frame the hiding place, the lamp and the wall together
        C.sfx('door_open', {});
        return C.wait(0.8).then(function () { return C.walk('jaglika', [5.4, 5.0]); })
          .then(function () { return C.say('c7_hidden_a'); })
          .then(function () { C.shadow('jaglika', { wall: { x: 8.0, z: 0.2, y: 0 }, beast: 0.25 }); C.sfx('shadow_move', {}); return C.say('c7_hidden_b'); })
          .then(function () { C.sfx('door_knock', {}); return C.say('c7_knock'); })
          .then(function () { return C.walk('jaglika', [3, 7.4]); }).then(function () { C.face('jaglika', 'down'); return C.say('c7_lisa_door'); })
          .then(function () { C.anim('player', null); C.camRelease(); return C.walk('player', U.spot('back_door', [12.9, 1.0]), { run: true }); })
          .then(function () { C.sfx('door_close', { vol: 0.4 }); return C.fade(1, 1.2); });
      }, then: 'c7_after' }]
    },
    { id: 'c7_after', chapter: 'ch7', loc: 'djordje_house', spawn: 'table', forceSpawn: true, env: { time: 'evening', weather: 'overcast', horror: 0.4 }, envInstant: true, obj: null, music: 'explore',
      npcs: { lisa: { loc: 'djordje_house', at: A('lisa_table', [6.4, 5.4]), act: 'idle', dir: 'left' } },
      scene: function (C) { C.anim('player', 'sit'); return C.fade(0, 1).then(function () { return C.say('c7_talk'); }).then(function () { C.clue('hyp_poison'); }); }, after: 'c8_chest'
    }
  ]);

  /* ---------- dialogues ---------- */
  D('c4_field', [['*', '1'], ['radoje', '2', { p: 'sad' }], ['radoje', '3'], ['>', '4'], ['>', '5'], ['sava', '6'], ['>', '7']]);
  D('c5_turn', [['lisa', '1', { p: 'scared' }], { if: 'flag:told_lisa_gorazd', then: 'told' }, ['*', '2'], ['lisa', '3', { p: 'scared' }], { goto: 'e' },
    { label: 'told' }, ['lisa', '4', { p: 'scared' }],
    { label: 'e' }, ['lisa', '5', { p: 'worried' }], ['>', '6'], ['lisa', '7'], ['>', '8']]);
  D('c5_present', [
    ['lisa', '1'], ['lisa', '2'],
    { label: 'menu' },
    { if: 'flag:shown_pattern&flag:shown_needles&flag:shown_jessica', then: 'ok' },
    { choice: [['c1', 'pattern', { if: 'clue:hyp_pattern&!flag:shown_pattern' }], ['c2', 'needles', { if: 'item:amulet_gorazd&!flag:shown_needles' }], ['c3', 'jessica', { if: '!flag:shown_jessica' }], ['c4', 'sketch', { if: '!flag:shown_sketch' }], ['c5', 'know'], ['c6', 'later']] },
    { label: 'pattern' }, ['*', '3'], ['lisa', '4', { p: 'worried' }], ['lisa', '5'], { set: 'shown_pattern' }, { goto: 'menu' },
    { label: 'needles' }, ['*', '6'], ['lisa', '7', { p: 'worried' }], ['lisa', '8'], { set: 'shown_needles' }, { goto: 'menu' },
    { label: 'jessica' }, ['dj', '9'], ['lisa', '10', { p: 'scared' }], ['lisa', '11', { p: 'scared' }], { set: 'shown_jessica' }, { goto: 'menu' },
    { label: 'sketch' }, ['*', '12'], ['lisa', '13'], { set: 'shown_sketch' }, { goto: 'menu' },
    { label: 'know' }, ['dj', '14'], ['lisa', '15'], { goto: 'menu' },
    { label: 'later' }, ['lisa', '16'], { end: true },
    { label: 'ok' }, ['lisa', '17', { p: 'worried' }], ['lisa', '18'], ['>', '19'], { set: 'guest_open' }, { call: 'goto', args: 'c4_jessica' }
  ]);
  D('c4_stana', [['stana', '1', { p: 'worried' }], ['stana', '2'], ['stana', '3', { p: 'sad' }]]);
  D('c4_jessica_talk', [['jessica', '1', { p: 'tired' }], ['jessica', '2', { p: 'scared' }], ['jessica', '3'], ['dj', '4'], ['jessica', '5', { p: 'scared' }], ['jessica', '6', { p: 'sad' }],
    { choice: [['c1', 'a'], ['c2', 'b']] }, { label: 'a' }, ['dj', '7'], ['jessica', '8', { p: 'sad' }], { goto: 'e' }, { label: 'b' }, ['*', '9'], ['jessica', '10', { p: 'tired' }],
    { label: 'e' }, ['lisa', '12', { p: 'worried' }], ['jessica', '11'], { set: 'jessica_talked' }]);
  D('c4_jessica_again', [['jessica', '1', { p: 'blank' }]]);
  D('c4_camera', [['*', '1'], ['>', '2'], ['>', '3'], ['jessica', '4', { p: 'scared' }], ['>', '5']]);
  D('c4_diary', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c5_guestbook', [['*', '1'], ['>', '2'], ['lisa', '3', { p: 'worried' }], ['*', '4']]);
  D('c4_observe_jessica', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c4_jess_out', [['lisa', '1', { p: 'worried' }], ['>', '2'], ['>', '3']]);
  D('c4_guest', [['*', '1'], ['stana', '2', { p: 'sad' }], ['stana', '3', { p: 'sad' }], ['lisa', '4', { p: 'sad' }], ['milka', '5'], ['>', '6'], ['>', '7'], ['>', '8']]);
  D('c5_convinced', [['*', '1'], ['lisa', '2', { p: 'tired' }], ['lisa', '3'], ['lisa', '4', { p: 'sad' }], ['dj', '5'], ['lisa', '6', { p: 'smile' }], ['lisa', '7'], ['lisa', '8'], ['>', '9'], ['>', '10']]);
  D('c5_lisa_wait', [['lisa', '1']]);
  D('c6_plan', [['lisa', '1'], ['lisa', '2'], ['dj', '3'], ['lisa', '4', { p: 'worried' }], ['lisa', '5'], ['>', '6']]);
  D('c6_hide', [['*', '1'], ['lisa', '2'], ['>', '3'], ['>', '4'], ['>', '5']]);
  D('c6_losing', [['lisa', '1']]);
  D('c6_lost', [['lisa', '1', { p: 'worried' }]]);
  D('c6_seen', [['*', '1'], ['lisa', '2', { p: 'scared' }]]);
  D('c6_too_close', [['lisa', '1', { p: 'scared' }]]);
  D('c6_window_a', [['*', '1'], ['>', '2'], ['lisa', '3']]);
  D('c6_window_b', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c6_window_c', [['*', '1'], ['>', '2'], ['lisa', '3', { p: 'scared' }]]);
  D('c6_window_d', [['lisa', '1', { p: 'scared' }], ['dj', '2'], ['lisa', '3'], ['dj', '4'], ['lisa', '5', { p: 'worried' }], ['>', '6']]);
  D('c7_wait', [['lisa', '1'], ['>', '2'], ['*', '3']]);
  D('c7_go', [['lisa', '1', { p: 'worried' }], ['lisa', '2'], ['>', '3']]);
  D('c7_herbs', [['*', '1'], ['>', '2']]);
  D('c7_vials', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c7_needles', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c7_candle', [['*', '1'], ['>', '2']]);
  D('c7_board_dark', [['>', '1']]);
  D('c7_board', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5'], ['>', '6']]);
  D('c7_steps', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c7_hidden_a', [['*', '1'], ['jaglika', '2'], ['>', '3']]);
  D('c7_hidden_b', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c7_knock', [['lisa', '1'], ['jaglika', '2']]);
  D('c7_lisa_door', [['lisa', '3'], ['jaglika', '4'], ['>', '5']]);
  D('c7_talk', [['lisa', '1', { p: 'tired' }], ['lisa', '2'], ['lisa', '3', { p: 'worried' }], ['dj', '4'], ['lisa', '5'], ['lisa', '6', { p: 'sad' }], ['dj', '7'], ['lisa', '8', { p: 'worried' }], ['>', '9']]);
  D('c6_lisa_follow', [['lisa', '1']]);

  add('lisa', [
    { beats: 'c5_proof', dlg: 'c5_present' },
    { beats: 'c4_jessica', dlg: 'c5_lisa_wait' },
    { beats: 'c6_plan..c6_follow', dlg: 'c6_lisa_follow' }
  ]);
  add('jessica', [{ beats: 'c4_jessica', if: '!flag:jessica_talked', dlg: 'c4_jessica_talk' }, { beats: 'c4_jessica', dlg: 'c4_jessica_again' }]);
  add('stana', [{ beats: 'c4_jessica', dlg: 'c4_stana' }]);
})();
