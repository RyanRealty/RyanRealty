# Admin help articles

This folder is the content source for the admin knowledge base at `/admin/help`.

## Why repo markdown instead of a database

Help content lives here as markdown files, versioned with the code, on purpose:

1. **Help ships in the same commit as the feature.** When a page changes, the article describing it changes in the same PR. A database store drifts silently because nothing forces the content to move with the code.
2. **Review and history for free.** Git diff shows exactly what a help edit changed and when, next to the code change that motivated it.
3. **No runtime dependency.** The loader (`lib/admin-help.ts`) reads the filesystem at render time. No table, no migration, no admin editor to build and secure.

## File format

Each article is one `.md` file with frontmatter:

```
---
title: Set up a listing alert for a client
area: CRM
routes:
  - /admin/crm/subscriptions
  - /admin/console/leads
summary: One sentence shown in lists and search results.
---

Body in markdown. Numbered steps, plain English, brand voice.
```

- `title` — sentence case, task-oriented ("Do the thing", not "The thing page").
- `area` — one of the admin nav groups: Dashboard, CRM, Deals, Reports, Admin.
- `routes` — admin pathnames where the Help button should suggest this article. Prefix matching: `/admin/console/leads` matches every person page.
- `summary` — one plain sentence, used by list, search, and the Help button.

## Voice rules

Written for a broker, not an engineer. Plain English, numbered steps, no jargon, no em-dashes, no semicolons, no exclamation marks, sentence case headings. Never reference internal table or function names in the body.
