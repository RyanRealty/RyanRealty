/**
 * pdfjs-dist on Node (Vercel) always uses a fake worker. The library then
 * does `import(GlobalWorkerOptions.workerSrc)`, defaulting to the relative
 * path `./pdf.worker.mjs` next to `pdf.mjs`. Next's file tracer does not
 * follow that dynamic import, so the worker is missing from `/var/task` and
 * every CMA / BPO / report PDF dies after Chromium has already rendered it.
 *
 * Do not name the Node require `require`. Webpack rewrites `require.resolve`
 * in bundled server chunks to a numeric module id (`565956`). existsSync on
 * that id fails, and page-safety never runs — that is the live CMA PDF 500.
 *
 * Resolve a real filesystem path (cwd / lambda / walk-up), then pin
 * `workerSrc` to a `file://` URL so the fake-worker import can find it.
 */

import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const nodeRequire = createRequire(import.meta.url)

export const PDFJS_LEGACY_WORKER = 'pdfjs-dist/legacy/build/pdf.worker.mjs'

const WORKER_REL = join('node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')

/** Webpack (and some bundlers) replace require.resolve with a numeric module id. */
export function isUsablePdfjsWorkerPath(candidate: string): boolean {
  if (!candidate || /^\d+$/.test(candidate.trim())) return false
  if (!candidate.includes('pdf.worker')) return false
  try {
    return existsSync(candidate)
  } catch {
    return false
  }
}

export function pdfjsWorkerCandidates(resolved?: string): string[] {
  const out: string[] = []
  const add = (p: string | undefined) => {
    if (p && !out.includes(p)) out.push(p)
  }

  add(resolved)
  add(join(process.cwd(), WORKER_REL))

  const taskRoot = process.env.LAMBDA_TASK_ROOT
  if (taskRoot) add(join(taskRoot, WORKER_REL))

  try {
    let dir = dirname(fileURLToPath(import.meta.url))
    for (let i = 0; i < 10; i++) {
      add(join(dir, WORKER_REL))
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
  } catch {
    // import.meta.url can be a webpack virtual URL on Vercel
  }

  return out
}

function tryNodeResolve(): string | undefined {
  try {
    const resolved = nodeRequire.resolve(PDFJS_LEGACY_WORKER)
    return typeof resolved === 'string' ? resolved : undefined
  } catch {
    return undefined
  }
}

export function resolvePdfjsWorkerPath(): string | null {
  const resolved = tryNodeResolve()
  const candidates = pdfjsWorkerCandidates(resolved)
  for (const candidate of candidates) {
    if (isUsablePdfjsWorkerPath(candidate)) return candidate
  }
  return null
}

export function resolvePdfjsWorkerSrc(): string | null {
  const path = resolvePdfjsWorkerPath()
  return path ? pathToFileURL(path).href : null
}

export function pdfjsGetDocumentOptions(data: Uint8Array): {
  data: Uint8Array
  isEvalSupported: false
  disableFontFace: true
  useSystemFonts: false
  disableWorker: boolean
} {
  return {
    data,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    disableWorker: resolvePdfjsWorkerPath() == null,
  }
}

export function configurePdfjsWorker(pdfjs: {
  GlobalWorkerOptions: { workerSrc: string }
}): void {
  const src = resolvePdfjsWorkerSrc()
  if (src) pdfjs.GlobalWorkerOptions.workerSrc = src
}
