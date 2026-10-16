/* UI core: screen stack with keyboard/gamepad/mouse focus navigation, HUD (objective, prompts,
   toasts, captions, location banner), letterbox, chapter cards, and the dialogue box. */
'use strict';
BTS.UI = (function () {
  var U = { stack: [], root: null };
  var t = function (k, p) { return BTS.t(k, p); };
  function el(tag, cls, html, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined && html !== null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }
  U.el = el;
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  U.esc = esc;
  /* light markup in texts: *emphasis* and line breaks */
  U.fmt = function (s) { return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>'); };

  U.init = function () {
    U.root = document.getElementById('ui');
    U.root.innerHTML = '';
    U.hud = el('div', 'hud', null, U.root);
    U.objective = el('div', 'objective', null, U.hud);
    U.banner = el('div', 'banner', null, U.hud);
    if (BTS.NameTags) BTS.NameTags.init(U.hud);
    U.prompt = el('div', 'prompt', null, U.hud);

    U.captions = el('div', 'captions', null, U.hud);
    U.hintKeys = el('div', 'hintkeys', null, U.hud);
    U.lbTop = el('div', 'letterbox top', null, U.root);
    U.lbBot = el('div', 'letterbox bot', null, U.root);
    U.card = el('div', 'card', null, U.root);
    U.dlg = el('div', 'dialogue', null, U.root);
    U.dlgPortrait = el('div', 'portrait', null, U.dlg);
    U.dlgBody = el('div', 'body', null, U.dlg);
    U.dlgName = el('div', 'name', null, U.dlgBody);
    U.dlgText = el('div', 'text', null, U.dlgBody);
    U.dlgMore = el('div', 'more', '&#9662;', U.dlgBody);
    U.dlgChoices = el('div', 'choices', null, U.dlgBody);
    U.screenRoot = el('div', 'screens', null, U.root);
    U.fadeEl = el('div', 'uifade', null, U.root);
    U.toasts = el('div', 'toasts', null, U.root);
    makePaper();
    bindDialogue();
    BTS.Events.on('language', function (l) { setLang(); U.refresh(); });
    setLang();
    BTS.Events.on('clue', function (id, def, promoted) {
      var key = promoted ? 'ui.toast_promoted' : def.cat === 'hyp' ? 'ui.toast_hyp' : def.cat === 'fact' ? 'ui.toast_fact' : 'ui.toast_obs';
      U.toast(t(key, { name: t(def.title) }), 'clue');
      BTS.Audio.play(def.cat === 'hyp' ? 'hypothesis' : 'clue');
    });
    BTS.Events.on('item', function (id, added) { if (added) { U.toast(t('ui.toast_item', { name: t(BTS.Data.items[id].name) }), 'item'); BTS.Audio.play('pickup'); } });
    BTS.Events.on('saved', function (slot) { U.toast(t(slot === 'auto' ? 'ui.toast_autosaved' : 'ui.toast_saved'), 'save'); if (slot !== 'auto') BTS.Audio.play('save'); });
    BTS.Events.on('map', function (area) { if (BTS.Game && BTS.Game.started) { U.toast(t('ui.toast_map', { name: t(area.indexOf('p_') === 0 ? 'map.' + area : 'area.' + area) }), 'map'); BTS.Audio.play('paper', {}); } });
    document.addEventListener('mousemove', function () { document.body.classList.remove('kbnav'); });
    document.addEventListener('keydown', function () { document.body.classList.add('kbnav'); });
  };

  /* <html lang> follows the game language: CSS uses it to tune the display fonts, which only cover Latin */
  function setLang() { var l = (BTS.I18N && BTS.I18N.lang) || 'ru'; document.documentElement.lang = l; }

  /* procedural paper texture for panels (data URL in a CSS variable) */
  function makePaper() {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var g = c.getContext('2d'), img = g.createImageData(128, 128);
    for (var i = 0; i < 128 * 128; i++) {
      var x = i % 128, y = (i / 128) | 0;
      var n = BTS.M.fbm(x / 9, y / 9, 3) * 0.6 + Math.random() * 0.4;
      var v = 214 + n * 30;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v - 10; img.data[i * 4 + 2] = v - 30; img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    document.documentElement.style.setProperty('--paper', 'url(' + c.toDataURL() + ')');
    var w = document.createElement('canvas'); w.width = w.height = 64;
    var wg = w.getContext('2d'), wi = wg.createImageData(64, 64);
    for (i = 0; i < 64 * 64; i++) {
      x = i % 64; y = (i / 64) | 0;
      var gr = Math.sin(y * 0.9 + Math.sin(x * 0.12) * 3) * 0.5 + 0.5;
      var vv = 34 + gr * 14 + Math.random() * 6;
      wi.data[i * 4] = vv; wi.data[i * 4 + 1] = vv * 0.78; wi.data[i * 4 + 2] = vv * 0.62; wi.data[i * 4 + 3] = 255;
    }
    wg.putImageData(wi, 0, 0);
    document.documentElement.style.setProperty('--wood', 'url(' + w.toDataURL() + ')');
  }

  /* ---------------- screen stack & focus navigation ---------------- */
  U.push = function (screen) {
    var top = U.top(); if (top) top.el.classList.add('hidden');
    U.screenRoot.appendChild(screen.el);
    screen.el.classList.add('screen');
    U.stack.push(screen);
    U.focusFirst(screen);
    BTS.Events.emit('screen', screen.name, true);
    return screen;
  };
  U.pop = function () {
    var s = U.stack.pop(); if (!s) return;
    if (s.onClose) s.onClose();
    s.el.remove();
    var top = U.top(); if (top) { top.el.classList.remove('hidden'); if (top.refresh) top.refresh(); U.focusFirst(top, top.lastFocus); }
    BTS.Events.emit('screen', s.name, false);
  };
  U.closeAll = function () { while (U.stack.length) U.pop(); };
  U.top = function () { return U.stack[U.stack.length - 1]; };
  U.isOpen = function (name) { return U.stack.some(function (s) { return !name || s.name === name; }); };
  function navItems(s) { return Array.prototype.slice.call(s.el.querySelectorAll('.nav')).filter(function (e) { return !e.disabled && e.offsetParent !== null; }); }
  U.focusFirst = function (s, prefer) {
    var items = navItems(s);
    var f = prefer && items.indexOf(prefer) >= 0 ? prefer : items[0];
    U.setFocus(s, f);
  };
  U.setFocus = function (s, f) {
    if (s.focus) s.focus.classList.remove('focus');
    s.focus = f; s.lastFocus = f;
    if (f) { f.classList.add('focus'); if (f.scrollIntoView) f.scrollIntoView({ block: 'nearest' }); }
  };
  /* mouse hover moves focus too */
  U.bindNav = function (s, e) {
    e.classList.add('nav');
    e.addEventListener('mouseenter', function () { if (!e.disabled && U.top() === s) U.setFocus(s, e); });
    return e;
  };
  /* button helper: states normal/focus/pressed/disabled are styled in CSS */
  U.button = function (s, parent, label, fn, o) {
    o = o || {};
    var b = el('button', 'btn ' + (o.cls || ''), esc(label), parent);
    b.type = 'button';
    if (o.disabled) b.disabled = true;
    U.bindNav(s, b);
    b.addEventListener('click', function () {
      if (b.disabled) { BTS.Audio.play('ui_denied'); return; }
      BTS.Audio.play(o.sound || 'ui_confirm');
      fn(b);
    });
    return b;
  };
  function pressFlash(e) { e.classList.add('pressed'); setTimeout(function () { e.classList.remove('pressed'); }, 120); }

  U.update = function (dt) {
    var I = BTS.Input;
    var s = U.top();
    if (s) {
      if (s.update) s.update(dt);
      var items = navItems(s);
      var i = items.indexOf(s.focus);
      if (i < 0 && items.length) { U.setFocus(s, items[0]); i = 0; }
      var cols = s.cols || 1;
      if (I.pressed.down) { U.setFocus(s, items[Math.min(items.length - 1, i + cols)]); BTS.Audio.play('ui_move'); }
      if (I.pressed.up) { U.setFocus(s, items[Math.max(0, i - cols)]); BTS.Audio.play('ui_move'); }
      if (I.pressed.left || I.pressed.right) {
        var d = I.pressed.left ? -1 : 1;
        if (s.focus && s.focus.adjust) { s.focus.adjust(d); BTS.Audio.play('ui_move'); }
        else if (s.onTab) s.onTab(d);
        else if (cols > 1) { U.setFocus(s, items[BTS.M.clamp(i + d, 0, items.length - 1)]); BTS.Audio.play('ui_move'); }
      }
      if (I.pressed.interact && s.focus) { pressFlash(s.focus); s.focus.click(); }
      if (I.pressed.cancel) { if (s.onBack) { BTS.Audio.play('ui_back'); s.onBack(); } }
      I.consume('interact'); I.consume('cancel'); I.consume('pause');
      return true;
    }
    return false;
  };

  /* ---------------- HUD ---------------- */
  U.setObjective = function (key) {
    U.objectiveKey = key;
    U.objective.innerHTML = key ? '<span class="lbl">' + esc(t('ui.objective')) + '</span> ' + U.fmt(t(key)) : '';
    U.objective.classList.toggle('show', !!key);
    if (key) { U.objective.classList.add('flash'); setTimeout(function () { U.objective.classList.remove('flash'); }, 1600); }
  };
  U.showBanner = function (text) {
    if (U.card.classList.contains('show')) return;
    U.banner.textContent = text;
    U.banner.classList.remove('show'); void U.banner.offsetWidth; U.banner.classList.add('show');
  };
  U.toast = function (text, kind) {
    var e = el('div', 'toast ' + (kind || ''), esc(text), U.toasts);
    setTimeout(function () { e.classList.add('out'); }, 3600);
    setTimeout(function () { e.remove(); }, 4300);
    while (U.toasts.children.length > 3) U.toasts.firstChild.remove();
  };
  U.caption = function (key, o) {
    if (!BTS.Config.get('subtitles') && !(o && o.force)) return;
    if (o && o.x !== undefined && BTS.Camera) { var c = BTS.Camera.target; if (Math.hypot(o.x - c[0], o.z - c[2]) > (o.range || 60) * 0.8) return; }
    var e = el('div', 'cap', '[' + esc(t(key)) + ']', U.captions);
    setTimeout(function () { e.classList.add('out'); }, 2600);
    setTimeout(function () { e.remove(); }, 3200);
    while (U.captions.children.length > 3) U.captions.firstChild.remove();
  };
  U.letterbox = function (on) { U.root.classList.toggle('cine', !!on); };
  /* chapter card: "Глава 7. Дом Яглики" / "Prologue. The Fair" is split into a small kicker and a big title */
  U.chapterTitle = function (key, subKey) {
    var full = t(key), m = /^([^.]{2,24})\.\s+(.+)$/.exec(full);
    var kick = m ? m[1] : '', head = m ? m[2] : full;
    U.card.innerHTML = '<div class="cbox">' + (kick ? '<div class="ck">' + esc(kick) + '</div>' : '') +
      '<div class="ct">' + esc(head) + '</div><div class="corn"><i></i><b></b><i></i></div>' +
      (subKey ? '<div class="cs">' + esc(t(subKey)) + '</div>' : '') + '</div>';
    U.card.classList.remove('show'); void U.card.offsetWidth; U.card.classList.add('show');
    return new Promise(function (res) { setTimeout(function () { U.card.classList.remove('show'); setTimeout(res, 900); }, 3600); });
  };
  U.updateHUD = function () {
    var W = BTS.World, it = W.focusInteract;
    var showPrompt = it && !BTS.Dialogue.active && !U.stack.length && !BTS.Cutscene.running && BTS.Game && BTS.Game.started;
    if (showPrompt) {
      var x = it.ent ? it.ent.x : it.x, z = it.ent ? it.ent.z : it.z, y = (it.ent ? it.ent.y : it.y) + (it.hy || 1.6) + 0.6;
      var sp = BTS.Camera.toScreen(x, y, z);
      if (sp) {
        var key = BTS.Input.lastDevice === 'touch' || (BTS.Touch && BTS.Touch.enabled && BTS.Input.lastDevice !== 'kb') ? '✋' : BTS.Input.lastDevice === 'pad' ? 'A' : BTS.Input.keyName(BTS.Config.get('keys').interact[0]);
        var html = '<b>' + esc(key) + '</b> ' + esc(t(it.verb || 'verb.examine')) + (it.label ? ' · ' + esc(t(it.label)) : '');
        if (U.prompt._html !== html) { U.prompt.innerHTML = html; U.prompt._html = html; }
        var pw = U.prompt.offsetWidth || 120, vw = window.innerWidth;
        var px = Math.max(pw / 2 + 8, Math.min(vw - pw / 2 - 8, sp[0])), py = Math.max(40, sp[1]);
        U.prompt.style.transform = 'translate(' + Math.round(px) + 'px,' + Math.round(py) + 'px) translate(-50%,-100%)';
        U.prompt.classList.add('show');
      }
    } else U.prompt.classList.remove('show');
    var game = BTS.Game && BTS.Game.started && !U.stack.length;
    U.hud.classList.toggle('off', !game);
    U.objective.classList.toggle('hidden', !!BTS.Cutscene.running || BTS.Dialogue.active);
    if (BTS.NameTags) BTS.NameTags.update(BTS.App.dt);
    U.captions.style.bottom = (BTS.Dialogue.active ? (U.dlg.offsetHeight + 40) : 60) + 'px';
    if (game && !BTS.Cutscene.running && !BTS.Dialogue.active && !(BTS.Story && BTS.Story.cardActive) && !(BTS.Touch && BTS.Touch.enabled)) {
      var ks = BTS.Config.get('keys'), kn = BTS.Input.keyName;
      var pad = BTS.Input.lastDevice === 'pad';
      var hk = (pad ? 'Y' : esc(kn(ks.journal[0]))) + ' ' + esc(t('ui.journal')) + ' · ' + (pad ? 'Back' : esc(kn(ks.map[0]))) + ' ' + esc(t('ui.map')) + ' · ' + (pad ? 'LT' : esc(kn(ks.inventory[0]))) + ' ' + esc(t('ui.inventory')) + ' · ' + (pad ? 'X' : esc(kn(ks.observe[0]))) + ' ' + esc(t('ui.observe')) + ' · ' + (pad ? 'Start' : esc(kn(ks.pause[0]))) + ' ' + esc(t('ui.pause'));
      if (U.hintKeys._html !== hk) { U.hintKeys.innerHTML = hk; U.hintKeys._html = hk; }
      U.hintKeys.classList.remove('hidden');
    } else U.hintKeys.classList.add('hidden');
  };
  U.refresh = function () {
    U.setObjective(U.objectiveKey);
    U.stack.forEach(function (s) { if (s.refresh) s.refresh(); });
    if (U.dlgState && U.dlgState.line) renderLine(U.dlgState.line, true);
    if (U.dlgState && U.dlgState.choices) renderChoices(U.dlgState.choices);
    U.prompt._html = null; U.hintKeys._html = null;
  };

  /* ---------------- dialogue box ---------------- */
  var CPS = [24, 42, 75, 100000];
  function bindDialogue() {
    U.dlgState = null;
    BTS.Events.on('dlg_start', function () { U.dlgState = { line: null }; U.dlg.classList.add('show'); });
    BTS.Events.on('dlg_end', function () { U.dlg.classList.remove('show'); U.dlgState = null; U.dlgChoices.innerHTML = ''; });
    BTS.Events.on('dlg_line', function (line) { renderLine(line); });
    BTS.Events.on('dlg_pause', function () { U.dlgText.innerHTML = ''; U.dlgName.textContent = ''; U.dlgMore.classList.remove('show'); U.dlg.className = 'dialogue show pause'; });
    BTS.Events.on('dlg_choice', function (opts) { renderChoices(opts); });
    U.dlg.addEventListener('click', function (e) { if (e.target.closest('.choice')) return; advance(); });
  }
  function renderLine(line, keepProgress) {
    var st = U.dlgState; if (!st) return;
    st.line = line; st.choices = null;
    U.dlgChoices.innerHTML = '';
    var text = t(line.key);
    st.full = text; if (!keepProgress) st.shown = 0;
    U.dlg.className = 'dialogue show ' + line.kind;
    var who = line.speaker, pr = line.kind === 'line' ? BTS.Portraits.get(who, line.portrait) : (line.kind === 'thought' ? BTS.Portraits.get('djordje', line.portrait || 'neutral') : null);
    U.dlgPortrait.style.backgroundImage = pr ? 'url(' + pr + ')' : 'none';
    U.dlgPortrait.classList.toggle('none', !pr);
    var people = BTS.Data.people;
    U.dlgName.textContent = line.kind === 'line' ? t((people[who] || people.villager).name) : line.kind === 'thought' ? t('ui.thought') : '';
    st.speed = CPS[BTS.Config.get('textSpeed')] || 42;
    if (keepProgress) st.shown = st.full.length;
    st.acc = 0;
    U.dlgMore.classList.remove('show');
    drawText();
    if (line.shake) { U.dlg.classList.add('shake'); setTimeout(function () { U.dlg.classList.remove('shake'); }, 500); }
  }
  function drawText() {
    var st = U.dlgState; if (!st) return;
    var n = Math.floor(st.shown);
    U.dlgText.innerHTML = U.fmt(st.full.slice(0, n)) + '<span class="ghost">' + U.fmt(st.full.slice(n)) + '</span>';
    U.dlgMore.classList.toggle('show', n >= st.full.length && !st.choices);
  }
  function renderChoices(opts) {
    var st = U.dlgState; if (!st) return;
    st.choices = opts;
    st.shown = st.full ? st.full.length : 0; drawText();
    U.dlgMore.classList.remove('show');
    U.dlgChoices.innerHTML = '';
    st.choiceEls = opts.map(function (o, idx) {
      var b = el('button', 'choice btn', U.fmt(t(o.key)), U.dlgChoices);
      b.type = 'button';
      b.addEventListener('mouseenter', function () { st.choiceFocus = idx; markChoice(); });
      b.addEventListener('click', function () { BTS.Audio.play('ui_confirm'); BTS.Dialogue.choose(o.i); });
      return b;
    });
    st.choiceFocus = 0; markChoice();
  }
  function markChoice() { var st = U.dlgState; (st.choiceEls || []).forEach(function (b, i) { b.classList.toggle('focus', i === st.choiceFocus); }); }
  function advance() {
    var st = U.dlgState; if (!st || st.choices) return;
    if (!st.line) return;
    if (st.shown < st.full.length) { st.shown = st.full.length; drawText(); return; }
    BTS.Dialogue.next();
  }
  U.updateDialogue = function (dt) {
    var st = U.dlgState; if (!st) return false;
    var I = BTS.Input;
    if (st.choices) {
      if (I.pressed.down) { st.choiceFocus = Math.min(st.choices.length - 1, st.choiceFocus + 1); markChoice(); BTS.Audio.play('ui_move'); }
      if (I.pressed.up) { st.choiceFocus = Math.max(0, st.choiceFocus - 1); markChoice(); BTS.Audio.play('ui_move'); }
      if (I.pressed.interact) { BTS.Audio.play('ui_confirm'); BTS.Dialogue.choose(st.choices[st.choiceFocus].i); }
    } else if (st.line && st.full) {
      if (st.shown < st.full.length) {
        var before = Math.floor(st.shown);
        st.shown = Math.min(st.full.length, st.shown + st.speed * dt);
        var after = Math.floor(st.shown);
        if (after !== before) {
          drawText();
          if (st.line.kind === 'line' && st.speed < 1000 && Math.floor(after / 3) !== Math.floor(before / 3) && /\S/.test(st.full[after - 1] || '')) {
            var pp = BTS.Data.people[st.line.speaker]; BTS.Audio.play('voice', { pitch: pp ? pp.voice : 1, vol: 0.8 });
          }
        }
      }
      if (I.pressed.interact) advance();
    }
    I.consume('interact');
    return true;
  };
  return U;
})();
