# Business Mail Architecture

## Scope

Phase 4A adds an isolated backend foundation for future Admin Panel business email. It does not add an API route or user interface.

`apps/backend/services/mailService.js` remains the compatibility boundary for OTP, authentication, account verification, and password-reset email. Business Mail does not import auth controllers, access OTP state, or alter those flows.

## Structure

- `BusinessMailService.js` validates internal requests, resolves sender profiles, selects the configured provider, and returns normalized results.
- `senderProfiles.js` owns the backend sender allowlist. Callers provide a profile key, never a From address.
- `BrevoBusinessMailProvider.js` uses Brevo Transactional Email API v3 through Node's built-in `fetch`.
- `SmtpBusinessMailProvider.js` uses Nodemailer with certificate validation enabled.
- `EmailDeliveryLog.js` stores delivery metadata when MongoDB is already connected. Body content, credentials, and raw provider responses are never stored.

Phase 4B exposes protected backend APIs but still does not add an Admin Panel user interface.

## Phase 4B protected endpoints

All endpoints are mounted below `/api/admin/business-mail` and pass through the existing admin JWT, role, active-status, and admin-class checks.

- `GET /status`
- `GET /sender-profiles`
- `POST /send`
- `GET /logs`
- `GET /logs/:id`

`SUPER_ADMIN`, `ADMIN`, `SUPPORT_EXECUTIVE`, and `SALES_EXECUTIVE` may access the module. Sales executives can only list or view delivery logs they requested. Backend checks are authoritative; no frontend route or menu exists yet.

The status endpoint performs no remote provider request and returns only the selected provider, configured readiness, enabled profile keys, and Phase 4B capability flags. Ordinary authorized admins receive enabled sender profiles only; super admins may inspect safe disabled profiles.

## Send request

The accepted JSON shape is:

```json
{
  "senderProfileKey": "EFRUITMANDI_NO_REPLY",
  "to": "recipient@example.com",
  "subject": "Subject",
  "text": "Plain-text content",
  "html": "<p>HTML content</p>",
  "category": "GENERAL",
  "metadata": {
    "source": "ADMIN_PANEL",
    "correlationId": "optional-reference"
  },
  "idempotencyKey": "optional-client-generated-key"
}
```

Unknown top-level fields fail closed. Categories are limited to `GENERAL`, `CAREER`, `SUPPORT`, `ADMIN_NOTICE`, `USER_COMMUNICATION`, and `INTERNAL_TEST`. Recipient arrays, multiple-address separators, arbitrary sender/provider configuration, CC, BCC, attachments, templates, and scheduling are rejected.

Maximum sizes are 320 characters for the recipient, 200 for subject, 100,000 for text, 150,000 for HTML, 50 for category and metadata source, and 128 for correlation and idempotency keys.

## Restrictive HTML gate

Phase 4B applies a temporary restrictive validation gate before the Phase 4A service receives API-originated HTML. It allows basic structural/text/table markup and safe `http`, `https`, and `mailto` links. It rejects unknown tags and attributes, active form/media elements, scripts, frames, SVG/MathML, event handlers, script protocols, `srcdoc`, dangerous CSS expressions, refresh behavior, and obvious encoded or whitespace-obfuscated active content.

This gate is deliberately not described as a complete sanitizer. A reviewed HTML sanitizer remains required before advanced rich-text capabilities are introduced.

## Rate limits

Only `POST /send` uses the Business Mail limiter. Attempts count before payload/provider processing, so malformed and failed-provider attempts also consume capacity.

- Per admin: 10 attempts per 10 minutes.
- Per admin: 50 attempts per rolling 24 hours.
- Global: 100 attempts per rolling hour.

The limits can be adjusted with `BUSINESS_MAIL_ADMIN_WINDOW_MS`, `BUSINESS_MAIL_ADMIN_MAX_SENDS`, `BUSINESS_MAIL_ADMIN_DAILY_WINDOW_MS`, `BUSINESS_MAIL_ADMIN_DAILY_MAX`, `BUSINESS_MAIL_GLOBAL_WINDOW_MS`, and `BUSINESS_MAIL_GLOBAL_MAX_SENDS`.

Limiter state is process-local and resets on restart. It is not distributed; a shared backing store is required before horizontally scaled sending.

## Idempotency and delivery lifecycle

An optional idempotency key is scoped by authenticated admin. Only its SHA-256 hash is persisted, under a database-backed unique compound index. The raw key is never stored or returned.

- Existing `PROCESSING`: HTTP 409 without resending.
- Existing `SENT`: HTTP 200 safe replay without resending.
- Existing `FAILED`: HTTP 409 requiring a new key.
- No key: every request is independent.

