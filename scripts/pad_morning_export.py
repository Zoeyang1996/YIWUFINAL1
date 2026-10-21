import bpy,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'scripts'))
from bake_authored_materials import pad_baked_image
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/markets/morning.glb'))
for image in bpy.data.images:
 if '原色烘焙' in image.name or '原始凹凸' in image.name:
  print('PADDING',image.name,flush=True);pad_baked_image(image,normal='原始凹凸' in image.name)
bpy.ops.export_scene.gltf(filepath=str(root/'assets/markets/morning.glb'),export_format='GLB',export_extras=True,export_cameras=False,export_lights=False)
