/**
 * pv.js —— 户外场景：光伏升压站
 *
 * 这条场景把「一度绿电从组件走到电网」的链条摆出来：
 *   光伏支架与组件 → 直流汇流箱 → 逆变器 → 升压变 → 主变 → 开关柜/送出线路
 * 每一环都有本公司产品的落点：
 *   组件与汇流箱（TS 测组件/汇流箱温度）、逆变与升压（TE 电量、THC 温控、DTC 干变温控）、
 *   主变（TS 测油温/绕组温度）、送出（RML/RMY 电流电压监视）。
 *
 * ⚠️ 示意模型口径：
 *   · 尺寸取行业标准量级（组件 2278 × 1134 mm、倾角 30°、前后排间距 4.2 m、
 *     箱逆变一体机约 6.0 × 2.4 × 2.6 m），不是任何具体工程或厂商的尺寸；
 *   · 逆变器与变压器内部（功率模块、绕组、分接开关）一概不表达。
 */
import * as THREE from 'three';
import { M } from '../mats.js';
import {
  rbox, plate, cyl, bar, rot, doorPanel, dinRail, wireDuct, terminalRow,
  cableBundle, louverPanel, gland, handle, insulator,
} from '../parts.js';
import { buildProductModel } from '../product-models.js';
import {
  hotspot, placeOnRail, cullRailBlanks, mountElement, regElement,
  skyDome, utilityPole, powerLine, shrub, treeline,
} from '../scene-kit.js';
import { isolateMaterials } from '../mats.js';
import { canvasTex } from '../util.js';

/* ---------- 尺寸（行业标准量级） ---------- */
const BOX_L = 6.00;       // 箱逆变一体机长（x）
const BOX_D = 2.40;       // 深（z）
const BOX_H = 2.60;       // 高
const BOX_Y = 0.20;       // 基础高
const BOX_FZ = BOX_D / 2; // 箱体前表面 z
/* ⚠️ 布局约束（都是踩出来的）：
 *   ① 箱逆变一体机的三扇门都开在前侧，门扇绕铰点转 ~102° 后**朝前伸出门宽**，
 *      左门能扫到 x 再往左 0.5m、z 往前 2.3m 的范围 —— 光伏方阵必须留在这条
 *      扫掠区之外，否则门扇会插进组件板；
 *   ② 光伏支架前后两排跨度 4.2m、单排纵深 1.0m，摆位时要按「排中心 ±2.1 ±0.5」
 *      算包络，不能只按中心点估。 */
const BOX_X = 2.00;       // 箱体中心 x
const BOX_Z = -3.00;      // 箱体中心 z
const XFMR_X = 8.40;      // 主变中心 x
const XFMR_Z = -3.40;     // 主变中心 z
const CTRL_X = 4.60;      // 就地控制柜 x
const CTRL_Z = 0.90;      // 就地控制柜 z
const PV_W = 2 * 2.278 + 0.02;   // 一组方阵（2 列组件）的横向宽度
/* 场地东西向跨度 = 最西侧汇流箱西缘(-13.14) 到主变基础东缘(+11.00) ≈ 24.1m。
   ⚠️ 这个跨度**不再用来手算机位**：舞台宽高比随窗口尺寸、两侧栏折叠、
   沉浸模式在 0.72~1.32 之间变，任何写死的机位都只能对某一个比值调准
   （窄比值框不下、宽比值退太远）。改成在 build() 里声明 fit 取景盒，
   由 app.js 的 fitCamera() 按当前比值反解 —— 见下面 return 里的注释。 */
const PV_ROW_X = [-10.50, -5.40, -0.30];   // 三组方阵中心 x（单排，间距 5.1m）

/* ============================================================
 * 场坪
 * ============================================================ */
