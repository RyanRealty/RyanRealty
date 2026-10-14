import Link from 'next/link'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  MetadataBlock,
  V3_FOOTER_COLUMNS,
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Eyebrow,
  V3Footer,
  V3Heading,
  V3ListingDial,
  V3Quiet,
  V3SectionTracker,
  V3SourceLine,
} from '@/components/site/v3'
import type { BuyerAnswerModel } from '@/lib/buyer-answers'
import { MLS_SOURCE } from '@/lib/buyer-answers'
import './buyer-answer.css'

export function BuyerAnswerPage({ model }: { model: BuyerAnswerModel }) {
  const dateModified = model.asOfIso ?? undefined
  const isCommunity = model.def.placeKind === 'community'
  const isNeighborhood = model.def.placeKind === 'neighborhood'
  const indexLabel = isCommunity ? 'Communities' : 'Cities'
  const indexHref = isCommunity ? '/communities' : '/cities'
  const cityHref = `/cities/${model.def.citySlug ?? 'bend'}`
  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: indexLabel, url: indexHref },
    ...(isNeighborhood ? [{ name: 'Bend', url: cityHref }] : []),
    { name: model.placeName, url: model.hub.href },
    { name: model.def.h1, url: model.def.path },
  ]
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: breadcrumbItems,
    },
    {
      type: 'webPage',
      name: model.def.title,
      description: model.answer,
      url: model.def.path,
      dateModified,
      authorName: model.byline.label,
      authorUrl: model.byline.href,
    },
    {
      type: 'faqPage',
      items: model.faqs.map(({ question, answer }) => ({ question, answer })),
      dateModified,
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: indexLabel, href: indexHref },
            ...(isNeighborhood ? [{ label: 'Bend', href: cityHref }] : []),
            { label: model.placeName, href: model.hub.href },
            { label: model.def.h1 },
          ]}
        />

        <section id="answer" className="v3-buyer-section v3-buyer-section--lead" aria-labelledby="buyer-answer-heading">
          <V3Eyebrow>Buyer answer</V3Eyebrow>
          <V3Heading level={1} id="buyer-answer-heading">
            {model.def.h1}
          </V3Heading>
          <p className="v3-buyer-answer">{model.answer}</p>
          <V3SourceLine sourceName={MLS_SOURCE} asOf={model.asOfLabel} source={model.citation} />
          <p className="v3-buyer-byline">
            Written by <Link href={model.byline.href}>{model.byline.label}</Link>
          </p>
        </section>

        <section id="figures" className="v3-buyer-section" aria-labelledby="figures-heading">
          <V3Heading level={2} id="figures-heading">
            The figures
          </V3Heading>
          <table className="v3-buyer-table">
            <caption>{model.table.caption}</caption>
            <thead>
              <tr>
                <th scope="col">Figure</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {model.table.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section id="homes" className="v3-buyer-section" aria-labelledby="homes-heading">
          {model.listings.length > 0 ? (
            <V3ListingDial
              id="buyer-answer-homes"
              heading={model.listingsHeading}
              headingLevel={2}
              label={model.listingsHeading}
              listings={model.listings}
            />
          ) : (
            <>
              <V3Heading level={2} id="homes-heading">
                {model.listingsHeading}
              </V3Heading>
              <p>{model.listingsEmpty}</p>
            </>
          )}
        </section>

        <section id="questions" className="v3-buyer-section" aria-labelledby="questions-heading">
          <V3Heading level={2} id="questions-heading">
            Questions
          </V3Heading>
          <dl className="v3-buyer-faq">
            {model.faqs.map((item) => (
              <div key={item.question}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <V3Quiet
          id="next"
          heading="Next"
          items={[
            { href: model.hub.href, label: model.hub.label },
            ...(model.otherHub ? [{ href: model.otherHub.href, label: model.otherHub.label }] : []),
            ...model.buyLinks.map((link) => ({ href: link.href, label: link.label })),
            { href: model.listingsHref, label: 'Homes for sale' },
          ]}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
