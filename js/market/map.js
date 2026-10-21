import * as THREE from 'three';
import { loadGltf } from '../core/loader.js';
import { createNavigator } from './navigation.js';
import { createPaintedSurroundings } from './painted-surroundings.js';

/** Load the fully assembled Blender export at its authored scale and origin. */
export async function loadMarketMap(group, phase) {
  const revision = phase.id === 'morning' ? '?v=painted-village-03' : '';
  const [gltf, response] = await Promise.all([
    loadGltf(`assets/markets/${phase.id}.glb${revision}`), fetch(`assets/markets/${phase.id}.json${revision}`),
  ]);
  if (!response.ok) throw new Error(`地图导航加载失败：${response.status}`);
  const data = await response.json();
  const map = gltf.scene;
  const occluders = [];
  map.updateMatrixWorld(true);
  map.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = !node.userData.water;
    node.receiveShadow = true;
    if (!node.userData.water) occluders.push({ mesh: node, box: new THREE.Box3().setFromObject(node) });
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
  const aim = new THREE.Vector3();
  const fadingMeshes = new Set();
  function prepareFade(mesh) {
    if (fadingMeshes.has(mesh)) return;
    if (!mesh.userData.fadePrepared) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(m => m.clone()) : mesh.material.clone();
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        m.userData.authored = { opacity: m.opacity, transparent: m.transparent, depthWrite: m.depthWrite };
      }
      mesh.userData.fadePrepared = true;
    }
    fadingMeshes.add(mesh);
  }
  function updateOcclusion(camera, target, delta) {
    const hidden = new Set();
    if (target) {
      // A small sight corridor also catches furniture beside the exact center ray.
      for (const item of occluders) {
        if (item.box.distanceToPoint(camera.position) < .8) hidden.add(item.mesh);
      }
      for (const [x, y, z] of [[0,0,0], [1.3,1,0], [-1.3,1,0], [0,1,1.3], [0,1,-1.3]]) {
        aim.copy(target).add(new THREE.Vector3(x,y,z));
        direction.copy(aim).sub(camera.position);
        ray.far = direction.length() - .6;
        ray.set(camera.position, direction.normalize());
        const candidates = occluders.filter(item => ray.ray.intersectsBox(item.box)).map(item => item.mesh);
        ray.intersectObjects(candidates, false).forEach(hit => hidden.add(hit.object));
      }
    }
    hidden.forEach(prepareFade);
    for (const mesh of fadingMeshes) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const original = material.userData.authored;
        const opacity = hidden.has(mesh) ? original.opacity * 0.16 : original.opacity;
        material.opacity = THREE.MathUtils.lerp(material.opacity, opacity, 1 - Math.exp(-7 * delta));
        const fading = Math.abs(material.opacity - original.opacity) > 0.005;
        if (!fading) material.opacity = original.opacity;
        const transparent = original.transparent || fading;
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        material.depthWrite = original.depthWrite && !fading;
      }
      if (!hidden.has(mesh) && materials.every(m => m.opacity === m.userData.authored.opacity)) fadingMeshes.delete(mesh);
    }
  }
  return { entries, navigator: createNavigator(data), spawn: new THREE.Vector3(...data.spawn), updateOcclusion,
    lighting: data.lighting,
    addSurroundings(scene) {
      if (phase.id !== 'morning') return;
      const village = createPaintedSurroundings(scene, map);
      village.updateMatrixWorld(true);
      village.traverse(mesh => {
        if (mesh.isMesh) occluders.push({mesh, box:new THREE.Box3().setFromObject(mesh)});
      });
    } };
}
