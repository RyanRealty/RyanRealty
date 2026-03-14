export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-64 animate-pulse rounded bg-border" />
      <div className="h-4 w-96 animate-pulse rounded bg-border" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-border" />
        ))}
      </div>
    </div>
  )
}
