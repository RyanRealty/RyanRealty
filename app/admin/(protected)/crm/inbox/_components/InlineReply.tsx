'use client'

/**
 * InlineReply — the inbox inline reply compose (spec §08 §7, AC-13/14/15/16/21).
 *
 * NOT a modal: collapsed, it shows the Reply / Reply All / Forward action row
 * (plus Text when the contact has a phone); clicking one expands the compose
 * area inline below the thread (AC-13). The compose area carries the quick-tag
 * row (AC-15), the channel composers, Discard, and the Send ▾ / Send-and-Close
 * compound action (AC-16, wired through the composers).
 *
 * Every send posts through the EXISTING suppression-gated actions
 * (sendCrmSmsAction / sendCrmEmailAction) pre-bound by the server page — this
 * component NEVER introduces a new send path. The SMS composer is replaced by a
 * registration prompt when A2P is not Fully Registered (AC-21).
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, FilterChip, SearchField } from '@/components/admin/v2'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'

type Channel = 'text' | 'email'

/** Quick-tag row — exact CRM labels (spec §7.3). */
const QUICK_TAGS = ['Introduction', 'Follow Up', 'Still Buying', 'Nurture Lead']

export default function InlineReply({
  smsAction,
  emailAction,
  smsAndCloseAction,
  emailAndCloseAction,
  personId,
  signatureHtml,
  canText,
  canEmail,
  smsAllowed = true,
  initialSmsBody = '',
  initialEmailSubject = '',
  initialEmailBody = '',
  saveSmsDraftAction,
  saveEmailDraftAction,
  discardDraftAction,
  addTagAction,
  lastEmailSubject = null,
  startOpen = false,
  hasTextDraft = false,
  hasEmailDraft = false,
}: {
  smsAction: (formData: FormData) => Promise<void>
  emailAction: (formData: FormData) => Promise<void>
  smsAndCloseAction: (formData: FormData) => Promise<void>
  emailAndCloseAction: (formData: FormData) => Promise<void>
  /** Contact the reply targets — enables composer attachments (upload scoping). */
  personId?: number
  signatureHtml: string | null
  canText: boolean
  canEmail: boolean
  /** False when A2P 10DLC registration is not Fully Registered (AC-21). */
  smsAllowed?: boolean
  initialSmsBody?: string
  initialEmailSubject?: string
  initialEmailBody?: string
  saveSmsDraftAction?: (formData: FormData) => Promise<void>
  saveEmailDraftAction?: (formData: FormData) => Promise<void>
  /** Discards the saved draft for the given channel (§7.4 Discard). */
  discardDraftAction: (channel: Channel) => Promise<{ ok: boolean; error?: string }>
  /** Adds a quick-tag to the contact instantly (§7.3). */
  addTagAction: (tag: string) => Promise<{ ok: boolean; error?: string }>
  /** Subject of the latest email in the thread — drives Re:/Fwd: prefills. */
  lastEmailSubject?: string | null
  /** True when arriving via Compose (?compose=1) — open expanded. */
  startOpen?: boolean
  hasTextDraft?: boolean
  hasEmailDraft?: boolean
}) {
  const router = useRouter()
  const hasDraft = (hasTextDraft && canText) || (hasEmailDraft && canEmail)
  const [open, setOpen] = useState(startOpen || hasDraft)
  // A saved draft on a channel pre-selects it; otherwise text when available.
  const [channel, setChannel] = useState<Channel>(
    hasTextDraft && canText ? 'text' : hasEmailDraft && canEmail ? 'email' : canText ? 'text' : 'email',
  )
  const [emailSubject, setEmailSubject] = useState(initialEmailSubject)
  const [emailBody, setEmailBody] = useState(initialEmailBody)
  const [composeKey, setComposeKey] = useState(0)
  const [customTagOpen, setCustomTagOpen] = useState(false)
  const [customTag, setCustomTag] = useState('')
  const [tagNote, setTagNote] = useState<string | null>(null)
  const [tagPending, startTagTransition] = useTransition()

  if (!canText && !canEmail) {
    return (
      <p
        style={{
          borderRadius: 'var(--a-r-lg)',
          border: '1px solid var(--a-border)',
          background: 'var(--a-inset)',
          padding: 'var(--a-s3)',
          fontSize: 'var(--a-text-sm)',
          color: 'var(--a-text-2)',
        }}
      >
        No phone or email on file for this contact. Add one on the contact card to reply.
      </p>
    )
  }

  const openEmail = (mode: 'reply' | 'replyAll' | 'forward') => {
    const base = (lastEmailSubject ?? '').replace(/^((re|fwd?):\s*)+/i, '')
    if (base) {
      setEmailSubject(mode === 'forward' ? `Fwd: ${base}` : `Re: ${base}`)
    } else {
      setEmailSubject(initialEmailSubject)
    }
    setEmailBody(initialEmailBody)
    setChannel('email')
    setComposeKey((k) => k + 1)
    setOpen(true)
  }

  const addTag = (tag: string) => {
    setTagNote(null)
    startTagTransition(async () => {
      const res = await addTagAction(tag)
      setTagNote(res.ok ? `Tagged "${tag}"` : res.error ?? 'Could not add the tag')
      if (res.ok) router.refresh()
    })
  }

  const discard = () => {
    void discardDraftAction(channel).then(() => {
      setOpen(false)
      setEmailSubject('')
      setEmailBody('')
      setComposeKey((k) => k + 1)
      router.refresh()
    })
  }

  // ── Collapsed: the Reply / Reply All / Forward action row (AC-13) ──────────
  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {canEmail ? (
          <>
            <Button variant="quiet" onClick={() => openEmail('reply')}>
              Reply
            </Button>
            <Button variant="quiet" onClick={() => openEmail('replyAll')}>
              Reply All
            </Button>
            <Button variant="quiet" onClick={() => openEmail('forward')}>
              Forward
            </Button>
          </>
        ) : null}
        {canText ? (
          <Button
            variant="quiet"
            onClick={() => {
              setChannel('text')
              setOpen(true)
            }}
          >
            Text
          </Button>
        ) : null}
      </div>
    )
  }

  // ── Expanded inline compose ────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Channel toggle + Discard */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {canText ? (
            <FilterChip
              pressed={channel === 'text'}
              onClick={() => setChannel('text')}
              style={{
                fontFamily: 'var(--a-font)',
                fontSize: 'var(--a-text-sm)',
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: 'var(--a-r-md)',
                border: '1px solid transparent',
                background: channel === 'text' ? 'var(--a-btn-bg)' : 'transparent',
                color: channel === 'text' ? 'var(--a-btn-fg)' : 'var(--a-text-2)',
              }}
            >
              Text{hasTextDraft ? ' · draft' : ''}
            </FilterChip>
          ) : null}
          {canEmail ? (
            <FilterChip
              pressed={channel === 'email'}
              onClick={() => setChannel('email')}
              style={{
                fontFamily: 'var(--a-font)',
                fontSize: 'var(--a-text-sm)',
                fontWeight: 600,
                padding: '7px 14px',
                borderRadius: 'var(--a-r-md)',
                border: '1px solid transparent',
                background: channel === 'email' ? 'var(--a-btn-bg)' : 'transparent',
                color: channel === 'email' ? 'var(--a-btn-fg)' : 'var(--a-text-2)',
              }}
            >
              Email{hasEmailDraft ? ' · draft' : ''}
            </FilterChip>
          ) : null}
        </div>
        <Button variant="quiet" style={{ color: 'var(--a-text-2)' }} onClick={discard}>
          Discard
        </Button>
      </div>

      {/* Quick-tag row (spec §7.3, AC-15) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK_TAGS.map((t) => (
          <span
            key={t}
            role="button"
            tabIndex={0}
            aria-disabled={tagPending}
            className="av2-chip"
            onClick={() => addTag(t)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') addTag(t)
            }}
          >
            + {t}
          </span>
        ))}
        {customTagOpen ? (
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (customTag.trim()) {
                addTag(customTag.trim())
                setCustomTag('')
                setCustomTagOpen(false)
              }
            }}
          >
            <SearchField
              autoFocus
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Tag name"
              aria-label="Tag name"
              style={{ width: 128, minHeight: 28, padding: '4px 8px', fontSize: 'var(--a-text-xs)' }}
            />
            <Button
              type="submit"
              variant="quiet"
              style={{
                minHeight: 0,
                fontFamily: 'var(--a-font)',
                fontSize: 'var(--a-text-xs)',
                fontWeight: 600,
                color: 'var(--a-accent)',
                background: 'none',
                border: 'none',
                padding: '4px 8px',
              }}
            >
              Add
            </Button>
          </form>
        ) : (
          <span
            role="button"
            tabIndex={0}
            className="av2-chip"
            onClick={() => setCustomTagOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setCustomTagOpen(true)
            }}
          >
            + Custom
          </span>
        )}
        {tagNote ? (
          <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>{tagNote}</span>
        ) : null}
      </div>

      {channel === 'text' && canText ? (
        smsAllowed ? (
          <SmsComposer
            initialBody={initialSmsBody}
            sendAction={smsAction}
            sendAndCloseAction={smsAndCloseAction}
            saveDraftAction={saveSmsDraftAction}
            personId={personId}
          />
        ) : (
          <p
            className="av2-composer__warn"
            style={{
              borderRadius: 'var(--a-r-lg)',
              border: '1px solid var(--a-warn)',
              background: 'var(--a-warn-wash)',
              padding: 'var(--a-s3)',
              fontSize: 'var(--a-text-sm)',
            }}
          >
            Texting is unavailable until A2P 10DLC business registration is Fully Registered. Email
            still sends normally.
          </p>
        )
      ) : null}
      {channel === 'email' && canEmail ? (
        <EmailComposer
          key={composeKey}
          initialSubject={emailSubject}
          initialBody={emailBody}
          signatureHtml={signatureHtml}
          sendAction={emailAction}
          sendAndCloseAction={emailAndCloseAction}
          saveDraftAction={saveEmailDraftAction}
          personId={personId}
        />
      ) : null}
    </div>
  )
}
