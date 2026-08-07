import './admin-v2.css'

/**
 * Lane heading for stacked entity-page context sections (pattern 5). The
 * primitive owns the heading element so migrated surfaces never hand-roll
 * raw <h2> markup (ci:admin-ui rule A).
 */
export function SectionHead({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2 id={id} className="av2-lane-head">
      {children}
    </h2>
  )
}
