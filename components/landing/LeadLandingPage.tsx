import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ContentPageHero from '@/components/layout/ContentPageHero'
import LeadLandingForm from '@/components/landing/LeadLandingForm'
import type { LeadLandingConfig } from '@/lib/lead-landing-content'
import { TESTIMONIALS } from '@/lib/testimonials'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { Container, H2 } from '@/components/site/primitives'
import { generateFAQSchema } from '@/lib/structured-data'

type Props = {
  config: LeadLandingConfig
}

export default function LeadLandingPage({ config }: Props) {
  const quotes = TESTIMONIALS.slice(0, 3)

  const audienceCrumb = config.audience === 'seller'
    ? { label: 'Sell', href: '/sell' }
    : { label: 'Buy', href: '/buy' }

  return (
    <main className="min-h-screen bg-background">
      <Container className="pt-3 pb-1">
        <BreadcrumbNav items={[{ label: 'Home', href: '/' }, audienceCrumb, { label: config.title }]} />
      </Container>
      <ContentPageHero
        title={config.title}
        subtitle={config.subtitle}
        imageUrl={config.heroImageUrl}
        ctas={[
          { label: config.primaryCtaLabel, href: `${config.path}#lead-form`, primary: true },
          { label: config.secondaryCtaLabel, href: config.secondaryCtaHref, primary: false },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Badge variant="secondary">{config.audience === 'seller' ? 'Seller lead page' : 'Buyer lead page'}</Badge>
            <H2 className="text-3xl">{config.challengeTitle}</H2>
            <ul className="space-y-2 text-muted-foreground">
              {config.challengeBullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>{config.processTitle}</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  {config.processSteps.map((step, idx) => (
                    <li key={step}>
                      {idx + 1}. {step}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle>Why this works</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {config.trustBullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div id="lead-form">
            <LeadLandingForm
              audience={config.audience}
              pageTitle={config.seoTitle}
              pagePath={config.path}
              leadIntent={config.intent}
              heading={config.formTitle}
              subheading={config.formSubtitle}
              buttonLabel={config.primaryCtaLabel}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <H2 className="text-2xl">Recent client feedback</H2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {quotes.map((quote) => (
              <Card key={`${quote.author}-${quote.source}`} className="border-border bg-background">
                <CardContent className="space-y-3 p-4">
                  <p className="text-sm text-muted-foreground">{quote.quote}</p>
                  <p className="text-sm font-semibold text-foreground">
                    {quote.author} from {quote.source}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* FAQPage schema emitted from the same visible Q&A data — legitimate because
            the questions are rendered to the page (not fabricated). */}
        {config.faq.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFAQSchema(config.faq)) }}
          />
        )}
        <H2 className="text-2xl">Questions we hear often</H2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {config.faq.map((item) => (
            <Card key={item.question} className="border-border bg-card">
              <CardContent className="space-y-2 p-4">
                <h3 className="text-base font-semibold text-foreground">{item.question}</h3>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-8">
          <Link href="/contact" className="text-sm font-semibold text-primary hover:text-primary/80">
            Prefer to talk now? Contact our team.
          </Link>
        </div>
      </section>
    </main>
  )
}
