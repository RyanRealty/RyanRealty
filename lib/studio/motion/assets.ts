/**
 * Fonts and images for the type layer, inlined as data URIs so the page is
 * self-contained: nothing loads over the network mid-render, which is how the
 * old Remotion render of Cascade Peaks died (a Google Fonts link that never
 * resolved in headless Chromium).
 *
 * Sources, read from disk. next.config.ts traces MOTION_ASSET_FILES into the
 * two functions that run the Studio (the /admin/studio page and the
 * studio-slate cron), the way the market report traces its own list.
 *   Geist               node_modules/geist (the site's font package)
 *   Amboqia Boriango    public/fonts, plus the capital-I patch: the face draws
 *                       "I" as a "1", and app/globals.css routes U+0049 to a
 *                       548-byte patch face (amboqia-i-patch.woff2)
 *   Azo Sans Medium     public/fonts, eyebrows only
 *   wordmark            public/brand/logo-horizontal-navy.png (navy ink,
 *                       transparent), never re-typeset
 *
 * Broker headshots live under public/images, which every function excludes,
 * so on Vercel they come from the live site instead of the disk.
 */
import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const MOTION_ASSET_FILES = {
  amboqia: 'public/fonts/Amboqia_Boriango.otf',
  amboqiaI: 'public/fonts/amboqia-i-patch.woff2',
  azo: 'public/fonts/AzoSans-Medium.ttf',
  geist400: 'node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2',
  geist500: 'node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2',
  geist600: 'node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2',
  wordmark: 'public/brand/logo-horizontal-navy.png',
} as const

export type MotionFonts = Record<'amboqia' | 'amboqiaI' | 'azo' | 'geist400' | 'geist500' | 'geist600', string>

export type MotionAssets = {
  fonts: MotionFonts
  wordmark: string
  /** Data URI per site-relative headshot path the plan asked for. */
  headshots: Record<string, string>
}

const SITE = 'https://ryan-realty.com'

const MIME: Record<string, string> = {
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
}

function mimeFor(file: string): string {
  return MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

async function fromDisk(file: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), file))
  } catch {
    return null
  }
}

/** A public/ file from disk, or from the live site when this bundle lacks it. */
async function publicFile(file: string): Promise<Buffer> {
  const local = await fromDisk(file)
  if (local) return local
  if (!file.startsWith('public/')) throw new Error(`Motion asset missing: ${file}`)
  const res = await fetch(`${SITE}/${file.slice('public/'.length)}`, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Motion asset ${file} unavailable: HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function dataUri(file: string): Promise<string> {
  const bytes = await publicFile(file)
  return `data:${mimeFor(file)};base64,${bytes.toString('base64')}`
}

let fontsAndMark: Promise<{ fonts: MotionFonts; wordmark: string }> | null = null

/** Load everything a plan needs. Fonts and the wordmark load once per instance. */
export async function loadMotionAssets(headshotPaths: string[] = []): Promise<MotionAssets> {
  if (!fontsAndMark) {
    const f = MOTION_ASSET_FILES
    fontsAndMark = Promise.all([
      dataUri(f.amboqia),
      dataUri(f.amboqiaI),
      dataUri(f.azo),
      dataUri(f.geist400),
      dataUri(f.geist500),
      dataUri(f.geist600),
      dataUri(f.wordmark),
    ]).then(([amboqia, amboqiaI, azo, geist400, geist500, geist600, wordmark]) => ({
      fonts: { amboqia, amboqiaI, azo, geist400, geist500, geist600 },
      wordmark,
    }))
    // A failed load should be retried next time, not cached forever.
    fontsAndMark.catch(() => {
      fontsAndMark = null
    })
  }
  const base = await fontsAndMark
  const headshots: Record<string, string> = {}
  for (const sitePath of headshotPaths) {
    // These come from the broker roster, but a path is still a path.
    if (sitePath.includes('..')) throw new Error(`Refusing headshot path ${sitePath}`)
    headshots[sitePath] = await dataUri(`public${sitePath.startsWith('/') ? '' : '/'}${sitePath}`)
  }
  return { ...base, headshots }
}
