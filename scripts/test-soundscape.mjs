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
  assert.equal(h.sources[0].stopped, true); assert.match(h.sources[1].buffer.file, /noon.wav$/);
  h.engine.setPhase('night'); await flush();
  assert.equal(h.sources.filter(s => !s.stopped).length, 1); assert.match(h.sources.at(-1).buffer.file, /night.wav$/);
});
test('late scene downloads cannot restore a previous time of day', async () => {
  const h = harness({ delayed: true }); h.engine.resume(); h.engine.setPhase('night');
  for (const resolve of h.pending.values()) resolve(); await flush();
  assert.equal(h.sources.length, 1); assert.match(h.sources[0].buffer.file, /night.wav$/);
});
test('all three ambience files retain their distinct loudness and clean loops', async () => {
  const rms = {};
  for (const [id, entry] of Object.entries(AMBIENCES)) {
    const wav = await readFile(new URL(`../${entry.file}`, import.meta.url));
    assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
    const channels = wav.readUInt16LE(22), rate = wav.readUInt32LE(24), bytes = wav.readUInt32LE(40);
    const duration = bytes / (channels * rate * 2);
    assert.ok(Math.abs(duration - entry.duration) < .002, id);
    assert.ok(duration === 48 && channels === 2);
    let energy=0, peak=0;
    for (let i=44;i<wav.length;i+=2) { const x=wav.readInt16LE(i)/32768; energy+=x*x; peak=Math.max(peak,Math.abs(x)); }
    assert.ok(peak > .01 && peak < .85, `${id}: audible, not clipped`);
    rms[id] = Math.sqrt(energy / (bytes/2));
    for (let channel=0;channel<channels;channel++) {
      assert.equal(wav.readInt16LE(44+channel*2), 0);
      assert.equal(wav.readInt16LE(wav.length-channels*2+channel*2), 0);
    }
  }
  assert.ok(rms.noon > rms.morning * 1.3, 'noon is livelier');
  assert.ok(rms.night < rms.morning * .5, 'night is substantially quieter');
});
