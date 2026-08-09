'use client'

/**
 * AppointmentSheet — slide-over form for create / edit appointments.
 *
 * Fields: title, start, end, all-day switch, location, type, outcome, guest
 * contacts (select search over crm_people passed from the server), description,
 * "send invitation" checkbox.
 *
 * Form state is fully controlled so it resets cleanly on close without
 * unmounting the Sheet (keeps the open animation smooth).
 *
 * Admin v2 (11F): the shadcn Sheet is the v2 Sheet — the language's phone
 * overlay, which rises from the thumb and centres on a wide viewport — and
 * every shadcn primitive and semantic colour class is replaced by the v2 barrel
 * and var(--a-*). This file and AppointmentModal are the same appointment form
 * on two surfaces and stay in step with each other. Radix's non-selectable
 * SelectValue placeholder becomes `<option value="" disabled hidden>`, which
 * displays while the value is empty and never appears in the list — the same
 * placeholder wording, the same "cannot be chosen" behaviour.
 */

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button,
  IconButton,
  SearchField,
  SelectField,
  Sheet,
  Switch,
  TextAreaField,
  TextField,
} from '@/components/admin/v2'
import type { AppointmentRow, AppointmentType, AppointmentOutcome } from '@/lib/data/crm/getAppointments'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContactOption = { id: number; name: string | null }

