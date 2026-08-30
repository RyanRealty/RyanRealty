# Bulk email: signature + from-line (end-to-end goal)

Date: 2026-08-29
Surface: `/admin/crm` Batch Email (people list) and `/admin/email/compose` cohort send
Production: ryan-realty.com after `npm run push` + deploy verify

## What exists when this is done

A broker writing a batch email (the River West 2,714-person case) can:

1. See their saved Gmail-matched signature in **Preview, what sends**. The preview is the same HTML composition the wire uses (`composeOutboundHtml`).
2. Leave **Include your Gmail signature** on by default. Unchecking it drops the signature from preview, the test copy, and the real send.
3. Press **Send one to me first** and receive a copy that includes that signature, the same From line, and the same Reply-To as the cohort.
4. Pick who the mail appears to be from:
   - Default: named identity on the verified send domain (`"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>`), **Reply-To the real mailbox** (`matt@ryan-realty.com`). This is the volume-safe path for a list of thousands. Replies reach Matt, not `noreply`.
   - Option: send from the broker's real mailbox via Gmail (`matt@ryan-realty.com`). The UI says Gmail caps around 2,000 a day so a 2,714-person list should stay on the named from-line.

No silent `noreply@` From on a lead-facing cohort. The worker defaults the named identity + Reply-To + signature-on even if an older enqueue omitted the new fields.

## What a real user does

Open `/admin/crm?view=39` (or any saved view) → Batch Email → write a subject and body → Preview shows body + Gmail signature → Send one to me first → inbox matches preview (signature present, From is named, Reply-To is matt@) → Run the list.

Do **not** fire the 2,714-person send as part of verification. The test copy to the signed-in broker is the live proof.

## Verified 2026-08-29 (local `/admin/crm?view=39`)

- Dialog shows **Include your Gmail signature** on by default, **Send as Matt Ryan · Ryan Realty** (replies to matt@), and the mailbox option.
- Preview after the signature loads shows the Gmail headshot block.
- **Send one to me first** returned `Sent to matt@ryan-realty.com, merged against mattmryan2@gmail.com`.
- Live inbox copy `1a04f53de811bacd`:
  - From: `"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>`
  - Reply-To: `matt@ryan-realty.com`
  - Body includes the Gmail signature.

Do not press Run on the 2,714-person list as part of this job.

## Bar

- Signature source: `buildSignature` / `getSignatureForMailbox` (Gmail HTML first, then custom, then generated, plus the Oregon pamphlet line). Same helper the 1:1 composer already uses.
- Preview, test send, and cohort send share `composeOutboundHtml`.
- From/Reply-To come from `brokerSendIdentity`, never from a client-supplied address string.
- Gmail mailbox send is an explicit option, not the default, because Workspace will not send a 2,714-person list in one day.
- Admin v2 primitives only. No em dash, no semicolon in new UI copy.
- Tests through the public send helpers. Browser walk of the live dialog. Then production.
