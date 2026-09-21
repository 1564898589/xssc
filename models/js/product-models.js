/**
 * product-models.js —— 产品「结构与安装关系示意模型」库
 *
 * ⚠️ 定位（务必遵守）：
 *   本文件产出的是**示意模型**，用于让销售快速识别产品类别与型号、
 *   看懂产品在设备中的安装位置、理解主要部件之间的相对关系。
 *   它**不是**真实产品模型，不追求实物级还原。
 *
 * 依据边界（只做这些）：
 *   · 外形轮廓、分面关系、配色、按键/端子/指示灯/面板的**位置与数量**，
 *     取自《华用产品资料》各说明书插图与结构示意图；
 *   · 型号写法取自说明书封面与现行价格表；
 *   · 未在插图中出现的内部结构、真实尺寸公差、制造工艺一律不推断、不补写；
 *   · 数码管一律显示手册插图里的通用段码图形，**不代表任何真实测量值或参数**。
 *
 * 尺寸说明：这里的 w/h/d 是为「安装关系可读」而设的示意尺寸，用于保证产品之间、
 * 产品与柜体之间的比例协调，**不是**说明书结构尺寸，不得作为选型或安装依据。
 *
 * 资料不足的部位一律用简化几何体（方盒 / 圆柱 / 薄板）代替，不做臆造。
 *
 * ⚠️ 面板丝印纪律（踩过坑，务必遵守）：
 *   规格表里的 leds 标签、termNote（端子功能丝印）、termNums（端子号）、title（型号）
 *   一律**逐字对照说明书原文**照抄 —— 说明书印英文就写英文（如 RUN/SET/ACT/ERR），
 *   印中文就写中文（如 电源/合闸/分闸）。
 *   **查不到的字段一律留空，绝不按同族产品推测、绝不用"看起来合理"的值填。**
 *   已经因此改掉过三处编造：RMY-T/RML 的「220VC」与端子号、RN-DK 的指示灯、THC 的型号。
 */
import * as THREE from 'three';
import { M } from './mats.js';
import {
  wedgeModule, rbox, plate, cyl, bar, grp, at,
  labelTex, screenTex, nameplateTex,
} from './parts.js';
import { canvasTex } from './util.js';

/* ============================================================
 * 导轨模块示意规格表
 *   w/h/d  示意外形尺寸（米）—— 仅用于保证场景内比例协调，非结构尺寸
 *   tc     前立面端子块位数（示意，按宽度推算）
 *   leds   [颜色, 丝印标签?] —— 标签只在说明书插图中逐字可辨时才写
 *   rows   数码管行数与位数（取自插图），文字一律用通用段码图形
 *   btn    斜面按键数（取自插图；同族无插图的产品按通用 4 键简化）
 *   cover  带罩继电器（只画一圈边框示意，不铺透明盖板）
 * 单位丝印（V / A / ℃ / s / %RH）由产品类别本身决定，不是手册里的参数值。
 * ============================================================ */
const G = '#35e08a', R = '#ff4d3d', A = '#ffb648', B = '#49b6ff';

/* 通用段码图形：手册结构图里就是用全 8 表示的，不代表真实数值 */
const D4 = '8888', D3 = '888';

