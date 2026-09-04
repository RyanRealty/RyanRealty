# End-to-end — remaining public UX (2026-09-04)

## Goal

A visitor on ryan-realty.com can:

1. Use the living atlas on Tetherow at 1440×900 without scrolling to find zoom.
2. Tap public footer/consent/proof controls at 44×44 CSS px, including at 1440.
3. Open a listing and see the remainder class: ask instrument, living map, doors, similar strip, broker bar on a phone.
4. Open every Central Oregon golf course page. Sourced hole geometry draws. Absence is named after two query shapes, never a guessed routing.

## Result

| Track | Outcome |
|---|---|
| A Zoom | **Done on production.** Tetherow 1440×900: zoom buttons top 543–677, all inside 900. Commit `c649458c`. |
| B Footer G71 | **Shipped locally** `b468cb52`. 1440 shrink revoked. |
| C Golf | **Second hunt. None of five ship.** `6f6fc453`. Fazio card exists; OSM has no second cluster. |
| D Listing remainder | **Done on production.** 61475 Meeks Trail: ask, atlas, doors, similar, Tour/Call at 375. |

Shots: `docs/plans/endtoend-remaining-ux/`.
