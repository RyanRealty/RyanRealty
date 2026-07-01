import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import {
  getEmailCampaigns,
  getCampaignEngagement,
} from './getEmailReporting'

// ── Types ─────────────────────────────────────────────────────────────────────

export type BatchEmailRow = {
  /** UUID from email_campaigns.id */
  id: string
  subject: string | null
  /** Broker slug who sent this campaign (from email_events.broker on the 'sent' event). */
  fromBrokerSlug: string | null
  /** Broker display name resolved from the brokers table. */
  fromBrokerName: string | null
  /** ISO timestamp from email_campaigns.created_at. */
  createdAtIso: string
  /** ISO timestamp from email_campaigns.sent_at (null if not yet sent). */
  sentAtIso: string | null
  /**
   * Stored recipient count from email_campaigns.sent_count.
   * This is set at send time and is the total audience size.
   */
  recipientCount: number
  /**
   * Count of 'sent' events in email_events for this campaign (real delivery
   * attempt count). Falls back to recipientCount when the campaign has no
   * matching email_events rows (tracked:false).
   */
  sent: number
  /** Count of 'open' events for this campaign (from email_events). */
  opens: number
  /** Count of 'click' events for this campaign (from email_events). */
  clicks: number
  /** Count of 'unsubscribe' events for this campaign (from email_events). */
  unsubscribes: number
  /**
   * Open rate = opens / delivered. NULL when no deliveries exist — never a
   * fake 0% (CLAUDE.md §0 data accuracy rule).
   */
  openRate: number | null
  /**
   * Click rate = clicks / delivered. NULL when no deliveries exist.
   */
  clickRate: number | null
  /** 'finished' when sent_at is set; 'draft' when the campaign was saved but not sent. */
  status: 'finished' | 'draft'
  /** Whether any email_events rows were found for this campaign. */
  tracked: boolean
}

export type BatchEmailsResult = {
  rows: BatchEmailRow[]
  /**
   * True only when the email_campaigns table itself is unreadable (DB error).
   * A successful read that returns zero rows is NOT unreadable — it is an
   * honest empty state.
   */
  unreadable: boolean
}

// ── Core reader (uncached) ────────────────────────────────────────────────────

