/**
 * ess.js —— 户外场景：储能预制舱（20ft 电池储能舱）
 *
 * 为什么单独做一个场景：储能舱里「一次设备 + 二次元件」的配合关系
 * 跟开关柜完全不同 ——
 *   · 主设备是**电池簇 + 变流器（PCS）**，不是断路器；
 *   · 二次侧关心的是**温度**（电池对温度极敏感）、**直流侧电流电压**、**舱内凝露**；
 *   · 所以本公司产品在这里的落点是 TS 温度变送器、RML/RMY 量度继电器、
 *     SS 信号隔离、THC/THS 温湿度控制与上传 —— 这是销售最常被问到的组合。
 *
 * ⚠️ 示意模型口径：
 *   · 尺寸取行业标准量级（20ft 舱 6058 × 2438 × 2591 mm，电池簇约 1.0 × 2.2 × 0.8 m），
 *     不是任何具体工程或厂商的尺寸；
 *   · 电池簇内部（电芯、BMS、液冷管路）与 PCS 内部电路一概不表达。
 */
import * as THREE from 'three';
import { M } from '../mats.js';
import {
  rbox, plate, cyl, bar, rot, doorPanel, dinRail, wireDuct, terminalRow,
  cableBundle, louverPanel, gland, handle,
} from '../parts.js';
import { buildProductModel } from '../product-models.js';
import {
  hotspot, placeOnRail, cullRailBlanks, mountElement, regElement,
  skyDome, utilityPole, powerLine, shrub, treeline,
} from '../scene-kit.js';
import { isolateMaterials } from '../mats.js';
import { canvasTex } from '../util.js';

/* ---------- 尺寸（20ft 标准集装箱量级） ---------- */
const CL = 6.06;          // 舱长（z）
const CW = 2.44;          // 舱宽（x）
const CH = 2.59;          // 舱高
const BASE_H = 0.30;      // 混凝土基础高
const Y0 = BASE_H;        // 舱底标高
const T = 0.06;           // 舱壁厚（含保温层）
const FZ = CL / 2;        // 舱前端（门端）
const BZ = -CL / 2;

/* ============================================================
 * 舱体
 * ============================================================ */
