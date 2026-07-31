/**
 * Zoning resolution: raw MLS zoning string -> jurisdiction-keyed definition.
 *
 * Design constraints (SEARCH_FILTER_COMPLETENESS_PLAN_2026-07-30 §6):
 * - The canonical key is `jurisdiction:code`, never the bare code (§6.0 item 3).
 * - `county` is real data; `city_lower` is a MAILING city and is never trusted
 *   as jurisdiction on its own (§6.0 item 4, §6.0.1 ERD case). A city-zone match
 *   from mailing city alone is reported with jurisdictionConfidence 'city-assumed'.
 * - When the same code exists in multiple reachable jurisdictions (the PR and
 *   MUE collisions), NEVER pick one silently: return candidates (§6.0.1).
 * - Strings matching no current code resolve to an explicit 'unmapped' state
 *   with no definition attached (§6.0.1). Guessing attaches a wrong legal
 *   definition to real listings.
 *
 * Pure module: no IO beyond static JSON imports. The UI/DAL wave consumes
 * `resolveZoning` and the exported types.
 */
import definitionsFile from "@/data/zoning/definitions.json";
import aliasesFile from "@/data/zoning/aliases.json";

export type AduAnswer = "allowed" | "conditional" | "not-permitted" | "check";
export type StrAnswer = "allowed" | "permit-required" | "prohibited" | "check";
export type DefinitionStatus = "verified" | "unverified";

export interface ZoningDefinition {
  code: string;
  jurisdiction: string;
  name: string;
  plainEnglish: string;
  minLotSize?: string;
  adu: AduAnswer;
  str: StrAnswer;
  sourceUrl: string;
  sourceCite: string;
  verifiedOn?: string;
  status: DefinitionStatus;
  notes?: string;
}

export interface Jurisdiction {
  name: string;
  kind: "county" | "city";
  mlsCounty?: string;
  county?: string;
  cityLower?: string;
}

export type JurisdictionConfidence = "county-certain" | "city-assumed" | "ambiguous";

export interface ZoningResolutionInput {
  code: string;
  county?: string | null;
  cityLower?: string | null;
  /**
   * Pass true/false only when a real signal exists (PostGIS city-limits test,
   * parcel data). Mailing city is NOT such a signal. When provided it settles
   * county-vs-city collisions; when absent, collisions return candidates.
   */
  insideCityLimits?: boolean;
}

export interface RecognizedOverlay {
  token: string;
  name: string;
}

export interface ZoningResolution {
  status: "resolved" | "unmapped";
  rawCode: string;
  /** Primary zone token, normalized (uppercase, separators stripped). */
  normalizedCode: string;
  /** Remaining tokens after the primary (overlay/combining-zone candidates), normalized. */
  secondaryTokens: string[];
  jurisdictionConfidence?: JurisdictionConfidence;
  definition?: ZoningDefinition;
  /** Present when the code exists in more than one reachable jurisdiction. Never auto-picked. */
  candidates?: ZoningDefinition[];
  /** Secondary tokens recognized as documented combining/overlay zones for the resolved jurisdiction. */
  overlays?: RecognizedOverlay[];
  /** Explanation from the curated unmapped list, when this exact string is a known dead end. */
  unmappedNote?: string;
}

interface AliasEntry {
  to: string;
  note: string;
}
interface UnmappedEntry {
  normalizedCode: string;
  jurisdiction: string | null;
  note: string;
}

const DEFINITIONS = definitionsFile.entries as Record<string, ZoningDefinition>;
const JURISDICTIONS = definitionsFile.jurisdictions as Record<string, Jurisdiction>;
const ALIASES = aliasesFile.aliases as Record<string, AliasEntry>;
const OVERLAYS = aliasesFile.overlays as Record<string, Record<string, string>>;
const UNMAPPED = aliasesFile.unmapped as UnmappedEntry[];

/** Uppercase and strip spaces, hyphens, periods, parentheses and slashes. */
export function normalizeZoningToken(token: string): string {
  return token.toUpperCase().replace(/[\s\-.()/]+/g, "");
}

/**
 * Split a raw MLS zoning string into a primary token plus secondary tokens.
 * MLS strings carry a broker description after a semicolon ("Rr5; Rural Res 5 Ac",
 * including 15/25-char truncation walls) and overlay lists after commas or spaces
 * ("RR10, WA", "EFUSC DR SMIA").
 */
export function splitZoningString(raw: string): { primary: string; secondary: string[] } {
  const beforeDescription = raw.split(";")[0] ?? "";
  const tokens = beforeDescription
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const [first, ...rest] = tokens;
  return {
    primary: first ? normalizeZoningToken(first) : "",
    secondary: rest.map(normalizeZoningToken).filter(Boolean),
  };
}

const COUNTY_BY_MLS_NAME: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [slug, j] of Object.entries(JURISDICTIONS)) {
    if (j.kind === "county" && j.mlsCounty) out[j.mlsCounty.toLowerCase()] = slug;
  }
  return out;
})();

const CITY_BY_CITY_LOWER: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [slug, j] of Object.entries(JURISDICTIONS)) {
    if (j.kind === "city" && j.cityLower) out[j.cityLower] = slug;
  }
  return out;
})();

/** Definitions indexed by `jurisdiction:normalizedCode`. */
const NORMALIZED_INDEX: Record<string, ZoningDefinition> = (() => {
  const out: Record<string, ZoningDefinition> = {};
  for (const def of Object.values(DEFINITIONS)) {
    out[`${def.jurisdiction}:${normalizeZoningToken(def.code)}`] = def;
  }
  return out;
})();

