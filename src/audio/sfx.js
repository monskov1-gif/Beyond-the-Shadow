/* Synthesised sound effects. Each returns its duration. o: {x,z,vol,pitch,surface} */
'use strict';
BTS.SFX = (function () {
  var A = BTS.Audio;
  var S = {};
  S.cats = {};
  S.captions = {   // localization keys for sound captions (subtitles for non-speech audio)
    bell: 'cap.bell', thunder: 'cap.thunder', whisper: 'cap.whisper', dog_bark: 'cap.dog', door_knock: 'cap.knock',
    shadow_tear: 'cap.tear', shadow_release: 'cap.release', scream_far: 'cap.scream', crow: 'cap.crow', shutter: 'cap.shutter', footsteps_other: 'cap.steps'
  };
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function burst(t, o, bus, f, q, type, a, peak, rel, kind, rate) {
    var out = A.out(bus || 'sfx', o); if (!out) return null;
    var g = A.gain(0, out);
    var fl = A.filter(type || 'bandpass', f, q, g);
    A.noiseSrc(kind || 'white', t, a + rel + 0.05, fl, rate);
    A.env(g.gain, t, a, peak, 0, rel);
    return fl;
  }
  function tone(t, o, bus, type, f, a, peak, rel, f2, out2) {
    var out = out2 || A.out(bus || 'sfx', o); if (!out) return null;
    var g = A.gain(0, out);
    var osc = A.osc(type, f, t, a + rel, g);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + a + rel);
    A.env(g.gain, t, a, peak, 0, rel);
    return osc;
  }

  /* ---------- footsteps by surface ---------- */
  S.step = function (t, o) {
    var s = o.surface || 'dirt', p = (o.pitch || 1) * rnd(0.9, 1.1), v = (o.vol || 1) * 0.5;
    o.vol = v; o.reverb = o.reverb === undefined ? 0.6 : o.reverb;
    if (s === 'stone') { burst(t, o, 'sfx', 2200 * p, 1.2, 'bandpass', 0.002, 0.5, 0.05); burst(t, o, 'sfx', 600 * p, 1, 'lowpass', 0.003, 0.35, 0.05); }
    else if (s === 'wood') { tone(t, o, 'sfx', 'sine', 110 * p, 0.004, 0.45, 0.08, 70); burst(t, o, 'sfx', 450 * p, 2, 'bandpass', 0.003, 0.3, 0.07); if (Math.random() < 0.12) S.creak(t + 0.05, { vol: 0.25, x: o.x, z: o.z }); }
    else if (s === 'mud') { burst(t, o, 'sfx', 380 * p, 3, 'bandpass', 0.01, 0.55, 0.12, 'brown'); var f = burst(t + 0.03, o, 'sfx', 600, 4, 'bandpass', 0.02, 0.25, 0.08); if (f) f.frequency.exponentialRampToValueAtTime(1300, t + 0.12); }
    else if (s === 'grass') { burst(t, o, 'sfx', 3200 * p, 0.6, 'bandpass', 0.01, 0.35, 0.09); burst(t, o, 'sfx', 500 * p, 1, 'lowpass', 0.005, 0.25, 0.06); }
    else { burst(t, o, 'sfx', 900 * p, 0.8, 'lowpass', 0.004, 0.55, 0.07, 'pink'); burst(t, o, 'sfx', 2600 * p, 1, 'bandpass', 0.002, 0.15, 0.04); }
    return 0.15;
  };
  S.cats.step = 'step';
  ['bird', 'dog_bark', 'crow', 'fire_pop', 'rooster', 'sheep', 'shutter'].forEach(function (n) { S.cats[n] = 'ambient'; });
  S.footsteps_other = function (t, o) { S.step(t, o); S.step(t + 0.45, o); S.step(t + 0.9, o); return 1.2; };
  S.step_distorted = function (t, o) { o.pitch = 0.55; o.reverb = 2; S.step(t, o); S.step(t + 0.23, { surface: o.surface, pitch: 0.5, vol: 0.4, x: o.x, z: o.z, reverb: 2 }); return 0.5; };

  /* ---------- doors & interiors ---------- */
  S.creak = function (t, o) {
    var out = A.out('sfx', o); if (!out) return 0.6;
    var g = A.gain(0, out), bp = A.filter('bandpass', 900, 6, g);
    var osc = A.osc('sawtooth', rnd(70, 110), t, 0.7, bp);
    osc.frequency.linearRampToValueAtTime(rnd(120, 180), t + 0.5);
    var lfo = A.ctx.createOscillator(); lfo.frequency.value = rnd(18, 30); var lg = A.gain(25, osc.frequency); lfo.connect(lg); lfo.start(t); lfo.stop(t + 0.7);
    bp.frequency.linearRampToValueAtTime(1500, t + 0.6);
    A.env(g.gain, t, 0.08, 0.22 * (o.vol || 1), 0.3, 0.25);
    return 0.7;
  };
  S.door_open = function (t, o) { S.creak(t, o); burst(t, o, 'sfx', 1800, 3, 'bandpass', 0.002, 0.3, 0.04); return 0.8; };
  S.door_close = function (t, o) { burst(t, o, 'sfx', 260, 1, 'lowpass', 0.004, 0.9, 0.25, 'brown'); burst(t + 0.01, o, 'sfx', 2000, 4, 'bandpass', 0.002, 0.25, 0.05); return 0.4; };
  S.door_knock = function (t, o) { for (var i = 0; i < 3; i++) burst(t + i * 0.22, o, 'sfx', 420, 2, 'bandpass', 0.003, 0.9, 0.09, 'brown'); return 0.8; };
  S.drawer = function (t, o) { var f = burst(t, o, 'sfx', 1400, 2, 'bandpass', 0.05, 0.3, 0.3); if (f) f.frequency.exponentialRampToValueAtTime(600, t + 0.35); burst(t + 0.35, o, 'sfx', 500, 1, 'lowpass', 0.003, 0.5, 0.08); return 0.5; };
  S.paper = function (t, o) { for (var i = 0; i < 3; i++) burst(t + i * 0.06 + rnd(0, 0.03), o, 'sfx', rnd(3500, 6000), 0.7, 'highpass', 0.005, 0.2 * (o.vol || 1), 0.05); return 0.3; };
  S.page = function (t, o) { var f = burst(t, o, 'ui', 2500, 0.5, 'bandpass', 0.06, 0.25, 0.15); if (f) f.frequency.exponentialRampToValueAtTime(6000, t + 0.2); return 0.3; };
  S.glass = function (t, o) { [2210, 3390, 5120].forEach(function (f, i) { tone(t, o, 'sfx', 'sine', f * rnd(0.98, 1.02), 0.002, 0.12 / (i + 1), 0.5); }); return 0.6; };
  S.pottery = function (t, o) { tone(t, o, 'sfx', 'triangle', 880, 0.002, 0.2, 0.12); tone(t, o, 'sfx', 'sine', 1460, 0.002, 0.12, 0.1); burst(t, o, 'sfx', 1200, 1, 'bandpass', 0.002, 0.3, 0.06); return 0.3; };
  S.cloth = function (t, o) { burst(t, o, 'sfx', 3000, 0.4, 'bandpass', 0.12, 0.12 * (o.vol || 1), 0.3, 'pink'); return 0.5; };
  S.breath = function (t, o) { burst(t, o, 'sfx', 900, 0.7, 'bandpass', 0.6, 0.18 * (o.vol || 1), 0.9, 'pink'); return 1.6; };
  S.metal = function (t, o) { [520, 1340, 2210].forEach(function (f) { tone(t, o, 'sfx', 'sine', f * rnd(0.97, 1.03), 0.002, 0.12, 0.8); }); return 0.9; };
  S.anvil = function (t, o) { [880, 2350, 3900].forEach(function (f) { tone(t, o, 'sfx', 'sine', f, 0.001, 0.2, 1.1); }); burst(t, o, 'sfx', 3000, 1, 'highpass', 0.001, 0.4, 0.04); return 1.2; };
  S.chop = function (t, o) { burst(t, o, 'sfx', 700, 1, 'lowpass', 0.002, 0.9, 0.12, 'brown'); burst(t, o, 'sfx', 2400, 2, 'bandpass', 0.001, 0.4, 0.05); return 0.3; };
  S.shutter = function (t, o) { burst(t, o, 'sfx', 1200, 1, 'lowpass', 0.002, 1.0, 0.18); burst(t + 0.09, o, 'sfx', 800, 1, 'lowpass', 0.002, 0.5, 0.12); return 0.4; };
  S.water_splash = function (t, o) { burst(t, o, 'sfx', 1500, 0.8, 'bandpass', 0.01, 0.4, 0.35); return 0.5; };

  /* ---------- UI ---------- */
  S.ui_move = function (t, o) { tone(t, { vol: 0.6, reverb: 0 }, 'ui', 'sine', 1700, 0.002, 0.08, 0.04); return 0.06; };
  S.ui_confirm = function (t, o) { var out = A.out('ui', { reverb: 0.2 }); tone(t, null, 'ui', 'triangle', 660, 0.003, 0.18, 0.12, null, out); tone(t + 0.06, null, 'ui', 'triangle', 990, 0.003, 0.15, 0.2, null, out); return 0.3; };
  S.ui_back = function (t, o) { var out = A.out('ui', { reverb: 0.2 }); tone(t, null, 'ui', 'triangle', 880, 0.003, 0.15, 0.1, null, out); tone(t + 0.06, null, 'ui', 'triangle', 587, 0.003, 0.14, 0.18, null, out); return 0.3; };
  S.ui_open = function (t, o) { S.page(t, { vol: 0.8 }); return 0.3; };
  S.ui_denied = function (t, o) { tone(t, { reverb: 0 }, 'ui', 'square', 160, 0.003, 0.06, 0.12); return 0.2; };
  S.pickup = function (t, o) { var out = A.out('ui', { reverb: 0.5 }); [880, 1320, 1760].forEach(function (f, i) { tone(t + i * 0.05, null, 'ui', 'triangle', f, 0.003, 0.14, 0.5, null, out); }); return 0.7; };
  S.clue = function (t, o) { var out = A.out('ui', { reverb: 0.8 }); [587.3, 698.5, 880, 1174.7].forEach(function (f, i) { tone(t + i * 0.11, null, 'ui', 'sine', f, 0.004, 0.16, 1.2, null, out); }); return 1.5; };
  S.hypothesis = function (t, o) { var out = A.out('ui', { reverb: 1 }); [293.7, 440, 587.3, 659.3].forEach(function (f, i) { tone(t + i * 0.16, null, 'ui', 'triangle', f, 0.01, 0.13, 1.6, null, out); }); return 2; };
  S.journal = function (t, o) { S.page(t, o); return 0.3; };
  S.map_open = function (t, o) { for (var i = 0; i < 4; i++) burst(t + i * 0.08, { reverb: 0.2 }, 'ui', rnd(1500, 3500), 0.5, 'bandpass', 0.04, 0.2, 0.12, 'pink'); return 0.5; };
  S.save = function (t, o) { var out = A.out('ui', { reverb: 0.6 }); tone(t, null, 'ui', 'sine', 392, 0.01, 0.15, 0.9, null, out); tone(t + 0.12, null, 'ui', 'sine', 587.3, 0.01, 0.12, 1.1, null, out); return 1.2; };
  S.transition = function (t, o) { var f = burst(t, { reverb: 0.4 }, 'ui', 300, 1.2, 'bandpass', 0.4, 0.18, 0.6, 'pink'); if (f) f.frequency.exponentialRampToValueAtTime(2200, t + 0.8); return 1; };
  S.sketch = function (t, o) { for (var i = 0; i < 6; i++) burst(t + i * 0.09 + rnd(0, 0.04), { reverb: 0.1 }, 'ui', rnd(3000, 5000), 2, 'bandpass', 0.01, 0.12, 0.06); return 0.7; };
  S.voice = function (t, o) {   // dialogue murmur blip (pitch per speaker), subtle
    var out = A.out('voice', { reverb: 0.15, vol: o.vol || 1 }); if (!out) return 0.05;
    var f = 180 * (o.pitch || 1) * rnd(0.92, 1.12);
    var g = A.gain(0, out), bp = A.filter('bandpass', f * 4, 3, g);
    A.osc('sawtooth', f, t, 0.08, bp);
    A.env(g.gain, t, 0.008, 0.16, 0.02, 0.05);
    return 0.06;
  };
  S.cats.voice = 'ui';

  /* ---------- world ---------- */
  S.bell = function (t, o) {
    var out = A.out('sfx', { x: o.x, z: o.z, vol: (o.vol || 1) * 0.6, range: 140, reverb: 1.6, distanceLP: true }); if (!out) return 6;
    var f0 = 196 * (o.pitch || 1);
    [[1, 0.5, 7], [2.0, 0.28, 5], [2.4, 0.22, 4], [3.0, 0.16, 3.5], [4.16, 0.12, 2.5], [5.43, 0.08, 1.8], [0.5, 0.2, 8]].forEach(function (p) {
      tone(t, null, 'sfx', 'sine', f0 * p[0] * rnd(0.998, 1.002), 0.004, p[1], p[2], null, out);
    });
    burst(t, { x: o.x, z: o.z, vol: 0.3, range: 140 }, 'sfx', 3000, 1, 'bandpass', 0.001, 0.4, 0.05);
    return 7;
  };
  S.thunder = function (t, o) {
    var v = o.vol || 1;
    var out = A.out('ambience', { vol: v, reverb: 1.2 }); if (!out) return 5;
    var g = A.gain(0, out), lp = A.filter('lowpass', 420, 0.7, g);
    A.noiseSrc('brown', t, 5, lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1.1, t + 0.05); g.gain.exponentialRampToValueAtTime(0.4, t + 0.6);
    g.gain.linearRampToValueAtTime(0.8, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
    lp.frequency.exponentialRampToValueAtTime(140, t + 4);
    burst(t, { vol: v * 0.5 }, 'ambience', 1800, 0.5, 'bandpass', 0.003, 0.5, 0.25);
    return 5;
  };
  S.dog_bark = function (t, o) {
    var n = 1 + Math.floor(Math.random() * 3);
    for (var i = 0; i < n; i++) {
      var tt = t + i * rnd(0.25, 0.4);
      var out = A.out('sfx', { x: o.x, z: o.z, vol: (o.vol || 1) * 0.5, range: 60, reverb: 1 }); if (!out) return 1;
      var g = A.gain(0, out), bp = A.filter('bandpass', 900, 2, g);
      var osc = A.osc('sawtooth', 420, tt, 0.15, bp); osc.frequency.exponentialRampToValueAtTime(260, tt + 0.13);
      A.noiseSrc('white', tt, 0.12, bp);
      A.env(g.gain, tt, 0.01, 0.6, 0.03, 0.09);
    }
    return 1.2;
  };
  S.crow = function (t, o) {
    var out = A.out('sfx', { x: o.x, z: o.z, vol: (o.vol || 1) * 0.4, range: 60, reverb: 1 }); if (!out) return 1;
    for (var i = 0; i < 2; i++) {
      var tt = t + i * 0.32, g = A.gain(0, out), bp = A.filter('bandpass', 1300, 3, g);
      var osc = A.osc('sawtooth', 640, tt, 0.25, bp); osc.frequency.linearRampToValueAtTime(520, tt + 0.22);
      var m = A.ctx.createOscillator(); m.frequency.value = 90; var mg = A.gain(120, osc.frequency); m.connect(mg); m.start(tt); m.stop(tt + 0.3);
      A.env(g.gain, tt, 0.02, 0.5, 0.1, 0.1);
    }
    return 1;
  };
  S.bird = function (t, o) {
    var out = A.out('ambience', { x: o.x, z: o.z, vol: (o.vol || 1) * 0.18, range: 50, reverb: 0.6 }); if (!out) return 0.6;
    var n = 2 + Math.floor(Math.random() * 4), base = rnd(2600, 4200);
    for (var i = 0; i < n; i++) { var tt = t + i * rnd(0.07, 0.14); tone(tt, null, 'ambience', 'sine', base * rnd(0.9, 1.15), 0.005, 0.5, 0.06, base * rnd(1.1, 1.4), out); }
    return 0.8;
  };
  S.rooster = function (t, o) {
    var out = A.out('ambience', { x: o.x, z: o.z, vol: 0.3, range: 80 }); if (!out) return 2;
    var g = A.gain(0, out), bp = A.filter('bandpass', 1100, 2, g);
    var osc = A.osc('sawtooth', 520, t, 1.4, bp);
    osc.frequency.setValueAtTime(520, t); osc.frequency.linearRampToValueAtTime(780, t + 0.3); osc.frequency.setValueAtTime(760, t + 0.8); osc.frequency.linearRampToValueAtTime(500, t + 1.3);
    A.env(g.gain, t, 0.05, 0.4, 1.0, 0.25);
    return 1.6;
  };
  S.sheep = function (t, o) {
    var out = A.out('ambience', { x: o.x, z: o.z, vol: 0.35, range: 40 }); if (!out) return 1;
    var g = A.gain(0, out), bp = A.filter('bandpass', 700, 3, g);
    var osc = A.osc('sawtooth', 300, t, 0.8, bp);
    var l = A.ctx.createOscillator(); l.frequency.value = 22; var lg = A.gain(30, osc.frequency); l.connect(lg); l.start(t); l.stop(t + 0.8);
    A.env(g.gain, t, 0.05, 0.4, 0.4, 0.25);
    return 1;
  };
  S.drip = function (t, o) { tone(t, o, 'ambience', 'sine', rnd(1800, 2600), 0.001, 0.1 * (o.vol || 1), 0.06, rnd(900, 1200)); return 0.1; };
  S.murmur = function (t, o) { var n = 3 + Math.floor(Math.random() * 5), p0 = rnd(0.8, 1.3); for (var i = 0; i < n; i++) S.voice(t + i * rnd(0.08, 0.15), { pitch: p0 * rnd(0.9, 1.1), vol: (o.vol || 1) * 0.5 }); return n * 0.12; };
  S.laugh = function (t, o) { var p0 = rnd(1, 1.5); for (var i = 0; i < 4; i++) S.voice(t + i * 0.11, { pitch: p0 * (1.2 - i * 0.05), vol: (o.vol || 1) * 0.6 }); return 0.5; };
  S.cats.drip = 'ambient'; S.cats.murmur = 'ambient'; S.cats.laugh = 'ambient';
  S.fire_pop = function (t, o) { burst(t, o, 'sfx', 2500, 2, 'bandpass', 0.001, (o.vol || 1) * 0.5, 0.03); return 0.05; };
  S.match = function (t, o) { burst(t, o, 'sfx', 3000, 1, 'highpass', 0.01, 0.4, 0.2); burst(t + 0.15, o, 'sfx', 800, 0.5, 'lowpass', 0.2, 0.25, 0.8, 'pink'); return 1; };

  /* ---------- horror ---------- */
  S.drone = function (t, o) {
    var out = A.out('sfx', { vol: (o.vol || 1) * 0.5, reverb: 1.5 }); if (!out) return 6;
    var dur = o.dur || 6, g = A.gain(0, out), lp = A.filter('lowpass', 220, 1, g);
    A.osc('sine', 41.2, t, dur, lp); A.osc('sine', 41.9, t, dur, lp); A.osc('sawtooth', 55, t, dur, lp);
    A.noiseSrc('brown', t, dur, lp);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.7, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    return dur;
  };
  S.cats.drone = 'horror';
  S.whisper = function (t, o) {
    var dur = o.dur || rnd(1.2, 2.4);
    var pan = o.pan === undefined ? rnd(-0.8, 0.8) : o.pan;
    var dest = A.panner(pan, A.bus.sfx);
    var g = A.gain(0, dest); var s = A.gain(1.5, A.reverbSend); g.connect(s);
    var bp = A.filter('bandpass', 1500, 8, g), bp2 = A.filter('bandpass', 2600, 10, g);
    A.noiseSrc('white', t, dur, bp); A.noiseSrc('white', t, dur, bp2);
    var tt = t, formants = [[600, 1700], [400, 2300], [800, 1200], [300, 2600], [500, 1900]];
    g.gain.setValueAtTime(0.0001, t);
    while (tt < t + dur) { var f = formants[Math.floor(Math.random() * formants.length)]; bp.frequency.setTargetAtTime(f[0] * 2, tt, 0.02); bp2.frequency.setTargetAtTime(f[1], tt, 0.02); g.gain.setTargetAtTime(Math.random() < 0.25 ? 0.0001 : 0.09 * (o.vol || 1), tt, 0.015); tt += rnd(0.07, 0.16); }
    g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
    return dur;
  };
  S.cats.whisper = 'horror';
  S.heartbeat = function (t, o) { for (var i = 0; i < 2; i++) tone(t + i * 0.18, { vol: (o.vol || 1) * 0.6, reverb: 0.3 }, 'sfx', 'sine', 55, 0.01, 0.6, 0.15, 38); return 0.9; };
  S.sting_low = function (t, o) { tone(t, { vol: 0.5, reverb: 2 }, 'sfx', 'sawtooth', 36.7, 0.02, 0.3, 2.5, 34); burst(t, { vol: 0.4, reverb: 2 }, 'sfx', 160, 1, 'lowpass', 0.02, 0.6, 2, 'brown'); return 2.6; };
  S.scream_far = function (t, o) {
    var out = A.out('sfx', { vol: 0.25, reverb: 2.5 }); if (!out) return 2;
    var g = A.gain(0, out), bp = A.filter('bandpass', 1400, 4, g);
    var osc = A.osc('sawtooth', 700, t, 1.4, bp); osc.frequency.linearRampToValueAtTime(900, t + 0.3); osc.frequency.linearRampToValueAtTime(500, t + 1.3);
    A.env(g.gain, t, 0.1, 0.35, 0.6, 0.6);
    return 2;
  };

  /* ---------- shadows ---------- */
  S.shadow_detach = function (t, o) { var f = burst(t, { vol: 0.6, reverb: 1.5 }, 'sfx', 200, 4, 'bandpass', 0.8, 0.5, 0.5, 'pink'); if (f) f.frequency.exponentialRampToValueAtTime(1400, t + 1.2); tone(t, { vol: 0.4, reverb: 1 }, 'sfx', 'sine', 60, 0.5, 0.4, 0.8, 45); return 1.4; };
  S.shadow_move = function (t, o) { var out = A.out('sfx', { x: o.x, z: o.z, vol: (o.vol || 1) * 0.5, reverb: 1.2 }); if (!out) return 1.2; var g = A.gain(0, out), bp = A.filter('bandpass', 320, 2, g); A.noiseSrc('pink', t, 1.2, bp); var l = A.ctx.createOscillator(); l.frequency.value = 7; var lg = A.gain(0.25, g.gain); l.connect(lg); l.start(t); l.stop(t + 1.2); A.env(g.gain, t, 0.3, 0.35, 0.4, 0.4); return 1.2; };
  S.cats.shadow_move = 'shadow';
  S.shadow_stretch = function (t, o) { var out = A.out('sfx', { vol: 0.4, reverb: 1.4 }); if (!out) return 2; var g = A.gain(0, out), lp = A.filter('lowpass', 600, 6, g); var osc = A.osc('sawtooth', 82, t, 2, lp); osc.frequency.exponentialRampToValueAtTime(55, t + 1.8); lp.frequency.linearRampToValueAtTime(260, t + 1.8); A.env(g.gain, t, 0.4, 0.5, 0.8, 0.7); return 2; };
  S.shadow_tear = function (t, o) { burst(t, { vol: 1, reverb: 2 }, 'sfx', 1200, 0.5, 'bandpass', 0.002, 1.0, 0.6); burst(t, { vol: 1, reverb: 2 }, 'sfx', 3000, 1, 'highpass', 0.001, 0.7, 0.15); tone(t, { vol: 0.9, reverb: 2 }, 'sfx', 'sine', 70, 0.005, 1.0, 2.5, 30); return 3; };
  S.shadow_absorb = function (t, o) { var f = burst(t, { vol: 0.6, reverb: 1.5 }, 'sfx', 2400, 3, 'bandpass', 1.4, 0.6, 0.06, 'pink'); if (f) f.frequency.exponentialRampToValueAtTime(180, t + 1.4); return 1.6; };
  S.shadow_release = function (t, o) {
    var out = A.out('sfx', { vol: 0.7, reverb: 2.5 }); if (!out) return 5;
    [293.7, 370, 440, 587.3, 659.3].forEach(function (f, i) {
      var g = A.gain(0, out), bp = A.filter('bandpass', 800, 4, g), bp2 = A.filter('bandpass', 1150, 5, g);
      var o1 = A.osc('sawtooth', f, t + i * 0.25, 4.5, bp); o1.connect(bp2);
      A.env(g.gain, t + i * 0.25, 1.4, 0.12, 1.6, 1.5);
    });
    var f2 = burst(t, { vol: 0.5, reverb: 2 }, 'sfx', 400, 1, 'bandpass', 1.5, 0.4, 2.5, 'pink'); if (f2) f2.frequency.exponentialRampToValueAtTime(3000, t + 3);
    return 5;
  };
  return S;
})();
