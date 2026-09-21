/**
 * kyn28.js —— 户内场景：KYN28 中置式开关柜 · 继电器（二次）室
 */
import * as THREE from 'three';
import { M } from '../mats.js';
import {
  rbox, plate, cyl, bar, grp, at, doorPanel, cabinetShell, dinRail,
  wireDuct, terminalRow, hinge, handle, lockKey, gland, nameplateTex,
  ceilingLightStrip, roomBox, floorPlane, cableBundle, insulator, contactShadow,
} from '../parts.js';
import { buildProductModel } from '../product-models.js';
import { hotspot, placeOnRail, cullRailBlanks, mountElement, regElement } from '../scene-kit.js';
import { isolateMaterials } from '../mats.js';
import { canvasTex } from '../util.js';

/* ---------------- 尺寸常量 ---------------- */
const CW = 0.80;      // 柜宽
const CH = 2.30;      // 柜高
const CD = 1.50;      // 柜深
const GAP = 0.008;
const CZ = -1.35;     // 柜中心 z
const FRONT = CZ + CD / 2;   // 世界坐标：柜前表面 z（供 root 级对象用）
const LF = CD / 2;           // 柜局部坐标：柜前表面 z（供柜体子对象用）

/* 柜前从上到下分区 */
const ZONE = {
  cable: { y0: 0.06, y1: 0.78 },
  truck: { y0: 0.78, y1: 1.72 },
  relay: { y0: 1.72, y1: 2.22 },
};

/* 继电器室内布局 */
const PLATE_Z = 0.40;
const RAIL_A = 2.07;
const RAIL_B = 1.90;
/* DIN 导轨前表面 z（导轨中心 + 0.005，见 parts.js 的 dinRail 剖面）。
   产品与盲板统一按「背面贴这条线」摆，导轨就永远被它们挡住，不会横在器件脸前面。 */
const RAIL_FRONT = PLATE_Z + 0.024 + 0.005;

/* ---------------- 单个柜体 ----------------
 * explodeParts:false —— 不把这台柜的子总成登记成爆炸组。
 *
 * ⚠️ 为什么要这个开关（draw call）：
 *   batchStatic 是**按作用域分别批处理**的（见 optimize.js 的 BOUNDARY），
 *   而每个爆炸组就是一个作用域。原先三台柜各 6 个爆炸组 = 18 个作用域，
 *   于是「A 柜的手车」和「C 柜的手车」里同一种材质永远合不到一起 ——
 *   实测 kyn28 因此多出 50 个批次组（101 组 → 272 个网格）。
 *   两侧柜本来就是闭合的、没有本公司产品、也不参与讲解，
 *   取消它们的爆炸组后，零件直接在**根作用域**合并，同材质跨柜合一。
 *   爆炸视图只展开中间那台（主角），语义反而更清楚。 */
/* 铭牌材质做成**模块级单例**：三台柜的铭牌文字完全相同，
   每台各建一份会白多出 2 张 512×256 贴图和 2 个材质桶。
   ⚠️ 共享材质 / 贴图必须打 userData.shared，否则 disposeTree 会把它们释放掉
      （下次进这个场景要重新生成贴图、重新编译材质）。 */
let _kynNameMat = null;
function kynNameMat() {
  if (!_kynNameMat) {
    const tex = nameplateTex('KYN28-12', '10kV 铠装移开式中置柜');
    tex.userData.shared = true;
    _kynNameMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
    _kynNameMat.userData.shared = true;
  }
  return _kynNameMat;
}

