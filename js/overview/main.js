import { mountCart } from '../cart/ui.js';
import { PHASES, PHASE_ORDER } from '../data/phases.js';
import { createOverviewStage } from './stage.js';

const stageEl = document.getElementById('stage');
const buttonsEl = document.getElementById('phaseButtons');
const hourEl = document.getElementById('phaseHour');
const tagEl = document.getElementById('phaseTag');
const captionEl = document.getElementById('phaseCaption');
const curtainEl = document.getElementById('curtain');
const wipeEl = document.getElementById('pageWipe');
const hintEl = document.getElementById('enterHint');
const body = document.body;

const WHEEL_LOCK_MS = 620;
const WHEEL_THRESHOLD = 12;

let index = 0;
let wheelLockedUntil = 0;
let captionTimer = 0;
let leaving = false;

mountCart();

function buildButtons() {
  buttonsEl.innerHTML = PHASE_ORDER.map(
    (id, order) => `
      <button type="button" class="phase-button" data-phase="${id}" aria-label="${PHASES[id].name}">
        <span>${PHASES[id].glyph}</span>
        <small>${String(order + 1).padStart(2, '0')}</small>
      </button>`
  ).join('');
  buttonsEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-phase]');
    if (!button || leaving) return;
    const next = PHASE_ORDER.indexOf(button.dataset.phase);
    if (next >= 0 && next !== index) goTo(next);
  });
}

function paintCaption() {
  const phase = PHASES[PHASE_ORDER[index]];
  captionEl.classList.add('is-swapping');
  clearTimeout(captionTimer);
  captionTimer = window.setTimeout(() => {
    hourEl.textContent = `${phase.name} · ${phase.hourLabel}`;
    tagEl.textContent = phase.tagline;
    captionEl.classList.remove('is-swapping');
  }, 180);
}

function paintActive() {
  const phaseId = PHASE_ORDER[index];
  body.dataset.phase = phaseId;
  buttonsEl.querySelectorAll('.phase-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.phase === phaseId);
  });
}

async function goTo(nextIndex) {
  index = (nextIndex + PHASE_ORDER.length) % PHASE_ORDER.length;
  paintActive();
  paintCaption();
  wheelLockedUntil = performance.now() + WHEEL_LOCK_MS;
  await stage.setPhase(PHASE_ORDER[index]);
}

function leaveToMarket() {
  if (leaving) return;
  leaving = true;
  hintEl.classList.add('is-entering');
  hintEl.textContent = '入 市';
  wipeEl.classList.add('is-active');
  window.setTimeout(() => {
    location.href = `market.html?phase=${PHASE_ORDER[index]}`;
  }, 560);
}

const stage = createOverviewStage(stageEl, {
  onEnter: leaveToMarket,
  onModelReady: (phaseId) => {
    if (phaseId === PHASE_ORDER[0]) {
      curtainEl.classList.add('is-done');
      stageEl.classList.add('is-loaded');
    }
  },
});

buildButtons();
paintActive();
hourEl.textContent = `${PHASES[PHASE_ORDER[0]].name} · ${PHASES[PHASE_ORDER[0]].hourLabel}`;
tagEl.textContent = PHASES[PHASE_ORDER[0]].tagline;
stage.setPhase(PHASE_ORDER[0]);

// ---- 滚轮换时 ----
window.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    if (leaving || Math.abs(event.deltaY) < WHEEL_THRESHOLD) return;
    const now = performance.now();
    if (now < wheelLockedUntil) return;
    goTo(index + (event.deltaY > 0 ? 1 : -1));
  },
  { passive: false }
);

// ---- 触屏上下滑 ----
let touchStartY = 0;
window.addEventListener('touchstart', (event) => {
  touchStartY = event.touches[0]?.clientY ?? 0;
}, { passive: true });
window.addEventListener('touchend', (event) => {
  const endY = event.changedTouches[0]?.clientY ?? touchStartY;
  const delta = touchStartY - endY;
  if (Math.abs(delta) < 46 || leaving) return;
  goTo(index + (delta > 0 ? 1 : -1));
}, { passive: true });

// ---- 键盘 ----
window.addEventListener('keydown', (event) => {
  if (leaving) return;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') goTo(index + 1);
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') goTo(index - 1);
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    stage.enter();
  }
});

stageEl.addEventListener('pointerenter', () => stageEl.classList.add('is-hovering'));
stageEl.addEventListener('pointerleave', () => stageEl.classList.remove('is-hovering'));

// 预取二级页面，进市集时不必再等
window.setTimeout(() => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = 'market.html';
  document.head.appendChild(link);
}, 1600);
