/* 攀登 · JS 语法体检
   ⚠️ 不要用 `node --check`：它按 CommonJS 解析 .js，会**漏掉** ESM 的语法错误
   （本项目就因此把一处跨行字符串放上了线，页面白屏）。
   这里用真正的 import 去加载每个模块，只把 SyntaxError 当失败，
   像 window is not defined 这类运行时错误在 Node 里是正常的，不算问题。

   用法: node 测试/check-syntax.mjs
*/
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(HERE);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

const files = walk(join(ROOT, 'src'));
let bad = 0;

for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, '/');
  try {
    await import(pathToFileURL(f).href);
    console.log('  ok    ' + rel);
  } catch (e) {
    if (e instanceof SyntaxError) {
      bad++;
      console.log('  FAIL  ' + rel + '  →  ' + String(e.message).split('\n')[0]);
    } else {
      console.log('  ok    ' + rel + '  （运行时错误，与语法无关：'
        + String(e.message).split('\n')[0].slice(0, 48) + '）');
    }
  }
}

console.log('\n共检查 ' + files.length + ' 个模块，语法错误 ' + bad + ' 个');
process.exit(bad ? 1 : 0);
