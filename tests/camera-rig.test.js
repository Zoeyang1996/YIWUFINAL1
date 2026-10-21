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

test('authored hill-shop elevation and arbitrary shop facing are respected', () => {
  const rig = createCameraRig();
  const player = { position: new THREE.Vector3(-10, 5, -8) };
  rig.update(1 / 60, player, 1.6);
  const shop = { position: new THREE.Vector3(-10, 5, -12), focusTarget: new THREE.Vector3(-10, 6.45, -12), normal: new THREE.Vector3(0, 0, 1) };
  rig.focusOn(shop);
  for (let i = 0; i < 110; i++) rig.update(1 / 60, player, 1.6);
  assert.ok(Math.abs(rig.camera.position.y - 6.45) < 1e-9);
  const facing = rig.camera.getWorldDirection(new THREE.Vector3());
  assert.ok(facing.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9);
});

test('starts behind the character in perspective and rotates movement with the view', () => {
  const rig = createCameraRig(), player = { position: new THREE.Vector3(0, 0, 0) };
  rig.update(1 / 60, player, 1.6);
  assert.ok(rig.camera.isPerspectiveCamera);
  assert.ok(rig.camera.position.y > 4 && rig.camera.position.y < 5, 'entry view is raised and oblique');
  assert.ok(rig.camera.position.distanceTo(new THREE.Vector3(0, 1.15, 0)) > 7, 'comfortable follow distance');
  assert.ok(rig.camera.position.z > 0, 'entry view looks into the street');
  rig.rotate(180, 0);
  for (let i = 0; i < 120; i++) rig.update(1 / 60, player, 1.6);
  const direction = rig.camera.getWorldDirection(new THREE.Vector3()); direction.y = 0; direction.normalize();
  assert.ok(direction.distanceTo(new THREE.Vector3(Math.sin(rig.getYaw()), 0, Math.cos(rig.getYaw()))) < 1e-8);
  const position = rig.camera.position.clone();
  rig.focusOn({ side: 'left', position: { x: -5, z: 0 } });
  for (let i = 0; i < 120; i++) rig.update(1 / 60, player, 1.6);
  rig.release();
  for (let i = 0; i < 180; i++) rig.update(1 / 60, player, 1.6);
  assert.ok(rig.camera.position.distanceTo(position) < 1e-6, 'shop exit restores the chosen orbit');
});

test('zoom stays comfortably distant and camera orbit is unrestricted by obstacles', () => {
  const rig = createCameraRig(), player = { position: new THREE.Vector3() };
  const target = new THREE.Vector3(0, 1.15, 0);
  rig.update(1 / 60, player, 0.6);
  rig.zoom(1e6); rig.rotate(0, 1e6);
  for (let i = 0; i < 120; i++) rig.update(1 / 60, player, 0.6);
  assert.ok(rig.camera.position.distanceTo(target) <= 12.001);
  assert.ok(rig.camera.position.y > 1.15);
  assert.equal(rig.setCollisionResolver, undefined, 'camera has no collision binding');
  rig.zoom(-1e6); rig.rotate(0, -1e6);
  for (let i = 0; i < 180; i++) rig.update(1 / 60, player, 0.6);
  assert.ok(Math.abs(rig.camera.position.distanceTo(target) - 4.5) < 1e-6);
  assert.ok(rig.camera.position.y > 1.15, 'cannot orbit under the ground');
});
