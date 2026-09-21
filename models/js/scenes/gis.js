/**
 * gis.js —— 户内场景：110kV GIS 组合电器室
 *
 * GIS = Gas Insulated Switchgear（气体绝缘金属封闭开关设备）。
 * 与 KYN28 的区别：KYN28 是「空气绝缘 + 柜体分室」，GIS 是「SF6 绝缘 + 金属封闭气室」，
 * 断路器、隔离开关、接地开关、母线全部封在接地的金属壳里，
 * 所以体积只有敞开式的几分之一，且不受外界环境影响（GIS 室要求洁净少尘）。
 *
 * ⚠️ 这是**结构与安装关系示意模型**：
 *   · 气室内部（触头、绝缘气体、二次回路）一概不表达；
 *   · 尺寸按行业典型量级取（间隔中心距 1.6m、纵深 3.6m、本体高 2.3m），
 *     不是任何具体工程或厂商的尺寸；
 *   · GIS 本体是**外购主设备**，本公司产品集中在间隔前方的就地控制柜（LCP）里 ——
 *     这正是真实项目里我们产品的落点。
 */
import * as THREE from 'three';
import { M } from '../mats.js';
import {
  rbox, plate, cyl, bar, rot,
  doorPanel, dinRail, wireDuct, terminalRow, cableBundle,
} from '../parts.js';
import { buildProductModel } from '../product-models.js';
import { hotspot, placeOnRail, cullRailBlanks, mountElement, regElement } from '../scene-kit.js';
import { isolateMaterials } from '../mats.js';
import { canvasTex } from '../util.js';

/* ---------- 尺寸（行业典型量级） ---------- */
/* ⚠️ 室宽：三个间隔 + 三台控制柜只占 x ∈ [-2.9, 1.2]（约 4.1m）。
   原先是 11.0m，两侧各留 3.3m 空地板，画面右半幅全是空地 —— 那不像 GIS 室，
   像仓库。收到 9.8m（真实 110kV 三间隔 GIS 室常见 9~10m 跨度），
   再把省下来的地方用「前方电缆沟 + SF6 气瓶架 + 检修工具车」填实。
   所有靠墙件的坐标都是从 RW 算出来的，收窄不会顶到设备。 */
const RW = 9.8;
const RD = 9.6;           // 室深（z）
const RH = 6.2;           // 室高 —— GIS 室要留出线套管的净空，比配电室高
const BAY_PITCH = 1.60;   // 间隔中心距：真实 110kV 间隔 1.2~1.8m
const BAY_H = 2.30;
const BAY_D = 3.60;
const BAY_Z = -1.30;      // 间隔纵深中心
const BAY_X = [-BAY_PITCH, 0, BAY_PITCH];
const LCP_Z = BAY_Z + BAY_D / 2 + 1.10;   // 就地控制柜在间隔前方
/* ⚠️ 控制柜不能在 x 上与间隔**同轴**：柜高 2.2m、间隔本体高 2.3m，
   正对着摆会把间隔本体整片挡死，从默认机位看过去只剩三块柜门。
   真实现场 LCP 也是偏在间隔一侧的，所以统一往 -x 偏半跨（0.85m）：
     柜体 x ∈ [bay-1.25, bay-0.45]，间隔本体 x ∈ [bay-0.65, bay+0.65]，
   两者只重叠 0.20m，间隔中部始终露得出来。 */
const LCP_DX = -0.85;
const LCP_X = BAY_X.map((x) => x + LCP_DX);

/* ============================================================
 * 房间
 * ============================================================ */
