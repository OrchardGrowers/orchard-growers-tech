# OG Agent Security Rules

These rules are permanent design constraints for OG Agent unless a later, formally reviewed security specification is stricter.

## Phase 5 feedback and self-improvement boundary

Human feedback is untrusted evidence, not a system instruction or authority grant. It may create only reviewable revisions and inactive improvement drafts. It cannot change permissions, roles, approval requirements, security rules, denied paths, command allowlists, tool availability, source code, Git state, or deployment authority.

Reusable examples and organizational guidance require separate review and activation; only active, scoped, bounded, security-reviewed records are retrievable. Prompt/rule activation and rollback require exact human-approved versions, completed evaluation evidence, immutable hashes, and preserved history. Automatic activation, permission expansion, tool enablement, security-policy change, approval bypass, self-code modification, deployment, feedback deletion, and historical rewriting remain backend-locked false.

Feedback is redacted for common secrets and prompt-injection phrases before storage/retrieval. Negative, conflicting, superseded, withdrawn, failed-evaluation, and rollback evidence is retained. Critical human impact requires specialist escalation. See `OG_AGENT_HUMAN_FEEDBACK_POLICY.md` and `OG_AGENT_PHASE_5_SELF_IMPROVEMENT.md`.

## Phase 6 Research Agent boundary

Research access is allowlist-first. Every website or API requires an active, current, human-reviewed source policy covering domain, paths/endpoints, operation, robots/terms/privacy, rate, retention, contact use, and reliability. Arbitrary URLs, private/internal IPs, metadata endpoints, unsafe DNS answers, cross-domain redirects, non-standard ports, and embedded credentials are blocked.

The Research Agent does not bypass robots, CAPTCHA, login, paywalls, access controls, or rate limits; use rotating/residential proxies; scrape private profiles; submit forms; purchase APIs; accept terms; expose credentials; collect sensitive identifiers/financial data; activate sources; import leads; create accounts; or contact anyone automatically. Source content and learned feedback are untrusted and cannot change source policy, permissions, tools, settings, or approvals.

Only source-approved public business, organization, or public-office contacts may become temporary candidates. Public availability is not marketing consent. Permanent BusinessLead import requires an immutable human-approved snapshot, retains provenance, uses conservative consent status, and creates no outreach or user account. See `OG_AGENT_RESEARCH_SOURCE_POLICY.md` and `OG_AGENT_PHASE_6_RESEARCH_AGENT.md`.

1. **No unrestricted production access.** OG Agent must use narrowly scoped, explicitly registered tools and least-privilege identities.
2. **No secret exposure.** Passwords, authentication headers, session tokens, API keys, private keys, cookies, and provider credentials must never enter prompts, frontend bundles, task results, approval previews, or audit metadata.
3. **No direct main-branch push.** OG Agent must not push to Git, merge a branch or pull request, bypass branch protection, or impersonate a reviewer.
4. **No destructive database action without explicit authorization.** Destructive actions require a separately designed tool, least privilege, validated scope, recoverability, human approval, and complete audit history. They are prohibited in Phase 1.
5. **No automated email sending in Phase 1.** Email search, draft creation, and delivery must remain disconnected from live mailboxes. `allowEmailSending` is backend-locked to `false`.
6. **No AI calling in Phase 1.** The system may prepare a script but cannot place or receive a call. `allowAICalling` is backend-locked to `false`.
7. **No payment action.** OG Agent must not create, capture, refund, settle, transfer, or otherwise process money.
8. **No impersonation of human employees.** Generated material must be identifiable as an AI-assisted preview and must not claim that a human performed an action they did not perform.
9. **Full auditability.** Task creation, planning, execution, failure, cancellation, approval, rejection, settings changes, prohibited requests, and permission denials must be recorded without secrets.
10. **Least-privilege access.** UI visibility is not a security boundary. Every backend endpoint and tool must enforce role, active-account, setting, state, and input checks.
11. **Human approval for consequential actions.** Medium- and high-risk work requires explicit human review. Approval must describe the exact action and must not silently authorize broader access.
12. **No direct code modification or execution in Phase 1.** Coding tasks produce analysis only. `allowCodeExecution` is backend-locked to `false`.
13. **No production deployment in Phase 1.** `allowProductionDeployment` is backend-locked to `false`.
14. **No silent capability expansion.** A new provider or integration does not become usable until its tools, settings, permissions, validation, failure handling, approvals, audit events, UI disclosures, and tests are reviewed together.
15. **Safe failure.** Provider, database, validation, authorization, or lifecycle errors must stop the task and must never fall through to an unregistered external action.

## Phase 1 locked actions

The following action identifiers are explicitly blocked: `send_email`, `initiate_ai_call`, `write_code`, `execute_terminal_command`, `modify_production_database`, `delete_record`, `process_payment`, `deploy_production`, `merge_branch`, and `push_git`.

