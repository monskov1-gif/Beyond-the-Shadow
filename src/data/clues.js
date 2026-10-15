/* Items, clues (observations / facts / hypotheses / sketches), deductions, pattern-board marks. */
'use strict';
(function () {
  var D = BTS.Data;
  function item(id, icon, use) { D.items[id] = { name: 'item.' + id + '.name', desc: 'item.' + id + '.desc', icon: icon, use: use ? 'item.' + id + '.use' : null }; }
  item('sketchbook', 'sketchbook', true); item('pencil', 'pencil'); item('bread', 'bread'); item('wreath', 'wreath');
  item('amulet_zajko', 'amulet', true); item('zajko_toy', 'toy', true); item('amulet_gorazd', 'amulet', true); item('jessica_photo', 'photo', true);
  item('vial', 'vial', true); item('jaglika_list', 'letter', true); item('grandma_cloth', 'cloth'); item('ritual_needle', 'needle', true);
  item('lantern', 'lantern', true); item('matches', 'candle'); item('pecko_note', 'letter');

  function clue(id, cat, date, sketch) { D.clues[id] = { cat: cat, title: 'clue.' + id + '.t', text: 'clue.' + id + '.d', date: date, sketch: sketch }; }
  // observations
  clue('obs_milka_warning', 'obs', 'jun28');
  clue('obs_jag_zajko_gate', 'obs', 'jun28', { type: 'house', name: 'sk.h_zajko', figure: true, date: 'jun28', note: 'sk.n_gate', cross: 'clue:fact_zajko_death' });
  clue('obs_gorazd_conflict', 'obs', 'jun28');
  clue('obs_hvatanje', 'obs', 'jun28');
  clue('obs_zajko_changes', 'obs', 'jul09');
  clue('obs_amulet_zajko', 'obs', 'jul09', { type: 'object', obj: 'needle', name: 'sk.o_amulet', note: 'sk.n_amulet' });
  clue('obs_zajko_visions', 'obs', 'jul09');
  clue('obs_storm_gate', 'obs', 'jul09');
  clue('obs_jag_herbs_pecko', 'obs', 'jul30');
  clue('obs_gvozdin_shadow', 'obs', 'aug01');
  clue('obs_jag_smithy', 'obs', 'jul27', { type: 'house', name: 'sk.h_smithy', figure: true, date: 'jul27', note: 'sk.n_smithy', cross: 'clue:fact_gvozdin_death' });
  clue('obs_jag_gorazd', 'obs', 'aug12', { type: 'house', name: 'sk.h_gorazd', figure: true, date: 'aug12', note: 'sk.n_gorazd', cross: 'clue:fact_gorazd_death' });
  clue('obs_jag_jessica', 'obs', 'aug15', { type: 'house', name: 'sk.h_guest', figure: true, date: 'aug15', note: 'sk.n_guest', cross: 'clue:fact_jessica_death' });
  clue('obs_nobody_believes', 'obs', 'sep04');
  clue('obs_gorazd_letter', 'obs', 'sep08'); clue('obs_gorazd_mirror', 'obs', 'sep08');
  clue('obs_jessica_photos', 'obs', 'sep08', { type: 'object', obj: 'photo', name: 'sk.o_photo', note: 'sk.n_photo' });
  clue('obs_jessica_diary', 'obs', 'sep08');
  clue('obs_jag_tihomir', 'obs', 'sep20', { type: 'house', name: 'sk.h_tihomir', figure: true, needle: true, date: 'sep20', note: 'sk.n_tihomir', cross: 'clue:fact_tihomir_death' });
  clue('obs_herbs', 'obs', 'sep21');
  clue('obs_grandma_named', 'obs', 'sep21');
  // sketches of shadows (category 'sketch')
  clue('sk_zajko_1', 'sketch', 'jun28', { type: 'shadow', stage: 1, name: 'name.zajko', date: 'jun28', note: 'sk.n_lag' });
  clue('sk_zajko_2', 'sketch', 'jul09', { type: 'shadow', stage: 2, name: 'name.zajko', date: 'jul09', note: 'sk.n_turn' });
  clue('sk_pecko', 'sketch', 'jul30', { type: 'shadow', stage: 1, name: 'name.pecko', date: 'jul30', note: 'sk.n_lag' });
  clue('sk_gvozdin', 'sketch', 'aug01', { type: 'shadow', stage: 2, name: 'name.gvozdin', date: 'aug01', note: 'sk.n_raise' });
  clue('sk_gorazd', 'sketch', 'sep08', { type: 'shadow', stage: 2, name: 'name.gorazd', date: 'sep08', note: 'sk.n_turn' });
  clue('sk_jessica', 'sketch', 'sep08', { type: 'shadow', stage: 3, name: 'name.jessica', date: 'sep08', note: 'sk.n_detach' });
  clue('sk_jaglika', 'sketch', 'sep20', { type: 'shadow', stage: 2, hunched: true, name: 'name.jaglika', date: 'sep20', note: 'sk.n_jag', beast: false });
  clue('sk_jaglika_beast', 'sketch', 'sep26', { type: 'shadow', stage: 0, hunched: true, beast: true, name: 'name.jaglika', date: 'sep26', note: 'sk.n_beast' });
  // facts
  clue('fact_zajko_death', 'fact', 'jul29'); clue('fact_pecko_death', 'fact', 'aug27'); clue('fact_gvozdin_death', 'fact', 'aug30');
  clue('fact_jag_visited_pecko', 'fact', 'jul30'); clue('fact_graves', 'fact', 'sep01');
  clue('fact_gorazd_death', 'fact', 'sep11'); clue('fact_jessica_death', 'fact', 'sep15'); clue('fact_guestbook', 'fact', 'sep17');
  clue('fact_medicines', 'fact', 'sep21', { type: 'object', obj: 'vial', name: 'sk.o_vial', note: 'sk.n_vial' });
  clue('fact_needles', 'fact', 'sep21'); clue('fact_list', 'fact', 'sep21'); clue('fact_legend', 'fact', 'sep21'); clue('fact_tihomir_death', 'fact', 'sep26');
  // hypotheses
  ['hyp_month_zajko', 'hyp_month_gvozdin', 'hyp_pattern', 'hyp_gorazd_next', 'hyp_jessica_next', 'hyp_needles', 'hyp_stages', 'hyp_tihomir_next', 'hyp_poison', 'hyp_needle_rule', 'hyp_djordje_next'].forEach(function (h) { clue(h, 'hyp'); });

  D.deductions = [
    { a: 'obs_jag_zajko_gate', b: 'fact_zajko_death', result: 'hyp_month_zajko', thought: 'ded.month_zajko' },
    { a: 'obs_jag_smithy', b: 'fact_gvozdin_death', result: 'hyp_month_gvozdin', thought: 'ded.month_gvozdin' },
    { a: 'hyp_month_zajko', b: 'hyp_month_gvozdin', result: 'hyp_pattern', flag: 'pattern_board', thought: 'ded.pattern' },
    { a: 'hyp_pattern', b: 'obs_jag_gorazd', result: 'hyp_gorazd_next', thought: 'ded.gorazd' },
    { a: 'hyp_pattern', b: 'obs_jag_jessica', result: 'hyp_jessica_next', thought: 'ded.jessica' },
    { a: 'obs_amulet_zajko', b: 'obs_gorazd_letter', result: 'hyp_needles', thought: 'ded.needles', cond: 'item:amulet_gorazd' },
    { a: 'sk_zajko_2', b: 'sk_gorazd', result: 'hyp_stages', thought: 'ded.stages' },
    { a: 'fact_medicines', b: 'fact_zajko_death', result: 'hyp_poison', thought: 'ded.poison' },
    { a: 'fact_list', b: 'hyp_pattern', result: 'hyp_djordje_next', thought: 'ded.djordje' }
  ];
  // marks drawn on the pattern board (village coordinates)
  D.patternMarks = [
    { kind: 'sight', x: 30.6, z: 44, date: 'jun28', cond: 'clue:obs_jag_zajko_gate' },
    { kind: 'death', x: 32, z: 38.5, date: 'jul29', cond: 'clue:fact_zajko_death' },
    { kind: 'sight', x: 41, z: 42, date: 'jul27', cond: 'clue:obs_jag_smithy' },
    { kind: 'sight', x: 35, z: 43.5, date: 'jul30', cond: 'clue:fact_jag_visited_pecko' },
    { kind: 'death', x: 33.5, z: 37, date: 'aug27', cond: 'clue:fact_pecko_death' },
    { kind: 'death', x: 40.8, z: 39.5, date: 'aug30', cond: 'clue:fact_gvozdin_death' },
    { kind: 'sight', x: 91, z: 62, date: 'aug12', cond: 'clue:obs_jag_gorazd' },
    { kind: 'death', x: 91.5, z: 56.5, date: 'sep11', cond: 'clue:fact_gorazd_death' },
    { kind: 'sight', x: 64, z: 41, date: 'aug15', cond: 'clue:obs_jag_jessica' },
    { kind: 'death', x: 64, z: 37, date: 'sep15', cond: 'clue:fact_jessica_death' },
    { kind: 'sight', x: 75, z: 42.5, date: 'sep20', cond: 'clue:obs_jag_tihomir' },
    { kind: 'death', x: 76.5, z: 39.5, date: 'sep26', cond: 'clue:fact_tihomir_death' },
    { kind: 'sight', x: 55, z: 16, date: 'sep21', cond: 'clue:fact_list' }
  ];
})();
