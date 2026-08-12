# P8 LITMUS — the two timed spans (measured 2026-08-11)

A timing you did not measure this session is not a timing. Everything below was measured
in a real browser at **390 x 844** against **production** (ryan-realty.com), not the dev
server, whose compile times make any number meaningless.

**Neither span was driven through its final submit.** Submitting would create a real CRM
lead and a real `listing_alerts` row in production. Both are measured to the moment the
submit control is ready with the visitor's data entered, and that boundary is stated in
every number below.

## L1 — cold mobile visitor to a valuation request ready to send

Path: `/sell` (the one locked spine, `#get-value`).

| Measure | Production today |
|---|---|
| Time to first byte | 14 ms |
| DOM interactive | 1,219 ms |
| Load complete | 4,032 ms |
| Scrolls to reach the first field | 1 (field sits 500px down, viewport 844px) |
| Fields before submit is armed | 1 (address) |
| Taps from arrival to armed submit | 2 (tap field, tap submit) plus typing |
| Time from arrival to step 1 filled | 3 ms of interaction after load |
| Page height at 390 | 23,515 px |

**Read:** the ask is above the fold in one scroll and the form is a single field, which is
the strong part. The weak part is 4.0 s to load complete and a 23,515 px page under a
form that only needs a few hundred pixels.

## L2 — cold visitor to a saved search ready to send

Path: `/homes-for-sale`.

| Measure | Production today |
|---|---|
| Time to first byte | 14 ms |
| DOM interactive | 435 ms |
| Load complete | 3,243 ms |
| Taps from arrival to the capture visible | 1 ("Save this search") |
| Time from that tap to the email field visible | 924 ms |
| Fields before submit is armed | 1 (email) |

**Read:** the save path is one tap to capture, which is right. The 924 ms between the tap
and a usable field is the whole cost, and it is client work, not network.

## What these numbers are for

They are the floor. The P9 rollout may not regress either span, and the barrel-built
surfaces should improve both: the Sheet primitive renders one question at a time with no
client bundle beyond its own step state, and the Instrument answers above the fold so the
page does not need 23,000 px under it.

## Proposed targets for Matt's litmus sign-off

- **L1:** load complete under 2.5 s at 390, the ask reachable with no scroll, still 2 taps.
- **L2:** email field usable within 300 ms of the tap, still 1 tap to capture.

Both are proposals from the measured baseline, not commitments. Matt sets the numbers.

## Re-prove rule

Re-time both spans after any change to a path they touch, on production, at 390. Record
the date and the numbers here, and never carry a number forward without re-measuring it.
