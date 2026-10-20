import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNavigator } from '../js/market/navigation.js';
for (const phase of ['morning', 'noon', 'night']) {
  const data = JSON.parse(readFileSync(new URL(`../assets/markets/${phase}.json`, import.meta.url)));
  test(`${phase}: entrance and every shop are reachable on the exported map`, () => {
    const nav = createNavigator(data);
    const [sx, , sz] = data.spawn;
    const startY = nav.sample(sx, sz);
    assert.notEqual(startY, null, 'entrance must be walkable');
    const step = 0.45, queue = [[0, 0, startY]], visited = new Set(['0,0']);
    const reached = new Set();
    for (let head = 0; head < queue.length && head < 45000; head++) {
      const [gx, gz, y] = queue[head], x = sx + gx * step, z = sz + gz * step;
      for (const stall of data.stalls) {
        const dx = x - stall.position[0], dz = z - stall.position[2];
        if (Math.hypot(dx, dz) < 5 && Math.abs(y - stall.position[1]) < 1.5 && dx * stall.normal[0] + dz * stall.normal[2] > 1)
          reached.add(stall.id);
      }
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx = gx + dx, nz = gz + dz, key = `${nx},${nz}`;
        if (visited.has(key)) continue;
        let h = y;
        for (let part = 1; part <= 9; part++) {
          h = nav.sample(x + dx * step * part / 9, z + dz * step * part / 9, h);
          if (h === null) break;
        }
        if (h !== null) { visited.add(key); queue.push([nx, nz, h]); }
      }
    }
    assert.equal(reached.size, data.stalls.length, `unreachable shops: ${data.stalls.filter(s => !reached.has(s.id)).map(s => s.id)} (${visited.size} walkable samples)`);
  });
}
