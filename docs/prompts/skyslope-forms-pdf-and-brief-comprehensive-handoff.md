# Handoff prompt: SkySlope Forms PDF pipeline, principal broker brief, and advisory AI

Last updated: 2026-04-11

**Purpose:** Give another coding agent full context to design or implement a **more comprehensive** solution around SkySlope Forms transaction files, PDF analysis, and principal-broker-facing outputs. This document synthesizes an extended thread of work on the Ryan Realty repo.

**Repo:** Ryan Realty (Next.js 16, React 19, TypeScript, Supabase, Vercel). SkySlope integration is **Node ESM scripts** under `scripts/`, not the main web app surface.

---

## Business context

- **SkySlope Forms** (Files API on `https://api-latest.skyslope.com`) holds listing and sale **file cabinets** with uploaded documents (PDFs and other types). This is **not** SkySlope Suite (different product).
- **Principal broker** needs a readable **Word brief** and supporting artifacts that group documents by buyer representation, listing/agency, and transactions (by address, folder, sale agreement number hints).
- All automated output is **advisory**. Final execution judgment, signatures, initials, and compliance remain with the human principal broker reviewing originals in SkySlope and escrow.

---

## What was wrong and how it was fixed (historical, for design continuity)

### 1. Word layout was unusable

- Early versions used **wide multi-column Word tables** for many documents. In portrait Word this was effectively unreadable.
- **Change:** Removed body tables. Each document is now **stacked paragraphs**: bold label line, full-width value line (memo style). Run summary and Part 3 address snapshots use the same pattern.
- **Files:** `scripts/skyslope-forms-principal-brief-docx.mjs` (docx npm). Design skill: `.cursor/skills/professional-word-docx/SKILL.md`.

### 2. “No PDF bytes” / unreadable PDF analysis

- Scripts used **bare `fetch(doc.url)`** without SkySlope **Session** headers. Many responses were HTML, JSON errors, or empty bodies—not `%PDF` magic bytes—so analysis failed with cryptic “not PDF” style messages.
- **Change:** `fetchSkyslopeDocumentBinary(url, getHeaders)` in `scripts/skyslope-files-api.mjs` sends `Session` + `timestamp` + binary-friendly `Accept`, without forwarding `Content-Type: application/json` on GET. **`classifyPdfDownload`** in `scripts/skyslope-pdf-insight.mjs` classifies empty, oversize, 401/403, HTML, JSON, etc., and **`emptyPdfInsight`** humanizes `flagsLine` messages.
- **Wired in:** principal brief, comprehensive log, transaction workbook PDF sample, master audit.

### 3. “Smarter agent” for triage (optional)

- **Not** replacing pdf.js + OCR. A **multi-step advisory agent** runs **after** successful `analyzePdfBuffer`: observe (stats) → curate (capped excerpt) → one **xAI Grok** JSON completion → validate/clamp.
- **Files:** `scripts/skyslope-pdf-advisory-agent.mjs`; integrated in `scripts/skyslope-forms-principal-brief-docx.mjs` when `SKYSLOPE_PDF_AGENT=1` and `XAI_API_KEY` are set. Vitest: `scripts/skyslope-pdf-advisory-agent.test.mjs`.
- **Env:** `SKYSLOPE_PDF_AGENT_MAX_CALLS` (default 48), `SKYSLOPE_PDF_AGENT_PACE_MS`, `SKYSLOPE_PDF_AGENT_MAX_INPUT_CHARS`, `SKYSLOPE_PDF_AGENT_MODEL`. Brief stderr JSON includes `pdf_agent_enabled`, `pdf_agent_calls`.

---

## Non-negotiable technical standards (must preserve)

### Dual PDF pipeline (single source of truth)

- **Rule file:** `.cursor/rules/skyslope-pdf-analysis.mdc`
- **Module:** `scripts/skyslope-pdf-insight.mjs`
- Every analyzed page in the read window gets:
  1. **pdf.js** `getTextContent` + annotations/widgets
  2. **Mandatory OCR** on the same pages (Poppler `pdftoppm` + Tesseract when available; else pdf.js render + `tesseract.js`)
  3. **Labeled layout** per page: machine text block vs OCR block—never silently merge
- **Do not** fork a second PDF stack inside one-off scripts; extend `skyslope-pdf-insight.mjs` only when changing the standard.

### Research-backed direction for “more AI”

- **Doc:** `docs/skyslope-pdf-ai-research.md`
- Summary: **Parser / OCR first** for faithfulness (especially numbers and legal forms). **LLMs** for triage, structure, or summaries **on extracted evidence**. Avoid “every page to a VLM as OCR” for brokerage PDFs at volume without cost, audit, and hallucination controls.

### Auth and scripts

- SkySlope login: HMAC pattern in scripts using `SKYSLOPE_*` from `.env.local` (see existing `login()` in principal brief script).
- Document list: `GET /api/files/listings|sales/{guid}/documents`; document download URLs require **Session** on the file request (see above).

---

## Key files and scripts (map for the next agent)

