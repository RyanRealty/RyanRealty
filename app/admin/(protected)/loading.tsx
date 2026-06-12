import { Skeleton } from '@/components/ui/skeleton'

/**
 * Instant route-transition feedback for every admin page. Most admin routes
 * are force-dynamic with live queries — without this, a nav click leaves the
 * old page frozen for the full fetch. The shell (header + sidebar) stays
 * interactive; only the content pane skeletons.
 */
export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" aria-busy>
      <Skeleton className="mb-6 h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
