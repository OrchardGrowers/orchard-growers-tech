# OG Agent Phase 4: Controlled Coding Agent

## Purpose and non-goals

Phase 4 lets authorized technical admins inspect bounded repository evidence, create structured analyses, submit unified-diff proposals, review immutable patch versions, apply an exact approved patch, and run fixed validation command IDs. It extends the Phase 1 task, approval, settings, provider, permission, audit, API, and Admin Panel architecture.

It is not an autonomous developer or production operations system. It cannot read secrets, browse outside this monorepo, accept arbitrary terminal text, install dependencies, change a lockfile, delete or rename files, mutate production data, stage or commit files, push, pull, merge, rebase, reset, clean, modify remotes, deploy, or contact an external coding provider.

## Architecture

- `OGAgentTask` remains the general audited task anchor (`CODING_ANALYSIS`).
- `OGCodingTask` stores scope, coding lifecycle, bounded findings, structured analysis, risk, and per-task capabilities.
- `OGCodePatch` stores immutable versioned unified diffs, hashes, base state, files, approvals, validation plan, and rollback information.
- `OGCodeCommandRun` stores fixed command identity, real status/exit code, bounded redacted output, timeout, and attribution.
- `OGRepositorySnapshot` stores Git metadata and selected file hashes, never repository contents.
- Existing `OGAgentApproval` stores exact action snapshots and is consumed once.
- Existing `OGAgentAuditLog` records all reads, blocks, approvals, patch actions, and command outcomes without secret content.

The service boundary is `apps/backend/services/og-agent/coding`. The deterministic provider implements the complete coding-provider interface but does not require or call a paid API. In deterministic mode a technical reviewer supplies a Git-style unified diff; the provider and backend validate it as an immutable proposal before any application approval exists.

Repository files, comments, README content, issues, and logs are untrusted evidence. Instructions found in repository content cannot change scope, permissions, approvals, settings, commands, external access, or safety rules.

## Repository boundary

The root is derived from the installed service module and canonicalized with `realpath`; a request cannot configure it. Every input path must be repository-relative, validly encoded, and inside both the canonical root and the task's selected scopes. Absolute paths, UNC paths, drive prefixes, null bytes, traversal, malformed encoding, and symlink escapes are rejected.

Default task scopes are:

- `apps/backend`
- `apps/efruitmandi-frontend`
- `apps/admin-panel`
- `packages/shared-ui`
- `packages/shared-types`
- `packages/shared-config`
- `docs`
- explicitly selected safe root files such as `package.json`

Shared packages and root files are never included automatically. Reads and searches are bounded by file count, bytes per file, cumulative task bytes, result count, text/binary detection, and task scope. Repository content is retrieved on demand and is not indexed into MongoDB.

## Denied paths and content

The policy denies `.env` variants, credentials/secrets/token/service-account files, private keys and key containers, local databases, dumps/backups, private uploads, `node_modules`, `.git`, build output, coverage, logs, caches, binary/media/archive files, and obvious secret material. Denied content is never returned to the provider or frontend. Process output and audit metadata redact token-, password-, authorization-, key-, cookie-, and secret-shaped values.

## Task and analysis lifecycle

1. ADMIN or SUPER_ADMIN creates a task with explicit scopes and opt-in capabilities.
2. The backend creates the general `OGAgentTask` and one linked `OGCodingTask`.
3. Analysis captures a `BEFORE_ANALYSIS` snapshot and acquires an expiring task lock.
4. File hints are read in bounded sections and one bounded deterministic search may identify references.
5. The provider returns problem restatement, exact evidence, confidence, root cause, assumptions, affected flows, plan, compatibility/database/UI/security/performance impacts, tests, rollback, risk, and unresolved questions.
6. Analysis never writes a repository file and uses `Confirmed`, `Highly likely`, `Possible`, or `Not verified` confidence. Deterministic mode defaults to `Not verified` rather than fabricating certainty.

## Patch lifecycle and approval

Lifecycle: `NOT_REQUESTED → WAITING_APPROVAL → GENERATING → REVIEW_READY → WAITING_APPROVAL → APPROVED → APPLYING → APPLIED`, with rejection/failure/supersede/revert terminal branches.

Patch generation requires completed analysis, task/global permission, an exact `CODE_PATCH_GENERATION` approval, and an unchanged commit plus working-tree hash. Validation accepts complete UTF-8 Git-style unified diffs only. It rejects denied/out-of-scope paths, binary changes, secrets, oversized patches, duplicate file entries, mismatched headers, stale content, lockfiles, deletion, rename, and file creation when disabled.

