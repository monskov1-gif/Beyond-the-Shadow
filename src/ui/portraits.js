/* Procedural 64x64 pixel portraits with expressions, painted from the same character data. */
'use strict';
BTS.Portraits = (function () {
  var C = BTS.Col, P = {}, cache = {};
  var EXPR = ['neutral', 'sad', 'scared', 'angry', 'smile', 'blank', 'worried', 'tired'];
  P.EXPR = EXPR;

  function paint(id, expr) {
    var d = BTS.Data.characters[id];
    if (!d) return null;
    var pd = d.portrait || {};
    var p = new BTS.Atlas.Painter(64, 64); p.wrap = false;
    var skin = d.skin, hair = d.hair, top = d.topColor;
    var face = pd.face || 'man';
    var old = face === 'old' || face === 'oldman', child = face === 'boy' || face === 'girl';
    function lit(c, k) { return C.mul(c, k || 1.15); }
    // backdrop: soft vignette panel
    for (var y = 0; y < 64; y++) for (var x = 0; x < 64; x++) {
      var dx = (x - 32) / 34, dy = (y - 30) / 34, v = 1 - (dx * dx + dy * dy);
      p.px(x, y, [24 + v * 22, 20 + v * 18, 22 + v * 18]);
    }
    var custom = BTS.PortraitsCustom && BTS.PortraitsCustom[id];
    if (custom) { custom(p, expr, d); return finish(p); }
    // shoulders / clothes
    var sw = child ? 40 : 48;
    for (y = 48; y < 64; y++) { var w = sw + (y - 48) * 1.2; var x0 = Math.round(32 - w / 2); for (x = x0; x < x0 + w; x++) p.px(x, y, (x - x0) < 3 ? lit(top) : (x0 + w - x) < 4 ? C.mul(top, 0.75) : top); }
    if (d.vest) { for (y = 50; y < 64; y++) { p.rect(32 - sw / 2 - (y - 48), y, 10, 1, d.vest); p.rect(32 + sw / 2 - 10 + (y - 48), y, 10, 1, C.mul(d.vest, 0.8)); } }
    if (d.apron) p.rect(24, 56, 16, 8, d.apron);
    if (d.shawl) for (y = 47; y < 58; y++) p.rect(32 - 26 + (y - 47), y, 52 - (y - 47) * 2, 1, d.shawl);
    if (d.embroidery) for (x = 22; x < 42; x += 2) { p.px(x, 52, d.embroidery); p.px(x + 1, 53, d.embroidery); }
    if (d.cross) { p.rect(31, 54, 2, 7, [200, 180, 90]); p.rect(29, 56, 6, 2, [200, 180, 90]); }
    if (d.camera) { p.rect(36, 55, 9, 6, [36, 36, 40]); p.ellipse(40.5, 58, 2, 2, [100, 120, 140]); }
    if (d.strap) for (y = 48; y < 64; y++) p.px(22 + (y - 48), y, d.strap), p.px(23 + (y - 48), y, d.strap);
    // neck
    p.rect(27, 42, 10, 8, C.mul(skin, 0.8));
    // head shape
    var hw = child ? 15 : 16, hh = child ? 17 : 19, cx = 32, cy = old ? 27 : 26;
    for (y = -hh; y <= hh; y++) for (x = -hw; x <= hw; x++) {
      var nx = x / hw, ny = y / hh;
      var jaw = ny > 0.3 ? 1 + (ny - 0.3) * (child ? 0.6 : 0.9) : 1;
      if (nx * nx * jaw * jaw + ny * ny > 1) continue;
      var shade = 0.92 + (-nx * 0.12) + (-ny * 0.06);
      if (nx > 0.6) shade -= 0.12;
      p.px(cx + x, cy + y, C.mul(skin, shade));
    }
    // ears
    p.ellipse(cx - hw - 1, cy + 2, 2.5, 4, C.mul(skin, 0.85)); p.ellipse(cx + hw + 1, cy + 2, 2.5, 4, C.mul(skin, 0.78));
    // eyes
    var ey = cy + 1, ex = 7;
    var eyeCol = pd.eyes || [60, 50, 40];
    var brow = { neutral: 0, sad: 2, scared: 3, angry: -2, smile: 0, blank: 0, worried: 2, tired: 1 }[expr] || 0;
    var openH = { scared: 4, blank: 2, tired: 2, smile: 2, angry: 2 }[expr] || 3;
    [-1, 1].forEach(function (s) {
      var x0 = cx + s * ex - 3;
      p.rect(x0, ey - Math.floor(openH / 2), 6, openH, expr === 'blank' ? [200, 196, 190] : [232, 228, 220]);
      var irisX = cx + s * ex - 1 + (expr === 'worried' ? -s : 0);
      p.rect(irisX, ey - Math.floor(openH / 2), 3, openH, expr === 'blank' ? C.mix(eyeCol, [150, 150, 150], 0.6) : eyeCol);
      if (expr !== 'blank') { p.px(irisX + 1, ey - Math.floor(openH / 2) + (openH > 2 ? 1 : 0), [20, 16, 18]); p.px(irisX, ey - Math.floor(openH / 2), [250, 250, 250]); }
      p.rect(x0, ey - Math.floor(openH / 2) - 1, 6, 1, C.mul(skin, 0.55));   // lid line
      if (old || expr === 'tired') p.rect(x0 + 1, ey + Math.ceil(openH / 2), 4, 1, C.mul(skin, 0.75));
      // brows: inner end raised for sad/scared/worried, lowered for angry
      var by = ey - 4 - (expr === 'scared' ? 1 : 0);
      for (var i = 0; i < 6; i++) {
        var inner = s < 0 ? i / 5 : 1 - i / 5;
        var yy = by - Math.round(inner * brow * 0.6);
        p.px(x0 + i, yy, C.mul(old ? [200, 196, 188] : hair, 0.8));
      }
    });
    // nose
    p.rect(cx, cy + 3, 1, 5, C.mul(skin, 0.78)); p.px(cx - 1, cy + 8, C.mul(skin, 0.7)); p.px(cx + 1, cy + 8, C.mul(skin, 0.7));
    // cheeks / freckles
    if (child || d.blush) { p.rect(cx - 11, cy + 7, 3, 1, C.mix(skin, [210, 100, 100], 0.35)); p.rect(cx + 8, cy + 7, 3, 1, C.mix(skin, [210, 100, 100], 0.35)); }
    if (pd.freckles) [[-8, 5], [-6, 6], [-9, 7], [7, 5], [9, 6], [6, 7]].forEach(function (f) { p.px(cx + f[0], cy + f[1], C.mul(skin, 0.75)); });
    if (old) { [[-12, 4], [11, 4], [-10, 10], [9, 10]].forEach(function (w) { p.rect(cx + w[0], cy + w[1], 2, 1, C.mul(skin, 0.75)); }); p.rect(cx - 5, cy - 9, 10, 1, C.mul(skin, 0.85)); }
    // mouth
    var my = cy + 11, mc = C.mul(skin, 0.55), lipc = C.mix(skin, [160, 70, 70], 0.35);
    switch (expr) {
      case 'smile': p.rect(cx - 4, my, 9, 1, mc); p.px(cx - 5, my - 1, mc); p.px(cx + 5, my - 1, mc); p.rect(cx - 3, my + 1, 7, 1, lipc); break;
      case 'sad': case 'worried': p.rect(cx - 3, my, 7, 1, mc); p.px(cx - 4, my + 1, mc); p.px(cx + 4, my + 1, mc); break;
      case 'scared': p.rect(cx - 2, my - 1, 5, 3, [70, 30, 34]); p.rect(cx - 2, my - 1, 5, 1, mc); break;
      case 'angry': p.rect(cx - 4, my, 9, 1, mc); p.rect(cx - 3, my + 1, 7, 1, C.mul(skin, 0.7)); break;
      case 'blank': p.rect(cx - 2, my, 5, 1, C.mul(skin, 0.7)); break;
      default: p.rect(cx - 3, my, 7, 1, mc); p.rect(cx - 2, my + 1, 5, 1, lipc);
    }
    // beard / mustache
    if (d.beard) { for (y = cy + 6; y < cy + hh + 4; y++) for (x = -hw + 2; x <= hw - 2; x++) { var ny2 = (y - cy) / hh; if (Math.abs(x) / hw * 1.1 + Math.max(0, ny2 - 0.9) < 1 && !(y >= my - 1 && y <= my + 1 && Math.abs(x) < 4)) p.px(cx + x, y, (x + y) % 3 ? d.beard : C.mul(d.beard, 0.8)); } }
    if (d.mustache) { p.rect(cx - 6, my - 2, 13, 2, d.mustache); p.px(cx - 7, my - 1, d.mustache); p.px(cx + 7, my - 1, d.mustache); }
    // hair
    var hs = d.hairStyle;
    function hairCap(extraSide) {
      for (y = cy - hh - 3; y < cy - 4; y++) for (x = -hw - 2; x <= hw + 2; x++) {
        var nx3 = x / (hw + 2), ny3 = (y - (cy - 2)) / (hh + 3);
        if (nx3 * nx3 + ny3 * ny3 > 1) continue;
        var fringe = y > cy - 9 && ((x * 7 + 11) % 5 === 0 || (hs === 'messy' && (x * 3) % 4 === 0));
        if (y > cy - 8 && !fringe && Math.abs(x) < hw - 3) continue;
        p.px(cx + x, y, (x + y) % 4 === 0 ? lit(hair) : (x > hw / 2 ? C.mul(hair, 0.8) : hair));
      }
      for (y = cy - 6; y < cy + (extraSide || 4); y++) { p.rect(cx - hw - 2, y, 3, 1, hair); p.rect(cx + hw, y, 3, 1, C.mul(hair, 0.8)); }
    }
    if (hs === 'scarf' || hs === 'scarf_white') {
      var sc = d.scarf;
      for (y = cy - hh - 4; y < cy + hh + 6; y++) for (x = -hw - 5; x <= hw + 5; x++) {
        var nx4 = x / (hw + 5), ny4 = (y - (cy - 1)) / (hh + 6);
        if (nx4 * nx4 + ny4 * ny4 > 1) continue;
        var inner = (x / (hw - 1)) * (x / (hw - 1)) + ((y - (cy + 3)) / (hh - 2)) * ((y - (cy + 3)) / (hh - 2));
        if (inner < 1 && y > cy - hh + 5) continue;
        p.px(cx + x, y, x > hw / 2 ? C.mul(sc, 0.8) : (x < -hw / 2 ? lit(sc, 1.08) : sc));
        if (d.scarfPattern && (x + y * 3) % 7 === 0) p.px(cx + x, y, d.scarfPattern);
      }
      p.rect(cx - 4, cy + hh + 2, 8, 4, C.mul(sc, 0.85)); // knot
    } else if (hs === 'bald') {
      for (y = cy - 4; y < cy + 6; y++) { p.rect(cx - hw - 1, y, 2, 1, hair); p.rect(cx + hw, y, 2, 1, hair); }
      p.rect(cx - 6, cy - hh + 3, 5, 2, lit(skin, 1.12));
    } else {
      hairCap(hs === 'long' ? 18 : hs === 'braid' ? 12 : 4);
      if (hs === 'long') { for (y = cy; y < 56; y++) { p.rect(cx - hw - 4, y, 4, 1, hair); p.rect(cx + hw + 1, y, 4, 1, C.mul(hair, 0.8)); } }
      if (hs === 'ponytail') { for (y = cy - 10; y < cy + 12; y++) p.rect(cx + hw + 2, y, 3, 1, C.mul(hair, 0.85)); p.rect(cx + hw + 1, cy - 11, 4, 2, [60, 40, 30]); }
      if (hs === 'braid') { for (y = cy + 4; y < 60; y++) p.rect(cx + hw - 1 + ((y >> 1) % 2), y, 4, 1, (y % 4 < 2) ? hair : C.mul(hair, 0.8)); }
      if (hs === 'bun') p.ellipse(cx, cy - hh - 3, 6, 4, hair);
    }
    if (d.hat === 'cap') { for (y = cy - hh - 3; y < cy - hh + 5; y++) p.rect(cx - hw - 2, y, hw * 2 + 5, 1, y > cy - hh + 2 ? C.mul(d.hatColor, 0.8) : d.hatColor); p.rect(cx - hw - 4, cy - hh + 5, hw * 2 + 9, 2, C.mul(d.hatColor, 0.7)); }
    else if (d.hat === 'brim') { p.rect(cx - hw - 8, cy - hh + 3, hw * 2 + 17, 3, C.mul(d.hatColor, 0.8)); p.rect(cx - hw, cy - hh - 5, hw * 2 + 1, 9, d.hatColor); }
    else if (d.hat === 'kamilavka') { p.rect(cx - hw, cy - hh - 9, hw * 2 + 1, 12, d.hatColor); p.rect(cx - hw, cy - hh - 9, hw * 2 + 1, 1, lit(d.hatColor, 1.6)); }
    else if (d.hat === 'wreath') { for (x = -hw - 2; x <= hw + 2; x++) { var yy2 = cy - hh + 2 + Math.round(Math.abs(x) * 0.25); p.px(cx + x, yy2, [70, 120, 60]); if (x % 3 === 0) p.px(cx + x, yy2 - 1, [[220, 70, 70], [240, 220, 120], [240, 240, 230], [190, 110, 170]][(x + 20) % 4]); } }
    return finish(p);
  }
  function finish(p) {
    var x, y;
    p.outline([12, 10, 12]);
    // frame
    for (x = 0; x < 64; x++) { p.px(x, 0, [90, 74, 56]); p.px(x, 63, [50, 40, 32]); }
    for (y = 0; y < 64; y++) { p.px(0, y, [90, 74, 56]); p.px(63, y, [50, 40, 32]); }
    var cv = document.createElement('canvas'); cv.width = cv.height = 64;
    cv.getContext('2d').putImageData(new ImageData(p.d, 64, 64), 0, 0);
    return cv.toDataURL();
  }
  P.get = function (id, expr) {
    if (!id) return null;
    var base = id === 'jaglika_needle' ? 'jaglika' : id;
    if (BTS.CharSprites.variant) base = BTS.CharSprites.variant(base);
    var def = BTS.Data.characters[base];
    if (!def || def.portrait === false) return null;
    expr = EXPR.indexOf(expr) >= 0 ? expr : 'neutral';
    var k = base + ':' + expr;
    if (!cache[k]) cache[k] = paint(base, expr);
    return cache[k];
  };
  return P;
})();
