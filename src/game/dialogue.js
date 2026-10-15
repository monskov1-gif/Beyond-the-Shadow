/* Data-driven dialogue runner. Scripts live in data/dialogues; text lives in locale dictionaries
   under 'dlg.<dialogueId>.<key>'. Supports speakers, thoughts, action descriptions, pauses,
   conditional choices, effects, labels/goto, and guards against missing nodes and infinite loops. */
'use strict';
BTS.Cond = {
  /* 'flag:x' '!flag:x' 'clue:x' 'item:x' 'beat:x' 'after:x' 'before:x' 'dead:x' 'done:x' 'lang:ru', joined with '&' */
  eval: function (c) {
    if (!c) return true;
    if (typeof c === 'function') return !!c(BTS.State);
    return String(c).split('&').every(function (part) {
      part = part.trim(); var neg = false;
      if (part[0] === '!') { neg = true; part = part.slice(1); }
      var i = part.indexOf(':'), k = part.slice(0, i), v = part.slice(i + 1), r;
      var S = BTS.State;
      switch (k) {
        case 'flag': r = S.flag(v); break;
        case 'clue': r = S.hasClue(v); break;
        case 'item': r = S.hasItem(v); break;
        case 'beat': r = S.d.beat === v; break;
        case 'after': r = BTS.Story.indexOf(S.d.beat) >= BTS.Story.indexOf(v); break;
        case 'before': r = BTS.Story.indexOf(S.d.beat) < BTS.Story.indexOf(v); break;
        case 'dead': r = S.isDead(v); break;
        case 'done': r = S.done(v); break;
        case 'time': r = BTS.Env.timeName() === v; break;
        default: BTS.Log.warn('bad condition', part); r = false;
      }
      return neg ? !r : r;
    });
  }
};