The controller creates an `EmailDeliveryLog` as `PROCESSING` before calling the provider, then updates it to `SENT` or `FAILED`. Logs contain addressing, subject, provider/status, controlled metadata, admin attribution, timestamps, and bounded failure summaries. Text/HTML bodies, credentials, provider payloads, stack traces, SMTP configuration, and OTPs are not stored.

If a provider accepts an email but the subsequent `SENT` log update fails, the API still reports provider acceptance and emits a safe server log. The database record may remain `PROCESSING`; this is an unavoidable ambiguity until transactional/outbox delivery is introduced.

Log listing supports bounded pagination and validated status, provider, sender profile, category, and ISO date filters. API responses are explicit safe-field projections and never expose idempotency hashes.

Concise send-requested, sent, failed, and detail-view audit entries reuse the existing embedded admin audit structure, capped to the latest 200 entries.

## Provider selection

`BUSINESS_MAIL_PROVIDER` accepts only:

- `brevo_api` (default)
- `smtp`

Brevo requires backend-only `BREVO_API_KEY` and uses `BUSINESS_MAIL_TIMEOUT_MS` with a 15-second default.

SMTP prefers a complete Business Mail credential set:

- `BUSINESS_SMTP_HOST`
- `BUSINESS_SMTP_PORT`
- `BUSINESS_SMTP_SECURE`
- `BUSINESS_SMTP_USER`
- `BUSINESS_SMTP_PASS`

Host, port, and secure mode may fall back to `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE`. Credentials fall back only when both `SMTP_USER` and `SMTP_PASS` are present. Platform-specific OTP credentials are never borrowed. TLS certificate validation remains enabled, and port 587 requires TLS.

## Sender profiles

All profiles are disabled by default and must be explicitly enabled:

- `EFRUITMANDI_NO_REPLY`
- `ORCHARD_NO_REPLY`
- `EFRUITMANDI_CAREER`
- `ORCHARD_CAREER`

Each profile supports `_ENABLED`, `_EMAIL`, `_NAME`, and `_REPLY_TO` environment variables under its `BUSINESS_MAIL_...` prefix. Safe domain sender defaults exist, but enabling a profile does not imply that Brevo or an SMTP server has verified or authorized it.

Career profiles default Reply-To to their own reply-capable address. No-reply profiles use their configured Reply-To or the corresponding existing support-email configuration.

## Phase 4A validation

- Exactly one To recipient.
- Valid normalized email addresses.
- Non-empty subject with no CR/LF characters.
- At least plain text or HTML.
- CC, BCC, attachments, arbitrary sender objects, request-selected providers, and request-supplied credentials are rejected.
- Metadata accepts only `source` and `correlationId`.
- Provider responses are normalized and raw responses are not returned.
- No automatic retries.

HTML remains accepted at the internal service boundary. Phase 4B adds a restrictive API validation gate, but a reviewed sanitizer is still required before advanced rich-text capabilities.

## Safe test commands

Run from `apps/backend`:

```sh
node scripts/testBusinessMailService.js --inspect
```

Inspect mode is the default and never sends email. It prints only provider readiness and enabled profile keys.

A real test is deliberately explicit and has no default recipient:

```sh
node scripts/testBusinessMailService.js --send --to=user@example.com --sender-profile=EFRUITMANDI_NO_REPLY
```

Operators should run send mode only after verifying provider credentials, sender authorization, and the intended recipient. Recipient output is masked and no secret values are printed.

Protected API status example from PowerShell, using placeholders only:

```powershell
$headers = @{ Authorization = "Bearer <ADMIN_JWT>" }
Invoke-RestMethod -Method Get -Uri "https://<BACKEND_HOST>/api/admin/business-mail/status" -Headers $headers
```

Protected send-shape example (do not run against a real recipient during automated testing):

```powershell
$headers = @{ Authorization = "Bearer <ADMIN_JWT>"; "Content-Type" = "application/json" }
$body = @{
  senderProfileKey = "EFRUITMANDI_NO_REPLY"
  to = "recipient@example.com"
  subject = "Controlled example"
  text = "Placeholder content"
  category = "INTERNAL_TEST"
  idempotencyKey = "<CLIENT_GENERATED_KEY>"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "https://<BACKEND_HOST>/api/admin/business-mail/send" -Headers $headers -Body $body
```

Automated Phase 4A/4B tests mock the provider boundary and never send production email.

## Deferred work

- Admin Panel Business Mail UI and richer composer workflow.
- Rich-text editing and HTML sanitization.
- Attachments, CC, BCC, bulk recipients, scheduling, templates, and automatic retries.
- Brevo delivery webhooks and open/click/bounce tracking.
- Approval workflow, send quotas, and provider-specific sender verification.
