/**
 * app.js —— 交互式场景演示主程序
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { PRODUCTS, SCENES, SCENE_BY_ID, GENERIC, ORIGIN, ORIGIN_ORDER, SCENE_DISCLAIMER,
  ALTERNATIVES, elementById } from './data.js';
import { getEnvMap, markerTex, ringTex } from './scene-kit.js';
import { setClearcoat } from './mats.js';
import { Tweens, easeInOutQuint, clamp, lerp, FAM_COLOR } from './util.js';
import { ProductViewer } from './viewer.js';
import { QUESTIONS, TAGS, recommend, reasonOf, whyNot, summaryText } from './advisor.js';
/* 「为什么这样选」内容层。**跨模块符号必须同改 import** —— 只写调用不写 import 时
   `node --check` 查不出来、页面 `pageerror` 也是 0，表现是「场景一直转圈」（§V）。 */
import { GUIDES, EV_LABEL } from './guide.js';
import { batchStatic } from './optimize.js';
import * as kyn28 from './scenes/kyn28.js';
import * as dcpanel from './scenes/dcpanel.js';
import * as assembly from './scenes/assembly.js';
import * as boxsub from './scenes/boxsub.js';
import * as rmu from './scenes/rmu.js';
import * as gis from './scenes/gis.js';
import * as ess from './scenes/ess.js';
import * as pv from './scenes/pv.js';
import * as wind from './scenes/wind.js';

/* 窄屏断点。⚠️ 必须与 `css/style.css` 里 `@media (max-width:1120px)` 保持一致 ——
   这个断点以下 `#sidebar` 整块 `display:none`，顶栏的场景名就成了**唯一**的
   场景切换入口（见 renderSceneList / openSceneMenu / syncSceneDrop）。
   ⚠️ 为什么用 `matchMedia` 而不是读 summary 的 computed `pointer-events`：
   后者虽然「与 CSS 同源」，但它**有时序问题** —— `resize` 事件触发时，媒体查询
   可能还没落到 computed 上（实测软渲染下要 ~900ms），于是 `tabIndex` 会被写成
   过期的值，而且**此后再也不会更新**（`ui46_probe` 的 ⑧a2 抓到的就是这个）。
   `matchMedia(...).matches` 是**同步**的，任何时刻都对。
   两边的一致性由 `ui46_probe` 的 ④a3 / ⑧a3（caret 显隐）断言守着。 */
const NARROW_MQ = '(max-width: 1120px)';

/**
 * 家族语义图标（第 47 轮）。
 * ⚠️ 用**内联 SVG**、不用 emoji：emoji 的渲染结果由系统字体决定（Windows 上是彩色
 *    的 Segoe UI Emoji），既跟界面的线性风格不搭，也没法用 `currentColor` 跟着品牌色走。
 * ⚠️ 一律 `fill="none"` + `stroke="currentColor"`：颜色交给 CSS（`.adv-grp-ico{color}`）。
 * ⚠️ viewBox 固定 `0 0 14 14`，尺寸由 CSS 给 —— 换字号时不用改图。
 */
const FAM_ICON = {
  /* 继电器：触点 + 动臂 */
  '继电器': '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" '
    + 'stroke-width="1.5" stroke-linecap="round"><circle cx="3" cy="9.6" r="1.1"/>'
    + '<circle cx="11" cy="9.6" r="1.1"/><path d="M4.2 9.6h2"/><path d="M7.8 9.6h2"/>'
    + '<path d="M5.4 9.4l3-4.4"/><path d="M8.4 3.4h2.4"/></svg>',
  /* 变送器：方框 + 穿过它的信号波 */
  '变送器': '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" '
    + 'stroke-width="1.5" stroke-linecap="round"><rect x="2" y="4.2" width="10" height="5.6" rx="1.2"/>'
    + '<path d="M3.6 7c1.1-1.9 2.1-1.9 3.2 0s2.1 1.9 3.2 0"/></svg>',
  /* 温控：温度计 */
  '温控': '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" '
    + 'stroke-width="1.5" stroke-linecap="round"><path d="M6.2 8.2V3.1a1.3 1.3 0 0 1 2.6 0v5.1"/>'
    + '<circle cx="7.5" cy="10" r="2.1"/><path d="M10.4 4.2h1.6M10.4 6.6h1.1"/></svg>',
  /* 电源：直流电源（长/短线组） */
  '电源': '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" '
    + 'stroke-width="1.5" stroke-linecap="round"><path d="M2.2 5.6h6M2.2 8.4h6"/>'
    + '<path d="M10.6 5.6h1.2M11.2 5.6v2.8M10.6 8.4h1.2"/></svg>',
  /* 报警：铃 */
  '报警': '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" '
    + 'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M7 2.4a3.5 3.5 0 0 0-3.5 3.5c0 3-1.2 3.7-1.2 3.7h9.4s-1.2-.7-1.2-3.7A3.5 3.5 0 0 0 7 2.4z"/>'
    + '<path d="M5.8 11.3a1.3 1.3 0 0 0 2.4 0"/></svg>',
  /* 兜底：一个中性圆点，别用「问号」——那读起来像报错 */
  '其他': '<svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" '
    + 'stroke-width="1.5"><circle cx="7" cy="7" r="4.4"/></svg>',
};

const BUILDERS = {
  kyn28: () => kyn28.build(),
  dcpanel: () => dcpanel.build(),
  assembly: () => assembly.build(),
  boxsub: () => boxsub.build(),
  rmu: () => rmu.build(),
  gis: () => gis.build(),
  ess: () => ess.build(),
  pv: () => pv.build(),
  wind: () => wind.build(),
};

/* ============================================================
 * 隐形拾取代理
 *
 * 为什么需要它：batchStatic 会把通用元件里的 Mesh 按材质合并进大网格，并把原 Mesh
 * 从元件的 Group 里摘掉 —— 那个 Group 就成了空壳。raycast 打上去一个交点都没有，
 * 于是「其他元件也要可以点击查看名称、作用和在柜体中的位置」这条要求直接失效。
 *
 * 代理是一个 visible=false 的包围盒：
 *   · 渲染器 projectObject 第一行就是 `if (visible === false) return` → 0 draw call，
 *     batchScope 也只收可见 Mesh，所以它既不会被画、也不会被合并；
 *   · 而 Raycaster 的 intersectObject **不看 visible**（只测 layers），照样能命中。
 * 代理挂在元件 Group 下面，爆炸视图 / 柜体位移都跟着一起走。
 * ============================================================ */
const proxyPickMat = new THREE.MeshBasicMaterial({ visible: false });
proxyPickMat.userData.shared = true;   // 场景卸载时不要被 disposeTree 释放

/* ============================================================
 * 「减少动效」偏好（prefers-reduced-motion: reduce）
 * ------------------------------------------------------------
 * 这一页原本**完全没读**这个偏好：相机飞行、柜门阻尼、爆炸展开、定位光圈
 * 全是固定时长，用户在系统里把动效关掉了，这里照动不误。
 *
 * ⚠️ 处理原则是「**减弱**」而不是「取消」：门该开还得开、爆炸该展开还得展开，
 *    只是把「补间动画」换成「瞬时到位」。全取消 = 功能失效，那是另一个 bug。
 * ⚠️ 唯一的例外是定位光圈：它纯属「我点中了这里」的反馈、不承载任何状态，
 *    压到 0.8s 淡出即可 —— 但**不能不给**，否则用户不知道点没点中。
 * ⚠️ 做成模块级 `let` + `matchMedia` 监听：用户在系统设置里改完**不用刷新页面**。
 *    变化时同时派发 `rm-change` 事件，让 App 去同步那些「只在初始化时设一次」的量
 *    （OrbitControls 的阻尼与自转速度）。
 * ============================================================ */
const RMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
let RM = RMQ.matches;
const _applyRM = (on) => {
  RM = on;
  document.documentElement.classList.toggle('reduce-motion', on);
  document.dispatchEvent(new CustomEvent('rm-change', { detail: { on } }));
};
_applyRM(RMQ.matches);
/* 老 Safari 只有 addListener，没有 addEventListener */
if (RMQ.addEventListener) RMQ.addEventListener('change', (e) => _applyRM(e.matches));
else if (RMQ.addListener) RMQ.addListener((e) => _applyRM(e.matches));

/* ============================================================
 * 移动端守卫
 * ============================================================ */
function isSmallScreen() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) < 620;
  return narrow || (coarse && window.innerWidth < 1024);
}

/**
 * 卡片里的「模型表达了哪些部件」——只列示意模型**确实画出来**的部件，
 * 目的是让销售对得上产品，不涉及内部结构、不涉及技术参数。
 * 未在手册插图中出现的内部构造一律不写。
 */
/**
 * 元件取色：本公司产品按家族色，通用元件 / 其他厂商设备按「来源分类」色。
 * 场景里两类元件混在一起，颜色是让用户一眼分清「这是我们的产品还是外购件」的第一手段。
 */
function elemColor(p) {
  if (p.origin && ORIGIN[p.origin]) return ORIGIN[p.origin].color;
  return FAM_COLOR[p.fam] || '#3fb983';
}

/** 元件副标题：本公司产品显示型号，其他元件显示来源短标签（别把「按工程配置」当型号） */
function elemSub(p) {
  if (p.origin && p.origin !== 'own') return (ORIGIN[p.origin] || {}).short || '元件';
  return String(p.m || '').split(' /')[0].split('（')[0];
}

function partsNote(p) {
  const m = String(p.m || '');
  if (p.cat === '电源' && /YDSP/i.test(m)) {
    return ['金属外壳与散热格栅（示意）', '前脸型号丝印与状态指示灯', '接线端子（示意）'];
  }
  if (/XF/i.test(m)) {
    return ['铁芯与绕组（示意）', '安装底座', '接线端子（示意）'];
  }
  if (p.fam === '报警' || /DTC|FA/.test(m)) {
    return ['面板表头本体与安装边', '光字牌 / 灯窗阵列（示意排布）',
      '数码管显示窗（通用段码图形，非实测值）', '面板按键', '背面接线端子'];
  }
  /* 导轨模块：华用这一族外形与部件布置是共通的 */
  return ['斜面：显示与操作面板（数码管为通用段码图形，非实测值）',
    '斜面上缘：指示灯与端子号丝印（示意）',
    '斜面下缘：面板按键（数量按说明书插图）',
    '前立面：双排接线端子块（位数为示意）',
    '背面下部：DIN 导轨卡脚'];
}

/* ============================================================
 * 应用
 * ============================================================ */
