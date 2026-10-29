from pathlib import Path
from shutil import copyfile
import yaml

ROOT = Path('/Users/yangzhe/Documents/GitHub/YIWUFINAL1')
WORK = ROOT / 'ppt_work'
DECK = WORK / 'yiwu_defense'
MEDIA = DECK / 'media'
PAGES = DECK / 'pages'
MEDIA.mkdir(parents=True, exist_ok=True)
PAGES.mkdir(parents=True, exist_ok=True)

up = WORK / '义乌市集ppt制作'
web = up / '.lark-slides/template/yiwu-market/assets'
team = up / '团队日常'
assets = ROOT / 'assets/products'

mapping = {
    web/'image1.png': 'market-morning.png',
    web/'image2.png': 'market-noon.png',
    web/'image3.png': 'market-night.png',
    web/'map-top.png': 'map-top.png',
    web/'street-front.png': 'street-front.png',
    web/'street-persp.png': 'street-persp.png',
    web/'image5.png': 'market-entry.png',
    web/'image8.png': 'market-gate.png',
    web/'npc-girl-blender.png': 'npc-girl-blender.png',
    web/'npc-elder-tripo.png': 'npc-elder-tripo.png',
    web/'sketch-girl.jpg': 'sketch-girl.jpg',
    web/'sketch-mortar.jpg': 'sketch-mortar.jpg',
    web/'outline-hand.jpg': 'outline-hand.jpg',
    up/'大赛命题要求.jpg': 'competition.jpg',
    WORK/'references/qingming.jpg': 'qingming.jpg',
    WORK/'references/gusu.jpg': 'gusu.jpg',
    WORK/'references/jiangnan.jpg': 'jiangnan.jpg',
    ROOT/'previews/markets/fan-stall-browser.png': 'fan-stall.png',
    ROOT/'previews/markets/fan-product-browser.png': 'fan-product.png',
    team/'讨论过程/22d026891fdb45ec1be89b92abcc8386.jpg': 'team-discuss-1.jpg',
    team/'讨论过程/66a68a535b671d07733362030fdd1eef.jpg': 'team-discuss-2.jpg',
    team/'讨论过程/66b8bef3cf9e5b55511639b61e767564.jpg': 'team-discuss-3.jpg',
    team/'绘画过程/64264866aa066568ef6f16f01b209806.jpg': 'team-sketch-1.jpg',
    team/'绘画过程/1a1b0c68ff493ffd5ca72d3836866a42.jpg': 'team-sketch-2.jpg',
    team/'绘画过程/cbb5b224864e5d4828d3042e50279d64.jpg': 'team-sketch-3.jpg',
    team/'绘画过程/818ed63a10c580e2c7b31a5001dd2928.jpg': 'team-sketch-4.jpg',
    team/'大纲/11021042e57d139b8aa6ac65cbba9606.jpg': 'team-outline.jpg',
    team/'场景制作过程/屏幕截图 2026-10-28 185333.png': 'scene-color.png',
    team/'场景制作过程/屏幕截图 2026-10-28 185812.png': 'scene-white.png',
    team/'场景制作过程/屏幕截图 2026-10-28 190542.png': 'scene-top.png',
    team/'场景制作过程/屏幕截图 2026-10-28 190237.png': 'scene-night.png',
    team/'场景制作过程/屏幕截图 2026-10-28 192748.png': 'scene-front.png',
    team/'人物和商品的制作过程/屏幕截图 2026-10-28 193737.png': 'npc-girl.png',
    team/'人物和商品的制作过程/屏幕截图 2026-10-28 193847.png': 'npc-hat.png',
    team/'人物和商品的制作过程/屏幕截图 2026-10-28 194136.png': 'product-cup-process.png',
    team/'人物和商品的制作过程/屏幕截图 2026-10-28 194021.png': 'product-clock-process.png',
}
for name in ['noonFan','woodBell','cloudEight','starGoblet','flowerSock','milkCupMorning','catJar','toastFigure','boneCandle','hundredClocks','hatLamp','incenseStick','ceramicSeal']:
    mapping[assets/f'{name}.png'] = f'product-{name}.png'
