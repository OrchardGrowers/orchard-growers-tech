import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';

const API_BASE =
  ((import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
  'http://localhost:5000/api';
const FILE_BASE = API_BASE.replace(/\/api\/?$/, '');
const LOGO_URL = new URL('../logo.png', import.meta.url).href;

type Admin = {
  id: string;
  name: string;
  email: string;
  role: 'EMPLOYEE' | 'ADMIN' | 'SUPER_ADMIN';
  roleLabel?: string;
};

type Review = {
  adminClass?: string;
  action: string;
  note?: string;
  reviewedAt?: string;
  admin?: {
    name?: string;
    email?: string;
    role?: string;
  };
};

type KycUser = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  businessName?: string;
  orchardName?: string;
  isVerified?: boolean;
  kyc?: {
    udyanCardNo?: string;
    udyanCardFileUrl?: string;
    bankAccountNo?: string;
    ifscCode?: string;
    passbookFileUrl?: string;
    aadhaarCardNo?: string;
    aadhaarCardFileUrl?: string;
    status?: string;
    submittedAt?: string;
    adminReviews?: Review[];
  };
};

type VerificationRequest = {
  _id: string;
  orchardName: string;
  ownerName: string;
  location: string;
  phone: string;
  status: string;
  createdAt: string;
  youtubeVideoId?: string;
  udyanCardFile?: FileMeta;
  orchardVideo?: FileMeta;
  adminReviews?: Review[];
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    role?: string;
    isVerified?: boolean;
    accountStatus?: string;
  };
};

type AdminOrder = {
  _id: string;
  invoiceNumber?: string;
  customer?: { name?: string; phone?: string; email?: string };
  shippingAddress?: { city?: string; state?: string; pinCode?: string };
  items?: { title?: string; quantity?: number; unitPrice?: number; lineTotal?: number }[];
  totalAmount?: number;
  paymentStatus?: string;
  deliveryStatus?: string;
  courierPartner?: string;
  courierBookingStatus?: string;
  trackingNumber?: string;
  createdAt?: string;
};

type FileMeta = {
  path?: string;
  originalName?: string;
  mimetype?: string;
};

type AdminPlatform = 'orchard' | 'efruitmandi';
type AdminTab =
  | 'control'
  | 'inventory'
  | 'productAdmin'
  | 'purchase'
  | 'sales'
  | 'financials'
  | 'settings'
  | 'users'
  | 'notifications'
  | 'kyc'
  | 'verified'
  | 'salesGraph'
  | 'salesPatternsGraph'
  | 'auctionPatternsGraph'
  | 'transactionsGraph'
  | 'orders';
type ReviewAction = 'APPROVE' | 'REJECT' | 'HOLD' | 'SUSPEND' | 'TERMINATE';
type UploadedFile = { label: string; path?: string; fileName?: string };
type AdminProduct = {
  _id: string;
  title?: string;
  fruitName?: string;
  variety?: string;
  description?: string;
  quantity?: number;
  basePrice?: number;
  location?: string;
  status?: string;
  packingType?: string;
  images?: string[];
  createdAt?: string;
};
type AdminUser = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  role?: string | null;
  businessName?: string;
  orchardName?: string;
  location?: string;
  accountStatus?: string;
  isVerified?: boolean;
  adminNotes?: string;
  createdAt?: string;
};
type ProductDraft = {
  title: string;
  fruitName: string;
  variety: string;
  description: string;
  quantity: string;
  basePrice: string;
  location: string;
  packingType: string;
  status: string;
  images: string;
};

const marketSnapshotCards = [
  { title: 'Apple A+ Mandi Rate', text: 'Royal Delicious | Min 500 Max 1200 | Average: 850 +5%' },
  { title: 'Pear A+ Mandi Rate', text: 'Royal Delicious | Min 500 Max 1200 | Average: 850 +5%' },
  { title: 'Orchard Growers Inventory', text: 'Plants, seeds, tools, manure, growth tonic, and own-brand stock watch' },
  { title: 'Buyer Orders', text: 'Paid orders generate invoices; COD creates challan with greeting' },
  { title: 'EfruitMandi Users', text: 'Update buyer, grower, driver, KYC, and verification records' },
];

