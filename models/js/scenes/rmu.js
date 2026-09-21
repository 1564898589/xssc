/**
 * rmu.js —— 户外场景：10kV 环网柜（RMU，共箱式户外开关站）
 *
 * 与箱变的区别：环网柜是"开关站"而不是"变电站"，没有变压器，
 * 但三工位负荷开关/接地开关的电动机构需要 RN-DK 这类机构控制模块。
 */
import * as THREE from 'three';
import { M } from '../mats.js';
import {
  rbox, plate, cyl, bar, grp, doorPanel, dinRail, wireDuct, terminalRow,
  hinge, handle, lockKey, gland, nameplateTex, louverPanel, insulator,
  cableBundle, contactShadow,
} from '../parts.js';
import { buildProductModel } from '../product-models.js';
import { hotspot, placeOnRail, cullRailBlanks, skyDome, utilityPole, powerLine, shrub, treeline,
  mountElement, regElement } from '../scene-kit.js';
import { isolateMaterials } from '../mats.js';
import { canvasTex } from '../util.js';

/* ---------- 尺寸 ---------- */
const U = 0.56;          // 单元宽
const HU = 1.74;         // 柜高
const DU = 0.98;         // 柜深
const N = 3;             // 单元数
const W = N * U;         // 总宽
const PAD_H = 0.16;      // 混凝土基础高
const Y0 = PAD_H;        // 柜体底面
const FZ = DU / 2;       // 柜前表面 z
const BZ = -DU / 2;

/** 9 个导轨安装位，围绕柜中线对称 */
const slotX = (i, n = 9) => (i - (n - 1) / 2) * 0.045;

/* ============================================================
 * 柜体
 * ============================================================ */

/** 户外柜顶（微坡 + 檐口滴水） */
function rmuRoof() {
  const g = new THREE.Group();
  const over = 0.09;
  const rw = W + over * 2, rd = DU + over * 2;
  const rise = 0.10;
  const half = rd / 2;
  const ang = Math.atan2(rise, half);
  const slope = Math.hypot(half, rise);
  for (const sz of [1, -1]) {
    const p = rbox(rw, 0.04, slope, 0.006, M.powderMid, 1);
    p.rotation.x = sz * ang;
    p.position.set(0, Y0 + HU + rise / 2, sz * half / 2);
    g.add(p);
  }
  const ridge = bar(rw, 0.045, 0.09, M.powderDark);
  ridge.position.set(0, Y0 + HU + rise + 0.012, 0);
  g.add(ridge);
  for (const sz of [1, -1]) {
    const e = bar(rw, 0.035, 0.045, M.powderDark);
    e.position.set(0, Y0 + HU - 0.004, sz * half);
    g.add(e);
  }
  for (const sx of [1, -1]) {
    const s = plate(slope * 2, rise + 0.04, 0.026, M.powderMid);
    s.rotation.y = Math.PI / 2;
    s.position.set(sx * rw / 2, Y0 + HU + rise / 2, 0);
    g.add(s);
  }
  return g;
}

