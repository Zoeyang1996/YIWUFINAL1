import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { PHASES } from '../js/data/phases.js';
import { PRODUCTS } from '../js/data/products.js';
import { PLAYER_MODEL } from '../js/data/player.js';
import { AMBIENCES } from '../js/data/soundscape.js';
import { downloadModel } from '../js/core/model-download.js';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = path.resolve(root, 'sites/yiwu-three-markets/dist');
if (path.relative(root, output) !== path.join('sites', 'yiwu-three-markets', 'dist')) throw new Error('Unsafe output path');
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
for (const name of ['index.html', 'market.html', 'shop.html', 'checkout.html', 'favicon.svg', 'css', 'js', 'vendor']) {
  await fs.cp(path.join(root, name), path.join(output, name), { recursive: true });
}
const models = new Set([PLAYER_MODEL]);
const files = new Set(['assets/markets/morning-metadata.json', 'assets/audio/market-stroll.wav']);
for (const audio of Object.values(AMBIENCES)) files.add(audio.file);
for (const phase of Object.values(PHASES)) {
  models.add(phase.overviewModel.split('?')[0]);
  models.add(`assets/markets/${phase.id}.glb`);
  files.add(`assets/markets/${phase.id}.json`);
  for (const stall of phase.stalls) if (stall.replaceNpc) models.add(stall.npc);
}
for (const product of Object.values(PRODUCTS)) {
  models.add(product.model);
  files.add(product.thumbnail);
}
for (const name of files) {
  const dest = path.join(output, name);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(path.join(root, name), dest);
}
const manifest = {};
let originalBytes = 0, compressedBytes = 0;
for (const name of models) {
  const original = await fs.readFile(path.join(root, name));
  const compressed = gzipSync(original, { level: 9 });
  if (!gunzipSync(compressed).equals(original)) throw new Error(`Compression mismatch: ${name}`);
  const digest = createHash('sha256').update(compressed).digest('hex').slice(0, 20);
  const parts = [];
  const chunkSize = 20 * 1024 * 1024;
  for (let offset = 0; offset < compressed.length; offset += chunkSize) {
    const part = `assets/packed/${digest}-${parts.length}.bin`;
    await fs.mkdir(path.dirname(path.join(output, part)), { recursive: true });
    await fs.writeFile(path.join(output, part), compressed.subarray(offset, offset + chunkSize));
    parts.push(part);
  }
  const entry = { bytes: original.length, parts };
  // Exercise the actual browser download/decompression code against the artifact.
  const restored = await downloadModel(entry, 'https://test.invalid/', async url => {
    return new Response(await fs.readFile(path.join(output, url.pathname)));
  });
  if (!Buffer.from(restored).equals(original)) throw new Error(`Download mismatch: ${name}`);
  manifest[name] = entry;
  originalBytes += original.length;
  compressedBytes += compressed.length;
  console.log(`${name}: ${(original.length / 1e6).toFixed(1)} MB → ${(compressed.length / 1e6).toFixed(1)} MB`);
}
await fs.writeFile(path.join(output, 'js/data/asset-manifest.js'), `export const MODEL_ASSETS = ${JSON.stringify(manifest, null, 2)};\n`);
await fs.writeFile(path.join(output, '_headers'), '/assets/packed/*\n  Cache-Control: public, max-age=31536000, immutable\n');
await fs.writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nAllow: /\n');
console.log(JSON.stringify({ output, models: models.size, originalBytes, compressedBytes, verified: true }));
