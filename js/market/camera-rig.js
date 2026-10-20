import * as THREE from 'three';

/**
 * 正交第三人称机位。
 * follow：斜俯视跟着角色；focus：平视对着某位摊主。
 */

const FOLLOW_DIR = new THREE.Vector3(0.66, 0.86, 0.66).normalize();
const FOLLOW_DISTANCE = 26;
const FOLLOW_HEIGHT = 11.5;
const FOCUS_HEIGHT = 7.2;

export function createCameraRig() {
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 90);
  camera.position.set(14, 14, 14);

  const state = {
    mode: 'follow',
    focus: null,
    viewHeight: FOLLOW_HEIGHT,
    position: new THREE.Vector3(14, 14, 14),
    target: new THREE.Vector3(0, 0.8, 0),
    desiredPosition: new THREE.Vector3(14, 14, 14),
    desiredTarget: new THREE.Vector3(0, 0.8, 0),
    desiredHeight: FOLLOW_HEIGHT,
  };

  const shift = new THREE.Vector3();
  const view = new THREE.Vector3();
  const rightAxis = new THREE.Vector3();

  function followDesired(playerPosition) {
    state.desiredTarget.set(playerPosition.x, 0.85, playerPosition.z);
    state.desiredPosition
      .copy(state.desiredTarget)
      .addScaledVector(FOLLOW_DIR, FOLLOW_DISTANCE);
    state.desiredHeight = FOLLOW_HEIGHT;
  }

  /** @param {{position:{x:number,z:number}, side:string}} stall */
  function focusDesired(stall) {
    const inward = stall.side === 'left' ? 1 : -1;
    const eyeX = stall.position.x + inward * 9;
    state.desiredTarget.set(stall.position.x, 1.05, stall.position.z);
    state.desiredPosition.set(eyeX, 1.05, stall.position.z);
    state.desiredHeight = FOCUS_HEIGHT;
  }

  /**
   * @param {number} delta
   * @param {{position: THREE.Vector3}} player
   * @param {number} aspect
   * @param {number} damping 收敛速度，切换时给大一点
   */
  function update(delta, player, aspect, damping = 3.4) {
    if (state.mode === 'focus' && state.focus) focusDesired(state.focus);
    else followDesired(player.position);

    const k = 1 - Math.exp(-damping * delta);

    state.position.lerp(state.desiredPosition, k);
    state.target.lerp(state.desiredTarget, k);
    state.viewHeight += (state.desiredHeight - state.viewHeight) * k;

    camera.position.copy(state.position);

    // 平视时把主体往左挪一点，给右侧商品栏留位
    if (state.mode === 'focus') {
      view.copy(state.desiredTarget).sub(state.desiredPosition).normalize();
      rightAxis.crossVectors(camera.up, view).normalize();
      shift.copy(state.target).addScaledVector(rightAxis, -1.35);
      camera.lookAt(shift);
    } else {
      camera.lookAt(state.target);
    }

    const halfHeight = state.viewHeight / 2;
    const halfWidth = halfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
  }

  function focusOn(stall) {
    state.mode = 'focus';
    state.focus = stall;
  }

  function release() {
    state.mode = 'follow';
    state.focus = null;
  }

  /** 角色移动用的方位角：前方 = 相机看向角色的方向在水平面上的投影 */
  function getYaw() {
    const dx = state.target.x - state.position.x;
    const dz = state.target.z - state.position.z;
    return Math.atan2(dx, dz);
  }

  return {
    camera,
    update,
    focusOn,
    release,
    getYaw,
    get mode() {
      return state.mode;
    },
  };
}
