const ENDPOINT = 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions';
const MODEL = 'Qwen3.5-9B';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST to send a message.' });
  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 12 ||
      messages.at(-1)?.role !== 'user' || messages.some(m => !m || !['user', 'assistant'].includes(m.role) ||
        typeof m.content !== 'string' || !m.content.trim() || m.content.length > 12000) ||
      messages.reduce((sum, m) => sum + m.content.length, 0) > 24000) {
    return res.status(400).json({ error: 'Invalid or oversized conversation. Please start a new chat.' });
  }
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages: messages.map(({ role, content }) => ({ role, content })), max_tokens: 768, stream: false, chat_template_kwargs: { enable_thinking: false } }),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) {
      if (response.status === 429) return res.status(429).json({ error: 'The free Qwen service is busy or rate-limited. Please wait a minute and try again.' });
      return res.status(502).json({ error: `The Qwen provider is unavailable (HTTP ${response.status}). Please try again later.` });
    }
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return res.status(502).json({ error: 'Qwen returned an empty response. Please try again.' });
    return res.status(200).json({ text });
  } catch {
    return res.status(502).json({ error: 'Could not reach the Qwen provider. Please try again.' });
  }
}
