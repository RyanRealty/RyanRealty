'use client'

/**
 * Bookable hours + days off for the public /book calendar.
 *
 * Both were live and editable only by hand-written SQL until now, which meant
 * the broker could not control their own public calendar (Matt 2026-08-26).
 *
 * EMPTY HOURS MEANS CLOSED HERE. That is the opposite of the office-hours
 * editor on the CRM settings screen, where empty means the phones always ring.
 * The copy says so out loud, because the two look identical and mean opposite
 * things (see migration 20260825200000).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SectionHead, TextField, ToolbarCheck } from '@/components/admin/v2'
import { OFFICE_DAYS } from '@/lib/crm/office-hours'
import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'
import { updateBookingHoursAction } from '@/app/actions/crm-company-settings'
import {
  addBookingBlackoutAction,
  deleteBookingBlackoutAction,
} from '@/app/actions/booking-blackouts'
import type { BookingBlackout } from '@/lib/data/crm/bookingBlackouts'

type Props = {
  brokerSlug: string
  hours: OfficeHoursBlock[]
  blackouts: BookingBlackout[]
  timeZone: string
}

const CARD = { borderColor: 'var(--a-border)', background: 'var(--a-bg)' } as const

function blockLabel(b: OfficeHoursBlock): string {
  return `${b.days.join(', ')} · ${b.start_time} to ${b.end_time}`
}

function dayLabel(startsOn: string, endsOn: string): string {
  return startsOn === endsOn ? startsOn : `${startsOn} to ${endsOn}`
}

export default function BookingSettingsForm({ brokerSlug, hours, blackouts, timeZone }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [blocks, setBlocks] = useState<OfficeHoursBlock[]>(hours)
  const [days, setDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [hoursError, setHoursError] = useState('')

  const [offStart, setOffStart] = useState('')
  const [offEnd, setOffEnd] = useState('')
  const [reason, setReason] = useState('')
  const [offError, setOffError] = useState('')

  function persistHours(next: OfficeHoursBlock[]) {
    setHoursError('')
    startTransition(async () => {
      try {
        await updateBookingHoursAction(next)
        setBlocks(next)
        setDays([])
        router.refresh()
      } catch (err) {
        setHoursError(err instanceof Error ? err.message : 'Could not save bookable hours')
      }
    })
  }

  function addHours() {
    if (days.length === 0) { setHoursError('Pick at least one day.'); return }
    const ordered = OFFICE_DAYS.filter((d) => days.includes(d))
    persistHours([...blocks, { days: ordered, start_time: startTime, end_time: endTime }])
  }

  function addDayOff() {
    setOffError('')
    if (!offStart) { setOffError('Pick the first day off.'); return }
    // One day off is the common case, so the end date is optional and defaults
    // to the start. The action takes INCLUSIVE dates; the stored bound is
    // exclusive and the DAL does that translation.
    const last = offEnd || offStart
    startTransition(async () => {
      const res = await addBookingBlackoutAction({
        brokerSlug, startsOn: offStart, endsOn: last, reason: reason || undefined,
      })
      if (!res.ok) { setOffError(res.error); return }
      setOffStart(''); setOffEnd(''); setReason('')
      router.refresh()
    })
  }

  function removeDayOff(id: number) {
    startTransition(async () => {
      await deleteBookingBlackoutAction(id, brokerSlug)
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border px-6 py-5 space-y-4" style={CARD}>
        <SectionHead flush>Bookable hours</SectionHead>
        <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
          When someone can book you at ryan-realty.com/book. Times are {timeZone.replace('America/', '').replace('_', ' ')}.
          With no hours set, nothing is offerable and the page shows no times.
        </p>

        {blocks.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
            No bookable hours. The booking page is closed.
          </p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b, i) => (
              <li key={`${b.days.join()}-${b.start_time}-${i}`} className="flex items-center justify-between gap-4">
                <span className="text-sm" style={{ color: 'var(--a-text)' }}>{blockLabel(b)}</span>
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => persistHours(blocks.filter((_, n) => n !== i))}
                  disabled={pending}
                  className="text-sm"
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3">
          {OFFICE_DAYS.map((d) => (
            <ToolbarCheck
              key={d}
              label={d}
              checked={days.includes(d)}
              onChange={() => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
            />
          ))}
          <TextField label="From" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <TextField label="Until" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          <Button type="button" variant="primary" onClick={addHours} disabled={pending}>
            Add hours
          </Button>
        </div>
        {hoursError ? <p role="alert" className="text-sm" style={{ color: 'var(--a-danger)' }}>{hoursError}</p> : null}
      </section>

      <section className="rounded-xl border px-6 py-5 space-y-4" style={CARD}>
        <SectionHead flush>Days off</SectionHead>
        <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
          Days nobody can book. Booking ignores all-day calendar entries, because the transaction
          system writes its milestones that way, so a day off is set here rather than on the calendar.
        </p>

        {blackouts.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>No days off scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {blackouts.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-4">
                <span className="text-sm" style={{ color: 'var(--a-text)' }}>
                  {dayLabel(b.startsOn, b.endsOn)}{b.reason ? ` · ${b.reason}` : ''}
                </span>
                <Button type="button" variant="quiet" onClick={() => removeDayOff(b.id)} disabled={pending} className="text-sm">
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <TextField label="First day" type="date" value={offStart} onChange={(e) => setOffStart(e.target.value)} />
          <TextField label="Last day (optional)" type="date" value={offEnd} onChange={(e) => setOffEnd(e.target.value)} />
          <TextField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button type="button" variant="quiet" onClick={addDayOff} disabled={pending}>Add day off</Button>
        </div>
        {offError ? <p role="alert" className="text-sm" style={{ color: 'var(--a-danger)' }}>{offError}</p> : null}
      </section>
    </div>
  )
}
