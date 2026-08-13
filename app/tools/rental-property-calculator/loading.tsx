export default function Loading() {
  return (
    <div className="bg-background px-4 py-16">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
            <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
          </div>
          <div className="space-y-3 lg:col-span-2">
            <div className="h-20 w-full animate-pulse rounded-xl bg-muted" />
            <div className="h-40 w-full animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}
