import { env, pipeline } from '@huggingface/transformers';

env.allowLocalModels = false;
const MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
let generator;

self.onmessage = async ({ data }) => {
  try {
    if (data.type !== 'generate') return;
    if (!navigator.gpu) throw new Error('WebGPU is not available. Try an up-to-date Chrome or Edge browser on a computer with WebGPU enabled.');
    if (!generator) {
      self.postMessage({ type: 'status', text: 'Downloading Qwen for the first time…' });
      generator = await pipeline('text-generation', MODEL, {
        device: 'webgpu', dtype: 'q4',
        progress_callback: (event) => {
          if (event.status === 'progress' && typeof event.progress === 'number') {
            self.postMessage({ type: 'status', text: `Downloading model files… ${Math.round(event.progress)}% (current file)` });
          } else if (event.status === 'ready') {
            self.postMessage({ type: 'status', text: 'Model ready. Thinking…' });
          }
        },
      });
    }
    self.postMessage({ type: 'status', text: 'Thinking…' });
    const output = await generator(data.messages, { max_new_tokens: 256, do_sample: false });
    const generated = output?.[0]?.generated_text;
    const text = Array.isArray(generated) ? generated.at(-1)?.content : null;
    if (typeof text !== 'string' || !text.trim()) throw new Error('The model returned an empty response. Please try again.');
    self.postMessage({ type: 'complete', text: text.trim() });
  } catch (error) {
    self.postMessage({ type: 'error', text: error?.message || 'Something went wrong while running Qwen.' });
  }
};
