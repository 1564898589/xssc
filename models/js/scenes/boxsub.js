/**
 * boxsub.js —— 户外场景：欧式预装式箱式变电站（高压室 + 变压器室 + 低压室）
 */
import * as THREE from 'three';
import { M } from '../mats.js';
import {
  rbox, plate, cyl, bar, grp, doorPanel, cabinetShell, dinRail,
  wireDuct, terminalRow, hinge, handle, lockKey, gland, nameplateTex,
  louverPanel, dryTransformer, insulator, cableBundle, contactShadow,
} from '../parts.js';
import { buildProductModel } from '../product-models.js';
import { hotspot, skyDome, placeOnRail, mountElement, regElement } from '../scene-kit.js';
import { isolateMaterials } from '../mats.js';
import { canvasTex } from '../util.js';

/* ---------- 箱体尺寸 ---------- */
const L = 3.60;    // 总长（x）
const D = 2.20;    // 总深（z）
const H = 2.60;    // 总高
const BASE_H = 0.30;
const Y0 = BASE_H;         // 箱体底面
const FZ = D / 2;          // 前面 z = +1.10
const BZ = -D / 2;         // 后面 z = -1.10

const PART = {
  hv: { x0: -1.80, x1: -0.80 },   // 高压室
  tr: { x0: -0.80, x1: 0.80 },    // 变压器室
  lv: { x0: 0.80, x1: 1.80 },     // 低压室
};

/* ---------- 屋顶（微坡双坡） ---------- */
function roof() {
  const g = new THREE.Group();
  const overhang = 0.14;
  const rw = L + overhang * 2;
  const rise = 0.17;
  const half = D / 2 + overhang;
  const slopeLen = Math.hypot(half, rise);
  const ang = Math.atan2(rise, half);

  for (const sz of [1, -1]) {
    const p = rbox(rw, 0.05, slopeLen, 0.006, M.powderMid, 1);
    p.rotation.x = sz * ang;
    p.position.set(0, Y0 + H + rise / 2, sz * half / 2);
    g.add(p);
  }
  // 脊盖
  const ridge = bar(rw, 0.05, 0.10, M.powderDark);
  ridge.position.set(0, Y0 + H + rise + 0.015, 0);
  g.add(ridge);
  // 檐口滴水
  for (const sz of [1, -1]) {
    const e = bar(rw, 0.04, 0.05, M.powderDark);
    e.position.set(0, Y0 + H - 0.005, sz * half);
    g.add(e);
  }
  // 侧封板
  for (const sx of [1, -1]) {
    const s = plate(slopeLen * 2, rise + 0.05, 0.03, M.powderMid);
    s.rotation.y = Math.PI / 2;
    s.position.set(sx * rw / 2, Y0 + H + rise / 2, 0);
    g.add(s);
  }
  return g;
}

/* ---------- 箱体主体 ---------- */
function enclosure() {
  const g = new THREE.Group();
  const t = 0.06;

  // 底板
  const base = rbox(L, t, D, 0.004, M.powderDark, 1);
  base.position.set(0, Y0 + t / 2, 0);
  g.add(base);

  // 后面 / 左右侧壁
  const back = plate(L, H, t, M.powderLight);
  back.position.set(0, Y0 + H / 2, BZ + t / 2);
  g.add(back);
  for (const sx of [1, -1]) {
    const s = plate(D, H, t, M.powderLight);
    s.rotation.y = Math.PI / 2;
    s.position.set(sx * (L / 2 - t / 2), Y0 + H / 2, 0);
    g.add(s);
  }
  // 顶部封板
  const top = plate(L, D, t, M.powderMid);
  top.rotation.x = Math.PI / 2;
  top.position.set(0, Y0 + H - t / 2, 0);
  g.add(top);

  // 内部隔板（三室分隔）
  for (const x of [PART.hv.x1, PART.tr.x1]) {
    const s = plate(D - 0.02, H - 0.06, 0.04, M.powderMid);
    s.rotation.y = Math.PI / 2;
    s.position.set(x, Y0 + H / 2, 0);
    g.add(s);
  }

  // 前立面框架（立柱 + 上梁）
  for (const x of [-L / 2 + t / 2, PART.hv.x1, PART.tr.x1, L / 2 - t / 2]) {
    const c = bar(t, H, t, M.powderLight);
    c.position.set(x, Y0 + H / 2, FZ - t / 2);
    g.add(c);
  }
  const beam = bar(L, 0.14, t, M.powderLight);
  beam.position.set(0, Y0 + H - 0.07, FZ - t / 2);
  g.add(beam);

  return g;
}

