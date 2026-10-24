import * as THREE from 'three';

/** Animate the authored skeleton without requiring an exported animation clip. */
export function createFanKeeper(map) {
  const root = map.getObjectByName('Armature');
  if (!root) return null;
  const upper = root.getObjectByName('R_Upperarm');
  const forearm = root.getObjectByName('R_Forearm');
  const hand = root.getObjectByName('R_Hand');
  const head = root.getObjectByName('Head');
  if (!upper || !forearm || !hand) return null;
  const bones = [upper, forearm, hand, head].filter(Boolean);
  const rest = new Map(bones.map(bone => [bone, bone.quaternion.clone()]));
  const worldQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion();
  const deltaQ = new THREE.Quaternion(), direction = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0), euler = new THREE.Euler();
  let elapsed = Infinity;
  function point(bone, target, blend) {
    bone.getWorldQuaternion(worldQ);
    direction.copy(yAxis).applyQuaternion(worldQ);
    deltaQ.setFromUnitVectors(direction, target.normalize());
    worldQ.premultiply(deltaQ);
    bone.parent.getWorldQuaternion(parentQ).invert();
    worldQ.premultiply(parentQ);
    bone.quaternion.slerp(worldQ, blend);
    bone.updateWorldMatrix(false, true);
  }
  return {
    greet() { elapsed = 0; },
    update(dt) {
      if (elapsed > 4.2) return;
      elapsed += dt;
      bones.forEach(bone => bone.quaternion.copy(rest.get(bone)));
      const strength = THREE.MathUtils.smoothstep(elapsed, 0, .7)
        * (1 - THREE.MathUtils.smoothstep(elapsed, 3.4, 4.2));
      point(upper, new THREE.Vector3(-.18, .3, -.95), strength);
      point(forearm, new THREE.Vector3(-.15, 1, .25 * Math.sin(elapsed * 8)), strength);
      hand.quaternion.multiply(deltaQ.setFromEuler(euler.set(.08 * strength, 0, .25 * Math.sin(elapsed * 8) * strength)));
      if (head) head.quaternion.multiply(deltaQ.setFromEuler(euler.set(.055 * Math.sin(elapsed * 3) * strength, 0, 0)));
    },
  };
}
