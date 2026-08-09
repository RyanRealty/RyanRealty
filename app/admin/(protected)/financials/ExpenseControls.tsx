'use client'

// @no-parity — internal admin tool (brokerage expense entry)
//
// 11F: taken off shadcn and onto the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only — addTcExpense's payload
// (category, description, Number(amount), incurred_on, `vendor || null`,
// `dealPropertyKey: dealKey || null`), the archiveTcExpense(id, reason) call and
// its window.prompt/window.alert copy, both window.location.reload() calls, the
// busy latch, the disabled rule and every user-visible string are untouched.
//
// Substitutions, and why each one:
//   Dialog/DialogTrigger/… -> the v2 Dialog, which drives the platform <dialog>
//                         (focus trap, Esc, top-layer) instead of Radix. The
//                         trigger becomes a plain Button owning `open`.
//   Select + SelectValue -> SelectField. Radix's placeholder is not an option,
//                         so "Pick one" becomes the empty-value option — the
//                         same '' the Save button already tested for.
//   Input + Label      -> TextField, which owns the label-above pairing
//                         (pattern 6) and generates its own id. No test or
//                         script pins an id here — checked before relying on
//                         the generated ones.
//
// ONE primary Button per file (ci:admin-ui rule C): the dialog's "Save expense"
// keeps it, because it is the action that writes, and next to a quiet "Cancel"
// it is the only thing distinguishing commit from dismiss. The trigger goes
// quiet — the same call AddStageDialog recorded.
//
// Surface stack, checked both ways in design_system/admin/tokens.css: the
// dialog is --a-bg, its inputs are --a-bg inside a hairline, the quiet trigger
// and archive buttons are --a-surface. Nothing is painted onto its own parent.
import { useState } from 'react'
import { Button, Dialog, SelectField, TextField } from '@/components/admin/v2'
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
    <>
      <Button variant="quiet" onClick={() => setOpen(true)}>
        Add expense
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Record an expense"
        description="Lands in the P&L for the year it was incurred. Tie it to a deal with the deal key (the part after /admin/deals/ in the URL) or leave blank for overhead."
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={busy || !category || !amount || !incurredOn || !description.trim()}
            >
              {busy ? 'Saving…' : 'Save expense'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Pick one</option>
            {TC_EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Amount $"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />
          <TextField
            label="Incurred on"
            type="date"
            value={incurredOn}
            onChange={(e) => setIncurredOn(e.target.value)}
          />
          <TextField
            label="Vendor (optional)"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
          <div className="col-span-2">
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <TextField
              label="Deal key (optional)"
              value={dealKey}
              onChange={(e) => setDealKey(e.target.value)}
              placeholder="e.g. 20373-saghali"
            />
          </div>
        </div>

        {error ? (
          <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', margin: 0 }}>
            {error}
          </p>
        ) : null}
      </Dialog>
    </>
  )
}

export function ArchiveExpense({ id, description }: { id: string; description: string }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="quiet"
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
