// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import {
  updateCrmSequenceStepsAction,
  updateCrmSequenceSettingsAction,
} from '@/app/actions/crm-sequences'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import { getCrmTags } from '@/lib/data/crm/getCrmTags'
import { getCrmSequenceForEdit } from '@/lib/data/crm/getCrmSequenceForEdit'
import { getWorkflowStepAnalytics } from '@/lib/data/crm/getWorkflowAnalytics'
import { scopeBroker } from '@/lib/crm/scope'
import type { Step } from '@/lib/crm/sequence-step-schema'
import {
  StepBuilder,
  type TemplateOption,
  type TagOption,
  type StepFunnelRow,
} from '@/components/admin/crm/workflows/StepBuilder'

export const metadata = { title: 'Edit workflow | CRM | Admin' }
export const dynamic = 'force-dynamic'

export default async function CrmSequenceEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const broker = scopeBroker(access)

  const [seq, templates, tags, funnel] = await Promise.all([
    getCrmSequenceForEdit(id),
    getCrmTemplatesAdmin(),
    getCrmTags(),
    getWorkflowStepAnalytics(id, broker),
  ])

  if (!seq) notFound()

  // ── Server-action adapters bound to this sequence id ────────────────────────

  async function saveSteps(steps: Step[]) {
    'use server'
    return updateCrmSequenceStepsAction(id, steps)
  }

  async function saveSettings(input: { name: string; description: string | null; stopOnReply: boolean }) {
    'use server'
    return updateCrmSequenceSettingsAction({
      id,
      name: input.name,
      description: input.description,
      stopOnReply: input.stopOnReply,
    })
  }

  const templateOptions: TemplateOption[] = templates
    .filter((t) => t.isActive)
    .map((t) => ({ key: t.key, name: t.name, channel: t.channel }))

  const tagOptions: TagOption[] = tags
    .filter((t) => t.isActive && !t.isProtected)
    .map((t) => ({ key: t.key, label: t.label }))

  const funnelRows: StepFunnelRow[] = funnel.rows.map((r) => ({
    stepIndex: r.stepIndex,
    channel: r.channel,
    currentlyHere: r.currentlyHere,
    emailsSent: r.emailsSent,
  }))

  const initialSteps = (Array.isArray(seq.steps) ? seq.steps : []) as Step[]

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link
          href="/admin/crm/sequences"
          className="inline-flex min-h-10 items-center hover:text-foreground md:min-h-0"
        >
          Back to workflows
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Edit workflow</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Steps run in order. Each step waits its number of days before it fires. Saving validates every step against
        the engine, so a workflow can never save in a state that would stall a contact.
      </p>

      <div className="mt-6">
        <StepBuilder
          sequenceId={id}
          initialName={seq.name}
          initialDescription={seq.description ?? ''}
          initialStopOnReply={seq.stopOnReply}
          initialStatus={seq.status}
          initialSteps={initialSteps}
          templates={templateOptions}
          tags={tagOptions}
          funnel={funnelRows}
          funnelUnreadable={funnel.unreadable}
          actions={{ saveSteps, saveSettings }}
        />
      </div>
    </main>
  )
}
