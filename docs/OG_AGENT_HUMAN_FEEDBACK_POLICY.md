# OG Agent Human Feedback Policy

## Purpose

Human feedback improves the quality and human awareness of OG Agent recommendations. It does not increase the agent’s authority. Every reviewer remains responsible for checking the exact proposal, source evidence, affected people, conditions, and downstream action before deciding.

## Required review

A structured review records an assessment and a decision. The summary explains the decision. Teaching or revision decisions include a correction or future guidance. A risky assessment identifies the harm and its severity. Critical impact is escalated to a specialist and cannot be ordinarily approved.

Reviewers consider employees, growers, buyers, callers, administrators, privacy, consent, fairness, accessibility/language, repeated-contact burden, misleading claims, financial loss, and company reputation. Unknown impact should be marked `NEEDS_MORE_INFORMATION`, not guessed.

## Conditional approval

Conditions must be explicit and verifiable. An approval condition is not a suggestion: execution remains blocked until it is satisfied and recorded. Changing the proposal, scope, recipient set, patch, command, dataset, prompt/rule hash, or other material snapshot requires fresh approval.

## Reuse and conflicts

Marking feedback reusable only proposes an inactive draft. A separate authorized review is required before examples or guidance can become active. Scope must be no broader than the evidence supports.

Conflicting feedback is preserved with reviewer and source context. The system must not silently select a majority, discard minority feedback, or activate guidance from a conflict. Resolved guidance links all material source evidence.

## Privacy and security

Do not paste passwords, access tokens, API keys, private keys, unnecessary full emails, raw production dumps, or unrelated personal data. The backend redacts common secret patterns and treats instruction-like feedback as untrusted data. Redaction is defense in depth, not permission to submit sensitive content.

Feedback must never instruct OG Agent to reveal prompts, bypass approval, disable security, expand permissions, self-enable tools, modify its own production code, push/merge Git, deploy, or perform another prohibited action. Such content is rejected or neutralized and should be audited.

## Retention and correction

Submitted feedback is immutable evidence. Amendments create a linked superseding record. Withdrawal stops future evidence use while retaining the historical record. Negative feedback, conflicts, evaluation failures, and rolled-back versions must not be deleted or rewritten.

## Roles

Admins may submit and review feedback according to backend permissions. Management permissions cover examples, guidance, proposals, datasets, and evaluations. Only `SUPER_ADMIN` may activate or roll back reviewed versions. UI visibility never substitutes for route-level authorization.

## Prohibited uses

Human feedback and improvement metrics must not autonomously make legal decisions, discipline employees, reject candidates, commit funds, contact people, change production data, or deploy software. These uses require separately designed workflows, lawful authority, and explicit human control.
