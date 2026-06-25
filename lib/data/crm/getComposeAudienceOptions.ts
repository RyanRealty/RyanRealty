import 'server-only'
import { getCrmSavedViews } from '@/lib/data/crm/getCrmSavedViews'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import { CRM_STAGES } from '@/lib/crm/constants'
import type { ScopeAccess } from '@/lib/crm/scope'

/**
 * getComposeAudienceOptions — the read side of the compose-to-cohort surface
 * (Wave 5). One call returns everything the compose picker needs:
 *
 *   - savedViews: every smart list the caller may target, each with a LIVE count
 *     resolved under the caller's broker scope (reuses getCrmSavedViews, so the
 *     count equals exactly what the cohort will resolve to). A restricted broker
 *     never sees a count past their own book.
 *   - templates: the ACTIVE email templates the picker offers (active-only, email
 *     channel only — SMS templates can't be a cohort email).
 *   - stages: the pipeline stages a "send to a stage" audience can pick.
 *
 * DAL boundary (G1): no raw .from() here. It composes two existing DAL readers
 * (getCrmSavedViews, getCrmTemplatesAdmin) + a static constant. The per-caller
 * scope means the saved-view counts are NOT cached (getCrmSavedViews handles that);
 * the templates read is cached by getCrmTemplatesAdmin.
 */

export type ComposeTemplateOption = {
  id: number
  name: string
  subject: string | null
  body: string
  category: string | null
}

export type ComposeViewOption = {
  id: number
  name: string
  description: string | null
  /** Live count under the caller's scope. Null when the stored AST is unreadable. */
  count: number | null
}

export type ComposeAudienceOptions = {
  savedViews: ComposeViewOption[]
  templates: ComposeTemplateOption[]
  stages: readonly string[]
}

export async function getComposeAudienceOptions(
  access: ScopeAccess & { email: string },
): Promise<ComposeAudienceOptions> {
  const [views, templates] = await Promise.all([
    getCrmSavedViews(access),
    getCrmTemplatesAdmin(),
  ])

  const savedViews: ComposeViewOption[] = views.map((v) => ({
    id: v.id,
    name: v.name,
    description: v.description,
    count: v.count,
  }))

  const templateOptions: ComposeTemplateOption[] = templates
    .filter((t) => t.channel === 'email' && t.isActive && t.body.trim().length > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      body: t.body,
      category: t.category,
    }))

  return { savedViews, templates: templateOptions, stages: CRM_STAGES }
}
