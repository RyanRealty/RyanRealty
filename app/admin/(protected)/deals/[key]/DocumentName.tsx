'use client'

// @no-parity — internal admin surface, no public mockup contract
//
// The document-name hover preview, lifted out of page.tsx UNCHANGED at 11D so
// the page itself renders only the v2 language.
//
// 11F: off the shadcn HoverCard. v2 has no hover-card primitive and one was NOT
// invented in components/admin/v2 for a single caller, so the preview is local
// and built from the locked tokens only.
//
// It is deliberately not a CSS-only :hover panel. This cell renders inside
// ReportGrid's .av2-rgrid__scroll box — overflow-x:auto, overflow-y:hidden — so
// an absolutely positioned panel would be clipped by its own scroll container
// and the preview would be unusable. position:fixed with coordinates read off
// the trigger's rect escapes that, which is what Radix's portal was buying.
//
// Carried over from the Radix call verbatim: openDelay 150ms, closeDelay 80ms,
// side="right", align="start", sideOffset 4 (the shadcn default), the pointer
// staying inside the panel keeping it open, and both signed thumbnail URLs with
// their captions. Added, because position:fixed has no collision detection
// where Radix did: the panel is clamped to the viewport instead of running off
// the bottom or right edge of a long document list.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { TcDocument } from '@/app/actions/tc'

/** Panel geometry, computed from the trigger at open time. */
type Anchor = { top: number; left: number; maxWidth: number }

/** Tallest the panel can get: two 420px thumbnails, their captions and the
 *  16px of padding around them. Used only to keep it on screen. */
const PANEL_MAX_H = 468

/** Mouse-over preview: first page + last page (signature blocks live on the
 *  last page of most OREF forms) so signature state is visible without a click. */
export function DocumentName({ doc }: { doc: TcDocument }) {
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const timer = useRef<number | null>(null)

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  // A pending open/close timer outliving the row would setState on an unmounted
  // component when the page reloads under it.
  useEffect(() => clear, [clear])

  const scheduleOpen = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    clear()
    timer.current = window.setTimeout(() => {
      const left = r.right + 4
      setAnchor({
        top: Math.max(8, Math.min(r.top, window.innerHeight - PANEL_MAX_H - 8)),
        left,
        maxWidth: Math.max(240, Math.min(680, window.innerWidth - left - 8)),
      })
    }, 150)
  }

  const scheduleClose = () => {
    clear()
    timer.current = window.setTimeout(() => setAnchor(null), 80)
  }

  const name = (
    <p className="truncate" style={{ margin: 0, fontWeight: 500, color: 'var(--a-text)' }} title={doc.name}>
      {doc.name}
    </p>
  )
  if (!doc.thumbFirstUrl) return name
  const single = !doc.thumbLastUrl
  return (
    <>
      <p
        className="cursor-zoom-in truncate underline decoration-dotted underline-offset-4"
        style={{ margin: 0, fontWeight: 500, color: 'var(--a-text)', textDecorationColor: 'var(--a-border)' }}
        onMouseEnter={(e) => scheduleOpen(e.currentTarget)}
        onMouseLeave={scheduleClose}
      >
        {doc.name}
      </p>
      {anchor ? (
        <div
          role="tooltip"
          onMouseEnter={clear}
          onMouseLeave={scheduleClose}
          style={{
            position: 'fixed',
            top: anchor.top,
            left: anchor.left,
            zIndex: 30,
            maxWidth: anchor.maxWidth,
            padding: 'var(--a-s3)',
            background: 'var(--a-bg)',
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-lg)',
            boxShadow: 'var(--a-shadow-overlay)',
          }}
        >
          <div className="flex gap-3">
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, remote loader not configured for storage host */}
              <img
                src={doc.thumbFirstUrl}
                alt={`First page of ${doc.name}`}
                className="max-h-[420px] w-auto"
                style={{
                  borderRadius: 'var(--a-r-md)',
                  border: '1px solid var(--a-border)',
                  background: 'var(--a-surface)',
                }}
              />
              <figcaption
                className="mt-1 text-center"
                style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
              >
                page 1{single ? ' (only page)' : ''}
              </figcaption>
            </figure>
            {doc.thumbLastUrl ? (
              <figure className="m-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                <img
                  src={doc.thumbLastUrl}
                  alt={`Last page of ${doc.name}`}
                  className="max-h-[420px] w-auto"
                  style={{
                    borderRadius: 'var(--a-r-md)',
                    border: '1px solid var(--a-border)',
                    background: 'var(--a-surface)',
                  }}
                />
                <figcaption
                  className="mt-1 text-center"
                  style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
                >
                  last page · signatures
                </figcaption>
              </figure>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
