/**
 * CRM segment AST — the one typed, validated description of "which contacts".
 *
 * Every list view, headline count, bulk id-set, and Meta audience in the CRM
 * derives from a `CrmSegment`. By making the segment a serializable AST (boolean
 * groups over typed conditions) instead of an ad-hoc filter bag, a saved view, a
 * count, a bulk action, and an audience all re-derive from the SAME shape and the
 * SAME compiler (lib/data/crm/buildCrmPeopleQuery.ts). No second filter codepath
 * can drift from the list.
 *
 * This module is PURE (no Supabase, no server-only). It owns three jobs:
 *   1. The type + a runtime validator (validateSegment) so a malformed AST is
 *      caught before it ever touches the database.
 *   2. upgradeLegacyFilters — maps the current people-list filter bag
 *      ({stage, tagsAny, broker, q}) onto an AST, so the existing UI keeps
 *      working while everything routes through one resolver.
 *   3. describeSegment — a short human label for a saved view / audience chip.
 *
 * NOTE on the broker scope: a CrmSegment NEVER carries the caller's broker
 * scope. Scope is applied by the compiler from the authenticated session
 * (lib/crm/scope.ts), inside the query builder, so a restricted broker can never
 * widen past their book by hand-crafting an AST. Keep it that way.
 */

// ── Field conditions ─────────────────────────────────────────────────────────

/** Match against crm_people.stage (exact, one of CRM_STAGES). */
export type StageCondition = { field: 'stage'; value: string }

/** A tag membership test against crm_people.tags (text[]). `op` picks has / not. */
export type TagCondition = { field: 'tag'; op: 'has' | 'not'; value: string }

/** Match against crm_people.source (exact). */
export type SourceCondition = { field: 'source'; value: string }

/** Match against the crm_people.neighborhood_slug COLUMN (exact canonical slug). */
export type NeighborhoodCondition = { field: 'neighborhood'; value: string }

/**
 * Match against the crm_people.subdivision COLUMN (the MLS SubdivisionName).
 *   - eq (default): exact match, e.g. "West Hills"
 *   - contains: case-insensitive substring, e.g. "Northwest Crossing" catches
 *     every phase/sub-community variant ("Northwest Crossing Phase 5",
 *     "Cottages At Northwest Crossing", "Bungalows At Northwest Crossing
 *     Condominium"). This is what a community smart list needs — the subdivision
 *     column carries 60+ variants per master-planned community.
 *   - starts: case-insensitive prefix, e.g. "West Hills" catches "West Hills
 *     First Addition" but not "Cottages At West Hills".
 */
export type SubdivisionCondition = { field: 'subdivision'; op?: 'eq' | 'contains' | 'starts'; value: string }

/** Match against crm_people.assigned_broker (a broker slug). */
export type AssignedBrokerCondition = { field: 'assigned_broker'; value: string }

/**
 * A date-window test against a timestamp column. `created` -> fub_created_at,
 * `last_activity` -> last_activity_at. ISO-8601 strings (date or datetime).
 *   - before:  { op: 'before',  value }
 *   - after:   { op: 'after',   value }
 *   - between: { op: 'between', value, valueEnd }  (inclusive lower, exclusive upper)
 */
export type DateCondition = {
  field: 'created' | 'last_activity'
  op: 'before' | 'after' | 'between'
  value: string
  valueEnd?: string
}

/** Free-text search (name / email / phone) — same semantics as the list `q`. */
export type TextCondition = { field: 'q'; value: string }

/**
 * A condition on a custom field stored in crm_people.custom (jsonb).
 *   - eq / neq:           value equality on custom->>key
 *   - has / missing:      key presence (value ignored)
 *   - contains:           substring match on the string value of custom->>key
 */
export type CustomCondition = {
  field: 'custom'
  key: string
  op: 'eq' | 'neq' | 'has' | 'missing' | 'contains'
  value?: string
}

export type CrmCondition =
  | StageCondition
  | TagCondition
  | SourceCondition
  | NeighborhoodCondition
  | SubdivisionCondition
  | AssignedBrokerCondition
  | DateCondition
  | TextCondition
  | CustomCondition

// ── Boolean groups ───────────────────────────────────────────────────────────

/**
 * A boolean group. `op` combines `nodes`:
 *   - 'and' / 'or' over any mix of conditions and nested groups.
 *   - 'not' negates a SINGLE child (exactly one node).
 */
export type CrmGroup = {
  type: 'group'
  op: 'and' | 'or' | 'not'
  nodes: CrmNode[]
}

export type CrmNode = CrmGroup | CrmCondition

