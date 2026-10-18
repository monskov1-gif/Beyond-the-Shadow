/* CHAPTER 3 — the pattern (September 1–2). CHAPTER 4 — Lisa (September 3–8): Lisa (social services) and
   Jessica (a tourist-photographer) arrive together on the September 3 bus and lodge upstairs at Stana's.
   Lisa visits Đorđe every day; he tries to tell her, she reads it as grief. */
'use strict';
(function () {
  var D = BTS.D, S = BTS.State, U = BTS.StoryUtil, when = U.when, add = U.add, A = BTS.SpotAt;
  var LISA_FOLLOW = { loc: '*', follow: true, act: 'idle' };
  var FEARX = [
    { loc: 'village', sheet: 'vil_man2', at: [56, 50], act: 'look', lines: ['extra_fear_a', 'extra_fear_b'] },
    { loc: 'village', sheet: 'vil_woman1', at: [44, 49], act: 'idle', dir: 'down', lines: ['extra_fear_b', 'extra_fear_c'] }
  ];
  var WALK_BLOCK = { west: 'block_lisa_walk', south: 'block_lisa_walk', zajko: 'block_lisa_walk', kafana: 'block_lisa_walk', church: 'block_lisa_walk', gorazd: 'block_lisa_walk', tihomir: 'block_lisa_walk', jaglika: 'block_lisa_walk' };
  /* Gorazd's look follows the story: the cap comes off in his house (flag), and stays off */
  var GORAZD_IN = { loc: 'gorazd_house', at: 'gorazd_spot', act: 'look', stage: 2, get sheet() { return S.flag('gorazd_bare') ? U.sheetOr('gorazd_bare', 'gorazd') : 'gorazd'; } };
  BTS.Story.calls.gorazdBare = function () { S.set('gorazd_bare'); U.setSheet('gorazd', U.sheetOr('gorazd_bare', 'gorazd')); };

  BTS.Story.define([
    /* ================= CHAPTER 3 ================= */
    { id: 'c3_start', chapter: 'ch3', loc: 'djordje_house', spawn: 'bed', forceSpawn: true, chapterCard: 'chap.ch3', chapterSub: 'sub.c3', day: 66,
      env: { time: 'morning', weather: 'overcast', horror: 0.2 }, envInstant: true, obj: 'obj.c3_start', music: 'explore',
      scene: function (C) { C.sfx('bell', { x: 91.5, z: 23.5, vol: 0.5 }); return C.wait(1.2).then(function () { return C.say('c3_wake'); }); },
      interact: [{ loc: 'djordje_house', id: 'desk3', at: A('desk', [12.4, 2.4]), label: 'it.desk', verb: 'verb.read', dlg: 'c3_reread', clue: 'obs_jag_smithy', set: 'church_open', hint: true, then: 'c3_graves' }]
    },
    { id: 'c3_graves', chapter: 'ch3', obj: 'obj.c3_graves', extras: FEARX, env: { time: 'day', weather: 'overcast', horror: 0.2 },
      interact: [
        { loc: 'village', id: 'g_zajko', at: 'grave_zajko', label: 'it.grave_zajko', dlg: 'c3_g_zajko', set: 'g1', hint: true, once: true },
        { loc: 'village', id: 'g_pecko', at: 'grave_pecko', label: 'it.grave_pecko', dlg: 'c3_g_pecko', set: 'g2', hint: true, once: true },
        { loc: 'village', id: 'g_gvozdin', at: 'grave_gvozdin', label: 'it.grave_gvozdin', dlg: 'c3_g_gvozdin', set: 'g3', hint: true, once: true }
      ],
      tick: when('c3_graves_done', 'flag:g1&flag:g2&flag:g3', function (C) { return C.say('c3_graves_end').then(function () { C.clue('fact_graves'); }); }, 'c3_link')
    },
    { id: 'c3_link', chapter: 'ch3', obj: 'obj.c3_link', extras: FEARX,
      tick: when('c3_link_done', 'clue:hyp_pattern', function (C) { return C.say('c3_pattern'); }, 'c3_sightings')
    },
    { id: 'c3_sightings', chapter: 'ch3', obj: 'obj.c3_sightings', extras: FEARX, env: { time: 'day', weather: 'overcast' },
      tick: when('c3_sight_done', 'clue:obs_jag_gorazd&clue:obs_jag_asks_stana', function (C) { return C.say('c3_sight_end'); }, 'c3_predict')
    },
    { id: 'c3_predict', chapter: 'ch3', obj: 'obj.c3_predict', extras: FEARX,
      tick: when('c3_predict_done', 'clue:hyp_gorazd_next', function (C) { return C.say('c3_predict_end'); }, 'c3_warn')
    },
    { id: 'c3_warn', chapter: 'ch3', obj: 'obj.c3_warn', extras: FEARX,
      tick: when('c3_warn_done', 'flag:warned_gorazd', function (C) {
        C.clue('obs_nobody_believes');
        return C.say('c3_end').then(function () { return C.fade(1, 0.6); });
      }, 'c4_start')
    },
    /* ================= CHAPTER 4 ================= */
    /* September 3: the bus; Lisa's first, formal visit */
    { id: 'c4_start', chapter: 'ch4', loc: 'djordje_house', spawn: 'window', forceSpawn: true, chapterCard: 'chap.ch4', chapterSub: 'sub.c4', day: 68,
      env: { time: 'day', weather: 'overcast', horror: 0.25 }, envInstant: true, obj: null, music: 'explore', noSave: true,
      npcs: { lisa: null, sava: null },
      scene: function (C) {
        /* from his window: the two of them walking up from the bridge (a cut to the view he is describing), the flash */
        var V = null;
        var view = function () {
          V = true; C.hide('player', true);
          C.load('village', 'south_road'); C.env({ time: 'day', weather: 'overcast' }, true);
          C.spawn('lisa', [53.4, 79.5], { dir: 'up', noTalk: true }); C.spawn('jessica', [52.4, 80.2], { dir: 'up', noTalk: true });
          C.walk('lisa', [54.4, 66.5], { noWait: true, speed: 0.55 }); C.walk('jessica', [53.2, 67.4], { noWait: true, speed: 0.55 });
          return C.cam({ target: [53.6, 0.5, 74], dist: 30, pitch: 0.75, time: 0.1, raw: true });
        };
        var back = function () {
          if (!V) return; V = null;
          C.despawn('lisa'); C.despawn('jessica');
          C.load('djordje_house', 'window'); C.env({ time: 'day', weather: 'overcast' }, true); C.hide('player', false); C.camRelease();
          C.anim('player', null); C.step('player', 0, 0.6, { dir: 'up' });
        };
        return C.say('c4_window', { at: {
          1: function () { C.face('player', 'up'); },
          3: function () { C.fade(1, 4).then(view).then(function () { return C.fade(0, 3); }); },
          4: function () {   // she raises her camera toward our hill — a flash; he steps back from the window
            var e = C.ent('jessica'); if (e) { e.path = null; C.face('jessica', 'up'); C.anim('jessica', 'point'); var fl = C.keyLight(e.x, e.z, { y: 1.6, dz: -0.3, radius: 6, intensity: 4, color: [1, 1, 1] }); C.wait(0.15).then(function () { C.unlight(fl); }); }
            C.wait(0.9).then(function () { return C.fade(1, 5); }).then(back).then(function () { return C.fade(0, 4); });
          }
        } }).then(function () { if (V) { back(); BTS.Env.fadeBlack = 0; BTS.Env.fadeGoal = 0; } C.sfx('door_knock', {}); return C.wait(1.2); })
          .then(function () {
            C.sfx('door_open', {});
            var d = U.spot('door_in', [3.5, 7.6]);
            C.spawn('sava', d, { dir: 'up', noTalk: true }); C.spawn('lisa', [d[0] + 0.7, d[1] + 0.2], { dir: 'up', noTalk: true });
            C.walk('sava', U.nearPlayer(1.6, 1.4), { noWait: true });
            return C.walk('lisa', U.nearPlayer(-0.9, 1.5));
          })
          .then(function () { C.face('lisa', 'player'); C.face('sava', 'player'); C.face('player', 'lisa'); return C.say('c4_meet', { at: {
            4: function () { C.face('player', 'lisa'); C.frame(['lisa'], { dist: 7, y: 0.25, time: 1.0 }); },   // her shoes
            5: function () { C.frame(['lisa', 'player'], { time: 1.0 }); },
            13: function () { C.anim('lisa', 'sketch'); }, 14: function () { C.anim('lisa', null); },
            21: function () { C.anim('lisa', null); C.wait(1.2).then(function () { C.anim('lisa', 'sketch'); }); }, 23: function () { C.anim('lisa', null); },
            24: function () { C.face('player', 'down'); },
            26: function () { C.face('lisa', 'up'); C.frame([[11.2, 1.6], 'lisa'], { dist: 10, y: 1.2, time: 1.2 }); },   // the drawings on the wall
            31: function () { var p = C.ent('player'); C.step('player', 0.9, 0.4, { dir: 'left' }); C.walk('lisa', U.freeNear(11.3, 2.3), { dir: 'up' }); },
            35: function () { C.walk('player', U.freeNear(11.3, 2.2), { dir: 'down' }); C.face('lisa', 'player'); },
            40: function () { C.anim('lisa', 'sketch'); }, 41: function () { C.anim('lisa', null); },
            43: function () { C.anim('lisa', null); C.face('lisa', 'player'); },
            47: function () { C.anim('lisa', 'interact'); }, 48: function () { C.anim('lisa', null); C.face('lisa', 'sava'); }
          } }); })
          .then(function () { var d = U.spot('door_in', [3.5, 7.6]); C.walk('sava', d, { noWait: true }); return C.walk('lisa', d); })
          .then(function () { C.sfx('door_close', {}); C.despawn('lisa'); C.despawn('sava'); return C.say('c4_meet_after'); })
          .then(function () { return C.fade(1, 0.8); });
      }, after: 'c4_walk'
    },
    /* September 4: "show me your village" — the houses, Mila, Jessica, and the old woman's gift */
    { id: 'c4_walk', chapter: 'ch4', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'sub.c4b', day: 69,
      env: { time: 'morning', weather: 'clear', horror: 0.2 }, envInstant: true, obj: 'obj.c4_walk', music: 'village', musicByLoc: { djordje_house: 'explore' },
      npcs: { lisa: LISA_FOLLOW },
      scene: function (C) {
        return C.say('c4_ten').then(function () {
          C.sfx('door_knock', {}); C.sfx('door_open', {});
          C.spawn('lisa', U.spot('door_in', [3.5, 7.6]), { dir: 'up', noTalk: true });
          return C.walk('lisa', U.nearPlayer(-0.9, 1.4));
        }).then(function () { C.face('lisa', 'player'); return C.say('c4_walk_in'); });
      },
      triggers: [
        { loc: 'village', id: 'houses', box: [47, 44, 58, 54], run: function (C) {
          return C.cam({ target: [53, 1, 50], time: 1.2 }).then(function () { return C.say('c4_houses', { at: {
            1: function () { C.anim('player', 'point'); C.face('player', 'up'); },
            2: function () { C.face('player', 'right'); }, 3: function () { C.face('player', 'left'); },
            4: function () { C.anim('player', null); C.face('player', 'lisa'); },
            8: function () { C.anim('lisa', 'talk'); }, 9: function () { C.anim('lisa', null); }
          } }); })
            .then(function () { var m = C.ent('mila'); if (m) { C.face('mila', 'player'); return C.say('c4_mila_a').then(function () { C.walk('lisa', [m.x + 0.8, m.z + 0.5]); return C.wait(1.4); }).then(function () { C.anim('lisa', 'kneel'); C.face('lisa', 'mila'); return C.say('c4_mila_b'); }).then(function () { C.anim('lisa', null); }); } });
        }, set: 'c4_houses_done' },
        { loc: 'village', id: 'guest', box: [62, 38, 72, 46], cond: 'flag:c4_houses_done', run: function (C) {
          C.walk('jessica', [68.6, 42.0], { noWait: true, dir: 'up' });   // at her easel
          return C.cam({ target: [67.5, 1, 43], time: 1.2 }).then(function () { C.face('jessica', 'player'); return C.say('c4_jess_meet', { at: {
            3: function () { C.face('jessica', 'player'); C.frame(['jessica', [69, 41]], { dist: 9, time: 1.0 }); },
            7: function () { C.face('player', 'jessica'); },
            9: function () { C.face('jessica', 'left'); },
            10: function () { C.face('jessica', 'player'); }
          } }); })
            .then(function () { C.spawn('jaglika', [72.5, 47.5], { dir: 'left', noTalk: true }); return C.walk('jaglika', [69.6, 43.4]); })
            .then(function () { C.face('jaglika', 'jessica'); C.face('jessica', 'jaglika'); return C.say('c4_jag_gift', { at: {
              1: function () { C.frame(['jaglika', 'jessica'], { dist: 9, time: 1.0 }); },
              3: function () { C.anim('jaglika', 'interact'); C.anim('jessica', 'interact'); },
              4: function () { C.anim('jaglika', null); C.anim('jessica', null); },
              5: function () { C.anim('player', 'point'); C.shake(0.2); },
              6: function () { C.anim('player', null); C.anim('jessica', 'talk'); C.face('jessica', 'player'); },
              8: function () { C.anim('jessica', null); C.face('lisa', 'player'); },
              9: function () { C.face('jaglika', 'player'); C.frame(['jaglika'], { dist: 8, time: 1.0 }); },
              12: function () { C.face('jaglika', 'player'); C.frame(['jaglika'], { dist: 8, time: 1.0 }); }
            } }); })
            .then(function () { C.anim('jaglika', null); C.walk('jaglika', [82, 48], { noWait: true }); return C.wait(2.0); })
            .then(function () { C.despawn('jaglika'); return C.say('c4_jag_after'); })
            .then(function () { return C.fade(1, 0.8); });
        }, clue: 'obs_jag_jessica', then: 'c4_tea' }
      ],
      blockExit: WALK_BLOCK
    },
    /* September 5: tea. He tries to tell her; she hears grief */
    { id: 'c4_tea', chapter: 'ch4', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'sub.c4c', day: 70,
      env: { time: 'morning', weather: 'overcast', horror: 0.2 }, envInstant: true, obj: null, music: 'explore', noSave: true,
      npcs: { lisa: { loc: 'djordje_house', at: A('lisa_table', [6.4, 5.4]), act: 'idle', dir: 'left', noTalk: true } },
      scene: function (C) {
        C.anim('player', 'sit'); C.face('lisa', 'player');
        var L0 = U.spot('lisa_table', [6.4, 5.4]);
        return C.say('c4_tea', { at: {
          7: function () { C.anim('lisa', 'interact'); }, 8: function () { C.anim('lisa', null); },
          9: function () {   // she takes the lamp to the window; he gets up and takes it back
            C.walk('lisa', [6.1, 1.3], { dir: 'up' }).then(function () { C.anim('lisa', 'interact'); return C.wait(0.6); }).then(function () { C.anim('lisa', null); return C.walk('lisa', L0, { dir: 'left' }); });
            C.wait(2.4).then(function () { C.anim('player', null); return C.walk('player', [6.6, 1.4], { dir: 'up' }); }).then(function () { C.anim('player', 'interact'); return C.wait(0.6); })
              .then(function () { C.anim('player', null); return C.walk('player', 'table', { dir: 'up' }); }).then(function () { C.anim('player', 'sit'); });
          },
          13: function () { C.step('lisa', 0.5, 0.4, { dir: 'left' }); },
          15: function () { C.walk('lisa', [6.1, 1.4], { dir: 'up' }); },
          18: function () { C.face('lisa', 'up'); },
          19: function () { C.walk('lisa', L0, { dir: 'left' }).then(function () { C.face('lisa', 'player'); }); },
          23: function () { C.anim('lisa', 'interact'); C.wait(0.8).then(function () { C.anim('lisa', null); }); },
          36: function () { C.anim('player', null); C.face('player', 'lisa'); }
        } }).then(function () { C.anim('player', null); });
      }, after: 'c4_compare'
    },
    /* interactive: compare the guesthouse with the drawing from August 30 — what changed? */
    { id: 'c4_compare', chapter: 'ch4', obj: 'obj.c4_compare', music: 'village', musicByLoc: { djordje_house: 'explore' }, env: { time: 'day', weather: 'overcast', horror: 0.22 },
      npcs: { lisa: LISA_FOLLOW, stana: { loc: 'village', at: 'guest_bench', act: 'sit', dir: 'down', noTalk: true } },
      interact: [{ loc: 'village', id: 'cmp_guest', at: A('guest_door', [64.6, 40.6], 1.6, 0.6), label: 'it.guest_compare', verb: 'verb.look', dlg: 'c4_compare', clue: 'obs_guest_herbs', set: 'compared', hint: true, once: true }],
      tick: when('c4_cmp_done', 'flag:compared&clue:hyp_jessica_next', function (C) { return C.say('c4_jess_next').then(function () { return C.fade(1, 0.8); }); }, 'c4_gorazd'),
      blockExit: WALK_BLOCK
    },
    /* September 8: Gorazd */
    { id: 'c4_gorazd', chapter: 'ch4', loc: 'village', spawn: 'djordje_door', forceSpawn: true, chapterCard: 'sub.c4d', day: 73,
      env: { time: 'day', weather: 'rain', horror: 0.3 }, envInstant: true, obj: 'obj.c4_gorazd', music: 'symptoms', musicByLoc: { djordje_house: 'explore' },
      extras: FEARX, shadows: { gorazd: { stage: 2 } }, stages: { gorazd: 2, jessica: 2 },
      scene: function (C) { return C.say('c4_intro'); }
    },
    { id: 'c4_gorazd_in', chapter: 'ch4', obj: 'obj.c4_gorazd_in', music: 'symptoms', extras: FEARX,
      npcs: { gorazd: GORAZD_IN },
      interact: [
        { loc: 'gorazd_house', id: 'letter', at: [5.9, 3.0], label: 'it.letter', verb: 'verb.read', dlg: 'c4_letter', clue: 'obs_gorazd_letter', hint: true, once: true },
        { loc: 'gorazd_house', id: 'mirror_g', at: [7.4, 0.9], label: 'it.mirror', dlg: 'c4_mirror', clue: 'obs_gorazd_mirror', hint: true, once: true },
        { loc: 'gorazd_house', id: 'doorframe', at: [10.5, 6.8], label: 'it.doorframe', dlg: 'c4_doorframe', item: 'amulet_gorazd', hint: true, once: true }
      ],
      observe: { gorazd: { run: function (C) { return C.say('c4_observe_gorazd'); }, clue: 'sk_gorazd' } },
      tick: when('c4_gorazd_done', 'clue:obs_gorazd_letter&clue:obs_gorazd_mirror&item:amulet_gorazd&clue:sk_gorazd', function (C) { return C.say('c4_gorazd_out').then(function () { return C.fade(1, 0.8); }); }, 'c4_evening')
    },
    /* September 8, evening: Lisa's own story */
    { id: 'c4_evening', chapter: 'ch4', loc: 'djordje_house', spawn: 'table', forceSpawn: true, day: 73,
      env: { time: 'evening', weather: 'rain', horror: 0.3 }, envInstant: true, obj: null, music: 'explore', noSave: true,
      npcs: { lisa: { loc: 'djordje_house', at: A('lisa_table', [6.4, 5.4]), act: 'idle', dir: 'left', noTalk: true } },
      scene: function (C) {
        C.anim('player', 'sit'); C.face('lisa', 'player');
        return C.fade(0, 0.8).then(function () { return C.say('c4_lisa_wound', { at: {
          4: function () { C.anim('player', 'interact'); C.wait(0.8).then(function () { C.anim('player', 'sit'); }); },   // the needle on the table
          7: function () { C.face('lisa', 'down'); }, 10: function () { C.face('lisa', 'player'); },
          11: function () { C.face('lisa', 'up'); }, 12: function () { C.face('lisa', 'player'); },
          19: function () { C.anim('lisa', 'talk'); }, 20: function () { C.anim('lisa', null); }
        } }); }).then(function () { return C.fade(1, 1.0); });
      },
      after: 'c4_gorazd_dead'
    }
  ]);

  D('c3_wake', [['>', '1'], ['>', '2'], ['>', '3'], ['*', '4'], { item: 'opeka_letter' }, ['>', '5'], ['>', '6'], ['>', '7'], ['>', '8'], ['>', '9'], ['>', '10']]);
  D('c3_reread', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5'], ['>', '6'], ['>', '7']]);
  D('c3_g_zajko', [['*', '1'], ['>', '2'], ['>', '3']]); D('c3_g_pecko', [['*', '1'], ['>', '2'], ['>', '3']]); D('c3_g_gvozdin', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c3_graves_end', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c3_sava_register', [['sava', '1'], ['sava', '2'], ['dj', '3'], ['sava', '4', { p: 'worried' }], ['sava', '5']]);
  D('c3_pattern', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c3_milka', [['milka', '1', { p: 'worried' }], ['dj', '2'], ['milka', '3'], ['milka', '4', { p: 'worried' }], ['milka', '5'], ['>', '6'], { clue: 'obs_jag_gorazd' }]);
  D('c3_stana', [['stana', '1'], ['dj', '2'], ['stana', '3'], ['stana', '4', { p: 'worried' }], ['stana', '5'], ['>', '6'], { clue: 'obs_jag_asks_stana' }]);
  D('c3_sight_end', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c3_predict_end', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c3_gorazd', [['*', '1'], ['gorazd', '2', { p: 'angry' }], ['dj', '3'], ['gorazd', '4', { p: 'angry' }], ['gorazd', '5', { p: 'angry' }], ['gorazd', '6'], ['>', '7'], { set: 'warned_gorazd' }]);
  D('c3_sava', [['sava', '1'], ['sava', '2', { p: 'worried' }], ['>', '3']]);
  D('c3_dragan', [['dragan', '1', { p: 'angry' }], ['dragan', '2'], ['>', '3']]);
  D('c3_zlatko', [['zlatko', '1', { p: 'sad' }], ['>', '2']]);
  D('c3_jablan', [['jablan', '1', { p: 'tired' }]]);
  D('c3_end', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c3_fear_milka', [['milka', '1', { p: 'worried' }], ['milka', '2']]);
  D('c4_window', [['>', '1'], ['>', '2'], ['>', '3'], ['*', '4'], ['>', '5'], ['>', '6']]);
  D('c4_meet', [
    ['sava', '1', { p: 'smile' }], ['lisa', '2'], ['*', '3'], ['>', '4'], ['lisa', '5'],
    ['lisa', '6'], { choice: [['c1', 'q1a'], ['c2', 'q1b']] },
    { label: 'q1a' }, ['dj', '7'], ['lisa', '8', { p: 'worried' }], ['dj', '9'], ['*', '10'], ['>', '11'], { call: 'trust', args: 1 }, { goto: 'q2' },
    { label: 'q1b' }, ['dj', '12'], ['*', '13'], ['>', '14'],
    { label: 'q2' }, ['lisa', '15'], { choice: [['c3', 'q2a'], ['c4', 'q2b'], ['c5', 'q2c']] },
    { label: 'q2a' }, ['dj', '16'], ['lisa', '17', { p: 'smile' }], { call: 'trust', args: 1 }, { goto: 'q3' },
    { label: 'q2b' }, ['dj', '18'], ['lisa', '19', { p: 'worried' }], ['dj', '20'], ['*', '21'], ['>', '22'], ['lisa', '23', { p: 'worried' }], { set: 'told_lisa_early' }, { goto: 'q3' },
    { label: 'q2c' }, ['*', '24'], ['lisa', '25'],
    { label: 'q3' }, ['*', '26'], ['lisa', '27'], ['dj', '28'], ['lisa', '29'], ['>', '30'],
    { choice: [['c6', 'q3a'], ['c7', 'q3b']] },
    { label: 'q3a' }, ['*', '31'], ['lisa', '32', { p: 'smile' }], ['dj', '33'], ['lisa', '34', { p: 'smile' }], { call: 'trust', args: 1 }, { goto: 'q4' },
    { label: 'q3b' }, ['*', '35'], ['lisa', '36'], ['>', '37'],
    { label: 'q4' }, ['lisa', '38', { p: 'smile' }], { choice: [['c8', 'q4a'], ['c9', 'q4b']] },
    { label: 'q4a' }, ['dj', '39'], ['*', '40'], { set: 'told_tea' }, { call: 'trust', args: 1 }, { goto: 'end' },
    { label: 'q4b' }, ['dj', '41'], ['lisa', '42'],
    { label: 'end' }, ['lisa', '43'], ['lisa', '44'], ['dj', '45'], ['lisa', '46', { p: 'smile' }], ['*', '47'], ['sava', '48']
  ]);
  D('c4_meet_after', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c4_ten', [['>', '1'], ['>', '2']]);
  D('c4_walk_in', [['lisa', '1', { p: 'smile' }], ['lisa', '2'], ['dj', '3'], ['lisa', '4', { p: 'smile' }], ['>', '5']]);
  D('c4_houses', [['*', '1'], ['dj', '2'], ['dj', '3'], ['lisa', '4'], ['dj', '5'], ['lisa', '6'], ['dj', '7'], ['>', '8'], ['>', '9']]);
  D('c4_mila_a', [['mila', '1', { p: 'sad' }], ['*', '2']]);
  D('c4_mila_b', [['lisa', '1', { p: 'smile' }], ['*', '2'], ['lisa', '3', { p: 'smile' }], ['mila', '4', { p: 'smile' }], ['>', '5'], ['>', '6']]);
  D('c4_jess_meet', [['jessica', '1', { p: 'smile' }], ['jessica', '2'], ['*', '3'], ['jessica', '4'],
    { choice: [['c1', 'a'], ['c2', 'b']] },
    { label: 'a' }, ['dj', '5'], ['jessica', '6', { p: 'smile' }], { goto: 'e' },
    { label: 'b' }, ['*', '7'], ['jessica', '8'], ['*', '9'],
    { label: 'e' }, ['jessica', '10', { p: 'smile' }], ['>', '11'], ['lisa', '12', { p: 'smile' }]]);
  D('c4_jag_gift', [['jaglika', '1'], ['jaglika', '2'], ['*', '3'], ['jessica', '4', { p: 'smile' }],
    { choice: [['c1', 'shout'], ['c2', 'silent']] },
    { label: 'shout' }, ['dj', '5'], ['*', '6'], ['jessica', '7', { p: 'smile' }], ['lisa', '8', { p: 'worried' }], ['*', '9'], ['>', '10'], { set: 'shouted_jag' }, { goto: 'e' },
    { label: 'silent' }, ['>', '11'], ['*', '12'],
    { label: 'e' }]);
  D('c4_jag_after', [['lisa', '1', { p: 'smile' }], ['>', '2'], ['jessica', '3', { p: 'smile' }], ['>', '4']]);
  D('c4_tea', [
    ['*', '1'], { if: 'flag:told_tea', then: 'tea' }, ['lisa', '2'], ['>', '3'], ['lisa', '4', { p: 'worried' }], ['dj', '5'], ['lisa', '6', { p: 'smile' }], { set: 'told_tea' }, { goto: 'lamp' },
    { label: 'tea' }, ['*', '7'], ['>', '8'],
    { label: 'lamp' }, ['*', '9'], ['lisa', '10'], ['dj', '11'], ['lisa', '12'], ['*', '13'], ['>', '14'],
    ['*', '15'], ['lisa', '16'], ['>', '17'], ['*', '18'], ['lisa', '19'], ['>', '20'],
    ['lisa', '21', { p: 'smile' }],
    { choice: [['c1', 'jag'], ['c2', 'h17'], ['c3', 'win']] },
    { label: 'jag' }, ['dj', '22'], ['*', '23'], ['lisa', '24', { p: 'worried' }], ['lisa', '25', { p: 'sad' }], ['>', '26'], { set: 'told_lisa_pattern' }, { goto: 'e' },
    { label: 'h17' }, ['dj', '27'], ['*', '28'], ['lisa', '29', { p: 'smile' }], ['>', '30'], { call: 'trust', args: 1 }, { goto: 'e' },
    { label: 'win' }, ['dj', '31'], ['lisa', '32'], ['dj', '33'], ['lisa', '34', { p: 'smile' }], { call: 'trust', args: 1 },
    { label: 'e' }, ['>', '35'], ['dj', '36'], ['lisa', '37'], ['>', '38']
  ]);
  D('c4_compare', [['*', '1'], ['>', '2'],
    { label: 'q' }, { choice: [['c1', 'chimney', { once: true }], ['c2', 'bench', { once: true }], ['c3', 'door']] },
    { label: 'chimney' }, ['>', '3'], { goto: 'q' },
    { label: 'bench' }, ['>', '4'], { goto: 'q' },
    { label: 'door' }, ['*', '5'], ['>', '6'], ['lisa', '7'], ['stana', '8', { p: 'worried' }], ['lisa', '9', { p: 'worried' }], ['>', '10'], ['>', '11'], ['>', '12']]);
  D('c4_jess_next', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c4_lisa_walk', [['lisa', '1', { p: 'smile' }]]);
  D('c4_lisa_cmp', [['lisa', '1']]);
  D('c4_jessica_day', [['jessica', '1', { p: 'smile' }], ['>', '2']]);
  D('c4_jessica_sick', [['jessica', '1', { p: 'tired' }], ['jessica', '2', { p: 'worried' }], ['>', '3']]);
  D('c4_stana_day', [['stana', '1'], ['stana', '2', { p: 'smile' }]]);
  D('c4_intro', [['>', '1'], { if: 'flag:told_lisa_pattern', then: 'p' }, ['>', '2'], { goto: 'r' }, { label: 'p' }, ['>', '3'], { label: 'r' }, ['>', '4'], ['>', '5'], ['>', '6'], ['>', '7']]);
  D('c4_gorazd', [['*', '1'], ['gorazd', '2', { p: 'angry' }], ['gorazd', '3', { p: 'scared' }], ['>', '4'], ['gorazd', '5'], ['gorazd', '6', { p: 'scared' }], ['gorazd', '7'], { set: 'gorazd_open' }]);
  D('c4_gorazd_inside', [['gorazd', '1', { p: 'scared' }], ['*', '2', { do: { call: 'gorazdBare' } }], ['gorazd', '3'], ['>', '4'], ['gorazd', '5', { p: 'sad' }], ['>', '6']]);
  D('c4_gorazd_again', [['gorazd', '1', { p: 'scared' }]]);
  D('c4_letter', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c4_mirror', [['*', '1'], ['gorazd', '2', { p: 'scared' }], ['gorazd', '3', { p: 'scared' }], ['>', '4']]);
  D('c4_doorframe', [['*', '1'], ['>', '2'], ['gorazd', '3', { p: 'angry' }], ['>', '4']]);
  D('c4_observe_gorazd', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c4_gorazd_out', [['gorazd', '1', { p: 'tired' }], ['gorazd', '2', { p: 'sad' }], ['dj', '3'], ['>', '4'], ['>', '5']]);
  D('c4_lisa_wound', [
    ['*', '1'], ['>', '2'], ['lisa', '3', { p: 'tired' }],
    { choice: [['c1', 'tell'], ['c2', 'keep']] },
    { label: 'tell' }, ['*', '4'], ['dj', '5'], ['lisa', '6', { p: 'worried' }], ['lisa', '7', { p: 'sad' }], ['>', '8'], { set: 'told_lisa_gorazd' }, { goto: 'w' },
    { label: 'keep' }, ['>', '9'],
    { label: 'w' }, ['dj', '10'], ['*', '11'], ['lisa', '12', { p: 'sad' }], ['lisa', '13'], ['lisa', '14', { p: 'sad' }], ['dj', '15'], ['lisa', '16', { p: 'tired' }], ['>', '17'],
    ['dj', '18'], ['*', '19'], ['lisa', '20', { p: 'smile' }], ['>', '21'], ['lisa', '22'], { if: 'flag:trust_hi', then: 'warm' }, ['>', '23'], { end: true },
    { label: 'warm' }, ['lisa', '24', { p: 'smile' }], ['>', '25']
  ]);
  D('c4_milka', [['milka', '1', { p: 'worried' }], ['milka', '2']]);
  D('c4_dragan', [['dragan', '1', { p: 'worried' }], ['dragan', '2']]);
  D('c4_sava', [['sava', '1', { p: 'worried' }], ['sava', '2']]);
  D('c4_vesna', [['vesna', '1', { p: 'worried' }]]);
  D('c4_tihomir', [['tihomir', '1'], ['tihomir', '2', { p: 'worried' }]]);

  /* ---------- staging cues for talk / interactable dialogues ---------- */
  var Q = BTS.Cutscene.cue;
  Q('c3_gorazd', {
    1: function (C) { C.face('gorazd', 'down'); var n = 0; var chop = function () { if (n++ > 3 || !C.has('gorazd')) return; C.anim('gorazd', 'interact'); C.sfx('chop', {}); C.wait(0.35).then(function () { if (C.has('gorazd')) C.anim('gorazd', null); return C.wait(0.45); }).then(chop); }; chop(); },
    2: function (C) { C.face('gorazd', 'player'); },
    4: function (C) { C.anim('gorazd', 'point'); }, 5: function (C) { C.anim('gorazd', 'point'); C.shake(0.2); },
    6: function (C) { C.anim('gorazd', 'point'); C.shadowFear({ look: 0.3 }); }, 7: function (C) { C.anim('gorazd', null); }
  });
  Q('c4_gorazd', {   // in the rain, cap to the eyebrows, looking over his shoulder
    1: function (C) { C.face('gorazd', 'left'); C.wait(0.9).then(function () { if (!C.has('gorazd')) return; C.face('gorazd', 'right'); return C.wait(0.9).then(function () { if (C.has('gorazd')) C.face('gorazd', 'up'); }); }); },
    2: function (C) { C.face('gorazd', 'player'); },
    5: function (C) { C.face('gorazd', 'up'); }, 6: function (C) { C.face('gorazd', 'player'); },
    7: function (C) { C.anim('gorazd', 'point'); C.face('gorazd', 'up'); }
  });
  Q('c4_gorazd_inside', {
    1: function (C) { C.anim('gorazd', 'fear'); C.sfx('door_close', {}); },
    2: function (C) { C.anim('gorazd', 'interact'); C.frame(['gorazd'], { dist: 7.5, time: 0.8 }); },   // the cap comes off (sheet 'gorazd_bare')
    3: function (C) { C.anim('gorazd', null); }
  });
  Q('c4_mirror', {
    2: function (C) {   // in the mirror his shadow is standing; he is not — he cowers; on the wall the shadow stands
      C.anim('gorazd', 'cower'); C.shadow('gorazd', { wall: { x: 7.4, z: 0.3, y: 0 } }); C.shadowPose('gorazd', 'idle', 0, 'up');
      C.frame(['gorazd', [7.4, 0.9]], { dist: 9, y: 1.3, time: 1.0 });
    },
    4: function (C) { C.anim('gorazd', null); C.shadow('gorazd', { wall: null, pose: null, poseDir: null }); }
  });
  Q('c4_doorframe', { 1: function (C) { C.face('player', 'up'); C.anim('player', 'point'); }, 3: function (C) { C.anim('player', null); C.anim('gorazd', 'fear'); }, 4: function (C) { C.anim('gorazd', null); C.anim('player', 'interact'); } });
  Q('c4_observe_gorazd', {
    2: function (C) { C.shadow('gorazd', { lenMul: 2.3, angle: 1.3 }); C.sfx('shadow_stretch', { vol: 0.5 }); },
    3: function (C) { C.anim('player', 'sketch'); }
  });
  Q('c4_gorazd_out', { 1: function (C) { C.shadow('gorazd', { lenMul: 1, angle: 0 }); C.anim('player', null); }, 4: function (C) { C.face('gorazd', 'player'); C.anim('gorazd', 'talk'); }, 5: function (C) { C.anim('gorazd', null); } });
  Q('c4_compare', {
    1: function (C) { C.face('player', 'up'); C.anim('player', 'point'); C.frame([[62, 40.75], 'player'], { dist: 10, y: 1.2, time: 1.0 }); },   // the drawing held up against the house
    5: function (C) { C.frame([[62, 40.75]], { dist: 6.5, y: 2.1, time: 1.2 }); },                                                              // the herbs above the door
    7: function (C) { C.anim('player', null); C.face('lisa', 'stana'); }, 8: function (C) { C.face('stana', 'lisa'); }
  });

  add('sava', [{ beats: 'c3_graves..c3_link', dlg: 'c3_sava_register' }, { beats: 'c3_sightings..c3_warn', dlg: 'c3_sava' }, { beats: 'c4_start..c4_evening', dlg: 'c4_sava' }]);
  add('milka', [{ beats: 'c3_sightings..c3_predict', if: '!clue:obs_jag_gorazd', dlg: 'c3_milka' }, { beats: 'c3_start..c3_warn', dlg: 'c3_fear_milka' }, { beats: 'c4_start..c4_evening', dlg: 'c4_milka' }]);
  add('stana', [{ beats: 'c3_sightings..c3_predict', if: '!clue:obs_jag_asks_stana', dlg: 'c3_stana' }, { beats: 'c4_start..c4_evening', dlg: 'c4_stana_day' }]);
  add('gorazd', [{ beats: 'c3_warn', dlg: 'c3_gorazd' }, { beats: 'c4_gorazd', dlg: 'c4_gorazd', then: 'c4_gorazd_in' }, { beats: 'c4_gorazd_in', if: '!flag:gorazd_bare', dlg: 'c4_gorazd_inside' }, { beats: 'c4_gorazd_in', dlg: 'c4_gorazd_again' }]);
  add('jessica', [{ beats: 'c4_walk..c4_compare', dlg: 'c4_jessica_day' }, { beats: 'c4_gorazd..c4_evening', dlg: 'c4_jessica_sick' }]);
  add('lisa', [{ beats: 'c4_walk', dlg: 'c4_lisa_walk' }, { beats: 'c4_compare', dlg: 'c4_lisa_cmp' }]);
  add('dragan', [{ beats: 'c3_start..c3_warn', dlg: 'c3_dragan' }, { beats: 'c4_start..c4_evening', dlg: 'c4_dragan' }]);
  add('vesna', [{ beats: 'c4_start..c4_evening', dlg: 'c4_vesna' }]);
  add('tihomir', [{ beats: 'c4_start..c4_evening', dlg: 'c4_tihomir' }]);
  add('zlatko', [{ beats: 'c2_smithy..c9_prepare', dlg: 'c3_zlatko' }]);
  add('jablan', [{ beats: 'c2_smithy..c9_prepare', dlg: 'c3_jablan' }]);
  BTS.Data.globalProps.push(
    { beats: 'c4_compare..c4_jessica_dead', loc: 'village', sprite: 'herbs_hang', at: 'guest_door', y: 2.2 },
    { beats: 'c4_jessica_dead..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_gorazd', scale: 1.1 },
    { beats: 'c5_ally..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_jessica', scale: 1.1 });
})();
