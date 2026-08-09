'use client'

/**
 * The visual-first newsletter review panel (Matt directive: he approves a
 * RENDERED newsletter, never raw HTML). Default tab is the rendered preview —
 * the exact wrapNewsletterHtml output the send pipeline delivers — inside a
 * sandboxed iframe at desktop (640px email) or mobile (375px) width, with a
 * per-broker switcher that visibly swaps the close card. The raw HTML source
 * sits behind a secondary tab.
 *
 * Admin v2 (11F): shadcn Tabs/ToggleGroup/Select/Button/Label were replaced by
 * the locked admin language. The tab pair is a FilterChip segmented control —
 * the same pattern already shipped for the Body/Preview toggle in
 * crm/settings/_components/templates/EmailTemplateModal.tsx — which keeps the
 * original's mount behavior exactly: the inactive pane unmounts, as Radix
 * Tabs also did. The width toggle is the same segmented pattern. Presentation
 * only: same server actions, same states, same strings.
 */

import { useState, useTransition } from 'react'
import { Button, FilterChip, SelectField } from '@/components/admin/v2'
import { adminPreviewNewsletterAction, adminTestSendNewsletterAction } from '@/app/actions/newsletter'

const BROKERS: { value: string; label: string }[] = [
  { value: 'matt', label: 'Matt' },
  { value: 'rebecca', label: 'Rebecca' },
  { value: 'paul', label: 'Paul' },
]

type Props = {
  id: string
  /** Server-rendered initial preview (Matt's identity) so the page opens visual. */
  initialHtml: string | null
  initialBroker?: string
}

export default function NewsletterPreviewPanel({ id, initialHtml, initialBroker = 'matt' }: Props) {
  const [broker, setBroker] = useState(initialBroker)
  const [html, setHtml] = useState<string | null>(initialHtml)
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')
  const [tab, setTab] = useState<'preview' | 'source'>('preview')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [testMsg, setTestMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function loadPreview(slug: string) {
    setError(null)
    startTransition(async () => {
      const r = await adminPreviewNewsletterAction(id, slug)
      if (r.ok && r.html) {
        setHtml(r.html)
      } else {
        const map: Record<string, string> = {
          empty_body: 'This draft has no HTML body yet. Add one in the Edit tab and save.',
          no_brokers: 'The broker roster could not be read.',
          not_found: 'Newsletter not found.',
          unauthorized: 'You do not have access to preview.',
        }
        setError(map[r.error ?? ''] ?? r.error ?? 'Could not render the preview.')
      }
    })
  }

  function onBrokerChange(slug: string) {
    setBroker(slug)
    setTestMsg(null)
    loadPreview(slug)
  }

  function onTestSend() {
    setTestMsg(null)
    startTransition(async () => {
      const r = await adminTestSendNewsletterAction(id, broker)
      setTestMsg(
        r.ok
          ? { type: 'ok', text: 'Test sent to your inbox.' }
          : { type: 'err', text: r.error ?? 'Could not send the test.' },
      )
    })
  }

  const frameWidth = width === 'mobile' ? 375 : 680

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div
          className="flex"
          style={{ gap: 2, padding: 2, background: 'var(--a-inset)', borderRadius: 'var(--a-r-md)', width: 'fit-content' }}
        >
          {(
            [
              { key: 'preview' as const, label: 'Rendered preview' },
              { key: 'source' as const, label: 'HTML source' },
            ]
          ).map((t) => (
            <FilterChip
              key={t.key}
              pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              style={{
                border: 'none',
                borderRadius: 'var(--a-r-sm)',
                padding: '6px 14px',
                fontWeight: 500,
                background: tab === t.key ? 'var(--a-bg)' : 'transparent',
                color: tab === t.key ? 'var(--a-text)' : 'var(--a-text-2)',
              }}
            >
              {t.label}
            </FilterChip>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Recipient's broker"
            value={broker}
            onChange={(e) => onBrokerChange(e.target.value)}
            style={{ width: 144 }}
          >
            {BROKERS.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </SelectField>

          <div role="group" aria-label="Preview width" className="flex" style={{ gap: 2 }}>
            <FilterChip pressed={width === 'desktop'} onClick={() => setWidth('desktop')}>
              Desktop
            </FilterChip>
            <FilterChip pressed={width === 'mobile'} onClick={() => setWidth('mobile')}>
              Mobile
            </FilterChip>
          </div>

          <Button type="button" variant="quiet" onClick={() => loadPreview(broker)} disabled={pending}>
            {pending ? 'Rendering…' : 'Refresh'}
          </Button>
          <Button type="button" variant="quiet" onClick={onTestSend} disabled={pending}>
            Send test to me
          </Button>
        </div>
      </div>

      {testMsg ? (
        <p
          role="alert"
          style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: testMsg.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)' }}
        >
          {testMsg.text}
        </p>
      ) : null}
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>
          {error}
        </p>
      ) : null}

      {tab === 'preview' ? (
        html ? (
          <div
            className="flex justify-center"
            style={{ borderRadius: 'var(--a-r-lg)', border: '1px solid var(--a-border)', background: 'var(--a-inset)', padding: 16 }}
          >
            <iframe
              title="Newsletter rendered preview"
              srcDoc={html}
              // Fully-restricted sandbox: the body is authored content. Static
              // HTML, CSS, and images still render under sandbox="".
              sandbox=""
              style={{
                width: frameWidth,
                height: 900,
                borderRadius: 'var(--a-r-md)',
                border: '1px solid var(--a-border)',
                background: 'var(--a-bg)',
                boxShadow: width === 'mobile' ? 'var(--a-shadow-overlay)' : undefined,
              }}
            />
          </div>
        ) : (
          <div
            style={{
              borderRadius: 'var(--a-r-lg)',
              border: '1px dashed var(--a-border)',
              background: 'var(--a-inset)',
              padding: 32,
              textAlign: 'center',
              fontSize: 'var(--a-text-sm)',
              color: 'var(--a-text-2)',
            }}
          >
            No preview yet. Add an HTML body in the Edit section and save, then refresh.
          </div>
        )
      ) : null}

      {tab === 'source' ? (
        html ? (
          <pre
            style={{
              maxHeight: 720,
              overflow: 'auto',
              borderRadius: 'var(--a-r-lg)',
              border: '1px solid var(--a-border)',
              background: 'var(--a-inset)',
              padding: 16,
              fontSize: 'var(--a-text-xs)',
              lineHeight: 1.6,
              color: 'var(--a-text)',
            }}
          >
            {html}
          </pre>
        ) : (
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Nothing rendered yet.</p>
        )
      ) : null}
    </div>
  )
}
