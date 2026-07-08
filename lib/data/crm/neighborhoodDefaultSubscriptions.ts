import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { normalizeSavedSearchFilters, getSavedSearchHash } from '@/lib/search-filters'
import { labelForNeighborhoodSlug } from '@/lib/neighborhood-areas'
import { pickPersonEmail } from '@/lib/crm/bulk-handlers/assign-saved-search'

/**
 * Default neighborhood subscriptions (Matt directive 2026-07-06): every contact
 * on a CRM neighborhood list (crm_people.neighborhood_slug) gets, BY DEFAULT,
 *   1. a saved search for that neighborhood (listing_alerts row with
 *      filters { neighborhoodSlug }, weekly cadence, origin='system') — drained
 *      by the same alert cron as every other saved search, tracked via
 *      crm_person_id, suppression-gated at send time.
 *   2. a market-report subscription for that neighborhood's area slug
 *      (crm_report_subscriptions, monthly) — only when the contact has NO
 *      subscription row yet, so a broker-configured or opted-out subscription
 *      is never overwritten.
 *
 * INSERT-ONLY, both tables. An alert row that already exists for
 * (email, filters_hash) is left alone even when is_active=false — a homeowner
 * who unsubscribed must never be re-activated by the next provisioning run.
 * The engine is idempotent and bounded per run (the cron re-runs daily and
 * converges; new contacts entering a list are picked up automatically).
 *
 * DAL boundary (G1): all raw .from() reads/writes for this feature live here.
 */

export type NeighborhoodProvisionSummary = {
  neighborhoods: number
  contactsScanned: number
  alertsCreated: number
  reportsCreated: number
  skippedNoEmail: number
  /** True when every neighborhood was fully processed within budget. */
  complete: boolean
  errors: string[]
}

type PersonRow = {
  id: number
  fub_legacy_id: number | null
  emails: Array<{ value?: string; isPrimary?: number | boolean }> | null
  neighborhood_slug: string
}

const PAGE = 1000

/** Filters stored on every default neighborhood saved search. */
export function neighborhoodDefaultFilters(slug: string): Record<string, unknown> {
  return normalizeSavedSearchFilters({ neighborhoodSlug: slug })
}

async function fetchDistinctNeighborhoodSlugs(
  sb: ReturnType<typeof createServiceClient>,
): Promise<string[]> {
  const slugs = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('crm_people')
      .select('neighborhood_slug')
      .eq('deleted', false)
      .not('neighborhood_slug', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`[neighborhoodDefaults] slugs: ${error.message}`)
    for (const r of (data ?? []) as Array<{ neighborhood_slug: string | null }>) {
      const s = (r.neighborhood_slug ?? '').trim()
      if (s) slugs.add(s)
    }
    if (!data || data.length < PAGE) break
  }
  return [...slugs].sort()
}

async function fetchContactsForSlug(
  sb: ReturnType<typeof createServiceClient>,
  slug: string,
): Promise<PersonRow[]> {
  const rows: PersonRow[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('crm_people')
      .select('id, fub_legacy_id, emails, neighborhood_slug')
      .eq('deleted', false)
      .eq('neighborhood_slug', slug)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`[neighborhoodDefaults] contacts(${slug}): ${error.message}`)
    rows.push(...((data ?? []) as PersonRow[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

/** Emails that already have an alert row for this filters_hash — ANY is_active state. */
async function fetchExistingAlertEmails(
  sb: ReturnType<typeof createServiceClient>,
  filtersHash: string,
): Promise<Set<string>> {
  const emails = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('listing_alerts')
      .select('email')
      .eq('filters_hash', filtersHash)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`[neighborhoodDefaults] existing alerts: ${error.message}`)
    for (const r of (data ?? []) as Array<{ email: string }>) emails.add(r.email.toLowerCase())
    if (!data || data.length < PAGE) break
  }
  return emails
}

/** person_ids among `ids` that already have a crm_report_subscriptions row (any state). */
async function fetchExistingReportPersonIds(
  sb: ReturnType<typeof createServiceClient>,
  ids: number[],
): Promise<Set<number>> {
  const existing = new Set<number>()
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500)
    const { data, error } = await sb
      .from('crm_report_subscriptions')
      .select('person_id')
      .in('person_id', chunk)
    if (error) throw new Error(`[neighborhoodDefaults] existing reports: ${error.message}`)
    for (const r of (data ?? []) as Array<{ person_id: number }>) existing.add(r.person_id)
  }
  return existing
}

/**
 * Provision default subscriptions for up to `maxEnrollments` missing
 * contact-subscriptions in one run (an enrollment = one alert insert or one
 * report-subscription insert). Bounded so the cron never times out; re-runs
 * converge to full coverage.
 */
