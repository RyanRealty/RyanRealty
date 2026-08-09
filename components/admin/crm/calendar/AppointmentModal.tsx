'use client'

/**
 * AppointmentModal — the §2.6 Create/Edit Appointment modal
 * (docs/fub-crm-spec/09-tasks-and-calendar.md Part 2).
 *
 * Centered dialog with the spec's full field inventory: Title, Start date,
 * Start time, End time, End date, Timezone, All-day toggle (hides time
 * pickers), Location (map-pin), guest search + avatar chips with the current
 * user pre-populated, Type ("Set type") + Outcome ("No Outcome") side-by-side,
 * rich-text Notes, "Send invitation" checkbox (defaults unchecked — §2.6
 * gotcha), full-width Create button, X dismiss.
 *
 * AC-17: editing an appointment whose invitation was previously sent while the
 * checkbox is unchecked surfaces a warning that the reminder will be canceled
 * (FUB silently cancels — we warn instead).
 *
 * Admin v2 (11F): shadcn primitives replaced by '@/components/admin/v2' and
 * every semantic Tailwind colour class by a var(--a-*) token. This file and
 * AppointmentSheet are the same appointment form on two surfaces and stay in
 * step with each other. Fields that carried an aria-label instead of a visible
 * one keep it — SearchField/ToolbarSelect require the accessible name in their
 * types, so dropping the visible label never drops the accessible one.
 */

import { useEffect, useRef, useState, useTransition, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Search, X } from 'lucide-react'
import {
  Button,
  Dialog,
  IconButton,
  SearchField,
  TextField,
  ToolbarCheck,
  ToolbarSelect,
} from '@/components/admin/v2'
import { RichTextBody } from '@/app/admin/(protected)/crm/settings/_components/templates/RichTextBody'
import { time12, wallDateKey, wallMinutes } from '@/lib/crm/calendar'
import type { AppointmentRow, AppointmentType, AppointmentOutcome } from '@/lib/data/crm/getAppointments'

// ── Types ─────────────────────────────────────────────────────────────────────

export type GuestChip = { id: number; name: string }

export type BrokerOption = { slug: string; name: string }

export type AppointmentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Null = create. */
  appointment?: AppointmentRow | null
  /** Create-mode prefill (clicking a day cell / empty slot). */
  initialDate?: string | null
  initialStartMin?: number | null
  types: AppointmentType[]
  outcomes: AppointmentOutcome[]
  brokers: BrokerOption[]
  currentBrokerSlug: string
  isSuperuser: boolean
  /** Resolves guest ids → names for edit-mode chips. */
  guestNames: Record<number, string>
  searchContacts: (q: string) => Promise<{ ok: boolean; results?: GuestChip[]; error?: string }>
  createAction: (fd: FormData) => Promise<{ ok: boolean; error?: string; id?: number }>
  updateAction: (id: number, fd: FormData) => Promise<{ ok: boolean; error?: string }>
  deleteAction: (id: number) => Promise<{ ok: boolean; error?: string }>
}

// ── Timezone options (§2.6 field 6) ───────────────────────────────────────────

const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'America/Los_Angeles', label: 'Pacific Time' },
  { value: 'America/Denver', label: 'Mountain Time' },
  { value: 'America/Chicago', label: 'Central Time' },
  { value: 'America/New_York', label: 'Eastern Time' },
]

const HAIRLINE = '1px solid var(--a-border)'

/** An unlabelled full-width control: SearchField ships as a compact toolbar
 *  input (av2-input--bar caps it at 200px), and these are form-width fields. */
const WIDE_INPUT: CSSProperties = {
  maxWidth: 'none',
  width: '100%',
  minHeight: 'var(--a-touch)',
  fontSize: 14,
}

/** A read-only token naming a person. Not FilterChip — that is the language's
 *  one pill and it toggles a filter; these label a guest. Not StateWord either:
 *  .av2-state uppercases, and a person's name is broker-facing data. */
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

/** .av2-btn / .av2-iconbtn own display, padding and height, and admin-v2.css is
 *  UNLAYERED — it outranks Tailwind utilities regardless of specificity — so a
 *  flattened result row restates its geometry inline. No colour here: an inline
 *  background beats the stylesheet's :hover rule and would kill the affordance. */
