export default async function handler(req, res) {
  try {
    const response = await fetch('https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({model:'Qwen3.5-9B', messages:[{role:'user',content:'Reply with exactly: Hello from Qwen.'}], max_tokens: 768, stream:false, reasoning_effort:"none"}),
      signal: AbortSignal.timeout(45000)
    });
    return res.status(200).json({ providerStatus: response.status, providerResponse: await response.text() });
  } catch (error) { return res.status(200).json({ error: String(error) }); }
}
