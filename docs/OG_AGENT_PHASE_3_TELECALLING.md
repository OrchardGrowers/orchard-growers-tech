# OG Agent Phase 3: Human Telecalling Assistant

## Purpose and boundary

Phase 3 helps authorized human staff prepare and manage Business Lead calls. It creates internal campaigns and queues, displays approved lead context, generates deterministic scripts, records user-confirmed outcomes, schedules confirmed follow-ups, and reports operational counts.

OG Agent does not place or connect calls. It does not use a telephony provider, microphone, recording, audio, transcription, SMS, WhatsApp, email delivery, or automated outreach. A frontend `tel:` link may open the user's own phone application; no connection event is known or recorded.

## Architecture reused

Phase 3 reuses OG Agent authentication, active-admin checks, granular permission middleware, settings, tools, audits, API namespace, Admin Panel tabs, pagination, safe error handling, and the Phase 1 mock preparation provider. It extends the Phase 2 `BusinessLead`; it does not create another lead or authentication model.

Dedicated records are used because the repository had no suitable call campaign, queue-lock, activity-history, or general follow-up model:

- `OGCallingCampaign`: filters, team, lifecycle, and counters.
- `OGCallQueueItem`: campaign-scoped work, assignments, attempts, and expiring locks.
- `OGCallActivity`: append-only manual starts, outcomes, notes, corrections, and assignment history.
- `OGCallScriptTemplate`: versioned draft/active/archived manager scripts.
- `OGFollowUp`: confirmed due work with completion history.

## Campaign lifecycle

Managers create a preview before explicitly creating a DRAFT. Preview reports matching leads, missing/invalid phone exclusions, do-not-contact/opt-out exclusions, invalid exclusions, existing active items, proposed queue size, and assignment distribution. Activation re-runs eligibility, validates active telecallers, applies the campaign maximum, and inserts internal queue items only.

Lifecycle: `DRAFT → ACTIVE ↔ PAUSED → COMPLETED → ARCHIVED`, with cancellation from draft/active/paused. Completing a campaign with pending work requires explicit confirmation. Campaigns with history are archived, not deleted.

Eligible leads exclude `INVALID`, `DUPLICATE`, `ARCHIVED`, confirmed duplicates, opted-out contacts, `doNotContact`, and invalid phone numbers. Standard activation never calls anyone.

## Assignment and queue lifecycle

Strategies are MANUAL, ROUND_ROBIN, EQUAL_DISTRIBUTION, and UNASSIGNED_QUEUE. Only active SUPER_ADMIN, ADMIN, SUPPORT_EXECUTIVE, or SALES_EXECUTIVE admins can be assigned. Existing matching `BusinessLead.assignedTelecaller` assignments are preserved, active-item limits are enforced, and full telecallers remain unassigned rather than being overloaded.

Queue states are PENDING, IN_PROGRESS, COMPLETED, FOLLOW_UP_REQUIRED, SKIPPED, INVALID, DO_NOT_CONTACT, and CANCELLED. Campaign+lead uniqueness applies only to active queue states, so the same lead can legitimately appear in a later campaign.

Claim uses one atomic conditional update. An item can be claimed only when unlocked, already owned by the claimant, or expired. Locks have configured short expiry and are cleared after save, skip, release, cancellation, or do-not-contact. SUPER_ADMIN may force-release; managers may reassign only unlocked items.

## Manual call workspace

Opening the workspace claims the item and displays the full phone only to authorized assigned staff/managers. Broad lists mask phone values. “Mark manual call started” creates only `CALL_STARTED_MANUALLY` after a user click. It explicitly states that no call connection was detected.

The optional browser dialer link is frontend-only. The convenience duration is manually entered, editable, stored only with outcome submission, and labeled “not telecom-provider verified.” Unsaved outcome changes trigger a leave warning.

## Outcome workflow

Outcome requires a valid enum and idempotency key. Material outcomes require notes; `CONNECTED_CALL_LATER` requires a future confirmed date. A valid lock is required. Duplicate submissions return the existing activity or fail safely at the unique guard.

- NO_ANSWER/BUSY/SWITCHED_OFF/OUT_OF_COVERAGE increment attempts but never mean not interested.
- WRONG_NUMBER records a quality issue and retains the lead.
- CONNECTED_INTERESTED, CONNECTED_CALL_LATER, and CONNECTED_NOT_INTERESTED update lead status only with the explicit checkbox and exact conservative mapping.
- ALREADY_REGISTERED records the statement but never links or changes a User.
- DO_NOT_CONTACT requires a reason, sets `doNotContact` and `OPTED_OUT`, cancels active queue items/follow-ups, and prevents future campaign eligibility.

Corrected lead fields are stored with old/new values in activity. Only a manager with the setting and explicit confirmation may update the allowed `BusinessLead` fields. User, grower, buyer, KYC, lot, deal, payment, and profile records are never modified.

## Follow-ups

