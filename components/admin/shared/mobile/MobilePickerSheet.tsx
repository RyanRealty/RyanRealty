'use client'

/**
 * MobilePickerSheet — the canonical §23.8 bottom-sheet picker (mob-35).
 *
 * Used by every single-select field on the mobile contact detail (Stage,
 * Assigned to, Collaborators…): slides up from the bottom under the sheet's
 * own head (title + dismiss), 52pt option rows with a right-aligned checkmark
 * on the current selection, and "Select" as the footer confirm. "Select"
 * confirms; the head's dismiss control cancels.
 *
 * The confirm handler receives the picked value and runs the bound server
 * action inside a transition so the row UI can show a pending state.
 */

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Button, Sheet } from '@/components/admin/v2'

export interface PickerOption {
  value: string
  label: string
  /** secondary line, e.g. a broker's role */
  sub?: string
}

export function MobilePickerSheet({
  title,
  open,
  onOpenChange,
  options,
  selected,
  onConfirm,
}: {
  title: string
  open: boolean
  onOpenChange: (v: boolean) => void
  options: PickerOption[]
  selected: string | null
  onConfirm: (value: string) => Promise<void> | void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const current = picked ?? selected

  const confirm = () => {
    if (current == null || current === selected) {
      onOpenChange(false)
      return
    }
    startTransition(async () => {
      await onConfirm(current)
      setPicked(null)
      onOpenChange(false)
    })
  }

  return (
    <Sheet
      open={open}
      onClose={() => { setPicked(null); onOpenChange(false) }}
      title={title}
    >
      {/* One flex child: av2-sheet__body gaps its children, and the option list
          sits flush against the footer (the shadcn original set gap-0).
          §23.8a's own header bar is gone — the sheet's head already renders the
          title and the dismiss control that Cancel duplicated, so the two
          stacked into a double header. "Select" is the surviving action and
          moves to the footer. Nothing re-applies px-4: .av2-sheet supplies the
          horizontal padding, and the file's own inset doubled it. */}
      <div>
        {/* §23.8b option rows: 52pt, checkmark on the selection. No max-height:
            .av2-sheet caps itself and scrolls, so calc(85dvh - 50px) here
            (carried over from the shadcn SheetContent that OWNED the 85dvh)
            constrained the list against a height it no longer sets. */}
        <div className="pb-2">
          {options.map((o) => {
            const isSel = current === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setPicked(o.value)}
                className="flex min-h-[52px] w-full items-center justify-between text-left"
                style={{
                  borderBottom: '1px solid var(--a-border)',
                  background: isSel ? 'var(--a-accent-wash)' : 'var(--a-surface)',
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[17px]" style={{ color: 'var(--a-text)' }}>{o.label}</span>
                  {o.sub ? <span className="block text-[12px]" style={{ color: 'var(--a-text-2)' }}>{o.sub}</span> : null}
                </span>
                {isSel ? <Check className="h-[18px] w-[18px] shrink-0" style={{ color: 'var(--a-accent)' }} /> : null}
              </button>
            )
          })}
        </div>

        {/* §23.8a confirm — the header bar's one surviving control. */}
        <div className="pt-1 pb-[env(safe-area-inset-bottom)]">
          <Button type="button" touch className="w-full" disabled={pending} onClick={confirm}>
            {pending ? 'Saving…' : 'Select'}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