/** The root of a segment is always a group (use an empty 'and' for "everyone"). */
export type CrmSegment = CrmGroup

/** An empty segment that matches everyone (the resolver still clamps to scope). */
export const EMPTY_SEGMENT: CrmSegment = { type: 'group', op: 'and', nodes: [] }

// ── Validation ───────────────────────────────────────────────────────────────

const CONDITION_FIELDS = new Set([
  'stage',
  'tag',
  'source',
  'neighborhood',
  'subdivision',
  'assigned_broker',
  'created',
  'last_activity',
  'q',
  'custom',
])

function isGroup(node: unknown): node is CrmGroup {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { type?: unknown }).type === 'group'
  )
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function validateCondition(cond: CrmCondition, path: string): void {
  const field = (cond as { field?: unknown }).field
  if (!nonEmptyString(field) || !CONDITION_FIELDS.has(field)) {
    throw new Error(`${path}: unknown condition field "${String(field)}"`)
  }

  switch (cond.field) {
    case 'stage':
    case 'source':
    case 'neighborhood':
    case 'assigned_broker':
    case 'q':
      if (!nonEmptyString(cond.value)) {
        throw new Error(`${path}: "${cond.field}" requires a non-empty value`)
      }
      return

    case 'subdivision':
      if (!nonEmptyString(cond.value)) {
        throw new Error(`${path}: "subdivision" requires a non-empty value`)
      }
      if (cond.op !== undefined && cond.op !== 'eq' && cond.op !== 'contains' && cond.op !== 'starts') {
        throw new Error(`${path}: subdivision op must be "eq", "contains", or "starts"`)
      }
      return

    case 'tag':
      if (cond.op !== 'has' && cond.op !== 'not') {
        throw new Error(`${path}: tag op must be "has" or "not"`)
      }
      if (!nonEmptyString(cond.value)) {
        throw new Error(`${path}: tag requires a non-empty value`)
      }
      return

    case 'created':
    case 'last_activity':
      if (cond.op !== 'before' && cond.op !== 'after' && cond.op !== 'between') {
        throw new Error(`${path}: date op must be before, after, or between`)
      }
      if (!nonEmptyString(cond.value) || Number.isNaN(Date.parse(cond.value))) {
        throw new Error(`${path}: date value must be a valid ISO date`)
      }
      if (cond.op === 'between') {
        if (!nonEmptyString(cond.valueEnd) || Number.isNaN(Date.parse(cond.valueEnd))) {
          throw new Error(`${path}: between requires a valid valueEnd ISO date`)
        }
      }
      return

    case 'custom': {
      if (!nonEmptyString(cond.key)) {
        throw new Error(`${path}: custom requires a non-empty key`)
      }
      const ops = ['eq', 'neq', 'has', 'missing', 'contains']
      if (!ops.includes(cond.op)) {
        throw new Error(`${path}: custom op must be one of ${ops.join(', ')}`)
      }
      if ((cond.op === 'eq' || cond.op === 'neq' || cond.op === 'contains') && !nonEmptyString(cond.value)) {
        throw new Error(`${path}: custom "${cond.op}" requires a non-empty value`)
      }
      return
    }

    default: {
      // Exhaustiveness guard — a new condition kind added without a case lands here.
      const _exhaustive: never = cond
      throw new Error(`${path}: unhandled condition ${JSON.stringify(_exhaustive)}`)
    }
  }
}

function validateNode(node: CrmNode, path: string, depth: number): void {
  if (depth > 25) throw new Error(`${path}: segment nesting too deep`)
  if (isGroup(node)) {
    validateGroup(node, path, depth)
    return
  }
  if (typeof node !== 'object' || node === null) {
    throw new Error(`${path}: node must be an object`)
  }
  validateCondition(node as CrmCondition, path)
}

function validateGroup(group: CrmGroup, path: string, depth: number): void {
  if (group.op !== 'and' && group.op !== 'or' && group.op !== 'not') {
    throw new Error(`${path}: group op must be and, or, or not`)
  }
  if (!Array.isArray(group.nodes)) {
    throw new Error(`${path}: group.nodes must be an array`)
  }
  if (group.op === 'not' && group.nodes.length !== 1) {
    throw new Error(`${path}: a "not" group must have exactly one child`)
  }
  group.nodes.forEach((child, i) => validateNode(child, `${path}.nodes[${i}]`, depth + 1))
}

/**
 * Validate an AST shape. Throws an Error with a path-tagged message on the first
 * problem. Returns the same object (typed as CrmSegment) on success so callers
 * can do `const seg = validateSegment(raw)`.
 */
