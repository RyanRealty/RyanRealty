'use client'

/**
 * One-off admin email to an arbitrary address — a thin host around the
 * canonical EmailComposer (Matt directive 2026-07-15: every email send uses
 * the same interface). This surface only adapts the composer's FormData to
 * sendAdminEmail's {to, subject, body} signature; the suppression check
 * lives in the action (fails closed).
 *
 * 11F: presentation migrated to the LOCKED admin v2 language (ADMIN_UI.md).
 * PRESENTATION ONLY — sendAction's validation/parsing, the recipient/subject/
 * body extraction, the error/success messages and the router.refresh() are
 * byte-for-byte unchanged. The wrapping <Card> became the v2 av2-pane and the
 * message text moved to v2 tokens.
 *
 * EmailComposer stays imported from components/admin/crm/EmailComposer
 * UNCHANGED and MOUNTED AS-IS: it is the G50 compose chokepoint
 * (ci:composer-discipline — "every send uses the same interface"), the same
 * sanctioned exception already recorded for CommsSection.tsx /
 * SendSection.tsx in check-admin-v2-tokens.mjs. Rebuilding or re-skinning it
 * here would fork the one canonical send surface.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendAdminEmail } from '@/app/actions/admin-email'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'

type Props = { className?: string }

export default function AdminEmailCompose({ className = '' }: Props) {
  const router = useRouter()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // Re-key after a successful send so the composer resets to a blank draft.
  const [resetV, setResetV] = useState(0)

  async function sendAction(fd: FormData) {
    setMessage(null)
    let to = ''
    try {
      to = ((JSON.parse(String(fd.get('to') || '[]')) as string[])[0] ?? '').trim()
    } catch {
      to = ''
    }
    const subject = String(fd.get('subject') ?? '').trim()
    const body = String(fd.get('body') ?? '').trim()
    if (!to) {
      setMessage({ type: 'error', text: 'Enter recipient email' })
      return
    }
    if (!subject) {
      setMessage({ type: 'error', text: 'Enter subject' })
      return
    }
    const result = await sendAdminEmail({ to, subject, body })
    if (result.error) {
      setMessage({ type: 'error', text: result.error })
      return
    }
    setMessage({ type: 'success', text: 'Email sent.' })
    setResetV((v) => v + 1)
    router.refresh()
  }

  return (
    <div className={`av2-pane ${className}`}>
      <EmailComposer
        key={resetV}
        initialSubject=""
        initialBody=""
        signatureHtml={null}
        sendAction={sendAction}
        hideAttachments
        footnote="Sends one email from the Ryan Realty transactional mailbox. Suppressed recipients are blocked automatically."
      />
      {message ? (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 'var(--a-text-sm)',
            color: message.type === 'error' ? 'var(--a-danger)' : 'var(--a-ok)',
          }}
        >
          {message.text}
        </p>
      ) : null}
    </div>
  )
}
