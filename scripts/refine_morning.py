"""Edit the existing morning .blend; backup input is the reproducible baseline.
Run: Blender -b --factory-startup --python scripts/refine_morning.py
"""
import bpy, math, random, json
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'previews/markets/morning-before'
TARGET=ROOT/'资产包/首页/早/二级场景/01_早市_场景精修.blend'
# Reuse helpers only, never run the white-model rebuild loop.
exec((ROOT/'scripts/build_markets.py').read_text().split('for phase,cfg in CONFIG.items():')[0])
bpy.ops.wm.open_mainfile(filepath=str(BASE/TARGET.name))
scene=bpy.context.scene;random.seed(42)
meta=json.loads((BASE/'morning.json').read_text())
newcoll=bpy.data.collections.new('精修02 · 沿街民居与生活陈设');scene.collection.children.link(newcoll)
def move_coll(o,c=newcoll):
 for old in list(o.users_collection):old.objects.unlink(o)
 c.objects.link(o)
def box(name,p,s,m,rot=0):
 o=cube(name,p,s,m);o.rotation_euler.z=rot;move_coll(o);uv_world(o,2)
 bevel=o.modifiers.new('手工边角','BEVEL');bevel.width=.025;bevel.segments=2
 return o
wood=bpy.data.materials['市集 · 旧榆木'];tile=bpy.data.materials['市集 · 青灰瓦'];stone=bpy.data.materials['市集 · 米灰石板'];cloth=bpy.data.materials['市集 · 赭色麻布']
wall=material('风化石灰墙',(.71,.66,.53),'plaster');dark=material('窗内阴影',(.13,.16,.13),'wood');ochre=material('麦色篷布',(.68,.54,.31),'cloth')
# Packed multiscale albedo and bump maps also survive glTF export.
def natural_mat(name,c0,c1,scale):
 m=bpy.data.materials[name];m.use_nodes=True;n=m.node_tree.nodes;l=m.node_tree.links;p=n.get('Principled BSDF')
 rng=np.random.default_rng(52);sz=512
 def smooth_grid(k):
  a=rng.random((k,k));coord=np.arange(sz)*k/sz;i=np.floor(coord).astype(int);f=coord-i;f=f*f*(3-2*f)
  return ((1-f[:,None])*((1-f[None,:])*a[i[:,None]%k,i[None,:]%k]+f[None,:]*a[i[:,None]%k,(i[None,:]+1)%k])+f[:,None]*((1-f[None,:])*a[(i[:,None]+1)%k,i[None,:]%k]+f[None,:]*a[(i[:,None]+1)%k,(i[None,:]+1)%k]))
 v=.42*smooth_grid(5)+.28*smooth_grid(21)+.2*smooth_grid(70)+.1*rng.random((sz,sz));v=np.clip((v-.22)*1.8,0,1)
 rgba=np.ones((sz,sz,4),dtype=np.float32);rgba[:,:,:3]=np.array(c0)[None,None,:]*(1-v[:,:,None])+np.array(c1)[None,None,:]*v[:,:,None]
 im=bpy.data.images.new(name+' · 土壤矿物纹理',width=sz,height=sz);im.pixels.foreach_set(rgba.ravel());im.pack()
 tex=n.new('ShaderNodeTexImage');tex.image=im;l.new(tex.outputs['Color'],p.inputs['Base Color'])
 bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.38;bump.inputs['Distance'].default_value=.09;l.new(tex.outputs['Color'],bump.inputs['Height']);l.new(bump.outputs['Normal'],p.inputs['Normal']);p.inputs['Roughness'].default_value=.94
 for o in scene.objects:
  if o.type=='MESH' and any(s.material==m for s in o.material_slots):uv_world(o,scale)
 return m
natural_mat('市集 · 苔土',(.12,.20,.07),(.36,.42,.17),8)
natural_mat('市集 · 溪岸山石',(.22,.25,.23),(.53,.51,.43),2.5)
# Smooth sampled Catmull-Rom street, with editable quad surface and subdivision.
road=bpy.data.objects['溪畔主路 · 连续路面'];vs=[road.matrix_world@v.co for v in road.data.vertices]
centers=[(vs[i]+vs[i+1])*.5 for i in range(0,len(vs),2)]
centers[1].x=-6.0;centers[2].x=-6.5
for o in list(scene.objects):
 if '连续路面' in o.name:bpy.data.objects.remove(o,do_unlink=True)
