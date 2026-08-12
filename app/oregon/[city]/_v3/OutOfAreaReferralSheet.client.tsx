'use client'

/**
 * The out-of-area city page's one ask, as a barrel Sheet.
 *
 * THE CAPTURE CONTRACT IS UNCHANGED, ALL FIVE KEYS. It calls the same server
 * action the KB section called, `submitOutOfAreaReferral` in
 * app/actions/out-of-area-referral.ts, with the same payload keys and the same
 * field names: `citySlug`, `name`, `email`, `notes`, `company`. Everything
 * downstream of the action is untouched: ensureNativeLead with
 * `source: 'out-of-area-lp'`, the `geo:out-of-area` + `referral:candidate` tags
 * (the second of which hard-gates autoEnrollPerson, so nothing auto-sends to the
 * lead), the queued broker alert, and the follow-up task.
 *
 * `company` IS THE HONEYPOT, AND IT IS THE ACTION'S ONLY BOT DETERRENT. Nothing
 * rate-limits submitOutOfAreaReferral and no captcha stands in front of it, so
 * its `if (input.company?.trim()) return { ok: true }` branch is the whole
 * defence. Drop that key and every scripted POST creates a real CRM person, an
 * origin note, a 240-minute broker task, and a queued SMS to a broker's phone.
 * An earlier revision of this file did drop it, reasoning that the barrel had no
 * hidden control and was frozen. That reasoning did not survive the barrel's own
 * contract: components/site/v3/index.ts states that a migration needing a control
 * the set lacks ADDS a primitive there, and that new props on the six patterns
 * are ordinary. So the trap came back the sanctioned way, as `trap` on V3Sheet,
 * which renders the input off-screen, out of the tab order, and out of the
 * accessibility tree, and hands its value back through `answers`. Nothing is
 * hand-rolled in this file, so ci:design-tokens' raw-primitive rule is untouched.
 *
 * Client because the step the visitor is on and the answers carried forward are
 * visitor-caused state, and because the send happens from the browser.
 *
 * CONTROLLED, on purpose, the same way MarketInquirySheet is: `steps` and
 * `currentStepId` derive from one status value and change together, so the sheet
 * never sees an id that names no step, and while a send is in flight the only
 * rendered step is terminal, so a second click cannot fire a second submit.
 */

import { useCallback, useRef, useState } from 'react'
import { V3Sheet, type V3SheetAdvance, type V3SheetStep } from '@/components/site/v3'
import { submitOutOfAreaReferral } from '@/app/actions/out-of-area-referral'

type Status = 'asking' | 'sending' | 'sent' | 'failed'

export function OutOfAreaReferralSheet({
  citySlug,
  cityName,
}: {
  citySlug: string
  cityName: string
}) {
  const [status, setStatus] = useState<Status>('asking')
  const [stepId, setStepId] = useState<string>('notes')
  const [problem, setProblem] = useState<string>('')
  // The answers the sheet reported on the last advance, kept so a retry after a
  // failed send resubmits what the visitor already typed instead of asking again.
  const answersRef = useRef<Record<string, string>>({})

  /** The three questions. Field names are the capture contract, do not rename. */
  const askSteps: readonly V3SheetStep[] = [
    {
      id: 'notes',
      label: `What are you looking for in ${cityName}?`,
      children: `Tell us what you are looking for in ${cityName}. We find a local broker who fits, make the introduction, and step back. No cost to you, no obligation.`,
      field: {
        kind: 'textarea',
        name: 'notes',
        label: 'What you are looking for',
        rows: 3,
        maxLength: 1000,
        placeholder: 'Buying, selling, budget, timing',
      },
      advanceLabel: 'Continue',
    },
    {
      id: 'name',
      label: 'Who should the broker ask for?',
      field: {
        name: 'name',
        label: 'Your name',
        autoComplete: 'name',
        maxLength: 120,
      },
      advanceLabel: 'Continue',
    },
    {
      id: 'email',
      label: 'Where should the introduction go?',
      children: 'One introduction. Your email goes to our team, not a list.',
      field: {
        kind: 'email',
        name: 'email',
        label: 'Email',
        required: true,
        autoComplete: 'email',
        maxLength: 254,
        placeholder: 'you@email.com',
        requiredMessage: 'An email is required so the introduction has somewhere to land.',
        invalidMessage: 'That address does not look complete.',
      },
      advanceLabel: 'Connect me',
    },
  ]

  const send = useCallback(
    async (answers: Readonly<Record<string, string>>) => {
      setStatus('sending')
      try {
        const result = await submitOutOfAreaReferral({
          citySlug,
          name: answers.name ?? '',
          email: answers.email ?? '',
          notes: answers.notes ?? '',
          // The trap's answer, under the key the action's honeypot branch reads.
          company: answers.company ?? '',
        })
        if (result.ok) {
          setStatus('sent')
          return
        }
        setProblem(result.error)
        setStatus('failed')
      } catch {
        // A thrown send is the same visitor-facing fact as a rejected one:
        // nothing was captured. Saying so beats a spinner that never resolves.
        setProblem('That did not send. Check the connection and try again.')
        setStatus('failed')
      }
    },
    [citySlug],
  )

  const onAdvance = useCallback(
    (event: V3SheetAdvance) => {
      answersRef.current = { ...event.answers }
      if (event.toStepId !== null) return
      void send(answersRef.current)
    },
    [send],
  )

  const steps: readonly V3SheetStep[] =
    status === 'sent'
      ? [
          {
            id: 'sent',
            label: `Got it. A broker from our team reads this today and connects you with a ${cityName} agent. Watch your inbox.`,
          },
        ]
      : status === 'sending'
        ? [{ id: 'sending', label: 'Sending your request.' }]
        : status === 'failed'
          ? [...askSteps, { id: 'failed', label: problem, advanceLabel: 'Try again' }]
          : askSteps

  const currentStepId =
    status === 'sent'
      ? 'sent'
      : status === 'sending'
        ? 'sending'
        : status === 'failed'
          ? 'failed'
          : stepId

  return (
    <V3Sheet
      id="referral"
      eyebrow="The referral"
      heading={`Get a ${cityName} broker introduction`}
      steps={steps}
      // Same name the KB form baited with, because the action reads that key.
      trap={{ name: 'company', label: 'Company' }}
      currentStepId={currentStepId}
      showProgress={status === 'asking'}
      onStepChange={(id) => {
        // Backing out of the failure screen returns the sheet to the questions.
        if (id !== 'failed' && id !== 'sent' && id !== 'sending') setStatus('asking')
        setStepId(id)
      }}
      onAdvance={onAdvance}
    />
  )
}
