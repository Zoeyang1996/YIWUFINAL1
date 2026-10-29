// Behavioral tests for audio lifecycle; Web Audio and DOM are narrow test doubles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

class Events {
  listeners = new Map();
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  fire(name, event = {}) { for (const fn of this.listeners.get(name) || []) fn(event); }
}
class Element extends Events {
  attrs = {}; dataset = {}; children = []; value = ''; textContent = '';
  setAttribute(k, v) { this.attrs[k] = v; }
  append(el) { this.children.push(el); }
  closest() { return null; }
  matches() { return false; }
  contains(el) { return this === el || this.children.includes(el); }
  focus() {}
  querySelector(selector) { return this.nodes[selector]; }
  querySelectorAll() { return this.inputs; }
  set innerHTML(value) {
    this.nodes = Object.fromEntries(['.sound-toggle','.sound-status','details'].map(key => [key, new Element()]));
    this.inputs = ['music', 'effects', 'ambience'].map(channel => { const e = new Element(); e.dataset.channel = channel; return e; });
    this.children = [...Object.values(this.nodes), ...this.inputs];
  }
}
const flush = () => new Promise(resolve => setImmediate(resolve));
let revision = 0;
async function setup({ stored, fail = false } = {}) {
  let now = 1000, requests = 0;
  const contexts = [], storage = new Map(stored ? [['yiwu-sound-v1', JSON.stringify(stored)]] : []);
  const sources = [], oscillators = [], gains = [];
  const param = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() {}, start(...args) { this.startArgs = args; }, stop() { this.stopped = true; this.onended?.(); } });
  class Context extends Events {
    state = 'suspended'; currentTime = 0; sampleRate = 24000; destination = {};
    constructor() { super(); contexts.push(this); }
    async resume() { this.state = 'running'; this.fire('statechange'); }
    async suspend() { this.state = 'suspended'; this.fire('statechange'); }
    createGain() { const n = { ...node(), gain: param() }; gains.push(n); return n; }
    createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param() }; }
    createOscillator() { const n = { ...node(), frequency: param() }; oscillators.push(n); return n; }
    createBiquadFilter() { return { ...node(), frequency: param() }; }
    createBufferSource() { const n = node(); sources.push(n); return n; }
    createBuffer(ch, size) { return { getChannelData: () => new Float32Array(size) }; }
    async decodeAudioData(data) { return { duration: data.file?.includes('/voices/') ? 2 : data.file?.includes('/ambience/') ? 48 : 96, file: data.file }; }
  }
  const document = new Events(); document.hidden = false;
  document.body = new Element(); document.body.classList = { contains: name => name === 'market' };
  document.createElement = () => new Element();
  globalThis.document = document; globalThis.window = new Events(); globalThis.AudioContext = Context;
  globalThis.localStorage = { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v) };
  globalThis.sessionStorage = { getItem: () => '12.5', setItem() {} };
  globalThis.performance = { now: () => now };
  globalThis.fetch = async url => { requests++; return { ok: !fail, status: fail ? 404 : 200, arrayBuffer: async () => { const data = new ArrayBuffer(1); data.file = String(url); return data; } }; };
  const { sound } = await import(`../js/core/audio.js?test=${revision++}`);
  sound.mount();
  const root = document.body.children[0], target = new Element();
  return { sound, root, contexts, sources, oscillators, gains, storage, document, target,
    requests: () => requests, advance: ms => { now += ms; },
    gesture: async () => { document.fire('pointerdown', { target }); await flush(); },
    key: (key, extra = {}) => document.fire('keydown', { target, key, ...extra }),
  };
}

