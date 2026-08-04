# OG Agent Phase 5: Controlled Self-Improvement

Phase 5 adds a human-governed feedback and evaluation system. “Improvement” means producing reviewable drafts, revisions, examples, guidance, prompt versions, rule versions, and measurements. It never means autonomous training, authority expansion, production code changes, tool creation, deployment, or security-policy rewriting.

## Safety boundary

- Existing Phase 1–4 approval fields and endpoints remain compatible.
- Structured decisions are `APPROVE`, `APPROVE_WITH_CONDITIONS`, `REJECT`, `REJECT_AND_TEACH`, `REQUEST_REVISION`, and `ESCALATE_FOR_REVIEW`.
- Conditional approval is executable only after every condition is structurally verified.
- Critical human impact must be escalated. Risky assessments require an explicit harm and severity.
- Reusable feedback creates an inactive `DRAFT` example or guidance record. Retrieval reads only active, security-reviewed, bounded records.
- Prompt/rule activation and every rollback require approval of the exact version. Hash changes invalidate the approval.
- Feedback cannot change roles, permissions, approval rules, denied paths, command allowlists, security policy, source code, or deployment controls.
- Negative, conflicting, amended, withdrawn, superseded, evaluation, and rollback history is preserved.

## Data flow

1. A reviewer sees the complete action preview and immutable proposal version/hash.
2. The reviewer submits a structured assessment, benefit/harm analysis, correction, conditions, confidence, reusable scope, and human-impact review.
3. Secrets and instruction-like content are redacted or neutralized before storage/retrieval.
4. `REQUEST_REVISION` creates a new review-ready version; the prior version is retained and no proposal action runs.
5. Repeated evidence may create an improvement proposal after the configured multi-feedback, multi-reviewer, and multi-task threshold. High/critical evidence may be surfaced earlier for review, never activated.
6. An authorized admin creates an evaluation dataset and locks it. Evaluations compare proposed behavior with a baseline.
7. A Super Admin separately approves the exact activation or rollback snapshot.
8. Post-activation metrics surface regression and human-impact warnings for human action.

## Components

Persistence is implemented by `OGAgentFeedback`, `OGAgentApprovedExample`, `OGAgentOrganizationalGuidance`, `OGAgentImprovementProposal`, prompt/rule version models, evaluation dataset/run models, and performance metrics. Task proposal versions are stored on `OGAgentTask`; structured review fields extend `OGAgentApproval`.

Services under `services/og-agent/improvement` separate validation, redaction, feedback lifecycle, revisioning, evidence analysis, retrieval, version lifecycle, evaluation, metrics, permission boundaries, and audit creation. Routes remain under `/api/admin/og-agent` and use the existing active-admin and granular permission middleware.

The Admin Panel OG Agent → Improvement workspace contains Dashboard, Feedback, Revisions, Examples, Guidance, Proposals, Prompts, Rules, Datasets, Evaluations, Metrics, and Human Impact views. OG Agent → Approvals retains the exact action preview and offers the structured assessment form for task decisions.

## Evidence and retrieval rules

The default organizational proposal threshold is five related feedback records, two distinct reviewers, and more than one task. Withdrawn and superseded feedback is excluded from new evidence. Contradictions are retained for review and do not activate guidance. Retrieval is capped, ordered by priority, scoped by task/tool/team/workflow, and labels records as reference data rather than system instructions.

## Operations and rollback

Settings can pause feedback, revisions, retrieval, pattern analysis, proposal generation, evaluations, and version creation. Automatic activation, permission changes, tool enablement, security-policy changes, approval bypass, code modification, deployment, feedback deletion, and historical rewriting are backend-locked false.

Rollback requires a separate approved action, reactivates a prior reviewed version, marks the replaced version rolled back, and retains all evaluations and history. Operators should pause retrieval/activation first if a regression is suspected, review metrics and human impact, then submit an exact rollback approval.

## Verification

Run:

```powershell
npm test --workspace @efruitmandi/backend -- services/og-agent/improvement/ogAgentImprovementPhase5.test.js
npm run build --workspace @efruitmandi/admin-panel
```

The Phase 5 suite covers backward compatibility, structured validation, conditions, escalation, immutable hashes, redaction, prohibited self-modification, inactive defaults, locked settings, tool risk, supersession, and preservation. Existing Phase 1–4 suites remain the regression boundary.

## Out of scope

Automatic fine-tuning, external training-data upload, reward-model training, autonomous prompt/rule activation, policy rewriting, permissions or tools created by the agent, production deployment, autonomous multi-agent spawning, historical deletion, employee discipline, candidate rejection, financial commitments, and autonomous production actions are not implemented.
