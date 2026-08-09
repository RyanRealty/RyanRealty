/**
 * Streamed fallback while the person-workspace secondary regions load.
 *
 * 11F: on the LOCKED admin v2 language. Same call as PersonRegionSkeleton —
 * the placeholder fill is var(--a-border) so a block stays visible on every
 * surface token the workspace paints underneath it.
 */

const FILL = { background: 'var(--a-border)' } as const

export function PersonWorkspaceSkeleton() {
  return (
    <div aria-busy className="space-y-4">
      <div className="-mx-4 -mt-5 space-y-3 px-4 md:hidden">
        <div className="h-14 w-full animate-pulse rounded-md" style={FILL} />
        <div className="h-10 w-full animate-pulse rounded-md" style={FILL} />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-lg" style={FILL} />
        ))}
      </div>
      <div className="hidden h-[calc(100dvh-3.5rem)] grid-cols-[minmax(230px,24%)_1fr_minmax(290px,28%)] overflow-hidden md:grid">
        <div className="space-y-3 px-3 py-3" style={{ borderRight: '1px solid var(--a-border)' }}>
          <div className="h-8 w-40 animate-pulse rounded-md" style={FILL} />
          <div className="h-24 w-full animate-pulse rounded-md" style={FILL} />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded-md" style={FILL} />
          ))}
        </div>
        <div className="space-y-3 px-3 py-3" style={{ borderRight: '1px solid var(--a-border)' }}>
          <div className="h-10 w-56 animate-pulse rounded-md" style={FILL} />
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-14 w-full animate-pulse rounded-md" style={FILL} />
          ))}
        </div>
        <div className="space-y-3 px-3 py-3">
          <div className="h-28 w-full animate-pulse rounded-md" style={FILL} />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-lg" style={FILL} />
          ))}
        </div>
      </div>
    </div>
  )
}
