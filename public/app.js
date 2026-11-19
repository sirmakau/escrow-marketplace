/**
 * Escrow test console.
 *
 * A tiny, dependency-free front end over the existing JSON API. It keeps one
 * session per signed-in account (in localStorage) so you can act as payer and
 * payee in the same browser, which is what makes the two-party escrow flow
 * testable by hand.
 */

const SESSION_KEY = 'escrow-console-sessions-v1';
const ACTIVE_KEY = 'escrow-console-active-v1';

const $ = (sel, root = document) => root.querySelector(sel);

const el = {
  health: $('#health'),
  whoName: $('#who-name'),
  whoRole: $('#who-role'),
  whoWallet: $('#who-wallet'),
  loginForm: $('#login-form'),
  loginPhone: $('#login-phone'),
  loginPassword: $('#login-password'),
  sessionList: $('#session-list'),
  sessionCount: $('#session-count'),
  createCard: $('#create-card'),
  createForm: $('#create-form'),
  payerSelect: $('#payer-select'),
  createBtn: $('#create-btn'),
  adminCard: $('#admin-card'),
  adminStats: $('#admin-stats'),
  loadAdmin: $('#load-admin'),
  disputeList: $('#dispute-list'),
  orders: $('#orders'),
  refreshOrders: $('#refresh-orders'),
  orderTpl: $('#order-tpl'),
  log: $('#log'),
  clearLog: $('#clear-log'),
  flash: $('#flash'),
};

let sessions = loadSessions();
let activePhone = localStorage.getItem(ACTIVE_KEY);
let orders = [];
let flashTimer = null;

/* ─── Small helpers ─────────────────────────────────────────────────────── */

class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function loadSessions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((s) => s && s.phone && s.accessToken)
      : [];
  } catch {
    return [];
  }
}

function persistSessions() {
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
}

function saveActive() {
  if (activePhone) localStorage.setItem(ACTIVE_KEY, activePhone);
  else localStorage.removeItem(ACTIVE_KEY);
}

function activeSession() {
  return sessions.find((s) => s.phone === activePhone) || null;
}

function normalisePhone(input) {
  const raw = String(input).trim().replace(/[\s()-]/g, '');
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('254')) return `+${raw}`;
  if (raw.startsWith('0')) return `+254${raw.slice(1)}`;
  return raw;
}

function money(cents) {
  if (cents === null || cents === undefined) return '—';
  return (Number(cents) / 100).toLoc+254712345678 ;
  leString('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 2,
  });
}

function displayNameFor(userId) {
  const match = sessions.find((s) => s.user?.id === userId);
  return match ? match.user.displayName : `${String(userId).slice(0, 8)}…`;
}

function isStaff(session = activeSession()) {
  return session?.user?.role === 'admin' || session?.user?.role === 'support';
}

function field(labelText, input) {
  const label = document.createElement('label');
  label.append(document.createTextNode(labelText), input);
  return label;
}

function actionButton(label, variant, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `small${variant ? ` ${variant}` : ''}`;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ─── Activity log & flash ──────────────────────────────────────────────── */

function log(kind, message) {
  const item = document.createElement('li');
  item.className = `log-item ${kind}`;
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString();
  const text = document.createElement('span');
  text.textContent = message;
  item.append(time, text);
  el.log.prepend(item);
  while (el.log.children.length > 100) el.log.lastElementChild.remove();
}

function flash(message, kind = 'ok') {
  el.flash.textContent = message;
  el.flash.className = `flash ${kind}`;
  el.flash.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.flash.hidden = true; }, 5000);
}

/* ─── API client ────────────────────────────────────────────────────────── */

async function refreshSession(session) {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) return false;
    const payload = await res.json();
    session.accessToken = payload.data.accessToken;
    session.refreshToken = payload.data.refreshToken;
    persistSessions();
    log('info', 'Access token refreshed');
    return true;
  } catch {
    return false;
  }
}

