# Pass 2 runbook, add canonical exclusions to 10 smart lists

**For Matt to grind through directly in FUB UI.** Total time: ~10 minutes.

## What you're doing

Adding three exclusion tags to ten smart lists so that no Realtors, no out-of-market agents, and no compliance hard-stops end up in your farming touches.

The three tags to exclude on every list:

- `Realtor`
- `migration broker`
- `compliance:hard-stop`

## The 10 lists, in priority order

| # | List | Count | Why it matters |
|---|---|---|---|
| 1 | Old Leads: No Call Attempt | 9,912 | Biggest risk. Currently has zero tag exclusions. |
| 2 | Absentee Owners | 938 | High-value out-of-state farming list. |
| 3 | Absentee Owners No Contact | 591 | First-touch absentee list. |
| 4 | All Expireds | 641 | All expired listings, broad. |
| 5 | Expired No Contact | 138 | Daily-touch expireds. |
| 6 | Old Bend - Farm | 120 | Bend farming list. |
| 7 | Cold/Bi-Monthly | 46 | Cold stage outreach. |
| 8 | FSBO | 16 | FSBO touches. |
| 9 | Vandevert | 21 | Neighborhood farming. |
| 10 | Crosswater | 66 | Neighborhood farming. |

## The click pattern, same for every list

1. Click the list in your left sidebar under SMART LISTS.
2. On the right side, look at the Filter panel. You'll see existing filters.
3. **If you see a "Tags exclude any of:" filter row**, click the small chevron arrow at the right end of that row to expand it. You'll see pills of existing excluded tags.
4. **If no such filter exists**, click in the "Add a filter" search box at the top of the panel, type "tag", and pick the filter that lets you exclude tags. Set its mode to "exclude any".
5. Click the small "+" button next to the last pill (or in the empty pill area). A search box opens.
6. Type `Realtor`. Click the `Realtor` suggestion (the exact one, not `industry:realtor` or `Denver realtor`).
7. Click "+" again. Type `migration`. Click the `migration broker` suggestion.
8. Click "+" again. Type `compliance`. Click the `compliance:hard-stop` suggestion.
9. **Click "Update List" at the top right.** This is the save action. Without this, your changes are lost.
10. Move to the next list.

## What to check after each save

The count under "Showing X people" should drop slightly (or stay the same for tiny lists). The filter pills should show your three new tags. If you click away and come back, the tags should still be there.

## Done already this session

- Monthly Newsletter (7,257 -> 7,249), added migration broker + compliance:hard-stop on top of existing Bounced + Unsubscribed + Realtor.
- All Recent Online Activity (137), added Realtor + migration broker + compliance:hard-stop on top of existing Unsubscribed + NOTEXT + do_not_text.

## What happens after Pass 2 is done

Pass 3 is the neighborhood-list dedup. We compare my polygon-driven lists vs your manually-curated ones. You'll decide per pair. That's a separate session.

The Automations 2.0 architecture decision (Option 1, cron applies plan / Option 2, manual / Option 3, rebuild in 2.0) is also still waiting on your pick. The recommendation is Option 1.
