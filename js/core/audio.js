import { createSoundscape } from './soundscape.js';

/** Original market score + quiet tactile feedback. Audio is optional to gameplay. */
const MUSIC_URL = new URL('../../assets/audio/market-stroll.wav', import.meta.url);
const LOOP_SECONDS = 96;
const STORAGE_KEY = 'yiwu-sound-v1';
const POSITION_KEY = 'yiwu-music-position';
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
let preferences = { muted: false, music: .32, effects: .65, ambience: .7 };
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  if (saved) preferences = { muted: saved.muted === true, music: clamp(saved.music ?? .32), effects: clamp(saved.effects ?? .65),
    ambience: clamp(saved.ambience ?? .7) };
} catch { /* Storage may be disabled; audio still works for this visit. */ }
let context, master, musicGain, effectsGain, musicSource, musicBuffer, loading;
let ambienceGain, soundscape;
let controls, toggle, status, mounted = false, focusLevel = 1, phase = 'morning';
let offset = 0, startedAt = 0, retryAfter = 0, musicFailed = false, stepDistance = 0;
const lastPlayed = new Map();
const activeEffects = new Set();
try { offset = Math.max(0, Number(sessionStorage.getItem(POSITION_KEY)) || 0) % LOOP_SECONDS; } catch {}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); } catch {}
}
function refreshControls() {
  if (!controls) return;
  const active = !preferences.muted && context?.state === 'running';
  toggle.textContent = preferences.muted ? '声 · 已静音' : active ? '声 · 入耳' : '声 · 开启';
  toggle.setAttribute('aria-label', preferences.muted ? '开启音乐与音效' : active ? '静音音乐与音效' : '开启音乐与音效');
  toggle.setAttribute('aria-pressed', String(Boolean(active)));
  status.textContent = musicFailed ? '乐曲暂未载入，操作时会重试' : preferences.muted ? '已静音 · 设置会自动记住' : active ? '市巷慢游 · 三时市声' : '轻点或按键，让市声入耳';
}
function levels() {
  if (!context) return;
  const now = context.currentTime;
  master.gain.setTargetAtTime(preferences.muted ? 0 : .8, now, .025);
  musicGain.gain.setTargetAtTime(preferences.music * focusLevel * (phase === 'night' ? .8 : 1), now, .45);
  effectsGain.gain.setTargetAtTime(preferences.effects, now, .025);
  ambienceGain.gain.setTargetAtTime(preferences.ambience * (focusLevel < 1 ? .75 : 1), now, .45);
}
function initialize() {
  if (context) return true;
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContext) return false;
  context = new AudioContext();
  master = context.createGain(); master.gain.value = 0;
  musicGain = context.createGain(); effectsGain = context.createGain();
  ambienceGain = context.createGain();
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 12; limiter.ratio.value = 6;
  musicGain.connect(master); effectsGain.connect(master); master.connect(limiter); limiter.connect(context.destination);
  ambienceGain.connect(master);
  soundscape = createSoundscape({
    context, ambienceOutput: ambienceGain,
    canPlay: () => !preferences.muted && !document.hidden && context.state === 'running',
  });
  soundscape.setPhase(phase);
  context.addEventListener('statechange', refreshControls);
  levels();
  return true;
}
function startMusic() {
  if (musicSource || !musicBuffer || preferences.muted || context.state !== 'running' || document.hidden) return;
  musicSource = context.createBufferSource();
  musicSource.buffer = musicBuffer; musicSource.loop = true;
  musicSource.loopStart = 0; musicSource.loopEnd = Math.min(LOOP_SECONDS, musicBuffer.duration);
  offset %= musicSource.loopEnd;
  musicSource.connect(musicGain);
  startedAt = context.currentTime;
  musicGain.gain.cancelScheduledValues(startedAt); musicGain.gain.setValueAtTime(0, startedAt);
  musicSource.start(startedAt, offset); levels();
}
async function loadMusic() {
  if (musicBuffer) { startMusic(); return; }
  if (loading || Date.now() < retryAfter) return;
  loading = (async () => {
    try {
      const response = await fetch(MUSIC_URL);
      if (!response.ok) throw new Error(`Music HTTP ${response.status}`);
      musicBuffer = await context.decodeAudioData(await response.arrayBuffer());
      musicFailed = false; startMusic();
    } catch {
      musicFailed = true; retryAfter = Date.now() + 15000;
    } finally { loading = null; refreshControls(); }
  })();
  await loading;
}
async function unlock() {
  if (preferences.muted || document.hidden) return false;
  try {
    if (!initialize()) return false;
    if (context.state !== 'running') await context.resume();
    if (preferences.muted || document.hidden) { await context.suspend(); return false; }
    try { sessionStorage.setItem('yiwu-sound-started', '1'); } catch {}
    levels(); void loadMusic(); soundscape.resume(); refreshControls();
    return context.state === 'running';
  } catch { refreshControls(); return false; }
}
function tone(frequency, when, duration, volume, type = 'sine', endFrequency = frequency) {
  const osc = context.createOscillator(), gain = context.createGain();
  osc.type = type; osc.frequency.setValueAtTime(frequency, when);
  osc.frequency.exponentialRampToValueAtTime(endFrequency, when + duration);
  gain.gain.setValueAtTime(0, when); gain.gain.linearRampToValueAtTime(volume, when + .006);
  gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
  osc.connect(gain); gain.connect(effectsGain);
  activeEffects.add(osc);
  osc.start(when); osc.stop(when + duration + .02);
  osc.onended = () => { activeEffects.delete(osc); osc.disconnect(); gain.disconnect(); };
}
function rustle(when, volume = .025) {
  const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
  const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * .12), context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / samples.length * 7);
  source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = 1100;
  gain.gain.value = volume;
  source.connect(filter); filter.connect(gain); gain.connect(effectsGain);
  activeEffects.add(source); source.start(when);
  source.onended = () => { activeEffects.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
}
function emit(kind) {
  const t = context.currentTime + .005;
  if (kind === 'step') {
    tone(115 + Math.random() * 15, t, .10, .15, 'sine', 72); rustle(t, .07); return;
  }
  if (kind === 'key' || kind === 'tap') {
    tone(kind === 'key' ? 440 : 587.33, t, .085, .10, 'sine', kind === 'key' ? 330 : 440);
    rustle(t, .018); return;
  }
  const notes = {
    enter: [587.33, 739.99, 880], close: [739.99, 587.33],
    open: [659.25, 880], select: [587.33, 739.99],
    success: [739.99, 880, 1174.66], hold: [440, 587.33],
  }[kind] || [587.33];
  notes.forEach((note, index) => {
    const at = t + index * .075;
    tone(note, at, .42, .12);
    tone(note * 2.003, at, .18, .022);
  });
}
function play(kind = 'tap') {
  if (preferences.muted || document.hidden || !preferences.effects) return;
  const now = performance.now();
  if (now - (lastPlayed.get(kind) ?? -Infinity) < (kind === 'step' ? 220 : 55)) return;
  lastPlayed.set(kind, now);
  // Start feedback immediately on a running context; never queue stale keystrokes.
  if (context?.state === 'running') emit(kind);
  else void unlock().then(ok => { if (ok && performance.now() - now < 250) emit(kind); });
}
function pause() {
  if (!context) return;
  activeEffects.forEach(source => { try { source.stop(); } catch {} });
  activeEffects.clear();
  if (musicSource) {
    try { sessionStorage.setItem(POSITION_KEY, String((offset + context.currentTime - startedAt) % LOOP_SECONDS)); } catch {}
  }
  void context.suspend().catch(() => {});
}
const editing = target => target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');

