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
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { BpoWorklistRow } from '@/lib/data/bpo/reads'
import { BpoDetailPanel } from './BpoDetailPanel.client'

function DetailSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
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
  return (
    <>
      {/* < lg — bottom sheet */}
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
      >
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto lg:hidden">
          <SheetHeader>
            <SheetTitle>{detail?.subjectAddress ?? (open ? 'Loading…' : 'Broker price opinion')}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">
            {detail ? (
              <BpoDetailPanel
                detail={detail}
                onFinalize={onFinalize}
                onOpenSend={onOpenSend}
                pendingFinalize={pendingFinalize}
                pendingSend={pendingSend}
              />
            ) : open ? (
              <DetailSkeleton />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* >= lg — non-modal in-flow aside; the parent grid places this beside the worklist. */}
      {open ? (
        <aside className="hidden w-[380px] shrink-0 lg:block">
          <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-card p-5 ring-1 ring-foreground/10">
            {detail ? (
              <BpoDetailPanel
                detail={detail}
                onFinalize={onFinalize}
                onOpenSend={onOpenSend}
                pendingFinalize={pendingFinalize}
                pendingSend={pendingSend}
              />
            ) : (
              <DetailSkeleton />
            )}
          </div>
        </aside>
      ) : null}
    </>
  )
}
