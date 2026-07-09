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
 *   3. Text: §27 S3 AI pill strip + template picker + the FUB compose bar
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
import { ArrowUp, ChevronsUpDown, FileText, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
import MobileAiPills from './MobileAiPills'
import type { AiDraftKind } from '@/app/actions/crm-inbox'

export type ComposeTemplate = { key: string; name: string; subject: string | null; body: string }
export type ComposeRecipient = { id: number; name: string }

type SendResult = { ok: boolean; error?: string }

const GROUP_LIMIT = 10

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
  const [smsBody, setSmsBody] = useState('')
  const [overrideQuiet, setOverrideQuiet] = useState(false)
  const [tplOpen, setTplOpen] = useState(false)
  const [emailTpl, setEmailTpl] = useState<ComposeTemplate | null>(null)
  const [emailKey, setEmailKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
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
    setError(null)
    setEmailTpl(null)
    setOverrideQuiet(false)
  }

  function finish(personId: number) {
    setOpen(false)
    reset()
    router.push(`${hrefBase}&c=${personId}`)
  }

  function sendSms() {
    if (!primary || !smsBody.trim()) return
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('body', smsBody)
      if (overrideQuiet) fd.set('overrideQuietHours', '1')
      if (recipients.length > 1) fd.set('recipientIds', recipients.slice(1).map((r) => r.id).join(','))
      const res = await sendSmsAction(primary.id, fd)
      if (res.ok) finish(primary.id)
      else setError(res.error ?? 'Text not sent')
    })
  }

  const chars = smsBody.length
  const templates = channel === 'email' ? emailTemplates : smsTemplates
  // Tokens still %literal% in the body — after the server-side template render
  // these are genuinely unresolved for this contact (desktop SmsComposer parity).
  const smsUnresolved = findUnresolvedMergeTokens(smsBody)

  return (
    <>
      {trigger === 'fab' ? (
        <button
          type="button"
          aria-label="Compose new message"
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
          style={{ boxShadow: '0 4px 12px rgba(16,39,66,0.30)' }}
        >
          <Pencil className="h-6 w-6" aria-hidden />
        </button>
      ) : null}

      <Sheet
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) reset()
        }}
      >
        <SheetContent aria-describedby={undefined} side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{primary ? 'New message' : 'Select Recipients'}</SheetTitle>
          </SheetHeader>

          {/* To: recipient token row (S2) */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-b border-border pb-2">
            <span className="text-[15px] font-medium text-muted-foreground">To:</span>
            {recipients.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRecipients((prev) => prev.filter((p) => p.id !== r.id))}
                className="flex h-8 items-center gap-1 rounded-full border-[1.5px] border-border px-3 text-[15px] font-medium text-primary"
              >
                {r.name}
                <X className="h-3 w-3" aria-hidden />
              </button>
            ))}
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={recipients.length === 0 ? 'Search contacts' : ''}
              className="h-8 min-w-28 flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
            />
          </div>

          {/* Contact search results */}
          {hits.length > 0 ? (
            <div className="divide-y divide-border">
              {hits.slice(0, 8).map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    if (channel === 'text' && recipients.length >= GROUP_LIMIT) {
                      setError('Group texts support up to 10 participants')
                      return
                    }
                    setRecipients((prev) => [...prev, h])
                    setQ('')
                    setHits([])
                  }}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <CrmAvatar name={h.name} size={32} />
                  <span className="text-[15px] text-foreground">{h.name}</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Channel segmented control (26-J) */}
          <div className="mt-3 flex rounded-lg bg-muted p-0.5">
            {(
              [
                { key: 'email' as const, label: 'Email' },
                { key: 'text' as const, label: 'Text' },
              ]
            ).map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setChannel(c.key)}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
                  channel === c.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {error ? (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {/* Template selector row (S1 Templates bar / S5 element 3) */}
          {primary && templates.length > 0 ? (
            <button
              type="button"
              onClick={() => setTplOpen(true)}
              className="mt-3 flex h-11 w-full items-center justify-between rounded-lg border border-border bg-muted px-3 text-[15px] text-foreground"
            >
              {channel === 'email' ? (emailTpl?.name ?? 'Blank email') : 'Use a template'}
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            </button>
          ) : null}

          {/* ── Text compose (S2/S3) ─────────────────────────────────────── */}
          {primary && channel === 'text' ? (
            smsAllowed ? (
              <div className="mt-3">
                <MobileAiPills
                  aiDraftAction={(kind, custom) => aiDraftAction(primary.id, kind, custom)}
                  onDraft={(text) => setSmsBody(text)}
                />
                {smsUnresolved.length > 0 ? (
                  <p className="mb-1.5 px-1 text-xs font-medium text-warning">
                    Unfilled merge fields, this contact has no value for: {smsUnresolved.join(', ')}.
                    Edit before sending.
                  </p>
                ) : null}
                <div className="flex items-end gap-1.5 rounded-3xl border border-input bg-background p-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Insert a template"
                    onClick={() => setTplOpen(true)}
                    className="h-9 w-9 shrink-0 rounded-full bg-muted"
                  >
                    <FileText className="h-4 w-4" aria-hidden />
                  </Button>
                  <Textarea
                    rows={1}
                    value={smsBody}
                    onChange={(e) => setSmsBody(e.target.value)}
                    placeholder="Text message · SMS"
                    className="max-h-32 min-h-9 flex-1 resize-none self-center border-0 bg-transparent px-1 py-1.5 text-[15px] shadow-none focus-visible:ring-0"
                  />
                  <Button
                    type="button"
                    size="icon"
                    aria-label="Send text"
                    disabled={pending || !smsBody.trim()}
                    onClick={sendSms}
                    className="h-9 w-9 shrink-0 rounded-full"
                  >
                    <ArrowUp className="h-5 w-5" aria-hidden />
                  </Button>
                </div>
                <div className="mt-1.5 flex items-center justify-between px-1">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox checked={overrideQuiet} onCheckedChange={(v) => setOverrideQuiet(v === true)} />
                    Send anyway (quiet hours)
                  </label>
                  {chars > 0 ? (
                    <span className={cn('text-xs tabular-nums', chars > 320 ? 'text-warning' : 'text-muted-foreground')}>
                      {chars}/320
                    </span>
                  ) : null}
                </div>
                {recipients.length > 1 ? (
                  <p className="mt-1 px-1 text-xs text-muted-foreground">
                    Group text · {recipients.length} people share one thread
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Texting is unavailable until A2P 10DLC business registration is Fully Registered.
              </p>
            )
          ) : null}

          {/* ── Email compose (S1) ───────────────────────────────────────── */}
          {primary && channel === 'email' ? (
            recipients.length > 1 ? (
              <p className="mt-3 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
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
            <p className="mt-6 pb-4 text-center text-sm text-muted-foreground">
              Search for a contact to start a message.
            </p>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Template picker sheet (S1 step 7 / S4 "Use template") */}
      <Sheet open={tplOpen} onOpenChange={setTplOpen}>
        <SheetContent aria-describedby={undefined} side="bottom" className="max-h-[70dvh] overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>{channel === 'email' ? 'Email templates' : 'Text templates'}</SheetTitle>
          </SheetHeader>
          <div className="mt-2 divide-y divide-border">
            {channel === 'email' ? (
              <button
                type="button"
                onClick={() => {
                  setEmailTpl(null)
                  setEmailKey((k) => k + 1)
                  setTplOpen(false)
                }}
                className="block w-full py-3 text-left text-[15px] font-medium text-foreground"
              >
                Blank email
              </button>
            ) : null}
            {templates.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  if (channel === 'email') {
                    setEmailTpl(t)
                    setEmailKey((k) => k + 1)
                  } else if (renderTemplateAction && primary) {
                    // Resolve merge tokens server-side BEFORE the body lands in
                    // the input — the broker sees what will send, and anything
                    // still %literal% is genuinely unresolved (warned below).
                    setSmsBody(t.body)
                    startTransition(async () => {
                      const res = await renderTemplateAction(primary.id, t.body)
                      if (res.ok) setSmsBody(res.body)
                    })
                  } else {
                    setSmsBody(t.body)
                  }
                  setTplOpen(false)
                }}
                className="block w-full py-3 text-left"
              >
                <span className="block text-[15px] font-medium text-foreground">{t.name}</span>
                <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                  {t.subject ?? t.body}
                </span>
              </button>
            ))}
            {templates.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No templates yet.</p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
