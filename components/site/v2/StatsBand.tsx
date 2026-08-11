export type V2Stat = {
  label: string
  value: string
  /** When true, show live pulse dot — only if data is fresh per §0 */
  live?: boolean
}

export type V2StatsBandProps = {
  eyebrow?: string
  title?: string
  stats: V2Stat[]
  navy?: boolean
  className?: string
}

/**
 * Live stats as identity. Values must be DAL-sourced by the caller.
 */
export function V2StatsBand({ eyebrow, title, stats, navy, className }: V2StatsBandProps) {
  return (
    <section
      className={[
        'p2-section',
        navy ? 'p2-section--navy' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="p2-wrap">
        {eyebrow ? <p className="p2-eyebrow">{eyebrow}</p> : null}
        {title ? <h2 className="p2-display" style={{ fontSize: 'var(--p-text-2xl)', margin: '0 0 var(--p-space-5)' }}>{title}</h2> : null}
        <div className="p2-stats">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="p2-stat-value">
                {s.live ? <span className="p2-live-dot" aria-hidden /> : null}
                {s.value}
              </div>
              <div className="p2-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
