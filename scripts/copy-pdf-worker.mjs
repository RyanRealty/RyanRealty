/**
 * Copy the installed pdfjs-dist worker into public/ so the TC signing UI can
 * load it same-origin (no CDN, no CSP exception) and always version-matched to
 * the installed pdfjs-dist. Wired to `prebuild` so Vercel refreshes it on every
 * deploy. See components/tc/pdf-sign/pdf-pages.tsx.
 */
import { copyFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
const dest = join(root, 'public/pdf.worker.min.mjs')

if (!existsSync(src)) {
  console.warn('[copy-pdf-worker] pdfjs-dist worker not found at', src, '— skipping')
  process.exit(0)
}
copyFileSync(src, dest)
console.log('[copy-pdf-worker] copied worker → public/pdf.worker.min.mjs')
