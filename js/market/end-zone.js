// Walkable approaches to the final landmark in each authored market (Y-up).
export const END_ZONES = {
  // 算卦茶歇 spans x=-1.22..5.02, z=8.23..15.89 in the latest GLB.
  // Cover both the western walking aisle and the southern approach.
  morning: { center: [1.9, 1.29313, 12.1], radius: 5, label: '算卦茶歇摊位' },
  noon: { center: [10.6, .192, -19.5], radius: 2.5, label: '市集尽头 · 牌坊' },
  night: { center: [6, 8.24, -17], radius: 2.8, label: '山脊茶亭' },
};

export function createEndZone(zone) {
  let armed = true;
  return {
    update(position, enabled = true) {
      const [x, y, z] = zone.center;
      const distance = Math.hypot(position.x - x, position.z - z);
      const height = Math.abs(position.y - y);
      if (distance > zone.radius + 1.5 || height > 2) armed = true;
      if (!enabled || !armed || distance > zone.radius || height > 1) return false;
      armed = false;
      return true;
    },
  };
}
