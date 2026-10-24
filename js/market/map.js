import * as THREE from 'three';
import { loadGltf } from '../core/loader.js';
import { createNavigator } from './navigation.js';
import { createMarketSurroundings } from './market-surroundings.js';
import { createPaintedSurroundings } from './painted-surroundings.js';
import { createFanKeeper } from './fan-keeper.js';

/** Load the fully assembled Blender export at its authored scale and origin. */
export async function loadMarketMap(group, phase) {
  const revision = phase.id === 'morning' ? '?v=fan-keeper-01' : '?v=authored-web-20261022';
  const [gltf, response, metadata] = await Promise.all([
    loadGltf(`assets/markets/${phase.id === 'morning' ? 'morning2' : phase.id}.glb${revision}`), fetch(`assets/markets/${phase.id}.json${revision}`),
    phase.id === 'morning' ? fetch('assets/markets/morning-metadata.json').then(r => { if (!r.ok) throw new Error('早市场景标记加载失败'); return r.json(); }) : null,
  ]);
  if (!response.ok) throw new Error(`地图导航加载失败：${response.status}`);
  const data = await response.json();
  const map = gltf.scene;
  // The new Blender export omitted custom properties; retain ground/water/backdrop behavior.
  if (metadata) map.traverse(node => Object.assign(node.userData, metadata[node.userData.name ?? node.name] ?? {}));
  const fanKeeper = phase.id === 'morning' ? createFanKeeper(map) : null;
  if (phase.id === 'morning') {
    const holder = new THREE.Group(); holder.name = 'Shop_fans'; map.add(holder);
    const parts = [];
    map.traverse(node => { if ((node.userData.name ?? node.name).includes('05 扇铺摊铺') && node.parent === map) parts.push(node); });
    parts.forEach(node => holder.attach(node));
    const keeper = map.getObjectByName('Armature');
    if (keeper) holder.attach(keeper);
    data.stalls.push({ id: 'fans', node: 'Shop_fans', position: [-4.46, 1.29313, 1.58],
      focus: [-4.46, 2.85, 1.58], normal: [-1, 0, 0], approach: [-7.2, 1.29313, 1.58], cameraDistance: 4.3 });
  }
  // Replace the old export's distant backdrop with the continuous web village.
  const backdrop = []; map.traverse(node => { if (node.userData.backdrop) backdrop.push(node); });
  backdrop.forEach(node => node.removeFromParent());
  const occluders = [];
  // Meshes sharing a name prefix (one authored building exports as many parts)
  // fade together, otherwise the walls go see-through while the lit window
  // panels stay opaque and appear to float in mid-air.
  const fadeGroups = new Map();
  map.updateMatrixWorld(true);
  map.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = !node.userData.water && !node.userData.ground;
    node.receiveShadow = true;
    const groupId = node.name.includes('#') ? node.name.split('#')[0] : `mesh:${node.uuid}`;
    node.userData.fadeGroup = groupId;
    if (!fadeGroups.has(groupId)) fadeGroups.set(groupId, []);
    fadeGroups.get(groupId).push(node);
    if (!node.isSkinnedMesh && !node.userData.water && (phase.id === 'morning' || node.userData.occluder)) occluders.push({ mesh: node, box: new THREE.Box3().setFromObject(node) });
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
    return { stall, holder, ring, position, cameraDistance: placement.cameraDistance, anchor: new THREE.Vector3(...placement.focus),
      focusTarget: new THREE.Vector3(...placement.focus), normal: new THREE.Vector3(...placement.normal),
      approach: new THREE.Vector3(...placement.approach), glow: 0 };
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
  let occlusionElapsed = 1, hidden = new Set(), protectedHolder = null;
  const protectedMeshes = new Set();
  function updateOcclusion(camera, target, delta, activeShop = null) {
    if (protectedHolder !== activeShop?.holder) {
      protectedHolder = activeShop?.holder; protectedMeshes.clear();
      protectedHolder?.traverse(node => { if (node.isMesh) protectedMeshes.add(node); });
      occlusionElapsed = 1;
    }
    occlusionElapsed += delta;
    if (occlusionElapsed >= .1) {
      occlusionElapsed = 0; hidden = new Set();
    if (target) {
      // A small sight corridor also catches furniture beside the exact center ray.
      for (const item of occluders) {
        if (!protectedMeshes.has(item.mesh) && item.box.distanceToPoint(camera.position) < .8) hidden.add(item.mesh);
      }
      for (const [x, y, z] of [[0,0,0], [1.3,1,0], [-1.3,1,0], [0,1,1.3], [0,1,-1.3]]) {
        aim.copy(target).add(new THREE.Vector3(x,y,z));
        direction.copy(aim).sub(camera.position);
        ray.far = direction.length() - .6;
        ray.set(camera.position, direction.normalize());
        const candidates = occluders.filter(item => !protectedMeshes.has(item.mesh) && ray.ray.intersectsBox(item.box)).map(item => item.mesh);
        ray.intersectObjects(candidates, false).forEach(hit => hidden.add(hit.object));
      }
    }
    }
    const fading = new Set();
    for (const mesh of hidden) {
      const siblings = fadeGroups.get(mesh.userData.fadeGroup);
      if (siblings) siblings.forEach(sibling => { if (!protectedMeshes.has(sibling)) fading.add(sibling); });
      else fading.add(mesh);
    }
    fading.forEach(prepareFade);
    for (const mesh of fadingMeshes) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const original = material.userData.authored;
        const targetOpacity = fading.has(mesh) ? original.opacity * 0.16 : original.opacity;
        material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 1 - Math.exp(-7 * delta));
        const isFading = Math.abs(material.opacity - original.opacity) > 0.005;
        if (!isFading) material.opacity = original.opacity;
        const transparent = original.transparent || isFading;
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        material.depthWrite = original.depthWrite && !isFading;
      }
      if (!fading.has(mesh) && materials.every(m => m.opacity === m.userData.authored.opacity)) fadingMeshes.delete(mesh);
    }
  }
  return { entries, navigator: createNavigator(data), spawn: new THREE.Vector3(...data.spawn), updateOcclusion,
    greet(stallId) { if (stallId === 'fans') fanKeeper?.greet(); },
    update(delta) { fanKeeper?.update(delta); },
    lighting: data.lighting,
    addSurroundings(scene) {
      if (phase.id !== 'morning') { createMarketSurroundings(scene, phase); return; }
      const village = createPaintedSurroundings(scene, map);
      village.updateMatrixWorld(true);
      village.traverse(mesh => {
        if (mesh.isMesh) occluders.push({mesh, box:new THREE.Box3().setFromObject(mesh)});
      });
    } };
}
