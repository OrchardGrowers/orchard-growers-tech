# OG Agent Phase 2: Email Intelligence and Lead Extraction

## Purpose and architecture

Phase 2 lets authorized admins search the existing synchronized business mailbox, extract temporary grower/buyer/business-contact candidates, review evidence and confidence, detect duplicates, and import an explicitly approved snapshot into `BusinessLead`.

It extends the Phase 1 task lifecycle, approvals, audit logs, settings, permissions, tool registry, router, API client, and Admin Panel page. It reuses `CareerApplication` records written by `careerMailboxSyncService.js`; it does not create another mailbox synchronizer.

## Data flow

1. A SUPER_ADMIN enables Email Search and an authorized admin creates an extraction.
2. The source registry lists only available synchronized sources.
3. An `OGAgentTask` and `OGAgentLeadExtraction` are created; no permanent lead is created.
4. A bounded synchronous run searches metadata, sanitizes content, classifies it, and writes minimal `OGAgentLeadCandidate` review records.
5. Batch duplicate checks compare current candidates, `BusinessLead`, `User`, legacy `Lead`, and other synchronized `CareerApplication` messages.
6. An admin reviews/edits candidates and selects eligible records.
7. Import preview and `LEAD_IMPORT` approval preserve candidate IDs, timestamps, and SHA-256 fingerprints.
8. A SUPER_ADMIN approves or rejects. Import atomically consumes approval, verifies the snapshot, rechecks duplicates, and creates only eligible `BusinessLead` records.
9. Material actions and source-evidence views are audited.

## Supported source and read-only boundary

`businessMailboxAdapter.js` exposes the existing synchronized Career / Business Inbox. It supports `INBOX`, bounded metadata search, and safe synchronized content. If neither existing sync configuration nor synchronized records exist, the UI reports **No synchronized business mailbox configured**.

OG Agent never accepts or stores mailbox credentials. Existing `CAREER_IMAP_*` variables remain owned by the existing sync service. The adapter deliberately has no send, reply, forward, delete, archive, move, label, or read-state methods. `email_send`, `email_reply`, and `mailbox_modify` are disabled HIGH-risk tools. Draft creation, sending, mailbox mutation, automatic account creation, and automatic record updates are backend-locked off.

## Content safety and privacy

Active HTML, scripts, embedded content, media/tracking tags, event handlers, quoted history, and reply quoting are removed before extraction. Text is bounded. Authentication headers, tokens, credentials, full raw bodies, and attachments are not copied to candidates or audit logs. Candidates store source identifiers, safe metadata, and a bounded evidence snippet.

List endpoints mask contact values. Full reviewed details require an authorized detail endpoint. Evidence access is audited. Lists use pagination and bounded limits; no mailbox-wide export exists.

## Extraction, confidence, and normalization

The local rule-based provider uses synchronized fields plus safe text to extract contacts, location, fruit, volume/follow-up hints, and business context without a paid AI API. Classification can return GROWER, BUYER, BOTH, CANDIDATE, INVESTOR, LOGISTICS, OTHER, or UNCERTAIN.

- 90–100: High confidence
- 70–89: Medium confidence
- Below 70: Low confidence; manual verification required

Confidence is an estimate, not certainty. UNCERTAIN, invalid, below-threshold, and confirmed-duplicate candidates are never selected automatically.

Email normalization trims, removes `mailto:`, lowercases, validates, and rejects no-reply addresses. Phone matching removes punctuation, rejects repeated/invalid values, preserves the original, and adds India country code only with a known India hint. Business display text is preserved while punctuation/legal suffixes are removed only from its comparison key. Known state and fruit variants are normalized without inventing missing fields.

## Duplicate rules

Score 100: exact normalized email/phone in the extraction, `BusinessLead`, platform `User`, or legacy Orchard AI `Lead`. Score 90: the same contact in another synchronized message. Score 85: normalized business plus district/state. Score 70: business-only similarity. Every match names the model, field, score, explanation, and SKIP/REVIEW suggestion.