roads=[];road_samples=[]
def street(name,pts,width):
 pts=[Vector(p) for p in pts];samples=[]
 for i in range(len(pts)-1):
  a,b,c,d=pts[max(0,i-1)],pts[i],pts[i+1],pts[min(len(pts)-1,i+2)]
  for j in range(12):
   t=j/12;samples.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 samples.append(pts[-1]);verts=[];faces=[]
 for i,p in enumerate(samples):
  tangent=(samples[min(i+1,len(samples)-1)]-samples[max(i-1,0)]).normalized();n=Vector((-tangent.y,tangent.x,0))
  for f in [-.5,-.47,0,.47,.5]:verts.append(tuple(p+n*width*f+Vector((0,0,.065))))
 for i in range(len(samples)-1):
  for j in range(4):k=i*5+j;faces.append((k,k+5,k+6,k+1))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.data.materials.append(stone);uv_world(o,2)
 sub=o.modifiers.new('道路细分曲面 · 连续圆弯','SUBSURF');sub.levels=1;sub.render_levels=2
 sol=o.modifiers.new('路基厚度','SOLIDIFY');sol.thickness=.09
 roads.append(o);road_samples.extend([(p,width) for p in samples])
 # Slim stone edging follows both sides without jagged corners.
 for side in [-1,1]:
  c=bpy.data.curves.new(name+' · 石缘','CURVE');c.dimensions='3D';c.bevel_depth=.055;c.bevel_resolution=2
  spl=c.splines.new('POLY');spl.points.add(len(samples)-1)
  for i,p in enumerate(samples):
   t=(samples[min(i+1,len(samples)-1)]-samples[max(i-1,0)]).normalized();q=p+Vector((-t.y,t.x,0))*width*.5*side+Vector((0,0,.07));spl.points[i].co=(*q,1)
  ob=bpy.data.objects.new(c.name,c);scene.collection.objects.link(ob);c.materials.append(stone)
 return samples
main=street('溪畔主街 · 弯曲细分石板路',centers,3.65)
street('桥头弯巷 · 细分石板路',[(-7,6,.23),(-9,5.9,.23),(-12,6,.23)],2.8)
street('内街 · 木铃摊前弯巷',[(-5.1,-1,.21),(-1,-5.7,.22),(3.8,-9.5,.22),(8,-10.5,.2),(11.4,-10.3,.19)],2.35)
# Correct ALL retained architecture/stall facades towards the closest street.
def closest(p):return min(road_samples,key=lambda s:(s[0].x-p.x)**2+(s[0].y-p.y)**2)[0]
for coll in list(bpy.data.collections):
 if not coll.name.startswith(('建筑 ·','摊位 ·')):continue
 ctrl=next((o for o in coll.objects if o.type=='EMPTY'),None)
 if ctrl is None or len(coll.objects)<5:continue
 
 if coll.name=='建筑 · 日用食器':ctrl.location.x=-1;ctrl.location.y=-13
 bpy.context.view_layer.update()
 p=ctrl.matrix_world.translation;dest=closest(p);normal=(dest-p);normal.z=0;normal.normalize();angle=math.atan2(normal.x,-normal.y)
 # Parent controls preserve original local meshes.
 ctrl.rotation_euler.z=angle
bpy.context.view_layer.update()
# Four interactive shops: same IDs, origins, meshes, with a little more frontage room west.
for stall in meta['stalls']:
 dx=2.25 if stall['id']=='breakfast' else 1.5 if stall['id']=='tea' else 0
 if dx:
  for o in scene.objects:
   if o.get('stallId')==stall['id'] or (o.name.startswith(('陈设_','灯架','灯笼_')) and abs(o.matrix_world.translation.x-(stall['position'][0]+.2))<.6 and abs(o.matrix_world.translation.y+stall['position'][2])<2.8):o.location.x+=dx
  for k in ['position','focus','approach']:stall[k][0]+=dx
  for p in stall['bounds']:p[0]+=dx
