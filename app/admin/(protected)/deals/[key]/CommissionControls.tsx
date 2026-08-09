'use client'

// @no-parity — internal admin tool (TC commission edit)
//
// 11F: off shadcn, onto the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only — every field, every
// coercion into updateTcCommission, the paid_at null-when-not-paid rule, the
// trimmed-notes-or-null rule and the reload are carried over unchanged.
//
// Dialog size stays the default 'ask' (460px): the shadcn modal was
// sm:max-w-md (448px), so 'work' would widen a surface nobody asked to widen.
// The two-column grid it holds is the same one it always had.
//
// The number fields keep their tabular numerals through `style` rather than
// `className` — TextField spreads its rest props onto the input AFTER its own
// className="av2-input", so a className prop would silently delete the
// control's entire skin.
import { useState } from 'react'
import { Button, Dialog, SelectField, TextAreaField, TextField } from '@/components/admin/v2'
import { updateTcCommission, type TcCommission } from '@/app/actions/tc-commissions'

const STATUS_LABEL: Record<TcCommission['status'], string> = {
  projected: 'Projected',
  settlement_verified: 'Settlement verified',
  paid: 'Paid',
}

export function CommissionEdit({ row }: { row: TcCommission }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [split, setSplit] = useState(String(row.split_percent))
  const [referral, setReferral] = useState(String(row.referral_fee))
  const [tcFee, setTcFee] = useState(String(row.tc_fee))
  const [deductions, setDeductions] = useState(String(row.other_deductions))
  const [status, setStatus] = useState<TcCommission['status']>(row.status)
  const [paidAt, setPaidAt] = useState(row.paid_at ?? '')
  const [notes, setNotes] = useState(row.notes ?? '')

  const save = async () => {
    setBusy(true)
    setError(null)
    const res = await updateTcCommission(row.id, {
      split_percent: Number(split),
      referral_fee: Number(referral),
      tc_fee: Number(tcFee),
      other_deductions: Number(deductions),
      status,
      paid_at: status === 'paid' ? paidAt || null : null,
      notes: notes.trim() || null,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Save failed')
      return
    }
    window.location.reload()
  }

  const num = (label: string, v: string, set: (s: string) => void) => (
    <TextField
      label={label}
      inputMode="decimal"
      value={v}
      onChange={(e) => set(e.target.value)}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    />
  )

  return (
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`${row.broker_name} commission`}
        description="Nets recompute from the recorded gross minus fees. Every change lands in the audit trail."
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          {num('Agent split %', split, setSplit)}
          {num('Referral fee $', referral, setReferral)}
          {num('TC fee $', tcFee, setTcFee)}
          {num('Other deductions $', deductions, setDeductions)}
          <SelectField
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TcCommission['status'])}
          >
            {(Object.keys(STATUS_LABEL) as Array<TcCommission['status']>).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </SelectField>
          {status === 'paid' ? (
            <TextField
              label="Paid on"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          ) : null}
          <div className="col-span-2">
            <TextAreaField
              label="Notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {error ? (
          <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-danger)' }}>{error}</p>
        ) : null}
      </Dialog>
    </>
  )
}
