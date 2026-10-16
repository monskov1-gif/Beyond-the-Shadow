/* Portrait component library for the 2.5D portrait painter (portraits.js): hair styles, beards, hats,
   outfits and accessories, all built from ellipsoids in the head frame (a.F) or the body frame (a.Fb)
   and masked / displaced in their own surface coordinates so they wrap the 3/4 view correctly.
   Which components a character wears is data: the `portrait` entry of each character in data/characters.js. */
'use strict';
BTS.PortraitLib = (function () {
  var C = BTS.Col;

  function lum(c) { return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; }
  function hairMat(a, c, o) {
    o = o || {};
    var L = lum(c), M = a.mat;
    if (L < 40) return M(c, { n: 5, lo: 0.55, hi: 2.0 + (o.hiBoost || 0), shadow: [6, 5, 10], light: o.sheen || [100, 110, 140], warm: 0.22, shift: 0.2, spec: 0.9, shine: 14, hiCol: C.mix(c, o.sheen || [150, 158, 178], 0.6), dither: 0.4, rim: 0.4 });
    if (L < 90) return M(c, { n: 5, lo: 0.5, hi: 1.55, shadow: [30, 16, 30], warm: 0.5, spec: 0.8, shine: 14, hiCol: C.mix(C.mul(c, 1.7), [255, 236, 200], 0.3), dither: 0.4 });
    return M(c, { n: 5, lo: 0.45, hi: 1.22, shadow: [60, 40, 70], warm: 0.6, spec: 0.7, shine: 16, dither: 0.4 });
  }
  function cloth(a, c, o) {
    o = o || {};
    var L = lum(c);
    if (L < 45) return a.mat(c, { n: 5, lo: 0.6, hi: 2.0, shadow: [10, 8, 18], light: o.light || [130, 130, 150], warm: 0.25, shift: 0.2, dither: 0.6, rim: 0.4, spec: o.spec, shine: o.shine });
    return a.mat(c, { n: 5, lo: 0.42, hi: 1.2, dither: 0.6, rim: 0.3, spec: o.spec, shine: o.shine, hiCol: o.hiCol, shadow: o.shadow });
  }
  function metal(a, c) { return a.mat(c, { n: 5, lo: 0.4, hi: 1.4, spec: 1.2, shine: 10, hiCol: [255, 250, 230], dither: 0, rim: 0.1 }); }

  /* ---------------- geometry helpers ---------------- */
  function cranY(f) { return f.child === 2 ? -0.5 : f.child ? -0.44 : -0.38; }
  function shell(a, inf, o) {
    o = o || {}; var f = a.f, c = f.cran;
    return a.E([o.x || 0, cranY(f) - (o.lift || 0), -0.1 - (o.back || 0)], [0.98 * c + inf + (o.wide || 0), 1.0 * c + inf + (o.tall || 0), 1.05 * c + inf + (o.deep || 0)], o.rot ? { rot: o.rot } : undefined);
  }
  function phiOf(X, Z) { return Math.atan2(X, Z); }
  /* clumped hair strands: ridges across u, flowing along v */
  function strands(a, u, v, o) {
    var w = u * o.freq + Math.sin(v * (o.wave || 2.5) + u * 1.3) * (o.waveAmp || 0.25);
    var i = Math.floor(w), fr = w - i, r = a.hash(i, o.seed || 3);
    var ridge = Math.pow(Math.sin(Math.PI * fr), 0.7);
    return { d: o.amp * (0.45 + 0.55 * r) * ridge, i: i, fr: fr, r: r };
  }
  /* generic hairline test: hair exists above this local Y at azimuth phi */
  function hairlineY(X, Z, o) {
    var ph = Math.abs(phiOf(X, Z));
    var front = o.front === undefined ? -0.66 : o.front, temple = o.temple === undefined ? -0.5 : o.temple;
    var side = o.side === undefined ? 0.12 : o.side, ear = o.ear === undefined ? -0.12 : o.ear, back = o.back === undefined ? 0.95 : o.back;
    if (ph < 0.45) return front;
    if (ph < 1.05) return front + (temple - front) * (ph - 0.45) / 0.6;
    if (ph < 1.42) return side;
    if (ph < 1.95) return ear;
    return back;
  }

  /* ================= HAIR ================= */
  var HAIR = {};
  function addHair(a, part) { part.F = part.F || a.F; part.mat = part.mat || 'hair'; a.parts.push(part); return part; }

  /* Đorđe: thick black shaggy mop, bangs hanging to the eyes, locks over the ears to the jaw */
  HAIR.shaggy = function (a, o) {
    var f = a.f, E = a.E, fringe = o.fringe === undefined ? 0.06 : o.fringe, len = o.len === undefined ? 0.75 : o.len;
    var prims = [shell(a, 0.2, { wide: 0.04, tall: 0.03 }), E([-0.86, 0.15, -0.15], [0.3, 0.75, 0.6]), E([0.86, 0.15, -0.15], [0.3, 0.75, 0.6]), E([0, 0.0, -0.55], [0.95, 1.05, 0.7])];
    // tufts on the crown
    [[-0.5, -1.25, 0.3], [0.1, -1.38, 0.2], [0.55, -1.2, 0.25], [-0.15, -1.32, -0.3], [0.8, -0.9, 0.2], [-0.9, -0.85, 0.0]].forEach(function (t, k) {
      prims.push(E([t[0], t[1] + 0.08, t[2]], [0.22, 0.3, 0.22], { rot: [0, 0, t[0] * 0.6] }));
    });
    addHair(a, { name: 'hair', prims: prims, k: 0.16, line: true,
      mask: function (X, Y, Z) {
        var ph = Math.abs(phiOf(X, Z));
        var s = strands(a, phiOf(X, Z), Y, { freq: 7, amp: 1, seed: 11 });
        var tip = Math.pow(Math.abs(s.fr - 0.5) * 2, 2) * 0.12;
        if (ph < 0.95) { var lim = fringe + (s.r - 0.5) * 0.16 - tip; if (Math.abs(X - 0.05) < 0.12) lim -= 0.08; return Y < lim; }
        return Y < len + (s.r - 0.5) * 0.25 - tip * 1.5 - (ph > 2.2 ? -0.2 : 0);
      },
      disp: function (X, Y, Z) { var s = strands(a, phiOf(X, Z), Y, { freq: 7, amp: 0.05, seed: 11, wave: 3, waveAmp: 0.3 }); var s2 = strands(a, phiOf(X, Z) + 0.07, Y, { freq: 15, amp: 0.02, seed: 4 }); return s.d + s2.d; } });
  };

  /* short hair, optional messy top; used for boys and men */
  HAIR.short = function (a, o) {
    var E = a.E, messy = o.messy || 0;
    var prims = [shell(a, 0.07 + (o.volume || 0), { tall: 0.02 + (o.volume || 0) * 0.5 })];
    if (messy) [[-0.4, -1.3, 0.35], [0.2, -1.38, 0.25], [0.6, -1.15, 0.35], [-0.2, -1.3, -0.25]].forEach(function (t) { prims.push(E(t, [0.18, 0.2 + messy * 0.08, 0.18], { rot: [0, 0, t[0] * 0.7] })); });
    addHair(a, { name: 'hair', prims: prims, k: 0.12,
      mask: function (X, Y, Z) {
        var s = strands(a, phiOf(X, Z), Y, { freq: 9, amp: 1, seed: 5 });
        var lim = hairlineY(X, Z, { front: (o.front === undefined ? -0.66 : o.front) + (s.r - 0.5) * 0.06 * (1 + messy * 2), side: o.side, ear: o.ear, back: 0.9, temple: o.temple });
        if (o.fringe !== undefined && Math.abs(phiOf(X, Z)) < 0.9) lim = o.fringe + (s.r - 0.5) * 0.1 - Math.pow(Math.abs(s.fr - 0.5) * 2, 2) * 0.08;
        return Y < lim;
      },
      disp: function (X, Y, Z) { return strands(a, phiOf(X, Z), Y, { freq: 10, amp: 0.035, seed: 5, waveAmp: 0.15 + messy * 0.3 }).d; } });
  };
  /* receding crop, flattened (Gorazd with the cap off) */
  HAIR.crop = function (a, o) {
    addHair(a, { name: 'hair', prims: [shell(a, 0.05, {})], k: 0.1,
      mask: function (X, Y, Z) {
        var ph = Math.abs(phiOf(X, Z)), lim = hairlineY(X, Z, { front: -0.82, temple: -0.62, side: 0.05, ear: -0.15, back: 0.85 });
        if (ph < 0.6) lim = -0.86 - 0.05 * Math.cos(ph * 5);
        return Y < lim + (a.hash(Math.floor(X * 30), Math.floor(Y * 30)) - 0.5) * 0.04;
      },
      disp: function (X, Y, Z) { return strands(a, phiOf(X, Z), Y, { freq: 14, amp: 0.02, seed: 9 }).d - (Y < -1.1 ? 0.02 : 0); } });
  };
  HAIR.bald = function (a, o) {
    addHair(a, { name: 'hair', prims: [shell(a, 0.035, {})], k: 0.1,
      mask: function (X, Y, Z) { var ph = Math.abs(phiOf(X, Z)); if (ph < 1.3) return false; if (ph < 1.55) return Y > -0.45 && Y < 0.12; if (ph < 1.95) return Y > -0.45 && Y < -0.1; return Y > -0.5 && Y < 0.9; },
      disp: function (X, Y, Z) { return strands(a, Y * 2, phiOf(X, Z), { freq: 10, amp: 0.02, seed: 2 }).d; } });
  };
  /* copper bob with blunt bangs (Jaglika early) */
  HAIR.bob = function (a, o) {
    var E = a.E;
    var prims = [shell(a, 0.24, { wide: 0.08, tall: 0.05 }), E([-0.92, 0.2, -0.12], [0.36, 0.72, 0.68]), E([0.92, 0.2, -0.12], [0.36, 0.72, 0.68]), E([0, 0.15, -0.5], [1.1, 0.95, 0.7])];
    addHair(a, { name: 'hair', prims: prims, k: 0.2,
      mask: function (X, Y, Z) {
        var ph = Math.abs(phiOf(X, Z));
        if (ph < 0.98) return Y < -0.36 + 0.03 * Math.cos(X * 14);
        var lim = 0.68 - (ph < 1.3 ? (1.3 - ph) * 0.4 : 0);
        return Y < lim + 0.025 * Math.sin(phiOf(X, Z) * 18);
      },
      disp: function (X, Y, Z) { var ph = phiOf(X, Z); var s = strands(a, ph, Y, { freq: 11, amp: 0.035, seed: 21, waveAmp: 0.12 }); var curl = Y > 0.4 ? -(Y - 0.4) * 0.15 : 0; return s.d + curl; } });
  };
  /* hair pulled back into a ponytail (Lisa) */
  HAIR.ponytail = function (a, o) {
    var E = a.E;
    addHair(a, { name: 'hair', prims: [shell(a, 0.08, { tall: 0.03 })], k: 0.1,
      mask: function (X, Y, Z) { var lim = hairlineY(X, Z, { front: -0.64 - 0.06 * Math.max(0, -X), temple: -0.42, side: 0.0, ear: -0.15, back: 0.7 }); return Y < lim; },
      disp: function (X, Y, Z) { var ph = phiOf(X, Z); var s = strands(a, ph * 0.6 + (X > 0.15 ? 0.3 : 0), Y + Math.abs(X) * 0.5, { freq: 16, amp: 0.025, seed: 7, waveAmp: 0.05 }); return s.d; } });
    // a strand loose at the temple, the tail behind
    addHair(a, { name: 'tail', prims: [E([-0.05, -0.45, -1.15], [0.22, 0.24, 0.2]), E([-0.12, 0.25, -1.28], [0.2, 0.7, 0.2], { rot: [0, 0.35, 0] }), E([-0.18, 0.9, -1.15], [0.15, 0.45, 0.15], { rot: [0, 0.4, 0.1] })], k: 0.15,
      disp: function (X, Y, Z) { return strands(a, X * 2.5, Y, { freq: 6, amp: 0.04, seed: 8, waveAmp: 0.3 }).d; } });
    addHair(a, { name: 'band', mat: 'band', prims: [E([-0.06, -0.33, -1.2], [0.15, 0.08, 0.15])], k: 0.02 });
  };
  /* short layered blonde hair with a side-swept fringe (Jessica) */
  HAIR.pixie = function (a, o) {
    var E = a.E;
    addHair(a, { name: 'hair', prims: [shell(a, 0.15, { wide: 0.04, tall: 0.04 }), E([-0.88, 0.05, -0.15], [0.25, 0.55, 0.55]), E([0.88, 0.05, -0.15], [0.25, 0.55, 0.55])], k: 0.15,
      mask: function (X, Y, Z) {
        var ph = phiOf(X, Z), s = strands(a, ph, Y, { freq: 9, amp: 1, seed: 31 });
        if (Math.abs(ph) < 0.95) { var lim = -0.62 + (X + 0.5) * 0.32 + (s.r - 0.5) * 0.06 - Math.pow(Math.abs(s.fr - 0.5) * 2, 2) * 0.08; return Y < Math.min(lim, -0.1); }
        return Y < 0.35 + (s.r - 0.5) * 0.15 - Math.pow(Math.abs(s.fr - 0.5) * 2, 2) * 0.12;
      },
      disp: function (X, Y, Z) { var ph = phiOf(X, Z); return strands(a, ph + Y * 0.6, Y, { freq: 10, amp: 0.04, seed: 31, waveAmp: 0.2 }).d; } });
  };
  /* hair gathered into a bun at the back (Stana, Zlatko) */
  HAIR.bun = function (a, o) {
    var E = a.E;
    addHair(a, { name: 'hair', prims: [shell(a, 0.09, { tall: 0.04 })], k: 0.1,
      mask: function (X, Y, Z) { return Y < hairlineY(X, Z, { front: -0.64, temple: -0.45, side: -0.05, ear: -0.12, back: 0.65 }) + 0.015 * Math.sin(X * 30); },
      disp: function (X, Y, Z) { var ph = phiOf(X, Z); var part = X - 0.18; return strands(a, ph * 0.7 + (part > 0 ? 0.4 : 0), Y + Math.abs(part) * 0.7, { freq: 13, amp: 0.03, seed: 41, waveAmp: 0.08 }).d; } });
    addHair(a, { name: 'bun', prims: [E([-0.15, -0.75, -1.08], [0.42, 0.38, 0.32])], k: 0.1,
      disp: function (X, Y, Z) { var an = Math.atan2(Y + 0.75, X + 0.15); return strands(a, an, Math.hypot(X + 0.15, Y + 0.75), { freq: 3, amp: 0.05, seed: 43 }).d; } });
  };
  /* parted hair with one long braid over the shoulder (Vesna, Mila) */
  HAIR.braid = function (a, o) {
    var E = a.E;
    addHair(a, { name: 'hair', prims: [shell(a, 0.08, { tall: 0.03 })], k: 0.1,
      mask: function (X, Y, Z) { return Y < hairlineY(X, Z, { front: -0.6 + Math.abs(X - 0.05) * 0.18, temple: -0.32, side: 0.1, ear: 0.0, back: 0.7 }); },
      disp: function (X, Y, Z) { var part = X - 0.05; return strands(a, part * 2.2, Y, { freq: 8, amp: 0.03, seed: 51, waveAmp: 0.05 }).d - (Math.abs(part) < 0.025 && Z > 0.3 ? 0.03 : 0); } });
    // the braid comes from behind the near ear and falls over the shoulder in front
    var B = [];
    for (var k = 0; k < 6; k++) B.push(E([-0.95 + k * 0.03, 0.65 + k * 0.32, -0.25 + Math.min(k, 3) * 0.18], [0.17 - k * 0.008, 0.2, 0.15]));
    addHair(a, { name: 'braid', prims: B, k: 0.04, disp: function (X, Y, Z) { var t = (Y - 0.65) / 0.32; var fr = t - Math.floor(t); return -0.04 * Math.pow(Math.abs(fr - 0.5) * 2, 3) + (X + 0.92 > 0 ? -0.01 : 0); } });
    if (a.spec.ribbon) a.parts.push({ name: 'ribbon', F: a.F, mat: 'ribbon', prims: [E([-0.81, 2.6, 0.25], [0.18, 0.06, 0.1]), E([-0.86, 2.72, 0.24], [0.06, 0.16, 0.08], { rot: [0, 0, 0.3] })], k: 0.05 });
  };
  /* shoulder-length dark wavy hair, side part (Milka) */
  HAIR.wavy = function (a, o) {
    var E = a.E;
    var prims = [shell(a, 0.18, { wide: 0.1, tall: 0.05 }), E([-0.98, 0.35, -0.2], [0.42, 0.95, 0.7]), E([0.98, 0.35, -0.2], [0.42, 0.95, 0.7]), E([0, 0.4, -0.6], [1.2, 1.15, 0.7])];
    addHair(a, { name: 'hair', prims: prims, k: 0.22,
      mask: function (X, Y, Z) {
        var ph = Math.abs(phiOf(X, Z));
        if (ph < 0.95) { var sweep = -0.62 - 0.1 * Math.cos((X + 0.25) * 3); return Y < sweep; }
        return Y < 1.12 + 0.08 * Math.sin(phiOf(X, Z) * 9);
      },
      disp: function (X, Y, Z) { var ph = phiOf(X, Z); var wave = Math.sin(Y * 9 + ph * 2) * 0.03; var s = strands(a, ph + Math.sin(Y * 6) * 0.08, Y, { freq: 9, amp: 0.04, seed: 61, waveAmp: 0.2 }); return s.d + wave; } });
  };
  /* long hair tied back under the kamilavka (Father Sava) */
  HAIR.priest = function (a, o) {
    var E = a.E;
    addHair(a, { name: 'hair', prims: [shell(a, 0.1, { wide: 0.02 }), E([-0.2, 0.6, -0.95], [0.4, 0.8, 0.35])], k: 0.18,
      mask: function (X, Y, Z) { return Y < hairlineY(X, Z, { front: -0.7, temple: -0.5, side: 0.15, ear: 0.0, back: 1.4 }); },
      disp: function (X, Y, Z) { return strands(a, phiOf(X, Z), Y, { freq: 12, amp: 0.03, seed: 71, waveAmp: 0.2 }).d; } });
  };
  /* tight navy head-wrap with folds and a knot (Jaglika late) */
  HAIR.wrap = function (a, o) {
    var E = a.E;
    addHair(a, { name: 'wrap', mat: 'wrap', prims: [shell(a, 0.13, { tall: 0.1, lift: 0.04 })], k: 0.12,
      mask: function (X, Y, Z) { var ph = Math.abs(phiOf(X, Z)); var lim = ph < 1.0 ? -0.6 + ph * 0.08 : ph < 1.95 ? -0.26 : 0.55; return Y < lim; },
      disp: function (X, Y, Z) { var ph = phiOf(X, Z); var u = ph * 1.2 + Y * 2.4; var fr = u * 2.2 - Math.floor(u * 2.2); var u2 = -ph * 1.1 + Y * 2.2, fr2 = u2 * 1.6 - Math.floor(u2 * 1.6); return -0.035 * Math.pow(1 - Math.sin(Math.PI * fr), 3) * (X < 0.1 ? 1 : 0.4) - 0.03 * Math.pow(1 - Math.sin(Math.PI * fr2), 4) * (X >= 0.1 ? 1 : 0.3); } });
    addHair(a, { name: 'knot', mat: 'wrap', prims: [E([0.25, -1.36, 0.25], [0.3, 0.2, 0.26], { rot: [0.3, 0, 0.5] }), E([0.5, -1.25, 0.05], [0.22, 0.16, 0.2], { rot: [0, 0, 0.9] }), E([0.0, -1.3, 0.42], [0.18, 0.14, 0.18])], k: 0.06,
      disp: function (X, Y, Z) { return -0.03 * Math.pow(Math.abs(Math.sin((X + Y) * 12)), 6); } });
  };
  /* headscarf: tied under the chin (Baka) or at the nape (Pečko) */
  HAIR.scarf = function (a, o) {
    var E = a.E, chin = o.tie === 'chin', f = a.f;
    var prims = [shell(a, 0.13, { tall: 0.04, wide: 0.02 })];
    if (chin) prims.push(E([-0.9, 0.45, -0.1], [0.28, 0.9, 0.62]), E([0.9, 0.45, -0.1], [0.28, 0.9, 0.62]), E([0, 0.4, -0.6], [1.0, 1.1, 0.6]));
    else prims.push(E([0, 0.05, -0.75], [0.9, 0.85, 0.5]));
    a.parts.push({ name: 'scarf', F: a.F, mat: function (X, Y, Z) { return pattern(a, X, Y, Z) ? 'scarfP' : 'scarf'; }, prims: prims, k: 0.18,
      mask: function (X, Y, Z) {
        var ph = Math.abs(phiOf(X, Z));
        if (chin) { // face opening
          if (Z > 0 && ph < 1.45) { var oy = Y - 0.25, ox = X; var r = (ox * ox) / (0.78 * 0.78) + (oy * oy) / (1.02 * 1.02); if (Y > -0.62 && r < 1) return false; }
          return Y < (ph < 1.6 ? 1.15 : 1.5);
        }
        var front = -0.58 + 0.04 * Math.cos(X * 6);
        if (ph < 1.0) return Y < front;
        if (ph < 1.9) return Y < front + (ph - 1.0) * 0.55;
        return Y < 0.9;
      },
      disp: function (X, Y, Z) { var u = phiOf(X, Z); return -0.025 * Math.pow(Math.abs(Math.sin(u * 5 + Y * 2)), 6) - 0.02 * Math.pow(Math.abs(Math.sin(Y * 7 - u * 2)), 8); } });
    if (chin) a.parts.push({ name: 'knot', F: a.F, mat: 'scarf', prims: [E([0.08, f.chinY + 0.18, 0.42], [0.2, 0.14, 0.18]), E([-0.12, f.chinY + 0.35, 0.36], [0.12, 0.3, 0.1], { rot: [0, 0, 0.4] }), E([0.24, f.chinY + 0.36, 0.34], [0.12, 0.28, 0.1], { rot: [0, 0, -0.5] })], k: 0.05 });
    else a.parts.push({ name: 'knot', F: a.F, mat: 'scarf', prims: [E([-0.35, 0.7, -0.95], [0.25, 0.18, 0.2]), E([-0.55, 1.2, -0.85], [0.14, 0.42, 0.12], { rot: [0, 0, 0.3] })], k: 0.05 });
    if (o.hairCol !== false && !chin) addHair(a, { name: 'hair', prims: [shell(a, 0.06, {})], k: 0.1, mask: function (X, Y, Z) { return Y < -0.52 && Z > 0.5; }, disp: function (X, Y, Z) { return strands(a, X, Y, { freq: 14, amp: 0.02, seed: 3 }).d; } });
  };
  function pattern(a, X, Y, Z) {
    if (!a.spec.scarfPattern) return false;
    var u = phiOf(X, Z) * 5.5, v = Y * 5.5;
    var cu = Math.round(u), cv = Math.round(v + (cu & 1) * 0.5);
    var du = u - cu, dv = v + (cu & 1) * 0.5 - cv;
    var r = du * du + dv * dv;
    return r < 0.06 || (a.spec.scarfBorder && Y > 0.95);
  }

  /* ================= BEARDS ================= */
  function beard(a, kind, colr) {
    var f = a.f, E = a.E, my = f.mouthY, ny = f.noseY;
    var full = kind === 'full' || kind === 'long', long = kind === 'long';
    var prims = [E([0, 0.32, 0.1], [0.84 + f.stout * 0.08, 1.0, 0.86]), E([-f.jawX, f.jawY, -0.02], [0.36, 0.48, 0.5]), E([f.jawX, f.jawY, -0.02], [0.36, 0.48, 0.5]), E([0, f.chinY - 0.12, f.chinZ + 0.06], [f.chinW + 0.1, 0.3, 0.3])];
    if (long) prims.push(E([0, f.chinY + 0.35, f.chinZ - 0.05], [0.42, 0.6, 0.32]));
    if (kind === 'short') prims.push(E([0, f.chinY - 0.05, f.chinZ], [f.chinW + 0.06, 0.24, 0.28]));
    a.parts.push({ name: 'beard', F: a.F, mat: 'beard', prims: prims, k: 0.12, lineGap: 1.6,
      mask: function (X, Y, Z) {
        var ax = Math.abs(X);
        if (Z < -0.35 && Y < 0.6) return false;
        if (Y < ny + 0.02 - ax * 0.35 + (ax > 0.35 ? 0.15 : 0)) return Y > -0.1 && Math.abs(phiOf(X, Z)) > 1.15 && Math.abs(phiOf(X, Z)) < 1.5;  // sideburns
        // keep the lips clear
        if (Y > my - 0.07 && Y < my + 0.13 && ax < 0.2 * f.lipW) return false;
        if (!full && kind !== 'short') return false;
        return true;
      },
      disp: function (X, Y, Z) { var s = strands(a, X * 3, Y, { freq: 6, amp: 0.035, seed: 81, waveAmp: 0.3 }); return s.d + (a.hash(Math.floor(X * 40), Math.floor(Y * 40)) - 0.5) * 0.02; } });
  }
  function mustache(a, kind) {
    var f = a.f, E = a.E, my = f.mouthY, ny = f.noseY;
    var w = kind === 'walrus' ? 0.32 : kind === 'thin' ? 0.22 : 0.27, h = kind === 'walrus' ? 0.14 : 0.08;
    a.parts.push({ name: 'mustache', F: a.F, mat: 'beard', prims: [E([-0.13, my - 0.08, 0.86], [w * 0.62, h, 0.11], { rot: [0.3, 0, 0.35] }), E([0.13, my - 0.08, 0.86], [w * 0.62, h, 0.11], { rot: [-0.3, 0, -0.35] })], k: 0.08, lineGap: 1,
      mask: function (X, Y, Z) { return Y > ny + 0.03 && Y < my + (kind === 'walrus' ? 0.06 : 0.0) + Math.abs(X) * (kind === 'walrus' ? 0.4 : 0.15); },
      disp: function (X, Y, Z) { return strands(a, X * 2, Y, { freq: 14, amp: 0.02, seed: 83 }).d; } });
  }

  /* ================= HATS ================= */
  var HAT = {};
  HAT.flatcap = function (a) {
    var E = a.E, f = a.f;
    a.parts.push({ name: 'cap', F: a.F, mat: 'hat', prims: [shell(a, 0.17, { tall: -0.12, lift: 0.08 }), E([0.0, -0.82, 0.55], [0.85, 0.3, 0.6], { rot: [0, -0.25, 0] })], k: 0.15,
      mask: function (X, Y, Z) { return Y < -0.56 - Math.max(0, -Z) * 0.25; },
      disp: function (X, Y, Z) { return -0.02 * Math.pow(Math.abs(Math.sin(phiOf(X, Z) * 4)), 10); } });
    a.parts.push({ name: 'peak', F: a.F, mat: 'hatD', prims: [E([0.0, -0.6, 0.92], [0.62, 0.05, 0.36], { rot: [0, 0.25, 0] })], k: 0.05, lineGap: 1.5,
      mask: function (X, Y, Z) { return Z > 0.62; } });
  };
  HAT.peaked = function (a) { // child's peaked cap (Luka)
    var E = a.E;
    a.parts.push({ name: 'cap', F: a.F, mat: 'hat', prims: [shell(a, 0.13, { tall: 0.0, lift: 0.04 })], k: 0.1,
      mask: function (X, Y, Z) { return Y < -0.6 - Math.max(0, -Z) * 0.2; },
      disp: function (X, Y, Z) { return -0.02 * Math.pow(Math.abs(Math.sin(phiOf(X, Z) * 3)), 12); } });
    a.parts.push({ name: 'peak', F: a.F, mat: 'hatD', prims: [E([0.0, -0.63, 0.98], [0.6, 0.05, 0.45], { rot: [0, 0.18, 0] })], k: 0.05, lineGap: 1.5, mask: function (X, Y, Z) { return Z > 0.7; } });
    a.parts.push({ name: 'button', F: a.F, mat: 'hatD', prims: [E([0, -1.55, -0.05], [0.08, 0.05, 0.08])], k: 0.02 });
  };
  HAT.brim = function (a) {
    var E = a.E;
    a.parts.push({ name: 'crown', F: a.F, mat: 'hat', prims: [E([0, -1.25, -0.08], [0.92, 0.55, 0.95])], k: 0.1, mask: function (X, Y, Z) { return Y > -1.62; },
      disp: function (X, Y, Z) { return Y < -1.4 && Math.abs(X) < 0.2 ? -0.05 : 0; } });
    a.parts.push({ name: 'band', F: a.F, mat: 'hatBand', prims: [E([0, -0.95, -0.08], [0.95, 0.1, 0.99])], k: 0.02 });
    a.parts.push({ name: 'brim', F: a.F, mat: 'hatD', prims: [E([0, -0.84, -0.06], [1.52, 0.06, 1.48], { rot: [0, 0.06, 0] })], k: 0.05, lineGap: 1.5 });
  };
  HAT.kamilavka = function (a) {
    var E = a.E;
    a.parts.push({ name: 'kam', F: a.F, mat: 'hat', prims: [E([0, -1.25, -0.1], [1.04, 3.0, 1.08], { clip: function (X, Y, Z) { return Y > -1.98 && Y < -0.62; } })], k: 0.02, cast: true });
    a.parts.push({ name: 'kamTop', F: a.F, mat: 'hatD', prims: [E([0, -1.98, -0.1], [1.12, 0.07, 1.16])], k: 0.02 });
  };
  HAT.wreath = function (a) {
    var E = a.E, prims = [], cols = ['fl1', 'fl2', 'fl3', 'fl4'];
    a.parts.push({ name: 'wreathG', F: a.F, mat: 'leaf', prims: (function () { var p = []; for (var k = 0; k < 16; k++) { var an = k / 16 * Math.PI * 2; p.push(E([Math.sin(an) * 1.08, -0.92 + Math.cos(an) * 0.1, Math.cos(an) * 1.1 - 0.1], [0.14, 0.1, 0.14])); } return p; })(), k: 0.06 });
    for (var k = 0; k < 9; k++) {
      var an = (k / 9 - 0.5) * Math.PI * 1.25;
      a.parts.push({ name: 'fl' + k, F: a.F, mat: cols[k % 4], prims: [E([Math.sin(an) * 1.12, -1.0 + (k % 2) * 0.06, Math.cos(an) * 1.14 - 0.1], [0.13, 0.12, 0.12])], k: 0.02, lineGap: 1 });
    }
  };
  HAT.garrison = function (a) { // folded side cap, tilted
    var E = a.E;
    a.parts.push({ name: 'gcap', F: a.F, mat: 'hat', prims: [E([0.15, -1.32, -0.05], [0.42, 0.32, 1.02], { rot: [0, 0, 0.3] })], k: 0.05,
      mask: function (X, Y, Z) { return Y < -1.0; } });
  };

  /* ================= OUTFITS ================= */
  function torso(a, inf, o) {
    o = o || {}; var f = a.f, w = f.sh * (o.w || 1) + f.stout * 0.15, E = a.E, i = inf || 0;
    var sy = o.slope || 0;
    return [
      E([0, 3.15, -0.25], [1.3 * w + i, 1.2 + i, 0.78 + i + f.stout * 0.08]),
      E([-1.24 * w, 2.62 + sy, -0.4], [0.55 + i, 0.44 + i, 0.55 + i]), E([1.24 * w, 2.62 + sy, -0.4], [0.55 + i, 0.44 + i, 0.55 + i]),
      E([-0.58 * w, 2.12 + sy * 0.5, -0.42], [0.62 * w + i, 0.33 + i, 0.46 + i]), E([0.58 * w, 2.12 + sy * 0.5, -0.42], [0.62 * w + i, 0.33 + i, 0.46 + i]),
      E([-1.48 * w, 3.75, -0.4], [0.5 + i, 1.1 + i, 0.56 + i]), E([1.48 * w, 3.75, -0.4], [0.5 + i, 1.1 + i, 0.56 + i])
    ];
  }
  /* cloth folds: grooves from the armpits toward the chest and a few soft creases */
  function folds(a, amt, seed) {
    return function (X, Y, Z) {
      var d = 0, ax = Math.abs(X);
      // armpit folds
      var t = (Y - 2.9) / 0.7; if (t > -0.2 && t < 1.2) { var lx = 1.05 - t * 0.45; d -= 0.04 * amt * a.g2((ax - lx) / 0.05, 0) * (1 - Math.abs(t - 0.5)); }
      // shoulder creases
      d -= 0.02 * amt * Math.pow(Math.abs(Math.sin(X * 3.1 + Y * 1.7 + seed)), 12);
      d += 0.025 * amt * (a.vnoise(X * 2.2 + seed, Y * 1.6, 5) - 0.5);
      return d;
    };
  }
  function body(a, name, matName, inf, o) {
    o = o || {};
    var pt = { name: name, F: a.Fb, mat: matName, prims: torso(a, inf, o), k: 0.22, disp: o.disp || folds(a, o.folds === undefined ? 1 : o.folds, inf * 10), mask: o.mask, lineGap: o.lineGap || 2.5, zoff: o.zoff };
    a.parts.push(pt); return pt;
  }
  /* neck-hole shapes, in body-local coordinates */
  function crewHole(r) { return function (X, Y, Z) { return Z > -0.2 && (X * X) / (r * r) + Math.pow((Y - 1.95) / (r * 0.9), 2) < 1; }; }
  function vHole(depth, wid) { return function (X, Y, Z) { return Z > -0.1 && Y > 1.6 && Y < depth && Math.abs(X) < wid * (depth - Y) / (depth - 1.6) + 0.02; }; }
  function collarRing(a, name, matName, r, y0, h, o) {
    o = o || {}; var E = a.E, prims = [];
    for (var k = 0; k < 10; k++) { var an = k / 10 * Math.PI * 2; prims.push(E([Math.sin(an) * r, y0 + (o.dip || 0) * Math.max(0, Math.cos(an)), Math.cos(an) * r * 0.95 - 0.22], [o.t || 0.16, h, o.t || 0.16])); }
    var pt = { name: name, F: a.F, mat: matName, prims: prims, k: 0.12, mask: o.mask, disp: o.disp, lineGap: 1.5 };
    a.parts.push(pt); return pt;
  }
  var OUT = {};
  OUT.hoodie = function (a, o) {
    var f = a.f, E = a.E;
    body(a, 'shirt', 'under', 0, { folds: 0.5 });
    body(a, 'hoodie', 'top', 0.05, { mask: function (X, Y, Z) { return !(Z > 0 && Math.abs(X - 0.05) < 0.28 - (Y - 2.0) * 0.05 && Y < 2.85 && Y > 1.5); }, folds: 1.3 });
    // hood bunched around the back of the neck
    a.parts.push({ name: 'hood', F: a.Fb, mat: 'top', prims: [E([-0.6, 1.85, -0.55], [0.45, 0.45, 0.55]), E([0.6, 1.85, -0.55], [0.45, 0.45, 0.55]), E([0, 1.7, -0.85], [0.7, 0.5, 0.4]), E([-0.42, 2.25, -0.1], [0.28, 0.25, 0.3]), E([0.42, 2.25, -0.1], [0.28, 0.25, 0.3])], k: 0.2, disp: folds(a, 2, 3), lineGap: 2 });
    a.overlays.push(function (pen, ctx, each) { // drawstrings
      var Fb = a.Fb;
      [-0.2, 0.28].forEach(function (x0, k) {
        for (var t = 0; t < 1; t += 0.04) { var p = Fb.w(x0 + t * 0.04, 2.3 + t * 0.75, 0.42 - t * 0.1); pen.zpx(p[0], p[1], p[2] + 4, k ? [150, 150, 160] : [190, 190, 196]); }
      });
    });
  };
  OUT.sweater = function (a, o) {
    body(a, 'sweater', 'top', 0, { folds: 1.1, disp: (function () { var fd = folds(a, 1.1, 2); return function (X, Y, Z) { return fd(X, Y, Z) - (Y > 3.6 ? 0 : 0.01 * Math.pow(Math.abs(Math.sin(X * 22)), 4)); }; })() });
    collarRing(a, 'collar', 'topD', 0.5 * a.f.sh / 0.85, 1.98, 0.1, { t: 0.12, dip: 0.08, disp: function (X, Y, Z) { return -0.015 * Math.pow(Math.abs(Math.sin(Math.atan2(X, Z) * 14)), 3); } });
    if (o.underCollar) collarRing(a, 'shirtCol', 'under', 0.45 * a.f.sh / 0.85, 1.9, 0.08, { t: 0.09 });
  };
  OUT.coat = function (a, o) {
    var E = a.E;
    if (o.turtle) { body(a, 'under', 'under', 0, { folds: 0.4 }); collarRing(a, 'turtle', 'under', a.f.neck + 0.08, 1.75, 0.38, { t: 0.18, disp: function (X, Y, Z) { return -0.02 * Math.pow(Math.abs(Math.sin(Y * 18)), 3); } }); }
    else { body(a, 'under', function (X, Y, Z) { return crewHole(0.32)(X, Y, Z) ? 'skin' : 'under'; }, 0, { folds: 0.4 }); collarRing(a, 'shirtCol', 'under', a.f.neck + 0.05, 1.98, 0.12, { t: 0.11 }); }
    var open = o.open || 0.42;
    body(a, 'coat', 'top', 0.08, { mask: function (X, Y, Z) { return !(Z > -0.1 && Y < 4.5 && Math.abs(X - 0.04) < open * (Y - 1.7) / 1.5 + 0.12 && Y > 1.7); }, folds: 1.4 });
    // lapels / collar turned over the shoulders
    a.parts.push({ name: 'lapel', F: a.Fb, mat: 'topL', prims: torso(a, 0.13), k: 0.22, lineGap: 1,
      mask: function (X, Y, Z) { if (Z < -0.2) return Y < 2.25; var w = open * (Y - 1.7) / 1.5 + 0.12; var ax = Math.abs(X - 0.04); return Y < 3.4 && ax > w && ax < w + 0.28 - (Y - 2.0) * 0.12 && Y > 1.75; } });
    a.parts.push({ name: 'collarBack', F: a.Fb, mat: 'topL', prims: [E([0, 1.88, -0.6], [0.75, 0.3, 0.45]), E([-0.55, 2.0, -0.2], [0.32, 0.3, 0.35]), E([0.55, 2.0, -0.2], [0.32, 0.3, 0.35])], k: 0.2, lineGap: 1.5 });
  };
  OUT.shirtvest = function (a, o) {
    var E = a.E;
    body(a, 'shirt', function (X, Y, Z) { return vHole(2.35, 0.2)(X, Y, Z) ? 'skin' : 'under'; }, 0, { folds: 0.8 });
    collarRing(a, 'shirtCol', 'under', a.f.neck + 0.06, 1.95, 0.13, { t: 0.11, mask: function (X, Y, Z) { return !(Z > 0.2 && Math.abs(X) < 0.16); } });
    body(a, 'vest', 'top', 0.07, { mask: function (X, Y, Z) { if (Math.abs(X) > 1.05 * a.f.sh + 0.1 && Y < 2.9) return false; if (Y < 2.2 && Z < 0.3 && Math.abs(X) > 0.9 * a.f.sh) return false; return !(Z > -0.1 && Math.abs(X - 0.02) < 0.26 + (3.9 - Y) * 0.05 && Y < 3.9); }, folds: 0.7 });
    a.overlays.push(function (pen, ctx) { // vest buttons
      for (var k = 0; k < 3; k++) { var p = a.Fb.w(0.36, 3.45 + k * 0.34, 0.66); pen.zpx(p[0], p[1], p[2] + 5, a.mats.button.ramp[3]); }
    });
  };
  OUT.smith = function (a, o) {
    body(a, 'shirt', function (X, Y, Z) { return vHole(2.4, 0.22)(X, Y, Z) ? 'skin' : 'top'; }, 0, { folds: 1.2 });
    collarRing(a, 'shirtCol', 'top', a.f.neck + 0.06, 1.95, 0.12, { t: 0.12, mask: function (X, Y, Z) { return !(Z > 0.2 && Math.abs(X) < 0.18); } });
    // leather apron bib with neck strap
    a.parts.push({ name: 'apron', F: a.Fb, mat: 'leather', prims: torso(a, 0.1), k: 0.22, lineGap: 1.5,
      mask: function (X, Y, Z) { return Z > 0 && Math.abs(X) < 0.66 && Y > 2.85; }, disp: function (X, Y, Z) { return 0.015 * (a.vnoise(X * 6, Y * 6, 9) - 0.5); } });
    a.parts.push({ name: 'strapA', F: a.Fb, mat: 'leather', prims: torso(a, 0.1), k: 0.22, lineGap: 1,
      mask: function (X, Y, Z) { return Z > -0.3 && Y < 2.95 && Y > 1.85 && Math.abs(Math.abs(X) - (0.62 - (2.95 - Y) * 0.08)) < 0.07; } });
  };
  OUT.blouse = function (a, o) { // embroidered linen blouse (and optional apron / vest)
    body(a, 'blouse', function (X, Y, Z) { if (crewHole(0.36)(X, Y, Z)) return 'skin'; var nb = Math.hypot(X / 0.36, (Y - 1.95) / 0.32); if (nb < 1.45 && Z > -0.2) return ((Math.floor(X * 18) + Math.floor(Y * 18)) & 1) && nb > 1.12 ? 'emb' : 'top'; return 'top'; }, 0, { folds: 1.4 });
    if (o.vest) body(a, 'vest', 'vest', 0.07, { mask: function (X, Y, Z) { return !(Z > -0.1 && Math.abs(X) < 0.5 + (Y - 2) * 0.05 && Y > 1.6) && !(Math.abs(X) > 1.0 * a.f.sh); }, folds: 0.5 });
    if (o.apron) apron(a);
  };
  function apron(a) {
    a.parts.push({ name: 'apron', F: a.Fb, mat: 'apron', prims: torso(a, 0.08), k: 0.22, lineGap: 1.2,
      mask: function (X, Y, Z) { return Z > 0 && Math.abs(X) < 0.62 && Y > 2.75; }, disp: folds(a, 0.8, 4) });
    a.parts.push({ name: 'apronStrap', F: a.Fb, mat: 'apron', prims: torso(a, 0.08), k: 0.22, lineGap: 1,
      mask: function (X, Y, Z) { return Z > -0.2 && Y < 2.85 && Y > 1.9 && Math.abs(Math.abs(X) - (0.58 - (2.85 - Y) * 0.1)) < 0.06; } });
  }
  OUT.dress = function (a, o) { // simple dress / cardigan + collar
    body(a, 'dress', function (X, Y, Z) { return crewHole(o.neck || 0.34)(X, Y, Z) ? 'skin' : 'under'; }, 0, { folds: 0.8 });
    if (o.lace) collarRing(a, 'lace', 'lace', a.f.neck + 0.1, 2.0, 0.1, { t: 0.14, dip: 0.12, disp: function (X, Y, Z) { return -0.03 * Math.pow(Math.abs(Math.sin(Math.atan2(X, Z) * 16)), 4); } });
    if (o.cardigan) body(a, 'cardigan', 'top', 0.08, { mask: function (X, Y, Z) { return !(Z > -0.1 && Math.abs(X - 0.03) < 0.26 + (Y - 2.0) * 0.12 && Y > 1.75); }, folds: 1.5,
      disp: (function () { var fd = folds(a, 1.5, 1); return function (X, Y, Z) { return fd(X, Y, Z) - 0.012 * Math.pow(Math.abs(Math.sin(X * 16 + Math.sin(Y * 30) * 0.3)), 4); }; })() });
    if (o.shawl) a.parts.push({ name: 'shawl', F: a.Fb, mat: 'shawl', prims: torso(a, 0.12), k: 0.22, lineGap: 1.5,
      mask: function (X, Y, Z) { return Y < 2.75 + Math.abs(X) * 0.3 - (Z > 0 ? Math.max(0, 0.6 - Math.abs(X)) * 0.6 : 0) && !(Z > 0 && Math.abs(X) < 0.32 && Y < 2.3); },
      disp: function (X, Y, Z) { return -0.03 * Math.pow(Math.abs(Math.sin(X * 6 - Y * 3)), 6) + 0.01 * Math.sin((X + Y) * 40); } });
    if (o.apron) apron(a);
  };
  OUT.cassock = function (a, o) {
    body(a, 'cassock', 'top', 0, { folds: 1.6 });
    collarRing(a, 'collar', 'top', a.f.neck + 0.08, 1.92, 0.16, { t: 0.13, mask: function (X, Y, Z) { return !(Z > 0.3 && Math.abs(X) < 0.06); } });
  };
  OUT.zipjacket = function (a, o) {
    var E = a.E;
    body(a, 'jacket', function (X, Y, Z) { var ax = X - 0.03; if (Z > 0 && Math.abs(ax) < 0.05) return 'zip'; if (Z > 0 && Math.abs(ax) < 0.12 && Math.abs(ax) > 0.06) return 'stripe'; return 'top'; }, 0, { folds: 1.3 });
    collarRing(a, 'stand', function (X, Y, Z) { return Z > 0.2 && Math.abs(X - 0.03) < 0.05 ? 'zip' : 'top'; }, a.f.neck + 0.12, 1.85, 0.26, { t: 0.15, mask: function (X, Y, Z) { return !(Z > 0.25 && Math.abs(X) < 0.05 && Y < 1.75); } });
  };
  OUT.uniform = function (a, o) { // vintage military-style jacket, shirt and tie (kept for later use)
    body(a, 'shirt', 'under', 0, { folds: 0.4 });
    collarRing(a, 'shirtCol', 'under', a.f.neck + 0.06, 1.95, 0.12, { t: 0.11 });
    body(a, 'jacket', 'top', 0.08, { mask: function (X, Y, Z) { return !(Z > -0.1 && Math.abs(X) < 0.36 * (Y - 1.7) / 1.0 + 0.1 && Y > 1.7 && Y < 2.9); }, folds: 1.2 });
  };

  /* ================= ACCESSORIES ================= */
  var ACC = {};
  ACC.glasses = function (a, o) { // big soft-square frames, slightly tinted
    var F = a.F, f = a.f;
    a.overlays.push(function (pen, ctx, each) {
      var fr = a.mats.glass.ramp, frD = C.mul(fr[1], 0.8);
      [-1, 1].forEach(function (sd) {
        var cx = sd * 0.37, cy = 0.03, w = 0.25, h = 0.2, z = 1.0 - Math.abs(sd) * 0.0 + (sd > 0 ? -0.08 : -0.08);
        // lens tint and frame, sampled densely in local coords
        var pts = [];
        for (var k = 0; k < 220; k++) {
          var t = k / 220 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
          var sx = Math.sign(c) * Math.pow(Math.abs(c), 0.45), sy = Math.sign(s) * Math.pow(Math.abs(s), 0.45);
          var X = cx + sx * w, Y = cy + sy * h - (sy < 0 ? 0 : 0.01), Zl = 0.98 - Math.pow(X / 1.3, 2) * 1.2;
          var p = F.w(X, Y, Zl);
          pen.zpx(p[0], p[1], p[2] + 6, s < 0 ? fr[3] : frD);
        }
        // tint inside
        var p0 = F.w(cx - w, cy - h, 0.95), p1 = F.w(cx + w, cy + h, 0.95);
        for (var y = Math.floor(Math.min(p0[1], p1[1])); y <= Math.max(p0[1], p1[1]); y++) for (var x = Math.floor(Math.min(p0[0], p1[0])); x <= Math.max(p0[0], p1[0]); x++) {
          var i = y * 120 + x; if (i < 0 || i >= 14400) continue;
          var hp = ctx.parts.indexOf(a.hp.head); if (ctx.top[i] !== hp && ctx.top[i] !== ctx.parts.indexOf(a.hp.ear)) continue;
          var L = a.hp.head.loc, X2 = L[i * 3], Y2 = L[i * 3 + 1];
          var q = Math.pow(Math.abs((X2 - cx) / (w * 0.93)), 4) + Math.pow(Math.abs((Y2 - cy) / (h * 0.9)), 4);
          if (q < 1) { pen.tint(x, y, [176, 200, 210], 0.16); if (Math.abs((X2 - cx) + (Y2 - cy) * 0.8 + 0.1) < 0.025 && q < 0.7) pen.tint(x, y, [240, 250, 255], 0.45); }
        }
      });
      // bridge and the near temple arm to the ear
      for (var t = 0; t <= 1; t += 0.05) { var p = F.w(-0.12 + t * 0.24, -0.02 - Math.sin(t * Math.PI) * 0.03, 1.0); pen.zpx(p[0], p[1], p[2] + 6, fr[3]); }
      for (t = 0; t <= 1; t += 0.03) { p = F.w(-0.62 - t * 0.32, -0.04 + t * 0.06, 0.68 - t * 0.78); pen.zpx(p[0], p[1], p[2] + 4, fr[2]); }
    });
  };
  function earPoint(a, sd) { return a.F.w(sd * 0.96, 0.44, -0.08); }
  ACC.earrings = function (a, o) {
    a.overlays.push(function (pen, ctx) {
      [-1, 1].forEach(function (sd) {
        var p = earPoint(a, sd), M = a.mats.jewel.ramp, z = p[2] + 2;
        if (o.kind === 'star') {
          for (var k = 0; k < 6; k++) pen.zpx(p[0], p[1] + k, z, [150, 146, 156]);
          var cx = p[0], cy = p[1] + 9;
          var star = ['..#..', '.###.', '#####', '.###.', '##.##'];
          star.forEach(function (row, ry) { for (var rx = 0; rx < 5; rx++) if (row[rx] === '#') pen.zpx(cx - 2 + rx, cy - 2 + ry, z, ry < 2 || rx < 2 ? M[3] : M[1]); });
          pen.zpx(cx - 1, cy - 1, z, M[4]);
        } else if (o.kind === 'pearl') {
          pen.zpx(p[0], p[1] + 1, z, [236, 232, 222]); pen.zpx(p[0] + 1, p[1] + 1, z, [200, 196, 190]); pen.zpx(p[0], p[1] + 2, z, [184, 180, 176]); pen.zpx(p[0] + 1, p[1] + 2, z, [170, 166, 162]);
        } else { // round bead hoops
          pen.zpx(p[0], p[1] + 1, z, [160, 150, 120]);
          for (var yy = -2; yy <= 2; yy++) for (var xx = -2; xx <= 2; xx++) if (xx * xx + yy * yy <= 5) pen.zpx(p[0] + xx, p[1] + 4 + yy, z, xx + yy < -1 ? M[4] : xx + yy > 1 ? M[1] : M[2]);
        }
      });
    });
  };
  ACC.beads = function (a, o) {
    a.overlays.push(function (pen, ctx) {
      var M = a.mats.jewel.ramp, Fb = a.Fb;
      for (var k = 0; k <= 14; k++) {
        var t = k / 14 - 0.5, an = t * 2.5;
        var p = Fb.w(Math.sin(an) * 0.58, 2.05 + Math.cos(t * Math.PI) * 0.28, Math.cos(an) * 0.55 + 0.05);
        for (var yy = -1; yy <= 1; yy++) for (var xx = -1; xx <= 1; xx++) if (xx * xx + yy * yy <= 1) pen.zpx(p[0] + xx, p[1] + yy, p[2] + 3, xx < 0 || yy < 0 ? M[3] : M[1]);
        pen.zpx(p[0] - 1, p[1] - 1, p[2] + 3, M[4]);
      }
    });
  };
  ACC.strap = function (a, o) { // backpack strap over the near shoulder
    a.parts.push({ name: 'strap', F: a.Fb, mat: 'strap', prims: torso(a, 0.12), k: 0.22, lineGap: 1.2,
      mask: function (X, Y, Z) { var cx = -0.95 + (Y - 2.1) * 0.12; return Y > 1.95 && Math.abs(X - cx) < 0.17 && Z > -0.4; } });
  };
  ACC.camera = function (a, o) {
    var E = a.E;
    a.parts.push({ name: 'camStrap', F: a.Fb, mat: 'strap', prims: torso(a, 0.1), k: 0.22, lineGap: 1,
      mask: function (X, Y, Z) { return Z > -0.2 && Y > 1.95 && Y < 3.6 && Math.abs(Math.abs(X) - (0.48 + (Y - 2) * 0.06)) < 0.05; } });
    a.parts.push({ name: 'camera', F: a.Fb, mat: 'camera', prims: [E([0.05, 3.75, 0.72], [0.44, 0.27, 0.2]), E([0.05, 3.48, 0.7], [0.14, 0.08, 0.15])], k: 0.03, lineGap: 1 });
    a.parts.push({ name: 'lens', F: a.Fb, mat: 'lens', prims: [E([0.12, 3.78, 0.92], [0.17, 0.17, 0.12])], k: 0.02, lineGap: 1 });
  };
  ACC.cross = function (a, o) {
    a.overlays.push(function (pen) {
      var Fb = a.Fb, M = a.mats.gold.ramp, p = Fb.w(0.02, 3.35, 0.82), z = p[2] + 6;
      for (var t = 0; t < 1; t += 0.05) { var q = Fb.w(-0.45 + t * 0.47, 2.15 + t * 1.05, 0.5 + t * 0.3); pen.zpx(q[0], q[1], q[2] + 5, M[2]); q = Fb.w(0.5 - t * 0.48, 2.15 + t * 1.05, 0.45 + t * 0.35); pen.zpx(q[0], q[1], q[2] + 5, M[1]); }
      var x0 = Math.round(p[0]), y0 = Math.round(p[1]);
      for (var yy = 0; yy < 9; yy++) { pen.px(x0, y0 + yy, M[3]); pen.px(x0 + 1, y0 + yy, M[1]); }
      for (var xx = -3; xx <= 4; xx++) { pen.px(x0 + xx, y0 + 2, M[3]); pen.px(x0 + xx, y0 + 3, M[1]); }
      pen.px(x0, y0, M[4]); pen.px(x0 - 3, y0 + 2, M[4]);
    });
  };
  ACC.brooch = function (a, o) {
    a.overlays.push(function (pen) {
      var p = a.Fb.w(o.x || -0.22, o.y || 2.35, 0.75), M = a.mats.gold.ramp, x0 = Math.round(p[0]), y0 = Math.round(p[1]);
      for (var yy = -2; yy <= 2; yy++) for (var xx = -2; xx <= 2; xx++) { var r = xx * xx + yy * yy; if (r <= 5) pen.px(x0 + xx, y0 + yy, r >= 4 ? (xx + yy < 0 ? M[3] : M[1]) : (o.stone || [120, 30, 50])); }
      pen.px(x0 - 1, y0 - 1, [240, 200, 210]);
    });
  };
  ACC.tie = function (a) {
    a.parts.push({ name: 'tie', F: a.Fb, mat: 'tie', prims: torso(a, 0.04), k: 0.22, lineGap: 1, mask: function (X, Y, Z) { return Z > 0 && Y > 1.95 && Y < 3.3 && Math.abs(X) < 0.06 + (Y - 1.95) * 0.05; } });
  };

  /* ================= assembly ================= */
  function dress(a) {
    var sp = a.spec, d = a.d, M = a.mats, mat = a.mat;
    var top = sp.top || d.topColor || [90, 90, 90];
    M.top = cloth(a, top); M.topL = cloth(a, C.mul(top, sp.lapelK || 1.08)); M.topD = cloth(a, C.mul(top, 0.82));
    M.under = cloth(a, sp.under || C.mix(top, [220, 214, 200], 0.6));
    M.vest = cloth(a, sp.vest || d.vest || [60, 50, 40]);
    M.hair = hairMat(a, sp.hairCol || [60, 40, 30], { sheen: sp.sheen });
    M.beard = hairMat(a, sp.beardCol || d.beard || d.mustache || sp.hairCol || [60, 40, 30]);
    M.hat = cloth(a, sp.hatColor || d.hatColor || [50, 46, 42]); M.hatD = cloth(a, C.mul(sp.hatColor || d.hatColor || [50, 46, 42], 0.8)); M.hatBand = cloth(a, C.mul(sp.hatColor || d.hatColor || [50, 46, 42], 0.55));
    M.scarf = cloth(a, sp.scarf || d.scarf || [200, 190, 170]); M.scarfP = cloth(a, sp.scarfPattern || d.scarfPattern || [160, 50, 50]);
    M.wrap = cloth(a, sp.scarf || d.scarf || [30, 44, 76], { light: [110, 130, 180] });
    M.apron = cloth(a, sp.apron || d.apron || [216, 208, 188]);
    M.leather = a.mat(sp.apron || d.apron || [90, 58, 36], { n: 5, lo: 0.45, hi: 1.3, spec: 0.8, shine: 8, dither: 0.3 });
    M.emb = cloth(a, sp.embroidery || d.embroidery || [170, 40, 40]);
    M.shawl = cloth(a, sp.shawl || d.shawl || [130, 100, 70]);
    M.lace = cloth(a, sp.lace || [226, 220, 204]);
    M.strap = cloth(a, sp.strap || d.strap || [26, 26, 30]);
    M.band = cloth(a, [60, 40, 40]);
    M.ribbon = cloth(a, sp.ribbon || d.ribbon || [170, 40, 40]);
    M.zip = metal(a, [176, 164, 168]); M.stripe = cloth(a, sp.stripe || [170, 150, 156]);
    M.glass = metal(a, sp.glassesCol || [128, 146, 158]);
    M.jewel = metal(a, sp.jewel || [40, 140, 136]);
    M.gold = metal(a, [200, 168, 90]);
    M.button = metal(a, [70, 60, 50]);
    M.camera = a.mat([40, 40, 44], { n: 5, lo: 0.6, hi: 2.4, spec: 0.8, shine: 12, light: [150, 150, 160], dither: 0 });
    M.lens = a.mat([60, 80, 100], { n: 5, lo: 0.5, hi: 2.0, spec: 1, shine: 6, dither: 0 });
    M.tie = cloth(a, sp.tieCol || [80, 70, 50]);
    M.leaf = cloth(a, [70, 120, 60]); M.fl1 = cloth(a, [210, 64, 64]); M.fl2 = cloth(a, [236, 214, 110]); M.fl3 = cloth(a, [236, 234, 224]); M.fl4 = cloth(a, [186, 104, 168]);

    (OUT[sp.outfit] || OUT.sweater)(a, sp.outfitOpt || {});
    if (sp.hair && HAIR[sp.hair]) HAIR[sp.hair](a, sp.hairOpt || {});
    if (sp.beard) beard(a, sp.beard);
    if (sp.mustache) mustache(a, sp.mustache);
    if (sp.hat && HAT[sp.hat]) HAT[sp.hat](a);
    (sp.acc || []).forEach(function (ac) { var nm = typeof ac === 'string' ? ac : ac.type; if (ACC[nm]) ACC[nm](a, typeof ac === 'string' ? {} : ac); });
    // grey temples
    if (sp.grey) {
      var gm = hairMat(a, C.mix(sp.hairCol || [60, 40, 30], [200, 198, 196], 0.7));
      M.hairGrey = gm;
      a.parts.forEach(function (pt) {
        if (pt.mat !== 'hair') return;
        pt.mat = function (X, Y, Z) { var ph = Math.abs(Math.atan2(X, Z)); var g = (ph > 0.7 ? 1 : 0.4) * sp.grey + (a.vnoise(Math.atan2(X, Z) * 12, Y * 4, 3) - 0.5) * 0.6; return g > 0.5 ? 'hairGrey' : 'hair'; };
      });
    }
  }
  function bgFor(sp) { return sp.bg; }

  return { dress: dress, bgFor: bgFor, HAIR: HAIR, HAT: HAT, OUT: OUT, ACC: ACC };
})();
