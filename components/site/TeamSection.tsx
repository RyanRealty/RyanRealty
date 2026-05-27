import {
  Body,
  Container,
  CTAButton,
  Eyebrow,
  H2,
  Section,
  Stack,
} from '@/components/site/primitives'

/**
 * Site v2 team / social-proof section — split layout, text + team photo,
 * on a muted surface. Mirrors design_system/ryan-realty/ui_kits/website/
 * index.html §social.
 *
 * Lifted onto Wave 2 Layer 1 primitives 2026-05-27. Brand-voice clean
 * (no banned tokens, no em-dashes in JSX text).
 */

export default function TeamSection({ teamImageSrc }: { teamImageSrc?: string | null }) {
  const src = teamImageSrc ?? '/images/team.webp'

  return (
    <Section padding="default" tone="muted" divider>
      <Container>
        <div className="grid gap-12 items-center grid-cols-1 md:grid-cols-[1.3fr_1fr]">
          <Stack gap="default">
            <Eyebrow>Meet the team</Eyebrow>
            <H2>Brokers who live and work across Central Oregon.</H2>
            <Body size="default" tone="muted" className="leading-[1.6] max-w-[52ch]">
              Local knowledge, honest guidance, and a small team that has lived,
              worked, and closed deals across Bend, Redmond, Sisters, Sunriver, and
              surrounding communities. We tell you what the inspection found. We
              tell you when a listing has been sitting. We tell you what we
              do not know.
            </Body>
            <div className="flex gap-2.5 flex-wrap pt-2">
              <CTAButton href="/team" tone="primary" size="md">
                Meet the team
              </CTAButton>
              <CTAButton href="/contact" tone="outline" size="md">
                Schedule a call
              </CTAButton>
            </div>
          </Stack>

          <div className="relative w-full aspect-[4/3] rounded-[14px] overflow-hidden shadow-md bg-muted">
            {/* Plain <img> so the mtime cache-buster query string passes through
                without tripping next/image's localPatterns whitelist. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Ryan Realty brokers"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </Container>
    </Section>
  )
}
