export default function SearchSlugLoading() {
  return (
    <div className="min-h-screen w-full bg-muted">
      <div className="sticky top-0 z-20 w-full border-b border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="h-10 w-48 animate-pulse rounded-lg bg-muted" />
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-lg bg-card shadow-sm" />
          ))}
        </div>
      </div>
    </div>
  )
}
