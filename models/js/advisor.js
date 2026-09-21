/**
 * advisor.js —— 「需求 → 推荐产品」选型助手
 *
 * 三个问题定位需求，按 place / equip / need 三维标签打分，
 * 命中后直接跳到该产品的典型场景并高亮安装位。
 */

export const QUESTIONS = [
  {
    key: 'place',
    q: '这套设备装在哪里？',
    hint: '户内与户外决定防护、防凝露与温控配置',
    options: [
      { v: 'in', label: '户内', desc: '配电室 / 控制室 / 厂房内' },
      { v: 'out', label: '户外', desc: '箱变 / 环网柜 / 户外端子箱' },
      { v: 'any', label: '都可能有', desc: '不确定，按功能选' },
    ],
  },
  {
    key: 'equip',
    q: '装在什么设备里？',
    hint: '决定安装方式与配套关系',
    options: [
      { v: 'switchgear', label: '开关柜二次室', desc: 'KYN28 等中置柜继电器室' },
      { v: 'dcpanel', label: '直流屏 / 保护屏', desc: 'GZDW 直流电源、控制屏' },
      { v: 'boxrmu', label: '箱变 / 环网柜', desc: '户外预装式变电站、RMU' },
      { v: 'assembly', label: '成套厂装配 / 计量柜', desc: '仪表门板、二次接线' },
      { v: 'transformer', label: '主变 / 干变本体', desc: '绕组测温、挡位、风机' },
    ],
  },
  {
    key: 'need',
    q: '主要想解决什么问题？',
    hint: '选最主要的一项即可',
    options: [
      { v: 'protect', label: '防跳与位置监视', desc: '断路器/刀闸控制与位置判断' },
      { v: 'monitor', label: '电压电流监视', desc: '过欠压、过流、同期检查' },
      { v: 'temp', label: '温度测量上传', desc: 'PT100/热电偶 → 4-20mA/RS485' },
      { v: 'control', label: '温度控制与防凝露', desc: '就地启停加热器/风机' },
      { v: 'power', label: '电源与冗余', desc: '柜内直流供电、双电源切换' },
      { v: 'signal', label: '信号隔离与变送', desc: '制式转换、隔离、安全栅' },
      { v: 'alarm', label: '信号报警', desc: '光字牌驱动、事故总信号' },
    ],
  },
];

/** 产品 → 三维标签。place: in/out/any；equip/need 见 QUESTIONS */
export const TAGS = {
  'RC': { place: ['in', 'out'], equip: ['switchgear', 'dcpanel', 'assembly'], need: ['protect'] },
  'RAI': { place: ['in', 'out'], equip: ['switchgear', 'assembly'], need: ['protect'] },
  'RDP': { place: ['in', 'out'], equip: ['switchgear', 'boxrmu'], need: ['protect'] },
  'RMY': { place: ['in'], equip: ['dcpanel', 'switchgear'], need: ['monitor'] },
  'RMY-T': { place: ['in'], equip: ['dcpanel', 'switchgear'], need: ['monitor'] },
  'RML': { place: ['in'], equip: ['dcpanel', 'switchgear'], need: ['monitor'] },
  'RL-TBJ': { place: ['in'], equip: ['switchgear'], need: ['protect'] },
  'RL-THW': { place: ['in'], equip: ['switchgear'], need: ['protect'] },
  'RN-FB': { place: ['out'], equip: ['switchgear'], need: ['protect'] },
  'RN-FT': { place: ['out', 'in'], equip: ['switchgear', 'boxrmu'], need: ['protect'] },
  'RN-DK': { place: ['out', 'in'], equip: ['boxrmu', 'switchgear'], need: ['protect'] },
  'RVS': { place: ['out', 'in'], equip: ['boxrmu', 'dcpanel'], need: ['power'] },
  'RT': { place: ['in'], equip: ['switchgear', 'dcpanel', 'assembly'], need: ['control'] },
  'TE': { place: ['in'], equip: ['assembly', 'dcpanel', 'switchgear'], need: ['signal', 'monitor'] },
  'TS': { place: ['out', 'in'], equip: ['boxrmu', 'transformer', 'assembly'], need: ['temp'] },
  'THS': { place: ['out', 'in'], equip: ['boxrmu', 'switchgear'], need: ['temp'] },
  'TG': { place: ['out', 'in'], equip: ['transformer'], need: ['signal'] },
  'SS': { place: ['in'], equip: ['assembly', 'dcpanel'], need: ['signal'] },
  'THC': { place: ['out', 'in'], equip: ['boxrmu', 'switchgear'], need: ['control'] },
  'DTC': { place: ['out', 'in'], equip: ['boxrmu', 'transformer'], need: ['control'] },
  'TC': { place: ['in', 'out'], equip: ['switchgear', 'boxrmu', 'assembly'], need: ['control'] },
  'TCC': { place: ['out', 'in'], equip: ['boxrmu', 'transformer'], need: ['control'] },
  'TK': { place: ['in'], equip: ['transformer'], need: ['temp'] },
  'FA': { place: ['in'], equip: ['switchgear', 'dcpanel', 'assembly'], need: ['alarm'] },
  'YDSP': { place: ['in'], equip: ['assembly', 'dcpanel', 'boxrmu'], need: ['power'] },
  'DPM': { place: ['in'], equip: ['dcpanel', 'assembly'], need: ['power'] },
  'XF': { place: ['in'], equip: ['assembly', 'dcpanel'], need: ['power'] },
};

