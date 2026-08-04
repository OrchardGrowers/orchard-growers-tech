import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { OGAgentApi } from '../services/ogAgentApi';
import type { OGAgentApproval, OGAgentAdminReference, OGCodeCommand, OGCodePatch, OGCodingConfig, OGCodingTask, OGCodingTaskCategory, OGCodingTaskDetails, OGCodingTargetApplication, OGRepositoryStatus } from '../types/ogAgent';

type Props = { api: OGAgentApi; adminRole: string; onOpenApprovals: () => void };
type View = 'Dashboard' | 'New Task' | 'Tasks' | 'Patch Reviews' | 'Command Runs' | 'Repository Status' | 'Safety Settings';
type Notice = { type: 'success' | 'error'; text: string };

const views: View[] = ['Dashboard', 'New Task', 'Tasks', 'Patch Reviews', 'Command Runs', 'Repository Status', 'Safety Settings'];
const categories: OGCodingTaskCategory[] = ['BUG_FIX', 'FEATURE', 'REFACTOR', 'PERFORMANCE', 'SECURITY_REVIEW', 'SEO', 'UI_UX', 'API', 'DATABASE_ANALYSIS', 'TESTING', 'DOCUMENTATION', 'BUILD_ERROR', 'OTHER'];
const applications: OGCodingTargetApplication[] = ['BACKEND', 'EFRUITMANDI_FRONTEND', 'ADMIN_PANEL', 'SHARED_PACKAGE', 'DOCUMENTATION', 'MULTIPLE'];
const format = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not available';
const label = (value: string) => value.replace(/_/g, ' ');
const taskTitle = (task: OGCodingTask) => typeof task.taskId === 'string' ? `Coding task ${task._id.slice(-6)}` : task.taskId.title;
const person = (value?: OGAgentAdminReference | string | null) => typeof value === 'string' ? value : value?.name || value?.email || 'System';

const initialDraft = {
  title: '', taskCategory: 'BUG_FIX' as OGCodingTaskCategory, targetApplications: ['BACKEND'] as OGCodingTargetApplication[],
  problemDescription: '', currentBehavior: '', expectedBehavior: '', reproductionSteps: '', allowedPaths: ['apps/backend'],
  fileHints: '', constraints: 'Preserve existing APIs\nDo not change unrelated files', allowRepositoryAnalysis: true,
  allowSafeCommands: false, allowPatchGeneration: false, allowPatchApplication: false, highRiskAcknowledged: false,
};

