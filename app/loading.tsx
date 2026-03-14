export default function Loading() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero skeleton */}
      <div className="relative flex min-h-[520px] items-center justify-center bg-primary">
        <div className="h-12 w-3/4 max-w-md animate-pulse rounded bg-card/20" />
      </div>

      {/* Featured row */}
      <section className="bg-card px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex justify-between">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-6 flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[340px] min-w-[280px] animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </section>

      {/* Just listed row */}
      <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="mt-6 flex gap-4 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-[340px] min-w-[280px] animate-pulse rounded-lg bg-card/80" />
            ))}
          </div>
        </div>
      </section>

      {/* Community grid */}
      <section className="bg-card px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-56 animate-pulse rounded bg-muted" />
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[16/10] animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      </section>

      {/* Market CTA */}
      <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto h-8 w-72 animate-pulse rounded bg-card/20" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-card/10" />
            ))}
          </div>
        </div>
      </section>

      {/* Trust + email */}
      <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-card/80" />
          <div className="mt-6 flex gap-4">
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-card/80" />
            <div className="h-12 w-28 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </section>
    </main>
  )
}
