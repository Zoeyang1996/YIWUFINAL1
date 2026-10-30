// npm ci --prefix scripts/asset-tools
// node scripts/asset-tools/optimize.mjs --source /path/to/original-project --output /path/to/output
// Outputs a separate asset tree. Never overwrites the source or re-compresses in place.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { NodeIO, PropertyType } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, weld, simplifyPrimitive, reorder, quantize, prune, compressTexture, listTextureInfo, listTextureInfoByMaterial } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const { values } = parseArgs({ options: { source: { type: 'string' }, output: { type: 'string' } } });
if (!values.source || !values.output) throw new Error('Pass --source and --output (different directories).');
const source = path.resolve(values.source), output = path.resolve(values.output);
assert.notEqual(source, output, 'Keep original source assets intact.');
const jobs = [
  ...['morning', 'noon', 'night'].map(id => ({ file: `assets/markets/${id}.glb`, ratio: .5, error: .001, textureSize: 1024 })),
  { file: 'assets/character.glb', ratio: .75, error: .0005, textureSize: 1024 },
  ...['早/zao', '午/noon', '夜/evening'].map(id => ({ file: `资产包/首页/${id}.glb`, ratio: 1, error: 0, textureSize: 1024 })),
];
await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder,
});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function structure(doc) {
  const root = doc.getRoot(), nodes = root.listNodes();
  return {
    nodes: nodes.map(n => ({ name: n.getName(), extras: n.getExtras(), matrix: n.getMatrix(),
      children: n.listChildren().map(child => nodes.indexOf(child)), skin: n.getSkin()?.getName() ?? null })),
    skins: root.listSkins().map(s => ({ name: s.getName(), joints: s.listJoints().map(n => nodes.indexOf(n)) })),
    animations: root.listAnimations().map(a => ({ name: a.getName(),
      channels: a.listChannels().map(c => ({ node: nodes.indexOf(c.getTargetNode()), path: c.getTargetPath(),
        interpolation: c.getSampler().getInterpolation(),
        input: sha256(Buffer.from(c.getSampler().getInput().getArray().buffer)),
        output: sha256(Buffer.from(c.getSampler().getOutput().getArray().buffer)) })) })),
  };
}
function stats(doc, bytes) {
  const root = doc.getRoot();
  let triangles = 0, vertices = 0;
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    if (p.getMode() === 4) triangles += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
    vertices += p.getAttribute('POSITION')?.getCount() ?? 0;
  }
  return { bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length, triangles, vertices,
    texturePixels: root.listTextures().reduce((sum, t) => { const s = t.getSize(); return sum + (s ? s[0] * s[1] : 0); }, 0),
    textures: root.listTextures().length, nodes: root.listNodes().length, skins: root.listSkins().length,
    animations: root.listAnimations().map(a => a.getName()) };
}
const report = [];
for (const job of jobs) {
  const original = await fs.readFile(path.join(source, job.file));
  const doc = await io.readBinary(original);
  assert.ok(!doc.getRoot().listExtensionsRequired().some(e => e.extensionName === 'EXT_meshopt_compression'),
    `${job.file}: supply original assets, not an already optimized copy`);
  const before = stats(doc, original), contract = structure(doc);
  // Blender exports include empty alternate lighting scenes and invalid UV index -1.
  // Three r160 already treats negative texCoord as UV0; make that behavior explicit.
  for (const texture of doc.getRoot().listTextures()) for (const info of listTextureInfo(texture)) {
    if (info.getTexCoord() < 0) info.setTexCoord(0);
  }
  for (const scene of doc.getRoot().listScenes()) {
    if (scene !== doc.getRoot().getDefaultScene() && !scene.listChildren().length) scene.dispose();
  }
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    if (!p.getMaterial()) continue;
    for (const info of listTextureInfoByMaterial(p.getMaterial())) {
      const semantic = `TEXCOORD_${info.getTexCoord()}`;
      if (p.getAttribute(semantic)) continue;
      // Explicitly preserve WebGL's default (0,0) UV for the export's unwrapped surfaces.
      p.setAttribute(semantic, doc.createAccessor('Default UV')
        .setType('VEC2').setArray(new Float32Array(p.getAttribute('POSITION').getCount() * 2))
        .setBuffer(doc.getRoot().listBuffers()[0]));
    }
  }
  await doc.transform(dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.TEXTURE] }), weld());
  if (job.ratio < 1) for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    // Leave small architectural details and material boundaries intact.
    if (p.getMode() !== 4 || p.getIndices().getCount() < 1500) continue;
    simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: job.ratio, error: job.error, lockBorder: true });
  }
  for (const texture of doc.getRoot().listTextures()) {
    const size = texture.getSize();
    // fitWithin() may upscale small images. Only resize textures exceeding our budget.
    await compressTexture(texture, { encoder: sharp, targetFormat: 'webp', quality: 88, effort: 80,
      ...(Math.max(...size) > job.textureSize ? { resize: [job.textureSize, job.textureSize] } : {}) });
  }
  doc.createExtension(EXTTextureWebP).setRequired(true);
  await doc.transform(
    reorder({ encoder: MeshoptEncoder, target: 'performance' }),
    // Keep positions, skin weights, transforms and animation samples at their authored precision.
    quantize({ pattern: /^(NORMAL|TANGENT|TEXCOORD|COLOR)(_|$)/, quantizeNormal: 12, quantizeTexcoord: 14, quantizeColor: 12 }),
    prune({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.BUFFER], keepAttributes: true }),
  );
  assert.deepEqual(structure(doc), contract, `${job.file}: scene / animation contract changed`);
  // 4.5.1 only detects quantized POSITION when adding this extension automatically.
  // Our NORMAL/TANGENT attributes also require it, while POSITION remains float32.
  doc.createExtension(KHRMeshQuantization).setRequired(true);
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const bytes = await io.writeBinary(doc);
  const restored = await io.readBinary(bytes);
  // Writer may normalize matrix representation; round-trip hierarchy and animation are checked by the runtime tests too.
  const after = stats(restored, bytes);
  assert.equal(after.nodes, before.nodes);
  assert.equal(after.skins, before.skins);
  assert.deepEqual(after.animations, before.animations);
  assert.ok(bytes.length < original.length, `${job.file}: optimization increased size`);
  const destination = path.join(output, job.file);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);
  report.push({ file: job.file, settings: job, sourceSha256: sha256(original), outputSha256: sha256(bytes), before, after });
  console.log(`${job.file}: ${(before.bytes / 1048576).toFixed(2)} → ${(after.bytes / 1048576).toFixed(2)} MiB; ${before.triangles} → ${after.triangles} triangles`);
}
await fs.writeFile(path.join(output, 'optimization-report.json'), JSON.stringify(report, null, 2) + '\n');