for src, dst in mapping.items():
    if not src.exists():
        raise FileNotFoundError(src)
    copyfile(src, MEDIA/dst)

C = {
    'paper': '#F4F0E6', 'paper2': '#E9E1D2', 'ink': '#191A17',
    'muted': '#6E6A61', 'red': '#A6412D', 'line': '#C8BFAF',
    'night': '#0B1520', 'night2': '#132638', 'cream': '#F4E8CF',
    'gold': '#D99A52', 'white': '#FFFFFF', 'morning': '#B87345'
}
FONT = 'MiSans'

def fill(color): return {'type':'solid','color':color}
def txt(eid, text, b, size=20, color='$ink', bold=False, align=('left','top'), lh=1.15, ls=0, wrap=True, rotation=None):
    e = {'elementId':eid,'elementType':'text','bounds':b,
         'content':{'text':text,'fontSize':size,'fontFamily':FONT,'color':color,'bold':bold,
                    'align':list(align),'lineHeight':lh,'letterSpacing':ls,'wrap':wrap}}
    if rotation is not None: e['rotation'] = rotation
    return e

def img(eid, src, b, mode='cover', crop=None, opacity=None, rotation=None, border=None):
    e = {'elementId':eid,'elementType':'image','bounds':b,'src':f'media/{src}','fit':{'mode':mode}}
    if crop: e['crop'] = crop
    if opacity is not None: e['opacity'] = opacity
    if rotation is not None: e['rotation'] = rotation
    if border: e['border'] = border
    return e

def rect(eid,b,color,border=None,opacity=None):
    e={'elementId':eid,'elementType':'shape','bounds':b,'shapeName':'rect','fill':fill(color)}
    if border: e['border']=border
    if opacity is not None: e['opacity']=opacity
    return e

def line(eid,b,color='$line',width=1,points='0,0 1,0'):
    return {'elementId':eid,'elementType':'line','bounds':b,'viewBox':[1,1],'points':points,'curve':'sharp','border':{'style':'solid','width':width,'color':color}}

def page(num, bg='$paper', elements=None, ptype='content'):
    return {'pageType':ptype,'background':fill(bg),'elements':elements or []}

def meta(num, section, dark=False):
    color = '$cream' if dark else '$muted'
    return [txt('meta',f'{num:02d}  /  {section}',[48,24,450,18],10,color,False,ls=1.5,wrap=False),
            txt('brand','义犹未尽 · 义乌三时市集',[690,24,222,18],10,color,False,('right','top'),1.15,1.0,False)]

pages=[]
# 01 Cover
es=[rect('red-band',[0,0,14,540],'$red'),
    txt('kicker','THREE.JS  ·  IMMERSIVE WEB EXHIBITION',[52,44,560,22],11,'$muted',False,ls=1.7,wrap=False),
    txt('title','一日三市\n义犹未尽',[50,104,500,190],64,'$ink',True,lh=.98),
    txt('sub','义乌三时市集 · 项目答辩',[54,324,380,32],20,'$red',True,wrap=False),
    line('cover-line',[54,382,280,2],'$ink',2),
    txt('desc','早市 / 午市 / 夜市\n可进入、可漫游、可选购的国风三维市集',[54,404,390,62],17,'$muted',False,lh=1.5),
    img('hero','market-morning.png',[470,48,460,450],'contain'),
    txt('seal','义',[846,454,48,48],28,'$red',True,('center','middle'),wrap=False)]
pages.append(('01_cover.page',page(1,elements=es,ptype='cover')))

