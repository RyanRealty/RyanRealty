# 2026-10-15 (Cursor, Twilio inbound ack)

Surface: Cursor cloud. Branch: `cursor/twilio-inbound-ack-9373`. PR #631.
Time: 2026-10-15T01:19Z.

Done: inbound SMS/voice/voicemail/recording validate signature, persist one 2s
row into `twilio_webhook_raw_events`, return TwiML/200. CRM, DNC clear, STOP
run after ack or `/api/cron/twilio-webhook-replay`. Gate `ci:twilio-webhook-ack`.
Hosted migration applied. Voice TwiML keeps receptionist SIP on the hot path
(fail-open known caller). Founding: 11200/11203 SM872130d80ef66b91a9a3f1bd837eb53e.

Next: finish merge of origin/main, push PR 631, auto-merge, production READY,
signed POST 200.

Skills read: database-canonical-reference, crm-up-to-snuff.

Node: none (Twilio webhook harden, not a public site queue node)
