'use client'

/**
 * ContactSendCenter — ONE intuitive place to send a CRM contact any of the four
 * deliverables: a Broker Price Opinion, a CMA, a Market report, or Listing
 * matches from a saved search. A single "Send to contact" button opens a dialog
 * with a tab per deliverable; each routes to that deliverable's existing send
 * action. Email-suppressed contacts block every send up front.
 */

import { useMemo, useState, useTransition } from 'react'
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
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const finalBpos = useMemo(() => props.bpos.filter((b) => b.status === 'final'), [props.bpos])
  const finalCmas = useMemo(
    () => props.cmas.filter((c) => c.status === 'finalized' || c.status === 'delivered'),
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

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    startTransition(async () => {
      const r = await fn()
      if (r.ok) {
        toast.success(r.message ?? `${label} sent.`)
        setOpen(false)
      } else {
        toast.error(r.error ?? `${label} could not be sent.`)
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
        await setReportSubscriptionAction(props.personId, { areas, frequency: 'monthly', isActive: true })
      }
      return { ok: true, message: subscribe ? 'Market report sent and monthly subscription set.' : 'Market report sent.' }
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

        <Tabs defaultValue="bpo" className="mt-1">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="bpo">Opinion</TabsTrigger>
            <TabsTrigger value="cma">CMA</TabsTrigger>
            <TabsTrigger value="report">Report</TabsTrigger>
            <TabsTrigger value="alerts">Listings</TabsTrigger>
          </TabsList>

          {/* Broker Price Opinion */}
          <TabsContent value="bpo" className="space-y-3 pt-3">
            {finalBpos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No finalized price opinion yet. Build one from the Broker price opinions card, finalize it, then send it here.
              </p>
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
            {finalCmas.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No finalized CMA yet. Build and approve one from the CMAs card, then send it here.
              </p>
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
              </>
            )}
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
