/* 攀登 · 档位 C「山巅」内容聚合 */

import { CH1 } from './tier-c/ch1.js';
import { CH2 } from './tier-c/ch2.js';
import { CH3 } from './tier-c/ch3.js';

export const CHAPTERS_C = [
  { no: 1, title: 'Agent 的地基', note: '循环、工具、记忆、规划', from: 1, to: 5 },
  { no: 2, title: '把 Agent 造出来', note: '设计、上下文、失败、评测', from: 6, to: 10 },
  { no: 3, title: '工程化落地', note: '选型、边界、人在环、安全', from: 11, to: 15 }
];

export const LEVELS_C = [...CH1, ...CH2, ...CH3];

export const LEVEL_BY_NO_C = (no) => LEVELS_C.find(l => l.no === no) || null;
