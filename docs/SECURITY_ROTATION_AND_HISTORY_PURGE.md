# Security runbook — key rotation & git-history purge

> These two actions need a human with cloud-console and repo-admin access. The
> automated part of this session did **not** run them. Follow this to finish.

---

## A. Rotate the leaked Firebase service-account key

The old `service-account.json` (still present locally, gitignored) is compromised —
it is in git history and must be treated as public. Rotate it:

1. **Revoke the old key.** Firebase console → Project settings → *Service accounts*
   → *Manage service account permissions* → Google Cloud IAM → *Service Accounts*
   → the `firebase-adminsdk-…` account → *Keys* → delete the leaked key id.
2. **Mint a new key.** Same screen → *Add key* → *Create new key* → JSON. Download it.
3. **Install it out of the repo.** Save it somewhere outside the working tree, then
   point the backend at it:
   ```bash
   export FIREBASE_SERVICE_ACCOUNT_PATH=/secure/path/service-account.json
   ```
   (The backend reads `FIREBASE_SERVICE_ACCOUNT_PATH`, then falls back to a repo-root
   `service-account.json`, then `GOOGLE_APPLICATION_CREDENTIALS` — see
   `platform_apps/users/authentication.py`.)
4. **Never commit it.** `service-account.json` is already in `.gitignore`.
   `service-account.json.example` documents the expected shape.
5. **Audit usage.** In GCP IAM, review the old key's recent activity for anything
   unexpected before deleting.

> The new self-contained **JWT flow** (`POST /api/v1/session/token/`) does not need
> Firebase at all, so backend auth keeps working during/after rotation.

---

## B. Purge the committed binaries (and the leaked key) from git history

~700 MB of `*.apk`, `*.zip`, `*.jks` and the old `service-account.json` live in
history. They are already gitignored, so **new** commits are clean, but history
still carries them — bloating clones and keeping the secret retrievable. Purging
history **rewrites every commit SHA** and requires a **force-push to both remotes**
(`hub`, `origin`), which breaks every existing clone, open PR and CI checkout.

**Coordinate with everyone who has a clone before running this.** A ready script is
staged at [`scripts/purge_git_history.sh`](../scripts/purge_git_history.sh):

```bash
# 0. Make a full backup mirror first (recoverable if anything goes wrong).
git clone --mirror . ../business-hub-backup.git

# 1. Install the tool (once).
pip install git-filter-repo        # or: brew install git-filter-repo

# 2. Dry-run the analysis to see what would be removed.
bash scripts/purge_git_history.sh --analyze

# 3. Rewrite history (strips *.apk, *.zip, *.jks, service-account.json, big blobs).
bash scripts/purge_git_history.sh --run

# 4. Review: git log, sizes, and that the tree still builds.
# 5. Force-push the rewritten history (DESTRUCTIVE — everyone must re-clone).
git push --force --all hub && git push --force --tags hub
git push --force --all origin && git push --force --tags origin
```

After the force-push, **every collaborator must re-clone** (a plain `git pull`
will fail or reintroduce the old history). Rotate the key (section A) regardless —
purging history does not un-leak a key that was already exposed.
