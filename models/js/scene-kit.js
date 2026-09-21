/**
 * scene-kit.js —— 场景公共工具：环境贴图、天空、热点、标记
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { C, canvasTex } from './util.js';
import { M } from './mats.js';
import { buildElement } from './elements.js';

/* ============================================================
 * 环境贴图（PMREM）—— 决定金属/塑料的反射质感
 * ============================================================ */

/** 室内：中性柔光棚（冷白工业光）
 *
 * ⚠️ 第 57 轮修。原来这里写的是：
 *      s.traverse(o => { if (o.isLight) o.intensity *= 1.0; });
 *    注释写着「把房间调成冷白工业色」，实际是**两重空操作**：
 *      ① `* 1.0` 乘了个寂寞；
 *      ② RoomEnvironment(r160) 的发光板是 `new MeshBasicMaterial()` +
 *         `material.color.setScalar(intensity)`（见 vendor/RoomEnvironment.js 的
 *         `createAreaLightMaterial`），是 **MeshBasicMaterial，没有 `intensity` 字段**；
 *         全场唯一的真光源是 `mainLight`（PointLight）。
 *    ⇒ 结果：室内环境贴图是**纯灰、零色温**，金属与塑料的反射没有冷暖可言。
 *    真做冷白化要按材质类型分派：点光改 `color`，发光板乘到 `color` 上。
 *    ⚠️ 只动这两类 —— 房间壳 `roomMaterial` / 暗箱 `boxMaterial` 是 MeshStandardMaterial，
 *       它们是「被照的物体」不是「灯」，乘上去会把整个环境压暗。
 */
const INDOOR_TINT = [0.86, 0.945, 1.035];   // 冷白（≈6500K 观感），绿通道居中、蓝最高

function indoorEnvScene() {
  const s = new RoomEnvironment();
  const tint = new THREE.Color(INDOOR_TINT[0], INDOOR_TINT[1], INDOOR_TINT[2]);
  s.traverse(o => {
    if (o.isLight) { o.color.multiply(tint); return; }
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      // 只有「发光板」才是灯：RoomEnvironment 用 MeshBasicMaterial 表达面光
      if (m.isMeshBasicMaterial && m.color) m.color.multiply(tint);
    });
  });
  return s;
}

/** 户外：程序化天空 + 太阳 + 地面，用于户外场景的反射 */
function outdoorEnvScene() {
  const s = new THREE.Scene();

  // 天空穹顶（顶部深蓝 → 地平线亮白）
  const skyGeo = new THREE.SphereGeometry(60, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x1e4f8a) },
      mid: { value: new THREE.Color(0x9dc4e8) },
      bot: { value: new THREE.Color(0x4a4a46) },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bot;
      void main(){
        float h = normalize(vP).y;
        vec3 c = mix(bot, mid, smoothstep(-0.25, 0.12, h));
        c = mix(c, top, smoothstep(0.08, 0.75, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  s.add(new THREE.Mesh(skyGeo, skyMat));

  // 太阳
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(6, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6e0 })
  );
  sun.position.set(-30, 26, -22);
  s.add(sun);
  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(13, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffe9c0, transparent: true, opacity: 0.35 })
  );
  sunGlow.position.copy(sun.position);
  s.add(sunGlow);

  // 地面半球（漫反射亮灰）
  const g = new THREE.Mesh(
    new THREE.CircleGeometry(60, 32),
    new THREE.MeshBasicMaterial({ color: 0x8a8578 })
  );
  g.rotation.x = -Math.PI / 2;
  g.position.y = -3;
  s.add(g);
  return s;
}

let _pmrem = null;
const _cache = {};

export function getEnvMap(renderer, kind) {
  if (_cache[kind]) return _cache[kind];
  if (!_pmrem) _pmrem = new THREE.PMREMGenerator(renderer);
  _pmrem.compileEquirectangularShader();
  const src = kind === 'outdoor' ? outdoorEnvScene() : indoorEnvScene();
  const rt = _pmrem.fromScene(src, kind === 'outdoor' ? 0.02 : 0.04, 0.1, 120);
  _cache[kind] = rt.texture;
  return rt.texture;
}

