// @no-parity — internal admin surface, no public mockup contract
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess, sendCrmSmsAction, sendCrmEmailAction } from '@/app/actions/crm'
import {
  setConversationStateAction,
  bulkConversationStateAction,
  markAllReadAction,
} from '@/app/actions/crm-inbox'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getInboxQueue,
  getConversationThread,
  type InboxScope,
  type ConversationStatus,
} from '@/lib/data/crm/getInboxQueue'
import { getSendTarget } from '@/lib/data/crm/getSendTarget'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { formatDateTime } from '@/lib/format/date'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConsoleSection } from '@/components/console/ConsoleSection'
import InboxQueue from '@/components/admin/crm/inbox/InboxQueue'
import InboxThread, { type FormattedThreadItem } from '@/components/admin/crm/inbox/InboxThread'
import InlineReply from '@/components/admin/crm/inbox/InlineReply'
import ThreadStatusControl from '@/components/admin/crm/inbox/ThreadStatusControl'

export const metadata = { title: 'Inbox | CRM | Admin' }
export const dynamic = 'force-dynamic'

const SCOPES: { key: InboxScope; label: string }[] = [
  { key: 'mine', label: 'Mine' },
  { key: 'unread', label: 'Unread' },
  { key: 'all', label: 'All' },
  { key: 'closed', label: 'Closed' },
]

function isScope(v: string | undefined): v is InboxScope {
  return v === 'mine' || v === 'unread' || v === 'all' || v === 'closed'
}

