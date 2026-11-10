import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

test('chat sends conversation, displays plain text, recovers errors and resets', async () => {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.com' });
  globalThis.document = dom.window.document;
  class FakeWorker {
    constructor() { FakeWorker.instance = this; }
    postMessage(message) { this.lastMessage = structuredClone(message); }
    receive(data) { this.onmessage({ data }); }
    terminate() {}
  }
  globalThis.Worker = FakeWorker;
  await import('../src/main.js');
  const form = document.querySelector('#chat-form');
  const prompt = document.querySelector('#prompt');
  const send = document.querySelector('#send');
  const submit = () => form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  prompt.value = 'Hello'; submit();
  assert.deepEqual(FakeWorker.instance.lastMessage.messages, [{ role: 'user', content: 'Hello' }]);
  assert.equal(send.disabled, true);
  FakeWorker.instance.receive({ type: 'complete', text: '<img src=x onerror=alert(1)>' });
  assert.equal(document.querySelector('.message.assistant .message-content').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(document.querySelector('.message img'), null);
  assert.equal(send.disabled, false);
  prompt.value = 'Retry me'; submit();
  assert.equal(FakeWorker.instance.lastMessage.messages.length, 3);
  FakeWorker.instance.receive({ type: 'error', text: 'Device unavailable' });
  assert.equal(prompt.value, 'Retry me');
  assert.equal(document.querySelector('#status').textContent, 'Device unavailable');
  assert.equal(document.querySelectorAll('.message').length, 2);
  document.querySelector('#new-chat').click();
  assert.equal(document.querySelectorAll('.message').length, 0);
  assert.equal(document.querySelector('#welcome').hidden, false);
  dom.window.close();
});
