/**
 * config-table — the reusable CONFIG-TABLE pattern.
 *
 * A factory that turns any reference table shaped like crm_stages
 * (id / key / label / position / is_active / is_protected) into a guarded CRUD
 * surface: list / create / rename / reorder / setActive / remove. First used by
 * crm_stages; the same factory backs the Wave 2 config tables (tags, templates,
 * segments, areas) with no per-table CRUD re-implementation.
 *
 * DAL boundary (G1): this module is imported ONLY by 'use server' action files
 * (app/actions/crm-*.ts). Its raw .from() writes therefore execute inside a
 * server action, which is the sanctioned mutation surface. The cached READ side
 * lives in lib/data/** (e.g. getCrmStages). UI never imports this directly.
 *
 * Access: every mutating method calls getCrmAccess() and refuses an
 * unauthenticated/non-admin caller. remove() additionally refuses a protected
 * row and supports an optional reassign callback so deleting a stage can move
 * affected crm_people to another stage FIRST (no orphaned people).
 *
 * The pure decision helpers (reorderPositions, refuseProtectedDelete) are
 * exported standalone so they are unit-tested without a DB.
 */
import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'

export type ConfigRow = {
  id: number
  key: string
  label: string
  position: number
  isActive: boolean
  isProtected: boolean
}

export type ConfigResult = { ok: true } | { ok: false; error: string }

type RawConfigRow = {
  id: number
  key: string
  label: string
  position: number
  is_active: boolean
  is_protected: boolean
}

function mapRow(r: RawConfigRow): ConfigRow {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    position: r.position,
    isActive: r.is_active,
    isProtected: r.is_protected,
  }
}

// ── Pure decision helpers (unit-tested without a DB) ────────────────────────

/**
 * Given the current ordered set of row ids and a desired full ordering, produce
 * the {id, position} updates to apply. Positions are normalized to a dense
 * 0..n-1 sequence so reordering never leaves gaps or collisions. Any id present
 * in `current` but missing from `orderedIds` is appended (stable by its current
 * order) so a partial order can never silently drop a row.
 */
export function reorderPositions(
  currentIds: number[],
  orderedIds: number[],
): Array<{ id: number; position: number }> {
  const known = new Set(currentIds)
  const seen = new Set<number>()
  const finalOrder: number[] = []
  for (const id of orderedIds) {
    if (known.has(id) && !seen.has(id)) {
      finalOrder.push(id)
      seen.add(id)
    }
  }
  // Append any current ids the caller omitted, preserving their existing order.
  for (const id of currentIds) {
    if (!seen.has(id)) {
      finalOrder.push(id)
      seen.add(id)
    }
  }
  return finalOrder.map((id, index) => ({ id, position: index }))
}

/**
 * The protected-delete rule. A protected row can never be removed regardless of
 * caller. Returns ok:false with a stable message the action surfaces verbatim.
 */
export function refuseProtectedDelete(row: { isProtected: boolean; label: string }): ConfigResult {
  if (row.isProtected) {
    return { ok: false, error: `${row.label} is a protected stage and cannot be deleted` }
  }
  return { ok: true }
}

// ── The factory ─────────────────────────────────────────────────────────────

export type MakeConfigTableOptions = {
  /** The public.<table> name (e.g. 'crm_stages'). */
  table: string
  /** Paths to revalidate after any mutation. */
  revalidatePaths: string[]
}

/**
 * Optional callback run BEFORE a row is deleted, so dependents can be migrated
 * first. For crm_stages: move every crm_people on the deleted stage to a chosen
 * fallback stage. Returns ok:false to abort the delete (the row is kept).
 */
export type ReassignCallback = (deleted: ConfigRow) => Promise<ConfigResult>

