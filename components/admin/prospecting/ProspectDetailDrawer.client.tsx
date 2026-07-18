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
 * Exactly one ProspectDetailPanel instance mounts per breakpoint — never a
 * duplicated content tree, just two different chrome wrappers around it.
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { ProspectDetail } from '@/lib/data/prospecting/types'
import { ProspectDetailPanel } from './ProspectDetailPanel.client'

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

      {/* >= lg — non-modal in-flow aside; the parent grid places this beside the worklist. */}
      {open ? (
        <aside className="hidden w-[380px] shrink-0 lg:block">
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