function Pill({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const colors = { slate: 'border-slate-600 bg-slate-800 text-slate-200', green: 'border-emerald-700 bg-emerald-950 text-emerald-200', amber: 'border-amber-700 bg-amber-950 text-amber-200', red: 'border-rose-700 bg-rose-950 text-rose-200', blue: 'border-sky-700 bg-sky-950 text-sky-200' };
  return <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${colors[tone]}`}>{children}</span>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-700 bg-slate-900 p-4"><h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-400">{title}</h3>{children}</section>;
}

export default function OGAgentCoding({ api, adminRole, onOpenApprovals }: Props) {
  const [view, setView] = useState<View>('Dashboard');
  const [config, setConfig] = useState<OGCodingConfig | null>(null);
  const [tasks, setTasks] = useState<OGCodingTask[]>([]);
  const [repository, setRepository] = useState<OGRepositoryStatus | null>(null);
  const [commands, setCommands] = useState<OGCodeCommand[]>([]);
  const [details, setDetails] = useState<OGCodingTaskDetails | null>(null);
  const [selectedPatch, setSelectedPatch] = useState<OGCodePatch | null>(null);
  const [diff, setDiff] = useState('');
  const [patchProposal, setPatchProposal] = useState('');
  const [draft, setDraft] = useState(initialDraft);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState('');
  const canApprove = adminRole === 'SUPER_ADMIN';

  const load = async () => {
    const [configResponse, taskResponse, statusResponse, commandResponse] = await Promise.all([api.getCodingConfig(), api.listCodingTasks(), api.getRepositoryStatus(), api.listCodeCommands()]);
    setConfig(configResponse.data); setTasks(taskResponse.data || []); setRepository(statusResponse.data); setCommands(commandResponse.data || []);
  };
  useEffect(() => { void load().catch((error) => setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Could not load Coding Agent.' })); }, [api]);

  const refreshDetails = async (id: string) => { const response = await api.getCodingTask(id); setDetails(response.data); return response.data; };
  const act = async (key: string, action: () => Promise<void>) => {
    setBusy(key); setNotice(null);
    try { await action(); } catch (error) { setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Coding Agent action stopped safely.' }); }
    finally { setBusy(''); }
  };

  const createTask = (event: FormEvent) => {
    event.preventDefault();
    void act('create', async () => {
      const response = await api.createCodingTask({ ...draft, fileHints: draft.fileHints.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean), constraints: draft.constraints.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) });
      setDraft(initialDraft); await load(); await refreshDetails(response.data._id); setView('Tasks');
      setNotice({ type: 'success', text: 'Controlled coding task created. No repository file was changed.' });
    });
  };

  const openTask = (id: string) => void act(`task-${id}`, async () => { await refreshDetails(id); setSelectedPatch(null); setDiff(''); });
  const runAnalysis = (id: string) => void act('analyze', async () => { await api.analyzeCodingTask(id); await load(); await refreshDetails(id); setNotice({ type: 'success', text: 'Bounded read-only repository analysis completed.' }); });
  const requestPatch = (id: string) => void act('request-patch', async () => { await api.requestPatchGeneration(id); await refreshDetails(id); setNotice({ type: 'success', text: 'Patch-generation approval requested. Review it under Approvals.' }); });
  const generatePatch = (id: string) => void act('generate-patch', async () => {
    const approval = details?.approvals.find((item) => item.actionType === 'CODE_PATCH_GENERATION' && item.status === 'APPROVED' && !details.patches.some((patch) => patch.generationApprovalId === item._id));
    if (!approval) throw new Error('Approve the current patch-generation request first.');
    const response = await api.generateCodePatch(id, approval._id, patchProposal); setPatchProposal(''); await load(); await refreshDetails(id); await openPatch(response.data); setView('Patch Reviews');
    setNotice({ type: 'success', text: 'Unified diff validated and saved as an immutable patch version.' });
  });
  const openPatch = async (patch: OGCodePatch) => {
    setSelectedPatch(patch); setDiff('');
    let offset = 0; let completeDiff = ''; let truncated = true;
    while (truncated) {
      const response = await api.getCodePatchDiff(patch._id, offset);
      completeDiff += response.data.content;
      truncated = response.data.truncated;
      offset += response.data.content.length;
      if (truncated && response.data.content.length === 0) throw new Error('Patch diff pagination stopped before the complete diff was loaded.');
    }
    setDiff(completeDiff);
  };
  const requestApply = (patch: OGCodePatch) => void act('request-apply', async () => { await api.requestPatchApplyApproval(patch._id); if (details) await refreshDetails(details.task._id); setNotice({ type: 'success', text: 'Exact patch application approval requested. High-risk files receive a separate approval.' }); });
  const applyPatch = (patch: OGCodePatch) => void act('apply', async () => {
    if (!window.confirm('Apply only this exact approved patch? The backend will revalidate Git state, overlap, hash, files, and dry-run first.')) return;
    const response = await api.applyCodePatch(patch._id); if (details) await refreshDetails(details.task._id); await load(); setNotice({ type: 'success', text: `Approved patch applied to ${response.data.filesChanged.length} file(s). Nothing was staged or committed.` });
  });
  const requestRevert = (patch: OGCodePatch) => void act('request-revert', async () => { await api.requestPatchRevertApproval(patch._id); if (details) await refreshDetails(details.task._id); setNotice({ type: 'success', text: 'Exact reverse-patch approval requested.' }); });
  const revertPatch = (patch: OGCodePatch) => void act('revert', async () => { if (!window.confirm('Reverse only the OG Coding Agent patch? Later overlapping edits will block this action.')) return; await api.revertCodePatch(patch._id); if (details) await refreshDetails(details.task._id); await load(); setNotice({ type: 'success', text: 'Approved reverse patch applied. No reset, clean, checkout, or commit was used.' }); });
  const decide = (approval: OGAgentApproval, decision: 'approve' | 'reject') => void act(`approval-${approval._id}`, async () => { await api.decideApproval(approval._id, decision, decision === 'reject' ? 'Rejected during Coding Agent technical review.' : 'Exact Coding Agent snapshot reviewed.'); if (details) await refreshDetails(details.task._id); setNotice({ type: 'success', text: `Coding approval ${decision}d.` }); });
  const previewCommand = (command: OGCodeCommand) => void act(`command-${command.commandId}`, async () => {
    if (!details) throw new Error('Open a coding task first.');
    const patchId = details.patches.find((patch) => patch.status === 'APPLIED')?._id;
    const preview = await api.previewCodeCommand(details.task._id, command.commandId, patchId);
    if (preview.data.approvalRequired) setNotice({ type: 'success', text: 'Exact safe-command approval requested. No command ran.' });
    else { await api.runCodeCommand(details.task._id, command.commandId, undefined, patchId, `${details.task._id}-${command.commandId}-${Date.now()}`); setNotice({ type: 'success', text: 'Read-only allowlisted command finished. Review its real exit code below.' }); }
    await refreshDetails(details.task._id);
  });
  const runApprovedCommand = (approval: OGAgentApproval) => void act(`run-${approval._id}`, async () => {
    if (!details) return; const preview = approval.actionPreview as { commandId?: string; patchId?: string };
    if (!preview.commandId) throw new Error('Approval command snapshot is invalid.');
    await api.runCodeCommand(details.task._id, preview.commandId, approval._id, preview.patchId || undefined, `${approval._id}-run`); await refreshDetails(details.task._id); setNotice({ type: 'success', text: 'Approved allowlisted command completed with its actual result recorded.' });
  });

  const summary = useMemo(() => ({ open: tasks.filter((task) => !['CANCELLED', 'COMPLETED'].includes(task.status)).length, patchApprovals: tasks.filter((task) => task.patchStatus === 'WAITING_APPROVAL').length, applied: tasks.filter((task) => task.patchStatus === 'APPLIED').length, failed: tasks.filter((task) => task.validationStatus === 'FAILED' || task.status === 'FAILED').length }), [tasks]);
  const allPatches = details?.patches || [];

  return <div className="space-y-4">
    <div className="rounded-xl border border-cyan-800 bg-cyan-950/40 p-4 text-sm leading-6 text-cyan-100"><strong>Controlled Coding Agent:</strong> works only inside an approved repository scope. It cannot access secrets, push code, merge branches, deploy production, install packages, or execute arbitrary terminal commands.</div>
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-2">{views.map((item) => <button key={item} type="button" onClick={() => setView(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black ${view === item ? 'bg-cyan-700 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{item}</button>)}</nav>
    {notice && <div role="status" className={`flex justify-between rounded-lg border p-3 text-sm font-bold ${notice.type === 'success' ? 'border-emerald-700 bg-emerald-950 text-emerald-100' : 'border-rose-700 bg-rose-950 text-rose-100'}`}><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)}>×</button></div>}

    {view === 'Dashboard' && <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries({ 'Open coding tasks': summary.open, 'Waiting approvals': summary.patchApprovals, 'Applied patches': summary.applied, 'Failed / blocked': summary.failed }).map(([key, value]) => <Card key={key} title={key}><p className="text-3xl font-black text-white">{value}</p></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2"><Card title="Repository status">{repository ? <div className="space-y-2 text-sm text-slate-300"><p><strong>Branch:</strong> {repository.branch || '(detached)'}</p><p><strong>Commit:</strong> <code>{repository.commit.slice(0, 12)}</code></p><p><strong>Working tree:</strong> <Pill tone={repository.dirty ? 'amber' : 'green'}>{repository.dirty ? 'DIRTY — REVIEW REQUIRED' : 'CLEAN'}</Pill></p></div> : <p className="text-slate-500">Loading real repository status…</p>}</Card><Card title="Recent coding tasks"><TaskList tasks={tasks.slice(0, 5)} onOpen={openTask} busy={busy} /></Card></div>
    </div>}

    {view === 'New Task' && <form onSubmit={createTask} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
      <div><h2 className="text-lg font-black text-white">New controlled coding task</h2><p className="text-xs text-slate-400">Analysis is read-only. Patch and command permissions are opt-in per task.</p></div>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Task title"><input required minLength={3} maxLength={160} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="input" /></Field><Field label="Category"><select value={draft.taskCategory} onChange={(event) => setDraft({ ...draft, taskCategory: event.target.value as OGCodingTaskCategory })} className="input">{categories.map((item) => <option key={item}>{item}</option>)}</select></Field></div>
      <Field label="Target applications"><div className="flex flex-wrap gap-2">{applications.map((item) => <Check key={item} label={label(item)} checked={draft.targetApplications.includes(item)} onChange={(checked) => setDraft({ ...draft, targetApplications: checked ? [...draft.targetApplications, item] : draft.targetApplications.filter((value) => value !== item) })} />)}</div></Field>
      <Field label="Problem description"><textarea required minLength={10} rows={4} value={draft.problemDescription} onChange={(event) => setDraft({ ...draft, problemDescription: event.target.value })} className="input" /></Field>
      <div className="grid gap-4 md:grid-cols-2"><Field label="Current behavior"><textarea rows={3} value={draft.currentBehavior} onChange={(event) => setDraft({ ...draft, currentBehavior: event.target.value })} className="input" /></Field><Field label="Expected behavior"><textarea required rows={3} value={draft.expectedBehavior} onChange={(event) => setDraft({ ...draft, expectedBehavior: event.target.value })} className="input" /></Field></div>
      <Field label="Reproduction steps"><textarea rows={3} value={draft.reproductionSteps} onChange={(event) => setDraft({ ...draft, reproductionSteps: event.target.value })} className="input" /></Field>
      <Field label="Allowed repository scopes"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{config?.allowedScopes.map((scope) => <Check key={scope} label={scope} checked={draft.allowedPaths.includes(scope)} onChange={(checked) => setDraft({ ...draft, allowedPaths: checked ? [...draft.allowedPaths, scope] : draft.allowedPaths.filter((value) => value !== scope) })} />)}</div></Field>
      <div className="grid gap-4 md:grid-cols-2"><Field label="File hints (one repository-relative path per line)"><textarea rows={4} value={draft.fileHints} onChange={(event) => setDraft({ ...draft, fileHints: event.target.value })} className="input font-mono text-xs" /></Field><Field label="Constraints (one per line)"><textarea rows={4} value={draft.constraints} onChange={(event) => setDraft({ ...draft, constraints: event.target.value })} className="input" /></Field></div>
      <div className="grid gap-2 md:grid-cols-2"><Check label="Allow read-only repository analysis" checked={draft.allowRepositoryAnalysis} onChange={(value) => setDraft({ ...draft, allowRepositoryAnalysis: value })} /><Check label="Allow safe validation command IDs" checked={draft.allowSafeCommands} onChange={(value) => setDraft({ ...draft, allowSafeCommands: value })} /><Check label="Allow approved patch generation" checked={draft.allowPatchGeneration} onChange={(value) => setDraft({ ...draft, allowPatchGeneration: value, allowPatchApplication: value ? draft.allowPatchApplication : false })} /><Check label="Allow approved patch application" checked={draft.allowPatchApplication} onChange={(value) => setDraft({ ...draft, allowPatchApplication: value, allowPatchGeneration: value || draft.allowPatchGeneration })} /><Check label="I acknowledge explicitly selected high-risk areas require stronger review" checked={draft.highRiskAcknowledged} onChange={(value) => setDraft({ ...draft, highRiskAcknowledged: value })} /></div>
      <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-xs leading-5 text-amber-100">Permanent rules: no secrets, arbitrary terminal, dependency installation, lockfile mutation, file deletion, Git commit/push/merge/reset/clean, database write, or deployment. Existing changes are never discarded.</div>
      <button disabled={busy === 'create' || !draft.allowedPaths.length || !draft.targetApplications.length} className="rounded-lg bg-cyan-700 px-5 py-2 text-sm font-black text-white disabled:opacity-50">{busy === 'create' ? 'Creating…' : 'Create coding task'}</button>
    </form>}

    {view === 'Tasks' && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><Card title="Coding tasks"><TaskList tasks={tasks} onOpen={openTask} busy={busy} /></Card>{details ? <TaskDetail details={details} canApprove={canApprove} busy={busy} patchProposal={patchProposal} setPatchProposal={setPatchProposal} onAnalyze={runAnalysis} onRequestPatch={requestPatch} onGeneratePatch={generatePatch} onOpenPatch={(patch) => void openPatch(patch)} onDecide={decide} onRunApprovedCommand={runApprovedCommand} onOpenApprovals={onOpenApprovals} /> : <Card title="Task detail"><p className="text-sm text-slate-500">Select a task to inspect repository evidence, analysis, patch versions, validation, approvals, and snapshots.</p></Card>}</div>}

    {view === 'Patch Reviews' && <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]"><Card title="Patch versions">{allPatches.length ? <div className="space-y-2">{allPatches.map((patch) => <button key={patch._id} type="button" onClick={() => void openPatch(patch)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-left hover:border-cyan-700"><div className="flex justify-between gap-2"><strong className="text-sm text-white">Version {patch.version}</strong><Pill tone={patch.status === 'APPLIED' ? 'green' : patch.status === 'FAILED' ? 'red' : 'amber'}>{patch.status}</Pill></div><p className="mt-2 text-xs text-slate-400">{patch.files.length} files · {patch.patchHash.slice(0, 12)}</p></button>)}</div> : <p className="text-sm text-slate-500">Open a task with a patch version first.</p>}</Card>{selectedPatch ? <Card title="Safe unified diff review"><PatchReview patch={selectedPatch} diff={diff} busy={busy} canApply={canApprove} onRequestApply={requestApply} onApply={applyPatch} onRequestRevert={requestRevert} onRevert={revertPatch} /></Card> : <Card title="Safe unified diff review"><p className="text-sm text-slate-500">Select a patch version. Code is escaped and displayed as text only.</p></Card>}</div>}

    {view === 'Command Runs' && <div className="space-y-4"><Card title="Safe command registry"><p className="mb-3 text-xs text-slate-400">The model selects command IDs only. Executable, arguments, workspace, timeout, and output limits are fixed by the backend.</p><div className="grid gap-2 md:grid-cols-2">{commands.map((command) => <div key={command.commandId} className="rounded-lg border border-slate-700 bg-slate-950 p-3"><div className="flex justify-between gap-2"><strong className="text-sm text-white">{command.label}</strong><Pill tone={command.approvalRequired ? 'amber' : 'green'}>{command.approvalRequired ? 'APPROVAL' : 'READ ONLY'}</Pill></div><code className="mt-2 block break-all text-xs text-cyan-200">{command.executable} {command.arguments.join(' ')}</code><button disabled={!details || busy === `command-${command.commandId}`} type="button" onClick={() => previewCommand(command)} className="mt-3 rounded-md border border-cyan-700 px-3 py-1.5 text-xs font-black text-cyan-100">{command.approvalRequired ? 'Request run approval' : 'Run safe check'}</button></div>)}</div></Card><Card title="Recorded command results"><p className="mb-3 text-xs text-amber-200">Command output may include pre-existing repository issues.</p><CommandRuns details={details} /></Card></div>}

    {view === 'Repository Status' && <Card title="Real repository status">{repository ? <div className="space-y-4 text-sm text-slate-300"><div className="grid gap-3 md:grid-cols-3"><Metric label="Repository" value={repository.repositoryRoot} /><Metric label="Branch" value={repository.branch || '(detached)'} /><Metric label="Commit" value={repository.commit.slice(0, 12)} /></div>{repository.dirty && <div className="rounded-lg border border-amber-800 bg-amber-950/40 p-3 text-amber-100">The working tree contains existing changes. Overlapping patches are blocked; high-risk patches cannot auto-apply.</div>}<FileGroup label="Tracked modifications" files={repository.modifiedFiles} /><FileGroup label="Staged files" files={repository.stagedFiles} /><FileGroup label="Untracked files" files={repository.untrackedFiles} /><FileGroup label="Denied capabilities" files={repository.deniedCapabilities} /></div> : <p className="text-slate-500">Repository metadata unavailable.</p>}</Card>}

    {view === 'Safety Settings' && <div className="grid gap-4 lg:grid-cols-2"><Card title="Coding safety switches">{config ? <div className="space-y-2">{(['codingAgentEnabled', 'allowRepositoryRead', 'allowRepositorySearch', 'allowCodingAnalysis', 'allowPatchGeneration', 'allowPatchApplication', 'allowSafeCommandExecution', 'allowFileCreation'] as const).map((key) => <div key={key} className="flex justify-between rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm"><span className="text-slate-300">{label(key)}</span><Pill tone={config.settings[key] ? 'green' : 'red'}>{config.settings[key] ? 'ENABLED' : 'DISABLED'}</Pill></div>)}</div> : null}</Card><Card title="Backend-locked capabilities"><div className="flex flex-wrap gap-2">{config?.lockedCapabilities.map((item) => <Pill key={item} tone="red">{label(item)} — OFF</Pill>)}</div><p className="mt-4 text-xs leading-5 text-slate-400">Frontend state cannot unlock these options. The backend overwrites every locked value to false.</p></Card></div>}
  </div>;
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-1 text-xs font-black text-slate-300">{text}{children}</label>; }
function Check({ label: text, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-start gap-2 rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs font-bold text-slate-300"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 accent-cyan-600" /><span>{text}</span></label>; }
function Metric({ label: text, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-700 bg-slate-950 p-3"><p className="text-[10px] font-black uppercase text-slate-500">{text}</p><p className="mt-1 break-all font-bold text-white">{value}</p></div>; }
function FileGroup({ label: text, files }: { label: string; files: string[] }) { return <div><p className="mb-2 text-xs font-black uppercase text-slate-500">{text} ({files.length})</p>{files.length ? <div className="max-h-56 overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-300">{files.map((file) => <div key={file} className="break-all py-1">{file}</div>)}</div> : <p className="text-xs text-slate-500">None</p>}</div>; }

function TaskList({ tasks, onOpen, busy }: { tasks: OGCodingTask[]; onOpen: (id: string) => void; busy: string }) {
  if (!tasks.length) return <p className="text-sm text-slate-500">No controlled coding tasks yet.</p>;
  return <div className="space-y-2">{tasks.map((task) => <button key={task._id} type="button" disabled={busy === `task-${task._id}`} onClick={() => onOpen(task._id)} className="w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-left hover:border-cyan-700"><div className="flex flex-wrap items-start justify-between gap-2"><strong className="text-sm text-white">{taskTitle(task)}</strong><Pill tone={task.status === 'FAILED' ? 'red' : task.status === 'APPLIED' ? 'green' : 'blue'}>{task.status}</Pill></div><div className="mt-2 flex flex-wrap gap-2"><Pill>{label(task.taskCategory)}</Pill><Pill tone={task.riskLevel === 'HIGH' ? 'red' : 'green'}>{task.riskLevel} RISK</Pill><span className="text-[10px] text-slate-500">{format(task.createdAt)}</span></div></button>)}</div>;
}

function TaskDetail({ details, canApprove, busy, patchProposal, setPatchProposal, onAnalyze, onRequestPatch, onGeneratePatch, onOpenPatch, onDecide, onRunApprovedCommand, onOpenApprovals }: { details: OGCodingTaskDetails; canApprove: boolean; busy: string; patchProposal: string; setPatchProposal: (value: string) => void; onAnalyze: (id: string) => void; onRequestPatch: (id: string) => void; onGeneratePatch: (id: string) => void; onOpenPatch: (patch: OGCodePatch) => void; onDecide: (approval: OGAgentApproval, decision: 'approve' | 'reject') => void; onRunApprovedCommand: (approval: OGAgentApproval) => void; onOpenApprovals: () => void }) {
  const task = details.task; const pending = details.approvals.filter((approval) => approval.status === 'PENDING'); const generationApproved = details.approvals.some((approval) => approval.actionType === 'CODE_PATCH_GENERATION' && approval.status === 'APPROVED' && !approval.consumedAt && !details.patches.some((patch) => patch.generationApprovalId === approval._id));
  return <div className="space-y-4"><Card title="Task overview"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-lg font-black text-white">{taskTitle(task)}</h2><p className="mt-1 text-xs text-slate-400">{label(task.taskCategory)} · {task.targetApplications.map(label).join(', ')} · Requested by {person(task.createdBy)}</p></div><div className="flex gap-2"><Pill tone={task.riskLevel === 'HIGH' ? 'red' : 'green'}>{task.riskLevel} RISK</Pill><Pill tone="blue">{task.status}</Pill></div></div><FileGroup label="Allowed paths" files={task.allowedPaths} /><div className="mt-3 flex flex-wrap gap-2">{task.analysisStatus === 'NOT_STARTED' && <button type="button" disabled={busy === 'analyze'} onClick={() => onAnalyze(task._id)} className="action">Analyze repository</button>}{task.analysisStatus === 'REVIEW_READY' && task.allowPatchGeneration && ['NOT_REQUESTED', 'REJECTED', 'FAILED', 'REVERTED'].includes(task.patchStatus) && <button type="button" onClick={() => onRequestPatch(task._id)} className="action">Request patch generation</button>}<button type="button" onClick={onOpenApprovals} className="action-secondary">Open all approvals</button></div></Card>
    {task.analysisStatus === 'REVIEW_READY' && <Card title="Structured analysis"><div className="space-y-4 text-sm leading-6 text-slate-300"><div><strong className="text-white">Summary:</strong> {task.analysis.summary}</div><div><strong className="text-white">Root cause ({label(task.analysis.confidence)}):</strong> {task.analysis.rootCause}</div><List title="Evidence" items={task.analysis.supportingEvidence} /><List title="Implementation plan" items={task.analysis.implementationPlan} /><List title="Risks" items={task.analysis.risks} /><List title="Test plan" items={task.analysis.testPlan} /><List title="Rollback plan" items={task.analysis.rollbackPlan} /><FileGroup label="Relevant files" files={task.relevantFiles.map((file) => `${file.path} — ${file.readStatus} — ${file.riskLevel}`)} /></div></Card>}
    {generationApproved && task.patchStatus !== 'APPLIED' && <Card title="Generate immutable patch version"><p className="mb-2 text-xs leading-5 text-slate-400">Deterministic local mode accepts a technical reviewer’s Git-style unified diff, then validates every path, operation, size, secret pattern, base state, and policy before saving. No file is changed here.</p><textarea rows={12} value={patchProposal} onChange={(event) => setPatchProposal(event.target.value)} spellCheck={false} placeholder={'diff --git a/apps/... b/apps/...\n--- a/apps/...\n+++ b/apps/...\n@@ ...'} className="input font-mono text-xs" /><button type="button" disabled={busy === 'generate-patch' || !patchProposal.trim()} onClick={() => onGeneratePatch(task._id)} className="action mt-3">Validate and save proposal</button></Card>}
    <Card title="Patch versions">{details.patches.length ? <div className="space-y-2">{details.patches.map((patch) => <button key={patch._id} type="button" onClick={() => onOpenPatch(patch)} className="flex w-full flex-wrap justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950 p-3 text-left"><span className="text-sm font-black text-white">Version {patch.version} · {patch.files.length} files</span><Pill tone={patch.status === 'APPLIED' ? 'green' : patch.status === 'FAILED' ? 'red' : 'amber'}>{patch.status}</Pill></button>)}</div> : <p className="text-sm text-slate-500">No patch has been generated.</p>}</Card>
    <Card title="Approvals and separation of duties">{details.approvals.length ? <div className="space-y-2">{details.approvals.map((approval) => <div key={approval._id} className="rounded-lg border border-slate-700 bg-slate-950 p-3"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm text-white">{approval.actionTitle}</strong><Pill tone={approval.status === 'APPROVED' ? 'green' : approval.status === 'REJECTED' ? 'red' : 'amber'}>{approval.status}</Pill></div><p className="mt-1 text-xs text-slate-400">Requested by {person(approval.requestedBy)} · Reviewed by {person(approval.reviewedBy)}</p>{approval.status === 'PENDING' && canApprove && <div className="mt-3 flex gap-2"><button type="button" onClick={() => onDecide(approval, 'approve')} className="action">Approve exact snapshot</button><button type="button" onClick={() => onDecide(approval, 'reject')} className="action-danger">Reject</button></div>}{approval.status === 'APPROVED' && !approval.consumedAt && approval.actionType === 'SAFE_COMMAND_EXECUTION' && <button type="button" onClick={() => onRunApprovedCommand(approval)} className="action mt-3">Run approved command</button>}</div>)}</div> : <p className="text-sm text-slate-500">No approval requests.</p>}{pending.length > 0 && !canApprove && <p className="mt-3 text-xs text-amber-200">A highest-admin technical reviewer must decide {pending.length} pending request(s).</p>}</Card>
    <Card title="Snapshots and timeline"><p className="text-xs text-slate-400">{details.snapshots.length} repository metadata snapshot(s), {details.commands.length} command run(s). Full file reads and actions are retained in the shared OG Agent audit log.</p></Card>
  </div>;
}

function List({ title, items }: { title: string; items: string[] }) { return <div><p className="text-xs font-black uppercase text-slate-500">{title}</p>{items.length ? <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="text-slate-500">None recorded.</p>}</div>; }

function PatchReview({ patch, diff, busy, canApply, onRequestApply, onApply, onRequestRevert, onRevert }: { patch: OGCodePatch; diff: string; busy: string; canApply: boolean; onRequestApply: (patch: OGCodePatch) => void; onApply: (patch: OGCodePatch) => void; onRequestRevert: (patch: OGCodePatch) => void; onRevert: (patch: OGCodePatch) => void }) {
  return <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><Metric label="Base commit" value={patch.baseGitCommit.slice(0, 12)} /><Metric label="Patch hash" value={patch.patchHash.slice(0, 16)} /><Metric label="Status" value={patch.status} /></div><div className="overflow-x-auto rounded-lg border border-slate-700 bg-black p-4"><pre className="min-w-max whitespace-pre text-xs leading-5 text-slate-200">{diff || 'Loading exact diff…'}</pre></div><div className="space-y-2">{patch.files.map((file) => <div key={file.path} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950 p-3"><div><code className="text-xs text-white">{file.path}</code><p className="mt-1 text-xs text-slate-500">{file.operation} · +{file.additions} / -{file.deletions}</p></div><Pill tone={file.riskLevel === 'HIGH' ? 'red' : 'green'}>{file.riskLevel}</Pill></div>)}</div><List title="Rollback instructions" items={patch.rollbackInstructions} /><div className="flex flex-wrap gap-2">{patch.status === 'REVIEW_READY' && <button type="button" disabled={busy === 'request-apply'} onClick={() => onRequestApply(patch)} className="action">Request apply approval</button>}{patch.status === 'WAITING_APPROVAL' && canApply && <button type="button" disabled={busy === 'apply'} onClick={() => onApply(patch)} className="action">Apply after approved</button>}{patch.status === 'APPLIED' && canApply && <button type="button" onClick={() => onRequestRevert(patch)} className="action-secondary">Request revert approval</button>}{patch.status === 'APPLIED' && canApply && patch.revertApprovalId && <button type="button" onClick={() => onRevert(patch)} className="action-danger">Revert after approved</button>}</div><p className="text-xs text-amber-200">Application rechecks current commit, full working-tree hash, overlap, exact patch hash, approved files, and dry-run. It never stages, commits, pushes, merges, or deploys.</p></div>;
}

function CommandRuns({ details }: { details: OGCodingTaskDetails | null }) { if (!details?.commands.length) return <p className="text-sm text-slate-500">Open a task and run an allowlisted check to see real results.</p>; return <div className="space-y-3">{details.commands.map((run) => <details key={run._id} className="rounded-lg border border-slate-700 bg-slate-950 p-3"><summary className="cursor-pointer text-sm font-black text-white">{run.commandLabel} · {run.resultClassification} · exit {run.exitCode ?? 'n/a'}</summary><p className="mt-2 text-xs text-slate-400">{format(run.startedAt)} → {format(run.completedAt)} · attribution: {label(run.failureAttribution)}</p><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-black p-3 text-xs text-slate-200">{run.stdoutPreview || run.stderrPreview || 'No output.'}</pre></details>)}</div>; }
