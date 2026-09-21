/**
 * wind.js —— 户外场景：风电升压站
 *
 * 链条：风机 → 塔基箱变 → 35kV 集电线路 → 升压站主变 → 110kV 送出线路。
 * 本公司产品的落点集中在「就地控制柜」里：集电线路的电量与电流电压监视、
 * 主变油温与绕组温度、分接开关挡位、柜内防凝露 —— 逻辑与光伏升压站同源，
 * 但风电场更冷、更潮，加热除湿的分量更重（THC + 加热器是这一场的重点）。
 *
 * ⚠️ 示意模型口径（与手册、场景说明一致）：
 *   · 尺寸取行业标准量级（1.5MW 级风机：轮毂高 65m、风轮直径 82m、含叶尖 106m；
 *     20ft 级预制二次设备舱 6.0 × 2.8 × 3.0 m；主变 2.6 × 2.4 × 1.7 m；
 *     门型构架柱距 3.2m），不是任何具体工程或厂商的尺寸；
 *   · 风机只做「塔筒 / 机舱 / 轮毂 / 叶片」四件套，机舱内部、偏航与变桨机构一概不表达；
 *   · 主变内部（器身、绕组、分接开关）与二次屏柜内部接线一概不表达；
 *   · 风机是**远景剪影**：它们在地平线上交代「这是风电场」，不参与近景交互细节。
 */
import * as THREE from 'three';
import { M, TEX, isolateMaterials } from '../mats.js';
import {
  rbox, cyl, bar, rot, insulator,
} from '../parts.js';
import { buildProductModel } from '../product-models.js';
import { buildElement } from '../elements.js';
import {
  hotspot, placeOnRail, cullRailBlanks, mountElement, regElement,
  skyDome, utilityPole, powerLine, shrub, treeline,
} from '../scene-kit.js';
import { canvasTex } from '../util.js';
import { controlCabinet } from './pv.js';

/* ============================================================
 * 尺寸（行业标准量级）
 * ============================================================ */
const HUT_L = 6.00;       // 预制二次设备舱 长（x）
const HUT_D = 2.80;       // 宽（z）
const HUT_H = 3.00;       // 高
const HUT_OPEN = 2.60;    // 正面开口宽（要能同时看见舱内两台屏柜）

const XF_W = 2.60;        // 主变本体宽（含散热片约 3.9）
const XF_H = 2.40;        // 本体高
const XF_D = 1.70;        // 本体深

/* ---------- 平面布置（俯视；+z 朝观察者，+x 朝右） ----------
 *
 *   z=-540 ………………………… 风机（远景剪影 4 台，x 从 -30 到 215）
 *   z=-6.60              [出线构架]        ← 110kV 送出
 *   z=-5.60   [进线构架]                    ← 35kV 集电线路进线
 *   z=-2.80              [主变]  [就地控制柜]
 *   z=+1.20   [预制二次设备舱]
 *
 * 横向总跨度 13.3m（-8.6 … +4.72）。比光伏场区（24m）紧得多 ——
 * 升压站本来就是集中布置的，设备离得近，屏幕上也就更大更清楚。
 */
const HUT_X = -5.60, HUT_Z = 1.20;      // 预制二次设备舱
const XF_X = 0.60, XF_Z = -2.80;        // 主变（含基础 / 油池）
const GAN_X = 0.60, GAN_Z = -6.60;      // 出线构架（送出）
const INC_X = -5.20, INC_Z = -5.60;     // 进线构架（集电线路）
const LCP_X = 3.90, LCP_Z = -1.60;      // 就地控制柜（双柜并柜）

/* ---------- 风机阵列（远景剪影） ----------
 * ⚠️ 摆位是算过的，不是随手放的（验算脚本 .workbuddy-ai/tmp/wind_solve.py）：
 *   · 风机**不在 fit 取景盒里** —— 它们远在 500m 外，塞进去会把机位逼到几百米外，
 *     近景全成蚂蚁。所以靠「够远 + 仰角留余量」保证入画，必须单独验：
 *     最差舞台（aspect 0.72）下四台的视锥占用率是 0.70~0.78，都留了 20% 以上余量。
 *   · 塔顶 106m、相机俯视 10°：1 号风机叶尖的竖向占用 0.732，还有 27% 天顶余量。
 *   · 横向按「500m 处可视 x ∈ [-70, 260]」摆（由 aspect 0.72 的水平半视场推出）。
 *   · 每台给不同的 spin（叶片转角），否则四台一模一样、一眼假。
 *     但 yaw 只给 ±0.1 rad（±6°）的小差异 —— 真实风场里所有机组对着**同一个风向**，
 *     给成 ±20° 的随机角会看成「四台各自乱转」，反而不真实。 */
