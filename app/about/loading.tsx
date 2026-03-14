export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Hero skeleton */}
      <div className="skeleton mb-8 h-10 w-72" />
      <div className="skeleton mb-6 aspect-[3/1] w-full rounded-lg" />
      {/* Content skeleton */}
      <div className="space-y-4">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-4 w-5/6" />
      </div>
      {/* Team grid skeleton */}
      <div className="mt-12">
        <div className="skeleton mb-6 h-8 w-48" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-lg">
              <div className="skeleton aspect-square" />
              <div className="space-y-2 p-4">
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
