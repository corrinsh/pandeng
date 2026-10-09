/* 攀登 · 皮肤切换 */

const THEME_COLOR = {
  none: '#0E0F10',
  foothill: '#100F0D',
  midway: '#0E1011',
  summit: '#0D0E12'
};

/* 三档都是深底，状态栏一律走半透明，让内容透上去 */
const STATUS_BAR = {
  none: 'black-translucent',
  foothill: 'black-translucent',
  midway: 'black-translucent',
  summit: 'black-translucent'
};

export function setTier(id) {
  const tier = THEME_COLOR[id] ? id : 'none';
  document.documentElement.dataset.tier = tier;
  const app = document.getElementById('app');
  if (app) app.dataset.tier = tier;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[tier]);

  const sb = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (sb) sb.setAttribute('content', STATUS_BAR[tier]);
}

export function currentTier() {
  return document.documentElement.dataset.tier || 'none';
}