const emptyProductDraft: ProductDraft = {
  title: '',
  fruitName: '',
  variety: '',
  description: '',
  quantity: '',
  basePrice: '',
  location: 'Orchard Growers',
  packingType: 'Orchard Growers pack',
  status: 'AVAILABLE',
  images: '',
};

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken') || '');
  const [admin, setAdmin] = useState<Admin | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('adminUser') || 'null');
    } catch {
      return null;
    }
  });
  const [email, setEmail] = useState('testadmin@efruitmandi.local');
  const [password, setPassword] = useState('admin12345');
  const [message, setMessage] = useState('');
  const [kycRequests, setKycRequests] = useState<KycUser[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [activePlatform, setActivePlatform] = useState<AdminPlatform>('orchard');
  const [activeTab, setActiveTab] = useState<AdminTab>('inventory');
  const [viewingFile, setViewingFile] = useState<UploadedFile | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft);
  const [platformRailWidth, setPlatformRailWidth] = useState(() => Number(localStorage.getItem('adminPlatformRailWidth')) || 145);
  const [railResizeStart, setRailResizeStart] = useState<{ x: number; width: number } | null>(null);
  const [fullscreenTarget, setFullscreenTarget] = useState<'announcement' | 'action' | null>(null);
  const announcementBarRef = useRef<HTMLElement | null>(null);
  const actionPanelRef = useRef<HTMLDivElement | null>(null);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    [token]
  );

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const res = await fetch(`${API_BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Admin login failed');
      return;
    }
    localStorage.setItem('adminToken', data.token);
    localStorage.setItem('adminUser', JSON.stringify(data.admin));
    setToken(data.token);
    setAdmin(data.admin);
  };

  const loadRequests = async () => {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const [kycRes, verificationRes, ordersRes, usersRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/kyc-requests`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/verification-requests`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/orders`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/users`, { headers: authHeaders }),
        fetch(`${API_BASE}/admin/products`, { headers: authHeaders }),
      ]);
      const [kycData, verificationData, ordersData, usersData, productsData] = await Promise.all([
        kycRes.json(),
        verificationRes.json(),
        ordersRes.json(),
        usersRes.json(),
        productsRes.json(),
      ]);
      if (!kycRes.ok) throw new Error(kycData.msg || 'Could not load KYC requests');
      if (!verificationRes.ok) {
        throw new Error(verificationData.msg || 'Could not load verification requests');
      }
      if (!ordersRes.ok) throw new Error(ordersData.msg || 'Could not load orders');
      if (!usersRes.ok) throw new Error(usersData.msg || 'Could not load users');
      if (!productsRes.ok) throw new Error(productsData.msg || 'Could not load products');
      setKycRequests(kycData || []);
      setVerificationRequests(verificationData || []);
      setOrders(ordersData || []);
      setUsers(usersData || []);
      setProducts(productsData || []);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [token]);

  useEffect(() => {
    localStorage.setItem('adminPlatformRailWidth', String(platformRailWidth));
  }, [platformRailWidth]);

  useEffect(() => {
    if (!railResizeStart) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMove = (event: MouseEvent) => {
      const nextWidth = railResizeStart.width + event.clientX - railResizeStart.x;
      setPlatformRailWidth(Math.min(320, Math.max(96, nextWidth)));
    };
    const handleUp = () => setRailResizeStart(null);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [railResizeStart]);

  useEffect(() => {
    const updateFullscreen = () => {
      if (document.fullscreenElement === announcementBarRef.current) {
        setFullscreenTarget('announcement');
        return;
      }

      if (document.fullscreenElement === actionPanelRef.current) {
        setFullscreenTarget('action');
        return;
      }

      setFullscreenTarget(null);
    };
    document.addEventListener('fullscreenchange', updateFullscreen);
    updateFullscreen();

    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const logout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setToken('');
    setAdmin(null);
  };

  const toggleAnnouncementFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await announcementBarRef.current?.requestFullscreen();
  };

  const toggleActionPanelFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await actionPanelRef.current?.requestFullscreen();
  };

  const review = async (
    type: 'kyc' | 'verification',
    id: string,
    action: ReviewAction
  ) => {
    if (['HOLD', 'SUSPEND', 'TERMINATE'].includes(action) && !confirmTwice(`${action.toLowerCase()} this request and user account`)) {
      return;
    }

    const path =
      type === 'kyc'
        ? `${API_BASE}/admin/kyc-requests/${id}/review`
        : `${API_BASE}/admin/verification-requests/${id}/review`;
    const res = await fetch(path, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Review failed');
      return;
    }
    setMessage(
      action === 'APPROVE'
        ? 'Approval saved. User verifies after Class1 and Class2 approval.'
        : 'Rejection saved.'
    );
    loadRequests();
  };

  const editVerificationRequest = async (request: VerificationRequest) => {
    if (!confirmTwice('edit this Get Verified request')) return;

    const orchardName = window.prompt('Company / Orchard Name', request.orchardName);
    if (orchardName === null) return;
    const ownerName = window.prompt('Owner / Contact Person', request.ownerName);
    if (ownerName === null) return;
    const location = window.prompt('Location', request.location);
    if (location === null) return;
    const phone = window.prompt('Phone', request.phone);
    if (phone === null) return;
    const youtubeVideoId = window.prompt('YouTube Video ID', request.youtubeVideoId || '');
    if (youtubeVideoId === null) return;

    const res = await fetch(`${API_BASE}/admin/verification-requests/${request._id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ orchardName, ownerName, location, phone, youtubeVideoId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Edit failed');
      return;
    }
    setMessage('Request updated.');
    loadRequests();
  };

  const saveOrchardProduct = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    const res = await fetch(`${API_BASE}/admin/products`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        ...productDraft,
        quantity: Number(productDraft.quantity || 0),
        basePrice: Number(productDraft.basePrice || 0),
        images: productDraft.images
          .split(/\r?\n|,/)
          .map((image) => image.trim())
          .filter(Boolean),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Product save failed');
      return;
    }
    setMessage('Orchard Growers product added to inventory.');
    setProductDraft(emptyProductDraft);
    loadRequests();
  };

  const updateProductStock = async (product: AdminProduct) => {
    const quantity = window.prompt('Update stock units', String(product.quantity ?? 0));
    if (quantity === null) return;
    const basePrice = window.prompt('Update product price', String(product.basePrice ?? 0));
    if (basePrice === null) return;
    const status = window.prompt('Status: AVAILABLE, IN_AUCTION, SOLD', product.status || 'AVAILABLE');
    if (status === null) return;

    const res = await fetch(`${API_BASE}/admin/products/${product._id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ quantity: Number(quantity), basePrice: Number(basePrice), status: status.toUpperCase() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'Inventory update failed');
      return;
    }
    setMessage('Inventory updated.');
    loadRequests();
  };

  const editUserInfo = async (user: AdminUser) => {
    const name = window.prompt('Name', user.name || '');
    if (name === null) return;
    const phone = window.prompt('Phone', user.phone || '');
    if (phone === null) return;
    const email = window.prompt('Email', user.email || '');
    if (email === null) return;
    const role = window.prompt('Role: grower, buyer, driver, or blank', user.role || '');
    if (role === null) return;
    const businessName = window.prompt('Business / Company name', user.businessName || user.orchardName || '');
    if (businessName === null) return;

    const res = await fetch(`${API_BASE}/admin/users/${user._id}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        name,
        phone,
        email,
        role,
        businessName,
        orchardName: role === 'grower' ? businessName : user.orchardName || '',
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'User update failed');
      return;
    }
    setMessage('EfruitMandi user information updated.');
    loadRequests();
  };

  const setUserStatus = async (user: AdminUser, status: string) => {
    if (status !== 'ACTIVE' && !confirmTwice(`${status.toLowerCase()} ${user.name || user.email || 'this user'}`)) return;
    const note = window.prompt('Admin note', user.adminNotes || '');
    if (note === null) return;
    const res = await fetch(`${API_BASE}/admin/users/${user._id}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status, note }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.msg || 'User status update failed');
      return;
    }
    setMessage(`User status changed to ${status}.`);
    loadRequests();
  };

  if (!token || !admin) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <form
          onSubmit={login}
          className="mx-auto max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-emerald-400">
            Admin Panel
          </p>
          <h1 className="mt-3 text-2xl font-bold text-white">Authority Login</h1>
          {message && <p className="mt-4 rounded bg-red-950 px-3 py-2 text-sm">{message}</p>}
          <label className="mt-5 block text-sm font-semibold">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-400"
            />
          </label>
          <label className="mt-4 block text-sm font-semibold">
            Password
            <input
              value={password}
              type="password"
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-emerald-400"
            />
          </label>
          <button className="mt-6 w-full rounded-lg bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500">
            Login
          </button>
        </form>
      </div>
    );
  }

  const pendingKycCount = kycRequests.filter((user) => user.kyc?.status === 'COMPLETED').length;
  const pendingVerificationCount = verificationRequests.filter(
    (request) => request.status === 'SUBMITTED'
  ).length;
  const notificationCount = pendingKycCount + pendingVerificationCount;
  const approvedKycCount = kycRequests.filter((user) => user.kyc?.status === 'APPROVED').length;
  const approvedVerificationCount = verificationRequests.filter(
    (request) => request.status === 'APPROVED'
  ).length;
  const tabs: { id: AdminTab; label: string; count?: number }[] =
    activePlatform === 'orchard'
      ? [
          { id: 'control', label: 'Orchard Command' },
          { id: 'inventory', label: 'Inventory', count: products.length },
          { id: 'productAdmin', label: 'Add Product' },
          { id: 'orders', label: 'Buyer Orders', count: orders.length },
        ]
      : [
          { id: 'control', label: 'Mandi Command' },
          { id: 'users', label: 'User Records', count: users.length },
          { id: 'notifications', label: 'Review Alerts', count: notificationCount },
          { id: 'kyc', label: 'KYC Desk', count: kycRequests.length },
          { id: 'verified', label: 'Verification Desk', count: verificationRequests.length },
        ];
  const activeTitle = getAdminTabTitle(activeTab, activePlatform);
  const searchedProducts = filterProducts(products, adminSearch);
  const searchedUsers = filterUsers(users, adminSearch);
  const activePanel =
    activeTab === 'control' ? (
      <HomePanel
        activePlatform={activePlatform}
        pendingKycCount={pendingKycCount}
        pendingVerificationCount={pendingVerificationCount}
        approvedKycCount={approvedKycCount}
        approvedVerificationCount={approvedVerificationCount}
        productCount={products.length}
        userCount={users.length}
        onOpenTab={setActiveTab}
      />
    ) : activeTab === 'inventory' ? (
      <InventoryPanel products={searchedProducts} onUpdateStock={updateProductStock} />
    ) : activeTab === 'productAdmin' ? (
      <ProductAdminPanel draft={productDraft} onChange={setProductDraft} onSubmit={saveOrchardProduct} />
    ) : activeTab === 'purchase' ? (
      <SimpleAdminPanel
        title="Purchase"
        text="Manage incoming Orchard Growers stock, vendor buying, nursery purchases, and product intake before inventory posting."
      />
    ) : activeTab === 'sales' ? (
      <OrdersPanel orders={orders} />
    ) : activeTab === 'financials' ? (
      <SimpleAdminPanel
        title="Financials"
        text="Track order value, challans, invoices, payment collections, COD dues, and Orchard Growers account summaries."
      />
    ) : activeTab === 'settings' ? (
      <SimpleAdminPanel
        title={activePlatform === 'orchard' ? 'Orchard Growers Settings' : 'EfruitMandi Settings'}
        text={
          activePlatform === 'orchard'
            ? 'Configure Orchard Growers product rules, stock alerts, payment workflow, platform defaults, and admin preferences.'
            : 'Configure EfruitMandi user rules, verification queues, graph defaults, auction monitoring, and admin preferences.'
        }
      />
    ) : activeTab === 'salesGraph' ? (
      <SimpleAdminPanel
        title="Sales Graph"
        text="Visualize EfruitMandi sales volume, order value, buyer growth, and platform revenue trends."
      />
    ) : activeTab === 'salesPatternsGraph' ? (
      <SimpleAdminPanel
        title="Sales Patterns Graph"
        text="Analyze repeating sales patterns by product category, buyer segment, season, and region."
      />
    ) : activeTab === 'auctionPatternsGraph' ? (
      <SimpleAdminPanel
        title="Auction Patterns Graph"
        text="Track auction timing, bid movement, winning prices, and buyer participation patterns."
      />
    ) : activeTab === 'transactionsGraph' ? (
      <SimpleAdminPanel
        title="Transactions Graph"
        text="Monitor paid orders, COD challans, invoice conversion, refunds, and settlement movement."
      />
    ) : activeTab === 'users' ? (
      <UsersPanel users={searchedUsers} onEdit={editUserInfo} onStatus={setUserStatus} />
    ) : activeTab === 'notifications' ? (
      <NotificationsPanel
        kycRequests={kycRequests}
        verificationRequests={verificationRequests}
        onOpenTab={setActiveTab}
      />
    ) : activeTab === 'kyc' ? (
      <RequestSection title="KYC Requests" count={kycRequests.length}>
        {kycRequests.map((user) => (
          <KycRequestCard key={user._id} user={user} onReview={review} onViewFile={setViewingFile} />
        ))}
      </RequestSection>
    ) : activeTab === 'verified' ? (
      <RequestSection title="Get Verified Requests" count={verificationRequests.length}>
        {verificationRequests.map((request) => (
          <VerificationRequestCard
            key={request._id}
            request={request}
            onReview={review}
            onEdit={editVerificationRequest}
            onViewFile={setViewingFile}
          />
        ))}
      </RequestSection>
    ) : (
      <OrdersPanel orders={orders} />
    );

  return (
    <div className="h-full overflow-hidden bg-slate-950 p-2 text-slate-100">
      <div className="mx-auto flex h-full min-h-0 max-w-[1360px] flex-col">
        <MarketSnapshotStrip
          announcementRef={announcementBarRef}
          isFullscreen={fullscreenTarget === 'announcement'}
          onFullscreen={toggleAnnouncementFullscreen}
        />
        <section className="mt-2 grid gap-2 md:grid-cols-[108px_220px_minmax(0,1fr)]">
          <div className="flex h-11 items-center justify-center px-1">
            <img src={LOGO_URL} alt="Orchard Growers Admin" className="h-9 w-auto object-contain" />
          </div>
          <label className="flex h-11 items-center rounded-full border border-slate-700 bg-slate-900/95 px-4 shadow-sm shadow-black/20">
            <span className="sr-only">Search admin records</span>
            <input
              value={adminSearch}
              onChange={(event) => setAdminSearch(event.target.value)}
              placeholder="Search products, users, orders..."
              className="h-8 w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-400"
            />
          </label>
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-sm font-semibold shadow-sm shadow-black/20">
            <span className="text-emerald-300">{activeTitle}</span>
            <span className="truncate text-slate-300">{admin.name} | {admin.roleLabel || admin.role}</span>
            <div className="flex gap-2">
              <button
                onClick={loadRequests}
                className="h-8 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                onClick={logout}
                className="h-8 rounded-lg bg-white px-3 text-sm font-semibold text-slate-950 transition hover:bg-red-100"
              >
                Logout
              </button>
            </div>
          </div>
        </section>

        <section
          className="mt-2 grid flex-1 min-h-0 gap-0 overflow-hidden"
          style={{ gridTemplateColumns: `${platformRailWidth}px 6px minmax(0, 1fr)` }}
        >
          <PlatformRail
            activePlatform={activePlatform}
            activeTab={activeTab}
            onChange={(platform) => {
              setActivePlatform(platform);
              setActiveTab(platform === 'orchard' ? 'inventory' : 'users');
            }}
            onOpenTab={(platform, tab) => {
              setActivePlatform(platform);
              setActiveTab(tab);
            }}
            onLogout={logout}
          />

          <div
            onMouseDown={(event) =>
              setRailResizeStart({ x: event.clientX, width: platformRailWidth })
            }
            className="admin-resize-handle cursor-col-resize hover:bg-emerald-500 bg-emerald-600/40 transition-all active:bg-emerald-500"
            title="Drag to resize panel (left-right)"
          />

          <div ref={actionPanelRef} className="admin-action-panel min-w-0 h-full overflow-hidden bg-slate-950 flex flex-col min-h-0">
            <AdminButtonTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
            <main className="flex-1 min-h-0 overflow-y-auto border-x border-slate-700 bg-slate-950 p-4 text-slate-100">
              {message && (
                <p className="mb-4 rounded-lg border border-emerald-600 bg-emerald-950 px-4 py-3 text-sm font-bold text-emerald-100">
                  {message}
                </p>
              )}
              {activePanel}
            </main>
            <AdminButtonTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              showFullscreen
              showTabs={false}
              isFullscreen={fullscreenTarget === 'action'}
              onFullscreen={toggleActionPanelFullscreen}
            />
          </div>
        </section>
        {viewingFile && <FilePreviewModal file={viewingFile} onClose={() => setViewingFile(null)} />}
      </div>
    </div>
  );
}

function MarketSnapshotStrip({
  announcementRef,
  isFullscreen,
  onFullscreen,
}: {
  announcementRef: RefObject<HTMLElement>;
  isFullscreen: boolean;
  onFullscreen: () => void;
}) {
  const announcementItems = [...marketSnapshotCards, ...marketSnapshotCards];

  return (
    <section
      ref={announcementRef}
      className="admin-announcement-shell relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900 pr-12 shadow-sm shadow-black/20"
      aria-label="Admin announcements"
    >
      <div className="admin-announcement-track flex w-max items-center gap-4 py-2">
        {announcementItems.map((card, index) => (
          <article
            key={`${card.title}-${index}`}
            className="flex h-9 shrink-0 items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-4 text-xs font-semibold text-slate-200"
          >
            <span className="text-white">{card.title}</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-300">{card.text}</span>
          </article>
        ))}
      </div>
      <button
        type="button"
        onClick={onFullscreen}
        aria-label={isFullscreen ? 'Exit announcement full screen' : 'Open announcement full screen'}
        title={isFullscreen ? 'Exit announcement full screen' : 'Announcement full screen'}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-white text-slate-950 shadow-lg shadow-black/30 transition hover:bg-emerald-100"
      >
        <FullscreenIcon active={isFullscreen} />
      </button>
    </section>
  );
}

type MenuIconName =
  | 'plus'
  | 'purchase'
  | 'sales'
  | 'financials'
  | 'settings'
  | 'logout'
  | 'verify'
  | 'chart'
  | 'pattern'
  | 'auction'
  | 'transaction';

function PlatformRail({
  activePlatform,
  activeTab,
  onChange,
  onOpenTab,
  onLogout,
}: {
  activePlatform: AdminPlatform;
  activeTab: AdminTab;
  onChange: (platform: AdminPlatform) => void;
  onOpenTab: (platform: AdminPlatform, tab: AdminTab) => void;
  onLogout: () => void;
}) {
  const orchardMenu: { label: string; icon: MenuIconName; tab?: AdminTab; action?: () => void }[] = [
    { label: 'Add Product', icon: 'plus', tab: 'productAdmin' },
    { label: 'Purchase', icon: 'purchase', tab: 'purchase' },
    { label: 'Sales', icon: 'sales', tab: 'sales' },
    { label: 'Financials', icon: 'financials', tab: 'financials' },
    { label: 'Setting', icon: 'settings', tab: 'settings' },
    { label: 'Logout', icon: 'logout', action: onLogout },
  ];
  const efruitMenu: { label: string; icon: MenuIconName; tab?: AdminTab; action?: () => void }[] = [
    { label: 'View Verification Requests', icon: 'verify', tab: 'verified' },
    { label: 'Sales Graph', icon: 'chart', tab: 'salesGraph' },
    { label: 'Sales Patterns Graph', icon: 'pattern', tab: 'salesPatternsGraph' },
    { label: 'Auction Patterns Graph', icon: 'auction', tab: 'auctionPatternsGraph' },
    { label: 'Transactions Graph', icon: 'transaction', tab: 'transactionsGraph' },
    { label: 'Settings', icon: 'settings', tab: 'settings' },
    { label: 'Logout', icon: 'logout', action: onLogout },
  ];

  return (
    <aside className="admin-platform-scroll h-full overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-2">
      <div className="flex h-full flex-col gap-2">
        <div
          className={`rounded-lg border px-2 py-3 ${
          activePlatform === 'orchard'
            ? 'border-emerald-500 bg-emerald-950 text-emerald-100'
            : 'border-slate-700 bg-slate-900 text-slate-200'
        }`}
        >
          <button type="button" onClick={() => onChange('orchard')} className="w-full text-left">
            <span className="block text-base font-semibold">Orchard Growers</span>
            <span className="mt-1 block text-xs font-medium text-slate-400">Inventory and products</span>
          </button>
          <div className="mt-3 space-y-1">
            {orchardMenu.map((item) => {
              const selected = item.tab && activePlatform === 'orchard' && activeTab === item.tab;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => (item.action ? item.action() : item.tab && onOpenTab('orchard', item.tab))}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold transition ${
                    selected ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <MenuIcon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div
          className={`rounded-lg border px-2 py-3 ${
            activePlatform === 'efruitmandi'
              ? 'border-emerald-500 bg-emerald-950 text-emerald-100'
              : 'border-slate-700 bg-slate-900 text-slate-200'
          }`}
        >
          <button type="button" onClick={() => onChange('efruitmandi')} className="w-full text-center">
            <span className="block text-base font-semibold">EfruitMandi</span>
            <span className="mt-1 block text-xs font-medium text-slate-400">Users and verification</span>
          </button>
          <div className="mt-3 space-y-1">
            {efruitMenu.map((item) => {
              const selected = item.tab && activePlatform === 'efruitmandi' && activeTab === item.tab;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => (item.action ? item.action() : item.tab && onOpenTab('efruitmandi', item.tab))}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-bold transition ${
                    selected ? 'bg-emerald-600 text-white' : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <MenuIcon name={item.icon} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function MenuIcon({ name }: { name: MenuIconName }) {
  const paths: Record<MenuIconName, ReactNode> = {
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    purchase: (
      <>
        <path d="M6 6h15l-2 8H8L6 6Z" />
        <path d="M6 6 5 3H2" />
        <path d="M9 20h.01" />
        <path d="M18 20h.01" />
      </>
    ),
    sales: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7 15 4-4 3 3 5-7" />
      </>
    ),
    financials: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    settings: (
      <>
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.04-.04a2 2 0 1 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.4 9c.37.16.78.25 1.2.25H21a2 2 0 0 1 0 4h-.08A1.7 1.7 0 0 0 19.4 15Z" />
      </>
    ),
    logout: (
      <>
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M21 3v18" />
      </>
    ),
    verify: (
      <>
        <path d="M9 12l2 2 4-5" />
        <path d="M21 12a9 9 0 1 1-6.2-8.56" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-3" />
      </>
    ),
    pattern: (
      <>
        <path d="M4 17c3-8 5 0 8-8s5 0 8-5" />
        <path d="M4 21h16" />
      </>
    ),
    auction: (
      <>
        <path d="m14 4 6 6" />
        <path d="m8 10 6 6" />
        <path d="m7 11 8-8" />
        <path d="m13 17 8-8" />
        <path d="M3 21h8" />
      </>
    ),
    transaction: (
      <>
        <path d="M7 7h13l-3-3" />
        <path d="M17 17H4l3 3" />
        <path d="M12 8v8" />
        <path d="M9.5 10.5c0-1.1 1-1.8 2.5-1.8s2.5.7 2.5 1.8S13.5 12 12 12s-2.5.4-2.5 1.5 1 1.8 2.5 1.8 2.5-.7 2.5-1.8" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function AdminButtonTabs({
  tabs,
  activeTab,
  onChange,
  showFullscreen = false,
  showTabs = true,
  isFullscreen = false,
  onFullscreen,
}: {
  tabs: { id: AdminTab; label: string; count?: number }[];
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
  showFullscreen?: boolean;
  showTabs?: boolean;
  isFullscreen?: boolean;
  onFullscreen?: () => void;
}) {
  return (
    <nav className="flex-shrink-0 flex items-center gap-1 overflow-x-auto border border-slate-700 bg-slate-900 px-2 py-1">
      {showTabs && (
        <>
          <span className="shrink-0 px-2 text-sm font-semibold text-slate-300">Panel Actions</span>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition ${
                activeTab === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' && <span className="ml-1 text-xs">({tab.count})</span>}
            </button>
          ))}
        </>
      )}
      {showFullscreen && (
        <button
          type="button"
          onClick={onFullscreen}
          aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
          title={isFullscreen ? 'Exit action panel full screen' : 'Action panel full screen'}
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-slate-950 transition hover:bg-emerald-100"
        >
          <FullscreenIcon active={isFullscreen} />
        </button>
      )}
    </nav>
  );
}

function FullscreenIcon({ active }: { active: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {active ? (
        <>
          <path d="M9 3v6H3" />
          <path d="M15 3v6h6" />
          <path d="M9 21v-6H3" />
          <path d="M15 21v-6h6" />
        </>
      ) : (
        <>
          <path d="M3 9V3h6" />
          <path d="M21 9V3h-6" />
          <path d="M3 15v6h6" />
          <path d="M21 15v6h-6" />
        </>
      )}
    </svg>
  );
}

function getAdminTabTitle(activeTab: AdminTab, activePlatform: AdminPlatform) {
  if (activeTab === 'inventory') return 'Orchard Growers Inventory System';
  if (activeTab === 'productAdmin') return 'Add Orchard Growers Product';
  if (activeTab === 'purchase') return 'Orchard Growers Purchase';
  if (activeTab === 'sales') return 'Orchard Growers Sales';
  if (activeTab === 'financials') return 'Orchard Growers Financials';
  if (activeTab === 'settings') return activePlatform === 'orchard' ? 'Orchard Growers Settings' : 'EfruitMandi Settings';
  if (activeTab === 'users') return 'EfruitMandi User Information Desk';
  if (activeTab === 'notifications') return 'EfruitMandi Review Alerts';
  if (activeTab === 'kyc') return 'EfruitMandi KYC Desk';
  if (activeTab === 'verified') return 'EfruitMandi Verification Desk';
  if (activeTab === 'salesGraph') return 'EfruitMandi Sales Graph';
  if (activeTab === 'salesPatternsGraph') return 'EfruitMandi Sales Patterns Graph';
  if (activeTab === 'auctionPatternsGraph') return 'EfruitMandi Auction Patterns Graph';
  if (activeTab === 'transactionsGraph') return 'EfruitMandi Transactions Graph';
  if (activeTab === 'orders') return 'Orchard Growers Buyer Orders';
  return activePlatform === 'orchard' ? 'Orchard Growers Admin Command' : 'EfruitMandi Admin Command';
}

function HomePanel({
  activePlatform,
  pendingKycCount,
  pendingVerificationCount,
  approvedKycCount,
  approvedVerificationCount,
  productCount,
  userCount,
  onOpenTab,
}: {
  activePlatform: AdminPlatform;
  pendingKycCount: number;
  pendingVerificationCount: number;
  approvedKycCount: number;
  approvedVerificationCount: number;
  productCount: number;
  userCount: number;
  onOpenTab: (tab: AdminTab) => void;
}) {
  const cards =
    activePlatform === 'orchard'
      ? [
          { label: 'Products in Inventory', value: productCount, action: 'Open Inventory', tab: 'inventory' as const },
          { label: 'Buyer Orders', value: pendingVerificationCount + pendingKycCount, action: 'Open Orders', tab: 'orders' as const },
          { label: 'Product Entry Desk', value: productCount, action: 'Add Product', tab: 'productAdmin' as const },
          { label: 'Verified Supply Base', value: approvedVerificationCount + approvedKycCount, action: 'View Signals', tab: 'inventory' as const },
        ]
      : [
          { label: 'User Accounts', value: userCount, action: 'Open User Records', tab: 'users' as const },
          { label: 'KYC Queue', value: pendingKycCount, action: 'Open KYC Desk', tab: 'kyc' as const },
          { label: 'Verification Queue', value: pendingVerificationCount, action: 'Open Verification Desk', tab: 'verified' as const },
          { label: 'Verified Accounts', value: approvedVerificationCount + approvedKycCount, action: 'Review Verified Users', tab: 'verified' as const },
        ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.label}
          onClick={() => onOpenTab(card.tab)}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-left hover:border-emerald-500"
        >
          <p className="text-sm font-bold text-slate-400">{card.label}</p>
          <p className="mt-3 text-3xl font-black text-white">{card.value}</p>
          <p className="mt-4 text-sm font-bold text-emerald-300">{card.action}</p>
        </button>
      ))}
    </section>
  );
}

function InventoryPanel({
  products,
  onUpdateStock,
}: {
  products: AdminProduct[];
  onUpdateStock: (product: AdminProduct) => void;
}) {
  const lowStock = products.filter((product) => Number(product.quantity || 0) <= 20).length;

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="Total Orchard Products" value={products.length} />
        <MetricCard label="Low Stock Watch" value={lowStock} />
        <MetricCard label="Available Listings" value={products.filter((product) => product.status === 'AVAILABLE').length} />
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Orchard Growers Inventory</h2>
          <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs font-bold text-emerald-300">
            Stock, price, status
          </span>
        </div>
        <div className="space-y-3">
          {products.map((product) => {
            const image = product.images?.[0] ? normalizeFileUrl(product.images[0]) : '';
            return (
              <article key={product._id} className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 md:grid-cols-[84px_minmax(0,1fr)_160px]">
                <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg bg-slate-900">
                  {image ? (
                    <img src={image} alt={product.title || 'Product'} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-slate-500">No Image</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-white">{product.title || 'Untitled product'}</h3>
                  <p className="mt-1 text-sm font-semibold text-emerald-300">
                    {product.fruitName || 'Product'} | {product.variety || 'Orchard Growers'}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-slate-400">{product.description || 'No product description added yet.'}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">Stock: {product.quantity ?? 0} units</span>
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">Price: Rs. {product.basePrice ?? 0}</span>
                    <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">{product.location || 'Orchard Growers'}</span>
                  </div>
                </div>
                <div className="flex flex-col justify-between gap-3">
                  <span className="rounded-full bg-emerald-950 px-3 py-1 text-center text-xs font-bold text-emerald-300">
                    {product.status || 'AVAILABLE'}
                  </span>
                  <button
                    onClick={() => onUpdateStock(product)}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500"
                  >
                    Update Stock
                  </button>
                </div>
              </article>
            );
          })}
          {!products.length && <EmptyState label="No Orchard Growers products found." />}
        </div>
      </div>
    </section>
  );
}

function ProductAdminPanel({
  draft,
  onChange,
  onSubmit,
}: {
  draft: ProductDraft;
  onChange: (draft: ProductDraft) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const update = (field: keyof ProductDraft, value: string) => onChange({ ...draft, [field]: value });

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white">Add Orchard Growers Product</h2>
        <p className="mt-1 text-sm font-semibold text-slate-400">
          Create own-brand products for plants, seeds, tools, organic inputs, services, and orchard supplies.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <AdminInput label="Product name" value={draft.title} onChange={(value) => update('title', value)} placeholder="Winter Hardy Plants Pack" />
        <AdminInput label="Product category" value={draft.fruitName} onChange={(value) => update('fruitName', value)} placeholder="Live Plants / Tools / Seeds" />
        <AdminInput label="Variety / product line" value={draft.variety} onChange={(value) => update('variety', value)} placeholder="Orchard Growers Premium" />
        <AdminInput label="Location" value={draft.location} onChange={(value) => update('location', value)} placeholder="Orchard Growers" />
        <AdminInput label="Stock units" value={draft.quantity} onChange={(value) => update('quantity', value)} placeholder="100" type="number" />
        <AdminInput label="Price" value={draft.basePrice} onChange={(value) => update('basePrice', value)} placeholder="999" type="number" />
        <AdminInput label="Packing type" value={draft.packingType} onChange={(value) => update('packingType', value)} placeholder="Plant pack" />
        <label className="block text-sm font-bold text-slate-300">
          Product status
          <select
            value={draft.status}
            onChange={(event) => update('status', event.target.value)}
            className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-emerald-400"
          >
            <option value="AVAILABLE">Available</option>
            <option value="IN_AUCTION">In Auction</option>
            <option value="SOLD">Sold</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block text-sm font-bold text-slate-300">
        Product description
        <textarea
          value={draft.description}
          onChange={(event) => update('description', event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400"
          placeholder="Demo product details for buyers and Orchard Growers showcase."
        />
      </label>
      <label className="mt-3 block text-sm font-bold text-slate-300">
        Image URLs
        <textarea
          value={draft.images}
          onChange={(event) => update('images', event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400"
          placeholder="One image URL per line"
        />
      </label>
      <button className="mt-4 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-500">
        Save Product to Inventory
      </button>
    </form>
  );
}

function UsersPanel({
  users,
  onEdit,
  onStatus,
}: {
  users: AdminUser[];
  onEdit: (user: AdminUser) => void;
  onStatus: (user: AdminUser, status: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">EfruitMandi User Information</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-emerald-300">
          Profile, role, account status
        </span>
      </div>
      <div className="space-y-3">
        {users.map((user) => (
          <article key={user._id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-white">{user.businessName || user.orchardName || user.name || 'Unnamed user'}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-400">{user.email || 'No email'} | {user.phone || 'No phone'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">Role: {user.role || 'not set'}</span>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">Status: {user.accountStatus || 'ACTIVE'}</span>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-slate-300">{user.isVerified ? 'Verified' : 'Not verified'}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onEdit(user)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500">
                  Edit Info
                </button>
                <button onClick={() => onStatus(user, 'ACTIVE')} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700">
                  Active
                </button>
                <button onClick={() => onStatus(user, 'HOLD')} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-bold text-white hover:bg-amber-600">
                  Hold
                </button>
                <button onClick={() => onStatus(user, 'SUSPENDED')} className="rounded-lg bg-red-800 px-3 py-2 text-sm font-bold text-white hover:bg-red-700">
                  Suspend
                </button>
              </div>
            </div>
          </article>
        ))}
        {!users.length && <EmptyState label="No EfruitMandi users found." />}
      </div>
    </section>
  );
}

function SimpleAdminPanel({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-400">{text}</p>
      <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-5 text-sm font-semibold text-slate-500">
        Admin workflow controls will appear here as this module is expanded.
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-sm font-bold text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-white">{value}</p>
    </div>
  );
}

function AdminInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block text-sm font-bold text-slate-300">
      {label}
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white outline-none placeholder:text-slate-600 focus:border-emerald-400"
      />
    </label>
  );
}

function NotificationsPanel({
  kycRequests,
  verificationRequests,
  onOpenTab,
}: {
  kycRequests: KycUser[];
  verificationRequests: VerificationRequest[];
  onOpenTab: (tab: AdminTab) => void;
}) {
  const pendingKyc = kycRequests.filter((user) => user.kyc?.status === 'COMPLETED');
  const pendingVerification = verificationRequests.filter((request) => request.status === 'SUBMITTED');

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">EfruitMandi Review Alerts</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-emerald-300">
          {pendingKyc.length + pendingVerification.length} pending
        </span>
      </div>
      <div className="space-y-3">
        {pendingKyc.map((user) => (
          <NotificationItem
            key={`kyc-${user._id}`}
            title={`${user.businessName || user.name || 'User'} submitted KYC`}
            detail="Authority verification required within 24 hours."
            action="Review KYC"
            onClick={() => onOpenTab('kyc')}
          />
        ))}
        {pendingVerification.map((request) => (
          <NotificationItem
            key={`verification-${request._id}`}
            title={`${request.orchardName} requested verification`}
            detail="Class1 and Class2 approval required."
            action="Review Request"
            onClick={() => onOpenTab('verified')}
          />
        ))}
        {!pendingKyc.length && !pendingVerification.length && <EmptyState />}
      </div>
    </section>
  );
}

function OrdersPanel({ orders }: { orders: AdminOrder[] }) {
  return (
    <RequestSection title="Placed Orders" count={orders.length}>
      {orders.map((order) => (
        <article key={order._id} className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-base font-bold text-white">{order.invoiceNumber || order._id}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-400">
                {order.customer?.name || 'Customer'} - {order.customer?.phone || 'No phone'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {order.shippingAddress?.city || 'City'}, {order.shippingAddress?.state || 'State'} {order.shippingAddress?.pinCode || ''}
              </p>
            </div>
            <div className="text-left lg:text-right">
              <p className="text-lg font-black text-emerald-300">Rs. {order.totalAmount || 0}</p>
              <p className="text-xs font-bold text-slate-400">{order.paymentStatus} / {order.deliveryStatus}</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
            <p className="text-sm font-bold text-white">Items</p>
            <div className="mt-2 space-y-2">
              {(order.items || []).map((item, index) => (
                <div key={`${item.title}-${index}`} className="flex justify-between gap-3 text-sm text-slate-300">
                  <span>{item.title} x {item.quantity || 1}</span>
                  <span>Rs. {item.lineTotal || (Number(item.quantity || 1) * Number(item.unitPrice || 0))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
            <Info label="Courier" value={order.courierPartner || 'India Post'} />
            <Info label="Booking" value={order.courierBookingStatus || 'PENDING'} />
            <Info label="Tracking" value={order.trackingNumber || 'Not assigned'} />
          </div>
        </article>
      ))}
    </RequestSection>
  );
}

function NotificationItem({
  title,
  detail,
  action,
  onClick,
}: {
  title: string;
  detail: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="block w-full rounded-xl border border-slate-800 bg-slate-950 p-4 text-left hover:border-emerald-500"
    >
      <p className="font-bold text-white">{title}</p>
      <p className="mt-1 text-sm font-semibold text-slate-400">{detail}</p>
      <p className="mt-3 text-sm font-bold text-emerald-300">{action}</p>
    </button>
  );
}

function RequestSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold">{count}</span>
      </div>
      <div className="space-y-4">{count ? children : <EmptyState />}</div>
    </section>
  );
}

function KycRequestCard({
  user,
  onReview,
  onViewFile,
}: {
  user: KycUser;
  onReview: (type: 'kyc', id: string, action: 'APPROVE' | 'REJECT') => void;
  onViewFile: (file: UploadedFile) => void;
}) {
  const kyc = user.kyc || {};
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <RequestHeader
        title={user.businessName || user.orchardName || user.name || 'User'}
        subtitle={`${user.role || 'user'} - ${user.email || user.phone || 'No contact'}`}
        status={kyc.status || 'NOT_SUBMITTED'}
      />
      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <Info label="Udyan Card No." value={kyc.udyanCardNo} />
        <Info label="Bank A/C No." value={kyc.bankAccountNo} />
        <Info label="IFSC Code" value={kyc.ifscCode} />
        <Info label="Aadhaar Card No." value={kyc.aadhaarCardNo} />
      </div>
      <UploadedFilesPanel
        onViewFile={onViewFile}
        files={[
          { label: 'View Udyan Card Pic/PDF', path: kyc.udyanCardFileUrl },
          { label: 'View Passbook Pic/PDF', path: kyc.passbookFileUrl },
          { label: 'View Aadhaar Card Pic/PDF', path: kyc.aadhaarCardFileUrl },
        ]}
      />
      <ReviewButtons onApprove={() => onReview('kyc', user._id, 'APPROVE')} onReject={() => onReview('kyc', user._id, 'REJECT')} />
    </article>
  );
}

function VerificationRequestCard({
  request,
  onReview,
  onEdit,
  onViewFile,
}: {
  request: VerificationRequest;
  onReview: (type: 'verification', id: string, action: ReviewAction) => void;
  onEdit: (request: VerificationRequest) => void;
  onViewFile: (file: UploadedFile) => void;
}) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <RequestHeader
        title={request.orchardName}
        subtitle={`${request.user?.role || 'user'} - ${request.user?.email || request.phone}`}
        status={request.status}
      />
      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        <Info label="Company / Orchard Name" value={request.orchardName} />
        <Info label="Owner / Contact Person" value={request.ownerName} />
        <Info label="Location" value={request.location} />
        <Info label="Phone" value={request.phone} />
      </div>
      <UploadedFilesPanel
        onViewFile={onViewFile}
        files={[
          {
            label: 'View Udyan Card Pic/PDF',
            path: request.udyanCardFile?.path,
            fileName: request.udyanCardFile?.originalName,
          },
          {
            label: 'View Uploaded Video',
            path: request.orchardVideo?.path,
            fileName: request.orchardVideo?.originalName,
          },
          {
            label: 'View YouTube Video',
            path: request.youtubeVideoId
              ? `https://www.youtube.com/watch?v=${request.youtubeVideoId}`
              : '',
          },
        ]}
      />
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <AdminActionButton label="Edit" onClick={() => onEdit(request)} />
        <AdminActionButton label="Hold" onClick={() => onReview('verification', request._id, 'HOLD')} />
        <AdminActionButton label="Suspend" onClick={() => onReview('verification', request._id, 'SUSPEND')} danger />
        <AdminActionButton label="Terminate" onClick={() => onReview('verification', request._id, 'TERMINATE')} danger />
      </div>
      <ReviewButtons
        onApprove={() => onReview('verification', request._id, 'APPROVE')}
        onReject={() => onReview('verification', request._id, 'REJECT')}
      />
    </article>
  );
}

