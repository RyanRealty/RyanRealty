export default function ReportsLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="h-64 animate-pulse bg-primary" />
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="h-10 w-56 animate-pulse rounded bg-muted" />
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </section>
    </main>
  )
}
