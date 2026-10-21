import * as THREE from 'three';

/**
 * Authored Blender lighting: moon, sky and every warm lamp the scene uses.
 * Suns are directional; lamps are point lights placed on the lanterns so the
 * street reads as a chain of little pools of light instead of one flat wash.
 */
export function createAuthoredLighting(scene, renderer, lighting) {
  const fog = lighting.fog;
  scene.fog = fog ? new THREE.Fog(new THREE.Color(fog.color), fog.near, fog.far) : null;
  renderer.toneMapping = lighting.viewTransform === 'AgX' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2 ** lighting.exposure;

  const world = new THREE.Color().fromArray(lighting.world.color).multiplyScalar(lighting.world.strength);
  scene.background = lighting.background ? new THREE.Color(lighting.background) : world.clone();
  const environmentScene = new THREE.Scene();
  environmentScene.background = world.clone();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene);
  scene.environment = environment.texture;
  pmrem.dispose();

  for (const source of lighting.suns ?? []) {
    const sun = new THREE.DirectionalLight(new THREE.Color().fromArray(source.color), source.energy);
    sun.target.position.set(-3, 1.3, 0);
    sun.position.copy(sun.target.position).addScaledVector(new THREE.Vector3(...source.direction), -40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 0.5, far: 110 });
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.025;
    scene.add(sun, sun.target);
  }

  const lamps = [];
  for (const lamp of lighting.lamps ?? []) {
    const color = lamp.color ? new THREE.Color().fromArray(lamp.color) : new THREE.Color('#ffb066');
    const point = new THREE.PointLight(color, lamp.intensity ?? 7, lamp.distance ?? 9, 2);
    point.position.fromArray(lamp.position);
    scene.add(point);
    lamps.push(point);
  }

  return { environment, lamps };
}
