import type { ReactNode } from 'react'
import '@/components/admin/v2/admin-v2.css'

/**
 * Shared layout primitives for the Company Settings form (spec §1.2):
 * all-caps section dividers flanked by rules + the config-form row.
 *
 * P11F: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * The row is now pattern 6 — label above, hint under it, single column —
 * matching `.av2-field`, because every labelled control on this form is now a
 * v2 field primitive (TextField / SelectField) that renders its own label. A
 * two-column row would have put a second label beside the primitive's own.
 * FormRow survives for the rows whose control is NOT a single field: the
 * recording switch, the disclosure block, the office-hours editor, the
 * recipient chips and the sub-page links.
 */

/** All-caps section divider with flanking separators (CRM-style). */
export function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center" style={{ gap: 'var(--a-s4)', padding: 'var(--a-s4) 0' }}>
      <div className="flex-1" style={{ borderTop: '1px solid var(--a-border)' }} />
      <span
        className="shrink-0"
        style={{
          fontSize: 'var(--a-text-xs)',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--a-text-2)',
        }}
      >
        {label}
      </span>
      <div className="flex-1" style={{ borderTop: '1px solid var(--a-border)' }} />
    </div>
  )
}

/** Config-form row: label above (~`.av2-field`), description under it, control below. */
export function FormRow({
  label,
  htmlFor,
  children,
  description,
  className,
}: {
  label?: string
  htmlFor?: string
  children: ReactNode
  description?: string
  className?: string
}) {
  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--a-s1)', maxWidth: 640 }}
    >
      {label && (
        <label
          htmlFor={htmlFor}
          style={{ fontSize: 'var(--a-text-sm)', fontWeight: 600, color: 'var(--a-text)' }}
        >
          {label}
        </label>
      )}
      {description && (
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          {description}
        </p>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
