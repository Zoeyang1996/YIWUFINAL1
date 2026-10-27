import * as THREE from 'three';

const DURATION = 1.2;
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const angleDelta = (a, b) => THREE.MathUtils.euclideanModulo(b - a + Math.PI, Math.PI * 2) - Math.PI;

/** Perspective orbit; preserve the player's view across shop visits. */
export function createCameraRig() {
  const camera = new THREE.PerspectiveCamera(55, 1, 0.08, 180);
  const target = new THREE.Vector3(), desiredTarget = new THREE.Vector3(), offset = new THREE.Vector3();
  const follow = new THREE.Spherical(7.2, 1.12, 0);
  const orbit = follow.clone(), destination = follow.clone();
  let mode = 'follow', focus = null, initialized = false, transition = null;
  let framing = 0;
  function begin() {
    transition = { elapsed: 0, target: target.clone(), orbit: orbit.clone(), framing };
  }
  function update(delta, player, aspect) {
    const dt = Math.min(Math.max(delta, 0), 0.05);
    const focusing = mode === 'focus' && focus;
    desiredTarget.copy(player.position); desiredTarget.y += 1.15;
    destination.copy(follow);
    if (focusing) {
      if (focus.focusTarget) desiredTarget.copy(focus.focusTarget);
      else desiredTarget.set(focus.position.x, (focus.position.y ?? 0) + 1.4, focus.position.z);
      const direction = focus.viewDirection ?? focus.normal;
      destination.set(focus.cameraDistance ? focus.cameraDistance * (aspect < .85 ? 1.25 : 1) : (aspect < 0.85 ? 7.5 : 6), focus.cameraPitch ?? Math.PI / 2,
        direction ? Math.atan2(direction.x, direction.z) : (focus.side === 'left' ? Math.PI / 2 : -Math.PI / 2));
    }
    if (!initialized) { target.copy(desiredTarget); orbit.copy(destination); initialized = true; }
    if (transition) {
      transition.elapsed += dt;
      const t = smooth(Math.min(1, transition.elapsed / DURATION)), start = transition.orbit;
      target.lerpVectors(transition.target, desiredTarget, t);
      orbit.set(THREE.MathUtils.lerp(start.radius, destination.radius, t),
        THREE.MathUtils.lerp(start.phi, destination.phi, t), start.theta + angleDelta(start.theta, destination.theta) * t);
      framing = THREE.MathUtils.lerp(transition.framing, focusing ? 1 : 0, t);
      if (transition.elapsed >= DURATION) transition = null;
    } else {
      target.lerp(desiredTarget, 1 - Math.exp(-12 * dt));
      const k = 1 - Math.exp(-18 * dt);
      orbit.radius = THREE.MathUtils.lerp(orbit.radius, destination.radius, k);
      orbit.phi = THREE.MathUtils.lerp(orbit.phi, destination.phi, k);
      orbit.theta += angleDelta(orbit.theta, destination.theta) * k;
    }
    offset.setFromSpherical(orbit);
    camera.position.copy(target).add(offset); camera.lookAt(target);
    camera.aspect = aspect; camera.updateProjectionMatrix();
    camera.projectionMatrix.elements[8] = aspect >= 0.85 ? Math.min(0.42, 390 / (globalThis.innerWidth || 1200)) * framing : 0;
    camera.projectionMatrix.elements[9] = aspect < 0.85 ? -0.35 * framing : 0;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
  }
  return {
    camera, update,
    reset() { initialized = false; transition = null; },
    rotate(dx, dy) {
      if (mode !== 'follow' || transition) return;
      follow.theta -= dx * 0.005;
      follow.phi = THREE.MathUtils.clamp(follow.phi - dy * 0.004, 0.65, 1.48);
    },
    zoom(delta) {
      if (mode === 'follow' && !transition) follow.radius = THREE.MathUtils.clamp(follow.radius * Math.exp(delta * 0.001), 4.5, 12);
    },
    focusOn(stall) { if (focus === stall) return; focus = stall; mode = 'focus'; begin(); },
    release() { if (mode === 'follow') return; mode = 'follow'; focus = null; begin(); },
    getYaw() { return orbit.theta + Math.PI; },
    get mode() { return mode; },
    get isTransitioning() { return transition !== null; },
  };
}
