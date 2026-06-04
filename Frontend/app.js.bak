/**
 * Simple SPA frontend (vanilla JS)
 * Configure API_BASE to point to your backend (default localhost:4000/api)
 *
 * Endpoints used:
 * POST  /api/auth/register
 * POST  /api/auth/login
 * GET   /api/users/me
 * POST  /api/users/upload-qr (form-data field 'qr')
 * GET   /api/bills/providers
 * POST  /api/bills/pay
 * GET   /api/wallet/history
 * POST  /api/wallet/send
 * GET   /api/wallet/balance
 * GET   /api/admin/users
 * GET   /api/admin/transactions
 */

let API_BASE = (window.__API_BASE__ || 'http://localhost:4000/api').replace(/\/$/, '');

///// State / Auth helpers
const store = {
  token: localStorage.getItem('ewallet_token') || null,
  user: JSON.parse(localStorage.getItem('ewallet_user') || 'null'),
};

function setAuth(token, user) {
  store.token = token;
  store.user = user;
  if (token) localStorage.setItem('ewallet_token', token);
  else localStorage.removeItem('ewallet_token');
  if (user) localStorage.setItem('ewallet_user', JSON.stringify(user));
  else localStorage.removeItem('ewallet_user');
  renderTopbar();
}

function logout() {
  setAuth(null, null);
  goto('login');
}

/** helper for fetch with token and JSON handling */
async function apiFetch(path, options = {}) {
  const headers = options.headers || {};
  if (store.token) headers['Authorization'] = 'Bearer ' + store.token;
  const opts = { credentials: 'same-origin', ...options, headers };
  try {
    const res = await fetch(API_BASE + path, opts);
    if (res.status === 401) {
      // expired or unauthorized; auto logout
      logout();
      throw new Error('Unauthorized — please login again');
    }
    const text = await res.text();
    try {
      const json = text ? JSON.parse(text) : {};
      if (!res.ok) {
        throw new Error(json.message || (json.error && json.error.message) || ('Request failed: ' + res.status));
      }
      return json;
    } catch (err) {
      // non-json
      if (!res.ok) throw new Error('Request failed: ' + res.status);
      return text;
    }
  } catch (err) {
    // Network error or fetch failure
    console.error('API Fetch Error:', {
      path,
      url: API_BASE + path,
      error: err.message,
      timestamp: new Date().toISOString()
    });
    throw new Error(`Connection failed: ${err.message} (API: ${API_BASE})`);
  }
}

///// Simple client-side navigation
const main = document.getElementById('main');
const navDashboard = document.getElementById('nav-dashboard');
const navSend = document.getElementById('nav-send');
const navTopup = document.getElementById('nav-topup');
const navUpload = document.getElementById('nav-upload');
const navBills = document.getElementById('nav-bills');
const navHistory = document.getElementById('nav-history');
const navAdmin = document.getElementById('nav-admin');
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');

navDashboard.addEventListener('click', () => goto('dashboard'));
navSend.addEventListener('click', () => goto('send'));
navTopup && navTopup.addEventListener('click', () => goto('topup'));
navUpload.addEventListener('click', () => goto('upload'));
navBills.addEventListener('click', () => goto('bills'));
navHistory.addEventListener('click', () => goto('history'));
navAdmin.addEventListener('click', () => goto('admin'));

// Wire hamburger toggle
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

function closeMobileMenu() {
  try {
    if (mainNav) mainNav.classList.remove('open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  } catch(_){}
}

btnLogin.addEventListener('click', () => goto('login'));
btnRegister.addEventListener('click', () => goto('register'));
btnLogout.addEventListener('click', logout);

function renderTopbar() {
  if (store.user) {
    userInfo.textContent = `${store.user.name} (${store.user.role})`;
    btnLogin.classList.add('hidden');
    btnRegister.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    // show admin
    if (store.user.role === 'admin') navAdmin.classList.remove('hidden');
    else navAdmin.classList.add('hidden');
  } else {
    userInfo.textContent = '';
    btnLogin.classList.remove('hidden');
    btnRegister.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    navAdmin.classList.add('hidden');
  }
}
renderTopbar();

// Demo mode toggle helpers (persisted in localStorage)
function isDemoMode() {
  const v = localStorage.getItem('ewallet_demo_mode');
  if (v === null) return true; // default to demo ON for safety
  return v === '1' || v === 'true';
}

function setDemoMode(enabled) {
  localStorage.setItem('ewallet_demo_mode', enabled ? '1' : '0');
  const btn = document.getElementById('dev-mode-toggle');
  if (btn) btn.textContent = enabled ? 'Demo: ON' : 'Demo: OFF';
}

// wire up the toggle and API configuration if present
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('dev-mode-toggle');
  if (btn) {
    // initialize label
    setDemoMode(isDemoMode());
    btn.addEventListener('click', () => {
      const next = !isDemoMode();
      setDemoMode(next);
    });
  }

  const apiBtn = document.getElementById('api-settings-btn');
  if (apiBtn) {
    apiBtn.addEventListener('click', () => {
      const current = localStorage.getItem('API_BASE_URL') || API_BASE;
      const next = prompt('Enter Backend API Base URL:\n(e.g., https://your-backend.onrender.com/api)', current);
      if (next !== null) {
        const trimmed = next.trim().replace(/\/$/, '');
        if (trimmed) {
          localStorage.setItem('API_BASE_URL', trimmed);
          alert(`API URL set to: ${trimmed}\nReloading page...`);
          window.location.reload();
        } else {
          localStorage.removeItem('API_BASE_URL');
          alert('API URL reset to default.\nReloading page...');
          window.location.reload();
        }
      }
    });
  }
});

///// Router
let currentRoute = 'dashboard';
function goto(route) {
  currentRoute = route;
  window.scrollTo(0,0);
  // close mobile menu on navigation
  try { if (typeof closeMobileMenu === 'function') closeMobileMenu(); } catch(_){}
  switch (route) {
    case 'login': renderLogin(); break;
    case 'register': renderRegister(); break;
    case 'send': authGuard(renderSend); break;
    case 'topup': authGuard(renderTopUp); break;
    case 'upload': authGuard(renderUpload); break;
    case 'bills': authGuard(renderBills); break;
    case 'history': authGuard(renderHistory); break;
    case 'admin': authGuard(renderAdmin); break;
    default: authGuard(renderDashboard);
  }
}

