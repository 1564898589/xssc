/**
 * elements.js —— 通用元件 / 外购主设备「示意模型」库
 *
 * ⚠️ 定位：与 product-models.js 同一套口径 —— 这是**示意模型**。
 *   用途是让销售看懂「真实柜里都有什么、各自长什么样、装在哪」，
 *   不是实物级还原，也不代表任何具体厂商型号。
 *
 * 编写纪律：
 *   · 外形只做**行业典型外观**的简化几何体（方盒 / 圆柱 / 环 / 薄板），
 *     不推断内部结构、不补写参数、不抄任何具体厂商的型号外观细节；
 *   · 尺寸是「为安装关系可读」而设的示意尺寸（米），不是选型依据；
 *   · 说明文字在 data.js 的 GENERIC 表里，这里只管几何。
 *
 * 统一约定（与 wedgeModule 一致，场景才摆得正）：
 *   · 原点在几何中心；+Z 朝前（面板 / 操作面方向）；Y 向上；
 *   · 返回 Group；`g.userData.size = [w,h,d]` 供场景排布使用。
 *
 * 性能：单个元件 3~8 个 Mesh，共用 M.* 里的共享材质（已打 userData.shared），
 * 场景 build 之后统一走 batchStatic 合并。
 */
import * as THREE from 'three';
import { M, pvCellMat } from './mats.js';
import {
  rbox, plate, cyl, bar, grp, at, rot,
  insulator, busbar, wireDuct, terminalRow, dinRail, dryTransformer, cableBundle,
  screenTex, labelTex, louverPanel, handle, gland,
  /* ⚠️ doorPanel 必须在这儿。prefabHut 的门用它，而 prefabHut 在 wind 场景
     上线前从没被调用过 —— 漏了 import 也没人发现（一旦调用就是 ReferenceError，
     而且是在 build() 里抛，表现为「点了场景一直转圈」）。 */
  doorPanel,
} from './parts.js';

/* 统一的铭牌小贴片：只在需要「这是什么东西」的元件上用，别到处贴（会糊）。
   注意 labelTex 的字号是按画布高自动算的，传 size 没用。 */
function nameplate(w, h, text, sub = '') {
  const t = labelTex(text, sub, { w: 256, h: 64 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6 }));
  return m;
}

/* ============================================================
 * 一次主回路元件
 * ========================================================== */

/**
 * 真空断路器（手车式）—— 柜内最大的一件主设备。
 * 外观要点：底盘车 + 机构箱 + 三只立式真空灭弧室（圆柱）+ 触臂。
 */
export function vcbTruck(o = {}) {
  const { w = 0.60, h = 0.72, d = 0.62, poles = 3 } = o;
  const g = new THREE.Group();

  /* 底盘车 */
  const base = rbox(w, h * 0.20, d * 0.92, 0.006, M.steelBrushed, 2);
  base.position.y = -h * 0.40; g.add(base);
  for (const x of [-w * 0.34, w * 0.34]) {
    const wheel = cyl(0.022, 0.022, 0.016, M.aluDark, 14);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, -h * 0.46, d * 0.30); g.add(wheel);
  }

  /* 机构箱（前部） */
  const mech = rbox(w * 0.92, h * 0.34, d * 0.30, 0.005, M.pcGray, 2);
  mech.position.set(0, -h * 0.16, d * 0.30); g.add(mech);
  const panel = plate(w * 0.86, h * 0.28, 0.004, M.pcDark, 0.003);
  panel.position.set(0, -h * 0.16, d * 0.45 + 0.002); g.add(panel);
  /* 分合闸按钮 + 状态指示窗 */
  for (const x of [-w * 0.24, w * 0.24]) {
    const b = cyl(0.014, 0.014, 0.010, M.pcBlack, 14);
    rot(b, Math.PI / 2, 0, 0); b.position.set(x, -h * 0.10, d * 0.45 + 0.008); g.add(b);
  }
  const win = plate(w * 0.30, h * 0.09, 0.003, M.pcBeige);
  win.position.set(0, -h * 0.22, d * 0.45 + 0.005); g.add(win);

  /* 三只立式灭弧室 */
  for (let i = 0; i < poles; i++) {
    const x = (i - (poles - 1) / 2) * (w * 0.30);
    const tank = cyl(w * 0.075, w * 0.075, h * 0.42, M.insul, 20);
    tank.position.set(x, h * 0.14, d * 0.02); g.add(tank);
    const cap = cyl(w * 0.085, w * 0.085, 0.016, M.aluDark, 20);
    cap.position.set(x, h * 0.36, d * 0.02); g.add(cap);
    /* 触臂（伸向后方的静触头） */
    const arm = cyl(w * 0.032, w * 0.032, d * 0.30, M.alu, 14);
    rot(arm, Math.PI / 2, 0, 0);
    arm.position.set(x, h * 0.30, -d * 0.24); g.add(arm);
    const tip = cyl(w * 0.045, w * 0.045, 0.030, M.copper, 16);
    rot(tip, Math.PI / 2, 0, 0);
    tip.position.set(x, h * 0.30, -d * 0.40); g.add(tip);
  }

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 三工位负荷开关（环网柜核心）
 * 外观要点：密封箱体 + 前方操作孔 + 位置指示窗 + 顶部/底部进出线。
 */
export function lbsUnit(o = {}) {
  const { w = 0.55, h = 0.62, d = 0.50 } = o;
  const g = new THREE.Group();

  const tank = rbox(w, h, d, 0.006, M.aluDark, 2); g.add(tank);
  const face = plate(w * 0.94, h * 0.94, 0.005, M.pcGray, 0.004);
  face.position.z = d / 2; g.add(face);

  /* 操作孔（手动操作手柄插入） */
  const hole = cyl(0.028, 0.028, 0.030, M.pcDark, 16);
  rot(hole, Math.PI / 2, 0, 0); hole.position.set(-w * 0.22, h * 0.10, d / 2 + 0.014); g.add(hole);

  /* 三工位位置指示窗 */
  const ind = plate(w * 0.36, h * 0.10, 0.003, M.pcBeige);
  ind.position.set(w * 0.14, h * 0.10, d / 2 + 0.004); g.add(ind);

  /* 顶 / 底进出线套管 */
  for (const sx of [-w * 0.28, w * 0.28]) {
    for (const sy of [1, -1]) {
      const b = cyl(0.032, 0.036, 0.075, M.insul, 16);
      b.position.set(sx, sy * (h / 2 + 0.030), 0); g.add(b);
    }
  }
  g.userData.size = [w, h, d];
  return g;
}

/**
 * 接地开关
 * 外观要点：转轴 + 三把接地刀 + 静触头座。
 */
export function esUnit(o = {}) {
  const { w = 0.34, h = 0.16, d = 0.20 } = o;
  const g = new THREE.Group();

  const shaft = cyl(0.012, 0.012, w, M.steelBrushed, 12);
  rot(shaft, 0, 0, Math.PI / 2); g.add(shaft);

  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * (w * 0.30);
    const blade = bar(w * 0.055, h * 0.82, 0.008, M.copper);
    blade.position.set(x, h * 0.10, d * 0.10); g.add(blade);
    const jaw = rbox(w * 0.075, h * 0.22, d * 0.30, 0.003, M.copper, 1);
    jaw.position.set(x, -h * 0.34, d * 0.16); g.add(jaw);
  }
  /* 操作轴引出端 */
  const stub = cyl(0.014, 0.014, 0.045, M.aluDark, 12);
  rot(stub, 0, 0, Math.PI / 2);
  stub.position.set(w / 2 + 0.022, 0, 0); g.add(stub);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 电流互感器（穿心式）
 * 外观要点：环氧浇注环体 + 中间穿心孔 + 二次接线端子。
 */
export function ctUnit(o = {}) {
  const { r = 0.075, t = 0.070, h = 0.16 } = o;
  const g = new THREE.Group();

  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t * 0.42, 10, 24), M.pcBeige);
  ring.castShadow = true; ring.receiveShadow = true; g.add(ring);

  /* 安装底座 */
  const base = rbox(r * 2.1, h * 0.16, t * 0.9, 0.004, M.aluDark, 1);
  base.position.y = -r - t * 0.32; g.add(base);

  /* 二次端子小盒 */
  const tb = rbox(t * 0.5, h * 0.22, t * 0.4, 0.003, M.pcBlack, 1);
  tb.position.set(0, r + t * 0.34, 0); g.add(tb);

  g.userData.size = [r * 2.1, r * 2 + t, t];
  return g;
}

/**
 * 电压互感器（浇注式）
 * 外观要点：方形浇注体 + 一次端子（顶部）+ 二次端子盒。
 */