# Build articulated houses. Their local -Y facade always faces the street/shop.
houses=[]
def house(name,x,y,w=4.4,d=3.5,h=5.5,front=None):
 p=Vector((x,y,.2));n=Vector(front) if front else closest(p)-p;n.z=0;n.normalize();theta=math.atan2(n.x,-n.y);R=Matrix.Rotation(theta,4,'Z');created=[]
 def part(label,loc,size,mat):
  o=box(name+' · '+label,p+R@Vector(loc),size,mat,theta);created.append(o);return o
 part('石砌台基',(0,0,.14),(w+.25,d+.25,.28),stone)
 part('粉墙',(0,0,h/2+.26),(w,d,h),wall)
 part('勒脚',(0,0,.45),(w+.08,d+.08,.38),stone)
 for z in [2.85,h+.22]:part('横向木梁',(0,-d/2-.05,z),(w+.16,.14,.16),wood)
 for xx in [-w/2+.12,w/2-.12]:part('檐柱',(xx,-d/2-.11,h/2),(.14,.2,h),wood)
 # Dark recessed storefront and latticed upper windows.
 part('铺门',(0,-d/2-.06,1.45),(1.3,.1,2.2),dark)
 for xx in [-.69,.69]:part('门框',(xx,-d/2-.13,1.45),(.1,.15,2.3),wood)
 for z in ([1.7,4.05] if h>4.8 else [1.7]):
  for xx in [-w*.32,w*.32]:
   part('窗洞',(xx,-d/2-.07,z),(.85,.12,1.02),dark)
   for off in [-.43,0,.43]:part('窗格竖棂',(xx+off,-d/2-.15,z),(.055,.10,1.1),wood)
   for off in [-.53,0,.53]:part('窗格横棂',(xx,-d/2-.16,z+off),(.94,.1,.055),wood)
 # Side and rear windows make the lane-facing houses read as inhabited volumes.
 for side in [-1,1]:
  for z in ([1.7,4.05] if h>4.8 else [1.7]):
   part('侧窗洞',(side*(w/2+.04),0,z),(.08,.9,1.05),dark)
   for off in [-.47,0,.47]:part('侧窗棂',(side*(w/2+.1),off,z),(.1,.055,1.13),wood)
   for off in [-.56,.56]:part('侧窗框',(side*(w/2+.1),0,z+off),(.1,1,.06),wood)
  part('侧檐梁',(side*(w/2+.05),0,2.85),(.1,d,.14),wood)
 for xx in [-w*.27,w*.27]:
  part('后窗',(xx,d/2+.05,h*.7),(.8,.09,1.05),dark)
  for off in [-.43,0,.43]:part('后窗棂',(xx+off,d/2+.11,h*.7),(.05,.1,1.12),wood)
 # Solid triangular gable ends close the space below the pitched tiles.
 for side in [-1,1]:
  vv=[tuple(p+R@Vector((side*w/2,yy,zz))) for yy,zz in [(-d/2,h+.26),(d/2,h+.26),(0,h+1.42)]]
  mm=bpy.data.meshes.new('粉墙山墙');mm.from_pydata(vv,[],[(0,1,2)]);mm.update();oo=bpy.data.objects.new(name+' · 山墙',mm);newcoll.objects.link(oo);mm.materials.append(wall);uv_world(oo,2);created.append(oo)
 # Pitched roof with individually visible curved tile courses.
 rz=h+.28
 for side in [-1,1]:
  verts=[];faces=[];rows=7
  for j in range(rows+1):
   v=j/rows;yy=side*(d/2+.48)*v;zz=rz+1.18*(1-v)**1.45+.11*v**7
   for xx in [-w/2-.38,w/2+.38]:verts.append(tuple(p+R@Vector((xx,yy,zz))))
  for j in range(rows):faces.append((j*2,j*2+1,j*2+3,j*2+2) if side>0 else (j*2+2,j*2+3,j*2+1,j*2))
  me=bpy.data.meshes.new(name+'瓦坡');me.from_pydata(verts,[],faces);me.update();ob=bpy.data.objects.new(name+' · 青瓦坡屋顶',me);newcoll.objects.link(ob);me.materials.append(tile);uv_world(ob,2);ob['occluder']=True;created.append(ob)
  for xx in np.arange(-w/2-.32,w/2+.4,.23):
   cu=bpy.data.curves.new('瓦垄','CURVE');cu.dimensions='3D';cu.bevel_depth=.028;cu.bevel_resolution=1;s=cu.splines.new('POLY');s.points.add(rows)
   for j in range(rows+1):v=j/rows;q=p+R@Vector((xx,side*(d/2+.48)*v,rz+1.18*(1-v)**1.45+.11*v**7+.025));s.points[j].co=(*q,1)
   ob=bpy.data.objects.new(name+' · 瓦垄',cu);newcoll.objects.link(ob);cu.materials.append(tile);created.append(ob)
 part('屋脊',(0,0,rz+1.2),(w+.9,.17,.16),tile)
 awning=part('临街雨篷',(0,-d/2-.55,2.7),(w*.86,1.1,.09),ochre if len(houses)%2 else cloth)
 for xx in [-w*.4,w*.4]:part('篷柱',(xx,-d/2-1,1.4),(.07,.07,2.8),wood)
 for o in created:
  if o.type=='MESH' and ('粉墙' in o.name or '屋顶' in o.name):o['occluder']=True
 houses.append((name,p,w,d,theta));return created
