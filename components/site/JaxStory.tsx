import {
  Body,
  Container,
  Eyebrow,
  Grid,
  H2,
  JaxMascot,
  Section,
  Stack,
} from '@/components/site/primitives'

/**
 * Jax mascot story — split layout (mascot left, copy right) per the /about
 * mockup (design_system/ryan-realty/ui_kits/about/index.html §jax).
 *
 * Data accuracy (CLAUDE.md §0) + brand voice: Jax is the brand mascot, the
 * blue lab on Ryan Realty signage and social (Design System v2 — "Jax the
 * blue lab, explicitly part of brand"). The mockup's personal-bio details
 * (the dog's age, "every closing dinner since 2023", the office street) are
 * NOT verified, so they are omitted rather than asserted.
 */
export function JaxStory() {
  return (
    <Section padding="default" tone="default" divider>
      <Container>
        <Grid cols={2} gap="loose" className="items-center">
          <div className="flex items-center justify-center bg-muted rounded-[14px] p-8 aspect-[4/3]">
            <JaxMascot tone="navy" size={220} alt="Jax, the Ryan Realty mascot, a blue lab." />
          </div>
          <Stack gap="default">
            <Eyebrow>Meet Jax</Eyebrow>
            <H2>Our mascot is a blue lab.</H2>
            <Body size="default" tone="muted" className="leading-relaxed">
              Jax is the blue lab on our yard signs, our postcards, and our social feed.
            </Body>
            <Body size="default" tone="muted" className="leading-relaxed">
              He is part of why the brand feels less like a national franchise and more like a small
              business in Bend.
            </Body>
          </Stack>
        </Grid>
      </Container>
    </Section>
  )
}
