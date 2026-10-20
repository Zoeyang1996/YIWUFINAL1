import * as THREE from 'three';
import { clampToStreet, PLAYER_START } from './layout.js';

/** 一个戴竹笠、提小灯的小小人 —— 用基本体搭出来的 */
const WALK_SPEED = 2.55;
const TURN_SPEED = 10;

function buildFigure() {
  const root = new THREE.Group();

  const robe = new THREE.MeshStandardMaterial({ color: '#3a4f63', roughness: 0.88 });
  const robeLight = new THREE.MeshStandardMaterial({ color: '#4c6478', roughness: 0.88 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e8c3a0', roughness: 0.9 });
  const straw = new THREE.MeshStandardMaterial({ color: '#c69a58', roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2b30', roughness: 0.9 });

  // 身体（上窄下宽的长衫）
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.31, 0.68, 12), robe);
  body.position.y = 0.78;
  body.castShadow = true;
  root.add(body);

  // 衣摆
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.34, 0.1, 12), robeLight);
  hem.position.y = 0.45;
  hem.castShadow = true;
  root.add(hem);

  // 腰带
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 12), dark);
  belt.position.y = 0.96;
  root.add(belt);

  // 头
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), skin);
  head.position.y = 1.2;
  head.castShadow = true;
  root.add(head);

  // 竹笠
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.17, 16, 1, true), straw);
  hat.position.y = 1.32;
  hat.castShadow = true;
  root.add(hat);
  const hatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.325, 0.018, 6, 20), straw);
  hatBrim.rotation.x = Math.PI / 2;
  hatBrim.position.y = 1.245;
  root.add(hatBrim);

  // 手臂
  const armGeometry = new THREE.CylinderGeometry(0.052, 0.045, 0.44, 8);
  const leftArm = new THREE.Mesh(armGeometry, robeLight);
  leftArm.position.set(-0.22, 0.86, 0);
  leftArm.geometry.translate(0, -0.22, 0);
  leftArm.castShadow = true;
  root.add(leftArm);

  const rightArm = new THREE.Mesh(armGeometry, robeLight);
  rightArm.position.set(0.22, 0.86, 0);

  rightArm.castShadow = true;
  root.add(rightArm);

  // 腿
  const legGeometry = new THREE.CylinderGeometry(0.058, 0.05, 0.46, 8);
  const leftLeg = new THREE.Mesh(legGeometry, dark);
  leftLeg.position.set(-0.1, 0.46, 0);
  leftLeg.geometry.translate(0, -0.23, 0);
  leftLeg.castShadow = true;
  root.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeometry, dark);
  rightLeg.position.set(0.1, 0.46, 0);

  rightLeg.castShadow = true;
  root.add(rightLeg);

  // 手里的小灯
  const lantern = new THREE.Group();
  lantern.position.set(0.26, 0.55, 0.06);
  const lampBody = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 12, 10),
    new THREE.MeshStandardMaterial({
      color: '#ffdca6',
      emissive: new THREE.Color('#ffb45c'),
      emissiveIntensity: 0.4,
      roughness: 0.7,
    })
  );
  lantern.add(lampBody);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 5, 10, Math.PI), dark);
  handle.position.y = 0.085;
  lantern.add(handle);
  root.add(lantern);

  return { root, leftArm, rightArm, leftLeg, rightLeg, lampBody, head };
}

export function createPlayer() {
  const parts = buildFigure();
  const root = parts.root;
  root.position.set(PLAYER_START.x, 0, PLAYER_START.z);

  const state = {
    yaw: Math.PI,
    targetYaw: Math.PI,
    speed: 0,
    phase: 0,
    lampGlow: 0.4,
  };

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const desire = new THREE.Vector3();

  /**
   * @param {number} delta 秒
   * @param {{x:number,y:number}} input 相机坐标系下的输入
   * @param {number} cameraYaw 相机绕 Y 的方位角
   */
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

    if (state.speed > 0.01) {
      const step = state.speed * delta;
      const nextX = root.position.x + Math.sin(state.yaw) * step;
      const nextZ = root.position.z + Math.cos(state.yaw) * step;
      const clamped = clampToStreet(nextX, nextZ);
      root.position.x = clamped.x;
      root.position.z = clamped.z;
    }

    // 朝向：取最近的一圈再插值，避免转向时绕远路
    let diff = state.targetYaw - state.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.yaw += diff * Math.min(1, delta * TURN_SPEED);
    root.rotation.y = state.yaw;

    // 走路的摆臂摆腿
    const stride = state.speed / WALK_SPEED;
    state.phase += delta * (5.2 + stride * 4.4);
    const swing = Math.sin(state.phase) * 0.62 * stride;
    parts.leftLeg.rotation.x = swing;
    parts.rightLeg.rotation.x = -swing;
    parts.leftArm.rotation.x = -swing * 0.8;
    parts.rightArm.rotation.x = swing * 0.55;

    root.position.y = Math.abs(Math.sin(state.phase)) * 0.045 * stride;
    parts.head.rotation.z = Math.sin(state.phase * 0.5) * 0.03;
  }

  function setPhaseMood(phaseId) {
    state.lampGlow = phaseId === 'night' ? 2.6 : phaseId === 'morning' ? 0.5 : 0.28;
    parts.lampBody.material.emissiveIntensity = state.lampGlow;
  }

  return {
    object: root,
    update,
    setPhaseMood,
    get position() {
      return root.position;
    },
  };
}
