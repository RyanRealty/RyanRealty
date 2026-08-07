import './admin-v2.css'
import Link from 'next/link'

export interface RailChild {
  label: string
  href: string
  /** This child is the current location (longest-match across the whole nav). */
  current?: boolean
}

export interface RailItem {
  label: string
  href: string
  /** Destination icon (outline, single family — resolved by the caller so this
   *  primitive stays data-free). Shown alone in the <1200px icon-collapsed rail. */
  icon?: React.ReactNode
  count?: number
  /** This row IS the current location (leaf destinations). */
  current?: boolean
  /** The destination OWNS the current location (a child is current) — the row
   *  styles as the active section and its children expand. */
  active?: boolean
  /** Destination children (§5: the rail lists the 11 destinations; children are
   *  the collapsed secondary affordance — they render only while their
   *  destination is active, and the ⌘K palette reaches them from anywhere). */
  children?: RailChild[]
}

export interface RailGroup {
  /** Presentational group label (Do / Move / Watch / Reach); empty string = ungrouped. */
  label: string
  items: RailItem[]
}

/**
 * Header Option A (locked 2026-08-05) — the desktop left rail. ≥1024px surfaces
 * only; auto-collapses to icons below 1200px (ADMIN_UI.md §5). `top` carries the
 * global search (⌘K) + broker scope switch, `footer` the quiet account block —
 * both are slots so this primitive stays presentational and route-free
 * (ci:admin-nav-source: nav data reaches it only through props).
 */
export function RailNav({
  groups,
  top,
  footer,
}: {
  groups: RailGroup[]
  top?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <nav className="av2-rail" aria-label="Destinations">
      {top ? <div className="av2-rail__top">{top}</div> : null}
      {groups.map((g, gi) => (
        <div key={g.label || `ungrouped-${gi}`}>
          {g.label ? <div className="av2-rail__group">{g.label}</div> : null}
          {g.items.map((it) => (
            <div key={it.href + it.label}>
              <Link
                href={it.href}
                className={it.active && !it.current ? 'av2-rail__item av2-rail__item--active' : 'av2-rail__item'}
                aria-current={it.current ? 'page' : undefined}
                aria-label={it.label}
                title={it.label}
              >
                <span className="av2-rail__itembody">
                  {it.icon ? (
                    <span className="av2-rail__icon" aria-hidden>
                      {it.icon}
                    </span>
                  ) : null}
                  <span className="av2-rail__label">{it.label}</span>
                </span>
                {typeof it.count === 'number' ? <span className="av2-rail__count">{it.count}</span> : null}
              </Link>
              {it.active && it.children && it.children.length > 0 ? (
                <div className="av2-rail__sub">
                  {it.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className="av2-rail__subitem"
                      aria-current={c.current ? 'page' : undefined}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ))}
      {footer ? <div className="av2-rail__footer">{footer}</div> : null}
    </nav>
  )
}
