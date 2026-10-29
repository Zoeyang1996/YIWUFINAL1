// Run with Node 22+: node scripts/verify-market-assets.mjs
// Uses the production GLTF parser and scene logic; only image decoding is stubbed.
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.preview-check', 'modules');
const copied = new Set();
const revision = Date.now();
async function mirror(relative) {
  const target = path.join(output, relative.replace(/\.js$/, '.mjs'));
  if (copied.has(relative)) return `${pathToFileURL(target).href}?v=${revision}`;
  copied.add(relative);
  let source = await fs.readFile(path.join(root, relative), 'utf8');
  for (const match of [...source.matchAll(/^import\s+[\s\S]*?\s+from ['"]([^'"]+)['"]/gm)]) {
    const spec = match[1];
    const dependency = spec === 'three' ? 'vendor/three/three.module.js'
      : spec.startsWith('three/addons/') ? `vendor/three/addons/${spec.slice(13)}`
      : path.posix.normalize(path.posix.join(path.posix.dirname(relative), spec));
    source = source.replace(match[0], match[0].replace(spec, await mirror(dependency)));
  }
  if (relative === 'js/core/loader.js') source = 'export const loadGltf = url => globalThis.__marketTestLoad(url);';
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, source);
  return `${pathToFileURL(target).href}?v=${revision}`;
}
const THREE = await import(await mirror('vendor/three/three.module.js'));
const { GLTFLoader } = await import(await mirror('vendor/three/addons/loaders/GLTFLoader.js'));
const { PHASES } = await import(await mirror('js/data/phases.js'));
const { PRODUCTS } = await import(await mirror('js/data/products.js'));
const { loadMarketMap } = await import(await mirror('js/market/map.js'));
const { createCameraRig } = await import(await mirror('js/market/camera-rig.js'));
const { createPlayer } = await import(await mirror('js/market/player.js'));
const { PLAYER_HEIGHT } = await import(await mirror('js/data/player.js'));
const nativeFetch = globalThis.fetch;
globalThis.self = globalThis;
globalThis.ProgressEvent ??= class { constructor(type, fields) { Object.assign(this, fields); } };
const cache = new Map();
globalThis.__marketTestLoad = async url => {
  const name = decodeURI(url.split('?')[0]);
  if (!cache.has(name)) cache.set(name, (async () => {
    const buffer = await fs.readFile(path.join(root, name));
    assert.equal(buffer.toString('ascii', 0, 4), 'glTF', name);
    const length = buffer.readUInt32LE(12);
    const json = JSON.parse(buffer.toString('utf8', 20, 20 + length));
    json.buffers[0].uri = `data:application/octet-stream;base64,${buffer.subarray(28 + length).toString('base64')}`;
    const loader = new GLTFLoader();
    loader.register(() => ({ name: 'test-textures', loadTexture: async () => new THREE.Texture() }));
    return loader.parseAsync(JSON.stringify(json), '');
  })());
  return cache.get(name);
};
globalThis.fetch = async (url, options) => typeof url === 'string' && url.startsWith('assets/')
  ? new Response(await fs.readFile(path.join(root, url.split('?')[0])), { status: 200 }) : nativeFetch(url, options);

const expected = {
  morning: { 茶水摊: '早市/茶水摊', 木铃摊: '早市/木铃摊', 早餐摊: '早市/早餐摊' },
  noon: { 扇子摊: '午市/扇子铺', 杂货摊: '午市/杂货小铺', 香囊摊: '午市/香囊铺' },
  night: { 古董摊: '夜市/古董摊', 花灯摊: '夜市/花灯摊', 酿酒摊: '夜市/酿酒铺' },
};
const productFiles = (await fs.readdir(path.join(root, 'assets/商品'), { recursive: true }))
  .filter(p => p.endsWith('.glb')).map(p => `assets/商品/${p.replaceAll('\\', '/')}`).sort();
