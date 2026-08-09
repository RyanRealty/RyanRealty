'use client'

/**
 * ExportPeopleDialog — the §15 Export Selected People modal
 * (docs/fub-crm-spec/05-people-list-and-bulk-actions.md).
 *
 * "Would you like to export N people?" + the "Export all columns" checkbox
 * (unchecked by default — it controls which FIELDS export, never which
 * contacts) + Cancel / "Yes, export people". Export hits
 * /api/admin/crm/export with the explicit selection (ids=) or the active
 * filter bag, downloading a CSV under the caller's broker scope.
 * DEFERRAL (logged): §15.3 async generation + email-link + owner notification
 * — the in-house export is a direct synchronous download.
 *
 * 11F: migrated off shadcn onto the admin v2 language (Dialog / ToolbarCheck /
 * Button, design_system/admin/ADMIN_UI.md). Presentation only — the href
 * builder, the selection semantics and every user-facing string are unchanged.
 * Two notes: the download action stays an <a download> (the v2 Button is a
 * <button> with no asChild escape hatch) styled with the primitive's own
 * .av2-btn class; and the shadcn Tooltip is replaced by state on the same
 * <button> rather than by a native `title`. A `title` paints only under a
 * pointer, so it put the one explanation of what "all columns" means out of
 * reach of a keyboard — Radix opened that tooltip on FOCUS as well as hover.
 * The replacement opens on both and closes on blur, leave or Esc, and the text
 * is wired to the trigger with aria-describedby while it is up.
 */

import { useId, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button, Dialog, ToolbarCheck } from '@/components/admin/v2'

export type ExportPeopleDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Explicitly selected ids ([] = export the whole active filter). */
  selectedIds: number[]
  /** Count of contacts the export will cover (selection or matching total). */
  count: number
  /** Pre-built export URL for the ACTIVE FILTERS (no ids). */
  filterExportHref: string
}

export default function ExportPeopleDialog({
  open, onOpenChange, selectedIds, count, filterExportHref,
}: ExportPeopleDialogProps) {
  const [allColumns, setAllColumns] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const hintId = `export-all-columns-hint-${useId()}`

  const href = (() => {
    const url = new URL(filterExportHref, 'https://x.invalid')
    if (selectedIds.length > 0) url.searchParams.set('ids', selectedIds.join(','))
    if (allColumns) url.searchParams.set('all', '1')
    return `${url.pathname}${url.search}`
  })()

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title="Export Selected People"
      footer={
        <>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>Cancel</Button>
          <a
            href={href}
            download
            onClick={() => onOpenChange(false)}
            className="av2-btn"
            style={{ textDecoration: 'none' }}
          >
            Yes, export people
          </a>
        </>
      }
    >
      <div className="space-y-3">
        <p className="tabular-nums" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
          Would you like to export {count.toLocaleString('en-US')} {count === 1 ? 'person' : 'people'}?
        </p>
        <ToolbarCheck
          checked={allColumns}
          onChange={(e) => setAllColumns(e.target.checked)}
          labelStyle={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}
          label={
            <>
              Export all columns
              <button
                type="button"
                aria-label="What does export all columns mean?"
                aria-describedby={hintOpen ? hintId : undefined}
                onMouseEnter={() => setHintOpen(true)}
                onMouseLeave={() => setHintOpen(false)}
                onFocus={() => setHintOpen(true)}
                onBlur={() => setHintOpen(false)}
                onKeyDown={(e) => { if (e.key === 'Escape') setHintOpen(false) }}
                style={{
                  display: 'inline-flex',
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                }}
              >
                <HelpCircle className="h-3.5 w-3.5" style={{ color: 'var(--a-text-2)' }} aria-hidden />
              </button>
            </>
          }
        />
        {/* Positioned OUT OF FLOW on purpose. As an in-flow sibling this
            ~120px block grew the dialog, and a <dialog:modal> is centred by the
            UA (position:fixed; inset:0; margin:auto) — so opening the hint moved
            the dialog's top edge up, which slid the help button out from under
            the pointer, fired mouseleave, closed the hint, dropped the button
            back under the pointer and reopened it. The Radix tooltip this
            replaced was portaled, so it never touched the dialog's layout. */}
        <span style={{ position: 'relative', display: 'block', height: 0 }}>
          {hintOpen ? (
            <p
              id={hintId}
              role="tooltip"
              style={{
                position: 'absolute',
                zIndex: 1,
                top: 4,
                left: 0,
                margin: 0,
                maxWidth: '16rem',
                borderRadius: 'var(--a-r-sm)',
                border: '1px solid var(--a-border)',
                background: 'var(--a-surface)',
                boxShadow: 'var(--a-shadow-overlay)',
                padding: 'var(--a-s2)',
                fontSize: 'var(--a-text-xs)',
                color: 'var(--a-text-2)',
              }}
            >
              Unchecked: exports only the columns shown on the People screen. Checked: exports the
              full data set (every email, phone and address, price, timeframe, lender, background
              and custom fields).
            </p>
          ) : null}
        </span>
        <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          This will create an export file of your selected people and download it as a CSV.
        </p>
      </div>
    </Dialog>
  )
}