function RequestHeader({
  title,
  subtitle,
  status,
}: {
  title: string;
  subtitle: string;
  status: string;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-white">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-slate-400">{subtitle}</p>
        </div>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-bold text-emerald-300">
          {status}
        </span>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="min-w-0 break-words text-slate-200">{value || 'Not available'}</span>
    </div>
  );
}

function UploadedFilesPanel({
  files,
  onViewFile,
}: {
  files: UploadedFile[];
  onViewFile: (file: UploadedFile) => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-white">Uploaded Documents / Media</p>
        <span className="rounded-full bg-slate-950 px-2 py-1 text-[10px] font-bold text-slate-400">
          {files.filter((file) => normalizeFileUrl(file.path)).length}/{files.length}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {files.map((file) => (
          <FileViewButton key={file.label} file={file} onViewFile={onViewFile} />
        ))}
      </div>
    </div>
  );
}

function FileViewButton({
  file,
  onViewFile,
}: {
  file: UploadedFile;
  onViewFile: (file: UploadedFile) => void;
}) {
  const href = normalizeFileUrl(file.path);

  if (!href) {
    return (
      <div className="rounded-lg border border-dashed border-slate-700 px-3 py-2 text-sm font-bold text-slate-500">
        {file.label}: Not uploaded
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onViewFile(file)}
      title={file.fileName || file.label}
      className="rounded-lg bg-emerald-600 px-3 py-2 text-center text-sm font-bold text-white hover:bg-emerald-500"
    >
      {file.label}
    </button>
  );
}

