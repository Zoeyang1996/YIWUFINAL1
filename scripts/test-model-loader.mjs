import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const source = (await fs.readFile(new URL('../js/core/loader.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '');
let revision = 0;
async function setup(baseURI, manifest, failOnce = false) {
  const calls = [];
  class GLTFLoader {
    setMeshoptDecoder() { return this; }
    async loadAsync(url) { calls.push(['raw', url]); return 'raw'; }
    async parseAsync(buffer, base) { calls.push(['parsed', base]); return buffer; }
  }
  globalThis.__loaderFixture = {
    GLTFLoader, MeshoptDecoder: {}, THREE: {}, MODEL_ASSETS: manifest,
    async downloadModel(entry, base) {
      calls.push(['packed', new URL(entry.parts[0], base).href]);
      if (failOnce) { failOnce = false; throw new Error('temporary failure'); }
      return 'decoded';
    },
  };
  globalThis.document = { baseURI };
  const module = await import(`data:text/javascript,${encodeURIComponent(
    'const { GLTFLoader, MeshoptDecoder, THREE, MODEL_ASSETS, downloadModel } = globalThis.__loaderFixture;\n'
    + source + `\n// fixture ${++revision}`)}`);
  return { ...module, calls };
}
test.after(() => { delete globalThis.__loaderFixture; delete globalThis.document; });
const manifest = { '资产包/首页/早/zao.glb': { bytes: 1, parts: ['assets/packed/test.bin'] } };
for (const prefix of ['/', '/yiwu/', '/%E4%B9%89%E4%B9%8C/']) {
  test(`packed models work at ${prefix} with encoded paths and revision queries`, async () => {
    const { loadGltf, calls } = await setup(`https://example.test${prefix}index.html`, manifest);
    const url = encodeURI('资产包/首页/早/zao.glb') + '?v=test';
    assert.deepEqual(await Promise.all([loadGltf(url), loadGltf(url)]), ['decoded', 'decoded']);
    assert.deepEqual(calls, [
      ['packed', `https://example.test${prefix}assets/packed/test.bin`],
      ['parsed', `https://example.test${prefix}${encodeURI('资产包/首页/早/')}`],
    ]);
  });
}
test('raw local assets and unrelated external origins bypass the manifest', async () => {
  const { loadGltf, calls } = await setup('https://example.test/yiwu/index.html', manifest);
  await loadGltf('assets/character.glb');
  await loadGltf('https://other.test/yiwu/资产包/首页/早/zao.glb');
  assert.ok(calls.every(call => call[0] === 'raw'));
});
test('a failed download is evicted so a retry can succeed', async () => {
  const { loadGltf, calls } = await setup('https://example.test/index.html', manifest, true);
  const url = '资产包/首页/早/zao.glb';
  await assert.rejects(loadGltf(url), /temporary failure/);
  assert.equal(await loadGltf(url), 'decoded');
  assert.equal(calls.filter(call => call[0] === 'packed').length, 2);
});
