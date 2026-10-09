/* 攀登 · 入口 */

import { register, go } from './router.js';
import { selectScreen } from './screens/select.js';
import { mapScreen } from './screens/map.js';
import { levelScreen } from './screens/level.js';
import { TIERS } from '../data/tiers.js';
import { levelsOf, contentOf } from '../data/content.js';
import { sampleQuizzes, buildQuiz } from './generator.js';
import { mountFullscreenHint } from './fullscreen.js';
import { rich } from './ui.js';

register('select', selectScreen);
register('map', mapScreen);
register('level', levelScreen);

/* 调试 / 自动化验收用（只读，不影响运行）
   sampleQuizzes：连续生成 N 轮题目并返回指纹，用来验证「出题器真的在出题」
   verifyAll    ：把每一关都连造 30 轮题，检查素材是否够用、题量是否正确 */
function auditTier(tier) {
  const levels = levelsOf(tier.id);
  return levels.map(lv => {
    if (!lv.ready || !lv.bank) return { tier: tier.id, no: lv.no, title: lv.title, ready: false };
    let worst = Infinity;
    let lastKinds = [];
    for (let i = 0; i < 30; i++) {
      const q = buildQuiz(lv);
      worst = Math.min(worst, q.size);
      lastKinds = [...new Set(q.questions.map(x => x._kind))];
    }
    return {
      tier: tier.id,
      no: lv.no,
      title: lv.title,
      ready: true,
      minQuestions: worst,
      kinds: lastKinds,
      sections: (lv.brief && lv.brief.sections ? lv.brief.sections.length : 0),
      terms: ((lv.bank.pools || {}).terms || []).length,
      manual: ((lv.bank.pools || {}).manual || []).length
    };
  });
}

window.__CLIMB = {
  tiers: TIERS,
  content: contentOf,
  levelsOf,
  /* 供验收脚本做纯函数校验：** → <strong> 的转换（不依赖任何一关的具体内容） */
  rich,
  sampleQuizzes(tierId, no, times = 20) {
    const lv = levelsOf(tierId).find(l => l.no === no);
    return lv && lv.bank ? sampleQuizzes(lv, times) : null;
  },
  verifyAll() {
    return TIERS.flatMap(auditTier);
  }
};

/* 抹掉一切「这是网页」的痕迹 */
function harden() {
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });

  // 安卓返回键：模拟 App 返回
  history.replaceState({ climb: 'root' }, '');
  window.addEventListener('popstate', () => {
    const screen = document.getElementById('screen');
    const back = document.querySelector('.topbar__back');
    if (back && screen && screen.children.length) {
      history.pushState({ climb: 'inner' }, '');
      back.click();
    }
  });
  history.pushState({ climb: 'inner' }, '');
}

function boot() {
  const bootEl = document.getElementById('boot');
  go('select');

  const fade = () => {
    if (!bootEl || !bootEl.parentNode) return;
    bootEl.classList.add('boot--off');
    setTimeout(() => bootEl.remove(), 420);
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(fade, 700));
  }
  setTimeout(fade, 1400);
}

harden();
mountFullscreenHint();
boot();

/* 离线支持（失败不影响使用） */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
