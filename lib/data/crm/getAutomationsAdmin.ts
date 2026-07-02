import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { buildUsedByMap } from '@/lib/crm/automation-links'

/**
 * getAutomationsAdmin — the two readers the §12.2 Automations list page needs
 * (docs/fub-crm-spec/12-action-plans-and-automations.md):
 *
 *   - getCrmSequenceFolders(): every folder + live member count, system folders
 *     first (§12.2.2 folder card row).
 *   - getCrmAutomationsAdminList(): one row per sequence with everything the
 *     10-column table renders — name, status, step count, triggers, folder,
 *     authorship (Created By), creation date, and the inverted "used by" links
 *     for the Linked Automations pill (§12.2.3).
 *
 * Enrollment counts (Started / Completed) and the Engaged metric come from
 * getWorkflowAnalytics — this reader deliberately does not duplicate them.
 *
 * DAL boundary (G1): the raw .from('crm_sequence_folders' | 'crm_sequences')
 * reads live here. Service client (admin surface behind getCrmAccess, same as
 * the sibling CRM admin readers). Uncached — the list page is force-dynamic and
 * every mutation (create / move / toggle) must reflect immediately.
 */

export type CrmSequenceFolderRow = {
  id: number
  name: string
  isSystem: boolean
  folderOrder: number
  /** Live count of sequences whose folder_id = this folder. */
  memberCount: number
}

export type CrmAutomationAdminRow = {
  id: number
  name: string
  description: string | null
  status: string
  stepCount: number
  /** Raw steps jsonb (the editor link + used-by computation source). */
  steps: unknown[]
  /** Sequence-level triggers (empty = manual-enroll only). */
  triggers: unknown[]
  fubLegacyPlanId: number | null
  folderId: number | null
  /** Broker slug of the author (Created By column). */
  createdBy: string | null
  createdAt: string
  /** Sequences that reference THIS one via a run_automation step (Using: N ▾). */
  usedBy: Array<{ id: number; name: string }>
}

export async function getCrmSequenceFolders(): Promise<CrmSequenceFolderRow[]> {
  const sb = createServiceClient()
  const [{ data: folders, error: fErr }, { data: seqs, error: sErr }] = await Promise.all([
    sb
      .from('crm_sequence_folders')
      .select('id,name,is_system,folder_order')
      .order('is_system', { ascending: false })
      .order('folder_order', { ascending: true })
      .order('id', { ascending: true }),
    sb.from('crm_sequences').select('id,folder_id'),
  ])
  if (fErr || !folders) {
    if (fErr) console.error('[getCrmSequenceFolders]', fErr.message)
    return []
  }
  const counts = new Map<number, number>()
  if (!sErr) {
    for (const s of (seqs ?? []) as Array<{ folder_id: number | null }>) {
      if (s.folder_id == null) continue
      counts.set(Number(s.folder_id), (counts.get(Number(s.folder_id)) ?? 0) + 1)
    }
  }
  return (folders as Array<{ id: number; name: string; is_system: boolean; folder_order: number }>).map((f) => ({
    id: Number(f.id),
    name: String(f.name),
    isSystem: f.is_system === true,
    folderOrder: Number(f.folder_order ?? 0),
    memberCount: counts.get(Number(f.id)) ?? 0,
  }))
}

export async function getCrmAutomationsAdminList(): Promise<CrmAutomationAdminRow[]> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_sequences')
    .select('id,name,description,status,steps,triggers,fub_legacy_plan_id,folder_id,created_by,created_at')
    .order('created_at', { ascending: false })
  if (error || !data) {
    if (error) console.error('[getCrmAutomationsAdminList]', error.message)
    return []
  }
  type Raw = {
    id: number
    name: string
    description: string | null
    status: string
    steps: unknown
    triggers: unknown
    fub_legacy_plan_id: number | null
    folder_id: number | null
    created_by: string | null
    created_at: string
  }
  const rows = data as Raw[]
  const nameById = new Map<number, string>(rows.map((r) => [Number(r.id), String(r.name)]))
  const usedBy = buildUsedByMap(rows.map((r) => ({ id: Number(r.id), steps: r.steps })))
  return rows.map((r) => ({
    id: Number(r.id),
    name: String(r.name),
    description: r.description ?? null,
    status: String(r.status),
    stepCount: Array.isArray(r.steps) ? r.steps.length : 0,
    steps: Array.isArray(r.steps) ? (r.steps as unknown[]) : [],
    triggers: Array.isArray(r.triggers) ? (r.triggers as unknown[]) : [],
    fubLegacyPlanId: r.fub_legacy_plan_id == null ? null : Number(r.fub_legacy_plan_id),
    folderId: r.folder_id == null ? null : Number(r.folder_id),
    createdBy: r.created_by ?? null,
    createdAt: String(r.created_at),
    usedBy: (usedBy.get(Number(r.id)) ?? []).map((id) => ({ id, name: nameById.get(id) ?? `Workflow ${id}` })),
  }))
}
