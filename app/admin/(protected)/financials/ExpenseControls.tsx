'use client'

// @no-parity — internal admin tool (brokerage expense entry)
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { addTcExpense, archiveTcExpense } from '@/app/actions/tc-financials'
import { TC_EXPENSE_CATEGORIES } from '@/lib/tc/expense-categories'

export function AddExpense() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [incurredOn, setIncurredOn] = useState('')
  const [vendor, setVendor] = useState('')
  const [dealKey, setDealKey] = useState('')

  const save = async () => {
    setBusy(true)
    setError(null)
    const res = await addTcExpense({
      category,
      description,
      amount: Number(amount),
      incurred_on: incurredOn,
      vendor: vendor || null,
      dealPropertyKey: dealKey || null,
    })
    setBusy(false)
    if (!res.ok) {
      setError(res.error ?? 'Save failed')
      return
    }
    window.location.reload()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add expense</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record an expense</DialogTitle>
          <DialogDescription>
            Lands in the P&L for the year it was incurred. Tie it to a deal with the deal key (the part
            after /admin/deals/ in the URL) or leave blank for overhead.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick one" />
              </SelectTrigger>
              <SelectContent>
                {TC_EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount $</Label>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" />
          </div>
          <div className="space-y-1.5">
            <Label>Incurred on</Label>
            <Input type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vendor (optional)</Label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Deal key (optional)</Label>
            <Input value={dealKey} onChange={(e) => setDealKey(e.target.value)} placeholder="e.g. 20373-saghali" />
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || !category || !amount || !incurredOn || !description.trim()}>
            {busy ? 'Saving…' : 'Save expense'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ArchiveExpense({ id, description }: { id: string; description: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        const reason = window.prompt(`Archive expense:\n${description}\n\nReason?`, 'entered in error')
        if (reason === null) return
        setBusy(true)
        const res = await archiveTcExpense(id, reason)
        if (!res.ok) {
          setBusy(false)
          window.alert(res.error || 'Failed')
          return
        }
        window.location.reload()
      }}
    >
      {busy ? '…' : 'Archive'}
    </Button>
  )
}
