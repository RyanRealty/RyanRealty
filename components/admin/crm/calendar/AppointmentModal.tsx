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
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Search, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RichTextBody } from '@/components/admin/crm/settings/templates/RichTextBody'
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-semibold">
            {isEdit ? 'Edit Appointment' : 'Create Appointment'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-5 pb-5">
          {/* 1 — Title */}
          <Input
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add title"
            autoFocus
            className="h-10 text-base"
          />

          {/* 2–5 — Start date · start time · end time · end date */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="appt-start-date" className="text-xs text-muted-foreground">Start date</Label>
              <Input id="appt-start-date" type="date" value={startDate}
                onChange={(e) => { setStartDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value) }} />
            </div>
            {!allDay && (
              <div className="space-y-1">
                <Label htmlFor="appt-start-time" className="text-xs text-muted-foreground">Start time</Label>
                <Input id="appt-start-time" type="time" step={1800} value={startTime}
                  onChange={(e) => setStartTime(e.target.value)} />
              </div>
            )}
            {!allDay && (
              <div className="space-y-1">
                <Label htmlFor="appt-end-time" className="text-xs text-muted-foreground">End time</Label>
                <Input id="appt-end-time" type="time" step={1800} value={endTime}
                  onChange={(e) => setEndTime(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="appt-end-date" className="text-xs text-muted-foreground">End date</Label>
              <Input id="appt-end-date" type="date" value={endDate} min={startDate}
                onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          {/* 6 — Timezone · 7 — All day */}
          <div className="flex flex-wrap items-center gap-4">
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger className="h-8 w-48 text-xs" aria-label="Timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox id="appt-all-day" checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} />
              <Label htmlFor="appt-all-day" className="cursor-pointer text-sm">All day event</Label>
            </div>
          </div>

          {/* 8 — Location */}
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className="pl-9"
            />
          </div>

          {/* 9–10 — Add guests + pre-populated current user */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Add guests"
                value={guestQuery}
                onChange={(e) => setGuestQuery(e.target.value)}
                placeholder="Add guests"
                className="pl-9"
              />
              {guestResults.length > 0 && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-44 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  {guestResults.map((g) => (
                    <Button
                      key={g.id}
                      type="button"
                      variant="ghost"
                      onClick={() => addGuest(g)}
                      className="h-auto w-full justify-start rounded-none px-3 py-2 text-sm"
                    >
                      {g.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Current user (assigned broker) — auto-added guest chip */}
              {isSuperuser ? (
                <Select value={brokerSlug} onValueChange={setBrokerSlug}>
                  <SelectTrigger className="h-7 w-auto gap-1 rounded-full px-2.5 text-xs" aria-label="Assigned broker">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {brokers.map((b) => (
                      <SelectItem key={b.slug} value={b.slug}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary" className="gap-1">{brokerName}</Badge>
              )}
              {guests.map((g) => (
                <Badge key={g.id} variant="outline" className="gap-1 pr-1">
                  {g.name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGuest(g.id)}
                    className="h-auto p-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    aria-label={`Remove ${g.name}`}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>

          {/* 11–12 — Type + Outcome */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger aria-label="Type">
                <SelectValue placeholder="Set type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Set type</SelectItem>
                {activeTypes.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={outcomeId} onValueChange={setOutcomeId}>
              <SelectTrigger aria-label="Outcome">
                <SelectValue placeholder="No Outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Outcome</SelectItem>
                {activeOutcomes.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 13 — Notes (rich text) */}
          <RichTextBody value={notes} onChange={setNotes} minHeight={110} />

          {/* 14 — Send invitation */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="appt-send-invite"
              checked={sendInvitation}
              onCheckedChange={(v) => setSendInvitation(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="appt-send-invite" className="cursor-pointer text-sm leading-snug">
              Send invitation email to linked contacts
              <span className="block text-xs font-normal text-muted-foreground">
                Sent from your Gmail to each contact&rsquo;s primary email. Text reminders are not enabled yet.
              </span>
            </Label>
          </div>

          {/* AC-17 — pending-reminder cancel warning */}
          {reminderCancelWarning && (
            <Alert>
              <AlertDescription>
                An invitation was already sent for this appointment. Saving without re-checking
                &ldquo;Send invitation&rdquo; cancels the pending reminder — no update email goes out.
              </AlertDescription>
            </Alert>
          )}

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          {/* 15 — Submit (full width) + delete in edit mode */}
          <Button
            type="button"
            disabled={pending || !title.trim() || !startDate}
            onClick={submit}
            className="w-full"
          >
            {pending ? 'Saving…' : isEdit ? 'Save Appointment' : 'Create Appointment'}
          </Button>
          {isEdit && (
            deleteConfirm ? (
              <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete} className="w-full">
                {pending ? 'Deleting…' : 'Confirm delete'}
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setDeleteConfirm(true)}
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Delete appointment
              </Button>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
