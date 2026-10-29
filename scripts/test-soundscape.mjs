import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSoundscape } from '../js/core/soundscape.js';
import { AMBIENCES } from '../js/data/soundscape.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness({ delayed = false } = {}) {
  let allowed = true;
  const sources = [], requests = [], pending = new Map();
  const context = {
    currentTime: 0,
    createGain: () => ({ gain: { value: 0, cancelScheduledValues() {}, setTargetAtTime(v) { this.value = v; } }, connect() {}, disconnect() {} }),
    createBufferSource() {
      const source = { connect() {}, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; this.onended?.(); } };
      sources.push(source); return source;
    },
    async decodeAudioData(file) { return { file, duration: 48 }; },
  };
  const engine = createSoundscape({ context, ambienceOutput: {}, canPlay: () => allowed,
    fetchAsset: async url => {
      const file = String(url); requests.push(file);
      if (delayed) await new Promise(resolve => pending.set(file, resolve));
      return { ok: true, arrayBuffer: async () => file };
    },
  });
  return { engine, context, sources, requests, pending, allow: value => { allowed = value; } };
}
test('switching phase replaces its ambience without accumulating loops', async () => {
  const h = harness(); h.engine.resume(); await flush(); h.engine.resume(); await flush();
  assert.equal(h.sources.length, 1); assert.equal(h.sources[0].loopEnd, 48);
  h.engine.setPhase('noon'); await flush();
  assert.equal(h.sources[0].stopped, true); assert.match(h.sources[1].buffer.file, /noon-field.mp3$/);
  h.engine.setPhase('night'); await flush();
  assert.equal(h.sources.filter(s => !s.stopped).length, 1); assert.match(h.sources.at(-1).buffer.file, /night-field.mp3$/);
  assert.ok(h.requests.every(file => !file.includes('/voices/')), 'NPC speech is never fetched');
});
test('late scene downloads cannot restore a previous time of day', async () => {
  const h = harness({ delayed: true }); h.engine.resume(); h.engine.setPhase('night');
  for (const resolve of h.pending.values()) resolve(); await flush();
  assert.equal(h.sources.length, 1); assert.match(h.sources[0].buffer.file, /night-field.mp3$/);
});
test('all three ambience files are compact local MP3 field recordings', async () => {
  for (const [id, entry] of Object.entries(AMBIENCES)) {
    const mp3 = await readFile(new URL(`../${entry.file}`, import.meta.url));
    assert.match(entry.file, /-field\.mp3$/);
    assert.equal(mp3.toString('ascii', 0, 3), 'ID3');
    assert.ok(mp3.length > 100000 && mp3.length < 750000, `${id}: lightweight recording`);
    assert.equal(entry.duration, 48);
  }
  const credits = await readFile(new URL('../assets/audio/ambience/SOURCES.md', import.meta.url), 'utf8');
  assert.equal((credits.match(/https:\/\/freesound.org\/people\//g) ?? []).length, 3);
  assert.match(credits, /CC0/);
});
