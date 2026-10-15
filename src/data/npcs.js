/* NPC registry: sheet, speed, schedules (by beat range and time of day). The first matching
   entry wins; beats may override placements. Dead NPCs never return to schedules. */
'use strict';
(function () {
  var N = BTS.Data.npcs;
  var FAIR = 'p_go_fair..p_game';
  var CALM = 'c1_start..c3_warn';        // before the village is gripped by fear
  var FEAR = 'c4_start..c9_prepare';
  N.zajko = { sheet: 'zajko', speed: 2.2, schedule: [
    { beats: 'p_go_fair', loc: 'village', at: [72.5, 70.2], act: 'idle', dir: 'up' },
    { beats: 'p_fair', loc: 'village', at: [88.2, 79.2], act: 'wander', radius: 1.5 },
    { beats: 'c1_visit', loc: 'zajko_house', at: 'zajko_bed', act: 'look' },
    { beats: 'c1_river', loc: 'outskirts', at: 'river_bank', act: 'idle', dir: 'down' }
  ] };
  N.pecko = { sheet: 'pecko', schedule: [
    { beats: FAIR, loc: 'village', at: [81.0, 71.4], act: 'work', dir: 'left' },
    { beats: 'c1_start..c1_storm', loc: 'zajko_house', at: 'pecko_spot', act: 'work', dir: 'down' },
    { beats: 'c2_bell', loc: 'village', at: [33, 45.5], act: 'mourn', dir: 'up' },
    { beats: 'c2_smithy', loc: 'village', at: 'bakery', act: 'mourn', dir: 'left' }
  ] };
  N.gvozdin = { sheet: 'gvozdin', speed: 1.8, schedule: [
    { beats: FAIR, loc: 'village', at: [73, 70.8], act: 'idle', dir: 'down' },
    { beats: 'c1_start..c1_storm', loc: 'village', at: 'smithy', act: 'work', dir: 'up' },
    { beats: 'c2_bell', loc: 'village', at: [31.5, 45.6], act: 'mourn', dir: 'up' }
  ] };
  N.milka = { sheet: 'milka', speed: 1.2, schedule: [
    { beats: FAIR, loc: 'village', at: [76.2, 79.6], act: 'sit', dir: 'down' },
    { beats: 'c2_bell', loc: 'village', at: [29.5, 45.8], act: 'mourn', dir: 'up' },
    { beats: 'c1_start..e_leave', time: ['morning', 'day'], loc: 'village', at: 'milka_bench', act: 'sit', dir: 'down' },
    { beats: 'c1_start..c3_warn', time: ['evening'], loc: 'village', at: [21, 44.5], act: 'idle', dir: 'down' }
  ] };
  N.sava = { sheet: 'sava', speed: 1.5, schedule: [
    { beats: FAIR, loc: 'village', at: [80.5, 85.0], act: 'idle', dir: 'up' },
    { beats: 'c1_start..c9_prepare', time: ['morning', 'day', 'evening'], loc: 'village', at: 'churchyard', act: 'wander', radius: 3 }
  ] };
  N.dragan = { sheet: 'dragan', schedule: [
    { beats: FAIR, loc: 'village', at: [98, 72.8], act: 'work', dir: 'down' },
    { beats: CALM, time: ['morning', 'day'], loc: 'village', at: 'kafana_table', act: 'work', dir: 'down' },
    { beats: 'c1_start..c9_prepare', loc: 'kafana', at: 'dragan_spot', act: 'work', dir: 'down' }
  ] };
  N.stana = { sheet: 'stana', schedule: [
    { beats: FAIR, loc: 'village', at: [95.6, 84.0], act: 'sit', dir: 'down' },
    { beats: CALM, time: ['morning', 'day'], loc: 'village', at: 'guest_bench', act: 'sit', dir: 'down' },
    { beats: 'c1_start..e_leave', loc: 'guesthouse', at: 'stana_spot', act: 'work', dir: 'down' }
  ] };
  N.tihomir = { sheet: 'tihomir', speed: 1.1, schedule: [
    { beats: FAIR, loc: 'village', at: [88, 86.2], act: 'idle', dir: 'up' },
    { beats: 'c1_start..c6_window', time: ['morning', 'day'], loc: 'village', at: [90.2, 25.6], act: 'work', dir: 'right' },
    { beats: 'c1_start..c6_window', time: ['evening'], loc: 'village', at: [77, 43.6], act: 'idle', dir: 'down' }
  ] };
  N.vesna = { sheet: 'vesna', schedule: [
    { beats: FAIR, loc: 'village', at: [84, 79.4], act: 'wander', radius: 2.4 },
    { beats: 'c1_start..c9_silence', time: ['morning', 'day'], loc: 'village', at: 'vesna_yard', act: 'work', dir: 'left' }
  ] };
  N.radoje = { sheet: 'radoje', schedule: [
    { beats: FAIR, loc: 'village', at: [100.5, 82], act: 'idle', dir: 'left' },
    { beats: 'c1_start..c9_silence', time: ['morning', 'day'], loc: 'village', at: 'radoje_pen', act: 'work', dir: 'left' }
  ] };
  N.gorazd = { sheet: 'gorazd', speed: 2.0, schedule: [
    { beats: FAIR, loc: 'village', at: [91.5, 69.2], act: 'idle', dir: 'down' },
    { beats: CALM, time: ['morning', 'day'], loc: 'village', at: [95.8, 61.6], act: 'work', dir: 'up' },
    { beats: CALM, time: ['evening'], loc: 'kafana', at: 'table2', act: 'idle', dir: 'left' },
    { beats: 'c4_start..c4_gorazd_dead', loc: 'village', at: 'gorazd_yard', act: 'look' }
  ] };
  N.jessica = { sheet: 'jessica', schedule: [
    { beats: FAIR, loc: 'village', at: [86, 73.5], act: 'wander', radius: 4 },
    { beats: 'c2_bell..c3_warn', time: ['morning', 'day'], loc: 'village', at: [67.5, 42.2], act: 'work', dir: 'up' },
    { beats: 'c2_bell..c3_warn', time: ['evening', 'night'], loc: 'guesthouse', at: 'jess_desk', act: 'work', dir: 'up' },
    { beats: 'c4_start..c4_jessica', loc: 'guesthouse', at: 'jess_bed', act: 'weak', dir: 'right' }
  ] };
  N.mila = { sheet: 'mila', speed: 2.4, schedule: [
    { beats: FAIR, loc: 'village', at: [89.5, 79], act: 'wander', radius: 2.5 },
    { beats: CALM, time: ['morning', 'day'], loc: 'village', at: [53, 51], act: 'wander', radius: 3 }
  ] };
  N.luka = { sheet: 'luka', speed: 2.4, schedule: [
    { beats: FAIR, loc: 'village', at: [91, 80.5], act: 'wander', radius: 2.5 },
    { beats: CALM, time: ['morning', 'day'], loc: 'village', at: [55, 52], act: 'wander', radius: 3 }
  ] };
  N.jaglika = { sheet: 'jaglika', speed: 1.3, schedule: [] };   // placed only by story beats
  N.lisa = { sheet: 'lisa', speed: 2.4, schedule: [] };
  N.baka = { sheet: 'baka', speed: 1.1, schedule: [] };
})();
