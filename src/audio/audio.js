/* Audio engine (WebAudio): buses (music / ambience / sfx / ui / voice), limiter, reverb send,
   fades & crossfades, positional one-shots, ducking under dialogue, voice-count priorities.
   Every sound is synthesised at runtime — no external audio files. */
'use strict';
BTS.Audio = (function () {
  var A = { ctx: null, ready: false, bus: {}, voices: {}, reverbAmt: 0.15, duck: 0, muffle: 0 };
  var noise = {};
  var LIMITS = { step: 5, ambient: 6, drip: 4, ui: 4, horror: 4, shadow: 4, default: 12 };

  A.init = function () {
    if (A.ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { BTS.Log.warn('no WebAudio'); return; }
    var ctx = A.ctx = new AC();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.25;
    A.master = ctx.createGain();
    A.muffleFilter = ctx.createBiquadFilter(); A.muffleFilter.type = 'lowpass'; A.muffleFilter.frequency.value = 20000;
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
    A.master.connect(A.muffleFilter); A.muffleFilter.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    A.send = {};
    ['music', 'ambience', 'sfx', 'ui', 'voice'].forEach(function (b) { var g = ctx.createGain(); g.connect(A.master); A.bus[b] = g; });
    // reverb
    A.reverb = ctx.createConvolver();
    A.reverb.buffer = impulse(2.8, 2.2);
    A.reverbSend = ctx.createGain(); A.reverbSend.gain.value = A.reverbAmt;
    A.reverbSend.connect(A.reverb); A.reverb.connect(A.master);
    ['music', 'ambience', 'sfx', 'ui', 'voice'].forEach(function (b) { var s = ctx.createGain(); s.connect(A.reverbSend); A.send[b] = s; });
    makeNoise();
    A.applyVolumes();
    A.ready = true;
    BTS.Events.on('config', function () { A.applyVolumes(); });
    BTS.Log.info('audio ready', ctx.sampleRate);
    if (BTS.Music) BTS.Music.init();
    if (BTS.Ambience) BTS.Ambience.init();
  };
  A.resume = function () { if (!A.ctx) A.init(); if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { A.resume(); }, { passive: true }); });

  A.applyVolumes = function () {
    if (!A.ctx) return;
    var C = BTS.Config, t = A.ctx.currentTime;
    A.master.gain.setTargetAtTime(C.get('masterVolume'), t, 0.05);
    var duck = A.duck;
    A.bus.music.gain.setTargetAtTime(C.get('musicVolume') * 0.55 * (1 - duck * 0.45), t, 0.3);
    A.bus.ambience.gain.setTargetAtTime(C.get('ambienceVolume') * 0.8 * (1 - duck * 0.3), t, 0.3);
    A.bus.sfx.gain.setTargetAtTime(C.get('sfxVolume') * 0.85, t, 0.05);
    A.bus.ui.gain.setTargetAtTime(C.get('uiVolume') * 0.7, t, 0.05);
    A.bus.voice.gain.setTargetAtTime(C.get('sfxVolume') * 0.35, t, 0.05);
    ['music', 'ambience', 'sfx', 'ui', 'voice'].forEach(function (b) { var gv = { music: C.get('musicVolume') * 0.55 * (1 - duck * 0.45), ambience: C.get('ambienceVolume') * 0.8 * (1 - duck * 0.3), sfx: C.get('sfxVolume') * 0.85, ui: C.get('uiVolume') * 0.7, voice: C.get('sfxVolume') * 0.35 }[b]; A.send[b].gain.setTargetAtTime(gv, t, 0.3); });
  };
  A.setDuck = function (v) { if (A.duck !== v) { A.duck = v; A.applyVolumes(); } };
  A.setReverb = function (amt, len) {
    if (!A.ctx) return;
    A.reverbSend.gain.setTargetAtTime(amt, A.ctx.currentTime, 0.4);
    if (len && len !== A.reverbLen) { A.reverbLen = len; A.reverb.buffer = impulse(len, 2.4); }
  };
  A.setMuffle = function (k) { if (!A.ctx) return; A.muffleFilter.frequency.setTargetAtTime(20000 * Math.pow(0.02, k), A.ctx.currentTime, 0.4); };

  function impulse(sec, decay) {
    var ctx = A.ctx, n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < 200 ? i / 200 : 1); }
    return b;
  }
  function makeNoise() {
    var ctx = A.ctx, sr = ctx.sampleRate;
    function buf(sec, fn) { var n = Math.floor(sr * sec), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); fn(d, n); return b; }
    noise.white = buf(3, function (d, n) { for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; });
    noise.pink = buf(4, function (d, n) {
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926; }
    });
    noise.brown = buf(4, function (d, n) { var l = 0; for (var i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
  }
  A.noise = function (kind) { return noise[kind || 'white']; };

  /* ---------- low-level voice helpers ---------- */
  A.now = function () { return A.ctx ? A.ctx.currentTime : 0; };
  A.env = function (param, t, a, peak, hold, rel, base) {
    base = base || 0.0001;
    param.cancelScheduledValues(t);
    param.setValueAtTime(base, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (hold) param.setValueAtTime(peak, t + a + hold);
    param.exponentialRampToValueAtTime(Math.max(base, 0.0001), t + a + (hold || 0) + rel);
  };
  A.osc = function (type, f, t, dur, dest) {
    var o = A.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
  };
  A.noiseSrc = function (kind, t, dur, dest, rate) {
    var s = A.ctx.createBufferSource(); s.buffer = noise[kind || 'white'];
    s.loop = true; if (rate) s.playbackRate.value = rate;
    s.connect(dest); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05); return s;
  };
  A.filter = function (type, f, q, dest) { var b = A.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q !== undefined) b.Q.value = q; b.connect(dest); return b; };
  A.gain = function (v, dest) { var g = A.ctx.createGain(); g.gain.value = v === undefined ? 1 : v; g.connect(dest); return g; };
  A.panner = function (pan, dest) { var p = A.ctx.createStereoPanner ? A.ctx.createStereoPanner() : null; if (!p) return dest; p.pan.value = pan; p.connect(dest); return p; };

  /* output chain for a one-shot: returns node to connect into (handles bus, pan, distance, reverb) */
  A.out = function (bus, o) {
    o = o || {};
    var dest = A.bus[bus] || A.bus.sfx;
    var vol = o.vol === undefined ? 1 : o.vol;
    var pan = 0;
    if (o.x !== undefined && BTS.Camera) {
      var c = BTS.Camera.target, dx = o.x - c[0], dz = o.z - c[2], d = Math.hypot(dx, dz);
      var range = o.range || 22;
      vol *= Math.max(0, 1 - d / range); vol *= vol > 0 ? 1 : 0;
      pan = BTS.M.clamp(dx / 12, -0.85, 0.85);
      if (vol <= 0.002) return null;
      if (d > 8 && o.distanceLP !== false) { var lp = A.filter('lowpass', BTS.M.clamp(9000 - d * 300, 900, 9000), 0.7, dest); dest = lp; }
    }
    var g = A.gain(vol, A.panner(pan, dest));
    var rv = o.reverb === undefined ? 1 : o.reverb;
    if (rv > 0) { var s = A.gain(rv, A.send[bus] || A.send.sfx); g.connect(s); }
    return g;
  };
  A.claim = function (cat) {
    var lim = LIMITS[cat] || LIMITS.default, now = A.now();
    var v = A.voices[cat] = (A.voices[cat] || []).filter(function (e) { return e > now; });
    if (v.length >= lim) return false;
    return true;
  };
  A.hold = function (cat, dur) { (A.voices[cat] = A.voices[cat] || []).push(A.now() + dur); };

  /* public: play a named synthesized sound */
  A.play = function (name, o) {
    if (!A.ready || !BTS.SFX[name]) { if (A.ready && !BTS.SFX[name]) BTS.Log.warn('missing sfx', name); return; }
    o = o || {};
    var cat = o.cat || BTS.SFX.cats[name] || 'default';
    if (!A.claim(cat)) return;
    try {
      var dur = BTS.SFX[name](A.now() + (o.delay || 0), o) || 0.5;
      A.hold(cat, dur);
      if (BTS.UI && BTS.UI.caption && o.caption !== false && BTS.SFX.captions[name]) BTS.UI.caption(BTS.SFX.captions[name], o);
    } catch (e) { BTS.Log.warn('sfx error', name, e); }
  };
  return A;
})();
