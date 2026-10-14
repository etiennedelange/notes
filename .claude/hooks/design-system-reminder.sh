#!/usr/bin/env bash
# PostToolUse hook (Edit|Write|MultiEdit): when a file the Notes design system
# is built from changes, remind the session to re-sync it. Once per file per
# session, so repeated edits don't repeat the reminder.
input=$(cat)
file=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty' <<<"$input")
session=$(jq -r '.session_id // "unknown"' <<<"$input")

case "$file" in
  */src/themes.ts | */src/styles.css | */index.html) ;;
  */src/titlebar.ts | */src/sidebar.ts | */src/tabs.ts | */src/statusbar.ts) ;;
  */src/commandPalette.ts | */src/modal.ts | */src/contextMenu.ts | */src/toast.ts) ;;
  *) exit 0 ;;
esac
case "$file" in */site/*) exit 0 ;; esac

marker="${TMPDIR:-/tmp}/notes-ds-reminder-${session}-$(basename "$file")"
[ -e "$marker" ] && exit 0
touch "$marker"

jq -n --arg f "${file#"${CLAUDE_PROJECT_DIR:-}"/}" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("\($f) is a source of the Notes design system (claude.ai artifact). Before finishing, re-sync it as CLAUDE.md \"Design system (app)\" describes: theme colours via `pnpm design-tokens`, style edits into project/components/bundle.css, rule or behaviour changes into the component README and project/README.md.")
  }
}'
