import { sound } from '../core/audio.js';
import { formatPrice } from '../data/products.js';
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
        <div class="cart-line-seal">${product.glyph}</div>
        <div class="cart-line-body">
          <h4>${product.name}</h4>
          <p>${product.shop}</p>
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
  const root = document.createElement('div');
  root.className = 'cart-root';
  root.innerHTML = `
    <button type="button" class="cart-trigger" aria-label="打开购物车">
      ${ICON_CART}
      <span>购物车</span>
      <em class="cart-badge">0</em>
    </button>
    <div class="cart-scrim" data-act="close"></div>
    <aside class="cart-drawer" aria-hidden="true">
      <header class="cart-drawer-head">
        <div>
          <h3>市集篮</h3>
          <p>挑中的东西，先放在这里</p>
        </div>
        <button type="button" class="cart-close" data-act="close" aria-label="关闭">${ICON_CLOSE}</button>
      </header>
      <div class="cart-lines"></div>
      <footer class="cart-drawer-foot">
        <div class="cart-total"><span>合计</span><b>¥0</b></div>
        <button type="button" class="cart-checkout" data-act="checkout">去 结 账</button>
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
  };
  const close = () => {
    if (drawer.classList.contains('is-open')) sound.play('close');
    sound.setFocus(Boolean(document.body.classList.contains('is-focused')));
    drawer.classList.remove('is-open');
    scrim.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  };

  trigger.addEventListener('click', open);
  root.addEventListener('click', (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action === 'close') close();
    if (action === 'checkout') { sound.play('success'); showToast('已 下 单 · 摊 主 马 上 备 货'); }
  });

  listEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const line = button.closest('.cart-line');
    const id = line?.dataset.id;
    const current = Number(line?.querySelector('.cart-line-controls span')?.textContent ?? 0);
    if (!id) return;
    if (button.dataset.act === 'inc') setQuantity(id, current + 1);
    if (button.dataset.act === 'dec') setQuantity(id, current - 1);
    if (button.dataset.act === 'remove') removeFromCart(id);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
      event.stopPropagation(); close();
    }
  });

  subscribe((lines) => {
    const count = cartCount();
    badge.textContent = String(count);
    badge.classList.toggle('is-hidden', count === 0);
    totalEl.textContent = `¥${formatPrice(cartTotal())}`;
    renderLines(listEl, lines);
  });
}
