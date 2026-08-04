import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import OGAgentEmailIntelligence from './OGAgentEmailIntelligence';
import OGAgentTelecalling from './OGAgentTelecalling';
import OGAgentCoding from './OGAgentCoding';
import OGAgentImprovement from './OGAgentImprovement';
import OGAgentHumanFeedbackForm from './OGAgentHumanFeedbackForm';
import OGAgentResearch from './OGAgentResearch';
import { createOGAgentApi } from '../services/ogAgentApi';
import type {
  OGAgentApproval,
  OGAgentAuditLog,
  OGAgentRiskLevel,
  OGAgentSettings,
  OGAgentTask,
  OGAgentTaskDetails,
  OGAgentTaskStatus,
  OGAgentTaskType,
  OGAgentTool,
} from '../types/ogAgent';

type OGAgentProps = {
  apiBase: string;
  authHeaders: Record<string, string>;
  adminRole: string;
};

type Notice = { type: 'success' | 'error'; message: string };
type OGAgentSection = 'Agent' | 'Email Intelligence' | 'Lead Review' | 'Business Leads' | 'Telecalling' | 'Follow-ups' | 'Coding Agent' | 'Improvement' | 'Research Agent' | 'Approvals' | 'Audit Logs' | 'Settings';
const managerSections: OGAgentSection[] = ['Agent', 'Email Intelligence', 'Lead Review', 'Business Leads', 'Telecalling', 'Follow-ups', 'Coding Agent', 'Improvement', 'Research Agent', 'Approvals', 'Audit Logs', 'Settings'];
type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'emerald' | 'rose';
  noteLabel?: string;
  noteRequired?: boolean;
  onConfirm: (note: string) => Promise<void>;
};

const taskTypeOptions: { value: OGAgentTaskType; label: string; future?: boolean }[] = [
  { value: 'GENERAL', label: 'General Assistant' },
  { value: 'EMAIL_ANALYSIS', label: 'Email Analysis', future: true },
  { value: 'GROWER_RESEARCH', label: 'Grower Research', future: true },
  { value: 'BUYER_RESEARCH', label: 'Buyer Research', future: true },
  { value: 'TELECALLING_PREPARATION', label: 'Telecalling Preparation' },
  { value: 'CODING_ANALYSIS', label: 'Coding Analysis' },
  { value: 'SEO_ANALYSIS', label: 'SEO Analysis' },
  { value: 'REPORT_GENERATION', label: 'Report Generation' },
];

const taskTypeLabel = (value: OGAgentTaskType) => taskTypeOptions.find((option) => option.value === value)?.label || value;
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not available';
const getPersonLabel = (person?: OGAgentTask['requestedBy'] | null) => {
  if (!person) return 'System';
  if (typeof person === 'string') return person;
  return person.name || person.email || 'Admin';
};
const getTaskFromApproval = (approval: OGAgentApproval) => typeof approval.taskId === 'string' ? null : approval.taskId;

const statusColors: Record<OGAgentTaskStatus, string> = {
  DRAFT: 'border-slate-600 bg-slate-800 text-slate-200',
  QUEUED: 'border-sky-700 bg-sky-950 text-sky-200',
  PLANNING: 'border-violet-700 bg-violet-950 text-violet-200',
  WAITING_APPROVAL: 'border-amber-700 bg-amber-950 text-amber-200',
  RUNNING: 'border-cyan-700 bg-cyan-950 text-cyan-200',
  COMPLETED: 'border-emerald-700 bg-emerald-950 text-emerald-200',
  FAILED: 'border-rose-700 bg-rose-950 text-rose-200',
  CANCELLED: 'border-slate-600 bg-slate-900 text-slate-400',
};

