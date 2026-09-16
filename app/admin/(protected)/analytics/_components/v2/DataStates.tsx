/**
 * Designed empty / loading / note states for analytics lanes.
 *
 * Split out of DataGrid.tsx so queue pages (action-required) can render
 * StatePanel / GridSkeleton / LaneNote without importing ReportGrid or the
 * admin v2 barrel (AChart + ReportGrid).
 */
import type { ReactNode } from 'react'

/** Empty (quiet) and error (danger) both read as one calm panel. */
export function StatePanel({ tone = 'quiet', children }: { tone?: 'quiet' | 'error'; children: ReactNode }) {
  return (
    <div
      style={{
        border: `1px ${tone === 'error' ? 'solid' : 'dashed'} ${tone === 'error' ? 'var(--a-danger)' : 'var(--a-border)'}`,
        borderRadius: 'var(--a-r-lg)',
        background: tone === 'error' ? 'var(--a-danger-wash)' : 'var(--a-surface)',
        color: tone === 'error' ? 'var(--a-danger)' : 'var(--a-text-2)',
        fontSize: 'var(--a-text-sm)',
        padding: 'var(--a-s5) var(--a-s4)',
      }}
    >
      {children}
    </div>
  )
}

/** Loading state — a still placeholder; the language forbids looping motion. */
export function GridSkeleton({ rows = 5, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      style={{
        border: '1px solid var(--a-border)',
        borderRadius: 'var(--a-r-lg)',
        background: 'var(--a-surface)',
        padding: 'var(--a-s4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--a-s3)',
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <span
          key={i}
          style={{
            display: 'block',
            height: 12,
            borderRadius: 'var(--a-r-sm)',
            background: 'var(--a-inset)',
            width: i === 0 ? '38%' : `${92 - i * 7}%`,
          }}
        />
      ))}
    </div>
  )
}

/** Explanatory copy under a lane — the "how to read this" register. */
export function LaneNote({ children }: { children: ReactNode }) {
  return (
    <p
      style={{
        fontSize: 'var(--a-text-sm)',
        color: 'var(--a-text-2)',
        margin: '0 0 var(--a-s3)',
      }}
    >
      {children}
    </p>
  )
}
