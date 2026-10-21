"""Author the editable noon market, preserving the supplied double-courtyard layout.
Run Blender -b --factory-startup --python scripts/refine_noon.py
The original is backed up once. A review candidate and renders are produced first;
--publish saves the verified candidate back to the asset-pack source.
No website assets are exported by this authoring pass.
"""
import bpy, bmesh, math, random, json, shutil, sys, hashlib
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT/'资产包/首页/午/二级场景/02_午市_场景精修.blend'
OUT = ROOT/'previews/markets/noon-authoring-v2'
OUT.mkdir(parents=True, exist_ok=True)
BASE = OUT/'修改前_02_午市_场景精修.blend'
CANDIDATE = OUT/'午市_精修待检.blend'
if not BASE.exists(): shutil.copy2(TARGET, BASE)
SOURCE_HASH='81ba5b882a70b93fa83bcdb9d6c3d5bb2fc1b125f969ca023eed94cecb5ebfff'
assert hashlib.sha256(BASE.read_bytes()).hexdigest()==SOURCE_HASH, 'Wrong noon baseline; do not reuse the previous upload.'
if '--publish' in sys.argv:
    bpy.ops.wm.open_mainfile(filepath=str(CANDIDATE))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
    print('PUBLISHED', TARGET, flush=True)
    raise SystemExit(0)
bpy.ops.wm.open_mainfile(filepath=str(BASE))
scene = bpy.context.scene
random.seed(1022)
TAU = math.tau

