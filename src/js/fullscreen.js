/* 攀登 · 浏览器模式适配
   ============================================================
   背景：国产手机浏览器对 PWA 的支持差异极大。
     · 华为浏览器 / Chrome / Edge：能创建真正的独立窗口（无地址栏、无工具栏）
     · 荣耀浏览器：只对白名单站点（百度/知乎/京东这类）开放独立窗口，
       其他站点「添加到桌面」只生成一个书签 —— 点开就是浏览器本体。
   本模块给出两条不依赖浏览器 PWA 支持的兜底路径：

   1. **自动全屏**（默认）：首次点击页面任意位置时调 Fullscreen API，
      把地址栏和底部工具栏一起顶走。虽不是真独立窗口，但视觉是沉浸的。
   2. **一键安装**：如果浏览器抛了 beforeinstallprompt（说明它支持真安装），
      提示条改成「把「攀登」装到桌面」，点一下直接调起系统安装。

   加 ?nofs=1 可关掉自动全屏（验收脚本用，用户不爱也可手动加）。 */

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

/** 是否允许自动全屏（?nofs=1 关闭） */
function autoAllowed() {
  try {
    return !/[?&]nofs=1/.test(location.search);
  } catch (e) { return true; }
}

/**
 * 挂载提示条（已在独立窗口时什么都不做）。
 * @returns {boolean} 是否已处于独立窗口模式
 */
export function mountFullscreenHint() {
  const standalone = isStandalone();
  const auto = autoAllowed() && !standalone;

  /* 调试 / 自动化验收用 */
  window.__CLIMB_FS = {
    standalone,
    fullscreenApi: isFullscreenApi(),
    autoArmed: false,
    installAvailable: false,
    request: requestFull,
    exit: exitFull
  };

  if (standalone) return true;

  let dismissed = false;
  try { dismissed = sessionStorage.getItem(KEY_DISMISS) === '1'; } catch (e) {}
  if (dismissed) return false;

  const host = document.getElementById('app') || document.body;

  const bar = document.createElement('div');
  bar.className = 'fsbar';
  bar.setAttribute('role', 'button');
  bar.tabIndex = 0;

  const label = document.createElement('span');
  label.className = 'fsbar__label';

  const mark = document.createElement('span');
  mark.className = 'fsbar__mark';
  mark.setAttribute('aria-hidden', 'true');

  const close = document.createElement('button');
  close.className = 'fsbar__close';
  close.type = 'button';
  close.setAttribute('aria-label', '本次不再提示');
  close.textContent = '✕';

  bar.appendChild(label);
  bar.appendChild(mark);
  bar.appendChild(close);

  let deferredInstall = null;

  function applyMode() {
    if (deferredInstall) {
      label.textContent = '把「攀登」装到桌面';
      mark.textContent = '↓';
    } else {
      label.textContent = '浏览器模式 · 点这里全屏';
      mark.textContent = '⛶';
    }
  }
  applyMode();

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
    if (deferredInstall) {
      const ev = deferredInstall;
      deferredInstall = null;
      try { ev.prompt(); } catch (e) {}
      if (ev.userChoice && ev.userChoice.then) {
        ev.userChoice.then((r) => {
          if (r && r.outcome === 'accepted') drop();
        }).catch(() => {});
      }
      return;
    }
    if (!requestFull()) {
      label.textContent = '这台浏览器不支持全屏 · 建议装 Chrome 后用「安装应用」';
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (isFullscreenApi()) drop();
  });

  /* 浏览器支持真安装时，优先引导安装（比较全屏更接近"真 App"） */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
    window.__CLIMB_FS.installAvailable = true;
    window.__CLIMB_FS.autoArmed = false;
    applyMode();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    drop();
  });

  /* 自动全屏：首次点击任意位置触发（点提示条本身不算） */
  if (auto) {
    const autoFull = (ev) => {
      if (deferredInstall) { document.removeEventListener('click', autoFull, true); return; }
      if (ev.target && bar.contains(ev.target)) return;
      document.removeEventListener('click', autoFull, true);
      window.__CLIMB_FS.autoArmed = false;
      requestFull();
    };
    document.addEventListener('click', autoFull, true);
    window.__CLIMB_FS.autoArmed = true;
  }

  host.insertBefore(bar, host.firstChild);
  host.classList.add('app--fsbar');
  requestAnimationFrame(() => bar.classList.add('fsbar--in'));

  return false;
}
