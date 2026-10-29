import { sound } from '../core/audio.js';
import { assetUrl, formatPrice, getProduct } from '../data/products.js';
import { withShare } from '../core/nav.js';
import {
  cartCount,
  cartTotal,
  removeFromCart,
  setQuantity,
  subscribe,
} from './store.js';

const ICON_CART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.46 1.18h8.06a1.5 1.5 0 0 0 1.46-1.18L20 8H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="16.5" cy="20" r="1.3"/></svg>`;
const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

let toastTimer = 0;

export function showToast(text) {
  let el = document.querySelector('.market-toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'market-toast';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('is-visible'), 1900);
}

function renderLines(listEl, lines) {
  if (!lines.length) {
    listEl.innerHTML = `<div class="cart-empty"><span>篮 中 尚 空</span><small>去街上看看，总有想带走的</small></div>`;
    return;
  }
  listEl.innerHTML = lines
    .map(
      ({ product, quantity }) => `
      <article class="cart-line" data-id="${product.id}">
        <button type="button" class="cart-item-preview" data-act="preview" aria-label="三维查看${product.name}"><img src="${assetUrl(product.thumbnail)}?v=20261030" alt="${product.name}" loading="lazy"><span>360° 鉴赏</span></button>
        <div class="cart-line-body">
          <h4><button type="button" data-act="preview">${product.name}</button></h4>
          <p>${product.phaseName} · ${product.shop} <span>¥${formatPrice(product.price)} / 件</span></p>
          <div class="cart-line-controls">
            <button type="button" data-act="dec" aria-label="减少">−</button>
            <span>${quantity}</span>
            <button type="button" data-act="inc" aria-label="增加">＋</button>
            <button type="button" class="cart-line-remove" data-act="remove">移除</button>
          </div>
        </div>
        <div class="cart-line-price">¥${formatPrice(product.price * quantity)}</div>
      </article>`
    )
    .join('');
}

export function mountCart() {
  if (document.querySelector('.cart-root')) return;
  const root = document.createElement('div');
  root.className = 'cart-root';
  root.innerHTML = `
    <button type="button" class="cart-trigger" aria-label="打开购物车">
      ${ICON_CART}
      <span>购物车</span>
      <em class="cart-badge">0</em>
    </button>
    <div class="cart-scrim" data-act="close"></div>
    <aside class="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cartTitle" aria-hidden="true" inert>
      <header class="cart-drawer-head">
        <div>
          <p class="cart-kicker">义 犹 未 尽 / 随 身 行 囊</p>
          <h3 id="cartTitle">市集藏珍</h3>
          <p>一路拾来的欢喜，都收在这里</p>
        </div>
        <button type="button" class="cart-close" data-act="close" aria-label="关闭">${ICON_CLOSE}</button>
      </header>
      <div class="cart-inventory-bar"><span>已收好物 <b class="cart-kind-count">0</b> 款</span><small>点选藏品 · 三维鉴赏</small></div>
      <div class="cart-lines"></div>
      <footer class="cart-drawer-foot">
        <div class="cart-total"><span>合计</span><b>¥0</b></div>
        <button type="button" class="cart-checkout" data-act="checkout">支付买单 <span>→</span></button>
        <p class="cart-payment-note">进入模拟收银台 · 不产生真实扣款</p>
      </footer>
    </aside>`;
  document.body.appendChild(root);

  const trigger = root.querySelector('.cart-trigger');
  const badge = root.querySelector('.cart-badge');
  const drawer = root.querySelector('.cart-drawer');
  const scrim = root.querySelector('.cart-scrim');
  const listEl = root.querySelector('.cart-lines');
  const totalEl = root.querySelector('.cart-total b');

  const open = () => {
    sound.play('open'); sound.setFocus(true);
    drawer.classList.add('is-open');
    scrim.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.inert = false;
    document.querySelector('.product-window')?.setAttribute('inert', '');
    drawer.querySelector('.cart-close').focus({ preventScroll: true });
  };
  const close = ({ restoreFocus = true } = {}) => {
    if (drawer.classList.contains('is-open')) sound.play('close');
    sound.setFocus(Boolean(document.body.classList.contains('is-focused')));
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    document.querySelector('.product-window')?.removeAttribute('inert');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  };

  trigger.addEventListener('click', open);
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'close') close();
    if (action === 'checkout' && cartCount()) location.href = withShare('checkout.html');
  });

  listEl.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const line = button.closest('.cart-line');
    const id = line?.dataset.id;
    const current = Number(line?.querySelector('.cart-line-controls span')?.textContent ?? 0);
    if (!id) return;
    if (button.dataset.act === 'preview') {
      try {
        button.disabled = true;
        const { createProductViewer } = await import('../market/product-viewer.js');
        close({ restoreFocus: false });
        await createProductViewer().open(getProduct(id), trigger, { onClose: open });
      } catch { showToast('商品暂时未能打开，请重试'); }
      finally { button.disabled = false; }
      return;
    }
    if (button.dataset.act === 'inc') setQuantity(id, current + 1);
    if (button.dataset.act === 'dec') setQuantity(id, current - 1);
    if (button.dataset.act === 'remove') removeFromCart(id);
  });

  document.addEventListener('keydown', (event) => {
    if (!drawer.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation(); close();
    }
    if (event.key === 'Tab') {
      const focusable = [...drawer.querySelectorAll('button:not(:disabled),a[href]')];
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }, true);

  subscribe((lines) => {
    const count = cartCount();
    badge.textContent = String(count);
    badge.classList.toggle('is-hidden', count === 0);
    totalEl.textContent = `¥${formatPrice(cartTotal())}`;
    root.querySelector('.cart-kind-count').textContent = String(lines.length);
    root.querySelector('.cart-checkout').disabled = count === 0;
    renderLines(listEl, lines);
  });
}
