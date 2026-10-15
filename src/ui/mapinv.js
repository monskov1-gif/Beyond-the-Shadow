/* Paper map (progressively revealed areas, localized labels, player marker) and the small
   story inventory (unique items with icon, description, state and use contexts). */
'use strict';
BTS.MapUI = (function () {
  var U = BTS.UI, el = U.el, esc = U.esc;
  var t = function (k, p) { return BTS.t(k, p); };
  var M = { page: 'village' };

  M.open = function () {
    if (U.isOpen('map')) return;
    BTS.Audio.play('map_open');
    var s = { name: 'map', el: el('div', 'panel mapui book') };
    s.onTab = function () { M.page = M.page === 'village' ? 'outskirts' : 'village'; s.refresh(); };
    s.refresh = function () {
      s.el.innerHTML = '';
      var tabs = el('div', 'tabs', null, s.el);
      ['village', 'outskirts'].forEach(function (pg) {
        var b = el('button', 'tab' + (M.page === pg ? ' on' : ''), (pg === 'village' ? '◀ ' : '') + esc(t('loc.' + pg)) + (pg === 'outskirts' ? ' ▶' : ''), tabs); b.type = 'button';
        b.addEventListener('click', function () { M.page = pg; s.refresh(); });
      });
      var cv = el('canvas', 'mapcv', null, s.el);
      cv.width = 760; cv.height = 470;
      M.draw(cv, M.page); s.cv = cv; s.acc = 0;
      var foot = el('div', 'row foot', null, s.el);
      el('span', 'legend', esc(t('map.legend')), foot);
      U.button(s, foot, t('ui.close'), function () { U.pop(); }, { sound: 'ui_back' });
    };
    s.update = function (dt) { s.acc += dt; if (s.acc > 0.25 && s.cv) { s.acc = 0; M.draw(s.cv, M.page); } };
    s.onBack = function () { U.pop(); };
    s.refresh();
    U.push(s);
  };

  M.draw = function (cv, page) {
    var g = cv.getContext('2d'), w = cv.width, h = cv.height;
    var st = BTS.World.cache[page];
    g.fillStyle = '#d6cbb0'; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 2500; i++) { g.fillStyle = 'rgba(110,90,60,' + Math.random() * 0.07 + ')'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    if (!st) { g.fillStyle = '#433'; g.font = '16px Georgia'; g.fillText(t('map.unknown'), 30, 40); return; }
    var def = st.def, b = def.bounds;
    var sc = Math.min((w - 40) / (b[2] - b[0]), (h - 40) / (b[3] - b[1]));
    var ox = (w - (b[2] - b[0]) * sc) / 2, oz = (h - (b[3] - b[1]) * sc) / 2;
    function P(x, z) { return [ox + (x - b[0]) * sc, oz + (z - b[1]) * sc]; }
    // terrain tint: sample tiles coarsely
    for (var z = b[1]; z < b[3]; z += 2) for (var x = b[0]; x < b[2]; x += 2) {
      var tl = st.tileAt(x + 1, z + 1), c = null;
      if (/water/.test(tl)) c = 'rgba(70,100,120,.55)';
      else if (/cobble|flags|gravel|dirt|mud|sand/.test(tl)) c = 'rgba(140,110,80,.35)';
      else if (/field/.test(tl)) c = 'rgba(150,120,70,.3)';
      else if (/dark/.test(tl)) c = 'rgba(60,80,50,.35)';
      if (c) { var p = P(x, z); g.fillStyle = c; g.fillRect(p[0], p[1], sc * 2 + 0.5, sc * 2 + 0.5); }
    }
    st.mapShapes.forEach(function (s) {
      if (s.t === 'house') { var a = P(s.box[0], s.box[1]), c2 = P(s.box[2], s.box[3]); g.fillStyle = 'rgba(90,70,55,.55)'; g.fillRect(a[0], a[1], c2[0] - a[0], c2[1] - a[1]); g.strokeStyle = 'rgba(40,30,25,.8)'; g.strokeRect(a[0], a[1], c2[0] - a[0], c2[1] - a[1]); }
      if (s.t === 'well') { var q = P(s.x, s.z); g.beginPath(); g.arc(q[0], q[1], 3, 0, 7); g.fillStyle = 'rgba(40,60,80,.8)'; g.fill(); }
      if (s.t === 'tree') { var r = P(s.x, s.z); g.fillStyle = 'rgba(60,80,50,.35)'; g.fillRect(r[0] - 1, r[1] - 1, 3, 3); }
    });
    // fog over unrevealed areas
    (st.areas || []).forEach(function (a) {
      var p0 = P(a.box[0], a.box[1]), p1 = P(a.box[2], a.box[3]);
      if (!BTS.State.d.map[a.id]) {
        g.fillStyle = 'rgba(214,203,176,0.93)'; g.fillRect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1]);
        g.fillStyle = 'rgba(120,100,80,.5)'; g.font = 'italic 13px Georgia'; g.fillText('?', (p0[0] + p1[0]) / 2 - 3, (p0[1] + p1[1]) / 2 + 4);
      }
    });
    (st.areas || []).forEach(function (a) {
      if (!BTS.State.d.map[a.id]) return;
      var p0 = P(a.box[0], a.box[1]), p1 = P(a.box[2], a.box[3]);
      var label = t('area.' + a.id);
      g.font = 'italic 13px Georgia'; var tw = g.measureText(label).width;
      var cx = (p0[0] + p1[0]) / 2 - tw / 2, cy = a.labelTop ? p0[1] + 14 : (p0[1] + p1[1]) / 2;
      g.fillStyle = 'rgba(214,203,176,.75)'; g.fillRect(cx - 3, cy - 12, tw + 6, 16);
      g.fillStyle = 'rgba(40,30,25,.95)'; g.fillText(label, cx, cy);
    });
    // player marker
    var W = BTS.World, pl = W.player, mp = null;
    if (W.locId === page && pl) mp = [pl.x, pl.z];
    else if (W.loc && W.loc.def.mapParent === page && W.loc.def.mapPos) mp = W.loc.def.mapPos;
    if (mp) {
      var pp = P(mp[0], mp[1]), tt = performance.now() / 300;
      g.beginPath(); g.arc(pp[0], pp[1], 5 + Math.sin(tt) * 1.5, 0, 7); g.fillStyle = 'rgba(150,30,30,.9)'; g.fill();
      g.strokeStyle = '#2a1a1a'; g.stroke();
      g.font = '12px Georgia'; g.fillStyle = 'rgba(120,20,20,1)'; g.fillText(t('map.you'), pp[0] + 8, pp[1] - 6);
    }
    g.strokeStyle = 'rgba(60,45,35,.8)'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    // compass
    g.font = 'bold 13px Georgia'; g.fillStyle = 'rgba(60,45,35,.9)'; g.fillText(t('map.north'), w - 34, 28);
  };
  return M;
})();

