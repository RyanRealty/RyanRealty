'use client'

/**
 * Sticky bulk-assign action bar for the CRM contacts list.
 *
 * Appears when one or more leads are selected. Two actions:
 *  - Add the selection to the newsletter (with a segment).
 *  - Assign the selection a broker-created saved search (name + light filters).
 *
 * Selection state is owned by the parent wrapper; this component only renders
 * the bar, the two small forms, and surfaces the action result inline (no
 * global Toaster is mounted in the admin shell, so the result reads in-bar).
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, X } from 'lucide-react'
import {
  adminBulkAssignNewsletterAction,
  adminBulkAssignSavedSearchAction,
} from '@/app/actions/newsletter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

type Segment = 'general' | 'buyer' | 'seller' | 'past-client'
type Panel = 'none' | 'newsletter' | 'search'

const SEGMENTS: Array<{ value: Segment; label: string }> = [
  { value: 'general', label: 'General' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
  { value: 'past-client', label: 'Past client' },
]

export default function BulkAssignBar({
  selectedIds,
  onClear,
}: {
  selectedIds: number[]
  onClear: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [panel, setPanel] = useState<Panel>('none')
  const [message, setMessage] = useState<string | null>(null)

  // Newsletter form
  const [segment, setSegment] = useState<Segment>('general')

  // Saved-search form
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [beds, setBeds] = useState('')

  const count = selectedIds.length
  if (count === 0) return null

  const reset = () => {
    setPanel('none')
    setSegment('general')
    setName('')
    setCity('')
    setMinPrice('')
    setBeds('')
  }

  const finish = (assigned: number, skipped: number) => {
    setMessage(`${assigned} added, ${skipped} skipped`)
    reset()
    onClear()
    startTransition(() => router.refresh())
  }

  const runNewsletter = () => {
    setMessage(null)
    startTransition(async () => {
      const res = await adminBulkAssignNewsletterAction(selectedIds, segment)
      if (!res.ok) { setMessage(res.error ?? 'Could not assign'); return }
      finish(res.assigned, res.skipped)
    })
  }

  const runSavedSearch = () => {
    setMessage(null)
    const trimmedName = name.trim()
    if (!trimmedName) { setMessage('Name the saved search first'); return }
    const filters: Record<string, unknown> = {}
    if (city.trim()) filters.city = city.trim()
    if (minPrice.trim() && Number(minPrice) > 0) filters.minPrice = Number(minPrice)
    if (beds.trim() && Number(beds) > 0) filters.beds = Number(beds)
    startTransition(async () => {
      const res = await adminBulkAssignSavedSearchAction(selectedIds, trimmedName, filters)
      if (!res.ok) { setMessage(res.error ?? 'Could not assign'); return }
      finish(res.assigned, res.skipped)
    })
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
      <div className="mx-auto max-w-screen-2xl">
        {/* Top row — count, message, the two action toggles, clear */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {count} selected
          </span>
          {message ? (
            <span className="text-xs text-muted-foreground" role="status">{message}</span>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={panel === 'newsletter' ? 'default' : 'outline'}
              className="h-10 md:h-8"
              onClick={() => { setPanel(panel === 'newsletter' ? 'none' : 'newsletter'); setMessage(null) }}
              disabled={isPending}
            >
              Add to newsletter
            </Button>
            <Button
              size="sm"
              variant={panel === 'search' ? 'default' : 'outline'}
              className="h-10 md:h-8"
              onClick={() => { setPanel(panel === 'search' ? 'none' : 'search'); setMessage(null) }}
              disabled={isPending}
            >
              Assign saved search
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 md:h-8"
              onClick={() => { reset(); onClear() }}
              disabled={isPending}
            >
              <X className="mr-1 h-4 w-4" aria-hidden />
              Clear
            </Button>
          </div>
        </div>

        {/* Newsletter panel */}
        {panel === 'newsletter' ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-56">
              <Label htmlFor="bulk-segment" className="mb-1.5 block text-xs text-muted-foreground">Segment</Label>
              <Select value={segment} onValueChange={(v) => setSegment(v as Segment)}>
                <SelectTrigger id="bulk-segment" className="h-10 md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="h-10 sm:w-auto md:h-9" onClick={runNewsletter} disabled={isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              Add {count} to newsletter
            </Button>
          </div>
        ) : null}

        {/* Saved-search panel */}
        {panel === 'search' ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div className="lg:col-span-2">
              <Label htmlFor="bulk-ss-name" className="mb-1.5 block text-xs text-muted-foreground">Search name</Label>
              <Input id="bulk-ss-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bend under 600k" className="h-10 md:h-9" />
            </div>
            <div>
              <Label htmlFor="bulk-ss-city" className="mb-1.5 block text-xs text-muted-foreground">City</Label>
              <Input id="bulk-ss-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bend" className="h-10 md:h-9" />
            </div>
            <div>
              <Label htmlFor="bulk-ss-price" className="mb-1.5 block text-xs text-muted-foreground">Min price</Label>
              <Input id="bulk-ss-price" type="number" inputMode="numeric" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="500000" className="h-10 md:h-9" />
            </div>
            <div>
              <Label htmlFor="bulk-ss-beds" className="mb-1.5 block text-xs text-muted-foreground">Min beds</Label>
              <Input id="bulk-ss-beds" type="number" inputMode="numeric" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="3" className="h-10 md:h-9" />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button size="sm" className="h-10 md:h-9" onClick={runSavedSearch} disabled={isPending}>
                {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
                Assign to {count} {count === 1 ? 'lead' : 'leads'}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
