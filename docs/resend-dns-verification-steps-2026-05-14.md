# Resend Domain Verification — DNS Records to Add

**Goal:** verify `mail.ryan-realty.com` (or `send.ryan-realty.com` — whichever subdomain Resend recommended) on Resend so the production email scripts (`lib/resend.ts`) start working again.

**Current state:** `noreply@mail.ryan-realty.com` is the default sender in `lib/resend.ts`. Send attempts return `403 — domain not verified`.

## Where DNS is hosted

Cloudflare (NS records point to `jeff.ns.cloudflare.com` + `eva.ns.cloudflare.com`).

## Standard Resend DNS records for a subdomain

When you click "Add Domain" → `mail.ryan-realty.com` (or `send.ryan-realty.com`) in the Resend dashboard, Resend will show you four records to add. They're region-specific (us-east-1 vs eu-west-1 etc.); the values below are the standard us-east-1 layout — **use the exact values Resend shows you, not these placeholders.**

| Type | Host | Value | Priority |
|---|---|---|---|
| MX | `send` (or `mail`) | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send` (or `mail`) | `v=spf1 include:amazonses.com ~all` | — |
| TXT | `resend._domainkey` (or the specific selector Resend shows) | (long DKIM public key — copy verbatim from Resend) | — |
| TXT | `_dmarc` (optional but recommended) | `v=DMARC1; p=none;` | — |

## How to add these in Cloudflare

1. Log in at `https://dash.cloudflare.com/`
2. Click the `ryan-realty.com` zone
3. Go to **DNS** in the left nav
4. Click **Add record** for each row above
5. For the host, enter the subdomain piece only (e.g. `send` — Cloudflare appends `.ryan-realty.com` automatically). For the host `resend._domainkey`, enter exactly that string (with the dot).
6. For the MX record, set priority 10
7. **Disable proxying** on each record (orange cloud → grey cloud). Resend needs unproxied DNS to verify.
8. Click **Save**

## Verify in Resend

1. Back in Resend dashboard → Domains
2. Click **Verify DNS records** on the domain
3. All four records should turn green within ~5 minutes (Cloudflare propagation is fast)

## After verification

Test the production sender:

```
node --env-file=.env.local scripts/seo-send-agentfire-support-ticket.mjs
```

Should send successfully. (If still failing, restart any long-running Node processes that cached the old DNS lookup.)

---

## Optional: automated via Cloudflare API (for future)

If you want this scripted next time, generate a Cloudflare API token at `https://dash.cloudflare.com/profile/api-tokens` with:
- Zone:DNS:Edit
- Zone Resources:Include:Specific zone:ryan-realty.com

Then add to `.env.local`:
```
CLOUDFLARE_API_TOKEN=<token>
CLOUDFLARE_ZONE_ID=<zone id from the zone settings page>
```

A script can then add the records via:
```
POST https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records
Authorization: Bearer {token}
```

Not built today — only needed if you want to re-verify domains programmatically (e.g., setting up new sender subdomains for different products).
