export default function AgentDetailLoading() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-8 flex gap-8">
          <div className="h-56 w-56 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="flex-1 space-y-4">
            <div className="h-10 w-64 animate-pulse rounded bg-muted" />
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-12 w-72 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    </main>
  )
}