export function ptUnit(o = {}) {
  const { w = 0.16, h = 0.26, d = 0.13 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h * 0.82, d, 0.006, M.pcBeige, 2);
  body.position.y = -h * 0.05; g.add(body);
  /* 一次绕组浇注柱 */
  const post = cyl(w * 0.24, w * 0.28, h * 0.22, M.pcBeige, 16);
  post.position.y = h * 0.40; g.add(post);
  /* 一次端子 */
  for (const x of [-w * 0.26, w * 0.26]) {
    const t = cyl(0.010, 0.010, 0.030, M.copper, 12);
    t.position.set(x, h * 0.30, 0); g.add(t);
  }
  /* 二次端子盒 */
  const tb = rbox(w * 0.5, h * 0.14, d * 0.30, 0.003, M.pcBlack, 1);
  tb.position.set(0, -h * 0.36, d * 0.42); g.add(tb);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 避雷器（氧化锌）
 * 外观要点：细长圆柱阀片柱 + 上下法兰 + 伞裙。
 */
export function spdUnit(o = {}) {
  const { r = 0.032, h = 0.30, skirts = 4 } = o;
  const g = new THREE.Group();

  const body = cyl(r, r, h, M.insul, 18); g.add(body);
  /* 伞裙 */
  for (let i = 0; i < skirts; i++) {
    const y = -h / 2 + h * (i + 1) / (skirts + 1);
    const s = cyl(r * 1.55, r * 1.35, 0.014, M.insul, 18);
    s.position.y = y; g.add(s);
  }
  /* 上下法兰 */
  for (const sy of [1, -1]) {
    const f = cyl(r * 1.25, r * 1.25, 0.018, M.aluDark, 16);
    f.position.y = sy * (h / 2 - 0.009); g.add(f);
  }
  g.userData.size = [r * 3.1, h, r * 3.1];
  return g;
}

/**
 * 熔断器（熔断器座 / 刀熔开关）
 * 外观要点：底座 + 圆柱熔断体 + 上下触头。
 */
export function fuseUnit(o = {}) {
  const { w = 0.045, h = 0.115, d = 0.055, poles = 1 } = o;
  const g = new THREE.Group();

  const base = rbox(w, h, d * 0.42, 0.003, M.pcBeige, 1);
  base.position.z = -d * 0.20; g.add(base);

  for (let i = 0; i < poles; i++) {
    const x = (i - (poles - 1) / 2) * (w / poles) * 0.9;
    const tube = cyl(w * 0.16, w * 0.16, h * 0.62, M.pcBeige, 14);
    tube.position.set(x, 0, d * 0.06); g.add(tube);
    for (const sy of [1, -1]) {
      const cap = cyl(w * 0.19, w * 0.19, 0.014, M.copper, 14);
      cap.position.set(x, sy * h * 0.32, d * 0.06); g.add(cap);
    }
  }
  g.userData.size = [w, h, d];
  return g;
}

/**
 * 触头盒 / 静触头（手车插入点）
 * 外观要点：绝缘盒 + 内部静触头（只露插口）。
 */
export function contactBox(o = {}) {
  const { r = 0.070, d = 0.12 } = o;
  const g = new THREE.Group();

  const box = cyl(r, r * 0.94, d, M.insul, 20);
  rot(box, Math.PI / 2, 0, 0); g.add(box);
  const mouth = cyl(r * 0.52, r * 0.52, 0.022, M.copper, 18);
  rot(mouth, Math.PI / 2, 0, 0);
  mouth.position.z = d / 2 + 0.006; g.add(mouth);
  const flange = cyl(r * 1.14, r * 1.14, 0.016, M.aluDark, 20);
  rot(flange, Math.PI / 2, 0, 0);
  flange.position.z = -d / 2 + 0.008; g.add(flange);

  g.userData.size = [r * 2.28, r * 2.28, d];
  return g;
}

/**
 * 穿墙套管
 * 外观要点：带伞裙的圆柱，穿过金属隔板。
 */
export function wallBushing(o = {}) {
  const { r = 0.055, len = 0.20 } = o;
  const g = new THREE.Group();
  const body = cyl(r * 0.72, r * 0.72, len, M.insul, 18);
  rot(body, Math.PI / 2, 0, 0); g.add(body);
  for (let i = 0; i < 3; i++) {
    const s = cyl(r, r * 0.86, 0.016, M.insul, 18);
    rot(s, Math.PI / 2, 0, 0);
    s.position.z = -len * 0.30 + i * len * 0.22; g.add(s);
  }
  /* 两端法兰 */
  for (const sz of [1, -1]) {
    const f = cyl(r * 0.95, r * 0.95, 0.014, M.aluDark, 16);
    rot(f, Math.PI / 2, 0, 0);
    f.position.z = sz * (len / 2 - 0.007); g.add(f);
  }
  g.userData.size = [r * 2, r * 2, len];
  return g;
}

/**
 * 接地排（含支柱绝缘子）
 */
export function groundBarUnit(o = {}) {
  const { len = 0.60, w = 0.040, t = 0.006, posts = 2 } = o;
  const g = new THREE.Group();
  const b = bar(len, w, t, M.copper);
  b.position.y = 0.10; g.add(b);
  for (let i = 0; i < posts; i++) {
    const x = posts > 1 ? (i / (posts - 1) - 0.5) * len * 0.72 : 0;
    const ins = insulator(0.10, M.pcBeige);
    ins.position.set(x, 0.045, 0); g.add(ins);
  }
  g.userData.size = [len, 0.22, w];
  return g;
}

/**
 * 电缆终端（含电缆段）
 * 外观要点：下垂电缆 + 终端头 + 电缆夹。
 */
export function cableTermUnit(o = {}) {
  const { len = 0.55, r = 0.030, count = 3 } = o;
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * r * 3.2;
    const c = cyl(r, r, len, M.cable, 12);
    c.position.set(x, -len / 2, 0); g.add(c);
    const term = cyl(r * 1.7, r * 1.35, 0.13, M.pcBeige, 16);
    term.position.set(x, 0.045, 0); g.add(term);
    const lug = rbox(r * 2.6, 0.020, r * 1.2, 0.002, M.copper, 1);
    lug.position.set(x, 0.115, 0); g.add(lug);
  }
  /* 电缆夹 */
  const clamp = bar(r * 3.2 * count, 0.014, r * 2.4, M.aluDark);
  clamp.position.y = -len * 0.62; g.add(clamp);
  g.userData.size = [r * 3.2 * count, len + 0.16, r * 3];
  return g;
}

/* ============================================================
 * 低压与二次回路元件
 * ========================================================== */

/**
 * 塑壳断路器（MCCB）
 * 外观要点：塑料外壳 + 前方拨杆 + 上下各相接线端子。
 */
export function mccbUnit(o = {}) {
  const { w = 0.090, h = 0.150, d = 0.075, poles = 3 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.004, M.pcGray, 2); g.add(body);
  const face = plate(w * 0.90, h * 0.90, 0.004, M.pcDark, 0.004);
  face.position.z = d / 2; g.add(face);

  /* 拨杆（带手柄座） */
  const seat = rbox(w * 0.34, h * 0.20, 0.010, 0.003, M.pcBlack, 1);
  seat.position.set(0, h * 0.06, d / 2 + 0.006); g.add(seat);
  const lever = rbox(w * 0.18, h * 0.13, 0.014, 0.003, M.pcRed, 1);
  lever.position.set(0, h * 0.10, d / 2 + 0.016); g.add(lever);

  /* 上下接线端子（按极数分格） */
  for (let i = 0; i < poles; i++) {
    const x = (i - (poles - 1) / 2) * (w / poles) * 0.88;
    for (const sy of [1, -1]) {
      const t = rbox(w / poles * 0.60, 0.016, d * 0.46, 0.002, M.aluDark, 1);
      t.position.set(x, sy * h * 0.40, -d * 0.16); g.add(t);
    }
  }

  /* 铭牌 */
  const np = nameplate(w * 0.62, w * 0.62 * 0.25, 'MCCB');
  np.position.set(0, -h * 0.16, d / 2 + 0.004); g.add(np);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 微型断路器（MCB，导轨安装）
 * 外观要点：窄条外壳 + 前方小拨杆 + 上下端子。
 */
export function mcbUnit(o = {}) {
  const { w = 0.018, h = 0.080, d = 0.070 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.002, M.pcBeige, 1); g.add(body);
  const face = plate(w * 0.86, h * 0.92, 0.003, M.pcGray, 0.002);
  face.position.z = d / 2; g.add(face);

  const seat = rbox(w * 0.52, h * 0.22, 0.008, 0.002, M.pcBlack, 1);
  seat.position.set(0, h * 0.06, d / 2 + 0.004); g.add(seat);
  const lever = rbox(w * 0.34, h * 0.14, 0.010, 0.002, M.pcRed, 1);
  lever.position.set(0, h * 0.09, d / 2 + 0.012); g.add(lever);

  for (const sy of [1, -1]) {
    const t = rbox(w * 0.70, 0.012, d * 0.40, 0.002, M.aluDark, 1);
    t.position.set(0, sy * h * 0.42, -d * 0.18); g.add(t);
  }
  g.userData.size = [w, h, d];
  return g;
}

/**
 * 交流接触器
 * 外观要点：方形本体 + 前部衔铁/线圈盖 + 上部主触头端子 + 侧面辅助触点块。
 */
export function contactorUnit(o = {}) {
  const { w = 0.045, h = 0.078, d = 0.082 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d * 0.72, 0.004, M.pcBlack, 2);
  body.position.z = -d * 0.10; g.add(body);

  /* 前部线圈盖（略突出，颜色浅一点，行业里一眼就认） */
  const cover = rbox(w * 0.92, h * 0.62, d * 0.28, 0.003, M.pcGray, 1);
  cover.position.set(0, -h * 0.10, d * 0.30); g.add(cover);
  /* 辅助触点块（侧面） */
  const aux = rbox(w * 0.36, h * 0.30, d * 0.24, 0.002, M.pcBeige, 1);
  aux.position.set(0, h * 0.22, d * 0.24); g.add(aux);

  /* 主触头接线端子 */
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * (w * 0.30);
    for (const sy of [1, -1]) {
      const t = rbox(w * 0.22, 0.014, d * 0.30, 0.002, M.aluDark, 1);
      t.position.set(x, sy * h * 0.44, -d * 0.16); g.add(t);
    }
  }
  g.userData.size = [w, h, d];
  return g;
}

/**
 * 轴流风扇（柜顶 / 柜侧通风）
 * 外观要点：方形框架 + 圆形风口 + 扇叶 + 防护网。
 */
export function fanUnit(o = {}) {
  const { s = 0.12, d = 0.055, blades = 5 } = o;
  const g = new THREE.Group();

  /* 外框（方形，四角倒角用两块叠加近似） */
  const frame = rbox(s, s, d * 0.42, 0.006, M.pcDark, 2); g.add(frame);
  const hole = cyl(s * 0.40, s * 0.40, d * 0.50, M.pcBlack, 22);
  rot(hole, Math.PI / 2, 0, 0); g.add(hole);

  /* 扇叶 */
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    const b = plate(s * 0.34, s * 0.11, 0.002, M.pcGray, 0.002);
    b.position.set(Math.cos(a) * s * 0.20, Math.sin(a) * s * 0.20, d * 0.06);
    b.rotation.z = a;
    b.rotation.x = -0.42;
    g.add(b);
  }
  const hub = cyl(s * 0.11, s * 0.11, d * 0.16, M.pcBlack, 14);
  rot(hub, Math.PI / 2, 0, 0); hub.position.z = d * 0.06; g.add(hub);

  /* 防护网（细环） */
  const grille = new THREE.Mesh(new THREE.TorusGeometry(s * 0.36, 0.0035, 6, 20), M.steelBrushed);
  grille.position.z = d * 0.20; g.add(grille);

  g.userData.size = [s, s, d * 0.5];
  return g;
}

/**
 * 柜内加热器（铝合金梳状）
 * 外观要点：长条底座 + 密排梳齿散热片 + 接线端。
 */
