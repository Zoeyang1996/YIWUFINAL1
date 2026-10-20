import * as THREE from 'three';

function makeCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function toTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** 模型脚下的一团柔影 */
export function groundShadowTexture() {
  const canvas = makeCanvas(256);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 8, 128, 128, 122);
  gradient.addColorStop(0, 'rgba(28, 20, 12, 0.55)');
  gradient.addColorStop(0.42, 'rgba(28, 20, 12, 0.24)');
  gradient.addColorStop(1, 'rgba(28, 20, 12, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return toTexture(canvas);
}

/** 地面一圈水墨圆光 */
export function inkRingTexture() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  for (let i = 0; i < 3; i += 1) {
    const radius = 168 + i * 15;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(46, 34, 22, ${0.16 - i * 0.045})`;
    ctx.lineWidth = 9 - i * 2.4;
    ctx.stroke();
  }

  // 断断续续的笔触，别让圆环太规整
  for (let i = 0; i < 130; i += 1) {
    const angle = (i / 130) * Math.PI * 2 + Math.random() * 0.06;
    const radius = 168 + (Math.random() - 0.5) * 26;
    const length = 5 + Math.random() * 16;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.lineTo(Math.cos(angle + 0.02) * (radius + length), Math.sin(angle + 0.02) * (radius + length));
    ctx.strokeStyle = `rgba(46, 34, 22, ${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.stroke();
  }

  return toTexture(canvas);
}

/** 青石板路 —— 横向铺开的细石纹 */
export function stoneTexture() {
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b9ac95';
  ctx.fillRect(0, 0, size, size);

  const rows = 8;
  const rowHeight = size / rows;
  for (let row = 0; row < rows; row += 1) {
    const offset = row % 2 === 0 ? 0 : 44;
    for (let col = -1; col < 7; col += 1) {
      const x = col * 88 + offset;
      const y = row * rowHeight;
      const shade = 168 + Math.floor(Math.random() * 26);
      ctx.fillStyle = `rgb(${shade}, ${shade - 12}, ${shade - 30})`;
      ctx.fillRect(x + 1.6, y + 1.6, 88 - 3.2, rowHeight - 3.2);
    }
  }

  ctx.globalAlpha = 0.09;
  for (let i = 0; i < 2400; i += 1) {
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#3a2c1c';
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }

  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 10);
  return texture;
}

/** 招牌布幡：竖排字 */
export function bannerTexture(chars, { background = '#c2503a', color = '#f6e8cc' } = {}) {
  const canvas = makeCanvas(256);
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 128, 512);

  ctx.strokeStyle = 'rgba(255, 240, 214, 0.32)';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 108, 492);

  ctx.fillStyle = color;
  ctx.font = '600 74px "Kaiti SC", "STKaiti", "KaiTi", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const step = 500 / (chars.length + 1);
  chars.split('').forEach((char, index) => {
    ctx.fillText(char, 64, step * (index + 1));
  });

  return toTexture(canvas);
}

/** 青瓦屋面 */
export function tileTexture() {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4d5259';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 26) {
    ctx.fillStyle = y % 52 === 0 ? '#585e66' : '#474c53';
    ctx.fillRect(0, y, size, 24);
    ctx.fillStyle = 'rgba(20, 24, 28, 0.34)';
    ctx.fillRect(0, y + 22, size, 4);
  }

  const texture = toTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 1.6);
  return texture;
}

/** 灯笼纸面：中间一团暖光 */
export function lanternTexture() {
  const canvas = makeCanvas(128);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, '#ffe3ae');
  gradient.addColorStop(0.55, '#f0b15f');
  gradient.addColorStop(1, '#c9732a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = 'rgba(120, 52, 18, 0.35)';
  ctx.lineWidth = 3;
  for (let x = 16; x < 128; x += 22) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 128);
    ctx.stroke();
  }

  return toTexture(canvas);
}
