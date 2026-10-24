import * as THREE from 'three';

/** Orbit the isolated product preview with mouse, touch drag, or pinch. */
export class ProductControls {
  constructor(camera, canvas) {
    this.target = new THREE.Vector3();
    this.minDistance = 2.1; this.maxDistance = 9;
    this.enableDamping = true;
    this.camera = camera;
    this.orbit = new THREE.Spherical(); this.offset = new THREE.Vector3();
    this.dx = 0; this.dy = 0; this.zoom = 1;
    const pointers = new Map();
    const distance = () => {
      const [a, b] = [...pointers.values()]; return b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    canvas.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      this.reset();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      canvas.setPointerCapture(event.pointerId); canvas.focus({ preventScroll: true });
    });
    canvas.addEventListener('pointermove', event => {
      const previous = pointers.get(event.pointerId); if (!previous) return;
      const before = distance();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        this.dx += (event.clientX - previous.x) * .007;
        this.dy += (event.clientY - previous.y) * .007;
      } else {
        const after = distance(); if (before > 0 && after > 0) this.zoom *= before / after;
      }
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, event => pointers.delete(event.pointerId));
    canvas.addEventListener('wheel', event => {
      event.preventDefault(); this.zoom *= Math.exp(THREE.MathUtils.clamp(event.deltaY, -200, 200) * .001);
    }, { passive: false });
  }
  update() {
    this.offset.copy(this.camera.position).sub(this.target);
    this.orbit.setFromVector3(this.offset);
    const amount = this.enableDamping ? .35 : 1;
    this.orbit.theta -= this.dx * amount;
    this.orbit.phi = THREE.MathUtils.clamp(this.orbit.phi - this.dy * amount, .08, Math.PI - .08);
    this.orbit.radius = THREE.MathUtils.clamp(this.orbit.radius * this.zoom, this.minDistance, this.maxDistance);
    this.dx *= 1 - amount; this.dy *= 1 - amount; this.zoom = 1;
    this.camera.position.copy(this.target).add(this.offset.setFromSpherical(this.orbit));
    this.camera.lookAt(this.target);
  }
  reset() { this.dx = this.dy = 0; this.zoom = 1; }
}
