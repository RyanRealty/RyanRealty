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
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
import type { ContactBpo } from '@/lib/data/crm/getContactBpos'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import { sendBpoForContactAction } from '@/app/actions/contact-bpo'
import { sendCmaForContactAction } from '@/app/actions/contact-cma'
import { sendMarketReportNowAction } from '@/app/actions/crm-send-now'
import { setReportSubscriptionAction } from '@/app/actions/crm-report-subscriptions'
import { sendListingMatchesForContactAction } from '@/app/actions/contact-listing-matches'

type Area = { slug: string; label: string }

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
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const nlKeyRef = useRef('')

  const finalBpos = useMemo(() => props.bpos.filter((b) => b.status === 'final'), [props.bpos])
  const finalCmas = useMemo(
    () => props.cmas.filter((c) => c.status === 'finalized' || c.status === 'delivered'),
    [props.cmas],
  )
  // In-flight story: drafts awaiting review + builds still running, so the CMA
  // tab never claims "no CMA" while one is minutes from ready (the kick-off
  // worker texts the broker on ready; this is orientation, not live progress).
  const pendingCmas = useMemo(
    () => props.cmas.filter((c) => c.status !== 'finalized' && c.status !== 'delivered'),
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
  // Listing alerts state
  const [city, setCity] = useState(props.defaultCity ?? '')
  const [subdivision, setSubdivision] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minBeds, setMinBeds] = useState('')
  const [freq, setFreq] = useState<'weekly' | 'daily'>('weekly')

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
  }

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
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
      }
    })
  }

  function sendBpo() {
    if (!bpoSlug) return
    run('Price opinion', () => sendBpoForContactAction(props.personId, bpoSlug, bpoFull))
  }
  function sendCma() {
    if (!cmaSlug) return
    run('CMA', async () => {
      const r = await sendCmaForContactAction(cmaSlug)
      return r.ok ? { ok: true, message: 'CMA sent.' } : { ok: false, error: r.error }
    })
  }
  function sendReport() {
    if (areas.length === 0) {
      toast.error('Pick at least one area.')
      return
    }
    run('Market report', async () => {
      const fd = new FormData()
      areas.forEach((a) => fd.append('areas', a))
      const r = await sendMarketReportNowAction(props.personId, fd)
      if (!r.ok) return { ok: false, error: r.error }
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
    const mn = Number(minPrice.replace(/[^0-9]/g, ''))
    const mx = Number(maxPrice.replace(/[^0-9]/g, ''))
    const mb = Number(minBeds)
    if (Number.isFinite(mn) && mn > 0) filters.minPrice = mn
    if (Number.isFinite(mx) && mx > 0) filters.maxPrice = mx
    if (Number.isFinite(mb) && mb > 0) filters.beds = mb
    if (Object.keys(filters).length === 0) {
      toast.error('Add a city, subdivision, price, or beds so the search is not the whole MLS.')
      return
    }
    run('Listing matches', () =>
      sendListingMatchesForContactAction(props.personId, JSON.stringify(filters), { frequency: freq }),
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" className="w-full min-h-11">
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
                  {pending ? 'Starting build…' : 'Build a price opinion'}
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
                  {pending ? 'Sending…' : 'Send price opinion'}
                </Button>
              </>
            )}
          </TabsContent>

          {/* CMA */}
          <TabsContent value="cma" className="space-y-3 pt-3">
            {pendingCmas.length > 0 ? (
              <div className="space-y-1.5">
                {pendingCmas.map((c) => (
                  <div key={c.slug} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground" title={c.subjectAddress}>{c.subjectAddress}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.status === 'building' ? 'Building — you get a text when it is ready' : 'Draft — review it, then it becomes sendable'}
                      </p>
                    </div>
                    {c.status !== 'building' ? (
                      // Broker review = the authed admin CMA page (works for every
                      // draft; previewUrl is NULL on builder-built rows).
                      <a href={`/admin/cmas/${c.slug}`} className="shrink-0 text-xs font-medium text-primary hover:underline">Review</a>
                    ) : null}
                  </div>
                ))}
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
                  {pending ? 'Sending…' : 'Send CMA'}
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
              {pending ? 'Sending…' : 'Send the newsletter now'}
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
              {pending ? 'Sending…' : 'Send market report now'}
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
                <Select value={freq} onValueChange={(v) => setFreq(v as 'weekly' | 'daily')}>
                  <SelectTrigger id="sc-freq" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Starts a recurring alert and emails the current matches now.
            </p>
            <Button onClick={sendListings} disabled={pending || blocked} className="w-full min-h-11">
              {pending ? 'Sending…' : 'Start alerts + send matches'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
