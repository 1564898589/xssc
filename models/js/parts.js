/**
 * parts.js —— 可复用工业零件建模库
 * 全部按统一比例（单位：米）建模，保证产品之间、产品与柜体之间的相对比例协调。
 * 尺寸为示意尺寸，不代表真实结构尺寸，不得作为选型或安装依据。
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/RoundedBoxGeometry.js';
import { M } from './mats.js';
import { canvasTex, clamp, C } from './util.js';

const FONT_CJK = '"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
const FONT_MONO = '"SF Mono","Cascadia Code",Consolas,monospace';

/* ============================================================
 * 基础几何
 * ============================================================ */

/** 圆角长方体（工业钣金/塑料件的关键——去掉刀锋边） */
export function rbox(w, h, d, r = 0.004, mat = M.pcGray, seg = 2) {
  const rr = Math.min(r, Math.min(w, h, d) * 0.45);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, rr), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** 平板（薄盒） */
export function plate(w, h, t, mat, r = 0.0015) {
  return rbox(w, h, t, r, mat, 1);
}

/** 圆柱 */
export function cyl(rt, rb, h, mat, seg = 20, open = false) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** 方管/型材 */
export function bar(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function at(o, x, y, z) { o.position.set(x, y, z); return o; }
export function rot(o, x, y, z) { o.rotation.set(x, y, z); return o; }
export function grp(...children) {
  const g = new THREE.Group();
  children.forEach(c => c && g.add(c));
  return g;
}

/* ============================================================
 * 贴图文字
 * ============================================================ */

export function labelTex(main, sub = '', opt = {}) {
  const {
    w = 256, h = 64, bg = '#f2f3ee', fg = '#20262c', subFg = '#5b6670',
    accent = null, align = 'left', mono = false, border = true,
  } = opt;
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (border) { g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2); }
    if (accent) { g.fillStyle = accent; g.fillRect(0, 0, 8, h); }
    g.textBaseline = 'middle';
    const x = align === 'center' ? w / 2 : (accent ? 22 : 14);
    g.textAlign = align === 'center' ? 'center' : 'left';
    g.fillStyle = fg;
    g.font = `700 ${sub ? Math.round(h * 0.42) : Math.round(h * 0.52)}px ${mono ? FONT_MONO : FONT_CJK}`;
    g.fillText(main, x, sub ? h * 0.36 : h * 0.52);
    if (sub) {
      g.fillStyle = subFg;
      g.font = `500 ${Math.round(h * 0.28)}px ${mono ? FONT_MONO : FONT_CJK}`;
      g.fillText(sub, x, h * 0.73);
    }
  });
}

export function screenTex(text, opt = {}) {
  const { w = 256, h = 96, color = '#4dffb0', bg = '#08120d', rows = null, small = false } = opt;
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    // 微弱扫描线
    g.fillStyle = 'rgba(255,255,255,.03)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 14;
    if (rows) {
      const n = rows.length;
      rows.forEach((r, i) => {
        g.fillStyle = color;
        g.font = `700 ${Math.round((h / n) * 0.68)}px ${FONT_MONO}`;
        g.fillText(r, w / 2, (h / n) * (i + 0.5));
      });
    } else {
      g.fillStyle = color;
      g.font = `700 ${Math.round(h * (small ? 0.5 : 0.66))}px ${FONT_MONO}`;
      g.fillText(text, w / 2, h / 2);
    }
  });
}

export function nameplateTex(title, sub = '', opt = {}) {
  const { w = 512, h = 256, bg = '#e9eae4', accent = '#0f5a3a' } = opt;
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = accent; g.fillRect(0, 0, w, 34);
    g.fillStyle = '#fff'; g.font = `800 22px ${FONT_CJK}`; g.textBaseline = 'middle';
    g.fillText('sinouse 华用电气', 18, 18);
    g.fillStyle = '#1d2733'; g.font = `800 44px ${FONT_CJK}`;
    g.fillText(title, 26, h * 0.44);
    g.fillStyle = '#4b5560'; g.font = `600 26px ${FONT_MONO}`;
    g.fillText(sub, 26, h * 0.66);
    g.strokeStyle = 'rgba(0,0,0,.14)'; g.lineWidth = 2;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(26, h * 0.78 + i * 12); g.lineTo(w - 26, h * 0.78 + i * 12); g.stroke(); }
  });
}

/** 拉丝金属贴图（用于不锈钢面板） */
export const texBrushed = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#b9c0c6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4200; i++) {
    const v = 150 + Math.random() * 70;
    g.strokeStyle = `rgba(${v},${v},${v},.35)`;
    g.beginPath();
    const y = Math.random() * h;
    g.moveTo(0, y); g.lineTo(w, y + (Math.random() - 0.5) * 2);
    g.stroke();
  }
}, { repeat: [2, 2] });

/* ============================================================
 * 柜体零件
 * ============================================================ */

/** 铰链 */
export function hinge(mat = M.steelBrushed) {
  const g = new THREE.Group();
  const a = cyl(0.006, 0.006, 0.026, mat, 12); a.rotation.x = Math.PI / 2;
  const b = plate(0.03, 0.012, 0.004, mat);
  b.position.set(0.014, 0, -0.012);
  const c = plate(0.03, 0.012, 0.004, mat);
  c.position.set(0.014, 0, 0.012);
  g.add(a, b, c);
  return g;
}

/** 门把手（内嵌式拉手） */
export function handle(len = 0.14, mat = M.aluDark) {
  const g = new THREE.Group();
  const bar = rbox(len, 0.018, 0.02, 0.005, mat);
  const p1 = cyl(0.008, 0.008, 0.02, mat, 12); p1.rotation.x = Math.PI / 2; p1.position.set(-len / 2 + 0.012, 0, -0.014);
  const p2 = p1.clone(); p2.position.x = len / 2 - 0.012;
  g.add(bar, p1, p2);
  return g;
}

/**
 * 锁芯。
 *
 * ⚠️ 材质刻意只用**两种**，而且都挑门上已经在用的 —— 这是 draw call 的事，不是审美的事：
 *   batchStatic 按「材质桶」合并，**每一扇门都是一个独立作用域**（门要转，不能被合并掉），
 *   所以「这扇门多用一种材质」＝ 整场景多 N 扇门 × 2 次提交（主 pass + 阴影 pass）。
 *   kyn28 有 9 扇带锁的门，原先锁芯独占「镜面铬」（锁体）与「黄铜」（钥匙孔）两种材质，
 *   光这两桶就是 9 × 2 × 2 = 36 次提交 —— 正好是当时 draw call 超预算的全部缺口。
 *   （那两种材质已从 `mats.js` 删除，见那里的说明 —— 全库再无人用。）
 *   改法：
 *     · 锁体 → `M.steelBrushed`（门上本来就有铰链 / 把手用这个桶，直接并进去，净增 0）；
 *     · 钥匙孔 → `M.pcBlack`（本来就有锁芯面板用这个桶；而且真钥匙孔是**黑洞**，
 *       不是一块黄铜片 —— 换成 pcBlack 反而更像）。
 *   视觉上锁体从镜面铬变成拉丝不锈钢，24mm 的件在这个观看距离下几乎不可辨。
 *
 *   ⚠️ 注释里**别出现「M 点材质名」这种字面量** —— `audit_mats.js` 是纯文本扫的，
 *   分不清注释和代码，会把已经删掉的材质名当成「引用了不存在的材质」报出来。
 *   （刚才就自摆乌龙一次：把这条提醒本身写成了那种形式，结果被自己扫出来。）
 */
