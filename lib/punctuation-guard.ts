/**
 * punctuation-guard.ts
 *
 * HARD-CODED em-dash ban for every Ryan Realty content surface.
 *
 * Locked 2026-05-15 per Matt's directive. Em-dashes (U+2014) and en-dashes
 * (U+2013) used as punctuation are mark-of-AI tells and are banned across
 * every channel: social captions, blog posts, ad copy, email body, video
 * on-screen text, listing descriptions, flyers, signage, on-air VO.
 *
 * This file is the code-level enforcement. Voice rule is documented at
 * marketing_brain_skills/brand-voice/voice_guidelines.md §6.1.
 *
 * Usage:
 *   import { assertNoDashes, stripDashes, hasDashes } from '@/lib/punctuation-guard';
 *
 *   // Hard fail before publish:
 *   assertNoDashes(caption, { source: 'captions/schoolhouse-ig.md' });
 *
 *   // Auto-strip when accepting upstream content:
 *   const safe = stripDashes(rawCopy);
 *
 *   // Check without throwing:
 *   if (hasDashes(text)) { ... }
 *
 * The publish API route (/api/social/publish) MUST call assertNoDashes()
 * on every caption before firing. See automation_skills/automation/publish/SKILL.md.
 */

// U+2014 em-dash, U+2013 en-dash, U+2015 horizontal bar, U+2E3A two-em dash,
// U+2E3B three-em dash. Hyphen-minus (U+002D) is NOT banned — it is allowed as
// a compound hyphen in standard English ("single-family", "out-of-state").
const BANNED_DASHES_REGEX = /[–—―⸺⸻]/g;

export interface DashFinding {
  index: number;
  char: string;
  codepoint: string;
  // 30 chars of context around the match
  context: string;
}

export interface AssertOptions {
  source?: string;
  // If true, throw on en-dash too. Default true.
  banEnDashes?: boolean;
}

/**
 * Returns true if the text contains any banned dash character.
 */
export function hasDashes(text: string): boolean {
  if (!text) return false;
  BANNED_DASHES_REGEX.lastIndex = 0;
  return BANNED_DASHES_REGEX.test(text);
}

/**
 * Returns every banned-dash finding with context. Empty array = clean.
 */
export function findDashes(text: string): DashFinding[] {
  if (!text) return [];
  const findings: DashFinding[] = [];
  BANNED_DASHES_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = BANNED_DASHES_REGEX.exec(text)) !== null) {
    const i = match.index;
    const start = Math.max(0, i - 30);
    const end = Math.min(text.length, i + 30);
    findings.push({
      index: i,
      char: match[0],
      codepoint: 'U+' + match[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0'),
      context: text.slice(start, end).replace(/\n/g, ' '),
    });
  }
  return findings;
}

/**
 * Returns text with every banned dash replaced.
 *
 *   em-dash (—)  →  period+space  (sentence break, the most common case)
 *   en-dash (–)  →  hyphen-minus  (often used as a range, restore to "-")
 *
 * Note: This auto-replacement is for accepting external/AI-generated copy.
 * For first-party Ryan Realty content, fix the source rather than auto-strip.
 */
export function stripDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/—/g, '. ') // em-dash → period
    .replace(/―/g, '. ') // horizontal bar → period
    .replace(/⸺/g, '. ') // two-em → period
    .replace(/⸻/g, '. ') // three-em → period
    .replace(/–/g, '-')   // en-dash → hyphen-minus
    .replace(/\.\s+\.\s+/g, '. ') // collapse double periods from adjacent strips
    .replace(/\s+\./g, '.')      // tidy space-before-period
    .trim();
}

export class DashViolationError extends Error {
  findings: DashFinding[];
  source?: string;
  constructor(findings: DashFinding[], source?: string) {
    const head = findings[0];
    const where = source ? ` in ${source}` : '';
    super(
      `Banned dash character ${head.codepoint} (${head.char}) found${where}. ` +
        `${findings.length} violation(s). Context: "${head.context}". ` +
        `Em-dashes and en-dashes are banned per voice_guidelines.md §6.1. ` +
        `Use period or comma. Auto-fix via stripDashes() if accepting external copy.`,
    );
    this.name = 'DashViolationError';
    this.findings = findings;
    this.source = source;
  }
}

/**
 * Throws DashViolationError if the text contains any banned dash.
 * Call this at every publish boundary: caption-to-platform, blog-to-WP,
 * email-send, video-VO-script, listing-description-MLS.
 */
export function assertNoDashes(text: string, opts: AssertOptions = {}): void {
  const findings = findDashes(text);
  if (findings.length > 0) {
    throw new DashViolationError(findings, opts.source);
  }
}