function buildCabinet({ open = false, tag = '', explodeParts = true } = {}) {
  const g = new THREE.Group();

  /* --- 壳体 --- */
  g.add(cabinetShell({ w: CW, h: CH, d: CD, plinth: 0.06 }));

  /* --- 柜内隔板（手车室 / 电缆室） --- */
  const sep1 = plate(CW - 0.05, CD - 0.05, 0.006, M.powderMid);
  sep1.rotation.x = Math.PI / 2; sep1.position.set(0, ZONE.truck.y1, 0);
  g.add(sep1);
  const sep2 = plate(CW - 0.05, CD - 0.05, 0.006, M.powderMid);
  sep2.rotation.x = Math.PI / 2; sep2.position.set(0, ZONE.truck.y0, 0);
  g.add(sep2);

  /* --- 手车（真空断路器小车，透过观察窗隐约可见） --- */
  const truck = new THREE.Group();
  const tBody = rbox(0.62, 0.42, 0.52, 0.006, M.powderDark, 1);
  tBody.position.y = 0.22;
  truck.add(tBody);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const wheel = cyl(0.028, 0.028, 0.02, M.pcBlack, 14);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 0.24, 0.028, sy * 0.16);
    truck.add(wheel);
  }
  // 真空灭弧室（三只）
  for (let i = -1; i <= 1; i++) {
    const v = cyl(0.055, 0.055, 0.20, M.pcBeige, 18);
    v.rotation.z = Math.PI / 2;
    v.position.set(i * 0.16, 0.30, 0.20);
    truck.add(v);
    const t1 = cyl(0.022, 0.022, 0.09, M.copper, 14);
    t1.rotation.z = Math.PI / 2; t1.position.set(i * 0.16, 0.30, 0.34); truck.add(t1);
    const t2 = t1.clone(); t2.position.z = 0.06; truck.add(t2);
  }
  // 触臂
  for (let i = -1; i <= 1; i++) {
    const arm = bar(0.03, 0.03, 0.34, M.copper);
    arm.position.set(i * 0.16, 0.30, 0.46);
    truck.add(arm);
  }
  truck.position.set(0, ZONE.truck.y0 + 0.02, -0.10);
  if (explodeParts) truck.userData.explode = [0, 0, 0.36];
  /* 手车「摇出 / 推入」（见 app.js 的 collectMovers）。
     行程 0.34m：门开着时手车前端刚好探出柜前，视觉上真的「摇出来了」。
     ⚠️ 不能再长 —— 门关着时手车被门板挡着，再探出去就是穿模。所以配了两道联锁：
          guard()   门没开不许摇出（真机也要先开门才能操作手车）
          onClose() 关门之前先把手车推回柜内，免得门扇从手车身上扫过去 */
  /* ⚠️ 这里**不写**自定义 guard —— 「门没开够不许摇出」由 app.js 的通用机制负责：
     `slide.door` 指到那扇门，`_slideBlock()` 比 `_slideGate()` 的门槛（默认 0.6）。
     一度两套并存（闭包门槛 0.5、通用 0.6），两个真相源、数值还不一致。
     `door` 见下面 g.add(truckPivot) 之后的回填。 */
  truck.userData.slide = { open: [0, 0, 0.34] };
  g.add(truck);

  /* --- 前门（分三段） --- */
  /* ⚠️ 三扇前门都挂在 pivot 上（而不是直接 g.add）—— 要做成**可开合**。
     铰点统一放在柜体左前边缘，门扇中心挂在 local +x（朝门洞那一侧），
     所以 rotation.y = 0 就是关闭（门扇正好盖在门洞上），负角往柜前（+z）开。
     见 app.js 的 collectDoors / applyDoors。 */

  // 电缆室门
  const dCable = doorPanel({
    w: CW - 0.012, h: ZONE.cable.y1 - ZONE.cable.y0, t: 0.016,
    windows: [{ x: 0, y: 0.10, w: 0.30, h: 0.22 }],
    lock: { x: 0.30, y: -0.12 },
    hinges: [-0.22, 0.22],
  });
  const cablePivot = new THREE.Group();
  cablePivot.position.set(-CW / 2 + 0.006, (ZONE.cable.y0 + ZONE.cable.y1) / 2, LF + 0.008);
  dCable.position.set((CW - 0.012) / 2, 0, 0);
  cablePivot.add(dCable);
  /* 初始保持关闭（不跟 `open` 走）：三扇门同时敞开会在柜前叠出三片钣金，
     正面机位下互相遮挡。让用户点哪扇开哪扇。 */
  cablePivot.userData.door = { open: -1.72, closed: 0 };
  if (explodeParts) cablePivot.userData.explode = [0, 0, 0.60];
  g.add(cablePivot);

  // 手车室门（带大观察窗 + 摇把操作孔）
  const dTruck = doorPanel({
    w: CW - 0.012, h: ZONE.truck.y1 - ZONE.truck.y0, t: 0.018,
    /* ⚠️ 第 55 轮：观察窗由 (y 0.06, h 0.34) 下调成 (y 0.00, h 0.30) ——
       为的是在窗上方腾出装 SMART_OPS 的净空。门扇局部 y ∈ [-0.47, 0.47]，
       扣掉折边 18mm 后可用到 0.452；原窗顶 0.23 ⇒ 只剩 222mm，
       而操显装置高 230mm —— 差 8mm 就是装不下。窗下移 60mm、缩 40mm 后窗顶 0.15，
       净空 302mm，装置盒落在 0.185~0.415，上下各留 35 / 37mm。
       窗底 0.15 距摇把孔顶（-0.28）仍有 430mm，没有压到门上已有的件。 */
    windows: [{ x: -0.06, y: 0.00, w: 0.44, h: 0.30 }],
    handle: { x: 0.30, y: -0.02 },
    lock: { x: 0.30, y: -0.22 },
    hinges: [-0.28, 0.28],
  });
  const truckPivot = new THREE.Group();
  truckPivot.position.set(-CW / 2 + 0.006, (ZONE.truck.y0 + ZONE.truck.y1) / 2, LF + 0.008);
  dTruck.position.set((CW - 0.012) / 2, 0, 0);
  truckPivot.add(dTruck);
  truckPivot.userData.door = { open: -1.72, closed: 0 };
  if (explodeParts) truckPivot.userData.explode = [0, 0, 0.60];
  g.add(truckPivot);
  /* 回填「这扇手车归哪扇门管」（联锁与收回都靠它，见 app.js 的 _slideBlock / _retractSlides）。
     ⚠️ 必须在这里回填，不能写在上面那个对象字面量里 —— `door: truckPivot` 是**立即求值**，
        而那时 truckPivot 还在 TDZ 里，build 会直接抛 ReferenceError，
        整个场景装载中断（用户看到的是「一直在转圈」）。
     也⚠️ 不能让 app.js 按「离得最近的门」去猜：手车在 y=0.80，
        电缆室门铰点 y=0.42、手车室门铰点 y=1.25 —— 电缆室门反而更近，猜出来是错的。 */
  truck.userData.slide.door = truckPivot;
  /* 摇把操作孔 / 带电显示器 / 铭牌 —— 都长在**门板**上（真机也是），必须挂 dTruck。
     ⚠️ 原先这几个件是加在柜体 g 上的，位置恰好贴着门板前表面。门做成可开合之后，
        门一开它们就留在原地悬在半空 —— 一眼假。
     坐标换到门扇局部系：原点在门扇中心，+z 朝柜外，门板前表面在 z = t/2 = 0.009。 */
  const DCY = (ZONE.truck.y0 + ZONE.truck.y1) / 2;        // 门扇中心 y（＝ pivot 的 y）
  const dl = (x, y, dz) => [x, y - DCY, 0.018 / 2 + dz];  // 柜体系 → 门扇局部系
  // 摇把操作孔（推进/退出）
  const hole = cyl(0.030, 0.030, 0.012, M.powderDark, 20);
  hole.rotation.x = Math.PI / 2;
  hole.position.set(...dl(-0.30, ZONE.truck.y0 + 0.16, 0.002));
  dTruck.add(hole);
  const holeIn = cyl(0.020, 0.020, 0.010, M.pcBlack, 18);
  holeIn.rotation.x = Math.PI / 2;
  holeIn.position.set(...dl(-0.30, ZONE.truck.y0 + 0.16, 0.006));
  dTruck.add(holeIn);
  // 带电显示器
  for (let i = 0; i < 3; i++) {
    const d = cyl(0.009, 0.009, 0.006, M.ledRed, 14);
    d.rotation.x = Math.PI / 2;
    d.position.set(...dl(0.16 + i * 0.038, ZONE.truck.y0 + 0.14, 0.003));
    dTruck.add(d);
  }
  // 铭牌
  const nm = new THREE.Mesh(new THREE.PlaneGeometry(0.20, 0.10), kynNameMat());
  nm.position.set(...dl(-0.16, ZONE.truck.y0 + 0.16, 0.004));
  dTruck.add(nm);

  /* --- 继电器（二次）室门：可开 --- */
  const relayH = ZONE.relay.y1 - ZONE.relay.y0;
  const dRelay = doorPanel({
    w: CW - 0.012, h: relayH, t: 0.016,
    windows: [{ x: 0.14, y: 0.0, w: 0.26, h: 0.20 }],
    handle: { x: -0.30, y: 0.0 },
    lock: { x: -0.30, y: -0.14 },
  });
  // 门上多功能电力仪表
  const meter = grp();
  const mBody = rbox(0.10, 0.10, 0.05, 0.003, M.pcDark, 1);
  mBody.position.z = 0.02;
  meter.add(mBody);
  const mFace = plate(0.094, 0.094, 0.004, M.pcBlack, 0.002);
  mFace.position.z = 0.045;
  meter.add(mFace);
  const mTex = canvasTex(256, 256, (gg) => {
    gg.fillStyle = '#06100c'; gg.fillRect(0, 0, 256, 256);
    gg.strokeStyle = 'rgba(80,255,180,.16)'; gg.lineWidth = 2;
    gg.beginPath(); gg.arc(128, 128, 96, 0, Math.PI * 2); gg.stroke();
    gg.fillStyle = '#4dffb0'; gg.shadowColor = '#4dffb0'; gg.shadowBlur = 16;
    gg.font = '700 56px "SF Mono",Consolas,monospace'; gg.textAlign = 'center';
    gg.fillText('10.4', 128, 112);
    gg.font = '700 26px "SF Mono",Consolas,monospace';
    gg.fillText('kV', 128, 148);
    gg.fillStyle = '#7de8c0'; gg.font = '600 22px "SF Mono",monospace';
    gg.fillText('Ia 1.02A', 128, 190);
    gg.fillText('P 0.86', 128, 216);
  });
  const mScr = new THREE.Mesh(new THREE.PlaneGeometry(0.082, 0.082),
    new THREE.MeshStandardMaterial({ map: mTex, emissive: 0xffffff, emissiveMap: mTex, emissiveIntensity: 0.85, roughness: 0.3 }));
  mScr.position.z = 0.0475;
  meter.add(mScr);
  meter.position.set(-0.16, 0.02, 0);
  dRelay.add(meter);

  const hingeGroup = new THREE.Group();
  hingeGroup.position.set(-CW / 2 + 0.006, (ZONE.relay.y0 + ZONE.relay.y1) / 2, LF + 0.008);
  dRelay.position.set((CW - 0.012) / 2, 0, 0);
  hingeGroup.add(dRelay);
  if (open) hingeGroup.rotation.y = -1.83;   // ≈ -105°
  /* 二次室门做成可开合（见 app.js 的 collectDoors）：三台柜都能开，
     中柜那台初始就是开着的（露出继电器与仪表），两侧柜从关闭开始。 */
  hingeGroup.userData.door = { open: -1.83, closed: 0 };
  if (explodeParts) hingeGroup.userData.explode = [0, 0, 0.86];
  g.add(hingeGroup);
  for (const dy of [-0.18, 0.18]) {
    const h = hinge();
    h.position.set(-CW / 2 + 0.006, (ZONE.relay.y0 + ZONE.relay.y1) / 2 + dy, LF + 0.004);
    g.add(h);
  }

  /* --- 继电器室内部 --- */
  const inner = new THREE.Group();
  if (explodeParts) inner.userData.explode = [0, 0, 0.34];
  // 安装板
  const mp = plate(CW - 0.06, relayH - 0.02, 0.004, M.powderWhite);
  mp.position.set(0, (ZONE.relay.y0 + ZONE.relay.y1) / 2, PLATE_Z);
  inner.add(mp);
  // 加强折边
  for (const sx of [-1, 1]) {
    const e = bar(0.006, relayH - 0.02, 0.018, M.powderWhite);
    e.position.set(sx * (CW / 2 - 0.033), (ZONE.relay.y0 + ZONE.relay.y1) / 2, PLATE_Z - 0.011);
    inner.add(e);
  }
  // DIN 导轨 ×2（沿柜宽方向横跨安装板）
  for (const [ry, rw] of [[RAIL_A, 0.68], [RAIL_B, 0.68]]) {
    const r = dinRail(rw);
    r.position.set(0, ry, PLATE_Z + 0.024);
    inner.add(r);
  }
  // 走线槽（同样沿柜宽方向）
  for (const [dy, dw, dh] of [[2.19, 0.05, 0.036], [1.985, 0.05, 0.036], [1.735, 0.05, 0.028]]) {
    const d = wireDuct(0.68, dw, dh);
    d.position.set(0, dy, PLATE_Z + 0.024);
    inner.add(d);
  }
  // 端子排
  const tr = terminalRow(26, { w: 0.0072, h: 0.05, d: 0.048 });
  tr.position.set(0, 1.80, PLATE_Z + 0.022);
  inner.add(tr);
  // 二次电缆束
  const cb = cableBundle(6, 0.22, { r: 0.0045, spread: 0.05 });
  cb.rotation.y = Math.PI / 2;
  cb.position.set(0, 1.72, PLATE_Z + 0.01);
  inner.add(cb);

  /* --- 空白填充模块（让导轨看起来是真实在用的） ---
     两处要点，都是踩坑换来的：
     ① 背面要贴在导轨前表面上（RAIL_FRONT）。BoxGeometry 的原点在几何中心，
        所以中心 = 背面 + 半个厚度；原先把中心直接放在导轨 z 上，盲板整体后移了半个身位，
        前脸和两侧产品差 39mm。
     ② 不再手写「哪几个槽不补盲板」的表。产品比一个槽宽（FA 96mm / THC 90mm / RMY 75mm），
        手写表只会跳过产品自己那一槽，紧邻的盲板就横插进产品壳体（实测 25.5mm）。
        改成挂完产品后由 cullRailBlanks() 按真实包围盒剔除，两者永远一致。 */
  const BLANK_D = 0.078;
  const blankGeo = new THREE.BoxGeometry(0.045, 0.09, BLANK_D);
  const blankZ = RAIL_FRONT + BLANK_D / 2;
  for (const ry of [RAIL_A, RAIL_B]) {
    for (let i = 0; i < 15; i++) {
      const b = new THREE.Mesh(blankGeo, M.pcGray);
      b.position.set(-0.34 + 0.0225 + i * 0.045, ry, blankZ);
      b.castShadow = true;
      b.userData.blank = true;          // 供 cullRailBlanks 识别
      inner.add(b);
    }
  }

  g.add(inner);

  /* --- 柜顶小母线室 --- */
  const busBox = rbox(CW - 0.02, 0.12, 0.40, 0.004, M.powderLight, 1);
  busBox.position.set(0, CH + 0.06 + 0.06, LF - 0.20);
  if (explodeParts) busBox.userData.explode = [0, 0.34, 0];
  g.add(busBox);
  const busVent = new THREE.Mesh(new THREE.PlaneGeometry(CW - 0.12, 0.06), M.perf);
  busVent.rotation.x = -Math.PI / 2;
  busVent.position.set(0, CH + 0.12 + 0.061, LF - 0.20);
  g.add(busVent);

  /* --- 柜后电缆沟出口 + 格兰头 --- */
  for (let i = -1; i <= 1; i++) {
    const gl = gland(M.brass, 0.014);
    gl.rotation.y = Math.PI;
    gl.position.set(i * 0.20, 0.16, -CD / 2 + 0.02);
    g.add(gl);
  }

  g.userData.inner = inner;
  g.userData.railA = RAIL_A;
  g.userData.railB = RAIL_B;
  g.userData.plateZ = PLATE_Z;
  /* 三扇前门（第 55 轮补）：面板型元件（操显装置一类）要挂在**门扇**上，
     而门扇是 buildCabinet 的局部变量 —— 不导出的话外层根本拿不到。
     ⚠️ 挂门扇上是对的：门是 movers，装置必须跟着门一起开合。 */
  g.userData.doors = { cable: dCable, truck: dTruck, relay: dRelay };
  return g;
}

