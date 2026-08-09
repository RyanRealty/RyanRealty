'use client'

/**
 * BpoDetailDrawer — the `?id=`-driven review-detail wrapper (mirrors
 * ProspectDetailDrawer). The PARENT owns the URL param: it sets `open`/
 * `detail` from `?id=` and clears the param in `onClose`. This component only
 * decides WHERE the shared BpoDetailPanel renders per breakpoint:
 *
 *   - < lg:  a bottom Sheet (mobile review — one tap in, swipe/close out).
 *   - >= lg: a non-modal in-flow <aside>, sized to sit beside the worklist
 *            grid the parent page renders.
 *
 * Exactly one BpoDetailPanel instance mounts per breakpoint.
 *
 * 11F: on the LOCKED admin v2 language. The old shadcn Sheet (Radix) mounted
 * BOTH the bottom-sheet content and the desktop aside whenever `open`, and
 * used `lg:hidden` / `hidden lg:block` to pick which one showed — safe under
 * Radix, which is CSS-visibility-driven. The v2 Sheet wraps a native
 * <dialog>: calling showModal() while the element (or an ancestor) computes
 * `display:none` throws, so the same trick cannot carry over. This tracks the
 * >=1024px breakpoint in JS and mounts only the variant that applies. As a
 * side effect this is also more correct than the original: Radix's Dialog
 * root renders a full-viewport modal overlay whenever `open` is true
 * regardless of which content is CSS-visible, so the pre-migration "non-modal
 * desktop aside" was sitting behind an always-mounted (if invisible) modal
 * overlay; the aside here has no overlay at all, matching what the docblock
 * always claimed.
 */

import { useEffect, useState } from 'react'
import { Sheet } from '@/components/admin/v2'
import type { BpoWorklistRow } from '@/lib/data/bpo/reads'
import { BpoDetailPanel } from './BpoDetailPanel.client'

const DESKTOP_QUERY = '(min-width: 1024px)'

/** Tracks the lg breakpoint. Defaults to false (mobile) for the first paint
 *  on both server and client, so there is no hydration mismatch — it flips
 *  right after mount via the media query listener. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isDesktop
}

function skeletonBlock(height: number, width: string) {
  return (
    <div
      style={{ height, width, borderRadius: 'var(--a-r-sm)', background: 'var(--a-inset)' }}
      aria-hidden="true"
    />
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading opinion">
      {skeletonBlock(24, '66%')}
      {skeletonBlock(16, '50%')}
      {skeletonBlock(96, '100%')}
      {skeletonBlock(96, '100%')}
    </div>
  )
}

export function BpoDetailDrawer({
  detail,
  open,
  onClose,
  onFinalize,
  onOpenSend,
  pendingFinalize,
  pendingSend,
}: {
  detail: BpoWorklistRow | null
  open: boolean
  onClose: () => void
  onFinalize: (slug: string) => void
  onOpenSend: (slug: string) => void
  pendingFinalize?: boolean
  pendingSend?: boolean
}) {
  const isDesktop = useIsDesktop()

  const panel = detail ? (
    <BpoDetailPanel
      detail={detail}
      onFinalize={onFinalize}
      onOpenSend={onOpenSend}
      pendingFinalize={pendingFinalize}
      pendingSend={pendingSend}
    />
  ) : open ? (
    <DetailSkeleton />
  ) : null

  return (
    <>
      {/* < lg — bottom sheet */}
      {!isDesktop ? (
        <Sheet
          open={open}
          onClose={onClose}
          title={detail?.subjectAddress ?? (open ? 'Loading…' : 'Broker price opinion')}
        >
          {panel}
        </Sheet>
      ) : null}

      {/* >= lg — non-modal in-flow aside; the parent grid places this beside the worklist. */}
      {isDesktop && open ? (
        <aside
          className="w-[380px] shrink-0"
          style={{ position: 'sticky', top: 24, maxHeight: 'calc(100vh - 3rem)', overflowY: 'auto' }}
        >
          <div className="av2-pane">{panel}</div>
        </aside>
      ) : null}
    </>
  )
}
