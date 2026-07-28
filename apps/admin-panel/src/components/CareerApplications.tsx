import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';

const STATUSES = ['NEW', 'REVIEWED', 'CONTACTED', 'INTERVIEW_SCHEDULED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'DUPLICATE'] as const;
const FIELDS_OF_WORK = ['TECHNOLOGY', 'AGRICULTURE', 'FINANCE', 'SALES', 'MARKETING', 'LOGISTICS', 'HR', 'OPERATIONS', 'CUSTOMER_SUPPORT', 'PHARMA', 'BIOTECH', 'OTHER', 'UNKNOWN'] as const;
const EXPERIENCE_RANGES = ['FRESHER', 'UNDER_2_YEARS', 'TWO_TO_FIVE_YEARS', 'ABOVE_5_YEARS', 'UNKNOWN'] as const;

const EXPORT_FORMATS = [
  ['EMAILS', 'Emails Only'],
  ['CONTACTS', 'Contact Numbers Only'],
  ['WHATSAPP', 'WhatsApp Numbers Only'],
  ['NAME_EMAIL', 'Name + Email'],
  ['NAME_CONTACT', 'Name + Contact Number'],
  ['EMAIL_CONTACT', 'Email + Contact Number'],
  ['NAME_EMAIL_CONTACT', 'Name + Email + Contact Number'],
  ['FULL_CONTACT', 'Full Candidate Contact'],
  ['ADDRESS_LIST', 'Address List'],
  ['SUMMARY', 'Candidate Summary'],
  ['ALL_FIELDS', 'All Available Fields'],
] as const;

const SEPARATORS = [
  ['COMMA', 'Comma'],
  ['SEMICOLON', 'Semicolon'],
  ['NEW_LINE', 'New Line'],
  ['TAB', 'Tab'],
  ['PIPE', 'Pipe'],
  ['CSV', 'CSV'],
] as const;

type Attachment = { filename?: string; contentType?: string; size?: number; contentId?: string; disposition?: string };
type CareerApplication = {
  _id: string;
  applicantName?: string;
  candidateName?: string;
  senderName?: string;
  senderEmail?: string;
  replyToEmail?: string;
  email?: string;
  subject?: string;
  emailSubject?: string;
  emailFrom?: string;
  receivedAt?: string;
  emailDate?: string;
  appliedDate?: string;
  bodyPreview?: string;
  textBody?: string;
  messageId?: string;
  status?: string;
  contactNumber?: string;
  normalizedContactNumber?: string;
  alternateContactNumber?: string;
  extractedPhoneNumbers?: string[];
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  qualification?: string;
  workExperienceText?: string;
  experienceYears?: number | null;
  experienceRange?: string;
  currentCompany?: string;
  currentDesignation?: string;
  skills?: string[];
  fieldOfWork?: string;
  notes?: string;
  tags?: string[];
  resumeFileName?: string;
  resumeContentType?: string;
  resumeSize?: number;
  attachments?: Attachment[];
};

type Filters = {
  search: string;
  status: string;
  fieldOfWork: string;
  experienceRange: string;
  state: string;
  qualification: string;
  hasEmail: boolean;
  hasContact: boolean;
  hasAddress: boolean;
  hasExperience: boolean;
  hasResume: boolean;
  dateFrom: string;
  dateTo: string;
};
type OptionCount = { value: string; count: number };
type FilterOptions = {
  states: OptionCount[];
  qualifications: OptionCount[];
  fieldsOfWork: OptionCount[];
  experienceRanges: OptionCount[];
  statuses: OptionCount[];
};
type ExportScope = 'all' | 'filters' | 'selected' | 'page';
type ExportFormat = typeof EXPORT_FORMATS[number][0];
type Separator = typeof SEPARATORS[number][0];
type ExportResult = { text: string; csv: string; exportedCount: number; duplicatesRemoved: number; label: string };

type Props = { apiBase: string; authHeaders: Record<string, string> };

const emptyFilters: Filters = {
  search: '', status: '', fieldOfWork: '', experienceRange: '', state: '', qualification: '',
  hasEmail: false, hasContact: false, hasAddress: false, hasExperience: false, hasResume: false,
  dateFrom: '', dateTo: '',
};
const emptyFilterOptions: FilterOptions = { states: [], qualifications: [], fieldsOfWork: [], experienceRanges: [], statuses: [] };
const readJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
};
const readable = (value?: string) => (value || 'UNKNOWN').replace(/_/g, ' ');
const candidateName = (item: CareerApplication) => item.candidateName || item.applicantName || item.senderName || 'Unknown Applicant';
const candidateEmail = (item: CareerApplication) => item.email || item.replyToEmail || item.senderEmail || '';
const formatDate = (value?: string) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
};
const digitsOnly = (value?: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 12 && digits.indexOf('91') === 0 ? digits.slice(2) : digits;
};
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const separatorCharacter = (separator: Separator) => ({
  COMMA: ', ', SEMICOLON: '; ', NEW_LINE: '\n', TAB: '\t', PIPE: ' | ', CSV: '\n',
}[separator]);

