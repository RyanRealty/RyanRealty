import { continueRender, delayRender, staticFile } from 'remotion'

// Try to load Amboqia for headlines and Geist (or AzoSans fallback) for body.
// All optional — fallback chain in brand.ts means rendering still works without
// these files. Symlinked from /workspace/video/market-report/public/fonts at
// scaffold time so we don't duplicate font binaries.

let loaded = false
let loadingPromise: Promise<void> | null = null

async function tryLoad(family: string, urlPath: string, format: string): Promise<void> {
  try {
    const face = new FontFace(family, `url(${staticFile(urlPath)}) format('${format}')`)
    await face.load()
    // FontFaceSet#add exists in browsers but the lib.dom typings drop it; cast.
    ;(document.fonts as unknown as { add: (f: FontFace) => void }).add(face)
  } catch {
    // ignore — fallback chain handles it
  }
}

export const loadFonts = (): Promise<void> => {
  if (loaded) return Promise.resolve()
  if (loadingPromise) return loadingPromise
  const handle = delayRender('font-load')
  loadingPromise = (async () => {
    // staticFile() expects paths relative to public/, no leading "public/" prefix.
    // Mirror video/market-report — fonts live at public/ root, not in a subdirectory.
    await Promise.all([
      tryLoad('Amboqia', 'Amboqia_Boriango.otf', 'opentype'),
      tryLoad('AzoSans', 'AzoSans-Medium.ttf', 'truetype'),
    ])
    loaded = true
  })().finally(() => continueRender(handle))
  return loadingPromise
}
