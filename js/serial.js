// A physical knob over Web Serial (Chrome and Edge on desktop).
// The Arduino sketch in hardware/static_knob sends lines like "K 512" (potentiometer 0-1023)
// and "B 1" when its button is pressed.

export const serialSupported = () => "serial" in navigator && window.isSecureContext;

export async function connectKnob({ onPosition, onButton, onClose }) {
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  const decoder = new TextDecoderStream();
  const done = port.readable.pipeTo(decoder.writable).catch(() => {});
  const reader = decoder.readable.getReader();
  let buffer = "";
  let smooth = null;
  (async () => {
    try {
      for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buffer += value;
        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          const [kind, num] = line.split(/\s+/);
          const v = Number(num);
          if (kind === "K" && isFinite(v)) {
            smooth = smooth === null ? v : smooth * 0.7 + v * 0.3;
            onPosition(Math.min(1, Math.max(0, smooth / 1023)));
          } else if (kind === "B" && v === 1) {
            onButton && onButton();
          }
        }
      }
    } finally {
      reader.releaseLock();
      await done;
      try { await port.close(); } catch (e) { /* already closed */ }
      onClose && onClose();
    }
  })();
  return {
    async disconnect() {
      try { await reader.cancel(); } catch (e) { /* ignore */ }
    },
  };
}
