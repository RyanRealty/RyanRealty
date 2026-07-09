'use client'

/**
 * ContactCmaCard — the contact's CMAs from public.cmas (the in-house CMA
 * engine), right-rail card. Each row: address, status, value range, and the
 * action that matches its state — review a draft, send a finalized one, or
 * re-send a delivered one (all through sendCmaForContactAction via the bound
 * form action, which guards status + suppression server-side).
 */
import { useState, useTransition } from 'react'
import { FileText } from 'lucide-react'
import { formatDate } from '@/lib/format/date'
import type { ContactCma } from '@/lib/data/crm/getContactCmas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

function fmtDate(iso: string): string {
  return formatDate(iso, { month: 'short', day: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  building: 'Building',
  finalized: 'Ready to send',
  delivered: 'Sent',
}

export function ContactCmaCard(props: {
  cmas: ContactCma[]
  /** Bound sendCmaForm(personId, fd) — posts deliveryId=slug. */
  sendAction: (formData: FormData) => Promise<void>
}) {
  const [pending, startTransition] = useTransition()
  const [sendingSlug, setSendingSlug] = useState<string | null>(null)
  if (props.cmas.length === 0) return null

  function send(slug: string) {
    const fd = new FormData()
    fd.set('deliveryId', slug)
    setSendingSlug(slug)
    startTransition(async () => {
      await props.sendAction(fd)
      setSendingSlug(null)
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm">
          <FileText className="h-4 w-4 text-primary" aria-hidden />
          CMAs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {props.cmas.map((c) => {
          const sendable = c.status === 'finalized' || c.status === 'delivered'
          return (
            <div key={c.slug} className="rounded-lg border border-border p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground" title={c.subjectAddress}>{c.subjectAddress}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.valueLine ? `${c.valueLine} · ` : ''}{fmtDate(c.createdAt)}
                  </p>
                </div>
                <Badge variant={c.status === 'delivered' ? 'secondary' : 'outline'} className={cn('shrink-0 text-xs', c.status === 'finalized' && 'border-success text-success')}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {c.previewUrl ? (
                  <Button asChild type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <a href={c.previewUrl} target="_blank" rel="noopener noreferrer">Review</a>
                  </Button>
                ) : null}
                {sendable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={c.status === 'delivered' ? 'outline' : 'default'}
                    disabled={pending}
                    onClick={() => send(c.slug)}
                    className="h-7 px-2.5 text-xs"
                  >
                    {sendingSlug === c.slug ? 'Sending…' : c.status === 'delivered' ? 'Re-send' : 'Send to contact'}
                  </Button>
                ) : null}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
