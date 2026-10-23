import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A continuous village and layered mountain horizon outside the playable paths. */
export function createMarketSurroundings(scene, phase) {
  const night = phase.id === 'night';
  const sky = night ? '#182536' : '#c8c9b4';
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, night ? 35 : 48, 155);
  const root = new THREE.Group(); root.name = '市井街巷与远山';
  let seed = 322;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  const textureCanvas = document.createElement('canvas'); textureCanvas.width = textureCanvas.height = 128;
  const ctx = textureCanvas.getContext('2d'); ctx.fillStyle = '#e7e3d4'; ctx.fillRect(0,0,128,128);
  for (let i=0;i<750;i++) { ctx.fillStyle=`rgba(85,72,55,${random()*.09})`; ctx.fillRect(random()*128,random()*128,random()*12+1,random()*3+1); }
  const texture = new THREE.CanvasTexture(textureCanvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = (color, extra={}) => new THREE.MeshStandardMaterial({color,roughness:1,...extra});
  const wall=material(night?'#526178':'#d3c8aa',{map:texture}), roof=material(night?'#29384b':'#67716b');
  const wood=material(night?'#45434a':'#796751'), stone=material(night?'#404a56':'#9e9986');
  const cloth=material(night?'#7f4838':'#ac624a'), leaf=material(night?'#2c4146':'#7e8761');
  const windowMat=material(night?'#e19b51':'#515b55',{emissive:night?'#ff8c35':'#000000',emissiveIntensity:night?1.3:0});
  const ground=new THREE.Mesh(new THREE.CircleGeometry(175,96),material(night?'#353f49':'#a8aa8c'));
  ground.rotation.x=-Math.PI/2;ground.position.y=-1.8;ground.receiveShadow=true;root.add(ground);
  const unit=new THREE.BoxGeometry(1,1,1);
  function box(g,x,y,z,w,h,d,m) { const o=new THREE.Mesh(unit,m);o.position.set(x,y,z);o.scale.set(w,h,d);g.add(o);return o; }
  function house(angle,radius,i) {
    const g=new THREE.Group();g.position.set(Math.sin(angle)*radius,-1.65,Math.cos(angle)*radius);g.rotation.y=angle+Math.PI;
    const w=5.5+random()*.65,d=4.5+random()*.5,h=3.65+random()*.45;
    box(g,0,.65,0,w+.5,1.3,d+.5,stone);
    box(g,0,1.3+h/2,0,w,h,d,wall);
    // Solid gable under a curved grey tiled roof, including the side closures.
    const gable=new THREE.Shape();gable.moveTo(-w/2,0);gable.lineTo(0,1.5);gable.lineTo(w/2,0);gable.closePath();
    const ge=new THREE.ExtrudeGeometry(gable,{depth:d,bevelEnabled:false});ge.translate(0,h+1.3,-d/2);g.add(new THREE.Mesh(ge,wall));
    const shape=new THREE.Shape();shape.moveTo(-w*.6,.02);shape.quadraticCurveTo(-w*.28,.28,0,1.62);shape.quadraticCurveTo(w*.28,.28,w*.6,.02);shape.lineTo(w*.6,-.14);shape.quadraticCurveTo(w*.28,.1,0,1.42);shape.quadraticCurveTo(-w*.28,.1,-w*.6,-.14);shape.closePath();
    const rg=new THREE.ExtrudeGeometry(shape,{depth:d+.7,bevelEnabled:false,curveSegments:6});rg.translate(0,h+1.3,-(d+.7)/2);g.add(new THREE.Mesh(rg,roof));
    box(g,0,h+2.9,0,.18,.18,d+.9,roof);
    box(g,0,2.45,d/2+.04,1.15,2.3,.12,wood);
    for (const x of [-1.85,1.85]) {
      box(g,x,3.3,d/2+.06,1.15,1.25,.12,windowMat);
      for (const dx of [-.4,0,.4])box(g,x+dx,3.3,d/2+.14,.07,1.3,.1,wood);
      box(g,x,3.3,d/2+.15,1.2,.07,.1,wood);
    }
    box(g,0,1.35,d/2+.4,w+.2,.2,1,stone);
    // Side lanes contain everyday furniture, cloth stalls, jars and greenery.
    if (i%3===0) {
      box(g,1.5,3.15,d/2+1.3,2.2,.12,1.8,cloth).rotation.x=.13;
      box(g,1.5,1.9,d/2+1.4,2,1,.9,wood);
      for (const x of [.5,2.5])box(g,x,2.25,d/2+2,.08,2,.08,wood);
      for(let k=0;k<3;k++) {const jar=new THREE.Mesh(new THREE.CylinderGeometry(.17,.23,.42,8),stone);jar.position.set(.85+k*.5,2.6,d/2+1.4);g.add(jar);}
    } else {
      box(g,-2.2,1.6,d/2+1,.9,.5,.9,wood);
      const tree=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),leaf);tree.position.set(-2.3,2.4,d/2+.8);tree.scale.set(.8,1,.75);g.add(tree);
    }
    // Four small batches per building; individual houses cull independently.
    g.updateMatrixWorld(true);const batches=new Map();
    g.traverse(o=>{if(!o.isMesh)return;let geo=o.geometry.clone().applyMatrix4(o.matrixWorld);if(geo.index){const old=geo;geo=geo.toNonIndexed();old.dispose();}if(!batches.has(o.material))batches.set(o.material,[]);batches.get(o.material).push(geo);});
    for(const [mat,geometries] of batches){const mesh=new THREE.Mesh(mergeGeometries(geometries),mat);mesh.name=`街巷民居_${i}`;root.add(mesh);geometries.forEach(x=>x.dispose());}
    g.traverse(o=>{if(o.geometry&&o.geometry!==unit)o.geometry.dispose();});
  }
  for(let i=0;i<30;i++)house(i*Math.PI*2/30,40+(i%3)*2,i);
  unit.dispose();
  // Closed 360° mountain bands, with gentle asymmetrical profiles rather than a flat horizon.
  for(let layer=0;layer<3;layer++) {
    const positions=[],indices=[],count=160,radius=72+layer*30;
    for(let i=0;i<=count;i++) {
      const a=i/count*Math.PI*2;
      const h=10+layer*5+5*Math.sin(a*3+layer)+3*Math.sin(a*7+1.2)+2*Math.sin(a*13+.6);
      positions.push(Math.sin(a)*radius,-5,Math.cos(a)*radius,Math.sin(a)*radius,h,Math.cos(a)*radius);
      if(i<count){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();
    const colors=night?['#304352','#3d4e5b','#52616a']:['#86988b','#a2b0a1','#bac2af'];
    const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:colors[layer],side:THREE.DoubleSide}));mesh.name=`远山_${layer}`;root.add(mesh);
  }
  scene.add(root);return root;
}