export function lockKey(mat = M.steelBrushed) {
  const g = new THREE.Group();
  const body = cyl(0.012, 0.012, 0.016, mat, 20); body.rotation.x = Math.PI / 2;
  const face = cyl(0.009, 0.009, 0.004, M.pcBlack, 20); face.rotation.x = Math.PI / 2; face.position.z = 0.009;
  const key = plate(0.003, 0.012, 0.002, M.pcBlack); key.position.set(0, 0, 0.011);
  g.add(body, face, key);
  return g;
}

/** 电缆密封接头（格兰头） */
export function gland(mat = M.brass, r = 0.011) {
  const g = new THREE.Group();
  const a = cyl(r, r * 0.9, 0.02, mat, 14); a.rotation.x = Math.PI / 2;
  const b = cyl(r * 1.25, r * 1.25, 0.008, mat, 14); b.rotation.x = Math.PI / 2; b.position.z = 0.012;
  const c = cyl(r * 0.55, r * 0.55, 0.03, M.rubber, 12); c.rotation.x = Math.PI / 2; c.position.z = 0.024;
  g.add(a, b, c);
  return g;
}

/** 百叶通风窗（户外柜）
 *  —— 关键：叶片用浅色金属，背后垫一层深色底衬，靠几何 + 阴影表现缝隙，
 *     不要给每片叶子贴“整幅百叶纹理”（会被拉伸成一团黑）。
 */
export function louverPanel(w, h, opt = {}) {
  const { cols = 6, rows = 5, mat = M.alu, back = M.seam } = opt;
  const g = new THREE.Group();
  const frame = rbox(w, h, 0.012, 0.003, M.powderMid);
  g.add(frame);
  const b = plate(w - 0.014, h - 0.014, 0.002, back);
  b.position.z = 0.004;
  g.add(b);
  const cw = (w - 0.016) / cols, ch = (h - 0.016) / rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const s = plate(cw * 0.88, ch * 0.80, 0.0035, mat);
      s.position.set(-w / 2 + 0.008 + cw * (i + 0.5), -h / 2 + 0.008 + ch * (j + 0.5), 0.009);
      s.rotation.x = -0.45;
      g.add(s);
    }
  return g;
}

/** DIN 导轨 35mm */
export function dinRail(len, mat = M.aluDark) {
  const g = new THREE.Group();
  const base = bar(len, 0.0075, 0.001, mat); base.position.z = -0.0045;
  const web = bar(len, 0.019, 0.0012, mat);
  const lipTop = bar(len, 0.0065, 0.0055, mat); lipTop.position.set(0, 0.0075, 0.002);
  const lipBot = lipTop.clone(); lipBot.position.y = -0.0075;
  g.add(base, web, lipTop, lipBot);
  return g;
}

/** 线槽（灰色走线槽） */
export function wireDuct(len, w = 0.05, h = 0.06, mat = M.pcGray) {
  const g = new THREE.Group();
  const u = rbox(len, h, w, 0.002, mat);
  g.add(u);
  const teeth = Math.max(4, Math.round(len / 0.025));
  for (let i = 0; i < teeth; i++) {
    const t = plate(len / teeth * 0.72, 0.004, w * 0.92, mat);
    t.position.set(-len / 2 + (len / teeth) * (i + 0.5), h / 2 + 0.001, 0);
    g.add(t);
  }
  return g;
}

/** 端子排 */
export function terminalRow(count, opt = {}) {
  const { w = 0.0072, h = 0.052, d = 0.05, mat = M.pcGray, screw = M.steelBrushed, perLabel = 4 } = opt;
  const g = new THREE.Group();
  const total = count * w;
  const body = rbox(total, h, d, 0.0012, mat);
  g.add(body);
  const rail = bar(total, 0.004, 0.004, M.aluDark); rail.position.set(0, 0, -d / 2 - 0.001);
  g.add(rail);
  const sgeo = new THREE.CylinderGeometry(0.0026, 0.0026, 0.0025, 10);
  const inst = new THREE.InstancedMesh(sgeo, screw, count * 2);
  const mtx = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < count; i++) {
    for (const dy of [h * 0.26, -h * 0.26]) {
      mtx.makeRotationX(Math.PI / 2);
      mtx.setPosition(-total / 2 + w * (i + 0.5), dy, d / 2 - 0.004);
      inst.setMatrixAt(k++, mtx);
    }
  }
  inst.castShadow = true;
  g.add(inst);
  /* 端子号：**整排合成一条贴图**（第 38 轮削 draw call）。
     ⚠️ 原来每 perLabel 个端子就 `new` 一张 64×32 贴图 + 一个**新材质** →
     一块端子排就是 2~4 个 draw call，一个场景几十块端子排白多出几十 call。
     现在整排一条 mesh，材质走 cachedMat（同规格端子排共享，贴图也只生成一次）。
     ⚠️ 号码仍是「每 perLabel 个标一个」（与原实现一致），不是逐个标。 */
  {
    const n = Math.ceil(count / perLabel);
    const lb = new THREE.Mesh(
      new THREE.PlaneGeometry(n * w * perLabel * 0.9, 0.008),
      cachedMat(`termnum:${count}:${perLabel}`, () => {
        const cw = 64, ch = 32;
        const t = canvasTex(cw * n, ch, (gg) => {
          gg.fillStyle = '#f0f0ea'; gg.fillRect(0, 0, cw * n, ch);
          gg.fillStyle = '#22262a'; gg.font = `700 20px ${FONT_MONO}`;
          gg.textAlign = 'center'; gg.textBaseline = 'middle';
          for (let k = 0; k < n; k++) gg.fillText(String(k * perLabel + 1), cw * (k + 0.5), 17);
        });
        return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
      }));
    lb.position.set(0, h / 2 + 0.005, d / 2 - 0.006);
    g.add(lb);
  }
  return g;
}

/* ============================================================
 * 华用导轨模块外壳（继电器 / 变送器 / 控制器 / 电源 —— 示意模型主力）
 *
 * ⚠️ 定位：这是**结构示意件**，不是实物级还原。
 * 只表达手册插图里能看到的东西：外形轮廓、分面关系、配色，
 * 以及按键 / 端子 / 指示灯 / 面板的**位置与数量关系**。
 * 不推断内部结构、不补写技术参数、不声称与实物一致。
 *
 * 示意依据：C:\Users\syy\Desktop\华用\产品资料 各产品说明书插图
 * （RN-DK-C / THC-P / TS-I-S / RML / TE-A 的插图画得最清楚）与 RMY-T 说明书的结构示意图。
 *
 * 表达的部件关系：
 *   ① 侧面轮廓——背面垂直（贴 DIN 导轨）、背部一段平顶、一个约 45° 的大斜面、
 *      斜面前缘一道窄台阶、矮前立面、平底；
 *   ② 数码管 / 指示灯 / 按键集中在**斜面**上，正视时仰面朝上；
 *   ③ 接线端子集中在前立面的**端子块**上，块体向前凸出，顶排印编号；
 *   ④ 壳体深色，右侧脸印型号与厂名，背面下方是导轨卡脚。
 * 资料不足的部位（内部结构、散热细节）一律用简化几何体，不做臆造。
 *
 * 性能：整机约 9 个 Mesh。斜面丝印 + 数码管 + 指示灯 + 端子号合并成**一张**贴图；
 * 端子排贴图按位数缓存复用，材质打 userData.shared，这样 batchStatic 能把
 * 多台产品的端子块合并成 1 个 draw call。
 * ============================================================ */

/** 贴图 / 材质缓存。⚠️ 缓存出来的材质与贴图必须打 userData.shared，
 *  否则 disposeTree 会在切换场景时误释放，导致下一场景重新编译、贴图丢失。 */
const _sharedMat = new Map();
function cachedMat(key, make) {
  let m = _sharedMat.get(key);
  if (!m) {
    m = make();
    m.name = key;   // 便于性能剖析脚本（dc_breakdown）识别材质来源
    m.userData.shared = true;
    if (m.map) m.map.userData.shared = true;
    if (m.emissiveMap) m.emissiveMap.userData.shared = true;
    _sharedMat.set(key, m);
  }
  return m;
}

