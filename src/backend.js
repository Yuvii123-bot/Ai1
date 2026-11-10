/** Select a browser inference backend, preferring a usable WebGPU adapter. */
export async function selectBackend(gpu) {
  if (gpu) {
    try {
      if (await gpu.requestAdapter()) return 'webgpu';
    } catch {
      // Some browsers expose WebGPU but cannot initialize a compatible adapter.
    }
  }
  return 'wasm';
}

/** Try GPU first where available, falling back to CPU if initialization fails. */
export async function loadGenerator({ gpu, createPipeline, model, progress, status }) {
  const backend = await selectBackend(gpu);
  const load = device => createPipeline('text-generation', model, {
    device, dtype: 'q4', progress_callback: progress,
  });
  if (backend === 'webgpu') {
    try {
      return { generator: await load('webgpu'), backend: 'webgpu' };
    } catch (error) {
      console.warn('WebGPU initialization failed; trying CPU:', error);
      status('GPU unavailable. Trying slower CPU mode…');
    }
  }
  return { generator: await load('wasm'), backend: 'wasm' };
}
