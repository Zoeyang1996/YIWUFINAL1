/**
 * 分享链接的 sharecode 参数是访问凭证：不带它访问会返回 403。
 * 因此页面内所有「站内」跳转都必须把 sharecode 一并带上，
 * 否则用户从首页进入二级页（market.html / shop.html / 商品详情页）时会掉链。
 *
 * 用法：
 *   import { withShare } from '../core/nav.js';
 *   location.href = withShare('market.html?phase=morning');
 *
 * 本模块一旦被某个入口加载，还会自动给当前页面里所有站内 <a> 链接补上 sharecode，
 * 因此 HTML 里硬编码的链接（如 phaseNav、marketBack）无需逐一改写。
 */
const SHARE_KEY = 'sharecode';

function currentShare() {
  if (typeof location === 'undefined') return null;
  return new URLSearchParams(location.search).get(SHARE_KEY);
}

export function withShare(url) {
  if (url == null || url === '') return url;
  if (typeof location === 'undefined') return url;
  const share = currentShare();
  if (!share) return url;
  // 锚点 / JS 伪协议不动
  if (url[0] === '#' || url.startsWith('javascript:')) return url;
  // 跨域外链不动
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    try {
      if (new URL(url, location.href).origin !== location.origin) return url;
    } catch {
      return url;
    }
  }
  // 已带 sharecode 不重复追加
  if (new RegExp('[?&]' + SHARE_KEY + '=').test(url)) return url;
  const sep = url.indexOf('?') >= 0 ? '&' : '?';
  return url + sep + SHARE_KEY + '=' + encodeURIComponent(share);
}

// 自动修补当前页面所有站内 <a> 链接
if (typeof document !== 'undefined') {
  const patchLinks = () => {
    document.querySelectorAll('a[href]').forEach((a) => {
      const href = a.getAttribute('href');
      if (!href) return;
      const next = withShare(href);
      if (next !== href) a.setAttribute('href', next);
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchLinks);
  } else {
    patchLinks();
  }
}