const TURBINES = [
  { x: -30, z: -540, yaw: 0.09, spin: 0.45 },
  { x: 45, z: -470, yaw: 0.02, spin: 1.95 },
  { x: 130, z: -555, yaw: -0.05, spin: 3.05 },
  { x: 215, z: -500, yaw: 0.06, spin: 0.90 },
];

/* ============================================================
 * 场坪
 * ============================================================ */
function site() {
  const g = new THREE.Group();

  /* 远景大地面 —— 风机在 500m 开外，地面必须一直铺到地平线，
     否则风机会「悬在天空里」。
     ⚠️ 不能直接改 M.grass.map.repeat：那是**全局共享贴图**，改了会把其他
     户外场景（箱变 / 环网柜 / 光伏）的草地一起变成模糊大色块。
     clone() 出来的贴图与原贴图共享 image、但 transform 独立。
     ⚠️ 还有一处坑：Texture.clone() 会把 userData 一起深拷贝，于是副本也带上
     `shared: true` —— disposeTree 会把它当共享资源跳过，每切一次场景就漏一张贴图。
     必须显式删掉。 */
  const gt = TEX.grass.clone();
  delete gt.userData.shared;
  gt.repeat.set(280, 280);        // 2800m / 280 = 10m 一格，与 pv 的草地密度一致
  gt.anisotropy = 8;              // 大地面在掠射角上最容易出摩尔纹
  gt.needsUpdate = true;
  const farMat = new THREE.MeshStandardMaterial({ map: gt, roughness: 0.96, metalness: 0 });
  const far = new THREE.Mesh(new THREE.PlaneGeometry(2800, 2800), farMat);
  rot(far, -Math.PI / 2, 0, 0);
  far.position.y = -0.02;         // 压到站区铺装之下，避免与场坪共面闪烁
  far.receiveShadow = false;      // 阴影相机只覆盖 ±26m，这面 2.8km 的板没必要参与
  g.add(far);

  /* 站区碎石场坪（比草地细，一铺就知道「这里是设备区」） */
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), M.gravel);
  rot(pad, -Math.PI / 2, 0, 0);
  pad.position.set(-2.20, 0.002, -2.00);
  pad.receiveShadow = true;
  g.add(pad);

  /* 进站道路：从围栏大门（z = 5.4）一直往南接场外道路，正对门洞 */
  const road = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 53), M.gravel);
  rot(road, -Math.PI / 2, 0, 0);
  road.position.set(-2.20, 0.004, 31.9);
  road.receiveShadow = true;
  g.add(road);

  /* 安全围栏：把站区围起来，南侧（对着进站道路那一面）留 4.8m 的大门 */
  const X0 = -10.4, X1 = 6.4, Z0 = -10.2, Z1 = 5.4;
  const GX0 = -4.60, GX1 = 0.20;        // 门洞 x 区间（道路正对这里）
  const addPost = (x, z) => {
    const p = bar(0.055, 1.30, 0.055, M.steelBrushed);
    p.position.set(x, 0.65, z);
    g.add(p);
  };
  for (let x = X0; x <= X1 + 0.01; x += 3.1) {
    addPost(x, Z0);
    if (x < GX0 - 0.5 || x > GX1 + 0.5) addPost(x, Z1);
  }
  for (let z = Z0; z <= Z1 + 0.01; z += 3.1) { addPost(X0, z); addPost(X1, z); }
  /* 门柱：门洞两侧各一根加粗立柱，不然「门」看着只是漏围了两根栏杆 */
  for (const gx of [GX0, GX1]) {
    const p = bar(0.11, 1.55, 0.11, M.steelBrushed);
    p.position.set(gx, 0.775, Z1);
    g.add(p);
  }
  /* 北侧横杆：整根 */
  for (const y of [1.18, 0.74, 0.28]) {
    const r = bar(X1 - X0, 0.042, 0.032, M.steelBrushed);
    r.position.set((X0 + X1) / 2, y, Z0);
    g.add(r);
  }
  /* 南侧横杆：门洞处分两段 */
  for (const [a, b] of [[X0, GX0], [GX1, X1]]) {
    for (const y of [1.18, 0.74, 0.28]) {
      const r = bar(b - a, 0.042, 0.032, M.steelBrushed);
      r.position.set((a + b) / 2, y, Z1);
      g.add(r);
    }
  }
  for (const x of [X0, X1]) {
    for (const y of [1.18, 0.74, 0.28]) {
      const r = bar(0.032, 0.042, Z1 - Z0, M.steelBrushed);
      r.position.set(x, y, (Z0 + Z1) / 2);
      g.add(r);
    }
  }

  /* 警示牌（共用一张贴图 + 一个材质，别一只牌子一份材质白送 draw call） */
  const warnTex = canvasTex(256, 320, (c) => {
    c.fillStyle = '#f2c800'; c.fillRect(0, 0, 256, 320);
    c.strokeStyle = '#111'; c.lineWidth = 10; c.strokeRect(10, 10, 236, 300);
    c.fillStyle = '#111'; c.textAlign = 'center';
    c.font = '800 100px "PingFang SC",sans-serif';
    c.fillText('⚡', 128, 146);
    c.font = '800 38px "PingFang SC",sans-serif';
    c.fillText('升压站', 128, 220);
    c.font = '700 21px "PingFang SC",sans-serif';
    c.fillText('高压危险 · 禁止入内', 128, 264);
  });
  const warnMat = new THREE.MeshStandardMaterial({
    map: warnTex, roughness: 0.6, side: THREE.DoubleSide,
  });
  /* ⚠️ 牌子挂得比设备更靠南，最容易在窄舞台里被切出右边界。
     横向位置是按 aspect 0.72 的视锥算过的（x = 1.9 时占用 0.91，再往东就出画）。 */
  for (const x of [-7.0, 1.9]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.42), warnMat);
    w.position.set(x, 1.10, Z1 + 0.05);
    g.add(w);
  }

  /* 站名牌不单独立杆 —— 立在场地里必然落到取景盒之外（它比设备更靠南、
     更靠西），窄舞台里会被切出画外。改贴在舱门上方那根过梁上：
     位置天然落在取景盒内，而且「舱体带站名牌」本身就是常见做法。 */
  return g;
}

