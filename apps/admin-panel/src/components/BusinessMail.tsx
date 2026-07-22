import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

const BUSINESS_MAIL_ALLOWED_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'SUPPORT_EXECUTIVE',
  'SALES_EXECUTIVE',
]);

export const canUseBusinessMail = (role?: string) =>
  BUSINESS_MAIL_ALLOWED_ROLES.has(String(role || '').trim().toUpperCase());

const CATEGORIES = [
  'GENERAL',
  'CAREER',
  'SUPPORT',
  'ADMIN_NOTICE',
  'USER_COMMUNICATION',
  'INTERNAL_TEST',
] as const;
const STATUSES = ['REQUESTED', 'PROCESSING', 'SENT', 'FAILED'] as const;
const PROVIDERS = ['brevo_api', 'smtp'] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContentMode = 'text' | 'html';
type BusinessMailCategory = (typeof CATEGORIES)[number];
type BusinessMailStatus = (typeof STATUSES)[number];

type ProviderStatus = {
  provider: string;
  configured: boolean;
  enabledSenderProfileKeys: string[];
  capabilities: Record<string, boolean>;
};

type SenderProfile = {
  key: string;
  name: string;
  email: string;
  replyTo: string;
  enabled: boolean;
  replyCapable: boolean;
};

type DeliveryLog = {
  id: string;
  category: string;
  senderProfileKey: string;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  recipient: string;
  subject: string;
  provider: string;
  providerMessageId: string;
  status: string;
  requestedByAdmin: { id: string; email: string; role: string };
  failureCode: string;
  failureMessage: string;
  metadata: { source: string; correlationId: string };
  createdAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
};

type Pagination = { page: number; limit: number; total: number; totalPages: number };
type Filters = {
  status: string;
  provider: string;
  senderProfileKey: string;
  category: string;
  fromDate: string;
  toDate: string;
};
type ComposeForm = {
  senderProfileKey: string;
  to: string;
  category: BusinessMailCategory;
  subject: string;
  mode: ContentMode;
  text: string;
  html: string;
};
type FieldErrors = Partial<Record<'senderProfileKey' | 'to' | 'subject' | 'content', string>>;
type SendDelivery = Partial<DeliveryLog> & {
  id: string;
  status: string;
  provider: string;
  providerMessageId: string;
  senderProfileKey: string;
  recipient: string;
  sentAt: string;
};

class BusinessMailApiError extends Error {
  status: number;
  code: string;
  delivery?: Partial<DeliveryLog>;

  constructor(status: number, code: string, message: string, delivery?: Partial<DeliveryLog>) {
    super(message);
    this.name = 'BusinessMailApiError';
    this.status = status;
    this.code = code;
    this.delivery = delivery;
  }
}

const getBusinessMailErrorMessage = (error: unknown, sendRequest = false) => {
  if (!(error instanceof BusinessMailApiError)) {
    return sendRequest
      ? 'The send result is uncertain. Check delivery history before trying again.'
      : 'Business Mail data could not be loaded. Please try again.';
  }
  if (error.status === 401) return 'Your admin session has expired. Please log in again.';
  if (error.status === 403) {
    return error.code.includes('SENDER_DISABLED')
      ? 'This sender profile is currently disabled.'
      : 'You do not have permission to send Business Mail.';
  }
  if (error.status === 409) {
    if (error.delivery?.status === 'FAILED' || /previous.+failed/i.test(error.message)) {
      return 'The previous send failed. Review the message and retry as a new request.';
    }
    return 'This send request is already being processed. Check delivery history before retrying.';
  }
  if (error.status === 429) return 'Business Mail sending limit has been reached. Please try again later.';
  if (error.status === 502) return 'The email provider could not send this message.';
  if (error.status === 503) return 'Business Mail provider is not configured.';
  if (error.status === 504) return 'The email provider did not respond in time. Check delivery history before retrying.';
  if (error.status === 400) return error.message || 'Please review the highlighted fields.';
  return error.message || 'Business Mail request failed.';
};

