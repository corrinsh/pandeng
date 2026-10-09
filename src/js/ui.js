/* 攀登 · 极简 DOM 构建助手 */

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      /* 用属性形式（node.onclick = fn）而不是 addEventListener：
         后者会让后续的 .onclick = 覆盖变成"叠加两个监听器"，是本项目踩过的坑 */
      node[k.toLowerCase()] = v;
    } else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(4)) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export const $ = (sel, root = document) => root.querySelector(sel);

/* ============================================================
   行内富文本：把讲解/题目文本里的 **加粗** 变成 <strong>
   ------------------------------------------------------------
   为什么需要：全项目 45 关的内容里写了 1900+ 处 **……**，
   但渲染层一直用 textContent 直出 —— 星号原样显示在界面上。
   先转义再替换：内容是本项目的静态数据，但如果以后从外部导入，
   这一步能保证不会把 HTML 注入进页面。
   ============================================================ */
export function rich(text) {
  const esc = String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
