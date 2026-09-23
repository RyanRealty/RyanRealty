'use client'

/**
 * PersonalLinkCopy — copy this contact's personal site link (P7 identity loop).
 *
 * For the channels we cannot decorate automatically: a Facebook or Instagram
 * DM, a reply typed in Gmail, a text from a broker's own phone. The link is
 * minted server-side by lib/identity/outbound-links.ts (signed person token,
 * channel 'personal'), so when the contact taps it their visit is identified
 * and shows up on /admin/visitors/live and this record, exactly like a tracked
 * email click. It carries no email, phone or name.
 */
import { useState } from 'react'
import { Button } from '@/components/admin/v2'

export function PersonalLinkCopy({ href }: { href: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2" style={{ fontSize: 'var(--a-text-sm)' }}>
      <Button
        variant="quiet"
        type="button"
        onClick={() => {
          navigator.clipboard
            ?.writeText(href)
            .then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 2000)
            })
            .catch(() => setCopied(false))
        }}
      >
        {copied ? 'Copied' : 'Copy personal link'}
      </Button>
      <span style={{ color: 'var(--a-text-2)' }}>
        Paste it in a DM, a Gmail reply or a text. When they tap it, their visit shows up here.
      </span>
    </div>
  )
}
