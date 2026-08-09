'use client'

/**
 * Subscriber list controls: search by email/name, status + segment + broker
 * filters, and CSV export of the current filtered view. Filters live in the
 * URL (server component re-queries), so views are shareable and paging works.
 *
 * Admin v2 (11F): shadcn Input/Label/Select/Button replaced by the locked
 * admin language. "Export CSV" stays a real anchor (download href), styled
 * with the av2-btn classes directly rather than wrapped in <Button> — the v2
 * Button always renders a <button> with no asChild escape hatch, and turning
 * a download link into a button-with-onClick would silently drop middle-click
 * and Cmd/Ctrl-click. Presentation only: same URL params, same query
 * building, same export href.
 */

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, SelectField, TextField } from '@/components/admin/v2'

const ALL = 'all'

const STATUSES = [
  { value: ALL, label: 'Any status' },
  { value: 'active', label: 'Active' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'complained', label: 'Complained' },
]
const SEGMENTS = [
  { value: ALL, label: 'Any segment' },
  { value: 'general', label: 'General' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'past-client', label: 'Past client' },
]
const BROKERS = [
  { value: ALL, label: 'Any broker' },
  { value: 'matt', label: 'Matt' },
  { value: 'rebecca', label: 'Rebecca' },
  { value: 'paul', label: 'Paul' },
]

export default function SubscriberFilters() {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(params.get('q') ?? '')
  const status = params.get('status') ?? ALL
  const segment = params.get('segment') ?? ALL
  const broker = params.get('broker') ?? ALL

  function buildParams(overrides: Record<string, string>): URLSearchParams {
    const next = new URLSearchParams()
    const current: Record<string, string> = {
      q: q.trim(),
      status,
      segment,
      broker,
      ...overrides,
    }
    for (const [k, v] of Object.entries(current)) {
      if (v && v !== ALL) next.set(k, v)
    }
    return next
  }

  function apply(overrides: Record<string, string> = {}) {
    const next = buildParams(overrides)
    startTransition(() => {
      router.push(`/admin/newsletters/subscribers${next.size ? `?${next.toString()}` : ''}`)
    })
  }

  const exportHref = `/admin/newsletters/subscribers/export${buildParams({}).size ? `?${buildParams({}).toString()}` : ''}`

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        apply()
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div style={{ minWidth: 224, flex: 1 }}>
        <TextField label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email or name" />
      </div>
      <div style={{ width: 160 }}>
        <SelectField label="Status" value={status} onChange={(e) => apply({ status: e.target.value })}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
      </div>
      <div style={{ width: 160 }}>
        <SelectField label="Segment" value={segment} onChange={(e) => apply({ segment: e.target.value })}>
          {SEGMENTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </SelectField>
      </div>
      <div style={{ width: 160 }}>
        <SelectField label="Broker" value={broker} onChange={(e) => apply({ broker: e.target.value })}>
          {BROKERS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </SelectField>
      </div>
      <Button type="submit" variant="quiet" disabled={pending}>
        {pending ? 'Filtering…' : 'Apply'}
      </Button>
      <a href={exportHref} download className="av2-btn av2-btn--quiet" style={{ textDecoration: 'none' }}>
        Export CSV
      </a>
    </form>
  )
}
