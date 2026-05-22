# Matt Ryan, FUB workflow runbook

Last updated: 2026-05-21

This is your day-to-day operating manual for the new FUB lead system. Bookmark it. Open it the first week, then drop it when the rhythm is automatic.

## What changed

Five lead categories now flow into FUB on their own. Each category has a dedicated action plan that runs the cadence after you do the first manual touch.

| Category | Source | FUB plan |
|---|---|---|
| Expired, canceled, withdrawn listings | Hourly cron, Spark MLS feed | Plan 71 |
| FSBO listings | Hourly cron, Apify Zillow scrape | Plan 72 |
| Out-of-state owners | Manual list import + DIAL lookup | Plan 73 |
| Bend resident sellers | LP form on ryan-realty.com | Plan 69 |
| Buyer leads | FB lead ad and LP form | Plan 74, 75 |

Plans 69 through 75 are wired with your voice. Touch 0 is yours (manual SMS), the rest is auto.

## Your daily rhythm

### Morning, 5 to 10 minutes

1. Open FUB
2. Inbox tab. Any reply that came in overnight is here. The pause-on-reply cron ran at midnight Pacific, so the action plan is already paused on those leads. You handle the conversation from here.
3. People > Smart Lists > "Expired No Contact". Any expired listings detected since yesterday are at the top.
4. People > Smart Lists > "FSBO". Same for FSBOs.
5. People > Collections > "FUB Revamp" with the "Only Me" toggle on. The "Hot/Weekly" and "Warm/Bi-Weekly" lists show your A and B stage assignments.

### When you open a new expired or FSBO

1. Read the card. Name, address, list price, days on market, original list, last status change.
2. Click the address link to view listing photos and history.
3. Open the SMS box. Pick the template:
   - Expired: template id 77 ("Expired - T0 - Manual SMS")
   - FSBO: template "FSBO - T0 - Manual SMS"
4. The address auto-fills from `%customSellerPropertyAddress%`. Edit if anything reads off.
5. Send the SMS.
6. **Change the lead's stage from "Lead" to "A - Hot 1-3 Months".** This is the trigger.
7. Automation 2.0 fires on that stage change, checks the intent tag, and enrolls the lead in the right plan.
8. Move to the next lead.

That is the entire manual surface. One template send, one stage change.

### What runs after you enroll

| Day | Touch | Source |
|---|---|---|
| 0 | Your manual SMS | You |
| 2 | Email 1 | Plan auto-send |
| 8 | Email 2 | Plan auto-send |
| 14 | Email 3 | Plan auto-send |
| 30 | Email 4 with market snapshot | Plan auto-send |
| 60 | Email 5 | Plan auto-send |
| 90 | Email 6 | Plan auto-send |
| 180 | Re-engagement | Cron, not yet built |

If the lead replies, the pause-on-reply cron tags them within 15 minutes and pauses the plan. You take the conversation from there.

## What you'll get via email

| Time | Email | Contents |
|---|---|---|
| Daily 8am Pacific | Daily broker digest | New leads assigned to you, overdue tasks, top 3 hot leads, replies overnight |
| Mon 8am Pacific | Weekly pipeline digest | Pipeline by stage, conversion velocity, leads to escalate, week over week delta |

Both come from notifications@ryan-realty.com via Resend.

## Smart lists you'll use

Your **FUB Revamp** collection was streamlined to 4 daily-focus lists. Everything else moved out to the standalone Smart Lists section (still accessible, just not in your daily view).

### FUB Revamp collection (your daily focus, 4 lists)

| List | What it shows | Daily rhythm |
|---|---|---|
| Active & Pending Clients | Clients actively transacting | First thing every morning |
| Hot/Weekly | Stage A (hot leads, actively working) | Multiple times per day |
| Warm/Bi-Weekly | Stage B (medium engagement) | Twice a week |
| Past Clients & Sphere | Quarterly touch list | Once a week |

### Standalone Smart Lists (work flow specific)

| List | When to check |
|---|---|
| Expired No Contact | Morning, after the cron alert email |
| FSBO | Morning, after the cron alert email |
| Absentee Owners | Weekly farming |
| Matts Sphere | Weekly |
| New Leads: No Call Attempt | When you want a broader new-lead sweep |
| Cold/Bi-Monthly | Bi-monthly touch campaign |
| Old Leads (No Call Attempt / Not Reached Monthly) | Quarterly re-engagement campaign |
| Inbox tab | First thing every morning, replies live here |

Resort and neighborhood smart lists for Caldera Springs, Crosswater, Vandevert Ranch, Tetherow, Awbrey Glen, and the rest are at smart list ids 67 through 92. Use these for targeted campaigns.

## Per-broker URL attribution

Every social bio, ad campaign, and email signature URL has agent attribution baked in.

| Person | Slugs | Example URL |
|---|---|---|
| Matt | matt-ryan, matt | ryan-realty.com/?agent=matt-ryan |
| Paul | paul-stevenson, paul | ryan-realty.com/?agent=paul-stevenson |
| Rebecca | rebecca-peterson, rebecca | ryan-realty.com/?agent=rebecca-peterson |

The site sets a 90-day cookie. Any LP submission while the cookie is set routes the lead to the right broker, overriding default routing.

Without a cookie, leads route to you by default per the 2026-05-17 directive.

## Open architecture decisions

Two items still need your call.

### 1. Trigger pattern

FUB Automations 2.0 has no "Tag Removed" trigger. Three options:

- **Option A (in use): Stage Change.** You move stage from Lead to A - Hot 1-3 Months. Automation fires. Clean.
- **Option B: Tag Added.** You add a per-plan enroll tag. Works but adds tag clutter.
- **Option C: Audience tag with NOT-In filter.** Reuse audience tags, exclude holding state. Pending verification that 2.0 supports NOT-In.

The docs assume A. If you want B or C, one line changes per broker doc.

### 2. Conflicting existing 2.0 automations

Your account has 37 user-created 2.0 automations. Some overlap with the new plans.

| Existing automation | Status | Conflict |
|---|---|---|
| Ryan Realty - Expired Spring Strategy | ON, 10 steps | Conflicts with Plan 71 |
| Ryan Realty - Remote Home Owner | OFF, 19 steps | Superseded by Plan 73 |
| Ryan Realty - New Seller | ON, 59 steps | Overlaps Plan 69 |
| Multiple *KTS AP Nurture * singletons | ON | May dual-fire |

I can archive these once you confirm.

## Quick reference

- Your direct: 541.213.6706
- Bio phone, FUB-tracked: 541.703.3095
- Notifications: notifications@ryan-realty.com
- Website: ryan-realty.com
- FUB: ryanrealty.followupboss.com

## Crons running in the background

| Cron | Cadence | What it does |
|---|---|---|
| detect-expired-listings | Hourly | New expireds become FUB people, tag, alert you |
| detect-fsbo-listings | Hourly at :20 | Same for FSBOs |
| seller-workflow-pause | Every 15 min | Tags repliers, pauses plans |
| daily-broker-digest | 8am Pacific daily | Your daily email |
| weekly-pipeline-digest | Mon 8am Pacific | Your weekly pipeline email |

All run on Vercel. Logs at vercel.com/ryanrealty.

## What not to do

- Do not bulk-send action plan touches by hand. The plan handles it after you do the stage change.
- Do not delete a lead in FUB to clean up the list. Mark them Unsubscribed instead.
- Do not skip the stage change. Without it, the plan never enrolls and the lead sits in the smart list forever.
- Do not edit a plan step in FUB without telling me. Plan content lives in `out/fub-optimization/PLANS_CONTENT.md` and we keep that as the source of truth.