function room() {
  const g = new THREE.Group();
  const t = 0.12;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), M.epoxyFloor);
  rot(floor, -Math.PI / 2, 0, 0);
  floor.receiveShadow = true;
  g.add(floor);

  /* 环氧地坪分格缝 —— 第 58 轮。
     ⚠️ gis 是四个户内场景里**唯一**没有地面分格的（kyn28 / dcpanel / assembly 都有，
        见 `grep -nE "分格" models/js/scenes/*.js`）。
        缺了它，9.8×9.6m 的 `epoxyFloor` 就是一整块纯色平面 ——
        这么大的面积上「完全没有构造」比「构造粗糙」更显假。
     ⚠️ 材质用 `M.concreteDark`：与 dcpanel 的地面线**同一种材质** ⇒
        `batchStatic` 会合并，**不新增 draw call**（多出来的只是顶点）。
        间距 1.6m 与 kyn28 一致，双向成格（真实现场环氧地坪就是这么分的）。
     ⚠️ 厚度 0.002、埋深 y=0.001 —— 刚好一半露在地面上；
        再厚就从「一道缝」变成「一根压条」。 */
  for (let i = -3; i <= 3; i++) {
    const l = bar(RW, 0.002, 0.012, M.concreteDark);
    l.position.set(0, 0.001, i * 1.6);
    g.add(l);
    const l2 = bar(0.012, 0.002, RD, M.concreteDark);
    l2.position.set(i * 1.6, 0.001, 0);
    g.add(l2);
  }

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), M.ceilPanel);
  rot(ceil, Math.PI / 2, 0, 0);
  ceil.position.y = RH;
  g.add(ceil);

  const back = plate(RW, RH, t, M.wall);
  back.position.set(0, RH / 2, -RD / 2);
  g.add(back);
  for (const sx of [1, -1]) {
    const s = plate(RD, RH, t, M.wall);
    rot(s, 0, Math.PI / 2, 0);
    s.position.set(sx * RW / 2, RH / 2, 0);
    g.add(s);
  }

  /* 踢脚线 —— 室内场景缺了它墙脚会「浮」 */
  for (const [w, d, x, z] of [[RW, 0.02, 0, -RD / 2 + 0.06], [0.02, RD, -RW / 2 + 0.06, 0], [0.02, RD, RW / 2 - 0.06, 0]]) {
    const k = bar(w, 0.11, d, M.trimDark);
    k.position.set(x, 0.055, z);
    g.add(k);
  }

  /* 地面标线：间隔操作通道（真实现场用黄漆划出）。
     只画「间隔本体前缘 → 控制柜前缘」之间那 0.75m —— 再往北就被控制柜压住了。 */
  const laneZ0 = BAY_Z + BAY_D / 2;        // 间隔本体前缘 = 0.50
  const laneZ1 = LCP_Z - 0.35;             // 控制柜前缘   = 1.25
  for (const x of BAY_X) {
    for (const sx of [-1, 1]) {
      const line = bar(0.06, 0.004, laneZ1 - laneZ0, M.ledAmber);
      line.position.set(x + sx * (BAY_PITCH / 2 - 0.12), 0.004, (laneZ0 + laneZ1) / 2);
      g.add(line);
    }
  }
  const lane = bar(RW - 2.0, 0.004, 0.06, M.ledAmber);
  lane.position.set(0, 0.004, LCP_Z + 0.90);
  g.add(lane);

  /* 顶部行灯（三排，工业厂房式吊装） */
  for (let i = -1; i <= 1; i++) {
    const body = rbox(1.60, 0.09, 0.16, 0.006, M.alu, 1);
    body.position.set(i * 3.2, RH - 0.32, 0.6);
    g.add(body);
    const tube = rbox(1.46, 0.03, 0.10, 0.004, M.lampCool, 1);
    tube.position.set(i * 3.2, RH - 0.38, 0.6);
    g.add(tube);
    for (const sz of [-1, 1]) {
      const rod = cyl(0.006, 0.006, 0.30, M.steelBrushed, 8);
      rod.position.set(i * 3.2 + sz * 0.6, RH - 0.15, 0.6);
      g.add(rod);
    }
  }

  /* 墙上的 SF6 气体泄漏报警器（GIS 室的标志性安全设施） */
  for (const x of [-4.4, 4.4]) {
    const box = rbox(0.24, 0.18, 0.10, 0.006, M.pcGray, 2);
    box.position.set(x, 2.30, -RD / 2 + 0.20);
    g.add(box);
    const scr = plate(0.12, 0.07, 0.004, M.displayOn);
    scr.position.set(x, 2.33, -RD / 2 + 0.255);
    g.add(scr);
    const led = cyl(0.008, 0.008, 0.006, M.ledGreen, 10);
    rot(led, Math.PI / 2, 0, 0);
    led.position.set(x + 0.08, 2.24, -RD / 2 + 0.256);
    g.add(led);
  }

  return g;
}

/* ============================================================
 * 就地控制柜（LCP）—— 本公司产品的实际落点
 *
 * 真实 LCP：落地柜 800 宽 × 600 深 × 2200 高，
 * 柜内是中间继电器、变送器、开关电源、端子排、温湿度控制器，
 * 面板上是仪表与操作开关。柜门做成打开的，不然柜内什么都看不见。
 * ============================================================ */