/** 按需缩小字号直到塞得进 maxW（窄模块上很重要，否则型号丝印会溢出） */
function fitSize(g, s, maxW, size, mono, weight) {
  let sz = size;
  for (let i = 0; i < 10; i++) {
    g.font = `${weight} ${sz}px ${mono ? FONT_MONO : FONT_CJK}`;
    if (g.measureText(s).width <= maxW || sz <= 7) break;
    sz *= 0.87;
  }
  return sz;
}

/* 七段码字模：a 顶 / b 右上 / c 右下 / d 底 / e 左下 / f 左上 / g 中 */
const SEG7 = {
  '0': [1, 1, 1, 1, 1, 1, 0], '1': [0, 1, 1, 0, 0, 0, 0], '2': [1, 1, 0, 1, 1, 0, 1],
  '3': [1, 1, 1, 1, 0, 0, 1], '4': [0, 1, 1, 0, 0, 1, 1], '5': [1, 0, 1, 1, 0, 1, 1],
  '6': [1, 0, 1, 1, 1, 1, 1], '7': [1, 1, 1, 0, 0, 0, 0], '8': [1, 1, 1, 1, 1, 1, 1],
  '9': [1, 1, 1, 1, 0, 1, 1], '-': [0, 0, 0, 0, 0, 0, 1], '_': [0, 0, 0, 1, 0, 0, 0],
  'A': [1, 1, 1, 0, 1, 1, 1], 'C': [1, 0, 0, 1, 1, 1, 0], 'E': [1, 0, 0, 1, 1, 1, 1],
  'F': [1, 0, 0, 0, 1, 1, 1], 'H': [0, 1, 1, 0, 1, 1, 1], 'L': [0, 0, 0, 1, 1, 1, 0],
  'P': [1, 1, 0, 0, 1, 1, 1], 'U': [0, 1, 1, 1, 1, 1, 0], ' ': [0, 0, 0, 0, 0, 0, 0],
};

/** 用真七段码画一段数字（比用字体像真数码管得多），右对齐到 rightX，垂直居中 cy */
function segNumber(g, text, rightX, cy, dh, color) {
  const s = String(text);
  const dw = dh * 0.56, gap = dw * 0.26, T = Math.max(2, dh * 0.155);
  let x = rightX;
  g.save();
  g.shadowColor = color; g.shadowBlur = dh * 0.42;
  g.fillStyle = color;
  for (let i = s.length - 1; i >= 0; i--) {
    const ch = s[i];
    if (ch === '.') {
      g.fillRect(x - T * 1.5, cy + dh / 2 - T, T * 1.4, T * 1.4);
      x -= T * 2.3;
      continue;
    }
    x -= dw;
    const seg = SEG7[ch] || SEG7[' '];
    const X = x, Y = cy - dh / 2, W = dw, H = dh;
    const xL = X + T * 0.85, xR = X + W - T * 0.85, mw = xR - xL;
    const vT = T * 0.68, vH = H / 2 - T * 1.05;
    if (seg[0]) g.fillRect(xL, Y, mw, T);
    if (seg[1]) g.fillRect(X + W - T, Y + vT, T, vH);
    if (seg[2]) g.fillRect(X + W - T, Y + H / 2 + T * 0.35, T, vH);
    if (seg[3]) g.fillRect(xL, Y + H - T, mw, T);
    if (seg[4]) g.fillRect(X, Y + H / 2 + T * 0.35, T, vH);
    if (seg[5]) g.fillRect(X, Y + vT, T, vH);
    if (seg[6]) g.fillRect(xL, Y + H / 2 - T / 2, mw, T);
    x -= gap;
  }
  g.restore();
}

/**
 * 侧视楔形外壳的挤出体。局部原点在包围盒中心，+Z 朝前（前立面在 +Z 侧）。
 * @returns {THREE.Mesh} userData.slope = { zS0, zS1, yF, zB, zF }，供斜面定位用
 */
export function wedgeShell({ w, h, d, hFront, dLedge, dTop, mat }) {
  const zB = -d / 2, zF = d / 2;
  const zS1 = zF - dLedge;      // 斜面前缘（斜面下端）
  const zS0 = zB + dTop;        // 背部平顶前沿（斜面上端）
  const yF = -h / 2 + hFront;   // 前立面顶

  const s = new THREE.Shape();
  s.moveTo(zB, -h / 2);
  s.lineTo(zF, -h / 2);
  s.lineTo(zF, yF);
  s.lineTo(zS1, yF);
  s.lineTo(zS0, h / 2);
  s.lineTo(zB, h / 2);
  s.closePath();

  const BEV = Math.min(0.0014, w * 0.03);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.002, w - BEV * 2),
    bevelEnabled: true,
    bevelThickness: BEV, bevelSize: BEV, bevelSegments: 1, curveSegments: 1,
  });
  geo.rotateY(-Math.PI / 2);     // 形状平面落到世界 ZY，挤出方向成为世界 X
  geo.translate(w / 2, 0, 0);    // 摆正：X 居中

  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.slope = { zS0, zS1, yF, zB, zF };
  return m;
}

/**
 * 斜面显示板的整张丝印贴图。
 * 版面分区（按贴图高度归一化，canvas 顶 = 斜面顶端）：
 *   0.03–0.13 指示灯行（带丝印标签）   0.16–0.56 数码管（左）/ 光柱（右）
 *   0.60–0.68 端子功能丝印             0.72–0.98 左半：型号/MFG/厂名/网址
 *                                              右半：留给按键几何（贴图留空）
 */
