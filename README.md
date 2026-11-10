# Ai1 — chat with Qwen

Ai1 is a mobile-friendly chat interface using **Qwen3.5-9B** on [OVHcloud AI Endpoints](https://help.ovhcloud.com/csm/en-public-cloud-ai-endpoints-getting-started?id=kb_article_view&sysparm_article=KB0065403). A Vercel serverless function sends requests to OVHcloud, so your phone does not download or run the model. Anonymous access requires no API key. OVHcloud documents a limit of **2 requests per minute per IP per model**; Vercel's outbound IPs may be shared, so it can be less reliable than that and may return 429 errors. Availability, model selection and anonymous terms may change. This is not a guaranteed service. The anonymous service does not use an OVHcloud account or paid API key, but Vercel's own hosting usage limits still apply.

**Privacy:** Conversation history is held in the browser tab and disappears on reload. The most recent messages are sent through Vercel to OVHcloud for inference. OVHcloud describes its [data handling](https://help.ovhcloud.com/csm/en-public-cloud-ai-endpoints-capabilities?id=kb_article_view&sysparm_article=KB0065421); do not send secrets or sensitive information without reviewing the providers' policies. The public API is not authenticated, so other people can use it and exhaust its shared anonymous allowance. Consider deployment protection for private use. The backend restricts request size and output tokens, but does not provide a distributed rate limiter.

## Local development

Requires Node.js 20+. Run:

```sh
npm ci
npm run dev
```

Open the displayed URL. The development server exposes the same `/api/chat` function and needs internet access to OVHcloud. `npm test` runs mocked tests, and `npm run build` builds the frontend. Vercel deploys the frontend and `api/chat.js` automatically; no API keys or environment variables are needed. Enter sends, Shift+Enter adds a line, and **New conversation** clears the tab.

## Alternative: local Ollama server

The previous Python/Ollama version remains in `app/`. Install [Ollama](https://ollama.com/download), start it and run `ollama pull qwen2.5:0.5b`. Then:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ./upstream/ollama-python
python app/server.py
```

Open http://127.0.0.1:8000. Set `AI1_MODEL` or `OLLAMA_HOST` to change its configuration. The Python app has no authentication; do not expose it to an untrusted network. Its mock tests run with `python -m unittest discover -s tests -v`.

## Upstream and licensing

Qwen and dependencies retain their respective licenses. `upstream/ollama-python` is a vendored snapshot of [ollama/ollama-python](https://github.com/ollama/ollama-python) at commit `35d9667e84ebbd9d792826868d050027f75c1cc1`, under its [MIT license](upstream/ollama-python/LICENSE). Its `pyproject.toml` has a fallback version for installation without upstream Git history. It is a source snapshot, not a GitHub fork.
