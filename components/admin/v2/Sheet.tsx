'use client'

import './admin-v2.css'
import { useEffect, useRef } from 'react'
import { Button } from './Button'

/**
 * Sheet — a bottom sheet for phone surfaces (11F).
 *
 * WHY THIS EXISTS. The mobile inbox opened its scope picker, filter panel,
 * contact drawer, call chooser and compose surface as slide-up sheets. The v2
 * barrel had only Dialog, a centred modal, so three separate migrations of the
 * same folder made three different calls: two regressed the sheets to centred
 * modals, one hand-rolled a local sheet to avoid that. Three implementations of
 * one interaction is how a surface stops feeling built by one person.
 *
 * A sheet is not a nicer Dialog. On a phone, a centred modal puts its controls
 * mid-screen and its dismiss target under the reading hand; a sheet rises from
 * the thumb, keeps context visible above it, and is what every phone-native
 * pattern this family imitates actually does. Use Dialog for a question, Sheet
 * for a surface you act on.
 *
 * Same platform mechanics as Dialog: <dialog>.showModal() gives the focus trap,
 * Esc, inert background and top-layer stacking. Backdrop clicks close, which the
 * native element does not do for free.
 */
export interface AdminSheetProps {
  open: boolean
  onClose: () => void
  /** Accessible name. Rendered unless `titleHidden`. */
  title: string
  titleHidden?: boolean
  /** Sits under the title; also the sheet's accessible description. */
  description?: React.ReactNode
  children?: React.ReactNode
}

export function Sheet({
  open,
  onClose,
  title,
  titleHidden = false,
  description,
  children,
}: AdminSheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="av2-sheet"
      aria-label={titleHidden ? title : undefined}
      aria-labelledby={titleHidden ? undefined : 'av2-sheet-title'}
      aria-describedby={description ? 'av2-sheet-desc' : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // Backdrop click. The native element reports the click on the <dialog>
        // itself, so compare against its own box rather than the event target —
        // a click on a child would otherwise read as "outside".
        const r = e.currentTarget.getBoundingClientRect()
        const inside =
          e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        if (!inside) onClose()
      }}
    >
      <div className="av2-sheet__grip" aria-hidden="true" />
      <div className="av2-sheet__head">
        {titleHidden ? (
          <span />
        ) : (
          <h2 className="av2-dialog__title" id="av2-sheet-title">
            {title}
          </h2>
        )}
        <Button variant="quiet" onClick={onClose} aria-label="Close">
          Close
        </Button>
      </div>
      {description ? (
        <p className="av2-dialog__quiet" id="av2-sheet-desc" style={{ margin: '0 0 var(--a-s3)' }}>
          {description}
        </p>
      ) : null}
      <div className="av2-sheet__body">{children}</div>
    </dialog>
  )
}
