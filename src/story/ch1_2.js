/* CHAPTER 1 — Zajko changes (July). CHAPTER 2 — the first deaths (July 29 – August 30). */
'use strict';
(function () {
  var D = BTS.D, T = BTS.Data.talk, S = BTS.State;
  function add(id, arr) { T[id] = (T[id] || []).concat(arr); }
  /* run a scene once when a condition becomes true (checked every frame outside cutscenes) */
  function when(key, cond, scene, next) {
    return function () {
      if (S.done(key) || BTS.Dialogue.active || BTS.Cutscene.running || BTS.Game.transitioning) return;
      if (!BTS.Cond.eval(cond)) return;
      S.markDone(key);
      BTS.Cutscene.play(scene, key).then(function () { if (next) BTS.Story.goto(next, true); });
    };
  }
  BTS.StoryUtil = { when: when, add: add };
  var MOURN = [
    { loc: 'village', sheet: 'vil_woman2', at: [33.6, 46.4], act: 'mourn', dir: 'up', lines: ['extra_fear_b'] },
    { loc: 'village', sheet: 'vil_old', at: [28.2, 46.2], act: 'mourn', dir: 'up', lines: ['extra_fear_a'] },
    { loc: 'village', sheet: 'vil_man1', at: [35.6, 46.8], act: 'idle', dir: 'up', lines: ['extra_fear_b'] }
  ];

  BTS.Story.define([
    /* ================= CHAPTER 1 ================= */
    { id: 'c1_start', chapter: 'ch1', loc: 'djordje_house', spawn: 'bed', forceSpawn: true, chapterCard: 'chap.ch1', chapterSub: 'sub.c1', day: 12,
      env: { time: 'morning', weather: 'overcast', horror: 0 }, envInstant: true, obj: 'obj.c1_start', music: 'explore',
      scene: function (C) { return C.say('c1_wake'); },
      interact: [{ loc: 'djordje_house', id: 'note', at: [5.6, 3.6], label: 'it.note', verb: 'verb.read', dlg: 'c1_note', set: 'zajko_house_open', hint: true, then: 'c1_visit' }]
    },
    { id: 'c1_visit', chapter: 'ch1', obj: 'obj.c1_visit', musicByLoc: { zajko_house: 'symptoms' },
      shadows: { zajko: { stage: 2 } },
      interact: [{ loc: 'zajko_house', id: 'sill', at: [15.5, 0.9], label: 'it.sill', dlg: 'c1_sill', item: 'amulet_zajko', clue: 'obs_amulet_zajko', hint: true, once: true }],
      observe: { zajko: { run: function (C) { return C.say('c1_observe'); }, clue: 'sk_zajko_2' } },
      tick: when('c1_runaway', 'flag:talked_zajko&clue:sk_zajko_2&item:amulet_zajko', function (C) {
        C.face('zajko', 'player');
        return C.say('c1_runaway').then(function () { C.flag('outskirts_open'); return C.walk('zajko', 'door_in', { run: true }); }).then(function () { C.sfx('door_close', {}); C.despawn('zajko'); return C.say('c1_after_run'); });
      }, 'c1_river')
    },
    { id: 'c1_river', chapter: 'ch1', obj: 'obj.c1_river', music: 'village', musicByLoc: { zajko_house: 'symptoms', outskirts: 'symptoms' }, env: { time: 'day', weather: 'overcast' },
      shadows: { zajko: { stage: 2 } }
    },
    { id: 'c1_back', chapter: 'ch1', obj: 'obj.c1_back', env: { time: 'evening', weather: 'overcast', transition: 20 },
      triggers: [{ loc: 'djordje_house', box: [-1, -1, 19, 10], run: function (C) { return C.say('c1_home'); }, then: 'c1_storm' }]
    },
    { id: 'c1_storm', chapter: 'ch1', obj: 'obj.c1_storm', env: { time: 'night', weather: 'storm', horror: 0.1 }, envInstant: true, music: 'symptoms',
      interact: [{ loc: 'djordje_house', id: 'window_storm', at: [13.6, 0.9], label: 'it.window', verb: 'verb.look', hint: true, run: function (C) {
        return C.say('c1_storm_a').then(function () { BTS.Env.strike(); return C.wait(0.4); }).then(function () { return C.say('c1_storm_b'); })
          .then(function () { BTS.Env.strike(); return C.wait(0.5); }).then(function () { return C.say('c1_storm_c'); }).then(function () { return C.fade(1, 0.5); });
      }, clue: 'obs_storm_gate', then: 'c2_bell' }],
      blockExit: { out: 'block_night' }
    },
    /* ================= CHAPTER 2 ================= */
    { id: 'c2_bell', chapter: 'ch2', loc: 'djordje_house', spawn: 'bed', forceSpawn: true, chapterCard: 'chap.ch2', chapterSub: 'sub.c2', day: 32,
      env: { time: 'morning', weather: 'fog', horror: 0.15 }, envInstant: true, obj: 'obj.c2_bell', music: 'silence',
      scene: function (C) {
        C.anim('player', 'sit');
        var bell = function () { C.sfx('bell', { x: 91.5, z: 23.5, vol: 0.9 }); };
        bell();
        return C.wait(3.5).then(function () { bell(); return C.say('c2_wake'); }).then(function () { bell(); return C.wait(2); });
      },
      extras: MOURN,
      triggers: [{ loc: 'village', box: [24, 40, 40, 52], run: function (C) {
        return C.cam({ target: [31.5, 1, 45], time: 1.5 }).then(function () { return C.say('c2_gate'); });
      }, clue: 'fact_zajko_death', set: 'church_open', then: 'c2_funeral' }],
      blockExit: { west: 'block_home', south: 'block_home' }
    },
    { id: 'c2_funeral', chapter: 'ch2', loc: 'church', spawn: 'door_in', obj: 'obj.c2_funeral', music: 'silence', env: { time: 'day', weather: 'fog', horror: 0.2 },
      npcs: {
        zajko: { loc: 'church', at: 'bier', act: 'lie', dir: 'down', noTalk: true, stage: 4 },
        sava: { loc: 'church', at: 'sava_spot', act: 'idle', dir: 'down' },
        pecko: { loc: 'church', at: 'mourner1', act: 'mourn', dir: 'up', stage: 1 },
        gvozdin: { loc: 'church', at: 'mourner2', act: 'mourn', dir: 'up' },
        milka: { loc: 'church', at: 'mourner3', act: 'pray', dir: 'up' },
        stana: { loc: 'church', at: 'mourner4', act: 'mourn', dir: 'up' },
        vesna: { loc: 'church', at: 'mourner5', act: 'mourn', dir: 'right' },
        jessica: null, gorazd: null, dragan: null, tihomir: { loc: 'village', at: [90.2, 25.6], act: 'mourn', dir: 'right' }
      },
      shadows: { pecko: { stage: 1 } },
      scene: function (C) {
        C.sfx('drone', { dur: 8, vol: 0.5 }); return C.cam({ target: [5, 0.5, 7], time: 0.1 }).then(function () { return C.say('c2_funeral'); });
      },
      observe: { pecko: { run: function (C) { return C.say('c2_observe_pecko'); }, clue: 'sk_pecko', set: 'saw_pecko_shadow' } },
      triggers: [{ loc: 'village', id: 'herbs', box: [80, 26, 95, 36], cond: 'flag:saw_pecko_shadow', run: function (C) {
        C.spawn('pecko', [86.5, 31.5], { act: 'mourn', dir: 'down', noTalk: true, stage: 1 });
        C.spawn('jaglika', [79.5, 34.8], { dir: 'right', noTalk: true });
        return C.cam({ target: [85, 1, 32], time: 1.4 }).then(function () { return C.walk('jaglika', [85.4, 32.2]); })
          .then(function () { C.face('pecko', 'jaglika'); C.anim('jaglika', 'interact'); return C.say('c2_herbs'); })
          .then(function () { C.anim('jaglika', null); return C.walk('jaglika', [76, 40], { noWait: true }); }).then(function () { return C.wait(1.6); })
          .then(function () { C.despawn('jaglika'); C.despawn('pecko'); });
      }, clue: 'obs_jag_herbs_pecko', then: 'c2_smithy' }],
      blockExit: { west: 'block_home', south: 'block_home' }
    },
    { id: 'c2_smithy', chapter: 'ch2', obj: 'obj.c2_smithy', day: 35, env: { time: 'day', weather: 'overcast', horror: 0.15 }, music: 'village',
      chapterCard: 'sub.c2_smithy',
      loc: 'village', spawn: 'well',
      npcs: { gvozdin: { loc: 'village', at: 'smithy', act: 'work', dir: 'up', stage: 2 } },
      shadows: { gvozdin: { stage: 2 }, pecko: { stage: 1 } }
    },
    { id: 'c2_parents', chapter: 'ch2', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'sub.c2_parents', day: 64,
      env: { time: 'evening', weather: 'rain', horror: 0.25 }, envInstant: true, obj: 'obj.c2_parents', music: 'symptoms', deaths: ['pecko', 'gvozdin'],
      npcs: { milka: { loc: 'djordje_house', at: 'lisa_table', act: 'mourn', dir: 'left' } },
      scene: function (C) { C.anim('player', 'sit'); return C.say('c2_milka_news'); }, after: 'c2_house'
    },
    { id: 'c2_house', chapter: 'ch2', obj: 'obj.c2_house', env: { time: 'evening', weather: 'drizzle', horror: 0.25 }, music: 'symptoms',
      props: [
        { loc: 'zajko_house', sprite: 'cloth_dark', at: [7.0, 0.3], y: 1.2, scale: 3 },
        { loc: 'zajko_house', sprite: 'candle', at: [6.4, 3.4], y: 0.8, emissive: false }, { loc: 'zajko_house', sprite: 'flame', at: [6.4, 3.42], y: 1.06, emissive: true, scale: 0.4 },
        { loc: 'zajko_house', sprite: 'photo_frame', at: [7.6, 3.5], y: 0.8 },
        { loc: 'village', sprite: 'cross_grave_new', at: [90.5, 31.2], scale: 1.1 }, { loc: 'village', sprite: 'cross_grave_new', at: [89, 31.6], scale: 1.1 }
      ],
      interact: [
        { loc: 'zajko_house', id: 'toy', at: [18.6, 2.4], label: 'it.toy', verb: 'verb.take', dlg: 'c2_toy', item: 'zajko_toy', hint: true, once: true },
        { loc: 'zajko_house', id: 'notebook', at: [11.0, 1.0], label: 'it.notebook', verb: 'verb.read', dlg: 'c2_notebook', item: 'pecko_note', clue: 'fact_jag_visited_pecko', hint: true, once: true },
        { loc: 'zajko_house', id: 'mirror', at: [7.0, 1.0], label: 'it.mirror', dlg: 'c2_mirror' }
      ],
      tick: when('c2_house_done', 'item:zajko_toy&clue:fact_jag_visited_pecko', function (C) { return C.say('c2_house_end').then(function () { return C.fade(1, 0.6); }); }, 'c3_start')
    }
  ]);

  /* ---------- dialogues ---------- */
  D('c1_wake', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5']]);
  D('c1_note', [['*', '1'], ['pecko', '2'], ['>', '3'], ['>', '4']]);
  D('c1_pecko', [['pecko', '1', { p: 'worried' }], ['pecko', '2', { p: 'sad' }], ['pecko', '3'], ['>', '4'], ['pecko', '5', { p: 'worried' }],
    { choice: [['c1', 'a'], ['c2', 'b']] }, { label: 'a' }, ['dj', '6'], ['pecko', '7', { p: 'sad' }], { goto: 'e' }, { label: 'b' }, ['*', '8'], ['pecko', '9'], { label: 'e' }, { clue: 'obs_zajko_changes' }, ['pecko', '10']]);
  D('c1_pecko_again', [['pecko', '1', { p: 'worried' }]]);
  D('c1_zajko', [['zajko', '1', { p: 'angry' }], ['>', '2'], ['zajko', '3', { p: 'angry' }], ['dj', '4'], ['zajko', '5', { p: 'scared' }], ['zajko', '6', { p: 'angry' }],
    { choice: [['c1', 'gate'], ['c2', 'shadow'], ['c3', 'quiet']] },
    { label: 'gate' }, ['dj', '7'], ['zajko', '8', { p: 'scared' }], ['zajko', '9'], { goto: 'e' },
    { label: 'shadow' }, ['dj', '10'], ['zajko', '11', { p: 'angry' }], ['zajko', '12', { p: 'scared' }], { goto: 'e' },
    { label: 'quiet' }, ['*', '13'], ['zajko', '14', { p: 'tired' }],
    { label: 'e' }, ['>', '15'], { set: 'talked_zajko' }]);
  D('c1_zajko_again', [['zajko', '1', { p: 'angry' }], ['>', '2']]);
  D('c1_observe', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c1_sill', [['*', '1'], ['>', '2'], ['>', '3'], ['pecko', '4'], ['>', '5']]);
  D('c1_runaway', [['zajko', '1', { p: 'scared', shake: true }], ['zajko', '2', { p: 'angry' }], ['zajko', '3', { p: 'scared' }], ['pecko', '4']]);
  D('c1_after_run', [['pecko', '1', { p: 'sad' }], ['>', '2']]);
  D('c1_gvozdin', [['gvozdin', '1'], ['gvozdin', '2'], ['>', '3'], ['gvozdin', '4', { p: 'tired' }]]);
  D('c1_river_talk', [['*', '1'], ['zajko', '2', { p: 'scared' }], ['zajko', '3'], ['>', '4'], ['zajko', '5', { p: 'scared' }],
    { choice: [['c1', 'draw'], ['c2', 'hand']] },
    { label: 'draw' }, ['*', '6'], ['dj', '7'], ['zajko', '8', { p: 'sad' }], { goto: 'v' },
    { label: 'hand' }, ['*', '9'], ['zajko', '10', { p: 'sad' }],
    { label: 'v' }, ['zajko', '11', { p: 'scared', shake: true }], ['>', '12'], ['>', '13'], ['zajko', '14', { p: 'scared' }], ['*', '15', { sfx: 'water_splash' }], ['>', '16']]);
  D('c1_home', [['>', '1'], ['>', '2']]);
  D('c1_storm_a', [['*', '1'], ['>', '2']]);
  D('c1_storm_b', [['>', '1'], ['>', '2']]);
  D('c1_storm_c', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c2_wake', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c2_gate', [['*', '1'], ['milka', '2', { p: 'sad' }], ['milka', '3', { p: 'sad' }], ['>', '4'], ['milka', '5', { p: 'worried' }], ['milka', '6', { p: 'sad' }], ['*', '7'], ['gvozdin', '8', { p: 'tired' }], ['>', '9'], ['>', '10']]);
  D('c2_funeral', [['*', '1'], ['sava', '2'], ['sava', '3'], ['>', '4'], ['>', '5'], ['*', '6'], ['>', '7']]);
  D('c2_observe_pecko', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c2_pecko_church', [['pecko', '1', { p: 'sad' }], ['pecko', '2', { p: 'sad' }]]);
  D('c2_gvozdin_church', [['gvozdin', '1', { p: 'tired' }]]);
  D('c2_herbs', [['jaglika', '1'], ['jaglika', '2'], ['pecko', '3', { p: 'sad' }], ['*', '4'], ['>', '5'], ['>', '6']]);
  D('c2_smithy_talk', [['gvozdin', '1', { p: 'tired', sfx: 'chop' }], ['gvozdin', '2'], ['*', '3', { sfx: 'anvil' }], ['>', '4'], ['*', '5', { sfx: 'anvil' }], ['*', '6'], ['>', '7'], ['*', '8', { sfx: 'metal', shake: true }], ['gvozdin', '9', { p: 'scared' }], ['dj', '10'], ['gvozdin', '11', { p: 'tired' }], ['gvozdin', '12', { p: 'sad' }], ['>', '13']]);
  D('c2_pecko_bakery', [['pecko', '1', { p: 'blank' }], ['>', '2'], ['pecko', '3', { p: 'blank' }], ['>', '4']]);
  D('c2_milka_news', [['*', '1'], ['milka', '2', { p: 'sad' }], ['milka', '3', { p: 'sad' }], ['milka', '4'], ['>', '5'], ['milka', '6', { p: 'worried' }], ['milka', '7'],
    { choice: [['c1', 'a'], ['c2', 'b']] }, { label: 'a' }, ['dj', '8'], ['milka', '9', { p: 'sad' }], { goto: 'e' }, { label: 'b' }, ['*', '10'], ['milka', '11', { p: 'sad' }],
    { label: 'e' }, ['>', '12'], { clue: ['fact_pecko_death', 'fact_gvozdin_death'] }, { set: 'zajko_house_open' }]);
  D('c2_toy', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c2_notebook', [['*', '1'], ['>', '2'], ['*', '3'], ['>', '4'], ['>', '5']]);
  D('c2_mirror', [['>', '1'], ['>', '2']]);
  D('c2_house_end', [['>', '1'], ['>', '2'], ['>', '3']]);

  /* ---------- talk ---------- */
  add('pecko', [{ beats: 'c1_visit', if: '!clue:obs_zajko_changes', dlg: 'c1_pecko' }, { beats: 'c1_start..c1_storm', dlg: 'c1_pecko_again' }, { beats: 'c2_funeral', dlg: 'c2_pecko_church' }, { beats: 'c2_smithy', dlg: 'c2_pecko_bakery' }]);
  add('zajko', [{ beats: 'c1_visit', if: '!flag:talked_zajko', dlg: 'c1_zajko' }, { beats: 'c1_visit', dlg: 'c1_zajko_again' }, { beats: 'c1_river', dlg: 'c1_river_talk', clue: 'obs_zajko_visions', then: 'c1_back' }]);
  add('gvozdin', [{ beats: 'c1_start..c1_storm', dlg: 'c1_gvozdin' }, { beats: 'c2_funeral', dlg: 'c2_gvozdin_church' }, { beats: 'c2_smithy', dlg: 'c2_smithy_talk', clue: ['obs_gvozdin_shadow', 'sk_gvozdin'], then: 'c2_parents' }]);
  BTS.Data.globalProps = (BTS.Data.globalProps || []).concat([
    { beats: 'c2_funeral..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_zajko', scale: 1.1 },
    { beats: 'c2_house..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_pecko', scale: 1.1 },
    { beats: 'c2_house..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_gvozdin', scale: 1.1 }
  ]);
})();