class App {
  constructor() {
    this.$ = (s) => document.querySelector(s);
    this.stage = this.$('#stage');
    this.canvas = this.$('#gl');
    this.labelLayer = this.$('#labels');
    this.moverHint = this.$('#mover-hint');     // 悬停可动件时贴上去的操作气泡
    /* 已经给过「本场景有 N 扇柜门可以开合」引导的场景 id。
       只放内存、不落 localStorage —— 用户刷新页面后重新演示一遍反而是好事。 */
    this._moverHinted = new Set();
    /* 「定位闪烁」的临时光圈精灵。挂在 this.scene 上，**不是** contentRoot ——
       contentRoot 会在 teardownScene 里被 disposeTree 整棵释放，而 ringTex 是
       共享贴图，混进去会被连带干掉，下一个场景的标记点就全变成白方块。 */
    this._pulses = [];

    /* 系统里改「减少动效」→ 同步那些只在初始化时设一次的量。
       逐帧读 RM 的那些（相机补间 / 门阻尼 / 爆炸 / 光圈）不用管，下一帧自然跟上。 */
    document.addEventListener('rm-change', () => this._applyMotionPrefs());

    this.tweens = new Tweens();
    this.hotspotById = new Map();
    this.pickTargets = [];
    this.markers = [];
    this.labels = [];
    this.currentScene = null;
    /* 上一个**装载成功**的场景 —— 装载失败时给用户一条「回到能用的画面」的退路 */
    this._lastGoodScene = null;
    /* 装载失败的场景 id（重试按钮用） */
    this._failScene = null;
    /* `#loading` 是否已切成失败面板（见 loadFail / showLoading） */
    this._ldBroken = false;
    this.currentBuild = null;
    this.selectedId = null;
    this.hoveredId = null;
    /* 标注档位：0 = 只标本公司产品（默认）｜1 = 全部元件｜2 = 隐藏。
       为什么默认不是「全开」：一个 KYN28 场景有 21 个元件，全开就是 21 条标签，
       本公司产品那 5 条会被通用件的标签压住、根本挑不出来（出图实测：
       「插拔式小型中间继电器 通用」同屏重复 6 次以上）。见 applyLabelState()。 */
    this.labelMode = 0;
    this.autoRotate = false;
    this.lightFactor = 1;
    this.baseLights = [];
    this.quality = 0;                 // 0=高 1=中 2=低
    this.advStep = 0;
    this.advAnswers = {};
    this.autoQuality = true;          // 允许按实测帧率自动降档
    this.noShadow = false;            // 兜底：连最低档都跑不动时才关阴影
    this._needsRender = true;
    this._halfN = 0;

    this.initRenderer();
    this.initScene();
    this.initControls();
    this.initViewer();
    this.initUI();
    this.initEvents();
    this.initAdvisor();
    this.initAlts();
    this.initQuality();

    // 环境贴图按需生成：开场只做当前场景需要的那一张，省掉一次 PMREM 预计算
    this.envIndoor = null;
    this.envOutdoor = null;

    this.loadScene(SCENES[0].id);

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  /* ---------------- 基础三件套 ---------------- */
  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    /**
     * 阴影贴图改为「按需更新」——核显上最值钱的一条优化。
     *
     * 默认 autoUpdate = true 会让 three.js **每帧**都把整个场景从光源视角再渲染一遍
     * （2048² 的深度 pass 在低配机上约吃 4ms，占 60fps 预算的 1/4）。
     * 但我们的场景是静态的：转相机不改变阴影贴图（它是从光源视角算的，与相机无关），
     * 只有「换场景 / 爆炸位移 / 改画质」才需要重算。
     * 关掉自动更新后，静止画面里阴影 pass 完全省掉，画面一模一样。
     *
     * 纪律：任何**会移动几何体**的操作都要补一句 shadowMap.needsUpdate = true，
     * 目前只有 applyExplode() 一处（相机补间、呼吸高亮、自动旋转都不影响光源视角）。
     */
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.02, 400);
    this.camera.position.set(2, 2, 3);
  }

  /**
   * 把「减少动效」偏好应用到**只在初始化时设一次**的 OrbitControls 参数上。
   *
   * ⚠️ 阻尼（`enableDamping`）是一种「松手之后还会自己滑一段」的惯性动效，
   *    正是 reduced-motion 最该压掉的一类 —— 松手即停。
   *    （逐帧读 RM 的那些量不在这里，它们在各自的位置上直接判断。）
   */
  _applyMotionPrefs() {
    if (!this.controls) return;
    this.controls.enableDamping = !RM;
    this.controls.autoRotateSpeed = RM ? 0.28 : 0.55;
    this._needsRender = true;
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.72;
    this.controls.zoomSpeed = 0.85;
    /* ⚠️ **滚轮朝鼠标位置缩放**（第 55 轮，用户诉求：
       「镜头被锁定固定那个地方，我要的是鼠标对着哪里滚动就在哪个方向缩放」）。
       默认 `zoomToCursor = false` 时，滚轮是把相机**朝 `controls.target` 收缩** ——
       不管鼠标指哪都往同一个固定点钻。打开后 `vendor/OrbitControls.js`
       会让相机沿**指针射线**推进（`dollyDirection`），并把 `target` 一起带过去
       ⇒ 指针下那个点在屏幕上基本不动。
       仍然尊重 `minDistance` / `maxDistance`（走 `clampDistance`），
       沿射线的总推进量是**几何收敛**的（`radiusDelta = prevRadius - newRadius`）
       ⇒ 被初始半径界住，不会飘走。
       ⚠️ 不用额外补 `_needsRender`：渲染节流看 `controls.update()` 的返回值
       （`renderLevel(moved)`），相机被推动了自然全速出帧。 */
    this.controls.zoomToCursor = true;
    this.controls.panSpeed = 0.6;
    this.controls.screenSpacePanning = true;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.target.set(0, 1, 0);
    this._applyMotionPrefs();
  }

  /**
   * 右侧产品小视口是**第二个 WebGL 上下文**（独立的 renderer、着色器、几何缓存）。
   * 开场就创建它，会白白吃掉一份上下文创建 + 着色器编译的时间，
   * 而用户在第一屏其实只看得到主场景。所以改成「第一次选中产品时才创建」。
   */
  ensureViewer() {
    if (this.viewer) return this.viewer;
    this.viewer = new ProductViewer(this.$('#mini'), this.scene.environment);
    this.viewer.setVisible(!this.blocked);
    this.viewer.setQuality(Math.min(this.renderDpr(), 1.25));
    this.viewer.start();
    return this.viewer;
  }

  initViewer() {
    this.viewer = null;    // 真正的创建推迟到 ensureViewer()
  }

  initUI() {
    // 顶栏按钮初始态
    this.$('#btn-labels').classList.toggle('on', this.labelMode !== 2);
    this.$('#btn-rotate').classList.toggle('on', this.autoRotate);
    this.$('#loading').classList.add('on');
    this.renderCardEmpty();
    // 移动端守卫（在 initEvents 里也会重新判定一次）
    if (isSmallScreen()) {
      this.$('#mobile-guard').classList.add('on');
      this.$('#app').classList.add('blocked');
    }
  }

  /* ============================================================
   * 画质档位
   * 高 = 2048 阴影 + DPR2×1.00 + 清漆层 · 中 = 1024 阴影 + DPR1.5×0.92 + 清漆层
   * 低 = 512 阴影 + DPR1.25×0.82（不关阴影，关了画面会变平、有廉价感）
   * 低档是给核显/老机器救帧率用的：材质与环境贴图不动，只降采样率与阴影尺寸。
   * ============================================================ */
  qualitySpec() {
    const base = [
      { name: '高', dpr: 2.00, scale: 1.00, shadow: true, shadowSize: 2048, shadowType: THREE.PCFSoftShadowMap },
      { name: '中', dpr: 1.50, scale: 0.92, shadow: true, shadowSize: 1024, shadowType: THREE.PCFSoftShadowMap },
      /* ⚠️ 低档 shadowSize 512 → 1024（第 54 轮）：512 在大范围场景（pv/wind，shadowCam 32m）
         下每 texel = 62.5mm，阴影边缘是粗阶梯，相机一动就像在闪。
         因为 shadowMap.autoUpdate=false，提高 mapSize **静止时零代价**（只在重算帧贵 4 倍）。 */
      { name: '低', dpr: 1.25, scale: 0.82, shadow: true, shadowSize: 1024, shadowType: THREE.PCFShadowMap },
    ][this.quality] || { name: '高', dpr: 2.00, scale: 1.00, shadow: true, shadowSize: 2048, shadowType: THREE.PCFSoftShadowMap };
    // 兜底档：连低档都跑不动时才彻底关阴影（画面会变平，但至少能动）
    if (this.noShadow) return { ...base, name: base.name + '·无影', shadow: false };
    return base;
  }

  /**
   * 实际渲染像素比 = min(设备像素比, 档位上限) × 档位缩放。
   *
   * 为什么要乘 scale（2026-09 校准实测）：办公机显示器大多是 DPR1，
   * 此时 min(devicePixelRatio, 2.0/1.5/1.25) 三档**全都等于 1** ——
   * 也就是高低档渲染分辨率一模一样，自动降档等于没降，只能靠阴影尺寸硬撑。
   * 乘上 scale 后，DPR1 上三档的像素量变成 1 : 0.85 : 0.67，低档才真的省下 1/3 填充。
   * 下限 0.62 是画质红线：再低就有明显糊边，宁可关阴影也不糊。
   */
  renderDpr() {
    const q = this.qualitySpec();
    const dev = window.devicePixelRatio || 1;
    return clamp(Math.min(dev, q.dpr) * q.scale, 0.62, 2.0);
  }

  initQuality() {
    this.quality = this.detectQuality();
    this.applyQuality();
  }

  /**
   * 按显卡型号猜一个起始档位。
   * 目的：低配办公机（核显 / 软渲染）一打开就是顺的，而不是先卡 5 秒等用户自己发现画质按钮。
   * 判据是 UNMASKED_RENDERER_WEBGL（各家浏览器都支持），拿不到就退回「高」。
   *
   * 实测校准口径（2026-09，SwiftShader 相对基准 + 合成 GPU 名逐条验证）：
   * 办公机主力是 Intel HD 5xx/6xx 与 UHD 6xx/7xx。主视口约 1290×950 CSS px，
   * 三档实际像素量 1 : 0.85 : 0.67（见 renderDpr），叠加阴影 2048/1024/512 与清漆层开关。
   * UHD 630 在低档（151 draw call / 512 阴影 / 0.82 缩放）能稳 45–60 FPS，
   * 高档直接掉到 20 上下 —— 所以 8xx 以下的 Intel 核显一律从最低档起步，
   * 先把帧率做稳；用户想更精细，点顶栏画质按钮即可，点了就不再自动降档。
   */
  detectQuality() {
    let name = '';
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || '');
    } catch (e) { /* 拿不到就按高性能处理 */ }
    this.gpuName = name;
    const s = name.toLowerCase();
    const cores = navigator.hardwareConcurrency || 8;

    /* 最低档：软渲染 / 无硬件加速（远程桌面、虚拟机、浏览器降级渲染）
       —— 这种环境是逐帧慢慢磨，给高档次只会更惨 */
    if (/swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic|offscreen/.test(s)) return 2;

    /* 高档：独立显卡与苹果芯片 */
    if (/nvidia|geforce|quadro|\brtx\b|\bgtx\b/.test(s)) return 0;
    if (/apple\s+m\d/.test(s)) return 0;
    if (/intel.*\barc\b/.test(s)) return 0;
    if (/\b(radeon\s+)?rx\s*\d{3,4}/.test(s)) return 0;
    if (/radeon.*\b(pro|vii)\b/.test(s)) return 0;

    /* Intel 核显：先看是不是 Iris 系（Iris Plus / Iris Xe / Iris Pro 明显强于 HD/UHD），
       再按 HD/UHD 的型号数字判代次 */
    if (/intel|hd graphics|uhd graphics|iris/.test(s)) {
      if (/\biris\b/.test(s)) return 1;
      const m = s.match(/(?:hd|uhd)\s*graphics\s*(\d{3})/);
      const gen = m ? parseInt(m[1], 10) : 0;
      // UHD 8xx 及更新的核显（11 代以后）→ 中档
      if (gen >= 800) return 1;
      // HD 5xx/6xx、UHD 6xx/7xx 等办公机主力 → 最低档，先保帧率
      return 2;
    }

    /* 其余集显 / 移动端 GPU：AMD APU、Mali、Adreno、PowerVR */
    if (/radeon|vega|mali|adreno|powervr/.test(s)) return 1;

    /* 完全拿不到型号时的保守判据：看 CPU 核数 */
    if (cores <= 4) return 2;
    if (cores <= 8) return 1;
    return 0;
  }

  cycleQuality() {
    this.setQuality((this.quality + 1) % 3);
  }

  /** 用户手动选档：关掉自动降档，别跟用户抢方向盘 */
  setQuality(level) {
    this.autoQuality = false;
    this.noShadow = false;              // 用户主动选档，把兜底关影也一并复位
    this.quality = clamp(level | 0, 0, 2);
    this.applyQuality();
  }

  applyQuality(auto) {
    const q = this.qualitySpec();
    const rdpr = this.renderDpr();

    this.renderer.setPixelRatio(rdpr);
    // 右侧小视口是第二个 WebGL 上下文，再压一档，别跟主视口抢采样率
    this.viewer?.setQuality(Math.min(rdpr, 1.25));

    // 清漆层（powder coat 光泽）只在高中档开：低档省掉一个高光瓣
    setClearcoat(this.quality < 2);

    // 阴影总开关 / 采样方式：改这两个都会让所有材质重新编译，所以要打 needsUpdate
    const shadowChanged = this.renderer.shadowMap.enabled !== q.shadow
      || this.renderer.shadowMap.type !== q.shadowType;
    this.renderer.shadowMap.enabled = q.shadow;
    this.renderer.shadowMap.type = q.shadowType;
    this.renderer.shadowMap.needsUpdate = true;
    if (shadowChanged && this.contentRoot) {
      this.contentRoot.traverse(o => {
        if (!o.material) return;
        const arr = Array.isArray(o.material) ? o.material : [o.material];
        arr.forEach(m => { m.needsUpdate = true; });
      });
    }

    // 阴影贴图分辨率：改尺寸必须丢掉旧 map，否则 three 不会重建
    this.baseLights.forEach(l => {
      if (!l.userData.wantsShadow) return;   // 用 wantsShadow 而不是 castShadow，
      l.castShadow = q.shadow;               // 否则低档建出来的灯切回高档永远不投影
      if (l.shadow.mapSize.x !== q.shadowSize) {
        l.shadow.mapSize.set(q.shadowSize, q.shadowSize);
        if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
      }
    });

    const btn = this.$('#btn-quality');
    if (btn) {
      /* ⚠️ 文案必须拆成**可单独隐藏的 span**（第 53 轮）。
         顶栏右侧最宽能占 **58px**，而那点宽度正是场景名的宽度 ——
         ≤1120 时场景名是**唯一**的场景切换入口，截断了等于「显示不出要切到哪儿」。
         实测（`.workbuddy-ai/tmp/q_txt.js`）：低档 + 关阴影 + 自动降档 ⇒
         `画质 低·无影 · 自动` 宽 **113.55px**，而基准「画质 高」只有 **55.67px**。
         ⚠️ 低配机（软渲染 / 核显）一打开就自动降到低档，这个状态是**常态**而不是边缘情况。
         style.css 的 ≤1280 块把 `.q-sub` / `.q-auto` 藏掉；信息不丢 ——
         `aria-label` / `title` 里都写着「已按帧率自动调整」，SR 用户读的也正是 aria-label。 */
      const qParts = String(q.name).split('·');
      btn.textContent = '';
      const qLab = document.createElement('span');
      qLab.className = 'q-label';
      qLab.append('画质 ' + qParts[0]);
      if (qParts[1]) {
        const qSub = document.createElement('span');
        qSub.className = 'q-sub';
        qSub.textContent = '·' + qParts[1];
        qLab.append(qSub);
      }
      if (auto) {
        const qAuto = document.createElement('span');
        qAuto.className = 'q-auto';
        qAuto.textContent = ' · 自动';
        qLab.append(qAuto);
      }
      btn.append(qLab);
      btn.classList.toggle('is-auto', !!auto);
      btn.setAttribute('aria-label',
        `画质档位：当前 ${q.name}${auto ? '（已按帧率自动调整）' : ''}，点击循环切换`);
      btn.classList.toggle('on', this.quality === 0);
      btn.classList.toggle('warn', this.quality === 2);
      btn.title = `画质档位：高 / 中 / 低（当前 ${q.name}${auto ? '，已按帧率自动调整' : ''}）。`
        + `点击循环切换。低档保留 512 阴影但降采样率，观感不会崩。`
        + (this.gpuName ? `\n显卡：${this.gpuName}` : '');
    }

    // 改 pixelRatio 必须重新 setSize 才生效
    this._w = -1; this._h = -1;
    this.resize();
    this._needsRender = true;
  }

  /* ============================================================
   * 选型助手：三问 → 推荐产品 → 跳到典型场景并高亮安装位
   * ============================================================ */
  initAdvisor() {
    this.advEl = this.$('#advisor');
    this.advBody = this.$('#adv-body');
    this.advStep = 0;
    this.advAnswers = {};
    this.advOpen = false;

    this.$('#btn-advisor')?.addEventListener('click', () => this.toggleAdvisor());
    this.$('#adv-close')?.addEventListener('click', () => this.toggleAdvisor(false));
    this.$('#adv-back')?.addEventListener('click', () => {
      if (this.advStep <= 0) return;
      this.renderAdvStep(this.advStep - 1);
    });
    this.$('#adv-restart')?.addEventListener('click', () => this.restartAdvisor());
    // 复制按钮常驻页脚（结果页才显示），避免被「为什么不是它」挤到折叠线以下
    this.$('#adv-copy')?.addEventListener('click', () => this.copyAdvSummary(this._advTop || []));

    this.renderAdvStep(0);
    this._syncInert();
  }

  /* 把焦点送进抽屉 / 还回触发按钮 —— 并且**绝不因此把整页滚走**。
     ⚠️⚠️ 为什么不能直接 `.focus()`：
       两个抽屉（`#advisor` / `#alts`）的关闭态是 `transform:translateX(102%)`，
       会给 `#app` 造出约 379px 的**横向溢出**（实测 `scrollWidth 2059` vs
       `clientWidth 1680`）。而 `#app` 是 `overflow:hidden` —— **它仍然是滚动容器**，
       只是不给用户滚动条；脚本和「焦点滚动到可见」照样能改它的 `scrollLeft`。
       于是那次 `.focus()` 会让浏览器把整页横向滚走：左栏 `x` 从 0 变成 −379，
       而且**不会自己复位**。用户看到的就是「点开方案对照之后，左边场景列表
       点了没反应」——第 60 轮用 alts_switch_probe.js 复现并归因（`scrollLeft=379`）。
     `preventScroll:true` 是语义正确的做法（我们要的是焦点，不是滚动）；
     后面那次归零是给**不支持 `preventScroll` 的旧浏览器**兜底。
     收敛到这一处：两个抽屉各有「打开送焦点 / 关闭还焦点」共 4 个调用点，
     各写一份迟早漏掉一个（`_anyDoorOpen` 的教训）。 */
  _focusIn(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    const app = this.$('#app');
    if (app && (app.scrollLeft || app.scrollTop)) { app.scrollLeft = 0; app.scrollTop = 0; }
  }

  /* 把「视觉上已经收起来 / 被挡住」的区域从 **Tab 顺序**里摘掉。
     ⚠️ 这几处隐藏全都只是「网格列变 0px」或「`transform:translateX(102%)`」——
        元素**还留在文档里、还能 Tab 到**：键盘用户会一路走进看不见的控件，
        读屏也会把它们念出来（`aria-hidden` **挡不住键盘**）。只有 `inert` 两头都管。
     ⚠️ 收敛到这一处：`lean` / `panel.closed` / `adv-open` 三种状态会两两叠加，
        就地各写一份迟早对不上（`_anyDoorOpen` 的教训）。 */
  _syncInert() {
    const app = this.$('#app');
    const lean = !!app?.classList.contains('lean');
    const panel = this.$('#panel');
    const panelClosed = !!panel?.classList.contains('closed');
    const adv = !!this.advOpen;
    /* ⚠️ 第 48 轮新增的「方案对照」抽屉与选型助手是**同一种东西**：
       关闭态只是 `transform:translateX(102%)`，元素还留在文档里、还能 Tab 到。
       两个抽屉必须各自 inert，而且都要算进 `#panel` 的收起条件 ——
       收敛到这一处，别在两个 toggle 里各写一份（`_anyDoorOpen` 的教训）。 */
    const alts = !!this.altsOpen;
    const drawer = adv || alts;
    const set = (sel, on) => { const el = this.$(sel); if (el) el.inert = on; };
    set('#sidebar', lean);
    set('#panel', lean || panelClosed || drawer);
    set('#advisor', !adv);
    set('#alts', !alts);
    /* ⚠️⚠️ `#loading` 也必须在这里管 —— 它是 `opacity:0;pointer-events:none` 隐藏的，
       而 **`opacity:0` 既不会把元素移出无障碍树、也不会让它失去焦点能力**：
       遮罩收起后，里面那两颗「重试这个场景 / 回到上一个能用的场景」按钮
       **照样 Tab 得到**（Tab 到一片空白处，回车还会真的重新装载场景）。
       与第 36 轮 `#panel.closed` 是同一条 —— 当时就是这么收敛的，只是漏了 `#loading`。
       ⚠️ 反过来也要对：遮罩**亮着**时（装载中 / 失败面板）绝不能 inert，否则
          「重试」按不动 —— 那时它正是用户唯一的出路。 */
    const ld = this.$('#loading');
    set('#loading', !(ld && ld.classList.contains('on')));

    /* ⚠️⚠️ 「收起产品面板」按钮（`#btn-panel-toggle`）的 `aria-expanded` 必须**也**在这里同步。
       原先它只在**自己的 click 处理器**里同步 —— 于是用户点「沉浸模式」（`#btn-collapse`）
       把两侧栏一起压成 0px 宽之后，`#panel` 已经 `inert` 了，而 `aria-expanded` 还停在
       `"true"`：读屏宣布「已展开」，屏幕上却什么都没有。**`aria-expanded` 是承诺，不是装饰。**
       凡是「多个状态能各自把同一块区域收起来」的地方，aria 就必须由**汇总那一处**统一写
       —— 和 `_anyDoorOpen(includeSlides)` 是同一个道理，别就地各写一份。
       ⚠️ 可见性同理：这颗按钮原先带内联 `style="display:none"`，而**全库没有任何代码或样式
          把它显示出来** —— 一个永远 Tab 不到、也永远点不到的死按钮，却用
          `aria-controls` 指着一个活的面板。现在改成**按需出现**：
          只有「已选中产品（`#panel.has-sel`）且不在沉浸模式」时才露出来，
          那时它才真的有事可做（把右侧面板单独收掉、保留左侧场景列表）。
       ⚠️ 沉浸模式下必须**藏起来**：那一列已经是 0px，再给一个「收起面板」按钮只会误导。 */
    const sel = !!panel?.classList.contains('has-sel');
    const pt = this.$('#btn-panel-toggle');
    if (pt) {
      const visible = sel && !lean;
      const expanded = !panelClosed && !drawer;
      pt.style.display = visible ? '' : 'none';
      pt.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      const label = expanded ? '收起产品面板' : '展开产品面板';
      pt.setAttribute('aria-label', label);
      pt.title = label;
    }

    /* ⚠️ 兜底：`#app` 即使加了 `overflow:clip`，在**不支持 `clip` 的旧浏览器**上
       仍是 `overflow:hidden` = 滚动容器，任何一次「焦点滚到可见」都能把它滚走，
       而**滚动位置不会自己复位** ⇒ 左栏永久停在屏幕外。
       正常路径已由 `focus({preventScroll:true})` + `overflow:clip` 堵住，
       这里只做最后一道保险：只要 `_syncInert()` 被调到（每次抽屉/面板/遮罩
       状态变化都会调），就把 `#app` 的滚动位置归零。
       ⚠️ 不能改成 `scrollTo` 动画 —— 那会让「已经滚歪的页面」在用户眼前滑回去，
          比直接归零更像 bug。 */
    if (app && (app.scrollLeft || app.scrollTop)) { app.scrollLeft = 0; app.scrollTop = 0; }
  }

  toggleAdvisor(on) {
    const was = this.advOpen;
    const next = on === undefined ? !this.advOpen : !!on;
    this.advOpen = next;
    /* 同上：两个抽屉都是 `grid-area:right`，必须互斥 */
    if (next && this.altsOpen) this.toggleAlts(false);
    this.advEl.classList.toggle('on', next);
    this.advEl.setAttribute('aria-hidden', next ? 'false' : 'true');
    this.$('#app').classList.toggle('adv-open', next);
    /* ⚠️ 抽屉挂了 `role="dialog"` 就**必须配焦点管理** —— 否则读屏用户打开后
       焦点还留在背后的顶栏上，「对话框」是假的。
       打开时把焦点送进抽屉，关闭时还回触发按钮。
       ⚠️ 关闭分支要判 `was`：init 时会主动调一次 `toggleAdvisor(false)` 确保关闭态，
          不加这个判断会在**页面加载时抢焦点**。 */
    const opener = this.$('#btn-advisor');
    opener?.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      // 保持上次进度：没答完就回到当前问题，答完了就停在结果页
      if (this.advStep >= QUESTIONS.length) this.renderAdvResult();
      else this.renderAdvStep(this.advStep);
      /* ⚠️ `requestAnimationFrame` 要等**下一帧**才跑；SwiftShader 软渲染实测只有
         4~5 FPS（一帧 200~250ms），探针 400ms 的等待窗口偶发就漏掉了 ——
         症状是「打开抽屉后焦点还留在顶栏」。补一次 80ms 的幂等重试。 */
      /* ⚠️⚠️ `preventScroll:true` 不是可选项 —— 抽屉的关闭态是 `translateX(102%)`，
         它给 `#app` 造出约 379px 的**横向溢出**（`#app` 是 `overflow:hidden`，
         仍然是滚动容器）。不加这个参数，这次 `focus()` 会让浏览器
         「把元素滚到可见」⇒ **整页横向滚走**：左栏从 x=0 变成 x=−379，
         用户看到的就是「点开方案对照之后，左边的场景列表点了没反应」，
         而且切完场景也不会复位（第 60 轮实测复现，见 alts_switch_probe.js）。
         我们要的只是「焦点进抽屉」，不是「把整页滚过去」。 */
      const focusFirst = () => this._focusIn(this.$('#adv-close'));
      requestAnimationFrame(() => { focusFirst(); setTimeout(focusFirst, 80); });
    } else if (was) {
      this._focusIn(opener);
    }
    this._syncInert();
  }

  /* ============================================================
   * 方案对照：同一个功能，柜里可以有哪几种做法
   *
   * 与「选型助手」的分工：
   *   选型助手 = 从**需求**出发 → 推荐产品；
   *   方案对照 = 从**功能**出发 → 列出所有做法（含「不用继电器」的方案）。
   *
   * 用户出差时发现「有些开关柜用不到我们的特殊产品，可能只用可插拔的小继电器」——
   * 这个抽屉就是把这件事讲明白，并且每一行都能点进去看。
   * ⚠️ 与选型助手同一套抽屉机制（`transform` 收放 + `_syncInert` 管 Tab 顺序 +
   *    打开时送焦点、关闭时还焦点）。两处**必须**一起改，否则键盘用户会走进看不见的控件。
   * ========================================================== */
  initAlts() {
    this.altsEl = this.$('#alts');
    this.altsBody = this.$('#alts-body');
    this.altsOpen = false;
    this.$('#btn-alts')?.addEventListener('click', () => this.toggleAlts());
    this.$('#alts-close')?.addEventListener('click', () => this.toggleAlts(false));
    this.renderAlts();
    this._syncInert();
  }

  renderAlts() {
    const box = this.altsBody;
    if (!box) return;
    box.innerHTML = ALTERNATIVES.map((g, gi) => `
      <section class="alt-fn">
        <h3><span class="alt-n">${gi + 1}</span>${g.fn}</h3>
        <p class="alt-why">${g.why}</p>
        <div class="alt-ways">${g.ways.map((w) => {
      const p = elementById(w.id);
      /* ⚠️ 数据里的 id 写错时**不能静默跳过** —— 那样表里会少一行而没人发现。
         这里退化成一条「未登记」的提示，探针会把它抓出来。 */
      if (!p) return `<span class="alt-miss">元件「${w.id}」未登记</span>`;
      const own = !p.origin || p.origin === 'own';
      const c = own ? '#3fb983' : ((ORIGIN[p.origin] || {}).color || '#5aa9e6');
      return `<button type="button" class="alt-way" data-id="${p.id}" style="--c:${c}">
          <span class="aw-h"><span class="aw-tag">${own ? '本公司' : ((ORIGIN[p.origin] || {}).short || '通用')}</span>${w.alt ? '<span class="aw-alt" title="这一档不是继电器 —— 客户可以选别的做法">非继电器方案</span>' : ''}<b>${w.t}</b></span>
          <span class="aw-m">${p.n}${own ? ' · ' + p.m : ''}</span>
          <span class="aw-d">${w.d}</span>
        </button>`;
    }).join('')}</div>
      </section>`).join('');

    box.querySelectorAll('.alt-way').forEach(b => {
      b.addEventListener('click', () => {
        const p = elementById(b.dataset.id);
        if (!p) return;
        /* ⚠️ 先看**当前场景**里有没有这个元件（列表里出现过就算）；
           没有就找任意一个装了它的场景跳过去。
           `selectProduct()` 对**没有 3D 热点**的元件是安全的（照常出卡片、
           只是不飞镜头不高亮），所以「一个场景都没装」也不会报错。 */
        const here = SCENE_BY_ID[this.currentScene] || {};
        const inHere = (here.products || []).includes(p.id) || (here.elements || []).includes(p.id);
        const target = inHere ? null : SCENES.find(s =>
          (s.products || []).includes(p.id) || (s.elements || []).includes(p.id));
        /* ⚠️ 必须先收抽屉再切场景：抽屉是 `grid-area:right` 的一整列，
           开着的时候 `#panel` 被压到 0.25 透明度，用户看不到刚跳过去的卡片。 */
        this.toggleAlts(false);
        if (target) this.loadScene(target.id, { select: p.id, fly: true });
        else this.selectProduct(p.id, { fly: true });
      });
    });
  }

  toggleAlts(on) {
    const was = this.altsOpen;
    const next = on === undefined ? !this.altsOpen : !!on;
    /* ⚠️ 这里**不要**加「状态没变就提前 return」的短路 —— 看着像省一次无谓的
       DOM 写，实际是给自己埋一个「状态一旦不同步就永远切不动」的坑，
       而且 `_syncInert()` 也会跟着被跳过（Tab 顺序就烂了）。
       `toggleAdvisor` 也没有这个短路，两边保持一致。 */
    this.altsOpen = next;
    this.altsEl.classList.toggle('on', next);
    this.altsEl.setAttribute('aria-hidden', next ? 'false' : 'true');
    this.$('#app').classList.toggle('alts-open', next);
    /* ⚠️ 挂了 `role="dialog"` 就必须配焦点管理：打开送进抽屉、关闭还回触发按钮。
       关闭分支判 `was`，否则 init 时那次主动关闭会在**页面加载时抢焦点**
       （与 `toggleAdvisor` 同一条）。 */
    const opener = this.$('#btn-alts');
    opener?.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (next) {
      /* ⚠️ 打开另一个抽屉时要把这一个收掉 —— 两个都是 `grid-area:right`，
         叠在一起会互相盖住，而且 `_syncInert` 只认得「至少有一个开着」。 */
      if (this.advOpen) this.toggleAdvisor(false);
      /* ⚠️ 与 `toggleAdvisor` 同一条：抽屉关闭态 `translateX(102%)` 给 `#app`
         造出横向溢出，`focus()` 不带 `preventScroll` 会把整页滚走
         —— 症状正是「点开方案对照之后左边切换不了场景」。 */
      const focusFirst = () => this._focusIn(this.$('#alts-close'));
      requestAnimationFrame(() => { focusFirst(); setTimeout(focusFirst, 80); });
    } else if (was) {
      this._focusIn(opener);
    }
    this._syncInert();
  }

  restartAdvisor() {
    this.advAnswers = {};
    this.advStep = 0;
    this.renderAdvStep(0);
  }

  updateAdvSteps() {
    const cur = Math.min(this.advStep, QUESTIONS.length - 1);
    this.advEl.querySelectorAll('.adv-step').forEach(el => {
      const s = parseInt(el.dataset.step, 10);
      el.classList.toggle('on', s === cur);
      el.classList.toggle('done', s < this.advStep);
    });
  }

  renderAdvStep(i) {
    this.advStep = clamp(i, 0, QUESTIONS.length - 1);
    this.updateAdvSteps();

    const q = QUESTIONS[this.advStep];
    const picked = this.advAnswers[q.key];
    this.advBody.innerHTML = `
      <div class="adv-q">${q.q}</div>
      <div class="adv-hint">${q.hint}</div>
      <div class="adv-opts">
        ${q.options.map(o => `<button type="button" class="adv-opt${picked === o.v ? ' on' : ''}" data-v="${o.v}">
          <b>${o.label}</b><span>${o.desc}</span></button>`).join('')}
      </div>`;

    this.advBody.querySelectorAll('.adv-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        this.advAnswers[q.key] = btn.dataset.v;
        // 已答过的后续问题作废（用户改了上游条件）
        QUESTIONS.slice(this.advStep + 1).forEach(nq => { delete this.advAnswers[nq.key]; });
        if (this.advStep + 1 < QUESTIONS.length) this.renderAdvStep(this.advStep + 1);
        else { this.advStep = QUESTIONS.length; this.renderAdvResult(); }
      });
    });

    const back = this.$('#adv-back');
    if (back) back.disabled = this.advStep === 0;
    const copy = this.$('#adv-copy');
    if (copy) copy.hidden = true;          // 复制摘要只在结果页出现
    this.advBody.scrollTop = 0;
  }

  /** 某个产品在哪些场景里出现过（用于跳转；没场景的走手册深链） */
  sceneOfProduct(pid) {
    return SCENES.find(s => s.products.includes(pid)) || null;
  }

  renderAdvResult() {
    this.advStep = QUESTIONS.length;
    this.updateAdvSteps();

    const picks = recommend(this.advAnswers, 99)
      .map(r => ({ r, p: PRODUCTS[r.id], scene: this.sceneOfProduct(r.id) }))
      .filter(x => x.p);
    const top = picks.slice(0, 6);
    /**
     * 落选项「为什么不是它」的挑选口径：
     * 优先列**真正缺项**的型号（对销售最有信息量：「客户问 XX 行不行，我该怎么答」），
     * 只在找不到缺项型号时才退回同分并列项。得分 < 3 的基本无关，不列。
     */
    const rest = picks.slice(6).filter(x => x.r.score >= 3);
    const missed = rest.filter(x => !(x.r.hitNeed && x.r.hitEquip && x.r.hitPlace));
    const near = (missed.length ? missed : rest).slice(0, 3);

    const ansLine = QUESTIONS
      .map(q => {
        const o = q.options.find(x => x.v === this.advAnswers[q.key]);
        return o ? o.label : null;
      })
      .filter(Boolean).join(' · ');

    const withScene = top.filter(x => x.scene).length;

    this.advBody.innerHTML = `
      <div class="adv-res-title">推荐 ${top.length} 个产品</div>
      <div class="adv-res-sub">
        依据：${ansLine || '—'}。<br>
        ${withScene ? `${withScene} 个可直接跳到典型安装场景并高亮安装位` : ''}${withScene < top.length ? `，其余暂无三维场景，点开走手册档案` : ''}。
      </div>
      <div class="adv-list">
        ${(() => {
          /* 按**家族**分组（第 47 轮）—— 推荐 6 个里往往横跨 2~3 个家族，平铺一列时
             「哪几个是一类」全靠用户自己去看每张卡右上角那行小字。
             ⚠️ 序号必须**跨组连续**（`i + 1` 用的是 `top` 里的原始下标）：
                分组是为了读起来有层次，不是把「推荐 6 个」拆成几份。
             ⚠️ 组内**保持 `top` 的原始次序**（`recommend()` 已按得分排好），绝不重排 ——
                否则「第 1 个」就不再是得分最高的那个了。
             ⚠️ 卡片右上角的徽标顺势从「家族」改成「分类」（`p.cat`）：家族已经写在组头上，
                再重复一遍是纯冗余；换成分类反而多给了一条信息。 */
          const groups = [];
          top.forEach((x, i) => {
            const k = x.p.fam || '其他';
            let g = groups.find(v => v.k === k);
            if (!g) { g = { k, items: [] }; groups.push(g); }
            g.items.push({ ...x, i });
          });
          return groups.map(g => `
            <div class="adv-grp">
              <div class="adv-grp-h">
                <span class="adv-grp-ico" aria-hidden="true">${FAM_ICON[g.k] || FAM_ICON['其他']}</span>
                <b>${g.k}</b><em>${g.items.length} 个</em>
              </div>
              ${g.items.map(({ p, r, scene, i }) => `
                <button type="button" class="adv-item" data-id="${p.id}" data-scene="${scene ? scene.id : ''}"
                        style="--c:${FAM_COLOR[p.fam] || '#3fb983'}">
                  <span class="ai-top"><b>${i + 1}. ${p.n}</b><em class="ai-fam">${p.cat || p.fam}</em></span>
                  <span class="ai-m">${p.m}</span>
                  <span class="ai-r"><i>${reasonOf(r, this.advAnswers)}</i>｜${p.tagline}</span>
                  <span class="ai-go">${scene ? `→ 跳到「${scene.n}」` : '→ 在手册中查看完整档案'}</span>
                </button>`).join('')}
            </div>`).join('');
        })()}
      </div>
      ${near.length ? `
      <div class="adv-why">
        <div class="adv-why-h">为什么不是它</div>
        <div class="adv-why-sub">以下型号看着接近，但按当前三项条件并不优先</div>
        ${near.map(({ p, r }) => `
          <div class="adv-why-i">
            <b>${p.n}<em>${p.m}</em></b>
            <span>${whyNot(r, this.advAnswers)}</span>
          </div>`).join('')}
      </div>` : ''}`;

    this._advTop = top;                    // 供页脚的「复制选型摘要」使用

    this.advBody.querySelectorAll('.adv-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.id;
        const sid = btn.dataset.scene;
        if (sid) {
          this.toggleAdvisor(false);
          this.loadScene(sid, { select: pid, fly: true });
        } else {
          const p = PRODUCTS[pid];
          if (p?.manual) window.open(p.manual, '_blank', 'noopener');
        }
      });
    });

    const back = this.$('#adv-back');
    if (back) back.disabled = false;
    const copy = this.$('#adv-copy');
    if (copy) copy.hidden = false;         // 结果页才露出「复制选型摘要」
    this.advBody.scrollTop = 0;
  }

  /**
   * 一键复制选型摘要。
   * 注意：http:// 非安全上下文里 navigator.clipboard 不可用（本地预览就是这种情况），
   * 必须带 textarea + execCommand 回退，否则按钮点了没反应。
   */
  async copyAdvSummary(top) {
    let docUrl = '';
    try { docUrl = new URL('../index.html', location.href).href; } catch (e) { docUrl = ''; }
    const txt = summaryText(this.advAnswers, top, docUrl);

    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(txt);
        ok = true;
      }
    } catch (e) { ok = false; }
    if (!ok) {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, txt.length);
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
    }

    // 复制结果只靠 toast 反馈（按钮在页脚，旁边没有放提示文字的位置）
    const btn = this.$('#adv-copy');
    if (btn && !ok) {
      // 自动复制失败：把摘要直接摊开让用户手动选，别让人对着「复制失败」干瞪眼
      this.showAdvPlainText(txt);
    }
    this.toast(ok ? '选型摘要已复制，可直接粘进邮件' : '浏览器不允许自动复制，摘要已展开，可手动全选', ok ? 'ok' : 'warn');
  }

  /** 复制失败时的兜底：把摘要以可全选的等宽块摊在结果页顶部 */
  showAdvPlainText(txt) {
    if (!this.advBody) return;
    this.advBody.querySelector('.adv-plain')?.remove();
    const box = document.createElement('div');
    box.className = 'adv-plain';
    const pre = document.createElement('pre');
    pre.textContent = txt;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'adv-plain-x';
    close.textContent = '收起';
    close.addEventListener('click', () => box.remove());
    box.appendChild(close);
    box.appendChild(pre);
    this.advBody.prepend(box);
    this.advBody.scrollTop = 0;
  }

  /* ---------------- 场景切换 ---------------- */
  /**
   * 对外入口。**必须先把控制权还给浏览器**：
   * loadScene 里的 build() + batchStatic() 是几百毫秒级的同步重活，
   * 如果直接同步执行，浏览器根本没机会 paint，用户看到的是「点了没反应，然后突然卡住」。
   * 两次 rAF 保证 loading 遮罩（含阶段文字与进度条）真的画出来了再开工。
   */
  loadScene(id, opt = {}) {
    if (!SCENE_BY_ID[id]) return;
    // 令牌：用户连点两个场景时，后发的作废先发的，避免两次构建并发互相踩
    const seq = (this._loadSeq = (this._loadSeq || 0) + 1);
    this.showLoading(true, '正在准备场景…', 0.04);
    /* ⚠️⚠️ 这个 `.catch()` 不是装饰。`runLoad()` 是 async 且**通体没有 try/catch**，
       所以任何一步抛异常都会变成一个没人接的 Promise rejection —— 遮罩停在最后一条
       进度文案上永不收起，屏幕上没有一句解释。
       index.html 里的看门狗接不住：它每一条开头都是
       `if (done || window.__appReady) return;`，而 `__appReady` 在首次装载成功时就
       置 true 了 —— 从那以后看门狗**永久退休**。也就是说，「切场景时构建抛异常」
       这条路上原先**没有任何兜底**（`loadfail_probe.js` 实测确认）。 */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.runLoad(id, opt, seq).catch((err) => this.loadFail(id, err, seq));
    }));
  }

  /** 让出一帧，保证进度文字能被画出来 */
  nextPaint() {
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  async runLoad(id, opt, seq) {
    const cfg = SCENE_BY_ID[id];
    if (!cfg || seq !== this._loadSeq) return;
    const stale = () => seq !== this._loadSeq;

    this.deselect(true);
    this.teardownScene();
    this.currentScene = id;
    /* 旧场景的取景规格先清掉：否则构建期间若恰好触发一次 resize，
       refitCamera 会拿上一个场景的盒子去挪新场景的相机。 */
    this._fitSpec = null;
    const t0 = performance.now();

    // ① 光照环境（PMREM，同类环境只算一次；用 cfg.env 提前知道要哪一张）
    await this.step('正在准备光照环境…', 0.18, () => {
      if (cfg.env === 'outdoor') {
        if (!this.envOutdoor) this.envOutdoor = getEnvMap(this.renderer, 'outdoor');
      } else if (!this.envIndoor) {
        this.envIndoor = getEnvMap(this.renderer, 'indoor');
      }
    });
    if (stale()) return;

    // ② 构建场景几何
    const build = await this.step('正在构建场景几何…', 0.48, () => BUILDERS[id]());
    if (stale()) { disposeTree(build.root); return; }
    this.currentBuild = build;

    // ③ 静态几何批处理：把上千个零件 Mesh 按材质压成几十个，draw call 数量级下降。
    //    window.__noBatch 是给「穿模检测」用的调试开关：合并后静态零件会被拼成大网格，
    //    包围盒失去意义，测不出产品插进哪块板；关掉合并才能逐个零件比对。
    const batch = await this.step('正在合并静态几何…', 0.72,
      () => (window.__noBatch ? { skipped: true, before: 0, after: 0, groups: 0, diag: {} } : batchStatic(build.root)));
    if (stale()) { disposeTree(build.root); return; }
    this.batchStat = batch;

    // ④ 环境 / 雾 / 灯光 / 相机
    if (stale()) { disposeTree(build.root); return; }
    await this.step('正在布置灯光与相机…', 0.90, () => {
      /* ⚠️⚠️ 过期装载必须在这里**掉头就走**，而且这是唯一安全的校验点。
         `step()` 内部有一个 **2 帧的 await**（`nextPaint`），而 ④ 的 await 之后到 ⑤、
         ⑤ 的 await 之后到收尾，**原先都没有 `stale()` 校验**。于是：
         用户在装载途中点了另一个场景 → 新装载先跑完 `teardownScene()`，
         旧装载接着把 root / 灯光 / 热点标记挂进同一个 scene → **两套内容叠在一起**。
         实测症状（`race_repro_probe.js` 可 100% 复现）：热点标记 Sprite 19 → 38
         （凭空多 19 个 draw call + 19 个重叠的光点），`this.contentRoot` 被旧 root 覆盖
         → 下一次 teardown 漏掉新 root（几何泄漏）。
         ⚠️ 校验必须落在「动场景之前」，且不能只靠函数入口那一次 —— 中间隔着 await。 */
      if (stale()) return;
      const env = build.env === 'outdoor' ? this.envOutdoor : this.envIndoor;
      this.scene.environment = env;
      this.viewer?.setEnvMap(env);

      if (build.fog) this.scene.fog = new THREE.Fog(build.fog.color, build.fog.near, build.fog.far);
      else this.scene.fog = null;
      this.stage.dataset.env = build.env;

      this.scene.add(build.root);
      this.contentRoot = build.root;
      this.collectExplode(build.root);
      this.collectMovers(build.root);
      this.explode = false;
      this._ex = 0;
      this._needsRender = true;
      const xb = this.$('#btn-explode');
      xb?.classList.remove('on');
      xb?.setAttribute('aria-pressed', 'false');

      this.buildLights(build.lights);
      this.renderer.toneMappingExposure = build.exposure || 1.05;

      this.camera.near = 0.02;
      /* 远平面默认 400（户外）/ 60（户内）。风电场这类场景要在地平线上
         摆几百米外的风机剪影，400 会把它们裁掉 —— 所以允许场景用 build.far 放宽。
         注意别随意调大：near/far 比值越大深度精度越差，会先在远处出现 z-fighting。 */
      this.camera.far = build.far || (build.env === 'outdoor' ? 400 : 60);
      /* 视场角按场景给：户内房间纵深有限，硬把相机往后拉会穿出天花板，
         所以户内用更宽的 FOV 来「装下整个房间」，户外保持 38° 避免透视失真。 */
      this.camera.fov = build.fov || 38;
      this.camera.updateProjectionMatrix();
      /* 机位优先由场景声明的 fit 盒按**当前舞台宽高比**反解（见 fitCamera）；
         没声明 fit 的场景照旧用写死的机位；反解失败（例如户内相机背后有物件）
         也退回写死机位，绝不因为取景算不出来就中断加载。 */
      const fc = this.fitCamera(build);
      const home = fc ? fc.pos : build.camera.pos;
      const homeTgt = fc ? fc.target : build.camera.target;
      if (fc && fc.fov) this.camera.fov = fc.fov;
      this.camera.updateProjectionMatrix();
      this.camera.position.set(...home);
      this.controls.target.set(...homeTgt);
      const lim = build.limits || {};
      this._maxDBase = lim.maxD ?? 12;
      this.controls.minDistance = lim.minD ?? 0.10;
      /* 反解出的机位可能比场景写的 maxD 更远，必须同步放宽，
         否则 OrbitControls 第一帧就把相机拽回来，取景白算。 */
      this.controls.maxDistance = fc ? Math.max(this._maxDBase, fc.dist * 1.35) : this._maxDBase;
      this.controls.minPolarAngle = lim.minPol ?? 0.05;
      /* ⚠️ 兜底不再卡 π/2（= 只能在上半球转、连平视都做不到）。
         户外给到 156° 允许仰视；户内 98° 只略过水平，再多会看到房间外。 */
      this.controls.maxPolarAngle = lim.maxPol
        ?? (build.env === 'outdoor' ? Math.PI * 0.667 : Math.PI * 0.545);
      this.controls.minAzimuthAngle = lim.minAz ?? -Infinity;
      this.controls.maxAzimuthAngle = lim.maxAz ?? Infinity;
      this.controls.update();
      this.homePos = new THREE.Vector3(...home);
      this.homeTarget = new THREE.Vector3(...homeTgt);
      /* 记住取景规格：舞台宽高比一变（窗口缩放 / 两侧栏折叠 / 沉浸模式）
         resize() 会按新比值重算机位。 */
      this._fitSpec = build.fit
        ? { fit: build.fit, fov: build.fov || 38, home: build.camera, limits: lim }
        : null;
    });
    /* ④ 的 2 帧 await 期间可能被作废（上面那次校验只挡到 await 之前）。
       此时 `build.root` 还没挂进场景（上面早退过），直接丢掉即可。 */
    if (stale()) { disposeTree(build.root); return; }

    // ⑤ 热点 / UI
    await this.step('正在标注产品安装位…', 0.97, () => {
      if (stale()) return;
      this.buildHotspots(build.hotspots);
      /* 门在 step ④ 就建好了、热点在 step ⑤ 才建好，所以遮挡关系要在这儿再算一次
         —— collectMovers 里那次跑的时候 hotspotList 还是空的。 */
      this._updateDoorOcclusion();
      this.renderSceneList();
      this.renderProductList();
      this.$('#scene-title').textContent = cfg.n;
      this.$('#scene-en').textContent = cfg.en;
      this.$('#scene-desc').textContent = cfg.desc;
      this.$('#scene-note').textContent = SCENE_DISCLAIMER;
      this.renderOriginLegend(cfg);
      this.renderGuide(id);
      this.$('#scene-ambience').textContent = cfg.ambience;
      this.$('#stage-badge').textContent = cfg.badge;
      this.$('#stage-badge').dataset.kind = cfg.kind;
      /* 场景里有可开合的柜门时，提示末尾补一句 —— 门扇是一大块平板，
         不给提示用户不会想到它能点。 */
      const movers = this.doorList || [];
      const slideHint = movers.some(o => o.userData.slide) ? '，手车可点击摇出 / 推入' : '';
      const tip = movers.length ? `${cfg.tip} 柜门可点击开合${slideHint}。` : cfg.tip;
      this.$('#stage-tip').textContent = tip;
      /* _tipBase 要跟着重置，否则切场景后 _tipSwap 还原出来的是**上一个场景**的文案。
         swap 类也要清掉 —— 它只负责配色，textContent 换回去了样式还留着就很怪。 */
      this._tipBase = null;
      this.$('#stage-tip')?.classList.remove('swap');
      this.hoveredDoor = null;
    });
    /* ⑤ 同样隔着 2 帧 await，这里必须再挡一次：否则过期装载会去
       `showLoading(false)`（把**新装载**正在显示的遮罩收掉，用户看到「转圈突然没了但画面还是旧的」），
       并按**旧场景**的 hero 调 `selectProduct()`（选中一个不在当前场景里的产品）。 */
    if (stale()) return;

    this.buildMs = Math.round(performance.now() - t0);

    // 先出一帧画面，再收起遮罩，避免「遮罩没了但画面还是黑的」。
    // shadowMap.autoUpdate 已关，新场景必须显式要求重算一次阴影贴图。
    this.renderer.shadowMap.needsUpdate = true;
    this._needsRender = true;
    this.renderer.render(this.scene, this.camera);

    // 默认选中 hero 产品（跨场景跳转时可指定目标产品）
    const canPick = opt.select && (cfg.products.includes(opt.select) || (cfg.elements || []).includes(opt.select));
    const pick = canPick ? opt.select : cfg.hero;
    /* 首次进场刻意「不飞」：停在各场景精心构图的全景上，hero 产品用高亮 + 安装指示线标出来。
       一进来就被推成产品特写，会让人失去对场景整体（房间 / 场坪 / 设备关系）的第一印象。
       跨场景跳转和点产品卡片时才飞近。 */
    this.selectProduct(pick, { fly: !!opt.fly, silent: true });
    this.showLoading(false);
    this._lastGoodScene = id;

    /* 首次进入这个场景时给一次引导。
       为什么放在 showLoading(false) **之后**：放前面的话 toast 会被装载遮罩盖住，
       用户根本没看见 —— 而「门能点」这件事不说，功能等于不存在。
       每个场景只提示一次（记在 `_moverHinted`，内存级，刷新页面后重新演示一遍正好）。 */
    const mv = this.doorList || [];
    const nd = mv.filter(o => o.userData.door).length;
    const ns = mv.filter(o => o.userData.slide).length;
    if ((nd || ns) && !this._moverHinted.has(id)) {
      this._moverHinted.add(id);
      const parts = [];
      if (nd) parts.push(`${nd} 扇柜门`);
      if (ns) parts.push(`${ns} 台手车`);
      this.toast(`本场景有 ${parts.join(' · ')}可以开合 —— 点门扇试试，或按 O 一键全开`);
    }
  }

  /** 跑一个构建阶段：先更新进度文字并让出一帧，再执行同步重活 */
  async step(label, progress, fn) {
    this.showLoading(true, label, progress);
    await this.nextPaint();
    return fn();
  }

  teardownScene() {
    if (this.contentRoot) {
      this.scene.remove(this.contentRoot);
      disposeTree(this.contentRoot);
      this.contentRoot = null;
    }
    /* ⚠️⚠️ 灯光的 `target` 是**挂在场景根上的独立 `Object3D`**（见 `buildLights`），
       **不是灯的子节点** —— 只 `remove(l)` 会把 target 永远留在场景里。
       实测（`load_leak_probe.js` 连装两轮全部 9 场景）：`scene.children` 每轮稳定 +24，
       多出来的正是这些 `Object3D`，而且 uuid 与上一轮**完全相同**（证明是残留而非重建）。
       单个场景漏 2~4 个，切几十次场景就是上百个僵尸节点，每帧 `traverse` 都要过一遍。
       ⚠️ 只对「确实挂在场景上」的 target 动手：`PointLight`/`AmbientLight`/`HemisphereLight`
          在 three.js 里**没有** `.target`，别对不存在的属性做假设。 */
    this.baseLights.forEach(l => {
      const t = l.target;
      if (t && t.parent) t.parent.remove(t);
      /* ⚠️⚠️ 阴影贴图是**独立的 RenderTarget** —— 把灯从场景里移除**不会**释放它。
         实测（`mem_leak_probe.js`，kyn28 连装 6 次，每次读 `info.memory.textures`）：
           37 / 38 / 39 / 40 / 41 / 42  —— **每次装载恒定 +1**
         而 kyn28 恰好只有 **1 盏投影灯**；teardown 前后该计数**纹丝不动**（24→24）。
         1024² 深度贴图约 1~4MB，用户切 100 次场景就是 100~400MB ——
         正好打在「低配办公机必须流畅」这条红线上。
         ⚠️ 这里的写法与 `applyQuality()` 里改阴影分辨率时**同一惯用法**（那边一直是这么释放的，
            只有 teardown 漏了）；也等价于 `LightShadow.dispose()` 的实现。
         ⚠️ **不要依赖 `light.dispose()`**：本 vendor 构建里 `Light` 没有这个方法
            （实测 `typeof baseLights[0].dispose === 'undefined'`）。 */
      const sh = l.shadow;
      if (sh) {
        if (sh.map) { sh.map.dispose(); sh.map = null; }
        if (sh.mapPass) { sh.mapPass.dispose(); sh.mapPass = null; }
      }
      this.scene.remove(l);
    });
    this.baseLights = [];
    this.markers.forEach(m => this.scene.remove(m));
    this.markers = [];
    /* 定位光圈也挂在 this.scene 上、不属于 contentRoot，disposeTree 管不到它，
       不主动清就会飘在上一个场景的空中。 */
    this._clearPulses();
    /* ⚠️ 不能整块 `labelLayer.innerHTML = ''` —— 悬停操作气泡 #mover-hint 也住在
       #labels 里（复用同一套「投影到屏幕」的坐标系）。整块清空会把构造函数里
       抓到的那份引用变成孤儿节点：DOM 里没了，this.moverHint 还指着它，
       _placeMoverHint() 每帧都往一个脱离文档的元素上写 transform —— 静默失效，
       控制台一个错都不报（实测踩过：hint_test 八项全挂，pageerror 是 none）。
       所以只摘掉标签，把气泡留下。 */
    for (const el of Array.from(this.labelLayer.children)) {
      if (el !== this.moverHint) el.remove();
    }
    this.labels = [];
    this.hotspotById.clear();
    this.pickTargets = [];
    this.tweens.kill();
    this.lightFactor = 1;
    this.exList = [];
    this.doorList = [];
    this.hotspotList = [];
    this.hoveredDoor = null;
    if (this.pin) { this.pin.visible = false; this.pinOn = false; }
  }

  /* ---------------- 灯光 ---------------- */
  buildLights(specs) {
    const q = this.qualitySpec();     // 阴影贴图分辨率跟随画质档位
    specs.forEach(s => {
      let l;
      if (s.type === 'hemi') l = new THREE.HemisphereLight(s.sky, s.ground, s.intensity);
      else if (s.type === 'ambient') l = new THREE.AmbientLight(s.color, s.intensity);
      else if (s.type === 'dir') l = new THREE.DirectionalLight(s.color, s.intensity);
      else if (s.type === 'spot') {
        l = new THREE.SpotLight(s.color, s.intensity, s.distance ?? 0, s.angle ?? 0.9, s.penumbra ?? 0.8, s.decay ?? 2);
      } else if (s.type === 'point') l = new THREE.PointLight(s.color, s.intensity, s.distance ?? 0, s.decay ?? 2);
      if (!l) return;

      if (s.pos) l.position.set(...s.pos);
      if (s.target) {
        if (l.target) { l.target.position.set(...s.target); this.scene.add(l.target); }
        else if (l.position) l.position.set(...s.pos);
      }
      if (s.shadow) {
        l.userData.wantsShadow = true;   // 记住“这盏灯本来就该投影”，切档位时才回得来
        l.castShadow = q.shadow;
        const sc = s.shadowCam || { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 30 };
        const size = Math.min(s.shadowSize || q.shadowSize, q.shadowSize);
        l.shadow.mapSize.set(size, size);
        l.shadow.camera.left = sc.left; l.shadow.camera.right = sc.right;
        l.shadow.camera.top = sc.top; l.shadow.camera.bottom = sc.bottom;
        l.shadow.camera.near = sc.near; l.shadow.camera.far = sc.far;
        l.shadow.bias = -0.0006;
        /* ⚠️ normalBias **必须随阴影精度走**，不能写死（第 54 轮实测）：
           pv / wind 的 shadowCam 跨度 32m，低档 mapSize 512 时每 texel = 62.5mm，
           而写死的 0.02（20mm）连 1 个 texel 都盖不住 ⇒ 阴影出现条纹 / 相机一动就像在闪。
           取 max(0.02, texel × 1.4)：小场景保持 0.02，大场景自动放大到够用。 */
        const shadowSpan = Math.max(sc.right - sc.left, sc.top - sc.bottom);
        const shadowTexel = shadowSpan / size;
        l.shadow.normalBias = Math.max(0.02, shadowTexel * 1.4);
        l.shadow.camera.updateProjectionMatrix();
      }
      l.userData.baseIntensity = s.intensity;
      this.scene.add(l);
      this.baseLights.push(l);
    });
  }

  /* ---------------- 热点 / 标记 ---------------- */
  buildHotspots(hotspots) {
    /* ⚠️ 重复 key 必须在这里抓出来 —— hotspotById 是 Map，重名的后一只会**静默覆盖**
       前一只：场景里装了三只 MCCB 而只给了 id 没给 key 时，点第二只会选中第三只、
       卡片显示同一份档案，从界面上完全看不出哪里错了（dcpanel 踩过）。
       所以额外记一份原始列表，回归脚本用它比对 `hotspots.length vs Map.size`。 */
    this.hotspotList = hotspots;
    this.dupKeys = [];
    const seenKey = new Set();
    hotspots.forEach(h => {
      /* 元件既可能是本公司产品，也可能是场景里的通用元件 / 外购主设备，
         统一走 elementById；找不到档案的直接跳过（纯结构件不参与点击）。 */
      const p = elementById(h.id);
      if (!p) return;
      if (seenKey.has(h.key)) this.dupKeys.push(h.key);
      seenKey.add(h.key);
      this.hotspotById.set(h.key, h);

      h.object.updateWorldMatrix(true, false);

      /* ---- 世界包围盒 ----
       * 优先用热点自带的局部包围盒（build 阶段、批处理之前就量好的）。
       * 通用元件在 batchStatic 之后只剩一个空 Group，setFromObject 量不到东西，
       * 取景会退化成 NaN、代理也建不出来。
       */
      const bb = new THREE.Box3();
      if (h.box) bb.copy(h.box).applyMatrix4(h.object.matrixWorld);
      else bb.setFromObject(h.object);

      const world = new THREE.Vector3();
      h.object.getWorldPosition(world);
      h.anchor = world.clone().add(h.offset);

      /* ---- 自动取景：按模型实际尺寸 + 安装朝向，生成 3/4 视角 ----
       * 手写 focus.pos 很容易在“贴太近变成白墙特写”和“太远看不见”之间翻车，
       * 这里统一由产品包围盒 + 正面法线推导，保证任何尺寸的产品都有合适构图。
       */
      const size = bb.getSize(new THREE.Vector3());
      const center = bb.getCenter(new THREE.Vector3());
      const rad = Math.max(size.x, size.y, size.z) * 0.5 || 0.04;
      // 户内场景用了更宽的 FOV，同样的距离下产品会显小，这里按 FOV 反算补偿
      const fovK = Math.tan(19 * Math.PI / 180) / Math.tan((this.camera.fov / 2) * Math.PI / 180);
      const nrm = new THREE.Vector3(0, 0, 1)
        .applyQuaternion(h.object.getWorldQuaternion(new THREE.Quaternion()))
        .normalize();
      const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), nrm);
      if (right.lengthSq() < 1e-8) right.set(1, 0, 0); else right.normalize();
      const dist = clamp((rad * 3.4 + 0.55) * fovK, 0.80, 3.8);
      h.view = {
        pos: [
          center.x + nrm.x * dist * 0.86 + right.x * dist * 0.26,
          center.y + dist * 0.22,
          center.z + nrm.z * dist * 0.86 + right.z * dist * 0.26,
        ],
        target: [center.x + nrm.x * 0.04, center.y - 0.004, center.z + nrm.z * 0.04],
      };
      if (!h.focus) h.focus = h.view;

      // 标记点
      if (h.marker) {
        const col = new THREE.Color(elemColor(p));
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({
          map: markerTex, color: col, transparent: true, depthWrite: false,
          blending: THREE.AdditiveBlending, opacity: 0.9,
        }));
        sp.position.copy(h.anchor);
        sp.scale.setScalar(0.055);
        sp.userData.hotspotId = h.key;
        sp.userData.baseScale = 0.055;
        this.scene.add(sp);
        this.markers.push(sp);
        h.markerSprite = sp;
      }

      // HTML 标签
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'hot-label';
      el.dataset.id = h.key;
      el.style.setProperty('--c', elemColor(p));
      el.innerHTML = `<i></i><span>${p.n}<em>${elemSub(p)}</em></span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); this.selectProduct(h.key, { fly: true }); });
      el.addEventListener('pointerenter', () => { this.hoveredId = h.key; this.applyLabelState(); });
      el.addEventListener('pointerleave', () => { this.hoveredId = null; this.applyLabelState(); });
      this.labelLayer.appendChild(el);
      this.labels.push({ el, h });
      /* 标签避让优先级：本公司产品（0）压过通用元件（1）。
         十几个元件挤在一个二次室里时，至少要保证「我们的产品」那一批是可读的。 */
      h.pri = (p.origin && p.origin !== 'own') ? 1 : 0;

      /* ---- 隐形拾取代理（见文件头 proxyPickMat 的说明）----
       * 通用元件带 h.box，说明它会被批处理合并成空壳，必须补代理；
       * 产品模型保留自己的 Mesh（userData.pid 让 batchStatic 跳过它），直接拿 Group 当靶子。
       */
      let pickObj = h.object;
      if (h.box) {
        const sz = bb.getSize(new THREE.Vector3());
        const proxy = new THREE.Mesh(
          new THREE.BoxGeometry(Math.max(sz.x, 0.02), Math.max(sz.y, 0.02), Math.max(sz.z, 0.02)),
          proxyPickMat
        );
        proxy.position.copy(h.box.getCenter(new THREE.Vector3()));
        proxy.visible = false;
        proxy.userData.pickProxy = true;
        h.object.add(proxy);
        h.pickProxy = proxy;
        pickObj = proxy;
      }
      this.pickTargets.push(pickObj);
      if (h.markerSprite) this.pickTargets.push(h.markerSprite);
    });
    /* 避让用的固定顺序（不随帧变化，所以标签不会来回跳）。 */
    this.labelOrder = this.labels.slice().sort((a, b) => a.h.pri - b.h.pri);
    this.applyLabelState();
  }

  applyLabelState() {
    /* 标注三档（见 this.labelMode 的注释）。`h.pri === 0` 就是本公司产品
       —— 这个优先级在 buildHotspots 里已经算好了，这里只读、不再算一遍。
       ⚠️ **档位 2「隐藏」要连选中项一起收掉**。原先「关掉标注」时选中 / 悬停的
          那一条照常显示（`|| key === selectedId || key === hoveredId` 在判断之外），
          于是「隐藏」档下永远还剩一条 —— 用户按「隐藏」是要一张干净画面
          （截图 / 给客户看），剩一条就等于没隐藏。实测：隐藏档下仍可见 1 条标签、
          31 个发光标记点全亮着。
          现在的口径：**档位 2 只留「正在指的那一个」（悬停）**；
          悬停是当下的动作、会自己消失，不属于"标注"。选中态仍然由
          3D 高亮 + 右栏卡片 + 产品列表三处表达，信息没有丢。 */
    const m = this.labelMode | 0;
    this.labels.forEach(({ el, h }) => {
      /* quiet 元件的标签不参与「显示全部标签」——它们大多藏在柜门后面，
         标签锚点落在柜体内部，全开时会穿透柜门糊在正面。
         悬停 / 选中时照常出现，所以信息没有丢。 */
      const own = h.pri === 0;
      const sel = h.key === this.selectedId, hov = h.key === this.hoveredId;
      const on = m === 2
        ? hov
        : (((m === 1 || own) && !h.quiet) || sel || hov);
      el.classList.toggle('hidden', !on);
      el.classList.toggle('active', sel);
      el.classList.toggle('hover', hov);
    });
    /* ⚠️ 发光标记点跟着同一档位走。原先它只认 `showLabels`，
       三态之后必须一起改 —— 否则「隐藏标注」时圆点还亮着，
       用户会以为还有一堆可点但看不见标签的东西。 */
    this.markers.forEach(s => {
      const id = s.userData.hotspotId;
      const hs = this.hotspotById.get(id);
      const own = !!hs && hs.pri === 0;
      const sel = id === this.selectedId, hov = id === this.hoveredId;
      const vis = m === 2 ? hov : ((m === 1 || (m === 0 && own)) || sel || hov);
      s.userData.targetOpacity = vis ? (sel ? 1 : 0.55) : 0;
    });
  }

  /**
   * 循环切换标注档位：只标本公司 → 全部 → 隐藏 → 只标本公司。
   *
   * ⚠️ 按钮文字**固定**写「标注」，一个字符都不随档位变 ——
   *    顶栏是「宽度会浮动的项」最容易挤掉场景名的位置（§T1，`#btn-quality` 踩过）。
   *    档位改用三处说：`.on`/`.is-all` 两个类、`title`+`aria-label`、以及一条 toast。
   * ⚠️ `aria-pressed` 必须始终与 `.on` 一致（a11y_probe 逐颗按钮断言这一条）。
   */
  cycleLabels() {
    const btn = this.$('#btn-labels');
    if (!btn) return;
    this.labelMode = ((this.labelMode | 0) + 1) % 3;
    const m = this.labelMode;
    const TIP = [
      '标注：只显示本公司产品（再按：显示全部元件）',
      '标注：显示全部元件（再按：全部隐藏）',
      '标注：已全部隐藏（再按：只显示本公司产品）',
    ];
    btn.classList.toggle('on', m !== 2);
    btn.classList.toggle('is-all', m === 1);
    btn.setAttribute('aria-pressed', m !== 2 ? 'true' : 'false');
    btn.title = TIP[m];
    btn.setAttribute('aria-label', TIP[m]);
    this.applyLabelState();
    this.toast(['标注：只显示本公司产品', '标注：显示全部元件', '标注：已隐藏全部标注'][m]);
    this._needsRender = true;
  }

  /* ---------------- 选中 / 高亮 ---------------- */
  /**
   * 由「热点实例 key」取元件档案。
   * 同一个元件在一个场景里可能装好几只（直流屏 3 只 MCCB），
   * 所以热点用 key 区分实例，档案仍按 id 查。
   */
  elementOf(key) {
    const h = this.hotspotById.get(key);
    return elementById(h ? h.id : key);
  }

  /**
   * key 是「热点实例 key」，id 是「元件档案 id」。
   */
  selectProduct(key, opt = {}) {
    const h = this.hotspotById.get(key);
    const p = elementById(h ? h.id : key);
    if (!p) return;
    const id = key;

    this.deselect(true);
    this.selectedId = id;

    // 高亮材质
    if (h && h.object.userData.hlMats) {
      h.object.userData.hlMats.forEach(m => {
        m.userData._em = m.emissive ? m.emissive.getHex() : 0;
        m.userData._ei = m.emissiveIntensity;
      });
    }
    this.hlTarget = 1;

    // 光环
    if (h) {
      if (!this.ring) {
        this.ring = new THREE.Sprite(new THREE.SpriteMaterial({
          map: ringTex, color: new THREE.Color(elemColor(p)), transparent: true,
          depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
        }));
        this.scene.add(this.ring);
      }
      this.ring.material.color.set(elemColor(p));
      this.ring.position.copy(h.anchor);
      this.ringT = 0;
    }

    // 相机（优先使用自动推导的 3/4 取景）
    const view = h && (h.view || h.focus);
    if (opt.fly !== false && view) {
      this.flyTo(new THREE.Vector3(...view.pos), new THREE.Vector3(...view.target), 0.95);
    }

    // 安装位置指示（从设备垂直下引虚线 + 地面标记环）
    if (h) this.setPin(h.anchor, elemColor(p));

    // 面板
    this.renderCard(p, h);

    // 列表高亮
    document.querySelectorAll('.pcard').forEach(el => el.classList.toggle('on', el.dataset.id === id));
    this.applyLabelState();
    if (!opt.silent) {
      this.$('#panel').classList.add('has-sel');
      /* ⚠️ 选中产品 = 面板真的有内容了 → 「收起产品面板」按钮此时才该出现
         （`_syncInert()` 里按 `has-sel` 决定它的可见性）。
         只有这里会改这个 class，所以同步点也放这里。 */
      this._syncInert();
    }
  }

  deselect(silent) {
    if (!this.selectedId) return;
    const h = this.hotspotById.get(this.selectedId);
    if (h && h.object.userData.hlMats) {
      h.object.userData.hlMats.forEach(m => {
        if (m.userData._em !== undefined && m.emissive) m.emissive.setHex(m.userData._em);
        if (m.userData._ei !== undefined) m.emissiveIntensity = m.userData._ei;
      });
    }
    this.hlTarget = 0;
    if (this.ring) this.ring.material.opacity = 0;
    this.selectedId = null;
    this.clearPin();
    document.querySelectorAll('.pcard').forEach(el => el.classList.remove('on'));
    if (!silent) {
      this.$('#panel').classList.remove('has-sel');
      this.renderCardEmpty();
      /* 面板空了 → 「收起产品面板」按钮也该跟着消失（否则又是一个「点了没反应」的死按钮）。 */
      this._syncInert();
    }
    this.applyLabelState();
  }

  flyTo(pos, target, dur = 0.9) {
    this.tweens.kill('cam');
    /* 「减少动效」：相机**直接跳**到目标位。
       相机飞行是这一页最容易引起不适的动效（大范围位移 + 透视剧变），优先压掉。
       ⚠️ 早退分支千万别忘了 `controls.enabled = true` —— 正常路径是靠补间的
          onDone 恢复的，这里不恢复的话用户会发现「点了没反应，而且鼠标也拖不动了」。 */
    if (RM) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.enabled = true;
      this.controls.update();
      this._needsRender = true;
      return;
    }
    const p0 = this.camera.position.clone();
    const t0 = this.controls.target.clone();
    this.controls.enabled = false;
    this.tweens.add({
      tag: 'cam', dur, ease: easeInOutQuint,
      onUpdate: (e) => {
        this.camera.position.lerpVectors(p0, pos, e);
        this.controls.target.lerpVectors(t0, target, e);
        this.controls.update();
      },
      onDone: () => { this.controls.enabled = true; },
    });
  }

  resetView() {
    this.flyTo(this.homePos.clone(), this.homeTarget.clone(), 0.9);
  }

  /**
   * 「全场景入画」—— 把本场景的**设备**整体框进画面（双击空白处触发）。
   *
   * 为什么不复用 `resetView()`：`homePos` 是场景声明的**默认机位**，为了突出主角
   * （assembly 的默认机位就收在工位 1 的门板上、kyn28 收在二次室），并不保证看得到全场。
   * 用户想知道「这一场到底有些什么」时，按 R 复位是没用的。
   *
   * ⚠️ 必须把**房间**（墙 / 地 / 天花 / 踢脚线 / 地面标线）排除在包围盒之外：
   *    房间的 AABB 就是整间屋子（assembly 实测 13.5×4.35×9），框住它等于把相机
   *    推到屋外贴着墙看，设备反而缩成一小团。
   *    判据不能只看「顶层对象大不大」—— roomBox 返回的是一个 Group，它的 AABB
   *    是个实心盒子。要逐个 mesh 判：**这一棵子树里全是「又薄又大」的片**，
   *    才认定是房间（墙 13.5×4.35×0、地 16.2×16.2×0、踢脚线 13.5×0.12×0.012
   *    都是这个形状；柜体立柱 0.022×2.2×0.022 不是）。
   */
  fitAll() {
    const root = this.contentRoot;
    if (!root) return;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    const s3 = new THREE.Vector3();
    const sheetLike = (n) => {
      n.geometry.computeBoundingBox();
      const b = n.geometry.boundingBox;
      if (!b) return false;
      b.getSize(s3);
      const d = [s3.x, s3.y, s3.z].sort((a, b2) => a - b2);
      return d[0] < 0.06 && d[2] > 3;
    };
    const isRoom = (c) => {
      let any = false;
      let all = true;
      c.traverse((n) => {
        if (!n.isMesh || n.isInstancedMesh || n.isSprite) return;
        if (!n.geometry || !n.geometry.attributes || !n.geometry.attributes.position) return;
        any = true;
        if (!sheetLike(n)) all = false;
      });
      return any && all;
    };
    root.children.forEach((c) => {
      if (isRoom(c)) return;                       // 房间：整棵跳过
      /* 远景 / 场坪：整棵跳过。
         ⚠️ 不排的话户外场景会**跑飞** —— rmu 的草地环半径 52m、树线在 46~58m 外，
            并进包围盒之后包围球半径到几十米，相机被推到 maxDistance 之外，
            柜体被挤出画面（实测「全景」只剩一根电杆和几棵树，柜子完全看不见）。
            场景侧用 `userData.scenery = true` 显式标注，与 door / slide 同一套约定。 */
      if (c.userData && c.userData.scenery) return;
      tmp.setFromObject(c);
      if (!isFinite(tmp.min.x) || tmp.isEmpty()) return;
      tmp.getSize(s3);
      if (Math.max(s3.x, s3.y, s3.z) > 150) return;  // 天空球：不是设备
      box.union(tmp);
    });
    if (!isFinite(box.min.x) || box.isEmpty()) return;

    const ctr = box.getCenter(new THREE.Vector3());
    const sph = box.getBoundingSphere(new THREE.Sphere());
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (this.camera.aspect || 1));
    /* ⚠️ **不要 clamp 到 `controls.maxDistance`**。原来是 clamp 的，后果是：
        算出来的距离超限 → 相机被硬拽回来 → 「本该框进画面」的东西反而被裁在画外，
        而且越大的场景错得越离谱（与 fitCamera 同源的问题）。
        正确做法跟 fitCamera 一致：**把 maxDistance 放宽**到够用为止。 */
    const dist = Math.max(1.0,
      sph.radius / Math.sin(Math.min(vFov, hFov) / 2) * 1.06);
    this.controls.maxDistance = Math.max(this._maxDBase ?? 12, dist * 1.35);
    /* 留一份诊断快照：无头回归脚本要拿它判断「该入画的到底有没有入画」
       （判据不能只看相机位置 —— 相机在不在目标位是一回事，
        设备有没有真的落在视锥里是另一回事）。 */
    this._fitBox = box.clone();
    this._fitDist = dist;
    this._fitSphR = sph.radius;
    /* 方位角保持用户当前视线（硬掰回正面会让人失去方位感，同 locateMovers），
       只把仰角抬到约 22° —— 这样地面与柜顶同时可见。 */
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    dir.y = 0;
    if (dir.lengthSq() < 1e-8) dir.set(0.35, 0, 1);
    dir.normalize();
    dir.y = 0.40;
    dir.normalize();
    this.flyTo(ctr.clone().addScaledVector(dir, dist), ctr, 0.85);
  }

  /* ---------------- 安装位置指示 ---------------- */
  /** 从设备向下引出的虚线 + 地面标记环，直观说明“装在哪、装多高” */
  setPin(anchor, colorHex) {
    if (!this.pin) {
      this.pin = new THREE.Group();
      this.pin.visible = false;
      this.scene.add(this.pin);
    }
    // 清掉上一组
    this.pin.children.slice().forEach(c => { this.pin.remove(c); c.geometry?.dispose?.(); });
    this.pinMat?.dispose?.();
    this.pinRingMat?.dispose?.();

    const h = Math.max(0.16, anchor.y);
    const col = new THREE.Color(colorHex);
    const dash = 0.026, gap = 0.019, unit = dash + gap;
    const n = clamp(Math.floor((h - 0.05) / unit), 2, 120);
    this.pinMat = new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0, depthWrite: false, fog: true,
    });
    const geo = new THREE.CylinderGeometry(0.0032, 0.0032, dash, 6);
    const im = new THREE.InstancedMesh(geo, this.pinMat, n);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      mtx.makeTranslation(0, 0.035 + i * unit + dash / 2, 0);
      im.setMatrixAt(i, mtx);
    }
    im.frustumCulled = false;
    this.pin.add(im);

    // 顶端指示锥（指向安装点）
    this.pinRingMat = new THREE.MeshBasicMaterial({
      map: ringTex, color: col, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.032, 12), this.pinRingMat);
    cone.position.y = h - 0.016;
    cone.rotation.x = Math.PI;      // 尖朝下
    this.pin.add(cone);

    // 地面标记环
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), this.pinRingMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    this.pin.add(ring);

    this.pin.position.set(anchor.x, 0, anchor.z);
    this.pin.visible = true;
    this.pinT = 0;
    this.pinOn = true;
  }

  clearPin() {
    this.pinOn = false;
  }

  /* ---------------- 爆炸视图 ---------------- */
  collectExplode(root) {
    this.exList = [];
    root.traverse(o => {
      if (o.userData && o.userData.explode) {
        /* ⚠️ 只记第一次。手车既是爆炸组又是推拉件，collectMovers 已经存过基准位了；
           这里再 clone 一次会把「已经摇出」的位置当成基准位，一摇就跳。 */
        if (!o.userData._base) o.userData._base = o.position.clone();
        this.exList.push(o);
      }
    });
  }

  toggleExplode() {
    this.explode = !this.explode;
    const b = this.$('#btn-explode');
    b?.classList.toggle('on', this.explode);
    b?.setAttribute('aria-pressed', this.explode ? 'true' : 'false');
    return this.explode;
  }

  /* ---------------- 可动件：柜门开合 + 手车推拉 ----------------
   * 场景在 build 阶段给可动件 Group 打标记，这里统一收集，之后由 applyDoors() 驱动：
   *
   *   userData.door  = true                —— 绕 Y 开合。open 取 build 时已设好的 rotation.y，closed = 0
   *   userData.door  = { open, closed }    —— 显式给两个姿态角（单位 rad，rotation.y）
   *   userData.slide = { open:[dx,dy,dz] } —— 沿固定方向平移（手车 / 抽屉）。
   *                                           open 也可写成单个数字（＝沿 +z 推多远）
   *
   * 推拉件要声明「它归哪扇门管」，联锁与收回都靠这个字段：
   *   slide.door = <那扇门的门轴 Group>
   *     · 门没开 → 不许摇出（门扇正好挡在行程上，强行摇出去就是穿模）
   *     · 门要关 → 先把推拉件收回柜内（否则门扇会从它身上扫过去）
   *   ⚠️ 不能用「离得最近的门」去猜：手车在 y=0.80，电缆室门铰点在 y=0.42、
   *      手车室门铰点在 y=1.25 —— 按距离算电缆室门反而更近，猜出来是错的。
   *
   * 两个可选钩子可以覆盖默认行为（场景侧写闭包）：
   *   slide.guard()       → 返回字符串 = 拦下并把理由 toast 出来；返回 falsy = 放行。
   *   slide.onClose(door) → 门要关上了（door 为 null 表示「全部关门」，即一键全关）。
   *
   * ⚠️ 全库统一约定：门轴 rotation.y = 0 就是**关闭** —— 铰点落在门洞边缘，门扇中心挂在
   *    朝门洞**里**那一侧（local x 指向房间内），所以不转的时候门正好盖在门洞上，
   *    而且门板 local +z（把手 / 锁 / 铭牌 / 百叶 / 警示牌）朝**外**。
   *    boxsub 一度是例外：门板挂点写反了，靠 closed = ±π 硬掰回门洞上，
   *    结果转 π 把门板正反面调了个个儿 —— 一键全关之后看到的是六块光板，
   *    百叶 / 铭牌 / 把手 / 锁全转进箱内。第 28 轮已按本条约定改正，
   *    现在 9 个场景口径完全一致（回归脚本 door_normal.js 守这条）。
   *
   * ⚠️ 门轴必须同时是批处理边界，否则门扇会被 batchStatic 合并进大网格、旋转不动。
   *    所以 optimize.js 的 BOUNDARY 把 userData.door 和 explode / keepSeparate 一视同仁。
   */
  collectMovers(root) {
    this.doorList = [];
    root.traverse(o => {
      const u = o.userData;
      if (!u) return;
      const d = u.door, sl = u.slide;
      if (!d && !sl) return;

      if (d) {
        const open = (typeof d === 'object' && d.open != null) ? d.open : o.rotation.y;
        const closed = (typeof d === 'object' && d.closed != null) ? d.closed : 0;
        u._dOpen = open;
        u._dClosed = closed;
        /* 初始姿态**从场景 build 出来的样子反推**，不能硬编码「全开」：
           有的门场景里本来就摆成敞开的（露出柜内产品），有的是闭合的、等用户点开。
           k = 0 关 / 1 开。 */
        const span = open - closed;
        const k0 = Math.abs(span) < 1e-6 ? 1 : clamp((o.rotation.y - closed) / span, 0, 1);
        u._dK = k0;
        u._dTarget = k0 >= 0.5 ? 1 : 0;
        o.rotation.y = closed + span * k0;      // 立即落到初始姿态，不等下一帧
        /* 预存「门完全关闭时的世界 AABB」。
           用途见 _updateDoorOcclusion()：标签是 HTML 浮层、不参与深度测试，
           门一关，柜内元件的标签会直接糊在门板上。有了这个盒子就能判断
           哪个热点落在门洞后面、该跟着一起藏起来。
           算的时候临时把门摆到关闭姿态，算完立刻还原。 */
        const keep = o.rotation.y;
        o.rotation.y = closed;
        o.updateWorldMatrix(true, true);
        u._dShutBox = new THREE.Box3().setFromObject(o);
        /* 悬停气泡的锚点：门板子树的**局部**中心。
           ⚠️ 必须在「摆成关闭姿态、矩阵已更新」的这一刻换算 —— worldToLocal 用的是
              当前 matrixWorld，等门转回开姿态再换算出来的就不是门板中心了。 */
        u._dCenter = o.worldToLocal(u._dShutBox.getCenter(new THREE.Vector3()));
        o.rotation.y = keep;
        o.updateWorldMatrix(true, true);
      }

      if (sl) {
        /* 推拉件（手车 / 抽屉）：沿固定方向平移。
           open 可以写成 [dx,dy,dz]，也可以写成单个数字（＝沿 +z 推多远）。
           初始 k 从「当前位移 / 全行程」反推 —— 场景摆在哪就是哪，不硬编码。 */
        if (!u._base) u._base = o.position.clone();
        const arr = Array.isArray(sl.open) ? sl.open : [0, 0, sl.open || 0];
        u._dSlide = arr;
        const del = [o.position.x - u._base.x, o.position.y - u._base.y, o.position.z - u._base.z];
        let k0 = 0;
        for (let i = 0; i < 3; i++) {
          if (Math.abs(arr[i]) > 1e-6) { k0 = clamp(del[i] / arr[i], 0, 1); break; }
        }
        u._dK = k0;
        u._dTarget = k0 >= 0.5 ? 1 : 0;
      }
      u._dWait = 0;                    // 一键序列的排队余量（第 39 轮）

      this.doorList.push(o);
      /* ⚠️ 可动件必须进 pickTargets —— 它原本只收热点代理盒与标记球，
         不加这一行 pickAt() 永远命中不到门（实测 9 扇全部落空）。 */
      this.pickTargets.push(o);
    });

    /* 建「门 → 它挡着的推拉件」反查表。一键全开的先后顺序全靠它：
       门先开、手车后出；一键全关反过来，手车先回、门后关（见 applyDoors）。 */
    for (const m of this.doorList) {
      const sl = m.userData.slide;
      if (!sl || !sl.door) continue;
      const d = sl.door;
      if (!d.userData || !d.userData.door) continue;
      if (!d.userData._dSlides) d.userData._dSlides = [];
      d.userData._dSlides.push(m);
    }

    this.hoveredDoor = null;
    this._syncDoorBtn();
    /* 换场景时把「开合中…」清掉 —— 否则在新场景里点门，
       按钮上还顶着上一场那次序列留下的转圈。 */
    this._setDoorBusy(false);
    this.renderMoverSummary();
    this._updateDoorOcclusion();
  }

  /**
   * 门关上了，门洞后面的热点标签必须跟着藏起来。
   *
   * 为什么不能靠标签避让算法兜：标签是 HTML 浮层，根本不参与 3D 深度测试，
   * 门板挡不住它 —— 用户把中柜二次室门关上，里面继电器的标签会照常浮在门板正面，
   * 看起来就像「标签贴错了地方」。
   *
   * 判据用**预存的门关闭 AABB**（见 collectMovers），不做射线 —— 射线要遍历全场景，
   * 每帧几十条太贵；门关着时门扇本身就是一块薄板，它的轴对齐盒几乎就是门洞矩形，
   * 落在里面的锚点必然被挡住。门开到 12% 以上就不再算遮挡（这时门缝已经能看见了）。
   */
  _updateDoorOcclusion() {
    const list = this.hotspotList || [];
    for (const h of list) h._doorHidden = false;
    if (!this.doorList || !this.doorList.length) return;
    /* ⚠️ 两个容差**必须分开**（第 55 轮修）：
       · `EPS_XY` —— 「锚点在不在门洞矩形内」。留正余量是合理的：门扇包围盒
         含折边、把手、锁、铭牌，比门洞本身略大略小。
       · `BACK` —— 「锚点在不在门扇**之后**」。这里**只许往柜内让，绝不能往柜外让**。
         原来三轴共用一个 `+EPS`，等于把「门板**前方** 20mm 以内」也判成门后；
         而装在门板**外表面**的元件（SMART_OPS / HMI 都是这么装的）锚点恰好
         落在这个带里 ⇒ 标签被无声吞掉。
         实测（doorbox55.js）：中柜手车室门 shut box z 到 −0.518，SMART_OPS
         锚点 z = −0.501（在门盒**前方** 17.5mm），被 +0.02 吞；EPS 降到 0
         时遮挡集从 8 掉到 6，掉的正是它和 IED —— 而 IED 那个是**对的**
         （见 kyn28.js 632~640 行：它是特意装在继电器室下方、手车室上部的，
          确实在关闭的手车室门后面），所以只修 z 方向、不动 x/y。 */
    const EPS_XY = 0.02;
    const BACK = 0.012;
    for (const d of this.doorList) {
      if (!d.userData.door) continue;                   // 推拉件没有门洞盒，跳过
      if (d.userData._dK > 0.12) continue;              // 门开着 → 不挡
      const box = d.userData._dShutBox;
      if (!box) continue;
      for (const h of list) {
        const a = h.anchor;
        if (!a) continue;
        /* ⚠️ 挂在**这扇门自己身上**的元件，永远不该被这扇门遮挡（第 55 轮根治）。
           操显装置、就地人机界面都是贴门板**外表面**装的，跟着门一起开合，
           始终在门的同一侧。而 `_dShutBox` 是**整扇门**（含折边、把手、锁、
           铭牌，以及挂在门上的元件本身）的包围盒 ⇒ 光靠 z 余量去猜
           「锚点够不够靠外」，等于「把手凸出多少就挪多少」，永远差一点
           （实测：kyn28 靠 BACK 治好了，rmu 又冒出来一个）。
           改按**拓扑归属**判：沿 `h.object` 往上走，第一个带 `userData.door`
           的节点就是它的「门主」；门主 === 当前这扇门 ⇒ 跳过。
           与门板厚度、把手凸出量都无关，也不会误放任何柜内元件。
           懒算一次缓存 —— 父链不会变，场景重建时热点是新对象、自然重算。 */
        if (h._doorOwner === undefined) {
          let own = null;
          for (let n = h.object; n; n = n.parent) {
            if (n.userData && n.userData.door) { own = n; break; }
          }
          h._doorOwner = own;
        }
        if (h._doorOwner === d) continue;
        /* ⚠️ 不能用 box.containsPoint()。_dShutBox 是**门扇自己**的包围盒，
           z 方向只有一块钣金的厚度（16mm 上下），而柜内元件的锚点在门扇**后面**
           几十厘米处，根本落不进盒里 —— 实测那样写一条标签都藏不掉。
           正确判据是「把锚点投到门扇平面上看它在不在门洞范围内、且在门扇之后」：
             · x / y 落在门洞矩形内（±2cm 容差）
             · z 不晚于门扇平面（即锚点在柜内一侧，不是门外的东西） */
        if (a.z <= box.max.z - BACK
          && a.x >= box.min.x - EPS_XY && a.x <= box.max.x + EPS_XY
          && a.y >= box.min.y - EPS_XY && a.y <= box.max.y + EPS_XY) {
          h._doorHidden = true;
        }
      }
    }
  }

  /* 逐门阻尼插值。返回「这一帧有没有门在动」，供 renderLevel() 决定要不要继续出帧。
   *
   * ⚠️ 这里驱动的是**有效目标**（tgt），不是 u._dTarget 本身 —— 两者在
   *    「一键全开 / 全关」时故意不同步，先后顺序就是靠这个差值做出来的：
   *      · 一键全开：所有 _dTarget 一起置 1，但手车的有效目标先被按在 0，
   *        等所在室的门开到 _slideGate() 门槛，它才自己往外走；
   *      · 一键全关：所有 _dTarget 一起置 0，但门的有效目标先被顶在 1，
   *        等它挡着的手车退回柜内（< 0.02）才落闩。
   *    两个方向都不会出现「门扇从手车身上扫过去」。
   *    好处是不用 setTimeout / 状态机：门和手车仍然是同一套阻尼插值，
   *    中途用户再点一下也不会打架 —— 有效目标下一帧就重算。
   */
  applyDoors(dt) {
    if (!this.doorList || !this.doorList.length) return false;
    let moving = false, waiting = false;
    for (const o of this.doorList) {
      const u = o.userData;
      /* 第 39 轮：一键序列的**排队等待**（门与门之间错开）。
         ⚠️ 递减必须**封顶**：低帧率下 dt 能到 0.5，不封顶一帧就把 9 扇门的等待
            全减完 → 序列等于没做。
         ⚠️ 封顶取 **0.30s（= 3 个 STEP）**而不是 STEP 本身：软渲染 1 FPS 时，
            按「每帧最多过 1 扇」要 9 帧 ≈ 9 秒，低配机上「一键全开」会慢得离谱
            （实测把 door_all 的 7s 等待都撑爆了）。0.30 让低帧率下每帧过 3 扇
            —— 仍看得出层次，3 帧收工。
         ⚠️ 等待期**必须计入返回值**：`_doorsMoving` 挂着 renderLevel 的强制出帧，
            返回 false 会「不出帧 → `_dWait` 不推进 → 序列卡死」。 */
      if (u._dWait > 0) {
        u._dWait = Math.max(0, u._dWait - Math.min(dt, 0.30));
        waiting = true;
        continue;
      }
      let tgt = u._dTarget;

      /* ① 推拉件：门还没开够 → 按住不动。 */
      if (u._dSlide && tgt > 0.5 && this._slideBlock(u)) tgt = 0;

      /* ② 门：配对的推拉件还没收回来 → 顶住不关。 */
      if (u._dOpen != null && tgt < 0.5 && u._dSlides) {
        for (const s of u._dSlides) {
          if ((s.userData._dK || 0) > 0.02) { tgt = 1; break; }
        }
      }

      let k = u._dK;
      if (Math.abs(k - tgt) > 0.0008) {
        if (RM) {
          /* 「减少动效」：瞬时到位。
             ⚠️ 但**必须照旧置 `moving = true`** —— applyMotion（推拉件位置）、
                _updateDoorOcclusion（门洞遮挡）、阴影重算都挂在它上面，
                只把 k 拨到 tgt 而不置 moving，会出现「门跳过去了但画面没更新」。
             ⚠️ 两段式联锁也不受影响：门先到位、配对的推拉件下一帧才被放行，
                只是「各占一帧」而已（肉眼即瞬时）。 */
          k = tgt;
        } else {
          /* 节奏比爆炸视图慢一档：门是有质量的钣金件，0.0035 那种「瞬间到位」看着像纸片。
             关门系数略大于开门 —— 收尾有减速感，接近真门撞到锁扣的手感。 */
          k = lerp(k, tgt, 1 - Math.pow(tgt > k ? 0.055 : 0.075, dt));
          if (Math.abs(k - tgt) < 0.0008) k = tgt;
        }
        u._dK = k;
        moving = true;
      }
      /* 门 → 写 rotation.y；推拉件 → 位置由 applyMotion() 按同一个 k 算，这里不碰它 */
      if (u._dOpen != null) o.rotation.y = lerp(u._dClosed, u._dOpen, k);
    }
    if (moving) {
      this.renderer.shadowMap.needsUpdate = true;
      this.applyMotion();              // 推拉件的位置跟着 k 走
      this._updateDoorOcclusion();     // 门在动 → 门洞遮挡关系跟着变
    }
    return moving || waiting;
  }

  /** 单个可动件开 / 关（点击门扇或手车时调用）。返回新的目标位（1 开 / 0 关）。 */
  toggleDoor(o) {
    const u = o.userData;
    const t = u._dTarget > 0.5 ? 0 : 1;
    /* 联锁：手车室门关着时点手车 → 拦下并说明理由。 */
    if (t === 1 && u.slide) {
      const why = this._slideBlock(u);
      if (why) { this.toast(why, 'warn'); return u._dTarget; }
    }
    u._dTarget = t;
    u._dWait = 0;                             // 单扇操作不排队（只有一键才有序列）
    if (t === 0) this._retractSlides(o);      // 关门之前，先把它挡着的推拉件收回去
    this._syncDoorBtn();
    this._needsRender = true;
    return t;
  }

  /**
   * 推拉件能不能动？返回 null = 放行，返回字符串 = 拦下的理由（调用方负责 toast）。
   *
   * 默认联锁：`slide.door` 那扇门没开就不许摇出 —— 门扇正好横在推拉件的行程上，
   * 强行摇出去就是穿模。场景可以用 `slide.guard()` 覆盖（换成更具体的说法）。
   */
  _slideBlock(u) {
    const sl = u.slide;
    if (typeof sl.guard === 'function') return sl.guard() || null;
    const d = sl.door;
    if (d && d.userData.door && d.userData._dK < this._slideGate(u)) {
      return '所在室的柜门还关着 —— 先点门扇把门打开，再摇出 / 推入';
    }
    return null;
  }

  /**
   * 推拉件的放行门槛：所在室的门要开到多少（0~1）才允许摇出。
   *
   * 0.6 而不是 0.5 —— 门开到六成时门扇已经让开行程，而且「门先动、手车后动」
   * 的先后感看得出来；0.5 以下两件事几乎同时发生，看着就是一起动。
   * 场景可用 `slide.after` 覆盖（例如柜门特别宽、需要让更多行程的场景）。
   */
  _slideGate(u) {
    const sl = u.slide;
    return (sl && typeof sl.after === 'number') ? sl.after : 0.6;
  }

  /**
   * 关门联锁：门要关上了，被这扇门挡住的推拉件（手车）必须先回到柜内 ——
   * 否则门扇会从手车身上扫过去，看起来就是「门穿手车」。
   *
   * 默认判据 = `slide.door === 正在关的那扇门`；door 传 null 表示「全部关门」
   * （一键全关），这时所有推拉件都收回。场景可以用 `slide.onClose(door)` 覆盖。
   */
  _retractSlides(door) {
    for (const m of (this.doorList || [])) {
      const sl = m.userData.slide;
      if (!sl) continue;
      if (m.userData._dTarget <= 0.5) continue;      // 本来就在柜内，不用管
      if (typeof sl.onClose === 'function') { sl.onClose(door); continue; }
      if (!door || sl.door === door) m.userData._dTarget = 0;
    }
  }

  /**
   * 一键全开 / 全关。force 省略时按「当前是否还有开着的门」取反。
   *
   * 注意这里**故意**把可动件的 _dTarget 一把置齐，不做先后判断 ——
   * 「先开门再摇手车」的顺序是 applyDoors() 按有效目标做出来的，
   * 这样按钮语义（我要全开）和动画时序（怎么开）就分开了：
   * 中途用户再点一下也不会留下半截状态。
   */
  /**
   * 「柜门是否开着」的**唯一定义**。
   *
   * ⚠️ 这里踩过一个「一个字段两个定义」的坑，值得记：
   *    `doorList` 里**同时装门和手车**（`locateMovers` 按 `userData.door/slide` 分流）。
   *    于是「有没有东西开着」有两种算法：
   *      · 数**全部可动件** —— 「一键开合」的**动作**要的（手车也得收回去）；
   *      · 只数**柜门** —— 顶栏「柜门开合」的**点亮状态**要的。
   *    原来自把这两个算法分别写在 `toggleDoors()` 和 `_syncDoorBtn()` 里、
   *    都往 `this.doorsOpen` 上写 —— **同一个字段，两个口径，谁最后跑谁说了算**。
   *    实测抓到的现场：`doorsOpen === true` 而所有柜门 `_dTarget` 全是 0
   *    （手车摇出着、门关着），读这个字段的代码会得出相反结论。
   *    现在收敛成一个函数：**动作**用 `_anyDoorOpen(true)`（含手车），
   *    **状态**用 `_anyDoorOpen()`（只看门）。
   */
  _anyDoorOpen(includeSlides) {
    return (this.doorList || []).some(o => (includeSlides || o.userData.door)
      && o.userData._dTarget > 0.5);
  }

  toggleDoors(force) {
    if (!this.doorList || !this.doorList.length) return false;
    /* ⚠️ 这里数**全部可动件**：门关着、手车摇出着的时候按一下，
       期望是「把摇出的手车收回去」，而不是「把已经关着的门再开一遍」。 */
    const anyOpen = this._anyDoorOpen(true);
    const on = force != null ? !!force : !anyOpen;
    if (!on) this._retractSlides(null);       // 全关 = 每扇门都在关，先把推拉件收回去
    this.doorList.forEach(o => { o.userData._dTarget = on ? 1 : 0; o.userData._dWait = 0; });
    /* 第 39 轮：一键操作给**门与门之间**也加上先后（原来只有「门 → 手车」两段）。
       顺序按**世界 x**：开从左到右、关从右到左，每扇错开 STEP 秒 ——
       像真人依次开柜，也让用户看清「哪些柜门动了」。
       ⚠️ 只有**一键**才排队：单扇门点击（toggleDoor）不设 `_dWait`。
       ⚠️ 「减少动效」下 STEP = 0（减弱不取消：门照样开，只是不排队）。 */
    const doors = this.doorList.filter(o => o.userData.door);
    const STEP = (RM || doors.length < 2) ? 0 : 0.10;
    if (STEP > 0) {
      /* ⚠️ 不要用 `getWorldPosition` + 复用同一个 Vector3 —— sort 的比较函数里
         取值会互相覆盖。直接读矩阵的世界 x。 */
      const wx = new Map();
      for (const o of doors) wx.set(o, o.matrixWorld.elements[12]);
      doors.sort((a, b) => wx.get(a) - wx.get(b));
      const n = doors.length;
      doors.forEach((o, i) => { o.userData._dWait = (on ? i : (n - 1 - i)) * STEP; });
    }
    this._syncDoorBtn();
    this._setDoorBusy(true);                  // 序列要跑 2~3 秒，先给个反馈
    this._needsRender = true;
    return on;
  }

  /**
   * 「柜门开合」按钮的进行中状态。
   *
   * 一键全开 / 全关不是瞬发动作，而是一段有先后的序列（门先开、手车后摇出），
   * 低配机上加起来要 2~3 秒。这期间按钮如果毫无反馈，用户会以为没点上，
   * 于是反复点 —— 而反复点只会不停翻转 `_dTarget`，看起来更像「按了没反应」。
   *
   * ⚠️ 收尾**不能靠 setTimeout**。软渲染下帧率能掉到 1 FPS，
   *    定时器算出来的「该结束了」跟门实际停下来的时刻对不上
   *    （要么按钮先恢复、门还在动，要么门停了按钮还转着）。
   *    判据是 `applyDoors()` 的返回值 —— 有效目标收敛了就一定是真停下来了。
   */
  _setDoorBusy(on) {
    const b = this.$('#btn-doors');
    if (!b || this._doorBusy === on) return;
    this._doorBusy = on;
    b.classList.toggle('busy', on);
    if (on) {
      this._doorBtnText = b.textContent;
      b.textContent = '开合中…';
    } else if (this._doorBtnText != null) {
      b.textContent = this._doorBtnText;
      this._doorBtnText = null;
    }
  }

  _syncDoorBtn() {
    /* 只数柜门 —— 手车也在 doorList 里，但「柜门开合」按钮不该被手车的位置点亮。
       定义收敛在 `_anyDoorOpen()` 里，别再就地写一份（见那个函数的注释）。 */
    const anyOpen = this._anyDoorOpen();
    this.doorsOpen = anyOpen;
    const b = this.$('#btn-doors');
    b?.classList.toggle('on', anyOpen);
    /* ⚠️ `.on` 只是**样式**，读屏读不到 —— 开关型按钮必须同步 `aria-pressed`，
       否则键盘/读屏用户永远不知道现在是「开」还是「关」。 */
    b?.setAttribute('aria-pressed', anyOpen ? 'true' : 'false');
  }

  /**
   * 「本场景可操作件」一览。
   *
   * 为什么非要有这一行：柜门是一大块平板、手车闷在柜里，**不告诉用户有几个、在哪，
   * 他根本不会去点**。顶栏那颗「柜门开合」按钮只说明「有这个功能」，
   * 说不清「这一场里有几个」；产品列表也只列元件，不含可动件。
   *
   * 三颗控件：数量胶囊点一下**定位闪烁**（飞到能看见它们的位置 + 光圈闪 3 秒），
   * 「一键开合」和顶栏那颗同源。上一版整行只有一个动作，用户读完「9 扇柜门」
   * 还是不知道该点哪一扇 —— 从「知道有几个」到「知道在哪」这一步没走完。
   * 没有可动件的场景（assembly）保持 hidden —— 不要摆一行「0 扇柜门」占地方。
   */
  renderMoverSummary() {
    const el = this.$('#mover-summary');
    if (!el) return;
    const list = this.doorList || [];
    const nd = list.filter(o => o.userData.door).length;
    const ns = list.filter(o => o.userData.slide).length;
    if (!nd && !ns) { el.hidden = true; return; }
    /* ⚠️ 不能像上一版那样写 `el.textContent = ...` —— 那会把三颗子按钮一起抹掉。
       只改每颗胶囊自己的文字，容器结构交给 HTML。 */
    const bd = el.querySelector('[data-kind="door"]');
    const bs = el.querySelector('[data-kind="slide"]');
    /* ⚠️ 胶囊上的文字是「9 扇柜门」，读屏念出来看不出**点了会发生什么** ——
       必须用 `aria-label` 说清动作（定位闪烁）。数字是动态的，只能在这里设。 */
    if (bd) {
      bd.hidden = !nd; bd.textContent = `${nd} 扇柜门`;
      bd.setAttribute('aria-label', `定位并闪烁标出本场景的 ${nd} 扇柜门`);
    }
    if (bs) {
      bs.hidden = !ns; bs.textContent = `${ns} 台手车`;
      bs.setAttribute('aria-label', `定位并闪烁标出本场景的 ${ns} 台手车`);
    }
    const ba = el.querySelector('.ms-all');
    if (ba) ba.setAttribute('aria-label',
      `一键开合全部柜门与手车（本场景 ${nd} 扇柜门 / ${ns} 台手车）`);
    el.hidden = false;
  }

  /**
   * 「定位闪烁」—— 把一组可动件框进画面，并在每件上闪一个光圈。
   *
   * 为什么需要：只报数量不报位置等于没报。柜门是一大块平板、手车闷在柜里，
   * 用户读完「9 扇柜门」还是不知道该点哪个。点一下数量胶囊，相机飞到能同时看见
   * 它们的位置、光圈连闪 3 秒 —— 从「知道有几个」到「知道在哪」才算走完。
   *
   * ⚠️ 机位**不能写死距离**：9 个场景的可动件尺寸差好几倍（kyn28 单扇门约 0.8m、
   *    boxsub 三室门约 2.4m），写死必然有的贴脸、有的看不清。
   *    这里按「这组可动件的包围球半径」和当前 fov 反解，横竖取严的那个。
   */
  locateMovers(kind) {
    const isSlide = kind === 'slide';
    const list = (this.doorList || []).filter(o => (isSlide ? o.userData.slide : o.userData.door));
    if (!list.length) return;

    const box = new THREE.Box3();
    const one = new THREE.Box3();
    const items = [];
    for (const o of list) {
      o.updateWorldMatrix(true, true);
      one.setFromObject(o);
      if (!isFinite(one.min.x)) continue;
      box.union(one);
      const sz = one.getSize(new THREE.Vector3());
      items.push({
        p: this._moverAnchor(o),
        /* 光圈直径跟着物件走：写死会在小门上空一个大圈、在大门上只圈住半扇。 */
        s: THREE.MathUtils.clamp((sz.x + sz.y) * 0.5 * 0.85, 0.35, 2.6),
      });
    }
    if (!items.length) return;

    const ctr = box.getCenter(new THREE.Vector3());
    const sph = box.getBoundingSphere(new THREE.Sphere());
    /* 沿**当前**视线方向后退 —— 不要重置到某个「标准机位」，
       用户可能正从侧面看，硬掰回正面会让人失去方位感。 */
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
    if (dir.lengthSq() < 1e-8) dir.set(0.5, 0.35, 0.8);
    dir.normalize();
    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (this.camera.aspect || 1));
    const dist = THREE.MathUtils.clamp(
      sph.radius / Math.sin(Math.min(vFov, hFov) / 2) * 1.12,
      1.0, this.controls.maxDistance);
    this.flyTo(ctr.clone().addScaledVector(dir, dist), ctr, 0.85);

    this._spawnPulses(items, isSlide ? 0x6fb7ff : 0x3fb983);
    /* ⚠️ 文案里的秒数必须跟 tick 里的 `LIFE` 对上 —— reduce 下 LIFE 是 0.8s，
       这里还写死「3 秒」的话，用户会以为光圈坏了。 */
    this.toast(`已定位 ${items.length} ${isSlide ? '台手车' : '扇柜门'} —— 光圈闪 ${RM ? '1' : '3'} 秒`);
  }

  /**
   * 可动件的世界锚点。
   * ⚠️ 门轴 Group 的原点落在**铰链轴**上（门转多少度它都不动），必须用
   *    `collectMovers` 里算好的 `_dCenter`（关门姿态下的子树 AABB 中心、
   *    已换算到局部坐标）。手车本身是个紧凑整体，退回原点即可。
   */
  _moverAnchor(o) {
    if (o.userData && o.userData._dCenter) {
      return o.userData._dCenter.clone().applyMatrix4(o.matrixWorld);
    }
    return o.getWorldPosition(new THREE.Vector3());
  }

  _spawnPulses(items, color) {
    this._clearPulses();
    for (const it of items) {
      const mat = new THREE.SpriteMaterial({
        map: ringTex, color, transparent: true, opacity: 0,
        depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      });
      const sp = new THREE.Sprite(mat);
      sp.position.copy(it.p);
      sp.scale.setScalar(it.s);
      sp.renderOrder = 999;
      this.scene.add(sp);
      this._pulses.push({ sp, t: 0, s: it.s });
    }
    this._needsRender = true;
  }

  /**
   * 释放全部定位光圈。
   * ⚠️ `ringTex` 是**共享贴图**：`material.dispose()` 本来不会连带释放它
   *    （Three.js 的 dispose 只释放材质自己持有的 program/UBO），但这里仍然
   *    显式把 `map` 置空再 dispose —— 免得哪天有人改成「连贴图一起释放」，
   *    把全场景的标记点贴图一次性干掉。
   */
  _clearPulses() {
    if (!this._pulses) { this._pulses = []; return; }
    for (const q of this._pulses) {
      this.scene.remove(q.sp);
      q.sp.material.map = null;
      q.sp.material.dispose();
    }
    this._pulses = [];
  }

  /**
   * 右下角场景提示的「临时换文案」。
   *
   * 悬停在可动件上时换成操作提示 —— 门扇是一大块平板、手车是个闷在柜里的方块，
   * 不提示用户根本不会想到它们能点。
   * `_tipBase` 只在第一次换的时候抓一次原文案，之后传 null 就还原；
   * 不能用 textContent 反查，连续两次 swap 会把原文案冲掉。
   *
   * ⚠️ 这个方法上一轮只写了调用、忘了写定义，导致悬停柜门时 pointermove
   *    每动一下就抛一次 TypeError（控制台刷屏、指针样式卡住）。
   */
  _tipSwap(msg) {
    const el = this.$('#stage-tip');
    if (!el) return;
    if (this._tipBase == null) this._tipBase = el.textContent;
    el.textContent = msg || this._tipBase;
    el.classList.toggle('swap', !!msg);
  }

  /** 悬停在可动件上时给的提示文案（门和手车的操作方式不一样）。 */
  _moverTip(o) {
    if (o.userData && o.userData.slide) return '点击手车可摇出 / 推入（需先打开所在室的柜门）';
    return '点击柜门可开合（快捷键 O 一键全开/全关）';
  }

  /**
   * 悬停在热点元件（产品 / 通用元件）上时给的提示文案。
   *
   * 与可动件气泡**刻意不重复**：元件本身已经有常驻标签写着名字，
   * 再贴一个气泡只会糊在标签上。这里只换右下角那行字，视线离开画面中央也不打扰。
   *
   * ⚠️ 传进来的 `key` 是**热点实例 key**，不是档案 id —— 一个元件在一个场景里
   * 可能装好几只（直流屏 3 只 MCCB、kyn28 的轴流风机是 `FAN#1` / `FAN#2`），
   * 那时 key 带 `#N` 后缀，而 `elementById()` 只认 `PRODUCTS` / `GENERIC` 的键，
   * 直接喂进去会返回 `null` → 提示被打回基础文案，看着就像「这功能没生效」。
   * 必须走 `elementOf()`（它先按 key 查到热点、再取 `h.id` 去查档案）。
   *
   * 这个坑只在**多实例**元件上暴露：单实例的 `PROT` 恰好 key === id，
   * 上一版测试一直悬停到它，所以一路「通过」—— 直到换了台风机才现形。
   */
  _viewTip(key) {
    const p = this.elementOf(key);
    return p ? `点击查看 · ${p.n}` : null;
  }

  /**
   * 悬停在可动件（门扇 / 手车）上时，在**它旁边**浮一个小胶囊。
   *
   * 为什么光改右下角那行字不够：门扇是一大块平板、手车是个闷在柜里的方块，
   * 用户的视线正盯着柜体中部，而提示在右下角 —— 实测没人会注意到文案变了。
   * 气泡贴着目标出现，视线不用离开就知道「这个东西能点」。
   *
   * 位置算法与标签避让同源：投影 → 夹进左右安全区 → 默认浮在上方，
   * 顶到画面上沿就翻到下方（加 `.below` 把下指小三角翻成上指）。
   */
  _placeMoverHint() {
    const el = this.moverHint;
    if (!el) return;
    const o = this.hoveredDoor;
    if (!o) { el.style.visibility = 'hidden'; return; }

    const cam = this.camera;
    const w = this._w || 1, h = this._h || 1;
    const v = this._mhV || (this._mhV = new THREE.Vector3());
    /* 锚点优先用 collectMovers 缓存的**门板子树局部中心**。
       ⚠️ 不能用 o.getWorldPosition() —— o 是门轴 Group，原点就落在铰链轴上：
          气泡会一直贴着门缝那一条线，门转起来也不跟着走（门开到手边气泡还钉在门框上）。
       手车没有 _dCenter（它本身就是个紧凑整体），退回原点即可。 */
    if (o.userData && o.userData._dCenter) {
      v.copy(o.userData._dCenter).applyMatrix4(o.matrixWorld);
    } else {
      o.getWorldPosition(v);
    }
    v.project(cam);
    const x = (v.x * 0.5 + 0.5) * w;
    const y = (-v.y * 0.5 + 0.5) * h;
    if (v.z > 1 || x < -240 || x > w + 240 || y < -100 || y > h + 100) {
      el.style.visibility = 'hidden';
      return;
    }
    /* 文案在门 / 手车之间会变，宽度必须跟着重量一次；其余帧读缓存，
       免得每帧 offsetWidth 触发一次强制重排。 */
    /* 第 39 轮：文案带上**当前状态**，直接说清「点下去会发生什么」——
       原来一律「点击开合」，用户得先自己判断门现在是开是关。
       用 `_dTarget`（意图）而不是 `_dK`（当前值）：动画一开始就切换文案，
       不会在中途来回跳。 */
    const u = o.userData || {};
    const openNow = (u._dTarget != null ? u._dTarget : (u._dK || 0)) > 0.5;
    const txt = u.slide
      ? (openNow ? '点击推入手车' : '点击摇出手车')
      : (openNow ? '点击关闭柜门' : '点击打开柜门');
    if (this._mhTxt !== txt) {
      this._mhTxt = txt;
      el.textContent = txt;
      this._mhW = 0; this._mhH = 0;
    }
    const lw = this._mhW || (this._mhW = el.offsetWidth || 96);
    const lh = this._mhH || (this._mhH = el.offsetHeight || 26);
    const cx = clamp(x, lw / 2 + 6, Math.max(lw / 2 + 6, w - lw / 2 - 6));
    const above = y - 20 - lh >= 6;
    const ty = above ? y - 20 : y + 20 + lh;      // 都用 translate(-50%,-100%)，下方时换算成底边
    el.classList.toggle('below', !above);
    el.style.visibility = 'visible';
    el.style.transform = `translate(-50%,-100%) translate(${cx.toFixed(1)}px,${ty.toFixed(1)}px)`;
  }

  /**
   * 统一计算「爆炸位移 + 推拉位移」并写回 position。
   *
   * ⚠️ 这两者都改 position，必须**合并成一次写入**。分成两个函数各写各的会互相覆盖：
   *   爆炸视图动一下就把手车的摇出量冲掉，手车摇一下又把爆炸位移冲掉。
   *   叠加顺序无所谓（都是相对基准位的平移），但必须同一个式子算完。
   */
  applyMotion() {
    const ex = this._ex ?? 0;
    const place = (o) => {
      const u = o.userData, b = u._base;
      if (!b) return;
      let x = b.x, y = b.y, z = b.z;
      if (u.explode) {
        x += u.explode[0] * ex; y += u.explode[1] * ex; z += u.explode[2] * ex;
      }
      if (u._dSlide) {
        const k = u._dK ?? 0;
        x += u._dSlide[0] * k; y += u._dSlide[1] * k; z += u._dSlide[2] * k;
      }
      o.position.set(x, y, z);
    };
    for (const o of (this.exList || [])) place(o);
    // 只推拉、不爆炸的（例如两侧柜的手车，它们没登记爆炸组）
    for (const o of (this.doorList || [])) if (o.userData._dSlide && !o.userData.explode) place(o);
  }

  applyExplode(k) {
    this._ex = k;
    this.applyMotion();
    // 几何体动了 → 阴影贴图必须重算（shadowMap.autoUpdate 已关，见 initRenderer）
    this.renderer.shadowMap.needsUpdate = true;
  }

  /* ---------------- UI 渲染 ---------------- */
  renderSceneList() {
    const box = this.$('#scene-list');
    /* 窄屏顶栏的那个「场景」下拉。⚠️ 与左栏**共用同一份数据、同一套 `.sl-item`
       样式**，只是换个容器 —— 另起一套迟早两边对不上（`_anyDoorOpen` 的教训）。 */
    const menu = this.$('#tb-scene-list');
    box.innerHTML = '';
    if (menu) menu.innerHTML = '';
    const groups = { indoor: [], outdoor: [] };
    SCENES.forEach(s => groups[s.kind].push(s));
    [['indoor', '户内场景', 'Indoor'], ['outdoor', '户外场景', 'Outdoor']].forEach(([kind, label, en]) => {
      if (!groups[kind].length) return;
      const h = document.createElement('div');
      h.className = 'sl-group';
      h.innerHTML = `<span>${label}</span><em>${en}</em>`;
      box.appendChild(h);
      if (menu) menu.appendChild(h.cloneNode(true));
      groups[kind].forEach(s => {
        /* ⚠️ `cloneNode(true)` **不会**带走事件监听器 —— 每个按钮都得单独挂一次。
           先关下拉、再切场景：切场景会重绘整个列表，若先切再关，
           刚被点的那颗按钮已经被换掉了，`open=false` 虽然仍生效，
           但焦点会掉到 body 上（键盘用户就此迷路）。 */
        const mk = () => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'sl-item' + (s.id === this.currentScene ? ' on' : '');
          b.dataset.kind = s.kind;
          /* ⚠️ `data-id` 是**给探针用的稳定选择器**。这一条原先没有：
             全站其它可点列表项（`.pcard` / `.sibchip` / `.adv-item` / `.alt-way`）
             都带 `data-id`，唯独场景项只带 `data-kind` —— 探针想点「第 4 个场景」
             只能靠中文名做文本匹配，改一个字就静默失效（第 60 轮实测踩过：
             选择器找不到按钮 ⇒ 点击根本没发生 ⇒ 却把结论写成「切换不了场景」）。 */
          b.dataset.id = s.id;
          const ne = (s.elements || []).length;
          b.innerHTML = `<i class="dot"></i><span class="n">${s.n}</span>`
            + `<em>${s.products.length} 产品${ne ? ` · ${ne} 元件` : ''}</em>`;
          b.addEventListener('click', () => { this.closeSceneMenu(); this.loadScene(s.id); });
          return b;
        };
        box.appendChild(mk());
        if (menu) menu.appendChild(mk());
      });
    });
  }

  /**
   * 窄屏顶栏「场景」下拉的开 / 关。
   * ⚠️ 菜单是 `position:fixed`（`#topbar` / `#app` 都是 `overflow:hidden`，
   *    `absolute` 会被裁掉），所以坐标得自己算 —— 以 summary 的 rect 为准。
   * ⚠️ 宽屏下这个下拉整体是关着的（summary `pointer-events:none`），
   *    所以 `open` 时也要再确认一次「真的该开」，否则键盘 Enter 会
   *    「打开一个看不见的菜单」。
   */
  openSceneMenu() {
    const d = this.$('#tb-scenes'), m = this.$('#tb-scene-list');
    if (!d || !m) return;
    if (!matchMedia(NARROW_MQ).matches) { d.open = false; return; }
    const sm = d.querySelector('summary');
    if (!sm) return;
    const r = sm.getBoundingClientRect();
    /* ⚠️ 纵向锚点取「summary 底边」和「顶栏底边」的**较大者**。
       只按 summary 底边算的话，菜单上沿会落进顶栏内部（实测 46px vs 顶栏底边 58px）——
       summary 是 `align-items:center` 的 flex 项，底边比顶栏底边高一截。
       菜单虽然没被裁（fixed 不受祖先 overflow 影响），但会盖住顶栏下半条。
       这个偏移会随顶栏高度 / 按钮 padding 变，所以**每次打开都重算**，别写死。 */
    const tb = this.$('#topbar').getBoundingClientRect();
    m.style.left = Math.round(r.left) + 'px';
    m.style.top = Math.round(Math.max(r.bottom, tb.bottom) + 6) + 'px';
    m.style.minWidth = Math.max(236, Math.round(r.width)) + 'px';
  }

  closeSceneMenu() {
    const d = this.$('#tb-scenes');
    if (d && d.open) d.open = false;
  }

  /**
   * ⚠️ **可聚焦 ⟺ 真的能操作**。
   * `<summary>` 默认就在 Tab 顺序里。宽屏下这个下拉是关着的
   * （`pointer-events:none` + 菜单 `display:none`），若 summary 仍然可聚焦，
   * 键盘用户会 Tab 到一个「按了什么都不发生」的东西 —— 那比不放它更糟
   * （记忆 §3：`aria-expanded` 是承诺；这里连承诺都没有，就是个哑控件）。
   * 所以 tabindex 跟着媒体查询一起切：宽屏 -1（摘出 Tab 顺序）、窄屏 0。
   * ⚠️ 必须**跟着 resize 重算**：用户把窗口从 1024 拖到 1440 时媒体查询会翻面。
   */
  syncSceneDrop() {
    const d = this.$('#tb-scenes');
    if (!d) return;
    const sm = d.querySelector('summary');
    if (!sm) return;
    const on = matchMedia(NARROW_MQ).matches;
    sm.tabIndex = on ? 0 : -1;
    if (!on && d.open) d.open = false;
  }

  /**
   * 来源图例：把本场景出现的元件按四类来源统计出来。
   *
   * 用户必须能一眼分清「哪些是我们的产品、哪些不是」—— 颜色只是辅助，
   * 这里给出明确的中文口径（本公司产品 / 通用元件 / 其他厂商设备 / 示意元件）。
   */
  renderOriginLegend(cfg) {
    const el = this.$('#origin-legend');
    if (!el) return;
    const count = { own: (cfg.products || []).length, generic: 0, vendor: 0, schematic: 0 };
    for (const id of cfg.elements || []) {
      const p = GENERIC[id];
      if (!p) continue;
      count[p.origin] = (count[p.origin] || 0) + 1;
    }
    el.innerHTML = ORIGIN_ORDER
      .filter(k => count[k])
      .map(k => `<span><i style="background:${ORIGIN[k].color}"></i>${ORIGIN[k].n}<b>${count[k]}</b></span>`)
      .join('');
  }

  renderProductList() {
    const cfg = SCENE_BY_ID[this.currentScene];
    const box = this.$('#prod-list');
    box.innerHTML = '';

    /* 本公司产品与通用元件共用一种卡面，靠 --c（来源色）与徽标文案区分 */
    const mk = (p, isOwn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pcard' + (isOwn ? '' : ' is-elem');
      b.dataset.id = p.id;
      b.style.setProperty('--c', elemColor(p));
      /* 第 47 轮：家族/来源徽标从「独立一行」收到「标题行右端」——每张卡省一行。
         ⚠️ 挤到一行的前提是**两边都能缩**：`.pc-n` 给 min-width:0 + 单行省略，
            `.pc-fam` 给 flex:none 不参与压缩。否则窄栏里名字会把徽标挤出卡片
            （记忆 §10：窄容器里「名字 + 计数」塞一行必截断）。 */
      b.innerHTML = isOwn
        ? `<span class="pc-h"><span class="pc-n">${p.n}</span><span class="pc-fam">${p.fam}</span></span>
           <span class="pc-m">${p.m}</span>
           <span class="pc-t">${p.tagline}</span>`
        : `<span class="pc-h"><span class="pc-n">${p.n}</span><span class="pc-fam">${(ORIGIN[p.origin] || {}).n || '元件'}</span></span>
           <span class="pc-m">${p.m}</span>
           <span class="pc-t">${p.role}</span>`;
      b.addEventListener('click', () => this.selectProduct(p.id, { fly: true }));
      b.addEventListener('pointerenter', () => this.setHover(p.id));
      b.addEventListener('pointerleave', () => this.setHover(null));
      return b;
    };

    cfg.products.map(id => PRODUCTS[id]).filter(Boolean).forEach(p => box.appendChild(mk(p, true)));

    /* 通用元件拆成两段（第 48 轮）：
       「继电器替代方案」＝**带 `alt` 字段**的那些（可插拔继电器、控制器、智能操显…）——
       它们回答的是「这个柜子用不到我司专用继电器时，用什么」。单独成段，
       是为了让这句话在列表里**一眼看得见**，而不是埋进几十个通用件中间。
       ⚠️ `alt` 是唯一判据，两段**互斥且不遗漏**；别在别处再写一遍同样的判断。 */
    const all = (cfg.elements || []).map(id => elementById(id)).filter(Boolean);
    const seg = (title, list, cls) => {
      if (!list.length) return;
      const sep = document.createElement('div');
      sep.className = 'pl-sep' + (cls ? ' ' + cls : '');
      sep.innerHTML = `<span>${title}</span><em>${list.length} 项</em>`;
      box.appendChild(sep);
      list.forEach(p => box.appendChild(mk(p, false)));
    };
    seg('本场景的通用元件', all.filter(p => !p.alt));
    seg('继电器替代方案', all.filter(p => !!p.alt), 'is-alt');

    this.$('#prod-count').textContent = cfg.products.length;
  }

  setHover(id) {
    this.hoveredId = id;
    this.applyLabelState();
    document.querySelectorAll('.pcard').forEach(el => el.classList.toggle('hover', el.dataset.id === id));
  }

  renderCard(p, h) {
    /* 通用元件 / 外购主设备走另一套卡片：它们没有手册档案，
       重点讲「它是干什么的、装在哪」，而不是参数与手册深链。 */
    if (p.origin && p.origin !== 'own') return this.renderElementCard(p, h);
    const box = this.$('#card');
    const fam = elemColor(p);
    // 跨场景联动：这个产品还装在哪些场景里
    const others = SCENES.filter(s => s.id !== this.currentScene && s.products.includes(p.id));
    /**
     * 同场景兄弟产品：客户问得最多的其实是「这一柜里还要配什么」，
     * 直接给一键切换，省掉「回右栏列表里再找一遍」的来回。
     */
    const sib = (((SCENE_BY_ID[this.currentScene] || {}).products) || [])
      .filter(id => id !== p.id && PRODUCTS[id])
      .map(id => PRODUCTS[id]);
    box.style.setProperty('--c', fam);
    box.innerHTML = `
      <div class="card-head">
        <span class="badge" style="--c:${fam}">${p.fam} · ${p.cat}</span>
        <h3>${p.n}</h3>
        <p class="model">${p.m}</p>
      </div>
      <p class="tagline">${p.tagline}</p>
      <div class="sec">
        <h4>它在干什么</h4>
        <p>${p.role}</p>
      </div>
      <div class="sec">
        <h4>关键参数</h4>
        <table class="spec">${p.specs.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
      </div>
      <div class="sec">
        <h4>安装位置</h4>
        <p>${p.where}${h && h.note ? ` · <em>${h.note}</em>` : ''}</p>
      </div>
      <div class="sec">
        <h4>模型表达的部件（示意）</h4>
        <ul class="partlist">${partsNote(p).map(t => `<li>${t}</li>`).join('')}</ul>
      </div>
      ${sib.length ? `
      <div class="sec">
        <h4>同场景还装了</h4>
        <div class="siblist">${sib.map(x => `
          <button type="button" class="sibchip" data-id="${x.id}" style="--c:${FAM_COLOR[x.fam] || '#3fb983'}">
            <b>${x.n}</b><span>${x.m}</span>
          </button>`).join('')}</div>
      </div>` : ''}
      <div class="sec">
        <h4>该产品还出现在</h4>
        <div class="xscenes">${others.length
        ? others.map(s => `<button type="button" class="xchip" data-scene="${s.id}"><i data-kind="${s.kind}"></i>${s.n}</button>`).join('')
        : '<span class="xnone">本场景即该产品的主要安装位置</span>'}</div>
      </div>
      <div class="sec actions">
        <a class="btn-primary" href="${p.manual}" target="_blank" rel="noopener">在手册中查看完整档案 →</a>
        <button type="button" class="btn-ghost" id="btn-focus">镜头对准安装位</button>
      </div>
      <p class="disclaimer">示意模型：外观和结构以<b>实物、图纸及最新技术资料为准</b>；参数以公司最新版说明书为准。</p>`;
    const f = box.querySelector('#btn-focus');
    if (f && h) {
      const view = h.view || h.focus;
      if (view) f.addEventListener('click', () => this.flyTo(new THREE.Vector3(...view.pos), new THREE.Vector3(...view.target), 0.8));
      else f.style.display = 'none';
    } else if (f) f.style.display = 'none';
    box.querySelectorAll('.xchip').forEach(btn => {
      btn.addEventListener('click', () => {
        this.loadScene(btn.dataset.scene, { select: p.id, fly: true });
      });
    });
    box.querySelectorAll('.sibchip').forEach(btn => {
      btn.addEventListener('click', () => this.selectProduct(btn.dataset.id, { fly: true }));
      btn.addEventListener('pointerenter', () => this.setHover(btn.dataset.id));
      btn.addEventListener('pointerleave', () => this.setHover(null));
    });
    this.ensureViewer().show(p.id);
  }

  /**
   * 渲染「为什么这样选」内容块（场景级）。
   *
   * 数据在 js/guide.js 的 GUIDES 里，按场景 id 取。**没有内容的场景整块 hidden** ——
   * 留一个点开是空白的折叠区，比没有这块更糟。
   *
   * ⚠️ 证据分级必须渲染出来：「有据可查」与「工程分析」在视觉上要能分辨，
   *    否则工程判断会被当成事实读（这是这一块内容最容易出的合规问题）。
   * ⚠️ 每次换场景都 `open = false`：上一场展开着、切过来还是展开的，
   *    面板会突然变长一大截，用户会以为卡了。
   */
  renderGuide(id) {
    const box = this.$('#scene-guide');
    if (!box) return;
    const g = GUIDES[id];
    if (!g) { box.hidden = true; box.open = false; return; }
    box.hidden = false;
    box.open = false;
    const chip = (ev) => {
      const e = EV_LABEL[ev] || EV_LABEL.judge;
      return `<span class="g-ev g-ev-${ev}" title="${e.hint}">${e.n}</span>`;
    };
    /* 「行业替代做法」徽标 —— 不是装饰。
       ⚠️ `common` 里**必须**有一条讲「客户可以不用我们的产品」，否则这块内容就退化成
          产品广告。用**显式字段** `alt` 标出来，而不是靠文案里有没有「不设 / 取消」
          这类词去猜 —— 第 60 轮实测：`位置记忆可由 DTU 承担` 一个词都不沾，
          但它恰恰就是那一档。探针按字段断言，界面上也让人一眼看见。 */
    const altChip = (c) => (c.alt
      ? '<span class="g-alt" title="这一档讲的是行业里常见的替代做法 —— 客户这样选有它的道理，不必硬推我们的产品">行业替代做法</span>'
      : '');
    this.$('#guide-body').innerHTML = `
      <p class="g-use">${g.use}</p>
      <h5>行业里常见怎么做</h5>
      <ul class="g-common">${g.common.map(c => `
        <li><b>${c.t}</b>${chip(c.ev)}${altChip(c)}<p>${c.d}</p></li>`).join('')}</ul>
      <h5>我们进得去的条件</h5>
      <p class="g-fit">${g.fit}</p>
      <h5>什么情况下不会选我们</h5>
      <p class="g-notfit">${g.notFit}</p>
      <h5>拜访先问这几句</h5>
      <ol class="g-ask">${g.ask.map(a => `<li>${a}</li>`).join('')}</ol>
      <p class="g-foot">证据分级：「有据可查」指国家标准、行业反措、招投标法规或公开产品资料中可查证的内容；
        「工程分析」为基于公开信息的经验判断，供参考。本块只说明功能与配套关系，不比较优劣。</p>`;
  }

  /**
   * 通用元件 / 外购主设备的卡片。
   *
   * 与本公司产品卡片的区别：
   *   · 没有手册档案 → 不给「查看完整档案」按钮；
   *   · 顶部换成**来源分类**徽标（通用元件 / 其他厂商设备 / 示意元件）；
   *   · 型号栏一律是「按工程配置」—— 每个工程选型不同，不能编具体型号。
   */
  renderElementCard(p, h) {
    const box = this.$('#card');
    const o = ORIGIN[p.origin] || ORIGIN.generic;
    box.style.setProperty('--c', o.color);

    /* 同场景的其它元件：让销售一眼看全「这一柜里都还有什么」 */
    const cfg = SCENE_BY_ID[this.currentScene] || {};
    const sib = (cfg.elements || [])
      .filter(id => id !== p.id && elementById(id))
      .map(id => elementById(id));

    box.innerHTML = `
      <div class="card-head">
        <span class="badge" style="--c:${o.color}">${o.n}</span>
        <h3>${p.n}</h3>
        <p class="model">${p.m}</p>
      </div>
      <div class="sec">
        <h4>它在干什么</h4>
        <p>${p.role}</p>
      </div>
      <div class="sec">
        <h4>关键点</h4>
        <table class="spec">${p.specs.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
      </div>
      <div class="sec">
        <h4>安装位置</h4>
        <p>${p.where}${h && h.note ? ` · <em>${h.note}</em>` : ''}</p>
      </div>
      ${p.alt ? `
      <div class="sec alt-sec">
        <h4>替代关系</h4>
        <p>${p.alt}</p>
      </div>` : ''}
      ${sib.length ? `
      <div class="sec">
        <h4>本场景还装了</h4>
        <div class="siblist">${sib.map(x => `
          <button type="button" class="sibchip" data-id="${x.id}" style="--c:${elemColor(x)}">
            <b>${x.n}</b><span>${elemSub(x)}</span>
          </button>`).join('')}</div>
      </div>` : ''}
      <div class="sec actions">
        <button type="button" class="btn-ghost" id="btn-focus">镜头对准安装位</button>
      </div>
      <p class="disclaimer">示意模型：外观和结构以<b>实物、图纸及最新技术资料为准</b>；通用元件按行业典型外观简化表达，<b>不代表任何具体厂商型号</b>。</p>`;

    const f = box.querySelector('#btn-focus');
    if (f && h) {
      const view = h.view || h.focus;
      if (view) f.addEventListener('click', () => this.flyTo(new THREE.Vector3(...view.pos), new THREE.Vector3(...view.target), 0.8));
    }
    box.querySelectorAll('.sibchip').forEach(b => {
      b.addEventListener('click', () => this.selectProduct(b.dataset.id, { fly: true }));
    });
  }

  renderCardEmpty() {
    this.$('#card').innerHTML = `
      <div class="card-empty">
        <div class="ce-icon">◎</div>
        <h3>点击场景中的元件</h3>
        <p>选中后这里会显示产品卡片与可旋转的 3D 模型。<br>也可以直接点右侧产品列表。</p>
      </div>`;
    this.viewer?.show(null);
  }

  showLoading(on, label, progress) {
    const box = this.$('#loading');
    if (!box) return;
    /* ⚠️ 上一次装载失败时，`#loading` 被切成了失败面板（`.fail` 类把进度条和文案都藏了）。
       再装载前必须先还原，否则进度文案永远不刷新，用户看到的是「上次失败的界面」。
       还原只做一件事：摘掉 `.fail` —— 显隐全在 CSS 里，不在 JS 里各写一份。 */
    if (this._ldBroken) {
      box.classList.remove('fail');
      this._ldBroken = false;
    }
    box.classList.toggle('on', on);
    /* ⚠️ `.on` 一变，`#loading` 的 inert 状态就必须跟着变（见 `_syncInert()`）。
       汇总到那一处写，别在这儿再写一份判断。 */
    this._syncInert();
    /* ⚠️ 这个标记不只是给样式用的 —— `countFps()` 靠它区分
       「**在装东西**」（几秒的同步重活，帧率必然低）和「**场景真的卡**」。
       不区分就会把装载的低帧率记到场景头上，一路把画质降到底（见 countFps 的注释）。 */
    this._loading = !!on;
    if (on) {
      const st = this.$('#ld-step');
      if (label && st) st.textContent = label;
      if (progress !== undefined) {
        const f = this.$('#ld-fill');
        if (f) f.style.width = Math.round(clamp(progress, 0, 1) * 100) + '%';
      }
    } else {
      // 收起时把进度条归零，下次打开不会从 100% 往后退
      const f = this.$('#ld-fill');
      if (f) f.style.width = '0%';
      const st = this.$('#ld-step');
      if (st) st.textContent = '正在构建三维场景…';
      // 通知 index.html 里的启动守卫：场景真的起来了，关掉看门狗
      window.__appReady = true;
    }
  }

  /**
   * 装载失败兜底。**这不是可选的** —— 见 `loadScene()` 里 `.catch()` 的注释：
   * `runLoad()` 是 async 且通体没有 try/catch，index.html 的看门狗在
   * `__appReady` 之后又永久退休，所以「切场景时构建抛异常」原先**没有任何兜底**。
   * 实测（`loadfail_probe.js`）：遮罩会停在「正在构建场景几何… 48%」永不收起，
   * 屏幕上没有一句解释 —— 用户只能刷新。
   *
   * @param {string} id  失败的场景 id
   * @param {*}      err 原始异常
   * @param {number} seq 该次装载的令牌（过期装载的失败不该顶掉新装载的界面）
   */
  loadFail(id, err, seq) {
    /* 过期装载的异常直接丢掉：它作废在前，界面已经归新装载管了。 */
    if (seq !== undefined && seq !== this._loadSeq) return;
    const cfg = SCENE_BY_ID[id] || {};
    const name = cfg.n || id;
    const msg = String((err && err.message) || err || '未知错误');
    console.error('[loadScene] 「' + name + '」构建失败：', err);

    /* ⚠️ 先按「不在装载」处理：遮罩此刻表达的是**失败**，不是**忙**。
       否则 `countFps()` 会一直当它是装载期而拒绝判定帧率。 */
    this._loading = false;
    this._failScene = id;

    /* 首次装载就失败 ⇒ 这更像「引擎 / 驱动 / 文件」问题，而不是「这一个场景」问题。
       交给 index.html 的自诊断面板（它会附上 WebGL、显卡、协议、importmap 等信息），
       比这里的泛泛文案有用得多。`__appReady` 只在**成功装载过一次**之后才置 true。 */
    if (!window.__appReady && typeof window.__bootFail === 'function') {
      window.__bootFail('三维场景没能构建起来',
        '页面脚本已经执行起来了，但在构建「' + name + '」场景时抛出了异常。',
        ['先按 Ctrl+F5 强制刷新一次（避开缓存里的半截文件）',
          '确认 <code>models/vendor/</code> 下的 Three.js 文件完整（没有被杀软/同步盘删掉）',
          '换用最新版 Chrome / Edge',
          '把下面这段信息发给我，我来定位'],
        msg);
      return;
    }

    const box = this.$('#loading');
    if (box) box.classList.add('on', 'fail');
    this._ldBroken = true;

    const t = this.$('#lf-title');
    if (t) t.textContent = '「' + name + '」这个场景没能构建起来';
    const w = this.$('#lf-why');
    if (w) {
      w.textContent = '场景在构建几何时抛出了异常，遮罩已经停下 —— 不是还在加载。'
        + '其它场景不受影响，可以直接换一个；想再看这个场景就点下面的重试。';
    }
    const d = this.$('#lf-detail');
    if (d) d.textContent = '错误信息：' + msg;
    const back = this.$('#lf-back');
    if (back) {
      const prev = this._lastGoodScene;
      back.hidden = !prev;
      if (prev) back.textContent = '回到「' + ((SCENE_BY_ID[prev] || {}).n || prev) + '」';
    }
  }

  /* ---------------- 事件 ---------------- */
  initEvents() {
    window.addEventListener('resize', () => this.resize());
    this.resize();

    /* ⚠️⚠️ 从后台切回来的第一帧必须**把空档吃掉再重新计时**。
       rAF 在后台标签页里不是降频而是**完全不跑**（切走 60s → 回来第一帧
       `clock.getDelta()` ≈ 60）。而 `countFps(raw)` 的判据是 `_fpsN / _fpsT`，
       于是一帧就把整段采样拖成 `round(1/60) = 0` —— 芯片上闪一下刺眼的「0 FPS」，
       `_fpsLow` 还记一笔。这与第 43 轮那句「（0 FPS）」是**同一个指纹**，
       只是触发源从「装载」换成了「后台」。装载那条已经用 `_loading` 挡住，
       这一条只能在**时间源**上处理 —— 阈值过滤会误伤真正低于 1 FPS 的老机器。
       `pageshow` 是 bfcache 恢复（前进/后退回到本页），也会带来同样的空档。 */
    const dropGap = () => {
      if (this.clock) this.clock.getDelta();
      this._fpsN = 0; this._fpsT = 0; this._fpsLow = 0;
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) dropGap(); });
    window.addEventListener('pageshow', dropGap);

    /* 装载失败面板的两颗按钮。绑一次就够 —— 它们住在静态 HTML 里，不会被重建。 */
    this.$('#lf-retry')?.addEventListener('click', () => {
      const id = this._failScene;
      if (id) this.loadScene(id, { fly: true });
    });
    this.$('#lf-back')?.addEventListener('click', () => {
      const id = this._lastGoodScene;
      if (id) this.loadScene(id, { fly: true });
    });

    /* ⚠️ 只监听 window.resize 是不够的 —— 窗口没变、但**舞台**变了的情况一大堆：
     *   · 点「沉浸」：grid 列宽在 340ms 内从 274/1fr/372 过渡到 0/1fr/0；
     *   · 媒体查询切换（1400px / 1180px 两个断点）；
     *   · 侧栏/面板折叠。
     * 这些都不会触发 window.resize，于是 this._w/_h 停留在旧值：
     *   · canvas 的像素尺寸没更新，却被 CSS width:100% 横向拉伸
     *     —— 实测 stage 1034→1680 时画面被拉宽 1.63×，明显变形；
     *   · HTML 标签仍按旧宽度做投影换算 —— 实测整体左移 ~323px，
     *     看起来就是「缩小放大时标签不跟随」。
     * 用 ResizeObserver 盯 #stage，并用 rAF 合并过渡期间的连续回调
     * （340ms 过渡会触发二十来次，每次都 setSize 会白白重分配画布）。 */
    if (typeof ResizeObserver !== 'undefined') {
      let pending = false;
      this._ro = new ResizeObserver(() => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => { pending = false; this.resize(); });
      });
      this._ro.observe(this.stage);
    }

    /* ⚠️ 滚轮落在标签上时，OrbitControls 收不到 —— 它只监听 renderer.domElement(#gl)，
     * 而 #labels 在 #gl 之上、标签自己又是 pointer-events:auto 的浮层，
     * 事件冒泡链里根本没有 #gl。表现就是：鼠标停在标签上滚轮缩放「没反应」。
     * 把滚轮事件按原样转发给 canvas（保留 clientX/Y 与 deltaY，OrbitControls 都要用）。 */
    this.$('#labels').addEventListener('wheel', (e) => {
      this.renderer.domElement.dispatchEvent(new WheelEvent('wheel', {
        deltaX: e.deltaX, deltaY: e.deltaY, deltaMode: e.deltaMode,
        clientX: e.clientX, clientY: e.clientY,
        bubbles: false, cancelable: true,
      }));
    }, { passive: true });

    // 拾取
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    let downPos = null;
    this.canvas.addEventListener('pointerdown', (e) => { downPos = [e.clientX, e.clientY]; });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!downPos) return;
      const moved = Math.hypot(e.clientX - downPos[0], e.clientY - downPos[1]);
      downPos = null;
      if (moved > 6) return;          // 拖拽不触发选中
      const hit = this.pickAt(e.clientX, e.clientY);
      if (hit.door) { this.toggleDoor(hit.door); return; }   // 点到门扇 → 开合，不弹产品卡片
      if (hit.id) this.selectProduct(hit.id, { fly: true });
      else this.deselect();
    });
    /* 双击：**空白处 → 全场景入画；物件上 → 再聚焦一次**。
       为什么值得加：想看「这一场都有些什么」只有两条路 —— 按 R（那是场景声明的
       默认机位，为了突出主角，往往只看得到一角）或者自己慢慢滚轮拉远。
       双击画布是三维软件里最通用的「框选全部 / 聚焦」，加它等于给了一个
       零学习成本的全景入口。
       ⚠️ 双击必然先送出两次 pointerup（= 两次单击），所以这里**不能再触发选中**：
          物件上的第一次单击已经选中并飞过去了，这里只做「再拉近一点」；
          空白处的两次单击只是 `deselect()`，幂等无副作用。
       ⚠️ 门扇上不要处理 —— 两次单击已经把门开又关（净变化为零），
          再叠一个聚焦会让人以为点坏了。 */
    this.canvas.addEventListener('dblclick', (e) => {
      const hit = this.pickAt(e.clientX, e.clientY);
      if (hit.door) return;
      if (hit.id) { this.selectProduct(hit.id, { fly: true }); return; }
      this.fitAll();
      this.toast('已框入全场景 · 双击设备可聚焦，滚轮缩放');
    });

    /* 鼠标移出画布：悬停态必须清掉。
       指针不动就不会再有 pointermove 来纠正，右下角提示会一直停在
       「点击柜门可开合」、标签保持高亮、新加的操作气泡会僵在画布上不消失。 */
    this.canvas.addEventListener('pointerleave', () => {
      /* ⚠️ 判据必须带上 `hoveredId`。只判 `hoveredDoor` 的话，悬停在**元件**上时
         把指针移出画布，`hoveredDoor` 本来就是 null → 整段不执行，
         右下角那行「点击查看 · XX」会一直挂着不消失、标签也保持高亮。 */
      if (this.hoveredDoor || this.hoveredId) {
        this.hoveredDoor = null;
        this.hoveredId = null;
        this._tipSwap(null);
        this.applyLabelState();
      }
      this._placeMoverHint();
    });
    this.canvas.addEventListener('pointermove', (e) => {
      const hit = this.pickAt(e.clientX, e.clientY);
      this.canvas.style.cursor = (hit.door || hit.id) ? 'pointer' : 'grab';
      /* ⚠️ 更新提示的条件必须**同时看门和热点 id**。
         只盯 `hit.door` 的话：从空白处移到某个元件上时 `hoveredDoor` 始终是 null、
         条件不成立，右下角那行字永远停在上一次的文案 ——
         实测悬停元件时提示还是「点击柜内元件查看档案…」这句基础文案，
         新加的 `_viewTip()` 等于白写。 */
      if (hit.door !== this.hoveredDoor || hit.id !== this.hoveredId) {
        this.hoveredDoor = hit.door;
        /* 悬停在门扇上时，右下角的场景提示临时换成「点击开合」——
           门扇是个大平面、点了会动，不给提示的话用户不知道能点。 */
        this._tipSwap(hit.door ? this._moverTip(hit.door) : this._viewTip(hit.id));
      }
      if (hit.id !== this.hoveredId) { this.hoveredId = hit.id; this.applyLabelState(); }
    });

    // 按钮
    this.$('#btn-reset').addEventListener('click', () => this.resetView());
    /* 「全景」= 把本场景的设备整体框进画面。和「重置视角」是两件事：
       后者回**场景声明的默认机位**（为了突出主角，常常只看得到一角），
       前者是「这一场到底都有些什么」。 */
    this.$('#btn-fitall')?.addEventListener('click', () => this.fitAll());
    this.$('#btn-labels').addEventListener('click', () => this.cycleLabels());
    /* 窄屏顶栏的「场景」下拉。原生 `<details>` 已经管好了
       「Enter/Space 展开、焦点环、读屏播报」，这里只补三件事：
       ① 开的时候算一次 fixed 坐标；② 点外面关；③ Esc 关并把焦点还给 summary。
       ⚠️ 宽屏下不该能打开 —— 判据取 summary 的 computed `pointer-events`，
          与 CSS 媒体查询同源，**不要硬编码 innerWidth 断点**（断点一改 JS 就跟不上）。 */
    const drop = this.$('#tb-scenes');
    if (drop) {
      drop.addEventListener('toggle', () => {
        if (drop.open) this.openSceneMenu();
      });
      document.addEventListener('pointerdown', (e) => {
        if (drop.open && !drop.contains(e.target)) drop.open = false;
      });
      drop.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drop.open) {
          drop.open = false;
          /* ⚠️ 走 `_focusIn` 而不是裸 `.focus()`：菜单是 `position:fixed`，
             收起时若 `#app` 已经被滚歪过，裸 focus 会再滚一次。 */
          this._focusIn(drop.querySelector('summary'));
        }
      });
      /* 窗口一变，fixed 坐标就过期了（比如用户从 1024 拖到 1440）；
         媒体查询也可能翻面 → tabindex 必须跟着重算。 */
      addEventListener('resize', () => {
        this.syncSceneDrop();
        if (drop.open) this.openSceneMenu();
      });
      this.syncSceneDrop();
    }
    this.$('#btn-rotate').addEventListener('click', (e) => {
      this.autoRotate = !this.autoRotate;
      /* reduce 下自转减半 —— 用户主动按的按钮不替他关掉，但转速要收敛。 */
      this.controls.autoRotateSpeed = RM ? 0.28 : 0.55;
      this.controls.autoRotate = this.autoRotate;
      e.currentTarget.classList.toggle('on', this.autoRotate);
      e.currentTarget.setAttribute('aria-pressed', this.autoRotate ? 'true' : 'false');
    });
    /**
     * 全屏：进出都要「干净」。
     *
     * 踩过的坑：全屏状态下直接点「← 返回百科手册」跳走，Chrome 的 fullscreen 状态
     * 不会随导航退出，新页面会被渲染成**一整片黑**（用户反馈的原话就是「点全屏再点返回手册会黑屏」）。
     * 处理办法三条：
     *   ① 全屏时点任何站内链接，先 await exitFullscreen 再跳；
     *   ② fullscreenchange 后强制重算尺寸 + 重画一帧（进出全屏画布尺寸会变）；
     *   ③ pagehide / beforeunload 兜底，用浏览器后退键离开时也尽量退出全屏。
     */
    const syncFullscreen = () => {
      const fb = this.$('#btn-full');
      fb?.classList.toggle('on', !!document.fullscreenElement);
      fb?.setAttribute('aria-pressed', document.fullscreenElement ? 'true' : 'false');
      this._w = -1; this._h = -1;
      this.resize();
      this._needsRender = true;
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    document.addEventListener('webkitfullscreenchange', syncFullscreen);

    this.$('#btn-full').addEventListener('click', () => {
      const el = document.documentElement;
      if (!document.fullscreenElement) {
        const p = el.requestFullscreen?.();
        if (p && p.catch) p.catch(() => { /* 用户或策略拒绝，忽略 */ });
      } else {
        const p = document.exitFullscreen?.();
        if (p && p.catch) p.catch(() => {});
      }
    });

    // 用捕获阶段，保证在浏览器执行默认导航之前拦下来
    document.addEventListener('click', (e) => {
      if (!document.fullscreenElement) return;
      const a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      const href = a.getAttribute('href');
      const blank = a.getAttribute('target') === '_blank';
      if (blank) {
        /* ⚠️ 新标签页必须**同步** window.open —— 放到 exitFullscreen 的 .then 里
           就已经脱离用户手势，会被弹窗拦截器挡掉（手册档案按钮就是 target=_blank）。
           新标签打开后本页保持全屏没有影响，用户按 Esc 即可退出。 */
        e.preventDefault();
        window.open(href, '_blank', 'noopener');
        return;
      }
      e.preventDefault();
      const go = () => { window.location.href = href; };
      const p = document.exitFullscreen?.();
      if (p && p.then) p.then(go).catch(go);
      else go();
    }, true);

    const bailFullscreen = () => {
      if (document.fullscreenElement) { const p = document.exitFullscreen?.(); if (p && p.catch) p.catch(() => {}); }
    };
    window.addEventListener('pagehide', bailFullscreen);
    window.addEventListener('beforeunload', bailFullscreen);
    this.$('#btn-collapse').addEventListener('click', (e) => {
      const app = this.$('#app');
      app.classList.toggle('lean');
      const lean = app.classList.contains('lean');
      e.currentTarget.classList.toggle('on', lean);
      e.currentTarget.setAttribute('aria-pressed', lean ? 'true' : 'false');
      // 沉浸模式下右侧面板被收起，小视口没必要继续渲染
      this.viewer?.setVisible(!lean);
      /* 两条侧栏被压成 0px 宽，但**控件还在文档里** → 键盘会走进看不见的区域 */
      this._syncInert();
      this._needsRender = true;
    });
    /* ⚠️ 这颗按钮一度**完全没有绑定点击** —— 全库只有 `_syncDoorBtn()` / `_setDoorBusy()`
       在切换它的 class，所以它「看起来是活的」（`.on` 会亮、文案也对），
       但点下去什么都不会发生，只有快捷键 O 能用。
       实测（`btn_probe.js`）：`.click()` 之后门纹丝不动，按 O 立刻生效。
       —— **「有样式反馈」不等于「有行为」**。这类缺陷静态 grep 极易漏
       （`#btn-doors` 在 classList 里出现三次，看着像绑过了），必须真的点一下。 */
    this.$('#btn-doors')?.addEventListener('click', () => this.toggleDoors());
    /* 一览里的三颗控件**各管一件事**：
       · 「N 扇柜门」/「M 台手车」→ 定位闪烁（飞到能同时看见它们的位置 + 光圈闪 3 秒）；
       · 「一键开合」→ 和顶栏那颗同源。
       ⚠️ 容器本身**不再**绑开合动作。一颗控件只做一件事 —— 否则「点容器」的落点
          会随机命中某个子按钮，行为不可预测，回归脚本也没法断言到底点到了什么。 */
    this.$('#mover-summary')?.addEventListener('click', (e) => {
      const chip = e.target.closest('.ms-chip');
      if (chip) { this.locateMovers(chip.dataset.kind); return; }
      if (e.target.closest('.ms-all')) this.toggleDoors();
    });
    this.$('#btn-explode')?.addEventListener('click', () => this.toggleExplode());
    this.$('#btn-quality')?.addEventListener('click', () => this.cycleQuality());
    this.$('#fps-chip')?.addEventListener('click', () => this.cycleQuality());
    /* ⚠️ `#fps-chip` 是个可点击的 `<span>` —— 鼠标能点，但**键盘 Tab 不到、回车也没反应**。
       给它补了 `role="button" tabindex="0"`（见 index.html）之后就必须配键盘等价物，
       否则变成「看着像按钮、键盘用不了」，比不做更糟。 */
    this.$('#fps-chip')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.cycleQuality();
      }
    });
    this.$('#btn-panel-toggle')?.addEventListener('click', () => {
      const p = this.$('#panel');
      p.classList.toggle('closed');
      const closed = p.classList.contains('closed');
      /* ⚠️ 光把 `.closed` 加在 `#panel` 上是**不够的** —— 真正要收的是 `#app` 的
         **网格列**（见 style.css 的 `#app.panel-closed`）。原先这里只切 class + 改文案，
         面板纹丝不动，而 aria 已经把「已收起」说出去了 —— 比不做更糟。 */
      this.$('#app').classList.toggle('panel-closed', closed);
      /* ⚠️ `aria-expanded` / `aria-label` / `title` **不在这里写** —— 全部交给
         `_syncInert()`（它才知道 `lean` / `adv` 这些叠加状态）。
         就地写一份的结果就是：沉浸模式下 aria 说「已展开」、面板却已经收起来了。 */
      this._syncInert();
      this._needsRender = true;
    });

    // 键盘
    window.addEventListener('keydown', (e) => {
      if (e.target.matches('input,textarea')) return;
      /* ⚠️⚠️ 第 48 轮修正：`role="dialog"` 的抽屉**必须能用 Esc 关** ——
         这是对话框最基本的键盘约定（WAI-ARIA APG），原来 Esc 只做 `deselect()`，
         抽屉开着时按 Esc 什么都不会发生，键盘用户只能去够右上角那颗 ✕。
         ⚠️ **顺序不能反**：先关抽屉，两个都没开时才做取消选中 ——
         否则「开着抽屉按 Esc」会变成「把背后那个看不见的元件取消选中了」，
         而用户真正想关的那一层毫无反应。 */
      if (e.key === 'Escape') {
        if (this.altsOpen) this.toggleAlts(false);
        else if (this.advOpen) this.toggleAdvisor(false);
        else this.deselect();
      }
      else if (e.key === 'r' || e.key === 'R') this.resetView();
      else if (e.key === 'e' || e.key === 'E') this.toggleExplode();
      else if (e.key === 'o' || e.key === 'O') this.toggleDoors();
      else if (e.key === 'q' || e.key === 'Q') this.cycleQuality();
      else if (e.key === 'a' || e.key === 'A') this.toggleAdvisor();
      else if (e.key === 'v' || e.key === 'V') this.toggleAlts();
      else if (e.key === 'l' || e.key === 'L') this.$('#btn-labels').click();
      /* ⚠️ 顶栏每一颗按钮都要有键盘等价物 —— 只挂在 title 里、没有快捷键的
         「自动旋转 / 沉浸 / 全屏 / 全景」等于只有鼠标能到（键盘用户直接够不着）。
         侧栏底部那份「快捷键」清单必须和这里一一对应，改一处就要改两处。 */
      else if (e.key === 't' || e.key === 'T') this.$('#btn-rotate').click();
      else if (e.key === 'i' || e.key === 'I') this.$('#btn-collapse').click();
      else if (e.key === 'f' || e.key === 'F') this.$('#btn-full').click();
      else if (e.key === '0') this.fitAll();
      else if (/^[1-9]$/.test(e.key)) {
        const s = SCENES[parseInt(e.key, 10) - 1];
        if (s) this.loadScene(s.id);
      }
    });

    // 移动端守卫
    const guard = () => {
      const small = isSmallScreen();
      this.blocked = small;
      this.$('#mobile-guard').classList.toggle('on', small);
      this.$('#app').classList.toggle('blocked', small);
      // 被守卫挡住 / 屏幕太小时，两个渲染器都停掉，别让手机白烧电
      this.viewer?.setVisible(!small);
      this._needsRender = true;
    };
    guard();
    window.addEventListener('resize', guard);
    window.addEventListener('orientationchange', () => setTimeout(guard, 260));
  }

  /**
   * 屏幕坐标拾取。返回 { door, id }：
   *   door —— 命中的门轴 Group（点击它＝开合这扇门），没命中为 null
   *   id   —— 命中的热点 key（点击它＝选中产品/元件），没命中为 null
   *
   * 返回的 `door` 字段其实是「**可动件**」：门轴 Group（userData.door）
   * 或推拉件（userData.slide，例如手车）。调用方用 toggleDoor() 统一处理。
   *
   * ⚠️ 可动件要**优先于热点代理盒**判定。代理盒是不可见的（Raycaster 不检查 visible），
   *    门一关上它会横在门扇前面，把「点门扇」误判成「选中整个柜体」。
   *    门开着时门扇在侧面、根本不在射线上，所以这不妨碍「透过门洞点柜内元件」。
   */
  pickAt(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.x = ((cx - r.left) / r.width) * 2 - 1;
    this.pointer.y = -((cy - r.top) / r.height) * 2 + 1;
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects(this.pickTargets, true);

    /* 第一遍：**只看门**。
       为什么要单独扫一遍：热点的隐形拾取代理盒是按「元件 + 它周围的门扇」的包围盒建的
       （代理盒本身不可见，但 Raycaster **不检查 visible**，照样能打中）。门开着时代理盒
       跟着鼓出去，门一关上，代理盒反而横在门扇前面 —— 于是「点门扇」被误判成
       「选中整个柜体」（wind 的 PREFAB、gis/pv 的 LCP 都踩过）。
       门扇是大平面、用户点它就是想要开关，所以门优先。
       这不会影响「透过门洞点柜内元件」—— 门开着时门扇在侧面，根本不在射线上。 */
    for (const it of hits) {
      let o = it.object;
      while (o) {
        if (o.userData && (o.userData.door || o.userData.slide)) return { door: o, id: null };
        o = o.parent;
      }
    }

    /* 第二遍：常规热点 / 产品。按射线命中先后，不能「有门就返回门」——
       门开着时用户会透过门洞点柜内元件，那一击必须算选中产品。 */
    for (const it of hits) {
      let o = it.object;
      while (o) {
        if (o.userData) {
          if (o.userData.hotspotId) return { door: null, id: o.userData.hotspotId };
          if (this.hotspotById.has(o.userData.pid)) return { door: null, id: o.userData.pid };
        }
        // 命中产品本体：向上找到注册过的 Group
        for (const [key, h] of this.hotspotById) if (h.object === o) return { door: null, id: key };
        o = o.parent;
      }
    }
    return { door: null, id: null };
  }

  /**
   * 按当前舞台宽高比反解取景 —— 场景声明一组「必须完整入画的物件盒」，
   * 这里保证它们的角点全部落在视锥内（带 pad 边距）。
   *
   * 为什么需要它：舞台宽高比不是常数 —— 窗口尺寸、两侧栏折叠、沉浸模式
   * 都会改它（实测 0.89 ~ 1.32）。而场景里写死的机位只能对某一个比值调准：
   * 比它窄时物件被切出画面，比它宽时又退得太远、主体显得很小。
   * 把「必须完整入画的物件」交给代码算，就不必再随窗口变化反复手调机位。
   *
   * build.fit 结构：
   *   parts: [[x0,y0,z0,x1,y1,z1], …]  必须完整入画的世界 AABB（必填）
   *   mode:  'dist'（默认，户外场地：改机位距离）| 'fov'（户内：机位不动，只撑视场角）
   *   dir / aim / pad / minDist / maxDist   —— dist 模式参数
   *   fovMin / fovMax                       —— fov 模式参数
   * 返回 { pos, target, fov, dist }；未声明 fit 或反解失败时返回 null。
   */
  fitCamera(build) {
    const fit = build && build.fit;
    if (!fit || !fit.parts || !fit.parts.length) return null;
    const mode = fit.mode || 'dist';
    const pad = fit.pad || 1.06;
    const UP = new THREE.Vector3(0, 1, 0);

    /* ⚠️ 约束必须**逐盒**算，不能先合成一个大并集盒。
       并集盒会造出「西边的 x + 东边的 y + 最近的 z」这种没有任何实物存在的空角，
       取景被空角白白撑远 —— pv 实测并集盒要 29.8m、逐盒只要 21.7m，差 8m。 */
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (const b of fit.parts) {
      x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); z0 = Math.min(z0, b[2]);
      x1 = Math.max(x1, b[3]); y1 = Math.max(y1, b[4]); z1 = Math.max(z1, b[5]);
    }
    const aim = fit.aim ? fit.aim.slice() : [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const aspect = this.camera.aspect || 1;

    if (mode === 'fov') {
      /* 机位与注视点都不动，只把 fov 撑到刚好装下。
         户内场景必须这么做 —— 靠后退取景会穿出墙和天花板。
         宽舞台（aspect 大）时算出来的 fov 可能比场景写的还小，取 max 保留场景的构图意图。 */
      const src = build.camera;
      if (!src) return null;
      const eye = new THREE.Vector3(...src.pos);
      const tgt = new THREE.Vector3(...src.target);
      const f = tgt.clone().sub(eye).normalize();
      const r = new THREE.Vector3().crossVectors(f, UP);
      if (r.lengthSq() < 1e-8) r.set(1, 0, 0);
      r.normalize();
      const u = new THREE.Vector3().crossVectors(r, f).normalize();
      let tanV = 0;
      for (const b of fit.parts) {
        for (let i = 0; i < 8; i++) {
          const v = new THREE.Vector3(
            (i & 1 ? b[3] : b[0]) - eye.x,
            (i & 2 ? b[4] : b[1]) - eye.y,
            (i & 4 ? b[5] : b[2]) - eye.z);
          const zc = v.dot(f);
          if (zc <= 1e-4) return null;   // 有物件在相机背后 —— 退回写死机位
          tanV = Math.max(tanV,
            Math.abs(v.dot(u)) * pad / zc,
            Math.abs(v.dot(r)) * pad / (zc * aspect));
        }
      }
      const fov = Math.min(Math.max(
        THREE.MathUtils.radToDeg(2 * Math.atan(tanV)),
        fit.fovMin ?? (build.fov || 38)), fit.fovMax ?? 72);
      return { pos: src.pos.slice(), target: src.target.slice(), fov, dist: eye.distanceTo(tgt) };
    }

    /* dist 模式：相机在 aim + dir·d 上，解出刚好装下所有盒子的最小 d。
       对盒角点 p：w = p − cam = v + f·d（v = p − aim，f = 视线方向 = −dir），于是
         z_cam = v·f + d、x_cam = v·r、y_cam = v·u；
       由 |x_cam| ≤ z_cam·tanH 得 d ≥ |v·r|/tanH − v·f，y 方向同理，取最大值。 */
    const fov = build.fov || 38;
    const tanV = Math.tan(fov * Math.PI / 360);
    const tanH = tanV * aspect;
    const dir = new THREE.Vector3(...(fit.dir || [0.4, 0.36, 1])).normalize();
    const f = dir.clone().negate();
    const r = new THREE.Vector3().crossVectors(f, UP);
    if (r.lengthSq() < 1e-8) r.set(1, 0, 0);
    r.normalize();
    const u = new THREE.Vector3().crossVectors(r, f).normalize();
    const A = new THREE.Vector3(...aim);
    let d = 0;
    for (const b of fit.parts) {
      for (let i = 0; i < 8; i++) {
        const v = new THREE.Vector3(
          (i & 1 ? b[3] : b[0]) - A.x,
          (i & 2 ? b[4] : b[1]) - A.y,
          (i & 4 ? b[5] : b[2]) - A.z);
        const vf = v.dot(f);
        d = Math.max(d,
          Math.abs(v.dot(r)) * pad / tanH - vf,
          Math.abs(v.dot(u)) * pad / tanV - vf);
      }
    }
    d = Math.min(Math.max(d, fit.minDist ?? 0.6), fit.maxDist ?? 80);
    return { pos: A.clone().addScaledVector(dir, d).toArray(), target: aim, fov, dist: d };
  }

  /**
   * 舞台尺寸变化后按新宽高比重算机位。
   * 只在**用户还没动过相机**时执行 —— 判据用「相机是否还在 home 位」，
   * 比记一个 dirty 标志稳：选中产品会飞过去、复位会飞回来，
   * 标志很容易在某个分支上记漏，而位置比较是无状态的。
   */
  refitCamera() {
    const spec = this._fitSpec;
    if (!spec) return;
    if (this.homePos && this.camera.position.distanceToSquared(this.homePos) > 1e-4) return;
    if (this.homeTarget && this.controls.target.distanceToSquared(this.homeTarget) > 1e-4) return;
    const fc = this.fitCamera({ fov: spec.fov, fit: spec.fit, camera: spec.home, limits: spec.limits });
    if (!fc) return;
    if (fc.fov && Math.abs(fc.fov - this.camera.fov) > 0.01) {
      this.camera.fov = fc.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(...fc.pos);
    this.controls.target.set(...fc.target);
    this.homePos.set(...fc.pos);
    this.homeTarget.set(...fc.target);
    this.controls.maxDistance = Math.max(this._maxDBase ?? 12, fc.dist * 1.35);
    this.controls.update();
  }

  resize() {
    const r = this.stage.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    if (this._w === w && this._h === h) return;
    this._w = w; this._h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewer?.resize();
    /* 宽高比变了，取景盒要重算。沉浸模式切换时舞台宽度有 340ms 过渡，
       ResizeObserver 会连发多次 —— 每次都重算，视觉上就是机位平滑地适配过去。 */
    this.refitCamera();
    this._needsRender = true;     // 尺寸变了必须重画，否则空闲节流会把画布留成空白
  }

  /* ---------------- 主循环 ---------------- */
  tick() {
    const raw = this.clock.getDelta();
    const dt = Math.min(0.05, raw);        // 平滑插值用（限制单帧步长，避免抖动）
    const adt = Math.min(0.34, raw);       // 补间动画用（按真实时间推进，低帧率下仍按时完成）
    const t = this.clock.elapsedTime;
    this.tweens.update(adt);
    const moved = this.controls.update();

    // 高亮过渡
    this.hlTarget = this.hlTarget ?? 0;
    this._hl = lerp(this._hl ?? 0, this.hlTarget, 1 - Math.pow(0.001, dt));
    const sel = this.selectedId ? this.hotspotById.get(this.selectedId) : null;
    if (sel && sel.object.userData.hlMats) {
      const k = this._hl;
      sel.object.userData.hlMats.forEach(m => {
        if (!m.emissive) return;
        const base = new THREE.Color(m.userData._em ?? 0);
        const glow = new THREE.Color(elemColor(this.elementOf(this.selectedId) || {}));
        // 克制的自发光：只做“轻微点亮”，不做整体染色
        m.emissive.copy(base).lerp(glow, k * 0.26);
        m.emissiveIntensity = lerp(m.userData._ei ?? 1, 0.42 + Math.sin(t * 2.6) * 0.12, k);
      });
    }

    // 灯光压暗（选中时聚焦）
    const targetFactor = this.selectedId ? 0.74 : 1;
    this.lightFactor = lerp(this.lightFactor, targetFactor, 1 - Math.pow(0.004, dt));
    this.baseLights.forEach(l => { l.intensity = l.userData.baseIntensity * this.lightFactor; });

    // 爆炸视图（分层展开）
    /* 「减少动效」：爆炸视图是**状态切换**（分解/合拢），不是装饰动画 → 直接到位。 */
    this._ex = RM ? (this.explode ? 1 : 0)
                  : lerp(this._ex ?? 0, this.explode ? 1 : 0, 1 - Math.pow(0.0035, dt));
    if (Math.abs(this._ex - (this._exApplied ?? -1)) > 0.0006) {
      this.applyExplode(this._ex);
      this._exApplied = this._ex;
    }

    /* 柜门开合。必须把「这一帧门有没有动」记下来交给 renderLevel()：
       节流等级判 0 时 tick 直接 return、**不出帧**，门就会「算完了但看不见」。
       ⚠️ 这里传的是**真实帧间隔**（只做 0.5s 上限保护），不是上面那个被 clamp 到 0.05 的 dt。
       0.05 是给「相机抖动」用的平滑步长；门是按秒计时的机械动作，低帧率下必须按真实
       时间推进，否则 1 FPS 时每帧只走 13%，一扇门要 30 秒才关得上（实测踩过）。 */
    this._doorsMoving = this.applyDoors(Math.min(0.5, raw));
    /* 序列跑完了 → 把「开合中…」摘掉。见 _setDoorBusy() 里为什么不走定时器。 */
    if (this._doorBusy && !this._doorsMoving) this._setDoorBusy(false);

    // 安装位置指示（虚线 + 地面标记环）
    if (this.pin && this.pin.visible) {
      this.pinT = RM ? (this.pinOn ? 1 : 0)
                     : lerp(this.pinT ?? 0, this.pinOn ? 1 : 0, 1 - Math.pow(0.004, dt));
      const k = this.pinT;
      if (this.pinMat) this.pinMat.opacity = k * 0.62;
      /* 地面标记环的「呼吸」在 reduce 下换成固定不透明度 —— 环本身还是要显示，
         它标的是安装位置，属于信息不是装饰。 */
      if (this.pinRingMat) this.pinRingMat.opacity = k * (RM ? 0.44 : 0.40 + Math.sin(t * 2.0) * 0.10);
      if (k < 0.012 && !this.pinOn) this.pin.visible = false;
    }

    // 标记点脉冲
    this.markers.forEach(m => {
      const o = m.userData.targetOpacity ?? 0;
      m.material.opacity = lerp(m.material.opacity, o, 1 - Math.pow(0.002, dt));
      const pulse = RM ? 1 : 1 + Math.sin(t * 2.4 + m.position.x * 3.1) * 0.12;
      const base = m.userData.baseScale * (m.userData.hotspotId === this.selectedId ? 1.85 : 1);
      m.scale.setScalar(base * pulse);
      m.visible = m.material.opacity > 0.02;
    });

    // 光环
    if (this.ring) {
      this.ringT = (this.ringT || 0) + dt;
      const k = this._hl;
      this.ring.material.opacity = k * (RM ? 0.38 : 0.34 + Math.sin(t * 2.2) * 0.10);
      const s = RM ? 0.082 : 0.082 + Math.sin(t * 2.2) * 0.005;
      this.ring.scale.setScalar(s * (0.72 + k * 0.4));
      this.ring.visible = k > 0.02;
    }

    /* 定位光圈：3 秒「先涨后落」—— 前 12% 涨到满，之后边淡出边放大。
       到点自毁（移除 + 释放材质），不留垃圾对象。
       ⚠️ 计时用 **raw**（真实帧间隔），不是被 clamp 到 0.05 的 `dt` ——
          光圈是纯时间淡出、不积分，用真实时间才能保证「说 3 秒就 3 秒」。
          用 `dt` 的话低帧率下 3.0 / 0.05 = 60 帧，1 FPS 时要闪一分钟。 */
    if (this._pulses && this._pulses.length) {
      /* 「减少动效」：光圈压到 0.8s。它不带状态、纯反馈，所以是缩短而不是取消。 */
      const LIFE = RM ? 0.8 : 3.0;
      const keep = [];
      for (const q of this._pulses) {
        q.t += raw;
        const k = q.t / LIFE;
        if (k >= 1) {
          this.scene.remove(q.sp);
          q.sp.material.map = null;
          q.sp.material.dispose();
          continue;
        }
        if (!RM) q.sp.scale.setScalar(q.s * (0.7 + k * 0.9));
        q.sp.material.opacity = (k < 0.12 ? k / 0.12 : 1) * (1 - k) * 0.85;
        keep.push(q);
      }
      this._pulses = keep;
    }

    // HTML 标签跟随 + 屏幕避让
    if (this.labelOrder && this.labelOrder.length) {
      const cam = this.camera;
      const w = this._w || 1, h = this._h || 1;
      const v = new THREE.Vector3();
      const taken = [];

      /* 标签是 HTML 浮层，不参与深度测试，离得近就糊成一团。
         一个 0.8m 宽的二次室里能挤下 10 个热点，屏幕上只有 ~250px 宽 ——
         纯「重叠就隐藏」会把自家产品的标签也藏掉，信息损失太大。
         所以做两级处理：
           ① 屏幕空间先到先得（选中 / 悬停 > 本公司产品 > 通用元件）；
           ② 冲突时沿**台阶**往上错开 [0, 34, 68, 102, 136, 170] px 再试。
             台阶是往上走的，3D 标记点（发光圆点）仍然钉在元件原位，
             所以「哪个标签说的是哪个元件」不会读错 —— 这也是真实现场
             挂牌、贴标签纸的常见做法。
         台阶最多 6 级，再放不下就隐藏。顺序固定、不依赖上一帧，不会闪。 */
      const LADDER = [0, 34, 68, 102, 136, 170];
      const place = (el, hs, force) => {
        if (el.classList.contains('hidden')) { el.style.visibility = 'hidden'; return; }
        /* 被关上的柜门挡住的热点：直接藏，不参与避让台阶（见 _updateDoorOcclusion） */
        if (hs._doorHidden) { el.style.visibility = 'hidden'; return; }
        v.copy(hs.anchor).project(cam);
        const behind = v.z > 1;
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        if (behind || x < -160 || x > w + 160 || y < -60 || y > h + 60) {
          el.style.visibility = 'hidden';
          return;
        }
        // 标签尺寸只量一次（内容在 build 阶段就定死了，不会变）
        const lw = hs._lw || (hs._lw = el.offsetWidth || 112);
        const lh = hs._lh || (hs._lh = el.offsetHeight || 32);
        /* ⚠️ 横向也要夹取。
           原来只判「超出画布 160px 才隐藏」，结果靠舞台边缘的元件（gis 的
           绝缘操作杆、SF6 装置）标签会有一半压在左栏面板上 —— 不是隐藏，
           是**被别的 UI 盖住**，看着像坏了。实测 OPROD 越界 213px。
           做法与纵向台阶同源：把标签中心夹进「左右各留 6px」的可用区间，
           标签整体平移过去（3D 标记点仍钉在元件原位，所以不会读错）。
           标签比舞台还宽时无解，直接隐藏。 */
        if (lw + 12 > w) { el.style.visibility = 'hidden'; return; }
        const cx = clamp(x, lw / 2 + 6, w - lw / 2 - 6);
        let lift = -1;
        for (const L of LADDER) {
          const y1 = y - 10 - L;
          if (y1 - lh < 6) break;                       // 顶到画面外就别再往上堆了
          const box = { x0: cx - lw / 2, x1: cx + lw / 2, y0: y1 - lh, y1 };
          let clash = false;
          if (!force) {
            for (const b of taken) {
              if (box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0) { clash = true; break; }
            }
          }
          if (!clash) { taken.push(box); lift = L; break; }
        }
        if (lift < 0) { el.style.visibility = 'hidden'; return; }
        el.style.visibility = 'visible';
        el.style.transform = `translate(-50%,-100%) translate(${cx.toFixed(1)}px,${(y - 10 - lift).toFixed(1)}px)`;
        const dist = cam.position.distanceTo(hs.anchor);
        el.style.opacity = String(clamp(1.25 - dist / 9, 0.28, 1));
      };

      const hot = (hs) => hs.key === this.selectedId || hs.key === this.hoveredId;
      for (const it of this.labelOrder) if (hot(it.h)) place(it.el, it.h, true);
      for (const it of this.labelOrder) if (!hot(it.h)) place(it.el, it.h, false);
    }

    /* 可动件的操作气泡。刻意放在 labelOrder 的 if **外面** ——
       场景没有热点标签时（或标签全被关掉时）气泡照样要跟着走。 */
    this._placeMoverHint();

    // —— 渲染节流 ——
    const lvl = this.renderLevel(moved);
    this._needsRender = false;

    if (lvl === 0) {
      this.setChip('空闲 · 省电', false, '画面已完全静止，已暂停渲染以省电；移动视角即恢复');
      return;
    }
    if (lvl === 1 && (++this._halfN % 2)) {
      // 半速：呼吸光效 30fps 完全看不出差别，但 GPU 开销减半
      this.setChip(`${this._lastFps ?? '--'} FPS · 省电`, false,
        '画面静止，已自动降为半速渲染；移动视角即恢复全速');
      return;
    }

    this.renderer.render(this.scene, this.camera);
    this.countFps(raw);
  }

  /** FPS 芯片文案：只在内容真的变了才写 DOM，避免每帧无谓的样式重算 */
  setChip(text, warn, title) {
    if (this._chipText === text) return;
    this._chipText = text;
    const chip = this.$('#fps-chip');
    if (!chip) return;
    chip.textContent = text;
    chip.classList.toggle('warn', !!warn);
    chip.title = title || '点击切换画质档位（快捷键 Q）';
  }

  /**
   * 渲染节流等级。低配机器上，用户 80% 的时间是在读产品卡片而不是转模型，
   * 这时候没必要让 GPU 满速空转。
   *   2 = 全速（相机在动 / 有补间 / 场景刚变）
   *   1 = 半速（相机静止，但还有呼吸光效、高亮过渡在动）
   *   0 = 完全不渲染（画面已完全静止，保持最后一帧即可）
   */
  renderLevel(moved) {
    if (this.blocked) return 0;               // 被移动端守卫挡住 → 完全停渲染
    if (this._needsRender || moved) return 2;
    if (this.tweens.list.length || this.autoRotate) return 2;
    if (Math.abs((this._ex ?? 0) - (this.explode ? 1 : 0)) > 0.004) return 2;
    if (this._doorsMoving) return 2;
    /* 定位光圈在闪 → 必须持续出帧，否则空闲节流会把光圈冻在半路。 */
    if (this._pulses && this._pulses.length) return 2;
    if (Math.abs((this._hl ?? 0) - (this.hlTarget ?? 0)) > 0.004) return 2;
    if (this.pin && this.pin.visible && Math.abs((this.pinT ?? 0) - (this.pinOn ? 1 : 0)) > 0.012) return 2;
    if (this.selectedId || this.hoveredId || (this.ring && this.ring.visible)) return 1;
    return 0;
  }

  /** 每 0.5s 刷新一次帧率；连续偏低就自动降档，并明确告诉用户为什么 */
  countFps(raw) {
    /* ⚠️⚠️ 一帧超过 1 秒 ⇒ 这说明**根本没有在连续出帧**（切到后台再回来、主线程被长任务
       占住），而不是「帧率低」。这种帧一旦进累加器，`_fpsN / _fpsT` 必然算出
       `round(1/60) ≈ 0` —— 芯片上闪一下刺眼的「0 FPS」，`_fpsLow` 还跟着记一笔。
       这与第 43 轮那句「（0 FPS）」是**同一个指纹**，只是触发源从「装载」换成了「后台」。
       ⚠️ 阈值为什么取 1s 而不是更小：装载期已经由下面的 `_loading` 挡住；而 <1 FPS 的机器
          在任何档位都已无路可降（`detectQuality()` 早就给到最低档），丢掉这一条不会削弱
          保护能力 —— 真正的稳态低帧率（哪怕只有 2~3 FPS）照样会被采到并触发降档。
       ⚠️ 这一条是 `initEvents()` 里 `visibilitychange → dropGap()` 的**兜底**：
          某些时序下 rAF 可能先于 visibilitychange 跑了一帧，那时只有这里挡得住。 */
    if (raw > 1) { this._fpsN = 0; this._fpsT = 0; this._fpsLow = 0; return; }
    this._fpsN = (this._fpsN || 0) + 1;
    this._fpsT = (this._fpsT || 0) + raw;
    if (this._fpsT < 0.5) return;

    /* ⚠️⚠️ 装载期间**只清累加器，不判定、也不写芯片**。
       装载是几秒的同步重活（`build()` + `batchStatic()`），中间只隔 2 帧，
       帧率必然低于 30 —— 那是「**正在装东西**」而不是「**场景卡**」。
       拿它去判「帧率偏低」，用户每切几次场景画质就被自动降一档：
       实测（`autodowngrade_probe.js`）连切 3 个场景，画质 **高 → 中 → 低 + 关阴影**，
       而弹出来的话是「帧率偏低（3 FPS）」「已关闭阴影以进一步提帧（**0 FPS**）」
       —— 「0 FPS」这个数字本身就是 bug 的指纹。
       ⚠️ 必须连 `_fpsN` / `_fpsT` 一起清零：否则装载期间攒下的**秒级长帧**会「结转」
          到装载后的第一次采样，算出 0~1 FPS 的假值（这就是那句「0 FPS」的来源），
          而且会让紧随其后的稳态采样也被误判成低帧率。
       ⚠️ 同理 `_fpsLow` 也要清零：装载期间攒到 3 次就会在装载**刚结束**时触发降档，
          那时用户看到的画面其实已经是稳态了，归因完全错位。 */
    if (this._loading) { this._fpsN = 0; this._fpsT = 0; this._fpsLow = 0; return; }

    const fps = Math.round(this._fpsN / this._fpsT);
    this._fpsN = 0; this._fpsT = 0;
    this._lastFps = fps;

    this.setChip(`${fps} FPS`, fps < 40, `当前 ${fps} FPS · 点击切换画质档位（快捷键 Q）`);

    // 开场 4 秒不判断：首帧要建几何、编译着色器，必然掉帧，属于假信号
    if (this.clock.elapsedTime < 4 || !this.autoQuality) return;

    if (fps < 30) { this._fpsLow = (this._fpsLow || 0) + 1; }
    else { this._fpsLow = 0; }

    // 连续 3 次采样（≈1.5s）低于 30 帧 → 降一档。
    // 只降不升：来回升降会来回抖动，反而更难受；用户想升回去点一下画质按钮即可。
    if (this._fpsLow >= 3 && (this.quality < 2 || !this.noShadow)) {
      this._fpsLow = 0;
      if (this.quality < 2) {
        const from = this.qualitySpec().name;
        this.quality += 1;
        this.applyQuality(true);
        this.toast(`帧率偏低（${fps} FPS），画质已从「${from}」自动降到「${this.qualitySpec().name}」。点顶栏画质按钮可手动切换。`, 'warn');
      } else {
        // 已经最低档还是卡：彻底关阴影，把最后的开销也让出来
        this.noShadow = true;
        this.applyQuality(true);
        this.toast(`已关闭阴影以进一步提帧（${fps} FPS）。若仍不流畅，可缩小浏览器窗口，或改用带独立显卡的设备。`, 'warn');
      }
    }
  }

  /** 轻提示条：3.6 秒后自动淡出 */
  toast(msg, kind) {
    const wrap = this.$('#toast-wrap');
    if (!wrap) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    wrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
    setTimeout(() => {
      el.classList.remove('on');
      setTimeout(() => el.remove(), 320);
    }, 3600);
    // 最多同时显示 2 条
    while (wrap.children.length > 2) wrap.firstChild.remove();
  }
}
const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap', 'aoMap', 'bumpMap', 'specularMap', 'displacementMap'];

