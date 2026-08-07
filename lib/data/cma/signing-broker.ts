import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * resolveSigningBrokerForPerson — THE resolver for who signs a lead-driven
 * valuation document (CMA delivery email, CMA request record).
 *
 * Locked directive (Matt, P3 process lock 2026-08-04; restated 2026-08-06):
 * "The CMA is always signed by the Lead's Assigned Broker. Matt is a fallback."
 *
 * Resolution:
 *   1. crm_people.assigned_broker holds the SHORT crm slug ('matt' | 'rebecca'
 *      | 'paul'; verified live 2026-08-06: 18,179 / 124 / 71 rows, 4,598 null).
 *   2. brokers.crm_slug (migration 20260625171000) is the column that carries
 *      the same short slug — brokers.slug is the FULL web slug
 *      ('matthew-ryan', 'rebecca-peterson', 'paul-stevenson') and NEVER
 *      matches assigned_broker directly. Matching on slug is the bug class
 *      that made every document sign as Matt.
 *   3. No assignment, unknown person, or no matching active broker → the env
 *      default (CMA_DEFAULT_BROKER_SLUG, 'matthew-ryan') by brokers.slug.
 *
 * Phone: returns twilio_number, never brokers.phone — for Paul and Rebecca
 * `phone` holds their personal cell (see getCmaBrokerBySlugOrEmail and
 * ci:broker-published-phone). This resolver is what put non-Matt brokers on
 * client-facing documents for the first time, so the publishable-line rule is
 * load-bearing here, not cosmetic.
 *
 * DAL boundary (G1): the raw .from() reads live here, inside lib/data/.
 * Uses the service client — crm_people is not anon-readable.
 */

export type SigningBroker = {
  /** Full web slug (brokers.slug) — what cmas/cma_deliveries rows store. */
  slug: string
  /** Short CRM slug (brokers.crm_slug: matt/rebecca/paul) — what GA4 and
   *  crm_people.assigned_broker use. Do not mix the two spaces. */
  crmSlug: string | null
  displayName: string | null
  email: string | null
  /** Publishable line (brokers.twilio_number, E.164) — never the personal
   *  cell. Format with formatPublishedPhone() before rendering. */
  phone: string | null
  /** INTERNAL ONLY (brokers.phone): the line we reach the BROKER on —
   *  Paul's and Rebecca's personal cells. Never render on anything a
   *  client sees; exists for broker-notify columns like
   *  cma_deliveries.broker_imessage_to. */
  notifyPhone: string | null
  /** 'assigned' when the lead's broker resolved; 'fallback' otherwise. */
  source: 'assigned' | 'fallback'
}

const BROKER_COLS = 'slug, crm_slug, display_name, email, twilio_number, phone'

type BrokerRow = {
  slug: string | null
  crm_slug: string | null
  display_name: string | null
  email: string | null
  twilio_number: string | null
  phone: string | null
}

/** Minimal query surface so tests can inject a stub client. */
export type SigningBrokerDb = {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        val: unknown
      ): {
        eq(col: string, val: unknown): { limit(n: number): PromiseLike<{ data: unknown }> }
        limit(n: number): PromiseLike<{ data: unknown }>
      }
    }
  }
}

function toSigningBroker(row: BrokerRow, source: SigningBroker['source']): SigningBroker {
  return {
    slug: row.slug ?? '',
    crmSlug: row.crm_slug,
    displayName: row.display_name,
    email: row.email,
    phone: row.twilio_number,
    notifyPhone: row.phone,
    source,
  }
}

export async function resolveSigningBrokerForPerson(
  personId: number | null,
  db?: SigningBrokerDb
): Promise<SigningBroker> {
  const sb = (db ?? createServiceClient()) as SigningBrokerDb
  const defaultSlug = (process.env.CMA_DEFAULT_BROKER_SLUG ?? 'matthew-ryan').trim().toLowerCase()

  // 1. The lead's assigned broker signs.
  if (personId != null && Number.isFinite(personId)) {
    const { data: people } = await sb
      .from('crm_people')
      .select('assigned_broker')
      .eq('id', personId)
      .limit(1)
    const assigned = ((people as Array<{ assigned_broker: string | null }> | null)?.[0]
      ?.assigned_broker ?? '')
      .trim()
      .toLowerCase()
    if (assigned) {
      // crm_slug, NOT slug — assigned_broker is the short slug.
      const { data } = await sb
        .from('brokers')
        .select(BROKER_COLS)
        .eq('crm_slug', assigned)
        .eq('is_active', true)
        .limit(1)
      const row = (data as BrokerRow[] | null)?.[0]
      if (row?.slug) return toSigningBroker(row, 'assigned')
    }
  }

  // 2. Fallback: the env default (Matt), by full web slug.
  const { data: defaults } = await sb
    .from('brokers')
    .select(BROKER_COLS)
    .eq('slug', defaultSlug)
    .eq('is_active', true)
    .limit(1)
  const def = (defaults as BrokerRow[] | null)?.[0]
  if (def?.slug) return toSigningBroker(def, 'fallback')

  // 3. Last resort when the brokers row itself is missing/disabled. Claim
  //    Matt's identity only when the default actually IS Matt — a custom
  //    CMA_DEFAULT_BROKER_SLUG with a broken row must not sign one broker's
  //    slug with another broker's name.
  const isMatt = defaultSlug === 'matthew-ryan'
  return {
    slug: defaultSlug,
    crmSlug: isMatt ? 'matt' : null,
    displayName: isMatt ? 'Matt Ryan' : null,
    email: isMatt ? 'matt@ryan-realty.com' : null,
    phone: null,
    notifyPhone: null,
    source: 'fallback',
  }
}
