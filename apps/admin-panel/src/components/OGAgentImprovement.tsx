import { useEffect, useState } from 'react';
import type { OGAgentApi } from '../services/ogAgentApi';
import type { OGAgentImprovementRecord } from '../types/ogAgent';

type Props = { api: OGAgentApi };
type Tab = 'Dashboard' | 'Feedback' | 'Revisions' | 'Examples' | 'Guidance' | 'Proposals' | 'Prompts' | 'Rules' | 'Datasets' | 'Evaluations' | 'Metrics' | 'Human Impact';
const tabs: Tab[] = ['Dashboard', 'Feedback', 'Revisions', 'Examples', 'Guidance', 'Proposals', 'Prompts', 'Rules', 'Datasets', 'Evaluations', 'Metrics', 'Human Impact'];

export default function OGAgentImprovement({ api }: Props) {
  const [active, setActive] = useState<Tab>('Dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<Record<string, OGAgentImprovementRecord[]>>({});
  const load = async () => {
    setLoading(true); setError('');
    try {
      const responses = await Promise.all([api.listFeedback(), api.listImprovementExamples(), api.listImprovementGuidance(), api.listImprovementProposals(), api.listPromptVersions(), api.listRuleVersions(), api.listEvaluationDatasets(), api.listEvaluationRuns(), api.getImprovementMetrics(), api.getHumanImpactMetrics()]);
      const [feedback, examples, guidance, proposals, prompts, rules, datasets, evaluations, metrics, impact] = responses.map((item) => item.data || []);
      setData({ Feedback: feedback, Revisions: feedback.filter((item) => item.reviewDecision === 'REQUEST_REVISION'), Examples: examples, Guidance: guidance, Proposals: proposals, Prompts: prompts, Rules: rules, Datasets: datasets, Evaluations: evaluations, Metrics: metrics, 'Human Impact': impact });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load improvement workspace.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [api]);
  const cards = [
    ['Feedback received', data.Feedback?.length || 0], ['Revision requests', data.Revisions?.length || 0],
    ['Active guidance', data.Guidance?.filter((item) => item.status === 'ACTIVE').length || 0],
    ['Open proposals', data.Proposals?.filter((item) => !['ACTIVE', 'REJECTED', 'ARCHIVED'].includes(String(item.status))).length || 0],
    ['Evaluations', data.Evaluations?.length || 0], ['Human-impact flags', data['Human Impact']?.reduce((sum, item) => sum + Number(item.count || 0), 0) || 0],
  ];
  return <section className="space-y-4">
    <div className="rounded-xl border border-emerald-800 bg-gradient-to-r from-emerald-950 to-slate-950 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-white">Controlled Improvement</h2><p className="mt-1 text-xs leading-5 text-slate-300">Human feedback improves recommendations and evaluated versions. It never grants authority, disables safeguards, or activates itself.</p></div><button type="button" onClick={() => void load()} className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-black text-emerald-200">Refresh</button></div></div>
    <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900 p-2">{tabs.map((tab) => <button key={tab} type="button" onClick={() => setActive(tab)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-black ${active === tab ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>{tab}</button>)}</nav>
    {error && <p className="rounded-lg border border-rose-800 bg-rose-950 p-3 text-sm text-rose-200">{error}</p>}
    {active === 'Dashboard' ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-700 bg-slate-900 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p><p className="mt-2 text-3xl font-black text-emerald-300">{value}</p></div>)}</div> : <RecordList title={active} records={data[active] || []} loading={loading} />}
    <aside className="rounded-xl border border-amber-800 bg-amber-950/40 p-4 text-xs leading-5 text-amber-100"><strong>Activation boundary:</strong> examples, guidance, prompts, rules, and rollback targets remain drafts or reviewed proposals until an authorized Super Admin approves the exact immutable version. Conflicting and negative feedback is preserved.</aside>
  </section>;
}

function RecordList({ title, records, loading }: { title: string; records: OGAgentImprovementRecord[]; loading: boolean }) {
  if (loading) return <div className="h-40 animate-pulse rounded-xl border border-slate-700 bg-slate-900" />;
  if (!records.length) return <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center text-sm text-slate-500">No {title.toLowerCase()} records yet.</div>;
  return <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900"><div className="border-b border-slate-700 px-4 py-3"><h3 className="font-black text-white">{title}</h3></div><div className="divide-y divide-slate-800">{records.map((item) => <article key={item._id || JSON.stringify(item)} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto]"><div><h4 className="text-sm font-black text-white">{String(item.title || item.name || item.key || item.summary || item._id || item._id)}</h4><p className="mt-1 text-xs text-slate-400">{[item.assessment, item.reviewDecision, item.taskType, item.severity].filter(Boolean).join(' · ') || 'Controlled improvement record'}</p></div><div className="flex items-center gap-2"><span className="rounded-full border border-slate-600 px-2 py-1 text-[10px] font-black text-slate-300">{String(item.status || (item.aggregateScore !== undefined ? `SCORE ${item.aggregateScore}` : 'RECORDED'))}</span>{item.createdAt && <span className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</span>}</div></article>)}</div></div>;
}
