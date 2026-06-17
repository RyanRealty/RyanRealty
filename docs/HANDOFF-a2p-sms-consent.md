# HANDOFF — A2P 10DLC / SMS consent surface (DO NOT BREAK)

**Status as of 2026-06-17.** Ryan Realty's Twilio A2P 10DLC campaign is how the
CRM sends client/lead texts. Carriers vet the campaign against the **live
website** and re-crawl it. If the consent language or links below change, the
campaign gets rejected or suspended and **all outbound SMS stops** (error
30034). This doc + the gate `ci:sms-consent` exist so that never happens by
accident.

## The hard rules (mechanically enforced by `ci:sms-consent`)

`scripts/check-sms-consent-compliance.mjs` runs in `ci:gates` and fails the
build if any of these regress:

1. **`components/site/SmsConsentDisclosure.tsx`** must keep:
   - The EXACT carrier-verified sentence (do not reword, even slightly):
     > By submitting, you agree to receive calls and texts from Ryan Realty about your request. Message frequency varies. Msg & data rates may apply. Reply STOP to opt out, HELP for help.
   - A link to **`/privacy`** AND a link to **`/terms`** (A2P error 30917
     requires both in the disclosure).
   - This is the ONE shared component every lead form renders. All six forms
     (`/contact`, `/sell/valuation` via `home-valuation`, `/lp/seller-home-value`,
     `/lp/buyer-listing-alerts`, `/lp/expired-listing`, `/lp/fsbo`) import it —
     fix it here, never inline a one-off disclosure.
2. **`app/privacy/page.tsx`** must keep its "SMS and text messaging" section
   with: message-frequency language, STOP opt-out language, and the
   carrier-mandatory clause **"No mobile information will be shared with third
   parties or affiliates for marketing or promotional purposes."**

Compliance language is exempt from brand-voice styling (per CLAUDE.md). Do not
"clean it up."

## If you genuinely must change consent wording or opt-in flow

You cannot just edit and ship — the live site and the Twilio submission must
stay in lockstep:

1. Update `SMS_CONSENT_TEXT` / the component AND the `EXACT` constant in the gate.
2. Update the Twilio A2P campaign's `message_flow` + message samples to match
   (Console → Messaging → Regulatory Compliance → A2P 10DLC, or the API:
   `…/Services/MG592bf50afb3f10e6f1078995dae496e4/Compliance/Usa2p`).
3. Re-submit the campaign for vetting and confirm it returns to VERIFIED before
   relying on SMS again.

## Related guardrails (separate incident, same area)

- `ci:crm-sms-safety` (`scripts/check-crm-sms-channel-safety.mjs`) — lead SMS
  must NEVER route through a personal iMessage; `contact:do-not-call` suppresses
  SMS (TCPA). See `reference_crm_sms_imessage_incident` memory.

## Campaign facts (for whoever picks this up)

- Account SID: `TWILIO_ACCOUNT_SID` in `.env.local` (starts `AC…`, ends `…fbdc`)
- Messaging Service: `MG592bf50afb3f10e6f1078995dae496e4`
- Brand: `BN61648992c339cc6edf8332ad615fc575` (approved)
- Campaign `CMb1d8153a2afc36416efae44c196c7d46` — **FAILED** 2026-06-16, errors:
  - **30882** (TERMS_AND_CONDITIONS) — reviewer read "leads" as third-party
    lead-gen. Fix = description states we text only people who contacted us
    directly; no purchased/shared lists. Twilio says this code needs a new
    campaign, but they invited an appeal since we are genuinely compliant.
  - **30917** (MESSAGE_FLOW) — opt-in described two methods, one underdescribed.
    Fix = describe a single website opt-in fully (location URL, what the user
    sees, the submit action) + privacy + terms links.
- Live proof URLs (all carry the disclosure + links): `/contact`,
  `/sell/valuation`, `/lp/seller-home-value`, `/lp/buyer-listing-alerts`,
  `/lp/expired-listing`. Privacy: `/privacy`. Terms: `/terms`.
- Quick status check:
  `curl -s -u $SID:$TOK …/Services/$MSID/Compliance/Usa2p` → `campaign_status`.
- Outbound stays blocked (30034) until `campaign_status` = `VERIFIED`. Inbound
  is unaffected and already works.
