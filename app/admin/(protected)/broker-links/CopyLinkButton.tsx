'use client'

// P11D: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
// Carried over verbatim: the navigator.clipboard.writeText(url) call, the
// 1500ms confirmation window, the swallowed clipboard rejection, and the
// Copy/Copied labels. Shape changed, behavior did not: the shadcn button became
// the v2 primitive, quiet variant — fifteen solid accent buttons on one page is
// the color wall ADMIN_UI §1 reserves color against.

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/admin/v2'

/** Copy a per-broker ad URL to the clipboard with a brief confirmation. */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="quiet"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard blocked — no-op */
        }
      }}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}
