#!/bin/bash
# Claude Code hook: Check if CHANGELOG needs updating
# This runs on UserPromptSubmit and warns if there are unreported commits

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CHANGELOG="$PROJECT_DIR/docs/CHANGELOG.md"

if [ ! -f "$CHANGELOG" ]; then
  exit 0
fi

LAST_DATE=$(head -50 "$CHANGELOG" | sed -n 's/^## \([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/p' | head -1)
if [ -z "$LAST_DATE" ]; then
  exit 0
fi

COMMITS=$(git -C "$PROJECT_DIR" log --since="$LAST_DATE 23:59:59" \
  --format="%h %ad %s" --date=short 2>/dev/null | grep -v "update CHANGELOG" | grep -v "docs: update CHANGELOG" || true)

if [ -n "$COMMITS" ]; then
  COUNT=$(echo "$COMMITS" | wc -l | tr -d ' ')
  echo "CHANGELOG_NEEDS_UPDATE: $COUNT unreported commits since $LAST_DATE. Next time user asks about project status or you see an opportunity, suggest running ./scripts/gen-changelog.sh to generate a prompt, then update docs/CHANGELOG.md."
fi
