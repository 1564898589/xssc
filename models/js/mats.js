/**
 * mats.js —— 材质库
 * 设计原则：工业级 PBR，喷涂钣金用低金属度+中等粗糙，金属件用高金属度+环境反射，
 * 全部走 scene.environment（PMREM）以获得柔和的环境光反射，避免塑料感。
 */
import * as THREE from 'three';
import { C, noiseTex, canvasTex, normalizeTexMean } from './util.js';

/* ---------- 共享贴图 ---------- */
const texRoughSteel = noiseTex(256, { streaks: true, base: 150, amp: 34, repeat: [2, 2] });
const texRoughPlastic = noiseTex(256, { base: 140, amp: 18, repeat: [1, 1] });

/* ---------- 微穿孔贴图（散热孔） ---------- */
const texPerf = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#000000';
  for (let y = 8; y < h; y += 16)
    for (let x = 8; x < w; x += 16) {
      g.beginPath(); g.arc(x, y, 3.6, 0, Math.PI * 2); g.fill();
    }
}, { data: true, repeat: [1, 1] });

/* ---------- 百叶窗贴图（户外柜通风窗） ---------- */
const texLouver = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#111'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 26) {
    const grad = g.createLinearGradient(0, y, 0, y + 26);
    grad.addColorStop(0, '#cfd4d0'); grad.addColorStop(0.45, '#8d9490');
    grad.addColorStop(0.5, '#20242a'); grad.addColorStop(1, '#0b0d10');
    g.fillStyle = grad; g.fillRect(0, y, w, 24);
  }
}, { repeat: [1, 1] });

/* ---------- 粉末喷涂面漆贴图 ----------
 * 大面积钣金最容易“糊成一块白板”。这里叠一层极轻微的斑纹（橘皮 + 细颗粒），
 * 平均亮度接近 1.0，几乎不改变底色，但能打破纯色平面，让高光有层次。
 */
const texPowderMap = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#f4f5f2'; g.fillRect(0, 0, w, h);
  // 橘皮起伏（大尺度、低对比）
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = 9 + Math.random() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.16)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // 细颗粒（喷涂雾化不均）
  for (let i = 0; i < 11000; i++) {
    const v = 226 + Math.random() * 30;
    g.fillStyle = `rgba(${v},${v},${v},${0.16 + Math.random() * 0.34})`;
    const s = 0.8 + Math.random() * 1.7;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}, { repeat: [2, 2] });

/* ---------- 乳胶漆墙面（第 62 轮） ----------
 * ⚠️ 为什么加它：`M.wall` 原来是 `std(0x7e847d, 0.90, 0.0)` —— **一点贴图都没有**。
 *    而它是全库**面积最大的平面**：kyn28 / assembly / dcpanel 三个户内场景的整面墙、
 *    gis 的后墙与侧墙板都用它。出图（`gis.png`）里那面占了画面近 1/4 的墙
 *    就是**一块没有任何构造的纯灰板** —— 这是「简陋感」最直接的来源。
 *    （吊顶第 46 轮有分缝、踢脚/阴角线第 47 轮补齐、墙面竖缝第 60 轮补上，
 *      但那些都是**几何线条**；墙本身**表面**一直是纯色。）
 *
 * 设计：与 `texPowderMap` 同一路子 —— **近白、均值≈1.0**，只打破纯色平面、不改底色。
 *   ① 中频不规则斑驳：用**大量小圆**叠出来，不是几十个大圆；
 *   ② 细颗粒（乳胶漆的橘皮）：密、小、低对比。
 * ⚠️⚠️ 第一版用「几十个 r 9~30 的大径向渐变」，出图一看**读成了「水渍」** ——
 *    大圆是**可识别的形状**，再被 `repeat` 一平铺就成了规则花纹，比纯色更糟。
 *    ⇒ **墙面要的是「表面」，不是「图案」**：任何能被一眼认出来的形状都算失败。
 *    第二版改成「大量小圆叠出无规则斑驳」，只保留**尺度**上的层次，不保留**形状**。
 * ⚠️ 尺度按「屏幕上看得见」定，不是按物理真实定：
 *    默认机位下墙面约 33~41 px/m，`repeat [3,2]` 让 256px 贴图覆盖 ~3m
 *    ⇒ 小圆（r 2.5~7px）落到 3~8cm ⇒ 屏幕上 1~3px，读作**表面**而不是花纹。
 * ⚠️ 末尾 `normalizeTexMean(…, 0.95)` 把线性均值**钉死**在 0.95 ——
 *    程序化噪声每次加载均值都不同（实测差 1.1%），不钉死就没法确定底色补多少。
 * ⚠️ 与 `texPowderMap` 分开一张、不共用：墙面的斑驳尺度要比钣金喷涂大一号，
 *    共用会变成「柜体和墙是同一种表面」。多一张 256×256 贴图不心疼。
 */
