export default function CityDetailLoading() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="h-80 animate-pulse bg-[var(--brand-navy)]" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--gray-bg)]" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--gray-bg)]" />
          ))}
        </div>
        <div className="mt-12 h-64 animate-pulse rounded-xl bg-[var(--gray-bg)]" />
      </div>
    </main>
  )
}
