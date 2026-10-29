import { AMBIENCES } from '../data/soundscape.js';

/** One phase ambience, with cancellation across async loads. */
export function createSoundscape({ context, ambienceOutput, canPlay, fetchAsset = fetch }) {
  const cache = new Map(), retryAfter = new Map();
  let phase = 'morning', sceneRequest = 0, ambience;
  async function buffer(file) {
    if (Date.now() < (retryAfter.get(file) ?? 0)) return null;
    if (!cache.has(file)) {
      cache.set(file, (async () => {
        try {
          const response = await fetchAsset(new URL(`../../${file}`, import.meta.url));
          if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
          return await context.decodeAudioData(await response.arrayBuffer());
        } catch {
          cache.delete(file); retryAfter.set(file, Date.now() + 15000); return null;
        }
      })());
    }
    return cache.get(file);
  }
  function retire(track) {
    if (!track) return;
    track.gain.gain.cancelScheduledValues(context.currentTime);
    track.gain.gain.setTargetAtTime(0, context.currentTime, .12);
    track.source.stop(context.currentTime + .6);
  }
  async function ensureAmbience() {
    const id = phase, token = sceneRequest;
    if (!canPlay() || ambience?.id === id) return;
    const audio = await buffer(AMBIENCES[id].file);
    if (!audio || token !== sceneRequest || !canPlay() || ambience?.id === id) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = audio; source.loop = true; source.loopEnd = Math.min(AMBIENCES[id].duration, audio.duration);
    gain.gain.value = 0; source.connect(gain); gain.connect(ambienceOutput);
    const old = ambience;
    ambience = { id, source, gain };
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    source.start(); gain.gain.setTargetAtTime(1, context.currentTime, .5);
    retire(old);
  }
  return {
    setPhase(id) {
      const next = AMBIENCES[id] ? id : 'morning';
      if (next !== phase) {
        phase = next; ++sceneRequest;
        // Fade out immediately, even if the new track takes time to download.
        retire(ambience); ambience = null;
      }
      void ensureAmbience();
    },
    resume() { void ensureAmbience(); },
  };
}
