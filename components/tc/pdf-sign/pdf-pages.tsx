'use client'

/**
 * Client PDF page renderer for the TC signing UI. Renders every page of a PDF
 * to a canvas at a responsive width and exposes a fractional-coordinate overlay
 * layer per page (origin top-left, matching lib/tc/signing.ts geometry) so the
 * composer can place fields and the signer can fill them.
 *
 * The pdf.js worker is bundled from the installed pdfjs-dist (version-matched,
 * no CDN, no CSP exception) via new URL(..., import.meta.url).
 *
 * Pages fit the space they are given: never wider than `maxWidth` or the
 * page's own size, and never wider than the container, so on a phone the
 * whole page shows (it was cut off at a fixed 612 px before 2026-09-24). A
 * width change re-measures and repaints.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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

/** width/height: rendered CSS pixels. ptsW/ptsH: the page's own size in PDF points (what text is measured in). */
export type RenderedPage = { pageNumber: number; width: number; height: number; ptsW: number; ptsH: number }

export function PdfPages({
  url,
  maxWidth = 760,
  overlay,
  onReady,
}: {
  url: string | null
  maxWidth?: number
  /** Returns overlay content for one page, sized to its rendered CSS pixels. */
  overlay?: (pageNumber: number, size: { w: number; h: number; ptsW: number; ptsH: number }) => ReactNode
  onReady?: (pages: RenderedPage[]) => void
}) {
  const [base, setBase] = useState<Array<{ pageNumber: number; ptsW: number; ptsH: number }>>([])
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const pdfRef = useRef<PDFDocumentProxy | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRefs = useRef<Map<number, HTMLCanvasElement | null>>(new Map())

  // The space the pages have, followed as the window turns or resizes.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let timer: ReturnType<typeof setTimeout> | null = null
    const measure = () => setContainerWidth(Math.floor(el.getBoundingClientRect().width))
    measure()
    const ro = new ResizeObserver(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(measure, 120)
    })
    ro.observe(el)
    return () => {
      if (timer) clearTimeout(timer)
      ro.disconnect()
    }
  }, [])

  // Phase 1: load the document and read each page's size
  useEffect(() => {
    if (!url) return
    ensureWorker()
    let cancelled = false
    setLoading(true)
    setError(null)
    setBase([])
    ;(async () => {
      try {
        const pdf = await getDocument({ url, isEvalSupported: false }).promise
        if (cancelled) {
          pdf.destroy().catch(() => {})
          return
        }
        pdfRef.current = pdf
        const sizes: Array<{ pageNumber: number; ptsW: number; ptsH: number }> = []
        for (let n = 1; n <= pdf.numPages; n++) {
          const vp = (await pdf.getPage(n)).getViewport({ scale: 1 })
          sizes.push({ pageNumber: n, ptsW: vp.width, ptsH: vp.height })
        }
        if (!cancelled) {
          setBase(sizes)
          setLoading(false)
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
  }, [url])

  // Each page at the width it fits: its own size, maxWidth, and the container.
  const pages = useMemo<RenderedPage[]>(
    () =>
      base.map((p) => {
        const width = Math.max(200, Math.min(maxWidth, p.ptsW, containerWidth ?? maxWidth))
        return { pageNumber: p.pageNumber, width, height: (p.ptsH * width) / p.ptsW, ptsW: p.ptsW, ptsH: p.ptsH }
      }),
    [base, maxWidth, containerWidth],
  )
  useEffect(() => {
    if (pages.length) onReady?.(pages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages])

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
    <div ref={wrapRef} className="w-full">
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
              {overlay(p.pageNumber, { w: p.width, h: p.height, ptsW: p.ptsW, ptsH: p.ptsH })}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}