/** 柜体（底板 + 后/左/右侧壁 + 顶板 + 内部隔板） */
function rmuBody() {
  const g = new THREE.Group();
  const t = 0.05;
  const base = rbox(W, t, DU, 0.004, M.powderDark, 1);
  base.position.set(0, Y0 + t / 2, 0);
  g.add(base);

  const back = plate(W, HU, t, M.powderLight);
  back.position.set(0, Y0 + HU / 2, BZ + t / 2);
  g.add(back);
  for (const sx of [1, -1]) {
    const s = plate(DU, HU, t, M.powderLight);
    s.rotation.y = Math.PI / 2;
    s.position.set(sx * (W / 2 - t / 2), Y0 + HU / 2, 0);
    g.add(s);
    // 侧面百叶通风窗（户外柜必备）
    const lp = louverPanel(0.34, 0.30, { cols: 5, rows: 4 });
    lp.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    lp.position.set(sx * (W / 2 + 0.002), Y0 + HU - 0.36, 0);
    g.add(lp);
  }
  const top = plate(W, DU, t, M.powderMid);
  top.rotation.x = Math.PI / 2;
  top.position.set(0, Y0 + HU - t / 2, 0);
  g.add(top);

  // 内部隔板（三单元分仓）
  for (const x of [-U / 2, U / 2]) {
    const s = plate(DU - 0.02, HU - 0.06, 0.04, M.powderMid);
    s.rotation.y = Math.PI / 2;
    s.position.set(x, Y0 + HU / 2, 0);
    g.add(s);
  }
  // 前立面框架
  for (const x of [-W / 2 + 0.025, -U / 2, U / 2, W / 2 - 0.025]) {
    const c = bar(0.05, HU, 0.05, M.powderLight);
    c.position.set(x, Y0 + HU / 2, FZ - 0.025);
    g.add(c);
  }
  const beam = bar(W, 0.13, 0.05, M.powderLight);
  beam.position.set(0, Y0 + HU - 0.065, FZ - 0.025);
  g.add(beam);
  return g;
}

/** 三扇前门（中间那扇打开，露出二次室） */
function rmuDoors() {
  const g = new THREE.Group();
  const doorH = HU - 0.26;
  const dw = U - 0.06;
  for (let i = 0; i < N; i++) {
    const cx = -W / 2 + U * (i + 0.5);
    const isMid = i === 1;
    const d = doorPanel({
      w: dw, h: doorH, t: 0.016,
      windows: isMid ? [] : [{ x: 0, y: 0.20, w: 0.24, h: 0.20 }],
      handle: { x: dw / 2 - 0.06, y: -0.02 },
      lock: { x: dw / 2 - 0.06, y: -0.20 },
      plate: i === 0 ? { x: -0.02, y: doorH / 2 - 0.16, w: 0.22, h: 0.10, title: '进线', sub: '10kV' }
        : i === 2 ? { x: -0.02, y: doorH / 2 - 0.16, w: 0.22, h: 0.10, title: '出线', sub: '10kV' }
          : null,
      hinges: [-0.52, 0, 0.52],
    });
    if (isMid) {
      // 中间柜：左开 93°，门叶几乎垂直于柜面
      const pivot = new THREE.Group();
      pivot.position.set(cx - dw / 2 - 0.02, Y0 + 0.16 + doorH / 2, FZ + 0.012);
      d.position.set(dw / 2, 0, 0);
      pivot.add(d);
      pivot.rotation.y = -1.62;
      /* 可开合（见 app.js 的 collectDoors）。门扇挂在铰点朝门洞那侧，
         rotation.y = 0 即关闭。 */
      pivot.userData.door = { open: -1.62, closed: 0 };
      pivot.userData.explode = [0, 0, 0.62];
      g.add(pivot);
    } else {
      /* 另外两扇门也包一层 pivot 做成可开合（与中间那扇同构）。
         铰点位置与中柜一致，门扇的 local 偏移补回那 0.02 —— 保证门扇世界位置
         仍是 cx，不然开关门会横向挪 2cm。 */
      const pivot = new THREE.Group();
      pivot.position.set(cx - dw / 2 - 0.02, Y0 + 0.16 + doorH / 2, FZ + 0.012);
      d.position.set(dw / 2 + 0.02, 0, 0);
      pivot.add(d);
      pivot.userData.door = { open: -1.62, closed: 0 };
      pivot.userData.explode = [0, 0, 0.62];
      g.add(pivot);
    }
  }
  return g;
}

