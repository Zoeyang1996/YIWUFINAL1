"""Rebuild the night market as a lamplit mountain lane that matches the
detail level of the current morning art, but lit and coloured for night.

The editable base is kept in previews/markets/night-before so this script can
always be re-run from the same starting point.

Run: Blender -b --factory-startup --python scripts/refine_night.py
"""
import bpy, math, json, random, sys
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT/'previews/markets/night-before/03_夜市_场景精修.blend'
TARGET = ROOT/'资产包/首页/夜/二级场景/03_夜市_场景精修.blend'
BASELINE_META = ROOT/'previews/markets/night-before/night.json'
OUT = ROOT/'assets/markets'
PREVIEW = ROOT/'previews/markets'

# Reuse the geometry helpers from the original map build (never its build loop).
exec((ROOT/'scripts/build_markets.py').read_text(encoding='utf8').split('for phase,cfg in CONFIG.items():')[0])

bpy.ops.wm.open_mainfile(filepath=str(BASE))
scene = bpy.context.scene
random.seed(2027)
TAU = math.tau

NEW = bpy.data.collections.new('夜 · 灯火与山居')
scene.collection.children.link(NEW)

# ---------------------------------------------------------------- materials
def value_noise(size, cells, rng):
    grid = rng.random((cells, cells))
    coord = np.arange(size) / size * cells
    i = np.floor(coord).astype(int)
    f = coord - i
    f = f*f*(3 - 2*f)
    a = grid[i[:, None] % cells, i[None, :] % cells]
    b = grid[i[:, None] % cells, (i[None, :] + 1) % cells]
    c = grid[(i[:, None] + 1) % cells, i[None, :] % cells]
    d = grid[(i[:, None] + 1) % cells, (i[None, :] + 1) % cells]
    return ((1-f[:, None])*(1-f[None, :])*a + (1-f[:, None])*f[None, :]*b
            + f[:, None]*(1-f[None, :])*c + f[:, None]*f[None, :]*d)


def pattern(size, kind, rng):
    y, x = np.mgrid[0:size, 0:size] / size
    noise = rng.normal(0, .02, (size, size))
    if kind == 'plaster':
        v = (.45*value_noise(size, 4, rng) + .3*value_noise(size, 11, rng)
             + .18*value_noise(size, 29, rng) + .07*rng.random((size, size)))
        return np.clip((v - .18)*1.7, .12, 1) + noise*.4
    if kind == 'wood':
        grain = .5 + .5*np.sin(x*TAU*7 + np.sin(y*5.5)*1.4 + value_noise(size, 17, rng)*3)
        return .72 + .22*grain - .18*np.abs(((y*7) % 1) - .5) + noise
    if kind == 'tile':
        rows = (y*13) % 1
        ribs = (x*26) % 1
        shade = .58 + .2*np.sin(rows*math.pi) - .3*(rows < .12) - .16*((ribs < .07) | (ribs > .93))
        return np.clip(shade + .06*value_noise(size, 23, rng), .05, 1) + noise*.5
    if kind == 'stone':
        rows = np.floor(y*9)
        xx = (x*5 + (rows % 2)*.5) % 1
        yy = (y*9) % 1
        shade = .74 - .3*((xx < .02) | (yy < .03)) + .06*value_noise(size, 15, rng)
        return np.clip(shade + .05*np.sin(rows*7 + np.floor(x*5)*2), .08, 1) + noise
    if kind == 'water':
        return .6 + .18*np.sin(y*70 + np.sin(x*13)*2.2) + .1*value_noise(size, 21, rng) + noise*.4
    if kind == 'cloth':
        return .82 + .1*np.sin(x*TAU*32) + .1*np.sin(y*TAU*32) + noise
    if kind == 'leaf':
        return .5 + .32*value_noise(size, 9, rng) + .12*np.sin((x + y)*38) + noise
    if kind == 'paper':
        r = np.hypot(x - .5, y - .5)
        return np.clip(1.15 - r*1.5, .25, 1.2)
    return .8 + .12*value_noise(size, 13, rng) + noise