/* ============================================================
 * 天空穹顶（户外可视天空，非 env）
 *
 * ⚠️ 第 57 轮重做。出图实测「天空发白、太平」，四个原因，逐个说清楚：
 *
 *  ① **输出色彩空间错了**（「发白」的根因，不是配色问题）。
 *     `ShaderMaterial` 的 `gl_FragColor` **不会**被 three.js 自动做色调映射与
 *     sRGB 编码 —— `#include <tonemapping_fragment>` / `<colorspace_fragment>` 只写在
 *     **内置材质**的片元里。已核对 `vendor/three.module.min.js`：
 *       · `colorspace_fragment` 的定义就是 `gl_FragColor = linearToOutputTexel( gl_FragColor );`
 *       · 而通用片元前缀里确实带了 `tonemapping_pars_fragment` / `toneMapping` /
 *         `linearToOutputTexel`（`n.toneMapping!==$?fa.tonemapping_pars_fragment:""` 那段）
 *     ⇒ 自定义 ShaderMaterial **能**用这三个 include，但**必须自己写**。
 *     不写的后果：uniform 里的 `THREE.Color` 在 `ColorManagement` 打开时存的是**线性值**，
 *     却被当成 sRGB 码值直接写进帧缓冲 ⇒ 低仰角段整体被抬亮、对比压平，看着就是「发白」。
 *
 *  ② **蓝天上不来**。原来 `smoothstep(0.10, 0.85, h)` ⇒ 仰角 20° 处只混进约 8% 顶色，
 *     而默认机位只看得到 h ∈ [0, 0.30] 那一段 ⇒ 满屏都是 bot/mid 之间的浅色。
 *     改 `smoothstep(0.015, 0.42, h)`：蓝从地平线上方一点就开始上色。
 *
 *  ③ **没有太阳**。主光明明在 -x/+z，天空却左右完全对称 ⇒ 光和天对不上。
 *     按主光方向加「大范围朝日亮化 + 柔化日面」，天空自己指向光源。
 *
 *  ④ **大跨度渐变必出色带**。加 1/255 量级的抖动噪声打散。
 *     ⚠️⚠️ **不要用 three 的 `dithering_fragment`**（哪怕 `material.dithering = true`）——
 *     它展开是 `gl_FragColor.rgb = dithering( gl_FragColor.rgb );`，而 `dithering()` 定义在
 *     `dithering_pars_fragment` 里，那个 chunk **不在通用片元前缀里**（前缀只给
 *     `#define DITHERING`），只有内置材质自己 `#include` 了它。
 *     实测报错：`'dithering' : no matching overloaded function found` ⇒ **片元着色器编译失败**。
 *     所以这里自己写一行噪声，不依赖任何 chunk。
 *
 * 代价：仍是 **1 个 draw call、0 张贴图**（日面是解析式的，不用 Sprite）。
 *
 * ⚠️ 尾部两个 include 的**顺序照抄内置材质**（meshbasic_frag）：色调映射 → 色彩空间。
 *    抖动放在**色彩空间之后**（内置材质也是这个次序：色带是在输出码值上出现的）。
 * ============================================================ */
