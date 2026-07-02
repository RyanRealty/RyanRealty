/**
 * MobileBranch — the < md inbox surface (server component), split out of the
 * inbox page for the file-size budget. Renders the §26 FUB-iOS structure:
 *
 *   - open conversation → MobileThread (26-E email detail / 26-F/26-I SMS
 *     bubbles) as a full-screen pushed view, with the §27 compose + call +
 *     block + group-message surfaces wired to the page's bound actions.
 *   - otherwise → MobileInbox (26-A/B/C/D list) + the MobileComposeSheet FAB
 *     (26-J / §27 S1/S2).
 *
 * All server actions are BOUND IN THE PAGE (they close over the page's scope)
 * and passed through — this component adds no data access and no send paths.
 */

import AddPersonForm from '@/components/admin/crm/inbox/AddPersonForm'
import MobileInbox from './MobileInbox'
import type { MobileConvRow } from './MobileInboxRow'
import MobileThread, { type MobileThreadItem, type MobileThreadContext } from './MobileThread'
import MobileComposeSheet, { type ComposeTemplate } from './MobileComposeSheet'
import type { AiDraftKind } from '@/app/actions/crm-inbox'
import type { InboxFolderKey, InboxScopeKey } from '@/lib/data/crm/getInboxQueue'

type Result = { ok: boolean; error?: string }
type AiResult = { ok: true; draft: string } | { ok: false; error: string }

export type MobilePaneData = {
  personId: number
  name: string
  status: 'unread' | 'open' | 'handled' | 'closed'
  phone: string | null
  canText: boolean
  canEmail: boolean
  isUnknown: boolean
  signatureHtml: string | null
  lastEmailSubject: string | null
  mobileMode: 'email' | 'sms'
  mobileItems: MobileThreadItem[]
} & MobileThreadContext

export default function MobileBranch({
  pane,
  rows,
  scopeKey,
  folder,
  view,
  unreadTotal,
  brokerName,
  brokerHeadshotUrl,
  canAssign,
  brokers,
  smsAllowed,
  hrefBase,
  backHref,
  sendError,
  actingSignatureHtml,
  emailTemplates,
  smsTemplates,
  actions,
}: {
  pane: MobilePaneData | null
  rows: MobileConvRow[]
  scopeKey: InboxScopeKey
  folder: InboxFolderKey
  view: 'all' | 'unread'
  unreadTotal: number
  brokerName: string
  brokerHeadshotUrl: string | null
  canAssign: boolean
  brokers: Array<{ slug: string; name: string }>
  smsAllowed: boolean
  /** List URL for the current scope×folder — compose appends &c=<id>. */
  hrefBase: string
  backHref: string
  sendError: string | null
  actingSignatureHtml: string | null
  emailTemplates: ComposeTemplate[]
  smsTemplates: ComposeTemplate[]
  actions: {
    sendSmsForm: (formData: FormData) => Promise<void>
    sendEmailForm: (formData: FormData) => Promise<void>
    setStatusThread: (status: 'unread' | 'open' | 'handled' | 'closed') => Promise<Result>
    setStatusFor: (personId: number, status: 'unread' | 'open' | 'handled' | 'closed') => Promise<Result>
    assignFor: (personId: number, broker: string | null) => Promise<Result>
    blockPhoneFor: (phone: string) => Promise<Result>
    callContact: () => Promise<Result>
    aiDraftThread: (kind: AiDraftKind, customPrompt?: string) => Promise<AiResult>
    aiDraftFor: (personId: number, kind: AiDraftKind, customPrompt?: string) => Promise<AiResult>
    searchContactsFor: (q: string) => Promise<Array<{ id: number; name: string }>>
    composeSmsTo: (personId: number, formData: FormData) => Promise<Result>
    composeEmailTo: (personId: number, formData: FormData) => Promise<Result>
    addPersonFor: (firstName: string, lastName: string, email: string) => Promise<Result>
    searchExistingFor: (q: string) => Promise<Array<{ id: number; name: string | null; email: string | null; phone: string | null }>>
    linkExistingFor: (existingId: number) => Promise<Result>
  }
}) {
  if (pane) {
    return (
      <div className="md:hidden">
        <MobileThread
          personId={pane.personId}
          name={pane.name}
          mode={pane.mobileMode}
          status={pane.status}
          phone={pane.phone}
          canText={pane.canText}
          canEmail={pane.canEmail}
          smsAllowed={smsAllowed}
          items={pane.mobileItems}
          context={{
            stage: pane.stage,
            agentName: pane.agentName,
            source: pane.source,
            priceLabel: pane.priceLabel,
            timeframe: pane.timeframe,
            tags: pane.tags,
            lastCommunicationLabel: pane.lastCommunicationLabel,
          }}
          signatureHtml={pane.signatureHtml}
          lastEmailSubject={pane.lastEmailSubject}
          backHref={backHref}
          sendError={sendError}
          smsAction={actions.sendSmsForm}
          emailAction={actions.sendEmailForm}
          setStatusAction={actions.setStatusThread}
          blockAction={actions.blockPhoneFor}
          callAction={actions.callContact}
          aiDraftAction={actions.aiDraftThread}
          groupCompose={{
            hrefBase,
            smsAllowed,
            signatureHtml: actingSignatureHtml,
            emailTemplates,
            smsTemplates,
            searchAction: actions.searchContactsFor,
            sendSmsAction: actions.composeSmsTo,
            sendEmailAction: actions.composeEmailTo,
            aiDraftAction: actions.aiDraftFor,
          }}
          addPersonSlot={
            pane.isUnknown ? (
              <AddPersonForm
                phone={pane.phone}
                addAction={actions.addPersonFor}
                searchAction={actions.searchExistingFor}
                linkAction={actions.linkExistingFor}
              />
            ) : null
          }
        />
      </div>
    )
  }

  return (
    /* Full-bleed under the shell chrome: cancel the ConsoleShell main padding
       (px-4 pt-5 / sm:px-6 sm:pt-7) + the page's own px-3 py-6. */
    <div className="-mx-7 -mt-11 md:hidden sm:-mx-10 sm:-mt-[52px]">
      <MobileInbox
        rows={rows}
        scopeKey={scopeKey}
        folder={folder}
        view={view}
        unreadTotal={unreadTotal}
        brokerName={brokerName}
        brokerHeadshotUrl={brokerHeadshotUrl}
        canAssign={canAssign}
        brokers={brokers}
        setStatusAction={actions.setStatusFor}
        assignAction={actions.assignFor}
      />
      {/* §26-A FAB → §27 compose sheet (26-J / S1 / S2) */}
      <MobileComposeSheet
        hrefBase={hrefBase}
        smsAllowed={smsAllowed}
        signatureHtml={actingSignatureHtml}
        emailTemplates={emailTemplates}
        smsTemplates={smsTemplates}
        searchAction={actions.searchContactsFor}
        sendSmsAction={actions.composeSmsTo}
        sendEmailAction={actions.composeEmailTo}
        aiDraftAction={actions.aiDraftFor}
      />
    </div>
  )
}
