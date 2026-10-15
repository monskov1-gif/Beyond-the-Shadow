/* Journal: Observations / Facts / Hypotheses (with linking two entries into a hypothesis),
   Sketches (procedural pencil drawings: pattern board with houses, death dates and Jaglika's
   appearances; shadow studies; house sketches) and Tasks. Entries are never lost. */
'use strict';
BTS.Journal = (function () {
  var U = BTS.UI, el = U.el, esc = U.esc;
  var t = function (k, p) { return BTS.t(k, p); };
  var J = { tab: 'obs' };
  var TABS = ['obs', 'fact', 'hyp', 'sketch', 'tasks'];

  J.open = function (tab) {
    if (U.isOpen('journal')) return;
    if (tab) J.tab = tab;
    BTS.Audio.play('journal');
    var s = { name: 'journal', el: el('div', 'panel journal book') };
    var linkSel = null;
    s.onTab = function (d) { J.tab = TABS[(TABS.indexOf(J.tab) + d + TABS.length) % TABS.length]; BTS.Audio.play('page'); s.refresh(); };
    s.refresh = function () {
      s.el.innerHTML = '';
      var tabs = el('div', 'tabs', null, s.el);
      TABS.forEach(function (tb) {
        var n = tb === 'sketch' ? sketchList().length : tb === 'tasks' ? 0 : BTS.State.cluesBy(tb).length;
        var b = el('button', 'tab' + (J.tab === tb ? ' on' : ''), esc(t('jr.tab_' + tb)) + (n ? ' <i>' + n + '</i>' : ''), tabs);
        b.type = 'button';
        b.addEventListener('click', function () { J.tab = tb; BTS.Audio.play('page'); s.refresh(); });
      });
      el('div', 'tabhint', esc(t('jr.tab_hint')), s.el);
      if (J.lastResult) { el('div', 'linkresult', esc(J.lastResult), s.el); J.lastResult = null; }
      var body = el('div', 'jbody', null, s.el);
      if (J.tab === 'sketch') renderSketches(s, body);
      else if (J.tab === 'tasks') renderTasks(s, body);
      else renderClues(s, body, J.tab);
      var foot = el('div', 'row foot', null, s.el);
      if (J.tab === 'obs' || J.tab === 'hyp' || J.tab === 'fact') {
        U.button(s, foot, linkSel ? t('jr.cancel_link') : t('jr.link'), function () { linkSel = linkSel ? null : []; s.refresh(); }, { cls: 'link' });
      }
      U.button(s, foot, t('ui.close'), function () { U.pop(); }, { sound: 'ui_back' });
      s.cols = 1;
    };
    function renderClues(s, body, cat) {
      var ids = BTS.State.cluesBy(cat);
      if (linkSel) {
        el('div', 'linkhint', esc(t('jr.link_hint', { n: linkSel.length })), body);
        ids = BTS.State.d.clueOrder.slice();
      }
      if (!ids.length) { el('p', 'empty', esc(t('jr.empty_' + cat)), body); return; }
      ids.slice().reverse().forEach(function (id) {
        var def = BTS.Data.clues[id], st = BTS.State.d.clues[id];
        var e = el('div', 'entry nav' + (st.isNew ? ' new' : '') + (linkSel && linkSel.indexOf(id) >= 0 ? ' sel' : ''), null, body);
        U.bindNav(s, e);
        el('div', 'et', esc(t(def.title)) + ' <span class="cat">' + esc(t('jr.cat_' + st.cat)) + '</span>', e);
        el('div', 'ed', U.fmt(t(def.text)), e);
        if (def.date) el('div', 'date', esc(t('date.' + def.date)), e);
        e.addEventListener('mouseenter', function () { st.isNew = false; });
        e._clue = st;
        e.addEventListener('click', function () {
          st.isNew = false;
          if (!linkSel) return;
          var i = linkSel.indexOf(id);
          if (i >= 0) linkSel.splice(i, 1); else linkSel.push(id);
          if (linkSel.length === 2) { var res = J.tryLink(linkSel[0], linkSel[1]); linkSel = null; if (res) J.tab = 'hyp'; }
          s.refresh();
        });
      });
    }
    function renderTasks(s, body) {
      var cur = BTS.State.d.objectiveKey;
      if (cur) { var e = el('div', 'entry task cur', null, body); el('div', 'et', esc(t('jr.current')), e); el('div', 'ed', U.fmt(t(cur)), e); }
      var past = BTS.Story.pastObjectives();
      past.slice().reverse().forEach(function (k) { var e2 = el('div', 'entry task done', null, body); U.bindNav(s, e2); el('div', 'ed', '✓ ' + U.fmt(t(k)), e2); });
      var c = el('div', 'entry chapter', null, body);
      el('div', 'et', esc(t(BTS.Story.chapterKey(BTS.State.d.beat))), c);
    }
    function renderSketches(s, body) {
      var list = sketchList();
      if (!list.length) { el('p', 'empty', esc(t('jr.empty_sketch')), body); return; }
      list.forEach(function (sk) {
        var e = el('div', 'sketch nav', null, body);
        U.bindNav(s, e);
        var cv = el('canvas', null, null, e); cv.width = 360; cv.height = sk.type === 'pattern' ? 260 : 180;
        J.drawSketch(cv, sk);
        el('div', 'st', esc(t(sk.title)), e);
        if (sk.text) el('div', 'sd', U.fmt(t(sk.text)), e);
      });
    }
    s.update = function () { if (s.focus && s.focus._clue) s.focus._clue.isNew = false; };
    s.onBack = function () { if (linkSel) { linkSel = null; s.refresh(); } else U.pop(); };
    s.refresh();
    U.push(s);
  };

  /* sketches = special clues with sketch data + the pattern board once it exists */
  function sketchList() {
    var out = [];
    if (BTS.State.flag('pattern_board')) out.push({ type: 'pattern', title: 'sk.pattern.t', text: 'sk.pattern.d' });
    BTS.State.d.clueOrder.forEach(function (id) {
      var d = BTS.Data.clues[id]; if (d && d.sketch) out.push({ type: d.sketch.type, data: d.sketch, title: d.title, text: d.text, id: id });
    });
    return out;
  }
  J.sketchList = sketchList;

  J.tryLink = function (a, b) {
    var ds = BTS.Data.deductions;
    for (var i = 0; i < ds.length; i++) {
      var d = ds[i];
      if ((d.a === a && d.b === b) || (d.a === b && d.b === a)) {
        if (BTS.State.hasClue(d.result)) { J.lastResult = t('jr.link_known'); BTS.UI.toast(J.lastResult); return false; }
        if (d.cond && !BTS.Cond.eval(d.cond)) { J.lastResult = t('jr.link_notyet'); BTS.UI.toast(J.lastResult); return false; }
        BTS.State.addClue(d.result);
        if (d.flag) BTS.State.set(d.flag);
        J.lastResult = d.thought ? t(d.thought) : null; if (d.thought) BTS.UI.toast(t(d.thought));
        BTS.Events.emit('deduced', d.result);
        return true;
      }
    }
    BTS.Audio.play('ui_denied');
    J.lastResult = t('jr.link_fail'); BTS.UI.toast(J.lastResult);
    return false;
  };

  /* ---------- pencil drawing helpers ---------- */
  function pencil(g, pts, w, jitter, col) {
    g.strokeStyle = col || 'rgba(52,46,44,0.85)'; g.lineWidth = w || 1.2; g.lineCap = 'round';
    for (var pass = 0; pass < 2; pass++) {
      g.beginPath();
      pts.forEach(function (p, i) { var jx = (Math.random() - 0.5) * (jitter || 1.2), jy = (Math.random() - 0.5) * (jitter || 1.2); if (i === 0) g.moveTo(p[0] + jx, p[1] + jy); else g.lineTo(p[0] + jx, p[1] + jy); });
      g.stroke();
    }
  }
  function paper(g, w, h) {
    g.fillStyle = '#d9cfb6'; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 900; i++) { g.fillStyle = 'rgba(120,100,70,' + (Math.random() * 0.06) + ')'; g.fillRect(Math.random() * w, Math.random() * h, 1, 1); }
    g.strokeStyle = 'rgba(90,110,140,0.25)'; g.lineWidth = 1;
    for (var y = 18; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  }
  function house(g, x, y, w, h, o) {
    o = o || {};
    pencil(g, [[x, y], [x + w, y], [x + w, y - h], [x, y - h], [x, y]]);
    pencil(g, [[x - 4, y - h], [x + w / 2, y - h - h * 0.6], [x + w + 4, y - h]]);
    pencil(g, [[x + w * 0.4, y], [x + w * 0.4, y - h * 0.55], [x + w * 0.6, y - h * 0.55], [x + w * 0.6, y]], 1);
    if (o.window !== false) pencil(g, [[x + w * 0.12, y - h * 0.7], [x + w * 0.3, y - h * 0.7], [x + w * 0.3, y - h * 0.45], [x + w * 0.12, y - h * 0.45], [x + w * 0.12, y - h * 0.7]], 1);
    if (o.cross) { g.strokeStyle = 'rgba(140,30,30,.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 3, y + 3); g.lineTo(x + w + 3, y - h - h * 0.6); g.moveTo(x + w + 3, y + 3); g.lineTo(x - 3, y - h - h * 0.6); g.stroke(); }
  }
  function figure(g, x, y, s, o) {
    o = o || {};
    s = s || 1;
    var col = o.col;
    pencil(g, [[x, y - 30 * s], [x, y - 12 * s]], 1.5, 1, col);
    g.beginPath(); g.arc(x, y - 34 * s, 4 * s, 0, Math.PI * 2); g.strokeStyle = col || 'rgba(52,46,44,.85)'; g.stroke();
    pencil(g, [[x, y - 12 * s], [x - 4 * s, y]], 1.3, 1, col); pencil(g, [[x, y - 12 * s], [x + 4 * s, y]], 1.3, 1, col);
    pencil(g, [[x, y - 26 * s], [x - 6 * s, y - 18 * s]], 1.2, 1, col); pencil(g, [[x, y - 26 * s], [x + 6 * s, y - 18 * s]], 1.2, 1, col);
    if (o.hunched) { pencil(g, [[x - 6 * s, y - 36 * s], [x + 6 * s, y - 32 * s], [x + 7 * s, y - 20 * s]], 1.2, 1, col); }
    if (o.needle) { g.strokeStyle = 'rgba(160,30,30,.9)'; g.beginPath(); g.moveTo(x + 6 * s, y - 18 * s); g.lineTo(x + 11 * s, y - 25 * s); g.stroke(); }
  }
  function shadowShape(g, x, y, len, ang, o) {
    o = o || {};
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = o.col || 'rgba(40,36,40,0.55)';
    g.beginPath(); g.ellipse(len / 2, 0, len / 2, o.w || 5, 0, 0, Math.PI * 2); g.fill();
    if (o.limbs) for (var i = 0; i < o.limbs; i++) { g.beginPath(); g.moveTo(len * (0.3 + i * 0.1), 0); g.quadraticCurveTo(len * (0.4 + i * 0.1), (i % 2 ? 1 : -1) * 22, len * (0.55 + i * 0.08), (i % 2 ? 1 : -1) * 30); g.lineWidth = 2; g.strokeStyle = g.fillStyle; g.stroke(); }
    g.restore();
  }
  function note(g, text, x, y, col, size) { g.fillStyle = col || 'rgba(40,36,60,.9)'; g.font = 'italic ' + (size || 12) + 'px Georgia, serif'; g.fillText(text, x, y); }

  J.drawSketch = function (cv, sk) {
    var g = cv.getContext('2d'), w = cv.width, h = cv.height;
    paper(g, w, h);
    var d = sk.data || {};
    if (sk.type === 'pattern') return drawPattern(g, w, h);
    if (sk.type === 'shadow') {
      figure(g, 120, 140, 2.2, { hunched: d.hunched });
      var stage = d.stage || 1;
      var len = [70, 90, 120, 150, 0][stage] || 90, ang = [0.15, 0.15, -0.5, 0.9, 0][stage] || 0;
      if (stage === 3) shadowShape(g, 170, 150, len, 0.2, { w: 7 });
      else if (stage < 4) shadowShape(g, 125, 142, len, ang, { w: 7, limbs: d.beast ? 6 : 0 });
      if (stage === 4) { g.setLineDash([3, 4]); pencil(g, [[125, 142], [230, 150]], 1, 0.5); g.setLineDash([]); }
      if (d.beast) shadowShape(g, 125, 142, 190, -0.25, { w: 16, limbs: 8, col: 'rgba(20,16,22,0.7)' });
      note(g, t(d.note || 'sk.note_lag'), 200, 40, 'rgba(40,36,60,.9)', 13);
      if (d.name) note(g, t(d.name), 20, 26, 'rgba(60,40,30,.95)', 14);
      if (d.date) note(g, t('date.' + d.date), 20, h - 12, 'rgba(60,40,30,.8)', 11);
      return;
    }
    if (sk.type === 'house') {
      house(g, 110, 150, 120, 70, { cross: d.cross && BTS.Cond.eval(d.cross) });
      pencil(g, [[60, 150], [240, 150], [300, 150]], 1);
      if (d.figure) figure(g, d.fx || 270, 150, 1.6, { hunched: true, needle: d.needle });
      if (d.name) note(g, t(d.name), 20, 26, 'rgba(60,40,30,.95)', 14);
      if (d.date) note(g, t('date.' + d.date), 20, h - 12, 'rgba(60,40,30,.8)', 11);
      if (d.note) note(g, t(d.note), 180, 40, 'rgba(40,36,60,.9)', 12);
      return;
    }
    if (sk.type === 'object') {
      if (d.obj === 'needle') { g.strokeStyle = 'rgba(52,46,44,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(80, 140); g.lineTo(260, 50); g.stroke(); g.beginPath(); g.ellipse(250, 55, 6, 3, -0.45, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(150,30,30,.6)'; g.fillRect(150, 80, 40, 30); pencil(g, [[150, 80], [190, 80], [190, 110], [150, 110], [150, 80]]); }
      if (d.obj === 'vial') { pencil(g, [[160, 40], [200, 40], [200, 150], [160, 150], [160, 40]]); pencil(g, [[160, 100], [200, 100]]); g.fillStyle = 'rgba(150,30,30,.6)'; g.fillRect(162, 30, 36, 10); }
      if (d.obj === 'photo') { pencil(g, [[90, 30], [270, 30], [270, 160], [90, 160], [90, 30]]); figure(g, 150, 140, 2); figure(g, 210, 140, 2); shadowShape(g, 150, 142, 60, 0.3, { w: 5 }); }
      if (d.name) note(g, t(d.name), 20, 26, 'rgba(60,40,30,.95)', 14);
      if (d.note) note(g, t(d.note), 20, h - 14, 'rgba(40,36,60,.9)', 12);
    }
  };

  /* Pattern board: village plan from the real map shapes; victims' houses with death dates,
     red marks where/when Jaglika was seen. */
  function drawPattern(g, w, h) {
    var st = BTS.World.cache && BTS.World.cache.village;
    var shapes = st ? st.mapShapes : [];
    var b = BTS.Locations.village.bounds;
    var sx = (w - 30) / (b[2] - b[0]), sz = (h - 40) / (b[3] - b[1]);
    function P(x, z) { return [15 + (x - b[0]) * sx, 25 + (z - b[1]) * sz]; }
    shapes.forEach(function (s) {
      if (s.t !== 'house') return;
      var a = P(s.box[0], s.box[1]), c = P(s.box[2], s.box[3]);
      g.strokeStyle = 'rgba(52,46,44,0.55)'; g.lineWidth = 1; g.strokeRect(a[0], a[1], c[0] - a[0], c[1] - a[1]);
    });
    var marks = BTS.Data.patternMarks || [];
    marks.forEach(function (m) {
      if (m.cond && !BTS.Cond.eval(m.cond)) return;
      var p = P(m.x, m.z);
      if (m.kind === 'death') {
        g.strokeStyle = 'rgba(30,26,26,.9)'; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0] - 5, p[1] - 5); g.lineTo(p[0] + 5, p[1] + 5); g.moveTo(p[0] + 5, p[1] - 5); g.lineTo(p[0] - 5, p[1] + 5); g.stroke();
        note(g, t('date.' + m.date), p[0] + 7, p[1] + 4, 'rgba(20,20,20,.95)', 10);
      } else {
        g.strokeStyle = 'rgba(160,30,30,.9)'; g.lineWidth = 1.5; g.beginPath(); g.arc(p[0], p[1], 7, 0, Math.PI * 2); g.stroke();
        note(g, t('date.' + m.date), p[0] - 18, p[1] - 10, 'rgba(160,30,30,.95)', 10);
      }
    });
    note(g, t('sk.legend'), 12, h - 8, 'rgba(40,36,60,.9)', 11);
  }
  return J;
})();
