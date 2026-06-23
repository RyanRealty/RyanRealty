/**
 * lib/meta/audienceRemove.ts -- DELETE suppressed contacts from the Meta CRM
 * Custom Audience (CONTACT360 Phase 8.4). Consent-driven removal, PII-hashed,
 * DRY-RUN by default.
 *
 * removeFromCrmAudience(personIds, { dryRun = true }):
 *   1. Read the people for the given ids (their PII) and hash each into Meta's
 *      MULTI_KEY record (buildAudienceUserData -- imported from the CANONICAL
 *      audienceHash module; we never re-implement hashing). Raw PII never leaves
 *      the server.
 *   2. DRY-RUN PATH (the default, AND the forced path whenever the live flag is
 *      not set): compute the would-remove count + a sample of HASHED ids and
 *      RETURN WITHOUT calling Meta.
 *   3. LIVE PATH (only when META_AUDIENCE_PUSH_ENABLED === 'true' AND
 *      dryRun:false, BOTH -- the exact same double-gate the uploader uses):
 *      find the named Custom Audience and DELETE the hashed users from its
 *      /users endpoint (HTTP DELETE, schema MULTI_KEY, batched).
 *
 * This is the symmetric counterpart to syncCrmAudience: the uploader ADDs
 * eligible (non-suppressed) people; this REMOVEs people who became suppressed.
 * It imports the committed env getters (lib/meta-env.ts) and the committed hash
 * helpers (lib/meta/audienceHash.ts) -- no new META_* env read, no second hash.
 *
 * DAL boundary: the person PII read goes through a lib/data reader injected by
 * the caller (the cron passes the queue-driven reader). This file does NO raw
 * .from() and NO direct process.env META_* read.
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
  type AudiencePerson,
  type AudienceUserData,
} from '@/lib/meta/audienceHash'
import { CRM_AUDIENCE_NAME } from '@/lib/meta/audienceUpload'

/** Graph API version -- pinned to match the uploader. */
const GRAPH_API_VERSION = 'v21.0'
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

/** Meta caps a single /users mutation at 10,000 rows (same as the add path). */
const MAX_USERS_PER_BATCH = 10000

/** A person to remove: their id + whatever PII keys we can hash. */
export type AudienceRemovePerson = AudiencePerson & { personId: number }

export type RemoveFromCrmAudienceOptions = {
  /** Defaults to true. A live DELETE needs dryRun:false AND the env flag set. */
  dryRun?: boolean
  /**
   * Resolve the given person ids to their PII rows. Injected so the cron can
   * pass the queue-driven reader and tests can pass a fake (no DB). When
   * omitted, no PII can be resolved and the run removes nothing.
   */
  resolvePeople?: (personIds: number[]) => Promise<AudienceRemovePerson[]>
  /** Injectable fetch for tests / the live path. Production passes none. */
  fetchImpl?: typeof fetch
}

export type RemoveFromCrmAudienceResult = {
  /** True when nothing was deleted from Meta (default, or flag-not-set). */
  dryRun: boolean
  /** Why we stayed dry: 'requested' (dryRun:true) or 'flag-disabled'. */
  dryRunReason?: 'requested' | 'flag-disabled'
  /** Person ids requested for removal. */
  requested: number
  /** People that produced a hashable (matchable) record -> would be removed. */
  wouldRemove: number
  /** Requested people whose record could not be hashed (no usable key). */
  skippedUnhashable: number
  /** Up to a few HASHED ids, for the operator to eyeball (never raw PII). */
  sampleHash: AudienceUserData[]
  /** Set on the live path. */
  audienceId?: string
  audienceName?: string
  numRemoved?: number
  /** Non-fatal issues encountered on the live path. */
  errors?: string[]
}

/**
 * PURE removal decision: given the requested ids and the resolved PII rows,
 * compute the hashed records to remove + the unhashable skip count. No I/O, no
 * env, no Meta call -- so the add/remove parity is unit-testable. A person with
 * no usable email AND no usable phone produces no record (can't be matched, so
 * can't be removed) and is counted as skipped.
 */
