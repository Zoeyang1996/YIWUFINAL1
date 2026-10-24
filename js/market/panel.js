import { catalogueFor, productLink } from '../data/shop-catalogues.js';
import { formatPrice, getProduct } from '../data/products.js';

/** 右侧的商品展示栏：点开摊位后滑出 */

export function createPanel({ onAdd, onOpen, phase }) {
  const root = document.getElementById('stallPanel');
  const keeperEl = root.querySelector('.panel-keeper');
  const nameEl = root.querySelector('.panel-name');
  const lineEl = root.querySelector('.panel-line');
  const listEl = root.querySelector('.panel-list');
  const closeButton = root.querySelector('.panel-close');

  let open = false;

  function renderProducts(stall) {
    const models = stall.products.map(getProduct).filter(product => product?.model);
    if (models.length) {
      listEl.replaceChildren();
      const heading = document.createElement('p'); heading.className = 'catalogue-heading'; heading.textContent = '铺 中 好 物'; listEl.append(heading);
      for (const product of models) {
        const card = document.createElement('button'); card.type = 'button'; card.className = 'panel-model-card';
        card.dataset.act = 'open'; card.dataset.id = product.id;
        const image = document.createElement('img'); image.src = product.thumbnail; image.alt = product.name;
        const title = document.createElement('h3'); title.textContent = product.name;
        const description = document.createElement('p'); description.textContent = product.blurb;
        const footer = document.createElement('span'); footer.textContent = `¥${formatPrice(product.price)}　·　拿起看看 ↗`;
        card.append(image, title, description, footer); listEl.append(card);
      }
      return;
    }
    const catalogue = catalogueFor(phase, stall.id);
    if (catalogue.length) {
      listEl.replaceChildren();
      const heading = document.createElement('p'); heading.className = 'catalogue-heading'; heading.textContent = '铺 中 好 物'; listEl.append(heading);
      catalogue.forEach((item, index) => {
        const card = document.createElement('article'); card.className = 'panel-card catalogue-card';
        const glyph = document.createElement('div'); glyph.className = 'card-glyph'; glyph.textContent = item.glyph;
        const number = document.createElement('small'); number.className = 'catalogue-number'; number.textContent = String(index + 1).padStart(2, '0');
        const title = document.createElement('h4'); title.textContent = item.name;
        const description = document.createElement('p'); description.className = 'card-blurb'; description.textContent = item.description;
        const href = productLink(item.href);
        const link = document.createElement(href ? 'a' : 'span'); link.className = href ? 'catalogue-link' : 'catalogue-pending';
        link.textContent = href ? '查看商品 ↗' : '商品详情 · 敬请期待';
        if (href) link.href = href;
        card.append(number, glyph, title, description, link); listEl.append(card);
      });
      return;
    }
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
    root.inert = false;
    root.classList.add('is-open');
    closeButton.focus({ preventScroll: true });
    root.setAttribute('aria-hidden', 'false');
    open = true;
  }

  function hide() {
    root.inert = true;
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
    if (button.dataset.act === 'open') onOpen?.(product, button);
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
