/* 按指定设备参数抓全分辨率截图，用于像素级比对
   用法: node 测试/capture.mjs <w> <h> <dsf> <outName> [screen]
   screen: select | map
*/
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHOTS = join(HERE, 'shots');
mkdirSync(SHOTS, { recursive: true });

const [W, H, DSF, OUT, SCREEN = 'map'] = process.argv.slice(2);
const VP = { width: +W, height: +H, dsf: +DSF };

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9700 + Math.floor(Math.random() * 200);
const PROFILE = join(process.env.TEMP || '.', 'climb-cap-' + Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function main() {
  const browser = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    '--force-device-scale-factor=' + VP.dsf,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    '--window-size=520,1000', 'about:blank'
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find(t => t.type === 'page');
      if (p?.webSocketDebuggerUrl) { wsUrl = p.webSocketDebuggerUrl; break; }
    } catch { /* 等 */ }
    await sleep(150);
  }
  if (!wsUrl) throw new Error('CDP 未就绪');

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let mid = 0;
  const waiters = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && waiters.has(m.id)) {
      const { resolve, reject } = waiters.get(m.id);
      waiters.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++mid;
    waiters.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (waiters.has(id)) { waiters.delete(id); reject(new Error('超时 ' + method)); } }, 20000);
  });
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: VP.width, height: VP.height, deviceScaleFactor: VP.dsf, mobile: true
  });

  const BASE = 'http://127.0.0.1:8099/';
  for (let i = 0; i < 3; i++) {
    await send('Page.navigate', { url: BASE });
    await sleep(1800);
    if (await evaluate(`document.querySelector('.world') !== null`)) break;
  }
  await evaluate(`document.fonts && document.fonts.ready ? document.fonts.ready.then(()=>true) : true`);
  await sleep(800);

  if (SCREEN === 'map') {
    await evaluate(`document.querySelectorAll('.world')[0].click()`);
    await sleep(1600);
  }

  const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const out = join(SHOTS, OUT + '.png');
  writeFileSync(out, Buffer.from(r.data, 'base64'));
  console.log(`设备 ${VP.width}x${VP.height} @${VP.dsf}  屏幕 ${SCREEN}  →  ${out}`);

  try { await send('Browser.close'); } catch { /* ignore */ }
  browser.kill();
  process.exit(0);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
