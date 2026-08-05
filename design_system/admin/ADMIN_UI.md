# ADMIN_UI — the admin visual language (P6, v1)

Status: **PROPOSED 2026-08-05 — awaiting Matt's visual lock** (`decisions.md` is the only
lock location). Applies to the 11 locked IA destinations. Greenfield: the public brand
(navy `#102742`, cream, Amboqia) is **blacklisted as design input** for the admin — the
admin is a work instrument for three brokers, not a marketing surface. Canonical tokens:
[`tokens.css`](tokens.css). Hard screens: [`screens/`](screens/).

## 1. Thesis

**A calm instrument that answers "what do I do?" before it shows anything else.**

The admin's job is throughput: read state fast, act once, leave. So the language is
built on four commitments:

1. **Hierarchy by type and space, not color.** Weight, size, and the 4px grid do the
   organizing (Linear, Vercel dashboards). Surfaces are near-monochrome quiet.
2. **Color is a reserved vocabulary.** ONE action accent (blue) for interactive things;
   green/amber/red ONLY as status semantics. If a color appears, it means something
   (GOV.UK: color never decorates; Carbon status palette).
3. **Every screen leads with its next action.** Queues over dashboards; item rows carry
   their one primary action inline (Superhuman, Height). KPIs never open a screen.
