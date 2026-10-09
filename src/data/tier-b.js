/* 攀登 · 档位 B「山腰」内容聚合 */

import { CH1 } from './tier-b/ch1.js';
import { CH2 } from './tier-b/ch2.js';
import { CH3 } from './tier-b/ch3.js';

export const CHAPTERS_B = [
  { no: 1, title: '把提示词当回事', note: '从随便问问到工程做法', from: 1, to: 5 },
  { no: 2, title: '模型的能力边界', note: '提示词解决不了的那些事', from: 6, to: 10 },
  { no: 3, title: '从对话到系统', note: '把工具装成一台机器', from: 11, to: 15 }
];

export const LEVELS_B = [...CH1, ...CH2, ...CH3];

export const LEVEL_BY_NO_B = (no) => LEVELS_B.find(l => l.no === no) || null;
