import 'server-only'
import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { resolveDateRange, type DatePreset } from '@/lib/data/crm/getAgentActivityReport'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MarketingUtmRow = {
  /** utm_source value (the "Platform" column) */
  platform: string
  /** Sessions carrying this utm_source in the period */
  sessions: number
  /** Distinct identified CRM contacts among those sessions */
  leads: number
  /** Appointments logged for those contacts (any date, contact-attributed) */
  appointments: number
  /** Closed-stage deals for those contacts */
  dealsClosed: number
  /** SUM(value) of those closed deals */
  dealValue: number
}

export type MarketingUtmResult = {
  rows: MarketingUtmRow[]
  totalSessions: number
  dateStart: string
  dateEnd: string
}

const PAGE = 1000
const MAX_ROWS = 20000

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ── Core reader ───────────────────────────────────────────────────────────────

async function readMarketingUtm(datePreset: DatePreset | 'custom'): Promise<MarketingUtmResult> {
  const sb = createServiceClient()
  const { start, end } = resolveDateRange(datePreset)

  // 1. Page through visitor sessions that carry a utm_source in the window.
  //    (Paged — never rows.length-capped silently.)
  type SessRow = { utm_source: string | null; crm_person_id: number | null }
  const sessions: SessRow[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await sb
      .from('visitor_sessions')
      .select('utm_source,crm_person_id')
      .not('utm_source', 'is', null)
      .gte('first_seen_at', start)
      .lte('first_seen_at', end)
      .order('first_seen_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) {
      console.error('[getMarketingUtmReport] sessions error', error.message)
      break
    }
    sessions.push(...((data ?? []) as SessRow[]))
    if (!data || data.length < PAGE) break
  }

  // 2. Group by utm_source
  const bySource = new Map<string, { sessions: number; people: Set<number> }>()
  for (const s of sessions) {
    const key = (s.utm_source ?? '').trim()
    if (!key) continue
    if (!bySource.has(key)) bySource.set(key, { sessions: 0, people: new Set() })
    const agg = bySource.get(key)!
    agg.sessions += 1
    if (s.crm_person_id != null) agg.people.add(Number(s.crm_person_id))
  }

  // 3. Contact-attributed outcomes: appointments + closed deals per person set.
  const allPersonIds = Array.from(
    new Set(
      sessions
        .map((s) => (s.crm_person_id != null ? Number(s.crm_person_id) : null))
        .filter((v): v is number => v != null),
    ),
  )

  const apptsByPerson = new Map<number, number>()
  const dealsByPerson = new Map<number, { count: number; value: number }>()

  if (allPersonIds.length > 0) {
    // Closed-stage names
    const { data: stageRows } = await sb
      .from('crm_deal_stages')
      .select('name')
      .eq('is_closed_stage', true)
    const closedStages = ((stageRows ?? []) as Array<{ name: string }>).map((s) => s.name)

    for (const ids of chunk(allPersonIds, 200)) {
      const [apptsRes, dealsRes] = await Promise.all([
        sb.from('crm_appointments').select('person_id').in('person_id', ids),
        closedStages.length > 0
          ? sb
              .from('crm_deals')
              .select('person_id,value')
              .in('person_id', ids)
              .in('stage', closedStages)
          : Promise.resolve({ data: [] as Array<{ person_id: number | null; value: number | null }> }),
      ])
      for (const a of ((apptsRes.data ?? []) as Array<{ person_id: number | null }>)) {
        if (a.person_id == null) continue
        apptsByPerson.set(Number(a.person_id), (apptsByPerson.get(Number(a.person_id)) ?? 0) + 1)
      }
      for (const d of ((dealsRes.data ?? []) as Array<{ person_id: number | null; value: number | null }>)) {
        if (d.person_id == null) continue
        const pid = Number(d.person_id)
        const agg = dealsByPerson.get(pid) ?? { count: 0, value: 0 }
        agg.count += 1
        agg.value += Number(d.value ?? 0)
        dealsByPerson.set(pid, agg)
      }
    }
  }

  // 4. Assemble rows, sorted by sessions desc
  const rows: MarketingUtmRow[] = Array.from(bySource.entries())
    .map(([platform, agg]) => {
      let appointments = 0
      let dealsClosed = 0
      let dealValue = 0
      for (const pid of agg.people) {
        appointments += apptsByPerson.get(pid) ?? 0
        const d = dealsByPerson.get(pid)
        if (d) {
          dealsClosed += d.count
          dealValue += d.value
        }
      }
      return {
        platform,
        sessions: agg.sessions,
        leads: agg.people.size,
        appointments,
        dealsClosed,
        dealValue,
      }
    })
    .sort((a, b) => b.sessions - a.sessions || a.platform.localeCompare(b.platform))

  return {
    rows,
    totalSessions: sessions.length,
    dateStart: start,
    dateEnd: end,
  }
}

// ── Cached public API ─────────────────────────────────────────────────────────

/**
 * Marketing (UTM) report — §11.15. Groups visitor_sessions by utm_source over
 * the selected window; Leads = distinct identified CRM contacts among those
 * sessions; Appointments / Deals Closed / Deal Value are contact-attributed
 * outcomes for those people (crm_appointments; crm_deals in a closed stage).
 * Cached 10 minutes (FUB reporting TTL).
 */
export async function getMarketingUtmReport(
  datePreset: DatePreset | 'custom',
): Promise<MarketingUtmResult> {
  const cached = unstable_cache(
    () => readMarketingUtm(datePreset),
    ['crm-marketing-utm-v1', datePreset],
    { tags: ['crm-marketing-utm', 'crm-reporting'], revalidate: 600 },
  )
  return cached()
}