export default async function CrmInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; c?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope: InboxScope = isScope(sp.scope) ? sp.scope : 'mine'
  const brokerScope = scopeBroker(access)
  const openId = sp.c && Number.isFinite(Number(sp.c)) ? Number(sp.c) : null

  const { conversations, counts } = await getInboxQueue({ scope, brokerScope, limit: 100 })

  // ── Server actions bound for the client controls ──────────────────────────
  async function bulkTriage(
    personIds: number[],
    status: ConversationStatus,
  ): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await bulkConversationStateAction(personIds, status)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  async function markRead(): Promise<void> {
    'use server'
    await markAllReadAction()
  }

  // ── Open conversation pane ────────────────────────────────────────────────
  let openPane: {
    personId: number
    name: string
    status: ConversationStatus
    items: FormattedThreadItem[]
    canText: boolean
    canEmail: boolean
    signatureHtml: string | null
  } | null = null

  if (openId) {
    const sb = createServiceClient()
    const { data: person } = await sb
      .from('crm_people')
      .select('id,name,emails,assigned_broker')
      .eq('id', openId)
      .maybeSingle()
    if (person) {
      const [thread, target, stateRow] = await Promise.all([
        getConversationThread(openId, 100),
        getSendTarget(openId),
        sb.from('crm_conversation_state').select('status').eq('person_id', openId).maybeSingle(),
      ])
      const emails = (person.emails as Array<{ value?: string }> | null) ?? []
      const canEmail = emails.some((e) => Boolean(e.value))
      const canText = Boolean(target?.phone)
      const status: ConversationStatus =
        (stateRow.data?.status as ConversationStatus | undefined) ?? 'unread'
      // Signature mailbox follows the acting broker, defaulting to the first mailbox.
      const actingSlug = access.brokerSlug ?? (person.assigned_broker as string | null) ?? 'matt'
      const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]
      const signature = await getSignatureForMailbox(mailbox.email)
      openPane = {
        personId: openId,
        name: person.name ?? `Contact #${openId}`,
        status,
        items: thread.map((it) => ({ ...it, tsLabel: formatDateTime(it.ts) })),
        canText,
        canEmail,
        signatureHtml: signature?.html ?? null,
      }
    }
  }

  async function sendSmsForm(personId: number, formData: FormData): Promise<void> {
    'use server'
    formData.set('personId', String(personId))
    const r = await sendCrmSmsAction(formData)
    if (!r.ok) redirect(`/admin/crm/inbox?c=${personId}&error=${encodeURIComponent(r.error ?? 'Text not sent')}`)
    redirect(`/admin/crm/inbox?c=${personId}`)
  }
  async function sendEmailForm(personId: number, formData: FormData): Promise<void> {
    'use server'
    formData.set('personId', String(personId))
    const r = await sendCrmEmailAction(formData)
    if (!r.ok) redirect(`/admin/crm/inbox?c=${personId}&error=${encodeURIComponent(r.error ?? 'Email not sent')}`)
    redirect(`/admin/crm/inbox?c=${personId}`)
  }
  async function setStatusFor(
    personId: number,
    status: ConversationStatus,
  ): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await setConversationStateAction(personId, status)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-8 sm:px-6">

      {/*
        ── Mobile thread view (< md) ────────────────────────────────────────
        When a conversation is open, show ONLY the thread full-width on phones.
        A back-chevron row at the top navigates back to the list.
        Desktop keeps the side-by-side layout below via hidden md:hidden.
      */}
      {openPane ? (
        <div className="md:hidden">
          {/* Back row */}
          <Link
            href={`/admin/crm/inbox?scope=${scope}`}
            className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary active:opacity-70"
          >
            <span aria-hidden>‹</span> Inbox
          </Link>

          {/* Thread header */}
          <div className="mt-2 flex items-center justify-between gap-2">
            <h1 className="truncate text-lg font-bold text-foreground">
              <Link href={`/admin/crm/${openPane.personId}`} className="text-primary">
                {openPane.name}
              </Link>
            </h1>
            <ThreadStatusControl
              status={openPane.status}
              setStatusAction={setStatusFor.bind(null, openPane.personId)}
            />
          </div>

          {/* Thread messages */}
          <div className="mt-4">
            <InboxThread items={openPane.items} personName={openPane.name} />
          </div>

          {/* Reply composer */}
          <div className="mt-4 border-t border-border pt-4">
            <InlineReply
              smsAction={sendSmsForm.bind(null, openPane.personId)}
              emailAction={sendEmailForm.bind(null, openPane.personId)}
              signatureHtml={openPane.signatureHtml}
              canText={openPane.canText}
              canEmail={openPane.canEmail}
            />
          </div>
        </div>
      ) : (
        /* Mobile list view (< md) — no open conversation */
        <div className="md:hidden">
          <div className="mb-1 text-sm text-muted-foreground">
            <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground">
              Back to CRM
            </Link>
          </div>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
            <form action={markRead}>
              <Button type="submit" size="sm" variant="outline">
                Mark all read
              </Button>
            </form>
          </div>

          {/* Scope sub-tabs — underline style (scrollable row) */}
          <div className="-mx-3 mt-4 flex overflow-x-auto border-b border-border no-scrollbar">
            {SCOPES.map((s) => {
              const active = scope === s.key
              const count = counts[s.key]
              return (
                <Link
                  key={s.key}
                  href={`/admin/crm/inbox?scope=${s.key}`}
                  className="relative shrink-0 px-4 py-3 text-center text-sm font-medium transition-colors"
                  style={{ color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}
                >
                  {s.label}
                  {count > 0 ? (
                    <span className="ml-1 tabular-nums opacity-70">{count}</span>
                  ) : null}
                  {active ? (
                    <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />
                  ) : null}
                </Link>
              )
            })}
          </div>

          {/* Conversation list */}
          <div className="mt-0">
            <ConsoleSection title="">
              <InboxQueue
                conversations={conversations}
                activePersonId={openId}
                scope={scope}
                bulkAction={bulkTriage}
              />
            </ConsoleSection>
          </div>
        </div>
      )}

      {/*
        ── Desktop layout (≥ md) — unchanged side-by-side ───────────────────
      */}
      <div className="hidden md:block">
        <div className="mb-1 text-sm text-muted-foreground">
          <Link href="/admin/crm" className="inline-flex min-h-10 items-center hover:text-foreground">
            Back to CRM
          </Link>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inbox</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Triage every conversation. Reply inline, mark handled, or close. Texts and emails route through the
              suppression-checked send path.
            </p>
          </div>
          <form action={markRead}>
            <Button type="submit" size="sm" variant="outline" className="h-10 sm:h-9">
              Mark all read
            </Button>
          </form>
        </div>

        {/* Scope tabs */}
        <div className="mt-6 -mx-3 flex gap-2 overflow-x-auto no-scrollbar px-3 sm:mx-0 sm:px-0">
          {SCOPES.map((s) => {
            const count = counts[s.key]
            const active = scope === s.key
            return (
              <Button
                key={s.key}
                asChild
                size="sm"
                variant={active ? 'default' : 'outline'}
                className="h-10 shrink-0 gap-1.5 sm:h-9"
              >
                <Link href={`/admin/crm/inbox?scope=${s.key}${openId ? `&c=${openId}` : ''}`}>
                  {s.label}
                  <span className="tabular-nums opacity-80">{count}</span>
                </Link>
              </Button>
            )
          })}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <ConsoleSection title="Conversations">
              <InboxQueue
                conversations={conversations}
                activePersonId={openId}
                scope={scope}
                bulkAction={bulkTriage}
              />
            </ConsoleSection>
          </div>

          <div className="lg:col-span-3">
            {openPane ? (
              <Card>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      <Link href={`/admin/crm/${openPane.personId}`} className="text-primary hover:underline">
                        {openPane.name}
                      </Link>
                    </CardTitle>
                    <Link
                      href={`/admin/crm/inbox?scope=${scope}`}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Close pane
                    </Link>
                  </div>
                  <ThreadStatusControl
                    status={openPane.status}
                    setStatusAction={setStatusFor.bind(null, openPane.personId)}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  <InboxThread items={openPane.items} personName={openPane.name} />
                  <div className="border-t border-border pt-4">
                    <InlineReply
                      smsAction={sendSmsForm.bind(null, openPane.personId)}
                      emailAction={sendEmailForm.bind(null, openPane.personId)}
                      signatureHtml={openPane.signatureHtml}
                      canText={openPane.canText}
                      canEmail={openPane.canEmail}
                    />
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-16 text-center text-sm text-muted-foreground">
                  Pick a conversation to read the thread and reply.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
