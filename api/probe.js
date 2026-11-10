// Temporary fixed-prompt integration test.
import chat from './chat.js';
export default function handler(req, res) {
  return chat({ method: 'POST', body: { messages: [{ role: 'user', content: 'Reply with exactly: Hello from Qwen.' }] } }, res);
}