def collection(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(c)
    return c

SHOPS = collection('午市 · 01 十八铺百业')
ENV = collection('午市 · 02 双院环境与生活陈设')
LIGHTS = collection('午市 · 03 午间日光')
CAMERAS = collection('午市 · 04 总览与店铺巡检相机')

def move(obj, c):
    for old in list(obj.users_collection): old.objects.unlink(obj)
    c.objects.link(obj)

def linear(h):
    rgb = [int(h[i:i+2], 16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb)

def mat(name, hexcolor, kind='plaster', rough=.85, metallic=0):
    m = bpy.data.materials.new('午 · '+name);m.use_nodes=True
    color = linear(hexcolor);m.diffuse_color=(*color,1)
    n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
    p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metallic
    tex=n.new('ShaderNodeTexNoise');tex.inputs['Scale'].default_value=7 if kind=='plaster' else 13
    tex.inputs['Detail'].default_value=3;tex.inputs['Roughness'].default_value=.72
    coord=n.new('ShaderNodeTexCoord');mapping=n.new('ShaderNodeVectorMath');mapping.operation='MULTIPLY'
    mapping.inputs[1].default_value=(8,.7,2) if kind=='wood' else (1,1,1)
    l.new(coord.outputs['Generated'],mapping.inputs[0]);l.new(mapping.outputs[0],tex.inputs['Vector'])
    ramp=n.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.18;ramp.color_ramp.elements[1].position=.82
    ramp.color_ramp.elements[0].color=(*(v*.67 for v in color),1)
    ramp.color_ramp.elements[1].color=(*(min(1,v*1.10+.015) for v in color),1)
    l.new(tex.outputs['Fac'],ramp.inputs[0]);l.new(ramp.outputs['Color'],p.inputs['Base Color'])
    bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.16 if kind!='cloth' else .25;bump.inputs['Distance'].default_value=.035
    l.new(tex.outputs['Fac'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal'])
    return m

M={
 'wall':mat('月白粉墙','E5E6DA'), 'wood':mat('胡桃木梁','79594A','wood'),
 'woodLight':mat('榆木柜架','B39A72','wood'), 'tile':mat('蓝灰黛瓦','556E77'),
 'tileEdge':mat('瓦当浅灰','829298'), 'stone':mat('冷灰青石','AFBBB6'),
 'earth':mat('草木浅苔','85916D'), 'rock':mat('风化石','89978D'),
 'leaf':mat('午间树叶','58774F'), 'leafLight':mat('鲜叶','88A05C'),
 'ivory':mat('本白麻布','EDE5D2','cloth'), 'indigo':mat('靛蓝染布','3F6479','cloth'),
 'jade':mat('豆青织物','7FA69A','cloth'), 'red':mat('朱砂染布','B75F4F','cloth'),
 'rose':mat('藕荷织物','B68C93','cloth'), 'gold':mat('姜黄织物','CFAC67','cloth'),
 'paper':mat('桑皮纸','F3E9D2'), 'ink':mat('墨黑','293B3A'),
 'clay':mat('赤陶器','AF7756'), 'ceramic':mat('青瓷釉','8CB9B0',rough=.24),
 'porcelain':mat('白瓷釉','ECEDE0',rough=.2), 'blue':mat('青花釉','356789',rough=.3),
 'bamboo':mat('淡竹篾','C4AD7C','wood'), 'metal':mat('锤纹铜','AD8051',rough=.33,metallic=.65),
 'tin':mat('锡器','B6C4C0',rough=.27,metallic=.72), 'grain':mat('粟米','DDC896'),
 'bean':mat('赤豆','9E5949'), 'green':mat('青菜','6E994F'), 'orange':mat('橘柿','E1A04F'),
 'pink':mat('花瓣','D69CAA'), 'petal':mat('菊瓣','EEDCB2'), 'sweet':mat('麦芽糖','BD7C38',rough=.28),
}
remap={'earth':'earth','stone':'stone','rock':'rock','wood':'wood','wall':'wall','tile':'tile','cloth':'ivory','leaf':'leaf','paper':'paper','clay':'clay'}
for o in scene.objects:
    if o.type=='MESH' and o.get('surface') in remap:
        o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(M[remap[o['surface']]])
    elif o.type=='MESH' and any(k in o.name for k in ('檐口','屋脊','屋面分缝','山墙轮廓')):
        o.data=o.data.copy();o.data.materials.clear();o.data.materials.append(M['tile'])

FONT=bpy.data.fonts.load('C:/Windows/Fonts/simkai.ttf')
CURRENT=None
CATEGORY='04 商品'

def objmesh(label, verts, faces, material):
    mesh=bpy.data.meshes.new(label+' · 网格');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(label,mesh);mesh.materials.append(material)
    return attach(o,label)

def attach(o,label):
    if CURRENT:
        o.name=CURRENT['code']+'_'+CURRENT['name']+' · '+label
        CURRENT['groups'][CATEGORY].objects.link(o);o.parent=CURRENT['control']
        o['shopCode']=CURRENT['code'];o['shopTheme']=CURRENT['name'];o['partCategory']=CATEGORY
    else: ENV.objects.link(o)
    return o

def box(label, p, s, m, rot=(0,0,0), bevel=0):
    v=[(x*s[0]/2,y*s[1]/2,z*s[2]/2) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    o=objmesh(label,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],m)
    o.location=p;o.rotation_euler=rot
    if bevel:
        b=o.modifiers.new('手工倒角','BEVEL');b.width=bevel;b.segments=2
    return o

def sphere(label,p,r,m,scale=(1,1,1)):
    bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=12,v_segments=8,radius=r)
    me=bpy.data.meshes.new(label);bm.to_mesh(me);bm.free();me.materials.append(m)
    o=attach(bpy.data.objects.new(label,me),label);o.location=p;o.scale=scale
    for f in me.polygons:f.use_smooth=True
    return o

def cyl(label,p,r,h,m,rot=(0,0,0),r2=None,n=16):
    bm=bmesh.new();bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=n,radius1=r,radius2=r if r2 is None else r2,depth=h)
    me=bpy.data.meshes.new(label);bm.to_mesh(me);bm.free();me.materials.append(m)
    o=attach(bpy.data.objects.new(label,me),label);o.location=p;o.rotation_euler=rot
    return o

def line(label,pts,r,m):
    c=bpy.data.curves.new(label,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=1;c.resolution_u=1
    s=c.splines.new('POLY');s.points.add(len(pts)-1)
    for a,p in zip(s.points,pts):a.co=(*p,1)
    c.materials.append(m);return attach(bpy.data.objects.new(label,c),label)

def ring(label,p,r,m,tube=.02,vertical=False):
    pts=[(p[0]+r*math.cos(i*TAU/32),p[1]+(0 if vertical else r*math.sin(i*TAU/32)),p[2]+(r*math.sin(i*TAU/32) if vertical else 0)) for i in range(33)]
    return line(label,pts,tube,m)

def lathe(label,p,profile,m,n=20):
    v=[(p[0]+r*math.cos(i*TAU/n),p[1]+r*math.sin(i*TAU/n),p[2]+z) for r,z in profile for i in range(n)]
    f=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(profile)-1) for i in range(n)]
    o=objmesh(label,v,f,m)
    for poly in o.data.polygons:poly.use_smooth=True
    return o

def text(label,words,p,size=.3,m=None):
    c=bpy.data.curves.new(label,'FONT');c.body=words;c.font=FONT;c.size=size;c.align_x='CENTER';c.align_y='CENTER';c.extrude=.002;c.resolution_u=3
    c.materials.append(m or M['ink']);o=attach(bpy.data.objects.new(label,c),label);o.location=p;o.rotation_euler=(math.pi/2,0,0)
    return o

def pot(label,p,r=.18,h=.4,m=None):
    lathe(label,p,[(.55*r,0),(.85*r,.05*h),(r,.35*h),(.85*r,.7*h),(.55*r,.82*h),(.57*r,h),(.46*r,h),(.44*r,.83*h),(.62*r,.7*h)],m or M['clay'])
    ring(label+' · 口沿',(p[0],p[1],p[2]+h),.52*r,m or M['clay'],.014)

def bowl(label,p,r=.21,m=None):
    lathe(label,p,[(.45*r,0),(.45*r,.04),(.7*r,.11),(r,.18),(.93*r,.19),(.62*r,.10),(.38*r,.05),(0,.05)],m or M['ceramic'])

def basket(label,p,r=.35,h=.45):
    lathe(label,p,[(r*.7,0),(r,.08),(r,h),(r*.93,h),(r*.9,.08)],M['bamboo'])
    for z in range(7):ring(label+' · 横编篾',(p[0],p[1],p[2]+h*z/6),r*(.95 if z else .8),M['woodLight'],.012)
    for i in range(16):
        a=i*TAU/16
        line(label+' · 竖编篾',[(p[0]+r*.75*math.cos(a),p[1]+r*.75*math.sin(a),p[2]),(p[0]+r*math.cos(a),p[1]+r*math.sin(a),p[2]+h)],.011,M['bamboo'])

def fan(label,p,r=.45,m=None):
    verts=[]
    for i in range(17):
        a=-1.15+2.3*i/16
        for rad in [.15*r,r]:verts.append((p[0]+math.sin(a)*rad,p[1]+(.014 if i%2 else -.014),p[2]+math.cos(a)*rad))
    objmesh(label+' · 折面',verts,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(16)],m or M['paper'])
    for i in range(9):
        a=-1.15+2.3*i/8
        line(label+' · 扇骨',[(p[0],p[1]-.02,p[2]-.07),(p[0]+math.sin(a)*r,p[1]-.02,p[2]+math.cos(a)*r)],.009,M['bamboo'])
    sphere(label+' · 铜轴',(p[0],p[1]-.04,p[2]),.024,M['metal'])

def plant(label,p,r=.24,flowers=False):
    pot(label+' · 花盆',p,r,.38,M['clay'])
    for j in range(7):
        a=j*TAU/7;top=(p[0]+math.cos(a)*r*1.3,p[1]+math.sin(a)*r*1.3,p[2]+.58+random.random()*.35)
        line(label+' · 茎',[(p[0],p[1],p[2]+.25),top],.012,M['leaf'])
        for k in [0,1]:
            q=Vector(top)+Vector((math.cos(a+.8)*.12,math.sin(a+.8)*.12,-.12*k))
            sphere(label+' · 叶',q,.12,M['leafLight'],(.45,1,.16))
        if flowers:
            sphere(label+' · 花心',top,.035,M['gold'])
            for k in range(5):
                a2=k*TAU/5;q=Vector(top)+Vector((math.cos(a2)*.065,math.sin(a2)*.065,0))
                sphere(label+' · 花瓣',q,.07,M['pink'] if j%2 else M['petal'],(1,1,.3))

