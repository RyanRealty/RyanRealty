import { Skeleton } from '@/components/ui/skeleton'

export default function HousingMarketLoading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-[280px] bg-primary/80" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <Skeleton className="mb-4 h-6 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