function authGuard(renderFn) {
  if (!store.token) {
    renderLogin();
    return;
  }
  // optionally refresh profile
  apiFetch('/users/me').then(json => {
    store.user = json.user;
    localStorage.setItem('ewallet_user', JSON.stringify(store.user));
    renderTopbar();
    renderFn();
  }).catch(err => {
    // if profile fetch fails, force login
    console.warn('profile fetch failed', err);
    renderLogin();
  });
}

///// Views

function renderLogin() {
  main.innerHTML = `
    <div class="card center fade-in" style="max-width:460px;margin:24px auto">
      <h2>Sign in</h2>
      <p class="smallmuted">Use your email and password</p>
      
      <form id="form-login" style="width:100%;margin-top:12px">
        <input name="email" required placeholder="Email" class="input" />
        <input name="password" required type="password" placeholder="Password" class="input" />
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn" type="submit">Sign in</button>
          <button type="button" class="btn ghost" id="to-register">Create account</button>
        </div>
        <div class="smallmuted" style="margin:10px 0">or</div>
        <button id="btn-google" type="button" class="btn" style="background:linear-gradient(90deg,#fff,#eee);color:#333">
          <span style="display:inline-flex;align-items:center;gap:8px">
            <img alt="G" src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18" />
            <span>Sign in with Google</span>
          </span>
        </button>
        <div id="login-msg" class="smallmuted" style="margin-top:8px"></div>
      </form>
    </div>
  `;

  document.getElementById('to-register').addEventListener('click', () => goto('register'));
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const msg = document.getElementById('login-msg');
    msg.textContent = 'Signing in...';
    try {
      const json = await apiFetch('/auth/login', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email, password })
      });
      setAuth(json.token, json.user);
      msg.textContent = 'Welcome, ' + json.user.name;
      goto('dashboard');
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('err');
    }
  });

  // Google sign-in
  const btnGoogle = document.getElementById('btn-google');
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      const msg = document.getElementById('login-msg');
      msg.textContent = 'Opening Google sign-in...';
      try {
        if (!window.__googlePopupSignIn) throw new Error('Google SDK not loaded');
        const { idToken, user } = await window.__googlePopupSignIn();
        msg.textContent = 'Signing in...';
        const json = await apiFetch('/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
        setAuth(json.token, json.user);
        msg.textContent = 'Welcome, ' + (json.user?.name || user?.displayName || 'User');
        goto('dashboard');
      } catch (err) {
        msg.textContent = err.message || 'Google sign-in failed';
        msg.classList.add('err');
      }
    });
  }
}

function renderRegister() {
  main.innerHTML = `
    <div class="card center fade-in" style="max-width:540px;margin:24px auto">
      <h2>Create account</h2>
      <p class="smallmuted">Register a new user</p>
      <form id="form-register" style="width:100%;margin-top:12px">
        <input name="name" required placeholder="Full name" class="input" />
        <input name="email" required placeholder="Email" class="input" />
        <input name="password" required type="password" placeholder="Password" class="input" />
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn" type="submit">Create account</button>
          <button type="button" class="btn ghost" id="to-login">Back to login</button>
        </div>
        <div id="reg-msg" class="smallmuted" style="margin-top:8px"></div>
      </form>
    </div>
  `;
  document.getElementById('to-login').addEventListener('click', () => goto('login'));
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const msg = document.getElementById('reg-msg');
    msg.textContent = 'Creating...';
    try {
      const json = await apiFetch('/auth/register', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, email, password })
      });
      setAuth(json.token, json.user);
      msg.textContent = 'Account created';
      goto('dashboard');
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('err');
    }
  });
}

