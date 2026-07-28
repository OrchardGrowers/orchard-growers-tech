import { useCallback, useEffect, useState } from 'react';

const STATUSES = [
  'NEW',
  'REVIEWED',
  'CONTACTED',
  'INTERVIEW_SCHEDULED',
  'SHORTLISTED',
  'SELECTED',
  'REJECTED',
  'DUPLICATE',
] as const;

type Attachment = {
  filename?: string;
  contentType?: string;
  size?: number;
  contentId?: string;
  disposition?: string;
};

type CareerApplication = {
  _id: string;
  applicantName?: string;
  senderName?: string;
  senderEmail?: string;
  replyToEmail?: string;
  subject?: string;
  receivedAt?: string;
  emailDate?: string;
  bodyPreview?: string;
  textBody?: string;
  messageId?: string;
  status?: string;
  contactNumber?: string;
  extractedPhoneNumbers?: string[];
  extractedEmails?: string[];
  attachments?: Attachment[];
};

type Props = {
  apiBase: string;
  authHeaders: Record<string, string>;
};

const readJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

const readableStatus = (status?: string) => (status || 'NEW').replaceAll('_', ' ');
const formatDate = (value?: string) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
};

export default function CareerApplications({ apiBase, authHeaders }: Props) {
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [selected, setSelected] = useState<CareerApplication | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) query.set('search', search);
      if (status) query.set('status', status);
      const response = await fetch(`${apiBase}/admin/career-applications?${query}`, {
        headers: authHeaders,
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.msg || 'Career applications could not be loaded.');
      setApplications(Array.isArray(body.applications) ? body.applications : []);
      setTotal(Number(body.pagination?.total) || 0);
      setTotalPages(Math.max(Number(body.pagination?.totalPages) || 1, 1));
    } catch (error) {
      setApplications([]);
      setMessage(error instanceof Error ? error.message : 'Career applications could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [apiBase, authHeaders, page, search, status]);

  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);

  const syncMailbox = async () => {
    setSyncing(true);
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/admin/career-applications/sync`, {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.msg || 'Career mailbox sync failed.');
      const summary = body.summary || {};
      setPage(1);
      await loadApplications();
      setMessage(
        `Sync complete: ${summary.imported || 0} imported, ${summary.duplicates || 0} duplicates, ${summary.failed || 0} failed.`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Career mailbox sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const openDetail = async (application: CareerApplication) => {
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/admin/career-applications/${application._id}`, {
        headers: authHeaders,
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.msg || 'Career application could not be opened.');
      setSelected(body.application);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Career application could not be opened.');
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Career Applications</h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              Review applications imported manually from the configured read-only mailbox.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void syncMailbox()}
            disabled={syncing}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? 'Syncing…' : 'Sync mailbox'}
          </button>
        </div>

        <form
          className="mt-4 flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search applicant, email, phone or subject"
            className="min-w-[260px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          >
            <option value="">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>{readableStatus(item)}</option>
            ))}
          </select>
          <button type="submit" className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
            Search
          </button>
        </form>
        {message && <p role="status" className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-bold text-slate-200">{message}</p>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-bold text-slate-300">{total} application{total === 1 ? '' : 's'}</p>
          {loading && <span className="text-xs font-bold text-slate-400">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Contact Number</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Attachments</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {!loading && applications.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center font-semibold text-slate-400">No career applications found.</td></tr>
              )}
              {applications.map((application) => (
                <tr key={application._id} className="align-top hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <span className="block font-bold text-white">{application.applicantName || application.senderName || 'Unknown applicant'}</span>
                  </td>
                  <td className="break-all px-4 py-3 text-slate-300">{application.replyToEmail || application.senderEmail || 'Not found'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">{application.contactNumber || 'Not found'}</td>
                  <td className="max-w-md px-4 py-3">
                    <span className="block font-semibold text-slate-200">{application.subject || '(No subject)'}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{application.bodyPreview || 'No plain-text preview'}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-300">{formatDate(application.receivedAt || application.emailDate)}</td>
                  <td className="px-4 py-3 text-slate-300">{application.attachments?.length || 0}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-black text-slate-200">{readableStatus(application.status)}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => void openDetail(application)} className="font-black text-emerald-400 hover:text-emerald-300">View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(value - 1, 1))} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Previous</button>
          <span className="text-sm font-bold text-slate-400">Page {page} of {totalPages}</span>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-40">Next</button>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="career-detail-title">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="career-detail-title" className="text-xl font-black text-white">{selected.applicantName || selected.senderName || 'Unknown applicant'}</h3>
                <p className="break-all text-sm font-semibold text-slate-400">{selected.replyToEmail || selected.senderEmail}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-black text-white">Close</button>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><dt className="text-xs font-black uppercase text-slate-500">Subject</dt><dd className="mt-1 text-sm text-slate-200">{selected.subject || '(No subject)'}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Received</dt><dd className="mt-1 text-sm text-slate-200">{formatDate(selected.receivedAt || selected.emailDate)}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Sender email</dt><dd className="mt-1 break-all text-sm text-slate-200">{selected.senderEmail || 'None extracted'}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Reply-To email</dt><dd className="mt-1 break-all text-sm text-slate-200">{selected.replyToEmail || 'None extracted'}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Contact number</dt><dd className="mt-1 text-sm text-slate-200">{selected.contactNumber || 'None extracted'}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Other detected numbers</dt><dd className="mt-1 text-sm text-slate-200">{selected.extractedPhoneNumbers?.filter((number) => number !== selected.contactNumber).join(', ') || 'None'}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Status</dt><dd className="mt-1 text-sm text-slate-200">{readableStatus(selected.status)}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Message ID</dt><dd className="mt-1 break-all text-sm text-slate-200">{selected.messageId || 'Not provided by sender'}</dd></div>
            </dl>
            <div className="mt-5">
              <h4 className="text-xs font-black uppercase text-slate-500">Plain-text message</h4>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950 p-4 font-sans text-sm leading-6 text-slate-200">{selected.textBody || 'No plain-text message was available.'}</pre>
            </div>
            <div className="mt-5">
              <h4 className="text-xs font-black uppercase text-slate-500">Attachment metadata</h4>
              {selected.attachments?.length ? (
                <ul className="mt-2 space-y-2">
                  {selected.attachments.map((attachment, index) => (
                    <li key={`${attachment.filename || 'attachment'}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300">
                      <span className="font-bold text-white">{attachment.filename || 'Unnamed attachment'}</span>
                      <span className="ml-2 text-xs text-slate-500">{attachment.contentType || 'Unknown type'} · {attachment.size || 0} bytes</span>
                      {(attachment.disposition || attachment.contentId) && <span className="mt-1 block break-all text-xs text-slate-500">{attachment.disposition || 'attachment'}{attachment.contentId ? ` · Content ID: ${attachment.contentId}` : ''}</span>}
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 text-sm text-slate-400">No attachments.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