house('早餐铺后 · 溪岸民居',-13.25,-12,4.4,2.8,5.8,(1,0,0))
house('茶器铺后 · 茶栈',-12.7,10,4.5,2.8,5.5,(1,0,0))
house('货郎铺后 · 东街民居',20.7,-11,4.8,3.1,6.2,(-1,0,0))
house('木铃铺后 · 手作楼',4,-2.8,4.3,3.2,5.4,(0,-1,0))
for args in [('南街米行',2,-23,4.5,3.8,5.7),('南街客舍',11,-21,4.8,3.8,6.4),('东街布庄',21,-4.8,4.2,3.5,5.7),('东街杂货',22,3,4.4,3.5,6.3),('北街食铺',16,17,4.4,3.6,5.4),('北街民居',5,22.5,4.6,3.5,6),('桥畔小楼',-5.5,18.5,4,3.2,5.4),('内街小院',.5,5,4,3.2,5.5),('内街粮铺',7,9.2,3.8,3.2,4.9),('入口小铺',-10,-20,3.8,3.1,4.8)]:house(*args)
# Additional populated market tables at house frontages; distinguish decorative vendors from interactive shops.
for idx,(name,p,w,d,theta) in enumerate(houses):
 if idx<4:continue
 R=Matrix.Rotation(theta,4,'Z');q=p+R@Vector((0,-d/2-1.3,0))
 box(name+' · 货台',q+Vector((0,0,.82)),(2,.7,.13),wood,theta)
 for x in [-.8,.8]:box('货台支脚',q+R@Vector((x,0,.4)),(.1,.55,.8),wood,theta)
 for j in range(3):
  v=q+R@Vector((-.65+j*.65,0,1));box('藤筐',v,(.53,.51,.2),ochre,theta)
  for k in range(5):
   bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.12,location=v+Vector((random.uniform(-.18,.18),random.uniform(-.16,.16),.17)));o=bpy.context.object;o.name='筐中时蔬';move_coll(o);o.data.materials.append(bpy.data.materials['市集 · 灰绿树叶'] if j%2 else ochre)
# Recompute collision footprints from actual architecture; retain paths, terrain and bridge navigation.
bpy.context.view_layer.update();blockers=[]
def blocker(name,objects):
 if not objects:return
 lo,hi=bounds(objects);blockers.append({'min':web((lo.x,hi.y,lo.z)),'max':web((hi.x,lo.y,hi.z)),'collection':name})
for coll in bpy.data.collections:
 if coll.name.startswith(('建筑 ·','摊位 ·')):
  objects=[o for o in coll.objects if o.type=='MESH' and not any(s in o.name for s in ['前阶','台基'])];blocker(coll.name,objects)
for name,p,w,d,theta in houses:
 blocker(name,[o for o in newcoll.objects if o.name==name+' · 粉墙'])
for stall in meta['stalls']:
 blocker(stall['id'],[o for o in scene.objects if o.get('stallId')==stall['id']])
meta['blockers']=blockers
# Natural rock silhouettes and dense patches of actual blades, not a flat green surface.
for o in list(scene.objects):
 if o.type=='MESH' and o.get('surface')=='rock' and ('岩' in o.name or '岸石' in o.name):
  sub=o.modifiers.new('圆润风化岩面','SUBSURF');sub.levels=1;sub.render_levels=2
  for poly in o.data.polygons:poly.use_smooth=True
terrain=next(o for o in scene.objects if '整体自然地貌' in o.name)
grassmats=[material('草叶'+str(i),c,'plaster') for i,c in enumerate([(.24,.31,.10),(.34,.40,.15),(.45,.43,.20)])]
verts=[];faces=[];mi=[]
def occupied(x,y):
 for b in blockers:
  if b['min'][0]-.6<x<b['max'][0]+.6 and b['min'][2]-.6<-y<b['max'][2]+.6:return True
 return False