def night_material(name, low, high, kind, roughness=.9, bump=.32, size=512,
                   seed=3, emission=None, strength=0.0, metallic=0.0, wet=0.0):
    rng = np.random.default_rng(seed)
    v = pattern(size, kind, rng)
    rgba = np.ones((size, size, 4), dtype=np.float32)
    tone = np.clip(v, 0, 1)[:, :, None]
    rgba[:, :, :3] = np.array(low)[None, None, :]*(1 - tone) + np.array(high)[None, None, :]*tone
    image = bpy.data.images.new(name + ' · 夜纹', width=size, height=size, alpha=False)
    image.pixels.foreach_set(rgba.ravel())
    image.pack()
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = image
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bump_node = nodes.new('ShaderNodeBump')
    bump_node.inputs['Strength'].default_value = bump
    bump_node.inputs['Distance'].default_value = .08
    links.new(tex.outputs['Color'], bump_node.inputs['Height'])
    links.new(bump_node.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    material['nightWet'] = wet
    return material

# Albedo stays physically plausible: the night mood comes from light, not from
# crushing every colour. Surfaces are slightly cooler and less saturated.
M = {
    'earth': night_material('夜 · 苔土', (.085, .11, .062), (.27, .30, .16), 'plaster', .96, .18, 512, 11),
    'stone': night_material('夜 · 湿石板', (.20, .205, .195), (.56, .55, .50), 'stone', .5, .22, 512, 12, wet=.7),
    'rock': night_material('夜 · 溪岸山石', (.14, .15, .14), (.36, .36, .33), 'stone', .8, .3, 512, 13),
    'wood': night_material('夜 · 旧榆木', (.11, .07, .042), (.33, .22, .13), 'wood', .82, .3, 512, 14),
    'wall': night_material('夜 · 月光粉墙', (.44, .42, .38), (.76, .73, .65), 'plaster', .92, .3, 512, 15),
    'tile': night_material('夜 · 青灰瓦', (.055, .065, .075), (.21, .24, .26), 'tile', .66, .34, 512, 16),
    'cloth': night_material('夜 · 赭色麻布', (.13, .055, .03), (.40, .17, .09), 'cloth', .94, .2, 256, 17),
    'indigo': night_material('夜 · 靛蓝布', (.02, .035, .065), (.10, .14, .21), 'cloth', .94, .2, 256, 18),
    'leaf': night_material('夜 · 树叶', (.028, .05, .028), (.13, .18, .09), 'leaf', .88, .25, 256, 19),
    'water': night_material('夜 · 溪水', (.012, .03, .04), (.10, .18, .20), 'water', .12, .12, 256, 20, metallic=.25),
    'clay': night_material('夜 · 粗陶', (.05, .028, .02), (.22, .11, .07), 'plaster', .82, .22, 256, 21),
    'bamboo': night_material('夜 · 青竹', (.07, .085, .045), (.26, .28, .14), 'wood', .8, .2, 256, 22),
    'soot': night_material('夜 · 灶灰', (.02, .02, .02), (.09, .085, .08), 'plaster', 1.0, .3, 256, 23),
    'paper': night_material('夜 · 暖纸灯', (.55, .24, .07), (1.0, .62, .26), 'paper', .8, .1, 256, 24,
                            emission=(1.0, .52, .22), strength=1.25),
    'window': night_material('夜 · 窗内暖光', (.9, .55, .22), (1.0, .78, .42), 'paper', .9, .05, 128, 25,
                             emission=(1.0, .62, .28), strength=.75),
    'ember': night_material('夜 · 炭火', (.6, .15, .03), (1.0, .5, .12), 'paper', .95, .1, 128, 26,
                            emission=(1.0, .42, .10), strength=1.6),
    'fabric_red': night_material('夜 · 朱灯纱', (.32, .05, .04), (.85, .18, .1), 'paper', .85, .1, 256, 27,
                                 emission=(1.0, .34, .14), strength=.9),
}
print('MATERIALS READY', flush=True)

# The remap table applied to every mesh that came from the earlier build.
REMAP = {
    '市集 · 苔土': M['earth'], '市集 · 米灰石板': M['stone'], '市集 · 溪岸山石': M['rock'],
    '市集 · 旧榆木': M['wood'], '市集 · 暖灰粉墙': M['wall'], '市集 · 青灰瓦': M['tile'],
    '市集 · 赭色麻布': M['cloth'], '市集 · 灰绿树叶': M['leaf'], '市集 · 溪水青': M['water'],
    '市集 · 粗陶': M['clay'], '市集 · 暖纸灯': M['paper'],
}
remapped = 0
for mesh_object in scene.objects:
    if mesh_object.type != 'MESH':
        continue
    for slot in mesh_object.material_slots:
        replacement = REMAP.get(slot.material.name if slot.material else '')
        if replacement:
            slot.material = replacement
            remapped += 1
print('REMAP SLOTS', remapped, flush=True)
# ---------------------------------------------------------------- geometry kit
import bmesh

def to_object(name, mesh, material, collection=NEW, occluder=False):
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    if material is not None:
        mesh.materials.append(material)
    if occluder:
        obj['occluder'] = True
    return obj


def add_box(name, center, size, material, rot=(0, 0, 0), uv=1.6, bevel=0.0,
            occluder=False, collection=NEW):
    cx, cy, cz = center
    sx, sy, sz = size
    corners = [(-.5, -.5, -.5), (.5, -.5, -.5), (.5, .5, -.5), (-.5, .5, -.5),
               (-.5, -.5, .5), (.5, -.5, .5), (.5, .5, .5), (-.5, .5, .5)]
    rotation = Matrix.Rotation(rot[2], 3, 'Z') @ Matrix.Rotation(rot[1], 3, 'Y') @ Matrix.Rotation(rot[0], 3, 'X')
    verts = [tuple(Vector((cx, cy, cz)) + rotation @ Vector((x*sx, y*sy, z*sz))) for x, y, z in corners]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = to_object(name, mesh, material, collection, occluder)
    uv_world(obj, uv)
    if bevel:
        modifier = obj.modifiers.new('手工边角', 'BEVEL')
        modifier.width = bevel
        modifier.segments = 2
    return obj


def add_poly(name, vertices, faces, material, uv=1.6, occluder=False, collection=NEW):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in vertices], [], faces)
    mesh.update()
    obj = to_object(name, mesh, material, collection, occluder)
    uv_world(obj, uv)
    return obj


def add_cylinder(name, center, radius, depth, material, segments=10, rot=(0, 0, 0), uv=1.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=depth)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = to_object(name, mesh, material)
    obj.location = center
    obj.rotation_euler = rot
    uv_world(obj, uv)
    return obj


def add_sphere(name, center, radius, material, scale=(1, 1, 1), uv=1.0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=radius)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = to_object(name, mesh, material)
    obj.location = center
    obj.scale = scale
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    uv_world(obj, uv)
    return obj


def add_slab(name, center, w, d, material, thickness=.12, rot=0.0, uv=2.5):
    return add_box(name, (center[0], center[1], center[2] - thickness/2), (w, d, thickness),
                   material, (0, 0, rot), uv)


def pick(material_key):
    return M[material_key]

# ---------------------------------------------------------------- terrain access
terrain = next(o for o in scene.objects if o.type == 'MESH' and '整体自然地貌' in o.name)
terrain_inverse = terrain.matrix_world.inverted()
terrain_linear = terrain_inverse.to_3x3()
DOWN = Vector((0, 0, -1))


def ground_height(x, y):
    hit, location, normal, index = terrain.ray_cast(terrain_inverse @ Vector((x, y, 40)), terrain_linear @ DOWN)
    if not hit:
        return None
    return (terrain.matrix_world @ location).z


ROAD_KEYWORDS = ('石阶', '石路', '连续路面', '平台面', '转角接续平台', '木桥桥面板')
road_objects = [o for o in scene.objects if o.type == 'MESH' and any(k in o.name for k in ROAD_KEYWORDS)]

path_points = []
seen = set()
for obj in road_objects:
    mesh = obj.data
    for vertex in mesh.vertices:
        p = obj.matrix_world @ vertex.co
        key = (round(p.x / 1.15), round(p.y / 1.15))
        if key in seen:
            continue
        seen.add(key)
        path_points.append(Vector((p.x, p.y, p.z)))

# PCA of the neighbourhood gives each station a usable lane direction.
def lane_tangent(point):
    near = [q for q in path_points if (q - point).length < 3.0]
    if len(near) < 3:
        return Vector((1, 0, 0))
    coords = np.array([[q.x, q.y] for q in near])
    coords -= coords.mean(axis=0)
    values, vectors = np.linalg.eigh(coords.T @ coords)
    direction = Vector((vectors[0, 1], vectors[1, 1], 0)).normalized()
    return direction


stations = []
for point in path_points:
    tangent = lane_tangent(point)
    normal = Vector((-tangent.y, tangent.x, 0)).normalized()
    stations.append({'point': point, 'tangent': tangent, 'normal': normal})
print('PATH STATIONS', len(stations), flush=True)

