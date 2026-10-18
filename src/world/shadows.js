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

  /* ---------- Jaglika: her shadow grows with every death and every time she is seen ----------
     One level per beat (monotonic through the story), floored by the number of victims already dead.
     level 0 at the fair (a little long), 1 after Zajko, 2 Mama, 3 Tata, 4 Gorazd, 5 Jessica, 6 Tihomir,
     ~7.5 at the rite (enormous, no longer human). */
  var JAG_STEPS = [['p_go_fair', 0], ['p_night', 0.25], ['c1_start', 0.5], ['c1_storm', 0.7], ['c2_bell', 1], ['c2_funeral', 1.2],
    ['c2_parents', 2], ['c2_alone', 3], ['c3_start', 3.1], ['c4_walk', 3.4], ['c4_gorazd_dead', 4], ['c4_jessica_dead', 5],
    ['c6_plan', 5.2], ['c6_follow', 5.35], ['c6_window', 5.5], ['c7_wait', 5.6], ['c7_hide', 5.75], ['c9_silence', 6], ['c9_dusk', 6.4],
    ['c10_meadow', 6.8], ['c10_rite', 7.5]];
  var VICTIMS = ['zajko', 'pecko', 'gvozdin', 'gorazd', 'jessica', 'tihomir'];
  S.jaglikaLevel = function () {
    var St = BTS.State, Sy = BTS.Story; if (!St || !St.d || !Sy || !Sy.indexOf) return 0;
    var ci = Sy.indexOf(St.d.beat), lv = 0;
    for (var i = 0; i < JAG_STEPS.length; i++) { var bi = Sy.indexOf(JAG_STEPS[i][0]); if (bi >= 0 && bi <= ci) lv = Math.max(lv, JAG_STEPS[i][1]); }
    var dead = 0; VICTIMS.forEach(function (v) { if (St.isDead(v)) dead++; });
    return Math.max(lv, dead);
  };
  /* the single source of her shadow's size: len (length multiplier), width, beast (0 human .. 1 inhuman), lag */
  S.jaglikaGrowth = function (level) {
    var l = level === undefined ? S.jaglikaLevel() : level;
    return { level: l, len: 1.15 + l * 0.2, width: 1 + l * 0.06, beast: BTS.M.clamp((l - 3.5) / 4, 0, 1), lag: Math.min(0.35, l * 0.04), alpha: 1 + Math.min(0.5, l * 0.07) };
  };

  /* a ground silhouette from the feet (b) to the tip (b + d*len), subdivided along its length so every vertex
     sits on the terrain (slopes, the church rise, pads/plinths) instead of a flat quad sinking under it.
     v runs from vFeet (feet) to vTip (tip); the sprite's u spans the width (p = half-width vector). */
  var GROUND_SEGS = 8, GROUND_OFF = 0.04;
  function groundStrip(R, bx, bz, ux, uz, len, px, pz, reg, col, vFeet, vTip, heightAt) {
    var q = 0.9999, n = len > 0.6 ? GROUND_SEGS : 2;
    var prev = null;
    for (var i = 0; i <= n; i++) {
      var f = i / n, cx = bx + ux * len * f, cz = bz + uz * len * f, v = vFeet + (vTip - vFeet) * f;
      var lx = cx - px, lz = cz - pz, rx = cx + px, rz = cz + pz;
      var cy = heightAt(cx, cz);
      var row = [[lx, Math.max(heightAt(lx, lz), cy - 0.25) + GROUND_OFF, lz], [rx, Math.max(heightAt(rx, rz), cy - 0.25) + GROUND_OFF, rz], v];
      if (prev) R.pushFx(0, [prev[0], prev[1], row[1], row[0]], reg, col, [[0, prev[2]], [q, prev[2]], [q, row[2]], [0, row[2]]]);
      prev = row;
    }
  }

  /* one silhouette layer: on the ground from the feet, or — with a wall — along the ground to the wall's foot and up it */
  function layer(R, sc, bx, bz, dx, dz, len, sreg, scale, wscale, alpha, primary, t, heightAt) {
    var h = sreg.h / 16 * scale, w = sreg.w / 16 * scale * wscale;
    var q = 0.9999;
    var Wl = sc.wall && primary ? sc.wall : null;
    if (Wl && Wl.z < bz - 0.15) {
      // a projection: the shadow leaves the feet along the ground toward the wall, then climbs it from where it meets it
      var gx = Wl.x - bx, gz = Wl.z - bz, gd = Math.hypot(gx, gz) || 1;
      dx = gx / gd; dz = gz / gd;
      var wallH = h * (1.05 + (sc.beast || 0) * 0.5) * Math.max(1, len * 0.75);
      var total = gd + wallH, f = gd / total, vs = q * (1 - f);
      var px = -dz * w / 2, pz = dx * w / 2;
      var fx = bx + dx * gd, fz = Wl.z + 0.05, fy = Wl.y !== undefined ? Wl.y : heightAt(fx, fz - 0.3);
      var gy = heightAt(fx, fz + 0.2) + 0.03;
      groundStrip(R, bx, bz, dx, dz, gd, px, pz, sreg, [COL[0], COL[1], COL[2], BTS.M.clamp(alpha, 0, 0.85)], q, vs, heightAt);
      var ww = Math.abs(px) * 2 || w, lean = Math.sin(t * 1.3 + sc.phase) * 0.18 * (sc.beast ? 1.5 : 1) + (sc.wallLean || 0);   // wallLean: the top leans away on its own
      var x0 = fx - ww / 2, x1 = fx + ww / 2;
      R.pushFx(3, [[x0, fy, fz], [x1, fy, fz], [x1 + lean, fy + wallH, fz], [x0 + lean, fy + wallH, fz]], sreg, [COL[0], COL[1], COL[2], BTS.M.clamp(alpha * 1.15, 0, 0.82)], [[0, vs], [q, vs], [q, 0], [0, 0]]);
      return;
    }
    var px2 = -dz * w / 2, pz2 = dx * w / 2;
    groundStrip(R, bx, bz, dx, dz, h * len, px2, pz2, sreg, [COL[0], COL[1], COL[2], BTS.M.clamp(alpha, 0, 0.85)], q, 0, heightAt);
  }

  /* the shadow always starts at the caster's feet: lag, stretch and turning change its shape and direction, never its anchor */
  function castOne(R, e, sc, src, L, primary, fade, t, heightAt, grow) {
      var dx = L.dx, dz = L.dz, len = L.k, alpha = L.a * sc.alpha * fade;
      var bx = e.x, bz = e.z;
      if (sc.stage === 1) { len *= 1 + 0.22 * Math.sin(t * 0.8 + sc.phase); if (Math.sin(t * 0.37 + sc.phase) > 0.93) { var a1 = 0.35; var c1 = Math.cos(a1), s1 = Math.sin(a1); var ndx = dx * c1 - dz * s1; dz = dx * s1 + dz * c1; dx = ndx; } }
      if (sc.stage === 2) {
        var ang = Math.sin(t * 0.5 + sc.phase) * 0.6 + (Math.sin(t * 0.13 + sc.phase) > 0.6 ? 1.2 : 0);
        var ca = Math.cos(ang), sa = Math.sin(ang), nx = dx * ca - dz * sa; dz = dx * sa + dz * ca; dx = nx;
        len *= 1.3 + 0.35 * Math.sin(t * 0.9 + sc.phase);
      }
      if (sc.stage === 3) {
        // late stage: pulling away — it strains and turns on its own and thins out, but stays fastened at the feet
        var ang3 = Math.sin(t * 0.31 + sc.phase) * 0.9 + Math.sin(t * 0.83 + sc.phase * 2) * 0.35;
        var c3 = Math.cos(ang3), s3 = Math.sin(ang3), n3 = dx * c3 - dz * s3; dz = dx * s3 + dz * c3; dx = n3;
        len *= 1.6 + 0.3 * Math.sin(t * 0.7 + sc.phase); alpha *= 0.7 + 0.25 * Math.sin(t * 3 + sc.phase);
      }
      if (sc.fixDir) { var fl = Math.hypot(sc.fixDir[0], sc.fixDir[1]) || 1; dx = sc.fixDir[0] / fl; dz = sc.fixDir[1] / fl; }   // scripted: it lies where it wants, not where the light says
      if (sc.angle) { var c2 = Math.cos(sc.angle), s2 = Math.sin(sc.angle), n2 = dx * c2 - dz * s2; dz = dx * s2 + dz * c2; dx = n2; }
      len *= sc.lenMul;
      var beast = sc.beast || 0, wscale = 1;
      if (grow) { len *= grow.len; wscale = grow.width; beast = Math.max(beast, grow.beast); alpha *= grow.alpha; }
      sc.beastFrame = Math.floor(t * 3) % 4;
      var human = 1 - BTS.M.clamp((beast - 0.3) / 0.6, 0, 1);   // cross-fade: a human silhouette slowly becomes the beast
      if (human > 0.02) layer(R, sc, bx, bz, dx, dz, len, src.reg, 1, wscale, alpha * human, primary && human >= 0.5, t, heightAt);
      if (beast > 0.15) {
        var breg = BTS.Atlas.get('shadow_beast_' + sc.beastFrame);
        var ba = Math.max(alpha, 0.35 + beast * 0.4) * (1 - human * 0.6);
        layer(R, sc, bx, bz, dx, dz, len / Math.max(1, grow ? grow.len * 0.6 : 1), breg, 0.55 + beast * 1.25, 1, ba, primary && human < 0.5, t, heightAt);
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
      if (!slots.length && (sc.beast || sc.wall || sc.fixDir || sc.pose)) slots = [{ dx: 0.3, dz: -0.95, k: 1.2, a: 0.4 }];
      var grow = e.id === 'jaglika' && !sc.noGrow ? S.jaglikaGrowth() : null;
      var src = { x: e.x, z: e.z, reg: reg };
      /* the shadow acting on its own: it shows a different pose (and facing) from the body, still fastened at the feet */
      if (sc.pose && e.anim) {
        var shp = BTS.CharSprites.sheets[BTS.CharSprites.variant(e.anim.sheetId)] || e.anim.sheet;
        var pc = shp && (shp.anims[sc.pose + '_' + (sc.poseDir || e.dir)]);
        if (pc) src = { x: e.x, z: e.z, reg: pc.frames[Math.floor(t * pc.fps) % pc.frames.length] };
      }
      var lag = Math.max(sc.lag, grow ? grow.lag : 0);
      if (lag > 0 && !sc.pose) {   // a late shadow repeats an earlier pose of the body — always at the current feet
        var want = t - lag;
        for (var k = sc.history.length - 1; k >= 0; k--) if (sc.history[k].t <= want) { src = sc.history[k]; break; }
        if (k < 0 && sc.history.length) src = sc.history[0];
      }
      for (var si = 0; si < slots.length; si++) castOne(R, e, sc, src, slots[si], si === 0, fade, t, heightAt, grow);
    }
  };
  return S;
})();
