/**
 * dcpanel.js —— 户内场景：直流屏室（GZDW 微机控制直流电源柜）
 */
import * as THREE from 'three';
import { M } from '../mats.js';
import {
  rbox, plate, cyl, bar, grp, doorPanel, cabinetShell, dinRail,
  wireDuct, terminalRow, hinge, ceilingLightStrip, roomBox,
  cableBundle, nameplateTex, contactShadow,
} from '../parts.js';
import { buildProductModel } from '../product-models.js';
import { hotspot, placeOnRail, cullRailBlanks, mountElement, regElement } from '../scene-kit.js';
import { isolateMaterials } from '../mats.js';
import { canvasTex } from '../util.js';

const CW = 0.80, CH = 2.26, CD = 0.60, GAP = 0.008;
const CZ = -0.90;
const FRONT = CZ + CD / 2;      // 世界坐标：屏前表面 z
const LF = CD / 2;              // 柜局部坐标：屏前表面 z

/* ---------- 仪表（门面嵌入） ---------- */
function doorMeter(w, h, draw) {
  const g = new THREE.Group();
  const body = rbox(w, h, 0.05, 0.003, M.pcDark, 1);
  body.position.z = 0.02;
  g.add(body);
  const face = plate(w - 0.006, h - 0.006, 0.004, M.pcBlack, 0.002);
  face.position.z = 0.045;
  g.add(face);
  const t = canvasTex(256, 256, draw);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.014, h - 0.014),
    new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.85, roughness: 0.3 }));
  scr.position.z = 0.0475;
  g.add(scr);
  return g;
}

/* ---------- 蓄电池组 ---------- */
function batteryRack(rows = 4, perRow = 6) {
  const g = new THREE.Group();
  const W = perRow * 0.115 + 0.06, H = rows * 0.26 + 0.10, D = 0.44;
  // 架体
  for (const sx of [-1, 1]) {
    const post = bar(0.04, H, D, M.powderDark);
    post.position.set(sx * (W / 2 - 0.02), H / 2, 0);
    g.add(post);
  }
  const cellGeo = new THREE.BoxGeometry(0.105, 0.21, 0.36);
  const capGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.016, 12);
  for (let r = 0; r < rows; r++) {
    const y = 0.06 + r * 0.26;
    const shelf = plate(W, D, 0.012, M.powderDark);
    shelf.rotation.x = Math.PI / 2;
    shelf.position.set(0, y, 0);
    g.add(shelf);
    for (let c = 0; c < perRow; c++) {
      const cell = new THREE.Mesh(cellGeo, M.pcDark);
      cell.castShadow = true; cell.receiveShadow = true;
      cell.position.set(-W / 2 + 0.06 + c * 0.115, y + 0.11, 0);
      g.add(cell);
      // 极柱
      for (const dx of [-0.032, 0.032]) {
        const cap = new THREE.Mesh(capGeo, dx < 0 ? M.ledRed : M.pcBlack);
        cap.position.set(cell.position.x + dx, y + 0.225, 0.12);
        g.add(cap);
      }
      // 连接条
      if (c < perRow - 1) {
        const link = bar(0.03, 0.006, 0.02, M.copper);
        link.position.set(cell.position.x + 0.0575, y + 0.228, 0.12);
        g.add(link);
      }
    }
  }
  return g;
}

