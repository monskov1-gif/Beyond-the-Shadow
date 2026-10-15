/* Character shadow system. Each caster projects its current (or lagged) animation frame onto the
   ground away from the dominant light: sun/moon outdoors, nearest strong point light otherwise. */
'use strict';
BTS.Shadows = (function () {
  var S = {};
  var COL = [0.015, 0.012, 0.03];

  /* every light that would cast a visible shadow for this caster, strongest first.
     Point lights are keyed by position so the per-caster smoothing can follow them between frames. */
  function candidates(e, env) {
    var out = [];
    var ls = env.activeLights || [];
    for (var i = 0; i < ls.length; i++) {
      var L = ls[i]; if (L.kind === 'fill' || !L.cur) continue;
      var dx = e.x - L.x, dz = e.z - L.z, d = Math.hypot(dx, dz);
      if (d > L.radius * 0.9 || d < 0.05) continue;
      // use the light's steady colour, not the flickering one, so fires don't make shadows pulse
      var lum = L.steady !== undefined ? L.steady : (L.cur[0] + L.cur[1] + L.cur[2]) / 3;
      var sc = lum * (1 - d / L.radius);
      if (sc <= 0.02) continue;
      out.push({ key: 'p' + Math.round(L.x * 10) + '_' + Math.round(L.z * 10), dx: dx / d, dz: dz / d, k: BTS.M.clamp(d / Math.max(0.6, L.y - 0.2), 0.55, 3.2), a: BTS.M.clamp(sc * 1.6, 0, 0.75) });
    }
    if (env.shadowOn) {
      var sd = env.sunDir, h = Math.hypot(sd[0], sd[2]) || 1;
      var elev = Math.max(0.12, -sd[1]);
      var sunLum = (env.sunCol[0] + env.sunCol[1] + env.sunCol[2]) / 3;
      var sa = BTS.M.clamp(sunLum * 0.55, 0, 0.58) * BTS.M.clamp(elev * 2.2, 0.45, 1);
      out.push({ key: 'sun', dx: sd[0] / h, dz: sd[2] / h, k: BTS.M.clamp(h / elev, 0.45, 1.9), a: sa });
    }
    out.sort(function (p, q) { return q.a - p.a; });
    return out;
  }
  var MAX_SHADOWS = 2;

  /* per-caster smoothing: up to two shadows, each fading in/out and turning smoothly when the set of
     strongest lights changes (many lamps at the fair used to make one shadow flip from side to side) */
  function smoothSlots(sc, cands, dt) {
    var slots = sc.slots || (sc.slots = {});
    var want = {};
    for (var i = 0; i < cands.length && i < MAX_SHADOWS; i++) {
      var c = cands[i];
      // the second shadow is only worth drawing if that light is comparably strong
      if (i > 0 && c.a < cands[0].a * 0.35) break;
      want[c.key] = c;
    }
    var rate = 1 - Math.exp(-dt * 5), arate = 1 - Math.exp(-dt * 3);
    for (var k in want) {
      var w = want[k], sl = slots[k];
      if (!sl) sl = slots[k] = { dx: w.dx, dz: w.dz, k: w.k, a: 0 };
      sl.dx += (w.dx - sl.dx) * rate; sl.dz += (w.dz - sl.dz) * rate; sl.k += (w.k - sl.k) * rate;
      var n = Math.hypot(sl.dx, sl.dz) || 1; sl.dx /= n; sl.dz /= n;
      sl.a += (w.a - sl.a) * arate;
    }
    var list = [];
    for (k in slots) {
      if (!want[k]) { slots[k].a += (0 - slots[k].a) * arate; if (slots[k].a < 0.01) { delete slots[k]; continue; } }
      list.push(slots[k]);
    }
    list.sort(function (p, q) { return q.a - p.a; });
    return list;
  }

  function castOne(R, e, sc, src, L, primary, fade, t, heightAt) {
      var dx = L.dx, dz = L.dz, len = L.k, alpha = L.a * sc.alpha * fade;
      var bx = src.x, bz = src.z;
      if (sc.stage === 1) { len *= 1 + 0.22 * Math.sin(t * 0.8 + sc.phase); if (Math.sin(t * 0.37 + sc.phase) > 0.93) { var a1 = 0.35; var c1 = Math.cos(a1), s1 = Math.sin(a1); var ndx = dx * c1 - dz * s1; dz = dx * s1 + dz * c1; dx = ndx; } }
      if (sc.stage === 2) {
        var ang = Math.sin(t * 0.5 + sc.phase) * 0.6 + (Math.sin(t * 0.13 + sc.phase) > 0.6 ? 1.2 : 0);
        var ca = Math.cos(ang), sa = Math.sin(ang), nx = dx * ca - dz * sa; dz = dx * sa + dz * ca; dx = nx;
        len *= 1.3 + 0.35 * Math.sin(t * 0.9 + sc.phase);
      }
      if (sc.stage === 3) {
        sc.wander[0] = Math.sin(t * 0.31 + sc.phase) * 0.9; sc.wander[1] = Math.cos(t * 0.23 + sc.phase * 2) * 0.7;
        bx += sc.wander[0]; bz += sc.wander[1];
        len *= 1.6; alpha *= 0.75 + 0.25 * Math.sin(t * 3 + sc.phase);
      }
      if (sc.angle) { var c2 = Math.cos(sc.angle), s2 = Math.sin(sc.angle), n2 = dx * c2 - dz * s2; dz = dx * s2 + dz * c2; dx = n2; }
      len *= sc.lenMul;
      var sreg = src.reg, scale = 1;
      if (sc.beast > 0) {
        sc.beastFrame = Math.floor(t * 3) % 4;
        sreg = BTS.Atlas.get('shadow_beast_' + sc.beastFrame);
        scale = 0.55 + sc.beast * 1.25;
        alpha = Math.max(alpha, 0.35 + sc.beast * 0.4) * fade;
      }
      var h = sreg.h / 16 * scale, w = sreg.w / 16 * scale;
      var px = -dz * w / 2, pz = dx * w / 2;
      var tx = bx + dx * h * len, tz = bz + dz * h * len;
      var by = heightAt(bx, bz) + 0.03, ty = heightAt(tx, tz) + 0.03;
      R.pushFx(0, [[bx - px, by, bz - pz], [bx + px, by, bz + pz], [tx + px, ty, tz + pz], [tx - px, ty, tz - pz]], sreg, [COL[0], COL[1], COL[2], BTS.M.clamp(alpha, 0, 0.85)]);
      // silhouette climbing a wall (supernatural states)
      if (sc.wall && primary) {
        var W = sc.wall, wh = h * (1.2 + sc.beast), ww = w * 1.1;
        var wx = W.x, wz = W.z + 0.04, wy = W.y || heightAt(W.x, W.z);
        var sway = Math.sin(t * 1.3 + sc.phase) * 0.3;
        R.pushFx(3, [[wx - ww / 2, wy, wz], [wx + ww / 2, wy, wz], [wx + ww / 2 + sway, wy + wh, wz], [wx - ww / 2 + sway, wy + wh, wz]], sreg, [COL[0], COL[1], COL[2], BTS.M.clamp(alpha * 1.2, 0, 0.8)]);
      }
  }

  S.render = function (R, env, ents, world) {
    var t = BTS.App.time;
    S.dt = Math.min(0.1, Math.max(0.001, t - (S.lastT || t))); S.lastT = t;
    var blob = BTS.Atlas.get('blob_shadow');
    var heightAt = world.heightAt;
    for (var i = 0; i < ents.length; i++) {
      var e = ents[i], sc = e.shadow;
      if (!sc || e.hidden) continue;
      var reg = e.anim ? e.anim.region(e.dir) : (e.sprite ? BTS.Atlas.get(e.sprite) : null);
      if (!reg) continue;
      // history for lag
      sc.history.push({ x: e.x, z: e.z, reg: reg, t: t, flip: false });
      while (sc.history.length > 2 && t - sc.history[0].t > 2.2) sc.history.shift();
      if (sc.stage >= 4 || !sc.visible) continue;
      var gy = heightAt(e.x, e.z) + 0.025;
      var fade = e.alpha === undefined ? 1 : e.alpha;
      // contact shadow
      var bw = 0.42 * (reg.w / 24) + 0.12, bd = 0.2;
      R.pushFx(3, [[e.x - bw, gy, e.z + bd], [e.x + bw, gy, e.z + bd], [e.x + bw, gy, e.z - bd], [e.x - bw, gy, e.z - bd]], blob, [COL[0], COL[1], COL[2], 0.55 * fade * sc.alpha]);
      var slots = smoothSlots(sc, candidates(e, env), S.dt || 0.016);
      if (!slots.length && sc.beast) slots = [{ dx: 0.3, dz: -0.95, k: 1.2, a: 0.4 }];
      var src = { x: e.x, z: e.z, reg: reg };
      if (sc.lag > 0) {
        var want = t - sc.lag;
        for (var k = sc.history.length - 1; k >= 0; k--) if (sc.history[k].t <= want) { src = sc.history[k]; break; }
        if (k < 0 && sc.history.length) src = sc.history[0];
      }
      for (var si = 0; si < slots.length; si++) castOne(R, e, sc, src, slots[si], si === 0, fade, t, heightAt);
    }
  };
  return S;
})();
