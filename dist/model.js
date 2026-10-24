import { PREFECTURES, REGIONS, MAX_COUNT } from './data.js';

export function emptyState() {
  return { version: 3, counts: Object.fromEntries(PREFECTURES.map(p => [p.id, 0])), multipliers: Object.fromEntries(REGIONS.map(r => [r.id, 1])), updatedAt: null };
}
export function validCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;
}
export function validMultiplier(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}
export function setPrefectureCount(state, prefectureId, count) {
  if (!PREFECTURES.some(p => p.id === prefectureId)) throw new Error('地図から都道府県を選択してください。');
  if (!validCount(count)) throw new Error(`回数は0〜${format(MAX_COUNT)}回の整数で指定してください。`);
  // This is a cumulative total, so saving twice never adds duplicate visits.
  state.counts[prefectureId] = count;
}
export function summarize(state) {
  const prefectures = PREFECTURES.map(p => ({ ...p, visits: state.counts[p.id], score: Math.round(state.counts[p.id] * state.multipliers[p.region] * 100) / 100 }));
  const regions = REGIONS.map(r => {
    const prefs = prefectures.filter(p => p.region === r.id);
    const visits = prefs.reduce((n, p) => n + p.visits, 0);
    return { ...r, visits, visited: prefs.filter(p => p.visits > 0).length, multiplier: state.multipliers[r.id], score: Math.round(visits * state.multipliers[r.id] * 100) / 100 };
  });
  return { prefectures, regions, visits: regions.reduce((n, r) => n + r.visits, 0), visited: prefectures.filter(p => p.visits > 0).length, score: Math.round(regions.reduce((n, r) => n + r.score, 0) * 100) / 100 };
}
export function parseState(raw) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!value || ![1, 2, 3].includes(value.version) || !value.multipliers) throw new Error('対応するバックアップファイルではありません。');
  const state = emptyState();
  const counts = value.version === 2 ? value.legacyCounts : value.counts;
  if (value.version !== 2 && (!counts || typeof counts !== 'object')) throw new Error('来訪回数のデータがありません。');
  for (const p of PREFECTURES) {
    const count = counts?.[p.id] ?? (value.version === 2 ? 0 : NaN);
    if (!validCount(count)) throw new Error(`${p.name}の回数が正しくありません。`);
    state.counts[p.id] = count;
  }
  // Older dated records become prefecture totals. Dates and reasons are no
  // longer part of the application state or exported backup format.
  if (value.version === 2) {
    if (!Array.isArray(value.visits) || value.visits.length > 100000) throw new Error('来訪記録のデータが正しくありません。');
    const ids = new Set();
    for (const visit of value.visits) {
      if (!visit || typeof visit.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(visit.id) || ids.has(visit.id)) throw new Error('来訪記録のIDが正しくありません。');
      if (!PREFECTURES.some(p => p.id === visit.prefectureId)) throw new Error('来訪記録の都道府県が正しくありません。');
      ids.add(visit.id);
      setPrefectureCount(state, visit.prefectureId, state.counts[visit.prefectureId] + 1);
    }
  }
  for (const r of REGIONS) {
    if (!Object.hasOwn(value.multipliers, r.id) || !validMultiplier(value.multipliers[r.id])) throw new Error(`${r.name}の倍率が正しくありません。`);
    state.multipliers[r.id] = value.multipliers[r.id];
  }
  state.updatedAt = typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null;
  return state;
}
export const format = number => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 }).format(number);
