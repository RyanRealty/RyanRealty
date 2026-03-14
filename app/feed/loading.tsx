export default function FeedLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="h-6 w-48 animate-pulse rounded bg-border" />
      <div className="mt-4 h-8 w-64 animate-pulse rounded bg-border" />
      <div className="mt-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-80 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    </main>
  )
}