const texWallPaint = normalizeTexMean(canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#fdfdfb'; g.fillRect(0, 0, w, h);
  // ① 中频斑驳：大量小圆相互叠加 ⇒ 形状不可辨认，只剩「面不匀」的感觉
  for (let i = 0; i < 1400; i++) {
    const up = Math.random() < 0.5;
    g.fillStyle = up ? 'rgba(255,255,255,.04)' : 'rgba(206,210,204,.035)';
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, 2.5 + Math.random() * 4.5, 0, Math.PI * 2);
    g.fill();
  }
  // ② 橘皮细颗粒 —— 表面质感主要靠这一层（对比度给足，但尺度极小 ⇒ 不会成形状）
  for (let i = 0; i < 22000; i++) {
    const v = 226 + Math.random() * 28;
    g.fillStyle = `rgba(${v},${v},${v},${0.07 + Math.random() * 0.14})`;
    const s = 1.0 + Math.random() * 1.6;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}, { repeat: [3, 2] }), 0.95);

/* ---------- 混凝土地坪 / 构件贴图 ----------
 * 用在 `M.concrete` 上 —— 它是**全库面积最大的平面之一**：assembly / dcpanel 的
 * 整块地坪（`floorPlane(13.5*1.2)` = 16.2m 见方）、boxsub 的箱变底座、
 * 户外电杆、风机塔脚的基础环。原来只有 `roughnessMap`、**没有颜色贴图** ⇒
 * 出图里那占画面近 40% 的地面是一整片均匀灰，除了伸缩缝什么细节都没有。
 *
 * 设计：与 `texWallPaint` 同一路子 —— 近白底、线性均值**钉死 0.95**，
 * 只增加表面质感、**不改整体明暗**（验收口径见 §AG8：`albedoLin` 前后对齐）。
 *   ① 浇筑 / 收光不均（大尺度柔和）；② 磨损 / 骨料暴露（**主要质感**）；
 *   ③ 深色骨料点（对比最强，唯一扛得住 mipmap 的一层）；④ 细砂（近看细腻）。
 * ⚠️⚠️ **第一版失败了，原因值得记下来**：斑块 alpha 只有 0.04、颗粒只有 0.9~2.6px。
 *    地面是**掠射角**（视线与地面夹角只有十几度）⇒ 纵向被压缩好几倍、
 *    mipmap 级别跳得快 ⇒ **亚像素的细节全被平均掉**。
 *    实测：把 `map` 摘掉再出图逐像素比，72.5% 的像素有差异，
 *    但**分区均值只差 1.3~4%、标准差 0.1367 vs 0.1374（几乎没变）** ——
 *    也就是说贴图「挂上了、在起作用」，但**一点都没看出来**。
 *    ⇒ 正解不是「加更多细节」，而是**把主导对比度挪到能存活的中尺度**。
 * ⚠️ 尺度按**屏幕**定：`floorPlane` 的 UV 是整块板 0..1，`repeat [6,6]` ⇒
 *    512px 贴图覆盖 ~2.7m（16.2m ÷ 6）= **0.53 cm/px**，
 *    于是 6~20px 的骨料斑落到 **3~11cm** ⇒ 屏幕上 4~14px，看得见。
 *    再细就退回第一版的老路（亚像素 ⇒ 被平均）；再粗就变成「花纹」。
 * ⚠️ **不能有可辨认的形状**（第 62 轮墙面第一版就栽在这：大圆斑 + 平铺 = 花纹）。
 *    所以大尺度那层用**大量圆相互叠加 + 低 alpha**，只留「面不匀」。
 * ⚠️ `aniso: 16`（上限）专为掠射角设 —— 地面是全场最典型的掠射面。
 *    默认是 8；three.js 会把超过硬件上限的值自动夹住，低配机安全。
 * ⚠️ 与 `texWallPaint` 分开一张、**不共用**：地坪的斑驳尺度要比乳胶漆大一档，
 *    共用会变成「地板和墙是同一种表面」。
 * ⚠️ `M.concrete` 还被**电杆**（8.6m 圆柱）与**塔脚基础环**（0.9m）用，UV 尺度不同，
 *    贴图会等比缩放 —— 但它们都是混凝土表面，**加质感对每一处都成立**。
 *    这与 `M.pcDark` 那种「图案只对一处对」的情况不同（见 `pvCellMat` 的教训）。
 */