export const sound = {
  play,
  setPhase(id) { phase = id; soundscape?.setPhase(id); levels(); },
  setFocus(focused) {
    const next = focused ? .68 : 1;
    if (focusLevel !== next) { focusLevel = next; levels(); }
  },
  walk(distance) {
    if (!Number.isFinite(distance) || distance < .0001 || distance > .5) { stepDistance = 0; return; }
    stepDistance += distance;
    if (stepDistance >= .78) { stepDistance %= .78; play('step'); }
  },
  mount(id = 'morning') {
    if (mounted) return;
    mounted = true; phase = id;
    controls = document.createElement('div'); controls.className = 'sound-controls';
    controls.innerHTML = `<button type="button" class="sound-toggle"></button>
      <details class="sound-settings"><summary aria-label="音乐、环境与音效音量">调音</summary>
      <div class="sound-panel"><p class="sound-heading">市 声 入 耳</p>
      <label>背景音乐 <input aria-label="背景音乐音量" data-channel="music" type="range" min="0" max="100" step="1"></label>
      <label>操作音效 <input aria-label="操作音效音量" data-channel="effects" type="range" min="0" max="100" step="1"></label>
      <label>市井环境 <input aria-label="市井环境音量" data-channel="ambience" type="range" min="0" max="100" step="1"></label>
      <p class="sound-status" role="status"></p></div></details>`;
    document.body.append(controls);
    toggle = controls.querySelector('.sound-toggle'); status = controls.querySelector('.sound-status');
    controls.querySelectorAll('input').forEach(input => {
      input.value = Math.round(preferences[input.dataset.channel] * 100);
      input.addEventListener('input', () => {
        preferences[input.dataset.channel] = clamp(input.value / 100); save(); levels();
      });
      input.addEventListener('change', () => { if (input.dataset.channel === 'effects') play('tap'); });
    });
    toggle.addEventListener('click', () => {
      if (!preferences.muted && context?.state === 'running') {
        preferences.muted = true; levels(); pause();
      } else { preferences.muted = false; void unlock().then(ok => { if (ok) play('tap'); }); }
      save(); refreshControls();
    });
    controls.addEventListener('keydown', event => {
      if (event.key === 'Escape') { controls.querySelector('details').open = false; toggle.focus(); }
      event.stopPropagation();
    });
    controls.querySelector('details').addEventListener('click', event => {
      if (event.target.closest?.('summary')) play('tap');
    });
    document.addEventListener('pointerdown', event => {
      if (event.target.closest?.('.sound-toggle')) return;
      void unlock();
      if (event.target.closest?.('[data-move]')) play('key');
      if (!controls.contains(event.target)) controls.querySelector('details').open = false;
    }, true);
    document.addEventListener('keydown', event => {
      if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || editing(event.target) || controls.contains(event.target)) return;
      void unlock();
      if (event.repeat || ['Shift','Control','Alt','Meta','Escape'].includes(event.key)) return;
      if (document.body.classList.contains('overview') && event.key.startsWith('Arrow')) return;
      if (['Enter',' '].includes(event.key)) return; // Activation/transition supplies its own sound.
      if (event.key.toLowerCase() === 'e' && document.body.classList.contains('market')) return;
      play('key');
    }, true);
    document.addEventListener('click', event => {
      const button = event.target.closest?.('button,a,summary');
      if (!button || button.disabled || button.closest('[inert],.sound-controls')) return;
      // These controls play feedback after their action succeeds.
      if (button.matches('[data-move],[data-phase],#visitStall,#marketBack,.panel-close,.panel-model-card,.card-open,.card-add,.product-buy,.product-cart,.product-close,.cart-trigger,[data-act="close"],[data-act="checkout"],.directory-list button')) return;
      play('tap');
    }, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
      else if (context) void unlock();
    });
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', () => { if (context) void unlock(); });
    window.addEventListener('blur', pause);
    window.addEventListener('focus', () => { if (context) void unlock(); });
    refreshControls();
    // Same-origin navigation may retain playback permission. If the browser
    // requires a fresh gesture, the normal pointer/key listeners resume it.
    try { if (sessionStorage.getItem('yiwu-sound-started') === '1') void unlock(); } catch {}
  },
};
