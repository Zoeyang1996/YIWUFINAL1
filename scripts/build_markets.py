"""Refine the supplied Blender maps, embed shops, export matching web maps + navigation.
Run with Blender 4.5: blender -b --factory-startup --python scripts/build_markets.py
Original white-model files are never overwritten.
"""
import bpy, math, json, random, sys
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets/markets'; PREVIEW=ROOT/'previews/markets'
OUT.mkdir(parents=True,exist_ok=True);PREVIEW.mkdir(parents=True,exist_ok=True)
CONFIG={
 'morning':{'folder':'早','file':'01_早市_独立白模.blend','spawn':[-7,-18,0.2], 'shops':[
 ('breakfast','建筑 · 早餐铺','早餐摊/早餐摊贩.glb'),('tea','建筑 · 茶器','茶水摊/茶水摊贩.glb'),
 ('toys','摊位 · 木铃','玩具摊/玩具摊贩.glb'),('sundries','建筑 · 货郎记忆','杂物摊/杂物摊贩.glb')]},
 'noon':{'folder':'午','file':'02_午市_独立白模.blend','spawn':[-4,-20,0.2], 'shops':[
 ('fans','建筑 · 西院南铺二','扇子摊/扇子摊.glb'),('grocery','建筑 · 西院北铺一','杂货摊/杂物摊贩.glb'),
 ('daily','建筑 · 东院南铺一','日用小摊/日用小摊贩.glb'),('sundries-noon','建筑 · 东院北铺','杂货摊/杂物摊贩.glb')]},
 'night':{'folder':'夜','file':'03_夜市_独立白模.blend','spawn':[-8,-16,0.65], 'shops':[
 ('brew','山铺 · 坡脚热食铺','酿酒杂货摊/ye4.glb'),('antiques','山铺 · 西台旧物铺','古董摊/古董铺.glb'),
 ('lanterns','山铺 · 西台烛火铺','花灯摊/ye3.glb'),('craft','山铺 · 东台饰物铺','手作摊/ye1.glb')]}}
def web(v):return [round(v[0],4),round(v[2],4),round(-v[1],4)]
def bounds(objects):
 points=[o.matrix_world@Vector(c) for o in objects if o.type=='MESH' for c in o.bound_box]
 return Vector([min(v[i] for v in points) for i in range(3)]),Vector([max(v[i] for v in points) for i in range(3)])
def material(name,color,kind,roughness=.88):
 m=bpy.data.materials.new('市集 · '+name);m.use_nodes=True;m.diffuse_color=(*color,1)
 nodes=m.node_tree.nodes;p=nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=roughness
 size=256;y,x=np.mgrid[0:size,0:size]/size;rng=np.random.default_rng(19)
 noise=rng.normal(0,.025,(size,size));tone=np.ones((size,size))
 if kind=='wood':tone+=.08*np.sin(x*100+3*np.sin(y*9))+.035*np.sin(x*310+y*13)+noise
 elif kind=='cloth':tone+=.04*np.sin(x*math.pi*128)+.04*np.sin(y*math.pi*128)+noise
 elif kind=='stone':
  rows=np.floor(y*8);xx=(x*6+(rows%2)*.5)%1;yy=(y*8)%1
  tone-=.18*((xx<.025)|(yy<.035));tone+=noise+.03*np.sin(rows*8+np.floor(x*6)*3)
 elif kind=='tile':tone+=.09*np.cos(x*math.pi*24)-.16*((y*8)%1<.06)+noise
 elif kind=='water':tone+=.04*np.sin(y*95+np.sin(x*15)*3)+noise*.3
 else:tone+=noise+.025*np.sin(x*40)*np.sin(y*38)
 pixels=np.ones((size,size,4),dtype=np.float32)
 pixels[:,:,:3]=np.clip(tone[:,:,None]*np.array(color)[None,None,:],0,1)
 image=bpy.data.images.new(name+' · 细纹',width=size,height=size);image.pixels.foreach_set(pixels.ravel());image.pack()
 tex=nodes.new('ShaderNodeTexImage');tex.image=image;tex.extension='REPEAT';m.node_tree.links.new(tex.outputs['Color'],p.inputs['Base Color'])
 return m