const RELAY = {
  /* ---- 中间继电器（插图：带罩，仅指示灯） ---- */
  RC: { w: 0.045, h: 0.078, d: 0.072, tc: 8, btn: 0, cover: true,
        kind: '中间继电器', leds: [[G], [R]] },
  RAI: { w: 0.045, h: 0.078, d: 0.072, tc: 8, btn: 0,
         kind: '抗干扰继电器', leds: [[G], [B]] },
  RDP: { w: 0.045, h: 0.090, d: 0.072, tc: 10, btn: 2,
         kind: '双位置继电器', leds: [[G], [R]] },

  /* ---- 量度继电器 ----
   * RMY-T 有说明书可依，面板丝印逐字照抄；
   * RMY 没有独立说明书，**不按兄弟产品推测**，所以只画指示灯色点、不写丝印标签。 */
  RMY: { w: 0.075, h: 0.090, d: 0.072, tc: 12, btn: 4,
         kind: '交流电压继电器',
         leds: [[G], [G], [R], [R]],
         rows: [{ text: D4, unit: 'V', color: R },
                { text: D4, unit: 'V', color: G }] },
  /* RMY-T 说明书 p80：指示灯 RUN/SET/ACT/ERR，数码管上排红(系统侧电压)、
     下排绿(待并侧电压)，四键；端子定义表 1=L 2=N 3=L1 4=N1 5=L2 6=N2 7=7+ 8=8- 11=COM1 12=NC1 13=NO1 */
  'RMY-T': { w: 0.075, h: 0.090, d: 0.072, tc: 12, btn: 4,
         kind: '同步检查继电器', title: 'RMY-T',
         leds: [[G, 'RUN'], [G, 'SET'], [R, 'ACT'], [R, 'ERR']],
         rows: [{ text: D4, unit: 'V', color: R },
                { text: D4, unit: 'V', color: G }],
         termNote: 'L N | L1 N1 | L2 N2 | 7+ 8-',
         termNums: '1|2|3|4|5|6|7|8|11|12|13|14' },
  /* RML 说明书 p87/p89：面板左上型号丝印、上排端子号 12 11 14 22 21 24 32 31 34 + 58 59 60，
     面板下缘功能丝印 IA IAN / IB IBN / IC ICN / L N；指示灯同 RUN/SET/ACT/ERR */
  RML: { w: 0.075, h: 0.090, d: 0.072, tc: 12, btn: 4,
         kind: '交流电流继电器', title: 'RML-310A-G-S',
         leds: [[G, 'RUN'], [G, 'SET'], [R, 'ACT'], [R, 'ERR']],
         rows: [{ text: '8888 8888', unit: 'A', color: R },
                { text: '8888 8888', unit: 'A', color: G }],
         termNote: 'IA IAN | IB IBN | IC ICN | L N',
         termNums: '12|11|14|22|21|24|32|31|34|58|59|60' },

  /* ---- 断路器保护 ---- */
  'RL-TBJ': { w: 0.045, h: 0.090, d: 0.072, tc: 8, btn: 0, cover: true,
         kind: '防跳继电器', leds: [[G], [R]] },
  'RL-THW': { w: 0.045, h: 0.090, d: 0.072, tc: 8, btn: 0,
         kind: '位置监视继电器', leds: [[G], [R]] },
  'RN-FB': { w: 0.090, h: 0.090, d: 0.072, tc: 14, btn: 3,
         kind: '非全相保护继电器', leds: [[G], [R], [A]],
         rows: [{ text: D4, unit: 's', color: G }] },
  'RN-FT': { w: 0.090, h: 0.090, d: 0.072, tc: 14, btn: 3,
         kind: '防跳及低气压闭锁继电器', leds: [[G], [A], [R]],
         rows: [{ text: D4, color: B }] },
  /* RN-DK 说明书 p1 实物图：斜面左侧四个指示灯（电源·绿 / 电机运行·红 / 合闸·红 / 分闸·红），
     右上斜排四个蓝键，斜面右缘端子号 81~92，斜面上缘另有相序丝印。 */
  'RN-DK': { w: 0.135, h: 0.090, d: 0.072, tc: 20, btn: 4, btnColor: 'blue',
         kind: '刀闸机构控制模块', title: 'RN-DK-A',
         leds: [[G, '电源'], [R, '电机运行'], [R, '合闸'], [R, '分闸']],
         rows: [{ text: D4, unit: 'A', color: R }, { text: D4, color: G }],
         termNums: '81|82|83|84|85|86|87|88|89|90|91|92' },
  RVS: { w: 0.090, h: 0.090, d: 0.072, tc: 14, btn: 2,
         kind: '电源切换继电器', leds: [[G], [G], [A]] },
  RT: { w: 0.045, h: 0.090, d: 0.072, tc: 8, btn: 2,
         kind: '时间继电器', leds: [[G], [R]],
         rows: [{ text: D4, unit: 's', color: A }] },

  /* ---- 变送器 ---- */
  TE: { w: 0.045, h: 0.090, d: 0.072, tc: 10, btn: 4,
         kind: '电量变送器', title: 'TE-A',
         leds: [[G], [G], [R], [R]],
         rows: [{ text: D4, unit: 'V', color: R },
                { text: D4, unit: 'A', color: G }] },
  /* TS 说明书 p2：三个指示灯 RUN/SET/ERR，两排 4 位数码管（上红 t、下绿实时温度 ℃），
     四键；上端子号 58 59（A⁺B⁻），下端子 1 2 5 6 7 8 */
  TS: { w: 0.0225, h: 0.090, d: 0.072, tc: 6, btn: 4,
         kind: '温度变送器', title: 'TS-I-S',
         leds: [[G, 'RUN'], [G, 'SET'], [R, 'ERR']],
         rows: [{ text: D4, unit: '℃', color: R },
                { text: D4, unit: '℃', color: G }],
         termNote: 'A+ B-',
         termNums: '58|59' },
  THS: { w: 0.0225, h: 0.090, d: 0.072, tc: 4, btn: 4,
         kind: '温湿度变送器',
         leds: [[G], [R]],
         rows: [{ text: D4, unit: '℃', color: R },
                { text: D4, unit: '%RH', color: G }] },
  TG: { w: 0.0225, h: 0.090, d: 0.072, tc: 4, btn: 2,
         kind: '挡位变送器',
         leds: [[G], [A]],
         rows: [{ text: '88', unit: '挡', color: A }] },
  SS: { w: 0.0125, h: 0.090, d: 0.072, tc: 4, btn: 0,
         kind: '信号变送器', title: 'SS-2',
         leds: [[G], [A]] },

  /* ---- 温控（THC 说明书「显示与按键」页丝印逐字可辨，照录） ---- */
  THC: { w: 0.090, h: 0.090, d: 0.072, tc: 14, btn: 4,
         kind: '温湿度控制器', title: 'THC-A-1-X',
         /* RUN 运行(绿) / ERR 故障(红) / HEAT 加热器动作(红) / FAN 风扇动作(红) */
         leds: [[G, 'RUN'], [R, 'ERR'], [R, 'HEAT'], [R, 'FAN']],
         /* 上排红色显示实时温度，下排绿色显示实时湿度 */
         rows: [{ text: D4, unit: '℃', color: R },
                { text: D4, unit: '%RH', color: G }],
         termNums: '12|11|14|22|21|24|58|59' },
  TC: { w: 0.045, h: 0.090, d: 0.072, tc: 8, btn: 4,
         kind: '温度控制器', title: 'TC-P',
         leds: [[G], [R], [A]],
         rows: [{ text: D4, unit: '℃', color: A }] },
  TCC: { w: 0.045, h: 0.090, d: 0.072, tc: 8, btn: 2,
         kind: '风机报警器', leds: [[G], [R]] },
  TK: { w: 0.045, h: 0.090, d: 0.072, tc: 8, btn: 2,
         kind: '热电偶采集器', leds: [[G], [R]],
         rows: [{ text: D4, unit: '℃', color: R }] },

  /* ---- 电源配件 ---- */
  DPM: { w: 0.045, h: 0.090, d: 0.060, tc: 4, btn: 0,
         kind: '二极管冗余模块', bodyMat: 'silver', leds: [[G], [G]] },

  /* ---- 兜底：只画一个通用导轨模块，不编造任何型号细节 ---- */
  _default: { w: 0.045, h: 0.090, d: 0.072, tc: 8, btn: 0,
              kind: '导轨模块', leds: [[G]] },
};

