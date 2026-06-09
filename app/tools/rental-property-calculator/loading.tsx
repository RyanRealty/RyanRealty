export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="skeleton mb-6 h-10 w-72" />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="skeleton h-12 w-full rounded-md" />
          <div className="skeleton h-12 w-full rounded-md" />
          <div className="skeleton h-12 w-full rounded-md" />
          <div className="skeleton h-12 w-full rounded-md" />
          <div className="skeleton h-12 w-full rounded-md" />
        </div>
        <div className="space-y-3 lg:col-span-2">
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-40 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
