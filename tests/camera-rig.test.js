import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createCameraRig } from '../js/market/camera-rig.js';

for (const fps of [30, 60, 120]) {
  for (const side of ['left', 'right']) {
    test(`${fps} fps: ${side} stall has continuous motion and finishes at eye level`, () => {
      const rig = createCameraRig();
      const player = { position: new THREE.Vector3(0, 0, 5) };
      const stall = { side, position: { x: side === 'left' ? -5.5 : 5.5, z: 4.8 } };
      rig.update(1 / fps, player, 1.6);
      const start = rig.camera.position.clone();
      const startRotation = rig.camera.quaternion.clone();
      rig.focusOn(stall);
      assert.equal(rig.camera.position.distanceTo(start), 0);
      let previous = start.clone();
      let quaternion = startRotation.clone();
      for (let i = 0; i < fps * 2; i++) {
        rig.update(1 / fps, player, 1.6);
        assert.ok(rig.camera.position.distanceTo(previous) < 60 / fps, 'position must not jump');
        assert.ok(rig.camera.quaternion.angleTo(quaternion) < 4 / fps, 'rotation must not jump');
        previous.copy(rig.camera.position); quaternion.copy(rig.camera.quaternion);
      }
      assert.equal(rig.isTransitioning, false);
      assert.ok(Math.abs(rig.camera.position.y - 1.4) < 1e-9);
      const direction = rig.camera.getWorldDirection(new THREE.Vector3());
      assert.ok(Math.abs(direction.y) < 1e-9, 'focus must be horizontal');
      assert.ok(Math.abs(direction.x - (side === 'left' ? -1 : 1)) < 1e-9);
      rig.release();
      for (let i = 0; i < fps * 2; i++) rig.update(1 / fps, player, 1.6);
      assert.ok(rig.camera.position.distanceTo(start) < 1e-8, 'return to follow composition');
    });
  }
}
test('reversing an unfinished transition preserves position and orientation', () => {
  const rig = createCameraRig();
  const player = { position: new THREE.Vector3(0, 0, 4.8) };
  rig.update(1 / 60, player, 0.6);
  rig.focusOn({ side: 'right', position: { x: 5.5, z: 4.8 } });
  for (let i = 0; i < 40; i++) rig.update(1 / 60, player, 0.6);
  const before = rig.camera.position.clone();
  const rotation = rig.camera.quaternion.clone();
  rig.release(); rig.update(1 / 60, player, 0.6);
  assert.ok(rig.camera.position.distanceTo(before) < 0.01);
  assert.ok(rig.camera.quaternion.angleTo(rotation) < 0.01);
});
