export const skyVertex = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const skyFragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uViewport;
uniform vec2 uPointer;
uniform float uTime;
uniform sampler2D uArtwork;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), f.x), f.y);
}

float cloud(vec2 p) {
  float value = noise(p) * 0.57;
  p = p * 2.03 + vec2(7.1, 3.8);
  value += noise(p) * 0.28;
  return value + noise(p * 2.01) * 0.15;
}

float lantern(vec2 p, vec2 center, vec2 spread) {
  vec2 delta = (p - center) / spread;
  return exp(-dot(delta, delta));
}

vec3 grade(vec3 color) {
  return mix(vec3(dot(color, vec3(0.2126, 0.7152, 0.0722))), color, 0.82) * 0.74;
}

void main() {
  vec2 imageSize = vec2(1600.0, 900.0);
  float cover = max(uViewport.x / imageSize.x, uViewport.y / imageSize.y);
  vec2 visible = uViewport / (imageSize * cover);
  vec2 imageUv = vUv * visible + (1.0 - visible) * vec2(0.5, 0.45);
  vec2 scene = vec2(imageUv.x, 1.0 - imageUv.y);
  vec2 p = scene + uPointer * vec2(0.003, 0.0015);
  vec3 artwork = texture2D(uArtwork, imageUv).rgb;
  float luminance = dot(artwork, vec3(0.2126, 0.7152, 0.0722));
  float t = uTime * 0.055;
  float gutter = smoothstep(360.0, 760.0, abs(vUv.x - 0.5) * uViewport.x);
  float focus = 0.35 + gutter * 0.65;

  float sky = smoothstep(0.57, 0.68, scene.x)
    * (1.0 - smoothstep(0.31, 0.48, scene.y)) * smoothstep(0.10, 0.23, luminance);
  float skyHeight = (1.0 - visible.y) * 0.55 + visible.y * 0.21;
  float arc = skyHeight + sin(p.x * 10.0 + t * 0.42) * 0.045
    + sin(p.x * 23.0 - t * 0.6) * 0.015;
  float fold = sin(p.x * 53.0 + sin(p.x * 17.0 + t) * 2.3 - t * 0.8);
  float strands = 0.55 + 0.45 * sin(p.x * 220.0 + fold * 3.0 + t);
  float distance = p.y - arc - fold * 0.004;
  float hem = exp(-abs(distance) * 175.0);
  float curtain = exp(-abs(distance + 0.035) * 25.0)
    * (1.0 - smoothstep(-0.008, 0.02, distance));
  float ribbon = (hem * 0.4 + curtain * strands * 0.36) * sky * focus;
  float secondArc = arc + 0.077 + sin(p.x * 14.0 + t) * 0.018;
  float echo = exp(-abs(p.y - secondArc) * 72.0) * sky * focus * 0.10;
  vec3 auroraColor = mix(vec3(0.16, 0.68, 0.43), vec3(0.24, 0.42, 0.70),
    smoothstep(-0.055, 0.03, distance));
  vec3 color = auroraColor * ribbon + vec3(0.22, 0.49, 0.59) * echo;
  float alpha = ribbon * 0.22 + echo * 0.2;

  float lowMist = cloud(p * vec2(5.0, 16.0) + vec2(-t * 0.4, t * 0.1));
  float highMist = cloud(p * vec2(8.0, 22.0) + vec2(t * 0.3 + 9.0, 2.0));
  float bank = exp(-pow((p.y - 0.62 - lowMist * 0.09) * 15.0, 2.0))
    * smoothstep(0.62, 0.76, p.x);
  float foreground = exp(-pow((p.y - 0.94 + highMist * 0.07) * 10.0, 2.0));
  float mist = (bank * 0.28 + foreground * 0.13) * smoothstep(0.3, 0.82, lowMist) * focus;
  vec3 mistColor = mix(vec3(0.24, 0.39, 0.42), vec3(0.47, 0.36, 0.23),
    1.0 - smoothstep(0.2, 0.65, p.x));
  color += mistColor * mist;
  alpha += mist * 0.7;

  float lake = smoothstep(0.71, 0.78, scene.x) * smoothstep(0.64, 0.68, scene.y)
    * (1.0 - smoothstep(0.735, 0.775, scene.y));
  float ripple = sin(scene.y * 440.0 + sin(scene.x * 65.0 + t) * 1.8 + uTime * 0.6);
  vec2 waterUv = imageUv + vec2(sin(scene.y * 190.0 + uTime * 0.45) * 0.0011,
    ripple * 0.00065) * lake;
  vec3 water = grade(texture2D(uArtwork, waterUv).rgb);
  color += water * lake * 0.55;
  alpha += lake * 0.55;
  float reflection = pow(max(0.0, ripple), 8.0) * lake * highMist * 0.024;
  color += vec3(0.40, 0.61, 0.56) * reflection;

  float fire = 0.86 + sin(uTime * 1.3) * 0.065
    + sin(uTime * 2.7 + 1.0) * 0.045 + sin(uTime * 4.1) * 0.025;
  float lights = lantern(scene, vec2(0.371, 0.494), vec2(0.033, 0.061))
    + lantern(scene, vec2(0.460, 0.500), vec2(0.027, 0.056))
    + lantern(scene, vec2(0.529, 0.239), vec2(0.024, 0.048));
  float windows = lantern(scene, vec2(0.282, 0.547), vec2(0.038, 0.091))
    + lantern(scene, vec2(0.124, 0.539), vec2(0.027, 0.076))
    + lantern(scene, vec2(0.398, 0.258), vec2(0.037, 0.09))
    + lantern(scene, vec2(0.058, 0.281), vec2(0.018, 0.07));
  float warmPixels = smoothstep(0.08, 0.35, artwork.r - artwork.b);
  float warmth = (lights * 0.18 + windows * warmPixels * 0.18) * fire;
  color += vec3(1.0, 0.46, 0.12) * warmth;
  alpha += warmth * 0.15;
  gl_FragColor = vec4(color, min(alpha, 0.85));
}
`;

export const emberVertex = `
precision highp float;
attribute vec4 aSeed;
uniform vec2 uViewport;
uniform vec2 uPointer;
uniform float uTime;
uniform float uScale;
varying float vOpacity;
varying float vCool;
void main() {
  float depth = 0.25 + aSeed.z * 0.75;
  float life = fract(aSeed.y + uTime * (0.009 + aSeed.z * 0.012));
  float x = aSeed.x + sin(life * 7.0 + aSeed.w * 30.0) * 0.018 * depth;
  x += sin(uTime * 0.16 + aSeed.w * 9.0) * 0.009 * depth;
  vec2 position = vec2(x, life * 1.16 - 0.08) + uPointer * 0.015 * depth;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = (2.8 + pow(aSeed.z, 5.0) * 14.0) * uScale;
  float gutter = smoothstep(470.0, 760.0, abs(x - 0.5) * uViewport.x);
  float breath = 0.75 + 0.25 * sin(uTime * 0.8 + aSeed.w * 24.0);
  vOpacity = pow(sin(life * 3.14159), 1.5) * (0.14 + gutter * 0.6) * breath;
  vCool = step(0.76, aSeed.w);
}
`;

export const emberFragment = `
precision mediump float;
varying float vOpacity;
varying float vCool;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float glow = exp(-d * d * 5.0) * (1.0 - smoothstep(0.7, 1.0, d));
  vec3 color = mix(vec3(1.0, 0.49, 0.12), vec3(0.43, 0.71, 0.69), vCool);
  color = mix(color, vec3(1.0, 0.87, 0.53), exp(-d * d * 40.0) * (1.0 - vCool));
  float alpha = glow * vOpacity;
  gl_FragColor = vec4(color * alpha, alpha);
}
`;
