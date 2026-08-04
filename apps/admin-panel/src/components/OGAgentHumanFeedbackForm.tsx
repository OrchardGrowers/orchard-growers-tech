import { useState, type FormEvent } from 'react';
import type { OGAgentApi } from '../services/ogAgentApi';
import type { OGAgentApproval, OGAgentAssessment, OGAgentFeedbackInput, OGAgentReviewDecision } from '../types/ogAgent';

type Props = { api: OGAgentApi; approval: OGAgentApproval; onSubmitted: () => Promise<void> | void };
const decisions: OGAgentReviewDecision[] = ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'REJECT_AND_TEACH', 'REQUEST_REVISION', 'ESCALATE_FOR_REVIEW'];
const assessments: OGAgentAssessment[] = ['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT', 'RISKY', 'NEEDS_MORE_INFORMATION'];
const taskId = (approval: OGAgentApproval) => typeof approval.taskId === 'string' ? approval.taskId : approval.taskId?._id;

export default function OGAgentHumanFeedbackForm({ api, approval, onSubmitted }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [condition, setCondition] = useState('');
  const [form, setForm] = useState<OGAgentFeedbackInput>({
    taskId: taskId(approval) || '', approvalId: approval._id, proposalVersion: approval.proposalVersion || 1,
    proposalHash: approval.proposalHash || undefined, reviewDecision: 'APPROVE', assessment: 'CORRECT', summary: '',
    benefits: '', harms: '', missedContext: '', misunderstoodContext: '', correction: '', futureGuidance: '',
    confidence: 80, reusable: false, guidanceScope: 'TASK_TYPE', specialistReviewRequired: false,
    humanImpact: { severity: 'NONE', affectedGroups: [] }, conditions: [],
  });
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    const payload = { ...form, conditions: form.reviewDecision === 'APPROVE_WITH_CONDITIONS' ? [{ condition, verificationType: 'MANUAL_CONFIRMATION' as const }] : [] };
    if (!window.confirm(`Submit ${form.reviewDecision.replace(/_/g, ' ').toLowerCase()} for this exact proposal version? This decision is audited and cannot silently activate reusable guidance.`)) return;
    setBusy(true);
    try { await api.submitStructuredFeedback(payload); await onSubmitted(); setOpen(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Structured review failed safely.'); }
    finally { setBusy(false); }
  };
  if (!taskId(approval)) return <p className="mt-3 text-xs text-amber-200">This system-level activation uses the explicit legacy approval control; structured task feedback is unavailable.</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Open structured assessment</button>;
  const input = 'rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-emerald-500';
  return <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-emerald-800 bg-slate-950/80 p-4">
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold text-slate-300">Decision<select className={input} value={form.reviewDecision} onChange={(e) => setForm({ ...form, reviewDecision: e.target.value as OGAgentReviewDecision })}>{decisions.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-bold text-slate-300">Assessment<select className={input} value={form.assessment} onChange={(e) => setForm({ ...form, assessment: e.target.value as OGAgentAssessment })}>{assessments.map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    <label className="grid gap-1 text-xs font-bold text-slate-300">Review summary<textarea required maxLength={4000} rows={3} className={input} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-slate-300">Benefits<textarea rows={2} className={input} value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} /></label><label className="grid gap-1 text-xs font-bold text-slate-300">Possible harms<textarea rows={2} className={input} value={form.harms} onChange={(e) => setForm({ ...form, harms: e.target.value })} /></label></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-slate-300">Missed context<textarea rows={2} className={input} value={form.missedContext} onChange={(e) => setForm({ ...form, missedContext: e.target.value })} /></label><label className="grid gap-1 text-xs font-bold text-slate-300">Misunderstood context<textarea rows={2} className={input} value={form.misunderstoodContext} onChange={(e) => setForm({ ...form, misunderstoodContext: e.target.value })} /></label></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-slate-300">Correction<textarea rows={2} className={input} value={form.correction} onChange={(e) => setForm({ ...form, correction: e.target.value })} /></label><label className="grid gap-1 text-xs font-bold text-slate-300">Future guidance<textarea rows={2} className={input} value={form.futureGuidance} onChange={(e) => setForm({ ...form, futureGuidance: e.target.value })} /></label></div>
    {form.reviewDecision === 'APPROVE_WITH_CONDITIONS' && <label className="grid gap-1 text-xs font-bold text-amber-200">Verifiable condition<input required className={input} value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="Example: Manager confirms the final recipient list" /></label>}
    <div className="grid gap-3 sm:grid-cols-3"><label className="grid gap-1 text-xs font-bold text-slate-300">Human-impact severity<select className={input} value={form.humanImpact?.severity} onChange={(e) => setForm({ ...form, humanImpact: { ...form.humanImpact, severity: e.target.value as NonNullable<OGAgentFeedbackInput['humanImpact']>['severity'] } })}>{['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((v) => <option key={v}>{v}</option>)}</select></label><label className="grid gap-1 text-xs font-bold text-slate-300">Confidence ({form.confidence}%)<input type="range" min="0" max="100" value={form.confidence} onChange={(e) => setForm({ ...form, confidence: Number(e.target.value) })} /></label><label className="flex items-center gap-2 text-xs font-bold text-slate-300"><input type="checkbox" checked={form.specialistReviewRequired} onChange={(e) => setForm({ ...form, specialistReviewRequired: e.target.checked })} /> Specialist review required</label></div>
    <label className="flex items-center gap-2 text-xs font-bold text-slate-300"><input type="checkbox" checked={form.reusable} onChange={(e) => setForm({ ...form, reusable: e.target.checked })} /> Propose this as reusable learning (creates an inactive draft only)</label>
    {error && <p className="text-xs font-bold text-rose-300">{error}</p>}
    <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50">{busy ? 'Submitting…' : 'Confirm structured review'}</button><button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-black text-slate-200">Cancel</button></div>
  </form>;
}
