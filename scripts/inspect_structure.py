import bpy,json,math
from pathlib import Path
from mathutils import Vector
root=Path.cwd()
for p in sorted((root/'资产包').rglob('*.blend')):
 bpy.ops.wm.open_mainfile(filepath=str(p))
 result={'collections':{},'paths':[],'shops':[]}
 for c in bpy.data.collections:
  if c.objects:result['collections'][c.name]=[o.name for o in c.objects][:12]
 for o in bpy.context.scene.objects:
  if o.type!='MESH':continue
  if any(k in o.name for k in ['连续路面','完整地坪','转角接续平台',' 石路',' 石阶','平台面','木桥桥面板']):
   result['paths'].append({'name':o.name,'vertices':[[round(v,3) for v in o.matrix_world@v.co] for v in o.data.vertices],'faces':[list(f.vertices) for f in o.data.polygons]})
  if '柜台面' in o.name:result['shops'].append({'name':o.name,'location':list(o.location),'rotation':list(o.rotation_euler),'parent':o.parent.name if o.parent else None,'collections':[c.name for c in o.users_collection]})
 (root/f'previews/markets/{p.stem[:2]}-structure.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
 print(p.name,result['collections'],result['shops'],flush=True)
 # Material preview of original composition
 scene=bpy.context.scene
 bpy.ops.object.camera_add(location=(46,-64,62));camera=bpy.context.object
 camera.rotation_euler=(Vector((0,0,1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=78;scene.camera=camera
 scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='SINGLE';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
 scene.render.resolution_x=1100;scene.render.resolution_y=900;scene.render.resolution_percentage=100
 scene.render.filepath=str(root/f'previews/markets/{p.stem[:2]}-before.png');bpy.ops.render.render(write_still=True)
