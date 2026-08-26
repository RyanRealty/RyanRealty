/**
 * Phone -> Do Not Call / TCPA-litigator scrub.
 *
 * WHY A DEDICATED PATH. The CRM already gets DNC flags, but only as a side
 * effect of an ADDRESS-based skip trace (BatchData /property/skip-trace, via
 * lib/owner-resolution.mjs). That covers a contact the moment we skip-traced
 * their property and nobody afterwards — so of 16,614 contacts with a phone,
 * 3,207 carry a compliance flag and 13,407 carry nothing at all. "Nothing at
 * all" was being read as safe to text. It is not; it is unknown.
 *
 * BatchData exposes a phone-keyed endpoint for exactly this
 * (POST /api/v1/phone/dnc), which costs a fraction of a skip trace and answers
 * the question that matters here: is this NUMBER on the registry.
 *
 * VERIFIED SHAPE, not assumed (probed 2026-08-25 against the live API with one
 * number). Request is `{ requests: ["5415550100"] }` — an array of STRINGS; a
 * `{phone:{number}}` object is rejected with "The requests.0 must be a string."
 * Response is `results.phoneNumbers[]` of
 * `{ number, dnc: boolean, meta: { error, matched, dateRetrieved } }`.
 *
 * TWO ENDPOINTS, NOT ONE. /phone/dnc answers the registry question;
 * /phone/tcpa answers the litigator question (is this a known TCPA plaintiff —
 * the people who actually file the suits). Both are probed live and both are
 * asked, because screening the registry without screening litigators leaves the
 * expensive population unscreened.
 *
 * THEIR `matched` SEMANTICS DIFFER AND THE DIFFERENCE IS LOAD-BEARING.
 * On /phone/dnc every sampled number came back matched:true with `dnc` carrying
 * the answer — so matched:false there means "no answer" and must not be stored.
 * On /phone/tcpa every sampled number came back matched:false with tcpa:false
 * and errorCount:0, which is what a rare-population lookup looks like: the query
 * succeeded and the number simply is not on the litigator list. So for the
 * litigator check the ANSWER is `tcpa`, gated only on meta.error.
 *
 * That reading is not yet proven by a positive. The account has 138 contacts
 * carrying tcpa:litigator, but every one of them also carries
 * compliance:dnc-registry and none is litigator-only — one mapping applied both
 * tags, so those are DNC hits, not confirmed litigator hits. A run at scale
 * settles it: any true is proof the signal works; 9,000 consecutive falses is
 * a reason to ask BatchData whether the product is enabled. The runner prints
 * the match rate so the answer is visible rather than assumed.
 *
 * WHAT A RESULT MEANS. `checked_at` is the point. A row says "asked on this
 * date"; no row says "never asked". Registry status changes — a number can be
 * added the week after we look — so a check has a shelf life and a stale row is
 * stale, not clean. STALE_AFTER_DAYS is the line.
 *
 * This module does the LOOKUP and the mapping. It does not decide policy: the
 * suppression writes live with the caller so the compliance chokepoint stays
 * the one place that blocks a send.
 */

import 'server-only'

/** A check older than this is re-asked rather than trusted. */
export const STALE_AFTER_DAYS = 90

const BATCHDATA_BASE = 'https://api.batchdata.com/api/v1'

/** BatchData bills per number; keep a request from silently becoming enormous. */
export const MAX_PHONES_PER_REQUEST = 100

export type DncScrubResult = {
  /** Normalized last-10. */
  phoneLast10: string
  onDnc: boolean
  isLitigator: boolean
  /** True when the litigator endpoint actually answered for this number. */
  litigatorChecked: boolean
  lineType: string | null
  carrier: string | null
  raw: Record<string, unknown>
}

/** Last 10 digits, or null when the input is not a usable US number. */
export function normalizeLast10(raw: string | null | undefined): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length < 10) return null
  const last10 = digits.slice(-10)
  // A US area code never starts with 0 or 1.
  return /^[2-9]\d{9}$/.test(last10) ? last10 : null
}

/**
 * Map one BatchData phone record onto our result shape. PURE and exported so
 * the field-name guesswork is testable without spending money on a live call —
 * the vendor nests these differently across products, so we read several
 * spellings rather than assume one.
 */
