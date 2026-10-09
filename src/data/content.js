/* 攀登 · 内容路由
   统一入口：按档位 id 取章节和关卡。map / level 两个屏幕只认这里，
   新增档位时不用改屏幕代码。
*/

import { CHAPTERS_A, LEVELS_A } from './tier-a.js';
import { CHAPTERS_B, LEVELS_B } from './tier-b.js';
import { CHAPTERS_C, LEVELS_C } from './tier-c.js';

export const CONTENT = {
  foothill: { chapters: CHAPTERS_A, levels: LEVELS_A },
  midway: { chapters: CHAPTERS_B, levels: LEVELS_B },
  summit: { chapters: CHAPTERS_C, levels: LEVELS_C }
};

export const contentOf = (tierId) => CONTENT[tierId] || null;

export const levelsOf = (tierId) => (CONTENT[tierId] || {}).levels || [];

export const levelOf = (tierId, no) => levelsOf(tierId).find(l => l.no === no) || null;

export const chapterOf = (tierId, no) =>
  ((CONTENT[tierId] || {}).chapters || []).find(c => c.no === no) || { no: 1, title: '' };
