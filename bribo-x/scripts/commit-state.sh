#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
git config user.name "bribo-bot"
git config user.email "bribo-bot@users.noreply.github.com"
git add bribo-x/state
if git diff --cached --quiet; then
  echo "No state changes."
  exit 0
fi
git commit -m "[skip ci] bribo-x state"
for attempt in 1 2; do
  if git pull --rebase && git push; then exit 0; fi
  echo "Push failed (attempt $attempt), retrying."
done
exit 1
