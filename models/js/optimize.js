/**
 * optimize.js —— 静态几何批处理
 *
 * 为什么需要它：
 *   场景里大量零件（钣金条、导轨、线槽、端子、螺栓、灯具、地面线条…）都是独立 Mesh，
 *   一个 KYN28 二次室就有 1100+ 个 draw call。核显（Intel UHD / Vega）最怕的从来不是
 *   三角形数量，而是 draw call 数量——每多一次 draw call 就多一次 CPU→GPU 状态提交，
 *   低配办公机上直接表现为「卡」。
 *
 * 做法（两级作用域）：
 *   1. 对每个「爆炸组」（userData.explode 的 Group）单独跑一次批处理 —— 组内零件合并成
 *      几个大 Mesh，但整组依然可以被平移，爆炸视图照常工作。
 *   2. 剩下的静态零件在场景根上再跑一次。
 *
 * 绝对不能合并的对象：
 *   产品模型子树（userData.pid）—— 需要独立材质做高亮、需要被射线拾取、需要爆炸位移。
 *   透明 / 半透明材质 —— 合并会打乱渲染排序，宁可不合。
 */
import * as THREE from 'three';

const KEEP = ['position', 'normal', 'uv'];
/* 批处理边界：这几种对象各自成域，域内合并、域之间不合并。
 *   explode      —— 爆炸视图要整组平移
 *   keepSeparate —— 其它需要独立变换的对象
 *   door         —— 柜门轴（绕 Y 开合，见 app.js 的 collectMovers）
 *   slide        —— 推拉件（手车 / 抽屉，沿直线移动）
 *   scenery      —— 远景 / 场坪（见 app.js 的 fitAll）
 * ⚠️ 可动件必须走这条 —— 否则几何会被合并并烘进世界坐标，之后 rotation / position 改了也看不出。
 * ⚠️ scenery 也必须走这条，但原因不同：它不需要独立变换，**需要保留「身份」**。
 *    `batchScope` 会把合并出来的大网格挂到 **scope（这里是场景根）** 上，
 *    原网格从各自的父节点摘掉 —— 于是 `far` / `site` 这些组会变成空壳，
 *    挂在组上的 `userData.scenery` 就跟着丢了，「全景」又去框树线和草地环。
 *    实测：不设边界时 rmu 的取景盒仍是 104m×94m（该只有 2m 上下）。 */
const BOUNDARY = (o) => !!(o.userData
  && (o.userData.explode || o.userData.keepSeparate || o.userData.door
    || o.userData.slide || o.userData.scenery));

/** 把单个几何体转成「可安全拼接」的形态：统一属性集 + 烘进目标坐标系 */
function bake(geo, matrix) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone();

  // 只保留 position / normal / uv：属性集不一致会导致拼接错位
  for (const name of Object.keys(g.attributes)) {
    if (!KEEP.includes(name)) g.deleteAttribute(name);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv || g.attributes.uv.itemSize !== 2) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  }
  g.applyMatrix4(matrix);
  return g;
}

/** 把若干几何体拼成一个（三属性直拼，不做顶点去重，够快够稳） */
function concat(geos) {
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let off = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    nor.set(g.attributes.normal.array, off * 3);
    uv.set(g.attributes.uv.array, off * 2);
    off += n;
    g.dispose();
  }

  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function countMeshes(root) {
  let n = 0;
  root.traverse(o => { if (o.isMesh) n++; });
  return n;
}

/** 统计各类「不能合并」的网格数量，便于排查批处理效果 */
function diagnose(root) {
  const d = { total: 0, product: 0, explode: 0, transparent: 0, instanced: 0, sprite: 0, mergeable: 0 };
  const inProduct = (o) => {
    let p = o;
    while (p) { if (p.userData && p.userData.pid) return true; p = p.parent; }
    return false;
  };
  const inExplode = (o) => {
    let p = o.parent;
    while (p) {
      if (p.userData && (p.userData.explode || p.userData.keepSeparate
        || p.userData.door || p.userData.slide || p.userData.scenery)) return true;
      p = p.parent;
    }
    return false;
  };
  root.traverse(o => {
    if (o.isSprite) { d.sprite++; return; }
    if (!o.isMesh) return;
    d.total++;
    if (o.isInstancedMesh) { d.instanced++; return; }
    if (inProduct(o)) { d.product++; return; }
    const m = o.material;
    if (!m || Array.isArray(m)) return;
    if (m.transparent || m.opacity < 1 || m.depthWrite === false) { d.transparent++; return; }
    if (inExplode(o)) d.explode++;
    else d.mergeable++;
  });
  return d;
}

