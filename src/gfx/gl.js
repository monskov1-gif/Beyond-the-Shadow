/* Thin WebGL2 helpers: programs, uniforms, framebuffers, textures. */
'use strict';
BTS.GL = (function () {
  var gl = null;
  var GLX = {};

  GLX.init = function (canvas) {
    gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2_unsupported');
    GLX.gl = gl;
    GLX.floatTargets = !!gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    BTS.Log.info('WebGL2 ready; float targets:', GLX.floatTargets, gl.getParameter(gl.RENDERER));
    return gl;
  };

  function compile(type, src, name) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(s);
      var numbered = src.split('\n').map(function (l, i) { return (i + 1) + ': ' + l; }).join('\n');
      BTS.Log.error('shader compile failed', name, log, '\n' + numbered);
      throw new Error('shader ' + name + ': ' + log);
    }
    return s;
  }

  GLX.program = function (name, vs, fs, attribs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, '#version 300 es\nprecision highp float;\n' + vs, name + '.vs'));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\n' + fs, name + '.fs'));
    if (attribs) for (var i = 0; i < attribs.length; i++) gl.bindAttribLocation(p, i, attribs[i]);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link ' + name + ': ' + gl.getProgramInfoLog(p));
    var uniforms = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var u = 0; u < n; u++) {
      var info = gl.getActiveUniform(p, u);
      var nm = info.name.replace(/\[0\]$/, '');
      uniforms[nm] = gl.getUniformLocation(p, info.name);
    }
    return { name: name, id: p, u: uniforms };
  };

  GLX.texture = function (source, opts) {
    opts = opts || {};
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    var filter = opts.linear ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return t;
  };

  /* Render target with optional depth texture. */
  GLX.target = function (w, h, opts) {
    opts = opts || {};
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    var color = null, depth = null;
    if (!opts.depthOnly) {
      color = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, color);
      var hdr = opts.hdr && GLX.floatTargets;
      gl.texImage2D(gl.TEXTURE_2D, 0, hdr ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      var f = opts.linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
    }
    if (opts.depth || opts.depthOnly) {
      depth = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, depth);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    }
    if (opts.depthOnly) { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
    var st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (st !== gl.FRAMEBUFFER_COMPLETE) BTS.Log.error('framebuffer incomplete', st, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fb: fb, color: color, depth: depth, w: w, h: h };
  };
  GLX.freeTarget = function (t) {
    if (!t) return;
    gl.deleteFramebuffer(t.fb);
    if (t.color) gl.deleteTexture(t.color);
    if (t.depth) gl.deleteTexture(t.depth);
  };

  /* Static or dynamic interleaved mesh. layout: [[name,size],...] */
  GLX.mesh = function (layout, data, dynamic) {
    var vao = gl.createVertexArray();
    var vbo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    var stride = 0;
    layout.forEach(function (l) { stride += l[1]; });
    gl.bufferData(gl.ARRAY_BUFFER, data, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    var off = 0;
    layout.forEach(function (l, i) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, l[1], gl.FLOAT, false, stride * 4, off * 4);
      off += l[1];
    });
    gl.bindVertexArray(null);
    return { vao: vao, vbo: vbo, stride: stride, count: data.length / stride, cap: data.length };
  };
  GLX.updateMesh = function (m, data, count) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo);
    if (data.length > m.cap) { gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); m.cap = data.length; }
    else gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, count * m.stride);
    m.count = count;
  };
  GLX.freeMesh = function (m) { if (!m) return; gl.deleteBuffer(m.vbo); gl.deleteVertexArray(m.vao); };

  return GLX;
})();
