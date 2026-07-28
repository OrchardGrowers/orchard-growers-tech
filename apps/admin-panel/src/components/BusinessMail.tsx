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
const MAX_COPY_RECIPIENTS = 5;
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const BUSINESS_MAIL_DRAFT_KEY = 'admin-business-mail-compose-draft-v1';
const ALLOWED_ATTACHMENT_TYPES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

type ContentMode = 'text' | 'html';
type ActiveMailArea = 'compose' | 'history' | 'settings';
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
  ccRecipients?: string[];
  bccRecipientCount?: number;
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
  subject: string;
  provider: string;
  providerMessageId: string;
  status: string;
  requestedByAdmin: { id: string; name: string; email: string; role: string };
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
  recipient: string;
  category: string;
  fromDate: string;
  toDate: string;
};
type ComposeForm = {
  senderProfileKey: string;
  to: string;
  cc: string;
  bcc: string;
  category: BusinessMailCategory;
  subject: string;
  mode: ContentMode;
  text: string;
  html: string;
  attachments: AttachmentDraft[];
};
type AttachmentDraft = {
  id: string;
  filename: string;
  contentType: string;
  content: string;
  size: number;
};
type FieldErrors = Partial<Record<'senderProfileKey' | 'to' | 'cc' | 'bcc' | 'subject' | 'content' | 'attachments', string>>;
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

export const parseBusinessMailRecipients = (value = '') =>
  value.split(/[,;\n]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);

const isSafeSavedDraftHtml = (value = '') =>
  !/<\s*\/?\s*(script|img|iframe|object|embed|form|input|button|textarea|select|option|meta|base|link|svg|math)\b/i.test(value)
  && !/\bon[a-z0-9_-]+\s*=/i.test(value)
  && !/(javascript:|vbscript:|data:text\/html|srcdoc\s*=)/i.test(value);

const validateBusinessMailCompose = (form: ComposeForm): FieldErrors => {
  const errors: FieldErrors = {};
  if (!form.senderProfileKey) errors.senderProfileKey = 'Select an enabled sender profile.';
  const recipient = form.to.trim();
  if (!recipient || /[,;\r\n]/.test(recipient) || !EMAIL_PATTERN.test(recipient)) {
    errors.to = 'Enter exactly one valid recipient email address.';
  }
  const cc = parseBusinessMailRecipients(form.cc);
  const bcc = parseBusinessMailRecipients(form.bcc);
  if (cc.length > MAX_COPY_RECIPIENTS || cc.some((email) => !EMAIL_PATTERN.test(email)) || new Set(cc).size !== cc.length) {
    errors.cc = `Enter up to ${MAX_COPY_RECIPIENTS} unique, valid CC addresses.`;
  }
  if (bcc.length > MAX_COPY_RECIPIENTS || bcc.some((email) => !EMAIL_PATTERN.test(email)) || new Set(bcc).size !== bcc.length) {
    errors.bcc = `Enter up to ${MAX_COPY_RECIPIENTS} unique, valid BCC addresses.`;
  }
  const allRecipients = [recipient.toLowerCase(), ...cc, ...bcc].filter(Boolean);
  if (new Set(allRecipients).size !== allRecipients.length) {
    errors.cc = 'To, CC, and BCC addresses must be unique.';
    errors.bcc = 'To, CC, and BCC addresses must be unique.';
  }
  const subject = form.subject.trim();
  if (!subject) errors.subject = 'Subject is required.';
  else if (form.subject.length > 200) errors.subject = 'Subject cannot exceed 200 characters.';
  const content = form.mode === 'text' ? form.text : form.html;
  if (!content.trim()) errors.content = form.mode === 'text' ? 'Plain-text content is required.' : 'HTML content is required.';
  if (form.mode === 'text' && form.text.length > 100000) errors.content = 'Plain text cannot exceed 100,000 characters.';
  if (form.mode === 'html' && form.html.length > 150000) errors.content = 'HTML cannot exceed 150,000 characters.';
  const totalAttachmentBytes = form.attachments.reduce((sum, item) => sum + item.size, 0);
  if (form.attachments.length > MAX_ATTACHMENTS || form.attachments.some((item) => item.size > MAX_ATTACHMENT_BYTES) || totalAttachmentBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    errors.attachments = 'Attach up to 5 allowed files, maximum 2 MB each and 5 MB combined.';
  }
  return errors;
};

const emptyFilters: Filters = {
  status: '',
  provider: '',
  senderProfileKey: '',
  recipient: '',
  category: '',
  fromDate: '',
  toDate: '',
};

const emptyCompose: ComposeForm = {
  senderProfileKey: '',
  to: '',
  cc: '',
  bcc: '',
  category: 'GENERAL',
  subject: '',
  mode: 'text',
  text: '',
  html: '',
  attachments: [],
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

const readAttachmentFile = (file: File) => new Promise<AttachmentDraft>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
  reader.onload = () => {
    const result = String(reader.result || '');
    const content = result.includes(',') ? result.slice(result.indexOf(',') + 1) : '';
    resolve({
      id: createIdempotencyKey(),
      filename: file.name,
      contentType: file.type,
      content,
      size: file.size,
    });
  };
  reader.readAsDataURL(file);
});

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

