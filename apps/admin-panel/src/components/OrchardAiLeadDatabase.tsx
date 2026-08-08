import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

type LeadType =
  | 'Buyer'
  | 'Grower'
  | 'Commission Agent'
  | 'Exporter'
  | 'Cold Storage'
  | 'Logistics';

type LeadPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Follow-up'
  | 'Qualified'
  | 'Hot'
  | 'Converted'
  | 'Lost'
  | 'Archived';

type AdminOption = {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  status?: string;
};

type AdminReference = {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  adminClass?: string;
};

type Lead = {
  _id: string;
  companyName: string;
  contactPerson: string;
  leadType: LeadType;
  fruits: string[];
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  score: number;
  priority: LeadPriority;
  status: LeadStatus;
  assignedTo?: AdminReference | string | null;
  notes?: string;
  tags: string[];
  lastContactedAt?: string | null;
  nextFollowUpAt?: string | null;
  createdBy?: AdminReference | string;
  updatedBy?: AdminReference | string;
  createdAt?: string;
  updatedAt?: string;
};

type LeadPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

type LeadListResponse = {
  data?: Lead[];
  pagination?: LeadPagination;
  message?: string;
  msg?: string;
  code?: string;
};

type LeadResponse = {
  data?: Lead;
  message?: string;
  msg?: string;
  code?: string;
};

type LeadDraft = {
  companyName: string;
  contactPerson: string;
  leadType: LeadType;
  fruits: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  website: string;
  sourceUrl: string;
  sourcePlatform: string;
  score: string;
  priority: LeadPriority;
  status: LeadStatus;
  assignedTo: string;
  notes: string;
  tags: string;
};

type LeadPayload = {
  companyName: string;
  contactPerson: string;
  leadType: LeadType;
  fruits: string[];
  city: string;
  state: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  website: string;
  sourceUrl: string;
  sourcePlatform: string;
  score: number;
  priority: LeadPriority;
  status: LeadStatus;
  assignedTo: string | null;
  notes: string;
  tags: string[];
};

type Notice = {
  type: 'success' | 'error';
  message: string;
};

type OrchardAiLeadDatabaseProps = {
  apiBase: string;
  authHeaders: Record<string, string>;
  admins: AdminOption[];
};

const leadTypes: LeadType[] = [
  'Buyer',
  'Grower',
  'Commission Agent',
  'Exporter',
  'Cold Storage',
  'Logistics',
];

const leadPriorities: LeadPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

const leadStatuses: LeadStatus[] = [
  'New',
  'Contacted',
  'Follow-up',
  'Qualified',
  'Hot',
  'Converted',
  'Lost',
  'Archived',
];

const emptyPagination: LeadPagination = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

const emptyLeadDraft: LeadDraft = {
  companyName: '',
  contactPerson: '',
  leadType: 'Buyer',
  fruits: '',
  city: '',
  state: '',
  address: '',
  phone: '',
  email: '',
  whatsapp: '',
  website: '',
  sourceUrl: '',
  sourcePlatform: '',
  score: '0',
  priority: 'Medium',
  status: 'New',
  assignedTo: '',
  notes: '',
  tags: '',
};

const statusStyles: Record<LeadStatus, string> = {
  New: 'bg-slate-800 text-slate-300',
  Contacted: 'bg-sky-950 text-sky-300',
  'Follow-up': 'bg-amber-950 text-amber-300',
  Qualified: 'bg-violet-950 text-violet-300',
  Hot: 'bg-rose-950 text-rose-300',
  Converted: 'bg-emerald-950 text-emerald-300',
  Lost: 'bg-red-950 text-red-300',
  Archived: 'bg-slate-800 text-slate-400',
};

const priorityStyles: Record<LeadPriority, string> = {
  Low: 'bg-slate-800 text-slate-300',
  Medium: 'bg-sky-950 text-sky-300',
  High: 'bg-amber-950 text-amber-300',
  Urgent: 'bg-rose-950 text-rose-300',
};

const uniqueValues = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));

const splitCommaValues = (value: string) =>
  uniqueValues(value.split(',').map((item) => item.trim()));

const readApiJson = async <T,>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return { msg: text } as T;
  }
};