/** 在 scope 作用域内合并「本层直接拥有」的 Mesh（跳过嵌套边界与产品子树） */
function batchScope(scope, opt, stat) {
  const { minBatch, maxVerts } = opt;
  const buckets = new Map();
  const invScope = new THREE.Matrix4().copy(scope.matrixWorld).invert();
  const visit = (o) => {
    for (const c of o.children) {
      if (c.userData && c.userData.pid) continue;             // 产品模型：绝对不动
      if (BOUNDARY(c)) continue;                              // 嵌套爆炸组：由它自己那轮处理
      if (c.isMesh && !c.isInstancedMesh && !c.isSprite) {
        if (!c.visible) continue;
        const m = c.material;
        if (!m || Array.isArray(m)) continue;
        if (m.transparent || m.opacity < 1 || m.depthWrite === false) continue;
        if (m.transmission && m.transmission > 0) continue;
        if (!c.geometry || !c.geometry.attributes || !c.geometry.attributes.position) continue;

        const key = `${m.uuid}|${c.castShadow ? 1 : 0}|${c.receiveShadow ? 1 : 0}|${c.renderOrder || 0}`;
        let b = buckets.get(key);
        if (!b) {
          b = { mat: m, cast: !!c.castShadow, recv: !!c.receiveShadow, order: c.renderOrder || 0, geos: [], meshes: [] };
          buckets.set(key, b);
        }
        b.geos.push(bake(c.geometry, new THREE.Matrix4().multiplyMatrices(invScope, c.matrixWorld)));
        b.meshes.push(c);
      } else if (!c.isMesh) {
        visit(c);
      }
    }
  };
  visit(scope);

  for (const b of buckets.values()) {
    if (b.meshes.length < minBatch) { b.geos.forEach(g => g.dispose()); continue; }
    let verts = 0;
    for (const g of b.geos) verts += g.attributes.position.count;
    if (verts > maxVerts) { b.geos.forEach(g => g.dispose()); continue; }

    const merged = new THREE.Mesh(concat(b.geos), b.mat);
    merged.castShadow = b.cast;
    merged.receiveShadow = b.recv;
    merged.renderOrder = b.order;
    merged.name = 'batched×' + b.meshes.length;
    merged.userData.batched = b.meshes.length;
    scope.add(merged);
    stat.groups++;

    b.meshes.forEach(m => {
      stat.origGeo.add(m.geometry);
      m.parent && m.parent.remove(m);
    });
  }
}

/**
 * 批处理入口。
 * @param {THREE.Object3D} root  场景根（需为可添加子节点的容器）
 * @param {object} opt
 * @returns {{before:number, after:number, groups:number, saved:number, diag:object}}
 */
export function batchStatic(root, opt = {}) {
  const o = { minBatch: 2, maxVerts: 1200000, ...opt };
  root.updateMatrixWorld(true);
  const diag = diagnose(root);
  const before = diag.total;

  const stat = { groups: 0, origGeo: new Set() };

  // 1) 收集所有「作用域根」：爆炸组 + 产品模型。
  //    按深度从深到浅处理 —— 内层先合并，外层再遍历时就看不到它们了。
  const bounds = [];
  root.traverse(n => {
    if (n === root) return;
    if (BOUNDARY(n) || (n.userData && n.userData.pid)) bounds.push(n);
  });
  const depthOf = (n) => { let d = 0, p = n.parent; while (p && p !== root) { d++; p = p.parent; } return d; };
  bounds.sort((a, b) => depthOf(b) - depthOf(a));

  bounds.forEach(b => { b.updateMatrixWorld(true); batchScope(b, o, stat); });

  // 2) 根作用域
  root.updateMatrixWorld(true);
  batchScope(root, o, stat);

  // 3) 释放被合并掉的几何体（仍被其他 Mesh 复用的不动，避免踩到共享几何）
  const stillUsed = new Set();
  root.traverse(n => { if (n.isMesh && !n.userData.batched) stillUsed.add(n.geometry); });
  for (const g of stat.origGeo) if (!stillUsed.has(g)) g.dispose();

  const after = countMeshes(root);
  return { before, after, groups: stat.groups, saved: before - after, diag };
}
