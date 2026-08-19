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
 *
 * ── Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY. Every prop, idempotency-key claim, filter key, guard,
 * toast string and send action is byte-for-byte what it was; this panel is the
 * one send surface for five deliverables and both person surfaces mount it.
 *
 * Four notes on HOW the swap was done, because each one is a trap:
 *  - ONE primary button per file is the locked rule, and this panel has five
 *    identical send actions — one per tab, never two on screen at once. They
 *    render through a single local SendButton, the same local-wrapper shape
 *    SmsComposer and EmailComposer already use for their pending-aware sends.
 *    Same handlers, same disabled conditions, same labels.
 *  - Tabs and Collapsible keep their unstyled radix behaviour primitives and
 *    swap only the skin — the call MergeFieldInserter records in this folder.
 *    The barrel has no tab primitive (TabBar is the phone's 5-destination nav),
 *    and hand-rolling one would cost the roving focus radix already provides.
 *    Tabs became CONTROLLED for one reason: the active tab needs a token colour
 *    in the render, and a data-state text utility carrying that token in
 *    square brackets is exactly the arbitrary class the design-token gate
 *    rejects.
 *  - Reopening the dialog returns to the CMA tab, as it always did. That used
 *    to fall out of shadcn unmounting its content on close; the v2 dialog stays
 *    mounted, so the trigger resets the tab itself.
 *  - The dialog is `size="work"`, not the default 'ask'. The Listings tab is a
 *    two-column grid of fourteen fields — the exact case the primitive's own
 *    docstring records, where an ask-width modal silently collapses a migrating
 *    surface to one column.
 */

import { useMemo, useRef, useState, useTransition } from 'react'
import { Collapsible as CollapsiblePrimitive, Tabs as TabsPrimitive } from 'radix-ui'
import { ChevronDown, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Dialog, FilterChip, SelectField, TextField, ToolbarCheck } from '@/components/admin/v2'
import { cn } from '@/lib/utils'
import { SAVED_SEARCH_CADENCES, type SavedSearchCadence } from '@/lib/saved-search-cadence'
import { hasNarrowingFilter } from '@/lib/search-filters'
import { PROPERTY_TYPES } from '@/lib/property-type'
import type { ContactBpo } from '@/lib/data/crm/getContactBpos'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import { sendDeliverable } from '@/app/actions/send-deliverable'
import { setReportSubscriptionAction } from '@/app/actions/crm-report-subscriptions'
import { cmaCrmComposeHref } from '@/lib/cma/crm-compose-href'

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

const TABS = [
  { value: 'cma', label: 'CMA' },
  { value: 'bpo', label: 'Opinion' },
  { value: 'report', label: 'Report' },
  { value: 'newsletter', label: 'News' },
  { value: 'alerts', label: 'Listings' },
] as const

/** A section caption above a control group that has no single field to label. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block font-semibold" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
      {children}
    </span>
  )
}

/**
 * The one primary action, rendered once per tab. Underline-on-current rather
 * than a filled segment: §2 reserves fill for status, and hover is an opacity
 * utility so the inline token colour cannot outrank it.
 */
function SendTab(props: { value: string; label: string; active: boolean }) {
  return (
    <TabsPrimitive.Trigger
      value={props.value}
      className="-mb-px cursor-pointer px-2 py-2 hover:opacity-80"
      style={{
        border: 'none',
        borderBottom: `2px solid ${props.active ? 'var(--a-accent)' : 'transparent'}`,
        background: 'none',
        fontFamily: 'var(--a-font)',
        fontSize: 'var(--a-text-sm)',
        fontWeight: props.active ? 600 : 400,
        color: props.active ? 'var(--a-text)' : 'var(--a-text-2)',
      }}
    >
      {props.label}
    </TabsPrimitive.Trigger>
  )
}

/** The tab's send action. See the header note on the one-primary rule. */
function SendButton(props: { onClick: () => void; disabled: boolean; busy: boolean; label: string }) {
  return (
    <Button type="button" touch className="w-full" onClick={props.onClick} disabled={props.disabled}>
      {props.busy ? 'Sending…' : props.label}
    </Button>
  )
}

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
   *  speaks the admin language. Omitted everywhere else, which is what
   *  keeps the trigger primary there. Never affects the send path. */
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<string>('cma')
  const [pending, startTransition] = useTransition()
  /** Per-flow idempotency keys — stable across retries of THIS attempt; cleared on success. */
  const nlKeyRef = useRef('')
  const bpoKeyRef = useRef('')
  const reportKeyRef = useRef('')
  const listingsKeyRef = useRef('')

  function claimKey(ref: { current: string }): string {
    if (!ref.current) ref.current = crypto.randomUUID()
    return ref.current
  }

  const finalBpos = useMemo(() => props.bpos.filter((b) => b.status === 'final'), [props.bpos])
  const attachableCmas = useMemo(
    () => props.cmas.filter((c) => c.hasDocument && c.status !== 'archived'),
    [props.cmas],
  )
  // In-flight story: builds still running (build_state) or a draft without a
  // document yet. Drafts with a PDF attach in Messages — they are not "pending".
  const pendingCmas = useMemo(
    () =>
      props.cmas.filter((c) => {
        const inFlight = c.buildState === 'queued' || c.buildState === 'building' || c.buildState === 'failed'
        return inFlight || !c.hasDocument
      }),
    [props.cmas],
  )

  // BPO state
  const [bpoSlug, setBpoSlug] = useState(finalBpos[0]?.slug ?? '')
  const [bpoFull, setBpoFull] = useState(false)
  // CMA state
  const [cmaSlug, setCmaSlug] = useState(attachableCmas[0]?.slug ?? '')
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
    <>
      <Button
        type="button"
        touch
        variant={props.triggerClassName ? 'quiet' : 'primary'}
        className={props.triggerClassName ?? 'w-full'}
        onClick={() => {
          setTab('cma')
          setOpen(true)
        }}
      >
        <Send className="h-4 w-4" aria-hidden />
        Send to contact
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        size="work"
        title="Send to this contact"
        description="Price opinion, CMA, market report, or listing matches. One place."
      >
        {blocked ? (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{
              border: '1px solid var(--a-danger)',
              background: 'var(--a-danger-wash)',
              color: 'var(--a-danger)',
            }}
          >
            This contact has opted out of email. Sends are blocked until that changes.
          </div>
        ) : null}

        <TabsPrimitive.Root value={tab} onValueChange={setTab} className="mt-1">
          <TabsPrimitive.List
            className="grid w-full grid-cols-3 sm:grid-cols-5"
            style={{ borderBottom: '1px solid var(--a-border)' }}
          >
            {TABS.map((t) => (
              <SendTab key={t.value} value={t.value} label={t.label} active={tab === t.value} />
            ))}
          </TabsPrimitive.List>

          {/* Broker Price Opinion */}
          <TabsPrimitive.Content value="bpo" className="space-y-3 pt-3">
            {finalBpos.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
                  No finalized price opinion yet. Build one from the home on file, finalize it, then send it here.
                </p>
                <Button onClick={generateBpo} disabled={pending} variant="quiet" touch className="w-full">
                  {busy('Price opinion build') ? 'Starting build…' : 'Build a price opinion'}
                </Button>
              </div>
            ) : (
              <>
                <SelectField
                  label="Price opinion"
                  value={bpoSlug}
                  onChange={(e) => setBpoSlug(e.target.value)}
                >
                  <option value="" disabled>Choose a finalized opinion</option>
                  {finalBpos.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.subjectAddress}
                      {b.opinionLine ? ` · ${b.opinionLine}` : ''}
                    </option>
                  ))}
                </SelectField>
                <ToolbarCheck
                  checked={bpoFull}
                  onChange={(e) => setBpoFull(e.target.checked)}
                  labelStyle={{ alignItems: 'flex-start' }}
                  label={
                    <span>
                      Include the internal offer strategy
                      {/* The caption stays secondary while the row's own hover
                          brightens the line above it — two tones, one hover. */}
                      <span className="block text-xs" style={{ color: 'var(--a-text-2)' }}>
                        Off by default. Only include it when the recipient is your own buyer client.
                      </span>
                    </span>
                  }
                />
                <SendButton
                  onClick={sendBpo}
                  disabled={pending || blocked || !bpoSlug}
                  busy={busy('Price opinion')}
                  label="Send price opinion"
                />
              </>
            )}
          </TabsPrimitive.Content>

          {/* CMA */}
          <TabsPrimitive.Content value="cma" className="space-y-3 pt-3">
            {pendingCmas.length > 0 ? (
              <div className="space-y-1.5">
                {pendingCmas.map((c) => {
                  const building = c.buildState === 'queued' || c.buildState === 'building'
                  const failed = c.buildState === 'failed'
                  const statusLine = building
                    ? 'Building — you get a text when it is ready'
                    : failed
                      ? 'Build failed — open the CMA admin page to retry'
                      : 'Draft — rebuild it, then attach it in Messages'
                  return (
                    <div
                      key={c.slug}
                      className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                      style={{ border: '1px solid var(--a-border)' }}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" style={{ color: 'var(--a-text)' }} title={c.subjectAddress}>
                          {c.subjectAddress}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>{statusLine}</p>
                      </div>
                      {!building ? (
                        <a
                          href={c.reviewUrl}
                          className="shrink-0 text-xs font-medium hover:underline"
                          style={{ color: 'var(--a-accent)' }}
                        >
                          Review
                        </a>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : null}
            {attachableCmas.length === 0 ? (
              <div className="space-y-3">
                {pendingCmas.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
                    No CMA PDF yet. Build one — then attach it in Messages.
                  </p>
                ) : null}
                {/* A link that LOOKS like the quiet button it replaced: the v2
                    Button has no asChild, and an anchor carrying the button's
                    own classes keeps every state rule that comes with them. */}
                <a href={props.cmaBuildHref} className="av2-btn av2-btn--quiet av2-btn--touch w-full">
                  Build a CMA
                </a>
              </div>
            ) : (
              <>
                <SelectField label="CMA" value={cmaSlug} onChange={(e) => setCmaSlug(e.target.value)}>
                  <option value="" disabled>Choose a CMA</option>
                  {attachableCmas.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.subjectAddress}
                      {c.valueLine ? ` · ${c.valueLine}` : ''}
                    </option>
                  ))}
                </SelectField>
                <a
                  href={cmaCrmComposeHref({ personId: props.personId, slug: cmaSlug, channel: 'email' })}
                  className="av2-btn av2-btn--touch w-full"
                  style={{ textDecoration: 'none' }}
                >
                  Open in Messages
                </a>
                <a
                  href={props.cmaBuildHref}
                  className="block text-center text-xs font-medium hover:underline"
                  style={{ color: 'var(--a-accent)' }}
                >
                  Build a new CMA
                </a>
              </>
            )}
          </TabsPrimitive.Content>

          {/* Newsletter */}
          <TabsPrimitive.Content value="newsletter" className="space-y-3 pt-3">
            <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>
              {props.newsletterSubscribed
                ? 'Subscribed to the monthly newsletter.'
                : 'Not subscribed — a one-off send still includes the unsubscribe footer.'}
            </p>
            {props.latestNewsletter ? (
              <div className="rounded-lg px-3 py-2" style={{ border: '1px solid var(--a-border)' }}>
                <p
                  className="truncate text-sm font-medium"
                  style={{ color: 'var(--a-text)' }}
                  title={props.latestNewsletter.subject}
                >
                  {props.latestNewsletter.subject}
                </p>
                <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
                  {props.latestNewsletter.status === 'sent' ? 'Latest sent issue' : 'Newest draft'}
                </p>
              </div>
            ) : (
              <p className="text-sm" style={{ color: 'var(--a-text-2)' }}>No newsletter issue available yet.</p>
            )}
            <SendButton
              onClick={sendNewsletter}
              disabled={pending || blocked || !props.latestNewsletter}
              busy={busy('Newsletter')}
              label="Send the newsletter now"
            />
          </TabsPrimitive.Content>

          {/* Market report */}
          <TabsPrimitive.Content value="report" className="space-y-3 pt-3">
            <div className="space-y-1.5">
              <GroupLabel>Areas</GroupLabel>
              <div className="flex flex-wrap gap-1.5">
                {props.reportAreas.map((a) => (
                  <FilterChip
                    key={a.slug}
                    pressed={areas.includes(a.slug)}
                    onClick={() => toggleArea(a.slug)}
                    className="hover:opacity-80"
                  >
                    {a.label}
                  </FilterChip>
                ))}
              </div>
            </div>
            <ToolbarCheck
              checked={subscribe}
              onChange={(e) => setSubscribe(e.target.checked)}
              label="Also subscribe to a monthly report for these areas"
            />
            <SendButton
              onClick={sendReport}
              disabled={pending || blocked || areas.length === 0}
              busy={busy('Market report')}
              label="Send market report now"
            />
          </TabsPrimitive.Content>

          {/* Listing alerts */}
          <TabsPrimitive.Content value="alerts" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <TextField label="City" placeholder="Bend" value={city} onChange={(e) => setCity(e.target.value)} />
              <TextField
                label="Subdivision"
                placeholder="West Hills"
                value={subdivision}
                onChange={(e) => setSubdivision(e.target.value)}
              />
              <TextField label="Min price" inputMode="numeric" placeholder="500000" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
              <TextField label="Max price" inputMode="numeric" placeholder="900000" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
              <TextField label="Min beds" inputMode="numeric" placeholder="3" value={minBeds} onChange={(e) => setMinBeds(e.target.value)} />
              <SelectField
                label="Alert cadence"
                value={freq}
                onChange={(e) => setFreq(e.target.value as SavedSearchCadence)}
              >
                {SAVED_SEARCH_CADENCES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <CollapsiblePrimitive.Root open={moreFiltersOpen} onOpenChange={setMoreFiltersOpen}>
              <CollapsiblePrimitive.Trigger asChild>
                <Button type="button" variant="quiet" className="w-full" style={{ justifyContent: 'space-between' }}>
                  More filters
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 transition-transform', moreFiltersOpen && 'rotate-180')}
                    aria-hidden
                  />
                </Button>
              </CollapsiblePrimitive.Trigger>
              <CollapsiblePrimitive.Content>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <TextField label="Min baths" inputMode="numeric" placeholder="2" value={minBaths} onChange={(e) => setMinBaths(e.target.value)} />
                  <TextField label="Min sqft" inputMode="numeric" placeholder="1800" value={minSqFt} onChange={(e) => setMinSqFt(e.target.value)} />
                  {/* The sc-* ids are a GATE HANDLE, not styling. W7.5 pins that
                      the broker form exposes the full consumer filter vocabulary
                      (components/admin/crm/__tests__/contact-send-center-filters.test.ts)
                      and matches on these ids — a migration that strips them
                      silently narrows what a broker can target. TextField
                      generates its own id when none is given, so passing one is
                      free. */}
                  <TextField label="Max sqft" id="sc-maxsqft" inputMode="numeric" placeholder="4000" value={maxSqFt} onChange={(e) => setMaxSqFt(e.target.value)} />
                  <TextField label="Min garage" id="sc-garage" inputMode="numeric" placeholder="2" value={garageMin} onChange={(e) => setGarageMin(e.target.value)} />
                  <TextField label="Year built (min)" id="sc-ybmin" inputMode="numeric" placeholder="1990" value={yearBuiltMin} onChange={(e) => setYearBuiltMin(e.target.value)} />
                  <TextField label="Year built (max)" id="sc-ybmax" inputMode="numeric" placeholder="2025" value={yearBuiltMax} onChange={(e) => setYearBuiltMax(e.target.value)} />
                  <TextField label="Lot acres (min)" id="sc-lotmin" inputMode="decimal" placeholder="0.25" value={lotAcresMin} onChange={(e) => setLotAcresMin(e.target.value)} />
                  <TextField label="Lot acres (max)" id="sc-lotmax" inputMode="decimal" placeholder="5" value={lotAcresMax} onChange={(e) => setLotAcresMax(e.target.value)} />
                  <TextField label="Sub-type" id="sc-subtype" placeholder="e.g. Condominium" value={propSubType} onChange={(e) => setPropSubType(e.target.value)} />
                  <div className="col-span-2">
                    <TextField label="Keywords" id="sc-keywords" placeholder="shop, ADU, view…" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
                  </div>
                  <SelectField label="Home type" value={propType} onChange={(e) => setPropType(e.target.value)}>
                    {PROPERTY_TYPES.map(({ value, label }) => (
                      <option key={value || 'all'} value={value || 'all'}>
                        {label}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {ALERT_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                  <div className="col-span-2 space-y-1.5 pt-1">
                    <GroupLabel>Amenities</GroupLabel>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      {([
                        ['Pool', hasPool, setHasPool],
                        ['View', hasView, setHasView],
                        ['Waterfront', hasWaterfront, setHasWaterfront],
                        ['Fireplace', hasFireplace, setHasFireplace],
                        ['Golf course', hasGolfCourse, setHasGolfCourse],
                      ] as const).map(([label, checked, set]) => (
                        <ToolbarCheck
                          key={label}
                          label={label}
                          checked={checked}
                          onChange={(e) => set(e.target.checked)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CollapsiblePrimitive.Content>
            </CollapsiblePrimitive.Root>
            <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
              Starts a recurring alert and emails the current matches now.
            </p>
            <SendButton
              onClick={sendListings}
              disabled={pending || blocked}
              busy={busy('Listing matches')}
              label="Start alerts + send matches"
            />
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      </Dialog>
    </>
  )
}
