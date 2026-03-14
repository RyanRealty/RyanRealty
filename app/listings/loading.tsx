export default function ListingsLoading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-6 sm:px-6">
      <div className="h-10 w-48 rounded bg-border" />
      <div className="mt-4 h-14 w-full rounded-lg bg-muted" />
      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-[4/3] rounded-lg bg-muted" />
        ))}
      </div>
    </div>
  )
}
