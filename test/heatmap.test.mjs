import test from 'node:test';
import assert from 'node:assert/strict';
import {newHeatmap, updateDriver, expireDriver, heatmapTrace, validateHeatmapTrace} from '../lib/heatmap.mjs';

test('heatmap crossing conserves driver count and repeated reports do not inflate it', () => {
  const trace = heatmapTrace();
  assert.equal(validateHeatmapTrace(trace).status, 'passed');
  for (const state of [trace.initial, trace.moved, trace.repeated]) {
    assert.equal(Object.values(state.counts).reduce((a, b) => a + b, 0), 8);
  }
  assert.equal(Object.values(trace.expired.counts).reduce((a, b) => a + b, 0), 7);
  trace.moved.counts['0,0']++;
  assert.throws(() => validateHeatmapTrace(trace), /oracle/);
});

test('stale events and stale expiry cannot move or remove a newer driver state', () => {
  const state = newHeatmap();
  updateDriver(state, {id: 'D1', cell: '0,0', sequence: 1, time: 0});
  updateDriver(state, {id: 'D1', cell: '1,0', sequence: 2, time: 10});
  assert.equal(updateDriver(state, {id: 'D1', cell: '0,0', sequence: 1, time: 11}), false);
  assert.equal(updateDriver(state, {id: 'D1', cell: '1,0', sequence: 2, time: 12}), false);
  assert.equal(expireDriver(state, 'D1', 1, 30), false);
  assert.equal(expireDriver(state, 'D1', 2, 39), false);
  assert.equal(expireDriver(state, 'D1', 2, 40), true);
  assert.equal(expireDriver(state, 'D1', 2, 41), false);
  assert.equal(updateDriver(state, {id: 'D1', cell: '0,0', sequence: 1, time: 42}), false);
  assert.equal(updateDriver(state, {id: 'D1', cell: '0,0', sequence: 3, time: 43}), true);
  assert.equal(state.counts['0,0'], 1);
  assert.equal(state.counts['1,0'], 0);
});

test('heatmap rejects bad cells, clocks and sequences', () => {
  const state = newHeatmap();
  for (const event of [
    {id: 'D1', cell: 'no-cell', sequence: 1, time: 0},
    {id: 'D1', cell: '0,0', sequence: 1.5, time: 0},
    {id: 'D1', cell: '0,0', sequence: 1, time: -1},
  ]) assert.throws(() => updateDriver(state, event), /Invalid/);
});