const texConcrete = normalizeTexMean(canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#fdfdfc'; g.fillRect(0, 0, w, h);
  // ① 浇筑 / 收光不均（大尺度、柔和）：相互叠加 ⇒ 只留「面不匀」
  for (let i = 0; i < 110; i++) {
    const up = Math.random() < 0.5;
    const x = Math.random() * w, y = Math.random() * h, r = 40 + Math.random() * 70;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, up ? 'rgba(255,255,255,.09)' : 'rgba(196,199,193,.07)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // ② 磨损 / 骨料暴露 —— **主要质感靠这一层**（6~20px = 3~11cm）
  for (let i = 0; i < 1500; i++) {
    const v = 190 + Math.random() * 55;
    g.fillStyle = `rgba(${v},${v},${v},${0.12 + Math.random() * 0.16})`;
    g.beginPath();
    g.arc(Math.random() * w, Math.random() * h, 6 + Math.random() * 14, 0, Math.PI * 2);
    g.fill();
  }
  // ③ 深色骨料点 —— 唯一能扛住 mipmap 平均的一层（对比最强）
  for (let i = 0; i < 1800; i++) {
    const v = 110 + Math.random() * 60;
    g.fillStyle = `rgba(${v},${v},${v},${0.35 + Math.random() * 0.25})`;
    const s = 1.5 + Math.random() * 2.0;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  // ④ 细砂 —— 只在近处看得见的细腻感
  for (let i = 0; i < 30000; i++) {
    const v = 212 + Math.random() * 43;
    g.fillStyle = `rgba(${v},${v},${v},${0.08 + Math.random() * 0.10})`;
    const s = 0.8 + Math.random() * 1.0;
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}, { repeat: [6, 6], aniso: 16 }), 0.95);

/* ---------- 门缝 / 密封条贴图（细密黑线，用于柜门四周） ---------- */
const texSeam = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#0c0f11'; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.06)';
  for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 1, 1);
}, { repeat: [1, 1] });

/* ---------- 户外地面：碎石 / 草地色斑 ----------
 * 户外特写最怕“一整片纯色地面”，加一层带大块色斑的贴图立刻有场坪感。
 */
function groundTex(base, speck, patchA, patchB) {
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 24000; i++) {
      g.fillStyle = speck[Math.floor(Math.random() * speck.length)];
      const s = 1 + Math.random() * 3.4;
      g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    for (let i = 0; i < 150; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 16 + Math.random() * 74;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, Math.random() < 0.5 ? patchA : patchB);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: [9, 9] });
}
/* ⚠️⚠️ 第 62 轮：底色整体提亮约 33%（sRGB）—— 户外场景「读起来像黄昏」的真因。
 *
 * 现象：把 9 个场景全出一遍图，用色相掩膜量「草地」与「碎石」的像素值：
 *   草地 (52,67,49) p50=0.24 / 碎石 (86,92,96) p50=0.29，
 *   而**室内地坪**是 (150,158,158) p50=0.77。户外日景比室内还暗，明显不对。
 *
 * 归因（**先证伪再改**，不是猜的）：
 *   ① **阴影**？ 关掉 `shadowMap` 重出图 ⇒ 地面几乎不变（0.182→0.180）⇒ 排除。
 *   ② **反照率**？ 运行时把地面材质 `color` 线性 ×1.8 ⇒ 草地 0.225→0.317，
 *      且**白色机箱纹丝不动**（0.835→0.835）⇒ 反照率确实是有效杠杆，且**只影响地面**。
 *      （×2.6 ⇒ 0.394。灵敏度是 sRGB^(1/2.2)：想翻倍得抬 4.6 倍反照率，不现实。）
 *   ③ **光照**？ 想把太阳/半球光在运行时调亮，**改了不生效** ——
 *      `app.js` 每帧都用 `baseIntensity * lightFactor` 把强度写回去，覆盖掉外部改动。
 *      ⇒ 光照是全局旋钮，动它会把室内场景与设备一起带亮，不划算。
 *   ⇒ 选**只动地面贴图**这条最窄的路。
 *
 * 取值：底色与斑点整体 ×1.33（≈ 线性 ×1.9），并把最暗的那层色斑
 *   （`patchA`）**降低不透明度**（草地 .36→.30、碎石 .34→.28）——
 *   它原本是「地面大块暗斑」，正是把均值往下拽的那一层。
 * ⚠️ 这只是**贴图色调**，不涉及任何产品参数；`repeat` 与 UV 缩放一律没动
 *   （改 UV 会牵动 `scaleUV` 与各处几何尺寸，那是另一件事）。
 */
const texGravelG = groundTex(
  '#a6a298',
  ['rgba(200,194,181,.5)', 'rgba(138,134,125,.55)', 'rgba(234,229,215,.4)', 'rgba(104,101,93,.5)'],
  'rgba(77,74,66,.28)', 'rgba(194,189,173,.28)'
);
const texGrassG = groundTex(
  '#7c8d58',
  ['rgba(149,168,98,.5)', 'rgba(93,106,64,.55)', 'rgba(186,197,128,.35)', 'rgba(69,80,51,.5)'],
  'rgba(59,69,43,.30)', 'rgba(157,168,106,.26)'
);

