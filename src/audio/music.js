/* Generative score. Each music state schedules notes ahead with its own gain node so that state
   changes crossfade. Instruments: tamburica pluck (Karplus–Strong), frula, bowed gusle-like
   strings, pads, low piano, bells/music box, choir, tapan drum, accordion. */
'use strict';
BTS.Music = (function () {
  var A = BTS.Audio;
  var Mu = { state: null, layers: {}, intensity: 0, ksCache: {} };
  var LOOK = 1.0;
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  var HIJAZ = [0, 1, 4, 5, 7, 8, 10], MINOR = [0, 2, 3, 5, 7, 8, 10];
  function deg(scale, root, d) { var o = Math.floor(d / scale.length), i = ((d % scale.length) + scale.length) % scale.length; return root + o * 12 + scale[i]; }
  var R = BTS.RNG((Date.now() & 0xffffff) + 7);

  /* ---------- instruments (dest = layer gain) ---------- */
  function ks(m) {          // Karplus-Strong plucked string buffer
    if (Mu.ksCache[m]) return Mu.ksCache[m];
    var sr = A.ctx.sampleRate, f = mtof(m), N = Math.round(sr / f), len = Math.floor(sr * 2.2);
    var b = A.ctx.createBuffer(1, len, sr), d = b.getChannelData(0), buf = new Float32Array(N);
    for (var i = 0; i < N; i++) buf[i] = Math.random() * 2 - 1;
    var p = 0, decay = 0.996 - Math.max(0, (m - 60)) * 0.0004;
    for (i = 0; i < len; i++) { var nx = (p + 1) % N; var v = (buf[p] + buf[nx]) * 0.5 * decay; d[i] = buf[p]; buf[p] = v; p = nx; }
    Mu.ksCache[m] = b; return b;
  }
  function pluck(dest, t, m, v) {
    var s = A.ctx.createBufferSource(); s.buffer = ks(m);
    var g = A.gain(v * 0.5, dest); var lp = A.filter('lowpass', 3200, 0.7, g);
    s.connect(lp); s.start(t); s.stop(t + 2.2);
  }
  function frula(dest, t, m, dur, v) {
    var f = mtof(m), g = A.gain(0, dest), lp = A.filter('lowpass', f * 4, 1, g);
    var o = A.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    var vib = A.ctx.createOscillator(); vib.frequency.value = 5.2; var vg = A.gain(f * 0.012, o.frequency); vib.connect(vg);
    o.connect(lp); o.start(t); o.stop(t + dur + 0.3); vib.start(t); vib.stop(t + dur + 0.3);
    var o2 = A.ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; var g2 = A.gain(0.08, lp); o2.connect(g2); o2.start(t); o2.stop(t + dur + 0.3);
    var nb = A.filter('bandpass', f * 2, 3, g); A.noiseSrc('white', t, dur + 0.2, nb); var ng = nb; // breath
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.25, t + 0.06); g.gain.setValueAtTime(v * 0.22, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  }
  function bowed(dest, t, m, dur, v, gliss) {
    var f = mtof(m), g = A.gain(0, dest), bp = A.filter('bandpass', f * 3, 0.9, g), lp = A.filter('lowpass', 2400, 0.7, bp);
    var o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t);
    if (gliss) o.frequency.linearRampToValueAtTime(f * Math.pow(2, gliss / 12), t + dur);
    var vib = A.ctx.createOscillator(); vib.frequency.value = 5.6; var vg = A.gain(f * 0.008, o.frequency); vib.connect(vg);
    o.connect(lp); o.start(t); o.stop(t + dur + 0.6); vib.start(t); vib.stop(t + dur + 0.6);
    var nb = A.filter('bandpass', 2000, 1, g); var ngain = A.gain(0.05, nb); A.noiseSrc('white', t, dur + 0.5, ngain);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.16, t + Math.min(0.5, dur * 0.3)); g.gain.setValueAtTime(v * 0.14, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
  }
  function pad(dest, t, ms, dur, v, cutoff) {
    var g = A.gain(0, dest), lp = A.filter('lowpass', cutoff || 900, 0.5, g);
    ms.forEach(function (m) { [-6, 6].forEach(function (det) { var o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 2); }); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.05, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.8);
  }
  function piano(dest, t, m, v) {
    var f = mtof(m), g = A.gain(0, dest), lp = A.filter('lowpass', 2000, 0.5, g);
    [[1, 1], [2, 0.4], [3, 0.18], [4.02, 0.08]].forEach(function (p) { var o = A.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * p[0]; var pg = A.gain(p[1], lp); o.connect(pg); o.start(t); o.stop(t + 4.5); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.18, t + 0.008); g.gain.exponentialRampToValueAtTime(v * 0.05, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
  }
  function bell(dest, t, m, v) {
    var f = mtof(m), g = A.gain(0, dest);
    [[1, 1], [2.76, 0.4], [5.4, 0.2], [8.9, 0.08]].forEach(function (p) { var o = A.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * p[0]; var pg = A.gain(p[1], g); o.connect(pg); o.start(t); o.stop(t + 3); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.1, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
  }
  function choir(dest, t, m, dur, v, vowel) {
    var f = mtof(m), g = A.gain(0, dest);
    var F = vowel === 'o' ? [450, 800, 2830] : vowel === 'u' ? [325, 700, 2530] : [800, 1150, 2900];
    var mix = A.gain(1, g);
    var fs = F.map(function (ff, i) { return A.filter('bandpass', ff, 6 + i * 2, mix); });
    [-8, 0, 7].forEach(function (det) {
      var o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      var vib = A.ctx.createOscillator(); vib.frequency.value = 4.8 + Math.random(); var vg = A.gain(f * 0.006, o.frequency); vib.connect(vg); vib.start(t); vib.stop(t + dur + 2);
      fs.forEach(function (fl) { o.connect(fl); }); o.start(t); o.stop(t + dur + 2);
    });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.22, t + dur * 0.35); g.gain.setValueAtTime(v * 0.2, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.6);
  }
  function drum(dest, t, v, low) {
    var g = A.gain(0, dest), o = A.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(low ? 110 : 170, t); o.frequency.exponentialRampToValueAtTime(low ? 42 : 80, t + 0.2);
    o.connect(g); o.start(t); o.stop(t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.55, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    var ng = A.gain(0, dest), hp = A.filter('bandpass', low ? 300 : 2500, 1, ng); A.noiseSrc('white', t, 0.1, hp);
    ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(v * (low ? 0.2 : 0.12), t + 0.002); ng.gain.exponentialRampToValueAtTime(0.0001, t + (low ? 0.12 : 0.05));
  }
  function accordion(dest, t, m, dur, v) {
    var f = mtof(m), g = A.gain(0, dest), lp = A.filter('lowpass', 2200, 0.6, g);
    [['square', -5], ['sawtooth', 6]].forEach(function (s) { var o = A.ctx.createOscillator(); o.type = s[0]; o.frequency.value = f; o.detune.value = s[1]; var og = A.gain(0.5, lp); o.connect(og); o.start(t); o.stop(t + dur + 0.2); });
    var trem = A.ctx.createOscillator(); trem.frequency.value = 6; var tg = A.gain(v * 0.012, g.gain); trem.connect(tg); trem.start(t); trem.stop(t + dur + 0.2);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.05, t + 0.04); g.gain.setValueAtTime(v * 0.045, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
  }
  function drone(dest, t, ms, dur, v, cut) {
    var g = A.gain(0, dest), lp = A.filter('lowpass', cut || 300, 0.8, g);
    ms.forEach(function (m, i) { var o = A.ctx.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'sine'; o.frequency.value = mtof(m); o.detune.value = (Math.random() - 0.5) * 14; o.connect(lp); o.start(t); o.stop(t + dur + 3); });
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.12, t + Math.min(4, dur * 0.4)); g.gain.setValueAtTime(v * 0.12, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 3);
  }

  /* ---------- states: each has tick(layer, t) scheduling events; layer.next = time of next event ---------- */
  var STATES = {
    silence: { tick: function (L, t) { L.next = t + 1; } },
    menu: {
      tick: function (L, t) {
        if (!L.droneUntil || t > L.droneUntil - 2) { drone(L.g, Math.max(t, L.droneUntil || t), [38, 45, 50], 18, 0.8, 260); L.droneUntil = Math.max(t, L.droneUntil || t) + 18; }
        var notes = [62, 65, 69, 72, 74, 76, 70];
        piano(L.g, t, R.pick(notes), 0.7);
        if (R() < 0.3) piano(L.g, t + 0.9, R.pick(notes) - 12, 0.5);
        if (R() < 0.15) { var m = 74; [0, 1, 3, 1, 0].forEach(function (d, i) { frula(L.g, t + 2 + i * 0.55, deg(MINOR, 62, d + 7), 0.5, 0.6); }); }
        L.next = t + 3.5 + R() * 3.5;
      }
    },
    fair: {   // 7/8 (2+2+3) kolo groove in Hijaz on D with an uneasy drone
      tick: function (L, t) {
        var beat = 60 / 210, bar = beat * 7;
        L.bar = (L.bar || 0) + 1;
        if (!L.droneUntil || t > L.droneUntil - 1) { drone(L.g, t, [38, 39], 16, 0.35, 180); L.droneUntil = t + 16; }
        [0, 2, 4].forEach(function (b, i) { drum(L.g, t + b * beat, i === 0 ? 0.8 : 0.55, i === 0); });
        drum(L.g, t + 6 * beat, 0.3, false);
        var bass = [50, 50, 55, 57][L.bar % 4];
        [0, 2, 4].forEach(function (b) { pluck(L.g, t + b * beat, bass - 12, 0.6); });
        for (var s = 0; s < 7; s++) if (s % 2 === 1 || s === 6) pluck(L.g, t + s * beat, deg(HIJAZ, 62, [2, 4, 3][s % 3]), 0.35);
        var phrase = L.bar % 8;
        if (phrase < 6) {
          var mel = L.mel || (L.mel = [0, 1, 2, 3, 4, 3, 2, 1, 0, -1, 0, 1, 2, 4, 5, 4]);
          for (var k = 0; k < 4; k++) { var d = mel[(L.bar * 4 + k) % mel.length] + (phrase >= 4 ? 2 : 0); accordion(L.g, t + k * beat * 1.75, deg(HIJAZ, 62, d + 7), beat * 1.6, 0.7); }
        } else if (R() < 0.5) bowed(L.g, t, 75, bar * 0.9, 0.5, -1);   // a sour bent note
        if (R() < 0.2) frula(L.g, t + beat * 3, deg(HIJAZ, 74, R.int(0, 6)), beat * 2, 0.4);
        L.next = t + bar;
      }
    },
    village: {
      tick: function (L, t) {
        var c = R();
        if (c < 0.45) pluck(L.g, t, deg(MINOR, 50, R.int(0, 7)), 0.45);
        else if (c < 0.7) [0, 2, 1].forEach(function (d, i) { frula(L.g, t + i * 0.8, deg(MINOR, 74, d + R.int(-1, 2)), 0.7, 0.35); });
        else if (c < 0.85) piano(L.g, t, deg(MINOR, 50, R.int(0, 7)), 0.4);
        L.next = t + 9 + R() * 14;
      }
    },
    explore: {
      tick: function (L, t) {
        var chords = [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]];
        L.i = ((L.i || 0) + 1) % chords.length;
        pad(L.g, t, chords[L.i], 7, 0.7, 700);
        if (R() < 0.6) piano(L.g, t + 2 + R() * 3, deg(MINOR, 62, R.int(0, 9)), 0.4);
        L.next = t + 8;
      }
    },
    symptoms: {
      tick: function (L, t) {
        drone(L.g, t, [38, 39, 50.5], 10, 0.9, 340);
        var n = R.int(1, 4);
        for (var i = 0; i < n; i++) drum(L.g, t + R() * 6, 0.35, true);
        if (R() < 0.5) bowed(L.g, t + 3, R.pick([63, 64, 70]), 4, 0.5, -0.6);
        if (R() < 0.3) bell(L.g, t + 5, 87, 0.4);
        L.next = t + 8 + R() * 4;
      }
    },
    jaglika: {
      tick: function (L, t) {
        drone(L.g, t, [26, 27, 38], 12, 1.0, 200);
        bowed(L.g, t + R() * 2, R.pick([50, 51, 56]), 5 + R() * 3, 0.6, R.pick([-1, -0.5, 0.5]));
        if (R() < 0.5) bowed(L.g, t + 4, R.pick([86, 87, 93]), 3, 0.15, -0.3);
        if (R() < 0.4) pluck(L.g, t + 6, R.pick([39, 40]), 0.5);
        L.next = t + 10 + R() * 3;
      }
    },
    tension: {
      tick: function (L, t) {
        var beat = 0.75;
        for (var i = 0; i < 8; i++) { if (i % 4 === 0 || R() < 0.15) drum(L.g, t + i * beat, 0.4, true); }
        bowed(L.g, t, 50, beat * 8, 0.45); bowed(L.g, t, 51, beat * 8, 0.3);
        if (R() < 0.5) choir(L.g, t + 2, 62, 4, 0.4, 'u');
        L.next = t + beat * 8;
      }
    },
    ritual: {
      tick: function (L, t) {
        var I = Mu.intensity;
        var beat = 0.62 - I * 0.22;
        var steps = 8;
        for (var i = 0; i < steps; i++) { drum(L.g, t + i * beat, 0.4 + I * 0.4, i % 2 === 0); }
        bowed(L.g, t, deg(HIJAZ, 50, [0, 1, 0, -1][(L.bar = (L.bar || 0) + 1) % 4]), beat * steps, 0.5 + I * 0.4);
        if (I > 0.3) choir(L.g, t, 62, beat * steps, 0.4 + I * 0.4, 'a');
        if (I > 0.6) { choir(L.g, t, 63, beat * steps, 0.35, 'o'); bowed(L.g, t, 74, beat * steps, 0.35, 1); }
        L.next = t + beat * steps;
      }
    },
    chase: {
      tick: function (L, t) {
        var beat = 0.3;
        for (var i = 0; i < 16; i++) if (i % 2 === 0 || R() < 0.4) drum(L.g, t + i * beat, 0.7, i % 4 === 0);
        choir(L.g, t, 62, beat * 16, 0.5, 'a'); choir(L.g, t, 69, beat * 16, 0.4, 'o');
        bowed(L.g, t, 50, beat * 16, 0.5, 0); bowed(L.g, t, 57, beat * 16, 0.35, 0);
        L.next = t + beat * 16;
      }
    },
    release: {
      tick: function (L, t) {
        if (L.done) { L.next = t + 5; return; }
        [62, 66, 69, 74, 76].forEach(function (m, i) { choir(L.g, t + i * 0.5, m, 9, 0.7, i % 2 ? 'o' : 'a'); });
        [50, 57].forEach(function (m) { bowed(L.g, t, m, 10, 0.6); });
        L.done = true; L.next = t + 12;
      }
    },
    epilogue: {
      tick: function (L, t) {
        var mel = [[69, 2], [67, 1], [65, 1.5], [64, 0.5], [62, 3], [65, 1.5], [64, 1], [62, 1], [61, 3], [62, 2], [63, 4]];
        var tt = t;
        L.pass = (L.pass || 0) + 1;
        mel.forEach(function (n, i) { (L.pass % 2 ? piano : function (d, tm, m, v) { frula(d, tm, m + 12, n[1] * 0.9, v); })(L.g, tt, n[0], 0.55); if (i % 3 === 0) piano(L.g, tt, n[0] - 24, 0.35); tt += n[1] * 0.9; });
        pad(L.g, t, [50, 57, 62], tt - t, 0.4, 500);
        L.next = tt + 4;
      }
    },
    memory: {
      tick: function (L, t) {
        var mel = [74, 72, 70, 69, 70, 72, 69, 65, 67, 69, 70, 69, 67, 65, 62];
        mel.forEach(function (m, i) { bell(L.g, t + i * 0.55, m + 12, 0.7); });
        pad(L.g, t, [50, 57, 62], 8, 0.25, 600);
        L.next = t + mel.length * 0.55 + 2;
      }
    }
  };
  Mu.STATES = Object.keys(STATES);

  Mu.init = function () { Mu.timer = setInterval(Mu.schedule, 100); if (Mu.pending) Mu.set(Mu.pending); };
  Mu.set = function (state, fade) {
    if (!STATES[state]) { BTS.Log.warn('unknown music state', state); return; }
    if (!A.ready) { Mu.pending = state; return; }
    if (Mu.state === state) return;
    var t = A.now(), f = fade === undefined ? 3 : fade;
    for (var k in Mu.layers) {
      var old = Mu.layers[k];
      old.g.gain.cancelScheduledValues(t); old.g.gain.setValueAtTime(old.g.gain.value, t); old.g.gain.linearRampToValueAtTime(0.0001, t + f);
      old.dying = t + f;
    }
    var g = A.gain(0, A.bus.music);
    var rs = A.gain(0.45, A.send.music); g.connect(rs);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + Math.max(0.05, f * 0.8));
    Mu.layers[state + '_' + Math.floor(t * 1000)] = { state: state, g: g, next: t + 0.1 };
    Mu.state = state;
    BTS.Events.emit('music', state);
  };
  /* hard cut (e.g. moment the needle pierces the shadow) */
  Mu.cut = function () {
    if (!A.ready) return;
    var t = A.now();
    for (var k in Mu.layers) { var L = Mu.layers[k]; L.g.gain.cancelScheduledValues(t); L.g.gain.setValueAtTime(L.g.gain.value, t); L.g.gain.linearRampToValueAtTime(0.0001, t + 0.015); L.dying = t + 0.05; }
    Mu.state = 'silence';
  };
  Mu.schedule = function () {
    if (!A.ready) return;
    var t = A.now();
    for (var k in Mu.layers) {
      var L = Mu.layers[k];
      if (L.dying && t > L.dying + 0.5) { L.g.disconnect(); delete Mu.layers[k]; continue; }
      if (L.dying) continue;
      var st = STATES[L.state];
      var guard = 0;
      if (L.next < t - 0.5) L.next = t + 0.05;
      while (L.next < t + LOOK && guard++ < 4) { try { st.tick(L, Math.max(L.next, t + 0.02)); } catch (e) { BTS.Log.warn('music tick', e); L.next = t + 2; } }
    }
  };
  return Mu;
})();