const RESULT_ROW: CSSProperties = {
  display: 'block',
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

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60) % 24
  return `${String(h).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AppointmentModal({
  open,
  onOpenChange,
  appointment,
  initialDate,
  initialStartMin,
  types,
  outcomes,
  brokers,
  currentBrokerSlug,
  isSuperuser,
  guestNames,
  searchContacts,
  createAction,
  updateAction,
  deleteAction,
}: AppointmentModalProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const isEdit = !!appointment

  // ── Form state (the 16-field inventory) ─────────────────────────────────────
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('08:30')
  const [endDate, setEndDate] = useState('')
  const [timezone, setTimezone] = useState('America/Los_Angeles')
  const [allDay, setAllDay] = useState(false)
  const [location, setLocation] = useState('')
  const [guests, setGuests] = useState<GuestChip[]>([])
  const [typeId, setTypeId] = useState('none')
  const [outcomeId, setOutcomeId] = useState('none')
  const [notes, setNotes] = useState('')
  const [sendInvitation, setSendInvitation] = useState(false)
  const [brokerSlug, setBrokerSlug] = useState(currentBrokerSlug)

  // ── Guest search (live, via server action) ──────────────────────────────────
  const [guestQuery, setGuestQuery] = useState('')
  const [guestResults, setGuestResults] = useState<GuestChip[]>([])
  const searchSeq = useRef(0)
  useEffect(() => {
    const q = guestQuery.trim()
    if (!q) { setGuestResults([]); return }
    const seq = ++searchSeq.current
    const t = setTimeout(async () => {
      const res = await searchContacts(q)
      if (seq === searchSeq.current && res.ok) setGuestResults(res.results ?? [])
    }, 200)
    return () => clearTimeout(t)
  }, [guestQuery, searchContacts])

  // ── Seed on open ────────────────────────────────────────────────────────────
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) {
      if (appointment) {
        setTitle(appointment.title)
        setStartDate(wallDateKey(appointment.startAt))
        setEndDate(wallDateKey(appointment.endAt))
        setStartTime(minutesToHHMM(wallMinutes(appointment.startAt)))
        setEndTime(minutesToHHMM(wallMinutes(appointment.endAt)))
        setTimezone(appointment.timezone ?? 'America/Los_Angeles')
        setAllDay(appointment.allDay)
        setLocation(appointment.location ?? '')
        setTypeId(appointment.typeId ? String(appointment.typeId) : 'none')
        setOutcomeId(appointment.outcomeId ? String(appointment.outcomeId) : 'none')
        setNotes(appointment.description ?? '')
        setBrokerSlug(appointment.brokerSlug ?? currentBrokerSlug)
        const chips: GuestChip[] = []
        if (appointment.personId) {
          chips.push({ id: appointment.personId, name: appointment.personName ?? guestNames[appointment.personId] ?? `#${appointment.personId}` })
        }
        for (const gid of appointment.guestPersonIds ?? []) {
          chips.push({ id: gid, name: guestNames[gid] ?? `#${gid}` })
        }
        setGuests(chips)
        // §2.6 gotcha (AC-17): reopening always unchecks the box; the warning
        // below tells the user re-saving cancels the pending reminder.
        setSendInvitation(false)
      } else {
        const d = initialDate ?? ''
        setTitle('')
        setStartDate(d)
        setEndDate(d)
        const startMin = initialStartMin ?? 8 * 60
        setStartTime(minutesToHHMM(startMin))
        setEndTime(minutesToHHMM(Math.min(startMin + 30, 23 * 60 + 59)))
        setTimezone('America/Los_Angeles')
        setAllDay(false)
        setLocation('')
        setGuests([])
        setTypeId('none')
        setOutcomeId('none')
        setNotes('')
        setSendInvitation(false)
        setBrokerSlug(currentBrokerSlug)
      }
      setError(null)
      setGuestQuery('')
      setGuestResults([])
      setDeleteConfirm(false)
    }
    prevOpen.current = open
  }, [open, appointment, initialDate, initialStartMin, currentBrokerSlug, guestNames])

  const addGuest = (g: GuestChip) => {
    setGuests((prev) => (prev.some((x) => x.id === g.id) ? prev : [...prev, g]))
    setGuestQuery('')
    setGuestResults([])
  }
  const removeGuest = (id: number) => setGuests((prev) => prev.filter((g) => g.id !== id))

  // ── Submit ──────────────────────────────────────────────────────────────────
  const submit = () => {
    setError(null)
    const fd = new FormData()
    fd.set('title', title.trim())
    if (allDay) {
      fd.set('startAt', `${startDate}T00:00`)
      fd.set('endAt', `${endDate || startDate}T23:59`)
    } else {
      fd.set('startAt', `${startDate}T${startTime}`)
      fd.set('endAt', `${endDate || startDate}T${endTime}`)
    }
    fd.set('allDay', String(allDay))
    fd.set('timezone', timezone)
    fd.set('location', location.trim())
    fd.set('description', notes.trim())
    if (typeId !== 'none') fd.set('typeId', typeId)
    if (outcomeId !== 'none') fd.set('outcomeId', outcomeId)
    if (guests[0]) fd.set('personId', String(guests[0].id))
    fd.set('guestPersonIds', JSON.stringify(guests.slice(1).map((g) => g.id)))
    fd.set('brokerSlug', brokerSlug)
    fd.set('sendInvitation', String(sendInvitation))

    startTransition(async () => {
      const res = isEdit && appointment
        ? await updateAction(appointment.id, fd)
        : await createAction(fd)
      if (!res.ok) {
        setError(res.error ?? 'Could not save appointment')
        return
      }
      onOpenChange(false)
      router.refresh()
    })
  }

  const handleDelete = () => {
    if (!appointment) return
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

  const activeTypes = types.filter((t) => t.active)
  const activeOutcomes = outcomes.filter((o) => o.active)
  const brokerName = brokers.find((b) => b.slug === brokerSlug)?.name ?? brokerSlug
  const reminderCancelWarning = isEdit && !!appointment?.inviteSent && !sendInvitation

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={isEdit ? 'Edit Appointment' : 'Create Appointment'}
      size="work"
    >
      <div className="space-y-4">
        {/* 1 — Title */}
        <SearchField
          aria-label="Title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add title"
          autoFocus
          style={{ ...WIDE_INPUT, fontSize: 16 }}
        />

        {/* 2–5 — Start date · start time · end time · end date */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TextField
            label="Start date"
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value) }}
          />
          {!allDay && (
            <TextField
              label="Start time"
              type="time"
              step={1800}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          )}
          {!allDay && (
            <TextField
              label="End time"
              type="time"
              step={1800}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          )}
          <TextField
            label="End date"
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* 6 — Timezone · 7 — All day */}
        <div className="flex flex-wrap items-center gap-4">
          <ToolbarSelect
            aria-label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-48"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </ToolbarSelect>
          <ToolbarCheck
            label="All day event"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
        </div>

        {/* 8 — Location */}
        <div className="relative">
          <MapPin
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--a-text-2)' }}
            aria-hidden
          />
          <SearchField
            aria-label="Location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Add location"
            style={{ ...WIDE_INPUT, paddingLeft: 36 }}
          />
        </div>

        {/* 9–10 — Add guests + pre-populated current user */}
        <div className="space-y-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--a-text-2)' }}
              aria-hidden
            />
            <SearchField
              aria-label="Add guests"
              type="text"
              value={guestQuery}
              onChange={(e) => setGuestQuery(e.target.value)}
              placeholder="Add guests"
              style={{ ...WIDE_INPUT, paddingLeft: 36 }}
            />
            {guestResults.length > 0 && (
              <div
                className="absolute inset-x-0 top-full z-20 mt-1 max-h-44 overflow-y-auto p-1"
                // surface, not bg: the dialog itself is var(--a-bg), and a panel
                // painted with its own parent's token is an invisible element.
                style={{
                  border: HAIRLINE,
                  borderRadius: 'var(--a-r-md)',
                  background: 'var(--a-surface)',
                  boxShadow: 'var(--a-shadow-overlay)',
                }}
              >
                {guestResults.map((g) => (
                  <IconButton
                    key={g.id}
                    label={g.name}
                    onClick={() => addGuest(g)}
                    style={RESULT_ROW}
                  >
                    {g.name}
                  </IconButton>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Current user (assigned broker) — auto-added guest chip */}
            {isSuperuser ? (
              <ToolbarSelect
                aria-label="Assigned broker"
                value={brokerSlug}
                onChange={(e) => setBrokerSlug(e.target.value)}
                className="w-auto"
                style={{ borderRadius: 999, maxWidth: 'none' }}
              >
                {brokers.map((b) => (
                  <option key={b.slug} value={b.slug}>{b.name}</option>
                ))}
              </ToolbarSelect>
            ) : (
              <span style={{ ...NAME_CHIP, paddingRight: 10 }}>{brokerName}</span>
            )}
            {guests.map((g) => (
              <span key={g.id} style={NAME_CHIP}>
                {g.name}
                <IconButton
                  label={`Remove ${g.name}`}
                  onClick={() => removeGuest(g.id)}
                  style={{ width: 18, height: 18, borderRadius: 999 }}
                >
                  <X className="h-3 w-3" aria-hidden />
                </IconButton>
              </span>
            ))}
          </div>
        </div>

        {/* 11–12 — Type + Outcome */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ToolbarSelect
            aria-label="Type"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            style={WIDE_INPUT}
          >
            <option value="none">Set type</option>
            {activeTypes.map((t) => (
              <option key={t.id} value={String(t.id)}>{t.name}</option>
            ))}
          </ToolbarSelect>
          <ToolbarSelect
            aria-label="Outcome"
            value={outcomeId}
            onChange={(e) => setOutcomeId(e.target.value)}
            style={WIDE_INPUT}
          >
            <option value="none">No Outcome</option>
            {activeOutcomes.map((o) => (
              <option key={o.id} value={String(o.id)}>{o.name}</option>
            ))}
          </ToolbarSelect>
        </div>

        {/* 13 — Notes (rich text) */}
        <RichTextBody value={notes} onChange={setNotes} minHeight={110} />

        {/* 14 — Send invitation */}
        <ToolbarCheck
          checked={sendInvitation}
          onChange={(e) => setSendInvitation(e.target.checked)}
          labelStyle={{ alignItems: 'flex-start' }}
          label={
            <span className="block leading-snug">
              Send invitation email to linked contacts
              <span className="block text-xs font-normal" style={{ color: 'var(--a-text-2)' }}>
                Sent from your Gmail to each contact&rsquo;s primary email. Text reminders are not enabled yet.
              </span>
            </span>
          }
        />

        {/* AC-17 — pending-reminder cancel warning */}
        {reminderCancelWarning && (
          <div
            className="text-sm"
            style={{
              border: HAIRLINE,
              borderRadius: 'var(--a-r-md)',
              padding: 'var(--a-s3)',
              background: 'var(--a-warn-wash)',
              color: 'var(--a-text)',
            }}
          >
            An invitation was already sent for this appointment. Saving without re-checking
            &ldquo;Send invitation&rdquo; cancels the pending reminder — no update email goes out.
          </div>
        )}

        {error && <p className="text-sm font-medium" style={{ color: 'var(--a-danger)' }}>{error}</p>}

        {/* 15 — Submit (full width) + delete in edit mode */}
        <Button
          disabled={pending || !title.trim() || !startDate}
          onClick={submit}
          className="w-full"
        >
          {pending ? 'Saving…' : isEdit ? 'Save Appointment' : 'Create Appointment'}
        </Button>
        {isEdit && (
          deleteConfirm ? (
            <Button variant="danger" disabled={pending} onClick={handleDelete} className="w-full">
              {pending ? 'Deleting…' : 'Confirm delete'}
            </Button>
          ) : (
            <Button
              variant="quiet"
              disabled={pending}
              onClick={() => setDeleteConfirm(true)}
              className="w-full"
              // Colour only — no inline background, so .av2-btn--quiet:hover
              // still tints the row the way the shadcn ghost did.
              style={{ color: 'var(--a-danger)' }}
            >
              Delete appointment
            </Button>
          )
        )}
      </div>
    </Dialog>
  )
}