BTS.Inventory = (function () {
  var U = BTS.UI, el = U.el, esc = U.esc;
  var t = function (k, p) { return BTS.t(k, p); };
  var Inv = {};
  Inv.iconURL = function (iconName) {
    var r = BTS.Atlas.get('icon_' + iconName);
    var c = document.createElement('canvas'); c.width = r.w; c.height = r.h;
    c.getContext('2d').drawImage(BTS.Atlas.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    return c.toDataURL();
  };
  Inv.open = function () {
    if (U.isOpen('inventory')) return;
    BTS.Audio.play('ui_open');
    var s = { name: 'inventory', el: el('div', 'panel inventory book') };
    var sel = 0;
    s.refresh = function () {
      s.el.innerHTML = '';
      el('h2', null, esc(t('ui.inventory')), s.el);
      var wrap = el('div', 'invwrap', null, s.el);
      var grid = el('div', 'invgrid', null, wrap);
      var info = el('div', 'invinfo', null, wrap);
      var items = BTS.State.d.inventory;
      if (!items.length) el('p', 'empty', esc(t('inv.empty')), grid);
      items.forEach(function (it, i) {
        var d = BTS.Data.items[it.id];
        var b = el('button', 'slot' + (it.isNew ? ' new' : ''), null, grid); b.type = 'button';
        U.bindNav(s, b);
        var img = el('img', null, null, b); img.src = Inv.iconURL(d.icon); img.alt = '';
        b.addEventListener('mouseenter', function () { sel = i; show(); });
        b.addEventListener('focus', function () { sel = i; show(); });
        b.addEventListener('click', function () { sel = i; it.isNew = false; show(); });
        b._i = i;
      });
      function show() {
        var it = items[sel]; info.innerHTML = '';
        if (!it) return;
        var d = BTS.Data.items[it.id];
        el('h3', null, esc(t(d.name)), info);
        el('p', null, U.fmt(t(d.desc)), info);
        if (it.state && it.state !== 'default') el('p', 'state', esc(t('inv.state')) + ' ' + esc(t('item.' + it.id + '.state_' + it.state)), info);
        if (d.use) el('p', 'use', esc(t('inv.use')) + ' ' + esc(t(d.use)), info);
      }
      s.update = function () { var f = s.focus; if (f && f._i !== undefined && f._i !== sel) { sel = f._i; items[sel].isNew = false; show(); } };
      s.cols = 4;
      var foot = el('div', 'row foot', null, s.el);
      U.button(s, foot, t('ui.close'), function () { U.pop(); }, { sound: 'ui_back' });
      show();
    };
    s.onBack = function () { U.pop(); };
    s.refresh();
    U.push(s);
  };
  return Inv;
})();
