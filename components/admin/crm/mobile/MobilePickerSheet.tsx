'use client'

/**
 * MobilePickerSheet — the canonical §23.8 bottom-sheet picker (mob-35).
 *
 * Used by every single-select field on the mobile contact detail (Stage,
 * Assigned to, Collaborators…): slides up from the bottom, dark header with
 * Cancel · Title · Select, 52pt option rows with a right-aligned checkmark on
 * the current selection. "Select" confirms; Cancel/swipe-down dismisses.
 *
 * The confirm handler receives the picked value and runs the bound server
 * action inside a transition so the row UI can show a pending state.
 */

import { useState, useTransition } from 'react'
import { Check } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

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
    <Sheet open={open} onOpenChange={(v) => { if (!v) setPicked(null); onOpenChange(v) }}>
      <SheetContent aria-describedby={undefined} side="bottom" className="gap-0 overflow-hidden rounded-t-xl p-0" style={{ maxHeight: '85dvh' }}>
        {/* §23.8a modal header: Cancel · title · Select on the dark primary bar */}
        <div className="flex h-[50px] shrink-0 items-center justify-between bg-primary px-4">
          <button
            type="button"
            className="text-[17px] text-primary-foreground"
            onClick={() => { setPicked(null); onOpenChange(false) }}
          >
            Cancel
          </button>
          <SheetTitle className="text-[17px] font-semibold text-primary-foreground">{title}</SheetTitle>
          <button
            type="button"
            disabled={pending}
            className="text-[17px] text-primary-foreground disabled:opacity-60"
            onClick={confirm}
          >
            {pending ? 'Saving…' : 'Select'}
          </button>
        </div>

        {/* §23.8b option rows: 52pt, checkmark on the selection */}
        <div className="overflow-y-auto pb-[env(safe-area-inset-bottom)]" style={{ maxHeight: 'calc(85dvh - 50px)' }}>
          {options.map((o) => {
            const isSel = current === o.value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => setPicked(o.value)}
                className={cn(
                  'flex min-h-[52px] w-full items-center justify-between border-b border-border px-4 text-left',
                  isSel ? 'bg-primary/5' : 'bg-card',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[17px] text-foreground">{o.label}</span>
                  {o.sub ? <span className="block text-[12px] text-muted-foreground">{o.sub}</span> : null}
                </span>
                {isSel ? <Check className="h-[18px] w-[18px] shrink-0 text-primary" /> : null}
              </button>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