const validateBusinessMailCompose = (form: ComposeForm): FieldErrors => {
  const errors: FieldErrors = {};
  if (!form.senderProfileKey) errors.senderProfileKey = 'Select an enabled sender profile.';
  const recipient = form.to.trim();
  if (!recipient || /[,;\r\n]/.test(recipient) || !EMAIL_PATTERN.test(recipient)) {
    errors.to = 'Enter exactly one valid recipient email address.';
  }
  const subject = form.subject.trim();
  if (!subject) errors.subject = 'Subject is required.';
  else if (form.subject.length > 200) errors.subject = 'Subject cannot exceed 200 characters.';
  const content = form.mode === 'text' ? form.text : form.html;
  if (!content.trim()) errors.content = form.mode === 'text' ? 'Plain-text content is required.' : 'HTML content is required.';
  if (form.mode === 'text' && form.text.length > 100000) errors.content = 'Plain text cannot exceed 100,000 characters.';
  if (form.mode === 'html' && form.html.length > 150000) errors.content = 'HTML cannot exceed 150,000 characters.';
  return errors;
};

const emptyFilters: Filters = {
  status: '',
  provider: '',
  senderProfileKey: '',
  category: '',
  fromDate: '',
  toDate: '',
};

const emptyCompose: ComposeForm = {
  senderProfileKey: '',
  to: '',
  category: 'GENERAL',
  subject: '',
  mode: 'text',
  text: '',
  html: '',
};

const readJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { msg: text };
  }
};