const riskColors: Record<OGAgentRiskLevel, string> = {
  LOW: 'border-emerald-700 bg-emerald-950 text-emerald-200',
  MEDIUM: 'border-amber-700 bg-amber-950 text-amber-200',
  HIGH: 'border-rose-700 bg-rose-950 text-rose-200',
};

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black tracking-wide ${className}`}>{children}</span>;
}

function StatusBadge({ status }: { status: OGAgentTaskStatus }) {
  return <Badge className={statusColors[status]}>{status.replace(/_/g, ' ')}</Badge>;
}

function RiskBadge({ risk }: { risk: OGAgentRiskLevel }) {
  return <Badge className={riskColors[risk]}>{risk} RISK</Badge>;
}

function ReadableValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === '') return <span className="text-slate-500">Not provided</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'string' || typeof value === 'number') return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2 pl-5">
        {value.map((item, index) => <li key={index} className="list-disc"><ReadableValue value={item} depth={depth + 1} /></li>)}
      </ul>
    );
  }
  if (typeof value === 'object') {
    return (
      <div className={`grid gap-2 ${depth === 0 ? 'sm:grid-cols-2' : ''}`}>
        {Object.entries(value as Record<string, unknown>).map(([key, item]) => (
          <div key={key} className="min-w-0 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
            <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">{key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}</p>
            <div className="text-xs leading-5 text-slate-200"><ReadableValue value={item} depth={depth + 1} /></div>
          </div>
        ))}
      </div>
    );
  }
  return <span>{String(value)}</span>;
}

export default function OGAgent({ apiBase, authHeaders, adminRole }: OGAgentProps) {
  const api = useMemo(() => createOGAgentApi(apiBase, authHeaders), [apiBase, authHeaders]);
  const composerRef = useRef<HTMLDivElement>(null);
  const [tasks, setTasks] = useState<OGAgentTask[]>([]);
  const [approvals, setApprovals] = useState<OGAgentApproval[]>([]);
  const [auditLogs, setAuditLogs] = useState<OGAgentAuditLog[]>([]);
  const [settings, setSettings] = useState<OGAgentSettings | null>(null);
  const [tools, setTools] = useState<OGAgentTool[]>([]);
  const [details, setDetails] = useState<OGAgentTaskDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmationNote, setConfirmationNote] = useState('');
  const isCallingManager = adminRole === 'SUPER_ADMIN' || adminRole === 'ADMIN';
  const [activeSection, setActiveSection] = useState<OGAgentSection>(isCallingManager ? 'Agent' : 'Telecalling');
  const [telecallingConfig, setTelecallingConfig] = useState({ allowTelephoneLinks: false });
  const [selectedExtractionId, setSelectedExtractionId] = useState('');
  const [draft, setDraft] = useState<{ title: string; taskType: OGAgentTaskType; prompt: string }>({
    title: '', taskType: 'GENERAL', prompt: '',
  });
  const canManageSafety = adminRole === 'SUPER_ADMIN';

  const loadDashboard = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const [taskResponse, approvalResponse, auditResponse, settingsResponse, toolsResponse] = await Promise.all([
        api.listTasks(), api.listApprovals(), api.listAuditLogs(), api.getSettings(), api.listTools(),
      ]);
      setTasks(taskResponse.data || []);
      setApprovals(approvalResponse.data || []);
      setAuditLogs(auditResponse.data || []);
      setSettings(settingsResponse.data);
      setTools(toolsResponse.data || []);
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Could not load OG Agent.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isCallingManager) void loadDashboard(); else void api.getTelecallingConfig().then((response) => setTelecallingConfig(response.data)).catch((error) => setNotice({ type: 'error', message: error instanceof Error ? error.message : 'Could not load telecalling configuration.' })); }, [api, isCallingManager]);

  const refreshDetails = async (taskId: string) => {
    const response = await api.getTask(taskId);
    setDetails(response.data);
  };

  const runBusy = async (key: string, action: () => Promise<void>) => {
    setBusyAction(key);
    setNotice(null);
    try {
      await action();
    } catch (error) {
      setNotice({ type: 'error', message: error instanceof Error ? error.message : 'OG Agent action failed safely.' });
    } finally {
      setBusyAction('');
    }
  };

  const createAndPlan = async (event: FormEvent) => {
    event.preventDefault();
    await runBusy('create', async () => {
      const created = await api.createTask(draft);
      await api.planTask(created.data._id);
      setDraft({ title: '', taskType: 'GENERAL', prompt: '' });
      setNotice({ type: 'success', message: 'Task created and safe plan generated.' });
      await loadDashboard(false);
      await refreshDetails(created.data._id);
    });
  };

  const planExistingTask = (task: OGAgentTask) => void runBusy(`plan-${task._id}`, async () => {
    await api.planTask(task._id);
    setNotice({ type: 'success', message: 'Safe task plan generated.' });
    await loadDashboard(false);
    if (details?.task._id === task._id) await refreshDetails(task._id);
  });

  const requestRun = (task: OGAgentTask) => {
    setConfirmationNote('');
    setConfirmation({
      title: 'Run this safe task?',
      message: 'The Phase 1 mock provider will generate analysis or recommendations only. No email, call, code change, payment, database mutation, Git action, or deployment can occur.',
      confirmLabel: 'Run safe task',
      onConfirm: async () => {
        await api.runTask(task._id);
        setNotice({ type: 'success', message: 'Task completed in analysis-only mode.' });
        await loadDashboard(false);
        if (details?.task._id === task._id) await refreshDetails(task._id);
      },
    });
  };

  const requestCancel = (task: OGAgentTask) => {
    setConfirmationNote('');
    setConfirmation({
      title: 'Cancel this task?',
      message: 'The task will be marked cancelled and retained for audit purposes.',
      confirmLabel: 'Cancel task',
      tone: 'rose',
      onConfirm: async () => {
        await api.cancelTask(task._id);
        setNotice({ type: 'success', message: 'Task cancelled and audit history retained.' });
        setDetails(null);
        await loadDashboard(false);
      },
    });
  };

  const requestApprovalDecision = (approval: OGAgentApproval, decision: 'approve' | 'reject') => {
    const isCodingApproval = ['CODE_ANALYSIS_SCOPE', 'CODE_PATCH_GENERATION', 'CODE_PATCH_APPLICATION', 'HIGH_RISK_CODE_PATCH_APPLICATION', 'SAFE_COMMAND_EXECUTION', 'CODE_PATCH_REVERT'].includes(approval.actionType);
    setConfirmationNote('');
    setConfirmation({
      title: `${decision === 'approve' ? 'Approve' : 'Reject'} this request?`,
      message: approval.actionType === 'LEAD_IMPORT'
        ? (decision === 'approve'
          ? 'Approval authorizes one import of only the immutable candidate snapshot shown here. Exact duplicates are checked again before insertion.'
          : 'Rejection prevents the lead import and returns its candidates to review while retaining the audit trail.')
        : isCodingApproval
          ? (decision === 'approve'
            ? 'Approval authorizes only the exact Coding Agent snapshot displayed here. State, hash, scope, permissions, and safety rules are revalidated before any consequential action.'
            : 'Rejection blocks this exact Coding Agent action without changing repository files.')
        : (decision === 'approve'
          ? 'Approval only unlocks the registered Phase 1 demonstration. It cannot enable or perform a real external action.'
          : 'Rejection cancels the associated task while retaining its full audit trail.'),
      confirmLabel: decision === 'approve' ? 'Approve request' : 'Reject request',
      tone: decision === 'approve' ? 'emerald' : 'rose',
      noteLabel: 'Reviewer note',
      noteRequired: decision === 'reject',
      onConfirm: async (note) => {
        await api.decideApproval(approval._id, decision, note);
        setNotice({ type: 'success', message: `Approval ${decision === 'approve' ? 'approved' : 'rejected'} safely.` });
        await loadDashboard(false);
      },
    });
  };

  const updateSetting = (key: keyof OGAgentSettings, value: boolean | number) => void runBusy(`setting-${key}`, async () => {
    const response = await api.updateSettings({ [key]: value });
    setSettings(response.data);
    setNotice({ type: 'success', message: 'OG Agent safety setting updated and audited.' });
    await loadDashboard(false);
  });

  const confirmAction = async () => {
    if (!confirmation || (confirmation.noteRequired && !confirmationNote.trim())) return;
    const action = confirmation;
    setConfirmation(null);
    await runBusy('confirmation', () => action.onConfirm(confirmationNote.trim()));
  };

  const summary = {
    total: tasks.length,
    waiting: tasks.filter((task) => task.status === 'WAITING_APPROVAL').length,
    completed: tasks.filter((task) => task.status === 'COMPLETED').length,
    failed: tasks.filter((task) => task.status === 'FAILED').length,
  };
  const selectedType = taskTypeOptions.find((option) => option.value === draft.taskType);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-emerald-800 bg-gradient-to-br from-emerald-950 to-slate-950 p-5 shadow-lg shadow-black/20">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black text-white">OG Agent</h1>
            <Badge className={(settings?.agentEnabled || !isCallingManager) ? riskColors.LOW : statusColors.CANCELLED}>{(settings?.agentEnabled || !isCallingManager) ? 'ACTIVE' : 'PAUSED'}</Badge>
          </div>
          <p className="mt-1 text-sm font-semibold text-emerald-200">AI Operations Assistant for Orchard Growers</p>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-slate-400">Safe task planning, read-only email intelligence, human-assisted telecalling, and a controlled repository Coding Agent with exact human approvals.</p>
        </div>
        {isCallingManager && <button type="button" onClick={() => { setActiveSection('Agent'); setTimeout(() => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500">+ New Task</button>}
      </header>

      <nav aria-label="OG Agent sections" className="flex gap-1 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-2">
        {(isCallingManager ? managerSections : ['Telecalling', 'Follow-ups'] as OGAgentSection[]).map((section) => <button key={section} type="button" onClick={() => setActiveSection(section)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black transition ${activeSection === section ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{section}</button>)}
      </nav>

      {notice && (
        <div role="status" className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-700 bg-emerald-950 text-emerald-100' : 'border-rose-700 bg-rose-950 text-rose-100'}`}>
          <span>{notice.message}</span>
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      {activeSection === 'Agent' && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl border border-slate-700 bg-slate-900" />) : (
          <>
            <SummaryCard label="Total tasks" value={summary.total} color="text-white" />
            <SummaryCard label="Waiting approvals" value={summary.waiting} color="text-amber-300" />
            <SummaryCard label="Completed" value={summary.completed} color="text-emerald-300" />
            <SummaryCard label="Failed / blocked" value={summary.failed} color="text-rose-300" />
          </>
        )}
      </div>

      <div ref={composerRef} className="scroll-mt-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-black text-white">Agent chat / task composer</h2>
          <p className="text-xs text-slate-400">Describe the outcome you want. OG Agent will save the request and prepare a reviewable plan.</p>
        </div>
        <form onSubmit={createAndPlan} className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold text-slate-300">
            Task title
            <input required minLength={3} maxLength={160} value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" placeholder="Example: Prepare weekly buyer activity report" />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300">
            Task type
            <select value={draft.taskType} onChange={(event) => setDraft((current) => ({ ...current, taskType: event.target.value as OGAgentTaskType }))} className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500">
              {taskTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-300 lg:col-span-2">
            Detailed instruction / prompt
            <textarea required minLength={10} maxLength={12000} rows={6} value={draft.prompt} onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))} className="resize-y rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-emerald-500" placeholder="Include the scope, available context, constraints, and desired output. Do not include passwords, tokens, API keys, or private authentication data." />
          </label>
          {selectedType?.future && <p className="rounded-lg border border-sky-800 bg-sky-950 px-3 py-2 text-xs leading-5 text-sky-200 lg:col-span-2">Connection will be available in a future phase. Current mode generates a safe preparation or analysis preview only.</p>}
          <div className="flex flex-wrap items-center gap-3 lg:col-span-2">
            <button type="submit" disabled={busyAction === 'create' || !settings?.agentEnabled} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{busyAction === 'create' ? 'Creating plan…' : 'Create and Plan'}</button>
            {!settings?.agentEnabled && <span className="text-xs font-bold text-amber-300">The agent is paused. A Super Admin can enable it in safety settings.</span>}
          </div>
        </form>
      </div>

      <TaskTable tasks={tasks} loading={loading} busyAction={busyAction} onView={(task) => void runBusy(`view-${task._id}`, () => refreshDetails(task._id))} onPlan={planExistingTask} onRun={requestRun} onCancel={requestCancel} />
      </>}

      {(['Email Intelligence', 'Lead Review', 'Business Leads'] as OGAgentSection[]).includes(activeSection) && <OGAgentEmailIntelligence api={api} mode={activeSection as 'Email Intelligence' | 'Lead Review' | 'Business Leads'} canApprove={canManageSafety} selectedExtractionId={selectedExtractionId} onSelectExtraction={setSelectedExtractionId} onOpenLeadReview={(id) => { setSelectedExtractionId(id); setActiveSection('Lead Review'); }} onRefreshApprovals={() => loadDashboard(false)} />}

      {(activeSection === 'Telecalling' || activeSection === 'Follow-ups') && <OGAgentTelecalling api={api} mode={activeSection} isManager={isCallingManager} allowTelephoneLinks={settings?.allowTelephoneLinks ?? telecallingConfig.allowTelephoneLinks} />}

      {activeSection === 'Coding Agent' && <OGAgentCoding api={api} adminRole={adminRole} onOpenApprovals={() => setActiveSection('Approvals')} />}

      {activeSection === 'Improvement' && <OGAgentImprovement api={api} />}

      {activeSection === 'Research Agent' && <OGAgentResearch api={api} adminRole={adminRole} onOpenApprovals={() => setActiveSection('Approvals')} />}

      {activeSection === 'Approvals' && <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-lg font-black text-white">Pending approvals</h2><p className="text-xs text-slate-400">Medium-risk workflow demonstrations remain blocked pending human review.</p></div>
          {!canManageSafety && <Badge className={riskColors.MEDIUM}>SUPER ADMIN REVIEW REQUIRED</Badge>}
        </div>
        {approvals.length === 0 ? <EmptyState text="No approval requests are waiting." /> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {approvals.map((approval) => {
              const task = getTaskFromApproval(approval);
              return (
                <article key={approval._id} className="rounded-xl border border-amber-800 bg-amber-950/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-black text-white">{approval.actionTitle}</h3><p className="mt-1 text-xs text-slate-300">Task: {task?.title || 'OG Agent task'}</p></div><RiskBadge risk={approval.riskLevel} /></div>
                  <p className="mt-3 text-xs leading-5 text-slate-300">{approval.actionDescription}</p>
                  <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3"><ReadableValue value={approval.actionPreview} /></div>
                  <p className="mt-3 text-[11px] text-slate-500">Requested {formatDate(approval.createdAt)}</p>
                  {canManageSafety && (approval.taskId && !['LEAD_IMPORT', 'RESEARCH_LEAD_IMPORT', 'RESEARCH_PLAN_EXECUTION', 'CODE_ANALYSIS_SCOPE', 'CODE_PATCH_GENERATION', 'CODE_PATCH_APPLICATION', 'HIGH_RISK_CODE_PATCH_APPLICATION', 'SAFE_COMMAND_EXECUTION', 'CODE_PATCH_REVERT'].includes(approval.actionType)
                    ? <OGAgentHumanFeedbackForm api={api} approval={approval} onSubmitted={() => loadDashboard(false)} />
                    : <div className="mt-3 flex gap-2"><button type="button" onClick={() => requestApprovalDecision(approval, 'approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white">Approve exact snapshot</button><button type="button" onClick={() => requestApprovalDecision(approval, 'reject')} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-black text-white">Reject</button></div>)}
                </article>
              );
            })}
          </div>
        )}
      </section>}

      {activeSection === 'Settings' && settings && <SafetySettings settings={settings} tools={tools} canManage={canManageSafety} busyAction={busyAction} onChange={updateSetting} />}

      {activeSection === 'Audit Logs' && <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h2 className="text-lg font-black text-white">Recent agent activity</h2>
        <p className="mb-4 text-xs text-slate-400">Latest audit events across OG Agent.</p>
        {auditLogs.length === 0 ? <EmptyState text="No OG Agent activity has been recorded yet." /> : <Timeline logs={auditLogs.slice(0, 12)} />}
      </section>}

      <aside className="rounded-xl border border-amber-700 bg-amber-950/50 p-4 text-sm leading-6 text-amber-100">
        <strong>OG Agent safety notice:</strong> Email Intelligence is read-only and permanent leads require approval. Telecalling is human-assisted only. Coding Agent cannot read secrets, execute arbitrary commands, install packages, commit, push, merge, deploy, discard working-tree changes, or apply an unapproved patch.
      </aside>

      {details && <TaskDetailsModal details={details} busyAction={busyAction} onClose={() => setDetails(null)} onRun={requestRun} onCancel={requestCancel} />}
      {confirmation && <ConfirmationModal confirmation={confirmation} note={confirmationNote} busy={busyAction === 'confirmation'} onNoteChange={setConfirmationNote} onCancel={() => setConfirmation(null)} onConfirm={() => void confirmAction()} />}
    </section>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return <article className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black ${color}`}>{value}</p></article>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 p-8 text-center text-sm font-semibold text-slate-500">{text}</div>;
}

function TaskTable({ tasks, loading, busyAction, onView, onPlan, onRun, onCancel }: { tasks: OGAgentTask[]; loading: boolean; busyAction: string; onView: (task: OGAgentTask) => void; onPlan: (task: OGAgentTask) => void; onRun: (task: OGAgentTask) => void; onCancel: (task: OGAgentTask) => void }) {
  const cancellable = new Set<OGAgentTaskStatus>(['DRAFT', 'QUEUED', 'WAITING_APPROVAL']);
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
      <h2 className="text-lg font-black text-white">Recent tasks</h2><p className="mb-4 text-xs text-slate-400">Saved MongoDB task records and their current lifecycle state.</p>
      {loading ? <div className="h-40 animate-pulse rounded-lg bg-slate-800" /> : tasks.length === 0 ? <EmptyState text="No tasks yet. Create your first safe analysis task above." /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="border-b border-slate-700 text-slate-500"><tr><th className="px-3 py-3">Task</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Risk</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Requested by</th><th className="px-3 py-3">Created</th><th className="px-3 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-800">{tasks.map((task) => (
          <tr key={task._id} className="align-top hover:bg-slate-800/40"><td className="max-w-[260px] px-3 py-3"><p className="font-black text-white">{task.title}</p><p className="mt-1 line-clamp-2 break-words text-slate-500">{task.prompt}</p></td><td className="px-3 py-3 font-bold text-slate-300">{taskTypeLabel(task.taskType)}</td><td className="px-3 py-3"><RiskBadge risk={task.riskLevel} /></td><td className="px-3 py-3"><StatusBadge status={task.status} /></td><td className="px-3 py-3 text-slate-300">{getPersonLabel(task.requestedBy)}</td><td className="px-3 py-3 text-slate-400">{formatDate(task.createdAt)}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-1"><ActionButton label="View" onClick={() => onView(task)} disabled={busyAction === `view-${task._id}`} />{task.status === 'DRAFT' && <ActionButton label="Plan" onClick={() => onPlan(task)} disabled={busyAction === `plan-${task._id}`} />}{task.status === 'QUEUED' && <ActionButton label="Run" onClick={() => onRun(task)} />}{cancellable.has(task.status) && <ActionButton label="Cancel" tone="rose" onClick={() => onCancel(task)} />}</div></td></tr>
        ))}</tbody></table></div>
      )}
    </section>
  );
}

function ActionButton({ label, onClick, disabled, tone = 'slate' }: { label: string; onClick: () => void; disabled?: boolean; tone?: 'slate' | 'rose' }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`rounded-md px-2 py-1.5 text-[11px] font-black disabled:opacity-50 ${tone === 'rose' ? 'border border-rose-800 bg-rose-950 text-rose-200' : 'border border-slate-600 bg-slate-800 text-slate-100 hover:border-emerald-600'}`}>{label}</button>;
}

function SafetySettings({ settings, tools, canManage, busyAction, onChange }: { settings: OGAgentSettings; tools: OGAgentTool[]; canManage: boolean; busyAction: string; onChange: (key: keyof OGAgentSettings, value: boolean | number) => void }) {
  const toggles: { key: keyof OGAgentSettings; label: string; description: string; locked?: boolean }[] = [
    { key: 'agentEnabled', label: 'Agent enabled', description: 'Allows safe task planning and mock execution.' },
    { key: 'allowReadOnlyDatabaseSearch', label: 'Read-only analysis', description: 'Enables prompt-based analysis; no production database query is implemented.' },
    { key: 'allowReportGeneration', label: 'Report generation', description: 'Creates reports from text supplied in the task.' },
    { key: 'allowTelecallingPreparation', label: 'Telecalling preparation', description: 'Creates scripts only; never starts a call.' },
    { key: 'allowCallingCampaigns', label: 'Calling campaigns', description: 'Creates internal human calling queues only.' },
    { key: 'allowCallQueueAssignment', label: 'Call queue assignment', description: 'Allows manager-controlled internal assignments.' },
    { key: 'allowCallOutcomeRecording', label: 'Call outcome recording', description: 'Allows telecallers to save user-confirmed outcomes.' },
    { key: 'allowFollowUpManagement', label: 'Follow-up management', description: 'Allows explicit follow-up creation and completion.' },
    { key: 'allowCallScriptGeneration', label: 'Call script generation', description: 'Creates deterministic preparation scripts only.' },
    { key: 'allowBusinessLeadFieldVerification', label: 'Business Lead field verification', description: 'Managers may explicitly confirm corrected Business Lead fields.' },
    { key: 'allowLeadStatusUpdateFromCall', label: 'Lead status update from call', description: 'Allows conservative status mapping only with explicit confirmation.' },
    { key: 'allowTelephoneLinks', label: 'Telephone links', description: 'Shows frontend-only tel: links; no connection tracking.' },
    { key: 'requireManagerApprovalForBulkCampaign', label: 'Require highest-admin approval for bulk campaign', description: 'Restricts activation to the highest admin role.' },
    { key: 'codingAgentEnabled', label: 'Controlled Coding Agent', description: 'Master switch for approved repository analysis and patch workflows.' },
    { key: 'allowRepositoryRead', label: 'Repository reads', description: 'Bounded text-only reads inside task scopes with denied-file enforcement.' },
    { key: 'allowRepositorySearch', label: 'Repository search', description: 'Bounded on-demand safe-text search inside task scopes.' },
    { key: 'allowCodingAnalysis', label: 'Coding analysis', description: 'Structured analysis from sanitized repository evidence.' },
    { key: 'allowPatchGeneration', label: 'Patch generation', description: 'Allows approved immutable unified-diff proposals.' },
    { key: 'allowPatchApplication', label: 'Patch application', description: 'Allows exact approved patch apply after state checks and dry-run.' },
    { key: 'allowSafeCommandExecution', label: 'Safe command execution', description: 'Only backend-registered fixed command IDs can run.' },
    { key: 'allowFileCreation', label: 'File creation in patch', description: 'Allows approved text file creation inside task scope.' },
    { key: 'improvementEngineEnabled', label: 'Controlled improvement engine', description: 'Enables reviewed feedback, proposals, and bounded evaluation workflows.' },
    { key: 'allowFeedbackCollection', label: 'Structured feedback collection', description: 'Records immutable human assessments with human-impact fields.' },
    { key: 'allowProposalRevision', label: 'Proposal revisions', description: 'Creates new review-only proposal versions without executing them.' },
    { key: 'allowApprovedExampleRetrieval', label: 'Approved example retrieval', description: 'Retrieves only active, bounded examples applicable to the task.' },
    { key: 'allowOrganizationalGuidanceRetrieval', label: 'Organizational guidance retrieval', description: 'Retrieves only active, security-reviewed guidance.' },
    { key: 'allowImprovementPatternAnalysis', label: 'Improvement pattern analysis', description: 'Read-only analysis across preserved feedback evidence.' },
    { key: 'allowImprovementProposalGeneration', label: 'Improvement proposal generation', description: 'Creates drafts only after evidence thresholds are met.' },
    { key: 'allowEvaluationRuns', label: 'Evaluation runs', description: 'Runs bounded internal datasets before activation.' },
    { key: 'allowPromptVersionCreation', label: 'Prompt version creation', description: 'Allows inactive prompt proposals with immutable hashes.' },
    { key: 'allowRuleVersionCreation', label: 'Rule version creation', description: 'Allows inactive rule proposals; security rules remain immutable.' },
    { key: 'requireApprovalForApprovedExampleActivation', label: 'Example activation approval', description: 'Explicit approval required before retrieval.', locked: true },
    { key: 'requireApprovalForGuidanceActivation', label: 'Guidance activation approval', description: 'Explicit approval required before retrieval.', locked: true },
    { key: 'requireApprovalForPromptActivation', label: 'Prompt activation approval', description: 'Exact evaluated version approval required.', locked: true },
    { key: 'requireApprovalForRuleActivation', label: 'Rule activation approval', description: 'Exact evaluated version approval required.', locked: true },
    { key: 'requireApprovalForRollback', label: 'Rollback approval', description: 'Rollback remains a high-risk human decision.', locked: true },
    { key: 'allowAutomaticPromptActivation', label: 'Automatic prompt activation — Locked', description: 'Feedback can never activate prompts automatically.', locked: true },
    { key: 'allowAutomaticRuleActivation', label: 'Automatic rule activation — Locked', description: 'Feedback can never activate rules automatically.', locked: true },
    { key: 'allowAutomaticPermissionChange', label: 'Automatic permission change — Locked', description: 'The agent cannot expand its authority.', locked: true },
    { key: 'allowAutomaticToolEnablement', label: 'Automatic tool enablement — Locked', description: 'Disabled tools cannot self-enable.', locked: true },
    { key: 'allowAutomaticSecurityPolicyChange', label: 'Security policy change — Locked', description: 'Security controls cannot be learned away.', locked: true },
    { key: 'allowAutomaticApprovalBypass', label: 'Approval bypass — Locked', description: 'Approval requirements remain enforced.', locked: true },
    { key: 'allowAutomaticCodeModification', label: 'Self-code modification — Locked', description: 'Improvement proposals cannot modify production code.', locked: true },
    { key: 'allowAutomaticDeployment', label: 'Automatic deployment — Locked', description: 'Production deployment is out of scope.', locked: true },
    { key: 'allowFeedbackDeletion', label: 'Feedback deletion — Locked', description: 'Feedback may be withdrawn or superseded, never deleted.', locked: true },
    { key: 'allowHistoricalRewrite', label: 'Historical rewrite — Locked', description: 'Version and feedback history is preserved.', locked: true },
    { key: 'researchAgentEnabled', label: 'Research Agent', description: 'Master switch for approved public website and API research.' },
    { key: 'allowPublicWebsiteResearch', label: 'Public website research', description: 'Only active allowlisted domains and paths.' },
    { key: 'allowApprovedApiResearch', label: 'Approved API research', description: 'Only configured connectors and endpoints.' },
    { key: 'allowWebsitePageFetch', label: 'Approved webpage fetch', description: 'SSRF, robots, terms, rate, type, and size policies apply.' },
    { key: 'allowApiFetch', label: 'Approved API fetch', description: 'Backend constructs the URL, query, and credential headers.' },
    { key: 'allowPublicBusinessContactExtraction', label: 'Public business contact extraction', description: 'Requires source permission and human review.' },
    { key: 'allowLeadCandidateCreation', label: 'Research lead candidates', description: 'Creates temporary candidates only.' },
    { key: 'requireApprovalForContactExtraction', label: 'Contact extraction approval', description: 'Plans collecting contacts require human approval.' },
    { key: 'requireActiveSourceReview', label: 'Require current source review', description: 'Expired or prohibited reviews block collection.' },
    { key: 'allowPersonalContactExtraction', label: 'Personal contact extraction — Locked', description: 'Research is limited to business/organization/public-office context.', locked: true },
    { key: 'allowPdfCollection', label: 'PDF collection — Locked', description: 'Unrestricted PDF ingestion is not included.', locked: true },
    { key: 'allowPrivateProfileCollection', label: 'Private profile collection — Locked', description: 'Private profiles are never scraped.', locked: true },
    { key: 'allowCaptchaBypass', label: 'CAPTCHA bypass — Locked', description: 'CAPTCHA stops collection.', locked: true },
    { key: 'allowLoginBypass', label: 'Login bypass — Locked', description: 'Login and access controls are never bypassed.', locked: true },
    { key: 'allowProxyEvasion', label: 'Proxy evasion — Locked', description: 'No rotating/residential proxies or rate-limit evasion.', locked: true },
    { key: 'allowArbitraryUrlFetch', label: 'Arbitrary URL fetch — Locked', description: 'Every request must match an active source allowlist.', locked: true },
    { key: 'allowExternalFormSubmission', label: 'External form submission — Locked', description: 'Research never modifies external websites.', locked: true },
    { key: 'allowAutomaticOutreach', label: 'Automatic outreach — Locked', description: 'No extracted contact is messaged automatically.', locked: true },
    { key: 'allowUnapprovedApiCall', label: 'Unapproved API call — Locked', description: 'Only configured connectors can execute.', locked: true },
    { key: 'allowSourcePolicyOverrideByAgent', label: 'Source-policy override — Locked', description: 'Feedback and source content cannot weaken legal/security policy.', locked: true },
    { key: 'requireApprovalForPatchGeneration', label: 'Patch generation approval — Locked', description: 'Exact approval is mandatory before a proposal is generated.', locked: true },
    { key: 'requireApprovalForPatchApplication', label: 'Patch application approval — Locked', description: 'Exact approval is mandatory before any write.', locked: true },
    { key: 'requireAdditionalApprovalForHighRiskFiles', label: 'Additional high-risk approval — Locked', description: 'A second exact approval is mandatory for sensitive code paths.', locked: true },
    { key: 'requireApprovalForBuild', label: 'Build command approval', description: 'Build command IDs require approval.' },
    { key: 'requireApprovalForTests', label: 'Test command approval', description: 'Test command IDs require approval.' },
    { key: 'requireApprovalForLint', label: 'Lint command approval', description: 'Lint command IDs require approval.' },
    { key: 'allowEmailSearch', label: 'Email search enabled', description: 'Allows bounded metadata search over the authorized synchronized mailbox.' },
    { key: 'allowEmailLeadExtraction', label: 'Email lead extraction enabled', description: 'Allows safe content analysis and temporary review candidates.' },
    { key: 'requireApprovalForLeadImport', label: 'Require approval for lead import — Locked', description: 'Always enforced by the backend.', locked: true },
    { key: 'allowCandidateEditing', label: 'Candidate editing', description: 'Allows admins to correct temporary extracted fields before approval.' },
    { key: 'allowBusinessLeadStatusUpdates', label: 'Business Lead status updates', description: 'Allows audited lifecycle status changes after import.' },
    { key: 'allowEmailDraftCreation', label: 'Email draft creation — Locked', description: 'Unavailable in Phase 2.', locked: true },
    { key: 'allowEmailSending', label: 'Email sending — Locked', description: 'Always disabled by the backend.', locked: true },
    { key: 'allowMailboxModification', label: 'Mailbox modification — Locked', description: 'Delete, archive, label, read-state, and move operations are disabled.', locked: true },
    { key: 'allowAutomaticAccountCreation', label: 'Automatic account creation — Locked', description: 'Business Leads never create user accounts automatically.', locked: true },
    { key: 'allowAutomaticExistingRecordUpdate', label: 'Automatic existing-record update — Locked', description: 'Duplicates may be skipped or reviewed, never merged automatically.', locked: true },
    { key: 'allowAICalling', label: 'AI calling — Locked', description: 'Always disabled by the backend.', locked: true },
    { key: 'allowCallRecording', label: 'Call recording — Locked', description: 'No audio or microphone access.', locked: true },
    { key: 'allowSMS', label: 'SMS — Locked', description: 'No SMS sending.', locked: true },
    { key: 'allowWhatsAppSending', label: 'WhatsApp sending — Locked', description: 'No WhatsApp sending.', locked: true },
    { key: 'allowAutomaticEmailSending', label: 'Automatic email sending — Locked', description: 'No follow-up email is sent.', locked: true },
    { key: 'allowCodeExecution', label: 'Code execution — Locked', description: 'Always disabled by the backend.', locked: true },
    { key: 'allowFileDeletion', label: 'File deletion — Locked', description: 'Coding Agent cannot delete files.', locked: true },
    { key: 'allowFileRename', label: 'File rename — Locked', description: 'Coding Agent cannot rename files.', locked: true },
    { key: 'allowLockfileModification', label: 'Lockfile modification — Locked', description: 'package-lock.json changes are rejected.', locked: true },
    { key: 'allowDependencyInstallation', label: 'Dependency installation — Locked', description: 'No package manager install actions.', locked: true },
    { key: 'allowArbitraryTerminal', label: 'Arbitrary terminal — Locked', description: 'Executable text and arguments are rejected.', locked: true },
    { key: 'allowSecretFileRead', label: 'Secret file access — Locked', description: '.env, credentials, keys, tokens, dumps, and private data are denied.', locked: true },
    { key: 'allowGitCommit', label: 'Git commit — Locked', description: 'Commits remain manual.', locked: true },
    { key: 'allowGitPush', label: 'Git push — Locked', description: 'Remote pushes remain manual.', locked: true },
    { key: 'allowGitMerge', label: 'Git merge — Locked', description: 'Merges remain manual.', locked: true },
    { key: 'allowLocalBranchCreation', label: 'Local branch creation — Locked', description: 'No branch write route is exposed in Phase 4.', locked: true },
    { key: 'allowDatabaseWrite', label: 'Database write — Locked', description: 'Production data mutation is prohibited.', locked: true },
    { key: 'allowProductionDeployment', label: 'Production deployment — Locked', description: 'Always disabled by the backend.', locked: true },
  ];
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black text-white">Agent safety settings</h2><p className="text-xs text-slate-400">Locked capabilities cannot be enabled through frontend manipulation or the API.</p></div>{!canManage && <Badge className={statusColors.CANCELLED}>READ ONLY</Badge>}</div>
      <div className="grid gap-3 lg:grid-cols-2">{toggles.map((toggle) => {
        const enabled = Boolean(settings[toggle.key]);
        return <div key={toggle.key} className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3"><div><p className="text-sm font-black text-white">{toggle.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{toggle.description}</p></div><button type="button" role="switch" aria-checked={enabled} aria-label={toggle.label} disabled={!canManage || toggle.locked || busyAction === `setting-${toggle.key}`} onClick={() => onChange(toggle.key, !enabled)} className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? 'bg-emerald-600' : 'bg-slate-700'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${enabled ? 'left-6' : 'left-1'}`} /></button></div>;
      })}</div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <NumericSetting label="Maximum messages per extraction" description="Conservative bounded mailbox batch size (1–250)." value={settings.maximumMessagesPerExtraction} min={1} max={250} disabled={!canManage || busyAction === 'setting-maximumMessagesPerExtraction'} onChange={(value) => onChange('maximumMessagesPerExtraction', value)} />
        <NumericSetting label="Minimum default confidence" description="Candidates below this percentage require manual verification and are not selected automatically." value={settings.minimumDefaultConfidence} min={0} max={100} disabled={!canManage || busyAction === 'setting-minimumDefaultConfidence'} onChange={(value) => onChange('minimumDefaultConfidence', value)} />
        <NumericSetting label="Maximum leads per campaign" description="Hard campaign queue bound (1–1000)." value={settings.maximumLeadsPerCampaign} min={1} max={1000} disabled={!canManage || busyAction === 'setting-maximumLeadsPerCampaign'} onChange={(value) => onChange('maximumLeadsPerCampaign', value)} />
        <NumericSetting label="Active queue items per telecaller" description="Assignment safety bound (1–500)." value={settings.maximumActiveQueueItemsPerTelecaller} min={1} max={500} disabled={!canManage || busyAction === 'setting-maximumActiveQueueItemsPerTelecaller'} onChange={(value) => onChange('maximumActiveQueueItemsPerTelecaller', value)} />
        <NumericSetting label="Queue lock minutes" description="Short expiring edit lock (1–60 minutes)." value={settings.queueLockMinutes} min={1} max={60} disabled={!canManage || busyAction === 'setting-queueLockMinutes'} onChange={(value) => onChange('queueLockMinutes', value)} />
        <NumericSetting label="Default retry days" description="Suggested retry interval; a user must still confirm the date." value={settings.defaultRetryDays} min={1} max={90} disabled={!canManage || busyAction === 'setting-defaultRetryDays'} onChange={(value) => onChange('defaultRetryDays', value)} />
        <NumericSetting label="Minimum call note length" description="Required note length for material outcomes." value={settings.minimumCallNoteLength} min={0} max={500} disabled={!canManage || busyAction === 'setting-minimumCallNoteLength'} onChange={(value) => onChange('minimumCallNoteLength', value)} />
        <NumericSetting label="Coding files per task" description="Maximum bounded files considered during discovery (1–500)." value={settings.maximumFilesPerTask} min={1} max={500} disabled={!canManage || busyAction === 'setting-maximumFilesPerTask'} onChange={(value) => onChange('maximumFilesPerTask', value)} />
        <NumericSetting label="Bytes per repository file" description="Maximum safe text file size (1 KB–1 MB)." value={settings.maximumBytesPerFile} min={1024} max={1000000} disabled={!canManage || busyAction === 'setting-maximumBytesPerFile'} onChange={(value) => onChange('maximumBytesPerFile', value)} />
        <NumericSetting label="Total read bytes per coding task" description="Cumulative analysis read budget." value={settings.maximumTotalReadBytesPerTask} min={1024} max={10000000} disabled={!canManage || busyAction === 'setting-maximumTotalReadBytesPerTask'} onChange={(value) => onChange('maximumTotalReadBytesPerTask', value)} />
        <NumericSetting label="Maximum patch bytes" description="Unified diff size limit." value={settings.maximumPatchBytes} min={1024} max={2000000} disabled={!canManage || busyAction === 'setting-maximumPatchBytes'} onChange={(value) => onChange('maximumPatchBytes', value)} />
        <NumericSetting label="Maximum patch files" description="Changed-file count limit (1–100)." value={settings.maximumPatchFiles} min={1} max={100} disabled={!canManage || busyAction === 'setting-maximumPatchFiles'} onChange={(value) => onChange('maximumPatchFiles', value)} />
        <NumericSetting label="Maximum command output bytes" description="Combined bounded stdout/stderr preview limit." value={settings.maximumCommandOutputBytes} min={1024} max={500000} disabled={!canManage || busyAction === 'setting-maximumCommandOutputBytes'} onChange={(value) => onChange('maximumCommandOutputBytes', value)} />
        <NumericSetting label="Command timeout seconds" description="Hard command timeout (5–600 seconds)." value={settings.commandTimeoutSeconds} min={5} max={600} disabled={!canManage || busyAction === 'setting-commandTimeoutSeconds'} onChange={(value) => onChange('commandTimeoutSeconds', value)} />
        <NumericSetting label="Concurrent command runs" description="Global safe-command concurrency (1–4)." value={settings.maximumConcurrentCommandRuns} min={1} max={4} disabled={!canManage || busyAction === 'setting-maximumConcurrentCommandRuns'} onChange={(value) => onChange('maximumConcurrentCommandRuns', value)} />
        <NumericSetting label="Minimum feedback for proposal" description="Default cross-task evidence threshold." value={settings.minimumFeedbackForImprovementProposal} min={1} max={100} disabled={!canManage} onChange={(value) => onChange('minimumFeedbackForImprovementProposal', value)} />
        <NumericSetting label="Minimum reviewers for guidance" description="Distinct human evidence requirement." value={settings.minimumReviewersForOrganizationGuidance} min={1} max={20} disabled={!canManage} onChange={(value) => onChange('minimumReviewersForOrganizationGuidance', value)} />
        <NumericSetting label="Maximum retrieved examples" description="Bounded context limit." value={settings.maximumRetrievedExamples} min={1} max={20} disabled={!canManage} onChange={(value) => onChange('maximumRetrievedExamples', value)} />
        <NumericSetting label="Maximum retrieved guidance" description="Bounded context limit." value={settings.maximumRetrievedGuidance} min={1} max={20} disabled={!canManage} onChange={(value) => onChange('maximumRetrievedGuidance', value)} />
        <NumericSetting label="Maximum revision attempts" description="Prevents unbounded proposal loops." value={settings.maximumRevisionAttempts} min={1} max={10} disabled={!canManage} onChange={(value) => onChange('maximumRevisionAttempts', value)} />
        <NumericSetting label="Regression alert threshold" description="Percentage threshold for review alerts." value={settings.regressionAlertThreshold} min={0} max={100} disabled={!canManage} onChange={(value) => onChange('regressionAlertThreshold', value)} />
        <NumericSetting label="Harmful recommendation threshold" description="Percentage threshold for human-impact alerts." value={settings.harmfulRecommendationAlertThreshold} min={0} max={100} disabled={!canManage} onChange={(value) => onChange('harmfulRecommendationAlertThreshold', value)} />
        <NumericSetting label="Research approval page threshold" description="Plans above this page count require review." value={settings.requireApprovalAbovePageLimit} min={1} max={100} disabled={!canManage} onChange={(value) => onChange('requireApprovalAbovePageLimit', value)} />
        <NumericSetting label="Research sources per task" description="Global source-count bound." value={settings.maximumSourcesPerTask} min={1} max={20} disabled={!canManage} onChange={(value) => onChange('maximumSourcesPerTask', value)} />
        <NumericSetting label="Research pages per task" description="Global page/request bound." value={settings.maximumPagesPerTask} min={1} max={1000} disabled={!canManage} onChange={(value) => onChange('maximumPagesPerTask', value)} />
        <NumericSetting label="Research records per task" description="Temporary extraction record bound." value={settings.maximumRecordsPerTask} min={1} max={10000} disabled={!canManage} onChange={(value) => onChange('maximumRecordsPerTask', value)} />
        <NumericSetting label="Research maximum depth" description="Bounded same-domain discovery depth." value={settings.maximumDepth} min={0} max={5} disabled={!canManage} onChange={(value) => onChange('maximumDepth', value)} />
        <NumericSetting label="Research response bytes" description="Maximum bytes per response." value={settings.maximumResponseBytes} min={1024} max={2000000} disabled={!canManage} onChange={(value) => onChange('maximumResponseBytes', value)} />
        <NumericSetting label="Research total bytes" description="Maximum cumulative task bytes." value={settings.maximumTotalBytesPerTask} min={1024} max={20000000} disabled={!canManage} onChange={(value) => onChange('maximumTotalBytesPerTask', value)} />
        <NumericSetting label="Research timeout seconds" description="Network request timeout." value={settings.requestTimeoutSeconds} min={5} max={60} disabled={!canManage} onChange={(value) => onChange('requestTimeoutSeconds', value)} />
        <NumericSetting label="Research minimum delay" description="Minimum delay between source requests in milliseconds." value={settings.minimumDelayMilliseconds} min={0} max={60000} disabled={!canManage} onChange={(value) => onChange('minimumDelayMilliseconds', value)} />
        <NumericSetting label="Research requests per minute" description="Global conservative request rate." value={settings.maximumRequestsPerMinute} min={1} max={600} disabled={!canManage} onChange={(value) => onChange('maximumRequestsPerMinute', value)} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3"><RiskLegend risk="LOW" text="Analysis and drafts" /><RiskLegend risk="MEDIUM" text="Workflow demonstration requiring approval" /><RiskLegend risk="HIGH" text="External or production action; disabled" /></div>
      <div className="mt-4"><p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Registered Phase 1 tools</p><div className="flex flex-wrap gap-2">{tools.map((tool) => <span key={tool.name} title={tool.description} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1 text-[11px] font-bold text-slate-300">{tool.name} · {tool.riskLevel}{tool.approvalRequired ? ' · approval' : ''}</span>)}</div></div>
    </section>
  );
}

