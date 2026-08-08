#!/usr/bin/env bash
#
# Stage-and-review script to purge committed binaries + the leaked service
# account from git history using git-filter-repo.
#
# THIS REWRITES HISTORY. It does NOT push. After running --run, review the
# result, then force-push manually (see docs/SECURITY_ROTATION_AND_HISTORY_PURGE.md):
#   git push --force --all hub && git push --force --tags hub
#   git push --force --all origin && git push --force --tags origin
#
# Every collaborator must re-clone after the force-push.
#
# Usage:
#   bash scripts/purge_git_history.sh --analyze   # show what would be removed
#   bash scripts/purge_git_history.sh --run       # rewrite history (local only)
set -euo pipefail

MODE="${1:-}"

# Paths / patterns to strip from ALL history.
PATHS_TO_REMOVE=(
  "service-account.json"
  "business-hub.jks"
  "test.jks"
)
GLOBS_TO_REMOVE=(
  "*.apk"
  "*.zip"
  "*.jks"
  "*.keystore"
)
# Belt-and-suspenders catch for any *huge* blob not matched by the globs above.
# Kept well above the largest legitimate tracked file (a 6 MB wasm blob in
# legacy/src/db) so real source is never stripped.
STRIP_BLOBS_BIGGER_THAN="45M"

require_tool() {
  if ! command -v git-filter-repo >/dev/null 2>&1 && ! python -c "import git_filter_repo" >/dev/null 2>&1; then
    echo "ERROR: git-filter-repo not found. Install it first:" >&2
    echo "  pip install git-filter-repo   (or: brew install git-filter-repo)" >&2
    exit 1
  fi
}

filter_repo() {
  if command -v git-filter-repo >/dev/null 2>&1; then
    git-filter-repo "$@"
  else
    python -m git_filter_repo "$@"
  fi
}

case "$MODE" in
  --analyze)
    echo "== Largest blobs currently in history =="
    git rev-list --objects --all \
      | git cat-file --batch-check='%(objecttype) %(objectname) %(objectsize) %(rest)' \
      | awk '/^blob/ {print $3, $4}' | sort -rn | head -30
    echo
    echo "== Tracked files matching purge globs (current tree) =="
    git ls-files | grep -iE '\.(apk|zip|jks|keystore)$' || echo "  (none currently tracked — they live only in history)"
    ;;

  --run)
    require_tool
    if [ -n "$(git status --porcelain)" ]; then
      echo "ERROR: working tree is dirty. Commit or stash first." >&2
      exit 1
    fi
    echo ">> Backup mirror at ../business-hub-backup.git"
    rm -rf ../business-hub-backup.git
    git clone --mirror . ../business-hub-backup.git

    ARGS=(--force --strip-blobs-bigger-than "$STRIP_BLOBS_BIGGER_THAN")
    for p in "${PATHS_TO_REMOVE[@]}"; do ARGS+=(--path "$p" --invert-paths); done
    for g in "${GLOBS_TO_REMOVE[@]}"; do ARGS+=(--path-glob "$g" --invert-paths); done

    echo ">> Rewriting history: ${ARGS[*]}"
    filter_repo "${ARGS[@]}"

    echo
    echo ">> Done (LOCAL ONLY). Review, then force-push manually:"
    echo "     git push --force --all hub && git push --force --tags hub"
    echo "     git push --force --all origin && git push --force --tags origin"
    echo ">> filter-repo drops remotes for safety; re-add them if needed:"
    echo "     git remote add hub    https://github.com/MurtazaJ53/BUSINESS-HUB.git"
    echo "     git remote add origin https://github.com/MurtazaJ53/BUSINESS-HUB-ANDROID-APK.git"
    ;;

  *)
    echo "Usage: bash scripts/purge_git_history.sh [--analyze|--run]" >&2
    echo "  --analyze  show largest blobs + tracked binaries (safe, read-only)" >&2
    echo "  --run      rewrite history locally (no push). See the runbook." >&2
    exit 1
    ;;
esac