const requestBusinessMailJson = async <T,>(
  url: string,
  authHeaders: Record<string, string>,
  init: RequestInit = {}
) => {
  const response = await fetch(url, {
    ...init,
    headers: { ...authHeaders, ...(init.headers || {}) },
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new BusinessMailApiError(
      response.status,
      String(body.code || ''),
      String(body.msg || body.message || `Business Mail request returned ${response.status}.`),
      body.delivery as Partial<DeliveryLog> | undefined
    );
  }
  return body as T;
};

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(24);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatProvider = (provider?: string) => {
  if (provider === 'brevo_api') return 'Brevo API';
  if (provider === 'smtp') return 'SMTP';
  return provider || 'Not available';
};

const statusClasses: Record<string, string> = {
  REQUESTED: 'border-sky-700 bg-sky-950 text-sky-200',
  PROCESSING: 'border-amber-700 bg-amber-950 text-amber-200',
  SENT: 'border-emerald-700 bg-emerald-950 text-emerald-200',
  FAILED: 'border-red-700 bg-red-950 text-red-200',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${statusClasses[status] || 'border-slate-700 bg-slate-900 text-slate-300'}`}>
      {status || 'UNKNOWN'}
    </span>
  );
}

function Modal({ title, children, onClose, initialFocusRef }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLButtonElement>;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    initialFocusRef?.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previous?.focus();
    };
  }, [initialFocusRef, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="business-mail-modal-title" className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-900 p-4">
          <h2 id="business-mail-modal-title" className="text-lg font-black text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400">
            Close
          </button>
        </header>
        <div className="p-4">{children}</div>
      </section>
    </div>
  );
}

export default function BusinessMail({ apiBase, authHeaders }: {
  apiBase: string;
  authHeaders: Record<string, string>;
}) {
  const endpoint = `${apiBase}/admin/business-mail`;
  const [activeArea, setActiveArea] = useState<'compose' | 'history'>('compose');
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [profiles, setProfiles] = useState<SenderProfile[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [form, setForm] = useState<ComposeForm>(emptyCompose);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendResult, setSendResult] = useState<SendDelivery | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState('');
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [selectedLog, setSelectedLog] = useState<DeliveryLog | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const logsRequestId = useRef(0);
  const sendInFlight = useRef(false);

  const enabledProfiles = useMemo(() => profiles.filter((profile) => profile.enabled), [profiles]);
  const selectedProfile = profiles.find((profile) => profile.key === form.senderProfileKey);
  const activeBody = form.mode === 'text' ? form.text : form.html;
  const canSend = Boolean(providerStatus?.configured && selectedProfile?.enabled && !submitting);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const [statusBody, profilesBody] = await Promise.all([
        requestBusinessMailJson<ProviderStatus>(`${endpoint}/status`, authHeaders),
        requestBusinessMailJson<{ profiles: SenderProfile[] }>(`${endpoint}/sender-profiles`, authHeaders),
      ]);
      setProviderStatus(statusBody);
      setProfiles(Array.isArray(profilesBody.profiles) ? profilesBody.profiles : []);
      setForm((current) => {
        if (current.senderProfileKey && profilesBody.profiles.some((profile) => profile.key === current.senderProfileKey && profile.enabled)) return current;
        const firstEnabled = profilesBody.profiles.find((profile) => profile.enabled);
        return { ...current, senderProfileKey: firstEnabled?.key || '' };
      });
    } catch (error) {
      setOverviewError(getBusinessMailErrorMessage(error));
    } finally {
      setOverviewLoading(false);
    }
  }, [authHeaders, endpoint]);

  const loadLogs = useCallback(async (page = 1, filters = appliedFilters) => {
    const requestId = ++logsRequestId.current;
    setLogsLoading(true);
    setLogsError('');
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      if (key === 'fromDate') params.set(key, `${value}T00:00:00.000Z`);
      else if (key === 'toDate') params.set(key, `${value}T23:59:59.999Z`);
      else params.set(key, value);
    });
    try {
      const body = await requestBusinessMailJson<{ logs: DeliveryLog[]; pagination: Pagination }>(`${endpoint}/logs?${params}`, authHeaders);
      if (requestId !== logsRequestId.current) return;
      setLogs(Array.isArray(body.logs) ? body.logs : []);
      setPagination(body.pagination || { page, limit: 20, total: 0, totalPages: 0 });
    } catch (error) {
      if (requestId === logsRequestId.current) setLogsError(getBusinessMailErrorMessage(error));
    } finally {
      if (requestId === logsRequestId.current) setLogsLoading(false);
    }
  }, [appliedFilters, authHeaders, endpoint]);

  useEffect(() => { void loadOverview(); }, [loadOverview]);
  useEffect(() => { void loadLogs(1, appliedFilters); }, [appliedFilters, loadLogs]);

  const updateForm = <K extends keyof ComposeForm>(key: K, value: ComposeForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key === 'text' || key === 'html' || key === 'mode' ? 'content' : key]: undefined }));
    if (idempotencyKey) setIdempotencyKey('');
    setSendError('');
    setSendResult(null);
  };

  const openConfirmation = (event: FormEvent) => {
    event.preventDefault();
    const errors = validateBusinessMailCompose(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setSendError('Please review the highlighted fields.');
      return;
    }
    if (!canSend) {
      setSendError(providerStatus?.configured ? 'Select an enabled sender profile.' : 'Business Mail provider is not configured.');
      return;
    }
    if (!idempotencyKey) setIdempotencyKey(createIdempotencyKey());
    setConfirmOpen(true);
  };

  const submitMail = async () => {
    if (sendInFlight.current) return;
    sendInFlight.current = true;
    const currentKey = idempotencyKey || createIdempotencyKey();
    if (!idempotencyKey) setIdempotencyKey(currentKey);
    setSubmitting(true);
    setSendError('');
    try {
      const body = await requestBusinessMailJson<{ success: true; idempotentReplay?: boolean; delivery: SendDelivery }>(endpoint + '/send', authHeaders, {
        method: 'POST',
        body: JSON.stringify({
          senderProfileKey: form.senderProfileKey,
          to: form.to.trim(),
          subject: form.subject.trim(),
          category: form.category,
          ...(form.mode === 'text' ? { text: form.text } : { html: form.html }),
          metadata: { source: 'admin-panel' },
          idempotencyKey: currentKey,
        }),
      });
      setSendResult(body.delivery);
      setConfirmOpen(false);
      setForm((current) => ({ ...current, to: '', subject: '', text: '', html: '' }));
      setFieldErrors({});
      setIdempotencyKey('');
      await loadLogs(1, appliedFilters);
    } catch (error) {
      setConfirmOpen(false);
      setSendError(getBusinessMailErrorMessage(error, true));
      if (error instanceof BusinessMailApiError) {
        if (error.status === 400) {
          if (error.code.includes('RECIPIENT')) setFieldErrors((current) => ({ ...current, to: error.message }));
          else if (error.code.includes('SUBJECT')) setFieldErrors((current) => ({ ...current, subject: error.message }));
          else if (error.code.includes('CONTENT') || error.code.includes('HTML')) setFieldErrors((current) => ({ ...current, content: error.message }));
        }
        if (error.status === 409 && (error.delivery?.status === 'FAILED' || /previous.+failed/i.test(error.message))) {
          setIdempotencyKey('');
        }
      }
    } finally {
      sendInFlight.current = false;
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    const hasContent = Boolean(form.to || form.subject || form.text || form.html);
    if (hasContent && !window.confirm('Clear the unsent Business Mail content?')) return;
    setForm((current) => ({ ...emptyCompose, senderProfileKey: current.senderProfileKey, category: current.category }));
    setFieldErrors({});
    setPreviewOpen(false);
    setConfirmOpen(false);
    setSendError('');
    setSendResult(null);
    setIdempotencyKey('');
  };

  const showLogDetail = async (id: string) => {
    setSelectedLog(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const body = await requestBusinessMailJson<{ log: DeliveryLog }>(`${endpoint}/logs/${encodeURIComponent(id)}`, authHeaders);
      setSelectedLog(body.log);
    } catch (error) {
      setDetailError(getBusinessMailErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = useCallback(() => {
    setSelectedLog(null);
    setDetailError('');
    setDetailLoading(false);
  }, []);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    if (draftFilters.fromDate && draftFilters.toDate && draftFilters.fromDate > draftFilters.toDate) {
      setLogsError('From date cannot be after To date.');
      return;
    }
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters({ ...draftFilters });
  };

  const clearFilters = () => {
    setDraftFilters(emptyFilters);
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters(emptyFilters);
  };

  return (
    <section className="space-y-4" aria-labelledby="business-mail-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-400">Protected admin delivery</p>
          <h1 id="business-mail-title" className="mt-1 text-2xl font-black text-white">Business Mail</h1>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-400">Compose one-recipient operational email and review safe delivery records.</p>
        </div>
        <button type="button" onClick={() => { void loadOverview(); void loadLogs(pagination.page, appliedFilters); }} disabled={overviewLoading || logsLoading} className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60">
          {overviewLoading || logsLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <article className="rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-sm shadow-black/20">
        {overviewError ? <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm font-bold text-red-200">{overviewError}</p> : (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)]">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">Provider status</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-black text-white">{overviewLoading ? 'Loading...' : formatProvider(providerStatus?.provider)}</h2>
                {providerStatus && <span className={`rounded-full border px-3 py-1 text-xs font-black ${providerStatus.configured ? 'border-emerald-700 bg-emerald-950 text-emerald-200' : 'border-amber-700 bg-amber-950 text-amber-200'}`}>{providerStatus.configured ? 'Configured' : 'Not configured'}</span>}
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-300">Sender profiles: {providerStatus?.enabledSenderProfileKeys?.length || 0} enabled</p>
              {providerStatus && !providerStatus.configured && <p role="alert" className="mt-3 rounded-lg border border-amber-700 bg-amber-950 p-3 text-sm font-bold text-amber-100">Business Mail provider is not configured. Sending is disabled; delivery history remains available.</p>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-black uppercase text-emerald-400">Supported</p>
                <p className="mt-2 text-sm font-semibold text-slate-300">Single recipient<br />Plain text<br />Basic HTML</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-black uppercase text-slate-500">Unsupported</p>
                <p className="mt-2 text-sm font-semibold text-slate-300">Attachments<br />CC / BCC<br />Scheduling / bulk</p>
              </div>
            </div>
          </div>
        )}
      </article>

      <div className="flex gap-2 border-b border-slate-700" role="tablist" aria-label="Business Mail areas">
        {(['compose', 'history'] as const).map((area) => (
          <button key={area} type="button" role="tab" aria-selected={activeArea === area} onClick={() => setActiveArea(area)} className={`border-b-2 px-4 py-3 text-sm font-black focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400 ${activeArea === area ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {area === 'compose' ? 'Compose' : `Delivery History${pagination.total ? ` (${pagination.total})` : ''}`}
          </button>
        ))}
      </div>

      {activeArea === 'compose' && (
        <form onSubmit={openConfirmation} className="space-y-4" noValidate>
          {sendError && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm font-bold text-red-200">{sendError}</p>}
          {sendResult && (
            <article className="rounded-xl border border-emerald-700 bg-emerald-950 p-4 text-emerald-100" aria-live="polite">
              <h2 className="font-black">Business email sent successfully.</h2>
              <div className="mt-3 grid gap-2 text-sm font-semibold sm:grid-cols-2 lg:grid-cols-3">
                <span>Status: {sendResult.status}</span><span>Recipient: {sendResult.recipient}</span><span>Provider: {formatProvider(sendResult.provider)}</span>
                <span>Sender: {sendResult.senderProfileKey}</span><span>Sent: {formatDateTime(sendResult.sentAt)}</span><span>Log ID: {sendResult.id}</span>
                {sendResult.providerMessageId && <span className="break-all sm:col-span-2 lg:col-span-3">Provider message ID: {sendResult.providerMessageId}</span>}
              </div>
            </article>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-sm font-bold text-slate-200">
              Sender Profile
              <select value={form.senderProfileKey} onChange={(event) => updateForm('senderProfileKey', event.target.value)} aria-invalid={Boolean(fieldErrors.senderProfileKey)} aria-describedby={fieldErrors.senderProfileKey ? 'sender-profile-error' : undefined} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400">
                <option value="">Select an enabled sender</option>
                {profiles.map((profile) => <option key={profile.key} value={profile.key} disabled={!profile.enabled}>{profile.name} &lt;{profile.email}&gt;{profile.enabled ? '' : ' — disabled'}</option>)}
              </select>
              {fieldErrors.senderProfileKey && <span id="sender-profile-error" className="mt-1 block text-xs text-red-300">{fieldErrors.senderProfileKey}</span>}
              {selectedProfile?.replyTo && <span className="mt-1 block text-xs text-slate-400">Reply-To: {selectedProfile.replyTo}</span>}
            </label>
            <label className="block text-sm font-bold text-slate-200">
              Recipient
              <input type="email" value={form.to} onChange={(event) => updateForm('to', event.target.value)} maxLength={320} autoComplete="off" placeholder="recipient@example.com" aria-invalid={Boolean(fieldErrors.to)} aria-describedby={fieldErrors.to ? 'recipient-error' : 'recipient-help'} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" />
              <span id="recipient-help" className="mt-1 block text-xs text-slate-400">Exactly one email address. CC, BCC, lists, and bulk sending are unavailable.</span>
              {fieldErrors.to && <span id="recipient-error" className="mt-1 block text-xs text-red-300">{fieldErrors.to}</span>}
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <label className="block text-sm font-bold text-slate-200">
              Category
              <select value={form.category} onChange={(event) => updateForm('category', event.target.value as BusinessMailCategory)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400">
                {CATEGORIES.map((category) => <option key={category} value={category}>{category.replace(/_/g, ' ')}</option>)}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-200">
              <span className="flex justify-between gap-3"><span>Subject</span><span className={form.subject.length > 200 ? 'text-red-300' : 'text-slate-400'}>{form.subject.length}/200</span></span>
              <input value={form.subject} onChange={(event) => updateForm('subject', event.target.value)} maxLength={201} aria-invalid={Boolean(fieldErrors.subject)} aria-describedby={fieldErrors.subject ? 'subject-error' : undefined} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" />
              {fieldErrors.subject && <span id="subject-error" className="mt-1 block text-xs text-red-300">{fieldErrors.subject}</span>}
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-bold text-slate-200">Content mode</legend>
            <div className="mt-2 flex gap-2">
              <button type="button" aria-pressed={form.mode === 'text'} onClick={() => updateForm('mode', 'text')} className={`rounded-lg px-4 py-2 text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-400 ${form.mode === 'text' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Plain Text</button>
              <button type="button" aria-pressed={form.mode === 'html'} onClick={() => updateForm('mode', 'html')} className={`rounded-lg px-4 py-2 text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-400 ${form.mode === 'html' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Basic HTML</button>
            </div>
          </fieldset>

          <label className="block text-sm font-bold text-slate-200">
            <span className="flex justify-between gap-3"><span>{form.mode === 'text' ? 'Plain-text body' : 'Basic HTML source'}</span><span className={activeBody.length > (form.mode === 'text' ? 100000 : 150000) ? 'text-red-300' : 'text-slate-400'}>{activeBody.length.toLocaleString()}/{(form.mode === 'text' ? 100000 : 150000).toLocaleString()}</span></span>
            {form.mode === 'html' && <span className="mt-1 block rounded-lg border border-amber-800 bg-amber-950 p-2 text-xs text-amber-100">Only restrictive, safe email HTML is accepted. Scripts, embeds, forms, event handlers, and unsafe links are rejected by the backend.</span>}
            <textarea value={activeBody} onChange={(event) => updateForm(form.mode, event.target.value)} maxLength={form.mode === 'text' ? 100001 : 150001} rows={14} spellCheck={form.mode === 'text'} aria-invalid={Boolean(fieldErrors.content)} aria-describedby={fieldErrors.content ? 'content-error' : undefined} className={`mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 ${form.mode === 'html' ? 'font-mono text-sm' : 'font-sans'}`} />
            {fieldErrors.content && <span id="content-error" className="mt-1 block text-xs text-red-300">{fieldErrors.content}</span>}
          </label>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={resetForm} disabled={submitting} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-black text-white hover:bg-slate-700 disabled:opacity-60">Reset</button>
            <button type="button" onClick={() => setPreviewOpen(true)} disabled={!activeBody.trim()} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-black text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50">Preview</button>
            <button type="submit" disabled={!canSend} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Sending...' : 'Review & Send'}</button>
          </div>
        </form>
      )}

      {activeArea === 'history' && (
        <div className="space-y-4">
          <form onSubmit={applyFilters} className="rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <FilterSelect label="Status" value={draftFilters.status} onChange={(value) => setDraftFilters((current) => ({ ...current, status: value }))} options={STATUSES} />
              <FilterSelect label="Provider" value={draftFilters.provider} onChange={(value) => setDraftFilters((current) => ({ ...current, provider: value }))} options={PROVIDERS} format={formatProvider} />
              <FilterSelect label="Sender Profile" value={draftFilters.senderProfileKey} onChange={(value) => setDraftFilters((current) => ({ ...current, senderProfileKey: value }))} options={profiles.map((profile) => profile.key)} />
              <FilterSelect label="Category" value={draftFilters.category} onChange={(value) => setDraftFilters((current) => ({ ...current, category: value }))} options={CATEGORIES} />
              <FilterDate label="From date" value={draftFilters.fromDate} onChange={(value) => setDraftFilters((current) => ({ ...current, fromDate: value }))} />
              <FilterDate label="To date" value={draftFilters.toDate} onChange={(value) => setDraftFilters((current) => ({ ...current, toDate: value }))} />
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={clearFilters} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-black text-white hover:bg-slate-700">Clear Filters</button>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500">Apply Filters</button>
            </div>
          </form>

          {logsError && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm font-bold text-red-200">{logsError}</p>}
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="min-w-[1120px] w-full text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase text-slate-400"><tr>{['Date / Time', 'Sender', 'Recipient', 'Category', 'Subject', 'Provider', 'Status', 'Requested By', 'Actions'].map((heading) => <th key={heading} className="px-3 py-3 font-black">{heading}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950">
                {logsLoading ? <tr><td colSpan={9} className="px-4 py-10 text-center font-bold text-slate-400">Loading delivery history...</td></tr> : logs.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center font-bold text-slate-400">No Business Mail deliveries found.</td></tr> : logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-slate-900/70">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-300">{formatDateTime(log.createdAt)}</td>
                    <td className="px-3 py-3"><span className="block font-bold text-white">{log.senderName || log.senderProfileKey}</span><span className="block text-xs text-slate-500">{log.senderEmail}</span></td>
                    <td className="px-3 py-3 text-slate-300">{log.recipient}</td>
                    <td className="px-3 py-3 text-slate-300">{log.category}</td>
                    <td className="max-w-[240px] px-3 py-3 text-slate-300"><span className="line-clamp-2">{log.subject}</span></td>
                    <td className="px-3 py-3 text-slate-300">{formatProvider(log.provider)}</td>
                    <td className="px-3 py-3"><StatusBadge status={log.status} /></td>
                    <td className="px-3 py-3"><span className="block text-slate-300">{log.requestedByAdmin?.email || 'Not available'}</span><span className="text-xs text-slate-500">{log.requestedByAdmin?.role}</span></td>
                    <td className="px-3 py-3"><button type="button" onClick={() => void showLogDetail(log.id)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-400">
            <span>Page {pagination.page} of {Math.max(1, pagination.totalPages)} · {pagination.total} records</span>
            <div className="flex gap-2">
              <button type="button" disabled={logsLoading || pagination.page <= 1} onClick={() => void loadLogs(pagination.page - 1, appliedFilters)} className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
              <button type="button" disabled={logsLoading || pagination.page >= pagination.totalPages} onClick={() => void loadLogs(pagination.page + 1, appliedFilters)} className="rounded-lg bg-slate-800 px-4 py-2 text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
            </div>
          </div>
        </div>
      )}

      {previewOpen && (
        <Modal title={`${form.mode === 'text' ? 'Plain-text' : 'Basic HTML'} preview`} onClose={() => setPreviewOpen(false)}>
          <p className="mb-3 text-xs font-bold text-slate-400">Preview is visual assistance only. Backend validation remains authoritative.</p>
          {form.mode === 'text' ? <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-700 bg-white p-4 font-sans text-sm text-slate-950">{form.text}</pre> : <iframe title="Sandboxed Business Mail HTML preview" sandbox="" referrerPolicy="no-referrer" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'"><base target="_self"></head><body>${form.html}</body></html>`} className="h-[60vh] w-full rounded-xl border border-slate-700 bg-white" />}
        </Modal>
      )}

      {confirmOpen && (
        <Modal title="Confirm Business Mail delivery" onClose={() => { if (!submitting) setConfirmOpen(false); }} initialFocusRef={confirmButtonRef}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Sender" value={selectedProfile ? `${selectedProfile.name} <${selectedProfile.email}>` : form.senderProfileKey} />
            <Detail label="Recipient" value={form.to.trim()} />
            <Detail label="Category" value={form.category} />
            <Detail label="Subject" value={form.subject.trim()} />
            <Detail label="Content mode" value={form.mode === 'text' ? 'Plain Text' : 'Basic HTML'} />
            <Detail label="Body characters" value={activeBody.length.toLocaleString()} />
          </dl>
          <p className="mt-4 rounded-lg border border-amber-800 bg-amber-950 p-3 text-sm font-bold text-amber-100">This action sends a real email through the configured provider. Verify the recipient and content before continuing.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmOpen(false)} disabled={submitting} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-black text-white hover:bg-slate-700 disabled:opacity-50">Cancel</button>
            <button ref={confirmButtonRef} type="button" onClick={() => void submitMail()} disabled={submitting} className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Sending Email...' : 'Send Email'}</button>
          </div>
        </Modal>
      )}

      {(detailLoading || selectedLog || detailError) && (
        <Modal title="Delivery log details" onClose={closeDetail}>
          {detailLoading ? <p className="py-10 text-center font-bold text-slate-400">Loading delivery details...</p> : detailError ? <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm font-bold text-red-200">{detailError}</p> : selectedLog && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3"><StatusBadge status={selectedLog.status} /><span className="break-all text-xs text-slate-500">{selectedLog.id}</span></div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Detail label="Category" value={selectedLog.category} /><Detail label="Sender profile" value={selectedLog.senderProfileKey} />
                <Detail label="Sender name" value={selectedLog.senderName} /><Detail label="Sender email" value={selectedLog.senderEmail} />
                <Detail label="Reply-To" value={selectedLog.replyTo} /><Detail label="Recipient" value={selectedLog.recipient} />
                <Detail label="Subject" value={selectedLog.subject} /><Detail label="Provider" value={formatProvider(selectedLog.provider)} />
                <Detail label="Provider message ID" value={selectedLog.providerMessageId} /><Detail label="Requested by" value={`${selectedLog.requestedByAdmin?.email || 'Not available'}${selectedLog.requestedByAdmin?.role ? ` (${selectedLog.requestedByAdmin.role})` : ''}`} />
                <Detail label="Metadata source" value={selectedLog.metadata?.source} /><Detail label="Correlation ID" value={selectedLog.metadata?.correlationId} />
                <Detail label="Failure code" value={selectedLog.failureCode} /><Detail label="Safe failure message" value={selectedLog.failureMessage} />
                <Detail label="Created" value={formatDateTime(selectedLog.createdAt)} /><Detail label="Sent" value={formatDateTime(selectedLog.sentAt)} />
                <Detail label="Failed" value={formatDateTime(selectedLog.failedAt)} />
              </dl>
            </div>
          )}
        </Modal>
      )}
    </section>
  );
}

function FilterSelect({ label, value, onChange, options, format = (item: string) => item.replace(/_/g, ' ') }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  format?: (value: string) => string;
}) {
  return <label className="text-sm font-bold text-slate-300">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"><option value="">All</option>{options.map((option) => <option key={option} value={option}>{format(option)}</option>)}</select></label>;
}

function FilterDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-bold text-slate-300">{label}<input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" /></label>;
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950 p-3"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-200">{value || 'Not available'}</dd></div>;
}
