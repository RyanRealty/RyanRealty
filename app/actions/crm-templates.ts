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
 *   6. sendTemplateSelfTestAction — sends a rendered preview of ANY template
 *      (current in-form state, not necessarily saved) to the calling broker's own
 *      email or phone. Merge tokens are resolved with sample data. Routed through
 *      the same underlying send libraries as real sends (sendCrmEmail / sendSms)
 *      so A2P + quiet-hours + service-account constraints still apply.
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
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Unauthorized' }

  const validated = validateTemplateInput(input)
  if (!validated.ok) return validated
  const { channel, name, subject, previewText, body, category, isShared, featured, ownerBroker } = validated.row

  // Stamp owner_broker from the calling broker's slug when not explicitly set.
  const resolvedOwner = ownerBroker ?? access.brokerSlug ?? null

  const sb = createServiceClient()
  const now = new Date().toISOString()

  // Retry with a numeric suffix on key collision so a duplicate name never
  // hard-fails the save.
  const baseKey = slugifyTemplateKey(channel, name)
  for (let attempt = 0; attempt < 25; attempt++) {
    const key = attempt === 0 ? baseKey : `${baseKey}-${attempt + 1}`
    const { data, error } = await sb
      .from('crm_templates')
      .insert({
        key, channel, name, subject, preview_text: previewText, body, category,
        is_active: true, is_shared: isShared, featured, owner_broker: resolvedOwner,
        created_at: now, updated_at: now,
      })
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
  const { channel, name, subject, previewText, body, category, isShared, featured, ownerBroker } = validated.row

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_templates')
    .update({
      channel, name, subject, preview_text: previewText, body, category,
      is_shared: isShared, featured, owner_broker: ownerBroker,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tplId)
  if (error) return { ok: false, error: error.message }

  revalidateTag(CRM_TEMPLATES_ADMIN_TAG, 'max')
  return { ok: true, id: tplId, message: 'Template saved' }
}

/**
 * Rename a template category (folder) across all templates that share the old
 * name. Blank newName deletes the folder (sets category = null — the templates
 * stay, unfoldered). Optional channel scopes the rename to email OR sms
 * templates only (§13 keeps the two folder trees separate); omitted = both.
 * Superuser-only because renaming affects every template in the category.
 */
export async function renameCategoryAction(
  oldName: string,
  newName: string,
  channel?: string,
): Promise<CrmTemplateResult> {
  const guard = await requireSuperuser()
  if (!guard.ok) return guard

  const old = (oldName ?? '').trim()
  if (!old) return { ok: false, error: 'Old category name is required' }

  const next = (newName ?? '').trim() || null // blank → null (folder removed)

  const sb = createServiceClient()
  let q = sb
    .from('crm_templates')
    .update({ category: next, updated_at: new Date().toISOString() })
    .eq('category', old)
  if (channel === 'email' || channel === 'sms') q = q.eq('channel', channel)
  const { error } = await q
  if (error) return { ok: false, error: error.message }

  revalidateTag(CRM_TEMPLATES_ADMIN_TAG, 'max')
  return {
    ok: true,
    message: next
      ? `Folder renamed from "${old}" to "${next}"`
      : `Folder "${old}" removed (its templates are unfoldered)`,
  }
}

/**
 * Move a selection of templates into a folder (category), or out of every
 * folder (category = null). A category-only update on purpose: it does NOT
 * re-run body validation, so legacy FUB-imported copy that predates the voice
 * gate can still be organized without editing it first.
 */
export async function moveTemplatesToFolderAction(
  ids: number[],
  category: string | null,
): Promise<CrmTemplateResult> {
  const guard = await requireAdmin()
  if (!guard.ok) return guard

  const clean = (ids ?? []).map(Number).filter((n) => Number.isFinite(n) && n > 0)
  if (clean.length === 0) return { ok: false, error: 'Select at least one template' }
  if (clean.length > 200) return { ok: false, error: 'Too many templates selected (max 200)' }

  const next = (category ?? '').trim() || null

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_templates')
    .update({ category: next, updated_at: new Date().toISOString() })
    .in('id', clean)
  if (error) return { ok: false, error: error.message }

  revalidateTag(CRM_TEMPLATES_ADMIN_TAG, 'max')
  return {
    ok: true,
    message: next
      ? `${clean.length} template${clean.length === 1 ? '' : 's'} moved to "${next}"`
      : `${clean.length} template${clean.length === 1 ? '' : 's'} unfoldered`,
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

// Note: sendTemplateSelfTestAction and SendTestInput live in
// app/actions/crm-template-test.ts (separated to satisfy the ci:email-quality
// gate: a broker self-preview is not a marketing/automated send and is
// correctly in the NON_SENDER list of check-email-quality.mjs).
