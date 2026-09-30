# Test with Matt's mail, never wait on him (Matt 2026-09-30)

Matt: "Do not wait on me to sign just use my emails to work through things and test."

- Test packets on the alias test deal (99001 Alias Test Loop) may go to matt@ryan-realty.com as
  well as the admin@ and marketing@ aliases. The agent works every side itself: finds the invite
  in the matt@ mailbox through the Gmail connector, follows its link, fills and signs, and checks
  the sealed copy lands. Never park a test on "waiting for Matt to sign".
- The aliases forward into the matt@ mailbox (admin@ is its own Workspace mailbox that forwards;
  a message arrives with X-Forwarded-For: admin@ matt@).
- Delivered is not inbox. Resend's `email_events` "delivered" only means Google accepted it.
  The Gmail connector cannot read Spam: `in:spam` returns nothing and a spam message id answers
  "The caller does not have permission". A mail missing from every other view is in Spam. A
  thread whose id is older than every message the connector shows has a hidden (spam) root.
- Found this way 2026-09-30: `Ryan Realty <noreply@mail.ryan-realty.com>` with a broker Reply-To
  lands in Spam; `"Matt Ryan · Ryan Realty" <matt@mail.ryan-realty.com>` lands in the inbox. All
  client mail goes out through `brokerSendIdentity` (gate `ci:broker-reply-sender`).
- Still outbound-to-real-people rules (CLAUDE.md §1): only matt@ and our own aliases, never a
  client, and never Matt's real (non-test) envelopes.