/* ---------- 警示牌 ----------
 * 「高压危险 / 禁止攀登」黄牌。真机上它是贴在**箱门外面**的 ——
 * 早先贴在箱体侧墙上，门一开就孤零零悬在半空（front_float.js 扫出来的真缺陷）。
 * 材质做模块级单例：只有一扇门用它，但共享标记仍是必须的 ——
 * 少了 userData.shared，disposeTree 会把它释放掉，切回本场景时贴图变白。
 */
let _warnMat = null;
function warnSign() {
  if (!_warnMat) {
    const tex = canvasTex(256, 320, (g2) => {
      g2.fillStyle = '#f2c800'; g2.fillRect(0, 0, 256, 320);
      g2.strokeStyle = '#111'; g2.lineWidth = 10; g2.strokeRect(10, 10, 236, 300);
      g2.fillStyle = '#111'; g2.textAlign = 'center';
      g2.font = '800 120px "PingFang SC",sans-serif'; g2.fillText('⚡', 128, 150);
      g2.font = '800 44px "PingFang SC",sans-serif'; g2.fillText('高压危险', 128, 230);
      g2.font = '700 26px "PingFang SC",sans-serif'; g2.fillText('禁止攀登', 128, 275);
    });
    tex.userData.shared = true;
    _warnMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide });
    _warnMat.userData.shared = true;
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.30), _warnMat);
}

/* ---------- 门 ----------
 *
 * ⚠️ 门轴的**几何约定**（踩过坑，务必先读）：
 *   门轴 pivot 立在隔室门洞的**外缘**（左门在 x0 侧、右门在 x1 侧），
 *   门板 d 挂在门轴的 `-sx * w/2` —— 也就是「门板朝门洞**里侧**铺开」。
 *   于是 `rotation.y = 0` 恰好是**关门**：门板盖住门洞，并且门板 local +z
 *   （把手 / 锁 / 铭牌 / 百叶 / 警示牌所在的那一面）朝**箱外**。
 *   开门 = 绕门轴往外转 `sx * 1.58`（≈91°）。
 *
 *   换算式：门板局部点 (x,y,z) →
 *     world = pivot.position + R_y(θ) · ( -sx*w/2 + x , y , z )
 *   关门 θ = 0 → world = pivot.position + (-sx*w/2 + x, y, z)。
 *
 *   ⚠️ 早先门板挂在 `+sx * w/2`（门洞**外**侧），pivot 得转 π 才盖得住门洞 ——
 *      而转 π 会把门板正反面调个个儿：一键全关之后看到的是六块光板，
 *      百叶 / 铭牌 / 把手 / 锁全转进了箱内。实测 6 扇门的 local +z
 *      世界法线全是 (0,0,-1)，即装饰面 100% 朝箱内。这就是那次的根因。
 *   ⚠️ 把手 / 锁的局部 x 必须是 `-sx * …` —— 它们长在门的**自由边**上，
 *      不是门轴边。门板挂点一改，这两处必须同步取反，否则把手长在铰链上。
 */
