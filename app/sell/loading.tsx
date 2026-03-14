export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      {/* Hero skeleton */}
      <div className="skeleton mb-6 h-10 w-64" />
      <div className="skeleton mb-8 h-5 w-2/3" />
      {/* Content sections skeleton */}
      <div className="space-y-8">
        <div className="skeleton h-48 w-full rounded-lg" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-lg p-6">
              <div className="skeleton h-12 w-12 rounded-full" />
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
