/* 攀登 · 进度存储（localStorage，全离线） */

const KEY = 'climb.progress.v1';

const EMPTY = () => ({ version: 1, tiers: {}, prefs: { skipBrief: false } });

let state = null;

export function load() {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : EMPTY();
    if (!state.tiers) state.tiers = {};
    if (!state.prefs) state.prefs = { skipBrief: false };
  } catch {
    state = EMPTY();
  }
  return state;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 隐私模式等，忽略 */ }
}

function tierState(tierId) {
  const s = load();
  if (!s.tiers[tierId]) s.tiers[tierId] = { levels: {} };
  return s.tiers[tierId];
}

export function levelRecord(tierId, no) {
  return tierState(tierId).levels[no] || null;
}

export function isDone(tierId, no) {
  const r = levelRecord(tierId, no);
  return !!(r && r.done);
}

export function isUnlocked(tierId, no) {
  if (no <= 1) return true;
  return isDone(tierId, no - 1);
}

export function recordLevel(tierId, no, score, total) {
  const t = tierState(tierId);
  const prev = t.levels[no];
  const best = prev ? Math.max(prev.best, score) : score;
  t.levels[no] = { done: true, best, total, at: Date.now() };
  save();
  return t.levels[no];
}

export function doneCount(tierId, maxNo) {
  let n = 0;
  for (let i = 1; i <= maxNo; i++) if (isDone(tierId, i)) n++;
  return n;
}

export function totalScore(tierId, maxNo) {
  let got = 0, max = 0;
  for (let i = 1; i <= maxNo; i++) {
    const r = levelRecord(tierId, i);
    if (r) { got += r.best; max += r.total; }
  }
  return { got, max };
}

export function getPrefs() { return load().prefs; }
export function setPref(k, v) { load().prefs[k] = v; save(); }

export function resetAll() {
  state = EMPTY();
  save();
}
