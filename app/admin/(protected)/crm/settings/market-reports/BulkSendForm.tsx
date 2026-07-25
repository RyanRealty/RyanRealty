'use client'

/**
 * BulkSendForm — the AUDIENCE SELECTOR on the market-report send engine (W8.6).
 *
 * Pick who the report goes to, pick which areas it covers, PREVIEW (which writes
 * nothing), then queue. Queue hands the issue to the newsletter delivery ledger,
 * which owns suppression, opt-out, the unsubscribe rail, warm-up tranching, and
 * the per-recipient delivery record. This form never sends mail itself.
 *
 * The kind list, the labels, and the recipient cap all come from
 * lib/newsletter/market-report-audience, the same module the server resolver
 * imports, so the picker and the router cannot drift.
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AUDIENCE_KIND_LABELS,
  MARKET_REPORT_AUDIENCE_KINDS,
  MAX_LIST_RECIPIENTS,
  NEWSLETTER_SEGMENT_KEYS,
  REPORT_CADENCE_FILTERS,
  type MarketReportAudienceKind,
} from '@/lib/newsletter/market-report-audience'
import { parseEmailList } from '@/lib/newsletter/parse-emails'
import {
  previewMarketReportBulkAction,
  queueMarketReportBulkAction,
  type PreviewActionResult,
} from './actions'

type AreaOption = { slug: string; label: string }

type Preview = Extract<PreviewActionResult, { ok: true }>['preview']

const ANY_AREA = '__any__'

export default function BulkSendForm({ areaOptions }: { areaOptions: AreaOption[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [kind, setKind] = useState<MarketReportAudienceKind>('report-subscribers')
  const [cadence, setCadence] = useState<string>('any')
  const [areaFilter, setAreaFilter] = useState<string>(ANY_AREA)
  const [segment, setSegment] = useState<string>('general')
  const [tag, setTag] = useState('')
  const [emails, setEmails] = useState('')
  const [areas, setAreas] = useState<string[]>(['bend'])

  const [preview, setPreview] = useState<Preview | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const parsedEmails = useMemo(() => parseEmailList(emails), [emails])

  function audienceDescriptor(): unknown {
    switch (kind) {
      case 'report-subscribers':
        return { kind, cadence, areaSlug: areaFilter === ANY_AREA ? '' : areaFilter }
      case 'newsletter-segment':
        return { kind, segment }
      case 'crm-tag':
        return { kind, tag: tag.trim() }
      case 'explicit':
        return { kind, emails: parsedEmails }
    }
  }

  function toggleArea(slug: string) {
    setPreview(null)
    setAreas((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }

  function onPreview() {
    setMessage(null)
    startTransition(async () => {
      const r = await previewMarketReportBulkAction({ audience: audienceDescriptor(), areas })
      if (r.ok) {
        setPreview(r.preview)
      } else {
        setPreview(null)
        setMessage({ type: 'err', text: r.error })
      }
    })
  }

  function onQueue() {
    if (!preview) return
    startTransition(async () => {
      const r = await queueMarketReportBulkAction({
        audience: audienceDescriptor(),
        areas,
        expectedRecipientCount: preview.recipientCount,
      })
      setConfirmOpen(false)
      if (r.ok) {
        setPreview(null)
        setMessage({
          type: 'ok',
          text: `Queued ${r.queued.queued.toLocaleString('en-US')} recipient${r.queued.queued === 1 ? '' : 's'} through the newsletter ledger. Track it on the newsletter issue.`,
        })
        router.refresh()
      } else {
        setMessage({ type: 'err', text: r.error })
      }
    })
  }

  const windowShut = Boolean(preview?.windowOpensAt)

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Send a report to a chosen audience</CardTitle>
        <CardDescription>
          The daily cron already mails each subscriber on their own cadence. This is the bulk path: one issue, one
          audience. Delivery runs through the newsletter queue, so suppression, opt-outs, the one-click unsubscribe
          rail, and warm-up pacing all apply per recipient.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="bulk-audience-kind">Audience</Label>
            <Select
              value={kind}
              onValueChange={(v) => {
                setKind(v as MarketReportAudienceKind)
                setPreview(null)
              }}
            >
              <SelectTrigger id="bulk-audience-kind">
                <SelectValue placeholder="Pick an audience" />
              </SelectTrigger>
              <SelectContent>
                {MARKET_REPORT_AUDIENCE_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {AUDIENCE_KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {kind === 'report-subscribers' ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-cadence">Cadence</Label>
                <Select
                  value={cadence}
                  onValueChange={(v) => {
                    setCadence(v)
                    setPreview(null)
                  }}
                >
                  <SelectTrigger id="bulk-cadence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_CADENCE_FILTERS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c === 'any' ? 'Every cadence' : c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-area-filter">Subscribed to</Label>
                <Select
                  value={areaFilter}
                  onValueChange={(v) => {
                    setAreaFilter(v)
                    setPreview(null)
                  }}
                >
                  <SelectTrigger id="bulk-area-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_AREA}>Any area</SelectItem>
                    {areaOptions.map((a) => (
                      <SelectItem key={a.slug} value={a.slug}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          {kind === 'newsletter-segment' ? (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-segment">Segment</Label>
              <Select
                value={segment}
                onValueChange={(v) => {
                  setSegment(v)
                  setPreview(null)
                }}
              >
                <SelectTrigger id="bulk-segment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEWSLETTER_SEGMENT_KEYS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {kind === 'crm-tag' ? (
            <div className="space-y-1.5">
              <Label htmlFor="bulk-tag">CRM tag</Label>
              <Input
                id="bulk-tag"
                value={tag}
                onChange={(e) => {
                  setTag(e.target.value)
                  setPreview(null)
                }}
                placeholder="e.g. past-client"
              />
            </div>
          ) : null}
        </div>

        {kind === 'explicit' ? (
          <div className="space-y-1.5">
            <Label htmlFor="bulk-emails">Emails</Label>
            <Textarea
              id="bulk-emails"
              value={emails}
              onChange={(e) => {
                setEmails(e.target.value)
                setPreview(null)
              }}
              placeholder="One per line, or comma separated."
              rows={5}
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              {parsedEmails.length.toLocaleString('en-US')} valid address
              {parsedEmails.length === 1 ? '' : 'es'} parsed. Cap is{' '}
              {MAX_LIST_RECIPIENTS.toLocaleString('en-US')} per send.
            </p>
          </div>
        ) : null}

        <Separator />

        <div className="space-y-2">
          <Label>Areas in this report</Label>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {areaOptions.map((a) => (
              <label key={a.slug} className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={areas.includes(a.slug)} onCheckedChange={() => toggleArea(a.slug)} />
                {a.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={onPreview} disabled={pending}>
            {pending ? 'Working…' : 'Preview this send'}
          </Button>
          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={pending || !preview || windowShut}
          >
            Queue through the newsletter ledger
          </Button>
          {!preview ? (
            <span className="text-xs text-muted-foreground">Preview first. Queueing is disabled until you do.</span>
          ) : null}
        </div>

        {message ? (
          <p className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'} role="alert">
            {message.text}
          </p>
        ) : null}

        {preview ? (
          <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{preview.recipientCount.toLocaleString('en-US')} recipients</Badge>
              <Badge variant="secondary">{preview.audienceLabel}</Badge>
              <Badge variant="secondary">
                {preview.route === 'audience-segment' ? 'segment enqueue' : 'list enqueue'}
              </Badge>
            </div>
            <p className="text-sm text-foreground">{preview.subject}</p>
            <p className="text-xs text-muted-foreground">{preview.audienceTrace}</p>
            {preview.sample.length > 0 ? (
              <p className="text-xs text-muted-foreground">First few: {preview.sample.join(', ')}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Areas rendered: {preview.renderedAreas.join(', ') || '—'}
              {preview.omittedAreas.length > 0
                ? ` · omitted for lack of verified data: ${preview.omittedAreas.join(', ')}`
                : ''}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {preview.citations.length} figure{preview.citations.length === 1 ? '' : 's'} traced to the market cache.
            </p>
            {windowShut ? (
              <p className="text-sm text-destructive">
                Outside the 8am to 8pm send window. Queueing opens again at{' '}
                {new Date(preview.windowOpensAt as string).toLocaleString('en-US')}.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Queue this send?</DialogTitle>
            <DialogDescription>
              The issue goes into the newsletter queue. The send cron delivers it, skipping anyone suppressed or
              opted out, and pacing a large audience across days.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <p className="text-lg font-semibold text-foreground tabular-nums">
              {(preview?.recipientCount ?? 0).toLocaleString('en-US')} recipients
            </p>
            <p className="text-sm text-muted-foreground">{preview?.audienceLabel}</p>
            <p className="text-sm text-muted-foreground">{preview?.subject}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={onQueue} disabled={pending || !preview}>
              {pending ? 'Queueing…' : 'Confirm and queue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
