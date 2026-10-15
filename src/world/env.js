/* Environment: time of day, weather, wind, lightning, wetness, light sources and grading.
   All parameters blend smoothly toward targets; story can force time/weather. */
'use strict';
BTS.Env = (function () {
  var M = BTS.M;
  var E = {
    hour: 19, hourGoal: 19, weather: 'clear', interior: false, horror: 0, horrorGoal: 0,
    lights: [], activeLights: [], wind: [0.4, 0, 0.1], flash: 0, wet: 0, rain: 0, sepia: 0, sepiaGoal: 0,
    fadeBlack: 0, fadeGoal: 0, fadeSpeed: 1.5, lightningOn: false, nextLightning: 10, supernatural: 0
  };
  var TIME = {
    morning: { h: 7.5, sunPos: [0.8, 0.35, 0.35], sunCol: [1.05, 0.8, 0.58], sunK: 1.15, sky: [0.42, 0.46, 0.55], ground: [0.2, 0.18, 0.16], fog: [0.6, 0.6, 0.62], fogD: 0.011, glow: 0.05, lamp: 0, grade: { exposure: 1.05, contrast: 1.04, sat: 0.92, lift: [0.02, 0.025, 0.04], gain: [1.03, 1.0, 0.95], vignette: 0.9, bloom: 0.35, grain: 0.012 } },
    day: { h: 13, sunPos: [0.35, 0.85, 0.5], sunCol: [1.06, 0.94, 0.78], sunK: 1.25, sky: [0.40, 0.48, 0.62], ground: [0.24, 0.22, 0.19], fog: [0.62, 0.68, 0.74], fogD: 0.008, glow: 0, lamp: 0, grade: { exposure: 1.0, contrast: 1.06, sat: 0.95, lift: [0.015, 0.02, 0.03], gain: [1.02, 1.0, 0.97], vignette: 0.8, bloom: 0.25, grain: 0.01 } },
    evening: { h: 19, sunPos: [-0.8, 0.22, 0.45], sunCol: [1.0, 0.56, 0.3], sunK: 1.05, sky: [0.3, 0.27, 0.36], ground: [0.16, 0.12, 0.12], fog: [0.38, 0.34, 0.42], fogD: 0.013, glow: 0.55, lamp: 0.7, grade: { exposure: 1.05, contrast: 1.08, sat: 0.95, lift: [0.03, 0.015, 0.04], gain: [1.05, 0.98, 0.94], vignette: 1.0, bloom: 0.55, grain: 0.014 } },
    night: { h: 23, sunPos: [-0.35, 0.75, 0.55], sunCol: [0.34, 0.42, 0.66], sunK: 0.6, sky: [0.16, 0.18, 0.26], ground: [0.07, 0.07, 0.09], fog: [0.1, 0.12, 0.17], fogD: 0.022, glow: 1.0, lamp: 1.0, grade: { exposure: 1.45, contrast: 1.08, sat: 0.85, lift: [0.012, 0.018, 0.04], gain: [0.98, 1.0, 1.08], vignette: 1.15, bloom: 0.8, grain: 0.016 } }
  };
  var WEATHER = {
    clear: { sunMul: 1, skyGrey: 0, fogAdd: 0, rain: 0, wet: 0, wind: 0.35, satMul: 1, lightning: false, fogHeight: 0.2 },
    overcast: { sunMul: 0.32, skyGrey: 0.55, fogAdd: 0.006, rain: 0, wet: 0.1, wind: 0.5, satMul: 0.82, lightning: false, fogHeight: 0.4 },
    fog: { sunMul: 0.25, skyGrey: 0.7, fogAdd: 0.03, rain: 0, wet: 0.25, wind: 0.15, satMul: 0.75, lightning: false, fogHeight: 1.0 },
    drizzle: { sunMul: 0.28, skyGrey: 0.6, fogAdd: 0.012, rain: 0.28, wet: 0.65, wind: 0.45, satMul: 0.8, lightning: false, fogHeight: 0.6 },
    rain: { sunMul: 0.18, skyGrey: 0.7, fogAdd: 0.018, rain: 0.7, wet: 1.0, wind: 0.75, satMul: 0.75, lightning: false, fogHeight: 0.7 },
    storm: { sunMul: 0.1, skyGrey: 0.8, fogAdd: 0.022, rain: 1.0, wet: 1.0, wind: 1.1, satMul: 0.7, lightning: true, fogHeight: 0.8 }
  };
  E.TIMES = Object.keys(TIME); E.WEATHERS = Object.keys(WEATHER);
  var cur = null, transition = 4;

  function timeBlend(hour) {
    var keys = [['morning', 7.5], ['day', 11.5], ['day', 15.5], ['evening', 19], ['night', 22.5], ['night', 28.5], ['morning', 31.5]];
    var h = ((hour % 24) + 24) % 24;
    if (h < 7.5) h += 24;
    for (var i = 0; i < keys.length - 1; i++) {
      var a = keys[i], b = keys[i + 1];
      if (h >= a[1] && h <= b[1]) return [TIME[a[0]], TIME[b[0]], (h - a[1]) / (b[1] - a[1])];
    }
    return [TIME.night, TIME.night, 0];
  }
  function lerpArr(a, b, t) { return a.map(function (v, i) { return v + (b[i] - v) * t; }); }

  function targetParams() {
    var tb = timeBlend(E.hour), A = tb[0], B = tb[1], t = M.smooth(0, 1, tb[2]);
    var w = WEATHER[E.weather] || WEATHER.clear;
    var p = {
      sunPos: lerpArr(A.sunPos, B.sunPos, t), sunCol: lerpArr(A.sunCol, B.sunCol, t), sunK: M.lerp(A.sunK, B.sunK, t),
      sky: lerpArr(A.sky, B.sky, t), ground: lerpArr(A.ground, B.ground, t), fog: lerpArr(A.fog, B.fog, t), fogD: M.lerp(A.fogD, B.fogD, t),
      glow: M.lerp(A.glow, B.glow, t), lamp: M.lerp(A.lamp, B.lamp, t),
      exposure: M.lerp(A.grade.exposure, B.grade.exposure, t), contrast: M.lerp(A.grade.contrast, B.grade.contrast, t), sat: M.lerp(A.grade.sat, B.grade.sat, t),
      lift: lerpArr(A.grade.lift, B.grade.lift, t), gain: lerpArr(A.grade.gain, B.grade.gain, t), vignette: M.lerp(A.grade.vignette, B.grade.vignette, t),
      bloom: M.lerp(A.grade.bloom, B.grade.bloom, t), grain: M.lerp(A.grade.grain, B.grade.grain, t)
    };
    // weather modifiers
    p.sunK *= w.sunMul;
    var grey = (p.sky[0] + p.sky[1] + p.sky[2]) / 3;
    p.sky = lerpArr(p.sky, [grey, grey * 1.02, grey * 1.06], w.skyGrey);
    var fg = (p.fog[0] + p.fog[1] + p.fog[2]) / 3;
    p.fog = lerpArr(p.fog, [fg * 0.95, fg, fg * 1.05], w.skyGrey * 0.8);
    p.fogD += w.fogAdd;
    p.sat *= w.satMul;
    p.rain = w.rain; p.wetGoal = w.wet; p.windK = w.wind; p.fogHeight = w.fogHeight;
    if (E.weather !== 'clear') { p.sky = lerpArr(p.sky, p.sky.map(function (v) { return v * 0.85; }), 0.5); p.glow = Math.max(p.glow, E.weather === 'fog' ? 0.25 : 0.35); p.lamp = Math.max(p.lamp, 0.4); }
    if (E.interior) {
      p.sunK *= 0.0; p.fogD = 0.004; p.fog = [0.02, 0.02, 0.025];
      p.sky = p.sky.map(function (v) { return v * 0.9 + 0.12; }); p.ground = p.ground.map(function (v) { return v * 0.8 + 0.07; }); p.exposure = Math.max(p.exposure, 1.3);
      p.rain = 0; p.windK = 0; p.fogHeight = 0;
    }
    // horror: drains colour, chills tint, deepens vignette
    var hr = E.horror;
    p.sat *= 1 - hr * 0.45; p.gain = lerpArr(p.gain, [0.92, 0.96, 1.05], hr * 0.7); p.vignette += hr * 0.5; p.exposure *= 1 - hr * 0.08;
    return p;
  }

  E.set = function (o, instant) {
    if (o.hour !== undefined) E.hour = o.hour;
    if (o.time && TIME[o.time]) E.hour = TIME[o.time].h;
    if (o.weather && WEATHER[o.weather]) E.weather = o.weather;
    if (o.interior !== undefined) E.interior = o.interior;
    if (o.horror !== undefined) E.horrorGoal = o.horror;
    transition = o.transition || 5;
    if (instant || !cur) { cur = targetParams(); E.horror = E.horrorGoal; E.wet = cur.wetGoal; }
  };
  E.timeName = function () {
    var h = ((E.hour % 24) + 24) % 24;
    if (h >= 5 && h < 10.5) return 'morning';
    if (h >= 10.5 && h < 17) return 'day';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  };
  E.isDark = function () { var t = E.timeName(); return t === 'night' || t === 'evening' && E.hour > 20; };

  E.setLights = function (list) { E.lights = list || []; E.lights.forEach(function (l, i) { l.seed = l.seed || i * 1.37; l.cur = [0, 0, 0]; }); };

  E.update = function (dt, focus) {
    if (!cur) cur = targetParams();
    E.horror = M.damp(E.horror, E.horrorGoal, 0.6, dt);
    var tgt = targetParams();
    var k = 1 - Math.exp(-dt * 3 / transition);
    for (var key in tgt) {
      if (Array.isArray(tgt[key])) for (var i = 0; i < tgt[key].length; i++) cur[key][i] += (tgt[key][i] - cur[key][i]) * k;
      else cur[key] += (tgt[key] - cur[key]) * k;
    }
    // wetness accumulates with rain, dries slowly
    var wg = cur.wetGoal;
    E.wet += (wg > E.wet ? 0.08 : 0.012) * dt * Math.sign(wg - E.wet);
    E.wet = M.clamp(E.wet, 0, 1);
    E.rain = cur.rain;
    // wind with gusts
    var t = BTS.App.time;
    var gust = 0.7 + 0.3 * Math.sin(t * 0.37) + 0.2 * Math.sin(t * 1.3);
    var ang = 0.35 + 0.4 * Math.sin(t * 0.05);
    E.windStrength = cur.windK * gust;
    E.wind = [Math.cos(ang) * E.windStrength, gust, Math.sin(ang) * E.windStrength * 0.5];
    // lightning
    E.lightningOn = (WEATHER[E.weather] || {}).lightning && !E.interior;
    E.flash = Math.max(0, E.flash - dt * 3.2);
    if (E.lightningOn) {
      E.nextLightning -= dt;
      if (E.nextLightning <= 0) { E.strike(); E.nextLightning = 7 + Math.random() * 14; }
    }
    if (E.flashQueue && E.flashQueue.length) { E.flashQueue[0].t -= dt; if (E.flashQueue[0].t <= 0) { E.flash = Math.max(E.flash, E.flashQueue[0].k); E.flashQueue.shift(); } }
    E.sepia = M.damp(E.sepia, E.sepiaGoal, 2, dt);
    // fade to/from black
    if (E.fadeBlack !== E.fadeGoal) {
      var dir = Math.sign(E.fadeGoal - E.fadeBlack);
      E.fadeBlack = M.clamp(E.fadeBlack + dir * dt * E.fadeSpeed, 0, 1);
      if ((dir > 0 && E.fadeBlack >= E.fadeGoal) || (dir < 0 && E.fadeBlack <= E.fadeGoal)) { E.fadeBlack = E.fadeGoal; if (E.fadeDone) { var f = E.fadeDone; E.fadeDone = null; f(); } }
    }
    // derived renderer params
    var sp = M.norm3(cur.sunPos);
    E.sunDir = [-sp[0], -sp[1], -sp[2]];
    var sk = cur.sunK;
    E.sunCol = [cur.sunCol[0] * sk, cur.sunCol[1] * sk, cur.sunCol[2] * sk];
    E.skyCol = cur.sky.slice(); E.groundCol = cur.ground.slice();
    var fl = E.flash;
    if (fl > 0) { E.skyCol = E.skyCol.map(function (v) { return v + fl * 0.9; }); }
    E.fogCol = cur.fog.map(function (v) { return v + fl * 0.25; });
    E.clearCol = E.fogCol;
    E.fogDensity = cur.fogD; E.fogHeight = cur.fogHeight;
    E.windowGlow = cur.glow; E.lampOn = cur.lamp;
    E.shadowOn = !E.interior && sk > 0.08;
    E.grade = { exposure: cur.exposure, contrast: cur.contrast, sat: cur.sat, lift: cur.lift, gain: cur.gain, vignette: cur.vignette, bloom: cur.bloom, grain: cur.grain };
    E.desat = 0; E.tint = [1, 1, 1];
    // lights: flicker + selection of the 16 most relevant
    var fx = focus ? focus[0] : 0, fz = focus ? focus[2] : 0;
    var cand = [];
    for (i = 0; i < E.lights.length; i++) {
      var L = E.lights[i];
      if (L.off) continue;
      var on = 1;
      if (L.kind === 'window') on = E.windowGlow;
      else if (L.kind === 'lamp') on = E.lampOn;
      else if (L.kind === 'day') on = 1 - E.lampOn * 0.6;
      if (on <= 0.02) continue;
      var fk = 1;
      if (L.flicker) fk = 1 - L.flicker * (0.5 + 0.5 * Math.sin(t * 13 + L.seed * 7) * Math.sin(t * 7.3 + L.seed)) * (0.7 + 0.3 * Math.random());
      if (E.supernatural > 0 && L.kind !== 'day') fk *= 1 - E.supernatural * (Math.random() < 0.08 ? 0.7 : 0.1);
      var inten = (L.intensity || 1) * on * fk;
      L.cur = [L.color[0] * inten, L.color[1] * inten, L.color[2] * inten];
      var d = Math.hypot(L.x - fx, L.z - fz);
      L.score = d - L.radius * 0.5 - (L.important ? 100 : 0);
      cand.push(L);
    }
    // readability light around the focus point when it gets dark (never hide important objects)
    var dark = E.interior ? 0.5 : M.clamp(E.lampOn * 1.1, 0, 1);
    if (dark > 0.05 && focus) {
      E.fillLight = E.fillLight || { kind: 'fill', radius: 12, important: true };
      var fl = E.fillLight, k2 = dark * (E.interior ? 0.4 : 0.55);
      fl.x = focus[0]; fl.y = focus[1] + 4.5; fl.z = focus[2] + 1.5;
      fl.cur = [0.55 * k2, 0.62 * k2, 0.85 * k2]; fl.score = -1000;
      cand.push(fl);
    }
    cand.sort(function (a, b) { return a.score - b.score; });
    E.activeLights = cand.slice(0, BTS.Shaders.MAXL);
    E.dof = E.interior ? 0.6 : 1;
    E.bloomThreshold = E.interior ? 0.7 : 0.8;
  };

  E.strike = function () {
    E.flashQueue = [{ t: 0, k: 1 }, { t: 0.12, k: 0.6 }, { t: 0.1, k: 0.9 }];
    var delay = 0.6 + Math.random() * 2.4;
    BTS.Events.emit('lightning', delay);
  };
  E.fadeTo = function (v, speed) {
    E.fadeGoal = v; E.fadeSpeed = speed || 1.5;
    return new Promise(function (res) { if (E.fadeBlack === v) res(); else E.fadeDone = res; });
  };

  E.serialize = function () { return { hour: E.hour, weather: E.weather, wet: E.wet, horror: E.horrorGoal }; };
  E.restore = function (o) { if (!o) return; E.set({ hour: o.hour, weather: o.weather, horror: o.horror }, true); E.wet = o.wet || 0; };
  E.set({ time: 'evening', weather: 'clear' }, true);
  return E;
})();
