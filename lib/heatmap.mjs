export const heatmapSceneKinds = ['hook', 'cells', 'stream', 'move', 'repeat', 'expiry', 'heat', 'h3', 'scale', 'challenge'];
export const cells = [];
for (let q = -2; q <= 2; q++) {
  for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) {
    cells.push({id: `${q},${r}`, q, r, x: 380 + Math.sqrt(3) * 50 * (q + r / 2), y: 205 + 75 * r});
  }
}

export function newHeatmap() {
  return {time: 0, drivers: {}, counts: Object.fromEntries(cells.map((c) => [c.id, 0]))};
}

export function updateDriver(state, {id, cell, sequence, time}, ttl = 30) {
  if (!id || !Object.hasOwn(state.counts, cell) || !Number.isInteger(sequence) || sequence < 1 ||
      !Number.isFinite(time) || time < state.time || !Number.isFinite(ttl) || ttl <= 0) throw new Error('Invalid driver update.');
  state.time = time;
  const old = state.drivers[id];
  if (old && sequence <= old.sequence) return false;
  if (old?.active) state.counts[old.cell]--;
  state.counts[cell]++;
  state.drivers[id] = {cell, sequence, expiresAt: time + ttl, active: true};
  return true;
}

export function expireDriver(state, id, sequence, time) {
  if (!Number.isFinite(time) || time < state.time) throw new Error('Invalid expiry time.');
  state.time = time;
  const driver = state.drivers[id];
  if (!driver?.active || driver.sequence !== sequence || driver.expiresAt > time) return false;
  driver.active = false;
  state.counts[driver.cell]--;
  return true;
}

export function heatmapTrace() {
  const state = newHeatmap();
  for (const [i, cell] of ['0,0', '0,0', '0,0', '1,0', '-1,1', '0,-1', '-1,0', '1,-1'].entries()) {
    updateDriver(state, {id: `D${i + 1}`, cell, sequence: 1, time: 0});
  }
  const initial = structuredClone(state);
  updateDriver(state, {id: 'D1', cell: '1,0', sequence: 2, time: 1});
  const moved = structuredClone(state);
  for (let sequence = 3; sequence <= 5; sequence++) updateDriver(state, {id: 'D1', cell: '1,0', sequence, time: sequence - 1});
  const repeated = structuredClone(state);
  for (let i = 2; i <= 8; i++) updateDriver(state, {id: `D${i}`, cell: state.drivers[`D${i}`].cell, sequence: 2, time: 20});
  const beforeExpiry = structuredClone(state);
  expireDriver(state, 'D1', 5, 34);
  return {initial, moved, repeated, beforeExpiry, expired: structuredClone(state)};
}

export function validateHeatmapTrace(trace = heatmapTrace()) {
  for (const state of Object.values(trace)) {
    const expected = Object.fromEntries(cells.map((c) => [c.id, 0]));
    for (const driver of Object.values(state.drivers)) if (driver.active) expected[driver.cell]++;
    if (JSON.stringify(expected) !== JSON.stringify(state.counts)) throw new Error('Heatmap counts disagree with active-driver oracle.');
    if (Object.values(state.counts).some((n) => !Number.isInteger(n) || n < 0)) throw new Error('Invalid cell count.');
  }
  if (trace.initial.counts['0,0'] !== 3 || trace.moved.counts['0,0'] !== 2 ||
      trace.moved.counts['1,0'] !== 2 || trace.repeated.counts['1,0'] !== 2 ||
      trace.expired.counts['1,0'] !== 1) throw new Error('Heatmap story transition mismatch.');
  return {status: 'passed', independentOracle: 'active-driver recount', snapshots: Object.keys(trace).length};
}
