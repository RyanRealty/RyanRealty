// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, listCrmInbox } from '@/app/actions/crm'
import { timelineEmailBody } from '@/lib/crm/email-body'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Inbox | CRM | Admin' }
export const dynamic = 'force-dynamic'

const KIND_LABEL: Record<string, string> = {
  email_in: '📥 Email', sms_in: '💬 Text', call: '📞 Call', voicemail: '🎙 Voicemail',
}

function fmt(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })
}

export default async function CrmInboxPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  const rows = await listCrmInbox(100)

  return (
    <main className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-6">
      <div className="mb-1 text-sm text-muted-foreground">
        <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground">← Back to CRM</Link>
      </div>
      <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Latest inbound communications across every contact. Gmail sync runs every 15 minutes; texts and voicemail join once Twilio is live.
      </p>

      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No inbound communications yet.</CardContent></Card>
        ) : (
          rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex items-start gap-3 px-3 py-3 sm:gap-4 sm:px-4">
                <div className="shrink-0 text-sm sm:w-24">{KIND_LABEL[r.kind] ?? r.kind}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/admin/crm/${r.person_id}`} className="text-sm font-medium text-foreground hover:underline">
                      {r.person?.name ?? `Contact #${r.person_id}`}
                    </Link>
                    <Badge variant="secondary" className="text-xs">{r.person?.stage}</Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">{fmt(r.ts)}</span>
                  </div>
                  {r.title ? <div className="mt-0.5 truncate text-sm text-foreground">{r.title}</div> : null}
                  {r.body ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{timelineEmailBody(r.body).slice(0, 300)}</p> : null}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </main>
  )
}
