import * as THREE from 'three';

/** Choose a clear front-side view against the actual updated scene geometry. */
export function frameShop(entry, occluders) {
  const keeperBox = new THREE.Box3().setFromObject(entry.keeper);
  const keeperCenter = keeperBox.getCenter(new THREE.Vector3());
  const target = new THREE.Vector3(entry.position.x, keeperCenter.y, entry.position.z).lerp(keeperCenter, .65);
  const points = [.48, .75, .94].map(t => new THREE.Vector3(keeperCenter.x,
    THREE.MathUtils.lerp(keeperBox.min.y, keeperBox.max.y, t), keeperCenter.z));
  const shoulder = new THREE.Vector3().crossVectors(entry.normal, new THREE.Vector3(0, 1, 0)).multiplyScalar(.35);
  points.push(points[1].clone().add(shoulder), points[1].clone().sub(shoulder));
  const keeperSamples = points.length;
  points.push(new THREE.Vector3(entry.position.x, entry.position.y + .8, entry.position.z));
  const ray = new THREE.Raycaster(), direction = new THREE.Vector3(), axis = new THREE.Vector3(0, 1, 0);
  let best;
  for (const yaw of [0, -.22, .22, -.45, .45, -.68, .68, -.95, .95, -1.3, 1.3]) {
    for (const lift of [.35, .8, 1.3]) {
      const view = entry.normal.clone().applyAxisAngle(axis, yaw);
      const position = target.clone().addScaledVector(view, entry.cameraDistance); position.y += lift;
      let score = Math.abs(yaw) * 2 + lift * .2;
      // Portrait uses a wider distance; validate it too before committing the view.
      for (const scale of [1, 1.25]) {
        const origin = position.clone().sub(target).multiplyScalar(scale).add(target);
        for (const [index, point] of points.entries()) {
          direction.subVectors(point, origin); ray.far = direction.length() - .12;
          ray.set(origin, direction.normalize());
          const candidates = occluders.filter(({ box }) => ray.ray.intersectsBox(box)).map(({ mesh }) => mesh);
          if (ray.intersectObjects(candidates, false).length) score += index < keeperSamples ? 100 : 15;
        }
      }
      if (!best || score < best.score) best = { score, position, view, lift };
    }
  }
  entry.focusTarget.copy(target);
  entry.viewDirection = best.view;
  entry.cameraPitch = Math.atan2(entry.cameraDistance, best.lift);
  entry.cameraDistance = Math.hypot(entry.cameraDistance, best.lift);
  entry.sightTargets = points.slice(0, keeperSamples);
  entry.cameraClearanceScore = best.score;
}