function relayPanelTex(p, W, H, compact) {
  const put = (g, s, x, y, size, color, align, weight, mono, maxW) => {
    const lim = (maxW == null ? W * 0.97 : maxW) - x;
    const sz = fitSize(g, s, lim, size, mono, weight || 600);
    g.fillStyle = color;
    g.font = `${weight || 600} ${sz}px ${mono ? FONT_MONO : FONT_CJK}`;
    g.textAlign = align || 'left'; g.textBaseline = 'middle';
    g.fillText(s, x, y);
  };
  return canvasTex(W, H, (g) => {
    /* 哑光黑底 + 斜向淡高光，模拟注塑件表面 */
    const bg = g.createLinearGradient(0, 0, W * 0.30, H);
    bg.addColorStop(0, '#24292f');
    bg.addColorStop(0.45, '#171b1f');
    bg.addColorStop(1, '#0b0e11');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    /* 面板外框细线 */
    g.strokeStyle = 'rgba(198,212,226,.09)';
    g.lineWidth = Math.max(2, W * 0.003);
    g.strokeRect(W * 0.015, H * 0.02, W * 0.97, H * 0.96);

    /* ---- 指示灯行：圆点 + 丝印标签 ---- */
    const leds = p.leds || [];
    if (leds.length) {
      const n = leds.length;
      const x0 = W * 0.075, x1 = W * (compact ? 0.92 : 0.70);
      const y = H * 0.085, r = Math.min(H * 0.019, W * 0.032);
      leds.forEach((L, i) => {
        const x = n > 1 ? x0 + (x1 - x0) * (i / (n - 1)) : (x0 + x1) / 2;
        g.save();
        g.shadowColor = L.c; g.shadowBlur = r * 2.6;
        g.fillStyle = L.c;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
        if (L.l) {
          g.fillStyle = 'rgba(206,218,230,.62)';
          const ls = Math.min(Math.round(H * 0.032), Math.round(W / Math.max(6, n) * 0.34));
          g.font = `600 ${ls}px ${FONT_CJK}`;
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(L.l, x, y - r - ls * 0.85);
        }
      });
    }

    /* ---- 数码管两排（华用惯例：上排红、下排绿；也有单排/双排同色） ---- */
    const rows = p.rows || [];
    const avail = W * (compact ? 0.86 : 0.62);
    rows.forEach((r, i) => {
      const y = H * (rows.length > 1 ? (0.245 + i * 0.185) : 0.32);
      const dh = H * (rows.length > 1 ? 0.145 : 0.20);
      if (r.tag) put(g, r.tag, W * 0.045, y, dh * 0.44, 'rgba(200,214,226,.66)', 'left', 600);
      segNumber(g, r.text, W * 0.045 + avail, y, dh, r.color);
      if (r.unit) put(g, r.unit, W * 0.045 + avail + W * 0.022, y + dh * 0.20,
        dh * 0.40, 'rgba(200,214,226,.58)', 'left', 600, true);
    });

    /* ---- 模拟量光柱 ---- */
    if (p.bar) {
      const bx = W * 0.885, by = H * 0.19, bh = H * 0.34, seg = 6, on = p.barOn == null ? 4 : p.barOn;
      for (let i = 0; i < seg; i++) {
        const live = i < on;
        g.save();
        if (live) { g.shadowColor = p.bar; g.shadowBlur = H * 0.02; }
        g.fillStyle = live ? p.bar : 'rgba(70,92,80,.28)';
        g.fillRect(bx, by + (bh / seg) * i, W * 0.028, (bh / seg) * 0.72);
        g.restore();
      }
    }

    /* ---- 端子功能丝印（L¹N¹ / 24VDC / 220VC 之类） ---- */
    if (p.termNote) {
      const parts = p.termNote.split('|');
      const bw = W * 0.90 / parts.length;
      parts.forEach((s, i) => {
        const sz = fitSize(g, s.trim(), bw * 0.88, H * 0.040, true, 700);
        g.fillStyle = 'rgba(206,218,230,.78)';
        g.font = `700 ${sz}px ${FONT_MONO}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(s.trim(), W * 0.05 + bw * (i + 0.5), H * 0.638);
      });
    }

    /* ---- 左下：型号 / MFG 批号 / 厂名 / 网址（按键在右下，贴图留空） ----
     * 窄模块（TS / SS，宽度不到 20mm）版面完全不同：正文只留型号，
     * 下半屏让给 2×2 按键，否则文字会被缩到看不清、按键还会压字。
     * 有按键时左下正文只能用到 46% 宽度，否则会被按键几何压住。 */
    const bx = W * 0.045;
    const limX = W * (compact ? 0.96 : (p.buttons ? 0.46 : 0.92));
    if (compact) {
      if (p.title) put(g, p.title, bx, H * 0.605, H * 0.062, 'rgba(236,243,249,.92)', 'left', 700, false, limX);
    } else {
      if (p.title) put(g, p.title, bx, H * 0.905, H * 0.072, 'rgba(236,243,249,.92)', 'left', 700, false, limX);
      if (p.sub) put(g, p.sub, bx, H * 0.805, H * 0.036, 'rgba(190,202,214,.60)', 'left', 600, true, limX);
      if (p.note) put(g, p.note, bx, H * 0.742, H * 0.036, 'rgba(190,202,214,.60)', 'left', 600, false, limX);
      if (p.note2) put(g, p.note2, bx, H * 0.962, H * 0.032, 'rgba(168,182,194,.50)', 'left', 600, true, limX);
      if (p.brandLine) {
        g.fillStyle = 'rgba(150,164,178,.40)';
        g.font = `600 ${Math.round(H * 0.026)}px ${FONT_MONO}`;
        g.textAlign = 'right'; g.textBaseline = 'middle';
        g.fillText(p.brandLine, W * 0.955, H * 0.968);
      }
    }
    /* 沿斜面上缘的端子号，手册插图里印在这个位置 */
    if (p.termNums) {
      const nums = p.termNums.split('|');
      const step = W * 0.88 / nums.length;
      g.fillStyle = 'rgba(196,210,224,.50)';
      g.font = `600 ${Math.max(10, Math.round(H * 0.028))}px ${FONT_MONO}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      nums.forEach((s, i) => g.fillText(s.trim(), W * 0.06 + step * (i + 0.5), H * 0.016));
    }
  });
}

/** 端子块顶排：亮绿底 + 白色编号（按位数缓存，多台产品共用） */
function termTopMat(n) {
  return cachedMat(`tt${n}`, () => new THREE.MeshStandardMaterial({
    map: canvasTex(1024, 128, (g) => {
      g.fillStyle = '#2f8f57'; g.fillRect(0, 0, 1024, 128);
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, 0, 1024, 14);
      g.fillStyle = 'rgba(0,0,0,.30)'; g.fillRect(0, 126, 1024, 2);
      const cw = 1024 / n;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        g.fillStyle = 'rgba(0,0,0,.26)'; g.fillRect(cw * i, 0, 2, 128);
        g.fillStyle = 'rgba(244,250,246,.95)';
        g.font = `700 ${Math.round(Math.min(cw * 0.52, 62))}px ${FONT_MONO}`;
        g.fillText(String(i + 1), cw * (i + 0.5), 76);
      }
    }),
    roughness: 0.50, metalness: 0.03,
  }));
}

/** 端子块前脸：两排导线孔（按位数缓存） */
function termHoleMat(n) {
  return cachedMat(`th${n}`, () => new THREE.MeshStandardMaterial({
    map: canvasTex(1024, 256, (g) => {
      g.fillStyle = '#1b1f22'; g.fillRect(0, 0, 1024, 256);
      const cw = 1024 / n;
      for (let i = 0; i < n; i++) {
        g.fillStyle = 'rgba(255,255,255,.045)'; g.fillRect(cw * i, 0, 1, 256);
        for (const cy of [72, 188]) {
          const r = Math.min(cw * 0.29, 30);
          g.fillStyle = '#05070a';
          g.beginPath(); g.arc(cw * (i + 0.5), cy, r, 0, Math.PI * 2); g.fill();
          g.strokeStyle = 'rgba(158,178,168,.30)'; g.lineWidth = 2.5;
          g.beginPath(); g.arc(cw * (i + 0.5), cy, r, 0, Math.PI * 2); g.stroke();
        }
      }
    }),
    roughness: 0.55, metalness: 0.05,
  }));
}

/**
 * 华用楔形导轨模块 —— 产品模型主入口。
 * @param {object} o
 * @param {number} o.w/o.h/o.d        外形尺寸（米），默认 45×90×75
 * @param {THREE.Material} o.bodyMat  壳体材质（默认黑色 PC+ABS；RMY-T / TE-A 用 relayBodySilver）
 * @param {object} o.panel            斜面显示板内容，见 relayPanelTex
 * @param {number} o.termCount        前立面端子块位数（默认按宽度推算）
 * @param {string} o.side/o.sideSub   右侧脸丝印（型号 / 产品类别）
 * @param {boolean} o.clearCover      带罩继电器：只加一圈边框示意「有罩」，
 *                                    不铺透明盖板 —— 否则会挡住型号，影响识别
 */
