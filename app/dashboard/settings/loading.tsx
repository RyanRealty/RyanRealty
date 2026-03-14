export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="skeleton h-8 w-48" />
      <div className="space-y-4">
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-48 rounded-md" />
      </div>
    </div>
  )
}