async function renderDashboard() {
  main.innerHTML = `<div class="grid cols-3" id="dash-grid"></div>`;
  const grid = document.getElementById('dash-grid');

  // Left: main card
  const left = document.createElement('div');
  left.className = 'card fade-in';
  left.innerHTML = `
    <h2>Welcome, ${escapeHtml((store.user && store.user.name) || 'User')}</h2>
    <p class="smallmuted">Your wallet at a glance</p>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
      <div>
        <div class="smallmuted">Available balance</div>
        <div id="balance" style="font-size:22px;font-weight:700;margin-top:6px">—</div>
      </div>
      <div style="text-align:right">
        <button id="dash-send" class="btn">Send</button>
        <button id="dash-upload" class="btn ghost">Upload QR</button>
      </div>
    </div>
  `;
  grid.appendChild(left);

  // Middle: quick actions
  const mid = document.createElement('div');
  mid.className = 'card fade-in';
  mid.innerHTML = `
    <h2>Quick Actions</h2>
    <p class="smallmuted">Tap to go</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px">
      <button class="btn" id="q-send">Send money</button>
      <button class="btn" id="q-topup">Top Up</button>
      <button class="btn ghost" id="q-upload">Upload QR</button>
      <button class="btn ghost" id="q-bills">Pay bills</button>
      <button class="btn ghost" id="q-history">History</button>
    </div>
  `;
  grid.appendChild(mid);

  // Right: providers preview (fetched)
  const right = document.createElement('div');
  right.className = 'card fade-in';
  right.innerHTML = `<h2>Providers</h2><p class="smallmuted">Quick pay</p><div id="providers-list" style="margin-top:10px"></div>`;
  grid.appendChild(right);

  // Admin quick controls (only visible to admin role)
  if (store.user && store.user.role === 'admin') {
    const adminCard = document.createElement('div');
    adminCard.className = 'card fade-in';
    adminCard.innerHTML = `
      <h2>Admin Controls</h2>
      <p class="smallmuted">Quick admin actions and summaries</p>
      <div id="admin-quick" style="margin-top:12px">Loading...</div>
      <div style="margin-top:12px"><button id="open-admin" class="btn">Open Admin Panel</button></div>
    `;
    grid.appendChild(adminCard);
    document.getElementById('open-admin').addEventListener('click', () => goto('admin'));

    // fetch small summaries (non-blocking)
    (async () => {
      try {
        const [ujson, tjson] = await Promise.all([apiFetch('/admin/users'), apiFetch('/admin/transactions')]);
        const users = ujson.users || [];
        const tx = tjson.data || [];
        const demoCount = tx.filter(t => t.meta && t.meta.force).length;
        const uq = document.getElementById('admin-quick');
        if (uq) uq.innerHTML = `<div><strong>${users.length}</strong> users</div><div style="margin-top:6px"><strong>${demoCount}</strong> demo deposits</div>`;
      } catch (e) {
        const uq = document.getElementById('admin-quick');
        if (uq) uq.innerHTML = `<div class="smallmuted">Failed to load admin summary</div>`;
      }
    })();
  }

  // Attach handlers
  document.getElementById('dash-send').addEventListener('click', () => goto('send'));
  document.getElementById('dash-upload').addEventListener('click', () => goto('upload'));
  document.getElementById('q-send').addEventListener('click', () => goto('send'));
  // Quick action: Top Up
  const qTopup = document.getElementById('q-topup'); if (qTopup) qTopup.addEventListener('click', () => goto('topup'));
  // Quick action: Upload QR
  const qUpload = document.getElementById('q-upload'); if (qUpload) qUpload.addEventListener('click', () => goto('upload'));
  document.getElementById('q-bills').addEventListener('click', () => goto('bills'));
  document.getElementById('q-history').addEventListener('click', () => goto('history'));

  // fetch balance and providers in parallel
  const balEl = document.getElementById('balance');
  balEl.textContent = 'Loading...';
  try {
    const [profile, providers] = await Promise.all([
      apiFetch('/users/me'),
      apiFetch('/bills/providers')
    ]);
    // profile may include balance
    const b = profile.user.balance ?? 0;
    balEl.textContent = formatCurrency(b);
    // render providers
    const pl = document.getElementById('providers-list');
    pl.innerHTML = '';
    (providers.providers || []).slice(0,5).forEach(p=>{
      const d = document.createElement('div');
      d.style.display='flex';
      d.style.justifyContent='space-between';
      d.style.padding='8px 0';
      d.innerHTML = `<div><strong>${escapeHtml(p.name)}</strong><div class="smallmuted">${escapeHtml(p.code)}</div></div>
                     <button class="btn ghost small" data-code="${escapeHtml(p.code)}">Pay</button>`;
      pl.appendChild(d);
    });
    // hook quick pay buttons
    pl.querySelectorAll('button[data-code]').forEach(btn=>{
      btn.addEventListener('click', () => {
        goto('bills');
        // slight delay then fill provider
        setTimeout(()=> {
          const sel = document.querySelector('select[name="providerCode"]');
          if (sel) sel.value = btn.getAttribute('data-code');
        }, 300);
      });
    });
  } catch (err) {
    balEl.textContent = '—';
    console.warn(err);
  }
}

function renderSend() {
  main.innerHTML = `
    <div class="card fade-in" style="max-width:740px;margin:12px auto">
      <h2>Send money</h2>
      <p class="smallmuted">Send funds to another user by email or UPI id</p>
      <form id="form-send" style="margin-top:12px">
        <div class="form-row">
          <input name="toEmail" required placeholder="Recipient (email or UPI id)" class="input" />
          <input name="amount" required placeholder="Amount (e.g., 500)" type="number" step="0.01" class="input" />
        </div>
        <div class="smallmuted" style="margin-top:6px">You can paste an email (user@domain) or a UPI id (alice@oksbi) from QR scans</div>
        <input name="note" placeholder="Note (optional)" class="input" />
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" type="submit">Send</button>
          <button type="button" class="btn ghost" id="send-back">Back</button>
        </div>
        <div id="send-msg" style="margin-top:8px"></div>
      </form>
    </div>
  `;
  // if a QR prefill exists, populate the form fields
  try {
    if (store.qrPrefill) {
      const toEl = document.querySelector('input[name="toEmail"]');
      const amtEl = document.querySelector('input[name="amount"]');
      const noteEl = document.querySelector('input[name="note"]');
      if (toEl && store.qrPrefill.toEmail) toEl.value = store.qrPrefill.toEmail;
      if (amtEl && store.qrPrefill.amount) amtEl.value = store.qrPrefill.amount;
      if (noteEl && store.qrPrefill.note) noteEl.value = store.qrPrefill.note;
      // clear after use
      delete store.qrPrefill;
    }
  } catch (e) { console.warn('prefill failed', e); }

  document.getElementById('send-back').addEventListener('click', () => goto('dashboard'));
  document.getElementById('form-send').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const toEmail = e.target.toEmail.value.trim();
    const amount = Number(e.target.amount.value);
    const note = e.target.note.value.trim();
    const msg = document.getElementById('send-msg');
    msg.textContent = 'Sending...';
    msg.classList.remove('err', 'ok');
    
    try {
      // Basic validation
      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (!toEmail) {
        throw new Error('Please enter recipient email');
      }
      
      // Check if demo mode is enabled
      const demoMode = isDemoMode();
      
      // Send request with demo mode flag
      let json;
      try {
        json = await apiFetch('/wallet/send', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ toEmail, amount, note, demoMode })
        });
      } catch (e1) {
        // 404 fallback -> try alternate route name
        if (/404/.test(String(e1 && e1.message))) {
          json = await apiFetch('/wallet/transfer', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ toEmail, amount, note, demoMode })
          });
        } else { throw e1; }
      }
      
      // Success
      const successMsg = demoMode ? 'Payment sent (demo mode)' : 'Payment sent successfully';
      msg.textContent = successMsg;
      msg.classList.remove('err'); msg.classList.add('ok');
      showStatusOverlay({ type: 'success', message: successMsg });
      
      // Update balance from response if provided
      if (json.balance !== undefined && store.user) {
        store.user.balance = json.balance;
        localStorage.setItem('ewallet_user', JSON.stringify(store.user));
        renderTopbar();
      }
      
      // Refresh profile/balance
      try { 
        const p = await apiFetch('/users/me'); 
        store.user = p.user; 
        localStorage.setItem('ewallet_user', JSON.stringify(store.user)); 
        renderTopbar(); 
      } catch(_){ }
      
      // Clear form
      e.target.reset();
    } catch (err) {
      console.error('Send money error:', err);
      const raw = (err && err.message) ? String(err.message).toLowerCase() : '';
      
      // In demo mode, show more lenient error messages
      if (isDemoMode()) {
        msg.textContent = err.message || 'Demo payment failed';
        msg.classList.remove('ok'); msg.classList.add('err');
        showStatusOverlay({ type: 'error', message: err.message || 'Demo payment failed' });
      } else {
        // Production mode - specific error handling
        const isInsufficient = /insufficient|not enough|negative|low balance|insuff/i.test(raw);
        const isNotFound = /not found|404|recipient/i.test(raw);
        let text = err.message || 'Payment failed';
        if (isInsufficient) {
          text = 'Insufficient balance';
        } else if (isNotFound) {
          text = 'Recipient not found. Please check the email address.';
        }
        msg.textContent = text;
        msg.classList.remove('ok'); msg.classList.add('err');
        showStatusOverlay({ type: 'error', message: text });
      }
    }
  });
}

