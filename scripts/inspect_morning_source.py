import bpy,json
from pathlib import Path
from mathutils import Vector
root=Path.cwd();scene=bpy.context.scene
out={}
for c in bpy.data.collections:
 obs=[o for o in c.all_objects if o.type=='MESH']
 pts=[o.matrix_world@Vector(v) for o in obs for v in o.bound_box]
 if pts:out[c.name]={'min':[min(v[i] for v in pts) for i in range(3)],'max':[max(v[i] for v in pts) for i in range(3)],'count':len(obs),'names':[o.name for o in obs][:8]}
for o in scene.objects:
 if o.type=='EMPTY' or o.name in ['沿用白模地台','基座下沿','入口立柱']:print('OBJECT',o.name,list(o.matrix_world.translation),list(o.rotation_euler))
(root/'previews/markets/morning-source-bounds.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
bpy.ops.object.camera_add(location=(45,-60,55));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=75;scene.camera=cam
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
scene.render.resolution_x=1200;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.render.filepath=str(root/'previews/markets/morning-source.png');bpy.ops.render.render(write_still=True)