export function skyDome(radius = 120, opts = {}) {
  /* 默认太阳方向取「左上前方」—— 与本库 5 个户外场景主光 `pos` 同侧
     （都在 -x / +y / +z）。场景要精确对齐就传 `{ sun: [x, y, z] }`。 */
  const sun = new THREE.Vector3(...(opts.sun || [-6.5, 8.5, 5.5])).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      /* 三个色值现在是**线性光强**（会过 ACES + sRGB），所以要比 sRGB 十六进制值亮不少。
         ⚠️ 渐变的「分界高度」不是随手给的 —— 它是按**相机实际看得见哪一段**标定的：
            默认机位基本平视，可见天空是 h ∈ [0, 0.15]；把 `top` 的分界放到 0.4 以上，
            可见区就全落在 bot/mid 之间，蓝永远上不来（实测：h≈0.15 处还是 #91a7b8，
            饱和差只有 39，肉眼就是「发白」）。
            ⇒ `mid` 在 h≈0.045 就到位、`top` 在 0.03~0.26 之间混完。
            改这两个分界值之前，**先跑 `sky_sample.js` 看剖面**。 */
      top: { value: new THREE.Color(opts.top === undefined ? 0x1a5cae : opts.top) },
      mid: { value: new THREE.Color(opts.mid === undefined ? 0x7fb4e6 : opts.mid) },
      bot: { value: new THREE.Color(opts.bot === undefined ? 0xdfeaf4 : opts.bot) },
      sunDir: { value: sun },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec3 vP;
      uniform vec3 top, mid, bot, sunDir;
      void main(){
        vec3 d = normalize(vP);
        float h = d.y;
        vec3 c = mix(bot, mid, smoothstep(-0.02, 0.045, h));
        c = mix(c, top, smoothstep(0.03, 0.26, h));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(1.00, 0.96, 0.88) * pow(s, 7.0) * 0.40;                    // 朝日侧天光
        c += vec3(1.00, 0.95, 0.82) * smoothstep(0.9986, 0.9997, s) * 5.0;   // 柔化日面
        /* 地平线薄雾带：只在地平线上下一小条，且**偏冷**。
           ⚠️ 别给暖灰、也别给太大权重 —— 默认机位正好贴着地平线看，
              这一条一旦压过 mid，整片天就又被洗白了。 */
        c = mix(c, vec3(0.84, 0.89, 0.94), exp(-abs(h) * 30.0) * 0.16);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        /* 抖动必须放在**色彩空间之后**：色带出现在最终输出码值上。
           ⚠️ 自己写，不用 dithering_fragment 那个 chunk（它依赖的 dithering()
              不在通用片元前缀里，会直接编译失败 —— 见上面的说明）。
           ⚠️⚠️ 这一段在 **JS 模板字符串**里，注释里**绝对不能出现反引号**
              —— 一个反引号就把模板字符串截断，整个 app.js 直接 SyntaxError、
              页面永远停在装载遮罩上（实测：pageerror = "Unexpected identifier '#include'"）。 */
        float dth = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        gl_FragColor.rgb += (dth - 0.5) / 255.0;
      }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), mat);
  m.frustumCulled = false;
  return m;
}

/* ============================================================
 * 热点（产品安装位置）
 * ============================================================ */
export function hotspot(id, object, opts = {}) {
  return {
    id,
    /**
     * key —— 热点在**本场景内的唯一标识**。默认等于 id，但同一个元件在一个场景里
     * 可能装好几只（直流屏有 3 只 MCCB、3 只熔断器、3 只数显表），
     * 而 hotspotById 是 Map、标签的 data-id 也要唯一 —— 重名会让后一只覆盖前一只，
     * 选中时三只标签一起高亮。所以多只的场合由场景显式给 key（如 'MCCB#2'），
     * 档案仍然按 id 查（elementById）。
     */
    key: opts.key || id,
    object,
    /** 相机飞行目标 */
    focus: opts.focus || null,
    /** 标记锚点（世界坐标由 object 计算，可给局部偏移） */
    offset: opts.offset ? new THREE.Vector3(...opts.offset) : new THREE.Vector3(0, 0, 0),
    marker: opts.marker !== false,
    /**
     * quiet:true —— 该元件的标签**只在悬停 / 选中时出现**，不参与「显示全部标签」。
     *
     * 为什么需要：被柜门挡住的柜内元件（手车、接地开关、CT、电缆终端…），
     * 标签锚点在世界坐标里落在柜体内部，而标签是 HTML 浮层（不参与深度测试），
     * 于是十几个标签会**穿透柜门浮在柜体正面**糊成一片。
     * 置 quiet 后默认画面干净，鼠标扫到、或从左侧列表点进来时标签照样出现 ——
     * 点击、悬停、卡片、列表全都不受影响，信息一点没少。
     */
    quiet: opts.quiet === true,
    /**
     * 元件在**自身局部坐标系**下的包围盒（build 阶段就量好）。
     *
     * 为什么必须提前量：batchStatic 会把通用元件里的 Mesh 合并进大网格、
     * 并从原 Group 里摘掉。之后再 Box3.setFromObject 只能量到一个空壳 ——
     * 自动取景会飞掉，隐形拾取代理也建不出来。
     * 只有带 userData.gid 的通用元件才需要，产品模型保留自己的 Mesh，不用它。
     */
    box: opts.box || (object && object.userData && object.userData.gid ? localBox(object) : null),
    labelSide: opts.labelSide || 'auto',
    note: opts.note || '',
  };
}

