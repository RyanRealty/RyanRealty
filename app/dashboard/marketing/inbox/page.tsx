/**
 * /dashboard/marketing/inbox — Marketing inbox admin view.
 *
 * Read-only audit surface for marketing@ryan-realty.com activity. Shows
 * the last 50 inbox events with sender, subject, parser output, dispatch
 * routing, and reply status. Admin-gated (same pattern as the marketing
 * dashboard).
 *
 * Use this to:
 *   - Confirm the cron is processing emails (look at received_at)
 *   - Audit which senders are being allowlisted vs rejected
 *   - Find stuck events (parsed but never dispatched, etc.)
 *   - Cross-reference an inbox event to its marketing_brain_actions row
 *
 * No mutations from this page. To re-process a stuck event, hit the
 * cron route manually (see SKILL.md §8).
 */

import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export const revalidate = 30
export const dynamic = 'force-dynamic'

// ─── service-role client ────────────────────────────────────────────────────

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  return createClient(url, key)
}

// ─── types ───────────────────────────────────────────────────────────────────

interface InboxEventRow {
  id: string
  received_at: string
  sender_email: string
  sender_name: string | null
  subject: string | null
  status: 'received' | 'parsed' | 'dispatched' | 'replied' | 'killed'
  parsed_intent: string | null
  parsed_target: string | null
  parser_confidence: number | string | null
  parser_rationale: string | null
  reply_status: string | null
  reply_message_id: string | null
  reply_error: string | null
  action_row_id: string | null
  kill_reason: string | null
}

interface StatusCount {
  status: string
  count: number
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'replied': return 'default'
    case 'dispatched': return 'secondary'
    case 'parsed': return 'secondary'
    case 'received': return 'outline'
    case 'killed': return 'destructive'
    default: return 'outline'
  }
}

function fmtConfidence(c: number | string | null | undefined): string {
  if (c === null || c === undefined) return '—'
  const n = typeof c === 'string' ? Number(c) : c
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(2)
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '—'
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

// ─── data ────────────────────────────────────────────────────────────────────

async function loadInboxData(): Promise<{
  events: InboxEventRow[]
  totalsByStatus: StatusCount[]
  latestReceivedAt: string | null
}> {
  const supabase = getServiceSupabase()
  const eventsRes = await supabase
    .from('marketing_inbox_events')
    .select(
      'id, received_at, sender_email, sender_name, subject, status, parsed_intent, parsed_target, parser_confidence, parser_rationale, reply_status, reply_message_id, reply_error, action_row_id, kill_reason',
    )
    .order('received_at', { ascending: false })
    .limit(50)

  const events = (eventsRes.data ?? []) as InboxEventRow[]

  // Derive status counts from the visible window. At expected volume this
  // is the entire table; we'll move to a RPC aggregate if it ever grows.
  const m = new Map<string, number>()
  for (const e of events) m.set(e.status, (m.get(e.status) ?? 0) + 1)
  const totalsByStatus: StatusCount[] = Array.from(m.entries()).map(([status, count]) => ({ status, count }))

  const latestReceivedAt = events.length > 0 ? events[0].received_at : null
  return { events, totalsByStatus, latestReceivedAt }
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function MarketingInboxAdminPage() {
  const session = await getSession()
  if (!session?.user) {
    redirect('/auth-error?next=/dashboard/marketing/inbox')
  }
  const adminRole = await getAdminRoleForEmail(session.user.email)
  if (!adminRole) {
    redirect('/admin/access-denied')
  }

  const { events, totalsByStatus, latestReceivedAt } = await loadInboxData()
  const totalEvents = events.length

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Marketing brain
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Inbox events
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Audit of emails sent to marketing@ryan-realty.com. Last 50 events. Latest:{' '}
            <span className="font-medium text-foreground">
              {latestReceivedAt ? relativeTime(latestReceivedAt) : 'no events yet'}
            </span>
            .
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {totalsByStatus.map((t) => (
              <Badge key={t.status} variant={statusVariant(t.status)}>
                {t.status}: {t.count}
              </Badge>
            ))}
            {totalsByStatus.length === 0 && (
              <Badge variant="outline">no events</Badge>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {totalEvents === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No inbox events yet. Send a test email to{' '}
              <span className="font-medium text-foreground">marketing@ryan-realty.com</span> from an
              allowlisted address and check back in 2 minutes.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Recent events</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">When</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Routed to</TableHead>
                    <TableHead className="text-right">Conf.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {relativeTime(e.received_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{e.sender_name || e.sender_email}</div>
                        {e.sender_name && (
                          <div className="text-xs text-muted-foreground">{e.sender_email}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[280px]">
                        <div className="truncate">{truncate(e.subject, 80)}</div>
                        {e.kill_reason && (
                          <div className="text-xs text-destructive mt-1">{truncate(e.kill_reason, 80)}</div>
                        )}
                        {e.reply_error && (
                          <div className="text-xs text-destructive mt-1">reply: {truncate(e.reply_error, 80)}</div>
                        )}
                        {e.parser_rationale && e.status !== 'killed' && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {truncate(e.parser_rationale, 100)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(e.status)}>{e.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.action_row_id ? (
                          <div>
                            <div className="font-medium text-foreground">{e.parsed_intent || '—'}</div>
                            <div className="text-muted-foreground">{truncate(e.parsed_target, 30)}</div>
                            <Link
                              href={`/dashboard/marketing?action=${e.action_row_id}`}
                              className="text-xs text-primary underline-offset-2 hover:underline"
                            >
                              view action
                            </Link>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {fmtConfidence(e.parser_confidence)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Separator />

        <Card>
          <CardHeader>
            <CardTitle>Operational levers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              Manually trigger a poll:
            </p>
            <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
{`curl -H "Authorization: Bearer \\$CRON_SECRET" \\
  "https://ryanrealty.vercel.app/api/cron/marketing-inbox-poll?maxMessages=5"`}
            </pre>
            <p>
              Dry-run (no reply sent, no Gmail-side read-mark):
            </p>
            <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
{`curl -H "Authorization: Bearer \\$CRON_SECRET" \\
  "https://ryanrealty.vercel.app/api/cron/marketing-inbox-poll?dryReply=true&dryRead=true&maxMessages=1"`}
            </pre>
            <p className="text-muted-foreground">
              Source of truth for the menu brokers see:{' '}
              <span className="font-mono text-foreground">app/marketing/request/deliverables.ts</span>.
              Source of truth for the allowlist:{' '}
              <span className="font-mono text-foreground">config/marketing-brain/inbox-senders.json</span>.
            </p>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}
