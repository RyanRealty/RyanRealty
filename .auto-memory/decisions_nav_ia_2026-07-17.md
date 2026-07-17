# Matt decisions — admin nav / IA (Pain #3 micro-batch, 2026-07-17)

Locked in docs/plans/ADMIN_REBUILD/01-DECISIONS-AND-RECONCILIATION.md §D9.

1. **Top-level IA = the locked 8 + Prospecting**: Home · Inbox · People ·
   Prospecting · Transactions · Performance · Content · Settings. Prospecting
   points at the live Expireds/FSBO dashboards until spec 07 builds its hub page.
2. **Superuser nav-item budget ≈35** — destinations plus capability-gated
   children dropdowns are allowed (no flat spoke-lists); deeper pages reachable
   via hub pages + ⌘K palette.
3. **Old-route policy: redirect-bridge everything.** A superseded legacy admin
   URL 30x-redirects to its canonical page, never 404s. Delete pass remains
   spec 11's.
4. **Mobile bottom tabs stay Home/Inbox/People/Deals/Activity** — annotated in
   the ONE nav config (lib/admin/nav.ts), not hardcoded in CrmMobileTabBar.

Context: answers given via the Pain-#3 micro-batch AskUserQuestion in the
admin-rebuild v3 session. All four were the recommended options.
