// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, listCrmConversations } from '@/app/actions/crm'
import { timelineEmailBody } from '@/lib/crm/email-body'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import InboxSegments, { type InboxItem } from '@/components/admin/InboxSegments'

export const metadata = { title: 'Inbox | CRM | Admin' }
export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  email_in: '📥 Email', sms_in: '💬 Text', call: '📞 Call', voicemail: '🎙 Voicemail',
  email_out: '📤 Email', sms_out: '📲 Text',
}

export default async function CrmInboxPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const rows = await listCrmConversations(150)
  const slug = access.brokerSlug

  // Shape each row for the client segments view (body trimmed server-side so the
  // client never imports the email-body util).
  const disp = (r: (typeof rows)[number]): InboxItem => ({
    id: r.id,
    personId: r.person_id,
    name: r.person?.name ?? `Contact #${r.person_id}`,
    stage: r.person?.stage ?? '',
    kind: r.kind,
    kindLabel: KIND_LABEL[r.kind] ?? r.kind,
    title: r.title,
    preview: r.body ? timelineEmailBody(r.body).slice(0, 300) : null,
    ts: r.ts,
  })
  const inbox = rows.filter((r) => r.direction === 'in').map(disp)
  // Assigned = inbound for the acting broker; a pure superuser (no slug) sees
  // every assigned conversation.
  const assigned = rows
    .filter((r) => r.direction === 'in' && (slug ? r.assignedBroker === slug : r.assignedBroker != null))
    .map(disp)
  const sent = rows.filter((r) => r.direction === 'out').map(disp)

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-6">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground">← Back to CRM</Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Conversations across every contact. Gmail sync runs every 15 minutes; texts and voicemail join once Twilio is live.
      </p>

      <ConsoleSection title="Conversations" className="mt-6">
        <InboxSegments inbox={inbox} assigned={assigned} sent={sent} />
      </ConsoleSection>
    </div>
  )
}