function site() {
  const g = new THREE.Group();

  /* 放大地面 / 路面时同步缩放 UV —— 贴图密度必须保持不变。
     texGrassG / texGravelG 的 repeat 是 [9,9]（mats.js 里写死），
     直接把面放大 5.75 倍会把草纹拉成一片糊。改 UV 的好处是
     **复用同一个 M.grass / M.gravel**，不新增材质，合批结果不变。 */
  const scaleUV = (geo, kx, kz) => {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * kx, uv.getY(i) * kz);
    uv.needsUpdate = true;
    return geo;
  };

  /* 场区：草地 + 检修碎石路（走在设备区背后，不压光伏方阵）
     ⚠️⚠️ 第 59 轮：这块草地原来只有 80×70（半跨 40 / 35m），
        而远景树线 treeline(72) 实测落在 **59.4~85.0m**、灌木最远到 70m
        —— 树和灌木**全在场坪之外**，出图看就是「一排树浮在半空、
        脚下是一条硬切的地平线」。修法不是把树拉近（树线退进 40m 会把
        柜体挤成画面正中一个小点），而是把地面铺到树线之外：
        460×440 的半跨 230 / 220m 已超过 fog.far=220，
        地平线由「草地边缘的硬边」变成「草地→雾色」的自然渐隐。 */
  const YARD_W = 460, YARD_D = 440;
  const yard = new THREE.Mesh(
    scaleUV(new THREE.PlaneGeometry(YARD_W, YARD_D), YARD_W / 80, YARD_D / 70), M.grass);
  rot(yard, -Math.PI / 2, 0, 0);
  yard.receiveShadow = true;
  g.add(yard);
  /* 检修路跟着加长：地面一放大，原来 x=±40 的路口就变成「草地中间断一截」。
     ⚠️ 已核对树线布点（seed 11 是确定性的）：路在 z=-9.00 时
        **没有一棵树落进 ±(2.1+1.6)m 走廊**（最近一棵横向 4.66m）。 */
  const road = new THREE.Mesh(
    scaleUV(new THREE.PlaneGeometry(YARD_W, 4.2), YARD_W / 80, 1), M.gravel);
  rot(road, -Math.PI / 2, 0, 0);
  road.position.set(0, 0.004, -9.00);
  road.receiveShadow = true;
  g.add(road);
  /* 设备区碎石铺装：只铺箱逆变 + 主变这一片，别盖到方阵下面
     （南缘 z=1.4 是量过的：近景方阵后立柱在 z=1.22，再往北就会铺到组件底下）。 */
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(14, 12), M.gravel);
  rot(pad, -Math.PI / 2, 0, 0);
  pad.position.set(6.50, 0.003, -4.80);
  pad.receiveShadow = true;
  g.add(pad);

  /* 主变基础：底板 + 抬高台座（油池沿口做成台座四周的一圈边沿） */
  const base = rbox(5.2, 0.20, 4.0, 0.012, M.concreteDark, 1);
  base.position.set(XFMR_X, 0.10, XFMR_Z);
  g.add(base);
  const plinth = rbox(4.8, 0.30, 3.6, 0.012, M.concrete, 1);
  plinth.position.set(XFMR_X, 0.15, XFMR_Z);
  g.add(plinth);

  /* 箱逆变一体机基础 */
  const b2 = rbox(BOX_L + 0.60, BOX_Y, BOX_D + 0.60, 0.010, M.concrete, 1);
  b2.position.set(BOX_X, BOX_Y / 2, BOX_Z);
  g.add(b2);

  /* 安全围栏：把方阵与设备区一起围起来，留出检修通道 */
  const X0 = -16.0, X1 = 13.5, Z0 = -12.0, Z1 = 9.0;
  const posts = [];
  const addPost = (x, z) => {
    const p = bar(0.055, 1.30, 0.055, M.steelBrushed);
    p.position.set(x, 0.65, z);
    g.add(p);
    posts.push([x, z]);
  };
  for (let x = X0; x <= X1 + 0.01; x += 3.1) { addPost(x, Z0); addPost(x, Z1); }
  for (let z = Z0; z <= Z1 + 0.01; z += 3.1) { addPost(X0, z); addPost(X1, z); }
  for (const [x0, z0, x1, z1] of [[X0, Z0, X1, Z0], [X0, Z1, X1, Z1]]) {
    for (const y of [1.18, 0.74, 0.28]) {
      const r = bar(x1 - x0, 0.042, 0.032, M.steelBrushed);
      r.position.set((x0 + x1) / 2, y, z0);
      g.add(r);
    }
  }
  for (const [x, z0, , z1] of [[X0, Z0, 0, Z1], [X1, Z0, 0, Z1]]) {
    for (const y of [1.18, 0.74, 0.28]) {
      const r = bar(0.032, 0.042, z1 - z0, M.steelBrushed);
      r.position.set(x, y, (z0 + z1) / 2);
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
    g2.fillText('升压站', 128, 220);
    g2.font = '700 21px "PingFang SC",sans-serif';
    g2.fillText('高压危险 · 禁止入内', 128, 264);
  });
  for (const x of [-6.0, 3.0]) {
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.42),
      new THREE.MeshStandardMaterial({ map: warnTex, roughness: 0.6, side: THREE.DoubleSide }));
    warn.position.set(x, 1.10, Z1 + 0.05);
    g.add(warn);
  }
  return g;
}

/* ============================================================
 * 箱逆变一体机：逆变器室 + 升压变室 + 高压室
 * 真实量级约 6.0 × 2.4 × 2.6 m，三室并列，门开在前侧。
 * ============================================================ */
