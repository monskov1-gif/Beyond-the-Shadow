/* Shared dialogues: examinables, locked doors, observation results, villagers. */
'use strict';
(function () {
  var D = BTS.D;
  function thoughts(id, n) { var s = []; for (var i = 1; i <= n; i++) s.push(['>', String(i)]); D(id, s); }
  function acts(id, n) { var s = []; for (var i = 1; i <= n; i++) s.push(['*', String(i)]); D(id, s); }
  // village examinables
  thoughts('x_well', 2); thoughts('x_pole', 2); thoughts('x_pole_late', 2); thoughts('x_view', 3); thoughts('x_beehive', 2); thoughts('x_plaque', 2); thoughts('x_graves', 2);
  thoughts('x_anvil', 1); thoughts('x_oven', 1); thoughts('x_cart', 1); thoughts('x_scarecrow', 2); thoughts('x_jag_herbs', 2); thoughts('x_sheep', 1); thoughts('x_easel', 2);
  thoughts('x_axe', 1); thoughts('x_bridge', 2); thoughts('x_bell', 2);
  // interiors
  thoughts('x_dj_icon', 2); thoughts('x_dj_photo', 3); thoughts('x_dj_stove', 1); thoughts('x_dj_drawings', 2); thoughts('x_dj_shelf', 2); thoughts('x_dj_cupboard', 1); thoughts('x_dj_rabbit', 2);
  thoughts('x_zh_icon', 1); thoughts('x_zh_kite', 2); thoughts('x_zh_shelf', 1); thoughts('x_zh_anvil', 1); thoughts('x_gh_stove', 1); thoughts('x_gu_notes', 2);
  thoughts('x_ch_icons', 2); thoughts('x_ch_candles', 2); thoughts('x_ch_window', 1); thoughts('x_kf_tv', 1); thoughts('x_kf_photo', 2);
  // outskirts
  thoughts('x_os_cross', 2); thoughts('x_os_view', 3); thoughts('x_os_mill', 2); thoughts('x_os_scarecrow', 1); thoughts('x_os_river', 2);
  // locked / blocked
  thoughts('locked_generic', 1); thoughts('locked_zajko', 1); thoughts('locked_kafana', 1); thoughts('locked_guest', 1); thoughts('locked_church', 1); thoughts('locked_gorazd', 1);
  thoughts('locked_tihomir', 1); thoughts('locked_jaglika', 1); thoughts('locked_outskirts', 1);
  thoughts('block_fair', 1); thoughts('block_home', 1); thoughts('block_night', 1); thoughts('block_lisa', 1);
  // observation
  thoughts('obs_normal', 1); thoughts('obs_odd', 1); thoughts('obs_beast', 1); thoughts('obs_none', 1);
  // villagers (extras) — rotating remarks by mood
  D('extra_a', [['villager', '1']]); D('extra_b', [['villager', '1']]); D('extra_c', [['villager', '1']]);
  D('extra_fair_a', [['villager', '1']]); D('extra_fair_b', [['villager', '1']]); D('extra_fair_c', [['villager', '1'], ['>', '2']]); D('extra_fair_d', [['villager', '1']]);
  D('extra_fear_a', [['villager', '1']]); D('extra_fear_b', [['villager', '1']]); D('extra_fear_c', [['villager', '1']]);
  D('talk_generic', [['>', '1']]);
  D('talk_busy', [['>', '1']]);
})();
