export default function Loading() {
  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="skeleton mb-6 h-10 w-48 mx-auto" />
      <div className="space-y-4">
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
        <div className="skeleton h-12 w-full rounded-md" />
      </div>
    </div>
  )
}
