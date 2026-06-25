// @no-parity — internal admin surface, no public mockup contract
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import {
  createTemplateAction,
  updateTemplateAction,
  setTemplateActiveAction,
  deleteTemplateAction,
} from '@/app/actions/crm-templates'
import { SettingsSubpageShell } from '@/components/admin/crm/settings/SettingsSubpageShell'
import { TemplateEditor, type TemplateRow } from '@/components/admin/crm/settings/TemplateEditor'

export const metadata = { title: 'Templates | CRM settings' }
export const dynamic = 'force-dynamic'

export default async function CrmTemplatesSettingsPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const templates = await getCrmTemplatesAdmin()
  const rows: TemplateRow[] = templates.map((t) => ({
    id: t.id,
    key: t.key,
    channel: t.channel,
    name: t.name,
    subject: t.subject,
    body: t.body,
    category: t.category,
    isActive: t.isActive,
    usage: t.usage,
  }))

  return (
    <SettingsSubpageShell
      title="Email & SMS templates"
      description="The reusable copy the composer and sequence steps draw from. Edited copy runs the brand-voice gate. A template a sequence references cannot be deleted."
    >
      <TemplateEditor
        rows={rows}
        actions={{
          create: createTemplateAction,
          update: updateTemplateAction,
          setActive: setTemplateActiveAction,
          remove: deleteTemplateAction,
        }}
      />
    </SettingsSubpageShell>
  )
}
