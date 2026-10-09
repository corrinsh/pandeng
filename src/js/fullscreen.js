/* 攀登 · 浏览器模式逃生口
   ============================================================
   背景：国产手机浏览器的「添加到桌面」不一定给到真正的 PWA 独立窗口，
   有时只生成一个书签 —— 打开后仍带地址栏 + 底部工具栏，观感直接崩回网页。

   这个模块做两件事：
   1. 检测当前是不是独立窗口模式（standalone / fullscreen / iOS 的 navigator.standalone）
   2. 不是的话，在顶部挂一条极窄的提示条，点一下用 Fullscreen API 把浏览器界面顶走

   全屏是「本机可达的最后手段」，不依赖服务器或 manifest 支持。
   注意：Fullscreen API 必须由用户手势触发，所以不能自动执行，只能给按钮。 */

const KEY_DISMISS = 'climb.fsHintDismissed';

/** 当前是否已在独立窗口 / 全屏下运行 */
export function isStandalone() {
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
    if (window.navigator.standalone === true) return true;   // iOS Safari
  } catch (e) { /* 老浏览器没 matchMedia，忽略 */ }
  return false;
}

/** 是否被 Fullscreen API 顶掉了浏览器界面 */
function isFullscreenApi() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

function requestFull() {
  const root = document.documentElement;
  const fn = root.requestFullscreen || root.webkitRequestFullscreen
          || root.mozRequestFullScreen || root.msRequestFullscreen;
  if (!fn) return false;
  try {
    const p = fn.call(root, { navigationUI: 'hide' });
    if (p && p.catch) p.catch(() => {});
    return true;
  } catch (e) {
    return false;
  }
}

function exitFull() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen;
  if (!fn) return;
  try { const p = fn.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) {}
}

/**
 * 挂载提示条（已在独立窗口时什么都不做）。
 * @returns {boolean} 是否已处于独立窗口模式
 */
export function mountFullscreenHint() {
  const standalone = isStandalone();

  /* 调试 / 自动化验收用 */
  window.__CLIMB_FS = {
    standalone,
    fullscreenApi: isFullscreenApi(),
    request: requestFull,
    exit: exitFull
  };

  if (standalone || isFullscreenApi()) return standalone;

  let dismissed = false;
  try { dismissed = sessionStorage.getItem(KEY_DISMISS) === '1'; } catch (e) {}
  if (dismissed) return standalone;

  const host = document.getElementById('app') || document.body;

  const bar = document.createElement('div');
  bar.className = 'fsbar';
  bar.setAttribute('role', 'button');
  bar.tabIndex = 0;

  const label = document.createElement('span');
  label.className = 'fsbar__label';
  label.textContent = '浏览器模式 · 点这里全屏';

  const mark = document.createElement('span');
  mark.className = 'fsbar__mark';
  mark.textContent = '⛶';
  mark.setAttribute('aria-hidden', 'true');

  const close = document.createElement('button');
  close.className = 'fsbar__close';
  close.type = 'button';
  close.setAttribute('aria-label', '本次不再提示');
  close.textContent = '✕';

  bar.appendChild(label);
  bar.appendChild(mark);
  bar.appendChild(close);

  const drop = () => {
    bar.classList.add('fsbar--out');
    host.classList.remove('app--fsbar');
    setTimeout(() => bar.remove(), 240);
  };

  close.addEventListener('click', (ev) => {
    ev.stopPropagation();
    try { sessionStorage.setItem(KEY_DISMISS, '1'); } catch (e) {}
    drop();
  });

  bar.addEventListener('click', () => {
    if (!requestFull()) label.textContent = '这台浏览器不支持全屏 · 请用「添加到主屏幕」重装';
  });

  document.addEventListener('fullscreenchange', () => { if (isFullscreenApi()) drop(); });

  host.insertBefore(bar, host.firstChild);
  host.classList.add('app--fsbar');
  requestAnimationFrame(() => bar.classList.add('fsbar--in'));

  return standalone;
}
