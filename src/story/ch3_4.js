/* CHAPTER 3 — the pattern (September 1–4). CHAPTER 4 — Gorazd and Jessica (September 8–15). */
'use strict';
(function () {
  var D = BTS.D, U = BTS.StoryUtil, when = U.when, add = U.add;
  var FEARX = [
    { loc: 'village', sheet: 'vil_man2', at: [56, 50], act: 'look', lines: ['extra_fear_a', 'extra_fear_b'] },
    { loc: 'village', sheet: 'vil_woman1', at: [44, 49], act: 'idle', dir: 'down', lines: ['extra_fear_b', 'extra_fear_c'] }
  ];
  BTS.Story.define([
    /* ================= CHAPTER 3 ================= */
    { id: 'c3_start', chapter: 'ch3', loc: 'djordje_house', spawn: 'bed', forceSpawn: true, chapterCard: 'chap.ch3', chapterSub: 'sub.c3', day: 66,
      env: { time: 'morning', weather: 'overcast', horror: 0.2 }, envInstant: true, obj: 'obj.c3_start', music: 'explore',
      scene: function (C) { return C.say('c3_wake'); },
      interact: [{ loc: 'djordje_house', id: 'desk3', at: [12.4, 1.6], label: 'it.desk', verb: 'verb.read', dlg: 'c3_reread', clue: 'obs_jag_smithy', set: 'church_open', hint: true, then: 'c3_graves' }]
    },
    { id: 'c3_graves', chapter: 'ch3', obj: 'obj.c3_graves', extras: FEARX,
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
      tick: when('c3_sight_done', 'clue:obs_jag_gorazd&clue:obs_jag_jessica', function (C) { return C.say('c3_sight_end'); }, 'c3_predict')
    },
    { id: 'c3_predict', chapter: 'ch3', obj: 'obj.c3_predict', extras: FEARX,
      tick: when('c3_predict_done', 'clue:hyp_gorazd_next&clue:hyp_jessica_next', function (C) { return C.say('c3_predict_end'); }, 'c3_warn')
    },
    { id: 'c3_warn', chapter: 'ch3', obj: 'obj.c3_warn', extras: FEARX,
      tick: when('c3_warn_done', 'flag:warned_gorazd&flag:warned_jessica', function (C) {
        C.clue('obs_nobody_believes');
        return C.say('c3_end').then(function () { return C.fade(1, 0.6); });
      }, 'c4_start')
    },
    /* ================= CHAPTER 4 ================= */
    { id: 'c4_start', chapter: 'ch4', loc: 'village', spawn: 'djordje_door', forceSpawn: true, chapterCard: 'chap.ch4', chapterSub: 'sub.c4', day: 73,
      env: { time: 'day', weather: 'rain', horror: 0.3 }, envInstant: true, obj: 'obj.c4_start', music: 'symptoms', musicByLoc: { djordje_house: 'explore' },
      extras: FEARX, shadows: { gorazd: { stage: 2 } }, stages: { gorazd: 2, jessica: 3 },
      scene: function (C) { return C.say('c4_intro'); }
    },
    { id: 'c4_gorazd_in', chapter: 'ch4', obj: 'obj.c4_gorazd_in', music: 'symptoms', extras: FEARX,
      npcs: { gorazd: { loc: 'gorazd_house', at: 'gorazd_spot', act: 'look', stage: 2 } },
      interact: [
        { loc: 'gorazd_house', id: 'letter', at: [5.9, 3.0], label: 'it.letter', verb: 'verb.read', dlg: 'c4_letter', clue: 'obs_gorazd_letter', hint: true, once: true },
        { loc: 'gorazd_house', id: 'mirror_g', at: [7.4, 0.9], label: 'it.mirror', dlg: 'c4_mirror', clue: 'obs_gorazd_mirror', hint: true, once: true },
        { loc: 'gorazd_house', id: 'doorframe', at: [10.5, 6.8], label: 'it.doorframe', dlg: 'c4_doorframe', item: 'amulet_gorazd', hint: true, once: true }
      ],
      observe: { gorazd: { run: function (C) { return C.say('c4_observe_gorazd'); }, clue: 'sk_gorazd' } },
      tick: when('c4_gorazd_done', 'clue:obs_gorazd_letter&clue:obs_gorazd_mirror&item:amulet_gorazd&clue:sk_gorazd', function (C) { return C.say('c4_gorazd_out'); }, 'c4_jessica')
    },
    { id: 'c4_jessica', chapter: 'ch4', obj: 'obj.c4_jessica', music: 'symptoms', extras: FEARX,
      npcs: { gorazd: { loc: 'village', at: 'gorazd_yard', act: 'look', stage: 2 } },
      interact: [
        { loc: 'guesthouse', id: 'camera', at: [12.4, 1.6], label: 'it.camera', dlg: 'c4_camera', item: 'jessica_photo', clue: 'obs_jessica_photos', hint: true, once: true, condLive: true, cond: 'flag:jessica_talked' },
        { loc: 'guesthouse', id: 'diary', at: [11.2, 1.6], label: 'it.diary', verb: 'verb.read', dlg: 'c4_diary', clue: 'obs_jessica_diary', hint: true, once: true, condLive: true, cond: 'flag:jessica_talked' }
      ],
      observe: { jessica: { run: function (C) { return C.say('c4_observe_jessica'); }, clue: 'sk_jessica' } },
      tick: when('c4_jess_done', 'clue:obs_jessica_photos&clue:obs_jessica_diary&clue:sk_jessica', function (C) { return C.say('c4_jess_out').then(function () { return C.fade(1, 0.6); }); }, 'c4_gorazd_dead')
    },
    { id: 'c4_gorazd_dead', chapter: 'ch4', loc: 'outskirts', spawn: 'from_village_w', forceSpawn: true, chapterCard: 'sub.c4_gorazd', day: 76,
      env: { time: 'morning', weather: 'fog', horror: 0.4 }, envInstant: true, obj: 'obj.c4_gorazd_dead', music: 'symptoms',
      npcs: { gorazd: { loc: 'outskirts', at: [41.5, 35.5], act: 'lie', stage: 4, noTalk: true }, radoje: { loc: 'outskirts', at: [43.5, 37], act: 'mourn', dir: 'left' }, sava: { loc: 'outskirts', at: [39.5, 37.4], act: 'pray', dir: 'right' }, dragan: { loc: 'outskirts', at: [42, 38.5], act: 'idle', dir: 'up' } },
      props: [{ loc: 'outskirts', sprite: 'lantern_hang', at: [40.6, 35.2], scale: 1.4, emissive: true }],
      triggers: [{ loc: 'outskirts', box: [33, 28, 52, 42], run: function (C) {
        return C.cam({ target: [41.5, 0.5, 36], time: 1.6 }).then(function () { return C.say('c4_field'); });
      }, clue: 'fact_gorazd_death', then: 'c4_jessica_dead' }]
    },
    { id: 'c4_jessica_dead', chapter: 'ch4', loc: 'village', spawn: 'well', forceSpawn: true, chapterCard: 'sub.c4_jessica', day: 80, deaths: ['gorazd'],
      env: { time: 'evening', weather: 'drizzle', horror: 0.45 }, envInstant: true, obj: 'obj.c4_jessica_dead', music: 'symptoms',
      npcs: { stana: { loc: 'village', at: [61.5, 41.5], act: 'mourn', dir: 'down' }, milka: { loc: 'village', at: [59.5, 42.2], act: 'idle', dir: 'right' } },
      triggers: [{ loc: 'village', box: [56, 38, 70, 46], run: function (C) {
        return C.cam({ target: [62, 1, 41], time: 1.4 }).then(function () { return C.say('c4_guest'); }).then(function () { return C.fade(1, 0.7); });
      }, clue: 'fact_jessica_death', then: 'c5_arrival' }]
    }
  ]);

  D('c3_wake', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c3_reread', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5'], ['>', '6'], ['>', '7']]);
  D('c3_g_zajko', [['*', '1'], ['>', '2']]); D('c3_g_pecko', [['*', '1'], ['>', '2']]); D('c3_g_gvozdin', [['*', '1'], ['>', '2']]);
  D('c3_graves_end', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c3_sava_register', [['sava', '1'], ['sava', '2'], ['dj', '3'], ['sava', '4', { p: 'worried' }], ['sava', '5']]);
  D('c3_pattern', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c3_milka', [['milka', '1', { p: 'worried' }], ['dj', '2'], ['milka', '3'], ['milka', '4', { p: 'worried' }], ['milka', '5'], ['>', '6'], { clue: 'obs_jag_gorazd' }]);
  D('c3_stana', [['stana', '1'], ['dj', '2'], ['stana', '3'], ['stana', '4', { p: 'worried' }], ['stana', '5'], ['>', '6'], { clue: 'obs_jag_jessica' }]);
  D('c3_sight_end', [['>', '1'], ['>', '2']]);
  D('c3_predict_end', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c3_gorazd', [['*', '1'], ['gorazd', '2', { p: 'angry' }], ['dj', '3'], ['gorazd', '4', { p: 'angry' }], ['gorazd', '5', { p: 'angry' }], ['gorazd', '6'], ['>', '7'], { set: 'warned_gorazd' }]);
  D('c3_jessica', [['jessica', '1', { p: 'smile' }], ['dj', '2'], ['jessica', '3'], ['dj', '4'], ['jessica', '5', { p: 'worried' }], ['*', '6'], ['jessica', '7'],
    { choice: [['c1', 'a'], ['c2', 'b']] }, { label: 'a' }, ['dj', '8'], ['jessica', '9', { p: 'smile' }], ['jessica', '10'], { goto: 'e' }, { label: 'b' }, ['*', '11'], ['jessica', '12', { p: 'worried' }],
    { label: 'e' }, ['>', '13'], { set: 'warned_jessica' }]);
  D('c3_sava', [['sava', '1'], ['sava', '2', { p: 'worried' }], ['>', '3']]);
  D('c3_dragan', [['dragan', '1', { p: 'angry' }], ['dragan', '2']]);
  D('c3_end', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c4_intro', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c4_gorazd', [['*', '1'], ['gorazd', '2', { p: 'angry' }], ['gorazd', '3', { p: 'scared' }], ['>', '4'], ['gorazd', '5'], ['gorazd', '6', { p: 'scared' }], ['gorazd', '7'], { set: 'gorazd_open' }]);
  D('c4_gorazd_inside', [['gorazd', '1', { p: 'scared' }], ['gorazd', '2'], ['>', '3']]);
  D('c4_letter', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c4_mirror', [['*', '1'], ['gorazd', '2', { p: 'scared' }], ['gorazd', '3', { p: 'scared' }], ['>', '4']]);
  D('c4_doorframe', [['*', '1'], ['>', '2'], ['gorazd', '3', { p: 'angry' }], ['>', '4']]);
  D('c4_observe_gorazd', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c4_gorazd_out', [['gorazd', '1', { p: 'tired' }], ['gorazd', '2', { p: 'sad' }], ['>', '3'], ['>', '4'], { set: 'guest_open' }]);
  D('c4_stana', [['stana', '1', { p: 'worried' }], ['stana', '2'], ['stana', '3', { p: 'sad' }]]);
  D('c4_jessica_talk', [['jessica', '1', { p: 'tired' }], ['jessica', '2', { p: 'scared' }], ['jessica', '3'], ['dj', '4'], ['jessica', '5', { p: 'scared' }], ['jessica', '6', { p: 'sad' }],
    { choice: [['c1', 'a'], ['c2', 'b']] }, { label: 'a' }, ['dj', '7'], ['jessica', '8', { p: 'sad' }], { goto: 'e' }, { label: 'b' }, ['*', '9'], ['jessica', '10', { p: 'tired' }], { label: 'e' }, ['jessica', '11'], { set: 'jessica_talked' }]);
  D('c4_jessica_again', [['jessica', '1', { p: 'blank' }]]);
  D('c4_camera', [['*', '1'], ['>', '2'], ['>', '3'], ['jessica', '4', { p: 'scared' }], ['>', '5']]);
  D('c4_diary', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c4_observe_jessica', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c4_jess_out', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c4_field', [['*', '1'], ['radoje', '2', { p: 'sad' }], ['radoje', '3'], ['>', '4'], ['>', '5'], ['sava', '6'], ['>', '7'], ['>', '8']]);
  D('c4_guest', [['*', '1'], ['stana', '2', { p: 'sad' }], ['stana', '3', { p: 'sad' }], ['milka', '4'], ['>', '5'], ['>', '6'], ['>', '7']]);
  D('c3_fear_milka', [['milka', '1', { p: 'worried' }]]);
  D('c4_milka', [['milka', '1', { p: 'worried' }], ['milka', '2']]);
  D('c4_dragan', [['dragan', '1', { p: 'worried' }], ['dragan', '2']]);
  D('c4_sava', [['sava', '1', { p: 'worried' }], ['sava', '2']]);
  D('c4_vesna', [['vesna', '1', { p: 'worried' }]]);
  D('c4_tihomir', [['tihomir', '1'], ['tihomir', '2', { p: 'worried' }]]);

  add('sava', [{ beats: 'c3_graves..c3_link', dlg: 'c3_sava_register' }, { beats: 'c3_sightings..c3_warn', dlg: 'c3_sava' }, { beats: 'c4_start..c4_jessica_dead', dlg: 'c4_sava' }]);
  add('milka', [{ beats: 'c3_sightings..c3_predict', if: '!clue:obs_jag_gorazd', dlg: 'c3_milka' }, { beats: 'c3_start..c3_warn', dlg: 'c3_fear_milka' }, { beats: 'c4_start..c4_jessica_dead', dlg: 'c4_milka' }]);
  add('stana', [{ beats: 'c3_sightings..c3_predict', if: '!clue:obs_jag_jessica', dlg: 'c3_stana' }, { beats: 'c4_jessica', dlg: 'c4_stana' }]);
  add('gorazd', [{ beats: 'c3_warn', dlg: 'c3_gorazd' }, { beats: 'c4_start', dlg: 'c4_gorazd', then: 'c4_gorazd_in' }, { beats: 'c4_gorazd_in', dlg: 'c4_gorazd_inside' }]);
  add('jessica', [{ beats: 'c3_warn', dlg: 'c3_jessica' }, { beats: 'c4_jessica', if: '!flag:jessica_talked', dlg: 'c4_jessica_talk' }, { beats: 'c4_jessica', dlg: 'c4_jessica_again' }]);
  add('dragan', [{ beats: 'c3_start..c3_warn', dlg: 'c3_dragan' }, { beats: 'c4_start..c4_jessica_dead', dlg: 'c4_dragan' }]);
  add('vesna', [{ beats: 'c4_start..c4_jessica_dead', dlg: 'c4_vesna' }]);
  add('tihomir', [{ beats: 'c4_start..c4_jessica_dead', dlg: 'c4_tihomir' }]);
  BTS.Data.globalProps.push({ beats: 'c4_jessica_dead..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_gorazd', scale: 1.1 }, { beats: 'c5_arrival..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_jessica', scale: 1.1 });
})();
