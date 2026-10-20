import * as THREE from 'three';
import { getPhase, phaseFromQuery } from '../data/phases.js';
import { assetUrl } from '../data/products.js';
import { mountCart, showToast } from '../cart/ui.js';
import { addToCart } from '../cart/store.js';
import { buildArchitecture } from './architecture.js';
import { buildDecor } from './decor.js';
import { buildStreetDetails } from './details.js';
import { createStalls, pickStall, updateStalls } from './stalls.js';
import { createPlayer } from './player.js';
import { createCameraRig } from './camera-rig.js';
import { createPanel } from './panel.js';

const phase = getPhase(phaseFromQuery());
document.body.dataset.phase = phase.id;
document.getElementById('marketTitle').textContent = `${phase.name} · ${phase.hourLabel}`;
document.title = `${phase.name} · 义犹未尽`;
mountCart();
const stage = document.getElementById('marketStage');
const loading = document.getElementById('marketLoading');
const visit = document.getElementById('visitStall');
const keys = new Set();
const touchKeys = new Set();
let entries = [], nearest = null, hovered = null, selected = null, ready = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(phase.palette.sky);
scene.fog = new THREE.Fog(phase.palette.fog, 25, 65);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = phase.id === 'night' ? 1.15 : 1.05;
stage.appendChild(renderer.domElement);
const world = new THREE.Group(); scene.add(world);
buildArchitecture(world);
buildStreetDetails(world, phase);
const decor = buildDecor(world, phase.stalls); decor.applyPhase(phase.id);
const night = phase.id === 'night';
scene.add(new THREE.HemisphereLight(night ? '#9cacd1' : '#fff1dc', '#8c7960', night ? 1.15 : 1.9));
const sun = new THREE.DirectionalLight(night ? '#b7c8ec' : '#fff0d3', night ? 1.6 : 2.6);
sun.position.set(-8, 18, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 60 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.035;
scene.add(sun);
const fill = new THREE.DirectionalLight('#b4c6d3', 0.65); fill.position.set(10, 7, -12); scene.add(fill);
const player = createPlayer(); player.setPhaseMood(phase.id); scene.add(player.object);
const rig = createCameraRig();
const panel = createPanel({
  onAdd(product) { addToCart(product.id); showToast('已放入市集篮'); },
  onOpen(product) { if (product) location.href = assetUrl(product.href); else leaveStall(); },
});
function leaveStall() {
  selected = null; panel.hide(); rig.release(); keys.clear(); touchKeys.clear();
  document.body.classList.remove('is-focused');
  visit.focus({ preventScroll: true });
}
function nearby(entry) {
  return Math.hypot(player.position.x - entry.position.x, player.position.z - entry.position.z) <= 6.3;
}
function enterStall(entry) {
  if (!ready || !entry || !nearby(entry) || rig.isTransitioning) return;
  selected = entry; keys.clear(); touchKeys.clear(); rig.focusOn(entry);
  panel.show(entry.stall); visit.hidden = true;
  document.body.classList.add('is-focused');
}
visit.addEventListener('click', () => enterStall(nearest));
const movement = { w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right' };
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { if (selected) leaveStall(); return; }
  if (event.target.closest('input,textarea,[contenteditable=true]') || document.querySelector('.cart-drawer.is-open')) return;
  const direction = movement[event.key.toLowerCase()];
  if (direction) { event.preventDefault(); keys.add(direction); }
  if (event.key.toLowerCase() === 'e') enterStall(nearest);
});
window.addEventListener('keyup', (event) => keys.delete(movement[event.key.toLowerCase()]));
window.addEventListener('blur', () => { keys.clear(); touchKeys.clear(); });
document.querySelectorAll('[data-move]').forEach((button) => {
  button.addEventListener('pointerdown', (event) => {
    button.setPointerCapture(event.pointerId); touchKeys.add(button.dataset.move); event.preventDefault();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => touchKeys.delete(button.dataset.move));
});
function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  return pickStall(entries.filter(nearby), rig.camera, { x: event.clientX - rect.left, y: event.clientY - rect.top }, rect);
}
renderer.domElement.addEventListener('pointermove', (event) => {
  hovered = selected ? null : pick(event);
  renderer.domElement.style.cursor = hovered ? 'pointer' : 'default';
});
renderer.domElement.addEventListener('pointerleave', () => { hovered = null; });
renderer.domElement.addEventListener('click', (event) => { if (!selected) enterStall(pick(event)); });
function resize() { renderer.setSize(stage.clientWidth, stage.clientHeight); }
window.addEventListener('resize', resize); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  const blocked = !ready || selected || rig.isTransitioning || document.querySelector('.cart-drawer.is-open');
  const pressed = (direction) => !blocked && (keys.has(direction) || touchKeys.has(direction)) ? 1 : 0;
  player.update(delta, { x: pressed('right') - pressed('left'), y: pressed('up') - pressed('down') }, rig.getYaw());
  rig.update(delta, player, stage.clientWidth / stage.clientHeight);
  nearest = entries.filter(nearby).sort((a, b) => player.position.distanceToSquared(a.anchor) - player.position.distanceToSquared(b.anchor))[0] ?? null;
  visit.hidden = !ready || Boolean(selected) || rig.isTransitioning || !nearest;
  if (nearest) visit.textContent = `逛逛${nearest.stall.name} · E`;
  updateStalls(entries, delta, (selected ?? hovered ?? nearest)?.stall.id);
  decor.sway(clock.elapsedTime);
  renderer.render(scene, rig.camera);
});
try {
  entries = await createStalls(world, phase);
  ready = true; loading.classList.add('is-done');
} catch (error) {
  console.error('市集模型加载失败', error);
  loading.querySelector('p').textContent = '摊位加载失败，请重试';
  const retry = document.createElement('button'); retry.textContent = '重新入市'; retry.onclick = () => location.reload(); loading.appendChild(retry);
}
