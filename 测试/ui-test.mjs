/* 攀登 · CDP 端到端验收
   视口固定为荣耀 600 Pro：361 x 779 @ DPR 3.5（从真机截图反推校准）
   运行：
     node 测试/ui-test.mjs                                   # 打本地服务
     node 测试/ui-test.mjs https://corrinsh.github.io/pandeng/  # 打线上地址
*/
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

const LOCAL = 'http://127.0.0.1:8099/';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.argv[2] || LOCAL;
const IS_LIVE = BASE !== LOCAL;
/* 打线上时截图另存一份，别覆盖本地那套 */
const SHOTS = join(HERE, IS_LIVE ? 'shots-live' : 'shots');
mkdirSync(SHOTS, { recursive: true });

/* 荣耀 600 Pro 的真实参数（从 Corrin 的截图反推校准过）：
   1264x2728 物理像素，DPR = 3.5 → CSS 视口 361.1 x 779.4
   校准依据：章节分隔线实测 1127 物理像素、左起 x=70，
   只有 DPR 3.5 能同时吻合（20px gutter × 3.5 = 70）。 */
const VP = { width: 361, height: 779, dsf: 3.5 };

const PORT = 9300 + Math.floor(Math.random() * 400);
const PROFILE = join(process.env.TEMP || '.', 'climb-cdp-' + Date.now());

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const report = { viewport: VP, base: BASE, steps: [], errors: [], warnings: [], pass: 0, fail: 0 };

function ok(label, extra) {
  report.pass++;
  report.steps.push({ label, pass: true, ...(extra ? { extra } : {}) });
  console.log('  PASS  ' + label);
}
function bad(label, extra) {
  report.fail++;
  report.steps.push({ label, pass: false, ...(extra ? { extra } : {}) });
  console.log('  FAIL  ' + label + (extra ? '  ' + JSON.stringify(extra) : ''));
}

const QVIS = `(document.querySelector('.opt') || document.querySelector('.orditem') || document.querySelector('.blank')) !== null`;