# 02 Brief
es=meta(2,'命题理解')+[
    txt('title','让小商品\n进入国潮场景',[48,82,460,132],48,'$ink',True,lh=1.05),
    txt('lead','以线上三维展陈回应\n「义乌小商品 ＋ 国潮文化」',[52,242,390,64],21,'$red',True,lh=1.35),
    line('rule',[52,340,348,2],'$ink',2),
    txt('v1','空间叙事',[52,372,140,30],22,'$ink',True,wrap=False),
    txt('v2','互动体验',[212,402,140,30],22,'$ink',True,wrap=False),
    txt('v3','品牌传播',[372,432,140,30],22,'$ink',True,wrap=False),
    img('brief','competition.jpg',[548,82,364,358],'cover',border={'style':'solid','width':1,'color':'$line'}),
    txt('caption','大赛命题要求（用户提供）',[548,458,364,18],10,'$muted',False,('right','top'),wrap=False)]
pages.append(('02_brief.page',page(2,elements=es)))

# 03 Overview
es=meta(3,'作品概览')+[
    txt('big','一座市集的一日生活',[48,62,620,64],44,'$ink',True,wrap=False),
    txt('statement','以早市、午市、夜市为叙事结构，将义乌小商品融入三维国风市集。\n通过角色漫游、摊位互动与商品观察，完成一次轻量的线上展陈。',[52,140,380,92],19,'$muted',False,lh=1.55),
    line('left-rule',[52,268,3,154],'$red',4),
    txt('tags','角色漫游\n摊位互动\n商品观察',[74,278,180,140],26,'$ink',True,lh=1.55),
    img('market','market-noon.png',[372,122,556,370],'contain'),
    txt('num','03',[782,426,130,74],64,'$red',True,('right','middle'),wrap=False)]
pages.append(('03_overview.page',page(3,elements=es)))

# 04 Concept
es=meta(4,'核心概念')+[
    txt('title','三种元素，一次汇合',[48,62,640,58],44,'$ink',True,wrap=False),
    img('ancient','qingming.jpg',[48,150,280,116],'cover'),
    txt('ancient-t','古代市集',[48,286,280,42],30,'$ink',True,wrap=False),
    txt('ancient-s','时间 / 街巷 / 日常',[48,334,280,24],15,'$muted',wrap=False),
    txt('x1','×',[338,220,50,60],44,'$red',True,('center','middle'),wrap=False),
    img('product','product-noonFan.png',[395,132,210,178],'contain'),
    txt('product-t','国潮商品',[395,286,220,42],30,'$ink',True,wrap=False),
    txt('product-s','可看 / 可转 / 可选',[395,334,220,24],15,'$muted',wrap=False),
    txt('x2','×',[616,220,50,60],44,'$red',True,('center','middle'),wrap=False),
    img('web','market-morning.png',[658,126,254,184],'contain'),
    txt('web-t','轻量网页',[658,286,254,42],30,'$ink',True,wrap=False),
    txt('web-s','易进入 / 易传播 / 易分享',[658,334,254,24],15,'$muted',wrap=False),
    line('bottom-rule',[48,402,864,2],'$ink',2),
    txt('bottom','从观看一个场景，到进入一段市集日常。',[48,430,720,48],27,'$red',True,wrap=False)]
pages.append(('04_concept.page',page(4,elements=es)))

# 05 Historical inspiration
es=[img('scroll','qingming.jpg',[0,0,960,226],'cover'),
    rect('paper-block',[0,226,960,314],'$paper'),
    txt('num','01',[48,250,94,54],44,'$red',True,wrap=False),
    txt('title','从长卷，走进市井',[144,250,650,58],44,'$ink',True,wrap=False),
    txt('keys','散点透视\n连环叙事\n摊贩日常',[52,340,240,132],29,'$ink',True,lh=1.45),
    line('v-rule',[330,342,2,120],'$red',3),
    txt('body','《清明上河图》以长卷组织城市生活；\n《东京梦华录》写下早市与夜市的接续。\n本项目提取「时间换场、沿街展开、停留看物」。',[364,340,500,112],18,'$muted',False,lh=1.6),
    txt('source','图像：<a href="https://commons.wikimedia.org/wiki/File:Qingming_Festival_2.jpg">张择端《清明上河图》局部（公有领域）</a>；文字参考：<a href="http://hrczh.cass.cn/lszg/lszg_sgwx/202502/t20250218_5847003.shtml">中国社科院《宋代的桥市》</a>。',[48,500,860,16],9,'$muted',False,wrap=False)]
