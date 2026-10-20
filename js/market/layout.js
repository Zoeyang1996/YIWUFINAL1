/** 二级页面的街道坐标：一条南北向的直街，摊位分列两侧 */

export const STREET = {
  halfWidth: 3.0,
  stallX: 5.5,
  zNear: 13,
  zFar: -13,
  playerMinZ: -10.4,
  playerMaxZ: 10.4,
  playerMinX: -2.7,
  playerMaxX: 2.7,
};

const SLOT_Z = [4.8, -4.8];

export const PLAYER_START = { x: 0, z: 9.6 };

/** 摊位朝向街心的位置与转角 */
export function stallTransform(stall) {
  const left = stall.side === 'left';
  const z = SLOT_Z[stall.slot] ?? SLOT_Z[0];
  return {
    position: { x: left ? -STREET.stallX : STREET.stallX, y: 0, z },
    rotationY: left ? Math.PI * 0.5 : -Math.PI * 0.5,
    side: stall.side,
  };
}

/** 摊位牌匾悬在摊位上方 */
export function signPosition(stall) {
  const { position } = stallTransform(stall);
  return { x: position.x * 0.72, y: 2.55, z: position.z };
}

export function clampToStreet(x, z) {
  return {
    x: Math.max(STREET.playerMinX, Math.min(STREET.playerMaxX, x)),
    z: Math.max(STREET.playerMinZ, Math.min(STREET.playerMaxZ, z)),
  };
}
