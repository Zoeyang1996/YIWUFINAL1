"""Revision 03: reuse reference-file single-storey shops and enforce clear spacing.
Run in Blender: -b --factory-startup --python scripts/revise_morning_lowrise.py
"""
import bpy,math,json,random
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
exec((ROOT/'scripts/build_markets.py').read_text().split('for phase,cfg in CONFIG.items():')[0])
BASE=ROOT/'previews/markets/morning-revision02';TARGET=ROOT/'资产包/首页/早/二级场景/01_早市_场景精修.blend'
REF=ROOT/'资产包/首页/参考文件/义乌市集_无人物建筑细化_v03.blend'
bpy.ops.wm.open_mainfile(filepath=str(BASE/TARGET.name));scene=bpy.context.scene
meta=json.loads((BASE/'morning.json').read_text())
old=bpy.data.collections.get('精修02 · 沿街民居与生活陈设')
for o in list(old.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.data.collections.remove(old)
# Remove obsolete placeholder plinths below the four standalone interactive shops.
for name in ['建筑 · 早餐铺','建筑 · 茶器','建筑 · 货郎记忆','摊位 · 木铃']:
 c=bpy.data.collections.get(name)
 if c:
  for o in list(c.objects):bpy.data.objects.remove(o,do_unlink=True)
# Keep the decorative candle stall off the main carriageway.
ctrl=bpy.data.objects['摊位 · 烛火 · 总控'];ctrl.location.x=4.2;ctrl.location.y=-15.3;ctrl.rotation_euler.z=1.1
bpy.context.view_layer.update()
# Sample actual street mesh centres for facade direction and clearance.
road_samples=[]
for o in scene.objects:
 if o.type=='MESH' and '细分石板路' in o.name:
  width=3.65 if '主街' in o.name else 2.8 if '桥头' in o.name else 2.35
  for i in range(2,len(o.data.vertices),5):road_samples.append((o.matrix_world@o.data.vertices[i].co,width))
def nearest(p):return min(road_samples,key=lambda it:(it[0].x-p.x)**2+(it[0].y-p.y)**2)[0]
def rect(obs):
 lo,hi=bounds(obs);return [lo.x,lo.y,hi.x,hi.y,lo.z,hi.z]
def gap(a,b):
 dx=max(a[0]-b[2],b[0]-a[2],0);dy=max(a[1]-b[3],b[1]-a[3],0);return math.hypot(dx,dy)
def intersects(a,b,pad=0):return a[0]<b[2]+pad and a[2]>b[0]-pad and a[1]<b[3]+pad and a[3]>b[1]-pad
fixed=[];groups=[]
for c in list(bpy.data.collections):
 if c.name.startswith(('建筑 ·','摊位 ·')):
  obs=[o for o in c.objects if o.type=='MESH']
  if obs:groups.append((c.name,obs));fixed.append((c.name,rect(obs)))
# Include lanterns and crates in each interactive stall's full clearance footprint.
for s in meta['stalls']:
 p=Vector((s['position'][0],-s['position'][2],0));obs=[o for o in scene.objects if o.get('stallId')==s['id']]
 for o in scene.objects:
  if o.name.startswith(('陈设_','灯架','灯笼_')) and (Vector((o.matrix_world.translation.x,o.matrix_world.translation.y,0))-p).length<3:obs.append(o)
 groups.append(('互动摊位 · '+s['id'],obs));fixed.append(('互动摊位 · '+s['id'],rect(obs)))
# Reserve the creek and public parasol seating areas too.
water_boxes=[]
for tri in meta['water']:
 water_boxes.append([min(v[0] for v in tri),min(-v[2] for v in tri),max(v[0] for v in tri),max(-v[2] for v in tri)])
public=bpy.data.collections.get('07 休憩与入口')
for pole in [o for o in scene.objects if o.name.startswith('伞杆')]:
 p=pole.matrix_world.translation
 obs=[o for o in public.objects if o.type=='MESH' and (o.matrix_world.translation.xy-p.xy).length<2.3]
 if obs:fixed.append(('休憩伞区 '+pole.name,rect(obs)))
# Load and normalize actual reference models, preserving their tiles, joinery and stock.
source_names=['01 茶器摊铺','03 食器摊铺','06 织物摊铺','11 义乌摊铺']
with bpy.data.libraries.load(str(REF),link=False) as (src,dst):dst.collections=source_names[:]
templates=[]
for c in dst.collections:
 scene.collection.children.link(c);bpy.context.view_layer.update()
 obs=[o for o in c.all_objects if o.type in {'MESH','CURVE','FONT'}]
 # Reference counters determine the real facade direction.
 back=next(o for o in obs if o.name.startswith('后墙'));counter=next(o for o in obs if o.name.startswith('柜台顶'))
 normal=counter.matrix_world.translation-back.matrix_world.translation;angle=math.atan2(normal.x,-normal.y)
 rot=Matrix.Rotation(-angle,4,'Z');deps=bpy.context.evaluated_depsgraph_get();parts=[];pts=[]
 for o in obs:
  mesh=bpy.data.meshes.new_from_object(o.evaluated_get(deps),depsgraph=deps)
  mesh.transform(rot@o.matrix_world)
  pts.extend(v.co.copy() for v in mesh.vertices);parts.append((o.name,mesh))
 lo=Vector([min(v[i] for v in pts) for i in range(3)]);hi=Vector([max(v[i] for v in pts) for i in range(3)]);size=hi-lo;center=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
 for name,mesh in parts:mesh.transform(Matrix.Diagonal(Vector((1/size.x,1/size.y,1/size.z,1)))@Matrix.Translation(-center))
 templates.append(parts)
 for o in list(c.all_objects):bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.collections.remove(c)
print('Reference templates prepared',flush=True)
# The full envelope includes roof overhangs, signs, counter and merchandise.
plans=[
 ('早餐后侧 · 参考茶器屋',(-10.2,-18),0,(3.5,2.4,3.35),(1,0,0)),
 ('茶摊后侧 · 参考食器屋',(-13.0,15.6),1,(3.6,2.8,3.45),(1,0,0)),
 ('货郎后侧 · 参考义乌屋',(21.7,-11),3,(4,3.4,3.5),(-1,0,0)),
 ('木铃后侧 · 参考织物屋',(4,-1.7),2,(4,3.2,3.4),(0,-1,0)),
 ('南街茶器铺',(1,-23),0,(4.4,3.7,3.5),None),
 ('南街义乌铺',(11,-21),3,(4.4,3.7,3.6),None),
 ('东街织物铺',(22,-4.6),2,(4.3,3.6,3.5),None),
 ('东街食器铺',(23,3.5),1,(4.4,3.6,3.5),None),
 ('北街义乌铺',(17,17),3,(4.2,3.5,3.4),None),
 ('北街织物铺',(5,23),2,(4.4,3.6,3.5),None),
 ('桥畔茶器铺',(-5.5,19),0,(4.2,3.5,3.4),None),
 ('内街食器铺',(-.2,4),1,(3.8,3.3,3.3),None),
 ('入口义乌铺',(-9,-22),3,(3.8,3.3,3.3),None)]
report=[];placed=[]
for name,origin,variant,dim,front in plans:
 candidates=[]
 for dx in [0,-.65,.65,-1.3,1.3,-1.95,1.95,-2.6,2.6,-3.25,3.25,-3.9,3.9]:
  for dy in [0,-.65,.65,-1.3,1.3,-1.95,1.95,-2.6,2.6,-3.25,3.25,-3.9,3.9]:
   p=Vector((origin[0]+dx,origin[1]+dy,.22));n=Vector(front) if front else nearest(p)-p;n.z=0;n.normalize();a=math.atan2(n.x,-n.y)
   ex=abs(math.cos(a))*dim[0]/2+abs(math.sin(a))*dim[1]/2;ey=abs(math.sin(a))*dim[0]/2+abs(math.cos(a))*dim[1]/2;r=[p.x-ex,p.y-ey,p.x+ex,p.y+ey,.22,.22+dim[2]]
   if any(intersects(r,b,.8) for _,b in fixed):continue
   if any(intersects(r,b,.45) for b in water_boxes):continue
   # Keep the roof/stock envelope outside the walkable road, with a small verge.
   roadgap=min(math.hypot(max(r[0]-q.x,q.x-r[2],0),max(r[1]-q.y,q.y-r[3],0))-w/2 for q,w in road_samples)
   if roadgap<.15:continue
   if abs(p.x)>26 or abs(p.y)>25:continue
   # West bank follows the retained creek; avoid its central strip.
   if r[0]<-15.3 and r[3]>-15 and r[1]<14:continue
   candidates.append((dx*dx+dy*dy+.02*roadgap,p,a,r))
 if not candidates:raise RuntimeError('No clear placement: '+name)
 _,p,a,r=min(candidates,key=lambda t:t[0]);c=bpy.data.collections.new('精修03 · '+name);scene.collection.children.link(c)
 matrix=Matrix.Translation(p)@Matrix.Rotation(a,4,'Z')@Matrix.Diagonal(Vector((*dim,1)))
 obs=[]
 for original,mesh in templates[variant]:
  o=bpy.data.objects.new(name+' · '+original,mesh);c.objects.link(o);o.matrix_world=matrix;o['referenceSource']=str(REF.relative_to(ROOT));o['storeys']=1
  if any(k in original for k in ['瓦','屋','墙','窗']):o['occluder']=True
  obs.append(o)
 fixed.append((name,r));groups.append((name,obs));placed.append((name,r));report.append({'name':name,'position':list(p),'envelope':r,'sourceCollection':source_names[variant]})
 print('Placed',name,tuple(p),flush=True)
bpy.context.view_layer.update()
# Remove vegetation/loose stones that intersect the new architectural envelopes.
removed=[]
treeparts=[o for o in scene.objects if o.type=='MESH' and any(k in o.name for k in ['树冠','树干','树枝'])]
trunks=[o for o in treeparts if '树干' in o.name]
remove_trees=[]
for trunk in trunks:
 members=[o for o in treeparts if min(trunks,key=lambda t:(t.matrix_world.translation.xy-o.matrix_world.translation.xy).length)==trunk]
 if any(intersects(rect(members),b,.4) for _,b in fixed):remove_trees.extend(members)
for o in remove_trees:removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True)
for o in list(scene.objects):
 if o.type=='MESH' and o.get('surface')=='rock' and '柱础' not in o.name:
  if any(intersects(rect([o]),b,.3) for _,b in fixed):removed.append(o.name);bpy.data.objects.remove(o,do_unlink=True)
