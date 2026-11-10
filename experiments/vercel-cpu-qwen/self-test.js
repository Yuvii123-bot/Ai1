// A temporary, fixed-prompt experiment; never accepts user messages.
import { createHash, timingSafeEqual } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, rename, unlink } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MODEL_URL = 'https://huggingface.co/bartowski/Qwen2.5-0.5B-Instruct-GGUF/resolve/21ef23001f314d0895bd8439b08157c2d4cd9bb7/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf';
const MODEL_HASH = '6eb923e7d26e9cea28811e1a8e852009b21242fb157b26149d3b188f3a8c8653';
const MODEL_PATH = '/tmp/ai1-qwen25-q4.gguf';
let modelPromise;

function authorized(req) {
  const secret = process.env.AI1_SELF_TEST_SECRET;
  const supplied = typeof req.query?.key === 'string' ? req.query.key : '';
  if (!secret || !supplied) return false;
  const a = Buffer.from(secret); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function loadModel() {
  try { await access(MODEL_PATH); } catch {
    const temp = `${MODEL_PATH}.${process.pid}.download`;
    try {
      const response = await fetch(MODEL_URL, { signal: AbortSignal.timeout(180000) });
      if (!response.ok || !response.body) throw new Error(`Model download failed: HTTP ${response.status}`);
      const hash = createHash('sha256'); let bytes = 0;
      const verifier = new Transform({ transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > 420_000_000) return callback(new Error('Model exceeds size limit'));
        hash.update(chunk); callback(null, chunk);
      } });
      await pipeline(Readable.fromWeb(response.body), verifier, createWriteStream(temp));
      if (hash.digest('hex') !== MODEL_HASH) throw new Error('Model checksum mismatch');
      await rename(temp, MODEL_PATH);
    } finally { await unlink(temp).catch(() => {}); }
  }
  const { getLlama } = await import('node-llama-cpp');
  const llama = await getLlama({ gpu: false, build: 'never', skipDownload: true, maxThreads: 1 });
  const model = await llama.loadModel({ modelPath: MODEL_PATH, gpuLayers: 0 });
  return model;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' || !authorized(req)) return res.status(404).json({ error: 'Not found' });
  const start = Date.now();
  try {
    if (!modelPromise) modelPromise = loadModel().catch(error => { modelPromise = undefined; throw error; });
    const model = await modelPromise;
    const loaded = Date.now();
    const { LlamaChatSession } = await import('node-llama-cpp');
    const context = await model.createContext({ contextSize: 512, threads: 1 });
    try {
      const session = new LlamaChatSession({ contextSequence: context.getSequence() });
      const text = await session.prompt('What is 2 plus 2? Answer in one sentence.', { maxTokens: 32, temperature: 0 });
      return res.status(200).json({ model: 'Qwen2.5-0.5B-Instruct Q4_K_M', text, loadMs: loaded - start, totalMs: Date.now() - start, backend: 'Vercel CPU / llama.cpp' });
    } finally { await context.dispose(); }
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error), elapsedMs: Date.now() - start });
  }
}
