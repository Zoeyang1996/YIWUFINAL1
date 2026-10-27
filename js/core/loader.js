import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MODEL_ASSETS } from '../data/asset-manifest.js';
import { downloadModel } from './model-download.js';

const loader = new GLTFLoader();
const cache = new Map();

/** 载入 glb，同一地址只请求一次 */
export function loadGltf(url) {
  const key = url;
  if (!cache.has(key)) {
    cache.set(
      key,
      loadModel(url).catch((error) => {
        cache.delete(key);
        throw error;
      })
    );
  }
  return cache.get(key);
}

async function loadModel(url) {
  const absolute = new URL(url, document.baseURI);
  const entry = MODEL_ASSETS[decodeURI(absolute.pathname).replace(/^\//, '')];
  if (!entry) return loader.loadAsync(url);
  const buffer = await downloadModel(entry, document.baseURI);
  return loader.parseAsync(buffer, new URL('.', absolute).href);
}

/** 让模型的贴图进 sRGB、开阴影 */
function prepareMaterials(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = false;
    node.frustumCulled = false;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material) continue;
      if (material.map) material.map.colorSpace = THREE.SRGBColorSpace;
      material.roughness = material.roughness ?? 0.82;
      material.metalness = material.metalness ?? 0.04;
    }
  });
}

/**
 * 把模型缩放、居中、落到 y=0。
 * targetSize 指底面最大边（x/z 里较大的一边）要占多少世界单位。
 */
export function normalizeModel(root, targetSize) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / extent;

  root.scale.multiplyScalar(scale);

  box.setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;

  return root;
}

/** 加载 + 规整，返回可直接放进场景的 Group */
export async function loadPreparedModel(url, { targetSize = 2.6 } = {}) {
  const gltf = await loadGltf(url);
  const root = gltf.scene.clone(true);
  const backdrop = [];
  root.traverse(node => { if (node.userData.backdrop) backdrop.push(node); });
  backdrop.forEach(node => node.removeFromParent());
  prepareMaterials(root);
  normalizeModel(root, targetSize);

  const group = new THREE.Group();
  group.add(root);
  group.userData.modelRoot = root;
  return group;
}

/** 量一下规整之后的高度，用来摆相机 */
export function measureHeight(group) {
  const box = new THREE.Box3().setFromObject(group);
  return box.getSize(new THREE.Vector3()).y;
}

export function disposeTree(root) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose();
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      if (!material) return;
      material.map?.dispose();
      material.dispose();
    });
  });
}
