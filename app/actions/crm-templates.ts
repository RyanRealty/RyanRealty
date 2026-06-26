'use server'

/**
 * CRM email + SMS template CRUD actions (the write side of crm_templates).
 *
 * crm_templates was SELECT-only (seeded from FUB's 76 email + 37 SMS templates).
 * These actions make it fully editable in the admin: create, update, soft
 * activate/deactivate, and delete with a sequence-reference guard. The cached
 * reader is lib/data/crm/getCrmTemplatesAdmin.ts; the pickers
 * (getCrmEmailTemplates / getCrmSmsTemplates in app/actions/crm.ts) are left
 * untouched and still feed the composer + sequence step builder.
 *
 * Hard rules:
 *   1. Access-guarded the same way app/actions/crm.ts is (getCrmAccess). Templates
 *      are global brokerage config (not per-contact), so any admin may edit copy;
 *      DESTRUCTIVE config (delete) requires a superuser, matching the field-
 *      definition CRUD precedent.
 *   2. Every save runs subject + body through the brand-voice hard-fail gate
 *      (lib/crm/templateVoiceCheck) so a template can never persist with an
 *      em-dash, en-dash, semicolon, or banned word. The commit-time gate only
 *      scans source files; a DB-stored template would otherwise bypass it.
 *   3. Channel is validated (email|sms). Email requires a subject; SMS carries
 *      no subject.
 *   4. Delete REFUSES when any sequence references the template key
 *      (crm_sequences.steps[].templateKey), so deleting copy can never break a
 *      live drip. Refuse, never orphan.
 *   5. Every write revalidates CRM_TEMPLATES_ADMIN_TAG so the admin list updates
 *      immediately.
 *
 * DAL boundary (G1): mutations live here in a 'use server' module writing through
 * the service client; the typed reader lives in lib/data/crm.
 */

import { revalidateTag } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { CRM_TEMPLATES_ADMIN_TAG } from '@/lib/data/crm/getCrmTemplatesAdmin'
import { refuseReferencedTemplateDelete } from '@/lib/crm/templateReferences'
import {
  slugifyTemplateKey,
  validateTemplateInput,
  type CrmTemplateInput,
  type CrmTemplateResult,
} from '@/lib/crm/templateValidation'

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  return { ok: true }
}

async function requireSuperuser(): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }
  if (access.role !== 'superuser') {
    return { ok: false, error: 'Only an owner can delete a template' }
  }
  return { ok: true }
}

/** Create a new template. Generates a unique key from the name. */
export async function createTemplateAction(input: CrmTemplateInput): Promise<CrmTemplateResult> {
  const guard = await requireAdmin()
  if (!guard.ok) return guard

  const validated = validateTemplateInput(input)
  if (!validated.ok) return validated
  const { channel, name, subject, body, category } = validated.row

  const sb = createServiceClient()
  const now = new Date().toISOString()

  // Retry with a numeric suffix on key collision so a duplicate name never
  // hard-fails the save.
  const baseKey = slugifyTemplateKey(channel, name)
  for (let attempt = 0; attempt < 25; attempt++) {
    const key = attempt === 0 ? baseKey : `${baseKey}-${attempt + 1}`
    const { data, error } = await sb
      .from('crm_templates')
      .insert({ key, channel, name, subject, body, category, is_active: true, updated_at: now })
      .select('id')
      .single()
    if (!error) {
      revalidateTag(CRM_TEMPLATES_ADMIN_TAG, 'max')
      return { ok: true, id: Number(data?.id), message: 'Template created' }
    }
    if (error.code !== '23505') return { ok: false, error: error.message }
    // else: key collision, loop and try the next suffix
  }
  return { ok: false, error: 'Could not generate a unique key for this template' }
}

/**
 * Update a template's editable fields. The key + fub_legacy_id are immutable
 * (changing the key would orphan every sequence step that references it).
 */
export async function updateTemplateAction(id: number, input: CrmTemplateInput): Promise<CrmTemplateResult> {
  const guard = await requireAdmin()
  if (!guard.ok) return guard

  const tplId = Number(id)
  if (!Number.isFinite(tplId) || tplId <= 0) return { ok: false, error: 'A template is required' }

  const validated = validateTemplateInput(input)
  if (!validated.ok) return validated
  const { channel, name, subject, body, category } = validated.row

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_templates')
    .update({ channel, name, subject, body, category, updated_at: new Date().toISOString() })
    .eq('id', tplId)
  if (error) return { ok: false, error: error.message }

  revalidateTag(CRM_TEMPLATES_ADMIN_TAG, 'max')
  return { ok: true, id: tplId, message: 'Template saved' }
}

/**
 * Rename a template category across all templates that share the old name.
 * Blank newName collapses them to Uncategorized (sets category = null).
 * Superuser-only because renaming affects every template in the category.
 */
export async function renameCategoryAction(
  oldName: string,
  newName: string,
): Promise<CrmTemplateResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard

  const old = (oldName ?? '').trim()
  if (!old) return { ok: false, error: 'Old category name is required' }

  const next = (newName ?? '').trim() || null // blank → null (Uncategorized)

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_templates')
    .update({ category: next, updated_at: new Date().toISOString() })
    .eq('category', old)
  if (error) return { ok: false, error: error.message }

  revalidateTag(CRM_TEMPLATES_ADMIN_TAG, 'max')
  return {
    ok: true,
    message: next
      ? `Category renamed from "${old}" to "${next}"`
      : `Category "${old}" cleared (templates moved to Uncategorized)`,
  }
}

/** Soft-enable/disable a template (hides it from pickers without deleting). */
export async function setTemplateActiveAction(id: number, isActive: boolean): Promise<CrmTemplateResult> {
  const guard = await requireAdmin()
  if (!guard.ok) return guard

  const tplId = Number(id)
  if (!Number.isFinite(tplId) || tplId <= 0) return { ok: false, error: 'A template is required' }

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_templates')
    .update({ is_active: isActive === true, updated_at: new Date().toISOString() })
    .eq('id', tplId)
  if (error) return { ok: false, error: error.message }

  revalidateTag(CRM_TEMPLATES_ADMIN_TAG, 'max')
  return { ok: true, id: tplId, message: isActive ? 'Template enabled' : 'Template disabled' }
}

/**
 * Delete a template. Superuser-only. REFUSES when any sequence references the
 * template key (crm_sequences.steps[].templateKey) so deleting copy can never
 * break a live drip. The admin must detach it from those steps first.
 */
export async function deleteTemplateAction(id: number): Promise<CrmTemplateResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard

  const tplId = Number(id)
  if (!Number.isFinite(tplId) || tplId <= 0) return { ok: false, error: 'A template is required' }

  const sb = createServiceClient()
  const { data: existing, error: readErr } = await sb
    .from('crm_templates')
    .select('key')
    .eq('id', tplId)
    .maybeSingle()
  if (readErr) return { ok: false, error: readErr.message }
  if (!existing) return { ok: false, error: 'That template no longer exists' }

  const { data: seqRows, error: seqErr } = await sb.from('crm_sequences').select('id,name,steps')
  if (seqErr) return { ok: false, error: seqErr.message }
  const sequences = (seqRows ?? []) as Array<{ id: number; name: string; steps: unknown }>

  const refGuard = refuseReferencedTemplateDelete(String(existing.key), sequences)
  if (!refGuard.ok) return refGuard

  const { error } = await sb.from('crm_templates').delete().eq('id', tplId)
  if (error) return { ok: false, error: error.message }

  revalidateTag(CRM_TEMPLATES_ADMIN_TAG, 'max')
  return { ok: true, id: tplId, message: 'Template deleted' }
}