export function wedgeModule(o = {}) {
  const {
    w = 0.045, h = 0.090, d = 0.075,
    bodyMat = M.relayBody,
    hFront = h * 0.35,
    dLedge = d * 0.085,
    dTop = d * 0.20,
    panel = {},
    termCount = null,
    side = '', sideSub = '',
    clearCover = false,
    brand = true,
  } = o;

  const g = new THREE.Group();
  const shell = wedgeShell({ w, h, d, hFront, dLedge, dTop, mat: bodyMat });
  const { zS0, zS1, yF, zF } = shell.userData.slope;
  g.add(shell);

  /* ---------- 斜面显示板 ---------- */
  const dz = zS0 - zS1, dy = h / 2 - yF;
  const L = Math.hypot(dz, dy);
  const alpha = Math.atan2(dz, dy);       // 绕 X 转角：让板面法线对准斜面外法线
  const nz = dy / L, ny = -dz / L;        // 斜面外法线（朝上、朝前）
  const cy = (yF + h / 2) / 2, cz = (zS0 + zS1) / 2;
  const pw = w * 0.93, ph = L * 0.88;
  const compact = pw < 0.042;             // 窄模块（TS / THS / TG / SS）

  const pg = new THREE.Group();
  pg.position.set(0, cy + ny * 0.0013, cz + nz * 0.0013);
  pg.rotation.x = alpha;
  g.add(pg);

  /* 贴图按「像素接近正方」选取尺寸，避免窄模块被拉伸 */
  let TW, TH;
  if (pw >= ph) { TW = 1024; TH = clamp(Math.round(1024 * ph / pw), 256, 1024); }
  else { TH = 1024; TW = clamp(Math.round(1024 * pw / ph), 176, 1024); }
  const tex = relayPanelTex(panel, TW, TH, compact);
  const faceMat = cachedMat(`pf${TW}x${TH}|${JSON.stringify(panel)}`,
    () => new THREE.MeshStandardMaterial({
      map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.42,
      roughness: 0.44, metalness: 0.04,
    }));
  const face = plate(pw, ph, 0.0028, faceMat, 0.0014);
  pg.add(face);

  /* 面板按键：浅蓝 / 浅灰圆钮 */
  const nb = panel.buttons || 0;
  if (nb > 0) {
    const bmat = panel.btnColor === 'gray' ? M.btnGray : M.btnBlue;
    const cols = compact ? 2 : nb;
    const rowsN = compact ? Math.ceil(nb / 2) : 1;
    const bR = compact ? Math.min(pw * 0.15, 0.0028) : Math.min(pw * 0.055, 0.0034);
    for (let i = 0; i < nb; i++) {
      const ci = i % cols, ri = Math.floor(i / cols);
      const b = cyl(bR, bR, bR * 1.15, bmat, 14);
      b.rotation.x = Math.PI / 2;
      const bx = compact
        ? (cols > 1 ? -pw * 0.22 + pw * 0.44 * (ci / (cols - 1)) : 0)
        : -pw * 0.10 + pw * 0.40 * (cols > 1 ? ci / (cols - 1) : 0.5);
      const byy = compact
        ? -ph * 0.22 + ph * 0.20 * ri
        : -ph * 0.40;
      b.position.set(bx, byy, 0.0026);
      pg.add(b);
    }
  }

  /* ---------- 前立面：双排可插拔端子块 ---------- */
  const n = termCount || Math.max(3, Math.round(w / 0.0056));
  const tbH = Math.min(hFront * 0.66, 0.024);
  const tbD = Math.min(d * 0.115, 0.0085);
  const tbW = w * 0.94;
  const tbY = -h / 2 + hFront * 0.52;
  const tb = rbox(tbW, tbH, tbD, 0.0011, M.pcDark, 1);
  tb.position.set(0, tbY, zF + tbD / 2 - 0.0025);
  g.add(tb);

  const topStrip = plate(tbW * 0.985, tbD * 0.80, 0.0012, termTopMat(n), 0.0006);
  topStrip.rotation.x = -Math.PI / 2;
  topStrip.position.set(0, tbY + tbH / 2 + 0.0006, zF + tbD / 2 - 0.0025);
  g.add(topStrip);

  const holeFace = plate(tbW * 0.985, tbH * 0.86, 0.0012, termHoleMat(n), 0.0006);
  holeFace.position.set(0, tbY, zF + tbD - 0.0024);
  g.add(holeFace);

  /* 端子块底部一道亮绿细边（手册插图里很显眼，用来示意「可插拔端子」） */
  const glowEdge = bar(tbW * 0.99, 0.0011, tbD * 0.92, M.termGreenDark);
  glowEdge.position.set(0, tbY - tbH / 2 + 0.0009, zF + tbD / 2 - 0.0025);
  g.add(glowEdge);

  /* ---------- 右侧脸丝印：型号 / 类别 / 厂名 / 网址 ---------- */
  if (side) {
    const sw = Math.min(d * 0.80, 0.062);
    const st = canvasTex(512, 320, (gg) => {
      gg.clearRect(0, 0, 512, 320);
      gg.textAlign = 'left'; gg.textBaseline = 'middle';
      const lines = [
        [side, 54, 'rgba(232,240,246,.90)', FONT_CJK, 700],
        [sideSub, 34, 'rgba(186,198,210,.66)', FONT_MONO, 600],
        ['南京华用电气有限公司', 32, 'rgba(170,184,198,.58)', FONT_CJK, 600],
        ['www.sinouse.com', 30, 'rgba(158,172,186,.50)', FONT_MONO, 600],
      ];
      lines.forEach(([s, sz, col, fnt, wt], i) => {
        const y = 56 + i * 62;
        gg.fillStyle = col;
        gg.font = `${wt} ${sz}px ${fnt}`;
        gg.fillText(s, 20, y);
      });
    });
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 320 / 512),
      new THREE.MeshStandardMaterial({ map: st, transparent: true, roughness: 0.55 }));
    sm.rotation.y = Math.PI / 2;
    sm.position.set(w / 2 + 0.0006, -h * 0.06, d * 0.06);
    g.add(sm);
  }

  /* ---------- 带罩继电器（RC / RL-TBJ）----------
   * 只加一圈浅色边框示意「面板外面还有一层罩」，不铺透明盖板：
   * 铺了会在低端 GPU 上把斜面面板糊成一片灰，型号就认不出来了。 */
  if (clearCover) {
    const rimT = 0.0022, rimD = 0.0022;
    for (const [ex, ey, ew, eh] of [
      [0, ph / 2, pw * 1.03, rimT], [0, -ph / 2, pw * 1.03, rimT],
      [-pw / 2, 0, rimT, ph * 1.03], [pw / 2, 0, rimT, ph * 1.03],
    ]) {
      const e = plate(ew, eh, rimD, M.pcClearBlue, 0.0006);
      e.position.set(ex, ey, 0.0022);
      pg.add(e);
    }
  }

  /* ---------- 导轨卡脚（背面，两条钢片） ---------- */
  const clip = bar(w * 0.42, 0.009, 0.0022, M.steelBrushed);
  clip.position.set(0, -h * 0.12, -d / 2 - 0.0011);
  g.add(clip);
  const clip2 = bar(w * 0.42, 0.009, 0.0022, M.steelBrushed);
  clip2.position.set(0, -h * 0.12 + 0.013, -d / 2 - 0.0011);
  g.add(clip2);

  /* ---------- 正面小品牌丝印 ---------- */
  if (brand) {
    const bt = canvasTex(192, 40, (gg) => {
      gg.clearRect(0, 0, 192, 40);
      gg.fillStyle = 'rgba(255,255,255,.42)';
      gg.font = `700 24px ${FONT_MONO}`;
      gg.textAlign = 'right'; gg.textBaseline = 'middle';
      gg.fillText('sinouse', 186, 21);
    });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(0.019, 0.004),
      cachedMat('brandm', () => new THREE.MeshStandardMaterial({
        map: bt, transparent: true, roughness: 0.6,
      })));
    bm.position.set(0, -h / 2 + 0.0035, zF + 0.0008);
    g.add(bm);
  }

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 兼容旧调用：把上一版「平板方盒」的参数翻译成 wedgeModule 的参数。
 * 新代码请直接用 wedgeModule()。
 */