/* ============================================================
 * 导轨安装：前脸对齐 + 盲板避让
 *
 * 这一节是为一类反复出现的「穿模 / 浮空」缺陷写的，四个户内场景都踩过。
 *
 * 根因是产品模型有**两种原点约定**（都在 product-models.js 里）：
 *   · panelMeter 系列（信号报警器 FA / 干变温控器 THC）——原点是**前脸**，本体向后延伸；
 *   · dinModule 系列（继电器 / 变送器 / 电源 YDSP 等）——原点是**几何中心**，前后各半。
 * 两者混装在同一条导轨上时，前脸会差 d/2 ≈ 40~55mm：dinModule 凸在外面、
 * panelMeter 缩在里面，看着像装错了位置。
 *
 * 而空位盲板（45×90×78mm）是第三种深度——它按几何中心直接放在了「产品前脸所在的 z」，
 * 于是同一条导轨上出现三个深度；更糟的是盲板宽 45mm 与槽距相等，**产品却比一个槽宽**
 * （FA 96mm、THC 90mm、RMY/RML 75mm、YDSP 55mm），手写「哪几个槽不补盲板」的表
 * 只会跳过产品自己那一槽，紧邻的盲板就横插进产品壳体。
 * 实测插深：kyn28 25.5mm、dcpanel 25.5/15mm、assembly 25.5mm、rmu 25.5mm。
 *
 * 统一成「前脸对齐 + 按实际包围盒剔除冲突盲板」之后，导轨行才是一条齐平的模块带。
 * ============================================================ */

/**
 * 取对象在**自身坐标系**下的包围盒。
 *
 * 刻意不走 `Box3.setFromObject()`：那个用的是 matrixWorld，一旦对象已经挂进
 * 带位移的父链（柜体子组、装配工位门板组）就会把父链的位移算进来。
 * 这里只累积自身与子节点的本地矩阵，因此「挂没挂进场景」都成立。
 */
export function selfBox(obj) {
  const box = new THREE.Box3();
  const walk = (o, m) => {
    /* ⚠️ 跳过柜门轴子树（userData.door）。
       门扇在 build 阶段是**开着**的，把它算进包围盒会让「热点代理盒」向前鼓出一大块
       （代理盒是不可见的、但射线照样能打中）。表现就是：门一关上，射线先命中那个
       代理盒，点门扇变成「选中整个柜体」—— gis / pv 的 LCP、wind 的 PREFAB 都踩过。
       门是附件，本来也不该参与本体尺寸。 */
    if (o !== obj && o.userData && o.userData.door) return;
    o.updateMatrix();
    const mm = new THREE.Matrix4().multiplyMatrices(m, o.matrix);
    if (o.isMesh && o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      box.union(o.geometry.boundingBox.clone().applyMatrix4(mm));
    }
    for (const c of o.children) walk(c, mm);
  };
  walk(obj, new THREE.Matrix4());
  return box;
}

