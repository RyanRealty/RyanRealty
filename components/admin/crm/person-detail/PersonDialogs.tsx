'use client'

/**
 * Person-detail modals (spec docs/crm-spec/07a + 07b + 07c):
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
 *
 * 11F: on the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY — every export, prop, handler, action and user-visible
 * string is unchanged. Three notes on the swap:
 *  - The v2 Dialog is `open`-controlled and has no trigger slot, but each of
 *    these components still takes its trigger as a ReactNode prop. The open
 *    handler is attached to that element the way Radix's asChild did
 *    (`triggerWithOpen` below), so no caller has to change.
 *  - The Label+Input pairs become TextField, which associates the two for real.
 *    They were a bare <Label> next to a bare <Input> with no htmlFor and no id,
 *    so the label was decorative; the visible words are identical.
 *  - One primary Button PER DIALOG, not per file. Each of the three is its own
 *    view with its own single commit action ("Save Phone Numbers", "Save
 *    relationship", "Apply"); demoting two of them would leave a modal with no
 *    primary action in it.
 */

import { cloneElement, isValidElement, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Search } from 'lucide-react'
import {
  Button,
  Dialog,
  IconButton,
  SearchField,
  TextField,
  ToolbarCheck,
  ToolbarRadio,
  ToolbarSelect,
} from '@/components/admin/v2'
import {
  savePhoneNumbersAction,
  addRelationshipContactAction,
  applyAutomationAction,
  type PhoneRow,
} from '@/app/actions/crm-person-detail'

const PHONE_LABELS = ['Mobile', 'Home', 'Work', 'Other', 'Fax']

/** Group heading inside a modal body (was a bare <Label> over a row set). */
const GROUP_LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--a-text-sm)',
  fontWeight: 600,
  color: 'var(--a-text)',
}

const ERROR_STYLE: React.CSSProperties = { color: 'var(--a-danger)' }

/**
 * Attach "open this dialog" to a caller-supplied trigger element, chaining any
 * onClick it already carries instead of replacing it. This is what Radix's
 * `asChild` did for the DialogTrigger these dialogs used to render.
 */