for j in range(4200):
 x=random.uniform(-27,28);y=random.uniform(-24,25)
 if occupied(x,y):continue
 if min((Vector((x,y,0))-Vector((p.x,p.y,0))).length-w*.5 for p,w in road_samples)<.45:continue
 # Keep creek and bridge clear.
 if -20<x<-14 and -20<y<20:continue
 hit,loc,normal,idx=terrain.ray_cast(Vector((x,y,8)),Vector((0,0,-1)))
 if not hit or loc.z<.02:continue
 for k in range(random.randint(5,10)):
  a=random.uniform(0,math.tau);base=loc+Vector((random.uniform(-.18,.18),random.uniform(-.18,.18),0));h=random.uniform(.14,.43);wide=random.uniform(.025,.055);side=Vector((math.cos(a),math.sin(a),0))*wide;lean=Vector((math.sin(a),math.cos(a),0))*h*.28
  n=len(verts);verts.extend([tuple(base-side),tuple(base+side),tuple(base+lean+Vector((0,0,h)))]);faces.append((n,n+1,n+2));mi.append(random.randrange(3))
mesh=bpy.data.meshes.new('成簇草叶');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('草地 · 疏密变化的立体草簇',mesh);scene.collection.objects.link(o)
for m in grassmats:mesh.materials.append(m)
for poly,i in zip(mesh.polygons,mi):poly.material_index=i
# Sun and three saved viewpoints.
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
sun=bpy.data.objects['主光'];sun.rotation_euler=(.43,-.5,-.7);sun.data.energy=2.5;sun.data.angle=.12
scene.camera.location=(47,-66,64);scene.camera.rotation_euler=(Vector((0,0,1))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.camera.data.ortho_scale=75
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1440;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
scene.render.filepath=str(ROOT/'previews/markets/morning-refined.png')
# Update nav from evaluated subdivided surfaces, not the previous angular mesh.
nav=[]
for o in scene.objects:
 if o.type=='MESH' and (o in roads or '整体自然地貌' in o.name or any(k in o.name for k in ['木桥桥面板','台基','前阶'])):
  ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());nav+=nav_triangles(ev)
# Bridge continuity retained from original source.
nav.extend([t for t in meta['navigation'] if all(-15<v[0]<-11 and -8<v[2]<-4 for v in t)])
meta['navigation']=nav;meta['source']=str(TARGET.relative_to(ROOT));meta['artRevision']='morning-street-refinement-02'
(ROOT/'assets/markets/morning.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')))
detailcam=scene.camera.copy();detailcam.data=scene.camera.data.copy();scene.collection.objects.link(detailcam);detailcam.name='精修近景 · 沿街建筑与摊位'
detailcam.location=(30,-40,30);detailcam.rotation_euler=(Vector((0,-4,1.5))-detailcam.location).to_track_quat('-Z','Y').to_euler();detailcam.data.ortho_scale=43
bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
print('SAVED',len(houses),'houses',len(faces),'grass blades',flush=True)
bpy.ops.render.render(write_still=True)
# Closer street view for judging materials and facades.
scene.camera=detailcam
scene.render.filepath=str(ROOT/'previews/markets/morning-street-detail.png');bpy.ops.render.render(write_still=True)
# Apply evaluated modifiers and convert roof tiles before batching export only.
bpy.ops.object.select_all(action='DESELECT')
convertible=[o for o in scene.objects if o.type in {'MESH','CURVE'}]
for o in convertible:o.select_set(True)
bpy.context.view_layer.objects.active=convertible[0]
bpy.ops.object.convert(target='MESH')
batches={}
for o in scene.objects:
 if o.type=='MESH' and not o.get('stallId'):
  key=(tuple(m.name for m in o.data.materials),bool(o.get('occluder')),bool(o.get('water')));batches.setdefault(key,[]).append(o)
for key,obs in batches.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();o=bpy.context.object;o.name='Environment_'+str(len(obs))+'_'+key[0][0];o['occluder']=key[1];o['water']=key[2]
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type in {'MESH','EMPTY'}:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'assets/markets/morning.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_apply=True)
print('COMPLETED MORNING REVISION',flush=True)