Follow-ups are created only from an explicit future date or direct confirmed request. Active duplicate follow-ups for the same queue item are rejected. Lists support own/all scope, status, campaign, due today, and overdue. Completion uses a conditional update, requires a completion note, and can happen once. Existing dates are updated explicitly rather than silently overwritten.

Dates are returned as ISO values and displayed through the Admin Panel/browser locale and timezone; no display timezone is hardcoded.

## Scripts and compliance

The local deterministic script service uses purpose, lead type, language, approved lead facts, previous outcome, and attempt. It includes a real-human identity disclosure, introduction, verification/qualification questions, platform explanation, objections, safe close, and next-action suggestion.

Always-visible warning:

> Do not promise guaranteed sales, prices, employment, investment returns, government benefits, or payment outcomes.

Scripts prohibit government impersonation, guarantees, legal/payment commitments, OTP/password/bank/Razorpay requests, fake deadlines/scarcity, and claims that an AI caller is human. Activating a template automatically inactivates an older active template for the same purpose+lead type+language.

## Permissions

- SUPPORT_EXECUTIVE / SALES_EXECUTIVE: Telecalling dashboard, own/unassigned queue, outcome recording, approved scripts, own follow-ups, and necessary sensitive contact in a claimed workspace.
- ADMIN: all manager controls, team queue, campaigns, assignment, reports, scripts, and verified Business Lead corrections.
- SUPER_ADMIN: manager controls plus settings and lock override.
- Other roles: no Phase 3 access. Denials are audited.

## Privacy and audit

Phone values are masked in queue/follow-up lists and full only in authorized workspace detail. Notes and history require assignment or manager permission. There is no unrestricted phone export. Sensitive workspace views, claims, starts, outcomes, status/correction changes, do-not-contact, assignments, campaign lifecycle, scripts, and follow-ups are audited without secrets.

## Reporting

Dashboard counts come from MongoDB: pending, completed today, follow-ups due, interested, no-answer, and do-not-contact. Campaign reports include queue/outcome distributions, completion percentage, attempts, follow-ups, and average manually entered duration. Telecaller reports show contextual volumes and outcome distribution and explicitly avoid a single employee ranking.

## Local setup

1. Start the existing backend and Admin Panel.
2. Import approved Business Leads through Phase 2 or create them through an existing authorized workflow.
3. As SUPER_ADMIN review OG Agent Settings, campaign limits, queue locks, note length, and locked call/messaging controls.
4. As ADMIN open OG Agent → Telecalling → Campaigns, create a preview, confirm the draft, and activate it.
5. Assign SUPPORT_EXECUTIVE or SALES_EXECUTIVE users, then use My Queue and Follow-ups.

## Manual verification

1. Confirm a VIEWER receives 403 and an audit denial.
2. Preview excludes opted-out, do-not-contact, archived/invalid, duplicate, and invalid-phone leads.
3. Confirm draft creation and activation create only internal records.
4. Attempt two claims; only one atomic claim succeeds.
5. Let a lock expire and confirm a later claim succeeds.
6. Click manual start and confirm no connected outcome/status is created.
7. Confirm call-later without future date is rejected.
8. Confirm no-answer leaves lead status unchanged.
9. Confirm interested status changes only when explicitly checked.
10. Confirm wrong-number retains the Business Lead.
11. Confirm do-not-contact cancels future active calling/follow-ups and prevents new preview inclusion.
12. Repeat an idempotency key and confirm no duplicate outcome.
13. Complete a follow-up twice; the second attempt fails.
14. Confirm broad lists mask phone while claimed workspace shows it to an authorized assignee.
15. Confirm no User/Profile/KYC/Lot/Deal/Payment records change.

## Troubleshooting

- **No eligible leads:** verify approved Business Leads have callable phone values and are not opted-out, invalid, duplicate, archived, or do-not-contact.
- **Already claimed:** wait for expiry or ask the owner to release; SUPER_ADMIN can force-release.
- **Campaign paused:** a manager must resume it before manual start.
- **Follow-up required:** choose a future local date/time.
- **Duplicate outcome:** retain the original result and use a new idempotency key only for a genuinely new attempt.
- **Dialer link missing:** `allowTelephoneLinks` may be disabled; manual calling remains outside OG Agent.

## Rollback guidance

Disable Phase 3 settings to stop new campaigns, assignments, outcomes, follow-ups, scripts, or `tel:` links. Pause active campaigns and retain all queue/activity/audit history. Do not delete Business Leads or call history. Removing the UI route is optional; the backend settings/permissions remain the security boundary.

## Limitations and Phase 4

No cloud telephony, click-to-call API, AI voice, audio, microphone, recording, transcription, sentiment, messaging, Calendar sync, auto-registration, profile/deal/payment creation, predictive scoring, or employee ranking exists.

Future Phase 4 should first add governance for consent, verified account matching, correction review, and auditable exports. Any telephony integration would require a separate security/privacy design, provider least privilege, explicit consent, recording law review, and new human approvals.
