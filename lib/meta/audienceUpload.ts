/**
 * lib/meta/audienceUpload.ts -- the crm_people -> Meta Custom Audience uploader
 * (CONTACT360 Phase 5.1). Consent-gated, PII-hashed, DRY-RUN by default.
 *
 * syncCrmAudience({ dryRun = true }):
 *   1. Read the consent-gated eligible population (getAudienceEligiblePeople --
 *      has email|phone, not deleted, NO crm_suppressions row). The suppression
 *      exclusion mirrors the send path's consent surface exactly; it is NOT a
 *      second consent source.
 *   2. Hash each person into Meta's MULTI_KEY record (buildAudienceUserData --
 *      SHA-256 of normalized EMAIL/PHONE/FN/LN). Raw PII never leaves the server.
 *   3. DRY-RUN PATH (the default, AND the forced path whenever the live flag is
 *      not set): compute the audience, log the count + a sample of HASHED ids +
 *      the would-exclude count, and RETURN WITHOUT calling Meta.
 *   4. LIVE PATH (only when META_AUDIENCE_PUSH_ENABLED === 'true' AND
 *      dryRun:false, BOTH): find-or-create the named Custom Audience, then push
 *      the hashed users to the /users endpoint (schema MULTI_KEY, batched).
 *
 * The first real push is Matt's explicit decision -- this module makes it
 * impossible to push by accident: the default returns the dry-run shape, and a
 * missing/!=='true' flag forces dry-run even when dryRun:false is passed.
 *
 * DAL boundary: all Supabase reads go through getAudienceEligiblePeople in
 * lib/data/crm. This file does NO raw .from() and NO direct process.env META_*
 * read (those go through lib/meta-env.ts).
 */

import 'server-only'
import {
  getMetaUserAccessToken,
  getMetaAdAccountId,
  isMetaAudiencePushEnabled,
} from '@/lib/meta-env'
import {
  buildAudienceUserData,
  toSchemaRow,
  AUDIENCE_SCHEMA,
  type AudienceUserData,
} from '@/lib/meta/audienceHash'
import {
  getAudienceEligiblePeople,
  type AudienceEligiblePerson,
} from '@/lib/data/crm/getAudienceEligiblePeople'

/** Graph API version -- pinned (CLAUDE / audit 5.2 pin Graph at a fixed major). */
const GRAPH_API_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

/** The single named audience this uploader maintains. */
export const CRM_AUDIENCE_NAME = 'Ryan Realty CRM Leads'
const CRM_AUDIENCE_DESCRIPTION =
  'Ryan Realty CRM contacts with consent (no suppression). Hashed first-party customer file. Maintained by syncCrmAudience.'

/** Meta caps a single /users push at 10,000 rows. */
const MAX_USERS_PER_BATCH = 10000

export type SyncCrmAudienceOptions = {
  /** Defaults to true. A live push needs dryRun:false AND the env flag set. */
  dryRun?: boolean
  /** Optional cap on rows read/hashed (forwarded to the DAL read). */
  limit?: number
  /**
   * Injectable fetch + reader for tests (so the dry-run + live paths can be
   * exercised without a network or a database). Production passes neither.
   */
  fetchImpl?: typeof fetch
  readEligible?: typeof getAudienceEligiblePeople
}

export type SyncCrmAudienceResult = {
  /** True when nothing was pushed to Meta (default, or flag-not-set). */
  dryRun: boolean
  /** Why we stayed dry: 'requested' (dryRun:true) or 'flag-disabled'. */
  dryRunReason?: 'requested' | 'flag-disabled'
  /** People read that produced a hashable (matchable) record. */
  wouldUpload: number
  /** Otherwise-eligible people dropped solely because they are suppressed. */
  excludedSuppressed: number
  /** Otherwise-eligible people dropped because they carry a realtor/agent tag. */
  excludedRealtors: number
  /** Eligible people whose record could not be hashed (no usable key). */
  skippedUnhashable: number
  /** Up to a few HASHED ids, for the operator to eyeball (never raw PII). */
  sampleHash: AudienceUserData[]
  /** Set on the live path. */
  audienceId?: string
  audienceName?: string
  numReceived?: number
  numInvalid?: number
  /** Non-fatal issues encountered on the live path. */
  errors?: string[]
}

/** Build the hashed records + counts for the eligible population. */
function buildRecords(people: AudienceEligiblePerson[]): {
  records: AudienceUserData[]
  skippedUnhashable: number
} {
  const records: AudienceUserData[] = []
  let skippedUnhashable = 0
  for (const p of people) {
    const rec = buildAudienceUserData(p)
    if (rec) records.push(rec)
    else skippedUnhashable += 1
  }
  return { records, skippedUnhashable }
}

/** Minimal Graph call helper. Token is appended as a query param (Graph style). */
async function graph(
  fetchImpl: typeof fetch,
  method: 'GET' | 'POST',
  path: string,
  token: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const sep = path.includes('?') ? '&' : '?'
  const url = `${GRAPH_BASE}/${path}${sep}access_token=${encodeURIComponent(token)}`
  const res = await fetchImpl(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
  })
  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = text
  }
  return { ok: res.ok, status: res.status, body: parsed }
}

