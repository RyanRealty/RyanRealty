# 2026-10-15 (Cursor, Sarah voice line)

Surface: Cursor cloud. Branch `cursor/sarah-voice-line-61d7`.

Done: inbound voice uses lib/sarah greeting/prompt; unknown callers on spare go to conference `sarah-live-{CallSid}` plus xAI SIP; known callers Dial Matt +15412136706 with caller ID; CRM note/stage with by Sarah; Twilio number backup in `docs/ops/twilio-voice-backup-2026-10-15.json`.

SIP evidence (production, pre-conference deploy):
- CA33919e2fd191a59926905f417b31ae2d inbound +15415023436 → spare, 73s child SIP to sip.voice.x.ai (Sarah answered).
- CA253042124b4f5a07394111c537c6bc43 inbound +15412503380 → spare, 20s child SIP (Sarah).
- CAa4a4c9adbbf428eb370bbadd9d835fe8 outbound SIP probe spare → sip:+15412245025@sip.voice.x.ai, 20s completed.

Next: land this PR; spare test from an unknown From; then set RECEPTIONIST_LINES to include +15417033095; remove RECEPTIONIST_TRANSFER_TEST_TARGET (+15005550006) before main cutover.

Held: notifySarahLiveSession is still the stub from #646 (#647 exports notifyLiveSession, not wired). SIP trunk TK2c20738 has no numbers attached (Dial/conference SIP does not need it). All four owned Twilio numbers are CRM contact points, so calls FROM those numbers skip Sarah.

Skills: lib/sarah persona/phone-hooks on main after #646.

xAI price (2026-10-15): grok-voice-3.0 speech-to-speech $0.08/min ($4.80/hr) + $0.004 text input. Source: https://docs.x.ai/developers/pricing
