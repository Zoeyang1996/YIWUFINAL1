import * as THREE from 'three';

/** Only a real hit on an embedded shop opens its panel. */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
export function pickStall(entries, camera, pointer, viewport) {
  ndc.set(pointer.x / viewport.width * 2 - 1, -pointer.y / viewport.height * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  let best = null, distance = Infinity;
  for (const entry of entries) {
    const hit = raycaster.intersectObject(entry.holder, true)[0];
    if (hit && hit.distance < distance) { best = entry; distance = hit.distance; }
  }
  return best;
}

/** 高亮环呼吸 */
export function updateStalls(entries, delta, hoveredId) {
  entries.forEach((entry) => {
    const target = entry.stall.id === hoveredId ? 0.82 : 0;
    entry.glow += (target - entry.glow) * Math.min(1, delta * 9);
    entry.ring.material.opacity = entry.glow;
    const scale = 1 + entry.glow * 0.03;
    entry.ring.scale.setScalar(scale);
  });
}
