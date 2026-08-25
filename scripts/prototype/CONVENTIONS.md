# Prototype interaction conventions — read before editing any page

These 27 pages are a UX prototype for Ryan Realty (Central Oregon brokerage). Nine surfaces,
three competing directions each (a / b / c). They render inside an iframe on a phone-width stage.

Six pages already have behaviour. Twenty-one are visually complete but inert. **Your job is to make
the inert ones actually work** — not to redesign them.

---

## The one rule that matters

**Every control must do the thing it looks like it does.** A filter chip filters. A sort control
re-sorts. A toggle changes state. A tab switches panels. A gallery advances.

A control that looks interactive and does nothing is worse than no control — delete it rather than
ship it dead. This is a standing rule from the client: dead buttons get removed, never captioned.

If you cannot make a control genuinely work inside a static prototype, **remove the control** and
note the removal in your report.

---

## Hard constraints

1. **Vanilla JS only.** No libraries, no frameworks, no CDN. A strict CSP blocks every external
   host. The single exception already in use is the Google Fonts stylesheet — leave those `<link>`
   tags alone, add no others.
2. **One inline `<script>`**, last thing before `</body>`, wrapped in an IIFE:
   `(function () { ... })();` — matching the existing pages exactly.
3. **`var`, not `let`/`const`**, and no arrow functions in the page scripts. The existing pages are
   written this way; match them.
4. **Do not change the visual design.** No new colors, no layout restructuring, no font changes, no
   new sections. You are adding behaviour to a design that is already approved. Adding a
   `.is-active` class and the CSS rule that styles it is fine and expected; redesigning is not.
5. **Preserve every `<span class="s">Sample</span>` mark.** That is the client's unverified-data
   label and it is a licensing-compliance requirement — the client is a licensed principal broker
   and every unverified figure must carry it. Never delete one, never let one drift away from the
   number it labels. If your interaction creates new numbers, they carry the mark too.
6. **390px wide, mobile-first.** No text may overflow horizontally at 390px. No horizontal page
   scroll. Wide content scrolls inside its own container.
7. **Respect `prefers-reduced-motion`** on anything you animate.
8. **Keyboard**: anything clickable is reachable and operable by keyboard. Use real `<button>`
   elements where you add controls. Give focus a visible state.
9. **Never write `</script>` inside a page.** Ending an inline script is unavoidable — that one is
   fine — but do not put the literal sequence anywhere else (e.g. in a JS string).

---

## Brand (locked — do not deviate)

- **Navy `#102742`** and **cream `#faf8f4`** only. White and black are permitted solely for
  text-on-photo legibility and scrim layers. Any other hex is off-brand.
- Hover/pressed states: `rgba(16,39,66,0.85)`. Borders/dividers: `rgba(16,39,66,0.08)`.
- **Square corners.** Display type is Amboqia Boriango (already loaded), UI/body/data is Geist.
- Motion ladder: 200ms fades, 300ms entrances, ease-out, travel ≤16px.

---

## The established pattern (from `pages/listing-a.html`)

Study it before you write anything. It shows the house style:

- A short comment block above each mechanism explaining **what it does and why that approach** —
  written plainly, no restating the code.
- Real data arrays with real values, named for what they are (`RATIOS`, `WORDS`).
- Measured layout over guessed layout: it fits the price by measuring `getBoundingClientRect()`
  against available width and stepping the font size down, rather than assuming a size.
- Re-runs layout work on `document.fonts.ready` and on `resize`, because a webfont landing late
  changes every measurement.

Match that standard. Numbers you introduce should be plausible Central Oregon values consistent
with whatever the page already shows — never contradict a figure already on the page.

---

## Working method

1. Read your assigned page files in full first.
2. Read `pages/listing-a.html` for the house style.
3. Edit **only** the files assigned to you. Another agent owns every other file.
4. After editing, run from `proto/`:
   ```
   python3 build.py /tmp/check-$$.html
   ```
   It validates that every image reference resolves and that no payload breaks its own script
   block. If it exits non-zero, you broke something — fix it before reporting.

## Report back

- Per page: what interactions you added, in one line each.
- Any control you **removed** because it could not be made real.
- Anything you could not do, stated plainly rather than glossed.
