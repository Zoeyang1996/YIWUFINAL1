import { formatPrice, getProduct } from '../data/products.js';

/** 右侧的商品展示栏：点开摊位后滑出 */

export function createPanel({ onAdd, onOpen }) {
  const root = document.getElementById('stallPanel');
  const keeperEl = root.querySelector('.panel-keeper');
  const nameEl = root.querySelector('.panel-name');
  const lineEl = root.querySelector('.panel-line');
  const listEl = root.querySelector('.panel-list');
  const closeButton = root.querySelector('.panel-close');

  let open = false;

  function renderProducts(stall) {
    if (!stall.products.length) {
      listEl.innerHTML = `
        <div class="panel-empty">
          <span>今 日 无 货</span>
          <small>${stall.line}</small>
        </div>`;
      return;
    }

    listEl.innerHTML = stall.products
      .map((id) => getProduct(id))
      .filter(Boolean)
      .map(
        (product) => `
        <article class="panel-card" data-id="${product.id}">
          <div class="card-glyph">${product.glyph}</div>
          <div class="card-main">
            <h4>${product.name}</h4>
            <p class="card-sub">${product.subtitle}</p>
            <p class="card-blurb">${product.blurb}</p>
          </div>
          <div class="card-side">
            <div class="card-price">
              <b>¥${formatPrice(product.price)}</b>
              <s>¥${formatPrice(product.originPrice)}</s>
            </div>
            <button type="button" class="card-add" data-act="add" data-id="${product.id}">加入购物车</button>
            <button type="button" class="card-open" data-act="open" data-id="${product.id}">看 细 节</button>
          </div>
        </article>`
      )
      .join('');
  }

  function show(stall) {
    nameEl.textContent = stall.name;
    keeperEl.textContent = stall.keeper;
    lineEl.textContent = `「${stall.line}」`;
    renderProducts(stall);
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');
    open = true;
  }

  function hide() {
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    open = false;
  }

  listEl.addEventListener('click', (event) => {
    const button = event.target.closest('[data-act]');
    if (!button) return;
    const product = getProduct(button.dataset.id);
    if (!product) return;
    if (button.dataset.act === 'add') onAdd?.(product);
    if (button.dataset.act === 'open') onOpen?.(product);
  });

  closeButton.addEventListener('click', () => onOpen?.(null));

  return {
    show,
    hide,
    get isOpen() {
      return open;
    },
  };
}
