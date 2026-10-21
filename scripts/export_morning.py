"""Export the user-authored morning scene without modifying its Blender source.
Run: blender -b --factory-startup --python scripts/export_morning.py
"""
import bpy, json, hashlib
import sys
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from bake_authored_materials import capture_generated_coordinates,bake_materials
from build_morning_collision import build_collision
SOURCE=ROOT/'资产包/首页/早/二级场景/早晨确定版.blend1'
SCALE=5.0
collision=build_collision(SOURCE)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene=bpy.context.scene
bpy.context.view_layer.update()
background=next((n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND'),None)
lighting={'viewTransform':scene.view_settings.view_transform,'look':scene.view_settings.look,'exposure':scene.view_settings.exposure,
 'world':{'color':list(background.inputs['Color'].default_value[:3]) if background else list(scene.world.color),
          'strength':background.inputs['Strength'].default_value if background else 1},'suns':[]}
for o in scene.objects:
 if o.type=='LIGHT' and o.data.type=='SUN' and not o.hide_render and o.name in bpy.context.view_layer.objects:
  d=o.matrix_world.to_quaternion()@Vector((0,0,-1))
  lighting['suns'].append({'color':list(o.data.color),'energy':o.data.energy,'direction':[d.x,d.z,-d.y]})
def web(v):return [round(v[0]*SCALE,5),round(v[2]*SCALE,5),round(-v[1]*SCALE,5)]
def bounds(obs):
 pts=[o.matrix_world@Vector(v) for o in obs for v in o.bound_box]
 return Vector([min(v[i] for v in pts) for i in range(3)]),Vector([max(v[i] for v in pts) for i in range(3)])
def box(lo,hi,label):
 a,b=web(lo),web(hi)
 return {'min':[min(a[i],b[i]) for i in range(3)],'max':[max(a[i],b[i]) for i in range(3)],'collection':label}
# Render visibility is authoritative: the author hid the base only in the viewport.
objects=[o for o in scene.objects if o.type in {'MESH','CURVE','FONT'} and o.name in bpy.context.view_layer.objects and not o.hide_render and not any(c.hide_render for c in o.users_collection)]
for o in objects:o.hide_set(False);o.hide_viewport=False
nav=[]
for o in objects:
 if o.name=='沿用白模地台' or o.name.startswith('门前踏步'):
  ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get());m=ev.to_mesh();m.calc_loop_triangles()
  for t in m.loop_triangles:
   v=[o.matrix_world@m.vertices[i].co for i in t.vertices];n=(v[1]-v[0]).cross(v[2]-v[0])
   if n.length and n.normalized().z>.6:nav.append([web(p) for p in v])
  ev.to_mesh_clear()
blockers=[]
# Each authored foundation defines a footprint; canopy overhangs remain walkable.
for o in objects:
 if o.name.startswith(('石基','入口石础','树池')):
  lo,hi=bounds([o]);hi.z=max(hi.z,1.1);blockers.append(box(lo,hi,o.name))
placements=[]
shops=[('breakfast',[o for o in objects if any(c.name=='14 早餐食摊 参考模型' for c in o.users_collection)],Vector((0,-1,0))),
 ('tea',[o for o in objects if any(c.name=='13 算卦茶歇 参考模型' for c in o.users_collection)],Vector((-1,0,0))),
 ('toys',[o for o in objects if any(c.name=='04 木铃摊铺' for c in o.users_collection)],Vector((1,0,0))),
 ('sundries',[o for o in objects if o.get('stallId')=='sundries'],Vector((-1,0,0)))]
shop_lookup={}
for sid,obs,normal in shops:
 assert obs,sid
 lo,hi=bounds(obs);center=(lo+hi)/2;center.z=.25862658
 # Anchor sits at the front face, so the existing 6.5-unit visit radius is meaningful.
 extent=(hi.x-lo.x)/2 if normal.x else (hi.y-lo.y)/2
 anchor=center+normal*max(0,extent-.08);focus=anchor.copy();focus.z=.59
 approach=anchor+normal*.55;approach.z=.25862658
 node='Shop_'+sid
 holder=bpy.data.objects.new(node+'_new',None);scene.collection.objects.link(holder)
 for o in obs:
  mat=o.matrix_world.copy();o.parent=holder;o.matrix_world=mat;shop_lookup[o.name]=sid
 holder.name=node if not bpy.data.objects.get(node) else node+'_authored'
 placements.append({'id':sid,'position':web(anchor),'focus':web(focus),'normal':web(normal/SCALE),'approach':web(approach),'node':holder.name})
 if sid!='toys':
  # Imported stalls include tables in their bounding box; shrink slightly to preserve aisle clearance.
  inset=.08;blo=lo+Vector((inset,inset,0));bhi=hi-Vector((inset,inset,0));blockers.append(box(blo,bhi,sid))
# Apply the same uniform scale to every root, including nested shop geometry.
for o in list(scene.objects):
 if o.parent is None:o.matrix_world=Matrix.Scale(SCALE,4)@o.matrix_world
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.convert(target='MESH')
capture_generated_coordinates(objects)
# Keep batches local to a stall/collection, preserving sensible occlusion fading.
batches={}
for o in objects:
 if o.type!='MESH':continue
 sid=shop_lookup.get(o.name,'')
 coll=next((c.name for c in o.users_collection if c.name!='01 市集场景'),'environment')
 key=(sid,coll,tuple(m.name if m else '' for m in o.data.materials))
 batches.setdefault(key,[]).append(o)
for i,(key,obs) in enumerate(batches.items()):
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0]
 if len(obs)>1:bpy.ops.object.join()
 o=bpy.context.object;o.name=f'Authored_{i:03}_{key[1]}'
 if key[1] not in {'02 石板街道与基座','06 宣纸背景'}:o['occluder']=True
for o in list(scene.objects):
 if o.type=='MESH' and o.name.startswith('Authored_') and len(o.data.materials)>1:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
baked=bake_materials([o for o in scene.objects if o.type=='MESH' and o.name.startswith('Authored_')])
print('BAKED MATERIALS',len(baked),flush=True)
# Export only authored renderable geometry and its parent transforms; cameras/lights
# are deliberately recreated in Three.js to maintain consistent real-time shadows.
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type=='MESH' and o.name.startswith('Authored_'):
  o.select_set(True);p=o.parent
  while p:p.select_set(True);p=p.parent
out=ROOT/'assets/markets'
bpy.ops.export_scene.gltf(filepath=str(out/'morning.glb'),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False,export_apply=True)
meta={'phase':'morning','source':SOURCE.relative_to(ROOT).as_posix(),'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'artRevision':'user-authored-materials-02','lighting':lighting,'scale':SCALE,'spawn':[-8.4,1.293133,16.1],'stalls':placements,'navigation':nav,'water':[],'blockers':blockers,'collision':collision}
(out/'morning.json').write_text(json.dumps(meta,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('EXPORTED',len(objects),'objects;',len(batches),'batches;',len(nav),'nav triangles;',len(blockers),'blockers',flush=True)

