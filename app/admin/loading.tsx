export default function AdminLoading() {
  return (
    <div className="flex animate-pulse gap-4 p-6">
      <div className="h-8 w-32 rounded bg-border" />
      <div className="h-64 flex-1 rounded bg-muted" />
    </div>
  )
}