def shelf(label,x=0,y=.65,w=3.5):
    for z in [.4,1.05,1.7,2.35]:box(label+' · 层板',(x,y,z),(w,.55,.075),M['woodLight'],bevel=.014)
    for xx in [-w/2,w/2]:box(label+' · 立框',(x+xx,y,1.37),(.1,.6,2.05),M['wood'])
    box(label+' · 背板',(x,y+.3,1.37),(w,.07,2.05),M['wood'])

def table(label,p,w=3.35,d=.7,h=1.25):
    box(label+' · 台面',(p[0],p[1],p[2]+h),(w,d,.1),M['woodLight'],bevel=.018)
    for x in [-w*.43,w*.43]:
        for y in [-d*.35,d*.35]:box(label+' · 足',(p[0]+x,p[1]+y,p[2]+h/2),(.1,.1,h),M['wood'])
    box(label+' · 下横枨',(p[0],p[1],p[2]+.3),(w-.25,.08,.08),M['wood'])

def awning(accent,w=4.2,y=-1.8,z=3.0,depth=1.25):
    for i in range(10):
        x0=-w/2+w*i/10;x1=x0+w/10
        v=[]
        for t in range(6):
            f=t/5;zz=z-.48*f-.09*math.sin(math.pi*f)
            v.extend([(x0,y-depth*f,zz),(x1,y-depth*f,zz)])
        objmesh('条纹凉篷 · 幅%02d'%i,v,[(2*j,2*j+1,2*j+3,2*j+2) for j in range(5)],accent if i%2 else M['ivory'])
        box('凉篷垂边',((x0+x1)/2,y-depth,z-.58),(w/10,.035,.2),accent if i%2 else M['ivory'])
    for x in [-w/2,w/2]:
        line('凉篷竹撑',[(x,y+.15,z+.05),(x,y-depth,z-.5)],.027,M['bamboo'])
        line('凉篷牵绳',[(x,y+.3,z+.15),(x,y-depth,z-.48)],.009,M['paper'])
    line('凉篷前横杆',[(-w/2,y-depth,z-.48),(w/2,y-depth,z-.48)],.025,M['bamboo'])

def roof_tiles(control, roof):
    """Sample the retained curved roof so added tiles sit on its actual surface."""
    bpy.context.view_layer.update()
    to_roof=roof.matrix_world.inverted()@control.matrix_world
    to_control=control.matrix_world.inverted()@roof.matrix_world
    points=[to_control@v.co for v in roof.data.vertices]
    xmin,xmax=min(p.x for p in points)+.12,max(p.x for p in points)-.12
    ymin,ymax=min(p.y for p in points)+.14,max(p.y for p in points)-.14
    verts=[];faces=[]
    for row in range(16):
        for col in range(24):
            local=[]
            for j in [0,1]:
                y=ymin+(ymax-ymin)*(row+j*.92)/16
                for k in [0,1,2]:
                    x=xmin+(xmax-xmin)*(col+k*.48)/24
                    hit,p,_,_=roof.ray_cast(to_roof@Vector((x,y,8)),Vector((0,0,-1)))
                    if not hit:break
                    q=to_control@p;q.z+=.017+(.028 if k==1 else 0)+(.012 if j==0 else 0)
                    local.append(tuple(q))
            if len(local)!=6:continue
            start=len(verts);verts.extend(local)
            faces.extend([(start,start+1,start+4,start+3),(start+1,start+2,start+5,start+4)])
    objmesh('逐片弧面青瓦',verts,faces,M['tile'])

