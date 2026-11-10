import { env, pipeline } from '@huggingface/transformers';
import { loadGenerator } from './backend.js';

env.allowLocalModels = false;
// SharedArrayBuffer is unavailable on many phones unless cross-origin isolated.
if (!self.crossOriginIsolated && env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;
const MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
let generator;
let backend;
const status = text => self.postMessage({ type: 'status', text });

self.onmessage = async ({ data }) => {
  try {
    if (data.type !== 'generate') return;
    if (!generator) {
      status('Loading Qwen. First use downloads several hundred MB…');
      ({ generator, backend } = await loadGenerator({
        gpu: navigator.gpu, createPipeline: pipeline, model: MODEL, status,
        progress: event => {
          if (event.status === 'progress' && typeof event.progress === 'number') {
            status(`Downloading model files… ${Math.round(event.progress)}% (current file)`);
          } else if (event.status === 'ready') {
            status('Model ready. Thinking…');
          }
        },
      }));
    }
    status(backend === 'wasm' ? 'Thinking on your phone’s CPU… this can take a while.' : 'Thinking…');
    const output = await generator(data.messages, { max_new_tokens: 128, do_sample: false });
    const generated = output?.[0]?.generated_text;
    const text = Array.isArray(generated) ? generated.at(-1)?.content : null;
    if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned an empty response. Please try again.');
    self.postMessage({ type: 'complete', text: text.trim() });
  } catch (error) {
    console.error('Qwen failed:', error);
    self.postMessage({ type: 'error', text: 'Qwen could not run on this device. Check your connection and available memory, then try again. Some phones cannot run this model.' });
  }
};
