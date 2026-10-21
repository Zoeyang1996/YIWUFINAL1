"""Bake Blender-only color/normal nodes, retaining their authored coordinates.
Operates on the disposable export scene only; never saves the source .blend.
"""
import bpy
import numpy as np

def pad_baked_image(image,normal=False):
 # Dilate atlas gutters so mipmaps cannot pull black into narrow bevels and slats.
 w,h=image.size;pixels=np.array(image.pixels[:],dtype=np.float32).reshape(h,w,4)
 valid=np.any(pixels[:,:,:3]>1e-7,axis=2)
 fallback=np.array((.5,.5,1),dtype=np.float32) if normal else pixels[:,:,:3][valid].mean(axis=0)
 for _ in range(12):
  sums=np.zeros((h,w,3),dtype=np.float32);count=np.zeros((h,w),dtype=np.float32)
  for dy,dx in ((-1,0),(1,0),(0,-1),(0,1)):
   mask=np.roll(valid,(dy,dx),(0,1));color=np.roll(pixels[:,:,:3],(dy,dx),(0,1))
   sums+=color*mask[:,:,None];count+=mask
  fill=(~valid)&(count>0)
  pixels[:,:,:3][fill]=sums[fill]/count[fill,None];valid|=fill
 pixels[:,:,:3][~valid]=fallback;pixels[:,:,3]=1
 image.pixels.foreach_set(pixels.ravel());image.update();image.pack()

def capture_generated_coordinates(objects):
 for obj in objects:
  if obj.type!='MESH':continue
  # Blender's Generated coordinates are local bounding-box coordinates.
  mesh=obj.data
  if mesh.users>1:obj.data=mesh.copy();mesh=obj.data
  lo=[min(v.co[i] for v in mesh.vertices) for i in range(3)]
  hi=[max(v.co[i] for v in mesh.vertices) for i in range(3)]
  attr=mesh.attributes.new('authored_generated','FLOAT_VECTOR','POINT')
  for vertex,datum in zip(mesh.vertices,attr.data):
   datum.vector=[(vertex.co[i]-lo[i])/max(hi[i]-lo[i],1e-8) for i in range(3)]

def bake_materials(objects):
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
 scene.render.bake.margin=4;scene.render.bake.use_clear=False
 materials={m for o in objects for m in o.data.materials if m}
 report=[]
 for material in materials:
  if not material.use_nodes:continue
  nodes=material.node_tree.nodes;links=material.node_tree.links
  bsdf=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
  if not bsdf or not bsdf.inputs['Base Color'].is_linked:continue
  source=bsdf.inputs['Base Color'].links[0].from_node
  if source.type=='TEX_IMAGE':continue # Imported GLB textures stay untouched.
  # The two imported texture mixes are supported by the glTF exporter.
  if any(n.type=='TEX_IMAGE' for n in nodes):continue
  obs=[o for o in objects if material in o.data.materials[:]]
  assert all(len(o.data.materials)==1 for o in obs), 'Unexpected multi-material procedural mesh'
  for n in list(nodes):
   if n.type=='TEX_COORD':
    attr=nodes.new('ShaderNodeAttribute');attr.attribute_name='authored_generated'
    for link in list(n.outputs['Generated'].links):links.new(attr.outputs['Vector'],link.to_socket)
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:
   o.select_set(True)
   uv=o.data.uv_layers.new(name='AuthoredBake');o.data.uv_layers.active=uv;uv.active_render=True
  bpy.context.view_layer.objects.active=obs[0]
  bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
  bpy.ops.uv.smart_project(angle_limit=1.15192,island_margin=.006)
  bpy.ops.uv.pack_islands(margin=.006)
  bpy.ops.object.mode_set(mode='OBJECT')
  resolution=1024
  image=bpy.data.images.new(material.name+' · 原色烘焙',width=resolution,height=resolution,alpha=False)
  tex=nodes.new('ShaderNodeTexImage');tex.image=image;nodes.active=tex
  output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL' and n.is_active_output)
  original_surface=output.inputs['Surface'].links[0].from_socket
  original_color=bsdf.inputs['Base Color'].links[0].from_socket
  emission=nodes.new('ShaderNodeEmission');links.new(original_color,emission.inputs['Color']);links.new(emission.outputs[0],output.inputs['Surface'])
  print('BAKING COLOR',material.name,len(obs),flush=True)
  bpy.ops.object.bake(type='EMIT');pad_baked_image(image)
  links.new(original_surface,output.inputs['Surface']);nodes.remove(emission)
  normal_input=bsdf.inputs['Normal']
  if normal_input.is_linked:
   normal_image=bpy.data.images.new(material.name+' · 原始凹凸',width=resolution,height=resolution,alpha=False)
   normal_image.colorspace_settings.name='Non-Color'
   normal_tex=nodes.new('ShaderNodeTexImage');normal_tex.image=normal_image;nodes.active=normal_tex
   print('BAKING NORMAL',material.name,flush=True)
   bpy.ops.object.bake(type='NORMAL');pad_baked_image(normal_image,normal=True)
   normal=nodes.new('ShaderNodeNormalMap');links.new(normal_tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],normal_input)
  links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
  report.append(material.name)
 return report