pages.append(('05_history.page',page(5,elements=es)))

# 06 Jiangnan inspiration
es=meta(6,'设计灵感')+[
    txt('title','古画构图，现代上色',[48,64,560,58],44,'$ink',True,wrap=False),
    img('game','jiangnan.jpg',[48,148,520,292],'cover'),
    txt('game-cap','《江南百景图》游戏画面（灵感参考）',[48,450,520,18],10,'$muted',wrap=False),
    img('gusu','gusu.jpg',[624,84,288,128],'cover'),
    txt('gusu-cap','《姑苏繁华图》局部',[624,220,288,18],10,'$muted',wrap=False),
    txt('words','清逸色彩\n微缩街巷\n人物日常',[624,264,288,130],29,'$red',True,lh=1.42),
    line('right-rule',[624,416,240,2],'$ink',2),
    txt('body','参考其“古画构图＋现代色彩”的方法，\n进一步转为可漫游的三维市集。',[624,438,288,52],15,'$muted',False,lh=1.45),
    txt('source','资料：<a href="http://www.ce.cn/culture/gd/202009/09/t20200909_35704672.shtml">中国经济网《手机游戏的文化传播》</a>；<a href="https://www.chinanews.com.cn/cul/2014/10-10/6662411.shtml">中新网《姑苏繁华图》</a>。',[48,506,840,14],9,'$muted',wrap=False)]
pages.append(('06_jiangnan.page',page(6,elements=es)))

# 07 Three markets
es=meta(7,'总体布局')+[
    txt('title','三个时间，三种市声',[48,58,680,58],44,'$ink',True,wrap=False),
    txt('stats','3 个场景   ·   9 个摊位   ·   13 件商品',[50,124,600,28],18,'$red',True,wrap=False),
    line('time-line',[66,340,816,2],'$line',2),
    img('morning','market-morning.png',[28,170,302,226],'contain'),
    img('noon','market-noon.png',[328,158,316,236],'contain'),
    img('night','market-night.png',[654,170,282,226],'contain'),
    txt('m','早市 · 卯时',[52,406,250,34],26,'$ink',True,wrap=False),
    txt('n','午市 · 午时',[356,406,250,34],26,'$ink',True,wrap=False),
    txt('ng','夜市 · 戌时',[678,406,230,34],26,'$ink',True,wrap=False),
    txt('m-s','蒸汽先醒',[52,450,250,24],16,'$muted',wrap=False),
    txt('n-s','市声最盛',[356,450,250,24],16,'$muted',wrap=False),
    txt('ng-s','灯火初上',[678,450,230,24],16,'$muted',wrap=False)]
pages.append(('07_three_markets.page',page(7,elements=es)))

# 08 Morning
es=[rect('wash',[0,0,960,540],'#EFE5D4'),
    txt('glyph','早',[48,40,250,190],142,'$red',True,wrap=False),
    txt('hour','卯时 / MORNING',[58,232,300,28],16,'$muted',True,ls=1.2,wrap=False),
    txt('title','天光初开\n蒸汽先醒',[52,292,360,112],44,'$ink',True,lh=1.15),
    txt('shops','茶水摊  ·  木铃摊  ·  早餐摊',[54,440,380,26],17,'$muted',wrap=False),
    img('market','market-morning.png',[350,48,580,430],'contain'),
    img('p1','product-milkCupMorning.png',[712,354,86,100],'contain'),
    img('p2','product-woodBell.png',[804,346,70,110],'contain'),
    txt('num','08',[868,26,48,24],12,'$muted',False,('right','top'),wrap=False)]
pages.append(('08_morning.page',page(8,bg='#EFE5D4',elements=es)))

