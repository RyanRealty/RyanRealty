'use client'

/**
 * The public booking picker: choose a day, choose a time, leave your details.
 *
 * Availability is rendered server-side and passed in, so the first paint is a
 * real calendar rather than a spinner. The action re-checks the slot on submit,
 * and `slot_taken` is handled here as a first-class outcome — a refresh, not an
 * error banner — because two people wanting the same 10am is ordinary.
 */

import { useState, useTransition } from 'react'
import { CONTACT } from '@/lib/brand/contact'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { bookAppointmentAction } from '@/app/actions/book-appointment'
import type { Slot } from '@/lib/booking/slots'

type BookableDay = { dateKey: string; label: string; slots: Slot[] }
type Props = { days: BookableDay[]; brokerSlug: string; timeZone: string; available: boolean }

const TOPICS = [
  { value: 'buying', label: 'Buying a home' },
  { value: 'selling', label: 'Selling a home' },
  { value: 'both', label: 'Buying and selling' },
  { value: 'other', label: 'Something else' },
] as const

export default function BookingClient({ days, brokerSlug, timeZone, available }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dayKey, setDayKey] = useState(days[0]?.dateKey ?? '')
  const [slotIso, setSlotIso] = useState('')
  const [topic, setTopic] = useState<string>('buying')
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' })
  const [smsConsent, setSmsConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [booked, setBooked] = useState<{ when: string } | null>(null)

  const day = days.find((d) => d.dateKey === dayKey) ?? days[0]
  const slot = day?.slots.find((s) => s.startIso === slotIso) ?? null

  if (!available) {
    return (
      <p className="text-base text-muted-foreground">
        Online booking is not available right now. Call {CONTACT.phoneFub} and a broker will find you a time.
      </p>
    )
  }

  if (days.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        There is no open time in the next three weeks. Call {CONTACT.phoneFub} and we will make room.
      </p>
    )
  }

  if (booked) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-lg font-semibold text-foreground">You are on the calendar.</p>
        <p className="mt-2 text-base text-muted-foreground">
          {booked.when}. Your broker has it on their calendar and will confirm by email.
        </p>
      </div>
    )
  }

  function submit() {
    setError(null)
    if (!slot) { setError('Pick a time first.'); return }
    if (!form.name.trim()) { setError('Add your name so the broker knows who to expect.'); return }
    if (!form.email.trim()) { setError('Add an email so we can send the confirmation.'); return }

    startTransition(async () => {
      const result = await bookAppointmentAction({
        ...form, topic, broker: brokerSlug, smsConsent,
        startIso: slot.startIso, endIso: slot.endIso,
      })
      if (result.ok) {
        setBooked({ when: `${day.label} at ${slot.label}` })
        return
      }
      setError(result.error)
      // The slot went while they were typing. Refresh the calendar under them.
      if (result.code === 'slot_taken') {
        setSlotIso('')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <Label className="mb-3 block">Pick a day</Label>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <Button
              key={d.dateKey}
              type="button"
              variant={d.dateKey === dayKey ? 'default' : 'outline'}
              onClick={() => { setDayKey(d.dateKey); setSlotIso('') }}
            >
              {d.label}
            </Button>
          ))}
        </div>
      </div>

      {day ? (
        <div>
          <Label className="mb-3 block">Pick a time</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {day.slots.map((s) => (
              <Button
                key={s.startIso}
                type="button"
                variant={s.startIso === slotIso ? 'default' : 'outline'}
                onClick={() => setSlotIso(s.startIso)}
                className={cn(s.startIso === slotIso && 'ring-2 ring-ring')}
              >
                {s.label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Times are {timeZone.replace('America/', '').replace('_', ' ')}.</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="book-name">Your name</Label>
          <Input id="book-name" value={form.name} autoComplete="name"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="book-email">Email</Label>
          <Input id="book-email" type="email" value={form.email} autoComplete="email"
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="book-phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
          <Input id="book-phone" type="tel" value={form.phone} autoComplete="tel"
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="book-topic">What is this about?</Label>
          <Select value={topic} onValueChange={setTopic}>
            <SelectTrigger id="book-topic"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TOPICS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="book-note">Anything we should know? <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id="book-note" rows={3} value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>

      {/* TCPA / A2P: any public form collecting a phone shows the disclosure
          (ci:sms-consent). The booking itself never depends on it — consent
          governs marketing texts, not whether we keep the appointment. */}
      <SmsConsentDisclosure checked={smsConsent} onCheckedChange={setSmsConsent} />

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <Button type="button" size="lg" disabled={pending} onClick={submit}>
        {pending ? 'Booking…' : slot ? `Book ${day.label} at ${slot.label}` : 'Book this time'}
      </Button>
    </div>
  )
}
