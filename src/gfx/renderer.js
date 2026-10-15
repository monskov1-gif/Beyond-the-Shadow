/* Renderer: shadow map, low-res HDR scene pass (3D world + 2D sprites + fx), bloom, DOF,
   colour grading and nearest-neighbour upscale for a unified pixel scale. */
'use strict';
BTS.Renderer = (function () {
  var GLX = BTS.GL, M = BTS.M, S = BTS.Shaders;
  var gl, R = {};
  var progWorld, progDepth, progFx, progBright, progBlur, progCopy, progComp;
  var atlasTex, quadVAO;
  var T = {};                  // render targets
  var spriteData = [], fxData = { 0: [], 1: [], 2: [], 3: [] };
  var spriteMesh, fxMeshes = {};
  var FX_STRIDE = 13;
  R.internal = [640, 360]; R.scale = 2; R.viewport = [0, 0, 1280, 720];
  R.stats = { draws: 0, tris: 0, sprites: 0, fx: 0 };
  R.shadowSize = 2048;

  R.init = function (canvas) {
    R.canvas = canvas;
    gl = GLX.init(canvas);
    progWorld = GLX.program('world', S.worldVS, S.worldFS);
    progDepth = GLX.program('depth', S.worldVS, S.depthFS);
    progFx = GLX.program('fx', S.fxVS, S.fxFS);
    progBright = GLX.program('bright', S.quadVS, S.brightFS);
    progBlur = GLX.program('blur', S.quadVS, S.blurFS);
    progCopy = GLX.program('copy', S.quadVS, S.copyFS);
    progComp = GLX.program('composite', S.quadVS, S.compositeFS);
    quadVAO = gl.createVertexArray();
    gl.bindVertexArray(quadVAO);
    var qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    spriteMesh = GLX.mesh(BTS.LAYOUT, new Float32Array(BTS.STRIDE * 6 * 64), true);
    [0, 1, 2, 3].forEach(function (m) { fxMeshes[m] = GLX.mesh([['aPos', 3], ['aUV', 2], ['aTile', 4], ['aCol', 4]], new Float32Array(FX_STRIDE * 6 * 64), true); });
    T.shadow = GLX.target(R.shadowSize, R.shadowSize, { depthOnly: true });
    R.resize();
  };

  R.uploadAtlas = function () {
    if (atlasTex) gl.deleteTexture(atlasTex);
    atlasTex = GLX.texture(BTS.Atlas.canvas);
  };

  R.resize = function () {
    var c = R.canvas;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = Math.max(320, Math.floor(c.clientWidth * dpr)), ch = Math.max(200, Math.floor(c.clientHeight * dpr));
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    var targetH = (BTS.Config.get('pixelScale') || 360) * (R.zoom || 1);
    var scale = Math.max(1, Math.round(ch / targetH));
    var ih = Math.floor(ch / scale), iw = Math.floor(cw / scale);
    var vw = iw * scale, vh = ih * scale;
    R.viewport = [Math.floor((cw - vw) / 2), Math.floor((ch - vh) / 2), vw, vh];
    if (T.scene && T.scene.w === iw && T.scene.h === ih) return;
    if (ih < 120) return;
    R.internal = [iw, ih]; R.scale = scale;
    ['scene', 'halfA', 'halfB', 'qA', 'qB'].forEach(function (k) { GLX.freeTarget(T[k]); });
    T.scene = GLX.target(iw, ih, { hdr: true, depth: true });
    T.halfA = GLX.target(iw >> 1, ih >> 1, { hdr: true, linear: true });
    T.halfB = GLX.target(iw >> 1, ih >> 1, { hdr: true, linear: true });
    T.qA = GLX.target(iw >> 2, ih >> 2, { hdr: true, linear: true });
    T.qB = GLX.target(iw >> 2, ih >> 2, { hdr: true, linear: true });
    BTS.Log.info('render internal', iw + 'x' + ih, 'scale', scale);
  };

  /* ---------------- immediate-mode batches ---------------- */
  R.beginFrame = function () { spriteData.length = 0; fxData[0].length = 0; fxData[1].length = 0; fxData[2].length = 0; fxData[3].length = 0; };

  /* Camera-facing sprite anchored at feet (x,y,z). o: {flip, scale, tint:[r,g,b], alpha, unlit, lift, emissive} */
  R.pushSprite = function (reg, x, y, z, o) {
    if (!reg) return;
    o = o || {};
    var cam = BTS.Camera;
    var s = (o.scale || 1) / 16, w = reg.w * s, h = reg.h * s;
    var rx = cam.right[0], rz = cam.right[2];
    var tilt = o.tilt === undefined ? 0.18 : o.tilt;   // lean toward camera for nicer projection
    var tx = cam.toward[0] * tilt, tz = cam.toward[2] * tilt;
    var hw = w / 2, q = 0.9999;
    var u0 = o.flip ? q : 0, u1 = o.flip ? 0 : q;
    var t = o.tint || [1, 1, 1];
    var mat = o.emissive ? BTS.MAT.EMISSIVE : (o.mat === undefined ? BTS.MAT.SPRITE : o.mat);
    var fy = y + (o.lift || 0);
    var nx = x, ny = y + 0.3, nz = z;           // foot position used for shadow lookup (sprite mode)
    if (mat !== BTS.MAT.SPRITE) { nx = 0; ny = 0.35; nz = 1; }
    var a = (o.wind || 0);
    var P = [[x - rx * hw, fy, z - rz * hw, 0], [x + rx * hw, fy, z + rz * hw, 0], [x + rx * hw + tx * h, fy + h, z + rz * hw + tz * h, a], [x - rx * hw + tx * h, fy + h, z - rz * hw + tz * h, a]];
    var UV = [[u0, q], [u1, q], [u1, 0], [u0, 0]];
    var order = [0, 1, 2, 0, 2, 3];
    for (var i = 0; i < 6; i++) {
      var k = order[i], p = P[k];
      spriteData.push(p[0], p[1], p[2], nx, ny, nz, UV[k][0], UV[k][1], reg.u0, reg.v0, reg.du, reg.dv, t[0], t[1], t[2], p[3], mat);
    }
  };
  /* generic textured quad in fx pass. mode 0: ground shadow (alpha test), 1: alpha, 2: additive, 3: soft shadow */
  R.pushFx = function (mode, P, reg, col, uvs) {
    if (!reg) return;
    var d = fxData[mode];
    var q = 0.9999;
    var UV = uvs || [[0, q], [q, q], [q, 0], [0, 0]];
    var order = [0, 1, 2, 0, 2, 3];
    for (var i = 0; i < 6; i++) {
      var k = order[i];
      d.push(P[k][0], P[k][1], P[k][2], UV[k][0], UV[k][1], reg.u0, reg.v0, reg.du, reg.dv, col[0], col[1], col[2], col[3]);
    }
  };
  /* camera-facing particle quad centred at (x,y,z) */
  R.pushParticle = function (mode, reg, x, y, z, size, col, stretchY) {
    var cam = BTS.Camera, rx = cam.right[0] * size / 2, rz = cam.right[2] * size / 2;
    var hy = size / 2 * (stretchY || 1);
    var ux = cam.up[0] * hy, uy = cam.up[1] * hy, uz = cam.up[2] * hy;
    R.pushFx(mode, [[x - rx - ux, y - uy, z - rz - uz], [x + rx - ux, y - uy, z + rz - uz], [x + rx + ux, y + uy, z + rz + uz], [x - rx + ux, y + uy, z - rz + uz]], reg, col);
  };

  /* ---------------- frame ---------------- */
  function useWorldUniforms(p, env, cam, vp) {
    var u = p.u;
    gl.uniformMatrix4fv(u.uVP, false, vp);
    gl.uniform1f(u.uTime, BTS.App.time);
    gl.uniform3fv(u.uWind, env.wind);
    if (p === progDepth) return;
    gl.uniformMatrix4fv(u.uShadowVP, false, R.shadowVP);
    gl.uniform1f(u.uShadowOn, env.shadowOn ? 1 : 0);
    gl.uniform3fv(u.uSunDir, env.sunDir);
    gl.uniform3fv(u.uSunCol, env.sunCol);
    gl.uniform3fv(u.uSkyCol, env.skyCol);
    gl.uniform3fv(u.uGroundCol, env.groundCol);
    gl.uniform3fv(u.uFogCol, env.fogCol);
    gl.uniform1f(u.uFogDensity, env.fogDensity);
    gl.uniform1f(u.uFogHeight, env.fogHeight || 0);
    gl.uniform1f(u.uFogStart, cam.dist * 0.72);
    gl.uniform3fv(u.uCamPos, cam.eye);
    gl.uniform1f(u.uWet, env.interior ? 0 : env.wet);
    gl.uniform1f(u.uWindowGlow, env.windowGlow);
    gl.uniform1f(u.uFlash, env.interior ? env.flash * 0.3 : env.flash);
    gl.uniform1f(u.uDesat, env.desat || 0);
    gl.uniform3fv(u.uTint, env.tint || [1, 1, 1]);
    var lights = env.activeLights || [];
    var n = Math.min(lights.length, S.MAXL);
    var lp = new Float32Array(S.MAXL * 4), lc = new Float32Array(S.MAXL * 4);
    for (var i = 0; i < n; i++) {
      var L = lights[i];
      lp[i * 4] = L.x; lp[i * 4 + 1] = L.y; lp[i * 4 + 2] = L.z; lp[i * 4 + 3] = L.radius;
      lc[i * 4] = L.cur[0]; lc[i * 4 + 1] = L.cur[1]; lc[i * 4 + 2] = L.cur[2];
    }
    gl.uniform4fv(u.uLightPos, lp); gl.uniform4fv(u.uLightCol, lc);
    gl.uniform1i(u.uLightCount, n);
    gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uShadow, 1);
  }

  function drawMesh(m) {
    if (!m || !m.count) return;
    gl.bindVertexArray(m.vao);
    gl.drawArrays(gl.TRIANGLES, 0, m.count);
    R.stats.draws++; R.stats.tris += m.count / 3;
  }

  function quad() { gl.bindVertexArray(quadVAO); gl.drawArrays(gl.TRIANGLES, 0, 6); }
  function pass(target, prog) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    if (target) gl.viewport(0, 0, target.w, target.h);
    gl.useProgram(prog.id);
  }
  function bindTex(unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }

  R.render = function (world, env, cam) {
    R.resize();
    R.stats.draws = 0; R.stats.tris = 0;
    var chunks = world ? world.chunks : [];
    var effects = BTS.Config.get('effects');

    /* upload batches */
    GLX.updateMesh(spriteMesh, new Float32Array(spriteData), spriteData.length / BTS.STRIDE);
    R.stats.sprites = spriteData.length / BTS.STRIDE / 6;
    var fxCount = 0;
    [0, 1, 2, 3].forEach(function (m) { GLX.updateMesh(fxMeshes[m], new Float32Array(fxData[m]), fxData[m].length / FX_STRIDE); fxCount += fxData[m].length; });
    R.stats.fx = fxCount / FX_STRIDE / 6;

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    bindTex(0, atlasTex);

    /* 1. shadow map */
    var shadowOn = env.shadowOn && effects > 0;
    env.shadowOn = shadowOn;
    if (shadowOn) {
      var c = cam.target, ext = world && world.interior ? 14 : 30;
      var sd = env.sunDir;
      var eye = [c[0] - sd[0] * 60, c[1] - sd[1] * 60, c[2] - sd[2] * 60];
      var view = M.lookAt(M.mat4(), eye, c, Math.abs(sd[1]) > 0.98 ? [0, 0, 1] : [0, 1, 0]);
      var proj = M.ortho(M.mat4(), -ext, ext, -ext, ext, 1, 140);
      R.shadowVP = M.mul(M.mat4(), proj, view);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.shadow.fb);
      gl.viewport(0, 0, R.shadowSize, R.shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(progDepth.id);
      useWorldUniforms(progDepth, env, cam, R.shadowVP);
      gl.uniform1i(progDepth.u.uTex, 0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
      for (var i = 0; i < chunks.length; i++) if (chunks[i].castShadow !== false && chunks[i].visible !== false) drawMesh(chunks[i].mesh);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    } else R.shadowVP = R.shadowVP || M.mat4();

    /* 2. main scene */
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.scene.fb);
    gl.viewport(0, 0, T.scene.w, T.scene.h);
    var fc = env.clearCol || env.fogCol;
    gl.clearColor(fc[0], fc[1], fc[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(progWorld.id);
    useWorldUniforms(progWorld, env, cam, cam.viewProj);
    bindTex(1, T.shadow.depth);
    bindTex(0, atlasTex);
    var uFade = progWorld.u.uFade;
    for (i = 0; i < chunks.length; i++) {
      var ch = chunks[i];
      if (ch.visible === false) continue;
      if (ch.max && !cam.boxVisible(ch.min, ch.max)) continue;
      gl.uniform1f(uFade, ch.fade === undefined ? 1 : ch.fade);
      drawMesh(ch.mesh);
    }
    gl.uniform1f(uFade, 1);
    drawMesh(spriteMesh);

    /* fx: shadows (blend, no depth write), particles */
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    gl.useProgram(progFx.id);
    gl.uniformMatrix4fv(progFx.u.uVP, false, cam.viewProj);
    gl.uniform1i(progFx.u.uTex, 0);
    gl.uniform3fv(progFx.u.uFogCol, env.fogCol);
    gl.uniform1f(progFx.u.uFogDensity, env.fogDensity);
    gl.uniform1f(progFx.u.uFogStart, cam.dist * 0.72);
    gl.uniform3fv(progFx.u.uCamPos, cam.eye);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
    // stencil-free shadow merge: draw mode 0 with min-blend-ish via alpha (acceptable overlap)
    gl.uniform1i(progFx.u.uMode, 0); drawMesh(fxMeshes[0]);
    gl.uniform1i(progFx.u.uMode, 3); drawMesh(fxMeshes[3]);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.uniform1i(progFx.u.uMode, 1); drawMesh(fxMeshes[1]);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.uniform1i(progFx.u.uMode, 2); drawMesh(fxMeshes[2]);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    /* 3. post: bloom (quarter res) and DOF blur (half res) */
    pass(T.qA, progBright); bindTex(0, T.scene.color); gl.uniform1i(progBright.u.uSrc, 0); gl.uniform1f(progBright.u.uThreshold, env.bloomThreshold || 0.75); quad();
    for (var it = 0; it < 2; it++) {
      pass(T.qB, progBlur); bindTex(0, T.qA.color); gl.uniform1i(progBlur.u.uSrc, 0); gl.uniform2f(progBlur.u.uDir, 1 + it, 0); quad();
      pass(T.qA, progBlur); bindTex(0, T.qB.color); gl.uniform2f(progBlur.u.uDir, 0, 1 + it); quad();
    }
    var dof = effects > 0 ? (env.dof === undefined ? 1 : env.dof) : 0;
    if (dof > 0) {
      pass(T.halfA, progCopy); bindTex(0, T.scene.color); gl.uniform1i(progCopy.u.uSrc, 0); quad();
      pass(T.halfB, progBlur); bindTex(0, T.halfA.color); gl.uniform1i(progBlur.u.uSrc, 0); gl.uniform2f(progBlur.u.uDir, 1.3, 0); quad();
      pass(T.halfA, progBlur); bindTex(0, T.halfB.color); gl.uniform2f(progBlur.u.uDir, 0, 1.3); quad();
      // second, wider pass: a soft lens blur instead of blocky pixels
      pass(T.halfB, progBlur); bindTex(0, T.halfA.color); gl.uniform2f(progBlur.u.uDir, 2.4, 0); quad();
      pass(T.halfA, progBlur); bindTex(0, T.halfB.color); gl.uniform2f(progBlur.u.uDir, 0, 2.4); quad();
    }

    /* 4. composite + nearest upscale to screen */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, R.canvas.width, R.canvas.height);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    var vpt = R.viewport;
    gl.viewport(vpt[0], vpt[1], vpt[2], vpt[3]);
    gl.useProgram(progComp.id);
    var u = progComp.u, g = env.grade;
    bindTex(0, T.scene.color); gl.uniform1i(u.uScene, 0);
    bindTex(1, T.qA.color); gl.uniform1i(u.uBloom, 1);
    bindTex(2, T.halfA.color); gl.uniform1i(u.uBlur, 2);
    bindTex(3, T.scene.depth); gl.uniform1i(u.uDepth, 3);
    gl.uniform2f(u.uInternal, T.scene.w, T.scene.h);
    gl.uniform4f(u.uViewport, vpt[0], vpt[1], vpt[2], vpt[3]);
    gl.uniform1f(u.uBloomK, effects > 0 ? g.bloom : 0);
    gl.uniform1f(u.uVignette, g.vignette);
    gl.uniform1f(u.uSat, g.sat);
    gl.uniform1f(u.uContrast, g.contrast);
    gl.uniform1f(u.uExposure, g.exposure);
    gl.uniform1f(u.uGrain, 0);   // animated grain shimmered in dark areas while moving — disabled
    gl.uniform1f(u.uTime, BTS.App.time);
    gl.uniform1f(u.uFade, env.fadeBlack || 0);
    gl.uniform1f(u.uSepia, env.sepia || 0);
    gl.uniform3fv(u.uLift, g.lift);
    gl.uniform3fv(u.uGain, g.gain);
    gl.uniform1f(u.uNear, cam.near); gl.uniform1f(u.uFar, cam.far);
    gl.uniform1f(u.uFocus, cam.focusDist);
    gl.uniform1f(u.uFocusRange, cam.focusRange);
    gl.uniform1f(u.uDofK, dof);
    gl.uniform1f(u.uHorror, env.horror || 0);
    gl.uniform1f(u.uFlash, env.flash);
    quad();
    gl.bindVertexArray(null);
    bindTex(0, atlasTex);
  };

  R.free = function (chunks) { (chunks || []).forEach(function (c) { GLX.freeMesh(c.mesh); }); };

  return R;
})();
