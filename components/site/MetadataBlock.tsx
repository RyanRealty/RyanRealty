import { buildJsonLd, type SchemaInput } from '@/lib/site/json-ld'

/**
 * Renders one or more JSON-LD schema.org blocks for a page.
 *
 * Pages compose this with a `schemas` array — usually one of:
 *
 *   - [breadcrumb, webPage]
 *   - [breadcrumb, realEstateListing]
 *   - [breadcrumb, place]
 *   - [breadcrumb, webPage, faqPage]
 *
 * For the OG + Twitter + canonical side of the same metadata contract,
 * pages spread `pageMetadata({ ... })` from `@/lib/site/page-metadata`
 * into their `export const metadata`. The two pieces stay decoupled
 * because Next.js builds OG via the build-time `metadata` export and
 * JSON-LD via a render-time `<script>` tag.
 *
 * Single-schema shorthand:
 *
 *   <MetadataBlock schema={{ type: 'webPage', name: '...', description: '...' }} />
 *
 * Multi-schema:
 *
 *   <MetadataBlock schemas={[
 *     { type: 'breadcrumb', items: [...] },
 *     { type: 'realEstateListing', name: '...', ... },
 *   ]} />
 *
 * Per docs/EXECUTION_PLAN.md §9 Wave 2 Layer 2.
 */

type SingleSchemaProps = { schema: SchemaInput; schemas?: never }
type MultiSchemaProps = { schemas: ReadonlyArray<SchemaInput>; schema?: never }
type Props = SingleSchemaProps | MultiSchemaProps

export function MetadataBlock(props: Props) {
  const list = props.schema ? [props.schema] : props.schemas
  return (
    <>
      {list.map((input, i) => (
        <script
          key={`${input.type}-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd(input)) }}
        />
      ))}
    </>
  )
}