BTS.Dialogue = (function () {
  var D = { active: false, speakingId: null, current: null };
  var MAX_STEPS = 400;

  D.exists = function (id) { return !!BTS.Data.dialogues[id]; };
  D.start = function (id, opts) {
    opts = opts || {};
    var script = BTS.Data.dialogues[id];
    return new Promise(function (resolve) {
      if (!script) { BTS.Log.error('missing dialogue', id); resolve('missing'); return; }
      if (D.active) { BTS.Log.warn('dialogue already active, queue', id); }
      var labels = {};
      script.forEach(function (s, i) { if (s && s.label) labels[s.label] = i; });
      D.current = { id: id, script: script, pc: 0, labels: labels, resolve: resolve, steps: 0, opts: opts, history: [] };
      D.active = true;
      BTS.Audio.setDuck(1);
      BTS.Events.emit('dlg_start', id, opts);
      run();
    });
  };
  function key(c, k) { return k.indexOf('.') >= 0 ? k : 'dlg.' + c.id + '.' + k; }
  function end(reason) {
    var c = D.current; if (!c) return;
    D.active = false; D.current = null; D.speakingId = null;
    BTS.Audio.setDuck(0);
    BTS.Events.emit('dlg_end', c.id);
    c.resolve(reason || 'end');
  }
  D.abort = function () { end('abort'); };

  function run() {
    var c = D.current;
    while (c && D.current === c) {
      if (++c.steps > MAX_STEPS) { BTS.Log.error('dialogue step limit (loop?)', c.id); end('loop'); return; }
      if (c.pc >= c.script.length) { end(); return; }
      var s = c.script[c.pc];
      if (Array.isArray(s)) {
        var sp = s[0], arg = s[1], o = s[2] || {};
        if (o.if && !BTS.Cond.eval(o.if)) { c.pc++; continue; }
        if (sp === '~') { c.pc++; BTS.Events.emit('dlg_pause', arg); D.waitPause = setTimeout(function () { if (D.current === c) run(); }, arg * 1000); return; }
        var kind = sp === '>' ? 'thought' : sp === '*' ? 'action' : 'line';
        var speaker = kind === 'line' ? (sp === 'dj' ? 'djordje' : sp) : (kind === 'thought' ? 'djordje' : null);
        D.speakingId = kind === 'line' ? speaker : null;
        c.waiting = true;
        c.pc++;
        BTS.Events.emit('dlg_line', { kind: kind, speaker: speaker, key: key(c, arg), portrait: o.p, anim: o.anim, sfx: o.sfx, shake: o.shake });
        if (o.sfx) BTS.Audio.play(o.sfx);
        if (o.do) D.effect(o.do);
        return;
      }
      if (s.label) { c.pc++; continue; }
      if (s.goto) { if (c.labels[s.goto] === undefined) { BTS.Log.error('missing label', s.goto, 'in', c.id); end('missing'); return; } c.pc = c.labels[s.goto] + 1; continue; }
      if (s.end) { end(); return; }
      if (s.if) {
        var ok = BTS.Cond.eval(s.if);
        var target = ok ? s.then : s.else;
        if (target) { if (c.labels[target] === undefined) { BTS.Log.error('missing label', target, c.id); end('missing'); return; } c.pc = c.labels[target] + 1; }
        else c.pc++;
        continue;
      }
      if (s.choice) {
        var opts = s.choice.map(function (ch, i) { return { i: i, key: key(c, ch[0]), target: ch[1], cond: ch[2] && ch[2].if, effect: ch[2] && ch[2].do, once: ch[2] && ch[2].once }; })
          .filter(function (o) { return BTS.Cond.eval(o.cond) && !(o.once && BTS.State.flag('chose.' + c.id + '.' + o.key)); });
        if (!opts.length) { c.pc++; continue; }
        c.choices = opts; c.waiting = true;
        BTS.Events.emit('dlg_choice', opts);
        return;
      }
      D.effect(s);
      c.pc++;
    }
  }
  /* effects usable from dialogue nodes and choices */
  D.effect = function (s) {
    var S = BTS.State;
    if (s.set) { if (typeof s.set === 'string') S.set(s.set); else for (var k in s.set) S.set(k, s.set[k]); }
    if (s.clue) [].concat(s.clue).forEach(function (id) { S.addClue(id); });
    if (s.promote) S.promote(s.promote[0], s.promote[1]);
    if (s.item) [].concat(s.item).forEach(function (id) { S.addItem(id); });
    if (s.remove) S.removeItem(s.remove);
    if (s.itemState) S.itemState(s.itemState[0], s.itemState[1]);
    if (s.call) { var fn = BTS.Story.calls[s.call]; if (fn) fn(s.args); else BTS.Log.warn('missing call', s.call); }
    if (s.sfx) BTS.Audio.play(s.sfx);
    if (s.music) BTS.Music.set(s.music);
    if (s.anim) { var e = BTS.World.get(s.anim[0]) || (s.anim[0] === 'djordje' ? BTS.World.player : null); if (e && e.anim) e.anim.lock = s.anim[1] || null; }
  };
  D.next = function () {
    var c = D.current; if (!c || !c.waiting || c.choices) return;
    c.waiting = false; c.steps = 0;
    run();
  };
  D.choose = function (i) {
    var c = D.current; if (!c || !c.choices) return;
    var o = c.choices.filter(function (x) { return x.i === i; })[0] || c.choices[0];
    c.choices = null; c.waiting = false; c.steps = 0;
    BTS.State.set('chose.' + c.id + '.' + o.key);
    BTS.Events.emit('dlg_chosen', o);
    if (o.effect) D.effect(o.effect);
    c.pc++;
    if (o.target) {
      if (c.labels[o.target] === undefined) { BTS.Log.error('missing label', o.target, c.id); end('missing'); return; }
      c.pc = c.labels[o.target] + 1;
    }
    run();
  };
  /* static validation of all dialogues: labels, keys, speakers, step graph without exits */
  D.validate = function () {
    var errors = [], keys = [];
    var people = BTS.Data.people;
    Object.keys(BTS.Data.dialogues).forEach(function (id) {
      var sc = BTS.Data.dialogues[id], labels = {};
      sc.forEach(function (s) { if (s && s.label) labels[s.label] = true; });
      sc.forEach(function (s, i) {
        if (Array.isArray(s)) {
          if (s[0] !== '~') { var k = s[1].indexOf('.') >= 0 ? s[1] : 'dlg.' + id + '.' + s[1]; keys.push(k); }
          if (s[0] !== '~' && s[0] !== '>' && s[0] !== '*' && s[0] !== 'dj' && !people[s[0]]) errors.push(id + ': unknown speaker ' + s[0]);
        } else if (s.goto && !labels[s.goto]) errors.push(id + ': missing label ' + s.goto);
        else if (s.choice) s.choice.forEach(function (ch) { keys.push(ch[0].indexOf('.') >= 0 ? ch[0] : 'dlg.' + id + '.' + ch[0]); if (ch[1] && !labels[ch[1]]) errors.push(id + ': choice to missing label ' + ch[1]); });
        else if (s.if && ((s.then && !labels[s.then]) || (s.else && !labels[s.else]))) errors.push(id + ': if to missing label');
        else if (s.clue) [].concat(s.clue).forEach(function (c) { if (!BTS.Data.clues[c]) errors.push(id + ': unknown clue ' + c); });
        else if (s.item) [].concat(s.item).forEach(function (c) { if (!BTS.Data.items[c]) errors.push(id + ': unknown item ' + c); });
      });
      // a goto that jumps backwards with no choice/input in between is an infinite loop
      sc.forEach(function (s, i) {
        if (s && s.goto) {
          var t = sc.findIndex(function (x) { return x && x.label === s.goto; });
          if (t >= 0 && t < i) { var hasInput = sc.slice(t, i).some(function (x) { return Array.isArray(x) || (x && x.choice); }); if (!hasInput) errors.push(id + ': loop without input at ' + i); }
        }
      });
    });
    return { errors: errors, keys: keys };
  };
  return D;
})();