const getApiMessage = (
  data: { message?: string; msg?: string },
  fallback: string
) => data.msg || data.message || fallback;

const getAdminId = (admin?: AdminOption | AdminReference | string | null) => {
  if (!admin) return '';
  if (typeof admin === 'string') return admin;
  return admin._id || ('id' in admin ? admin.id || '' : '');
};

const getAdminLabel = (
  admin: AdminOption | AdminReference | string | null | undefined,
  admins: AdminOption[]
) => {
  const id = getAdminId(admin);
  const populatedAdmin = typeof admin === 'object' && admin ? admin : null;
  const matchedAdmin = admins.find((item) => getAdminId(item) === id);
  return (
    populatedAdmin?.name ||
    populatedAdmin?.email ||
    matchedAdmin?.name ||
    matchedAdmin?.email ||
    (id ? 'Assigned admin' : 'Unassigned')
  );
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const leadToDraft = (lead?: Lead | null): LeadDraft => {
  if (!lead) return { ...emptyLeadDraft };

  return {
    companyName: lead.companyName || '',
    contactPerson: lead.contactPerson || '',
    leadType: lead.leadType,
    fruits: (lead.fruits || []).join(', '),
    city: lead.city || '',
    state: lead.state || '',
    address: lead.address || '',
    phone: lead.phone || '',
    email: lead.email || '',
    whatsapp: lead.whatsapp || '',
    website: lead.website || '',
    sourceUrl: lead.sourceUrl || '',
    sourcePlatform: lead.sourcePlatform || '',
    score: String(lead.score ?? 0),
    priority: lead.priority,
    status: lead.status,
    assignedTo: getAdminId(lead.assignedTo),
    notes: lead.notes || '',
    tags: (lead.tags || []).join(', '),
  };
};

const draftToPayload = (draft: LeadDraft): LeadPayload => ({
  companyName: draft.companyName.trim(),
  contactPerson: draft.contactPerson.trim(),
  leadType: draft.leadType,
  fruits: splitCommaValues(draft.fruits),
  city: draft.city.trim(),
  state: draft.state.trim(),
  address: draft.address.trim(),
  phone: draft.phone.trim(),
  email: draft.email.trim(),
  whatsapp: draft.whatsapp.trim(),
  website: draft.website.trim(),
  sourceUrl: draft.sourceUrl.trim(),
  sourcePlatform: draft.sourcePlatform.trim(),
  score: Number(draft.score || 0),
  priority: draft.priority,
  status: draft.status,
  assignedTo: draft.assignedTo || null,
  notes: draft.notes.trim(),
  tags: splitCommaValues(draft.tags),
});

export default function OrchardAiLeadDatabase({
  apiBase,
  authHeaders,
  admins,
}: OrchardAiLeadDatabaseProps) {
  const endpoint = `${apiBase}/admin/orchard-ai/leads`;
  const [leads, setLeads] = useState<Lead[]>([]);
  const [pagination, setPagination] = useState<LeadPagination>(emptyPagination);
  const [summary, setSummary] = useState({
    total: 0,
    buyers: 0,
    growers: 0,
    hot: 0,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [leadType, setLeadType] = useState('');
  const [fruit, setFruit] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const detailRequestId = useRef(0);

  const activeAdmins = useMemo(
    () =>
      admins
        .filter((admin) => getAdminId(admin) && (!admin.status || admin.status === 'ACTIVE'))
        .sort((left, right) =>
          (left.name || left.email || '').localeCompare(right.name || right.email || '')
        ),
    [admins]
  );

  const fruits = useMemo(
    () => uniqueValues([...leads.flatMap((lead) => lead.fruits || []), fruit]),
    [fruit, leads]
  );
  const states = useMemo(
    () => uniqueValues([...leads.map((lead) => lead.state || ''), state]),
    [leads, state]
  );
  const cities = useMemo(
    () => uniqueValues([...leads.map((lead) => lead.city || ''), city]),
    [city, leads]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });

    if (debouncedSearch) params.set('search', debouncedSearch);
    if (leadType) params.set('leadType', leadType);
    if (fruit) params.set('fruit', fruit);
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (status) params.set('status', status);
    if (assignedTo) params.set('assignedTo', assignedTo);
    if (priority) params.set('priority', priority);

    const loadLeads = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`${endpoint}?${params.toString()}`, {
          headers: authHeaders,
          signal: controller.signal,
        });
        const data = await readApiJson<LeadListResponse>(response);

        if (!response.ok) {
          throw new Error(getApiMessage(data, 'Could not load leads.'));
        }

        setLeads(Array.isArray(data.data) ? data.data : []);
        setPagination(data.pagination || { ...emptyPagination, page, limit });
        setSelectedIds(new Set());
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Could not load leads.'
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadLeads();
    return () => controller.abort();
  }, [
    assignedTo,
    authHeaders,
    city,
    debouncedSearch,
    endpoint,
    fruit,
    leadType,
    limit,
    page,
    priority,
    refreshVersion,
    state,
    status,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    const loadSummary = async () => {
      setSummaryLoading(true);
      const queries = [
        new URLSearchParams({ page: '1', limit: '1' }),
        new URLSearchParams({ page: '1', limit: '1', leadType: 'Buyer' }),
        new URLSearchParams({ page: '1', limit: '1', leadType: 'Grower' }),
        new URLSearchParams({ page: '1', limit: '1', status: 'Hot' }),
      ];

      try {
        const responses = await Promise.all(
          queries.map((query) =>
            fetch(`${endpoint}?${query.toString()}`, {
              headers: authHeaders,
              signal: controller.signal,
            })
          )
        );
        const data = await Promise.all(
          responses.map((response) => readApiJson<LeadListResponse>(response))
        );

        if (responses.some((response) => !response.ok)) {
          throw new Error('Could not load lead summary.');
        }

        setSummary({
          total: data[0].pagination?.total || 0,
          buyers: data[1].pagination?.total || 0,
          growers: data[2].pagination?.total || 0,
          hot: data[3].pagination?.total || 0,
        });
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      } finally {
        if (!controller.signal.aborted) setSummaryLoading(false);
      }
    };

    loadSummary();
    return () => controller.abort();
  }, [authHeaders, endpoint, refreshVersion]);

  useEffect(() => {
    if (!activeLead && !formOpen) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (formOpen && !formSaving) {
        setFormOpen(false);
        setEditingLead(null);
        setFormError('');
        return;
      }
      if (!formOpen) {
        detailRequestId.current += 1;
        setActiveLead(null);
      }
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeLead, formOpen, formSaving]);

  const allVisibleSelected =
    leads.length > 0 && leads.every((lead) => selectedIds.has(lead._id));

  const toggleLead = (leadId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
  };

  const toggleVisibleLeads = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) leads.forEach((lead) => next.delete(lead._id));
      else leads.forEach((lead) => next.add(lead._id));
      return next;
    });
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setLeadType('');
    setFruit('');
    setState('');
    setCity('');
    setStatus('');
    setAssignedTo('');
    setPriority('');
    setPage(1);
  };

  const normalizePhoneForLink = (value?: string) => (value || '').replace(/\D/g, '');

  const markLeadContacted = async (lead: Lead) => {
    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(lead._id)}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ lastContactedAt: new Date().toISOString() }),
      });

      const data = await readApiJson<LeadResponse>(response);
      if (response.ok && data.data) {
        setLeads((current) => current.map((item) => (item._id === lead._id ? data.data! : item)));
        if (activeLead?._id === lead._id) setActiveLead(data.data);
      }
    } catch {
      // Contact link should still open even if CRM timestamp update fails.
    }
  };

  const openWhatsApp = (lead: Lead) => {
    const phone = normalizePhoneForLink(lead.whatsapp || lead.phone);
    if (!phone) {
      setNotice({ type: 'error', message: 'WhatsApp number is not available for this lead.' });
      return;
    }

    const message = `Namaste ${lead.contactPerson}, This is Orchard Growers team. We are connecting regarding fruit business opportunities through eFruitMandi.live.ough eFruitMandi.live.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    void markLeadContacted(lead);
    setNotice({ type: 'success', message: `WhatsApp chat opened for ${lead.contactPerson}.` });
  };

  const openEmail = (lead: Lead) => {
    if (!lead.email) {
      setNotice({ type: 'error', message: 'Email address is not available for this lead.' });
      return;
    }

    const subject = 'Fruit business opportunity with Orchard Growers';
    const body = `Namaste ${lead.contactPerson},

This is Orchard Growers team. We are connecting regarding fruit business opportunities through eFruitMandi.live.ough eFruitMandi.live.

Regards,
Orchard Growers`;

    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    void markLeadContacted(lead);
    setNotice({ type: 'success', message: `Email composer opened for ${lead.contactPerson}.` });
  };

  const openAssignForm = (lead: Lead) => {
    setEditingLead(lead);
    setFormError('');
  };

  const openLeadDetails = async (lead: Lead) => {
    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    setActiveLead(lead);
    setDetailLoading(true);
    setNotice(null);

    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(lead._id)}`, {
        headers: authHeaders,
      });
      const data = await readApiJson<LeadResponse>(response);

      if (!response.ok || !data.data) {
        throw new Error(getApiMessage(data, 'Could not load lead details.'));
      }
      if (detailRequestId.current === requestId) setActiveLead(data.data);
    } catch (requestError) {
      if (detailRequestId.current === requestId) {
        setNotice({
          type: 'error',
          message:
            requestError instanceof Error
              ? requestError.message
              : 'Could not load lead details.',
        });
      }
    } finally {
      if (detailRequestId.current === requestId) setDetailLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingLead(null);
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (lead: Lead) => {
    detailRequestId.current += 1;
    setEditingLead(lead);
    setActiveLead(null);
    setFormError('');
    setFormOpen(true);
  };

  const closeForm = () => {
    if (formSaving) return;
    setFormOpen(false);
    setEditingLead(null);
    setFormError('');
  };

  const saveLead = async (payload: LeadPayload) => {
    setFormSaving(true);
    setFormError('');

    try {
      const response = await fetch(
        editingLead
          ? `${endpoint}/${encodeURIComponent(editingLead._id)}`
          : endpoint,
        {
          method: editingLead ? 'PATCH' : 'POST',
          headers: authHeaders,
          body: JSON.stringify(payload),
        }
      );
      const data = await readApiJson<LeadResponse>(response);

      if (response.status === 409) {
        setFormError('Duplicate lead found with same phone, email, or website.');
        return;
      }
      if (!response.ok || !data.data) {
        setFormError(getApiMessage(data, 'Could not save lead.'));
        return;
      }

      const wasEditing = Boolean(editingLead);
      setFormOpen(false);
      setEditingLead(null);
      setNotice({
        type: 'success',
        message: wasEditing ? 'Lead updated successfully.' : 'Lead added successfully.',
      });
      if (wasEditing) setActiveLead(data.data);
      setRefreshVersion((current) => current + 1);
    } catch (requestError) {
      setFormError(
        requestError instanceof Error ? requestError.message : 'Could not save lead.'
      );
    } finally {
      setFormSaving(false);
    }
  };

  const deleteLead = async (lead: Lead) => {
    const confirmed = window.confirm(
      `Delete ${lead.companyName}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(lead._id);
    setNotice(null);

    try {
      const response = await fetch(`${endpoint}/${encodeURIComponent(lead._id)}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await readApiJson<{ message?: string; msg?: string }>(response);

      if (!response.ok) {
        throw new Error(getApiMessage(data, 'Could not delete lead.'));
      }

      setActiveLead(null);
      detailRequestId.current += 1;
      setNotice({ type: 'success', message: 'Lead deleted successfully.' });
      if (leads.length === 1 && page > 1) setPage((current) => Math.max(1, current - 1));
      setRefreshVersion((current) => current + 1);
    } catch (requestError) {
      setNotice({
        type: 'error',
        message:
          requestError instanceof Error
            ? requestError.message
            : 'Could not delete lead.',
      });
    } finally {
      setDeletingId('');
    }
  };

  const summaryCards = [
    { label: 'Total Leads', value: summary.total },
    { label: 'Buyers', value: summary.buyers },
    { label: 'Growers', value: summary.growers },
    { label: 'Hot Leads', value: summary.hot },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Lead Database</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-400">
            Review and organize buyer, grower, trade, storage, and logistics leads.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit shrink-0 rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">
            Live data
          </span>
          <button
            type="button"
            onClick={openCreateForm}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500"
          >
            Add Lead
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <LeadMetricCard
            key={item.label}
            label={item.label}
            value={summaryLoading ? '—' : item.value}
          />
        ))}
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-white">Filters</h3>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
          >
            Clear Filters
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-bold text-slate-300 sm:col-span-2">
            Search
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, contact, phone, email..."
              className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
            />
          </label>
          <LeadFilterSelect
            label="Lead Type"
            value={leadType}
            options={leadTypes}
            onChange={(value) => {
              setLeadType(value);
              setPage(1);
            }}
          />
          <LeadFilterSelect
            label="Fruit"
            value={fruit}
            options={fruits}
            onChange={(value) => {
              setFruit(value);
              setPage(1);
            }}
          />
          <LeadFilterSelect
            label="State"
            value={state}
            options={states}
            onChange={(value) => {
              setState(value);
              setPage(1);
            }}
          />
          <LeadFilterSelect
            label="City"
            value={city}
            options={cities}
            onChange={(value) => {
              setCity(value);
              setPage(1);
            }}
          />
          <LeadFilterSelect
            label="Status"
            value={status}
            options={leadStatuses}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
          <LeadFilterSelect
            label="Assigned To"
            value={assignedTo}
            options={activeAdmins.map((admin) => ({
              value: getAdminId(admin),
              label: admin.name || admin.email || 'Admin',
            }))}
            onChange={(value) => {
              setAssignedTo(value);
              setPage(1);
            }}
          />
          <LeadFilterSelect
            label="Priority"
            value={priority}
            options={leadPriorities}
            onChange={(value) => {
              setPriority(value);
              setPage(1);
            }}
          />
        </div>
      </section>

      {error && (
        <div className="flex flex-col gap-3 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm font-bold text-red-100 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRefreshVersion((current) => current + 1)}
            className="w-fit rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-950 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      )}

      {notice && (
        <div
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-bold ${
            notice.type === 'error'
              ? 'border-red-800 bg-red-950 text-red-100'
              : 'border-emerald-600 bg-emerald-950 text-emerald-100'
          }`}
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss action message"
            className="shrink-0 rounded-md bg-slate-900 px-2 py-1 text-xs text-white hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="flex flex-col gap-2 border-b border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Lead Records</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {pagination.total} leads
              {selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ''}
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-emerald-300">
            {loading ? 'Loading...' : `Page ${page}`}
          </span>
        </div>

        <div className="admin-table-scroll overflow-x-auto">
          <table className="min-w-[1900px] w-full text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleLeads}
                    disabled={!leads.length}
                    aria-label="Select all visible leads"
                    className="h-4 w-4 accent-emerald-600"
                  />
                </th>
                {[
                  'Company',
                  'Contact Person',
                  'Type',
                  'Fruit',
                  'City',
                  'State',
                  'Phone',
                  'Email',
                  'Source',
                  'Score',
                  'Status',
                  'Assigned To',
                  'Actions',
                ].map((header) => (
                  <th key={header} className="whitespace-nowrap px-3 py-3">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {leads.map((lead) => (
                <tr key={lead._id} className="text-slate-200 hover:bg-slate-800/40">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead._id)}
                      onChange={() => toggleLead(lead._id)}
                      aria-label={`Select ${lead.companyName}`}
                      className="h-4 w-4 accent-emerald-600"
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-bold text-white">
                    {lead.companyName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{lead.contactPerson}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">{lead.leadType}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">
                    {lead.fruits?.join(', ') || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">{lead.city || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">{lead.state || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">{lead.phone || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">{lead.email || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-400">
                    {lead.sourcePlatform || lead.sourceUrl || '-'}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`font-black ${
                        lead.score >= 80
                          ? 'text-emerald-300'
                          : lead.score >= 70
                            ? 'text-amber-300'
                            : 'text-slate-300'
                      }`}
                    >
                      {lead.score}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <LeadStatusBadge status={lead.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-300">
                    {getAdminLabel(lead.assignedTo, activeAdmins)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-[285px] flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openLeadDetails(lead)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openWhatsApp(lead)}
                        className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
                      >
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        onClick={() => openEmail(lead)}
                        className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700"
                      >
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => openAssignForm(lead)}
                        className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-100"
                      >
                        Assign
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {loading && !leads.length && (
            <div className="p-8 text-center text-sm font-bold text-slate-400">
              Loading lead records...
            </div>
          )}
          {!loading && !error && !leads.length && (
            <div className="p-8 text-center text-sm font-bold text-slate-400">
              No leads match the selected filters.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-400">
            Rows per page
            <select
              value={limit}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
            >
              {[10, 25, 50, 100].map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-2 text-xs font-bold text-slate-400">
              Page {page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              type="button"
              disabled={loading || !pagination.hasNextPage}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {activeLead && (
        <LeadDetailsDrawer
          lead={activeLead}
          admins={activeAdmins}
          loading={detailLoading}
          deleting={deletingId === activeLead._id}
          onClose={() => {
            detailRequestId.current += 1;
            setActiveLead(null);
          }}
          onEdit={openEditForm}
          onDelete={deleteLead}
        />
      )}

      {formOpen && (
        <LeadFormModal
          lead={editingLead}
          admins={activeAdmins}
          saving={formSaving}
          error={formError}
          onClose={closeForm}
          onSubmit={saveLead}
        />
      )}
    </section>
  );
}

function LeadMetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

type FilterOption = string | { value: string; label: string };

function LeadFilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
      >
        <option value="">All</option>
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <option key={optionValue} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

function LeadFormModal({
  lead,
  admins,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  lead: Lead | null;
  admins: AdminOption[];
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: LeadPayload) => void;
}) {
  const [draft, setDraft] = useState<LeadDraft>(() => leadToDraft(lead));
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, saving]);
  const update = (field: keyof LeadDraft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(draftToPayload(draft));
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 p-3 sm:p-4">
      <div className="admin-responsive-dialog flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4 sm:p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-emerald-300">
              OG Brain
            </p>
            <h2 className="mt-1 text-xl font-black text-white">
              {lead ? 'Edit Lead' : 'Add Lead'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {error && (
              <div className="mb-4 rounded-lg border border-red-800 bg-red-950 px-4 py-3 text-sm font-bold text-red-100">
                {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <LeadFormInput
                label="Company Name"
                value={draft.companyName}
                onChange={(value) => update('companyName', value)}
                required
              />
              <LeadFormInput
                label="Contact Person"
                value={draft.contactPerson}
                onChange={(value) => update('contactPerson', value)}
                required
              />
              <LeadFormSelect
                label="Lead Type"
                value={draft.leadType}
                options={leadTypes}
                onChange={(value) => update('leadType', value)}
              />
              <LeadFormInput
                label="Fruits"
                value={draft.fruits}
                onChange={(value) => update('fruits', value)}
                placeholder="Apple, Pear, Mango"
              />
              <LeadFormInput
                label="City"
                value={draft.city}
                onChange={(value) => update('city', value)}
              />
              <LeadFormInput
                label="State"
                value={draft.state}
                onChange={(value) => update('state', value)}
              />
              <div className="md:col-span-2">
                <LeadFormTextarea
                  label="Address"
                  value={draft.address}
                  onChange={(value) => update('address', value)}
                  rows={2}
                />
              </div>
              <LeadFormInput
                label="Phone"
                value={draft.phone}
                onChange={(value) => update('phone', value)}
                type="tel"
              />
              <LeadFormInput
                label="Email"
                value={draft.email}
                onChange={(value) => update('email', value)}
                type="email"
              />
              <LeadFormInput
                label="WhatsApp"
                value={draft.whatsapp}
                onChange={(value) => update('whatsapp', value)}
                type="tel"
              />
              <LeadFormInput
                label="Website"
                value={draft.website}
                onChange={(value) => update('website', value)}
                placeholder="https://example.com"
              />
              <LeadFormInput
                label="Source URL"
                value={draft.sourceUrl}
                onChange={(value) => update('sourceUrl', value)}
                placeholder="https://source.example/page"
              />
              <LeadFormInput
                label="Source Platform"
                value={draft.sourcePlatform}
                onChange={(value) => update('sourcePlatform', value)}
                placeholder="Website, Referral, Expo"
              />
              <LeadFormInput
                label="Score"
                value={draft.score}
                onChange={(value) => update('score', value)}
                type="number"
                min="0"
                max="100"
              />
              <LeadFormSelect
                label="Priority"
                value={draft.priority}
                options={leadPriorities}
                onChange={(value) => update('priority', value)}
              />
              <LeadFormSelect
                label="Status"
                value={draft.status}
                options={leadStatuses}
                onChange={(value) => update('status', value)}
              />
              <LeadFormSelect
                label="Assigned To"
                value={draft.assignedTo}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...admins.map((admin) => ({
                    value: getAdminId(admin),
                    label: admin.name || admin.email || 'Admin',
                  })),
                ]}
                onChange={(value) => update('assignedTo', value)}
              />
              <div className="md:col-span-2">
                <LeadFormInput
                  label="Tags"
                  value={draft.tags}
                  onChange={(value) => update('tags', value)}
                  placeholder="export, apple, high-value"
                />
              </div>
              <div className="md:col-span-2">
                <LeadFormTextarea
                  label="Notes"
                  value={draft.notes}
                  onChange={(value) => update('notes', value)}
                  rows={4}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 p-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : lead ? 'Update Lead' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LeadFormInput({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  required = false,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <input
        value={value}
        type={type}
        required={required}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
      />
    </label>
  );
}

type FormSelectOption = string | { value: string; label: string };

function LeadFormSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly FormSelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
      >
        {options.map((option) => {
          const optionValue = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;
          return (
            <option key={optionValue || optionLabel} value={optionValue}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function LeadFormTextarea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
      />
    </label>
  );
}

function LeadDetailsDrawer({
  lead,
  admins,
  loading,
  deleting,
  onClose,
  onEdit,
  onDelete,
}: {
  lead: Lead;
  admins: AdminOption[];
  loading: boolean;
  deleting: boolean;
  onClose: () => void;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [deleting, onClose]);

  const details = [
    ['Company', lead.companyName],
    ['Contact Person', lead.contactPerson],
    ['Lead Type', lead.leadType],
    ['Fruits', lead.fruits?.join(', ') || 'Not set'],
    ['Location', [lead.city, lead.state].filter(Boolean).join(', ') || 'Not set'],
    ['Address', lead.address || 'Not set'],
    ['Phone', lead.phone || 'Not set'],
    ['Email', lead.email || 'Not set'],
    ['WhatsApp', lead.whatsapp || 'Not set'],
    ['Website', lead.website || 'Not set'],
    ['Source URL', lead.sourceUrl || 'Not set'],
    ['Source Platform', lead.sourcePlatform || 'Not set'],
    ['Assigned To', getAdminLabel(lead.assignedTo, admins)],
    ['Last Contacted', formatDateTime(lead.lastContactedAt)],
    ['Next Follow-up', formatDateTime(lead.nextFollowUpAt)],
    ['Tags', lead.tags?.join(', ') || 'Not set'],
  ];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/75">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close lead details"
        className="absolute inset-0 cursor-default"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="lead-details-title"
        className="admin-responsive-drawer relative flex h-full w-full max-w-lg flex-col border-l border-slate-700 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-300">
              Lead Details
            </p>
            <h2 id="lead-details-title" className="mt-1 truncate text-xl font-black text-white">
              {lead.companyName}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">{lead.contactPerson}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading && (
            <div className="mb-4 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-slate-300">
              Refreshing lead details...
            </div>
          )}

          <div className="admin-detail-metrics grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Score</p>
              <p className="mt-2 text-3xl font-black text-emerald-300">{lead.score}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Status</p>
              <div className="mt-3">
                <LeadStatusBadge status={lead.status} />
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Priority</p>
              <div className="mt-3">
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${priorityStyles[lead.priority]}`}>
                  {lead.priority}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-800 rounded-xl border border-slate-800 bg-slate-950 px-4">
            {details.map(([label, value]) => (
              <div key={label} className="grid gap-1 py-3 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
                <p className="break-words text-sm font-bold text-slate-200">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-500">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-300">
              {lead.notes || 'No notes added.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 p-4">
          <button
            type="button"
            onClick={() => onDelete(lead)}
            disabled={deleting}
            className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600 disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete Lead'}
          </button>
          <button
            type="button"
            onClick={() => onEdit(lead)}
            disabled={deleting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            Edit Lead
          </button>
        </div>
      </aside>
    </div>
  );
}