# Exact master objects from the NEW upload. Two masters share one source collection.
SPECS=[
 ('建筑 · 西院南铺一 · 总控','锦绣布庄','cloth','indigo',None),
 ('建筑 · 西院南铺一 · 总控.001','竹韵扇坊','fans','jade','fans'),
 ('建筑 · 入口东铺 · 总控','汝青瓷坊','ceramics','jade',None),
 ('建筑 · 西院西铺一 · 总控','篾竹器坊','bamboo','gold',None),
 ('建筑 · 西院西铺二 · 总控','南北香料','spices','red',None),
 ('建筑 · 西院北铺二 · 总控','五谷粮行','grain','gold','grocery'),
 ('建筑 · 西院北铺二 · 总控.001','本草药铺','medicine','jade',None),
 ('建筑 · 院心分隔铺 · 总控','墨香书肆','books','indigo',None),
 ('建筑 · 东院南铺二 · 总控.001','棉麻日用','daily','rose','daily'),
 ('建筑 · 东院南铺二 · 总控','铜锡器铺','metal','indigo',None),
 ('建筑 · 东院东铺一 · 总控','木趣玩坊','toys','red',None),
 ('建筑 · 东院东铺二 · 总控','时鲜果蔬','produce','jade',None),
 ('建筑 · 东院南铺二 · 总控.002','八景古玩','antiques','red','sundries-noon'),
 ('建筑 · 北出口东铺 · 总控','四时花铺','flowers','rose',None),
 ('摊位 · 百货院散摊 · 总控','糖画点心','sweets','red',None),
 ('摊位 · 手作演示 · 总控','绣作香囊','embroidery','indigo',None),
 ('建筑 · 入口东铺 · 总控.001','清茗茶铺','tea','jade',None),
 ('建筑 · 西院西铺二 · 总控.001','清供香铺','incense','gold',None),
]
records=[]
for index,(mastername,name,theme,accent,anchor) in enumerate(SPECS,1):
    code=f'N{index:02d}';control=bpy.data.objects[mastername]
    old=control.users_collection[0];oldname=old.name
    original_parts=list(control.children_recursive)
    original_matrix=control.matrix_world.copy()
    imported=bool(anchor and any(o.get('stallId')==anchor for o in scene.objects))
    c=collection(f'{code} · {name}',SHOPS)
    groups={n:collection(f'{code} · {n}',c) for n in ['01 建筑','02 招牌','03 陈列','04 商品','05 工具']}
    CURRENT={'code':code,'name':name,'theme':theme,'control':control,'groups':groups}
    control.name=f'{code}_{name} · 总控';move(control,c)
    control['shopCode']=code;control['shopTheme']=name;control['originalCollection']=oldname
    control['description']='建筑、招牌、陈列、商品与工具分别归组；局部坐标正面朝 -Y。'
    # Keep the building's authored transform, footprint, roof and editable components.
    for o in original_parts:
        if any(k in o.name for k in ('陈列占位','空白匾额','棚面')):
            bpy.data.objects.remove(o,do_unlink=True);continue
        move(o,groups['01 建筑']);o.name=f'{code}_{name} · '+o.name.split('.')[0]
        o['shopCode']=code;o['shopTheme']=name
    if anchor:
        root=bpy.data.objects.get('Shop_'+anchor)
        move(root,c);root['shopCode']=code;root['shopTheme']=name
        bpy.context.view_layer.update();world_matrix=root.matrix_world.copy()
        root.parent=control;root.matrix_world=world_matrix if imported else control.matrix_world.copy()
        for o in list(scene.objects):
            if o.get('stallId')==anchor:
                move(o,groups['01 建筑']);o.name=f'{code}_{name} · 原装铺面 · '+o.name
                o['shopCode']=code;o['shopTheme']=name
    if not old.objects and not old.children:
        for p in list(bpy.data.collections):
            if old.name in p.children:p.children.unlink(old)
        if old.name in scene.collection.children:scene.collection.children.unlink(old)
        bpy.data.collections.remove(old)
    CATEGORY='01 建筑'
    small=mastername.startswith('摊位')
    if not small and not imported:
        roof=next((o for o in groups['01 建筑'].objects if '白模屋面' in o.name),None)
        if roof:roof_tiles(control,roof)
        # Lower wall plinths, carved counter panels, layered brackets and operable shutters.
        for x in [-2.2,2.2]:
            box('柱脚石础',(x,-1.7,.29),(.34,.34,.30),M['stone'],bevel=.025)
            for k in range(3):box('叠涩斗拱',(x,-1.72,2.65+k*.10),(.24+k*.13,.3+k*.1,.09),M['woodLight'])
            for j in range(6):box('可拆铺板',(x*.84,-1.78,.55+j*.19),(.54,.06,.16),M['woodLight'])
        for x in [-1.15,0,1.15]:
            box('柜面雕格',(x,-2.13,.85),(.94,.045,.55),M[accent])
            for a in [-.38,.38]:box('柜面格框',(x+a,-2.165,.85),(.035,.03,.57),M['woodLight'])
        for side in [-1,1]:
            for j in range(6):box('侧窗细棂',(side*2.39,-.3+j*.19,1.9),(.04,.035,.85),M['woodLight'])
    CATEGORY='02 招牌'
    signz=(2.73 if imported else 2.41) if not small else 2.25
    signy=-3.09 if not small else -1.3
    box('店名木匾',(0,signy,signz),(2.75,.105,.54),M[accent],bevel=.025)
    text('正匾 · '+name,name,(0,signy-.065,signz),.38,M['paper'])
    if not small:
        box('侧招幌',(2.05,-2.35,2.08),(.53,.045,.97),M['ivory'])
        text('招幌题字',name[-2]+'\n'+name[-1],(2.05,-2.38,2.09),.30,M[accent])
        line('挑招木臂',[(1.8,-1.8,2.75),(2.3,-2.5,2.75)],.035,M['wood'])
        for x in [1.84,2.24]:line('招幌吊绳',[(x,-2.35,2.75),(x,-2.35,2.57)],.01,M['bamboo'])
    CATEGORY='03 陈列'
    if not small:
        awning(M[accent],3.8 if imported else 4.25,z=3.35 if imported else 3.03)
        table('铺前货案',(0,-2.57,0),w=3.25)
        if not imported:shelf('内堂货架')
    else:
        awning(M[accent],3.65,y=.75,z=2.88,depth=2.0)
    # Product layout uses the front table as a common height reference.
    Y=-2.57 if not small else -.65
    Z=1.30 if not small else 1.15
    CATEGORY='04 商品'
    def jars(material=M['clay'],count=7):
        for i in range(count):pot('陈列器罐',(i*.45-(count-1)*.225,Y,Z),.16,.3+.09*(i%3),material)
    if theme=='cloth':
        for i,m in enumerate([M['indigo'],M['rose'],M['jade'],M['gold'],M['red'],M['ivory']]):
            cyl('成卷绸布',(-1.25+i*.5,Y,Z+.13),.14,.62,m,(math.pi/2,0,0),n=20)
            cyl('布卷木芯',(-1.25+i*.5,Y-.33,Z+.13),.04,.06,M['woodLight'],(math.pi/2,0,0))
            box('悬垂染布',(-1.3+i*.5,.58,1.93),(.41,.07,.93),m)
            for j in range(4):box('折叠布匹',(-1.2+i*.45,.5,.46+j*.10),(.4,.49,.08),m,bevel=.02)
    elif theme=='fans':
        for i in range(5):fan('桌上折扇',(-1.18+i*.57,Y-.12,Z+.03),.31,[M['paper'],M['jade'],M['red']][i%3])
        for i in range(3):
            fan('悬挂大扇',(-1+i,Y+.48,2.05),.46,M['paper'])
            line('悬扇丝绳',[(-1+i,Y+.48,2.5),(-1+i,Y+.48,2.92)],.007,M['bamboo'])
        basket('收拢扇篓',(-2.04,-2.5,.25),.26,.6)
        for i in range(8):cyl('合拢竹扇',(-2.2+(i%3)*.12,-2.56+(i//3)*.1,.94),.026,.58,M['bamboo'],(0,.10*(i-4),0),n=8)
    elif theme=='ceramics':
        for row in range(3):
            for i in range(6):
                xx=-1.35+i*.53
                if i%2:pot('釉色长颈瓶',(xx,.52,.45+row*.65),.14,.45,M['ceramic'] if row%2 else M['porcelain'])
                else:
                    for k in range(3):bowl('叠放瓷碗',(xx,.5,.45+row*.65+k*.07),.19,M['porcelain'])
        for i in range(5):
            bowl('青花盘',(-1.2+i*.6,Y,Z),.25,M['porcelain'])
            ring('青花纹圈',(-1.2+i*.6,Y,Z+.14),.19,M['blue'],.012)
        pot('大青瓷坛',(-2.05,-2.62,.24),.37,.85,M['ceramic'])
    elif theme=='bamboo':
        for i in range(5):basket('编织提篮',(-1.25+i*.6,Y,Z),.24,.32+.08*(i%2))
        for i in range(3):
            basket('套叠箩筐',(-1+i,.55,.45),.35,.48)
            ring('提篮弓把',(-1+i,.55,1.12),.30,M['bamboo'],.02,True)
            cyl('斗笠',(-1+i,.52,2.0),.45,.24,M['bamboo'],(math.pi/2,0,0),r2=.06)
        for side in [-1,1]:basket('大竹篓',(side*2.1,-2.6,.24),.36,.72)
    elif theme=='spices':
        for i in range(6):
            x=-1.3+i*.52;basket('香料浅盘',(x,Y,Z),.23,.12)
            for k in range(20):
                a=random.random()*TAU;rr=random.random()*.17
                sphere('干香料',(x+math.cos(a)*rr,Y+math.sin(a)*rr,Z+.13+random.random()*.04),.032,[M['bean'],M['gold'],M['green']][i%3],(1,1,.7))
            text('香料签',['桂皮','八角','花椒','茴香','陈皮','丁香'][i],(x,Y-.28,Z-.02),.105,M['ink'])
        for row in range(3):
            for i in range(6):pot('封口香料罐',(-1.3+i*.52,.53,.45+row*.65),.18,.4,M['clay'])
        for i in range(4):
            for j in range(7):sphere('悬挂红椒',(-1.3+i*.85,-1.6,1.9+j*.08),.07,M['red'],(.6,.6,1.7))
    elif theme=='grain':
        for i in range(5):
            x=-1.2+i*.6;basket('五谷量斗',(x,Y,Z),.26,.22)
            sphere('五谷粮堆',(x,Y,Z+.21),.23,M['grain'] if i%2 else M['bean'],(1,1,.38))
            text('米斗价签',['粳米','红豆','小米','绿豆','麦粒'][i],(x,Y-.28,Z+.02),.12)
        for side in [-1,1]:
            for j in range(3):
                sphere('麻布粮袋',(side*2.05,-2.1+j*.48,.62),.35,M['ivory'],(.9,.85,1.3))
                ring('扎袋绳',(side*2.05,-2.1+j*.48,1.02),.11,M['bamboo'],.018)
        CATEGORY='05 工具';cyl('木升量器',(.9,Y,Z+.32),.14,.23,M['woodLight']);line('量器把手',[(.9,Y,Z+.4),(1.2,Y,Z+.4)],.04,M['wood'])
    elif theme=='medicine':
        for row in range(5):
            for col in range(8):
                x=-1.5+col*.43;z=.58+row*.35
                box('百子柜药抽',(x,.28,z),(.4,.34,.31),M['woodLight'],bevel=.012)
                sphere('药抽铜拉手',(x,.08,z-.05),.026,M['metal'])
                text('药抽纸签',['当归','黄芪','陈皮','甘草','茯苓','山药','枸杞','菊花'][col],(x,.1,z+.05),.075)
        jars(M['porcelain'],6)
        CATEGORY='05 工具';bowl('捣药石臼',(-1.8,Y,.32),.33,M['stone']);cyl('捣药杵',(-1.8,Y,.65),.05,.55,M['wood'],(0,.35,0))
        for i in range(3):plant('鲜药草',(1.9,-1.8+i*.5,.24),.19)
    elif theme=='books':
        for row in range(3):
            for col in range(6):
                x=-1.35+col*.52;z=.46+row*.65
                for k in range(4):
                    box('线装书页',(x,.52,z+k*.1),(.43,.4,.07),M['paper'])
                    box('靛青书封',(x,.52,z+k*.1+.04),(.45,.42,.018),M['indigo'])
                    for bx in [-.15,-.06,.06,.15]:line('书脊线结',[(x+bx,.30,z+k*.1-.03),(x+bx,.30,z+k*.1+.05)],.004,M['paper'])
        box('展开书卷',(0,Y,Z),(.95,.5,.015),M['paper'])
        for x in [-.48,.48]:cyl('书卷轴头',(x,Y,Z+.05),.04,.6,M['woodLight'],(math.pi/2,0,0))
        for i in range(3):pot('笔筒',(-1.2+i*1.2,Y,Z),.12,.23,M['bamboo'])
        for i in range(9):cyl('毛笔杆',(-1.26+(i%3)*.055,Y+(i//3)*.06,Z+.44),.009,.44,M['wood'])
    elif theme=='daily':
        for i in range(5):
            for k in range(4):box('折叠棉巾',(-1.25+i*.6,Y,Z+k*.06),(.48,.48,.05),[M['ivory'],M['jade'],M['rose']][i%3],bevel=.015)
        for i in range(6):
            x=-1.35+i*.52
            box('悬挂布袜',(x,Y+.38,2.05),(.16,.07,.43),M['ivory'])
            box('袜尖',(x+.07,Y+.38,1.85),(.28,.07,.12),M['ivory'])
        line('晒袜竹竿',[(-1.6,Y+.38,2.32),(1.6,Y+.38,2.32)],.025,M['bamboo'])
        CATEGORY='05 工具';box('搓衣板',(-2,-2.5,.75),(.43,.11,.9),M['woodLight'],(.16,0,0))
        for j in range(12):box('搓衣板纹',(-2,-2.58,.4+j*.055),(.4,.045,.023),M['wood'])
        basket('洗衣篮',(2.1,-2.5,.24),.4,.55)
    elif theme=='metal':
        for i in range(5):
            x=-1.2+i*.6;pot('铜锡水壶',(x,Y,Z),.22,.43,M['metal'] if i%2 else M['tin'])
            ring('提壶弓把',(x,Y,Z+.48),.23,M['metal'],.026,True)
            cyl('壶盖',(x,Y,Z+.44),.12,.04,M['metal']);sphere('盖钮',(x,Y,Z+.49),.035,M['wood'])
            line('弯壶嘴',[(x+.17,Y,Z+.18),(x+.31,Y,Z+.25),(x+.34,Y,Z+.36)],.038,M['metal'])
        for i in range(4):
            for row in range(3):bowl('铜钵',(-1.25+i*.8,.52,.45+row*.65),.29,M['tin'] if i%2 else M['metal'])
        CATEGORY='05 工具';cyl('铆器木墩',(-2.1,-2.55,.48),.32,.45,M['wood']);box('铜锤头',(-2.1,-2.55,.83),(.25,.12,.14),M['metal']);line('铜锤柄',[(-2.1,-2.55,.8),(-1.7,-2.55,.8)],.035,M['wood'])
    elif theme=='toys':
        for i in range(5):
            x=-1.25+i*.6
            cyl('彩木陀螺',(x,Y,Z+.17),.16,.24,[M['red'],M['jade'],M['gold']][i%3],r2=.025)
            cyl('陀螺轴',(x,Y,Z+.32),.023,.22,M['wood'])
        for i in range(4):
            x=-1.2+i*.8
            box('小木马身',(x,.5,1.2),(.5,.18,.25),M['woodLight'],bevel=.04)
            box('小木马颈',(x+.19,.5,1.4),(.15,.15,.3),M['woodLight'],(0,-.4,0))
            sphere('木马头',(x+.25,.5,1.54),.12,M['woodLight'],(1.4,.7,.7))
            for dx in [-.17,.17]:
                for dy in [-.12,.12]:cyl('木马车轮',(x+dx,.5+dy,.98),.10,.04,M['red'],(math.pi/2,0,0))
            line('风车竹杆',[(x,.5,1.7),(x,.5,2.48)],.014,M['bamboo'])
            for a in range(4):
                angle=a*math.pi/2;v=[(x,.45,2.48),(x+math.cos(angle)*.24,.45,2.48+math.sin(angle)*.24),(x+math.cos(angle+.8)*.2,.40,2.48+math.sin(angle+.8)*.2)]
                objmesh('彩纸风车翼',v,[(0,1,2)],[M['red'],M['jade'],M['gold'],M['paper']][a])
    elif theme=='produce':
        for i in range(5):
            x=-1.25+i*.6;basket('果蔬篮',(x,Y,Z),.27,.17)
            for k in range(9):
                xx=x+(k%3-1)*.12;yy=Y+(k//3-1)*.12
                sphere('新鲜果蔬',(xx,yy,Z+.23),.085,M['orange'] if i%2 else M['green'],(1,1,1 if i%2 else 1.6))
        for i in range(3):
            basket('大菜筐',(-1+i,.55,.45),.38,.4)
            for j in range(6):sphere('萝卜白根',(-1+i+random.uniform(-.2,.2),.55+random.uniform(-.2,.2),.9),.09,M['porcelain'],(.8,.8,2.5))
        plant('葱束',(-2.05,-2.5,.24),.28)
    elif theme=='antiques':
        for i in range(8):
            x=-1.35+(i%4)*.9;y=Y+(i//4)*.34
            box('八景小座',(x,y,Z),(.4,.26,.12),M['wood'])
            box('八景画屏',(x,y,Z+.3),(.34,.055,.46),M['paper'])
            for k in range(3):
                h=.12+random.random()*.18
                objmesh('画屏山形',[(x-.16+k*.08,y-.03,Z+.14),(x-.04+k*.08,y-.03,Z+.14+h),(x+.08+k*.08,y-.03,Z+.14)],[(0,1,2)],M['jade'])
        for i in range(3):
            pot('旧铜瓶',(-1+i,Y+.6,1.9),.19,.48,M['metal'])
        CATEGORY='05 工具';box('鉴物毡',(0,Y-.1,Z+.03),(.9,.45,.02),M['indigo']);cyl('篆刻印章',(.5,Y,Z+.22),.085,.28,M['stone'],n=4)
    elif theme=='flowers':
        for i in range(5):plant('盆栽花卉',(-1.3+i*.65,Y,Z),.20,True)
        for i in range(3):
            plant('大盆花树',(-1.25+i*1.2,.5,.45),.3,True)
        plant('门前桂叶',(-2,-2.4,.24),.35)
        plant('门前菊盆',(2,-2.4,.24),.32,True)
    elif theme=='sweets':
        for i in range(4):
            x=-1.1+i*.72;basket('糕点竹盘',(x,Y,Z),.3,.09)
            for j in range(7):
                a=j*TAU/7
                cyl('芝麻圆糕',(x+math.cos(a)*.17,Y+math.sin(a)*.17,Z+.13),.085,.055,M['grain'])
                for k in range(3):sphere('糕面芝麻',(x+math.cos(a)*.17+random.uniform(-.04,.04),Y+math.sin(a)*.17+random.uniform(-.04,.04),Z+.16),.008,M['ivory'],(1,2,.4))
        for i in range(5):
            x=-1.3+i*.6;line('糖画竹签',[(x,.3,1.18),(x,.3,2.15)],.012,M['bamboo'])
            ring('糖画花形',(x,.3,2.15),.17,M['sweet'],.018,True)
            for a in range(5):line('糖画花瓣',[(x,.3,2.15),(x+math.cos(a*TAU/5)*.16,.3,2.15+math.sin(a*TAU/5)*.16)],.014,M['sweet'])
        CATEGORY='05 工具';cyl('糖锅',(-1.5,.25,1.2),.27,.18,M['metal']);line('糖勺柄',[(-1.5,.25,1.3),(-1.15,.25,1.55)],.025,M['wood'])
    elif theme=='embroidery':
        for i in range(8):
            x=-1.3+i*.37;cyl('彩线木轴',(x,Y,Z+.12),.07,.23,M['woodLight'])
            cyl('五色绣线',(x,Y,Z+.12),.095,.14,[M['red'],M['jade'],M['gold'],M['rose']][i%4])
        for i in range(5):
            x=-1.3+i*.62;sphere('绣花香囊',(x,.4,1.85),.15,[M['red'],M['jade'],M['rose']][i%3],(.8,.3,1.3))
            line('香囊系绳',[(x,.4,2),(x,.4,2.45)],.008,M['gold'])
            for j in range(5):line('香囊流苏',[(x+(j-2)*.025,.4,1.7),(x+(j-2)*.025,.4,1.48)],.005,M['gold'])
        CATEGORY='05 工具'
        ring('绣绷竹框',(0,Y,Z+.1),.38,M['bamboo'],.035)
        cyl('绣绷绢面',(0,Y,Z+.1),.35,.012,M['ivory'])
        for a in range(6):sphere('绣面花瓣',(math.cos(a*TAU/6)*.12,Y+math.sin(a*TAU/6)*.12,Z+.12),.09,M['rose'],(1,.5,.08))
    elif theme=='tea':
        for row in range(3):
            for i in range(6):
                x=-1.35+i*.54;z=.45+row*.65
                cyl('封签茶罐',(x,.5,z+.2),.18,.4,M['jade'] if i%2 else M['ivory'])
                cyl('茶罐木盖',(x,.5,z+.41),.19,.04,M['woodLight'])
                text('茶名签',['龙井','白茶','红茶','毛峰','乌龙','花茶'][i],(x,.31,z+.2),.09)
        box('竹茶盘',(0,Y,Z),(1.8,.6,.06),M['bamboo'],bevel=.025)
        pot('紫砂茶壶',(0,Y,Z+.06),.22,.30,M['clay'])
        line('茶壶弯嘴',[(.18,Y,Z+.16),(.33,Y,Z+.22),(.37,Y,Z+.3)],.032,M['clay'])
        ring('茶壶把',(-.22,Y,Z+.23),.13,M['clay'],.027,True)
        for i in range(4):bowl('品茗小盏',(-.6+i*.4,Y-.22,Z+.06),.10,M['porcelain'])
        basket('散茶试闻盘',(-1.2,Y,Z),.26,.10)
        for i in range(20):sphere('散茶叶',(-1.2+random.uniform(-.18,.18),Y+random.uniform(-.18,.18),Z+.12),.035,M['leaf'],(1.8,.3,.25))
    elif theme=='incense':
        for row in range(3):
            for i in range(5):
                x=-1.3+i*.65;z=.45+row*.65
                box('线香匣',(x,.5,z+.08),(.52,.4,.15),M['woodLight'],bevel=.015)
                box('香匣纸封',(x,.5,z+.165),(.15,.41,.012),M['paper'])
        for i in range(3):
            x=-1+i;bowl('铜香炉',(x,Y,Z+.1),.24,M['metal'])
            for k in range(3):cyl('香炉三足',(x+math.cos(k*TAU/3)*.14,Y+math.sin(k*TAU/3)*.14,Z+.07),.025,.15,M['metal'])
            cyl('香灰',(x,Y,Z+.25),.17,.015,M['stone'])
            for k in range(3):line('线香',[(x+(k-1)*.06,Y,Z+.24),(x+(k-1)*.06,Y,Z+.65)],.008,M['wood'])
        CATEGORY='05 工具'
        line('盘香',[(1.3+(.03+i*.0014)*math.cos(i*.16),Y+(.03+i*.0014)*math.sin(i*.16),Z+.07) for i in range(120)],.012,M['woodLight'])
    # A shop-specific price plaque and tools add readable human scale.
    CATEGORY='02 招牌'
    box('小价牌',(.95,Y-.43,Z-.03),(.52,.035,.22),M['paper'])
    text('手写小价签','手作 · 精选',(.95,Y-.455,Z-.03),.09,M['ink'])
    records.append({'code':code,'name':name,'theme':theme,'sourceCollection':oldname,'sourceMaster':mastername,'anchor':anchor,
                    'location':list(control.location),'rotation':list(control.rotation_euler),
                    'originalMatrix':[list(row) for row in original_matrix],
                    'groups':{key:len(g.objects) for key,g in groups.items()}})
    print('SHOP',code,name,sum(len(g.objects) for g in groups.values()),flush=True)

# Organise original environment and loose imported-shop props separately from shops.
CURRENT=None;CATEGORY='03 陈列'
LOOSE=collection('午市 · 公共灯架与原有配件',ENV)
for o in list(scene.objects):
    if not o.get('shopCode') and o.type not in {'LIGHT','CAMERA'} and not o.parent and any(k in o.name for k in ['灯架','灯笼','陈设_']):
        bpy.context.view_layer.update()
        nearest=min(records,key=lambda r:(Vector(r['location']).xy-o.matrix_world.translation.xy).length)
        distance=(Vector(nearest['location']).xy-o.matrix_world.translation.xy).length
        if distance<3.5:
            code=nearest['code'];name=nearest['name'];control=bpy.data.objects[code+'_'+name+' · 总控']
            matrix=o.matrix_world.copy();o.parent=control;o.matrix_world=matrix
            move(o,bpy.data.collections[code+' · 03 陈列']);o.name=code+'_'+name+' · '+o.name
            o['shopCode']=code;o['shopTheme']=name
        else:move(o,LOOSE)
# Painted plaster portals signal the two courtyards.
for x,y,words in [(-4,-21.2,'午 市 百 业'),(10.641,22.2,'满 载 而 归')]:
    box('院门 · 题额',(x,y-.18,3.25),(2.75,.12,.65),M['indigo'],bevel=.025)
    text('院门 · '+words,words,(x,y-.25,3.25),.37,M['paper'])
# Relieve the empty courts with low planters, seats and goods carts outside the main paths.
for x,y in [(-12,3),(-5,2),(6,13.5),(13,6)]:
    box('院落花池 · 砌石',(x,y,.35),(1.45,.8,.45),M['stone'],bevel=.06)
    for j in range(3):plant('院落草木',(x-.45+j*.45,y,.54),.14)
    table('院落长凳',(x,y-1,.17),w=1.8,d=.4,h=.48)
for x,y in [(-14,5),(13,14.5)]:
    table('卸货板车',(x,y,.12),w=1.7,d=.95,h=.5)
    for side in [-1,1]:
        cyl('板车木轮',(x,y+side*.62,.46),.35,.09,M['wood'],(math.pi/2,0,0),n=24)
        ring('车轮轮箍',(x,y+side*.67,.46),.34,M['metal'],.018,True)
        line('板车长辕',[(x+.4,y+side*.4,.65),(x+2.25,y+side*.4,.85)],.045,M['wood'])
    for i in range(3):box('卸货木箱',(x-.5+i*.48,y,.95),(.45,.62,.62),M['woodLight'],bevel=.02)
# Slate joints and pale stone curb strips articulate the courtyards without changing their extent.
for cx,cy,w,d in [(-10,-2,17,25),(10,8.597,17,17)]:
    for side in [-1,1]:box('院落铺地 · 青石边线',(cx+side*w/2,cy,.145),(.14,d,.04),M['stone'])
    for i in range(int(d/1.15)):
        yy=cy-d/2+i*1.15
        line('院落铺地 · 横缝',[(cx-w/2,yy,.125),(cx+w/2,yy,.125)],.007,M['rock'])
    for i in range(int(w/1.6)):
        xx=cx-w/2+i*1.6
        line('院落铺地 · 纵缝',[(xx,cy-d/2,.125),(xx,cy+d/2,.125)],.006,M['rock'])

# Daylight is deliberately higher and more neutral than the warm morning scene.
for o in list(scene.objects):
    if o.type in {'LIGHT','CAMERA'}:bpy.data.objects.remove(o,do_unlink=True)
world=bpy.data.worlds.new('午 · 晴空散射');world.use_nodes=True;scene.world=world
world.node_tree.nodes['Background'].inputs[0].default_value=(.52,.68,.85,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.65
ld=bpy.data.lights.new('午 · 高位日光','SUN');ld.energy=3.0;ld.angle=.055;ld.color=(1,.96,.88)
sun=bpy.data.objects.new(ld.name,ld);LIGHTS.objects.link(sun);sun.rotation_euler=(.42,-.23,-.65)
ld=bpy.data.lights.new('午 · 天空柔补','AREA');ld.energy=900;ld.shape='DISK';ld.size=30;ld.color=(.76,.88,1)
fill=bpy.data.objects.new(ld.name,ld);LIGHTS.objects.link(fill);fill.location=(0,-6,22)
def camera(name,p,target,ortho=None,lens=42):
    d=bpy.data.cameras.new(name);o=bpy.data.objects.new(name,d);CAMERAS.objects.link(o);o.location=p
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();d.lens=lens;d.clip_end=250
    if ortho:d.type='ORTHO';d.ortho_scale=ortho
    return o
overview=camera('01 午市 · 双院总览',(43,-61,53),(0,0,0),73)
west=camera('02 午市 · 百货院近景',(-6,-3,4.2),(-9,9.5,1.7),lens=35)
east=camera('03 午市 · 手作院近景',(8,3.5,4.2),(18.7,9,1.7),lens=34)
details=[]
for i in [0,2,6,7,10,15]:
    r=records[i];ctrl=bpy.data.objects[r['code']+'_'+r['name']+' · 总控'];bpy.context.view_layer.update()
    p=ctrl.matrix_world@Vector((5,-8,4.3));t=ctrl.matrix_world@Vector((0,-.5,1.5))
    details.append(camera(f"{r['code']} · {r['name']} · 细节",p,t,lens=44))
scene.camera=overview
scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=True;scene.cycles.device='CPU'
scene.render.resolution_x=1600;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=0
scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.film_transparent=False
scene['artDirection']='午市：粉白与蓝灰建筑，靛青/豆青/朱砂分铺，高位中性日光、短投影；双院百业。'
scene['shopCount']=len(records);scene['authoringRevision']='noon-new-upload-eighteen-trades-02';scene['sourceSha256']=SOURCE_HASH
notes=bpy.data.texts.new('请先读我 · 午市店铺索引')
notes.write('午市 · 十八铺百业\n\n基于新上传的 17 MB 工程，保持每家建筑总控的位置和朝向。所有材质和字体随工程打包。\n建筑/招牌/陈列/商品/工具分组，N01—N18 对应店铺。\n午间高位中性日光；粉白、蓝灰、豆青、靛蓝为主，朱砂点缀。\n\n')
for r in records:notes.write(f"{r['code']}  {r['name']}  |  {r['sourceCollection']}\n")
notes.write('\n相机：01 总览，02 百货院，03 手作院，另有六个店铺细节相机。\n此次仅编辑 Blender 源工程，网页 GLB 未替换。\n')
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_perspective='CAMERA'
            a.spaces.active.shading.type='MATERIAL'
            a.spaces.active.shading.use_scene_world=True;a.spaces.active.shading.use_scene_lights=True
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(CANDIDATE))
report={'source':str(TARGET.relative_to(ROOT)),'sourceSha256':SOURCE_HASH,'backup':str(BASE.relative_to(ROOT)),'shops':records,
        'objects':len(scene.objects),'meshes':sum(o.type=='MESH' for o in scene.objects),
        'vertices':sum(len(o.data.vertices) for o in scene.objects if o.type=='MESH'),
        'packedImages':sum(bool(im.packed_file) for im in bpy.data.images),'packedFonts':sum(bool(f.packed_file) for f in bpy.data.fonts)}
(OUT/'店铺清单与检查.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('CANDIDATE SAVED',report['objects'],'objects',report['vertices'],'vertices',flush=True)
if '--skip-render' not in sys.argv:
    shots=[(overview,'01-午市总览'),(west,'02-百货院'),(east,'03-手作院')]
    if '--all-details' in sys.argv:shots += [(c,c.name.split(' · 细节')[0]) for c in details]
    for cam,filename in shots:
        scene.camera=cam;scene.render.filepath=str(OUT/(filename+'.png'));bpy.ops.render.render(write_still=True)
        print('RENDERED',filename,flush=True)
print('DONE',flush=True)
