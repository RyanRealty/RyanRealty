/**
 * KB-styled loading skeleton for the community detail page.
 *
 * The community detail page (/communities/<slug>) is the kinetic-brutalist
 * (KB) design — full-bleed navy .kb-root, no default SiteHeader/SiteFooter
 * (hidden via HideChrome). This skeleton mirrors that shell: a navy
 * full-bleed root, a hero band, a live stat row, and the first content
 * block, so the cream bg-background flash never shows while the real KB
 * sections stream in. Mirrors app/cities/[slug]/loading.tsx.
 */
export default function CommunityDetailLoading() {
  return (
    <main className="kb-root min-h-screen bg-primary text-primary-foreground">
      {/* Hero band */}
      <div className="relative h-[70vh] min-h-[480px] w-full overflow-hidden bg-primary">
        <div className="absolute inset-0 animate-pulse bg-primary-foreground/5" />
        <div className="absolute bottom-16 left-0 right-0 mx-auto max-w-7xl px-4 sm:px-6">
          <div className="h-4 w-40 animate-pulse rounded bg-primary-foreground/10" />
          <div className="mt-6 h-16 w-3/4 animate-pulse rounded bg-primary-foreground/10 sm:h-20" />
          <div className="mt-8 h-12 w-full max-w-xl animate-pulse rounded-lg bg-primary-foreground/10" />
        </div>
      </div>
      {/* Live stat row */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-primary-foreground/5" />
          ))}
        </div>
        {/* About / first content block */}
        <div className="mt-16 h-8 w-56 animate-pulse rounded bg-primary-foreground/10" />
        <div className="mt-12 h-72 animate-pulse rounded-lg bg-primary-foreground/5" />
        {/* Featured grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-lg bg-primary-foreground/5" />
          ))}
        </div>
      </div>
    </main>
  )
}
