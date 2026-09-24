'use client'

// @no-parity — internal admin tool (principal broker review mode)
//
// The decision on the item on screen, then straight to the next one. Same
// stamp as the queue's SignOffControls (recordPrincipalReview writes the named,
// dated OAR 863-015-0140 review record); what changes is the flow:
//   - a failure shows in place instead of an alert box,
//   - "Send back" asks for the reason in a field, not a browser prompt,
//   - success moves to the next item in line instead of reloading the queue.
// J and K step through the queue without deciding anything. No key signs off:
// a review record is a legal record and takes a deliberate click.
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, TextAreaField } from '@/components/admin/v2'
import { recordPrincipalReview } from '@/app/actions/tc-signoff'

export function ReviewDecision({
  itemId,
  itemName,
  afterHref,
  prevHref,
  nextHref,
}: {
  itemId: string
  itemName: string
  afterHref: string
  prevHref: string | null
  nextHref: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [sendingBack, setSendingBack] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      const key = e.key.toLowerCase()
      if (key === 'j' && nextHref) router.push(nextHref, { scroll: false })
      if (key === 'k' && prevHref) router.push(prevHref, { scroll: false })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, nextHref, prevHref])

  const decide = (decision: 'approved' | 'sent_back') =>
    startTransition(async () => {
      setError(null)
      const res = await recordPrincipalReview(itemId, decision, decision === 'sent_back' ? reason : undefined)
      if (!res.ok) {
        setError(res.error || 'The review was not recorded. Try again.')
        return
      }
      setSendingBack(false)
      setReason('')
      router.push(afterHref, { scroll: false })
      router.refresh()
    })

  return (
    <div className="av2-review__decide">
      {sendingBack ? (
        <form
          className="av2-review__sendback"
          onSubmit={(e) => {
            e.preventDefault()
            decide('sent_back')
          }}
        >
          <TextAreaField
            label={`Why is “${itemName}” going back to the broker?`}
            hint="The broker gets this note by email with a link to the file."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
          />
          <div className="av2-review__row">
            <Button type="submit" variant="quiet" disabled={pending}>
              {pending ? 'Sending back…' : 'Send back'}
            </Button>
            <Button type="button" variant="quiet" disabled={pending} onClick={() => setSendingBack(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="av2-review__row">
          <Button touch disabled={pending} onClick={() => decide('approved')}>
            {pending ? 'Recording…' : 'Sign off'}
          </Button>
          <Button touch variant="quiet" disabled={pending} onClick={() => setSendingBack(true)}>
            Send back
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="av2-review__error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