export function dinModule(o = {}) {
  const {
    w = 0.045, h = 0.09, d = 0.08,
    bodyMat = null,
    leds = [], display = null, knobs = 0,
    terminals = { top: 4, bottom: 4 },
    label = '', labelSub = '',
    clearCover = false, brand = true,
  } = o;

  const ledDefs = leds.map((L) => ({
    c: L.color === 'red' ? '#ff4d3d' : L.color === 'amber' ? '#ffb648'
      : L.color === 'blue' ? '#49b6ff' : '#35e08a',
    l: L.label || '',
  }));
  const rows = [];
  if (display) {
    const src = display.rows || [display.text || '0'];
    const cols = display.colors || ['#ff4d3d', '#35e08a'];
    src.forEach((t, i) => rows.push({ text: String(t), color: cols[Math.min(i, cols.length - 1)] }));
  }
  return wedgeModule({
    w, h, d,
    bodyMat: bodyMat || M.relayBody,
    panel: {
      title: label, sub: labelSub,
      rows, leds: ledDefs,
      buttons: knobs,
      bar: rows.length ? '#35e08a' : null,
      brandLine: 'NANJING SINOUSE ELECTRIC CO., LTD',
    },
    termCount: terminals.bottom || terminals.top || 4,
    side: label, sideSub: labelSub,
    clearCover, brand,
  });
}

/* ============================================================
 * 柜体 / 房间
 * ============================================================ */

/** 型材柜体骨架 + 侧后顶底板（不含前门，便于开门展示） */
export function cabinetShell(o = {}) {
  const {
    w = 0.8, h = 2.3, d = 1.5,
    frameMat = M.powderLight,
    panelMat = M.powderLight,
    topCap = true,
    backPanel = true,
    sidePanel = true,
    bottomPanel = true,
    plinth = 0.02,
    midBrace = 'both',      // 'both' | 'back' | 'none'
  } = o;
  const g = new THREE.Group();
  const t = 0.022;                 // 型材宽
  const pt = 0.006;                // 板厚

  // 四立柱
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = bar(t, h, t, frameMat);
    c.position.set(sx * (w / 2 - t / 2), h / 2, sz * (d / 2 - t / 2));
    g.add(c);
  }
  // 顶/底框
  for (const y of [h - t / 2, t / 2]) {
    const fb = bar(w - t * 2, t, t, frameMat); fb.position.set(0, y, d / 2 - t / 2); g.add(fb);
    const bb = fb.clone(); bb.position.z = -(d / 2 - t / 2); g.add(bb);
    const lb = bar(t, t, d - t * 2, frameMat); lb.position.set(-(w / 2 - t / 2), y, 0); g.add(lb);
    const rb = lb.clone(); rb.position.x = w / 2 - t / 2; g.add(rb);
  }
  /* 中间横撑
   * ⚠️ `midBrace: 'back'` 只留背面那根。
   * 前侧那根在 z = +d/2 附近，如果柜内安装板离前框太近，深度大的产品
   * （如 FA 报警器 110mm 深）会直接**插穿**这根横撑 —— dcpanel 实测插进 15.4mm。
   * 真实直流屏前侧本来就是门洞，不放横撑，所以去掉它既对又好看。
   * 默认 'both' 保持其它场景外观不变。 */
  if (midBrace !== 'none') {
    for (const y of [h * 0.30, h * 0.62]) {
      if (midBrace === 'both') {
        const fb = bar(w - t * 2, t * 0.7, t * 0.7, frameMat);
        fb.position.set(0, y, d / 2 - t / 2); g.add(fb);
      }
      const bb = bar(w - t * 2, t * 0.7, t * 0.7, frameMat);
      bb.position.set(0, y, -(d / 2 - t / 2)); g.add(bb);
    }
  }

  /* 四角包条：让柜体读出“型材拼装”的立体感，而不是一个平板盒子 */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = rbox(t * 1.28, h - t * 2, t * 1.28, 0.003, M.trimDark, 1);
    c.position.set(sx * (w / 2 - t / 2), h / 2, sz * (d / 2 - t / 2));
    g.add(c);
  }

  if (sidePanel) {
    for (const sx of [-1, 1]) {
      // 注意：先按「深 × 高」做板，再绕 Y 旋转 90°，才能得到正确的侧板朝向
      const p = plate(d - t * 2, h - t * 2, pt, panelMat);
      p.position.set(sx * (w / 2 - pt / 2 - 0.0005), h / 2, 0);
      p.rotation.y = Math.PI / 2;
      g.add(p);
      // 侧板下部的通风百叶（工业柜体的常见做法）
      const v = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.09), M.perf);
      v.position.set(sx * (w / 2 + 0.0012), h * 0.075, 0);
      v.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(v);
    }
  }
  if (backPanel) {
    const p = plate(w - t * 2, h - t * 2, pt, panelMat);
    p.position.set(0, h / 2, -(d / 2 - pt / 2 - 0.0005));
    g.add(p);
  }
  if (bottomPanel) {
    const p = plate(w - t * 2, d - t * 2, pt, M.powderDark);
    p.position.set(0, t + pt / 2, 0);
    p.rotation.x = Math.PI / 2;
    g.add(p);
  }
  if (topCap) {
    const p = plate(w, d, pt * 1.4, panelMat);
    p.position.set(0, h + pt * 0.7, 0);
    p.rotation.x = Math.PI / 2;
    g.add(p);
    // 柜顶四个吊装环（开关柜/直流屏的常见做法，是很强的“工业信号”）
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.0038, 6, 14), M.steelBrushed);
      eye.position.set(sx * (w / 2 - 0.075), h + 0.020, sz * (d / 2 - 0.085));
      eye.castShadow = true;
      g.add(eye);
    }
  }
  if (plinth) {
    const p = bar(w - 0.02, plinth, d - 0.02, M.powderDark);
    p.position.set(0, -plinth / 2, 0);
    g.add(p);
  }
  return g;
}

/** 门板（可带门缝 / 折边 / 铰链 / 观察窗 / 百叶 / 把手 / 铭牌）
 *  —— 工业柜门的“质感”几乎全部来自三件事：门缝阴影、折边包条、铰链五金。
 */