export function heaterUnit(o = {}) {
  const { len = 0.16, h = 0.055, d = 0.045 } = o;
  const g = new THREE.Group();

  const base = bar(len, h * 0.30, d, M.alu);
  base.position.y = -h * 0.30; g.add(base);

  /* 梳齿 */
  const teeth = 9;
  for (let i = 0; i < teeth; i++) {
    const x = (i / (teeth - 1) - 0.5) * len * 0.88;
    const t = bar(len / teeth * 0.52, h * 0.62, d * 0.78, M.aluDark);
    t.position.set(x, h * 0.10, 0); g.add(t);
  }
  /* 接线端 */
  for (const sx of [-1, 1]) {
    const t = cyl(0.006, 0.006, 0.020, M.copper, 10);
    t.position.set(sx * len * 0.46, h * 0.22, 0); g.add(t);
  }
  g.userData.size = [len, h, d];
  return g;
}

/**
 * 数显仪表（面板嵌入式）
 * 外观要点：方形表头 + 深色显示窗 + 两侧安装卡扣。
 */
export function meterUnit(o = {}) {
  const { w = 0.096, h = 0.048, d = 0.075, unit = 'V' } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.003, M.pcBlack, 2);
  body.position.z = -d / 2 + 0.004; g.add(body);
  const face = plate(w, h, 0.005, M.pcDark, 0.003);
  face.position.z = 0.003; g.add(face);

  /* 显示窗：真段码，跟产品模型同一套口径（通用图形，非实测值） */
  const t = screenTex('', { color: '#ff6a3d', w: 256, h: 80, rows: ['8888'] });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.62, h * 0.42),
    new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.85, roughness: 0.3 }));
  win.position.set(-w * 0.10, 0, 0.0070); g.add(win);

  const u = nameplate(w * 0.14, w * 0.14 * 0.5, unit);
  u.position.set(w * 0.34, 0, 0.0070); g.add(u);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 微机综合保护装置（外购主设备）
 * 外观要点：机箱 + 前面板大显示窗 + 按键区 + 指示灯列。
 */
export function protUnit(o = {}) {
  const { w = 0.44, h = 0.18, d = 0.24 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.004, M.pcDark, 2);
  body.position.z = -d / 2 + 0.005; g.add(body);
  const face = plate(w, h, 0.006, M.pcBlack, 0.003);
  face.position.z = 0.004; g.add(face);

  /* 显示窗（大屏，示意为段码块） */
  const t = screenTex('', { color: '#57d7ff', w: 256, h: 96, rows: ['8888', '8888'] });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.40, h * 0.52),
    new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.7, roughness: 0.32 }));
  win.position.set(-w * 0.20, 0, 0.0075); g.add(win);

  /* 指示灯列 */
  const ledMats = [M.ledGreen, M.ledRed, M.ledAmber, M.ledGreen, M.ledRed];
  ledMats.forEach((m, i) => {
    const d2 = cyl(0.005, 0.005, 0.004, m, 10);
    rot(d2, Math.PI / 2, 0, 0);
    d2.position.set(-w * 0.02, h * 0.24 - i * h * 0.12, 0.0075); g.add(d2);
  });

  /* 按键区 */
  for (let i = 0; i < 4; i++) {
    const k = rbox(w * 0.07, h * 0.13, 0.005, 0.002, M.btnGray, 1);
    k.position.set(w * 0.12 + (i % 2) * w * 0.11, h * 0.06 - Math.floor(i / 2) * h * 0.24, 0.0075);
    g.add(k);
  }

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 通用开关电源（导轨式）
 * 外观要点：金属网孔外壳 + 前脸端子 + 电源指示。
 */
export function psuUnit(o = {}) {
  const { w = 0.055, h = 0.090, d = 0.110 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d * 0.72, 0.003, M.steelBrushed, 2);
  body.position.z = -d * 0.10; g.add(body);
  /* 网孔前面板 */
  const face = plate(w * 0.94, h * 0.86, 0.004, M.perf, 0.003);
  face.position.z = d * 0.28; g.add(face);

  /* 上下端子排 */
  for (const sy of [1, -1]) {
    const tb = rbox(w * 0.86, h * 0.10, d * 0.22, 0.002, M.pcGreen, 1);
    tb.position.set(0, sy * h * 0.42, d * 0.16); g.add(tb);
  }
  /* 电源指示 */
  const led = cyl(0.005, 0.005, 0.004, M.ledGreen, 10);
  rot(led, Math.PI / 2, 0, 0); led.position.set(w * 0.26, h * 0.30, d * 0.32); g.add(led);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 蓄电池组（阀控式密封铅酸）
 * 外观要点：成排电池单体 + 连接条 + 电池架。
 */
export function batteryBank(o = {}) {
  const { count = 4, cw = 0.17, ch = 0.24, cd = 0.17, rows = 1 } = o;
  const g = new THREE.Group();
  const per = Math.ceil(count / rows);

  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / per), c = i % per;
    const x = (c - (per - 1) / 2) * cw * 1.06;
    const z = (r - (rows - 1) / 2) * cd * 1.10;
    const cell = rbox(cw, ch, cd, 0.004, M.pcDark, 2);
    cell.position.set(x, 0, z); g.add(cell);
    /* 顶盖 + 极柱 */
    const lid = rbox(cw * 0.94, ch * 0.10, cd * 0.94, 0.003, M.pcGray, 1);
    lid.position.set(x, ch * 0.52, z); g.add(lid);
    for (const sx of [-1, 1]) {
      const p = cyl(0.012, 0.012, 0.022, M.copper, 12);
      p.position.set(x + sx * cw * 0.28, ch * 0.60, z); g.add(p);
    }
  }
  /* 电池架 */
  const shelf = rbox(per * cw * 1.06 + 0.04, 0.03, rows * cd * 1.10 + 0.04, 0.004, M.aluDark, 1);
  shelf.position.y = -ch * 0.54; g.add(shelf);

  g.userData.size = [per * cw * 1.06, ch * 1.15, rows * cd * 1.10];
  return g;
}

/**
 * 高频开关充电模块（机架式）
 * 外观要点：模块化机箱 + 前面板 + 散热风道 + 指示。
 */