function lcpCabinet() {
  const W = 0.80, H = 2.20, D = 0.60, t = 0.018;
  const g = new THREE.Group();

  /* 柜体：底板 + 后/左右侧壁 + 顶板 */
  const base = rbox(W, 0.06, D, 0.004, M.powderDark, 1);
  base.position.y = 0.03;
  g.add(base);
  const back = plate(W, H, t, M.powderLight);
  back.position.set(0, H / 2, -D / 2 + t / 2);
  g.add(back);
  for (const sx of [1, -1]) {
    const s = plate(D, H, t, M.powderLight);
    rot(s, 0, Math.PI / 2, 0);
    s.position.set(sx * (W / 2 - t / 2), H / 2, 0);
    g.add(s);
  }
  const top = plate(W, D, t, M.powderMid);
  rot(top, Math.PI / 2, 0, 0);
  top.position.set(0, H - t / 2, 0);
  g.add(top);

  /* 前门（右开 ~99°，露出内装板）
     ⚠️ 旋转方向：门扇从铰点朝 **-x** 伸出，绕 Y 正转才是往柜前（+z）开；
     门扇朝 +x 伸出的（rmu 那种左铰）要用负角。搞反了门会插进柜体里。 */
  const door = doorPanel({
    w: W - 0.03, h: H - 0.10, t: 0.016,
    windows: [{ x: 0, y: 0.42, w: 0.30, h: 0.22 }],
    handle: { x: -(W / 2 - 0.09), y: 0 },
    lock: { x: -(W / 2 - 0.09), y: -0.22 },
    plate: { x: 0, y: H / 2 - 0.28, w: 0.30, h: 0.11, title: '就地控制柜', sub: 'LCP' },
    hinges: [-0.60, 0, 0.60],
    hingeSide: 1,
  });
  const pivot = new THREE.Group();
  pivot.position.set(W / 2 - 0.015, H / 2, D / 2 + 0.005);
  door.position.set(-(W - 0.03) / 2, 0, 0);
  pivot.add(door);
  pivot.rotation.y = 1.72;           // 打开 ~99°
  /* 可开合（见 app.js 的 collectDoors）：门扇从铰点朝 -x 伸出、落在门洞上，
     rotation.y = 0 即关闭，正角往柜前开。 */
  pivot.userData.door = { open: 1.72, closed: 0 };
  pivot.userData.explode = [0, 0, 0.55];
  g.add(pivot);

  /* 内装板 + 两条 DIN 导轨 */
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
  const RAIL_FRONT = PLATE_Z + 0.024 + 0.005;

  /* 走线槽 + 端子排 + 二次线 */
  const ducts = [];
  for (const dy of [1.98, 1.74, 1.34, 1.00, 0.76]) {
    const d = wireDuct(W - 0.16, 0.042, 0.030);
    d.position.set(0, dy, PLATE_Z + 0.024);
    g.add(d);
    ducts.push(d);
  }
  const tr = terminalRow(18, { w: 0.0072, h: 0.046, d: 0.042 });
  tr.position.set(0, 0.62, PLATE_Z + 0.022);
  g.add(tr);
  const cb = cableBundle(5, 0.30, { r: 0.0045, spread: 0.05 });
  cb.position.set(0, 0.52, PLATE_Z + 0.01);
  g.add(cb);

  /* ⚠️ `door` 要一起导出（第 55 轮）：面板型元件（就地人机界面一类）得挂在
     **门扇**上，而门扇是 lcpCabinet 的局部变量。挂门扇上是对的 —— 门是 movers，
     装置必须跟着门一起开合。 */
  return { group: g, W, H, D, RAIL_A, RAIL_B, RAIL_FRONT, PLATE_Z, ducts, tr, cb, door };
}

/* ============================================================
 * 现场设施（把房间的空地板填实，同时让 GIS 室「像个真在用的房间」）
 * ============================================================ */

/**
 * 室内电缆沟 —— 沿房间前方通长敷设，钢盖板 + 两处检修开口。
 * ⚠️ 地面是一张平面，真做「下沉沟体」会被地面整片挡死。
 *    所以改成三段拼法：贴地深色条（读作开口）+ 两侧角钢沟沿 + 钢盖板压在上方。
 *    靠盖板与角钢的高差和投影把立体感做出来，不必真的挖穿地板。
 */
function cableTrench(len = 7.60) {
  const g = new THREE.Group();
  const W = 0.72, PLATE_L = 0.60, PITCH = 0.62;

  const bot = bar(len, 0.006, W - 0.10, M.pcBlack);
  bot.position.y = 0.005;
  g.add(bot);

  for (const sz of [-1, 1]) {
    const e = bar(len, 0.05, 0.055, M.steelBrushed);
    e.position.set(0, 0.025, sz * (W / 2 - 0.027));
    g.add(e);
  }

  const n = Math.floor((len - 0.10) / PITCH);
  for (let i = 0; i < n; i++) {
    const xc = -len / 2 + 0.31 + i * PITCH;
    /* 留两段不盖 —— 露出沟内电缆，不然整条沟读起来像地砖分缝 */
    if ((xc > 0.55 && xc < 1.25) || (xc > -1.95 && xc < -1.25)) continue;
    const p = rbox(PLATE_L - 0.02, 0.026, W - 0.10, 0.003, M.alu, 1);
    p.position.set(xc, 0.019, 0);
    p.castShadow = true;
    g.add(p);
    for (const sx of [-1, 1]) {
      const eye = cyl(0.013, 0.013, 0.016, M.steelBrushed, 10);
      eye.position.set(xc + sx * 0.17, 0.040, 0);
      g.add(eye);
    }
  }

  /* 开口处露出的电缆：cableBundle 默认沿 -z 生长，绕 Y 转 90° 后沿 -x，
     横向 spread 也跟着转到 z —— 正好横铺在沟宽方向。
     ⚠️ 长度必须**短于开口**、且居中摆：盖板在 y=0.019、电缆在 y=0.042，
        电缆一旦比开口长，就会从相邻盖板底下穿出来（看起来像穿模）。
        开口宽 0.60（xc ± 0.30），电缆取 0.50、起点 = 开口中心 + 0.25。
        spread 也不能给满：5 根按 ±2·spread 展开，0.16 会摊到 ±0.32，
        超出 0.62 宽的沟壁，取 0.11（±0.22）刚好在沟内。 */
  for (const xc of [0.85, -1.63]) {
    const cb = cableBundle(5, 0.50, { r: 0.014, spread: 0.11 });
    rot(cb, 0, Math.PI / 2, 0);
    cb.position.set(xc + 0.25, 0.042, 0);
    g.add(cb);
  }
  return g;
}