async function api(path, opts = {}) {
  const { method = 'GET', body, auth = true, quiet = false, retry = true } = opts;
  const session = opts.session !== undefined ? opts.session : activeSession();
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  const text = await res.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
    ? payload.data
    : payload;

  if (!res.ok) {
    const err = payload?.error;
    if (res.status === 401 && auth && retry && session?.refreshToken) {
      if (await refreshSession(session)) {
        return api(path, { ...opts, retry: false, quiet });
      }
    }
    const message = err?.message || res.statusText || 'Request failed';
    if (!quiet) log('err', `${res.status} ${method} ${path} — ${message}`);
    throw new ApiError(message, res.status, err?.code, err?.details);
  }

  if (!quiet) log('ok', `${res.status} ${method} ${path}`);
  return data;
}

/* ─── Auth / sessions ───────────────────────────────────────────────────── */

async function signIn(phone, password) {
  const normalised = normalisePhone(phone);
  log('info', `POST /api/auth/login (${normalised})`);

  const tokens = await api('/api/auth/login', {
    method: 'POST',
    body: { phone: normalised, password },
    auth: false,
    quiet: true,
  });

  const session = {
    phone: normalised,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: null,
  };
  session.user = await api('/api/users/me', { session, quiet: true });

  const index = sessions.findIndex((s) => s.phone === normalised);
  if (index >= 0) sessions[index] = session;
  else sessions.push(session);
  activePhone = normalised;
  persistSessions();
  saveActive();

  log('ok', `Signed in as ${session.user.displayName}`);
  flash(`Signed in as ${session.user.displayName}`, 'ok');
  await refreshAll();
}

async function useSession(session) {
  activePhone = session.phone;
  saveActive();
  renderAll();
  await refreshProfile();
  await loadOrders();
  renderAll();
}

async function signOut(session) {
  try {
    await api('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken: session.refreshToken },
      session,
      quiet: true,
    });
  } catch {
    /* local sign-out is enough */
  }
  sessions = sessions.filter((s) => s.phone !== session.phone);
  if (activePhone === session.phone) {
    activePhone = sessions[0]?.phone || null;
    saveActive();
  }
  persistSessions();
  log('info', `Signed out ${session.user?.displayName || session.phone}`);
  await refreshAll();
}

async function refreshProfile() {
  const session = activeSession();
  if (!session) return;
  try {
    session.user = await api('/api/users/me', { quiet: true });
    persistSessions();
  } catch {
    /* keep the last known profile */
  }
}

/* ─── Rendering ─────────────────────────────────────────────────────────── */

function renderHeader() {
  const session = activeSession();
  if (!session?.user) {
    el.whoName.textContent = 'Not signed in';
    el.whoRole.hidden = true;
    el.whoWallet.hidden = true;
    return;
  }
  el.whoName.textContent = session.user.displayName;
  el.whoRole.textContent = session.user.role;
  el.whoRole.hidden = false;
  el.whoWallet.textContent = money(session.user.wallet?.balance ?? 0);
  el.whoWallet.hidden = false;
}