export function validateSegment(ast: unknown): CrmSegment {
  if (!isGroup(ast)) {
    throw new Error('segment: root must be a group ({ type: "group", op, nodes })')
  }
  validateGroup(ast, 'segment', 0)
  return ast
}

// ── Legacy filter upgrade ────────────────────────────────────────────────────

/** The current people-list filter bag (subset of CrmListFilters). */
export type LegacyFilters = {
  stage?: string
  tagsAny?: string[]
  broker?: string
  q?: string
  neighborhood?: string
}

/**
 * Map the existing people-list filters onto a CrmSegment so the current UI keeps
 * working while everything routes through the resolver.
 *
 * Semantics match listCrmPeople exactly:
 *   - stage  -> exact stage match
 *   - tagsAny -> OR over tag-has (the .overlaps semantics)
 *   - broker -> assigned_broker exact
 *   - q      -> text search condition
 * All present filters AND together at the top level.
 */
export function upgradeLegacyFilters(filters: LegacyFilters): CrmSegment {
  const nodes: CrmNode[] = []

  const stage = filters.stage?.trim()
  if (stage) nodes.push({ field: 'stage', value: stage })

  const tagsAny = (filters.tagsAny ?? []).map((t) => t?.trim()).filter((t): t is string => !!t)
  if (tagsAny.length === 1) {
    nodes.push({ field: 'tag', op: 'has', value: tagsAny[0] })
  } else if (tagsAny.length > 1) {
    nodes.push({
      type: 'group',
      op: 'or',
      nodes: tagsAny.map((t): TagCondition => ({ field: 'tag', op: 'has', value: t })),
    })
  }

  const broker = filters.broker?.trim()
  if (broker) nodes.push({ field: 'assigned_broker', value: broker })

  const neighborhood = filters.neighborhood?.trim()
  if (neighborhood) nodes.push({ field: 'neighborhood', value: neighborhood })

  const q = filters.q?.trim()
  if (q) nodes.push({ field: 'q', value: q })

  return { type: 'group', op: 'and', nodes }
}

// ── Human label ──────────────────────────────────────────────────────────────

function describeCondition(cond: CrmCondition): string {
  switch (cond.field) {
    case 'stage':
      return `stage is ${cond.value}`
    case 'source':
      return `source is ${cond.value}`
    case 'neighborhood':
      return `neighborhood is ${cond.value}`
    case 'subdivision':
      return cond.op === 'contains'
        ? `subdivision contains ${cond.value}`
        : cond.op === 'starts'
          ? `subdivision starts with ${cond.value}`
          : `subdivision is ${cond.value}`
    case 'assigned_broker':
      return `broker is ${cond.value}`
    case 'tag':
      return cond.op === 'has' ? `tagged ${cond.value}` : `not tagged ${cond.value}`
    case 'q':
      return `matches "${cond.value}"`
    case 'created':
    case 'last_activity': {
      const label = cond.field === 'created' ? 'created' : 'last active'
      if (cond.op === 'between') return `${label} ${cond.value} to ${cond.valueEnd}`
      return `${label} ${cond.op} ${cond.value}`
    }
    case 'custom': {
      const k = cond.key
      switch (cond.op) {
        case 'has':
          return `has ${k}`
        case 'missing':
          return `missing ${k}`
        case 'eq':
          return `${k} is ${cond.value}`
        case 'neq':
          return `${k} is not ${cond.value}`
        case 'contains':
          return `${k} contains ${cond.value}`
      }
      return k
    }
  }
}

function describeNode(node: CrmNode): string {
  if (isGroup(node)) {
    if (node.op === 'not') {
      return `not (${describeNode(node.nodes[0])})`
    }
    if (node.nodes.length === 0) return 'everyone'
    const joiner = node.op === 'and' ? ' and ' : ' or '
    const parts = node.nodes.map(describeNode)
    return parts.length > 1 ? `(${parts.join(joiner)})` : parts[0]
  }
  return describeCondition(node)
}

/**
 * A short human label for a segment — for a saved-view chip or audience name.
 * An empty root group reads "Everyone".
 */
export function describeSegment(ast: CrmSegment): string {
  if (ast.nodes.length === 0) return 'Everyone'
  if (ast.op === 'not') return `Not (${describeNode(ast.nodes[0])})`
  const joiner = ast.op === 'and' ? ' and ' : ' or '
  const label = ast.nodes.map(describeNode).join(joiner)
  // Strip a single redundant outer wrap when the root reduced to one wrapped group.
  return label.replace(/^\((.*)\)$/, '$1')
}