function lookupInJurisdiction(jurisdiction: string, normalizedCode: string): ZoningDefinition | undefined {
  const direct = NORMALIZED_INDEX[`${jurisdiction}:${normalizedCode}`];
  if (direct) return direct;
  const alias = ALIASES[`${jurisdiction}:${normalizedCode}`];
  if (alias) return NORMALIZED_INDEX[`${jurisdiction}:${normalizeZoningToken(alias.to)}`];
  return undefined;
}

function unmappedNoteFor(jurisdictions: string[], normalizedCode: string): string | undefined {
  const scoped = UNMAPPED.find((u) => u.normalizedCode === normalizedCode && u.jurisdiction !== null && jurisdictions.includes(u.jurisdiction));
  if (scoped) return scoped.note;
  const global = UNMAPPED.find((u) => u.normalizedCode === normalizedCode && u.jurisdiction === null);
  return global?.note;
}

function recognizedOverlays(jurisdiction: string, secondaryTokens: string[]): RecognizedOverlay[] {
  const table = OVERLAYS[jurisdiction];
  if (!table) return [];
  return secondaryTokens.filter((t) => table[t]).map((t) => ({ token: t, name: table[t] }));
}

export function resolveZoning(input: ZoningResolutionInput): ZoningResolution {
  const rawCode = input.code ?? "";
  const { primary, secondary } = splitZoningString(rawCode);

  const base: Omit<ZoningResolution, "status"> = {
    rawCode,
    normalizedCode: primary,
    secondaryTokens: secondary,
  };

  if (!primary) return { ...base, status: "unmapped" };

  const countySlug = input.county ? COUNTY_BY_MLS_NAME[input.county.trim().toLowerCase()] : undefined;
  const citySlug = input.cityLower ? CITY_BY_CITY_LOWER[input.cityLower.trim().toLowerCase()] : undefined;

  // Reachable jurisdictions, each tagged with the strength of the evidence that
  // put it in the set.
  type Reachable = { slug: string; via: "county" | "city-limits" | "mailing-city" | "code-only" };
  const reachable: Reachable[] = [];

  if (countySlug) {
    reachable.push({ slug: countySlug, via: "county" });
    // A city jurisdiction is reachable only through its own city name. The
    // mailing city must actually match the city jurisdiction, and that city
    // must sit in the stated county; a mismatch (data conflict) drops the city.
    if (citySlug && JURISDICTIONS[citySlug]?.county === countySlug) {
      reachable.push({ slug: citySlug, via: input.insideCityLimits === true ? "city-limits" : "mailing-city" });
    }
  } else if (citySlug) {
    reachable.push({ slug: citySlug, via: input.insideCityLimits === true ? "city-limits" : "mailing-city" });
    const parentCounty = JURISDICTIONS[citySlug]?.county;
    if (parentCounty) reachable.push({ slug: parentCounty, via: "mailing-city" });
  } else {
    // No geography at all: search everything, flagged code-only. §6.0 item 3
    // makes a bare code ambiguous by definition.
    for (const slug of Object.keys(JURISDICTIONS)) reachable.push({ slug, via: "code-only" });
  }

  type Match = Reachable & { def: ZoningDefinition };
  const matches: Match[] = [];
  for (const r of reachable) {
    const def = lookupInJurisdiction(r.slug, primary);
    if (def) matches.push({ ...r, def });
  }

  if (matches.length === 0) {
    return {
      ...base,
      status: "unmapped",
      unmappedNote: unmappedNoteFor(
        reachable.map((r) => r.slug),
        primary,
      ),
    };
  }

  // insideCityLimits settles county-vs-city collisions when explicitly provided:
  // true keeps the city zone, false keeps the county zone (city codes do not
  // apply outside city limits).
  let effective = matches;
  if (matches.length > 1 && typeof input.insideCityLimits === "boolean") {
    const filtered = matches.filter((m) =>
      input.insideCityLimits ? JURISDICTIONS[m.slug]?.kind === "city" : JURISDICTIONS[m.slug]?.kind === "county",
    );
    if (filtered.length > 0) effective = filtered;
  }

  if (effective.length > 1) {
    // County first, then cities, for stable presentation. Never auto-picked.
    const ordered = [...effective].sort((a, b) => {
      const ka = JURISDICTIONS[a.slug]?.kind === "county" ? 0 : 1;
      const kb = JURISDICTIONS[b.slug]?.kind === "county" ? 0 : 1;
      return ka - kb || a.slug.localeCompare(b.slug);
    });
    return {
      ...base,
      status: "resolved",
      jurisdictionConfidence: "ambiguous",
      candidates: ordered.map((m) => m.def),
    };
  }

  const match = effective[0];
  let jurisdictionConfidence: JurisdictionConfidence;
  if (match.via === "county" || match.via === "city-limits") {
    jurisdictionConfidence = "county-certain";
  } else if (match.via === "mailing-city") {
    jurisdictionConfidence = "city-assumed";
  } else {
    jurisdictionConfidence = "ambiguous";
  }

  const overlays = recognizedOverlays(match.slug, secondary);
  return {
    ...base,
    status: "resolved",
    jurisdictionConfidence,
    definition: match.def,
    ...(overlays.length > 0 ? { overlays } : {}),
  };
}

/** All definitions, keyed `jurisdiction:code`, for the filter-vocabulary wave. */
export function allZoningDefinitions(): Record<string, ZoningDefinition> {
  return DEFINITIONS;
}

/** Jurisdiction registry (counties + cities with their county and mailing-city spelling). */
export function allZoningJurisdictions(): Record<string, Jurisdiction> {
  return JURISDICTIONS;
}