/* ---------- 光伏组件「电池片」贴图 ----------
 * 一张贴图 = **一块组件**（2.278 × 1.134 m，正好 2:1）。铺到组件板上时
 * `repeat` 取「组串列数」⇒ 每列各铺一张，列数变了也不会错位。
 *
 * ⚠️ 尺度按「屏幕上看得见」定，不是按物理真实定：
 *   默认机位下组件约 85 px/m（单块 2.278m ≈ 194 px 宽、96 px 高），
 *   512×256 贴图铺一块 ⇒ 1 贴图像素 ≈ 0.4 屏幕像素 ⇒ 4px 的栅线落到 1.6px，刚好可见。
 *   **真实电池片间隙只有 2mm（≈0.17 屏幕像素），根本画不出来** ——
 *   所以栅线是**刻意夸张**到约 13mm 等效宽度。目的只有一个：
 *   让「这是光伏组件、不是一块黑板」在默认机位下读得出来。
 *
 * ⚠️ 这里**没有**用 `normalizeTexMean` 做归一化 —— 它不是「近白底、均值越低越暗」
 *   那类叠加层，而是一张**有自身色调的图案**（深蓝电池片），归一化会把色调改掉。
 *   底色补偿也不适用：面板原来用的 `M.pcDark`（0x2a2f33）与电池片不是一个颜色，
 *   这是一次**有意的换色**（见 `pvCellMat` 的注释）。
 */
const texPvCell = canvasTex(512, 256, (g, w, h) => {
  const COLS = 6, ROWS = 12;
  g.fillStyle = '#0e1922'; g.fillRect(0, 0, w, h);   // 片间底色（深）
  const cw = w / COLS, ch = h / ROWS;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      /* 逐片微差：真实组件每片效率不同，一片均匀反而假。
         左右两边留 1.6px 不画 ⇒ 贴图左右接缝与内部缝隙同宽，repeat 后看不出接缝。 */
      const v = 0.84 + Math.random() * 0.30;
      g.fillStyle = `rgb(${Math.round(22 * v)},${Math.round(44 * v)},${Math.round(76 * v)})`;
      g.fillRect(c * cw + 1.6, r * ch + 1.6, cw - 3.2, ch - 3.2);
    }
  }
  // 细栅线（每片 4 条竖直，很淡）—— 远看平均成一层雾，近看能分辨
  g.strokeStyle = 'rgba(208,216,224,.15)'; g.lineWidth = 0.7;
  for (let c = 0; c < COLS; c++) {
    for (let k = 1; k <= 4; k++) {
      const x = c * cw + (cw / 5) * k;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
    }
  }
  // 横向汇流带（每片一条，略亮）
  g.fillStyle = 'rgba(196,205,214,.26)';
  for (let r = 0; r < ROWS; r++) g.fillRect(0, r * ch + ch * 0.5 - 1.1, w, 2.2);
});

export const TEX = { perf: texPerf, louver: texLouver, powder: texPowderMap, seam: texSeam, gravel: texGravelG, grass: texGrassG, pvCell: texPvCell };

/* 这些贴图都是模块级单例，被所有场景共用。
   标记 userData.shared 后，场景卸载时不会误释放它们 ——
   否则第二个场景一进来贴图就没了（或者每切一次场景重新生成一遍，白白浪费内存）。 */
for (const t of Object.values(TEX)) if (t && t.userData) t.userData.shared = true;
for (const t of [texRoughSteel, texRoughPlastic, texWallPaint, texConcrete]) if (t && t.userData) t.userData.shared = true;

/* ---------- 工厂 ---------- */
const S = (o) => new THREE.MeshStandardMaterial(o);

/**
 * 按贴图的**实测**线性均值反解底色 —— 让「贴图只加质感、不改明暗」成为**构造保证**。
 *
 * `map` 是在线性域乘在 `color` 上的，所以贴图均值 ≠ 1 就会改变材质明暗；
 * 想保持原亮度，底色必须取 `原色 ÷ 贴图均值`。
 *
 * ⚠️⚠️ **不能按名义 target 反解**：`normalizeTexMean` 里的 `Math.min(1, …)`
 * 会**裁剪**。贴图带深色特征时（如混凝土的骨料点），原始均值远低于 target，
 * 归一化要整体放大 ⇒ 近白像素被裁 ⇒ **target 够不到**。
 * 实测：混凝土 target 0.95、实际 **0.9356**（−1.5%）；
 * 按 0.95 反解 ⇒ 成品暗 **1.9%**（同代码 A/B 逐像素实测）。
 * ⇒ 一律用 `tex.userData.meanLin`（`normalizeTexMean` 写入的实测值）。
 *
 * ⚠️ `new THREE.Color(hex)` 在 ColorManagement 开启时**已经是线性值**，
 *    不要再套一次 sRGB→线性（那是「线性化两次」，会把补偿量整个算反）。
 * ⚠️ `new THREE.Color(r, g, b)` 的三个数字走 working color space，**不做转换** —— 正好。
 *
 * 好处：改贴图（换设计、换分辨率）不用再手算一个十六进制常量；
 * 底色跟着实测均值走，**不会再悄悄漂掉**。
 */