export function chargerUnit(o = {}) {
  const { w = 0.44, h = 0.13, d = 0.30 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.004, M.aluDark, 2);
  body.position.z = -d / 2 + 0.005; g.add(body);
  const face = plate(w * 0.96, h * 0.88, 0.004, M.pcGray, 0.003);
  face.position.z = 0.004; g.add(face);

  /* 指示与把手 */
  for (let i = 0; i < 3; i++) {
    const led = cyl(0.005, 0.005, 0.004, [M.ledGreen, M.ledAmber, M.ledRed][i], 10);
    rot(led, Math.PI / 2, 0, 0);
    led.position.set(-w * 0.34, h * 0.22 - i * h * 0.22, 0.0075); g.add(led);
  }
  const hd = bar(w * 0.16, h * 0.06, 0.012, M.pcBlack);
  hd.position.set(w * 0.34, 0, 0.012); g.add(hd);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 温湿度控制器（通用型，与本公司 THC 同类）
 * 外观要点：小方盒 + 旋钮 + 两个指示灯 + 下端子。
 */
export function tempctrlUnit(o = {}) {
  const { w = 0.075, h = 0.090, d = 0.070 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.003, M.pcGray, 2); g.add(body);
  const face = plate(w * 0.92, h * 0.92, 0.004, M.pcBeige, 0.003);
  face.position.z = d / 2; g.add(face);

  /* 两个旋钮（温度 / 湿度整定） */
  for (const sx of [-1, 1]) {
    const k = cyl(w * 0.13, w * 0.15, 0.012, M.pcBlack, 16);
    rot(k, Math.PI / 2, 0, 0);
    k.position.set(sx * w * 0.20, h * 0.14, d / 2 + 0.006); g.add(k);
  }
  /* 指示灯 */
  for (const [sx, m] of [[-1, M.ledGreen], [1, M.ledRed]]) {
    const l = cyl(0.005, 0.005, 0.004, m, 10);
    rot(l, Math.PI / 2, 0, 0);
    l.position.set(sx * w * 0.20, -h * 0.06, d / 2 + 0.006); g.add(l);
  }
  /* 下端子 */
  const tb = rbox(w * 0.86, h * 0.12, d * 0.24, 0.002, M.pcGreen, 1);
  tb.position.set(0, -h * 0.40, d * 0.34); g.add(tb);

  g.userData.size = [w, h, d];
  return g;
}

/* ============================================================
 * 高压组合电器 / 新能源场站（GIS · 储能预制舱 · 光伏升压站）
 *
 * 这三类设备与户内开关柜的差别在于：它们**没有「柜」这个外壳**，
 * 主设备是暴露的（GIS 是金属封闭气室、储能是舱内机架、光伏是户外支架），
 * 所以外形要更「工程化」——底座钢架、气室圆筒、散热风道、舱门与爬梯。
 * ========================================================== */

/**
 * GIS 间隔（气体绝缘金属封闭开关设备的一个间隔单元）
 *
 * 真实 110kV 间隔的量级：中心距 1.2~1.8m、纵深 3.5~5.5m、本体高 2.2~3.0m
 * （不含向上引出的出线套管）。这里取 1.30 × 2.30 × 3.60 m。
 *
 * 外观要点（行业典型）：卧式断路器气室（大圆筒）+ 两侧隔离/接地开关气室
 * + 后上方贯通母线筒 + 向上引出的出线套管 + 前部操动机构箱 + 支撑钢架。
 * ⚠️ 内部触头、绝缘气体与二次回路一概不表达。
 */
export function gisBay(o = {}) {
  const { w = 1.30, h = 2.30, d = 3.60 } = o;
  const g = new THREE.Group();

  /* 支撑钢架 */
  for (const sz of [-1, 1]) {
    const leg = rbox(w * 0.94, 0.10, 0.10, 0.006, M.steelBrushed, 1);
    leg.position.set(0, -h / 2 + 0.05, sz * d * 0.38); g.add(leg);
  }
  for (const sx of [-1, 1]) {
    const rail = bar(0.09, 0.09, d * 0.82, M.steelBrushed);
    rail.position.set(sx * w * 0.44, -h / 2 + 0.05, 0); g.add(rail);
  }

  /* 卧式断路器气室（沿 z 的大圆筒） */
  const brk = cyl(0.31, 0.31, d * 0.44, M.alu, 24);
  rot(brk, Math.PI / 2, 0, 0);
  brk.position.set(0, -h * 0.06, -d * 0.02); g.add(brk);
  for (const sz of [-1, 1]) {
    const flange = cyl(0.34, 0.34, 0.03, M.aluDark, 24);
    rot(flange, Math.PI / 2, 0, 0);
    flange.position.set(0, -h * 0.06, sz * d * 0.22); g.add(flange);
  }

  /* 两侧隔离 / 接地开关气室 */
  for (const sz of [-1, 1]) {
    const tank = cyl(0.22, 0.22, d * 0.20, M.alu, 20);
    rot(tank, Math.PI / 2, 0, 0);
    tank.position.set(0, -h * 0.06, sz * d * 0.34); g.add(tank);
    const cap = cyl(0.24, 0.24, 0.025, M.aluDark, 20);
    rot(cap, Math.PI / 2, 0, 0);
    cap.position.set(0, -h * 0.06, sz * d * 0.44); g.add(cap);
  }

  /* 后上方贯通母线筒（三相）
     只做**短接头**：间隔之间的贯通母线由场景单独摆一段，登记成 BUS 热点。
     这样「间隔本体」和「母线」是两个可分别点选的元件，而不是糊成一件。 */
  for (let i = -1; i <= 1; i++) {
    const tube = cyl(0.17, 0.17, d * 0.34, M.alu, 18);
    rot(tube, Math.PI / 2, 0, 0);
    tube.position.set(i * 0.36, h * 0.30, 0); g.add(tube);
    const ring = cyl(0.19, 0.19, 0.025, M.aluDark, 18);
    rot(ring, Math.PI / 2, 0, 0);
    ring.position.set(i * 0.36, h * 0.30, d * 0.17); g.add(ring);
  }

  /* 出线套管（向上引出，穿出 GIS 室顶） */
  for (let i = -1; i <= 1; i++) {
    const bush = cyl(0.10, 0.14, h * 0.52, M.insul, 18);
    bush.position.set(i * 0.36, h * 0.30 + h * 0.26 + 0.06, d * 0.30); g.add(bush);
    const top = cyl(0.075, 0.075, 0.05, M.aluDark, 16);
    top.position.set(i * 0.36, h * 0.30 + h * 0.52 + 0.08, d * 0.30); g.add(top);
  }

  /* 前部操动机构箱 + 就地操作面板 */
  const mech = rbox(w * 0.78, h * 0.30, d * 0.12, 0.005, M.pcGray, 2);
  mech.position.set(0, -h * 0.22, -d * 0.46); g.add(mech);
  const face = plate(w * 0.70, h * 0.24, 0.004, M.pcDark, 0.003);
  face.position.set(0, -h * 0.22, -d * 0.46 - d * 0.06 - 0.002); g.add(face);
  for (const [i, m] of [[-1, M.ledGreen], [0, M.ledRed], [1, M.ledAmber]]) {
    const led = cyl(0.008, 0.008, 0.005, m, 10);
    rot(led, Math.PI / 2, 0, 0);
    led.position.set((i - 1) * 0.06, -h * 0.16, -d * 0.52 - 0.006); g.add(led);
  }
  /* 就地操作孔（手动储能/分合） */
  for (const sx of [-1, 1]) {
    const hole = cyl(0.026, 0.026, 0.03, M.pcBlack, 14);
    rot(hole, Math.PI / 2, 0, 0);
    hole.position.set(sx * w * 0.28, -h * 0.28, -d * 0.52 - 0.010); g.add(hole);
  }

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 储能变流器（PCS）
 * 真实量级：单台 0.8~1.7m 宽、2.0~2.2m 高、0.8~1.0m 深，机柜式，前后开门。
 */
export function pcsUnit(o = {}) {
  const { w = 1.20, h = 2.10, d = 0.85 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.006, M.powderLight, 2); g.add(body);
  /* 前门（对开两扇）+ 门缝 */
  for (const sx of [-1, 1]) {
    const dr = plate(w * 0.47, h * 0.90, 0.010, M.powderWhite, 0.004);
    dr.position.set(sx * w * 0.24, 0, d / 2 + 0.004); g.add(dr);
    const hd = handle(0.12);
    hd.position.set(sx * w * 0.05, 0, d / 2 + 0.022); g.add(hd);
  }
  /* 上部控制面板：显示屏 + 按键 + 指示灯 */
  const panel = plate(w * 0.60, h * 0.16, 0.004, M.pcDark, 0.003);
  panel.position.set(0, h * 0.34, d / 2 + 0.010); g.add(panel);
  const scr = plate(w * 0.24, h * 0.10, 0.003, M.displayOn);
  scr.position.set(-w * 0.12, h * 0.34, d / 2 + 0.013); g.add(scr);
  for (let i = 0; i < 4; i++) {
    const k = cyl(0.008, 0.008, 0.006, M.btnGray, 12);
    rot(k, Math.PI / 2, 0, 0);
    k.position.set(w * 0.06 + i * 0.035, h * 0.34, d / 2 + 0.013); g.add(k);
  }
  for (const [i, m] of [[0, M.ledGreen], [1, M.ledAmber], [2, M.ledRed]]) {
    const led = cyl(0.006, 0.006, 0.005, m, 10);
    rot(led, Math.PI / 2, 0, 0);
    led.position.set(-w * 0.40, h * 0.20 - i * 0.030, d / 2 + 0.013); g.add(led);
  }
  /* 顶部出风 / 下部进风（PCS 风冷特征） */
  const out = louverPanel(w * 0.80, 0.16, { cols: 10, rows: 2 });
  out.position.set(0, h * 0.46, d / 2 + 0.004); g.add(out);
  const inlet = louverPanel(w * 0.80, 0.22, { cols: 10, rows: 3 });
  inlet.position.set(0, -h * 0.40, d / 2 + 0.004); g.add(inlet);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 储能电池簇（机架式）
 * 真实量级：单簇约 1.0m 宽 × 2.2m 高 × 0.8m 深，内部 6~10 层电池模块。
 * ⚠️ 只画机架与模块外形，不表达电芯、BMS 与接线。
 */
export function essRack(o = {}) {
  const { w = 1.00, h = 2.20, d = 0.80, layers = 8 } = o;
  const g = new THREE.Group();

  /* 机架：立柱 + 层板 */
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const col = bar(0.05, h, 0.05, M.aluDark);
      col.position.set(sx * (w / 2 - 0.025), 0, sz * (d / 2 - 0.025)); g.add(col);
    }
  }
  const top = plate(w, d, 0.02, M.aluDark);
  rot(top, Math.PI / 2, 0, 0); top.position.y = h / 2 - 0.01; g.add(top);
  const bottom = plate(w, d, 0.02, M.aluDark);
  rot(bottom, Math.PI / 2, 0, 0); bottom.position.y = -h / 2 + 0.01; g.add(bottom);

  /* 每层一个电池模块（前面板 + 拉手 + 状态灯） */
  const gap = (h - 0.06) / layers;
  for (let i = 0; i < layers; i++) {
    const y = -h / 2 + 0.05 + gap * (i + 0.5);
    const mod = rbox(w - 0.10, gap * 0.80, d - 0.10, 0.004, M.pcGray, 1);
    mod.position.set(0, y, 0.01); g.add(mod);
    const face = plate(w - 0.14, gap * 0.62, 0.004, M.pcDark, 0.003);
    face.position.set(0, y, d / 2 - 0.045); g.add(face);
    const hd = bar(0.10, 0.014, 0.012, M.pcBlack);
    hd.position.set(0, y, d / 2 - 0.036); g.add(hd);
    const led = cyl(0.005, 0.005, 0.004, i % 3 === 0 ? M.ledGreen : M.ledAmber, 10);
    rot(led, Math.PI / 2, 0, 0);
    led.position.set(w * 0.34, y, d / 2 - 0.036); g.add(led);
  }
  /* 顶部汇流排（簇内直流汇流） */
  for (const sx of [-1, 1]) {
    const bus = bar(w * 0.86, 0.02, 0.03, M.copper);
    bus.position.set(0, h / 2 - 0.05, sx * d * 0.26); g.add(bus);
  }

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 工业空调（预制舱 / 集装箱用）
 * 真实量级：0.8~1.0m 宽 × 1.2~1.6m 高 × 0.4~0.5m 厚，挂舱壁或落地。
 */
export function hvacUnit(o = {}) {
  const { w = 0.90, h = 1.40, d = 0.45 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.006, M.powderWhite, 2); g.add(body);
  /* 上部出风格栅 */
  const out = louverPanel(w * 0.80, h * 0.22, { cols: 9, rows: 3 });
  out.position.set(0, h * 0.30, d / 2 + 0.004); g.add(out);
  /* 下部进风格栅 */
  const inlet = louverPanel(w * 0.80, h * 0.26, { cols: 9, rows: 4 });
  inlet.position.set(0, -h * 0.26, d / 2 + 0.004); g.add(inlet);
  /* 控制器面板 */
  const ctrl = plate(w * 0.34, h * 0.10, 0.004, M.pcDark, 0.003);
  ctrl.position.set(0, h * 0.06, d / 2 + 0.006); g.add(ctrl);
  const scr = plate(w * 0.16, h * 0.06, 0.003, M.displayOn);
  scr.position.set(0, h * 0.06, d / 2 + 0.009); g.add(scr);
  /* 侧面冷凝水管 */
  const pipe = cyl(0.012, 0.012, 0.30, M.pcGray, 10);
  pipe.position.set(-w * 0.42, -h * 0.42, 0); g.add(pipe);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 气体灭火柜 / 消防控制柜（储能舱必备）
 * 真实量级：0.6m 宽 × 1.6~1.8m 高 × 0.5m 深。
 */
export function fireUnit(o = {}) {
  const { w = 0.60, h = 1.70, d = 0.50 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.005, M.pcRed, 2); g.add(body);
  const dr = plate(w * 0.86, h * 0.88, 0.010, M.pcRed, 0.004);
  dr.position.set(0, 0, d / 2 + 0.004); g.add(dr);
  const hd = handle(0.12);
  hd.position.set(w * 0.30, 0, d / 2 + 0.022); g.add(hd);
  /* 面板：显示屏 + 指示灯 + 声光报警器 */
  const scr = plate(w * 0.34, h * 0.08, 0.003, M.displayOn);
  scr.position.set(0, h * 0.30, d / 2 + 0.010); g.add(scr);
  for (const [i, m] of [[0, M.ledGreen], [1, M.ledAmber], [2, M.ledRed]]) {
    const led = cyl(0.006, 0.006, 0.005, m, 10);
    rot(led, Math.PI / 2, 0, 0);
    led.position.set(-w * 0.22 + i * 0.030, h * 0.18, d / 2 + 0.010); g.add(led);
  }
  /* 顶部声光报警（红闪灯罩） */
  const lamp = cyl(0.045, 0.055, 0.07, M.ledRed, 16);
  lamp.position.set(0, h / 2 + 0.045, 0); g.add(lamp);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 光伏逆变器（组串式 / 集中式机柜）
 * 真实量级：组串式 0.6~0.8m 宽 × 2.0m 高 × 0.8m 深，IP65 户外机柜。
 */
export function inverterUnit(o = {}) {
  const { w = 0.80, h = 2.05, d = 0.80 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.006, M.powderWhite, 2); g.add(body);
  /* 前门（单开）+ 门缝 */
  const dr = plate(w * 0.88, h * 0.88, 0.010, M.powderLight, 0.004);
  dr.position.set(0, 0, d / 2 + 0.004); g.add(dr);
  const hd = handle(0.14);
  hd.position.set(-w * 0.32, 0, d / 2 + 0.022); g.add(hd);
  /* 控制面板 */
  const panel = plate(w * 0.52, h * 0.14, 0.004, M.pcDark, 0.003);
  panel.position.set(0, h * 0.32, d / 2 + 0.010); g.add(panel);
  const scr = plate(w * 0.20, h * 0.08, 0.003, M.displayOn);
  scr.position.set(-w * 0.10, h * 0.32, d / 2 + 0.013); g.add(scr);
  for (let i = 0; i < 3; i++) {
    const k = cyl(0.007, 0.007, 0.006, M.btnGray, 12);
    rot(k, Math.PI / 2, 0, 0);
    k.position.set(w * 0.06 + i * 0.030, h * 0.32, d / 2 + 0.013); g.add(k);
  }
  for (const [i, m] of [[0, M.ledGreen], [1, M.ledAmber], [2, M.ledRed]]) {
    const led = cyl(0.006, 0.006, 0.005, m, 10);
    rot(led, Math.PI / 2, 0, 0);
    led.position.set(-w * 0.38, h * 0.18 - i * 0.030, d / 2 + 0.013); g.add(led);
  }
  /* 两侧散热风道（逆变器特征） */
  for (const sx of [-1, 1]) {
    const lv = louverPanel(d * 0.70, h * 0.30, { cols: 6, rows: 6 });
    lv.rotation.y = sx * Math.PI / 2;
    lv.position.set(sx * (w / 2 + 0.003), h * 0.02, 0); g.add(lv);
  }
  /* 底部进出线孔 */
  for (const sx of [-1, 1]) {
    const gl = gland(M.brass, 0.016);
    gl.position.set(sx * w * 0.26, -h / 2 - 0.004, 0); g.add(gl);
  }

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 光伏支架 + 组件（一组，含前后两排）
 * 真实量级：单块组件 2.278 × 1.134 m，倾角 25°~33°，
 * 前后排间距按不遮挡原则取 4~5 m（这里示意取 4.2 m）。
 * ⚠️ 只表达支架与组件板的排列关系，不表达桩基形式与配重。
 */
export function pvTable(o = {}) {
  const { rows = 2, cols = 4, tilt = 30, gap = 4.2 } = o;
  const g = new THREE.Group();
  const MW = 2.278, MH = 1.134;              // 单块组件尺寸
  const a = tilt * Math.PI / 180;
  const tableW = cols * MW + (cols - 1) * 0.02;
  const cosT = Math.cos(a), sinT = Math.sin(a);
  const panelH = MH * cosT, panelD = MH * sinT;
  const legH = 0.45;                          // 前立柱高

  for (let r = 0; r < rows; r++) {
    const z = (r - (rows - 1) / 2) * gap;
    /* 斜梁 + 前/后立柱 */
    for (const sx of [-1, 1]) {
      const x = sx * tableW * 0.34;
      const front = bar(0.07, legH, 0.07, M.aluDark);
      front.position.set(x, legH / 2, z + panelD / 2); g.add(front);
      const rear = bar(0.07, legH + panelD, 0.07, M.aluDark);
      rear.position.set(x, (legH + panelD) / 2, z - panelD / 2); g.add(rear);
    }
    /* 斜梁（沿 x） */
    for (const sz of [-1, 1]) {
      const beam = bar(tableW, 0.05, 0.05, M.aluDark);
      rot(beam, 0, 0, 0);
      beam.position.set(0, legH + panelD * (sz > 0 ? 0.12 : 0.88), z - sz * panelD * 0.38);
      g.add(beam);
    }
    /* 组件板（倾斜，法线朝上前方）
       ⚠️ 原来用 `M.pcDark`（纯深色塑料）—— 默认机位下组件约占画面 1/5 宽，
          一整块纯色读起来就是「黑板」。改用 `pvCellMat(cols)`：按列数铺电池片贴图。
          ⚠️ 不要为了这一处去改 `M.pcDark` —— 它被全库 20+ 处共用
          （面板、盖板、外壳、熔断器座…），加栅格会到处冒出一层假网纹。 */
    const panel = plate(tableW, MH, 0.035, pvCellMat(cols), 0.002);
    panel.rotation.x = -a;
    panel.position.set(0, legH + panelH * 0.5, z);
    g.add(panel);
    /* 组件边框（浅色铝框，光伏板的识别特征） */
    const frame = plate(tableW + 0.04, MH + 0.04, 0.010, M.alu, 0.002);
    frame.rotation.x = -a;
    frame.position.set(0, legH + panelH * 0.5 - 0.018, z + 0.012);
    g.add(frame);
  }
  g.userData.size = [tableW, legH + panelH + 0.2, rows * gap];
  return g;
}

/**
 * 直流汇流箱（光伏组串汇流）
 * 真实量级：0.6m 宽 × 0.8m 高 × 0.3m 深，挂支架或立柱。
 */
export function combinerBox(o = {}) {
  const { w = 0.60, h = 0.80, d = 0.30 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.004, M.pcGray, 2); g.add(body);
  const dr = plate(w * 0.86, h * 0.80, 0.008, M.pcGray, 0.003);
  dr.position.set(0, 0, d / 2 + 0.003); g.add(dr);
  const hd = bar(0.10, 0.014, 0.012, M.pcBlack);
  hd.position.set(w * 0.30, 0, d / 2 + 0.016); g.add(hd);
  const scr = plate(w * 0.22, h * 0.10, 0.003, M.displayOn);
  scr.position.set(-w * 0.16, h * 0.28, d / 2 + 0.008); g.add(scr);
  for (const [i, m] of [[0, M.ledGreen], [1, M.ledRed]]) {
    const led = cyl(0.005, 0.005, 0.004, m, 10);
    rot(led, Math.PI / 2, 0, 0);
    led.position.set(w * 0.22, h * 0.28 - i * 0.030, d / 2 + 0.008); g.add(led);
  }
  /* 底部进出线端子 */
  for (let i = -2; i <= 2; i++) {
    const gl = gland(M.brass, 0.010);
    gl.position.set(i * 0.09, -h / 2 - 0.002, 0); g.add(gl);
  }
  g.userData.size = [w, h, d];
  return g;
}

/**
 * 油浸式主变压器（升压站主变）
 * 真实量级：以 50MVA / 110kV 为例，本体约 5.5 × 3.0 × 3.6 m（长×宽×高，含散热器）。
 * 这里按「本体 + 两侧散热片 + 顶部油枕 + 高低压套管」的行业典型外形简化。
 * ⚠️ 不表达器身、绕组与分接开关。
 */
export function oilTransformer(o = {}) {
  const { w = 2.60, h = 2.40, d = 1.70 } = o;
  const g = new THREE.Group();

  /* 器身油箱 */
  const tank = rbox(w, h * 0.72, d, 0.010, M.aluDark, 2);
  tank.position.y = -h * 0.10; g.add(tank);
  /* 两侧散热片组（波纹片） */
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 8; i++) {
      const fin = bar(0.06, h * 0.52, d * 0.72, M.alu);
      fin.position.set(sx * (w / 2 + 0.10 + i * 0.075), -h * 0.12, 0); g.add(fin);
    }
  }
  /* 顶部油枕 */
  const cons = cyl(0.20, 0.20, w * 0.52, M.alu, 20);
  rot(cons, 0, 0, Math.PI / 2);
  cons.position.set(0, h * 0.36, -d * 0.34); g.add(cons);
  /* 高压套管（三只，较高） */
  for (let i = -1; i <= 1; i++) {
    const b = cyl(0.075, 0.105, h * 0.42, M.insul, 16);
    b.position.set(i * 0.42, h * 0.36 + h * 0.21, d * 0.24); g.add(b);
    const cap = cyl(0.055, 0.055, 0.04, M.aluDark, 14);
    cap.position.set(i * 0.42, h * 0.36 + h * 0.42 + 0.02, d * 0.24); g.add(cap);
  }
  /* 低压套管（三只，较矮） */
  for (let i = -1; i <= 1; i++) {
    const b = cyl(0.055, 0.075, h * 0.22, M.insul, 14);
    b.position.set(i * 0.42, h * 0.36 + h * 0.11, -d * 0.20); g.add(b);
  }
  /* 底部基础钢轨 */
  for (const sz of [-1, 1]) {
    const rail = bar(w * 1.06, 0.10, 0.12, M.steelBrushed);
    rail.position.set(0, -h * 0.46, sz * d * 0.34); g.add(rail);
  }
  /* 顶部油位计 */
  const gauge = cyl(0.05, 0.05, 0.03, M.glass, 14);
  rot(gauge, Math.PI / 2, 0, 0);
  gauge.position.set(0, h * 0.36, -d * 0.34 + w * 0.26); g.add(gauge);

  g.userData.size = [w + 1.3, h, d];
  return g;
}

/**
 * 风力发电机组（水平轴 · 上风向 · 三叶片）
 *
 * 真实量级：按 **1.5MW 级陆上机组** 取 —— 轮毂高 65m、风轮直径 82m（单叶片 41m），
 * 塔筒底部直径 3.6m、顶部 2.2m，含叶尖总高 106m。
 * （更常见的 2.5~3MW 级机组轮毂 90~110m、风轮 130~160m，总高 170m+，
 *   在本场景的机位下塔顶会顶出画面，所以取早期风场大量在用的 1.5MW 级。）
 *
 * ⚠️ 用途是**远景剪影**：升压站场景里风机在地平线上，靠它交代「这是风电场」。
 *   所以只做「塔筒 / 机舱 / 轮毂 / 三叶片」四件套 ——
 *   不做机舱内部、不做偏航与变桨机构、不做塔内爬梯与电缆。
 *
 * 原点约定与其他元件不同：**原点在塔基中心的地面标高**（y = 0 即地面），
 * 因为塔筒是「站在地上」的，这样摆位时直接给场地坐标即可。
 */
export function windTurbine(o = {}) {
  const {
    hub = 65,           // 轮毂中心高（m）
    rotor = 82,         // 风轮直径（m）
    towerBot = 3.6,     // 塔筒底部直径
    towerTop = 2.2,     // 塔筒顶部直径
    yaw = 0,            // 机舱朝向（绕 Y，弧度）
    spin = 0,           // 风轮转角（绕 Z，弧度）—— 给每台不同的值，避免三台一模一样
  } = o;
  const g = new THREE.Group();
  const BL = rotor / 2;
  const TOP = hub - 2.2;                 // 塔筒顶（机舱坐在上面）

  /* 塔筒分 4 节：真实塔筒是分节运到现场再吊装的，侧面有环缝。
     远景其实看不清，但分节让侧棱在光下有变化，比一根光溜溜的锥筒耐看。 */
  const SEG = 4;
  for (let i = 0; i < SEG; i++) {
    const y0 = TOP * i / SEG, y1 = TOP * (i + 1) / SEG;
    const d0 = towerBot + (towerTop - towerBot) * (i / SEG);
    const d1 = towerBot + (towerTop - towerBot) * ((i + 1) / SEG);
    const seg = cyl(d1 / 2, d0 / 2, y1 - y0, M.turbineWhite, 14);
    seg.position.y = (y0 + y1) / 2;
    g.add(seg);
  }
  /* 基础环：露出地面的一小段混凝土基础 */
  const foot = cyl(towerBot / 2 + 0.30, towerBot / 2 + 0.50, 0.90, M.concrete, 16);
  foot.position.y = 0.45;
  g.add(foot);

  /* 机舱（含尾部整流罩） */
  const body = rbox(2.6, 2.8, 6.0, 0.30, M.turbineWhite, 2);
  body.position.y = hub;
  body.rotation.x = -0.045;              // 真实机组有 4~6° 的仰角
  g.add(body);
  const tail = cyl(1.28, 1.02, 1.10, M.turbineWhite, 12);
  rot(tail, Math.PI / 2, 0, 0);
  tail.position.set(0, hub + 0.10, -3.30);
  g.add(tail);

  /* 轮毂 + 三叶片（在 XY 平面内绕 Z 旋转） */
  const rotorGrp = new THREE.Group();
  rotorGrp.position.set(0, hub, 3.10);
  rotorGrp.rotation.z = spin;
  const hubMesh = cyl(1.22, 1.02, 2.00, M.turbineWhite, 14);
  rot(hubMesh, Math.PI / 2, 0, 0);
  rotorGrp.add(hubMesh);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = i * Math.PI * 2 / 3;
    /* 叶片用 5 棱锥台再压扁成剖面 —— 比纯方板接近真实叶片的「根部厚、叶尖薄」 */
    const blade = cyl(0.16, 0.92, BL, M.turbineWhite, 5);
    blade.scale.z = 0.30;
    blade.position.y = BL / 2 + 1.00;
    blade.rotation.y = 0.10;             // 预扭
    arm.add(blade);
    rotorGrp.add(arm);
  }
  g.add(rotorGrp);

  g.rotation.y = yaw;
  g.userData.size = [towerBot, hub + BL, towerBot];
  return g;
}

/**
 * 预制舱式配电室（二次设备舱）
 * 真实量级：按 20ft 级预制舱取 6.0 × 2.8 × 3.0 m（长×宽×高）。
 * 场内二次设备（保护 / 计量 / 通信屏）集中装在这种舱里，
 * 比砌筑配电室快得多，新能源场站基本都用它。
 * 原点在**底面中心**（与风机一致：站在地上的物件不绕原点居中）。
 *
 * `openW`：正面开口宽度。
 *   · 0（默认）—— 保留 0.90 × 2.05 的单开门；
 *   · > 0      —— 做成「双扇大门全开、折回平贴正面墙」的大开口。
 *     升压站场景要让人**看见舱内成排的二次屏柜**，0.9m 的门洞只够看见一台柜的
 *     一条缝，所以用大开口。两扇门折回到 ±openW 处，正好压在正面墙的墙板上，
 *     与墙板保持 45mm 的铰链间隙 —— 贴死会与墙面的竖向压筋相交（压筋凸出墙面 27mm）。
 */
export function prefabHut(o = {}) {
  const { w = 6.00, h = 3.00, d = 2.80, door = 1, openW = 0 } = o;
  const g = new THREE.Group();
  const t = 0.06;
  const FZ = d / 2;

  /* 底座型钢 + 花纹钢地板 */
  const base = rbox(w, 0.16, d, 0.01, M.steelBrushed, 1);
  base.position.y = 0.08;
  g.add(base);
  const deck = plate(w - 0.10, d - 0.10, 0.02, M.powderMid);
  rot(deck, -Math.PI / 2, 0, 0);
  deck.position.y = 0.17;
  g.add(deck);

  /* 四面墙（竖向压筋波纹板） */
  for (const [bw, bx, bz, ry] of [[w, 0, -FZ + t / 2, 0], [d, -w / 2 + t / 2, 0, Math.PI / 2],
    [d, w / 2 - t / 2, 0, Math.PI / 2]]) {
    const wall = plate(bw, h, t, M.powderLight);
    wall.position.set(bx, h / 2 + 0.16, bz);
    rot(wall, 0, ry, 0);
    g.add(wall);
  }
  /* 正面墙：留门洞（openW > 0 时是大开口，否则是 0.90 的单开门洞） */
  const DW = openW > 0 ? openW : 0.90;
  const DH = openW > 0 ? Math.min(2.35, h - 0.30) : 2.05;
  const segW = (w - DW) / 2;
  for (const sx of [-1, 1]) {
    const seg = plate(segW, h, t, M.powderLight);
    seg.position.set(sx * (DW / 2 + segW / 2), h / 2 + 0.16, FZ - t / 2);
    g.add(seg);
  }
  const lintel = plate(DW, h - DH, t, M.powderLight);
  lintel.position.set(0, DH + (h - DH) / 2 + 0.16, FZ - t / 2);
  g.add(lintel);
  /* 竖向压筋（门洞范围内不摆，否则会悬空） */
  const ribN = 14;
  for (let i = 0; i < ribN; i++) {
    const x = -w / 2 + t + (i + 0.5) * (w - 2 * t) / ribN;
    if (Math.abs(x) < DW / 2 + 0.06) continue;
    const rib = bar(0.045, h * 0.90, 0.030, M.powderLight);
    rib.position.set(x, h / 2 + 0.16, FZ + 0.012);
    g.add(rib);
  }
  /* 顶盖（微坡）+ 挑檐 */
  const roof = rbox(w + 0.24, 0.10, d + 0.24, 0.02, M.powderMid, 1);
  roof.position.y = h + 0.16;
  g.add(roof);

  if (openW > 0) {
    /* 双扇大门全开、折回平贴正面墙。
       铰点放在门洞边缘（±DW/2），门扇朝洞内（∓x）伸出，绕 Y 转 ±3.06 rad ≈ 175°
       → 门扇几乎与正面墙平行，只留 5° 缝避免共面闪烁。
       ⚠️ 铰链轴线要离开墙面 45mm：门扇厚 20mm、墙面压筋凸出 27mm，
       贴死会让门扇穿进压筋里。 */
    const LW = DW / 2;
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * DW / 2, 0.16 + DH / 2, FZ + 0.045);
      const leaf = doorPanel({
        w: LW - 0.02, h: DH - 0.04, t: 0.02,
        handle: { x: sx * (LW / 2 - 0.12), y: 0 },
        plate: sx < 0
          ? { x: 0, y: DH / 2 - 0.36, w: 0.30, h: 0.11, title: '二次设备舱', sub: 'SECONDARY' }
          : null,
        hinges: [-DH / 2 + 0.25, 0, DH / 2 - 0.25],
        hingeSide: sx,
      });
      leaf.position.set(-sx * (LW - 0.02) / 2, 0, 0);
      pivot.add(leaf);
      pivot.rotation.y = sx * 3.06;
      /* 可开合（见 app.js 的 collectDoors）：铰点在门洞边缘、门扇朝洞内伸，
         rotation.y = 0 即关闭。 */
      pivot.userData.door = { open: sx * 3.06, closed: 0 };
      pivot.userData.explode = [0, 0, 0.55];
      g.add(pivot);
    }
  } else {
    /* 单开门：铰点在门洞边缘，朝外开 ~150° 折回贴正面墙 */
    const pivot = new THREE.Group();
    pivot.position.set(-DW / 2, 0.16 + DH / 2, FZ + 0.004);
    const leaf = doorPanel({
      w: DW - 0.03, h: DH - 0.06, t: 0.02,
      handle: { x: DW / 2 - 0.10, y: 0 },
      plate: { x: 0, y: DH / 2 - 0.34, w: 0.30, h: 0.11, title: '二次设备舱', sub: 'SECONDARY' },
      hinges: [-DH / 2 + 0.25, 0, DH / 2 - 0.25],
      hingeSide: -1,
    });
    leaf.position.set((DW - 0.03) / 2, 0, 0);
    pivot.add(leaf);
    pivot.rotation.y = door * 2.60;
    pivot.userData.door = { open: door * 2.60, closed: 0 };
    pivot.userData.explode = [0, 0, 0.55];
    g.add(pivot);
  }

  /* 侧面百叶（舱内通风）+ 舱顶吊装环 */
  const lv = louverPanel(0.80, 0.55, { cols: 7, rows: 4, mat: M.louver });
  lv.position.set(w / 2 + 0.01, 2.10, 0);
  rot(lv, 0, Math.PI / 2, 0);
  g.add(lv);
  for (const sx of [-1, 1]) {
    const ring = cyl(0.05, 0.05, 0.03, M.steelBrushed, 10);
    ring.position.set(sx * w * 0.30, h + 0.24, 0);
    g.add(ring);
  }

  g.userData.size = [w, h + 0.24, d];
  return g;
}

