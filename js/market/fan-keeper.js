import { animateCharacter } from './characters.js';

/** Legacy entry point shares the same restrained greeting as every other keeper. */
export function createFanKeeper(map) {
  const root = map.getObjectByName('Armature');
  if (!root) return null;
  const animation = animateCharacter(root);
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  return {
    greet() { animation.greet(); },
    update(dt) { animation.update(dt, false, reduced?.matches); },
  };
}