function FilePreviewModal({ file, onClose }: { file: UploadedFile; onClose: () => void }) {
  const href = normalizeFileUrl(file.path);
  const name = file.fileName || file.label;
  const isPdf = /\.pdf($|\?)/i.test(href) || /\.pdf$/i.test(name);
  const isImage = /\.(png|jpe?g|webp|gif|bmp|svg)($|\?)/i.test(href) || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4">
          <div className="min-w-0">
            <p className="truncate text-base font-black text-white">{name}</p>
            <p className="text-xs font-bold text-slate-400">Supports Pic/PDF preview</p>
          </div>
          <div className="flex gap-2">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500"
            >
              Open New Tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-bold text-white hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-[55vh] overflow-auto p-4">
          {isImage ? (
            <img src={href} alt={name} className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain" />
          ) : isPdf ? (
            <iframe title={name} src={href} className="h-[72vh] w-full rounded-lg border border-slate-800 bg-white" />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
              <p className="text-sm font-bold text-slate-300">
                This file type cannot be previewed here. Use Open New Tab.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewButtons({
  onApprove,
  onReject,
}: {
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="mt-4 flex gap-2">
      <button
        onClick={onApprove}
        className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500"
      >
        Approve
      </button>
      <button
        onClick={onReject}
        className="flex-1 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white hover:bg-red-600"
      >
        Reject
      </button>
    </div>
  );
}

function AdminActionButton({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-sm font-bold ${
        danger
          ? 'border border-red-900 bg-red-950 text-red-100 hover:bg-red-900'
          : 'border border-slate-700 bg-slate-900 text-slate-100 hover:border-emerald-400'
      }`}
    >
      {label}
    </button>
  );
}

function EmptyState({ label = 'No requests to review.' }: { label?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-5 text-sm font-semibold text-slate-400">
      {label}
    </div>
  );
}

function filterProducts(products: AdminProduct[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return products;

  return products.filter((product) =>
    [product.title, product.fruitName, product.variety, product.description, product.location, product.status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );
}

function filterUsers(users: AdminUser[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return users;

  return users.filter((user) =>
    [user.name, user.email, user.phone, user.role || '', user.businessName, user.orchardName, user.location, user.accountStatus]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query)
  );
}

function normalizeFileUrl(path?: string) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return `${FILE_BASE}/${path.replace(/\\/g, '/')}`;
}

function confirmTwice(actionLabel: string) {
  return (
    window.confirm(`Confirm you want to ${actionLabel}.`) &&
    window.confirm(`Final confirmation: ${actionLabel} will be applied now.`)
  );
}

export default App;