function renderSessions() {
  el.sessionCount.textContent = String(sessions.length);
  el.sessionList.replaceChildren();

  if (sessions.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No accounts signed in.';
    el.sessionList.append(empty);
    return;
  }

  for (const session of sessions) {
    const item = document.createElement('li');
    item.className = `session${session.phone === activePhone ? ' active' : ''}`;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'session-main';
    main.disabled = session.phone === activePhone;
    main.title = session.phone === activePhone ? 'Active account' : 'Act as this account';

    const name = document.createElement('span');
    name.className = 'session-name';
    name.textContent = session.user?.displayName || session.phone;

    const meta = document.createElement('span');
    meta.className = 'session-meta';
    meta.textContent = `${session.user?.role || 'user'} · ${session.phone}`;

    main.append(name, meta);
    main.addEventListener('click', () => useSession(session));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'icon';
    remove.title = 'Sign out';
    remove.setAttribute('aria-label', `Sign out ${session.phone}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => signOut(session));

    item.append(main, remove);
    el.sessionList.append(item);
  }
}

function renderCreate() {
  const session = activeSession();
  el.createCard.hidden = !session;

  el.payerSelect.replaceChildren();
  if (!session) return;

  const candidates = sessions.filter((s) => s.user && s.user.id !== session.user?.id);
  if (candidates.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'Sign in a second account first';
    option.value = '';
    el.payerSelect.append(option);
    el.payerSelect.disabled = true;
    el.createBtn.disabled = true;
    return;
  }

  el.payerSelect.disabled = false;
  el.createBtn.disabled = false;
  for (const candidate of candidates) {
    const option = document.createElement('option');
    option.value = candidate.user.id;
    option.textContent = `${candidate.user.displayName} (${candidate.phone})`;
    el.payerSelect.append(option);
  }
}

function renderAdminVisibility() {
  el.adminCard.hidden = !isStaff();
}

function renderOrders() {
  const session = activeSession();
  el.orders.replaceChildren();

  if (!session) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Sign in to see orders.';
    el.orders.append(empty);
    return;
  }

  if (orders.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'No orders yet. Create one on the left.';
    el.orders.append(empty);
    return;
  }

  const sorted = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  for (const order of sorted) {
    el.orders.append(renderOrder(order, session));
  }
}

function renderOrder(order, session) {
  const node = el.orderTpl.content.firstElementChild.cloneNode(true);
  const set = (name, value) => {
    const target = node.querySelector(`[data-f="${name}"]`);
    target.textContent = value;
  };

  const state = node.querySelector('[data-f="state"]');
  state.textContent = order.state;
  state.classList.add(`state-${String(order.state).toLowerCase()}`);

  set('short', `#${order.id.slice(0, 8)}`);
  set('amount', money((order.priceCents ?? 0) + (order.calloutFeeCents ?? 0)));
  set('payer', displayNameFor(order.payerId));
  set('payee', displayNameFor(order.payeeId));
  set(
    'terms',
    order.termsVersion
      ? `v${order.termsVersion} · ${order.deliveryMode || '—'} · callout ${money(order.calloutFeeCents ?? 0)}`
      : 'No terms set',
  );
  set('raw', JSON.stringify(order, null, 2));

  const actions = node.querySelector('[data-f="actions"]');
  const addAction = (label, variant, handler) => {
    actions.append(actionButton(label, variant, () => runOrderAction(node, handler)));
  };

  const uid = session.user.id;
  const isPayer = order.payerId === uid;
  const isPayee = order.payeeId === uid;

  if (isPayer || isPayee) {
    switch (order.state) {
      case 'DRAFT':
        if (isPayee) {
          actions.append(actionButton('Set terms', 'primary', () => openTermsForm(node, order)));
          addAction('Propose', '', () => api(`/api/orders/${order.id}/propose`, { method: 'POST' }));
          addAction('Cancel', 'danger', () => api(`/api/orders/${order.id}/cancel`, { method: 'POST' }));
        }
        break;

      case 'PROPOSED':
        if (isPayee) actions.append(actionButton('Revise terms', 'primary', () => openTermsForm(node, order)));
        if (isPayer) {
          if (order.termsVersion > 0) {
            addAction(`Accept v${order.termsVersion}`, 'primary', () =>
              api(`/api/orders/${order.id}/accept`, {
                method: 'POST',
                body: { termsVersion: order.termsVersion },
              }));
          }
          addAction('Cancel', 'danger', () => api(`/api/orders/${order.id}/cancel`, { method: 'POST' }));
        }
        break;

      case 'ACCEPTED':
        if (isPayer) {
          addAction('Fund (mock STK)', 'primary', () => fundOrder(node, order));
          addAction('Cancel', 'danger', () => api(`/api/orders/${order.id}/cancel`, { method: 'POST' }));
        }
        break;

      case 'FUNDED':
        addAction('Start work', 'primary', () => api(`/api/orders/${order.id}/start`, { method: 'POST' }));
        actions.append(actionButton('Open dispute', '', () => openDisputeForm(node, order)));
        break;

      case 'IN_PROGRESS':
        if (isPayee) {
          addAction('Mark delivered', 'primary', () => api(`/api/orders/${order.id}/deliver`, { method: 'POST' }));
        }
        actions.append(actionButton('Open dispute', '', () => openDisputeForm(node, order)));
        break;

      case 'DELIVERED':
        if (isPayer) {
          addAction('Complete order', 'primary', () => api(`/api/orders/${order.id}/complete`, { method: 'POST' }));
        }
        actions.append(actionButton('Open dispute', '', () => openDisputeForm(node, order)));
        break;

      case 'COMPLETED':
        if (isPayer) {
          addAction('Release payment', 'primary', () => api(`/api/payments/release/${order.id}`, { method: 'POST' }));
        }
        actions.append(actionButton('Open dispute', '', () => openDisputeForm(node, order)));
        break;

      default:
        break;
    }
  }

  if (actions.children.length === 0) actions.remove();
  return node;
}

/* ─── Order actions ─────────────────────────────────────────────────────── */

async function runOrderAction(node, handler) {
  node.classList.add('busy');
  try {
    await handler();
    await refreshAll();
  } catch (err) {
    flash(err.message, 'error');
  } finally {
    node.classList.remove('busy');
  }
}

async function openTermsForm(node, order) {
  // The list payload doesn't carry the terms text, so fetch the order detail
  // to prefill the latest version when revising.
  let detail = null;
  try {
    detail = await api(`/api/orders/${order.id}`, { quiet: true });
  } catch {
    /* fall back to an empty form */
  }
  const latest = Array.isArray(detail?.terms) && detail.terms.length > 0
    ? detail.terms[detail.terms.length - 1]
    : null;

  const wrap = node.querySelector('[data-f="form"]');
  wrap.hidden = false;
  wrap.replaceChildren();

  const form = document.createElement('form');
  const row = document.createElement('div');
  row.className = 'row';

  const price = document.createElement('input');
  price.type = 'number';
  price.min = '0.01';
  price.step = '0.01';
  price.required = true;
  price.placeholder = '1000.00';
  if (order.priceCents != null) price.value = (order.priceCents / 100).toFixed(2);

  const callout = document.createElement('input');
  callout.type = 'number';
  callout.min = '0';
  callout.step = '0.01';
  callout.placeholder = '0.00';
  if (order.calloutFeeCents != null) callout.value = (order.calloutFeeCents / 100).toFixed(2);

  row.append(field('Price (KES)', price), field('Call-out fee (KES)', callout));

  const delivery = document.createElement('select');
  for (const [value, label] of [['digital', 'Digital delivery'], ['in_person', 'In person']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    delivery.append(option);
  }
  if (order.deliveryMode) delivery.value = order.deliveryMode;

  const scope = document.createElement('textarea');
  scope.required = true;
  scope.placeholder = 'What is being delivered?';
  if (latest?.scopeDescription) scope.value = latest.scopeDescription;

  const extra = document.createElement('textarea');
  extra.placeholder = 'Optional extra terms';
  if (latest?.extraTerms) extra.value = latest.extraTerms;

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'small ghost';
  close.textContent = 'Close';
  close.addEventListener('click', () => { wrap.hidden = true; });

  const save = document.createElement('button');
  save.type = 'submit';
  save.className = 'small primary';
  save.textContent = 'Save terms';

  actions.append(close, save);
  form.append(row, field('Delivery mode', delivery), field('Scope', scope), field('Extra terms', extra), actions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!scope.value.trim()) {
      flash('Scope description is required', 'error');
      return;
    }
    await runOrderAction(node, () =>
      api(`/api/orders/${order.id}/terms`, {
        method: 'PUT',
        body: {
          priceCents: Math.round(Number(price.value) * 100),
          calloutFeeCents: Math.max(0, Math.round(Number(callout.value || 0) * 100)),
          scopeDescription: scope.value.trim(),
          deliveryMode: delivery.value,
          extraTerms: extra.value.trim() || undefined,
        },
      }));
  });

  wrap.append(form);
  price.focus();
}

function openDisputeForm(node, order) {
  const wrap = node.querySelector('[data-f="form"]');
  wrap.hidden = false;
  wrap.replaceChildren();

  const form = document.createElement('form');

  const reason = document.createElement('select');
  for (const value of ['NOT_DELIVERED', 'QUALITY', 'NO_RESPONSE', 'OTHER']) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value.replace('_', ' ').toLowerCase();
    reason.append(option);
  }

  const description = document.createElement('textarea');
  description.required = true;
  description.placeholder = 'Describe what went wrong';

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'small ghost';
  close.textContent = 'Close';
  close.addEventListener('click', () => { wrap.hidden = true; });

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'small primary';
  submit.textContent = 'Open dispute';

  actions.append(close, submit);
  form.append(field('Reason', reason), field('Description', description), actions);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!description.value.trim()) {
      flash('Description is required', 'error');
      return;
    }
    await runOrderAction(node, () =>
      api(`/api/disputes/${order.id}`, {
        method: 'POST',
        body: { reason: reason.value, description: description.value.trim() },
      }));
  });

  wrap.append(form);
  description.focus();
}