def cube(name,loc,scale,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);return o

def uv_world(o,scale=1):
 if o.type!='MESH':return
 uv=o.data.uv_layers.active or o.data.uv_layers.new(name='WorldScaleUV')
 for poly in o.data.polygons:
  n=o.matrix_world.to_3x3()@poly.normal;axis=max(range(3),key=lambda i:abs(n[i]));axes=[i for i in range(3) if i!=axis]
  for li in poly.loop_indices:
   v=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co
   uv.data[li].uv=(v[axes[0]]/scale,v[axes[1]]/scale)

def nav_triangles(o):
 o.data.calc_loop_triangles();result=[]
 for t in o.data.loop_triangles:
  v=[o.matrix_world@o.data.vertices[i].co for i in t.vertices]
  n=(v[1]-v[0]).cross(v[2]-v[0])
  if n.length and n.normalized().z>.45:result.append([web(p) for p in v])
 return result

for phase,cfg in CONFIG.items():
 if len(sys.argv)>1 and '--' in sys.argv and phase not in sys.argv[sys.argv.index('--')+1:]:continue
 random.seed(23)
 source=ROOT/'资产包/首页'/cfg['folder']/'二级场景'/cfg['file']
 bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
 # Remove preview lights/cameras only; all source terrain/path/architecture remains editable.
 for o in list(scene.objects):
  if o.type in {'LIGHT','CAMERA'}:bpy.data.objects.remove(o,do_unlink=True)
 mats={
 'earth':material('苔土',(.43,.48,.31),'plaster'), 'stone':material('米灰石板',(.60,.57,.47),'stone'),
 'rock':material('溪岸山石',(.43,.46,.41),'plaster'), 'wood':material('旧榆木',(.42,.28,.17),'wood'),
 'wall':material('暖灰粉墙',(.82,.77,.65),'plaster'),'tile':material('青灰瓦',(.23,.30,.31),'tile'),
 'cloth':material('赭色麻布',(.65,.34,.22),'cloth'),'leaf':material('灰绿树叶',(.34,.44,.25),'plaster'),
 'water':material('溪水青',(.20,.43,.43),'water',.27),'paper':material('暖纸灯',(.95,.62,.28),'cloth'),
 'clay':material('粗陶',(.56,.32,.22),'plaster')}
 bs=mats['paper'].node_tree.nodes.get('Principled BSDF');bs.inputs['Emission Color'].default_value=(1,.43,.10,1);bs.inputs['Emission Strength'].default_value=2 if phase=='night' else .15
 source_meshes=[o for o in scene.objects if o.type=='MESH']
 nav=[];water=[];blockers=[];occluders=[]
 for o in source_meshes:
  name=o.name
  if any(k in name for k in ['连续路面','完整地坪',' 石阶',' 石路','转角接续平台','平台面','木桥桥面板','台基','前阶']):nav+=nav_triangles(o)
  if '整体自然地貌' in name and phase!='night':nav+=nav_triangles(o)
  if '溪面' in name:
   # Water boundary in x/z, separately checked even when terrain covers the stream.
   for t in nav_triangles(o):water.append(t)
  key='wood'
  if '整体自然' in name:key='earth'
  elif '溪面' in name:key='water'
  elif any(k in name for k in ['树冠']):key='leaf'
  elif any(k in name for k in ['岩','柱础']):key='rock'
  elif any(k in name for k in ['屋面','屋顶','牌坊顶']):key='tile'
  elif any(k in name for k in ['墙']):key='wall'
  elif any(k in name for k in ['棚面','纸伞']):key='cloth'
  elif any(k in name for k in ['路','石阶','平台','地坪','台基','前阶']):key='stone'
  o.data=o.data.copy()
  o.data.materials.clear();o.data.materials.append(mats[key]);uv_world(o,3 if key in ['earth','stone','tile'] else 1.5)
  o['surface']=key
  if key=='water':o['water']=True
  if key in ['tile','leaf'] or '墙' in name:o['occluder']=True
 # The visible planks have small gaps: navigation uses one continuous deck surface.
 deck=[o for o in source_meshes if '木桥桥面板' in o.name]
 if deck:
  lo,hi=bounds(deck)
  a=web((lo.x,lo.y,hi.z));b=web((hi.x,lo.y,hi.z));c=web((hi.x,hi.y,hi.z));d=web((lo.x,hi.y,hi.z))
  nav.extend([[a,b,c],[a,c,d]])
 # Finish the original bridge landings: the source bridge stops short of both plateau paths.
 if phase=='night':
  for x,width in [(-8,8),(6.5,5)]:
   landing=cube('桥头接续石台',(x,8,4.87),(width,2.8,.18),mats['stone'])
   uv_world(landing,3);nav+=nav_triangles(landing)
 # Original building footprints are collision boundaries, not the old rectangular street.
 selected_collections={item[1] for item in cfg['shops']}
 for coll in list(bpy.data.collections):
  if not coll.name.startswith(('建筑 ·','山铺 ·','摊位 ·')):continue
  meshes=[o for o in coll.objects if o.type=='MESH']
  if not meshes:continue
  lo,hi=bounds(meshes)
  # Small walkable front apron remains free.
  blockers.append({'min':web((lo.x+.15,hi.y-.15,lo.z)), 'max':web((hi.x-.15,lo.y+.15,hi.z)), 'collection':coll.name})
 metadata={'phase':phase,'source':str(source.relative_to(ROOT)),'spawn':web(cfg['spawn']),'stalls':[],'navigation':nav,'water':water,'blockers':blockers}
 for stall_id,collection_name,asset in cfg['shops']:
  coll=bpy.data.collections[collection_name];original=list(coll.objects)
  control=next(o for o in original if o.type=='EMPTY');transform=control.matrix_world.copy()
  lo,hi=bounds(original);center=transform.translation.copy();base=lo.z+.24
  fronts=[o for o in original if '柜台面' in o.name or o.name.startswith('台面')]
  if fronts:
   a,b=bounds(fronts);front=(a+b)*.5
  else:front=transform@Vector((0,-2,0))
  normal=(transform.to_3x3()@Vector((0,-1,0))).normalized()
  # The source creek-side placeholder counters face outward; turn the imported shops toward the actual loop.
  if phase=='morning' and stall_id in {'breakfast','tea','sundries'}:
   normal=Vector((1 if stall_id!='sundries' else -1,0,0))
   transform=Matrix.Translation(center)@Matrix.Rotation(math.atan2(normal.x,-normal.y),4,'Z')
  # Retain foundation/steps; replace the selected white placeholder shop as a whole.
  for o in original:
   if o.type in {'MESH','CURVE'} and not any(k in o.name for k in ['台基','前阶','平台面','岩台']):bpy.data.objects.remove(o,do_unlink=True)
  before=set(scene.objects)
  bpy.ops.import_scene.gltf(filepath=str(source.parent/'三级店铺'/asset))
  imported=[o for o in scene.objects if o not in before];meshes=[o for o in imported if o.type=='MESH']
  bpy.context.view_layer.update();mn,mx=bounds(meshes);size=mx-mn
  factor=min(4.25/max(size.x,size.y),3.65/size.z)
  anchor=bpy.data.objects.new('Shop_'+stall_id,None);scene.collection.objects.link(anchor)
  # Bake each imported object's full hierarchy into the source map's world transform.
  offset=Vector((-(mn.x+mx.x)/2,-(mn.y+mx.y)/2,-mn.z))
  placement=Matrix.Translation(Vector((center.x,center.y,base)))@transform.to_3x3().to_4x4()@Matrix.Scale(factor,4)@Matrix.Translation(offset)
  for o in meshes:
   matrix=placement@o.matrix_world.copy();o.parent=anchor;o.matrix_world=matrix;o['stallId']=stall_id
   for slot in o.material_slots:
    if not slot.material:continue
    slot.material=slot.material.copy();p=slot.material.node_tree.nodes.get('Principled BSDF')
    if p:p.inputs['Roughness'].default_value=.86;p.inputs['Metallic'].default_value=0
  for o in imported:
   if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
  bpy.context.view_layer.update();mn,mx=bounds(meshes)
  focus=Vector((center.x,center.y,base+1.45));approach=Vector((center.x,center.y,base))+normal*3.4
  metadata['stalls'].append({'id':stall_id,'position':web((center.x,center.y,base)), 'focus':web(focus),'normal':web(normal),'approach':web(approach),'bounds':[web(mn),web(mx)],'node':'Shop_'+stall_id})
  # Stock, paper lanterns and small ceramics use the same shared palette.
  tangent=Vector((-normal.y,normal.x,0))
  for sign in [-1,1]:
   p=Vector((center.x,center.y,base))+tangent*(2.35*sign)+normal*.2
   cube('陈设_木箱_'+stall_id, p+Vector((0,0,.24)),(.6,.6,.48),mats['wood'])
   for z in [.12,.37]:cube('陈设_木箱箍',p+Vector((0,0,z)),(.63,.63,.035),mats['wood'])
   bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.23,location=p+Vector((0,0,2.4)));lamp=bpy.context.object;lamp.name='灯笼_'+stall_id;lamp.scale.z=1.2;lamp.data.materials.append(mats['paper'])
   cube('灯架',p+Vector((0,0,1.4)),(.06,.06,2.8),mats['wood'])
   if phase=='night':
    light=bpy.data.lights.new('摊前暖灯','POINT');light.energy=75;light.color=(1,.5,.2);light.shadow_soft_size=1
    o=bpy.data.objects.new('摊前暖灯',light);scene.collection.objects.link(o);o.location=p+Vector((0,0,2.1))
 # Original roof edging uses curves; give these the same slate finish as the roofs.
 for o in list(scene.objects):
  if o.type=='CURVE':
   o.data.materials.clear();o.data.materials.append(mats['tile'])
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
   bpy.ops.object.convert(target='MESH');uv_world(bpy.context.object,3)
 # Add subtle roof ridges and flower pots at original structures, not a replacement map.
 for o in list(scene.objects):
  if o.type=='MESH' and not o.data.uv_layers:uv_world(o)
 scene.world=bpy.data.worlds.new('市集环境');scene.world.use_nodes=True
 scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.18,.23,.36,1) if phase=='night' else (.72,.78,.83,1)
 scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45 if phase=='night' else .7
 light=bpy.data.lights.new('月光' if phase=='night' else '天光','SUN');light.energy=1.5 if phase=='night' else 2;light.angle=.15;light.color=(.62,.73,1) if phase=='night' else (1,.9,.73)
 o=bpy.data.objects.new('主光',light);scene.collection.objects.link(o);o.rotation_euler=(.45,-.5,-.5)
 bpy.ops.object.camera_add(location=(46,-64,62));camera=bpy.context.object;camera.name='精修总览'
 camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=76;scene.camera=camera
 scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=True;scene.cycles.device='CPU'
 scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
 scene.view_settings.view_transform='AgX'
 scene.render.image_settings.file_format='PNG'
 scene.render.film_transparent=False
 scene.render.image_settings.color_mode='RGB'
 bpy.ops.file.pack_all()
 refined=source.with_name(source.stem.replace('独立白模','场景精修')+'.blend')
 bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(refined))
 (OUT/f'{phase}.json').write_text(json.dumps(metadata,ensure_ascii=False,separators=(',',':')))
 scene.render.filepath=str(PREVIEW/f'{phase}-refined.png');bpy.ops.render.render(write_still=True)
 # Merge environment pieces by material ONLY in the web export. The saved blend stays editable.
 meshes=[o for o in scene.objects if o.type=='MESH' and not o.get('stallId')]
 batches={}
 for o in meshes:
  key=(o.data.materials[0].name if o.data.materials else '',bool(o.get('occluder')),bool(o.get('water')))
  batches.setdefault(key,[]).append(o)
 for key,objects in batches.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();joined=bpy.context.object
  joined.name='Environment_'+key[0];joined['occluder']=key[1];joined['water']=key[2]
 bpy.ops.object.select_all(action='DESELECT')
 for o in scene.objects:
  if o.type in {'MESH','EMPTY'}:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/f'{phase}.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_apply=True)
 print('COMPLETED',phase,'navigation',len(nav),'shops',len(metadata['stalls']),flush=True)
