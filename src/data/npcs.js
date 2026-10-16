/* NPC registry: sheet, speed, schedules (by beat range and time of day). The first matching
   entry wins; beats may override placements. Dead NPCs never return to schedules.
   Families: Pečko (mother, baker) and Gvozdin (father, smith) are Đorđe's parents and live with him
   in the house on the hill. Zlatko (mother) and Jablan (father) are Zajko's parents. */
'use strict';
(function () {
  /* Spot helpers shared with the story files. A spot that the current location does not define falls
     back to the given coordinates, so a re-laid-out interior never leaves an NPC or interactable without a place. */
  function spotOf(name) { var W = BTS.World; return W && W.loc && W.loc.spots ? W.loc.spots[name] : null; }
  /* array-like [x, z] read lazily (for static placement / interactable data) */
  BTS.SpotAt = function (name, fb) {
    var o = { spot: name };
    Object.defineProperty(o, '0', { get: function () { var s = spotOf(name); return s ? s.x : fb[0]; } });
    Object.defineProperty(o, '1', { get: function () { var s = spotOf(name); return s ? s.z : fb[1]; } });
    Object.defineProperty(o, 'length', { value: 2 });
    return o;
  };
  /* a real [x, z] array right now (for cutscene commands) */
  BTS.SpotNow = function (name, fb) { var s = spotOf(name); return s ? [s.x, s.z] : fb.slice(); };

  var N = BTS.Data.npcs, A = BTS.SpotAt;
  var FAIR = 'p_go_fair..p_game';
  var CALM = 'c1_start..c3_warn';        // before the village is gripped by fear
  var HOME = 'djordje_house';
  N.zajko = { sheet: 'zajko', speed: 2.2, schedule: [
    { beats: 'p_go_fair', loc: 'village', at: [72.5, 70.2], act: 'idle', dir: 'up' },
    { beats: 'p_crowd..p_fair', loc: 'village', at: [88.2, 79.2], act: 'wander', radius: 1.5 },
    { beats: 'c1_mill', loc: 'outskirts', at: [46.4, 47.2], act: 'idle', dir: 'left' },
    { beats: 'c1_visit', loc: 'zajko_house', at: 'zajko_bed', act: 'look' },
    { beats: 'c1_river', loc: 'outskirts', at: 'river_bank', act: 'idle', dir: 'down' }
  ] };
  /* Mama: bakes for the street at the village oven in the mornings */
  N.pecko = { sheet: 'pecko', schedule: [
    { beats: FAIR, loc: 'village', at: [81.0, 71.4], act: 'work', dir: 'left' },
    { beats: 'c1_start..c1_note', loc: HOME, at: A('kitchen', [5.6, 6.6]), act: 'work', dir: 'up' },
    { beats: 'c1_visit..c1_storm', time: ['morning', 'day'], loc: 'village', at: 'bakery', act: 'work', dir: 'left' },
    { beats: 'c1_visit..c1_storm', loc: HOME, at: A('kitchen', [5.6, 6.6]), act: 'work', dir: 'up' },
    { beats: 'c2_bell', loc: 'village', at: [35.4, 46.8], act: 'mourn', dir: 'up' },
    { beats: 'c2_smithy', loc: 'village', at: 'bakery', act: 'mourn', dir: 'left' }
  ] };
  /* Tata: the smith */
  N.gvozdin = { sheet: 'gvozdin', speed: 1.8, schedule: [
    { beats: FAIR, loc: 'village', at: [73, 70.8], act: 'idle', dir: 'down' },
    { beats: 'c1_start..c1_note', loc: HOME, at: A('table', [4.6, 5.2]), act: 'idle', dir: 'up' },
    { beats: 'c1_visit..c1_storm', time: ['morning', 'day'], loc: 'village', at: 'smithy', act: 'work', dir: 'up' },
    { beats: 'c1_visit..c1_storm', loc: HOME, at: A('table', [4.6, 5.2]), act: 'idle', dir: 'up' },
    { beats: 'c2_bell', loc: 'village', at: [37.0, 46.6], act: 'mourn', dir: 'up' }
  ] };
  /* Zajko's mother */
  N.zlatko = { sheet: 'zlatko', speed: 1.5, schedule: [
    { beats: 'c1_visit', loc: 'zajko_house', at: A('pecko_spot', [3.4, 2.5]), act: 'work', dir: 'down' },
    { beats: 'c1_river..c1_storm', time: ['morning', 'day'], loc: 'village', at: 'zajko_gate', act: 'look' },
    { beats: 'c2_bell', loc: 'village', at: [32.6, 45.6], act: 'mourn', dir: 'up' },
    { beats: 'c2_smithy..c9_prepare', time: ['morning', 'day'], loc: 'village', at: 'zajko_yard', act: 'mourn', dir: 'down' },
    { beats: 'e_dawn..e_leave', loc: 'village', at: [90.6, 32.4], act: 'mourn', dir: 'up' }
  ] };
  /* Zajko's father */
  N.jablan = { sheet: 'jablan', speed: 1.7, schedule: [
    { beats: 'c1_visit', loc: 'zajko_house', at: A('gvozdin_spot', [9.2, 4.9]), act: 'idle', dir: 'left' },
    { beats: 'c2_bell', loc: 'village', at: [31.0, 45.4], act: 'mourn', dir: 'up' },
    { beats: 'c2_smithy..c9_prepare', time: ['morning', 'day'], loc: 'village', at: 'zajko_gate', act: 'work', dir: 'up' },
    { beats: 'e_dawn..e_leave', loc: 'village', at: [93.4, 32.2], act: 'idle', dir: 'up' }
  ] };
  /* Baroness de Milka */
  N.milka = { sheet: 'milka', speed: 1.2, schedule: [
    { beats: FAIR, loc: 'village', at: [76.2, 79.6], act: 'sit', dir: 'down' },
    { beats: 'c2_bell', loc: 'village', at: [28.8, 46.0], act: 'mourn', dir: 'up' },
    { beats: 'c1_start..e_leave', time: ['morning', 'day'], loc: 'village', at: 'milka_bench', act: 'sit', dir: 'down' },
    { beats: 'c1_start..c3_warn', time: ['evening'], loc: 'village', at: [21, 44.5], act: 'idle', dir: 'down' }
  ] };
  N.sava = { sheet: 'sava', speed: 1.5, schedule: [
    { beats: FAIR, loc: 'village', at: [80.5, 85.0], act: 'idle', dir: 'up' },
    { beats: 'c1_start..c9_prepare', time: ['morning', 'day', 'evening'], loc: 'village', at: 'churchyard', act: 'wander', radius: 3 }
  ] };
  N.dragan = { sheet: 'dragan', schedule: [
    { beats: FAIR, loc: 'village', at: [98, 72.8], act: 'work', dir: 'down' },
    { beats: 'c1_start..c4_compare', time: ['morning', 'day'], loc: 'village', at: 'kafana_table', act: 'work', dir: 'down' },
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
    { beats: 'c1_start..c4_compare', time: ['morning', 'day'], loc: 'village', at: [95.8, 61.6], act: 'work', dir: 'up' },
    { beats: CALM, time: ['evening'], loc: 'kafana', at: 'table2', act: 'idle', dir: 'left' },
    { beats: 'c4_gorazd', loc: 'village', at: 'gorazd_yard', act: 'look' }
  ] };
  /* Jessica arrives on the September 3 bus, together with Lisa, and lodges upstairs at Stana's */
  N.jessica = { sheet: 'jessica', schedule: [
    { beats: 'c4_walk..c4_gorazd_in', time: ['morning', 'day'], loc: 'village', at: [67.5, 42.2], act: 'work', dir: 'up' },
    { beats: 'c4_walk..c4_gorazd_in', time: ['evening', 'night'], loc: 'guesthouse', at: A('jess_room', [11.6, 2.2]), act: 'work', dir: 'up' }
  ] };
  N.mila = { sheet: 'mila', speed: 2.4, schedule: [
    { beats: FAIR, loc: 'village', at: [89.5, 79], act: 'wander', radius: 2.5 },
    { beats: 'c1_start..c4_compare', time: ['morning', 'day'], loc: 'village', at: [53, 51], act: 'wander', radius: 3 }
  ] };
  N.luka = { sheet: 'luka', speed: 2.4, schedule: [
    { beats: FAIR, loc: 'village', at: [91, 80.5], act: 'wander', radius: 2.5 },
    { beats: 'c1_start..c4_compare', time: ['morning', 'day'], loc: 'village', at: [55, 52], act: 'wander', radius: 3 }
  ] };
  N.jaglika = { sheet: 'jaglika', speed: 1.3, schedule: [] };   // placed only by story beats
  N.lisa = { sheet: 'lisa', speed: 2.4, schedule: [] };
  N.baka = { sheet: 'baka', speed: 1.1, schedule: [] };
})();