function albedoFrom(hex, tex) {
  const c = new THREE.Color(hex);
  const m = tex && tex.userData && tex.userData.meanLin;
  if (!m || !m.r || !m.g || !m.b) return c;
  return new THREE.Color(c.r / m.r, c.g / m.g, c.b / m.b);
}

function std(color, rough, metal, extra = {}) {
  return S({ color, roughness: rough, metalness: metal, ...extra });
}

/**
 * 粉末喷涂钣金：在标准 PBR 之上再叠一层薄清漆（clearcoat）。
 * 真实开关柜的喷粉表面不是「纯哑光」，而是哑光底色 + 一层极薄的光泽层 ——
 * 少了这一层，大面积柜门在环境光下会读成「塑料板」，这是工业质感最容易露馅的地方。
 * 代价是多一个高光瓣，所以低画质档会在 applyQuality 里把 clearcoat 归零。
 */
function powder(color, rough, metal, extra = {}) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: rough, metalness: metal,
    clearcoat: 0.34, clearcoatRoughness: 0.30, ...extra,
  });
}

export const M = {
  /* 钣金 / 柜体 */
  powderLight: powder(0xb6bbb4, 0.55, 0.10, { map: texPowderMap, roughnessMap: texRoughSteel }),
  powderMid: powder(0x9ea39a, 0.58, 0.10, { map: texPowderMap, roughnessMap: texRoughSteel }),
  powderDark: powder(C.ral7016, 0.50, 0.14, { map: texPowderMap, roughnessMap: texRoughSteel }),
  powderBrand: powder(0x14503a, 0.46, 0.10, { map: texPowderMap }),
  powderWhite: powder(0xd2d7d1, 0.54, 0.08, { map: texPowderMap, roughnessMap: texRoughSteel }),
  /* 门缝 / 密封条 / 深色包边（给大面积钣金“切边”，是工业感的关键） */
  seam: std(0x14181b, 0.62, 0.06, { map: texSeam }),
  gasket: std(0x101315, 0.86, 0.02),
  trimDark: std(0x5c6259, 0.52, 0.18, { map: texPowderMap }),

  /* 金属 */
  steelBrushed: std(C.steel, 0.34, 0.94, { roughnessMap: texRoughSteel }),
  alu: std(C.alu, 0.30, 0.92),
  aluDark: std(0x8b949b, 0.38, 0.88),
  /* 原先还有一个 `chrome`（镜面铬 0xe8ecef）—— 第 28 轮把它从材质表里删掉了：
     全库只剩 `lockKey()` 的锁体在用它，而「一扇门多一种材质」在 batchStatic 下
     等于多 N 扇门 × 2 次提交（主 + 阴影），kyn28 的 9 扇带锁门光这一桶就占 18 次。
     锁体改并进门上的 `steelBrushed` 后 286 → 271 calls，视觉上几乎不可辨。
     确认无引用后再删，别留着「反正不占运行时开销」的死材质 —— 下次有人会照着它新建。 */
  brass: std(C.brass, 0.30, 0.95),
  copper: std(C.copper, 0.34, 0.92),

  /* 塑料 */
  pcDark: std(C.pcDark, 0.48, 0.02, { roughnessMap: texRoughPlastic }),
  pcGray: std(C.pcGray, 0.46, 0.02, { roughnessMap: texRoughPlastic }),
  pcBlack: std(0x171a1d, 0.42, 0.02),
  pcBeige: std(C.pcBeige, 0.50, 0.02),
  pcBlue: std(C.pcBlue, 0.44, 0.03),
  pcGreen: std(C.pcGreen, 0.46, 0.03),
  pcRed: std(0x8e3b36, 0.46, 0.03),
  /* 华用导轨模块示意件的配色（取自说明书插图的配色，非实物取色）
     —— 壳体深色；端子块顶排用亮绿以体现「可插拔端子」；按键浅蓝或浅灰。
     仅为示意模型的视觉区分，不作为实物颜色依据。 */
  relayBody: std(0x1a1d20, 0.46, 0.03, { roughnessMap: texRoughPlastic }),
  relayBodySilver: std(0xa9b0b6, 0.40, 0.30, { roughnessMap: texRoughPlastic }),
  termGreen: std(0x2f8f57, 0.52, 0.02),
  termGreenDark: std(0x1f6b40, 0.54, 0.02),
  btnBlue: std(0x86bcd6, 0.42, 0.03),
  btnGray: std(0xb9bec2, 0.46, 0.03),
  pcClearBlue: new THREE.MeshPhysicalMaterial({
    color: 0x9fd0e8, roughness: 0.28, metalness: 0, transparent: true, opacity: 0.45,
    clearcoat: 0.6, clearcoatRoughness: 0.25, transmission: 0, side: THREE.DoubleSide,
  }),

  /* 玻璃（观察窗） */
  glass: new THREE.MeshPhysicalMaterial({
    color: 0x0d1a1f, roughness: 0.06, metalness: 0.0, transparent: true, opacity: 0.46,
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6, side: THREE.DoubleSide,
  }),
  glassClear: new THREE.MeshPhysicalMaterial({
    color: 0xdfe9ee, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.8, side: THREE.DoubleSide,
  }),

  /* 绝缘件（变压器绕组内层、绝缘筒、垫块） */
  insul: std(C.insul, 0.62, 0.03, { roughnessMap: texRoughPlastic }),

  /* 橡胶 / 电缆 */
  rubber: std(0x14171a, 0.85, 0.0),
  cable: std(0x1c1f22, 0.72, 0.0),

  /* 电路板 */
  pcb: std(0x14503a, 0.62, 0.05),
  pcbDark: std(0x0e3a2a, 0.66, 0.05),

  /* 建筑 / 地面 */
  /* ⚠️ 第 62 轮：加混凝土贴图。原来只有 `roughnessMap`、**没有颜色贴图** ⇒
     assembly / dcpanel 那整块 16.2m 地坪是一色均匀灰（占画面近 40%）。
     底色走 `albedoFrom(原色, 贴图)` 反解 —— **不写死十六进制常量**，
     改贴图（换设计 / 换分辨率）不用重算，也不会悄悄漂掉。
     ⚠️⚠️ 这里连踩两次，都是「反解」这一步：
       ① 反解**不能漏掉 sRGB 逆变换的 1.055x^(1/2.4) − 0.055** ——
          给墙面算时只写了 `x^(1/2.4)`，把 0x81 算成 0x8b，墙面亮了 4%；
       ② **不能按名义 target（0.95）反解** —— 贴图带深色骨料点，归一化要整体放大，
          近白像素被 `Math.min(1, …)` 裁掉 ⇒ 实测均值只有 **0.9356**，
          按 0.95 反解 ⇒ 地面暗 **1.9%**（同代码 A/B 逐像素实测）。
      验收口径：`_dbg_mat.js concrete` 的 `albedoLin` 应回到
      原色线性值 (0.1746, 0.1746, 0.1530) ± 0.5%。 */
  concrete: std(albedoFrom(0x74746d, texConcrete), 0.88, 0.0, { map: texConcrete, roughnessMap: texRoughSteel }),
  concreteDark: std(0x53544f, 0.90, 0.0),
  /* ⚠️ 第 46 轮提亮：0x3d4441 / roughness 0.30 → 0x4e5652 / 0.42。
     低粗糙度是靠**高光**提亮的，而本场景没有环境贴图（`scene.environment` 为空），
     高光无处可反 —— 结果就是「参数很亮、画出来很闷」。抬粗糙度 + 抬底色更实在。 */
  epoxyFloor: std(0x4e5652, 0.42, 0.06, { roughnessMap: texRoughSteel }),
  asphalt: std(0x3b3d3f, 0.90, 0.0),
  /* 注意：贴图色会被材质 color 二次相乘。
     groundTex 生成的地表贴图里已经带了完整颜色，材质 color 必须留白，
     否则底色再乘一遍，碎石地和草地会暗掉一半（看起来像阴影里的黑地）。 */
  gravel: std(0xffffff, 0.95, 0.0, { map: texGravelG }),
  grass: std(0xffffff, 0.96, 0.0, { map: texGrassG }),
  /* ⚠️ 第 62 轮：原来是无贴图的纯色 `std(0x7e847d, …)`，整面墙是一块灰板。
     ⚠️⚠️ 加了 `map` 之后 `color` 会与贴图**在线性域相乘**，所以底色必须按
        `原色线性值 ÷ 贴图线性均值` 反解，否则墙会整体变亮/变暗。
        实测（探针 `_dbg_walltex.js` 读运行时的材质）：
          贴图线性均值 = **0.95**（`normalizeTexMean` 钉死的常数）
          原色线性值   = (0.20864, 0.23074, 0.20508)   ← 0x7e847d
          ⇒ 目标色线性值 = (0.21962, 0.24288, 0.21587)
          ⇒ 目标色 sRGB  = (129, 135, 128) = **0x818780**
        ⚠️ 反解时**不能漏掉 sRGB 逆变换的 `1.055x^(1/2.4) − 0.055`**：第一版只写了
           `x^(1/2.4)`，把 0x81 算成了 0x8b，结果墙面比原来亮 4%（实测 gis）。
        ⚠️ 也不能拿「sRGB 均值再转线性」当贴图均值 —— 着色器乘的是**线性值**，
           要在线性域求平均。
        ⚠️ `THREE.Color` 在 ColorManagement 开启时**存的已经是线性值**，
           读 `color.r` 直接用，不要再套一次 sRGB→线性（探针第一版就错在这，
           量出 0.054 而真值是 0.258，害得补偿量整个算反）。 */
  wall: std(0x818780, 0.90, 0.0, { map: texWallPaint }),
  wallDark: std(0x4b514c, 0.92, 0.0),
  /* 第 46 轮：**吊顶**单独一种材质。
     ⚠️ 原来吊顶直接借 `wallDark`，而吊顶的法线**朝下** —— HemisphereLight
        按法线 y 在 sky / ground 之间插值，朝下的面**整份吃 ground 色**，
        一点 sky 都拿不到。深灰 0x4b514c 再乘上这点辐照度，出图实测
        **画面顶部是一片纯黑**（9x6 网格采样 0.047~0.066，而柜体正面 0.5~0.75）。
     工业厂房吊顶本来就是浅色压型钢板 / 吸音板，换成浅灰既是真实做法，
     也把「顶部一团黑」直接治掉。⚠️ 踢脚线仍然用 wallDark（那条本来就该深）。

     ⚠️⚠️ 第 58 轮：**只换底色不够，得补光**。
        第 46 轮那次只改了 albedo，可吊顶的**辐照度**本身就接近 0 ——
        户内场景的灯全是**朝下的 spot**（`pos.y≈3.1`、`target.y≈1.3`），
        吊顶在灯的正上方，`dot(法线, 光向)` 恒为负，一点直射都拿不到；
        半球光里朝下的面又整份吃 `ground` 色。
        实测（`png_sample.js` 量默认机位出图的顶部带）：
          kyn28 `#11171a`、dcpanel `#13191c` —— 仍是**近纯黑**，
          读起来就是「这个房间没画天花板」。
        ⇒ 补一点点**自发光**，当「吊顶被地面/设备漫反射照亮」的**假反弹光**。
          这是渲染手法（同 contactShadow 的性质），不是编造设备参数。
          数值按出图实测标定：目标让顶部带落在 sRGB ≈ #3a~#44（暗但读得出是天花板）。 */
  ceilPanel: std(0xa9b0aa, 0.94, 0.0, { emissive: 0x39423c }),

  /* 风力发电机组（远景剪影用）。真实机组的塔筒与叶片都是白色 / 浅灰 ——
     但**故意不挂贴图**：它在 300m 开外，看到的是轮廓，
     挂 powderWhite 的粉末涂层贴图只会白白多一次采样。 */
  turbineWhite: std(0xe0e4e3, 0.44, 0.04),

  /* 通风 */
  louver: std(0xa9aeaa, 0.55, 0.35, { map: texLouver, roughnessMap: texRoughSteel }),
  perf: std(0x33383c, 0.55, 0.35, {
    map: texPerf, alphaMap: texPerf, transparent: false, alphaTest: 0.5, side: THREE.DoubleSide,
  }),

  /* 发光 */
  ledRed: new THREE.MeshStandardMaterial({ color: 0x40100e, emissive: 0xff4d3d, emissiveIntensity: 1.5, roughness: 0.3 }),
  ledGreen: new THREE.MeshStandardMaterial({ color: 0x0d3a24, emissive: 0x35e08a, emissiveIntensity: 1.5, roughness: 0.3 }),
  ledAmber: new THREE.MeshStandardMaterial({ color: 0x3a2a0d, emissive: 0xffb648, emissiveIntensity: 1.5, roughness: 0.3 }),
  ledBlue: new THREE.MeshStandardMaterial({ color: 0x0d2a3a, emissive: 0x49b6ff, emissiveIntensity: 1.4, roughness: 0.3 }),
  lampWarm: new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xfff2dd, emissiveIntensity: 2.4, roughness: 1 }),
  lampCool: new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xeaf4ff, emissiveIntensity: 2.6, roughness: 1 }),
  displayOn: new THREE.MeshStandardMaterial({ color: 0x0a0f0c, emissive: 0x36e39b, emissiveIntensity: 0.9, roughness: 0.35 }),
};

