import { getCartLines, cartTotal, cartCount, consumeCartLines, subscribe } from './store.js';
import { assetUrl, formatPrice, getProduct } from '../data/products.js';
import { withShare } from '../core/nav.js';
import { sound } from '../core/audio.js';
import { createProductViewer } from '../market/product-viewer.js';

const items = document.getElementById('checkoutItems');
const pay = document.getElementById('payButton');
const status = document.getElementById('paymentStatus');
let complete = false, processing = false;
sound.mount();
function renderItems(lines) {
  items.replaceChildren();
  if (!lines.length) { const empty = document.createElement('p'); empty.className = 'checkout-empty'; empty.textContent = '篮中尚空，先回市集挑几件喜欢的好物吧。'; items.append(empty); return; }
  for (const { product, quantity } of lines) {
    const row = document.createElement('article'); row.className = 'checkout-item';
    const preview = document.createElement('button'); preview.type = 'button'; preview.className = 'checkout-preview';
    preview.setAttribute('aria-label', `三维查看${product.name}`);
    const image = document.createElement('img'); image.src = `${assetUrl(product.thumbnail)}?v=20261030`; image.alt = product.name;
    preview.append(image); preview.addEventListener('click', () => createProductViewer().open(product, preview));
    const copy = document.createElement('div'), title = document.createElement('h3'), info = document.createElement('p'), price = document.createElement('b');
    title.textContent = product.name; info.textContent = `${product.shop} · ¥${formatPrice(product.price)} × ${quantity}`;
    price.textContent = `¥${formatPrice(product.price * quantity)}`; copy.append(title, info); row.append(preview, copy, price); items.append(row);
  }
}
function showReceipt(receipt) {
  complete = true;
  document.getElementById('checkoutTitle').textContent = '好物已收入行囊';
  document.querySelector('.checkout-intro').textContent = '模拟订单已完成。谢谢光临，下个时辰再来逛逛。';
  document.querySelector('.bill-seal').textContent = '讫';
  document.getElementById('billTitle').textContent = '市集留念';
  const lines = receipt.items.map(i => ({ product: { ...getProduct(i.id), price: i.price }, quantity: i.quantity }));
  renderItems(lines);
  document.getElementById('checkoutCount').textContent = `${lines.reduce((s,l) => s + l.quantity, 0)} 件`;
  for (const id of ['checkoutSubtotal','checkoutTotal']) document.getElementById(id).textContent = `¥${formatPrice(receipt.total)}`;
  pay.disabled = true; pay.textContent = '模拟支付完成 ✓';
  status.textContent = `留念单号 ${receipt.id} · 未发生真实扣款`;
}
let receipt;
try { receipt = JSON.parse(sessionStorage.getItem(`yiwu-demo-order:${new URLSearchParams(location.search).get('order')}`)); } catch {}
if (receipt?.items?.length && receipt.items.every(i => getProduct(i.id))) showReceipt(receipt);
subscribe(lines => {
  if (complete || processing) return;
  renderItems(lines);
  document.getElementById('checkoutCount').textContent = `${cartCount()} 件`;
  for (const id of ['checkoutSubtotal','checkoutTotal']) document.getElementById(id).textContent = `¥${formatPrice(cartTotal())}`;
  pay.disabled = lines.length === 0; pay.textContent = `确认模拟付款 · ¥${formatPrice(cartTotal())}`;
});
pay.addEventListener('click', () => {
  if (processing || complete) return;
  const lines = getCartLines(); if (!lines.length) return;
  processing = true; pay.disabled = true;
  const receipt = { id: `YI-${Date.now().toString(36).toUpperCase()}`, total: cartTotal(),
    items: lines.map(({ product, quantity }) => ({ id: product.id, price: product.price, quantity })) };
  try {
    sessionStorage.setItem(`yiwu-demo-order:${receipt.id}`, JSON.stringify(receipt));
    consumeCartLines(lines);
    history.replaceState(null, '', withShare(`checkout.html?order=${receipt.id}`));
    showReceipt(receipt); sound.play('success');
  } catch { status.textContent = '当前浏览器无法保存订单，请允许本地存储后重试。'; pay.disabled = false; }
  finally { processing = false; }
});