/** Find the named audience on the ad account, or create it. Returns its id. */
async function findOrCreateAudience(
  fetchImpl: typeof fetch,
  adAccountId: string,
  token: string,
): Promise<string> {
  const list = await graph(
    fetchImpl,
    'GET',
    `${adAccountId}/customaudiences?fields=id,name&limit=500`,
    token,
  )
  const data =
    list.ok && list.body && typeof list.body === 'object'
      ? ((list.body as { data?: Array<{ id: string; name: string }> }).data ?? [])
      : []
  const existing = data.find((a) => a.name === CRM_AUDIENCE_NAME)
  if (existing) return existing.id

  const created = await graph(fetchImpl, 'POST', `${adAccountId}/customaudiences`, token, {
    name: CRM_AUDIENCE_NAME,
    description: CRM_AUDIENCE_DESCRIPTION,
    subtype: 'CUSTOM',
    customer_file_source: 'USER_PROVIDED_ONLY',
  })
  const id =
    created.ok && created.body && typeof created.body === 'object'
      ? (created.body as { id?: string }).id
      : undefined
  if (!id) {
    throw new Error(
      `create customaudience "${CRM_AUDIENCE_NAME}" failed: ${JSON.stringify(created.body).slice(0, 300)}`,
    )
  }
  return id
}

/** Push hashed users to the audience /users endpoint, batched. */
async function pushUsers(
  fetchImpl: typeof fetch,
  audienceId: string,
  token: string,
  records: AudienceUserData[],
): Promise<{ numReceived: number; numInvalid: number; errors: string[] }> {
  let numReceived = 0
  let numInvalid = 0
  const errors: string[] = []
  for (let i = 0; i < records.length; i += MAX_USERS_PER_BATCH) {
    const batch = records.slice(i, i + MAX_USERS_PER_BATCH)
    const data = batch.map(toSchemaRow)
    const res = await graph(fetchImpl, 'POST', `${audienceId}/users`, token, {
      payload: { schema: [...AUDIENCE_SCHEMA], data },
    })
    if (!res.ok) {
      errors.push(`batch@${i}: ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`)
      continue
    }
    const b = (res.body ?? {}) as { num_received?: number; num_invalid_entries?: number }
    numReceived += typeof b.num_received === 'number' ? b.num_received : batch.length
    numInvalid += typeof b.num_invalid_entries === 'number' ? b.num_invalid_entries : 0
  }
  return { numReceived, numInvalid, errors }
}

/**
 * Sync the consent-gated, hashed CRM audience to Meta. DRY-RUN by default; a
 * live push requires BOTH dryRun:false AND META_AUDIENCE_PUSH_ENABLED==='true'.
 */
export async function syncCrmAudience(
  options: SyncCrmAudienceOptions = {},
): Promise<SyncCrmAudienceResult> {
  const dryRunRequested = options.dryRun !== false // default true
  const fetchImpl = options.fetchImpl ?? fetch
  const read = options.readEligible ?? getAudienceEligiblePeople

  // 1. Consent-gated + realtor-excluded read.
  const { people, excludedSuppressed, excludedRealtors } = await read({ limit: options.limit })

  // 2. Hash.
  const { records, skippedUnhashable } = buildRecords(people)
  const sampleHash = records.slice(0, 3)

  const base: SyncCrmAudienceResult = {
    dryRun: true,
    wouldUpload: records.length,
    excludedSuppressed,
    excludedRealtors,
    skippedUnhashable,
    sampleHash,
    audienceName: CRM_AUDIENCE_NAME,
  }

  // 3. Decide dry-run vs live. The env flag is the master switch; dryRun:false
  //    alone is NOT enough -- both must agree.
  const pushEnabled = isMetaAudiencePushEnabled()
  if (dryRunRequested || !pushEnabled) {
    const reason: 'requested' | 'flag-disabled' = dryRunRequested ? 'requested' : 'flag-disabled'
    console.log(
      `[syncCrmAudience] DRY RUN (${reason}): wouldUpload=${records.length} ` +
        `excludedSuppressed=${excludedSuppressed} excludedRealtors=${excludedRealtors} ` +
        `skippedUnhashable=${skippedUnhashable} ` +
        `sampleHashedIds=${JSON.stringify(sampleHash)} -- no Meta call.`,
    )
    return { ...base, dryRun: true, dryRunReason: reason }
  }

  // 4. LIVE PATH -- creds required.
  const token = getMetaUserAccessToken()
  const adAccountId = getMetaAdAccountId()
  if (!token || !adAccountId) {
    const errors = [
      !token ? 'missing META_USER_ACCESS_TOKEN' : null,
      !adAccountId ? 'missing META_AD_ACCOUNT_ID' : null,
    ].filter((x): x is string => x !== null)
    console.warn(`[syncCrmAudience] live push blocked: ${errors.join(', ')} -- staying dry.`)
    return { ...base, dryRun: true, dryRunReason: 'flag-disabled', errors }
  }

  const audienceId = await findOrCreateAudience(fetchImpl, adAccountId, token)
  const { numReceived, numInvalid, errors } = await pushUsers(fetchImpl, audienceId, token, records)
  console.log(
    `[syncCrmAudience] LIVE push to "${CRM_AUDIENCE_NAME}" (${audienceId}): ` +
      `received=${numReceived} invalid=${numInvalid} ` +
      `excludedSuppressed=${excludedSuppressed} excludedRealtors=${excludedRealtors}.`,
  )
  return {
    ...base,
    dryRun: false,
    audienceId,
    numReceived,
    numInvalid,
    ...(errors.length ? { errors } : {}),
  }
}
