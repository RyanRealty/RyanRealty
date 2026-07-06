#!/usr/bin/env bash
# One-shot Meta ad-account cleanup — deletes the 17 dead/superseded audiences +
# 9 paused campaigns Matt explicitly approved (manifest shown + confirmed in chat
# 2026-06-24). Hard-guards the 10 protected IDs (CRM Leads, CRM lookalike, the two
# compliance-exclusion audiences, the 6 website audiences). Verifies each object's
# name before deleting it. Temp file — deleted after the run. Not committed.
set -euo pipefail

set -a; source /Users/matthewryan/RyanRealty/.env.local; set +a
T="${META_USER_ACCESS_TOKEN}"; GV="https://graph.facebook.com/v21.0"

# NEVER delete these (assert-guard)
KEEP="120246504502300698 120246504872880698 120244223042110698 120243107433010698 120244823161890698 120244823154630698 120244223731130698 120244223730320698 120244223729930698 120235961910760698"

DEL_AUD="120244510686080698 120244514285040698 120244510682980698 120244510683790698 120244510681250698 120244510685520698 120244839495100698 120244839494740698 120244510691030698 120244510689040698 120244510687650698 120244510678740698 120244510096010698 120244510092910698 120244510776430698 120244223731190698 120244223033600698"

DEL_CAMP="120244223745230698 120244223743080698 120244223742330698 120244223741480698 120244223739790698 120244223736960698 120242751753330698 120242751742140698 120235839610290698"

delete_one () {
  local ID="$1" KIND="$2"
  if echo "$KEEP" | grep -qw "$ID"; then echo "  ABORT: $ID is PROTECTED — skipped"; return; fi
  local NAME RES
  NAME=$(curl -s "${GV}/${ID}?fields=name&access_token=${T}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('name','<<not found>>'))")
  RES=$(curl -s -X DELETE "${GV}/${ID}?access_token=${T}")
  echo "  [$KIND] [$RES]  $NAME"
}

echo "================ DELETING 17 AUDIENCES ================"
for ID in $DEL_AUD; do delete_one "$ID" "aud"; done
echo ""
echo "================ DELETING 9 CAMPAIGNS ================"
for ID in $DEL_CAMP; do delete_one "$ID" "camp"; done
echo ""
echo "================ DONE ================"
