/** Blender Z-up triangles are exported as Three.js Y-up. A small spatial grid
 * keeps terrain queries local instead of scanning the full map every frame. */
export function createNavigator(data) {
  const cells = new Map();
  const cellSize = 2;
  const key = (x, z) => `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;
  for (const triangle of data.navigation) {
    const xs = triangle.map((v) => v[0]), zs = triangle.map((v) => v[2]);
    for (let x = Math.floor(Math.min(...xs) / cellSize); x <= Math.floor(Math.max(...xs) / cellSize); x++)
      for (let z = Math.floor(Math.min(...zs) / cellSize); z <= Math.floor(Math.max(...zs) / cellSize); z++) {
        const id = `${x},${z}`;
        if (!cells.has(id)) cells.set(id, []);
        cells.get(id).push(triangle);
      }
  }
  function heightOn(triangle, x, z) {
    const [a, b, c] = triangle;
    const denominator = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denominator) < 1e-8) return null;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denominator;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denominator;
    if (u < -1e-5 || v < -1e-5 || u + v > 1.00001) return null;
    return u * a[1] + v * b[1] + (1 - u - v) * c[1];
  }
  function sample(x, z, previousHeight = null) {
    const heights = (cells.get(key(x, z)) ?? []).map((t) => heightOn(t, x, z))
      .filter((h) => h !== null && (previousHeight === null || Math.abs(h - previousHeight) <= 0.55));
    if (!heights.length) return null;
    const y = Math.max(...heights);
    if (data.water.some((t) => heightOn(t, x, z) !== null) && y < 0.18) return null;
    for (const box of data.blockers) {
      if (x > box.min[0] - 0.15 && x < box.max[0] + 0.15 && z > box.min[2] - 0.15 && z < box.max[2] + 0.15
        && y < box.max[1] && y + 1.3 > box.min[1]) return null;
    }
    return y;
  }
  function move(current, x, z) {
    const direct = sample(x, z, current.y);
    if (direct !== null) return { x, y: direct, z };
    const slideX = sample(x, current.z, current.y);
    if (slideX !== null) return { x, y: slideX, z: current.z };
    const slideZ = sample(current.x, z, current.y);
    if (slideZ !== null) return { x: current.x, y: slideZ, z };
    return { x: current.x, y: current.y, z: current.z };
  }
  return { sample, move };
}
