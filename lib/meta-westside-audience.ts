/**
 * lib/meta-westside-audience.ts -- "RR Westside Bend Homeowners" Meta Custom
 * Audience refresh (audience id 120244510092910698).
 *
 * Ported from scripts/meta-refresh-westside-audience.mjs (the 2026-07-09
 * 7-key rewrite) so the weekly cron (app/api/cron/meta-westside-audience) and
 * the manual CLI share ONE implementation instead of drifting.
 *
 * Pipeline:
 *   1. loadWestsideInputs -- westside_parcels (paginated PostgREST, service
 *      key) + the linked crm_people rows and their channel='all'
 *      crm_suppressions (TCPA hard-stop, litigator, DNC), chunked.
 *   2. buildWestsidePayload (PURE, unit-tested) -- exclusion logic (suppressed,
 *      realtor/industry-tagged, missing owner name) + the Meta 7-key hashed
 *      schema (EMAIL PHONE FN LN CT ST ZIP). Normalization is byte-identical
 *      to lib/meta/audienceHash.ts (the canonical hasher -- imported, not
 *      re-implemented). Raw PII never leaves the server; only SHA-256 hex does.
 *   3. refreshWestsideAudience -- DRY-RUN by default. A live push requires
 *      BOTH dryRun:false AND META_AUDIENCE_PUSH_ENABLED === 'true' (the same
 *      double-gate as lib/meta/audienceUpload.ts / the meta-audience-sync
 *      cron). The CLI passes enforcePushFlag:false to keep its historical
 *      contract (a manual operator command gated on the token alone); the
 *      cron never does.
 *
 * Suppression checks FAIL CLOSED: any error reading crm_suppressions (or any
 * input) throws before a single Meta call can happen.
 *
 * Env reads: Meta tokens + the push flag come ONLY from lib/meta-env.ts (the
 * ci:meta-token canon). Supabase URL/key are read here (same names the script
 * used); the ledger write lives in lib/data/crm/writeAudienceLedger (DAL) and
 * is called by the cron route, not this module.
 *
 * NOTE: no `server-only` marker on purpose -- the CLI (scripts/
 * meta-refresh-westside-audience.mjs) loads this module under tsx outside the
 * Next.js graph. Nothing here is ever imported by client components.
 */

import {
  getMetaPageTokenTrimmed,
  getMetaUserAccessToken,
  isMetaAudiencePushEnabled,
} from '@/lib/meta-env'
import { normalizeEmail, normalizePhone, normalizeName, sha256Hex } from '@/lib/meta/audienceHash'
import { META_MIN_AUDIENCE_SIZE, type AudienceRunSummary } from '@/lib/meta/audienceLedger'

/** The one fixed audience this module maintains (created 2026-05-25). */
export const WESTSIDE_AUDIENCE_ID = '120244510092910698'
export const WESTSIDE_AUDIENCE_NAME = 'RR Westside Bend Homeowners'

/**
 * Meta customer-file schema for this audience. Meta matches on whatever subset
 * of keys is present per row, so the strong keys (EMAIL/PHONE, present for
 * linked people with contact data) ride alongside name+location for all rows.
 */
export const WESTSIDE_SCHEMA = ['EMAIL', 'PHONE', 'FN', 'LN', 'CT', 'ST', 'ZIP'] as const

/** Graph API version -- pinned, same major as lib/meta/audienceUpload.ts. */
const GRAPH_API_VERSION = 'v21.0'
/** Rows per /users POST (script-historical; Meta's hard cap is 10,000). */
const USERS_BATCH_SIZE = 5000
/** PostgREST page size for the parcels read. */
const PARCEL_PAGE_SIZE = 1000
/** Ids per chunked crm_people / crm_suppressions read (URL length safety). */
const PEOPLE_CHUNK_SIZE = 200

/**
 * Tag substrings that mark a linked person as a realtor / industry contact --
 * excluded from the audience (same exclusion as the meta-audience-sync cron).
 */
