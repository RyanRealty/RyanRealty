'use client'

// @no-parity — internal admin tool (TC commission edit)
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

  const num = (v: string, set: (s: string) => void) => (
    <Input inputMode="decimal" value={v} onChange={(e) => set(e.target.value)} className="tabular-nums" />
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {row.broker_name} commission
          </DialogTitle>
          <DialogDescription>
            Nets recompute from the recorded gross minus fees. Every change lands in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Agent split %</Label>
            {num(split, setSplit)}
          </div>
          <div className="space-y-1.5">
            <Label>Referral fee $</Label>
            {num(referral, setReferral)}
          </div>
          <div className="space-y-1.5">
            <Label>TC fee $</Label>
            {num(tcFee, setTcFee)}
          </div>
          <div className="space-y-1.5">
            <Label>Other deductions $</Label>
            {num(deductions, setDeductions)}
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as TcCommission['status'])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as Array<TcCommission['status']>).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === 'paid' ? (
            <div className="space-y-1.5">
              <Label>Paid on</Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>
          ) : null}
          <div className="col-span-2 space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