function boxInverterStation() {
  const g = new THREE.Group();
  const L = BOX_L, D = BOX_D, H = BOX_H, t = 0.05;

  /* 底座 + 侧/后壁 + 顶 */
  const base = rbox(L, 0.10, D, 0.006, M.trimDark, 1);
  base.position.set(0, 0.05, 0);
  g.add(base);
  const back = plate(L, H, t, M.powderLight);
  back.position.set(0, H / 2, -D / 2 + t / 2);
  g.add(back);
  for (const sx of [1, -1]) {
    const s = plate(D, H, t, M.powderLight);
    rot(s, 0, Math.PI / 2, 0);
    s.position.set(sx * (L / 2 - t / 2), H / 2, 0);
    g.add(s);
    /* 侧面百叶（变压器室与逆变器室都要散热） */
    const lp = louverPanel(0.70, 0.90, { cols: 7, rows: 9 });
    lp.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    lp.position.set(sx * (L / 2 + 0.003), H * 0.46, 0);
    g.add(lp);
  }
  /* 顶（微坡）+ 檐口 */
  const rise = 0.14;
  const half = D / 2;
  const ang = Math.atan2(rise, half);
  const slope = Math.hypot(half, rise);
  for (const sz of [1, -1]) {
    const p = rbox(L + 0.16, 0.05, slope, 0.006, M.powderMid, 1);
    rot(p, sz * ang, 0, 0);
    p.position.set(0, H + rise / 2, sz * half / 2);
    g.add(p);
  }
  const ridge = bar(L + 0.16, 0.05, 0.10, M.trimDark);
  ridge.position.set(0, H + rise + 0.01, 0);
  g.add(ridge);

  /* 三室隔墙 + 门（都打开，露出内部） */
  const SEAM = [-L / 2 + 2.40, L / 2 - 1.80];    // 逆变器室 | 变压器室 | 高压室
  for (const x of SEAM) {
    const p = plate(D - 0.02, H - 0.10, 0.04, M.powderMid);
    rot(p, 0, Math.PI / 2, 0);
    p.position.set(x, H / 2, 0);
    g.add(p);
  }
  const rooms = [
    { x0: -L / 2, x1: SEAM[0], title: '逆变器室', sub: 'INVERTER' },
    { x0: SEAM[0], x1: SEAM[1], title: '升压变室', sub: 'TRANSFORMER' },
    { x0: SEAM[1], x1: L / 2, title: '高压室', sub: 'HV' },
  ];
  rooms.forEach((r) => {
    const w = r.x1 - r.x0 - 0.08;
    const cx = (r.x0 + r.x1) / 2;
    const dh = H - 0.30;
    const d = doorPanel({
      w, h: dh, t: 0.018,
      mat: M.powderLight,
      windows: r.sub === 'INVERTER' ? [] : [{ x: 0, y: 0.34, w: 0.24, h: 0.20 }],
      handle: { x: w / 2 - 0.10, y: -0.06 },
      lock: { x: w / 2 - 0.10, y: -0.30 },
      plate: { x: -w / 2 + 0.26, y: dh / 2 - 0.20, w: 0.30, h: 0.11, title: r.title, sub: r.sub },
      hinges: [-0.62, 0, 0.62],
      hingeSide: -1,
    });
    const pivot = new THREE.Group();
    pivot.position.set(r.x0 + 0.04, 0.14 + dh / 2, D / 2 + 0.004);
    d.position.set(w / 2, 0, 0);
    pivot.add(d);
    pivot.rotation.y = -1.78;              // 门扇朝 +x 伸出 → 负角往箱前开
    /* 可开合（见 app.js 的 collectDoors）：铰点在隔室左边缘、门扇落在门洞上，
       rotation.y = 0 即关闭。 */
    pivot.userData.door = { open: -1.78, closed: 0 };
    pivot.userData.explode = [0, 0, 0.60];
    g.add(pivot);
  });

  /* 顶部吊装环 */
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 16), M.steelBrushed);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx * L * 0.36, H + rise + 0.06, sz * D * 0.30);
      g.add(ring);
    }
  }
  return { group: g, SEAM, rooms };
}

/* ============================================================
 * 就地控制柜（本公司产品的落点）
 * ============================================================ */
/**
 * 升压站就地控制柜（落地式 800×2200×600）
 *
 * 导出给 wind.js 复用 —— 光伏与风电升压站的二次控制柜是同一种柜型，
 * 没必要在两个场景里各写一份（两份会各自漂移，改了一个忘另一个）。
 * `title` / `sub` 是门上的铭牌文字，默认按光伏写，风电场景传自己的。
 *
 * `hinge`：门铰在哪一侧。1 = 铰在右侧、往右开（默认）；-1 = 铰在左侧、往左开。
 * ⚠️ 并柜时必须一左一右：两只柜并在一起、门都往同一边开的话，
 * 左边那只的门扇（开足后横伸 0.52m）会正好挡在右边那只的柜面前，
 * 右边柜里的元件就全被遮住了 —— 并柜的两只必须往外开。
 */
