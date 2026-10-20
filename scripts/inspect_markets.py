import bpy, json
from pathlib import Path
from mathutils import Vector
root=Path.cwd()
for p in sorted((root/'资产包').rglob('*.blend')):
 bpy.ops.wm.open_mainfile(filepath=str(p))
 objects=[]
 for o in bpy.context.scene.objects:
  if o.type=='MESH':
   coords=[o.matrix_world@Vector(c) for c in o.bound_box]
   objects.append({'name':o.name,'vertices':len(o.data.vertices),'min':[round(min(v[i] for v in coords),3) for i in range(3)],'max':[round(max(v[i] for v in coords),3) for i in range(3)],'materials':[m.name for m in o.data.materials if m]})
 name=p.stem[:2]
 (root/f'previews/markets/{name}-source.json').write_text(json.dumps(objects,ensure_ascii=False,indent=2))
 print('SCENE',p.name,'objects',len(objects),'vertices',sum(o['vertices'] for o in objects),flush=True)
 for o in objects[:30]:print(o,flush=True)
