"""Project actual solid surfaces at character-body height into a fine collision grid.
Run in Blender background mode. The source and web GLB are read-only here.
"""
import bpy,json,math
import numpy as np
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def build_collision(source):
 bpy.ops.wm.open_mainfile(filepath=str(source));bpy.context.view_layer.update()
 size=.16;origin=(-21.6,-18.4);width=232;height=252;grid=np.zeros((height,width),dtype=np.uint8)
 low=1.293133+.32;high=1.293133+1.65
 deps=bpy.context.evaluated_depsgraph_get();count=0
 def clip(poly,y,above):
  out=[]
  for i,a in enumerate(poly):
   b=poly[(i+1)%len(poly)];ina=a[1]>=y if above else a[1]<=y;inb=b[1]>=y if above else b[1]<=y
   if ina:out.append(a)
   if ina!=inb:out.append(a+(b-a)*((y-a[1])/(b[1]-a[1])))
  return out
 def raster(poly):
  pts=np.array([[v[0],v[2]] for v in poly]);mn=pts.min(axis=0);mx=pts.max(axis=0)
  x0=max(0,int(math.floor((mn[0]-origin[0])/size))-1);x1=min(width-1,int(math.floor((mx[0]-origin[0])/size))+1)
  z0=max(0,int(math.floor((mn[1]-origin[1])/size))-1);z1=min(height-1,int(math.floor((mx[1]-origin[1])/size))+1)
  if x0>x1 or z0>z1:return
  zz,xx=np.mgrid[z0:z1+1,x0:x1+1];p=np.stack((origin[0]+(xx+.5)*size,origin[1]+(zz+.5)*size),axis=-1)
  pos=np.ones(xx.shape,dtype=bool);neg=pos.copy();edge=np.zeros(xx.shape,dtype=bool)
  area=0
  for i,a in enumerate(pts):
   b=pts[(i+1)%len(pts)];d=b-a;area+=a[0]*b[1]-b[0]*a[1]
   cross=d[0]*(p[:,:,1]-a[1])-d[1]*(p[:,:,0]-a[0]);pos&=cross>=-1e-8;neg&=cross<=1e-8
   t=np.clip(np.sum((p-a)*d,axis=-1)/max(float(d@d),1e-12),0,1)
   edge|=np.sum((p-(a+t[:,:,None]*d))**2,axis=-1)<=(size*.72)**2
  inside=(pos|neg) if abs(area)>1e-8 else np.zeros(xx.shape,dtype=bool)
  grid[z0:z1+1,x0:x1+1]|=(inside|edge).astype(np.uint8)
 for o in bpy.context.scene.objects:
  if o.type not in {'MESH','CURVE','FONT'} or o.name not in bpy.context.view_layer.objects or o.hide_render or any(c.hide_render for c in o.users_collection):continue
  if o.name in {'背景纸','沿用白模地台','基座下沿'} or o.name.startswith(('石基','门前踏步')):continue
  ev=o.evaluated_get(deps);mesh=ev.to_mesh()
  if not mesh:continue
  mesh.calc_loop_triangles()
  verts=np.array([[p.x*5,p.z*5,-p.y*5] for v in mesh.vertices for p in [o.matrix_world@v.co]])
  if len(verts) and verts[:,1].max()>=low and verts[:,1].min()<=high:
   for tri in mesh.loop_triangles:
    p=verts[list(tri.vertices)]
    if p[:,1].max()<low or p[:,1].min()>high:continue
    poly=clip(list(p),low,True)
    if poly:poly=clip(poly,high,False)
    if len(poly)>=2:raster(poly)
   count+=1
  ev.to_mesh_clear()
 result={'cellSize':size,'origin':list(origin),'width':width,'height':height,'occupied':np.flatnonzero(grid.ravel()).tolist(),
         'radius':.34,'bodyHeight':1.65,'sourceMeshes':count}
 print('COLLISION',count,'meshes',len(result['occupied']),'cells',flush=True)
 return result

if __name__=='__main__':
 path=ROOT/'assets/markets/morning.json';data=json.loads(path.read_text(encoding='utf8'))
 data['collision']=build_collision(ROOT/data['source'])
 path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
