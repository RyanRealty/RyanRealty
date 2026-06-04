import Image from 'next/image'
import Link from 'next/link'
import {
  Body,
  Caption,
  Container,
  Eyebrow,
  Grid,
  H2,
  H3,
  Section,
  Stack,
} from '@/components/site/primitives'
import { Card, CardContent } from '@/components/ui/card'
import type { GolfCommunity } from '@/data/golf-landing'

/**
 * GolfCommunityCards — section (2/3-col responsive grid) of golf
 * community cards, one per GolfCommunity entry passed in.
 *
 * Each card shows:
 *   - Community hero image (next/image fill) or a bg-muted fallback
 *   - Eyebrow: course name + holes note
 *   - H3: community name
 *   - Body: honestFact
 *   - "Explore <name>" link to communityHref
 *
 * Design-system rules:
 *   - Card from @/components/ui/card (bg-card, rounded-xl, ring)
 *   - Colors only via tokens: no hex, no bg-black, no gold
 *   - No arbitrary bracket utilities — all standard Tailwind classes
 */

type Props = {
  communities: GolfCommunity[]
}

export function GolfCommunityCards({ communities }: Props) {
  if (!communities.length) return null

  return (
    <Section tone="muted" divider>
      <Container>
        <Stack gap="default" className="mb-10">
          <Eyebrow>Golf communities</Eyebrow>
          <H2>Where the courses are</H2>
          <Body size="default" tone="muted" className="max-w-prose">
            Eleven communities across Central Oregon, from Bend to Sisters to Sunriver. Each sits alongside its own course or resort golf complex.
          </Body>
        </Stack>

        <Grid cols={3} gap="loose">
          {communities.map((community) => (
            <Card key={community.slug} className="overflow-hidden">
              {/* Photo or fallback */}
              <div className="relative aspect-video bg-muted">
                {community.imageSrc ? (
                  <Image
                    src={community.imageSrc}
                    alt={community.imageAlt ?? community.name}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 bg-primary/10" />
                )}
              </div>

              <CardContent className="pt-4 pb-5">
                {(community.course || community.holesNote) ? (
                  <Caption tone="muted" className="mb-2 uppercase tracking-widest font-semibold">
                    {[community.course, community.holesNote].filter(Boolean).join(' · ')}
                  </Caption>
                ) : null}

                <H3 className="mb-2">{community.name}</H3>

                <Body size="small" tone="muted" className="mb-4 leading-relaxed">
                  {community.honestFact}
                </Body>

                <Link
                  href={community.communityHref}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  Explore {community.name}
                  <span aria-hidden>&#8594;</span>
                </Link>
              </CardContent>
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