export function makeConfigTable(opts: MakeConfigTableOptions) {
  const { table, revalidatePaths } = opts

  function revalidate() {
    for (const p of revalidatePaths) revalidatePath(p)
  }

  async function requireAccess(): Promise<ConfigResult> {
    const access = await getCrmAccess()
    if (!access) return { ok: false, error: 'Unauthorized' }
    return { ok: true }
  }

  async function list(): Promise<ConfigRow[]> {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from(table)
      .select('id,key,label,position,is_active,is_protected')
      .order('position', { ascending: true })
      .order('id', { ascending: true })
    if (error || !data) {
      if (error) console.error(`[configTable:${table}] list`, error.message)
      return []
    }
    return (data as RawConfigRow[]).map(mapRow)
  }

  /** Load one row by id (internal — used by rename/setActive/remove). */
  async function getRow(id: number): Promise<ConfigRow | null> {
    const sb = createServiceClient()
    const { data } = await sb
      .from(table)
      .select('id,key,label,position,is_active,is_protected')
      .eq('id', id)
      .maybeSingle()
    return data ? mapRow(data as RawConfigRow) : null
  }

  async function create(input: { key: string; label: string }): Promise<ConfigResult> {
    const guard = await requireAccess()
    if (!guard.ok) return guard
    const key = input.key.trim()
    const label = input.label.trim()
    if (!key || !label) return { ok: false, error: 'Key and label are required' }

    const sb = createServiceClient()
    // New rows land at the end of the order.
    const { data: maxRow } = await sb
      .from(table)
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextPosition = ((maxRow?.position as number | undefined) ?? -1) + 1

    const { error } = await sb.from(table).insert({
      key,
      label,
      position: nextPosition,
      is_active: true,
      is_protected: false,
    })
    if (error) {
      if (error.code === '23505') return { ok: false, error: `"${key}" already exists` }
      return { ok: false, error: error.message }
    }
    revalidate()
    return { ok: true }
  }

  async function rename(id: number, label: string): Promise<ConfigResult> {
    const guard = await requireAccess()
    if (!guard.ok) return guard
    const next = label.trim()
    if (!next) return { ok: false, error: 'Label is required' }
    const sb = createServiceClient()
    const { error } = await sb
      .from(table)
      .update({ label: next, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidate()
    return { ok: true }
  }

  async function reorder(orderedIds: number[]): Promise<ConfigResult> {
    const guard = await requireAccess()
    if (!guard.ok) return guard
    const rows = await list()
    const updates = reorderPositions(rows.map((r) => r.id), orderedIds)
    const sb = createServiceClient()
    for (const u of updates) {
      const { error } = await sb
        .from(table)
        .update({ position: u.position, updated_at: new Date().toISOString() })
        .eq('id', u.id)
      if (error) return { ok: false, error: error.message }
    }
    revalidate()
    return { ok: true }
  }

  async function setActive(id: number, isActive: boolean): Promise<ConfigResult> {
    const guard = await requireAccess()
    if (!guard.ok) return guard
    const sb = createServiceClient()
    const { error } = await sb
      .from(table)
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidate()
    return { ok: true }
  }

  /**
   * Delete a row. Refuses a protected row. When reassign is supplied it runs
   * FIRST (move dependents off the row); a failed reassign aborts the delete so
   * no dependent is ever orphaned.
   */
  async function remove(id: number, reassign?: ReassignCallback): Promise<ConfigResult> {
    const guard = await requireAccess()
    if (!guard.ok) return guard
    const row = await getRow(id)
    if (!row) return { ok: false, error: 'Not found' }
    const protectedCheck = refuseProtectedDelete(row)
    if (!protectedCheck.ok) return protectedCheck

    if (reassign) {
      const moved = await reassign(row)
      if (!moved.ok) return moved
    }

    const sb = createServiceClient()
    const { error } = await sb.from(table).delete().eq('id', id)
    if (error) return { ok: false, error: error.message }
    revalidate()
    return { ok: true }
  }

  return { list, create, rename, reorder, setActive, remove }
}