export function decideRemoval(people: AudienceRemovePerson[]): {
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

/** Minimal Graph call helper (token appended as a query param, Graph style). */
async function graph(
  fetchImpl: typeof fetch,
  method: 'GET' | 'DELETE',
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

/** Find the named audience id on the ad account, or null if it doesn't exist. */
async function findAudienceId(
  fetchImpl: typeof fetch,
  adAccountId: string,
  token: string,
): Promise<string | null> {
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
  return data.find((a) => a.name === CRM_AUDIENCE_NAME)?.id ?? null
}

/** DELETE hashed users from the audience /users endpoint, batched. */
async function deleteUsers(
  fetchImpl: typeof fetch,
  audienceId: string,
  token: string,
  records: AudienceUserData[],
): Promise<{ numRemoved: number; errors: string[] }> {
  let numRemoved = 0
  const errors: string[] = []
  for (let i = 0; i < records.length; i += MAX_USERS_PER_BATCH) {
    const batch = records.slice(i, i + MAX_USERS_PER_BATCH)
    const data = batch.map(toSchemaRow)
    const res = await graph(fetchImpl, 'DELETE', `${audienceId}/users`, token, {
      payload: { schema: [...AUDIENCE_SCHEMA], data },
    })
    if (!res.ok) {
      errors.push(`batch@${i}: ${res.status} ${JSON.stringify(res.body).slice(0, 200)}`)
      continue
    }
    const b = (res.body ?? {}) as { num_received?: number }
    numRemoved += typeof b.num_received === 'number' ? b.num_received : batch.length
  }
  return { numRemoved, errors }
}

/**
 * Remove the given people from the CRM Custom Audience. DRY-RUN by default; a
 * live DELETE requires BOTH dryRun:false AND META_AUDIENCE_PUSH_ENABLED==='true'
 * -- identical safety posture to syncCrmAudience.
 */
export async function removeFromCrmAudience(
  personIds: number[],
  options: RemoveFromCrmAudienceOptions = {},
): Promise<RemoveFromCrmAudienceResult> {
  const dryRunRequested = options.dryRun !== false // default true
  const fetchImpl = options.fetchImpl ?? fetch
  const ids = Array.from(new Set((personIds ?? []).filter((n) => Number.isFinite(n))))

  // 1. Resolve PII for the ids (injected reader; none -> nothing to remove).
  const people = options.resolvePeople ? await options.resolvePeople(ids) : []

  // 2. Hash (pure decision).
  const { records, skippedUnhashable } = decideRemoval(people)
  const sampleHash = records.slice(0, 3)

  const base: RemoveFromCrmAudienceResult = {
    dryRun: true,
    requested: ids.length,
    wouldRemove: records.length,
    skippedUnhashable,
    sampleHash,
    audienceName: CRM_AUDIENCE_NAME,
  }

  // 3. Decide dry-run vs live -- the env flag is the master switch; dryRun:false
  //    alone is NOT enough (both must agree), exactly like the uploader.
  const pushEnabled = isMetaAudiencePushEnabled()
  if (dryRunRequested || !pushEnabled) {
    const reason: 'requested' | 'flag-disabled' = dryRunRequested ? 'requested' : 'flag-disabled'
    console.log(
      `[removeFromCrmAudience] DRY RUN (${reason}): requested=${ids.length} ` +
        `wouldRemove=${records.length} skippedUnhashable=${skippedUnhashable} ` +
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
    console.warn(`[removeFromCrmAudience] live remove blocked: ${errors.join(', ')} -- staying dry.`)
    return { ...base, dryRun: true, dryRunReason: 'flag-disabled', errors }
  }

  if (records.length === 0) {
    // Nothing hashable to remove -- no Meta call needed.
    return { ...base, dryRun: false, numRemoved: 0 }
  }

  const audienceId = await findAudienceId(fetchImpl, adAccountId, token)
  if (!audienceId) {
    // No audience yet -> nothing to remove from (the uploader creates it).
    console.warn(`[removeFromCrmAudience] audience "${CRM_AUDIENCE_NAME}" not found -- nothing to remove.`)
    return { ...base, dryRun: false, numRemoved: 0, errors: ['audience-not-found'] }
  }

  const { numRemoved, errors } = await deleteUsers(fetchImpl, audienceId, token, records)
  console.log(
    `[removeFromCrmAudience] LIVE remove from "${CRM_AUDIENCE_NAME}" (${audienceId}): removed=${numRemoved}.`,
  )
  return {
    ...base,
    dryRun: false,
    audienceId,
    numRemoved,
    ...(errors.length ? { errors } : {}),
  }
}
