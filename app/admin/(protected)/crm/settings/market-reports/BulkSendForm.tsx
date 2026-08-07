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
 *
 * P11C: presentation migrated to the locked admin v2 language (ADMIN_UI.md).
 * Every state value, descriptor, and server-action call is unchanged; the area
 * picker is now one compact control (add-then-list) instead of a checkbox wall,
 * and the queue confirmation is an inline two-step instead of a modal.
 */

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, SectionHead, SelectField, StateWord, TextAreaField, TextField } from '@/components/admin/v2'
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
  const areaLabelBySlug = useMemo(
    () => new Map(areaOptions.map((a) => [a.slug, a.label])),
    [areaOptions],
  )

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
  const unpicked = areaOptions.filter((a) => !areas.includes(a.slug))

  return (
    <section aria-label="Send a report to a chosen audience" style={{ margin: '0 0 8px' }}>
      <SectionHead>Send a report to a chosen audience</SectionHead>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--a-s4)',
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          padding: 'var(--a-s4)',
          background: 'var(--a-bg)',
        }}
      >
        <p style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)', margin: 0 }}>
          The daily cron already mails each subscriber on their own cadence. This is the bulk path: one issue,
          one audience. Delivery runs through the newsletter queue, so suppression, opt-outs, the one-click
          unsubscribe rail, and warm-up pacing all apply per recipient.
        </p>

        <div className="av2-editgrid">
          <SelectField
            label="Audience"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as MarketReportAudienceKind)
              setPreview(null)
            }}
          >
            {MARKET_REPORT_AUDIENCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {AUDIENCE_KIND_LABELS[k]}
              </option>
            ))}
          </SelectField>

          {kind === 'report-subscribers' ? (
            <>
              <SelectField
                label="Cadence"
                value={cadence}
                onChange={(e) => {
                  setCadence(e.target.value)
                  setPreview(null)
                }}
              >
                {REPORT_CADENCE_FILTERS.map((c) => (
                  <option key={c} value={c}>
                    {c === 'any' ? 'Every cadence' : c}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Subscribed to"
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value)
                  setPreview(null)
                }}
              >
                <option value={ANY_AREA}>Any area</option>
                {areaOptions.map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.label}
                  </option>
                ))}
              </SelectField>
            </>
          ) : null}

          {kind === 'newsletter-segment' ? (
            <SelectField
              label="Segment"
              value={segment}
              onChange={(e) => {
                setSegment(e.target.value)
                setPreview(null)
              }}
            >
              {NEWSLETTER_SEGMENT_KEYS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          ) : null}

          {kind === 'crm-tag' ? (
            <TextField
              label="CRM tag"
              value={tag}
              onChange={(e) => {
                setTag(e.target.value)
                setPreview(null)
              }}
              placeholder="e.g. past-client"
            />
          ) : null}
        </div>

        {kind === 'explicit' ? (
          <TextAreaField
            label="Emails"
            value={emails}
            onChange={(e) => {
              setEmails(e.target.value)
              setPreview(null)
            }}
            placeholder="One per line, or comma separated."
            rows={5}
            hint={`${parsedEmails.length.toLocaleString('en-US')} valid address${
              parsedEmails.length === 1 ? '' : 'es'
            } parsed. Cap is ${MAX_LIST_RECIPIENTS.toLocaleString('en-US')} per send.`}
          />
        ) : null}

        <div style={{ borderTop: '1px solid var(--a-border)', paddingTop: 'var(--a-s4)' }}>
          <SelectField
            label="Areas in this report"
            value=""
            hint="Pick an area to add it. The report renders one section per area."
            onChange={(e) => {
              const slug = e.target.value
              if (slug) toggleArea(slug)
            }}
          >
            <option value="">Add an area…</option>
            {unpicked.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.label}
              </option>
            ))}
          </SelectField>
          <ul
            className="av2-wordrow"
            style={{ listStyle: 'none', margin: 'var(--a-s2) 0 0', padding: 0 }}
          >
            {areas.length === 0 ? (
              <li style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-sm)' }}>
                No areas picked yet.
              </li>
            ) : null}
            {areas.map((slug) => (
              <li key={slug} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <StateWord state="accent">{areaLabelBySlug.get(slug) ?? slug}</StateWord>
                <Button
                  variant="quiet"
                  onClick={() => toggleArea(slug)}
                  aria-label={`Remove ${areaLabelBySlug.get(slug) ?? slug}`}
                  style={{ minHeight: 28, padding: '0 8px' }}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--a-s3)' }}>
          <Button variant="quiet" onClick={onPreview} disabled={pending}>
            {pending ? 'Working…' : 'Preview this send'}
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabled={pending || !preview || windowShut}>
            Queue through the newsletter ledger
          </Button>
          {!preview ? (
            <span style={{ color: 'var(--a-text-2)', fontSize: 'var(--a-text-xs)' }}>
              Preview first. Queueing is disabled until you do.
            </span>
          ) : null}
        </div>

        {message ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 'var(--a-text-sm)',
              color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)',
            }}
          >
            {message.text}
          </p>
        ) : null}

        {confirmOpen ? (
          <div
            role="group"
            aria-label="Queue this send?"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--a-s2)',
              border: '1px solid var(--a-border)',
              borderRadius: 'var(--a-r-lg)',
              background: 'var(--a-inset)',
              padding: 'var(--a-s4)',
            }}
          >
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              The issue goes into the newsletter queue. The send cron delivers it, skipping anyone suppressed
              or opted out, and pacing a large audience across days.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--a-text-lg)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--a-text)',
              }}
            >
              {(preview?.recipientCount ?? 0).toLocaleString('en-US')} recipients
            </p>
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              {preview?.audienceLabel}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              {preview?.subject}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--a-s3)' }}>
              <Button variant="quiet" onClick={() => setConfirmOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="danger" onClick={onQueue} disabled={pending || !preview}>
                {pending ? 'Queueing…' : 'Confirm and queue'}
              </Button>
            </div>
          </div>
        ) : null}

        {preview ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--a-s2)',
              border: '1px solid var(--a-border)',
              borderRadius: 'var(--a-r-lg)',
              background: 'var(--a-surface)',
              padding: 'var(--a-s4)',
            }}
          >
            <div className="av2-wordrow">
              <StateWord state="accent">
                {preview.recipientCount.toLocaleString('en-US')} recipients
              </StateWord>
              <StateWord state="waiting">{preview.audienceLabel}</StateWord>
              <StateWord state="waiting">
                {preview.route === 'audience-segment' ? 'segment enqueue' : 'list enqueue'}
              </StateWord>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
              {preview.subject}
            </p>
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              {preview.audienceTrace}
            </p>
            {preview.sample.length > 0 ? (
              <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                First few: {preview.sample.join(', ')}
              </p>
            ) : null}
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              Areas rendered: {preview.renderedAreas.join(', ') || '—'}
              {preview.omittedAreas.length > 0
                ? ` · omitted for lack of verified data: ${preview.omittedAreas.join(', ')}`
                : ''}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--a-text-xs)',
                color: 'var(--a-text-2)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {preview.citations.length} figure{preview.citations.length === 1 ? '' : 's'} traced to the market
              cache.
            </p>
            {windowShut ? (
              <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
                Outside the 8am to 8pm send window. Queueing opens again at{' '}
                {new Date(preview.windowOpensAt as string).toLocaleString('en-US')}.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
