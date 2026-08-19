'use client'

/**
 * MobileComposeSheet — the §26-J compose-new-message sheet + §27 S1/S2 mobile
 * compose surfaces, opened from the inbox FAB (or controlled, e.g. the SMS
 * thread kebab's "Start a group message").
 *
 *   1. Select Recipients (S2): token pills + live crm_people search. SMS
 *      supports group texts (2+ recipients → ONE Twilio Conversations group
 *      thread via the existing recipientIds path; capped at 10, AC-26H-06).
 *   2. Channel segmented control: Email | Text (26-J).
 *   3. Text: §27 S3 AI pill strip + template picker + the CRM compose bar
 *      (attach/template · "Text message · SMS" input · circular send) with the
 *      quiet-hours override + character counter.
 *   4. Email (S1): template selector ("Blank email" ⇅), then the shared
 *      EmailComposer (To row, subject, preview-what-sends/edit, merge fields,
 *      signature note).
 *
 * Every send calls the pre-bound suppression-gated server actions — this sheet
 * never adds a send path. AI drafts only fill the editable input.
 */

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronsUpDown, Pencil, X } from 'lucide-react'
import { Button, FilterChip, IconButton, SearchField, Sheet } from '@/components/admin/v2'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import MobileAiPills from './MobileAiPills'
import type { AiDraftKind } from '@/app/actions/crm-inbox'

export type ComposeTemplate = { key: string; name: string; subject: string | null; body: string }
export type ComposeRecipient = { id: number; name: string }

type SendResult = { ok: boolean; error?: string }

const GROUP_LIMIT = 10

/**
 * Contact-search-hit avatar — initials on a token-driven fill. The one
 * CrmAvatar usage in this file traded for a local render so the file carries
 * no legacy components/admin import beyond the two G50 compose chokepoints
 * (SmsComposer/EmailComposer — sanctioned, see the send-path notes below).
 */
function SearchHitAvatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials =
    parts.length === 0 ? '?' : parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: 32,
        height: 32,
        background: 'var(--a-btn-bg)',
        color: 'var(--a-btn-fg)',
        fontSize: 'var(--a-text-xs)',
        fontWeight: 600,
      }}
    >
      {initials}
    </span>
  )
}

/**
 * Bottom sheet — native <dialog> mechanics (focus trap, Esc via the platform
 * `cancel` event, top-layer stacking), the same pattern the admin v2 Dialog
 * primitive uses, styled here as a slide-to-bottom sheet instead of Dialog's
 * centered card. There is no av2 bottom-sheet primitive yet, and this whole
 * file's job is the phone-native sheet feel (CrmMobileKit directive, Matt
 * 2026-06-26) — Dialog's fixed-width centered modal would regress that, so
 * this stays a local, unexported helper instead of forcing the wrong one.
 */

