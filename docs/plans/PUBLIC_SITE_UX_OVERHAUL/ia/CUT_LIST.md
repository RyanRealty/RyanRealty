# Cut / redirect list (draft)

Only cut when a superior hub absorbs the job. Always 301 for public URLs with equity.

| Route pattern | Disposition | Absorbed by |
|---|---|---|
| `/search`, `/search/*` | already 301 → `/homes-for-sale` | Buy search |
| `/listings`, `/properties` | already redirects | Buy search |
| Thin duplicate market calculators if redundant | redirect | `/tools/*` or Market hub |
| Orphan marketing experiments with no traffic | cut after GSC check | — |
| `/buy` | **keep** as service gateway OR soft-redirect to search with modules | Buy journey |
| Account routes | keep (product) | Account IA later |
| Legal | keep | legal-minimal |

Final cuts require GSC + first-party traffic check before delete.
