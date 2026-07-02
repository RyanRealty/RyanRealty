'use client'

/**
 * Person-detail modals (spec docs/fub-crm-spec/07a + 07b + 07c):
 *
 *   EditPhonesDialog      — §07a 3.1.2 / §7c.6 "Edit Phone Numbers": rows of
 *                           Phone Number · Label (Mobile/Home/Work/Other/Fax) ·
 *                           Bad Number checkbox · trash, "+ Add another phone",
 *                           Cancel / Save Phone Numbers. Atomic save.
 *   AddRelationshipDialog — §07a 4.1 "Add relationship": First/Last name, free-
 *                           text Type ("Type e.g. Spouse"), phone rows with Bad
 *                           Number, email rows, Cancel / Save relationship.
 *   ApplyAutomationDialog — §07b 11 "Apply Automation": live-search + single-
 *                           select radio list of active automations, Cancel /
 *                           Apply (disabled until selected).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Search, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  savePhoneNumbersAction,
  addRelationshipContactAction,
  applyAutomationAction,
  type PhoneRow,
} from '@/app/actions/crm-person-detail'

const PHONE_LABELS = ['Mobile', 'Home', 'Work', 'Other', 'Fax']

function formatUsPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10)
  if (d.length <= 3) return d
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
}

// ── Edit Phone Numbers (§7c.6) ───────────────────────────────────────────────

export function EditPhonesDialog({
  personId,
  phones,
  trigger,
}: {
  personId: number
  phones: PhoneRow[]
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<PhoneRow[]>(phones)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  function reset() {
    setRows(phones.length > 0 ? phones : [{ value: '', label: 'Mobile', bad: false, isPrimary: true }])
    setError(null)
  }
  function update(i: number, patch: Partial<PhoneRow>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function save() {
    start(async () => {
      const r = await savePhoneNumbersAction(personId, rows)
      if (r.ok) {
        setOpen(false)
        router.refresh()
      } else setError(r.error)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Phone Numbers</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_120px_72px_32px] items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>Phone Number</span>
            <span>Label</span>
            <span>Bad Number</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_72px_32px] items-center gap-2">
              <Input
                value={formatUsPhone(r.value)}
                onChange={(e) => update(i, { value: e.target.value.replace(/\D/g, '') })}
                placeholder="(541) 555-0100"
                className="h-9 text-sm"
              />
              <Select value={r.label} onValueChange={(v) => update(i, { label: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_LABELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-center">
                <Checkbox checked={r.bad} onCheckedChange={(c) => update(i, { bad: c === true })} aria-label="Bad number" />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label="Remove phone"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm"
            disabled={rows.length >= 25}
            onClick={() => setRows((prev) => [...prev, { value: '', label: 'Mobile', bad: false, isPrimary: prev.length === 0 }])}
          >
            + Add another phone
          </Button>
          {rows.length >= 25 ? <p className="text-xs text-muted-foreground">Maximum 25 phone numbers per contact.</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            Save Phone Numbers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Add relationship (§07a 4.1) ──────────────────────────────────────────────

type RelPhone = { value: string; label: string; bad: boolean }

export function AddRelationshipDialog({ personId, trigger }: { personId: number; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [type, setType] = useState('')
  const [phones, setPhones] = useState<RelPhone[]>([{ value: '', label: 'Mobile', bad: false }])
  const [emails, setEmails] = useState<string[]>([''])
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  function save() {
    start(async () => {
      const r = await addRelationshipContactAction(personId, {
        firstName: first,
        lastName: last,
        type,
        phones,
        emails,
      })
      if (r.ok) {
        setOpen(false)
        router.refresh()
      } else setError(r.error)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setFirst('')
          setLast('')
          setType('')
          setPhones([{ value: '', label: 'Mobile', bad: false }])
          setEmails([''])
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Add relationship
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">First Name</Label>
              <Input value={first} onChange={(e) => setFirst(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Last Name</Label>
              <Input value={last} onChange={(e) => setLast(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="Type e.g. Spouse" className="h-9 text-sm" />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Phone number</Label>
            {phones.map((p, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border p-2">
                <div className="flex items-center gap-2">
                  <Select value={p.label} onValueChange={(v) => setPhones((prev) => prev.map((r, j) => (j === i ? { ...r, label: v } : r)))}>
                    <SelectTrigger className="h-8 w-28 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PHONE_LABELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={p.bad} onCheckedChange={(c) => setPhones((prev) => prev.map((r, j) => (j === i ? { ...r, bad: c === true } : r)))} />
                    Bad Number
                  </label>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Remove phone"
                    onClick={() => setPhones((prev) => prev.filter((_, j) => j !== i))}
                    className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={formatUsPhone(p.value)}
                  onChange={(e) => setPhones((prev) => prev.map((r, j) => (j === i ? { ...r, value: e.target.value.replace(/\D/g, '') } : r)))}
                  placeholder="(541) 555-0100"
                  className="h-9 text-sm"
                />
              </div>
            ))}
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => setPhones((prev) => [...prev, { value: '', label: 'Mobile', bad: false }])}>
              + Add another phone
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Email</Label>
            {emails.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={e}
                  onChange={(ev) => setEmails((prev) => prev.map((r, j) => (j === i ? ev.target.value : r)))}
                  placeholder="example@email.com"
                  className="h-9 flex-1 text-sm"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Remove email"
                  onClick={() => setEmails((prev) => prev.filter((_, j) => j !== i))}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-sm" onClick={() => setEmails((prev) => [...prev, ''])}>
              + Add another email
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !first.trim()}>
            Save relationship
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Apply Automation (§07b 11) ───────────────────────────────────────────────

export function ApplyAutomationDialog({
  personId,
  automations,
  trigger,
}: {
  personId: number
  automations: Array<{ id: number; name: string }>
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const filtered = automations.filter((a) => !query.trim() || a.name.toLowerCase().includes(query.trim().toLowerCase()))

  function apply() {
    if (!selected) return
    start(async () => {
      const r = await applyAutomationAction(personId, Number(selected))
      if (r.ok) {
        setOpen(false)
        router.refresh()
      } else setError(r.error)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) {
          setQuery('')
          setSelected(null)
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Apply Automation</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search automations..." className="h-9 pl-8 text-sm" />
        </div>
        <RadioGroup value={selected ?? ''} onValueChange={setSelected} className="max-h-64 gap-0 overflow-y-auto">
          {filtered.map((a) => (
            <label key={a.id} className="flex h-10 cursor-pointer items-center gap-3 rounded px-2 text-sm hover:bg-secondary">
              <RadioGroupItem value={String(a.id)} />
              {a.name}
            </label>
          ))}
          {filtered.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No automations found.</p> : null}
        </RadioGroup>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!selected || pending}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
