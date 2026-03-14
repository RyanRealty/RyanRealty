'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { AgentDetail } from '@/app/actions/agents'
import { Button } from "@/components/ui/button"

type Props = {
  broker: AgentDetail
}

const BIO_TRUNCATE_LEN = 400

export default function BrokerBio({ broker }: Props) {
  const firstName = broker.display_name.split(' ')[0] ?? broker.display_name
  const bio = broker.bio?.trim() ?? ''
  const [expanded, setExpanded] = useState(false)
  const truncated = bio.length > BIO_TRUNCATE_LEN ? bio.slice(0, BIO_TRUNCATE_LEN) + '…' : bio
  const showMore = bio.length > BIO_TRUNCATE_LEN

  return (
    <section className="bg-muted px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="broker-bio-heading">
      <div className="mx-auto max-w-7xl">
        <h2 id="broker-bio-heading" className="text-2xl font-bold tracking-tight text-primary">
          About {firstName}
        </h2>
        {bio ? (
          <div className="mt-4">
            <div className="prose prose-primary max-w-none text-muted-foreground">
              {(expanded ? bio : truncated).split(/\n\n+/).map((p, i) => (
                <p key={i} className="mt-3">
                  {p.trim()}
                </p>
              ))}
            </div>
            {showMore && (
              <Button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="mt-3 text-sm font-semibold text-accent-foreground hover:underline"
              >
                {expanded ? 'Read less' : 'Read more'}
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-4 text-muted-foreground">
            {firstName} is a dedicated real estate professional serving Central Oregon. Get in touch to learn how they can help with your next move.
          </p>
        )}
        {(broker.specialties ?? []).filter((s): s is string => Boolean(s?.trim())).length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-primary">Specialties</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {(broker.specialties ?? []).filter((s): s is string => Boolean(s?.trim())).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
                >
                  {s.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
        {broker.years_experience != null && broker.years_experience > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            {broker.years_experience} {broker.years_experience === 1 ? 'year' : 'years'} of experience
          </p>
        )}
        {broker.license_number?.trim() && (
          <p className="mt-6 text-sm text-muted-foreground">
            Oregon Real Estate License # {broker.license_number.trim()}
          </p>
        )}
      </div>
    </section>
  )
}