assert.equal(JSON.stringify(Object.values(PRODUCTS).map(p => p.model).sort()), JSON.stringify(productFiles));
for (const product of Object.values(PRODUCTS)) {
  await fs.access(path.join(root, product.thumbnail));
  const gltf = await globalThis.__marketTestLoad(product.model);
  assert.ok(!new THREE.Box3().setFromObject(gltf.scene).isEmpty(), product.id);
}
const results = [];
const cameraAudit = {};
try {
  const player = createPlayer();
  await player.load();
  const playerBounds = () => {
    player.object.updateMatrixWorld(true);
    player.object.traverse(n => { if (n.isSkinnedMesh) n.computeBoundingBox(); });
    return new THREE.Box3().setFromObject(player.object);
  };
  let box = playerBounds();
  assert.ok(Math.abs(box.getSize(new THREE.Vector3()).y - PLAYER_HEIGHT) < .001, 'player height');
  assert.ok(Math.abs(box.min.y) < .001, 'player grounded');
  const spawn = new THREE.Vector3(0, 1.3, 0);
  player.setMap({ sample: () => spawn.y, move: (from, x, z) => ({ x, y: from.y, z }) }, spawn);
  const hip = player.object.getObjectByName('Hip'), leg = player.object.getObjectByName('L_Thigh');
  const idleLeg = leg.quaternion.clone();
  let maxLegMotion = 0, maxOffset = 0;
  for (let i = 0; i < 600; i++) {
    player.update(1 / 60, { x: 0, y: 1 }, 0);
    assert.ok(Math.abs(hip.position.x) < .001 && Math.abs(hip.position.y) < .001, 'clip root motion removed');
    maxLegMotion = Math.max(maxLegMotion, leg.quaternion.angleTo(idleLeg));
    if (i % 10 === 0) {
      box = playerBounds();
      const center = box.getCenter(new THREE.Vector3());
      maxOffset = Math.max(maxOffset, Math.hypot(center.x - player.position.x, center.z - player.position.z));
      assert.ok(Math.abs(box.min.y - spawn.y) < .15, 'feet stay near ground throughout walk loops');
    }
  }
  assert.ok(maxLegMotion > .1, 'authored walk animates legs');
  assert.ok(maxOffset < .4, 'mesh stays with navigation across multiple walk loops');
  assert.ok(player.position.z > 20, 'player moves through navigation');
  // A held movement key against a wall must settle into idle, with no root drift.
  const stopped = player.position.clone();
  player.setMap({ sample: () => stopped.y, move: from => from }, stopped);
  for (let i = 0; i < 180; i++) player.update(1 / 60, { x: 0, y: 1 }, 0);
  assert.ok(player.position.distanceTo(stopped) < .001, 'blocked player stays still');
  for (let i = 0; i < 30; i++) player.update(1 / 60, { x: 0, y: 1 }, 0);
  const sourceIdle = (await globalThis.__marketTestLoad('assets/character.glb')).animations.find(clip => clip.name === 'wait.001');
  const idleTrack = sourceIdle.tracks.find(track => track.name === 'L_Thigh.quaternion');
  const expectedIdle = new THREE.Quaternion().fromArray(idleTrack.createInterpolant().evaluate(13.5 % sourceIdle.duration));
  assert.ok(leg.quaternion.angleTo(expectedIdle) < .001, 'blocked player returns to authored idle');
  for (const phase of Object.values(PHASES)) {
    assert.equal(JSON.stringify(phase.stalls.map(s => s.name).sort()), JSON.stringify(Object.keys(expected[phase.id]).sort()));
    for (const stall of phase.stalls) {
      const prefix = `assets/商品/${expected[phase.id][stall.name]}/`;
      assert.equal(JSON.stringify(stall.products.map(id => PRODUCTS[id].model).sort()), JSON.stringify(productFiles.filter(p => p.startsWith(prefix))));
      await fs.access(path.join(root, stall.npc));
    }
    const world = new THREE.Group(), market = await loadMarketMap(world, phase);
    assert.equal(market.entries.length, 3);
    world.updateMatrixWorld(true);
    const rawBuffer = await fs.readFile(path.join(root, `assets/markets/${phase.id}.glb`));
    const raw = JSON.parse(rawBuffer.toString('utf8', 20, 20 + rawBuffer.readUInt32LE(12)));
    cameraAudit[phase.id] = market.entries.map(entry => {
      const node = raw.nodes.find(n => n.name === entry.stall.rig);
      const original = node.matrix ? new THREE.Matrix4().fromArray(node.matrix) : new THREE.Matrix4().compose(
        new THREE.Vector3(...(node.translation ?? [0,0,0])), new THREE.Quaternion(...(node.rotation ?? [0,0,0,1])),
        new THREE.Vector3(...(node.scale ?? [1,1,1])));
      const offset = new THREE.Vector3().setFromSpherical(new THREE.Spherical(entry.cameraDistance, entry.cameraPitch,
        Math.atan2(entry.viewDirection.x, entry.viewDirection.z)));
      return { id: entry.stall.id, rig: entry.stall.rig, npc: entry.stall.npc, replaceNpc: entry.stall.replaceNpc ?? false,
        matrix: entry.keeper.matrixWorld.elements, original: original.elements,
        camera: entry.focusTarget.clone().add(offset).toArray(), target: entry.focusTarget.toArray(), score: entry.cameraClearanceScore };
    });
    const staticMeshes = [];
    world.traverse(n => { if (n.isMesh && !n.isSkinnedMesh && n.geometry.type !== 'RingGeometry') staticMeshes.push(n); });
    for (const entry of market.entries) {
      const ray = new THREE.Raycaster();
      for (const aspect of [1.5, .6]) {
        const rig = createCameraRig(); rig.focusOn(entry);
        for (let i = 0; i < 90; i++) rig.update(1 / 60, { position: market.spawn }, aspect);
        const blocked = entry.sightTargets.filter(point => {
          const direction = point.clone().sub(rig.camera.position);
          ray.far = direction.length() - .12; ray.set(rig.camera.position, direction.normalize());
          return ray.intersectObjects(staticMeshes, false).length;
        });
        assert.equal(blocked.length, 0, `${phase.id}/${entry.stall.id}, aspect ${aspect}: blocked keeper`);
        market.updateOcclusion(rig.camera, entry.focusTarget, .2, entry);
      }
      const bones = new Map(); entry.keeper.traverse(b => { if (b.isBone) bones.set(b.userData.name ?? b.name, b); });
      const hands = ['L_Hand', 'R_Hand'].map(name => bones.get(name));
      assert.ok(hands.every(Boolean), `${entry.stall.id}: independent skeleton`);
      const head = bones.get('Head');
      market.focus(entry.stall.id);
      market.update(3);
      world.updateMatrixWorld(true);
      const before = hands.map(hand => hand.getWorldPosition(new THREE.Vector3()));
      const headBefore = head.quaternion.clone();
      market.greet(entry.stall.id);
      let maxNod = 0;
      for (let i = 0; i < 180; i++) {
        market.update(1 / 60);
        world.updateMatrixWorld(true);
        hands.forEach((hand, index) => assert.ok(before[index].distanceTo(hand.getWorldPosition(new THREE.Vector3())) < .005,
          `${entry.stall.id}: greeting keeps hands still`));
        maxNod = Math.max(maxNod, head.quaternion.angleTo(headBefore));
      }
      assert.ok(maxNod > .04 && maxNod < .08, `${entry.stall.id}: restrained nod`);
      assert.ok(head.quaternion.angleTo(headBefore) < .001, `${entry.stall.id}: nod returns to rest`);
      market.focus(null);
    }
    for (let i = 0; i < 600; i++) market.update(1 / 60);
    world.updateMatrixWorld(true);
    world.traverse(n => assert.ok(n.matrixWorld.elements.every(Number.isFinite), n.name));
    results.push({ phase: phase.id, stalls: 3, desktopAndPortraitSightlines: 'pass', skeletonAnimation: 'pass' });
  }
  await fs.writeFile(path.join(root, '.preview-check/verification.json'), JSON.stringify({ products: productFiles.length, results }, null, 2));
  await fs.writeFile(path.join(root, '.preview-check/cameras.json'), JSON.stringify(cameraAudit, null, 2));
  console.log(JSON.stringify({ player: { height: PLAYER_HEIGHT, maxLegMotion, maxOffset, movementAndIdle: 'pass' }, products: productFiles.length, results }, null, 2));
} finally {
  globalThis.fetch = nativeFetch;
  delete globalThis.__marketTestLoad;
}
