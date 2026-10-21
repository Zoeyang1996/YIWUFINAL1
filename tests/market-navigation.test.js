import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNavigator } from '../js/market/navigation.js';

test('market air walls stop all four exits, allow sliding and returning, and distinguish furniture from the boundary', () => {
  const nav = createNavigator({
    navigation: [[[0,0,0],[10,0,0],[10,0,10]],[[0,0,0],[10,0,10],[0,0,10]]],
    water: [], blockers: [{min:[4,0,4],max:[6,2,6]}],
    boundary: {min:[0,0],max:[10,10]},
  });
  assert.ok(nav.boundaryDistance(3.5,5) > 2, 'furniture must not trigger an end-of-market hint');
  for (const [sx,sz,tx,tz] of [[2,2,-5,2],[8,2,15,2],[2,2,2,-5],[2,8,2,15]]) {
    const end = nav.move({x:sx,y:0,z:sz},tx,tz);
    assert.ok(nav.boundaryDistance(end.x,end.z) >= 0, 'whole body stays inside');
    assert.ok(nav.boundaryDistance(end.x,end.z) < .11, 'can approach the wall');
    const back = nav.move(end,sx,sz);
    assert.ok(Math.hypot(back.x-sx,back.z-sz)<.001, 'can turn back immediately');
  }
  const slide = nav.move({x:.4,y:0,z:2},-1,3);
  assert.ok(slide.x >= .34 && slide.z > 2.9);
  assert.equal(nav.sample(.2,2), null, 'radius is respected before center crosses the edge');
});

test('character radius stops shoulders clipping thin obstacles and swept motion cannot tunnel', () => {
  const nav = createNavigator({
    navigation: [[[0,0,0],[5,0,0],[5,0,5]],[[0,0,0],[5,0,5],[0,0,5]]],
    water: [], blockers: [],
    collision: { origin: [0,0], cellSize: .1, width: 50, height: 50, radius: .34,
      occupied: Array.from({length:50}, (_, z) => z * 50 + 20) },
  });
  assert.equal(nav.sample(1.8, 2), null, 'body overlaps the wall even when its center is outside');
  assert.notEqual(nav.sample(1.5, 2), null);
  const next = nav.move({x:1,y:0,z:2}, 4, 2);
  assert.ok(next.x < 1.67, 'a large move must not skip a thin wall');
  const slide = nav.move({x:1.6,y:0,z:2}, 2.6, 3);
  assert.ok(slide.x < 1.67 && slide.z > 2.9, 'slide along the wall without entering it');
});
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
