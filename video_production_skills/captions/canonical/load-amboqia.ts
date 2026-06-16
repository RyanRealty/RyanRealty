/**
 * load-amboqia — CANONICAL helper for loading the Amboqia Boriango brand
 * display font into a Remotion composition. This is the path referenced by
 * CLAUDE.md §captions and imported by per-project load-fonts.ts files
 * (e.g. listing_video_v4/src/load-fonts.ts).
 *
 * Usage:
 *   // video/<project>/src/load-fonts.ts
 *   import { loadAmboqia } from '../../video_production_skills/captions/canonical/load-amboqia'
 *   loadAmboqia()
 *
 * Pre-requisite: the project's public/fonts/Amboqia_Boriango.otf must exist:
 *   cp design_system/ryan-realty/fonts/Amboqia_Boriango.otf \
 *      <project>/public/fonts/Amboqia_Boriango.otf
 *
 * Without the font loaded, single-word captions fall back to the default
 * serif and render incorrectly — a ship-blocker.
 */

import { continueRender, delayRender, staticFile } from 'remotion'

let loaded = false

export function loadAmboqia(): void {
  if (loaded) return
  loaded = true
  const handle = delayRender('Loading Amboqia Boriango')
  const font = new FontFace(
    'Amboqia Boriango',
    `url(${staticFile('fonts/Amboqia_Boriango.otf')}) format('opentype')`,
    { weight: '400', style: 'normal' },
  )
  font
    .load()
    .then((loadedFont) => {
      ;(document.fonts as unknown as { add(face: FontFace): void }).add(loadedFont)
      continueRender(handle)
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[load-amboqia] FAILED to load Amboqia Boriango:', err)
      continueRender(handle)
    })
}
