'use client'

/**
 * DashboardActivityFeed — the segmented "Right now" activity feed on the broker
 * dashboard (docs/MOBILE_CRM_FUB_PARITY.md #3).
 *
 * FUB's home feed segments into New Leads / Emails / Website — a flat list per
 * tab. Ours matches that information architecture and beats it: the Website
 * segment leads with our live engagement score (the column FUB has no concept
 * of), so the warmest visitor on the site right now sits at the top. All three
 * segments are pre-shaped on the server; this component only switches between
 * them — no data fetching, every row links to a real route.
 */

import Link from 'next/link'
import { useState } from 'react'
import { ChevronRight, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

export type WebsiteRow = { key: string; score: number; who: string; intent: string | null; href: string; hot: boolean }
export type EmailRow = { key: string; who: string; kind: string; preview: string | null; href: string; ts: string }
export type LeadRow = { key: string; who: string; source: string | null; stage: string; href: string; pictureUrl: string | null; ts: string }

type Segment = 'leads' | 'emails' | 'website'

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (mins < 1440) return `${Math.round(mins / 60)}h`
  return `${Math.round(mins / 1440)}d`
}

const KIND_LABEL: Record<string, string> = { email_in: 'Email', sms_in: 'Text', call: 'Call', voicemail: 'Voicemail' }

export default function DashboardActivityFeed({
  website,
  emails,
  newLeads,
}: {
  website: WebsiteRow[]
  emails: EmailRow[]
  newLeads: LeadRow[]
}) {
  // Default to Website — the live-intent feed is our edge and the thing a broker
  // most wants the second the page opens.
  const [seg, setSeg] = useState<Segment>('website')

  const tabs: { key: Segment; label: string; count: number }[] = [
    { key: 'leads', label: 'New leads', count: newLeads.length },
    { key: 'emails', label: 'Emails', count: emails.length },
    { key: 'website', label: 'Website', count: website.length },
  ]

  return (
    <div className="border-t border-border">
      {/* Segment chips */}
      <div className="flex gap-1 overflow-x-auto px-3 py-2.5" role="tablist" aria-label="Activity">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={seg === t.key}
            onClick={() => setSeg(t.key)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              seg === t.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
          >
            {t.label}
            <span className={cn('tabular-nums', seg === t.key ? 'text-primary-foreground/80' : 'text-muted-foreground/70')}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Website — engagement-ranked (our edge: the score column) */}
      {seg === 'website' ? (
        website.length === 0 ? (
          <Empty>No site activity yet today. Live visitors show here, hottest first.</Empty>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {website.map((s) => (
              <li key={s.key}>
                <Link href={s.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                  <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums', s.hot ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>{s.score}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{s.who}</span>
                  {s.intent ? <span className="shrink-0 text-xs text-muted-foreground">{s.intent}</span> : null}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {/* Emails — recent inbound conversations */}
      {seg === 'emails' ? (
        emails.length === 0 ? (
          <Empty>No recent inbound emails, texts, or calls.</Empty>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {emails.map((e) => (
              <li key={e.key}>
                <Link href={e.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                  <span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{KIND_LABEL[e.kind] ?? 'Msg'}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{e.who}</span>
                    {e.preview ? <span className="block truncate text-xs text-muted-foreground">{e.preview}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{ago(e.ts)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {/* New leads — most recently added */}
      {seg === 'leads' ? (
        newLeads.length === 0 ? (
          <Empty>No new leads yet.</Empty>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {newLeads.map((l) => (
              <li key={l.key}>
                <Link href={l.href} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40">
                  {l.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.pictureUrl} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">{(l.who ?? '?').charAt(0).toUpperCase()}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{l.who}</span>
                    {l.source ? <span className="block truncate text-xs text-muted-foreground">via {l.source}</span> : null}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{ago(l.ts)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-t border-border px-4 py-6 text-sm text-muted-foreground">
      <Eye className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
