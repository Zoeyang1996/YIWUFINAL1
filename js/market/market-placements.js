/** Front-of-counter positions in the updated October 27 GLBs (Three.js Y-up).
 * IDs remain stable so existing shop links still work. */
export const MARKET_PLACEMENTS = {
  morning: {
    tea: { node: '01 茶器摊铺 总控', position: [-12, 1.293, 12.3], normal: [1, 0, 0], keeper: [-10.8, 1.293, 11.5], distance: 5.5 },
    toys: { node: 'Shop_toys', position: [-12.85, 1.293, -4.31], normal: [1, 0, 0], keeper: [-11.9, 1.293, -5.1], distance: 5.8 },
    breakfast: { node: 'Authored_026_01 早餐摊', position: [-3.8, 1.293, -6.3], normal: [-1, 0, 0], keeper: [-4.7, 1.293, -5.6], distance: 5.4 },
  },
  noon: {
    fans: { node: '扇子铺', position: [-8.38, .15, 10.63], normal: [0, 0, -1], keeper: [-9.8, .15, 8.8], distance: 6 },
    grocery: { node: '杂货铺', position: [5.63, .15, -16.66], normal: [-.02627, 0, .99966], keeper: [4.6, .15, -15.2], distance: 6 },
    incense: { node: 'N16_香囊铺 · 总控', position: [10, .15, -8.85], normal: [0, 0, 1], keeper: [9.3, .15, -8.15], distance: 5.5 },
  },
  night: {
    antiques: { node: 'Shop_antiques', position: [-17, 5.24, -11], normal: [0, 0, 1], keeper: [-17, 5.24, -11.9], distance: 5.8 },
    lanterns: { node: 'Shop_lanterns', position: [-10, 5.24, -12], normal: [0, 0, 1], keeper: [-8.2, 5.24, -10.5], distance: 6.2 },
    brew: { node: 'Shop_brew', position: [-14, 2.24, 17], normal: [0, 0, -1], keeper: [-15.7, 2.24, 15.6], distance: 6 },
  },
};

export function authoredNode(root, name) {
  let found;
  root.traverse(node => { if ((node.userData.name ?? node.name) === name) found = node; });
  return found;
}