# Existing structures stay the reference for aisle clearance.
obstacles = []
for collection_name in ['山铺 · 坡脚热食铺', '山铺 · 坡脚货郎铺', '山铺 · 西台旧物铺', '山铺 · 西台烛火铺',
                        '山铺 · 东台饰物铺', '山铺 · 东崖小铺', '山铺 · 山脊茶亭', '山铺 · 下山歇脚铺',
                        '摊位 · 坡脚木铃']:
    collection = bpy.data.collections.get(collection_name)
    if not collection:
        continue
    meshes = [o for o in collection.all_objects if o.type == 'MESH']
    if not meshes:
        continue
    lo, hi = bounds(meshes)
    if '台基' in ' '.join(o.name for o in meshes[:3]):
        lo.x -= .3; lo.y -= .3; hi.x += .3; hi.y += .3
    obstacles.append((lo, hi, collection_name))


def blocked(x, y, radius, ignore_roads=False):
    for lo, hi, label in obstacles:
        if lo.x - radius < x < hi.x + radius and lo.y - radius < y < hi.y + radius:
            return True
    return False


def clear_of_path(x, y, clearance):
    for station in stations:
        p = station['point']
        if (p.x - x)**2 + (p.y - y)**2 < clearance ** 2:
            return False
    return True
# ---------------------------------------------------------------- lane houses
lantern_sites = []          # (world position, kind)
house_records = []


def build_house(name, x, y, floor, w, d, h, theta, two_floors, awning=True, lit=True):
    p = Vector((x, y, floor))
    R = Matrix.Rotation(theta, 3, 'Z')

    def world(local):
        return p + R @ Vector(local)

    def part(label, local, size, material, tilt=0.0, uv=1.6, occluder=False, bevel=0.0):
        return add_box(f'{name} · {label}', world(local), size, material,
                       (tilt, 0, theta), uv, bevel, occluder)

    part('石砌台基', (0, 0, -.16), (w + .46, d + .46, .32), M['stone'], uv=2.4)
    part('台基压面', (0, 0, .02), (w + .54, d + .54, .07), M['stone'], uv=2.4)
    part('粉墙', (0, 0, h/2 + .05), (w, d, h), M['wall'], uv=2.2, occluder=True)
    part('勒脚', (0, 0, .34), (w + .07, d + .07, .5), M['stone'], uv=2.0)
    part('檐下木梁', (0, 0, h - .12), (w + .12, d + .12, .16), M['wood'])
    part('腰梁', (0, 0, h*.52), (w + .08, d + .08, .12), M['wood'])
    for sx in (-1, 1):
        for sy in (-1, 1):
            part('檐柱', (sx*(w/2 - .04), sy*(d/2 - .04), h/2 + .05), (.15, .15, h), M['wood'])
    # Recessed storefront with a warm interior behind the door lattice.
    part('铺门洞', (0, -d/2 - .015, 1.16), (w*.44, .1, 2.08), M['soot'])
    part('门内暖光', (0, -d/2 + .045, 1.16), (w*.4, .06, 1.9), M['window'])
    for sx in (-1, 1):
        part('铺门板', (sx*w*.115, -d/2 - .07, 1.12), (w*.2, .07, 1.98), M['wood'], tilt=0)
        part('门板竖向拼条', (sx*w*.115, -d/2 - .105, 1.12), (w*.18, .03, 1.9), M['wood'])
        part('门框', (sx*w*.235, -d/2 - .055, 1.2), (.11, .16, 2.2), M['wood'])
    part('门楣', (0, -d/2 - .06, 2.26), (w*.5, .17, .14), M['wood'])
    part('门楣匾', (0, -d/2 - .14, 2.5), (w*.42, .07, .32), M['wood'], uv=1.0)
    # Upper storey windows, half of them lit from inside.
    floors = [1] if not two_floors else [1, 0]
    for level in floors:
        base_z = h*.52 + .55 if level == 0 else h*.82
        for sx in (-1, 1):
            wx = sx*w*.28
            part('窗洞', (wx, -d/2 - .03, base_z), (.94, .1, 1.06), M['soot'])
            part('窗内暖光', (wx, -d/2 - .062, base_z), (.82, .05, .94), M['window'] if lit else M['soot'])
            for ix in (-.36, 0, .36):
                part('窗棂竖', (wx + ix, -d/2 - .12, base_z), (.05, .06, 1.08), M['wood'])
            for iz in (-.4, 0, .4):
                part('窗棂横', (wx, -d/2 - .12, base_z + iz), (.96, .06, .05), M['wood'])
            part('窗台', (wx, -d/2 - .1, base_z - .58), (1.02, .14, .08), M['wood'])
    # Side and rear openings give the volume weight from every camera angle.
    for sx in (-1, 1):
        for level, wz in enumerate([h*.3, h*.74] if two_floors else [h*.66]):
            sxpos = sx*(w/2 + .025)
            part('侧窗洞', (sxpos, 0, wz), (.1, .92, 1.0), M['soot'])
            part('侧窗暖光', (sx*(w/2 + .062), 0, wz), (.05, .8, .88), M['window'] if lit else M['soot'])
            for iy in (-.36, 0, .36):
                part('侧窗棂竖', (sx*(w/2 + .1), iy, wz), (.05, .05, 1.02), M['wood'])
            part('侧窗棂横', (sx*(w/2 + .1), 0, wz), (.05, .94, .05), M['wood'])
        part('侧檐梁', (sx*(w/2 + .04), 0, h*.52), (.12, d + .06, .12), M['wood'])
    part('后窗洞', (0, d/2 + .03, h*.68), (w*.26, .12, .94), M['soot'])
    part('后窗棂', (0, d/2 + .1, h*.68), (w*.24, .05, .06), M['wood'])
    # Pitched tile roof: curved slopes, ribbed tile courses and a raised ridge.
    overhang = .5
    rise = max(1.05, d*.42)
    wall_top = h + .05
    for side in (-1, 1):
        rows = 6
        verts = []
        for j in range(rows + 1):
            v = j/rows
            ry = side*(d/2 + overhang)*v
            rz = wall_top + .2 + rise*(1 - v)**1.7
            for sx in (-1, 1):
                verts.append(world((sx*(w/2 + overhang*.8), ry, rz)))
        faces = []
        for j in range(rows):
            a, b = j*2, j*2 + 1
            c, e = b + 2, a + 2
            faces.append((a, b, c, e) if side > 0 else (e, c, b, a))
        add_poly(f'{name} · 瓦坡', verts, faces, M['tile'], uv=1.5, occluder=True)
        half = d/2 + overhang
        v_lo, v_hi = .06, .94
        y_lo, y_hi = side*half*v_lo, side*half*v_hi
        z_lo = wall_top + .2 + rise*(1 - v_lo)**1.7
        z_hi = wall_top + .2 + rise*(1 - v_hi)**1.7
        rib_pitch = math.atan2(z_hi - z_lo, y_hi - y_lo)
        rib_length = math.hypot(y_hi - y_lo, z_hi - z_lo)
        rib_z = (z_lo + z_hi)/2 + .03
        for rib in np.arange(-w/2 - overhang*.7, w/2 + overhang*.7, .32):
            add_box(f'{name} · 瓦垄', world((rib, (y_lo + y_hi)/2, rib_z)),
                    (.045, rib_length, .07), M['tile'], (rib_pitch, 0, theta), 1.4)
        part('檐口', (0, side*(d/2 + overhang - .04), wall_top + .18), (w + overhang*1.7, .16, .13), M['wood'], uv=1.2)
    for side in (-1, 1):
        gable = [world((side*(w/2 + .02), -d/2, wall_top + .05)),
                 world((side*(w/2 + .02), d/2, wall_top + .05)),
                 world((side*(w/2 + .02), 0, wall_top + .2 + rise))]
        add_poly(f'{name} · 山墙', gable, [(0, 1, 2), (2, 1, 0)], M['wall'], uv=1.8, occluder=True)
    part('屋脊', (0, 0, wall_top + rise + .24), (w + overhang*1.75, .2, .18), M['tile'], uv=1.2)
    for sx in (-1, 1):
        part('脊头', (sx*(w/2 + overhang*.86), 0, wall_top + rise + .34), (.2, .26, .3), M['tile'], uv=1.0)
    # Street-facing awning, its poles and the two lanterns that light the frontage.
    if awning:
        part('临街雨篷', (0, -d/2 - .52, 2.78), (w*.9, 1.1, .07), M['cloth'],
             tilt=-.16, uv=1.2)
        for sx in (-1, 1):
            part('篷柱', (sx*w*.36, -d/2 - .96, 1.4), (.07, .07, 2.8), M['wood'], uv=1.0)
        part('篷前横杆', (0, -d/2 - .96, 2.8), (w*.76, .06, .06), M['wood'], uv=1.0)
    for sx in (-1, 1):
        lx = sx*(w/2 - .42)
        cord_top = wall_top + .02
        cord_bottom = cord_top - .5
        add_cylinder(f'{name} · 灯绳', world((lx, -d/2 - .5, cord_top - .25)), .012, .5, M['wood'], 5)
        body = add_sphere(f'{name} · 灯笼', world((lx, -d/2 - .5, cord_bottom - .03)), .19,
                          M['paper'], (1, 1, .85))
        add_cylinder(f'{name} · 灯盖', world((lx, -d/2 - .5, cord_bottom + .16)), .075, .05, M['wood'], 8)
        lantern_sites.append((body.location.copy(), 'house'))
    # A cloth banner on one corner, plus the everyday clutter of a lived-in shop.
    banner_x = w*.46
    add_cylinder(f'{name} · 幡杆', world((banner_x, -d/2 - 1.0, 1.8)), .045, 3.6, M['wood'], 6)
    banner = add_box(f'{name} · 布幡', world((banner_x - .26, -d/2 - 1.0, 2.55)),
                     (.5, .04, 1.6), M['indigo'] if random.random() > .45 else M['cloth'], (0, 0, theta), 1.0)
    banner['occluder'] = False
    if random.random() > .5:
        add_box(f'{name} · 木招牌', world((-w*.3, -d/2 - .22, 2.62)), (.9, .07, .34), M['wood'], (0, 0, theta), 1.0)
    for i in range(random.randint(2, 3)):
        cx = random.uniform(-w*.55, w*.55)
        cy = -d/2 - random.uniform(.25, .75)
        part('木箱', (cx, cy, .22), (.52, .46, .44), M['wood'], uv=1.0, bevel=.02)
        part('木箱箍', (cx, cy, .34), (.55, .49, .04), M['wood'], uv=1.0)
    for i in range(random.randint(2, 4)):
        jx = random.uniform(-w*.5, w*.5)
        jy = -d/2 - random.uniform(.1, .55)
        add_sphere(f'{name} · 酒坛', world((jx, jy, .36)), .2, M['clay'], (1, 1, 1.15))
        add_cylinder(f'{name} · 坛盖', world((jx, jy, .52)), .1, .05, M['wood'], 8)
    bench = part('门口长凳', (w*.3, -d/2 - 1.15, .3), (1.1, .32, .1), M['wood'], uv=1.0)
    for sx in (-1, 1):
        part('凳脚', (w*.3 + sx*.4, -d/2 - 1.15, .14), (.1, .28, .3), M['wood'], uv=1.0)
    part('门前踏步', (0, -d/2 - .42, -.06), (w*.5, .6, .18), M['stone'], uv=1.6)
    return {'name': name, 'x': x, 'y': y, 'w': w, 'd': d, 'h': h, 'theta': theta}


