/* Hand-tuned 64x64 portraits for the leads, painted after the character art supplied for the project:
   Đorđe (shaggy black hair, pale tired face, grey eyes, charcoal hoodie, backpack strap),
   Jaglika early (copper bob, big grey-blue glasses, teal beads, purple turtleneck, green coat)
   and Jaglika late (navy head-wrap, gaunt grey face, star earrings, plum zip jacket).
   Flat cel planes + dark line work, matching the drawings. Expressions change brows, lids and mouth. */
'use strict';
BTS.PortraitsCustom = (function () {
  var C = BTS.Col;
  var INK = [16, 13, 16];

  function shape(p, x0, y0, x1, y1, fn) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { var c = fn(x, y); if (c) p.px(x, y, c); } }
  function inEll(x, y, cx, cy, rx, ry) { var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; return dx * dx + dy * dy <= 1; }
  function h(x, y) { var n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return n - Math.floor(n); }

  /* face oval with a narrowing jaw; returns membership test */
  function faceTest(cx, cy, rx, ry, jaw) {
    return function (x, y) {
      var ny = (y + 0.5 - cy) / ry, k = ny > 0.15 ? 1 + (ny - 0.15) * jaw : 1;
      var nx = (x + 0.5 - cx) / rx * k;
      return nx * nx + ny * ny <= 1;
    };
  }
  /* three-tone skin: light from the viewer's left, shadow on the right and under the cheekbones */
  function paintFace(p, F, cx, cy, rx, ry, sk) {
    shape(p, cx - rx - 2, cy - ry - 1, cx + rx + 2, cy + ry + 1, function (x, y) {
      if (!F(x, y)) return null;
      var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry;
      var c = sk.base;
      if (nx > 0.42 || (nx > 0.2 && ny > 0.45)) c = sk.shade;
      if (nx < -0.35 && ny < 0.2 && ny > -0.6) c = sk.light;
      if (ny > 0.78) c = sk.shade;
      return c;
    });
  }
  function eye(p, x, y, w, open, iris, sk, opt) {
    opt = opt || {};
    // socket shadow
    p.rect(x - 1, y - 2, w + 2, 1, opt.socket || sk.shade);
    if (open <= 0) { p.rect(x, y, w, 1, INK); return; }
    p.rect(x, y, w, open, opt.white || [226, 220, 212]);
    var ix = x + Math.floor((w - 3) / 2) + (opt.look || 0);
    p.rect(ix, y, 3, open, iris);
    p.px(ix + 1, y + (open > 1 ? 1 : 0), INK);
    if (open > 1) p.px(ix, y, [245, 245, 245]);
    p.rect(x - 1, y - 1, w + 2, 1, INK);                       // upper lid / lashes
    p.px(x - 1, y, INK); p.px(x + w, y, INK);
    if (opt.lid) p.rect(x, y, w, 1, opt.lid);                // heavy lid covers the top of the iris
    if (opt.bags) { p.rect(x, y + open, w, 1, opt.bags); p.px(x + w, y + open - 1, opt.bags); }
  }

  /* ======================= ĐORĐE ======================= */
  function djordje(p, expr) {
    var sk = { base: [214, 190, 172], shade: [178, 150, 140], light: [232, 214, 198], deep: [150, 122, 116] };
    var hair = [24, 22, 27], hairL = [58, 56, 64], hairD = [12, 10, 14];
    var hood = [44, 46, 52], hoodD = [30, 31, 36], hoodL = [64, 66, 74], shirt = [26, 26, 30];
    var cx = 31, cy = 29, rx = 12, ry = 15;
    // hair mass behind the head (falls to the jaw, flicks outward)
    shape(p, 10, 6, 54, 50, function (x, y) {
      var inside = inEll(x, y, 31.5, 25, 18.5, 18) || (y > 24 && y < 47 && x > 13 && x < 51 && inEll(x, y, 31.5, 33, 18 + (y > 40 ? 2 : 0), 16));
      if (!inside) return null;
      return ((x * 5 + (y >> 2)) % 11 === 0) ? hairL : hair;
    });
    // hoodie: shoulders, hood bunched around the neck
    shape(p, 0, 44, 63, 63, function (x, y) {
      var w = 22 + (y - 44) * 1.6; if (Math.abs(x + 0.5 - 32) > w) return null;
      var c = x < 22 ? hoodL : (x > 44 ? hoodD : hood);
      return c;
    });
    shape(p, 16, 42, 48, 54, function (x, y) { return inEll(x, y, 32, 47, 15, 7) && !inEll(x, y, 32, 46, 9, 5) ? (x > 36 ? hoodD : hood) : null; }); // hood ring
    p.ellipse(32, 50, 7, 4, shirt);                                                 // t-shirt in the opening
    for (var y = 46; y < 64; y++) { p.px(44 + Math.floor((y - 46) * 0.35), y, [18, 18, 22]); p.px(45 + Math.floor((y - 46) * 0.35), y, [18, 18, 22]); } // backpack strap
    // neck
    shape(p, 26, 38, 37, 50, function (x, y) { return inEll(x, y, 31.5, 44, 5.5, 8) ? (x > 33 || y > 46 ? sk.shade : sk.base) : null; });
    // face
    var F = faceTest(cx, cy, rx, ry, 0.9);
    paintFace(p, F, cx, cy, rx, ry, sk);
    // ears (mostly hidden by hair)
    p.ellipse(cx - rx, cy + 3, 1.5, 3, sk.shade);
    // features
    var openH = { scared: 3, blank: 2, tired: 1, angry: 1, smile: 1, sad: 2 }[expr] || 2;
    var browLift = { sad: 1, scared: 2, worried: 1, angry: -1 }[expr] || 0;
    var ey = cy + 1;
    eye(p, cx - 8, ey, 5, openH, [112, 118, 124], sk, { lid: openH > 1 && expr !== 'scared' ? C.mul(sk.shade, 0.9) : null, bags: [168, 136, 132], look: expr === 'worried' ? -1 : 0 });
    eye(p, cx + 3, ey, 5, openH, [112, 118, 124], sk, { lid: openH > 1 && expr !== 'scared' ? C.mul(sk.shade, 0.9) : null, bags: [160, 130, 128], look: expr === 'worried' ? -1 : 0 });
    if (expr === 'blank') { p.rect(cx - 7, ey, 3, openH, [150, 150, 152]); p.rect(cx + 4, ey, 3, openH, [150, 150, 152]); }
    // brows (partly under the fringe)
    for (var i = 0; i < 6; i++) {
      var inner = i / 5;
      p.px(cx - 9 + i, ey - 4 - Math.round(inner * browLift) + (expr === 'angry' ? Math.round(inner) : 0), hairD);
      p.px(cx + 8 - i, ey - 4 - Math.round(inner * browLift) + (expr === 'angry' ? Math.round(inner) : 0), hairD);
    }
    // nose: shadow plane on the right, nostrils
    p.rect(cx + 1, cy + 2, 1, 6, sk.shade); p.px(cx + 2, cy + 7, sk.deep);
    p.px(cx - 2, cy + 8, sk.deep); p.px(cx + 2, cy + 8, INK); p.rect(cx - 1, cy + 8, 2, 1, sk.shade);
    // mouth: full, slightly down-turned lips
    var my = cy + 11, lip = [176, 126, 118], lipD = [140, 92, 88];
    if (expr === 'scared') { p.rect(cx - 2, my - 1, 5, 3, [70, 30, 34]); p.rect(cx - 3, my - 2, 7, 1, lip); }
    else if (expr === 'smile') { p.rect(cx - 3, my, 7, 1, INK); p.px(cx + 4, my - 1, INK); p.rect(cx - 2, my + 1, 5, 1, lip); }
    else {
      p.rect(cx - 3, my - 1, 7, 1, lip); p.rect(cx - 3, my, 7, 1, INK); p.rect(cx - 2, my + 1, 5, 1, lip); p.rect(cx - 1, my + 2, 3, 1, lipD);
      if (expr === 'sad' || expr === 'worried' || expr === 'tired') { p.px(cx - 4, my + 1, INK); p.px(cx + 4, my + 1, INK); }
    }
    p.rect(cx - 2, my + 4, 4, 1, sk.shade);                    // under-lip shadow / chin
    // fringe: heavy black bangs to eye level, one lock across the right eye
    shape(p, 13, 9, 51, 33, function (x, y) {
      var top = inEll(x, y, 31.5, 22, 17, 13);
      if (!top) return null;
      if (y < 15) return ((x * 5 + (y >> 2)) % 11 === 0) ? hairL : hair;
      // jagged fringe edge: strands end at different heights
      var strand = Math.floor((x - 12) / 3), edge = 22 + Math.floor(h(strand, 7) * 6) + (x > 33 && x < 40 ? 5 : 0);
      if (x < 17 || x > 46) edge = 40;                           // side locks over the ears
      if (y > edge) return null;
      if (y === edge && h(x, y) > 0.5) return null;
      return ((x * 5 + (y >> 2)) % 11 === 0) ? hairL : (x > 40 ? hairD : hair);
    });
    // stray hairs on top
    [[22, 6], [25, 5], [38, 6], [41, 7], [30, 5]].forEach(function (s) { p.px(s[0], s[1], hair); p.px(s[0] + 1, s[1] + 1, hair); });
    // tired: deeper eye bags
    if (expr === 'tired' || expr === 'sad') { p.rect(cx - 8, ey + openH + 1, 4, 1, sk.shade); p.rect(cx + 4, ey + openH + 1, 4, 1, sk.shade); }
  }

  /* ======================= JAGLIKA (early: warm, chatty) ======================= */
  function jaglika(p, expr) {
    var sk = { base: [228, 186, 164], shade: [196, 146, 126], light: [242, 210, 190], deep: [160, 110, 96] };
    var hair = [184, 82, 38], hairL = [222, 124, 66], hairD = [132, 52, 26];
    var coat = [26, 74, 38], coatD = [14, 48, 24], coatL = [44, 100, 56], turtle = [86, 38, 116], turtleD = [62, 24, 86];
    var teal = [36, 132, 128], tealL = [90, 186, 176], tealD = [20, 84, 84];
    var cx = 31, cy = 29, rx = 12, ry = 15;
    // bob: rounded mass to the jaw
    shape(p, 8, 5, 56, 50, function (x, y) {
      if (!(inEll(x, y, 31.5, 26, 20, 19) || (y > 26 && y < 48 && inEll(x, y, 31.5, 32, 20, 16)))) return null;
      var c = hair; if ((x * 4 + (y >> 2)) % 9 === 0) c = hairL; if (x > 44 || y > 42) c = hairD;
      return c;
    });
    // coat with wide lapels, purple turtleneck
    shape(p, 0, 44, 63, 63, function (x, y) {
      var w = 24 + (y - 44) * 1.7; if (Math.abs(x + 0.5 - 32) > w) return null;
      return x < 20 ? coatL : (x > 46 ? coatD : coat);
    });
    shape(p, 22, 42, 42, 63, function (x, y) { var w = 7 - (y - 42) * 0.12; return Math.abs(x + 0.5 - 32) < w ? (x > 34 ? turtleD : turtle) : null; });
    for (var yy = 46; yy < 64; yy++) { p.px(24 - (yy - 46) * 0.4, yy, coatD); p.px(40 + (yy - 46) * 0.4, yy, coatD); }   // lapel edges
    // neck
    shape(p, 26, 38, 37, 46, function (x, y) { return inEll(x, y, 31.5, 42, 5, 5) ? sk.shade : null; });
    var F = faceTest(cx, cy, rx, ry, 0.8);
    paintFace(p, F, cx, cy, rx, ry, sk);
    // forehead and smile lines
    p.rect(cx - 6, cy - 10, 11, 1, sk.shade); p.rect(cx - 4, cy - 8, 8, 1, sk.shade);
    p.line(cx - 7, cy + 6, cx - 8, cy + 11, sk.deep); p.line(cx + 7, cy + 6, cx + 8, cy + 11, sk.deep);
    // eyes behind big glasses
    var openH = { scared: 3, blank: 2, angry: 1, tired: 1 }[expr] || 2;
    var ey = cy + 1;
    eye(p, cx - 8, ey, 5, openH, [70, 48, 40], sk, { white: [232, 224, 214] });
    eye(p, cx + 3, ey, 5, openH, [70, 48, 40], sk, { white: [232, 224, 214] });
    if (expr === 'smile' || expr === 'neutral') { p.rect(cx - 8, ey + openH, 5, 1, sk.shade); p.rect(cx + 3, ey + openH, 5, 1, sk.shade); }
    var browLift = { sad: 1, scared: 2, worried: 1, angry: -2 }[expr] || 0;
    for (var i = 0; i < 6; i++) { var inner = i / 5; p.px(cx - 9 + i, ey - 4 - Math.round(inner * browLift), hairD); p.px(cx + 8 - i, ey - 4 - Math.round(inner * browLift), hairD); }
    // glasses: large soft-square frames, grey-blue, tinted lenses
    var gl = [120, 140, 150], glD = [86, 104, 116];
    [[cx - 11, cx - 1], [cx + 1, cx + 11]].forEach(function (g) {
      for (var y2 = ey - 4; y2 <= ey + 4; y2++) for (var x2 = g[0]; x2 <= g[1]; x2++) {
        var edge = x2 === g[0] || x2 === g[1] || y2 === ey - 4 || y2 === ey + 4;
        var corner = (x2 === g[0] || x2 === g[1]) && (y2 === ey - 4 || y2 === ey + 4);
        if (corner) continue;
        if (edge) p.px(x2, y2, y2 === ey + 4 ? glD : gl);
        else { var c = p.get(x2, y2); if (c) p.px(x2, y2, C.mix([c[0], c[1], c[2]], [168, 188, 198], 0.28)); }
      }
    });
    p.rect(cx - 1, ey - 2, 3, 1, gl);                                           // bridge
    p.px(cx - 9, ey - 3, [230, 240, 245]); p.px(cx + 3, ey - 3, [230, 240, 245]); // lens glints
    // nose
    p.rect(cx + 1, cy + 3, 1, 5, sk.shade); p.px(cx - 2, cy + 8, sk.deep); p.px(cx + 2, cy + 8, sk.deep);
    // mouth: open, chatty smile by default
    var my = cy + 11, lip = [186, 108, 98], mouth = [96, 40, 40];
    if (expr === 'angry' || expr === 'blank') { p.rect(cx - 4, my, 9, 1, INK); p.rect(cx - 3, my + 1, 7, 1, lip); }
    else if (expr === 'sad' || expr === 'worried') { p.rect(cx - 3, my, 7, 1, INK); p.px(cx - 4, my + 1, INK); p.px(cx + 4, my + 1, INK); p.rect(cx - 2, my + 1, 5, 1, lip); }
    else {
      p.rect(cx - 4, my - 1, 9, 1, lip); p.rect(cx - 4, my, 9, 3, mouth); p.rect(cx - 3, my, 7, 1, [236, 230, 220]);
      p.rect(cx - 3, my + 3, 7, 1, lip); p.px(cx - 5, my, INK); p.px(cx + 5, my, INK);
    }
    // bangs: blunt fringe above the brows
    shape(p, 10, 6, 54, 24, function (x, y) {
      if (!inEll(x, y, 31.5, 22, 17.5, 15)) return null;
      var edge = 21 + ((x >> 2) % 2);
      if (x < 18 || x > 45) edge = 40;
      if (y > edge) return null;
      return ((x * 4 + (y >> 2)) % 9 === 0) ? hairL : (x > 42 ? hairD : hair);
    });
    // teal bead earrings and necklace
    [[cx - rx - 1, cy + 9], [cx + rx + 1, cy + 9]].forEach(function (e) { p.ellipse(e[0], e[1], 2, 2, teal); p.px(e[0] - 1, e[1] - 1, tealL); p.ellipse(e[0], e[1] + 4, 1.6, 1.6, tealD); });
    for (var b = 0; b < 9; b++) {
      var bx = 24 + b * 2, by = 47 + Math.round(Math.sin(b / 8 * Math.PI) * 4);
      p.ellipse(bx, by, 1.4, 1.4, b % 2 ? teal : tealD); p.px(bx - 1, by - 1, tealL);
    }
  }

  /* ======================= JAGLIKA (late: gaunt, head-wrap) ======================= */
  function jaglikaLate(p, expr) {
    var sk = { base: [206, 182, 172], shade: [168, 142, 136], light: [222, 204, 196], deep: [128, 104, 102] };
    var wrap = [30, 44, 76], wrapD = [16, 24, 46], wrapL = [58, 80, 118];
    var jacket = [48, 26, 38], jacketD = [30, 16, 26], jacketL = [70, 44, 58], stripe = [176, 160, 164], stripeR = [176, 92, 104];
    var cx = 32, cy = 30, rx = 11, ry = 16;
    // jacket with stand-up collar, zip stripe
    shape(p, 0, 44, 63, 63, function (x, y) {
      var w = 22 + (y - 44) * 1.5; if (Math.abs(x + 0.5 - 32) > w) return null;
      return x < 20 ? jacketL : (x > 45 ? jacketD : jacket);
    });
    shape(p, 22, 40, 42, 52, function (x, y) { return (inEll(x, y, 32, 47, 10, 6) && !inEll(x, y, 32, 44, 6, 5)) ? (x > 35 ? jacketD : jacket) : null; }); // collar
    for (var y = 49; y < 64; y++) { p.rect(30, y, 2, 1, stripe); p.px(32, y, stripeR); p.px(33, y, stripe); }
    p.rect(31, 52, 2, 2, [90, 80, 84]);                                                      // zip pull
    // neck: thin, sinewy
    shape(p, 27, 38, 37, 49, function (x, y) { return inEll(x, y, 32, 43, 4.5, 7) ? (x > 33 ? sk.deep : sk.shade) : null; });
    p.line(30, 40, 29, 48, sk.deep);
    var F = faceTest(cx, cy, rx, ry, 1.0);
    paintFace(p, F, cx, cy, rx, ry, sk);
    // gaunt: hollow cheeks, deep lines
    p.line(cx - 9, cy + 4, cx - 7, cy + 10, sk.shade); p.line(cx + 9, cy + 3, cx + 8, cy + 10, sk.deep);
    p.line(cx - 5, cy + 6, cx - 6, cy + 12, sk.deep); p.line(cx + 5, cy + 6, cx + 6, cy + 12, sk.deep);   // nasolabial folds
    p.rect(cx - 5, cy - 8, 10, 1, sk.shade); p.px(cx - 1, cy - 4, sk.deep); p.px(cx, cy - 3, sk.deep);    // forehead, frown line
    // eyes: pale grey-blue, heavy hooded lids
    var openH = { scared: 3, angry: 1, tired: 1, blank: 2, smile: 1 }[expr] || 2;
    var ey = cy;
    eye(p, cx - 8, ey, 5, openH, [124, 144, 164], sk, { white: [214, 208, 200], bags: sk.deep, socket: sk.deep });
    eye(p, cx + 3, ey, 5, openH, [124, 144, 164], sk, { white: [214, 208, 200], bags: sk.deep, socket: sk.deep });
    var browLift = { sad: 1, scared: 2, worried: 1, angry: -2, smile: -1 }[expr];
    if (browLift === undefined) browLift = -1;
    for (var i = 0; i < 6; i++) { var inner = i / 5; p.px(cx - 9 + i, ey - 4 - Math.round(inner * browLift), [70, 60, 60]); p.px(cx + 8 - i, ey - 4 - Math.round(inner * browLift), [70, 60, 60]); }
    // nose: long and sharp
    p.rect(cx + 1, cy + 1, 1, 8, sk.shade); p.px(cx - 2, cy + 9, sk.deep); p.px(cx + 2, cy + 9, INK); p.rect(cx - 1, cy + 9, 2, 1, sk.shade);
    // mouth: down-turned, thin
    var my = cy + 12, lip = [158, 112, 108];
    if (expr === 'smile') { p.rect(cx - 3, my, 7, 1, INK); p.px(cx - 4, my - 1, INK); p.px(cx + 4, my - 1, INK); }
    else if (expr === 'scared' || expr === 'angry') { p.rect(cx - 3, my - 1, 7, 3, [60, 28, 32]); p.rect(cx - 3, my - 1, 7, 1, lip); }
    else { p.rect(cx - 3, my - 1, 7, 1, lip); p.rect(cx - 3, my, 7, 1, INK); p.px(cx - 4, my + 1, INK); p.px(cx + 4, my + 1, INK); p.rect(cx - 2, my + 1, 5, 1, lip); }
    p.rect(cx - 2, my + 3, 5, 1, sk.shade);
    // head-wrap: tight, folded, covers hair and the tops of the ears
    shape(p, 12, 3, 52, 30, function (x, y) {
      if (!inEll(x, y, 32, 18, 16, 15)) return null;
      if (y > 14 + Math.abs(x + 0.5 - 32) * 0.55 && Math.abs(x + 0.5 - 32) < 11) return null;   // forehead opening
      if (y > 29) return null;
      var fold = ((x + y * 2) % 8 === 0 && y < 20) || ((x - y + 64) % 9 === 0 && y >= 20);
      var c = x > 40 ? wrapD : (x < 22 ? wrapL : wrap);
      return fold ? wrapD : c;
    });
    // star earrings dangling on chains
    [[cx - rx - 1, cy + 6], [cx + rx + 1, cy + 6]].forEach(function (e, k) {
      var c = k ? [80, 96, 130] : [104, 116, 150], cd = [52, 62, 90];
      p.rect(e[0], e[1], 1, 4, [120, 118, 126]);
      var sx = e[0], sy = e[1] + 6;
      p.px(sx, sy - 2, c); p.rect(sx - 2, sy, 5, 1, c); p.rect(sx - 1, sy - 1, 3, 3, c); p.px(sx - 1, sy + 2, cd); p.px(sx + 1, sy + 2, cd);
    });
  }

  return { djordje: djordje, jaglika: jaglika, jaglika_late: jaglikaLate };
})();
