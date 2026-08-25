# Prototype tooling — UX prototype for the site rebuild

Tooling for the 27-screen Ryan Realty UX prototype: nine surfaces (chrome, home, results,
listing, place, market, content, convert, trust) × three competing directions (a / b / c),
published as one Artifact with a group/direction router.

**The pages themselves are not in this repo.** Tailwind v4 scans the tree and would pick up
raw prototype HTML as app source. The pages live in the published Artifact, which is also
the durable copy — a scratchpad wipe on 2026-08-22 destroyed the only local copy and the
Artifact was the sole survivor. Everything here exists so that recovery is one command.

## Recovering the pages

1. Read the artifact (`Artifact` tool, `action: "read"`). Large pages are written to a local
   file whose path the result names.
2. Extract the three JSON payloads — `d-pages`, `d-imgs`, `d-meta` — into `pages/*.html`,
   `data/imgs.json`, `data/meta.json`, and the surrounding markup into `shell.html` with
   `<!--DATA:d-pages-->` style markers where each payload was.

   Scan for the closing tag with a loop that skips **escaped** ones (`<\/script>`) — a
   plain non-greedy regex stops inside the payload and silently truncates it.

3. **Strip the `<body>` and the trailing `</body></html>`** off `shell.html`. The publish
   wrapper supplies its own, and a copy carried over from the extracted artifact produces a
   duplicate `<body>` in the published page. Browsers drop the second one so nothing visibly
   breaks, which is exactly why it survives a render check unnoticed.

## build.py

Reassembles `shell.html` + `pages/` + `data/` into the single-file bundle. Validates that
every `ximg:` reference resolves and that no payload can close its own script block.

    python3 build.py [out.html]

**The escaping matters.** Six pages carry inline `<script>` blocks. A raw `</script>` inside
a `<script type="application/json">` body closes it early and the whole bundle fails to parse
at load — it renders as a blank page, not an error. `build.py` emits `<\/` (JSON reads `\/`
as `/`, so nothing downstream changes) and refuses to write a payload containing a literal
closing tag.

## prototype-gate.mjs

Loads every page at 390px in real Chromium and fails on: text crossing the frame, a body that
scrolls sideways, quirks mode, console/uncaught errors, and **dead controls** — anything that
looks pressable and changes nothing.

    node prototype-gate.mjs [pageKey ...]      # no args = all pages

Needs `playwright`; symlink the repo's `node_modules` into the prototype directory (ESM
ignores `NODE_PATH`).

### What this gate learned the hard way

Every one of these was a case of the gate lying, found by checking a "failure" by hand. If
this is ever rewritten, these are the traps:

- **Diff content, never length.** A single-select group that flips `aria-pressed` from
  `true`→`false` on one control and `false`→`true` on another nets to the same character
  count. Length-diffing called a working slot picker dead.
- **Dispatch the click on the element.** A forced click fires at a centre coordinate another
  element may own, so the handler never runs — indistinguishable from a dead control.
  `scrollIntoView` then `n.click()`.
- **A no-op can be honest.** An already-selected segment, a close button with nothing open, a
  send button on an empty composer. Judge each suspect from a **fresh load**, then change the
  page's state and retry before calling it dead.
- **Identify suspects by label, not index.** Some controls do not exist until another reveals
  them, so indices shift between loads and an index-based retry clicks the wrong element.
- **Not everything pressable is a control.** Text fields (clicking one correctly does nothing
  but focus), `tel:`/`mailto:` links and their descendants, form controls (covered by the form
  sweep), and route links like `href="/listings"` — whose clicks destroy the execution context
  and take the whole run down.
- **Submit every form, empty and filled.** A handler that only throws on submit is invisible
  to a click sweep. This caught a real `ReferenceError` in a signup path.
- **Watch inner scrollers.** A carousel's prev/next moves a container's `scrollLeft` and
  touches neither the markup nor `window.scrollY`.
- **Let scroll settle.** These designs scroll smoothly over ~600ms; sampling at 150ms reads
  mid-animation.
- **`complete && naturalWidth === 0` is broken.** `!complete` is just a pending lazy image —
  `place-c` lazy-loads all six.
- **Match by `cursor: pointer`, not class name.** Class matching flagged table rows (`.tab`)
  and the `Sample` data label as dead controls.

## CONVENTIONS.md

The rules any agent editing a page must follow: vanilla JS in one IIFE, `var` only, no
libraries (a strict CSP blocks every host but Google Fonts), no visual redesign, 390px
mobile-first, and the two that are not style preferences —

- **Every `<span class="s">Sample</span>` stays.** It is the unverified-data label. Matt is a
  licensed Oregon principal broker; figures a page computes carry it too.
- **A control that looks interactive and does nothing gets deleted, not captioned.**
