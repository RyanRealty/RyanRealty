import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Designed loading state for the Results scoreboard. Mirrors the live layout:
 * a glanceable KPI strip over the funnel panels, so the skeleton reads as the
 * same screen rather than a blank gap (Admin Design Standard, law 3).
 */
export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <section className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-2 p-3 sm:p-4">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-7 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="gap-2 pb-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-px w-full" />
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
