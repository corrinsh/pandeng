/* 攀登 · 关卡流程：讲解 → 答题 → 结算 */

import { el, rich } from '../ui.js';
import { go } from '../router.js';
import { setTier } from '../theme.js';
import { TIER_BY_ID } from '../../data/tiers.js';
import { levelOf, chapterOf, levelsOf } from '../../data/content.js';
import { buildQuestion, evaluate } from '../quiz.js';
import { buildQuiz } from '../generator.js';
import { recordLevel, getPrefs, setPref, isDone } from '../store.js';

const PASS_RATIO = 0.6;

export function levelScreen({ tierId, no }) {
  const tier = TIER_BY_ID[tierId];
  setTier(tierId);

  const level = levelOf(tierId, no);
  if (!level || !level.ready) return { redirect: { name: 'map', params: { tierId } } };

  const chapter = chapterOf(tierId, level.chapter);
  const quiz = buildQuiz(level);
  const questions = quiz.questions;
  const total = questions.length;
  const need = Math.ceil(total * PASS_RATIO);

  /* 测试钩子：本轮实际生成的题目（只读） */
  if (window.__CLIMB) window.__CLIMB.currentQuiz = quiz;

  const bar = el('div', { class: 'topbar' },
    el('button', {
      class: 'topbar__back', type: 'button', 'aria-label': '返回地图',
      onclick: () => go('map', { tierId })
    }, el('span', { html: '&#8592;' })),
    el('div', { class: 'topbar__title', text: `第 ${no} 关 · ${level.title}` }),
    el('div', { class: 'topbar__meta', text: '' })
  );
  const barMeta = bar.lastChild;

  const body = el('div', { class: 'screen level' });
  const foot = el('div', { class: 'level__foot' });

  let qi = 0;
  let correct = 0;
  let combo = 0;
  let bestCombo = 0;
  const marks = [];
  let ctl = null;
  let submitted = false;

  /* ================= 讲解 ================= */
  function renderBrief() {
    barMeta.textContent = '讲解';
    const wrap = el('div', { class: 'brief' });
    let d = 0;
    const delay = () => ({ animationDelay: (d += 55) + 'ms' });

    wrap.appendChild(el('div', { class: 'screen__kicker brief__sec', style: delay() },
      `第 ${chapter.no} 章 · ${chapter.title}`));
    wrap.appendChild(el('h1', { class: 'screen__title brief__sec', style: delay(), html: rich(level.title) }));

    const b = level.brief || {};
    if (b.intro) {
      wrap.appendChild(el('p', { class: 'brief__intro brief__sec', style: delay(), html: rich(b.intro) }));
    }

    (b.sections || []).forEach(sec => {
      const box = el('section', { class: 'brief__sec brief-block', style: delay() });
      box.appendChild(el('h2', { class: 'brief__h', html: rich(sec.h) }));
      (sec.ps || []).forEach(p => box.appendChild(el('p', { class: 'brief__p', html: rich(p) })));
      if (sec.note) box.appendChild(el('div', { class: 'brief__note', html: rich(sec.note) }));
      wrap.appendChild(box);
    });

    if (b.takeaway) {
      wrap.appendChild(el('div', { class: 'brief__sec takeaway', style: delay() },
        el('div', { class: 'takeaway__k', text: '一句话带走' }),
        el('p', { class: 'takeaway__p', html: rich(b.takeaway) })
      ));
    }

    const cb = el('input', { class: 'chk', type: 'checkbox', id: 'skipbrief' });
    cb.checked = !!getPrefs().skipBrief;
    cb.addEventListener('change', () => setPref('skipBrief', cb.checked));
    wrap.appendChild(el('label', { class: 'chkrow brief__sec', for: 'skipbrief', style: delay() },
      cb, el('span', { text: '以后直接进入答题' })
    ));

    body.replaceChildren(wrap);
    foot.replaceChildren(el('button', {
      class: 'btn', type: 'button', onclick: startQuiz
    }, `开始答题 · ${total} 题`));
  }

  function startQuiz() { qi = 0; correct = 0; combo = 0; bestCombo = 0; marks.length = 0; step(); }

  /* ================= 答题 ================= */
  function step() {
    submitted = false;
    const q = questions[qi];
    barMeta.textContent = `${qi + 1}/${total}`;

    const comboEl = el('span', { class: 'combo' + (combo >= 2 ? ' combo--on' : '') },
      combo >= 2 ? `连对 ×${combo}` : '');

    const wrap = el('div', { class: 'quizwrap' },
      el('div', { class: 'bar' },
        el('div', { class: 'bar__fill', style: { transform: `scaleX(${qi / total})` } })
      ),
      el('div', { class: 'q__head' },
        el('div', { class: 'q__index', text: `第 ${qi + 1} / ${total} 题` }),
        comboEl
      )
    );

    ctl = buildQuestion(q);
    wrap.appendChild(ctl.node);

    const explain = el('div', { class: 'explain' });
    wrap.appendChild(explain);
    body.replaceChildren(wrap);

    const submitBtn = el('button', { class: 'btn', type: 'button', text: '提交', disabled: true });
    const sync = () => { if (!submitted) submitBtn.disabled = !ctl.ready(); };
    ctl.node.addEventListener('answerchange', sync);
    sync();

    submitBtn.addEventListener('click', () => {
      if (!submitted) {
        const ok = evaluate(q, ctl.value());
        submitted = true;
        marks.push(ok);
        if (ok) {
          correct++;
          combo++;
          bestCombo = Math.max(bestCombo, combo);
          if (combo >= 2) {
            comboEl.textContent = `连对 ×${combo}`;
            comboEl.classList.remove('combo--on', 'combo--pop');
            void comboEl.offsetWidth;
            comboEl.classList.add('combo--on', 'combo--pop');
          }
        } else {
          combo = 0;
          comboEl.classList.remove('combo--on');
        }

        ctl.lock();
        ctl.reveal();
        const fill = wrap.querySelector('.bar__fill');
        if (fill) fill.style.transform = `scaleX(${(qi + 1) / total})`;

        if (q.explain) {
          explain.appendChild(el('div', { class: 'explain__k', text: ok ? '答对了' : '不对' }));
          explain.appendChild(el('p', { class: 'explain__p', html: rich(q.explain) }));
        }
        explain.classList.add('explain--in');
        submitBtn.textContent = (qi + 1 < total) ? '下一题' : '看结果';
        submitBtn.disabled = false;
        explain.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else if (qi + 1 < total) {
        qi++;
        step();
      } else {
        finish();
      }
    });

    foot.replaceChildren(submitBtn);
    body.scrollTop = 0;
  }

  /* ================= 结算 ================= */
  function finish() {
    const passed = correct >= need;
    if (passed) recordLevel(tierId, no, correct, total);
    barMeta.textContent = '结算';

    const wrap = el('div', { class: 'result' },
      el('div', { class: `verdict ${passed ? 'verdict--ok' : 'verdict--bad'}` },
        el('div', { class: 'verdict__mark', text: passed ? '通关' : '差一点' }),
        el('div', {
          class: 'verdict__hint',
          text: `答对 ${correct} / ${total} 题　（${need} 题过关）`
            + (bestCombo >= 2 ? `　最长连对 ${bestCombo}` : '')
        })
      )
    );

    const dots = el('div', { class: 'result__dots' });
    marks.forEach((ok, i) => {
      dots.appendChild(el('span', {
        class: 'result__dot' + (ok ? ' is-ok' : ' is-bad'),
        style: { animationDelay: (i * 80) + 'ms' },
        text: String(i + 1)
      }));
    });
    wrap.appendChild(el('div', { class: 'card result__card' },
      el('div', { class: 'result__k', text: '逐题战绩' }), dots
    ));

    const b = level.brief || {};
    wrap.appendChild(el('div', { class: 'card takeaway result__card' },
      el('div', { class: 'takeaway__k', text: passed ? '本关要点' : '再想一遍' }),
      el('p', {
        class: 'takeaway__p',
        html: rich(passed ? (b.takeaway || level.hook || '') : `还没到 ${need} 题。往上翻一遍讲解，或者直接重来。`)
      })
    ));

    /* 档位进度读数：把结算页下半部分的空白换成有用的信息 */
    const all = levelsOf(tierId);
    const doneN = all.filter(l => isDone(tierId, l.no)).length;
    wrap.appendChild(el('div', { class: 'result__prog' },
      el('div', { class: 'result__k', text: `${tier.name} · 进度` }),
      el('div', { class: 'result__track' },
        el('div', { class: 'bar__fill', style: { transform: `scaleX(${doneN / Math.max(1, tier.levels)})` } })
      ),
      el('div', { class: 'result__hint', text: `已通关 ${doneN} / ${tier.levels} 关` })
    ));

    body.replaceChildren(wrap);

    const goMap = () => go('map', { tierId });
    const next = levelsOf(tierId).find(l => l.no === no + 1);
    const hasNext = !!(passed && next && next.ready);

    const mainBtn = el('button', {
      class: 'btn', type: 'button',
      onclick: () => {
        if (hasNext) go('level', { tierId, no: no + 1 });
        else if (passed) goMap();
        else startQuiz();
      }
    }, hasNext ? '进入下一关' : (passed ? '返回关卡地图' : '重玩本关'));

    const backBtn = el('button', {
      class: 'btn btn--ghost', type: 'button', onclick: goMap
    }, '返回关卡地图');

    foot.replaceChildren(...(hasNext || !passed ? [mainBtn, backBtn] : [mainBtn]));
    body.scrollTop = 0;
  }

  if (getPrefs().skipBrief) startQuiz(); else renderBrief();

  return { bar, body, foot };
}