# Choose terraced sites along the real stair lanes.
placed = []
for spawn_guard in [Vector((-8, -16.1)), Vector((-3, -19.5)), Vector((0, 0))]:
    placed.append({'xy': spawn_guard, 'radius': 4.2})

target_houses = 22
stride = 1
order = list(range(0, len(stations), stride))
random.shuffle(order)
for index in order:
    if len(house_records) >= target_houses:
        break
    station = stations[index]
    p = station['point']
    if p.z < -0.4:
        continue
    for side in (-1, 1):
        normal = station['normal']*side
        for offset in (3.6, 4.3, 5.0, 5.7, 6.4):
            x = p.x + normal.x*offset
            y = p.y + normal.y*offset
            if not (-26 < x < 27 and -22 < y < 26):
                continue
            w = random.uniform(3.3, 4.6)
            d = random.uniform(2.8, 3.7)
            h = random.uniform(3.4, 4.0) if random.random() < .55 else random.uniform(4.8, 5.6)
            radius = max(w, d)/2 + .9
            if not clear_of_path(x, y, 2.7):
                continue
            if blocked(x, y, radius*.75):
                continue
            if any((Vector((x, y)) - q['xy']).length < (radius + q['radius'])*.86 for q in placed):
                continue
            g = ground_height(x, y)
            if g is None or abs(g - p.z) > 2.8:
                continue
            corners = []
            for cx in (-w/2, w/2):
                for cy in (-d/2, d/2):
                    height = ground_height(x + cx, y + cy)
                    corners.append(height if height is not None else g)
            if max(corners) - min(corners) > 1.7:
                continue
            floor = min(max(corners) + .04, p.z + .55)
            two_floors = h > 4.4
            facing = (p - Vector((x, y, p.z)))
            facing.z = 0
            if facing.length < .001:
                continue
            facing.normalize()
            theta = math.atan2(facing.x, -facing.y)
            record = build_house(f'山居 · {len(house_records):02d}', x, y, floor, w, d, h,
                                 theta, two_floors, awning=random.random() > .35,
                                 lit=random.random() > .25)
            house_records.append(record)
            placed.append({'xy': Vector((x, y)), 'radius': radius})
            break
print('HOUSES', len(house_records), flush=True)
# ---------------------------------------------------------------- lanterns & lights
LAMP_DATA = []              # warm points exported as web lights


