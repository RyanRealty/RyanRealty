# Rebecca Peterson, FUB workflow runbook

Last updated: 2026-05-21

This is your operating manual for the FUB system Matt built out this week. Short read, bookmark it, drop it once the rhythm is second nature.

## What's new

Five lead categories now flow into FUB on their own. After the first manual touch, an action plan runs the cadence for you.

Most leads land on Matt by default. You'll see leads when:
1. A lead clicks an ad or social bio link with your attribution (URL slug `rebecca-peterson` or `rebecca`)
2. Matt assigns you a lead directly
3. A lead from your sphere comes in through any path

When a lead lands on you, the workflow below is what you do.

## Your daily rhythm

### Morning, 5 minutes

1. Open FUB
2. Inbox tab. Overnight replies are here. The pause-on-reply cron already paused the action plan on these, so you respond personally from this point.
3. People > Collections > "Pipeline" with the "Only Me" toggle on. Hot/Weekly and Warm/Bi-Weekly show your Stage A and B assignments.
4. People > Smart Lists > "New Leads: No Call Attempt" with the top-right "Only Me" filter on. Anything assigned to you in last 14 days.

### When a new lead lands on you

1. Read the card. Name, source, address if seller, list price, days on market.
2. Send the first SMS using the matching template:
   - Expired seller: template id 77 ("Expired - T0 - Manual SMS")
   - FSBO seller: template "FSBO - T0 - Manual SMS"
   - Buyer from LP: template "Buyer - T0 - Manual SMS"
3. **Change the stage from "Lead" to "A - Hot 1-3 Months".** That stage change triggers the action plan to enroll the lead.
4. Move on.

That is the whole manual step. One SMS, one stage change.

### What runs after you enroll

For sellers (expired, FSBO, out-of-state, Bend resident):

| Day | Touch |
|---|---|
| 0 | Your manual SMS |
| 2 | Plan email 1 |
| 8 | Plan email 2 |
| 14 | Plan email 3 |
| 30 | Plan email 4 with market snapshot |
| 60 | Plan email 5 |
| 90 | Plan email 6 |

For buyers (Plans 74, 75): similar 6-touch cadence over 90 days.

If the lead replies, the cron tags them within 15 minutes and pauses the plan. You handle the conversation from there as normal.

## What you'll get via email

| Time | Email | Contents |
|---|---|---|
| Daily 8am Pacific | Daily broker digest | Your new lead assignments, overdue tasks, top 3 hot leads, replies overnight |

From notifications@ryan-realty.com.

## Your attribution URL

Use this in your social bios, ads, email signature, business card QR code.

```
ryan-realty.com/?agent=rebecca-peterson
```

Or short form:

```
ryan-realty.com/?agent=rebecca
```

The site sets a 90-day cookie. Any LP form submission while the cookie is set routes that lead to you. Without the cookie, leads default to Matt.

## Smart lists you'll use

| Smart list / collection | What it shows |
|---|---|
| Collection: Pipeline + Only Me | Hot/Weekly, Warm/Bi-Weekly, Cold/Bi-Monthly filtered to your assignments |
| New Leads: No Call Attempt | New leads in last 14 days, use Only Me to scope to you |
| Inbox tab | Replies on threads you own |

The neighborhood smart lists (Caldera Springs, Crosswater, Vandevert Ranch, Tetherow, and the rest) are shared across the team at smart list ids 67 through 92.

## Quick reference

- Your FUB inbox: ryanrealty.followupboss.com
- Matt direct: 541.213.6706
- Brokerage notifications: notifications@ryan-realty.com
- Website: ryan-realty.com

## What not to do

- Do not skip the stage change. Without it, the lead sits in the smart list and no plan runs.
- Do not bulk-send the plan touches manually. The plan handles them.
- Do not delete a lead to clean up. Mark Unsubscribed instead.
- If the SMS template merge field looks wrong on a specific lead, tell Matt before sending.