/* ============================================================
 * 控制与保护 ·「继电器替代方案」元件（第 48 轮）
 *
 * 这一组回答的是客户最常问的一句话：「这个柜子用不到你们的专用继电器，那用什么？」
 * 所以外形的第一要务不是好看，而是**让人一眼分辨出是哪一种做法**：
 *   · 插拔式  → 本体「坐」在底座上，本体可以从底座上直接拔下来；
 *   · 超薄型  → 极薄的一条，导轨上密集排布；
 *   · 固态    → 带散热齿的金属底板，没有可动件、没有拨杆；
 *   · 控制器  → 面板上有一列输入 / 输出指示灯与编程口，右侧可挂扩展模块；
 *   · 一体化  → 屏大、指示灯多，CT / PT 二次线直接进装置背面。
 *
 * ⚠️ 纪律与其它通用元件完全一致：只做行业典型外观的简化几何体，
 *    不推断内部结构、不补写参数、不指向任何具体厂商型号。
 * ⚠️ 性能：每个 4~8 个 Mesh，一律共用 M.* 里的共享材质。
 *    **外壳刻意用不透明材质** —— 透明材质不参与批处理，
 *    「能看见里面」这件事靠外形与分件表达，不靠真透明（那样每只都要多一次 draw call）。
 * ========================================================== */

