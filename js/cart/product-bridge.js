/**
 * 挂在九个商品详情页末尾，让它们的「加入购物车 / 购买」写进市集共用的购物篮，
 * 并补一个回到市集的入口。这一页原有的视觉与交互一律不动。
 */
import { PRODUCTS } from '../data/products.js';
import { addToCart, cartCount, subscribe } from './store.js';

function currentProduct() {
  const here = decodeURI(location.pathname);
  return Object.values(PRODUCTS).find((product) => here.endsWith(decodeURI(product.href))) ?? null;
}

function buildBackLink() {
  const link = document.createElement('a');
  link.className = 'bridge-back';
  link.href = new URL('../../../../../../../index.html', location.href).href;
  link.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg><span>回到市集</span>';
  document.body.appendChild(link);
}

const STYLE = `
.bridge-back{position:fixed;left:22px;top:16px;z-index:40;display:flex;align-items:center;gap:6px;
  font-family:"STKaiti","KaiTi","Songti SC",serif;font-size:14px;letter-spacing:.18em;
  color:rgba(253,246,232,.78);text-decoration:none;padding:7px 14px 7px 10px;
  border:1px solid rgba(245,226,190,.24);background:rgba(56,34,20,.6);backdrop-filter:blur(4px);
  transition:.24s;}
.bridge-back:hover{color:#fdf6e8;border-color:rgba(245,226,190,.62);background:rgba(56,34,20,.82);}
.bridge-back svg{width:17px;height:17px;}
@media (max-width:900px){.bridge-back{left:14px;top:10px;font-size:12.5px;padding:6px 11px 6px 8px;}}
`;

function injectStyle() {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);
}

function bindCartButtons(product) {
  const cartButton = document.getElementById('cartBtn');
  const buyButton = document.getElementById('buy');
  const counter = document.getElementById('cartN');

  const handle = (event) => {
    event.preventDefault();
    event.stopPropagation();
    addToCart(product.id, 1);
  };

  cartButton?.addEventListener('click', handle, true);
  buyButton?.addEventListener('click', handle, true);

  // 页面自己会把计数 +1，这里始终用共享购物篮的真实数量覆盖
  subscribe(() => {
    if (!counter) return;
    counter.textContent = String(cartCount());
  });
  if (counter) {
    const observer = new MutationObserver(() => {
      const truth = String(cartCount());
      if (counter.textContent !== truth) counter.textContent = truth;
    });
    observer.observe(counter, { childList: true, characterData: true, subtree: true });
  }
}

const product = currentProduct();
if (product) {
  injectStyle();
  buildBackLink();
  bindCartButtons(product);
}
