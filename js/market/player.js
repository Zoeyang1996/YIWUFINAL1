import * as THREE from 'three';
import { loadGltf } from '../core/loader.js';
import { PLAYER_MODEL, PLAYER_HEIGHT } from '../data/player.js';

const WALK_SPEED = 2.55;
const TURN_SPEED = 10;

export function createPlayer() {
  const root = new THREE.Group();
  root.name = 'Player';
  let navigation = null, groundHeight = 0;
  let mixer, idle, walk, loadPromise;
  let walkWeight = 0, walkRate = 1;
  const state = { yaw: Math.PI, targetYaw: Math.PI, speed: 0 };
  root.rotation.y = state.yaw;
  const forward = new THREE.Vector3(), right = new THREE.Vector3(), desire = new THREE.Vector3();
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');

  function load() {
    if (loadPromise) return loadPromise;
    loadPromise = loadGltf(PLAYER_MODEL).then(gltf => {
      // One player per page: preserve the imported mesh/skeleton relationship.
      const model = gltf.scene;
      const hip = model.getObjectByName('Hip');
      const walkClip = gltf.animations.find(clip => /^walk(?:[._]|$)/i.test(clip.name));
      const idleClip = gltf.animations.find(clip => /^(?:wait|idle)(?:[._]|$)/i.test(clip.name));
      if (!hip || !walkClip || !idleClip) throw new Error('主角模型缺少行走、待机动画或 Hip 骨骼');
      // This export is Z-up inside Root. Hip X/Y contain horizontal root motion;
      // navigation owns displacement, while Hip Z keeps the authored footfall bob.
      function inPlace(clip) {
        const copy = clip.clone();
        const track = copy.tracks.find(track => track.name === `${hip.name}.position`);
        if (track) for (let i = 0; i < track.values.length; i += 3) {
          track.values[i] = hip.position.x;
          track.values[i + 1] = hip.position.y;
        }
        return copy;
      }
      mixer = new THREE.AnimationMixer(model);
      idle = mixer.clipAction(inPlace(idleClip)).play();
      walk = mixer.clipAction(inPlace(walkClip)).setEffectiveWeight(0).play();
      mixer.update(0);
      // The authored character faces +X; movement and the camera use +Z.
      model.rotation.y = -Math.PI / 2;
      function bounds() {
        model.updateMatrixWorld(true);
        model.traverse(mesh => { if (mesh.isSkinnedMesh) mesh.computeBoundingBox(); });
        return new THREE.Box3().setFromObject(model);
      }
      const original = bounds();
      model.scale.multiplyScalar(PLAYER_HEIGHT / original.getSize(new THREE.Vector3()).y);
      const box = bounds(), center = box.getCenter(new THREE.Vector3());
      model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
      // Match the clip's travel per cycle to the navigation speed after scaling.
      const hipTrack = walkClip.tracks.find(track => track.name === `${hip.name}.position`);
      if (hipTrack) {
        const values = hipTrack.values;
        const travel = Math.hypot(values.at(-3) - values[0], values.at(-2) - values[1]) * model.scale.x;
        if (travel > .01) walkRate = WALK_SPEED * walkClip.duration / travel;
      }
      model.traverse(mesh => {
        if (!mesh.isMesh) return;
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.frustumCulled = false; mesh.userData.character = true;
      });
      root.add(model);
      root.updateMatrixWorld(true);
    });
    return loadPromise;
  }

  function update(delta, input, cameraYaw) {
    forward.set(Math.sin(cameraYaw), 0, Math.cos(cameraYaw)).normalize();
    right.set(-forward.z, 0, forward.x);

    desire.set(0, 0, 0);
    desire.addScaledVector(forward, input.y);
    desire.addScaledVector(right, input.x);

    const magnitude = Math.min(1, desire.length());
    if (magnitude > 0.02) {
      desire.normalize();
      state.targetYaw = Math.atan2(desire.x, desire.z);
    }

    const targetSpeed = magnitude * WALK_SPEED;
    state.speed += (targetSpeed - state.speed) * Math.min(1, delta * 12);

    const previousX = root.position.x, previousZ = root.position.z;
    if (state.speed > 0.01) {
      const step = state.speed * delta;
      const nextX = root.position.x + Math.sin(state.yaw) * step;
      const nextZ = root.position.z + Math.cos(state.yaw) * step;
      const clamped = navigation?.move({ x: root.position.x, y: groundHeight, z: root.position.z }, nextX, nextZ) ?? { x: root.position.x, y: groundHeight, z: root.position.z };
      groundHeight = clamped.y;
      root.position.x = clamped.x;
      root.position.z = clamped.z;
    }

    // 朝向：取最近的一圈再插值，避免转向时绕远路
    let diff = state.targetYaw - state.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.yaw += diff * Math.min(1, delta * TURN_SPEED);
    root.rotation.y = state.yaw;

    const actualSpeed = delta > 0 ? Math.hypot(root.position.x - previousX, root.position.z - previousZ) / delta : 0;
    const stride = THREE.MathUtils.clamp(actualSpeed / WALK_SPEED, 0, 1);
    walkWeight = THREE.MathUtils.lerp(walkWeight, stride, 1 - Math.exp(-12 * delta));
    if (mixer) {
      idle.setEffectiveWeight(1 - walkWeight);
      walk.setEffectiveWeight(walkWeight).setEffectiveTimeScale(walkRate * Math.max(.15, stride));
      // Keep walking feedback, but freeze optional idle motion when requested.
      idle.paused = Boolean(reduced?.matches);
      mixer.update(delta);
    }
    root.position.y += (groundHeight - root.position.y) * (1 - Math.exp(-16 * delta));
  }

  return {
    object: root,
    load,
    update,
    setMap(navigator, spawn) {
      navigation = navigator;
      groundHeight = navigator.sample(spawn.x, spawn.z) ?? spawn.y;
      root.position.set(spawn.x, groundHeight, spawn.z);
      state.speed = 0;
    },
    get position() { return root.position; },
  };
}