| Area | Path |
|------|------|
| PDF insight + `emptyPdfInsight`, `classifyPdfDownload`, `buildExecutionAssessment` | `scripts/skyslope-pdf-insight.mjs` |
| Authenticated document download | `scripts/skyslope-files-api.mjs` (`fetchSkyslopeDocumentBinary`, `skyslopeFetchWithRetry`) |
| Principal broker Word brief | `scripts/skyslope-forms-principal-brief-docx.mjs` — `npm run skyslope:forms-brief` |
| Advisory agent (optional) | `scripts/skyslope-pdf-advisory-agent.mjs` |
| Comprehensive markdown log | `scripts/skyslope-forms-comprehensive-log.mjs` |
| Excel workbook | `scripts/skyslope-forms-transaction-workbook.mjs` |
| Master audit markdown | `scripts/skyslope-forms-master-audit.mjs` |
| Document taxonomy / `inferKind` / Word section | `scripts/skyslope-forms-document-taxonomy.mjs` |
| Site AI (xAI Grok) for marketing text | Both routes were DELETED 2026-09-04 (public, unauthenticated, own key). Every xAI call now goes through `lib/grok/`, held by `ci:grok-chokepoint` |

---

## Environment variables (reference)

**SkySlope (typical):** `SKYSLOPE_CLIENT_ID`, `SKYSLOPE_CLIENT_SECRET`, `SKYSLOPE_ACCESS_KEY`, `SKYSLOPE_ACCESS_SECRET`, optional `SKYSLOPE_INCLUDE_ARCHIVED=1`.

**PDF caps:** `SKYSLOPE_MAX_PDF_BYTES`, `SKYSLOPE_PDF_MAX_PAGES`, `SKYSLOPE_PDF_OCR_MAX_PAGES`, script-specific caps (`SKYSLOPE_BRIEF_MAX_PDFS`, `SKYSLOPE_LOG_PDF_MAX_PAGES`, etc.—see rule file table).

**Advisory agent:** `SKYSLOPE_PDF_AGENT=1`, `XAI_API_KEY`, optional tuning vars listed above.

---

## Suggested expansions (for the other agent to flesh out)

Pick based on product and compliance sign-off:

1. **Structured extraction** — Zod (or similar) schemas for OREF-adjacent fields (parties, dates, SA numbers) from `PdfInsight.text`, with confidence and page anchors; store separately from free-text agent notes.
2. **Parser-first upgrade** — Evaluate `@llamaindex/liteparse` or cloud parsers (LlamaParse, Textract) for layout and tables; feed **that** output into heuristics or LLM, not raw pixels first.
3. **Selective vision** — Only for pages flagged thin/empty after OCR; cap pages and resolution; strict logging and no PII in web server logs.
4. **Unified “run report” CLI** — One entrypoint that produces brief + workbook row + optional JSON sidecar for downstream tools.
5. **Observability** — Per-run manifest: which files succeeded PDF parse, which used agent, token counts, failure class histogram (`classifyPdfDownload` reasons).
6. **Policy** — Subprocessor list, retention, DPA for any new vendor; keep principal-broker disclaimer in every consumer-facing artifact.

---

## Constraints and repo habits

- **Push to `main`** per `AGENTS.md` / workspace rules unless user says otherwise.
- **Do not** ask the user to run terminal commands; the coding agent should run builds/tests.
- **Definition of done** for productized features: local `npm run build` + tests; production parity rules apply when shipping app + DB changes (SkySlope scripts are often script-only).
- Word output: **no** body tables for long label/value content (current standard); shadcn/design rules apply to **site** UI, not necessarily to docx scripts.

---

## Success criteria (example for a “comprehensive solution” phase)

- [ ] Principal brief remains readable in Microsoft Word at default zoom for hundreds of documents.
- [ ] PDF fetch + analyze failure messages are **actionable** (session, oversize, HTML, HTTP denial).
- [ ] Any new AI step is **env-gated**, **schema-bounded**, and **does not** replace the dual pipeline inside `skyslope-pdf-insight.mjs`.
- [ ] Documentation in `docs/skyslope-pdf-ai-research.md` and `.cursor/rules/skyslope-pdf-analysis.mdc` stays aligned with behavior.
- [ ] Optional: metrics from a fixed golden set of PDFs (precision/recall for SA number extraction, false “executed” language rate for agent).

---

## One-paragraph paste for a chat agent

You are improving Ryan Realty’s **SkySlope Forms** tooling. The repo already has a **mandatory dual PDF pipeline** (pdf.js + per-page OCR, labeled blocks) in `scripts/skyslope-pdf-insight.mjs` per `.cursor/rules/skyslope-pdf-analysis.mdc`. Document downloads must use **Session-authenticated** fetches (`fetchSkyslopeDocumentBinary` in `skyslope-files-api.mjs`). The **principal broker Word brief** is generated by `scripts/skyslope-forms-principal-brief-docx.mjs` using **paragraph stacks, not tables**, for per-document fields. An **optional advisory agent** (`scripts/skyslope-pdf-advisory-agent.mjs`) runs observe → curate → one xAI JSON call after successful PDF analysis when `SKYSLOPE_PDF_AGENT=1` and `XAI_API_KEY` are set. Read `docs/skyslope-pdf-ai-research.md` before adding model capacity. Extend the PDF standard only inside `skyslope-pdf-insight.mjs`; add orchestration, schemas, parsers, or selective vision **around** it. Preserve advisory-only copy for principal broker judgment. Implement with tests, run `npm run build`, and push to `main`.

---

*Generated as an internal handoff prompt. Refine with your firm’s compliance and vendor policies before external sharing.*
