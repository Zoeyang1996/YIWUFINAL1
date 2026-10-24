/**
 * 三个时段：总览模型、氛围配色、以及各自市集里的摊位布点。
 * slot 决定摊位在街上的位置，见 js/market/layout.js
 */
const STALL_ROOT = {
  morning: '资产包/首页/早/二级场景/三级店铺',
  noon: '资产包/首页/午/二级场景/三级店铺',
  night: '资产包/首页/夜/二级场景/三级店铺',
};

export const PHASE_ORDER = ['morning', 'noon', 'night'];

export const PHASES = {
  morning: {
    id: 'morning',
    name: '早市',
    glyph: '早',
    hourLabel: '卯时',
    tagline: '天光初开，蒸汽先醒',
    intro: '辰光刚爬上瓦檐，第一笼点心已经出屉。',
    overviewModel: '资产包/首页/早/zao.glb',
    palette: {
      sky: '#e8dcc5',
      skyDeep: '#c3b195',
      fog: '#d9ccb4',
      ink: '#3b2f22',
      accent: '#b1622f',
      glow: '#ffd8a0',
    },
    stalls: [
      {
        id: 'fans', name: '清风扇铺', keeper: '扇铺掌柜',
        line: '客官来啦，挑一把扇子，把清风带回家。',
        products: ['morningFan'],
      },
      {
        id: 'breakfast',
        name: '早餐摊',
        keeper: '阿婆',
        line: '刚出屉的，趁热拿。',
        model: `${STALL_ROOT.morning}/早餐摊/早餐摊贩.glb`,
        side: 'left',
        slot: 0,
        products: ['toastFigure'],
      },
      {
        id: 'tea',
        name: '茶水摊',
        keeper: '老周',
        line: '坐一坐，喝完再走。',
        model: `${STALL_ROOT.morning}/茶水摊/茶水摊贩.glb`,
        side: 'right',
        slot: 0,
        products: ['milkCupMorning'],
      },
      {
        id: 'toys',
        name: '玩具摊',
        keeper: '小满',
        line: '挑一个吧，会转的那种。',
        model: `${STALL_ROOT.morning}/玩具摊/玩具摊贩.glb`,
        side: 'left',
        slot: 1,
        products: ['acornString'],
      },
      {
        id: 'sundries',
        name: '杂物摊',
        keeper: '无名',
        line: '针头线脑，样样都有。',
        model: `${STALL_ROOT.morning}/杂物摊/杂物摊贩.glb`,
        side: 'right',
        slot: 1,
        products: [],
        decor: true,
      },
    ],
  },

  noon: {
    id: 'noon',
    name: '午市',
    glyph: '午',
    hourLabel: '午时',
    tagline: '日正当中，市声最盛',
    intro: '日头把青石板晒得发烫，叫卖声一层压一层。',
    overviewModel: '资产包/首页/午/noon.glb?v=overview-20261022',
    palette: {
      sky: '#f1e3c4',
      skyDeep: '#d2b787',
      fog: '#e7d5ac',
      ink: '#43301c',
      accent: '#a8452a',
      glow: '#fff0c8',
    },
    stalls: [
      { id: 'fans', name: '竹韵扇子铺', keeper: '沈娘', line: '竹骨纸面，摇一扇午后的清风。', products: [] },
      { id: 'daily', name: '日用品小铺', keeper: '阿绣', line: '柴米之外，过日子的细巧都在这里。', products: [] },
      { id: 'grocery', name: '街角杂货铺', keeper: '陈掌柜', line: '针线、绳结、小木器，慢慢挑。', products: [] },
      { id: 'tea-noon', name: '午荫茶水铺', keeper: '老周', line: '檐下歇歇脚，先喝一盏茶。', products: [] },
      { id: 'ceramics', name: '汝青瓷坊', keeper: '青禾', line: '一碗一盏，盛下寻常日子的温润。', products: [] },
      { id: 'incense', name: '清供香铺', keeper: '林师傅', line: '一缕清香，半日闲心。', products: [] },
    ],
  },

  night: {
    id: 'night',
    name: '夜市',
    glyph: '夜',
    hourLabel: '戌时',
    tagline: '灯火初上，人影被拉长',
    intro: '灯笼一盏一盏亮起来，整条街忽然有了温度。',
    overviewModel: '资产包/首页/夜/evening.glb?v=overview-20261022',
    palette: {
      sky: '#0a1220',
      skyDeep: '#05080f',
      fog: '#0a1220',
      ink: '#e8dcc6',
      accent: '#d9642c',
      glow: '#ffb457',
    },
    stalls: [
      {
        id: 'lanterns',
        name: '花灯摊',
        keeper: '灯姐',
        line: '挑一盏吧，会一直亮到天亮。',
        model: `${STALL_ROOT.night}/花灯摊/ye3.glb`,
        side: 'left',
        slot: 0,
        products: [],
      },
      {
        id: 'antiques',
        name: '古董摊',
        keeper: '裴掌柜',
        line: '这件东西，比我年纪大。',
        model: `${STALL_ROOT.night}/古董摊/古董铺.glb`,
        side: 'right',
        slot: 0,
        products: [],
      },
      {
        id: 'brew',
        name: '酿酒杂货摊',
        keeper: '酒翁',
        line: '喝一口，暖到手指头。',
        model: `${STALL_ROOT.night}/酿酒杂货摊/ye4.glb`,
        side: 'left',
        slot: 1,
        products: [],
      },
      {
        id: 'craft',
        name: '手作摊',
        keeper: '阿木',
        line: '今天还没做出满意的。',
        model: `${STALL_ROOT.night}/手作摊/ye1.glb`,
        side: 'right',
        slot: 1,
        products: [],

      },
    ],
  },
};

export function getPhase(id) {
  return PHASES[id] ?? PHASES.morning;
}

export function phaseFromQuery() {
  const value = new URLSearchParams(location.search).get('phase');
  return PHASE_ORDER.includes(value) ? value : 'morning';
}
