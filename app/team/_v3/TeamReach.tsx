/**
 * Per-broker reach on /team. Official demo chrome: one ButtonGroup, four
 * outline Buttons, same weight. Call | Text | Email | Schedule. No phone
 * number on the Call label (mannered-copy billboard refuse).
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import type { AboutFace } from '@/app/about/_v3/about-faces'

export function TeamReach({ person }: { person: AboutFace }) {
  if (!person.tel && !person.email && !person.bookHref) return null
  return (
    <ButtonGroup className="w-full" aria-label={`Call, text, email, or schedule ${person.name}`}>
      {person.tel ? (
        <Button asChild variant="outline" className="flex-1">
          <a href={`tel:${person.tel}`}>Call</a>
        </Button>
      ) : null}
      {person.tel ? (
        <Button asChild variant="outline" className="flex-1">
          <a href={`sms:${person.tel}`}>Text</a>
        </Button>
      ) : null}
      {person.email ? (
        <Button asChild variant="outline" className="flex-1">
          <a href={`mailto:${person.email}`}>Email</a>
        </Button>
      ) : null}
      {person.bookHref ? (
        <Button asChild variant="outline" className="flex-1">
          <Link href={person.bookHref}>Schedule</Link>
        </Button>
      ) : null}
    </ButtonGroup>
  )
}
