/**
 * assembly.js —— 户内场景：成套厂二次装配区（装配工位）
 *
 * 与「开关柜二次室」的区别在光：这里是厂房高窗自然光 + 工矿灯暖光，
 * 明亮、偏中性、带一点暖调；而配电装置室是纯冷白工业光。
 */
import * as THREE from 'three';
import { M } from '../mats.js';
import {
  rbox, plate, cyl, bar, grp, doorPanel, cabinetShell, dinRail,
  wireDuct, terminalRow, hinge, handle, lockKey, nameplateTex,
  ceilingLightStrip, roomBox, floorPlane, cableBundle, contactShadow,
} from '../parts.js';
import { buildProductModel } from '../product-models.js';
import { hotspot, placeOnRail, cullRailBlanks, mountElement, regElement } from '../scene-kit.js';
import { isolateMaterials } from '../mats.js';
import { canvasTex } from '../util.js';

/* ---------- 房间 ---------- */
const ROOM = { w: 13.5, h: 4.35, d: 9.0 };

/* ---------- 装配工位 1：竖立的仪表门板 ---------- */
const PANEL = { x: -1.10, y: 1.425, w: 0.80, h: 1.75, t: 0.022, z: -0.30 };
const RAIL_A = 1.90, RAIL_B = 1.62, RAIL_C = 1.34;

/* 门板微微后仰，方便作业。板面倾了，板上的一切（导轨 / 线槽 / 端子排 / 盲板 / 产品）
   就必须跟着板面走 —— 这是踩过的坑：原来只有 pnl 倾斜，导轨却按未倾斜的平面摆，
   于是顶端导轨浮在门板前 54mm、底端端子排又陷进门板 10mm，侧视一眼就看出是假的。
   用 faceZ(y) 算出板面在高度 y 处的 z，所有挂装件统一按它定位。 */
const TILT = -0.06;
const SIN_T = Math.sin(TILT), COS_T = Math.cos(TILT);
const faceZ = (y) => PANEL.z + (y - PANEL.y) * SIN_T + (PANEL.t / 2) * COS_T;
/* 导轨前表面 z：导轨中心在 faceZ(y) + 0.026，本体最前面再 + 0.005。
   产品与盲板统一按「背面贴这条线」摆，导轨就永远被挡住，不会横在器件脸前面。 */
const railFront = (y) => faceZ(y) + 0.031;

/* ============================================================
 * 车间陈设零件
 * ============================================================ */

/** 装配支架（钢管框架 + 可调斜撑），把门板竖起来作业 */
function workStand(w = 0.86, h = 1.0, mat = M.aluDark) {
  const g = new THREE.Group();
  const tube = 0.035;
  // 底框
  for (const sz of [-1, 1]) {
    const b = bar(w, tube, tube, mat); b.position.set(0, tube / 2, sz * 0.30); g.add(b);
  }
  for (const sx of [-1, 1]) {
    const b = bar(tube, tube, 0.64, mat); b.position.set(sx * (w / 2 - tube / 2), tube / 2, 0); g.add(b);
  }
  // 立柱
  for (const sx of [-1, 1]) {
    const c = bar(tube, h, tube, mat);
    c.position.set(sx * (w / 2 - tube / 2), h / 2, -0.28);
    g.add(c);
  }
  // 斜撑
  for (const sx of [-1, 1]) {
    const s = bar(tube * 0.8, 1.06, tube * 0.8, mat);
    s.position.set(sx * (w / 2 - tube / 2), 0.50, 0.02);
    s.rotation.x = -0.30;
    g.add(s);
  }
  // 脚轮
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wheel = cyl(0.035, 0.035, 0.022, M.pcBlack, 14);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * (w / 2 - 0.06), 0.035, sz * 0.24);
    g.add(wheel);
  }
  return g;
}

/** 元件料架（多层 + 塑料元件盒），成套厂的标志性陈设 */
function componentRack(rows = 4, cols = 5, opt = {}) {
  const { w = 1.5, h = 1.85, d = 0.42 } = opt;
  const g = new THREE.Group();
  const post = M.powderMid;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = bar(0.05, h, 0.05, post);
    c.position.set(sx * (w / 2 - 0.025), h / 2, sz * (d / 2 - 0.025));
    g.add(c);
  }
  const binW = (w - 0.10) / cols, binH = 0.11;
  for (let r = 0; r < rows; r++) {
    const y = 0.12 + r * ((h - 0.28) / rows);
    const shelf = plate(w - 0.06, d - 0.06, 0.012, M.powderDark);
    shelf.rotation.x = Math.PI / 2;
    shelf.position.set(0, y, 0);
    g.add(shelf);
    for (let c = 0; c < cols; c++) {
      const bin = rbox(binW - 0.018, binH, d - 0.10, 0.004, M.pcBeige, 1);
      bin.position.set(-w / 2 + 0.05 + binW * (c + 0.5), y + binH / 2 + 0.008, 0.01);
      g.add(bin);
      // 盒内露出一点“元件”的深色口
      const inner = plate(binW - 0.040, d - 0.16, 0.004, M.pcDark);
      inner.rotation.x = -Math.PI / 2;
      inner.position.set(bin.position.x, y + binH + 0.009, 0.01);
      g.add(inner);
    }
  }
  return g;
}