export const getBusinessMailStatusClass = (status: string) =>
  statusClasses[status] || 'border-slate-700 bg-slate-900 text-slate-300';

export const buildBusinessMailPreviewPayload = (form: ComposeForm) => ({
  senderProfileKey: form.senderProfileKey,
  ...(form.mode === 'text' ? { text: form.text } : { html: form.html }),
});

export const buildBusinessMailLogParams = (page: number, filters: Filters) => {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;
    if (key === 'fromDate') params.set(key, `${value}T00:00:00.000Z`);
    else if (key === 'toDate') params.set(key, `${value}T23:59:59.999Z`);
    else params.set(key, value);
  });
  return params;
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${getBusinessMailStatusClass(status)}`}>
      {status || 'UNKNOWN'}
    </span>
  );
}

export function AutoSignatureSettings({ profile }: { profile?: SenderProfile }) {
  return (
    <article className="scroll-mb-20 rounded-xl border border-slate-700 bg-slate-900 p-4" aria-labelledby="auto-signature-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="auto-signature-settings-title" className="text-sm font-black text-white">Auto Signature Settings</h2>
          <p className="mt-1 text-xs font-semibold text-slate-400">A controlled signature is added automatically to the final email.</p>
        </div>
        <span className="rounded-full border border-emerald-700 bg-emerald-950 px-3 py-1 text-xs font-black text-emerald-200">Enabled</span>
      </div>
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm font-semibold text-slate-300">
        <span className="block text-xs font-black uppercase tracking-wide text-slate-500">Signature source</span>
        <span className="mt-1 block">
          {profile ? `${profile.name} <${profile.email}>` : 'Select a sender profile'}
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold text-slate-400">The signature is selected from the sender profile, generated by the backend, and is not editable. Use Preview to review the signed message.</p>
    </article>
  );
}

function MailGlyph({ name }: { name: 'compose' | 'history' | 'sent' | 'failed' | 'settings' | 'account' }) {
  const paths: Record<typeof name, ReactNode> = {
    compose: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>,
    sent: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    failed: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    account: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 shrink-0">{paths[name]}</svg>;
}

function MailWorkspaceNavigation({
  activeArea,
  activeStatus,
  profiles,
  selectedProfileKey,
  total,
  onCompose,
  onHistory,
  onSettings,
  onSelectProfile,
}: {
  activeArea: ActiveMailArea;
  activeStatus: string;
  profiles: SenderProfile[];
  selectedProfileKey: string;
  total: number;
  onCompose: () => void;
  onHistory: (status?: string) => void;
  onSettings: () => void;
  onSelectProfile: (key: string) => void;
}) {
  const navClass = (selected: boolean) =>
    `flex min-h-10 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
      selected ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <aside className="border-b border-slate-700 bg-slate-900 p-3 lg:min-h-[720px] lg:border-b-0 lg:border-r">
      <button type="button" onClick={onCompose} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-black text-white shadow-sm hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-300">
        <span className="text-lg leading-none">+</span> New message
      </button>

      <nav className="mt-4 grid grid-cols-2 gap-1 sm:grid-cols-4 lg:block lg:space-y-1" aria-label="Business Mail folders">
        <button type="button" onClick={onCompose} className={navClass(activeArea === 'compose')}><MailGlyph name="compose" /> Compose</button>
        <button type="button" onClick={() => onHistory('')} className={navClass(activeArea === 'history' && !activeStatus)}><MailGlyph name="history" /> Activity <span className="ml-auto rounded-full bg-slate-950/60 px-2 py-0.5 text-[10px]">{total}</span></button>
        <button type="button" onClick={() => onHistory('SENT')} className={navClass(activeArea === 'history' && activeStatus === 'SENT')}><MailGlyph name="sent" /> Sent</button>
        <button type="button" onClick={() => onHistory('FAILED')} className={navClass(activeArea === 'history' && activeStatus === 'FAILED')}><MailGlyph name="failed" /> Failed</button>
      </nav>

      <div className="mt-5 border-t border-slate-700 pt-4">
        <div className="flex items-center justify-between gap-2 px-2">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">Business accounts</p>
          <span className="text-[10px] font-bold text-slate-600">{profiles.length}</span>
        </div>
        <div className="mt-2 max-h-64 space-y-1 overflow-y-auto pr-1 lg:max-h-[360px]">
          {profiles.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-xs font-semibold text-slate-500">No sender accounts loaded.</p>
          ) : profiles.map((profile) => (
            <button
              key={profile.key}
              type="button"
              onClick={() => onSelectProfile(profile.key)}
              className={`flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                selectedProfileKey === profile.key ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/70'
              }`}
            >
              <span className={`mt-0.5 rounded-md p-1.5 ${profile.enabled ? 'bg-emerald-950 text-emerald-300' : 'bg-slate-950 text-slate-600'}`}><MailGlyph name="account" /></span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-black">{profile.name}</span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-500">{profile.email}</span>
              </span>
              <span className={`ml-auto mt-1 h-2 w-2 shrink-0 rounded-full ${profile.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} title={profile.enabled ? 'Enabled' : 'Disabled'} />
            </button>
          ))}
        </div>
      </div>

      <button type="button" onClick={onSettings} className={`mt-5 ${navClass(activeArea === 'settings')}`}><MailGlyph name="settings" /> Identity settings</button>
      <p className="mt-3 px-2 text-[10px] font-semibold leading-4 text-slate-600">Accounts and delivery credentials are centrally controlled by the secure mail service.</p>
    </aside>
  );
}

function BusinessMailIdentitySettings({
  profiles,
  selectedProfile,
  providerStatus,
  onSelectProfile,
  onRefresh,
  loading,
}: {
  profiles: SenderProfile[];
  selectedProfile?: SenderProfile;
  providerStatus: ProviderStatus | null;
  onSelectProfile: (key: string) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const organization = selectedProfile?.email.endsWith('@efruitmandi.live') ? 'eFruitMandi' : 'Orchard Growers Private Limited';
  const fieldClass = 'mt-1.5 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-slate-200 outline-none';

  return (
    <section className="space-y-5" aria-labelledby="business-mail-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-400">Account settings</p>
          <h2 id="business-mail-settings-title" className="mt-1 text-xl font-black text-white">Default Identity</h2>
          <p className="mt-1 text-sm font-semibold text-slate-400">Review the identity recipients see when an authorized admin sends a message.</p>
        </div>
        <button type="button" onClick={onRefresh} disabled={loading} className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-black text-white hover:bg-slate-700 disabled:opacity-50">{loading ? 'Refreshing...' : 'Refresh settings'}</button>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4 sm:p-5">
        <label className="block text-sm font-bold text-slate-200">
          Business account
          <select value={selectedProfile?.key || ''} onChange={(event) => onSelectProfile(event.target.value)} className={`${fieldClass} appearance-auto`}>
            <option value="">Select a sender identity</option>
            {profiles.map((profile) => <option key={profile.key} value={profile.key}>{profile.name} &lt;{profile.email}&gt;{profile.enabled ? '' : ' - disabled'}</option>)}
          </select>
        </label>

        {selectedProfile ? (
          <>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <ReadOnlyIdentityField label="Your name" value={selectedProfile.name} />
              <ReadOnlyIdentityField label="Email address" value={selectedProfile.email} />
              <ReadOnlyIdentityField label="Reply-to address" value={selectedProfile.replyTo || 'Replies are not enabled for this identity'} />
              <ReadOnlyIdentityField label="Organization" value={organization} />
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <AutoSignatureSettings profile={selectedProfile} />
              <article className="rounded-xl border border-slate-700 bg-slate-950 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Outgoing server</p>
                <p className="mt-2 text-base font-black text-white">{formatProvider(providerStatus?.provider)}</p>
                <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black ${providerStatus?.configured ? 'border-emerald-700 bg-emerald-950 text-emerald-200' : 'border-amber-700 bg-amber-950 text-amber-200'}`}>{providerStatus?.configured ? 'Connected' : 'Not configured'}</span>
                <dl className="mt-4 space-y-3 text-xs">
                  <div><dt className="font-black uppercase text-slate-600">Sender status</dt><dd className="mt-1 font-bold text-slate-300">{selectedProfile.enabled ? 'Enabled' : 'Disabled'}</dd></div>
                  <div><dt className="font-black uppercase text-slate-600">Reply capable</dt><dd className="mt-1 font-bold text-slate-300">{selectedProfile.replyCapable ? 'Yes' : 'No'}</dd></div>
                  <div><dt className="font-black uppercase text-slate-600">Profile key</dt><dd className="mt-1 break-all font-mono text-slate-400">{selectedProfile.key}</dd></div>
                </dl>
              </article>
            </div>
          </>
        ) : <p className="mt-5 rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm font-bold text-slate-500">Select a business account to review its identity.</p>}
      </div>

      <div className="rounded-xl border border-sky-900 bg-sky-950/50 p-4 text-sm font-semibold leading-6 text-sky-100">
        <strong className="block font-black">Protected configuration</strong>
        Display names, sender addresses, reply routing, signatures, and provider credentials are managed by the backend environment. This prevents browser users from exposing or replacing production mail credentials.
      </div>
    </section>
  );
}