def add_point_lamp(name, position, energy=45.0, color=(1.0, .55, .24), radius=.3, web=7.0):
    light = bpy.data.lights.new(name, 'POINT')
    light.energy = energy
    light.color = color
    light.shadow_soft_size = radius
    holder = bpy.data.objects.new(name, light)
    scene.collection.objects.link(holder)
    holder.location = position
    LAMP_DATA.append({'name': name,
                      'position': [round(position[0], 3), round(position[2], 3), round(-position[1], 3)],
                      'intensity': web, 'distance': 9.0})
    return holder


def build_stone_lamp(name, x, y, rotation, ground):
    add_cylinder(f'{name} · 石础', (x, y, ground + .09), .24, .18, M['stone'], 8)
    add_box(f'{name} · 灯柱', (x, y, ground + .62), (.13, .13, 1.0), M['wood'], (0, 0, rotation), 1.0)
    add_box(f'{name} · 灯托', (x, y, ground + 1.14), (.42, .42, .07), M['wood'], (0, 0, rotation), 1.0)
    for dx, dy in ((-.16, -.16), (-.16, .16), (.16, -.16), (.16, .16)):
        add_box(f'{name} · 灯框', (x + dx, y + dy, ground + 1.36), (.045, .045, .38), M['wood'], (0, 0, rotation), 1.0)
    add_box(f'{name} · 灯纱', (x, y, ground + 1.36), (.3, .3, .34), M['paper'], (0, 0, rotation), 1.0)
    add_poly(f'{name} · 灯顶', [(x + .3, y - .3, ground + 1.55), (x + .3, y + .3, ground + 1.55),
                               (x, y, ground + 1.78), (x - .3, y + .3, ground + 1.55),
                               (x - .3, y - .3, ground + 1.55)],
             [(0, 1, 2), (1, 3, 2), (3, 4, 2), (4, 0, 2), (0, 4, 3, 1)], M['tile'], 1.0)
    add_point_lamp(f'{name} · 暖光', (x, y, ground + 1.36), 60, radius=.22, web=12.0)


def nearest_path_distance(x, y):
    best = 1e9
    for station in stations:
        p = station['point']
        d = (p.x - x)**2 + (p.y - y)**2
        if d < best:
            best = d
    return math.sqrt(best)


lamp_positions = []
for index, station in enumerate(stations):
    if index % 3:
        continue
    p = station['point']
    if p.z < -.3:
        continue
    for side in (-1, 1):
        x = p.x + station['normal'].x*side*1.95
        y = p.y + station['normal'].y*side*1.95
        g = ground_height(x, y)
        if g is None or abs(g - p.z) > .6:
            continue
        if blocked(x, y, .4):
            continue
        if any((Vector((x, y)) - q).length < 5.4 for q in lamp_positions):
            continue
        build_stone_lamp(f'石灯 · {len(lamp_positions):02d}', x, y, random.uniform(0, TAU), g)
        lamp_positions.append(Vector((x, y)))
        break
print('STONE LAMPS', len(lamp_positions), flush=True)

# Lantern strings across the lane: two posts, a sagging cord and seven paper lamps.
STRING_COUNT = 0
for index in range(6, len(stations), 17):
    station = stations[index]
    p = station['point']
    if p.z < -.2:
        continue
    span = 2.85
    a = Vector((p.x + station['normal'].x*span, p.y + station['normal'].y*span, 0))
    b = Vector((p.x - station['normal'].x*span, p.y - station['normal'].y*span, 0))
    ga, gb = ground_height(a.x, a.y), ground_height(b.x, b.y)
    if ga is None or gb is None or abs(ga - p.z) > 1.5 or abs(gb - p.z) > 1.5:
        continue
    top = p.z + 3.5
    add_cylinder(f'灯串 · 立杆A{STRING_COUNT}', (a.x, a.y, p.z + 1.75), .055, 3.5, M['wood'], 6)
    add_cylinder(f'灯串 · 立杆B{STRING_COUNT}', (b.x, b.y, p.z + 1.75), .055, 3.5, M['wood'], 6)
    points = []
    for step in range(9):
        t = step/8
        sag = math.sin(t*math.pi)*.3
        point = a.lerp(b, t)
        point.z = top - sag
        points.append(point)
    for step in range(len(points) - 1):
        p0, p1 = points[step], points[step + 1]
        mid = (p0 + p1)/2
        direction = p1 - p0
        add_box(f'灯串 · 绳{STRING_COUNT}_{step}', mid, (direction.length, .018, .018), M['soot'],
                (0, math.atan2(-direction.z, math.hypot(direction.x, direction.y)), math.atan2(direction.y, direction.x)), .6)
    for step in range(1, 8, 1):
        point = points[step]
        add_cylinder(f'灯串 · 吊绳{STRING_COUNT}_{step}', (point.x, point.y, point.z - .12), .01, .24, M['wood'], 4)
        add_sphere(f'灯串 · 灯笼{STRING_COUNT}_{step}', (point.x, point.y, point.z - .3), .125, M['paper'], (1, 1, .88))
        add_cylinder(f'灯串 · 灯盖{STRING_COUNT}_{step}', (point.x, point.y, point.z - .17), .05, .03, M['wood'], 8)
        add_cylinder(f'灯串 · 灯座{STRING_COUNT}_{step}', (point.x, point.y, point.z - .43), .045, .025, M['wood'], 8)
    STRING_COUNT += 1
print('LANTERN STRINGS', STRING_COUNT, flush=True)

# ---------------------------------------------------------------- street dressing
prop_materials = [M['wood'], M['clay'], M['bamboo'], M['soot']]
placed_props = []


def prop_site(index, side, offset, clearance=.55):
    station = stations[index]
    p = station['point']
    x = p.x + station['normal'].x*side*offset
    y = p.y + station['normal'].y*side*offset
    g = ground_height(x, y)
    if g is None or abs(g - p.z) > .55:
        return None
    if blocked(x, y, .5):
        return None
    if any((Vector((x, y)) - q).length < clearance + .8 for q in placed_props):
        return None
    for q in placed:
        if (Vector((x, y)) - q['xy']).length < q['radius'] - .3:
            return None
    return Vector((x, y, g))


def add_crate(x, y, z, angle, scale=1.0):
    add_box('陈设 · 木箱', (x, y, z + .22*scale), (.52*scale, .46*scale, .44*scale), M['wood'], (0, 0, angle), 1.0, .02)
    for dz in (.1, .34):
        add_box('陈设 · 木箱箍', (x, y, z + dz*scale), (.55*scale, .49*scale, .035), M['wood'], (0, 0, angle), 1.0)
    add_box('陈设 · 箱盖布', (x, y, z + .45*scale), (.56*scale, .5*scale, .02),
            M['cloth'] if random.random() > .5 else M['indigo'], (0, 0, angle), 1.0)


