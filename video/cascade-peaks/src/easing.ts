// Easing curves tuned for the video — cinematic quart in/out is the workhorse
// for camera moves; cubic out is for text pop-ins; elastic snap is used on HUD
// markers so they "land" on each peak during the intro pan.

export const clamp = (v: number, lo = 0, hi = 1): number =>
  Math.max(lo, Math.min(hi, v));

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

export const easeInOutQuart = (t: number): number => {
  t = clamp(t);
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
};

export const easeOutCubic = (t: number): number => {
  t = clamp(t);
  return 1 - Math.pow(1 - t, 3);
};

export const easeOutQuart = (t: number): number => {
  t = clamp(t);
  return 1 - Math.pow(1 - t, 4);
};

/** Elastic snap — good for HUD markers that should "land" with a tiny bounce. */
export const easeOutElastic = (t: number): number => {
  t = clamp(t);
  const c4 = (2 * Math.PI) / 3;
  if (t === 0) return 0;
  if (t === 1) return 1;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** 0 → 1 over [a, b]; outside the window, 0 before and 1 after. */
export const progress = (value: number, a: number, b: number): number =>
  clamp((value - a) / (b - a));

/** 0 → 1 → 0 triangle over [a, b] with peak at mid. */
export const pulse = (value: number, a: number, b: number): number => {
  const mid = (a + b) / 2;
  if (value < a || value > b) return 0;
  if (value <= mid) return progress(value, a, mid);
  return 1 - progress(value, mid, b);
};