export const REALTOR_TAG_KEYWORDS = [
  'realtor',
  'real estate',
  'real-estate-agent',
  'industry:realtor',
  'agent',
  'broker',
] as const

// ── Location normalizers (Meta CT/ST/ZIP spec; exported for tests) ──────────

/** City: lowercase, letters only ("Bend" -> "bend", "La Pine" -> "lapine"). */
export function normalizeCity(raw: string | null | undefined): string {
  return (raw || '').trim().toLowerCase().replace(/[^a-z]/g, '')
}

/** State: 2-letter lowercase code ("OR" -> "or", "Oregon" -> "or"). */
export function normalizeStateCode(raw: string | null | undefined): string {
  const s = (raw || '').trim().toLowerCase()
  return s.length === 2 ? s : s.replace(/[^a-z]/g, '').slice(0, 2)
}

/** ZIP: first 5 digits ("97703-1234" -> "97703"). */
export function normalizeZip(raw: string | null | undefined): string {
  return (raw || '').replace(/\D/g, '').slice(0, 5)
}

// ── Input row shapes ─────────────────────────────────────────────────────────

/** The columns read from westside_parcels. */
export type WestsideParcelRow = {
  apn: string
  owner1_first: string | null
  owner1_last: string | null
  mail_city: string | null
  mail_state: string | null
  mail_zip: string | null
  site_zip: string | null
  person_id: number | null
}

/** The columns read from crm_people for linked parcels. */
export type WestsidePersonRow = {
  id: number
  tags: readonly unknown[] | null
  /** crm_people.emails / .phones entries may be strings or { value } objects. */
  emails: readonly unknown[] | null
  phones: readonly unknown[] | null
  first_name: string | null
  last_name: string | null
}

/** Everything the pure payload builder needs -- one read, no I/O after. */
export type WestsideInputs = {
  parcels: WestsideParcelRow[]
  /** person_ids with a channel='all' crm_suppressions row (hard-stop). */
  suppressedPersonIds: number[]
  people: WestsidePersonRow[]
}

/** True when any tag carries a realtor/industry keyword (case-insensitive). */
export function isRealtorTagged(tags: readonly unknown[] | null | undefined): boolean {
  const lower = (tags ?? []).map((t) => String(t).toLowerCase())
  return lower.some((t) => REALTOR_TAG_KEYWORDS.some((kw) => t.includes(kw)))
}

/**
 * First entry of a crm_people contact list, unwrapping the { value } shape.
 * Mirrors the script's `list?.[0]?.value ?? list?.[0] ?? null` exactly.
 */
function firstContactRaw(list: readonly unknown[] | null | undefined): unknown {
  if (!Array.isArray(list) || list.length === 0) return null
  const first: unknown = list[0]
  if (first !== null && typeof first === 'object') {
    const v = (first as Record<string, unknown>).value
    return v ?? first
  }
  return first
}

/** Stringify a raw contact value for the canonical normalizers (null-safe). */
function asNormalizerInput(raw: unknown): string | null {
  return raw == null ? null : String(raw)
}

export type WestsidePayloadCounts = {
  totalParcels: number
  linkedParcels: number
  /** Parcels dropped because the linked person is hard-stop suppressed. */
  excludedSuppressed: number
  /** Parcels dropped because the linked person carries a realtor tag. */
  excludedRealtors: number
  /** Parcels dropped for a missing owner1_first / owner1_last. */
  skippedMissingName: number
  /** Rows in the payload (= rows.length). */
  eligible: number
  /** Eligible rows carrying a real (normalized) email / phone. */
  withEmail: number
  withPhone: number
}

export type WestsidePayload = {
  schema: readonly string[]
  /** One 7-cell row per eligible parcel; every cell is SHA-256 hex or ''. */
  rows: string[][]
  counts: WestsidePayloadCounts
}