/**
 * 取对象在**自身局部坐标系**下的包围盒（剔掉对象自己的 position / rotation）。
 *
 * 与 selfBox 的区别：selfBox 会把对象自身的矩阵也算进去，返回值落在**父级坐标系**下
 * —— 那是给 placeOnRail 算摆放位置用的；localBox 再乘一次自身矩阵的逆，
 * 于是结果与「对象挂在哪、朝向如何」都无关，可以在 build 阶段先量下来，
 * 等 batchStatic 把里面的 Mesh 合并走之后继续用。
 */
export function localBox(obj) {
  obj.updateMatrix();
  const box = selfBox(obj);
  box.applyMatrix4(new THREE.Matrix4().copy(obj.matrix).invert());
  return box;
}

/**
 * 把产品摆到导轨上，统一按「背面贴导轨前面」定位。
 *
 * 为什么对齐的是**背面**而不是前脸：
 *   · 真实 DIN 导轨器件是卡在导轨上的，背面就落在导轨前表面；深度不同的器件
 *     （继电器 75mm、变送器 95mm、电源 110mm）前脸本来就不齐，侧看有层次才真实；
 *   · 更关键的是，若改成「前脸对齐」并把前脸平面定在导轨 z 附近，导轨就会跑到
 *     器件前脸**前面**去，从正面看是一条横杠压在所有器件脸上——比原问题更糟。
 *   对齐背面后，导轨永远被器件挡住，只在模块之间的缝隙里露出来，怎么摆都不会穿。
 *
 * 同时这也消掉了原点约定的不一致：panelMeter 的原点在前脸、dinModule 的在几何中心，
 * 直接设 position 会让同排器件背面差 40~55mm（一半器件浮着、一半嵌进导轨里）。
 *
 * @param {THREE.Object3D} obj  刚 build 出来、尚未挂进场景（也未设 rotation）的产品模型
 * @param {{x?:number,y?:number,z?:number,zBack?:number,xBack?:number}} at
 *   · 正面朝 +Z 的常规安装位：给 x / y / zBack（导轨前表面 z）
 *   · 正面朝 +X 的侧壁安装位（ry = +π/2，挂在侧壁板上）：给 y / z / xBack
 */
export function placeOnRail(obj, at) {
  const bb = selfBox(obj);
  if (at.xBack != null) {
    // ry = +π/2 时局部 +z 映射到父级 +x，所以「背面」沿父级 x 方向对齐
    obj.position.set(at.xBack - bb.min.z, at.y, at.z || 0);
  } else {
    obj.position.set(at.x, at.y, at.zBack - bb.min.z);
  }
  return obj;
}

/**
 * 剔除被产品（或卡在导轨上的通用元件）压住的导轨盲板。
 *
 * 必须在**产品与导轨元件全部挂完之后**调用，且调用容器要同时包含
 * 产品（`userData.pid`）、导轨元件（`userData.railMounted`）与盲板（`userData.blank`）。
 * 判据是「三轴重叠里最小的那一条 > tol」—— 只剔除实质相交，擦边与同轴对齐不算，
 * 避免把本该留着的邻位盲板误删。
 *
 * @param {THREE.Object3D} container
 * @param {number} tol 最小穿透深度（m），默认 3mm
 * @returns {number} 被剔除的盲板数量
 */
