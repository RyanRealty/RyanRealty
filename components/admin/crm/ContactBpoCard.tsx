'use client'

/**
 * ContactBpoCard — the contact's Broker Price Opinions (public.broker_price_
 * opinions), right-rail card. Lists each opinion (address, opinion of value,
 * confidence, status) with a Review link, and a "New price opinion" button that
 * runs the deterministic builder against the contact's home on file.
 */
import { useTransition } from 'react'
import { Gauge } from 'lucide-react'
import { formatDate } from '@/lib/format/date'
import type { ContactBpo } from '@/lib/data/crm/getContactBpos'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  final: 'Final',
  archived: 'Archived',
}

export function ContactBpoCard(props: {
  bpos: ContactBpo[]
  /** Bound startBpoForm(personId) — builds a BPO for the contact's home. */
  generateAction: () => Promise<void>
}) {
  const [pending, startTransition] = useTransition()

  function generate() {
    startTransition(async () => {
      await props.generateAction()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <Gauge className="h-4 w-4 text-primary" aria-hidden />
          Broker price opinions
        </CardTitle>
        <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={pending} onClick={generate}>
          {pending ? 'Building…' : 'New opinion'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {props.bpos.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No price opinion yet. Build one from the home on file.
          </p>
        ) : (
          props.bpos.map((b) => (
            <div key={b.slug} className="rounded-lg border border-border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground" title={b.subjectAddress}>
                    {b.subjectAddress}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.opinionLine ? `${b.opinionLine} · ` : ''}
                    {b.confidence ? `${b.confidence} · ` : ''}
                    {formatDate(b.createdAt, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <Badge
                  variant={b.status === 'final' ? 'secondary' : 'outline'}
                  className={cn('shrink-0 text-xs', b.status === 'final' && 'border-success text-success')}
                >
                  {STATUS_LABEL[b.status] ?? b.status}
                </Badge>
              </div>
              <div className="mt-2">
                <Button asChild type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                  <a href={b.previewUrl} target="_blank" rel="noopener noreferrer">
                    Review
                  </a>
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
