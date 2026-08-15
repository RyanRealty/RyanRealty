/**
 * load-fonts — legacy shim.
 *
 * Previous version imported the canonical loadAmboqia() from
 * video_production_skills/captions/canonical/load-amboqia. That loader
 * hung inside Chromium during render (fetch never resolved, delayRender
 * timed out at 118s). Reverted to a no-op — the project's own
 * src/fonts.ts::loadFonts() (invoked from EvergreenExplainer +
 * EvergreenMasterclass) already loads Amboqia + AzoSans from
 * public/ root using the same FontFace pattern with proper error handling.
 */
export function noop(): void {
  // intentionally empty
}
