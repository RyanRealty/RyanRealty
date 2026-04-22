// Runtime config — API keys and tunables. Remotion bundles this into the
// browser bundle, so DO NOT put anything here that shouldn't ship to the
// rendering Chromium. The Google Maps key is domain-restricted and scoped
// to Photorealistic 3D Tiles; safe to embed for internal render pipeline.

// Remotion passes `REMOTION_*` into the render bundle. Also accept the site
// key name when sourcing env from the repo root `.env.local`.
const fromEnv =
  (typeof process !== 'undefined' &&
    (process.env.REMOTION_GOOGLE_MAPS_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)) ||
  '';

export const GOOGLE_MAPS_KEY = String(fromEnv).trim();

// Video canvas / timing
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

// Scene durations (in seconds)
export const OPENING_CARD_SEC = 3.2;
export const AUBREY_PAN_SEC = 8.0;
export const PER_PEAK_SEC = 8.5; // Matt wants all facts readable, no rush
export const CLOSING_CARD_SEC = 3.2;

// Derived totals
export const PEAK_COUNT = 10;
export const TOTAL_SEC =
  OPENING_CARD_SEC +
  AUBREY_PAN_SEC +
  PER_PEAK_SEC * PEAK_COUNT +
  CLOSING_CARD_SEC;

export const TOTAL_FRAMES = Math.round(TOTAL_SEC * FPS);
