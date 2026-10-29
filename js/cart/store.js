import { PRODUCTS } from '../data/products.js';

const STORAGE_KEY = 'yiwu-market-cart-v1';
const listeners = new Set();

function readRaw() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeRaw(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  listeners.forEach((fn) => fn(getCartLines()));
}

/** 只保留仍然存在的商品，并滤掉非法数量 */
export function getCartLines() {
  const raw = readRaw();
  const lines = [];
  for (const [id, qty] of Object.entries(raw)) {
    const product = PRODUCTS[id];
    const quantity = Math.min(99, Math.floor(Number(qty)));
    if (!product || !Number.isFinite(quantity) || quantity <= 0) continue;
    lines.push({ product, quantity });
  }
  return lines;
}

export function addToCart(productId, quantity = 1) {
  if (!PRODUCTS[productId]) return;
  const items = readRaw();
  const current = Math.floor(Number(items[productId]) || 0);
  items[productId] = Math.min(current + quantity, 99);
  writeRaw(items);
}

export function setQuantity(productId, quantity) {
  if (!PRODUCTS[productId]) return;
  const items = readRaw();
  const next = Math.floor(Number(quantity) || 0);
  if (next <= 0) delete items[productId];
  else items[productId] = Math.min(next, 99);
  writeRaw(items);
}

export function removeFromCart(productId) {
  const items = readRaw();
  delete items[productId];
  writeRaw(items);
}

/** Remove only quantities included in this demo order, preserving later additions. */
export function consumeCartLines(lines) {
  const items = readRaw();
  for (const { product, quantity } of lines) {
    const remaining = Math.floor(Number(items[product.id]) || 0) - quantity;
    if (remaining > 0) items[product.id] = remaining;
    else delete items[product.id];
  }
  writeRaw(items);
}

export function cartCount() {
  return getCartLines().reduce((sum, line) => sum + line.quantity, 0);
}

export function cartTotal() {
  return getCartLines().reduce((sum, line) => sum + line.product.price * line.quantity, 0);
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(getCartLines());
  return () => listeners.delete(listener);
}

// 让别的页面（比如商品详情页）改了购物车后，当前页面也能立刻反应
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  listeners.forEach((fn) => fn(getCartLines()));
});
