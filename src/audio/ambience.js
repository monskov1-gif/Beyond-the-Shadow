/* Ambience: continuous layers (wind, leaves, rain, roof drips, crickets, crowd, river, fire,
   room tone) driven by environment + location, plus scheduled sporadic events (birds, dogs,
   distant voices, shutters). Horror mutes the natural ambience. */
'use strict';
BTS.Ambience = (function () {
  var A = BTS.Audio;
  var Amb = { layers: {}, mute: 0, profile: {}, timers: {} };

  function layer(name, kind, type, f, q, rate) {
    var g = A.gain(0, A.bus.ambience);
    var fl = A.filter(type, f, q, g);
    var src = A.ctx.createBufferSource(); src.buffer = A.noise(kind); src.loop = true;
    if (rate) src.playbackRate.value = rate;
    src.connect(fl); src.start(0, Math.random() * 2);
    Amb.layers[name] = { g: g, f: fl, src: src, v: 0 };
    return Amb.layers[name];
  }
  Amb.init = function () {
    layer('wind', 'pink', 'bandpass', 500, 0.6);
    layer('leaves', 'white', 'highpass', 4500, 0.5);
    layer('rain', 'white', 'bandpass', 2600, 0.4);
    layer('rainLow', 'pink', 'lowpass', 600, 0.5);
    layer('river', 'pink', 'bandpass', 900, 0.4);
    layer('crowd', 'pink', 'bandpass', 700, 1.2);
    layer('fire', 'brown', 'lowpass', 400, 0.7);
    layer('room', 'brown', 'lowpass', 160, 0.7);
    layer('hum', 'brown', 'lowpass', 90, 1);
    // crickets: amplitude-modulated high tone
    var cg = A.gain(0, A.bus.ambience);
    var am = A.ctx.createGain(); am.gain.value = 0; am.connect(cg);
    var osc = A.ctx.createOscillator(); osc.frequency.value = 4400; osc.connect(am); osc.start();
    var lfo = A.ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 18; var lg = A.gain(0.5, am.gain); lfo.connect(lg); lfo.start();
    var lfo2 = A.ctx.createOscillator(); lfo2.frequency.value = 0.7; var lg2 = A.gain(0.5, am.gain); lfo2.connect(lg2); lfo2.start();
    Amb.layers.crickets = { g: cg, v: 0 };
  };
  /* location profile: {wind, leaves, river, crowd, fire, room, interior, birds, dogs, voices, reverb, reverbLen} */
  Amb.setProfile = function (p) { Amb.profile = p || {}; if (A.ready) A.setReverb(p.reverb === undefined ? 0.15 : p.reverb, p.reverbLen || 2.2); };
  function set(name, v, tc) {
    var L = Amb.layers[name]; if (!L) return;
    v = Math.max(0, v);
    if (Math.abs(L.v - v) < 0.002) return;
    L.v = v; L.g.gain.setTargetAtTime(v, A.ctx.currentTime, tc || 0.8);
  }
  Amb.update = function (dt) {
    if (!A.ready) return;
    var E = BTS.Env, P = Amb.profile, inside = !!P.interior;
    var horror = Math.max(E.horror, Amb.mute);
    var nat = 1 - horror * 0.85;
    var night = E.lampOn;
    var ws = E.windStrength || 0.3;
    set('wind', (inside ? 0.04 + ws * 0.04 : 0.1 + ws * 0.25) * (P.wind === undefined ? 1 : P.wind) * nat);
    if (Amb.layers.wind) Amb.layers.wind.f.frequency.setTargetAtTime(350 + ws * 500, A.ctx.currentTime, 1);
    set('leaves', (inside ? 0 : ws * ws * 0.07 * (0.6 + 0.4 * Math.sin(BTS.App.time * 0.8)) * (P.leaves === undefined ? 1 : P.leaves)) * nat, 0.4);
    set('rain', E.rain * (inside ? 0.12 : 0.3));
    set('rainLow', E.rain * (inside ? 0.25 : 0.2));
    set('river', (P.river || 0) * 0.25 * nat);
    set('crowd', (P.crowd || 0) * 0.22 * (1 - horror));
    set('fire', (P.fire || 0) * 0.25);
    set('room', inside ? 0.12 : 0);
    set('hum', horror * 0.35 + (P.hum || 0) * 0.2, 2);
    set('crickets', (!inside && E.rain < 0.2 ? (night > 0.5 ? 0.012 : (E.weather === 'clear' && E.hour > 10 && E.hour < 18 ? 0.006 : 0)) * (P.crickets === undefined ? 1 : P.crickets) : 0) * nat);
    // sporadic events (not while someone is speaking)
    var T = Amb.timers;
    if (BTS.Dialogue.active) return;
    function every(key, min, max, fn) { T[key] = (T[key] === undefined ? Math.random() * max : T[key]) - dt; if (T[key] <= 0) { T[key] = min + Math.random() * (max - min); fn(); } }
    var c = BTS.Camera.target;
    if (!inside && horror < 0.5) {
      if (night < 0.5 && E.rain < 0.3) every('bird', 2, 7, function () { A.play('bird', { x: c[0] + (Math.random() - 0.5) * 30, z: c[2] - 5 - Math.random() * 15, caption: false }); });
      if (P.dogs !== false) every('dog', 25, 60, function () { A.play('dog_bark', { x: c[0] + (Math.random() - 0.5) * 50, z: c[2] - 10 - Math.random() * 20, vol: 0.5 }); });
      if (P.rooster && E.hour > 5 && E.hour < 9) every('rooster', 30, 70, function () { A.play('rooster', { x: c[0] + 20, z: c[2] - 15 }); });
      if (P.sheep) every('sheep', 12, 30, function () { A.play('sheep', { x: P.sheep[0], z: P.sheep[1] }); });
      if (P.crows || night > 0.4) every('crow', 30, 80, function () { A.play('crow', { x: c[0] + (Math.random() - 0.5) * 40, z: c[2] - 15, caption: false }); });
    }
    if (!inside && E.windStrength > 0.6) every('shutter', 15, 35, function () { A.play('shutter', { x: c[0] + (Math.random() - 0.5) * 20, z: c[2] - 6 }); });
    if (P.crowd) { every('murmur', 0.6, 2.2, function () { A.play('murmur', { x: c[0] + (Math.random() - 0.5) * 14, z: c[2] + (Math.random() - 0.5) * 10, vol: P.crowd * (1 - horror), caption: false }); }); every('laugh', 6, 15, function () { A.play('laugh', { x: c[0] + (Math.random() - 0.5) * 12, z: c[2] - 3, vol: P.crowd * 0.8, caption: false }); }); }
    if (!inside && P.voices !== false && horror < 0.3 && night < 0.6) every('voices', 14, 35, function () { A.play('murmur', { x: c[0] + (Math.random() - 0.5) * 40, z: c[2] - 12 - Math.random() * 10, vol: 0.35, caption: false }); });
    if (!inside && E.rain > 0.15) every('drip', 0.25, 1.2, function () { A.play('drip', { x: c[0] + (Math.random() - 0.5) * 10, z: c[2] + (Math.random() - 0.5) * 6, vol: 0.5 + E.rain * 0.5, caption: false }); });
    if (P.fire) every('pop', 0.3, 1.5, function () { var f = P.firePos || c; A.play('fire_pop', { x: f[0], z: f[2] === undefined ? f[1] : f[2], vol: 0.6, caption: false }); });
    if (horror > 0.45) every('whisper', 9, 22, function () { A.play('whisper', { vol: horror }); });
  };
  BTS.Events.on('lightning', function (delay) { if (A.ready) A.play('thunder', { delay: delay, vol: BTS.Env.interior ? 0.5 : 1, caption: BTS.Dialogue && BTS.Dialogue.active ? false : undefined }); });
  return Amb;
})();
