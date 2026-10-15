/* GLSL sources for the renderer. */
'use strict';
BTS.Shaders = (function () {
  var MAXL = 16;
  var common = [
    'float bayer4(vec2 p){ ivec2 i = ivec2(mod(p,4.0)); int idx = i.y*4+i.x;',
    ' float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.); return (m[idx]+0.5)/16.0; }',
    'float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
    'float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);',
    ' return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }'
  ].join('\n');

  var worldVS = [
    'layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUV;',
    'layout(location=3) in vec4 aTile; layout(location=4) in vec4 aCol; layout(location=5) in float aMat;',
    'uniform mat4 uVP; uniform float uTime; uniform vec3 uWind;',
    'out vec3 vWorld; out vec3 vNrm; out vec2 vUV; out vec4 vTile; out vec3 vCol; flat out int vMat;',
    'void main(){',
    '  vec3 p = aPos; float w = aCol.a;',
    '  if (w > 0.0) {',
    '    float ph = uTime*1.7 + p.x*0.45 + p.z*0.31;',
    '    float gust = 0.55 + 0.45*sin(uTime*0.6 + p.x*0.05);',
    '    p.xz += uWind.xz * w * gust * (0.25 + 0.12*sin(ph));',
    '    p.x += w * 0.035 * sin(ph*2.3) * (0.4 + length(uWind.xz));',
    '  }',
    '  vWorld = p; vNrm = aNrm; vUV = aUV; vTile = aTile; vCol = aCol.rgb; vMat = int(aMat + 0.5);',
    '  gl_Position = uVP * vec4(p, 1.0);',
    '}'
  ].join('\n');

  var worldFS = [
    common,
    'uniform sampler2D uTex; uniform sampler2D uShadow; uniform mat4 uShadowVP; uniform float uShadowOn;',
    'uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyCol; uniform vec3 uGroundCol;',
    'uniform vec4 uLightPos[' + MAXL + ']; uniform vec4 uLightCol[' + MAXL + ']; uniform int uLightCount;',
    'uniform vec3 uFogCol; uniform float uFogDensity; uniform float uFogHeight; uniform vec3 uCamPos; uniform float uFogStart;',
    'uniform float uWet; uniform float uWindowGlow; uniform float uFade; uniform float uTime; uniform float uFlash;',
    'uniform float uDesat; uniform vec3 uTint;',
    'in vec3 vWorld; in vec3 vNrm; in vec2 vUV; in vec4 vTile; in vec3 vCol; flat in int vMat;',
    'out vec4 outColor;',
    'float shadowAt(vec3 wp, vec3 n){',
    '  if (uShadowOn < 0.5) return 1.0;',
    '  vec4 sp = uShadowVP * vec4(wp + n*0.06, 1.0); vec3 s = sp.xyz/sp.w*0.5+0.5;',
    '  if (s.x<0.0||s.y<0.0||s.x>1.0||s.y>1.0||s.z>1.0) return 1.0;',
    '  float sum = 0.0; vec2 tx = 1.0/vec2(textureSize(uShadow,0));',
    '  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) { float d = texture(uShadow, s.xy + vec2(x,y)*tx).r; sum += (s.z - 0.0018 > d) ? 0.0 : 1.0; }',
    '  return sum/9.0;',
    '}',
    'void main(){',
    '  vec2 tuv = vTile.xy + fract(vUV) * vTile.zw;',
    '  vec4 tex = texture(uTex, tuv);',
    '  if (tex.a < 0.5) discard;',
    '  if (uFade < 0.995 && bayer4(gl_FragCoord.xy) > uFade) discard;',
    '  vec3 alb = tex.rgb * vCol;',
    '  int mat = vMat;',
    '  vec3 N = normalize(vNrm);',
    '  vec3 V = normalize(uCamPos - vWorld);',
    '  bool sprite = (mat == 10); bool foliage = (mat == 8);',
    '  vec3 shadowPos = vWorld;',
    '  if (sprite) { shadowPos = vNrm; N = normalize(vec3(0.0, 0.35, 1.0)); }',
    '  if (mat == 9) { outColor = vec4(alb * 1.6, 1.0); return; }',
    '  float wetK = 0.0; float puddle = 0.0;',
    '  if (mat == 6 || mat == 1) {',
    '    wetK = uWet;',
    '    if (mat == 6 && N.y > 0.9) { float n = vnoise(vWorld.xz*0.45) * 0.7 + vnoise(vWorld.xz*1.7)*0.3; puddle = smoothstep(0.72, 0.78, n) * smoothstep(0.35, 0.8, uWet); }',
    '    alb *= 1.0 - 0.38*wetK;',
    '  }',
    '  if (mat == 7) {',
    '    vec2 q = vWorld.xz; float r = sin(q.x*1.7 + uTime*1.4)*0.5 + sin(q.y*2.3 - uTime*1.1 + q.x)*0.5;',
    '    alb = mix(alb, uSkyCol*0.9 + vec3(0.04), 0.35 + 0.1*r);',
    '  }',
    '  if (foliage) shadowPos -= uSunDir * 0.9;',
    '  float sh = shadowAt(shadowPos, sprite ? vec3(0.0,1.0,0.0) : N);',
    '  float ndl = dot(N, -uSunDir);',
    '  if (sprite || foliage) ndl = 0.45 + 0.55*max(ndl, 0.0); else ndl = max(ndl, 0.0);',
    '  vec3 hemi = mix(uGroundCol, uSkyCol, N.y*0.5+0.5);',
    '  vec3 light = hemi + uSunCol * ndl * sh;',
    '  vec3 spec = vec3(0.0);',
    '  for (int i=0;i<' + MAXL + ';i++) { if (i >= uLightCount) break;',
    '    vec3 L = uLightPos[i].xyz - vWorld; float d = length(L); float rad = uLightPos[i].w;',
    '    if (d > rad) continue; L /= d;',
    '    float att = 1.0 - d/rad; att *= att;',
    '    float dl = (sprite || foliage) ? (0.55 + 0.45*max(dot(N,L),0.0)) : max(dot(N,L),0.0)*0.85 + 0.15;',
    '    light += uLightCol[i].rgb * dl * att;',
    '    if (wetK > 0.0 || mat == 4 || mat == 7 || mat == 5) { vec3 H = normalize(L+V); float gloss = (mat==4)? 24.0 : (mat==7 ? 60.0 : 26.0); spec += uLightCol[i].rgb * pow(max(dot(N,H),0.0), gloss) * att * (mat==4 ? 0.5 : (mat==7 ? 0.9 : min(0.45, 0.4*wetK + puddle*0.6))); }',
    '  }',
    '  if (wetK > 0.0 || mat == 7) { vec3 H = normalize(-uSunDir+V); spec += uSunCol * pow(max(dot(N,H),0.0), 40.0) * (0.3*wetK + puddle) * sh; }',
    '  vec3 col = alb * light + spec;',
    '  if (puddle > 0.0) { col = mix(col, col*0.6 + uSkyCol*0.12 + spec, puddle*0.6); }',
    '  if (mat == 5 && tex.a < 0.9) {',
    '    float flick = 0.9 + 0.1*sin(uTime*3.0 + vWorld.x*7.0);',
    '    col += vec3(1.0, 0.62, 0.30) * uWindowGlow * flick * 1.6;',
    '    col += uSkyCol * 0.25;',
    '  }',
    '  col += alb * uFlash * vec3(0.75, 0.8, 1.0);',
    '  float g = dot(col, vec3(0.299,0.587,0.114)); col = mix(col, vec3(g), uDesat); col *= uTint;',
    '  float dist = max(0.0, length(vWorld - uCamPos) - uFogStart);',
    '  float fogAmt = 1.0 - exp(-pow(dist * uFogDensity, 2.0));',
    '  fogAmt = max(fogAmt, uFogHeight * smoothstep(1.2, -0.6, vWorld.y) * 0.35 * smoothstep(8.0, 30.0, dist));',
    '  col = mix(col, uFogCol, clamp(fogAmt, 0.0, 1.0));',
    '  outColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var depthFS = [
    'uniform sampler2D uTex;',
    'in vec3 vWorld; in vec3 vNrm; in vec2 vUV; in vec4 vTile; in vec3 vCol; flat in int vMat;',
    'out vec4 o;',
    'void main(){ vec4 t = texture(uTex, vTile.xy + fract(vUV)*vTile.zw); if (t.a < 0.5 || vMat == 9 || vMat == 7) discard; o = vec4(1.0); }'
  ].join('\n');

  /* blended overlay pass: ground shadows (mode 0), particles alpha (1), additive (2) */
  var fxVS = [
    'layout(location=0) in vec3 aPos; layout(location=1) in vec2 aUV; layout(location=2) in vec4 aTile; layout(location=3) in vec4 aCol;',
    'uniform mat4 uVP; out vec2 vUV; out vec4 vTile; out vec4 vCol; out vec3 vWorld;',
    'void main(){ vUV=aUV; vTile=aTile; vCol=aCol; vWorld=aPos; gl_Position = uVP*vec4(aPos,1.0); }'
  ].join('\n');
  var fxFS = [
    'uniform sampler2D uTex; uniform int uMode; uniform vec3 uFogCol; uniform float uFogDensity; uniform vec3 uCamPos; uniform float uFogStart;',
    'in vec2 vUV; in vec4 vTile; in vec4 vCol; in vec3 vWorld; out vec4 o;',
    'void main(){',
    '  vec4 t = texture(uTex, vTile.xy + clamp(vUV,0.0,0.9999)*vTile.zw);',
    '  float fog = 1.0 - exp(-pow(max(0.0,length(vWorld-uCamPos)-uFogStart)*uFogDensity, 2.0));',
    '  if (uMode == 0) { float a = (t.a > 0.5 ? 1.0 : 0.0) * vCol.a * (1.0 - fog); if (a < 0.01) discard; o = vec4(vCol.rgb, a); return; }',
    '  if (uMode == 3) { float a = t.a * vCol.a * (1.0 - fog*0.7); if (a < 0.01) discard; o = vec4(vCol.rgb, a); return; }',
    '  vec4 c = vec4(t.rgb * vCol.rgb, t.a * vCol.a);',
    '  if (uMode == 1) c.rgb = mix(c.rgb, uFogCol, fog*0.8);',
    '  else c.a *= (1.0 - fog*0.6);',
    '  if (c.a < 0.01) discard;',
    '  o = c;',
    '}'
  ].join('\n');

  var quadVS = 'layout(location=0) in vec2 aP; out vec2 vUV; void main(){ vUV = aP*0.5+0.5; gl_Position = vec4(aP,0.0,1.0); }';
  var brightFS = [
    'uniform sampler2D uSrc; uniform float uThreshold; in vec2 vUV; out vec4 o;',
    'void main(){ vec3 c = texture(uSrc, vUV).rgb; float l = max(c.r, max(c.g, c.b)); o = vec4(c * smoothstep(uThreshold, uThreshold+0.6, l), 1.0); }'
  ].join('\n');
  var blurFS = [
    'uniform sampler2D uSrc; uniform vec2 uDir; in vec2 vUV; out vec4 o;',
    'void main(){ vec2 t = uDir / vec2(textureSize(uSrc,0));',
    ' vec3 c = texture(uSrc, vUV).rgb*0.227;',
    ' c += (texture(uSrc, vUV+t*1.384).rgb + texture(uSrc, vUV-t*1.384).rgb)*0.316;',
    ' c += (texture(uSrc, vUV+t*3.230).rgb + texture(uSrc, vUV-t*3.230).rgb)*0.070;',
    ' o = vec4(c,1.0); }'
  ].join('\n');
  var copyFS = 'uniform sampler2D uSrc; in vec2 vUV; out vec4 o; void main(){ o = vec4(texture(uSrc, vUV).rgb, 1.0); }';
  var compositeFS = [
    common,
    'uniform sampler2D uScene; uniform sampler2D uBloom; uniform sampler2D uBlur; uniform sampler2D uDepth;',
    'uniform vec2 uInternal; uniform vec2 uScreen; uniform vec4 uViewport;',
    'uniform float uBloomK; uniform float uVignette; uniform float uSat; uniform float uContrast; uniform float uExposure;',
    'uniform float uGrain; uniform float uTime; uniform float uFade; uniform float uSepia; uniform vec3 uLift; uniform vec3 uGain;',
    'uniform float uNear; uniform float uFar; uniform float uFocus; uniform float uFocusRange; uniform float uDofK; uniform float uHorror; uniform float uFlash;',
    'out vec4 o;',
    'float linDepth(float d){ float z = d*2.0-1.0; return 2.0*uNear*uFar/(uFar+uNear - z*(uFar-uNear)); }',
    'void main(){',
    '  vec2 sp = (gl_FragCoord.xy - uViewport.xy) / uViewport.zw;',
    '  ivec2 ip = ivec2(sp * uInternal);',
    '  vec3 c = texelFetch(uScene, ip, 0).rgb;',
    '  vec2 uv = (vec2(ip)+0.5)/uInternal;',
    '  float z = linDepth(texelFetch(uDepth, ip, 0).r);',
    '  float coc = clamp((abs(z - uFocus) - uFocusRange) / (uFocusRange*1.6), 0.0, 1.0);',
    '  if (z < uFocus) coc = clamp((uFocus - z - uFocusRange*1.1)/(uFocusRange*1.2), 0.0, 0.75);',
    '  coc *= uDofK;',
    '  vec3 blurred = texture(uBlur, sp).rgb;',                         // smooth, screen-resolution blur
    '  c = mix(c, blurred, smoothstep(0.0, 1.0, coc) * 0.85);',
    '  c += texture(uBloom, sp).rgb * uBloomK;',
    '  c *= uExposure;',
    '  c = c / (1.0 + c*0.22);',
    '  c = c * uGain + uLift * (1.0 - c);',
    '  float g = dot(c, vec3(0.299,0.587,0.114));',
    '  c = mix(vec3(g), c, uSat);',
    '  c = (c - 0.5) * uContrast + 0.5;',
    '  if (uSepia > 0.0) { vec3 s = vec3(g*1.07+0.04, g*0.92+0.02, g*0.72); c = mix(c, s, uSepia); }',
    '  vec2 q = sp - 0.5; float vig = 1.0 - dot(q,q) * uVignette * (1.0 + uHorror*0.8);',
    '  c *= clamp(vig, 0.0, 1.0);',
    '  c += (h21(vec2(ip) + fract(uTime*7.13)*91.0) - 0.5) * uGrain;',
    '  c += uFlash * 0.12;',
    '  c *= (1.0 - uFade);',
    '  o = vec4(clamp(c, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  return { MAXL: MAXL, worldVS: worldVS, worldFS: worldFS, depthFS: depthFS, fxVS: fxVS, fxFS: fxFS, quadVS: quadVS, brightFS: brightFS, blurFS: blurFS, copyFS: copyFS, compositeFS: compositeFS };
})();
