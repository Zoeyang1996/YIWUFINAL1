"""Dump the editable night scene structure for authoring work.
Run: Blender -b --factory-startup --python scripts/inspect_night_source.py
"""
import bpy, json, os
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '资产包/首页/夜/二级场景/03_夜市_场景精修.blend'
TARGET = ROOT / 'previews/markets/night-source-inspection.json'

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
bpy.context.view_layer.update()


def bounds(objects):
    points = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    if not points:
        return None
    return ([round(min(v[i] for v in points), 3) for i in range(3)],
            [round(max(v[i] for v in points), 3) for i in range(3)])


report = {'source': str(SOURCE.relative_to(ROOT)), 'collections': {}, 'totals': {}}
for collection in bpy.data.collections:
    meshes = [o for o in collection.all_objects if o.type == 'MESH']
    extent = bounds(meshes)
    if not meshes:
        continue
    report['collections'][collection.name] = {
        'count': len(meshes), 'min': extent[0], 'max': extent[1],
        'vertices': sum(len(o.data.vertices) for o in meshes),
        'materials': sorted({m.name for o in meshes for m in o.data.materials if m}),
        'names': [o.name for o in meshes][:12],
    }

report['objects'] = []
for o in scene.objects:
    entry = {'name': o.name, 'type': o.type,
             'collections': [c.name for c in o.users_collection],
             'parent': o.parent.name if o.parent else None,
             'stallId': o.get('stallId'),
             'location': [round(v, 3) for v in o.matrix_world.translation]}
    if o.type == 'MESH':
        extent = bounds([o])
        entry['min'], entry['max'] = extent
        entry['vertices'] = len(o.data.vertices)
        entry['materials'] = [m.name for m in o.data.materials if m]
        entry['surface'] = o.get('surface')
        entry['occluder'] = bool(o.get('occluder'))
        entry['water'] = bool(o.get('water'))
    elif o.type == 'EMPTY':
        entry['rotation'] = [round(v, 3) for v in o.rotation_euler]
        entry['scale'] = [round(v, 3) for v in o.scale]
    elif o.type == 'LIGHT':
        entry['light'] = {'type': o.data.type, 'energy': o.data.energy,
                          'color': [round(v, 3) for v in o.data.color],
                          'radius': getattr(o.data, 'shadow_soft_size', None)}
    report['objects'].append(entry)

report['materials'] = []
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    bsdf = next((n for n in material.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not bsdf:
        continue
    report['materials'].append({
        'name': material.name,
        'baseColor': [round(v, 3) for v in bsdf.inputs['Base Color'].default_value],
        'roughness': round(bsdf.inputs['Roughness'].default_value, 3),
        'metallic': round(bsdf.inputs['Metallic'].default_value, 3),
        'emission': [round(v, 3) for v in bsdf.inputs['Emission Color'].default_value],
        'emissionStrength': round(bsdf.inputs['Emission Strength'].default_value, 3),
        'textured': bool(bsdf.inputs['Base Color'].links),
    })

report['world'] = {
    'color': [round(v, 3) for v in scene.world.node_tree.nodes['Background'].inputs[0].default_value],
    'strength': round(scene.world.node_tree.nodes['Background'].inputs[1].default_value, 3),
} if scene.world and scene.world.use_nodes else None
report['totals'] = {
    'objects': len(scene.objects),
    'meshes': sum(1 for o in scene.objects if o.type == 'MESH'),
    'vertices': sum(len(o.data.vertices) for o in scene.objects if o.type == 'MESH'),
    'lights': sum(1 for o in scene.objects if o.type == 'LIGHT'),
}

TARGET.parent.mkdir(parents=True, exist_ok=True)
TARGET.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf8')
print('INSPECTED', SOURCE.name, report['totals'], flush=True)
