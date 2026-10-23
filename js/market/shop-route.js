/** Real, reloadable third-level URLs; navigation stays in the same WebGL scene. */
import { withShare } from '../core/nav.js';

export function shopUrl(phase, shop = null) {
  const query = new URLSearchParams({ phase });
  if (shop) query.set('shop', shop);
  return withShare(`${shop ? 'shop' : 'market'}.html?${query}`);
}
export function requestedShop(search, stalls) {
  const id = new URLSearchParams(search).get('shop');
  return stalls.find(stall => stall.id === id)?.id ?? null;
}