/* 材质库里的材质是全局单例，被所有场景共用。
   打上 shared 标记后，场景卸载时就不会误 dispose 它们 ——
   否则每切一次场景，下一场所有着色器都要重编译，低配机上就是一次明显卡顿。 */
for (const k in M) {
  if (M[k] && M[k].isMaterial) M[k].userData.shared = true;
}

/* 记住每个材质的基准清漆强度，画质切档时用来还原 */
for (const k in M) {
  const m = M[k];
  if (m && m.isMeshPhysicalMaterial && m.clearcoat > 0) m.userData.ccBase = m.clearcoat;
}

/**
 * 光伏组件板材质：按「组串列数」缓存（列数不同 ⇒ 贴图重复数不同）。
 *
 * ⚠️ 为什么不直接加进 `M` 表：`M` 里的材质是**与几何无关的单例**，
 *   而这里的贴图重复数取决于调用方传的 `cols`。硬写一个 `repeat: [2,1]`
 *   在 `cols: 4` 的组串上会**静默铺错**（每列变成 2 张、电池片宽一倍），
 *   而且画面看着「还是有个栅格」，很难发现。
 *
 * ⚠️ 为什么用 `clone()` 而不是改共享贴图的 `repeat`：改共享贴图会**串改**别处。
 *   `Texture.clone()` 与原贴图**共享 `source`** ⇒ GPU 上传仍然只有一份，
 *   代价只是一个材质对象 + 一层采样参数。
 *
 * ⚠️ 材质与贴图都标 `userData.shared`：这是模块级缓存、跨场景复用，
 *   绝不能被 `disposeTree` 释放（否则第二个场景进来就要重新上传）。
 */