export type AppointmentSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selected date (YYYY-MM-DD) for the start field. */
  initialDate?: string | null
  /** When editing, the existing row. Null = create mode. */
  appointment?: AppointmentRow | null
  /** Pre-linked primary contact for create mode (contact-detail Calendar tab). */
  presetPersonId?: number | null
  types: AppointmentType[]
  outcomes: AppointmentOutcome[]
  /** Full contact roster for the guest picker. */
  contacts: ContactOption[]
  /** Broker slugs available (superuser can assign to any). */
  brokerSlugs: string[]
  currentBrokerSlug: string
  isSuperuser: boolean
  createAction: (formData: FormData) => Promise<{ ok: boolean; error?: string; id?: number }>
  updateAction: (id: number, formData: FormData) => Promise<{ ok: boolean; error?: string }>
  /** Delete action — only called in edit mode with a two-step confirmation. */
  deleteAction?: (id: number) => Promise<{ ok: boolean; error?: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a Date to a datetime-local string (YYYY-MM-DDTHH:mm) */
function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Build a default start (9:00 AM on the given date) and end (+1 h). The caller
 * always supplies a date (the calendar's "+"/day-cell handlers pass one); the
 * clock fallback lives in the open-effect, never in render (hydration safety).
 */
function defaultTimes(dateIso: string, fallbackNow?: Date): { start: string; end: string } {
  const base = dateIso ? new Date(`${dateIso}T09:00:00`) : (fallbackNow ?? new Date(0))
  if (dateIso) {
    // Use exactly 9:00 AM on the given date
    base.setHours(9, 0, 0, 0)
  } else {
    // Round to next hour
    base.setMinutes(0, 0, 0)
    base.setHours(base.getHours() + 1)
  }
  const end = new Date(base.getTime() + 60 * 60 * 1000)
  return { start: toDatetimeLocal(base), end: toDatetimeLocal(end) }
}

const HAIRLINE = '1px solid var(--a-border)'

/** A read-only token naming a guest. Not FilterChip — that is the language's
 *  one pill and it toggles a filter; not StateWord — .av2-state uppercases, and
 *  a person's name is broker-facing data. */
const NAME_CHIP: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  border: HAIRLINE,
  borderRadius: 999,
  padding: '2px 4px 2px 10px',
  fontSize: 12,
  background: 'var(--a-surface)',
  color: 'var(--a-text-2)',
  whiteSpace: 'nowrap',
}

/** .av2-iconbtn owns display, size and padding, and admin-v2.css is UNLAYERED —
 *  it outranks Tailwind utilities regardless of specificity — so a flattened
 *  picker row restates its geometry inline. Deliberately no background: an
 *  inline one beats .av2-iconbtn:hover and would kill the row's hover tint. */
const PICKER_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: 8,
  width: '100%',
  height: 'auto',
  minHeight: 0,
  border: 'none',
  borderRadius: 'var(--a-r-sm)',
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 14,
  color: 'var(--a-text)',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppointmentSheet({
  open,
  onOpenChange,
  initialDate,
  appointment,
  presetPersonId,
  types,
  outcomes,
  contacts,
  brokerSlugs,
  currentBrokerSlug,
  isSuperuser,
  createAction,
  updateAction,
  deleteAction,
}: AppointmentSheetProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const isEdit = !!appointment

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle]           = useState('')
  const [startAt, setStartAt]       = useState('')
  const [endAt, setEndAt]           = useState('')
  const [allDay, setAllDay]         = useState(false)
  const [location, setLocation]     = useState('')
  const [description, setDesc]      = useState('')
  const [typeId, setTypeId]         = useState('')
  const [outcomeId, setOutcomeId]   = useState('')
  const [personId, setPersonId]     = useState('')
  const [guestIds, setGuestIds]     = useState<number[]>([])
  const [brokerSlug, setBrokerSlug] = useState(currentBrokerSlug)
  const [inviteSent, setInviteSent] = useState(false)

  // ── Guest contact search ────────────────────────────────────────────────────
  const [guestSearch, setGuestSearch] = useState('')
  const filteredContacts = contacts.filter((c) => {
    if (!guestSearch) return true
    return (c.name ?? '').toLowerCase().includes(guestSearch.toLowerCase())
  }).slice(0, 30)

  // ── Reset / seed from appointment on open ───────────────────────────────────
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) {
      // Opening
      if (appointment) {
        // Edit mode: seed from the existing row
        setTitle(appointment.title)
        setStartAt(appointment.startAt.slice(0, 16))
        setEndAt(appointment.endAt.slice(0, 16))
        setAllDay(appointment.allDay)
        setLocation(appointment.location ?? '')
        setDesc(appointment.description ?? '')
        setTypeId(appointment.typeId ? String(appointment.typeId) : '')
        setOutcomeId(appointment.outcomeId ? String(appointment.outcomeId) : '')
        setPersonId(appointment.personId ? String(appointment.personId) : '')
        setGuestIds(appointment.guestPersonIds ?? [])
        setBrokerSlug(appointment.brokerSlug ?? currentBrokerSlug)
        setInviteSent(appointment.inviteSent)
      } else {
        // Create mode — the clock fallback runs inside this effect only.
        const { start, end } = defaultTimes(initialDate ?? '', new Date())
        setTitle('')
        setStartAt(start)
        setEndAt(end)
        setAllDay(false)
        setLocation('')
        setDesc('')
        setTypeId('')
        setOutcomeId('')
        setPersonId(presetPersonId ? String(presetPersonId) : '')
        setGuestIds([])
        setBrokerSlug(currentBrokerSlug)
        setInviteSent(false)
      }
      setError(null)
      setGuestSearch('')
      setDeleteConfirm(false)
    }
    prevOpen.current = open
  }, [open, appointment, initialDate, currentBrokerSlug, presetPersonId])

  // ── Submit ──────────────────────────────────────────────────────────────────
  const submit = () => {
    setError(null)
    const fd = new FormData()
    fd.set('title',     title.trim())
    fd.set('startAt',   allDay ? `${startAt.slice(0, 10)}T00:00` : startAt)
    fd.set('endAt',     allDay ? `${startAt.slice(0, 10)}T23:59` : endAt)
    fd.set('allDay',    String(allDay))
    fd.set('location',  location.trim())
    fd.set('description', description.trim())
    if (typeId)    fd.set('typeId',    typeId)
    if (outcomeId) fd.set('outcomeId', outcomeId)
    if (personId)  fd.set('personId',  personId)
    fd.set('guestPersonIds', JSON.stringify(guestIds))
    fd.set('brokerSlug', brokerSlug)
    if (isEdit) fd.set('inviteSent', String(inviteSent))

    startTransition(async () => {
      let res: { ok: boolean; error?: string }
      if (isEdit && appointment) {
        res = await updateAction(appointment.id, fd)
      } else {
        res = await createAction(fd)
      }
      if (!res.ok) {
        setError(res.error ?? 'Could not save appointment')
        return
      }
      onOpenChange(false)
      router.refresh()
    })
  }

  // ── Guest toggle ────────────────────────────────────────────────────────────
  const toggleGuest = (id: number) => {
    setGuestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  // ── Delete (two-step) ───────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!deleteAction || !appointment) return
    startTransition(async () => {
      const res = await deleteAction(appointment.id)
      if (!res.ok) {
        setError(res.error ?? 'Could not delete appointment')
        setDeleteConfirm(false)
        return
      }
      onOpenChange(false)
      router.refresh()
    })
  }

  const activeTypes    = types.filter((t) => t.active)
  const activeOutcomes = outcomes.filter((o) => o.active)

  return (
    <Sheet
      open={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? 'Edit appointment' : 'New appointment'}
    >
      {/* Title */}
      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Buyer consultation with Smith family"
        autoFocus
      />

      {/* All-day switch */}
      <Switch
        label="All day"
        checked={allDay}
        onChange={(e) => setAllDay(e.target.checked)}
      />

      {/* Start / End */}
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Start"
            type="datetime-local"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
          <TextField
            label="End"
            type="datetime-local"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </div>
      )}

      {allDay && (
        <TextField
          label="Date"
          type="date"
          value={startAt.slice(0, 10)}
          onChange={(e) => {
            setStartAt(`${e.target.value}T00:00`)
            setEndAt(`${e.target.value}T23:59`)
          }}
        />
      )}

      {/* Location */}
      <TextField
        label="Location"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="123 Main St · Bend, OR or Zoom link"
      />

      <div style={{ height: 1, background: 'var(--a-border)' }} />

      {/* Type */}
      <SelectField label="Type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
        <option value="" disabled hidden>Select a type</option>
        <option value="none">None</option>
        {activeTypes.map((t) => (
          <option key={t.id} value={String(t.id)}>
            {t.name}
          </option>
        ))}
      </SelectField>

      {/* Outcome */}
      <SelectField label="Outcome" value={outcomeId} onChange={(e) => setOutcomeId(e.target.value)}>
        <option value="" disabled hidden>Select an outcome</option>
        <option value="none">None</option>
        {activeOutcomes.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.name}
          </option>
        ))}
      </SelectField>

      <div style={{ height: 1, background: 'var(--a-border)' }} />

      {/* Primary contact */}
      <SelectField label="Contact" value={personId} onChange={(e) => setPersonId(e.target.value)}>
        <option value="" disabled hidden>Link to a contact</option>
        <option value="none">None</option>
        {contacts.slice(0, 200).map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name ?? `Contact #${c.id}`}
          </option>
        ))}
      </SelectField>

      {/* Guest contacts */}
      <div className="space-y-1.5">
        <span className="av2-field__label block">Additional guests</span>
        <SearchField
          aria-label="Search contacts"
          type="text"
          placeholder="Search contacts..."
          value={guestSearch}
          onChange={(e) => setGuestSearch(e.target.value)}
          style={{ maxWidth: 'none', width: '100%', minHeight: 32 }}
        />
        {guestSearch && filteredContacts.length > 0 && (
          <div
            className="max-h-36 overflow-y-auto p-1"
            style={{ border: HAIRLINE, borderRadius: 'var(--a-r-md)', background: 'var(--a-surface)' }}
          >
            {filteredContacts.map((c) => {
              const selected = guestIds.includes(c.id)
              return (
                <IconButton
                  key={c.id}
                  label={c.name ?? `Contact #${c.id}`}
                  aria-pressed={selected}
                  onClick={() => toggleGuest(c.id)}
                  // The selected row is marked by the filled tick + weight, the
                  // way .av2-combo__opt[aria-selected] does it — NOT by an
                  // inline background, which would outrank .av2-iconbtn:hover
                  // and leave the row dead under the pointer.
                  style={{ ...PICKER_ROW, fontWeight: selected ? 600 : 400 }}
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-xs"
                    style={{
                      border: selected ? '1px solid var(--a-accent)' : HAIRLINE,
                      background: selected ? 'var(--a-accent)' : undefined,
                      color: selected ? 'var(--a-btn-fg)' : undefined,
                    }}
                  >
                    {selected ? '✓' : ''}
                  </span>
                  {c.name ?? `Contact #${c.id}`}
                </IconButton>
              )
            })}
          </div>
        )}
        {guestIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {guestIds.map((gid) => {
              const c = contacts.find((x) => x.id === gid)
              return (
                <span key={gid} style={NAME_CHIP}>
                  {c?.name ?? `#${gid}`}
                  <IconButton
                    label={`Remove ${c?.name}`}
                    onClick={() => toggleGuest(gid)}
                    style={{ width: 18, height: 18, borderRadius: 999, fontSize: 14 }}
                  >
                    ×
                  </IconButton>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Broker (superuser only) */}
      {isSuperuser && (
        <SelectField label="Assigned to" value={brokerSlug} onChange={(e) => setBrokerSlug(e.target.value)}>
          {brokerSlugs.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </SelectField>
      )}

      <div style={{ height: 1, background: 'var(--a-border)' }} />

      {/* Description */}
      <TextAreaField
        label="Notes"
        value={description}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Any context, agenda items, or follow-up notes."
        rows={3}
      />

      {/* Invite sent */}
      {isEdit && (
        <Switch
          label="Invitation sent"
          checked={inviteSent}
          onChange={(e) => setInviteSent(e.target.checked)}
        />
      )}

      {/* Error */}
      {error && (
        <p className="text-sm font-medium" style={{ color: 'var(--a-danger)' }}>{error}</p>
      )}

      {/* Footer */}
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-3 pt-3"
        style={{ borderTop: HAIRLINE }}
      >
        <div className="flex items-center gap-2">
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {/* Two-step delete — only in edit mode, only if deleteAction is wired */}
          {isEdit && deleteAction && (
            deleteConfirm ? (
              <Button variant="danger" disabled={pending} onClick={handleDelete}>
                {pending ? 'Deleting…' : 'Confirm delete'}
              </Button>
            ) : (
              <Button
                variant="quiet"
                disabled={pending}
                onClick={() => setDeleteConfirm(true)}
                // Colour only — no inline background, so .av2-btn--quiet:hover
                // still tints the control the way the shadcn ghost did.
                style={{ color: 'var(--a-danger)' }}
              >
                Delete
              </Button>
            )
          )}
        </div>
        <Button disabled={pending || !title.trim()} onClick={submit}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create appointment'}
        </Button>
      </div>
    </Sheet>
  )
}
