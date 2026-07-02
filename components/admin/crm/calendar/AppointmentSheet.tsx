'use client'

/**
 * AppointmentSheet — slide-over form for create / edit appointments.
 *
 * FUB-style right-side Sheet (side="right" on desktop, side="bottom" on mobile
 * via a CSS breakpoint). Accepts optional initialDate to pre-fill the start
 * datetime when "+" is clicked on a calendar day.
 *
 * Fields: title, start, end, all-day switch, location, type, outcome, guest
 * contacts (select search over crm_people passed from the server), description,
 * "send invitation" checkbox.
 *
 * Form state is fully controlled so it resets cleanly on close without
 * unmounting the Sheet (keeps the open animation smooth).
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="text-base font-semibold">
            {isEdit ? 'Edit appointment' : 'New appointment'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-title">Title</Label>
            <Input
              id="appt-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Buyer consultation with Smith family"
              autoFocus
            />
          </div>

          {/* All-day switch */}
          <div className="flex items-center gap-3">
            <Switch
              id="appt-allday"
              checked={allDay}
              onCheckedChange={setAllDay}
            />
            <Label htmlFor="appt-allday" className="cursor-pointer">All day</Label>
          </div>

          {/* Start / End */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="appt-start">Start</Label>
                <Input
                  id="appt-start"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="appt-end">End</Label>
                <Input
                  id="appt-end"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                />
              </div>
            </div>
          )}

          {allDay && (
            <div className="space-y-1.5">
              <Label htmlFor="appt-date">Date</Label>
              <Input
                id="appt-date"
                type="date"
                value={startAt.slice(0, 10)}
                onChange={(e) => {
                  setStartAt(`${e.target.value}T00:00`)
                  setEndAt(`${e.target.value}T23:59`)
                }}
              />
            </div>
          )}

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-location">Location</Label>
            <Input
              id="appt-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="123 Main St · Bend, OR or Zoom link"
            />
          </div>

          <Separator />

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-type">Type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger id="appt-type">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {activeTypes.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outcome */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-outcome">Outcome</Label>
            <Select value={outcomeId} onValueChange={setOutcomeId}>
              <SelectTrigger id="appt-outcome">
                <SelectValue placeholder="Select an outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {activeOutcomes.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Primary contact */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-person">Contact</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger id="appt-person">
                <SelectValue placeholder="Link to a contact" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {contacts.slice(0, 200).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name ?? `Contact #${c.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Guest contacts */}
          <div className="space-y-1.5">
            <Label>Additional guests</Label>
            <Input
              placeholder="Search contacts..."
              value={guestSearch}
              onChange={(e) => setGuestSearch(e.target.value)}
              className="h-8 text-sm"
            />
            {guestSearch && filteredContacts.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-card">
                {filteredContacts.map((c) => {
                  const selected = guestIds.includes(c.id)
                  return (
                    <Button
                      key={c.id}
                      type="button"
                      variant="ghost"
                      onClick={() => toggleGuest(c.id)}
                      className={cn(
                        'flex h-auto w-full items-center justify-start gap-2 rounded-none px-3 py-2 text-sm',
                        selected && 'bg-muted',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border text-xs',
                          selected && 'border-primary bg-primary text-primary-foreground',
                        )}
                      >
                        {selected ? '✓' : ''}
                      </span>
                      {c.name ?? `Contact #${c.id}`}
                    </Button>
                  )
                })}
              </div>
            )}
            {guestIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {guestIds.map((gid) => {
                  const c = contacts.find((x) => x.id === gid)
                  return (
                    <Badge
                      key={gid}
                      variant="secondary"
                      className="gap-1 pr-1.5"
                    >
                      {c?.name ?? `#${gid}`}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleGuest(gid)}
                        className="ml-0.5 h-auto p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                        aria-label={`Remove ${c?.name}`}
                      >
                        ×
                      </Button>
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>

          {/* Broker (superuser only) */}
          {isSuperuser && (
            <div className="space-y-1.5">
              <Label htmlFor="appt-broker">Assigned to</Label>
              <Select value={brokerSlug} onValueChange={setBrokerSlug}>
                <SelectTrigger id="appt-broker">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brokerSlugs.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Separator />

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="appt-desc">Notes</Label>
            <Textarea
              id="appt-desc"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Any context, agenda items, or follow-up notes."
              rows={3}
            />
          </div>

          {/* Invite sent */}
          {isEdit && (
            <div className="flex items-center gap-3">
              <Switch
                id="appt-invite"
                checked={inviteSent}
                onCheckedChange={setInviteSent}
              />
              <Label htmlFor="appt-invite" className="cursor-pointer">
                Invitation sent
              </Label>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {/* Two-step delete — only in edit mode, only if deleteAction is wired */}
            {isEdit && deleteAction && (
              deleteConfirm ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={handleDelete}
                  className="h-9"
                >
                  {pending ? 'Deleting…' : 'Confirm delete'}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setDeleteConfirm(true)}
                  className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  Delete
                </Button>
              )
            )}
          </div>
          <Button
            type="button"
            disabled={pending || !title.trim()}
            onClick={submit}
          >
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create appointment'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
