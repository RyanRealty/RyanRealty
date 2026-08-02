/**
 * ci-probe-ua.mjs — the one User-Agent every CI health probe sends.
 *
 * WHY (2026-08-02): `middleware.ts` screens page routes and returns 403 for
 * automation User-Agents (`BAD_BOT_RE`) and for an empty User-Agent. That screen
 * is correct and stays — it keeps GA4 clean and turns away scrapers.
 *
 * It also silently ate CI for three months. The "Route smoke test" step used
 * `start-server-and-test`, whose waiter is `wait-on`, which is built on axios,
 * which sends `User-Agent: axios/1.x`. `BAD_BOT_RE` matches `axios`. Every probe
 * came back 403, `wait-on` only accepts 2xx, so it retried for five minutes and
 * reported its one useless line: "Timed out waiting for". Every pull request
 * since ~2026-07-25 failed on it. `main` looked green only because the step is
 * gated on `github.event_name == 'pull_request'` and never runs on push.
 *
 * The replacement probes went green — but by luck, not design. Node's `fetch`
 * happens to send `User-Agent: node` and the smoke script happened to pick
 * `rr-smoke/1.0`; neither is in `BAD_BOT_RE`, so both slipped through. Nothing
 * recorded the constraint, so the next tool swap re-breaks it exactly the same
 * way and costs the same three months to find.
 *
 * So: one constant, imported by every CI probe, checked against the live
 * `BAD_BOT_RE` by `scripts/check-ci-probe-ua.mjs` (`npm run ci:probe-ua`).
 *
 * This is NOT an auth bypass. It is an ordinary, honest, identifiable UA that
 * simply is not on the automation block list. Requests still pass every other
 * middleware layer. Do not add it to `GOOD_BOT_RE`.
 *
 * Deliberate exception: `scripts/crm-e2e-verify.mjs` sends
 * `python-requests/2.31.0` ON PURPOSE, to prove the A2P compliance CTA pages
 * stay reachable to carrier reviewer tooling (Twilio error 30909 hit us twice).
 * That probe asserts the screen is bypassed for `COMPLIANCE_VERIFICATION_PATHS`,
 * so it carries a `probe-ua: adversarial` marker and is exempt from the gate.
 */

/** Identifiable, non-blocked UA for automated health probes against the app. */
export const CI_PROBE_USER_AGENT = 'rr-ci-probe/1.0 (+https://ryan-realty.com/robots.txt)'

/** Spread into a `fetch` init: `fetch(url, { headers: { ...CI_PROBE_HEADERS } })`. */
export const CI_PROBE_HEADERS = Object.freeze({ 'user-agent': CI_PROBE_USER_AGENT })
