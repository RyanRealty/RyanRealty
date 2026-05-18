'use client'

/**
 * The three buyer-track cards on /lp/tetherow/. Three sibling forms that share
 * the dark navy panel:
 *   1) Schedule a showing — high-intent, picks from active inventory dropdown
 *   2) Custom Tetherow alerts — set-and-forget, price/beds/sub criteria
 *   3) The Tetherow buyer's guide — soft-start, email + name only
 *
 * The active inventory dropdown is populated SERVER-SIDE from the live
 * listings query (data.ts → fetchTetherowActiveListings) so the option list
 * always matches the cards rendered above on the same page. Each form posts
 * to /api/cma with pre-tagged FUB tags.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const SUB_NEIGHBORHOODS = [
  'Heath',
  'Crescent / North Forty',
  'Glen / Cascade Vista',
  'Tartan Druim',
  'Highlands Ridge',
  'Outrider Overlook',
  'Trailhead',
  'Triple Knot',
  'The Rim',
] as const

type ShowingOption = {
  /** Stable id (e.g. ListingKey or `multiple`). */
  value: string
  /** Display label, e.g. "61572 Hardin Martin · $4,000,000". */
  label: string
}

export function TetherowBuyerForms({
  showingOptions,
  defaultProperty,
}: {
  showingOptions: ShowingOption[]
  /** Optional initial dropdown selection — driven by the hash on the
   *  client when a viewer clicks a per-listing "Schedule a showing" CTA. */
  defaultProperty?: string
}) {
  return (
    <div className="grid gap-[18px] lg:grid-cols-[1.15fr_1fr_0.75fr]">
      <ShowingCard options={showingOptions} defaultProperty={defaultProperty} />
      <AlertsCard />
      <GuideCard />
    </div>
  )
}

// ─── Card 1 — Schedule a showing ──────────────────────────────────────────────

function ShowingCard({
  options,
  defaultProperty,
}: {
  options: ShowingOption[]
  defaultProperty?: string
}) {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [property, setProperty] = useState(defaultProperty ?? '')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData()
    fd.set('campaign', 'lp-tetherow-v1')
    fd.set('resort', 'tetherow')
    fd.set('intent', 'buyer')
    fd.set('tags', 'buyer-intent,resort:tetherow,lp:tetherow-landing-v1,showing-request')
    fd.set('property', property)
    fd.set('name', name)
    fd.set('email', email)
    fd.set('phone', phone)
    try {
      await fetch('/api/cma', { method: 'POST', body: fd }).catch(() => undefined)
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      id="showing-card"
      className="flex flex-col rounded-2xl border border-[rgba(250,248,244,0.3)] bg-[rgba(250,248,244,0.1)] p-7"
    >
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[rgba(250,248,244,0.7)]">
        Highest intent
      </div>
      <h3
        className="mb-2 font-display text-[24px] font-semibold leading-[1.15] text-[color:var(--rr-cream)]"
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        Schedule a showing
      </h3>
      <p className="mb-5 flex-1 text-[14px] leading-[1.55] text-[rgba(250,248,244,0.82)]">
        Pick a home from the active inventory above. We&apos;ll confirm a tour window inside the
        next 48 hours. Members-only homes are accessible via our broker relationships at Tetherow.
      </p>
      {done ? (
        <div className="rounded-lg bg-[rgba(111,207,122,0.18)] p-4 text-[14px] text-[color:var(--rr-cream)]">
          <div className="mb-2 text-2xl text-[#6fcf7a]">✓</div>
          <p className="mb-2 font-display text-[20px] font-semibold">Showing request received.</p>
          <p>A Ryan Realty broker will confirm a tour window inside 48 hours.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-[10px]">
          <Label htmlFor="tetherow-showing-property" className="sr-only">
            Which home?
          </Label>
          <select
            id="tetherow-showing-property"
            value={property}
            onChange={(e) => setProperty(e.target.value)}
            required
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] focus:border-[rgba(250,248,244,0.6)] focus:bg-[rgba(250,248,244,0.15)] focus:outline-none"
          >
            <option value="" disabled className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
              Which home?
            </option>
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.label}
                className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]"
              >
                {opt.label}
              </option>
            ))}
            <option
              value="Multiple / browsing"
              className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]"
            >
              More than one (tour day)
            </option>
          </select>
          <Input
            type="text"
            placeholder="Your name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.5)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
          />
          <Input
            type="email"
            placeholder="Email address"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.5)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
          />
          <Input
            type="tel"
            placeholder="Mobile number"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.5)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
          />
          <Button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-[9px] bg-[color:var(--rr-cream)] py-[13px] text-[14px] font-bold tracking-[0.02em] text-[color:var(--rr-navy)] hover:opacity-90"
          >
            {submitting ? 'Sending...' : 'Request showing'}
          </Button>
          <div className="mt-1 text-[11px] leading-[1.4] text-[rgba(250,248,244,0.5)]">
            By submitting, you agree to receive a marketing communication via SMS, AI voice call,
            or email from Ryan Realty. Reply STOP to unsubscribe.
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Card 2 — Custom alerts ───────────────────────────────────────────────────

