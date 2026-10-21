import test from 'node:test';
import assert from 'node:assert/strict';
import { bindCameraInput } from '../js/market/camera-input.js';

test('orbit, pinch and cancellation do not trigger shop taps; deliberate clicks still work', () => {
  globalThis.window = new EventTarget();
  const canvas = new EventTarget(), captured = new Set();
  canvas.style = {}; canvas.clientHeight = 960;
  canvas.setPointerCapture = (id) => captured.add(id);
  canvas.hasPointerCapture = (id) => captured.has(id);
  canvas.releasePointerCapture = (id) => captured.delete(id);
  const rotations = [], zooms = []; let taps = 0, enabled = true;
  bindCameraInput(canvas, { rotate: (...args) => rotations.push(args), zoom: (delta) => zooms.push(delta) },
    { enabled: () => enabled, onTap: () => taps++ });
  const send = (type, values = {}) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, button: 0, clientX: 100, clientY: 100, ...values });
    canvas.dispatchEvent(event);
  };
  send('pointerdown'); send('pointermove', {clientX: 140}); send('pointerup', {clientX: 140});
  assert.equal(taps, 0); assert.equal(rotations.length, 1);
  send('pointerdown'); send('pointerup'); assert.equal(taps, 1);
  send('pointerdown'); send('pointercancel'); send('pointerup'); assert.equal(taps, 1);
  send('pointerdown'); send('pointerdown', {pointerId: 2, clientX: 200});
  send('pointermove', {pointerId: 2, clientX: 250});
  send('pointerup', {pointerId: 2, clientX: 250}); send('pointerup');
  assert.equal(taps, 1); assert.ok(zooms[0] < 0, 'spreading fingers zooms in');
  send('pointerdown'); window.dispatchEvent(new Event('blur')); send('pointerup'); assert.equal(taps, 1);
  enabled = false; send('pointerdown'); send('pointerup'); assert.equal(taps, 1);
  assert.equal(captured.size, 0);
  delete globalThis.window;
});
