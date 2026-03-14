import { Skeleton } from '@/components/ui/skeleton'

export default function ListingDetailLoading() {
  return (
    <div className="bg-muted min-h-screen">
      <Skeleton className="max-h-[70vh] w-full h-[50vh]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <Skeleton className="max-w-md h-6" />
        <Skeleton className="max-w-sm h-5" />
        <Skeleton className="max-w-xs h-8" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <Skeleton className="w-16 h-16 rounded-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
