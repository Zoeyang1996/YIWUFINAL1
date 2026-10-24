/**
 * 九件市集好物。三级页面直接指向既有的全屏商品展示页。
 * href 相对于站点根目录。
 */
const BASE = '资产包/首页';

export const PRODUCTS = {
  morningFan: {
    id: 'morningFan', name: '清风红扇', glyph: '扇',
    subtitle: '一 扇 清 风 · 早 市 好 物', shop: '清风扇铺',
    price: 68, // 演示价格，正式售卖前替换为实际定价。
    blurb: '展开一面雅致扇影，把早市的悠闲与清风带在身边。',
    description: '绯红与米白相映，细密纹理铺满舒展的扇面。转到侧面，可以细看扇缘、环形握柄和垂落的绳饰。轻轻摇动，为日常添一份闲适；随身纳凉、案头陈设，都能留住一缕市集清风。',
    details: [['款式', '红色手持扇 / 环形握柄'], ['用途', '纳凉 / 陈设 / 赠礼'], ['养护', '避水防潮，轻拭收存']],
    model: 'assets/商品/扇子.glb', thumbnail: 'assets/商品/扇子-preview.png',
    preview: { resetMeshRotation: true, rotation: [Math.PI / 2, 0, -Math.PI / 2] },
  },
  toastFigure: {
    id: 'toastFigure',
    name: '吐司小人',
    glyph: '吐',
    subtitle: '陶 · 拟 人 吐 司 碟 · 手 作',
    shop: '童物集',
    price: 128,
    originPrice: 168,
    blurb: '一片没烤焦的吐司，忽然长出两条腿。看久了，心情会跟着软下来。',
    href: `${BASE}/早/二级场景/三级店铺/早餐摊/吐司蘸碟/吐司小人.html`,
  },
  acornString: {
    id: 'acornString',
    name: '橡果成串',
    glyph: '橡',
    subtitle: '麻 · 手 作 挂 件 · 成 十 二 枚',
    shop: '林间集',
    price: 168,
    originPrice: 220,
    blurb: '十二枚橡果，十二种帽檐。挂在窗边，风一过就轻轻相撞。',
    href: `${BASE}/早/二级场景/三级店铺/玩具摊/橡果串/橡果成串.html`,
  },
  milkCupMorning: {
    id: 'milkCupMorning',
    name: '奶白比心',
    glyph: '杯',
    subtitle: '陶 · 高 足 杯 · 手 作',
    shop: '素物记',
    price: 398,
    originPrice: 520,
    blurb: '杯身捏出一双交叠的手，捧起来的时候，像被谁稳稳托住。',
    href: `${BASE}/早/二级场景/三级店铺/茶水摊/陶瓷杯/白色陶瓷杯.html`,
  },
  milkCupNoon: {
    id: 'milkCupNoon',
    name: '奶白比心',
    glyph: '杯',
    subtitle: '陶 · 高 足 杯 · 手 作',
    shop: '素物记',
    price: 398,
    originPrice: 520,
    blurb: '杯身捏出一双交叠的手，捧起来的时候，像被谁稳稳托住。',
    href: `${BASE}/午/二级场景/三级店铺/扇子摊/红色扇子/白色陶瓷杯.html`,
  },
  cloudEight: {
    id: 'cloudEight',
    name: '云章八景',
    glyph: '章',
    subtitle: '珐 琅 · 八 景 拼 图 · 八 件',
    shop: '鎏金局',
    price: 688,
    originPrice: 880,
    blurb: '把一整座园林拆成八枚徽章，拼起来才是完整的旧时光。',
    href: `${BASE}/午/二级场景/三级店铺/杂货摊/八景小文物/云章八景.html`,
  },
  flowerSock: {
    id: 'flowerSock',
    name: '步步生花',
    glyph: '花',
    subtitle: '棉 · 油 画 花 卉 · 中 筒',
    shop: '素袜记',
    price: 58,
    originPrice: 78,
    blurb: '走一步开一朵。袜筒上的花是手绘的，所以每一双都不太一样。',
    href: `${BASE}/午/二级场景/三级店铺/日用小摊/袜子/步步生花.html`,
  },
  hundredClocks: {
    id: 'hundredClocks',
    name: '百珍时钟',
    glyph: '钟',
    subtitle: '藏 · 国 风 艺 术 座 钟 · 十 二 瓷 珍',
    shop: '百珍',
    price: 2680,
    originPrice: 3180,
    blurb: '钟面嵌十二枚瓷片，走一圈，就是十二个时辰慢慢过去。',
    href: `${BASE}/夜/二级场景/三级店铺/古董摊/时钟/百珍时钟.html`,
  },
  hatLamp: {
    id: 'hatLamp',
    name: '星语帽灯',
    glyph: '灯',
    subtitle: '灯 · 拼 装 式 巫 师 帽 氛 围 灯 · 星 饰',
    shop: '星语',
    price: 568,
    originPrice: 698,
    blurb: '帽尖垂下一串星子，亮起来时，墙上都是碎银一样的光斑。',
    href: `${BASE}/夜/二级场景/三级店铺/花灯摊/帽子灯/星语帽灯.html`,
  },
  boneCandle: {
    id: 'boneCandle',
    name: '粉骨熔心',
    glyph: '烛',
    subtitle: '蜡 · 骷 髅 香 薰 · 手 作',
    shop: '夜市造物',
    price: 188,
    originPrice: 248,
    blurb: '骷髅造型的香薰蜡烛，烧到一半会露出里面粉色的心。',
    href: `${BASE}/夜/二级场景/三级店铺/花灯摊/鬼蜡烛/粉骨熔心.html`,
  },
  starGoblet: {
    id: 'starGoblet',
    name: '沧海星杯',
    glyph: '琉',
    subtitle: '琉 · 手 工 吹 制 琉 璃 器 · 双 星',
    shop: '沧海',
    price: 1680,
    originPrice: 1980,
    blurb: '一器双星，是吹制时最难得的偶然。换一个角度，星光就换一处。',
    href: `${BASE}/夜/二级场景/三级店铺/酿酒杂货摊/玻璃杯/沧海星杯.html`,
  },
};

/** 把资产包里的中文路径转成可直接放进 src/href 的形式 */
export function assetUrl(path) {
  return encodeURI(path);
}

export function getProduct(id) {
  return PRODUCTS[id] ?? null;
}

export function formatPrice(value) {
  return value >= 1000 ? value.toLocaleString('zh-CN') : String(value);
}
