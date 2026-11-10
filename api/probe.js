// Temporary integration probe: fixed harmless prompt, no credentials or user input.
import chat from './chat.js';
export default function handler(req, res) {
  return chat({ method: 'POST', body: { messages: [{ role: 'user', content: 'Reply with exactly: Hello from Qwen.' }] } }, res);
}
