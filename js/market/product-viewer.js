import { sound } from '../core/audio.js';
import * as THREE from 'three';
import { ProductControls } from './product-controls.js';
import { loadGltf } from '../core/loader.js';
import { assetUrl, formatPrice } from '../data/products.js';
import { addToCart } from '../cart/store.js';
import { showToast } from '../cart/ui.js';

let sharedViewer;
/** One reusable viewer: scene focus stays untouched while the fourth level is open. */
export function createProductViewer() {
  if (sharedViewer) return sharedViewer;
  const root = document.createElement('div');
  root.className = 'product-overlay'; root.hidden = true;
  root.innerHTML = `
    <section class="product-window" role="dialog" aria-modal="true" aria-labelledby="productTitle" tabindex="-1">
      <div class="product-stage">
        <span class="product-eyebrow">市 集 好 物 / 360°</span>
        <div class="product-canvas" aria-label="商品三维预览"></div>
        <span class="product-stage-seal" aria-hidden="true">手作<br>拾珍</span>
        <p class="product-loading" role="status">正在呈上好物…</p>
        <div class="product-view-tools"><span>拖拽旋转 · 滚轮缩放</span><button type="button" class="product-reset">重置视角</button></div>
      </div>
      <aside class="product-info">
        <button type="button" class="product-close" aria-label="关闭商品详情">×</button>
        <div class="product-copy" tabindex="0" aria-label="商品介绍与规格"><p class="product-shop"></p><h2 id="productTitle"></h2><p class="product-subtitle"></p>
        <p class="product-description"></p><dl class="product-specs"></dl></div>
        <div class="product-purchase"><span class="product-price"></span><small>每件 · 市集价</small>
          <div class="product-actions"><button type="button" class="product-buy">收入市集篮</button>
          <button type="button" class="product-cart" aria-label="查看购物车"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h2l2.4 12h11L20 8H6"/><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg></button></div>
        </div>
      </aside>
    </section><p class="product-dismiss-hint">点击窗外，回到摊前</p>`;
  document.body.append(root);
  const dialog = root.querySelector('.product-window');
  const mount = root.querySelector('.product-canvas');
  const status = root.querySelector('.product-loading');
  const buy = root.querySelector('.product-buy');
  let renderer, scene, camera, controls, model, current, returnFocus, request = 0;
  let isOpen = false, flying = false, afterClose = null, panelWasInert = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  function resize() {
    if (!renderer || !isOpen) return;
    const { width, height } = mount.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(height, 1); camera.updateProjectionMatrix();
  }
  function resetView() {
    if (!camera) return;
    if (model) model.rotation.set(0, 0, 0);
    const distance = Math.max(4, 2.5 / Math.max(camera.aspect, .5));
    controls.reset();
    camera.position.set(0, .08, distance); controls.target.set(0, 0, 0);
    controls.update();
  }
  function initialize() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', '拖拽旋转商品，方向键旋转，Home 重置视角');
    mount.append(renderer.domElement);
    scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff5e2, 0x857865, 2.5));
    const key = new THREE.DirectionalLight(0xffefd9, 3.2); key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 2); fill.position.set(-3, 1, -4); scene.add(fill);
    camera = new THREE.PerspectiveCamera(38, 1, .01, 50);
    controls = new ProductControls(camera, renderer.domElement);
    controls.enableDamping = !reduced.matches;
    controls.minDistance = 2.1; controls.maxDistance = 9;
    renderer.domElement.addEventListener('keydown', event => {
      if (event.key === 'Home') resetView();
      else if (model && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        if (['ArrowLeft','ArrowRight'].includes(event.key)) model.rotation.y += event.key === 'ArrowLeft' ? -.12 : .12;
        else model.rotation.x += event.key === 'ArrowUp' ? -.12 : .12;
      }
    });
  }
  function close({ restoreFocus = true, notify = true } = {}) {
    if (!isOpen) return;
    sound.play('close');
    isOpen = false; ++request; root.hidden = true;
    renderer?.setAnimationLoop(null);
    document.body.classList.remove('is-product-open');
    const panel = document.getElementById('stallPanel');
    if (panel) panel.inert = panelWasInert;
    const callback = afterClose; afterClose = null;
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    if (notify) callback?.();
  }
  async function open(product, opener = document.activeElement, { onClose = null } = {}) {
    sound.play('open');
    const panel = document.getElementById('stallPanel');
    if (!isOpen) panelWasInert = panel?.inert ?? true;
    current = product; returnFocus = opener; isOpen = true; afterClose = onClose;
    const token = ++request;
    root.hidden = false; document.body.classList.add('is-product-open');
    if (panel) panel.inert = true;
    root.dataset.texture = product.texture ?? 'ceramic';
    root.dataset.product = product.id;
    root.querySelector('#productTitle').textContent = product.name;
    root.querySelector('.product-shop').textContent = `${product.shop} / ${product.phaseName}精选`;
    root.querySelector('.product-subtitle').textContent = product.subtitle;
    root.querySelector('.product-description').textContent = product.description ?? product.blurb;
    root.querySelector('.product-price').textContent = `¥${formatPrice(product.price)}`;
    root.querySelector('.product-specs').replaceChildren(...(product.details ?? []).flatMap(([label, value]) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; return [dt, dd];
    }));
    buy.disabled = true; status.hidden = false; status.textContent = '正在呈上好物…';
    root.querySelector('.product-close').focus({ preventScroll: true });
    try {
      initialize();
      if (model) { scene.remove(model); model = null; }
      resize(); resetView();
      renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
      const gltf = await loadGltf(assetUrl(product.model) + `?v=${product.assetRevision ?? '20261030'}`);
      if (!isOpen || token !== request) return;
      model = new THREE.Group();
      const object = gltf.scene.clone(true);
      // Optional per-product orientation keeps this viewer reusable for other stalls.
      if (product.preview?.resetMeshRotation) object.children[0]?.quaternion.identity();
      if (product.preview?.rotation) object.rotation.set(...product.preview.rotation, 'ZYX');
      const bounds = new THREE.Box3().setFromObject(object), size = bounds.getSize(new THREE.Vector3());
      object.scale.multiplyScalar(2.65 / Math.max(size.x, size.y, size.z));
      bounds.setFromObject(object); object.position.sub(bounds.getCenter(new THREE.Vector3()));
      model.add(object); scene.add(model);
      status.hidden = true; buy.disabled = flying;
    } catch (error) {
      if (!isOpen || token !== request) return;
      console.error('商品预览加载失败', error);
      status.textContent = '模型暂时未能加载。';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重试';
      retry.addEventListener('click', () => open(product, returnFocus, { onClose: afterClose })); status.append(retry);
    }
  }
  async function purchase() {
    if (flying || !model || !current) return;
    const product = current;
    try { addToCart(product.id); } catch { showToast('购物车暂时无法保存，请重试'); return; }
    sound.play('success');
    flying = true; buy.disabled = true;
    let ghost;
    const target = document.querySelector('.cart-trigger');
    try {
      if (!reduced.matches && target) {
        renderer.render(scene, camera);
        ghost = document.createElement('img'); ghost.className = 'product-flying'; ghost.alt = '';
        ghost.src = renderer.domElement.toDataURL('image/png');
        const from = mount.getBoundingClientRect(), to = target.getBoundingClientRect();
        const width = Math.min(from.width, 320), height = width * from.height / from.width;
        Object.assign(ghost.style, { width: `${width}px`, height: `${height}px`, left: `${from.x + (from.width - width) / 2}px`, top: `${from.y + (from.height - height) / 2}px` });
        document.body.append(ghost);
        const x = to.x + to.width / 2 - (from.x + from.width / 2), y = to.y + to.height / 2 - (from.y + from.height / 2);
        await ghost.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${x * .2}px,${Math.min(-90, y * .15 - 90)}px) scale(.8) rotate(-12deg)`, opacity: 1, offset: .35 },
          { transform: `translate(${x}px,${y}px) scale(.08) rotate(12deg)`, opacity: .25 },
        ], { duration: 850, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' }).finished;
        target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }], { duration: 300 });
      }
      showToast(`${product.name}已放入购物车`);
    } finally { ghost?.remove(); flying = false; buy.disabled = !isOpen || !model; }
  }
  buy.addEventListener('click', purchase);
  root.querySelector('.product-cart').addEventListener('click', () => {
    close({ restoreFocus: false, notify: false });
    document.querySelector('.cart-trigger')?.click();
  });
  root.querySelector('.product-close').addEventListener('click', () => close());
  root.querySelector('.product-reset').addEventListener('click', () => { if (model) model.rotation.set(0, 0, 0); resetView(); });
  let outsideDown = false;
  root.addEventListener('pointerdown', e => { outsideDown = !dialog.contains(e.target); });
  root.addEventListener('click', e => { if (outsideDown && !dialog.contains(e.target)) close(); });
  document.addEventListener('keydown', e => {
    if (!isOpen || document.querySelector('.cart-drawer.is-open')) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    if (e.key === 'Tab') {
      const focusable = [...dialog.querySelectorAll('button:not(:disabled),[tabindex="0"]')];
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, true);
  new ResizeObserver(resize).observe(mount);
  sharedViewer = { open, close, get isOpen() { return isOpen; } };
  return sharedViewer;
}
