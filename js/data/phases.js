/** 九个可访摊位与 assets/商品 的目录一一对应；其他建筑保留为街景。 */
export const PHASE_ORDER = ['morning', 'noon', 'night'];
export const PHASES = {
  "morning": {
    "id": "morning",
    "name": "早市",
    "glyph": "早",
    "hourLabel": "卯时",
    "tagline": "天光初开，蒸汽先醒",
    "intro": "辰光刚爬上瓦檐，第一笼点心已经出屉。",
    "overviewModel": "资产包/首页/早/zao.glb?v=restored-20261030",
    "palette": {
      "sky": "#e8dcc5",
      "skyDeep": "#c3b195",
      "fog": "#d9ccb4",
      "ink": "#3b2f22",
      "accent": "#b1622f",
      "glow": "#ffd8a0"
    },
    "stalls": [
      {
        "id": "tea",
        "name": "茶水摊",
        "keeper": "老周",
        "line": "坐一坐，喝盏茶，挑一只合手的杯。",
        "products": [
          "milkCupMorning"
        ],
        "npc": "assets/NPCcharacter/早市/茶馆摊主（早市）.glb",
        "rig": "Armature"
      },
      {
        "id": "toys",
        "name": "木铃摊",
        "keeper": "小满",
        "line": "木铃轻响，瓷章留印，带一份小小的欢喜。",
        "products": [
          "woodBell",
          "ceramicSeal"
        ],
        "npc": "assets/NPCcharacter/早市/玩具摊主（早市.glb",
        "rig": "Armature.001"
      },
      {
        "id": "breakfast",
        "name": "早餐摊",
        "keeper": "阿婆",
        "line": "早点趁热，也挑只盛早餐的小碟吧。",
        "products": [
          "toastFigure"
        ],
        "npc": "assets/NPCcharacter/早市/早餐摊主（早市）.glb",
        "rig": "Armature.002"
      }
    ]
  },
  "noon": {
    "id": "noon",
    "name": "午市",
    "glyph": "午",
    "hourLabel": "午时",
    "tagline": "日正当中，市声最盛",
    "intro": "日头把青石板晒得发烫，叫卖声一层压一层。",
    "overviewModel": "资产包/首页/午/noon.glb?v=restored-20261030",
    "palette": {
      "sky": "#f1e3c4",
      "skyDeep": "#d2b787",
      "fog": "#e7d5ac",
      "ink": "#43301c",
      "accent": "#a8452a",
      "glow": "#fff0c8"
    },
    "stalls": [
      {
        "id": "fans",
        "name": "扇子摊",
        "keeper": "沈娘",
        "line": "摇一扇午后的清风。",
        "products": [
          "noonFan"
        ],
        "npc": "assets/NPCcharacter/午市/扇子摊主（午市）.glb",
        "rig": "Armature.002"
      },
      {
        "id": "grocery",
        "name": "杂货摊",
        "keeper": "陈掌柜",
        "line": "花纹袜子、小猫陶罐，日子里的细巧都在这里。",
        "products": [
          "flowerSock",
          "catJar"
        ],
        "npc": "assets/NPCcharacter/午市/日用品摊主（午市）.glb",
        "rig": "Armature"
      },
      {
        "id": "incense",
        "name": "香囊摊",
        "keeper": "林师傅",
        "line": "一缕线香，一盏香烛，慢慢挑。",
        "products": [
          "incenseStick",
          "boneCandle"
        ],
        "npc": "assets/NPCcharacter/午市/香铺摊主（午市）.glb",
        "rig": "Armature.001"
      }
    ]
  },
  "night": {
    "id": "night",
    "name": "夜市",
    "glyph": "夜",
    "hourLabel": "戌时",
    "tagline": "灯火初上，人影被拉长",
    "intro": "灯笼一盏一盏亮起来，整条街忽然有了温度。",
    "overviewModel": "资产包/首页/夜/evening.glb?v=restored-20261030",
    "palette": {
      "sky": "#0a1220",
      "skyDeep": "#05080f",
      "fog": "#0a1220",
      "ink": "#e8dcc6",
      "accent": "#d9642c",
      "glow": "#ffb457"
    },
    "stalls": [
      {
        "id": "antiques",
        "name": "古董摊",
        "keeper": "裴掌柜",
        "line": "钟声与拼图，都藏着旧时光。",
        "products": [
          "hundredClocks",
          "cloudEight"
        ],
        "npc": "assets/NPCcharacter/夜市/古董摊主（夜市）.glb",
        "rig": "Armature.001"
      },
      {
        "id": "lanterns",
        "name": "花灯摊",
        "keeper": "灯姐",
        "line": "挑一盏星光，把夜色带回家。",
        "products": [
          "hatLamp"
        ],
        "npc": "assets/NPCcharacter/夜市/灯笼摊主（夜市）.glb",
        "rig": "Armature.002"
      },
      {
        "id": "brew",
        "name": "酿酒摊",
        "keeper": "酒翁",
        "line": "一杯佳酿，一器星光，坐下聊聊吧。",
        "products": [
          "starGoblet"
        ],
        "npc": "assets/NPCcharacter/夜市/买酒摊主（夜市.glb",
        "rig": "Armature"
      }
    ]
  }
};
export function getPhase(id) { return PHASES[id] ?? PHASES.morning; }
export function phaseFromQuery() { const id = new URLSearchParams(location.search).get('phase'); return PHASE_ORDER.includes(id) ? id : 'morning'; }
