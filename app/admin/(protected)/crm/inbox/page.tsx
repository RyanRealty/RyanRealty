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
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  searchParams: Promise<{ scope?: string; c?: string; error?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const scope: InboxScope = isScope(sp.scope) ? sp.scope : 'mine'
  const sendError = sp.error ? decodeURIComponent(sp.error) : null
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
            {sendError ? (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription>{sendError}</AlertDescription>
              </Alert>
            ) : null}
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
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-foreground">Inbox</h1>
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
        ── Desktop layout (≥ md) — FUB 4-pane: folders rail | list | reading pane | context ──
      */}
      <div className="hidden md:block">

        {/* ── Top bar: breadcrumb + mark-all-read ── */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link href="/admin/crm" className="inline-flex min-h-10 items-center text-sm text-muted-foreground hover:text-foreground">
            ← CRM
          </Link>
          <form action={markRead}>
            <Button type="submit" size="sm" variant="outline">
              Mark all read
            </Button>
          </form>
        </div>

        {/*
          4-pane grid — base grid-cols-1 (stacks on md); lg upgrades to the 4-column template.
          Column widths: folders-rail(180px) | list(1fr) | reading(1.5fr) | context(240px)
        */}
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[180px_minmax(0,1fr)_minmax(0,1.5fr)_240px] lg:divide-x lg:divide-border lg:rounded-xl lg:border lg:border-border lg:bg-card lg:shadow-sm">

          {/* ── Pane 1: Folders rail ── */}
          <nav className="hidden lg:flex lg:flex-col lg:py-4" aria-label="Inbox folders">
            {/* Section label */}
            <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              My Inbox
            </div>

            {/* Scope items */}
            {SCOPES.map((s) => {
              const count = counts[s.key]
              const active = scope === s.key
              return (
                <Link
                  key={s.key}
                  href={`/admin/crm/inbox?scope=${s.key}${openId ? `&c=${openId}` : ''}`}
                  className={`flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-accent font-semibold text-accent-foreground'
                      : 'text-foreground hover:bg-accent/40 hover:text-foreground'
                  }`}
                >
                  <span>{s.label}</span>
                  {count > 0 ? (
                    <span className="tabular-nums text-xs text-muted-foreground">{count}</span>
                  ) : null}
                </Link>
              )
            })}

            {/* Divider + Company */}
            <div className="mx-4 my-3 border-t border-border" />
            <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Company
            </div>
            <Link
              href={`/admin/crm/inbox?scope=all${openId ? `&c=${openId}` : ''}`}
              className="flex items-center justify-between px-4 py-2 text-sm text-foreground hover:bg-accent/40"
            >
              <span>All brokers</span>
              <span className="tabular-nums text-xs text-muted-foreground">{counts.all}</span>
            </Link>

            {/* Manage link at bottom */}
            <div className="mt-auto px-4 pt-4">
              <Link
                href="/admin/crm"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Manage →
              </Link>
            </div>
          </nav>

          {/* ── Pane 2: Conversation list ── */}
          <div className="lg:overflow-y-auto lg:py-3">
            {/* List header */}
            <div className="px-3 pb-2 pt-1">
              <h1 className="text-sm font-semibold text-foreground">
                {SCOPES.find((s) => s.key === scope)?.label ?? 'Inbox'}
              </h1>
              {counts[scope] > 0 ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {counts[scope]} unread
                </p>
              ) : null}
            </div>
            <ConsoleSection title="">
              <InboxQueue
                conversations={conversations}
                activePersonId={openId}
                scope={scope}
                bulkAction={bulkTriage}
              />
            </ConsoleSection>
          </div>

          {/* ── Pane 3: Reading pane ── */}
          <div className="lg:flex lg:flex-col lg:overflow-hidden">
            {openPane ? (
              <div className="flex h-full flex-col">
                {/* Thread header */}
                <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-sm font-semibold text-foreground">
                      <Link href={`/admin/crm/${openPane.personId}`} className="text-primary hover:underline">
                        {openPane.name}
                      </Link>
                    </h2>
                    <Link
                      href={`/admin/crm/inbox?scope=${scope}`}
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Close
                    </Link>
                  </div>
                  <ThreadStatusControl
                    status={openPane.status}
                    setStatusAction={setStatusFor.bind(null, openPane.personId)}
                  />
                </div>

                {/* Thread messages — scrollable */}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                  <InboxThread items={openPane.items} personName={openPane.name} />
                </div>

                {/* Reply composer pinned to bottom */}
                <div className="border-t border-border px-4 py-3">
                  {sendError ? (
                    <Alert variant="destructive" className="mb-3">
                      <AlertDescription>{sendError}</AlertDescription>
                    </Alert>
                  ) : null}
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
              <div className="flex h-full items-center justify-center py-24 text-sm text-muted-foreground">
                Select a conversation to read the thread and reply.
              </div>
            )}
          </div>

          {/* ── Pane 4: Contact context panel ── */}
          <div className="hidden lg:block lg:overflow-y-auto lg:py-4">
            {openPane ? (
              <div className="space-y-4 px-4">
                {/* Contact mini-card */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contact
                  </div>
                  <div className="mt-2">
                    <Link
                      href={`/admin/crm/${openPane.personId}`}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      {openPane.name}
                    </Link>
                  </div>
                  {openPane.items.length > 0 ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Last message: {openPane.items[0].tsLabel}
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-border" />

                {/* Channels available */}
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Channels
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className={openPane.canText ? 'text-foreground' : 'text-muted-foreground'}>
                        Text{openPane.canText ? '' : ' — no phone'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={openPane.canEmail ? 'text-foreground' : 'text-muted-foreground'}>
                        Email{openPane.canEmail ? '' : ' — no address'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Quick link to full record */}
                <div>
                  <Link
                    href={`/admin/crm/${openPane.personId}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Open full contact record →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="px-4 py-6 text-xs text-muted-foreground">
                Select a conversation to see contact details.
              </div>
            )}
          </div>

        </div>
      </div>
    </main>
  )
}
