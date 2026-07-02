'use client'

/**
 * MobileThread — the §26-E (email) / §26-F/26-I (SMS) conversation detail,
 * rendered as a full-screen pushed view (fixed overlay — FUB hides the tab bar
 * on pushed screens, AC-26E-07).
 *
 *   - Navy header: back ‹ · avatar + name (+ › to the contact profile) · phone
 *     (SMS threads → S8 calling-method sheet) · kebab popover (26-G).
 *   - Email mode: 22px-bold subject block, per-email sender rows + sanitized
 *     HTML bodies, reply arrow on the newest email (AC-26E-03/04).
 *   - SMS mode: bubbles (outbound right/navy · inbound left/muted), timestamp
 *     separators on >1h gaps, calls as centered markers; compose panel with the
 *     §27 S3 AI pill strip + the shared suppression-gated SmsComposer.
 *   - Right-edge handle → contact context drawer (AC-26E-06).
 *   - Block-number row (26-G) with AlertDialog confirm before executing.
 *
 * Every send goes through the pre-bound page actions (sendCrmSmsAction /
 * sendCrmEmailAction server-side) — this component never adds a send path.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  CornerUpLeft,
  Download,
  MoreHorizontal,
  Phone,
  Smartphone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { CrmAvatar } from '@/components/admin/crm/mobile/CrmMobileKit'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'
import MobileAiPills from './MobileAiPills'
import MobileComposeSheet, { type ComposeTemplate } from './MobileComposeSheet'
import type { AiDraftKind } from '@/app/actions/crm-inbox'

export type MobileThreadItem = {
  id: number
  category: 'message' | 'email' | 'call' | 'note' | 'other'
  direction: 'in' | 'out' | null
  kind: string
  ts: string
  tsLabel: string
  snippet: string | null
  body: string | null
  subject: string | null
  /** Sanitized (server-side) email HTML — safe to inject. */
  safeHtml: string | null
  broker: string | null
  recordingSid: string | null
  recordingDurationSec: number | null
  contentHidden: boolean
}

export type MobileThreadContext = {
  stage: string
  agentName: string | null
  source: string | null
  priceLabel: string | null
  timeframe: string | null
  tags: string[]
  lastCommunicationLabel: string | null
}

function mmss(sec: number): string {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

/** (NNN) NNN-NNNN display for the Block row + call sheet (AC-26G-04). */
function fmtPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : raw
}

