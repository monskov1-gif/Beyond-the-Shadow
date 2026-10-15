/* Menu screens: language picker, main menu, pause, settings (+ key rebinding), save/load,
   credits, confirm dialogs, exit. */
'use strict';
BTS.Screens = (function () {
  var U = BTS.UI, el = U.el, esc = U.esc;
  var t = function (k, p) { return BTS.t(k, p); };
  var S = {};

  function screen(name, cls) { var s = { name: name, el: el('div', 'panel ' + (cls || '')) }; return s; }
  function title(s, key, sub) { el('h2', null, esc(t(key)), s.el); if (sub) el('div', 'sub', esc(t(sub)), s.el); }

  /* ---------- language picker (first launch) ---------- */
  S.language = function (onDone) {
    var s = screen('language', 'center small');
    s.refresh = function () {
      s.el.innerHTML = '';
      el('h2', null, 'Язык / Language', s.el);
      var box = el('div', 'col', null, s.el);
      U.button(s, box, 'Русский', function () { BTS.I18N.set('ru'); U.pop(); onDone && onDone(); });
      U.button(s, box, 'English', function () { BTS.I18N.set('en'); U.pop(); onDone && onDone(); });
    };
    s.refresh();
    return U.push(s);
  };

  /* ---------- main menu ---------- */
  S.main = function () {
    var s = screen('main', 'mainmenu');
    s.refresh = function () {
      var keep = s.focus && s.focus.dataset.id;
      s.el.innerHTML = '';
      var logo = el('div', 'logo', null, s.el);
      el('div', 'l1', 'BEYOND THE SHADOWS', logo);
      el('div', 'l2', esc(t('ui.subtitle')), logo);
      var box = el('div', 'col menu', null, s.el);
      var hasSave = BTS.Save.any();
      var b;
      b = U.button(s, box, t('ui.new_game'), function () {
        if (hasSave) S.confirm('ui.confirm_new', function () { U.closeAll(); BTS.Game.newGame(); }); else { U.closeAll(); BTS.Game.newGame(); }
      }); b.dataset.id = 'new';
      b = U.button(s, box, t('ui.continue'), function () { var sl = BTS.Save.latest(); if (sl) BTS.Game.loadSlot(sl); }, { disabled: !hasSave }); b.dataset.id = 'cont';
      b = U.button(s, box, t('ui.load'), function () { S.saveLoad('load'); }, { disabled: !hasSave }); b.dataset.id = 'load';
      b = U.button(s, box, t('ui.settings'), function () { S.settings(); }); b.dataset.id = 'set';
      b = U.button(s, box, t('ui.language') + ': ' + (BTS.I18N.lang === 'ru' ? 'Русский' : 'English'), function () { BTS.I18N.set(BTS.I18N.lang === 'ru' ? 'en' : 'ru'); }); b.dataset.id = 'lang';
      b.adjust = function () { BTS.I18N.set(BTS.I18N.lang === 'ru' ? 'en' : 'ru'); };
      b = U.button(s, box, t('ui.credits'), function () { S.credits(); }); b.dataset.id = 'cred';
      b = U.button(s, box, t('ui.exit'), function () { S.confirm('ui.confirm_exit', function () { S.exit(); }); }); b.dataset.id = 'exit';
      el('div', 'ver', 'v' + BTS.VERSION + ' · ' + esc(t('ui.made_with')), s.el);
      if (keep) { var f = s.el.querySelector('[data-id="' + keep + '"]'); if (f) U.setFocus(s, f); }
    };
    s.onBack = function () { };
    s.refresh();
    return U.push(s);
  };

  S.exit = function () {
    BTS.Config.save();
    if (BTS.Game.started) BTS.Save.autosave();
    U.closeAll();
    var s = screen('exit', 'center small');
    el('h2', null, esc(t('ui.goodbye')), s.el);
    el('p', null, esc(t('ui.goodbye_text')), s.el);
    U.button(s, el('div', 'col', null, s.el), t('ui.back_to_menu'), function () { U.pop(); BTS.Game.toMenu(); });
    U.push(s);
    BTS.Music.set('silence', 2);
    try { window.close(); } catch (e) { }
  };

  /* ---------- pause ---------- */
  S.pause = function () {
    var s = screen('pause', 'pause');
    s.refresh = function () {
      s.el.innerHTML = '';
      title(s, 'ui.paused');
      if (BTS.State.d.objectiveKey) el('div', 'sub', esc(t('ui.objective')) + ' ' + esc(t(BTS.State.d.objectiveKey)), s.el);
      var box = el('div', 'col menu', null, s.el);
      U.button(s, box, t('ui.resume'), function () { U.pop(); });
      U.button(s, box, t('ui.journal'), function () { BTS.Journal.open(); });
      U.button(s, box, t('ui.map'), function () { BTS.MapUI.open(); });
      U.button(s, box, t('ui.inventory'), function () { BTS.Inventory.open(); });
      U.button(s, box, t('ui.settings'), function () { S.settings(); });
      U.button(s, box, t('ui.save'), function () { S.saveLoad('save'); }, { disabled: !BTS.Save.canSave() });
      U.button(s, box, t('ui.load'), function () { S.saveLoad('load'); }, { disabled: !BTS.Save.any() });
      U.button(s, box, t('ui.main_menu'), function () { S.confirm('ui.confirm_menu', function () { U.closeAll(); BTS.Game.toMenu(); }); });
      if (!BTS.Save.canSave()) el('div', 'note', esc(t('ui.save_blocked')), s.el);
    };
    s.onBack = function () { U.pop(); };
    s.refresh();
    return U.push(s);
  };

  /* ---------- confirm ---------- */
  S.confirm = function (key, yes, no) {
    var s = screen('confirm', 'center small');
    s.refresh = function () {
      s.el.innerHTML = '';
      el('p', 'q', esc(t(key)), s.el);
      var row = el('div', 'row', null, s.el);
      U.button(s, row, t('ui.yes'), function () { U.pop(); yes && yes(); });
      U.button(s, row, t('ui.no'), function () { U.pop(); no && no(); });
      s.cols = 2;
    };
    s.onBack = function () { U.pop(); no && no(); };
    s.refresh();
    U.push(s);
    U.setFocus(s, s.el.querySelectorAll('.nav')[1]);
  };

  /* ---------- settings ---------- */
  S.settings = function () {
    var s = screen('settings', 'settings');
    var C = BTS.Config;
    function slider(box, key, cfg) {
      var row = el('div', 'set-row nav', null, box); U.bindNav(s, row);
      el('span', 'lbl', esc(t('set.' + key)), row);
      var bar = el('span', 'bar', null, row), fill = el('span', 'fill', null, bar);
      var val = el('span', 'val', null, row);
      function upd() { var v = C.get(cfg); fill.style.width = Math.round(v * 100) + '%'; val.textContent = Math.round(v * 100) + '%'; }
      row.adjust = function (d) { C.set(cfg, BTS.M.clamp(Math.round((C.get(cfg) + d * 0.1) * 10) / 10, 0, 1)); upd(); };
      row.addEventListener('click', function (e) { var r = bar.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right) { C.set(cfg, BTS.M.clamp(Math.round((e.clientX - r.left) / r.width * 10) / 10, 0, 1)); upd(); } });
      upd();
    }
    function option(box, key, values, get, set) {
      var row = el('div', 'set-row nav', null, box); U.bindNav(s, row);
      el('span', 'lbl', esc(t('set.' + key)), row);
      var l = el('span', 'arrow', '&#9664;', row), v = el('span', 'opt', null, row), r = el('span', 'arrow', '&#9654;', row);
      function idx() { var cur = get(); var i = values.findIndex(function (x) { return x[0] === cur; }); return i < 0 ? 0 : i; }
      function upd() { v.textContent = t(values[idx()][1]); }
      row.adjust = function (d) { var i = (idx() + d + values.length) % values.length; set(values[i][0]); upd(); };
      l.addEventListener('click', function (e) { e.stopPropagation(); row.adjust(-1); });
      r.addEventListener('click', function (e) { e.stopPropagation(); row.adjust(1); });
      row.addEventListener('click', function () { row.adjust(1); });
      upd();
    }
    s.refresh = function () {
      s.el.innerHTML = '';
      title(s, 'ui.settings');
      var box = el('div', 'col scroll', null, s.el);
      option(box, 'language', [['ru', 'set.lang_ru'], ['en', 'set.lang_en']], function () { return BTS.I18N.lang; }, function (v) { BTS.I18N.set(v); });
      el('div', 'set-head', esc(t('set.audio')), box);
      slider(box, 'master', 'masterVolume'); slider(box, 'music', 'musicVolume'); slider(box, 'sfx', 'sfxVolume'); slider(box, 'ambience', 'ambienceVolume'); slider(box, 'ui', 'uiVolume');
      el('div', 'set-head', esc(t('set.text')), box);
      option(box, 'text_speed', [[0, 'set.speed_slow'], [1, 'set.speed_normal'], [2, 'set.speed_fast'], [3, 'set.speed_instant']], function () { return C.get('textSpeed'); }, function (v) { C.set('textSpeed', v); });
      option(box, 'subtitles', [[true, 'set.on'], [false, 'set.off']], function () { return C.get('subtitles'); }, function (v) { C.set('subtitles', v); });
      el('div', 'set-head', esc(t('set.video')), box);
      option(box, 'fullscreen', [[false, 'set.off'], [true, 'set.on']], function () { return !!document.fullscreenElement; }, function (v) {
        try { if (v) document.documentElement.requestFullscreen(); else if (document.fullscreenElement) document.exitFullscreen(); } catch (e) { }
        C.set('fullscreen', v); C.set('autoFullscreen', v);
      });
      option(box, 'ui_size', [[0.8, 'set.size_s'], [1, 'set.size_m'], [1.15, 'set.size_l'], [1.3, 'set.size_xl']], function () { return C.get('uiScale'); }, function (v) { C.set('uiScale', v); BTS.Touch.applyScale(); });
      option(box, 'touch', [[0, 'set.scale_auto'], [1, 'set.on'], [2, 'set.off']], function () { return C.get('touchControls'); }, function (v) { C.set('touchControls', v); BTS.Touch.refresh(); });
      option(box, 'scale', [[0, 'set.scale_auto'], [270, 'set.scale_270'], [360, 'set.scale_360'], [450, 'set.scale_450'], [540, 'set.scale_540']], function () { return C.get('pixelScale'); }, function (v) { C.set('pixelScale', v); BTS.Renderer.resize(); });
      option(box, 'effects', [[0, 'set.fx_low'], [1, 'set.fx_medium'], [2, 'set.fx_high']], function () { return C.get('effects'); }, function (v) { C.set('effects', v); });
      if (BTS.Game.query && BTS.Game.query.get('dev')) option(box, 'dev', [[false, 'set.off'], [true, 'set.on']], function () { return C.get('devMode'); }, function (v) { C.set('devMode', v); });
      el('div', 'set-head', esc(t('set.controls')), box);
      ['up', 'down', 'left', 'right', 'run', 'interact', 'observe', 'journal', 'map', 'inventory', 'pause'].forEach(function (a) {
        var row = el('div', 'set-row nav key', null, box); U.bindNav(s, row);
        el('span', 'lbl', esc(t('key.' + a)), row);
        var v = el('span', 'opt', esc(C.get('keys')[a].map(BTS.Input.keyName).join(' / ')), row);
        row.addEventListener('click', function () {
          v.textContent = t('set.press_key');
          setTimeout(function () {
            BTS.Input.captureKey(function (code) {
              if (code !== 'Escape' || a === 'pause') {
                var k = C.get('keys');
                Object.keys(k).forEach(function (o) { if (o !== a && o !== 'cancel' && !(a === 'pause' && o === 'cancel')) { var before = k[o].length; k[o] = k[o].filter(function (c) { return c !== code; }); if (k[o].length < before && !k[o].length) k[o] = C.defaults.keys[o].filter(function (c) { return c !== code; }).slice(0, 1); } });
                k[a] = [code].concat(k[a].filter(function (c) { return c !== code; })).slice(0, 3); C.set('keys', k);
              }
              s.refresh();
            });
          }, 50);
        });
      });
      U.button(s, box, t('set.reset_keys'), function () { C.resetKeys(); s.refresh(); });
      U.button(s, box, t('ui.back'), function () { U.pop(); }, { sound: 'ui_back' });
    };
    s.onBack = function () { BTS.Input.capture = null; U.pop(); };
    s.refresh();
    return U.push(s);
  };

  /* ---------- save / load ---------- */
  S.saveLoad = function (mode) {
    var s = screen('saveload', 'saveload');
    s.refresh = function () {
      s.el.innerHTML = '';
      title(s, mode === 'save' ? 'ui.save' : 'ui.load');
      var box = el('div', 'col', null, s.el);
      BTS.Save.SLOTS.forEach(function (slot) {
        if (mode === 'save' && slot === 'auto') return;
        var info = BTS.Save.info(slot);
        var label;
        if (info.ok) {
          var dt = new Date(info.savedAt || 0);
          label = (slot === 'auto' ? t('ui.slot_auto') : t('ui.slot', { n: slot })) + ' — ' + t(BTS.Story.chapterKey(info.beat)) + ' · ' + t('ui.playtime', { m: Math.round((info.playtime || 0) / 60) }) + ' · ' + dt.toLocaleString(BTS.I18N.lang === 'ru' ? 'ru-RU' : 'en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } else label = (slot === 'auto' ? t('ui.slot_auto') : t('ui.slot', { n: slot })) + ' — ' + t(info.error === 'missing' ? 'ui.slot_empty' : 'ui.slot_corrupt');
        U.button(s, box, label, function () {
          if (mode === 'save') {
            var go = function () { if (BTS.Save.save(slot)) { s.refresh(); } else BTS.UI.toast(t('ui.save_failed')); };
            if (info.ok) S.confirm('ui.confirm_overwrite', go); else go();
          } else if (info.ok) { BTS.Game.loadSlot(slot); }
          else if (info.error !== 'missing') BTS.UI.toast(t('ui.slot_corrupt'));
        }, { disabled: mode === 'load' && !info.ok, cls: 'slot' });
      });
      U.button(s, box, t('ui.back'), function () { U.pop(); }, { sound: 'ui_back' });
    };
    s.onBack = function () { U.pop(); };
    s.refresh();
    return U.push(s);
  };

  /* ---------- credits ---------- */
  S.credits = function (fromEnding) {
    var s = screen('credits', 'credits');
    s.refresh = function () {
      s.el.innerHTML = '';
      var roll = el('div', 'roll', null, s.el);
      el('h1', null, 'BEYOND THE SHADOWS', roll);
      el('div', 'sub', esc(t('ui.subtitle')), roll);
      BTS.Data.credits.forEach(function (c) {
        if (c.h) el('h3', null, esc(t(c.h)), roll);
        if (c.k) el('p', null, U.fmt(t(c.k)), roll);
        if (c.raw) el('p', null, esc(c.raw), roll);
      });
      el('p', 'end', esc(t('cred.thanks')), roll);
      var box = el('div', 'col', null, s.el);
      U.button(s, box, t(fromEnding ? 'ui.back_to_menu' : 'ui.back'), function () { U.pop(); if (fromEnding) BTS.Game.toMenu(); }, { sound: 'ui_back' });
      s.t = 0;
    };
    s.update = function (dt) { s.t += dt; var r = s.el.querySelector('.roll'); if (r) r.scrollTop = Math.max(0, (s.t - 2) * 22); };
    s.onBack = function () { U.pop(); if (fromEnding) BTS.Game.toMenu(); };
    s.refresh();
    return U.push(s);
  };
  return S;
})();
