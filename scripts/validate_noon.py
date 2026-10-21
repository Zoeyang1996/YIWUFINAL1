"""Reopen, validate and publish the authored noon Blender file after visual QA."""
import bpy,json,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'previews/markets/noon-authoring-v2'
TARGET=ROOT/'资产包/首页/午/二级场景/02_午市_场景精修.blend'
data=json.loads((OUT/'店铺清单与检查.json').read_text(encoding='utf8'))
bpy.ops.wm.open_mainfile(filepath=str(TARGET if '--read-published' in sys.argv else OUT/'午市_精修待检.blend'))
scene=bpy.context.scene
if '--read-published' not in sys.argv:
    # Preserve the original GLB anchor names, but make each shop master move all its parts.
    for r in data['shops']:
        ctrl=bpy.data.objects[r['code']+'_'+r['name']+' · 总控']
        if r['anchor']:
            anchor=bpy.data.objects['Shop_'+r['anchor']]
            bpy.context.view_layer.update();matrix=anchor.matrix_world.copy()
            anchor.parent=ctrl;anchor.matrix_world=matrix
    for o in list(scene.objects):
        if not o.get('shopCode') and not o.parent and o.type not in {'LIGHT','CAMERA'} and any(k in o.name for k in ('灯架','灯笼','陈设_')):
            bpy.context.view_layer.update()
            nearest=min(data['shops'],key=lambda r:(Vector(r['location']).xy-o.matrix_world.translation.xy).length)
            if (Vector(nearest['location']).xy-o.matrix_world.translation.xy).length<3.5:
                code=nearest['code'];name=nearest['name'];ctrl=bpy.data.objects[code+'_'+name+' · 总控']
                matrix=o.matrix_world.copy();o.parent=ctrl;o.matrix_world=matrix
                for c in list(o.users_collection):c.objects.unlink(o)
                bpy.data.collections[code+' · 03 陈列'].objects.link(o)
                o.name=code+'_'+name+' · '+o.name;o['shopCode']=code;o['shopTheme']=name

errors=[]
for r in data['shops']:
    code=r['code'];name=r['name'];ctrl=bpy.data.objects.get(code+'_'+name+' · 总控')
    coll=bpy.data.collections.get(code+' · '+name)
    if not ctrl or not coll:errors.append(code+' missing shop master');continue
    goods=bpy.data.collections.get(code+' · 04 商品')
    if not goods or len(goods.objects)<10:errors.append(code+' missing distinct stock')
    r['groups']={}
    for category in ['01 建筑','02 招牌','03 陈列','04 商品','05 工具']:
        c=bpy.data.collections.get(code+' · '+category)
        if not c:errors.append(code+' missing '+category);continue
        r['groups'][category]=len(c.objects)
        for o in c.objects:
            if o.get('shopCode')!=code:errors.append(o.name+' wrong shop ownership')
            if o.type=='MESH' and not o.data.materials:errors.append(o.name+' has no material')
    if r['anchor']:
        anchor=bpy.data.objects.get('Shop_'+r['anchor'])
        if not anchor or anchor.parent!=ctrl:errors.append(code+' broken original shop anchor')
    # A master transform must move the imported facade and all native pieces together.
    children=list(coll.all_objects)
    for o in children:
        if o==ctrl:continue
        ancestor=o.parent
        while ancestor and ancestor!=ctrl:ancestor=ancestor.parent
        if ancestor!=ctrl:errors.append(o.name+' not under shop master')
for im in bpy.data.images:
    if im.users and im.source=='FILE' and not im.packed_file and not Path(bpy.path.abspath(im.filepath)).exists():errors.append('Missing image: '+im.name)
for font in bpy.data.fonts:
    if font.users and font.name!='Bfont' and not font.packed_file:errors.append('Unpacked font: '+font.name)
assert len(data['shops'])==18
assert len({s['theme'] for s in data['shops']})==18
assert scene.get('sourceSha256')=='81ba5b882a70b93fa83bcdb9d6c3d5bb2fc1b125f969ca023eed94cecb5ebfff'
for r in data['shops']:
    ctrl=bpy.data.objects[r['code']+'_'+r['name']+' · 总控']
    if max(abs(ctrl.matrix_world[i][j]-r['originalMatrix'][i][j]) for i in range(4) for j in range(4))>1e-5:
        errors.append(r['code']+' altered the new upload layout')
assert len(scene.objects)>4000
assert scene.world.node_tree.nodes['Background'].inputs[1].default_value>.5
data['validation']={'errors':errors,'shops':18,'uniqueThemes':18,'reopenedSuccessfully':True,
 'originalInteractionAnchors':['Shop_fans','Shop_grocery','Shop_daily','Shop_sundries-noon']}
(OUT/'店铺清单与检查.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
print('VALIDATION',json.dumps(data['validation'],ensure_ascii=False),flush=True)
if errors:raise RuntimeError('; '.join(errors))
if '--publish' in sys.argv:
    scene.camera=bpy.data.objects['01 午市 · 双院总览']
    bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
    print('PUBLISHED',TARGET,flush=True)