/** 按规格表生成一台示意模块；over 可覆盖任意字段 */
function relayModule(id, over = {}) {
  const s = { ...(RELAY[id] || RELAY._default), ...over };
  const title = s.title || id;
  return wedgeModule({
    w: s.w, h: s.h, d: s.d,
    bodyMat: s.bodyMat === 'silver' ? M.relayBodySilver : M.relayBody,
    panel: {
      title,
      note: '南京华用电气有限公司',
      note2: 'www.sinouse.com',
      brandLine: 'NANJING SINOUSE ELECTRIC CO., LTD',
      leds: (s.leds || []).map(([c, l]) => ({ c, l })),
      rows: s.rows || null,
      termNote: s.termNote,
      termNums: s.termNums,
      buttons: s.btn || 0,
      btnColor: s.btnColor,
    },
    termCount: s.tc,
    side: title,
    sideSub: s.kind || '',
    clearCover: !!s.cover,
  });
}

/* ------------------------------------------------------------
 * 面板嵌入式表头（干变温控器 DTC / 信号报警器 FA）
 * 这两款是装在柜门上的方形表头，不是导轨模块，保持独立外形。
 * 灯窗阵列与数码管均为示意排布。
 * ---------------------------------------------------------- */
function panelMeter(o = {}) {
  const {
    w = 0.096, h = 0.096, d = 0.105,
    bodyMat = M.pcDark, bezelMat = M.pcBlack,
    title = '', sub = '',
    lampGrid = null,        // {cols, rows, colors[]}
    display = null,         // {rows:[], color}
    buttons = 0,
    accent = '#0f5a3a',
  } = o;

  const g = new THREE.Group();
  const r = 0.004;

  /* 后壳 */
  const body = rbox(w, h, d, r, bodyMat, 2);
  body.position.z = -d / 2 + 0.004;
  g.add(body);

  /* 前面板（深色玻璃感） */
  const face = plate(w, h, 0.006, bezelMat, 0.003);
  face.position.z = 0.002;
  g.add(face);

  /* 面板内区 */
  const inner = plate(w - 0.018, h - 0.018, 0.002, M.pcBlack);
  inner.position.z = 0.0055;
  g.add(inner);

  let yTop = h / 2 - 0.016;

  /* 顶部丝印标题 */
  if (title) {
    const t = canvasTex(384, 48, (gg) => {
      gg.clearRect(0, 0, 384, 48);
      gg.fillStyle = '#dfe6e2';
      gg.font = '700 24px "PingFang SC","Microsoft YaHei",sans-serif';
      gg.textBaseline = 'middle'; gg.textAlign = 'left';
      gg.fillText(title, 6, 26);
      if (sub) {
        gg.fillStyle = 'rgba(200,220,210,.6)';
        gg.font = '600 18px "SF Mono",Consolas,monospace';
        gg.textAlign = 'right';
        gg.fillText(sub, 378, 26);
      }
    });
    const tm = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.024, 0.011),
      new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.5 }));
    tm.position.set(0, yTop, 0.0068);
    g.add(tm);
    yTop -= 0.014;
  }

  /* 灯窗阵列（光字牌） */
  if (lampGrid) {
    const { cols = 4, rows = 2, colors = [] } = lampGrid;
    const cw = (w - 0.026) / cols, ch = 0.013;
    const lampMats = colors.map(c => c === 'red' ? M.ledRed : c === 'amber' ? M.ledAmber
      : c === 'blue' ? M.ledBlue : c === 'off' ? M.pcBlack : M.ledGreen);
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const idx = j * cols + i;
        const cell = plate(cw * 0.82, ch * 0.74, 0.0018, M.pcBlack, 0.001);
        cell.position.set(-w / 2 + 0.013 + cw * (i + 0.5), yTop - ch * 0.5 - ch * j, 0.0068);
        g.add(cell);
        const mat = lampMats[idx % Math.max(1, lampMats.length)] || M.ledGreen;
        const lamp = plate(cw * 0.62, ch * 0.46, 0.0012, mat, 0.001);
        lamp.position.set(cell.position.x, cell.position.y, 0.0082);
        g.add(lamp);
      }
  }

  /* 数码管（示意段码，非真实测量值） */
  if (display) {
    const t = screenTex(display.text || '', {
      color: display.color || '#ff9d4d', w: 320, h: 120, rows: display.rows || null,
    });
    const dm = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.03, 0.026),
      new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.3 }));
    /* ⚠️ 边框 bez 厚 2mm、中心若放在 0.006，z 范围就是 [0.005, 0.007] ——
       会把 z=0.0068 的段码贴图**整个包在里面**，DTC 的显示窗就变成一块纯黑。
       边框压到 0.0055、贴图抬到 0.0074，留 0.0009 的余量。 */
    dm.position.set(0, yTop - 0.017, 0.0074);
    g.add(dm);
    const bez = plate(w - 0.024, 0.032, 0.002, M.pcBlack);
    bez.position.set(0, dm.position.y, 0.0055);
    g.add(bez);
    yTop -= 0.038;
  }

  /* 按键 */
  if (buttons > 0) {
    const bw = Math.min(0.016, (w - 0.03) / buttons);
    for (let i = 0; i < buttons; i++) {
      const b = cyl(bw * 0.42, bw * 0.42, 0.004, M.pcGray, 14);
      b.rotation.x = Math.PI / 2;
      b.position.set(-w / 2 + 0.015 + (w - 0.03) * (buttons > 1 ? i / (buttons - 1) : 0.5), yTop - 0.012, 0.005);
      g.add(b);
    }
  }

  /* 品牌条 */
  const bt = canvasTex(160, 28, (gg) => {
    gg.clearRect(0, 0, 160, 28);
    gg.fillStyle = accent; gg.fillRect(0, 6, 4, 16);
    gg.fillStyle = 'rgba(220,235,228,.85)';
    gg.font = '700 17px "PingFang SC",sans-serif';
    gg.textBaseline = 'middle';
    gg.fillText('sinouse', 12, 15);
  });
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(0.030, 0.0055),
    new THREE.MeshStandardMaterial({ map: bt, transparent: true, roughness: 0.5 }));
  bm.position.set(0, -h / 2 + 0.010, 0.0068);
  g.add(bm);

  g.userData.size = [w, h, d];
  return g;
}

