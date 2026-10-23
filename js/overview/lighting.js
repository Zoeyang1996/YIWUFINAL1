import * as THREE from 'three';
import { tween } from '../core/tween.js';

/** 三个时段各自的灯位与色温 */
const RIGS = {
  morning: {
    hemiSky: '#f7eddb',
    hemiGround: '#9c8a6c',
    hemiIntensity: 1.28,
    keyColor: '#fff0d0',
    keyIntensity: 2.05,
    keyPosition: [4.2, 5.8, 3.6],
    rimColor: '#a8c0d6',
    rimIntensity: 0.55,
    warmIntensity: 0,
  },
  noon: {
    hemiSky: '#fff8e6',
    hemiGround: '#a8987a',
    hemiIntensity: 1.42,
    keyColor: '#fff6de',
    keyIntensity: 2.6,
    keyPosition: [3.2, 7.2, 2.6],
    rimColor: '#b8c8d8',
    rimIntensity: 0.42,
    warmIntensity: 0,
  },
  night: {
    hemiSky: '#5f72a6',
    hemiGround: '#262e42',
    hemiIntensity: 2.15,
    keyColor: '#dde6fb',
    keyIntensity: 2.75,
    keyPosition: [3.4, 6.2, 3.8],
    rimColor: '#9db5ee',
    rimIntensity: 1.25,
    warmIntensity: 5,
  },
};

/**
 * 建一套灯，之后只需 apply(时段) 就能平滑换光。
 * @param {THREE.Scene} scene
 */
export function createLightRig(scene) {
  const hemi = new THREE.HemisphereLight('#f7eddb', '#9c8a6c', 1.28);

  const key = new THREE.DirectionalLight('#fff0d0', 2.05);
  key.position.set(4.2, 5.8, 3.6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -4.5;
  key.shadow.camera.right = 4.5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0012;
  key.shadow.radius = 3;

  const rim = new THREE.DirectionalLight('#a8c0d6', 0.55);
  rim.position.set(-4.4, 3.2, -4.6);

  // 夜里从街面打上来的暖光，像是摊前的灯笼
  const warm = new THREE.PointLight('#ff9a4d', 0, 13, 1.5);
  warm.position.set(0.6, 1.4, 2.6);

  scene.add(hemi, key, key.target, rim, warm);

  function apply(phaseId, { immediate = false } = {}) {
    const rig = RIGS[phaseId] ?? RIGS.morning;
    const duration = immediate ? 1 : 620;

    const fromSky = hemi.color.clone();
    const fromGround = hemi.groundColor.clone();
    const fromKey = key.color.clone();
    const fromRim = rim.color.clone();
    const fromHemi = hemi.intensity;
    const fromKeyI = key.intensity;
    const fromRimI = rim.intensity;
    const fromWarm = warm.intensity;

    const toSky = new THREE.Color(rig.hemiSky);
    const toGround = new THREE.Color(rig.hemiGround);
    const toKey = new THREE.Color(rig.keyColor);
    const toRim = new THREE.Color(rig.rimColor);

    tween({
      duration,
      from: 0,
      to: 1,
      onUpdate: (value) => {
        hemi.color.copy(fromSky).lerp(toSky, value);
        hemi.groundColor.copy(fromGround).lerp(toGround, value);
        key.color.copy(fromKey).lerp(toKey, value);
        rim.color.copy(fromRim).lerp(toRim, value);
        hemi.intensity = fromHemi + (rig.hemiIntensity - fromHemi) * value;
        key.intensity = fromKeyI + (rig.keyIntensity - fromKeyI) * value;
        rim.intensity = fromRimI + (rig.rimIntensity - fromRimI) * value;
        warm.intensity = fromWarm + (rig.warmIntensity - fromWarm) * value;
      },
    });

    key.position.set(...rig.keyPosition);
    key.target.position.set(0, 0.7, 0);
  }

  return { apply, key };
}
