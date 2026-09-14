import * as THREE from "three";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import glyphs from "./wordmark-glyphs.json";
import { BAYSIDE, chrome } from "./studio";

/**
 * The wordmark as an object: "whips" cut from the embedded Archivo Black
 * Italic (public/fonts, converted to glyph outlines by scripts/font-glyphs.mjs),
 * extruded in chrome, tilted, with a speed trail of blue ghosts streaming
 * off the back of the letters.
 */
export type Wordmark = {
  group: THREE.Group;
  width: number;
  /** Advance the trail animation. */
  update: (time: number) => void;
  dispose: () => void;
};

export function createWordmark(text = "whips", size = 1): Wordmark {
  const font = new Font(glyphs as unknown as ConstructorParameters<typeof Font>[0]);
  const geometry = new TextGeometry(text, {
    font,
    size,
    depth: size * 0.3,
    curveSegments: 10,
    bevelEnabled: true,
    bevelThickness: size * 0.035,
    bevelSize: size * 0.022,
    bevelSegments: 3,
  });
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const width = bb.max.x - bb.min.x;
  const height = bb.max.y - bb.min.y;
  const depth = bb.max.z - bb.min.z;
  geometry.translate(-(bb.min.x + width / 2), -(bb.min.y + height / 2), -(bb.min.z + depth / 2));

  const group = new THREE.Group();
  const material = chrome();
  const letters = new THREE.Mesh(geometry, material);
  group.add(letters);

  // Speed trail: the same letters, pushed back and stretched, in fading blue.
  const ghosts: { mesh: THREE.Mesh; material: THREE.MeshBasicMaterial; base: number }[] = [];
  const count = 7;
  for (let i = 1; i <= count; i++) {
    const base = 0.16 * (1 - i / (count + 1));
    const ghostMaterial = new THREE.MeshBasicMaterial({
      color: BAYSIDE,
      transparent: true,
      opacity: base,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ghost = new THREE.Mesh(geometry, ghostMaterial);
    ghost.position.set(-i * size * 0.09, -i * size * 0.004, -i * size * 0.02);
    ghost.scale.set(1 + i * 0.012, 1, 1);
    ghost.renderOrder = -i;
    group.add(ghost);
    ghosts.push({ mesh: ghost, material: ghostMaterial, base });
  }

  const update = (time: number) => {
    for (let i = 0; i < ghosts.length; i++) {
      const g = ghosts[i];
      const wave = 0.5 + 0.5 * Math.sin(time * 2.4 - i * 0.55);
      g.material.opacity = g.base * (0.6 + 0.6 * wave);
      g.mesh.position.x = -(i + 1) * size * (0.085 + 0.02 * wave);
    }
  };

  return {
    group,
    width,
    update,
    dispose: () => {
      geometry.dispose();
      material.dispose();
      for (const g of ghosts) g.material.dispose();
    },
  };
}