export function mapScrubRecord(rec: Record<string, unknown>): DncScrubResult | null {
  const phoneLast10 = normalizeLast10(rec.number as string | undefined)
  if (!phoneLast10) return null

  // meta.error / meta.matched decide whether the vendor actually ANSWERED.
  // An errored or unmatched number is not a clean number — it is no answer, and
  // recording it as clean is precisely the mistake this module exists to stop.
  const meta = (rec.meta ?? {}) as Record<string, unknown>
  if (meta.error === true) return null
  if (meta.matched === false) return null

  return {
    phoneLast10,
    onDnc: rec.dnc === true,
    // Filled in by the litigator pass — see scrubPhones.
    isLitigator: false,
    litigatorChecked: false,
    lineType: (rec.type as string | undefined) ?? null,
    carrier: (rec.carrier as string | undefined) ?? null,
    raw: rec,
  }
}

/**
 * Map one /phone/tcpa record. Unlike the DNC endpoint, a non-match IS the
 * answer here (the number is not on the litigator list), so only a transport
 * error disqualifies it. PURE.
 */
export function mapLitigatorRecord(
  rec: Record<string, unknown>,
): { phoneLast10: string; isLitigator: boolean } | null {
  const phoneLast10 = normalizeLast10(rec.number as string | undefined)
  if (!phoneLast10) return null
  const meta = (rec.meta ?? {}) as Record<string, unknown>
  if (meta.error === true) return null
  return { phoneLast10, isLitigator: rec.tcpa === true }
}

/**
 * Ask BatchData about a batch of numbers. Returns one result per number the
 * vendor answered for — a number it does not answer for is simply absent, and
 * the caller must NOT record it as clean.
 *
 * Fails LOUD: a credential or transport failure throws rather than returning an
 * empty list, because an empty list is indistinguishable from "everyone is
 * clean" and that is the one mistake this whole module exists to prevent.
 */
export async function scrubPhones(phones: string[]): Promise<DncScrubResult[]> {
  const last10s = [...new Set(phones.map(normalizeLast10).filter((p): p is string => !!p))]
  if (last10s.length === 0) return []
  if (last10s.length > MAX_PHONES_PER_REQUEST) {
    throw new Error(`scrubPhones: ${last10s.length} numbers exceeds the ${MAX_PHONES_PER_REQUEST} per-request cap`)
  }

  const key = process.env.BATCHDATA_API_KEY?.trim()
  if (!key) throw new Error('BATCHDATA_API_KEY missing — cannot scrub, and must not assume clean')

  const ask = async (path: string) => {
    const r = await fetch(`${BATCHDATA_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // Plain strings — see the header. Objects are rejected.
      body: JSON.stringify({ requests: last10s }),
      signal: AbortSignal.timeout(30000),
    })
    if (!r.ok) {
      const body = await r.text().catch(() => '')
      throw new Error(`BatchData ${path} failed ${r.status}: ${body.slice(0, 300)}`)
    }
    return (await r.json()) as Record<string, unknown>
  }

  const [dncJson, tcpaJson] = await Promise.all([ask('/phone/dnc'), ask('/phone/tcpa')])

  const litigators = new Map<string, boolean>()
  for (const rec of extractRecords(tcpaJson)) {
    const m = mapLitigatorRecord(rec)
    if (m) litigators.set(m.phoneLast10, m.isLitigator)
  }

  const results = extractRecords(dncJson)
  return results
    .map(mapScrubRecord)
    .filter((r): r is DncScrubResult => r !== null)
    .map((r) => ({
      ...r,
      isLitigator: litigators.get(r.phoneLast10) === true,
      litigatorChecked: litigators.has(r.phoneLast10),
    }))
}

/**
 * Pull the per-number records out of whatever envelope the vendor wraps them
 * in. Exported for tests: the shape differs between BatchData products and a
 * silent mismatch here would produce zero results, which the caller would then
 * be tempted to treat as "nobody is on the registry".
 */
export function extractRecords(json: Record<string, unknown>): Array<Record<string, unknown>> {
  const results = (json.results ?? {}) as Record<string, unknown>
  const phones = results.phoneNumbers
  return Array.isArray(phones) ? (phones as Array<Record<string, unknown>>) : []
}

/** The compliance tags a result earns, per the locked TCPA mapping. */
export function tagsForResult(r: DncScrubResult): string[] {
  if (r.isLitigator) {
    return ['tcpa:litigator', 'contact:do-not-call', 'contact:do-not-text', 'compliance:hard-stop']
  }
  // compliance:dnc-registry is what the suppression chokepoint reads for
  // call + sms (lib/crm/tag-channel.ts). contact:do-not-call rides along so the
  // state is legible in the UI's existing vocabulary.
  if (r.onDnc) return ['compliance:dnc-registry', 'contact:do-not-call']
  return []
}
