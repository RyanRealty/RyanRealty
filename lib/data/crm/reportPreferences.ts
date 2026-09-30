/**
 * reportPreferences — the READ side of the no-login market-report preferences
 * page and its stored-report web view (Matt's decisions 2026-09-29).
 *
 * A signed link (lib/email/report-link-token.ts) names the contact, the
 * subscription and the report it came from. This module resolves a link to
 * that contact and subscription, and builds what the page shows: her areas
 * (labels from the live registry), the interval, on / paused / stopped,
 * whether all Ryan Realty email is off (and whether she can turn it back on
 * herself), and her past reports, each with its own signed web-view link.
 *
 * A BROKER PREVIEW never reaches the contact's live links (review
 * 2026-09-30): a preview page signs every report link it lists as a preview,
 * and a stored copy opened from a preview link has every link inside it
 * re-signed as a preview (previewReportLinks), so nothing a broker clicks
 * there acts as her.
 *
 * The writes (pause, stop, stop all email, and so on) are
 * lib/crm/market-report-preferences.ts, which resolves links through here.
 *
 * DAL boundary (G1): reads go through the lib/data modules named below.
 */
import 'server-only'

import {
  previewReportLinks,
  reportViewUrl,
  verifyReportLinkToken,
  type ReportLinkPayload,
  type ReportLinkPurpose,
} from '@/lib/email/report-link-token'
import { MissingSigningSecretError } from '@/lib/email/signing-secret'
import {
  getReportSubscriptionRecord,
  resolveReportLinkContact,
  type MarketReportContact,
  type ReportSubscriptionRecord,
} from '@/lib/data/crm/marketReportSubscription'
import { getMarketReportSendByEmailKey, listMarketReportSendsForPerson } from '@/lib/data/crm/marketReportSends'
import { getSuppressionSignals, type SuppressionSignal } from '@/lib/data/crm/getSuppressionSignals'
import { canUserResubscribe, getEmailKeyedSuppressionSignals } from '@/lib/data/newsletter/perLead'
import {
  isContactStopped,
  reportSubscriptionState,
  type ReportSubscriptionState,
} from '@/lib/crm/market-report-subscription-control'
import { reportAreaLabel, reportAreaOptions } from '@/lib/crm/market-report-areas'
import { nextReportSendAt } from '@/lib/crm/market-report-cadence'
import { formatDate } from '@/lib/format/date'
import type { ReportFrequency } from '@/lib/data/crm/getContactReportSubscriptions'

/** Why a link did not open: bad or tampered, names nothing we have, or we could not check it. */
export type PreferencesFailure = 'invalid' | 'not-found' | 'unavailable'

export type ResolvedReportLink = {
  token: ReportLinkPayload
  contact: MarketReportContact
  subscription: ReportSubscriptionRecord | null
}

/**
 * Verify a link for one purpose and load its contact and subscription. A link
 * does one job: a web-view link cannot open the preferences page, and only the
 * one-click link reaches the one-click stop.
 *
 * `contact` is the contact the link acts on (resolveReportLinkContact): the
 * link's own contact, or, when it was merged into another, the survivor whose
 * subscription and reports the merge carried over. When that chain ends at a
 * DELETED contact the link still resolves, with `contact.deleted` true: she
 * can still stop her reports and all email (lib/crm/market-report-preferences
 * allows nothing else on a deleted record). Every read and write acts on
 * that contact.
 */
