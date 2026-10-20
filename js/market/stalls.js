import * as THREE from 'three';
import { assetUrl } from '../data/products.js';
import { loadPreparedModel } from '../core/loader.js';
import { marketMaterial } from '../core/textures.js';
import { stallTransform } from './layout.js';

const STALL_SIZE = 2.9;
const PICK_HALF_WIDTH = 118;
const PICK_HALF_HEIGHT = 104;

const plankMaterial = marketMaterial('#8a6a45');

function createBase() {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.56, 1.64, 0.1, 22), plankMaterial);
  base.position.y = 0.05;
  base.castShadow = true;
  base.receiveShadow = true;
  return base;
}

function createHighlight() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.48, 1.74, 44),
    new THREE.MeshBasicMaterial({
      color: '#e8a34a',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.12;
  return ring;
}

/** 载入当前时段的四个摊位 */
export async function createStalls(group, phase) {
  const entries = await Promise.all(
    phase.stalls.map(async (stall) => {
      const transform = stallTransform(stall);
      const holder = new THREE.Group();
      holder.position.set(transform.position.x, 0, transform.position.z);
      holder.rotation.y = transform.rotationY;

      holder.add(createBase());
      const model = await loadPreparedModel(assetUrl(stall.model), { targetSize: STALL_SIZE });
      model.traverse((node) => {
        if (!node.isMesh) return;
        const harmonize = (original) => {
          const material = original.clone();
          material.roughness = Math.max(material.roughness ?? 0.85, 0.82);
          material.metalness = Math.min(material.metalness ?? 0, 0.12);
          material.color?.multiply(new THREE.Color('#f4e9d8'));
          return material;
        };
        node.material = Array.isArray(node.material) ? node.material.map(harmonize) : harmonize(node.material);
        node.receiveShadow = true;
      });
      holder.add(model);

      const ring = createHighlight();
      holder.add(ring);
      group.add(holder);

      return {
        stall,
        holder,
        ring,
        anchor: new THREE.Vector3(transform.position.x, 1.45, transform.position.z),
        side: stall.side,
        position: transform.position,
        glow: 0,
      };
    })
  );

  return entries;
}

/**
 * 屏幕空间拾取：把摊位锚点投到屏幕上比距离，比直接射线打三角面快得多。
 * @returns {object|null} 命中的摊位
 */
export function pickStall(entries, camera, pointer, viewport) {
  const projected = new THREE.Vector3();
  let best = null;
  let bestScore = 1;

  for (const entry of entries) {
    projected.copy(entry.anchor).project(camera);
    if (projected.z > 1 || projected.z < -1) continue;
    const screenX = (projected.x * 0.5 + 0.5) * viewport.width;
    const screenY = (-projected.y * 0.5 + 0.5) * viewport.height;
    const dx = Math.abs(screenX - pointer.x) / PICK_HALF_WIDTH;
    const dy = Math.abs(screenY - pointer.y) / PICK_HALF_HEIGHT;
    const score = dx * dx + dy * dy;
    if (score < 1 && score < bestScore) {
      bestScore = score;
      best = entry;
    }
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
