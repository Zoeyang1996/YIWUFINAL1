import * as THREE from 'three';
import { marketMaterial } from '../core/textures.js';
import { stallTransform } from './layout.js';

/** 陈设收在两侧步道，保持中间可游览区域畅通。 */
export function buildStreetDetails(group, phase) {
  const wood = marketMaterial('#896548');
  const clay = marketMaterial('#9a6650', 'plaster');
  const leaf = marketMaterial('#64755a', 'cloth');
  const cloth = marketMaterial(phase.id === 'night' ? '#8a5042' : '#b99a67', 'cloth');
  const iron = new THREE.MeshStandardMaterial({ color: '#494a43', roughness: 0.8 });
  function mesh(geometry, material, x, y, z, parent = group) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z); object.castShadow = object.receiveShadow = true;
    parent.add(object); return object;
  }
  function box(w, h, d, x, y, z, material = wood, parent = group) {
    return mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  }
  for (const side of [-1, 1]) {
    // 台沿与排水砖缝
    box(0.2, 0.12, 26, side * 3.15, 0.06, 0, clay);
    for (let z = -12; z <= 12; z += 0.8) box(0.35, 0.025, 0.06, side * 3.4, 0.018, z, iron);
    for (const z of [-10.5, 0, 10.5]) {
      const x = side * 5.2;
      mesh(new THREE.CylinderGeometry(0.36, 0.23, 0.55, 12), clay, x, 0.275, z);
      mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 12), iron, x, 0.55, z);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4;
        const frond = mesh(new THREE.SphereGeometry(0.23, 7, 5), leaf,
          x + Math.cos(a) * 0.24, 0.85 + (i % 3) * 0.18, z + Math.sin(a) * 0.24);
        frond.scale.set(0.65, 2.3, 0.5); frond.rotation.z = Math.cos(a) * 0.55;
      }
    }
    // 檐下长凳
    box(0.65, 0.12, 1.8, side * 6.3, 0.56, 0);
    for (const z of [-0.65, 0.65]) box(0.5, 0.5, 0.12, side * 6.3, 0.25, z);
  }
  phase.stalls.forEach((stall, index) => {
    const { position, rotationY } = stallTransform(stall);
    const props = new THREE.Group(); props.position.set(position.x, 0, position.z); props.rotation.y = rotationY;
    group.add(props);
    // 错落木箱、压在箱沿的麻布、陶罐。
    for (let layer = 0; layer < 2; layer++) {
      const x = -1.7 + layer * 0.1, y = 0.23 + layer * 0.44;
      box(0.65, 0.44, 0.65, x, y, -0.25, wood, props);
      for (const dy of [-0.15, 0.15]) box(0.68, 0.045, 0.68, x, y + dy, -0.25, clay, props);
    }
    box(0.7, 0.025, 0.65, -1.6, 0.905, -0.25, cloth, props);
    mesh(new THREE.SphereGeometry(0.28, 14, 10), clay, 1.65, 0.3, -0.3, props).scale.y = 1.15;
    mesh(new THREE.TorusGeometry(0.15, 0.035, 6, 16), clay, 1.65, 0.59, -0.3, props).rotation.x = Math.PI / 2;
    // 一侧竹架，不在镜头与摊主之间横挂遮挡物。
    box(0.06, 2.8, 0.06, -1.9, 1.4, -0.6, wood, props);
    box(0.85, 0.06, 0.06, -1.5, 2.75, -0.6, wood, props);
  });
}