export function controlCabinet({ title = '就地控制柜', sub = 'PV CTRL', hinge = 1 } = {}) {
  const W = 0.80, H = 2.20, D = 0.60;
  const g = new THREE.Group();

  const base = rbox(W, 0.06, D, 0.004, M.powderDark, 1);
  base.position.y = 0.03;
  g.add(base);
  const back = plate(W, H, 0.018, M.powderLight);
  back.position.set(0, H / 2, -D / 2 + 0.009);
  g.add(back);
  for (const sx of [1, -1]) {
    const s = plate(D, H, 0.018, M.powderLight);
    rot(s, 0, Math.PI / 2, 0);
    s.position.set(sx * (W / 2 - 0.009), H / 2, 0);
    g.add(s);
  }
  const top = plate(W, D, 0.018, M.powderMid);
  rot(top, Math.PI / 2, 0, 0);
  top.position.set(0, H - 0.009, 0);
  g.add(top);

  const d = doorPanel({
    w: W - 0.03, h: H - 0.10, t: 0.016,
    windows: [{ x: 0, y: 0.40, w: 0.30, h: 0.22 }],
    handle: { x: -hinge * (W / 2 - 0.09), y: 0 },
    plate: { x: 0, y: H / 2 - 0.28, w: 0.30, h: 0.11, title, sub },
    hinges: [-0.60, 0, 0.60],
    hingeSide: hinge,
  });
  const pivot = new THREE.Group();
  pivot.position.set(hinge * (W / 2 - 0.015), H / 2, D / 2 + 0.004);
  d.position.set(-hinge * (W - 0.03) / 2, 0, 0);
  pivot.add(d);
  pivot.rotation.y = hinge * 1.74;
  pivot.userData.door = { open: hinge * 1.74, closed: 0 };
  pivot.userData.explode = [0, 0, 0.55];
  g.add(pivot);

  const RAIL_A = 1.52, RAIL_B = 1.16;
  const PLATE_Z = -0.02;
  const mp = plate(W - 0.10, 1.40, 0.004, M.powderWhite);
  mp.position.set(0, 1.36, PLATE_Z);
  g.add(mp);
  for (const ry of [RAIL_A, RAIL_B]) {
    const r = dinRail(W - 0.16);
    r.position.set(0, ry, PLATE_Z + 0.024);
    g.add(r);
  }
  const ducts = [];
  for (const dy of [1.98, 1.74, 1.34, 1.00, 0.76]) {
    const du = wireDuct(W - 0.16, 0.042, 0.030);
    du.position.set(0, dy, PLATE_Z + 0.024);
    g.add(du);
    ducts.push(du);
  }
  const tr = terminalRow(18, { w: 0.0072, h: 0.046, d: 0.042 });
  tr.position.set(0, 0.62, PLATE_Z + 0.022);
  g.add(tr);
  const cb = cableBundle(5, 0.30, { r: 0.0045, spread: 0.05 });
  cb.position.set(0, 0.52, PLATE_Z + 0.01);
  g.add(cb);

  return { group: g, RAIL_A, RAIL_B, RAIL_FRONT: PLATE_Z + 0.029, PLATE_Z, ducts, tr, cb };
}

/* ============================================================
 * 场景构建
 * ============================================================ */
