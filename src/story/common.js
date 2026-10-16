/* Shared story helpers and dialogues: examinables, locked doors, observation results, villagers. */
'use strict';
(function () {
  var D = BTS.D, S = BTS.State, T = BTS.Data.talk;
  /* Zajko's parents (sheets and portraits come from the art pass; identity is needed for dialogue speakers) */
  var P = BTS.Data.people;
  if (!P.zlatko) P.zlatko = { name: 'name.zlatko', voice: 1.05 };   // Zajko's mother
  if (!P.jablan) P.jablan = { name: 'name.jablan', voice: 0.8 };    // Zajko's father

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
  /* a free standing point near (x, z) — for NPCs that walk up to Đorđe in rooms whose layout may change */
  function freeNear(x, z) {
    var W = BTS.World;
    if (!W.blocked(x, z, 0.3)) return [x, z];
    if (W.nav && W.nav.nearestFree) { var c = W.nav.nearestFree.apply(W.nav, W.nav.toCell(x, z)); if (c) { var cc = W.nav.center(c[0], c[1]); return [cc[0], cc[1]]; } }
    return [x, z];
  }
  function nearPlayer(dx, dz) { var p = BTS.World.player; return freeNear(p.x + dx, p.z + dz); }
  /* swap an entity's character sheet mid-scene (e.g. Gorazd takes off his cap) */
  function setSheet(id, sheet) {
    var e = id === 'player' || id === 'djordje' ? BTS.World.player : BTS.World.get(id);
    if (e) { var lock = e.anim && e.anim.lock; e.add('anim', new BTS.Animator(sheet)); if (lock) e.anim.lock = lock; }
  }
  /* a long, readable title card on the existing chapter-card layer (epilogue titles). Holds for a time that
     scales with the text; Action skips it after a moment. */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'); }
  function card(key, sub, minSec) {
    var U = BTS.UI, txt = BTS.t(key) + ' ' + (sub ? BTS.t(sub) : '');
    var hold = Math.min(16, Math.max(minSec || 5, txt.length * 0.06));
    U.card.innerHTML = '<div class="ct">' + esc(BTS.t(key)) + '</div>' + (sub ? '<div class="cs" style="max-width:46rem;line-height:1.55">' + esc(BTS.t(sub)) + '</div>' : '');
    U.card.classList.remove('show'); void U.card.offsetWidth; U.card.classList.add('show');
    return new Promise(function (res) {
      var t0 = performance.now(), done = false;
      var iv = setInterval(function () {
        var el = (performance.now() - t0) / 1000;
        var skip = el > 1.8 && BTS.Input && BTS.Input.down && BTS.Input.down.interact;
        if (!done && (el > hold || skip)) { done = true; clearInterval(iv); U.card.classList.remove('show'); setTimeout(res, 950); }
      }, 50);
    });
  }
  function cards(list) {   // [[key, sub], ...] in sequence
    return list.reduce(function (p, c) { return p.then(function () { return card(c[0], c[1], c[2]); }); }, Promise.resolve());
  }
  /* sheet id if the art exists, otherwise a fallback (checked at the moment of use) */
  function sheetOr(id, fb) { return BTS.CharSprites && BTS.CharSprites.sheets && BTS.CharSprites.sheets[id] ? id : fb; }
  BTS.StoryUtil = { when: when, add: add, freeNear: freeNear, nearPlayer: nearPlayer, setSheet: setSheet, card: card, cards: cards, sheetOr: sheetOr, spot: BTS.SpotNow, at: BTS.SpotAt };

  /* Lisa's trust in Đorđe's account grows with honest answers; 'trust_hi' unlocks warmer lines later */
  BTS.Story.calls.trust = function (n) { var v = (S.val('trust') || 0) + (n || 1); S.d.flags.trust = v; if (v >= 2) S.set('trust_hi'); };
  BTS.Story.calls.goto = function (id) { setTimeout(function () { BTS.Story.goto(id, true); }, 0); };
  BTS.Story.calls.anim = function (a) { var p = BTS.World.player; if (p && p.anim) p.anim.lock = a || null; };

  function thoughts(id, n) { var s = []; for (var i = 1; i <= n; i++) s.push(['>', String(i)]); D(id, s); }
  // village examinables
  thoughts('x_well', 2); thoughts('x_pole', 2); thoughts('x_pole_late', 2); thoughts('x_view', 3); thoughts('x_beehive', 2); thoughts('x_plaque', 2); thoughts('x_graves', 2);
  thoughts('x_anvil', 1); thoughts('x_oven', 2); thoughts('x_cart', 1); thoughts('x_scarecrow', 2); thoughts('x_jag_herbs', 2); thoughts('x_sheep', 1); thoughts('x_easel', 2);
  thoughts('x_axe', 1); thoughts('x_bridge', 2); thoughts('x_bell', 2);
  // interiors
  thoughts('x_dj_icon', 2); thoughts('x_dj_photo', 3); thoughts('x_dj_stove', 2); thoughts('x_dj_drawings', 3); thoughts('x_dj_shelf', 2); thoughts('x_dj_cupboard', 2); thoughts('x_dj_rabbit', 2);
  thoughts('x_zh_icon', 1); thoughts('x_zh_kite', 2); thoughts('x_zh_shelf', 1); thoughts('x_zh_anvil', 1); thoughts('x_gh_stove', 1); thoughts('x_gu_notes', 2);
  thoughts('x_ch_icons', 2); thoughts('x_ch_candles', 2); thoughts('x_ch_window', 1); thoughts('x_kf_tv', 1); thoughts('x_kf_photo', 2);
  // outskirts
  thoughts('x_os_cross', 2); thoughts('x_os_view', 3); thoughts('x_os_mill', 2); thoughts('x_os_scarecrow', 1); thoughts('x_os_river', 2);
  // locked / blocked
  thoughts('locked_generic', 1); thoughts('locked_zajko', 1); thoughts('locked_kafana', 1); thoughts('locked_guest', 1); thoughts('locked_church', 1); thoughts('locked_gorazd', 1);
  thoughts('locked_tihomir', 1); thoughts('locked_jaglika', 1); thoughts('locked_outskirts', 1);
  thoughts('block_fair', 1); thoughts('block_home', 1); thoughts('block_night', 1); thoughts('block_lisa', 1); thoughts('block_mill', 1); thoughts('block_lisa_walk', 1);
  // observation
  thoughts('obs_normal', 1); thoughts('obs_odd', 1); thoughts('obs_beast', 1); thoughts('obs_none', 2);
  // villagers (extras) — rotating remarks by mood
  D('extra_a', [['villager', '1']]); D('extra_b', [['villager', '1']]); D('extra_c', [['villager', '1']]);
  D('extra_fair_a', [['villager', '1']]); D('extra_fair_b', [['villager', '1'], ['>', '2']]); D('extra_fair_c', [['villager', '1'], ['>', '2']]); D('extra_fair_d', [['villager', '1']]);
  D('extra_fear_a', [['villager', '1']]); D('extra_fear_b', [['villager', '1']]); D('extra_fear_c', [['villager', '1']]);
  D('talk_generic', [['>', '1']]);
  D('talk_busy', [['>', '1']]);
})();