/* ------------------------------------------------------------
 * 开关电源（金属壳 + 散热格栅，示意）
 * ---------------------------------------------------------- */
function psuModule(o = {}) {
  const { w = 0.055, h = 0.09, d = 0.11 } = o;
  const g = new THREE.Group();
  const shell = rbox(w, h, d, 0.002, M.alu, 1);
  g.add(shell);
  // 顶/底格栅
  for (const sy of [1, -1]) {
    const gm = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, d * 0.62), M.perf);
    gm.rotation.x = sy * Math.PI / 2;
    gm.position.set(0, sy * (h / 2 + 0.0006), 0);
    g.add(gm);
  }
  // 前脸
  const face = plate(w * 0.9, h * 0.9, 0.002, M.pcDark);
  face.position.z = d / 2 + 0.001;
  g.add(face);
  const lt = labelTex('YDSP', '开关电源', { w: 256, h: 80, bg: '#1b1f22', fg: '#e6ece8', subFg: '#8fa79a', align: 'left', accent: '#3fb983', border: false });
  const lm = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, 0.014),
    new THREE.MeshStandardMaterial({ map: lt, roughness: 0.55 }));
  lm.position.set(0, -h * 0.20, d / 2 + 0.0026);
  g.add(lm);
  const led = cyl(0.0022, 0.0022, 0.0018, M.ledGreen, 12);
  led.rotation.x = Math.PI / 2; led.position.set(w * 0.28, h * 0.30, d / 2 + 0.0026);
  g.add(led);
  // 端子
  for (let i = 0; i < 3; i++) {
    const tb = bar(0.008, 0.008, 0.008, M.pcDark);
    tb.position.set(-w * 0.3 + i * 0.011, h / 2 - 0.006, d / 2 - 0.008);
    g.add(tb);
  }
  g.userData.size = [w, h, d];
  return g;
}

