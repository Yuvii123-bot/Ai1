import { test } from 'node:test';
import assert from 'node:assert/strict';
import chat from '../api/chat.js';
function res() { return { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
test('API validates input and proxies only bounded Qwen messages', async () => {
  const valid = { method: 'POST', body: { messages: [{role:'user', content:'Hello', extra:'discard'}] } };
  let r = res(); await chat({ method: 'GET' }, r); assert.equal(r.code, 405);
  r = res(); await chat({ method: 'POST', body: { messages: [{role:'system',content:'x'}] } }, r); assert.equal(r.code, 400);
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    assert.match(url, /ovh\.net/); assert.equal(body.model, 'Qwen3.5-9B');
    assert.deepEqual(body.messages, [{role:'user',content:'Hello'}]);
    return { ok: true, json: async () => ({ choices: [{ message: {content:'Hi!'} }] }) };
  };
  r = res(); await chat(valid, r); assert.equal(r.code, 200); assert.equal(r.body.text, 'Hi!');
  globalThis.fetch = async () => ({ ok: false, status: 429 });
  r = res(); await chat(valid, r); assert.equal(r.code, 429); assert.match(r.body.error, /rate-limited/);
});