const _pvCellMats = new Map();
export function pvCellMat(cols) {
  const n = Math.max(1, Math.round(cols) || 1);
  let m = _pvCellMats.get(n);
  if (!m) {
    const t = texPvCell.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;   // ⚠️ repeat>1 必须配 RepeatWrapping，否则右边被拉伸
    t.repeat.set(n, 1);
    t.needsUpdate = true;
    t.userData.shared = true;
    /* 底色用纯白：颜色全部来自贴图（贴图已经是「电池片的颜色」）。
       粗糙度取 0.34 —— 组件是**压花玻璃**，有明确的镜面反射但不至于像镜子；
       原 `M.pcDark`（0.48）读起来是哑光塑料，是「黑板感」的来源之一。 */
    m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0.0, map: t });
    m.userData.shared = true;
    _pvCellMats.set(n, m);
  }
  return m;
}

/** 画质联动：低档关掉清漆层（省一个高光瓣），高中档打开 */
export function setClearcoat(on) {
  for (const k in M) {
    const m = M[k];
    if (!m || !m.isMeshPhysicalMaterial || m.userData.ccBase === undefined) continue;
    const v = on ? m.userData.ccBase : 0;
    if (m.clearcoat !== v) { m.clearcoat = v; m.needsUpdate = true; }
  }
}