export async function resolveReportLink(
  tokenStr: string | null | undefined,
  purpose: Exclude<ReportLinkPurpose, 'view'>,
): Promise<{ ok: true; link: ResolvedReportLink } | { ok: false; reason: PreferencesFailure }> {
  let token: ReportLinkPayload | null
  try {
    token = verifyReportLinkToken(tokenStr)
  } catch (e) {
    if (e instanceof MissingSigningSecretError) return { ok: false, reason: 'unavailable' }
    throw e
  }
  if (!token || token.purpose !== purpose) return { ok: false, reason: 'invalid' }
  try {
    const contact = await resolveReportLinkContact(token.personId)
    if (!contact) return { ok: false, reason: 'not-found' }
    let subscription: ReportSubscriptionRecord | null = null
    if (token.subscriptionId > 0) {
      subscription = await getReportSubscriptionRecord({ id: token.subscriptionId })
      // The row must belong to this contact (after a merge it moved to the
      // survivor, so it is hers either way). Anyone else's row is a bad link.
      if (subscription && subscription.personId !== contact.personId && subscription.personId !== token.personId) {
        return { ok: false, reason: 'not-found' }
      }
      if (subscription && subscription.personId !== contact.personId) subscription = null
    }
    // A report sent without a subscription, or one whose row was replaced (or
    // dropped in a merge because the survivor had her own): the contact's
    // current row, if any, is the one her choices apply to.
    if (!subscription) subscription = await getReportSubscriptionRecord({ personId: contact.personId })
    return { ok: true, link: { token, contact, subscription } }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

/** Every suppression signal on her record and her address, and whether email is off. */
export async function readEmailSignals(
  contact: MarketReportContact,
): Promise<{ all: SuppressionSignal[]; off: boolean }> {
  const [personSignals, emailKeyed] = await Promise.all([
    getSuppressionSignals(contact.personId),
    contact.primaryEmail ? getEmailKeyedSuppressionSignals(contact.primaryEmail) : Promise.resolve([]),
  ])
  const all = [...personSignals, ...emailKeyed]
  return { all, off: all.some((s) => s.channel === 'email' || s.channel === 'all') }
}

export type ReportArchiveEntry = {
  emailKey: string
  sentAt: string
  dateLabel: string
  subject: string | null
  viewUrl: string
}

export type ReportPreferencesView = {
  preview: boolean
  /**
   * The contact record behind the link was deleted. The page offers only the
   * ways to stop email (these reports, or all of it); nothing is scheduled.
   */
  closed: boolean
  /** 'none' when the report went out without a subscription (a one-off send). */
  state: ReportSubscriptionState | 'none'
  /**
   * The report is stopped because SHE stopped it (one-click, this page, her
   * account page). False while it is on, paused, or stopped by a broker: her
   * own stop is still offered then, and it replaces the broker's.
   */
  stoppedByContact: boolean
  frequency: ReportFrequency | null
  areas: Array<{ slug: string; label: string }>
  /** Areas she can add (the registry minus the ones she has). */
  addable: Array<{ slug: string; label: string }>
  /** The subscription has never sent and waits on a broker's first-send approval. */
  awaitingFirstReport: boolean
  /**
   * "October 28, 2026": the earliest day the next report can go out (the
   * cadence from the last send, then the first 8am to 8pm Pacific cron run),
   * or null when nothing is scheduled (off, or waiting on the approval).
   */
  nextSendLabel: string | null
  /** All email from Ryan Realty is off for her. */
  emailOff: boolean
  /** She can turn it back on herself (only her own soft unsubscribe is in the way). */
  emailRestartable: boolean
  /** Her past reports, newest first. */
  reports: ReportArchiveEntry[]
}

/** What the preferences page shows for a manage link. */
export async function readReportPreferences(
  tokenStr: string | null | undefined,
  now: Date = new Date(),
): Promise<{ ok: true; view: ReportPreferencesView; token: ReportLinkPayload } | { ok: false; reason: PreferencesFailure }> {
  const res = await resolveReportLink(tokenStr, 'manage')
  if (!res.ok) return res
  const { token, contact, subscription } = res.link
  try {
    const [{ all, off }, sends] = await Promise.all([
      readEmailSignals(contact),
      listMarketReportSendsForPerson(contact.personId, {
        kinds: token.preview ? ['scheduled', 'manual', 'preview'] : ['scheduled', 'manual'],
        statuses: ['sent'],
        limit: 24,
      }),
    ])
    const chosen = new Set(subscription?.areas ?? [])
    const next = subscription && !contact.deleted
      ? nextReportSendAt({
          isActive: subscription.isActive,
          approved: Boolean(subscription.firstSendApprovedAt),
          frequency: subscription.frequency,
          lastSentAt: subscription.lastSentAt,
          now,
        })
      : null
    const reports: ReportArchiveEntry[] = []
    for (const s of sends) {
      if (!s.sentAt) continue
      reports.push({
        emailKey: s.emailKey,
        sentAt: s.sentAt,
        dateLabel: formatDate(s.sentAt, { month: 'long' }),
        subject: s.subject,
        // A preview page never hands out a real link: every copy it lists
        // opens as a preview, with every link inside re-signed as one.
        viewUrl: reportViewUrl({
          personId: contact.personId,
          subscriptionId: subscription?.id ?? null,
          emailKey: s.emailKey,
          preview: token.preview || s.kind === 'preview',
        }),
      })
    }
    return {
      ok: true,
      token,
      view: {
        preview: token.preview,
        closed: contact.deleted,
        state: subscription ? reportSubscriptionState(subscription) : 'none',
        stoppedByContact: Boolean(subscription && isContactStopped(subscription)),
        frequency: subscription?.frequency ?? null,
        areas: (subscription?.areas ?? []).map((slug) => ({ slug, label: reportAreaLabel(slug) })),
        addable: reportAreaOptions().filter((a) => !chosen.has(a.slug)),
        awaitingFirstReport: Boolean(
          subscription && !contact.deleted && !subscription.lastSentAt && !subscription.firstSendApprovedAt,
        ),
        nextSendLabel: next ? formatDate(next, { month: 'long' }) : null,
        emailOff: off,
        emailRestartable: off && canUserResubscribe(all, null).allowed,
        reports,
      },
    }
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
}

/**
 * The stored report a web-view link names, when it belongs to the link's
 * contact and actually went out. The html is the clean copy (no open pixel,
 * no click wraps), so reading it never counts as an open.
 *
 * Her own (real) link opens her real report as it was sent. A PREVIEW link
 * (a broker's) opens a preview copy, or her real report with every report
 * link inside it re-signed as a preview (previewReportLinks): the broker sees
 * what she saw, and nothing clicked there acts as her. A real link never opens
 * a broker's preview copy.
 */
export async function readReportForView(
  tokenStr: string | null | undefined,
): Promise<{ ok: true; html: string } | { ok: false; reason: PreferencesFailure }> {
  let token: ReportLinkPayload | null
  try {
    token = verifyReportLinkToken(tokenStr)
  } catch (e) {
    if (e instanceof MissingSigningSecretError) return { ok: false, reason: 'unavailable' }
    throw e
  }
  if (!token || token.purpose !== 'view' || !token.emailKey) return { ok: false, reason: 'invalid' }
  const send = await getMarketReportSendByEmailKey(token.emailKey)
  if (!send || send.status !== 'sent' || !send.html) return { ok: false, reason: 'not-found' }
  // A broker's preview copy opens only from a preview link.
  if (send.kind === 'preview' && !token.preview) return { ok: false, reason: 'not-found' }
  if (send.personId !== token.personId) {
    // A contact merge moves her reports onto the survivor. The link still
    // opens her copy when the link's contact was merged into the one that
    // now holds it; any other mismatch is a bad link.
    let reached: Awaited<ReturnType<typeof resolveReportLinkContact>>
    try {
      reached = await resolveReportLinkContact(token.personId)
    } catch {
      return { ok: false, reason: 'unavailable' }
    }
    if (!reached || reached.personId !== send.personId) return { ok: false, reason: 'not-found' }
  }
  if (!token.preview) return { ok: true, html: send.html }
  try {
    return { ok: true, html: previewReportLinks(send.html) }
  } catch (e) {
    if (e instanceof MissingSigningSecretError) return { ok: false, reason: 'unavailable' }
    throw e
  }
}
