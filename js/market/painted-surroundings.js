import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A quiet, continuous residential backdrop around the playable market.
// Geometry handles parallax nearby; softened ink silhouettes close the distant horizon.
export function createPaintedSurroundings(scene, market) {
  const paper = '#bba575';
  scene.background = new THREE.Color(paper);
  scene.fog = new THREE.Fog(paper, 24, 110);
  market.traverse((node) => {
    if (!node.isMesh || !/石板街道与基座|宣纸背景/.test(node.name)) return;
    node.material = Array.isArray(node.material) ? node.material.map(m => m.clone()) : node.material.clone();
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      material.color.multiply(new THREE.Color('#d9c18f'));
    }
  });
  let seed = 417;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d'); context.fillStyle = '#e4d4ae'; context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    context.fillStyle = `rgba(90,76,48,${0.015 + random() * 0.035})`;
    context.fillRect(random() * 256, random() * 256, 2 + random() * 18, 1 + random() * 5);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const wall = new THREE.MeshStandardMaterial({ color: '#d9c9a1', map: texture, roughness: 1 });
  const wallDark = new THREE.MeshStandardMaterial({ color: '#b9a884', map: texture, roughness: 1 });
  const roof = new THREE.MeshStandardMaterial({ color: '#55594e', roughness: 1 });
  const timber = new THREE.MeshStandardMaterial({ color: '#75664b', roughness: 1 });
  const ink = new THREE.MeshStandardMaterial({ color: '#45473d', roughness: 1 });
  const root = new THREE.Group(); root.name = '水墨民居远景';
  function box(parent, w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function house(x, z, yaw, size = 1) {
    const group = new THREE.Group(); group.position.set(x, 1.17, z); group.rotation.y = yaw;
    const w = (4.8 + random() * 2.2) * size, d = (4.5 + random() * 2) * size;
    const twoFloors = random() > 0.45, h = (twoFloors ? 7.2 : 4.8) * size;
    box(group, w, h, d, 0, h / 2, 0, random() > 0.5 ? wall : wallDark);
    const shape = new THREE.Shape();
    shape.moveTo(-w * 0.6, 0.26); shape.quadraticCurveTo(-w * 0.3, 0.3, 0, w * 0.3);
    shape.quadraticCurveTo(w * 0.3, 0.3, w * 0.6, 0.26);
    shape.lineTo(w * 0.6, 0.08); shape.quadraticCurveTo(w * 0.3, 0.12, 0, w * 0.3 - 0.16);
    shape.quadraticCurveTo(-w * 0.3, 0.12, -w * 0.6, 0.08); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: d + 0.7, bevelEnabled: false, curveSegments: 5 });
    geometry.translate(0, h, -(d + 0.7) / 2);
    group.add(new THREE.Mesh(geometry, roof));
    box(group, .16, .2, d + 1, 0, h + w * .3, 0, ink);
    for (const side of [-1, 1]) {
      const front = side * (d / 2 + 0.025);
      box(group, w + .2, .16, .13, 0, h - .12, front, timber);
      for (const px of [-w * .43, w * .43]) box(group, .14, h, .12, px, h / 2, front, timber);
      box(group, 1.1, 2.4, .08, -.55, 1.2, front + side * .02, timber);
      for (const px of [-w * .27, w * .28]) {
        const wy = twoFloors ? 5.2 * size : 2.8 * size;
        box(group, 1.05 * size, 1.3 * size, .09, px, wy, front + side * .03, ink);
        box(group, .08, 1.3 * size, .12, px, wy, front + side * .08, timber);
        box(group, 1.1 * size, .08, .12, px, wy, front + side * .08, timber);
      }
      if (twoFloors) box(group, w, .13, .16, 0, 3.5 * size, front, timber);
    }
    root.add(group);
  }
  // Staggered rows leave an irregular village roofline instead of a repeated wall.
  for (let i = 0; i < 8; i++) {
    house(-32 + i * 8.6, -29 - random() * 7, (random() - .5) * .22);
    house(-33 + i * 8.5, 33 + random() * 6, Math.PI + (random() - .5) * .2);
  }
  for (let i = 0; i < 6; i++) {
    house(-31 - random() * 5, -21 + i * 8.5, Math.PI / 2 + random() * .15);
    house(26 + random() * 7, -20 + i * 8.4, -Math.PI / 2 + random() * .15);
  }
  for (let i = 0; i < 16; i++) {
    const angle = i * Math.PI / 8, radius = 51 + random() * 7;
    house(-3 + Math.cos(angle) * radius, Math.sin(angle) * radius, -angle + Math.PI / 2, 1.05 + random() * .25);
  }
  // Merge static background geometry by material: five draw calls for the entire village.
  root.updateMatrixWorld(true);
  const batches = new Map();
  root.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone().applyMatrix4(node.matrixWorld);
    geometry.deleteAttribute('uv');
    // Keep UVs for the plaster's paper wash.
    if (node.geometry.attributes.uv) geometry.setAttribute('uv', node.geometry.attributes.uv.clone());
    if (!batches.has(node.material)) batches.set(node.material, []);
    batches.get(node.material).push(geometry.index ? geometry.toNonIndexed() : geometry);
  });
  const village = new THREE.Group(); village.name = root.name;
  for (const [material, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.receiveShadow = false; village.add(mesh);
    geometries.forEach(g => g.dispose());
  }
  root.traverse(node => node.geometry?.dispose());
  scene.add(village);

  // Farther hamlets have deliberately diffused edges, like diluted ink on old paper.
  const distant = document.createElement('canvas'); distant.width = 1024; distant.height = 384;
  const ctx = distant.getContext('2d');
  ctx.filter = 'blur(3px)';
  for (let i = 0; i < 15; i++) {
    const x = i * 74 - 30, y = 120 + random() * 75, w = 75 + random() * 40;
    ctx.fillStyle = 'rgba(96,91,68,.23)'; ctx.fillRect(x, y, w, 280 - y);
    ctx.fillStyle = 'rgba(69,77,66,.38)'; ctx.beginPath();
    ctx.moveTo(x - 10, y + 8); ctx.lineTo(x + w * .5, y - 40 - random() * 15); ctx.lineTo(x + w + 10, y + 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(81,78,58,.3)'; ctx.fillRect(x + w * .3, y + 26, 12, 24);
  }
  const wash = new THREE.CanvasTexture(distant); wash.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 14; i++) {
    const angle = i * Math.PI * 2 / 14;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: wash, transparent: true, opacity: .7, depthWrite: false, fog: true, toneMapped: false }));
    sprite.position.set(-3 + Math.cos(angle) * 76, 9, Math.sin(angle) * 76);
    sprite.scale.set(40, 20, 1); scene.add(sprite);
  }
  return village;
}
