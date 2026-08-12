'use client'

/**
 * The valuation spine as a barrel Sheet. Client only because the step state and the
 * answer echo are interactive. The step contract carries the continuity requirement:
 * the address entered in step one is visible in step two.
 */
import { V3Sheet } from '@/components/site/v3'

export function BarrelSheet() {
  return (
    <V3Sheet
      heading="What is your home worth?"
      eyebrow="Free written valuation"
      steps={[
        {
          id: 'address',
          label: 'Property address',
          field: {
            name: 'address',
            label: 'Property address',
            placeholder: 'Street address, Bend OR',
            required: true,
            autoComplete: 'street-address',
            requiredMessage: 'Enter the address you want valued.',
          },
          advanceLabel: 'Continue',
        },
        {
          id: 'email',
          label: 'Where should we send it?',
          field: {
            kind: 'email',
            name: 'email',
            label: 'Email',
            placeholder: 'you@email.com',
            required: true,
            autoComplete: 'email',
            requiredMessage: 'We need an email to send the valuation to.',
          },
          advanceLabel: 'Send my valuation',
        },
      ]}
    />
  )
}
