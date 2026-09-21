/**
 * viewer.js —— 右侧产品详情视口：单个产品的可旋转 3D 模型
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { buildShowcaseModel } from './product-models.js';
import { isolateMaterials } from './mats.js';
import { batchStatic } from './optimize.js';
/* ⚠️ 跨模块符号必须同改 import —— 只写调用不写 import，`node --check` 查不出来、
   页面 `pageerror` 也是 0，表现是「一直转圈」（§V）。 */
import { canvasTex } from './util.js';

/* 柔和投影贴图：白心 → 黑边。**模块级单例** —— 它挂在常驻 scene 上、不随产品切换销毁，
   每次切产品重建会一路漏显存（`residue_sweep` 会抓）。 */
let _blobTex = null;
function shadowBlobTex() {
  if (_blobTex) return _blobTex;
  _blobTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0.00, 'rgb(255,255,255)');
    gr.addColorStop(0.42, 'rgb(186,186,186)');
    gr.addColorStop(0.72, 'rgb(74,74,74)');
    gr.addColorStop(1.00, 'rgb(0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }, { data: true });
  _blobTex.userData.shared = true;   // 单例：不要被 disposeTree 释放
  return _blobTex;
}

export class ProductViewer {
  constructor(canvas, envMap) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.environment = envMap;

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 20);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 0.06;
    this.controls.maxDistance = 1.2;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.1;
    this.controls.target.set(0, 0, 0);

    // 三点光
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(0.6, 1.1, 0.9);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xcfe2f5, 0.9);
    fill.position.set(-0.9, 0.35, 0.6);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x9fe8c6, 1.1);
    rim.position.set(-0.3, 0.5, -1.0);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight(0x8fa4b0, 0.35));

    /* 底部柔和阴影盘。
       ⚠️ 原来是一张**纯色圆**：`opacity` 全盘 0.22、边缘一刀切 —— 产品底下像垫了个黑盘子，
          正是「简陋」的来源之一。改成径向渐变 `alphaMap`：中心实、外圈渐隐，才像投影。
       ⚠️ alphaMap 取的是**纹理的绿色通道**（忽略 alpha 通道），所以渐变必须落在 **RGB 上**，
          写成 `rgba(255,255,255,0.3)` 那种「颜色不变、只降 alpha」的写法**完全没用**
          —— 上传后绿通道处处是 255，等于没有渐变。这里用白→黑。 */
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 48),
      new THREE.MeshBasicMaterial({
        color: 0x000000, transparent: true, opacity: 0.34,
        alphaMap: shadowBlobTex(), depthWrite: false,
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);

    this.current = null;
    this.visible = true;
    this._raf = null;
  }

  setEnvMap(env) { this.scene.environment = env; }

  /** 画质档位联动：右侧小视口没必要跟主视口一样高的采样率 */
  setQuality(dpr) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dpr));
    this._w = -1; this._h = -1;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    if (this._w === w && this._h === h) return;
    this._w = w; this._h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  show(id) {
    if (this.current) {
      this.scene.remove(this.current);
      disposeTree(this.current);
      this.current = null;
    }
    if (!id) return;
    const m = buildShowcaseModel(id);
    isolateMaterials(m);
    batchStatic(m);          // 单个产品也能从 ~38 个 draw call 压到 ~7 个
    this.scene.add(m);
    this.current = m;

    const r = Math.max(0.03, m.userData.radius || 0.05);
    const dist = r / Math.tan((this.camera.fov * Math.PI / 180) / 2) * 1.45;
    this.camera.position.set(dist * 0.62, dist * 0.52, dist * 0.72);
    this.camera.near = dist * 0.05;
    this.camera.far = dist * 12;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = r * 0.9;
    this.controls.maxDistance = r * 9;
    this.controls.update();

    this.shadow.scale.setScalar(r * 3.2);
    this.shadow.position.y = -(m.userData.size ? m.userData.size[1] / 2 : r) - r * 0.06;

    this.controls.autoRotate = true;
  }

  start() {
    if (this._raf) return;
    let n = 0;
    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      // 页面切到后台 / 侧栏收起时彻底停掉，别白烧 GPU
      if (!this.visible || document.hidden) return;
      this.controls.update();
      // 半速渲染：小视口里的产品模型 30fps 完全够看，GPU 开销直接砍一半
      if (++n % 2) return;
      this.resize();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  stop() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; } }
  setVisible(v) { this.visible = v; }
}

const TEX_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'emissiveMap', 'aoMap', 'bumpMap', 'specularMap', 'displacementMap'];

/** 同 app.js：共享单例不释放，产品自己的贴图必须释放（否则切产品会一直漏显存） */
function disposeTree(root) {
  const texes = new Set();
  root.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (!o.material) return;
    const arr = Array.isArray(o.material) ? o.material : [o.material];
    arr.forEach(m => {
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

export { disposeTree };
