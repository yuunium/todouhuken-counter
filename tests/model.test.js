import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, summarize, parseState, validateVisit, validDate } from '../dist/model.js';
import { PREFECTURES, REGIONS } from '../dist/data.js';
const visit = (id, prefectureId, reasonId, date = '2026-10-25') => ({ id, date, prefectureId, reasonId });
test('47 prefectures belong to exactly one region', () => {
  assert.equal(PREFECTURES.length, 47);
  assert.equal(new Set(REGIONS.flatMap(r => r.ids)).size, 47);
  assert.equal(REGIONS.flatMap(r => r.ids).length, 47);
});
test('reason counts, prefecture totals and regional multipliers all agree', () => {
  const state = emptyState();
  state.visits = [visit('a',13,'solo'),visit('b',13,'release'),visit('c',27,'festival'),visit('d',13,'release')];
  state.multipliers.kanto = 1.5;
  let result = summarize(state);
  assert.equal(result.visits, 4); assert.equal(result.visited, 2);
  assert.equal(result.prefectures[12].visits, 3); assert.equal(result.prefectures[12].score, 13.5);
  assert.equal(result.prefectures[26].score, 3); assert.equal(result.score, 16.5);
  assert.equal(result.reasons.find(r => r.id === 'release').count, 2);
  assert.equal(result.reasons.find(r => r.id === 'release').score, 12);
  assert.equal(result.reasons.reduce((n,r) => n + r.score, 0), result.score);
  state.multipliers.kanto = 0;
  result = summarize(state); assert.equal(result.score, 3); assert.equal(result.visits, 4);
  assert.equal(state.visits[1].reasonId, 'release');
});
test('every reason uses the points in the reference image', () => {
  const state = emptyState();
  state.visits = ['solo','special','festival','release','other'].map((r,i) => visit(`a${i}`,1,r));
  const result = summarize(state); assert.equal(result.score, 15); assert.equal(result.visits, 5);
});
test('editing and deleting a dated visit recomputes both views', () => {
  const state = emptyState(); state.visits = [visit('a',13,'other')];
  state.visits[0] = visit('a',27,'special','2024-02-29');
  let result = summarize(state); assert.equal(result.score, 2); assert.equal(result.prefectures[12].visits, 0); assert.equal(result.prefectures[26].visits, 1);
  state.visits = []; result = summarize(state); assert.equal(result.score, 0); assert.equal(result.visits, 0);
});
test('real calendar dates, valid prefectures and reasons are required', () => {
  assert.ok(validDate('2024-02-29')); assert.ok(!validDate('2026-02-29')); assert.ok(!validDate('2026-04-31')); assert.ok(!validDate('2026-13-01')); assert.ok(!validDate('1899-01-01'));
  assert.throws(() => validateVisit(visit('a',48,'solo'))); assert.throws(() => validateVisit(visit('a',1,'unknown')));
  assert.throws(() => validateVisit(visit('<script>',1,'solo')));
});
test('backup round trip validates records and rejects duplicate IDs or invalid multipliers', () => {
  const state = emptyState(); state.visits = [visit('a',13,'other')]; state.multipliers.kanto = 0.25;
  assert.deepEqual(parseState(JSON.stringify(state)), state);
  assert.throws(() => parseState({ ...state, visits:[...state.visits,...state.visits] }));
  assert.throws(() => parseState({ ...state, multipliers: { ...state.multipliers, kanto: -1 } }));
  assert.throws(() => parseState({ ...state, multipliers: { ...state.multipliers, kanto: 0.001 } }));
});
test('old counts remain explicitly undated, rather than inventing events', () => {
  const old = { version:1, counts:Object.fromEntries(PREFECTURES.map(p=>[p.id,p.id===13?4:0])), multipliers:emptyState().multipliers };
  const migrated = parseState(old); assert.equal(migrated.visits.length,0); assert.equal(migrated.legacyCounts[13],4); assert.equal(summarize(migrated).score,4);
});
test('decimal scores use integer cents without accumulated floating point error', () => {
  const state=emptyState(); state.visits=Array.from({length:30},(_,i)=>visit(`a${i}`,13,'solo'));state.multipliers.kanto=0.1;
  assert.equal(summarize(state).score,3); assert.equal(summarize(state).reasons[0].score,3);
});
