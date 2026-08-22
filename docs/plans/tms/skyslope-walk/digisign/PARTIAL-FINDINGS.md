# DigiSign walk — findings for Chief of Staff (2026-08-22)

Look-only. No mutations. No live send.

## Current blocker (this morning)
Matt signed in once; session is **not reusable** on this Chrome profile:
- `app.skyslope.com` → `auth.skyslope.com/identity/connect/authorize` → **HTTP 400 Bad Request - Request Too Long** (oversized headers/cookies). Shots: `40-01`, `40-03`.
- `send.skyslope.com/envelopes` → `skyslope.com/digisign-login/` (matt@ prefilled). Shot: `40-02`.
- `forms.skyslope.com` → `skyslope.com/forms-login/`. Shot: `40-04`.
Per CoS: **did not request another login.** Role picker still **NOT SEEN** live.

---

## What we DID capture earlier (live Matt Ryan DigiSign session)

### Surface
- DigiSign = `https://send.skyslope.com/envelopes`
- Nav: Envelopes | Templates | Apps | Matt Ryan
- Tabs + counts seen: **All 520 · Completed 334 · Sent 59 · Draft 127**
- Columns: Envelope Name · Recipients (count) · Status (+ progress) · Updated/Completed/Sent/Created · More ⋮
- Primary CTA: **New Envelope** (chevron dropdown — options not opened)

### Status / send loop (seen)
| Tab | What status looks like |
|---|---|
| Completed | green "Completed" + full bar; date column = Completed |
| Sent | "Signed by X of Y" (partial bar); "Sent N ago"; "Canceled" (red) |
| Draft | "Draft" + empty gray bar; Created date |

In-progress More menu (seen, not clicked): **Remind · Cancel · Correct**
Completed More menu (seen): **Edit Envelope Name · Download Envelope · Download Certificate · View History**

### Audit trail (seen — envelope history)
URL: `send.skyslope.com/envelopes/{id}/history`
Events observed (3480 SW 45th / Repair Addendum class):
1. Viewed by {signer}
2. Adopted electronic signature
3. Agreed to ESIGN Consumer Disclosure and Consent
4. Signed by {signer}
5. Envelope Completed
6. Envelope Completed email sent to each party + Matthew Ryan
7. Later: Envelope Downloaded by Matthew Ryan (principal check-off)

### Seal / document return (seen)
- Completed overlay: Download / Print
- Sealed PDF shows placed: **signature**, **print name (text)**, **Date/Time stamp**, **checkbox**
- Extra empty Buyer signature slots on form (multi-buyer layout)
- **Strike** and full composer palette: **NOT SEEN without compose**
- **Initials** as a discrete DigiSign block: **NOT SEEN** on that sealed page (may exist in composer)

### Recipients / roles (seen only partially)
- Recipient **count** on index (e.g. 3, 4)
- Per-recipient progress: "Signed by 3 of 4"
- History names: Charise Millard, Doug Millard, Jeanette Argyle, Matthew Ryan, Casey Pierson (Buyer on sealed addendum)
- **Role picker dropdown: NOT SEEN** — cannot confirm Transaction coordinator / Buyer / Seller / Buyer's agent / Seller's agent / Lender / Appraiser / Inspector from DigiSign UI yet

### Files into envelope / Suite return
- Forms-file path vs Suite Documents → DigiSign vs upload: **NOT SEEN** this walk
- What Suite receives after seal: **NOT SEEN** (only DigiSign completed emails + Download Envelope/Certificate)

---

## Product bar (locked from CoS)
One Vault. Brokers prepare a form and send. Matt verifies after. No broker logging.
DigiSign job = **send + status + seal + what Matt checks off today**.

Matt check-off today (from DigiSign UI we saw):
1. Watch Sent → "Signed by X of Y"
2. On Completed → Download Envelope + Download Certificate + View History
3. Confirm ESIGN consent + each signer + Completed emails in history
4. Download sealed PDF (principal stamp happens in Vault sign-off separately)

---

## Our Vault `/admin/signing` (code, parked from nav) — for parity later
From `lib/tc/signing.ts` RECIPIENT_ROLES labels:
Buyer · Buyer (2nd) · Seller · Seller (2nd) · Listing broker · Buyer's broker · Escrow officer · Title · Lender · Other party · CC (copy only)

**Not in our list today:** Transaction coordinator, Appraiser, Inspector (as signing roles).
**Statuses we have:** draft · sent · partially_signed · completed · voided
**Field types we have:** signature · initials · date_signed · text · checkbox — **no strike**
**Missing vs DigiSign ops UI (from this walk):** Remind / Cancel / Correct as named actions; Download Certificate as a first-class More action; "Signed by X of Y" progress wording (we have partially_signed).

---

## Unblock needed (for CoS / Matt — not requesting login ourselves)
Suite auth 400 "Request Too Long" + DigiSign/Forms marketing login walls = cookie/session rot on this Chrome profile. Someone with Matt's session must refresh auth (clear auth.skyslope.com cookies then sign in once, or open DigiSign from a still-warm Mac Mini session). Then resume: Draft → Add Recipient → full role list + New Envelope file sources + Correct/second pass.