export default function MobileComposeSheet({
  trigger = 'fab',
  open: openProp,
  onOpenChange,
  initialRecipients = [],
  initialChannel = 'text',
  hrefBase,
  smsAllowed,
  signatureHtml,
  emailTemplates,
  smsTemplates,
  searchAction,
  sendSmsAction,
  sendEmailAction,
  aiDraftAction,
  renderTemplateAction,
}: {
  /** 'fab' renders the fixed § 26-A FAB; 'controlled' relies on open/onOpenChange. */
  trigger?: 'fab' | 'controlled'
  open?: boolean
  onOpenChange?: (open: boolean) => void
  initialRecipients?: ComposeRecipient[]
  initialChannel?: 'email' | 'text'
  /** e.g. /admin/crm/inbox?scope=me&folder=inbox — the sheet appends &c=<id> after a send. */
  hrefBase: string
  smsAllowed: boolean
  signatureHtml: string | null
  emailTemplates: ComposeTemplate[]
  smsTemplates: ComposeTemplate[]
  searchAction: (q: string) => Promise<ComposeRecipient[]>
  sendSmsAction: (personId: number, formData: FormData) => Promise<SendResult>
  sendEmailAction: (personId: number, formData: FormData) => Promise<SendResult>
  aiDraftAction: (personId: number, kind: AiDraftKind, customPrompt?: string) => Promise<{ ok: true; draft: string } | { ok: false; error: string }>
  /** Server-renders an SMS template for the primary recipient (merge tokens
   *  resolved before they hit the input — 2026-07-02 mobile audit). Optional:
   *  without it the raw body inserts and the unresolved warning still fires. */
  renderTemplateAction?: (
    personId: number,
    body: string,
  ) => Promise<{ ok: true; body: string; unresolved: string[] } | { ok: false; error: string }>
}) {
  const router = useRouter()
  const [openLocal, setOpenLocal] = useState(false)
  const open = openProp ?? openLocal
  const setOpen = onOpenChange ?? setOpenLocal

  const [recipients, setRecipients] = useState<ComposeRecipient[]>(initialRecipients)
  const [channel, setChannel] = useState<'email' | 'text'>(initialChannel)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<ComposeRecipient[]>([])
  // SMS body is injected into the canonical SmsComposer via key-remount
  // (initialBody + version bump) — same pattern as MobileThread's AI drafts.
  const [smsBody, setSmsBody] = useState('')
  const [smsBodyV, setSmsBodyV] = useState(0)
  const [tplOpen, setTplOpen] = useState(false)
  const [emailTpl, setEmailTpl] = useState<ComposeTemplate | null>(null)
  const [emailKey, setEmailKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const primary = recipients[0] ?? null

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (q.trim().length < 2) {
      setHits([])
      return
    }
    timer.current = setTimeout(async () => {
      const res = await searchAction(q.trim())
      setHits(res.filter((h) => !recipients.some((r) => r.id === h.id)))
    }, 250)
  }, [q, searchAction, recipients])

  function reset() {
    setRecipients(initialRecipients)
    setQ('')
    setHits([])
    setSmsBody('')
    setSmsBodyV((v) => v + 1)
    setError(null)
    setEmailTpl(null)
  }

  function finish(personId: number) {
    setOpen(false)
    reset()
    router.push(`${hrefBase}&c=${personId}`)
  }

  /** The canonical SmsComposer posts its FormData here — the sheet only layers
   *  in its picked group recipients before handing off to the gated action. */
  async function sendSmsFromComposer(fd: FormData) {
    if (!primary) return
    setError(null)
    if (recipients.length > 1) fd.set('recipientIds', recipients.slice(1).map((r) => r.id).join(','))
    const res = await sendSmsAction(primary.id, fd)
    if (res.ok) finish(primary.id)
    else setError(res.error ?? 'Text not sent')
  }

  const templates = channel === 'email' ? emailTemplates : smsTemplates

  return (
    <>
      {trigger === 'fab' ? (
        <IconButton
          label="Compose new message"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-40 rounded-full md:hidden [[data-kb-open]_&]:hidden"
          style={{
            width: 56,
            height: 56,
            background: 'var(--a-btn-bg)',
            color: 'var(--a-btn-fg)',
            boxShadow: 'var(--a-shadow-overlay)',
          }}
        >
          <Pencil className="h-6 w-6" aria-hidden />
        </IconButton>
      ) : null}

      <Sheet
        open={open}
        onClose={() => {
          setOpen(false)
          reset()
        }}
        title={primary ? 'New message' : 'Select Recipients'}
      >
        {/* To: recipient token row (S2) */}
        <div
          className="mt-3 flex flex-wrap items-center gap-1.5 pb-2"
          style={{ borderBottom: '1px solid var(--a-border)' }}
        >
          <span style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text-2)' }}>To:</span>
          {recipients.map((r) => (
            <Button
              key={r.id}
              variant="quiet"
              onClick={() => setRecipients((prev) => prev.filter((p) => p.id !== r.id))}
              style={{
                height: 32,
                minHeight: 0,
                gap: 4,
                borderRadius: 9999,
                padding: '0 12px',
                border: '1.5px solid var(--a-border)',
                fontSize: 'var(--a-text-md)',
                fontWeight: 500,
                color: 'var(--a-accent)',
                background: 'none',
              }}
            >
              {r.name}
              <X className="h-3 w-3" aria-hidden />
            </Button>
          ))}
          <SearchField
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={recipients.length === 0 ? 'Search contacts' : ''}
            aria-label="Search contacts"
            className="flex-1"
            style={{
              height: 32,
              minHeight: 0,
              minWidth: 112,
              maxWidth: 'none',
              padding: '0 4px',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              borderRadius: 0,
              color: 'var(--a-text)',
              fontFamily: 'var(--a-font)',
              fontSize: 'var(--a-text-md)',
            }}
          />
        </div>

        {/* Contact search results */}
        {hits.length > 0 ? (
          <div>
            {hits.slice(0, 8).map((h, idx) => (
              <Button
                key={h.id}
                variant="quiet"
                onClick={() => {
                  if (channel === 'text' && recipients.length >= GROUP_LIMIT) {
                    setError('Group texts support up to 10 participants')
                    return
                  }
                  setRecipients((prev) => [...prev, h])
                  setQ('')
                  setHits([])
                }}
                className="w-full"
                style={{
                  justifyContent: 'flex-start',
                  gap: 12,
                  minHeight: 0,
                  borderRadius: 0,
                  padding: '10px 0',
                  fontWeight: 400,
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  borderTop: idx === 0 ? 'none' : '1px solid var(--a-border)',
                }}
              >
                <SearchHitAvatar name={h.name} />
                <span style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>{h.name}</span>
              </Button>
            ))}
          </div>
        ) : null}

        {/* Channel segmented control (26-J) */}
        <div className="mt-3 flex rounded-lg p-0.5" style={{ background: 'var(--a-inset)' }}>
          {(
            [
              { key: 'email' as const, label: 'Email' },
              { key: 'text' as const, label: 'Text' },
            ]
          ).map((c) => (
            <FilterChip
              key={c.key}
              pressed={channel === c.key}
              onClick={() => setChannel(c.key)}
              className="flex-1"
              style={{
                borderRadius: 'var(--a-r-md)',
                padding: '6px 0',
                border: 'none',
                fontSize: 'var(--a-text-sm)',
                fontWeight: 500,
                transition: 'background-color var(--a-t-fast), color var(--a-t-fast)',
                background: channel === c.key ? 'var(--a-bg)' : 'transparent',
                color: channel === c.key ? 'var(--a-text)' : 'var(--a-text-2)',
              }}
            >
              {c.label}
            </FilterChip>
          ))}
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-3"
            style={{
              borderRadius: 'var(--a-r-md)',
              border: '1px solid var(--a-danger)',
              background: 'var(--a-danger-wash)',
              color: 'var(--a-danger)',
              padding: 'var(--a-s2) var(--a-s3)',
              fontSize: 'var(--a-text-sm)',
              fontWeight: 500,
            }}
          >
            {error}
          </p>
        ) : null}

        {/* Template selector row (S1 Templates bar / S5 element 3) */}
        {primary && templates.length > 0 ? (
          <Button
            variant="quiet"
            onClick={() => setTplOpen(true)}
            className="mt-3 w-full"
            style={{
              height: 44,
              minHeight: 0,
              justifyContent: 'space-between',
              borderRadius: 'var(--a-r-lg)',
              padding: '0 12px',
              fontWeight: 400,
              border: '1px solid var(--a-border)',
              background: 'var(--a-inset)',
              fontSize: 'var(--a-text-md)',
              color: 'var(--a-text)',
            }}
          >
            {channel === 'email' ? (emailTpl?.name ?? 'Blank email') : 'Use a template'}
            <ChevronsUpDown className="h-4 w-4" style={{ color: 'var(--a-text-2)' }} aria-hidden />
          </Button>
        ) : null}

        {/* ── Text compose (S2/S3) — the canonical SmsComposer, same chat bar
               as the thread view and the person Comms tab. AI pills + the
               template row above inject via initialBody + key-remount. ── */}
        {primary && channel === 'text' ? (
          smsAllowed ? (
            <div className="mt-3">
              <MobileAiPills
                aiDraftAction={(kind, custom) => aiDraftAction(primary.id, kind, custom)}
                onDraft={(text) => {
                  setSmsBody(text)
                  setSmsBodyV((v) => v + 1)
                }}
              />
              <SmsComposer
                key={smsBodyV}
                initialBody={smsBody}
                personId={primary.id}
                primaryPersonId={primary.id}
                sendAction={sendSmsFromComposer}
              />
              {recipients.length > 1 ? (
                <p className="mt-1 px-1" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  Group text · {recipients.length} people share one thread
                </p>
              ) : null}
            </div>
          ) : (
            <p
              className="av2-composer__warn mt-3"
              style={{
                borderRadius: 'var(--a-r-lg)',
                border: '1px solid var(--a-warn)',
                background: 'var(--a-warn-wash)',
                padding: 'var(--a-s3)',
                fontSize: 'var(--a-text-sm)',
              }}
            >
              Texting is unavailable until A2P 10DLC business registration is Fully Registered.
            </p>
          )
        ) : null}

        {/* ── Email compose (S1) ───────────────────────────────────────── */}
        {primary && channel === 'email' ? (
          recipients.length > 1 ? (
            <p
              className="av2-composer__warn mt-3"
              style={{
                borderRadius: 'var(--a-r-lg)',
                border: '1px solid var(--a-warn)',
                background: 'var(--a-warn-wash)',
                padding: 'var(--a-s3)',
                fontSize: 'var(--a-text-sm)',
              }}
            >
              Email sends to one contact at a time. Remove extra recipients, or use Text for a
              group thread.
            </p>
          ) : (
            <div className="mt-3">
              <EmailComposer
                key={emailKey}
                initialSubject={emailTpl?.subject ?? ''}
                initialBody={emailTpl?.body ?? ''}
                signatureHtml={signatureHtml}
                toLabel={primary.name}
                personId={primary.id}
                tplKey={emailTpl?.key ?? null}
                sendAction={async (fd: FormData) => {
                  const res = await sendEmailAction(primary.id, fd)
                  if (res.ok) finish(primary.id)
                  else setError(res.error ?? 'Email not sent')
                }}
              />
            </div>
          )
        ) : null}

        {!primary ? (
          <p className="mt-6 pb-4 text-center" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
            Search for a contact to start a message.
          </p>
        ) : null}
      </Sheet>

      {/* Template picker sheet (S1 step 7 / S4 "Use template") */}
      <Sheet
        open={tplOpen}
        onClose={() => setTplOpen(false)}
        title={channel === 'email' ? 'Email templates' : 'Text templates'}
      >
        <div className="mt-2">
          {channel === 'email' ? (
            <Button
              variant="quiet"
              onClick={() => {
                setEmailTpl(null)
                setEmailKey((k) => k + 1)
                setTplOpen(false)
              }}
              className="w-full"
              style={{
                justifyContent: 'flex-start',
                minHeight: 0,
                borderRadius: 0,
                padding: '12px 0',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                fontSize: 'var(--a-text-md)',
                fontWeight: 500,
                color: 'var(--a-text)',
              }}
            >
              Blank email
            </Button>
          ) : null}
          {templates.map((t, idx) => (
            <Button
              key={t.key}
              variant="quiet"
              onClick={() => {
                if (channel === 'email') {
                  setEmailTpl(t)
                  setEmailKey((k) => k + 1)
                } else if (renderTemplateAction && primary) {
                  // Resolve merge tokens server-side BEFORE the body lands in
                  // the composer — the broker sees what will send; anything
                  // still %literal% is genuinely unresolved (SmsComposer warns).
                  setSmsBody(t.body)
                  setSmsBodyV((v) => v + 1)
                  startTransition(async () => {
                    const res = await renderTemplateAction(primary.id, t.body)
                    if (res.ok) {
                      setSmsBody(res.body)
                      setSmsBodyV((v) => v + 1)
                    }
                  })
                } else {
                  setSmsBody(t.body)
                  setSmsBodyV((v) => v + 1)
                }
                setTplOpen(false)
              }}
              className="w-full"
              style={{
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                gap: 0,
                minHeight: 0,
                borderRadius: 0,
                padding: '12px 0',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: channel === 'email' || idx > 0 ? '1px solid var(--a-border)' : 'none',
              }}
            >
              <span className="block" style={{ fontSize: 'var(--a-text-md)', fontWeight: 500, color: 'var(--a-text)' }}>
                {t.name}
              </span>
              <span className="mt-0.5 line-clamp-1 block" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                {t.subject ?? t.body}
              </span>
            </Button>
          ))}
          {templates.length === 0 ? (
            <p className="py-4" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
              No templates yet.
            </p>
          ) : null}
        </div>
      </Sheet>
    </>
  )
}
