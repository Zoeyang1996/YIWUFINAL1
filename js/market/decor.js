import * as THREE from 'three';
import { bannerTexture, lanternTexture } from '../core/textures.js';
import { stallTransform } from './layout.js';

/** 灯笼、布幡、摊前小灯 —— 三个时段里最会变的那部分 */

const LANTERN_GLOW = { morning: 0.3, noon: 0.12, night: 2.4 };
const LIGHT_INTENSITY = { morning: 0, noon: 0, night: 2.1 };

const capMaterial = new THREE.MeshStandardMaterial({ color: '#6a4126', roughness: 0.8 });
const cordMaterial = new THREE.MeshStandardMaterial({ color: '#4a3320', roughness: 0.9 });

function createLantern(x, y, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.26 * scale, 18, 14),
    new THREE.MeshStandardMaterial({
      map: lanternTexture(),
      emissive: new THREE.Color('#ff9a4a'),
      emissiveIntensity: 0.3,
      roughness: 0.82,
      metalness: 0,
    })
  );
  body.scale.y = 0.86;
  group.add(body);

  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.12 * scale, 0.06, 10), capMaterial);
  capTop.position.y = 0.23 * scale;
  group.add(capTop);

  const capBottom = capTop.clone();
  capBottom.position.y = -0.23 * scale;
  group.add(capBottom);

  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.92, 5), cordMaterial);
  cord.position.y = 0.72 * scale;
  group.add(cord);

  return { group, body };
}

/**
 * @param {THREE.Group} group 场景根
 * @param {Array} stalls 当前时段的摊位
 */
export function buildDecor(group, stalls) {
  const lanternMaterials = [];
  const lanternGroups = [];
  const lights = [];

  // 沿两侧檐口挂灯
  [-1, 1].forEach((sign) => {
    for (let z = -10; z <= 10; z += 4) {
      const lantern = createLantern(sign * 4.35, 2.68, z + (sign > 0 ? 2 : 0));
      lanternMaterials.push(lantern.body.material);
      lanternGroups.push(lantern.group);
      group.add(lantern.group);
    }
  });

  // 街心的几盏点光（只在夜里亮）
  [-6.5, 0, 6.5].forEach((z) => {
    const light = new THREE.PointLight('#ff9a4a', 0, 10, 1.7);
    light.position.set(0, 2.6, z);
    group.add(light);
    lights.push(light);
  });

  // 每个摊位一块布幡 + 一盏摊前灯
  stalls.forEach((stall) => {
    const { position } = stallTransform(stall);
    const inward = position.x > 0 ? -1 : 1;

    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 2.2),
      new THREE.MeshStandardMaterial({
        map: bannerTexture(stall.name.slice(0, 2)),
        side: THREE.DoubleSide,
        roughness: 0.9,
      })
    );
    banner.position.set(position.x + inward * 1.15, 2.06, position.z + 1.65);
    banner.rotation.y = inward * 0.22;
    banner.castShadow = true;
    group.add(banner);

    const stallLight = new THREE.PointLight('#ffb066', 0, 7, 1.8);
    stallLight.position.set(position.x * 0.66, 1.55, position.z);
    group.add(stallLight);
    lights.push(stallLight);
  });

  function applyPhase(phaseId) {
    const glow = LANTERN_GLOW[phaseId] ?? 0.3;
    const intensity = LIGHT_INTENSITY[phaseId] ?? 0;
    lanternMaterials.forEach((material) => {
      material.emissiveIntensity = glow;
    });
    lights.forEach((light) => {
      light.intensity = intensity;
    });
  }

  function sway(time) {
    lanternGroups.forEach((lantern, index) => {
      lantern.rotation.z = Math.sin(time * 0.7 + index * 1.3) * 0.035;
    });
  }

  return { applyPhase, sway };
}