/**
 * 卸载一棵子树。
 * 两条纪律：
 *   1. 材质库里的单例（userData.shared）不能 dispose —— 否则下一个场景全部重编译着色器；
 *   2. 场景 / 产品自己用 canvasTex 生成的贴图必须 dispose —— 否则每切一次场景就漏一批
 *      显存，切十几次之后低配机器就爆了。
 */
function disposeTree(root) {
  const texes = new Set();
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (!o.material) return;
    const arr = Array.isArray(o.material) ? o.material : [o.material];
    arr.forEach(m => {
      if (!m) return;
      /* ⚠️ 这里必须容错。曾经出现过 `cyl(..., [[-1, M.ledGreen], ...].entries(), 10)`
         这种把「数组」当材质传进去的写法：material 成了数组、元素是数字，
         m.dispose() 直接抛 —— 而 disposeTree 是在切场景的**清理阶段**调的，
         一抛就把整条 loadScene 链路打断：遮罩不收、热点不建，
         用户看到的现象是「点了场景一直转圈」。宁可留一个告警也不要炸链路。 */
      if (typeof m.dispose !== 'function') {
        console.warn('[disposeTree] 非法材质，已跳过：', m);
        return;
      }
      if (m.userData && m.userData.shared) return;
      TEX_KEYS.forEach(k => {
        const t = m[k];
        if (t && !(t.userData && t.userData.shared)) texes.add(t);
      });
      m.dispose();
    });
  });
  texes.forEach(t => t.dispose());
}

