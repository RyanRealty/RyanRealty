'use client'

/**
 * Guest save capture — the email-first branch of the listing Save button.
 *
 * SITE-99: this is the installed shadcn Sheet demo (right-side panel, visible
 * SheetTitle / SheetDescription / SheetFooter, default close). Not a cream
 * bottom drawer and not a V3Sheet.
 */

import { useCallback, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { submitListingSaveCapture } from '@/app/actions/search-alert-capture'
import { readRrSessionId } from '@/lib/tracking'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function ListingGuestSaveSheet({
  listingKey,
  addressLine,
  onUseGoogle,
  onDone,
  open = true,
  onOpenChange,
}: {
  listingKey: string
  addressLine: string | null
  /** The existing OAuth path (stash pending save + open the Google sheet). */
  onUseGoogle: () => void
  /** Called after a successful capture so the caller can reflect saved state. */
  onDone?: () => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [problem, setProblem] = useState<string>('')
  const home = addressLine?.trim() || 'this home'

  const send = useCallback(
    async (email: string, company: string) => {
      setStatus('sending')
      try {
        const result = await submitListingSaveCapture({
          email,
          listingKey,
          addressLine: addressLine ?? undefined,
          company,
          sessionId: readRrSessionId(),
        })
        if (result.ok) {
          setStatus('sent')
          onDone?.()
          return
        }
        setProblem(result.error)
        setStatus('failed')
      } catch {
        setProblem('That did not send. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [listingKey, addressLine, onDone],
  )

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '')
    const company = String(data.get('company') ?? '')
    void send(email, company)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="top-16">
        <SheetHeader>
          <SheetTitle>Save this home</SheetTitle>
          <SheetDescription>
            {status === 'sent'
              ? `Saved. Updates on ${home} land by email.`
              : `Watch ${home} by email. Price changes and status updates. Unsubscribe any time.`}
          </SheetDescription>
        </SheetHeader>
        {status === 'sent' ? (
          <p className="px-4 text-sm text-muted-foreground">
            Sign in with Google any time to see every home you have saved in one place.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3 px-4">
            <div className="sr-only" aria-hidden>
              <Label htmlFor="guest-save-company">Company</Label>
              <Input
                id="guest-save-company"
                name="company"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="guest-save-email">Email</Label>
              <Input
                id="guest-save-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                placeholder="you@email.com"
              />
            </div>
            {status === 'failed' ? (
              <p className="text-sm text-destructive">{problem}</p>
            ) : null}
            <SheetFooter>
              <Button type="submit" disabled={status === 'sending'}>
                {status === 'sending' ? 'Saving this home.' : 'Save this home'}
              </Button>
              <Button type="button" variant="outline" onClick={onUseGoogle}>
                Save with Google instead
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