function cabin() {
  const g = new THREE.Group();

  /* 底部型钢框架 */
  for (const sz of [FZ - 0.10, BZ + 0.10]) {
    const beam = bar(CW, 0.14, 0.16, M.trimDark);
    beam.position.set(0, Y0 + 0.07, sz);
    g.add(beam);
  }
  for (const sx of [-CW / 2 + 0.10, CW / 2 - 0.10]) {
    const beam = bar(0.14, 0.14, CL - 0.10, M.trimDark);
    beam.position.set(sx, Y0 + 0.07, 0);
    g.add(beam);
  }
  /* 底板（花纹钢） */
  const floor = plate(CW - 0.04, CL - 0.04, 0.05, M.perf);
  rot(floor, Math.PI / 2, 0, 0);
  floor.position.set(0, Y0 + 0.16, 0);
  g.add(floor);

  /* 两侧壁 + 后壁（波纹板：竖向压筋，集装箱的识别特征） */
  const ribN = 20;
  for (const sx of [-1, 1]) {
    const wall = plate(CL - 0.10, CH - 0.14, T, M.powderLight);
    rot(wall, 0, Math.PI / 2, 0);
    wall.position.set(sx * (CW / 2 - T / 2), Y0 + CH / 2 + 0.05, 0);
    g.add(wall);
    for (let i = 0; i < ribN; i++) {
      const z = -CL / 2 + 0.30 + i * ((CL - 0.60) / (ribN - 1));
      const rib = bar(0.035, CH - 0.30, 0.075, M.powderMid);
      rib.position.set(sx * (CW / 2 + 0.005), Y0 + CH / 2 + 0.03, z);
      g.add(rib);
    }
  }
  const backWall = plate(CW - 0.02, CH - 0.14, T, M.powderLight);
  backWall.position.set(0, Y0 + CH / 2 + 0.05, BZ + T / 2);
  g.add(backWall);
  for (let i = 0; i < 8; i++) {
    const rib = bar(0.075, CH - 0.30, 0.035, M.powderMid);
    rib.position.set(-CW / 2 + 0.22 + i * ((CW - 0.44) / 7), Y0 + CH / 2 + 0.03, BZ - 0.005);
    g.add(rib);
  }

  /* 顶板（微坡，向两侧排水）+ 顶部通风口 */
  const rise = 0.09;
  const half = CW / 2;
  const ang = Math.atan2(rise, half);
  const slope = Math.hypot(half, rise);
  for (const sx of [1, -1]) {
    const p = rbox(slope, 0.05, CL + 0.10, 0.006, M.powderMid, 1);
    rot(p, 0, 0, sx * -ang);
    p.position.set(sx * half / 2, Y0 + CH + rise / 2 + 0.05, 0);
    g.add(p);
  }
  const ridge = bar(0.10, 0.05, CL + 0.10, M.trimDark);
  ridge.position.set(0, Y0 + CH + rise + 0.06, 0);
  g.add(ridge);
  /* 顶部防爆通风口 ×2 */
  for (const z of [-1.7, 1.7]) {
    const v = rbox(0.46, 0.10, 0.46, 0.006, M.aluDark, 1);
    v.position.set(0, Y0 + CH + rise + 0.10, z);
    g.add(v);
    const grill = louverPanel(0.38, 0.38, { cols: 6, rows: 6 });
    rot(grill, -Math.PI / 2, 0, 0);
    grill.position.set(0, Y0 + CH + rise + 0.16, z);
    g.add(grill);
  }

  /* 品牌色腰线（储能舱常见做法，也帮观众一眼分辨舱体朝向） */
  for (const sx of [-1, 1]) {
    const stripe = bar(CL - 0.10, 0.16, 0.02, M.powderBrand);
    stripe.position.set(sx * (CW / 2 + 0.012), Y0 + CH * 0.72, 0);
    g.add(stripe);
  }

  /* 端部框架 + 双开门（打开 ~105°，露出舱内） */
  for (const sx of [-1, 1]) {
    const post = bar(0.10, CH, 0.10, M.trimDark);
    post.position.set(sx * (CW / 2 - 0.05), Y0 + CH / 2 + 0.05, FZ - 0.05);
    g.add(post);
  }
  const lintel = bar(CW, 0.10, 0.10, M.trimDark);
  lintel.position.set(0, Y0 + CH - 0.02, FZ - 0.05);
  g.add(lintel);
  const sill = bar(CW, 0.10, 0.10, M.trimDark);
  sill.position.set(0, Y0 + 0.21, FZ - 0.05);
  g.add(sill);

  const dw = CW / 2 - 0.09;
  const dh = CH - 0.44;
  for (const sx of [-1, 1]) {
    const d = doorPanel({
      w: dw, h: dh, t: 0.030,
      mat: M.powderLight,
      handle: { x: sx * (dw / 2 - 0.10), y: -0.10 },
      lock: { x: sx * (dw / 2 - 0.10), y: -0.34 },
      plate: sx < 0
        ? { x: 0, y: dh / 2 - 0.24, w: 0.34, h: 0.13, title: '储能预制舱', sub: '20ft · BESS' }
        : null,
      hinges: [-0.70, 0, 0.70],
      hingeSide: sx,
    });
    const pivot = new THREE.Group();
    pivot.position.set(sx * (CW / 2 - 0.07), Y0 + 0.26 + dh / 2, FZ - 0.03);
    d.position.set(-sx * dw / 2, 0, 0);
    pivot.add(d);
    /* 门扇朝 -sx 方向伸出 → 要往舱前（+z）开，角度符号跟着 sx 走。
       ⚠️ 开角必须给到 ~155°（2.70rad）让门扇**折回贴着舱侧壁**：
       给 105° 时两扇门会斜插在舱口正前方，默认机位从右前方看过去
       正好被右门整片挡住，舱内一根线都看不见（第一版就是这个毛病）。
       2.70rad 时门扇落在 x 1.15~2.17 / z 3.0~3.5，只向侧面挑出，不挡视线。 */
    pivot.rotation.y = sx * 2.70;
    /* 可开合（见 app.js 的 collectDoors）：门扇从铰点朝 -sx 伸出、落在门洞上，
       rotation.y = 0 即关闭。 */
    pivot.userData.door = { open: sx * 2.70, closed: 0 };
    pivot.userData.explode = [0, 0, 0.70];
    g.add(pivot);
  }

  /* 舱外爬梯（检修顶部空调/通风口） */
  const lad = new THREE.Group();
  for (const dx of [-0.14, 0.14]) {
    const rail = bar(0.035, CH, 0.035, M.steelBrushed);
    rail.position.set(dx, CH / 2, 0);
    lad.add(rail);
  }
  for (let i = 0; i < 7; i++) {
    const rung = bar(0.32, 0.028, 0.028, M.steelBrushed);
    rung.position.set(0, 0.30 + i * 0.36, 0);
    lad.add(rung);
  }
  /* 爬梯用支架挑出舱壁 —— 梯宽 0.32、半宽 0.16，加上压筋外沿 1.2425，
     中心必须给到 CW/2 + 0.20（= 1.42）才能让横档整根落在壁面之外。 */
  lad.position.set(CW / 2 + 0.20, Y0 + 0.10, BZ + 0.60);
  g.add(lad);

  return g;
}

