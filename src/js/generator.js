/* 攀登 · 出题引擎
   ============================================================
   目标：不是「把固定题的选项打乱」，而是**每道题都按当次随机参数现造**。
   全离线，不调任何接口。

   设计：把「怎么问」和「问什么」拆开。
     · 怎么问 → KINDS 里的 6 台「出题机」（通用，所有关卡共用）
     · 问什么 → 每关自己的素材池（pools）
   这样新增一关只需要写素材，不用写逻辑；而同样的素材能被 6 种问法反复利用，
   组合数天然膨胀。

   素材池形状：
     pools.groups     { 分类键: { label, items:[{t,why}] } }   → oddOne / classify
     pools.claims     [{ s, ok, why }]                          → flaw
     pools.processes  [{ name, steps:[], explain }]             → order
     pools.terms      [{ q, a:[], why }]                        → fill
     pools.manual     [ 手写题 ]                                 → manual
   ============================================================ */

export function shuffleArr(a, rnd = Math.random) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
const sample = (a, n, rnd) => shuffleArr(a, rnd).slice(0, n);

/* ============================================================
   出题机
   ============================================================ */

/* 找不同：A 类取 1 条 + B 类取 3 条，问「哪个属于 A」 */
function oddOne(ctx) {
  const groups = ctx.pools.groups;
  if (!groups) return null;
  const keys = Object.keys(groups).filter(k => (groups[k].items || []).length >= 3);
  if (keys.length < 2) return null;

  const target = pick(keys, ctx.rnd);
  const others = keys.filter(k => k !== target);
  const right = pick(groups[target].items, ctx.rnd);

  const wrongs = [];
  for (const k of others) {
    for (const it of sample(groups[k].items, 3, ctx.rnd)) {
      if (wrongs.length < 3) wrongs.push({ it, k });
    }
  }
  if (wrongs.length < 3) return null;

  return {
    type: 'single',
    stem: `下面四件事，哪一件属于「${groups[target].label}」？`,
    options: [right.t, ...wrongs.map(w => w.it.t)],
    answer: 0,
    explain: `「${right.t}」——${right.why}。`
      + `另外三件都属于「${others.map(k => groups[k].label).join(' / ')}」。`
  };
}

/* 归类：给一条素材，问它属于哪一类 */
function classify(ctx) {
  const groups = ctx.pools.groups;
  if (!groups) return null;
  const keys = Object.keys(groups).filter(k => (groups[k].items || []).length > 0);
  if (keys.length < 2) return null;

  const k = pick(keys, ctx.rnd);
  const item = pick(groups[k].items, ctx.rnd);
  const opts = shuffleArr(keys, ctx.rnd);

  return {
    type: 'single',
    stem: `「${item.t}」属于哪一类？`,
    options: opts.map(x => groups[x].label),
    answer: opts.indexOf(k),
    explain: `${item.why}。所以它属于「${groups[k].label}」。`
  };
}

/* 挑错：3 条正确说法 + 1 条错误说法，问哪句是错的 */
function flaw(ctx) {
  const claims = ctx.pools.claims;
  if (!claims) return null;
  const bad = claims.filter(c => !c.ok);
  const good = claims.filter(c => c.ok);
  if (!bad.length || good.length < 3) return null;

  const b = pick(bad, ctx.rnd);
  const gs = sample(good, 3, ctx.rnd);
  const opts = [{ ...b, isBad: true }, ...gs.map(g => ({ ...g, isBad: false }))];

  return {
    type: 'single',
    stem: '下面四句话，哪一句是错的？',
    options: opts.map(o => o.s),
    answer: 0,
    explain: `「${b.s}」是错的——${b.why}。其余三句都成立。`
  };
}

/* 排序：取一条流程，打乱步骤 */
function order(ctx) {
  const ps = ctx.pools.processes;
  if (!ps || !ps.length) return null;
  const p = pick(ps, ctx.rnd);
  if (!p.steps || p.steps.length < 3) return null;
  return {
    type: 'order',
    stem: `把「${p.name}」的步骤排成正确顺序。`,
    items: p.steps.slice(),
    explain: p.explain
  };
}