/** 克隆材质（产品高亮需要独立材质实例） */
export function cloneMat(m) {
  const c = m.clone();
  if (m.map) c.map = m.map;
  if (m.roughnessMap) c.roughnessMap = m.roughnessMap;
  if (m.alphaMap) c.alphaMap = m.alphaMap;
  c.userData = { ...m.userData };
  delete c.userData.shared;        // 克隆出来的副本是要被单独释放的
  return c;
}

/** 把整棵子树里的材质换成独立副本，并登记到 userData.hlMats 便于高亮
 *
 *  关键：按「原材质」去重共享副本，而不是每个 Mesh 一份。
 *  同一个产品里几十个 Mesh 其实只用得到 5~8 种材质，逐个克隆会让几何批处理完全失效
 *  （材质 uuid 不同 → 合不到一个 draw call 里）。共享副本后，一个产品能从 ~38 个
 *  draw call 压到 ~7 个，而高亮行为完全不变（本来就是整机一起亮）。
 */
export function isolateMaterials(root) {
  const map = new Map();
  const mats = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    const apply = (m) => {
      let c = map.get(m);
      if (!c) {
        c = cloneMat(m);
        c.userData.baseEmissive = c.emissive ? c.emissive.getHex() : 0x000000;
        c.userData.baseEmissiveIntensity = c.emissiveIntensity !== undefined ? c.emissiveIntensity : 1;
        map.set(m, c);
        mats.push(c);
      }
      return c;
    };
    o.material = Array.isArray(o.material) ? o.material.map(apply) : apply(o.material);
  });
  root.userData.hlMats = mats;
  return mats;
}
