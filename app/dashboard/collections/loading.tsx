export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-48" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-lg">
            <div className="skeleton aspect-[4/3]" />
            <div className="space-y-2 p-4">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