export default function MobileThread({
  personId,
  name,
  mode,
  status,
  phone,
  canText,
  canEmail,
  smsAllowed,
  items,
  context,
  signatureHtml,
  lastEmailSubject,
  backHref,
  sendError,
  smsAction,
  emailAction,
  setStatusAction,
  blockAction,
  callAction,
  aiDraftAction,
  addPersonSlot,
  groupCompose,
  initialReplyOpen = false,
}: {
  personId: number
  name: string
  mode: 'email' | 'sms'
  status: 'unread' | 'open' | 'handled' | 'closed'
  phone: string | null
  canText: boolean
  canEmail: boolean
  smsAllowed: boolean
  items: MobileThreadItem[]
  context: MobileThreadContext
  signatureHtml: string | null
  lastEmailSubject: string | null
  backHref: string
  sendError: string | null
  smsAction: (formData: FormData) => Promise<void>
  emailAction: (formData: FormData) => Promise<void>
  setStatusAction: (status: 'unread' | 'open' | 'handled' | 'closed') => Promise<{ ok: boolean; error?: string }>
  blockAction: (phone: string) => Promise<{ ok: boolean; error?: string }>
  callAction: () => Promise<{ ok: boolean; error?: string }>
  aiDraftAction: (kind: AiDraftKind, customPrompt?: string) => Promise<{ ok: true; draft: string } | { ok: false; error: string }>
  /** Unknown-caller "Add Person" form (server-rendered slot, shows in the drawer). */
  addPersonSlot?: React.ReactNode
  /** Enables the 26-G "Start a group message" kebab row — a controlled §26-J
   *  compose sheet with this contact pre-added. */
  groupCompose?: {
    hrefBase: string
    smsAllowed: boolean
    signatureHtml: string | null
    emailTemplates: ComposeTemplate[]
    smsTemplates: ComposeTemplate[]
    searchAction: (q: string) => Promise<Array<{ id: number; name: string }>>
    sendSmsAction: (personId: number, formData: FormData) => Promise<{ ok: boolean; error?: string }>
    sendEmailAction: (personId: number, formData: FormData) => Promise<{ ok: boolean; error?: string }>
    aiDraftAction: (personId: number, kind: AiDraftKind, customPrompt?: string) => Promise<{ ok: true; draft: string } | { ok: false; error: string }>
  }
  /** Open the email reply sheet on mount — the lead-detail Email circle
   *  deep-links here with ?m=email so composing starts immediately (punch #4). */
  initialReplyOpen?: boolean
}) {
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(initialReplyOpen && canEmail)
  const [callOpen, setCallOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [smsDraft, setSmsDraft] = useState('')
  const [smsDraftV, setSmsDraftV] = useState(0)
  const [, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)

  // SMS threads open pinned to the newest bubble (26-I scroll-to-bottom).
  useEffect(() => {
    if (mode === 'sms' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [mode])

  // Oldest-first for rendering; items arrive newest-first from the page.
  const ordered = useMemo(() => [...items].reverse(), [items])
  const emails = useMemo(() => ordered.filter((it) => it.category === 'email'), [ordered])
  const newestEmail = emails[emails.length - 1] ?? null

  function triage(next: 'unread' | 'open' | 'handled' | 'closed', leave: boolean) {
    startTransition(async () => {
      const res = await setStatusAction(next)
      if (!res.ok) setNote(res.error ?? 'Could not update the conversation')
      else if (leave) router.push(backHref)
      else router.refresh()
    })
  }

  const kebab = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Conversation actions" className="px-1">
          <MoreHorizontal className="h-[22px] w-[22px] text-primary-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {phone ? (
          <DropdownMenuItem onSelect={() => setCallOpen(true)}>
            <Phone className="h-4 w-4" aria-hidden /> Call
          </DropdownMenuItem>
        ) : null}
        {canEmail ? (
          <DropdownMenuItem onSelect={() => setReplyOpen(true)}>Email</DropdownMenuItem>
        ) : null}
        {mode === 'sms' && groupCompose && canText ? (
          <DropdownMenuItem onSelect={() => setGroupOpen(true)}>Start a group message</DropdownMenuItem>
        ) : null}
        {mode === 'email' && canEmail ? (
          <DropdownMenuItem onSelect={() => setReplyOpen(true)}>Reply</DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => triage('unread', true)}>Mark as Unread</DropdownMenuItem>
        {status === 'closed' ? (
          <DropdownMenuItem onSelect={() => triage('open', false)}>Reopen</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => triage('closed', true)}>Archive</DropdownMenuItem>
        )}
        {phone ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onSelect={() => setBlockOpen(true)}>
              <Phone className="h-4 w-4 text-destructive" aria-hidden /> Block {fmtPhone(phone)}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background md:hidden">
      {/* ── Navy header (pushed view — no tab bar behind) ─────────────────── */}
      <div className="flex h-14 shrink-0 items-center gap-1 bg-primary px-2">
        <Link href={backHref} aria-label="Back to inbox" className="flex h-11 w-11 items-center justify-center">
          <ChevronLeft className="h-6 w-6 text-primary-foreground" />
        </Link>
        <Link
          href={`/admin/crm/${personId}`}
          className="flex min-w-0 flex-1 items-center justify-center gap-2"
        >
          <CrmAvatar name={name} size={32} />
          <span className="truncate text-[17px] font-semibold text-primary-foreground">{name}</span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary-foreground" aria-hidden />
        </Link>
        {mode === 'sms' && phone ? (
          <button
            type="button"
            aria-label={`Call ${name}`}
            onClick={() => setCallOpen(true)}
            className="px-1.5"
          >
            <Phone className="h-[22px] w-[22px] text-primary-foreground" />
          </button>
        ) : null}
        {kebab}
      </div>

      {note ? (
        <Alert variant="destructive" className="mx-3 mt-2">
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      ) : null}

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {mode === 'email' ? (
          <div className="pb-8">
            {/* Subject block (AC-26E-02) */}
            <h1 className="px-4 py-4 text-[22px] font-bold leading-tight text-foreground">
              {newestEmail?.subject ?? lastEmailSubject ?? '(no subject)'}
            </h1>
            {emails.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">No emails in this conversation yet.</p>
            ) : null}
            {emails.map((it, i) => {
              const senderName = it.direction === 'out' ? it.broker ?? 'Ryan Realty' : name
              const last = i === emails.length - 1
              return (
                <div key={it.id}>
                  {/* Sender / meta row (AC-26E-03) */}
                  <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                    <CrmAvatar name={senderName} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-foreground">{senderName}</p>
                      <p className="text-[13px] text-muted-foreground">{it.tsLabel}</p>
                    </div>
                    {last && canEmail ? (
                      <button
                        type="button"
                        aria-label="Reply"
                        onClick={() => setReplyOpen(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"
                      >
                        <CornerUpLeft className="h-4 w-4 text-foreground" />
                      </button>
                    ) : null}
                  </div>
                  {/* Body (AC-26E-04, sanitized server-side) */}
                  <div className="px-4 pb-6 pt-5">
                    {it.contentHidden ? (
                      <p className="text-sm italic text-muted-foreground">
                        Message content is unavailable (redacted by the legacy CRM export).
                      </p>
                    ) : it.safeHtml ? (
                      <div
                        className="no-scrollbar overflow-x-auto text-[15px] leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_table]:max-w-full"
                        dangerouslySetInnerHTML={{ __html: it.safeHtml }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                        {it.body || it.snippet || '(no content)'}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* SMS bubbles (26-I) — outbound right/navy, inbound left/muted */
          <div className="flex flex-col gap-1 px-3 py-4 pb-8">
            {ordered.map((it, i) => {
              const prev = ordered[i - 1]
              const gapMs = prev ? new Date(it.ts).getTime() - new Date(prev.ts).getTime() : Infinity
              const sep = gapMs > 60 * 60 * 1000
              if (it.category === 'call') {
                return (
                  <div key={it.id} className="my-2 flex flex-col items-center gap-1">
                    <div className="flex flex-wrap items-center justify-center gap-x-2 rounded-full bg-muted px-4 py-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {it.kind === 'voicemail' ? 'Voicemail' : 'Call'}
                      </span>
                      <span className="tabular-nums">{it.tsLabel}</span>
                      {it.recordingDurationSec != null ? (
                        <span className="font-mono tabular-nums">{mmss(it.recordingDurationSec)}</span>
                      ) : null}
                      {it.recordingSid ? (
                        <a
                          href={`/api/admin/crm/recording/${it.recordingSid}`}
                          download
                          aria-label="Download recording"
                          className="text-primary"
                        >
                          <Download className="h-3 w-3" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </div>
                )
              }
              if (it.category !== 'message') {
                return (
                  <div key={it.id} className="my-1.5 flex justify-center">
                    <span className="rounded-full bg-muted px-4 py-1 text-xs text-muted-foreground">
                      {it.subject ?? it.snippet ?? it.kind} · {it.tsLabel}
                    </span>
                  </div>
                )
              }
              const out = it.direction === 'out'
              return (
                <div key={it.id} className={cn('flex flex-col', out ? 'items-end' : 'items-start')}>
                  {sep ? (
                    <div className="w-full py-2 text-center text-xs text-muted-foreground">{it.tsLabel}</div>
                  ) : null}
                  <div
                    className={cn(
                      'max-w-[78%] whitespace-pre-wrap rounded-[18px] px-4 py-2 text-[15px] leading-[22px]',
                      out
                        ? 'rounded-br-sm bg-primary text-primary-foreground [&_a]:underline'
                        : 'rounded-bl-sm bg-muted text-foreground',
                    )}
                  >
                    {it.contentHidden ? <em>Content unavailable</em> : it.body ?? it.snippet ?? ''}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Compose panel (SMS mode) — AI pills + suppression-gated composer ── */}
      {mode === 'sms' ? (
        <div className="shrink-0 rounded-t-xl border-t border-border bg-background px-3 pb-3 pt-2 shadow-[0_-1px_4px_rgba(0,0,0,0.08)]">
          {sendError ? (
            <Alert variant="destructive" className="mb-2">
              <AlertDescription>{sendError}</AlertDescription>
            </Alert>
          ) : null}
          {canText && smsAllowed ? (
            <>
              <MobileAiPills
                aiDraftAction={aiDraftAction}
                onDraft={(text) => {
                  setSmsDraft(text)
                  setSmsDraftV((v) => v + 1)
                }}
              />
              <SmsComposer key={smsDraftV} initialBody={smsDraft} sendAction={smsAction} />
            </>
          ) : (
            <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {canText
                ? 'Texting is unavailable until A2P 10DLC business registration is Fully Registered.'
                : 'No phone number on file for this contact.'}
            </p>
          )}
        </div>
      ) : null}

      {/* ── Right-edge context drawer handle (AC-26E-06) ─────────────────── */}
      <button
        type="button"
        aria-label="Open contact details"
        onClick={() => setDrawerOpen(true)}
        className="absolute right-0 top-1/2 h-12 w-1.5 -translate-y-1/2 rounded-l-md bg-muted-foreground/40"
      />
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-80">
          <SheetHeader>
            <SheetTitle>{name}</SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-2 text-sm">
            {context.lastCommunicationLabel ? (
              <p className="text-muted-foreground">Last communication {context.lastCommunicationLabel}</p>
            ) : null}
            <div className="divide-y divide-border">
              {(
                [
                  ['Stage', context.stage],
                  ['Agent', context.agentName],
                  ['Source', context.source],
                  ['Price', context.priceLabel],
                  ['Timeframe', context.timeframe],
                  ['Phone', phone ? fmtPhone(phone) : null],
                ] as Array<[string, string | null]>
              ).map(([label, value]) =>
                value ? (
                  <div key={label} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="truncate font-medium text-foreground">{value}</span>
                  </div>
                ) : null,
              )}
            </div>
            {context.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {context.tags.map((t) => (
                  <Badge key={t} variant="outline" className="font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : null}
            <Link href={`/admin/crm/${personId}`} className="block pt-2 text-primary underline">
              Open full contact profile
            </Link>
            {addPersonSlot ? <div className="pt-3">{addPersonSlot}</div> : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Email reply sheet (AC-26E-09) ─────────────────────────────────── */}
      <Sheet open={replyOpen} onOpenChange={setReplyOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Email {name}</SheetTitle>
          </SheetHeader>
          {sendError ? (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{sendError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="mt-3">
            <EmailComposer
              initialSubject={lastEmailSubject ? `Re: ${lastEmailSubject.replace(/^((re|fwd?):\s*)+/i, '')}` : ''}
              initialBody=""
              signatureHtml={signatureHtml}
              sendAction={emailAction}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* ── S8 calling-method sheet ───────────────────────────────────────── */}
      <Sheet open={callOpen} onOpenChange={setCallOpen}>
        <SheetContent side="bottom" className="rounded-t-xl">
          <SheetHeader>
            <SheetTitle>Call {name}</SheetTitle>
            {phone ? <p className="text-sm text-muted-foreground">{fmtPhone(phone)}</p> : null}
          </SheetHeader>
          <div className="mt-2 divide-y divide-border">
            <button
              type="button"
              className="flex w-full items-center gap-3 py-3.5 text-left"
              onClick={() => {
                setCallOpen(false)
                startTransition(async () => {
                  const res = await callAction()
                  setNote(
                    res.ok
                      ? 'Calling your cell now to connect you. The call is recorded and logged to the timeline.'
                      : res.error ?? 'Could not start the call',
                  )
                })
              }}
            >
              <Phone className="h-5 w-5 text-foreground" aria-hidden />
              <span>
                <span className="block text-[15px] font-medium text-foreground">Call via Ryan Realty line</span>
                <span className="block text-xs text-muted-foreground">
                  Rings your cell, bridges to the contact, recorded + logged
                </span>
              </span>
            </button>
            {phone ? (
              <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="flex w-full items-center gap-3 py-3.5">
                <Smartphone className="h-5 w-5 text-foreground" aria-hidden />
                <span>
                  <span className="block text-[15px] font-medium text-foreground">Call direct from this phone</span>
                  <span className="block text-xs text-muted-foreground">
                    Uses your phone dialer — not tracked in the CRM
                  </span>
                </span>
              </a>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Block confirmation (AC-26G-06) ────────────────────────────────── */}
      <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {phone ? fmtPhone(phone) : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              Calls from this number will be rejected and texts dropped. You can unblock it from
              CRM settings, Company, Block list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!phone) return
                startTransition(async () => {
                  const res = await blockAction(phone)
                  setNote(res.ok ? `Blocked ${phone}.` : res.error ?? 'Could not block the number')
                })
              }}
            >
              Block number
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── 26-G "Start a group message" → controlled compose sheet ───────── */}
      {groupCompose ? (
        <MobileComposeSheet
          trigger="controlled"
          open={groupOpen}
          onOpenChange={setGroupOpen}
          initialRecipients={[{ id: personId, name }]}
          initialChannel="text"
          hrefBase={groupCompose.hrefBase}
          smsAllowed={groupCompose.smsAllowed}
          signatureHtml={groupCompose.signatureHtml}
          emailTemplates={groupCompose.emailTemplates}
          smsTemplates={groupCompose.smsTemplates}
          searchAction={groupCompose.searchAction}
          sendSmsAction={groupCompose.sendSmsAction}
          sendEmailAction={groupCompose.sendEmailAction}
          aiDraftAction={groupCompose.aiDraftAction}
        />
      ) : null}
    </div>
  )
}
