import * as THREE from 'three';
import { loadGltf } from '../core/loader.js';
import { assetUrl } from '../data/products.js';

const UP = new THREE.Vector3(0, 1, 0);
function boneOf(root, name) {
  let found;
  root.traverse(n => { if (n.isBone && (n.userData.name ?? n.name) === name) found = n; });
  return found;
}
function refresh(root) {
  root.parent?.updateWorldMatrix(true, false);
  // SkinnedMesh.updateMatrixWorld also refreshes bindMatrixInverse after moving a rig.
  root.updateMatrixWorld(true);
  root.traverse(n => { if (n.isSkinnedMesh) n.computeBoundingBox(); });
}
function facing(root) {
  const foot = boneOf(root, 'L_Foot'), toe = boneOf(root, 'L_ToeBase');
  const v = foot && toe ? toe.getWorldPosition(new THREE.Vector3()).sub(foot.getWorldPosition(new THREE.Vector3())) : new THREE.Vector3(0, 0, 1);
  v.y = 0;
  return v.normalize();
}
function turnTo(root, direction) {
  const f = facing(root);
  root.rotateOnWorldAxis(UP, Math.atan2(direction.x, direction.z) - Math.atan2(f.x, f.z));
  root.updateWorldMatrix(true, true);
}
function place(root, position, normal) {
  turnTo(root, normal);
  refresh(root);
  const bounds = new THREE.Box3().setFromObject(root), center = bounds.getCenter(new THREE.Vector3());
  root.position.add(new THREE.Vector3(position[0] - center.x, position[1] - bounds.min.y, position[2] - center.z));
  refresh(root);
}

/** Animate each independent skeleton from its own rest pose; never accumulate rotations. */
export function animateCharacter(root, seed = 0) {
  const bones = new Map(), rest = new Map();
  root.traverse(b => { if (b.isBone) { bones.set(b.userData.name ?? b.name, b); rest.set(b, b.quaternion.clone()); } });
  const worldQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion(), deltaQ = new THREE.Quaternion();
  const from = new THREE.Vector3(), to = new THREE.Vector3(), pointA = new THREE.Vector3();
  let time = seed, greeting = -10;
  function point(name, childName, direction, weight = 1) {
    const bone = bones.get(name), child = bones.get(childName);
    if (!bone || !child) return;
    from.copy(child.getWorldPosition(pointA)).sub(bone.getWorldPosition(to)).normalize();
    bone.getWorldQuaternion(worldQ);
    deltaQ.setFromUnitVectors(from, direction.normalize());
    worldQ.premultiply(deltaQ);
    bone.parent.getWorldQuaternion(parentQ).invert();
    bone.quaternion.slerp(worldQ.premultiply(parentQ), weight);
    bone.updateWorldMatrix(false, true);
  }
  return {
    greet() { greeting = time; },
    update(dt, walking = false, reduced = false) {
      time += dt;
      rest.forEach((q, b) => b.quaternion.copy(q));
      root.updateWorldMatrix(true, true);
      const forward = facing(root), side = new THREE.Vector3().crossVectors(forward, UP).normalize();
      const direction = (x, y, z) => side.clone().multiplyScalar(x).addScaledVector(UP, y).addScaledVector(forward, z);
      const stride = walking && !reduced ? Math.sin(time * 5.4) : 0;
      for (const [prefix, sign] of [['L', -1], ['R', 1]]) {
        point(`${prefix}_Upperarm`, `${prefix}_Forearm`, direction(sign * .14, -1, stride * sign * .28));
        point(`${prefix}_Forearm`, `${prefix}_Hand`, direction(sign * .12, -1, .16 + stride * sign * .2));
        if (walking) {
          point(`${prefix}_Thigh`, `${prefix}_Calf`, direction(0, -1, -stride * sign * .32));
          point(`${prefix}_Calf`, `${prefix}_Foot`, direction(0, -1, Math.max(0, stride * sign) * -.4));
        }
      }
      if (!reduced) {
        const head = bones.get('Head');
        const age = time - greeting;
        // One slow, shallow nod (4 degrees); hands and torso stay at rest.
        // These meshes have no facial controls: preserve their authored expression.
        const nod = age >= 0 && age < 2.4 ? .07 * Math.sin(Math.PI * age / 2.4) ** 2 : 0;
        if (head && nod > 0) {
          head.getWorldQuaternion(worldQ);
          deltaQ.setFromAxisAngle(side.clone().negate(), nod);
          worldQ.premultiply(deltaQ);
          head.parent.getWorldQuaternion(parentQ).invert();
          head.quaternion.copy(worldQ.premultiply(parentQ));
        }
      }
    },
  };
}

