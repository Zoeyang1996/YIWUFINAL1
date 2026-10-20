import * as THREE from 'three';

const FOLLOW_OFFSET = new THREE.Vector3(0.66, 0.86, 0.66).normalize().multiplyScalar(26);
const FOLLOW_HEIGHT = 11.5;
const DURATION = 1.65;
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** 在注视点周围绕行并降低机位，避免直线穿过摊位；构图偏移也参与插值。 */
export function createCameraRig() {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const target = new THREE.Vector3();
  const desiredTarget = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const orbit = new THREE.Spherical().setFromVector3(FOLLOW_OFFSET);
  const destination = orbit.clone();
  let mode = 'follow', focus = null, initialized = false, transition = null;
  let viewHeight = FOLLOW_HEIGHT, framing = 0;

  function begin() {
    transition = { elapsed: 0, target: target.clone(), orbit: orbit.clone(), height: viewHeight, framing };
  }

  function update(delta, player, aspect) {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const focusing = mode === 'focus' && focus;
    desiredTarget.copy(player.position);
    desiredTarget.y += 0.85;
    destination.setFromVector3(FOLLOW_OFFSET);
    let desiredHeight = FOLLOW_HEIGHT;
    if (focusing) {
      if (focus.focusTarget) desiredTarget.copy(focus.focusTarget);
      else desiredTarget.set(focus.position.x, (focus.position.y ?? 0) + 1.4, focus.position.z);
      destination.set(7, Math.PI / 2, focus.normal ? Math.atan2(focus.normal.x, focus.normal.z) : (focus.side === 'left' ? Math.PI / 2 : -Math.PI / 2));
      desiredHeight = aspect < 0.85 ? 7.8 : 5.4;
    }
    if (!initialized) {
      target.copy(desiredTarget);
      orbit.copy(destination);
      initialized = true;
    }
    if (transition) {
      transition.elapsed += dt;
      const t = smooth(Math.min(1, transition.elapsed / DURATION));
      const start = transition.orbit;
      const angle = THREE.MathUtils.euclideanModulo(destination.theta - start.theta + Math.PI, Math.PI * 2) - Math.PI;
      target.lerpVectors(transition.target, desiredTarget, t);
      orbit.set(THREE.MathUtils.lerp(start.radius, destination.radius, t),
        THREE.MathUtils.lerp(start.phi, destination.phi, t), start.theta + angle * t);
      viewHeight = THREE.MathUtils.lerp(transition.height, desiredHeight, t);
      framing = THREE.MathUtils.lerp(transition.framing, focusing ? 1 : 0, t);
      if (transition.elapsed >= DURATION) transition = null;
    } else {
      const k = 1 - Math.exp(-5 * dt);
      target.lerp(desiredTarget, k);
      orbit.copy(destination);
      viewHeight = THREE.MathUtils.lerp(viewHeight, desiredHeight, k);
    }
    camera.position.copy(target).add(offset.setFromSpherical(orbit));
    camera.lookAt(target);
    const hh = viewHeight / 2, hw = hh * aspect;
    // 用平移投影保留真正的平视：宽屏给右栏留位，窄屏给底部栏留位。
    const sx = aspect >= 0.85 ? hw * Math.min(0.4, 390 / (globalThis.innerWidth || 1200)) * framing : 0;
    const sy = aspect < 0.85 ? -hh * 0.35 * framing : 0;
    camera.left = -hw + sx;
    camera.right = hw + sx;
    camera.top = hh + sy;
    camera.bottom = -hh + sy;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  return {
    camera, update,
    reset() { initialized = false; transition = null; },
    focusOn(stall) { if (focus === stall) return; focus = stall; mode = 'focus'; begin(); },
    release() { if (mode === 'follow') return; mode = 'follow'; focus = null; begin(); },
    getYaw() { return Math.atan2(target.x - camera.position.x, target.z - camera.position.z); },
    get mode() { return mode; },
    get isTransitioning() { return transition !== null; },
  };
}
