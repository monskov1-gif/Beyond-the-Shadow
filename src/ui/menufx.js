/* Main-menu staging: a slow cinematic drift over the night village (fair → square → hill → church →
   east street), a few villagers by the fair bonfire, and a shadow-theatre overlay drawn on a 2D canvas:
   a lantern that follows the pointer / the focused item, a cut-paper frieze along the bottom with a boy
   whose shadow on the backdrop is cast by that lantern — and lags behind it. */
'use strict';
BTS.MenuFX = (function () {
  var F = { cam: null };
  var M = BTS.M;

  /* ---------------- camera path ---------------- */
  // subject point [x, z], camera dist, pitch. The subject is pushed right of centre while the menu is on the left.
  var PATH = [
    [87, 79, 34, 0.36],    // fair: maypole and the bonfire ring
    [52, 48, 33, 0.47],    // the square with the well
    [55, 14, 31, 0.42],    // the hill, Đorđe's house
    [86, 25, 30, 0.40],    // church and graveyard
    [91, 55, 33, 0.42]     // east street, Gorazd's house
  ];
  var SPEED = 0.5;         // world units per second along the path
  var segLen = PATH.map(function (p, i) { var q = PATH[(i + 1) % PATH.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]); });
  function cr(a, b, c, d, t) { var t2 = t * t, t3 = t2 * t; return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); }
  function sample(u) {
    var n = PATH.length, i = Math.floor(u) % n, f = u - Math.floor(u);
    var a = PATH[(i + n - 1) % n], b = PATH[i], c = PATH[(i + 1) % n], d = PATH[(i + 2) % n];
    // ease inside each segment so the camera lingers on every subject
    var e = f * f * (3 - 2 * f) * 0.6 + f * 0.4;
    return [0, 1, 2, 3].map(function (k) { return cr(a[k], b[k], c[k], d[k], e); });
  }
  F.startCamera = function () { F.cam = { u: 0, t: 0 }; };
  F.stopCamera = function () { F.cam = null; };
  F.updateCamera = function (dt) {
    var c = F.cam; if (!c) return;
    c.t += dt;
    var i = Math.floor(c.u) % PATH.length;
    c.u += dt * SPEED / Math.max(4, segLen[i]);
    var s = sample(c.u), C = BTS.Camera;
    var intro = M.smooth(0, 6, c.t);                     // opening crane-down onto the fair
    var dist = s[2] + (1 - intro) * 14, pitch = s[3] + (1 - intro) * 0.16;
    var asp = window.innerWidth / Math.max(1, window.innerHeight);
    var landscape = asp > 1.05;
    var w = 2 * dist * Math.tan(0.25) * asp;
    var off = landscape ? -w * 0.17 : 0;
    C.cine = null;
    C.setPreset({ pitch: pitch, dist: dist, fov: 0.5, yaw: 0 }, true);
    C.target = [s[0] + off, 2 + (1 - intro) * 2, s[1] + (landscape ? 0 : 3)];
  };
  // the menu backdrop in game.js points the camera every frame; take over while the menu staging runs
  var camUpdate = BTS.Camera.update;
  BTS.Camera.update = function (dt, follow) {
    if (F.cam && BTS.Game && BTS.Game.mode === 'menu') F.updateCamera(dt || 0);
    else if (F.cam && BTS.Game && BTS.Game.mode !== 'menu') F.cam = null;
    return camUpdate.call(BTS.Camera, dt, follow);
  };

  /* ---------------- stage dressing ---------------- */
  F.stage = function () {
    var W = BTS.World;
    if (!W.loc || W.locId !== 'village') return;
    BTS.Env.set({ time: 'night', weather: 'overcast', horror: 0.12, interior: false }, true);
    var fx = 90.5, fz = 82;
    var folk = [['dancer1', 0.3, 'idle'], ['vil_old', 1.3, 'idle'], ['dancer2', 2.4, 'wander'], ['vil_man2', 3.5, 'idle'], ['vil_woman2', 4.6, 'idle'], ['vil_boy', 5.5, 'wander']];
    folk.forEach(function (f, i) {
      if (!BTS.CharSprites.sheets[f[0]]) return;
      var x = fx + Math.cos(f[1]) * 3.1, z = fz + Math.sin(f[1]) * 2.3;
      var dir = Math.abs(x - fx) > Math.abs(z - fz) ? (x > fx ? 'left' : 'right') : (z > fz ? 'up' : 'down');
      var e = new BTS.Entity({ id: 'menu_folk' + i, kind: 'npc', sheet: f[0], x: x, z: z, dir: dir, speed: 1.1 });
      e.brain = new BTS.Brain('villager');
      e.brain.setTask({ at: [x, z], act: f[2], dir: dir, radius: 1.4 }, e, true);
      W.addEntity(e);
    });
  };

  /* ---------------- shadow-theatre overlay ---------------- */
  var rng = function (seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; };

  F.attach = function (screenEl) {
    var cv = document.createElement('canvas'); cv.className = 'mm-fx';
    screenEl.insertBefore(cv, screenEl.firstChild);
    var st = {
      cv: cv, g: cv.getContext('2d'), w: 0, h: 0, dpr: 1, t: 0,
      light: null, goal: [0, 0], shadowL: null, lastPointer: -10, lag: 1.4, twitch: 12 + Math.random() * 8,
      motes: [], frieze: null
    };
    var onMove = function (e) { st.goal = [e.clientX, e.clientY]; st.lastPointer = st.t; };
    screenEl.addEventListener('pointermove', onMove);
    screenEl.addEventListener('pointerdown', onMove);
    st.detach = function () { screenEl.removeEventListener('pointermove', onMove); screenEl.removeEventListener('pointerdown', onMove); };
    return st;
  };

  function resize(st) {
    var w = st.cv.clientWidth || window.innerWidth, h = st.cv.clientHeight || window.innerHeight;
    var dpr = BTS.Device.dpr(1.5);
    if (w === st.w && h === st.h && dpr === st.dpr) return;
    st.w = w; st.h = h; st.dpr = dpr;
    st.cv.width = Math.round(w * dpr); st.cv.height = Math.round(h * dpr);
    buildFrieze(st);
    if (!st.light) { st.light = [w * 0.3, h * 0.42]; st.goal = st.light.slice(); st.shadowL = st.light.slice(); }
  }

  /* the cut-paper strip: rolling ground with grass, a wattle fence, a maypole with ribbons */
  function buildFrieze(st) {
    var w = st.w, h = st.h, r = rng(7);
    var portrait = h > w * 1.05;
    var base = h - Math.min(h * 0.075, 46), amp = Math.min(h * 0.03, 16);
    var ground = [];
    for (var x = -10; x <= w + 10; x += 6) {
      var y = base - Math.sin(x / w * 5.2 + 0.6) * amp * 0.6 - Math.sin(x / w * 13 + 2) * amp * 0.25;
      ground.push([x, y]);
    }
    var tufts = [];
    for (var i = 0; i < Math.round(w / 9); i++) tufts.push([r() * w, 4 + r() * 11, (r() - 0.5) * 0.7, r() * 6.28]);
    var figX = portrait ? w * 0.7 : w * 0.64;
    var fence = { x0: figX + w * 0.06, x1: figX + w * (portrait ? 0.2 : 0.16), n: portrait ? 6 : 9 };
    st.frieze = { ground: ground, tufts: tufts, base: base, figX: figX, fence: fence, poleX: portrait ? w * 0.9 : w * 0.88, figH: Math.min(h * 0.17, 120) * (portrait ? 0.85 : 1), crows: [[fence.x0 + (fence.x1 - fence.x0) * 0.3, r()], [fence.x0 + (fence.x1 - fence.x0) * 0.75, r()]] };
  }
  function groundAt(st, x) {
    var gr = st.frieze.ground, i = M.clamp(Math.floor((x + 10) / 6), 0, gr.length - 2), a = gr[i], b = gr[i + 1];
    return M.lerp(a[1], b[1], M.clamp((x - a[0]) / 6, 0, 1));
  }

  /* boy silhouette, feet at (0,0), height H, facing +x; shaggy hair, hoodie, backpack */
  function boyPath(g, H, t, tilt) {
    g.beginPath();
    var u = H / 100;
    var sw = Math.sin(t * 1.3) * 0.6;          // slight breathing sway
    // legs
    g.rect(-9 * u, -46 * u, 7.5 * u, 46 * u); g.rect(2 * u, -46 * u, 7.5 * u, 46 * u);
    // shoes
    g.rect(-10 * u, -4 * u, 11 * u, 4 * u); g.rect(1.5 * u, -4 * u, 11 * u, 4 * u);
    // torso (hoodie)
    g.moveTo(-14 * u, -44 * u); g.lineTo(14 * u, -44 * u); g.lineTo(13 * u + sw, -76 * u); g.quadraticCurveTo(0, -82 * u, -13 * u + sw, -76 * u); g.closePath();
    // backpack on the back (-x)
    g.moveTo(-12 * u, -50 * u); g.lineTo(-22 * u, -52 * u); g.quadraticCurveTo(-25 * u, -66 * u, -20 * u + sw, -76 * u); g.lineTo(-11 * u + sw, -77 * u); g.closePath();
    // arm hanging in front
    g.moveTo(8 * u, -74 * u); g.lineTo(15 * u, -72 * u); g.lineTo(14 * u, -46 * u); g.lineTo(9 * u, -46 * u); g.closePath();
    // neck + head with shaggy fringe
    var hx = 1 * u + sw, hy = -90 * u;
    g.rect(-3 * u + sw, -82 * u, 6 * u, 5 * u);
    g.moveTo(hx + 11 * u, hy);
    g.save(); g.translate(hx, hy); g.rotate(tilt || 0);
    g.arc(0, 0, 11 * u, 0, Math.PI * 2);
    g.restore();
    // hair spikes
    var spikes = [[-12, -2], [-10, -10], [-4, -14], [3, -13], [10, -9], [13, -2], [14, 3]];
    g.moveTo(hx - 12 * u, hy + 4 * u);
    spikes.forEach(function (s, k) { g.lineTo(hx + (s[0] + (k % 2 ? 2 : -1)) * u, hy + (s[1] - 4) * u); g.lineTo(hx + s[0] * u, hy + s[1] * u); });
    g.lineTo(hx + 13 * u, hy + 6 * u); g.lineTo(hx + 8 * u, hy + 1 * u); g.lineTo(hx - 10 * u, hy + 8 * u); g.closePath();
  }

  F.update = function (st, dt, focusEl) {
    if (!st) return;
    resize(st);
    st.t += dt;
    var w = st.w, h = st.h, fr = st.frieze;
    // where the lantern wants to be: the pointer, else the focused item, else a slow idle wander
    if (st.t - st.lastPointer > 2.5) {
      if (focusEl && focusEl.getBoundingClientRect && st.t - st.lastPointer > 2.5) {
        var r = focusEl.getBoundingClientRect();
        if (r.width) st.goal = [Math.min(w - 40, r.left + Math.min(r.width, 280) + 34), r.top + r.height / 2];
      }
      if (st.t - st.lastPointer > 9) st.goal = [w * (0.36 + 0.08 * Math.sin(st.t * 0.21)), h * (0.4 + 0.12 * Math.sin(st.t * 0.17 + 1))];
    }
    var k = 1 - Math.exp(-dt * 6);
    st.light[0] += (st.goal[0] - st.light[0]) * k; st.light[1] += (st.goal[1] - st.light[1]) * k;
    // the shadow follows the light late — and now and then it hesitates
    st.twitch -= dt;
    if (st.twitch < 0) { st.lag = 0.25; if (st.twitch < -2.2) { st.lag = 1.4; st.twitch = 12 + Math.random() * 10; } }
    var ks = 1 - Math.exp(-dt * st.lag);
    st.shadowL[0] += (st.light[0] - st.shadowL[0]) * ks; st.shadowL[1] += (st.light[1] - st.shadowL[1]) * ks;
    draw(st);
  };

  function draw(st) {
    var g = st.g, w = st.w, h = st.h, fr = st.frieze, L = st.light, t = st.t;
    g.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    var flick = 0.92 + 0.05 * Math.sin(t * 11) * Math.sin(t * 3.7) + 0.03 * Math.sin(t * 23);
    // night closes in everywhere except around the lantern
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(2,2,6,0.26)'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    var R = Math.max(w, h) * 0.36 * flick;
    var hole = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], R);
    hole.addColorStop(0, 'rgba(0,0,0,1)'); hole.addColorStop(0.55, 'rgba(0,0,0,0.55)'); hole.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hole; g.fillRect(0, 0, w, h);
    // warm lantern light
    g.globalCompositeOperation = 'lighter';
    var glow = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], R * 0.75);
    glow.addColorStop(0, 'rgba(255,190,110,' + (0.2 * flick).toFixed(3) + ')'); glow.addColorStop(0.35, 'rgba(230,120,60,0.07)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';

    // the boy's shadow on the backdrop: thrown away from the (lagging) light, larger when the light is near
    var fx = fr.figX, fy = groundAt(st, fx), H = fr.figH, S = st.shadowL;
    var dx = fx - S[0], dy = (fy - H * 0.5) - S[1], dl = Math.hypot(dx, dy) || 1;
    var grow = 1.55 + M.clamp(260 / dl, 0, 1.3);
    var sx = fx + dx / dl * Math.min(dl * 0.28, 90), sy = fy + Math.max(-10, dy / dl * 22);
    var faceL = L[0] < fx;
    g.save();
    g.translate(sx, sy);
    g.transform(1, 0, M.clamp(dx / Math.max(80, Math.abs(dy) + 120), -0.7, 0.7) * -1, 1, 0, 0);
    g.scale((faceL ? -1 : 1) * grow, grow);
    try { g.filter = 'blur(' + (0.6 + grow * 0.4).toFixed(1) + 'px)'; } catch (e) { }
    g.fillStyle = 'rgba(0,0,0,0.74)';
    boyPath(g, H, t * 0.6, st.lag < 1 ? 0.25 : 0);
    g.fill();
    try { g.filter = 'none'; } catch (e) { }
    g.restore();

    // cut-paper frieze
    var ink = '#0b0809';
    var rim = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], R * 0.9);
    rim.addColorStop(0, 'rgba(255,186,110,0.9)'); rim.addColorStop(0.5, 'rgba(200,110,60,0.35)'); rim.addColorStop(1, 'rgba(120,60,40,0.05)');
    // maypole with streamers and wreaths
    var px = fr.poleX, py = groundAt(st, px), ph = Math.min(h * 0.42, 300);
    g.fillStyle = ink;
    g.fillRect(px - 3, py - ph, 6, ph);
    g.beginPath(); g.arc(px, py - ph, 9, 0, 7); g.fill();
    g.fillRect(px - 32, py - ph * 0.8, 64, 3);
    [-1, 1].forEach(function (sd) {
      g.beginPath(); g.lineWidth = 4; g.strokeStyle = ink;
      g.arc(px + sd * 30, py - ph * 0.8 + 22 + Math.sin(t * 1.1 + sd) * 1.5, 13, 0, 7); g.stroke();
    });
    for (var i = 0; i < 6; i++) {
      var ang = (i - 2.5) * 0.16, len = ph * (0.55 + (i % 3) * 0.08);
      g.beginPath(); g.moveTo(px, py - ph + 6);
      for (var s = 1; s <= 10; s++) {
        var q = s / 10, wv = Math.sin(t * 2.2 + i * 1.3 + q * 6) * 9 * q;
        g.lineTo(px + Math.sin(ang) * len * q * 0.55 + wv, py - ph + 6 + q * len * Math.cos(ang) * 0.9);
      }
      g.lineWidth = 2.2; g.strokeStyle = ink; g.stroke();
    }
    // wattle fence + crows
    var fe = fr.fence;
    g.fillStyle = ink;
    for (i = 0; i < fe.n; i++) {
      var qx = fe.x0 + (fe.x1 - fe.x0) * i / (fe.n - 1), qy = groundAt(st, qx);
      g.fillRect(qx - 2, qy - 34 - (i % 2) * 4, 4, 36 + (i % 2) * 4);
    }
    for (var band = 0; band < 3; band++) {
      g.beginPath();
      for (i = 0; i <= 24; i++) { var bx = fe.x0 - 4 + (fe.x1 - fe.x0 + 8) * i / 24; g.lineTo(bx, groundAt(st, bx) - 10 - band * 9 + Math.sin(i * 1.7 + band) * 1.5); }
      g.lineWidth = 3.5; g.strokeStyle = ink; g.stroke();
    }
    fr.crows.forEach(function (c, ci) {
      var cx = c[0], cy = groundAt(st, cx) - 38 - (ci % 2) * 4, bob = Math.sin(t * 0.9 + ci * 2) > 0.96 ? -2 : 0;
      g.beginPath(); g.ellipse(cx, cy - 5 + bob, 7, 5, -0.2, 0, 7); g.fill();
      g.beginPath(); g.arc(cx + 6, cy - 10 + bob, 3.6, 0, 7); g.fill();
      g.beginPath(); g.moveTo(cx + 9, cy - 11 + bob); g.lineTo(cx + 14, cy - 9.5 + bob); g.lineTo(cx + 9, cy - 8.5 + bob); g.fill();
      g.beginPath(); g.moveTo(cx - 6, cy - 4); g.lineTo(cx - 14, cy + 1); g.lineTo(cx - 5, cy - 1); g.fill();
    });
    // ground + grass
    g.beginPath(); g.moveTo(-10, h + 2);
    fr.ground.forEach(function (p) { g.lineTo(p[0], p[1]); });
    g.lineTo(w + 10, h + 2); g.closePath(); g.fillStyle = ink; g.fill();
    g.beginPath();
    fr.tufts.forEach(function (tf) {
      var gx = tf[0], gy = groundAt(st, gx) + 1, sway = Math.sin(t * 1.4 + tf[3]) * 2;
      g.moveTo(gx - 2, gy); g.lineTo(gx + tf[2] * 6 + sway, gy - tf[1]); g.lineTo(gx + 2, gy);
    });
    g.fill();
    // the boy, turned toward the lantern
    // (rim: the lit silhouette first, then the dark one nudged away from the light)
    var lx = L[0] - fx, ly = L[1] - (fy - H * 0.6), ll = Math.hypot(lx, ly) || 1;
    g.save(); g.translate(fx, fy + 1); g.scale(faceL ? -1 : 1, 1);
    boyPath(g, H, t, 0); g.fillStyle = rim; g.fill();
    g.restore();
    g.save(); g.translate(fx - lx / ll * 1.6, fy + 1 - ly / ll * 1.6); g.scale(faceL ? -1 : 1, 1);
    boyPath(g, H, t, 0); g.fillStyle = ink; g.fill();
    g.restore();
    // rim light along the frieze top facing the lantern
    g.beginPath(); fr.ground.forEach(function (p, k) { if (k) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); });
    g.lineWidth = 1.5; g.strokeStyle = rim; g.globalAlpha = 0.55; g.stroke(); g.globalAlpha = 1;

    // the lantern: a small flame with drifting sparks
    if (st.motes.length < 14 && Math.random() < 0.25) st.motes.push({ x: L[0] + (Math.random() - 0.5) * 10, y: L[1], vx: (Math.random() - 0.5) * 14, vy: -12 - Math.random() * 18, a: 1, s: 0.8 + Math.random() * 1.4 });
    g.globalCompositeOperation = 'lighter';
    st.motes = st.motes.filter(function (m) {
      m.x += m.vx * 0.016 + Math.sin(t * 3 + m.s * 9) * 0.25; m.y += m.vy * 0.016; m.a -= 0.012;
      if (m.a <= 0) return false;
      g.fillStyle = 'rgba(255,170,90,' + (m.a * 0.7).toFixed(3) + ')'; g.fillRect(m.x, m.y, m.s, m.s);
      return true;
    });
    var core = g.createRadialGradient(L[0], L[1], 0, L[0], L[1], 22 * flick);
    core.addColorStop(0, 'rgba(255,236,190,0.95)'); core.addColorStop(0.25, 'rgba(255,170,80,0.55)'); core.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = core; g.beginPath(); g.arc(L[0], L[1], 22 * flick, 0, 7); g.fill();
    g.globalCompositeOperation = 'source-over';
  }

  /* where the light is relative to an element: used by CSS to throw the logo's shadow away from it */
  F.shadowOffset = function (st, el) {
    if (!st || !st.shadowL || !el) return [0, 0];
    var r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var dx = cx - st.shadowL[0], dy = cy - st.shadowL[1], d = Math.hypot(dx, dy) || 1, k = Math.min(1, 260 / d) * 0.6 + 0.4;
    return [dx / d * 6 * k, dy / d * 5 * k + 2];
  };
  return F;
})();