/* ---------------- 场景构建 ---------------- */
export function build() {
  const root = new THREE.Group();
  const hotspots = [];

  const ROOM = { w: 9.2, h: 3.06, d: 7.0 };

  /* --- 房间 --- */
  root.add(roomBox({ w: ROOM.w, h: ROOM.h, d: ROOM.d, floorMat: M.epoxyFloor }));

  // 环氧地坪分格缝
  for (let i = -2; i <= 2; i++) {
    const l = bar(ROOM.w, 0.002, 0.012, M.wallDark);
    l.position.set(0, 0.001, i * 1.6);
    root.add(l);
    const l2 = bar(0.012, 0.002, ROOM.d, M.wallDark);
    l2.position.set(i * 1.9, 0.001, 0);
    root.add(l2);
  }

  // 电缆沟盖板（柜前）
  const trench = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const p = rbox(0.98, 0.03, 0.52, 0.004, M.aluDark, 1);
    p.position.set(-2.45 + i * 1.0, 0.015, -0.05);
    trench.add(p);
  }
  root.add(trench);

  // 后墙二次电缆桥架
  const tray = new THREE.Group();
  const trayLen = 7.4;
  for (const y of [2.62, 2.90]) {
    const t = bar(trayLen, 0.05, 0.006, M.aluDark);
    t.position.set(0, y, -ROOM.d / 2 + 0.24);
    tray.add(t);
  }
  const trayBot = bar(trayLen, 0.006, 0.30, M.aluDark);
  trayBot.position.set(0, 2.58, -ROOM.d / 2 + 0.39);
  tray.add(trayBot);
  for (let i = 0; i < 14; i++) {
    const rung = bar(0.012, 0.34, 0.006, M.aluDark);
    rung.position.set(-3.5 + i * 0.54, 2.75, -ROOM.d / 2 + 0.24);
    rung.rotation.x = Math.PI / 2;
    tray.add(rung);
  }
  // 桥架里的电缆
  for (let i = 0; i < 7; i++) {
    const c = cyl(0.011, 0.011, trayLen, i % 2 ? M.cable : M.rubber, 10);
    c.rotation.z = Math.PI / 2;
    c.position.set(0, 2.70 + (i % 3) * 0.012, -ROOM.d / 2 + 0.20 + Math.floor(i / 3) * 0.05);
    tray.add(c);
  }
  root.add(tray);

  // 沿墙落下的电缆束
  const drop = cableBundle(5, 1.2, { r: 0.009, spread: 0.06 });
  drop.position.set(-3.4, 2.60, -ROOM.d / 2 + 0.30);
  root.add(drop);
  const drop2 = cableBundle(4, 1.6, { r: 0.008, spread: 0.05 });
  drop2.position.set(3.3, 2.60, -ROOM.d / 2 + 0.30);
  root.add(drop2);

  // 天花板灯带
  for (const z of [-1.35, 1.15]) {
    for (const x of [-2.5, 2.5]) {
      const s = ceilingLightStrip(1.9);
      s.position.set(x, ROOM.h - 0.10, z);
      root.add(s);
    }
  }

  /* --- 左墙陈设（真实配电室的“生活痕迹”） --- */
  const wall = new THREE.Group();
  /* ⚠️⚠️ 第 60 轮：这一组挂墙件的 `rbox` 尺寸**写反了轴**。
     `rbox(w, h, d)` 的第一维是 **x 方向的尺寸**；挂左墙的箱子 x 方向该是「离墙进深」。
     证据是偏移量的算法：下面每一处的 x 偏移都恰好 = 「第三维 ÷ 2 + 0.01」
     （0.13 ≈ 0.24/2+0.01、0.22 = 0.42/2+0.01、0.12 = 0.22/2+0.01、0.03 ≈ 0.035/2+0.01）
     —— 作者是按「第三维 = 进深」算的位置，却把「宽度」写在了第一维。
     后果：箱体横着扎进墙里（`wall_clear_probe` 实测 40~240mm），画面上就是
     「一只柜子半嵌在墙里」。修法只对调第一维与第三维，**坐标一律不动**。 */
  const pbox = rbox(0.24, 0.62, 0.52, 0.005, M.powderMid, 1);
  pbox.position.set(-ROOM.w / 2 + 0.13, 1.62, -1.35);
  wall.add(pbox);
  for (let i = 0; i < 3; i++) {
    const sock = rbox(0.02, 0.09, 0.09, 0.003, M.pcBeige, 1);
    sock.position.set(-ROOM.w / 2 + 0.26, 1.80 - i * 0.16, -1.25);
    wall.add(sock);
  }
  const pLed = cyl(0.012, 0.012, 0.006, M.ledGreen, 12);
  pLed.rotation.z = Math.PI / 2;
  pLed.position.set(-ROOM.w / 2 + 0.26, 1.34, -1.23);
  wall.add(pLed);
  const tool = rbox(0.42, 1.86, 0.92, 0.006, M.powderMid, 1);
  tool.position.set(-ROOM.w / 2 + 0.22, 0.95, 1.45);
  wall.add(tool);
  const toolDoor = plate(0.86, 1.78, 0.012, M.powderLight);
  toolDoor.rotation.y = Math.PI / 2;
  toolDoor.position.set(-ROOM.w / 2 + 0.44, 0.95, 1.45);
  wall.add(toolDoor);
  const th = handle(0.14);
  th.rotation.y = Math.PI / 2;
  th.position.set(-ROOM.w / 2 + 0.47, 1.00, 1.17);
  wall.add(th);
  const hygro = rbox(0.035, 0.10, 0.14, 0.004, M.powderWhite, 1);
  hygro.position.set(-ROOM.w / 2 + 0.03, 1.86, 0.20);
  wall.add(hygro);
  const hygroFace = plate(0.10, 0.07, 0.004, M.pcBlack);
  hygroFace.rotation.y = Math.PI / 2;
  hygroFace.position.set(-ROOM.w / 2 + 0.05, 1.86, 0.20);
  wall.add(hygroFace);

  // 灭火器箱（红）+ 两只手提式灭火器
  const extBox = rbox(0.22, 0.62, 0.46, 0.005, M.powderMid, 1);
  extBox.position.set(-ROOM.w / 2 + 0.12, 0.34, -2.35);
  wall.add(extBox);
  const extDoor = plate(0.42, 0.56, 0.012, new THREE.MeshStandardMaterial({ color: 0x9c2f2a, roughness: 0.5, metalness: 0.12 }));
  extDoor.rotation.y = Math.PI / 2;
  /* 门贴在箱体**正面**（箱改对之后正面在 -ROOM.w/2+0.23）—— 原来 0.24 是相对
     「横着伸出去」的错误箱体算的，现在差 6mm，落到箱体里去了。 */
  extDoor.position.set(-ROOM.w / 2 + 0.236, 0.34, -2.35);
  wall.add(extDoor);
  /* 两只手提式灭火器：箱体改对之后它们会**露在箱门外**（原来被错误箱体整个包住、
     根本看不见），所以移到箱体北侧的地面上立着。
     ⚠️ 顺手修掉「悬空」：原来中心 y=0.20、瓶高 0.34 ⇒ 瓶底离地 30mm。 */
  for (let i = 0; i < 2; i++) {
    const b = cyl(0.055, 0.055, 0.34, new THREE.MeshStandardMaterial({ color: 0xa8322c, roughness: 0.44, metalness: 0.15 }), 16);
    b.position.set(-ROOM.w / 2 + 0.18, 0.17, -1.90 - i * 0.16);
    wall.add(b);
    const hd = cyl(0.016, 0.016, 0.03, M.pcBlack, 12);
    hd.position.set(-ROOM.w / 2 + 0.18, 0.35, -1.90 - i * 0.16);
    wall.add(hd);
  }

  // 柜前绝缘胶垫（真实配电室必配）
  const mat = rbox(2.7, 0.012, 0.62, 0.004, new THREE.MeshStandardMaterial({ color: 0x1d2422, roughness: 0.86, metalness: 0.0 }), 1);
  mat.position.set(0, 0.008, CZ + 0.95);
  wall.add(mat);
  const matEdge = bar(2.7, 0.014, 0.02, new THREE.MeshStandardMaterial({ color: 0x2f6b4c, roughness: 0.7 }));
  matEdge.position.set(0, 0.010, CZ + 0.95 - 0.31);
  wall.add(matEdge);

  // 墙角“止步 高压危险”警示牌
  const sign = plate(0.34, 0.24, 0.008, M.powderWhite);
  sign.rotation.y = Math.PI / 2;
  sign.position.set(ROOM.w / 2 - 0.02, 1.72, -2.15);
  wall.add(sign);
  const signFace = canvasTex(256, 180, (gg) => {
    gg.fillStyle = '#e8e6de'; gg.fillRect(0, 0, 256, 180);
    gg.fillStyle = '#c8951f'; gg.beginPath();
    gg.moveTo(128, 14); gg.lineTo(240, 158); gg.lineTo(16, 158); gg.closePath(); gg.fill();
    gg.fillStyle = '#1a1d20'; gg.font = '700 30px "PingFang SC","Microsoft YaHei",sans-serif';
    gg.textAlign = 'center'; gg.textBaseline = 'middle';
    gg.fillText('高压危险', 128, 104);
    gg.font = '800 44px "PingFang SC","Microsoft YaHei",sans-serif';
    gg.fillText('止步', 128, 146);
  });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.225),
    new THREE.MeshStandardMaterial({ map: signFace, roughness: 0.62 }));
  signMesh.rotation.y = -Math.PI / 2;
  signMesh.position.set(ROOM.w / 2 - 0.035, 1.72, -2.15);
  wall.add(signMesh);
  root.add(wall);

  /* --- 三面柜列 --- */
  const cabinets = [];
  /* ⚠️ 只有中间柜（主角）登记爆炸组。两侧柜闭合、没有本公司产品、也不参与讲解，
     取消它们的爆炸组后，柜内零件直接在**根作用域**合并 —— 三台柜的同材质零件
     （钣金、门板、手车壳体、导轨、盲板…）终于能跨柜合进同一批，draw call 从 295 降到预算内。
     见 buildCabinet 的 explodeParts 注释。 */
  const cfgs = [
    { open: false, tag: 'A', explodeParts: false },
    { open: true, tag: 'B' },     // 中间柜：二次室门打开（主角），保留爆炸组
    { open: false, tag: 'C', explodeParts: false },
  ];
  cfgs.forEach((cfg, i) => {
    const cab = buildCabinet(cfg);
    cab.position.set((i - 1) * (CW + GAP), 0, CZ);
    root.add(cab);
    cabinets.push(cab);
  });

  /* ---------- 柜顶并柜母线桥（第 55 轮：改成「盖板取下」的示意形态） ----------
     `kyn28.elements` 一直声明着 BUS 与 INSULATOR，但 KYN28 的**母线室在继电器室
     之后**（正面剖分模型里没有它的位置），这两件只能在**柜顶母线桥**里表达 ——
     正好对上档案口径：`BUS.where` 写的是「开关柜母线室、**低压柜顶部**」，
     `INSULATOR.role` 写的是「**支撑并固定母线**，保证带电体与柜体之间的绝缘距离」。
     ⚠️ 桥体**外形尺寸完全不变**（1.716 × 0.16 × 0.50，y 2.380~2.527）——
        只把原来的实心方块拆成「槽底 + 前后矮帮 + 三相主母线 + 支柱绝缘子」，
        顶盖不装（读作「检修时盖板已取下」）。这样 `fit` 盒与默认取景一个字都不用改。
     ⚠️ 母线桥是**静止件**，会被 batchStatic 合进材质桶 —— 所以整桥建在一个
        带位置的 Group 里（`bridgeG`），两个热点组再各自带位置：
        `hotspot.anchor` 用的是 **object 的世界原点 + offset**，不是包围盒中心，
        组不带位置的话锚点会掉到 (0,0,0) 的地面上（gis 的 busGroup 就是靠
        「自身不位移、子件直接用世界坐标」绕开这一点的）。 */
  const span = 2 * (CW + GAP) + 0.1;     // 1.716，与原桥体同宽
  const BY0 = CH + 0.08;                 // 2.380，与原桥体同底
  const bridgeG = new THREE.Group();
  bridgeG.position.set(0, BY0, FRONT - 0.24);
  root.add(bridgeG);

  /* ⚠️ 变量名不能叫 trayBot —— build() 里「后墙二次电缆桥架」那一段已经有一个
     `const trayBot`，同函数作用域重复声明会直接 SyntaxError，整个模块白屏。 */
  const brTrayBot = rbox(span, 0.012, 0.50, 0.004, M.powderLight, 1);
  brTrayBot.position.set(0, 0.006, 0);
  bridgeG.add(brTrayBot);
  /* ⚠️ 矮帮高度 75mm → 45mm → **20mm**（第 55 轮出图后连改两次）。
     为什么非得这么矮 —— 默认机位在 **y = 2.0**，而桥体底面在 **2.380**：
     **镜头比桥体还低**，是仰视，前侧矮帮就是一道挡板。抬高系数
     k = d_ins/d_wall = 3.715/3.502 = **1.0608** ⇒ 绝缘子被挡到
     y_v = 2.0 + k·(0.392 + h)。算下来 h=75 只剩 0mm、h=45 只剩 12mm、
     **h=20 才有 39mm（约 4 片伞裙）**。也就是说只要镜头还在桥体下方，
     矮帮每高 1mm 就多挡 1.06mm，「像槽」和「看得见绝缘子」直接冲突 ——
     取后者，因为 `INSULATOR` 正是第 55 轮专门补进来的元件。
     （另一条路是把绝缘子加高到 100mm+，但那样桥体包络会从 2.527 顶到 2.557，
       得同步改 `fit.parts[1]`；降矮帮的包络一个字不用动，风险最小。） */
  for (const sz of [-1, 1]) {
    const side = bar(span, 0.020, 0.012, M.powderLight);
    side.position.set(0, 0.022, sz * 0.244);
    bridgeG.add(side);
  }

  /* 三相主母线：矩形铜排**立放**（宽面竖直），沿 x 贯通三面柜。
     母线下沿 2.477，正好坐在支柱绝缘子的金属帽顶上（帽顶 2.476）——
     只留 1mm 缝隙，几何上**不重叠**（重叠会被 railfit_probe 报出来）。 */
  const busBars = new THREE.Group();
  busBars.position.set(0, 0.122, 0);
  bridgeG.add(busBars);
  for (let k = -1; k <= 1; k++) {
    const b = bar(span, 0.05, 0.012, M.copper);
    b.position.set(0, 0, k * 0.12);
    busBars.add(b);
  }

  /* 支柱绝缘子：每面柜一相一只（3 柜 × 3 相 = 9 只），坐在槽底上把主母线托起来。
     ⚠️ 母线桥跨度 1.716、三相间距 0.12 ⇒ 绝缘子伞裙（φ80.6）之间还有 39mm 净空。 */
  const insGroup = new THREE.Group();
  insGroup.position.set(0, 0.012, 0);
  bridgeG.add(insGroup);
  for (const cx of [-(CW + GAP), 0, CW + GAP]) {
    for (let k = -1; k <= 1; k++) {
      const ins = insulator(0.070, M.pcBeige);
      ins.position.set(cx, 0, k * 0.12);
      insGroup.add(ins);
    }
  }

  /* 两个热点**横向错开**锚点：它们上下只差 270mm，在默认机位（距桥 3.5m）
     投影出来会叠在一起。 */
  regElement(hotspots, 'BUS', busBars, {
    off: [0.34, 0.02, 0.06],
    note: '柜顶并柜母线桥 · 三相主母线（矩形铜排，沿柜列贯通）',
  });
  regElement(hotspots, 'INSULATOR', insGroup, {
    off: [-0.34, -0.14, 0.06],
    note: '柜顶母线桥 · 支柱绝缘子（支撑三相主母线，保证对桥体的绝缘距离）',
  });

  /* --- 产品安装（中间柜继电器室） --- */
  const mid = cabinets[1];
  const midX = 0;
  const midInner = mid.userData.inner;   // 产品挂到内装板，爆炸视图时随安装板一起移出

  /** 把一个产品装到导轨上，并注册热点 */
  function mount(id, railY, slotIndex, opt = {}) {
    const p = buildProductModel(id);
    const x = -0.34 + 0.0225 + slotIndex * 0.045;
    // 背面贴导轨前表面：panelMeter 的原点在前脸、dinModule 的在几何中心，
    // 直接设 position 会让同一条导轨上的产品背面差 d/2 ≈ 40~55mm
    placeOnRail(p, { x, y: railY, zBack: RAIL_FRONT + (opt.dz || 0) });
    p.rotation.y = 0;                  // 正面朝 +Z
    isolateMaterials(p);
    midInner.add(p);                   // 挂到中柜继电器室安装板（跟随柜体/爆炸位移）
    p.userData.pid = id;

    hotspots.push(hotspot(id, p, {
      offset: [0, 0.030, 0.02],
      note: opt.note || '',
    }));
    return p;
  }

  mount('RC', RAIL_A, 1, { note: '二次室 · 上排左起第 1 只' });
  mount('RL-TBJ', RAIL_A, 4, { note: '二次室 · 上排（防跳回路）' });
  mount('RDP', RAIL_A, 7, { note: '二次室 · 上排（位置重动）' });
  mount('RT', RAIL_B, 2, { note: '二次室 · 下排左起' });
  mount('FA', RAIL_B, 5, { note: '二次室 · 下排（光字牌驱动）' });

  /**
   * 装一个**通用元件 / 外购主设备**（见 elements.js）。
   *
   * 与 mount() 的区别：产品模型的背面贴导轨，通用元件的原点是几何中心 ——
   * 所以这里走 zBack（「背面贴这条线」），不套 placeOnRail。
   * 具体的材质 / 拾取代理约定都收在 scene-kit 的 mountElement 里，四个户内场景共用。
   */
  function mountElem(gid, opt = {}) {
    return mountElement(midInner, hotspots, gid, {
      zBack: PLATE_Z, ...opt,
    });
  }

  /* ---- 继电器室里的通用元件：真实柜内同样存在，缺了就不像真柜 ----
     端子排与走线槽是纯结构件，标签默认不出（悬停 / 点左栏列表照样看得到），
     否则二次室里 10 个标签会互相压 —— 自家产品那一批反而被挤掉。 */
  mountElem('PROT', {
    build: { w: 0.22, h: 0.14, d: 0.20 }, x: 0.27, y: 2.02, z: 0.50,
    note: '继电器室右侧 · 外购微机综保装置',
  });
  /* 走 zBack（而不是直接给 z）——等价于「背面贴导轨前表面」，
     同时会打上 railMounted，导轨盲板才会像避让产品一样避让它。 */
  mountElem('MCB', { x: 0.1325, y: RAIL_A, zBack: RAIL_FRONT, note: '上排导轨 · 二次回路微断' });
  mountElem('TEMPCTRL', { x: -0.3175, y: RAIL_B, zBack: RAIL_FRONT, note: '下排导轨 · 柜内防凝露' });
  /* ---------- 第 52 轮：一体化保护测控装置（`kyn28.elements` 声明了 IED） ----------
     ⚠️⚠️ 继电器室只有 500mm 高（`ZONE.relay` = 1.72~2.22）且被两排导轨占满：
         TERMINAL 1.764~1.825 / RAIL_B 器件 1.852~1.948 /
         PROT 1.950~2.090 / RAIL_A 器件 2.024~2.116 / METER 2.146~2.194 / DUCT 2.176~2.227。
         ⇒ **没有任何 ≥180mm 的连续空带** ⇒ IED 装到**继电器室下方**（手车室上部）。
         那里 VCB 顶 1.517、TERMINAL 底 1.764 ⇒ 空带 **1.517~1.764（247mm）**。
         IED 155×180×90 取 y = 1.64（盒 1.55~1.73），上留 34mm、下留 33mm。
     ⚠️ `mountElem` 已经把 `zBack` 默认设成 `PLATE_Z`（内装板面 0.40），这里不用再给。 */
  mountElem('IED', {
    x: 0, y: 1.64,
    note: '继电器室下方 · 一体化保护测控装置（保护+测量+控制+通信四合一）',
  });

  /* ---- 第 55 轮：智能操作显示装置（`kyn28.elements` 声明了 SMART_OPS） ----
     为什么是这一件：客户问「不用你们那些专用继电器，柜里长什么样、拿什么代替」，
     柜内那两排（可插拔 / 超薄）答的是「继电器换继电器」；
     这一件答的是**另一种设计思路** —— 一块屏把「位置监视继电器 + 光字牌报警回路 +
     一排指示灯与按钮」全替掉，柜门开孔与二次接线都大幅减少。
     ⚠️ 落点先算净空（门扇局部系，原点在门扇中心，宽 0.788 / 高 0.94）：
          x ∈ [-0.394, 0.394]、y ∈ [-0.47, 0.47]，扣掉折边 18mm 后可用到 ±0.452；
          观察窗 (x -0.06, y 0.00, 0.44×0.30) → x ∈ [-0.28, 0.16]、y ∈ [-0.15, 0.15]；
          把手 (0.30, -0.02)、锁 (0.30, -0.22)、摇把孔 (-0.30, -0.31)、
          带电显示器 (0.16~0.236, -0.33)、铭牌 (-0.16, -0.31) 200×100。
        ⇒ **窗上方** y ∈ [0.15, 0.452] 净空 302mm，装置盒取 y = 0.30
          （0.185~0.415），上下各留 35 / 37mm；x = 0（0.09~0.09 宽），
          离把手（x 0.30）在 x 上完全不重叠。
     z = 门板半厚 0.009 + 装置半厚 0.0225 = 0.0315（贴门板外表面）。
     ⚠️ 挂在**中柜（主角柜）**的手车室门上：它默认是关着的、正面朝 +z，
        默认机位在柜的右前方，装置正对镜头；而三面柜的手车室门都是 movers，
        装置会跟着门一起开合（门枢在 optimize.js 的 BOUNDARY 里，
        不会被合进静态批 —— 合进去就会「门开了装置留在原地」）。 */
  mountElement(mid.userData.doors.truck, hotspots, 'SMART_OPS', {
    x: 0, y: 0.30, z: 0.0315,
    /* ⚠️ 这里**只竖直抬起、不做横向错开**（第 55 轮最终结论）。
       中途一度加过 `off: [-0.34, 0.14, 0.06]`，理由是「标签被避让算法挤掉」——
       **那个猜测是错的**：`label55.js` 扫 25 个锚点偏移一个都不行，
       `diag55.js` 才定位到真因是 `_updateDoorOcclusion()` 把「门板**前方** 20mm
       以内」也判成「门后」，而本件贴在门板**外表面**、锚点恰好落在这个带里
       ⇒ 标签被无声吞掉。修在 `app.js`（patch63e 拆容差 + patch63f 按门挂归属排除），
       与锚点位置无关。标签没有引线，锚点离元件越近越不容易读错，所以撤掉横向错开。 */
    off: [0, 0.14, 0.06],
    note: '手车室门 · 智能操作显示装置（模拟图 / 状态指示 / 分合闸操作 / 就地远方切换）',
  });

  /* ---- 第 48 轮：导轨上的「可插拔小型中间继电器」一组 ----
     为什么专门摆这一组：客户出差时最常见的反馈是「有些柜子用不到你们的专用继电器，
     只有几只可插拔的小继电器」—— 那就把它**真的装进这只柜里**，让人一眼看见
     「不用专用件的时候，柜里长这样」。右栏「继电器替代方案」那一段点进来，
     高亮的也正是这几只。
     ⚠️⚠️ x 是**手算**的，不能随手给。上排导轨上各件的占位（宽 0.045、节距 0.045）：
          RC(slot1) −0.295~−0.250 · RL-TBJ(slot4) −0.160~−0.115 ·
          RDP(slot7) −0.025~+0.020 · MCB(+0.1325, 宽 0.018) +0.1235~+0.1415。
        也就是说 RDP 与 MCB 之间有一段 **+0.020 ~ +0.1235（103mm）** 的空档，
        三只按 23mm 节距排在 0.045 / 0.068 / 0.091（占 0.0335~0.1025），
        左右各留 13mm / 21mm 余量。
        **改任何一个邻居的型号或位置，这段都要重新核** —— 压到邻居就是
        「盲板插进壳体」那一类穿模（第 44 轮踩过，实测 25.5mm）。
     ⚠️ 三只必须给**不同的 key**：`hotspotById` 是 Map，同 key 的后一只会**静默覆盖**
        前一只，点第 1 只却选中第 3 只，界面上完全看不出来。
     ⚠️ 下排导轨上 FA(slot5) 占到 −0.115~−0.070，所以时间继电器放 x=0（宽 0.038），
        离 FA 右沿还有 51mm。 */
  mountElem('RELAY_PLUG', {
    key: 'RELAY_PLUG#1', x: 0.045, y: RAIL_A, zBack: RAIL_FRONT,
    note: '上排导轨 · 可插拔小型中间继电器（第 1 只）',
  });
  mountElem('RELAY_PLUG', {
    key: 'RELAY_PLUG#2', x: 0.068, y: RAIL_A, zBack: RAIL_FRONT,
    note: '上排导轨 · 可插拔小型中间继电器（第 2 只）',
  });
  mountElem('RELAY_PLUG', {
    key: 'RELAY_PLUG#3', x: 0.091, y: RAIL_A, zBack: RAIL_FRONT,
    note: '上排导轨 · 可插拔小型中间继电器（第 3 只）',
  });
  mountElem('TIME_RELAY', {
    x: 0.0, y: RAIL_B, zBack: RAIL_FRONT,
    note: '下排导轨 · 时间继电器（延时回路）',
  });

  /* ---- 第 50 轮：下排右段补一叠「超薄型中间继电器」 ----
     上排已经摆了 3 只**可插拔**的，这里再摆**薄片式**的一叠 ——
     两种「通用做法」同框可比：可插拔 = 拔下来整只换；薄片式 = 一只只占 8.5mm，
     同一条导轨能塞下更多路。客户问「不用你们的专用件用什么」，
     这一格就是最直接的答案。
     ⚠️ 占位复核：RAIL_B 上 TEMPCTRL(x=-0.3175, 宽 75mm) · RT(槽2, x=-0.2275) ·
        FA(槽5, x=-0.0925) · TIME_RELAY(x=0, 宽 38mm ⇒ -0.019~+0.019)。
        导轨右沿 +0.34 ⇒ 右段 +0.019~+0.34 全空（321mm）。
        三只按 22mm 节距排在 0.070 / 0.092 / 0.114（占 0.066~0.118），左右余量充足。
     ⚠️ 三只必须给不同的 key。 */
  mountElem('RELAY_SLIM', {
    key: 'RELAY_SLIM#1', x: 0.070, y: RAIL_B, zBack: RAIL_FRONT,
    note: '下排导轨 · 超薄型中间继电器（第 1 只）',
  });
  mountElem('RELAY_SLIM', {
    key: 'RELAY_SLIM#2', x: 0.092, y: RAIL_B, zBack: RAIL_FRONT,
    note: '下排导轨 · 超薄型中间继电器（第 2 只）',
  });
  mountElem('RELAY_SLIM', {
    key: 'RELAY_SLIM#3', x: 0.114, y: RAIL_B, zBack: RAIL_FRONT,
    note: '下排导轨 · 超薄型中间继电器（第 3 只）',
  });

  /* ---- 第 55 轮：二次回路开关电源（`kyn28.elements` 声明了 PSU_G） ----
     真柜继电器室里一定有它 —— 保护装置、操显装置、光字牌都要 DC24V。
     ⚠️ 落点复核（RAIL_B = 1.90，导轨 x ∈ [-0.34, +0.34]）：
          TEMPCTRL(-0.3175, 宽 75) → [-0.355, -0.280]
          RT(槽 2, x=-0.2275, 宽 45) → [-0.250, -0.205]
          FA(槽 5, x=-0.0925, 宽 96) → [-0.141, -0.045]
          TIME_RELAY(0, 宽 38)      → [-0.019, +0.019]
          RELAY_SLIM ×3(0.070/0.092/0.114, 宽 8.5) → [+0.066, +0.118]
        ⇒ 右段 [+0.118, +0.34] 空 222mm；PSU_G 宽 55 ⇒ 取 x = 0.1655
          （占 0.138~0.193），左离 RELAY_SLIM 右沿 20mm、右离导轨端 147mm。
     ⚠️ 深度 110mm：背面贴 RAIL_FRONT(0.429) ⇒ 前脸 0.539，
        而继电器室门（关着时）在 z ≈ 0.758，净空 219mm，不会顶门。 */
  mountElem('PSU_G', {
    x: 0.1655, y: RAIL_B, zBack: RAIL_FRONT,
    note: '下排导轨 · 二次回路开关电源（给保护/操显装置供 DC24V）',
  });
  mountElem('METER', { x: 0.36, y: 2.17, z: 0.50, note: '继电器室上部 · 数显仪表' });
  mountElem('TERMINAL', {
    build: { count: 18 }, x: -0.20, y: 1.79, z: RAIL_FRONT - 0.03, quiet: true,
    note: '继电器室底部 · 二次端子排',
  });
  /* 线槽沿 X 铺（wireDuct 的长边就是 X），继电器室顶部横一条 */
  mountElem('DUCT', {
    build: { len: 0.70, w: 0.042, h: 0.048 }, x: 0, y: 2.20, z: RAIL_FRONT - 0.05, quiet: true,
    note: '继电器室顶部 · 走线槽',
  });

  /* ---- 手车室 / 电缆室：默认机位被柜门挡着，quiet 掉标签、点柜门即可选中 ---- */
  mountElem('VCB', { x: 0, y: 1.25, z: -0.06, quiet: true, note: '手车室 · 外购真空断路器手车' });
  /* ⚠️ ES 与 CT 在电缆室**上下叠放**。railfit_probe 实测（第 50 轮）：
     ES y 0.668~0.822 / CT y 0.470~0.696 ⇒ 原 y=0.74 时 y 压 28mm、z 压 6mm，
     且两只在 x 上完全重叠（都在 x=0）—— 这是真的体积相交，不是包围盒擦过。
     ES 上移 40mm 后底 0.708，与 CT 顶 0.696 留 12mm 净空。 */
  mountElem('ES', { x: 0, y: 0.78, z: 0.10, quiet: true, note: '电缆室上部 · 接地开关' });
  mountElem('CT', { x: 0, y: 0.58, z: 0.06, quiet: true, note: '电缆室 · 穿心式电流互感器' });
  mountElem('CABLETERM', { x: 0, y: 0.44, z: 0.26, quiet: true, note: '电缆室 · 进线电缆终端' });
  mountElem('GNDBAR', { build: { len: 0.60 }, x: 0, y: 0.14, z: 0.30, quiet: true, note: '电缆室底部 · 接地排' });
  mountElem('HEATER', { x: -0.28, y: 0.10, z: 0.55, quiet: true, note: '柜内下部 · 防凝露加热器' });

  /* ---- 柜顶排风（挂 root，因为它在柜壳外面） ----
     ⚠️ 两只风扇必须给不同的 key：hotspotById 是 Map，同 key 的后一只会**静默覆盖**
     前一只，点左边那只也会选中右边那只（卡片、飞行、高亮全错，界面看不出问题）。 */
  [-0.24, 0.24].forEach((cx, i) => {
    mountElem('FAN', {
      key: `FAN#${i + 1}`,
      x: cx, y: CH + 0.030, z: CZ + 0.30, rx: -Math.PI / 2,
      parent: root, note: `柜顶 ${i + 1} 号 · 排风扇`,
    });
  });

  // 产品挂完后清掉被它们压住的盲板（产品比槽宽，两侧邻位会插进壳体）。
  // 数量记到 root 上，回归脚本可以直接断言「避让确实生效了」。
  root.userData.blankCulled = cullRailBlanks(midInner);

  /* --- 接触阴影：把柜列“压”在地面上 --- */
  const cs = contactShadow(2.9, 2.0, 0.62);
  cs.position.set(0, 0.004, CZ);
  root.add(cs);
  const cs2 = contactShadow(2.4, 1.0, 0.34);
  cs2.position.set(0, 0.004, -0.05);
  root.add(cs2);

  /* --- 柜前警示标线 --- */
  const stripe = bar(2.6, 0.002, 0.06, new THREE.MeshStandardMaterial({ color: 0xd8b13a, roughness: 0.7 }));
  stripe.position.set(0, 0.0015, -0.36);
  root.add(stripe);

  return {
    root,
    hotspots,
    env: 'indoor',
    exposure: 0.97,
    fog: { color: 0x1b222b, near: 6, far: 34 },
    background: null,
    fov: 48,
    /* 默认机位：以「中柜打开的继电器室」为构图中心（y≈1.56），
       同时把三面柜列和柜前绝缘胶垫都收进画面 —— 让用户第一眼就明白
       「这是一排真实开关柜，我们的产品装在中间那一柜的二次室里」。 */
    camera: { pos: [1.78, 2.00, 2.42], target: [0, 1.56, -0.62] },
    /* ---------- 自适应取景盒 ----------
       户内用 fov 模式：机位与注视点都不动，只在舞台变窄时把视场角撑大
       （户内绝不能靠后退取景 —— 相机一退就穿出后墙和天花板）。
       两条边界都不能给满：
         · 柜前绝缘胶垫**不列** —— 它 2.7m 宽、横跨到相机脚下（相机 x=1.78），
           右端近角距相机仅 2.9m，全框进来要 65° 的 fov，透视会严重失真。
         · 柜体底面 y 取 0.30 而不是 0 —— 近侧底角（1.21, 0, −0.59）距相机 3.1m，
           是全场景最吃视角的点，单它一个就要 58°。混凝土基础与电缆室下沿本来
           就可以被下边缘裁掉，属正常构图裁切；取 0.30 后只需 49°。
       实测（舞台宽高比 0.90~1.25）：宽屏 49.3°（原写死 48°，差 1.3° 肉眼不可辨），
       aspect 0.943 需 52.2°、0.90 需 54.3°、0.807 需 59.5° —— 这两档原先会裁掉左右两侧柜体。 */
    fit: {
      mode: 'fov',
      fovMax: 62,
      parts: [
        [-1.21, 0.30, -2.11, 1.21, 2.30, -0.59],
        [-0.87, 2.37, -1.10, 0.87, 2.55, -0.58],
      ],
    },
    /* ⚠️ 这里**故意不写 minAz / maxAz** —— 「镜头自由」：
       墙/天花/地面都是单面板（法线朝内），相机绕到墙外时被背面剔除，
       直接看进室内；加了方位角限位反而把「绕到背后看一眼」禁掉。
       极角仍然限位：minPol 允许俯视，maxPol 压住别钻到地面以下。 */
    limits: { minPol: 0.05, maxPol: Math.PI * 0.545, minD: 0.06, maxD: 10.0, },
    lights: [
      { type: 'hemi', sky: 0xcddced, ground: 0x5e666d, intensity: 0.66 },
      { type: 'ambient', color: 0x7e93a3, intensity: 0.26 },
      {
        type: 'spot', color: 0xf2f7ff, intensity: 34, distance: 14, angle: 0.92, penumbra: 0.92, decay: 2,
        pos: [1.7, 3.30, 1.5], target: [0, 1.15, -0.75], shadow: true,
      },
      {
        type: 'spot', color: 0xe6f0ff, intensity: 13, distance: 14, angle: 1.05, penumbra: 1.0, decay: 2,
        pos: [-2.6, 3.20, 1.1], target: [0, 1.05, -0.85], shadow: false,
      },
      {
        type: 'spot', color: 0xd8e8ff, intensity: 9, distance: 12, angle: 1.0, penumbra: 1.0, decay: 2,
        pos: [3.2, 3.10, -0.4], target: [0, 1.35, -0.9], shadow: false,
      },
      { type: 'dir', color: 0xbcd0e0, intensity: 0.42, pos: [-3.2, 2.6, 4.2], target: [0, 1.2, -0.6] },
    ],
  };
}