def add_jar(x, y, z, angle):
    add_sphere('陈设 · 酒坛', (x, y, z + .26), .2, M['clay'], (1, 1, 1.2))
    add_cylinder('陈设 · 坛盖', (x, y, z + .46), .11, .06, M['wood'], 8)
    add_box('陈设 · 封坛布', (x, y, z + .5), (.26, .26, .02), M['cloth'], (0, 0, angle), 1.0)


def add_basket(x, y, z, angle):
    add_cylinder('陈设 · 竹筐', (x, y, z + .16), .24, .3, M['bamboo'], 9)
    add_cylinder('陈设 · 筐口', (x, y, z + .32), .26, .04, M['bamboo'], 9)
    for i in range(4):
        a = angle + i*TAU/4
        add_sphere('陈设 · 筐中货', (x + math.cos(a)*.1, y + math.sin(a)*.1, z + .34), .09,
                   M['leaf'] if i % 2 else M['clay'])


def add_firewood(x, y, z, angle):
    for i in range(5):
        add_cylinder('陈设 · 柴薪', (x + math.cos(angle)*i*.09, y + math.sin(angle)*i*.09, z + .08 + (i % 2)*.05),
                     .045, .7, M['wood'], 6, (0, math.pi/2, angle + math.pi/2))


def add_brazier(x, y, z):
    add_cylinder('陈设 · 炭盆', (x, y, z + .12), .26, .24, M['soot'], 10)
    add_cylinder('陈设 · 盆沿', (x, y, z + .25), .28, .05, M['soot'], 10)
    add_sphere('陈设 · 炭火', (x, y, z + .24), .18, M['ember'], (1, 1, .5))


def add_rack(x, y, z, angle):
    for sx in (-1, 1):
        add_cylinder('陈设 · 竹架', (x + math.cos(angle)*sx*.7, y + math.sin(angle)*sx*.7, z + .85),
                     .04, 1.7, M['bamboo'], 6)
    add_box('陈设 · 竹架横杆', (x, y, z + 1.6), (1.5, .05, .05), M['bamboo'], (0, 0, angle), 1.0)
    for i in range(5):
        t = -.6 + i*.3
        px = x + math.cos(angle)*t
        py = y + math.sin(angle)*t
        add_box('陈设 · 晾布', (px, py, z + 1.02), (.22, .02, .95), M['indigo'] if i % 2 else M['cloth'], (0, 0, angle), 1.0)


kinds = ['crate', 'jar', 'basket', 'firewood', 'brazier', 'rack']
for index in range(2, len(stations), 4):
    for side in (-1, 1):
        site = prop_site(index, side, random.uniform(1.75, 2.35))
        if not site:
            continue
        kind = random.choice(kinds)
        angle = random.uniform(0, TAU)
        if kind == 'crate':
            for i in range(random.randint(1, 3)):
                add_crate(site.x + random.uniform(-.25, .25), site.y + random.uniform(-.25, .25), site.z,
                          angle, random.uniform(.85, 1.1))
        elif kind == 'jar':
            for i in range(random.randint(2, 4)):
                add_jar(site.x + random.uniform(-.3, .3), site.y + random.uniform(-.3, .3), site.z, angle)
        elif kind == 'basket':
            add_basket(site.x, site.y, site.z, angle)
            add_basket(site.x + .42, site.y + .12, site.z, angle + 1.1)
        elif kind == 'firewood':
            add_firewood(site.x, site.y, site.z, angle)
        elif kind == 'brazier':
            add_brazier(site.x, site.y, site.z)
            add_point_lamp('陈设 · 炭火光', (site.x, site.y, site.z + .4), 26, (1.0, .42, .16), .4, 6.0)
        else:
            add_rack(site.x, site.y, site.z, angle)
        placed_props.append(Vector((site.x, site.y)))
print('STREET PROPS', len(placed_props), flush=True)

# ---------------------------------------------------------------- shop frontage
baseline = json.loads(BASELINE_META.read_text(encoding='utf8'))
for stall in baseline['stalls']:
    px, pz, py = stall['position']
    x, y = px, -pz
    base_z = py
    nx, nz, ny = stall['normal']
    nx, ny = nx, -nz
    tangent = Vector((-ny, nx, 0)).normalized()
    front = Vector((nx, ny, 0)).normalized()
    # Two lanterns on a rope, a cloth valance and a brazier mark every shop.
    for sign in (-1, 1):
        spot = Vector((x, y, base_z)) + tangent*(1.85*sign) + front*.55
        add_cylinder('铺前 · 灯柱', (spot.x, spot.y, base_z + 1.35), .05, 2.7, M['wood'], 6)
        add_sphere('铺前 · 灯笼', (spot.x, spot.y, base_z + 2.4), .21, M['paper'], (1, 1, .85))
        add_cylinder('铺前 · 灯盖', (spot.x, spot.y, base_z + 2.6), .08, .05, M['wood'], 8)
        add_cylinder('铺前 · 灯坠', (spot.x, spot.y, base_z + 2.16), .03, .12, M['wood'], 6)
        add_point_lamp('铺前 · 暖光', (spot.x, spot.y, base_z + 2.4), 75, radius=.35, web=14.0)
    valance = Vector((x, y, base_z)) + front*.5
    add_box('铺前 · 布檐', (valance.x, valance.y, base_z + 2.72), (3.5, 1.15, .06), M['cloth'], (0, 0, math.atan2(nx, -ny)) if (nx or ny) else (0, 0, 0), 1.2)
    for sign in (-1, 1):
        crate_spot = Vector((x, y, base_z)) + tangent*(2.2*sign) + front*.35
        add_crate(crate_spot.x, crate_spot.y, base_z, random.uniform(0, TAU), 1.05)
        add_jar(crate_spot.x + .5, crate_spot.y - .1, base_z, random.uniform(0, TAU))
    brazier_spot = Vector((x, y, base_z)) + tangent*.9 + front*.5
    add_brazier(brazier_spot.x, brazier_spot.y, base_z)
    add_point_lamp('铺前 · 炭火光', (brazier_spot.x, brazier_spot.y, base_z + .45), 32, (1.0, .45, .18), .45, 7.0)
print('SHOP FRONTAGE', len(baseline['stalls']), flush=True)
# ---------------------------------------------------------------- ground cover
M['grass_a'] = night_material('夜 · 野草浅', (.035, .055, .028), (.15, .19, .09), 'leaf', .92, .2, 256, 31)
M['grass_b'] = night_material('夜 · 野草深', (.018, .03, .018), (.09, .13, .06), 'leaf', .94, .2, 256, 32)
M['grass_c'] = night_material('夜 · 枯草', (.06, .055, .03), (.20, .17, .10), 'leaf', .94, .2, 256, 33)

