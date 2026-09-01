'use client'

/**
 * Per-row "Record handoff" opener. The two-field form lives in a dialog so the
 * waiting-on-a-handoff queue reads as a queue, not a stack of inline forms.
 */
import { useState } from 'react'
import { Button, Dialog, HiddenField, TextField } from '@/components/admin/v2'

export function RecordHandoffButton({
  personId,
  personName,
  action,
  disabled,
}: {
  personId: number
  personName: string
  action: (formData: FormData) => Promise<void>
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)} disabled={disabled}>
        Record handoff
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Record handoff — ${personName}`}>
        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HiddenField name="personId" value={String(personId)} />
          <TextField label="Referred to" name="referredTo" required placeholder="Broker, brokerage" />
          <TextField
            label="Fee %"
            name="feeBasisPct"
            type="number"
            min={0}
            max={100}
            step="0.5"
            placeholder="25"
            hint="Blank means 25"
            style={{ maxWidth: 120 }}
          />
          <div>
            <Button type="submit">Record handoff</Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
