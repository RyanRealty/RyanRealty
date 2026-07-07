'use client'

/**
 * Subscriber list controls: search by email/name, status + segment + broker
 * filters, and CSV export of the current filtered view. Filters live in the
 * URL (server component re-queries), so views are shareable and paging works.
 */

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor="sub-search">Search</Label>
        <Input
          id="sub-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Email or name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-filter-status">Status</Label>
        <Select value={status} onValueChange={(v) => apply({ status: v })}>
          <SelectTrigger id="sub-filter-status" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-filter-segment">Segment</Label>
        <Select value={segment} onValueChange={(v) => apply({ segment: v })}>
          <SelectTrigger id="sub-filter-segment" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SEGMENTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-filter-broker">Broker</Label>
        <Select value={broker} onValueChange={(v) => apply({ broker: v })}>
          <SelectTrigger id="sub-filter-broker" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BROKERS.map((b) => (
              <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Filtering…' : 'Apply'}
      </Button>
      <Button asChild variant="outline">
        <a href={exportHref} download>Export CSV</a>
      </Button>
    </form>
  )
}
