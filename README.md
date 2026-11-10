# Ai1 — chat with Qwen

Ai1 is a browser chat interface for **Qwen2.5 0.5B Instruct**. The Vercel-compatible version runs a quantized copy of the model **on your device**, using [Transformers.js](https://github.com/huggingface/transformers.js) with WebGPU when available and a WebAssembly CPU fallback; it doesn't need an AI API key or a model server. The app code is in this repository; the model weights are not committed to Git. On first use, the browser downloads them from [Hugging Face](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct) (hundreds of MB). Allow time, internet and storage; the browser may cache the files for later use. Downloading contacts Hugging Face, but prompts and generated replies are processed in your browser, not sent to an inference API. Conversation history is kept only in the current tab and is lost on reload.

## Run the browser app

Requires Node.js 20+ for development and a recent browser with WebAssembly support. WebGPU is used when available; otherwise the app tries CPU inference, which can be much slower. Some phones and private browsing modes may lack enough memory or storage to run/cache the model, and browser support varies. If initialization fails, the interface displays an error and allows retrying. This small model can make mistakes and is less capable than large hosted models.

```sh
npm ci
npm run dev
```

Open the displayed local URL, type a message and send it. The first message starts the model download and can take several minutes. Enter sends; Shift+Enter starts a new line. Click **New conversation** to clear the tab's history. The model runs in a Web Worker to keep the interface responsive.

`.npmrc` disables dependency install scripts: the app uses the browser runtime, not the optional native Node inference runtime. Run `npm test` for interface tests and `npm run build` to create `dist/`.

## Vercel

Import the GitHub repository into a **new** Vercel project and select the `arena/d94d03c3-ai1` branch for the initial deployment. Vercel reads `vercel.json`, installs dependencies, runs `npm run build` and serves `dist/`. No environment variables or API keys are needed. Open the generated HTTPS deployment URL in a recent browser. Vercel hosts only the app and runtime assets; it does not host or run the model. The model downloads to and runs on the visitor's device.

## Alternative: local Ollama server

The previous Python/Ollama version remains in `app/`. Install [Ollama](https://ollama.com/download) and start it, then run `ollama pull qwen2.5:0.5b`. From this folder:

```sh
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install -e ./upstream/ollama-python
python app/server.py
```

Open http://127.0.0.1:8000. Set `AI1_MODEL` to change the default, or `OLLAMA_HOST` to point at another Ollama instance. If the host points to another machine, conversation data goes there. The Python app has no authentication; do not expose it to an untrusted network. Its mock tests run with `python -m unittest discover -s tests -v`.

## Upstream and licensing

The browser app uses the ONNX conversion of [Qwen2.5 0.5B Instruct](https://huggingface.co/onnx-community/Qwen2.5-0.5B-Instruct) by onnx-community and [Transformers.js](https://github.com/huggingface/transformers.js). Model and dependencies retain their respective licenses. `upstream/ollama-python` is a vendored snapshot of [ollama/ollama-python](https://github.com/ollama/ollama-python) at commit `35d9667e84ebbd9d792826868d050027f75c1cc1`, under its [MIT license](upstream/ollama-python/LICENSE). Its `pyproject.toml` has a fallback version for installation without upstream Git history. It is a source snapshot, not a GitHub fork.