export function doorPanel(o = {}) {
  const {
    w = 0.78, h = 0.9, t = 0.018,
    mat = M.powderLight,
    windows = [],        // [{x,y,w,h}]
    louver = null,       // {x,y,w,h}
    handle: hcfg = null, // {x,y,len}
    lock = null,
    plate: pl = null,    // 铭牌 {x,y,w,h,title,sub}
    grille = null,       // {x,y,w,h}
    bends = true,
    frame = true,        // 门缝 + 折边包条 + 门芯板
    hinges = null,       // 铰链 y 位置数组；null = 不画
    hingeSide = -1,      // -1 左开 / 1 右开
    edgeW = 0.018,       // 折边宽度
  } = o;
  const g = new THREE.Group();

  /* 门缝底衬：比门大一圈的深色薄板（夹在门板厚度之内，只在四周露出 8mm 深色缝） */
  if (frame) {
    const gap = plate(w + 0.016, h + 0.016, t * 0.5, M.seam, 0.002);
    gap.position.z = 0;     // 必须居中：门板开合时背面不能露出一整块黑
    g.add(gap);
  }

  const body = plate(w, h, t, mat, 0.0025);
  g.add(body);

  /* 折边包条 + 门芯板：让平板门有“折弯成型”的立体感 */
  if (frame) {
    const et = t * 1.22;
    const top = bar(w, edgeW, et, M.trimDark); top.position.set(0, h / 2 - edgeW / 2, 0); g.add(top);
    const bot = bar(w, edgeW, et, M.trimDark); bot.position.set(0, -h / 2 + edgeW / 2, 0); g.add(bot);
    const lf = bar(edgeW, h - edgeW * 2, et, M.trimDark); lf.position.set(-w / 2 + edgeW / 2, 0, 0); g.add(lf);
    const rt = bar(edgeW, h - edgeW * 2, et, M.trimDark); rt.position.set(w / 2 - edgeW / 2, 0, 0); g.add(rt);
    const ip = plate(Math.max(0.02, w - edgeW * 2 - 0.006), Math.max(0.02, h - edgeW * 2 - 0.006), t * 0.6, mat, 0.0016);
    ip.position.z = t * 0.14;
    g.add(ip);
  }

  // 折边（上下左右的回折边）
  if (bends) {
    for (const [sx, sy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
      const e = bar(sx ? 0.012 : w, sy ? 0.012 : h, t * 1.6, mat);
      e.position.set(sx * (w / 2 - 0.006), sy * (h / 2 - 0.006), -0.001);
      g.add(e);
    }
  }
  // 观察窗
  windows.forEach(W => {
    const fr = plate(W.w, W.h, 0.006, M.powderDark);
    fr.position.set(W.x, W.y, t / 2 - 0.001);
    g.add(fr);
    const gl = plate(W.w - 0.014, W.h - 0.014, 0.004, M.glass);
    gl.position.set(W.x, W.y, t / 2 + 0.002);
    g.add(gl);
  });
  if (louver) {
    const lp = louverPanel(louver.w, louver.h);
    lp.position.set(louver.x, louver.y, t / 2 + 0.004);
    g.add(lp);
  }
  if (grille) {
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(grille.w, grille.h), M.perf);
    gm.position.set(grille.x, grille.y, t / 2 + 0.003);
    g.add(gm);
  }
  if (hcfg) {
    const hd = handleBarSmall(hcfg.len);
    hd.position.set(hcfg.x, hcfg.y, t / 2 + 0.012);
    g.add(hd);
  }
  if (lock) {
    const lk = lockKey();
    lk.position.set(lock.x, lock.y, t / 2 + 0.006);
    g.add(lk);
  }
  if (pl) {
    const nt = nameplateTex(pl.title, pl.sub);
    const nm = new THREE.Mesh(new THREE.PlaneGeometry(pl.w, pl.h),
      new THREE.MeshStandardMaterial({ map: nt, roughness: 0.6 }));
    nm.position.set(pl.x, pl.y, t / 2 + 0.002);
    g.add(nm);
  }
  /* 铰链（工业柜门最显眼的五金件，缺了就像一块贴上去的板） */
  if (hinges && hinges.length) {
    hinges.forEach(hy => {
      const hg = hinge(M.steelBrushed);
      hg.position.set(hingeSide * (w / 2 - 0.004), hy, -t / 2 - 0.005);
      hg.rotation.y = hingeSide > 0 ? Math.PI : 0;
      g.add(hg);
    });
  }
  return g;
}

function handleBarSmall(len = 0.13) { return handle(len); }

/** 地面（带轻微反射的环氧地坪 / 混凝土地面） */
export function floorPlane(size, mat = M.epoxyFloor, y = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

/** 房间（三面墙 + 天花 + 地面），法线朝内 */
export function roomBox(o = {}) {
  const {
    w = 9, h = 3.4, d = 7,
    /* ⚠️ 吊顶默认值第 46 轮从 `M.wallDark` 换成 `M.ceilPanel` —— 理由见 mats.js。
       踢脚线 / 阴角线 / 吊顶分缝（函数末尾那三组）仍然用 wallDark，那几处不动。 */
    wallMat = M.wall, floorMat = M.epoxyFloor, ceilMat = M.ceilPanel,
    skipFront = true,
  } = o;
  const g = new THREE.Group();
  const fl = floorPlane(Math.max(w, d) * 1.2, floorMat);
  g.add(fl);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = h;
  g.add(ceil);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
  back.position.set(0, h / 2, -d / 2); g.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(d, h), wallMat);
  left.rotation.y = Math.PI / 2; left.position.set(-w / 2, h / 2, 0); g.add(left);
  const right = left.clone(); right.rotation.y = -Math.PI / 2; right.position.x = w / 2; g.add(right);
  if (!skipFront) {
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    front.rotation.y = Math.PI; front.position.set(0, h / 2, d / 2); g.add(front);
  }
  /* 踢脚线 + 阴角线 + 吊顶分缝 —— 第 47 轮。
     ⚠️ 原来只有后墙一条踢脚线：左右墙与地面的交界是一条**硬边**，房间读起来像
        「三块板拼的盒子」。线脚是成本最低的「把盒子变成房间」的一笔。
     ⚠️ 三种都是 `M.wallDark` —— 同材质同作用域会被 `batchStatic` 合成一个几何，
        所以这一步**不新增 draw call**（多出来的只是顶点）。
     ⚠️ 尺寸刻意做小：踢脚 0.12 高 × 0.012 厚、阴角 0.026 见方、吊顶缝 0.02 宽。
        再粗一点就从「房间的构造细节」变成「画了一堆黑条」。 */
  const SK_H = 0.12, SK_T = 0.012;
  const skB = bar(w, SK_H, SK_T, M.wallDark);
  skB.position.set(0, SK_H / 2, -d / 2 + SK_T / 2); g.add(skB);
  if (!skipFront) {
    const skF = bar(w, SK_H, SK_T, M.wallDark);
    skF.position.set(0, SK_H / 2, d / 2 - SK_T / 2); g.add(skF);
  }
  for (const sx of [-1, 1]) {
    const skS = bar(d, SK_H, SK_T, M.wallDark);
    skS.rotation.y = Math.PI / 2;                 // 侧墙那条沿 z 铺
    skS.position.set(sx * (w / 2 - SK_T / 2), SK_H / 2, 0); g.add(skS);
  }
  /* 阴角线：竖角上的细柱，只负责把「两面墙相交」这件事画出来。
     ⚠️ `skipFront` 时前侧两个角**没有墙** —— 柱会变成孤零零立在地上的方柱，必须跳过。 */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    if (sz > 0 && skipFront) continue;
    const c = bar(0.026, h, 0.026, M.wallDark);
    c.position.set(sx * (w / 2 - 0.013), h / 2, sz * (d / 2 - 0.013));
    g.add(c);
  }
  /* 吊顶分缝：第 46 轮把吊顶换成浅色压型板之后，它成了一整块纯色平面。
     按 1.2m 一道压缝 —— 浅色面上的一道 0.02 细缝就足以读出「板」。
     ⚠️ 贴在吊顶**下沿**（h − 0.008 ~ h），吊顶灯带挂在 h − 0.10，不会打架。 */
  const PITCH = 1.2;
  for (let z = -d / 2 + PITCH; z < d / 2 - 0.3; z += PITCH) {
    const s = bar(w, 0.008, 0.02, M.wallDark);
    s.position.set(0, h - 0.004, z); g.add(s);
  }
  /* 墙面竖向分缝 —— 第 60 轮。
     ⚠️ 吊顶第 46 轮就有分缝、踢脚/阴角线第 47 轮补齐，**唯独墙面一直是整块纯色**。
        9.2×3.06m 的一面墙在画面里占比很大，「一面没有任何构造的灰墙」
        正是「三块板拼的盒子」感的最后来源。
     ⚠️ 材质用 `M.wallDark`，与踢脚线/阴角线/吊顶缝同材质 ⇒ batchStatic 合并，
        **不新增 draw call**（多出来的只是顶点）。
     ⚠️ 断面 0.022 宽 × 0.014 厚 ⇒ **凸出墙面 14mm**（与吊顶缝的 20mm 同量级）。
        先量过净空（`wall_clear_probe.js`）：
        四面墙最近的非线脚件都在 20mm 以外（挂墙箱贴墙留 10mm 施工缝），
        7mm 不会插进去；就算被箱体挡住，也只等于「这块板缝在柜子后面」，本来就是看不见的。
     ⚠️ 上下端各留出来：从踢脚线**顶面**（SK_H）起到吊顶**下沿**（h − 0.012）止 ——
        跨过去只会让同色几何互相重叠，不如留干净。
     ⚠️ 相位与吊顶分缝对齐（都从 -d/2 + PITCH 起），侧墙的竖缝正好接在吊顶缝的端点上，
        整间房的板缝读起来是**一套网格**，而不是两套各走各的。 */
  const PW_T = 0.022, PW_D = 0.014;
  const PY0 = SK_H, PY1 = h - 0.012, PYH = PY1 - PY0, PYC = (PY0 + PY1) / 2;
  /* ⚠️ 每条缝打 `userData.wallSeam`：合批（BOUNDARY 不看这个键）会把它连同网格一起
     并掉，但探针是在 `window.__noBatch = true` 下跑的 ⇒ 数得到。
     没有这个标记，探针分不清「分缝」和「踢脚线」（两者同材质、同形态量级）。 */
  for (let x = -w / 2 + PITCH; x < w / 2 - PITCH * 0.5; x += PITCH) {
    const sb = bar(PW_T, PYH, PW_D, M.wallDark);
    sb.position.set(x, PYC, -d / 2 + PW_D / 2); sb.userData.wallSeam = true; g.add(sb);
    if (!skipFront) {
      const sf = bar(PW_T, PYH, PW_D, M.wallDark);
      sf.position.set(x, PYC, d / 2 - PW_D / 2); sf.userData.wallSeam = true; g.add(sf);
    }
  }
  for (let z = -d / 2 + PITCH; z < d / 2 - PITCH * 0.5; z += PITCH) {
    for (const sx of [-1, 1]) {
      const ss = bar(PW_D, PYH, PW_T, M.wallDark);
      ss.position.set(sx * (w / 2 - PW_D / 2), PYC, z); ss.userData.wallSeam = true; g.add(ss);
    }
  }
  return g;
}