export function cullRailBlanks(container, tol = 0.003) {
  container.updateMatrixWorld(true);
  const blanks = [];
  const prods = [];
  container.traverse((o) => {
    if (o.userData && o.userData.blank) blanks.push(o);
    else if (o.userData && (o.userData.pid || o.userData.railMounted)) prods.push(o);
  });
  if (!blanks.length || !prods.length) return 0;

  const pb = prods.map((o) => new THREE.Box3().setFromObject(o));
  let n = 0;
  for (const b of blanks) {
    const bb = new THREE.Box3().setFromObject(b);
    const hit = pb.some((p) => {
      const ox = Math.min(bb.max.x, p.max.x) - Math.max(bb.min.x, p.min.x);
      const oy = Math.min(bb.max.y, p.max.y) - Math.max(bb.min.y, p.min.y);
      const oz = Math.min(bb.max.z, p.max.z) - Math.max(bb.min.z, p.min.z);
      return Math.min(ox, oy, oz) > tol;
    });
    if (hit) { b.removeFromParent(); n++; }
  }
  return n;
}

/* ============================================================
 * 通用元件的安装与登记
 *
 * 四个户内场景都要往柜里塞「本公司产品之外的元件」，所以统一放这里，
 * 避免各场景各写一份、慢慢走样。两条硬约束写在代码里：
 *   ① **不要 isolateMaterials**。产品需要独立材质实例做选中自发光，通用元件不需要；
 *      逐个克隆会让同一种材质在 14 个元件里变成 14 份不同 uuid，
 *      batchStatic 再也合不到一起 —— 实测多出约 60 个 draw call。
 *   ② 元件必须带 userData.gid（buildElement 会打），hotspot() 才会在 build 阶段
 *      把包围盒量下来；否则 batchStatic 把它合并成空壳后，取景和拾取都会失效。
 * ============================================================ */

/**
 * 生成一个通用元件、摆到位、注册热点。
 * @param {THREE.Object3D} parent  挂到哪个组（通常是柜内安装板组，跟随爆炸视图）
 * @param {Array} hotspots         场景的 hotspots 数组
 * @param {string} gid             元件 id（见 data.js 的 GENERIC）
 * @param {object} opt
 *   · x / y / rx / ry / rz       直接定位
 *   · zBack                      按「元件背面贴这条线」自动算 z（推荐，等价于产品的 placeOnRail）
 *   · z                          直接给 z（与 zBack 二选一）
 *   · build / note / quiet / off / parent
 */
export function mountElement(parent, hotspots, gid, opt = {}) {
  const g = buildElement(gid, opt.build || {});
  const sz = g.userData.size || [0.08, 0.08, 0.08];
  let z = 0;
  if (opt.z != null) z = opt.z;
  else if (opt.zBack != null) z = opt.zBack + sz[2] / 2;   // 原点在几何中心
  g.position.set(opt.x || 0, opt.y != null ? opt.y : 1.9, z);
  if (opt.rx) g.rotation.x = opt.rx;
  if (opt.ry) g.rotation.y = opt.ry;
  if (opt.rz) g.rotation.z = opt.rz;
  (opt.parent || parent).add(g);
  /* railMounted：这只元件是**卡在导轨上**的（走 zBack / xBack 定位），
     所以导轨盲板必须像避让产品一样避让它 —— 否则 45mm 宽的盲板会横插进壳体
     （实测 dcpanel 的 MCCB / PSU_G 各被插 45mm，clip_test 报得出来）。 */
  if (opt.zBack != null || opt.xBack != null) g.userData.railMounted = true;
  hotspots.push(hotspot(gid, g, {
    key: opt.key,
    offset: opt.off || [0, sz[1] * 0.55, 0.02],
    note: opt.note || '',
    quiet: opt.quiet === true,
    /* marker:false —— 只登记热点、不生成发光小球。
       用于**远景阵列 / 远景设备**（光伏方阵、几百米外的风机）：
       小球在屏幕上只有 1~2px，既看不清又白白多一次 sprite 绘制，
       而热点本身照旧可点（走隐形包围盒拾取代理那条路）。
       ⚠️ 必须在这里透传：hotspot() 早支持这个选项，但包装函数漏传过一次，
       场景里写了 marker:false 却完全没生效，而且不会报任何错。 */
    marker: opt.marker !== false,
  }));
  return g;
}