function NumericSetting({ label, description, value, min, max, disabled, onChange }: { label: string; description: string; value: number; min: number; max: number; disabled: boolean; onChange: (value: number) => void }) {
  const [draftValue, setDraftValue] = useState(String(value));
  useEffect(() => setDraftValue(String(value)), [value]);
  return <label className="rounded-lg border border-slate-700 bg-slate-950 p-3"><span className="text-sm font-black text-white">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span><input type="number" min={min} max={max} disabled={disabled} value={draftValue} onChange={(event) => setDraftValue(event.target.value)} onBlur={() => { const parsed = Number(draftValue); if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, Math.round(parsed)))); }} className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50" /></label>;
}

function RiskLegend({ risk, text }: { risk: OGAgentRiskLevel; text: string }) {
  return <div className="rounded-lg border border-slate-700 bg-slate-950 p-3"><RiskBadge risk={risk} /><p className="mt-2 text-xs text-slate-400">{text}</p></div>;
}

function Timeline({ logs }: { logs: OGAgentAuditLog[] }) {
  return <ol className="space-y-3">{logs.map((log) => <li key={log._id} className="relative border-l-2 border-emerald-800 pl-4"><span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-emerald-400" /><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-black text-white">{log.action}</p><p className="mt-1 text-xs leading-5 text-slate-400">{log.details || log.eventType.replace(/_/g, ' ')}</p></div><span className="text-[10px] text-slate-500">{formatDate(log.createdAt)}</span></div></li>)}</ol>;
}