async function fundOrder(node, order) {
  const result = await api(`/api/payments/fund/${order.id}`, { method: 'POST' });
  log('info', `STK push ${result.checkoutRequestId} sent — mock callback arrives in ~2s`);
  flash('STK push sent. Waiting for the mock M-Pesa callback…', 'ok');
  await sleep(3000);
}

/* ─── Admin / support ───────────────────────────────────────────────────── */

function renderStats(stats) {
  el.adminStats.replaceChildren();
  const tiles = [
    ['Users', stats.users],
    ['Orders', stats.orders],
    ['Disputes', stats.disputes],
    ['Revenue', money(stats.revenue)],
  ];
  for (const [label, value] of tiles) {
    const tile = document.createElement('div');
    tile.className = 'stat';
    const bold = document.createElement('b');
    bold.textContent = String(value ?? '—');
    const caption = document.createElement('span');
    caption.textContent = label;
    tile.append(bold, caption);
    el.adminStats.append(tile);
  }
}

function renderDisputes(disputes) {
  el.disputeList.replaceChildren();

  if (disputes.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No disputes.';
    el.disputeList.append(empty);
    return;
  }

  for (const dispute of disputes) {
    const item = document.createElement('li');
    item.className = 'dispute';

    const title = document.createElement('div');
    title.className = 'dispute-title';
    title.textContent = `#${String(dispute.orderId).slice(0, 8)} · ${dispute.reason} · ${dispute.status}`;

    const meta = document.createElement('div');
    meta.className = 'dispute-meta';
    meta.textContent = dispute.description;

    item.append(title, meta);

    if (dispute.status === 'OPEN' || dispute.status === 'IN_REVIEW') {
      const controls = document.createElement('div');
      controls.className = 'dispute-controls';

      const select = document.createElement('select');
      for (const [value, label] of [
        ['REFUND_PAYER', 'Refund payer'],
        ['RELEASE_PAYEE', 'Release to payee'],
        ['SPLIT', 'Split (mark resolved only)'],
      ]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.append(option);
      }

      const resolve = document.createElement('button');
      resolve.type = 'button';
      resolve.className = 'small primary';
      resolve.textContent = 'Resolve';
      resolve.addEventListener('click', async () => {
        resolve.disabled = true;
        try {
          await api(`/api/disputes/${dispute.id}/resolve`, {
            method: 'POST',
            body: { resolution: select.value, notes: 'Resolved from test console' },
          });
          flash('Dispute resolved', 'ok');
          await refreshAll();
          await loadAdmin();
        } catch (err) {
          flash(err.message, 'error');
        } finally {
          resolve.disabled = false;
        }
      });

      controls.append(select, resolve);
      item.append(controls);
    }

    el.disputeList.append(item);
  }
}

