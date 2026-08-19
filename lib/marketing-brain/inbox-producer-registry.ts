/**
 * marketing-brain: inbox-producer-registry
 *
 * Static action_type → assigned_producer lookup. Mirrors
 * marketing_brain_skills/producers/REGISTRY.md (Sections A–F). The brain
 * itself reads the markdown registry at decision-time; this TS shim
 * exists so the inbox dispatcher can resolve a producer path in-process
 * without parsing the markdown.
 *
 * INVARIANT (enforced by scripts/check-producer-registry-resolves.mjs,
 * ci:producer-registry-resolves): every path here must resolve to a real
 * `<path>/SKILL.md` in the DEPLOYED repo — i.e. a producer the cloud
 * producer-runtime can actually load. A producer whose SKILL.md is NOT in the
 * repo (the decommissioned video producers, whose `video_production_skills/`
 * tree lives only on the local render worker — see REGISTRY.md "VIDEO PRODUCERS
 * DECOMMISSIONED 2026-06-14") must NOT appear here: with no entry, the dispatcher
 * falls through to comms:matt_alert (resolveProducer → null in inbox-dispatcher),
 * which is exactly the intended funnel — the broker's video request reaches Matt,
 * who fulfills it on the local worker. Mapping it to a non-existent path instead
 * makes producer-runtime die with "SKILL.md not found" and the request is lost.
 *
 * Drift detection: if the parser emits an action_type that is not a key in this
 * map, the dispatcher routes the inbox event to comms:matt_alert with a "no
 * producer registered" reason. So the video content:* action_types (still valid
 * in inbox-parser's VALID_ACTION_TYPES, so Matt's alert names the deliverable)
 * correctly land at matt_alert for local fulfillment.
 */

const PRODUCER_REGISTRY: Record<string, string> = {
  // Producer runtime retired 2026-08-18. Inbox still files a row; every
  // action type that used to dispatch a SKILL.md now lands on matt_alert.
  'comms:matt_alert': 'marketing_brain_skills/producers/comms-matt-alert',
  'comms:matt_summary': 'marketing_brain_skills/producers/comms-matt-alert',
  'comms:team_update': 'marketing_brain_skills/producers/comms-matt-alert',
  'comms:stakeholder_summary': 'marketing_brain_skills/producers/comms-matt-alert',
}

export default PRODUCER_REGISTRY
