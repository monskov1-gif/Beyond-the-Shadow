/* PROLOGUE — the fair (June 28, Vidovdan). Đorđe lives on the hill with Mama (Pečko, the baker) and Tata (Gvozdin, the smith). */
'use strict';
(function () {
  var D = BTS.D, T = BTS.Data.talk, U = BTS.StoryUtil, S = BTS.State;
  var FAIR_EXTRAS = [
    { loc: 'village', sheet: 'dancer1', at: [82.6, 78.2], act: 'wander', radius: 1.6, lines: ['extra_fair_d'] },
    { loc: 'village', sheet: 'dancer2', at: [85.6, 78.6], act: 'wander', radius: 1.6, lines: ['extra_fair_d'] },
    { loc: 'village', sheet: 'dancer1', at: [84.2, 80.6], act: 'wander', radius: 1.4, lines: ['extra_fair_d'] },
    { loc: 'village', sheet: 'dancer2', at: [83.2, 75.4], act: 'wander', radius: 1.2, lines: ['extra_fair_d'] },
    { loc: 'village', sheet: 'vil_man1', at: [75, 73.8], act: 'idle', dir: 'up', lines: ['extra_fair_a', 'extra_fair_c'] },
    { loc: 'village', sheet: 'vil_woman1', at: [80.5, 74.2], act: 'idle', dir: 'up', lines: ['extra_fair_a', 'extra_fair_d'] },
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
  var STRAY_DOG = { loc: 'village', sprite: 'dog_lie', at: [86.6, 80.6] };     // the stray Zajko feeds
  var STALL_BOX = [77.0, 68.8, 83.4, 73.8];                                      // Mama's bread stall: the quiet place
  function inBox(p, b) { return p.x > b[0] && p.x < b[2] && p.z > b[1] && p.z < b[3]; }

  /* sensory overload near the dancing crowd (optional, while wandering the fair) */
  function crowdTick(dt, W) {
    var p = W.player, c = W.spot('fair_dance'); if (!p || !c || W.locId !== 'village') return;
    var near = Math.hypot(p.x - c.x, p.z - c.z) < 5.5;
    S.d.flags.overload = BTS.M.clamp((S.d.flags.overload || 0) + (near ? dt * 0.25 : -dt * 0.5), 0, 1);
    var k = S.d.flags.overload;
    BTS.Audio.setMuffle(k * 0.55); BTS.Env.horrorGoal = k * 0.35;
    if (k > 0.85 && !S.flag('overload_said')) { S.set('overload_said'); BTS.Cutscene.play(function (C) { return C.say('p_overload'); }, 'overload'); }
  }
  /* the crossing: from the middle of the fair to Mama's stall. Every body close by fills the meter faster;
     at the top Đorđe shuts down and Mama comes for him. Either way the scene continues at the stall. */
  function crossingTick(dt, W) {
    var p = W.player; if (!p || W.locId !== 'village' || S.done('p_crossed')) return;
    if (inBox(p, STALL_BOX)) { S.markDone('p_crossed'); S.set('reached_stall'); BTS.Story.goto('p_mama', true); return; }
    var crowd = 0;
    W.entities.forEach(function (e) { if (e === p || e.hidden || e.kind !== 'npc') return; var d = Math.hypot(e.x - p.x, e.z - p.z); if (d < 2.6) crowd += (2.6 - d) / 2.6; });
    var k = BTS.M.clamp((S.val('crossing') || 0) + dt * (0.045 + crowd * 0.32), 0, 1);
    S.d.flags.crossing = k;
    BTS.Audio.setMuffle(0.15 + k * 0.6); BTS.Env.horrorGoal = 0.08 + k * 0.42;
    if (k > 0.55 && !S.flag('crossing_half')) { S.set('crossing_half'); BTS.Cutscene.play(function (C) { return C.say('p_cross_half'); }, 'cross'); }
    if (k >= 1) {
      S.markDone('p_crossed');
      BTS.Cutscene.play(function (C) {
        C.anim('player', 'cower'); C.sfx('heartbeat', { vol: 0.8 });
        return C.say('p_cross_fail').then(function () {
          var m = C.ent('pecko'); if (m) { var q = U.nearPlayer(0.9, -0.6); return C.walk('pecko', q, { run: true }); }
        }).then(function () { C.face('pecko', 'player'); return C.say('p_cross_mama'); })
          .then(function () { return C.fade(1, 1.2); })
          .then(function () { C.anim('player', null); C.place('player', 'stall1', 'up'); C.place('pecko', [81.0, 71.4], 'left'); return C.fade(0, 1); });
      }, 'cross_fail').then(function () { BTS.Story.goto('p_mama', true); });
    }
  }
  function calm() { BTS.Audio.setMuffle(0); BTS.Env.horrorGoal = 0; S.d.flags.overload = 0; }

  BTS.Story.define([
    { id: 'p_room', chapter: 'prologue', loc: 'djordje_house', spawn: 'desk', forceSpawn: true, chapterCard: 'chap.prologue', chapterSub: 'sub.prologue', day: 1,
      env: { time: 'evening', weather: 'clear', horror: 0 }, envInstant: true, obj: 'obj.p_room', music: 'explore',
      scene: function (C) {
        C.anim('player', 'sketch');
        return C.say('p_intro').then(function () {
          C.anim('player', null); C.sfx('door_knock', {});
          return C.wait(0.5);
        }).then(function () { C.sfx('door_knock', {}); return C.wait(0.9); })
          .then(function () {
            C.spawn('gvozdin', U.spot('door_in', [3.5, 7.6]), { dir: 'up', noTalk: true });
            return C.walk('gvozdin', U.nearPlayer(-1.3, 1.5));
          })
          .then(function () { C.face('gvozdin', 'player'); C.face('player', 'gvozdin'); return C.say('p_tata'); })
          .then(function () { return C.walk('gvozdin', U.spot('door_in', [3.5, 7.6])); })
          .then(function () { C.sfx('door_close', {}); C.despawn('gvozdin'); return C.say('p_tata_after'); });
      },
      interact: [{ loc: 'djordje_house', id: 'desk', at: BTS.SpotAt('desk', [12.4, 2.4]), label: 'it.desk', verb: 'verb.take', dlg: 'p_desk', item: ['sketchbook', 'pencil'], hint: true, then: 'p_window' }]
    },
    { id: 'p_window', chapter: 'prologue', obj: 'obj.p_window',
      interact: [{ loc: 'djordje_house', id: 'window', at: BTS.SpotAt('window', [13.6, 1.4]), label: 'it.window', verb: 'verb.look', hint: true, run: function (C) {
        return C.say('p_window').then(function () { C.clue('obs_jag_zajko_gate'); });
      }, then: 'p_zajko' }]
    },
    { id: 'p_zajko', chapter: 'prologue', obj: null,
      scene: function (C) {
        C.sfx('door_knock', {});
        return C.wait(1.2).then(function () {
          C.sfx('door_open', {});
          C.spawn('zajko', U.spot('door_in', [3.5, 7.6]), { dir: 'up', noTalk: true });
          C.face('player', 'down');
          return C.walk('zajko', U.nearPlayer(-0.9, 1.6), { run: true });
        }).then(function () { C.face('zajko', 'player'); C.face('player', 'zajko'); return C.say('p_zajko'); })
          .then(function () { return C.walk('zajko', U.spot('door_in', [3.5, 7.6]), { run: true }); })
          .then(function () { C.sfx('door_close', {}); C.despawn('zajko'); });
      }, after: 'p_go_fair'
    },
    { id: 'p_go_fair', chapter: 'prologue', obj: 'obj.p_go_fair', ambience: { crowd: 0.4 }, extras: STREET_EXTRAS, music: 'village', musicByLoc: { djordje_house: 'explore' },
      triggers: [{ loc: 'village', box: [67, 65, 78, 71.5], run: function (C) {
        return C.say('p_arrive').then(function () {
          C.walk('zajko', [85.6, 76.6], { run: true, noWait: true });
          return C.walk('player', 'fair_center');
        }).then(function () { C.face('player', 'zajko'); return C.say('p_arrive2'); })
          .then(function () { C.walk('zajko', [88.2, 79.2], { run: true, noWait: true }); return C.wait(0.6); });
      }, then: 'p_crowd' }],
      blockExit: { west: 'block_fair', south: 'block_fair' }
    },
    /* interactive: get out of the crowd to Mama's stall before the noise swallows everything */
    { id: 'p_crowd', chapter: 'prologue', obj: 'obj.p_crowd', ambience: { crowd: 1, fire: 0.8, firePos: [90.5, 82] }, extras: FAIR_EXTRAS, music: 'fair', noSave: true,
      props: [STRAY_DOG],
      scene: function (C) { S.d.flags.crossing = 0; return C.say('p_cross_start'); },
      tick: crossingTick,
      blockExit: { west: 'block_fair', south: 'block_fair' }
    },
    { id: 'p_mama', chapter: 'prologue', obj: null, ambience: { crowd: 0.8, fire: 0.8, firePos: [90.5, 82] }, extras: FAIR_EXTRAS, music: 'fair', props: [STRAY_DOG],
      scene: function (C) {
        calm();
        C.face('pecko', 'player'); C.face('player', 'pecko');
        return C.say('p_mama').then(function () { C.anim('player', null); });
      }, after: 'p_fair'
    },
    { id: 'p_fair', chapter: 'prologue', obj: 'obj.p_fair', ambience: { crowd: 1, fire: 0.8, firePos: [90.5, 82] }, extras: FAIR_EXTRAS, music: 'fair', musicByLoc: { djordje_house: 'explore', kafana: 'explore' },
      props: [STRAY_DOG],
      tick: crowdTick,
      triggers: [{ loc: 'village', id: 'conflict', box: [80, 72, 100, 88], cond: 'flag:talked_milka&flag:talked_pecko', run: function (C) {
        /* staged in the open in front of Gorazd's red stall (not behind the table/awning), under a lantern */
        var G = [90.6, 72.5], J = [92.7, 72.9];
        var lamp = C.keyLight(91.6, 72.8, { radius: 6, intensity: 1.25, dz: 1.6 });
        C.spawn('jaglika', [99.8, 76.6], { dir: 'left', noTalk: true });
        C.walk('gorazd', G, { noWait: true });
        return C.frame([[91.6, 72.7]], { dist: 13, time: 1.4 }).then(function () { return C.walk('jaglika', J); })
          .then(function () { C.face('jaglika', 'up'); return C.wait(0.6); })    // she looks over his goods
          .then(function () { C.face('gorazd', 'jaglika'); C.face('jaglika', 'gorazd'); return C.say('p_conflict', { at: {
            1: function () { C.anim('gorazd', 'point'); C.face('gorazd', 'jaglika'); },
            2: function () { C.anim('gorazd', null); },
            3: function () { C.anim('gorazd', 'point'); },
            4: function () {   // the shove: he lunges, she is pushed back one step and keeps her feet
              C.anim('gorazd', 'interact'); C.step('gorazd', 0.6, 0.1, { speed: 2.4 }); C.sfx('cloth', {}); C.shake(0.35);
              var j = C.ent('jaglika'); if (j) { var sx = j.x, sz = j.z; C.tween(0.35, function (k) { j.x = sx + 0.75 * k; j.z = sz + 0.15 * k; }); }
            },
            5: function () {   // a long look at him, then over the crowd at Đorđe: the camera goes in on her face
              C.anim('gorazd', null); C.face('jaglika', 'gorazd');
              C.wait(1.4).then(function () { C.face('jaglika', 'player'); C.face('player', 'jaglika'); C.frame(['jaglika'], { dist: 9, time: 1.6 }); });
            },
            7: function () { var j = C.ent('jaglika'); if (j) C.frame([[j.x, j.z], [j.x - 1.2, j.z + 2.4]], { dist: 11, time: 1.2 }); }
          } }); })
          .then(function () { C.anim('jaglika', null); C.anim('gorazd', null); C.unlight(lamp); return C.walk('jaglika', [104, 80], { noWait: true }); })
          .then(function () { return C.wait(1.6); })
          .then(function () { C.clue('obs_gorazd_conflict'); C.flag('saw_conflict'); C.despawn('jaglika'); C.walk('gorazd', [91.5, 69.2], { noWait: true, dir: 'down' }); });
      } }],
      blockExit: { west: 'block_fair', south: 'block_fair' }
    },
    { id: 'p_game', chapter: 'prologue', obj: 'obj.p_game', ambience: { crowd: 1, fire: 1, firePos: [90.5, 82] }, extras: FAIR_EXTRAS, music: 'fair', tick: crowdTick,
      props: [STRAY_DOG],
      npcs: { zajko: { loc: 'village', at: [89.2, 80.6], act: 'idle', dir: 'left' }, mila: { loc: 'village', at: [92, 81], act: 'wander', radius: 1.5 }, luka: { loc: 'village', at: [89.5, 83.8], act: 'idle', dir: 'up' } },
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
      hide: ['milka', 'sava', 'stana', 'tihomir', 'vesna', 'radoje', 'mila', 'luka'],
      npcs: { jaglika: { loc: 'village', at: [51, 49.6], act: 'idle', dir: 'right', noTalk: true }, zajko: { loc: 'village', at: [89.2, 80.6], act: 'idle', dir: 'up' }, gorazd: { loc: 'village', at: [91.5, 69.2], act: 'idle', dir: 'down' },
        pecko: { loc: 'village', at: [81.0, 71.4], act: 'work', dir: 'left' }, gvozdin: { loc: 'village', at: [82.4, 72.4], act: 'idle', dir: 'left' } },
      props: [STRAY_DOG],
      extras: [{ loc: 'village', sheet: 'vil_man1', at: [88, 83], act: 'idle', dir: 'up', lines: ['extra_fair_c'] }, { loc: 'village', sheet: 'dancer1', at: [84, 79], act: 'wander', radius: 2 }],
      triggers: [
        { loc: 'village', id: 'well', box: [46, 50, 66, 60], run: function (C) {
          return C.cam({ target: [52, 1, 50], time: 1.4 }).then(function () { C.face('jaglika', 'player'); return C.say('p_well'); })
            .then(function () { return C.walk('jaglika', [36, 47.5], { noWait: true }); })
            .then(function () { return C.wait(2.2); })
            .then(function () { C.despawn('jaglika'); });
        } },
        { loc: 'djordje_house', id: 'bed', box: [-30, -10, 40, 30], run: function (C) {
          return C.walk('player', 'bed', {}).then(function () { C.anim('player', 'sit'); return C.say('p_bed'); })
            .then(function () { return C.fade(1, 0.6); });
        }, then: 'c1_start' }
      ],
      blockExit: { west: 'block_home', south: 'block_home', kafana: 'block_home' }
    }
  ]);

  /* ---------- dialogues ---------- */
  D('p_intro', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5'], ['>', '6']]);
  D('p_tata', [['>', '1'], ['gvozdin', '2', { p: 'smile' }], ['gvozdin', '3'], ['>', '4'], ['dj', '5'], ['gvozdin', '6', { p: 'smile' }], ['>', '7'],
    ['gvozdin', '8'], ['dj', '9'], ['*', '10'], ['gvozdin', '11', { p: 'smile' }]]);
  D('p_tata_after', [['>', '1'], ['>', '2']]);
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
  D('p_arrive', [['zajko', '1', { p: 'smile' }], ['>', '2']]);
  D('p_arrive2', [['zajko', '1', { p: 'smile' }], ['>', '2'], ['>', '3']]);
  D('p_cross_start', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('p_cross_half', [['>', '1'], ['>', '2']]);
  D('p_cross_fail', [['*', '1'], ['>', '2'], ['>', '3']]);
  D('p_cross_mama', [['pecko', '1', { p: 'worried' }], ['*', '2'], ['pecko', '3']]);
  D('p_mama', [
    { if: 'flag:reached_stall', then: 'made' }, ['>', '1'], { goto: 'sit' },
    { label: 'made' }, ['>', '2'], ['pecko', '3', { p: 'smile' }],
    { label: 'sit' }, ['pecko', '4'], ['*', '5', { do: { call: 'anim', args: 'sit' } }], ['pecko', '6', { p: 'smile' }], ['dj', '7'], ['pecko', '8'], ['dj', '9'], ['pecko', '10', { p: 'smile' }], ['>', '11'],
    ['pecko', '12'], ['dj', '13'],
    ['pecko', '14', { p: 'smile' }], { item: 'bread' }, ['>', '15'],
    ['pecko', '16'], ['dj', '17'], ['pecko', '18', { p: 'worried' }], ['>', '19'],
    ['pecko', '20', { p: 'smile' }], { set: 'talked_pecko' }
  ]);
  D('p_overload', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('p_milka', [['milka', '1', { p: 'smile' }], ['*', '2'], ['>', '3'], ['milka', '4', { p: 'worried' }], ['milka', '5'], ['milka', '6', { p: 'worried' }],
    { choice: [['c1', 'why'], ['c2', 'greet']] },
    { label: 'why' }, ['dj', '7'], ['milka', '8', { p: 'sad' }], { goto: 'e' },
    { label: 'greet' }, ['dj', '9'], ['*', '10'], ['milka', '11', { p: 'smile' }], ['>', '12'],
    { label: 'e' }, ['milka', '13'], { clue: 'obs_milka_warning' }, { set: 'talked_milka' }, { end: true }]);
  D('p_milka_again', [['milka', '1']]);
  D('p_pecko_again', [['pecko', '1', { p: 'smile' }], ['>', '2']]);
  D('p_gvozdin', [['gvozdin', '1', { p: 'smile' }], ['>', '2'], ['gvozdin', '3'], ['>', '4']]);
  D('p_gorazd', [['gorazd', '1', { p: 'angry' }], ['dj', '2'], ['gorazd', '3', { p: 'angry' }], ['>', '4']]);
  D('p_conflict', [['gorazd', '1', { p: 'angry' }], ['jaglika', '2'], ['gorazd', '3', { p: 'angry', anim: 'point' }], ['*', '4'], ['*', '5'], ['>', '6'], ['>', '7']]);
  D('p_sava', [['sava', '1', { p: 'smile' }], ['sava', '2'], ['>', '3']]);
  D('p_dragan', [['dragan', '1', { p: 'smile' }], ['dragan', '2'], ['>', '3']]);
  D('p_stana', [['stana', '1', { p: 'smile' }], ['stana', '2']]);
  D('p_tihomir', [['tihomir', '1'], ['tihomir', '2'], ['>', '3']]);
  D('p_vesna', [['vesna', '1', { p: 'smile' }], ['>', '2']]);
  D('p_radoje', [['radoje', '1'], ['dj', '2'], ['radoje', '3']]);
  D('p_mila', [['mila', '1', { p: 'smile' }], ['*', '2'], { item: 'wreath' }, ['mila', '3', { p: 'smile' }], ['>', '4']]);
  D('p_luka', [['luka', '1', { p: 'smile' }], ['luka', '2'], ['>', '3']]);
  D('p_zajko_wait', [['zajko', '1', { p: 'smile' }], ['zajko', '2'], ['>', '3']]);
  D('p_zajko_ready', [['zajko', '1', { p: 'smile' }]]);
  D('p_game', [
    ['*', '1', { sfx: 'laugh' }], ['zajko', '2', { p: 'smile' }], ['zajko', '3'], ['>', '4'], ['zajko', '5', { p: 'smile' }],
    { choice: [['c1', 'try'], ['c2', 'no']] },
    { label: 'try' }, ['*', '6'], ['>', '7'], ['>', '8', { do: { anim: ['djordje', 'cower'] } }], ['*', '9'], ['zajko', '10', { p: 'worried' }], ['dj', '11'], ['zajko', '12'], { set: 'tried_game' }, { goto: 'go' },
    { label: 'no' }, ['dj', '13'], ['zajko', '14', { p: 'smile' }],
    { label: 'go' }, ['luka', '18'], ['zajko', '19', { p: 'angry' }], ['*', '20'], ['>', '21'],
    ['milka', '15'], ['>', '16'], ['zajko', '17', { p: 'smile' }]
  ]);
  D('p_game_after', [['zajko', '1', { p: 'smile' }], ['>', '2'], ['>', '3']]);
  D('p_observe_zajko', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['zajko', '5', { p: 'smile' }], ['dj', '6'], ['zajko', '7'], ['>', '8']]);
  D('p_zajko_night', [['zajko', '1'], ['>', '2']]);
  D('p_mama_night', [['pecko', '1', { p: 'smile' }], ['gvozdin', '2', { p: 'smile' }], ['>', '3']]);
  D('p_well', [['*', '1'], ['>', '2'], ['*', '3'], ['>', '4'], ['>', '5']]);
  D('p_bed', [['>', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5'], ['>', '6']]);

  /* ---------- talk tables (first match wins) ---------- */
  function add(id, arr) { T[id] = (T[id] || []).concat(arr); }
  add('milka', [{ beats: 'p_fair..p_game', if: '!flag:talked_milka', dlg: 'p_milka' }, { beats: 'p_go_fair..p_night', dlg: 'p_milka_again' }]);
  add('pecko', [{ beats: 'p_night', dlg: 'p_mama_night' }, { beats: 'p_go_fair..p_game', dlg: 'p_pecko_again' }]);
  add('gvozdin', [{ beats: 'p_night', dlg: 'p_mama_night' }, { beats: 'p_go_fair..p_game', dlg: 'p_gvozdin' }]);
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
    { beats: 'p_crowd..p_fair', dlg: 'p_zajko_wait' },
    { beats: 'p_night', dlg: 'p_zajko_night' }
  ]);
})();