function AlertsCard() {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [bedsMin, setBedsMin] = useState('')
  const [sub, setSub] = useState('any')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData()
    fd.set('campaign', 'lp-tetherow-v1')
    fd.set('resort', 'tetherow')
    fd.set('intent', 'buyer')
    fd.set('tags', 'buyer-intent,resort:tetherow,lp:tetherow-landing-v1,custom-alerts')
    fd.set('price_min', priceMin)
    fd.set('price_max', priceMax)
    fd.set('beds_min', bedsMin)
    fd.set('subdivision', sub)
    fd.set('email', email)
    fd.set('name', name)
    try {
      await fetch('/api/cma', { method: 'POST', body: fd }).catch(() => undefined)
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-[rgba(250,248,244,0.16)] bg-[rgba(250,248,244,0.06)] p-7">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[rgba(250,248,244,0.7)]">
        Set + forget
      </div>
      <h3
        className="mb-2 font-display text-[24px] font-semibold leading-[1.15] text-[color:var(--rr-cream)]"
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        Custom Tetherow alerts
      </h3>
      <p className="mb-5 flex-1 text-[14px] leading-[1.55] text-[rgba(250,248,244,0.82)]">
        Tell us what you want. We&apos;ll email when new Tetherow homes match your criteria. No
        drip sequence, no spam, just the homes.
      </p>
      {done ? (
        <div className="rounded-lg bg-[rgba(111,207,122,0.18)] p-4 text-[14px] text-[color:var(--rr-cream)]">
          <div className="mb-2 text-2xl text-[#6fcf7a]">✓</div>
          <p className="mb-2 font-display text-[20px] font-semibold">Alerts set.</p>
          <p>You&apos;ll get an email the next time a Tetherow home matches your criteria.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-[10px]">
          <div className="grid grid-cols-2 gap-2">
            <select
              required
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] focus:border-[rgba(250,248,244,0.6)] focus:bg-[rgba(250,248,244,0.15)] focus:outline-none"
            >
              <option value="" disabled className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                Min price
              </option>
              {['500000', '1000000', '1500000', '2000000', '2500000', '3000000'].map((v) => (
                <option key={v} value={v} className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                  {priceLabel(v)}
                </option>
              ))}
            </select>
            <select
              required
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] focus:border-[rgba(250,248,244,0.6)] focus:bg-[rgba(250,248,244,0.15)] focus:outline-none"
            >
              <option value="" disabled className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                Max price
              </option>
              {['1500000', '2000000', '2500000', '3000000', '4000000', '6000000'].map((v) => (
                <option key={v} value={v} className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                  {priceLabel(v)}
                  {v === '6000000' ? '+' : ''}
                </option>
              ))}
            </select>
          </div>
          <select
            required
            value={bedsMin}
            onChange={(e) => setBedsMin(e.target.value)}
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] focus:border-[rgba(250,248,244,0.6)] focus:bg-[rgba(250,248,244,0.15)] focus:outline-none"
          >
            <option value="" disabled className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
              Minimum bedrooms
            </option>
            {['2', '3', '4', '5'].map((v) => (
              <option key={v} value={v} className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                {v}+
              </option>
            ))}
          </select>
          <select
            value={sub}
            onChange={(e) => setSub(e.target.value)}
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] focus:border-[rgba(250,248,244,0.6)] focus:bg-[rgba(250,248,244,0.15)] focus:outline-none"
          >
            <option value="any" className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
              Any Tetherow sub-neighborhood
            </option>
            {SUB_NEIGHBORHOODS.map((s) => (
              <option key={s} value={s} className="bg-[color:var(--rr-navy)] text-[color:var(--rr-cream)]">
                {s}
              </option>
            ))}
          </select>
          <Input
            type="email"
            placeholder="Email address"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.5)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
          />
          <Input
            type="text"
            placeholder="Your name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.5)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
          />
          <Button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-[9px] bg-[color:var(--rr-cream)] py-[13px] text-[14px] font-bold tracking-[0.02em] text-[color:var(--rr-navy)] hover:opacity-90"
          >
            {submitting ? 'Sending...' : 'Send me matches'}
          </Button>
          <div className="mt-1 text-[11px] leading-[1.4] text-[rgba(250,248,244,0.5)]">
            One daily digest if a match shows up. Unsubscribe one click.
          </div>
        </form>
      )}
    </div>
  )
}