test('audio waits for interaction and creates one looping music source', async () => {
  const h = await setup();
  assert.equal(h.contexts.length, 0);
  await h.gesture(); await h.gesture();
  assert.equal(h.contexts.length, 1); assert.equal(h.requests(), 2);
  const loops = h.sources.filter(source => source.loop && source.buffer.file.endsWith('market-stroll.wav'));
  assert.equal(h.sources.filter(source => source.loop && source.buffer.file.includes('/ambience/')).length, 1);
  assert.equal(loops.length, 1); assert.equal(loops[0].loopEnd, 96);
  assert.equal(loops[0].startArgs[1], 12.5, 'resume the saved musical position');
  const fullVolume = h.gains[1].gain.value;
  h.sound.setFocus(true); assert.ok(h.gains[1].gain.value < fullVolume);
  h.sound.setFocus(false); assert.equal(h.gains[1].gain.value, fullVolume);
});
test('key repeat, text entry and system shortcuts do not stack feedback', async () => {
  const h = await setup(); await h.gesture();
  h.key('w'); const count = h.oscillators.length; assert.ok(count > 0);
  h.advance(100); h.key('w', { repeat: true }); h.key('s', { ctrlKey: true });
  h.key('x', { target: { closest: () => ({}) } });
  assert.equal(h.oscillators.length, count);
  h.advance(100); h.key('a'); assert.ok(h.oscillators.length > count);
});
test('footsteps require actual travel and do not fire when blocked', async () => {
  const h = await setup(); await h.gesture();
  for (let i=0;i<100;i++) h.sound.walk(0);
  assert.equal(h.oscillators.length, 0);
  h.sound.walk(.4); h.sound.walk(.4); assert.equal(h.oscillators.length, 1);
  h.advance(300); h.sound.walk(0); h.sound.walk(.4);
  assert.equal(h.oscillators.length, 1);
});
test('mute persists, suppresses all audio, and can be explicitly re-enabled', async () => {
  const h = await setup({ stored: { muted: true, music: .2, effects: .5 } });
  await h.gesture(); h.sound.play('success'); assert.equal(h.contexts.length, 0);
  h.root.nodes['.sound-toggle'].fire('click'); await flush();
  assert.equal(h.contexts[0].state, 'running');
  h.root.nodes['.sound-toggle'].fire('click'); await flush();
  assert.equal(h.contexts[0].state, 'suspended');
  const count = h.oscillators.length; h.advance(1000); h.sound.play('enter'); await h.gesture();
  assert.equal(h.oscillators.length, count);
  assert.equal(JSON.parse(h.storage.get('yiwu-sound-v1')).muted, true);
});
test('hidden pages suspend and resume without duplicating music', async () => {
  const h = await setup(); await h.gesture();
  h.document.hidden = true; h.document.fire('visibilitychange'); await flush();
  assert.equal(h.contexts[0].state, 'suspended'); h.sound.play('success');
  assert.equal(h.oscillators.length, 0);
  h.document.hidden = false; h.document.fire('visibilitychange'); await flush();
  assert.equal(h.contexts[0].state, 'running'); assert.equal(h.sources.filter(s => s.loop).length, 2);
});
test('music fetch failure preserves effects and does not retry on every key', async () => {
  const h = await setup({ fail: true }); await h.gesture(); await h.gesture();
  assert.equal(h.requests(), 2); h.sound.play('success'); assert.ok(h.oscillators.length > 0);
  assert.match(h.root.nodes['.sound-status'].textContent, /暂未载入/);
});
test('original PCM loop has correct duration, headroom, stereo and a clean seam', async () => {
  const wav = await readFile(new URL('../assets/audio/market-stroll.wav', import.meta.url));
  assert.equal(wav.toString('ascii',0,4),'RIFF'); assert.equal(wav.readUInt16LE(22),2);
  const rate = wav.readUInt32LE(24), bytes = wav.readUInt32LE(40);
  assert.equal(bytes / (rate * 4), 96);
  let peak = 0, energy = 0;
  for(let i=44;i<wav.length;i+=2) { const x = wav.readInt16LE(i) / 32768; peak=Math.max(peak,Math.abs(x)); energy+=x*x; }
  assert.ok(peak < .7 && peak > .5); assert.ok(Math.sqrt(energy / (bytes/2)) > .05);
  for (const i of [44,46,wav.length-4,wav.length-2]) assert.equal(wav.readInt16LE(i),0);
});

