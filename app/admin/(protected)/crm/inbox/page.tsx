// @no-parity — internal admin surface, no public mockup contract
/**
 * CRM Inbox — the unified communications hub, rebuilt to spec §08 (FUB parity).
 *
 * Three-panel layout (spec §2): folder tree (My Inbox / Company × the five FUB
 * folders) | thread list (All/Unread + channel Filter + bulk select) | reading
 * pane (thread header w/ assignee + Close/Reopen, rich thread body, inline
 * reply compose, persistent note tray) + collapsible contact sidebar.
 *
 * Every send routes through the EXISTING suppression/quiet-hours-gated actions
 * (sendCrmSmsAction / sendCrmEmailAction) — this page never adds a send path.
 * Mobile (< md) is the §26 FUB-iOS inbox (MobileInbox list + MobileThread
 * pushed detail) with the §27 compose surfaces (MobileComposeSheet FAB, AI
 * pill strip, calling-method sheet) — same gated actions, phone-first layout.
 */
import { redirect } from 'next/navigation'
import {
  getCrmAccess,
  sendCrmSmsAction,
  sendCrmEmailAction,
  addCrmTagAction,
  addCrmNoteAction,
  getTwilioSmsStatus,
  startCrmCallAction,
} from '@/app/actions/crm'
import {
  setConversationStateAction,
  assignConversationAction,
  bulkConversationStateAction,
  saveDraftAction,
  discardDraftAction,
  addUnknownCallerPersonAction,
  aiSmsDraftAction,
  type AiDraftKind,
} from '@/app/actions/crm-inbox'
import { blockCrmNumber } from '@/app/actions/crm-block'
import { searchCrmContactsAction } from '@/app/actions/crm-tasks'
import { getCrmTemplatesAdmin } from '@/lib/data/crm/getCrmTemplatesAdmin'
import {
  searchPeopleForMergeAction,
  linkUnknownCallerToPersonAction,
} from '@/app/actions/crm-person-gaps'
import { scopeBroker } from '@/lib/crm/scope'
import {
  getInboxFolderQueue,
  type InboxScopeKey,
  type InboxFolderKey,
  type ConversationStatus,
} from '@/lib/data/crm/getInboxQueue'
import { getConversationThreadFull, getInboxContactCard } from '@/lib/data/crm/getInboxThread'
import { getDraftsForPerson } from '@/lib/data/crm/drafts'
import { getSendTarget } from '@/lib/data/crm/getSendTarget'
import { isUnknownCaller, cleanContactName } from '@/lib/crm/display-name'
import { createServiceClient } from '@/lib/supabase/service'
import { CRM_MAILBOXES } from '@/lib/crm/gmail'
import { CRM_BROKERS, CRM_BROKER_DISPLAY, type CrmBrokerSlug } from '@/lib/crm/constants'
import { getSignatureForMailbox } from '@/lib/crm/email-signature'
import { sendEmail } from '@/lib/resend'
import { formatDateTime } from '@/lib/format/date'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import InboxFolderRail from '@/components/admin/crm/inbox/InboxFolderRail'
import InboxThreadList, { type ThreadListRow } from '@/components/admin/crm/inbox/InboxThreadList'
import InboxThreadView, { type InboxThreadViewItem } from '@/components/admin/crm/inbox/InboxThreadView'
import ThreadHeader from '@/components/admin/crm/inbox/ThreadHeader'
import InlineReply from '@/components/admin/crm/inbox/InlineReply'
import NoteTray from '@/components/admin/crm/inbox/NoteTray'
import ContactSidebar, {
  type SidebarActivityItem,
  type SidebarRecentItem,
} from '@/components/admin/crm/inbox/ContactSidebar'
import AddPersonForm from '@/components/admin/crm/inbox/AddPersonForm'
import MobileBranch from '@/components/admin/crm/inbox/mobile/MobileBranch'
import type { MobileThreadItem } from '@/components/admin/crm/inbox/mobile/MobileThread'
import {
  BROKER_HEADSHOTS,
  buildMobileRows,
  buildMobileThreadItems,
  pickMobileMode,
  splitComposeTemplates,
} from '@/components/admin/crm/inbox/mobile/mobile-data'
import {
  inboxHref,
  isScopeKey,
  isFolderKey,
  mapLegacyScope,
  relativeLabel,
  FOLDER_TITLES,
} from '@/components/admin/crm/inbox/inbox-url'

