/* CHAPTER 8 — the legend. CHAPTER 9 — rising threat. CHAPTER 10 — the rite. CHAPTER 11 — release. EPILOGUE. */
'use strict';
(function () {
  var D = BTS.D, U = BTS.StoryUtil, when = U.when, add = U.add, S = BTS.State, A = BTS.SpotAt;
  var LISA_FOLLOW = { loc: '*', follow: true, act: 'idle' };
  function setSheet(id) { var p = BTS.World.player; p.add('anim', new BTS.Animator(id)); }

  /* ---------- the rite (chapter 10): a writhing shadow-beast whose head must be pierced ---------- */
  var R = null;
  var RING = [90.5, 82];
  BTS.Rite = { get: function () { return R; } };
  /* dev: replay the last moments of chapter 11 in place (outskirts field) — used by the staging screenshots */
  BTS.Rite.testSink = function () {
    BTS.Cutscene.play(function (C) {
      C.load('outskirts', 'field_mid'); C.env({ time: 'night', weather: 'rain', horror: 0.8 }, true); C.hide('player', true);
      var jj = C.spawn('jaglika', [42, 36.5], { noTalk: true, dir: 'left' }); if (jj.brain) { jj.brain.paused = true; jj.keepPaused = true; } jj.shadow.visible = false; jj.anim.lock = 'fear';
      var sh = []; for (var i = 0; i < 20; i++) { var a = i / 20 * 6.283; sh.push(makeShade(C, i, 42 + Math.cos(a) * 2, 36.5 + Math.sin(a) * 1.6)); }
      C.keyLight(42, 36.5, { color: [0.5, 0.58, 0.85], radius: 7, intensity: 1.25, kind: 'fill', dz: 1.8 });
      return C.cam({ target: [42, 0.5, 36.5], dist: 13, time: 0.5 }).then(function () { return sinkScene(C, jj, sh, 42, 36.5); });
    }, 'test_sink');
  };
  function riteStart(W) {
    R = { t: 0, head: [RING[0] + 3, RING[1] - 1], ang: 0, freeze: 0, nextStrike: 5, misses: 0, knock: 0, onShadow: 0, said: {}, done: false, cool: 0 };
    var j = W.get('jaglika');
    if (j) { j.shadow.beast = 0.9; j.shadow.visible = false; if (j.brain) { j.brain.paused = true; j.keepPaused = true; } j.anim.lock = 'point'; }
    W.extraRender = riteRender;
  }
  function headPos(t) { var a = t * 0.45, r = 3.2 + Math.sin(t * 0.7) * 1.1; return [RING[0] + Math.cos(a) * r, RING[1] + Math.sin(a) * r * 0.75]; }
  function riteTick(dt, W) {
    if (!R || R.done || W.locId !== 'village') return;
    var p = W.player, j = W.get('jaglika'); if (!j) return;
    R.t += dt; R.cool -= dt;
    if (R.freeze > 0) { R.freeze -= dt; if (R.freeze <= 0) BTS.Env.supernatural = 0.8; }
    else { R.head = headPos(R.t); R.nextStrike -= dt; }
    if (R.freeze <= 0 && R.nextStrike <= 0) {
      BTS.Env.strike();
      R.freeze = R.misses >= 2 ? 2.8 : 1.8; R.nextStrike = 6 + Math.random() * 3; BTS.Env.supernatural = 0;
      BTS.Audio.play('shadow_stretch', {});
      if (!R.said.freeze) { R.said.freeze = true; say('c10_hint_freeze'); }
    }
    // standing on the beast's body slows Đorđe and whispers at him
    var hx = R.head[0], hz = R.head[1];
    var segd = distToSeg(p.x, p.z, j.x, j.z, hx, hz);
    var on = segd < 1.1;
    W.speedMul = on ? 0.55 : 1;
    if (on) { R.onShadow += dt; if (R.onShadow > 0.8 && !R.said.fear) { R.said.fear = true; say('c10_fear'); } }
    var dh = Math.hypot(p.x - hx, p.z - hz);
    if (BTS.Input.pressed.interact && R.cool <= 0 && !BTS.Cutscene.running) {
      BTS.Input.consume('interact');
      if (dh < 1.6 && R.freeze > 0) { R.done = true; W.speedMul = 1; BTS.Story.goto('c11_release', true); return; }
      R.cool = 1.2; R.misses++;
      var ax = p.x - j.x, az = p.z - j.z, al = Math.hypot(ax, az) || 1;
      p.x += ax / al * 2.5; p.z += az / al * 2.5; BTS.Physics.resolve(p, W.colliders, W.entities);
      BTS.Camera.shake = 1; BTS.Audio.play('shadow_detach', {});
      if (p.shadow) p.shadow.setStage(Math.min(2, R.misses));
      say(dh < 1.6 ? 'c10_miss_early' : 'c10_miss_far');
    }
    if (dh < 2.2 && R.freeze > 0 && !R.said.now) { R.said.now = true; say('c10_now'); }
  }
  function say(id) { BTS.Cutscene.play(function (C) { return C.say(id); }, id); }
  function distToSeg(px, pz, ax, az, bx, bz) { var dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, t = l ? BTS.M.clamp(((px - ax) * dx + (pz - az) * dz) / l, 0, 1) : 0; return Math.hypot(px - ax - dx * t, pz - az - dz * t); }
  function riteRender(Rd, env) {
    if (!R) return;
    var W = BTS.World, j = W.get('jaglika'); if (!j || j.hidden) return;
    var t = BTS.App.time, hx = R.head[0], hz = R.head[1];
    var reg = BTS.Atlas.get('shadow_beast_' + (R.freeze > 0 ? 1 : Math.floor(t * 4) % 4));
    var dx = hx - j.x, dz = hz - j.z, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
    var gw = BTS.Shadows.jaglikaGrowth().width / 1.45;   // the same growth curve as her shadow everywhere else (1 at the rite)
    var w = (2.6 + (R.freeze > 0 ? 0.6 : Math.sin(t * 3) * 0.4)) * gw, px = -uz * w / 2, pz = ux * w / 2;
    var y0 = W.heightAt(j.x, j.z) + 0.05, y1 = W.heightAt(hx, hz) + 0.05, hl = len + 1.2;
    var ex = j.x + ux * hl, ez = j.z + uz * hl;
    var a = R.freeze > 0 ? 0.92 : 0.7;
    Rd.pushFx(0, [[j.x - px, y0, j.z - pz], [j.x + px, y0, j.z + pz], [ex + px, y1, ez + pz], [ex - px, y1, ez - pz]], reg, [0.01, 0, 0.02, a]);
    // the head: a pulsing dark knot; during the freeze a faint pale rim marks the moment
    var hr = 0.9 + (R.freeze > 0 ? 0.25 : Math.sin(t * 6) * 0.1);
    Rd.pushFx(3, [[hx - hr, y1 + 0.02, hz + hr], [hx + hr, y1 + 0.02, hz + hr], [hx + hr, y1 + 0.02, hz - hr], [hx - hr, y1 + 0.02, hz - hr]], BTS.Atlas.get('soft_dot'), [0, 0, 0.02, 0.95]);
    if (R.freeze > 0) Rd.pushFx(2, [[hx - 1.4, y1 + 0.03, hz + 1.4], [hx + 1.4, y1 + 0.03, hz + 1.4], [hx + 1.4, y1 + 0.03, hz - 1.4], [hx - 1.4, y1 + 0.03, hz - 1.4]], BTS.Atlas.get('soft_dot'), [0.6, 0.65, 0.9, 0.18 + 0.1 * Math.sin(t * 20)]);
    // shadow climbing the maypole and stalls (walls)
    var sway = Math.sin(t * 1.4) * 0.5, wy = W.heightAt(84, 76.5);
    Rd.pushFx(3, [[83.2, wy, 76.9], [84.8, wy, 76.9], [85.2 + sway, wy + 6, 76.9], [82.8 + sway, wy + 6, 76.9]], BTS.Atlas.get('shadow_beast_2'), [0.01, 0, 0.02, 0.55]);
  }

  /* ---------- the lantern procession (e_final, ~20 s, Action skips): children with paper lanterns walk round the
     bonfire; by its light their shadows wheel round the ring like the spokes of a cartwheel. Đorđe's shadow turns with them. ---------- */
  function hop2(C, ids, dur) {
    var t = 0, es = ids.map(function (id) { return BTS.World.get(id); }).filter(Boolean);
    C.ticker(function (dt) { t += dt; es.forEach(function (e, i) { e.lift = t < dur ? Math.max(0, Math.sin(t * 6 + i * 1.9)) * 0.34 : 0; }); return t < dur; });
  }
  function lanternProcession(C) {
    var W = BTS.World, F = [90.5, 82.2], N = 8, R0 = 3.6, walkers = [], lamps = [], t = 0, done = false;
    var sheets = ['mila', 'luka', 'vil_boy', 'dancer1', 'dancer2', 'vil_woman1', 'vil_boy', 'dancer1'];
    for (var i = 0; i < N; i++) {
      var a = i / N * 6.283, e;
      if (i < 2 && W.get(sheets[i])) { e = W.get(sheets[i]); if (e.brain) e.brain.paused = true; }
      else { e = new BTS.Entity({ id: 'lantern_kid' + i, kind: 'npc', sheet: sheets[i], x: F[0] + Math.cos(a) * (R0 + 6), z: F[1] + Math.sin(a) * (R0 + 6) * 0.8 }); e.solid = false; W.addEntity(e); }
      e.noClip = true; e.path = null; walkers.push(e);
      var lan = new BTS.Entity({ id: 'lantern' + i, sprite: 'lantern_paper', x: e.x, z: e.z, shadow: false }); lan.solid = false; lan.emissive = true; lan.lift = 1.0; lan.scale = 1.2; W.addEntity(lan);
      lamps.push({ e: lan, l: C.light({ x: e.x, y: 1.2, z: e.z, color: [1, 0.55, 0.3], radius: 2.4, intensity: 0.7, kind: 'fill', flicker: 0.1, cs: true }) });
    }
    C.frame([F], { dist: 18, pitch: 0.7, time: 2.0 });
    C.music('fair', 1.5);
    var p = W.player;
    return new Promise(function (res) {
      C.ticker(function (dt) {
        t += dt;
        var skip = t > 1.5 && BTS.Input && BTS.Input.pressed && BTS.Input.pressed.interact;
        walkers.forEach(function (e, k) {
          var a = k / N * 6.283 + t * 0.32, r = t < 4 ? R0 + 6 * (1 - t / 4) : R0;     // they gather, then circle
          var nx = F[0] + Math.cos(a) * r, nz = F[1] + Math.sin(a) * r * 0.8;
          e.faceTo(nx + (nx - e.x) * 5, nz + (nz - e.z) * 5); e.x = nx; e.z = nz; e.moving = true;
          if (e.anim) e.anim.set('walk'), e.anim.speed = 0.6;
          lamps[k].e.x = nx + 0.25; lamps[k].e.z = nz + 0.05; lamps[k].l.x = nx + 0.25; lamps[k].l.z = nz + 0.1; lamps[k].l.y = W.heightAt(nx, nz) + 1.2;
        });
        if (t > 9 && p && !p._joined) { p._joined = true; C.walk('player', [F[0] + R0 + 1.6, F[1] + 1.2], { dir: 'left' }); }   // he steps up to the ring and stays
        if (t > 22 || skip) {
          if (skip) BTS.Input.consume && BTS.Input.consume('interact');
          walkers.forEach(function (e) { e.moving = false; if (e.anim) e.anim.speed = 1; if (/^lantern_kid/.test(e.id)) W.removeEntity(e.id); });
          lamps.forEach(function (q) { W.removeEntity(q.e.id); C.unlight(q.l); });
          if (p) p._joined = false;
          res(); return false;
        }
      });
    });
  }

  /* ---------- final titles: what became of Đorđe (and the others) ---------- */
  var ENDING_CARDS = [['e.t1', 'e.s1'], ['e.t2', 'e.s2'], ['e.t3', 'e.s3'], ['e.t4', 'e.s4'], ['e.t5', 'e.s5'], ['e.t6', 'e.s6'], ['e.t7', 'e.s7'], ['e.t8', 'e.s8'], ['e.t9', 'e.s9'], ['e.t10', null, 6]];

  /* ---------- climax helpers ---------- */
  /* the people she took, in the order they step out of her torn shadow: the four Đorđe names first */
  var VICTIMS = ['zajko', 'gvozdin', 'pecko', 'jessica', 'gorazd', 'tihomir', 'vil_man1', 'vil_woman1', 'vil_old', 'vil_woman2', 'vil_man2', 'vil_boy', 'dancer1', 'dancer2', 'vil_old', 'vil_woman1', 'vil_man1', 'vil_woman2', 'vil_man2', 'dancer1'];
  /* a shade: a black silhouette of a victim. Ghost (no collisions), rises out of the ground where it is born. */
  function makeShade(C, i, x, z, rise) {
    var e = new BTS.Entity({ id: 'shade' + i, kind: 'npc', sheet: VICTIMS[i % VICTIMS.length], x: x, z: z, speed: 3.2 + (i % 5) * 0.12, shadow: false });
    e.tint = [0.02, 0.02, 0.05]; e.solid = false; e.noClip = true; e.shade = true;
    BTS.World.addEntity(e);
    if (rise) { e.lift = -1.9; e.alpha = 0; C.tween(rise, function (k) { e.lift = -1.9 * (1 - k) * (1 - k); e.alpha = Math.min(1, k * 1.6); }); }
    return e;
  }
  /* a route through open ground: the waypoints are joined by navigation paths, so it never runs into a wall */
  function navRoute(pts) {
    var W = BTS.World, out = [pts[0].slice()];
    for (var i = 1; i < pts.length; i++) {
      var a = out[out.length - 1], seg = W.findPath(a[0], a[1], pts[i][0], pts[i][1]) || [pts[i].slice()];
      seg.forEach(function (q) { var l = out[out.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.05) out.push([q[0], q[1]]); });
    }
    var cum = [0]; for (i = 1; i < out.length; i++) cum.push(cum[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
    return { pts: out, cum: cum, len: cum[cum.length - 1], at: function (s) {
      s = BTS.M.clamp(s, 0, this.len); var k = 1; while (k < cum.length - 1 && cum[k] < s) k++;
      var a = out[k - 1], b = out[k], f = (s - cum[k - 1]) / Math.max(1e-4, cum[k] - cum[k - 1]);
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    } };
  }
  /* the chase: Jaglika runs the route at a constant speed (through nothing — the route is clear, and she is a ghost
     to colliders anyway); the shades follow her trail at a lag, spread across it, never faster than a run.
     Resolves when she reaches the end. Optional slowAt: distance from the end where she starts to stumble. */
  function runRoute(C, j, shades, R0, speed, o) {
    o = o || {};
    var s = 0, t = 0;
    j.noClip = true; j.path = null; if (j.brain) { j.brain.paused = true; j.keepPaused = true; } if (j.anim) j.anim.lock = null;
    return new Promise(function (res) {
      C.ticker(function (dt) {
        t += dt;
        var left = R0.len - s, sp = speed * (o.slowAt && left < o.slowAt ? 0.45 + 0.55 * left / o.slowAt : 1);
        var q0 = R0.at(s); s = Math.min(R0.len, s + sp * dt); var q = R0.at(s);
        j.x = q[0]; j.z = q[1]; if (Math.hypot(q[0] - q0[0], q[1] - q0[1]) > 1e-4) j.faceTo(q[0] + (q[0] - q0[0]) * 9, q[1] + (q[1] - q0[1]) * 9);
        if (j.anim) j.anim.set(sp > 2.4 ? 'run' : 'walk'); j.moving = true;
        if (o.onS) o.onS(s, R0.len);
        shades.forEach(function (e, i) {
          var lagS = 2.2 + i * 0.55, side = Math.sin(i * 2.17 + t * 1.3) * (0.7 + (i % 4) * 0.35);
          var a = R0.at(Math.max(0, s - lagS)), b2 = R0.at(Math.max(0, s - lagS + 0.4)), dx = b2[0] - a[0], dz = b2[1] - a[1], dl = Math.hypot(dx, dz) || 1;
          var gx = a[0] - dz / dl * side, gz = a[1] + dx / dl * side;
          var ex = gx - e.x, ez = gz - e.z, ed = Math.hypot(ex, ez), mv = Math.min(ed, (speed * 1.25) * dt);
          if (ed > 1e-3) { e.x += ex / ed * mv; e.z += ez / ed * mv; e.faceTo(gx + ex, gz + ez); }
          if (e.anim) e.anim.set(ed > 0.15 ? 'run' : 'idle');
        });
        if (s >= R0.len) { j.moving = false; res(); return false; }
      });
    });
  }
  /* the earth opening under her: a darkening pool, cracks running out from it, closing again */
  var SINK = null;
  function sinkRender(Rd) {
    if (!SINK) return;
    var W = BTS.World, x = SINK.x, z = SINK.z, y = W.heightAt(x, z) + 0.04, r = SINK.r;
    if (r > 0.02) {
      var dot = BTS.Atlas.get('soft_dot');
      Rd.pushFx(0, [[x - r, y, z + r * 0.8], [x + r, y, z + r * 0.8], [x + r, y, z - r * 0.8], [x - r, y, z - r * 0.8]], dot, [0, 0, 0.01, 0.95]);
      Rd.pushFx(3, [[x - r * 1.5, y, z + r * 1.2], [x + r * 1.5, y, z + r * 1.2], [x + r * 1.5, y, z - r * 1.2], [x - r * 1.5, y, z - r * 1.2]], dot, [0.01, 0, 0.02, 0.6]);
    }
    var blob = BTS.Atlas.get('blob_shadow');
    SINK.cracks.forEach(function (c) {
      var L = c.len * SINK.crack; if (L < 0.05) return;
      var ux = Math.cos(c.a), uz = Math.sin(c.a) * 0.8, px = -uz * c.w, pz = ux * c.w;
      var x0 = x + ux * r * 0.6, z0 = z + uz * r * 0.6, x1 = x0 + ux * L, z1 = z0 + uz * L, y1 = W.heightAt(x1, z1) + 0.04;
      Rd.pushFx(0, [[x0 - px, y, z0 - pz], [x0 + px, y, z0 + pz], [x1 + px * 0.2, y1, z1 + pz * 0.2], [x1 - px * 0.2, y1, z1 - pz * 0.2]], blob, [0, 0, 0.01, 0.92 * SINK.crackA]);
    });
  }

  /* the end of her: the shades grab from all sides and drag her down; the ground cracks and darkens, she claws at it,
     screams, and the earth closes over. Impressionistic — silhouettes, darkness, shaking — nothing explicit. */
  function sinkScene(C, jj, shades, cx, cz) {
    var W = BTS.World;
    SINK = { x: cx, z: cz, r: 0, crack: 0, crackA: 1, cracks: [] };
    for (var i = 0; i < 11; i++) SINK.cracks.push({ a: i / 11 * 6.283 + Math.sin(i * 3.7) * 0.25, len: 1.2 + (i * 7 % 5) * 0.45, w: 0.09 + (i % 3) * 0.03 });
    W.extraRender = sinkRender;
    var done;
    var finished = new Promise(function (res) { done = res; });
    var claw = function (n) {   // between the jerks she claws at the earth
      var q = Promise.resolve();
      for (var k = 0; k < n; k++) q = q.then(function () { jj.anim.lock = 'interact'; jj.dir = 'down'; return C.wait(0.22); }).then(function () { jj.anim.lock = 'cower'; return C.wait(0.22); });
      return q;
    };
    var jerk = function (to, hard) {   // a pull from below: everything lurches down
      C.shake(hard ? 1.3 : 0.7); C.sfx('shadow_absorb', { vol: 0.8 }); if (hard) { C.sfx('sting_low', {}); BTS.Env.strike(); }
      var f = jj.lift || 0;
      shades.forEach(function (e, k) { var a = Math.atan2(cz - e.z, cx - e.x); e.x += Math.cos(a) * 0.25; e.z += Math.sin(a) * 0.25; e.lift = Math.min(e.lift || 0, to * (1.1 + (k % 3) * 0.15)); });
      return C.tween(0.18, function (k) { jj.lift = f + (to - f) * k; });
    };
    return C.say('c11_fall', { at: {
      1: function () {   // she falls to her knees; the ring closes; the ground under her starts to go dark
        jj.anim.lock = 'kneel'; C.shake(0.6); C.sfx('cloth', {});
        // the ring: tight behind her, crouched and a little wider in front so she stays in sight between them
        shades.forEach(function (e, k) { var a = k / shades.length * 6.283, front = Math.sin(a) > 0.15, r = (front ? 1.9 : 0.9) + (k % 2) * 0.3; e.front = front; e.path = [[cx + Math.cos(a) * r, cz + Math.sin(a) * r * 0.8]]; e.pathRun = false; e.pathSpeed = 0.5; });
        C.wait(1.2).then(function () { shades.forEach(function (e) { e.path = null; e.faceTo(cx, cz); if (e.anim) e.anim.lock = e.front ? 'cower' : 'interact'; if (e.front) C.tween(0.8, function (k) { e.lift = -0.7 * k; }); }); });   // the near ones half in the ground already, reaching
        C.tween(2.5, function (k) { SINK.r = 0.4 + k * 0.9; SINK.crack = k * 0.4; });
        C.cam({ target: [cx, 0.4, cz], dist: 11, time: 1.4 });
      },
      2: function () { jj.anim.lock = 'point'; jj.dir = 'down'; C.sfx('breath', { vol: 0.8 }); },   // a hand toward Đorđe
      3: function () {   // dragged down in jerks; she claws at the earth; a scream; the earth closes
        C.sfx('scream_far', {}); C.sfx('thunder', { vol: 0.5 });
        C.tween(1.2, function (k) { SINK.r = 1.3 + k * 0.7; SINK.crack = 0.4 + k * 0.6; });
        jerk(-0.35, true).then(function () { return claw(3); })
          .then(function () { return jerk(-0.8, false); }).then(function () { C.sfx('scream_far', {}); return claw(2); })
          .then(function () { return jerk(-1.3, true); }).then(function () { jj.anim.lock = 'interact'; return C.wait(0.5); })
          .then(function () { return jerk(-2.4, true); })
          .then(function () {
            jj.hidden = true; shades.forEach(function (e) { e.hidden = true; });
            C.particles({ type: 'smoke', x: cx, y: W.heightAt(cx, cz) + 0.1, z: cz, rate: 14, area: [2.2, 1.6], col: [0.2, 0.18, 0.17] });
            C.shake(1.6); C.sfx('anvil', { vol: 0.35 }); C.sfx('shadow_absorb', {});
            // the earth closes: the dark shrinks to nothing, the cracks fade
            return C.tween(1.6, function (k) { SINK.r = 2.0 * (1 - k) * (1 - k); SINK.crackA = 1 - k; });
          })
          .then(function () { SINK.r = 0; SINK.crackA = 0; done(); });
      }
    } }).then(function () { return finished; });
  }

  BTS.Story.define([
    /* ================= CHAPTER 8 ================= */
    { id: 'c8_chest', chapter: 'ch8', obj: 'obj.c8_chest', env: { time: 'night', weather: 'overcast', horror: 0.35 }, music: 'explore',
      npcs: { lisa: { loc: 'djordje_house', at: A('lisa_table', [6.4, 5.4]), act: 'idle', dir: 'left' } },
      interact: [{ loc: 'djordje_house', id: 'chest', at: A('chest', [8.7, 6.7]), label: 'it.chest', verb: 'verb.open', dlg: 'c8_chest', item: 'grandma_cloth', hint: true, sfx: 'drawer', then: 'c8_memory' }]
    },
    { id: 'c8_memory', chapter: 'ch8', loc: 'djordje_house', spawn: 'table', forceSpawn: true, chapterCard: 'loc.memory', chapterSub: 'sub.c8', obj: 'obj.c8_memory', music: 'memory', noSave: true,
      env: { time: 'evening', weather: 'clear', horror: 0 }, envInstant: true,
      npcs: { baka: { loc: 'djordje_house', at: A('baka_chair', [6.4, 3.8]), act: 'sit', dir: 'down', noTalk: true }, lisa: null },
      /* Grandmother's legend is performed as a shadow-puppet theatre (BTS.Theatre); the plain dialogue is the fallback */
      interact: [{ loc: 'djordje_house', id: 'baka_tale', at: A('baka_chair', [6.4, 3.8], 0, 0.9), label: 'name.baka', verb: 'verb.listen', hint: true, r: 1.8, run: function (C) {
        // the theatre resolves 'done' or 'abort'; on 'abort' (or without a theatre) the legend is told as dialogue.
        // fact_legend is granted by `clue` below in both cases.
        if (BTS.Theatre && BTS.Theatre.play) return Promise.resolve(BTS.Theatre.play()).then(function (how) { if (how === 'abort') return C.say('c8_legend'); }, function () { return C.say('c8_legend'); });
        return C.say('c8_legend');
      }, clue: 'fact_legend', then: 'c8_back' }],
      onPopulate: function () { setSheet('djordje_young'); BTS.Env.sepiaGoal = 0.85; BTS.Env.sepia = 0.85; },
      /* nine years ago: the embroidery on the wall above the stove, a candle beneath it */
      props: [{ loc: 'djordje_house', sprite: 'rug_kilim', at: [1.5, 0.22], y: 1.35, scale: 0.34 },
        { loc: 'djordje_house', sprite: 'candle', at: [1.5, 0.4], y: 0.95, emissive: false }, { loc: 'djordje_house', sprite: 'flame', at: [1.5, 0.42], y: 1.21, emissive: true, scale: 0.4 }],
      scene: function (C) {
        var cand = C.keyLight(1.5, 0.45, { y: 1.1, dz: 0, radius: 4.5, intensity: 0.8, color: [1, 0.7, 0.4], flicker: 0.15 });
        return C.say('c8_mem_in', { at: {
          1: function () { C.frame([[1.5, 0.6], 'baka'], { dist: 11, y: 1.2, time: 1.4 }); },
          2: function () { C.face('baka', 'player'); var b = C.ent('baka'); if (b) C.walk('player', U.freeNear(b.x + 0.2, b.z + 1.1), { dir: 'up' }); },
          4: function () { C.shadowFear({ look: 0.4, back: 0.2, hold: 0.3 }).then(function () { C.face('player', 'up'); C.anim('player', 'sit'); }); }
        } }).then(function () { C.unlight(cand); });
      }
    },
    { id: 'c8_back', chapter: 'ch8', loc: 'djordje_house', spawn: 'chest', forceSpawn: true, obj: null, env: { time: 'night', weather: 'overcast', horror: 0.35 }, envInstant: true, music: 'explore',
      npcs: { lisa: { loc: 'djordje_house', at: A('lisa_table', [6.4, 5.4]), act: 'sit', dir: 'left' } },
      onPopulate: function () { setSheet('djordje'); BTS.Env.sepiaGoal = 0; BTS.Env.sepia = 0; },
      scene: function (C) { return C.say('c8_back').then(function () { C.clue('hyp_needle_rule'); return C.fade(1, 0.6); }); }, after: 'c9_silence'
    },
    /* ================= CHAPTER 9 ================= */
    { id: 'c9_silence', chapter: 'ch9', loc: 'djordje_house', spawn: 'bed', forceSpawn: true, chapterCard: 'chap.ch9', chapterSub: 'sub.c9', day: 91, deaths: ['tihomir'],
      env: { time: 'morning', weather: 'overcast', horror: 0.5 }, envInstant: true, obj: 'obj.c9_silence', music: 'silence',
      npcs: { lisa: LISA_FOLLOW },
      scene: function (C) { C.anim('player', 'sit'); return C.wait(2.5).then(function () { return C.say('c9_wake'); }); },
      extras: [{ loc: 'village', sheet: 'vil_man1', at: [76, 44], act: 'mourn', dir: 'up', lines: ['extra_fear_c'] }],
      triggers: [{ loc: 'village', box: [68, 38, 84, 50], run: function (C) {
        C.spawn('vesna', [70.5, 49.8], { act: 'idle', dir: 'left', noTalk: true }); C.spawn('radoje', [62.5, 50.6], { act: 'idle', dir: 'right', noTalk: true });
        C.spawn('sava', [77.5, 43.2], { act: 'idle', dir: 'up', noTalk: true });   // at Tihomir's door, not going in
        return C.cam({ target: [74, 1, 45], time: 1.5 }).then(function () { return C.say('c9_village', { at: {
          1: function () { C.frame(['vesna', 'radoje', [77.5, 42.2]], { time: 1.2 }); },
          2: function () { C.face('vesna', 'player'); }, 3: function () { C.face('radoje', 'player'); },
          4: function () { C.frame(['sava', [77.5, 42.2]], { dist: 9, time: 1.2 }); }
        } }); });
      }, clue: 'fact_tihomir_death', then: 'c9_dusk' }]
    },
    { id: 'c9_dusk', chapter: 'ch9', obj: 'obj.c9_dusk', env: { time: 'evening', weather: 'overcast', horror: 0.55, transition: 25 }, music: 'jaglika',
      npcs: { lisa: LISA_FOLLOW, jaglika: { loc: 'village', at: [83.6, 30.2], act: 'idle', dir: 'up', noTalk: true, beast: 0.55 } },
      hide: ['vesna', 'radoje', 'mila', 'luka'],
      triggers: [{ loc: 'village', box: [72, 33, 96, 50], run: function (C) {
        C.shadow('jaglika', { beast: 0.6, wall: { x: 87, z: 26.6, y: BTS.World.heightAt(87, 26.6) } }); C.supernatural(0.6);
        C.sfx('shadow_move', { x: 86, z: 28 }); C.sfx('crow', { x: 88, z: 24 });
        var CW = { x: 87, z: 26.6, y: BTS.World.heightAt(87, 26.6) }, peel = null;   // she is despawned only after her shadow has peeled off the wall
        C.shadow('jaglika', { wall: CW });
        return C.cam({ target: [86, 2, 28], time: 1.8 }).then(function () { C.sfx('sting_low', {}); return C.say('c9_beast', { at: {
          1: function () { C.face('jaglika', 'up'); C.frame(['jaglika'], { dist: 13, time: 1.0 }); },
          2: function () { var j = C.ent('jaglika'); C.frame(['jaglika', [87, 26.8]], { dist: 15, y: 2.4, time: 1.4 }); C.tween(2.0, function (k) { if (j) j.shadow.beast = 0.6 + k * 0.25; }); },
          3: function () { C.walk('lisa', U.nearPlayer(-0.8, 0.5), { run: true }); C.shadowFear({ look: 0.3, back: 0.6 }); },
          4: function () { C.frame([[87, 26.6]], { dist: 9, y: 3.0, time: 1.2 }); C.shake(0.2); },   // over the icon above the door
          6: function () {   // she turns and walks away; the shadow peels off the wall only slowly
            C.face('jaglika', 'down'); C.walk('jaglika', [80.5, 33.5], { noWait: true, speed: 0.8 });
            C.frame(['jaglika', [87, 26.8]], { dist: 15, time: 1.2 });
            peel = C.wait(1.6).then(function () { C.sfx('shadow_move', { x: 86, z: 27 }); var x0 = CW.x, z0 = CW.z; return C.tween(1.8, function (k) { var j = BTS.World.get('jaglika'); if (!j) return; CW.x = x0 + (j.x - x0) * k; CW.z = Math.min(z0 + (j.z - 0.6 - z0) * k, j.z - 0.3); }); })
              .then(function () { C.shadow('jaglika', { wall: null }); });
          }
        } }); })
          .then(function () { return peel; })
          .then(function () { C.shadow('jaglika', { wall: null }); return C.walk('jaglika', [78, 36], { noWait: true }); }).then(function () { return C.wait(1.5); })
          .then(function () { C.despawn('jaglika'); C.supernatural(0); });
      }, clue: 'sk_jaglika_beast', then: 'c9_lisa' }],
      blockExit: { west: 'block_night', south: 'block_night' }
    },
    { id: 'c9_lisa', chapter: 'ch9', obj: 'obj.c9_lisa', music: 'tension', env: { time: 'night', weather: 'overcast', horror: 0.55 },
      npcs: { lisa: { loc: 'djordje_house', at: A('lisa_table', [6.4, 5.4]), act: 'idle', dir: 'left' } },
      triggers: [{ loc: 'djordje_house', box: [-30, -10, 40, 30], run: function (C) {
        C.place('lisa', U.spot('lisa_table', [6.4, 5.4]), 'left');
        return C.say('c9_decide');
      }, set: 'tihomir_open', then: 'c9_needle' }],
      blockExit: { west: 'block_night', south: 'block_night' }
    },
    { id: 'c9_needle', chapter: 'ch9', obj: 'obj.c9_needle', music: 'tension', npcs: { lisa: LISA_FOLLOW },
      props: [{ loc: 'tihomir_house', sprite: 'cloth_dark', at: [4.6, 0.3], y: 1.2, scale: 2.5 }],
      interact: [{ loc: 'tihomir_house', id: 'pillow', at: [10.8, 1.2], label: 'it.pillow', verb: 'verb.take', dlg: 'c9_pillow', item: 'ritual_needle', hint: true, then: 'c9_prepare' }],
      blockExit: { west: 'block_night', south: 'block_night' }
    },
    { id: 'c9_prepare', chapter: 'ch9', obj: 'obj.c9_prepare', music: 'tension', npcs: { lisa: LISA_FOLLOW },
      interact: [{ loc: 'djordje_house', id: 'lantern', at: A('stove', [1.6, 2.4]), label: 'it.lantern', verb: 'verb.take', dlg: 'c9_lantern', item: 'lantern', hint: true, once: true }],
      tick: when('c9_ready', 'item:lantern', function (C) { return C.say('c9_ready').then(function () { return C.fade(1, 0.6); }); }, 'c10_meadow'),
      blockExit: { west: 'block_night', south: 'block_night' }
    },
    /* ================= CHAPTER 10 ================= */
    { id: 'c10_meadow', chapter: 'ch10', loc: 'village', spawn: 'fair_entry', forceSpawn: true, chapterCard: 'chap.ch10', chapterSub: 'sub.c10', day: 94,
      env: { time: 'night', weather: 'storm', horror: 0.6 }, envInstant: true, obj: 'obj.c10_meadow', music: 'tension', noSave: false,
      npcs: { lisa: LISA_FOLLOW }, hideAll: true, keep: ['lisa'],
      onPopulate: function (loc, W) { if (loc !== 'village') return; W.speedMul = 1; var lit = S.flag('fire_lit'); BTS.Env.lights.forEach(function (l) { if (Math.hypot(l.x - 90.5, l.z - 82.3) < 1 && l.kind === 'fire') l.off = !lit; }); W.statics.forEach(function (s) { if (s.fire && Math.hypot(s.x - 90.5, s.z - 82) < 1.5) s.off = !lit; if (s.pool && Math.hypot(s.pool[0] - 90.5, s.pool[2] - 82) < 1) s.off = !lit; }); },
      interact: [{ loc: 'village', id: 'light_fire', at: [90.5, 82], label: 'it.bonfire', verb: 'verb.use', r: 1.8, dlg: 'c10_fire', set: 'fire_lit', sfx: 'match', hint: true, then: 'c10_rite' }],
      blockExit: { west: 'block_night', south: 'block_night', djordje: 'block_night' }
    },
    { id: 'c10_rite', chapter: 'ch10', obj: 'obj.c10_rite', music: 'ritual', noSave: true,
      npcs: { lisa: { loc: 'village', at: [84.5, 85.6], act: 'fear', dir: 'up' }, jaglika: { loc: 'village', at: [96.5, 81.5], act: 'idle', dir: 'left', noTalk: true, beast: 0.9 } },
      hideAll: true, keep: ['lisa', 'jaglika'],
      onPopulate: function (loc, W) {
        if (loc !== 'village') return;
        if (R) W.extraRender = riteRender;
        // a cold key light on Jaglika so the target of the rite reads against the storm
        if (!BTS.Env.lights.some(function (l) { return l.id === 'rite_jag'; })) BTS.Env.lights.push({ id: 'rite_jag', x: 97.5, y: 2.4, z: 83.2, color: [0.55, 0.65, 0.95], radius: 6, intensity: 1.3, kind: 'lamp', flicker: 0, important: true });
        BTS.Env.lights.forEach(function (l) { if (Math.hypot(l.x - 90.5, l.z - 82.3) < 1) { l.off = false; l.radius = 15; l.intensity = 2.9; } }); W.statics.forEach(function (s) { if (s.fire || s.pool) s.off = false; });
      },
      scene: function (C) {
        C.intensity(0.2);
        BTS.Camera.setPreset({ dist: 19 });   // the climax is played close: the beast, the fire and the hero fill the frame
        var J0 = [96.5, 81.5];
        // c10_rite is entered from the bonfire without a location load, so its npcs are not populated yet: bring her on stage
        if (!C.has('jaglika')) C.spawn('jaglika', J0, { act: 'idle', dir: 'left', noTalk: true, beast: 0.9 });
        C.place('jaglika', [104.6, 86.2], 'left');   // she comes out of the dark, from the field
        return C.cam({ target: [93, 1, 82], dist: 19, time: 1.6 }).then(function () { return C.say('c10_arrive', { at: {
          1: function () { C.walk('jaglika', J0, { dir: 'left', speed: 0.9 }); C.frame([[100.5, 84], J0], { dist: 16, time: 1.4 }); },
          2: function () { C.face('jaglika', 'player'); C.face('player', 'jaglika'); C.frame(['jaglika', 'player'], { time: 1.0 }); },
          5: function () { C.face('jaglika', 'player'); },
          6: function () { C.anim('jaglika', 'point'); C.shadowFear({ look: 0.4, hold: 0.5 }); },
          7: function () { C.anim('jaglika', null); }
        } }); })
          .then(function () { var j = C.ent('jaglika'); C.sfx('shadow_tear', {}); C.shake(0.8); C.intensity(0.6); C.tween(2.2, function (k) { if (j) { j.shadow.beast = 0.9 + k * 0.1; j.shadow.lenMul = 1 + k * 0.5; } });
            return C.say('c10_grow', { at: {
              1: function () { C.frame(['jaglika', [88, 79], [84, 76.6]], { dist: 22, time: 1.4 }); },   // across the grass, up the pole, over the stalls
              3: function () {   // Lisa shines her torch on it
                var l = C.ent('lisa'); if (!l) return; C.face('lisa', 'jaglika'); C.anim('lisa', 'point');
                var tl = C.keyLight(l.x + 0.6, l.z - 0.4, { y: 1.3, dz: 0, radius: 7, intensity: 1.6, color: [0.95, 0.95, 0.85], kind: 'fill' });
                C.wait(3).then(function () { C.unlight(tl); C.anim('lisa', 'fear'); });
              },
              5: function () { C.frame(['player', 'jaglika'], { dist: 19, time: 1.0 }); }
            } }); })
          .then(function () { riteStart(BTS.World); C.intensity(0.8); });
      },
      blockExit: { west: 'block_night', south: 'block_night', djordje: 'block_night', zajko: 'block_night', kafana: 'block_night', guest: 'block_night', church: 'block_night', gorazd: 'block_night', tihomir: 'block_night', jaglika: 'block_night' },
      tick: function (dt, W) { if (!R && W.get('jaglika') && S.done('scene:c10_rite')) riteStart(W); riteTick(dt, W); BTS.Music.intensity = Math.min(1, 0.6 + (R ? R.t / 90 : 0)); }
    },
    /* ================= CHAPTER 11 ================= */
    { id: 'c11_release', chapter: 'ch11', obj: null, music: 'silence', noSave: true,
      npcs: { lisa: { loc: 'village', at: [84.5, 85.6], act: 'idle', dir: 'up' }, jaglika: { loc: 'village', at: [96.5, 81.5], act: 'idle', dir: 'left', noTalk: true } },
      hideAll: true, keep: ['lisa', 'jaglika'],
      scene: function (C) {
        BTS.Camera.setPreset({ dist: 21 });
        var W = BTS.World, j = W.get('jaglika') || C.spawn('jaglika', [96.5, 81.5], { noTalk: true, dir: 'left' }), shades = [], relT = null, sc = j.shadow;
        W.extraRender = null;
        C.musicCut(); C.timeScale(0.35); C.sfx('shadow_tear', {}); C.shake(1.4);
        // the pierced shadow: the beast lies frozen on the grass, pinned
        var hd = R && R.head ? [R.head[0] - j.x, R.head[1] - j.z] : [1, -0.12], hl = Math.hypot(hd[0], hd[1]) || 1; hd = [hd[0] / hl, hd[1] / hl];
        { if (j.brain) { j.brain.paused = true; j.keepPaused = true; } sc.visible = true; sc.beast = 1; sc.fixDir = hd; sc.lenMul = 1.2; j.anim.lock = 'fear'; C.face('jaglika', hd[0] > 0 ? 'right' : 'left'); }
        var P0 = [j.x, j.z];
        // the bonfire still burns high, and a cold light keeps her and what comes out of her readable
        BTS.Env.lights.forEach(function (l) { if (Math.hypot(l.x - 90.5, l.z - 82.3) < 1) { l.off = false; l.radius = 15; l.intensity = 2.9; } }); W.statics.forEach(function (s2) { if (s2.fire || s2.pool) s2.off = false; });
        C.keyLight(P0[0] + 1.5, P0[1], { color: [0.55, 0.65, 0.95], radius: 8, intensity: 1.2, kind: 'fill', dz: 2.2 });
        // where the torn shadow lies: along its length, spread across it
        var tear = function (k) { var d = 1.0 + k * Math.min(4.5, hl), w = Math.sin(k * 23) * 0.9; return [P0[0] + hd[0] * d - hd[1] * w, P0[1] + hd[1] * d + hd[0] * w]; };
        return C.frame([P0, [P0[0] + hd[0] * 4, P0[1] + hd[1] * 4]], { dist: 14, time: 0.6 }).then(function () { return C.say('c11_pierce'); }).then(function () {
          C.timeScale(1); C.sfx('shadow_release', {}); C.music('release', 0.5); relT = BTS.Audio.now();
          return C.say('c11_shades', { at: {
            1: function () {   // the shadow tears; silhouettes rise out of the rent — one, then five, then twenty
              C.sfx('shadow_tear', {}); C.shake(0.9);
              C.tween(2.4, function (k) { sc.lenMul = 1.2 + Math.sin(k * 30) * 0.2 * (1 - k); }).then(function () { sc.visible = false; sc.fixDir = null; sc.beast = 0; });
              var born = 0;
              var birth = function (n, gap) { var q = Promise.resolve(); for (var i = 0; i < n; i++) q = q.then(function () { var at = tear(born / 20); shades.push(makeShade(C, born, at[0], at[1], 1.1)); born++; C.sfx('shadow_detach', { vol: 0.4 }); return C.wait(gap); }); return q; };
              birth(1, 0.9).then(function () { return birth(4, 0.35); }).then(function () { return birth(15, 0.12); }).then(function () {
                // they step out of the rent into a loose ring round her
                shades.forEach(function (e, i) { var a = i / shades.length * 6.283 + 0.4, r = 3.2 + (i % 3) * 0.6; e.path = [[P0[0] + Math.cos(a) * r, P0[1] + Math.sin(a) * r * 0.8]]; e.pathRun = false; e.pathSpeed = 0.6; });
              });
              C.frame([P0, [P0[0] + hd[0] * 3.5, P0[1] + hd[1] * 3.5]], { dist: 13, time: 1.2 });
            },
            2: function () {   // the four he knows: small and tousled, broad with a hammer, a headscarf, a camera — in front, facing us
              var p = C.ent('player');
              [0, 1, 2, 3].forEach(function (i) { var e = shades[i]; if (!e) return; e.path = [[P0[0] - 0.6 + i * 1.3, P0[1] + 1.9 + (i % 2) * 0.3]]; e.pathSpeed = 0.8; });
              C.wait(1.2).then(function () { [0, 1, 2, 3].forEach(function (i) { var e = shades[i]; if (e) e.dir = 'down'; }); var g = shades[1]; if (g && g.anim) g.anim.lock = 'interact'; });
              C.frame([[P0[0] + 1.3, P0[1] + 2]], { dist: 10, time: 1.2 });
            },
            3: function () { C.anim('jaglika', 'point'); C.face('jaglika', 'right'); C.shake(0.4); if (shades[1] && shades[1].anim) shades[1].anim.lock = null; C.frame(['jaglika', [P0[0] + 2, P0[1] + 1]], { dist: 12, time: 0.8 }); },
            4: function () {   // all at once
              shades.forEach(function (e) { e.path = null; e.faceTo(P0[0], P0[1]); });
              C.sfx('whisper', { vol: 0.6, dur: 1.4 }); C.sfx('sting_low', {}); C.shake(0.5); C.anim('jaglika', 'fear');
              C.frame([P0], { dist: 15, time: 1.0 });
            },
            5: function () {   // Mama's shade walks past him; Tata's raises a hand over his shoulder and does not touch
              var p = C.ent('player'), m = shades[2], t2 = shades[1]; if (!p) return;
              C.frame(['player', [P0[0], P0[1]]], { dist: 14, time: 1.2 });
              if (m) { m.anim.lock = null; m.path = [[p.x + 0.9, p.z - 0.6], [p.x - 2.2, p.z + 0.6]]; m.pathSpeed = 0.5; }
              if (t2) { t2.anim.lock = null; t2.path = [[p.x + 0.75, p.z + 0.15]]; t2.pathSpeed = 0.6; C.wait(2.0).then(function () { t2.faceTo(p.x, p.z); t2.anim.lock = 'point'; C.sfx('breath', { vol: 0.5 }); }); }
            },
            6: function () { C.face('player', 'left'); }
          } });
        }).then(function () {   // let at least ~10 s of the release choir sound before the chase cuts in
          if (shades[1] && shades[1].anim) shades[1].anim.lock = null;
          var left = BTS.Audio.ready && relT !== null ? 10 - (BTS.Audio.now() - relT) : 0;
          return left > 0 ? C.wait(Math.min(4, left)) : null;
        }).then(function () {
          /* the flight across the fair meadow to the south gate: a clear, precomputed route; the camera runs with her */
          C.anim('jaglika', null); C.music('chase', 2); C.env({ weather: 'rain' });
          shades.forEach(function (e) { e.path = null; if (e.anim) e.anim.lock = null; });
          var R1 = navRoute([[j.x, j.z], [92, 86.6], [84.5, 87.6], [72, 87.2], [66.5, 85.6], [57.5, 84.6], [53, 84.6], [53, 88.4]]);
          C.follow('jaglika', { dist: 17 });
          var screamed = false;
          return runRoute(C, j, shades, R1, 4.4, { onS: function (s2, L) { if (!screamed && s2 > L * 0.45) { screamed = true; C.sfx('scream_far', {}); } } });
        })
          .then(function () { return C.fade(1, 1.6); })
          .then(function () {
            /* across the bridge and into the field: the second leg starts where the south road enters the outskirts */
            C.unfollow();
            C.load('outskirts', 'from_village_s'); C.env({ time: 'night', weather: 'rain', horror: 0.8 }, true);
            C.hide('player', true);
            var j2 = C.spawn('jaglika', [91.6, 53.4], { noTalk: true, dir: 'left' });
            if (j2.shadow) j2.shadow.visible = false;
            shades = []; for (var i = 0; i < 20; i++) shades.push(makeShade(C, i, 94.6 + (i % 4) * 0.5, 53 + (i % 5) * 0.35));
            C.follow('jaglika', { dist: 17 });
            var R2 = navRoute([[91.6, 53.4], [80, 49], [66, 44.5], [54, 40], [42, 36.5]]);
            return C.fade(0, 1.4).then(function () { return runRoute(C, j2, shades, R2, 4.4, { slowAt: 6 }); }).then(function () {
              /* she stumbles; they come at her from every side */
              var jj = C.ent('jaglika'); jj.anim.lock = 'fear'; C.sfx('breath', { vol: 0.7 });
              var cx = jj.x, cz = jj.z;
              C.unfollow();
              shades.forEach(function (e, k) { var a = k / shades.length * 6.283, r = 1.5 + (k % 3) * 0.45; e.path = [[cx + Math.cos(a) * r, cz + Math.sin(a) * r * 0.8]]; e.pathRun = true; e.pathSpeed = 1.2; });
              C.ticker(function () { var any = false; shades.forEach(function (e) { if (e.path && e.path.length) any = true; else e.faceTo(cx, cz); }); return any; });
              C.keyLight(cx, cz, { color: [0.5, 0.58, 0.85], radius: 7, intensity: 1.25, kind: 'fill', dz: 1.8 });
              BTS.Env.strike();
              return C.cam({ target: [cx, 0.5, cz], dist: 13, time: 1.2 }).then(function () { return C.wait(1.0); }).then(function () { return sinkScene(C, jj, shades, cx, cz); });
            })
              .then(function () { C.despawn('jaglika'); shades.forEach(function (s2) { C.despawn(s2.id); }); C.musicCut(); BTS.Particles.clear(); C.env({ weather: 'clear', horror: 0.1 }); return C.wait(2.5); })
              .then(function () { return C.say('c11_silence'); })
              .then(function () { SINK = null; BTS.World.extraRender = null; BTS.Camera.followTarget = null; return C.fade(1, 1.2); });
          });
      }, after: 'e_dawn'
    },
    /* ================= EPILOGUE ================= */
    { id: 'e_dawn', chapter: 'epilogue', loc: 'village', spawn: 'fair_center', forceSpawn: true, chapterCard: 'chap.epilogue', chapterSub: 'sub.e', day: 95, deaths: ['jaglika'],
      env: { time: 'morning', weather: 'clear', horror: 0 }, envInstant: true, obj: 'obj.e_dawn', music: 'epilogue',
      npcs: { lisa: LISA_FOLLOW, milka: { loc: 'village', at: 'milka_bench', act: 'sit', dir: 'down' }, sava: { loc: 'village', at: 'churchyard', act: 'pray', dir: 'up' }, stana: { loc: 'village', at: 'guest_bench', act: 'sit', dir: 'down' }, dragan: { loc: 'village', at: 'kafana_table', act: 'idle', dir: 'down' },
        zlatko: { loc: 'village', at: [93.6, 32.6], act: 'mourn', dir: 'up' }, jablan: { loc: 'village', at: [94.8, 32.4], act: 'idle', dir: 'up' } },
      hideAll: true, keep: ['lisa', 'milka', 'sava', 'stana', 'dragan', 'zlatko', 'jablan'],
      onPopulate: function (loc, W) {
        W.player.hidden = false; if (W.player.shadow) W.player.shadow.setStage(0);
        if (loc !== 'village') return;   // the bonfire has burned out: no flame, no glow
        BTS.Env.lights.forEach(function (l) { if (Math.hypot(l.x - 90.5, l.z - 82.3) < 1 && l.kind === 'fire') l.off = true; });
        W.statics.forEach(function (s2) { if ((s2.fire && Math.hypot(s2.x - 90.5, s2.z - 82) < 1.5) || (s2.pool && Math.hypot(s2.pool[0] - 90.5, s2.pool[2] - 82) < 1)) s2.off = true; });
      },
      scene: function (C) {
        C.hide('player', false);
        return C.say('e_dawn', { at: {
          1: function () { C.frame([[90.5, 82], [84, 76.6]], { dist: 18, time: 1.6 }); },   // the burnt-out fire, the pole still standing
          2: function () { C.face('lisa', 'player'); C.frame(['lisa', 'player'], { time: 1.0 }); },
          3: function () {   // he looks down at his shadow — and does not look away
            var p = C.ent('player'), sl = null; for (var k in (p.shadow && p.shadow.slots) || {}) if (!sl || p.shadow.slots[k].a > sl.a) sl = p.shadow.slots[k];
            if (sl) p.faceTo(p.x + sl.dx, p.z + sl.dz); C.frame(['player'], { dist: 9, time: 1.2 });
          }
        } });
      },
      interact: [
        { loc: 'village', id: 'leave_toy', at: 'grave_zajko', label: 'it.grave_zajko', verb: 'verb.leave', dlg: 'e_toy', hint: true, once: true, need: 'item:zajko_toy' },
        { loc: 'village', id: 'parents_grave', at: 'grave_pecko', label: 'it.grave_parents', verb: 'verb.pray', dlg: 'e_parents', set: 'e_parents', hint: true, once: true }
      ],
      tick: when('e_ready', 'flag:e_toy_left&flag:e_milka&flag:e_parents', function (C) { return C.say('e_ready'); }, 'e_leave')
    },
    { id: 'e_leave', chapter: 'epilogue', obj: 'obj.e_leave', music: 'epilogue',
      npcs: { lisa: LISA_FOLLOW, milka: { loc: 'village', at: 'milka_bench', act: 'sit', dir: 'down' } }, hideAll: true, keep: ['lisa', 'milka'],
      triggers: [{ loc: 'village', box: [49, 82, 57, 89], run: function (C) {
        return C.say('e_bridge', { at: {
          1: function () { C.face('player', 'up'); C.cam({ target: [54, 1, 60], dist: 34, pitch: 0.6, time: 2.0 }); },   // looking back: the roofs, the chimneys, the hill
          4: function () { C.face('lisa', 'player'); C.frame(['lisa', 'player'], { time: 1.2 }); },
          6: function () {   // they walk away down the road; their shadows go with them, on time
            C.walk('player', [53, 88.6], { direct: true, speed: 0.6 }); C.walk('lisa', [53.9, 88.4], { direct: true, speed: 0.6 });
            C.frame(['player', [53, 87]], { dist: 14, time: 2.0 });
          }
        } }).then(function () { return C.wait(1.5); }).then(function () { return C.fade(1, 1.2); });
      }, then: 'e_final' }]
    },
    /* the next Vidovdan: Đorđe comes back for the fair — and looks at his own shadow. Then the final titles. */
    { id: 'e_final', chapter: 'epilogue', ambience: { crowd: 0.8, fire: 0.8, firePos: [90.5, 82] }, loc: 'village', spawn: 'fair_edge', forceSpawn: true, chapterCard: 'date.next_june', chapterSub: 'sub.e_final', day: 365,
      env: { time: 'night', weather: 'clear', horror: 0 }, envInstant: true, obj: null, music: 'fair', noSave: true,
      npcs: { mila: { loc: 'village', at: [89.4, 80.4], act: 'wander', radius: 1.6, stage: 0 }, luka: { loc: 'village', at: [92, 81.8], act: 'wander', radius: 1.5 }, milka: { loc: 'village', at: [98.6, 83.4], act: 'sit', dir: 'right' },
        lisa: { loc: 'village', at: [101.4, 85.2], act: 'idle', dir: 'left', noTalk: true } },
      hideAll: true, keep: ['mila', 'luka', 'milka', 'lisa'],
      extras: [
        { loc: 'village', sheet: 'dancer1', at: [82.6, 78.2], act: 'wander', radius: 1.6 }, { loc: 'village', sheet: 'dancer2', at: [85.6, 78.6], act: 'wander', radius: 1.6 },
        { loc: 'village', sheet: 'vil_man1', at: [75, 73.8], act: 'idle', dir: 'up' }, { loc: 'village', sheet: 'vil_boy', at: [88, 83], act: 'wander', radius: 2 }
      ],
      onPopulate: function (loc, W) { W.player.hidden = false; if (W.player.shadow) W.player.shadow.setStage(0); },
      scene: function (C) {
        return C.cam({ target: [95, 0.5, 83], dist: 22, time: 0.1 }).then(function () { return C.wait(1.5); })
          .then(function () { return C.say('e_final', { at: {
            1: function () { C.frame([[90.5, 82], [84, 76.6]], { dist: 20, time: 1.6 }); },
            3: function () { C.face('lisa', 'player'); C.face('player', 'lisa'); C.frame(['lisa', 'player'], { time: 1.0 }); },
            5: function () { C.face('milka', 'player'); C.frame(['milka', 'player'], { time: 1.0 }); },
            6: function () { hop2(C, ['mila', 'luka'], 6); C.frame(['mila', [90.5, 82]], { dist: 14, time: 1.2 }); },
            7: function () { C.face('mila', 'player'); }
          } }); })
          .then(function () { C.walk('player', [96.6, 83.6]); return C.wait(1.8); })
          .then(function () {
            C.face('player', 'left');
            return C.say('e_final_b', { at: {
              2: function () {   // he looks at it. Not a flinch: a long look
                var p = C.ent('player'), sl = null; for (var k in (p.shadow && p.shadow.slots) || {}) if (!sl || p.shadow.slots[k].a > sl.a) sl = p.shadow.slots[k];
                if (sl) p.faceTo(p.x + sl.dx, p.z + sl.dz); C.frame(['player'], { dist: 10, time: 1.4 });
              }
            } });
          })
          .then(function () { C.anim('player', 'point'); return C.wait(1.6); })
          .then(function () { C.anim('player', null); return C.say('e_final_c', { at: {
            1: function () { C.anim('player', 'point'); }, 2: function () { C.anim('player', null); },
            3: function () { var p = C.ent('player'); C.walk('lisa', U.freeNear(p.x + 1, p.z + 0.4)).then(function () { C.face('lisa', 'player'); }); }
          } }); })
          .then(function () { return lanternProcession(C); })
          .then(function () { return C.fade(1, 1.2); })
          .then(function () { BTS.Music.set('epilogue', 1.5); return U.cards(ENDING_CARDS); })
          .then(function () { return C.title('ui.the_end'); })
          .then(function () { S.set('game_complete'); S.markDone('scene:e_final'); BTS.Save.write('auto', BTS.Save.snapshot()); BTS.Screens.credits(true); });
      }
    }
  ]);

  /* memory: talking to grandmother */
  add('lisa', [
    { beats: 'c8_chest', dlg: 'c8_lisa' }, { beats: 'c9_silence..c9_prepare', dlg: 'c9_lisa_any' }, { beats: 'c10_meadow', dlg: 'c10_lisa' },
    { beats: 'e_dawn..e_leave', dlg: 'e_lisa' }
  ]);
  add('milka', [{ beats: 'e_dawn', dlg: 'e_milka', set: 'e_milka' }, { beats: 'e_leave', dlg: 'e_milka2' }, { beats: 'c9_silence..c10_meadow', dlg: 'c9_milka' }]);
  add('sava', [{ beats: 'e_dawn..e_leave', dlg: 'e_sava' }, { beats: 'c9_silence..c9_prepare', dlg: 'c9_sava' }]);
  add('stana', [{ beats: 'e_dawn..e_leave', dlg: 'e_stana' }]);
  add('zlatko', [{ beats: 'e_dawn..e_leave', dlg: 'e_zlatko' }]);
  add('jablan', [{ beats: 'e_dawn..e_leave', dlg: 'e_jablan' }]);
  add('dragan', [{ beats: 'e_dawn..e_leave', dlg: 'e_dragan' }, { beats: 'c9_silence..c9_prepare', dlg: 'c9_dragan' }]);
  BTS.Data.globalProps.push({ beats: 'c9_dusk..', loc: 'village', sprite: 'cross_grave_new', at: 'grave_tihomir', scale: 1.1 });
  BTS.Story.calls.leaveToy = function () { S.removeItem('zajko_toy'); S.set('e_toy_left'); };

  var Q = BTS.Cutscene.cue;
  Q('c9_pillow', { 1: function (C) { C.face('player', 'up'); C.anim('player', 'interact'); }, 2: function (C) { C.anim('player', null); }, 4: function (C) { C.anim('player', 'interact'); var l = C.ent('lisa'); if (l) C.face('lisa', 'player'); } });
  Q('c9_decide', { 5: function (C) { C.anim('player', 'interact'); C.wait(0.8).then(function () { C.anim('player', null); }); }, 9: function (C) { C.face('player', 'up'); }, 10: function (C) { C.face('player', 'lisa'); } });
  Q('c10_fire', {
    1: function (C) {   // three matches; on the third the wet wood catches
      var W = BTS.World; C.face('player', 'right'); C.anim('player', 'interact');
      C.wait(0.7).then(function () { C.sfx('match', {}); return C.wait(0.9); }).then(function () { C.sfx('match', {}); return C.wait(0.9); }).then(function () {
        C.sfx('match', {}); C.sfx('fire_pop', {}); C.anim('player', null);
        BTS.Env.lights.forEach(function (l) { if (Math.hypot(l.x - 90.5, l.z - 82.3) < 1 && l.kind === 'fire') l.off = false; });
        W.statics.forEach(function (s2) { if (s2.fire && Math.hypot(s2.x - 90.5, s2.z - 82) < 1.5) s2.off = false; if (s2.pool && Math.hypot(s2.pool[0] - 90.5, s2.pool[2] - 82) < 1) s2.off = false; });
      });
    },
    2: function (C) { var p = C.ent('player'); C.tween(1.2, function (k) { if (p.shadow) p.shadow.lenMul = 1 + k * 1.2; }); C.shadowFear({ back: 0.15, look: 0.9, hold: 1.0, turnAway: false }); },
    3: function (C) { var p = C.ent('player'); if (p.shadow) p.shadow.lenMul = 1; C.frame([[100, 84], 'player'], { time: 1.2 }); }
  });

  D('c8_chest', [['*', '1'], ['>', '2'], ['*', '3'], ['>', '4'], ['>', '5']]);
  D('c8_lisa', [['lisa', '1', { p: 'worried' }]]);
  D('c8_mem_in', [['*', '1'], ['baka', '2', { p: 'smile' }], ['>', '3'], ['>', '4']]);
  D('c8_legend', [
    ['baka', '1', { p: 'smile' }], ['baka', '2'], ['baka', '3'], ['*', '4'], ['baka', '5'],
    { label: 'q' }, { choice: [['c1', 'eat', { once: true }], ['c2', 'needle', { once: true }], ['c3', 'kill', { once: true }], ['c4', 'you', { once: true }], ['c5', 'end']] },
    { label: 'eat' }, ['dj', '6'], ['baka', '7'], ['baka', '8'], { goto: 'q' },
    { label: 'needle' }, ['dj', '9'], ['baka', '10'], ['baka', '11'], { goto: 'q' },
    { label: 'kill' }, ['dj', '12'], ['baka', '13', { p: 'worried' }], ['*', '14'], ['baka', '15'], ['baka', '16'], ['baka', '17'], ['*', '18'], ['baka', '19'], { goto: 'q' },
    { label: 'you' }, ['dj', '20'], ['baka', '21', { p: 'sad' }], ['baka', '22'], { goto: 'q' },
    { label: 'end' }, { if: 'flag:chose.c8_legend.dlg.c8_legend.c3', then: 'fin' }, ['baka', '23'], { goto: 'q' },
    { label: 'fin' }, ['baka', '24', { p: 'smile' }], ['baka', '25'], ['>', '26']
  ]);
  D('c8_back', [['*', '1'], ['lisa', '2', { p: 'worried' }], ['dj', '3'], ['dj', '4'], ['lisa', '5', { p: 'worried' }], ['dj', '6'], ['lisa', '7'], ['>', '8'], ['>', '9']]);
  D('c9_wake', [['>', '1'], ['>', '2'], ['>', '3'], ['lisa', '4', { p: 'worried' }], ['lisa', '6', { p: 'sad' }], ['>', '5']]);
  D('c9_village', [['*', '1'], ['vesna', '2', { p: 'sad' }], ['radoje', '3'], ['*', '4'], ['>', '5'], ['>', '6']]);
  D('c9_beast', [['*', '1'], ['*', '2'], ['lisa', '3', { p: 'scared' }], ['>', '4'], ['>', '5'], ['*', '6']]);
  D('c9_decide', [['lisa', '1', { p: 'tired' }], ['lisa', '2'], ['>', '18'], ['lisa', '3'], { choice: [['c1', 'a'], ['c2', 'b']] },
    { label: 'a' }, ['dj', '4'], { goto: 'm' }, { label: 'b' }, ['*', '5'], ['>', '6'], ['dj', '7'],
    { label: 'm' }, ['lisa', '8', { p: 'worried' }], ['*', '9'], ['dj', '10'], ['dj', '11'], ['lisa', '12', { p: 'sad' }], ['lisa', '13'], ['dj', '14'], ['lisa', '15', { p: 'worried' }], ['lisa', '16'], ['>', '17']]);
  D('c9_pillow', [['*', '1'], ['>', '2'], ['>', '3'], ['lisa', '4', { p: 'worried' }]]);
  D('c9_lantern', [['*', '1'], ['>', '2']]);
  D('c9_ready', [['lisa', '1'], ['dj', '2'], ['lisa', '3', { p: 'worried' }], ['>', '4']]);
  D('c9_lisa_any', [['lisa', '1', { p: 'worried' }]]);
  D('c9_milka', [['milka', '1', { p: 'worried' }], ['milka', '2']]);
  D('c9_sava', [['sava', '1', { p: 'worried' }]]);
  D('c9_dragan', [['dragan', '1', { p: 'worried' }]]);
  D('c10_fire', [['*', '1'], ['>', '2'], ['lisa', '3', { p: 'scared' }]]);
  D('c10_lisa', [['lisa', '1', { p: 'scared' }]]);
  D('c10_arrive', [['*', '1'], ['jaglika', '2'], ['jaglika', '3'], ['dj', '4'], ['jaglika', '5'], ['jaglika', '6'], ['>', '7']]);
  D('c10_grow', [['*', '1'], ['*', '2'], ['lisa', '3', { p: 'scared' }], ['>', '4'], ['>', '5']]);
  D('c10_hint_freeze', [['>', '1']]);
  D('c10_fear', [['>', '1'], ['>', '2'], ['>', '3']]);
  D('c10_now', [['>', '1']]);
  D('c10_miss_early', [['lisa', '1', { p: 'scared' }]]);
  D('c10_miss_far', [['>', '1']]);
  D('c11_pierce', [['*', '1'], ['*', '2'], ['>', '3']]);
  D('c11_shades', [['*', '1'], ['>', '2'], ['>', '5'], ['>', '6'], ['jaglika', '3'], ['*', '4']]);
  D('c11_fall', [['*', '1'], ['jaglika', '2'], ['*', '3']]);
  D('c11_silence', [['*', '1'], ['>', '2']]);
  D('e_dawn', [['*', '1'], ['lisa', '2', { p: 'tired' }], ['dj', '3'], ['lisa', '4'], ['>', '5']]);
  D('e_toy', [['*', '1'], ['>', '2'], ['>', '3'], { call: 'leaveToy' }]);
  D('e_milka', [['milka', '1', { p: 'sad' }], ['milka', '2'], ['dj', '3'], ['milka', '4', { p: 'smile' }], ['milka', '5']]);
  D('e_milka2', [['milka', '1', { p: 'smile' }]]);
  D('e_sava', [['sava', '1'], ['sava', '2']]);
  D('e_stana', [['stana', '1', { p: 'sad' }]]);
  D('e_dragan', [['dragan', '1', { p: 'tired' }]]);
  D('e_lisa', [['lisa', '1']]);
  D('e_ready', [['lisa', '1'], ['>', '2']]);
  D('e_bridge', [['*', '1'], ['>', '2'], ['>', '3'], ['lisa', '4', { p: 'smile' }], ['dj', '5'], ['*', '6']]);
  D('e_final', [['*', '1'], ['>', '2'], ['lisa', '3', { p: 'smile' }], ['dj', '4'], ['milka', '5', { p: 'smile' }], ['*', '6'], ['mila', '7', { p: 'smile' }], ['*', '8']]);
  D('e_final_b', [['>', '1'], ['>', '2']]);
  D('e_final_c', [['>', '1'], ['>', '2'], ['lisa', '3', { p: 'smile' }], ['dj', '4'], ['>', '5']]);
  D('e_parents', [['*', '1'], ['>', '2'], ['>', '3'], ['>', '4'], ['>', '5']]);
  D('e_zlatko', [['zlatko', '1', { p: 'sad' }], ['zlatko', '2'], ['dj', '3'], ['>', '4']]);
  D('e_jablan', [['jablan', '1', { p: 'tired' }]]);
})();
