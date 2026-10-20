import * as THREE from 'three';
import { assetUrl } from '../data/products.js';
import { PHASES, PHASE_ORDER } from '../data/phases.js';
import { loadPreparedModel } from '../core/loader.js';
import { groundShadowTexture, inkRingTexture } from '../core/textures.js';
import { createLightRig } from './lighting.js';
import { tween, updateTweens, easeOutCubic, easeInOutQuart } from '../core/tween.js';

const MODEL_FOOTPRINT = 3.55;
const CAMERA_HOME_Z = 6.05;
const CAMERA_HOME_Y = 1.92;
const GROUND_SHADOW_OPACITY = { morning: 0.52, noon: 0.44, night: 0.34 };
const RING_OPACITY = { morning: 0.62, noon: 0.5, night: 0.24 };

/**
 * 一级页面的三维舞台：模型常驻中央，只换人不换机位。
 * @param {HTMLElement} container
 * @param {{ onEnter?: () => void, onModelReady?: (phaseId: string) => void }} handlers
 */
export function createOverviewStage(container, { onEnter, onModelReady } = {}) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, CAMERA_HOME_Y, CAMERA_HOME_Z);
  const lookAt = new THREE.Vector3(0, 0.66, 0);
  camera.lookAt(lookAt);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const lights = createLightRig(scene);

  // 地面柔影
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({
      map: groundShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  scene.add(shadow);

  // 水墨圆光
  const ring = new THREE.Mesh(
    new THREE.PlaneGeometry(6.6, 6.6),
    new THREE.MeshBasicMaterial({
      map: inkRingTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.004;
  scene.add(ring);

  // 点击后的涟漪
  const ripple = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: inkRingTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0,
    })
  );
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.y = 0.006;
  ripple.visible = false;
  scene.add(ripple);

  const pivot = new THREE.Group();
  scene.add(pivot);

  const groups = new Map();
  const state = {
    spin: -0.35,
    spinTarget: -0.35,
    pitch: 0,
    pitchTarget: 0,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    travel: 0,
    currentId: null,
    entering: false,
    disposed: false,
  };

  /** 模型材质统一挂上透明度，方便淡入淡出 */
  function prepareGroup(group) {
    group.visible = false;
    group.traverse((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if (!material) return;
        material.transparent = true;
        material.depthWrite = true;
        material.opacity = 0;
      });
    });
  }

  function setGroupOpacity(group, value) {
    group.visible = value > 0.002;
    group.traverse((node) => {
      if (!node.isMesh) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if (material) material.opacity = value;
      });
    });
  }

  let firstShown = false;

  async function setPhase(phaseId) {
    if (state.currentId === phaseId) return;
    const previousId = state.currentId;
    const previous = previousId ? groups.get(previousId) : null;

    let next = groups.get(phaseId);
    if (!next) {
      next = await loadPreparedModel(assetUrl(PHASES[phaseId].overviewModel), { targetSize: MODEL_FOOTPRINT });
      prepareGroup(next);
      groups.set(phaseId, next);
      pivot.add(next);
      onModelReady?.(phaseId);
    }

    state.currentId = phaseId;
    lights.apply(phaseId, { immediate: !firstShown });

    tween({
      duration: 700,
      from: 0,
      to: 1,
      onUpdate: (value) => {
        shadow.material.opacity = (GROUND_SHADOW_OPACITY[phaseId] ?? 0.45) * value;
        ring.material.opacity = (RING_OPACITY[phaseId] ?? 0.5) * value;
      },
    });

    if (previous && previous !== next) {
      tween({
        duration: 340,
        from: 1,
        to: 0,
        ease: easeOutCubic,
        onUpdate: (value) => {
          setGroupOpacity(previous, value);
          previous.scale.setScalar(1 + (1 - value) * 0.07);
        },
        onComplete: () => {
          previous.visible = false;
          previous.scale.setScalar(1);
        },
      });
    }

    next.scale.setScalar(0.93);
    tween({
      duration: 760,
      from: 0,
      to: 1,
      ease: easeInOutQuart,
      onUpdate: (value) => {
        setGroupOpacity(next, value);
        next.scale.setScalar(0.93 + 0.07 * value);
      },
    });

    firstShown = true;
  }

  /** 点一下模型：涟漪 + 轻微前推，然后交给外层跳转 */
  function enter() {
    if (state.entering) return;
    state.entering = true;

    ripple.visible = true;
    ripple.material.opacity = 0.85;
    ripple.scale.setScalar(1.1);
    tween({
      duration: 900,
      from: 1.1,
      to: 4.4,
      ease: easeOutCubic,
      onUpdate: (value) => {
        ripple.scale.setScalar(value);
        ripple.material.opacity = Math.max(0, 0.85 * (1 - (value - 1.1) / 3.3));
      },
      onComplete: () => {
        ripple.visible = false;
      },
    });

    const group = groups.get(state.currentId);
    if (group) {
      tween({
        duration: 260,
        from: 1,
        to: 1.05,
        ease: easeOutCubic,
        onUpdate: (value) => group.scale.setScalar(value),
      });
    }

    tween({
      duration: 900,
      from: CAMERA_HOME_Z,
      to: 5.2,
      ease: easeInOutQuart,
      onUpdate: (value) => {
        camera.position.z = value;
        camera.lookAt(lookAt);
      },
    });
    tween({
      duration: 900,
      from: CAMERA_HOME_Y,
      to: 1.66,
      ease: easeInOutQuart,
      onUpdate: (value) => {
        camera.position.y = value;
        camera.lookAt(lookAt);
      },
    });

    window.setTimeout(() => onEnter?.(), 780);
  }

  // ---- 交互 ----
  const canvas = renderer.domElement;

  canvas.addEventListener('pointerdown', (event) => {
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.travel = 0;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!state.dragging) return;
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.travel += Math.abs(dx) + Math.abs(dy);
    state.spinTarget += dx * 0.0062;
    state.pitchTarget = Math.max(-0.24, Math.min(0.26, state.pitchTarget + dy * 0.0016));
  });

  const endDrag = () => {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.pointerId !== null && canvas.hasPointerCapture?.(state.pointerId)) {
      canvas.releasePointerCapture(state.pointerId);
    }
    state.pointerId = null;
    if (state.travel < 8) enter();
  };

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => {
    state.dragging = false;
    state.pointerId = null;
  });

  // ---- 循环 ----
  const clock = new THREE.Clock();
  let rafId = 0;

  function tick() {
    if (state.disposed) return;
    rafId = requestAnimationFrame(tick);
    const delta = Math.min(clock.getDelta(), 0.05);

    updateTweens();

    if (!state.dragging && !state.entering) state.spinTarget += delta * 0.13;
    state.spin += (state.spinTarget - state.spin) * Math.min(1, delta * 6.5);
    state.pitch += (state.pitchTarget - state.pitch) * Math.min(1, delta * 6.5);
    pivot.rotation.y = state.spin;
    pivot.rotation.x = state.pitch;

    ring.rotation.z += delta * 0.015;

    renderer.render(scene, camera);
  }

  function resize() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }

  resize();
  window.addEventListener('resize', resize);
  tick();

  return {
    setPhase,
    enter,
    dispose() {
      state.disposed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