Every new proposal receives a version, SHA-256 patch hash, base commit, base working-tree hash, file operations and counts, risk, validation commands, and rollback instructions. Older unapplied versions are superseded. An approval belongs to one action snapshot and cannot be reused after mutation or consumption.

Application preview contains title/task context, branch/base commit, dirty-tree warning in the UI, exact files/operations, counts, high-risk flags, patch hash, exact diff, validation commands, and rollback information. High-risk files require the regular application approval plus `HIGH_RISK_CODE_PATCH_APPLICATION` approval.

## Working-tree and application safety

Before application the backend rechecks patch hash, commit, full working-tree hash, approvals, file list, operations, settings, and overlap. It blocks any proposed file already modified/staged/untracked. High-risk application is blocked when any working-tree change exists.

The backend captures `BEFORE_PATCH_APPLY`, writes the approved patch only to a private OS temporary directory, runs `git apply --check` through spawn without shell mode, then applies that exact file. It compares before/after status and selected hashes, rejects unexpected files, captures `AFTER_PATCH_APPLY`, consumes approvals, and audits the exact result.

It never stashes, resets, cleans, checks out, overwrites an existing untracked target, stages, commits, pushes, merges, or deploys. A partial or unexpected state stops immediately and is reported for manual inspection; broad automatic repair is prohibited.

## Revert behavior

Only an `APPLIED` OG Coding Agent patch can be automatically reverted. Revert requires an exact approval, original patch, after-apply hashes, current-state match, and no later edit to affected files. It captures before/after snapshots and uses `git apply --reverse --check` followed by the exact reverse patch. Conflict blocks automatic revert and requires manual review. `git reset --hard`, `git clean`, force checkout, and branch deletion are never used.

## Safe command registry

The provider and frontend submit a command ID only. The backend rejects executable, arguments, command text, shell flags, working directory, pipes, redirects, chaining, substitutions, and environment expansion.

Registered commands match scripts that exist in this repository:

| ID | Fixed operation | Approval |
|---|---|---|
| `git_status` | `git status --short --untracked-files=all` | no |
| `git_diff_stat` | `git diff --stat` | no |
| `git_diff_names` | `git diff --name-only` | no |
| `git_diff_check` | `git diff --check` | no |
| `backend_tests` | backend workspace Vitest run | yes |
| `admin_typecheck_build` | admin workspace TypeScript + Vite build | yes |
| `admin_lint` | admin workspace lint | yes |

Execution uses `spawn` with `shell: false`, fixed arrays, project-root working directory, minimized environment, global concurrency, timeout, cancellation, bounded stdout/stderr, redaction, real exit code, and distinct passed/failed/timed-out/blocked/cancelled states. Non-zero exit never appears as success. Full monorepo build is not a default command.

## Git policy

Read-only status, branch, commit, diff names/stat/check are allowed. Commit, amend, push, pull, fetch, merge, rebase, reset, clean, tag, remote modification, force operations, and branch deletion are disabled. `allowLocalBranchCreation` is reserved and defaults false; Phase 4 does not expose a branch-write route. No action implies a commit exists.

## Permissions

- ADMIN and SUPER_ADMIN: view, create, analyze, scoped repository reads/search, generate/review patches, request apply, and run validation.
- SUPER_ADMIN: approve generic OG Agent approvals, apply/revert patches, manage settings, and reserved local-branch permission.
- All other actual admin roles: no Coding Agent permission.

Authorization is enforced per route; hidden UI is not a security control. Denials create shared audit entries.

## Settings

Configurable: master switch; repository read/search; analysis; patch generation/application; safe commands; build/test/lint approvals; read, patch, output and timeout limits; concurrency; and file creation.

Backend-locked: patch generation approval=true, patch application approval=true, additional high-risk approval=true, local branch creation=false, file deletion=false, rename=false, lockfile change=false, dependency installation=false, arbitrary terminal=false, secret reads=false, commit=false, push=false, merge=false, production deployment=false, and database write=false.

## Audit behavior

Audited events cover task/scope creation, status reads, list/search/read and denied access, analysis, generation request/result/failure, approval decisions, stale/hash errors, dry-run, apply, unexpected files, command request/start/result/timeout/block/cancel, revert request/result/conflict, settings changes, prohibited requests, and unauthorized access. Metadata is bounded and sanitized; secret contents are never stored.

