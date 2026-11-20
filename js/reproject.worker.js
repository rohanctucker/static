// Reprojects one survey image off the main thread, so tuning stays smooth while it works.
import { reprojectAllsky } from "./hipsproj.js";

self.onmessage = (e) => {
  const { id, buffer, width, height, frame, outW, outH } = e.data;
  try {
    const res = reprojectAllsky({ data: new Uint8ClampedArray(buffer), width, height }, frame, outW, outH, 2);
    self.postMessage({ id, ok: true, buffer: res.data.buffer, means: res.means, gray: res.gray }, [res.data.buffer]);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
