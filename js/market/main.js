import * as THREE from 'three';
import { getPhase, phaseFromQuery } from '../data/phases.js';
import { assetUrl } from '../data/products.js';
import { withShare } from '../core/nav.js';
import { mountCart, showToast } from '../cart/ui.js';
import { addToCart } from '../cart/store.js';
import { loadMarketMap } from './map.js';
import { pickStall, updateStalls } from './stalls.js';
import { createPlayer } from './player.js';
import { createCameraRig } from './camera-rig.js';
import { createPanel } from './panel.js';
import { createAuthoredLighting } from './lighting.js';
import { shopUrl, requestedShop } from './shop-route.js';
import { bindCameraInput } from './camera-input.js';

const phase = getPhase(phaseFromQuery());
document.body.dataset.phase = phase.id;
document.getElementById('marketTitle').textContent = `${phase.name} · ${phase.hourLabel}`;
document.title = `${phase.name} · 义犹未尽`;
mountCart();
const stage = document.getElementById('marketStage');
const loading = document.getElementById('marketLoading');
const visit = document.getElementById('visitStall');
const boundaryHint = document.getElementById('marketBoundaryHint');
let nearBoundary = false;
const keys = new Set();
const touchKeys = new Set();
let entries = [], nearest = null, hovered = null, selected = null, ready = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(phase.palette.sky);
scene.fog = new THREE.Fog(phase.palette.fog, 42, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = phase.id === 'night' ? 1.15 : 1.05;
stage.appendChild(renderer.domElement);
const world = new THREE.Group(); scene.add(world);
let marketMap = null;
const player = createPlayer(); player.setPhaseMood(phase.id); scene.add(player.object);
const rig = createCameraRig();
const panel = createPanel({
  phase: phase.id,
  onAdd(product) { addToCart(product.id); showToast('已放入市集篮'); },
  onOpen(product) { if (product) location.href = withShare(assetUrl(product.href)); else leaveStall(); },
});
let revealShop = false;
const directory = document.getElementById('shopDirectory');
const marketBack = document.getElementById('marketBack');
function closeShop() {
  selected = null; revealShop = false; panel.hide(); rig.release(); keys.clear(); touchKeys.clear();
  player.object.visible = true;
  document.body.classList.remove('is-focused');
  document.getElementById('marketTitle').textContent = `${phase.name} · ${phase.hourLabel}`;
  document.title = `${phase.name} · 义犹未尽`;
  marketBack.href = withShare('index.html'); marketBack.textContent = '← 归市图';
}
function leaveStall() {
  if (history.state?.fromMarket) history.back();
  else { history.replaceState(null, '', shopUrl(phase.id)); closeShop(); }
  directory.querySelector('summary').focus({ preventScroll: true });
}
marketBack.addEventListener('click', event => { if (selected) { event.preventDefault(); leaveStall(); } });
window.addEventListener('popstate', () => {
  if (!ready) return;
  const id = requestedShop(location.search, phase.stalls);
  const entry = entries.find(item => item.stall.id === id);
  if (entry) enterStall(entry, { remote: true, navigate: false });
  else closeShop();
});
function nearby(entry) {
  return Math.hypot(player.position.x - entry.position.x, player.position.z - entry.position.z) <= 6.5
    && Math.abs(player.position.y - entry.position.y) < 1.5
    && new THREE.Vector3().subVectors(player.position, entry.position).dot(entry.normal) > 0.5;
}
function enterStall(entry, { remote = false, navigate = true } = {}) {
  if (!ready || !entry || (!remote && (!nearby(entry) || rig.isTransitioning))) return;
  if (selected === entry) return;
  if (navigate) history.pushState({ fromMarket: true }, '', shopUrl(phase.id, entry.stall.id));
  selected = entry; keys.clear(); touchKeys.clear(); panel.hide(); rig.focusOn(entry);
  revealShop = true; visit.hidden = true; directory.open = false;
  document.body.classList.add('is-focused');
  document.getElementById('marketTitle').textContent = `${phase.name} / ${entry.stall.name}`;
  document.title = `${entry.stall.name} · ${phase.name} · 义犹未尽`;
  marketBack.href = shopUrl(phase.id); marketBack.textContent = `← 回${phase.name}`;
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
bindCameraInput(renderer.domElement, rig, {
  enabled: () => ready && !selected && !rig.isTransitioning && !document.querySelector('.cart-drawer.is-open'),
  onTap: (event) => enterStall(pick(event)),
  onHover: (event) => {
    hovered = selected ? null : pick(event);
    renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
  },
});
renderer.domElement.addEventListener('pointerleave', () => { hovered = null; });
function resize() { renderer.setSize(stage.clientWidth, stage.clientHeight); }
window.addEventListener('resize', resize); resize();
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.05);
  const blocked = !ready || selected || rig.isTransitioning || document.querySelector('.cart-drawer.is-open');
  const pressed = (direction) => !blocked && (keys.has(direction) || touchKeys.has(direction)) ? 1 : 0;
  player.update(delta, { x: pressed('right') - pressed('left'), y: pressed('up') - pressed('down') }, rig.getYaw());
  const boundaryDistance = marketMap?.navigator.boundaryDistance(player.position.x, player.position.z) ?? Infinity;
  nearBoundary = boundaryDistance < (nearBoundary ? 2.6 : 2);
  boundaryHint.hidden = !ready || Boolean(selected) || !nearBoundary || Boolean(document.querySelector('.cart-drawer.is-open'));
  rig.update(delta, player, stage.clientWidth / stage.clientHeight);
  if (revealShop && !rig.isTransitioning && selected) {
    revealShop = false; player.object.visible = false; panel.show(selected.stall);
  }
  nearest = entries.filter(nearby).sort((a, b) => player.position.distanceToSquared(a.anchor) - player.position.distanceToSquared(b.anchor))[0] ?? null;
  visit.hidden = !ready || Boolean(selected) || rig.isTransitioning || !nearest;
  if (nearest) visit.textContent = `逛逛${nearest.stall.name} · E`;
  updateStalls(entries, delta, (selected ?? hovered ?? nearest)?.stall.id);
  if (selected) selected.ring.material.opacity = 0;
  marketMap?.updateOcclusion(rig.camera, selected?.focusTarget ?? player.position, delta, selected);
  renderer.render(scene, rig.camera);
});
try {
  marketMap = await loadMarketMap(world, phase);
  if (marketMap.lighting) createAuthoredLighting(scene, renderer, marketMap.lighting);
  marketMap.addSurroundings(scene);
  entries = marketMap.entries;
  player.setMap(marketMap.navigator, marketMap.spawn);
  rig.reset();
  rig.update(0, player, stage.clientWidth / stage.clientHeight);
  const list = directory.querySelector('.directory-list');
  for (const entry of entries) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = entry.stall.name;
    button.addEventListener('click', () => enterStall(entry, { remote: true })); list.append(button);
  }
  directory.querySelector('.directory-count').textContent = `${entries.length} 间可访`;
  const phaseNav = document.getElementById('phaseNav');
  phaseNav.querySelector(`[data-phase="${phase.id}"]`).setAttribute('aria-current', 'page');
  showToast(phase.intro);
  ready = true;
  const directShop = requestedShop(location.search, phase.stalls);
  if (directShop) enterStall(entries.find(entry => entry.stall.id === directShop), { remote: true, navigate: false });
  else if (new URLSearchParams(location.search).has('shop')) history.replaceState(null, '', shopUrl(phase.id));
  loading.classList.add('is-done'); loading.setAttribute('aria-hidden', 'true');
} catch (error) {
  console.error('市集模型加载失败', error);
  loading.querySelector('p').textContent = '摊位加载失败，请重试';
  const retry = document.createElement('button'); retry.textContent = '重新入市'; retry.onclick = () => location.reload(); loading.appendChild(retry);
}
