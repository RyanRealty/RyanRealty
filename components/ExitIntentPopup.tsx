'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { submitExitIntentLead } from '@/app/actions/lead-capture'
import { getLpContext, readRrSessionId } from '@/lib/tracking'

const SESSION_KEY = 'ryan_realty_exit_popup_seen'

// Map the captured LP context (URL utm_* merged with persisted rr_lp_context)
// to the campaign shape FUB expects. Using getLpContext() instead of reading
// the URL directly means a visitor who landed on a Facebook-tagged page and
// then navigated to a non-tagged page still attributes to facebook.
function readCampaign(): {
  source?: string
  medium?: string
  campaign?: string
  term?: string
  content?: string
} {
  if (typeof window === 'undefined') return {}
  const ctx = getLpContext()
  return {
    source: ctx.lp_source,
    medium: ctx.lp_medium,
    campaign: ctx.lp_campaign,
    term: ctx.lp_term,
    content: ctx.lp_content,
  }
}

export default function ExitIntentPopup() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const campaign = useMemo(() => readCampaign(), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem(SESSION_KEY) === '1') return
    const onMouseLeave = (event: MouseEvent) => {
      if (event.clientY > 24) return
      setOpen(true)
      sessionStorage.setItem(SESSION_KEY, '1')
      document.removeEventListener('mouseleave', onMouseLeave)
    }
    document.addEventListener('mouseleave', onMouseLeave)
    return () => document.removeEventListener('mouseleave', onMouseLeave)
  }, [])

  async function handleSubmit() {
    setSubmitting(true)
    setStatus('idle')
    const result = await submitExitIntentLead({
      email,
      context: `exit-intent:${pathname}`,
      pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      campaign,
      sessionId: readRrSessionId(),
    })
    setSubmitting(false)
    setStatus(result.ok ? 'success' : 'error')
    if (result.ok) {
      setTimeout(() => setOpen(false), 900)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Before you go</DialogTitle>
          <DialogDescription>
            Get new listings and market updates sent to your inbox.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            aria-label="Email address"
          />
          {status === 'success' && <p className="text-sm text-success">You are all set.</p>}
          {status === 'error' && <p className="text-sm text-destructive">Please enter a valid email.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Not now
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Get updates'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