const appendFilters = (query: URLSearchParams, filters: Filters) => {
  Object.entries(filters).forEach(([key, value]) => {
    if (typeof value === 'boolean') {
      if (value) query.set(key, 'true');
    } else if (value) query.set(key, value);
  });
};

const uniqueCandidates = (records: CareerApplication[]) => {
  const seenEmails = new Set<string>();
  const seenContacts = new Set<string>();
  const seenMessages = new Set<string>();
  return records.filter((record) => {
    const email = candidateEmail(record).trim().toLowerCase();
    const contact = digitsOnly(record.normalizedContactNumber || record.contactNumber);
    const messageId = String(record.messageId || '').trim().toLowerCase();
    if (email && seenEmails.has(email)) return false;
    if (contact && seenContacts.has(contact)) return false;
    if (messageId && seenMessages.has(messageId)) return false;
    if (email) seenEmails.add(email);
    if (contact) seenContacts.add(contact);
    if (messageId) seenMessages.add(messageId);
    return true;
  });
};

const buildExportResult = (records: CareerApplication[], format: ExportFormat, separator: Separator): ExportResult => {
  const singleValue = format === 'EMAILS' || format === 'CONTACTS' || format === 'WHATSAPP';
  let rows: string[][] = [];
  let headers: string[] = [];
  let duplicatesRemoved = 0;
  let label = 'candidates';

  if (format === 'EMAILS') {
    headers = ['Email'];
    const values = records.map(candidateEmail).map((value) => value.trim().toLowerCase()).filter(Boolean);
    const unique = [...new Set(values)];
    duplicatesRemoved = values.length - unique.length;
    rows = unique.map((value) => [value]);
    label = 'unique emails';
  } else if (format === 'CONTACTS' || format === 'WHATSAPP') {
    headers = [format === 'WHATSAPP' ? 'WhatsApp Number' : 'Contact Number'];
    const values = records.map((record) => digitsOnly(record.normalizedContactNumber || record.contactNumber)).filter(Boolean);
    const unique = [...new Set(values)];
    duplicatesRemoved = values.length - unique.length;
    rows = unique.map((value) => [format === 'WHATSAPP' ? `91${value}` : value]);
    label = format === 'WHATSAPP' ? 'unique WhatsApp numbers' : 'unique contact numbers';
  } else {
    const unique = uniqueCandidates(records);
    duplicatesRemoved = records.length - unique.length;
    if (format === 'NAME_EMAIL') { headers = ['Name', 'Email']; rows = unique.map((item) => [candidateName(item), candidateEmail(item)]); }
    if (format === 'NAME_CONTACT') { headers = ['Name', 'Contact Number']; rows = unique.map((item) => [candidateName(item), digitsOnly(item.contactNumber)]); }
    if (format === 'EMAIL_CONTACT') { headers = ['Email', 'Contact Number']; rows = unique.map((item) => [candidateEmail(item), digitsOnly(item.contactNumber)]); }
    if (format === 'NAME_EMAIL_CONTACT') { headers = ['Name', 'Email', 'Contact Number']; rows = unique.map((item) => [candidateName(item), candidateEmail(item), digitsOnly(item.contactNumber)]); }
    if (format === 'FULL_CONTACT') { headers = ['Name', 'Email', 'Contact Number', 'City', 'State']; rows = unique.map((item) => [candidateName(item), candidateEmail(item), digitsOnly(item.contactNumber), item.city || '', item.state || '']); }
    if (format === 'ADDRESS_LIST') { headers = ['Name', 'Address', 'City', 'District', 'State', 'Postal Code']; rows = unique.map((item) => [candidateName(item), item.address || '', item.city || '', item.district || '', item.state || '', item.postalCode || '']); }
    if (format === 'SUMMARY') { headers = ['Name', 'Email', 'Contact', 'Qualification', 'Field', 'Experience', 'State']; rows = unique.map((item) => [candidateName(item), candidateEmail(item), digitsOnly(item.contactNumber), item.qualification || '', readable(item.fieldOfWork), item.workExperienceText || readable(item.experienceRange), item.state || '']); }
    if (format === 'ALL_FIELDS') {
      headers = ['Name', 'Email', 'Email From', 'Contact', 'Alternate Contact', 'Address', 'City', 'District', 'State', 'Postal Code', 'Qualification', 'Work Experience', 'Experience Years', 'Experience Range', 'Current Company', 'Current Designation', 'Skills', 'Field of Work', 'Applied Date', 'Email Subject', 'Status', 'Notes', 'Tags', 'Resume File', 'Resume Content Type', 'Resume Size', 'Message ID'];
      rows = unique.map((item) => [
      candidateName(item), candidateEmail(item), item.emailFrom || '', digitsOnly(item.contactNumber), digitsOnly(item.alternateContactNumber),
      item.address || '', item.city || '', item.district || '', item.state || '', item.postalCode || '',
      item.qualification || '', item.workExperienceText || '', item.experienceYears === null || item.experienceYears === undefined ? '' : String(item.experienceYears), readable(item.experienceRange),
      item.currentCompany || '', item.currentDesignation || '', (item.skills || []).join('; '), readable(item.fieldOfWork),
      formatDate(item.appliedDate || item.receivedAt || item.emailDate), item.emailSubject || item.subject || '',
      readable(item.status), item.notes || '', (item.tags || []).join('; '), item.resumeFileName || '',
      item.resumeContentType || '', item.resumeSize ? String(item.resumeSize) : '', item.messageId || '',
      ]);
    }
  }

  rows = rows.map((row) => row.map((value) => String(value ?? '').trim())).filter((row) => row.some(Boolean));
  const csvRows = headers.length ? [headers, ...rows] : rows;
  const text = separator === 'CSV'
    ? csvRows.map((row) => row.map(csvCell).join(',')).join('\r\n')
    : singleValue
      ? rows.map((row) => row[0]).join(separatorCharacter(separator))
      : rows.map((row) => row.filter(Boolean).join(' | ')).join(separatorCharacter(separator));
  const csv = csvRows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return { text, csv, exportedCount: rows.length, duplicatesRemoved, label };
};

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-200">{value === undefined || value === null || value === '' ? 'Not available' : value}</dd>
    </div>
  );
}