async function main() {
  const browser = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--hide-scrollbars', '--mute-audio',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--window-size=520,1000',
    'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
    } catch { /* 还没起来 */ }
    await sleep(150);
  }
  if (!wsUrl) throw new Error('CDP 调试端口没起来');

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let mid = 0;
  const waiters = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiters.has(msg.id)) {
      const { resolve, reject } = waiters.get(msg.id);
      waiters.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      const line = 'EXCEPTION: ' + (d.exception?.description || d.text);
      report.errors.push(line);
      console.log('  >> ' + line.split('\n')[0]);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      const line = 'CONSOLE: ' + msg.params.args.map(a => a.value ?? a.description).join(' ');
      report.errors.push(line);
      console.log('  >> ' + line);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      const text = msg.params.entry.text || '';
      /* 本地开发服务器的瞬时连接抖动不算代码缺陷（已用 测试/serve.py 缓解） */
      if (/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_NETWORK_CHANGED|ERR_ABORTED/.test(text)) {
        report.warnings.push(text);
      } else {
        report.errors.push('LOG: ' + text);
        console.log('  >> ' + text);
      }
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++mid;
    waiters.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (waiters.has(id)) { waiters.delete(id); reject(new Error('超时: ' + method)); }
    }, 20000);
  });

  async function evaluate(expr) {
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true
    });
    if (r.exceptionDetails) {
      throw new Error('页面异常: '
        + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
        + ' <<< ' + String(expr).slice(0, 180));
    }
    return r.result.value;
  }

  async function waitFor(expr, timeout = 8000, label = expr) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await evaluate(expr)) return true; } catch { /* 还没就绪 */ }
      await sleep(120);
    }
    throw new Error('等待超时: ' + label);
  }

  async function shot(name) {
    const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    writeFileSync(join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'));
  }

  const clickBtn = (text) =>
    `([...document.querySelectorAll('.btn')].find(b => b.textContent.includes(${JSON.stringify(text)})) || {}).click()`;

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: VP.width, height: VP.height, deviceScaleFactor: VP.dsf, mobile: true
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  /* ---------- 1. 首屏 ---------- */
  let loaded = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await send('Page.navigate', { url: BASE });
    try {
      await waitFor(`document.querySelector('.world') !== null`, 12000, '选档页渲染');
      loaded = attempt;
      break;
    } catch {
      console.log('  第 ' + attempt + ' 次加载未成功，重试…');
      await sleep(1200);
    }
  }
  if (!loaded) throw new Error('页面连续 3 次加载失败');

  await evaluate(`document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true`);
  await sleep(1600);
  await shot('01-select');
  ok('选档页渲染 + 截图');
  (await evaluate(`document.querySelectorAll('.world').length`)) === 3
    ? ok('三档卡片数量 = 3') : bad('三档卡片数量');
  (await evaluate(`!document.getElementById('boot') || document.getElementById('boot').classList.contains('boot--off')`))
    ? ok('启动页已淡出') : bad('启动页未淡出');

  const verText = await evaluate(`(document.querySelector('.select__ver') || {}).textContent || ''`);
  verText ? ok('界面显示版本号：' + verText) : bad('缺少版本号标记（用户无法确认版本）');

  /* ---------- PWA 体检：manifest 必须能被解析 ----------
     真实事故：线上 manifest 的 Content-Type 曾是 application/octet-stream，
     浏览器直接拒收 → 「添加到桌面」退化成普通书签 → 打开带全套浏览器界面。 */
  const mf = await evaluate(`(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return { err: '页面没有 manifest 引用' };
    const res = await fetch(link.href, { cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    let name = null;
    try { name = (await res.json()).name; } catch (e) { return { err: 'manifest 不是合法 JSON', type }; }
    return { href: link.href, type, name };
  })()`);
  if (mf.err) bad('manifest 不可用：' + mf.err, mf);
  else {
    const okType = /application\/(manifest\+)?json|text\/json/.test(mf.type);
    okType
      ? ok('manifest MIME 合法（' + mf.type + '）')
      : bad('manifest MIME 非法，浏览器会拒收 → 安装退化', { type: mf.type });
    mf.name === '攀登' ? ok('manifest 名称正确：' + mf.name) : bad('manifest 名称异常', { name: mf.name });
    mf.href.includes('manifest.json') ? ok('manifest 路径为 .json 扩展名') : bad('manifest 仍是旧扩展名', { href: mf.href });
  }

  /* ---------- 浏览器模式逃生口 ---------- */
  const fsState = await evaluate(`(window.__CLIMB_FS || {}).standalone`);
  ok('当前渲染环境独立窗口模式：' + fsState + '（无头浏览器应为 false）');
  if (fsState === false) {
    const barText = await evaluate(`(document.querySelector('.fsbar__label') || {}).textContent || ''`);
    barText ? ok('浏览器模式下已挂全屏提示条：' + barText) : bad('浏览器模式未挂全屏提示条');
    await evaluate(`document.querySelector('.fsbar__close').click()`);
    await sleep(400);
    const gone = await evaluate(`document.querySelector('.fsbar') === null`);
    gone ? ok('提示条可关闭') : bad('提示条无法关闭');
  }

  const overflow = await evaluate(`(async () => {
    const d = document.documentElement;
    return [...document.querySelectorAll('*')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && (r.right > d.clientWidth + 2 || r.left < -2);
    }).map(el => el.className || el.tagName).slice(0, 5);
  })()`);
  overflow.length === 0 ? ok('首屏无横向越界元素') : bad('存在横向越界元素', { overflow });

  /* ---------- 3. 进入山脚 ---------- */
  await evaluate(`document.querySelectorAll('.world')[0].click()`);
  await waitFor(`document.querySelectorAll('.lvnode').length === 15`, 8000, '关卡地图 15 关');
  await sleep(700);
  await shot('02-map-foothill');
  ok('山脚地图渲染（15 关）+ 截图');
  (await evaluate(`document.documentElement.dataset.tier`)) === 'foothill'
    ? ok('皮肤已切到 foothill') : bad('皮肤切换');

  /* 横线回归：山脚档不该有任何整屏纹理 */
  const scanline = await evaluate(`(() => {
    const bg = getComputedStyle(document.querySelector('.app')).backgroundImage;
    return bg && bg !== 'none' ? bg.slice(0, 90) : '';
  })()`);
  scanline === '' ? ok('山脚档无横向纹理（横线回归通过）') : bad('仍有背景纹理', { scanline });

  /* ---------- 4. 讲解：分节与深度 ---------- */
  await evaluate(`document.querySelectorAll('.lvnode')[0].click()`);
  await waitFor(`document.querySelectorAll('.brief-block').length > 0`, 8000, '讲解页渲染');
  await sleep(1400);
  await shot('03-brief');

  const briefStats = await evaluate(`JSON.stringify({
    sections: document.querySelectorAll('.brief-block').length,
    paras: document.querySelectorAll('.brief__p').length,
    notes: document.querySelectorAll('.brief__note').length,
    hasTakeaway: !!document.querySelector('.takeaway'),
    chars: (document.querySelector('.brief') || {}).textContent ? document.querySelector('.brief').textContent.length : 0
  })`);
  const bs = JSON.parse(briefStats);
  bs.sections >= 6 ? ok(`讲解已分节（${bs.sections} 节 / ${bs.paras} 段 / ${bs.notes} 处提示 / ${bs.chars} 字）`)
    : bad('讲解分节不足', bs);
  bs.hasTakeaway ? ok('讲解含「一句话带走」') : bad('缺少要点总结');

  /* ---- 富文本回归：界面上不允许出现字面星号 ----
     真实事故：全项目 45 关写了 1900+ 处 **加粗**，渲染层却用 textContent 直出，
     星号原样显示。这条断言防止以后再犯。 */
  const strongInfo = await evaluate(`JSON.stringify({
    star: (function () {
      const t = document.body.innerText || '';
      const i = t.indexOf('**');
      return i < 0 ? null : t.slice(Math.max(0, i - 20), i + 22);
    })(),
    strong: document.querySelectorAll('.brief strong').length,
    escapeLeak: document.querySelectorAll('.brief script, .brief img').length
  })`);
  const si = JSON.parse(strongInfo);
  si.star === null
    ? ok('讲解无残留 ** 标记')
    : bad('讲解里还有没解析的 ** 标记', { context: si.star });
  si.escapeLeak === 0 ? ok('无 HTML 注入泄漏') : bad('富文本转义失败，有标签被注入', si);

  /* rich() 纯函数校验：不依赖任何一关碰巧有没有写加粗。
     注意 山脚第 1、2 关的讲解里确实没有 **，所以不能用"本关有无 <strong>"来判定函数是否生效。 */
  const richCases = JSON.parse(await evaluate(`JSON.stringify([
    window.__CLIMB.rich('前 **重点** 后'),
    window.__CLIMB.rich('**A**和**B**'),
    window.__CLIMB.rich('<b>x</b> **y**'),
    window.__CLIMB.rich('没有标记'),
    window.__CLIMB.rich(null)
  ])`));
  const richOK =
    richCases[0] === '前 <strong>重点</strong> 后' &&
    richCases[1] === '<strong>A</strong>和<strong>B</strong>' &&
    richCases[2] === '&lt;b&gt;x&lt;/b&gt; <strong>y</strong>' &&
    richCases[3] === '没有标记' &&
    richCases[4] === '';
  richOK ? ok('rich() 转换与转义全部正确') : bad('rich() 行为异常', { richCases });

  /* ---------- 5. 答题（数据驱动，覆盖全部题型） ---------- */
  await evaluate(clickBtn('开始答题'));
  await waitFor(QVIS, 8000, '第 1 题渲染');
  await sleep(500);
  await shot('04-quiz-q1');
  ok('第 1 题渲染 + 截图');

  (await evaluate(`document.querySelector('.level__foot .btn').disabled`)) === true
    ? ok('未作答时提交按钮禁用') : bad('提交按钮初始态');

  const qs = await evaluate(`(window.__CLIMB.currentQuiz ? window.__CLIMB.currentQuiz.questions : [])
    .map(q => ({ type: q.type, answer: q.answer, answers: q.answers, _kind: q._kind }))`);
  qs.length === 5 ? ok('本轮生成 5 道题') : bad('题目数量异常', { n: qs.length });

  const kindSet = [...new Set(qs.map(q => q._kind))];
  kindSet.length >= 4
    ? ok(`出题机种类多样：${kindSet.join(' / ')}`)
    : bad('出题机种类过少', { kindSet });

  const typeSet = [...new Set(qs.map(q => q.type))];
  typeSet.length >= 3
    ? ok(`题型多样：${typeSet.join(' / ')}`)
    : bad('题型过于单一', { typeSet });

  /* ---- 全档体检（三档 45 关） ---- */
  const audit = JSON.parse(await evaluate(`JSON.stringify(window.__CLIMB.verifyAll())`));
  const ready = audit.filter(a => a.ready);
  const pending = audit.filter(a => !a.ready);
  const byTier = {};
  ready.forEach(a => { byTier[a.tier] = (byTier[a.tier] || 0) + 1; });
  ok(`内容覆盖：已就绪 ${ready.length} 关 / 待撰写 ${pending.length} 关`
    + `（山脚 ${byTier.foothill || 0} · 山腰 ${byTier.midway || 0} · 山巅 ${byTier.summit || 0}）`);
  if (pending.length) ok('待撰写：' + pending.map(p => p.tier + '/' + p.no).join(','));

  const badQ = ready.filter(a => a.minQuestions < 5);
  badQ.length === 0
    ? ok(`全部 ${ready.length} 关在 30 轮抽样中都能出满 5 题`)
    : bad('有关卡素材不足，出不满 5 题', { badQ: badQ.map(x => x.tier + '/' + x.no) });

  const badS = ready.filter(a => a.sections < 5);
  badS.length === 0
    ? ok(`全部 ${ready.length} 关讲解分节 ≥5`)
    : bad('有关卡讲解分节偏少', { badS: badS.map(x => x.tier + '/' + x.no) });

  const narrow = ready.filter(a => a.kinds.length < 4);
  narrow.length === 0
    ? ok(`全部 ${ready.length} 关题型覆盖 ≥4 种`)
    : bad('有关卡题型覆盖面窄', { narrow: narrow.map(x => x.tier + '/' + x.no) });

  const thin = ready.filter(a => a.terms < 5);
  thin.length === 0
    ? ok(`全部 ${ready.length} 关填空题库 ≥5 条`)
    : bad('有关卡填空题库偏少', { thin: thin.map(x => x.tier + '/' + x.no) });

  /* ---- 出题器有效性：连续抽 20 轮，看有多少轮题目完全不同 ---- */
  const rawSample = await evaluate(`JSON.stringify(window.__CLIMB.sampleQuizzes('foothill', 1, 20))`);
  const sm = JSON.parse(rawSample);
  if (sm && sm.times === 20) {
    ok(`连续抽题 20 轮完成，其中 ${sm.distinct} 轮题目组合唯一`);
    sm.distinct >= 18
      ? ok('出题器有效性通过（≥18/20 轮完全不重样）')
      : bad('出题重复过多', { distinct: sm.distinct, sample: sm.list.slice(0, 2) });
  } else {
    bad('抽题接口异常', { rawSample: String(rawSample).slice(0, 120) });
  }

  const firstSig = await evaluate(`JSON.stringify(window.__CLIMB.currentQuiz.questions
    .map(q => q.stem + '|' + (q.options || []).join('~')))`);

  async function answerCurrent(spec) {
    return evaluate(`(async () => {
      const spec = ${JSON.stringify(spec)};
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
      if (spec.type === 'single') {
        document.querySelectorAll('.opt')[spec.answer].click();
      } else if (spec.type === 'multi') {
        spec.answer.forEach(i => document.querySelectorAll('.opt')[i].click());
      } else if (spec.type === 'fill') {
        const inp = document.querySelector('.blank');
        inp.value = spec.answers[0];
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (spec.type === 'order') {
        for (const d of spec.answer) {
          document.querySelectorAll('.orditem')[d].click();
          await wait(80);
        }
      }
      await wait(200);
      document.querySelector('.level__foot .btn').click();
      return true;
    })()`);
  }

  let firstJudged = false;
  let comboSeen = false;
  for (let i = 0; i < qs.length; i++) {
    if (i > 0) {
      await evaluate(`document.querySelector('.level__foot .btn').click()`);
      await waitFor(`${QVIS} && document.querySelector('.explain--in') === null`, 6000, '进入第 ' + (i + 1) + ' 题');
      await sleep(320);
    }

    /* 每道题都必须有真实的交互区——防"渲染成空但被当成已作答"这类 bug */
    const surface = await evaluate(`(() => {
      const q = (window.__CLIMB.currentQuiz.questions[${i}] || {});
      return {
        kind: q._kind, type: q.type,
        opt: document.querySelectorAll('.opt').length,
        ord: document.querySelectorAll('.orditem').length,
        blank: document.querySelectorAll('.blank').length
      };
    })()`);
    (surface.opt >= 2 || surface.ord >= 3 || surface.blank >= 1)
      ? ok(`第 ${i + 1} 题交互区正常（${surface.kind}/${surface.type}，选项${surface.opt} 排序${surface.ord} 填空${surface.blank}）`)
      : bad(`第 ${i + 1} 题交互区为空`, surface);
    await answerCurrent(qs[i]);
    await waitFor(`document.querySelector('.explain--in') !== null`, 6000, '第 ' + (i + 1) + ' 题判分');

    const marked = await evaluate(`(() => {
      const q = (window.__CLIMB.currentQuiz.questions[${i}] || {});
      return JSON.stringify({
        type: q.type,
        rights: document.querySelectorAll('.opt--right, .orditem--right').length,
        fillReveal: document.querySelectorAll('.q__reveal').length,
        keyText: (document.querySelector('.opt--right .opt__key') || {}).textContent || 'n/a'
      });
    })()`);
    const mk = JSON.parse(marked);
    const revealOK = mk.type === 'fill' ? mk.fillReveal >= 1 : mk.rights >= 1;

    if (i === 0) {
      await sleep(520);
      await shot('05-quiz-judged');
      revealOK
        ? ok(`判分后正确项有标记（${mk.type}${mk.type === 'fill' ? ' · 参考答案已展示' : ' · 徽章 ' + mk.keyText}）`)
        : bad('正确项未标记', mk);
      ok('第 1 题判分 + 解析 + 截图');
    }
    if (i === 1) {
      comboSeen = await evaluate(`document.querySelector('.combo--on') !== null`);
    } else if (!comboSeen) {
      comboSeen = await evaluate(`document.querySelector('.combo--on') !== null`);
    }
    await sleep(200);
  }
  comboSeen ? ok('连对时出现连击标记') : bad('连击标记未出现');

  /* 题目区同样不能有残留星号（题干 / 选项 / 解析都走 rich()） */
  const quizStars = await evaluate(`(function () {
    const t = document.body.innerText || '';
    const i = t.indexOf('**');
    return i < 0 ? null : t.slice(Math.max(0, i - 20), i + 22);
  })()`);
  quizStars === null ? ok('题目与解析无残留 ** 标记') : bad('题目区还有未解析的 **', { context: quizStars });

  /* ---------- 6. 结算 ---------- */
  await evaluate(`document.querySelector('.level__foot .btn').click()`);
  await waitFor(`document.querySelector('.verdict') !== null`, 8000, '结算页出现');
  await sleep(800);
  await shot('06-result');
  const verdict = await evaluate(`(document.querySelector('.verdict__mark') || {}).textContent || ''`);
  verdict === '通关' ? ok('5 题全对 → 判定通关') : bad('结算判定', { verdict });

  const prog = JSON.parse(await evaluate(`JSON.stringify({
    hasTrack: !!document.querySelector('.result__track .bar__fill'),
    scale: (document.querySelector('.result__track .bar__fill') || {}).style
      ? document.querySelector('.result__track .bar__fill').style.transform : '',
    text: (document.querySelector('.result__hint') || {}).textContent || ''
  })`));
  prog.hasTrack ? ok('结算页显示档位进度读数：' + prog.text + '（' + prog.scale + '）')
    : bad('结算页缺少档位进度读数', prog);
  (await evaluate(`!!localStorage.getItem('climb.progress.v1')`))
    ? ok('进度已写入 localStorage') : bad('进度未落盘');

  /* ---------- 7. 回地图 ---------- */
  await evaluate(clickBtn('返回'));
  await waitFor(`document.querySelectorAll('.lvnode').length === 15`, 8000, '回到地图');
  await sleep(600);
  await shot('07-map-after');
  const doneN = await evaluate(`document.querySelectorAll('.lvnode--done').length`);
  doneN >= 1 ? ok('地图显示通关标记：' + await evaluate(`(document.querySelector('.lvnode--done .lvnode__state')||{}).textContent`))
    : bad('通关标记缺失', { doneN });

  /* ---------- 8. 出题器：重玩题目应当不同 ---------- */
  await evaluate(`document.querySelectorAll('.lvnode')[0].click()`);
  await waitFor(`document.querySelectorAll('.brief-block').length > 0`, 8000, '二次进入讲解');
  await evaluate(clickBtn('开始答题'));
  await waitFor(QVIS, 8000, '二次答题第 1 题');
  const secondSig = await evaluate(`JSON.stringify(window.__CLIMB.currentQuiz.questions
    .map(q => q.stem + '|' + (q.options || []).join('~')))`);
  secondSig !== firstSig
    ? ok('重玩题目不同（出题器有效）')
    : bad('重玩题目完全一致');

  await evaluate(`document.querySelector('.topbar__back').click()`);
  await waitFor(`document.querySelectorAll('.lvnode').length === 15`, 6000, '回到地图');

  /* ---------- 9. 山腰 / 山巅：进地图 + 真进一关 ---------- */
  await waitFor(`document.querySelector('.topbar__back') !== null`, 5000, '地图顶栏返回键');
  await evaluate(`document.querySelector('.topbar__back').click()`);
  await waitFor(`document.querySelectorAll('.world').length === 3`, 6000, '回到选档页');

  for (const [idx, name, cn] of [[1, 'midway', '山腰'], [2, 'summit', '山巅']]) {
    await evaluate(`document.querySelectorAll('.world')[${idx}].click()`);
    await waitFor(`document.documentElement.dataset.tier === '${name}'`, 6000, name + ' 皮肤');

    const lvCount = await evaluate(`document.querySelectorAll('.lvnode').length`);
    lvCount === 15 ? ok(`${cn}地图渲染 15 关`) : bad(`${cn}地图关卡数异常`, { lvCount });

    /* 真进第 1 关，验证讲解与出题都能跑 */
    await evaluate(`document.querySelectorAll('.lvnode')[0].click()`);
    await waitFor(`document.querySelectorAll('.brief-block').length > 0`, 8000, `${cn}第 1 关讲解`);
    const briefOk = await evaluate(`(async () => {
      return JSON.stringify({
        sections: document.querySelectorAll('.brief-block').length,
        paras: document.querySelectorAll('.brief__p').length,
        title: (document.querySelector('.screen__title') || {}).textContent || ''
      });
    })()`);
    const b = JSON.parse(briefOk);
    b.sections >= 5
      ? ok(`${cn}第 1 关讲解正常（${b.sections} 节 / ${b.paras} 段）`)
      : bad(`${cn}讲解分节不足`, b);

    /* 山腰 / 山巅的讲解里确实写了加粗，这里验证端到端真的渲染出了 <strong> */
    const emInfo = JSON.parse(await evaluate(`JSON.stringify({
      strong: document.querySelectorAll('.brief strong').length,
      star: (function () {
        const t = document.body.innerText || '';
        const i = t.indexOf('**');
        return i < 0 ? null : t.slice(Math.max(0, i - 16), i + 18);
      })()
    })`));
    emInfo.strong > 0
      ? ok(`${cn}讲解解析出 ${emInfo.strong} 处加粗`)
      : bad(`${cn}讲解没有解析出任何加粗`, emInfo);
    emInfo.star === null ? ok(`${cn}讲解无残留 **`) : bad(`${cn}讲解还有 ** 残留`, emInfo);

    await sleep(600);
    await shot(`09-${name}-brief`);
    await evaluate(clickBtn('开始答题'));
    await waitFor(QVIS, 8000, `${cn}第 1 题`);
    const surf = await evaluate(`(() => ({
      kind: (window.__CLIMB.currentQuiz.questions[0] || {})._kind,
      opt: document.querySelectorAll('.opt').length,
      ord: document.querySelectorAll('.orditem').length,
      blank: document.querySelectorAll('.blank').length
    }))()`);
    (surf.opt >= 2 || surf.ord >= 3 || surf.blank >= 1)
      ? ok(`${cn}第 1 题交互区正常（${surf.kind}）`)
      : bad(`${cn}第 1 题交互区为空`, surf);
    await sleep(500);
    await shot(`09-${name}-quiz`);

    /* 退出：从关卡顶栏返回地图，再返回选档 */
    await evaluate(`document.querySelector('.topbar__back').click()`);
    await waitFor(`document.querySelectorAll('.lvnode').length === 15`, 6000, `${cn}回到地图`);
    await sleep(400);
    await shot(`08-map-${name}`);
    await evaluate(`document.querySelector('.topbar__back').click()`);
    await waitFor(`document.querySelectorAll('.world').length === 3`, 6000, '返回选档页');
  }

  report.errors.length === 0
    ? ok('全程无页面报错' + (report.warnings.length ? `（另有 ${report.warnings.length} 次连接抖动，非代码问题）` : ''))
    : bad('页面报错 ' + report.errors.length + ' 条', { errors: report.errors.slice(0, 6) });

  writeFileSync(join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));

  try { await send('Browser.close'); } catch { /* 忽略 */ }
  browser.kill();
  await sleep(300);

  console.log('\n================================');
  console.log(`PASS ${report.pass}  FAIL ${report.fail}`);
  console.log('截图目录: ' + SHOTS);
  console.log('================================');
  process.exit(report.fail ? 1 : 0);
}

main().catch(async (e) => {
  console.error('测试中断:', e.message);
  report.errors.push('FATAL: ' + e.message);
  writeFileSync(join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
  process.exit(2);
});
