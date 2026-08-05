import './admin-v2.css'
import Link from 'next/link'

export interface TabItem {
  label: string
  href: string
  badge?: number
  current?: boolean
}

/**
 * The locked 5-tab phone bar (IA lock 2026-08-05):
 * Today · Messages · Prospecting · People · Oversight.
 * Labels always visible; badges on at most two tabs.
 */
export function TabBar({ items }: { items: TabItem[] }) {
  return (
    <nav className="av2-tabbar" aria-label="Primary">
      {items.map((it) => (
        <Link key={it.href} href={it.href} className="av2-tab" aria-current={it.current ? 'page' : undefined}>
          {it.label}
          {typeof it.badge === 'number' && it.badge > 0 ? (
            <span className="av2-tab__badge">{it.badge}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  )
}
