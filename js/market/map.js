import * as THREE from 'three';
import { loadGltf } from '../core/loader.js';
import { createNavigator } from './navigation.js';
import { createMarketSurroundings } from './market-surroundings.js';
import { createPaintedSurroundings } from './painted-surroundings.js';
import { createCharacters } from './characters.js';
import { MARKET_PLACEMENTS, authoredNode } from './market-placements.js';
import { frameShop } from './shop-camera.js';

/** Load the fully assembled Blender export at its authored scale and origin. */
export async function loadMarketMap(group, phase) {
  const revision = '?v=markets-20261030-fortune-v2';
  const [gltf, response, metadata] = await Promise.all([
    loadGltf(`assets/markets/${phase.id}.glb${revision}`), fetch(`assets/markets/${phase.id}.json${revision}`),
    phase.id === 'morning' ? fetch('assets/markets/morning-metadata.json').then(r => r.ok ? r.json() : {}) : null,
  ]);
  if (!response.ok) throw new Error(`地图导航加载失败：${response.status}`);
  const data = await response.json();
  const map = gltf.scene;
  if (metadata) map.traverse(node => Object.assign(node.userData, metadata[node.userData.name ?? node.name] ?? {}));
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
    if (!node.isSkinnedMesh && !node.userData.water && !node.userData.ground) occluders.push({ mesh: node, box: new THREE.Box3().setFromObject(node) });
  });
  group.add(map);
  const entries = phase.stalls.map(stall => {
    const placement = MARKET_PLACEMENTS[phase.id][stall.id];
    const holder = authoredNode(map, placement.node);
    if (!holder) throw new Error(`缺少商铺节点：${placement.node}`);
    const position = new THREE.Vector3(...placement.position), normal = new THREE.Vector3(...placement.normal).normalize();
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.2, 48), new THREE.MeshBasicMaterial({
      color: '#e3b56d', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
    }));
    const approach = position.clone().addScaledVector(normal, 2.6);
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(approach); ring.position.y += .035; group.add(ring);
    const focus = position.clone(); focus.y += 1.4;
    return { stall, holder, ring, position, normal, approach, keeperPosition: placement.keeper,
      cameraDistance: placement.distance, anchor: focus.clone(), focusTarget: focus, glow: 0 };
  });
  const navigator = createNavigator(data);
  const characters = await createCharacters(map, phase, entries, navigator);
  map.updateMatrixWorld(true);
  entries.forEach(entry => {
    frameShop(entry, occluders);
    characters.faceShop(entry);
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
      const targets = activeShop?.sightTargets ?? [[0,0,0], [1.3,1,0], [-1.3,1,0], [0,1,1.3], [0,1,-1.3]]
        .map(offset => target.clone().add(new THREE.Vector3(...offset)));
      for (const point of targets) {
        aim.copy(point);
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
  return { entries, navigator, spawn: new THREE.Vector3(...data.spawn), updateOcclusion,
    greet(stallId) { characters.greet(stallId); },
    focus(stallId) { characters.focus(stallId); },
    update(delta) { characters.update(delta); },
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