/** 站名牌贴片（贴在预制舱门上方过梁上）—— 由 build() 调用，避免 site() 依赖 HUT 尺寸 */
function stationPlate() {
  const tex = canvasTex(512, 160, (c) => {
    c.fillStyle = '#f4f6f3'; c.fillRect(0, 0, 512, 160);
    c.strokeStyle = '#2b3a4a'; c.lineWidth = 8; c.strokeRect(5, 5, 502, 150);
    c.fillStyle = '#1d2a36'; c.textAlign = 'center';
    c.font = '800 58px "PingFang SC",sans-serif';
    c.fillText('35kV 风电升压站', 256, 74);
    c.font = '700 24px "PingFang SC",sans-serif';
    c.fillStyle = '#54637a';
    c.fillText('WIND FARM BOOSTER STATION', 256, 120);
  });
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.90, 0.42),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })
  );
}

/* ============================================================
 * 门型构架（出线 / 进线共用，只是高度与相间距离不同）
 * 原点在**地面中心**；userData.phaseY 是挂线点标高。
 * ============================================================ */
function gantry({ top = 5.40, span = 3.20, phases = [-0.90, 0, 0.90] } = {}) {
  const g = new THREE.Group();

  for (const sx of [-1, 1]) {
    const col = bar(0.16, top, 0.16, M.steelBrushed);
    col.position.set(sx * span / 2, top / 2, 0);
    g.add(col);
    const foot = rbox(0.48, 0.30, 0.48, 0.008, M.concrete, 1);
    foot.position.set(sx * span / 2, 0.15, 0);
    g.add(foot);
  }
  const beam = bar(span + 0.34, 0.18, 0.18, M.steelBrushed);
  beam.position.set(0, top - 0.09, 0);
  g.add(beam);
  /* 柱顶斜撑：门型架不设斜撑时两根柱子看着像「两根筷子」，加了才像构架 */
  for (const sx of [-1, 1]) {
    const br = bar(0.09, 1.15, 0.09, M.steelBrushed);
    br.position.set(sx * (span / 2 - 0.36), top - 0.70, 0);
    br.rotation.z = sx * 0.62;
    g.add(br);
  }

  /* 三相支柱绝缘子：**单独成组**，方便整组登记成一个热点（3 只各登记一次没必要） */
  const ins = new THREE.Group();
  for (const x of phases) {
    const s = insulator(0.34, M.pcBeige);
    s.position.set(x, top, 0);
    ins.add(s);
  }
  g.add(ins);

  /* ⚠️ 必须把 ins 挂到 userData 上带出去：调用方要用它 regElement 成一个热点。
     忘了挂的后果是 regElement(…, undefined) → 读 undefined.userData 抛错，
     同样是在 build() 里抛、同样表现成「一直转圈」。 */
  g.userData.ins = ins;
  g.userData.phaseY = top + 0.33;      // 挂线点（绝缘子顶端）
  g.userData.phases = phases;
  g.userData.top = top + 0.36;
  return g;
}

