export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="skeleton mb-6 h-10 w-64 mx-auto" />
      <div className="space-y-4">
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
      </div>
      {/* Results skeleton */}
      <div className="mt-8 space-y-3">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    </div>
  )
}
