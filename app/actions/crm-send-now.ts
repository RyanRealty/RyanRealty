'use server'

/**
 * One-off "send it to this contact NOW" actions on the person page (Matt
 * directive 2026-07-09: opening a client must let you send them CMAs,
 * newsletters, and market reports — not just manage subscriptions).
 *
 * The newsletter equivalent already lives in app/actions/contact-newsletter.ts
 * (sendNewsletterToContactAction); the CMA equivalent in app/actions/
 * contact-cma.ts. This module adds the market-report one, composed from the
 * same pieces the cadence cron uses: getMarketReportData →
 * renderMarketReportEmail → sendOneSubscriber (suppression fail-closed inside).
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { requireCrmAccess, requirePersonInScope, type CrmActionResult } from '@/app/actions/crm'
import { getMarketReportData } from '@/lib/data/crm/getMarketReportData'
import { buildMarketReportAreas } from '@/lib/data/crm/getContactReportSubscriptions'
import { renderMarketReportEmail } from '@/lib/crm/market-report-email'
import { sendOneSubscriber } from '@/lib/crm/market-report-send'
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe-token'

export async function sendMarketReportNowAction(
  personId: number,
  formData: FormData,
): Promise<CrmActionResult> {
  const access = await requireCrmAccess()
  if (!access.ok) return access
  const pid = Number(personId)
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, error: 'Bad person id' }
  const scoped = await requirePersonInScope(pid, access.access)
  if (!scoped.ok) return scoped

  const rawSlugs = formData.getAll('areas').map((a) => String(a).trim()).filter(Boolean)
  if (rawSlugs.length === 0) return { ok: false, error: 'Pick at least one area first' }

  // Validate + de-dupe against the registry — the same valid-slug set
  // setReportSubscriptionAction's sanitizeAreas uses. A bogus slug (stale UI or
  // typo) would fail closed downstream (getMarketReportData omits it, yielding an
  // empty report), so reject it up front with a clear message rather than
  // silently sending nothing.
  const validSlugs = new Set(buildMarketReportAreas().map((a) => a.slug))
  const seen = new Set<string>()
  const areaSlugs: string[] = []
  const invalidSlugs: string[] = []
  for (const slug of rawSlugs) {
    if (!validSlugs.has(slug)) {
      invalidSlugs.push(slug)
      continue
    }
    if (seen.has(slug)) continue
    seen.add(slug)
    areaSlugs.push(slug)
  }
  if (invalidSlugs.length > 0) {
    return { ok: false, error: `Unknown area${invalidSlugs.length > 1 ? 's' : ''}: ${invalidSlugs.join(', ')}` }
  }
  if (areaSlugs.length === 0) return { ok: false, error: 'Pick at least one area first' }

  const sb = createServiceClient()
  const { data: person } = await sb
    .from('crm_people')
    .select('id,fub_legacy_id,name,first_name,emails,assigned_broker')
    .eq('id', pid)
    .maybeSingle()
  if (!person) return { ok: false, error: 'Person not found' }
  const email = (person.emails as Array<{ value?: string; isPrimary?: number | boolean }>)
    ?.sort((a, b) => Number(!!b.isPrimary) - Number(!!a.isPrimary))[0]?.value
  if (!email) return { ok: false, error: 'No email address on file' }

  const areas = await getMarketReportData(areaSlugs)
  if (areas.length === 0) {
    return { ok: false, error: 'No market data available for the selected areas right now' }
  }

  const brokerSlug = access.access.brokerSlug ?? (person.assigned_broker as string | null) ?? 'matt'
  const contactName = String(person.first_name ?? person.name ?? '').trim() || undefined
  const unsubscribeUrl = buildUnsubscribeUrl(pid)
  const rendered = renderMarketReportEmail({ contactName, brokerSlug, areas, unsubscribeUrl })

  // Suppression runs fail-closed inside sendOneSubscriber, same as the cron.
  const outcome = await sendOneSubscriber({
    personId: pid,
    fubPersonId: (person.fub_legacy_id as number | null) ?? null,
    brokerSlug,
    email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    unsubscribeUrl,
    emailKey: `market-report:manual:${pid}:${Date.now()}`,
  })
  if (outcome.status !== 'sent') {
    return { ok: false, error: `Not sent (${outcome.reason}${'detail' in outcome && outcome.detail ? `: ${outcome.detail}` : ''})` }
  }

  // The cron relies on recordEmailEvent only; a manual send belongs in the
  // conversation thread too.
  await sb.from('crm_timeline').insert({
    person_id: pid, kind: 'email_out', title: rendered.subject,
    body: `Market report sent (${areas.map((a) => a.areaLabel).join(', ')})`,
    payload: { to: email, sendType: 'market-report', areas: areaSlugs, manual: true },
    broker: brokerSlug, source: 'app',
  })
  revalidatePath('/admin/crm')
  revalidatePath(`/admin/crm/${pid}`)
  return { ok: true }
}
