export default function OpenHousesLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="h-64 animate-pulse bg-primary" />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-6 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </section>
    </main>
  )
}
