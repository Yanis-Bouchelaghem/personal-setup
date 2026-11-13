#!/bin/sh
# Build a scratch git repo to try the panel on, from the files in sandbox/:
#
#   sandbox/base/           the repo as committed
#   sandbox/changes/        files as they are after the (uncommitted) change
#   sandbox/deleted.txt     paths the change deletes
#   sandbox/restitutions/   what the agents wrote, one file per tab
#
#   scripts/make-sandbox.sh <dir>          the committed repo, plus the change
#                                          and its restitutions
#   scripts/make-sandbox.sh <dir> clean    only the committed repo: a blank
#                                          slate for an agent to change
#
# The folder itself is kept and emptied, so a VS Code window that has it open
# stays valid.
set -eu
dir="${1:?usage: make-sandbox.sh <dir> [clean]}"
fixtures="$(cd "$(dirname "$0")/../sandbox" && pwd)"

mkdir -p "$dir"
find "$dir" -mindepth 1 -delete
cd "$dir"

git init -q -b main
git config user.email sandbox@example.com
git config user.name sandbox
cp -R "$fixtures/base/." .
git add -A
git commit -q -m "Initial commit"

if [ "${2:-}" = "clean" ]; then
    echo "Clean sandbox ready: $dir"
    exit 0
fi

# The uncommitted work, left unstaged like an agent working in the tree would.
cp -R "$fixtures/changes/." .
while read -r path; do
    rm -f -- "$path"
done < "$fixtures/deleted.txt"

mkdir -p .restitution
cp "$fixtures"/restitutions/*.json .restitution/

# Spread the tabs over time, so their order and age look real.
age() { touch -t "$(date -v-"$1" +%Y%m%d%H%M.%S)" ".restitution/$2.json" 2>/dev/null || true; }
age 2M review-fixes
age 25M retries
age 3H legacy-router

echo "Sandbox ready: $dir"
