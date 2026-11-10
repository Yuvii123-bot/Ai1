import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/self-test.js';
const makeRes = () => ({ setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
test('the experiment is inaccessible without its configured test secret', async () => {
  delete process.env.AI1_SELF_TEST_SECRET;
  let res = makeRes(); await handler({ method: 'GET', query: { key: 'anything' } }, res); assert.equal(res.code, 404);
  process.env.AI1_SELF_TEST_SECRET = 'not-a-real-secret';
  res = makeRes(); await handler({ method: 'GET', query: { key: 'wrong' } }, res); assert.equal(res.code, 404);
  res = makeRes(); await handler({ method: 'POST', query: { key: 'not-a-real-secret' } }, res); assert.equal(res.code, 404);
  delete process.env.AI1_SELF_TEST_SECRET;
});
