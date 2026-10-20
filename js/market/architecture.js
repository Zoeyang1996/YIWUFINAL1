import * as THREE from 'three';
import { stoneTexture, tileTexture, marketMaterial } from '../core/textures.js';
import { STREET } from './layout.js';

/** 一条江南直街：青石板、两侧檐廊、粉墙、街口牌楼 */

function plasterMaterial() {
  return marketMaterial('#ece4d4', 'plaster');
}

function woodMaterial(color = '#8a5f3c') {
  return marketMaterial(color);
}

function tileMaterial() {
  return new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.78, metalness: 0.02, color: '#b9bfc6' });
}

function addBox(parent, { w, h, d, x, y, z, material, rotationZ = 0, rotationY = 0 }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.z = rotationZ;
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createGround(group) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 46),
    new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const paving = stoneTexture();
  paving.repeat.set(1.5, 10);
  // 街心一条更亮的石板带
  const spine = new THREE.Mesh(
    new THREE.PlaneGeometry(4.2, 30),
    new THREE.MeshStandardMaterial({ color: '#eee4ce', map: paving, bumpMap: paving, bumpScale: 0.035, roughness: 0.92 })
  );
  spine.rotation.x = -Math.PI / 2;
  spine.position.y = 0.012;
  spine.receiveShadow = true;
  group.add(spine);
}

function createCorridor(group, side) {
  const sign = side === 'left' ? -1 : 1;
  const postX = sign * (STREET.stallX + 1.55);
  const wallX = sign * (STREET.stallX + 3.5);
  const wood = woodMaterial();
  const woodDark = woodMaterial('#6a4630');
  const plaster = plasterMaterial();
  const tile = tileMaterial();

  // 粉墙
  addBox(group, { w: 0.34, h: 3.5, d: 27, x: wallX, y: 1.75, z: 0, material: plaster });
  // 墙头压顶
  addBox(group, { w: 0.6, h: 0.18, d: 27, x: wallX, y: 3.56, z: 0, material: tile });

  // 墙裙、窗框与透空木棂，形成平视镜头里的层次。
  addBox(group, { w: 0.4, h: 0.48, d: 27, x: wallX, y: 0.24, z: 0, material: woodDark });
  for (let z = -10; z <= 10; z += 4) {
    const x = wallX - sign * 0.23;
    addBox(group, { w: 0.08, h: 1.45, d: 2.2, x, y: 1.9, z, material: woodDark });
    addBox(group, { w: 0.09, h: 1.22, d: 1.98, x: x - sign * 0.06, y: 1.9, z, material: plaster });
    for (let j = -0.8; j <= 0.81; j += 0.4)
      addBox(group, { w: 0.14, h: 1.24, d: 0.045, x: x - sign * 0.12, y: 1.9, z: z + j, material: wood });
    for (const y of [1.5, 1.9, 2.3])
      addBox(group, { w: 0.14, h: 0.045, d: 2, x: x - sign * 0.12, y, z, material: wood });
  }
  // 檐柱
  for (let z = -12; z <= 12; z += 4) {
    addBox(group, { w: 0.2, h: 3.0, d: 0.2, x: postX, y: 1.5, z, material: wood });
    addBox(group, { w: 0.42, h: 0.12, d: 0.42, x: postX, y: 0.06, z, material: woodDark });
  }

  // 额枋
  addBox(group, { w: 0.16, h: 0.3, d: 27, x: postX, y: 3.05, z: 0, material: woodDark });
  // 檐下横撑
  addBox(group, { w: 1.9, h: 0.1, d: 0.12, x: (postX + wallX) / 2, y: 3.3, z: -6, material: wood });
  addBox(group, { w: 1.9, h: 0.1, d: 0.12, x: (postX + wallX) / 2, y: 3.3, z: 6, material: wood });

  // 坡屋面：朝街一侧压低
  const roof = addBox(group, {
    w: 4.6,
    h: 0.16,
    d: 27.6,
    x: (postX + wallX) / 2,
    y: 3.62,
    z: 0,
    material: tile,
    rotationZ: sign * 0.13,
  });
  roof.receiveShadow = true;

  // 檐口
  addBox(group, { w: 0.3, h: 0.16, d: 27.6, x: postX - sign * 0.1, y: 3.34, z: 0, material: woodDark });
}

function createGate(group) {
  const wood = woodMaterial('#7b5236');
  const woodDark = woodMaterial('#5d3c27');
  const tile = tileMaterial();

  // 两根门柱
  [-3.5, 3.5].forEach((x) => {
    addBox(group, { w: 0.34, h: 4.3, d: 0.34, x, y: 2.15, z: 12.2, material: wood });
    addBox(group, { w: 0.62, h: 0.2, d: 0.62, x, y: 0.08, z: 12.2, material: woodDark });
  });

  // 横枋与匾
  addBox(group, { w: 7.8, h: 0.32, d: 0.3, x: 0, y: 4.2, z: 12.2, material: woodDark });
  addBox(group, { w: 2.6, h: 0.86, d: 0.16, x: 0, y: 3.55, z: 12.2, material: woodDark });

  // 牌楼顶
  addBox(group, { w: 8.4, h: 0.2, d: 1.5, x: 0, y: 4.55, z: 12.2, material: tile });
  addBox(group, { w: 6.2, h: 0.18, d: 1.2, x: 0, y: 4.86, z: 12.2, material: tile });

  // 台阶
  for (let i = 0; i < 3; i += 1) {
    addBox(group, {
      w: 8.6 - i * 0.6,
      h: 0.09,
      d: 0.34,
      x: 0,
      y: 0.045 + (2 - i) * 0.09,
      z: 11.2 + i * 0.34,
      material: woodDark,
    });
  }
}

function createProps(group) {
  const basket = marketMaterial('#b0894f', 'cloth');
  const barrel = marketMaterial('#7a5233');

  const spots = [
    { x: -3.9, z: 9.4, kind: 'basket' },
    { x: 4.1, z: 8.2, kind: 'barrel' },
    { x: -4.3, z: 0.6, kind: 'barrel' },
    { x: 4.0, z: -1.4, kind: 'basket' },
    { x: -3.8, z: -8.6, kind: 'basket' },
    { x: 4.2, z: -9.8, kind: 'barrel' },
  ];

  spots.forEach((spot) => {
    const radius = spot.kind === 'barrel' ? 0.32 : 0.38;
    const height = spot.kind === 'barrel' ? 0.62 : 0.44;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.86, height, spot.kind === 'barrel' ? 14 : 9, 1),
      spot.kind === 'barrel' ? barrel : basket
    );
    mesh.position.set(spot.x, height / 2, spot.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.rotation.y = Math.random() * Math.PI;
    group.add(mesh);
  });
}

/** 整条街的建筑，一次性挂到 group 上 */
export function buildArchitecture(group) {
  createGround(group);
  createCorridor(group, 'left');
  createCorridor(group, 'right');
  createGate(group);
  createProps(group);
  return group;
}