/**
 * Try to parse QR payload (string) into an object { name, email, amount }
 * Supports JSON payloads, key=value pairs, comma/newline separated pairs, or plain email/amount patterns.
 */
function parseQrPayload(s) {
  if (!s) return null;
  const rawStr = String(s).trim();
  // handle UPI deep link format: upi://pay?pa=...&pn=...&am=...
  try {
    if (/^upi:\/\//i.test(rawStr)) {
      // use URL to parse query params
      try {
        const u = new URL(rawStr);
        const pa = u.searchParams.get('pa');
        const am = u.searchParams.get('am') || u.searchParams.get('amount');
        const pn = u.searchParams.get('pn');
        return { name: pn ? decodeURIComponent(pn) : undefined, email: pa ? decodeURIComponent(pa) : undefined, amount: am ? decodeURIComponent(am) : undefined };
      } catch (err) {
        // fallback simple parse
        const q = rawStr.split('?')[1] || '';
        const parts = q.split('&').map(p=>p.split('='));
        const obj = {};
        parts.forEach(p=>{ if (p[0]) obj[p[0]] = decodeURIComponent(p[1]||''); });
        return { name: obj.pn, email: obj.pa, amount: obj.am || obj.amount };
      }
    }
  } catch (err) {}
  // try JSON
  try {
    const j = JSON.parse(s);
    return { name: j.name || j.fullName || j.username, email: j.email, amount: j.amount || j.amt };
  } catch (err) {}

  // normalize whitespace
  const str = rawStr;

  // try key:value or key=value pairs
  const obj = {};
  // split by newline or comma
  const parts = str.split(/\r?\n|,/).map(p=>p.trim()).filter(Boolean);
  parts.forEach(p=>{
    const m = p.match(/^\s*([^:=]+)\s*[:=]\s*(.+)\s*$/);
    if (m) {
      const k = m[1].toLowerCase();
      const v = m[2].trim();
      obj[k] = v;
    }
  });
  if (obj.email || obj.amount || obj.name) {
    return { name: obj.name || obj.fullname || obj.full_name, email: obj.email, amount: obj.amount || obj.amt };
  }

  // fallback: try to extract email and amount with regex
  const emailMatch = str.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const amountMatch = str.match(/(?:amount|amt|rupees|rs)?\s*[:=]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const nameMatch = str.match(/name\s*[:=]\s*([^,\n]+)/i);
  return { name: nameMatch ? nameMatch[1].trim() : undefined, email: emailMatch ? emailMatch[0] : undefined, amount: amountMatch ? amountMatch[1] : undefined };
}

/**
 * Demo authentication animation used for Top Up to simulate bank auth/OTP flow.
 * Returns a Promise that resolves when the animation completes.
 */
function showAuthAnimation(amount) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'auth-box modal';
    box.innerHTML = `
      <div class="header"><h3>Bank Authorization</h3></div>
      <div style="text-align:center;padding:14px 8px">
        <div class="auth-fingerprint" id="auth-fp" aria-hidden="true">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v4" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 18v4" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 6.5C6 4 9 3 12 3s6 .95 7.5 3.5" stroke="rgba(255,255,255,0.9)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="auth-msg smallmuted" style="margin-top:12px">Authorizing transaction of ${formatCurrency(amount)}</div>
        <div class="auth-progress" style="margin-top:14px"><div class="auth-progress-bar" id="auth-bar"></div></div>
      </div>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const bar = box.querySelector('#auth-bar');
    const msg = box.querySelector('.auth-msg');
    let pct = 0;
    const steps = [
      { t: 'Contacting bank', dur: 700 },
      { t: 'Authenticating', dur: 900 },
      { t: 'Finalizing', dur: 700 }
    ];
    let idx = 0;
    function step() {
      if (idx >= steps.length) {
        msg.textContent = 'Authorized';
        const wrap = document.createElement('div'); wrap.className = 'checkmark-wrapper';
        wrap.innerHTML = `<div class="checkmark"><svg viewBox="0 0 52 52" aria-hidden="true"><circle class="circle" cx="26" cy="26" r="24"></circle><path class="tick" d="M14 27l7 7 17-17"/></svg></div>`;
        box.appendChild(wrap);
        setTimeout(() => { try { overlay.remove(); } catch (e) {} resolve(); }, 900);
        return;
      }
      msg.textContent = steps[idx].t;
      const dur = steps[idx].dur;
      const start = pct;
      const end = Math.min(100, start + Math.round(100 / steps.length));
      const startTime = Date.now();
      const iv = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / dur);
        const cur = start + Math.round((end - start) * progress);
        if (bar) bar.style.width = cur + '%';
        if (progress >= 1) {
          clearInterval(iv);
          pct = end;
          idx++;
          setTimeout(step, 180);
        }
      }, 16);
    }
    if (bar) bar.style.width = '0%';
    step();
  });
}

function showQrPreview(parsed, file, raw, dataUrl) {
  // build modal
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="header"><h3>QR Preview</h3><button class="close" id="qr-close">✕</button></div>
    <div style="display:block;gap:12px;align-items:center">
      <div>
        <div class="row"><div class="label">Name</div><div class="value">${escapeHtml(parsed.name||'—')}</div></div>
        <div class="row"><div class="label">Email / UPI</div><div class="value">${escapeHtml(parsed.email||'—')}</div></div>
        <div class="row"><div class="label">Amount</div><div class="value">${escapeHtml(parsed.amount||'—')}</div></div>
        <div class="row"><div class="label">Raw</div><div class="value smallmuted">${escapeHtml(String(raw||'—')).slice(0,200)}</div></div>
      </div>
    </div>
    <div class="actions">
      <button class="btn" id="qr-accept">Accept</button>
      <button class="btn ghost" id="qr-edit">Edit</button>
      <button class="btn ghost" id="qr-cancel">Cancel</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function cleanup() { try{ overlay.remove(); } catch(_){} }

  document.getElementById('qr-cancel').addEventListener('click', () => {
    cleanup();
    const msg = document.getElementById('qr-msg'); if (msg) { msg.textContent = 'QR preview canceled'; }
  });

  document.getElementById('qr-close').addEventListener('click', () => {
    cleanup();
  });

  document.getElementById('qr-accept').addEventListener('click', async () => {
  const btn = document.getElementById('qr-accept');
  const msgEl = document.createElement('div'); msgEl.style.marginTop='10px'; modal.appendChild(msgEl);
  btn.disabled = true;
    try {
      // if we have both email and amount, auto-send the payment
      if (parsed.email && parsed.amount) {
  msgEl.innerHTML = '<span class="spinner"></span>Sending payment...';
        const toEmail = parsed.email;
        const amount = Number(parsed.amount);
        const note = parsed.name ? `Payment for ${parsed.name}` : '';
        // Try send; on 404, retry transfer
        try {
          await apiFetch('/wallet/send', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ toEmail, amount, note })
          });
        } catch (e1) {
          if (/404/.test(String(e1 && e1.message))) {
            await apiFetch('/wallet/transfer', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ toEmail, amount, note })
            });
          } else { throw e1; }
        }
  // show animated checkmark and success message
  msgEl.innerHTML = '';
  const successWrap = document.createElement('div'); successWrap.className = 'checkmark-wrapper';
  successWrap.innerHTML = `<div class="checkmark"><svg viewBox="0 0 52 52" aria-hidden="true"><circle class="circle" cx="26" cy="26" r="24"></circle><path class="tick" d="M14 27l7 7 17-17"/></svg></div><div class="modal success-msg">Payment sent</div>`;
  modal.appendChild(successWrap);
  msgEl.textContent = 'Saving QR...';
        // upload the QR image to backend (store it)
        if (file) {
          const fd = new FormData(); fd.append('qr', file);
          try {
            await apiFetch('/users/upload-qr', { method: 'POST', body: fd });
            msgEl.textContent = 'Payment sent and QR saved';
          } catch (uerr) {
            console.warn('QR upload failed after send', uerr);
            msgEl.textContent = 'Payment sent (QR save failed)';
          }
        }
        // refresh profile/balance and navigate to dashboard
        try { const p = await apiFetch('/users/me'); store.user = p.user; localStorage.setItem('ewallet_user', JSON.stringify(store.user)); renderTopbar(); } catch(_){}
  setTimeout(()=> { cleanup(); goto('dashboard'); }, 1100);
        return;
      }

      // not enough info to auto-send — open send page with prefill
      store.qrPrefill = { toEmail: parsed.email, amount: parsed.amount, note: parsed.name ? `Payment for ${parsed.name}` : undefined };
      cleanup();
      goto('send');
    } catch (err) {
      console.error('Auto-send failed', err);
      const em = document.createElement('div'); em.className='err'; em.textContent = err.message || 'Payment failed'; modal.appendChild(em);
      btn.disabled = false;
    }
  });

  document.getElementById('qr-edit').addEventListener('click', () => {
    // prefill and open send for editing
    store.qrPrefill = {
      toEmail: parsed.email,
      amount: parsed.amount,
      note: parsed.name ? `Payment for ${parsed.name}` : undefined
    };
    cleanup();
    goto('send');
  });
}

function renderUpload() {
  main.innerHTML = `
    <div class="card upload fade-in" style="max-width:640px;margin:12px auto">
      <h2>Upload QR</h2>
      <p class="smallmuted">Upload a QR image from your device</p>
      <form id="form-qr" style="margin-top:12px">
        <input type="file" name="qr" accept="image/*" class="input" />
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" type="submit">Upload</button>
          <button type="button" class="btn ghost" id="qr-back">Back</button>
        </div>
        <div id="qr-msg" style="margin-top:8px"></div>
      </form>
    </div>
  `;
  document.getElementById('qr-back').addEventListener('click', () => goto('dashboard'));
  document.getElementById('form-qr').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const fileInput = e.target.qr;
    const msg = document.getElementById('qr-msg');
    if (!fileInput.files || fileInput.files.length === 0) {
      msg.textContent = 'Choose an image file';
      msg.classList.add('err'); return;
    }
    const file = fileInput.files[0];
  msg.innerHTML = '<span class="spinner"></span>Reading image...'; msg.classList.remove('err');
    try {
      // client-side decode with jsQR
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(file);
      });
      const img = await new Promise((resolve, reject) => {
        const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = dataUrl;
      });
      // draw to canvas (downscale if huge)
      const maxDim = 1600;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        const scale = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * scale); h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0,0,w,h);
      const qr = window.jsQR ? jsQR(imageData.data, w, h) : null;
      if (!qr || !qr.data) {
        msg.textContent = 'No QR code detected in image (client-side)'; msg.classList.add('err');
        return;
      }
  const raw = qr.data;
  msg.innerHTML = '<span class="spinner"></span>QR detected — previewing...'; msg.classList.remove('err'); msg.classList.add('ok');
      // parse payload and show preview; pass file so accept can upload after send
      const parsed = parseQrPayload(raw);
      // remove spinner before showing modal
      try { msg.innerHTML = ''; } catch(_){}
      if (parsed && (parsed.email || parsed.amount)) {
        showQrPreview(parsed, file, raw, dataUrl);
      } else {
        // still allow user to see raw payload and choose
        showQrPreview(parsed || {}, file, raw, dataUrl);
      }
    } catch (err) {
      console.error('QR client decode error', err);
      msg.textContent = 'Failed to read or decode image'; msg.classList.add('err');
    }
  });
}

function renderTopUp() {
  main.innerHTML = `
    <div class="card fade-in" style="max-width:640px;margin:12px auto">
      <h2>Top up wallet</h2>
      <p class="smallmuted">Add money to your wallet using card (Stripe test mode)</p>
      <form id="form-topup" style="margin-top:12px">
        <input name="amount" required placeholder="Amount (e.g., 500)" type="number" step="0.01" class="input" />
        <div id="card-element" style="margin-top:12px;padding:12px;border:1px solid #e6e6e6;border-radius:6px"></div>
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" type="submit">Pay</button>
          <button type="button" class="btn ghost" id="topup-back">Back</button>
        </div>
        <div id="topup-msg" style="margin-top:8px"></div>
      </form>
    </div>
  `;

  document.getElementById('topup-back').addEventListener('click', () => goto('dashboard'));

  const msg = document.getElementById('topup-msg');
  const publishable = window.__STRIPE_PUBLISHABLE_KEY__ || '';
  if (!publishable) {
    msg.innerHTML = '<div class="err">Missing Stripe publishable key. Set window.__STRIPE_PUBLISHABLE_KEY__ in your page (test key)</div>';
    return;
  }

  const stripe = Stripe(publishable);
  const elements = stripe.elements();
  const card = elements.create('card');
  card.mount('#card-element');

  document.getElementById('form-topup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(e.target.amount.value);
    if (!amount || amount <= 0) { msg.textContent = 'Enter a valid amount'; msg.classList.add('err'); return; }
    msg.textContent = 'Preparing payment...'; msg.classList.remove('err');
    try {
      // If demo mode is enabled, skip contacting the backend and simulate the payment flow locally.
      if (isDemoMode()) {
        msg.textContent = 'Demo mode: simulating payment...';
        try {
          // show demo auth animation
          await showAuthAnimation(amount);
        } catch (e) { console.warn('auth animation interrupted', e); }
        // persist demo deposit server-side and only update local balance on success
        msg.textContent = 'Persisting demo deposit...';
        try {
          const res = await attemptForceDeposit(amount, 'Demo topup (client)');
          // update local balance from server-provided balance (trusted)
          if (res && typeof res.balance !== 'undefined') {
            if (store.user) {
              store.user.balance = res.balance;
              localStorage.setItem('ewallet_user', JSON.stringify(store.user));
              renderTopbar();
            }
            showToast('Demo deposit persisted', 'ok');
            msg.textContent = 'Top up successful (demo)';
            msg.classList.remove('err'); msg.classList.add('ok');
            setTimeout(()=> goto('dashboard'), 1200);
            return;
          }
          throw new Error('Unexpected response');
        } catch (e) {
          console.warn('Force deposit persistence failed', e);
          showToast('Demo persistence failed (server)', 'err');
          msg.textContent = 'Demo persistence failed — try again';
          msg.classList.add('err');
          return;
        }
      }
      const json = await apiFetch('/wallet/deposit/create', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ amount })
      });
      const clientSecret = json.clientSecret;
      const paymentIntentId = json.paymentIntentId;

      msg.textContent = 'Collecting card details...';
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card }
      });
      if (result.error) {
        msg.textContent = result.error.message || 'Payment failed';
        msg.classList.add('err');
        return;
      }
      if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        // Run the demo 'authentication' animation (visual only)
        msg.textContent = 'Performing bank authorization...';
        try {
          await showAuthAnimation(amount);
        } catch (e) { console.warn('auth animation interrupted', e); }

        if (isDemoMode()) {
          // DEMO MODE: persist demo deposit server-side and update local balance only if it succeeds
          msg.textContent = 'Persisting demo deposit...';
          try {
            const res2 = await attemptForceDeposit(amount, 'Demo topup (post-payment)');
            if (res2 && typeof res2.balance !== 'undefined') {
              if (store.user) {
                store.user.balance = res2.balance;
                localStorage.setItem('ewallet_user', JSON.stringify(store.user));
                renderTopbar();
              }
              showToast('Demo deposit persisted', 'ok');
              msg.textContent = 'Top up successful (demo)';
              msg.classList.remove('err'); msg.classList.add('ok');
              setTimeout(()=> goto('dashboard'), 1200);
              return;
            }
            throw new Error('Unexpected response');
          } catch (e) {
            console.warn('Force deposit persistence failed', e);
            showToast('Demo persistence failed (server)', 'err');
            msg.textContent = 'Demo persistence failed — try again';
            msg.classList.add('err');
            return;
          }
        } else {
          // REAL MODE: call backend confirm to record deposit server-side
          msg.textContent = 'Finalizing top up...';
          try {
            await apiFetch('/wallet/deposit/confirm', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ paymentIntentId })
            });
            msg.textContent = 'Top up successful';
            msg.classList.remove('err'); msg.classList.add('ok');
            // refresh profile/balance
            try { const p = await apiFetch('/users/me'); store.user = p.user; localStorage.setItem('ewallet_user', JSON.stringify(store.user)); renderTopbar(); } catch(_){ }
            setTimeout(()=> goto('dashboard'), 1200);
          } catch (e) {
            msg.textContent = e.message || 'Finalize failed'; msg.classList.add('err');
          }
        }
      } else {
        msg.textContent = 'Payment not completed'; msg.classList.add('err');
      }
    } catch (err) {
      msg.textContent = err.message || 'Payment failed'; msg.classList.add('err');
    }
  });
}

function showStatusOverlay({ type = 'success', message = '' } = {}) {
  try {
    const overlay = document.getElementById('status-overlay');
    const icon = document.getElementById('status-icon');
    const msg = document.getElementById('status-message');
    if (!overlay || !icon || !msg) return;
    // reset
    icon.className = 'icon';
    // icon SVG
    if (type === 'success') {
      icon.classList.add('success');
      icon.innerHTML = `<svg viewBox="0 0 52 52" aria-hidden="true"><path class="tick" d="M14 27l7 7 17-17"/></svg>`;
    } else {
      icon.classList.add('error');
      icon.innerHTML = `<svg viewBox="0 0 52 52" aria-hidden="true"><path class="cross-line" d="M16 16 L36 36"/><path class="cross-line" d="M36 16 L16 36"/></svg>`;
    }
    msg.textContent = message || (type === 'success' ? 'Payment successful' : 'Payment failed');
    overlay.classList.remove('hidden');
    // auto hide
    clearTimeout(window.__statusTimer);
    window.__statusTimer = setTimeout(() => {
      try { overlay.classList.add('hidden'); } catch (_) {}
    }, type === 'success' ? 1600 : 2000);
  } catch (e) { console.warn('status overlay failed', e); }
}

async function renderBills() {
  main.innerHTML = `
    <div class="card fade-in" style="max-width:720px;margin:12px auto">
      <h2>Pay Utility Bill</h2>
      <p class="smallmuted">Choose provider and pay</p>
      <form id="form-bill" style="margin-top:12px">
        <select name="providerCode" class="input"><option value="">Loading providers...</option></select>
        <input name="consumerNumber" required placeholder="Consumer/account number" class="input" />
        <input name="amount" required placeholder="Amount" type="number" step="0.01" class="input" />
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" type="submit">Pay</button>
          <button type="button" class="btn ghost" id="bills-back">Back</button>
        </div>
        <div id="bill-msg" style="margin-top:8px"></div>
      </form>
    </div>
  `;

  document.getElementById('bills-back').addEventListener('click', ()=>goto('dashboard'));

  // populate providers
  const sel = document.querySelector('select[name="providerCode"]');
  sel.innerHTML = `<option value="">Loading...</option>`;
  try {
    const json = await apiFetch('/bills/providers');
    const providers = json.providers || [];
    sel.innerHTML = `<option value="">Select provider</option>` + providers.map(p=>`<option value="${escapeHtml(p.code)}">${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`).join('');
  } catch (err) {
    sel.innerHTML = `<option value="">Failed to load</option>`;
  }

  document.getElementById('form-bill').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const providerCode = e.target.providerCode.value;
    const consumerNumber = e.target.consumerNumber.value.trim();
    const amount = Number(e.target.amount.value);
    const msg = document.getElementById('bill-msg');

    // Client-side validation: amount must be positive
    if (!providerCode) {
      msg.textContent = 'Please select a provider';
      msg.classList.add('err');
      return;
    }
    if (!consumerNumber) {
      msg.textContent = 'Please enter consumer/account number';
      msg.classList.add('err');
      return;
    }
    if (amount <= 0 || isNaN(amount)) {
      msg.textContent = 'Amount must be a positive number';
      msg.classList.add('err');
      return;
    }

    msg.textContent = 'Processing...';
    msg.classList.remove('err');
    try {
      const json = await apiFetch('/bills/pay', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ providerCode, consumerNumber, amount })
      });
      msg.textContent = 'Bill paid';
      msg.classList.remove('err'); msg.classList.add('ok');
      // show success overlay
      showStatusOverlay({ type: 'success', message: 'Bill paid successfully' });
      // refresh balance silently
      try { const p = await apiFetch('/users/me'); store.user = p.user; localStorage.setItem('ewallet_user', JSON.stringify(store.user)); renderTopbar(); } catch(_){ }
    } catch (err) {
      const raw = (err && err.message) ? String(err.message).toLowerCase() : '';
      const isInsufficient = /insufficient|not enough|negative|low balance|insuff/i.test(raw);
      const text = isInsufficient ? 'Insufficient balance' : (err.message || 'Payment failed');
      msg.textContent = text;
      msg.classList.remove('ok'); msg.classList.add('err');
      // show error overlay with specific messaging
      showStatusOverlay({ type: 'error', message: text });
    }
  });
}

async function renderHistory() {
  main.innerHTML = `<div class="card fade-in" style="max-width:900px;margin:12px auto"><h2>Transactions</h2><p class="smallmuted">Recent activity</p><div id="tx-list" style="margin-top:12px">Loading...</div></div>`;
  try {
    const json = await apiFetch('/wallet/history');
    const data = json.data || [];
    const container = document.getElementById('tx-list');
    if (data.length === 0) {
      container.innerHTML = `<div class="smallmuted">No transactions yet</div>`;
      return;
    }
    const html = `<table class="table"><thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Amount</th></tr></thead><tbody>${
      data.map(tx => {
        const dt = new Date(tx.createdAt).toLocaleString();
        const type = escapeHtml(tx.type);
        const details = escapeHtml(tx.meta?.note || tx.meta?.provider || tx._id || '');
        const amt = (tx.type === 'send' ? '-' : '') + formatCurrency(tx.amount);
        return `<tr><td>${dt}</td><td>${type}</td><td>${details}</td><td><strong>${amt}</strong></td></tr>`;
      }).join('')
    }</tbody></table>`;
    container.innerHTML = html;
  } catch (err) {
    document.getElementById('tx-list').innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
  }
}

async function renderAdmin() {
  // Only allow admin role to access this view
  if (!store.user || store.user.role !== 'admin') {
    goto('dashboard');
    return;
  }
  // Render full admin panel: Users (left) + Transactions (right)
  main.innerHTML = `<div class="card fade-in" style="max-width:1100px;margin:12px auto"><h2>Admin Panel</h2><p class="smallmuted">Manage users and view transactions</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px"><div id="admin-users">Loading users...</div><div id="admin-tx">Loading transactions...</div></div></div>`;

  try {
    const [ujson, tjson] = await Promise.all([apiFetch('/admin/users'), apiFetch('/admin/transactions')]);
    const users = ujson.users || [];
    const tx = tjson.data || [];

    // Users list (left column)
    const usersEl = document.getElementById('admin-users');
    usersEl.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <h3 style="margin:0">Users</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <label class="smallmuted" style="font-size:13px">Show only active</label>
          <button id="user-filter-toggle" class="small ghost">OFF</button>
        </div>
      </div>
      <div id="user-list" style="margin-top:8px">Loading...</div>
    `;

    const isActive = (u) => {
      // define active as having a positive balance or recent update (90 days)
      try {
        const recently = new Date(u.updatedAt || u.createdAt);
        const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
        return (Number(u.balance || 0) > 0) || (recently.getTime() >= cutoff);
      } catch (e) { return Boolean(Number(u.balance || 0) > 0); }
    };

    const renderUserList = (onlyActive = false) => {
      const listEl = document.getElementById('user-list');
      const items = onlyActive ? users.filter(isActive) : users.slice(0, 200);
      if (!items || items.length === 0) return listEl.innerHTML = `<div class="smallmuted">No users</div>`;
      listEl.innerHTML = items.map(u => {
        const badge = isActive(u) ? '<span class="badge" style="background:linear-gradient(90deg,#b9f6ca,#7ef0a9);color:#053214;margin-left:8px">ACTIVE</span>' : '';
        return `<div style="padding:8px;border-bottom:1px solid rgba(0,0,0,0.04)"><strong>${escapeHtml(u.name || u.email)}</strong><div class="smallmuted">${escapeHtml(u.email)} • ${escapeHtml(u.role)}</div><div style="margin-top:6px"><strong>${formatCurrency(u.balance)}</strong> ${badge}</div></div>`;
      }).join('');
    };

    renderUserList(false);
    let onlyActive = false;
    const userToggle = document.getElementById('user-filter-toggle');
    userToggle.addEventListener('click', () => {
      onlyActive = !onlyActive;
      userToggle.textContent = onlyActive ? 'ON' : 'OFF';
      userToggle.classList.toggle('ghost', !onlyActive);
      renderUserList(onlyActive);
    });

    // Transactions (right column) with demo filter
    const txContainer = document.getElementById('admin-tx');
    txContainer.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <h3>Transactions</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <label class="smallmuted" style="font-size:13px">Show only demo deposits</label>
          <button id="tx-filter-toggle" class="small ghost">OFF</button>
        </div>
      </div>
      <div id="tx-list-admin" style="margin-top:8px">Loading...</div>
    `;

    const renderTxList = (onlyForce = false) => {
      const listEl = document.getElementById('tx-list-admin');
      const items = onlyForce ? tx.filter(t => t.meta && t.meta.force) : tx.slice(0,40);
      if (!items || items.length === 0) return listEl.innerHTML = `<div class="smallmuted">No transactions</div>`;
      listEl.innerHTML = items.map(t=>{
        const dt = new Date(t.createdAt).toLocaleString();
        const type = escapeHtml(t.type);
        const details = escapeHtml((t.meta && (t.meta.provider||t.meta.note))||'');
        const amt = (t.type === 'send' ? '-' : '') + formatCurrency(t.amount);
        const badge = (t.meta && t.meta.force) ? '<span class="badge" style="background:linear-gradient(90deg,#ffd2a8,#ffc07a);color:#06101a;margin-left:8px">DEMO</span>' : '';
        return `<div style="padding:8px;border-bottom:1px solid rgba(0,0,0,0.04)"><div style="font-size:13px">${type} • ${details} ${badge}</div><div class="smallmuted">${dt}</div><div style="margin-top:6px"><strong>${amt}</strong></div></div>`;
      }).join('');
    };

    renderTxList(false);
    const toggleBtn = document.getElementById('tx-filter-toggle');
    let onlyForce = false;
    toggleBtn.addEventListener('click', () => {
      onlyForce = !onlyForce;
      toggleBtn.textContent = onlyForce ? 'ON' : 'OFF';
      toggleBtn.classList.toggle('ghost', !onlyForce);
      renderTxList(onlyForce);
    });

  } catch (err) {
    console.warn(err);
    document.getElementById('admin-users').innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
    document.getElementById('admin-tx').innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
  }
}

///// Utilities
function formatCurrency(n) {
  // assume backend uses decimal amounts (like 250.00)
  const val = Number(n || 0);
  // using INR formatting
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Simple toast helper (auto-dismiss)
function showToast(text, type = 'ok', ms = 3800) {
  try {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container);
    }
    const t = document.createElement('div'); t.className = 'toast ' + (type === 'err' ? 'err' : 'ok'); t.textContent = text;
    container.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, ms - 400);
    setTimeout(() => { try { t.remove(); } catch(e){} }, ms);
  } catch (e) { console.warn('toast failed', e); }
}

/**
 * Attempt to persist a force deposit with retries and exponential backoff.
 * Returns the server response JSON or throws the last error.
 */
async function attemptForceDeposit(amount, note = '', retries = 3, initialDelay = 600) {
  let attempt = 0;
  let lastErr;
  while (attempt < retries) {
    try {
      if (attempt > 0) showToast(`Retrying demo persistence (attempt ${attempt+1}/${retries})`, 'err', 1400);
      const res = await apiFetch('/wallet/deposit/force', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ amount, note })
      });
      return res;
    } catch (e) {
      lastErr = e;
      attempt++;
      if (attempt >= retries) break;
      const delay = initialDelay * Math.pow(2, attempt - 1);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr || new Error('Force deposit failed');
}

///// startup
// try to fetch profile when app loads
if (store.token) {
  apiFetch('/users/me').then(json=>{
    store.user = json.user;
    localStorage.setItem('ewallet_user', JSON.stringify(store.user));
    renderTopbar();
    goto('dashboard');
  }).catch(err=>{
    console.warn('autologin failed', err);
    setAuth(null, null);
    goto('login');
  });
} else {
  goto('login');
}
