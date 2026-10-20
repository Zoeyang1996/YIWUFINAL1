import * as THREE from 'three';
import { loadGltf } from '../core/loader.js';
import { createNavigator } from './navigation.js';

/** Load the fully assembled Blender export at its authored scale and origin. */
export async function loadMarketMap(group, phase) {
  const [gltf, response] = await Promise.all([
    loadGltf(`assets/markets/${phase.id}.glb`), fetch(`assets/markets/${phase.id}.json`),
  ]);
  if (!response.ok) throw new Error(`地图导航加载失败：${response.status}`);
  const data = await response.json();
  const map = gltf.scene;
  const occluders = [];
  map.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = !node.userData.water;
    node.receiveShadow = true;
    if (node.userData.occluder) {
      node.material = Array.isArray(node.material) ? node.material.map((m) => m.clone()) : node.material.clone();
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((m) => { m.transparent = true; });
      occluders.push(node);
    }
  });
  group.add(map);
  const entries = data.stalls.map((placement) => {
    const stall = phase.stalls.find((item) => item.id === placement.id);
    if (!stall) throw new Error(`未匹配的商铺：${placement.id}`);
    const holder = map.getObjectByName(placement.node);
    if (!holder) throw new Error(`缺少商铺节点：${placement.node}`);
    const position = new THREE.Vector3(...placement.position);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.05, 48), new THREE.MeshBasicMaterial({
      color: '#e3b56d', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position); ring.position.y += 0.035; group.add(ring);
    return { stall, holder, ring, position, anchor: new THREE.Vector3(...placement.focus),
      focusTarget: new THREE.Vector3(...placement.focus), normal: new THREE.Vector3(...placement.normal),
      approach: new THREE.Vector3(...placement.approach), glow: 0 };
  });
  if (phase.id === 'night') entries.forEach((entry) => {
    const light = new THREE.PointLight('#ffb66d', 8, 9, 2);
    light.position.copy(entry.position).addScaledVector(entry.normal, 2.1);light.position.y += 2.4;group.add(light);
  });
  const ray = new THREE.Raycaster();
  const direction = new THREE.Vector3();
  function updateOcclusion(camera, target, delta) {
    direction.copy(target).sub(camera.position);
    ray.set(camera.position, direction.clone().normalize());ray.far = direction.length() - 0.6;
    const hidden = new Set(ray.intersectObjects(occluders, false).map((hit) => hit.object));
    for (const mesh of occluders) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        material.opacity = THREE.MathUtils.lerp(material.opacity, hidden.has(mesh) ? 0.16 : 1, 1 - Math.exp(-7 * delta));
        material.depthWrite = material.opacity > 0.95;
      }
    }
  }
  return { entries, navigator: createNavigator(data), spawn: new THREE.Vector3(...data.spawn), updateOcclusion };
}
