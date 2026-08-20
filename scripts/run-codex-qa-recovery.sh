#!/bin/zsh
set -euo pipefail

site_root=/Users/bingliu/Documents/Codex/Sites/smartlingo.net
automation_label=com.smartlingo.qa21.recovery
automation_plist=/Users/bingliu/Library/LaunchAgents/com.smartlingo.qa21.recovery.plist
completed_plist=/Users/bingliu/Library/LaunchAgents/com.smartlingo.qa21.recovery.completed.plist
lock_directory=/private/tmp/smartlingo-qa21-codex-recovery.lock
local_date="$(TZ=America/Los_Angeles date +%F)"

if [[ "$local_date" < "2026-08-21" ]]; then
  exit 0
fi

if [[ "$local_date" > "2026-09-10" ]]; then
  /bin/launchctl bootout "gui/$(/usr/bin/id -u)/$automation_label" >/dev/null 2>&1 || true
  if [[ -f "$automation_plist" ]]; then
    /bin/mv "$automation_plist" "$completed_plist"
  fi
  exit 0
fi

if ! /bin/mkdir "$lock_directory" 2>/dev/null; then
  exit 0
fi
trap '/bin/rmdir "$lock_directory" >/dev/null 2>&1 || true' EXIT

cd "$site_root"
/Applications/ChatGPT.app/Contents/Resources/codex exec \
  --approve-for-me \
  --sandbox workspace-write \
  --cd "$site_root" \
  - < "$site_root/docs/qa-21-day-codex-recovery-prompt.md"

