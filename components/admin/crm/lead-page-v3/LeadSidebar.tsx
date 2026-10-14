import type { ReactNode } from 'react'

export function LeadSidebar(props: { children: ReactNode }) {
  return (
    <aside className="av2-pane lead-v3-side" aria-label="Lead details" style={{ borderRadius: 12, overflow: 'hidden' }}>
      {props.children}
    </aside>
  )
}

export function SidebarSec(props: {
  title: string
  meta?: string
  children: ReactNode
  defaultOpen?: boolean
  id?: string
}) {
  return (
    <details
      id={props.id}
      open={props.defaultOpen !== false}
      style={{ borderBottom: '1px solid var(--a-border)', padding: '12px 16px' }}
    >
      <summary
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: 0.7,
          textTransform: 'uppercase',
          color: 'var(--a-text)',
          cursor: 'pointer',
          listStyle: 'none',
        }}
      >
        <span>{props.title}</span>
        {props.meta ? (
          <span style={{ fontWeight: 500, color: 'var(--a-text-2)', textTransform: 'none' }}>{props.meta}</span>
        ) : null}
      </summary>
      <div style={{ marginTop: 8 }}>{props.children}</div>
    </details>
  )
}