/** SF6 气体回收/充气装置 + 备用气瓶（GIS 室标志性检修装备） */
function sf6Set() {
  const g = new THREE.Group();

  /* 小车底盘 */
  const deck = rbox(0.78, 0.06, 0.46, 0.004, M.steelBrushed, 1);
  deck.position.y = 0.24;
  g.add(deck);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = bar(0.03, 0.22, 0.03, M.steelBrushed);
    leg.position.set(sx * 0.33, 0.11, sz * 0.17);
    g.add(leg);
    const wheel = cyl(0.045, 0.045, 0.028, M.pcBlack, 12);
    rot(wheel, 0, 0, Math.PI / 2);
    wheel.position.set(sx * 0.33, 0.045, sz * 0.17);
    g.add(wheel);
  }
  /* 主机箱 + 面板 */
  const body = rbox(0.52, 0.46, 0.34, 0.008, M.powderBrand, 1);
  body.position.set(-0.10, 0.50, 0);
  g.add(body);
  const face = plate(0.26, 0.18, 0.004, M.displayOn);
  face.position.set(-0.10, 0.56, 0.174);
  g.add(face);
  const knob = cyl(0.022, 0.022, 0.016, M.pcBlack, 14);
  rot(knob, Math.PI / 2, 0, 0);
  knob.position.set(0.06, 0.42, 0.176);
  g.add(knob);
  /* 软管盘 */
  const hose = cyl(0.13, 0.13, 0.07, M.pcGray, 18);
  rot(hose, 0, 0, Math.PI / 2);
  hose.position.set(0.32, 0.55, 0);
  g.add(hose);

  /* 两只备用气瓶（立在小车后侧） */
  for (let i = 0; i < 2; i++) {
    const x = -0.22 + i * 0.44;
    const cy = 0.56;
    const bottle = cyl(0.105, 0.105, 0.92, M.aluDark, 16);
    bottle.position.set(x, cy, -0.36);
    bottle.castShadow = true;
    g.add(bottle);
    const dome = cyl(0.105, 0.055, 0.10, M.aluDark, 16);
    dome.position.set(x, cy + 0.51, -0.36);
    g.add(dome);
    const valve = cyl(0.028, 0.028, 0.10, M.brass, 12);
    valve.position.set(x, cy + 0.60, -0.36);
    g.add(valve);
    const gauge = cyl(0.032, 0.032, 0.012, M.pcBlack, 14);
    rot(gauge, Math.PI / 2, 0, 0);
    gauge.position.set(x + 0.05, cy + 0.55, -0.36);
    g.add(gauge);
    /* 防倒链/护栏 */
    const guard = bar(0.92, 0.03, 0.03, M.steelBrushed);
    guard.position.set(0, cy + 0.36, -0.47);
    g.add(guard);
  }
  return g;
}

/** 检修工具车（两层台面 + 四轮） */
function toolCart() {
  const g = new THREE.Group();
  const W = 0.62, D = 0.40, H = 0.84;

  const top = rbox(W, 0.04, D, 0.004, M.alu, 1);
  top.position.y = H;
  top.castShadow = true;
  g.add(top);
  const mat = plate(W - 0.06, D - 0.06, 0.004, M.rubber);
  rot(mat, -Math.PI / 2, 0, 0);
  mat.position.y = H + 0.022;
  g.add(mat);
  const mid = rbox(W - 0.04, 0.03, D - 0.04, 0.004, M.aluDark, 1);
  mid.position.y = 0.34;
  g.add(mid);

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = bar(0.026, H, 0.026, M.steelBrushed);
    leg.position.set(sx * (W / 2 - 0.03), H / 2, sz * (D / 2 - 0.03));
    g.add(leg);
    const wheel = cyl(0.048, 0.048, 0.03, M.pcBlack, 12);
    rot(wheel, 0, 0, Math.PI / 2);
    wheel.position.set(sx * (W / 2 - 0.03), 0.048, sz * (D / 2 - 0.03));
    g.add(wheel);
  }

  /* 台面上的工具箱与万用表 */
  const box = rbox(0.30, 0.15, 0.19, 0.006, M.pcRed, 1);
  box.position.set(-0.11, H + 0.10, 0);
  g.add(box);
  const boxLid = rbox(0.30, 0.02, 0.19, 0.006, M.pcDark, 1);
  boxLid.position.set(-0.11, H + 0.185, 0);
  g.add(boxLid);
  const mm = rbox(0.13, 0.05, 0.08, 0.004, M.pcDark, 1);
  mm.position.set(0.16, H + 0.05, 0.02);
  g.add(mm);
  const mmFace = plate(0.09, 0.035, 0.003, M.displayOn);
  mmFace.position.set(0.16, H + 0.078, 0.02);
  g.add(mmFace);
  return g;
}

/** 绝缘操作杆（挂墙） */
function opRod() {
  const g = new THREE.Group();
  const rod = cyl(0.017, 0.017, 1.70, M.pcBeige, 12);
  g.add(rod);
  const head = cyl(0.024, 0.017, 0.10, M.alu, 12);
  head.position.y = 0.90;
  g.add(head);
  const hook = bar(0.10, 0.012, 0.012, M.alu);
  hook.position.set(0.05, 0.95, 0);
  g.add(hook);
  const grip = cyl(0.021, 0.021, 0.22, M.pcDark, 12);
  grip.position.y = -0.74;
  g.add(grip);
  for (const dy of [0.62, -0.30]) {
    const clip = rbox(0.05, 0.03, 0.05, 0.004, M.steelBrushed, 1);
    clip.position.set(0, dy, -0.04);
    g.add(clip);
  }
  return g;
}

