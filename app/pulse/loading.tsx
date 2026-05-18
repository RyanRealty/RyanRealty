export default function PulseLoading() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-3 h-9 w-3/4 max-w-lg animate-pulse rounded bg-muted" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
          <div className="mt-6 grid grid-cols-2 gap-x-10 gap-y-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                <div className="mt-1 h-6 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-xl px-4 pt-6 sm:px-0">
        <div className="mb-3 flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 w-24 shrink-0 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="aspect-[4/5] w-full animate-pulse bg-muted" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
