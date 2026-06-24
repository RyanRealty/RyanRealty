'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { SmsConsentDisclosure } from '@/components/site/SmsConsentDisclosure'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { trackCtaClick } from '@/lib/cta-tracking'
import { getLpContext, readRrSessionId } from '@/lib/tracking'
import type { LeadLandingAudience } from '@/lib/lead-landing-content'

type Props = {
  audience: LeadLandingAudience
  pageTitle: string
  pagePath: string
  leadIntent: string
  heading: string
  subheading: string
  buttonLabel: string
}

const TIMELINE_OPTIONS = [
  { value: 'asap', label: 'As soon as possible' },
  { value: '30-days', label: 'Within 30 days' },
  { value: '90-days', label: 'Within 90 days' },
  { value: '3-6-months', label: 'Three to six months' },
  { value: 'just-planning', label: 'Just planning right now' },
]

export default function LeadLandingForm({
  audience,
  pageTitle,
  pagePath,
  leadIntent,
  heading,
  subheading,
  buttonLabel,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [timeframe, setTimeframe] = useState('just-planning')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // Capture the visitor's real first-touch attribution + anonymous session
    // id before the server hop. getLpContext() reads utm_* from the URL and
    // the persisted rr_lp_context; readRrSessionId() returns the uuid that
    // ties this submit to the prior anonymous browsing in visitor_sessions.
    const lpContext = getLpContext()
    const sessionId = readRrSessionId()
    startTransition(async () => {
      const { submitLeadLandingForm } = await import('@/app/actions/lead-landing')
      const result = await submitLeadLandingForm({
        audience,
        pageTitle,
        pagePath,
        leadIntent,
        name,
        email,
        phone,
        timeframe,
        message,
        lpContext,
        sessionId,
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      setSubmitted(true)
      toast.success('Thanks. We will reach out shortly.')
      trackCtaClick({ // hydration-safe — inside the submit handler, not render
        label: buttonLabel,
        destination: pagePath,
        context: `lead_landing:${leadIntent}`,
      })
    })
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        <CardDescription>{subheading}</CardDescription>
      </CardHeader>
      <CardContent>
        {submitted ? (
          <div className="rounded-md border border-success/30 bg-success/10 p-4">
            <p className="text-sm font-semibold text-foreground">Request received</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We will follow up with your custom plan and next steps.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="kb-tool-skin space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-name">Name</Label>
                <Input
                  id="lead-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-email">Email</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lead-phone">Phone</Label>
                <Input
                  id="lead-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-timeframe">Timeline</Label>
                <Select value={timeframe} onValueChange={setTimeframe} name="lead-timeframe">
                  <SelectTrigger id="lead-timeframe">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMELINE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lead-message">What do you need help with</Label>
              <Textarea
                id="lead-message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your goals and timeline."
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? 'Sending request...' : buttonLabel}
            </Button>
            <SmsConsentDisclosure />
          </form>
        )}
      </CardContent>
    </Card>
  )
}