# 09 Noon
es=[rect('wash',[0,0,960,540],'#F2E7D1'),
    img('market','market-noon.png',[28,40,580,428],'contain'),
    rect('vertical-red',[614,0,8,540],'$red'),
    txt('glyph','午',[666,34,220,176],136,'$ink',True,('center','middle'),wrap=False),
    txt('hour','午时 / NOON',[664,226,240,26],16,'$red',True,('center','top'),1.15,1.2,False),
    txt('title','日正当中\n市声最盛',[650,286,270,104],40,'$ink',True,('center','top'),1.2),
    txt('shops','扇子 / 杂货 / 香囊',[654,426,260,26],17,'$muted',False,('center','top'),wrap=False),
    img('fan','product-noonFan.png',[480,332,132,132],'contain'),
    txt('num','09',[28,26,48,24],12,'$muted',wrap=False)]
pages.append(('09_noon.page',page(9,bg='#F2E7D1',elements=es)))

# 10 Night
es=[rect('night-bg',[0,0,960,540],'$night'),
    txt('meta','10  /  夜市',[48,26,200,18],10,'$cream',False,ls=1.5,wrap=False),
    txt('glyph','夜',[54,66,250,190],142,'$gold',True,wrap=False),
    txt('hour','戌时 / NIGHT',[60,260,300,28],16,'$cream',True,ls=1.2,wrap=False),
    txt('title','灯火初上\n人影渐长',[54,320,360,112],44,'$cream',True,lh=1.15),
    txt('shops','古董摊  ·  花灯摊  ·  酿酒摊',[58,460,400,26],17,'$gold',wrap=False),
    img('market','market-night.png',[336,52,600,434],'contain'),
    img('lamp','product-hatLamp.png',[758,342,110,128],'contain')]
pages.append(('10_night.page',page(10,bg='$night',elements=es)))

# 11 Spatial route
es=meta(11,'空间与游线')+[
    txt('title','从总览，到一件商品',[48,62,620,58],44,'$ink',True,wrap=False),
    img('map','map-top.png',[42,138,548,330],'cover'),
    txt('map-cap','场景俯视图 / 空间布局推演',[48,478,520,18],10,'$muted',wrap=False),
    line('route',[654,154,2,260],'$red',3),
    txt('r1','01  总览换时',[636,142,276,38],25,'$ink',True,wrap=False),
    txt('r2','02  角色入市',[676,222,236,38],25,'$ink',True,wrap=False),
    txt('r3','03  驻摊互动',[636,302,276,38],25,'$ink',True,wrap=False),
    txt('r4','04  近看商品',[676,382,236,38],25,'$ink',True,wrap=False),
    txt('side','滚轮 / WASD / 长按 E / 点击',[636,458,276,22],14,'$muted',False,('right','top'),wrap=False)]
pages.append(('11_route.page',page(11,elements=es)))

# 12 Products
es=meta(12,'产品展示')+[
    txt('title','一摊一物，各有性格',[48,58,640,58],44,'$ink',True,wrap=False),
    txt('sub','13 件三维商品，按三时市集与 9 个摊位编组。',[50,124,620,28],17,'$muted',wrap=False),
    line('gallery-rule',[48,174,864,2],'$ink',2),
    img('cup','product-milkCupMorning.png',[38,188,168,164],'contain'),
    txt('cup-t','陶瓷杯',[58,360,128,28],20,'$ink',True,('center','top'),wrap=False),
    img('toast','product-toastFigure.png',[204,212,142,142],'contain'),
    txt('toast-t','面包碟',[210,360,132,28],20,'$ink',True,('center','top'),wrap=False),
    img('fan','product-noonFan.png',[350,184,190,174],'contain'),
    txt('fan-t','清风红扇',[360,360,170,28],20,'$red',True,('center','top'),wrap=False),
    img('cat','product-catJar.png',[544,206,136,148],'contain'),
    txt('cat-t','小猫陶罐',[544,360,140,28],20,'$ink',True,('center','top'),wrap=False),
    img('clock','product-hundredClocks.png',[682,186,150,166],'contain'),
    txt('clock-t','百珍时钟',[688,360,140,28],20,'$ink',True,('center','top'),wrap=False),
    img('goblet','product-starGoblet.png',[824,178,92,178],'contain'),
    txt('goblet-t','沧海星杯',[802,360,130,28],20,'$ink',True,('center','top'),wrap=False),
    txt('bottom','器物不只被陈列，也成为进入摊位故事的线索。',[48,442,780,40],25,'$red',True,wrap=False)]