/* ============================================================
 * 场坪 / 基础 / 围栏
 * ============================================================ */
function site() {
  const g = new THREE.Group();

  /* 混凝土基础（两条条形基础，集装箱只落在两条梁上） */
  for (const sx of [-CW / 2 + 0.35, CW / 2 - 0.35]) {
    const b = rbox(0.60, BASE_H, CL + 0.60, 0.010, M.concrete, 1);
    b.position.set(sx, BASE_H / 2, 0);
    g.add(b);
  }
  /* 碎石场坪 + 草地 */
  const gravel = new THREE.Mesh(new THREE.CircleGeometry(15, 48), M.gravel);
  rot(gravel, -Math.PI / 2, 0, 0);
  gravel.position.y = 0.002;
  gravel.receiveShadow = true;
  g.add(gravel);
  /* ⚠️ 第 59 轮：外径 70 比树线最远一棵（treeline(60,66) 实测 49.4~70.8m）
     还小 0.8m。外径按「树线最大半径 ×1.13」取 80。 */
  const grass = new THREE.Mesh(new THREE.RingGeometry(15, 80, 48), M.grass);
  rot(grass, -Math.PI / 2, 0, 0);
  grass.receiveShadow = true;
  g.add(grass);

  /* 安全围栏（储能场站必须设围栏与警示） */
  const R = 4.6;
  const RZ = 5.4;
  for (const sz of [1, -1]) {
    for (let i = -3; i <= 3; i++) {
      const p = bar(0.05, 1.20, 0.05, M.steelBrushed);
      p.position.set(i * 1.50, 0.60, sz * RZ);
      g.add(p);
    }
    for (const y of [1.08, 0.68, 0.26]) {
      const r = bar(9.2, 0.04, 0.03, M.steelBrushed);
      r.position.set(0, y, sz * RZ);
      g.add(r);
    }
  }
  for (const sx of [1, -1]) {
    for (let i = -3; i <= 3; i++) {
      const p = bar(0.05, 1.20, 0.05, M.steelBrushed);
      p.position.set(sx * R, 0.60, i * 1.50);
      g.add(p);
    }
    for (const y of [1.08, 0.68, 0.26]) {
      const r = bar(0.03, 0.04, 9.2, M.steelBrushed);
      r.position.set(sx * R, y, 0);
      g.add(r);
    }
  }

  /* 警示牌 */
  const warnTex = canvasTex(256, 320, (g2) => {
    g2.fillStyle = '#f2c800'; g2.fillRect(0, 0, 256, 320);
    g2.strokeStyle = '#111'; g2.lineWidth = 10; g2.strokeRect(10, 10, 236, 300);
    g2.fillStyle = '#111'; g2.textAlign = 'center';
    g2.font = '800 100px "PingFang SC",sans-serif';
    g2.fillText('⚡', 128, 146);
    g2.font = '800 38px "PingFang SC",sans-serif';
    g2.fillText('储能重地', 128, 220);
    g2.font = '700 21px "PingFang SC",sans-serif';
    g2.fillText('高压直流 · 禁止靠近', 128, 264);
  });
  for (const sx of [1, -1]) {
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.40),
      new THREE.MeshStandardMaterial({ map: warnTex, roughness: 0.6, side: THREE.DoubleSide }));
    warn.position.set(sx * (R - 0.20), 1.05, RZ + 0.04);
    g.add(warn);
  }
  return g;
}

/* ============================================================
 * 场景构建
 * ============================================================ */
