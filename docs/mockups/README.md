# Retired mockup kits (not served)

Moved out of `public/mockup-preview/ui_kits/` on 2026-10-08 (SEO & AEO Desk
/about brief, founding-date fix item 3).

`about-kit-stale.html` and `team-kit-stale.html` were early design mockups that
the live site served as static files under `/mockup-preview/`. Their copy is
placeholder, not fact: "Founded in 2023", "est. 2023", a deal count, a broker
name and license years that are not Ryan Realty's record. robots.txt disallows
`/mockup-preview/`, but a disallowed URL can still be indexed from links, and a
crawler that obeys the disallow never sees a noindex header. Moving the files
out of `public/` makes those URLs 404 instead.

Nothing in the app, the gates, or the design-system parity files reads these
two files. Do not copy facts from them. Firm facts live in `lib/brand/contact.ts`
and AGENTS.md "Firm facts": founded 2014, Bend office opened June 2023.
