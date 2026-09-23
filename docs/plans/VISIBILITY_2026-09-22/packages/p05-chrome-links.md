# p05-chrome-links

WIP branch: `claude/admiring-feynman-7lgwc3--wip-p05-chrome-links` (snapshot of the agent worktree). Original worktree: `.claude/worktrees/agent-acc9addf3f758dcf3`.

## Package spec (as given to the fix agent)

Read docs/plans/VISIBILITY_2026-09-22/FIX_BRIEF.md first and follow it exactly.

PACKAGE P5: site chrome and internal-link hygiene. Evidence: docs/plans/VISIBILITY_2026-09-22/evidence/findings/ux-live.json (UXLIVE-4, UXLIVE-8, UXLIVE-13) and docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/exposure.json (EXP-11).
1. Every header, mega-menu, mobile dialog and footer link that points at /homes-for-sale?view=list or ?view=map (noindex variants) points at the indexable /homes-for-sale instead; keep view as client state. Make sure /homes-for-sale defaults to list view.
2. 'Luxury homes in Bend' links /luxury-homes-bend, a 308. Link the destination directly (keep the redirect for inbound links).
3. /buy, /activity and /tools/appreciation are 200 + index,follow with zero internal links. Read docs/plans/PUBLIC_PRODUCT/SITE_PAGES.md: it folds /activity into /housing-market, routes /tools/appreciation to /invest and says /buy is not a third chrome. Do what the plan says for each where it is a link or canonical change; any 301 of an indexed URL needs the R-122 evidence (REQUIREMENTS.md:177), so if you cannot produce the GSC row for it, link the page from /site-index (so it is not an orphan) and list the redirect as a question with your recommendation.
4. Add a gate (scripts/check-chrome-links.mjs wired into scripts/ci-lanes.json and package.json ci:gates:chain like the other gates so ci:gates-wired passes): every chrome href is a clean path (no ?view=, no known redirect source from next.config.ts redirects or data/legacy-redirects.json).
5. UXLIVE-13: on mobile (375px) no route shows a tappable phone in the first screen; the header shows 'Sign in'. Check decisions.md, SITE_PAGES.md, lib/site/chrome-mega.ts and V3Chrome comments for a lock on the mobile bar. If none forbids it, show a phone tap target (tel:+15417033095, the brokerage line used in the desktop header) in the mobile bar and move Sign in into the menu; if a lock exists, leave it and report the question.
Files: lib/site-nav.ts, lib/site/chrome-mega.ts, components/site/v3/V3Chrome*.tsx/css, components/site/v3/V3Footer*, app/site-index/**, app/search/page.tsx (view default only), new gate, tests. Keep ci:chrome-single-source, ci:one-design-system and ci:dog-floater green.
