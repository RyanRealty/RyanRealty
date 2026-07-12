---
name: domain-context
description: "Author and maintain CONTEXT.md — the repo's ubiquitous-language document. One canonical name per domain concept, with rejected synonyms, relationships, example dialogues, and flagged ambiguities. Use when naming a new domain concept (table, column, component, skill, status value), when two names exist for one thing, when a naming ambiguity gets resolved in chat, or when onboarding to an unfamiliar domain area of this codebase."
---

# Domain context (CONTEXT.md)

Pattern source: Matt Pocock's `course-video-manager` CONTEXT.md (reviewed 2026-07-11). The idea: a single repo-root document that fixes the domain language so every agent session, commit message, UI label, and schema name uses the same word for the same thing — and never the rejected synonyms.

**The document lives at `CONTEXT.md` in the repo root.** If it does not exist yet, the first invocation of this skill creates it (see "Seeding" below).

## Why this exists

A term that lives only in chat history is forgotten next session. When one session says "market pulse", the next says "market snapshot", and a third says "pulse cache", the schema, the DAL, the UI copy, and the docs drift apart. CONTEXT.md is the mechanical fix: the canonical term is written down once, the losers are listed under _Avoid_, and every future naming decision starts by reading the doc.

## Document structure (locked — mirror this exactly)

### 1. `## Language`

Grouped by domain area (one `###` per area). Each term entry:

```markdown
**MarketPulse**:
The 10–15 min freshness cache row in `market_pulse_live` that feeds every market stat surface; never aggregate raw `listings` instead.
_Avoid_: Market snapshot, Pulse cache, Live stats
```

Rules per entry:
- **Bold canonical name** — matches the code identifier where one exists (table name, type name, component name). If the code identifier and the best domain name disagree, the code name wins as canonical and the disagreement goes in Flagged ambiguities — never silently rename code.
- **One- or two-sentence definition** that carries the load-bearing constraint (freshness window, immutability, lifecycle rule), not just a gloss.
- **`_Avoid_:` list** — every synonym that has appeared in chat, code comments, or docs and lost. This list is the whole point: it's what stops re-drift.

### 2. `## Relationships`

Bullet list of structural facts written in the canonical terms, bolded. Cardinality, lifecycle, and one-way transitions ("a real **Course** never reverts to ghost") belong here. This section is where invariants live in prose form.

### 3. `## Example dialogue`

Short dev ↔ domain-expert Q&A blocks that exercise the terms in realistic flows. These teach usage the glossary can't — which term applies in which situation, and what the edge cases are. Write them for the flows that actually confuse people (status transitions, cache invalidation, publish/approval gates).

### 4. `## Flagged ambiguities`

The honest list. Every term that collides ("version" meaning two things), every word with context-dependent meaning ("delete" doing different things for ghost vs real entities), every unresolved naming dispute. When an ambiguity is later resolved, keep the entry and mark it `(resolved)` with the resolution and date — the history of why a name won prevents relitigating it.

## Maintenance protocol

1. **Bidirectional, same as skill updates (CLAUDE.md rule).** When Matt coins or corrects a term in chat, the agent's job is twofold: apply it to the immediate work AND update CONTEXT.md in the same session. Chat-only terms are forgotten terms.
2. **One canonical name at a time.** Never let two canonical entries describe the same concept. Renaming a term moves the old name into the _Avoid_ list — it never just disappears.
3. **Read before naming.** Before naming any new table, column, DAL function, component, status value, action_type, or skill, scan CONTEXT.md for an existing term that covers the concept. Extend the doc only when the concept is genuinely new.
4. **Code is the referee.** Definitions must match what the code actually does. When updating a definition, verify against the source (the DAL function, the migration, the component) — this doc inherits the §0 accuracy bar: no remembered claims.
5. **Keep it lean.** This is a language document, not architecture docs. Mechanism details live in `docs/`; CONTEXT.md carries names, meanings, avoid-lists, relationships, and ambiguities only.

## Seeding CONTEXT.md for this repo

First invocation builds v1 covering the core domain areas, each verified against code and `docs/DATABASE_FOR_AI_AGENTS.md` before writing:

- **Listings / MLS** — listing, StandardStatus values, SFR convention (`PropertyType='A'`), mixed-case column quoting, listing media suppression.
- **Market data** — MarketPulse vs MarketStatsCache (two caches, two freshness windows), months of supply + thresholds, geo_type/slug formats, resort community vs Bend neighborhood vs city.
- **Marketing brain** — action row, producer, the status flow (pending → in_production → ready → approved → executed → measured → killed), the producer freeze, content engine.
- **CMA** — subject, comp, comp judgment, accuracy contract, the two-method pricing.
- **TC / transactions** — envelope, checklist, the `_X_` executed marker, Vault-as-truth vs SkySlope-as-workflow.
- **CRM / leads** — lead origin, attribution cookie, smart list, action plan, pause-on-reply.
- **Video pipeline** — beat, clip, quality gate, viral scorecard, first-frame rule, draft-first locations (`out/` vs `public/v5_library/`).

Known ambiguities to flag from day one: "version" (methodology version vs export/design versions), "pulse" vs "stats" caches, "approved" (Matt's chat approval vs `approved` status column), "publish" (social publish vs git push vs producer publish step).

## Relationship to other rules

- Brand voice rules govern consumer-facing prose; CONTEXT.md governs internal domain language. Both can apply to one string (a UI label must use the canonical term AND pass voice).
- The no-adhoc-SQL and DAL-first rules stand; CONTEXT.md names concepts, `docs/DATABASE_SCHEMA_SNAPSHOT.md` remains the schema truth.
