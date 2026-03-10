export default function AgentDetailLoading() {
  return (
    <main className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="h-6 w-48 animate-pulse rounded bg-[var(--gray-bg)]" />
        <div className="mt-8 flex gap-8">
          <div className="h-56 w-56 shrink-0 animate-pulse rounded-xl bg-[var(--gray-bg)]" />
          <div className="flex-1 space-y-4">
            <div className="h-10 w-64 animate-pulse rounded bg-[var(--gray-bg)]" />
            <div className="h-6 w-48 animate-pulse rounded bg-[var(--gray-bg)]" />
            <div className="h-12 w-72 animate-pulse rounded bg-[var(--gray-bg)]" />
          </div>
        </div>
      </div>
    </main>
  )
}
