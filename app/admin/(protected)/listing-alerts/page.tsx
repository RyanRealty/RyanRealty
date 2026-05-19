/**
 * Admin queue for the LP-driven listing-alerts subsystem.
 *
 * Lists every subscriber captured by the Custom Alerts forms across all
 * community / subdivision / city LPs with their criteria summary, status,
 * last-sent timestamp, and 30-day match count. Superuser only.
 *
 * Distinct from /admin/saved-searches (which is the older authenticated-user
 * saved-search system).
 *
 * Inline actions are wired in `ListingAlertsRow` (pause / unpause /
 * unsubscribe / edit criteria via the existing /api/listing-alerts/* endpoints).
 */
import { redirect } from 'next/navigation'

import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { createServiceClient } from '@/lib/supabase/service'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { ListingAlertsRow } from './ListingAlertsRow'

import type { ListingAlertCriteria } from '@/lib/listing-alerts/types'

export const dynamic = 'force-dynamic'

type SubscriberRow = {
  id: string
  email: string
  name: string
  source_lp: string
  community_slug: string | null
  city_slug: string | null
  criteria: ListingAlertCriteria
  status: 'active' | 'paused' | 'unsubscribed'
  paused_until: string | null
  pause_reason: string | null
  fub_lead_id: string | null
  last_sent_at: string | null
  unsubscribed_at: string | null
  created_at: string
  updated_at: string
  matches_30d: number
}

function summarizeCriteria(c: ListingAlertCriteria): string {
  const parts: string[] = []
  if (c.price_min || c.price_max) {
    parts.push(`$${(c.price_min / 1000).toFixed(0)}K-$${(c.price_max / 1000).toFixed(0)}K`)
  }
  if (c.beds_min) parts.push(`${c.beds_min}+ bed`)
  if (c.baths_min) parts.push(`${c.baths_min}+ bath`)
  if (c.sqft_min) parts.push(`${c.sqft_min}+ sqft`)
  if (c.subdivision) parts.push(c.subdivision)
  return parts.join(' · ') || '—'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

function statusBadge(status: SubscriberRow['status']) {
  if (status === 'active') return <Badge className="bg-success text-success-foreground">Active</Badge>
  if (status === 'paused') return <Badge className="bg-warning text-warning-foreground">Paused</Badge>
  return <Badge variant="outline">Unsubscribed</Badge>
}

export default async function ListingAlertsAdminPage() {
  const session = await getSession()
  const adminRole = await getAdminRoleForEmail(session?.user?.email ?? null)
  if (adminRole?.role !== 'superuser') {
    redirect('/admin/access-denied')
  }

  const supabase = createServiceClient()

  const { data: subscribersRaw, error } = await supabase
    .from('listing_alerts')
    .select(
      'id,email,name,source_lp,community_slug,city_slug,criteria,status,paused_until,pause_reason,fub_lead_id,last_sent_at,unsubscribed_at,created_at,updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(500)

  // Pull 30-day match counts per alert
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: matchCountsRaw } = await supabase
    .from('listing_alert_matches')
    .select('alert_id')
    .gte('matched_at', thirtyDaysAgo)

  const matchCounts = new Map<string, number>()
  for (const m of (matchCountsRaw ?? []) as Array<{ alert_id: string }>) {
    matchCounts.set(m.alert_id, (matchCounts.get(m.alert_id) ?? 0) + 1)
  }

  const subscribers: SubscriberRow[] = (subscribersRaw ?? []).map((row) => {
    const r = row as unknown as Omit<SubscriberRow, 'matches_30d'>
    return { ...r, matches_30d: matchCounts.get(r.id) ?? 0 }
  })

  // KPI counters
  const total = subscribers.length
  const active = subscribers.filter((s) => s.status === 'active').length
  const paused = subscribers.filter((s) => s.status === 'paused').length
  const unsub = subscribers.filter((s) => s.status === 'unsubscribed').length
  const last7dSubs = subscribers.filter(
    (s) => new Date(s.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).length

  return (
    <main className="mx-auto max-w-[1600px] space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Listing alerts subscribers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          LP-driven saved-search subscribers from Custom Alerts forms on every
          community, subdivision, and city landing page. Daily digest runs at
          7:05am PT.
        </p>
        {error && (
          <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            Query error: {error.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Paused
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{paused}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Unsubscribed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{unsub}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              New last 7d
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums">{last7dSubs}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email · Name</TableHead>
                <TableHead>Source LP</TableHead>
                <TableHead>Geo</TableHead>
                <TableHead>Criteria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right tabular-nums">Last sent</TableHead>
                <TableHead className="text-right tabular-nums">30d matches</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscribers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No subscribers yet.
                  </TableCell>
                </TableRow>
              ) : (
                subscribers.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{sub.email}</div>
                      <div className="text-xs text-muted-foreground">{sub.name}</div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{sub.source_lp}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {sub.community_slug
                          ? `resort:${sub.community_slug}`
                          : sub.city_slug
                            ? `city:${sub.city_slug}`
                            : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{summarizeCriteria(sub.criteria)}</span>
                    </TableCell>
                    <TableCell>{statusBadge(sub.status)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {formatDate(sub.last_sent_at)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {sub.matches_30d}
                    </TableCell>
                    <TableCell className="text-right">
                      <ListingAlertsRow
                        alertId={sub.id}
                        email={sub.email}
                        status={sub.status}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  )
}
