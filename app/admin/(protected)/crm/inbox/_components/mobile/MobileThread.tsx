'use client'

/**
 * MobileThread — the §26-E (email) / §26-F/26-I (SMS) conversation detail,
 * rendered as a full-screen pushed view (fixed overlay — FUB hides the tab bar
 * on pushed screens, AC-26E-07).
 *
 *   - Header: back ‹ · avatar + name (+ › to the contact profile) · phone
 *     (SMS threads → S8 calling-method sheet) · kebab menu (26-G).
 *   - Email mode: subject block, per-email sender rows + sanitized HTML
 *     bodies, reply arrow on the newest email (AC-26E-03/04).
 *   - SMS mode: bubbles (outbound right/accent-wash · inbound left/surface),
 *     timestamp separators on >1h gaps, calls as centered markers; compose
 *     panel with the §27 S3 AI pill strip + the shared suppression-gated
 *     SmsComposer.
 *   - Right-edge handle → contact context drawer (AC-26E-06).
 *   - Block-number row (26-G) with a confirm dialog before executing.
 *
 * Every send goes through the pre-bound page actions (sendCrmSmsAction /
 * sendCrmEmailAction server-side) — this component never adds a send path.
 *
 * Visual language: Ryan Realty admin v2 (design_system/admin/ADMIN_UI.md,
 * locked 2026-08-05). Color/type reach this file only via components/admin/v2
 * primitives or var(--a-*) tokens — see components/admin/v2/admin-v2.css.
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
import { Button, ConfirmDialog, IconButton, Menu, Sheet, ThreadBubble, type AdminMenuItem } from '@/components/admin/v2'
import { ErrorNote, ThreadAvatar, fmtPhone, mmss } from './thread-bits'
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
    renderTemplateAction?: (
      personId: number,
      body: string,
    ) => Promise<{ ok: true; body: string; unresolved: string[] } | { ok: false; error: string }>
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

  // Phones: lock the page behind this overlay. With the document unable to
  // scroll, iOS has nothing to pan when the soft keyboard opens, so the fixed
  // overlay (and its composer) stays put. Gated on the md breakpoint because
  // this component stays mounted (only CSS-hidden) on desktop, where locking
  // body scroll would freeze the real page.
  useEffect(() => {
    if (!window.matchMedia('(max-width: 767px)').matches) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Kebab menu: close on outside click or Escape (Radix DropdownMenu did this
  // internally; hand-rolled here since components/ui/dropdown-menu is banned
  // design input for admin v2 — LEGACY_IMPORT).

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

  // 11F: the hand-rolled role="menu" panel became the v2 Menu primitive — same
  // items, same conditions, same handlers, but click-outside / Escape / focus
  // return now come from one place instead of three different hand-rolls in
  // this folder. Items are built in the same order they rendered before.
  const kebabItems: AdminMenuItem[] = [
    ...(phone ? [{ label: 'Call', onSelect: () => setCallOpen(true) }] : []),
    ...(canEmail ? [{ label: 'Email', onSelect: () => setReplyOpen(true) }] : []),
    ...(mode === 'sms' && groupCompose && canText
      ? [{ label: 'Start a group message', onSelect: () => setGroupOpen(true) }]
      : []),
    ...(mode === 'email' && canEmail ? [{ label: 'Reply', onSelect: () => setReplyOpen(true) }] : []),
    { label: 'Mark as Unread', onSelect: () => triage('unread', true) },
    status === 'closed'
      ? { label: 'Reopen', onSelect: () => triage('open', false) }
      : { label: 'Archive', onSelect: () => triage('closed', true) },
    ...(phone
      ? [{ label: `Block ${fmtPhone(phone)}`, onSelect: () => setBlockOpen(true), danger: true }]
      : []),
  ]

  const kebab = (
    <Menu
      label="Conversation actions"
      items={kebabItems}
      trigger={<MoreHorizontal className="h-[22px] w-[22px]" />}
    />
  )


  return (
    // Height tracks the soft keyboard (--kb-inset via KeyboardInsetSync): the
    // overlay shrinks to the visible viewport so the composer rides the
    // keyboard top instead of hiding behind it (fixed inset-0 spans the full
    // LAYOUT viewport, which iOS keeps keyboard-height too tall).
    <div
      className="fixed inset-x-0 top-0 z-50 flex flex-col md:hidden"
      style={{ height: 'calc(100dvh - var(--kb-inset, 0px))', background: 'var(--a-bg)' }}
    >
      {/* ── Header (pushed view — no tab bar behind) ───────────────────────── */}
      <div className="av2-threadhead shrink-0">
        <Link href={backHref} aria-label="Back to inbox" className="flex h-11 w-11 items-center justify-center">
          <ChevronLeft className="h-6 w-6" style={{ color: 'var(--a-text-2)' }} />
        </Link>
        <Link
          href={`/admin/people/${personId}`}
          className="flex min-w-0 flex-1 items-center justify-center gap-2"
        >
          <ThreadAvatar name={name} size={32} />
          <span className="av2-threadhead__name truncate" style={{ fontSize: 'var(--a-text-lg)', color: 'var(--a-text)' }}>
            {name}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--a-text-2)' }} aria-hidden />
        </Link>
        {mode === 'sms' && phone ? (
          <IconButton label={`Call ${name}`} onClick={() => setCallOpen(true)}>
            <Phone className="h-[22px] w-[22px]" />
          </IconButton>
        ) : null}
        {kebab}
      </div>

      {note ? <ErrorNote className="mx-3 mt-2">{note}</ErrorNote> : null}

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {mode === 'email' ? (
          <div className="pb-8">
            {/* Subject block (AC-26E-02). Not an <h1> — ADMIN_UI acceptance
                bar #1 bans page-title chrome; this is per-conversation content. */}
            <div
              role="heading"
              aria-level={2}
              className="px-4 py-4 font-bold leading-tight"
              style={{ fontSize: 'var(--a-text-xl)', color: 'var(--a-text)' }}
            >
              {newestEmail?.subject ?? lastEmailSubject ?? '(no subject)'}
            </div>
            {emails.length === 0 ? (
              <p className="px-4 py-8" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                No emails in this conversation yet.
              </p>
            ) : null}
            {emails.map((it, i) => {
              const senderName = it.direction === 'out' ? it.broker ?? 'Ryan Realty' : name
              const last = i === emails.length - 1
              return (
                <div key={it.id}>
                  {/* Sender / meta row (AC-26E-03) */}
                  <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--a-border)' }}>
                    <ThreadAvatar name={senderName} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold" style={{ fontSize: 'var(--a-text-lg)', color: 'var(--a-text)' }}>
                        {senderName}
                      </p>
                      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>{it.tsLabel}</p>
                    </div>
                    {last && canEmail ? (
                      <IconButton label="Reply" onClick={() => setReplyOpen(true)}>
                        <CornerUpLeft className="h-4 w-4" />
                      </IconButton>
                    ) : null}
                  </div>
                  {/* Body (AC-26E-04, sanitized server-side) */}
                  <div className="px-4 pb-6 pt-5">
                    {it.contentHidden ? (
                      <p className="italic" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
                        Message content is unavailable (redacted by the legacy CRM export).
                      </p>
                    ) : it.safeHtml ? (
                      <div
                        className="rr-mail-body no-scrollbar overflow-x-auto leading-relaxed [&_a]:underline [&_img]:h-auto"
                        style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}
                        dangerouslySetInnerHTML={{ __html: it.safeHtml }}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed" style={{ fontSize: 'var(--a-text-md)', color: 'var(--a-text)' }}>
                        {it.body || it.snippet || '(no content)'}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* SMS bubbles (26-I) — outbound right/accent-wash, inbound left/surface */
          <div className="av2-scroll px-3 py-4 pb-8">
            {ordered.map((it, i) => {
              const prev = ordered[i - 1]
              const gapMs = prev ? new Date(it.ts).getTime() - new Date(prev.ts).getTime() : Infinity
              const sep = gapMs > 60 * 60 * 1000
              if (it.category === 'call') {
                return (
                  <div key={it.id} className="my-2 flex flex-col items-center gap-1">
                    <div
                      className="av2-sysnote flex flex-wrap items-center justify-center gap-x-2 rounded-full px-4 py-1"
                      style={{ background: 'var(--a-inset)' }}
                    >
                      <span className="font-medium" style={{ color: 'var(--a-text)' }}>
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
                          style={{ color: 'var(--a-accent)' }}
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
                    <span className="av2-sysnote rounded-full px-4 py-1" style={{ background: 'var(--a-inset)' }}>
                      {it.subject ?? it.snippet ?? it.kind} · {it.tsLabel}
                    </span>
                  </div>
                )
              }
              const out = it.direction === 'out'
              return (
                <div key={it.id} className={cn('flex flex-col', out ? 'items-end' : 'items-start')}>
                  {sep ? <div className="av2-sysnote w-full py-2">{it.tsLabel}</div> : null}
                  <ThreadBubble direction={out ? 'out' : 'in'}>
                    <span className="whitespace-pre-wrap">
                      {it.contentHidden ? <em>Content unavailable</em> : it.body ?? it.snippet ?? ''}
                    </span>
                  </ThreadBubble>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Compose panel (SMS mode) — AI pills + suppression-gated composer ── */}
      {mode === 'sms' ? (
        <div className="av2-composer shrink-0" style={{ paddingBottom: 'max(var(--a-s3), env(safe-area-inset-bottom))' }}>
          {sendError ? <ErrorNote className="mb-2">{sendError}</ErrorNote> : null}
          {canText && smsAllowed ? (
            <>
              <MobileAiPills
                aiDraftAction={aiDraftAction}
                onDraft={(text) => {
                  setSmsDraft(text)
                  setSmsDraftV((v) => v + 1)
                }}
              />
              <SmsComposer key={smsDraftV} initialBody={smsDraft} sendAction={smsAction} personId={personId} />
            </>
          ) : (
            <p
              className="av2-composer__warn rounded-xl p-3"
              style={{ border: '1px solid var(--a-border)', background: 'var(--a-inset)', fontSize: 'var(--a-text-sm)' }}
            >
              {canText
                ? 'Texting is unavailable until A2P 10DLC business registration is Fully Registered.'
                : 'No phone number on file for this contact.'}
            </p>
          )}
        </div>
      ) : null}

      {/* ── Right-edge context drawer handle (AC-26E-06) ─────────────────── */}
      <IconButton
        label="Open contact details"
        onClick={() => setDrawerOpen(true)}
        className="absolute right-0 top-1/2 -translate-y-1/2 rounded-l-md"
        style={{ width: 6, height: 48, padding: 0, border: 'none', background: 'var(--a-text-2)', opacity: 0.4 }}
      >
        {null}
      </IconButton>
      <Sheet open={drawerOpen} onClose={() => setDrawerOpen(false)} title={name}>
        <div className="space-y-2" style={{ fontSize: 'var(--a-text-sm)' }}>
          {context.lastCommunicationLabel ? (
            <p style={{ color: 'var(--a-text-2)' }}>Last communication {context.lastCommunicationLabel}</p>
          ) : null}
          <div>
            {(
              [
                ['Stage', context.stage],
                ['Agent', context.agentName],
                ['Source', context.source],
                ['Price', context.priceLabel],
                ['Timeframe', context.timeframe],
                ['Phone', phone ? fmtPhone(phone) : null],
              ] as Array<[string, string | null]>
            )
              .filter(([, value]) => value)
              .map(([label, value], idx) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 py-2"
                  style={idx > 0 ? { borderTop: '1px solid var(--a-border)' } : undefined}
                >
                  <span style={{ color: 'var(--a-text-2)' }}>{label}</span>
                  <span className="truncate font-medium" style={{ color: 'var(--a-text)' }}>
                    {value}
                  </span>
                </div>
              ))}
          </div>
          {context.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {context.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    border: '1px solid var(--a-border)',
                    borderRadius: 'var(--a-r-sm)',
                    padding: '2px 8px',
                    fontSize: 'var(--a-text-xs)',
                    color: 'var(--a-text-2)',
                    fontWeight: 400,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <Link href={`/admin/people/${personId}`} className="block pt-2 underline" style={{ color: 'var(--a-accent)' }}>
            Open full contact profile
          </Link>
          {addPersonSlot ? <div className="pt-3">{addPersonSlot}</div> : null}
        </div>
      </Sheet>

      {/* ── Email reply sheet (AC-26E-09) ─────────────────────────────────── */}
      <Sheet open={replyOpen} onClose={() => setReplyOpen(false)} title={`Email ${name}`}>
        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {sendError ? <ErrorNote className="mb-3">{sendError}</ErrorNote> : null}
          <EmailComposer
            initialSubject={lastEmailSubject ? `Re: ${lastEmailSubject.replace(/^((re|fwd?):\s*)+/i, '')}` : ''}
            initialBody=""
            signatureHtml={signatureHtml}
            sendAction={emailAction}
            personId={personId}
          />
        </div>
      </Sheet>

      {/* ── S8 calling-method sheet ───────────────────────────────────────── */}
      <Sheet
        open={callOpen}
        onClose={() => setCallOpen(false)}
        title={`Call ${name}`}
        description={phone ? fmtPhone(phone) : undefined}
      >
        <div>
          <Button
            variant="quiet"
            className="w-full"
            style={{
              justifyContent: 'flex-start',
              gap: 12,
              minHeight: 0,
              borderRadius: 0,
              padding: '14px 0',
              fontWeight: 400,
              textAlign: 'left',
              background: 'none',
              border: 'none',
            }}
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
            <Phone className="h-5 w-5" style={{ color: 'var(--a-text)' }} aria-hidden />
            <span>
              <span className="block font-medium" style={{ fontSize: 'var(--a-text-lg)', color: 'var(--a-text)' }}>
                Call via Ryan Realty line
              </span>
              <span className="block" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                Rings your cell, bridges to the contact, recorded + logged
              </span>
            </span>
          </Button>
          {phone ? (
            <a
              href={`tel:${phone.replace(/[^+\d]/g, '')}`}
              className="flex w-full items-center gap-3 py-3.5"
              style={{ borderTop: '1px solid var(--a-border)' }}
            >
              <Smartphone className="h-5 w-5" style={{ color: 'var(--a-text)' }} aria-hidden />
              <span>
                <span className="block font-medium" style={{ fontSize: 'var(--a-text-lg)', color: 'var(--a-text)' }}>
                  Call direct from this phone
                </span>
                <span className="block" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  Uses your phone dialer — not tracked in the CRM
                </span>
              </span>
            </a>
          ) : null}
        </div>
      </Sheet>

      {/* ── Block confirmation (AC-26G-06) ────────────────────────────────── */}
      <ConfirmDialog
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title={`Block ${phone ? fmtPhone(phone) : ''}?`}
        description="Calls from this number will be rejected and texts dropped. You can unblock it from CRM settings, Company, Block list."
        confirmLabel="Block number"
        onConfirm={() => {
          if (!phone) return
          setBlockOpen(false)
          startTransition(async () => {
            const res = await blockAction(phone)
            setNote(res.ok ? `Blocked ${phone}.` : res.error ?? 'Could not block the number')
          })
        }}
      />

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
          renderTemplateAction={groupCompose.renderTemplateAction}
        />
      ) : null}
    </div>
  )
}
