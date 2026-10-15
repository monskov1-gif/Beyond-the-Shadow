/* PROLOGUE — the fair (June 28, Vidovdan). */
'use strict';
(function () {
  var D = BTS.D, T = BTS.Data.talk;
  var FAIR_EXTRAS = [
    { loc: 'village', sheet: 'dancer1', at: [82.6, 78.2], act: 'wander', radius: 1.6, lines: ['extra_fair_d'] },
    { loc: 'village', sheet: 'dancer2', at: [85.6, 78.6], act: 'wander', radius: 1.6, lines: ['extra_fair_d'] },
    { loc: 'village', sheet: 'dancer1', at: [84.2, 80.6], act: 'wander', radius: 1.4, lines: ['extra_fair_d'] },
    { loc: 'village', sheet: 'dancer2', at: [83.2, 75.4], act: 'wander', radius: 1.2, lines: ['extra_fair_d'] },
    { loc: 'village', sheet: 'vil_man1', at: [75, 73.8], act: 'idle', dir: 'up', lines: ['extra_fair_a', 'extra_fair_c'] },
    { loc: 'village', sheet: 'vil_woman1', at: [80.5, 72], act: 'idle', dir: 'up', lines: ['extra_fair_a', 'extra_fair_d'] },
    { loc: 'village', sheet: 'vil_man2', at: [93, 72.6], act: 'idle', dir: 'up', lines: ['extra_fair_b', 'extra_fair_c'] },
    { loc: 'village', sheet: 'vil_woman2', at: [99, 76], act: 'idle', dir: 'left', lines: ['extra_fair_c'] },
    { loc: 'village', sheet: 'vil_old', at: [96.5, 84.6], act: 'sit', dir: 'down', lines: ['extra_fair_a'] },
    { loc: 'village', sheet: 'vil_boy', at: [87.5, 80.5], act: 'wander', radius: 2.5, lines: ['extra_fair_b'] },
    { loc: 'village', sheet: 'vil_man2', at: [77.5, 84.5], act: 'wander', radius: 2, lines: ['extra_fair_b'] },
    { loc: 'village', sheet: 'vil_woman1', at: [70.5, 75], act: 'wander', radius: 2, lines: ['extra_fair_c'] }
  ];
  var STREET_EXTRAS = [
    { loc: 'village', sheet: 'vil_man1', at: [60, 49], act: 'wander', radius: 3, lines: ['extra_fair_a'] },
    { loc: 'village', sheet: 'vil_woman2', at: [66, 58], act: 'wander', radius: 2, lines: ['extra_fair_c'] }
  ];
  function crowdTick(dt, W) {   // sensory overload near the dancing crowd
    var p = W.player, c = W.spot('fair_dance'); if (!p || !c || W.locId !== 'village') return;
    var near = Math.hypot(p.x - c.x, p.z - c.z) < 5.5;
    var S = BTS.State;
    S.d.flags.overload = BTS.M.clamp((S.d.flags.overload || 0) + (near ? dt * 0.25 : -dt * 0.5), 0, 1);
    var k = S.d.flags.overload;
    BTS.Audio.setMuffle(k * 0.55); BTS.Env.horrorGoal = k * 0.35;
    if (k > 0.85 && !S.flag('overload_said')) { S.set('overload_said'); BTS.Cutscene.play(function (C) { return C.say('p_overload'); }, 'overload'); }
  }

  BTS.Story.define([
    { id: 'p_room', chapter: 'prologue', loc: 'djordje_house', spawn: 'desk', forceSpawn: true, chapterCard: 'chap.prologue', chapterSub: 'sub.prologue', day: 1,
      env: { time: 'evening', weather: 'clear', horror: 0 }, envInstant: true, obj: 'obj.p_room', music: 'explore',
      scene: function (C) {
        C.anim('player', 'sketch');
        return C.say('p_intro').then(function () { C.anim('player', null); });
      },
      interact: [{ loc: 'djordje_house', id: 'desk', at: [12.4, 1.6], label: 'it.desk', verb: 'verb.take', dlg: 'p_desk', item: ['sketchbook', 'pencil'], hint: true, then: 'p_window' }]
    },
    { id: 'p_window', chapter: 'prologue', obj: 'obj.p_window',
      interact: [{ loc: 'djordje_house', id: 'window', at: [13.6, 0.9], label: 'it.window', verb: 'verb.look', hint: true, run: function (C) {
        return C.say('p_window').then(function () { C.clue('obs_jag_zajko_gate'); });
      }, then: 'p_zajko' }]
    },
    { id: 'p_zajko', chapter: 'prologue', obj: null,
      scene: function (C) {
        C.sfx('door_knock', {});
        return C.wait(1.2).then(function () {
          C.sfx('door_open', {});
          C.spawn('zajko', 'door_in', { dir: 'up', noTalk: true });
          C.face('player', 'down');
          return C.walk('zajko', [12.6, 4.4], { run: true });
        }).then(function () { C.face('zajko', 'player'); return C.say('p_zajko'); })
          .then(function () { return C.walk('zajko', 'door_in', { run: true }); })
          .then(function () { C.sfx('door_close', {}); C.despawn('zajko'); });
      }, after: 'p_go_fair'
    },
    { id: 'p_go_fair', chapter: 'prologue', obj: 'obj.p_go_fair', extras: STREET_EXTRAS, music: 'village', musicByLoc: { djordje_house: 'explore' },
      triggers: [{ loc: 'village', box: [67, 65, 78, 71.5], run: function (C) {
        return C.say('p_arrive').then(function () { return C.walk('zajko', [88.2, 79.2], { run: true, noWait: true }); });
      }, then: 'p_fair' }],
      blockExit: { west: 'block_fair', south: 'block_fair' }
    },
    { id: 'p_fair', chapter: 'prologue', obj: 'obj.p_fair', extras: FAIR_EXTRAS, music: 'fair', musicByLoc: { djordje_house: 'explore', kafana: 'explore' },
      tick: crowdTick,
      triggers: [{ loc: 'village', id: 'conflict', box: [80, 72, 100, 88], cond: 'flag:talked_milka&flag:talked_pecko', run: function (C) {
        C.spawn('jaglika', [94.2, 70.6], { dir: 'left', noTalk: true });
        var g = C.ent('gorazd');
        return C.cam({ target: [91.5, 1, 71], time: 1.4 }).then(function () { return C.walk('jaglika', [92.6, 70.1], {}); })
          .then(function () { C.face('gorazd', 'jaglika'); return C.say('p_conflict'); })
          .then(function () { C.anim('jaglika', null); return C.walk('jaglika', [104, 80], { noWait: true }); })
          .then(function () { return C.wait(1.0); })
          .then(function () { C.clue('obs_gorazd_conflict'); C.flag('saw_conflict'); C.despawn('jaglika'); });
      } }],
      blockExit: { west: 'block_fair', south: 'block_fair' }
    },
    { id: 'p_game', chapter: 'prologue', obj: 'obj.p_game', extras: FAIR_EXTRAS, music: 'fair', tick: crowdTick,
      npcs: { zajko: { loc: 'village', at: [89.2, 80.6], act: 'idle', dir: 'left' }, mila: { loc: 'village', at: [92, 81], act: 'wander', radius: 1.5 }, luka: { loc: 'village', at: [89.5, 83.8], act: 'wander', radius: 1.5 } },
      shadows: { zajko: { stage: 1 } },
      scene: function (C) {
        C.place('player', 'game_watch', 'right');
        return C.cam({ target: [89.5, 0.5, 81.5], time: 1.6 }).then(function () { return C.say('p_game'); })
          .then(function () { C.clue('obs_hvatanje'); C.anim('zajko', 'fear'); return C.wait(0.6); })
          .then(function () { C.anim('zajko', null); return C.walk('zajko', [91.5, 80.2], { run: true }); })
          .then(function () { return C.walk('zajko', [89.4, 81.6], { run: true }); })
          .then(function () { C.face('zajko', 'down'); return C.say('p_game_after'); });
      },
      observe: { zajko: { run: function (C) { return C.say('p_observe_zajko'); }, clue: 'sk_zajko_1', then: 'p_night' } },
      blockExit: { west: 'block_fair', south: 'block_fair' }
    },
    { id: 'p_night', chapter: 'prologue', obj: 'obj.p_night', env: { time: 'night', weather: 'clear' }, music: 'village', musicByLoc: { djordje_house: 'explore' },
      hide: ['milka', 'sava', 'stana', 'tihomir', 'vesna', 'radoje', 'mila', 'luka', 'jessica'],
      npcs: { jaglika: { loc: 'village', at: [51, 49.6], act: 'idle', dir: 'right', noTalk: true }, zajko: { loc: 'village', at: [89.2, 80.6], act: 'idle', dir: 'up' }, gorazd: { loc: 'village', at: [91.5, 69.2], act: 'idle', dir: 'down' } },
      extras: [{ loc: 'village', sheet: 'vil_man1', at: [88, 83], act: 'idle', dir: 'up', lines: ['extra_fair_c'] }, { loc: 'village', sheet: 'dancer1', at: [84, 79], act: 'wander', radius: 2 }],
      triggers: [
        { loc: 'village', id: 'well', box: [46, 50, 66, 60], run: function (C) {
          var j = C.ent('jaglika');
          return C.cam({ target: [52, 1, 50], time: 1.4 }).then(function () { C.face('jaglika', 'player'); return C.say('p_well'); })
            .then(function () { return C.walk('jaglika', [36, 47.5], { noWait: true }); })
            .then(function () { return C.wait(2.2); })
            .then(function () { C.despawn('jaglika'); });
        } },
        { loc: 'djordje_house', id: 'bed', box: [-1, -1, 19, 10], run: function (C) {
          return C.walk('player', 'bed', {}).then(function () { C.anim('player', 'sit'); return C.say('p_bed'); })
            .then(function () { return C.fade(1, 0.6); });
        }, then: 'c1_start' }
      ],
      blockExit: { west: 'block_home', south: 'block_home', kafana: 'block_home' }
    }
  ]);

  /* ---------- dialogues ---------- */
  D('p_intro', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5'], ['>', '6']]);
  D('p_desk', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('p_window', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5']]);
  D('p_zajko', [
    ['zajko', '1', { p: 'smile' }], ['zajko', '2'], ['>', '3'], ['zajko', '4', { p: 'smile' }],
    { choice: [['c1', 'yes'], ['c2', 'quiet'], ['c3', 'shadow']] },
    { label: 'yes' }, ['dj', '5'], ['zajko', '6', { p: 'smile' }], { goto: 'end' },
    { label: 'quiet' }, ['*', '7'], ['zajko', '8'], { goto: 'end' },
    { label: 'shadow' }, ['dj', '9'], ['zajko', '10'], ['zajko', '11', { p: 'smile' }], ['>', '12'],
    { label: 'end' }, ['zajko', '13', { p: 'smile' }], ['>', '14']
  ]);
  D('p_arrive', [['zajko', '1', { p: 'smile' }], ['>', '2'], ['zajko', '3']]);
  D('p_overload', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('p_milka', [['milka', '1'], ['milka', '2', { p: 'worried' }], ['>', '3'], ['milka', '4'], ['milka', '5', { p: 'worried' }],
    { choice: [['c1', 'why'], ['c2', null]] }, { label: 'why' }, ['dj', '6'], ['milka', '7', { p: 'sad' }], ['milka', '8'], { clue: 'obs_milka_warning' }, { set: 'talked_milka' }, { end: true }]);
  D('p_milka_again', [['milka', '1']]);
  D('p_pecko', [['pecko', '1', { p: 'smile' }], ['pecko', '2'], ['>', '3'], ['pecko', '4', { p: 'smile' }], { item: 'bread' }, ['pecko', '5'], { set: 'talked_pecko' }]);
  D('p_pecko_again', [['pecko', '1', { p: 'smile' }]]);
  D('p_gvozdin', [['gvozdin', '1', { p: 'smile' }], ['gvozdin', '2'], ['>', '3'], ['gvozdin', '4']]);
  D('p_jessica', [['jessica', '1', { p: 'smile' }], ['jessica', '2'], { choice: [['c1', 'a'], ['c2', 'b']] }, { label: 'a' }, ['dj', '3'], ['jessica', '4', { p: 'smile' }], { goto: 'e' }, { label: 'b' }, ['*', '5'], ['jessica', '6'], { label: 'e' }, ['jessica', '7']]);
  D('p_gorazd', [['gorazd', '1', { p: 'angry' }], ['gorazd', '2'], ['>', '3']]);
  D('p_conflict', [['gorazd', '1', { p: 'angry' }], ['jaglika', '2'], ['gorazd', '3', { p: 'angry', anim: 'point' }], ['*', '4'], ['*', '5'], ['>', '6'], ['>', '7']]);
  D('p_sava', [['sava', '1', { p: 'smile' }], ['sava', '2'], ['>', '3']]);
  D('p_dragan', [['dragan', '1', { p: 'smile' }], ['dragan', '2']]);
  D('p_stana', [['stana', '1', { p: 'smile' }], ['stana', '2']]);
  D('p_tihomir', [['tihomir', '1'], ['tihomir', '2'], ['>', '3']]);
  D('p_vesna', [['vesna', '1', { p: 'smile' }], ['>', '2']]);
  D('p_radoje', [['radoje', '1'], ['radoje', '2']]);
  D('p_mila', [['mila', '1', { p: 'smile' }], ['*', '2'], { item: 'wreath' }, ['mila', '3', { p: 'smile' }], ['>', '4']]);
  D('p_luka', [['luka', '1', { p: 'smile' }], ['luka', '2']]);
  D('p_zajko_wait', [['zajko', '1', { p: 'smile' }], ['>', '2']]);
  D('p_zajko_ready', [['zajko', '1', { p: 'smile' }]], 0);
  D('p_game', [
    ['*', '1'], ['zajko', '2', { p: 'smile' }], ['zajko', '3'], ['>', '4'], ['zajko', '5', { p: 'smile' }],
    { choice: [['c1', 'try'], ['c2', 'no']] },
    { label: 'try' }, ['*', '6'], ['>', '7'], ['>', '8', { do: { anim: ['djordje', 'cower'] } }], ['*', '9'], ['zajko', '10', { p: 'worried' }], ['dj', '11'], ['zajko', '12'], { set: 'tried_game' }, { goto: 'go' },
    { label: 'no' }, ['dj', '13'], ['zajko', '14', { p: 'smile' }],
    { label: 'go' }, ['milka', '15'], ['>', '16'], ['zajko', '17', { p: 'smile' }]
  ]);
  D('p_game_after', [['zajko', '1', { p: 'smile' }], ['>', '2'], ['>', '3']]);
  D('p_observe_zajko', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['zajko', '5', { p: 'smile' }], ['dj', '6'], ['zajko', '7'], ['>', '8']]);
  D('p_zajko_night', [['zajko', '1'], ['>', '2']]);
  D('p_well', [['*', '1'], ['>', '2'], ['*', '3'], ['>', '4'], ['>', '5']]);
  D('p_bed', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5']]);

  /* ---------- talk tables (first match wins) ---------- */
  function add(id, arr) { T[id] = (T[id] || []).concat(arr); }
  add('milka', [{ beats: 'p_fair..p_game', if: '!flag:talked_milka', dlg: 'p_milka' }, { beats: 'p_fair..p_night', dlg: 'p_milka_again' }]);
  add('pecko', [{ beats: 'p_fair..p_game', if: '!flag:talked_pecko', dlg: 'p_pecko' }, { beats: 'p_fair..p_night', dlg: 'p_pecko_again' }]);
  add('gvozdin', [{ beats: 'p_go_fair..p_night', dlg: 'p_gvozdin' }]);
  add('jessica', [{ beats: 'p_go_fair..p_night', dlg: 'p_jessica' }]);
  add('gorazd', [{ beats: 'p_go_fair..p_night', dlg: 'p_gorazd' }]);
  add('sava', [{ beats: 'p_go_fair..p_night', dlg: 'p_sava' }]);
  add('dragan', [{ beats: 'p_go_fair..p_night', dlg: 'p_dragan' }]);
  add('stana', [{ beats: 'p_go_fair..p_night', dlg: 'p_stana' }]);
  add('tihomir', [{ beats: 'p_go_fair..p_night', dlg: 'p_tihomir' }]);
  add('vesna', [{ beats: 'p_go_fair..p_night', dlg: 'p_vesna' }]);
  add('radoje', [{ beats: 'p_go_fair..p_night', dlg: 'p_radoje' }]);
  add('mila', [{ beats: 'p_go_fair..p_night', if: '!item:wreath', dlg: 'p_mila' }]);
  add('luka', [{ beats: 'p_go_fair..p_night', dlg: 'p_luka' }]);
  add('zajko', [
    { beats: 'p_fair', if: 'flag:saw_conflict', dlg: 'p_zajko_ready', then: 'p_game' },
    { beats: 'p_fair', dlg: 'p_zajko_wait' },
    { beats: 'p_night', dlg: 'p_zajko_night' }
  ]);
})();
