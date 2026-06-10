// brand-voice:exempt
/**
 * HomepageTrustBand — three broker portraits floating on cream.
 *
 * Uses the transparent PNG headshots from design_system/ryan-realty/assets/team/.
 * Portraits have no background box, no drop shadow frame — they float on the
 * cream surface per the mockup and CLAUDE.md composite rule.
 *
 * License numbers from CLAUDE.md (OREA-authoritative). Phone 541.213.6706 dotted.
 * Place separator: middle dot. BEND · OREGON.
 *
 * Props:
 *   brokers — broker rows from getBrokers() DAL (used for display_name + title).
 *             Falls back to hardcoded brand copy if empty.
 */

import Image from 'next/image'
import { Container, DisplayHeading, Eyebrow } from '@/components/site/primitives'
import { CONTACT, BRAND } from '@/lib/brand/contact'
import type { Broker } from '@/lib/data/types/broker'

// Canonical broker data (fallback + ordering source)
const BROKER_CANONICAL = [
  {
    slug: 'matt-ryan',
    name: 'Matt Ryan',
    title: 'Principal Broker',
    license: '201206613',
    photo: '/images/brokers/ryan-matt.png',
  },
  {
    slug: 'paul-stevenson',
    name: 'Paul Stevenson',
    title: 'Broker',
    license: '201259123',
    photo: '/images/brokers/stevenson-paul.png',
  },
  {
    slug: 'rebecca-peterson',
    name: 'Rebecca Peterson',
    title: 'Broker',
    license: '201254727',
    photo: '/images/brokers/peterson-rebecca.png',
  },
] as const

type Props = {
  brokers?: Broker[]
}

export default function HomepageTrustBand({ brokers = [] }: Props) {
  // Merge live broker data with canonical fallback (keeps canonical order)
  const resolvedBrokers = BROKER_CANONICAL.map((canonical) => {
    const live = brokers.find(
      (b) =>
        b.slug === canonical.slug ||
        b.fullName.toLowerCase().includes(canonical.name.split(' ')[1].toLowerCase()),
    )
    return {
      name: live?.fullName ?? canonical.name,
      title: live?.title ?? canonical.title,
      license: live?.licenseNumber ?? canonical.license,
      photo: live?.headshotPng ?? canonical.photo,
      slug: canonical.slug,
    }
  })

  return (
    <section
      className="bg-background py-16 md:py-20 border-t border-border"
      aria-labelledby="trust-heading"
    >
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-12 md:gap-16 items-start">

          {/* Left: brokerage info */}
          <div>
            <Eyebrow className="mb-4">The team</Eyebrow>
            <DisplayHeading as="h2" id="trust-heading" className="text-foreground mb-6" style={{ maxWidth: '380px' }}>
              Brokers who answer their own phones.
            </DisplayHeading>
            <p className="text-[15px] leading-[1.7] text-foreground/60 mb-8" style={{ maxWidth: '44ch' }}>
              Based in Bend, working every market in Central Oregon. No
              out-of-state call centers, no referral farms. When you call, you
              reach the broker on your deal.
            </p>
            <div className="flex flex-col gap-2">
              <div className="text-sm text-foreground/60">
                Call or text:{' '}
                <a href={CONTACT.phoneDirectTel} className="font-semibold text-foreground border-b border-border hover:border-foreground transition-colors">
                  {CONTACT.phoneDirect}
                </a>
              </div>
              <div className="text-sm text-foreground/60">
                Web:{' '}
                <a href={BRAND.url} className="font-semibold text-foreground border-b border-border hover:border-foreground transition-colors">
                  {BRAND.domain}
                </a>
              </div>
            </div>
            <p className="text-[12px] font-bold tracking-[0.14em] uppercase text-foreground/35 mt-4">
              BEND{' '}·{' '}OREGON
            </p>
          </div>

          {/* Right: broker portraits */}
          <div className="flex gap-6 items-end flex-wrap justify-center md:justify-start">
            {resolvedBrokers.map((broker) => (
              <div key={broker.slug} className="flex flex-col items-center gap-3 flex-1 min-w-[120px] max-w-[180px]">
                <div className="relative w-full" style={{ height: '240px' }}>
                  <Image
                    src={broker.photo}
                    alt={broker.name}
                    fill
                    sizes="180px"
                    className="object-cover object-top"
                    style={{
                      filter: 'drop-shadow(0 4px 12px rgba(16,39,66,0.10))',
                      borderRadius: '0',
                    }}
                    loading="lazy"
                  />
                </div>
                <div className="text-center">
                  <div className="text-[13px] font-semibold text-foreground">{broker.name}</div>
                  <div className="text-[11px] font-medium tracking-[0.04em] text-foreground/45 mt-0.5">{broker.title}</div>
                  <div className="text-[10px] text-foreground/35 mt-0.5">OR #{broker.license}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