export default function CareerApplications({ apiBase, authHeaders }: Props) {
  const [applications, setApplications] = useState<CareerApplication[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<CareerApplication | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>(emptyFilterOptions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [openingAttachment, setOpeningAttachment] = useState('');
  const [message, setMessage] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('filters');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('EMAILS');
  const [separator, setSeparator] = useState<Separator>('COMMA');
  const [exporting, setExporting] = useState(false);
  const [exportOutput, setExportOutput] = useState('');
  const [exportCsv, setExportCsv] = useState('');
  const [exportSummary, setExportSummary] = useState('');

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), limit: '20' });
      appendFilters(query, appliedFilters);
      const response = await fetch(`${apiBase}/admin/career-applications?${query}`, { headers: authHeaders });
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
  }, [apiBase, authHeaders, page, appliedFilters]);

  useEffect(() => { void loadApplications(); }, [loadApplications]);
  useEffect(() => {
    if (!selectedProfile && !exportOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (exportOpen) setExportOpen(false);
      else setSelectedProfile(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedProfile, exportOpen]);
  useEffect(() => {
    let cancelled = false;
    const loadOptions = async () => {
      try {
        const response = await fetch(`${apiBase}/admin/career-applications/filter-options`, { headers: authHeaders });
        const body = await readJson(response);
        if (!cancelled && response.ok) setFilterOptions({ ...emptyFilterOptions, ...body });
      } catch {
        // Static enum options remain available when metadata cannot be loaded.
      }
    };
    void loadOptions();
    return () => { cancelled = true; };
  }, [apiBase, authHeaders]);

  const allPageSelected = applications.length > 0 && applications.every((item) => selectedIds.has(item._id));
  const availableStates = useMemo(() => filterOptions.states || [], [filterOptions.states]);
  const availableQualifications = useMemo(() => filterOptions.qualifications || [], [filterOptions.qualifications]);

  const syncMailbox = async () => {
    setSyncing(true);
    setMessage('');
    try {
      let startSequence = 1;
      let mailboxMessages = 0;
      let scanned = 0;
      let imported = 0;
      let duplicates = 0;
      let failed = 0;
      while (startSequence > 0) {
        const response = await fetch(`${apiBase}/admin/career-applications/sync?all=true&startSequence=${startSequence}`, {
          method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        });
        const body = await readJson(response);
        if (!response.ok) throw new Error(body.msg || 'Career mailbox sync failed.');
        const summary = body.summary || {};
        mailboxMessages = Number(summary.mailboxMessages) || mailboxMessages;
        scanned += Number(summary.scanned) || 0;
        imported += Number(summary.imported) || 0;
        duplicates += Number(summary.duplicates) || 0;
        failed += Number(summary.failed) || 0;
        startSequence = summary.hasMore && Number(summary.nextSequence) > 0 ? Number(summary.nextSequence) : 0;
        setMessage(`Full sync in progress: ${Math.min(scanned, mailboxMessages)} of ${mailboxMessages} mailbox messages scanned...`);
      }
      setPage(1);
      await loadApplications();
      setMessage(`Full sync complete: ${scanned} of ${mailboxMessages} mailbox messages scanned; ${imported} imported, ${duplicates} duplicates, ${failed} failed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Career mailbox sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const openDetail = async (application: CareerApplication) => {
    setMessage('');
    try {
      const response = await fetch(`${apiBase}/admin/career-applications/${application._id}`, { headers: authHeaders });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.msg || 'Candidate profile could not be opened.');
      setSelectedProfile(body.application);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Candidate profile could not be opened.');
    }
  };

  const openAttachment = async (applicationId: string, attachmentIndex: number, attachment: Attachment) => {
    const loadingKey = `${applicationId}:${attachmentIndex}`;
    setOpeningAttachment(loadingKey);
    setMessage('');
    try {
      const response = await fetch(
        `${apiBase}/admin/career-applications/${applicationId}/attachments/${attachmentIndex}`,
        { headers: authHeaders }
      );
      if (!response.ok) {
        const body = await readJson(response);
        throw new Error(body.msg || 'Attachment could not be opened.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const previewable = /^(application\/pdf|image\/(?:jpeg|png|webp)|text\/(?:plain|csv))$/i.test(
        attachment.contentType || blob.type
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      if (previewable) {
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
      } else {
        anchor.download = attachment.filename || `career-attachment-${attachmentIndex + 1}`;
      }
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Attachment could not be opened.');
    } finally {
      setOpeningAttachment('');
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleCurrentPage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      applications.forEach((item) => allPageSelected ? next.delete(item._id) : next.add(item._id));
      return next;
    });
  };

  const fetchExport = async (forcedSeparator?: Separator) => {
    setExporting(true);
    try {
      const query = new URLSearchParams({ scope: exportScope, format: exportFormat });
      if (exportScope === 'filters') appendFilters(query, appliedFilters);
      if (exportScope === 'selected') query.set('ids', [...selectedIds].join(','));
      if (exportScope === 'page') query.set('ids', applications.map((item) => item._id).join(','));
      const response = await fetch(`${apiBase}/admin/career-applications/export?${query}`, { headers: authHeaders });
      const body = await readJson(response);
      if (!response.ok) throw new Error(body.msg || 'Candidate export could not be generated.');
      const records = Array.isArray(body.records) ? body.records as CareerApplication[] : [];
      const result = buildExportResult(records, exportFormat, forcedSeparator || separator);
      setExportOutput(result.text);
      setExportCsv(result.csv);
      setExportSummary(`${body.matchedCount || 0} candidates matched; ${result.exportedCount} ${result.label} exported; ${result.duplicatesRemoved} duplicates removed.`);
      return result;
    } catch (error) {
      setExportOutput('');
      setExportCsv('');
      setExportSummary(error instanceof Error ? error.message : 'Candidate export could not be generated.');
      return null;
    } finally {
      setExporting(false);
    }
  };

  const copyExport = async () => {
    const result = exportOutput ? { text: exportOutput } : await fetchExport();
    if (!result?.text) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setMessage('Candidate export copied to clipboard.');
    } catch {
      setMessage('Clipboard access was unavailable. Copy the preview manually.');
    }
  };

  const downloadCsv = async () => {
    let csv = exportCsv;
    if (!csv) csv = (await fetchExport('CSV'))?.csv || '';
    if (!csv) return;
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `career-candidates-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setAppliedFilters({ ...filters, search: filters.search.trim() });
  };
  const resetFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Career Applications</h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">Candidate database imported from the configured read-only mailbox.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setExportOpen(true)} className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-black text-emerald-300 hover:bg-emerald-950">Export Candidate Data</button>
            <button type="button" onClick={() => void syncMailbox()} disabled={syncing} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
              {syncing ? 'Syncing...' : 'Sync Applications'}
            </button>
          </div>
        </div>
        {message && <p role="status" className="mt-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-bold text-slate-200">{message}</p>}
      </div>

      <form onSubmit={applyFilters} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="font-black text-white">Candidate Filters</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-bold text-slate-400">Search<input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Name, email, mobile, location, skills..." className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-500" /></label>
          <FilterSelect label="Status" value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} options={STATUSES.map((value) => ({ value, label: readable(value) }))} />
          <FilterSelect label="Field of Work" value={filters.fieldOfWork} onChange={(value) => setFilters((current) => ({ ...current, fieldOfWork: value }))} options={FIELDS_OF_WORK.map((value) => ({ value, label: readable(value) }))} />
          <FilterSelect label="Experience Range" value={filters.experienceRange} onChange={(value) => setFilters((current) => ({ ...current, experienceRange: value }))} options={EXPERIENCE_RANGES.map((value) => ({ value, label: readable(value) }))} />
          <FilterSelect label="State" value={filters.state} onChange={(value) => setFilters((current) => ({ ...current, state: value }))} options={availableStates.map((item) => ({ value: item.value, label: `${item.value} (${item.count})` }))} />
          <FilterSelect label="Qualification" value={filters.qualification} onChange={(value) => setFilters((current) => ({ ...current, qualification: value }))} options={availableQualifications.map((item) => ({ value: item.value, label: `${item.value} (${item.count})` }))} />
          <label className="text-xs font-bold text-slate-400">Applied From<input type="date" value={filters.dateFrom} onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs font-bold text-slate-400">Applied To<input type="date" value={filters.dateTo} onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" /></label>
        </div>
        <fieldset className="mt-4">
          <legend className="text-xs font-black uppercase text-slate-500">Data availability</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {([
              ['hasEmail', 'Has Email'], ['hasContact', 'Has Contact Number'], ['hasAddress', 'Has Address'],
              ['hasExperience', 'Has Work Experience'], ['hasResume', 'Has Resume'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm font-bold text-slate-300">
                <input type="checkbox" checked={filters[key]} onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.checked }))} className="h-4 w-4 accent-emerald-500" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500">Apply Filters</button>
          <button type="button" onClick={resetFilters} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">Reset Filters</button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <p className="text-sm font-bold text-slate-300">Showing {applications.length} of {total} candidates · Selected: {selectedIds.size}</p>
          <div className="flex gap-2">
            <button type="button" onClick={toggleCurrentPage} disabled={!applications.length} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40">{allPageSelected ? 'Clear Current Page' : 'Select Current Page'}</button>
            <button type="button" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-black text-white disabled:opacity-40">Clear Selection</button>
          </div>
          {loading && <span className="text-xs font-bold text-slate-400">Loading...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
              <tr><th className="px-3 py-3"><span className="sr-only">Select</span></th><th className="px-3 py-3">Name</th><th className="px-3 py-3">Email</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Field</th><th className="px-3 py-3">Experience</th><th className="px-3 py-3">State</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Applied</th><th className="px-3 py-3"><span className="sr-only">Action</span></th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {!loading && applications.length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center font-semibold text-slate-400">No matching candidates.</td></tr>}
              {applications.map((application) => (
                <tr key={application._id} className="align-top hover:bg-slate-800/50">
                  <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.has(application._id)} onChange={() => toggleSelected(application._id)} aria-label={`Select ${candidateName(application)}`} className="h-4 w-4 accent-emerald-500" /></td>
                  <td className="px-3 py-3 font-bold text-white">{candidateName(application)}</td>
                  <td className="break-all px-3 py-3 text-slate-300">{candidateEmail(application) || 'Not available'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">{application.contactNumber || 'Not available'}</td>
                  <td className="px-3 py-3 text-slate-300">{readable(application.fieldOfWork)}</td>
                  <td className="px-3 py-3 text-slate-300">{readable(application.experienceRange)}</td>
                  <td className="px-3 py-3 text-slate-300">{application.state || 'Not available'}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-black text-slate-200">{readable(application.status)}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">{formatDate(application.receivedAt || application.emailDate)}</td>
                  <td className="px-3 py-3 text-right"><button type="button" onClick={() => void openDetail(application)} className="font-black text-emerald-400 hover:text-emerald-300">Profile</button></td>
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

      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-labelledby="candidate-profile-title">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h3 id="candidate-profile-title" className="text-xl font-black text-white">{candidateName(selectedProfile)}</h3><p className="break-all text-sm font-semibold text-slate-400">{candidateEmail(selectedProfile) || 'Email not available'}</p></div>
              <button type="button" onClick={() => setSelectedProfile(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-black text-white">Close</button>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Name" value={candidateName(selectedProfile)} /><Detail label="Email" value={candidateEmail(selectedProfile)} />
              <Detail label="Primary Contact" value={selectedProfile.contactNumber} /><Detail label="Alternate Contact" value={selectedProfile.alternateContactNumber || selectedProfile.extractedPhoneNumbers?.[1]} />
              <Detail label="Address" value={selectedProfile.address} /><Detail label="City" value={selectedProfile.city} /><Detail label="District" value={selectedProfile.district} />
              <Detail label="State" value={selectedProfile.state} /><Detail label="Postal Code" value={selectedProfile.postalCode} /><Detail label="Qualification" value={selectedProfile.qualification} />
              <Detail label="Field of Work" value={readable(selectedProfile.fieldOfWork)} /><Detail label="Work Experience" value={selectedProfile.workExperienceText} />
              <Detail label="Experience Range" value={readable(selectedProfile.experienceRange)} /><Detail label="Current Company" value={selectedProfile.currentCompany} />
              <Detail label="Current Designation" value={selectedProfile.currentDesignation} /><Detail label="Skills" value={selectedProfile.skills?.join(', ')} />
              <Detail label="Applied Date" value={formatDate(selectedProfile.receivedAt || selectedProfile.emailDate)} /><Detail label="Email Subject" value={selectedProfile.emailSubject || selectedProfile.subject} />
              <Detail label="Status" value={readable(selectedProfile.status)} /><Detail label="Notes" value={selectedProfile.notes} /><Detail label="Message ID" value={selectedProfile.messageId} />
              <Detail label="Resume File" value={selectedProfile.resumeFileName} /><Detail label="Resume Type" value={selectedProfile.resumeContentType} /><Detail label="Resume Size" value={selectedProfile.resumeSize ? `${selectedProfile.resumeSize} bytes` : ''} />
            </dl>
            {digitsOnly(selectedProfile.contactNumber) && <a href={`https://wa.me/91${digitsOnly(selectedProfile.contactNumber)}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-500">Open WhatsApp</a>}
            <div className="mt-5"><h4 className="text-xs font-black uppercase text-slate-500">Plain-text application</h4><pre className="mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950 p-4 font-sans text-sm leading-6 text-slate-200">{selectedProfile.textBody || 'Not available'}</pre></div>
            <div className="mt-5"><h4 className="text-xs font-black uppercase text-slate-500">Attachments</h4>{selectedProfile.attachments?.length ? <ul className="mt-2 space-y-2">{selectedProfile.attachments.map((attachment, index) => <li key={`${attachment.filename || 'attachment'}-${index}`} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-sm text-slate-300"><span><span className="font-bold text-white">{attachment.filename || 'Unnamed attachment'}</span><span className="ml-2 text-xs text-slate-500">{attachment.contentType || 'Unknown type'} · {attachment.size || 0} bytes</span></span><button type="button" onClick={() => void openAttachment(selectedProfile._id, index, attachment)} disabled={openingAttachment === `${selectedProfile._id}:${index}`} className="rounded-lg border border-emerald-700 px-3 py-1.5 text-xs font-black text-emerald-300 hover:bg-emerald-950 disabled:opacity-50">{openingAttachment === `${selectedProfile._id}:${index}` ? 'Opening...' : 'Open / Download'}</button></li>)}</ul> : <p className="mt-2 text-sm text-slate-400">Not available</p>}</div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true" aria-labelledby="candidate-export-title">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3"><div><h3 id="candidate-export-title" className="text-xl font-black text-white">Candidate Data Export</h3><p className="mt-1 text-sm text-slate-400">Export safe candidate contact and profile fields.</p></div><button type="button" onClick={() => setExportOpen(false)} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-black text-white">Close</button></div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <FilterSelect includeEmpty={false} label="Data Scope" value={exportScope} onChange={(value) => { setExportScope(value as ExportScope); setExportOutput(''); setExportCsv(''); }} options={[{ value: 'all', label: 'All Available Candidates' }, { value: 'filters', label: 'Current Filter Results' }, { value: 'selected', label: `Selected Candidates (${selectedIds.size})` }, { value: 'page', label: `Current Page (${applications.length})` }]} />
              <FilterSelect includeEmpty={false} label="Export Format" value={exportFormat} onChange={(value) => { const next = value as ExportFormat; setExportFormat(next); setSeparator(next === 'EMAILS' || next === 'CONTACTS' || next === 'WHATSAPP' ? 'COMMA' : 'NEW_LINE'); setExportOutput(''); setExportCsv(''); }} options={EXPORT_FORMATS.map(([value, label]) => ({ value, label }))} />
              <FilterSelect includeEmpty={false} label="Separator" value={separator} onChange={(value) => { setSeparator(value as Separator); setExportOutput(''); setExportCsv(''); }} options={SEPARATORS.map(([value, label]) => ({ value, label }))} />
            </div>
            {(exportScope === 'selected' && !selectedIds.size) && <p role="alert" className="mt-3 rounded-lg border border-amber-800 bg-amber-950 p-3 text-sm font-bold text-amber-100">Select at least one candidate first.</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={() => void fetchExport()} disabled={exporting || (exportScope === 'selected' && !selectedIds.size) || (exportScope === 'page' && !applications.length)} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{exporting ? 'Preparing...' : 'Preview Output'}</button>
              <button type="button" onClick={() => void copyExport()} disabled={exporting} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Copy to Clipboard</button>
              <button type="button" onClick={() => void downloadCsv()} disabled={exporting} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">Download CSV</button>
              <button type="button" onClick={() => { setSelectedIds(new Set()); setExportOutput(''); setExportCsv(''); setExportSummary(''); }} className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-black text-white">Clear Selection</button>
            </div>
            {exportSummary && <p role="status" className="mt-4 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm font-bold text-slate-200">{exportSummary}</p>}
            <label className="mt-4 block text-xs font-black uppercase text-slate-500">Output Preview<textarea value={exportOutput} readOnly rows={12} placeholder="Choose the scope and format, then preview the output." className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-slate-200 outline-none" /></label>
          </div>
        </div>
      )}
    </section>
  );
}

function FilterSelect({ label, value, onChange, options, includeEmpty = true }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; includeEmpty?: boolean }) {
  return <label className="text-xs font-bold text-slate-400">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white">{includeEmpty && <option value="">All</option>}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
