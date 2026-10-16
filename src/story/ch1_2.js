/* CHAPTER 1 — Zajko (July 2 – 9). CHAPTER 2 — the first deaths (July 29 – August 31):
   Zajko, then Đorđe's own parents, Mama (Pečko, †27.08) and Tata (Gvozdin, †30.08). */
'use strict';
(function () {
  var D = BTS.D, S = BTS.State, U = BTS.StoryUtil, when = U.when, add = U.add, A = BTS.SpotAt;
  var MOURN = [
    { loc: 'village', sheet: 'vil_woman2', at: [34.2, 48.2], act: 'mourn', dir: 'up', lines: ['extra_fear_b'] },
    { loc: 'village', sheet: 'vil_old', at: [27.4, 47.6], act: 'mourn', dir: 'up', lines: ['extra_fear_a'] },
    { loc: 'village', sheet: 'vil_man1', at: [38.4, 47.8], act: 'idle', dir: 'up', lines: ['extra_fear_b'] }
  ];
  var KUM = { loc: 'outskirts', sprite: 'dog_lie', at: [47.8, 48.0] };   // the stray follows Zajko to the mill

  BTS.Story.define([
    /* ================= CHAPTER 1 ================= */
    { id: 'c1_start', chapter: 'ch1', loc: 'djordje_house', spawn: 'bed', forceSpawn: true, chapterCard: 'chap.ch1', chapterSub: 'sub.c1', day: 5,
      env: { time: 'morning', weather: 'clear', horror: 0 }, envInstant: true, obj: 'obj.c1_start', music: 'explore',
      scene: function (C) { C.sfx('bell', { x: 91.5, z: 23.5, vol: 0.5 }); return C.wait(1.4).then(function () { return C.say('c1_wake'); }); }
    },
    { id: 'c1_mill', chapter: 'ch1', obj: 'obj.c1_mill', env: { time: 'day', weather: 'clear', horror: 0 }, music: 'village', musicByLoc: { djordje_house: 'explore' },
      props: [KUM], shadows: { zajko: { stage: 1 } }
    },
    { id: 'c1_note', chapter: 'ch1', loc: 'djordje_house', spawn: 'bed', forceSpawn: true, chapterCard: 'sub.c1b', day: 12,
      env: { time: 'morning', weather: 'overcast', horror: 0.05 }, envInstant: true, obj: 'obj.c1_note', music: 'explore',
      scene: function (C) { return C.say('c1_wake2'); }
    },
    { id: 'c1_visit', chapter: 'ch1', obj: 'obj.c1_visit', musicByLoc: { zajko_house: 'symptoms' },
      shadows: { zajko: { stage: 2 } },
      interact: [{ loc: 'zajko_house', id: 'sill', at: A('sill', [15.5, 0.9]), label: 'it.sill', dlg: 'c1_sill', item: 'amulet_zajko', clue: 'obs_amulet_zajko', hint: true, once: true }],
      observe: { zajko: { run: function (C) { return C.say('c1_observe'); }, clue: 'sk_zajko_2' } },
      tick: when('c1_runaway', 'flag:talked_zajko&clue:sk_zajko_2&item:amulet_zajko', function (C) {
        C.face('zajko', 'player');
        return C.say('c1_runaway').then(function () { C.flag('outskirts_open'); return C.walk('zajko', U.spot('door_in', [4, 7.6]), { run: true }); }).then(function () { C.sfx('door_close', {}); C.despawn('zajko'); return C.say('c1_after_run'); });
      }, 'c1_river')
    },
    { id: 'c1_river', chapter: 'ch1', obj: 'obj.c1_river', music: 'village', musicByLoc: { zajko_house: 'symptoms', outskirts: 'symptoms' }, env: { time: 'day', weather: 'overcast' },
      shadows: { zajko: { stage: 2 } }
    },
    { id: 'c1_back', chapter: 'ch1', obj: 'obj.c1_back', env: { time: 'evening', weather: 'overcast', transition: 20 },
      triggers: [{ loc: 'djordje_house', box: [-1, -1, 40, 40], run: function (C) { return C.say('c1_home'); }, then: 'c1_storm' }]
    },
    { id: 'c1_storm', chapter: 'ch1', obj: 'obj.c1_storm', env: { time: 'night', weather: 'storm', horror: 0.1 }, envInstant: true, music: 'symptoms',
      hide: ['pecko', 'gvozdin'],
      interact: [{ loc: 'djordje_house', id: 'window_storm', at: A('window', [13.6, 1.4]), label: 'it.window', verb: 'verb.look', hint: true, run: function (C) {
        return C.say('c1_storm_a').then(function () { BTS.Env.strike(); return C.wait(0.4); }).then(function () { return C.say('c1_storm_b'); })
          .then(function () { BTS.Env.strike(); return C.wait(0.5); }).then(function () { return C.say('c1_storm_c'); })
          .then(function () { C.sfx('door_knock', {}); return C.wait(0.45); }).then(function () { C.sfx('door_knock', {}); C.spawn('gvozdin', U.spot('door_in', [3.5, 7.6]), { dir: 'up', noTalk: true }); return C.walk('gvozdin', U.nearPlayer(-1.2, 1.4)); })
          .then(function () { C.face('gvozdin', 'player'); C.face('player', 'gvozdin'); return C.say('c1_storm_tata'); })
          .then(function () { BTS.Env.strike(); return C.fade(1, 0.5); });
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
      extras: MOURN, stages: { pecko: 1 }, shadows: { pecko: { stage: 1 } },
      npcs: { zlatko: { loc: 'village', at: [32.6, 45.6], act: 'mourn', dir: 'up', noTalk: true }, jablan: { loc: 'village', at: [31.0, 45.4], act: 'mourn', dir: 'up', noTalk: true } },
      triggers: [{ loc: 'village', box: [24, 40, 40, 52], run: function (C) {
        return C.cam({ target: [31.5, 1, 45], time: 1.5 }).then(function () { return C.say('c2_gate'); });
      }, clue: 'fact_zajko_death', set: 'church_open', then: 'c2_funeral' }],
      blockExit: { west: 'block_home', south: 'block_home' }
    },
    { id: 'c2_funeral', chapter: 'ch2', loc: 'church', spawn: 'door_in', obj: 'obj.c2_funeral', music: 'silence', env: { time: 'day', weather: 'fog', horror: 0.2 },
      npcs: {
        zajko: { loc: 'church', at: 'bier', act: 'lie', dir: 'down', noTalk: true, stage: 4 },
        sava: { loc: 'church', at: 'sava_spot', act: 'idle', dir: 'down' },
        zlatko: { loc: 'church', at: 'mourner1', act: 'mourn', dir: 'up' },
        jablan: { loc: 'church', at: 'mourner2', act: 'mourn', dir: 'up' },
        pecko: { loc: 'church', at: 'mourner3', act: 'mourn', dir: 'up', stage: 1 },
        gvozdin: { loc: 'church', at: 'mourner4', act: 'mourn', dir: 'up' },
        milka: { loc: 'church', at: 'mourner5', act: 'pray', dir: 'up' },
        stana: null, vesna: null, gorazd: null, dragan: null, tihomir: { loc: 'village', at: [90.2, 25.6], act: 'mourn', dir: 'right' }
      },
      shadows: { pecko: { stage: 1 } },
      scene: function (C) {
        C.sfx('drone', { dur: 8, vol: 0.5 }); return C.cam({ target: [5, 0.5, 7], time: 0.1 }).then(function () { return C.say('c2_funeral'); });
      },
      observe: { pecko: { run: function (C) { return C.say('c2_observe_pecko').then(function () { C.face('zlatko', 'player'); return C.say('c2_rabbit'); }); }, clue: 'sk_pecko', set: 'saw_pecko_shadow' } },
      triggers: [{ loc: 'village', id: 'herbs', box: [80, 26, 95, 36], cond: 'flag:saw_pecko_shadow', run: function (C) {
        C.spawn('pecko', [86.5, 31.5], { act: 'mourn', dir: 'down', noTalk: true, stage: 1 });
        C.spawn('jaglika', [79.5, 34.8], { dir: 'right', noTalk: true });
        return C.cam({ target: [85, 1, 32], time: 1.4 }).then(function () { return C.walk('jaglika', [85.4, 32.2]); })
          .then(function () { C.face('pecko', 'jaglika'); C.anim('jaglika', 'interact'); return C.say('c2_herbs'); })
          .then(function () { C.anim('jaglika', null); return C.walk('jaglika', [76, 40], { noWait: true }); }).then(function () { return C.wait(1.6); })
          .then(function () { C.despawn('jaglika'); return C.say('c2_herbs_after'); }).then(function () { C.despawn('pecko'); });
      }, clue: 'obs_jag_herbs_pecko', then: 'c2_smithy' }],
      blockExit: { west: 'block_home', south: 'block_home' }
    },
    /* interactive: three things at Tata's smithy — one of them is wrong */
    { id: 'c2_smithy', chapter: 'ch2', obj: 'obj.c2_smithy', day: 35, env: { time: 'day', weather: 'overcast', horror: 0.15 }, music: 'village',
      chapterCard: 'sub.c2_smithy',
      loc: 'village', spawn: 'well',
      npcs: { gvozdin: { loc: 'village', at: 'smithy', act: 'work', dir: 'up', stage: 2 }, zlatko: { loc: 'village', at: 'zajko_yard', act: 'mourn', dir: 'down', noTalk: true } },
      shadows: { gvozdin: { stage: 2 }, pecko: { stage: 1 } },
      interact: [
        { loc: 'village', id: 'sm_shoes', at: [38.9, 41.9], label: 'it.horseshoes', dlg: 'c2_sm_shoes', set: 'sm1', hint: true },
        { loc: 'village', id: 'sm_tools', at: [42.8, 41.9], label: 'it.tools', dlg: 'c2_sm_tools', set: 'sm2', hint: true },
        { loc: 'village', id: 'sm_beam', at: [41.7, 40.9], label: 'it.beam', dlg: 'c2_sm_beam', set: 'sm3', hint: true, hy: 2.4 }
      ],
      tick: when('c2_sm_pick', 'flag:sm1&flag:sm2&flag:sm3', function (C) { return C.say('c2_sm_choice'); })
    },
    /* Mama no longer knows him */
    { id: 'c2_mama', chapter: 'ch2', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'sub.c2_mama', day: 54,
      env: { time: 'evening', weather: 'overcast', horror: 0.2 }, envInstant: true, obj: null, music: 'symptoms', noSave: true,
      npcs: { pecko: { loc: 'djordje_house', at: A('kitchen', [5.6, 6.6]), act: 'work', dir: 'up', stage: 2, noTalk: true }, gvozdin: null },
      shadows: { pecko: { stage: 2 } }, stages: { pecko: 2, gvozdin: 2 },
      scene: function (C) {
        return C.say('c2_mama_a').then(function () {
          C.spawn('gvozdin', U.spot('door_in', [3.5, 7.6]), { dir: 'up', noTalk: true, stage: 2 });
          return C.walk('gvozdin', U.nearPlayer(1.2, 0.8));
        }).then(function () { C.face('gvozdin', 'pecko'); return C.say('c2_mama_b'); })
          .then(function () { C.clue('obs_mama_forgets'); return C.fade(1, 0.8); });
      }, after: 'c2_parents'
    },
    { id: 'c2_parents', chapter: 'ch2', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'sub.c2_parents', day: 61,
      env: { time: 'morning', weather: 'drizzle', horror: 0.25 }, envInstant: true, obj: null, music: 'silence', deaths: ['pecko'], noSave: true,
      npcs: { gvozdin: null },
      scene: function (C) {
        C.anim('player', 'sit');
        C.sfx('bell', { x: 91.5, z: 23.5, vol: 0.6 });
        return C.wait(1.5).then(function () { return C.say('c2_morning'); })
          .then(function () {
            C.anim('player', null);
            C.sfx('door_open', {});
            C.spawn('gvozdin', U.spot('parents_room', U.spot('bed', [15.5, 4.2])), { dir: 'down', noTalk: true, stage: 3 });
            return C.walk('gvozdin', U.nearPlayer(1.1, 0.4));
          })
          .then(function () { C.face('gvozdin', 'player'); C.face('player', 'gvozdin'); C.anim('gvozdin', 'weak'); return C.say('c2_tata_news'); })
          .then(function () { C.clue('fact_pecko_death'); return C.fade(1, 1.0); });
      }, after: 'c2_alone'
    },
    { id: 'c2_alone', chapter: 'ch2', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'sub.c2_alone', day: 64,
      env: { time: 'evening', weather: 'rain', horror: 0.25 }, envInstant: true, obj: null, music: 'symptoms', deaths: ['gvozdin'], noSave: true,
      npcs: { sava: { loc: 'djordje_house', at: A('lisa_table', [6.4, 5.4]), act: 'idle', dir: 'left', noTalk: true }, stana: { loc: 'djordje_house', at: A('kitchen', [5.6, 6.6]), act: 'mourn', dir: 'up', noTalk: true } },
      scene: function (C) {
        C.anim('player', 'sit');
        C.face('sava', 'player');
        return C.say('c2_sava_news').then(function () { C.clue('fact_gvozdin_death'); return C.fade(1, 1.0); });
      }, after: 'c2_house'
    },
    { id: 'c2_house', chapter: 'ch2', loc: 'djordje_house', spawn: 'table', forceSpawn: true, obj: 'obj.c2_house', env: { time: 'night', weather: 'drizzle', horror: 0.25 }, envInstant: true, music: 'symptoms',
      hide: ['sava', 'stana'],
      props: [
        { loc: 'djordje_house', sprite: 'cloth_dark', at: A('parents_mirror', [6.8, 0.3]), y: 1.2, scale: 2.4 },
        { loc: 'zajko_house', sprite: 'cloth_dark', at: [7.0, 0.3], y: 1.2, scale: 3 },
        { loc: 'zajko_house', sprite: 'candle', at: [6.4, 3.4], y: 0.8, emissive: false }, { loc: 'zajko_house', sprite: 'flame', at: [6.4, 3.42], y: 1.06, emissive: true, scale: 0.4 },
        { loc: 'zajko_house', sprite: 'photo_frame', at: [7.6, 3.5], y: 0.8 }
      ],
      interact: [
        { loc: 'djordje_house', id: 'notebook', at: A('kitchen', [5.6, 6.6]), label: 'it.notebook', verb: 'verb.read', dlg: 'c2_notebook', item: 'pecko_note', clue: 'fact_jag_visited_pecko', hint: true, once: true },
        { loc: 'djordje_house', id: 'apron', at: A('hall', [2.0, 5.6]), label: 'it.apron', dlg: 'c2_apron', set: 'saw_apron', hint: true, once: true },
        { loc: 'djordje_house', id: 'mirror', at: A('parents_room', [8.2, 2.0]), label: 'it.mirror', run: function (C) {
          return C.say('c2_mirror').then(function () { C.anim('player', 'fear'); C.sfx('heartbeat', { vol: 0.6 }); return C.say('c2_mirror_shadow'); }).then(function () { C.anim('player', null); });
        } }
      ],
      tick: when('c2_house_done', 'flag:saw_apron&clue:fact_jag_visited_pecko', function (C) { return C.say('c2_house_end').then(function () { return C.fade(1, 0.6); }); }, 'c3_start')
    }
  ]);

  /* ---------- dialogues ---------- */
  D('c1_wake', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c1_breakfast', [['pecko', '1', { p: 'smile' }], ['>', '2'], ['pecko', '3'], ['gvozdin', '4', { p: 'smile' }], ['dj', '5'], ['gvozdin', '6'], ['>', '7'],
    ['pecko', '8'], ['>', '9'], ['gvozdin', '10', { p: 'smile' }], { item: 'bread' }, { set: 'outskirts_open' }]);
  D('c1_parents_again', [['pecko', '1', { p: 'smile' }]]);
  D('c1_mill_talk', [
    ['*', '1'], ['zajko', '2', { p: 'smile' }], ['>', '3'], ['zajko', '4', { p: 'smile' }],
    { label: 'stone' }, { choice: [['c1', 'round', { once: true }], ['c2', 'heavy', { once: true }], ['c3', 'flat']] },
    { label: 'round' }, ['*', '5'], ['zajko', '6', { p: 'smile' }], { goto: 'stone' },
    { label: 'heavy' }, ['*', '7'], ['zajko', '8', { p: 'smile' }], { goto: 'stone' },
    { label: 'flat' }, ['*', '9', { sfx: 'water_splash' }], ['>', '10'], ['zajko', '11', { p: 'smile' }],
    ['zajko', '12', { p: 'smile' }], ['dj', '13'], ['zajko', '14'], ['>', '15'], ['*', '16'], ['zajko', '17', { p: 'smile' }], ['dj', '18'], ['zajko', '19', { p: 'smile' }],
    ['*', '20'], ['zajko', '21'], ['>', '22'],
    ['zajko', '23', { p: 'smile' }], ['*', '24', { do: { call: 'anim', args: 'sketch' } }], ['zajko', '25'], ['dj', '26'], ['zajko', '27', { p: 'smile' }], ['dj', '28'], ['zajko', '29', { p: 'smile' }],
    ['zajko', '30', { p: 'tired' }], ['zajko', '31'], ['>', '32'],
    { choice: [['c4', 'tell'], ['c5', 'keep']] },
    { label: 'tell' }, ['dj', '33'], ['zajko', '34', { p: 'worried' }], ['zajko', '35', { p: 'smile' }], { set: 'told_zajko_shadow' }, { goto: 'promise' },
    { label: 'keep' }, ['>', '36'],
    { label: 'promise' }, ['zajko', '37'], ['zajko', '38', { p: 'smile' }], ['dj', '39'], ['zajko', '40', { p: 'smile' }], ['dj', '41'], ['*', '42'], ['>', '43'], { clue: 'obs_zajko_promise' }, ['>', '44']
  ]);
  D('c1_wake2', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c1_mama_news', [['pecko', '1', { p: 'worried' }], ['pecko', '2'], ['>', '3'], ['pecko', '4', { p: 'worried' }], ['gvozdin', '5', { p: 'tired' }], ['>', '6'], { set: 'zajko_house_open' }]);
  D('c1_zlatko', [['zlatko', '1', { p: 'worried' }], ['zlatko', '2', { p: 'sad' }], ['zlatko', '3'], ['>', '4'], ['zlatko', '5', { p: 'worried' }],
    { choice: [['c1', 'a'], ['c2', 'b']] }, { label: 'a' }, ['dj', '6'], ['zlatko', '7', { p: 'sad' }], { goto: 'e' }, { label: 'b' }, ['*', '8'], ['zlatko', '9'], { label: 'e' }, { clue: 'obs_zajko_changes' }, ['zlatko', '10']]);
  D('c1_zlatko_again', [['zlatko', '1', { p: 'worried' }]]);
  D('c1_jablan', [['jablan', '1'], ['jablan', '2'], ['*', '3'], ['jablan', '4', { p: 'tired' }]]);
  D('c1_zajko', [['zajko', '1', { p: 'angry' }], ['>', '2'], ['zajko', '3', { p: 'angry' }], ['dj', '4'], ['zajko', '5', { p: 'scared' }], ['zajko', '6', { p: 'angry' }],
    { choice: [['c1', 'gate'], ['c2', 'shadow'], ['c3', 'quiet']] },
    { label: 'gate' }, ['dj', '7'], ['zajko', '8', { p: 'scared' }], ['zajko', '9'], { goto: 'e' },
    { label: 'shadow' }, ['dj', '10'], ['zajko', '11', { p: 'angry' }], ['zajko', '12', { p: 'scared' }], { goto: 'e' },
    { label: 'quiet' }, ['*', '13'], ['zajko', '14', { p: 'tired' }],
    { label: 'e' }, ['zajko', '16', { p: 'scared' }], ['>', '15'], { set: 'talked_zajko' }]);
  D('c1_zajko_again', [['zajko', '1', { p: 'angry' }], ['>', '2']]);
  D('c1_observe', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c1_sill', [['*', '1'], ['>', '2'], ['>', '3'], ['zlatko', '4'], ['>', '5']]);
  D('c1_runaway', [['zajko', '1', { p: 'scared', shake: true }], ['zajko', '2', { p: 'angry' }], ['zajko', '3', { p: 'scared' }], ['zlatko', '4']]);
  D('c1_after_run', [['zlatko', '1', { p: 'sad' }], ['>', '2'], ['>', '3']]);
  D('c1_gvozdin', [['gvozdin', '1'], ['gvozdin', '2'], ['>', '3'], ['gvozdin', '4', { p: 'tired' }]]);
  D('c1_pecko_bakery', [['pecko', '1', { p: 'smile' }], ['pecko', '2', { p: 'tired' }], ['>', '3']]);
  D('c1_river_talk', [['*', '1'], ['zajko', '2', { p: 'scared' }], ['zajko', '3'], ['>', '4'], ['zajko', '5', { p: 'scared' }],
    { choice: [['c1', 'draw'], ['c2', 'hand']] },
    { label: 'draw' }, ['*', '6'], ['dj', '7'], ['zajko', '8', { p: 'sad' }], { goto: 'v' },
    { label: 'hand' }, ['*', '9'], ['zajko', '10', { p: 'sad' }],
    { label: 'v' }, ['zajko', '17', { p: 'sad' }], ['zajko', '11', { p: 'scared', shake: true }], ['>', '12'], ['>', '13'], ['zajko', '14', { p: 'scared' }], ['*', '15', { sfx: 'water_splash' }], ['>', '16']]);
  D('c1_home', [['>', '1'], ['>', '2']]);
  D('c1_storm_a', [['*', '1'], ['>', '2']]);
  D('c1_storm_b', [['>', '1'], ['>', '2']]);
  D('c1_storm_c', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c1_storm_tata', [['>', '1'], ['gvozdin', '2', { p: 'smile' }], ['dj', '3'], ['gvozdin', '4'], ['*', '5'], ['>', '6']]);
  D('c2_wake', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5']]);
  D('c2_gate', [['*', '1'], ['zlatko', '2', { p: 'sad' }], ['>', '3'], ['zlatko', '4', { p: 'sad' }], ['zlatko', '5', { p: 'sad' }], ['*', '6'],
    ['pecko', '7', { p: 'sad' }], ['*', '8'], ['>', '9'], ['gvozdin', '10', { p: 'tired' }],
    { if: 'flag:told_zajko_shadow', then: 'told' }, ['>', '11'], ['>', '12'], { goto: 'end' },
    { label: 'told' }, ['>', '13'],
    { label: 'end' }, ['>', '14'], ['>', '15']]);
  D('c2_funeral', [['*', '1'], ['sava', '2'], ['sava', '3'], ['>', '4'], ['>', '5'], ['*', '6'], ['>', '7']]);
  D('c2_observe_pecko', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5']]);
  D('c2_rabbit', [['zlatko', '1', { p: 'sad' }], ['*', '2'], { item: 'zajko_toy' }, ['zlatko', '3', { p: 'sad' }], ['>', '4'], ['>', '5']]);
  D('c2_pecko_church', [['pecko', '1', { p: 'sad' }], ['>', '2']]);
  D('c2_gvozdin_church', [['gvozdin', '1', { p: 'tired' }]]);
  D('c2_zlatko_church', [['zlatko', '1', { p: 'sad' }]]);
  D('c2_jablan_church', [['jablan', '1', { p: 'tired' }]]);
  D('c2_herbs', [['jaglika', '1'], ['jaglika', '2'], ['pecko', '3', { p: 'sad' }], ['*', '4'], ['>', '5'],
    { choice: [['c1', 'run'], ['c2', 'watch']] },
    { label: 'run' }, ['dj', '6'], ['pecko', '7', { p: 'tired' }], ['*', '8'], ['>', '9'], ['>', '10'], { goto: 'e' },
    { label: 'watch' }, ['>', '11'], ['>', '12'],
    { label: 'e' }]);
  D('c2_herbs_after', [['>', '1']]);
  D('c2_sm_shoes', [['>', '1'], ['>', '2']]);
  D('c2_sm_tools', [['>', '1'], ['>', '2']]);
  D('c2_sm_beam', [['>', '1'], ['>', '2']]);
  D('c2_sm_choice', [['>', '1'],
    { label: 'q' }, { choice: [['c1', 'shoes', { once: true }], ['c2', 'tools', { once: true }], ['c3', 'beam']] },
    { label: 'shoes' }, ['>', '2'], { goto: 'q' },
    { label: 'tools' }, ['>', '3'], { goto: 'q' },
    { label: 'beam' }, ['*', '4'], ['>', '5'], ['gvozdin', '6', { p: 'angry' }], ['*', '7', { sfx: 'fire_burst' }], ['gvozdin', '8'], ['*', '9'], ['>', '10'], { clue: 'obs_smithy_needle' }, { set: 'sm_done' }]);
  D('c2_smithy_wait', [['gvozdin', '1', { p: 'tired', sfx: 'anvil' }], ['>', '2']]);
  D('c2_smithy_talk', [['gvozdin', '1', { p: 'tired', sfx: 'chop' }], ['gvozdin', '2'], ['*', '3', { sfx: 'anvil' }], ['>', '4'], ['*', '5', { sfx: 'anvil' }], ['*', '6'], ['>', '7'], ['*', '8', { sfx: 'metal', shake: true }], ['gvozdin', '9', { p: 'scared' }], ['dj', '10'], ['gvozdin', '11', { p: 'tired' }], ['gvozdin', '12', { p: 'sad' }], ['>', '13'], ['>', '14']]);
  D('c2_pecko_bakery', [['pecko', '1', { p: 'blank' }], ['>', '2'], ['pecko', '3', { p: 'tired' }], ['>', '4']]);
  D('c2_mama_a', [['*', '1'], ['pecko', '2', { p: 'blank' }], ['>', '3'], ['pecko', '4', { p: 'blank' }], ['>', '5'], ['>', '6'],
    { choice: [['c1', 'count'], ['c2', 'say']] },
    { label: 'count' }, ['dj', '7'], ['*', '8'], ['pecko', '9', { p: 'sad' }], ['>', '10'], { set: 'mama_remembered' }, { goto: 'e' },
    { label: 'say' }, ['dj', '11'], ['pecko', '12', { p: 'blank' }], ['>', '13'],
    { label: 'e' }]);
  D('c2_mama_b', [['gvozdin', '1', { p: 'tired' }], ['*', '2'], ['gvozdin', '3', { p: 'sad' }], ['dj', '4'], ['gvozdin', '5', { p: 'tired' }], ['>', '6'], ['>', '7']]);
  D('c2_morning', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c2_tata_news', [['gvozdin', '1', { p: 'sad' }], ['>', '2'], ['gvozdin', '3', { p: 'sad' }],
    { choice: [['c1', 'count'], ['c2', 'sit']] },
    { label: 'count' }, ['>', '4'], { goto: 'e' },
    { label: 'sit' }, ['*', '5'],
    { label: 'e' }, ['gvozdin', '6', { p: 'tired' }], { if: 'flag:mama_remembered', then: 'rem' }, ['>', '7'], { end: true },
    { label: 'rem' }, ['gvozdin', '8', { p: 'sad' }], ['>', '9']]);
  D('c2_sava_news', [['*', '1'], ['sava', '2', { p: 'sad' }], ['>', '3'], ['>', '4'], ['stana', '5', { p: 'sad' }], ['sava', '6'], ['sava', '7', { p: 'worried' }], ['>', '8'],
    { choice: [['c1', 'a'], ['c2', 'b']] }, { label: 'a' }, ['dj', '9'], ['sava', '10', { p: 'sad' }], { goto: 'e' }, { label: 'b' }, ['*', '11'],
    { label: 'e' }, ['stana', '12', { p: 'worried' }], ['>', '13'], ['>', '14'], ['>', '15'], ['sava', '16', { p: 'sad' }]]);
  D('c2_notebook', [['*', '1'], ['>', '2'], ['*', '3'], ['>', '4'], ['>', '5']]);
  D('c2_apron', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);
  D('c2_mirror', [['>', '1'], ['>', '2']]);
  D('c2_mirror_shadow', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('c2_house_end', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4']]);

  /* ---------- talk ---------- */
  add('pecko', [
    { beats: 'c1_start', dlg: 'c1_breakfast', then: 'c1_mill' }, { beats: 'c1_mill', dlg: 'c1_parents_again' },
    { beats: 'c1_note', dlg: 'c1_mama_news', then: 'c1_visit' },
    { beats: 'c1_visit..c1_storm', dlg: 'c1_pecko_bakery' },
    { beats: 'c2_funeral', dlg: 'c2_pecko_church' }, { beats: 'c2_smithy', dlg: 'c2_pecko_bakery' }
  ]);
  add('gvozdin', [
    { beats: 'c1_start', dlg: 'c1_breakfast', then: 'c1_mill' }, { beats: 'c1_mill', dlg: 'c1_parents_again' },
    { beats: 'c1_note', dlg: 'c1_mama_news', then: 'c1_visit' },
    { beats: 'c1_visit..c1_storm', dlg: 'c1_gvozdin' }, { beats: 'c2_funeral', dlg: 'c2_gvozdin_church' },
    { beats: 'c2_smithy', if: 'flag:sm_done', dlg: 'c2_smithy_talk', clue: ['obs_gvozdin_shadow', 'sk_gvozdin'], then: 'c2_mama' },
    { beats: 'c2_smithy', dlg: 'c2_smithy_wait' }
  ]);
  add('zlatko', [{ beats: 'c1_visit', if: '!clue:obs_zajko_changes', dlg: 'c1_zlatko' }, { beats: 'c1_visit..c1_storm', dlg: 'c1_zlatko_again' }, { beats: 'c2_funeral', dlg: 'c2_zlatko_church' }]);
  add('jablan', [{ beats: 'c1_visit..c1_storm', dlg: 'c1_jablan' }, { beats: 'c2_funeral', dlg: 'c2_jablan_church' }]);
  add('zajko', [
    { beats: 'c1_mill', dlg: 'c1_mill_talk', then: 'c1_note' },
    { beats: 'c1_visit', if: '!flag:talked_zajko', dlg: 'c1_zajko' }, { beats: 'c1_visit', dlg: 'c1_zajko_again' },
    { beats: 'c1_river', dlg: 'c1_river_talk', clue: 'obs_zajko_visions', then: 'c1_back' }
  ]);
  BTS.Data.globalProps = (BTS.Data.globalProps || []).concat([
    { beats: 'c2_funeral..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_zajko', scale: 1.1 },
    { beats: 'c2_alone..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_pecko', scale: 1.1 },
    { beats: 'c2_house..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_gvozdin', scale: 1.1 }
  ]);
})();
