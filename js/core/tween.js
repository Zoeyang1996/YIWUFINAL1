/** 极小的补间工具，跟主渲染循环一起走 */

const active = new Set();

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
export const easeInOutQuart = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
export const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

/**
 * @param {object} options
 * @param {number} [options.duration] 毫秒
 * @param {number} [options.from]
 * @param {number} [options.to]
 * @param {(value:number, progress:number)=>void} [options.onUpdate]
 * @param {()=>void} [options.onComplete]
 * @param {(t:number)=>number} [options.ease]
 */
export function tween({ duration = 500, from = 0, to = 1, onUpdate, onComplete, ease = easeOutCubic }) {
  const task = {
    start: performance.now(),
    duration: Math.max(1, duration),
    from,
    to,
    onUpdate,
    onComplete,
    ease,
  };
  active.add(task);
  return () => active.delete(task);
}

export function updateTweens(now = performance.now()) {
  for (const task of [...active]) {
    const progress = Math.min(1, (now - task.start) / task.duration);
    const eased = task.ease(progress);
    task.onUpdate?.(task.from + (task.to - task.from) * eased, progress);
    if (progress >= 1) {
      active.delete(task);
      task.onComplete?.();
    }
  }
}

export function clearTweens() {
  active.clear();
}
