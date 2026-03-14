export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-48" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg p-4">
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-2/3" />
              <div className="skeleton h-4 w-1/3" />
            </div>
            <div className="skeleton h-9 w-24 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