/**
 * PURE payload builder: exclusions + hashing, no I/O, no env. Exclusion order
 * matches the script: suppressed first, then realtor, then missing-name.
 * Unlinked parcels (no person_id) are raw public-record data -- included
 * as-is with name+location keys only.
 */
export function buildWestsidePayload(inputs: WestsideInputs): WestsidePayload {
  const suppressed = new Set(inputs.suppressedPersonIds)
  const peopleById = new Map<number, WestsidePersonRow>()
  const realtorIds = new Set<number>()
  for (const person of inputs.people) {
    peopleById.set(person.id, person)
    if (isRealtorTagged(person.tags)) realtorIds.add(person.id)
  }

  let excludedSuppressed = 0
  let excludedRealtors = 0
  let skippedMissingName = 0
  let withEmail = 0
  let withPhone = 0
  const rows: string[][] = []

  for (const parcel of inputs.parcels) {
    if (parcel.person_id != null && suppressed.has(parcel.person_id)) {
      excludedSuppressed += 1
      continue
    }
    if (parcel.person_id != null && realtorIds.has(parcel.person_id)) {
      excludedRealtors += 1
      continue
    }
    if (!parcel.owner1_first || !parcel.owner1_last) {
      skippedMissingName += 1
      continue
    }

    // Prefer the CRM's real contact + name data when linked; fall back to the
    // parcel's own owner name (public record) when not.
    const person = parcel.person_id != null ? (peopleById.get(parcel.person_id) ?? null) : null
    const email = normalizeEmail(asNormalizerInput(firstContactRaw(person?.emails)))
    const phone = normalizePhone(asNormalizerInput(firstContactRaw(person?.phones)))
    const fn = normalizeName(person?.first_name || parcel.owner1_first)
    const ln = normalizeName(person?.last_name || parcel.owner1_last)
    if (email) withEmail += 1
    if (phone) withPhone += 1

    rows.push([
      email ? sha256Hex(email) : '',
      phone ? sha256Hex(phone) : '',
      fn ? sha256Hex(fn) : '',
      ln ? sha256Hex(ln) : '',
      sha256Hex(normalizeCity(parcel.mail_city || 'Bend')),
      sha256Hex(normalizeStateCode(parcel.mail_state || 'OR')),
      sha256Hex(normalizeZip(parcel.mail_zip || parcel.site_zip)),
    ])
  }

  return {
    schema: WESTSIDE_SCHEMA,
    rows,
    counts: {
      totalParcels: inputs.parcels.length,
      linkedParcels: inputs.parcels.filter((p) => p.person_id != null).length,
      excludedSuppressed,
      excludedRealtors,
      skippedMissingName,
      eligible: rows.length,
      withEmail,
      withPhone,
    },
  }
}

// ── Input loading (PostgREST, service key) ──────────────────────────────────

export type LoadWestsideInputsOptions = {
  /** Injectable for tests -- production uses global fetch. */
  fetchImpl?: typeof fetch
  supabaseUrl?: string
  supabaseKey?: string
}

/**
 * Load parcels + linked people + hard-stop suppressions. THROWS on any failed
 * read (including the suppression read) -- the refresh fails closed rather
 * than pushing an unchecked audience.
 */