export async function provisionNeighborhoodDefaultSubscriptions(options?: {
  maxEnrollments?: number
  dryRun?: boolean
}): Promise<NeighborhoodProvisionSummary> {
  const maxEnrollments = Math.min(20000, Math.max(1, options?.maxEnrollments ?? 3000))
  const dryRun = options?.dryRun === true
  const sb = createServiceClient()
  const nowIso = new Date().toISOString()

  const summary: NeighborhoodProvisionSummary = {
    neighborhoods: 0,
    contactsScanned: 0,
    alertsCreated: 0,
    reportsCreated: 0,
    skippedNoEmail: 0,
    complete: true,
    errors: [],
  }

  let budget = maxEnrollments
  const slugs = await fetchDistinctNeighborhoodSlugs(sb)
  summary.neighborhoods = slugs.length

  for (const slug of slugs) {
    if (budget <= 0) {
      summary.complete = false
      break
    }
    try {
      const label = labelForNeighborhoodSlug(slug)
      const filters = neighborhoodDefaultFilters(slug)
      const filtersHash = getSavedSearchHash(filters)
      const alertName = `${label} new listings`

      const [contacts, existingAlertEmails] = await Promise.all([
        fetchContactsForSlug(sb, slug),
        fetchExistingAlertEmails(sb, filtersHash),
      ])
      summary.contactsScanned += contacts.length

      const withEmail: Array<PersonRow & { email: string }> = []
      for (const person of contacts) {
        const email = pickPersonEmail(person.emails)
        if (!email) {
          summary.skippedNoEmail += 1
          continue
        }
        withEmail.push({ ...person, email })
      }

      const existingReportIds = await fetchExistingReportPersonIds(
        sb,
        withEmail.map((p) => p.id),
      )

      // Build the missing sets — alerts dedupe by email (two contacts sharing
      // an inbox get ONE alert row; the first keeps the crm_person_id link).
      const alertRows: Array<Record<string, unknown>> = []
      const alertPersonIds: number[] = []
      const seenEmails = new Set<string>()
      const reportRows: Array<Record<string, unknown>> = []
      const reportPersonIds: number[] = []

      let ranOutMidNeighborhood = false
      for (const person of withEmail) {
        const needsAlert = !existingAlertEmails.has(person.email) && !seenEmails.has(person.email)
        const needsReport = !existingReportIds.has(person.id)
        if ((needsAlert || needsReport) && budget <= 0) {
          ranOutMidNeighborhood = true
          break
        }
        if (needsAlert) {
          seenEmails.add(person.email)
          alertRows.push({
            email: person.email,
            filters,
            filters_hash: filtersHash,
            name: alertName,
            crm_person_id: person.id,
            fub_person_id: person.fub_legacy_id ?? null,
            origin: 'system',
            source: 'neighborhood-default',
            notification_frequency: 'weekly',
            is_active: true,
            // Soft launch: stamp the enrollment time so the FIRST email fires
            // at the next weekly tick with only listings that are NEW since
            // enrollment — never a mass blast of current inventory on day one.
            last_notified_at: nowIso,
            updated_at: nowIso,
          })
          alertPersonIds.push(person.id)
          budget -= 1
        }
        if (needsReport) {
          reportRows.push({
            person_id: person.id,
            areas: [slug],
            frequency: 'monthly',
            is_active: true,
            updated_at: nowIso,
          })
          reportPersonIds.push(person.id)
          budget -= 1
        }
      }

      // Budget exhausted mid-neighborhood → a later run finishes it.
      if (ranOutMidNeighborhood) summary.complete = false

      if (dryRun) {
        summary.alertsCreated += alertRows.length
        summary.reportsCreated += reportRows.length
        continue
      }

      for (let i = 0; i < alertRows.length; i += 500) {
        const chunk = alertRows.slice(i, i + 500)
        // ignoreDuplicates: INSERT ... ON CONFLICT DO NOTHING — never touches
        // (and never re-activates) a row the homeowner already owns.
        const { error } = await sb
          .from('listing_alerts')
          .upsert(chunk, { onConflict: 'email,filters_hash', ignoreDuplicates: true })
        if (error) throw new Error(`[neighborhoodDefaults] alert insert(${slug}): ${error.message}`)
      }
      summary.alertsCreated += alertRows.length

      for (let i = 0; i < reportRows.length; i += 500) {
        const chunk = reportRows.slice(i, i + 500)
        const { error } = await sb
          .from('crm_report_subscriptions')
          .upsert(chunk, { onConflict: 'person_id', ignoreDuplicates: true })
        if (error) throw new Error(`[neighborhoodDefaults] report insert(${slug}): ${error.message}`)
      }
      summary.reportsCreated += reportRows.length

      const timelineRows = [
        ...alertPersonIds.map((id) => ({
          person_id: id,
          kind: 'system',
          title: `Saved search "${alertName}" added (weekly, neighborhood default)`,
          source: 'app',
        })),
        ...reportPersonIds.map((id) => ({
          person_id: id,
          kind: 'system',
          title: `Market reports set to monthly for ${label} (neighborhood default)`,
          source: 'app',
        })),
      ]
      for (let i = 0; i < timelineRows.length; i += 500) {
        const { error } = await sb.from('crm_timeline').insert(timelineRows.slice(i, i + 500))
        if (error) {
          // Timeline is best-effort audit trail — log, keep provisioning.
          console.error('[neighborhoodDefaults] timeline insert', error.message)
          break
        }
      }
    } catch (err) {
      summary.errors.push(err instanceof Error ? err.message : String(err))
      summary.complete = false
    }
  }

  return summary
}