## Local setup

1. Use the existing root `npm install` performed manually by a developer; Phase 4 never installs packages.
2. Start the existing backend and Admin Panel workflows.
3. Sign in as SUPER_ADMIN to review Coding Agent settings.
4. Open OG Brain → OG Agent → Coding Agent.
5. Create a task with the smallest application scope and exact file hints.
6. Run analysis, review evidence, and request patch generation.
7. Approve the exact request under Approvals, paste a complete unified diff in deterministic mode, and validate it.
8. Review the diff and request application. Approve all required snapshots before applying.
9. Run only necessary fixed checks and inspect actual exit codes.
10. Commit, push, merge, and deploy manually outside OG Agent.

## Manual security and lifecycle test matrix

1. As VIEWER call a coding route; expect 403 and an authorization audit.
2. Submit `../x`, absolute, UNC, drive, null-byte, and encoded traversal paths; expect a safe 400.
3. Point an in-root symlink outside the repository in a controlled test clone; expect `SYMLINK_ESCAPE_DENIED`.
4. Read `.env`, PEM/key, credentials, token, `node_modules`, `.git`, dump, backup, database, binary, and oversized files; expect no content.
5. Search a symbol with one selected scope; confirm no result outside it and bounded snippets/hashes only.
6. Run analysis and compare `git status`; no file should change.
7. Generate without approval or after repository state changes; expect an approval/stale-state error.
8. Submit out-of-scope, secret, binary, malformed, deletion, rename, dependency, and lockfile patches; expect rejection.
9. Modify a patch after approval; expect hash/snapshot rejection and a new version requirement.
10. Modify/stage/create a proposed target before apply; expect overlap rejection and no stash/reset.
11. Apply twice; expect the second action to fail idempotently.
12. Confirm no file is staged and no commit, push, merge, remote change, or deployment occurs.
13. Try command/executable/args/cwd/shell/chaining input; expect `ARBITRARY_COMMAND_DENIED`.
14. Run each registered command and verify actual exit code, bounded output, timeout, and cancellation state.
15. Put token-shaped data in controlled test output; confirm redaction from response/audit.
16. Change an applied file manually, then request revert; expect `REVERT_CONFLICT` and manual instructions.
17. Run Phase 1, Email Intelligence, and Telecalling focused regression suites.
18. Run admin TypeScript/build and retain unrelated pre-existing failures without automatic repair.

PowerShell checks from the monorepo root:

```powershell
npm test --workspace @efruitmandi/backend -- --run services/og-agent/coding/ogAgentCodingPhase4.test.js
npm test --workspace @efruitmandi/backend -- --run services/og-agent/ogAgentPhase1.test.js services/og-agent/email/ogAgentEmailPhase2.test.js services/og-agent/telecalling/ogAgentTelecallingPhase3.test.js
npm run build --workspace @efruitmandi/admin-panel
git diff --check
git status --short
```

## Troubleshooting

- `PATH_OUTSIDE_TASK_SCOPE`: select the correct top-level scope; do not broaden scope unnecessarily.
- `STALE_PATCH`: repository status changed after generation; inspect and create a new patch version.
- `DIRTY_WORKING_TREE_OVERLAP`: preserve existing work and resolve overlap manually; OG Agent will not stash or reset it.
- `CODING_APPROVAL_REQUIRED`: approve the current exact snapshot; an old approval cannot be reused.
- `COMMAND_NOT_ALLOWED`: use a listed command ID; arbitrary commands are intentionally unavailable.
- Non-zero validation: inspect stdout/stderr and determine whether it is introduced, pre-existing, or unresolved; do not claim success.

## Limitations and future Phase 5

Deterministic mode does not synthesize arbitrary source changes from natural language; it validates a reviewer-provided unified diff. Patch application and revert require a Mongo-backed live workflow and a safely unchanged repository. Full diff pagination is byte-window based. File-level later-edit detection is hash based and deliberately conservative. Local branch creation is modeled/settings-gated but not exposed as a write route.

Future work may add a separately reviewed coding provider and finer hunk-conflict detection. GitHub/GitLab/Bitbucket auth, cloning, remote branches, commits, pull/merge requests, CI/CD, deployments, production logs/shell, cloud/Kubernetes credentials, database migrations, autonomous tasks, package installation, dependency upgrades, and external repository upload remain out of scope.