# Remove grass triangles under replacement houses and their forecourts.
grass=bpy.data.objects.get('草地 · 疏密变化的立体草簇')
if grass:
 import bmesh
 bm=bmesh.new();bm.from_mesh(grass.data);bad=[]
 for face in bm.faces:
  p=face.calc_center_median()
  if any(b[0]-.2<p.x<b[2]+.2 and b[1]-.2<p.y<b[3]+.2 for _,b in fixed):bad.append(face)
 bmesh.ops.delete(bm,geom=bad,context='FACES');bm.to_mesh(grass.data);bm.free()
# Rebuild navigation blockers from final actual meshes, including the full reference envelope.
meta['blockers']=[]
for name,obs in groups:
 lo,hi=bounds(obs);meta['blockers'].append({'min':web((lo.x,hi.y,lo.z)),'max':web((hi.x,lo.y,hi.z)),'collection':name})
# Drop stale plinth navigation; regenerate from surfaces that still exist.
nav=[]
for o in scene.objects:
 if o.type=='MESH' and ('细分石板路' in o.name or '整体自然地貌' in o.name or any(k in o.name for k in ['木桥桥面板','台基','前阶'])):
  nav+=nav_triangles(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
nav.extend([t for t in meta['navigation'] if all(-15<v[0]<-11 and -8<v[2]<-4 for v in t)])
meta['navigation']=nav;meta['artRevision']='morning-reference-lowrise-03'
# Verify each new complete building envelope is separated from every other major group.
checks=[]
for name,b in placed:
 others=[(n,gap(b,r)) for n,r in fixed if n!=name];near=min(others,key=lambda x:x[1]);assert near[1]>=.79,(name,near);checks.append({'building':name,'nearest':near[0],'clearance':round(near[1],3)})
(ROOT/'previews/markets/morning-spacing-report.json').write_text(json.dumps({'buildings':report,'spacingChecks':checks,'clearedVegetation':removed},ensure_ascii=False,indent=2))
(ROOT/'assets/markets/morning.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')))
scene.camera=bpy.data.objects['精修总览'];scene.render.filepath=str(ROOT/'previews/markets/morning-refined.png');scene.cycles.samples=32
bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(TARGET));print('SAVED REVISION 03',flush=True)
bpy.ops.render.render(write_still=True)
scene.camera=bpy.data.objects['精修近景 · 沿街建筑与摊位'];scene.render.filepath=str(ROOT/'previews/markets/morning-street-detail.png');bpy.ops.render.render(write_still=True)
# Export with the existing material batching workflow; .blend retains separate editable objects.
exec((ROOT/'scripts/refine_morning.py').read_text().split('# Apply evaluated modifiers and convert roof tiles before batching export only.')[1])