/** 工位行灯（磁性底座 + 万向臂 + 暖光罩） */
function workLamp() {
  const g = new THREE.Group();
  const base = rbox(0.14, 0.045, 0.11, 0.004, M.pcDark, 1);
  g.add(base);
  const arm = cyl(0.014, 0.014, 0.52, M.aluDark, 12);
  arm.position.set(0, 0.28, 0); arm.rotation.z = 0.26;
  g.add(arm);
  const arm2 = cyl(0.012, 0.012, 0.36, M.aluDark, 12);
  arm2.position.set(0.10, 0.56, 0); arm2.rotation.z = -1.05;
  g.add(arm2);
  const head = cyl(0.055, 0.075, 0.10, M.powderWhite, 18, true);
  head.position.set(0.26, 0.62, 0);
  head.rotation.z = -0.9;
  g.add(head);
  const bulb = plate(0.10, 0.10, 0.008, new THREE.MeshStandardMaterial({
    color: 0x2a2a2a, emissive: 0xffe4bc, emissiveIntensity: 2.2, roughness: 1, side: THREE.DoubleSide,
  }));
  bulb.position.set(0.29, 0.605, 0);
  bulb.rotation.y = Math.PI / 2; bulb.rotation.x = 0.45;
  g.add(bulb);
  return g;
}

/** 线盘（成套厂地面常见） */
function wireSpool(r = 0.20, w = 0.16) {
  const g = new THREE.Group();
  for (const sz of [-1, 1]) {
    const disc = cyl(r, r, 0.014, M.pcBeige, 22);
    disc.rotation.x = Math.PI / 2;
    disc.position.z = sz * w / 2;
    g.add(disc);
  }
  const core = cyl(r * 0.55, r * 0.55, w, M.rubber, 18);
  core.rotation.x = Math.PI / 2;
  g.add(core);
  const wire = cyl(r * 0.86, r * 0.86, w * 0.9, M.cable, 22);
  wire.rotation.x = Math.PI / 2;
  g.add(wire);
  return g;
}

/** 木托盘 */
function pallet(w = 1.1, d = 0.85) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a7a4e, roughness: 0.92, metalness: 0 });
  for (let i = 0; i < 5; i++) {
    const s = bar(w, 0.022, 0.10, wood);
    s.position.set(0, 0.125, -d / 2 + 0.06 + i * (d - 0.12) / 4);
    g.add(s);
  }
  for (const sx of [-1, 0, 1]) {
    const b = bar(0.10, 0.08, d, wood);
    b.position.set(sx * (w / 2 - 0.09), 0.055, 0);
    g.add(b);
  }
  for (let i = 0; i < 4; i++) {
    const s = bar(w, 0.022, 0.10, wood);
    s.position.set(0, 0.012, -d / 2 + 0.10 + i * (d - 0.20) / 3);
    g.add(s);
  }
  return g;
}

/* ---------- 高窗玻璃：竖向天空渐变（模块级共享） ----------
 *
 * ⚠️⚠️ 为什么改（第 62 轮出图量化 + 证伪归因）：
 *   原来是一块**纯自发光平板**（`emissive 0xcfe2f4, emissiveIntensity 0.85`）。
 *   在 ACES + exposure 1.05 下，三扇窗被**整片打成纯白**：
 *     · 出图统计：`assembly` 视口内**近白像素 9.6%**（9 个场景里最高）；
 *     · 证伪：把**全部自发光**关掉后掉到 **0.1%** —— 元凶就是它，不是灯、不是天空。
 *   视觉上不像玻璃，像一个**白洞**，正是「看着简陋」的典型。
 *
 *   修法两条：
 *     ① 给玻璃一张 8×128 的**竖向渐变**（上深下浅）——有渐变才读得出
 *        「窗外是天空」，而不是一块死白的板；**不引入新材质种类**；
 *     ② `emissiveIntensity` 0.85 → 0.42，让最亮处落在 ~0.8，不再过曝。
 *
 * ⚠️ 贴图与材质都提到**模块级共享**，两个后果都要照顾到：
 *   · 三个窗共用一个材质 ⇒ `batchStatic` 能并成 **1 个 draw call**（省 2 个）；
 *   · 但模块级资源**跨场景装载存活** ⇒ 必须打 `userData.shared = true`，
 *     否则 `disposeTree` 在第一次 teardown 时就把它们释放，
 *     第二次进这个场景拿到的是**已释放的贴图**（画面变黑，且不报任何错）。
 *     `disposeTree` 对**材质**和**贴图**都认这个标记（`util.js` 里查的是
 *     `m.userData.shared` 与 `t.userData.shared` 两处）。
 */
const TEX_SHOP_SKY = (() => {
  const t = canvasTex(8, 128, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0.00, '#7fa8c9');   /* 天顶：偏深 */
    grd.addColorStop(0.45, '#a9cae3');
    grd.addColorStop(0.78, '#d7e9f7');
    grd.addColorStop(1.00, '#eef6fd');   /* 近地平：最亮 */
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  t.userData.shared = true;              /* ⚠️ 跨场景存活，不能被 disposeTree 释放 */
  return t;
})();
const MAT_SHOP_GLASS = (() => {
  const m = new THREE.MeshStandardMaterial({
    color: 0xe4f0fa,
    map: TEX_SHOP_SKY,
    emissive: 0xffffff,
    emissiveMap: TEX_SHOP_SKY,           /* 自发光也走同一张渐变 ⇒ 亮暗有层次 */
    emissiveIntensity: 0.42,
    roughness: 0.3, metalness: 0.05,
  });
  m.userData.shared = true;
  return m;
})();

