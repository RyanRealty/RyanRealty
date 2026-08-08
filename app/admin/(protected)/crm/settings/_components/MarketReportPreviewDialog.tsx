'use client'

/**
 * MarketReportPreviewDialog — one-click preview of the market-report email
 * (Wave 8). Renders the EXACT html a recipient gets (same data path + same
 * renderer, via the previewMarketReportEmail server action) inside a sandboxed
 * iframe (srcDoc), with the §0 verification traces listed below it. Traces are
 * admin-only — they never ship in the recipient email.
 *
 * P11 admin-v2: migrated to the LOCKED admin language
 * (design_system/admin/ADMIN_UI.md). shadcn Dialog/Button/Badge/Separator are
 * gone, and so is every shadcn semantic color class — those resolve to the
 * PUBLIC brand palette, so a preview dialog wearing them looked like the
 * marketing site. Color and type now come from var(--a-*). The overlay is the
 * v2 <Dialog> — the platform <dialog> element, so the focus trap and Esc come
 * from the browser. Its width is the locked 460px, NARROWER than the 56rem
 * this dialog used to claim; the iframe fills it and the body scrolls. Data
 * path, action call, toast and open/close conditions unchanged.
 *
 * `variant` and `size` stay in the props for the callers that already pass
 * them (crm/settings/market-reports/page.tsx). v2 has one button size, so
 * `size` no longer changes anything; `variant` maps onto the two v2 variants
 * this trigger can be — 'default' is the page's emphasised action, everything
 * else is quiet.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button, Dialog } from '@/components/admin/v2'
import {
  previewMarketReportEmail,
  type MarketReportEmailPreview,
} from '@/app/actions/crm-market-report-preview'

type Props = {
  /** Area slugs to render the preview for (a subscriber's areas, or a sample). */
  areas: string[]
  /** Greeting name to render with (a subscriber's name, or null for neutral). */
  contactName?: string | null
  /** Button label. */
  label?: string
  /** Button variant — table rows use ghost, the sample card uses default. */
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm'
}

/** Badge — a bordered word, not a pill (pills are reserved for FilterChip). */
const BADGE_BASE = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
}

export function MarketReportPreviewDialog({
  areas,
  contactName = null,
  label = 'Preview',
  variant = 'outline',
}: Props) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<MarketReportEmailPreview | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadPreview = () => {
    startTransition(async () => {
      const { data, error } = await previewMarketReportEmail({ areas, contactName })
      if (error || !data) {
        toast.error(error ?? 'Failed to build the preview')
        return
      }
      setPreview(data)
      setOpen(true)
    })
  }

  return (
    <>
      <Button
        variant={variant === 'default' ? 'primary' : 'quiet'}
        onClick={loadPreview}
        disabled={isPending || areas.length === 0}
      >
        {isPending ? 'Building…' : label}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={preview?.subject ?? 'Market report preview'}
        description="The exact html the recipient gets, followed by the verification trace for every figure shown. Traces never appear in the sent email."
      >
        {preview ? (
          <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
            <div className="flex flex-wrap items-center gap-2">
              {preview.renderedAreas.map((slug) => (
                <span key={slug} style={{ ...BADGE_BASE, background: 'var(--a-inset)' }}>
                  {slug}
                </span>
              ))}
              {preview.omittedAreas.map((slug) => (
                <span key={slug} style={{ ...BADGE_BASE, border: '1px solid var(--a-border)' }}>
                  {slug} (no cache data, omitted)
                </span>
              ))}
            </div>

            <iframe
              title="Market report email preview"
              srcDoc={preview.html}
              sandbox=""
              className="w-full"
              style={{
                height: '52vh',
                border: '1px solid var(--a-border)',
                borderRadius: 'var(--a-r-lg)',
                background: 'var(--a-bg)',
              }}
            />

            <div style={{ borderTop: '1px solid var(--a-border)' }} />

            <div>
              <h3
                style={{
                  fontSize: 'var(--a-text-sm)',
                  fontWeight: 600,
                  color: 'var(--a-text)',
                  margin: '0 0 var(--a-s2)',
                }}
              >
                Verification traces (<span className="a-num">{preview.traces.length}</span>)
              </h3>
              <ul className="space-y-1.5">
                {preview.traces.map((t, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 'var(--a-text-xs)',
                      lineHeight: 'var(--a-leading)',
                      color: 'var(--a-text-2)',
                    }}
                  >
                    <span style={{ fontWeight: 500, color: 'var(--a-text)' }}>{t.figure}</span>
                    {' — '}
                    {t.source}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  )
}
