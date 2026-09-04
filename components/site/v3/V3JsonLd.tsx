import { buildJsonLd, type SchemaInput } from '@/lib/site/json-ld'

/**
 * JSON-LD script tags. Same job as the flat-register MetadataBlock, owned
 * here so a new public page never imports components/site/MetadataBlock.
 * Not a seventh pattern. No look.
 */

type SingleSchemaProps = { schema: SchemaInput; schemas?: never }
type MultiSchemaProps = { schemas: ReadonlyArray<SchemaInput>; schema?: never }
export type V3JsonLdProps = SingleSchemaProps | MultiSchemaProps

export function V3JsonLd(props: V3JsonLdProps) {
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

export { V3JsonLd as MetadataBlock }
