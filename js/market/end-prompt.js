import { createEndZone, END_ZONES } from './end-zone.js';
import { createStallHold } from './stall-hold.js';

export function createEndPrompt({ phase, onOpen, onClose, onReturn }) {
  const zone = END_ZONES[phase.id];
  const trigger = createEndZone(zone);
  const hold = createStallHold(900);
  const dialog = document.createElement('dialog');
  dialog.className = 'market-end';
  dialog.setAttribute('aria-labelledby', 'marketEndTitle');
  dialog.setAttribute('aria-describedby', 'marketEndDescription');
  dialog.innerHTML = `<div class="market-end__seal" aria-hidden="true">逛</div>
    <p class="market-end__eyebrow"></p>
    <h2 id="marketEndTitle">一程烟火，满载而归</h2>
    <p id="marketEndDescription">您已来到这段市集的终点。回到首页，或再回头看看喜欢的小铺。</p>
    <button type="button" class="market-end__return"><span>您已逛完返回首页</span><small>按住 0.9 秒 · 鼠标 / 触屏 / 空格或 Enter</small></button>
    <button type="button" class="market-end__continue" autofocus>继续回头转转</button>`;
  dialog.querySelector('.market-end__eyebrow').textContent = `${phase.name} · ${zone.label}`;
  document.body.append(dialog);
  const back = dialog.querySelector('.market-end__return');
  let opener = null, returning = false;
  function reset() { hold.release(); back.style.setProperty('--return-progress', '0%'); }
  function close() {
    reset(); dialog.close(); onClose?.();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  }
  dialog.querySelector('.market-end__continue').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  back.addEventListener('click', event => event.preventDefault());
  back.addEventListener('pointerdown', event => {
    if (event.button !== 0 || returning) return;
    back.setPointerCapture(event.pointerId); back.focus();
    hold.press('home', performance.now()); event.preventDefault();
  });
  back.addEventListener('pointermove', event => {
    const rect = back.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) reset();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) back.addEventListener(type, reset);
  back.addEventListener('keydown', event => {
    if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    if (!event.repeat && !returning) hold.press('home', performance.now());
  });
  back.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); reset(); } });
  window.addEventListener('blur', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  return {
    get isOpen() { return dialog.open; },
    update(position, enabled, now = performance.now()) {
      if (trigger.update(position, enabled && !dialog.open && !document.hidden)) {
        opener = document.activeElement; onOpen?.(); reset(); dialog.showModal();
      }
      if (!dialog.open || returning) return;
      if (hold.update(document.hidden ? null : 'home', now)) { returning = true; onReturn(); }
      back.style.setProperty('--return-progress', `${hold.progress * 100}%`);
    },
  };
}
