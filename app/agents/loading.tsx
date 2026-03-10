export default function AgentsLoading() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="h-40 animate-pulse bg-[var(--brand-navy)]" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-[var(--gray-bg)]" />
          ))}
        </div>
      </div>
    </main>
  )
}