function doors() {
  const g = new THREE.Group();
  const doorH = H - 0.16;

  /* 高压室：双开门（默认开 ~91°，可点合） */
  for (const [i, sx] of [[0, -1], [1, 1]]) {
    const w = (PART.hv.x1 - PART.hv.x0) / 2 - 0.05;
    const d = doorPanel({
      w, h: doorH, t: 0.016,
      handle: { x: -sx * (w / 2 - 0.05), y: -0.02 },
      lock: { x: -sx * (w / 2 - 0.05), y: -0.22 },
      plate: i === 1 ? { x: 0, y: doorH / 2 - 0.16, w: 0.24, h: 0.12, title: '高压室', sub: '10kV' } : null,
      hinges: [-0.72, 0, 0.72],
      hingeSide: sx,
    });
    /* 警示牌贴在**门板外面**（真机就是这么贴的）。
       原先挂在箱体上看着没问题，门一开它就悬在半空 —— front_float.js 扫出来的真缺陷。 */
    if (i === 0) {
      const sg = warnSign();
      sg.position.set(0, 0.42, 0.016 / 2 + 0.004);
      d.add(sg);
    }
    const pivot = new THREE.Group();
    pivot.position.set(i === 0 ? PART.hv.x0 + 0.03 : PART.hv.x1 - 0.03, Y0 + 0.08 + doorH / 2, FZ + 0.01);
    d.position.set(-sx * (w / 2), 0, 0);
    pivot.add(d);
    /* 开角 ~91°（与变压器室一致）：高压室里的负荷开关、接地开关、CT/PT、避雷器
       才是「箱变里到底装了什么」的答案，关着门就只剩一块铁板。 */
    pivot.rotation.y = sx * 1.58;
    pivot.userData.door = { open: sx * 1.58, closed: 0 };
    g.add(pivot);
  }

  /* 变压器室：百叶双开门（默认开 ~91°） */
  const tw = (PART.tr.x1 - PART.tr.x0) / 2 - 0.05;
  for (const [i, sx] of [[0, -1], [1, 1]]) {
    const d = doorPanel({
      w: tw, h: doorH, t: 0.016,
      louver: { x: 0, y: 0.12, w: tw - 0.14, h: 0.62 },
      handle: { x: -sx * (tw / 2 - 0.05), y: -0.10 },
      hinges: [-0.72, 0, 0.72],
      hingeSide: sx,
    });
    const pivot = new THREE.Group();
    pivot.position.set(i === 0 ? PART.tr.x0 + 0.03 : PART.tr.x1 - 0.03, Y0 + 0.08 + doorH / 2, FZ + 0.01);
    d.position.set(-sx * (tw / 2), 0, 0);
    pivot.add(d);
    // 开角 ~91°：门扇基本垂直于箱面朝外支开，正面看是窄边，不遮箱内干变
    pivot.rotation.y = sx * 1.58;
    pivot.userData.door = { open: sx * 1.58, closed: 0 };
    g.add(pivot);
  }

  /* 低压室：双开门（双扇对称开 ~68°） */
  const lw = (PART.lv.x1 - PART.lv.x0) / 2 - 0.05;
  for (const [i, sx] of [[0, -1], [1, 1]]) {
    const d = doorPanel({
      w: lw, h: doorH, t: 0.016,
      louver: { x: 0, y: doorH / 2 - 0.20, w: lw - 0.20, h: 0.30 },
      handle: { x: -sx * (lw / 2 - 0.05), y: -0.02 },
      lock: { x: -sx * (lw / 2 - 0.05), y: -0.22 },
      hinges: [-0.72, 0, 0.72],
      hingeSide: sx,
    });
    const pivot = new THREE.Group();
    pivot.position.set(i === 0 ? PART.lv.x0 + 0.03 : PART.lv.x1 - 0.03, Y0 + 0.08 + doorH / 2, FZ + 0.01);
    d.position.set(-sx * (lw / 2), 0, 0);
    pivot.add(d);
    /* 两扇对称开 ~68°（1.19 rad）。开过 90° 门扇会折回箱体里 —— 那是「贴平 180°」那套
       旧约定的算法残留，新约定下开门角就是字面角度，别再写 1.95。 */
    pivot.rotation.y = sx * 1.19;
    pivot.userData.door = { open: sx * 1.19, closed: 0 };
    g.add(pivot);
  }

  return g;
}