pages.append(('12_products.page',page(12,elements=es)))

# 13 Interaction
es=meta(13,'互动体验')+[
    txt('title','逛，停，看，选',[48,58,520,58],46,'$ink',True,wrap=False),
    img('stall','fan-stall.png',[48,142,528,320],'cover'),
    img('product','fan-product.png',[552,188,360,240],'cover',border={'style':'solid','width':6,'color':'$paper'}),
    txt('step1','01  靠近摊位',[54,478,220,26],18,'$ink',True,wrap=False),
    txt('step2','02  镜头切换',[286,478,220,26],18,'$ink',True,wrap=False),
    txt('step3','03  商品细看',[518,478,190,26],18,'$red',True,wrap=False),
    txt('step4','04  加入购物车',[714,478,198,26],18,'$ink',True,('right','top'),wrap=False)]
pages.append(('13_interaction.page',page(13,elements=es)))

# 14 Workflow
es=meta(14,'制作流程')+[
    txt('title','两条路线，同步落地',[48,58,620,58],44,'$ink',True,wrap=False),
    img('outline','outline-hand.jpg',[682,52,230,164],'cover',rotation=2),
    txt('r1','路线 A',[52,152,120,28],16,'$red',True,ls=1.2,wrap=False),
    txt('a1','美术风格确立',[52,202,180,34],24,'$ink',True,wrap=False),
    txt('a2','三维资产制作',[236,252,180,34],24,'$ink',True,wrap=False),
    txt('a3','三维场景搭建',[420,302,180,34],24,'$ink',True,wrap=False),
    txt('a4','人物 NPC 制作',[604,352,210,34],24,'$red',True,wrap=False),
    line('route-a',[62,236,710,154],'$line',2,'0,0 1,1'),
    line('split',[52,420,860,2],'$ink',2),
    txt('r2','路线 B',[52,444,120,28],16,'$red',True,ls=1.2,wrap=False),
    txt('b','商品调研  →  图片搜集  →  三维资产化  →  交互逻辑',[186,438,726,40],24,'$ink',True,('right','top'),wrap=False)]
pages.append(('14_workflow.page',page(14,elements=es)))

# 15 Team daily
es=[rect('bg',[0,0,960,540],'#E8E1D5'),
    txt('title','从讨论，到手绘',[48,40,520,58],44,'$ink',True,wrap=False),
    txt('label','团队日常 / 命题拆解 / 角色与商品草图',[52,108,580,22],14,'$muted',wrap=False),
    img('discuss1','team-discuss-1.jpg',[48,154,268,156],'cover',rotation=-2),
    img('discuss2','team-discuss-2.jpg',[330,142,236,166],'cover',rotation=2),
    img('discuss3','team-discuss-3.jpg',[582,154,330,156],'cover',rotation=-1),
    img('sketch1','team-sketch-3.jpg',[66,334,170,154],'cover',rotation=2),
    img('sketch2','team-sketch-1.jpg',[256,326,188,162],'cover',rotation=-2),
    img('sketch3','team-sketch-4.jpg',[466,340,208,148],'cover',rotation=1),
    img('sketch4','team-outline.jpg',[696,326,196,162],'cover',rotation=-2),
    txt('caption','想法先被说出来，再被画下来，最后进入三维场景。',[52,504,760,22],16,'$red',True,wrap=False)]
pages.append(('15_team.page',page(15,bg='#E8E1D5',elements=es)))

