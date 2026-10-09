/* 攀登 · 答题引擎
   已实现题型：single 单选 / multi 多选 / fill 填空 / order 排序
*/

import { el, rich } from './ui.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const PUNCT = /[\s，。、；：！？,.;:!?（）()【】\[\]"'“”‘’·\-—_~～]/g;

export function normalize(s) {
  return String(s == null ? '' : s).replace(PUNCT, '').toLowerCase();
}

export function evaluate(q, value) {
  switch (q.type) {
    case 'single':
      return value === q.answer;
    case 'multi': {
      const a = [...q.answer].sort((x, y) => x - y).join(',');
      const g = [...(value || [])].sort((x, y) => x - y).join(',');
      return a === g;
    }
    case 'fill':
      return (q.answers || []).some(a => normalize(a) === normalize(value));
    case 'order':
      return Array.isArray(value) && value.join(',') === (q.answer || []).join(',');
    default:
      return false;
  }
}

export function buildQuestion(q) {
  const wrap = el('div', { class: 'quiz' });
  let given = q.type === 'multi' ? [] : null;
  let seq = [];                 // order 题：按点击顺序记录的显示下标
  let locked = false;
  let input = null;
  const optNodes = [];

  /* ---- 题面 ---- */
  if (q.type === 'fill') {
    const stem = el('div', { class: 'q__text q__text--fill' });
    input = el('input', {
      class: 'blank', type: 'text', placeholder: '填写',
      autocomplete: 'off', autocapitalize: 'off',
      autocorrect: 'off', spellcheck: 'false',
      enterkeyhint: 'done'
    });
    const parts = String(q.stem).split('{{blank}}');
    parts.forEach((p, i) => {
      /* 用 span 包一层再做富文本，这样填空输入框还能夹在中间不被 innerHTML 冲掉 */
      if (p) stem.appendChild(el('span', { html: rich(p) }));
      if (i < parts.length - 1) stem.appendChild(input);
    });
    wrap.appendChild(stem);
    setTimeout(() => input && input.focus({ preventScroll: true }), 260);
  } else {
    wrap.appendChild(el('div', { class: 'q__text', html: rich(q.stem) }));
    if (q.type === 'multi') {
      wrap.appendChild(el('div', { class: 'q__hint', text: '多选 · 全部选对才算过关' }));
    }
    if (q.type === 'order') {
      wrap.appendChild(el('div', { class: 'q__hint', text: '按顺序依次点选 · 再点一次可取消' }));
    }
  }

  /* ---- 单选 / 多选 ---- */
  if (q.type === 'single' || q.type === 'multi') {
    const list = el('div', { class: 'opts' });
    (q.options || []).forEach((text, i) => {
      const btn = el('button', { class: 'opt', type: 'button' },
        el('span', { class: 'opt__key', text: LETTERS[i] }),
        el('span', { class: 'opt__text', html: rich(text) })
      );
      btn.addEventListener('click', () => {
        if (locked) return;
        if (q.type === 'single') {
          given = i;
          optNodes.forEach((n, j) => n.classList.toggle('opt--picked', j === i));
        } else {
          const at = given.indexOf(i);
          if (at >= 0) given.splice(at, 1); else given.push(i);
          btn.classList.toggle('opt--picked', given.includes(i));
        }
        wrap.dispatchEvent(new CustomEvent('answerchange', { bubbles: true }));
      });
      optNodes.push(btn);
      list.appendChild(btn);
    });
    wrap.appendChild(list);
  }

  /* ---- 排序 ---- */
  if (q.type === 'order') {
    const list = el('div', { class: 'ordlist' });
    (q.options || []).forEach((text, i) => {
      const badge = el('span', { class: 'orditem__badge' });
      const btn = el('button', { class: 'orditem', type: 'button' },
        badge,
        el('span', { class: 'orditem__text', html: rich(text) })
      );
      btn.addEventListener('click', () => {
        if (locked) return;
        const at = seq.indexOf(i);
        if (at >= 0) seq.splice(at, 1); else seq.push(i);
        syncOrder();
        wrap.dispatchEvent(new CustomEvent('answerchange', { bubbles: true }));
      });
      optNodes.push(btn);
      list.appendChild(btn);
    });

    function syncOrder() {
      optNodes.forEach((n, i) => {
        const at = seq.indexOf(i);
        n.classList.toggle('orditem--on', at >= 0);
        n.querySelector('.orditem__badge').textContent = at >= 0 ? String(at + 1) : '';
      });
    }
    wrap.appendChild(list);
  }

  if (input) {
    input.addEventListener('input', () => {
      wrap.dispatchEvent(new CustomEvent('answerchange', { bubbles: true }));
    });
  }

  function value() {
    if (q.type === 'fill') return input ? input.value : '';
    if (q.type === 'order') return seq.slice();
    return given;
  }

  function ready() {
    if (q.type === 'fill') return normalize(input ? input.value : '').length > 0;
    if (q.type === 'multi') return given.length > 0;
    if (q.type === 'order') return seq.length === (q.options || []).length;
    return given != null;
  }

  function lock() {
    locked = true;
    optNodes.forEach(n => { n.disabled = true; });
    if (input) input.disabled = true;
  }

  /* ---- 判分后揭示 ---- */
  function reveal() {
    if (q.type === 'fill') {
      wrap.appendChild(el('div', { class: 'q__reveal' },
        el('span', { class: 'q__reveal-k', text: '参考答案' }),
        el('span', { class: 'q__reveal-v', text: (q.answers || [])[0] || '' })
      ));
      return;
    }

    if (q.type === 'order') {
      const userPos = {};
      seq.forEach((d, p) => { userPos[d] = p; });
      const rightPos = {};
      (q.answer || []).forEach((d, p) => { rightPos[d] = p; });
      optNodes.forEach((n, d) => {
        n.classList.remove('orditem--on');
        n.classList.add(userPos[d] === rightPos[d] ? 'orditem--right' : 'orditem--wrong');
      });
      return;
    }

    const correct = q.type === 'multi' ? q.answer : [q.answer];
    optNodes.forEach((n, i) => {
      const isRight = correct.includes(i);
      const picked = q.type === 'multi' ? given.includes(i) : given === i;
      n.classList.remove('opt--picked');
      const key = n.querySelector('.opt__key');
      if (isRight) {
        n.classList.add('opt--right');
        if (key) key.textContent = '✓';
      } else if (picked) {
        n.classList.add('opt--wrong');
        if (key) key.textContent = '✕';
      } else {
        n.classList.add('opt--dim');
      }
    });
  }

  return { node: wrap, value, ready, lock, reveal, question: q };
}
