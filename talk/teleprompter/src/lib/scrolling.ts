export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function computePixelsPerSecond(
  scrollablePixels: number,
  targetMinutes: number,
  speedMultiplier: number,
) {
  const seconds = Math.max(targetMinutes, 1) * 60;
  return (scrollablePixels / seconds) * speedMultiplier;
}

export function estimateProgressPercent(scrollTop: number, scrollHeight: number, clientHeight: number) {
  const max = Math.max(scrollHeight - clientHeight, 1);
  return Math.round(clamp((scrollTop / max) * 100, 0, 100));
}