# 16 Scene production
es=meta(16,'场景与角色制作')+[
    txt('title','把白模，变成街市',[48,54,600,58],44,'$ink',True,wrap=False),
    img('white','scene-white.png',[48,138,410,236],'cover'),
    img('color','scene-color.png',[478,112,434,262],'cover'),
    txt('before','白模 / 空间结构',[52,384,300,24],16,'$muted',wrap=False),
    txt('after','着色 / 材质与氛围',[484,384,300,24],16,'$red',True,wrap=False),
    line('bottom',[48,428,864,2],'$ink',2),
    img('npc','npc-girl.png',[48,444,176,74],'cover'),
    img('npc2','npc-hat.png',[238,444,176,74],'cover'),
    txt('steps','场景搭建   ·   材质统一   ·   灯光调试   ·   角色放入',[446,458,466,34],21,'$ink',True,('right','middle'),wrap=False)]
pages.append(('16_production.page',page(16,elements=es)))

# 17 Tech
es=[rect('bg',[0,0,960,540],'$night'),
    txt('meta','17  /  技术实现',[48,26,240,18],10,'$cream',False,ls=1.5,wrap=False),
    txt('title','轻量，也能完整',[48,70,560,62],46,'$cream',True,wrap=False),
    txt('lead','AIGC 辅助资产生产，Three.js 完成网页交互。',[52,146,650,30],19,'$gold',True,wrap=False),
    line('top',[52,204,856,2],'$gold',2),
    txt('three','Three.js',[52,238,300,48],38,'$cream',True,wrap=False),
    txt('three-s','三维总览 / 角色漫游 / 摊位与商品交互',[52,296,360,54],16,'$cream',False,lh=1.5),
    txt('blender','Blender',[448,238,240,48],38,'$cream',True,wrap=False),
    txt('blender-s','模型制作 / 场景搭建 / 材质灯光',[448,296,300,54],16,'$cream',False,lh=1.5),
    txt('aigc','AIGC + GLB',[726,238,186,48],32,'$gold',True,('right','top'),wrap=False),
    txt('aigc-s','角色与商品辅助生成\n网页三维资产流转',[704,296,208,54],16,'$cream',False,('right','top'),1.5),
    line('bottom',[52,394,856,2],'$night2',2),
    txt('value','浏览器进入   ·   无需 VR 设备   ·   便于分享',[52,430,856,40],25,'$cream',True,('center','middle'),wrap=False),
    txt('foot','空间叙事 / 互动体验 / 品牌传播',[52,488,856,20],13,'$gold',False,('center','top'),1.15,2,False)]
pages.append(('17_tech.page',page(17,bg='$night',elements=es)))

# 18 Closing
es=[rect('red-band',[0,0,14,540],'$red'),
    txt('title','一日三市\n义犹未尽',[50,88,470,168],62,'$ink',True,lh=1.05),
    txt('sub','让义乌小商品，在可漫游的国风市集中被看见。',[54,296,500,64],23,'$red',True,lh=1.4),
    line('rule',[54,400,320,2],'$ink',2),
    txt('thanks','谢谢观看  /  敬请指正',[54,430,380,30],18,'$muted',wrap=False),
    img('market','market-night.png',[464,46,470,434],'contain'),
    txt('seal','义',[846,454,48,48],28,'$red',True,('center','middle'),wrap=False)]
pages.append(('18_closing.page',page(18,elements=es,ptype='final')))

main={
    'version':'v2','title':'一日三市·义犹未尽——项目答辩','size':[960,540],
    'theme':{'colors':C,'textStyles':{
        'title':{'fontSize':44,'fontFamily':FONT,'color':'$ink','bold':True},
        'body':{'fontSize':18,'fontFamily':FONT,'color':'$muted','lineHeight':1.5}
    }},
    'pages':[f'pages/{name}' for name,_ in pages]
}
with open(DECK/'yiwu_defense.pptd','w',encoding='utf-8') as f:
    yaml.safe_dump(main,f,allow_unicode=True,sort_keys=False,width=1000)
for name,data in pages:
    with open(PAGES/name,'w',encoding='utf-8') as f:
        yaml.safe_dump(data,f,allow_unicode=True,sort_keys=False,width=1000)
print(f'Created {len(pages)} pages at {DECK}')