/**
 * 按答案打分推荐。
 * 权重：need 最重（真正要解决的问题）> equip（装在哪）> place（环境）
 */
export function recommend(answers, limit = 5) {
  const out = [];
  for (const id in TAGS) {
    const t = TAGS[id];
    let score = 0, hitNeed = 0, hitEquip = 0, hitPlace = 0;
    if (answers.need && t.need.includes(answers.need)) { score += 6; hitNeed = 1; }
    if (answers.equip && t.equip.includes(answers.equip)) { score += 3; hitEquip = 1; }
    if (answers.place && answers.place !== 'any') {
      if (t.place.includes(answers.place)) { score += 2; hitPlace = 1; }
      else if (!t.place.includes('any')) score -= 1;
    }
    if (score > 0) out.push({ id, score, hitNeed, hitEquip, hitPlace });
  }
  out.sort((a, b) => b.score - a.score || b.hitNeed - a.hitNeed || b.hitEquip - a.hitEquip);
  return out.slice(0, limit);
}

/** 推荐理由（用于结果列表的一句话说明） */
export function reasonOf(r, answers) {
  const bits = [];
  const needQ = QUESTIONS.find(q => q.key === 'need');
  const eqQ = QUESTIONS.find(q => q.key === 'equip');
  const plQ = QUESTIONS.find(q => q.key === 'place');
  const label = (q, v) => (q.options.find(o => o.v === v) || {}).label || v;
  if (r.hitNeed) bits.push(label(needQ, answers.need));
  if (r.hitEquip) bits.push(label(eqQ, answers.equip));
  if (r.hitPlace && answers.place !== 'any') bits.push(label(plQ, answers.place));
  return bits.join(' · ') || '相关产品';
}

/**
 * 落选项「为什么不是它」——一句话说清它比首选差在哪。
 * 只在真缺项时给出缺项；三项全中却排后，说明是同分并列，如实说明。
 */
export function whyNot(r, answers) {
  const needQ = QUESTIONS.find(q => q.key === 'need');
  const eqQ = QUESTIONS.find(q => q.key === 'equip');
  const plQ = QUESTIONS.find(q => q.key === 'place');
  const label = (q, v) => (q.options.find(o => o.v === v) || {}).label || v;

  const miss = [];
  if (answers.need && !r.hitNeed) miss.push(`不主打「${label(needQ, answers.need)}」`);
  if (answers.equip && !r.hitEquip) miss.push(`不针对「${label(eqQ, answers.equip)}」这类安装位`);
  if (answers.place && answers.place !== 'any' && !r.hitPlace) {
    miss.push(`「${label(plQ, answers.place)}」环境非首选`);
  }
  if (!miss.length) return '三项条件全部命中，与首选同分并列，可按现场接口与价格再取舍';
  return miss.join('；');
}

/** 结果页的一键摘要（纯文本，方便直接粘进邮件/微信/报价单） */
export function summaryText(answers, picks, docUrl) {
  const label = (q, v) => (q.options.find(o => o.v === v) || {}).label || v;
  const L = [];
  L.push('【华用电气 · 选型建议】');
  L.push('需求：' + QUESTIONS.map(q => (answers[q.key] ? label(q, answers[q.key]) : null)).filter(Boolean).join(' / '));
  L.push('');
  picks.forEach((x, i) => {
    const p = x.p;
    L.push(`${i + 1}. ${p.n}（${p.m}）`);
    L.push(`   归属：${p.fam}｜定位：${p.tagline || ''}`);
    L.push(`   命中：${reasonOf(x.r, answers)}`);
  });
  L.push('');
  L.push('说明：以上为依据「安装环境 / 安装设备 / 主要诉求」三项条件的初筛结果，');
  L.push('      最终型号与参数以最新说明书为准，请与公司技术确认。');
  if (docUrl) L.push('产品档案：' + docUrl);
  return L.join('\n');
}