/** Short, sampled patrols keep walkers on the authored navigation surface. */
function patrolFor(root, navigator) {
  const box = new THREE.Box3().setFromObject(root), center = box.getCenter(new THREE.Vector3());
  const start = new THREE.Vector3(center.x, box.min.y, center.z);
  for (const [dx, dz] of [[1,0], [0,1], [-1,0], [0,-1]]) {
    const points = []; let y = start.y;
    for (let d = 0; d <= 2.4; d += .1) {
      const x = start.x + dx * d, z = start.z + dz * d;
      const next = navigator.sample(x, z, y);
      if (next === null) break;
      y = next; points.push(new THREE.Vector3(x, y, z));
    }
    if (points.length >= 10) return { points, origin: start, base: root.position.clone(), elapsed: 0 };
  }
  return null;
}

export async function createCharacters(map, phase, entries, navigator) {
  const keepers = new Map(), actors = [];
  for (const [index, entry] of entries.entries()) {
    const stall = entry.stall;
    let root = map.children.find(n => (n.userData.name ?? n.name) === stall.rig);
    if (!root || stall.replaceNpc) {
      root?.removeFromParent();
      const gltf = await loadGltf(assetUrl(stall.npc));
      // Each file is used once per page: use its original skeleton, never Object3D.clone().
      root = gltf.scene;
      root.name = `Keeper_${stall.id}`; map.add(root);
      refresh(root);
      const height = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y;
      root.scale.multiplyScalar(2.15 / height);
    }
    place(root, entry.keeperPosition, entry.normal);
    root.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; n.frustumCulled = false; n.userData.character = true; } });
    const animation = animateCharacter(root, index * 2.3);
    animation.update(0);
    keepers.set(stall.id, root); entry.keeper = root;
    actors.push({ root, animation, stallId: stall.id, nextGreeting: 8 + index * 3 });
  }
  const occupied = new Set(keepers.values());
  for (const root of map.children.filter(n => /^Armature/.test(n.name) && !occupied.has(n))) {
    root.traverse(n => { if (n.isMesh) { n.frustumCulled = false; n.userData.character = true; } });
    refresh(root);
    const animation = animateCharacter(root, actors.length * 1.7);
    animation.update(0);
    actors.push({ root, animation, patrol: patrolFor(root, navigator) });
  }
  let elapsed = 0, focused = null;
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  return {
    actors,
    faceShop(entry) { turnTo(entry.keeper, entry.viewDirection); refresh(entry.keeper); },
    focus(id) { focused = id; },
    greet(id) { actors.find(a => a.stallId === id)?.animation.greet(); },
    update(dt) {
      elapsed += dt;
      for (const actor of actors) {
        const { patrol, root, animation } = actor;
        let walking = false;
        if (patrol && !focused && !reduced?.matches) {
          patrol.elapsed += dt;
          const duration = (patrol.points.length - 1) * .1 / .45;
          const cycle = patrol.elapsed % (duration * 2 + 4);
          const returning = cycle > duration + 2;
          const t = returning ? 1 - Math.min(1, (cycle - duration - 2) / duration) : Math.min(1, cycle / duration);
          const index = t * (patrol.points.length - 1), a = Math.floor(index), b = Math.min(a + 1, patrol.points.length - 1);
          const p = patrol.points[a].clone().lerp(patrol.points[b], index - a);
          root.position.copy(patrol.base).add(p.sub(patrol.origin));
          const direction = patrol.points.at(-1).clone().sub(patrol.points[0]).multiplyScalar(returning ? -1 : 1);
          turnTo(root, direction);
          walking = cycle < duration || (cycle > duration + 2 && cycle < duration * 2 + 2);
        }
        if (actor.stallId && elapsed > actor.nextGreeting && !focused) {
          animation.greet(); actor.nextGreeting = elapsed + 14;
        }
        animation.update(dt, walking, reduced?.matches);
      }
    },
  };
}
