/**
 * util.js —— 数学、缓动、Canvas 贴图、补间
 */
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- 缓动 ---------------- */
export const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
export const easeOutQuint = t => 1 - Math.pow(1 - t, 5);
export const easeInOutQuint = t => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2);

/* ---------------- Canvas 贴图工厂 ---------------- */
export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = opts.aniso || 8;
  if (opts.repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  if (opts.flipY === false) t.flipY = false;
  t.needsUpdate = true;
  return t;
}

/** 生成一张程序化噪声/拉丝贴图（用于粗糙度或法线） */
export function noiseTex(size, opts = {}) {
  const { streaks = false, base = 128, amp = 26, vertical = false } = opts;
  return canvasTex(size, size, (g, w, h) => {
    g.fillStyle = `rgb(${base},${base},${base})`;
    g.fillRect(0, 0, w, h);
    const n = streaks ? 2600 : 24000;
    for (let i = 0; i < n; i++) {
      const v = clamp(base + (Math.random() - 0.5) * amp * 2, 0, 255) | 0;
      g.fillStyle = `rgba(${v},${v},${v},${streaks ? 0.5 : 0.35})`;
      if (streaks) {
        const len = 12 + Math.random() * w * 0.9;
        if (vertical) g.fillRect(Math.random() * w, Math.random() * h, 1, len);
        else g.fillRect(Math.random() * w, Math.random() * h, len, 1);
      } else {
        const s = 1 + Math.random() * 2;
        g.fillRect(Math.random() * w, Math.random() * h, s, s);
      }
    }
  }, { data: true, repeat: opts.repeat || [1, 1] });
}

/** 把一张 canvas 贴图的**线性均值**归一到目标值（原地修改，返回同一张贴图）。
 *
 * ⚠️⚠️ 为什么需要它（第 62 轮踩出来的）：
 *   `map` 是**乘在底色上**的，所以「贴图均值」直接决定画面亮度 ——
 *   加了 map 就必须反解底色来补偿。而程序化噪声是用 `Math.random()` 画的，
 *   **每次加载均值都在抖**（实测同一段代码两次加载差 1.1%），
 *   于是「底色该补多少」成了一个每次都不一样的量，验收也只能撞运气。
 *   归一化之后它是个**确定的常数**，底色补偿一次算准、以后不再变。
 *
 * ⚠️ **逐通道**归一化，不是三通道合起来求一个均值 —— 后者会保留贴图自身的色调
 *   （实测：合起来归一化时蓝通道 0.870、红绿 0.900），于是底色补偿在三通道上
 *   不一致，墙会偏色。逐通道归一化后贴图是**中性灰**，色调完全交给 `color`。
 * ⚠️ 归一化必须在**线性域**做 —— 着色器就是在线性域把 map 乘到 color 上的。
 *   在 sRGB 域按比例缩放得到的均值是错的。
 * ⚠️ 只该用在「本来就要接近白、均值越低越暗」的贴图上；对本来就是图案的贴图
 *   （碎石、草地、门缝）不要用，那会把它们的色调改掉。
 */
export function normalizeTexMean(t, target = 0.90) {
  const c = t.image;
  const g = c.getContext('2d', { willReadFrequently: true });
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const s2l = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const l2s = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const sum = [0, 0, 0];
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    sum[0] += s2l(d[i] / 255); sum[1] += s2l(d[i + 1] / 255); sum[2] += s2l(d[i + 2] / 255);
  }
  const k = [target / (sum[0] / n), target / (sum[1] / n), target / (sum[2] / n)];
  for (let i = 0; i < d.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      /* ⚠️⚠️ 写回必须过 `l2s`（线性 → sRGB）。第一版漏了这一步，把线性值
         当 sRGB 直接存进 canvas ⇒ 贴图整体变暗，实测「线性均值」变成
         `s2l(0.95) = 0.8907` —— 这个数字恰好是漏转换的指纹，一眼就能认出来。 */
      const v = l2s(s2l(d[i + ch] / 255) * k[ch]);
      d[i + ch] = Math.round(Math.min(1, Math.max(0, v)) * 255) | 0;
    }
  }
  g.putImageData(img, 0, 0);
  /* ⚠️⚠️ 记录**实际达成**的线性均值 —— 因为上面的 `Math.min(1, …)` 会**裁剪**。
     贴图带深色特征时（混凝土的骨料点），原始线性均值可能远低于 target，
     归一化就要把整体**放大** ⇒ 近白像素撞上 1.0 被裁掉 ⇒ **target 永远够不到**。
     实测：混凝土贴图 target 0.95，实际只到 **0.9356**（差 −1.5%）；
     若按名义 0.95 反解底色，成品会**暗 1.9%**（逐像素 A/B 实测）。
     ⇒ 调用方（材质底色反解）**必须用这个实测值**，见 `mats.js: albedoFrom()`。
     ⚠️ 不能靠「多迭代几轮」解决：裁剪存在时，每轮都会裁得更多，
       均值只会收敛到「可达上限」，不会到 target。这是**设计约束**，不是精度问题。 */
  const got = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) {
    got[0] += s2l(d[i] / 255); got[1] += s2l(d[i + 1] / 255); got[2] += s2l(d[i + 2] / 255);
  }
  t.userData.meanLin = { r: got[0] / n, g: got[1] / n, b: got[2] / n, target };
  t.needsUpdate = true;
  return t;
}

/* ---------------- 补间 ---------------- */
export class Tweens {
  constructor() { this.list = []; }
  add(o) {
    o._t = 0;
    o.dur = o.dur || 0.8;
    o.ease = o.ease || easeInOutCubic;
    this.list.push(o);
    return o;
  }
  /** 中断某类补间（按 tag 或全部） */
  kill(tag) {
    if (tag === undefined) { this.list.length = 0; return; }
    this.list = this.list.filter(o => o.tag !== tag);
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      o._t += dt;
      let k = clamp(o._t / o.dur, 0, 1);
      const e = o.ease(k);
      o.onUpdate && o.onUpdate(e, k);
      if (k >= 1) { o.onDone && o.onDone(); this.list.splice(i, 1); }
    }
  }
}

/* ---------------- 颜色 ---------------- */
export const C = {
  brand: 0x3fb983,
  brandDim: 0x1f6b4c,
  amber: 0xd9a45a,
  red: 0xd9605a,
  blue: 0x5aa9e6,
  violet: 0xa78bfa,
  cyan: 0x4fd1c5,
  ink: 0x0b100e,
  panel: 0x17201b,
  line: 0x2b382f,
  // 柜体/钣金
  ral7035: 0xc8ccc6,
  ral7032: 0xb6bab3,
  ral7016: 0x3a4045,
  steel: 0xb9c0c6,
  alu: 0xd3d8dc,
  // 塑料
  pcDark: 0x2a2f33,
  pcGray: 0x4a5157,
  pcBlue: 0x2f4d6b,
  pcBeige: 0xd8d2c4,
  pcGreen: 0x2f5c46,
  // 铜/绝缘
  copper: 0xb87333,
  brass: 0xc9a227,
  insul: 0x2b2f33,
};

export const FAM_COLOR = {
  '继电器': '#5aa9e6',
  '变送器': '#3fb983',
  '温控': '#d9a45a',
  '报警': '#e06c75',
  '电源': '#a78bfa',
};

export const hexToInt = h => parseInt(h.replace('#', ''), 16);
