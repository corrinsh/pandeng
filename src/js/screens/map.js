/* 攀登 · 关卡地图 */

import { el } from '../ui.js';
import { go } from '../router.js';
import { setTier } from '../theme.js';
import { TIER_BY_ID } from '../../data/tiers.js';
import { contentOf } from '../../data/content.js';
import { isDone, isUnlocked, levelRecord, doneCount } from '../store.js';

export function mapScreen({ tierId }) {
  const tier = TIER_BY_ID[tierId];
  if (!tier) return { redirect: { name: 'select' } };
  const content = contentOf(tierId);
  if (!content) return { redirect: { name: 'select' } };
  setTier(tierId);

  const { chapters, levels } = content;
  const done = doneCount(tierId, tier.levels);
  const total = tier.levels;

  /* ---- 顶栏 ---- */
  const bar = el('div', { class: 'topbar' },
    el('button', {
      class: 'topbar__back', type: 'button', 'aria-label': '返回选档',
      onclick: () => { setTier('none'); go('select'); }
    }, el('span', { html: '&#8592;' })),
    el('div', { class: 'topbar__title', text: `${tier.name} · ${tier.sub}` }),
    el('div', { class: 'topbar__meta', text: `${done}/${total}` })
  );

  /* ---- 主体 ---- */
  const body = el('div', { class: 'screen map' });

  body.appendChild(el('div', { class: 'map__track' },
    el('div', {
      class: 'map__fill',
      style: { transform: `scaleX(${total ? done / total : 0})` }
    })
  ));

  if (!tier.ready) {
    body.appendChild(el('div', { class: 'notice' },
      el('div', { class: 'notice__k', text: '内容撰写中' }),
      el('p', { class: 'notice__p', text: '这一档的知识库还在写。你可以先看看它的视觉风格和关卡结构——这就是它最终的样子。' })
    ));
  }

  chapters.forEach(ch => {
    const sec = el('section', { class: 'chapter' });
    sec.appendChild(el('div', { class: 'chapter__head' },
      el('span', { class: 'chapter__no', text: `第 ${ch.no} 章` }),
      el('span', { class: 'chapter__title', text: ch.title }),
      el('span', { class: 'chapter__note', text: ch.note })
    ));

    const list = el('div', { class: 'lvnodes' });
    levels.filter(l => l.no >= ch.from && l.no <= ch.to).forEach(l => {
      const record = levelRecord(tierId, l.no);
      const doneThis = isDone(tierId, l.no);
      const unlocked = isUnlocked(tierId, l.no);
      const playable = l.ready && tier.ready !== false && unlocked;

      let state = 'locked', stateText = '未解锁';
      if (!l.ready) { state = 'pending'; stateText = '待撰写'; }
      else if (doneThis) { state = 'done'; stateText = `✓ ${record.best}/${record.total}`; }
      else if (unlocked) { state = 'current'; stateText = '可挑战'; }

      const node = el('button', {
        class: `lvnode lvnode--${state}`, type: 'button',
        onclick: () => {
          if (!l.ready) return toast('这一关的内容还在撰写中');
          if (!unlocked) return toast('先通关上一关');
          go('level', { tierId, no: l.no });
        }
      },
        el('span', { class: 'lvnode__no', text: String(l.no).padStart(2, '0') }),
        el('span', { class: 'lvnode__body' },
          el('span', { class: 'lvnode__title', text: l.title || '' }),
          el('span', { class: 'lvnode__hook', text: l.hook || '' })
        ),
        el('span', { class: 'lvnode__state', text: stateText })
      );
      list.appendChild(node);
    });
    sec.appendChild(list);
    body.appendChild(sec);
  });

  return { bar, body };
}

/* 轻量提示 */
function toast(msg) {
  const t = el('div', { class: 'toast', text: msg });
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('toast--in'));
  setTimeout(() => {
    t.classList.remove('toast--in');
    setTimeout(() => t.remove(), 300);
  }, 1600);
}