function ReadOnlyIdentityField({ label, value }: { label: string; value: string }) {
  return <label className="block text-sm font-bold text-slate-300">{label}<input value={value} readOnly aria-readonly="true" className="mt-1.5 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-slate-200 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500" /></label>;
}

function RichMailEditor({ value, onChange, invalid }: { value: string; onChange: (value: string) => void; invalid: boolean }) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) editor.innerHTML = value;
  }, [value]);

  const command = (name: string, commandValue?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, commandValue);
    onChange(editorRef.current?.innerHTML || '');
  };

  const addLink = () => {
    const href = window.prompt('Enter an https://, http://, or mailto: link');
    if (!href) return;
    if (!/^(https?:\/\/|mailto:)/i.test(href.trim())) {
      window.alert('Only http, https, and mailto links are allowed.');
      return;
    }
    command('createLink', href.trim());
  };

  const addEmoji = () => command('insertText', '🙂');

  return (
    <div className={`overflow-hidden rounded-xl border bg-slate-950 ${invalid ? 'border-red-600' : 'border-slate-700 focus-within:border-emerald-400'}`}>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-700 bg-slate-900 p-2" role="toolbar" aria-label="Message formatting">
        <select aria-label="Paragraph style" defaultValue="p" onChange={(event) => command('formatBlock', `<${event.target.value}>`)} className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs font-bold text-slate-200">
          <option value="p">Paragraph</option><option value="h2">Heading</option><option value="blockquote">Quote</option>
        </select>
        <EditorButton label="Bold" onClick={() => command('bold')}><strong>B</strong></EditorButton>
        <EditorButton label="Italic" onClick={() => command('italic')}><em>I</em></EditorButton>
        <EditorButton label="Underline" onClick={() => command('underline')}><span className="underline">U</span></EditorButton>
        <span className="mx-1 h-6 w-px bg-slate-700" />
        <EditorButton label="Bulleted list" onClick={() => command('insertUnorderedList')}>• List</EditorButton>
        <EditorButton label="Numbered list" onClick={() => command('insertOrderedList')}>1. List</EditorButton>
        <EditorButton label="Decrease indent" onClick={() => command('outdent')}>←</EditorButton>
        <EditorButton label="Increase indent" onClick={() => command('indent')}>→</EditorButton>
        <EditorButton label="Add link" onClick={addLink}>Link</EditorButton>
        <EditorButton label="Remove formatting" onClick={() => command('removeFormat')}>Clear</EditorButton>
        <EditorButton label="Insert emoji" onClick={addEmoji}>🙂</EditorButton>
      </div>
      <div className="relative">
        {!value && <span className="pointer-events-none absolute left-4 top-3 text-sm text-slate-600">Write your message…</span>}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Rich HTML message body"
          spellCheck
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          onPaste={(event) => {
            event.preventDefault();
            document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
          }}
          className="min-h-[360px] p-4 text-sm leading-6 text-slate-100 outline-none [&_a]:text-sky-400 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-600 [&_blockquote]:pl-3 [&_h2]:text-xl [&_h2]:font-black [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6"
        />
      </div>
    </div>
  );
}

function EditorButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return <button type="button" title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={onClick} className="min-h-9 rounded-md px-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400">{children}</button>;
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
  const [activeArea, setActiveArea] = useState<ActiveMailArea>('compose');
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [profiles, setProfiles] = useState<SenderProfile[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [form, setForm] = useState<ComposeForm>(emptyCompose);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contactQuery, setContactQuery] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewContent, setPreviewContent] = useState<{ text: string; html: string } | null>(null);
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
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const logsRequestId = useRef(0);
  const sendInFlight = useRef(false);

  const enabledProfiles = useMemo(() => profiles.filter((profile) => profile.enabled), [profiles]);
  const selectedProfile = profiles.find((profile) => profile.key === form.senderProfileKey);
  const activeBody = form.mode === 'text' ? form.text : form.html;
  const canSend = Boolean(providerStatus?.configured && selectedProfile?.enabled && !submitting);
  const hasUnsentDraft = Boolean(form.to.trim() || form.cc.trim() || form.bcc.trim() || form.subject.trim() || form.text.trim() || form.html.trim() || form.attachments.length);
  const recentContacts = useMemo(() => {
    const unique = new Set<string>();
    logs.forEach((log) => {
      if (log.recipient) unique.add(log.recipient);
      log.ccRecipients?.forEach((email) => unique.add(email));
    });
    return Array.from(unique).slice(0, 40);
  }, [logs]);
  const visibleContacts = recentContacts.filter((email) => email.includes(contactQuery.trim().toLowerCase()));

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
    const params = buildBusinessMailLogParams(page, filters);
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
  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(BUSINESS_MAIL_DRAFT_KEY);
      if (!rawDraft) return;
      const saved = JSON.parse(rawDraft) as Partial<ComposeForm>;
      setForm((current) => ({
        ...current,
        to: typeof saved.to === 'string' ? saved.to : '',
        cc: typeof saved.cc === 'string' ? saved.cc : '',
        bcc: typeof saved.bcc === 'string' ? saved.bcc : '',
        category: CATEGORIES.includes(saved.category as BusinessMailCategory) ? saved.category as BusinessMailCategory : current.category,
        subject: typeof saved.subject === 'string' ? saved.subject : '',
        mode: saved.mode === 'html' ? 'html' : 'text',
        text: typeof saved.text === 'string' ? saved.text : '',
        html: typeof saved.html === 'string' && isSafeSavedDraftHtml(saved.html) ? saved.html : '',
        attachments: [],
      }));
      setShowCc(Boolean(saved.cc));
      setShowBcc(Boolean(saved.bcc));
      setDraftStatus('Saved draft restored. Attachments are never stored in browser drafts.');
    } catch {
      window.localStorage.removeItem(BUSINESS_MAIL_DRAFT_KEY);
    }
  }, []);
  useEffect(() => {
    if (!hasUnsentDraft) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsentDraft]);

  const updateForm = <K extends keyof ComposeForm>(key: K, value: ComposeForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key === 'text' || key === 'html' || key === 'mode' ? 'content' : key]: undefined }));
    if (idempotencyKey) setIdempotencyKey('');
    setSendError('');
    setSendResult(null);
    setPreviewContent(null);
    setPreviewError('');
    setDraftStatus('');
  };

  const saveDraft = () => {
    try {
      const safeDraft = {
        senderProfileKey: form.senderProfileKey,
        to: form.to,
        cc: form.cc,
        bcc: form.bcc,
        category: form.category,
        subject: form.subject,
        mode: form.mode,
        text: form.text,
        html: form.html,
      };
      window.localStorage.setItem(BUSINESS_MAIL_DRAFT_KEY, JSON.stringify(safeDraft));
      setDraftStatus(`Draft saved on this browser at ${new Date().toLocaleTimeString()}. Attachments are not stored.`);
    } catch {
      setDraftStatus('Draft could not be saved in this browser.');
    }
  };

  const attachFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setFieldErrors((current) => ({ ...current, attachments: undefined }));
    const candidates = Array.from(files);
    const combined = [...form.attachments, ...candidates.map((file) => ({ size: file.size }))].reduce((sum, item) => sum + item.size, 0);
    const invalid = candidates.find((file) => !ALLOWED_ATTACHMENT_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES);
    if (invalid || form.attachments.length + candidates.length > MAX_ATTACHMENTS || combined > MAX_TOTAL_ATTACHMENT_BYTES) {
      setFieldErrors((current) => ({ ...current, attachments: 'Use PDF, JPG, PNG, WebP, TXT, CSV, DOCX, or XLSX files; maximum 2 MB each, 5 files, and 5 MB combined.' }));
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      return;
    }
    try {
      const next = await Promise.all(candidates.map(readAttachmentFile));
      updateForm('attachments', [...form.attachments, ...next]);
    } catch (error) {
      setFieldErrors((current) => ({ ...current, attachments: error instanceof Error ? error.message : 'Could not read attachment.' }));
    } finally {
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => updateForm('attachments', form.attachments.filter((item) => item.id !== id));

  const showPreview = async () => {
    if (!form.senderProfileKey || !activeBody.trim() || previewLoading) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewContent(null);
    try {
      const body = await requestBusinessMailJson<{
        preview: { text: string; html: string };
      }>(`${endpoint}/preview`, authHeaders, {
        method: 'POST',
        body: JSON.stringify(buildBusinessMailPreviewPayload(form)),
      });
      setPreviewContent(body.preview);
    } catch (error) {
      setPreviewError(getBusinessMailErrorMessage(error));
    } finally {
      setPreviewLoading(false);
    }
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
          cc: parseBusinessMailRecipients(form.cc),
          bcc: parseBusinessMailRecipients(form.bcc),
          subject: form.subject.trim(),
          category: form.category,
          ...(form.mode === 'text' ? { text: form.text } : { html: form.html }),
          attachments: form.attachments.map(({ filename, contentType, content }) => ({ filename, contentType, content })),
          metadata: { source: 'admin-panel' },
          idempotencyKey: currentKey,
        }),
      });
      setSendResult(body.delivery);
      setConfirmOpen(false);
      setForm((current) => ({ ...current, to: '', cc: '', bcc: '', subject: '', text: '', html: '', attachments: [] }));
      setShowCc(false);
      setShowBcc(false);
      window.localStorage.removeItem(BUSINESS_MAIL_DRAFT_KEY);
      setDraftStatus('');
      setFieldErrors({});
      setIdempotencyKey('');
      await loadLogs(1, appliedFilters);
    } catch (error) {
      setConfirmOpen(false);
      setSendError(getBusinessMailErrorMessage(error, true));
      if (error instanceof BusinessMailApiError) {
        if (error.status === 400) {
          if (error.code.includes('RECIPIENT')) {
            if (/\bbcc\b/i.test(error.message)) setFieldErrors((current) => ({ ...current, bcc: error.message }));
            else if (/\bcc\b/i.test(error.message)) setFieldErrors((current) => ({ ...current, cc: error.message }));
            else setFieldErrors((current) => ({ ...current, to: error.message }));
          }
          else if (error.code.includes('SUBJECT')) setFieldErrors((current) => ({ ...current, subject: error.message }));
          else if (error.code.includes('CONTENT') || error.code.includes('HTML')) setFieldErrors((current) => ({ ...current, content: error.message }));
          else if (error.code.includes('ATTACHMENT')) setFieldErrors((current) => ({ ...current, attachments: error.message }));
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
    setForm((current) => ({ ...emptyCompose, attachments: [], senderProfileKey: current.senderProfileKey, category: current.category }));
    setShowCc(false);
    setShowBcc(false);
    window.localStorage.removeItem(BUSINESS_MAIL_DRAFT_KEY);
    setDraftStatus('');
    setFieldErrors({});
    setPreviewOpen(false);
    setPreviewContent(null);
    setPreviewError('');
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

  const openCompose = () => setActiveArea('compose');

  const openHistory = (status = '') => {
    const nextFilters = { ...emptyFilters, status };
    setDraftFilters(nextFilters);
    setPagination((current) => ({ ...current, page: 1 }));
    setAppliedFilters(nextFilters);
    setActiveArea('history');
  };

  const selectProfile = (key: string, destination: ActiveMailArea = activeArea) => {
    updateForm('senderProfileKey', key);
    setActiveArea(destination);
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

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-xl shadow-black/20 lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
        <MailWorkspaceNavigation
          activeArea={activeArea}
          activeStatus={appliedFilters.status}
          profiles={profiles}
          selectedProfileKey={form.senderProfileKey}
          total={pagination.total}
          onCompose={openCompose}
          onHistory={openHistory}
          onSettings={() => setActiveArea('settings')}
          onSelectProfile={(key) => selectProfile(key, 'settings')}
        />

        <div className="min-w-0 space-y-4 bg-slate-950/50 p-4 sm:p-5">
      <article className="rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-sm shadow-black/20">
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
                <p className="mt-2 text-sm font-semibold text-slate-300">To / CC / BCC<br />Plain or rich text<br />Safe attachments</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
                <p className="text-xs font-black uppercase text-slate-500">Unsupported</p>
                <p className="mt-2 text-sm font-semibold text-slate-300">Executable files<br />Remote images<br />Scheduling / bulk</p>
              </div>
            </div>
          </div>
        )}
      </article>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-700" role="tablist" aria-label="Business Mail areas">
        {(['compose', 'history', 'settings'] as const).map((area) => (
          <button key={area} type="button" role="tab" aria-selected={activeArea === area} onClick={() => setActiveArea(area)} className={`border-b-2 px-4 py-3 text-sm font-black focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400 ${activeArea === area ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {area === 'compose' ? 'Compose' : area === 'history' ? `Delivery History${pagination.total ? ` (${pagination.total})` : ''}` : 'Identity Settings'}
          </button>
        ))}
      </div>

      {activeArea === 'compose' && (
        <form onSubmit={openConfirmation} className="space-y-4 pb-4 sm:pb-6" noValidate>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 p-2">
            <button type="submit" disabled={!canSend} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><MailGlyph name="sent" /> Send</button>
            <button type="button" onClick={saveDraft} className="min-h-10 rounded-lg px-3 text-sm font-bold text-slate-200 hover:bg-slate-800">Save draft</button>
            <button type="button" onClick={() => setContactsOpen(true)} className="min-h-10 rounded-lg px-3 text-sm font-bold text-slate-200 hover:bg-slate-800">Contacts</button>
            <button type="button" onClick={() => attachmentInputRef.current?.click()} className="ml-auto min-h-10 rounded-lg px-3 text-sm font-bold text-slate-200 hover:bg-slate-800">Attach files</button>
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              className="sr-only"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.docx,.xlsx"
              onChange={(event) => void attachFiles(event.target.files)}
            />
          </div>
          {draftStatus && <p role="status" className="rounded-lg border border-sky-900 bg-sky-950/60 px-3 py-2 text-xs font-bold text-sky-100">{draftStatus}</p>}
          {!overviewLoading && !overviewError && enabledProfiles.length === 0 && (
            <p role="status" className="rounded-lg border border-amber-800 bg-amber-950 p-3 text-sm font-bold text-amber-100">
              No Business Mail sender profile is currently available. Personal senders require an enabled controlled profile that exactly matches your login email.
            </p>
          )}
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
              <span className="flex items-center justify-between gap-3"><span>To</span><span className="flex gap-3 text-xs"><button type="button" onClick={() => setShowCc((value) => !value)} className="text-sky-300 hover:text-sky-200">CC</button><button type="button" onClick={() => setShowBcc((value) => !value)} className="text-sky-300 hover:text-sky-200">BCC</button></span></span>
              <input type="email" value={form.to} onChange={(event) => updateForm('to', event.target.value)} maxLength={320} autoComplete="off" placeholder="recipient@example.com" aria-invalid={Boolean(fieldErrors.to)} aria-describedby={fieldErrors.to ? 'recipient-error' : 'recipient-help'} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" />
              <span id="recipient-help" className="mt-1 block text-xs text-slate-400">One primary recipient. Add up to five unique CC and five BCC addresses.</span>
              {fieldErrors.to && <span id="recipient-error" className="mt-1 block text-xs text-red-300">{fieldErrors.to}</span>}
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ReadOnlyIdentityField label="Reply-to" value={selectedProfile?.replyTo || 'Replies are not enabled for this sender'} />
            <ReadOnlyIdentityField label="From identity" value={selectedProfile ? `${selectedProfile.name} <${selectedProfile.email}>` : 'Select a sender profile'} />
          </div>

          {(showCc || showBcc) && (
            <div className="grid gap-4 lg:grid-cols-2">
              {showCc && <RecipientListField label="CC" value={form.cc} onChange={(value) => updateForm('cc', value)} error={fieldErrors.cc} />}
              {showBcc && <RecipientListField label="BCC" value={form.bcc} onChange={(value) => updateForm('bcc', value)} error={fieldErrors.bcc} />}
            </div>
          )}

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
              <button type="button" aria-pressed={form.mode === 'html'} onClick={() => updateForm('mode', 'html')} className={`rounded-lg px-4 py-2 text-sm font-black focus:outline-none focus:ring-2 focus:ring-emerald-400 ${form.mode === 'html' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>Rich Text</button>
            </div>
          </fieldset>

          <div className="block text-sm font-bold text-slate-200">
            <div id="business-mail-body-label" className="flex justify-between gap-3"><span>{form.mode === 'text' ? 'Plain-text body' : 'Rich message body'}</span><span className={activeBody.length > (form.mode === 'text' ? 100000 : 150000) ? 'text-red-300' : 'text-slate-400'}>{activeBody.length.toLocaleString()}/{(form.mode === 'text' ? 100000 : 150000).toLocaleString()}</span></div>
            {form.mode === 'html' && <span className="mt-1 block rounded-lg border border-amber-800 bg-amber-950 p-2 text-xs text-amber-100">Only restrictive, safe email HTML is accepted. Scripts, embeds, forms, event handlers, and unsafe links are rejected by the backend.</span>}
            {form.mode === 'text'
              ? <textarea value={form.text} onChange={(event) => updateForm('text', event.target.value)} maxLength={100001} rows={14} spellCheck aria-labelledby="business-mail-body-label" aria-invalid={Boolean(fieldErrors.content)} aria-describedby={fieldErrors.content ? 'content-error' : undefined} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-sans text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" />
              : <div className="mt-2"><RichMailEditor value={form.html} onChange={(value) => updateForm('html', value)} invalid={Boolean(fieldErrors.content)} /></div>}
            {fieldErrors.content && <span id="content-error" className="mt-1 block text-xs text-red-300">{fieldErrors.content}</span>}
          </div>

          {form.attachments.length > 0 && (
            <section className="rounded-xl border border-slate-700 bg-slate-900 p-4" aria-labelledby="mail-attachments-title">
              <div className="flex items-center justify-between gap-3"><h2 id="mail-attachments-title" className="text-sm font-black text-white">Attachments ({form.attachments.length}/{MAX_ATTACHMENTS})</h2><span className="text-xs font-bold text-slate-500">{formatFileSize(form.attachments.reduce((sum, item) => sum + item.size, 0))} / 5 MB</span></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {form.attachments.map((attachment) => <div key={attachment.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3"><span className="rounded bg-sky-950 px-2 py-1 text-[10px] font-black uppercase text-sky-300">{attachment.filename.split('.').pop() || 'file'}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-200">{attachment.filename}</span><span className="text-[10px] text-slate-500">{formatFileSize(attachment.size)}</span></span><button type="button" onClick={() => removeAttachment(attachment.id)} aria-label={`Remove ${attachment.filename}`} className="rounded px-2 py-1 text-xs font-black text-red-300 hover:bg-red-950">Remove</button></div>)}
              </div>
            </section>
          )}
          {fieldErrors.attachments && <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-xs font-bold text-red-200">{fieldErrors.attachments}</p>}

          <AutoSignatureSettings profile={selectedProfile} />

          <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-slate-800 bg-slate-950/95 py-3 backdrop-blur">
            <button type="button" onClick={resetForm} disabled={submitting} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-black text-white hover:bg-slate-700 disabled:opacity-60">Reset</button>
            <button type="button" onClick={() => void showPreview()} disabled={!form.senderProfileKey || !activeBody.trim() || previewLoading} className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-black text-white hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50">{previewLoading ? 'Preparing Preview...' : 'Preview'}</button>
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
              <FilterText label="Recipient contains" value={draftFilters.recipient} onChange={(value) => setDraftFilters((current) => ({ ...current, recipient: value }))} />
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
              <BusinessMailHistoryRows logs={logs} loading={logsLoading} onView={(id) => void showLogDetail(id)} />
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

      {activeArea === 'settings' && (
        <BusinessMailIdentitySettings
          profiles={profiles}
          selectedProfile={selectedProfile}
          providerStatus={providerStatus}
          onSelectProfile={(key) => selectProfile(key, 'settings')}
          onRefresh={() => void loadOverview()}
          loading={overviewLoading}
        />
      )}
        </div>
      </div>

      {contactsOpen && (
        <Modal title="Recent Business Mail contacts" onClose={() => setContactsOpen(false)}>
          <p className="text-sm font-semibold text-slate-400">Choose a recipient from your authorized delivery history.</p>
          <input type="search" value={contactQuery} onChange={(event) => setContactQuery(event.target.value)} placeholder="Search email address" className="mt-4 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400" />
          <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto">
            {visibleContacts.length ? visibleContacts.map((email) => <button key={email} type="button" onClick={() => { updateForm('to', email); setContactsOpen(false); }} className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-left text-sm font-bold text-slate-200 hover:border-emerald-600 hover:bg-slate-800"><MailGlyph name="account" />{email}</button>) : <p className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm font-bold text-slate-500">No matching recent contacts.</p>}
          </div>
        </Modal>
      )}

      {previewOpen && (
        <Modal title={`${form.mode === 'text' ? 'Plain-text' : 'Basic HTML'} preview`} onClose={() => setPreviewOpen(false)}>
          <p className="mb-3 text-xs font-bold text-slate-400">Final backend-generated preview. The controlled signature is added automatically and is not editable.</p>
          {previewLoading ? <p className="py-10 text-center font-bold text-slate-400">Preparing signed preview...</p> : previewError ? <p role="alert" className="rounded-lg border border-red-800 bg-red-950 p-3 text-sm font-bold text-red-200">{previewError}</p> : previewContent && (form.mode === 'text' ? <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-700 bg-white p-4 font-sans text-sm text-slate-950">{previewContent.text}</pre> : <iframe title="Sandboxed signed Business Mail HTML preview" sandbox="" referrerPolicy="no-referrer" srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"></head><body>${previewContent.html}</body></html>`} className="h-[60vh] w-full rounded-xl border border-slate-700 bg-white" />)}
        </Modal>
      )}

      {confirmOpen && (
        <Modal title="Confirm Business Mail delivery" onClose={() => { if (!submitting) setConfirmOpen(false); }} initialFocusRef={confirmButtonRef}>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Sender" value={selectedProfile ? `${selectedProfile.name} <${selectedProfile.email}>` : form.senderProfileKey} />
            <Detail label="Recipient" value={form.to.trim()} />
            <Detail label="CC" value={parseBusinessMailRecipients(form.cc).join(', ')} />
            <Detail label="BCC" value={parseBusinessMailRecipients(form.bcc).join(', ')} />
            <Detail label="Category" value={form.category} />
            <Detail label="Subject" value={form.subject.trim()} />
            <Detail label="Content mode" value={form.mode === 'text' ? 'Plain Text' : 'Basic HTML'} />
            <Detail label="Body characters" value={activeBody.length.toLocaleString()} />
            <Detail label="Attachments" value={form.attachments.length ? `${form.attachments.length} file(s), ${formatFileSize(form.attachments.reduce((sum, item) => sum + item.size, 0))}` : 'None'} />
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
                <Detail label="CC" value={selectedLog.ccRecipients?.join(', ')} /><Detail label="BCC recipients" value={selectedLog.bccRecipientCount || 0} />
                <Detail label="Attachments" value={selectedLog.attachments?.length ? selectedLog.attachments.map((item) => `${item.filename} (${formatFileSize(item.size)})`).join(', ') : 'None'} />
                <Detail label="Subject" value={selectedLog.subject} /><Detail label="Provider" value={formatProvider(selectedLog.provider)} />
                <Detail label="Provider message ID" value={selectedLog.providerMessageId} /><Detail label="Requested by" value={`${selectedLog.requestedByAdmin?.name || selectedLog.requestedByAdmin?.email || 'Not available'}${selectedLog.requestedByAdmin?.email && selectedLog.requestedByAdmin?.name ? ` <${selectedLog.requestedByAdmin.email}>` : ''}${selectedLog.requestedByAdmin?.role ? ` (${selectedLog.requestedByAdmin.role})` : ''}`} />
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

export function BusinessMailHistoryRows({ logs, loading, onView }: {
  logs: DeliveryLog[];
  loading: boolean;
  onView: (id: string) => void;
}) {
  return (
    <tbody className="divide-y divide-slate-800 bg-slate-950">
      {loading ? <tr><td colSpan={9} className="px-4 py-10 text-center font-bold text-slate-400">Loading delivery history...</td></tr> : logs.length === 0 ? <tr><td colSpan={9} className="px-4 py-10 text-center font-bold text-slate-400">No Business Mail deliveries found.</td></tr> : logs.map((log) => (
        <tr key={log.id} className="align-top hover:bg-slate-900/70">
          <td className="whitespace-nowrap px-3 py-3 text-slate-300">{formatDateTime(log.createdAt)}</td>
          <td className="px-3 py-3"><span className="block font-bold text-white">{log.senderName || log.senderProfileKey}</span><span className="block text-xs text-slate-500">{log.senderEmail}</span></td>
          <td className="px-3 py-3 text-slate-300">{log.recipient}</td>
          <td className="px-3 py-3 text-slate-300">{log.category}</td>
          <td className="max-w-[240px] px-3 py-3 text-slate-300"><span className="line-clamp-2">{log.subject}</span></td>
          <td className="px-3 py-3 text-slate-300"><span className="block">{formatProvider(log.provider)}</span><span className="block max-w-[180px] truncate text-xs text-slate-500" title={log.providerMessageId}>{log.providerMessageId || 'No reference'}</span></td>
          <td className="px-3 py-3"><StatusBadge status={log.status} /></td>
          <td className="px-3 py-3"><span className="block text-slate-300">{log.requestedByAdmin?.name || log.requestedByAdmin?.email || 'Not available'}</span><span className="text-xs text-slate-500">{log.requestedByAdmin?.email || log.requestedByAdmin?.role}</span></td>
          <td className="px-3 py-3"><button type="button" onClick={() => onView(log.id)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-black text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400">View</button></td>
        </tr>
      ))}
    </tbody>
  );
}

function FilterDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-bold text-slate-300">{label}<input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" /></label>;
}

function FilterText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-bold text-slate-300">{label}<input type="search" value={value} maxLength={320} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" /></label>;
}

function RecipientListField({ label, value, onChange, error }: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  return <label className="block text-sm font-bold text-slate-200">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder="name@example.com, second@example.com" aria-invalid={Boolean(error)} className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400" /><span className="mt-1 block text-xs text-slate-500">Separate up to five addresses with commas.</span>{error && <span className="mt-1 block text-xs text-red-300">{error}</span>}</label>;
}

const formatFileSize = (bytes: number) => bytes >= 1024 * 1024
  ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  const displayValue = value === undefined || value === null || value === '' ? 'Not available' : value;
  return <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950 p-3"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-200">{displayValue}</dd></div>;
}