/**
 * 把一个**已经建好**的静态零件登记成通用元件热点。
 *
 * 场景里本来就有端子排 / 走线槽 / 线束这些零件，再建一份纯属浪费 draw call。
 * 但它们的 Group 会被 batchStatic 合并成空壳，所以必须先给它挂上 gid ——
 * hotspot() 才会在 build 阶段把包围盒量下来，后续补隐形拾取代理。
 */
export function regElement(hotspots, gid, obj, opt = {}) {
  obj.userData.gid = gid;
  hotspots.push(hotspot(gid, obj, {
    key: opt.key,
    offset: opt.off || [0, 0.03, 0.02],
    note: opt.note || '',
    quiet: opt.quiet === true,
    marker: opt.marker !== false,   // 同上：远景 / 纯结构件可关掉发光小球
  }));
  return obj;
}

/* ============================================================
 * 地面辅助：网格 / 阴影承接
 * ============================================================ */
export function groundGrid(size = 40, div = 40, color = 0x2b382f, opacity = 0.25) {
  const g = new THREE.GridHelper(size, div, color, color);
  g.material.transparent = true;
  g.material.opacity = opacity;
  g.material.depthWrite = false;
  return g;
}

/* ============================================================
 * 圆点标记贴图（发光小圆）
 * ============================================================ */
export const markerTex = canvasTex(128, 128, (g, w, h) => {
  const r = w / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0.00, 'rgba(255,255,255,1)');
  grad.addColorStop(0.28, 'rgba(255,255,255,.85)');
  grad.addColorStop(0.55, 'rgba(255,255,255,.22)');
  grad.addColorStop(1.00, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
});

/* ============================================================
 * 环形指示贴图（高亮光环）
 * ============================================================ */
export const ringTex = canvasTex(256, 256, (g, w, h) => {
  const r = w / 2;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.95)';
  g.lineWidth = 9;
  g.beginPath(); g.arc(r, r, r - 14, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.28)';
  g.lineWidth = 3;
  g.beginPath(); g.arc(r, r, r - 30, 0, Math.PI * 2); g.stroke();
});

/* 标记点与光环贴图是全局单例，别被场景卸载误释放 */
markerTex.userData.shared = true;
ringTex.userData.shared = true;

/* ============================================================
 * 户外远景：电杆 / 导线 / 灌木 / 树线
 * 户外场景特写时如果背景只有一片蓝天，会非常“假”；
 * 这些低成本的远景物件是提升真实感最划算的手段。
 * ============================================================ */

/** 混凝土电杆（原点在杆底） */
export function utilityPole(h = 8.6, opt = {}) {
  const { arms = 2, mat = M.concrete } = opt;
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.17, h, 14), mat);
  pole.position.y = h / 2;
  pole.castShadow = true; pole.receiveShadow = true;
  g.add(pole);
  const armMat = M.steelBrushed;
  for (let i = 0; i < arms; i++) {
    const y = h * (0.88 - i * 0.09);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5 - i * 0.35, 0.075, 0.075), armMat);
    arm.position.y = y; arm.castShadow = true;
    g.add(arm);
    const n = 3;
    for (let k = 0; k < n; k++) {
      const x = (-0.5 + k * 0.5) * (1 - i * 0.24);
      const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.14, 10), M.pcBeige);
      ins.position.set(x, y + 0.11, 0);
      ins.castShadow = true;
      g.add(ins);
    }
  }
  return g;
}

/** 两杆之间的悬垂导线 */
export function powerLine(a, b, opt = {}) {
  const { sag = 0.7, r = 0.022, mat = M.cable } = opt;
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([a, mid, b]);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, r, 6, false), mat);
  m.castShadow = false;
  return m;
}

