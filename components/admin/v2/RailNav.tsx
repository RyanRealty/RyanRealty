import './admin-v2.css'
import Link from 'next/link'

export interface RailItem {
  label: string
  href: string
  count?: number
  current?: boolean
}

export interface RailGroup {
  /** Presentational group label (Do / Move / Watch / Reach); empty string = ungrouped. */
  label: string
  items: RailItem[]
}

/** Header Option A (locked 2026-08-05) — the desktop left rail. ≥1024px surfaces only. */
export function RailNav({ groups, top }: { groups: RailGroup[]; top?: React.ReactNode }) {
  return (
    <nav className="av2-rail" aria-label="Destinations">
      {top}
      {groups.map((g) => (
        <div key={g.label || 'ungrouped'}>
          {g.label ? <div className="av2-rail__group">{g.label}</div> : null}
          {g.items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="av2-rail__item"
              aria-current={it.current ? 'page' : undefined}
            >
              {it.label}
              {typeof it.count === 'number' ? <span className="av2-rail__count">{it.count}</span> : null}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}