export async function loadWestsideInputs(
  options: LoadWestsideInputsOptions = {},
): Promise<WestsideInputs> {
  const fetchImpl = options.fetchImpl ?? fetch
  const supabaseUrl = (options.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const supabaseKey = (options.supabaseKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  }

  const sbFetch = async (path: string): Promise<unknown[]> => {
    const res = await fetchImpl(`${supabaseUrl}/rest/v1/${path}`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      cache: 'no-store',
    })
    if (!res.ok) {
      throw new Error(`Supabase fetch failed (${res.status}): ${path.split('?')[0]}`)
    }
    return (await res.json()) as unknown[]
  }

  const parcels: WestsideParcelRow[] = []
  for (let offset = 0; ; offset += PARCEL_PAGE_SIZE) {
    const page = (await sbFetch(
      `westside_parcels?select=apn,owner1_first,owner1_last,mail_city,mail_state,mail_zip,site_zip,person_id&limit=${PARCEL_PAGE_SIZE}&offset=${offset}`,
    )) as WestsideParcelRow[]
    parcels.push(...page)
    if (page.length < PARCEL_PAGE_SIZE) break
  }

  const linkedIds = [
    ...new Set(parcels.filter((p) => p.person_id != null).map((p) => p.person_id as number)),
  ]

  const suppressedPersonIds: number[] = []
  const people: WestsidePersonRow[] = []
  for (let i = 0; i < linkedIds.length; i += PEOPLE_CHUNK_SIZE) {
    const idsParam = linkedIds.slice(i, i + PEOPLE_CHUNK_SIZE).join(',')
    const [suppressions, peoplePage] = await Promise.all([
      sbFetch(`crm_suppressions?select=person_id&channel=eq.all&person_id=in.(${idsParam})`),
      sbFetch(`crm_people?select=id,tags,emails,phones,first_name,last_name&id=in.(${idsParam})`),
    ])
    for (const row of suppressions as Array<{ person_id: number }>) {
      suppressedPersonIds.push(row.person_id)
    }
    people.push(...(peoplePage as WestsidePersonRow[]))
  }

  return { parcels, suppressedPersonIds, people }
}

// ── Run-mode resolution (pure) ───────────────────────────────────────────────

export type WestsideRunMode =
  | { dryRun: true; reason: 'requested' | 'flag-disabled' }
  | { dryRun: false }

/**
 * Decide dry vs live. A live run needs dryRunRequested:false AND (when
 * enforcePushFlag, i.e. every non-CLI caller) the env flag set. Pure so the
 * double-gate is unit-testable.
 */
export function resolveWestsideRunMode(args: {
  dryRunRequested: boolean
  pushFlagEnabled: boolean
  enforcePushFlag: boolean
}): WestsideRunMode {
  if (args.dryRunRequested) return { dryRun: true, reason: 'requested' }
  if (args.enforcePushFlag && !args.pushFlagEnabled) return { dryRun: true, reason: 'flag-disabled' }
  return { dryRun: false }
}

// ── The refresh ──────────────────────────────────────────────────────────────

export type RefreshWestsideAudienceOptions = {
  /** Defaults to TRUE. A live push needs dryRun:false AND the env flag. */
  dryRun?: boolean
  /**
   * Defaults to TRUE (cron posture: META_AUDIENCE_PUSH_ENABLED must be 'true'
   * for a live push). ONLY the manual CLI passes false, preserving its
   * historical token-gated contract.
   */
  enforcePushFlag?: boolean
  /** Injectable fetch for the Meta Graph calls ONLY (tests). */
  fetchImpl?: typeof fetch
  /** Injectable input reader (tests). */
  readInputs?: typeof loadWestsideInputs
}

export type WestsideRefreshResult = {
  /** True when nothing was pushed to Meta. */
  dryRun: boolean
  dryRunReason?: 'requested' | 'flag-disabled' | 'missing-credentials'
  audienceId: string
  audienceName: string
  counts: WestsidePayloadCounts
  /** Live path only. */
  numReceived?: number
  numInvalid?: number
  errors: string[]
}

/**
 * Refresh the westside audience. DRY-RUN by default: computes the payload,
 * logs the counts, and returns WITHOUT any Meta call. Live path replaces the
 * audience membership additively via POST /users (Meta upserts by hash).
 */