export const metadata = { title: 'Inbox | CRM | Admin' }
export const dynamic = 'force-dynamic'

const BROKER_OPTIONS = CRM_BROKERS.map((slug) => ({
  slug,
  name: CRM_BROKER_DISPLAY[slug as CrmBrokerSlug] ?? slug,
}))

export default async function CrmInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; folder?: string; view?: string; c?: string; compose?: string; error?: string }>
}) {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')

  const sp = await searchParams
  const legacy = !isScopeKey(sp.scope) ? mapLegacyScope(sp.scope) : null
  const scopeKey: InboxScopeKey = isScopeKey(sp.scope) ? sp.scope : legacy?.scope ?? 'me'
  const folder: InboxFolderKey = isFolderKey(sp.folder) ? sp.folder : legacy?.folder ?? 'inbox'
  const view: 'all' | 'unread' = sp.view === 'unread' || legacy?.view === 'unread' ? 'unread' : 'all'
  const sendError = sp.error ? decodeURIComponent(sp.error) : null
  const startCompose = sp.compose === '1'
  const brokerScope = scopeBroker(access)
  const actingBroker = access.brokerSlug
  const canAssign = brokerScope === null
  const openId = sp.c && Number.isFinite(Number(sp.c)) ? Number(sp.c) : null
  const nowMs = Date.now()

  const [{ conversations, counts }, smsStatus, allTemplates] = await Promise.all([
    getInboxFolderQueue({ scopeKey, folder, view, brokerScope, actingBroker, limit: 100 }),
    getTwilioSmsStatus(),
    getCrmTemplatesAdmin(),
  ])
  const rows: ThreadListRow[] = conversations.map((c) => ({
    ...c,
    tsLabel: relativeLabel(c.lastMessageAt, nowMs),
  }))

  // ── Mobile (§26/§27) shared data ───────────────────────────────────────────
  const actingSlug0 = (actingBroker ?? 'matt') as CrmBrokerSlug
  const actingMailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug0) ?? CRM_MAILBOXES[0]
  const actingSignature = await getSignatureForMailbox(actingMailbox.email)
  const { emailTemplates, smsTemplates } = splitComposeTemplates(allTemplates, actingSlug0)
  const mobileRows = buildMobileRows(conversations, scopeKey, folder, view, nowMs)

  // ── Server actions bound for the client controls ──────────────────────────
  async function bulkTriage(personIds: number[], status: ConversationStatus): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await bulkConversationStateAction(personIds, status)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  async function bulkAssign(personIds: number[], broker: string): Promise<{ ok: boolean; error?: string }> {
    'use server'
    for (const id of personIds) {
      const res = await assignConversationAction(id, broker)
      if (!res.ok) return { ok: false, error: res.error }
    }
    return { ok: true }
  }
  // ── Open conversation pane ────────────────────────────────────────────────
  let openPane: {
    personId: number
    name: string
    status: ConversationStatus
    explicitAssignee: string | null
    items: InboxThreadViewItem[]
    canText: boolean
    canEmail: boolean
    signatureHtml: string | null
    isUnknown: boolean
    phone: string | null
    email: string | null
    stage: string
    agentName: string | null
    lenderName: string | null
    source: string | null
    priceLabel: string | null
    timeframe: string | null
    tags: string[]
    lastCommunicationLabel: string | null
    lastEmailSubject: string | null
    recent: SidebarRecentItem[]
    activity: SidebarActivityItem[]
    draftSmsBody: string
    hasTextDraft: boolean
    draftEmailSubject: string
    draftEmailBody: string
    hasEmailDraft: boolean
    /** §26 mobile thread presentation — email detail (26-E) vs SMS bubbles (26-I). */
    mobileMode: 'email' | 'sms'
    mobileItems: MobileThreadItem[]
  } | null = null

  if (openId) {
    const card = await getInboxContactCard(openId)
    if (card) {
      const sb = createServiceClient()
      const [thread, target, stateRow, drafts] = await Promise.all([
        getConversationThreadFull(openId, 100),
        getSendTarget(openId),
        sb.from('crm_conversation_state').select('status,assigned_broker').eq('person_id', openId).maybeSingle(),
        getDraftsForPerson(openId, actingBroker),
      ])
      const items: InboxThreadViewItem[] = thread.map((it) => ({ ...it, tsLabel: formatDateTime(it.ts) }))
      // §26 mobile thread — sanitized server-side in mobile-data.ts.
      const mobileItems: MobileThreadItem[] = buildMobileThreadItems(thread)
      const mobileMode = pickMobileMode(thread, Boolean(target?.phone))
      const status: ConversationStatus = (stateRow.data?.status as ConversationStatus | undefined) ?? 'unread'
      const actingSlug = access.brokerSlug ?? card.assignedBroker ?? 'matt'
      const mailbox = CRM_MAILBOXES.find((m) => m.slug === actingSlug) ?? CRM_MAILBOXES[0]
      const signature = await getSignatureForMailbox(mailbox.email)
      const messageItems = thread.filter((it) => it.category === 'message' || it.category === 'email' || it.category === 'call')
      const nonMessageItems = thread.filter((it) => !['message', 'email', 'call'].includes(it.category))
      openPane = {
        personId: openId,
        name: cleanContactName(card.name, openId),
        status,
        explicitAssignee: (stateRow.data?.assigned_broker as string | null) ?? null,
        items,
        canText: Boolean(target?.phone),
        canEmail: Boolean(card.email),
        signatureHtml: signature?.html ?? null,
        isUnknown: isUnknownCaller(card.name),
        phone: target?.phone || card.phone || null,
        email: card.email,
        stage: card.stage,
        agentName: card.assignedBroker
          ? CRM_BROKER_DISPLAY[card.assignedBroker as CrmBrokerSlug] ?? card.assignedBroker
          : null,
        lenderName: card.lenderName,
        source: card.source,
        priceLabel: card.price != null ? `$${Math.round(card.price).toLocaleString('en-US')}` : null,
        timeframe: card.timeframe,
        tags: card.tags,
        lastCommunicationLabel: messageItems[0] ? relativeLabel(messageItems[0].ts, nowMs) : null,
        lastEmailSubject: thread.find((it) => it.category === 'email' && it.subject)?.subject ?? null,
        recent: messageItems.slice(0, 3).map((it) => ({
          id: it.id,
          label: it.label,
          tsLabel: relativeLabel(it.ts, nowMs),
          snippet: it.snippet,
        })),
        activity: nonMessageItems.slice(0, 5).map((it) => ({
          id: it.id,
          label: it.label,
          tsLabel: relativeLabel(it.ts, nowMs),
        })),
        draftSmsBody: drafts.text?.body ?? '',
        hasTextDraft: Boolean(drafts.text),
        draftEmailSubject: drafts.email?.subject ?? '',
        draftEmailBody: drafts.email?.body ?? '',
        hasEmailDraft: Boolean(drafts.email),
        mobileMode,
        mobileItems,
      }
    }
  }

  const backHref = inboxHref({ scope: scopeKey, folder, view })

  async function sendSmsForm(personId: number, formData: FormData): Promise<void> {
    'use server'
    formData.set('personId', String(personId))
    const r = await sendCrmSmsAction(formData)
    if (!r.ok) redirect(`${backHref}&c=${personId}&error=${encodeURIComponent(r.error ?? 'Text not sent')}`)
    await discardDraftAction(personId, 'text')
    redirect(`${backHref}&c=${personId}`)
  }
  async function sendEmailForm(personId: number, formData: FormData): Promise<void> {
    'use server'
    formData.set('personId', String(personId))
    const r = await sendCrmEmailAction(formData)
    if (!r.ok) redirect(`${backHref}&c=${personId}&error=${encodeURIComponent(r.error ?? 'Email not sent')}`)
    await discardDraftAction(personId, 'email')
    redirect(`${backHref}&c=${personId}`)
  }
  // "Send and Close" compound actions (AC-16): send via the SAME gated path,
  // then move the conversation to Closed. Never a new send path.
  async function sendSmsAndCloseForm(personId: number, formData: FormData): Promise<void> {
    'use server'
    formData.set('personId', String(personId))
    const r = await sendCrmSmsAction(formData)
    if (!r.ok) redirect(`${backHref}&c=${personId}&error=${encodeURIComponent(r.error ?? 'Text not sent')}`)
    await discardDraftAction(personId, 'text')
    await setConversationStateAction(personId, 'closed')
    redirect(backHref)
  }
  async function sendEmailAndCloseForm(personId: number, formData: FormData): Promise<void> {
    'use server'
    formData.set('personId', String(personId))
    const r = await sendCrmEmailAction(formData)
    if (!r.ok) redirect(`${backHref}&c=${personId}&error=${encodeURIComponent(r.error ?? 'Email not sent')}`)
    await discardDraftAction(personId, 'email')
    await setConversationStateAction(personId, 'closed')
    redirect(backHref)
  }
  async function saveDraftForm(personId: number, channel: 'text' | 'email', formData: FormData): Promise<void> {
    'use server'
    const r = await saveDraftAction(personId, channel, formData)
    if (!r.ok) redirect(`${backHref}&c=${personId}&error=${encodeURIComponent(r.error ?? 'Draft not saved')}`)
    redirect(`${backHref}&c=${personId}`)
  }
  async function discardDraftFor(personId: number, channel: 'text' | 'email'): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await discardDraftAction(personId, channel)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  async function addPersonFor(
    personId: number,
    firstName: string,
    lastName: string,
    email: string,
  ): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await addUnknownCallerPersonAction(personId, firstName, lastName, email)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  async function searchExistingFor(
    personId: number,
    query: string,
  ): Promise<Array<{ id: number; name: string | null; email: string | null; phone: string | null }>> {
    'use server'
    const hits = await searchPeopleForMergeAction(query, personId)
    return hits.map((h) => ({ id: h.id, name: h.name, email: h.email, phone: h.phone }))
  }
  async function linkExistingFor(personId: number, existingId: number): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await linkUnknownCallerToPersonAction(existingId, personId)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  async function setStatusFor(personId: number, status: ConversationStatus): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await setConversationStateAction(personId, status)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  // ── §26/§27 mobile-bound actions (same gated send paths, result-returning) ──
  async function composeSmsTo(personId: number, formData: FormData): Promise<{ ok: boolean; error?: string }> {
    'use server'
    formData.set('personId', String(personId))
    const r = await sendCrmSmsAction(formData)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function composeEmailTo(personId: number, formData: FormData): Promise<{ ok: boolean; error?: string }> {
    'use server'
    formData.set('personId', String(personId))
    const r = await sendCrmEmailAction(formData)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function searchContactsFor(q: string): Promise<Array<{ id: number; name: string }>> {
    'use server'
    const res = await searchCrmContactsAction(q)
    return res.ok ? res.results : []
  }
  async function callContact(personId: number): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const fd = new FormData()
    fd.set('personId', String(personId))
    const r = await startCrmCallAction(fd)
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function blockPhoneFor(phone: string): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const r = await blockCrmNumber(phone, { reason: 'manual', note: 'Blocked from the mobile inbox' })
    return r.ok ? { ok: true } : { ok: false, error: r.error }
  }
  async function aiDraftFor(
    personId: number,
    kind: AiDraftKind,
    customPrompt?: string,
  ): Promise<{ ok: true; draft: string } | { ok: false; error: string }> {
    'use server'
    return aiSmsDraftAction(personId, kind, customPrompt)
  }
  async function assignFor(personId: number, broker: string | null): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const res = await assignConversationAction(personId, broker)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  async function addTagFor(personId: number, tag: string): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const fd = new FormData()
    fd.set('personId', String(personId))
    fd.set('tag', tag)
    const res = await addCrmTagAction(fd)
    return res.ok ? { ok: true } : { ok: false, error: res.error }
  }
  async function createNoteFor(
    personId: number,
    personName: string,
    body: string,
    mentions: string[],
  ): Promise<{ ok: boolean; error?: string }> {
    'use server'
    const fd = new FormData()
    fd.set('personId', String(personId))
    fd.set('body', body)
    const res = await addCrmNoteAction(fd)
    if (!res.ok) return { ok: false, error: res.error }
    // @mention → email notification to the mentioned agent (spec §10.2).
    // Internal broker notification, best-effort — the note itself already saved.
    const author = access?.brokerSlug ? CRM_BROKER_DISPLAY[access.brokerSlug as CrmBrokerSlug] ?? access.brokerSlug : 'A teammate'
    for (const slug of mentions) {
      const mb = CRM_MAILBOXES.find((m) => m.slug === slug)
      if (!mb || slug === access?.brokerSlug) continue
      await sendEmail({
        to: mb.email,
        subject: `${author} mentioned you on ${personName}`,
        html: `<p>${author} mentioned you in a note on <a href="https://ryan-realty.com/admin/crm/${personId}">${personName}</a>:</p><blockquote>${body.replace(/</g, '&lt;')}</blockquote>`,
      })
    }
    return { ok: true }
  }

  // ── Reading pane assembly (shared by desktop pane 3) ──────────────────────
  const assigneeLabel = openPane
    ? openPane.explicitAssignee === actingBroker
      ? 'Me'
      : openPane.explicitAssignee
        ? CRM_BROKER_DISPLAY[openPane.explicitAssignee as CrmBrokerSlug] ?? openPane.explicitAssignee
        : 'Company'
    : 'Company'

  const readingPane = openPane ? (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <ThreadHeader
        personId={openPane.personId}
        name={openPane.name}
        status={openPane.status}
        assigneeLabel={assigneeLabel}
        canAssign={canAssign}
        brokers={BROKER_OPTIONS}
        setStatusAction={setStatusFor.bind(null, openPane.personId)}
        assignAction={assignFor.bind(null, openPane.personId)}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <InboxThreadView items={openPane.items} personName={openPane.name} />
      </div>
      <div className="border-t border-border px-4 py-3">
        {sendError ? (
          <Alert variant="destructive" className="mb-3">
            <AlertDescription>{sendError}</AlertDescription>
          </Alert>
        ) : null}
        <InlineReply
          smsAction={sendSmsForm.bind(null, openPane.personId)}
          emailAction={sendEmailForm.bind(null, openPane.personId)}
          smsAndCloseAction={sendSmsAndCloseForm.bind(null, openPane.personId)}
          emailAndCloseAction={sendEmailAndCloseForm.bind(null, openPane.personId)}
          signatureHtml={openPane.signatureHtml}
          canText={openPane.canText}
          canEmail={openPane.canEmail}
          smsAllowed={smsStatus.canSend}
          initialSmsBody={openPane.draftSmsBody}
          initialEmailSubject={openPane.draftEmailSubject}
          initialEmailBody={openPane.draftEmailBody}
          hasTextDraft={openPane.hasTextDraft}
          hasEmailDraft={openPane.hasEmailDraft}
          saveSmsDraftAction={saveDraftForm.bind(null, openPane.personId, 'text')}
          saveEmailDraftAction={saveDraftForm.bind(null, openPane.personId, 'email')}
          discardDraftAction={discardDraftFor.bind(null, openPane.personId)}
          addTagAction={addTagFor.bind(null, openPane.personId)}
          lastEmailSubject={openPane.lastEmailSubject}
          startOpen={startCompose}
        />
      </div>
      {/* Persistent note tray (AC-17) */}
      <NoteTray
        brokers={BROKER_OPTIONS}
        createNoteAction={createNoteFor.bind(null, openPane.personId, openPane.name)}
      />
    </div>
  ) : (
    <div className="flex min-w-0 flex-1 items-center justify-center py-24 text-sm text-muted-foreground">
      Select a conversation to read the thread and reply.
    </div>
  )

  const contactSidebar = openPane ? (
    <ContactSidebar
      personId={openPane.personId}
      name={openPane.name}
      lastCommunicationLabel={openPane.lastCommunicationLabel}
      stage={openPane.stage}
      agentName={openPane.agentName}
      lenderName={openPane.lenderName}
      phone={openPane.phone}
      email={openPane.email}
      source={openPane.source}
      priceLabel={openPane.priceLabel}
      timeframe={openPane.timeframe}
      tags={openPane.tags}
      recent={openPane.recent}
      activity={openPane.activity}
    >
      {openPane.isUnknown ? (
        <AddPersonForm
          phone={openPane.phone}
          addAction={addPersonFor.bind(null, openPane.personId)}
          searchAction={searchExistingFor.bind(null, openPane.personId)}
          linkAction={linkExistingFor.bind(null, openPane.personId)}
        />
      ) : null}
    </ContactSidebar>
  ) : null

  return (
    <main className="mx-auto w-full px-3 py-6 sm:px-4">
      {/*
        ── Mobile (< md): §26 FUB-iOS inbox (MobileBranch → MobileInbox list /
           MobileThread pushed detail / MobileComposeSheet FAB, §27). ──
      */}
      <MobileBranch
        pane={openPane}
        rows={mobileRows}
        scopeKey={scopeKey}
        folder={folder === 'drafts' ? 'inbox' : folder}
        view={view}
        unreadTotal={counts.unreadTotal}
        brokerName={CRM_BROKER_DISPLAY[actingSlug0] ?? actingSlug0}
        brokerHeadshotUrl={BROKER_HEADSHOTS[actingSlug0] ?? null}
        canAssign={canAssign}
        brokers={BROKER_OPTIONS}
        smsAllowed={smsStatus.canSend}
        hrefBase={inboxHref({ scope: scopeKey, folder: folder === 'drafts' ? 'inbox' : folder, view })}
        backHref={backHref}
        sendError={sendError}
        actingSignatureHtml={actingSignature?.html ?? null}
        emailTemplates={emailTemplates}
        smsTemplates={smsTemplates}
        actions={{
          sendSmsForm: sendSmsForm.bind(null, openPane?.personId ?? 0),
          sendEmailForm: sendEmailForm.bind(null, openPane?.personId ?? 0),
          setStatusThread: setStatusFor.bind(null, openPane?.personId ?? 0),
          setStatusFor,
          assignFor,
          blockPhoneFor,
          callContact: callContact.bind(null, openPane?.personId ?? 0),
          aiDraftThread: aiDraftFor.bind(null, openPane?.personId ?? 0),
          aiDraftFor,
          searchContactsFor,
          composeSmsTo,
          composeEmailTo,
          addPersonFor: addPersonFor.bind(null, openPane?.personId ?? 0),
          searchExistingFor: searchExistingFor.bind(null, openPane?.personId ?? 0),
          linkExistingFor: linkExistingFor.bind(null, openPane?.personId ?? 0),
        }}
      />

      {/*
        ── Desktop (≥ md): FUB three-panel layout (spec §2) ──
        folder tree (~15%) | thread list (~28%) | reading pane + contact sidebar
      */}
      <div className="hidden md:block">
        <div className="grid h-[calc(100vh-8.5rem)] grid-cols-[210px_minmax(280px,340px)_minmax(0,1fr)] divide-x divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Pane 1: folder tree */}
          <InboxFolderRail
            activeScope={scopeKey}
            activeFolder={folder}
            view={view}
            meCounts={counts.me}
            companyCounts={counts.company}
            unreadTotal={counts.unreadTotal}
          />

          {/* Pane 2: thread list */}
          <div className="flex min-h-0 flex-col">
            <div className="border-b border-border px-3 py-2">
              <h1 className="text-sm font-semibold text-foreground">
                {scopeKey === 'me' ? 'My Inbox' : 'Company'} · {FOLDER_TITLES[folder]}
              </h1>
              <p className="text-xs text-muted-foreground tabular-nums">
                {counts[scopeKey === 'me' ? 'me' : 'company'][folder]}{' '}
                {folder === 'drafts' ? 'drafts' : 'conversations'}
              </p>
            </div>
            <InboxThreadList
              conversations={rows}
              activePersonId={openId}
              scopeKey={scopeKey}
              folder={folder}
              view={view}
              canAssign={canAssign}
              brokers={BROKER_OPTIONS}
              bulkAction={bulkTriage}
              bulkAssignAction={bulkAssign}
            />
          </div>

          {/* Pane 3: reading pane + contact sidebar */}
          <div className="flex min-h-0 min-w-0">
            {readingPane}
            {contactSidebar}
          </div>
        </div>
      </div>
    </main>
  )
}
