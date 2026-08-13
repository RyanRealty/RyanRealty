export default function Loading() {
  return (
    <div className="bg-background px-4 py-16">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="h-12 w-full animate-pulse rounded-md bg-muted" />
        <div className="mt-8 h-24 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  )
}