/* ------------------------------------------------------------
 * 控制变压器（示意：铁芯 + 绕组 + 底座）
 * ---------------------------------------------------------- */
function xfModule() {
  const g = new THREE.Group();
  const core = rbox(0.10, 0.10, 0.05, 0.002, M.aluDark, 1);
  g.add(core);
  const c1 = cyl(0.032, 0.032, 0.055, M.copper, 20); c1.rotation.z = Math.PI / 2; c1.position.set(-0.018, 0, 0.038); g.add(c1);
  const c2 = c1.clone(); c2.position.set(0.018, 0, 0.038); g.add(c2);
  const base = plate(0.11, 0.10, 0.008, M.pcBeige); base.rotation.x = Math.PI / 2; base.position.y = -0.052; g.add(base);
  for (let i = 0; i < 4; i++) {
    const t = bar(0.012, 0.008, 0.006, M.pcDark);
    t.position.set(-0.045 + i * 0.030, 0.056, 0);
    g.add(t);
  }
  g.userData.size = [0.12, 0.12, 0.11];
  return g;
}

/* ------------------------------------------------------------
 * 主入口：按产品 id 生成示意模型
 * ---------------------------------------------------------- */
export function buildProductModel(id) {
  switch (id) {
    case 'DTC':
      /* DTC-P 说明书「结构尺寸」页：面板左侧一位小数码管（显示设定温度），
         右侧四位数码管（显示实时温度），单位 ℃。 */
      return panelMeter({
        w: 0.096, h: 0.096, d: 0.10,
        title: 'DTC-P', sub: '干变温控',
        /* 段码宽度要跟 320×120 的贴图画布对得上（等宽字体 82px ≈ 每字符 49px，
           320px 最多放 6 个字符），写太长会被裁掉。 */
        display: { rows: ['8 8888'], color: '#ff9d4d' },
        buttons: 4,
        accent: '#b45309',
      });

    case 'FA':
      return panelMeter({
        w: 0.096, h: 0.096, d: 0.11,
        title: 'FA 信号报警器', sub: 'FA32',
        lampGrid: {
          cols: 4, rows: 3,
          colors: ['red', 'off', 'amber', 'off', 'green', 'off', 'amber', 'off', 'off', 'green', 'off', 'red'],
        },
        buttons: 3,
        accent: '#b3352c',
      });

    case 'YDSP': return psuModule({ w: 0.055, h: 0.09, d: 0.11 });
    case 'XF': return xfModule();

    default:
      return relayModule(id);
  }
}

/** 把模型包一层：居中 + 归一化朝向（供详情视口用） */
export function buildShowcaseModel(id) {
  const m = buildProductModel(id);
  const box = new THREE.Box3().setFromObject(m);
  const size = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  const wrap = new THREE.Group();
  m.position.sub(center);
  wrap.add(m);
  wrap.userData.size = [size.x, size.y, size.z];
  wrap.userData.radius = Math.max(size.x, size.y, size.z) * 0.5;
  return wrap;
}
