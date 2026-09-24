/**
 * Workspace primitives — the building blocks of the transactions dashboard
 * and the file workspace (Matt 2026-09-24: the file page was "just this long
 * scrolling list"; he picked numbers on top, needs-you beside coming-up, the
 * pipeline by stage, and a tabbed file with the document beside its checklist).
 *
 * Server-safe (Link only). Tokens only, via ./workspace.css. Every tone sits
 * next to a word, so status never rides on color alone (WCAG 1.4.1).
 */
import './admin-v2.css'
import './workspace.css'
import Link from 'next/link'

export type StatTileItem = {
  key: string
  label: string
  value: number | string
  sub?: string | null
  href: string
  tone?: 'neutral' | 'attention' | 'danger'
}

/** A row of numbers, each a door to the list behind it. */
export function StatTiles({ items, label = 'Pipeline numbers' }: { items: StatTileItem[]; label?: string }) {
  return (
    <ul className="av2-stats" aria-label={label}>
      {items.map((it) => (
        <li key={it.key}>
          <Link
            href={it.href}
            className={`av2-stat${it.tone === 'attention' ? ' av2-stat--attention' : it.tone === 'danger' ? ' av2-stat--danger' : ''}`}
          >
            <span className="av2-stat__l">{it.label}</span>
            <span className="av2-stat__n">{it.value}</span>
            {it.sub ? <span className="av2-stat__s">{it.sub}</span> : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** A bordered region with a title and an optional right-side aside (a count or a link). */
export function Panel({
  title,
  aside,
  id,
  children,
}: {
  title: React.ReactNode
  aside?: React.ReactNode
  id?: string
  children: React.ReactNode
}) {
  return (
    <section className="av2-panel" id={id} aria-labelledby={id ? `${id}-h` : undefined}>
      <h3 className="av2-panel__h" id={id ? `${id}-h` : undefined}>
        <span>{title}</span>
        {aside ? <span className="av2-panel__aside">{aside}</span> : null}
      </h3>
      {children}
    </section>
  )
}

export type MilestoneStep = {
  key: string
  label: string
  /** Already worded: "Sep 21", "Oct 9 · in 15 days", "Sep 20 · 4 days late". */
  date: string
  state: 'done' | 'next' | 'late' | 'past' | 'later'
}

/** Where a file stands: accepted → inspection → financing → closing (or listed → expires). */
export function Milestones({ steps, label = 'Milestones' }: { steps: MilestoneStep[]; label?: string }) {
  if (!steps.length) return null
  return (
    <ol className="av2-steps" aria-label={label}>
      {steps.map((s) => (
        <li key={s.key} className={`av2-step av2-step--${s.state}`}>
          <span className="av2-step__dot" aria-hidden="true" />
          <span className="av2-step__l">{s.label}</span>
          <span className="av2-step__d">
            {s.date}
            <span className="sr-only">
              {s.state === 'done' ? ' (done)' : s.state === 'late' ? ' (late)' : s.state === 'next' ? ' (next)' : s.state === 'past' ? ' (passed)' : ''}
            </span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export type SubNavItem = { key: string; label: string; href: string; current?: boolean; badge?: number; hot?: boolean }

/** Underline tabs between views of one thing (a file's Overview, Documents, …). Links, not state. */
export function SubNav({
  items,
  aside,
  sticky = false,
  label = 'Sections',
}: {
  items: SubNavItem[]
  aside?: React.ReactNode
  sticky?: boolean
  label?: string
}) {
  return (
    <nav className={`av2-subnav${sticky ? ' av2-subnav--sticky' : ''}`} aria-label={label}>
      <div className="av2-subnav__scroll">
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            className="av2-subnav__link"
            aria-current={it.current ? 'page' : undefined}
            scroll={false}
          >
            {it.label}
            {typeof it.badge === 'number' && it.badge > 0 ? (
              <span className={`av2-subnav__badge${it.hot ? ' av2-subnav__badge--hot' : ''}`}>{it.badge}</span>
            ) : null}
          </Link>
        ))}
      </div>
      {aside ? <div className="av2-subnav__aside">{aside}</div> : null}
    </nav>
  )
}

export function Avatar({ initials, title }: { initials: string; title?: string | null }) {
  return (
    <span className="av2-avatar" title={title ?? undefined} aria-label={title ?? undefined}>
      {initials}
    </span>
  )
}

/** Checklist progress: a thin bar plus the count in words. */
export function Meter({ done, total, label = 'items done' }: { done: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0
  return (
    <span className="av2-meter">
      <span className="av2-meter__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${done} of ${total} ${label}`}>
        <span className="av2-meter__fill" style={{ width: `${pct}%` }} />
      </span>
      <span>
        {done}/{total}
      </span>
    </span>
  )
}
