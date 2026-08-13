import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="bg-background px-4 py-12">
      <Skeleton className="mb-8 h-10 w-48" />
      <div className="flex flex-col gap-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}
