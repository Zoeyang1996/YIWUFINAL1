/** Bound fill-rate on high-DPI phones and large desktop displays. */
export function isConstrainedDisplay() {
  return Boolean(globalThis.matchMedia?.('(pointer: coarse)').matches)
    || (globalThis.navigator?.deviceMemory > 0 && globalThis.navigator.deviceMemory <= 4);
}

export function renderPixelRatio(maxRatio = 1.75, width = innerWidth, height = innerHeight) {
  const constrained = isConstrainedDisplay();
  const budget = constrained ? 1_000_000 : 2_500_000;
  return Math.min(globalThis.devicePixelRatio || 1, constrained ? 1.25 : maxRatio,
    Math.sqrt(budget / Math.max(1, width * height)));
}