/* ============================================================
 * 场景构建
 * ============================================================ */
export function build() {
  const root = new THREE.Group();
  const hotspots = [];

  root.add(room());

  /* ---------- 三个 GIS 间隔 + 间隔之间的贯通母线 ---------- */
  /* 母线先建到一个独立 Group 里 —— 贯通母线是**一件可单独点选的元件**，
     不能和间隔本体糊在一起，也不能用 clone 再摆一遍
     （clone 会与原件完全重合：z-fighting + 白费一倍的 draw call）。 */
  const busGroup = new THREE.Group();
  BAY_X.forEach((x, i) => {
    const bay = mountElement(root, hotspots, 'GIS', {
      x, y: BAY_H / 2, z: BAY_Z,
      key: `GIS#${i + 1}`,
      off: [0, 1.05, 0.10],
      note: `间隔 ${i + 1} · GIS 本体（外购主设备，气室内部不作表达）`,
    });
    bay.userData.explode = [0, 0, 0.30];

    /* 间隔之间的贯通母线筒（三相）—— 直接建进 busGroup，位置就用世界坐标
       （busGroup 自身不位移，所以子件的 position 即世界位置） */
    if (i < BAY_X.length - 1) {
      for (let k = -1; k <= 1; k++) {
        const tube = cyl(0.17, 0.17, BAY_PITCH, M.alu, 18);
        rot(tube, 0, 0, Math.PI / 2);
        tube.position.set(x + BAY_PITCH / 2, BAY_H / 2 + BAY_H * 0.30, BAY_Z + k * 0.36);
        busGroup.add(tube);
      }
    }
  });
  if (busGroup.children.length) {
    root.add(busGroup);
    /* ⚠️ 这里**不能**给 quiet。
       quiet 是给「被柜门 / 舱壁挡住、标签会穿透到正面糊成一片」的元件用的；
       贯通母线筒悬在间隔之间、离地 2m 多，默认机位下前方没有任何遮挡物
       （quiet_audit.js 用相机射线复核过：锚点 9.87m、首个交点更远 → 未遮挡）。
       原先顺手给了 quiet，结果这条最该被看见的 GIS 特征在默认视图里根本没有标签。 */
    regElement(hotspots, 'BUS', busGroup, {
      off: [0, 0.30, 0.06],
      note: '间隔之间 · 贯通母线筒（三相，SF6 气室）',
    });
  }

  /* ---------- 就地控制柜 + 柜内本公司产品 ----------
     本公司产品放在**中间那台**（LCP_X[1] = -0.85）：它在默认机位下最靠近画面中心，
     放最左边那台的话产品标签会挤到舞台边缘去。 */
  const L = lcpCabinet();
  L.group.position.set(LCP_X[1], 0, LCP_Z);
  L.group.userData.explode = [0, 0, 0.30];
  root.add(L.group);
  regElement(hotspots, 'LCP', L.group, {
    off: [0, 1.15, 0.06],
    note: '间隔 2 前方 · 就地控制柜（本公司二次元件集中安装处）',
  });

  /* 柜内产品：背面贴导轨前表面
     ⚠️ 导轨全长 0.64m（x ∈ [-0.32, 0.32]）。RN-FT / RN-FB 是 90mm 宽的
     数字式量度/保护继电器，比普通 45mm 模块宽一倍 —— 原来按「整数槽位」
     （x = (slot-4)×0.045）排，两只会互相顶住。所以这里改成**直接给中心坐标**，
     按各自真实宽度留缝。 */
  function mount(id, railY, x, note) {
    const p = buildProductModel(id);
    placeOnRail(p, { x, y: railY, zBack: L.RAIL_FRONT });
    p.rotation.y = 0;
    isolateMaterials(p);
    p.userData.pid = id;
    L.group.add(p);
    hotspots.push(hotspot(id, p, { offset: [0, 0.030, 0.02], note }));
    return p;
  }
  /* 上排：位置监视 → 中间 → 双位置 → 防跳及低气压闭锁（右端 90mm 宽） */
  mount('RL-THW', L.RAIL_A, -0.255, '就地控制柜 · 隔离开关/接地开关位置监视');
  mount('RC', L.RAIL_A, -0.145, '就地控制柜 · 跳合闸命令中间继电器');
  mount('RDP', L.RAIL_A, -0.035, '就地控制柜 · 双位置信号记忆与重动');
  mount('RN-FT', L.RAIL_A, 0.145, '就地控制柜 · 防跳 + SF6 低气压闭锁（气室压力低于闭锁值禁止分合闸）');
  /* 下排：电量变送 → 非全相保护 → 防凝露温控 */
  mount('TE', L.RAIL_B, -0.145, '就地控制柜 · 电量变送器（电流/电压上传主控）');
  mount('RN-FB', L.RAIL_B, 0.020, '就地控制柜 · 非全相保护（分相操作断路器只跳一相时延时跳三相）');
  mount('THC', L.RAIL_B, 0.185, '就地控制柜 · 柜内防凝露加热控制');

  /* 柜内通用元件 */
  mountElement(L.group, hotspots, 'PSU_G', {
    x: -0.30, y: L.RAIL_B, zBack: L.RAIL_FRONT, note: '就地控制柜 · 二次回路开关电源',
  });

  /* ---- 第 50 轮：就地控制柜补「通用做法」那一组 ----
     GIS 就地柜的二次回路同样是「专用继电器 + 可插拔小继电器混装」，
     这里把可插拔 / 超薄 / 时间继电器补上，跟上面那排本公司专用件同框对比。
     ⚠️ 占位复核（导轨全长 0.64m，x ∈ [-0.32, +0.32]）：
        RAIL_A 已占 RL-THW(-0.255, 宽 45) RC(-0.145, 宽 45) RDP(-0.035, 宽 45)
                      RN-FT(+0.145, 宽 90)
               ⇒ 空段 [-0.0125, +0.10] 与 [+0.19, +0.32]
        RAIL_B 已占 TE(-0.145) RN-FB(+0.020, 宽 90) THC(+0.185) PSU_G(-0.30, 宽 55)
               ⇒ 空段 [+0.065, +0.1625] 与 [+0.2075, +0.32]
        下面每一只都落在空段里，且离最近邻居 ≥ 20mm。 */
  mountElement(L.group, hotspots, 'TIME_RELAY', {
    x: 0.030, y: L.RAIL_A, zBack: L.RAIL_FRONT,
    note: '就地控制柜 · 时间继电器（延时回路）',
  });
  mountElement(L.group, hotspots, 'RELAY_SLIM', {
    key: 'RELAY_SLIM#1', x: 0.070, y: L.RAIL_A, zBack: L.RAIL_FRONT,
    note: '就地控制柜 · 超薄型中间继电器（第 1 只）',
  });
  mountElement(L.group, hotspots, 'RELAY_SLIM', {
    key: 'RELAY_SLIM#2', x: 0.085, y: L.RAIL_A, zBack: L.RAIL_FRONT,
    note: '就地控制柜 · 超薄型中间继电器（第 2 只）',
  });
  mountElement(L.group, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#1', x: 0.090, y: L.RAIL_B, zBack: L.RAIL_FRONT,
    note: '就地控制柜 · 可插拔小型中间继电器（第 1 只）',
  });
  mountElement(L.group, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#2', x: 0.120, y: L.RAIL_B, zBack: L.RAIL_FRONT,
    note: '就地控制柜 · 可插拔小型中间继电器（第 2 只）',
  });
  /* meterUnit 的原点在**前脸**、机身向后 75mm：z = PLATE_Z 即穿板安装。 */
  mountElement(L.group, hotspots, 'METER', {
    x: 0.30, y: 1.90, z: L.PLATE_Z, note: '就地控制柜 · 数显仪表',
  });
  regElement(hotspots, 'TERMINAL', L.tr, {
    off: [0, 0.032, 0.02], quiet: true, note: '就地控制柜 · 二次端子排',
  });

  /* ---------- 第 51 轮：面板型大件 ----------
     IED 一体化保护测控装置 155×180×90，装**内装板**（元件说明书写的是
     「嵌入柜门 / 面板」，装内装板是允许的两种方式之一）。
     ⚠️⚠️ 落点先算过空带（线槽**不登记热点**，必须去读源码抄坐标）：
         TERMINAL 顶 0.652 / 线槽 0.76 顶 0.781 / 线槽 1.00 底 0.979 /
         RAIL_B 器件底 1.114 / 线槽 1.34 底 1.361 / RAIL_A 器件底 1.474 /
         线槽 1.74 底 1.761 / METER 底 1.876 / 线槽 1.98 底 1.959。
         各空带：87 / **198** / 93 / 113 / 113 / 153 / 115 mm。
         IED 要 180mm ⇒ **只有 0.781~0.979 这条（198mm）装得下**。
         取 y = 0.88（盒 0.79~0.97），上下各只剩 9mm —— 这是全场景最紧的一处，
         ⚠️ 下一轮谁动这两条线槽（0.76 / 1.00）都必须重算。 */
  mountElement(L.group, hotspots, 'IED', {
    x: 0, y: 0.88, zBack: L.PLATE_Z + 0.002,
    note: '就地控制柜 · 一体化保护测控装置（保护+测量+控制+通信四合一）',
  });

  /* ---------- 第 55 轮：就地人机界面（`gis.elements` 声明了 HMI） ----------
     HMI 200×150×45。`data.js` 的口径是「控制柜门板、成套设备操作面」，
     所以装在**就地控制柜的门板外表面**上 —— 柜内安装板已经排满了：
     第 51 轮的 IED 占掉了唯一一条 ≥180mm 的连续空带（见上面那段注释）。
     ⚠️ 落点先算净空（门扇局部系，`doorPanel` 把门板中心放在原点）：
          宽 0.77 / 高 2.10 ⇒ x ∈ [-0.385, 0.385]、y ∈ [-1.05, 1.05]；
          门上已有：观察窗 (0, 0.42, 0.30×0.22) → y ∈ [0.31, 0.53]、
                    铭牌   (0, 0.82, 0.30×0.11) → y ∈ [0.765, 0.875]、
                    把手 / 锁 在 x = -0.31。
        ⇒ 取**观察窗正下方** y = 0.16（盒 0.085~0.235）：离窗底 75mm、
          离把手（x -0.31）在 x 上完全不重叠、离门左右折边各 285mm。
     z = 门板半厚 0.008 + 装置半厚 0.0225 = 0.0305（贴门板外表面）。
     ⚠️ 门扇默认是**开着**的（pivot.rotation.y = 1.72 ≈ 99°），外表面朝 +x；
        默认机位 (5.00, 3.20, 7.20) 在柜的右前方，与门面法线夹角约 53° ⇒ 看得见。
        （第 55 轮新加的 `panel_face_probe.js` 会守住这条：面板件的朝向必须
        与默认镜头方向夹角 < 70°，否则「装上去等于没装」。） */
  mountElement(L.door, hotspots, 'HMI', {
    x: 0, y: 0.16, z: 0.0305,
    note: '就地控制柜门板 · 就地人机界面（触摸屏：数值/曲线/状态/告警集中显示）',
  });

  /* 无线测温传感器 39×44×26（含卡箍）—— 真机的安装位置就是**导体上**，
     所以这里卡在「间隔之间的贯通母线筒」顶上，监测母线温升。
     几何来源（`gis.js` 建 busGroup 那一段）：母线筒 φ340mm、
     三相 z = BAY_Z + k×0.36 = -1.66 / -1.30 / -0.94，管中心 y = 1.840，
     ⇒ 管顶 y = 2.010。两根筒的中心 x = -0.80 / +0.80。
     卡箍最低点在组原点下方 0.0234（`strap` 在 y = -h×0.98，再减半个厚度）
     ⇒ 组原点 y = 2.010 + 0.0234 = 2.033。
     ⚠️ 这是**卡装件**，包围盒必然压进母线筒 —— `railfit_probe.js` 里
        `CLAMP × 导体类` 的重叠是设计意图，不算缺陷。 */
  for (const [i, bx] of [-0.80, 0.80].entries()) {
    mountElement(root, hotspots, 'WIRELESS_TEMP', {
      key: `WIRELESS_TEMP#${i + 1}`,
      x: bx, y: 2.033, z: -1.30,
      note: `贯通母线筒 ${i + 1} · 无线测温传感器（吸附在母线筒外壳，监测温升）`,
    });
  }

  regElement(hotspots, 'DUCT', L.ducts[0], {
    off: [0, 0.032, 0.02], quiet: true, note: '就地控制柜 · 走线槽',
  });
  regElement(hotspots, 'WIRE', L.cb, {
    off: [0, 0.05, 0.02], quiet: true, note: '就地控制柜 · 二次线束',
  });
  L.group.userData.blankCulled = cullRailBlanks(L.group);

  /* ---------- 另外两个间隔前方也各摆一台控制柜（不重复登记产品） ---------- */
  for (const i of [0, 2]) {
    const c = lcpCabinet();
    c.group.position.set(LCP_X[i], 0, LCP_Z);
    c.group.userData.explode = [0, 0, 0.30];
    root.add(c.group);
    c.group.userData.blankCulled = cullRailBlanks(c.group);
  }

  /* ---------- 室内接地干线（沿墙一圈，带临时接地端子） ---------- */
  const gnd = new THREE.Group();
  const gx = RW / 2 - 0.30;
  for (const sz of [-1, 1]) {
    const run = bar(RW - 0.6, 0.05, 0.012, M.copper);
    run.position.set(0, 0.32, sz * (RD / 2 - 0.30));
    gnd.add(run);
  }
  for (const sx of [-1, 1]) {
    const run = bar(0.012, 0.05, RD - 0.6, M.copper);
    run.position.set(sx * gx, 0.32, 0);
    gnd.add(run);
  }
  root.add(gnd);
  regElement(hotspots, 'GNDBAR', gnd, {
    off: [0, 0.16, 0.02], quiet: true, note: '室内 · 接地干线（沿墙敷设，带临时接地端子）',
  });

  /* ---------- 间隔前的绝缘垫与操作凳（真实现场标配） ---------- */
  for (const x of BAY_X) {
    const mat = rbox(0.90, 0.012, 1.60, 0.004, M.rubber, 1);
    mat.position.set(x, 0.006, LCP_Z - 0.05);
    root.add(mat);
  }

  /* ---------- 现场设施：把房间的空地板填实 ----------
     原先把房间收窄到 9.8m 之后，前方还有约 2.6m 深的地板是空的 ——
     一个「真在用的 GIS 室」不会长这样。按真实现场补四件：
     前方电缆沟（进出线电缆由此引入）、SF6 回收充气装置（含备用气瓶）、
     检修工具车、挂墙绝缘操作杆。四件都登记成可点热点，
     来源分别是「示意元件 / 其他厂商设备 / 示意元件 / 通用元件」。 */
  const trench = cableTrench(7.60);
  trench.position.set(0, 0, 3.30);
  root.add(trench);
  regElement(hotspots, 'TRENCH', trench, {
    off: [0, 0.10, 0.02], quiet: true,
    note: '室内前方 · 电缆沟（钢盖板 + 两处检修开口，进出线电缆由沟内引入）',
  });

  const sf6 = sf6Set();
  sf6.position.set(-4.00, 0, 1.80);
  sf6.rotation.y = Math.PI / 2;          // 面朝房间中心（背靠左墙）
  root.add(sf6);
  regElement(hotspots, 'SF6SET', sf6, {
    off: [0, 0.78, 0.02],
    note: '室内左前 · SF6 气体回收/充气装置与备用气瓶（气室抽真空、充气、回收用）',
  });

  const cart = toolCart();
  cart.position.set(4.00, 0, 1.80);
  cart.rotation.y = -0.30;
  root.add(cart);
  regElement(hotspots, 'TOOLCART', cart, {
    off: [0, 0.98, 0.02],
    note: '室内右前 · 检修工具车（绝缘工具与仪表随工位移动）',
  });

  const rod = opRod();
  rod.position.set(-4.78, 1.70, 3.30);
  rod.rotation.y = Math.PI / 2;          // 挂钩贴左墙
  root.add(rod);
  regElement(hotspots, 'OPROD', rod, {
    off: [0, 0.95, 0.02],
    note: '室内左墙 · 绝缘操作杆（挂墙存放，操作隔离开关与接地开关用）',
  });

  /* ---------- 警示牌 ---------- */
  const warnTex = canvasTex(256, 320, (g2) => {
    g2.fillStyle = '#f2c800'; g2.fillRect(0, 0, 256, 320);
    g2.strokeStyle = '#111'; g2.lineWidth = 10; g2.strokeRect(10, 10, 236, 300);
    g2.fillStyle = '#111'; g2.textAlign = 'center';
    g2.font = '800 100px "PingFang SC",sans-serif';
    g2.fillText('⚡', 128, 148);
    g2.font = '800 40px "PingFang SC",sans-serif';
    g2.fillText('高压危险', 128, 224);
    g2.font = '700 22px "PingFang SC",sans-serif';
    g2.fillText('SF6 气室 · 禁止靠近', 128, 268);
  });
  for (const x of [-RW / 2 + 1.6, RW / 2 - 1.6]) {
    const warn = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 0.375),
      new THREE.MeshStandardMaterial({ map: warnTex, roughness: 0.6, side: THREE.DoubleSide }));
    warn.position.set(x, 1.65, -RD / 2 + 0.14);
    root.add(warn);
  }

  return {
    root,
    hotspots,
    env: 'indoor',
    exposure: 1.02,
    fov: 50,
    camera: { pos: [5.00, 3.20, 7.20], target: [-0.40, 1.28, -0.55] },
    /* ---------- 自适应取景盒 ----------
       户内用 fov 模式：**机位与注视点都不动，只在舞台变窄时把视场角撑大**。
       户内绝不能靠后退取景 —— 相机一退就穿出后墙和天花板，看到的是房间外面。
       这里的 parts 是「必须完整入画的设备」（三个间隔 + 三台就地控制柜）；
       房间的墙与天花故意**不列进去** —— 让它们自然裁切才对，全框进去会
       把相机推到房间外。aspect 0.89 下反解需要 49.3° < 场景的 50°，所以
       常规窗口下画面不变，只有更窄的舞台才会自动放宽。 */
    fit: {
      mode: 'fov',
      fovMax: 68,
      parts: [
        ...BAY_X.flatMap((x) => ([
          [x - 0.65, 0, BAY_Z - BAY_D / 2, x + 0.65, BAY_H, BAY_Z + BAY_D / 2],
          [x + LCP_DX - 0.40, 0, LCP_Z - 0.30, x + LCP_DX + 0.40, 2.20, LCP_Z + 0.30],
        ])),
      ],
    },
    /* ⚠️ 这里**故意不写 minAz / maxAz** —— 「镜头自由」：
       墙/天花/地面都是单面板（法线朝内），相机绕到墙外时被背面剔除，
       直接看进室内；加了方位角限位反而把「绕到背后看一眼」禁掉。
       极角仍然限位：minPol 允许俯视，maxPol 压住别钻到地面以下。 */
    limits: { minPol: 0.05, maxPol: Math.PI * 0.545, minD: 0.10, maxD: 24 },
    lights: [
      { type: 'hemi', sky: 0xdfe8f2, ground: 0x5a5f58, intensity: 0.62 },
      { type: 'ambient', color: 0xdfe8f2, intensity: 0.26 },
      {
        type: 'dir', color: 0xffffff, intensity: 1.05, pos: [-5.0, 8.0, 5.0], target: [0, 1.2, -1.0],
        shadow: true, shadowSize: 2048,
        shadowCam: { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 },
      },
      { type: 'dir', color: 0xdce8f5, intensity: 0.42, pos: [6.0, 5.0, -3.0], target: [0, 1.4, -1.0] },
      /* 顶部行灯的暖白补光：室内场景全靠它把「工业照明感」做出来 */
      { type: 'point', color: 0xf2f6ff, intensity: 12, pos: [0, RH - 0.5, 0.6], distance: 14 },
    ],
  };
}
