/* Shadow puppet theatre: grandmother's legend of the shadow-eater (chapter 8 memory, brief §26).
   BTS.Theatre.play() -> Promise, resolved once control, audio and the view are restored.
   The show is drawn procedurally on its own 2D canvas inside #ui (above the HUD, under the
   dialogue box): a lamp-lit sheet in a wooden frame, black paper puppets on rods with brass pins
   that move in jerky hand-made steps, their soft shadows thrown by the movable lamp, and
   "living" shadows that break that language (smooth, deeper, leaving the sheet).
   Lines run through BTS.Dialogue (speakers baka / dj); cues inside the scripts are
   { call: 'theatre', args: '<cue>' }. All text lives in locale/ru_theatre.js and en_theatre.js.
   Interaction (never required, never skips the story): click/tap a figure to look at it (F cycles),
   and in act V drag the lamp (or ← →) to stretch the witch's shadow until it lets go of her. */
'use strict';
BTS.Theatre = (function () {
  var TH = { active: false, speed: 1 };
  var TAU = Math.PI * 2;

  /* ---------------- small helpers ---------------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function vnoise(x) { var i = Math.floor(x), f = x - i; f = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), f) * 2 - 1; }
  function rng(seed) { var s = (seed >>> 0) || 1; return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  var EASE = {
    lin: function (t) { return t; },
    io: function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    out: function (t) { return 1 - Math.pow(1 - t, 3); },
    in: function (t) { return t * t * t; },
    back: function (t) { var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  };
  function t(k, p) { return BTS.t(k, p); }

  /* ---------------- data: dialogues, clue, journal sketch ---------------- */
  BTS.Data = BTS.Data || {};
  BTS.Data.dialogues = BTS.Data.dialogues || {};
  BTS.Data.clues = BTS.Data.clues || {};
  function cue(name) { return { call: 'theatre', args: name }; }
  var SCRIPTS = {
    th_in: [['*', '1'], ['baka', '2', { p: 'smile' }], ['dj', '3'], ['baka', '4', { p: 'smile' }]],
    th_a1: [['baka', '1'], cue('a1_walk'), ['baka', '2'], ['baka', '3'], ['dj', '4'], ['baka', '5'], cue('a1_stop'), ['~', 3.6], ['dj', '6'], ['~', 1.2], ['baka', '7', { p: 'smile' }]],
    th_a2: [['baka', '1'], cue('a2_witch'), ['baka', '2'], ['dj', '3'], ['baka', '4'], cue('a2_window'), ['baka', '5'], ['baka', '6'], cue('a2_leave'), ['~', 4], ['dj', '7'], ['baka', '8']],
    th_a3: [['baka', '1'], cue('a3_needle'), ['~', 2.2], ['baka', '2'], cue('a3_cut'), ['~', 3], ['baka', '3'], cue('a3_stagger'), ['dj', '4'], ['baka', '5'], ['baka', '6'], cue('a3_eat'), ['~', 3.2], cue('a3_pin'), ['~', 2], ['baka', '7']],
    th_a4: [cue('a4_one'), ['~', 3], ['baka', '1'], cue('a4_more'), ['~', 3], ['baka', '2'], cue('a4_grow'), ['~', 4], ['baka', '3'], ['dj', '4'], ['baka', '5'], cue('a4_swap'), ['~', 3], ['*', '6'], ['dj', '7'], ['baka', '8']],
    th_a5a: [cue('a5_needle'), ['baka', '1'], ['dj', '2'], ['baka', '3'], cue('a5_hide'), ['baka', '4'], ['baka', '5'], ['baka', '6']],
    th_a5b: [['baka', '1'], cue('a5_strike'), ['~', 6], ['baka', '2'], cue('a5_fail'), ['~', 4], ['dj', '3'], ['baka', '4'], ['baka', '5'], ['dj', '6'], ['baka', '7']],
    th_a6a: [['baka', '1']],
    th_a6b: [['baka', '1']]
  };
  Object.keys(SCRIPTS).forEach(function (id) { BTS.Data.dialogues[id] = SCRIPTS[id]; });
  BTS.Data.clues.sk_legend = { cat: 'sketch', title: 'clue.sk_legend.t', text: 'clue.sk_legend.d', date: 'sep21', sketch: { type: 'legend' } };
  if (BTS.Story && BTS.Story.calls) BTS.Story.calls.theatre = function (a) { runCue(a); };

  /* journal: a four-year-old's pencil drawing of the legend (witch, shadows, needle) */
  function drawLegendSketch(cv) {
    var g = cv.getContext('2d'), w = cv.width, h = cv.height, R = rng(4242);
    g.fillStyle = '#d9cfb6'; g.fillRect(0, 0, w, h);
    for (var i = 0; i < 900; i++) { g.fillStyle = 'rgba(120,100,70,' + (R() * 0.06) + ')'; g.fillRect(R() * w, R() * h, 1, 1); }
    g.strokeStyle = 'rgba(90,110,140,0.22)'; g.lineWidth = 1;
    for (var y = 18; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    function line(pts, wdt, col, jit) {
      g.strokeStyle = col || 'rgba(48,42,40,0.85)'; g.lineWidth = wdt || 1.4; g.lineCap = 'round'; g.lineJoin = 'round';
      for (var pass = 0; pass < 2; pass++) {
        g.beginPath();
        pts.forEach(function (p, k) { var jx = (R() - 0.5) * (jit || 2), jy = (R() - 0.5) * (jit || 2); if (k) g.lineTo(p[0] + jx, p[1] + jy); else g.moveTo(p[0] + jx, p[1] + jy); });
        g.stroke();
      }
    }
    function scribble(cx, cy, rx, ry, n, col, wdt) {   // child's crayon fill: zigzag strokes
      g.strokeStyle = col; g.lineWidth = wdt || 2; g.lineCap = 'round';
      g.beginPath();
      for (var k = 0; k < n; k++) { var a = k / n; var x = cx - rx + a * rx * 2; var yy = cy + (k % 2 ? -ry : ry) * (0.6 + R() * 0.4) * Math.sin(Math.PI * clamp(a * 1.05, 0, 1)); if (k) g.lineTo(x, yy); else g.moveTo(x, yy); }
      g.stroke();
    }
    var gy = h - 26;
    line([[8, gy + 2], [w - 8, gy - 1]], 1.2);
    // many shadows behind her: scribbled people with no faces
    var sh = [[60, 1.0], [96, 0.85], [128, 0.7], [292, 0.9], [326, 0.75]];
    sh.forEach(function (s, k) {
      var x = s[0], sc = s[1], top = gy - 92 * sc;
      scribble(x, gy - 46 * sc, 10 * sc, 40 * sc, 16, 'rgba(30,26,34,' + (0.45 + k * 0.04) + ')', 2.2);
      g.fillStyle = 'rgba(30,26,34,0.55)'; g.beginPath(); g.arc(x, top + 4, 7 * sc, 0, TAU); g.fill();
      line([[x - 9 * sc, gy - 60 * sc], [x - 16 * sc, gy - 34 * sc]], 1.4, 'rgba(30,26,34,.6)');
      line([[x + 9 * sc, gy - 60 * sc], [x + 16 * sc, gy - 34 * sc]], 1.4, 'rgba(30,26,34,.6)');
    });
    // the witch: tall, triangle dress, very long arms, hair
    var wx = 205, wtop = gy - 132;
    line([[wx, wtop + 18], [wx - 26, gy], [wx + 26, gy], [wx, wtop + 18]], 1.8);
    scribble(wx, gy - 40, 18, 30, 22, 'rgba(40,34,38,.55)', 2);
    g.strokeStyle = 'rgba(48,42,40,.9)'; g.lineWidth = 1.6; g.beginPath(); g.arc(wx, wtop + 8, 9, 0, TAU); g.stroke();
    line([[wx - 6, wtop + 2], [wx - 14, wtop + 30], [wx - 12, wtop + 52]], 1.3);   // hair
    line([[wx + 6, wtop + 2], [wx + 13, wtop + 28]], 1.3);
    line([[wx - 4, wtop + 26], [wx - 40, wtop + 52], [wx - 66, wtop + 88], [wx - 70, wtop + 100]], 1.6);   // long arms
    line([[wx - 70, wtop + 100], [wx - 76, wtop + 108]], 1); line([[wx - 70, wtop + 100], [wx - 70, wtop + 110]], 1); line([[wx - 70, wtop + 100], [wx - 64, wtop + 109]], 1);
    line([[wx + 4, wtop + 26], [wx + 36, wtop + 40], [wx + 62, wtop + 30]], 1.6);
    g.fillStyle = 'rgba(30,24,30,.95)'; g.fillRect(wx - 4, wtop + 6, 2, 2); g.fillRect(wx + 3, wtop + 6, 2, 2);   // two dots for eyes
    // the needle, held up high — pressed hard, gone over twice
    line([[wx + 58, wtop + 40], [wx + 92, wtop - 18]], 2.2, 'rgba(120,124,134,.95)', 1);
    g.strokeStyle = 'rgba(70,74,84,.95)'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(wx + 90, wtop - 13, 2.2, 4, 0.5, 0, TAU); g.stroke();
    line([[wx + 90, wtop - 12], [wx + 104, wtop + 4], [wx + 98, wtop + 26], [wx + 112, wtop + 44]], 1.1, 'rgba(150,30,30,.85)', 1.5);   // red thread
    // her own shadow on the ground, much too big, with arms
    g.save(); g.globalAlpha = 0.45; scribble(wx + 80, gy + 10, 70, 7, 40, 'rgba(25,20,28,1)', 2.4); g.restore();
    // a lone shadow with no person, crossed by an adult's pencil? no — circled by the child
    var lx = w - 26;
    scribble(lx, gy - 30, 6, 26, 10, 'rgba(25,20,28,.6)', 2);
    g.strokeStyle = 'rgba(150,30,30,.8)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(lx, gy - 34, 17, 40, 0.05, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(40,36,60,.9)'; g.font = 'italic 13px Georgia, serif';
    g.fillText(t('theatre.sk_needle'), wx + 70, wtop - 20 < 14 ? 14 : wtop - 20);
    g.font = 'italic 12px Georgia, serif'; g.fillText(t('theatre.sk_note'), 12, 20);
  }
  function hookJournal() {
    var J = BTS.Journal;
    if (!J || !J.drawSketch || J.drawSketch._legend) return;
    var orig = J.drawSketch;
    J.drawSketch = function (cv, sk) {
      if (sk && sk.type === 'legend') { if (cv.height < 200) cv.height = 200; return drawLegendSketch(cv, sk); }
      return orig.apply(this, arguments);
    };
    J.drawSketch._legend = true;
  }
  hookJournal();
  TH.drawLegendSketch = drawLegendSketch;

  /* ---------------- paper shape builder ----------------
     rings: arrays of points [x,y] (smooth) or [x,y,1] (sharp corner); straight sharp edges get a slightly
     uneven hand-cut line, smooth runs are drawn as quadratic curves through the midpoints. */
  function roughen(pts, R, j) {
    var out = [], n = pts.length;
    for (var i = 0; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      out.push([a[0] + (R() - 0.5) * j, a[1] + (R() - 0.5) * j, a[2]]);
      if (a[2] && b[2]) {
        var dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), k = Math.floor(L / 9);
        for (var s = 1; s < k; s++) { var f = s / k, nx = -dy / L, ny = dx / L, o = (R() - 0.5) * j * 0.9; out.push([a[0] + dx * f + nx * o, a[1] + dy * f + ny * o, 1]); }
      }
    }
    return out;
  }
  function area(p) { var s = 0; for (var i = 0; i < p.length; i++) { var a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s; }
  function ring(path, q) {
    if (area(q) < 0) q = q.slice().reverse();   // same winding for every ring: union under 'nonzero'
    var n = q.length;
    function mid(a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
    for (var i = 0; i < n; i++) {
      var v = q[i], pv = q[(i - 1 + n) % n], nx = q[(i + 1) % n];
      if (v[2]) { if (i === 0) path.moveTo(v[0], v[1]); else path.lineTo(v[0], v[1]); }
      else {
        var A = pv[2] ? pv : mid(pv, v), B = nx[2] ? nx : mid(v, nx);
        if (i === 0) path.moveTo(A[0], A[1]); else path.lineTo(A[0], A[1]);
        path.quadraticCurveTo(v[0], v[1], B[0], B[1]);
      }
    }
    path.closePath();
  }
  var seedN = 1;
  function shape(rings, j) {
    var R = rng(seedN++ * 977), p = new Path2D();
    rings.forEach(function (r) { ring(p, roughen(r, R, j === undefined ? 0.7 : j)); });
    return p;
  }
  function ell(cx, cy, rx, ry, n, wob, seed) {
    n = n || 14; var out = [], k = 1 / Math.cos(Math.PI / n), R = rng(seed || (cx * 13 + cy * 7) | 0);
    for (var i = 0; i < n; i++) { var a = i / n * TAU, w = 1 + (wob ? (R() - 0.5) * wob : 0); out.push([cx + Math.cos(a) * rx * k * w, cy + Math.sin(a) * ry * k * w]); }
    return out;
  }
  function rect(x0, y0, x1, y1) { return [[x0, y0, 1], [x1, y0, 1], [x1, y1, 1], [x0, y1, 1]]; }
  /* holes for clip(): a huge rectangle plus the cut-outs, used with 'evenodd' */
  function holes(list) {
    var p = new Path2D(); p.rect(-5000, -5000, 10000, 10000);
    list.forEach(function (r) { var q = r; if (area(q) > 0) q = q.slice().reverse(); p.moveTo(q[0][0], q[0][1]); for (var i = 1; i < q.length; i++) p.lineTo(q[i][0], q[i][1]); p.closePath(); });
    return p;
  }
  function panes(x, y, w, h) {   // a window cut in four panes
    var m = 1.6, hw = (w - m) / 2, hh = (h - m) / 2;
    return [rect(x, y, x + hw, y + hh), rect(x + hw + m, y, x + w, y + hh), rect(x, y + hh + m, x + hw, y + h), rect(x + hw + m, y + hh + m, x + w, y + h)];
  }

  /* ---------------- the puppet box: paper silhouettes (local units, feet at y=0, facing +x) ---------------- */
  var LIB = null;
  function lib() {
    if (LIB) return LIB;
    var L = {};
    // a villager: šajkača cap, belted tunic, narrow trousers, opanci with turned-up toes
    L.manBody = shape([
      [[-5, -118], [6, -118], [8, -111], [14, -107], [17, -97], [17, -84], [16, -79, 1], [19.5, -78, 1], [19.5, -71, 1], [17, -70, 1], [19, -63], [23, -55, 1], [13, -53], [1, -55], [-11, -53], [-22, -56, 1], [-18, -68], [-16, -84], [-17, -99], [-13, -108], [-7, -113]],
      ell(3, -127, 9.5, 11.5),
      [[-13, -133, 1], [-12, -141], [-7, -146, 1], [-1, -141, 1], [5, -147, 1], [12, -143], [15.5, -135, 1], [2, -131.5]],
      [[10, -133], [15.5, -127, 1], [11, -124]],
      [[8, -121], [15.5, -118.5, 1], [8, -116.5]],
      [[-9, -57], [9, -57], [8, -47], [-8, -47]]
    ]);
    L.manLeg = shape([[[-6, -5], [6, -5], [6.5, 20], [5, 45], [7, 51], [15, 53], [22.5, 48.5, 1], [20.5, 56], [8, 58.5, 1], [-6, 58.5, 1], [-5.5, 50], [-6.5, 20]]]);
    L.manUpper = shape([[[-4.6, -4], [4.6, -4], [4.6, 13], [3.9, 27], [-3.9, 27], [-4.6, 13]]]);
    L.manFore = shape([[[-3.6, -2], [3.6, -2], [3.4, 18], [5.6, 22], [5.2, 29], [0, 31.5], [-4, 26], [-3.4, 18]]]);
    L.hoe = shape([rect(-1.5, -6, 1.5, 78), [[-2.5, 74, 1], [9, 76, 1], [16, 88, 1], [4, 84, 1], [-2.5, 82, 1]]], 0.4);
    // a woman: headscarf with a hanging end, apron, long skirt
    L.womanBody = shape([
      ell(4, -122, 8.5, 10.5),
      [[12.5, -127, 1], [10, -134], [1, -139.5], [-8, -136], [-12.5, -127], [-14, -116], [-20, -100, 1], [-12, -102], [-8, -112], [-3, -114]],
      [[10.5, -125], [14.8, -120, 1], [11, -118]],
      [[-6, -113], [6, -112], [12, -106], [15, -95], [13, -83], [11, -76, 1], [15, -70], [18, -55], [21, -38], [25, -18], [28.5, -2, 1], [14, -1], [0, -2.5], [-14, -1], [-27.5, -2, 1], [-25, -16], [-20, -40], [-15, -62], [-12, -76, 1], [-13, -88], [-15, -98], [-11, -107]],
      [[11, -74, 1], [18.5, -62], [22.5, -40], [26.5, -12], [25.5, -5, 1], [18, -8], [14, -40]],
      [[6, -4], [16, -3], [21.5, -6.5, 1], [19.5, 1, 1], [5, 1, 1]]
    ]);
    L.womanUpper = shape([[[-3.8, -4], [3.8, -4], [3.8, 13], [3.2, 25], [-3.2, 25], [-3.8, 13]]]);
    L.womanFore = shape([[[-3, -2], [3, -2], [2.8, 17], [4.6, 21], [4.2, 27], [0, 29], [-3.4, 24], [-2.8, 17]]]);
    L.basket = shape([[[-11, 0, 1], [11, 0, 1], [9, 12], [0, 15], [-9, 12]], [[-9.5, 1, 1], [-8, -9], [0, -14.5], [8, -9], [9.5, 1, 1], [7.4, 1, 1], [6.2, -7], [0, -11.4], [-6.2, -7], [-7.4, 1, 1]]], 0.4);
    // the woman in a headscarf who replaces the witch (act IV): same body, a fuller scarf, hands folded
    // a child
    L.childBody = shape([
      ell(3, -80, 9, 10),
      [[-9, -82], [-11.5, -89], [-6, -92.5, 1], [-3, -96.5], [1, -92, 1], [5, -96.5], [8, -90.5, 1], [12.5, -87], [11, -83, 1], [6, -86], [0, -87]],
      [[10, -82.5], [14, -78, 1], [10, -76]],
      [[-5, -71], [6, -71], [10, -65], [11, -52], [12.5, -40.5, 1], [0, -39.5], [-11.5, -40.5, 1], [-10, -52], [-10, -64]]
    ]);
    L.childLeg = shape([[[-4.5, -3], [4.5, -3], [4.5, 30], [4, 36], [11, 38], [12.5, 42, 1], [-4.5, 42, 1], [-5, 30]]]);
    L.childUpper = shape([[[-3.4, -3], [3.4, -3], [3, 16], [-3, 16]]]);
    L.childFore = shape([[[-3, -2], [3, -2], [3, 13], [4.2, 17], [0, 20], [-3, 17]]]);
    // an old woman, bent, with a stick
    L.oldBody = shape([
      ell(17, -99, 8.5, 10),
      [[26, -104, 1], [23, -112], [13, -115], [4, -109], [-1, -98], [-7, -85, 1], [2, -89], [8, -94]],
      [[24, -101.5], [29, -96, 1], [24, -94]],
      [[8, -92], [18, -90], [21, -82], [17, -68], [18, -50], [22, -25], [25.5, -2, 1], [12, -1], [0, -2.5], [-12, -1], [-22.5, -2, 1], [-19, -25], [-15, -50], [-13, -66], [-11, -78], [-6, -88]],
      [[6, -4], [15, -3], [19.5, -6, 1], [18, 1, 1], [5, 1, 1]]
    ]);
    L.oldUpper = shape([[[-3.8, -4], [3.8, -4], [3.4, 21], [-3.4, 21]]]);
    L.oldFore = shape([[[-3.2, -2], [3.2, -2], [2.8, 16], [4.4, 20], [3.8, 25], [0, 26], [-3.2, 21]]]);
    L.cane = shape([[[-1.4, -2, 1], [-1.4, -7], [3, -10.5], [7.5, -8], [8, -4, 1], [5.6, -4, 1], [5, -6.6], [2.8, -7.6], [1.4, -6], [1.4, 50, 1], [-1.4, 50, 1]]], 0.3);
    // the witch: tall, thin, long loose hair, ragged hem, arms far too long, spider fingers — no hat, no broom
    L.witchBody = shape([
      ell(5, -178, 7.5, 10),
      [[-4, -188.5], [5, -190.5], [11, -186], [12.5, -179, 1], [6, -182], [-2, -181], [-5.5, -170], [-8, -150], [-12, -128, 1], [-15.5, -134], [-20, -112, 1], [-16, -140], [-12.5, -160], [-9, -178]],
      [[11, -179], [15, -172.5, 1], [10.5, -170.5]],
      rect(1.5, -171, 7.5, -162),
      [[-7, -165], [6, -166], [11, -160], [12, -146], [9, -126, 1], [12, -110], [16, -85], [20, -55], [24, -25], [29.5, -1, 1], [22, -6, 1], [17, 1.5, 1], [9, -4, 1], [1, 2.5, 1], [-7, -3, 1], [-15, 1.5, 1], [-21, -4, 1], [-28.5, 0.5, 1], [-25, -24], [-19, -60], [-13, -100], [-10, -126, 1], [-12, -146], [-11, -158]]
    ]);
    L.witchUpper = shape([[[-3.4, -4], [3.4, -4], [3, 22], [2.6, 45], [-2.6, 45], [-3, 22]]]);
    L.witchFore = shape([[[-2.8, -2], [2.8, -2], [2.2, 25], [2, 49], [-2, 49], [-2.2, 25]]]);
    L.witchHand = shape([[[-2.6, -1], [2.6, -1], [3.4, 6], [7.5, 21, 1], [4, 8], [2.6, 25, 1], [0.6, 9], [-1.8, 23.5, 1], [-2, 9], [-6, 19, 1], [-3.4, 5]]], 0.3);
    L.scarfBody = shape([
      ell(5, -176, 8, 10),
      [[13, -180, 1], [11, -189], [3, -193], [-7, -189], [-11, -178], [-12, -166], [-16, -150, 1], [-8, -154], [-4, -164]],
      [[11.5, -178], [15, -172.5, 1], [11, -170.5]],
      rect(1.5, -168, 7.5, -160),
      [[-7, -163], [6, -164], [12, -157], [14, -142], [11, -124, 1], [15, -100], [20, -60], [25, -25], [28.5, -1, 1], [14, -1], [0, -2.5], [-14, -1], [-27.5, -1, 1], [-24, -25], [-18, -60], [-13, -100], [-11, -124, 1], [-13, -142], [-11, -156]],
      [[12, -123, 1], [19, -100], [24, -60], [27, -10], [24, -5, 1], [20, -30], [16, -80]]
    ]);
    // the needle (metal, not paper): eye at the top, point at the bottom
    L.needle = shape([[[-1.1, 0, 1], [-1.1, -60], [-2.1, -66], [0, -72.5], [2.1, -66], [1.1, -60], [1.1, 0, 1], [0, 11, 1]]], 0.08);
    // animals
    L.rabbitBody = shape([
      [[-18, -2], [-22.5, -12], [-19, -22], [-8, -28], [4, -27.5], [10, -22], [12, -14], [16, -6], [21, -2, 1], [8, 0], [-6, 0]],
      ell(-21.5, -14, 4.2, 4.2, 8, 0.4),
      [[5, -25], [8.5, -32.5], [16, -36], [22, -33.5], [25.5, -28.5, 1], [22, -25], [16, -22], [10, -22]],
      [[12, -8], [17, -3], [22.5, -1, 1], [16, 0.5], [11, -2]]
    ]);
    L.rabbitEars = shape([[[-3, 1], [-6.5, -12], [-5, -22.5], [-1.5, -24.5], [0.5, -14], [3, -1]], [[1, 1], [2.5, -12], [5.5, -21], [8.5, -21.5], [6.5, -11], [4.5, 1]]], 0.4);
    L.dogBody = shape([
      [[-30, -30], [-14, -33.5], [6, -32], [16, -36], [21, -30], [20, -22], [10, -18], [-10, -18.5], [-26, -19], [-32.5, -24]],
      [[12, -22], [17.5, -22], [17, -3], [20.5, 0, 1], [13, 0.5, 1], [12, -4]],
      [[6, -20], [10.5, -20], [10, -3], [12.5, 0, 1], [6, 0.5, 1], [6, -4]],
      [[-27, -22], [-20, -20], [-20, -3], [-16.5, 0, 1], [-24, 0.5, 1], [-25, -6]],
      [[-21, -20], [-15, -20], [-14, -3], [-10.5, 0, 1], [-18, 0.5, 1], [-19, -6]]
    ]);
    L.dogHead = shape([[[-6, -1], [-2, -10], [5, -12.5], [10, -9], [17, -6.5], [21, -3.5, 1], [17.5, 1.5], [8, 2], [0, 4.5], [-5.5, 4]], [[-1, -9], [-3.5, -18.5, 1], [3, -11]]], 0.5);
    L.dogTail = shape([[[0, -2.5], [-7, -9], [-12, -19, 1], [-8.5, -9.5], [0, 2.5]]], 0.4);
    L.rooster = shape([
      [[-6, -10], [-10, -18], [-6, -24], [2, -26], [8, -28], [10, -36], [14, -40], [18, -38.5], [22.5, -35.5, 1], [18, -33.5], [16.5, -28], [14, -20], [8, -12], [0, -9]],
      [[10, -39], [11, -44.5, 1], [13, -41], [15, -45.5, 1], [16, -41], [18.5, -43, 1], [18.5, -38]],
      [[16, -33.5], [17.4, -28.5], [15, -29]],
      [[-6, -14], [-13, -29], [-19, -40], [-24.5, -38.5, 1], [-18, -30], [-27, -35, 1], [-22, -25], [-29, -26, 1], [-20, -17], [-10, -12]],
      [[-0.5, -11, 1], [1.5, -11, 1], [1.5, -1.5, 1], [6, 0, 1], [-3.5, 0, 1], [-0.5, -1.5, 1]],
      [[4.5, -11, 1], [6.5, -11, 1], [6.5, -1.5, 1], [10, 0, 1], [3, 0, 1], [4.5, -1.5, 1]]
    ]);
    // scenery
    var eaves = []; for (var x = -88; x < 88; x += 8) eaves.push([x, -58, 1], [x + 4, -54.5, 1]);
    eaves.push([88, -58, 1]);
    L.houseA = shape([
      rect(-70, -62, 70, 0),
      [[-89, -59, 1], [-51, -119, 1], [51, -119, 1], [89, -59, 1]].concat(eaves.slice().reverse()),
      rect(27, -134, 40, -108), rect(24, -139, 43, -134),
      rect(-6, -40, 10, 0), rect(-80, -6, -66, 0)
    ]);
    L.houseAHoles = holes(panes(-52, -48, 20, 22).concat(panes(26, -48, 20, 22)).concat([[[-3, -96, 1], [0, -103, 1], [3, -96, 1]]]));
    L.houseB = shape([
      rect(-50, -50, 50, 0),
      [[-63, -45, 1], [0, -101, 1], [63, -45, 1], [55, -44, 1], [0, -93, 1], [-55, -44, 1]],
      [[-55, -44, 1], [0, -93, 1], [55, -44, 1]],
      [[-22, -40, 1], [-8, -40, 1], [-8, 0, 1], [-22, 0, 1]]
    ]);
    L.houseBHoles = holes(panes(10, -38, 18, 20).concat([ell(0, -66, 5, 5, 10)]).concat([[[-21, -38, 1], [-14, -38, 1], [-14, -2, 1], [-21, -2, 1]]]));
    L.church = shape([
      rect(-26, -46, 26, 0), [[-30, -44, 1], [0, -62, 1], [30, -44, 1]],
      rect(-10, -76, 10, -58), [[-12, -75], [-10, -84], [0, -91], [10, -84], [12, -75]],
      rect(-1, -106, 1, -89), rect(-5, -101, 5, -99)
    ], 0.4);
    L.churchHoles = holes([[[-4, -6, 1], [4, -6, 1], [4, -26, 1], [0, -31, 1], [-4, -26, 1]], rect(-3, -72, 3, -63)]);
    L.wellPost = shape([
      rect(-3, -90, 3, 0), [[-7, -89, 1], [-4.5, -99, 1], [-2, -89, 1]], [[2, -89, 1], [4.5, -99, 1], [7, -89, 1]],
      rect(30, -22, 62, 0), rect(27, -26, 65, -21)
    ]);
    L.wellSweep = shape([rect(-46, -1.8, 96, 1.8), rect(-49, -5, -35, 6)], 0.4);
    L.wellRope = shape([rect(-0.6, 0, 0.6, 52), [[-5.5, 52, 1], [5.5, 52, 1], [4.5, 63, 1], [-4.5, 63, 1]]], 0.3);
    L.tree = shape([
      [[-7, 0, 1], [-5, -40], [-8, -70], [-19, -96, 1], [-14.5, -97], [-4, -78], [0, -92], [1.5, -112, 1], [5.5, -110], [4, -85], [10, -75], [25, -99, 1], [28, -96], [12, -70], [6.5, -40], [9, 0, 1]],
      ell(-32, -112, 32, 24, 16, 0.35, 11), ell(4, -134, 42, 30, 18, 0.3, 12), ell(40, -110, 30, 22, 16, 0.35, 13), ell(-6, -100, 26, 16, 14, 0.3, 14), ell(20, -150, 22, 14, 12, 0.4, 15)
    ], 1.2);
    L.treeHoles = holes([ell(-38, -118, 5, 3.5, 8, 0.4, 21), ell(18, -128, 6, 4, 8, 0.4, 22), ell(44, -112, 4, 3, 8, 0.4, 23), ell(-6, -142, 4, 3, 8, 0.4, 24), ell(30, -98, 3, 2.5, 8, 0.4, 25)]);
    var fen = [], fh = [];
    for (var fx = 0; fx <= 120; fx += 17) fen.push([[fx - 1.8, 0, 1], [fx + 1.8, 0, 1], [fx + 1.8, -38, 1], [fx, -42, 1], [fx - 1.8, -38, 1]]);
    var band = [[-2, -11, 1]]; for (fx = 6; fx < 122; fx += 8) band.push([fx, -11 + (fx % 16 ? 1.2 : -1.2)]); band.push([122, -11, 1], [122, -31, 1]);
    for (fx = 116; fx > 0; fx -= 8) band.push([fx, -31 + (fx % 16 ? -1.2 : 1.2)]); band.push([-2, -31, 1]);
    fen.push(band);
    for (fx = 4; fx < 118; fx += 12) fh.push([[fx, -21.5, 1], [fx + 4, -24, 1], [fx + 8, -21.5, 1], [fx + 4, -19, 1]]);
    L.fence = shape(fen, 0.6);
    L.fenceHoles = holes(fh);
    var moon = []; for (var i = 0; i <= 10; i++) { var a = Math.PI / 2 + i / 10 * Math.PI; moon.push([Math.cos(a) * 20, Math.sin(a) * 20, i === 0 || i === 10 ? 1 : 0]); }
    for (i = 9; i >= 1; i--) { a = Math.PI / 2 + i / 10 * Math.PI; moon.push([Math.cos(a) * 9 - 2, Math.sin(a) * 18.5]); }
    L.moon = shape([moon], 0.3);
    var gr = [[-480, 80, 1], [-480, 2]], gx;
    for (gx = -470; gx <= 470; gx += 10) {
      var gy = Math.sin(gx * 0.011) * 6 + Math.sin(gx * 0.037) * 2.5;
      if (hash(gx) < 0.33) gr.push([gx - 2, gy, 1], [gx + 1, gy - 7 - hash(gx + 3) * 7, 1], [gx + 3, gy, 1]);
      else gr.push([gx, gy]);
    }
    gr.push([480, 2], [480, 80, 1]);
    L.ground = shape([gr], 0.8);
    // grandmother's own hands holding a rod (seen as dark shapes against the light, with a warm rim)
    L.hand = shape([[[-17, 70, 1], [-15, 36], [-21, 16], [-25, 2], [-22, -6], [-14, -9], [-12, -17], [-5, -21], [2, -18], [8, -22], [14, -18], [19, -14], [24, -9], [25, -1], [20, 6], [16, 18], [14, 36], [17, 70, 1]], [[-23, -2], [-31, -12], [-28, -18], [-19, -10]]], 1);
    L.handOpen = shape([[[-30, 150, 1], [-26, 40], [-42, 12], [-62, -18], [-56, -26], [-34, -6], [-31, -50], [-29, -92], [-20, -94], [-16, -54], [-12, -104], [-3, -106], [0, -56], [8, -98], [17, -96], [12, -50], [25, -82], [33, -78], [22, -30], [25, 0], [27, 150, 1]]], 1.5);
    LIB = L;
    return L;
  }

  /* ---------------- puppet objects ---------------- */
  function part(name, path, pv, o) { o = o || {}; return { name: name, path: path, pv: pv, ch: o.ch || [], pin: o.pin !== false, metal: !!o.metal, hang: !!o.hang }; }
  var PID = 0;
  function Puppet(kind, root, o) {
    o = o || {};
    var p = {
      id: ++PID, kind: kind, look: o.look || kind, root: root, x: o.x || 0, y: o.y === undefined ? 160 : o.y, rot: 0, s: o.s || 1, flip: o.flip || 1,
      d: o.d === undefined ? 26 : o.d, alpha: 1, paper: o.paper !== false, cast: o.cast !== false, rods: o.rods || [], pins: o.pins || [], holes: o.holes || null,
      ang: {}, base: {}, gait: o.gait || null, stride: o.stride || 24, phase: 0, walking: false, bob: 0, lastX: o.x || 0, hop: 0,
      sh: { dx: 0, dy: 0, rot: 0, alpha: 1, live: false, lag: 0, lean: 0, autoLean: o.autoLean === undefined ? 0.16 : o.autoLean, stretch: 1, squash: 1, grow: 1, wob: 0, legs: null, sup: false, hide: false, frozen: null, scaleY: 1 },
      tq: 0, disp: null, hist: [], z: o.z || 0, hitR: o.hitR || 60, hidden: false, react: 0, held: o.held || null, rodTilt: o.rodTilt, hideP: o.hideP || null, _sw: {}, hoe: !!o.hoe
    };
    (function walk(pt) { p.ang[pt.name] = 0; pt.ch.forEach(walk); })(root);
    if (o.ang) for (var k in o.ang) { p.ang[k] = o.ang[k]; p.base[k] = o.ang[k]; }
    p.disp = pose(p);
    return p;
  }
  function pose(p) {
    var a = {}; for (var k in p.ang) a[k] = p.ang[k];
    return { x: p.x, y: p.y + p.bob - p.hop, rot: p.rot, s: p.s, flip: p.flip, ang: a };
  }
  function human(L, kind, body, upper, fore, leg, o) {
    o = o || {};
    var legs = leg ? [part('legB', L[leg], o.hipB || [-3, -58]), part('legF', L[leg], o.hipF || [4, -58])] : [];
    var foreF = part('foreF', L[fore], o.elbow || [0, 25], { ch: o.toolF ? [o.toolF] : [] });
    var foreB = part('foreB', L[fore], o.elbow || [0, 25]);
    var armB = part('armB', L[upper], o.shB || [-6, -104], { ch: [foreB] });
    var armF = part('armF', L[upper], o.shF || [5, -104], { ch: [foreF] });
    var root = part('body', L[body], [0, 0], { pin: false, ch: [armB].concat(legs).concat([armF]) });
    return root;
  }
  var make = {
    man: function (o) {
      var L = lib(); o = o || {};
      var hoe = o.hoe ? part('tool', L.hoe, [0, 29], { pin: false }) : o.needleTool ? part('tool', L.needle, [0.5, 28], { pin: false, metal: true }) : null;
      var root = human(L, 'man', 'manBody', 'manUpper', 'manFore', 'manLeg', { toolF: hoe });
      return Puppet('man', root, Object.assign({ gait: 'walk', rods: [[0, -96]], ang: o.hoe ? { armF: -0.5, foreF: -2.3, tool: 2.6, armB: 0.15, foreB: -0.1 } : { armF: 0.08, foreF: -0.12, armB: -0.05, foreB: -0.1, tool: 2.5 } }, o));
    },
    woman: function (o) {
      var L = lib(); o = o || {};
      var bas = o.basket ? part('basket', L.basket, [1.5, 28], { pin: false, hang: true }) : null;
      var root = human(L, 'woman', 'womanBody', 'womanUpper', 'womanFore', null, { shF: [4, -104], shB: [-5, -104], elbow: [0, 23], toolF: bas });
      return Puppet('woman', root, Object.assign({ gait: 'glide', rods: [[0, -95]], ang: { armF: bas ? -0.35 : 0.1, foreF: bas ? -0.9 : -0.2, armB: -0.05, foreB: -0.1 } }, o));
    },
    child: function (o) {
      var L = lib();
      var root = human(L, 'child', 'childBody', 'childUpper', 'childFore', 'childLeg', { hipB: [-3, -42], hipF: [3, -42], shF: [2, -67], shB: [-4, -67], elbow: [0, 15] });
      return Puppet('child', root, Object.assign({ gait: 'walk', stride: 16, rods: [[0, -60]], hitR: 45, ang: { armF: 0.15, foreF: -0.2, armB: -0.1, foreB: -0.1 } }, o));
    },
    old: function (o) {
      var L = lib();
      var cane = part('tool', L.cane, [1.5, 24], { pin: false, hang: true });
      var foreF = part('foreF', L.oldFore, [0, 19], { ch: [cane] });
      var armF = part('armF', L.oldUpper, [16, -84], { ch: [foreF] });
      var root = part('body', L.oldBody, [0, 0], { pin: false, ch: [armF] });
      return Puppet('old', root, Object.assign({ look: 'old', gait: 'shuffle', stride: 14, rods: [[2, -80]], hitR: 50, ang: { armF: -0.55, foreF: -0.4 } }, o));
    },
    witch: function (o) {
      var L = lib(); o = o || {};
      var nd = o.needle ? part('needle', L.needle, [0.5, 13], { pin: false, metal: true }) : null;
      var handF = part('handF', L.witchHand, [0, 49], { ch: nd ? [nd] : [] }), handB = part('handB', L.witchHand, [0, 49]);
      var foreF = part('foreF', L.witchFore, [0, 44], { ch: [handF] }), foreB = part('foreB', L.witchFore, [0, 44], { ch: [handB] });
      var armB = part('armB', L.witchUpper, [-5, -160], { ch: [foreB] }), armF = part('armF', L.witchUpper, [4, -160], { ch: [foreF] });
      var root = part('body', L.witchBody, [0, 0], { pin: false, ch: [armB, armF] });
      return Puppet('witch', root, Object.assign({ gait: 'glide', stride: 30, rods: [[0, -150], [0, 0, 'handF']], hitR: 80, ang: { armF: 0.12, foreF: -0.06, handF: 0.1, armB: -0.08, foreB: 0.04, handB: 0.1, needle: 2.7 } }, o));
    },
    scarfWoman: function (o) {
      var L = lib();
      var foreF = part('foreF', L.witchFore, [0, 30]), armF = part('armF', L.womanUpper, [4, -158], { ch: [foreF] });
      var root = part('body', L.scarfBody, [0, 0], { pin: false, ch: [armF] });
      return Puppet('woman', root, Object.assign({ look: 'woman2', gait: 'glide', rods: [[0, -150]], hitR: 80, ang: { armF: -0.3, foreF: -1.2 } }, o));
    },
    needle: function (o) {
      var L = lib();
      var root = part('needle', L.needle, [0, 0], { pin: false, metal: true });
      return Puppet('needle', root, Object.assign({ rods: [[0, -40]], hitR: 40, d: 30 }, o));
    },
    rabbit: function (o) {
      var L = lib();
      var root = part('body', L.rabbitBody, [0, 0], { pin: false, ch: [part('ears', L.rabbitEars, [12, -33])] });
      return Puppet('rabbit', root, Object.assign({ gait: 'hop', rods: [[-4, -18]], hitR: 30, d: 14 }, o));
    },
    dog: function (o) {
      var L = lib();
      var root = part('body', L.dogBody, [0, 0], { pin: false, ch: [part('tail', L.dogTail, [-30, -27]), part('head', L.dogHead, [19, -33])] });
      return Puppet('dog', root, Object.assign({ gait: 'trot', stride: 18, rods: [[-6, -26]], hitR: 40, d: 18 }, o));
    },
    rooster: function (o) {
      var L = lib();
      return Puppet('rooster', part('body', L.rooster, [0, 0], { pin: false }), Object.assign({ rods: [], pins: [[2, -18]], hitR: 26, d: 6 }, o));
    },
    houseA: function (o) { var L = lib(); return Puppet('house', part('body', L.houseA, [0, 0], { pin: false }), Object.assign({ holes: L.houseAHoles, d: 5, pins: [[-60, -10], [60, -10], [0, -100]], hitR: 90, autoLean: 0.05 }, o)); },
    houseB: function (o) { var L = lib(); return Puppet('house', part('body', L.houseB, [0, 0], { pin: false }), Object.assign({ holes: L.houseBHoles, d: 5, pins: [[-42, -8], [42, -8]], hitR: 70, autoLean: 0.05 }, o)); },
    church: function (o) { var L = lib(); return Puppet('church', part('body', L.church, [0, 0], { pin: false }), Object.assign({ holes: L.churchHoles, d: 3, pins: [[0, -30]], hitR: 50, autoLean: 0.03 }, o)); },
    well: function (o) {
      var L = lib();
      var sweep = part('sweep', L.wellSweep, [0, -93], { ch: [part('rope', L.wellRope, [94, 0], { hang: true })] });
      return Puppet('well', part('body', L.wellPost, [0, 0], { pin: false, ch: [sweep] }), Object.assign({ d: 6, pins: [[0, -20], [46, -10]], hitR: 70, ang: { sweep: 0.42 }, autoLean: 0.05 }, o));
    },
    tree: function (o) { var L = lib(); return Puppet('tree', part('body', L.tree, [0, 0], { pin: false }), Object.assign({ holes: L.treeHoles, d: 8, pins: [[0, -30], [4, -128]], hitR: 80, autoLean: 0.06 }, o)); },
    fence: function (o) { var L = lib(); return Puppet('fence', part('body', L.fence, [0, 0], { pin: false }), Object.assign({ look: 'house', holes: L.fenceHoles, d: 4, pins: [[0, -20], [119, -20]], hitR: 60, autoLean: 0.04 }, o)); },
    moon: function (o) { var L = lib(); return Puppet('moon', part('body', L.moon, [0, 0], { pin: false }), Object.assign({ d: 4, pins: [[-14, 0]], hitR: 30, autoLean: 0 }, o)); },
    ground: function (o) { var L = lib(); return Puppet('ground', part('body', L.ground, [0, 0], { pin: false }), Object.assign({ look: null, d: 2, pins: [[-440, 30], [440, 30]], hitR: 0, autoLean: 0 }, o)); }
  };

  /* ---------------- stage state, clock, tweens ----------------
     World units: the sheet is ~900×530, centred on (0,0), y down. Feet line y=166, lamp flame y≈246,
     table top y=300, floor y=540. Grandmother sits to the right (x≈760), Đorđe on the floor left (x≈-720). */
  var CLOTH = { x0: -452, x1: 452, y0: -308, y1: 226 };
  var FEET = 166;
  var S = null, clock = 0, timers = [], tweens = [];
  function newScene() {
    return {
      cam: { x: 0, y: 90, z: 0.42, lx: 0, ly: 0, lz: 0, shake: 0 },
      lamp: { x: -24, y: 246, D: 700, on: 0, flick: 0, dim: 1, drag: false, can: false, flare: 0 },
      room: 1, black: 1, spill: 0, spillHands: 0, white: 0,
      puppets: [], hands: [], handShadow: { on: false, x: 600, y: 60, rot: -0.3, s: 1.3, alpha: 0.9 },
      title: { key: null, a: 0 }, caps: [], hint: null, hintA: 0,
      gma: { arm: 0, lean: 0, away: 0 }, dj: { head: 0, look: 0, arm: 0 }, djShadow: { on: 1 }, endShot: false
    };
  }
  function wait(sec) { return new Promise(function (res) { timers.push({ left: sec, res: res }); }); }
  /* tween numeric fields of obj; a newer tween on the same field takes it over */
  function tw(obj, to, dur, ease, delay) {
    tweens.forEach(function (o) { if (o.obj === obj) for (var k in to) delete o.to[k]; });
    return new Promise(function (res) { tweens.push({ obj: obj, to: Object.assign({}, to), from: null, dur: Math.max(0.0001, dur), t: 0, delay: delay || 0, ease: EASE[ease || 'io'], res: res }); });
  }
  function stopTweens(obj) { tweens = tweens.filter(function (o) { if (o.obj === obj) { o.res(); return false; } return true; }); }
  function tick(dt) {
    clock += dt;
    for (var i = timers.length - 1; i >= 0; i--) { var tm = timers[i]; tm.left -= dt; if (tm.left <= 0) { timers.splice(i, 1); tm.res(); } }
    for (i = tweens.length - 1; i >= 0; i--) {
      var o = tweens[i]; o.t += dt;
      if (o.t < o.delay) continue;
      if (!o.from) { o.from = {}; for (var k in o.to) o.from[k] = o.obj[k]; }
      var f = clamp((o.t - o.delay) / o.dur, 0, 1), e = o.ease(f), any = false;
      for (k in o.to) { any = true; o.obj[k] = lerp(o.from[k], o.to[k], e); }
      if (f >= 1 || !any) { tweens.splice(i, 1); o.res(); }
    }
  }

  /* ---------------- puppet life: gait, jerky hand-held steps, pose history ---------------- */
  function add(p, o) { if (o) Object.assign(p, o); S.puppets.push(p); p.disp = pose(p); return p; }
  function remove(p) { if (!p) return; var i = S.puppets.indexOf(p); if (i >= 0) S.puppets.splice(i, 1); stopTweens(p); stopTweens(p.ang); stopTweens(p.sh); }
  function byKind(k) { return S.puppets.filter(function (p) { return p.kind === k; }); }
  var clickBudget = 0;
  function livePuppet(p, dt) {
    var mv = p.x - p.lastX; p.lastX = p.x;
    var moving = Math.abs(mv) > 0.004 * 60 * dt;
    if (p.gait) {
      if (moving) p.phase += Math.abs(mv) / p.stride * Math.PI;
      var s = Math.sin(p.phase), k = moving ? 1 : 0;
      p.walkK = lerp(p.walkK || 0, k, 1 - Math.exp(-dt * 8));
      var w = p.walkK, b = p.base, sw = {};
      if (p.gait === 'walk') {
        if ('legF' in p.ang) { sw.legF = s * 0.42 * w; sw.legB = -s * 0.42 * w; }
        if (!p.armHeld) { sw.armF = -s * 0.28 * w * (p.hoe ? 0.15 : 1); sw.armB = s * 0.28 * w; }
        p.bob = -Math.abs(Math.cos(p.phase)) * 2.4 * w;
      } else if (p.gait === 'glide') {
        if (!p.armHeld && 'armB' in p.ang) { sw.armF = -s * 0.12 * w; sw.armB = s * 0.12 * w; }
        p.bob = -Math.abs(Math.cos(p.phase)) * 1.6 * w;
      } else if (p.gait === 'shuffle') {
        p.bob = -Math.abs(Math.cos(p.phase)) * 1.2 * w; p.rot = 0.03 * s * w;
      } else if (p.gait === 'hop') {
        p.hop = Math.max(0, Math.sin(p.phase * 0.5)) * 13 * w; p.ang.ears = -0.25 * Math.max(0, Math.sin(p.phase * 0.5)) * w + (p.earT || 0);
      } else if (p.gait === 'trot') {
        p.bob = -Math.abs(Math.cos(p.phase)) * 1.8 * w; p.ang.tail = Math.sin(clock * 9) * 0.25 * (0.4 + w) + (p.base.tail || 0);
      }
      for (var sk in sw) { p.ang[sk] = (p.ang[sk] || 0) + sw[sk] - (p._sw[sk] || 0); }
      for (sk in p._sw) if (!(sk in sw)) p.ang[sk] -= p._sw[sk];
      p._sw = sw;
    }
    if (p.react > 0) { p.react = Math.max(0, p.react - dt); }
    // the hand-held paper only updates in small jerks (a puppeteer's wrist, a stiff rod)
    p.tq -= dt;
    if (p.tq <= 0) {
      var prev = p.disp;
      p.disp = pose(p);
      if (p.react > 0) { p.disp.rot += Math.sin(p.react * 40) * 0.05 * p.react; p.disp.y -= p.react * 5; }
      if (p.rods.length) { p.disp.rot += (hash(clock * 3.1 + p.id) - 0.5) * 0.012; }
      p.tq = (p.pinnedStill ? 0.25 : 0.07) + hash(clock + p.id * 7.3) * 0.06 + (hash(clock * 2 + p.id) < 0.06 ? 0.18 : 0);
      if (prev && p.paper && p.rods.length && Math.abs(prev.x - p.disp.x) + Math.abs(prev.y - p.disp.y) > 1.5 && clickBudget <= 0 && hash(clock * 5 + p.id) < 0.22) { sfxClick(0.12 + hash(clock) * 0.12); clickBudget = 0.22; }
    }
    p.hist.push({ t: clock, q: pose(p) });
    while (p.hist.length > 2 && p.hist[0].t < clock - 2.5) p.hist.shift();
  }
  function histAt(p, tt) {
    var h = p.hist; if (!h.length) return pose(p);
    for (var i = h.length - 1; i >= 0; i--) if (h[i].t <= tt) return h[i].q;
    return h[0].q;
  }
  function copyPose(q) { var a = {}; for (var k in q.ang) a[k] = q.ang[k]; return { x: q.x, y: q.y, rot: q.rot, s: q.s, flip: q.flip, ang: a }; }
  function shadowPose(p) {
    var sh = p.sh;
    if (sh.frozen) return sh.frozen;
    var q = copyPose(sh.lag > 0 ? histAt(p, clock - sh.lag) : (sh.live || !p.paper ? pose(p) : p.disp));
    q.x += sh.dx; q.y += sh.dy; q.rot += sh.rot;
    if (sh.legs) { var s = Math.sin(sh.legs.phase); if ('legF' in q.ang) { q.ang.legF = s * 0.45; q.ang.legB = -s * 0.45; } q.ang.armF = (p.base.armF || 0) - s * 0.3; q.ang.armB = (p.base.armB || 0) + s * 0.3; }
    if (sh.ang) for (var k in sh.ang) q.ang[k] = (q.ang[k] || 0) + sh.ang[k];
    if (sh.wob) { q.rot += vnoise(clock * 1.7 + p.id) * 0.05 * sh.wob; for (k in q.ang) q.ang[k] += vnoise(clock * 1.3 + p.id * 3 + k.length) * 0.12 * sh.wob; }
    return q;
  }
  /* the shadow on the sheet: the paper is d units in front of the cloth, the flame D units in front:
     everything scales by D/(D-d) around the flame; grounded figures also lean away from it */
  function shadowMatrix(p, q) {
    var sh = p.sh, L = S.lamp;
    if (sh.frozenM) return sh.frozenM;
    var m = L.D / Math.max(30, L.D - p.d);
    var M = new DOMMatrix();
    M.translateSelf(L.x, L.y); M.scaleSelf(m, m); M.translateSelf(-L.x, -L.y);
    var lean = sh.lean - sh.autoLean * clamp((q.x - L.x) / 300, -2.4, 2.4);
    var st = sh.stretch * (1 + Math.abs(lean) * (sh.lie || 0)), sq = sh.squash / (1 + Math.abs(lean) * (sh.lie || 0) * 0.55);
    M.translateSelf(q.x, q.y);
    M.multiplySelf(new DOMMatrix([st, 0, lean, sq * sh.scaleY, 0, 0]));
    M.scaleSelf(sh.grow, sh.grow);
    M.rotateSelf(q.rot * 180 / Math.PI);
    M.scaleSelf(q.s * q.flip, q.s);
    return M;
  }
  function paperMatrix(q) { var M = new DOMMatrix(); M.translateSelf(q.x, q.y); M.rotateSelf(q.rot * 180 / Math.PI); M.scaleSelf(q.s * q.flip, q.s); return M; }
  /* world matrix of a named part (for rods, needle tips, shadow heads) */
  function partMatrix(p, q, name, base) {
    var found = null;
    (function walk(pt, M, acc) {
      if (found) return;
      var a = pt.hang ? -acc : (q.ang[pt.name] || 0);
      var N = M.translate(pt.pv[0], pt.pv[1]).rotate(a * 180 / Math.PI);
      if (pt.name === name) { found = N; return; }
      pt.ch.forEach(function (c) { walk(c, N, acc + a); });
    })(p.root, base || paperMatrix(q), 0);
    return found || base || paperMatrix(q);
  }
  function pt(M, x, y) { var r = M.transformPoint(new DOMPoint(x, y)); return [r.x, r.y]; }

  /* ---------------- rendering ---------------- */
  var cv = null, g = null, shC, shG, supC, supG, W = 1, H = 1, DPR = 1, s0 = 1, AY = 1, SHK = 1 / 3;
  var clothPath = null, clothTex = null, grainTex = null, people = null;
  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  function resize() {
    if (!cv) return;
    W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    var px = W * H * DPR * DPR; if (px > 2.6e6) DPR = Math.sqrt(2.6e6 / (W * H));
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    shC.width = Math.ceil(cv.width * SHK); shC.height = Math.ceil(cv.height * SHK);
    supC.width = Math.ceil(cv.width * 0.5); supC.height = Math.ceil(cv.height * 0.5);
    // keep the sheet, the lamp and the table above the dialogue box
    var dlg = BTS.UI && BTS.UI.dlg, dh = dlg && dlg.offsetHeight ? dlg.offsetHeight : 160;
    var bottomUI = clamp(dh + H * 0.07 + 18, 120, H * 0.45);
    var avail = Math.max(H * 0.45, H - bottomUI - 12);
    s0 = Math.max(0.12, Math.min(W * 0.96 / 1010, avail / 640));
    AY = 6 + 342 * s0 + Math.max(0, (avail - 640 * s0) * 0.5);
  }
  function camS() { return s0 * (S.cam.z + S.cam.lz); }
  function camC() {
    var sh = S.cam.shake;
    return [S.cam.x + S.cam.lx + (sh ? vnoise(clock * 31) * sh * 6 : 0), S.cam.y + S.cam.ly + (sh ? vnoise(clock * 29 + 5) * sh * 6 : 0)];
  }
  function worldT(gg, k) { var sc = camS(), c = camC(), f = DPR * k; gg.setTransform(f * sc, 0, 0, f * sc, f * (W / 2 - c[0] * sc), f * (AY - c[1] * sc)); }
  function toScreen(x, y) { var sc = camS(), c = camC(); return [W / 2 + (x - c[0]) * sc, AY + (y - c[1]) * sc]; }
  function toWorld(px, py) { var sc = camS(), c = camC(); return [(px - W / 2) / sc + c[0], (py - AY) / sc + c[1]]; }
  function lampI() {
    var L = S.lamp;
    var f = 1 + 0.05 * vnoise(clock * 7.3) + 0.03 * vnoise(clock * 17.9 + 4);
    if (L.flick > 0) f *= 1 - L.flick * 0.75 * Math.max(0, vnoise(clock * 21) * 1.6 - 0.2);
    return Math.max(0, L.on * L.dim * f + L.flare);
  }

  function buildStatic() {
    var R = rng(99), p = new Path2D(), x, c = CLOTH;
    var ties = [c.x0, -150, 150, c.x1];
    p.moveTo(c.x0 + 2, c.y0 + 1);
    for (x = c.x0; x <= c.x1; x += 12) { var seg = 0; for (var k = 0; k < 3; k++) if (x >= ties[k] && x <= ties[k + 1]) seg = (x - ties[k]) / (ties[k + 1] - ties[k]); p.lineTo(x, c.y0 + Math.sin(seg * Math.PI) * 7 + (R() - 0.5) * 1.6); }
    for (var y = c.y0; y <= c.y1; y += 12) p.lineTo(c.x1 - Math.sin((y - c.y0) / (c.y1 - c.y0) * Math.PI) * 4 + (R() - 0.5) * 1.6, y);
    for (x = c.x1; x >= c.x0; x -= 12) p.lineTo(x, c.y1 - Math.sin((x - c.x0) / (c.x1 - c.x0) * Math.PI) * 3 + (R() - 0.5) * 1.8);
    for (y = c.y1; y >= c.y0; y -= 12) p.lineTo(c.x0 + Math.sin((y - c.y0) / (c.y1 - c.y0) * Math.PI) * 4 + (R() - 0.5) * 1.6, y);
    p.closePath();
    clothPath = p;
    // the old sheet: weave, tea stains, a darned patch, creases
    var tw = 1024, th = 620, ct = makeCanvas(tw, th), q = ct.getContext('2d');
    q.fillStyle = '#efdcb6'; q.fillRect(0, 0, tw, th);
    for (var i = 0; i < 60; i++) { var gx = R() * tw, gy = R() * th, gr = 40 + R() * 160, grd = q.createRadialGradient(gx, gy, 0, gx, gy, gr); var dark = R() < 0.6; grd.addColorStop(0, dark ? 'rgba(150,110,60,0.07)' : 'rgba(255,248,230,0.09)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); q.fillStyle = grd; q.fillRect(gx - gr, gy - gr, gr * 2, gr * 2); }
    for (y = 0; y < th; y += 2 + R() * 2) { q.fillStyle = 'rgba(120,90,50,' + (0.02 + R() * 0.04) + ')'; q.fillRect(0, y, tw, 1); }
    for (x = 0; x < tw; x += 2 + R() * 2) { q.fillStyle = 'rgba(120,90,50,' + (0.015 + R() * 0.035) + ')'; q.fillRect(x, 0, 1, th); }
    for (i = 0; i < 2500; i++) { q.fillStyle = 'rgba(90,60,30,' + R() * 0.12 + ')'; q.fillRect(R() * tw, R() * th, 1 + R() * 2, 1); }
    [[180, 120, 34], [760, 470, 46], [890, 90, 22], [420, 540, 28], [610, 200, 18]].forEach(function (s) {
      var st = q.createRadialGradient(s[0], s[1], s[2] * 0.2, s[0], s[1], s[2]); st.addColorStop(0, 'rgba(170,120,60,0.05)'); st.addColorStop(0.85, 'rgba(160,110,50,0.1)'); st.addColorStop(1, 'rgba(120,80,40,0)');
      q.fillStyle = st; q.beginPath(); q.arc(s[0], s[1], s[2], 0, TAU); q.fill();
      q.strokeStyle = 'rgba(130,90,45,0.12)'; q.lineWidth = 1.2; q.beginPath(); q.arc(s[0], s[1], s[2] * 0.86, 0, TAU); q.stroke();
    });
    q.save(); q.translate(820, 300); q.rotate(0.06);   // darned patch
    q.fillStyle = 'rgba(225,205,165,0.9)'; q.fillRect(-34, -26, 68, 52);
    q.strokeStyle = 'rgba(110,80,50,0.35)'; q.lineWidth = 0.8;
    for (i = -34; i <= 34; i += 3) { q.beginPath(); q.moveTo(i, -28); q.lineTo(i + (R() - 0.5) * 2, 28); q.stroke(); }
    for (i = -26; i <= 26; i += 3) { q.beginPath(); q.moveTo(-36, i); q.lineTo(36, i + (R() - 0.5) * 2); q.stroke(); }
    q.restore();
    for (i = 0; i < 7; i++) {   // creases from the chest it was kept in
      var x0 = R() * tw, y0 = R() * th, a = R() * Math.PI, len = 120 + R() * 300;
      q.lineWidth = 3 + R() * 4; q.strokeStyle = 'rgba(255,250,235,0.10)'; q.beginPath(); q.moveTo(x0, y0); q.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); q.stroke();
      q.lineWidth = 1.5; q.strokeStyle = 'rgba(110,80,45,0.10)'; q.beginPath(); q.moveTo(x0 + 3, y0 + 3); q.lineTo(x0 + Math.cos(a) * len + 3, y0 + Math.sin(a) * len + 3); q.stroke();
    }
    clothTex = ct;
    grainTex = makeCanvas(256, 256); var gq = grainTex.getContext('2d'), im = gq.createImageData(256, 256);
    for (i = 0; i < 256 * 256; i++) { var v = R() * 255; im.data[i * 4] = v; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    gq.putImageData(im, 0, 0);
    // the people in the room: grandmother on her low stool (facing the sheet), Đorđe on the floor
    people = {
      gma: shape([
        [[-140, -162], [-150, -120], [-145, -60], [-156, -8, 1], [-92, -5, 1], [-62, -8, 1], [-70, -60], [-62, -104], [20, -110], [72, -118, 1], [88, -170], [84, -230], [72, -300], [44, -366], [12, -404], [-22, -424], [-62, -410], [-78, -372], [-72, -322], [-58, -272], [-64, -214], [-104, -184]],
        ell(-62, -462, 40, 46, 16),
        [[-30, -514], [10, -492], [32, -452], [44, -392, 1], [14, -412], [-14, -430], [-60, -420], [-98, -440], [-104, -488], [-74, -516]],
        [[-98, -462], [-114, -442, 1], [-97, -432]],
        [[40, -372], [72, -330], [82, -270, 1], [58, -300]],
        [[-182, -2, 1], [-160, -12], [-130, -10], [-120, 0, 1]],
        rect(-44, -126, 74, -110), rect(-36, -110, -24, 0), rect(54, -110, 66, 0)
      ], 1.5),
      gmaArm: shape([[[10, -10], [-22, 14], [-120, 92], [-236, 132], [-266, 142], [-276, 158], [-248, 160], [-128, 122], [-26, 52], [24, 26]], ell(-262, 150, 22, 14, 12)], 1.2),
      dj: shape([
        [[-80, 0, 1], [-95, -50], [-90, -120], [-76, -178], [-56, -214], [-26, -232], [6, -226], [26, -206], [62, -196], [110, -190], [134, -172], [140, -142], [132, -92], [138, -32], [168, -8, 1], [164, 2, 1], [40, 2, 1]]
      ], 1.5),
      djHead: shape([
        ell(0, -46, 42, 45, 16),
        [[-44, -50], [-50, -78], [-32, -100, 1], [-16, -92], [-6, -106, 1], [10, -94], [28, -104, 1], [36, -86], [50, -70], [42, -58]],
        [[38, -50], [55, -34, 1], [38, -27]]
      ], 1.2),
      djArm: shape([[[-16, -8], [16, -10], [70, 16], [130, 24], [152, 36], [150, 52], [120, 50], [60, 40], [-12, 18]]], 1.2)
    };
  }

  /* -------- figures -------- */
  var PAPER = '#0f0a07';
  function pin(gg, x, y, r) {
    r = r || 1.9;
    gg.fillStyle = '#7d5e2e'; gg.beginPath(); gg.arc(x, y, r, 0, TAU); gg.fill();
    gg.fillStyle = 'rgba(245,214,150,0.9)'; gg.beginPath(); gg.arc(x - r * 0.3, y - r * 0.3, r * 0.42, 0, TAU); gg.fill();
    gg.fillStyle = PAPER;
  }
  function thread(gg, mode, seed) {
    var w1 = Math.sin(clock * 1.7 + seed) * 6, w2 = Math.sin(clock * 1.1 + seed * 2) * 9;
    gg.save(); gg.lineWidth = 0.7; gg.strokeStyle = mode === 'paper' ? 'rgba(25,15,10,0.85)' : '#000';
    gg.beginPath(); gg.moveTo(0, -66); gg.bezierCurveTo(8 + w1, -82, 14 + w2, -40, 6 + w2 * 0.6, -18); gg.stroke(); gg.restore();
  }
  function drawPart(gg, pt, ang, mode, acc, p) {
    if (p.hideP && p.hideP[pt.name]) return;
    gg.save();
    gg.translate(pt.pv[0], pt.pv[1]);
    var a = pt.hang ? -acc : (ang[pt.name] || 0);
    if (a) gg.rotate(a);
    if (pt.metal && mode === 'paper') {
      gg.fillStyle = '#26262b'; gg.fill(pt.path);
      gg.strokeStyle = 'rgba(235,228,212,0.85)'; gg.lineWidth = 0.55; gg.beginPath(); gg.moveTo(0.35, -59); gg.lineTo(0.35, 7); gg.stroke();
      gg.fillStyle = 'rgba(200,185,150,0.9)'; gg.beginPath(); gg.ellipse(0, -66, 0.6, 2.6, 0, 0, TAU); gg.fill();
      thread(gg, mode, p.id); gg.fillStyle = PAPER;
    } else {
      gg.fill(pt.path);
      if (pt.metal) thread(gg, mode, p.id);
    }
    for (var i = 0; i < pt.ch.length; i++) drawPart(gg, pt.ch[i], ang, mode, acc + a, p);
    if (mode === 'paper') for (i = 0; i < pt.ch.length; i++) if (pt.ch[i].pin) pin(gg, pt.ch[i].pv[0], pt.ch[i].pv[1]);
    gg.restore();
  }
  function drawFigure(gg, p, q, M, mode) {
    gg.save();
    gg.setTransform(gg.getTransform().multiply(M));
    if (p.holes) gg.clip(p.holes, 'evenodd');
    drawPart(gg, p.root, q.ang, mode, 0, p);
    if (mode === 'paper') for (var i = 0; i < p.pins.length; i++) pin(gg, p.pins[i][0], p.pins[i][1], 2.2);
    gg.restore();
  }
  function rodEnds(p, q) {
    return p.rods.map(function (r) {
      var M = r[2] ? partMatrix(p, q, r[2]) : paperMatrix(q), a = pt(M, r[0], r[1]);
      var bx = a[0] + (p.rodTilt === undefined ? (a[0] - S.lamp.x) * 0.04 : p.rodTilt);
      return [a, [bx, 336]];
    });
  }
  function drawShadows(gg, k, sup) {
    gg.setTransform(1, 0, 0, 1, 0, 0); gg.globalCompositeOperation = 'source-over'; gg.globalAlpha = 1;
    gg.clearRect(0, 0, gg.canvas.width, gg.canvas.height);
    worldT(gg, k);
    gg.fillStyle = '#000'; gg.strokeStyle = '#000';
    var any = false, L = S.lamp, base = gg.getTransform();
    S.puppets.forEach(function (p) {
      if (!p.cast || p.sh.hide || p.hidden || !!p.sh.sup !== sup) return;
      var a = p.sh.alpha * (p.paper && !p.sh.own ? p.alpha : 1); if (a <= 0.01) return;
      any = true;
      var q = shadowPose(p), M = shadowMatrix(p, q);
      if (sup && p.sh.wob > 0.05) {   // the living edge: a few restless copies
        for (var i = 0; i < 3; i++) {
          gg.globalAlpha = a * 0.28;
          var o = new DOMMatrix().translateSelf(vnoise(clock * 2.3 + i * 7 + p.id) * 5 * p.sh.wob, vnoise(clock * 1.9 + i * 3 + p.id) * 4 * p.sh.wob);
          drawFigure(gg, p, q, o.multiply(M), 'shadow');
        }
      }
      gg.globalAlpha = a;
      drawFigure(gg, p, q, M, 'shadow');
      if (p.paper && p.rods.length && !p.sh.frozen && !sup && p.sh.dx === 0) {   // the rods throw thin shadows too
        var m = L.D / Math.max(30, L.D - p.d);
        gg.save(); gg.translate(L.x, L.y); gg.scale(m, m); gg.translate(-L.x, -L.y);
        gg.lineWidth = 1.6; gg.beginPath();
        rodEnds(p, p.disp).forEach(function (r) { gg.moveTo(r[0][0], r[0][1]); gg.lineTo(r[1][0], r[1][1]); });
        gg.stroke(); gg.restore();
      }
      gg.setTransform(base);
    });
    var hs = S.handShadow;
    if (!sup && hs.on && hs.alpha > 0.01) {
      any = true; gg.globalAlpha = hs.alpha;
      gg.save(); gg.translate(hs.x, hs.y); gg.rotate(hs.rot); gg.scale(hs.s, hs.s); gg.fill(lib().handOpen); gg.restore();
    }
    gg.globalAlpha = 1;
    if (!any) return false;
    gg.setTransform(1, 0, 0, 1, 0, 0);
    gg.globalCompositeOperation = 'source-in';
    gg.fillStyle = sup ? '#0a0503' : '#2c180c'; gg.fillRect(0, 0, gg.canvas.width, gg.canvas.height);
    gg.globalCompositeOperation = 'source-over';
    return true;
  }
  function drawPaper(gg) {
    var L = S.lamp, list = S.puppets.filter(function (p) { return p.paper && !p.hidden && p.alpha > 0.01; }).sort(function (a, b) { return a.z - b.z; });
    gg.save(); gg.beginPath(); gg.rect(-478, -345, 956, 700); gg.clip();
    var base = gg.getTransform();
    list.forEach(function (p) {
      var q = p.disp;
      gg.globalAlpha = p.alpha;
      if (p.rods.length) {   // thin wooden rods down past the frame
        gg.lineCap = 'round';
        rodEnds(p, q).forEach(function (r) {
          gg.strokeStyle = '#24170e'; gg.lineWidth = 2.2; gg.beginPath(); gg.moveTo(r[0][0], r[0][1]); gg.lineTo(r[1][0], r[1][1]); gg.stroke();
          gg.strokeStyle = 'rgba(210,150,90,0.25)'; gg.lineWidth = 0.6; gg.beginPath(); gg.moveTo(r[0][0] - 0.6, r[0][1]); gg.lineTo(r[1][0] - 0.6, r[1][1]); gg.stroke();
        });
      }
      var M = paperMatrix(q);
      // the cut edge catches the lamp: a faint warm rim on the side facing the flame
      var dx = clamp((L.x - q.x) / 400, -1, 1) * 0.9, dy = 0.7;
      gg.fillStyle = 'rgba(150,96,52,0.55)';
      drawFigure(gg, p, q, new DOMMatrix().translateSelf(dx, dy).multiply(M), 'rim');
      gg.fillStyle = PAPER;
      drawFigure(gg, p, q, M, 'paper');
      if (p.rods.length) rodEnds(p, q).forEach(function (r) { pin(gg, r[0][0], r[0][1], 1.7); });
      gg.setTransform(base);
    });
    gg.globalAlpha = 1;
    gg.restore();
  }

  /* -------- the room, the frame, the lamp, the people -------- */
  function rimFill(gg, path, dx, dy, rim) {
    gg.fillStyle = rim; gg.fill(path);
    gg.save(); gg.translate(dx, dy); gg.fillStyle = '#0c0806'; gg.fill(path); gg.restore();
  }
  function drawRoom(gg, I) {
    var rv = S.room;
    var wall = gg.createLinearGradient(0, -700, 0, 560);
    wall.addColorStop(0, '#20160f'); wall.addColorStop(0.6, '#3a291d'); wall.addColorStop(1, '#2e2117');
    gg.fillStyle = wall; gg.fillRect(-3000, -1600, 6000, 2140);
    gg.fillStyle = 'rgba(0,0,0,0.25)';
    for (var i = -2900; i < 3000; i += 230) gg.fillRect(i + hash(i) * 60, -1600, 3, 2140);   // old plaster seams
    gg.fillStyle = '#140d09'; gg.fillRect(-3000, -720, 6000, 70);   // beam
    var fl = gg.createLinearGradient(0, 540, 0, 1100); fl.addColorStop(0, '#2c1f15'); fl.addColorStop(1, '#120c08');
    gg.fillStyle = fl; gg.fillRect(-3000, 540, 6000, 900);
    gg.strokeStyle = 'rgba(0,0,0,0.35)'; gg.lineWidth = 2;
    for (i = -3000; i < 3000; i += 120) { gg.beginPath(); gg.moveTo(i, 540); gg.lineTo(i * 1.6, 1200); gg.stroke(); }
    // a woven ćilim on the wall behind grandmother
    gg.save(); gg.translate(1090, -260);
    gg.fillStyle = '#4a201a'; gg.fillRect(-170, -190, 340, 380);
    gg.strokeStyle = 'rgba(190,140,70,0.35)'; gg.lineWidth = 6;
    for (var r = 0; r < 3; r++) { gg.beginPath(); var cy = -120 + r * 120; gg.moveTo(-120, cy); gg.lineTo(0, cy - 50); gg.lineTo(120, cy); gg.lineTo(0, cy + 50); gg.closePath(); gg.stroke(); }
    gg.fillStyle = 'rgba(20,10,8,0.6)'; for (r = 0; r < 3; r++) { gg.beginPath(); gg.moveTo(-40, -120 + r * 120); gg.lineTo(0, -140 + r * 120); gg.lineTo(40, -120 + r * 120); gg.lineTo(0, -100 + r * 120); gg.fill(); }
    gg.strokeStyle = 'rgba(160,120,70,0.4)'; gg.lineWidth = 2; for (i = -165; i < 170; i += 10) { gg.beginPath(); gg.moveTo(i, 190); gg.lineTo(i + 2, 214); gg.stroke(); }
    gg.restore();
    // the icon corner with a red kandilo
    gg.save(); gg.translate(-1180, -520);
    gg.fillStyle = '#3b2c18'; gg.fillRect(-52, -70, 104, 132);
    gg.fillStyle = '#6e5428'; gg.fillRect(-42, -60, 84, 112);
    gg.fillStyle = '#2a1d10'; gg.beginPath(); gg.ellipse(0, -18, 16, 18, 0, 0, TAU); gg.fill(); gg.fillRect(-26, 0, 52, 52);
    gg.fillStyle = 'rgba(220,180,90,0.35)'; gg.beginPath(); gg.arc(0, -22, 26, 0, TAU); gg.fill();
    gg.strokeStyle = '#1c130b'; gg.lineWidth = 2; gg.beginPath(); gg.moveTo(0, 62); gg.lineTo(0, 110); gg.stroke();
    gg.fillStyle = '#7a1410'; gg.beginPath(); gg.ellipse(0, 122, 13, 15, 0, 0, TAU); gg.fill();
    gg.restore();
    // shelf with jugs high on the left wall
    gg.fillStyle = '#1d140d'; gg.fillRect(-1500, -340, 420, 14);
    [[-1450, 60, 46], [-1360, 44, 38], [-1260, 70, 52], [-1170, 40, 30]].forEach(function (j) {
      gg.beginPath(); gg.ellipse(j[0], -340 - j[1] * 0.45, j[2] * 0.5, j[1] * 0.45, 0, 0, TAU); gg.fill(); gg.fillRect(j[0] - j[2] * 0.18, -340 - j[1] * 1.05, j[2] * 0.36, j[1] * 0.3);
    });
    // the table and the box of puppets
    gg.fillStyle = '#2a1c12'; gg.fillRect(-640, 300, 1280, 20);
    gg.fillStyle = '#1a110b'; gg.fillRect(-640, 320, 1280, 26);
    gg.fillRect(-600, 346, 34, 194); gg.fillRect(566, 346, 34, 194);
    gg.fillStyle = 'rgba(255,190,120,0.18)'; gg.fillRect(-640, 300, 1280, 3);
    gg.fillStyle = '#21160e'; gg.fillRect(500, 262, 120, 38); gg.fillStyle = 'rgba(255,190,120,0.12)'; gg.fillRect(500, 262, 120, 3);
    gg.fillStyle = PAPER; gg.beginPath(); gg.moveTo(520, 262); gg.lineTo(530, 236); gg.lineTo(540, 262); gg.moveTo(560, 262); gg.lineTo(572, 228); gg.lineTo(580, 262); gg.fill();
  }
  function drawFrame(gg, I, posts) {
    var L = S.lamp;
    function bar(x, y, w, h, vert) {
      var gr = vert ? gg.createLinearGradient(x, 0, x + w, 0) : gg.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, '#2a1b10'); gr.addColorStop(0.45, '#4a3220'); gr.addColorStop(1, '#22160d');
      gg.fillStyle = gr; gg.fillRect(x, y, w, h);
      gg.strokeStyle = 'rgba(15,8,4,0.45)'; gg.lineWidth = 1;
      var R = rng((x * 7 + y * 3) | 0);
      for (var i = 0; i < 9; i++) { gg.beginPath(); if (vert) { var gx = x + 2 + R() * (w - 4); gg.moveTo(gx, y); gg.bezierCurveTo(gx + 3, y + h * 0.3, gx - 3, y + h * 0.6, gx + 1, y + h); } else { var gy = y + 2 + R() * (h - 4); gg.moveTo(x, gy); gg.bezierCurveTo(x + w * 0.3, gy + 2, x + w * 0.6, gy - 2, x + w, gy + 1); } gg.stroke(); }
    }
    if (posts) {
      bar(-490, -350, 24, 650, true); bar(466, -350, 24, 650, true);
      gg.fillStyle = '#120a06';
      [[-478, -337], [478, -337], [-478, 241], [478, 241]].forEach(function (c) { gg.beginPath(); gg.arc(c[0], c[1], 5, 0, TAU); gg.fill(); });
      var lg0 = gg.createRadialGradient(L.x, L.y, 10, L.x, L.y, 520);
      lg0.addColorStop(0, 'rgba(255,170,90,' + 0.35 * I + ')'); lg0.addColorStop(1, 'rgba(255,170,90,0)');
      gg.globalCompositeOperation = 'lighter'; gg.fillStyle = lg0; gg.fillRect(-490, -350, 24, 650); gg.fillRect(466, -350, 24, 650);
      gg.globalCompositeOperation = 'source-over';
      return;
    }
    bar(-506, -350, 1012, 26, false); bar(-490, 230, 980, 22, false);
    gg.strokeStyle = 'rgba(220,200,160,0.55)'; gg.lineWidth = 1.2;   // cords tying the sheet
    [[-466, -324, CLOTH.x0 + 4, CLOTH.y0 + 4], [-150, -324, -150, CLOTH.y0], [150, -324, 150, CLOTH.y0], [466, -324, CLOTH.x1 - 4, CLOTH.y0 + 4], [-466, 232, CLOTH.x0 + 4, CLOTH.y1 - 4], [466, 232, CLOTH.x1 - 4, CLOTH.y1 - 4]].forEach(function (c) {
      gg.beginPath(); gg.moveTo(c[0], c[1]); gg.lineTo(c[2], c[3]); gg.stroke();
    });
    // the lamp lights the lower bars
    var lg = gg.createRadialGradient(L.x, L.y, 10, L.x, L.y, 520);
    lg.addColorStop(0, 'rgba(255,170,90,' + 0.35 * I + ')'); lg.addColorStop(1, 'rgba(255,170,90,0)');
    gg.globalCompositeOperation = 'lighter'; gg.fillStyle = lg;
    gg.fillRect(-490, 230, 980, 22);
    gg.globalCompositeOperation = 'source-over';
  }
  function drawCloth(gg, I, haveSh, haveSup) {
    var L = S.lamp, c = CLOTH;
    gg.save();
    gg.clip(clothPath);
    gg.drawImage(clothTex, c.x0 - 6, c.y0 - 6, c.x1 - c.x0 + 12, c.y1 - c.y0 + 12);
    gg.globalCompositeOperation = 'multiply';
    var lg = gg.createRadialGradient(L.x, L.y - 30, 20, L.x, L.y - 60, 860);
    lg.addColorStop(0, '#fff3dc'); lg.addColorStop(0.3, '#f4d6a4'); lg.addColorStop(0.62, '#b98552'); lg.addColorStop(1, '#4a2c18');
    gg.fillStyle = lg; gg.fillRect(c.x0 - 10, c.y0 - 10, c.x1 - c.x0 + 20, c.y1 - c.y0 + 20);
    gg.globalCompositeOperation = 'source-over';
    gg.fillStyle = 'rgba(20,10,4,' + clamp(1 - I, 0, 1) * 0.9 + ')'; gg.fillRect(c.x0 - 10, c.y0 - 10, c.x1 - c.x0 + 20, c.y1 - c.y0 + 20);
    gg.setTransform(1, 0, 0, 1, 0, 0);
    if (haveSh) { gg.globalAlpha = 0.66; gg.drawImage(shC, 0, 0, cv.width, cv.height); }
    if (haveSup) { gg.globalAlpha = 0.93; gg.drawImage(supC, 0, 0, cv.width, cv.height); }
    gg.globalAlpha = 1;
    worldT(gg, 1);
    if (S.white > 0.01) { gg.fillStyle = 'rgba(255,244,220,' + S.white + ')'; gg.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0); }
    // soft hot glow where the flame is nearest
    gg.globalCompositeOperation = 'lighter';
    var hg = gg.createRadialGradient(L.x, L.y - 40, 0, L.x, L.y - 40, 380);
    hg.addColorStop(0, 'rgba(255,190,110,' + 0.16 * I + ')'); hg.addColorStop(1, 'rgba(255,190,110,0)');
    gg.fillStyle = hg; gg.fillRect(c.x0, c.y0, c.x1 - c.x0, c.y1 - c.y0);
    gg.globalCompositeOperation = 'source-over';
    gg.restore();
    gg.save(); gg.strokeStyle = 'rgba(80,50,25,0.5)'; gg.lineWidth = 2; gg.stroke(clothPath); gg.restore();
  }
  function drawLamp(gg, I) {
    var L = S.lamp, x = L.x;
    gg.save();
    var glow = gg.createRadialGradient(x, L.y, 0, x, L.y, 260);
    glow.addColorStop(0, 'rgba(255,200,120,' + 0.55 * I + ')'); glow.addColorStop(0.25, 'rgba(255,150,70,' + 0.16 * I + ')'); glow.addColorStop(1, 'rgba(255,140,60,0)');
    gg.globalCompositeOperation = 'lighter'; gg.fillStyle = glow; gg.fillRect(x - 260, L.y - 260, 520, 520); gg.globalCompositeOperation = 'source-over';
    gg.fillStyle = '#1b130c'; gg.fillRect(x - 17, 294, 34, 7);
    var fg = gg.createRadialGradient(x - 8, 276, 2, x, 282, 26);
    fg.addColorStop(0, 'rgba(255,215,150,0.75)'); fg.addColorStop(0.4, 'rgba(150,80,30,0.85)'); fg.addColorStop(1, 'rgba(50,25,10,0.95)');
    gg.fillStyle = fg; gg.beginPath(); gg.ellipse(x, 280, 24, 16, 0, 0, TAU); gg.fill();
    gg.fillStyle = '#5b4220'; gg.fillRect(x - 11, 258, 22, 9); gg.fillStyle = 'rgba(255,220,150,0.6)'; gg.fillRect(x - 11, 258, 22, 2);
    gg.fillStyle = '#3a2a16'; gg.fillRect(x - 7, 252, 14, 7);
    var f = (0.85 + 0.15 * vnoise(clock * 9)) * Math.min(1, L.on * 1.2) * (1 - L.flick * 0.4 * Math.max(0, vnoise(clock * 21)));
    if (f > 0.02) {
      var fh = 17 * f, sw = vnoise(clock * 5) * 1.5;
      var fl = gg.createLinearGradient(x, 248, x, 248 - fh);
      fl.addColorStop(0, 'rgba(120,160,255,0.8)'); fl.addColorStop(0.2, 'rgba(255,250,220,1)'); fl.addColorStop(0.7, 'rgba(255,190,80,0.95)'); fl.addColorStop(1, 'rgba(255,120,40,0)');
      gg.fillStyle = fl; gg.beginPath(); gg.moveTo(x - 4.5, 248); gg.quadraticCurveTo(x - 5, 248 - fh * 0.5, x + sw, 248 - fh); gg.quadraticCurveTo(x + 5, 248 - fh * 0.5, x + 4.5, 248); gg.closePath(); gg.fill();
    }
    gg.beginPath();   // glass chimney
    gg.moveTo(x - 8, 252); gg.bezierCurveTo(x - 17, 244, x - 16, 222, x - 7, 212); gg.lineTo(x - 8, 186); gg.lineTo(x + 8, 186); gg.lineTo(x + 7, 212); gg.bezierCurveTo(x + 16, 222, x + 17, 244, x + 8, 252); gg.closePath();
    gg.fillStyle = 'rgba(255,235,200,' + (0.06 + 0.06 * I) + ')'; gg.fill();
    gg.strokeStyle = 'rgba(255,230,190,' + (0.25 + 0.3 * I) + ')'; gg.lineWidth = 0.9; gg.stroke();
    gg.strokeStyle = 'rgba(255,255,240,0.45)'; gg.lineWidth = 1.2; gg.beginPath(); gg.moveTo(x - 11, 244); gg.quadraticCurveTo(x - 13, 230, x - 6, 216); gg.stroke();
    if (L.can) {   // a faint ring: you may take it
      gg.strokeStyle = 'rgba(255,220,160,' + (0.25 + 0.2 * Math.sin(clock * 4)) + ')'; gg.lineWidth = 1.5; gg.setLineDash([4, 5]);
      gg.beginPath(); gg.ellipse(x, 246, 40, 64, 0, 0, TAU); gg.stroke(); gg.setLineDash([]);
    }
    gg.restore();
  }
  function drawHands(gg, I) {
    var L = S.lamp, HP = lib().hand;
    if (S.endShot) return;
    S.puppets.forEach(function (p) {
      if (!p.held || p.hidden || !p.rods.length) return;
      var r = rodEnds(p, p.disp)[0], side = p.held === 'L' ? -1 : 1;
      gg.save(); gg.translate(r[1][0], 322); gg.scale(1.05 * side, 1.05);
      rimFill(gg, HP, (r[1][0] > L.x ? 2.5 : -2.5) * side, 2, 'rgba(255,170,100,' + (0.35 + 0.4 * I) + ')');
      gg.restore();
    });
  }
  function drawPeople(gg, I) {
    var L = S.lamp, rim = 'rgba(255,160,90,' + (0.25 + 0.45 * Math.min(1, I)) * (0.25 + 0.75 * S.room) + ')';
    if (S.gma.show !== false) {
      gg.save(); gg.translate(800, 540);
      rimFill(gg, people.gma, 6, -2, rim);
      gg.save(); gg.translate(-20, -400); gg.rotate(S.gma.arm);
      rimFill(gg, people.gmaArm, 6, -2, rim); gg.restore();
      gg.restore();
    }
    // Đorđe, and (in the last shot) his shadow on the wall
    var D = S.dj;
    gg.save(); gg.translate(-700, 540); gg.scale(1.18, 1.18);
    rimFill(gg, people.dj, -6, -2, rim);
    gg.save(); gg.translate(-10, -228); gg.scale(D.headFlip === undefined ? 1 : D.headFlip, 1); gg.rotate(D.head); rimFill(gg, people.djHead, -5, -2, rim); gg.restore();
    gg.save(); gg.translate(-30, -205); gg.rotate(-D.arm); rimFill(gg, people.djArm, -5, -2, rim); gg.restore();
    gg.restore();
  }
  function djShadowPose(lag) {
    var h = S.djHist, tt = clock - lag;
    for (var i = h.length - 1; i >= 0; i--) if (h[i].t <= tt) return h[i];
    return h[0] || { headFlip: 1, head: 0, arm: 0 };
  }
  function drawDjShadow(gg, I) {
    if (!S.djShadow.on) return;
    var q = djShadowPose(S.djShadow.lag || 0);
    gg.save();
    gg.translate(-1080, 520); gg.transform(1, 0, -0.18, 1, 0, 0); gg.scale(1.45, 1.45);
    gg.globalAlpha = 0.55 * Math.min(1, I) * S.djShadow.on;
    gg.fillStyle = '#0a0604';
    gg.fill(people.dj);
    gg.save(); gg.translate(-10, -228); gg.scale(q.headFlip, 1); gg.rotate(q.head); gg.fill(people.djHead); gg.restore();
    gg.save(); gg.translate(-30, -205); gg.rotate(-q.arm); gg.fill(people.djArm); gg.restore();
    gg.restore();
  }

  function render() {
    var I = lampI(), L = S.lamp;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
    var haveSh = drawShadows(shG, SHK, false), haveSup = drawShadows(supG, 0.5, true);
    worldT(g, 1);
    drawRoom(g, I);
    if (S.endShot) {
      // the wall around Đorđe takes the lamp's light; his own shadow sits on it
      var wl = g.createRadialGradient(L.x, L.y, 40, L.x - 600, 200, 1300);
      wl.addColorStop(0, 'rgba(255,180,110,' + 0.25 * I + ')'); wl.addColorStop(1, 'rgba(255,180,110,0)');
      g.globalCompositeOperation = 'lighter'; g.fillStyle = wl; g.fillRect(-1800, -700, 1700, 1240); g.globalCompositeOperation = 'source-over';
      drawDjShadow(g, I);
    }
    drawCloth(g, I, haveSh, haveSup);
    drawFrame(g, I);
    drawPaper(g);
    drawFrame(g, I, true);
    drawHands(g, I);
    drawPeople(g, I);
    if (S.spill > 0.01 && haveSup) {   // a shadow too big for the sheet spills over the frame, the wall and her hands
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      var ex = new Path2D(); ex.rect(0, 0, cv.width, cv.height);
      var cm = new DOMMatrix(); worldT(g, 1); cm = g.getTransform(); g.setTransform(1, 0, 0, 1, 0, 0);
      ex.addPath(clothPath, cm);
      g.clip(ex, 'evenodd');
      g.globalAlpha = S.spill; g.drawImage(supC, 0, 0, cv.width, cv.height);
      g.restore(); worldT(g, 1);
    }
    drawLamp(g, I);
    if (S.glints && S.glints.length) {
      S.glints = S.glints.filter(function (gl) { return clock - gl.t0 < 1.1; });
      g.save(); g.globalCompositeOperation = 'lighter';
      S.glints.forEach(function (gl) {
        var k = 1 - (clock - gl.t0) / 1.1, r = 6 + 22 * Math.sin(k * Math.PI);
        g.strokeStyle = 'rgba(255,248,225,' + k + ')'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(gl.x - r, gl.y); g.lineTo(gl.x + r, gl.y); g.moveTo(gl.x, gl.y - r); g.lineTo(gl.x, gl.y + r); g.stroke();
        var gd = g.createRadialGradient(gl.x, gl.y, 0, gl.x, gl.y, r * 0.7); gd.addColorStop(0, 'rgba(255,250,235,' + k + ')'); gd.addColorStop(1, 'rgba(255,250,235,0)');
        g.fillStyle = gd; g.fillRect(gl.x - r, gl.y - r, r * 2, r * 2);
      });
      g.restore();
    }
    // the room sinks into the dark around the lamp
    var dk = 1 - S.room;
    var rg = g.createRadialGradient(L.x, L.y - 80, 120, L.x, L.y - 80, 1500);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(0.32, 'rgba(0,0,0,' + (0.08 + 0.12 * dk) + ')');
    rg.addColorStop(0.6, 'rgba(0,0,0,' + (0.35 + 0.55 * dk) + ')');
    rg.addColorStop(1, 'rgba(0,0,0,' + (0.6 + 0.4 * dk) + ')');
    g.fillStyle = rg; g.fillRect(-4000, -3000, 8000, 6000);
    // screen space: warm grade, vignette, grain, fades, titles, captions
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    var fl = (1 - Math.min(1, I)) * 0.35; if (fl > 0.01) { g.fillStyle = 'rgba(0,0,0,' + fl + ')'; g.fillRect(0, 0, W, H); }
    var vg = g.createRadialGradient(W / 2, AY, Math.min(W, H) * 0.35, W / 2, AY, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.07;
    var gx = -hash(clock) * 256, gy = -hash(clock + 3) * 256;
    for (var x = gx; x < W; x += 256) for (var y = gy; y < H; y += 256) g.drawImage(grainTex, x, y);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(70,40,10,0.08)'; g.fillRect(0, 0, W, H);
    drawText(g);
    if (S.black > 0.001) { g.fillStyle = 'rgba(0,0,0,' + clamp(S.black, 0, 1) + ')'; g.fillRect(0, 0, W, H); }
  }
  function wrap(gg, text, maxW) {
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var tst = cur ? cur + ' ' + w : w; if (gg.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawText(gg) {
    var fs = clamp(Math.min(W, H) * 0.032, 13, 26);
    if (S.title.key && S.title.a > 0.01) {
      gg.save(); gg.globalAlpha = S.title.a; gg.textAlign = 'center'; gg.textBaseline = 'top';
      gg.font = 'italic ' + Math.round(fs * 1.05) + 'px Georgia, "Times New Roman", serif';
      gg.fillStyle = 'rgba(0,0,0,0.6)'; gg.fillText(t(S.title.key), W / 2 + 1, Math.max(12, H * 0.03) + 1);
      gg.fillStyle = '#ead7b0'; gg.fillText(t(S.title.key), W / 2, Math.max(12, H * 0.03));
      gg.restore();
    }
    S.caps.forEach(function (c) {
      var age = clock - c.t0, a = clamp(Math.min(age * 3, (c.dur - age) * 1.5), 0, 1);
      if (a <= 0) return;
      var sp = toScreen(c.x, c.y);
      gg.save(); gg.font = 'italic ' + Math.round(fs * 0.78) + 'px Georgia, serif';
      var lines = wrap(gg, t(c.key), Math.min(340, W * 0.7)), lh = fs * 1.02, wmax = 0;
      lines.forEach(function (l) { wmax = Math.max(wmax, gg.measureText(l).width); });
      var bx = clamp(sp[0] - wmax / 2 - 10, 8, W - wmax - 28), by = clamp(sp[1] - lines.length * lh - 22, 8, H - 40);
      gg.globalAlpha = a * 0.82; gg.fillStyle = 'rgba(14,9,6,0.85)'; gg.fillRect(bx, by, wmax + 20, lines.length * lh + 12);
      gg.strokeStyle = 'rgba(201,163,92,0.4)'; gg.strokeRect(bx + 0.5, by + 0.5, wmax + 19, lines.length * lh + 11);
      gg.globalAlpha = a; gg.fillStyle = '#cfd6e6'; gg.textBaseline = 'top';
      lines.forEach(function (l, i) { gg.fillText(l, bx + 10, by + 7 + i * lh); });
      gg.restore();
    });
    S.caps = S.caps.filter(function (c) { return clock - c.t0 < c.dur; });
    if (S.hint && S.hintA > 0.01) {
      gg.save(); gg.globalAlpha = S.hintA * (0.75 + 0.25 * Math.sin(clock * 3)); gg.textAlign = 'center';
      gg.font = Math.round(fs * 0.8) + 'px Georgia, serif';
      var lp = toScreen(S.lamp.x, 300), hy = clamp(lp[1] + fs * 2.2, H * 0.5, H - fs * 1.5);
      gg.fillStyle = 'rgba(0,0,0,0.65)'; var tw2 = gg.measureText(t(S.hint)).width; gg.fillRect(W / 2 - tw2 / 2 - 12, hy - fs * 0.9, tw2 + 24, fs * 1.4);
      gg.fillStyle = '#f0dcb0'; gg.fillText(t(S.hint), W / 2, hy);
      gg.restore();
    }
  }

  /* ---------------- sound: a grandmother's lullaby that sours, paper, wood, thread ---------------- */
  var A = BTS.Audio;
  var AU = { on: false, unease: 0, next: 0, idx: 0, timer: null, out: null, drone: null };
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function ready() { return A && A.ready && A.ctx; }
  // "Nini, sine" in D minor with a raised fourth here and there: [midi, beats]
  var MEL = [[69, 1], [70, 0.5], [69, 0.5], [67, 1], [65, 2], [67, 1], [69, 1], [67, 0.5], [65, 0.5], [64, 1], [62, 3],
    [62, 1], [65, 1], [67, 1], [69, 2], [70, 1], [69, 1], [68, 1], [65, 1], [64, 1.5], [65, 0.5], [64, 1], [62, 3], [0, 3]];
  function voice(t0, m, dur, v, cents, box) {
    var out = AU.out; if (!out) return;
    var f = mtof(m) * Math.pow(2, (cents || 0) / 1200);
    var gn = A.gain(0, out), lp = A.filter('lowpass', f * 5, 0.7, gn);
    var o = A.ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f, t0);
    if (AU.unease > 0.35 && Math.random() < AU.unease * 0.5) o.frequency.linearRampToValueAtTime(f * Math.pow(2, -(0.3 + AU.unease) / 12), t0 + dur);
    var vib = A.ctx.createOscillator(); vib.frequency.value = 4.8 + AU.unease * 2; var vg = A.gain(f * (0.006 + AU.unease * 0.01), o.frequency); vib.connect(vg);
    var o2 = A.ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2.003; var g2 = A.gain(0.07, lp); o2.connect(g2);
    o.connect(lp); [o, o2, vib].forEach(function (x) { x.start(t0); x.stop(t0 + dur + 0.6); });
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(v * 0.11, t0 + 0.08); gn.gain.setValueAtTime(v * 0.095, t0 + dur * 0.8); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.45);
    if (box) {   // music-box shimmer an octave up
      var bg = A.gain(0, out);
      [[2, 1], [5.4, 0.25], [8.9, 0.08]].forEach(function (pp) { var b = A.ctx.createOscillator(); b.frequency.value = f * pp[0] * Math.pow(2, (AU.unease * (Math.random() - 0.5) * 60) / 1200); var bgg = A.gain(pp[1], bg); b.connect(bgg); b.start(t0); b.stop(t0 + 2.4); });
      bg.gain.setValueAtTime(0.0001, t0); bg.gain.linearRampToValueAtTime(v * 0.035, t0 + 0.004); bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    }
  }
  function cradle(t0, m, v) {   // soft low pluck: the rocking "um-pa-pa"
    var out = AU.out; if (!out) return;
    var gn = A.gain(0, out), o = A.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
    var lp = A.filter('lowpass', 500, 0.6, gn); o.connect(lp); o.start(t0); o.stop(t0 + 1.3);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(v * 0.09, t0 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
  }
  function auSchedule() {
    if (!AU.on || !ready()) return;
    var now = A.now();
    if (AU.next < now) AU.next = now + 0.05;
    var beat = 0.6 * (1 + AU.unease * 0.35);
    while (AU.next < now + 0.7) {
      var n = MEL[AU.idx % MEL.length], tt = AU.next;
      var bar = Math.floor(AU.beatN || 0) % 3;
      if (n[0] && !(AU.unease > 0.55 && Math.random() < (AU.unease - 0.5) * 0.9)) {
        var m = n[0];
        if (AU.unease > 0.5 && Math.random() < 0.18) m += Math.random() < 0.5 ? -1 : 1;   // a sour note
        voice(tt, m, n[1] * beat * 0.95, 1 - AU.unease * 0.35, -AU.unease * 35 * Math.random(), AU.unease > 0.3 || AU.idx % 4 === 0);
      }
      // rocking accompaniment once per three beats
      var steps = Math.max(1, Math.round(n[1] * 2));
      for (var k = 0; k < steps; k++) {
        var bt = (AU.beatN || 0) + k * 0.5;
        if (Math.abs(bt - Math.round(bt)) < 0.01) { var pos = Math.round(bt) % 3; cradle(tt + k * beat * 0.5, pos === 0 ? 38 : 45 + (AU.unease > 0.6 ? -6 : 0), pos === 0 ? 1 : 0.55); }
      }
      AU.beatN = (AU.beatN || 0) + n[1];
      AU.next += n[1] * beat; AU.idx++;
    }
    if (AU.drone) {
      AU.drone.g.gain.setTargetAtTime(0.02 + AU.unease * 0.05, now, 1.5);
      AU.drone.d.gain.setTargetAtTime(Math.max(0, AU.unease - 0.35) * 0.09, now, 1.5);
    }
  }
  function auStart() {
    if (!ready() || AU.on) return;
    AU.on = true; AU.idx = 0; AU.beatN = 0; AU.next = A.now() + 0.3;
    AU.out = A.gain(0.0001, A.bus.music); AU.out.connect(A.gain(0.6, A.send.music));
    AU.out.gain.linearRampToValueAtTime(1, A.now() + 2);
    var dg = A.gain(0, AU.out), lp = A.filter('lowpass', 260, 0.7, dg);
    var oscs = [38, 45, 50].map(function (m) { var o = A.ctx.createOscillator(); o.type = m === 45 ? 'triangle' : 'sine'; o.frequency.value = mtof(m); o.detune.value = (Math.random() - 0.5) * 8; o.connect(lp); o.start(); return o; });
    var dd = A.gain(0, AU.out), dlp = A.filter('lowpass', 420, 1, dd);   // the unease: a semitone rubbing against the drone
    [39, 51.4].forEach(function (m) { var o = A.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.connect(dlp); o.start(); oscs.push(o); });
    AU.drone = { g: dg, d: dd, oscs: oscs };
    AU.timer = setInterval(auSchedule, 90);
    auSchedule();
  }
  function auStop(fade) {
    if (!AU.on) return;
    AU.on = false; clearInterval(AU.timer); AU.timer = null;
    if (!ready() || !AU.out) return;
    var t0 = A.now(), out = AU.out, dr = AU.drone, f = fade === undefined ? 1.5 : fade;
    out.gain.cancelScheduledValues(t0); out.gain.setValueAtTime(out.gain.value, t0); out.gain.linearRampToValueAtTime(0.0001, t0 + Math.max(0.02, f));
    setTimeout(function () { try { dr.oscs.forEach(function (o) { o.stop(); }); out.disconnect(); } catch (e) { } }, (f + 0.3) * 1000);
    AU.out = null; AU.drone = null;
  }
  function sOut(vol, rv) { return A.out('sfx', { vol: vol, reverb: rv === undefined ? 0.6 : rv }); }
  function sfxClick(v) {
    if (!ready()) return; var t0 = A.now(), out = sOut(v || 0.2, 0.3); if (!out) return;
    var gn = A.gain(0, out), bp = A.filter('bandpass', 1900 + Math.random() * 900, 4, gn); A.noiseSrc('white', t0, 0.05, bp);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(0.5, t0 + 0.002); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
    var o = A.osc('sine', 700 + Math.random() * 300, t0, 0.05, A.gain(0.12, out)); o.frequency.exponentialRampToValueAtTime(380, t0 + 0.04);
  }
  function sfxThread(dur, up) {
    if (!ready()) return; var t0 = A.now(), out = sOut(0.45, 0.8); if (!out) return; dur = dur || 1.4;
    var gn = A.gain(0, out), bp = A.filter('bandpass', up === false ? 3600 : 1300, 14, gn);
    A.noiseSrc('white', t0, dur + 0.1, bp);
    bp.frequency.exponentialRampToValueAtTime(up === false ? 1300 : 4200, t0 + dur);
    var tr = A.ctx.createOscillator(); tr.frequency.value = 23; var tg = A.gain(0.18, gn.gain); tr.connect(tg); tr.start(t0); tr.stop(t0 + dur + 0.1);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(0.35, t0 + dur * 0.4); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    var sq = A.osc('sine', 2400, t0, dur, A.gain(0.012, out)); sq.frequency.exponentialRampToValueAtTime(3400, t0 + dur);
  }
  function sfxGlint() {
    if (!ready()) return; var t0 = A.now(), out = sOut(0.3, 1.2); if (!out) return;
    [3520, 5280, 7040].forEach(function (f, i) { var gn = A.gain(0, out); A.osc('sine', f, t0 + i * 0.03, 1.2, gn); gn.gain.setValueAtTime(0.0001, t0 + i * 0.03); gn.gain.linearRampToValueAtTime(0.06 / (i + 1), t0 + i * 0.03 + 0.005); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1); });
  }
  function sfxSnip() { sfxClick(0.5); setTimeout(function () { sfxClick(0.4); }, 70); sfxThread(0.35, false); }
  function sfxWhoosh(v) {
    if (!ready()) return; var t0 = A.now(), out = sOut(v || 0.5, 0.5); if (!out) return;
    var gn = A.gain(0, out), bp = A.filter('bandpass', 400, 1.2, gn); A.noiseSrc('pink', t0, 0.7, bp);
    bp.frequency.exponentialRampToValueAtTime(2200, t0 + 0.25); bp.frequency.exponentialRampToValueAtTime(300, t0 + 0.6);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(0.6, t0 + 0.2); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
  }
  function sfxDissonance(dur, v) {
    if (!ready()) return; var t0 = A.now(), out = sOut(v || 0.5, 1.6); if (!out) return; dur = dur || 4;
    var gn = A.gain(0, out), lp = A.filter('lowpass', 650, 1.2, gn);
    [50, 51, 56.3].forEach(function (m) { var o = A.osc('sawtooth', mtof(m), t0, dur + 0.5, lp); o.frequency.linearRampToValueAtTime(mtof(m) * 0.985, t0 + dur); });
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.linearRampToValueAtTime(0.16, t0 + dur * 0.35); gn.gain.linearRampToValueAtTime(0.0001, t0 + dur);
  }
  function sfxWoof() {   // grandmother does the dog, softly
    if (!ready()) return; var t0 = A.now(), out = sOut(0.35, 0.5); if (!out) return;
    [0, 0.22].forEach(function (d) { var gn = A.gain(0, out), bp = A.filter('bandpass', 520, 2.5, gn); var o = A.osc('sawtooth', 210, t0 + d, 0.16, bp); o.frequency.exponentialRampToValueAtTime(140, t0 + d + 0.14); A.env(gn.gain, t0 + d, 0.015, 0.4, 0.03, 0.1); });
  }
  function sfxCrow() {   // and the rooster, as a whistled glide
    if (!ready()) return; var t0 = A.now(), out = sOut(0.25, 0.8); if (!out) return;
    var gn = A.gain(0, out), o = A.osc('triangle', 700, t0, 1.1, A.filter('lowpass', 2400, 0.7, gn));
    o.frequency.setValueAtTime(700, t0); o.frequency.linearRampToValueAtTime(980, t0 + 0.18); o.frequency.setValueAtTime(940, t0 + 0.5); o.frequency.linearRampToValueAtTime(620, t0 + 1);
    A.env(gn.gain, t0, 0.04, 0.3, 0.7, 0.25);
  }
  function play(name, o) { if (ready()) A.play(name, Object.assign({ caption: false }, o || {})); }
  var ambCut = false;
  function silenceAll(on) {
    if (!ready()) return;
    ambCut = on;
    if (on) A.bus.ambience.gain.setTargetAtTime(0.0001, A.now(), 0.25);
    else A.applyVolumes();
  }

  /* ---------------- looking at figures, taking the lamp ---------------- */
  function hitParts(p, q, M, X, Y) {
    var hit = false, base;
    worldT(g, 1); base = g.getTransform();
    (function walk(pt, N, acc) {
      if (hit || (p.hideP && p.hideP[pt.name])) return;
      var a = pt.hang ? -acc : (q.ang[pt.name] || 0);
      var K = N.translate(pt.pv[0], pt.pv[1]).rotate(a * 180 / Math.PI);
      g.setTransform(base.multiply(K));
      if (g.isPointInPath(pt.path, X, Y)) hit = true;
      pt.ch.forEach(function (c) { walk(c, K, acc + a); });
    })(p.root, M, 0);
    return hit;
  }
  function lookables() {
    return S.puppets.filter(function (p) { return !p.hidden && p.look && (p.paper ? p.alpha > 0.3 : (p.cast && !p.sh.hide && p.sh.alpha > 0.3)); });
  }
  function figureAt(px, py) {
    var X = px * DPR, Y = py * DPR, list = lookables().sort(function (a, b) { return (b.paper ? 1 : 0) - (a.paper ? 1 : 0) || b.z - a.z; }), found = null;
    g.save();
    for (var i = 0; i < list.length && !found; i++) {
      var p = list[i], q = p.paper ? p.disp : shadowPose(p), M = p.paper ? paperMatrix(q) : shadowMatrix(p, q);
      if (hitParts(p, q, M, X, Y)) found = p;
    }
    g.restore();
    if (found) return found;
    var best = null, bd = 30;   // forgiving taps on small figures
    list.forEach(function (p) { if (!p.paper) return; var c = toScreen(p.disp.x, p.disp.y - 30 * p.s), d = Math.hypot(c[0] - px, c[1] - py); if (d < bd) { bd = d; best = p; } });
    return best;
  }
  function headOf(p) {
    var q = p.paper ? p.disp : shadowPose(p), M = p.paper ? paperMatrix(q) : shadowMatrix(p, q);
    var h = { man: 150, woman: 140, child: 98, old: 116, witch: 192, rabbit: 40, dog: 40, rooster: 46, house: 120, well: 100, tree: 170, church: 105, moon: 22, needle: 75 }[p.kind] || 80;
    return pt(M, 0, -h);
  }
  function lookAt(p) {
    if (!p) return;
    p.react = 0.45;
    var k = p.kind;
    if (k === 'dog') sfxWoof(); else if (k === 'rooster') sfxCrow(); else if (k === 'needle') sfxGlint(); else if (k === 'rabbit') { p.earT = -0.3; setTimeout(function () { p.earT = 0; }, 400); play('paper', { vol: 0.4 }); }
    else if (!p.paper) play('whisper', { vol: 0.35, dur: 1 }); else sfxClick(0.35);
    if (k === 'well') { tw(p.ang, { sweep: 0.1 }, 0.6).then(function () { return tw(p.ang, { sweep: 0.42 }, 1.2); }); }
    var hp = headOf(p);
    S.caps = [{ key: 'theatre.look.' + (p.paper ? p.look : 'shadow'), x: hp[0], y: hp[1], t0: clock, dur: 4 }];
    var sc = S.cam, tok = S.lookTok = (S.lookTok || 0) + 1;
    tw(sc, { lx: clamp((hp[0] - sc.x) * 0.2, -90, 90), ly: clamp((hp[1] - sc.y) * 0.15, -60, 60), lz: 0.07 }, 0.9).then(function () { return wait(3.4); })
      .then(function () { if (S && S.lookTok === tok) tw(sc, { lx: 0, ly: 0, lz: 0 }, 1.4); });
  }
  var cycleI = 0;
  function cycleLook() {
    var list = lookables().filter(function (p) { var c = toScreen(p.paper ? p.disp.x : p.x, (p.paper ? p.disp.y : p.y) - 40); return c[0] > 0 && c[0] < W && c[1] > 0 && c[1] < H; }).sort(function (a, b) { return a.x - b.x; });
    if (!list.length) return;
    lookAt(list[cycleI++ % list.length]);
  }
  function overLamp(w, px) { var L = S.lamp, tol = 22 / camS(); return Math.abs(w[0] - L.x) < 40 + tol && w[1] > 170 - tol && w[1] < 312 + tol; }
  var keysDown = {};
  function onDown(e) {
    if (!S) return;
    e.preventDefault();
    BTS.Audio && BTS.Audio.resume && BTS.Audio.resume();
    if (e.pointerType === 'touch') S.touch = true;
    var w = toWorld(e.clientX, e.clientY);
    if (S.lamp.can && overLamp(w)) { S.lamp.drag = true; S.dragOff = S.lamp.x - w[0]; try { cv.setPointerCapture(e.pointerId); } catch (er) { } return; }
    var p = figureAt(e.clientX, e.clientY);
    if (p) { lookAt(p); return; }
    if (BTS.Dialogue.active && BTS.UI.dlg) BTS.UI.dlg.click();
  }
  function onMove(e) {
    if (!S) return;
    var w = toWorld(e.clientX, e.clientY);
    if (S.lamp.drag) { S.lamp.x = clamp(w[0] + (S.dragOff || 0), -420, 420); S.lamp.touched = true; return; }
    if (e.pointerType === 'mouse') cv.style.cursor = S.lamp.can && overLamp(w) ? 'grab' : (figureAt(e.clientX, e.clientY) ? 'pointer' : 'default');
  }
  function onUp() { if (S) S.lamp.drag = false; }
  function onKey(e) {
    if (!S) return;
    var down = e.type === 'keydown', c = e.code;
    if (c === 'ArrowLeft' || c === 'KeyA') keysDown.l = down;
    if (c === 'ArrowRight' || c === 'KeyD') keysDown.r = down;
    if (!down) return;
    var ks = BTS.Config.get('keys') || {};
    if ((ks.observe || ['KeyF']).indexOf(c) >= 0) cycleLook();
    if (S.lamp.can && !BTS.Dialogue.active && (ks.interact || ['KeyE', 'Space', 'Enter']).indexOf(c) >= 0) S.autoLamp = true;
  }
  function keyLamp(dt) {
    if (!S.lamp.can) return;
    var d = (keysDown.r ? 1 : 0) - (keysDown.l ? 1 : 0);
    if (d) { S.lamp.x = clamp(S.lamp.x + d * 260 * dt, -420, 420); S.lamp.touched = true; }
  }

  /* ---------------- the frame loop ---------------- */
  var raf = 0, lastT = 0, frameErr = 0;
  function step(dt) {
    tick(dt); clickBudget -= dt;
    keyLamp(dt);
    for (var i = 0; i < S.hooks.length; i++) S.hooks[i](dt);
    S.puppets.forEach(function (p) { livePuppet(p, dt); });
    S.djHist.push({ t: clock, headFlip: S.dj.headFlip, head: S.dj.head, arm: S.dj.arm });
    while (S.djHist.length > 2 && S.djHist[0].t < clock - 2) S.djHist.shift();
  }
  function frame(now) {
    if (!TH.active) return;
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now;
    if (BTS.UI && BTS.UI.stack && BTS.UI.stack.length) dt = 0;   // the pause menu / journal stops the show
    dt *= TH.speed * (TH.from && (S.act || 0) < TH.from ? 25 : 1);
    try { step(dt); render(); frameErr = 0; } catch (e) { BTS.Log.error('theatre frame', e); if (++frameErr > 5) { TH.aborted = true; finishNow(); } }
  }
  function hook(fn) { S.hooks.push(fn); return function () { var i = S.hooks.indexOf(fn); if (i >= 0) S.hooks.splice(i, 1); }; }

  /* ---------------- stagecraft helpers ---------------- */
  var ABORT = { abort: true };
  function say(id) {
    if (TH.aborted) return Promise.reject(ABORT);
    if (TH.from && (S.act || 0) < TH.from) return wait(0.5);   // dev: ?test=theatre&from=N fast-forwards
    return BTS.Dialogue.start(id).then(function (r) { if (r === 'abort' || TH.aborted || (BTS.Game && BTS.Game.mode !== 'play' && !TH.test)) { TH.aborted = true; throw ABORT; } return r; });
  }
  function cam(x, y, z, dur, ease) { return tw(S.cam, { x: x, y: y, z: z }, dur, ease || 'io'); }
  function title(n) {
    S.title.key = 'theatre.act' + n; S.title.a = 0;
    tw(S.title, { a: 1 }, 1.2).then(function () { return wait(4.5); }).then(function () { if (S && S.title.key === 'theatre.act' + n) tw(S.title, { a: 0 }, 1.6); });
  }
  function place(p, delay) {   // pinned onto the sheet with a little drop and a click
    p.alpha = 0; var y = p.y; p.y = y - 26; add(p);
    return wait(delay || 0).then(function () { p.alpha = 1; play('paper', { vol: 0.35 }); return tw(p, { y: y }, 0.32, 'back'); }).then(function () { sfxClick(0.3); });
  }
  function take(p) { if (!p) return Promise.resolve(); play('paper', { vol: 0.3 }); return tw(p, { y: p.y - 30, alpha: 0 }, 0.3, 'in').then(function () { remove(p); }); }
  function walk(p, x, speed, ease) {
    if (Math.abs(x - p.x) > 1) p.flip = x > p.x ? 1 : -1;
    return tw(p, { x: x }, Math.abs(x - p.x) / (speed || 40), ease || 'lin');
  }
  /* grandmother's hand passes between lamp and sheet: a big soft shadow; swap figures under it */
  function handSweep(dir, swap, dur) {
    dur = dur || 1.7; dir = dir || 1;
    var hs = S.handShadow;
    hs.on = true; hs.x = 620 * dir; hs.y = 120; hs.rot = -0.35 * dir; hs.s = 2.1; hs.alpha = 0.95;
    play('cloth', { vol: 0.8 }); setTimeout(function () { play('paper', { vol: 0.5 }); }, 300);
    tw(hs, { y: -40 }, dur * 0.5, 'out').then(function () { return tw(hs, { y: 140 }, dur * 0.5, 'in'); });
    tw(hs, { x: -620 * dir, rot: 0.2 * dir }, dur, 'io').then(function () { hs.on = false; });
    return wait(dur * 0.45).then(function () { if (swap) swap(); return wait(dur * 0.55); });
  }
  function glint(x, y) { S.glints = S.glints || []; S.glints.push({ x: x, y: y, t0: clock }); sfxGlint(); }
  function needleTip(p, part) { var M = partMatrix(p, p.disp, part || 'needle'); return pt(M, 0, 9); }
  function stolen(kind, x, flip) {
    var p = make[kind]({ x: x, y: FEET, flip: flip || 1, paper: false, z: 0, look: 'shadow' });
    p.sh.sup = true; p.sh.live = true; p.sh.alpha = 0; p.sh.wob = 0.5;
    return add(p);
  }
  var A_ = {};   // the cast of the current show

  /* ---------------- cues called from the dialogue scripts ---------------- */
  var CUES = {};
  function runCue(name) {
    if (!S || !TH.active) return;
    S.cue = name;
    var f = CUES[name]; if (!f) { BTS.Log.warn('theatre: no cue', name); return; }
    Promise.resolve().then(f).catch(function (e) { if (e !== ABORT) BTS.Log.error('theatre cue', name, e); });
  }
  /* ACT I */
  CUES.a1_walk = async function () {
    walk(A_.man, -150, 44); walk(A_.woman, 150, 46); walk(A_.child, 104, 44); walk(A_.dog, 64, 46);
    walk(A_.rabbit, 620, 110).then(function () { remove(A_.rabbit); });
    await wait(2.5); await walk(A_.old, 330, 20);
  };
  CUES.a1_stop = async function () {
    var m = A_.man;
    if (Math.abs(m.x + 150) > 2) { stopTweens(m); await tw(m, { x: -150 }, Math.min(1.2, Math.abs(m.x + 150) / 90), 'out'); }
    await wait(0.45);
    // he stops; his shadow does not, for two more steps
    var legs = m.sh.legs = { phase: m.phase }, un = hook(function (dt) { legs.phase += dt * 4.6; });
    sfxDissonance(3.2, 0.35); play('breath', { vol: 0.5 });
    await tw(m.sh, { dx: -40 }, 1.5, 'lin');
    un(); legs.phase = Math.round(legs.phase / Math.PI) * Math.PI;
    await wait(0.9);
    await tw(m.sh, { dx: 0 }, 0.22, 'in');
    m.sh.legs = null; sfxClick(0.35);
  };
  /* ACT II */
  CUES.a2_witch = async function () { AU.unease = 0.28; play('breath', { vol: 0.6 }); await walk(A_.witch, -360, 26); };
  CUES.a2_window = async function () {
    var w = A_.witch, tok = S.wtok = {};
    stopTweens(w);
    await walk(w, -150, 30); if (S.wtok !== tok) return;
    w.flip = -1; tw(w, { rot: -0.08 }, 0.6);
    await tw(w.ang, { armF: -2.05, foreF: 0.35, handF: 0.5 }, 1.4); if (S.wtok !== tok) return;
    play('cloth', { vol: 0.4 }); await wait(2.6); if (S.wtok !== tok) return;
    await tw(w.ang, { armF: 0.12, foreF: -0.06, handF: 0.1 }, 1); tw(w, { rot: 0 }, 0.5); if (S.wtok !== tok) return;
    await walk(w, 300, 36); if (S.wtok !== tok) return;
    w.flip = -1; tw(w, { rot: -0.1 }, 0.6);
    await tw(w.ang, { armF: -2.1, foreF: 0.3, handF: 0.6 }, 1.4); if (S.wtok !== tok) return;
    play('whisper', { vol: 0.25, dur: 1.6 });
  };
  CUES.a2_leave = async function () {
    var w = A_.witch; S.wtok = {};
    stopTweens(w); stopTweens(w.ang);
    if (Math.abs(w.x - 300) > 3 || w.ang.armF > -1.5) { w.flip = -1; await Promise.all([tw(w, { x: 300, rot: -0.1 }, 0.9), tw(w.ang, { armF: -2.1, foreF: 0.3, handF: 0.6 }, 0.9)]); await wait(0.6); }
    // she goes; her shadow stays at the window
    var q = copyPose(shadowPose(w)); w.sh.frozen = q; w.sh.frozenM = shadowMatrix(w, q); w.sh.sup = true;
    tw(w.ang, { armF: 0.12, foreF: -0.06, handF: 0.1 }, 0.8); tw(w, { rot: 0 }, 0.6);
    AU.unease = 0.38; play('drone', { dur: 7, vol: 0.6 });
    walk(w, 640, 34);
    await wait(2.4);
    play('whisper', { vol: 0.3, dur: 2 });
    await tw(q.ang, { foreF: 0.9, handF: 1.0 }, 3.5);   // it moves its fingers on its own
    await tw(q.ang, { foreF: 0.2, handF: 0.4 }, 4);
  };
  /* ACT III */
  CUES.a3_needle = async function () {
    var w = A_.witch, v = A_.victim;
    if (v.x > -8) { stopTweens(v); await tw(v, { x: -10 }, 0.8, 'out'); }
    v.flip = 1;
    await walk(w, -150, 42);
    w.flip = 1; w.hideP.needle = false;
    await tw(w.ang, { armF: -1.5, foreF: -0.5, handF: 0.2, needle: 2.9 }, 1.1);
    var tp = needleTip(w, 'needle'); glint(tp[0], tp[1]); sfxThread(1.6);
  };
  CUES.a3_cut = async function () {
    var w = A_.witch, v = A_.victim;
    w.hideP.needle = false;
    await Promise.all([tw(w, { rot: 0.16 }, 0.7), tw(w.ang, { armF: -0.75, foreF: -0.55, handF: 0.4, needle: 2.7 }, 0.7)]);
    // snip
    await tw(w.ang, { foreF: -0.9 }, 0.12); sfxSnip(); await tw(w.ang, { foreF: -0.4 }, 0.12);
    play('shadow_detach'); sfxDissonance(4.5, 0.5); AU.unease = 0.48;
    v.sh.sup = true; v.sh.live = true; v.sh.wob = 0.35; v.look = 'victim';
    tw(w, { rot: 0 }, 0.6); tw(w.ang, { armF: 0.1, foreF: -0.1 }, 0.9);
    await tw(v.sh, { dx: -48, lean: 0.1 }, 2.6, 'io');
  };
  CUES.a3_stagger = async function () {
    var v = A_.victim, tok = S.vtok = {};
    await tw(v.ang, { armF: -2.75, foreF: -1.45, armB: -0.3 }, 0.7); v.armHeld = true;
    for (var i = 0; i < 3 && S.vtok === tok; i++) { await tw(v, { rot: -0.09 }, 0.35); await tw(v, { rot: 0.06 }, 0.35); }
    if (S.vtok !== tok) return;
    tw(v, { rot: 0 }, 0.3); v.flip = -1;
    await tw(v.ang, { armF: -1.45, foreF: -0.2 }, 0.5);
    for (i = 0; i < 2 && S.vtok === tok; i++) {   // he reaches for it; it slides away
      var x0 = v.x;
      tw(v.sh, { dx: v.sh.dx - 34 }, 1.1, 'io');
      await tw(v, { x: x0 - 16 }, 0.9, 'lin');
      await wait(0.5);
    }
  };
  CUES.a3_eat = async function () {
    var w = A_.witch, v = A_.victim; S.vtok = {};
    w.sh.sup = true; w.sh.live = true;
    play('shadow_absorb'); play('whisper', { vol: 0.35, dur: 2 });
    tw(w.sh, { grow: 1.15, wob: 0.25 }, 2.6);
    await tw(v.sh, { dx: w.x - v.x + 4, alpha: 0, scaleY: 1.25 }, 2.6, 'in');
    v.sh.hide = true; v.armHeld = true;
    tw(v.ang, { armF: 0.25, foreF: 0.1, armB: 0.2 }, 0.9); tw(v, { rot: 0.14, y: FEET + 4 }, 1.2);
  };
  CUES.a3_pin = async function () {
    var w = A_.witch;
    await walk(w, 128, 42);
    w.flip = 1;
    await tw(w.ang, { armF: -1.25, foreF: -0.35, handF: 0.3, needle: 2.4 }, 0.8);
    var tp = needleTip(w, 'needle');
    w.hideP.needle = true;
    A_.pinned = add(make.needle({ x: tp[0], y: tp[1] - 2, rot: -0.75 + Math.PI, d: 4, rods: [], z: -1 }));
    A_.pinned.sh.autoLean = 0; A_.pinned.rot = Math.PI - 0.75;
    sfxClick(0.5); glint(tp[0], tp[1] - 40); sfxThread(0.8, false);
    await wait(0.6);
    await tw(w.ang, { armF: 0.12, foreF: -0.06, handF: 0.1 }, 0.8);
    await walk(w, 40, 30); w.flip = 1;
  };
  /* ACT IV */
  function merge(p, ws, add) {
    return tw(p.sh, { alpha: 0.88 }, 1.4).then(function () { play('whisper', { vol: 0.3, dur: 1.4 }); return wait(0.5); })
      .then(function () { return tw(p.sh, { scaleY: 1.4, lean: (p.x > ws.x ? 0.5 : -0.5) }, 1, 'io'); })
      .then(function () { play('shadow_absorb', { vol: 0.8 }); tw(ws.sh, { grow: ws.sh.grow + add }, 1.6); return Promise.all([tw(p, { x: ws.x }, 1.6, 'in'), tw(p.sh, { alpha: 0, scaleY: 0.8 }, 1.6, 'in')]); })
      .then(function () { remove(p); });
  }
  CUES.a4_one = async function () { await merge(stolen('man', -230, 1), A_.ws, 0.22); };
  CUES.a4_more = async function () {
    AU.unease = 0.55;
    merge(stolen('woman', 240, -1), A_.ws, 0.2);
    await wait(0.9); merge(stolen('child', -330, 1), A_.ws, 0.18);
    await wait(0.9); await merge(stolen('old', 340, -1), A_.ws, 0.2);
  };
  CUES.a4_grow = async function () {
    var ws = A_.ws;
    play('shadow_stretch'); play('drone', { dur: 8, vol: 0.7 }); AU.unease = 0.68;
    ws.sh.ang = { armF: 0, armB: 0, foreF: 0 };
    tw(ws.sh.ang, { armF: -0.9, armB: 0.7, foreF: -0.4 }, 6);
    tw(S, { spill: 0.6 }, 4, 'in', 2);
    await wait(2.4); if (ready()) A.setMuffle(0.65);   // the sound closes in as it leaves the sheet
    await tw(ws.sh, { grow: 3.4, wob: 0.8 }, 4.2, 'io');
    await wait(0.8); if (ready()) A.setMuffle(0);
  };
  CUES.a4_swap = async function () {
    var ws = A_.ws;
    await handSweep(1, function () {
      take(A_.witch); A_.ws.follow = false;
      A_.scarf = add(make.scarfWoman({ x: A_.witch.x, y: FEET, z: 5, held: 'R', look: 'shadow' }));
      A_.scarf.sh.hide = true;
    }, 1.6);
    tw(ws.sh, { grow: 2.4 }, 3); tw(S, { spill: 0.25 }, 3);
    // the woman is still; the shadow behind her is not
    await tw(ws.sh.ang, { armF: -1.6, foreF: -0.7, armB: 0.2 }, 3.5);
    await tw(ws.sh.ang, { armF: -0.6, foreF: 0.2 }, 3);
  };
  /* ACT V */
  CUES.a5_needle = async function () {
    var nd = A_.nd = make.needle({ x: 0, y: 330, d: 30, held: 'R', z: 9, rods: [[0, -30]] });
    nd.rot = 0.25; add(nd);
    sfxThread(1.4); await tw(nd, { y: -10 }, 1.3, 'out');
    var tp = pt(paperMatrix(nd.disp), 0, -66); glint(tp[0], tp[1]);
    await tw(nd, { rot: -0.25 }, 3.5, 'io');
  };
  CUES.a5_hide = async function () {
    var nd = A_.nd, h = A_.hero;
    if (nd) { stopTweens(nd); tw(nd, { x: 330, y: 60, rot: 0.6 }, 1.4).then(function () { take(nd); }); }
    h.hideP.tool = false;
    await walk(h, 372, 50);
    h.flip = -1;
    var tok = S.htok = {};
    while (S.htok === tok && TH.active) { await tw(h, { x: 356 }, 0.7); await wait(1.6); if (S.htok !== tok) break; await tw(h, { x: 372 }, 0.7); await wait(2.2); }
  };
  async function witchSway(tok) {
    var w = A_.witch;
    while (S.swayTok === tok && TH.active) { await walk(w, -70, 16); if (S.swayTok !== tok) break; w.flip = 1; await wait(1.2); if (S.swayTok !== tok) break; await walk(w, -10, 16); if (S.swayTok !== tok) break; w.flip = 1; await wait(1.6); }
  }
  function wsLean() { var ws = A_.ws; return Math.abs(ws.sh.lean - ws.sh.autoLean * clamp((ws.x - S.lamp.x) / 300, -2.4, 2.4)); }
  function lampInteraction() {
    return new Promise(function (res) {
      var L = S.lamp, held = 0, idle = 0, auto = false, done = false;
      L.can = true; S.hint = S.touch || (BTS.Touch && BTS.Touch.enabled) ? 'theatre.hint_lamp_touch' : 'theatre.hint_lamp'; tw(S, { hintA: 1 }, 0.6);
      sfxThread(2.2);
      var un = hook(function (dt) {
        if (done) return;
        if (!L.touched) idle += dt;
        if (!auto && (idle > 11 || S.autoLamp)) {   // nobody took it: grandmother moves it herself
          auto = true; L.can = false; L.drag = false; tw(S, { hintA: 0 }, 0.4);
          play('cloth', { vol: 0.5 }); tw(L, { x: -420 }, 3.4, 'io');
        }
        held = wsLean() > 0.95 ? held + dt : 0;
        if (held > 0.45) { done = true; un(); separate().then(res); }
      });
    });
  }
  async function separate() {
    var L = S.lamp, ws = A_.ws;
    L.can = false; L.drag = false; tw(S, { hintA: 0 }, 0.5); stopTweens(L);
    var q = copyPose(shadowPose(ws)); ws.sh.frozen = q; ws.sh.frozenM = shadowMatrix(ws, q); ws.follow = false;
    play('shadow_detach'); sfxDissonance(5, 0.6); play('drone', { dur: 7, vol: 0.8 }); play('heartbeat', { vol: 0.6 });
    AU.unease = 0.82;
    tw(L, { x: (L.x - 24) / 2 }, 2.5, 'io');
    await wait(1.2);
  }
  CUES.a5_strike = async function () {
    var ws = A_.ws, h = A_.hero;
    S.htok = {}; stopTweens(h);
    var hp = pt(ws.sh.frozenM, 5, -178);
    var side = hp[0] > A_.witch.x ? 1 : -1, standX = hp[0] + 30 * side;
    await walk(h, standX, 140);
    h.flip = -side; h.armHeld = true;
    await tw(h.ang, { armF: -2.5, foreF: -0.6, tool: 1.2 }, 0.6);
    await wait(0.35);
    await Promise.all([tw(h.ang, { armF: -1.15, foreF: -0.2, tool: 0.6 }, 0.14, 'in'), tw(h, { x: standX - 8 * side }, 0.14)]);
    // the needle goes into the shadow's head
    auStop(0.03); play('shadow_tear'); glint(hp[0], hp[1]);
    S.white = 0.75; tw(S, { white: 0 }, 1.1, 'out'); S.cam.shake = 0.7; tw(S.cam, { shake: 0 }, 1); L_flare(0.6);
    var baseM = ws.sh.frozenM, t0 = clock;
    var un = hook(function () { var k = 1 - (clock - t0) / 0.7; ws.sh.frozenM = k > 0 ? new DOMMatrix().translateSelf(vnoise(clock * 40) * 9 * k, vnoise(clock * 37 + 3) * 7 * k).multiply(baseM) : baseM; });
    await wait(0.7); un();
    // it falls apart into the shadows it ate; for a breath they are themselves again
    play('shadow_release');
    tw(ws.sh, { alpha: 0 }, 0.4);
    A_.freed = [['man', -300], ['woman', -150], ['child', 120], ['old', 280]].map(function (f, i) {
      var p = make[f[0]]({ x: hp[0], y: FEET, paper: false, z: 0, look: 'shadow', flip: f[1] > hp[0] ? 1 : -1 });
      p.sh.alpha = 0; p.sh.scaleY = 0.3; p.sh.live = true; add(p);
      tw(p, { x: f[1] }, 1.6, 'out', i * 0.12); tw(p.sh, { alpha: 0.95, scaleY: 1 }, 1.2, 'out', i * 0.12);
      return p;
    });
  };
  function L_flare(v) { S.lamp.flare = v; tw(S.lamp, { flare: 0 }, 1.2); }
  CUES.a5_fail = async function () {
    var h = A_.hero, ws = A_.ws, w = A_.witch;
    var tp = needleTip(h, 'tool');
    h.hideP.tool = true;
    var nd = add(make.needle({ x: tp[0], y: tp[1], rods: [], d: 10, z: 7 })); nd.rot = h.flip > 0 ? 2.6 : -2.6;
    await tw(nd, { y: FEET + 6, rot: nd.rot > 0 ? Math.PI / 2 + 0.1 : -Math.PI / 2 - 0.1 }, 0.5, 'in');
    play('metal', { vol: 0.6 }); sfxClick(0.4);
    tw(S.lamp, { flick: 1 }, 0.25); play('cloth', { vol: 0.5 });
    await wait(1.0);
    // the stolen shadows are pulled back; she gathers herself again
    play('shadow_absorb'); play('whisper', { vol: 0.4, dur: 2.4 });
    (A_.freed || []).forEach(function (p, i) { p.sh.sup = true; tw(p, { x: w.x }, 1.6, 'in', i * 0.1); tw(p.sh, { alpha: 0, scaleY: 0.7 }, 1.7, 'in', i * 0.1); });
    ws.sh.frozen = null; ws.sh.frozenM = null; ws.follow = true; ws.sh.grow = 1.35;
    tw(ws.sh, { alpha: 1 }, 1.8, 'io', 0.6);
    // and the man pays: his own shadow goes with them
    h.sh.sup = true; h.sh.live = true;
    tw(h.sh, { dx: w.x - h.x, alpha: 0 }, 2.2, 'in', 0.4);
    tw(h, { rot: 0.22 * -h.flip, y: FEET + 6 }, 1.6, 'io', 1);
    tw(h.ang, { armF: 0.3, foreF: 0.2 }, 1.2, 'io', 1);
    await wait(2.4);
    (A_.freed || []).forEach(remove);
    tw(S.lamp, { flick: 0 }, 1.5);
  };

  /* ---------------- the show ---------------- */
  async function show() {
    var L = S.lamp;
    S.cam.x = 0; S.cam.y = 20; S.cam.z = 0.6;
    tw(S, { black: 0 }, 1.8);
    await wait(1.2);
    play('match'); await wait(0.6);
    tw(L, { on: 1 }, 1.4, 'out');
    await wait(0.8); auStart();
    await say('th_in');
    // the room recedes; only the sheet and the lamp remain
    tw(S, { room: 0.1 }, 5, 'io');
    await cam(0, 0, 1.0, 5);

    /* I — the folk who feared the dark */
    S.act = 1; title(1);
    var gr = make.ground({ x: 0, y: FEET + 2, z: -6 }); gr.pinnedStill = true;
    handSweep(-1, null, 1.9);
    await place(gr, 0.3);
    var scenery = [make.moon({ x: -330, y: -185, z: -5 }), make.church({ x: -40, y: FEET - 4, s: 0.72, z: -4 }), make.houseA({ x: -255, y: FEET, z: -3 }),
      make.well({ x: 30, y: FEET, z: -3 }), make.houseB({ x: 200, y: FEET, z: -3 }), make.fence({ x: -168, y: FEET, z: -2 }), make.rooster({ x: -128, y: FEET - 39, z: -1 })];
    scenery.forEach(function (p) { p.pinnedStill = true; });
    A_.scenery = scenery;
    for (var i = 0; i < scenery.length; i++) await place(scenery[i], 0.18);
    A_.man = add(make.man({ x: 580, y: FEET, flip: -1, hoe: true, held: 'R', z: 5 }));
    A_.woman = add(make.woman({ x: -560, y: FEET, basket: true, held: 'L', z: 4 }));
    A_.child = add(make.child({ x: -612, y: FEET, z: 4 }));
    A_.dog = add(make.dog({ x: -660, y: FEET, z: 4 }));
    A_.old = add(make.old({ x: 640, y: FEET, flip: -1, z: 3 }));
    A_.rabbit = add(make.rabbit({ x: -540, y: FEET, z: 6 }));
    await wait(0.6);
    await say('th_a1');

    /* II — the woman at the edge of the village */
    S.act = 2; title(2);
    tw(L, { dim: 0.84 }, 3); AU.unease = 0.2;
    cam(-60, -20, 1.08, 4);
    await handSweep(1, function () {
      ['man', 'woman', 'child', 'dog', 'old', 'rabbit'].forEach(function (k) { remove(A_[k]); });
    }, 1.8);
    A_.witch = add(make.witch({ x: -560, y: FEET, z: 5, held: 'L', autoLean: 0.2 }));
    await wait(0.5);
    await say('th_a2');

    /* III — the first stolen shadow */
    S.act = 3; title(3);
    var w = A_.witch;
    tw(w.sh, { alpha: 0 }, 1.6).then(function () { w.sh.frozen = null; w.sh.frozenM = null; });
    cam(-40, 10, 1.15, 4);
    tw(L, { x: 160 }, 2.5, 'io');
    A_.witch = add(make.witch({ x: -262, y: FEET, z: -3.5, held: 'L', needle: true, autoLean: 0.2 }));
    A_.witch.hideP = { needle: true };
    A_.victim = add(make.man({ x: 580, y: FEET, flip: -1, held: 'R', z: 5, autoLean: 0.5 }));
    await handSweep(-1, function () { remove(w); }, 1.6);
    A_.victim.base.armF = 0.08;
    walk(A_.victim, -10, 52).then(function () { A_.victim.flip = 1; return tw(A_.victim.ang, { armF: -2.9, armB: 2.9 }, 0.8); })
      .then(function () { return wait(0.8); }).then(function () { return tw(A_.victim.ang, { armF: 0.08, armB: -0.05 }, 0.7); });
    await wait(1.0);
    await say('th_a3');

    /* IV — she grows stronger */
    S.act = 4; title(4);
    AU.unease = 0.5;
    var oldW = A_.witch;
    tw(L, { x: -24 }, 2.5, 'io');
    cam(0, -20, 0.92, 4);
    await handSweep(1, function () {
      remove(A_.victim); remove(A_.pinned); remove(oldW);
      A_.witch = add(make.witch({ x: 0, y: FEET, z: 5, held: 'L' }));
      A_.witch.sh.hide = true;
      var ws = A_.ws = add(make.witch({ x: 0, y: FEET, paper: false, z: 0, look: 'shadow' }));
      ws.sh.sup = true; ws.sh.live = true; ws.sh.wob = 0.3; ws.sh.grow = 1.15; ws.follow = true;
    }, 1.8);
    hook(function () {
      var ws = A_.ws, wi = A_.witch; if (!ws || !ws.follow || !wi) return;
      ws.x = wi.x; ws.y = wi.y; ws.flip = wi.flip; ws.rot = wi.rot; ws.d = wi.d; ws.s = wi.s;
      for (var k in wi.ang) ws.ang[k] = wi.ang[k];
    });
    await wait(0.8);
    await say('th_a4');

    /* V — the needle against the shadow */
    S.act = 5; title(5);
    AU.unease = 0.42;
    tw(S, { spill: 0 }, 2.5);
    cam(20, 0, 1.0, 4);
    await handSweep(-1, function () {
      remove(A_.scarf); remove(A_.witch);
      A_.witch = add(make.witch({ x: -40, y: FEET, z: 5, held: 'L' }));
      A_.witch.sh.hide = true;
      var ws = A_.ws; ws.follow = true; ws.sh.grow = 1.15; ws.sh.ang = null; ws.sh.wob = 0.3; ws.sh.autoLean = 0.95; ws.sh.lie = 0.55;
      A_.tree = add(make.tree({ x: 330, y: FEET, z: 3 })); A_.tree.pinnedStill = true;
      A_.hero = add(make.man({ x: 600, y: FEET, flip: -1, z: 2, held: 'R', needleTool: true }));
      A_.hero.hideP = { tool: true };
    }, 1.8);
    tw(A_.ws.sh, { grow: 1.15 }, 1);
    S.swayTok = {}; witchSway(S.swayTok);
    await say('th_a5a');
    await lampInteraction();
    await say('th_a5b');
    S.swayTok = null;

    /* VI — the last warning */
    S.act = 6; title(6);
    tw(L, { x: -24, flick: 0 }, 2.5, 'io');
    tw(S, { room: 0.04 }, 3);
    await handSweep(1, function () {
      S.puppets.slice().forEach(function (p) { if (p !== gr) remove(p); });
      A_.child6 = add(make.child({ x: -70, y: FEET, z: 5, held: 'L' }));
    }, 2.2);
    cam(-10, -10, 1.04, 3).then(function () { return cam(-10, -30, 1.12, 18, 'lin'); });
    AU.unease = 0.9; auStart();
    await wait(1);
    await say('th_a6a');
    var w6 = A_.w6 = make.witch({ x: 400, y: FEET, flip: -1, z: 6, held: 'R' });
    w6.sh.sup = true; w6.sh.wob = 0.15; w6.sh.live = true; w6.sh.own = true;
    await place(w6, 0.2);
    play('shadow_stretch'); play('drone', { dur: 12, vol: 0.9 }); play('breath', { vol: 0.5 });
    // grandmother brings her slowly to the light: the shadow swallows the boy, the sheet, the room
    w6.sh.ang = { armF: 0, foreF: 0, armB: 0 };
    tw(w6.sh.ang, { armF: -1.4, foreF: -0.5, armB: 0.7 }, 9);
    await tw(w6, { x: 30, y: 226, d: 380 }, 5, 'io');
    tw(w6, { alpha: 0 }, 2.5, 'in', 1.2);
    tw(S, { spill: 0.92 }, 4.5, 'in', 1);
    tw(w6.sh, { wob: 0.6 }, 5);
    setTimeout(function () { if (ready() && TH.active) A.setMuffle(0.85); }, 1800 / TH.speed);
    auStop(4);
    await tw(w6, { x: -44, y: 330, d: 645 }, 6.5, 'in');
    await wait(1.4);
    // and takes it away, sharply
    remove(w6); sfxWhoosh(0.8); S.spill = 0;
    if (ready()) A.setMuffle(0);
    L_flare(0.35);
    silenceAll(true);
    await wait(2.8);
    var fin = say('th_a6b'); silenceAll(true);
    await fin;

    /* after: Đorđe and his own shadow */
    silenceAll(true);
    S.endShot = true;
    tw(S, { room: 0.6 }, 4, 'io');
    await cam(-800, 290, 1.0, 4.6, 'io');
    play('paper', { vol: 0.2 }); await wait(1.4);
    S.djShadow.lag = 0.32;
    play('cloth', { vol: 0.15 });
    tw(S.dj, { headFlip: -1, head: 0.1 }, 0.45, 'io');
    await wait(1.5);
    tw(S.dj, { arm: 0.42 }, 0.7, 'io');
    await wait(1.6);
    S.black = 1;   // cut
    await wait(1.3);
  }

  /* ---------------- setup / teardown ---------------- */
  var prevMusic = null, savedScripts = null, resolveFn = null;
  function setup(opts) {
    TH.active = true; TH.aborted = false; TH.test = !!opts.test; TH.from = opts.from || 0;
    TH.speed = opts.speed || 1;
    if (TH.speed !== 1) {   // faster dialogue pauses for automated tests
      savedScripts = {};
      Object.keys(SCRIPTS).forEach(function (id) { savedScripts[id] = BTS.Data.dialogues[id]; BTS.Data.dialogues[id] = SCRIPTS[id].map(function (s) { return Array.isArray(s) && s[0] === '~' ? ['~', s[1] / TH.speed] : s; }); });
    }
    hookJournal();
    lib(); if (!clothPath) buildStatic();
    S = newScene(); clock = 0; timers = []; tweens = []; A_ = {}; keysDown = {};
    S.hooks = []; S.djHist = []; S.dj.headFlip = 1;
    cv = document.createElement('canvas'); cv.className = 'theatre';
    cv.style.cssText = 'position:absolute;left:0;top:0;z-index:13;pointer-events:auto;touch-action:none;opacity:1;transition:opacity .8s;';
    g = cv.getContext('2d');
    shC = makeCanvas(1, 1); shG = shC.getContext('2d'); supC = makeCanvas(1, 1); supG = supC.getContext('2d');
    var U = BTS.UI, root = (U && U.root) || document.body;
    if (U && U.dlg && U.dlg.parentNode === root) { root.insertBefore(cv, U.dlg); U.dlg.style.zIndex = '14'; } else root.appendChild(cv);
    resize();
    window.addEventListener('resize', resize);
    cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
    if (BTS.World) BTS.World.controlLocked = (BTS.World.controlLocked || 0) + 1;
    prevMusic = BTS.Music && BTS.Music.state;
    if (BTS.Music) BTS.Music.set('silence', 1.5);
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function teardown() {
    if (!TH.active) return Promise.resolve();
    TH.active = false;
    cancelAnimationFrame(raf);
    auStop(0.8);
    if (ready()) A.setMuffle(0);
    silenceAll(false);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
    if (savedScripts) { Object.keys(savedScripts).forEach(function (id) { BTS.Data.dialogues[id] = savedScripts[id]; }); savedScripts = null; }
    if (BTS.World) BTS.World.controlLocked = Math.max(0, (BTS.World.controlLocked || 0) - 1);
    if (BTS.Music) BTS.Music.set(prevMusic && prevMusic !== 'silence' ? prevMusic : 'memory', 2.5);
    var c = cv;
    return new Promise(function (res) {
      if (!c) { res(); return; }
      c.style.pointerEvents = 'none';
      c.style.opacity = '0';
      setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); if (BTS.UI && BTS.UI.dlg) BTS.UI.dlg.style.zIndex = ''; res(); }, 850);
    });
  }
  function finishNow() { teardown().then(function () { if (resolveFn) { var r = resolveFn; resolveFn = null; r('abort'); } }); }

  /* BTS.Theatre.play([{speed}]) -> Promise<'done'|'abort'>, resolved after control/audio/view are back */
  TH.play = function (opts) {
    if (TH.active && TH.promise) return TH.promise;
    opts = opts || {};
    TH.promise = new Promise(function (resolve) {
      resolveFn = resolve;
      try { setup(opts); } catch (e) { BTS.Log.error('theatre setup', e); TH.active = false; resolveFn = null; resolve('abort'); return; }
      show().then(function () { return 'done'; }, function (e) { if (e !== ABORT) BTS.Log.error('theatre show', e); return 'abort'; })
        .then(function (how) {
          if (BTS.Dialogue.active && how === 'abort' && BTS.Dialogue.current && /^th_/.test(BTS.Dialogue.current.id)) BTS.Dialogue.abort();
          return teardown().then(function () { return how; });
        })
        .then(function (how) {
          if (how === 'done' && BTS.State) BTS.State.addClue('sk_legend');
          S = null;
          if (resolveFn) { resolveFn = null; resolve(how); }
        });
    });
    return TH.promise;
  };
  TH.state = function () { return S ? { act: S.act || 0, cue: S.cue || null, clock: clock, lampCan: S.lamp.can, lampX: S.lamp.x, puppets: S.puppets.length, endShot: S.endShot } : null; };
  TH.lamp = function (x) { if (S) { S.lamp.x = x; S.lamp.touched = true; } };
  TH._screen = function (x, y) { return S ? toScreen(x, y) : null; };
  return TH;
})();