/** 基础 / 电缆井 / 场坪 / 围栏 */
function site() {
  const g = new THREE.Group();

  // 混凝土基础
  const pad = rbox(W + 0.44, PAD_H, DU + 0.40, 0.01, M.concrete, 1);
  pad.position.set(0, PAD_H / 2, 0);
  g.add(pad);
  const padTop = plate(W + 0.38, DU + 0.34, 0.02, M.concreteDark);
  padTop.rotation.x = -Math.PI / 2;
  padTop.position.set(0, PAD_H + 0.01, 0);
  g.add(padTop);

  // 碎石场坪 + 草地
  const gravel = new THREE.Mesh(new THREE.CircleGeometry(11, 48), M.gravel);
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.y = 0.002;
  gravel.receiveShadow = true;
  g.add(gravel);
  /* ⚠️ 第 59 轮：外径 52 比树线最远一棵（treeline(46,58) 实测 40.3~54.3m）
     还小 2.3m —— 那几棵是「浮在地平线上」的。外径按「树线最大半径 ×1.14」
     取 62，让整圈树都站在草地上。里圈 11m 的碎石场坪不动。 */
  const grass = new THREE.Mesh(new THREE.RingGeometry(11, 62, 48), M.grass);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.0;
  grass.receiveShadow = true;
  g.add(grass);

  // 电缆井（两个盖板 + 井圈）
  for (const x of [-0.55, 0.55]) {
    const rim = rbox(0.66, 0.06, 0.56, 0.006, M.concreteDark, 1);
    rim.position.set(x, 0.03, FZ + 1.15);
    g.add(rim);
    const lid = rbox(0.60, 0.035, 0.50, 0.004, M.aluDark, 1);
    lid.position.set(x, 0.072, FZ + 1.15);
    g.add(lid);
    // 井盖上的吊装孔
    for (const dx of [-0.16, 0.16]) {
      const hole = cyl(0.022, 0.022, 0.02, M.pcBlack, 12);
      hole.position.set(x + dx, 0.085, FZ + 1.15);
      g.add(hole);
    }
  }

  // 安全围栏（三面，留出操作面）
  const fenceMat = M.steelBrushed;
  const R = 2.55;
  for (const sz of [1, -1]) {
    for (let i = -2; i <= 2; i++) {
      const p = bar(0.045, 1.05, 0.045, fenceMat);
      p.position.set(i * 1.25, 0.525, sz * R);
      g.add(p);
    }
    for (const y of [0.95, 0.58, 0.20]) {
      const r = bar(5.1, 0.035, 0.028, fenceMat);
      r.position.set(0, y, sz * R);
      g.add(r);
    }
  }
  for (const sx of [1, -1]) {
    for (let i = -1; i <= 1; i++) {
      const p = bar(0.045, 1.05, 0.045, fenceMat);
      p.position.set(sx * R, 0.525, i * 1.25);
      g.add(p);
    }
    for (const y of [0.95, 0.58, 0.20]) {
      const r = bar(0.028, 0.035, 2.55, fenceMat);
      r.position.set(sx * R, y, 0);
      g.add(r);
    }
  }

  // 接触阴影
  const cs = contactShadow(2.6, 1.9, 0.5);
  cs.position.set(0, 0.006, 0);
  g.add(cs);

  // 一次接线示意牌（挂在柜正面右侧）
  const diaTex = canvasTex(384, 448, (g2) => {
    g2.fillStyle = '#eceee8'; g2.fillRect(0, 0, 384, 448);
    g2.strokeStyle = '#1d2733'; g2.lineWidth = 4; g2.strokeRect(4, 4, 376, 440);
    g2.fillStyle = '#0f5a3a'; g2.fillRect(4, 4, 376, 44);
    g2.fillStyle = '#fff'; g2.font = '700 22px "PingFang SC","Microsoft YaHei",sans-serif';
    g2.fillText('一次接线示意', 16, 34);
    g2.strokeStyle = '#2b5f8a'; g2.lineWidth = 3;
    // 母线
    g2.beginPath(); g2.moveTo(48, 110); g2.lineTo(336, 110); g2.stroke();
    g2.fillStyle = '#b3352c'; g2.font = '700 18px "PingFang SC",sans-serif';
    g2.fillText('10kV 母线', 48, 100);
    // 三路间隔
    for (let i = 0; i < 3; i++) {
      const x = 76 + i * 116;
      g2.beginPath(); g2.moveTo(x, 110); g2.lineTo(x, 200); g2.stroke();
      g2.fillStyle = '#1d2733';
      g2.fillRect(x - 11, 200, 22, 34);       // 负荷开关
      g2.beginPath(); g2.moveTo(x, 234); g2.lineTo(x, 300); g2.stroke();
      g2.fillStyle = '#5b6670'; g2.fillRect(x - 11, 300, 22, 30);   // 接地开关
      g2.beginPath(); g2.moveTo(x, 330); g2.lineTo(x, 372); g2.stroke();
      g2.fillStyle = '#1d2733'; g2.font = '600 16px "PingFang SC",sans-serif';
      g2.fillText(['进线', 'PT', '出线'][i], x - 16, 400);
    }
    g2.fillStyle = '#5b6670'; g2.font = '600 15px "PingFang SC",sans-serif';
    g2.fillText('三工位：合 — 分 — 接地', 76, 430);
  });
  const dia = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.40),
    new THREE.MeshStandardMaterial({ map: diaTex, roughness: 0.68 }));
  dia.position.set(W / 2 + 0.02, Y0 + 1.15, FZ + 0.03);
  g.add(dia);

  // 警示牌
  const warnTex = canvasTex(256, 320, (g2) => {
    g2.fillStyle = '#f2c800'; g2.fillRect(0, 0, 256, 320);
    g2.strokeStyle = '#111'; g2.lineWidth = 10; g2.strokeRect(10, 10, 236, 300);
    g2.fillStyle = '#111'; g2.textAlign = 'center';
    g2.font = '800 110px "PingFang SC",sans-serif';
    g2.fillText('⚡', 128, 150);
    g2.font = '800 42px "PingFang SC",sans-serif';
    g2.fillText('高压危险', 128, 228);
    g2.font = '700 24px "PingFang SC",sans-serif';
    g2.fillText('禁止攀登', 128, 272);
  });
  const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.375),
    new THREE.MeshStandardMaterial({ map: warnTex, roughness: 0.6, side: THREE.DoubleSide }));
  warn.position.set(-W / 2 - 0.05, Y0 + 1.15, FZ + 0.03);
  g.add(warn);

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
  root.add(skyDome(160, { sun: [-6.0, 8.2, 5.2] }));

  /* ---------- 远景：电杆 + 导线 + 树线 + 灌木 ---------- */
  const far = new THREE.Group();
  const poles = [];
  const polePos = [[-5.4, 1.6, -4.2], [1.2, 1.9, -9.5], [8.6, 2.3, -13.0]];
  polePos.forEach(([x, s, z], i) => {
    const p = utilityPole(8.2 * s, { arms: 2 });
    p.position.set(x, 0, z);
    p.scale.setScalar(s);
    far.add(p);
    poles.push({ x, z, s });
  });
  // 杆间导线（每杆两横担共 6 根，这里简化成 4 根）
  for (let i = 0; i < poles.length - 1; i++) {
    const a = poles[i], b = poles[i + 1];
    for (let k = 0; k < 4; k++) {
      const yA = 8.2 * a.s * (0.88 - Math.floor(k / 2) * 0.09);
      const yB = 8.2 * b.s * (0.88 - Math.floor(k / 2) * 0.09);
      const xo = (k % 2 ? 0.5 : -0.5) * a.s;
      const xo2 = (k % 2 ? 0.5 : -0.5) * b.s;
      far.add(powerLine(
        new THREE.Vector3(a.x + xo, yA + 0.11, a.z),
        new THREE.Vector3(b.x + xo2, yB + 0.11, b.z),
        { sag: 1.1, r: 0.022 }
      ));
    }
  }
  // 灌木丛
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * 26;
    const s = shrub(0.8 + Math.random() * 0.7, i * 0.77);
    s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r * 0.8 - 3);
    far.add(s);
  }
  far.add(treeline(46, 58, { minH: 3.0, maxH: 7.4, seed: 3 }));
  /* 远景（电杆 / 导线 / 树线 / 灌木）整组标注为 scenery：
     不参与「全景」取景 —— 树线在 46~58m 外，并进包围盒会把柜体挤出画面。 */
  far.userData.scenery = true;
  root.add(far);

  /* ---------- 场坪与柜体 ---------- */
  /* 场坪 / 草地环 / 围栏整组标注为 scenery：
     ⚠️ 草地环半径最大到 52m（rmu），是「全景跑飞」的主因 —— 它会把包围球撑到几十米，
        相机被 maxDistance 夹回来之后，柜体反而落在画面外。 */
  const siteG = site();
  siteG.userData.scenery = true;
  root.add(siteG);
  root.add(rmuBody());
  root.add(rmuRoof());
  /* ⚠️ 门组必须留引用：第 51 轮的操显装置是**门装**的，
     要挂成门扇的子节点，开门时才会跟着走（挂 root 的话门一开器件留在原地）。 */
  const doorsG = rmuDoors();
  root.add(doorsG);

  /* ---------- 柜内：三工位负荷开关（透过打开的中门可见） ---------- */
  const midX = 0;
  const sw = new THREE.Group();
  for (let i = -1; i <= 1; i++) {
    const ins = insulator(0.17, M.pcBeige);
    ins.position.set(midX + i * 0.14, Y0 + 0.30, 0.10);
    sw.add(ins);
    const arm = bar(0.030, 0.012, 0.26, M.copper);
    arm.position.set(midX + i * 0.14, Y0 + 0.50, 0.10);
    sw.add(arm);
  }
  const shaft = cyl(0.013, 0.013, 0.44, M.steelBrushed, 14);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(midX, Y0 + 0.62, 0.10);
  sw.add(shaft);
  const hvCable = cableBundle(3, 0.7, { r: 0.016, spread: 0.07 });
  hvCable.position.set(midX, Y0 + 0.30, -0.20);
  sw.add(hvCable);
  sw.userData.explode = [0, 0, 0.55];
  root.add(sw);
  /* 这台三工位负荷开关本来就在场景里，直接登记成 LBS 热点。
     环网柜的「主设备」就是它，不标出来整个场景就只剩一排继电器。 */
  regElement(hotspots, 'LBS', sw, {
    off: [0, 0.42, 0.06], note: '负荷开关单元 · 三工位负荷开关（示意）',
  });
  /* 开关单元里其余的通用元件：接地开关 / CT / PT / 避雷器 / 电缆 */
  /* ⚠️ ES 实测 385×154×76，在 x/y 上**完全落在 LBS 包围盒内**，只有 z 方向压 4mm
     （LBS 前脸 z=0.230 / 原 ES 后脸 0.202）。前移 40mm 后后脸 0.242，留 12mm。 */
  mountElement(root, hotspots, 'ES', {
    x: 0, y: Y0 + 0.06, z: 0.28, note: '负荷开关单元 · 接地开关',
  });
  /* ⚠️ 这三只是**同一安装面上的三只**（CT 左 / SPD 中 / PT 右），要移一起移。
     LBS 是场景里原有的三工位负荷开关，包围盒深 506mm、背面 z=-0.276；
     原 PT 前脸 z=-0.266 ⇒ 压进 LBS 背面 10mm（railfit_probe 第 50 轮实测）。
     整排后移 20mm 后 PT 前脸 -0.286，留 10mm 净空。 */
  mountElement(root, hotspots, 'CT', {
    x: -0.14, y: Y0 + 0.62, z: -0.36, note: '负荷开关单元 · 电流互感器',
  });
  mountElement(root, hotspots, 'PT', {
    x: 0.14, y: Y0 + 0.64, z: -0.36, note: '负荷开关单元 · 电压互感器',
  });
  mountElement(root, hotspots, 'SPD', {
    x: 0, y: Y0 + 0.30, z: -0.36, note: '负荷开关单元 · 氧化锌避雷器',
  });
  mountElement(root, hotspots, 'HEATER', {
    x: 0, y: Y0 + 0.04, z: -0.06, note: '柜内下部 · 防凝露加热器',
  });
  /* ⚠️ 第二根线束换 key：Map 里同 key 会静默覆盖。 */
  regElement(hotspots, 'WIRE', hvCable, {
    key: 'WIRE#1',
    off: [0, 0.40, 0.02], quiet: true, note: '负荷开关单元 · 进出线电缆',
  });

  /* ---------- 第 51 轮：面板型大件 ----------
     SMART_OPS 智能操作显示装置 180×230×45 —— 真机装在**柜门外面板**上
     （上面是模拟图 / 状态显示，下面是分合闸操作开关与就地远方切换）。
     门扇局部系：宽 dw=0.50、高 doorH=1.48 ⇒ x ∈ [-0.25,0.25]、y ∈ [-0.74,0.74]；
     门上有窗 (0, 0.20, 0.24×0.20) 与铭牌 (-0.02, 0.58, 0.22×0.10)，
     ⇒ 取**窗下方** y = -0.30（盒 -0.415~-0.185），离窗底 0.60m。
     把手在 x = 0.19，装置右沿 0.09 ⇒ 净空 0.10m。
     z = 门板半厚 0.008 + 装置半厚 0.0225 = 0.0305（贴门板外表面）。
     ⚠️ 三扇门里取 **i=0 进线柜**（默认是关着的、正面朝外，最容易被看到）；
        中间那扇出厂就开着、门面几乎侧对镜头，挂上去看不见。 */
  const doorPivots = [];
  doorsG.traverse((o) => { if (o.userData && o.userData.door) doorPivots.push(o); });
  if (doorPivots[0] && doorPivots[0].children[0]) {
    mountElement(doorPivots[0].children[0], hotspots, 'SMART_OPS', {
      x: -0.02, y: -0.30, z: 0.0305,
      note: '进线单元柜门 · 智能操作显示装置（模拟图 / 分合闸操作 / 就地远方切换）',
    });
  }

  /* ---------- 二次室内装板（产品安装处） ---------- */
  const RAIL_A = Y0 + 1.30, RAIL_B = Y0 + 1.00;
  const PLATE_Z = 0.30;
  /* DIN 导轨前表面 z（导轨中心 + 0.005）。产品与盲板统一按「背面贴这条线」摆，
     导轨就永远被挡住，不会横在器件脸前面。 */
  const RAIL_FRONT = PLATE_Z + 0.024 + 0.005;

  const inner = new THREE.Group();
  inner.userData.explode = [0, 0, 0.30];
  const mp = plate(U - 0.10, 0.90, 0.004, M.powderWhite);
  mp.position.set(midX, Y0 + 1.14, PLATE_Z);
  inner.add(mp);
  for (const ry of [RAIL_A, RAIL_B]) {
    const r = dinRail(0.44);
    r.position.set(midX, ry, PLATE_Z + 0.024);
    inner.add(r);
  }
  const ducts = [];
  for (const dy of [Y0 + 1.60, Y0 + 1.44, Y0 + 1.16, Y0 + 0.88, Y0 + 0.72]) {
    const d = wireDuct(0.44, 0.042, 0.030);
    d.position.set(midX, dy, PLATE_Z + 0.024);
    inner.add(d);
    ducts.push(d);
  }
  const tr = terminalRow(18, { w: 0.0072, h: 0.046, d: 0.042 });
  tr.position.set(midX, Y0 + 0.80, PLATE_Z + 0.022);
  inner.add(tr);
  // 空白填充：背面贴导轨前表面（BoxGeometry 原点在几何中心，中心 = 背面 + 半个厚度），
  // 且不再手写 taken 表——产品比槽宽，手写表会让两侧盲板插进壳体（实测 25.5mm）。
  const BLANK_D = 0.078;
  const blankGeo = new THREE.BoxGeometry(0.045, 0.09, BLANK_D);
  const blankZ = RAIL_FRONT + BLANK_D / 2;
  for (const ry of [RAIL_A, RAIL_B]) {
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(blankGeo, M.pcGray);
      b.position.set(slotX(i), ry, blankZ);
      b.castShadow = true;
      b.userData.blank = true;          // 供 cullRailBlanks 识别
      inner.add(b);
    }
  }
  // 二次电缆
  const cb = cableBundle(5, 0.34, { r: 0.0045, spread: 0.05 });
  cb.position.set(midX, Y0 + 0.70, PLATE_Z + 0.01);
  inner.add(cb);
  root.add(inner);

  /* ---------- 产品安装 ---------- */
  function mount(id, railY, slotIndex, note) {
    const p = buildProductModel(id);
    // 背面贴导轨前表面：panelMeter 与 dinModule 的原点约定不同，直接设 position 会差 40~55mm
    placeOnRail(p, { x: slotX(slotIndex), y: railY, zBack: RAIL_FRONT });
    p.rotation.y = 0;
    isolateMaterials(p);
    p.userData.pid = id;
    inner.add(p);
    hotspots.push(hotspot(id, p, { offset: [0, 0.030, 0.02], note }));
    return p;
  }

  mount('RN-DK', RAIL_A, 1, '二次室 · 三工位负荷开关/接地开关电动机构控制');
  mount('RDP', RAIL_A, 4, '二次室 · 三工位位置记忆与重动');
  mount('RVS', RAIL_A, 7, '二次室 · 站用电双电源切换');
  mount('THC', RAIL_B, 2, '二次室 · 箱内防凝露加热控制');
  mount('THS', RAIL_B, 6, '二次室 · 温湿度上传配电终端');

  /* ---------- 二次室导轨上的通用元件 ----------
     槽位坐标与 mount() 一致：x = (slot - 4) × 0.045。
     RAIL_A 被 RN-DK(0.135) / RDP(0.045) / RVS(0.09) 占满，所以两只都放在 RAIL_B
     的空档里：左端 x=-0.17（THC 在 slot 2）、右端 x=0.16（THS 在 slot 6）。 */
  mountElement(inner, hotspots, 'MCCB', {
    /* 收窄到 75mm：标准 90mm 宽会与 THC（占槽 2~3.7）插进去 8.6mm（clip_test 实测） */
    build: { w: 0.075, h: 0.13, d: 0.07 },
    x: -0.176, y: RAIL_B, zBack: RAIL_FRONT, note: '二次室 · 站用回路塑壳断路器',
  });
  mountElement(inner, hotspots, 'TEMPCTRL', {
    x: 0.16, y: RAIL_B, zBack: RAIL_FRONT, note: '二次室 · 柜内温湿度控制器（通用）',
  });

  /* ---- 第 50 轮：二次室下排中段补两只可插拔小型中间继电器 ----
     环网柜的二次逻辑（位置记忆、站用电切换）点数少，
     现场常见做法就是可插拔小继电器搭，备件只备一种。
     ⚠️⚠️ 占位复核 —— **用真实宽度**（**THC 90mm** / **THS 22.5mm** / MCCB 75mm /
        TEMPCTRL 75mm；第 50 轮踩过「假设一只一槽 45mm」）：
          MCCB(-0.176, 75mm)[-0.2135,-0.1385]   THC(slot2, 90mm)[-0.135,-0.045]
          THS(slot6, 22.5mm)[ 0.0788, 0.1013]   TEMPCTRL(+0.16, 75mm)[0.1225,0.1975]
        真正空的中段是 **[-0.045, +0.0788]（124mm）**，不是 ±0.0675。
        两只 RELAY_PLUG 按 ±22.5mm 排在 [-0.034,-0.011] 与 [+0.011,+0.034]，都在空段内。 */
  mountElement(inner, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#1', x: -0.0225, y: RAIL_B, zBack: RAIL_FRONT,
    note: '二次室 · 可插拔小型中间继电器（第 1 只）',
  });
  mountElement(inner, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#2', x: 0.0225, y: RAIL_B, zBack: RAIL_FRONT,
    note: '二次室 · 可插拔小型中间继电器（第 2 只）',
  });
  /* ---------- 第 52 轮：面板型大件（`rmu.elements` 声明了 IED / DTU） ----------
     ⚠️⚠️ 落点先算空带（`hotspots.json` 实测，二次室 x ≈ 0；`Y0 = PAD_H = 0.16`，
         内装板 `mp` 中心 y = Y0+1.14 = 1.30、高 0.90 ⇒ 覆盖 0.85~1.75）：
         TERMINAL 0.937~0.992 / RAIL_B 器件 1.095~1.225 /
         RAIL_A 器件 1.414~1.506 / DUCT 1.745~1.778。
         ⇒ 两条可用空带：**1.225~1.414（189mm）** 与 **1.506~1.745（239mm）**。
     IED 155×180×90 取下面那条：y = 1.625（盒 1.535~1.715），上留 30mm、下留 29mm。 */
  mountElement(inner, hotspots, 'IED', {
    x: 0, y: 1.625, zBack: PLATE_Z,
    note: '二次室 · 一体化保护测控装置（保护+测量+控制+通信四合一）',
  });
  /* DTU 140×160×130 取上面那条：y = 1.32（盒 1.24~1.40），上留 14mm、下留 14mm。
     ⚠️ 深 130mm ⇒ z 从 PLATE_Z=0.30 到 0.43；柜深 DU=0.98、柜中心到内装板还有 0.19m
        ⇒ 不会顶穿柜门。 */
  mountElement(inner, hotspots, 'DTU', {
    x: 0, y: 1.32, zBack: PLATE_Z,
    note: '二次室 · 配电自动化终端（遥测/遥信/遥控，向上接入配网主站）',
  });
  regElement(hotspots, 'TERMINAL', tr, {
    off: [0, 0.032, 0.02], quiet: true, note: '二次室 · 二次端子排',
  });
  regElement(hotspots, 'DUCT', ducts[0], {
    off: [0, 0.032, 0.02], quiet: true, note: '二次室 · 走线槽',
  });
  regElement(hotspots, 'WIRE', cb, {
    key: 'WIRE#2',
    off: [0, 0.05, 0.02], quiet: true, note: '二次室 · 二次线束',
  });

  // 产品挂完后清掉被它们压住的盲板。数量记到 root 上，回归脚本可断言避让生效。
  root.userData.blankCulled = cullRailBlanks(inner);

  /* ---------- 柜后电缆出口 ---------- */
  for (let i = -1; i <= 1; i++) {
    const gl = gland(M.brass, 0.014);
    gl.rotation.y = Math.PI;
    gl.position.set(i * 0.22, Y0 + 0.14, BZ + 0.02);
    root.add(gl);
  }

  return {
    root,
    hotspots,
    env: 'outdoor',
    exposure: 0.95,
    fog: { color: 0xbcd2e4, near: 26, far: 130 },
    camera: { pos: [3.55, 2.25, 4.35], target: [0, 1.00, 0] },
    /* ⚠️ 这里**故意不写 minAz / maxAz** —— 「镜头自由」：
       墙/天花/地面都是单面板（法线朝内），相机绕到墙外时被背面剔除，
       直接看进室内；加了方位角限位反而把「绕到背后看一眼」禁掉。
       极角仍然限位：minPol 允许俯视，maxPol 压住别钻到地面以下。 */
    limits: { minPol: 0.05, maxPol: Math.PI * 0.667, minD: 0.12, maxD: 20 },
    lights: [
      { type: 'hemi', sky: 0xa8cbe8, ground: 0x6d6a60, intensity: 0.74 },
      { type: 'ambient', color: 0xbcd2e4, intensity: 0.16 },
      {
        type: 'dir', color: 0xfff3e0, intensity: 2.00, pos: [-6.0, 8.2, 5.2], target: [0, 1.0, 0],
        shadow: true, shadowSize: 2048,
        shadowCam: { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 28 },
      },
      { type: 'dir', color: 0xcfe2f5, intensity: 0.44, pos: [5.5, 3.2, -4.5], target: [0, 1.0, 0] },
    ],
  };
}
