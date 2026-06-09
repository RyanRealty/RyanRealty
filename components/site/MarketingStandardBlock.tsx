/**
 * MarketingStandardBlock — the "how we sell homes" pillars. Leads the team/about
 * pages with the brokerage's standard (the angle Matt chose: convey caliber
 * through the WORK, not headcount or stats). Every claim is a real service we
 * deliver (video + 3D tours are wired site-wide; pricing comes from live data).
 */
import { Container, Eyebrow, H2, Body, Section, Grid, Stack } from '@/components/site/primitives'

const PILLARS = [
  {
    title: 'Cinematic video',
    body: 'Every listing gets a professional video, the showcase treatment serious buyers expect.',
  },
  {
    title: 'Interactive 3D tour',
    body: 'A Matterport walkthrough, so buyers explore the whole home before they ever step inside.',
  },
  {
    title: 'Data-backed pricing',
    body: 'We price from live Central Oregon market data, with the comparable sales that support the number.',
  },
] as const

type Props = {
  eyebrow?: string
  title?: string
  tone?: 'default' | 'muted'
}

export function MarketingStandardBlock({
  eyebrow = 'How we sell homes',
  title = 'Every home gets the showcase treatment',
  tone = 'default',
}: Props) {
  return (
    <Section padding="default" tone={tone} divider>
      <Container>
        <Stack gap="tight" className="mb-8 max-w-prose">
          <Eyebrow>{eyebrow}</Eyebrow>
          <H2>{title}</H2>
          <Body size="default" tone="muted" className="leading-relaxed">
            We present a home the way the best of the market does. The broker you meet builds the
            plan and carries your sale through to closing.
          </Body>
        </Stack>
        <Grid cols={3} gap="default">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="font-semibold text-foreground">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pillar.body}</p>
            </div>
          ))}
        </Grid>
      </Container>
    </Section>
  )
}
