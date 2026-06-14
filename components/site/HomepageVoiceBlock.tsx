/**
 * HomepageVoiceBlock — editorial brokerage statement.
 *
 * Facts-only. No banned words, no marketing slop, no overt category claims.
 * Position on the standard, the data, and direct-broker accountability — never
 * headcount/smallness or a baseline credential. Gate-enforced (NOT exempt).
 * Brand voice: direct, specific, kind, honest.
 *
 * Left column: pull quote + body copy + fact trio.
 * Right column: heritage illustration (illustration-05.png).
 *
 * Mobile: single column, illustration hidden.
 */

import Image from 'next/image'
import { Container, DisplayHeading, Eyebrow } from '@/components/site/primitives'

export default function HomepageVoiceBlock() {
  return (
    <section
      className="bg-background py-20 md:py-24 border-t border-border"
      aria-label="About Ryan Realty"
    >
      <Container>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-20 items-center">

          {/* Left: copy */}
          <div>
            <Eyebrow className="mb-6">Bend-based, locally owned</Eyebrow>

            <DisplayHeading as="h2" className="mb-8 text-foreground" style={{ maxWidth: '440px' }}>
              One standard on every listing, across Central Oregon.
            </DisplayHeading>

            <p className="text-base leading-[1.75] text-foreground/62 mb-8" style={{ maxWidth: '48ch' }}>
              We cover the full Central Oregon market: Bend, Redmond, Sisters,
              Sunriver, La Pine, and the resort communities in between. We tell you
              what the inspection found. We tell you when a listing has been sitting.
              We tell you what we do not know.
            </p>

            {/* Fact trio */}
            <div className="flex flex-col gap-4">
              <div
                className="flex items-start gap-4 px-5 py-4"
                style={{ borderLeft: '2px solid rgba(16,39,66,0.15)' }}
              >
                <span
                  className="font-display tabular-nums text-foreground leading-none flex-shrink-0"
                  style={{ fontSize: '1.75rem', minWidth: '60px' }}
                >
                  14
                </span>
                <span className="text-sm leading-[1.5] text-foreground/60 pt-0.5">
                  <strong className="text-foreground font-semibold">Bend neighborhoods</strong>{' '}
                  with verified boundary polygons and market data updated every 10 minutes.
                </span>
              </div>

              <div
                className="flex items-start gap-4 px-5 py-4"
                style={{ borderLeft: '2px solid rgba(16,39,66,0.15)' }}
              >
                <span
                  className="font-display tabular-nums text-foreground leading-none flex-shrink-0"
                  style={{ fontSize: '1.75rem', minWidth: '60px' }}
                >
                  1
                </span>
                <span className="text-sm leading-[1.5] text-foreground/60 pt-0.5">
                  <strong className="text-foreground font-semibold">broker on your deal</strong>{' '}
                  from your first call to closing. You always know exactly who is accountable.
                </span>
              </div>

              <div
                className="flex items-start gap-4 px-5 py-4"
                style={{ borderLeft: '2px solid rgba(16,39,66,0.15)' }}
              >
                <span
                  className="font-display tabular-nums text-foreground leading-none flex-shrink-0"
                  style={{ fontSize: '1.75rem', minWidth: '60px' }}
                >
                  2023
                </span>
                <span className="text-sm leading-[1.5] text-foreground/60 pt-0.5">
                  <strong className="text-foreground font-semibold">Ryan Realty LLC founded</strong>{' '}
                  in Bend. Oregon Real Estate Agency business license 201253677.
                </span>
              </div>
            </div>
          </div>

          {/* Right: heritage illustration */}
          <div className="hidden md:flex items-center justify-center p-8">
            <Image
              src="/brand/illustration-05.png"
              alt="Ryan Realty signature lockup with the Jax mascot and Bend, Oregon tagline"
              width={380}
              height={380}
              className="max-w-full"
              style={{ opacity: 0.85 }}
              loading="lazy"
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
