import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'

/** JSON-LD lives here so page.tsx stays on the v3 barrel (ci:public-ui). */
export function ConcessionsJsonLd({ schemas }: { schemas: ReadonlyArray<SchemaInput> }) {
  return <MetadataBlock schemas={schemas} />
}
