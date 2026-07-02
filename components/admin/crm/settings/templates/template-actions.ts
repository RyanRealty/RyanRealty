/**
 * Shared prop types for the §13 templates surface (client components receive
 * the server actions through these). Type-only module — safe on both sides.
 */
import type { CrmTemplateAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import type { CrmTemplateInput, CrmTemplateResult } from '@/lib/crm/templateValidation'
import type { SendTestInput } from '@/app/actions/crm-template-test'
import type { MergeContext } from '@/lib/crm/merge'
import type { CustomFieldToken } from './MergeFieldInserter'

export type TemplateRow = CrmTemplateAdmin

export type TemplateActions = {
  create: (input: CrmTemplateInput) => Promise<CrmTemplateResult>
  update: (id: number, input: CrmTemplateInput) => Promise<CrmTemplateResult>
  setActive: (id: number, isActive: boolean) => Promise<CrmTemplateResult>
  remove: (id: number) => Promise<CrmTemplateResult>
  renameCategory: (oldName: string, newName: string, channel?: string) => Promise<CrmTemplateResult>
  moveToFolder: (ids: number[], category: string | null) => Promise<CrmTemplateResult>
  testSend: (input: SendTestInput) => Promise<CrmTemplateResult>
}

export type TemplatesShared = {
  actions: TemplateActions
  customFields: CustomFieldToken[]
  /** Real agent/sender/company context for the preview pane. */
  mergeContext: MergeContext
  /** slug → display name (edit-modal "Created ... by" metadata). */
  brokerNames: Record<string, string>
  actingSlug: string
  isSuperuser: boolean
}