/** 天花灯带（室内工业冷白光） */
export function ceilingLightStrip(len, opt = {}) {
  const { mat = M.lampCool, w = 0.12 } = opt;
  const g = new THREE.Group();
  const housing = rbox(len, 0.05, w, 0.004, M.powderWhite);
  const tube = plate(len - 0.04, w - 0.03, 0.006, mat);
  tube.rotation.x = Math.PI / 2;
  tube.position.y = -0.026;
  g.add(housing, tube);
  return g;
}

/* ============================================================
 * 变压器 / 一次设备
 * ============================================================ */

/** 干式变压器（铁芯 + 三相绕组 + 夹件） */
export function dryTransformer(o = {}) {
  const {
    w = 1.1, h = 1.25, d = 0.75,
    coreMat = M.aluDark, coilMat = M.copper,
  } = o;
  const g = new THREE.Group();
  const legW = 0.20, yoke = 0.16, th = 0.30;

  // 三相铁芯柱 + 上下轭
  for (let i = -1; i <= 1; i++) {
    const leg = bar(legW, h - yoke * 2, th, coreMat);
    leg.position.set(i * 0.36, h / 2, 0);
    g.add(leg);
  }
  for (const y of [yoke / 2 + 0.02, h - yoke / 2 - 0.02]) {
    const yk = bar(w, yoke, th, coreMat);
    yk.position.set(0, y, 0);
    g.add(yk);
  }
  // 绕组（高压 + 低压）
  for (let i = -1; i <= 1; i++) {
    const hv = cyl(0.145, 0.145, h * 0.62, coilMat, 26);
    hv.position.set(i * 0.36, h * 0.48, 0);
    g.add(hv);
    const hvIn = cyl(0.118, 0.118, h * 0.64, M.insul, 22);
    hvIn.position.copy(hv.position); hvIn.position.y += 0.002;
    g.add(hvIn);
    const lv = cyl(0.098, 0.098, h * 0.30, M.copper, 22);
    lv.position.set(i * 0.36, h * 0.86, 0);
    g.add(lv);
    // 绝缘垫块
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const sp = plate(0.03, h * 0.6, 0.012, M.pcBeige);
      sp.position.set(i * 0.36 + Math.cos(a) * 0.155, h * 0.48, Math.sin(a) * 0.155);
      sp.rotation.y = -a;
      g.add(sp);
    }
  }
  // 夹件
  for (const sz of [-1, 1]) {
    const cl = bar(w + 0.08, 0.05, 0.05, M.steelBrushed);
    cl.position.set(0, 0.06, sz * (th / 2 + 0.03));
    g.add(cl);
    const cl2 = cl.clone(); cl2.position.y = h - 0.06;
    g.add(cl2);
  }
  for (let i = -1; i <= 1; i++) {
    const rod = cyl(0.008, 0.008, h + 0.14, M.steelBrushed, 10);
    rod.position.set(i * 0.36 + 0.16, h / 2, 0);
    g.add(rod);
  }
  // 温度传感器（PT100 埋件引出）
  for (let i = -1; i <= 1; i++) {
    const t = cyl(0.006, 0.006, 0.05, M.steelBrushed, 8);
    t.position.set(i * 0.36, h * 0.80, 0.16);
    t.rotation.x = Math.PI / 2;
    g.add(t);
  }
  return g;
}

/** 绝缘子支柱 */
export function insulator(h = 0.18, mat = M.pcBeige) {
  const g = new THREE.Group();
  let y = 0;
  const seg = 4;
  for (let i = 0; i < seg; i++) {
    const r = 0.026 - i * 0.003;
    const s = cyl(r, r, h / seg * 0.72, mat, 16);
    s.position.y = y + h / seg * 0.5;
    g.add(s);
    const disc = cyl(r * 1.55, r * 1.55, 0.008, mat, 16);
    disc.position.y = y + h / seg * 0.92;
    g.add(disc);
    y += h / seg;
  }
  const cap = cyl(0.012, 0.012, 0.014, M.steelBrushed, 12);
  cap.position.y = h + 0.007;
  g.add(cap);
  return g;
}

/** 母线（铜排） */
export function busbar(w, h, d, mat = M.copper) {
  const g = new THREE.Group();
  const m = bar(w, h, d, mat);
  g.add(m);
  return g;
}

/** 电缆束 */
export function cableBundle(count, len, opt = {}) {
  const { r = 0.008, spread = 0.02, mat = M.cable, curve = 0.06 } = opt;
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -len * 0.5, curve * (i % 2 ? 1 : -1)),
      new THREE.Vector3(spread * (i - (count - 1) / 2), -len, 0),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 12, r, 8, false), mat);
    tube.castShadow = true;
    g.add(tube);
  }
  return g;
}

/** 接触阴影（贴地软化投影，用于把设备“压”在地面上） */
export function contactShadow(w, d, opacity = 0.55) {
  /* 贴图与材质都按 opacity 缓存（第 38 轮）：原来每处接触阴影都新建一张 256×256
     贴图 + 一个材质，9 个场景加起来十几张重复贴图。
     ⚠️ 透明材质**不参与批处理** → 这里省的是**贴图内存**（低配机显存敏感），不是 draw call。 */
  const mat = cachedMat(`cshadow:${opacity}`, () => {
    const tex = canvasTex(256, 256, (g, cw, ch) => {
      g.clearRect(0, 0, cw, ch);
      try { g.filter = 'blur(22px)'; } catch (e) { }
      g.fillStyle = 'rgba(0,0,0,1)';
      g.fillRect(cw * 0.14, ch * 0.14, cw * 0.72, ch * 0.72);
      try { g.filter = 'none'; } catch (e) { }
    });
    return new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false, fog: true });
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

export { FONT_CJK, FONT_MONO };
