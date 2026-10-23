/** 商品链接预留在 href；填入相对页面路径或 https 地址后，店内会显示「查看商品」。 */
export const SHOP_CATALOGUES = {
  'noon/fans': [
    { name: '竹骨折扇', glyph: '扇', description: '竹骨舒展，素纸留白。', href: null },
    { name: '绢面团扇', glyph: '绢', description: '细绢与木柄，收一缕清风。', href: null },
  ],
  'noon/daily': [
    { name: '日用竹篮', glyph: '篮', description: '细篾编就，装下市集里的一日所得。', href: null },
    { name: '棉麻手巾', glyph: '布', description: '朴素织物，柔软耐用。', href: null },
  ],
  'noon/grocery': [
    { name: '针线小匣', glyph: '线', description: '一匣针线，缝补寻常岁月。', href: null },
    { name: '木梳与绳结', glyph: '梳', description: '木纹温润，小物也有手作的心思。', href: null },
  ],
  'noon/tea-noon': [
    { name: '午荫清茶', glyph: '茶', description: '一壶新沏的茶，留给停步的人。', href: null },
    { name: '粗陶茶盏', glyph: '盏', description: '掌心大小，盛茶正好。', href: null },
  ],
  'noon/ceramics': [
    { name: '青釉小碗', glyph: '瓷', description: '青釉映着日光，细看各有纹理。', href: null },
    { name: '素面花器', glyph: '瓶', description: '插一枝花，也安放一份闲适。', href: null },
  ],
  'noon/incense': [
    { name: '草木线香', glyph: '香', description: '檐下清供，气息悠长。', href: null },
    { name: '陶制香托', glyph: '陶', description: '小小一方，承住袅袅烟气。', href: null },
  ],
  'night/lanterns': [
    { name: '暖纸花灯', glyph: '灯', description: '沿着山路，把一盏暖光带回家。', href: null },
    { name: '竹编小灯', glyph: '竹', description: '灯影穿过竹篾，落成细碎星光。', href: null },
  ],
  'night/antiques': [
    { name: '旧时铜器', glyph: '铜', description: '岁月在铜色里留下温润的痕迹。', href: null },
    { name: '案头旧物', glyph: '古', description: '听掌柜讲一段物件的往事。', href: null },
  ],
  'night/brew': [
    { name: '陶坛佳酿', glyph: '酿', description: '山风微凉，酒香自暖。', href: null },
    { name: '温酒小盏', glyph: '杯', description: '与友人对坐，共赏街灯。', href: null },
  ],
  'night/craft': [
    { name: '木雕小物', glyph: '木', description: '一刀一刻，留下手作的温度。', href: null },
    { name: '编绳挂饰', glyph: '结', description: '将夜市的一点心意系在身边。', href: null },
  ],
};
export function catalogueFor(phase, shop) { return SHOP_CATALOGUES[`${phase}/${shop}`] ?? []; }
export function productLink(href) {
  if (typeof href !== 'string' || !href.trim()) return null;
  const value = href.trim();
  if (/^(https?:\/\/|\.?\.?\/)/i.test(value) || !/[:\\]/.test(value)) return value;
  return null;
}