// ─── Card 3 — Buyer's guide ───────────────────────────────────────────────────

function GuideCard() {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    const fd = new FormData()
    fd.set('campaign', 'lp-tetherow-v1')
    fd.set('resort', 'tetherow')
    fd.set('intent', 'buyer-soft')
    fd.set('tags', 'buyer-intent-soft,resort:tetherow,lp:tetherow-landing-v1,buyers-guide-requested')
    fd.set('email', email)
    fd.set('name', name)
    try {
      await fetch('/api/cma', { method: 'POST', body: fd }).catch(() => undefined)
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-[rgba(250,248,244,0.16)] bg-[rgba(250,248,244,0.06)] p-7">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[rgba(250,248,244,0.7)]">
        Soft start
      </div>
      <h3
        className="mb-2 font-display text-[24px] font-semibold leading-[1.15] text-[color:var(--rr-cream)]"
        style={{ fontFamily: 'var(--rr-font-display)' }}
      >
        The Tetherow buyer&apos;s guide
      </h3>
      <p className="mb-5 flex-1 text-[14px] leading-[1.55] text-[rgba(250,248,244,0.82)]">
        Request the in-depth Tetherow buyer&apos;s guide: HOA tiers, club membership, what each
        sub-neighborhood actually feels like, the builder roster, and how the resort handed
        Tetherow homes 27 closings in the last year. Delivered in your inbox.
      </p>
      {done ? (
        <div className="rounded-lg bg-[rgba(111,207,122,0.18)] p-4 text-[14px] text-[color:var(--rr-cream)]">
          <div className="mb-2 text-2xl text-[#6fcf7a]">✓</div>
          <p className="mb-2 font-display text-[20px] font-semibold">Sent.</p>
          <p>The Tetherow buyer&apos;s guide is on its way to your inbox.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-[10px]">
          <Input
            type="email"
            placeholder="Your email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.5)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
          />
          <Input
            type="text"
            placeholder="First name (optional)"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-[9px] border border-[rgba(250,248,244,0.25)] bg-[rgba(250,248,244,0.1)] px-4 py-[13px] text-[14px] text-[color:var(--rr-cream)] placeholder:text-[rgba(250,248,244,0.5)] focus-visible:border-[rgba(250,248,244,0.6)] focus-visible:bg-[rgba(250,248,244,0.15)] focus-visible:ring-0"
          />
          <Button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-[9px] bg-[color:var(--rr-cream)] py-[13px] text-[14px] font-bold tracking-[0.02em] text-[color:var(--rr-navy)] hover:opacity-90"
          >
            {submitting ? 'Sending...' : 'Send the guide'}
          </Button>
          <div className="mt-1 text-[11px] leading-[1.4] text-[rgba(250,248,244,0.5)]">
            One email. No phone follow-up unless you reply.
          </div>
        </form>
      )}
    </div>
  )
}

function priceLabel(v: string): string {
  const n = parseInt(v, 10)
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  return `$${Math.round(n / 1000)}K`
}

export default TetherowBuyerForms
