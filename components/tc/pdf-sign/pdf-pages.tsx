'use client'

/**
 * Client PDF page renderer for the TC signing UI. Renders every page of a PDF
 * to a canvas at a responsive width and exposes a fractional-coordinate overlay
 * layer per page (origin top-left, matching lib/tc/signing.ts geometry) so the
 * composer can place fields and the signer can fill them.
 *
 * The pdf.js worker is bundled from the installed pdfjs-dist (version-matched,
 * no CDN, no CSP exception) via new URL(..., import.meta.url).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'

let workerReady = false
function ensureWorker() {
  if (workerReady || typeof window === 'undefined') return
  // Same-origin, version-matched worker copied into public/ by
  // scripts/copy-pdf-worker.mjs (prebuild). No CDN, no CSP exception, no
  // bundler-resolution dependency.
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  workerReady = true
}

export type RenderedPage = { pageNumber: number; width: number; height: number }

export function PdfPages({
  url,
  maxWidth = 760,
  overlay,
  onReady,
}: {
  url: string | null
  maxWidth?: number
  /** Returns overlay content for one page, sized to its rendered CSS pixels. */
  overlay?: (pageNumber: number, size: { w: number; h: number }) => ReactNode
  onReady?: (pages: RenderedPage[]) => void
}) {
  const [pages, setPages] = useState<RenderedPage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement | null>>(new Map())

  // Phase 1: load + measure pages
  useEffect(() => {
    if (!url) return
    ensureWorker()
    let cancelled = false
    setLoading(true)
    setError(null)
    setPages([])
    ;(async () => {
      try {
        const pdf = await getDocument({ url, isEvalSupported: false }).promise
        if (cancelled) {
          pdf.destroy().catch(() => {})
          return
        }
        pdfRef.current = pdf
        const measured: RenderedPage[] = []
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const cssWidth = Math.min(maxWidth, base.width)
          const scale = cssWidth / base.width
          measured.push({ pageNumber: n, width: cssWidth, height: base.height * scale })
        }
        if (!cancelled) {
          setPages(measured)
          setLoading(false)
          onReady?.(measured)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not render the document')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
      pdfRef.current?.destroy().catch(() => {})
      pdfRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, maxWidth])

  // Phase 2: paint each measured page into its attached canvas
  useEffect(() => {
    const pdf = pdfRef.current
    if (!pdf || !pages.length) return
    let cancelled = false
    ;(async () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      for (const p of pages) {
        if (cancelled) break
        const canvas = canvasRefs.current.get(p.pageNumber)
        if (!canvas) continue
        try {
          const page = await pdf.getPage(p.pageNumber)
          const scale = (p.width / page.getViewport({ scale: 1 }).width) * dpr
          const viewport = page.getViewport({ scale })
          canvas.width = viewport.width
          canvas.height = viewport.height
          const ctx = canvas.getContext('2d')
          if (ctx) await page.render({ canvasContext: ctx, viewport }).promise
        } catch {
          /* page render failure is non-fatal */
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pages])

  return (
    <div className="w-full">
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading document…</p> : null}
      {error ? <p className="py-8 text-center text-sm text-destructive">{error}</p> : null}
      {pages.map((p) => (
        <div
          key={p.pageNumber}
          className="relative mx-auto mb-4 overflow-hidden rounded-md bg-white shadow-sm ring-1 ring-border"
          style={{ width: p.width, height: p.height }}
        >
          <canvas
            ref={(el) => {
              canvasRefs.current.set(p.pageNumber, el)
            }}
            style={{ width: p.width, height: p.height, display: 'block' }}
          />
          {overlay ? (
            <div className="absolute inset-0" style={{ width: p.width, height: p.height }}>
              {overlay(p.pageNumber, { w: p.width, h: p.height })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