/* ---------- 基础与场坪 ---------- */
function site() {
  const g = new THREE.Group();

  // 混凝土基础
  const base = rbox(L + 0.5, BASE_H, D + 0.5, 0.01, M.concrete, 1);
  base.position.set(0, BASE_H / 2, 0);
  g.add(base);
  const baseTop = plate(L + 0.44, D + 0.44, 0.02, M.concreteDark);
  baseTop.rotation.x = -Math.PI / 2;
  baseTop.position.set(0, BASE_H + 0.01, 0);
  g.add(baseTop);

  // 碎石场坪
  const gravel = new THREE.Mesh(new THREE.CircleGeometry(9, 48), M.gravel);
  gravel.rotation.x = -Math.PI / 2;
  gravel.position.y = 0.002;
  gravel.receiveShadow = true;
  g.add(gravel);

  // 草地外圈
  const grass = new THREE.Mesh(new THREE.RingGeometry(9, 46, 48),
    new THREE.MeshStandardMaterial({ color: 0x4e5a3c, roughness: 0.95 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = 0.0;
  grass.receiveShadow = true;
  g.add(grass);

  // 围栏：压低到 0.95m 并外撤到 4.7m。
  // 默认机位是近正面（方位角约 11°），1.15m 的护栏会横在画面下缘抢戏，
  // 压低 + 外撤后它退成"场坪边界"的暗示，不再和箱体抢视觉重心。
  const fenceMat = M.steelBrushed;
  const R = 4.7;
  const FH = 0.95;
  for (const sz of [1, -1]) {
    for (let i = -2; i <= 2; i++) {
      const p = bar(0.05, FH, 0.05, fenceMat);
      p.position.set(i * 2.1, FH / 2, sz * R);
      g.add(p);
    }
    for (const y of [FH - 0.13, FH * 0.54, FH * 0.21]) {
      const r = bar(8.6, 0.04, 0.03, fenceMat);
      r.position.set(0, y, sz * R);
      g.add(r);
    }
  }
  for (const sx of [1, -1]) {
    for (let i = -2; i <= 2; i++) {
      const p = bar(0.05, FH, 0.05, fenceMat);
      p.position.set(sx * R, FH / 2, i * 2.1);
      g.add(p);
    }
    for (const y of [FH - 0.13, FH * 0.54, FH * 0.21]) {
      const r = bar(0.03, 0.04, 8.6, fenceMat);
      r.position.set(sx * R, y, 0);
      g.add(r);
    }
  }

  // 接触阴影
  const cs = contactShadow(4.9, 3.3, 0.5);
  cs.position.set(0, 0.006, 0);
  g.add(cs);

  // （警示牌已挪到高压室左扇门板上，见 warnSign() / doors()）
  // 场坪上的检修箱（带箱门、铰链、把手与丝印，否则在空场坪上就是一块莫名其妙的方盒子）
  const box = new THREE.Group();
  const shell = rbox(0.50, 0.70, 0.35, 0.006, M.powderMid, 1);
  shell.position.y = 0.35;
  box.add(shell);
  const bxDoor = plate(0.42, 0.60, 0.006, M.powderLight);
  bxDoor.position.set(0, 0.36, 0.180);
  box.add(bxDoor);
  const bxGap = plate(0.44, 0.62, 0.004, M.seam);
  bxGap.position.set(0, 0.36, 0.178);
  box.add(bxGap);
  const bxHandle = cyl(0.008, 0.008, 0.09, M.steelBrushed, 10);
  bxHandle.rotation.z = Math.PI / 2;
  bxHandle.position.set(0.145, 0.36, 0.190);
  box.add(bxHandle);
  for (const hy of [0.16, 0.56]) {
    const hg = cyl(0.011, 0.011, 0.035, M.steelBrushed, 10);
    hg.position.set(-0.198, hy, 0.188);
    box.add(hg);
  }
  const bxPlate = plate(0.16, 0.055, 0.003, M.powderWhite);
  bxPlate.position.set(-0.06, 0.50, 0.185);
  box.add(bxPlate);
  // 底座（比箱体略大，压住地面，不再像悬空）
  const bxBase = rbox(0.54, 0.05, 0.39, 0.004, M.concreteDark, 1);
  bxBase.position.y = 0.025;
  box.add(bxBase);
  // 检修箱：挪到箱体右侧、与箱体同一进深，不再站在近正面机位的正前方抢镜
  box.position.set(2.95, 0, 0.55);
  box.rotation.y = -0.35;
  g.add(box);

  return g;
}

export function build() {
  const root = new THREE.Group();
  const hotspots = [];

  /* 天空 */
  /* ⚠️ 把**投影主光的方向**传给天空：否则天空左右对称，
     而地上的影子却朝一边倒 —— 光和天对不上，一眼就假。 */
  root.add(skyDome(150, { sun: [-6.5, 8.5, 5.5] }));

  /* 场坪 */
  /* 场坪 / 草地环 / 围栏整组标注为 scenery：
     ⚠️ 草地环半径最大到 52m（rmu），是「全景跑飞」的主因 —— 它会把包围球撑到几十米，
        相机被 maxDistance 夹回来之后，柜体反而落在画面外。 */
  const siteG = site();
  siteG.userData.scenery = true;
  root.add(siteG);

  /* 箱体 */
  root.add(enclosure());
  const rf = roof();
  rf.userData.explode = [0, 1.05, 0];       // 屋顶整体吊起
  root.add(rf);
  const dr = doors();
  dr.userData.explode = [0, 0, 0.62];       // 三室门一起前移
  root.add(dr);

  /* ---------- 高压室：环网柜 / 负荷开关柜 ---------- */
  const hv = new THREE.Group();
  const hvCab = cabinetShell({ w: 0.92, h: 1.95, d: 0.80, plinth: 0.03 });
  hvCab.position.set(0, 0, 0);
  hv.add(hvCab);
  // 三工位负荷开关（简化：三只触头 + 操作轴）
  for (let i = -1; i <= 1; i++) {
    const ins = insulator(0.16, M.pcBeige);
    ins.position.set(i * 0.22, 0.30, 0.10);
    hv.add(ins);
    const arm = bar(0.035, 0.012, 0.30, M.copper);
    arm.position.set(i * 0.22, 0.50, 0.10);
    hv.add(arm);
  }
  const shaft = cyl(0.014, 0.014, 0.70, M.steelBrushed, 14);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(0, 0.62, 0.10);
  hv.add(shaft);
  // 电缆
  const hvCable = cableBundle(4, 0.9, { r: 0.016, spread: 0.08 });
  hvCable.position.set(0, 0.28, -0.25);
  hv.add(hvCable);
  /* 高压室里的通用元件：负荷开关 / 接地开关 / 熔断器 / CT / PT / 避雷器。
     位置都在柜体局部坐标（hv 组原点 = 柜底中心）。 */
  mountElement(hv, hotspots, 'LBS', {
    build: { w: 0.52, h: 0.60, d: 0.46 }, x: 0, y: 1.02, z: -0.02,
    note: '高压室 · 三工位负荷开关（示意）',
  });
  mountElement(hv, hotspots, 'FUSE', {
    build: { poles: 3 }, x: 0, y: 1.50, z: -0.02, note: '高压室 · 高压熔断器',
  });
  mountElement(hv, hotspots, 'ES', {
    x: 0, y: 0.78, z: 0.10, note: '高压室 · 接地开关',
  });
  /* ⚠️ LBS（三工位负荷开关，实测包围盒高 736mm）底面 y=1.012，
     原 CT 顶 y=1.026 ⇒ y 压 14mm（railfit_probe 第 50 轮实测）。
     CT 下移 30mm 后顶 0.996，与 LBS 底留 16mm。 */
  mountElement(hv, hotspots, 'CT', {
    x: -0.36, y: 0.52, z: -0.24, note: '高压室 · 电流互感器',
  });
  mountElement(hv, hotspots, 'PT', {
    x: 0.36, y: 0.60, z: -0.24, note: '高压室 · 电压互感器',
  });
  mountElement(hv, hotspots, 'SPD', {
    x: -0.36, y: 1.28, z: -0.24, note: '高压室 · 氧化锌避雷器',
  });
  /* ⚠️ 同一场景里第二根线束必须换 key，否则 Map 里后一根覆盖前一根。 */
  regElement(hotspots, 'WIRE', hvCable, {
    key: 'WIRE#1',
    off: [0, 0.46, 0.02], quiet: true, note: '高压室 · 进出线电缆',
  });
  hv.position.set((PART.hv.x0 + PART.hv.x1) / 2, Y0 + 0.06, -0.05);
  hv.userData.explode = [-0.50, 0, 0.95];
  root.add(hv);

  /* ---------- 变压器室：干式变压器 ---------- */
  const tr = new THREE.Group();
  // 槽钢基础
  const ch = rbox(1.30, 0.12, 0.90, 0.006, M.powderDark, 1);
  ch.position.y = 0.06;
  tr.add(ch);
  const xf = dryTransformer({ w: 1.10, h: 1.25, d: 0.75 });
  xf.position.y = 0.12;
  tr.add(xf);
  // 风机
  for (const sx of [-1, 1]) {
    const fan = new THREE.Group();
    const fm = cyl(0.13, 0.13, 0.05, M.pcDark, 24);
    fm.rotation.z = Math.PI / 2;
    fan.add(fm);
    for (let i = 0; i < 7; i++) {
      const bl = plate(0.10, 0.022, 0.004, M.pcGray);
      bl.rotation.x = (i / 7) * Math.PI * 2;
      bl.position.z = 0;
      const holder = new THREE.Group();
      holder.rotation.x = (i / 7) * Math.PI * 2;
      holder.add(bl);
      bl.position.set(0, 0.055, 0);
      fan.add(holder);
    }
    fan.position.set(sx * 0.62, 0.55, -0.42);
    tr.add(fan);
    /* 干变冷却风机：本来就画在场景里，登记成热点（只登记一台，两台一模一样）。 */
    if (sx > 0) {
      regElement(hotspots, 'FAN', fan, {
        off: [0, 0.20, 0.06], quiet: true, note: '变压器室 · 干变冷却风机（通用）',
      });
    }
  }
  tr.position.set((PART.tr.x0 + PART.tr.x1) / 2, Y0 + 0.06, 0.05);
  tr.userData.explode = [0, 0, 0.95];
  root.add(tr);
  /* 干式变压器与冷却风机本来就在场景里，直接登记成热点。 */
  regElement(hotspots, 'XFMR', xf, {
    off: [0, 0.72, 0.42], note: '变压器室 · 干式变压器（通用元件）',
  });

  /* ---------- 低压室：低压配电柜 ---------- */
  const lv = new THREE.Group();
  const lvCab = cabinetShell({ w: 0.92, h: 1.95, d: 0.80, plinth: 0.03 });
  lv.add(lvCab);
  // 出线塑壳断路器排
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const m = rbox(0.16, 0.20, 0.06, 0.006, M.pcDark, 1);
    m.position.set(-0.24 + c * 0.24, 0.45 + r * 0.32, 0.32);
    lv.add(m);
    const hd = handle(0.06, M.pcRed);
    hd.position.set(-0.24 + c * 0.24, 0.45 + r * 0.32, 0.37);
    lv.add(hd);
  }
  const lvCable = cableBundle(4, 0.7, { r: 0.014, spread: 0.07 });
  lvCable.position.set(0, 0.28, -0.22);
  lv.add(lvCable);
  /* 低压室上部（出线断路器排上方）：总开关 / 数显 / 箱内温湿度 */
  mountElement(lv, hotspots, 'MCCB', {
    x: -0.28, y: 1.40, z: 0.28, note: '低压室 · 进线塑壳总开关',
  });
  mountElement(lv, hotspots, 'METER', {
    build: { w: 0.096, h: 0.048, d: 0.075 }, x: 0, y: 1.40, z: 0.30,
    note: '低压室 · 低压侧电压/电流数显',
  });
  mountElement(lv, hotspots, 'TEMPCTRL', {
    key: 'TEMPCTRL#1',
    x: 0.28, y: 1.40, z: 0.28, note: '低压室 · 箱内温湿度控制器（通用）',
  });
  regElement(hotspots, 'WIRE', lvCable, {
    key: 'WIRE#2',
    off: [0, 0.40, 0.02], quiet: true, note: '低压室 · 出线电缆',
  });
  lv.position.set((PART.lv.x0 + PART.lv.x1) / 2, Y0 + 0.06, -0.05);
  lv.userData.explode = [0.50, 0, 0.95];
  root.add(lv);

  /* ---------- 产品安装 ---------- */
  /* 变压器室后壁：干变温控 + 风机报警（整组可随爆炸视图前移） */
  const trInner = new THREE.Group();
  trInner.userData.explode = [0, 0, 0.42];
  const trPanel = plate(1.30, 0.62, 0.004, M.powderWhite);
  trPanel.position.set(0, Y0 + H - 0.55, BZ + 0.10);
  trInner.add(trPanel);
  const trRailY = Y0 + H - 0.55;
  const trRail = dinRail(1.24);
  trRail.position.set(0, trRailY - 0.02, BZ + 0.135);
  trInner.add(trRail);
  root.add(trInner);

  function mount(id, x, y, z, opt = {}) {
    const p = buildProductModel(id);
    /* 导轨安装位（给 opt.zBack / opt.xBack）：统一按「背面贴导轨前表面」摆。
       不这么做的话，panelMeter（原点在前脸）与 dinModule（原点在几何中心）的
       产品在同一根导轨上会差 d/2 ≈ 40~55mm —— 一半浮在导轨外、一半嵌进导轨里，
       而且导轨会横在面板型器件的脸前面。没有这两个参数就是普通安装位，按显式坐标摆。 */
    if (opt.zBack != null || opt.xBack != null) {
      placeOnRail(p, { x, y, z, zBack: opt.zBack, xBack: opt.xBack });
    } else {
      p.position.set(x, y, z);
    }
    if (opt.ry) p.rotation.y = opt.ry;
    isolateMaterials(p);
    p.userData.pid = id;
    (opt.parent || root).add(p);
    hotspots.push(hotspot(id, p, {
      offset: [0, 0.032, 0.02],
      note: opt.note || '',
    }));
    return p;
  }

  // 变压器室后壁导轨前表面 z（导轨中心 BZ+0.135，本体最前面再 +0.005）
  const TR_RAIL_FRONT = BZ + 0.135 + 0.005;
  mount('DTC', -0.30, trRailY, BZ + 0.135, { parent: trInner, zBack: TR_RAIL_FRONT, note: '变压器室后壁 · 干变三相绕组测温与跳闸' });
  mount('TCC', 0.30, trRailY, BZ + 0.135, { parent: trInner, zBack: TR_RAIL_FRONT, note: '变压器室后壁 · 冷却风机监视' });
  mountElement(trInner, hotspots, 'TEMPCTRL', {
    key: 'TEMPCTRL#2',
    x: -0.56, y: trRailY, zBack: TR_RAIL_FRONT,
    note: '变压器室后壁 · 箱内温湿度控制器（通用）',
  });

  /* 低压室内壁：温湿度控制器 + 温度变送器 + 电源切换 */
  const lvInner = new THREE.Group();
  lvInner.userData.explode = [0, 0, 0.42];
  const lvPanelX = PART.lv.x0 + 0.10;
  const lvPanel = plate(0.70, 1.00, 0.004, M.powderWhite);
  lvPanel.rotation.y = Math.PI / 2;
  lvPanel.position.set(lvPanelX + 0.02, Y0 + 1.28, -0.30);
  lvInner.add(lvPanel);
  const lvRails = [Y0 + 1.62, Y0 + 1.36, Y0 + 1.10, Y0 + 0.84];
  lvRails.forEach(ry => {
    const r = dinRail(0.62);
    r.rotation.y = Math.PI / 2;
    r.position.set(lvPanelX + 0.05, ry, -0.30);
    lvInner.add(r);
  });
  for (const dy of [Y0 + 1.78, Y0 + 1.49, Y0 + 1.23, Y0 + 0.97]) {
    const d = wireDuct(0.62, 0.045, 0.03);
    d.rotation.y = Math.PI / 2;
    d.position.set(lvPanelX + 0.05, dy, -0.30);
    lvInner.add(d);
  }
  root.add(lvInner);
  // 低压室内壁导轨前表面 x（导轨中心 lvPanelX+0.05，本体最前面再 +0.005）
  const LV_RAIL_FRONT = lvPanelX + 0.05 + 0.005;
  mount('THC', lvPanelX + 0.05, lvRails[0], -0.30, { parent: lvInner, ry: Math.PI / 2, xBack: LV_RAIL_FRONT, note: '低压室内壁 · 箱内防凝露' });
  mount('RVS', lvPanelX + 0.05, lvRails[1], -0.30, { parent: lvInner, ry: Math.PI / 2, xBack: LV_RAIL_FRONT, note: '低压室内壁 · 站用电双电源切换' });
  mount('TS', lvPanelX + 0.05, lvRails[2], -0.30, { parent: lvInner, ry: Math.PI / 2, xBack: LV_RAIL_FRONT, note: '低压室内壁 · 绕组温度上传后台' });
  /* 第 4 根导轨专给 TC：箱变低压室是温度控制器最典型的落点（防低温 + 防凝露），
     原先只有 3 根导轨、被 THC/RVS/TS 占满，TC 就没地方站。 */
  mount('TC', lvPanelX + 0.05, lvRails[3], -0.30, { parent: lvInner, ry: Math.PI / 2, xBack: LV_RAIL_FRONT, note: '低压室内壁 · 温度控制器（按温度自动启停加热器，比 THC 少一路湿度）' });

  /* ---- 第 50 轮：低压室内壁导轨的空段补「通用做法」那一组 ----
     箱变的低压室出线回路多、逻辑简单，可插拔小继电器 +
     固态继电器（投切加热回路无触点、无动作声响）是现场最常见的替代做法。
     ⚠️ 这四根导轨是 `rotation.y = Math.PI / 2` 的（元件正面朝 +x），
        所以「沿导轨方向」是 **z**、贴面方向是 **x**：
          x = LV_RAIL_FRONT + 元件半深，z 为沿轨位置，ry = Math.PI / 2。
        导轨长 0.62、中心 z = -0.30 ⇒ z ∈ [-0.61, +0.01]；
        lvRails[0] 上 THC 占 z ∈ [-0.3225, -0.2775]（宽 45mm），
        所以 z = -0.50 / -0.455 落在同一根轨的左段空区里。
     ⚠️ 这里没有导轨盲板，所以不设 zBack / xBack
        （`railMounted` 也就不置位）—— 不需要，盲板本来就不存在。 */
  mountElement(lvInner, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#1', x: LV_RAIL_FRONT + 0.029, y: lvRails[0], z: -0.50, ry: Math.PI / 2,
    note: '低压室内壁 · 可插拔小型中间继电器（第 1 只）',
  });
  mountElement(lvInner, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#2', x: LV_RAIL_FRONT + 0.029, y: lvRails[0], z: -0.455, ry: Math.PI / 2,
    note: '低压室内壁 · 可插拔小型中间继电器（第 2 只）',
  });
  mountElement(lvInner, hotspots, 'SSR', {
    /* SSR 深 100mm ⇒ 半深 50mm */
    x: LV_RAIL_FRONT + 0.050, y: lvRails[1], z: -0.50, ry: Math.PI / 2,
    note: '低压室内壁 · 固态继电器（无触点投切，动作无声响、寿命长）',
  });

  /* 变压器绕组 → DTC 的 PT100 引线 */
  for (let i = -1; i <= 1; i++) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(i * 0.36, Y0 + 1.55, 0.28),
      new THREE.Vector3(i * 0.36, Y0 + 1.95, -0.30),
      new THREE.Vector3(i * 0.30, trRailY - 0.06, BZ + 0.16),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 20, 0.006, 8, false), M.cable);
    root.add(tube);
  }

  return {
    root,
    hotspots,
    env: 'outdoor',
    exposure: 0.94,
    fog: { color: 0xb9cfe0, near: 22, far: 110 },
    background: null,
    camera: { pos: [1.55, 2.55, 6.30], target: [0, 1.32, 0] },
    /* ---------- 自适应取景盒 ----------
       户外场景用 dist 模式：注视点不动，相机沿 dir 后退到刚好装下箱变本体。
       ⚠️ 两个坑：
         ① dir 必须按真实机位算 —— unit(pos − aim) = unit(1.55, 1.23, 6.30)，
            仰角只有 0.186（相机 2.55m、箱变顶 2.60m，几乎平视）。凭感觉填 0.39
            会让反解出的距离偏小，窄舞台照样裁掉箱变两侧。
         ② minDist 取现有机位距离 6.60：宽舞台上算出来（6.1~6.5）比它小，
            取 max 后**构图原样不动**，只有 aspect < 1 时才真的后退。
            实测 aspect 0.807 需 8.54m、0.72 需 9.46m —— 原先写死的 6.60 在这两档
            会把箱变左右两侧各裁掉一截。 */
    fit: {
      mode: 'dist',
      dir: [0.2348, 0.1863, 0.9545],
      aim: [0, 1.32, 0],
      minDist: 6.60,
      pad: 1.06,
      parts: [
        [-1.80, 0, -1.10, 1.80, 2.60, 1.10],
      ],
    },
    /* ⚠️ 这里**故意不写 minAz / maxAz** —— 「镜头自由」：
       墙/天花/地面都是单面板（法线朝内），相机绕到墙外时被背面剔除，
       直接看进室内；加了方位角限位反而把「绕到背后看一眼」禁掉。
       极角仍然限位：minPol 允许俯视，maxPol 压住别钻到地面以下。 */
    limits: { minPol: 0.05, maxPol: Math.PI * 0.667, minD: 0.12, maxD: 16 },
    lights: [
      { type: 'hemi', sky: 0xa8cbe8, ground: 0x6a6862, intensity: 0.72 },
      { type: 'ambient', color: 0xb9cfe0, intensity: 0.15 },
      {
        type: 'dir', color: 0xfff2dd, intensity: 2.05, pos: [-6.5, 8.5, 5.5], target: [0, 1.2, 0],
        shadow: true, shadowSize: 2048,
        shadowCam: { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 32 },
      },
      { type: 'dir', color: 0xcfe2f5, intensity: 0.42, pos: [6, 3.5, -5], target: [0, 1.2, 0] },
    ],
  };
}