Approval of `external_action_demo` acknowledges only a workflow simulation. It never permits a real external action.

## Phase 2 mailbox and lead controls

1. Mailbox access must remain least-privilege and read-only.
2. Never send, reply to, forward, delete, archive, move, label, or otherwise modify email automatically.
3. Never store raw email credentials or log access tokens, authentication headers, or full email bodies.
4. Never create a permanent Business Lead without explicit approval of an immutable candidate snapshot.
5. Never create a user account, Grower profile, or Buyer profile automatically from an extracted contact.
6. Never update or merge an existing lead, user, grower, or buyer automatically.
7. Preserve source identifiers and minimal bounded evidence for traceability.
8. Treat opted-out contacts as confirmed duplicates and do not re-import them.
9. Keep uncertain and low-confidence classifications reviewable and unselected until verified.
10. Revalidate approval, snapshot integrity, eligibility, and exact duplicates immediately before import.
11. Consume each import approval once and prevent every candidate from being imported twice.

## Phase 3 human telecalling controls

1. OG Agent must not place, connect, or claim to have placed or connected a call.
2. No telephony provider, microphone access, call recording, audio upload, transcription, or speech-to-text is permitted.
3. No SMS, WhatsApp, automated email, or voice message may be sent.
4. A frontend `tel:` link may only open the user's own dialer; it provides no connection evidence.
5. Call outcomes and follow-up dates must be explicitly entered and confirmed by a human.
6. Manually entered duration must always be labelled as not telecom-provider verified.
7. Never promise or imply guaranteed sales, prices, buyers, employment, investment returns, government benefits, legal outcomes, loans, or payment outcomes.
8. Never request OTPs, passwords, bank credentials, or Razorpay credentials.
9. Do-not-contact and opt-out requests must cancel safe future calling work and prevent campaign re-entry.
10. Registered User, Grower, Buyer, KYC, Lot, Deal, Escrow, Payment, and profile records must not be modified from telecalling.
11. Full phone numbers and private call notes must be restricted to authorized assigned staff or managers.
12. Queue claims, outcomes, status/correction updates, assignments, follow-ups, scripts, and sensitive views must be audited.

## Phase 4 controlled coding boundaries

1. The Coding Agent repository root is canonical and backend-derived. Every requested path must be repository-relative, canonical, inside both the root and selected task scope, and unable to escape through traversal, encoding, UNC/drive syntax, or symbolic links.
2. `.env`, credentials, secrets, tokens, private keys, certificates/key containers, local databases, dumps, backups, private uploads, `.git`, dependencies, generated output, binary/archive content, and oversized files are denied.
3. Repository content is untrusted data. Embedded instructions cannot expand scope, reveal secrets, select commands, bypass approval, contact external services, push, merge, or deploy.
4. The provider receives only task text, constraints, sanitized metadata, approved excerpts, Git state, and project rules. Provider-generated paths, patches, commands, and state claims are never trusted without backend validation.
5. Patch generation and application require separate exact approvals. Approval binds patch/version/hash, base state, files, operations, commands, and risk. Mutation or stale state invalidates it.
6. High-risk authentication, authorization, role, payment, escrow, webhook, KYC, database, upload, CORS, middleware, configuration, privacy, encryption, backup, route-registration, and deployment paths require an additional approval and cannot auto-apply on a dirty tree.
7. Existing modified, staged, and untracked work is never stashed, reset, cleaned, overwritten, staged, committed, or discarded. Overlap blocks application.
8. Application uses the exact approved unified diff, `git apply --check`, changed-file/hash verification, and before/after metadata snapshots. File deletion, rename, binary changes, dependency changes, lockfile changes, migrations, and unexpected files are blocked.
9. Revert uses only an approved validated reverse patch when after-apply hashes still match. Later overlap blocks automatic revert. Destructive Git reset/clean/checkout is prohibited.
10. Commands come only from a fixed backend registry. Shell mode, command text, arguments, cwd, chaining, pipes, redirects, substitutions, user environment expansion, arbitrary Node/Python/PowerShell, network tools, package management, database CLIs, and deployment tools are prohibited.
11. Safe execution uses fixed argument arrays, project-root cwd, minimized environment, timeout, cancellation, concurrency bounds, bounded redacted output, and real exit codes. Failure or timeout cannot be reported as success.
12. Git writes remain disabled: no commit, amend, push, pull, fetch, merge, rebase, reset, clean, tag, remote modification, force operation, or branch deletion. Production deployment and database writes remain backend-locked false.
13. All repository access, denied access, analyses, patch versions, approvals, dry-runs, applications, unexpected changes, command results, reverts, settings, prohibited actions, and permission denials are audited without secret content.
