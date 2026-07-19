'use client'

/**
 * ProspectDetailDrawer — the `?id=`-driven review-detail wrapper (spec 07 §2,
 * copying the DealDetailModal `?deal=<id>`-over-the-list technique). The
 * PARENT owns the URL param: it sets `open`/`detail` from `?id=` and clears
 * the param in `onClose`. This component only decides WHERE the shared
 * ProspectDetailPanel renders per breakpoint:
 *
 *   - < lg:  a bottom Sheet (mobile review — one tap in, swipe/close out).
 *   - >= lg: a non-modal in-flow <aside>, sized to sit beside the worklist
 *            grid the parent page renders (e.g. `lg:grid lg:grid-cols-[1fr_380px]`).
 *
 * Exactly one ProspectDetailPanel instance mounts at a time — gated by an
 * actual `useIsDesktop()` matchMedia check, not CSS alone. Radix's `Sheet`
 * portals `SheetContent` into the DOM whenever `open` is true regardless of
 * viewport (`lg:hidden` only hides it visually), so if both branches rendered
 * unconditionally on `open` we'd mount two ProspectDetailPanel trees — and
 * two `google.maps.Map` instances via ProspectMap — at once.
 */

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { ProspectDetail } from '@/lib/data/prospecting/types'
import { ProspectDetailPanel } from './ProspectDetailPanel.client'

/** SSR-safe desktop breakpoint check (matches Tailwind's `lg` = 1024px).
 *  Defaults to `false` so server and first client render agree, then syncs
 *  to the real viewport in an effect. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', onChange)
    setIsDesktop(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

function DetailSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export function ProspectDetailDrawer({
  detail,
  open,
  onClose,
  onBuild,
  onSend,
  onOpenSend,
}: {
  detail: ProspectDetail | null
  open: boolean
  onClose: () => void
  onBuild: (id: string) => void
  onSend: (id: string) => void
  onOpenSend: () => void
}) {
  const isDesktop = useIsDesktop()

  return (
    <>
      {/* < lg — bottom sheet. Not mounted at all on desktop, so it can never
          double-mount ProspectDetailPanel alongside the aside below. */}
      {!isDesktop ? (
        <Sheet
          open={open}
          onOpenChange={(next) => {
            if (!next) onClose()
          }}
        >
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{detail?.ownerName ?? (open ? 'Loading…' : 'Prospect')}</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-6">
              {detail ? (
                <ProspectDetailPanel detail={detail} onBuild={onBuild} onSend={onSend} onOpenSend={onOpenSend} />
              ) : open ? (
                <DetailSkeleton />
              ) : null}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {/* >= lg — non-modal in-flow aside; the parent grid places this beside the worklist. */}
      {isDesktop && open ? (
        <aside className="w-[380px] shrink-0">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            {detail ? (
              <ProspectDetailPanel detail={detail} onBuild={onBuild} onSend={onSend} onOpenSend={onOpenSend} />
            ) : (
              <DetailSkeleton />
            )}
          </div>
        </aside>
      ) : null}
    </>
  )
}
