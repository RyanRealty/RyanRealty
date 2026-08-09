'use client'

import './admin-v2.css'
import { useEffect, useId, useRef } from 'react'
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
  // Per-instance ids. These used to be the literal strings "av2-sheet-title" and
  // "av2-sheet-desc", and a <dialog> stays in the DOM whether it is open or not,
  // so any surface mounting two sheets published two elements with the same id
  // and aria-labelledby resolved to whichever came first. MobileContactPointsSection
  // mounts two; PeopleListView mounts three Dialogs on the same bug.
  const uid = useId()
  const titleId = `av2-sheet-title-${uid}`
  const descId = `av2-sheet-desc-${uid}`

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      // showModal() puts focus on the first focusable descendant, which is the
      // header's own Close button — so a sheet opened to be typed in landed the
      // broker on "dismiss" and the phone keyboard never rose. React's autoFocus
      // cannot cover this: it fires once at MOUNT, and this element is mounted
      // while closed. Prefer the first field in the BODY, and fall back to the
      // platform default when the sheet holds nothing to type into.
      const body = el.querySelector('.av2-sheet__body')
      const target = body?.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [autofocus]',
      )
      target?.focus()
    } else if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className="av2-sheet"
      aria-label={titleHidden ? title : undefined}
      aria-labelledby={titleHidden ? undefined : titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        // A click activated from the KEYBOARD (Enter or Space on a button)
        // reports detail === 0 and clientX/clientY === 0, which the box test
        // below reads as a point outside the sheet — so operating any control
        // by keyboard dismissed the whole surface. Only a real pointer press
        // carries a detail count.
        if (e.detail === 0) return
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
          <h2 className="av2-dialog__title" id={titleId}>
            {title}
          </h2>
        )}
        <Button variant="quiet" onClick={onClose} aria-label="Close">
          Close
        </Button>
      </div>
      {description ? (
        <p className="av2-dialog__quiet" id={descId} style={{ margin: '0 0 var(--a-s3)' }}>
          {description}
        </p>
      ) : null}
      <div className="av2-sheet__body">{children}</div>
    </dialog>
  )
}
