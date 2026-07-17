export default function LoadingBlogPost() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <div className="h-6 w-44 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-10 w-4/5 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-muted" />
      <div className="mt-6 aspect-[16/9] w-full animate-pulse rounded-lg bg-muted" />
      <div className="mt-8 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-[95%] animate-pulse rounded bg-muted" />
        <div className="h-4 w-[90%] animate-pulse rounded bg-muted" />
      </div>
    </div>
  )
}
