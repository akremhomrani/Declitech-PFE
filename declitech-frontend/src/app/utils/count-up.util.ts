export interface CountUpHandle {
  cancel(): void;
}

export function countUpInt(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (v: number) => void
): CountUpHandle {
  return run(from, to, durationMs, onUpdate, false);
}

export function countUpFloat(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (v: number) => void
): CountUpHandle {
  return run(from, to, durationMs, onUpdate, true);
}

function run(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (v: number) => void,
  decimal: boolean
): CountUpHandle {
  let cancelled = false;
  let raf = 0;
  const start = performance.now();
  const tick = (now: number): void => {
    if (cancelled) return;
    const p = Math.min((now - start) / durationMs, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    const value = from + (to - from) * ease;
    onUpdate(decimal ? Math.round(value * 10) / 10 : Math.round(value));
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    }
  };
}
