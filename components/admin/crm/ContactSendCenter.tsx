'use client'

/**
 * ContactSendCenter — THE SendPanel: one place to send a CRM contact any
 * deliverable (Pain #4, spec 03 §6): a Broker Price Opinion, a CMA, a Market
 * report, the Newsletter, or Listing matches from a saved search. A single
 * "Send to contact" button opens a dialog with a tab per concept; each routes
 * to that deliverable's existing send action. Build affordances live here too:
 * CMA builds route to the async kick-off sheet (?intent=cma — kickoffCmaCore,
 * idempotent + version-chained; never the old 30–60 s synchronous build), BPO
 * builds run the deterministic builder. Email-suppressed contacts block every
 * send up front. Management (subscribe toggles, areas/frequency) stays in
 * ContactQuickActions — this panel is the SEND surface.
 */

import { useMemo, useRef, useState, useTransition } from 'react'
import { ChevronDown, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { SAVED_SEARCH_CADENCES, type SavedSearchCadence } from '@/lib/saved-search-cadence'
import { hasNarrowingFilter } from '@/lib/search-filters'
import { PROPERTY_TYPES } from '@/lib/property-type'
import type { ContactBpo } from '@/lib/data/crm/getContactBpos'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import { sendDeliverable } from '@/app/actions/send-deliverable'
import { setReportSubscriptionAction } from '@/app/actions/crm-report-subscriptions'

type Area = { slug: string; label: string }

/**
 * Status choices for a broker-created alert search. 'active' is the feed
 * default and is omitted from the saved filters (hash stability with every
 * pre-existing alert). Sold/closed and coming-soon stay off this surface:
 * sold data is VOW-scoped and pre-marketing listings never leave the shop.
 */
const ALERT_STATUS_OPTIONS = [
  { value: 'active', label: 'Active (default)' },
  { value: 'active_and_pending', label: 'Active and pending' },
  { value: 'pending', label: 'Pending only' },
] as const

export function ContactSendCenter(props: {
  personId: number
  emailSuppressed: boolean
  bpos: ContactBpo[]
  cmas: ContactCma[]
  reportAreas: Area[]
  subscribedAreas: string[]
  defaultCity: string | null
  /** Opens the async CMA kick-off sheet (litmus surface) — e.g. "?intent=cma". */
  cmaBuildHref: string
  /** Bound startBpoForm(personId) — deterministic BPO builder for the home on file. */
  bpoGenerateAction: () => Promise<void>
  newsletterSubscribed: boolean
  /** The issue a one-off newsletter send delivers (subject shown before sending). */
  latestNewsletter: { subject: string; status: 'sent' | 'draft'; sentAt: string | null } | null
  /** Bound sendNewsletterToContactAction(personId) — takes the per-attempt
      idempotency key (A5: duplicate submit no-ops, failed send releases). */
  newsletterSendAction: (idempotencyKey: string) => Promise<{ ok: boolean; error?: string; message?: string }>
  /** Presentation only: v2 hosts pass av2 button classes so the trigger
   *  speaks the admin language. Omitted everywhere else — the legacy
   *  workspace keeps the shadcn primary. Never affects the send path. */
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  /** Per-flow idempotency keys — stable across retries of THIS attempt; cleared on success. */
  const nlKeyRef = useRef('')
  const cmaKeyRef = useRef('')
  const bpoKeyRef = useRef('')
  const reportKeyRef = useRef('')
  const listingsKeyRef = useRef('')

  function claimKey(ref: { current: string }): string {
    if (!ref.current) ref.current = crypto.randomUUID()
    return ref.current
  }

  const finalBpos = useMemo(() => props.bpos.filter((b) => b.status === 'final'), [props.bpos])
  const finalCmas = useMemo(
    () => props.cmas.filter((c) => c.status === 'finalized' || c.status === 'delivered'),
    [props.cmas],
  )
  // In-flight story: builds still running (build_state) + drafts awaiting
  // review, so the CMA tab never claims "no CMA" while one is minutes from
  // ready (the kick-off worker texts the broker on ready).
  const pendingCmas = useMemo(
    () =>
      props.cmas.filter(
        (c) =>
          c.buildState === 'queued' ||
          c.buildState === 'building' ||
          c.buildState === 'failed' ||
          (c.status !== 'finalized' && c.status !== 'delivered'),
      ),
    [props.cmas],
  )

  // BPO state
  const [bpoSlug, setBpoSlug] = useState(finalBpos[0]?.slug ?? '')
  const [bpoFull, setBpoFull] = useState(false)
  // CMA state
  const [cmaSlug, setCmaSlug] = useState(finalCmas[0]?.slug ?? '')
  // Market report state
  const [areas, setAreas] = useState<string[]>(props.subscribedAreas)
  const [subscribe, setSubscribe] = useState(false)
  // Listing alerts state — the consumer search vocabulary, mapped through the
  // SAME normalizeSavedSearchFilters keys the /search and /account paths use.
  const [city, setCity] = useState(props.defaultCity ?? '')
  const [subdivision, setSubdivision] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minBeds, setMinBeds] = useState('')
  const [minBaths, setMinBaths] = useState('')
  const [minSqFt, setMinSqFt] = useState('')
  const [maxSqFt, setMaxSqFt] = useState('')
  const [yearBuiltMin, setYearBuiltMin] = useState('')
  const [yearBuiltMax, setYearBuiltMax] = useState('')
  const [lotAcresMin, setLotAcresMin] = useState('')
  const [lotAcresMax, setLotAcresMax] = useState('')
  const [garageMin, setGarageMin] = useState('')
  const [keywords, setKeywords] = useState('')
  const [propSubType, setPropSubType] = useState('')
  const [propType, setPropType] = useState('all')
  const [status, setStatus] = useState<string>('active')
  // Amenity flags — the same five the consumer /search vocabulary carries.
  const [hasPool, setHasPool] = useState(false)
  const [hasView, setHasView] = useState(false)
  const [hasWaterfront, setHasWaterfront] = useState(false)
  const [hasFireplace, setHasFireplace] = useState(false)
  const [hasGolfCourse, setHasGolfCourse] = useState(false)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [freq, setFreq] = useState<SavedSearchCadence>('weekly')

  const blocked = props.emailSuppressed

  function toggleArea(slug: string) {
    setAreas((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  function resetTransient() {
    setBpoFull(false)
    setSubscribe(false)
    setSubdivision('')
    setMinPrice('')
    setMaxPrice('')
    setMinBeds('')
    setMinBaths('')
    setMinSqFt('')
    setPropType('all')
    setStatus('active')
    setMoreFiltersOpen(false)
  }

  // Which flow is running, so only ITS button shows "Sending…" — the shared
  // useTransition would otherwise relabel every tab's button (audit MED).
  const [activeFlow, setActiveFlow] = useState<string | null>(null)
  const busy = (flow: string) => pending && activeFlow === flow

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setActiveFlow(label)
    startTransition(async () => {
      try {
        const r = await fn()
        if (r.ok) {
          toast.success(r.message ?? `${label} sent.`)
          resetTransient()
          setOpen(false)
        } else {
          toast.error(r.error ?? `${label} could not be sent.`)
        }
      } catch (e) {
        // A thrown action must never fail silently and leave the dialog open,
        // inviting a duplicate send. Surface it and keep the dialog open.
        toast.error(e instanceof Error ? e.message : `${label} could not be sent.`)
      } finally {
        setActiveFlow(null)
      }
    })
  }

  function sendBpo() {
    if (!bpoSlug) return
    run('Price opinion', async () => {
      const key = claimKey(bpoKeyRef)
      const r = await sendDeliverable({
        personId: props.personId,
        kind: 'bpo',
        ref: bpoSlug,
        idempotencyKey: key,
        override: { includeOfferStrategy: bpoFull },
      })
      if (r.ok) bpoKeyRef.current = ''
      return r.ok ? { ok: true, message: 'Price opinion sent.' } : { ok: false, error: r.error }
    })
  }
  function sendCma() {
    if (!cmaSlug) return
    run('CMA', async () => {
      const key = claimKey(cmaKeyRef)
      const r = await sendDeliverable({
        personId: props.personId,
        kind: 'cma',
        ref: cmaSlug,
        idempotencyKey: key,
      })
      if (r.ok) cmaKeyRef.current = ''
      return r.ok ? { ok: true, message: 'CMA sent.' } : { ok: false, error: r.error }
    })
  }
  function sendReport() {
    if (areas.length === 0) {
      toast.error('Pick at least one area.')
      return
    }
    run('Market report', async () => {
      const key = claimKey(reportKeyRef)
      const r = await sendDeliverable({
        personId: props.personId,
        kind: 'market_report',
        idempotencyKey: key,
        override: { areas },
      })
      if (!r.ok) return { ok: false, error: r.error }
      reportKeyRef.current = ''
      if (subscribe) {
        const sub = await setReportSubscriptionAction(props.personId, { areas, frequency: 'monthly', isActive: true })
        if (!sub.ok) {
          return { ok: true, message: 'Market report sent, but the monthly subscription could not be set. Try the subscription again.' }
        }
        return { ok: true, message: 'Market report sent and monthly subscription set.' }
      }
      return { ok: true, message: 'Market report sent.' }
    })
  }
  function generateBpo() {
    run('Price opinion build', async () => {
      await props.bpoGenerateAction()
      return { ok: true, message: 'Price opinion build started. It will appear here when ready.' }
    })
  }
  function sendNewsletter() {
    // Per-attempt key: stable across retries of THIS attempt (the ledger
    // releases on failure so a retry re-sends), regenerated after success.
    if (!nlKeyRef.current) nlKeyRef.current = crypto.randomUUID()
    const key = nlKeyRef.current
    run('Newsletter', async () => {
      const r = await props.newsletterSendAction(key)
      if (r.ok) nlKeyRef.current = ''
      return r
    })
  }
  function sendListings() {
    const filters: Record<string, unknown> = {}
    if (city.trim()) filters.city = city.trim()
    if (subdivision.trim()) filters.subdivision = subdivision.trim()
    const num = (raw: string) => Number(raw.replace(/[^0-9]/g, ''))
    const mn = num(minPrice)
    const mx = num(maxPrice)
    const mb = num(minBeds)
    const mba = num(minBaths)
    const msq = num(minSqFt)
    if (Number.isFinite(mn) && mn > 0) filters.minPrice = mn
    if (Number.isFinite(mx) && mx > 0) filters.maxPrice = mx
    if (Number.isFinite(mb) && mb > 0) filters.beds = mb
    if (Number.isFinite(mba) && mba > 0) filters.baths = mba
    if (Number.isFinite(msq) && msq > 0) filters.minSqFt = msq
    // Full consumer filter vocabulary (parity with /search + /account) so a
    // broker-built alert can be as precise as a self-serve one (W7.5).
    const mxsq = num(maxSqFt)
    const ybmn = num(yearBuiltMin)
    const ybmx = num(yearBuiltMax)
    const lamn = Number(lotAcresMin.replace(/[^0-9.]/g, ''))
    const lamx = Number(lotAcresMax.replace(/[^0-9.]/g, ''))
    const grg = num(garageMin)
    if (Number.isFinite(mxsq) && mxsq > 0) filters.maxSqFt = mxsq
    if (Number.isFinite(ybmn) && ybmn > 0) filters.yearBuiltMin = ybmn
    if (Number.isFinite(ybmx) && ybmx > 0) filters.yearBuiltMax = ybmx
    if (Number.isFinite(lamn) && lamn > 0) filters.lotAcresMin = lamn
    if (Number.isFinite(lamx) && lamx > 0) filters.lotAcresMax = lamx
    if (Number.isFinite(grg) && grg > 0) filters.garageMin = grg
    if (keywords.trim()) filters.keywords = keywords.trim()
    if (propSubType.trim()) filters.propertySubType = propSubType.trim()
    if (hasPool) filters.hasPool = true
    if (hasView) filters.hasView = true
    if (hasWaterfront) filters.hasWaterfront = true
    if (hasFireplace) filters.hasFireplace = true
    if (hasGolfCourse) filters.hasGolfCourse = true
    if (propType !== 'all') filters.propertyType = propType
    // 'active' is the feed default — omit it so hashes stay stable with every
    // alert saved before this field existed.
    if (status !== 'active') filters.statusFilter = status
    // Same guard as the consumer paths: at least one predicate must actually
    // narrow inventory (status alone matches the whole feed).
    if (!hasNarrowingFilter(filters)) {
      toast.error('Add a city, subdivision, price, beds, or another filter so the search is not the whole MLS.')
      return
    }
    run('Listing matches', async () => {
      const key = claimKey(listingsKeyRef)
      const r = await sendDeliverable({
        personId: props.personId,
        kind: 'listing_matches',
        idempotencyKey: key,
        // freq is SavedSearchCadence — same four-value union as SavedSearchFrequency (W7.5).
        override: { filtersJson: JSON.stringify(filters), frequency: freq },
      })
      if (r.ok) listingsKeyRef.current = ''
      return r.ok ? { ok: true, message: 'Listing matches sent.' } : { ok: false, error: r.error }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className={props.triggerClassName ?? 'w-full min-h-11'}
          {...(props.triggerClassName ? { variant: 'ghost' as const } : {})}
        >
          <Send className="mr-2 h-4 w-4" aria-hidden />
          Send to contact
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send to this contact</DialogTitle>
          <DialogDescription>Price opinion, CMA, market report, or listing matches. One place.</DialogDescription>
        </DialogHeader>

        {blocked ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            This contact has opted out of email. Sends are blocked until that changes.
          </div>
        ) : null}

        <Tabs defaultValue="cma" className="mt-1">
          <TabsList className="grid h-auto w-full grid-cols-3 sm:grid-cols-5">
            <TabsTrigger value="cma">CMA</TabsTrigger>
            <TabsTrigger value="bpo">Opinion</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="newsletter">News</TabsTrigger>
            <TabsTrigger value="alerts">Listings</TabsTrigger>
          </TabsList>

          {/* Broker Price Opinion */}
          <TabsContent value="bpo" className="space-y-3 pt-3">
            {finalBpos.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  No finalized price opinion yet. Build one from the home on file, finalize it, then send it here.
                </p>
                <Button onClick={generateBpo} disabled={pending} variant="outline" className="w-full min-h-11">
                  {busy('Price opinion build') ? 'Starting build…' : 'Build a price opinion'}
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Price opinion</Label>
                  <Select value={bpoSlug} onValueChange={setBpoSlug}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a finalized opinion" />
                    </SelectTrigger>
                    <SelectContent>
                      {finalBpos.map((b) => (
                        <SelectItem key={b.slug} value={b.slug}>
                          {b.subjectAddress}
                          {b.opinionLine ? ` · ${b.opinionLine}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Label className="flex items-start gap-2 text-sm font-normal">
                  <Checkbox checked={bpoFull} onCheckedChange={(v) => setBpoFull(v === true)} className="mt-0.5" />
                  <span>
                    Include the internal offer strategy
                    <span className="block text-xs text-muted-foreground">
                      Off by default. Only include it when the recipient is your own buyer client.
                    </span>
                  </span>
                </Label>
                <Button onClick={sendBpo} disabled={pending || blocked || !bpoSlug} className="w-full min-h-11">
                  {busy('Price opinion') ? 'Sending…' : 'Send price opinion'}
                </Button>
              </>
            )}
          </TabsContent>

          {/* CMA */}
          <TabsContent value="cma" className="space-y-3 pt-3">
            {pendingCmas.length > 0 ? (
              <div className="space-y-1.5">
                {pendingCmas.map((c) => {
                  const building = c.buildState === 'queued' || c.buildState === 'building'
                  const failed = c.buildState === 'failed'
                  const statusLine = building
                    ? 'Building — you get a text when it is ready'
                    : failed
                      ? 'Build failed — open the CMA admin page to retry'
                      : 'Draft — review it, then it becomes sendable'
                  return (
                    <div key={c.slug} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground" title={c.subjectAddress}>{c.subjectAddress}</p>
                        <p className="text-xs text-muted-foreground">{statusLine}</p>
                      </div>
                      {!building ? (
                        <a href={c.reviewUrl} className="shrink-0 text-xs font-medium text-primary hover:underline">Review</a>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
            {finalCmas.length === 0 ? (
              <div className="space-y-3">
                {pendingCmas.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No finalized CMA yet. Build one — the draft arrives async and you review it before anything sends.
                  </p>
                ) : null}
                <Button asChild variant="outline" className="w-full min-h-11">
                  <a href={props.cmaBuildHref}>Build a CMA</a>
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>CMA</Label>
                  <Select value={cmaSlug} onValueChange={setCmaSlug}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a finalized CMA" />
                    </SelectTrigger>
                    <SelectContent>
                      {finalCmas.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.subjectAddress}
                          {c.valueLine ? ` · ${c.valueLine}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={sendCma} disabled={pending || blocked || !cmaSlug} className="w-full min-h-11">
                  {busy('CMA') ? 'Sending…' : 'Send CMA'}
                </Button>
                <a href={props.cmaBuildHref} className="block text-center text-xs font-medium text-primary hover:underline">
                  Build a new CMA
                </a>
              </>
            )}
          </TabsContent>

          {/* Newsletter */}
          <TabsContent value="newsletter" className="space-y-3 pt-3">
            <p className="text-sm text-muted-foreground">
              {props.newsletterSubscribed
                ? 'Subscribed to the monthly newsletter.'
                : 'Not subscribed — a one-off send still includes the unsubscribe footer.'}
            </p>
            {props.latestNewsletter ? (
              <div className="rounded-lg border border-border px-3 py-2">
                <p className="truncate text-sm font-medium text-foreground" title={props.latestNewsletter.subject}>
                  {props.latestNewsletter.subject}
                </p>
                <p className="text-xs text-muted-foreground">
                  {props.latestNewsletter.status === 'sent' ? 'Latest sent issue' : 'Newest draft'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No newsletter issue available yet.</p>
            )}
            <Button
              onClick={sendNewsletter}
              disabled={pending || blocked || !props.latestNewsletter}
              className="w-full min-h-11"
            >
              {busy('Newsletter') ? 'Sending…' : 'Send the newsletter now'}
            </Button>
          </TabsContent>

          {/* Market report */}
          <TabsContent value="report" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <Label>Areas</Label>
              <div className="flex flex-wrap gap-1.5">
                {props.reportAreas.map((a) => (
                  <Button
                    key={a.slug}
                    type="button"
                    size="sm"
                    variant={areas.includes(a.slug) ? 'default' : 'outline'}
                    onClick={() => toggleArea(a.slug)}
                    className="h-7 rounded-full px-3 text-xs"
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox checked={subscribe} onCheckedChange={(v) => setSubscribe(v === true)} />
              Also subscribe to a monthly report for these areas
            </Label>
            <Button onClick={sendReport} disabled={pending || blocked || areas.length === 0} className="w-full min-h-11">
              {busy('Market report') ? 'Sending…' : 'Send market report now'}
            </Button>
          </TabsContent>

          {/* Listing alerts */}
          <TabsContent value="alerts" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="sc-city">City</Label>
                <Input id="sc-city" placeholder="Bend" value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-subdivision">Subdivision</Label>
                <Input
                  id="sc-subdivision"
                  placeholder="West Hills"
                  value={subdivision}
                  onChange={(e) => setSubdivision(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-min">Min price</Label>
                <Input id="sc-min" inputMode="numeric" placeholder="500000" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-max">Max price</Label>
                <Input id="sc-max" inputMode="numeric" placeholder="900000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-beds">Min beds</Label>
                <Input id="sc-beds" inputMode="numeric" placeholder="3" value={minBeds} onChange={(e) => setMinBeds(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sc-freq">Alert cadence</Label>
                <Select value={freq} onValueChange={(v) => setFreq(v as SavedSearchCadence)}>
                  <SelectTrigger id="sc-freq" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAVED_SEARCH_CADENCES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Collapsible open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full justify-between px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  More filters
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform', moreFiltersOpen && 'rotate-180')}
                    aria-hidden
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-baths">Min baths</Label>
                    <Input id="sc-baths" inputMode="numeric" placeholder="2" value={minBaths} onChange={(e) => setMinBaths(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-sqft">Min sqft</Label>
                    <Input id="sc-sqft" inputMode="numeric" placeholder="1800" value={minSqFt} onChange={(e) => setMinSqFt(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-maxsqft">Max sqft</Label>
                    <Input id="sc-maxsqft" inputMode="numeric" placeholder="4000" value={maxSqFt} onChange={(e) => setMaxSqFt(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-garage">Min garage</Label>
                    <Input id="sc-garage" inputMode="numeric" placeholder="2" value={garageMin} onChange={(e) => setGarageMin(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-ybmin">Year built (min)</Label>
                    <Input id="sc-ybmin" inputMode="numeric" placeholder="1990" value={yearBuiltMin} onChange={(e) => setYearBuiltMin(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-ybmax">Year built (max)</Label>
                    <Input id="sc-ybmax" inputMode="numeric" placeholder="2025" value={yearBuiltMax} onChange={(e) => setYearBuiltMax(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-lotmin">Lot acres (min)</Label>
                    <Input id="sc-lotmin" inputMode="decimal" placeholder="0.25" value={lotAcresMin} onChange={(e) => setLotAcresMin(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-lotmax">Lot acres (max)</Label>
                    <Input id="sc-lotmax" inputMode="decimal" placeholder="5" value={lotAcresMax} onChange={(e) => setLotAcresMax(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="sc-subtype">Sub-type</Label>
                    <Input id="sc-subtype" placeholder="e.g. Condominium" value={propSubType} onChange={(e) => setPropSubType(e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="sc-keywords">Keywords</Label>
                    <Input id="sc-keywords" placeholder="shop, ADU, view…" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Home type</Label>
                    <Select value={propType} onValueChange={setPropType}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROPERTY_TYPES.map(({ value, label }) => (
                          <SelectItem key={value || 'all'} value={value || 'all'}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALERT_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1.5 pt-1">
                    <Label>Amenities</Label>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {([
                        ['Pool', hasPool, setHasPool],
                        ['View', hasView, setHasView],
                        ['Waterfront', hasWaterfront, setHasWaterfront],
                        ['Fireplace', hasFireplace, setHasFireplace],
                        ['Golf course', hasGolfCourse, setHasGolfCourse],
                      ] as const).map(([label, checked, set]) => (
                        <label key={label} className="flex items-center gap-2 text-sm text-foreground">
                          <Checkbox checked={checked} onCheckedChange={(v) => set(v === true)} />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            <p className="text-xs text-muted-foreground">
              Starts a recurring alert and emails the current matches now.
            </p>
            <Button onClick={sendListings} disabled={pending || blocked} className="w-full min-h-11">
              {busy('Listing matches') ? 'Sending…' : 'Start alerts + send matches'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
