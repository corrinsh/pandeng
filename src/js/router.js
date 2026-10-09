/* 攀登 · 屏幕路由（带 View Transitions，自动降级） */

const routes = new Map();
let currentName = null;
let transitionBusy = false;

export function register(name, factory) {
  routes.set(name, factory);
}

export function current() { return currentName; }

export function go(name, params = {}) {
  const factory = routes.get(name);
  if (!factory) throw new Error('未注册的屏幕: ' + name);

  const screenHost = document.getElementById('screen');
  const barHost = document.getElementById('appbar');
  const footHost = document.getElementById('appfoot');

  let redirect = null;

  const paint = () => {
    const out = factory(params) || {};
    /* 屏幕工厂要求改道：不动 DOM，交给 after() 重新导航，
       否则会在当前过渡里把刚渲染好的界面擦掉 */
    if (out.redirect) { redirect = out.redirect; return; }
    barHost.replaceChildren();
    screenHost.replaceChildren();
    footHost.replaceChildren();
    if (out.bar) barHost.appendChild(out.bar);
    if (out.body) screenHost.appendChild(out.body);
    if (out.foot) footHost.appendChild(out.foot);
    screenHost.scrollTop = 0;
  };

  const after = () => {
    if (!redirect) return;
    const r = redirect;
    redirect = null;
    go(r.name, r.params || {});
  };

  currentName = name;
  if (window.__CLIMB) window.__CLIMB.lastRoute = { name, params, at: Date.now() };

  /* 连点时不再起新过渡（否则旧过渡被 abort 会抛 AbortError） */
  if (typeof document.startViewTransition === 'function' && !transitionBusy) {
    try {
      transitionBusy = true;
      const t = document.startViewTransition(paint);
      const release = () => { transitionBusy = false; };
      t.finished.then(release, release);
      t.ready.catch(() => {});
      t.updateCallbackDone.catch(() => {});
      return t.finished.then(after, after);
    } catch {
      transitionBusy = false;
      paint();
      after();
      return Promise.resolve();
    }
  }

  paint();
  after();
  return Promise.resolve();
}
