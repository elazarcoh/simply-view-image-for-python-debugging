#!/usr/bin/env bash
# rebase-pr.sh <PR_NUMBER>
# Fetches origin/main, checks out the PR branch, rebases on main, force-pushes.
# After running, go to GitHub and merge the PR.

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <PR_NUMBER>"
  exit 1
fi

PR_NUMBER="$1"

echo "==> Fetching origin main..."
git fetch origin main:main

echo "==> Looking up PR #${PR_NUMBER} branch..."
BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName')
echo "    Branch: $BRANCH"

echo "==> Checking out $BRANCH..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"

echo "==> Rebasing $BRANCH onto main..."
git rebase main

echo "==> Force-pushing $BRANCH..."
git push --force-with-lease origin "$BRANCH"

echo ""
echo "Done! Now go to GitHub and merge PR #${PR_NUMBER}:"
echo "  https://github.com/$(gh repo view --json nameWithOwner --jq '.nameWithOwner')/pull/${PR_NUMBER}"
