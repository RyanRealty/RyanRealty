import { Skeleton } from '@/components/ui/skeleton'

/**
 * §12.1 People-list loading skeleton
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md): on navigation the
 * table renders skeleton placeholder rows immediately — column headers stay
 * visible, row count matches the visible page, no spinner, layout-stable.
 */
export default function CrmPeopleLoading() {
  const HEADERS = ['Name', 'Lead Score', 'Agent', 'Last Visit', 'Phone', 'Email', 'Last Activity', 'Tags']
  return (
    <main className="mx-auto max-w-[1600px] px-4 pb-8 pt-2 sm:px-6 sm:py-6" aria-busy>
      {/* Mobile: simple list skeleton */}
      <div className="mt-1 space-y-3 md:hidden">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>

      {/* Desktop: sidebar + table-with-headers + right panel */}
      <div className="hidden gap-6 md:flex md:items-start">
        <div className="w-[230px] shrink-0 space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="mt-4 h-4 w-24" />
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full rounded-md" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="mt-2 h-4 w-36" />
          <div className="mt-3 flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
            {/* Column headers remain visible during the skeleton state (§12.1) */}
            <div className="flex items-center gap-4 border-b border-border px-4 py-2.5">
              {HEADERS.map((h) => (
                <span key={h} className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground first:pl-6">
                  {h}
                </span>
              ))}
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="w-[290px] shrink-0 space-y-3 rounded-lg border border-border bg-card p-3">
          <Skeleton className="h-9 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>
    </main>
  )
}