export async function refreshWestsideAudience(
  options: RefreshWestsideAudienceOptions = {},
): Promise<WestsideRefreshResult> {
  const dryRunRequested = options.dryRun !== false // default true
  const enforcePushFlag = options.enforcePushFlag !== false // default true
  const fetchImpl = options.fetchImpl ?? fetch
  const readInputs = options.readInputs ?? loadWestsideInputs

  const mode = resolveWestsideRunMode({
    dryRunRequested,
    pushFlagEnabled: isMetaAudiencePushEnabled(),
    enforcePushFlag,
  })

  // Inputs + pure payload. Any read failure (parcels, people, SUPPRESSIONS)
  // throws here -- fail closed, nothing reaches Meta.
  const inputs = await readInputs()
  const payload = buildWestsidePayload(inputs)
  const c = payload.counts

  const base = {
    audienceId: WESTSIDE_AUDIENCE_ID,
    audienceName: WESTSIDE_AUDIENCE_NAME,
    counts: c,
    errors: [] as string[],
  }

  if (mode.dryRun) {
    console.log(
      `[westside-audience] DRY RUN (${mode.reason}): would push ${c.eligible} hashed rows ` +
        `(of ${c.totalParcels} parcels; excluded ${c.excludedSuppressed} suppressed, ` +
        `${c.excludedRealtors} realtor-tagged, ${c.skippedMissingName} missing-name; ` +
        `${c.withEmail} with email, ${c.withPhone} with phone) -- no Meta call.`,
    )
    return { ...base, dryRun: true, dryRunReason: mode.reason }
  }

  // LIVE path -- token required. Page token first (the token the script always
  // used, proven on the 2026-05/07 pushes), system-user token as fallback so an
  // expired page token cannot silently kill the weekly refresh.
  const token = getMetaPageTokenTrimmed() ?? getMetaUserAccessToken()
  if (!token) {
    console.warn('[westside-audience] live push blocked: missing Meta access token -- staying dry.')
    return {
      ...base,
      dryRun: true,
      dryRunReason: 'missing-credentials',
      errors: ['missing META_PAGE_ACCESS_TOKEN / META_USER_ACCESS_TOKEN'],
    }
  }

  let numReceived = 0
  let numInvalid = 0
  const errors: string[] = []
  for (let i = 0; i < payload.rows.length; i += USERS_BATCH_SIZE) {
    const batch = payload.rows.slice(i, i + USERS_BATCH_SIZE)
    const url =
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${WESTSIDE_AUDIENCE_ID}/users` +
      `?access_token=${encodeURIComponent(token)}`
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: { schema: [...WESTSIDE_SCHEMA], data: batch } }),
      cache: 'no-store',
    })
    const text = await res.text()
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    if (!res.ok) {
      errors.push(`batch@${i}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`)
      continue
    }
    const b = (body ?? {}) as { num_received?: number; num_invalid_entries?: number }
    numReceived += typeof b.num_received === 'number' ? b.num_received : batch.length
    numInvalid += typeof b.num_invalid_entries === 'number' ? b.num_invalid_entries : 0
  }

  console.log(
    `[westside-audience] LIVE push to "${WESTSIDE_AUDIENCE_NAME}" (${WESTSIDE_AUDIENCE_ID}): ` +
      `received=${numReceived} invalid=${numInvalid} of ${c.eligible} rows` +
      (errors.length ? ` -- ${errors.length} batch error(s)` : '') +
      '.',
  )
  return { ...base, dryRun: false, numReceived, numInvalid, errors }
}

// ── Ledger summary (pure) ────────────────────────────────────────────────────

/**
 * Shape one westside run into the AudienceRunSummary the shared ledger writer
 * (lib/data/crm/writeAudienceLedger -> meta_audience_log) persists. The remove
 * leg is structurally zero -- this refresh only upserts. audience_id is always
 * set (the id is fixed) so westside rows are distinguishable from the CRM
 * sync's rows in the same table.
 */
export function summarizeWestsideRun(result: WestsideRefreshResult): AudienceRunSummary {
  const c = result.counts
  const matchCount = result.dryRun ? c.eligible : (result.numReceived ?? c.eligible)
  const belowMinimumMatch = matchCount < META_MIN_AUDIENCE_SIZE

  const pushPart = result.dryRun
    ? `DRY would-push ${c.eligible} of ${c.totalParcels} parcels` +
      (result.dryRunReason ? ` (${result.dryRunReason})` : '')
    : `LIVE received ${result.numReceived ?? 0} invalid ${result.numInvalid ?? 0} of ${c.eligible}`
  const exclPart =
    `excluded ${c.excludedSuppressed} suppressed, ${c.excludedRealtors} realtor-tagged, ` +
    `${c.skippedMissingName} missing-name`
  const errPart = result.errors.length ? ` | ${result.errors.length} error(s)` : ''
  const floorPart = belowMinimumMatch
    ? ` | WARNING ${matchCount} < ${META_MIN_AUDIENCE_SIZE} match floor`
    : ''
  const message =
    `Meta westside audience refresh -- ${pushPart}; ${exclPart} -> ` +
    `"${result.audienceName}" (${result.audienceId})${errPart}${floorPart}`

  return {
    dryRun: result.dryRun,
    matchCount,
    belowMinimumMatch,
    add: {
      dryRun: result.dryRun,
      dryRunReason: result.dryRunReason,
      wouldUpload: c.eligible,
      excludedSuppressed: c.excludedSuppressed,
      excludedRealtors: c.excludedRealtors,
      skippedUnhashable: c.skippedMissingName,
      numReceived: result.numReceived,
      numInvalid: result.numInvalid,
      audienceId: result.audienceId,
    },
    remove: {
      dryRun: result.dryRun,
      requested: 0,
      wouldRemove: 0,
      skippedUnhashable: 0,
    },
    errors: result.errors,
    message,
  }
}

// ── CLI runner (called by scripts/meta-refresh-westside-audience.mjs) ───────

/**
 * The manual CLI, contract-identical to the pre-port script:
 *   --dry-run  -> counts only, no Meta call.
 *   (no flag)  -> LIVE push, gated on the Meta token being present -- NOT on
 *                 META_AUDIENCE_PUSH_ENABLED (that double-gate governs the
 *                 cron; this is a deliberate operator command).
 * Returns the process exit code.
 */
export async function runWestsideRefreshCli(argv: readonly string[]): Promise<number> {
  const dryRun = argv.includes('--dry-run')

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return 1
  }
  if (!dryRun && !(getMetaPageTokenTrimmed() ?? getMetaUserAccessToken())) {
    console.error('Missing META_PAGE_ACCESS_TOKEN (or pass --dry-run)')
    return 1
  }

  console.log(`[westside-audience-refresh] ${dryRun ? 'DRY RUN' : 'LIVE'} -- loading westside_parcels...`)
  const result = await refreshWestsideAudience({ dryRun, enforcePushFlag: false })
  const c = result.counts
  console.log(`  loaded ${c.totalParcels} parcels (${c.linkedParcels} linked to a crm_people row)`)
  console.log(
    `  excluded ${c.excludedSuppressed} suppressed + ${c.excludedRealtors} realtor-tagged; ` +
      `skipped ${c.skippedMissingName} missing-name -> ${c.eligible} eligible`,
  )
  console.log(`  ${c.withEmail} records carry a real email, ${c.withPhone} a real phone`)

  if (result.dryRun) {
    console.log(
      `\n[DRY RUN] Would push ${c.eligible} hashed records to audience ${result.audienceId}. ` +
        'No network call made to Meta.',
    )
    return 0
  }

  for (const err of result.errors) console.warn(`  ! ${err}`)
  console.log(
    `\n[westside-audience-refresh] done -- received=${result.numReceived ?? 0} ` +
      `invalid=${result.numInvalid ?? 0} of ${c.eligible} records for audience ${result.audienceId}.`,
  )
  return 0
}
