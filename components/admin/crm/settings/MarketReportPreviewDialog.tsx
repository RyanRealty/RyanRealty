'use client'

/**
 * MarketReportPreviewDialog — one-click preview of the market-report email
 * (Wave 8). Renders the EXACT html a recipient gets (same data path + same
 * renderer, via the previewMarketReportEmail server action) inside a sandboxed
 * iframe (srcDoc), with the §0 verification traces listed below it. Traces are
 * admin-only — they never ship in the recipient email.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

export function MarketReportPreviewDialog({
  areas,
  contactName = null,
  label = 'Preview',
  variant = 'outline',
  size = 'sm',
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
      <Button variant={variant} size={size} onClick={loadPreview} disabled={isPending || areas.length === 0}>
        {isPending ? 'Building…' : label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{preview?.subject ?? 'Market report preview'}</DialogTitle>
            <DialogDescription>
              The exact html the recipient gets, followed by the verification trace for every
              figure shown. Traces never appear in the sent email.
            </DialogDescription>
          </DialogHeader>

          {preview ? (
            <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                {preview.renderedAreas.map((slug) => (
                  <Badge key={slug} variant="secondary">
                    {slug}
                  </Badge>
                ))}
                {preview.omittedAreas.map((slug) => (
                  <Badge key={slug} variant="outline">
                    {slug} (no cache data, omitted)
                  </Badge>
                ))}
              </div>

              <iframe
                title="Market report email preview"
                srcDoc={preview.html}
                sandbox=""
                className="h-[52vh] w-full rounded-xl border border-border bg-card"
              />

              <Separator />

              <div>
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  Verification traces ({preview.traces.length})
                </h3>
                <ul className="space-y-1.5">
                  {preview.traces.map((t, i) => (
                    <li key={i} className="text-xs leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">{t.figure}</span>
                      {' — '}
                      {t.source}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
