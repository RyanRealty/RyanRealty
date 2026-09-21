/**
 * Equal four-up reach on About. Catalog Button Group, not editorial doors.
 *
 * Official demo chrome: one ButtonGroup, four outline Buttons, same weight.
 * Call | Text | Email | Schedule. Live hours stay V3OnDuty above this.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { CONTACT } from '@/lib/brand/contact'

export function AboutReach({ id = 'reach' }: { id?: string } = {}) {
  return (
    <section id={id} className="about-reach" aria-label="Reach a broker">
      <ButtonGroup aria-label="Call, text, email, or schedule">
        <Button asChild variant="outline">
          <a href={`tel:${CONTACT.phoneDirectTel}`}>Call</a>
        </Button>
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
    </section>
  )
}