export function build() {
  const root = new THREE.Group();
  const hotspots = [];

  /* ⚠️ 把**投影主光的方向**传给天空：否则天空左右对称，
     而地上的影子却朝一边倒 —— 光和天对不上，一眼就假。 */
  root.add(skyDome(180, { sun: [-7.0, 8.6, 6.0] }));

  /* ---------- 远景：光伏方阵（储能站常与光伏同场）+ 电杆 + 树线 ---------- */
  const far = new THREE.Group();
  const poles = [];
  [[-12.5, 1.0, -8.0], [-4.0, 1.15, -13.5], [7.0, 1.25, -17.0]].forEach(([x, s, z]) => {
    const p = utilityPole(8.4 * s, { arms: 2 });
    p.position.set(x, 0, z);
    p.scale.setScalar(s);
    far.add(p);
    poles.push({ x, z, s });
  });
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    for (let k = 0; k < 4; k++) {
      const yA = 8.4 * a.s * (0.88 - Math.floor(k / 2) * 0.09);
      const yB = 8.4 * b.s * (0.88 - Math.floor(k / 2) * 0.09);
      far.add(powerLine(
        new THREE.Vector3(a.x + (k % 2 ? 0.5 : -0.5) * a.s, yA + 0.11, a.z),
        new THREE.Vector3(b.x + (k % 2 ? 0.5 : -0.5) * b.s, yB + 0.11, b.z),
        { sag: 1.2, r: 0.022 }
      ));
    }
  }
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 17 + Math.random() * 40;
    const s = shrub(0.9 + Math.random() * 0.8, i * 0.71);
    s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.8 - 5);
    far.add(s);
  }
  far.add(treeline(60, 66, { minH: 3.2, maxH: 7.8, seed: 7 }));
  /* 远景（电杆 / 导线 / 树线 / 灌木）整组标注为 scenery：
     不参与「全景」取景 —— 树线在 46~58m 外，并进包围盒会把柜体挤出画面。 */
  far.userData.scenery = true;
  root.add(far);

  /* 场坪 / 草地环 / 围栏整组标注为 scenery：
     ⚠️ 草地环半径最大到 52m（rmu），是「全景跑飞」的主因 —— 它会把包围球撑到几十米，
        相机被 maxDistance 夹回来之后，柜体反而落在画面外。 */
  const siteG = site();
  siteG.userData.scenery = true;
  root.add(siteG);
  root.add(cabin());

  /* ---------- 舱内布置的横向预算 ----------
     舱内净宽 = CW − 2T = 2.44 − 0.12 = 2.32 m（−1.16 ~ +1.16）。
     左侧电池簇 1.00 宽、右侧 PCS 1.10 宽，两者之间还要留检修缝 ——
     所以簇中心定 −0.62、PCS 中心定 +0.53：
       簇  −1.12 ~ −0.12   （离左壁 0.04）
       PCS +0.53 ~ +1.08   （离右壁 0.08），中间留 0.08 检修缝
     ⚠️ 原来 PCS 给 1.20 宽、中心 0.60，右边缘 1.20 > 内壁 1.16 —— 直接插进舱壁。 */
  const RACK_X = -0.62;
  const PCS_X = 0.53;

  /* ---------- 舱内：电池簇 ---------- */
  const rackZ = [-1.95, -1.05, -0.15, 0.75];
  rackZ.forEach((z, i) => {
    mountElement(root, hotspots, 'ESSRACK', {
      x: RACK_X, y: Y0 + 0.20 + 1.10, z,
      key: `ESSRACK#${i + 1}`,
      off: [0, 1.16, 0.10],
      quiet: true,
      note: `舱内左侧 · 储能电池簇 ${i + 1}（机架式，内部电芯与 BMS 不作表达）`,
    });
  });

  /* ---------- 舱内：变流器（PCS） ---------- */
  mountElement(root, hotspots, 'PCS', {
    x: PCS_X, y: Y0 + 0.20 + 1.05, z: -1.60,
    build: { w: 1.10, h: 2.10, d: 0.85 },
    off: [0, 1.12, 0.10],
    note: '舱内右侧 · 储能变流器（PCS，直流↔交流双向）',
  });

  /* ---------- 舱内：汇流柜（直流侧汇流与保护） ---------- */
  const combiner = new THREE.Group();
  const cbBody = rbox(0.80, 2.00, 0.70, 0.006, M.powderLight, 2);
  cbBody.position.y = 1.00;
  combiner.add(cbBody);
  const cbDoor = plate(0.72, 1.84, 0.012, M.powderWhite, 0.004);
  cbDoor.position.set(0, 1.00, 0.36);
  combiner.add(cbDoor);
  const cbHandle = handle(0.14);
  cbHandle.position.set(-0.28, 1.00, 0.375);
  combiner.add(cbHandle);
  for (const [i, m] of [[0, M.ledGreen], [1, M.ledAmber], [2, M.ledRed]]) {
    const led = cyl(0.007, 0.007, 0.006, m, 10);
    rot(led, Math.PI / 2, 0, 0);
    led.position.set(-0.24 + i * 0.035, 1.68, 0.372);
    combiner.add(led);
  }
  const cbScr = plate(0.20, 0.09, 0.004, M.displayOn);
  cbScr.position.set(0.16, 1.66, 0.372);
  combiner.add(cbScr);
  combiner.position.set(PCS_X, Y0 + 0.20, 0.35);
  combiner.userData.explode = [0, 0, 0.45];
  root.add(combiner);
  regElement(hotspots, 'DCCAB', combiner, {
    off: [0, 1.05, 0.10], note: '舱内右侧 · 直流汇流柜（直流侧保护与汇流）',
  });

  /* ---------- 舱内：气体灭火柜 ---------- */
  mountElement(root, hotspots, 'FIRE', {
    x: PCS_X, y: Y0 + 0.20 + 0.85, z: 1.55,
    off: [0, 0.92, 0.10],
    note: '舱内右侧 · 气体灭火柜（与烟感温感联动）',
  });

  /* ---------- 舱外：工业空调 ×2（挂右侧外壁） ----------
     ⚠️ 必须绕 Y 转 90° 再贴壁：hvacUnit 的「正面」（格栅那面）朝 +z，
     不转的话机箱宽度会沿 x 展开，直接横穿舱壁与压筋。转过来之后
     厚度 0.45 沿 x、宽度 0.90 沿 z，贴壁才对。 */
  for (const z of [-1.30, 1.10]) {
    mountElement(root, hotspots, 'HVAC', {
      x: CW / 2 + 0.26, y: Y0 + 0.20 + 0.75, z,
      ry: Math.PI / 2,
      key: `HVAC#${z > 0 ? 2 : 1}`,
      off: [0, 0.82, 0.10],
      quiet: true,
      note: '舱外右侧壁 · 工业空调（舱内控温除湿）',
    });
  }

  /* ---------- 舱外：接地 ---------- */
  const gnd = new THREE.Group();
  const gndRun = bar(0.05, 0.012, CL - 0.60, M.copper);
  gndRun.position.set(-CW / 2 - 0.06, 0.34, 0);
  gnd.add(gndRun);
  const gndStake = cyl(0.018, 0.018, 0.60, M.copper, 10);
  gndStake.position.set(-CW / 2 - 0.06, 0.16, FZ - 0.80);
  gnd.add(gndStake);
  root.add(gnd);
  regElement(hotspots, 'GNDBAR', gnd, {
    off: [0, 0.20, 0.02], quiet: true, note: '舱外 · 接地干线（沿舱壁敷设，带接地极）',
  });

  /* ---------- 舱内二次控制柜（本公司产品的落点） ----------
     真实储能舱里，二次控制柜通常靠舱门一侧布置，柜内装温度变送器、
     量度继电器、信号隔离器与温湿度控制器。柜门做成打开的。 */
  const W2 = 0.80, H2 = 2.00, D2 = 0.55, t2 = 0.018;
  const ctl = new THREE.Group();
  /* ⚠️ 柜体必须由「底板 + 后壁 + 两侧 + 顶板」拼成，**不能用一个实心 rbox** ——
     实心盒子会把内装板、导轨和挂在导轨上的本公司产品整个包在里面，
     从打开的柜门看进去只有一块前脸，产品全被挡住（clip_test 也会报
     「静态件完整包住产品」）。 */
  const ctlBase = rbox(W2, 0.06, D2, 0.004, M.powderDark, 1);
  ctlBase.position.y = 0.03;
  ctl.add(ctlBase);
  const ctlBack = plate(W2, H2, t2, M.powderLight);
  ctlBack.position.set(0, H2 / 2, -D2 / 2 + t2 / 2);
  ctl.add(ctlBack);
  for (const sx of [1, -1]) {
    const s = plate(D2, H2, t2, M.powderLight);
    rot(s, 0, Math.PI / 2, 0);
    s.position.set(sx * (W2 / 2 - t2 / 2), H2 / 2, 0);
    ctl.add(s);
  }
  const ctlTop = plate(W2, D2, t2, M.powderMid);
  rot(ctlTop, Math.PI / 2, 0, 0);
  ctlTop.position.set(0, H2 - t2 / 2, 0);
  ctl.add(ctlTop);
  /* 门（左开 ~100°，朝 +z 打开） */
  const cd = doorPanel({
    w: W2 - 0.03, h: H2 - 0.10, t: 0.014,
    windows: [{ x: 0, y: 0.36, w: 0.28, h: 0.20 }],
    handle: { x: W2 / 2 - 0.09, y: 0 },
    plate: { x: 0, y: H2 / 2 - 0.24, w: 0.28, h: 0.10, title: '二次控制柜', sub: 'BESS CTRL' },
    hinges: [-0.55, 0, 0.55],
    hingeSide: -1,
  });
  const cdp = new THREE.Group();
  cdp.position.set(-W2 / 2 + 0.015, H2 / 2, D2 / 2 + 0.004);
  cd.position.set((W2 - 0.03) / 2, 0, 0);
  cdp.add(cd);
  cdp.rotation.y = -1.75;                 // 门扇朝 +x 伸出 → 负角往舱前开
  cdp.userData.door = { open: -1.75, closed: 0 };
  cdp.userData.explode = [0, 0, 0.45];
  ctl.add(cdp);
  /* 内装板 + 两条导轨 */
  const RAIL_A = 1.46, RAIL_B = 1.12;
  const PLATE_Z = -0.02;
  const ctlPlate = plate(W2 - 0.10, 1.30, 0.004, M.powderWhite);
  ctlPlate.position.set(0, 1.30, PLATE_Z);
  ctl.add(ctlPlate);
  for (const ry of [RAIL_A, RAIL_B]) {
    const r = dinRail(W2 - 0.16);
    r.position.set(0, ry, PLATE_Z + 0.024);
    ctl.add(r);
  }
  const RAIL_FRONT = PLATE_Z + 0.024 + 0.005;
  const ctlDucts = [];
  for (const dy of [1.86, 1.64, 1.28, 0.96, 0.74]) {
    const d = wireDuct(W2 - 0.16, 0.040, 0.028);
    d.position.set(0, dy, PLATE_Z + 0.024);
    ctl.add(d);
    ctlDucts.push(d);
  }
  const ctlTerm = terminalRow(16, { w: 0.0072, h: 0.044, d: 0.040 });
  ctlTerm.position.set(0, 0.58, PLATE_Z + 0.022);
  ctl.add(ctlTerm);
  const ctlCable = cableBundle(5, 0.28, { r: 0.0045, spread: 0.05 });
  ctlCable.position.set(0, 0.48, PLATE_Z + 0.01);
  ctl.add(ctlCable);

  /* ⚠️ 柜位 z 不能贴到舱门口：柜门宽 0.77，门后要留得下开启扫掠。
     舱前端面在 z = +3.03，柜体前表面 2.075 → 门前净空 0.955 > 门宽，够开。 */
  ctl.position.set(-0.60, Y0 + 0.20, 1.80);
  ctl.userData.explode = [0, 0, 0.30];
  root.add(ctl);
  regElement(hotspots, 'LCP', ctl, {
    off: [0, 1.05, 0.06],
    note: '舱内前部 · 二次控制柜（本公司二次元件集中安装处）',
  });

  function mountIn(id, railY, slotIndex, note) {
    const p = buildProductModel(id);
    const x = (slotIndex - 3.5) * 0.045;
    placeOnRail(p, { x, y: railY, zBack: RAIL_FRONT });
    p.rotation.y = 0;
    isolateMaterials(p);
    p.userData.pid = id;
    ctl.add(p);
    hotspots.push(hotspot(id, p, { offset: [0, 0.030, 0.02], note }));
    return p;
  }
  mountIn('TS', RAIL_A, 1, '二次控制柜 · 温度变送器（电池/舱内温度上传 EMS）');
  mountIn('RML', RAIL_A, 4, '二次控制柜 · 交流电流继电器（并网点电流监视）');
  mountIn('SS', RAIL_A, 6, '二次控制柜 · 信号隔离/安全栅（BMS 通信回路隔离）');
  /* ⚠️ RAI 是抗干扰型中间继电器（45mm 宽），槽位要给足间距：
     上排 1/4/6 已占，取槽 8（x = 0.2025），离 SS 还有 61mm 净空。 */
  mountIn('RAI', RAIL_A, 8, '二次控制柜 · 抗干扰继电器（PCS 变流回路与长电缆信号，强干扰现场防误动）');
  mountIn('THC', RAIL_B, 2, '二次控制柜 · 舱内防凝露加热控制');
  mountIn('THS', RAIL_B, 5, '二次控制柜 · 温湿度上传（接后台）');

  mountElement(ctl, hotspots, 'MCCB', {
    x: -0.28, y: RAIL_B, zBack: RAIL_FRONT,
    build: { w: 0.075, h: 0.13, d: 0.07 },
    note: '二次控制柜 · 二次回路塑壳断路器',
  });

  /* ---- 第 50 轮：舱内二次控制柜上排补两只可插拔小型中间继电器 ----
     储能舱的 BMS / 消防 / 空调联锁回路点数少、投运后变更频繁，
     现场大量用可插拔小型继电器搭 —— 要改回路，拔下来换一只就行。
     ⚠️⚠️ 占位复核 —— **用真实宽度**（第 50 轮踩过「假设一只一槽」）：
        TS 22.5mm · **RML 75mm** · SS 12.5mm · RAI 45mm。
        x = (槽 - 3.5) × 0.045 ⇒
          TS(slot1)[-0.1238,-0.1013]  RML(slot4)[-0.015,0.060]
          SS(slot6)[ 0.1063, 0.1188]  RAI(slot8)[ 0.180,0.225]
        空段：[-0.1575,-0.1238] 34mm · [-0.1013,-0.015] 86mm
              · [0.060,0.1063] 46mm · [0.1188,0.180] 61mm。
        两只 RELAY_PLUG 放 -0.045（86mm 段）与 +0.083（46mm 段正中），
        离 RML 右沿 11.5mm、离 SS 左沿 11.8mm。 */
  mountElement(ctl, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#1', x: -0.045, y: RAIL_A, zBack: RAIL_FRONT,
    note: '二次控制柜 · 可插拔小型中间继电器（第 1 只：联锁回路）',
  });
  mountElement(ctl, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#2', x: 0.083, y: RAIL_A, zBack: RAIL_FRONT,
    note: '二次控制柜 · 可插拔小型中间继电器（第 2 只）',
  });
  /* meterUnit 的原点在**前脸**、机身向后 75mm：z = PLATE_Z 即穿板安装。 */
  mountElement(ctl, hotspots, 'METER', {
    x: 0.26, y: 1.76, z: PLATE_Z, note: '二次控制柜 · 数显仪表',
  });
  regElement(hotspots, 'TERMINAL', ctlTerm, {
    off: [0, 0.032, 0.02], quiet: true, note: '二次控制柜 · 二次端子排',
  });
  regElement(hotspots, 'DUCT', ctlDucts[0], {
    off: [0, 0.032, 0.02], quiet: true, note: '二次控制柜 · 走线槽',
  });
  regElement(hotspots, 'WIRE', ctlCable, {
    off: [0, 0.05, 0.02], quiet: true, note: '二次控制柜 · 二次线束',
  });
  /* ---------- 第 51 轮装、第 52 轮**修正位置**：面板型大件 ----------
     DTU 配电自动化终端 140×160×130，装**内装板**（真机常与后备电源箱一起装在柜内）。
     ⚠️⚠️⚠️ 两条必须同时满足：
       ① `mountElement(parent, …)` 的 `y` 是 **`ctl` 组的局部坐标**，不是世界坐标！
          `ctl.position.set(-0.60, Y0 + 0.20, 1.80)`，柜体世界偏移 **+0.5045**
          ⇒ 局部 0.85 才是世界 1.3545。（第 51 轮写的 `y: 1.27` 实际落在世界 1.7745，
          注释里那句「TERMINAL 世界顶 1.111 → 线槽 0.96 世界底 1.4445」是把局部当世界了。）
       ② 线槽**不登记热点**（`railfit_probe` 看不见），必须去源码抄：
          `ess.js` 里 `for (const dy of [0.74, 0.96, 1.28, 1.64, 1.86])`，各 40mm 高。
          ⇒ 第 51 轮的 1.27（盒 1.19~1.35）**正压在 1.28 那条线槽（1.26~1.30）上**。
     ⇒ 二次控制柜局部空带：113 / **180**（0.76~0.94）/ 70 / 59 / 118 / 71 mm。
        取 y = 0.85（盒 0.77~0.93），与上下两条线槽各留 10mm。 */
  mountElement(ctl, hotspots, 'DTU', {
    x: 0, y: 0.85, zBack: PLATE_Z + 0.002,
    note: '二次控制柜 · 配电自动化终端（遥测/遥信/遥控 + 通信，上传 EMS）',
  });
  ctl.userData.blankCulled = cullRailBlanks(ctl);

  /* ---------- 舱内照明（吸顶防爆灯） ----------
     ⚠️ 灯不能贴顶贴太低：电池簇顶面在 Y0+0.20+1.10+1.10 = 2.70，
     灯体 0.08 厚，挂到 2.77 才在簇顶之上留出 7mm 净空。 */
  for (const z of [-1.5, 0.6, 2.2]) {
    const lamp = rbox(0.60, 0.08, 0.14, 0.005, M.alu, 1);
    lamp.position.set(0, Y0 + CH - 0.12, z);
    root.add(lamp);
    const tube = rbox(0.50, 0.025, 0.09, 0.003, M.lampCool, 1);
    tube.position.set(0, Y0 + CH - 0.17, z);
    root.add(tube);
  }

  return {
    root,
    hotspots,
    env: 'outdoor',
    exposure: 0.98,
    fov: 48,
    fog: { color: 0xc2d6e6, near: 30, far: 160 },
    /* 机位偏右前方、接近舱轴方向（x 只偏 3.2m）：舱口只有 2.26m 宽、舱深 6m，
       斜着看等于对着左舱壁，什么都看不到。这个角度下透过舱口能看到
       z=0 处的电池簇、z=-1.6 的 PCS，以及 z=1.8 的二次控制柜（本公司产品）。 */
    camera: { pos: [1.60, 2.80, 8.40], target: [-0.30, 1.30, 0.90] },
    /* ---------- 自适应取景盒 ----------
       fov 模式：机位不动，只在舞台变窄时把视场角撑大 ——
       储能舱的看点是「透过舱口看舱内」，一后退舱口就只剩一条缝，绝不能退。
       parts 只列舱体与两台空调（必须完整入画的物件）；围栏、场坪、
       远树是环境，让它们自然裁切。aspect 0.89 下反解只需 35.4° < 场景的 48°，
       所以常规窗口画面完全不变，只有更窄的舞台才自动放宽。 */
    fit: {
      mode: 'fov',
      fovMax: 66,
      parts: [
        /* 舱体（含顶盖挑檐） */
        [-CW / 2 - 0.03, 0, BZ - 0.03, CW / 2 + 0.03, Y0 + CH + 0.12, FZ + 0.03],
        /* 舱外右侧壁的两台工业空调（ry=90°，厚度 0.45 沿 x、宽 0.90 沿 z）。
           ⚠️ 用展开符而不是在数组末尾 .flat() —— flat() 会把上面那个 6 元
           数组盒一起摊平成数字，parts 变成一堆裸数字，取景直接算错。 */
        ...[-1.30, 1.10].map((z) => [
          CW / 2 + 0.26 - 0.225, Y0 + 0.20, z - 0.45,
          CW / 2 + 0.26 + 0.225, Y0 + 0.20 + 1.40, z + 0.45,
        ]),
      ],
    },
    /* ⚠️ 这里**故意不写 minAz / maxAz** —— 「镜头自由」：
       墙/天花/地面都是单面板（法线朝内），相机绕到墙外时被背面剔除，
       直接看进室内；加了方位角限位反而把「绕到背后看一眼」禁掉。
       极角仍然限位：minPol 允许俯视，maxPol 压住别钻到地面以下。 */
    limits: { minPol: 0.05, maxPol: Math.PI * 0.667, minD: 0.12, maxD: 26 },
    lights: [
      { type: 'hemi', sky: 0xafd0ea, ground: 0x6f6c62, intensity: 0.72 },
      { type: 'ambient', color: 0xc2d6e6, intensity: 0.18 },
      {
        type: 'dir', color: 0xfff5e2, intensity: 2.05, pos: [-7.0, 8.6, 6.0], target: [0, 1.3, 0],
        shadow: true, shadowSize: 2048,
        shadowCam: { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 32 },
      },
      { type: 'dir', color: 0xd2e4f6, intensity: 0.42, pos: [6.5, 3.4, -5.0], target: [0, 1.3, 0] },
      /* 舱内补光：舱壁与舱顶都是实心的，天光进不去 —— 不给点光的话
         门打开后舱内是一片黑，等于白做舱内。三盏分别照门口、中段、后段。 */
      { type: 'point', color: 0xeef4ff, intensity: 15, pos: [0, Y0 + CH - 0.45, 2.30], distance: 9 },
      { type: 'point', color: 0xeef4ff, intensity: 16, pos: [0, Y0 + CH - 0.45, 0.60], distance: 9 },
      { type: 'point', color: 0xeef4ff, intensity: 13, pos: [0, Y0 + CH - 0.45, -1.60], distance: 9 },
    ],
  };
}
