'use client'

/**
 * Mobile listing fold actions, beside the price: Talk to a broker, Watch this
 * price, Walk through it. Reuses the existing contact, price-watch, and book
 * flows. Not a sticky/fixed bar (Matt lock).
 */
import { useCallback, useId, useState, useTransition } from 'react'
import { submitListingPriceDropWatch } from '@/app/actions/search-alert-capture'
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
import { readRrSessionId } from '@/lib/tracking'

export function ListingFoldActions({
  listingKey,
  addressLine,
  askHref,
  walkHref,
}: {
  listingKey: string
  addressLine: string
  askHref: string
  walkHref: string
}) {
  const [watchOpen, setWatchOpen] = useState(false)
  const home = addressLine.trim() || 'this home'

  return (
    <div className="listing-face__fold" id="listing-fold-actions">
      <a className="listing-face__fold-action" href={askHref}>
        Talk to a broker
      </a>
      <a
        className="listing-face__fold-action"
        href="#close"
        onClick={(event) => {
          event.preventDefault()
          setWatchOpen(true)
        }}
      >
        Watch this price
      </a>
      <a className="listing-face__fold-action listing-face__fold-action--primary" href={walkHref}>
        Walk through it
      </a>
      <ListingWatchPriceSheet
        listingKey={listingKey}
        addressLine={home}
        open={watchOpen}
        onOpenChange={setWatchOpen}
      />
    </div>
  )
}

function ListingWatchPriceSheet({
  listingKey,
  addressLine,
  open,
  onOpenChange,
}: {
  listingKey: string
  addressLine: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const uid = useId().replace(/:/g, '')
  const [email, setEmail] = useState('')
  const [trap, setTrap] = useState('')
  const [state, setState] = useState<'idle' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = useCallback(() => {
    setError(null)
    start(async () => {
      const res = await submitListingPriceDropWatch({
        email,
        listingKey,
        addressLine,
        company: trap,
        sessionId: readRrSessionId(),
      })
      if (res.ok) setState('done')
      else setError(res.error)
    })
  }, [email, listingKey, addressLine, trap])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" overlayClassName="bg-foreground/50">
        <SheetHeader>
          <SheetTitle>Watch this price</SheetTitle>
          <SheetDescription>
            {state === 'done'
              ? `We are watching the price on ${addressLine}.`
              : 'One email per price change on this home. Nothing else, and you can unsubscribe any time.'}
          </SheetDescription>
        </SheetHeader>
        {state === 'done' ? (
          <p className="px-4 text-sm text-muted-foreground">
            One email per price change on this home, and nothing else. Unsubscribe any time from any of
            them.
          </p>
        ) : (
          <form
            className="flex flex-col gap-3 px-4"
            onSubmit={(event) => {
              event.preventDefault()
              submit()
            }}
          >
            <p className="text-sm text-muted-foreground">
              Sellers move on price more often than they move on anything else. Leave your email and we
              will tell you the day this one changes.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${uid}-watch-email`}>Your email</Label>
              <Input
                id={`${uid}-watch-email`}
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="sr-only" aria-hidden="true">
              <Label htmlFor={`${uid}-watch-company`}>Company</Label>
              <Input
                id={`${uid}-watch-company`}
                name="company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={trap}
                onChange={(event) => setTrap(event.target.value)}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <SheetFooter>
              <Button type="submit" disabled={pending}>
                {pending ? 'Setting it up…' : 'Watch this price'}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
