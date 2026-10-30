import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import validator from 'gltf-validator';

const root = path.resolve(import.meta.dirname, '../..');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const report = JSON.parse(await fs.readFile(path.join(root, 'assets/optimization-report.json'), 'utf8'));
const results = [];
for (const entry of report) {
  const doc = await io.read(path.join(root, entry.file));
  // Khronos validator cannot inspect meshopt streams itself; validate the decoded geometry.
  doc.getRoot().listExtensionsUsed().find(e => e.extensionName === 'EXT_meshopt_compression')?.dispose();
  const result = await validator.validateBytes(await io.writeBinary(doc), { maxIssues: 10000 });
  const errors = result.issues.messages.filter(m => m.severity === 0);
  const warningCodes = {};
  for (const message of result.issues.messages.filter(m => m.severity === 1)) warningCodes[message.code] = (warningCodes[message.code] ?? 0) + 1;
  results.push({ file: entry.file, errors, warnings: result.issues.numWarnings, warningCodes, truncated: result.issues.truncated });
  console.log(`${entry.file}: ${errors.length} errors, ${result.issues.numWarnings} warnings`);
}
await fs.mkdir(path.join(root, '.preview-check'), { recursive: true });
await fs.writeFile(path.join(root, '.preview-check/gltf-validation.json'), JSON.stringify(results, null, 2));
assert.ok(results.every(r => !r.errors.length && !r.truncated), 'GLB validation failed; see .preview-check/gltf-validation.json');
