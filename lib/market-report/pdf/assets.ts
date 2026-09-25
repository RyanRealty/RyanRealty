/**
 * Fonts and images for the report PDF, inlined as data URIs so the document is
 * self-contained: it renders the same in the backfill script, in the monthly
 * cron on Vercel, and in a browser, with no network fetch mid-render.
 *
 * Sources, read from disk (the publish cron traces exactly these into its
 * bundle through outputFileTracingIncludes in next.config.ts):
 *   Geist                    node_modules/geist (the site's own font package)
 *   Amboqia Boriango         public/fonts
 *   wordmark, Jax, the hero  public/market-report, pre-sized copies of the
 *                            design_system/ryan-realty/assets originals
 *                            (logo-blue.png, blue-dog.png, the Old Mill hero
 *                            top-anchored per assets/hero/README.md). The
 *                            serverless build excludes design_system/, and
 *                            pre-sizing keeps image processing out of the cron.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export type ReportAssets = {
  fontCss: string
  logo: string
  jax: string
  hero: string
}

const ROOT = process.cwd()

/** Every file the PDF reads; next.config.ts traces this list into the publish cron. */
export const REPORT_ASSET_FILES = {
  geistRegular: 'node_modules/geist/dist/fonts/geist-sans/Geist-Regular.woff2',
  geistMedium: 'node_modules/geist/dist/fonts/geist-sans/Geist-Medium.woff2',
  geistSemiBold: 'node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.woff2',
  amboqia: 'public/fonts/Amboqia_Boriango.otf',
  logo: 'public/market-report/logo-blue.png',
  jax: 'public/market-report/jax-360.png',
  hero: 'public/market-report/hero-old-mill-1280x560.jpg',
} as const

async function dataUri(file: string, mime: string): Promise<string> {
  const buf = await readFile(path.join(ROOT, file))
  return `data:${mime};base64,${buf.toString('base64')}`
}

let cached: Promise<ReportAssets> | null = null

export function loadReportAssets(): Promise<ReportAssets> {
  if (!cached) {
    cached = (async () => {
      const f = REPORT_ASSET_FILES
      const [regular, medium, semibold, amboqia, logo, jax, hero] = await Promise.all([
        dataUri(f.geistRegular, 'font/woff2'),
        dataUri(f.geistMedium, 'font/woff2'),
        dataUri(f.geistSemiBold, 'font/woff2'),
        dataUri(f.amboqia, 'font/otf'),
        dataUri(f.logo, 'image/png'),
        dataUri(f.jax, 'image/png'),
        dataUri(f.hero, 'image/jpeg'),
      ])
      const fontCss = `
  @font-face { font-family: 'Geist'; src: url(${regular}) format('woff2'); font-weight: 400; font-style: normal; }
  @font-face { font-family: 'Geist'; src: url(${medium}) format('woff2'); font-weight: 500; font-style: normal; }
  @font-face { font-family: 'Geist'; src: url(${semibold}) format('woff2'); font-weight: 600; font-style: normal; }
  @font-face { font-family: 'Amboqia Boriango'; src: url(${amboqia}) format('opentype'); font-weight: 400; font-style: normal; }
`
      return { fontCss, logo, jax, hero }
    })()
  }
  return cached
}
