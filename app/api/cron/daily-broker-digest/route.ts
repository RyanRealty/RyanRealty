/**
 * Daily digest for each Ryan Realty broker, sourced from our own crm_* tables.
 *
 * Schedule: 0 15 * * *  (15:00 UTC = 08:00 PT during DST, 07:00 PT in winter).
 *
 * For each active broker in `public.brokers`:
 *   1. Assemble their digest from crm_* via getBrokerDigest, scoped by slug
 *      (the value stored in crm_people.assigned_broker / crm_tasks.assigned_broker):
 *        - new leads created in the last 24 hours
 *        - open tasks
 *        - hot / awaiting workflow enrollments
 *        - recent inbound replies (sms_in / email_in / form_submit / voicemail)
 *   2. Shape it with summarizeDigest (pure) and send one email. Subject:
 *      "Your day in the CRM, YYYY-MM-DD".
 *
 * Phase 10.4 repoint: this used to read the FUB People API
 * (resolveFubUserId -> /people?assignedUserId&createdAfter). It now reads our
 * own CRM, so the digest keeps working through (and after) the FUB cutover. The
 * email/delivery mechanism (sendEmail + Resend) is unchanged; only the DATA
 * SOURCE moved.
 *
 * Brand voice §4.7: sentence case, no em-dashes, no banned cliches, direct.
 * Auth: Bearer $CRON_SECRET.
 *
 * Manual invocation: GET /api/cron/daily-broker-digest?dryRun=true
 */

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/resend'
import { isAuthorizedCron } from '@/lib/marketing-brain/snapshot'
import { BrokerCrmDigestEmail } from '@/lib/digest-email-templates'
import { getBrokerDigest, summarizeDigest } from '@/lib/data/crm/getBrokerDigest'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

type Broker = {
  slug: string
  email: string
  displayName: string
  firstName: string
}

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

async function loadBrokers(): Promise<Broker[]> {
  const supabase = getServiceSupabase()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('brokers')
    .select('slug, display_name, email, is_active')
    .eq('is_active', true)
    .order('sort_order')
  if (error || !Array.isArray(data)) return []
  return data
    .filter((b) => b.email?.includes('@'))
    .map((b) => {
      const firstName = (b.display_name || '').split(/\s+/)[0] || 'there'
      return {
        slug: String(b.slug),
        email: String(b.email),
        displayName: String(b.display_name || b.slug),
        firstName,
      }
    })
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const dryRun = url.searchParams.get('dryRun') === 'true'
  const onlyBroker = url.searchParams.get('broker')?.trim().toLowerCase() || null

  const fromEnv = process.env.RESEND_FROM?.trim() || 'Matt Ryan <matt@ryan-realty.com>'
  const asOfDate = new Date().toISOString().slice(0, 10)
  const windowStartIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const brokers = await loadBrokers()
  if (brokers.length === 0) {
    return NextResponse.json({ ok: false, error: 'no active brokers' }, { status: 200 })
  }

  const results: Array<{
    broker: string
    leadsFound: number
    openTasks: number
    awaitingBroker: number
    recentInbound: number
    emailed: boolean
    emailId?: string
    error?: string
  }> = []

  for (const broker of brokers) {
    if (onlyBroker && broker.slug.toLowerCase() !== onlyBroker) continue

    let summary: ReturnType<typeof summarizeDigest>
    try {
      const rows = await getBrokerDigest({
        brokerSlug: broker.slug,
        brokerFirstName: broker.firstName,
        windowStartIso,
        asOfDate,
      })
      summary = summarizeDigest(rows)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({
        broker: broker.slug,
        leadsFound: 0,
        openTasks: 0,
        awaitingBroker: 0,
        recentInbound: 0,
        emailed: false,
        error: msg,
      })
      continue
    }

    const counts = summary.counts
    if (dryRun) {
      results.push({
        broker: broker.slug,
        leadsFound: counts.newLeads,
        openTasks: counts.openTasks,
        awaitingBroker: counts.awaitingBroker,
        recentInbound: counts.recentInbound,
        emailed: false,
      })
      continue
    }

    const subject = `Your day in the CRM, ${asOfDate}`
    const sent = await sendEmail({
      to: broker.email,
      from: fromEnv,
      subject,
      replyTo: 'matt@ryan-realty.com',
      react: BrokerCrmDigestEmail({
        brokerFirstName: summary.brokerFirstName,
        asOfDate: summary.asOfDate,
        summarySentence: summary.summarySentence,
        leads: summary.leads.map((l) => ({
          personId: l.personId,
          name: l.name,
          email: l.email,
          phone: l.phone,
          source: l.source,
          audience: l.audience,
          crmUrl: l.crmUrl,
        })),
        tasks: summary.tasks,
        enrollments: summary.enrollments.map((e) => ({
          enrollmentId: e.enrollmentId,
          personName: e.personName,
          sequenceName: e.sequenceName,
          status: e.status,
          awaiting: e.awaiting,
        })),
        inbound: summary.inbound,
      }),
    })

    if (sent.error) {
      results.push({
        broker: broker.slug,
        leadsFound: counts.newLeads,
        openTasks: counts.openTasks,
        awaitingBroker: counts.awaitingBroker,
        recentInbound: counts.recentInbound,
        emailed: false,
        error: sent.error,
      })
    } else {
      results.push({
        broker: broker.slug,
        leadsFound: counts.newLeads,
        openTasks: counts.openTasks,
        awaitingBroker: counts.awaitingBroker,
        recentInbound: counts.recentInbound,
        emailed: true,
        emailId: sent.id,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    asOfDate,
    windowStartIso,
    source: 'crm',
    dryRun,
    results,
  })
}