Opted-out Business Leads are confirmed duplicates and cannot be re-imported. Phase 2 never merges, updates, or overrides an existing record.

## Approval and import guarantees

`requireApprovalForLeadImport` is always true. Preview includes totals, unique/possible/confirmed duplicates, invalid/uncertain candidates, skipped records, source mailbox, requester, and exact selected fields. Import requires an unexpired approved snapshot, verifies every fingerprint, atomically consumes approval, and repeats exact checks. A unique `sourceCandidateId` index prevents double import. Changed, invalid, opted-out, or newly duplicate candidates are skipped/rejected safely; partial results are audited. Rejection prevents import and restores review state.

## Permissions

- SUPER_ADMIN and ADMIN: view/create/run/review extractions, edit when enabled, preview, and request approval.
- SUPER_ADMIN: decide approvals, commit approved imports, and change settings.
- Other roles have no OG Agent workflow permission; denials are audited.

## Local setup

1. Configure/run the existing authorized career mailbox sync if applicable; never enter credentials through OG Agent.
2. Start backend and Admin Panel with existing repository commands.
3. As SUPER_ADMIN open **Orchard Growers AI → OG Agent → Settings** and enable Email Search.
4. Confirm Email Lead Extraction, the bounded maximum (1–250), and confidence threshold.
5. Open Email Intelligence. If no source appears, verify existing sync configuration/records rather than adding a new connection.

## Manual tests

1. Call `GET /api/admin/og-agent/email/sources` without a token: expect 401.
2. Use an unauthorized role: expect 403 and an audit event.
3. Confirm the source reports `readOnly: true` and exposes no write method.
4. Submit `maximumMessages: 251`: expect validation failure.
5. Run an extraction: candidates appear and `BusinessLead` remains unchanged.
6. Confirm evidence/logs contain no full body, token, credential, or authentication header.
7. Repeat email/phone values: expect score-100 duplicates and no auto-selection.
8. Confirm low/uncertain candidates show manual verification and are not auto-selected.
9. Edit/review, generate preview, and request approval.
10. Change a candidate after approval: expect snapshot rejection.
11. Reject approval: confirm import is impossible.
12. Approve/import as SUPER_ADMIN: only snapshot candidates are inserted.
13. Repeat import: expect consumed-approval or unique-candidate protection.
14. Try enabling sending/mailbox mutation/account creation via settings: response remains false.
15. Change a Business Lead status when enabled and confirm an audit event.

Example PowerShell (use an existing authorized token):

```powershell
$headers = @{ Authorization = "Bearer <admin-token>"; "Content-Type" = "application/json" }
Invoke-RestMethod -Headers $headers -Uri "http://localhost:5000/api/admin/og-agent/email/sources"
Invoke-RestMethod -Method Post -Headers $headers -Uri "http://localhost:5000/api/admin/og-agent/email/extractions" -Body '{"sourceId":"career-applications","targetTypes":["GROWER","BUYER"],"maximumMessages":25,"ignorePreviouslyProcessed":true}'
```

## Troubleshooting

- **No source:** verify the existing authorized sync/configuration and synchronized records.
- **Search/extraction disabled:** a SUPER_ADMIN must enable the relevant setting.
- **No messages:** broaden bounded filters; fake results are never generated.
- **Candidate changed:** review and request a new approval.
- **Approval expired/consumed:** request a new approval; reuse is forbidden.
- **Duplicate skipped:** inspect its explanation; Phase 2 has no merge override.

## Limitations and Phase 3 extension points

Only previously synchronized `CareerApplication` content is available. Execution is bounded and synchronous because no OG Agent queue exists. Attachments/OCR, CV parsing, Gmail or Microsoft OAuth, IMAP credential entry, website scraping, enrichment, verification APIs, email drafts/replies, campaigns, messaging, telecalling, account/profile conversion, merging, and CRM outreach are intentionally excluded.

Future providers can implement the read-only adapter. Any Phase 3 write capability requires separate least-privilege authorization, consent, policy, approval, audit, and idempotency controls.
