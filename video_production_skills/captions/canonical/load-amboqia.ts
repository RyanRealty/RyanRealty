/**
 * load-amboqia — canonical helper for loading the Amboqia Boriango font
 * into a Remotion composition.
 *
 * Usage from a Remotion entry file (e.g. video/<project>/src/index.ts or
 * src/Root.tsx):
 *
 *   import './load-fonts' // import once at the top
 *
 * Then create video/<project>/src/load-fonts.ts:
 *
 *   import { loadAmboqia } from '../../../video_production_skills/captions/canonical/load-amboqia'
 *   loadAmboqia()
 *
 * Pre-requisite: copy the font file into the project's public/fonts/ before
 * the first render:
 *
 *   cp design_system/ryan-realty/fonts/Amboqia_Boriango.otf \
 *      video/<project>/public/fonts/Amboqia_Boriango.otf
 *
 * Without the font loaded, <SingleWordCaption> falls back to the default
 * serif and captions render incorrectly.
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
      document.fonts.add(loadedFont)
      continueRender(handle)
    })
    .catch((err) => {
      // Fail loud — caption renders without the brand font are a ship-blocker.
      // eslint-disable-next-line no-console
      console.error('[load-amboqia] FAILED to load Amboqia Boriango:', err)
      continueRender(handle)
    })
}
