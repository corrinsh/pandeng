/* 攀登 · 档位定义 */

export const TIERS = [
  {
    id: 'foothill',
    name: '山脚',
    sub: '从零开始',
    desc: '完全没接触过 AI。从「它到底是个什么东西」讲起。',
    ready: true,
    levels: 15,
    accent: '#E0A33A'
  },
  {
    id: 'midway',
    name: '山腰',
    sub: '已经上路',
    desc: '用过 ChatGPT，但只会随口问问。把提示词当工程来做。',
    ready: true,
    levels: 15,
    accent: '#4FB3A5'
  },
  {
    id: 'summit',
    name: '山巅',
    sub: '想动手造',
    desc: '懂 Agent 概念，但没亲手搭过。从设计到 debug 全流程。',
    ready: true,
    levels: 15,
    accent: '#8FB4D9'
  }
];

export const TIER_BY_ID = Object.fromEntries(TIERS.map(t => [t.id, t]));