async function readBatchEmailsReport(
  brokerSlug: string | null,
): Promise<BatchEmailsResult> {
  const sb = createServiceClient()

  // 1. Fetch recent campaigns (up to 100, newest first).
  //    Reuses the cached getEmailCampaigns reader from the email reporting DAL.
  const { rows: campaigns, unreadable } = await getEmailCampaigns(100)
  if (unreadable && campaigns.length === 0) {
    return { rows: [], unreadable: true }
  }

  // 2. Collect the Resend message IDs (stored as fub_campaign_id) for the join.
  const messageIds = campaigns
    .map((c) => c.messageId)
    .filter((id): id is string => !!id && id.trim().length > 0)

  // 3. Per-campaign engagement from email_events (sent / delivered / open / click /
  //    unsubscribe / bounce counts + honest rates).
  //    getCampaignEngagement returns tracked:false when no events exist — we never
  //    show a fake 0% for an untracked campaign (CLAUDE.md §0).
  const engagementMap = await getCampaignEngagement(messageIds)

  // 4. Look up the broker slug for each campaign from the first 'sent' event.
  //    email_campaigns has no broker column; the sender identity lives in
  //    email_events.broker on the row whose event='sent'.
  const brokerByMid = new Map<string, string>()
  if (messageIds.length > 0) {
    const { data: sentEvents } = await sb
      .from('email_events')
      .select('message_id,broker')
      .in('message_id', messageIds)
      .eq('event', 'sent')
      .not('broker', 'is', null)
      // At most 2 per campaign to stay cheap; first non-null broker wins
      .limit(messageIds.length * 2)

    for (const ev of (sentEvents ?? []) as Array<{
      message_id: string | null
      broker: string | null
    }>) {
      const mid = (ev.message_id ?? '').trim()
      if (mid && ev.broker && !brokerByMid.has(mid)) {
        brokerByMid.set(mid, ev.broker)
      }
    }
  }

  // 5. Resolve broker slugs → display names from the brokers table.
  const { data: brokerRows } = await sb
    .from('brokers')
    .select('crm_slug,display_name')
    .not('crm_slug', 'is', null)
    .eq('crm_active', true)

  const brokerNameBySlug = new Map<string, string>()
  for (const b of (brokerRows ?? []) as Array<{
    crm_slug: string | null
    display_name: string | null
  }>) {
    if (b.crm_slug) {
      brokerNameBySlug.set(b.crm_slug, b.display_name ?? b.crm_slug)
    }
  }

  // 6. Apply broker scope filter and build the output rows.
  const rows: BatchEmailRow[] = campaigns
    .filter((c) => {
      // No scope restriction → include all campaigns.
      if (!brokerSlug) return true
      const mid = (c.messageId ?? '').trim()
      const campaignBroker = mid ? brokerByMid.get(mid) : undefined
      // If we know the sender broker, filter strictly; otherwise include
      // (can't exclude what we don't know — fails safe toward inclusion).
      return !campaignBroker || campaignBroker === brokerSlug
    })
    .map((c) => {
      const mid = (c.messageId ?? '').trim()
      const eng = mid ? (engagementMap.get(mid) ?? null) : null
      const fromSlug = mid ? (brokerByMid.get(mid) ?? null) : null
      const fromName = fromSlug ? (brokerNameBySlug.get(fromSlug) ?? fromSlug) : null

      const opens = eng?.opened ?? 0
      const clicks = eng?.clicked ?? 0
      const unsubscribes = eng?.unsubscribed ?? 0
      // Real sent count from events when tracked; fall back to stored sent_count.
      const sent = eng?.tracked ? eng.sent : c.sentCount
      // Use delivered as the rate denominator when available (more accurate).
      const delivered = eng?.tracked && (eng.delivered ?? 0) > 0
        ? (eng.delivered ?? 0)
        : sent

      // Rates: NULL on zero denominator — never a fake 0% (CLAUDE.md §0).
      const openRate = delivered > 0 ? opens / delivered : null
      const clickRate = delivered > 0 ? clicks / delivered : null

      return {
        id: c.id,
        subject: c.subject,
        fromBrokerSlug: fromSlug,
        fromBrokerName: fromName,
        createdAtIso: c.createdAtIso,
        sentAtIso: c.sentAtIso,
        recipientCount: c.sentCount,
        sent,
        opens,
        clicks,
        unsubscribes,
        openRate,
        clickRate,
        status: c.sentAtIso ? 'finished' : 'draft',
        tracked: eng?.tracked ?? false,
      }
    })

  return { rows, unreadable: false }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Batch Emails report data — recent email campaigns with per-campaign engagement
 * sourced from email_events. Cached 10 minutes (matching FUB's documented cache
 * TTL for reporting).
 *
 * Metric → crm_* source mapping:
 *   subject         → email_campaigns.subject
 *   from            → email_events.broker (first 'sent' event) → brokers.display_name
 *   created         → email_campaigns.created_at
 *   recipientCount  → email_campaigns.sent_count
 *   sent            → COUNT(email_events WHERE event='sent' AND message_id=campaign)
 *                     falls back to email_campaigns.sent_count when untracked
 *   opens           → COUNT(email_events WHERE event='open')
 *   clicks          → COUNT(email_events WHERE event='click')
 *   unsubscribes    → COUNT(email_events WHERE event='unsubscribe')
 *   openRate        → opens / delivered (NULL when delivered=0 — never fake 0%)
 *   clickRate       → clicks / delivered (NULL when delivered=0)
 *   status          → 'finished' when email_campaigns.sent_at IS NOT NULL; 'draft' otherwise
 *
 * V1 approximations (documented):
 *   - Campaigns with no matching email_events (tracked:false) show stored
 *     sent_count for the Sent column and null rates (no fake percentages).
 *   - Broker attribution uses the first 'sent' event's broker slug; campaigns
 *     created before email_events tracking was active show fromBrokerName:null.
 */
export async function getBatchEmailsReport(
  brokerSlug: string | null,
): Promise<BatchEmailsResult> {
  const cached = unstable_cache(
    () => readBatchEmailsReport(brokerSlug),
    ['crm-batch-emails-report-v1', brokerSlug ?? 'all'],
    {
      tags: ['crm-batch-emails', 'crm-reporting', 'crm-email-reporting'],
      revalidate: 600,
    },
  )
  return cached()
}
