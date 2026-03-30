'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { trackCtaClick } from '@/lib/cta-tracking'

type Props = {
  /** Main heading (e.g., "Get notified about new listings in Bend") */
  title: string
  /** Supporting text */
  subtitle?: string
  /** What type of lead this captures (used for FUB event type) */
  leadType?: 'general' | 'buyer' | 'seller' | 'newsletter'
  /** Context for analytics tracking (e.g., "city_page_bend") */
  trackContext?: string
  /** Optional CTA button label override */
  buttonLabel?: string
  /** Optional className */
  className?: string
  /** Optional city/area for lead attribution */
  area?: string
}

/**
 * PageCTA — contextual mid-page lead capture component.
 *
 * Used on city, community, listing, and content pages to capture email/phone
 * for lead generation. Each submission creates a lead in Follow Up Boss.
 *
 * Per master plan: StickyMobileCTA and SiteLeadCaptureBanner must not both
 * be visible simultaneously with this component.
 */
export default function PageCTA({
  title,
  subtitle,
  leadType = 'general',
  trackContext = 'page_cta',
  buttonLabel = 'Get Started',
  className,
  area,
}: Props) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() && !phone.trim()) {
      toast.error('Please enter your email or phone number')
      return
    }

    startTransition(async () => {
      try {
        const { submitPageCTA } = await import('@/app/actions/lead-capture')
        const result = await submitPageCTA({
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          leadType,
          context: trackContext,
          area: area || undefined,
        })
        if (result?.error) {
          toast.error(result.error)
        } else {
          setSubmitted(true)
          toast.success('Thank you! We will be in touch.')
          trackCtaClick({ label: buttonLabel, destination: 'lead_capture', context: trackContext })
        }
      } catch {
        toast.error('Something went wrong. Please try again.')
      }
    })
  }

  if (submitted) {
    return (
      <Card className={cn('border-success/30 bg-success/5', className)}>
        <CardContent className="p-6 text-center sm:p-8">
          <p className="text-lg font-semibold text-foreground">Thank you!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            We received your information and will be in touch soon.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-6 sm:p-8">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              {subtitle}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mx-auto mt-6 max-w-md space-y-4">
          <div>
            <Label htmlFor="cta-email" className="sr-only">Email</Label>
            <Input
              id="cta-email"
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
          </div>
          <div>
            <Label htmlFor="cta-phone" className="sr-only">Phone (optional)</Label>
            <Input
              id="cta-phone"
              type="tel"
              placeholder="Phone number (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isPending}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Sending...' : buttonLabel}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            No spam. Unsubscribe anytime.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
