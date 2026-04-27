import { continueRender, delayRender, staticFile } from 'remotion'

let loaded = false
let loadingPromise: Promise<void> | null = null

export const loadFonts = (): Promise<void> => {
  if (loaded) return Promise.resolve()
  if (loadingPromise) return loadingPromise
  const handle = delayRender('font-load')
  loadingPromise = (async () => {
    const head = new FontFace('Amboqia', `url(${staticFile('Amboqia.otf')}) format('opentype')`)
    const body = new FontFace('AzoSans', `url(${staticFile('AzoSans-Medium.ttf')}) format('truetype')`)
    await Promise.all([head.load(), body.load()])
    document.fonts.add(head)
    document.fonts.add(body)
    loaded = true
  })().finally(() => continueRender(handle))
  return loadingPromise
}
