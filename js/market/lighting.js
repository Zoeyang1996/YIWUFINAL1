import * as THREE from 'three';

/** Source-world linear colors and sunlight, with no added color grade. */
export function createAuthoredLighting(scene, renderer, lighting) {
  scene.fog = null;
  renderer.toneMapping = lighting.viewTransform === 'AgX' ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2 ** lighting.exposure;
  const world = new THREE.Color().fromArray(lighting.world.color).multiplyScalar(lighting.world.strength);
  scene.background = world.clone();
  const environmentScene = new THREE.Scene(); environmentScene.background = world.clone();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(environmentScene);
  scene.environment = environment.texture; pmrem.dispose();
  for (const source of lighting.suns) {
    const sun = new THREE.DirectionalLight(new THREE.Color().fromArray(source.color), source.energy);
    sun.target.position.set(-3, 1.3, 0);
    sun.position.copy(sun.target.position).addScaledVector(new THREE.Vector3(...source.direction), -40);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 0.5, far: 100 });
    sun.shadow.bias = -0.00015; sun.shadow.normalBias = 0.025;
    scene.add(sun, sun.target);
  }
  return environment;
}