async function loadAdmin() {
  const session = activeSession();
  if (!isStaff(session)) return;

  if (session.user.role === 'admin') {
    try {
      renderStats(await api('/api/admin/dashboard', { quiet: true }));
    } catch {
      /* dashboard is admin-only */
    }
  } else {
    el.adminStats.replaceChildren();
  }

  try {
    const result = await api('/api/disputes?limit=20', { quiet: true });
    renderDisputes(result?.items || []);
  } catch (err) {
    flash(err.message, 'error');
  }
}

/* ─── Refresh ───────────────────────────────────────────────────────────── */

async function loadOrders() {
  const session = activeSession();
  if (!session) {
    orders = [];
    renderOrders();
    return;
  }
  try {
    const result = await api('/api/orders?limit=50', { quiet: true });
    orders = Array.isArray(result?.items) ? result.items : [];
  } catch (err) {
    orders = [];
    flash(err.message, 'error');
  }
  renderOrders();
}

function renderAll() {
  renderHeader();
  renderSessions();
  renderCreate();
  renderAdminVisibility();
  renderOrders();
}

async function refreshAll() {
  await refreshProfile();
  renderAll();
  await loadOrders();
  renderHeader();
}

/* ─── Events ────────────────────────────────────────────────────────────── */

el.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = el.loginForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await signIn(el.loginPhone.value, el.loginPassword.value);
    el.loginPassword.value = '';
  } catch (err) {
    log('err', `Sign-in failed — ${err.message}`);
    flash(err.message, 'error');
  } finally {
    button.disabled = false;
  }
});