/* ---------------- 启动 ---------------- */
function boot() {
  try {
    // __THREE 是给无头诊断脚本用的（穿模检测要自己算 Box3），不影响正常运行
    window.__THREE = THREE;
    window.__app = new App();
  } catch (err) {
    console.error(err);
    const msg = String((err && err.message) || err);
    // 优先交给 index.html 里的经典脚本渲染自诊断面板（它会附上 WebGL / 显卡 / 协议等信息），
    // 拿不到就退化成简单文案。千万不要只 console.error —— 用户看到的就是一直转圈。
    if (typeof window.__bootFail === 'function') {
      window.__bootFail('三维引擎初始化失败',
        '页面脚本已经开始执行，但在创建渲染器 / 场景时抛出了异常。',
        ['先按 Ctrl+F5 强制刷新一次（避开缓存里的半截文件）',
          '确认 <code>models/vendor/</code> 下的 Three.js 文件完整（没有被杀软/同步盘删掉）',
          '换用最新版 Chrome / Edge',
          '把下面这段信息发给我，我来定位'],
        msg);
    } else {
      const l = document.getElementById('loading');
      if (l) l.innerHTML = `<div class="ld-box"><b>加载失败</b><p>${msg}</p><p class="dim">请确认 models/vendor 下的 Three.js 文件完整，并使用现代浏览器（Chrome / Edge）。</p></div>`;
    }
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 0);
else window.addEventListener('DOMContentLoaded', boot);
