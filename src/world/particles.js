/* Particle systems: rain (with splashes and roof drips), chimney smoke, embers, fireflies,
   dust motes, wind-blown leaves/petals and shadow wisps. Pushed to the renderer fx batches. */
'use strict';
BTS.Particles = (function () {
  var P = { list: [], emitters: [], max: 2600 };
  var rnd = Math.random;
  var REG = {};
  function reg(n) { return REG[n] || (REG[n] = BTS.Atlas.get(n)); }

  P.clear = function () { P.list.length = 0; P.emitters.length = 0; };
  /* emitter: {type:'smoke'|'embers'|'fireflies'|'dust'|'drip'|'wisps'|'leaves'|'petals', x,y,z, rate, area:[w,d], night:bool} */
  P.addEmitter = function (e) { e.acc = 0; P.emitters.push(e); return e; };
  P.spawn = function (p) { if (P.list.length < P.max) P.list.push(p); };

  function emit(e, dt) {
    var env = BTS.Env, rate = e.rate || 4;
    if (e.night && !(env.lampOn > 0.3)) return;
    if (e.dayOnly && env.lampOn > 0.5) return;
    if (e.off) return;
    if (e.fx && BTS.Config.get('effects') === 0 && e.type !== 'smoke') return;
    e.acc += dt * rate;
    while (e.acc >= 1) {
      e.acc -= 1;
      var ax = e.area ? (rnd() - 0.5) * e.area[0] : 0, az = e.area ? (rnd() - 0.5) * e.area[1] : 0;
      var x = e.x + ax, z = e.z + az, y = e.y;
      switch (e.type) {
        case 'smoke': P.spawn({ t: 'smoke', x: x, y: y, z: z, vx: 0, vy: 0.55 + rnd() * 0.25, vz: 0, life: 0, max: 4 + rnd() * 2, size: 0.35, grow: 0.45, col: e.col || [0.55, 0.55, 0.58] }); break;
        case 'embers': P.spawn({ t: 'ember', x: x, y: y, z: z, vx: (rnd() - 0.5) * 0.4, vy: 0.9 + rnd() * 1.2, vz: (rnd() - 0.5) * 0.4, life: 0, max: 1 + rnd() * 1.5, size: 0.08 }); break;
        case 'fireflies': P.spawn({ t: 'firefly', x: x, y: y + rnd() * 1.4, z: z, vx: 0, vy: 0, vz: 0, life: 0, max: 5 + rnd() * 5, size: 0.14, ph: rnd() * 6 }); break;
        case 'dust': P.spawn({ t: 'dust', x: x, y: y + rnd() * 2.5, z: z, vx: (rnd() - 0.5) * 0.05, vy: (rnd() - 0.5) * 0.04, vz: 0, life: 0, max: 6 + rnd() * 4, size: 0.05, ph: rnd() * 6 }); break;
        case 'leaves': P.spawn({ t: 'leaf', x: x, y: y + 3 + rnd() * 3, z: z, vx: 0, vy: -0.5, vz: 0, life: 0, max: 7, size: 0.18, ph: rnd() * 6 }); break;
        case 'petals': P.spawn({ t: 'petal', x: x, y: y + 2 + rnd() * 3, z: z, vx: 0, vy: -0.35, vz: 0, life: 0, max: 7, size: 0.12, ph: rnd() * 6 }); break;
        case 'wisps': P.spawn({ t: 'wisp', x: x, y: y + rnd() * 0.3, z: z, vx: (rnd() - 0.5) * 0.3, vy: 0.05, vz: (rnd() - 0.5) * 0.3, life: 0, max: 2.5 + rnd() * 2, size: 0.5 + rnd() * 0.4 }); break;
        case 'drip': if (BTS.Env.wet > 0.3 || BTS.Env.rain > 0.05) P.spawn({ t: 'drip', x: x, y: y, z: z, vx: 0, vy: -1, vz: 0, life: 0, max: 1.5, size: 0.06 }); break;
      }
    }
  }

  P.update = function (dt, cam) {
    var env = BTS.Env;
    for (var i = 0; i < P.emitters.length; i++) emit(P.emitters[i], dt);
    // rain around the camera target
    if (env.rain > 0.01 && !env.interior) {
      var n = Math.floor(env.rain * 900 * dt * (BTS.Config.get('effects') === 0 ? 0.4 : 1));
      var t = cam.target;
      for (var k = 0; k < n; k++) {
        P.spawn({ t: 'rain', x: t[0] + (rnd() - 0.5) * 34, y: 9 + rnd() * 5, z: t[2] + (rnd() - 0.6) * 30, vx: env.wind[0] * 2.2, vy: -17 - rnd() * 4, vz: env.wind[2] * 2, life: 0, max: 1.2, size: 0.04 });
      }
    }
    var W = env.wind, ground = BTS.World && BTS.World.heightAt ? BTS.World.heightAt : function () { return 0; };
    var list = P.list;
    for (i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.life += dt;
      if (p.life >= p.max) { list[i] = list[list.length - 1]; list.pop(); continue; }
      switch (p.t) {
        case 'smoke': p.vx = W[0] * 0.9; p.vz = W[2] * 0.6; p.size += p.grow * dt; break;
        case 'ember': p.vx += W[0] * dt * 0.8; p.vy -= 0.4 * dt; break;
        case 'firefly': p.vx = Math.sin(p.life * 0.9 + p.ph) * 0.3; p.vz = Math.cos(p.life * 0.7 + p.ph * 2) * 0.3; p.vy = Math.sin(p.life * 1.3 + p.ph) * 0.15; break;
        case 'dust': p.vx = Math.sin(p.life * 0.4 + p.ph) * 0.06; p.vy = Math.cos(p.life * 0.3 + p.ph) * 0.03; break;
        case 'leaf': case 'petal': p.vx = W[0] * 1.6 + Math.sin(p.life * 2 + p.ph) * 0.5; p.vz = W[2] * 1.2 + Math.cos(p.life * 1.6 + p.ph) * 0.3; if (p.y < ground(p.x, p.z) + 0.05) { p.vx = p.vz = p.vy = 0; } else p.vy = -0.45; break;
        case 'wisp': p.vy += 0.1 * dt; p.size += 0.2 * dt; break;
        case 'drip': p.vy -= 9.8 * dt; break;
        case 'splash': break;
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if ((p.t === 'rain' || p.t === 'drip') && p.y <= ground(p.x, p.z)) {
        if (rnd() < 0.35) P.spawn({ t: 'splash', x: p.x, y: ground(p.x, p.z) + 0.03, z: p.z, vx: 0, vy: 0, vz: 0, life: 0, max: 0.18, size: 0.12 });
        list[i] = list[list.length - 1]; list.pop();
      }
    }
  };

  P.render = function (R, env) {
    var amb = [env.skyCol[0] + 0.25, env.skyCol[1] + 0.25, env.skyCol[2] + 0.28];
    var soft = reg('soft_dot'), white = reg('white');
    var cam = BTS.Camera;
    for (var i = 0; i < P.list.length; i++) {
      var p = P.list[i], f = p.life / p.max, a;
      switch (p.t) {
        case 'rain': {
          var len = 0.55;
          var vx = p.vx / 20 * len, vy = -len, vz = p.vz / 20 * len;
          var w = 0.025 * 1.0;
          var rx = cam.right[0] * w, rz = cam.right[2] * w;
          R.pushFx(1, [[p.x - rx, p.y, p.z - rz], [p.x + rx, p.y, p.z + rz], [p.x + rx - vx, p.y - vy, p.z + rz - vz], [p.x - rx - vx, p.y - vy, p.z - rz - vz]], white, [amb[0] * 1.1, amb[1] * 1.15, amb[2] * 1.25, 0.35 + env.flash * 0.4]);
          break;
        }
        case 'splash': R.pushParticle(1, soft, p.x, p.y, p.z, p.size * (0.6 + f), [amb[0] * 1.2, amb[1] * 1.2, amb[2] * 1.3, 0.5 * (1 - f)], 0.35); break;
        case 'drip': R.pushParticle(1, white, p.x, p.y, p.z, p.size, [amb[0] * 1.3, amb[1] * 1.3, amb[2] * 1.4, 0.6], 2.5); break;
        case 'smoke': a = Math.sin(f * Math.PI) * 0.32; R.pushParticle(1, reg('smoke'), p.x, p.y, p.z, p.size, [p.col[0] * (amb[0] + 0.2), p.col[1] * (amb[1] + 0.2), p.col[2] * (amb[2] + 0.2), a]); break;
        case 'ember': a = (1 - f); R.pushParticle(2, soft, p.x, p.y, p.z, p.size, [1.6, 0.7, 0.25, a]); break;
        case 'firefly': a = Math.max(0, Math.sin(p.life * 2.2 + p.ph)) * Math.sin(f * Math.PI); R.pushParticle(2, soft, p.x, p.y, p.z, p.size, [1.0, 1.1, 0.5, a]); break;
        case 'dust': a = Math.sin(f * Math.PI) * 0.5; R.pushParticle(2, soft, p.x, p.y, p.z, p.size, [1.0, 0.9, 0.7, a]); break;
        case 'leaf': R.pushParticle(1, reg('leaf'), p.x, p.y, p.z, p.size, [amb[0] + 0.5, amb[1] + 0.45, amb[2] + 0.4, Math.min(1, (1 - f) * 3)]); break;
        case 'petal': R.pushParticle(1, reg('petal'), p.x, p.y, p.z, p.size, [1, 1, 1, Math.min(1, (1 - f) * 3)]); break;
        case 'wisp': a = Math.sin(f * Math.PI) * 0.55; R.pushParticle(3, reg('smoke'), p.x, p.y, p.z, p.size, [0.01, 0.0, 0.02, a]); break;
      }
    }
  };
  return P;
})();
