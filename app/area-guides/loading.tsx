export default function AreaGuidesLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="h-64 animate-pulse bg-primary" />
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="h-10 w-64 animate-pulse rounded bg-muted" />
        <div className="mt-6 flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[280px] min-w-[260px] animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </section>
    </main>
  )
}
