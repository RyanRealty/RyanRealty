# PDF analysis and AI (research note)

Last updated: 2026-04-11

This document summarizes how teams ship **reliable** PDF understanding in 2025 and how that maps to Ryan Realty’s SkySlope Forms scripts (`scripts/skyslope-pdf-insight.mjs`, `.cursor/rules/skyslope-pdf-analysis.mdc`).

## What you already have (and why it is the right base)

The enforced standard is **deterministic**:

1. **pdf.js** text layer + widget annotations  
2. **Mandatory OCR** on the same page window (Poppler + Tesseract when available, else render + tesseract.js)  
3. **Labeled dual blocks** per page so machine text and OCR are never silently merged  

That matches current “good engineering” advice: **extract faithfully first**, then optionally add intelligence on top. Several public write-ups argue against using large vision models **as the primary OCR** for legal and financial PDFs, because numerals and small layout details drift in ways that are unacceptable for brokerage files (see e.g. practitioner notes on “LLM as OCR” failure modes).

So the gap is not “replace pdf.js with ChatGPT.” The gap is deciding **where** an LLM or a heavier parser belongs in the stack.

## Three layers people confuse

| Layer | Job | Typical tools | Your repo |
|-------|-----|-----------------|-----------|
| **Perception** | Pixels → text, forms, low-level signals | pdf.js, Tesseract, Poppler, cloud OCR | Implemented and mandated |
| **Structure** | Blocks, reading order, tables, headings | LiteParse, LlamaParse, AWS Textract, Reducto, etc. | Not separate today; mostly linear text |
| **Reasoning** | Classify, summarize, map to checklist, flag risk | GPT-4o family, Claude, small local models | Heuristics only (`buildExecutionAssessment`, regex vendors) |

Most “AI PDF” demos skip straight to layer 3 on raw files. Production systems usually **insert layer 2 or strengthen layer 1** before spending on vision tokens.

## Patterns that actually ship

### 1. Parser-first, escalate only “hard” pages

- Run a **fast structural parse** (layout, boxes, reading order).  
- **Validate** (expected sections present, density anomalies).  
- Send **only hard pages** (scans, dense tables, handwriting) to a heavier OCR path or a vision model.  

References: LlamaIndex **LiteParse** (spatial parse + optional OCR server + screenshots for agents), and the general “stop sending every page to a VLM” narrative. This saves cost and keeps an audit trail of what the model saw.

### 2. OCR / specialized extraction for numbers and tables

For amounts, dates, and table grids, **classical OCR or document APIs** still win on faithfulness versus “model reads the PNG.” Use an LLM **after** you have stable text or markdown, for interpretation and structured JSON—not as the first pixel reader.

### 3. Vision LLM on images when text is truly thin

When `textDensity` is empty or thin **and** OCR is still weak, **rendered page images** + a vision-capable model can help with *layout reasoning* (e.g. “which block is counteroffer 2”). Cap pages, cap resolution, and log prompts without raw PII in client-visible logs.

### 4. Structured outputs

Any LLM step should use **schema-constrained output** (e.g. Zod + tool/JSON mode) so the brief gets fields like `execution_risk`, `missing_initial_guess`, `cited_page_hints`, not free-form hallucinated prose.

## Concrete integration options (for later implementation)

**A. Stay local, improve structure (low recurring cost)**  
- Add **LiteParse** (or similar) to emit blocks / markdown, then keep your dual pipeline as a cross-check or for tail pages.  
- Good when transaction PDFs have nasty columns or you want page screenshots for a future agent step.

**B. Optional “AI summary” on existing dual string (lowest lift)**  
- New env flag, e.g. `SKYSLOPE_PDF_AI_REASONING=1`, only after `analyzePdfBuffer` returns text.  
- Call your existing server-side AI route with a strict system prompt: input = labeled dual text only, output = JSON checklist hints.  
- **No** images in v1; keeps cost and privacy simpler.  
- Still “advisory”; principal broker review unchanged.

**C. Cloud document APIs (highest quality, ongoing cost)**  
- LlamaParse, Amazon Textract, Google Document AI, etc.  
- Best when volume is moderate and you want vendor SLAs.  
- Requires legal review (subprocessor, retention, BAA if any health-adjacent data).

**D. Vision on selective pages**  
- Only when heuristics say “scan-like” or OCR snippet empty after cap.  
- Pass 1–3 page PNGs + short prompt; merge results back into the same `PdfInsight` shape for the brief.

## Privacy and compliance (non-negotiable)

- Transaction PDFs contain **PII and financial terms**. Any cloud model path needs: allowed subprocessors, data retention settings, and **no** training where the vendor allows opt-out.  
- Logs should not store full document text in production web logs.  
- Output copy must remain **advisory** (already aligned with `.cursor/rules/skyslope-pdf-analysis.mdc`).

## Recommended sequencing for this codebase

1. **Keep** the dual pipeline as the single source of extracted evidence.  
2. **Add** optional Tier B (text-only structured LLM) behind an env flag, using the merged dual string only, with hard token limits and schema output.  
3. **Measure** on a fixed sample of OREF PDFs: false positives on “executed” language, cost per file, latency.  
4. **Then** consider LiteParse or selective vision if metrics justify it.

## References (external)

- LiteParse (LlamaIndex): spatial PDF parse, optional OCR servers, screenshot path for agents — `https://github.com/run-llama/liteparse`  
- Parser-first / selective VLM escalation narrative — e.g. DEV community piece on LiteParse workflow  
- Caution on using LLMs as OCR for critical numerics — e.g. Medium “Don’t Use LLMs as OCR” (2025)  
- Structured extraction libraries (evaluate for fit) — e.g. `pdf-data-extractor` pattern (schema + OpenAI-compatible APIs)

## Internal canonical rule

The mandatory dual pipeline and extension point remain defined in:

- `.cursor/rules/skyslope-pdf-analysis.mdc`  
- `scripts/skyslope-pdf-insight.mjs`  

Any AI layer should **consume** `PdfInsight` output (or an approved successor), not fork a second PDF stack inside one-off scripts.