/** 厂房高窗（亮面 + 窗框 + 竖梃） */
function shopWindow(w = 2.2, h = 1.5) {
  const g = new THREE.Group();
  const fr = rbox(w + 0.10, h + 0.10, 0.06, 0.006, M.powderMid, 1);
  g.add(fr);
  const glass = plate(w, h, 0.02, MAT_SHOP_GLASS);
  glass.position.z = 0.025;
  g.add(glass);
  for (let i = 1; i < 3; i++) {
    const mullion = bar(0.045, h, 0.05, M.powderMid);
    mullion.position.set(-w / 2 + (w / 3) * i, 0, 0.02);
    g.add(mullion);
  }
  return g;
}

/* ============================================================
 * 场景构建
 * ============================================================ */
export function build() {
  const root = new THREE.Group();
  const hotspots = [];

  /* ---------- 厂房地面与墙体 ---------- */
  root.add(roomBox({ w: ROOM.w, h: ROOM.h, d: ROOM.d, floorMat: M.concrete, wallMat: M.wall, ceilMat: M.ceilPanel }));

  // 车间通道黄线
  for (const z of [-2.55, 2.75]) {
    const l = bar(ROOM.w, 0.002, 0.10, new THREE.MeshStandardMaterial({ color: 0xd8b13a, roughness: 0.8 }));
    l.position.set(0, 0.0015, z);
    root.add(l);
  }
  // 地面伸缩缝
  for (let i = -2; i <= 2; i++) {
    const l = bar(0.014, 0.002, ROOM.d, M.concreteDark);
    l.position.set(i * 2.6, 0.001, 0);
    root.add(l);
  }

  /* ---------- 后墙高窗 + 卷帘门 ---------- */
  const winWall = new THREE.Group();
  for (const x of [-4.4, -2.0, 0.4]) {
    const w = shopWindow(2.0, 1.45);
    w.position.set(x, 3.05, -ROOM.d / 2 + 0.05);
    winWall.add(w);
  }
  // 卷帘门（半开）
  const shutterFrame = rbox(3.1, 2.85, 0.12, 0.006, M.powderMid, 1);
  shutterFrame.position.set(4.6, 1.42, -ROOM.d / 2 + 0.08);
  winWall.add(shutterFrame);
  for (let i = 0; i < 12; i++) {
    const s = plate(2.9, 0.13, 0.05, M.powderLight);
    s.position.set(4.6, 2.62 - i * 0.145, -ROOM.d / 2 + 0.16);
    winWall.add(s);
  }
  // 装配工艺看板
  const boardTex = canvasTex(512, 384, (g) => {
    g.fillStyle = '#f3f3ee'; g.fillRect(0, 0, 512, 384);
    g.strokeStyle = '#1d2733'; g.lineWidth = 3; g.strokeRect(5, 5, 502, 374);
    g.fillStyle = '#0f5a3a'; g.fillRect(5, 5, 502, 42);
    g.fillStyle = '#fff'; g.font = '700 24px "PingFang SC","Microsoft YaHei",sans-serif';
    g.fillText('二次接线工艺卡 · 装配工位', 20, 34);
    g.strokeStyle = '#2b5f8a'; g.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      const x = 44 + i * 62;
      g.beginPath(); g.moveTo(x, 96); g.lineTo(x, 300); g.stroke();
      g.fillStyle = '#b3352c'; g.fillRect(x - 8, 150, 16, 26);
      g.fillStyle = '#5b6670'; g.font = '600 15px "SF Mono",monospace';
      g.fillText('X' + (i + 1), x - 11, 326);
    }
    g.fillStyle = '#1d2733'; g.font = '600 17px "PingFang SC",sans-serif';
    g.fillText('① 核对图纸  ② 元件定位  ③ 配线  ④ 自检', 20, 358);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.12),
    new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.7 }));
  board.position.set(1.9, 2.05, -ROOM.d / 2 + 0.05);
  winWall.add(board);
  root.add(winWall);

  /* ---------- 左墙：元件料架 ×2 ---------- */
  const rackG = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const r = componentRack(4, 5);
    r.rotation.y = Math.PI / 2;
    r.position.set(-ROOM.w / 2 + 0.24, 0, -1.9 + i * 1.7);
    rackG.add(r);
  }
  // 货架上的纸箱
  const carton = new THREE.MeshStandardMaterial({ color: 0xa88a5c, roughness: 0.92 });
  for (let i = 0; i < 4; i++) {
    const c = rbox(0.42, 0.30, 0.34, 0.004, carton, 1);
    c.position.set(-ROOM.w / 2 + 0.34, 0.15 + (i % 2) * 0.32, 2.35 + Math.floor(i / 2) * 0.5);
    rackG.add(c);
  }
  root.add(rackG);

  /* ---------- 工位 1：竖立门板（产品安装处） ---------- */
  const bay1 = new THREE.Group();
  /* 门板总成：门板 + 安装板 + 导轨/线槽/端子排 + 已装元件。
     收进一个子组后，爆炸视图可以把“整块装好的门板”一起抬离工装架，
     而不是把元件留在半空。 */
  const panelRig = new THREE.Group();
  bay1.add(panelRig);
  const stand1 = workStand(0.90, 1.02);
  stand1.position.set(PANEL.x, 0, PANEL.z + 0.06);
  bay1.add(stand1);

  /* 门板本体 + 衬板 + 折边收进一个「跟着板面倾斜」的子组。
     导轨等挂装件留在 panelRig 里（保持轴对齐），只是按 faceZ(y) 修正 z——
     这样包围盒仍然是轴对齐的，cullRailBlanks 的判据才成立。 */
  const boardFace = new THREE.Group();
  boardFace.position.set(PANEL.x, PANEL.y, PANEL.z);
  boardFace.rotation.x = TILT;
  panelRig.add(boardFace);

  const pnl = rbox(PANEL.w, PANEL.h, PANEL.t, 0.003, M.powderLight, 1);
  boardFace.add(pnl);
  // 门板四周折边
  for (const sx of [-1, 1]) {
    const e = bar(0.016, PANEL.h, 0.030, M.trimDark);
    e.position.set(sx * (PANEL.w / 2 - 0.008), 0, -0.006);
    boardFace.add(e);
  }
  // 门板上的安装板（浅色衬板）
  const mp = plate(PANEL.w - 0.07, PANEL.h - 0.10, 0.004, M.powderWhite);
  mp.position.set(0, 0.02, PANEL.t / 2 + 0.002);
  boardFace.add(mp);

  // 导轨 / 走线槽 / 端子排（沿门板宽度方向，z 跟随板面）
  const railYs = [RAIL_A, RAIL_B, RAIL_C];
  railYs.forEach(ry => {
    const r = dinRail(0.66);
    r.position.set(PANEL.x, ry, faceZ(ry) + 0.026);
    panelRig.add(r);
  });
  const ducts = [];
  for (const dy of [2.06, 1.76, 1.48, 1.18, 0.94]) {
    const d = wireDuct(0.66, 0.05, 0.034);
    d.position.set(PANEL.x, dy, faceZ(dy) + 0.026);
    panelRig.add(d);
    ducts.push(d);
  }
  const tr = terminalRow(24, { w: 0.0072, h: 0.05, d: 0.046 });
  tr.position.set(PANEL.x, 0.86, faceZ(0.86) + 0.024);
  panelRig.add(tr);
  // 未接线的二次电缆（垂下来）
  const cb = cableBundle(6, 0.42, { r: 0.005, spread: 0.05 });
  cb.position.set(PANEL.x, 0.80, faceZ(0.80) + 0.02);
  panelRig.add(cb);

  // 空白填充模块：背面贴导轨前表面（BoxGeometry 原点在几何中心，中心 = 背面 + 半个厚度），
  // 且不再手写 taken 表——产品比槽宽（FA 96mm / THC 90mm），手写表会让两侧盲板插进壳体。
  const BLANK_D = 0.078;
  const blankGeo = new THREE.BoxGeometry(0.045, 0.09, BLANK_D);
  railYs.forEach(ry => {
    for (let i = 0; i < 14; i++) {
      const b = new THREE.Mesh(blankGeo, M.pcGray);
      b.position.set(PANEL.x - 0.315 + 0.0225 + i * 0.045, ry, railFront(ry) + BLANK_D / 2);
      b.castShadow = true;
      b.userData.blank = true;          // 供 cullRailBlanks 识别
      panelRig.add(b);
    }
  });

  // 行灯 + 工具盘
  const lamp = workLamp();
  lamp.position.set(PANEL.x + 0.52, 0, PANEL.z + 0.34);
  lamp.rotation.y = -1.15;
  bay1.add(lamp);
  const toolTray = rbox(0.44, 0.05, 0.30, 0.004, M.aluDark, 1);
  toolTray.position.set(PANEL.x - 0.66, 0.90, PANEL.z + 0.34);
  bay1.add(toolTray);
  for (let i = 0; i < 4; i++) {
    const sc = cyl(0.006, 0.006, 0.16, M.steelBrushed, 10);
    sc.rotation.z = Math.PI / 2;
    sc.position.set(PANEL.x - 0.78 + i * 0.09, 0.94, PANEL.z + 0.34);
    bay1.add(sc);
  }

  /* 待装件周转筐（进厂件暂存）—— 触头盒与穿墙套管。
     这两件是开关柜一次侧的绝缘件：触头盒装在断路器室后壁（手车触臂的插接点），
     穿墙套管装在母线室与断路器室之间的隔板上。装配前先在筐里清点，装完就不再露面，
     所以在装配区把它们做成「待装件」比塞进柜子深处更有说服力，也看得见。
     ⚠️ 位置是按默认机位反算的：垂直偏角 17.4°、水平 3.5°，都在 42° 视场安全区内。
        再往低（y < 0.25）或再往右（x > -0.2）就会被画面下边框切掉。 */
  const tote = new THREE.Group();
  const toteBox = rbox(0.46, 0.24, 0.36, 0.006, M.aluDark, 1);
  toteBox.position.y = 0.12;
  tote.add(toteBox);
  const toteIn = plate(0.40, 0.30, 0.004, M.pcDark);
  toteIn.rotation.x = -Math.PI / 2;
  toteIn.position.y = 0.215;
  tote.add(toteIn);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const st = bar(0.022, 0.10, 0.022, M.steelBrushed);
    st.position.set(sx * 0.20, 0.05, sz * 0.15);
    tote.add(st);
  }
  tote.position.set(-0.55, 0, 0.45);
  tote.userData.explode = [0.30, 0, 0.34];
  bay1.add(tote);
  mountElement(tote, hotspots, 'CONTACTBOX', {
    x: -0.11, y: 0.288, z: 0,
    note: '待装件 · 触头盒/静触头（断路器手车推入后的主回路插接点，装于断路器室后壁）',
  });
  mountElement(tote, hotspots, 'WALLBUSH', {
    x: 0.11, y: 0.272, z: 0, ry: 0.30,
    note: '待装件 · 穿墙套管（主母线穿过金属隔板处，装于母线室与断路器室之间）',
  });

  root.add(bay1);

  /* ---------- 工位 2：正在组装的柜体骨架 ---------- */
  const bay2 = new THREE.Group();
  const SHELL2 = { x: 1.95, z: -0.55, w: 0.80, h: 2.20, d: 1.40 };
  const SHELL2_FRONT = SHELL2.z + SHELL2.d / 2;        // 柜前框外表面 z = 0.15
  const shell2 = cabinetShell({
    w: SHELL2.w, h: SHELL2.h, d: SHELL2.d, plinth: 0.05, topCap: false, backPanel: false,
  });
  shell2.position.set(SHELL2.x, 0, SHELL2.z);
  bay2.add(shell2);

  /* 待装的门板：**斜靠在骨架正面**（下沿落地、上沿背面贴柜前框）。
     ⚠️ 原来是 `rotation.x = -1.32`（≈ −76°）—— 那根本不是「靠」，是**躺平**；
        再配上 `z = 0.30`，门板下半截直接插进柜体内部约 300mm。
        用户看到的就是「门倒在地上 + 穿模」。躺平的门板还悬在 y≈0.37~0.83，
        没有任何支撑，怎么看都是「摔下来的」。
     现在按「靠墙」反解三个数：
       · 绕 X 后仰 θ，使**下沿背面最低点**落在 y = 0（站在地上）；
       · **上沿背面**贴柜前框平面 z = SHELL2_FRONT（再留 3mm，避免共面 z-fighting）；
       · 横向让门板左缘压在前立柱上（立柱 x ∈ [1.550, 1.572]）——「靠」得有支撑点，
         否则门板正好落在门洞中间，看着像浮空。
     ⚠️ 门板的 `rotation.y` 必须归零：原来那个 −0.30 是跟着躺平姿态配的，
        立起来之后再转 17° 就会斜出柜体左沿。 */
  const LEAN = { w: 0.74, h: 0.86, t: 0.016, tilt: 0.28 };   // 后仰 ≈16°
  /* ⚠️ 门板「背面」不等于 t/2 = 8mm。`doorPanel` 在 z = −0.001 处还有一圈
     **回折边**（厚 t×1.6 = 25.6mm），它比门板本体多伸出 5.8mm。
     按 t/2 反解会让折边正好压进前框 3mm（实测 min.z = 0.147 < 前框 0.150）。
     这里取实际最后沿 0.014。 */
  const LEAN_BACK = 0.014;
  const LEAN_COS = Math.cos(LEAN.tilt), LEAN_SIN = Math.sin(LEAN.tilt);
  const lean = doorPanel({
    w: LEAN.w, h: LEAN.h, t: LEAN.t,
    windows: [{ x: 0, y: 0.04, w: 0.34, h: 0.30 }],
    handle: { x: 0.30, y: -0.02 }, lock: { x: 0.30, y: -0.20 },
    hinges: [-0.26, 0.26],
  });
  lean.rotation.x = -LEAN.tilt;
  lean.position.set(
    SHELL2.x - SHELL2.w / 2 - 0.005 + LEAN.w / 2,                      // 左缘压在左前立柱上
    (LEAN.h / 2) * LEAN_COS + (LEAN.t / 2) * LEAN_SIN,                 // 下沿落地
    SHELL2_FRONT + (LEAN.h / 2) * LEAN_SIN + LEAN_BACK * LEAN_COS + 0.003,
  );
  bay2.add(lean);
  // 地面上的木托盘 + 线盘
  const pl = pallet(1.15, 0.88);
  pl.position.set(2.75, 0, 1.35);
  pl.rotation.y = 0.24;
  bay2.add(pl);
  for (let i = 0; i < 3; i++) {
    const sp = wireSpool(0.19, 0.15);
    sp.position.set(2.55 + i * 0.36, 0.20, 1.30 + (i % 2) * 0.30);
    sp.rotation.y = i * 0.7;
    bay2.add(sp);
  }
  root.add(bay2);

  /* ---------- 右侧：待发运的成品柜（门做成**可开合**） ----------
     ⚠️ 原来这扇门是 `root.add(dDoor)` + 绝对坐标 —— 两个毛病：
        ① 它不在 `doorList` 里，于是 assembly 的可动件数为 0，顶栏「柜门开合」
           是一颗**点了没反应的死按钮**（`#mover-summary` 也整行隐藏，用户完全
           不知道这一场有没有能开的东西）；
        ② 门没挂在柜体上，以后挪柜子门会留在原地。
     现在按 kyn28 / gis / dcpanel 的既有约定重做：铰点放**左前立柱内侧**，
     门扇中心挂在 local +x（朝门洞那一侧）→ `rotation.y = 0` 就是关闭，
     负角往柜前（+z）开。见 app.js 的 collectDoors / applyDoors。
     ⚠️ 门宽取 `CW - 0.012`：门比门洞（`CW - 2t` = 0.756）略宽是**真机的做法**
        （门盖住前框），但两边各要留 6mm，否则门会插进前立柱。 */
  const done = cabinetShell({ w: 0.80, h: 2.20, d: 1.40, plinth: 0.05 });
  done.position.set(4.55, 0, -0.55);
  root.add(done);
  const DONE_W = 0.80, DONE_D = 1.40;
  const dDoor = doorPanel({
    w: DONE_W - 0.012, h: 2.06, t: 0.016,
    windows: [{ x: 0, y: 0.42, w: 0.34, h: 0.28 }],
    /* ⚠️ 铰链在左（`hingeSide` 默认 −1），把手就必须在**右**。
       原来把手写在 x = −0.30，跟铰链挤在同一边 —— 真柜子没有这么装的。 */
    handle: { x: 0.30, y: 0.0 }, lock: { x: 0.30, y: -0.18 },
    plate: { x: 0.20, y: 0.72, w: 0.26, h: 0.13, title: '计量柜', sub: '出厂检验合格' },
    hinges: [-0.66, 0, 0.66],
  });
  const dDoorPivot = new THREE.Group();
  /* 铰点：左前立柱内侧（柜体局部系）。z 取柜前表面 + 10mm ——
     再往里门板背面就与前框外表面共面，会 z-fighting。 */
  dDoorPivot.position.set(-DONE_W / 2 + 0.006, 1.16, DONE_D / 2 + 0.010);
  dDoor.position.set((DONE_W - 0.012) / 2, 0, 0);
  dDoorPivot.add(dDoor);
  dDoorPivot.userData.door = { open: -1.72, closed: 0 };   // 出厂状态：关着
  dDoorPivot.userData.explode = [0, 0.34, 0.82];           // 爆炸视图：门往外让开
  done.add(dDoorPivot);

  /* 敞开之后能看见的柜内 —— 原来这扇门是死的，柜内是空壳也看不出来；
     门做成可开合之后，一开门就是一块光板，反而显得「没做完」。
     这里补安装板 + 走线槽 ×2 + 二次端子排 + 接地铜排，全部用通用件、
     **不登记热点**（这是待发运的成品柜，不该在「本场景产品」里多出一项）。 */
  const donePlate = plate(DONE_W - 0.075, 2.02, 0.006, M.powderWhite);
  donePlate.position.set(0, 1.16, -0.16);
  done.add(donePlate);
  for (const dy of [1.86, 0.44]) {
    const d = wireDuct(0.66, 0.05, 0.034);
    d.position.set(0, dy, -0.12);
    done.add(d);
  }
  const doneTerm = terminalRow(18, { w: 0.0072, h: 0.05, d: 0.046 });
  doneTerm.position.set(0, 0.60, -0.12);
  done.add(doneTerm);
  const donePe = bar(0.62, 0.030, 0.012, M.copper);      // 接地铜排
  donePe.position.set(0, 0.32, -0.12);
  done.add(donePe);

  /* ---------- 顶棚工矿灯 ---------- */
  for (const [x, z] of [[-3.2, 0.6], [0.6, 0.6], [4.2, 0.6], [-1.4, -2.6]]) {
    const g = new THREE.Group();
    const rod = cyl(0.012, 0.012, 0.34, M.aluDark, 8);
    rod.position.y = ROOM.h - 0.17;
    g.add(rod);
    const shade = cyl(0.09, 0.30, 0.20, M.powderWhite, 20, true);
    shade.position.y = ROOM.h - 0.42;
    g.add(shade);
    const bulb = plate(0.24, 0.24, 0.01, M.lampWarm);
    bulb.rotation.x = -Math.PI / 2;
    bulb.position.y = ROOM.h - 0.52;
    g.add(bulb);
    g.position.set(x, 0, z);
    root.add(g);
  }

  /* ---------- 产品安装（工位 1 门板） ---------- */
  const mid = panelRig;

  function mount(id, railY, slotIndex, note) {
    const p = buildProductModel(id);
    const x = PANEL.x - 0.315 + 0.0225 + slotIndex * 0.045;
    // 背面贴导轨前表面 + 跟随门板倾角：panelMeter 与 dinModule 的原点约定不同，
    // 直接设 position 会让同排产品背面差 40~55mm
    placeOnRail(p, { x, y: railY, zBack: railFront(railY) });
    p.rotation.y = 0;                    // 正面朝 +Z
    isolateMaterials(p);
    p.userData.pid = id;
    mid.add(p);
    hotspots.push(hotspot(id, p, { offset: [0, 0.030, 0.02], note }));
    return p;
  }

  mount('TE', RAIL_A, 2, '装配工位 · 门板中排（电量变送）');
  mount('TK', RAIL_A, 4, '装配工位 · 门板中排（热电偶采集：高温测点专用，PT100 干不了的场合）');
  mount('RC', RAIL_A, 6, '装配工位 · 门板中排（中间继电器）');
  mount('FA', RAIL_B, 3, '装配工位 · 门板下排（信号报警）');
  mount('THC', RAIL_B, 7, '装配工位 · 门板下排（防凝露控制）');
  mount('YDSP', RAIL_C, 5, '装配工位 · 门板下排（柜内 24V 供电）');
  /* XF 控制变压器：110×116mm，比普通 45mm 导轨模块大一圈，
     槽位 9（x = PANEL.x - 0.2925 + 0.405）离 YDSP 还有 97mm 净空。
     真实成套柜里它就装在门板/安装板下部，给控制回路出安全电压。 */
  mount('XF', RAIL_C, 9, '装配工位 · 门板下排（控制变压器：380/220V → 控制回路安全电压）');

  /* ---------- 工位上的通用元件 ----------
     真实装配工位不会只有继电器：出线断路器、接触器、仪表、线槽、端子排、线束
     都在同一块门板上，缺了就不像「正在装配的门板」。
     槽位坐标与 mount() 一致：x = PANEL.x - 0.2925 + slot × 0.045。 */
  const slotX = (i) => PANEL.x - 0.315 + 0.0225 + i * 0.045;
  mountElement(panelRig, hotspots, 'MCCB', {
    x: slotX(10), y: RAIL_A, zBack: railFront(RAIL_A),
    note: '装配工位 · 门板上排（出线塑壳断路器）',
  });
  mountElement(panelRig, hotspots, 'MCB', {
    x: slotX(13), y: RAIL_A, zBack: railFront(RAIL_A),
    note: '装配工位 · 门板上排（控制回路微断）',
  });
  mountElement(panelRig, hotspots, 'CONTACTOR', {
    x: slotX(11), y: RAIL_B, zBack: railFront(RAIL_B),
    note: '装配工位 · 门板下排（交流接触器）',
  });
  mountElement(panelRig, hotspots, 'METER', {
    build: { w: 0.096, h: 0.048, d: 0.075 }, x: slotX(1), y: RAIL_C, zBack: railFront(RAIL_C),
    note: '装配工位 · 门板下排（回路数显表）',
  });

  /* ---------- 第 51 轮：面板型大件 ----------
     ⚠️⚠️ 落点先算过空带，不能随手给：
        门板正面被三排导轨占着 —— RAIL_A 器件底 1.825 / RAIL_B 器件底 1.572 /
        RAIL_C 器件底 1.284；再往下是 TERMINAL（顶 0.894）与线束 WIRE。
        ⇒ 唯一 ≥150mm 的空带是 **TERMINAL 顶 0.894 ~ RAIL_C 器件底 1.284（384mm）**。
     HMI 200×150×45 取 y = 1.09（盒 1.015~1.165），上留 119mm、下留 121mm。 */
  mountElement(panelRig, hotspots, 'HMI', {
    x: PANEL.x, y: 1.09, zBack: faceZ(1.09),
    note: '装配工位 · 就地触摸屏（面板嵌入式，看装配进度与二次回路图）',
  });

  /* ---- 第 50 轮：**「不用本公司专用件的时候，这块门板上装什么」** ----
     这是客户出差时最常问的一句话：有些柜子用不到专用继电器，只有几只可插拔小继电器，
     或者干脆换个思路（可编程控制器 / 逻辑继电器 / 固态继电器）。
     那就把这几条路**真的摆到这块正在装配的门板上**，一眼能看出区别：
       · 上排：小型可编程控制器（逻辑写进程序）+ 数字量 I/O 扩展模块
       · 下排：超薄型中间继电器 ×2 · 可编程逻辑继电器 ·
               可插拔小型中间继电器 ×2 · 固态继电器 · 时间继电器
     左右对照着看：同样是「让回路按条件动作」，一路是硬件继电器堆，
     一路是一只控制器加几片 I/O —— 这就是「别的设计方案」长什么样。

     ⚠️⚠️ x 全部按「已占槽位 + **邻居的真实宽度**」逐只算过，不能随手给，
        更不能假设「一只占一槽 45mm」—— 第 50 轮就是栽在这一条上
        （FA 96mm / THC 90mm / MCCB 90mm，全不是 45mm）。
        slotX(i) = PANEL.x - 0.315 + 0.0225 + i × 0.045（14 槽，节距 45mm）；
        实测占位：
          RAIL_A：TE(2)[-1.325,-1.280] TK(4)[-1.235,-1.190] RC(6)[-1.145,-1.100]
                  MCCB(槽10, **90mm**)[-0.9875,-0.8975] MCB(槽13, 18mm)[-0.8165,-0.7985]
          RAIL_B：FA(3, **96mm**)[-1.3055,-1.2095] THC(7, **90mm**)[-1.1225,-1.0325]
                  CONTACTOR(11)[-0.920,-0.875]
          RAIL_C：METER(槽1, 96mm) YDSP(5) XF(槽9, 110mm)[-1.0425,-0.9325]
        改动任何一个邻居，下面每一只的 x 都要用**它的真实宽度**重算。
     ⚠️ 同 id 多只必须给**不同的 key**：hotspotById 是 Map，
        同 key 的后一只静默覆盖前一只，点第 1 只却选中第 2 只。 */
  mountElement(panelRig, hotspots, 'PLC', {
    /* 90mm 宽；RAIL_A 空段 [-1.100, -0.9875]（RC 右沿 → MCCB 左沿）112.5mm，
       靠左放并留 3mm —— 原写 slotX(7)+0.0225 恰好与 RC 贴面 0mm，太险。 */
    x: -1.052, y: RAIL_A, zBack: railFront(RAIL_A),
    note: '装配工位 · 门板上排（小型可编程控制器：逻辑用程序写，不再靠一堆继电器搭）',
  });
  mountElement(panelRig, hotspots, 'IO_MOD', {
    /* ⚠️ MCCB 实测 90mm（没传 build 覆盖，就是默认值）——
       按 75mm 算会压进它 22mm（railfit_probe 第 50 轮实测）。
       RAIL_A 空段 [-0.8975, -0.8165] 81mm，取正中 -0.857。 */
    x: -0.857, y: RAIL_A, zBack: railFront(RAIL_A),
    note: '装配工位 · 门板上排（数字量 I/O 扩展模块：挂在控制器右侧扩点数）',
  });
  mountElement(panelRig, hotspots, 'RELAY_SLIM', {
    key: 'RELAY_SLIM#1', x: -1.3925, y: RAIL_B, zBack: railFront(RAIL_B),
    note: '装配工位 · 门板下排（超薄型中间继电器：一只只占 8.5mm，同一条导轨能塞更多路）',
  });
  mountElement(panelRig, hotspots, 'RELAY_SLIM', {
    key: 'RELAY_SLIM#2', x: -1.3805, y: RAIL_B, zBack: railFront(RAIL_B),
    note: '装配工位 · 门板下排（超薄型中间继电器 · 第 2 只）',
  });
  mountElement(panelRig, hotspots, 'LOGO', {
    /* ⚠️ FA 实测 **96mm**（不是 45mm）—— 原写 slotX(4)+0.0225 压进它 16mm。
       RAIL_B 空段 [-1.2095, -1.1225] 87mm，72mm 的 LOGO 取正中 -1.166，两侧各 7.5mm。 */
    x: -1.166, y: RAIL_B, zBack: railFront(RAIL_B),
    note: '装配工位 · 门板下排（可编程逻辑继电器：不接电脑也能就地改逻辑）',
  });
  mountElement(panelRig, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#1', x: slotX(9), y: RAIL_B, zBack: railFront(RAIL_B),
    note: '装配工位 · 门板下排（可插拔小型中间继电器 · 第 1 只：拔下来就能换）',
  });
  mountElement(panelRig, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#2', x: slotX(10), y: RAIL_B, zBack: railFront(RAIL_B),
    note: '装配工位 · 门板下排（可插拔小型中间继电器 · 第 2 只）',
  });
  mountElement(panelRig, hotspots, 'SSR', {
    x: slotX(13), y: RAIL_B, zBack: railFront(RAIL_B),
    note: '装配工位 · 门板下排（固态继电器：无触点、无动作声响，动作寿命长）',
  });
  mountElement(panelRig, hotspots, 'TIME_RELAY', {
    x: slotX(7), y: RAIL_C, zBack: railFront(RAIL_C),
    note: '装配工位 · 门板下排（时间继电器：面板上两个整定旋钮，到点动作）',
  });
  /* 门板上本来就有端子排 / 走线槽 / 线束，直接登记成热点，不必再造一份几何。 */
  regElement(hotspots, 'TERMINAL', tr, {
    off: [0, 0.035, 0.02], quiet: true, note: '装配工位 · 门板底部（二次端子排）',
  });
  regElement(hotspots, 'DUCT', ducts[0], {
    off: [0, 0.035, 0.02], quiet: true, note: '装配工位 · 门板（走线槽）',
  });
  regElement(hotspots, 'WIRE', cb, {
    off: [0, 0.05, 0.02], quiet: true, note: '装配工位 · 门板（待接二次线束）',
  });

  // 产品挂完后清掉被它们压住的盲板（产品比槽宽，两侧邻位会插进壳体）。
  // 数量记到 root 上，回归脚本可以直接断言「避让确实生效了」。
  root.userData.blankCulled = cullRailBlanks(panelRig);

  /* ---------- 爆炸视图：按“装配顺序”分层展开 ---------- */
  panelRig.userData.explode = [0, 0.05, 0.62];   // 装好的门板整体抬离工装架
  stand1.userData.explode = [0, 0, -0.20];       // 工装架后退
  lamp.userData.explode = [0.26, 0.10, 0.30];    // 行灯让开
  toolTray.userData.explode = [-0.24, 0, 0.34];  // 工具盘让开
  lean.userData.explode = [0, 0.46, 0.30];       // 待装门板立起
  pl.userData.explode = [0.36, 0, 0.44];         // 托盘与线盘外移
  rackG.userData.explode = [-0.44, 0, 0];        // 料架后退

  /* ---------- 接触阴影 ---------- */
  const cs1 = contactShadow(2.0, 1.3, 0.42);
  cs1.position.set(PANEL.x, 0.004, PANEL.z + 0.10);
  root.add(cs1);
  const cs2 = contactShadow(2.4, 2.0, 0.42);
  cs2.position.set(2.6, 0.004, -0.4);
  root.add(cs2);

  return {
    root,
    hotspots,
    env: 'indoor',
    exposure: 1.00,
    fog: { color: 0x242b34, near: 11, far: 34 },
    fov: 42,
    /* 默认机位收近到工位 1 的门板：原来的 6.5m 机位把「主角」压成了画面里一小条，
       装配工位的价值全在门板上装了哪些元件，得让门板占满纵向。 */
    camera: { pos: [1.85, 2.00, 2.90], target: [-0.90, 1.32, -0.30] },
    /* ⚠️ 这里**故意不写 minAz / maxAz** —— 「镜头自由」：
       墙/天花/地面都是单面板（法线朝内），相机绕到墙外时被背面剔除，
       直接看进室内；加了方位角限位反而把「绕到背后看一眼」禁掉。
       极角仍然限位：minPol 允许俯视，maxPol 压住别钻到地面以下。 */
    limits: { minPol: 0.05, maxPol: Math.PI * 0.545, minD: 0.06, maxD: 12 },
    lights: [
      // 厂房整体：明亮、偏中性（区别于配电装置室的冷白工业光）
      { type: 'hemi', sky: 0xdceaf6, ground: 0x616158, intensity: 0.66 },
      { type: 'ambient', color: 0xa4b4c0, intensity: 0.13 },
      // 主光：高窗斜射进来的日光
      {
        type: 'dir', color: 0xfff4e2, intensity: 1.45, pos: [-7.0, 6.6, -3.4], target: [0.4, 1.15, 0.2],
        shadow: true, shadowSize: 2048,
        shadowCam: { left: -8, right: 8, top: 7, bottom: -7, near: 1, far: 30 },
      },
      // 工矿灯暖光（工位上方）
      {
        type: 'spot', color: 0xffeacb, intensity: 20, distance: 12, angle: 0.95, penumbra: 0.92, decay: 2,
        pos: [-1.4, 3.85, 0.6], target: [PANEL.x, 1.15, PANEL.z + 0.2], shadow: false,
      },
      {
        type: 'spot', color: 0xffeacb, intensity: 14, distance: 12, angle: 0.95, penumbra: 0.92, decay: 2,
        pos: [2.6, 3.85, 0.6], target: [2.2, 1.0, -0.4], shadow: false,
      },
      // 补光：防止侧面死黑
      { type: 'dir', color: 0xcfe0ee, intensity: 0.40, pos: [6.5, 3.2, 5.0], target: [0, 1.1, -0.4] },
    ],
  };
}
