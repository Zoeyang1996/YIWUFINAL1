/** Captured drags orbit the camera; only a deliberate tap enters a shop. */
export function bindCameraInput(canvas, rig, { enabled, onTap, onHover }) {
  const pointers = new Map();
  let dragged = false, pinchDistance = 0;
  const distance = () => {
    const [a, b] = [...pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  function cancel() {
    const ids = [...pointers.keys()]; pointers.clear();
    for (const id of ids) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    dragged = false; pinchDistance = 0; canvas.style.cursor = '';
  }
  canvas.addEventListener('pointerdown', (event) => {
    if (!enabled() || ![0, 2].includes(event.button)) return;
    if (!pointers.size) dragged = false;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (pointers.size > 1) { dragged = true; pinchDistance = distance(); }
    event.preventDefault();
  });
  canvas.addEventListener('pointermove', (event) => {
    const point = pointers.get(event.pointerId);
    if (!point) { onHover?.(event); return; }
    if (!enabled()) { cancel(); return; }
    const dx = event.clientX - point.x, dy = event.clientY - point.y;
    point.x = event.clientX; point.y = event.clientY;
    if (Math.hypot(point.x - point.startX, point.y - point.startY) > 5) dragged = true;
    if (pointers.size === 2) {
      const next = distance();
      if (pinchDistance > 0 && next > 0) rig.zoom(Math.log(pinchDistance / next) * 1000);
      pinchDistance = next;
    } else if (dragged) rig.rotate(dx, dy);
    canvas.style.cursor = dragged ? 'grabbing' : 'grab';
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!pointers.has(event.pointerId)) return;
    const tap = !dragged && pointers.size === 1 && event.button === 0 && enabled();
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!pointers.size) canvas.style.cursor = '';
    if (tap) onTap(event);
  });
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', (event) => { if (pointers.has(event.pointerId)) cancel(); });
  canvas.addEventListener('wheel', (event) => {
    if (!enabled()) return;
    event.preventDefault();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1);
    rig.zoom(Math.max(-200, Math.min(200, pixels)));
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('blur', cancel);
  return { cancel };
}
