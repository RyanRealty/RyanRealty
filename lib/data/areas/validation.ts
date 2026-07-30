/**
 * Named-area input validation — pure, client-safe, no server deps.
 *
 * ONE contract, three enforcement layers that must agree:
 *   1. this module (actions + UI),
 *   2. the search_areas table CHECKs + geom trigger
 *      (supabase/migrations/20260730021000_named_areas.sql),
 *   3. the shapes RPC bounds (20260730011000_search_shapes_rpc.sql —
 *      3..2000 vertices, radius (0, 200000], max 50 shapes).
 *
 * An area's shapes column is a jsonb ARRAY of drawn shapes, each the RPC's
 * shape contract plus an optional `exclude` flag. Membership semantics:
 * union(non-exclude) minus union(exclude) — see lib/alerts/area-resolve.ts.
 */

import { z } from 'zod'

export const AREA_NAME_MAX = 80
export const AREA_MAX_SHAPES = 50

const CoordTupleSchema = z.tuple([
  z.number().min(-180).max(180), // lng
  z.number().min(-90).max(90), // lat
])

/** One saved shape: RPC contract + optional exclude flag. */
export const AreaShapeSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('polygon'),
    coords: z.array(CoordTupleSchema).min(3).max(2000),
    exclude: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('circle'),
    center: CoordTupleSchema,
    /** Meters on the ground (geography buffer / ST_DWithin). */
    radius_m: z.number().positive().max(200_000),
    exclude: z.boolean().optional(),
  }),
])

export type AreaShape = z.infer<typeof AreaShapeSchema>

export const AreaShapesSchema = z
  .array(AreaShapeSchema)
  .min(1)
  .max(AREA_MAX_SHAPES)
  .refine((shapes) => shapes.some((s) => s.exclude !== true), {
    message: 'at least one shape must not be an exclude',
  })

export type AreaValidation<T> = { ok: true; value: T } | { ok: false; error: string }

/** Trimmed, 1..80 chars. Mirrors the table CHECK on name. */
export function validateAreaName(raw: unknown): AreaValidation<string> {
  if (typeof raw !== 'string') return { ok: false, error: 'Give this area a name.' }
  const name = raw.trim()
  if (!name) return { ok: false, error: 'Give this area a name.' }
  if (name.length > AREA_NAME_MAX) {
    return { ok: false, error: `Keep the name under ${AREA_NAME_MAX} characters.` }
  }
  return { ok: true, value: name }
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/**
 * Public-area slug: lowercase kebab, 3..80 chars. Mirrors the table CHECK.
 * Reserved words guard the /areas namespace's own sub-routes.
 */
const RESERVED_SLUGS = new Set(['index', 'new', 'edit', 'admin', 'api'])

export function validateAreaSlug(raw: unknown): AreaValidation<string> {
  if (typeof raw !== 'string') return { ok: false, error: 'Enter a URL slug.' }
  const slug = raw.trim().toLowerCase()
  if (slug.length < 3 || slug.length > 80 || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: 'Slug must be 3-80 characters of lowercase letters, numbers, and hyphens.',
    }
  }
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: 'That slug is reserved.' }
  return { ok: true, value: slug }
}

/** Parse + bound-check a shapes payload. Returns the typed, cleaned array. */
export function validateAreaShapes(raw: unknown): AreaValidation<AreaShape[]> {
  const parsed = AreaShapesSchema.safeParse(raw)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      ok: false,
      error: `Those drawn shapes could not be saved (${first?.message ?? 'invalid shapes'}).`,
    }
  }
  return { ok: true, value: parsed.data }
}
