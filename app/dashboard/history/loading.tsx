export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-48" />
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-lg p-4">
            <div className="skeleton h-16 w-16 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
            </div>
            <div className="skeleton h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
