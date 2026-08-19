import './admin-v2.css'

/**
 * Lane heading for stacked entity-page context sections (pattern 5). The
 * primitive owns the heading element so migrated surfaces never hand-roll
 * raw <h2> markup (ci:admin-ui rule A).
 */
export function SectionHead({
  children,
  id,
  flush,
}: {
  children: React.ReactNode
  id?: string
  flush?: boolean
}) {
  return (
    <h2 id={id} className="av2-lane-head" style={flush ? { marginTop: 0 } : undefined}>
      {children}
    </h2>
  )
}