function triggerWithOpen(trigger: React.ReactNode, open: () => void): React.ReactNode {
  if (!isValidElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>(trigger)) return trigger
  const existing = trigger.props.onClick
  return cloneElement(trigger, {
    onClick: (e: React.MouseEvent<HTMLElement>) => {
      existing?.(e)
      open()
    },
  })
}

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
    <>
      {triggerWithOpen(trigger, () => {
        setOpen(true)
        reset()
      })}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit Phone Numbers"
        size="work"
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              Save Phone Numbers
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div
            className="grid grid-cols-[1fr_120px_72px_32px] items-center gap-2 text-xs font-semibold"
            style={{ color: 'var(--a-text-2)' }}
          >
            <span>Phone Number</span>
            <span>Label</span>
            <span>Bad Number</span>
            <span />
          </div>
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_72px_32px] items-center gap-2">
              <SearchField
                aria-label="Phone number"
                // Explicit type="text": SearchField defaults to type="search",
                // which paints a browser clear glyph the old control never had.
                type="text"
                value={formatUsPhone(r.value)}
                onChange={(e) => update(i, { value: e.target.value.replace(/\D/g, '') })}
                placeholder="(541) 555-0100"
                className="w-full"
                style={{ maxWidth: 'none' }}
              />
              <ToolbarSelect
                aria-label="Phone label"
                value={r.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className="w-full"
                style={{ maxWidth: 'none' }}
              >
                {PHONE_LABELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </ToolbarSelect>
              <div className="flex justify-center">
                <ToolbarCheck
                  label={null}
                  aria-label="Bad number"
                  checked={r.bad}
                  onChange={(e) => update(i, { bad: e.target.checked })}
                />
              </div>
              <IconButton
                label="Remove phone"
                tone="danger"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
          <Button
            variant="quiet"
            className="av2-textlink"
            disabled={rows.length >= 25}
            onClick={() =>
              setRows((prev) => [...prev, { value: '', label: 'Mobile', bad: false, isPrimary: prev.length === 0 }])
            }
          >
            + Add another phone
          </Button>
          {rows.length >= 25 ? (
            <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
              Maximum 25 phone numbers per contact.
            </p>
          ) : null}
          {error ? (
            <p className="text-sm" style={ERROR_STYLE}>
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
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
    <>
      {triggerWithOpen(trigger, () => {
        setOpen(true)
        setFirst('')
        setLast('')
        setType('')
        setPhones([{ value: '', label: 'Mobile', bad: false }])
        setEmails([''])
        setError(null)
      })}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add relationship"
        size="work"
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending || !first.trim()}>
              Save relationship
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* The old DialogTitle carried a Users glyph beside the words. The v2
              Dialog title is a plain string, and §1 gives hierarchy to type and
              space rather than decoration, so the glyph is gone and the title
              text is untouched. */}
          <div className="grid grid-cols-2 gap-2">
            <TextField label="First Name" value={first} onChange={(e) => setFirst(e.target.value)} />
            <TextField label="Last Name" value={last} onChange={(e) => setLast(e.target.value)} />
          </div>
          <TextField
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Type e.g. Spouse"
          />

          <div className="space-y-2">
            <span style={GROUP_LABEL_STYLE}>Phone number</span>
            {phones.map((p, i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg p-2"
                style={{ border: '1px solid var(--a-border)' }}
              >
                <div className="flex items-center gap-2">
                  <ToolbarSelect
                    aria-label="Phone label"
                    value={p.label}
                    onChange={(e) =>
                      setPhones((prev) => prev.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
                    }
                    className="w-28 shrink-0"
                  >
                    {PHONE_LABELS.map((l) => (
                      <option key={l} value={l}>
                        {l.toLowerCase()}
                      </option>
                    ))}
                  </ToolbarSelect>
                  <ToolbarCheck
                    label="Bad Number"
                    checked={p.bad}
                    onChange={(e) =>
                      setPhones((prev) => prev.map((r, j) => (j === i ? { ...r, bad: e.target.checked } : r)))
                    }
                  />
                  <IconButton
                    label="Remove phone"
                    tone="danger"
                    className="ml-auto"
                    onClick={() => setPhones((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
                <SearchField
                  aria-label="Phone number"
                  type="text"
                  value={formatUsPhone(p.value)}
                  onChange={(e) =>
                    setPhones((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, value: e.target.value.replace(/\D/g, '') } : r)),
                    )
                  }
                  placeholder="(541) 555-0100"
                  className="w-full"
                  style={{ maxWidth: 'none' }}
                />
              </div>
            ))}
            <Button
              variant="quiet"
              className="av2-textlink"
              onClick={() => setPhones((prev) => [...prev, { value: '', label: 'Mobile', bad: false }])}
            >
              + Add another phone
            </Button>
          </div>

          <div className="space-y-2">
            <span style={GROUP_LABEL_STYLE}>Email</span>
            {emails.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <SearchField
                  aria-label="Email"
                  type="text"
                  value={e}
                  onChange={(ev) => setEmails((prev) => prev.map((r, j) => (j === i ? ev.target.value : r)))}
                  placeholder="example@email.com"
                  className="min-w-0 flex-1"
                  style={{ maxWidth: 'none' }}
                />
                <IconButton
                  label="Remove email"
                  tone="danger"
                  onClick={() => setEmails((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
            <Button
              variant="quiet"
              className="av2-textlink"
              onClick={() => setEmails((prev) => [...prev, ''])}
            >
              + Add another email
            </Button>
          </div>

          {error ? (
            <p className="text-sm" style={ERROR_STYLE}>
              {error}
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
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
    <>
      {triggerWithOpen(trigger, () => {
        setOpen(true)
        setQuery('')
        setSelected(null)
        setError(null)
      })}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Apply Automation"
        size="work"
        footer={
          <>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={apply} disabled={!selected || pending}>
              Apply
            </Button>
          </>
        }
      >
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--a-text-2)' }}
            aria-hidden
          />
          <SearchField
            aria-label="Search automations"
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search automations..."
            className="w-full"
            // Inline padding, not pl-8: .av2-input--bar declares its padding
            // UNLAYERED, so a Tailwind utility loses and the glyph would sit on
            // top of the text.
            style={{ maxWidth: 'none', paddingLeft: 32 }}
          />
        </div>
        {/* Native radios sharing one `name` are their own group: the platform
            gives arrow-key roving and single-select for free, which is all the
            Radix RadioGroup was doing here. */}
        <div role="radiogroup" aria-label="Automations" className="max-h-64 overflow-y-auto">
          {filtered.map((a) => (
            <ToolbarRadio
              key={a.id}
              name="apply-automation"
              label={a.name}
              value={String(a.id)}
              checked={selected === String(a.id)}
              onChange={() => setSelected(String(a.id))}
              labelStyle={{ display: 'flex', height: 40, gap: 12, padding: '0 8px' }}
            />
          ))}
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: 'var(--a-text-2)' }}>
              No automations found.
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="text-sm" style={ERROR_STYLE}>
            {error}
          </p>
        ) : null}
      </Dialog>
    </>
  )
}