/**
 * 架空线路：从起点三相挂线点出发，一路连到每根电杆的横担上。
 * `from` 是 3 个 Vector3（起点挂线点），`stops` 是 [[x, z], …]。
 */
function overheadLine(from, stops, { h = 9.0, sag = 1.4 } = {}) {
  const g = new THREE.Group();
  let prev = from;
  for (const [px, pz] of stops) {
    const p = utilityPole(h, { arms: 1 });
    p.position.set(px, 0, pz);
    g.add(p);
    /* utilityPole 的横担在 y = h·0.88，绝缘子顶端再高 0.11 */
    const ay = h * 0.88 + 0.11;
    const cur = [-0.5, 0, 0.5].map((dx) => new THREE.Vector3(px + dx, ay, pz));
    for (let k = 0; k < 3; k++) g.add(powerLine(prev[k], cur[k], { sag, r: 0.024 }));
    prev = cur;
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
  root.add(skyDome(1600, { sun: [-11.0, 14.0, 11.0] }));

  /* ---------- 远景：风机剪影 + 树线 + 灌木 ---------- */
  const far = new THREE.Group();
  TURBINES.forEach((t, i) => {
    mountElement(far, hotspots, 'WIND', {
      x: t.x, y: 0, z: t.z,
      build: {
        hub: 65, rotor: 82, towerBot: 3.6, towerTop: 2.2,
        yaw: t.yaw, spin: t.spin,
      },
      key: `WIND#${i + 1}`,
      quiet: true, marker: false,
      off: [0, 52, 0],
      note: `风力发电机组 ${i + 1} · 1.5MW 级（轮毂高 65m、风轮直径 82m，远景剪影）`,
    });
  });
  /* ⚠️ 灌木是「一棵一份材质」（shrub() 里 new 的），每棵就是一个 draw call。
     远景植被只做气氛，18 棵足够；照抄 pv 的 34 棵会白送 16 次绘制。 */
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 30 + Math.random() * 70;
    const s = shrub(0.9 + Math.random() * 1.1, i * 0.83);
    s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.8 - 24);
    far.add(s);
  }
  far.add(treeline(300, 40, { minH: 3.0, maxH: 7.6, seed: 7 }));
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

  /* ---------- 预制二次设备舱 ----------
     舱内两台二次屏柜（保护屏 / 计量通信屏），正面大开口 + 双扇门折回贴墙，
     从机位能直接看见柜面 —— 这是「二次设备都装在哪」的答案。
     ⚠️ 屏柜要放在舱内地板（deck）标高 0.17 上，不是 y = 0；
     放到 0 会整台陷进底座型钢里。 */
  const HUT = new THREE.Group();
  const hut = buildElement('PREFAB', { w: HUT_L, h: HUT_H, d: HUT_D, openW: HUT_OPEN });
  HUT.add(hut);
  const panels = [];
  for (const [i, dx] of [-0.75, 0.75].entries()) {
    const cfg = i === 0
      ? { title: '线路保护屏', sub: 'PROT' }
      : { title: '计量/远动屏', sub: 'METER RTU' };
    const c = controlCabinet(cfg);
    c.group.position.set(dx, 0.17, -0.30);
    HUT.add(c.group);
    panels.push(c);
  }
  HUT.position.set(HUT_X, 0, HUT_Z);
  /* 站名牌贴在舱门上方那根过梁的正面（过梁前面 z = HUT_D/2 = 1.40，留 15mm 间隙） */
  const plateMesh = stationPlate();
  plateMesh.position.set(0, 2.82, HUT_D / 2 + 0.015);
  HUT.add(plateMesh);
  root.add(HUT);
  /* 舱体本身一个热点（它是外购舱体，不是本公司产品） */
  regElement(hotspots, 'PREFAB', hut, {
    off: [0, 3.55, 0.10],
    note: '预制二次设备舱 · 保护 / 计量 / 通信屏集中安装（舱体为外购成品）',
  });
  panels.forEach((c, i) => {
    regElement(hotspots, 'PANEL', c.group, {
      key: `PANEL#${i + 1}`,
      off: [0, 2.30, 0.10],
      note: i === 0
        ? '舱内 1 号屏 · 线路保护屏（集电线路保护与测控）'
        : '舱内 2 号屏 · 计量 / 远动屏（电量计量与数据上传）',
    });
  });
  /* ⚠️ 舱内屏柜也要「装上东西」——只给导轨不装模块，正面看就是两块空板。
     保护屏装保护装置 + 出口接触器 + 回路小开关，计量屏装数显表 + 屏内电源开关。 */
  const [p0, p1] = panels;
  mountElement(p0.group, hotspots, 'PROT', {
    x: -0.10, y: p0.RAIL_A, zBack: p0.RAIL_FRONT,
    note: '线路保护屏 · 微机保护装置（集电线路保护与测控）',
  });
  mountElement(p0.group, hotspots, 'CONTACTOR', {
    x: -0.06, y: p0.RAIL_B, zBack: p0.RAIL_FRONT,
    note: '线路保护屏 · 交流接触器（保护出口回路）',
  });
  mountElement(p0.group, hotspots, 'MCB', {
    x: 0.20, y: p0.RAIL_B, zBack: p0.RAIL_FRONT,
    note: '线路保护屏 · 微型断路器（保护回路电源）',
  });
  mountElement(p1.group, hotspots, 'METER', {
    x: 0, y: 1.90, z: p1.PLATE_Z, key: 'METER#3', note: '计量/远动屏 · 数显仪表',
  });
  mountElement(p1.group, hotspots, 'MCCB', {
    x: -0.12, y: p1.RAIL_B, zBack: p1.RAIL_FRONT,
    build: { w: 0.075, h: 0.13, d: 0.07 },
    key: 'MCCB#2', note: '计量/远动屏 · 塑壳断路器（屏内电源进线）',
  });

  /* ---------- 就地控制柜（本公司产品的落点，双柜并柜） ---------- */
  const LCP = new THREE.Group();
  const cabA = controlCabinet({ title: '就地控制柜', sub: 'WIND CTRL' });
  const cabB = controlCabinet({ title: '通信/远动柜', sub: 'RTU' });
  cabA.group.position.x = -0.41;
  cabB.group.position.x = 0.41;
  LCP.add(cabA.group, cabB.group);
  LCP.position.set(LCP_X, 0, LCP_Z);
  root.add(LCP);
  regElement(hotspots, 'LCP', LCP, {
    off: [0, 1.20, 0.06],
    note: '升压站就地控制柜（本公司二次元件集中安装处）',
  });

  /**
   * 把本公司产品装到柜内导轨上。
   * ⚠️ 必须走 buildProductModel + isolateMaterials（不能走 mountElement）：
   * mountElement 查的是 ELEMENT_BUILDERS，产品 id 不在表里会**静默**退化成
   * 80mm 的兜底小方盒，而卡片上还是真产品档案 —— 外形与档案对不上。
   */
  function mountProduct(cab, id, railY, slotIndex, note) {
    const p = buildProductModel(id);
    const x = (slotIndex - 4) * 0.045;
    placeOnRail(p, { x, y: railY, zBack: cab.RAIL_FRONT });
    p.rotation.y = 0;
    isolateMaterials(p);
    p.userData.pid = id;
    cab.group.add(p);
    hotspots.push(hotspot(id, p, { offset: [0, 0.030, 0.02], note }));
    return p;
  }

  /* 柜 A：集电线路侧 —— 电量 / 温度 / 挡位 / 电流 */
  mountProduct(cabA, 'TE', cabA.RAIL_A, 1, '就地控制柜 · 电量变送器（集电线路发电量上传）');
  mountProduct(cabA, 'TS', cabA.RAIL_A, 4, '就地控制柜 · 温度变送器（主变油温 / 绕组温度）');
  mountProduct(cabA, 'TG', cabA.RAIL_A, 7, '就地控制柜 · 挡位变送器（主变分接开关挡位）');
  mountProduct(cabA, 'RML', cabA.RAIL_B, 2, '就地控制柜 · 交流电流继电器（集电线路电流监视）');
  /* 柜 B：母线 / 通信 / 环境 */
  mountProduct(cabB, 'RMY', cabB.RAIL_A, 2, '就地控制柜 · 交流电压继电器（35kV 母线电压监视）');
  mountProduct(cabB, 'SS', cabB.RAIL_A, 6, '就地控制柜 · 信号变送器 / 隔离器（通信与信号隔离）');
  mountProduct(cabB, 'THC', cabB.RAIL_B, 4, '就地控制柜 · 温湿度控制器（柜内防凝露，联锁加热器）');

  /* 柜内通用元件 */
  mountElement(cabA.group, hotspots, 'PSU_G', {
    x: -0.30, y: cabA.RAIL_B, zBack: cabA.RAIL_FRONT, note: '就地控制柜 · 二次回路开关电源',
  });
  mountElement(cabA.group, hotspots, 'MCCB', {
    x: 0.30, y: cabA.RAIL_B, zBack: cabA.RAIL_FRONT,
    build: { w: 0.075, h: 0.13, d: 0.07 },
    note: '就地控制柜 · 二次回路塑壳断路器',
  });

  /* ---- 第 50 轮：两只柜都补「通用做法」那一组 ----
     风电场地处山口，低温 + 高湿，柜内元件更换频次高；
     可插拔继电器「拔下换一只」这一点在这里最值钱。
     ⚠️ 占位复核（x = (槽 - 4) × 0.045）：
        柜 A RAIL_A：TE(槽1, -0.135) TS(槽4, 0) TG(槽7, +0.135)
                     ⇒ 空段 [-0.1125, -0.0225] 与 [+0.0225, +0.1125]
        柜 B RAIL_A：RMY(槽2, -0.09) SS(槽6, +0.09)
                     ⇒ 空段 [-0.0675, +0.0675] 与 [+0.1125, +0.32] */
  mountElement(cabA.group, hotspots, 'LOGO', {
    /* 72mm 宽，正好占满柜 A 上排左空段 [-0.1125, -0.0225] */
    x: -0.0675, y: cabA.RAIL_A, zBack: cabA.RAIL_FRONT,
    note: '就地控制柜 · 可编程逻辑继电器（风机轮换与联锁逻辑就地实现）',
  });
  mountElement(cabA.group, hotspots, 'TIME_RELAY', {
    x: 0.0675, y: cabA.RAIL_A, zBack: cabA.RAIL_FRONT,
    note: '就地控制柜 · 时间继电器（延时回路）',
  });
  mountElement(cabB.group, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#1', x: -0.030, y: cabB.RAIL_A, zBack: cabB.RAIL_FRONT,
    note: '通信/远动柜 · 可插拔小型中间继电器（第 1 只）',
  });
  mountElement(cabB.group, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#2', x: 0.0, y: cabB.RAIL_A, zBack: cabB.RAIL_FRONT,
    note: '通信/远动柜 · 可插拔小型中间继电器（第 2 只）',
  });
  mountElement(cabB.group, hotspots, 'RELAY_SLIM', {
    key: 'RELAY_SLIM#1', x: 0.135, y: cabB.RAIL_A, zBack: cabB.RAIL_FRONT,
    note: '通信/远动柜 · 超薄型中间继电器（第 1 只）',
  });
  mountElement(cabB.group, hotspots, 'RELAY_SLIM', {
    key: 'RELAY_SLIM#2', x: 0.150, y: cabB.RAIL_A, zBack: cabB.RAIL_FRONT,
    note: '通信/远动柜 · 超薄型中间继电器（第 2 只）',
  });
  /* meterUnit 的原点在**前脸**、机身向后 75mm —— 给 z = PLATE_Z 才是穿板安装 */
  mountElement(cabA.group, hotspots, 'METER', {
    x: 0.28, y: 1.90, z: cabA.PLATE_Z, note: '就地控制柜 · 数显仪表',
  });
  mountElement(cabB.group, hotspots, 'METER', {
    x: -0.28, y: 1.90, z: cabB.PLATE_Z, key: 'METER#2', note: '通信/远动柜 · 数显仪表',
  });
  /* 加热器：风电场地处山口，冬季柜内凝露是主要故障源，装在柜底 */
  mountElement(cabB.group, hotspots, 'HEATER', {
    x: 0, y: 0.24, z: cabB.PLATE_Z + 0.03, note: '就地控制柜 · 柜内加热器（防凝露，由 THC 控制）',
  });
  regElement(hotspots, 'TERMINAL', cabA.tr, {
    off: [0, 0.032, 0.02], quiet: true, note: '就地控制柜 · 二次端子排',
  });
  regElement(hotspots, 'TERMINAL', cabB.tr, {
    key: 'TERMINAL#2', off: [0, 0.032, 0.02], quiet: true, note: '通信/远动柜 · 二次端子排',
  });
  regElement(hotspots, 'DUCT', cabA.ducts[0], {
    off: [0, 0.032, 0.02], quiet: true, note: '就地控制柜 · 走线槽',
  });
  regElement(hotspots, 'DUCT', cabB.ducts[0], {
    key: 'DUCT#2', off: [0, 0.032, 0.02], quiet: true, note: '通信/远动柜 · 走线槽',
  });
  regElement(hotspots, 'WIRE', cabA.cb, {
    off: [0, 0.05, 0.02], quiet: true, note: '就地控制柜 · 二次线束',
  });
  regElement(hotspots, 'WIRE', cabB.cb, {
    key: 'WIRE#2', off: [0, 0.05, 0.02], quiet: true, note: '通信/远动柜 · 二次线束',
  });
  cabA.group.userData.blankCulled = cullRailBlanks(cabA.group);
  cabB.group.userData.blankCulled = cullRailBlanks(cabB.group);

  /* ---------- 主变压器（油浸式）----------
     ⚠️ oilTransformer 的原点在**几何中心**，底部钢轨在 y = -0.46h - 0.05。
     台座顶面标高 0.30 → 中心 y = 0.30 + 0.46×2.40 + 0.05 = 1.45。 */
  const xfBase = rbox(4.60, 0.20, 3.60, 0.012, M.concreteDark, 1);
  xfBase.position.set(XF_X, 0.10, XF_Z);
  root.add(xfBase);
  const xfPlinth = rbox(4.20, 0.30, 3.20, 0.012, M.concrete, 1);
  xfPlinth.position.set(XF_X, 0.15, XF_Z);
  root.add(xfPlinth);
  mountElement(root, hotspots, 'OILXFMR', {
    x: XF_X, y: 0.30 + XF_H * 0.46 + 0.05, z: XF_Z,
    build: { w: XF_W, h: XF_H, d: XF_D },
    off: [0, 1.35, 0.40],
    note: '主变区 · 升压主变压器（油浸式，油温 / 绕组温度由 TS 采集）',
  });

  /* ---------- 主变高压侧避雷器 + 接地干线 ---------- */
  for (const [i, dx] of [-1.90, 1.90].entries()) {
    mountElement(root, hotspots, 'SPD', {
      x: XF_X + dx, y: 1.10, z: XF_Z - 2.30,
      build: { r: 0.045, h: 0.90 },
      key: `SPD#${i + 1}`,
      off: [0, 0.55, 0.10],
      /* ⚠️ 只说「装在主变侧、限制过电压」这种从实物就能看出来的事；
         具体挂在高压侧还是低压侧要按工程图，示意模型不替它下结论。 */
      note: '主变侧 · 氧化锌避雷器（限制过电压，保护变压器）',
    });
  }
  const gnd = new THREE.Group();
  const gndRun = bar(9.0, 0.05, 0.012, M.copper);
  gndRun.position.set(-1.60, 0.30, -0.30);
  gnd.add(gndRun);
  const gndStake = cyl(0.020, 0.020, 0.70, M.copper, 10);
  gndStake.position.set(2.60, 0.35, -0.30);
  gnd.add(gndStake);
  root.add(gnd);
  /* ⚠️ 不给 quiet，理由同 pv.js 的 GNDBAR。 */
  regElement(hotspots, 'GNDBAR', gnd, {
    off: [0, 0.22, 0.02], note: '升压站 · 接地干线（连主变、构架与设备区接地网）',
  });

  /* ---------- 出线构架 + 110kV 送出线路 ---------- */
  const gan = gantry({ top: 6.40, span: 3.20, phases: [-0.90, 0, 0.90] });
  gan.position.set(GAN_X, 0, GAN_Z);
  root.add(gan);
  regElement(hotspots, 'INSULATOR', gan.userData.ins, {
    off: [0, 0.30, 0.06],
    note: '出线构架 · 支柱绝缘子（110kV 送出，三相）',
  });
  root.add(overheadLine(
    gan.userData.phases.map((x) => new THREE.Vector3(GAN_X + x, gan.userData.phaseY, GAN_Z)),
    [[2.20, -44], [4.40, -104], [7.20, -196], [10.6, -318]],
    { h: 11.0, sag: 2.6 }
  ));

  /* ---------- 进线构架 + 35kV 集电线路（来自风场） ---------- */
  const inc = gantry({ top: 5.40, span: 3.20, phases: [-0.90, 0, 0.90] });
  inc.position.set(INC_X, 0, INC_Z);
  root.add(inc);
  regElement(hotspots, 'INSULATOR', inc.userData.ins, {
    key: 'INSULATOR#2',
    off: [0, 0.30, 0.06],
    note: '进线构架 · 支柱绝缘子（35kV 集电线路，三相）',
  });
  /* 集电线路朝风场方向（北偏东）退去，最后一档正好落在 2 号风机附近 */
  root.add(overheadLine(
    inc.userData.phases.map((x) => new THREE.Vector3(INC_X + x, inc.userData.phaseY, INC_Z)),
    [[-4.20, -30], [-1.60, -78], [3.60, -152], [12.0, -262], [26.0, -392]],
    { h: 9.0, sag: 1.5 }
  ));

  return {
    root,
    hotspots,
    env: 'outdoor',
    exposure: 1.00,
    /* 场地横跨 13.3m、纵向 9.4m，纵向还有 6.8m 高的出线构架 —— 54° 才框得下。
       ⚠️ fov 同时决定风机能不能留在地平线以上：塔顶 106m、相机俯视 10°，
       500m 处塔顶距视锥上沿还有约 5° 余量（见 TURBINES 注释）。 */
    fov: 54,
    /* 远平面 2000：风机在 500m、送出线路电杆到 318m，400 会把它们整段裁掉。
       ⚠️ near/far 比值越大深度精度越差，所以近景贴花（场坪 / 道路）都留了
       20mm 以上的层间间隙，不靠 1~2mm 的偏移。 */
    far: 2000,
    /* 雾：近处（<190m）完全不受影响，风机在 500m 处约 26% 大气衰减 ——
       既保留「远处的风机」这一层信息，又不会糊成一片白。far 与地面板半径对齐，
       地面边缘正好 100% 化入雾色（雾色取天空穹顶地平线附近的颜色，接缝看不见）。 */
    fog: { color: 0xc2d2dc, near: 190, far: 1400 },
    /* camera 只作**兜底**：真正用的机位由下面的 fit 盒按舞台宽高比反解。
       这里的数字是 aspect 0.89 下反解出来的结果，改布局要同步。 */
    camera: { pos: [-5.92, 5.27, 16.61], target: [-1.94, 1.90, -2.10] },
    /* ---------- 自适应取景盒 ----------
       parts 列的是「必须完整入画」的物件，坐标全部由上面的布局常量推出，
       不另写死数字 —— 否则以后挪了主变或构架，这里会悄悄失配而没人发现。
       方向取「南偏西 方位 -12°、仰角 10°」：场地东西向 13.3m 而舞台偏竖长，
       近正前方看能把舱内屏柜看进去，仰角 10° 又给地平线上的风机留出天顶余量。
       各舞台宽高比下的反解距离（.workbuddy-ai/tmp/wind_solve.py 逐字复刻验算）：
         0.72 → 22.5m   0.89 → 19.4m   1.10 → 16.9m   1.32 → 15.1m
       必须件最差占用率恒为 0.943（≤1.00，即任何舞台都框得下）。 */
    fit: {
      mode: 'dist',
      dir: [-0.20475, 0.17365, 0.96329],
      aim: [-1.94, 1.90, -2.10],
      pad: 1.06,
      parts: [
        /* 预制二次设备舱（含挑檐 6.24 × 3.24 × 3.04） */
        [HUT_X - HUT_L / 2 - 0.12, 0, HUT_Z - HUT_D / 2 - 0.12,
          HUT_X + HUT_L / 2 + 0.12, HUT_H + 0.24, HUT_Z + HUT_D / 2 + 0.12],
        /* 就地控制柜（双柜并柜，本公司产品的落点，必须看得见） */
        [LCP_X - 0.82, 0, LCP_Z - 0.32, LCP_X + 0.82, 2.26, LCP_Z + 0.32],
        /* 主变基础（底板 4.6×3.6）与主变本体（含散热片，宽 3.9） */
        [XF_X - 2.30, 0, XF_Z - 1.80, XF_X + 2.30, 0.45, XF_Z + 1.80],
        [XF_X - 1.95, 0.45, XF_Z - 0.85, XF_X + 1.95, 2.85, XF_Z + 0.85],
        /* 出线构架（竖向最高件） */
        [GAN_X - 1.70, 0, GAN_Z - 0.20, GAN_X + 1.70, 6.90, GAN_Z + 0.20],
        /* 进线构架 */
        [INC_X - 1.70, 0, INC_Z - 0.20, INC_X + 1.70, 5.90, INC_Z + 0.20],
      ],
    },
    /* ⚠️ 这里**故意不写 minAz / maxAz** —— 「镜头自由」：
       墙/天花/地面都是单面板（法线朝内），相机绕到墙外时被背面剔除，
       直接看进室内；加了方位角限位反而把「绕到背后看一眼」禁掉。
       极角仍然限位：minPol 允许俯视，maxPol 压住别钻到地面以下。 */
    limits: { minPol: 0.05, maxPol: Math.PI * 0.667, minD: 0.12, maxD: 60 },
    lights: [
      { type: 'hemi', sky: 0xb4d4ee, ground: 0x6f7264, intensity: 0.82 },
      { type: 'ambient', color: 0xc4d6e6, intensity: 0.20 },
      {
        type: 'dir', color: 0xfff6e6, intensity: 2.30, pos: [-11.0, 14.0, 11.0], target: [-1.0, 1.4, -1.0],
        shadow: true, shadowSize: 2048,
        shadowCam: { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 },
      },
      { type: 'dir', color: 0xd4e6f6, intensity: 0.44, pos: [10.0, 5.0, -8.0], target: [-1.0, 1.4, 0] },
    ],
  };
}
