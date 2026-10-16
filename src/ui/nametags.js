/* Floating name labels over named story characters (Settings → "Names above characters").
   Small, semi-transparent, fade with distance but never vanish; the character the current goal
   points at is drawn a little stronger. DOM nodes are reused per character id. */
'use strict';
BTS.NameTags = (function () {
  var N = { layer: null, tags: {}, tk: null, tid: null };
  var SKIP = { villager: 1, djordje: 1 };

  /* the setting lives in BTS.Config; core.js only keeps keys it knows about when it loads
     localStorage, so register the key here and recover a stored value ourselves */
  (function () {
    var C = BTS.Config;
    if (!C || ('nameLabels' in C.defaults)) return;
    C.defaults.nameLabels = true;
    var v = true;
    try { var raw = JSON.parse(localStorage.getItem('bts.settings.v1') || '{}'); if (typeof raw.nameLabels === 'boolean') v = raw.nameLabels; } catch (e) { }
    C.data.nameLabels = v;
  })();

  N.init = function (parent) {
    N.layer = BTS.UI.el('div', 'nametags', null, parent);
    N.tags = {};
    BTS.Events.on('language', function () { for (var id in N.tags) N.tags[id].name = null; N.tk = null; });
  };

  function headHeight(e) {
    var ch = BTS.Data.characters && BTS.Data.characters[e.anim ? e.anim.sheetId : e.id];
    var b = ch && ch.body;
    var h = b === 'child' ? 1.6 : b === 'small' ? 1.7 : b === 'old' ? 1.95 : 2.1;
    return h * (e.scale || 1);
  }

  /* whose name to stress: someone whose conversation moves the story now, preferably the one
     the objective text mentions. Recomputed only when the beat / flags / clues / goal change. */
  function stemOf(name) {
    var w = name.toLowerCase().split(/\s+/).pop();
    return w.length > 4 ? w.slice(0, -1) : w;
  }
  function objectiveTarget() {
    var d = BTS.State.d;
    var key = d.beat + '|' + Object.keys(d.flags).length + '|' + d.clueOrder.length + '|' + (d.objectiveKey || '');
    if (key === N.tk) return N.tid;
    N.tk = key; N.tid = null;
    var people = BTS.Data.people, talk = BTS.Data.talk || {}, S = BTS.Story;
    var obj = d.objectiveKey ? BTS.t(d.objectiveKey).toLowerCase() : '';
    var movers = [], named = [];
    try {
      Object.keys(people).forEach(function (id) {
        if (SKIP[id]) return;
        var list = talk[id] || [], pick = null;
        for (var i = 0; i < list.length; i++) { var o = list[i]; if (S.inRange(o.beats) && BTS.Cond.eval(o.if)) { pick = o; break; } }
        var moves = pick && (pick.then || (pick.set && !BTS.State.flag(pick.set)) || (pick.clue && [].concat(pick.clue).some(function (c) { return !BTS.State.hasClue(c); })));
        if (moves) movers.push(id);
        if (obj && obj.indexOf(stemOf(BTS.t(people[id].name))) >= 0) named.push(id);
      });
    } catch (e) { return null; }
    var both = movers.filter(function (id) { return named.indexOf(id) >= 0; });
    N.tid = both[0] || (movers.length === 1 ? movers[0] : null) || (named.length === 1 ? named[0] : null);
    return N.tid;
  }

  N.update = function (dt) {
    if (!N.layer) return;
    var G = BTS.Game, W = BTS.World, U = BTS.UI;
    var on = BTS.Config.get('nameLabels') !== false && G && G.started && G.mode === 'play' && !U.stack.length &&
      !BTS.Dialogue.active && !BTS.Cutscene.running && !(BTS.Story && BTS.Story.cardActive) && !G.transitioning && !(BTS.Env.fadeBlack > 0.3) && W.loc;
    if (N.layer._on !== !!on) { N.layer._on = !!on; N.layer.classList.toggle('off', !on); }
    if (!on) return;
    dt = Math.min(dt || 0.016, 0.1);
    var people = BTS.Data.people, cam = BTS.Camera.target, vw = window.innerWidth, vh = window.innerHeight;
    var fi = W.focusInteract, focusEnt = fi && fi.ent && U.prompt && U.prompt.classList.contains('show') ? fi.ent : null;
    var goalId = objectiveTarget();
    var seen = {};
    for (var i = 0; i < W.entities.length; i++) {
      var e = W.entities[i];
      if (e.isPlayer || e.kind !== 'npc' || !people[e.id] || SKIP[e.id]) continue;
      seen[e.id] = 1;
      var tg = N.tags[e.id] || (N.tags[e.id] = { el: BTS.UI.el('div', 'ntag', null, N.layer), a: 0, name: null, shown: true, sx: 0, sy: 0 });
      var vis = !e.hidden && e.alpha > 0.15 && e !== focusEnt && !(e.brain && e.brain.state === 'dead');
      var sp = vis ? BTS.Camera.toScreen(e.x, (e.y || 0) + headHeight(e), e.z) : null;
      if (!sp || sp[0] < -80 || sp[0] > vw + 80 || sp[1] < -10 || sp[1] > vh + 40) vis = false;
      var dist = Math.hypot(e.x - cam[0], e.z - cam[2]);
      var isGoal = e.id === goalId;
      var goal = vis ? BTS.M.clamp(0.95 - (dist - 5) / 34, isGoal ? 0.72 : 0.42, isGoal ? 1 : 0.86) : 0;
      tg.a += (goal - tg.a) * Math.min(1, dt * 7);
      if (sp) { tg.sx = sp[0]; tg.sy = sp[1]; }
      if (tg.a < 0.02) { if (tg.shown) { tg.el.style.display = 'none'; tg.shown = false; } continue; }
      if (!tg.shown) { tg.el.style.display = ''; tg.shown = true; }
      var name = BTS.t(people[e.id].name);
      if (tg.name !== name) { tg.el.textContent = name; tg.name = name; }
      if (tg.goal !== isGoal) { tg.goal = isGoal; tg.el.classList.toggle('goal', isGoal); }
      var sc = BTS.M.clamp(1.08 - dist / 90, 0.8, 1);
      tg.el.style.opacity = tg.a.toFixed(2);
      tg.el.style.transform = 'translate(' + Math.round(tg.sx) + 'px,' + Math.round(tg.sy) + 'px) translate(-50%,-100%) scale(' + sc.toFixed(2) + ')';
    }
    for (var id in N.tags) if (!seen[id] && N.tags[id].shown) { N.tags[id].el.style.display = 'none'; N.tags[id].shown = false; N.tags[id].a = 0; }
  };
  return N;
})();
