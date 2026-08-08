'use client'

import './admin-v2.css'
import { useEffect, useRef } from 'react'
import { Button } from './Button'

/**
 * Dialog — the admin's one overlay (11F).
 *
 * Wraps the platform's <dialog> element, so the modal focus trap, Esc-to-close,
 * background inertness and top-layer stacking come from the browser instead of
 * from a component library. §2 sanctions shadows on overlays only; the shadow
 * lives on .av2-dialog.
 *
 * `open` drives showModal()/close() rather than mounting and unmounting, so the
 * element keeps its place in the top layer across renders. Esc fires the native
 * `cancel`/`close` event, which is forwarded to onClose — a dialog that can be
 * dismissed by Esc but not by its own Cancel button is the usual bug here, so
 * both paths run the same callback.
 *
 * Not for confirmation of a destructive act alone — see ConfirmDialog.
 */
export interface AdminDialogProps {
  open: boolean
  onClose: () => void
  title: string
  /** Sits under the title; also the dialog's accessible description. */
  description?: React.ReactNode
  children?: React.ReactNode
  /** Rendered right-aligned at the bottom. Omit for a message-only dialog. */
  footer?: React.ReactNode
}

export function Dialog({ open, onClose, title, description, children, footer }: AdminDialogProps) {
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
      className="av2-dialog"
      aria-labelledby="av2-dlg-title"
      aria-describedby={description ? 'av2-dlg-desc' : undefined}
      // Native close covers Esc, the backdrop and form method="dialog".
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="av2-dialog__head">
        <h2 className="av2-dialog__title" id="av2-dlg-title">
          {title}
        </h2>
        <Button variant="quiet" onClick={onClose} aria-label="Close">
          Close
        </Button>
      </div>
      {description ? (
        <p className="av2-dialog__quiet" id="av2-dlg-desc" style={{ marginTop: 0 }}>
          {description}
        </p>
      ) : null}
      {children ? <div className="av2-dialog__body">{children}</div> : null}
      {footer ? <div className="av2-dialog__foot">{footer}</div> : null}
    </dialog>
  )
}

/**
 * ConfirmDialog — a destructive act, named in words, with the consequence
 * spelled out above the button that performs it.
 *
 * ADMIN_UI §3 pattern 6 asks destructive actions to be confirmed. The confirm
 * button carries the VERB ("Delete stage"), never "OK": a broker reading only
 * the button must still know what is about to happen.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  busy = false,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  confirmLabel: string
  onConfirm: () => void
  busy?: boolean
  children?: React.ReactNode
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  )
}
