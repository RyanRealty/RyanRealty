import Skeleton from '@/components/ui/Skeleton'

export default function ListingDetailLoading() {
  return (
    <div className="bg-[var(--brand-cream)] min-h-screen">
      <Skeleton variant="listing-detail-hero" className="max-h-[70vh] w-full" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <Skeleton variant="text-line" className="max-w-md" />
        <Skeleton variant="text-line" className="max-w-sm" />
        <Skeleton variant="text-line" className="max-w-xs h-8" />
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Skeleton variant="chart" className="h-32" />
            <Skeleton variant="chart" className="h-48" />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <Skeleton variant="avatar" className="w-16 h-16" />
            <Skeleton variant="chart" className="h-48" />
          </div>
        </div>
      </div>
    </div>
  )
}