/* ---------- 直流屏柜 ---------- */
function dcCabinet({ open = false, kind = 'feed', hinge = 'left' } = {}) {
  const g = new THREE.Group();
  /* midBrace:'back' —— 去掉前侧中间横撑：柜内安装板在 z=0.20，FA 有 110mm 深，
     前侧横撑（z=+0.289）会被产品插穿 15.4mm（clip_test 实测）。真实直流屏前侧
     是门洞、不放横撑，去掉既修穿模又更贴近实际。 */
  g.add(cabinetShell({ w: CW, h: CH, d: CD, plinth: 0.05, midBrace: 'back' }));

  const doorH = CH - 0.14;
  const d = doorPanel({
    w: CW - 0.012, h: doorH, t: 0.016,
    windows: kind === 'charge' ? [{ x: 0.16, y: 0.28, w: 0.30, h: 0.34 }] : [],
    handle: { x: -0.30, y: 0.0 },
    lock: { x: -0.30, y: -0.16 },
    hinges: [-0.62, 0.0, 0.62],
  });

  if (kind === 'charge') {
    const m = doorMeter(0.10, 0.10, (gg) => {
      gg.fillStyle = '#06100c'; gg.fillRect(0, 0, 256, 256);
      gg.fillStyle = '#4dffb0'; gg.shadowColor = '#4dffb0'; gg.shadowBlur = 16;
      gg.font = '700 54px "SF Mono",monospace'; gg.textAlign = 'center';
      gg.fillText('220', 128, 110);
      gg.font = '700 26px "SF Mono",monospace';
      gg.fillText('V  DC', 128, 146);
      gg.fillStyle = '#7de8c0'; gg.font = '600 22px "SF Mono",monospace';
      gg.fillText('均充 2.35V', 128, 190);
      gg.fillText('I 12.6A', 128, 216);
    });
    m.position.set(-0.16, 0.10, 0);
    d.add(m);
    // 指示灯排
    for (let i = 0; i < 5; i++) {
      const L = cyl(0.008, 0.008, 0.006, i === 0 ? M.ledGreen : i === 3 ? M.ledAmber : M.pcBlack, 12);
      L.rotation.x = Math.PI / 2;
      L.position.set(-0.26 + i * 0.05, -0.28, 0.011);
      d.add(L);
    }
  }
  if (kind === 'feed') {
    const m = doorMeter(0.10, 0.10, (gg) => {
      gg.fillStyle = '#06100c'; gg.fillRect(0, 0, 256, 256);
      gg.fillStyle = '#5ce8ff'; gg.shadowColor = '#5ce8ff'; gg.shadowBlur = 16;
      gg.font = '700 50px "SF Mono",monospace'; gg.textAlign = 'center';
      gg.fillText('220.4', 128, 108);
      gg.font = '700 24px "SF Mono",monospace';
      gg.fillText('V  控母', 128, 142);
      gg.fillStyle = '#9fe8ff'; gg.font = '600 20px "SF Mono",monospace';
      gg.fillText('合母 238V', 128, 186);
      gg.fillText('绝阻 99.9M', 128, 212);
    });
    m.position.set(-0.16, 0.22, 0);
    d.add(m);
  }
  if (kind === 'battery') {
    const m = doorMeter(0.10, 0.10, (gg) => {
      gg.fillStyle = '#06100c'; gg.fillRect(0, 0, 256, 256);
      gg.fillStyle = '#ff9d4d'; gg.shadowColor = '#ff9d4d'; gg.shadowBlur = 16;
      gg.font = '700 46px "SF Mono",monospace'; gg.textAlign = 'center';
      gg.fillText('54/54', 128, 104);
      gg.font = '700 22px "SF Mono",monospace';
      gg.fillText('电池在线', 128, 140);
      gg.fillStyle = '#ffc98f'; gg.font = '600 20px "SF Mono",monospace';
      gg.fillText('单体 2.26V', 128, 184);
      gg.fillText('内阻 正常', 128, 210);
    });
    m.position.set(-0.16, 0.22, 0);
    d.add(m);
  }

  const hingeGroup = new THREE.Group();
  const sx = hinge === 'right' ? 1 : -1;
  hingeGroup.position.set(sx * (CW / 2 - 0.006), CH / 2, LF + 0.008);
  d.position.set(-sx * (CW - 0.012) / 2, 0, 0);
  hingeGroup.add(d);
  // 开约 93°：门叶几乎垂直于屏面，只占一条窄竖带，不会横着盖住相邻屏
  if (open) hingeGroup.rotation.y = sx * 1.62;
  /* 可开合（见 app.js 的 collectDoors）。铰点在屏体侧边、门扇朝门洞内伸，
     rotation.y = 0 即关闭；sx 决定往哪一侧转。 */
  hingeGroup.userData.door = { open: sx * 1.62, closed: 0 };
  hingeGroup.userData.explode = [0, 0, 0.72];
  g.add(hingeGroup);

  return g;
}