export function build() {
  const root = new THREE.Group();
  const hotspots = [];

  /* ⚠️ 把**投影主光的方向**传给天空：否则天空左右对称，
     而地上的影子却朝一边倒 —— 光和天对不上，一眼就假。 */
  root.add(skyDome(200, { sun: [-9.0, 13.0, 10.0] }));

  /* ---------- 远景：电杆 + 导线 + 树线 + 灌木 ---------- */
  const far = new THREE.Group();
  const poles = [];
  [[-16, 1.15, -20], [-2, 1.30, -26], [13, 1.40, -31]].forEach(([x, s, z]) => {
    const p = utilityPole(9.0 * s, { arms: 2 });
    p.position.set(x, 0, z);
    p.scale.setScalar(s);
    far.add(p);
    poles.push({ x, z, s });
  });
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    for (let k = 0; k < 4; k++) {
      const yA = 9.0 * a.s * (0.88 - Math.floor(k / 2) * 0.09);
      const yB = 9.0 * b.s * (0.88 - Math.floor(k / 2) * 0.09);
      far.add(powerLine(
        new THREE.Vector3(a.x + (k % 2 ? 0.5 : -0.5) * a.s, yA + 0.11, a.z),
        new THREE.Vector3(b.x + (k % 2 ? 0.5 : -0.5) * b.s, yB + 0.11, b.z),
        { sag: 1.4, r: 0.024 }
      ));
    }
  }
  for (let i = 0; i < 34; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 24 + Math.random() * 46;
    const s = shrub(0.9 + Math.random() * 0.9, i * 0.61);
    s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.75 - 10);
    far.add(s);
  }
  far.add(treeline(72, 72, { minH: 3.4, maxH: 8.2, seed: 11 }));
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

  /* ---------- 光伏方阵：三组排成一行 ----------
     中心 x = -10.5 / -5.4 / -0.3（间距 5.1m = 单组宽 4.576 + 0.52 缝），
     排中心 z = 3.40。整排包络 x ∈ [-12.79, 1.91]，z ∈ [1.22, 5.58]。
     与箱逆变一体机（x ≥ -1、z ≤ -1.8）和它前开门扇的扫掠区（z ≤ 0.47）都不相交。
     前两组带发光标记，第三组只登记热点（quiet + marker:false）——
     它离机位最近、旁边就是设备区，标记点会和箱逆变的标签抢位置。 */
  PV_ROW_X.forEach((x, i) => {
    const quiet = i === 2;
    mountElement(root, hotspots, 'PVTABLE', {
      x, y: 0.0, z: 3.40,
      build: { rows: 2, cols: 2, tilt: 30, gap: 4.20 },
      key: `PVTABLE#${i + 1}`,
      quiet, marker: !quiet,
      off: [0, 1.30, 0.20],
      note: `光伏方阵 ${i + 1} · 固定式支架与组件（倾角 30°，组件板外形示意）`,
    });
  });

  /* ---------- 直流汇流箱（挂在方阵立柱上） ---------- */
  for (const [i, x] of [-10.50, -5.40].entries()) {
    const px = x - PV_W / 2 - 0.30;
    const pz = 3.40 + 1.60;
    const pole = bar(0.08, 1.60, 0.08, M.aluDark);
    pole.position.set(px, 0.80, pz);
    root.add(pole);
    mountElement(root, hotspots, 'COMBINER', {
      x: px, y: 1.30, z: pz,
      key: `COMBINER#${i + 1}`,
      off: [0, 0.46, 0.20],
      note: `汇流箱 ${i + 1} · 直流侧组串汇流（8~24 进 1 出）`,
    });
  }

  /* ---------- 箱逆变一体机 ---------- */
  const B = boxInverterStation();
  B.group.position.set(BOX_X, BOX_Y, BOX_Z);
  B.group.userData.explode = [0, 0, 0.30];
  root.add(B.group);

  const INV_X = (B.rooms[0].x0 + B.rooms[0].x1) / 2;
  const XF_X = (B.rooms[1].x0 + B.rooms[1].x1) / 2;
  const HV_X = (B.rooms[2].x0 + B.rooms[2].x1) / 2;

  mountElement(B.group, hotspots, 'INVERTER', {
    x: INV_X, y: BOX_H / 2, z: -0.30,
    off: [0, 1.15, 0.10],
    note: '逆变器室 · 光伏逆变器（直流→交流）',
  });
  mountElement(B.group, hotspots, 'XFMR', {
    /* ⚠️ dryTransformer 的原点在**底面**（不是几何中心），y 要给箱内地板标高。
       箱体底座 rbox 高 0.10、顶面即箱内地板，所以 y = 0.10（相对 B.group）。 */
    x: XF_X, y: 0.10, z: -0.20,
    build: { w: 1.30, h: 1.50, d: 0.90 },
    off: [0, 0.90, 0.20],
    note: '升压变室 · 升压变压器（0.4kV → 10/35kV）',
  });
  mountElement(B.group, hotspots, 'LBS', {
    x: HV_X, y: 1.55, z: -0.10,
    build: { w: 0.55, h: 0.62, d: 0.50 },
    off: [0, 0.42, 0.10],
    note: '高压室 · 负荷开关（送出回路）',
  });
  mountElement(B.group, hotspots, 'FUSE', {
    x: HV_X - 0.24, y: 0.90, z: 0.10, note: '高压室 · 高压限流熔断器',
  });
  mountElement(B.group, hotspots, 'SPD', {
    x: HV_X + 0.24, y: 0.85, z: 0.10, note: '高压室 · 氧化锌避雷器',
  });
  mountElement(B.group, hotspots, 'TEMPCTRL', {
    x: XF_X + 0.42, y: 1.55, z: BOX_FZ - 0.14, note: '升压变室 · 温湿度控制器（通用）',
  });
  mountElement(B.group, hotspots, 'FAN', {
    x: XF_X - 0.44, y: 1.70, z: BOX_FZ - 0.16, note: '升压变室 · 轴流风扇（变压器散热）',
  });
  mountElement(B.group, hotspots, 'MCCB', {
    x: INV_X + 0.42, y: 1.45, z: BOX_FZ - 0.14,
    build: { w: 0.075, h: 0.13, d: 0.07 },
    note: '逆变器室 · 辅助回路塑壳断路器',
  });

  /* ---------- 主变压器（油浸式） ----------
     ⚠️ oilTransformer 的原点在**几何中心**，底部钢轨在 y = -0.46h - 0.05。
     台座顶面标高 0.30 → 中心 y = 0.30 + 0.46×2.40 + 0.05 = 1.45。 */
  mountElement(root, hotspots, 'OILXFMR', {
    x: XFMR_X, y: 0.30 + 2.40 * 0.46 + 0.05, z: XFMR_Z,
    build: { w: 2.60, h: 2.40, d: 1.70 },
    off: [0, 1.35, 0.40],
    note: '主变区 · 升压主变压器（油浸式，油温由 TS/DTC 采集）',
  });

  /* ---------- 就地控制柜（本公司产品的落点） ---------- */
  const CTL = controlCabinet();
  CTL.group.position.set(CTRL_X, 0, CTRL_Z);
  CTL.group.userData.explode = [0, 0, 0.30];
  root.add(CTL.group);
  regElement(hotspots, 'LCP', CTL.group, {
    off: [0, 1.15, 0.06],
    note: '升压站就地控制柜（本公司二次元件集中安装处）',
  });

  function mount(id, railY, slotIndex, note) {
    const p = buildProductModel(id);
    const x = (slotIndex - 4) * 0.045;
    placeOnRail(p, { x, y: railY, zBack: CTL.RAIL_FRONT });
    p.rotation.y = 0;
    isolateMaterials(p);
    p.userData.pid = id;
    CTL.group.add(p);
    hotspots.push(hotspot(id, p, { offset: [0, 0.030, 0.02], note }));
    return p;
  }
  mount('TE', CTL.RAIL_A, 1, '就地控制柜 · 电量变送器（发电量/功率上传）');
  mount('TS', CTL.RAIL_A, 4, '就地控制柜 · 温度变送器（主变油温/绕组温度）');
  mount('DTC', CTL.RAIL_A, 7, '就地控制柜 · 干变温控器（升压变绕组温度与风机控制）');
  mount('RML', CTL.RAIL_B, 2, '就地控制柜 · 交流电流继电器（送出线路电流监视）');
  mount('RMY', CTL.RAIL_B, 6, '就地控制柜 · 交流电压继电器（并网点电压监视）');
  /* ⚠️ THC 是**本公司产品**，必须走 mount()（buildProductModel + isolateMaterials），
     不能走 mountElement() —— 后者查的是 ELEMENT_BUILDERS，THC 不在表里，
     会静默退化成 80mm 的兜底小方盒，卡片却是真产品档案。 */
  mount('THC', CTL.RAIL_B, 8, '就地控制柜 · 柜内防凝露加热控制（温湿度控制器）');

  mountElement(CTL.group, hotspots, 'PSU_G', {
    x: -0.30, y: CTL.RAIL_B, zBack: CTL.RAIL_FRONT, note: '就地控制柜 · 二次回路开关电源',
  });

  /* ---- 第 50 轮：就地控制柜补「通用做法」那一组 ----
     光伏场区站点分散、无人值守，**备件统一性**比什么都重要 ——
     现场常见的就是可插拔小继电器 + 一只逻辑继电器，而不是一堆专用件。
     ⚠️⚠️ 占位复核 —— **用真实宽度**（TE 45 / TS **22.5** / **DTC 96** / RML 75 /
        RMY 75 / **THC 90** / PSU_G 55；第 50 轮踩过「假设一只一槽 45mm」）：
        RAIL_A：TE(slot1)[-0.1575,-0.1125]  TS(slot4)[-0.0113,0.0113]
                DTC(slot7)[ 0.0870, 0.1830]
                ⇒ 空段 [-0.32,-0.1575] · [-0.1125,-0.0113] 101mm · [0.0113,0.087] 76mm
        RAIL_B：RML(slot2)[-0.1275,-0.0525]  RMY(slot6)[0.0525,0.1275]
                THC(slot8)[ 0.1350, 0.2250]  PSU_G(-0.30, 55mm)[-0.3275,-0.2725]
                ⇒ 空段 [-0.0525, 0.0525]（LOGO 72mm 正好放正中） */
  mountElement(CTL.group, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#1', x: -0.072, y: CTL.RAIL_A, zBack: CTL.RAIL_FRONT,
    note: '就地控制柜 · 可插拔小型中间继电器（第 1 只）',
  });
  mountElement(CTL.group, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#2', x: -0.044, y: CTL.RAIL_A, zBack: CTL.RAIL_FRONT,
    note: '就地控制柜 · 可插拔小型中间继电器（第 2 只）',
  });
  /* ---------- 第 52 轮：就地人机界面 ----------
     `data.js` 的 `pv.elements` 一直声明着 `HMI`。
     ⚠️⚠️ 落点先算空带（`hotspots.json` 实测，就地控制柜 x 4.20~5.00）：
         WIRE 0.217~0.522 / TERMINAL 0.597~0.652 / RAIL_B 器件 1.114~1.206 /
         RAIL_A 器件 1.474~1.566 / METER 1.876~1.924 / DUCT 1.965~1.998。
         ⇒ 空带 **1.566~1.876（308mm）** 是最大的一条。
         HMI 200×150×45 取 y = 1.72（盒 1.645~1.795），上留 81mm、下留 79mm。
     ⚠️ `LBS`（1.372~2.128）的包围盒 x 到 4.375，而 HMI 宽 200mm 落在 4.50~4.70
        ⇒ x 上不重叠，可以同层。 */
  mountElement(CTL.group, hotspots, 'HMI', {
    x: 0, y: 1.72, zBack: CTL.PLATE_Z,
    note: '就地控制柜 · 就地人机界面（触摸屏：发电量、主变温度、告警集中显示）',
  });
  mountElement(CTL.group, hotspots, 'LOGO', {
    /* 72mm 宽 ≈ 1.6 槽，落在 RAIL_B 中段空档 [-0.0675, +0.0675] 正中 */
    x: 0.0, y: CTL.RAIL_B, zBack: CTL.RAIL_FRONT,
    note: '就地控制柜 · 可编程逻辑继电器（逆变器启停与联锁逻辑就地实现，不依赖上位机）',
  });
  /* meterUnit 的原点在**前脸**、机身向后 75mm —— 给 z = PLATE_Z 就是穿板安装
     （表面齐平、机身在内装板背后），给 +0.06 会浮在板前 6cm。 */
  mountElement(CTL.group, hotspots, 'METER', {
    x: 0.30, y: 1.90, z: CTL.PLATE_Z, note: '就地控制柜 · 数显仪表',
  });
  regElement(hotspots, 'TERMINAL', CTL.tr, {
    off: [0, 0.032, 0.02], quiet: true, note: '就地控制柜 · 二次端子排',
  });
  regElement(hotspots, 'DUCT', CTL.ducts[0], {
    off: [0, 0.032, 0.02], quiet: true, note: '就地控制柜 · 走线槽',
  });
  regElement(hotspots, 'WIRE', CTL.cb, {
    off: [0, 0.05, 0.02], quiet: true, note: '就地控制柜 · 二次线束',
  });
  CTL.group.userData.blankCulled = cullRailBlanks(CTL.group);

  /* ---------- 主变侧的避雷器与接地 ---------- */
  mountElement(root, hotspots, 'SPD', {
    x: XFMR_X - 4.40, y: 1.10, z: XFMR_Z - 1.70,
    build: { r: 0.045, h: 0.90 },
    key: 'SPD#2',
    off: [0, 0.55, 0.10],
    note: '主变高压侧 · 氧化锌避雷器（限制过电压）',
  });
  /* 接地干线：走在设备区与方阵之间的空地（z = 2.60）。
     西端必须落在 x = 1.2 以东 —— 近景方阵 B 的东缘在 x = 0.39，
     再往西铺就会横穿支架立柱。 */
  const gnd = new THREE.Group();
  const gndRun = bar(7.4, 0.05, 0.012, M.copper);
  gndRun.position.set(6.00, 0.30, 2.60);
  gnd.add(gndRun);
  const gndStake = cyl(0.020, 0.020, 0.70, M.copper, 10);
  gndStake.position.set(9.70, 0.35, 2.60);
  gnd.add(gndStake);
  root.add(gnd);
  /* ⚠️ 不给 quiet：接地干线贴地铺、前方无遮挡（quiet_audit.js 射线复核过）。
     它与「示意元件」那批地面设施一样，是能看见的实物，标签该出。 */
  regElement(hotspots, 'GNDBAR', gnd, {
    off: [0, 0.22, 0.02], note: '升压站 · 接地干线（连主变与设备区接地网）',
  });

  /* ---------- 出线构架（门型架）+ 送出线路 ----------
     构架站到设备区**背后**（z = -6.2）：主变基础南缘到 z = -1.4、
     箱逆变到 z = -1.8，放在中间会压基础；背后既避得开，又能让导线
     从箱逆变顶 → 构架 → 远方电杆形成一条完整视线。 */
  const gantry = new THREE.Group();
  for (const x of [-1.4, 1.4]) {
    const col = bar(0.14, 5.60, 0.14, M.steelBrushed);
    col.position.set(x, 2.80, 0);
    gantry.add(col);
  }
  const beam = bar(3.2, 0.16, 0.16, M.steelBrushed);
  beam.position.set(0, 5.50, 0);
  gantry.add(beam);
  for (const x of [-1.0, 0, 1.0]) {
    const ins = insulator(0.30, M.pcBeige);
    ins.position.set(x, 5.34, 0);
    gantry.add(ins);
  }
  gantry.position.set(4.40, 0, -6.20);
  root.add(gantry);

  const outA = new THREE.Vector3(BOX_X + BOX_L / 2 + 0.30, BOX_Y + BOX_H + 0.20, BOX_Z + 0.40);
  const outM = new THREE.Vector3(4.40, 5.45, -6.20);
  const outB = new THREE.Vector3(-2.0, 9.0 * 1.30 * 0.88, -26);
  root.add(powerLine(outA, outM, { sag: 0.55, r: 0.026 }));
  /* 远送出线：只负责画面纵深，**不参与「全景」取景**。
     ⚠️ 它一路拉到 z = -26，并进包围盒会把整个升压站框成画面正中一个小点
        （实测取景盒被它撑到 31.8m 深，站内设备只剩 5% 画幅）。
        短的那段（箱逆变 → 龙门架）保留，那是站内看得见的部分。 */
  const outLine = powerLine(outM, outB, { sag: 1.6, r: 0.026 });
  outLine.userData.scenery = true;
  root.add(outLine);

  return {
    root,
    hotspots,
    env: 'outdoor',
    exposure: 1.00,
    /* 场区横跨 24m，用默认 38° 会切掉两侧，56° 才能把方阵与升压站同时框住。 */
    fov: 56,
    fog: { color: 0xc6dcee, near: 45, far: 220 },
    /* camera 只作**兜底**：真正用的机位由下面的 fit 盒按舞台宽高比反解。
       这里的数字是 aspect 0.89（最窄的常见舞台）下反解出来的结果，改布局要同步。 */
    camera: { pos: [-14.54, 9.36, 15.48], target: [-4.00, 2.50, -0.15] },
    /* ---------- 自适应取景盒 ----------
       parts 列的是「必须完整入画」的物件，坐标全部由上面的布局常量推出，
       不另写死数字 —— 否则以后挪了主变或方阵，这里会悄悄失配而没人发现。
       方向取「西前方 方位 −34°、仰角 20°」：场地东西向 24m 而舞台是竖长的，
       正前方要退到 27m 才框得住，斜视借透视缩短横向跨度，20.1m 就够。
       各舞台宽高比下的反解距离（已验算）：
         0.72 → 24.6m   0.89 → 20.2m   1.10 → 20.1m   1.32 → 20.1m
       1.0 以上不再变，因为那时绑定约束从「横向」换成了「竖向」。 */
    fit: {
      mode: 'dist',
      dir: [-0.5255, 0.3420, 0.7790],
      aim: [-4.00, 2.50, -0.15],
      pad: 1.06,
      parts: [
        /* 三组光伏方阵（前后两排的包络：排中心 z 3.40 ± 2.6） */
        ...PV_ROW_X.map((x) => [x - PV_W / 2, 0, 0.80, x + PV_W / 2, 1.55, 6.00]),
        /* 两组汇流箱立柱（西侧最外沿，是横向的绑定约束） */
        ...[-10.50, -5.40].map((x) => {
          const px = x - PV_W / 2 - 0.30;
          return [px - 0.05, 0, 4.96, px + 0.05, 1.75, 5.04];
        }),
        /* 箱逆变一体机 */
        [BOX_X - BOX_L / 2, BOX_Y, BOX_Z - BOX_D / 2,
          BOX_X + BOX_L / 2, BOX_Y + BOX_H, BOX_Z + BOX_D / 2],
        /* 主变基础（底板 5.2×4.0）与主变本体（含散热片，宽 3.9） */
        [XFMR_X - 2.60, 0, XFMR_Z - 2.00, XFMR_X + 2.60, 0.45, XFMR_Z + 2.00],
        [XFMR_X - 1.95, 0.45, XFMR_Z - 0.85, XFMR_X + 1.95, 2.85, XFMR_Z + 0.85],
        /* 就地控制柜（本公司产品的落点，必须看得见） */
        [CTRL_X - 0.40, 0, CTRL_Z - 0.30, CTRL_X + 0.40, 2.25, CTRL_Z + 0.30],
        /* 出线构架（门型架，竖向最高件） */
        [4.40 - 1.60, 0, -6.30, 4.40 + 1.60, 5.70, -6.10],
      ],
    },
    /* ⚠️ 这里**故意不写 minAz / maxAz** —— 「镜头自由」：
       墙/天花/地面都是单面板（法线朝内），相机绕到墙外时被背面剔除，
       直接看进室内；加了方位角限位反而把「绕到背后看一眼」禁掉。
       极角仍然限位：minPol 允许俯视，maxPol 压住别钻到地面以下。 */
    limits: { minPol: 0.05, maxPol: Math.PI * 0.667, minD: 0.12, maxD: 46 },
    lights: [
      { type: 'hemi', sky: 0xb6d8f2, ground: 0x74705f, intensity: 0.80 },
      { type: 'ambient', color: 0xc6dcee, intensity: 0.22 },
      {
        type: 'dir', color: 0xfff8ea, intensity: 2.30, pos: [-9.0, 13.0, 10.0], target: [0, 1.4, -1],
        shadow: true, shadowSize: 2048,
        shadowCam: { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 46 },
      },
      { type: 'dir', color: 0xd6e8f8, intensity: 0.46, pos: [9.0, 4.0, -7.0], target: [0, 1.4, 0] },
    ],
  };
}
