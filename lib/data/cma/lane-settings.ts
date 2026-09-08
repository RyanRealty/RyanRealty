/**
 * Per-lane Auto-send — the control Matt flips (CMA funnel mission 2026-09-07).
 *
 * Matt's standing rule (2026-07-30) is that outreach is manual FOR NOW, and his
 * 2026-09-07 ask is that expireds and FSBOs get automated. Both are the same
 * build: the real control, shipped OFF, that HE turns on. It is a product
 * surface — a switch at /admin/cmas, a row per lane, and the email of whoever
 * moved it — not an env var an agent can set.
 *
 * EVERY READ FAILS CLOSED. A missing row, an empty table, absent credentials, a
 * Supabase error, a lane nobody seeded: all of them read as OFF. The only way a
 * lane returns true is a row that says so.
 *
 * Table: public.cma_lane_settings (20260907140000_cma_lane_settings.sql).
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import type { CmaOrigin } from '@/lib/cma/origin'

/**
 * The lanes a switch exists for.
 *
 * `internal` and `unknown` are absent on purpose: both classify to sendMode
 * 'manual' in lib/cma/origin.ts, so a switch for either would be a control with
 * nothing behind it — and an armed-looking one on the screen.
 */
export const AUTO_SEND_LANES = [
  'expired',
  'fsbo',
  'seller-valuation',
  'place-page',
  'lead-form',
  'bpo',
  'broker',
] as const satisfies readonly CmaOrigin[]

export type AutoSendLane = (typeof AUTO_SEND_LANES)[number]

export type LaneSetting = {
  autoSend: boolean
  updatedAt: string | null
  updatedBy: string | null
}

export type LaneSettings = Record<AutoSendLane, LaneSetting>

const LANE_SET: ReadonlySet<string> = new Set<string>(AUTO_SEND_LANES)

/** Is this string one of the six lanes that can carry a switch? */
export function isAutoSendLane(origin: string): origin is AutoSendLane {
  return LANE_SET.has(origin)
}

type RawLaneRow = {
  origin?: unknown
  auto_send?: unknown
  updated_at?: unknown
  updated_by?: unknown
}

function str(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : null
  return s || null
}

/**
 * Rows → the full settings map, PURE. Every lane is present whether the table
 * had a row for it or not, and `auto_send` must be the boolean `true` to arm a
 * lane — the string "true", 1, and null are all off.
 */
export function normalizeLaneSettings(rows: readonly RawLaneRow[]): LaneSettings {
  const out = {} as LaneSettings
  for (const lane of AUTO_SEND_LANES) {
    out[lane] = { autoSend: false, updatedAt: null, updatedBy: null }
  }
  for (const r of rows) {
    const origin = str(r.origin)
    if (!origin || !isAutoSendLane(origin)) continue
    out[origin] = {
      autoSend: r.auto_send === true,
      updatedAt: str(r.updated_at),
      updatedBy: str(r.updated_by),
    }
  }
  return out
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

/**
 * Every lane's switch. Never throws and never returns a partial map — a read
 * failure is reported to the log and answered as "every lane off", because the
 * alternative on this particular read is mailing homeowners on a database blip.
 */
export async function getLaneSettings(): Promise<LaneSettings> {
  const sb = client()
  if (!sb) return normalizeLaneSettings([])
  const { data, error } = await sb
    .from('cma_lane_settings')
    .select('origin, auto_send, updated_at, updated_by')
  if (error) {
    console.error('[cma lane settings] read failed, treating every lane as off:', error.message)
    return normalizeLaneSettings([])
  }
  return normalizeLaneSettings((data ?? []) as RawLaneRow[])
}

/** One lane's switch, same fail-closed contract. */
export async function getLaneAutoSend(origin: CmaOrigin): Promise<boolean> {
  if (!isAutoSendLane(origin)) return false
  const settings = await getLaneSettings()
  return settings[origin].autoSend
}

/**
 * Move a lane's switch, recording who moved it and when.
 *
 * `by` is the admin email from the calling action's session — it is the audit
 * trail for a standing decision to send mail without a per-document tap, so the
 * write refuses to proceed without one.
 */
export async function setLaneAutoSend(
  origin: string,
  on: boolean,
  by: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isAutoSendLane(origin)) return { ok: false, error: `"${origin}" is not a send lane.` }
  const who = by.trim()
  if (!who) return { ok: false, error: 'Auto-send changes are recorded against a person. No email on the session.' }
  const sb = client()
  if (!sb) return { ok: false, error: 'No database connection.' }

  const { error } = await sb
    .from('cma_lane_settings')
    .upsert(
      { origin, auto_send: on, updated_at: new Date().toISOString(), updated_by: who },
      { onConflict: 'origin' },
    )
  if (error) return { ok: false, error: error.message }

  // A standing decision to mail people without a per-document tap belongs in a
  // log a person can read later, not only in the column it overwrote.
  // public.admin_actions is the existing audit trail behind /admin/audit-log —
  // same table lib/data/crm/recordSendBlockEvent.ts writes to, no new table.
  // Best-effort: an audit-write failure must not leave the switch half-moved.
  try {
    const { error: logError } = await sb.from('admin_actions').insert({
      admin_email: who,
      role: 'admin',
      action_type: on ? 'cma_lane_auto_send_on' : 'cma_lane_auto_send_off',
      resource_type: 'cma_lane',
      resource_id: origin,
      details: {
        origin,
        auto_send: on,
        effect: on
          ? 'Ready, audit-passed documents in this lane are finalized and put on the lane without a per-document approval.'
          : 'Documents in this lane wait for a per-document approval again.',
      },
    })
    if (logError) console.warn('[cma lane settings] audit write failed:', logError.message)
  } catch (e) {
    console.warn('[cma lane settings] audit write skipped:', e instanceof Error ? e.message : String(e))
  }

  return { ok: true }
}
