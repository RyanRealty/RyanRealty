import 'server-only'

/**
 * mobile-data — server-side assembly helpers for the §26/§27 mobile inbox.
 * Split out of the inbox page (file-size budget): pure mappers from the DAL
 * shapes to the client-component props. No actions, no JSX.
 */

import { sanitizeHtml } from '@/lib/sanitize'
import { formatDateTime } from '@/lib/format/date'
import { cleanContactName } from '@/lib/crm/display-name'
import { CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import { inboxHref, mobileTimeLabel } from '@/components/admin/crm/inbox/inbox-url'
import type { InboxConversation, InboxFolderKey, InboxScopeKey } from '@/lib/data/crm/getInboxQueue'
import type { InboxThreadItemData } from '@/lib/data/crm/getInboxThread'
import type { CrmTemplateAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import type { MobileConvRow } from './MobileInboxRow'
import type { MobileThreadItem } from './MobileThread'
import type { ComposeTemplate } from './MobileComposeSheet'

/** Normalized 800×1200 broker headshots (design system §team) by CRM slug. */
export const BROKER_HEADSHOTS: Record<string, string> = {
  matt: '/images/brokers/ryan-matt.png',
  rebecca: '/images/brokers/peterson-rebecca.png',
  paul: '/images/brokers/stevenson-paul.png',
}

function looksLikeHtml(body: string): boolean {
  return /<([a-z][a-z0-9]*)\b[^>]*>/i.test(body)
}

/** §26-A row models — precomputed labels so the client stays hydration-safe. */
export function buildMobileRows(
  conversations: InboxConversation[],
  scopeKey: InboxScopeKey,
  folder: InboxFolderKey,
  view: 'all' | 'unread',
  nowMs: number,
): MobileConvRow[] {
  return conversations.map((c) => ({
    personId: c.personId,
    name: cleanContactName(c.name, c.personId),
    pictureUrl: c.pictureUrl,
    unread: c.status === 'unread',
    status: c.status,
    messageCount: c.messageCount,
    tsLabel: mobileTimeLabel(c.lastMessageAt, nowMs),
    lastChannel: c.lastChannel,
    channels: c.channels,
    subject: c.lastChannel === 'email' ? c.lastEmailSubject : null,
    snippet: c.snippet,
    outboundLast: c.lastDirection === 'out',
    href: `${inboxHref({ scope: scopeKey, folder, view })}&c=${c.personId}`,
  }))
}

/**
 * §26 thread items — email HTML sanitized SERVER-side before it crosses to the
 * client component (same lib/sanitize path as the desktop reading pane).
 */
export function buildMobileThreadItems(thread: InboxThreadItemData[]): MobileThreadItem[] {
  return thread.map((it) => ({
    id: it.id,
    category: (['message', 'email', 'call', 'note'].includes(it.category)
      ? it.category
      : 'other') as MobileThreadItem['category'],
    direction: it.direction,
    kind: it.kind,
    ts: it.ts,
    tsLabel: formatDateTime(it.ts),
    snippet: it.snippet,
    body: it.category === 'email' ? null : it.fullBody ?? it.snippet,
    subject: it.subject,
    safeHtml:
      it.category === 'email' && it.fullBody && looksLikeHtml(it.fullBody)
        ? sanitizeHtml(it.fullBody)
        : null,
    broker: it.broker ? CRM_BROKER_DISPLAY[it.broker as CrmBrokerSlug] ?? it.broker : null,
    recordingSid: it.recordingSid,
    recordingDurationSec: it.recordingDurationSec,
    contentHidden: it.contentHidden,
  }))
}

/** Email detail (26-E) vs SMS bubbles (26-I) — keyed on the newest message. */
export function pickMobileMode(thread: InboxThreadItemData[], hasPhone: boolean): 'email' | 'sms' {
  const newest = thread.find((it) => it.category === 'message' || it.category === 'email')
  if (newest?.category === 'email') return 'email'
  if (newest?.category === 'message') return 'sms'
  return hasPhone ? 'sms' : 'email'
}

/** Active + visible-to-this-broker templates, split by channel (§27 pickers). */
export function splitComposeTemplates(
  all: CrmTemplateAdmin[],
  actingSlug: string,
): { emailTemplates: ComposeTemplate[]; smsTemplates: ComposeTemplate[] } {
  const usable = all.filter(
    (t) => t.isActive && (t.isShared || !t.ownerBroker || t.ownerBroker === actingSlug),
  )
  return {
    emailTemplates: usable
      .filter((t) => t.channel === 'email')
      .map((t) => ({ key: t.key, name: t.name, subject: t.subject, body: t.body })),
    smsTemplates: usable
      .filter((t) => t.channel === 'sms')
      .map((t) => ({ key: t.key, name: t.name, subject: null, body: t.body })),
  }
}
