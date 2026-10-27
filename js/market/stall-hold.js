/** One action per physical key press. Cancellation also requires a fresh press. */
export function createStallHold(duration = 600) {
  let down = false, target = null, started = 0, progress = 0;
  return {
    press(nextTarget, now) {
      if (down) return;
      down = true;
      target = nextTarget;
      started = now;
      progress = 0;
    },
    update(currentTarget, now) {
      if (!target || target !== currentTarget) {
        target = null; progress = 0;
        return false;
      }
      progress = Math.min(1, Math.max(0, (now - started) / duration));
      if (progress < 1) return false;
      target = null; progress = 0;
      return true;
    },
    cancel() { target = null; progress = 0; },
    release() { down = false; target = null; progress = 0; },
    get progress() { return progress; },
  };
}
