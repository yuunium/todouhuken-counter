import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, summarize, parseState, setPrefectureCount, validCount } from '../dist/model.js';
import { PREFECTURES, REGIONS, MAX_COUNT } from '../dist/data.js';

test('47 prefectures belong to exactly one region and start at zero', () => {
  const state = emptyState();
  assert.equal(PREFECTURES.length, 47);
  assert.equal(new Set(REGIONS.flatMap(r => r.ids)).size, 47);
  assert.equal(REGIONS.flatMap(r => r.ids).length, 47);
  assert.equal(summarize(state).visits, 0); assert.equal(summarize(state).visited, 0);
});
test('saving sets cumulative counts without duplicate addition and permits zero', () => {
  const state = emptyState(); setPrefectureCount(state,13,5); setPrefectureCount(state,13,5);
  assert.equal(summarize(state).visits,5); assert.equal(summarize(state).score,5);
  setPrefectureCount(state,13,2); assert.equal(summarize(state).visits,2);
  setPrefectureCount(state,13,0); assert.equal(summarize(state).visits,0); assert.equal(summarize(state).visited,0);
});
test('regional multipliers change scores while preserving visit counts', () => {
  const state = emptyState(); setPrefectureCount(state,13,5);setPrefectureCount(state,27,2);
  state.multipliers.kanto=1.5; state.multipliers.kinki=0.25;
  let result=summarize(state); assert.equal(result.visits,7);assert.equal(result.visited,2);assert.equal(result.score,8);
  assert.equal(result.prefectures[12].score,7.5); assert.equal(result.prefectures[26].score,0.5);
  assert.equal(result.regions.reduce((n,r)=>n+r.visits,0),result.visits);
  state.multipliers.kanto=0; result=summarize(state);assert.equal(result.score,0.5);assert.equal(result.visits,7);assert.equal(result.visited,2);
});
test('invalid counts and prefectures are rejected without altering counts', () => {
  const state=emptyState();
  for(const count of [-1,1.5,NaN,Infinity,'2',MAX_COUNT+1]) assert.throws(()=>setPrefectureCount(state,13,count));
  assert.throws(()=>setPrefectureCount(state,48,3)); assert.throws(()=>setPrefectureCount(state,null,3));
  assert.equal(state.counts[13],0); assert.ok(validCount(MAX_COUNT));setPrefectureCount(state,13,MAX_COUNT);
  assert.equal(state.counts[13],MAX_COUNT);
});
test('v2 dated records migrate into prefecture counts and discard dates and reasons', () => {
  const old={version:2,legacyCounts:{13:2},visits:[{id:'a',date:'2026-10-24',prefectureId:13,reasonId:'other'},{id:'b',date:'2026-10-25',prefectureId:13,reasonId:'solo'},{id:'c',date:'2026-10-25',prefectureId:27,reasonId:'release'}],multipliers:emptyState().multipliers};
  const migrated=parseState(old);assert.equal(migrated.version,3);assert.equal(migrated.counts[13],4);assert.equal(migrated.counts[27],1);
  assert.equal(summarize(migrated).visits,5);assert.equal(summarize(migrated).score,5);
  assert.equal(migrated.visits,undefined);assert.equal(migrated.legacyCounts,undefined);
  assert.ok(!JSON.stringify(migrated).includes('reasonId'));assert.ok(!JSON.stringify(migrated).includes('2026-10-24'));
});
test('v1 count backups retain counts and multipliers', () => {
  const state=emptyState();state.counts[47]=12;state.multipliers.kyushu=1.25;
  const migrated=parseState({...state,version:1});assert.equal(migrated.counts[47],12);assert.equal(summarize(migrated).score,15);
});
test('backup round trip rejects malformed counts, multipliers and duplicate old record IDs', () => {
  const state=emptyState();state.counts[13]=3;state.multipliers.kanto=1.75;
  assert.deepEqual(parseState(JSON.stringify(state)),state);
  assert.throws(()=>parseState({...state,counts:{13:3}}));
  assert.throws(()=>parseState({...state,counts:{...state.counts,13:-1}}));
  assert.throws(()=>parseState({...state,multipliers:{...state.multipliers,kanto:0.001}}));
  assert.throws(()=>parseState({...state,multipliers:{...state.multipliers,kanto:101}}));
  assert.throws(()=>parseState({version:2,multipliers:state.multipliers,visits:[{id:'a',prefectureId:13},{id:'a',prefectureId:13}]}));
  assert.throws(()=>parseState({version:2,multipliers:state.multipliers,visits:[{id:'a',prefectureId:99}]}));
});
test('decimal totals and resetting retain accurate scores and multiplier settings', () => {
  const state=emptyState();state.counts[13]=30;state.multipliers.kanto=0.1;assert.equal(summarize(state).score,3);
  state.counts=emptyState().counts;assert.equal(summarize(state).score,0);assert.equal(state.multipliers.kanto,0.1);
});
