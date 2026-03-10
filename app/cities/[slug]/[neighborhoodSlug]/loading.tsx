export default function NeighborhoodDetailLoading() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="h-72 animate-pulse bg-[var(--brand-navy)]" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="h-8 w-56 animate-pulse rounded bg-[var(--gray-bg)]" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-[var(--gray-bg)]" />
          ))}
        </div>
      </div>
    </main>
  )
}
