# OG Agent Phase 1

## Purpose

OG Agent is Orchard Growers Private Limited's internal, approval-based AI operations assistant. Phase 1 provides a safe foundation for task planning, analysis previews, read-only report generation, human approvals, settings, and full audit history. It does not contact external systems or perform autonomous actions.

## Architecture

The Admin Panel page at `/orchard-ai/og-agent` uses the existing admin token and authenticated `fetch` convention. Requests are served under `/api/admin/og-agent` by the existing Express server. MongoDB stores tasks, approvals, settings, and append-only audit records.

The backend is layered as follows:

1. `ogAgentRoutes.js` applies existing authentication, active-admin validation, and OG Agent permissions.
2. `ogAgentController.js` validates HTTP input and formats responses.
3. `ogAgentOrchestrator.js` enforces lifecycle transitions.
4. The planner selects a centrally registered tool.
5. The execution service invokes a provider through `generateTaskPlan`, `executeTask`, and `generateSummary` methods.
6. `mockAIProvider.js` produces deterministic structured demo output without a paid API or external connection.
7. The audit service redacts sensitive metadata keys before persistence.

## Models

### OGAgentTask

Stores the title, task type, prompt, requesting admin, status, risk level, structured plan, structured result, failure reason, lifecycle timestamps, and Mongoose timestamps.

### OGAgentApproval

Stores one pending approval per task/action, action preview, risk level, decision, reviewer, note, and timestamps. Decisions use an atomic `PENDING` condition to prevent a duplicate decision.

### OGAgentAuditLog

Stores the optional task, actor, event type, action, safe details/metadata, IP address, user agent, and timestamps. Password-, token-, secret-, authorization-, cookie-, and API-key-like metadata keys are redacted.

### OGAgentSettings

Uses the singleton key `company`. The backend permanently forces email sending, AI calling, code execution, and production deployment to `false` in Phase 1.

## Routes

All routes require an active existing Admin account.

| Method | Route | Permission |
| --- | --- | --- |
| POST | `/api/admin/og-agent/tasks` | Create task |
| GET | `/api/admin/og-agent/tasks` | View agent |
| GET | `/api/admin/og-agent/tasks/:taskId` | View agent |
| POST | `/api/admin/og-agent/tasks/:taskId/plan` | Create task |
| POST | `/api/admin/og-agent/tasks/:taskId/run` | Run task |
| POST | `/api/admin/og-agent/tasks/:taskId/cancel` | Create task |
| GET | `/api/admin/og-agent/approvals` | View agent |
| GET | `/api/admin/og-agent/approvals/:approvalId` | View agent |
| POST | `/api/admin/og-agent/approvals/:approvalId/approve` | Review approval |
| POST | `/api/admin/og-agent/approvals/:approvalId/reject` | Review approval |
| GET | `/api/admin/og-agent/audit-logs` | View audit |
| GET | `/api/admin/og-agent/settings` | View agent |
| PATCH | `/api/admin/og-agent/settings` | Change settings |
| GET | `/api/admin/og-agent/tools` | View agent |

List endpoints use the repository's `page` and `limit` query convention. Tasks also support `status`, `taskType`, and `search`.

## Permissions

- `SUPER_ADMIN`: view, create, plan, run, cancel, review approvals, view audit logs, and change settings.
- `ADMIN`: view, create, plan, run, cancel, and view audit logs/settings.
- Other existing roles: no OG Agent access. Denied authenticated attempts are audited.

The UI applies the same role visibility, but backend permission checks are authoritative.

## Task lifecycle

```text
DRAFT -> PLANNING -> QUEUED -> RUNNING -> COMPLETED
                  -> WAITING_APPROVAL -> QUEUED
PLANNING -> FAILED
RUNNING -> FAILED
DRAFT | QUEUED | WAITING_APPROVAL -> CANCELLED
```

Invalid transitions return HTTP 409. A prohibited request is marked `FAILED` with a safe blocked-action result and audit entry.

## Approval lifecycle

The `external_action_demo` tool is the only medium-risk Phase 1 tool. Planning a General task whose prompt includes `external action demo` creates a `PENDING` approval and moves the task to `WAITING_APPROVAL`.

- Approval moves the task to `QUEUED`.
- Rejection moves the task to `CANCELLED`.
- A decision cannot be made twice.
- Even after approval, the demo explicitly performs no external action.

## Tool registry

| Tool | Risk | Approval | Behavior |
| --- | --- | --- | --- |
| `general_analysis` | Low | No | Prompt-only structured analysis |
| `report_generation` | Low | No | Read-only report from supplied text |
| `telecalling_preparation` | Low | No | Script and objection preparation; no call |
| `coding_analysis_preview` | Low | No | Scope/risk/implementation preview; no code access or change |
| `external_action_demo` | Medium | Yes | Approval workflow demonstration; no external action |

The registry does not expose email sending, calls, code writes, terminal commands, production database mutation, record deletion, payments, deployment, merge, or Git push tools.

## Disabled capabilities

The following are prohibited in Phase 1: email sending, AI calls, code writes or execution, terminal execution, production database mutation, destructive deletion, payments, production deployment, branch merge, and Git push. The planner detects direct requests for these capabilities, blocks them, and records an audit event.

## Environment variables

Phase 1 adds no environment variables and no frontend secret. It uses the existing backend MongoDB/JWT configuration and the Admin Panel's existing `VITE_API_BASE_URL`. A future real provider must keep its credentials exclusively in backend environment configuration.

## Local testing

1. Configure the existing backend `.env` with the normal local MongoDB and JWT settings.
2. Run `npm test -- --run services/og-agent/ogAgentPhase1.test.js controllers/ogAgentController.test.js routes/ogAgentRoutes.test.js middleware/ogAgentPermissions.test.js` in `apps/backend`.
3. Start the backend with `npm run dev`.
4. Start the Admin Panel with `npm run dev` in `apps/admin-panel`.
5. Sign in as `SUPER_ADMIN` or `ADMIN` and open Orchard Growers AI → OG Agent.
6. Create a Report Generation task, inspect its plan, confirm Run, and inspect the structured result/timeline.
7. Create a General task containing `external action demo`; confirm it waits for approval. A Super Admin can approve or reject it.
8. Try a prompt such as `deploy to production`; confirm the task is blocked and audited.
9. As Super Admin, toggle an allowed setting and confirm an audit event appears.
10. Send a PATCH request attempting to set a locked capability to `true`; confirm the response still reports it as `false`.

## Future Phase 2 integration points

Future providers can implement the existing provider methods without changing controllers or UI. New integrations must be separately reviewed and may include OpenAI, business email OAuth, consent-based lead research, approved public-data sources, telephony, GitHub analysis, Search Console, Analytics, Calendar, WhatsApp, or Razorpay reporting. Each new tool needs an explicit registry entry, permission, setting, risk classification, approval policy, validation, audit events, and focused tests.

## Rollback guidance

1. Remove the `/api/admin/og-agent` registration from `server.js` to disable backend access immediately.
2. Remove the `orchardAiOgAgent` Admin Panel route/menu entry to hide the UI.
3. Revert OG Agent-only files; no existing business model was extended or migrated.
4. Preserve `og_agent_audit_logs` for incident/audit retention. Only delete OG Agent collections after an authorized retention review and backup.

No deployment automation, dependency, lockfile change, commit, or Git push is part of Phase 1.
