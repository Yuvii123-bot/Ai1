import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBackend, loadGenerator } from '../src/backend.js';

test('selects CPU when GPU is absent or unavailable', async () => {
  assert.equal(await selectBackend(undefined), 'wasm');
  assert.equal(await selectBackend({ requestAdapter: async () => null }), 'wasm');
  assert.equal(await selectBackend({ requestAdapter: async () => { throw new Error('no adapter'); } }), 'wasm');
  assert.equal(await selectBackend({ requestAdapter: async () => ({}) }), 'webgpu');
});

test('loads CPU model on devices without GPU', async () => {
  const calls = [];
  const result = await loadGenerator({gpu: null, model: 'qwen', createPipeline: async (...args) => { calls.push(args); return 'model'; }, progress: () => {}, status: () => {}});
  assert.equal(result.backend, 'wasm');
  assert.equal(result.generator, 'model');
  assert.equal(calls[0][2].dtype, 'q4');
  assert.equal(calls[0][2].device, 'wasm');
});

test('tries CPU after GPU model initialization fails', async () => {
  const calls = [], statuses = [];
  const result = await loadGenerator({gpu: {requestAdapter: async () => ({})}, model: 'qwen', createPipeline: async (task, model, options) => { calls.push(options.device); if (options.device === 'webgpu') throw new Error('GPU failed'); return 'cpu-model'; }, progress: () => {}, status: text => statuses.push(text)});
  assert.deepEqual(calls, ['webgpu', 'wasm']);
  assert.equal(result.generator, 'cpu-model');
  assert.match(statuses[0], /CPU/);
});
