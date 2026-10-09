/* 攀登 · 选档页 */

import { el } from '../ui.js';
import { TIERS } from '../../data/tiers.js';
import { go } from '../router.js';
import { setTier } from '../theme.js';
import { doneCount, totalScore } from '../store.js';
import { LABEL } from '../version.js';

const ROMAN = ['I', 'II', 'III'];

export function selectScreen() {
  setTier('none');

  const body = el('div', { class: 'screen select' },
    el('div', { class: 'screen__kicker', text: '攀登 · CLIMB' }),
    el('h1', { class: 'screen__title', text: '你从哪儿开始？' }),
    el('p', { class: 'screen__lead', text: '三条路线，三种底子。选错了不要紧——随时可以回来重选。' })
  );

  TIERS.forEach((t, i) => {
    const done = doneCount(t.id, t.levels);
    const score = totalScore(t.id, t.levels);
    const pct = Math.round((done / t.levels) * 100);

    const card = el('button', {
      class: `world world--${t.id}` + (t.ready ? '' : ' world--soon'),
      type: 'button'
    },
      el('div', { class: 'world__head' },
        el('span', { class: 'world__idx', text: ROMAN[i] }),
        el('div', { class: 'world__names' },
          el('span', { class: 'world__name', text: t.name }),
          el('span', { class: 'world__sub', text: t.sub })
        ),
        t.ready
          ? el('span', { class: 'world__badge', text: done > 0 ? `${done}/${t.levels}` : '可进入' })
          : el('span', { class: 'world__badge world__badge--soon', text: '撰写中' })
      ),
      el('p', { class: 'world__desc', text: t.desc }),
      el('div', { class: 'world__track' },
        el('div', { class: 'world__fill', style: { transform: `scaleX(${pct / 100})` } })
      ),
      t.ready && score.max > 0
        ? el('div', { class: 'world__foot', text: `已得 ${score.got} / ${score.max} 分` })
        : el('div', { class: 'world__foot', text: `${t.levels} 关` })
    );

    card.addEventListener('click', () => {
      setTier(t.id);
      go('map', { tierId: t.id });
    });

    body.appendChild(card);
  });

  body.appendChild(el('div', { class: 'select__note' },
    el('p', { text: '全程离线，不联网、不需要账号。进度存在这台手机上。' }),
    el('p', { class: 'select__ver', text: LABEL })
  ));

  return { body };
}