water_zone = (-2.4 < 0 < 2.4)     # the creek runs near x = 0
houses_xy = [Vector((h['x'], h['y'])) for h in house_records]
house_radius = [max(h['w'], h['d'])/2 + .5 for h in house_records]

blades_verts = []
blades_faces = []
blades_material = []
for attempt in range(5200):
    x = random.uniform(-26, 26)
    y = random.uniform(-23, 25)
    if abs(x) < 3.2 and -23.5 < y < 23.5:
        continue
    if nearest_path_distance(x, y) < 1.5:
        continue
    if blocked(x, y, .7):
        continue
    if any((Vector((x, y)) - q).length < r for q, r in zip(houses_xy, house_radius)):
        continue
    g = ground_height(x, y)
    if g is None or g < -.3:
        continue
    clump = random.randint(4, 9)
    for i in range(clump):
        angle = random.uniform(0, TAU)
        base = Vector((x + random.uniform(-.22, .22), y + random.uniform(-.22, .22), g))
        height = random.uniform(.16, .46)
        wide = random.uniform(.025, .055)
        side = Vector((math.cos(angle), math.sin(angle), 0))*wide
        lean = Vector((math.sin(angle), math.cos(angle), 0))*height*.3
        index = len(blades_verts)
        blades_verts.extend([tuple(base - side), tuple(base + side), tuple(base + lean + Vector((0, 0, height)))])
        blades_faces.append((index, index + 1, index + 2))
        blades_material.append(random.choices([0, 1, 2], weights=[.5, .34, .16])[0])
grass_mesh = bpy.data.meshes.new('夜草 · 成簇草叶')
grass_mesh.from_pydata(blades_verts, [], blades_faces)
grass_mesh.update()
for key in ('grass_a', 'grass_b', 'grass_c'):
    grass_mesh.materials.append(M[key])
for polygon, index in zip(grass_mesh.polygons, blades_material):
    polygon.material_index = index
bpy.data.objects.new('夜草 · 成簇草叶', grass_mesh)
scene.collection.objects.link(bpy.data.objects['夜草 · 成簇草叶'])
print('GRASS BLADES', len(blades_faces), flush=True)

# Rock shadows along the bank, moss caps, and reed clumps at the water's edge.
for i in range(26):
    y = random.uniform(-21, 21)
    side = random.choice((-1, 1))
    x = side*random.uniform(2.6, 4.2)
    g = ground_height(x, y)
    if g is None:
        continue
    add_sphere(f'岸边 · 苔石{i:02d}', (x, y, g + .12), random.uniform(.18, .38), M['rock'],
               (random.uniform(.9, 1.5), random.uniform(.9, 1.4), .55))
    add_sphere(f'岸边 · 苔痕{i:02d}', (x, y, g + .26), random.uniform(.12, .24), M['grass_b'], (1.1, 1.1, .35))

for i in range(18):
    y = random.uniform(-20, 20)
    x = random.uniform(-2.1, 2.1)
    g = ground_height(x, y)
    if g is None:
        continue
    for blade in range(5):
        angle = random.uniform(0, TAU)
        height = random.uniform(.5, 1.1)
        base = Vector((x + random.uniform(-.2, .2), y + random.uniform(-.2, .2), max(g, -.6)))
        side = Vector((math.cos(angle), math.sin(angle), 0))*.02
        add_poly('芦苇', [tuple(base - side), tuple(base + side), tuple(base + Vector((0, 0, height)))],
                 [(0, 1, 2)], M['grass_c'], 1.0)

# River lanterns floating with the current.
for i in range(16):
    y = -19.5 + i*2.6
    x = math.sin(i*.9)*1.1
    if ground_height(x, y) is not None and ground_height(x, y) > 0:
        continue
    add_cylinder(f'河灯 · 灯座{i:02d}', (x, y, -.62), .16, .06, M['wood'], 8)
    add_sphere(f'河灯 · 灯芯{i:02d}', (x, y, -.53), .1, M['paper'], (1, 1, .9))
    for petal in range(6):
        angle = petal*TAU/6
        add_box(f'河灯 · 花瓣{i:02d}', (x + math.cos(angle)*.17, y + math.sin(angle)*.17, -.6),
                (.12, .07, .02), M['fabric_red'], (0, 0, angle), 1.0)
print('RIVER DRESSED', flush=True)

# ---------------------------------------------------------------- bridge rails
bridge_meshes = [o for o in scene.objects if o.type == 'MESH' and '木桥桥面板' in o.name]
if bridge_meshes:
    lo, hi = bounds(bridge_meshes)
    deck = .63
    for side in (-1, 1):
        x = side*(hi.x - .18)
        steps = 9
        for step in range(steps + 1):
            y = lo.y + .3 + (hi.y - lo.y - .6)*step/steps
            add_box(f'桥栏 · 立柱{side}_{step}', (x, y, deck + .48), (.1, .1, .96), M['wood'], uv=1.0)
        add_box(f'桥栏 · 上横{side}', (x, (lo.y + hi.y)/2, deck + .92), (.09, hi.y - lo.y - .5, .09), M['wood'], uv=1.0)
        add_box(f'桥栏 · 下横{side}', (x, (lo.y + hi.y)/2, deck + .52), (.07, hi.y - lo.y - .5, .07), M['wood'], uv=1.0)
        for lamp_y in (lo.y + .9, hi.y - .9):
            add_cylinder(f'桥灯 · 柱{side}{lamp_y:.1f}', (x, lamp_y, deck + 1.35), .05, 1.0, M['wood'], 6)
            add_sphere(f'桥灯 · 灯{side}{lamp_y:.1f}', (x, lamp_y, deck + 1.95), .18, M['paper'], (1, 1, .9))
            add_point_lamp(f'桥灯 · 暖光{side}{lamp_y:.1f}', (x, lamp_y, deck + 1.95), 45, radius=.25, web=9.0)

# ---------------------------------------------------------------- distant silhouettes
for i in range(15):
    angle = i*TAU/15 + .18
    radius = 23.5 + random.uniform(0, 4.5)
    x = math.cos(angle)*radius
    y = math.sin(angle)*radius
    g = ground_height(x, y)
    if g is None or g < 1.5:
        continue
    w = random.uniform(3.6, 5.4)
    d = random.uniform(3.2, 4.4)
    h = random.uniform(3.2, 5.4)
    add_box('远村 · 屋身', (x, y, g + h/2), (w, d, h), M['wall'], (0, 0, angle), 2.4, occluder=True)
    add_box('远村 · 檐口', (x, y, g + h + .1), (w + .7, d + .7, .16), M['tile'], (0, 0, angle), 1.4)
    roof = [Vector((x + math.cos(angle)*sx*(w/2 + .5), y + math.sin(angle)*sx*(d/2 + .5), g + h + 1.1))
            for sx in (-1, 1)]
    add_poly('远村 · 坡顶', [tuple(roof[0]), tuple(roof[1]),
                            (x + math.cos(angle)*0, y + math.sin(angle)*0, g + h + 1.1)],
             [(0, 1, 2), (2, 1, 0)], M['tile'], 1.6, occluder=True)
    add_box('远村 · 烟囱', (x + math.cos(angle + .6)*w*.3, y + math.sin(angle + .6)*w*.3, g + h + .8),
            (.34, .34, 1.0), M['rock'], (0, 0, angle), 1.2)
