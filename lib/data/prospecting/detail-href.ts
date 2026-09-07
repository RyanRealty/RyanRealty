import type { ProspectKind } from './types'

/** Deep link to /admin/prospecting/<kind>/<id>. Single-encode the id (FSBO URLs). */
export function prospectDetailHref(kind: ProspectKind, id: string): string {
  return `/admin/prospecting/${kind}/${encodeURIComponent(id)}`
}