export function build() {
  const root = new THREE.Group();
  const hotspots = [];
  const ROOM = { w: 8.0, h: 2.98, d: 6.4 };

  root.add(roomBox({ w: ROOM.w, h: ROOM.h, d: ROOM.d, floorMat: M.concrete, wallMat: M.wall, ceilMat: M.ceilPanel }));

  // 地面分格
  for (let i = -2; i <= 2; i++) {
    const l = bar(ROOM.w, 0.002, 0.014, M.concreteDark);
    l.position.set(0, 0.001, i * 1.5);
    root.add(l);
  }

  // 电缆沟
  const trench = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const p = rbox(1.0, 0.028, 0.46, 0.004, M.concreteDark, 1);
    p.position.set(-2.0 + i * 1.02, 0.014, -0.12);
    trench.add(p);
  }
  root.add(trench);

  // 接触阴影
  const cs = contactShadow(2.9, 1.2, 0.6);
  cs.position.set(0, 0.004, CZ);
  root.add(cs);

  // 天花板灯带（冷白）
  for (const z of [-1.5, 0.7]) {
    for (const x of [-2.2, 2.2]) {
      const s = ceilingLightStrip(1.8);
      s.position.set(x, ROOM.h - 0.10, z);
      root.add(s);
    }
  }

  // 墙上的 直流系统图 / 绝缘监察
  const diagTex = canvasTex(512, 320, (g) => {
    g.fillStyle = '#e9eae4'; g.fillRect(0, 0, 512, 320);
    g.strokeStyle = '#1d2733'; g.lineWidth = 3; g.strokeRect(4, 4, 504, 312);
    g.fillStyle = '#1d2733'; g.font = '700 26px "PingFang SC",sans-serif';
    g.fillText('直流系统接线示意', 20, 40);
    g.strokeStyle = '#2b5f8a'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 72;
      g.beginPath(); g.moveTo(x, 80); g.lineTo(x, 270); g.stroke();
      g.fillStyle = '#b3352c'; g.fillRect(x - 9, 120, 18, 30);
      g.fillStyle = '#5b6670'; g.font = '600 15px "SF Mono",monospace';
      g.fillText('F' + (i + 1), x - 12, 296);
    }
    g.fillStyle = '#0f5a3a'; g.fillRect(24, 60, 460, 6);
    g.fillStyle = '#0f5a3a'; g.font = '700 18px "PingFang SC",sans-serif';
    g.fillText('控母 +KM', 400, 56);
  });
  const diag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.94),
    new THREE.MeshStandardMaterial({ map: diagTex, roughness: 0.65 }));
  diag.position.set(-3.2, 1.85, -ROOM.d / 2 + 0.02);
  root.add(diag);
  const diag2 = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 0.84),
    new THREE.MeshStandardMaterial({ map: diagTex, roughness: 0.65 }));
  diag2.rotation.y = Math.PI / 2;
  diag2.position.set(-ROOM.w / 2 + 0.02, 1.70, 0.34);
  root.add(diag2);
  /* ⚠️ 第 60 轮：与 kyn28 同一处轴写反 —— 见那边的长注释。
     `toolDoor` 在 x = -ROOM.w/2 + 0.44，是按「进深 0.42、正面在 +0.43」算的，
     说明原意就是「第三维 = 进深」，只是把宽度写在了第一维。 */
  const tool = rbox(0.42, 1.82, 0.90, 0.006, M.powderMid, 1);
  tool.position.set(-ROOM.w / 2 + 0.22, 0.93, 1.95);
  root.add(tool);
  const toolDoor = plate(0.84, 1.74, 0.012, M.powderLight);
  toolDoor.rotation.y = Math.PI / 2;
  toolDoor.position.set(-ROOM.w / 2 + 0.44, 0.93, 1.95);
  root.add(toolDoor);
  const pbox = rbox(0.22, 0.56, 0.46, 0.005, M.powderMid, 1);
  pbox.position.set(-ROOM.w / 2 + 0.12, 1.66, -1.55);
  root.add(pbox);

  /* 灭火器箱 + 两只灭火器（真实配电室标配，也是这一场里唯一的「非本公司陈设」）。
     ⚠️ 这里踩过一个很隐蔽的坑：`rbox(w, h, d, …)` 的三个尺寸是「宽 × 高 × 深」，
        而这只箱子是**挂右墙**的 —— 墙面在 x = +4.0，箱面朝 −x。
        原来写成 `rbox(0.46, 0.62, 0.22)`，把 460mm 的**宽度**横着伸了出去：
          · 箱子 x 跑到 [3.65, 4.11]，**戳穿右墙 110mm**；
          · 门（长在 −x 面上，x = 3.76）被整个包进箱体内部 106mm，
            只剩两端从箱侧露出来 —— 画面上就是「一块红板插在箱子里」。
        （clash_probe 报的「110×340×110 的灭火器瓶 96% 在 460×620×220 箱体内」
        也是同一处：瓶子本来该在箱**内**，原坐标却摆在箱外 70mm。）
     现在按「背面贴墙、正面朝 −x」重建：深 0.22 落在 x 上、宽 0.46 落在 z 上，
     并且做成**敞开式**（只留背板 + 两侧板 + 顶底板 + 红色踢脚条）——
     关着门的箱子等于把陈设藏起来，而敞开式在真实配电室里更常见、
     一眼就能看出「这是灭火器箱」。 */
  const EXT = { wall: ROOM.w / 2, gap: 0.02, w: 0.22, h: 0.52, d: 0.46, y: 0.29, z: 1.60 };
  const EXT_X = EXT.wall - EXT.gap;                  // 背面贴墙（留 20mm 施工缝）
  const extG = new THREE.Group();
  const extRed = new THREE.MeshStandardMaterial({ color: 0x9c2f2a, roughness: 0.5, metalness: 0.12 });
  const extBack = rbox(0.012, EXT.h, EXT.d, 0.004, M.powderMid, 1);
  extBack.position.set(-0.006, 0, 0);
  extG.add(extBack);
  for (const sz of [-1, 1]) {
    const p = rbox(EXT.w, EXT.h, 0.012, 0.004, M.powderMid, 1);
    p.position.set(-EXT.w / 2, 0, sz * (EXT.d / 2 - 0.006));
    extG.add(p);
  }
  for (const sy of [-1, 1]) {
    const p = rbox(EXT.w, 0.012, EXT.d, 0.004, M.powderMid, 1);
    p.position.set(-EXT.w / 2, sy * (EXT.h / 2 - 0.006), 0);
    extG.add(p);
  }
  // 底部红色踢脚条：消防红是配电室里唯一的高饱和色，很提神，也把「这是消防件」说清楚
  const extLip = rbox(EXT.w + 0.012, 0.06, EXT.d + 0.012, 0.004, extRed, 1);
  extLip.position.set(-EXT.w / 2, -EXT.h / 2 + 0.03, 0);
  extG.add(extLip);
  extG.position.set(EXT_X, EXT.y, EXT.z);
  root.add(extG);
  for (let i = 0; i < 2; i++) {
    const bz = EXT.z - 0.11 + i * 0.22;
    /* ⚠️ 瓶底要落在**踢脚条顶面**（EXT.y − h/2 + 0.06）上，不能落在箱底板面上 ——
       否则瓶子会从踢脚条里穿出来（clash_probe 实测插进去 60mm）。 */
    const by0 = EXT.y - EXT.h / 2 + 0.06;
    const b = cyl(0.055, 0.055, 0.34, new THREE.MeshStandardMaterial({ color: 0xa8322c, roughness: 0.44, metalness: 0.15 }), 16);
    b.position.set(EXT_X - 0.115, by0 + 0.17, bz);
    root.add(b);
    const hd = cyl(0.016, 0.016, 0.03, M.pcBlack, 12);
    hd.position.set(EXT_X - 0.115, by0 + 0.35, bz);
    root.add(hd);
  }

  // 屏前绝缘胶垫
  const imat = rbox(2.7, 0.012, 0.62, 0.004, new THREE.MeshStandardMaterial({ color: 0x1d2422, roughness: 0.86 }), 1);
  imat.position.set(0, 0.008, CZ + 0.62);
  root.add(imat);

  /* ---------- 三面直流屏 ---------- */
  /* 三面门都打开：直流屏的价值就在「柜里装了什么」，
     充电模块、蓄电池、馈线断路器都在柜内，关着门就只剩一排白板。
     门开到 ~93° 后各自占一条窄竖带，不会互相遮。 */
  const kinds = ['charge', 'feed', 'battery'];
  const cabs = [];
  kinds.forEach((k, i) => {
    const c = dcCabinet({
      open: true,
      kind: k,
      hinge: k === 'battery' ? 'right' : 'left',
    });
    c.position.set((i - 1) * (CW + GAP), 0, CZ);
    root.add(c);
    cabs.push(c);
  });
  // 屏顶小母线
  const bus = rbox(2 * (CW + GAP) + 0.1, 0.10, 0.34, 0.004, M.powderDark, 1);
  bus.position.set(0, CH + 0.05, FRONT - 0.20);
  root.add(bus);

  // 电池屏内的蓄电池组（透过打开的门可见）
  const rack = batteryRack(5, 5);
  rack.position.set(0, 0.06, 0.02);
  cabs[2].add(rack);            // 挂进柜体：爆炸视图 / 柜体位移时才跟着走
  cabs[2].userData.rack = rack;
  regElement(hotspots, 'BATT', rack, {
    off: [0, 1.24, 0.10],
    note: '电池屏 · 阀控式密封铅酸蓄电池组（通用元件）',
  });

  /* ---------- 产品安装（中间馈电屏） ---------- */
  const PLATE = 0.20;              // 安装板 z（柜局部坐标）
  const midX = 0;
  const RAIL_A = 1.96, RAIL_B = 1.72, RAIL_C = 1.44;
  /* DIN 导轨前表面 z（导轨中心 + 0.005）。产品与盲板统一按「背面贴这条线」摆，
     导轨就永远被挡住，不会横在器件脸前面。 */
  const RAIL_FRONT = PLATE + 0.024 + 0.005;

  // 安装板 + 导轨 + 走线槽
  const inner = new THREE.Group();
  inner.userData.explode = [0, 0, 0.30];
  const mp = plate(CW - 0.06, 1.05, 0.004, M.powderWhite);
  mp.position.set(0, 1.62, PLATE);
  inner.add(mp);
  for (const ry of [RAIL_A, RAIL_B, RAIL_C]) {
    const r = dinRail(0.68);
    r.position.set(0, ry, PLATE + 0.024);
    inner.add(r);
  }
  const ducts = [];
  for (const dy of [2.11, 1.84, 1.58, 1.30]) {
    const d = wireDuct(0.68, 0.05, 0.034);
    d.position.set(0, dy, PLATE + 0.024);
    inner.add(d);
    ducts.push(d);
  }
  const tr = terminalRow(30, { w: 0.0072, h: 0.05, d: 0.046 });
  tr.position.set(0, 1.20, PLATE + 0.022);
  inner.add(tr);
  // 空白模块：背面贴导轨前表面（BoxGeometry 原点在几何中心，中心 = 背面 + 半个厚度），
  // 且不再手写 taken 表——产品比槽宽（FA 96mm / RMY 75mm / YDSP 55mm），
  // 手写表只会跳过产品自己那一槽，两侧盲板会插进壳体（实测 15~25.5mm）。
  const BLANK_D = 0.078;
  const blankGeo = new THREE.BoxGeometry(0.045, 0.09, BLANK_D);
  const blankZ = RAIL_FRONT + BLANK_D / 2;
  for (const ry of [RAIL_A, RAIL_B, RAIL_C]) {
    for (let i = 0; i < 15; i++) {
      const b = new THREE.Mesh(blankGeo, M.pcGray);
      b.position.set(-0.34 + 0.0225 + i * 0.045, ry, blankZ);
      b.castShadow = true;
      b.userData.blank = true;          // 供 cullRailBlanks 识别
      inner.add(b);
    }
  }
  cabs[1].add(inner);

  function mount(id, railY, slotIndex, note) {
    const p = buildProductModel(id);
    const x = -0.34 + 0.0225 + slotIndex * 0.045;
    // 背面贴导轨前表面：panelMeter 与 dinModule 的原点约定不同，直接设 position 会差 40~55mm
    placeOnRail(p, { x, y: railY, zBack: RAIL_FRONT });
    isolateMaterials(p);
    inner.add(p);                         // 挂到馈电屏内装板，随爆炸视图一起移出
    p.userData.pid = id;
    hotspots.push(hotspot(id, p, {
      offset: [0, 0.030, 0.02],
      note,
    }));
    return p;
  }

  mount('RMY', RAIL_A, 1, '馈电屏 · 上排（合母/控母电压监视）');
  mount('RMY-T', RAIL_A, 4, '馈电屏 · 上排（检同期/备自投）');
  mount('RML', RAIL_A, 8, '馈电屏 · 上排（馈线电流监视）');
  mount('YDSP', RAIL_B, 2, '馈电屏 · 中排（柜内 24V 供电）');
  mount('DPM', RAIL_B, 6, '馈电屏 · 中排（电源冗余解耦）');
  mount('FA', RAIL_C, 3, '馈电屏 · 下排（直流系统告警）');

  /* ---------- 馈电屏里的通用元件 ----------
     真实的直流馈电屏除了继电器，还有直流断路器、熔断器、开关电源、仪表、端子排、线束。
     槽位坐标与 mount() 一致：x = -0.3175 + slot × 0.045。 */
  const slotX = (i) => -0.3175 + i * 0.045;
  mountElement(inner, hotspots, 'METER', {
    build: { w: 0.096, h: 0.048, d: 0.075 },
    x: slotX(12), y: RAIL_A, zBack: RAIL_FRONT,
    note: '馈电屏 · 上排（母线电压数显）',
  });
  mountElement(inner, hotspots, 'MCCB', {
    x: slotX(10), y: RAIL_B, zBack: RAIL_FRONT,
    note: '馈电屏 · 中排（直流馈线断路器）',
  });
  mountElement(inner, hotspots, 'MCB', {
    x: slotX(6), y: RAIL_C, zBack: RAIL_FRONT,
    note: '馈电屏 · 下排（控制回路微断）',
  });
  mountElement(inner, hotspots, 'PSU_G', {
    x: slotX(9), y: RAIL_C, zBack: RAIL_FRONT,
    note: '馈电屏 · 下排（装置 24V 开关电源）',
  });
  mountElement(inner, hotspots, 'FUSE', {
    x: slotX(12), y: RAIL_C, zBack: RAIL_FRONT,
    note: '馈电屏 · 下排（直流回路熔断器）',
  });

  /* ---- 第 50 轮：直流馈电屏下排补「可插拔继电器 + 时间继电器」 ----
     直流屏的馈线回路多、单条逻辑简单，很多项目就用可插拔小型中间继电器搭，
     比装一排专用继电器便宜、备件也统一。把这条「另一种做法」摆出来。
     ⚠️⚠️ 占位复核 —— **必须用真实宽度，不能假设「一只占一槽 45mm」**（第 50 轮踩过）：
        FA 实测 **96mm** · MCB 18mm · PSU_G 55mm · FUSE 45mm。
        RAIL_C 实际占位（slotX(i) = -0.3175 + i × 0.045）：
          FA(slot3)    [-0.2305, -0.1345]      MCB(slot6)    [-0.0565, -0.0385]
          PSU_G(slot9) [ 0.0600,  0.1150]      FUSE(slot12)  [ 0.2000,  0.2450]
        空段：[-0.34,-0.2305] 109mm · [-0.1345,-0.0565] 78mm · [-0.0385,0.060] 98mm
              · [0.115,0.200] 85mm · [0.245,0.34] 95mm。
        所以 TIME_RELAY 放 -0.2725（左段正中），两只 RELAY_PLUG 并排塞进 78mm 那段
        （-0.109 / -0.0835）：离 FA 右沿 14mm、离 MCB 左沿 17mm。
        ⚠️ 改任何一个邻居都要用**它的真实宽度**重算。 */
  mountElement(inner, hotspots, 'TIME_RELAY', {
    x: slotX(1), y: RAIL_C, zBack: RAIL_FRONT,
    note: '馈电屏 · 下排（时间继电器：直流回路延时）',
  });
  mountElement(inner, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#1', x: -0.109, y: RAIL_C, zBack: RAIL_FRONT,
    note: '馈电屏 · 下排（可插拔小型中间继电器 · 第 1 只）',
  });
  mountElement(inner, hotspots, 'RELAY_PLUG', {
    key: 'RELAY_PLUG#2', x: -0.0835, y: RAIL_C, zBack: RAIL_FRONT,
    note: '馈电屏 · 下排（可插拔小型中间继电器 · 第 2 只）',
  });
  mountElement(inner, hotspots, 'WIRE', {
    build: { count: 6, len: 0.42, r: 0.006, spread: 0.05 },
    x: -0.12, y: 1.06, z: 0.20,
    note: '馈电屏 · 屏底（屏内二次线束）',
  });
  /* 场景里本来就有端子排与走线槽，直接登记成热点即可，不必再造一份几何。 */
  regElement(hotspots, 'TERMINAL', tr, {
    off: [0, 0.035, 0.02], quiet: true, note: '馈电屏 · 屏底（二次端子排）',
  });
  regElement(hotspots, 'DUCT', ducts[0], {
    off: [0, 0.035, 0.02], quiet: true, note: '馈电屏 · 屏内顶部（走线槽）',
  });

  // 产品挂完后清掉被它们压住的盲板。数量记到 root 上，回归脚本可断言避让生效。
  root.userData.blankCulled = cullRailBlanks(inner);

  /* ---------- 充电屏内装板（高频开关电源模块 + 交流进线开关） ----------
     ⚠️ 安装板原来放在 z=0.20，而柜前表面在 z=0.30 —— 只剩 100mm，
     深 110mm 的 YDSP 必然顶穿柜门（clip_test 因为门属「大件」而漏报）。
     整排一起后移到 0.10，模块前脸最远到 0.21，门内留 90mm 余量。 */
  const chPlate = 0.10;
  const chInner = new THREE.Group();
  chInner.userData.explode = [0, 0, 0.30];
  const cmp = plate(CW - 0.06, 1.05, 0.004, M.powderWhite);
  cmp.position.set(0, 1.58, chPlate);
  chInner.add(cmp);
  for (let i = 0; i < 3; i++) {
    const m = buildProductModel('YDSP');
    m.position.set(-0.22 + i * 0.075, 1.86, chPlate + 0.058);
    m.rotation.y = 0;
    /* 这三只是「柜内备用位」，不参与点击，所以**不隔离材质** ——
       隔离会让每只模块带一套独立材质 uuid，批处理合不起来，白白多出十几个 draw call。 */
    chInner.add(m);
  }
  /* 充电模块：真实直流屏的核心部件，一只 10~20A 的模块对应一段电池组 */
  mountElement(chInner, hotspots, 'CHARGER', {
    build: { w: 0.44, h: 0.13, d: 0.16 }, x: 0, y: 1.60, zBack: chPlate,
    note: '充电屏 · 高频开关充电模块（外购）',
  });
  mountElement(chInner, hotspots, 'CHARGER', {
    key: 'CHARGER#2',
    build: { w: 0.44, h: 0.13, d: 0.16 }, x: 0, y: 1.44, zBack: chPlate,
    note: '充电屏 · 高频开关充电模块（外购）',
  });
  /* 交流进线断路器 + 交流侧熔断器 */
  mountElement(chInner, hotspots, 'MCCB', {
    key: 'MCCB#2',
    x: -0.24, y: 1.16, zBack: chPlate, note: '充电屏 · 交流进线断路器',
  });
  mountElement(chInner, hotspots, 'FUSE', {
    key: 'FUSE#2',
    build: { poles: 3 }, x: 0.02, y: 1.16, zBack: chPlate,
    note: '充电屏 · 交流进线熔断器',
  });
  mountElement(chInner, hotspots, 'METER', {
    key: 'METER#2',
    build: { w: 0.096, h: 0.048, d: 0.075 }, x: 0.26, y: 1.16, zBack: chPlate,
    note: '充电屏 · 充电电流数显',
  });
  cabs[0].add(chInner);

  /* ---------- 电池屏内：电池总开关 + 熔断器 + 数显 ----------
     装在电池架**上方**（架顶 y≈1.46），别和架体抢空间。 */
  const batInner = new THREE.Group();
  batInner.userData.explode = [0, 0, 0.30];
  const bmp = plate(CW - 0.06, 0.34, 0.004, M.powderWhite);
  bmp.position.set(0, 1.72, -0.10);
  batInner.add(bmp);
  mountElement(batInner, hotspots, 'MCCB', {
    key: 'MCCB#3',
    x: -0.24, y: 1.74, zBack: -0.10, note: '电池屏 · 电池组总开关',
  });
  mountElement(batInner, hotspots, 'FUSE', {
    key: 'FUSE#3',
    build: { poles: 3 }, x: 0.0, y: 1.74, zBack: -0.10, note: '电池屏 · 电池组熔断器',
  });
  mountElement(batInner, hotspots, 'METER', {
    key: 'METER#3',
    build: { w: 0.096, h: 0.048, d: 0.075 }, x: 0.26, y: 1.74, zBack: -0.10,
    note: '电池屏 · 电池电压/电流数显',
  });
  cabs[2].add(batInner);

  return {
    root,
    hotspots,
    env: 'indoor',
    exposure: 0.96,
    fog: { color: 0x1a2129, near: 6, far: 32 },
    fov: 48,
    /* 默认机位几乎正面（方位角 ~13°）：三面屏的门都开着，且都朝观察者方向伸出 0.39m，
       斜角一大，门板就从「一条窄边」变成「一块挡板」，正好把柜内挡掉。
       正面机位才能同时看到充电模块、蓄电池架和馈电回路。 */
    camera: { pos: [0.62, 1.86, 2.60], target: [0, 1.44, -0.55] },
    /* ---------- 自适应取景盒 ----------
       户内用 fov 模式（机位与注视点不动，只在窄舞台撑大视场角）。
       盒取「三面屏柜本体」：门全开时门板朝观察者伸出 0.39m，所以 z 上限取 −0.20；
       柜前绝缘垫与柜体底面（y < 0.30 的基础段）不列 —— 它们横跨到相机脚下，
       全框进来会把 fov 撑到 65°+。实测（舞台宽高比 0.90~1.25）：宽屏 48.9°（原写死 48°，
       几乎不动），aspect 0.943 需 52.9°、0.90 需 55.0°、0.807 需 60.3°。 */
    fit: {
      mode: 'fov',
      fovMax: 62,
      parts: [
        [-1.22, 0.30, -1.21, 1.22, 2.28, -0.20],
      ],
    },
    /* ⚠️ 这里**故意不写 minAz / maxAz** —— 「镜头自由」：
       墙/天花/地面都是单面板（法线朝内），相机绕到墙外时被背面剔除，
       直接看进室内；加了方位角限位反而把「绕到背后看一眼」禁掉。
       极角仍然限位：minPol 允许俯视，maxPol 压住别钻到地面以下。 */
    limits: { minPol: 0.05, maxPol: Math.PI * 0.545, minD: 0.06, maxD: 11.0 },
    lights: [
      { type: 'hemi', sky: 0xc6d9ea, ground: 0x5b636a, intensity: 0.64 },
      { type: 'ambient', color: 0x7e93a3, intensity: 0.24 },
      { type: 'spot', color: 0xeaf4ff, intensity: 26, distance: 13, angle: 0.95, penumbra: 0.92, decay: 2, pos: [1.5, 3.10, 1.4], target: [0, 1.30, -0.70], shadow: true },
      { type: 'spot', color: 0xdfeaf8, intensity: 14, distance: 13, angle: 1.05, penumbra: 1.0, decay: 2, pos: [-2.4, 3.00, 1.0], target: [0, 1.15, -0.80], shadow: false },
      { type: 'spot', color: 0xcddcea, intensity: 8, distance: 11, angle: 1.0, penumbra: 1.0, decay: 2, pos: [3.0, 2.90, -0.6], target: [0, 1.40, -0.80], shadow: false },
      { type: 'dir', color: 0xb4c8d8, intensity: 0.36, pos: [-3.0, 2.4, 4.0], target: [0, 1.2, -0.6] },
    ],
  };
}