/* 填空：取一条挖空句 */
function fill(ctx) {
  const ts = ctx.pools.terms;
  if (!ts || !ts.length) return null;
  const t = pick(ts, ctx.rnd);
  return {
    type: 'fill',
    stem: t.q,
    answers: t.a,
    explain: t.why
  };
}

/* 手写题：从精选池里取一道（用于不适合生成的好题） */
function manual(ctx) {
  const ms = ctx.pools.manual;
  if (!ms || !ms.length) return null;
  return { ...pick(ms, ctx.rnd) };
}

const KINDS = { oddOne, classify, flaw, order, fill, manual };
export const KIND_NAMES = Object.keys(KINDS);

/* 统一在这里打乱并重算答案下标 —— 各出题机只管按固定顺序拼内容 */
function shuffleOptions(q, rnd) {
  /* 排序题：用 items（正确顺序）打乱成 options，并算出「显示下标 → 正确位次」 */
  if (q.type === 'order') {
    const perm = shuffleArr(q.items.map((_, i) => i), rnd);   // perm[显示位] = 原正确位次
    const options = perm.map(i => q.items[i]);
    const answer = perm
      .map((origI, dispI) => ({ origI, dispI }))
      .sort((a, b) => a.origI - b.origI)
      .map(x => x.dispI);
    return { ...q, options, answer };
  }

  if (q.type !== 'single' && q.type !== 'multi') return q;

  const perm = shuffleArr(q.options.map((_, i) => i), rnd);
  const options = perm.map(i => q.options[i]);
  const oldToNew = {};
  perm.forEach((oldI, newI) => { oldToNew[oldI] = newI; });
  const answer = q.type === 'single'
    ? oldToNew[q.answer]
    : q.answer.map(i => oldToNew[i]).sort((a, b) => a - b);
  return { ...q, options, answer };
}

const signature = (q) =>
  q.type + '|' + q.stem + '|' + (q.options || q.items || []).join('~');

function instantiate(kind, ctx, seen) {
  for (let i = 0; i < 14; i++) {
    const q = KINDS[kind](ctx);
    if (!q) return null;
    const sig = signature(q);
    if (!seen.has(sig)) { seen.add(sig); return q; }
  }
  return null;
}

/* ============================================================
   组装一轮题目
   bank: { plan: ['oddOne','classify',...], pools: {...} }
   ============================================================ */
export function buildQuiz(level, { rnd = Math.random, size } = {}) {
  const bank = level && level.bank;
  if (!bank || !bank.pools) return { size: 0, questions: [] };

  const ctx = { pools: bank.pools, rnd, pick, sample, shuffle: shuffleArr };
  const plan = (bank.plan || ['oddOne', 'classify', 'flaw', 'order', 'fill']).slice();
  if (size && size < plan.length) plan.length = size;

  const seen = new Set();
  const out = [];

  for (const kind of plan) {
    const q = instantiate(kind, ctx, seen);
    if (q) out.push({ ...shuffleOptions(q, rnd), _kind: kind });
  }

  /* 兜底：某台出题机素材不足时，用别的出题机补位，保证题量 */
  let guard = 0;
  while (out.length < plan.length && guard++ < 30) {
    const kind = pick(Object.keys(KINDS), rnd);
    const q = instantiate(kind, ctx, seen);
    if (q) out.push({ ...shuffleOptions(q, rnd), _kind: kind });
  }

  return { size: out.length, questions: shuffleArr(out, rnd) };
}

/* 供测试/调优用：连续生成 N 轮，返回每轮的题目指纹 */
export function sampleQuizzes(level, times = 20) {
  const seen = new Set();
  const list = [];
  for (let i = 0; i < times; i++) {
    const q = buildQuiz(level);
    const sig = q.questions.map(signature).join(' // ');
    seen.add(sig);
    list.push(sig);
  }
  return { distinct: seen.size, times, list };
}