function TaskDetailsModal({ details, busyAction, onClose, onRun, onCancel }: { details: OGAgentTaskDetails; busyAction: string; onClose: () => void; onRun: (task: OGAgentTask) => void; onCancel: (task: OGAgentTask) => void }) {
  const task = details.task;
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-label="OG Agent task details"><div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-700 bg-slate-900 p-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black text-white">{task.title}</h2><StatusBadge status={task.status} /><RiskBadge risk={task.riskLevel} /></div><p className="mt-1 text-xs text-slate-400">{taskTypeLabel(task.taskType)} · Requested by {getPersonLabel(task.requestedBy)} · {formatDate(task.createdAt)}</p></div><button type="button" onClick={onClose} aria-label="Close task details" className="rounded-lg border border-slate-600 px-3 py-1 text-xl text-white">×</button></header><div className="space-y-5 p-5">
    <DetailSection title="Original prompt"><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">{task.prompt}</p></DetailSection>
    <DetailSection title="Generated plan">{task.plan.length === 0 ? <EmptyState text="No plan has been generated." /> : <ol className="space-y-3">{task.plan.map((step) => <li key={step.stepNumber} className="rounded-lg border border-slate-700 bg-slate-950 p-3"><div className="flex flex-wrap items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-700 text-xs font-black text-white">{step.stepNumber}</span><h4 className="font-black text-white">{step.title}</h4><RiskBadge risk={step.riskLevel} />{step.approvalRequired && <Badge className={riskColors.MEDIUM}>APPROVAL</Badge>}</div><p className="mt-2 text-xs leading-5 text-slate-400">{step.description}</p><p className="mt-2 text-[10px] font-bold uppercase text-emerald-300">Tool: {step.tool} · {step.status}</p></li>)}</ol>}</DetailSection>
    {task.result?.summary && <DetailSection title="Result"><p className="mb-3 text-sm font-bold leading-6 text-emerald-200">{task.result.summary}</p><ReadableValue value={task.result.data} />{task.result.recommendations && task.result.recommendations.length > 0 && <div className="mt-4"><p className="mb-2 text-xs font-black uppercase text-slate-500">Recommendations</p><ReadableValue value={task.result.recommendations} /></div>}</DetailSection>}
    {task.failureReason && <DetailSection title="Failure / blocked reason"><p className="whitespace-pre-wrap break-words text-sm text-rose-200">{task.failureReason}</p></DetailSection>}
    <DetailSection title="Approval history">{details.approvals.length === 0 ? <EmptyState text="No approval was required." /> : <div className="space-y-2">{details.approvals.map((approval) => <div key={approval._id} className="rounded-lg border border-slate-700 bg-slate-950 p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-black text-white">{approval.actionTitle}</p><Badge className={approval.status === 'APPROVED' ? riskColors.LOW : approval.status === 'REJECTED' ? riskColors.HIGH : riskColors.MEDIUM}>{approval.status}</Badge></div><p className="mt-2 text-xs text-slate-400">{approval.reviewerNote || approval.actionDescription}</p></div>)}</div>}</DetailSection>
    <DetailSection title="Activity timeline"><Timeline logs={details.auditLogs} /></DetailSection>
    <div className="flex flex-wrap gap-2">{task.status === 'QUEUED' && <button type="button" onClick={() => onRun(task)} disabled={busyAction === 'confirmation'} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white">Run task</button>}{(['DRAFT', 'QUEUED', 'WAITING_APPROVAL'] as OGAgentTaskStatus[]).includes(task.status) && <button type="button" onClick={() => onCancel(task)} className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-black text-white">Cancel task</button>}</div>
  </div></div></div>;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return <section><h3 className="mb-2 text-sm font-black uppercase tracking-wide text-slate-500">{title}</h3>{children}</section>;
}

function ConfirmationModal({ confirmation, note, busy, onNoteChange, onCancel, onConfirm }: { confirmation: Confirmation; note: string; busy: boolean; onNoteChange: (value: string) => void; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={confirmation.title}><div className="w-full max-w-lg rounded-xl border border-slate-600 bg-slate-900 p-5 shadow-2xl"><h2 className="text-lg font-black text-white">{confirmation.title}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{confirmation.message}</p>{confirmation.noteLabel && <label className="mt-4 grid gap-1 text-xs font-bold text-slate-300">{confirmation.noteLabel}{confirmation.noteRequired ? ' (required)' : ' (optional)'}<textarea rows={3} maxLength={2000} value={note} onChange={(event) => onNoteChange(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-950 p-3 text-sm text-white" /></label>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-slate-600 px-4 py-2 text-xs font-black text-slate-200">Back</button><button type="button" disabled={busy || Boolean(confirmation.noteRequired && !note.trim())} onClick={onConfirm} className={`rounded-lg px-4 py-2 text-xs font-black text-white disabled:opacity-50 ${confirmation.tone === 'rose' ? 'bg-rose-700' : 'bg-emerald-600'}`}>{busy ? 'Working…' : confirmation.confirmLabel}</button></div></div></div>;
}
