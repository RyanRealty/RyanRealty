/**
 * pdfjs-dist on Node (Vercel) always uses a fake worker. The library then
 * does `import(GlobalWorkerOptions.workerSrc)`, defaulting to the relative
 * path `./pdf.worker.mjs` next to `pdf.mjs`. Next's file tracer does not
 * follow that dynamic import, so the worker is missing from `/var/task` and
 * every CMA / BPO / report PDF dies after Chromium has already rendered it.
 *
 * Resolve the worker ourselves (`require.resolve` is NFT-visible) and pin
 * `workerSrc` to a `file://` URL so the fake-worker import can find it.
 */

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)

export const PDFJS_LEGACY_WORKER = 'pdfjs-dist/legacy/build/pdf.worker.mjs'

/** Absolute filesystem path. NFT traces this `require.resolve`. */
export const PDFJS_WORKER_PATH = require.resolve(PDFJS_LEGACY_WORKER)

export function resolvePdfjsWorkerSrc(): string {
  if (!existsSync(PDFJS_WORKER_PATH)) {
    throw new Error(`pdfjs worker missing at ${PDFJS_WORKER_PATH}`)
  }
  return pathToFileURL(PDFJS_WORKER_PATH).href
}

export function configurePdfjsWorker(pdfjs: {
  GlobalWorkerOptions: { workerSrc: string }
}): void {
  pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfjsWorkerSrc()
}
