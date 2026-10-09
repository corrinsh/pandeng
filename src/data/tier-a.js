/* 攀登 · 档位 A「山脚」内容聚合
   按章拆分到 tier-a/ch1.js、ch2.js、ch3.js，这里只做汇总。
   加内容时改章文件，不用动这个文件。
*/

import { CH1 } from './tier-a/ch1.js';
import { CH2 } from './tier-a/ch2.js';
import { CH3 } from './tier-a/ch3.js';

export const CHAPTERS_A = [
  { no: 1, title: '门槛很低', note: '先让你觉得这件事有意思', from: 1, to: 5 },
  { no: 2, title: '开始不对劲', note: '真机制登场，难度抬头', from: 6, to: 10 },
  { no: 3, title: '原来我什么都不懂', note: '你以为你懂了', from: 11, to: 15 }
];

export const LEVELS_A = [...CH1, ...CH2, ...CH3];

export const LEVEL_BY_NO_A = (no) => LEVELS_A.find(l => l.no === no) || null;
