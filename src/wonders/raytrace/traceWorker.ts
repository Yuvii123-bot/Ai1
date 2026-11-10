/// <reference lib="webworker" />
import { renderTile, RenderOpts } from './trace';

self.onmessage = (e: MessageEvent) => {
  const opts = e.data as RenderOpts;
  const data = renderTile(opts);
  (self as any).postMessage({ rows: opts.rowEnd - opts.rowStart, rowStart: opts.rowStart, width: opts.width, data }, [data.buffer]);
};
