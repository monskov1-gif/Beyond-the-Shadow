/* Procedural 2D pixel characters: every frame of every animation is painted at boot
   from the parametric definitions in data/characters.js. Frame: 24x36 px, pivot bottom-centre. */
'use strict';
BTS.CharSprites = (function () {
  var C = BTS.Col;
  var FW = 24, FH = 36;
  var OUTLINE = [22, 17, 20];
  var BODY = {
    adult: { leg: 10, torso: 10, tw: 8, arm: 9, head: 9 },
    man:   { leg: 10, torso: 11, tw: 9, arm: 10, head: 9 },
    big:   { leg: 10, torso: 11, tw: 10, arm: 10, head: 9 },
    woman: { leg: 10, torso: 9, tw: 7, arm: 9, head: 9 },
    teen:  { leg: 8, torso: 9, tw: 7, arm: 8, head: 9 },
    child: { leg: 7, torso: 8, tw: 7, arm: 7, head: 9 },
    small: { leg: 5, torso: 7, tw: 6, arm: 6, head: 8 },
    old:   { leg: 8, torso: 9, tw: 8, arm: 8, head: 9, hunch: 2 },
    stout: { leg: 8, torso: 9, tw: 10, arm: 8, head: 9, hunch: 1 }
  };

  function lit(c) { return C.mul(c, 1.16); }
  function dk(c) { return C.mul(c, 0.74); }
  function srect(p, x, y, w, h, c, flat) {
    if (w <= 0 || h <= 0) return;
    p.rect(x, y, w, h, c);
    if (flat) return;
    if (w > 2) for (var j = 0; j < h; j++) { p.px(x, y + j, lit(c)); p.px(x + w - 1, y + j, dk(c)); }
    if (h > 3) for (var i = 1; i < w; i++) p.px(x + i, y + h - 1, C.mul(c, 0.86));
  }

  /* pose: {dir:'down'|'up'|'side', anim, f} */
  function draw(p, d, pose) {
    var B = BODY[d.body] || BODY.adult;
    var dir = pose.dir, anim = pose.anim, f = pose.f || 0;
    var closed = anim === 'lie';
    if (closed) { anim = 'idle'; f = 0; dir = 'down'; }
    var cx = 12, base = FH - 1;
    var walk = anim === 'walk' || anim === 'run';
    var bob = walk && (f % 2 === 1) ? -1 : 0;
    if (anim === 'idle' && f === 1) bob = 0;
    var crouch = 0, headDrop = 0, headFwd = 0;
    if (anim === 'fear') crouch = 1;
    if (anim === 'weak') { crouch = 2; headDrop = 1; headFwd = 1; }
    if (anim === 'cower') { crouch = 3; headDrop = 1; }
    if (anim === 'kneel') crouch = Math.floor(B.leg / 2) + 1;
    if (anim === 'sit') crouch = B.leg - 4;
    if (anim === 'talk' && f === 1) headDrop = 1;
    if (anim === 'idle' && f === 1) headDrop = 0;
    var shake = (anim === 'fear' && f === 1) ? 1 : 0;
    cx += shake;
    var hunch = B.hunch || 0;
    if (anim === 'weak') hunch += 1;

    var legTop = base - B.leg + 1 + crouch - bob;        // first row of legs
    var waist = legTop;
    var torsoTop = waist - B.torso + bob * 0;
    var neckY = torsoTop - 1;
    var headH = B.head, headTop = neckY - headH + 1 + headDrop + (hunch ? 1 : 0);
    var tw = B.tw;
    var isSkirt = d.bottomType === 'skirt' || d.top === 'dress';
    var top = d.topColor, bot = d.bottomColor, shoe = d.shoes || [40, 30, 26], skin = d.skin;

    /* ---------- legs ---------- */
    function legsFront() {
      var lh = base - legTop + 1;
      if (anim === 'sit') { // knees toward camera
        srect(p, cx - 3, legTop, 3, 3, bot); srect(p, cx + 1, legTop, 3, 3, bot);
        p.rect(cx - 3, legTop + 3, 3, 1, shoe); p.rect(cx + 1, legTop + 3, 3, 1, shoe);
        return;
      }
      var lift0 = 0, lift1 = 0;
      if (walk) { if (f === 0) lift1 = 1; if (f === 2) lift0 = 1; }
      srect(p, cx - 3, legTop, 3, lh - 1 - lift0, bot);
      srect(p, cx + 1, legTop, 3, lh - 1 - lift1, bot);
      p.rect(cx - 3, base - lift0, 3, 1, shoe); p.px(cx - 4, base - lift0, shoe);
      p.rect(cx + 1, base - lift1, 3, 1, shoe); p.px(cx + 4, base - lift1, shoe);
      if (lh > 4) { p.rect(cx - 3, base - 1 - lift0, 3, 1, C.mul(shoe, 1.1)); p.rect(cx + 1, base - 1 - lift1, 3, 1, C.mul(shoe, 1.1)); }
    }
    function legsSide() {
      var lh = base - legTop + 1;
      if (anim === 'sit') {
        srect(p, cx - 1, legTop, 5, 3, bot); srect(p, cx + 3, legTop + 2, 2, lh - 3, bot); p.rect(cx + 3, base, 3, 1, shoe);
        return;
      }
      var spread = 0;
      if (walk) spread = (f === 0 ? 2 : f === 2 ? -2 : 0) * (anim === 'run' ? 1.5 : 1);
      var back = [cx - 1 - spread, legTop], front = [cx - 1 + spread, legTop];
      // back leg (darker)
      for (var y = 0; y < lh; y++) {
        var t = y / lh;
        var bx = Math.round(cx - 1 - spread * t), fx = Math.round(cx - 1 + spread * t);
        var liftB = walk && (f === 1) && y > lh - 3 ? -1 : 0;
        p.rect(bx, legTop + y, 3, 1, y >= lh - 1 ? dk(shoe) : dk(bot));
        p.rect(fx, legTop + y, 3, 1, y >= lh - 1 ? shoe : bot);
      }
      p.px(Math.round(cx - 1 + spread) + 3, base, shoe);
      p.px(Math.round(cx - 1 - spread) + 3, base, dk(shoe));
    }
    function skirt() {
      var len = base - legTop - 1;
      if (anim === 'sit' || anim === 'kneel') len = Math.max(3, base - legTop - 1);
      var side = dir === 'side', sh = side ? Math.min(hunch, 2) : 0;
      for (var y = 0; y < len; y++) {
        // A-line that stays close to the body: front/back view flares by at most 2px,
        // profile is the torso's side width and flares forward a little when walking
        var w = side ? (tw - 2) + Math.min(1, Math.floor(y / 4)) : tw + Math.min(2, Math.floor(y / 3));
        var sway = walk && y > len - 4 ? (f === 0 ? 1 : f === 2 ? -1 : 0) : 0;
        var x0 = side ? cx - Math.floor((tw - 2) / 2) + sh + (sway > 0 ? sway : 0) : cx - Math.ceil(w / 2) + sway;
        p.rect(x0, waist + y, w, 1, bot);
        p.px(x0, waist + y, lit(bot)); p.px(x0 + w - 1, waist + y, dk(bot));
        if (d.skirtBand && y === len - 2) p.rect(x0, waist + y, w, 1, d.skirtBand);
      }
      // feet under skirt
      var fy = base;
      if (dir === 'side') { p.rect(cx + 1, fy, 3, 1, shoe); if (walk && f !== 1 && f !== 3) p.rect(cx - 3, fy, 2, 1, dk(shoe)); }
      else { p.rect(cx - 3, fy, 2, 1, shoe); p.rect(cx + 2, fy, 2, 1, shoe); }
    }

    /* ---------- torso ---------- */
    function torso() {
      var x0 = cx - Math.floor(tw / 2) + (dir === 'side' ? 0 : 0);
      var w = dir === 'side' ? tw - 2 : tw;
      if (dir === 'side') x0 = cx - Math.floor(w / 2) + Math.min(hunch, 2);
      var h = waist - torsoTop;
      srect(p, x0, torsoTop, w, h, top);
      if (hunch && dir === 'side') { p.rect(x0 - 1, torsoTop + 1, 1, 3, top); }
      if (d.coat && !isSkirt) { // coat hem over hips
        srect(p, x0, waist, w, 3, top);
        if (dir === 'down') p.rect(cx, torsoTop + 2, 1, h + 3, dk(top));
      }
      if (d.vest) {
        if (dir === 'down') { p.rect(x0, torsoTop, 2, h, d.vest); p.rect(x0 + w - 2, torsoTop, 2, h, dk(d.vest)); }
        else if (dir === 'up') srect(p, x0, torsoTop, w, h, d.vest);
        else p.rect(x0, torsoTop, w - 2, h, d.vest);
      }
      if (d.apron && dir !== 'up') {
        var ax = dir === 'side' ? x0 + w - 2 : x0 + 1, aw = dir === 'side' ? 2 : w - 2;
        p.rect(ax, torsoTop + 2, aw, h - 2, d.apron);
        p.rect(ax - (dir === 'side' ? 0 : 1), waist, aw + (dir === 'side' ? 0 : 2), Math.max(2, base - waist - 4), d.apron);
      }
      if (d.shawl) {
        if (dir === 'up') { for (var i = 0; i < 6; i++) p.rect(cx - 5 + i, torsoTop + i, 10 - i * 2, 1, d.shawl); }
        else { p.rect(x0 - 1, torsoTop, w + 2, 2, d.shawl); p.rect(x0, torsoTop + 2, w, 1, dk(d.shawl)); }
      }
      if (d.belt) p.rect(x0, waist - 1, w, 1, d.belt);
      if (d.strap && dir !== 'up') { // satchel strap
        for (var s = 0; s < h; s++) p.px(x0 + (dir === 'side' ? 1 : Math.round(s * (w - 1) / h)), torsoTop + s, d.strap);
      }
      if (d.bagSide && dir === 'side') srect(p, x0 - 2, waist - 2, 3, 4, d.strap || [70, 50, 30]);
      if (d.bagSide && dir === 'down') srect(p, x0 + w - 1, waist - 1, 3, 3, d.strap || [70, 50, 30]);
      if (d.backpack && dir === 'up') srect(p, x0 + 1, torsoTop + 1, w - 2, h - 1, d.backpack);
      if (d.backpack && dir === 'side') srect(p, x0 - 3, torsoTop + 1, 3, h - 1, d.backpack);
      if (d.backpack && dir === 'down') { p.rect(x0 + 1, torsoTop, 1, h - 1, dk(d.backpack)); p.rect(x0 + w - 2, torsoTop, 1, h - 1, d.backpack); }
      if (d.hood) {
        if (dir === 'down') { p.rect(cx - 3, torsoTop, 7, 1, d.hood); p.px(cx - 3, torsoTop + 1, d.hood); p.px(cx + 3, torsoTop + 1, d.hood); p.rect(cx - 1, torsoTop + 1, 3, 1, dk(d.hood)); }
        else if (dir === 'up') { if (!d.backpack) srect(p, cx - 3, torsoTop, 7, 3, d.hood); }
        else p.rect(x0 - 1, torsoTop, 3, 2, d.hood);
      }
      if (d.zip && dir === 'down') { for (var zy = torsoTop + 1; zy < waist + (d.coat ? 2 : 0); zy++) p.px(cx, zy, (zy % 2) ? d.zip : C.mul(d.zip, 0.8)); }
      if (d.beads && dir === 'down') { for (var bx = -2; bx <= 2; bx++) p.px(cx + bx, torsoTop + 1 + (Math.abs(bx) < 2 ? 1 : 0), (bx & 1) ? d.beads : lit(d.beads)); }
      if (d.camera && dir === 'down') { p.rect(cx - 1, torsoTop + 3, 3, 2, [30, 30, 34]); p.px(cx, torsoTop + 3, [120, 140, 160]); }
      if (d.collar && dir === 'down') { p.rect(cx - 1, torsoTop, 3, 1, d.collar); }
      if (d.cross && dir === 'down') { p.px(cx, torsoTop + 3, [200, 180, 90]); p.px(cx, torsoTop + 4, [200, 180, 90]); p.px(cx - 1, torsoTop + 4, [200, 180, 90]); p.px(cx + 1, torsoTop + 4, [200, 180, 90]); p.px(cx, torsoTop + 5, [200, 180, 90]); }
      if (d.embroidery && dir === 'down') { for (var e = 0; e < w; e += 2) p.px(x0 + e, torsoTop + 1, d.embroidery); p.px(x0, torsoTop + h - 2, d.embroidery); p.px(x0 + w - 1, torsoTop + h - 2, d.embroidery); }
    }

    /* ---------- arms ---------- */
    function arms() {
      var sh = torsoTop + 1, len = B.arm;
      var sleeve = d.sleeve || top;
      var x0 = cx - Math.floor(tw / 2);
      if (dir === 'side') {
        var ax = cx - 1 + Math.min(hunch, 2), swing = 0;
        if (walk) swing = f === 0 ? -2 : f === 2 ? 2 : 0;
        if (anim === 'interact' || anim === 'point') { p.rect(ax, sh, 6, 2, sleeve); p.rect(ax + 6, sh, 2, 2, skin); if (pose.needle) p.px(ax + 8, sh - 1, [230, 230, 240]); return; }
        if (anim === 'sketch') { p.rect(ax, sh, 2, 4, sleeve); p.rect(ax + 2, sh + 3, 3, 2, skin); p.rect(ax + 3, sh + 1, 3, 3, [214, 206, 186]); return; }
        if (anim === 'fear' || anim === 'cower') { p.rect(ax + 1, sh - 1, 2, 3, sleeve); p.rect(ax + 2, sh - 3, 2, 2, skin); return; }
        for (var i = 0; i < len; i++) {
          var t = i / len, xx = Math.round(ax + swing * t);
          p.rect(xx, sh + i, 2, 1, i < len - 2 ? sleeve : skin);
        }
        if (pose.needle) p.px(Math.round(ax + swing) + 1, sh + len, [230, 230, 240]);
        return;
      }
      var lx = x0 - 2, rx = x0 + tw;
      var ly = 0, ry = 0;
      if (walk) { ly = f === 0 ? -1 : f === 2 ? 1 : 0; ry = -ly; }
      if (anim === 'interact') {
        p.rect(lx + 1, sh, 2, 4, sleeve); p.rect(rx - 1, sh, 2, 4, sleeve);
        p.rect(cx - 3, sh + 4, 2, 2, skin); p.rect(cx + 2, sh + 4, 2, 2, skin);
        return;
      }
      if (anim === 'fear' || anim === 'cower') {
        p.rect(lx + 1, sh - 1, 2, 3, sleeve); p.rect(rx - 1, sh - 1, 2, 3, sleeve);
        var hy = anim === 'cower' ? headTop + 4 : sh - 3;
        p.rect(lx + 1, hy, 2, 2, skin); p.rect(rx - 1, hy, 2, 2, skin);
        return;
      }
      if (anim === 'sketch') {
        p.rect(lx + 1, sh, 2, 4, sleeve); p.rect(rx - 1, sh, 2, 4, sleeve);
        p.rect(cx - 3, sh + 3, 7, 4, [214, 206, 186]); p.rect(cx - 3, sh + 3, 7, 1, [120, 90, 60]);
        p.px(cx + (f ? 2 : -1), sh + 5, [50, 50, 60]);
        p.rect(lx + 2, sh + 5, 2, 2, skin); p.rect(rx - 2, sh + 5, 2, 2, skin);
        return;
      }
      if (anim === 'point') {
        p.rect(lx, sh, 2, len - 2, sleeve); p.rect(lx, sh + len - 2, 2, 2, skin);
        p.rect(rx, sh, 5, 2, sleeve); p.rect(rx + 5, sh, 2, 2, skin);
        return;
      }
      var la = anim === 'weak' ? 1 : 0;
      srect(p, lx, sh + ly, 2, len - 2 + la, sleeve, true); p.rect(lx, sh + ly + len - 2 + la, 2, 2, skin);
      p.px(lx, sh + ly, lit(sleeve));
      srect(p, rx, sh + ry, 2, len - 2 + la, dk(sleeve), true); p.rect(rx, sh + ry + len - 2 + la, 2, 2, dk(skin));
      if (pose.needle) p.px(rx + 1, sh + ry + len, [235, 235, 245]);
    }

    /* ---------- head ---------- */
    function head() {
      var hx = cx - 5 + (dir === 'side' ? headFwd + Math.min(hunch, 2) : 0), hy = headTop, hw = 10, hh = headH;
      if (dir === 'side') { hx = cx - 4 + headFwd + Math.min(hunch, 2); hw = 9; }
      // neck
      p.rect(cx - 1 + (dir === 'side' ? Math.min(hunch, 2) : 0), hy + hh, 2, Math.max(1, torsoTop - hy - hh), dk(skin));
      for (var y = 0; y < hh; y++) {
        var inset = (y === 0 || y === hh - 1) ? 1 : 0;
        p.rect(hx + inset, hy + y, hw - inset * 2, 1, skin);
      }
      p.px(hx + 1, hy + 2, lit(skin));
      for (y = 2; y < hh - 1; y++) p.px(hx + hw - 1, hy + y, dk(skin));
      var hc = d.hair, hs = d.hairStyle;
      var eyeY = hy + 5;
      // face
      if (dir === 'down') {
        var ec = d.eyes || [30, 24, 26];
        if (anim === 'blank') ec = [90, 84, 90];
        if (closed) { p.rect(cx - 3, eyeY, 2, 1, C.mul(skin, 0.62)); p.rect(cx + 2, eyeY, 2, 1, C.mul(skin, 0.62)); }
        else { p.px(cx - 2, eyeY, ec); p.px(cx + 2, eyeY, ec); }
        if (d.brows) { p.px(cx - 2, eyeY - 1, dk(hc)); p.px(cx + 2, eyeY - 1, dk(hc)); }
        if (d.blush) { p.px(cx - 3, eyeY + 1, C.mix(skin, [200, 90, 90], 0.35)); p.px(cx + 3, eyeY + 1, C.mix(skin, [200, 90, 90], 0.35)); }
        if (anim === 'talk' && f === 0) p.px(cx, eyeY + 2, [110, 50, 50]);
        else if (anim === 'fear' || anim === 'cower') p.px(cx, eyeY + 2, [70, 30, 30]);
        if (d.wrinkles) { p.px(cx - 3, eyeY + 2, dk(skin)); p.px(cx + 3, eyeY + 2, dk(skin)); }
        if (d.glasses) { var gc = d.glassesCol || [40, 40, 50]; p.rect(cx - 3, eyeY - 1, 3, 1, gc); p.rect(cx + 1, eyeY - 1, 3, 1, gc); p.px(cx - 3, eyeY, gc); p.px(cx + 3, eyeY, gc); p.px(cx, eyeY, gc); }
        if (d.earring) { p.px(hx - 1, eyeY + 2, d.earring); p.px(hx + hw, eyeY + 2, d.earring); if (d.hairStyle === 'turban') { p.px(hx - 1, eyeY + 3, lit(d.earring)); p.px(hx + hw, eyeY + 3, lit(d.earring)); } }
      } else if (dir === 'side') {
        p.px(hx + hw - 3, eyeY, d.eyes || [30, 24, 26]);
        if (d.glasses) { p.rect(hx + hw - 4, eyeY - 1, 3, 1, d.glassesCol || [40, 40, 50]); p.px(hx + hw - 4, eyeY, d.glassesCol || [40, 40, 50]); }
        if (d.earring) p.px(hx + 2, eyeY + 2, d.earring);
        p.px(hx + hw, eyeY + 1, skin);                      // nose
        if (d.wrinkles) p.px(hx + hw - 2, eyeY + 2, dk(skin));
      }
      // beard / mustache
      if (d.beard && dir !== 'up') {
        var bx = dir === 'side' ? hx + hw - 5 : hx + 1, bw = dir === 'side' ? 5 : hw - 2;
        p.rect(bx, hy + 6, bw, 3, d.beard); p.rect(bx + 1, hy + hh, bw - 2, 1, d.beard);
        if (dir === 'down') p.px(cx, hy + 7, [90, 50, 50]);
      } else if (d.mustache && dir !== 'up') {
        if (dir === 'down') p.rect(cx - 2, hy + 7, 5, 1, d.mustache); else p.rect(hx + hw - 3, hy + 7, 3, 1, d.mustache);
      }
      // hair styles
      function hairRow(y, x0, x1, c) { p.rect(x0, y, x1 - x0 + 1, 1, c || hc); }
      var L = hx, Rr = hx + hw - 1;
      if (hs === 'scarf' || hs === 'scarf_white') {
        var sc = d.scarf;
        for (y = -1; y < 4; y++) hairRow(hy + y, L + (y < 0 ? 2 : 0), Rr - (y < 0 ? 2 : 0), sc);
        if (dir === 'down') { p.rect(L, hy + 4, 1, 5, sc); p.rect(Rr, hy + 4, 1, 5, sc); p.rect(L + 1, hy + hh, hw - 2, 1, dk(sc)); }
        if (dir === 'side') { p.rect(L, hy + 3, 4, 6, sc); p.rect(L - 1, hy + 6, 3, 5, dk(sc)); }
        if (dir === 'up') { p.rect(L, hy, hw, hh, sc); for (var k = 0; k < 5; k++) p.rect(L + k, hy + hh + k, hw - k * 2, 1, dk(sc)); }
        if (d.scarfPattern) for (var q = L + 1; q < Rr; q += 3) p.px(q, hy + 1, d.scarfPattern);
        p.px(L + 2, hy, lit(sc));
        return;
      }
      if (hs === 'turban') {          // tight wrapped head-cloth, ears showing
        var tc = d.scarf;
        hairRow(hy - 2, L + 2, Rr - 2, tc); hairRow(hy - 1, L + 1, Rr - 1, tc); hairRow(hy, L, Rr, tc); hairRow(hy + 1, L, Rr, tc);
        if (dir === 'down') { hairRow(hy + 2, L, L + 2, tc); hairRow(hy + 2, Rr - 2, Rr, tc); p.rect(L + 3, hy - 1, 1, 3, dk(tc)); p.rect(Rr - 3, hy - 2, 1, 2, dk(tc)); p.rect(cx - 1, hy - 3, 3, 2, lit(tc)); p.px(cx, hy - 3, dk(tc)); }
        else if (dir === 'side') { p.rect(L, hy + 2, 4, 3, tc); p.px(L + 2, hy - 1, dk(tc)); p.rect(L - 1, hy, 2, 3, dk(tc)); }
        else { p.rect(L, hy, hw, 5, tc); p.rect(L + 2, hy + 1, hw - 4, 1, dk(tc)); p.rect(cx - 1, hy + 4, 3, 2, dk(tc)); }
        p.px(L + 2, hy - 1, lit(tc));
        return;
      }
      if (hs === 'bob') {             // rounded bob to the jaw with blunt bangs
        hairRow(hy - 2, L + 2, Rr - 2); hairRow(hy - 1, L, Rr); hairRow(hy, L - 1, Rr + 1); hairRow(hy + 1, L - 1, Rr + 1);
        if (dir === 'down') {
          hairRow(hy + 2, L - 1, Rr + 1); hairRow(hy + 3, L, Rr);
          p.rect(L - 1, hy + 3, 2, 6, hc); p.rect(Rr, hy + 3, 2, 6, dk(hc)); p.px(L - 1, hy + 9, dk(hc)); p.px(Rr + 1, hy + 9, dk(hc));
        } else if (dir === 'side') {
          hairRow(hy + 2, L - 1, Rr - 1); hairRow(hy + 3, L - 1, Rr - 3); p.rect(L - 1, hy + 4, 5, 5, hc); p.rect(L - 1, hy + 8, 4, 1, dk(hc));
        } else { p.rect(L - 1, hy, hw + 2, hh, hc); p.rect(L - 1, hy + hh - 1, hw + 2, 1, dk(hc)); }
        p.px(L + 2, hy - 1, lit(hc)); p.px(L + 3, hy - 1, lit(hc)); p.px(L + 4, hy, lit(hc));
        return;
      }
      if (hs === 'shaggy') {          // thick black mop: bangs to the eyes, locks over the ears, tufts on top
        hairRow(hy - 2, L + 1, Rr - 1); hairRow(hy - 1, L - 1, Rr + 1); hairRow(hy, L - 1, Rr + 1); hairRow(hy + 1, L - 1, Rr + 1);
        p.px(L + 1, hy - 3, hc); p.px(L + 5, hy - 3, hc); p.px(Rr, hy - 2 - 1, hc);
        if (dir === 'down') {
          hairRow(hy + 2, L - 1, Rr + 1); hairRow(hy + 3, L, Rr);
          for (var sx = L; sx <= Rr; sx++) if ((sx * 5 + 1) % 3 !== 0) p.px(sx, hy + 4, hc);           // ragged fringe at eye level
          p.rect(L - 1, hy + 4, 2, 5, hc); p.rect(Rr, hy + 4, 2, 5, dk(hc)); p.px(L - 2, hy + 8, hc); p.px(Rr + 2, hy + 8, dk(hc));
        } else if (dir === 'side') {
          hairRow(hy + 2, L - 1, Rr); hairRow(hy + 3, L - 1, Rr - 1); p.px(Rr, hy + 4, hc);
          p.rect(L - 1, hy + 4, 5, 5, hc); p.px(L - 2, hy + 8, hc); p.px(Rr + 1, hy, hc);
        } else { p.rect(L - 1, hy, hw + 2, hh, hc); for (var tx = L - 1; tx <= Rr + 1; tx += 2) p.px(tx, hy + hh, hc); }
        p.px(L + 2, hy - 1, lit(hc)); p.px(L + 6, hy, lit(hc));
        return;
      }
      if (hs === 'bald') {
        if (dir !== 'down') { p.rect(L, hy + 4, dir === 'side' ? 3 : hw, 3, hc); }
        else { p.rect(L, hy + 4, 1, 3, hc); p.rect(Rr, hy + 4, 1, 3, hc); }
        p.px(L + 3, hy + 1, lit(skin)); p.px(L + 4, hy + 1, lit(skin));
        return;
      }
      // generic hair cap
      hairRow(hy - 1, L + 2, Rr - 2);
      hairRow(hy, L + 1, Rr - 1);
      hairRow(hy + 1, L, Rr);
      if (dir === 'down') {
        hairRow(hy + 2, L, Rr);
        // fringe
        for (var x = L + 1; x < Rr; x++) if ((x * 7 + (hs === 'messy' ? 3 : 0)) % 3 === 0) p.px(x, hy + 3, hc);
        p.rect(L, hy + 3, 1, 4, hc); p.rect(Rr, hy + 3, 1, 4, hc);
        if (hs === 'messy') { p.px(L + 2, hy - 2, hc); p.px(L + 5, hy - 2, hc); p.px(Rr + 1, hy + 1, hc); }
      } else if (dir === 'side') {
        hairRow(hy + 2, L, Rr - 2);
        p.rect(L, hy + 3, 4, 4, hc);
        if (hs === 'messy') { p.px(L + 3, hy - 2, hc); p.px(L - 1, hy + 2, hc); }
      } else {
        p.rect(L, hy + 1, hw, hh - 2, hc);
        p.px(L - 0, hy + 5, skin); p.px(Rr, hy + 5, skin);
      }
      p.px(L + 2, hy, lit(hc)); p.px(L + 3, hy, lit(hc));
      if (hs === 'long' || hs === 'braid' || hs === 'ponytail') {
        var len = hs === 'long' ? 9 : 7;
        if (dir === 'down' && hs === 'long') { p.rect(L - 1, hy + 2, 2, len, hc); p.rect(Rr, hy + 2, 2, len, dk(hc)); }
        if (dir === 'down' && hs === 'braid') { p.rect(Rr, hy + 4, 2, 9, hc); p.px(Rr + 1, hy + 13, d.ribbon || [160, 40, 40]); }
        if (dir === 'side') { p.rect(L - 1, hy + 2, 3, len, hc); if (hs === 'ponytail') { p.rect(L - 2, hy + 2, 2, 6, dk(hc)); } }
        if (dir === 'up') { p.rect(L, hy + hh - 2, hw, hs === 'long' ? 8 : 2, hc); if (hs !== 'long') p.rect(cx - 1, hy + hh, 2, len, dk(hc)); }
      }
      if (hs === 'bun') {
        if (dir === 'side') p.rect(L - 2, hy + 1, 3, 3, hc); else p.rect(cx - 2, hy - 3, 4, 3, hc);
      }
      if (d.hat === 'cap') {
        hairRow(hy - 1, L + 1, Rr - 1, d.hatColor); hairRow(hy, L, Rr, d.hatColor); hairRow(hy + 1, L, Rr, dk(d.hatColor));
        if (dir === 'down') hairRow(hy + 2, L - 1, Rr + 1, dk(d.hatColor));
        if (dir === 'side') hairRow(hy + 2, Rr - 3, Rr + 2, dk(d.hatColor));
      } else if (d.hat === 'brim') {
        hairRow(hy - 2, L + 2, Rr - 2, d.hatColor); hairRow(hy - 1, L + 1, Rr - 1, d.hatColor); hairRow(hy, L + 1, Rr - 1, d.hatColor);
        hairRow(hy + 1, L - 2, Rr + 2, dk(d.hatColor));
      } else if (d.hat === 'kamilavka') {
        p.rect(L + 1, hy - 4, hw - 2, 5, d.hatColor); p.rect(L + 1, hy - 4, hw - 2, 1, lit(d.hatColor));
      } else if (d.hat === 'wreath') {
        for (x = L; x <= Rr; x++) p.px(x, hy, (x % 2) ? [200, 60, 60] : (x % 3 ? [230, 210, 90] : [70, 120, 60]));
        p.px(L - 1, hy + 1, [240, 240, 230]); p.px(Rr + 1, hy + 1, [200, 60, 120]);
      }
    }

    // painter order depends on direction (side: far arm hidden)
    if (isSkirt) skirt();
    else if (dir === 'side') legsSide();
    else legsFront();
    if (dir === 'up') { arms(); torso(); head(); }
    else { torso(); head(); arms(); }
  }

  var seen = {};
  function frameKey(p) { var h1 = 2166136261, h2 = 5381, d = p.d; for (var i = 0; i < d.length; i++) { h1 = Math.imul(h1 ^ d[i], 16777619); h2 = (Math.imul(h2, 33) + d[i]) | 0; } return h1 + ':' + h2; }
  function paintFrame(name, d, pose) {
    var p = new BTS.Atlas.Painter(FW, FH);
    p.wrap = false;
    draw(p, d, pose);
    p.outline(d.outline || OUTLINE);
    if (pose.flip) p.flipX();
    // identical frames (e.g. both idle frames, or poses that do not differ for a direction) share one atlas region
    var k = frameKey(p);
    if (seen[k]) { BTS.Atlas.regions[name] = seen[k]; return seen[k]; }
    var r = BTS.Atlas.commit(name, p);
    seen[k] = r;
    return r;
  }
  /* lying body: the front pose with closed eyes and arms along the body, turned 90 degrees (head to the left),
     cropped to its bounding box so nothing is cut, resting on the bottom row of the frame */
  function paintLie(name, d) {
    var src = new BTS.Atlas.Painter(FW, FH); src.wrap = false;
    draw(src, d, { dir: 'down', anim: 'lie', f: 0 });
    src.outline(d.outline || OUTLINE);
    var x0 = FW, x1 = -1, y0 = FH, y1 = -1, x, y;
    for (y = 0; y < FH; y++) for (x = 0; x < FW; x++) if (src.alpha(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    var w = y1 - y0 + 1, h = x1 - x0 + 1;
    var p = new BTS.Atlas.Painter(w + 2, h + 1); p.wrap = false;
    for (y = y0; y <= y1; y++) for (x = x0; x <= x1; x++) {
      var c = src.get(x, y); if (!c || c[3] === 0) continue;
      p.px(1 + (y - y0), x - x0, c, c[3]);          // rotate: top of the body -> left, viewer's left -> top
    }
    return BTS.Atlas.commit(name, p);
  }

  var ANIMS = {
    idle: { n: 2, fps: 1.2 }, walk: { n: 4, fps: 7 }, run: { n: 4, fps: 11 }, talk: { n: 2, fps: 3 },
    interact: { n: 1, fps: 1 }, fear: { n: 2, fps: 8 }, weak: { n: 2, fps: 0.8 }, point: { n: 1, fps: 1 },
    sit: { n: 1, fps: 1 }, kneel: { n: 1, fps: 1 }, cower: { n: 2, fps: 4 }, sketch: { n: 2, fps: 2 }, blank: { n: 1, fps: 1 }
  };
  var DIRS = ['down', 'up', 'right', 'left'];

  /* Build all frames for one character. Returns {anims:{'walk_down':{frames,fps}}, ...} */
  function buildChar(id, d) {
    var sheet = { id: id, anims: {} };
    Object.keys(ANIMS).forEach(function (an) {
      DIRS.forEach(function (dir) {
        var frames = [];
        for (var f = 0; f < ANIMS[an].n; f++) {
          var pose = { dir: dir === 'left' || dir === 'right' ? 'side' : dir, anim: an === 'blank' ? 'idle' : an, f: f, flip: dir === 'left', needle: d.needle };
          if (an === 'blank') pose.anim = 'blank';
          var nm = 'ch_' + id + '_' + an + '_' + dir + '_' + f;
          frames.push(paintFrame(nm, d, pose));
        }
        sheet.anims[an + '_' + dir] = { frames: frames, fps: ANIMS[an].fps, loop: true };
      });
    });
    var lie = paintLie('ch_' + id + '_lie', d);
    DIRS.forEach(function (dir) { sheet.anims['lie_' + dir] = { frames: [lie], fps: 1, loop: true }; });
    return sheet;
  }

  var sheets = {};
  function build() {
    var defs = BTS.Data.characters;
    Object.keys(defs).forEach(function (id) {
      var d = defs[id];
      if (d.sprite === false) return;
      sheets[id] = buildChar(id, d);
    });
    BTS.Log.info('character sheets:', Object.keys(sheets).length);
  }

  /* story-driven look changes: Jaglika wears down as the autumn goes on (bright at the fair, gaunt from chapter 6),
     except in the memory of nine years ago */
  function variant(id) {
    if (id !== 'jaglika' && id !== 'jaglika_needle') return id;
    var S = BTS.Story, st = BTS.State && BTS.State.d;
    if (!S || !st || !st.beat || !S.indexOf) return id;
    var late = S.indexOf(st.beat) >= S.indexOf('c6_plan') && st.beat !== 'c8_memory';
    return late && sheets[id + '_late'] ? id + '_late' : id;
  }

  return { build: build, sheets: sheets, FW: FW, FH: FH, ANIMS: ANIMS, variant: variant };
})();
