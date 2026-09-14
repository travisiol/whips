import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { BAYSIDE, BAYSIDE_RGB, glowPlane, radialGlowTexture } from "./studio";

/**
 * Wet asphalt: a planar reflection of the scene, softened with a five-tap
 * blur and faded out with distance, composited additively so it sits on the
 * page's own background with no seam. Only the reflection is painted; the
 * asphalt itself is the CSS.
 */
const WetFloorShader = {
  name: "WetFloorShader",
  uniforms: {
    color: { value: null as THREE.Color | null },
    tDiffuse: { value: null as THREE.Texture | null },
    textureMatrix: { value: null as THREE.Matrix4 | null },
    strength: { value: 0.55 },
    radius: { value: 8 },
    blur: { value: 0.004 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vec4 world = modelMatrix * vec4(position, 1.0);
      vWorld = world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float radius;
    uniform float blur;
    varying vec4 vUv;
    varying vec3 vWorld;
    void main() {
      float w = vUv.w;
      float o = blur * w;
      vec3 r = texture2DProj(tDiffuse, vUv).rgb * 0.36
        + texture2DProj(tDiffuse, vUv + vec4(o, 0.0, 0.0, 0.0)).rgb * 0.16
        + texture2DProj(tDiffuse, vUv - vec4(o, 0.0, 0.0, 0.0)).rgb * 0.16
        + texture2DProj(tDiffuse, vUv + vec4(0.0, o, 0.0, 0.0)).rgb * 0.16
        + texture2DProj(tDiffuse, vUv - vec4(0.0, o, 0.0, 0.0)).rgb * 0.16;
      float d = length(vWorld.xz);
      float fade = 1.0 - smoothstep(radius * 0.3, radius, d);
      vec3 c = r * strength * fade;
      gl_FragColor = vec4(c, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      // Additive over a transparent canvas: alpha follows the light, so
      // unreflected asphalt stays the page's own colour, not black.
      gl_FragColor.a = clamp(max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)) * 1.5, 0.0, 1.0);
    }`,
};

export function createWetFloor(size: number, textureWidth: number, strength = 0.55): Reflector {
  const reflector = new Reflector(new THREE.PlaneGeometry(size, size), {
    clipBias: 0.003,
    textureWidth,
    textureHeight: textureWidth,
    color: 0x000000,
    shader: WetFloorShader,
    multisample: 2,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = -0.002;
  const material = reflector.material as THREE.ShaderMaterial;
  material.transparent = true;
  material.blending = THREE.AdditiveBlending;
  material.depthWrite = false;
  material.uniforms.strength.value = strength;
  material.uniforms.radius.value = size / 2;
  return reflector;
}

/** The ring of light the objects sit on: an emissive torus, a glow on the floor and a light in the middle. */
export function createLightRing(radius: number, tube = 0.025): THREE.Group {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 12, 160),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(BAYSIDE).multiplyScalar(2.2), toneMapped: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = tube;
  group.add(ring);
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube * 5, 8, 160),
    new THREE.MeshBasicMaterial({ color: BAYSIDE, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = tube;
  group.add(halo);
  const spill = glowPlane(radialGlowTexture(BAYSIDE_RGB, 0.5), radius * 3.2);
  spill.position.y = 0.004;
  group.add(spill);
  const light = new THREE.PointLight(BAYSIDE, 6, radius * 4, 2);
  light.position.set(0, 0.4, 0);
  group.add(light);
  return group;
}
