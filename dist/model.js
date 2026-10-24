import { PREFECTURES, REGIONS, REASONS } from './data.js';

export function emptyState() {
  return { version: 2, visits: [], legacyCounts: Object.fromEntries(PREFECTURES.map(p => [p.id, 0])), multipliers: Object.fromEntries(REGIONS.map(r => [r.id, 1])), updatedAt: null };
}
export function validMultiplier(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function validateVisit(visit) {
  if (!visit || typeof visit.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(visit.id)) throw new Error('記録のIDが正しくありません。');
  if (!validDate(visit.date)) throw new Error('日程を正しい年月日で入力してください。');
  if (!PREFECTURES.some(p => p.id === visit.prefectureId)) throw new Error('都道府県を選択してください。');
  if (!REASONS.some(r => r.id === visit.reasonId)) throw new Error('来訪理由を選択してください。');
  return { id: visit.id, date: visit.date, prefectureId: visit.prefectureId, reasonId: visit.reasonId };
}
// Records remain independent of scoring rules. All displays derive from this
// one aggregation; a region multiplier never mutates a visit or its reason.
export function summarize(state) {
  const prefectures = PREFECTURES.map(p => ({ ...p, visits: state.legacyCounts[p.id] || 0, basePoints: state.legacyCounts[p.id] || 0, reasons: Object.fromEntries(REASONS.map(r => [r.id, 0])) }));
  for (const visit of state.visits) {
    const p = prefectures[visit.prefectureId - 1];
    const reason = REASONS.find(r => r.id === visit.reasonId);
    p.visits++; p.basePoints += reason.points; p.reasons[reason.id]++;
  }
  prefectures.forEach(p => { p.score = Math.round(p.basePoints * state.multipliers[p.region] * 100) / 100; });
  const regions = REGIONS.map(r => {
    const prefs = prefectures.filter(p => p.region === r.id);
    const visits = prefs.reduce((n, p) => n + p.visits, 0);
    const basePoints = prefs.reduce((n, p) => n + p.basePoints, 0);
    return { ...r, visits, basePoints, visited: prefs.filter(p => p.visits > 0).length, multiplier: state.multipliers[r.id], score: Math.round(basePoints * state.multipliers[r.id] * 100) / 100 };
  });
  const reasons = REASONS.map(r => {
    const count = state.visits.filter(v => v.reasonId === r.id).length;
    const score = state.visits.filter(v => v.reasonId === r.id).reduce((n, v) => n + r.points * Math.round(state.multipliers[PREFECTURES[v.prefectureId - 1].region] * 100), 0) / 100;
    return { ...r, count, score };
  });
  return { prefectures, regions, reasons, visits: regions.reduce((n, r) => n + r.visits, 0), visited: prefectures.filter(p => p.visits > 0).length, score: Math.round(regions.reduce((n, r) => n + r.score, 0) * 100) / 100 };
}
export function parseState(raw) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!value || ![1, 2].includes(value.version) || !value.multipliers) throw new Error('対応するバックアップファイルではありません。');
  const state = emptyState();
  if (value.version === 1 && !value.counts) throw new Error('来訪回数のデータがありません。');
  const legacy = value.version === 1 ? value.counts : value.legacyCounts;
  for (const p of PREFECTURES) {
    const n = legacy?.[p.id] ?? 0;
    if (!Number.isInteger(n) || n < 0 || n > 9999) throw new Error(`${p.name}の回数が正しくありません。`);
    state.legacyCounts[p.id] = n;
  }
  if (value.version === 2) {
    if (!Array.isArray(value.visits) || value.visits.length > 100000) throw new Error('来訪記録のデータが正しくありません。');
    state.visits = value.visits.map(validateVisit);
    if (new Set(state.visits.map(v => v.id)).size !== state.visits.length) throw new Error('記録のIDが重複しています。');
  }
  for (const r of REGIONS) {
    if (!Object.hasOwn(value.multipliers, r.id) || !validMultiplier(value.multipliers[r.id])) throw new Error(`${r.name}の倍率が正しくありません。`);
    state.multipliers[r.id] = value.multipliers[r.id];
  }
  state.updatedAt = typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)) ? value.updatedAt : null;
  return state;
}
export const format = number => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 }).format(number);