print('DISTANT VILLAGE', flush=True)

# ---------------------------------------------------------------- night lighting
for obj in list(scene.objects):
    if obj.type == 'LIGHT':
        bpy.data.objects.remove(obj, do_unlink=True)

moon_data = bpy.data.lights.new('月光', 'SUN')
moon_data.energy = 2.5
moon_data.color = (.56, .70, 1.0)
moon_data.angle = .28
moon = bpy.data.objects.new('月光', moon_data)
scene.collection.objects.link(moon)
moon.rotation_euler = (0.95, -0.3, -0.55)

world = bpy.data.worlds.get('市集环境') or bpy.data.worlds.new('市集环境')
scene.world = world
world.use_nodes = True
background = world.node_tree.nodes['Background']
background.inputs[0].default_value = (.035, .052, .09, 1)
background.inputs[1].default_value = .9

scene.render.engine = 'CYCLES'
scene.cycles.samples = 28
scene.cycles.use_denoising = True
scene.cycles.device = 'CPU'
scene.render.resolution_x = 1200
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = 0.2
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.render.image_settings.color_mode = 'RGB'

# A preserved overview camera keeps the blend openable and previewable.
bpy.ops.object.camera_add(location=(46, -64, 62))
overview = bpy.context.object
overview.name = '夜景总览'
overview.rotation_euler = (Vector((0, 0, 1)) - overview.location).to_track_quat('-Z', 'Y').to_euler()
overview.data.type = 'ORTHO'
overview.data.ortho_scale = 76
scene.camera = overview

street_camera = overview.copy()
street_camera.data = overview.data.copy()
scene.collection.objects.link(street_camera)
street_camera.name = '夜市近景 · 灯火街巷'
street_camera.data.type = 'PERSP'
street_camera.data.lens = 30
street_camera.location = (-9.5, -19.4, 3.2)
street_camera.rotation_euler = (Vector((-10.5, 2.5, 4.2)) - street_camera.location).to_track_quat('-Z', 'Y').to_euler()

print('SCENE READY objects', len(scene.objects), flush=True)
# ---------------------------------------------------------------- metadata + export
import hashlib


def web_box(lo, hi, label):
    corners = [(x, y, z) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    points = [web(c) for c in corners]
    return {'min': [round(min(p[i] for p in points), 4) for i in range(3)],
            'max': [round(max(p[i] for p in points), 4) for i in range(3)],
            'collection': label}


blockers = list(baseline.get('blockers', []))
for house in house_records:
    pieces = [o for o in NEW.objects if o.name.startswith(house['name'])]
    if pieces:
        lo, hi = bounds(pieces)
        blockers.append(web_box(lo, hi, house['name']))
for lamp in lamp_positions:
    blockers.append({'min': [round(lamp.x - .3, 4), 0.0, round(-lamp.y - .3, 4)],
                     'max': [round(lamp.x + .3, 4), 3.0, round(-lamp.y + .3, 4)],
                     'collection': '石灯'})
print('BLOCKERS', len(blockers), flush=True)

looks = [item.name for item in scene.view_settings.bl_rna.properties['look'].enum_items]
preferred = 'AgX - Medium High Contrast'
scene.view_settings.look = preferred if preferred in looks else 'None'

moon_direction = moon.rotation_euler.to_quaternion() @ Vector((0, 0, -1))
web_lamps = [lamp for lamp in LAMP_DATA if any(k in lamp['name'] for k in ('石灯', '桥灯', '铺前 · 暖光'))]
web_lamps = web_lamps[:26]

meta = dict(baseline)
meta['source'] = TARGET.relative_to(ROOT).as_posix()
meta['sourceSha256'] = hashlib.sha256(BASE.read_bytes()).hexdigest()
meta['artRevision'] = 'night-lantern-lane-01'
meta['blockers'] = blockers
meta['lighting'] = {
    'viewTransform': 'AgX',
    'look': scene.view_settings.look,
    'exposure': .2,
    'world': {'color': [.035, .052, .09], 'strength': .9},
    'suns': [{'color': [.56, .70, 1.0], 'energy': 2.5,
              'direction': [round(moon_direction.x, 4), round(moon_direction.z, 4), round(-moon_direction.y, 4)]}],
    'lamps': web_lamps,
    'fog': {'color': '#0a1220', 'near': 26, 'far': 92},
    'background': '#0a1220',
}

bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(TARGET))
print('SAVED BLEND', flush=True)

if '--skip-render' not in sys.argv:
    scene.camera = overview
    scene.render.filepath = str(PREVIEW/'night-refined.png')
    bpy.ops.render.render(write_still=True)
    scene.camera = street_camera
    scene.render.filepath = str(PREVIEW/'night-street-detail.png')
    bpy.ops.render.render(write_still=True)
print('PREVIEWS RENDERED', flush=True)

# Merge only in this disposable export session; the saved blend keeps objects apart.
bpy.ops.object.select_all(action='DESELECT')
convertible = [o for o in scene.objects if o.type in {'MESH', 'CURVE'}]
for obj in convertible:
    obj.select_set(True)
if convertible:
    bpy.context.view_layer.objects.active = convertible[0]
    bpy.ops.object.convert(target='MESH')

batches = {}
for obj in scene.objects:
    if obj.type != 'MESH' or obj.get('stallId'):
        continue
    key = (tuple(m.name if m else '' for m in obj.data.materials), bool(obj.get('occluder')),
           bool(obj.get('water')))
    batches.setdefault(key, []).append(obj)
for index, (key, objects) in enumerate(batches.items()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = f'Night_{index:03d}_{key[0][0] if key[0] else "plain"}'
    joined['occluder'] = key[1]
    joined['water'] = key[2]
print('BATCHES', len(batches), flush=True)

bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type == 'MESH' or (obj.type == 'EMPTY' and obj.name.startswith('Shop_')):
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'night.glb'), export_format='GLB', use_selection=True,
                          export_extras=True, export_cameras=False, export_lights=False, export_apply=True)
(OUT/'night.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
print('EXPORTED NIGHT', len(web_lamps), 'lamps', len(blockers), 'blockers', flush=True)
