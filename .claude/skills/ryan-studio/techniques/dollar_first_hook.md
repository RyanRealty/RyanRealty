# Dollar/number-first hook

Category: hook

Ready: implemented in `lib/studio/timeline/hooks.ts` (`dollarFirstWindow`), planned by `lib/studio/timeline/plan.ts`, held by `lib/studio/timeline/hooks.test.ts`.

Source: r5-meta-ad-library hook pattern #3

## Recipe
The film opens on a concrete, sourced figure (a dollar amount or a rate). The hook beat's FIRST card is a number card bound to a brief.numbers row with its full citation. It starts at 0.1 s and its eased reveal lands at 0.5 s, fully on screen by 1.0 s (inside a buyer ad's 1.5 s hook limit). It holds at least 2.5 s. The renderer proves it from the page: the figure must be drawn at 1.0 s, or the technique is not recorded.

## Use
List `dollar_first_hook` in brief.techniques; make the hook beat's first card `{ "kind": "number", "number": "<key>" }`. Mandatory spec_rules still apply.
