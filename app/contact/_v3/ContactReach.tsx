/**
 * One reach control: Call at display scale (house-doors) plus Text / Email /
 * Schedule as one Button Group. Not four identical V3Doors arrow rows.
 */
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { V3Doors, v3Text } from '@/components/site/v3'
import { CONTACT } from '@/lib/brand/contact'

export function ContactReach({
  hours,
  id = 'reach',
}: {
  hours: ReactNode
  id?: string
}) {
  return (
    <div className="contact-reach" id={id}>
      <V3Doors
        id={`${id}-call`}
        name={v3Text('Reach a broker')}
        doors={[
          {
            kicker: v3Text('Call'),
            label: v3Text(CONTACT.phoneDirect),
            fact: v3Text('One number for the whole brokerage'),
            href: `tel:${CONTACT.phoneDirectTel}`,
            primary: true,
            live: hours,
          },
        ]}
      />
      <ButtonGroup className="contact-reach__alts" aria-label="Text, email, or schedule">
        <Button asChild variant="outline">
          <a href={`sms:${CONTACT.phoneDirectTel}`}>Text</a>
        </Button>
        <Button asChild variant="outline">
          <a href={`mailto:${CONTACT.email.primary}`}>Email</a>
        </Button>
        <Button asChild variant="outline">
          <Link href="/book">Schedule</Link>
        </Button>
      </ButtonGroup>
    </div>
  )
}