for (const quick of document.querySelectorAll('.quick button[data-phone]')) {
  quick.addEventListener('click', async () => {
    el.loginPhone.value = quick.dataset.phone;
    el.loginPassword.value = 'password123';
    quick.disabled = true;
    try {
      await signIn(quick.dataset.phone, 'password123');
      el.loginPassword.value = '';
    } catch (err) {
      log('err', `Sign-in failed — ${err.message}`);
      flash(err.message, 'error');
    } finally {
      quick.disabled = false;
    }
  });
}

el.createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const session = activeSession();
  if (!session) return;
  const payerId = el.payerSelect.value;
  if (!payerId) {
    flash('Sign in a payer account first', 'error');
    return;
  }
  el.createBtn.disabled = true;
  try {
    const order = await api('/api/orders', { method: 'POST', body: { payerId } });
    log('info', `Created order #${order.id.slice(0, 8)} as payee`);
    await refreshAll();
  } catch (err) {
    flash(err.message, 'error');
  } finally {
    el.createBtn.disabled = false;
  }
});

el.refreshOrders.addEventListener('click', async () => {
  await refreshProfile();
  await loadOrders();
  renderAll();
});

el.loadAdmin.addEventListener('click', loadAdmin);

el.clearLog.addEventListener('click', () => el.log.replaceChildren());

/* ─── Boot ──────────────────────────────────────────────────────────────── */

async function boot() {
  if (!activePhone && sessions[0]) activePhone = sessions[0].phone;
  if (activePhone && !activeSession()) activePhone = sessions[0]?.phone || null;

  renderAll();

  try {
    const res = await fetch('/health');
    const body = await res.json();
    el.health.textContent = `${body.status} · ${body.mode} mode`;
  } catch {
    el.health.textContent = 'unreachable';
  }

  if (activeSession()) {
    await refreshProfile();
    renderAll();
    await loadOrders();
    renderHeader();
  }

  log('info', 'Console ready. API calls will appear here.');
}

boot();