/**
 * 插拔式小型中间继电器 —— 用户点名要看的那一种。
 * 外观要点：导轨底座（黑色，两侧带接线端子）+ 插在底座上的继电器本体
 * + 本体底面前方的金属卡簧 + 正面指示窗。
 * ⚠️ 本体与底座之间**刻意留一条缝**：这是「它能拔下来」唯一的视觉凭据，
 *    贴在一起就退化成一个普通方块，「插拔」这件事就完全看不出来了。
 */
export function relayPlugUnit(o = {}) {
  const { w = 0.023, h = 0.062, d = 0.058 } = o;
  const g = new THREE.Group();
  const hBase = h * 0.30, hBody = h * 0.66, gap = h * 0.035;

  /* 底座：卡在导轨上，前后两侧是接线端子 */
  const base = rbox(w, hBase, d * 0.98, 0.003, M.pcBlack, 1);
  base.position.y = -h / 2 + hBase / 2; g.add(base);
  for (const sz of [-1, 1]) {
    const t = rbox(w * 0.86, hBase * 0.50, d * 0.16, 0.002, M.termGreen, 1);
    t.position.set(0, -h / 2 + hBase * 0.46, sz * d * 0.40); g.add(t);
  }
  /* 本体：坐在底座上（留缝） */
  const bodyY = -h / 2 + hBase + gap + hBody / 2;
  const body = rbox(w * 0.96, hBody, d * 0.90, 0.004, M.pcGray, 2);
  body.position.y = bodyY; g.add(body);
  const face = plate(w * 0.70, hBody * 0.74, 0.003, M.pcDark, 0.002);
  face.position.set(0, bodyY, d * 0.45); g.add(face);
  /* 动作指示窗：插拔式继电器上「动没动作」一眼可见的地方 */
  const led = cyl(0.0040, 0.0040, 0.004, M.ledGreen, 10);
  rot(led, Math.PI / 2, 0, 0);
  led.position.set(0, bodyY + hBody * 0.30, d * 0.45); g.add(led);
  /* 卡簧：本体底面前方的一道金属丝 —— 拔插的着力点 */
  const clip = bar(w * 0.62, 0.0035, 0.009, M.steelBrushed);
  clip.position.set(0, -h / 2 + hBase + gap * 0.5, d * 0.38); g.add(clip);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 超薄型中间继电器（薄片式）
 * 外观要点：厚度只有几毫米，正面就是那条**窄边**（宽 × 高），
 * 识别特征全在这条边上；底部后方是导轨卡脚。
 */
export function relaySlimUnit(o = {}) {
  const { w = 0.0085, h = 0.078, d = 0.072 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.0015, M.pcGray, 1); g.add(body);
  const face = plate(w * 1.08, h * 0.88, 0.0015, M.pcBeige, 0.001);
  face.position.z = d / 2; g.add(face);
  const led = cyl(0.0028, 0.0028, 0.0025, M.ledGreen, 8);
  rot(led, Math.PI / 2, 0, 0);
  led.position.set(0, h * 0.30, d / 2 + 0.002); g.add(led);
  /* 导轨卡脚（后下方） */
  const foot = rbox(w * 1.5, h * 0.10, d * 0.26, 0.002, M.pcBlack, 1);
  foot.position.set(0, -h * 0.42, -d * 0.26); g.add(foot);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 固态继电器
 * 外观要点：**金属底板 + 竖向散热齿**是它与有触点继电器最大的外形差别 ——
 * 没有拨杆、没有可动件，前脸只有输入 / 输出端子与一颗灯。
 */
export function ssrUnit(o = {}) {
  const { w = 0.045, h = 0.058, d = 0.100 } = o;
  const g = new THREE.Group();

  const sink = rbox(w, h * 0.20, d * 0.92, 0.002, M.alu, 1);
  sink.position.y = -h * 0.38; g.add(sink);
  for (let i = -2; i <= 2; i++) {
    const f = bar(w * 0.98, h * 0.28, 0.004, M.alu);
    f.position.set(0, -h * 0.34, i * d * 0.17); g.add(f);
  }
  const body = rbox(w, h * 0.66, d * 0.86, 0.003, M.pcDark, 2);
  body.position.y = h * 0.10; g.add(body);
  for (const sx of [-1, 1]) {
    const t = rbox(w * 0.34, h * 0.18, 0.012, 0.002, M.termGreen, 1);
    t.position.set(sx * w * 0.26, h * 0.26, d * 0.44); g.add(t);
  }
  const led = cyl(0.0035, 0.0035, 0.003, M.ledRed, 8);
  rot(led, Math.PI / 2, 0, 0);
  led.position.set(0, h * 0.02, d * 0.44); g.add(led);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 时间继电器
 * 外观要点：与中间继电器同族的导轨外壳，但面板上有**整定旋钮** ——
 * 这是「它能设时间」唯一的视觉凭据。
 */
export function timeRelayUnit(o = {}) {
  const { w = 0.038, h = 0.078, d = 0.072 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.003, M.pcGray, 2); g.add(body);
  const face = plate(w * 0.84, h * 0.80, 0.003, M.pcBeige, 0.002);
  face.position.z = d / 2; g.add(face);
  /* 整定旋钮 ×2（时间 / 量程） */
  for (const [sx, sy] of [[-1, 0.20], [1, -0.08]]) {
    const k = cyl(w * 0.14, w * 0.16, 0.010, M.pcBlack, 12);
    rot(k, Math.PI / 2, 0, 0);
    k.position.set(sx * w * 0.20, h * sy, d / 2 + 0.005); g.add(k);
  }
  const led = cyl(0.0035, 0.0035, 0.003, M.ledGreen, 8);
  rot(led, Math.PI / 2, 0, 0);
  led.position.set(w * 0.20, h * 0.34, d / 2 + 0.004); g.add(led);
  const tb = rbox(w * 0.86, h * 0.12, d * 0.24, 0.002, M.termGreen, 1);
  tb.position.set(0, -h * 0.40, d * 0.32); g.add(tb);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 小型可编程控制器（PLC 主机）
 * 外观要点：方形主机 + 正面一列**输入 / 输出指示灯**与编程口 +
 * 上下端子排 + 右侧面的扩展排线口。
 */
export function plcUnit(o = {}) {
  const { w = 0.090, h = 0.100, d = 0.085 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.003, M.pcDark, 2); g.add(body);
  const face = plate(w * 0.86, h * 0.84, 0.003, M.pcGray, 0.002);
  face.position.z = d / 2; g.add(face);
  /* 指示灯阵列：输入 / 输出各一列 —— 控制器与继电器在面板上最大的差别 */
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const l = cyl(0.0026, 0.0026, 0.0025, sx < 0 ? M.ledGreen : M.ledAmber, 8);
      rot(l, Math.PI / 2, 0, 0);
      l.position.set(sx * w * 0.26, h * 0.30 - i * h * 0.11, d / 2 + 0.002); g.add(l);
    }
  }
  const port = rbox(w * 0.22, h * 0.10, 0.010, 0.002, M.pcBlack, 1);
  port.position.set(0, -h * 0.30, d / 2 + 0.004); g.add(port);
  for (const sy of [1, -1]) {
    const t = rbox(w * 0.90, h * 0.10, d * 0.22, 0.002, M.termGreen, 1);
    t.position.set(0, sy * (h / 2 - h * 0.03), -d * 0.20); g.add(t);
  }
  /* 右侧扩展排线口 —— 「还能挂模块」这件事的凭据 */
  const exp = rbox(0.008, h * 0.30, d * 0.20, 0.002, M.pcBlack, 1);
  exp.position.set(w / 2 + 0.003, 0, -d * 0.10); g.add(exp);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 可编程逻辑继电器
 * 外观要点：比 PLC 小一号的导轨模块，正面带**小液晶屏 + 四向键**，
 * 不接电脑也能就地改逻辑。
 */
export function logoUnit(o = {}) {
  const { w = 0.072, h = 0.090, d = 0.072 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.003, M.pcGray, 2); g.add(body);
  const face = plate(w * 0.84, h * 0.84, 0.003, M.pcDark, 0.002);
  face.position.z = d / 2; g.add(face);
  const scr = plate(w * 0.56, h * 0.26, 0.002, M.displayOn, 0.001);
  scr.position.set(0, h * 0.22, d / 2 + 0.003); g.add(scr);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
    const k = rbox(w * 0.11, h * 0.07, 0.006, 0.0015, M.btnGray, 1);
    k.position.set(dx * w * 0.13, h * 0.02 + dy * h * 0.075, d / 2 + 0.003); g.add(k);
  }
  const tb = rbox(w * 0.88, h * 0.11, d * 0.24, 0.002, M.termGreen, 1);
  tb.position.set(0, -h * 0.40, d * 0.32); g.add(tb);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 数字量输入输出扩展模块
 * 外观要点：与主机同高的窄条模块，正面只有一列指示灯与一个侧向连接器 ——
 * 它是**挂在别的控制器旁边**用的，自己不独立工作。
 */
export function ioModUnit(o = {}) {
  const { w = 0.030, h = 0.100, d = 0.085 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.003, M.pcDark, 2); g.add(body);
  const face = plate(w * 0.78, h * 0.86, 0.003, M.pcGray, 0.002);
  face.position.z = d / 2; g.add(face);
  for (let i = 0; i < 6; i++) {
    const l = cyl(0.0024, 0.0024, 0.0025, i % 2 ? M.ledAmber : M.ledGreen, 8);
    rot(l, Math.PI / 2, 0, 0);
    l.position.set(0, h * 0.32 - i * h * 0.105, d / 2 + 0.002); g.add(l);
  }
  for (const sy of [1, -1]) {
    const t = rbox(w * 0.88, h * 0.09, d * 0.22, 0.002, M.termGreen, 1);
    t.position.set(0, sy * (h / 2 - h * 0.028), -d * 0.20); g.add(t);
  }
  /* 左侧连接器：与主机咬合的那一面 */
  const con = rbox(0.007, h * 0.26, d * 0.16, 0.002, M.pcBlack, 1);
  con.position.set(-w / 2 - 0.003, 0, -d * 0.08); g.add(con);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 一体化保护测控装置
 * 外观要点：一块**嵌入柜门 / 面板**的装置：正面大屏 + 右侧按键区 +
 * 下方两列指示灯，背面进 CT / PT 二次线。
 * ⚠️ 与 PROT（微机综合保护装置）的区别只在「强调什么」：这一只突出
 *    「保护 + 测量 + 控制 + 通信」四合一，所以屏更大、指示灯更多。
 */
export function iedUnit(o = {}) {
  const { w = 0.155, h = 0.180, d = 0.090 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.003, M.pcDark, 2); g.add(body);
  const bez = plate(w * 0.94, h * 0.94, 0.004, M.pcGray, 0.002);
  bez.position.z = d / 2; g.add(bez);
  const scr = plate(w * 0.60, h * 0.42, 0.002, M.displayOn, 0.001);
  scr.position.set(-w * 0.10, h * 0.16, d / 2 + 0.003); g.add(scr);
  for (let i = 0; i < 4; i++) {
    const k = rbox(w * 0.16, h * 0.08, 0.006, 0.0015, M.btnGray, 1);
    k.position.set(w * 0.34, h * 0.26 - i * h * 0.11, d / 2 + 0.003); g.add(k);
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const l = cyl(0.0030, 0.0030, 0.0028, sx < 0 ? M.ledGreen : M.ledRed, 8);
      rot(l, Math.PI / 2, 0, 0);
      l.position.set(sx * w * 0.30, -h * 0.30 + i * h * 0.075, d / 2 + 0.002); g.add(l);
    }
  }
  /* 背面接线端子：CT / PT 二次线从这里进装置 */
  const tb = rbox(w * 0.84, h * 0.14, 0.016, 0.002, M.termGreenDark, 1);
  tb.position.set(0, -h * 0.46, -d / 2 + 0.008); g.add(tb);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 智能操作显示装置（操显装置）
 * 外观要点：柜门上的一块**窄长面板** —— 上面是模拟图 / 状态显示，
 * 下面是分合闸操作开关与就地远方切换，底部一排指示灯。
 */
export function smartOpsUnit(o = {}) {
  const { w = 0.180, h = 0.230, d = 0.045 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.003, M.pcDark, 2); g.add(body);
  const scr = plate(w * 0.80, h * 0.50, 0.002, M.displayOn, 0.001);
  scr.position.set(0, h * 0.21, d / 2 + 0.003); g.add(scr);
  for (const sx of [-1, 1]) {
    const k = cyl(w * 0.10, w * 0.11, 0.020, M.btnGray, 12);
    rot(k, Math.PI / 2, 0, 0);
    k.position.set(sx * w * 0.20, -h * 0.22, d / 2 + 0.010); g.add(k);
  }
  const LEDS = [M.ledRed, M.ledGreen, M.ledGreen, M.ledAmber, M.ledAmber, M.ledRed];
  for (let i = 0; i < 6; i++) {
    const l = cyl(0.0032, 0.0032, 0.003, LEDS[i], 8);
    rot(l, Math.PI / 2, 0, 0);
    l.position.set((i - 2.5) * w * 0.13, -h * 0.40, d / 2 + 0.002); g.add(l);
  }

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 配电自动化终端（DTU / FTU）
 * 外观要点：小型金属机箱 + 前面板的状态灯与通信口 + 底部接线端子，
 * 常与后备电源箱装在一起。
 */
export function dtuUnit(o = {}) {
  const { w = 0.140, h = 0.160, d = 0.130 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.004, M.pcGray, 2); g.add(body);
  const face = plate(w * 0.88, h * 0.80, 0.003, M.pcDark, 0.002);
  face.position.z = d / 2; g.add(face);
  for (let i = 0; i < 5; i++) {
    const l = cyl(0.0030, 0.0030, 0.0028, i < 2 ? M.ledGreen : M.ledAmber, 8);
    rot(l, Math.PI / 2, 0, 0);
    l.position.set((i - 2) * w * 0.13, h * 0.26, d / 2 + 0.002); g.add(l);
  }
  for (const sx of [-1, 1]) {
    const p = rbox(w * 0.16, h * 0.09, 0.010, 0.002, M.pcBlack, 1);
    p.position.set(sx * w * 0.22, -h * 0.10, d / 2 + 0.004); g.add(p);
  }
  const tb = rbox(w * 0.86, h * 0.10, d * 0.22, 0.002, M.termGreen, 1);
  tb.position.set(0, -h * 0.46, -d * 0.16); g.add(tb);

  g.userData.size = [w, h, d];
  return g;
}

/**
 * 无线测温传感器
 * 外观要点：一只**很小的方块**（真正的主角是它卡在母排 / 触头 / 电缆接头上），
 * 所以这里额外给一段卡箍 —— 让它读起来像「夹在导体上的东西」而不是一只盒子。
 */
export function wirelessTempUnit(o = {}) {
  const { w = 0.030, h = 0.022, d = 0.026 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.003, M.pcBeige, 2); g.add(body);
  const top = plate(w * 0.66, d * 0.60, 0.002, M.pcDark, 0.001);
  top.rotation.x = -Math.PI / 2;
  top.position.y = h / 2 + 0.001; g.add(top);
  /* 天线（短棒） */
  const ant = cyl(0.0022, 0.0022, 0.014, M.aluDark, 8);
  ant.position.set(w * 0.30, h * 0.5 + 0.006, 0); g.add(ant);
  /* 卡箍：绕过导体的一圈金属带 */
  for (const sx of [-1, 1]) {
    const arm = bar(0.0035, h * 1.5, d * 0.9, M.aluDark);
    arm.position.set(sx * w * 0.62, -h * 0.30, 0); g.add(arm);
  }
  const strap = bar(w * 1.28, 0.0035, d * 0.9, M.aluDark);
  strap.position.set(0, -h * 0.98, 0); g.add(strap);

  g.userData.size = [w * 1.3, h * 2.0, d];
  return g;
}

/**
 * 就地人机界面（触摸屏）
 * 外观要点：一块**几乎全是屏**的面板，只有一圈窄边框；没有按键、没有拨杆。
 */
export function hmiUnit(o = {}) {
  const { w = 0.200, h = 0.150, d = 0.045 } = o;
  const g = new THREE.Group();

  const body = rbox(w, h, d, 0.004, M.pcDark, 2); g.add(body);
  const scr = plate(w * 0.90, h * 0.86, 0.002, M.displayOn, 0.0015);
  scr.position.z = d / 2 + 0.002; g.add(scr);
  /* 边框上沿一颗电源灯 —— 整块面板上唯一的非屏元素 */
  const l = cyl(0.0032, 0.0032, 0.003, M.ledGreen, 8);
  rot(l, Math.PI / 2, 0, 0);
  l.position.set(w * 0.42, h * 0.42, d / 2 + 0.002); g.add(l);

  g.userData.size = [w, h, d];
  return g;
}

/* ============================================================
 * 注册表：元件 id → 构造函数
 * 没有专用模型的（端子排 / 线槽 / 母线 / 绝缘子 / 变压器 / 线束）
 * 直接复用 parts.js 里已有的零件，避免重复造。
 * ========================================================== */
export const ELEMENT_BUILDERS = {
  VCB: vcbTruck,
  LBS: lbsUnit,
  ES: esUnit,
  CT: ctUnit,
  PT: ptUnit,
  SPD: spdUnit,
  FUSE: fuseUnit,
  CONTACTBOX: contactBox,
  WALLBUSH: wallBushing,
  GNDBAR: groundBarUnit,
  CABLETERM: cableTermUnit,

  MCCB: mccbUnit,
  MCB: mcbUnit,
  CONTACTOR: contactorUnit,
  FAN: fanUnit,
  HEATER: heaterUnit,
  METER: meterUnit,
  PROT: protUnit,
  PSU_G: psuUnit,
  BATT: batteryBank,
  CHARGER: chargerUnit,
  TEMPCTRL: tempctrlUnit,

  /* 控制与保护 ·「继电器替代方案」（第 48 轮） */
  RELAY_PLUG: relayPlugUnit,
  RELAY_SLIM: relaySlimUnit,
  SSR: ssrUnit,
  TIME_RELAY: timeRelayUnit,
  PLC: plcUnit,
  LOGO: logoUnit,
  IO_MOD: ioModUnit,
  IED: iedUnit,
  SMART_OPS: smartOpsUnit,
  DTU: dtuUnit,
  WIRELESS_TEMP: wirelessTempUnit,
  HMI: hmiUnit,

  /* 高压组合电器 / 新能源场站 */
  GIS: gisBay,
  PCS: pcsUnit,
  ESSRACK: essRack,
  HVAC: hvacUnit,
  FIRE: fireUnit,
  INVERTER: inverterUnit,
  PVTABLE: pvTable,
  COMBINER: combinerBox,
  OILXFMR: oilTransformer,
  WIND: windTurbine,
  PREFAB: prefabHut,

  /* 复用已有零件 */
  TERMINAL: (o = {}) => terminalRow(o.count || 20, o),
  DUCT: (o = {}) => wireDuct(o.len || 0.6, o.w, o.h),
  BUS: (o = {}) => {
    const g = new THREE.Group();
    const b = busbar(o.len || 0.8, o.h || 0.06, o.t || 0.010, o.mat || M.copper);
    g.add(b);
    g.userData.size = [o.len || 0.8, o.h || 0.06, o.t || 0.010];
    return g;
  },
  INSULATOR: (o = {}) => {
    const g = new THREE.Group();
    const i = insulator(o.h || 0.16, o.mat || M.pcBeige);
    g.add(i);
    g.userData.size = [0.07, o.h || 0.16, 0.07];
    return g;
  },
  XFMR: (o = {}) => dryTransformer(o),
  WIRE: (o = {}) => cableBundle(o.count || 5, o.len || 0.5, o),
};

/** 兜底：任何没登记的元件 id 都退化成一个小方盒，绝不报错 */
function fallbackUnit(o = {}) {
  const { w = 0.08, h = 0.08, d = 0.08 } = o;
  const g = new THREE.Group();
  const b = rbox(w, h, d, 0.004, M.pcGray, 2); g.add(b);
  g.userData.size = [w, h, d];
  return g;
}

/**
 * 统一入口：按元件 id 生成示意模型。
 * 生成后打上 gid，场景直接 add + hotspot(gid, obj) 即可点击。
 */
export function buildElement(gid, opt = {}) {
  const f = ELEMENT_BUILDERS[gid] || fallbackUnit;
  const g = f(opt);
  g.userData.gid = gid;
  return g;
}
