export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="skeleton mb-4 h-8 w-3/4" />
      <div className="skeleton mb-8 h-5 w-1/2" />
      <div className="skeleton mb-6 aspect-video w-full rounded-lg" />
      <div className="space-y-3">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-5/6" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-4 w-full" />
      </div>
    </div>
  )
}