/** 低模灌木（多面体簇，flat shading 才像植被） */
export function shrub(scale = 1, seed = 0) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x4d5c38, roughness: 0.94, metalness: 0, flatShading: true,
  });
  const n = 3 + Math.floor((Math.abs(Math.sin(seed * 12.9898)) * 3));
  for (let i = 0; i < n; i++) {
    const s = (0.30 + Math.abs(Math.sin(seed * 7.13 + i * 2.1)) * 0.30) * scale;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), mat);
    b.position.set(
      (Math.sin(seed * 3.7 + i * 1.9)) * 0.26 * scale,
      s * 0.72,
      (Math.cos(seed * 5.1 + i * 2.7)) * 0.26 * scale
    );
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  }
  return g;
}

/** 远处树线（一圈深绿锥体，把地平线的硬边“化开”） */
export function treeline(radius = 42, count = 54, opt = {}) {
  const { minH = 2.4, maxH = 6.4, seed = 1 } = opt;
  const g = new THREE.Group();
  /* 远处树线只做剪影。原来用 7 边锥体，远看像一排圣诞树，很廉价；
     改成「几团错位低面数多面体」拼树冠，轮廓自然得多。
     ⚠️ 第 66 轮：树冠从 `IcosahedronGeometry(1, 0)`（20 面）提到 **(1, 1)**（80 面）。
        把 `rmu.png` 的树线裁出来放大看，20 面的棱面在屏幕上是**一块块明显的三角形**，
        读起来很廉价；80 面之后轮廓圆润，又保住了低多边形的风格。
        代价：树线三角面 ×4（实测 pv 植被 362 个 ⇒ 约 +2.2 万面，总面数 9.3 万 → 11.5 万），
        但 **draw call 不变** —— 同一材质仍被 `batchStatic` 压成 1 个 call。
     ⚠️ 叶色分 3 档：单色树线看着像塑料。3 档只多 2 个 draw call，
        余量充足（实测最大是 kyn28 271/300，而它是室内、根本没有树；
        有树的四个场景是 pv 213 / wind 219 / ess 176 / rmu 162）。
     ⚠️⚠️ 几何类型**必须保持 `IcosahedronGeometry`** ——
        `veg_ground_probe` 与 `veg_neg_ctl` 就是按
        `geometry.type === 'IcosahedronGeometry'` 找植被的（改类型会让它们空过）。 */
  const LEAF = [0x33432a, 0x3c4c32, 0x46573a];
  const leaves = LEAF.map((c) => new THREE.MeshStandardMaterial({
    color: c, roughness: 0.96, metalness: 0, flatShading: true,
  }));
  const trunk = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.95 });
  const crownGeo = new THREE.IcosahedronGeometry(1, 1);

  for (let i = 0; i < count; i++) {
    const r1 = Math.sin(seed * 9.1 + i * 1.7);
    const r2 = Math.sin(seed * 4.4 + i * 3.1);
    const a = (i / count) * Math.PI * 2 + r1 * 0.06;
    const rr = radius * (0.82 + Math.abs(r2) * 0.36);
    const h = minH + Math.abs(Math.sin(seed * 2.3 + i * 3.1)) * (maxH - minH);

    const t = new THREE.Group();
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.115, h * 0.30, 5), trunk);
    tr.position.y = h * 0.15;
    t.add(tr);

    [[0, h * 0.52, 0, h * 0.30],
     [h * 0.10, h * 0.74, h * 0.05, h * 0.23],
     [-h * 0.09, h * 0.65, -h * 0.06, h * 0.21]].forEach(([bx, by, bz, s], k) => {
      /* 3 个树冠轮流用 3 档叶色，再按树序 i 整体错开 ⇒ 每棵树的配色都不一样 */
      const c = new THREE.Mesh(crownGeo, leaves[(i + k) % leaves.length]);
      c.position.set(bx, by, bz);
      c.scale.set(s, s * (0.80 + Math.abs(r1) * 0.34), s);
      c.rotation.set(r1 * 1.4, r2 * 2.2, 0);
      t.add(c);
    });

    t.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    g.add(t);
  }
  return g;
}