4. **Data is typographic.** Tabular numerals everywhere, mono for identifiers, units
   always attached (Stripe's data-display discipline).

## 2. Foundations (see tokens.css for values)

- **Type: Inter** (self-hosted at P7), 400/500/600. Scale 11 → 12.5 → 14 (default) →
  16 → 20 → 26 (stats). Line-height 1.45. Mono for MLS numbers, phones, ids.
  Justification: the de-facto product-UI face (Linear, Radix Themes); screen-first
  metrics; excellent tabular figures. NOT Geist, NOT Amboqia (amnesia).
- **Color: derived from Radix Colors** scales (slate neutrals + blue accent +
  green/amber/red semantics), light and dark, every shipped pair contrast-computed
  (§4). Radix chosen because its 12-step scales are purpose-built for exactly this
  (backgrounds 1–3, borders 6–8, solids 9–10, text 11–12) and sit second in the
  pack's standards stack.
- **Space: 4px grid.** Row padding 12×16; card padding 16; section gap 24.
- **Shape: 6/8/12px radii.** Chips pill only when they filter.
- **Elevation: borders first.** Shadows exist only on overlays (menus, dialogs,
  sheets). Flat surfaces + hairlines carry the structure (Linear, Attio).
- **Motion: 120/200ms ease-out, reduced-motion respected.** Nothing loops.
- **Touch: 44px minimum targets** on phone (WCAG 2.5.8 / Apple HIG).
- **Focus: 2px offset ring in accent** — visible on every interactive element,
  keyboard-first (WCAG 2.4.7, APG patterns for all composites).

## 3. Patterns (the six that build every destination)

1. **Queue row** — the Today unit: [kind chip] [title + one-line context] [age]
   [ONE primary action + overflow]. Row height ≥56px phone / 48px desktop. Swipe-free:
   actions are buttons, not gestures (discoverability, NN/g).
2. **Thread pane** — Messages: history above a fixed composer (Matt Q3 verbatim),
   day dividers, inbound left-aligned surface / outbound right-aligned accent-wash,
   channel chip (SMS/email) per message. Composer holds send + template + quiet-hours
   state inline.
3. **Verdict + needs-you list** — Oversight (v2, reworked 2026-08-05 after Matt's
   review: v1's tile board read as clutter). The screen answers its question in ONE
   sentence ("4 things need you"), then ONE unified attention list (alarms, broken
   sequences, sign-off waits — same row grammar as Today, plain state words: Down /
   Slow / Broken / Waiting), then everything healthy collapses to quiet single-line
   hairline rows with NO boxes, then one numbers strip for the week. Healthy state
   earns near-zero visual weight (GOV.UK: lead with the answer; state words are text
   + color, never color alone — WCAG 1.4.1). Alarms persist until acknowledged.
4. **Worklist** — Prospecting/Valuations: filterable rows with per-row readiness
   (sendable / blocked-with-reason) and inline primary action. Blocked reasons print
   in plain words (suppressed · quiet hours · relisted), never just a disabled button.
5. **Entity page** — People/Closings: identity header (name, chips, one primary
   action), then stacked context sections. On phone the header collapses to two lines.
6. **Config form** — Settings: single-column, 640px max, label-above, inline
   validation, destructive actions require typed confirmation (GOV.UK forms).

## 4. Accessibility — computed AA proof (WCAG 2.2 AA)

Ratios computed 2026-08-05 on the exact shipped hex values (script in session log;
recompute with any WCAG contrast tool to audit). Normal text needs 4.5:1, large text
3:1, non-text UI 3:1.

| Pair (light) | Ratio | Verdict |
|---|---|---|
| text `#1C2024` on bg `#FCFCFD` | 15.98 | AAA |
| text on surface `#F9F9FB` / inset `#F0F0F3` | 15.58 / 14.41 | AAA |
| secondary `#60646C` on bg / surface | 5.79 / 5.65 | AA |
| accent text/link `#0D74CE` on bg | 4.65 | AA |
| white on accent solid `#0D74CE` (buttons) | 4.77 | AA |
| white on accent-strong `#113264` | 12.62 | AAA |
| ok `#218358` · warn `#AB6400` · danger `#CE2C31` text on bg | 4.60 / 4.50 / 5.08 | AA |
| white on danger solid `#CE2C31` | 5.21 | AA |
| dark text `#1C2024` on warn chip `#FFC53D` | 10.38 | AAA |

| Pair (dark) | Ratio | Verdict |
|---|---|---|
| text `#EDEEF0` on bg `#111113` / surface / inset | 16.25 / 15.15 / 13.70 | AAA |
| secondary `#B0B4BA` on bg / surface | 9.06 / 8.45 | AAA |
| accent `#70B8FF` on bg | 8.97 | AAA |
| dark text `#0B0B0C` on accent solid `#0090FF` | 6.03 | AA |
| ok `#3DD68C` / danger `#FF9592` on bg | 10.06 / 8.95 | AAA |
| dark text on warn `#FFCA16` | 12.85 | AAA |

Two candidate pairs FAILED at body size during derivation and were corrected before
shipping: white on `#0090FF` (3.26) and white on `#E5484D` (3.91) — light-mode solid
buttons therefore use `#0D74CE` / `#CE2C31`; dark-mode solids flip to dark text.
Beyond contrast: text + shape carry every status (1.4.1); focus visible everywhere
(2.4.7); 44px targets (2.5.8); composites follow APG (listbox, tabs, dialog).

## 5. Header / navigation chrome — two options, one recommended

**Option A — left rail (RECOMMENDED).** Desktop: 216px rail, 11 destinations in the
locked groups (Do / Move / Watch / Reach / Settings), collapsible to icons at <1200px.
Top of rail: global search (⌘K) + broker scope switch (Matt only). Rationale: 11
destinations exceed comfortable top-bar capacity; every discipline product at this
density (Linear, Attio, Retool, Stripe) rails left; vertical rails scale without
truncation.

**Option B — top bar.** Single 48px bar, destination switcher as a menu, search
center. One more click to switch destinations; considered and not recommended —
recorded for the lock decision.

**DECIDED (Matt, 2026-08-05): Option A — left rail.**

**Phone (both options): the locked 5-tab bar** — Today · Messages · Prospecting ·
People · Oversight, 56px, labels always visible (no icon-only tabs, NN/g), badge
counts on Today and Messages only (two badge sources max — attention economy).

## 6. Dark mode — decision

**Ship BOTH from day one; light default; `auto` honors the OS.**
**DECIDED (Matt, 2026-08-05): ship both.** Rationale: the wake-up
loop (alert SMS → Today/Messages at night) is a core phone path — a white flash at
2am is hostile; and the Radix-derived scales make dark a token swap, not a redesign
(every dark pair proven §4). Implementation: `[data-theme]` attribute, no
per-component overrides allowed — if a component needs a special dark case, the token
is wrong, fix the token.

## 7. The three hard screens (desktop + 390px, one responsive file each)

1. [`screens/today.html`](screens/today.html) — the queue with five mixed item kinds,
   each with its one action; phone-first.
2. [`screens/messages.html`](screens/messages.html) — 3-pane desktop; 390px = thread
   with history above the fixed composer; quiet-hours state visible in the composer.
3. [`screens/oversight.html`](screens/oversight.html) — status board + alarm rows +
   the weekly cockpit + parked-sequence lane; the density stress test.

All sample data is FAKE and labeled (`SAMPLE DATA` in each file) — §0 applies to
consumer deliverables; these are internal design artifacts and still avoid fabricated
"real" figures.

## 8. Amnesia test (recorded 2026-08-05)

- Blacklist opened: NONE (no ui_kits, no CONSOLE_KIT, no components/admin, no current
  admin screenshots, no public brand files).
- Every foundation cites an external standard/product (Radix, WCAG/APG, GOV.UK,
  Carbon, Polaris, Linear, Stripe, Attio, Height, Superhuman, NN/g — §1–§6 inline).
- Every screen name and grouping traces to the locked IA (which traces to processes),
  not to any existing route.
- Could this exist if the current admin did not? Yes — nothing above references it.
- Deliberate non-inheritances: Geist (current admin font), navy/cream palette, shadcn
  component skins, the KPI-dashboard landing pattern.

## 9. Craft scorecard (self-assessed v1)

hierarchy 9 · color discipline 9 · type 8 · density 8 · a11y 9 (computed, not
claimed) · phone ergonomics 8 · consistency-under-stress 8 · restraint 9 →
**8.5 average, floor 8 met.** Weakest: density + phone ergonomics — both get re-scored
against the P8 timed litmus on a real device, which is the test that counts.

## 10. What this doc does NOT decide

Component implementation (P7 `components/admin/v2/`), URL slugs, per-destination
information architecture beyond the six patterns, icon set (P7; outline, 1.5px,
single family), and the token-gate exemption mechanics (P7 widens the gate).
