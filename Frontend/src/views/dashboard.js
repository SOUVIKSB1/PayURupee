import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, formatCurrency } from '../utils.js';

export async function renderDashboard() {
  const main = document.getElementById('main');
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
        if (uq) {
          uq.innerHTML = `<div><strong>${users.length}</strong> users</div><div style="margin-top:6px"><strong>${demoCount}</strong> demo deposits</div>`;
        }
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
  const qTopup = document.getElementById('q-topup');
  if (qTopup) qTopup.addEventListener('click', () => goto('topup'));
  const qUpload = document.getElementById('q-upload');
  if (qUpload) qUpload.addEventListener('click', () => goto('upload'));
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
    const b = profile.user.balance ?? 0;
    balEl.textContent = formatCurrency(b);
    
    const pl = document.getElementById('providers-list');
    pl.innerHTML = '';
    (providers.providers || []).slice(0, 5).forEach(p => {
      const d = document.createElement('div');
      d.style.display = 'flex';
      d.style.justifyContent = 'space-between';
      d.style.padding = '8px 0';
      d.innerHTML = `<div><strong>${escapeHtml(p.name)}</strong><div class="smallmuted">${escapeHtml(p.code)}</div></div>
                     <button class="btn ghost small" data-code="${escapeHtml(p.code)}">Pay</button>`;
      pl.appendChild(d);
    });
    
    pl.querySelectorAll('button[data-code]').forEach(btn => {
      btn.addEventListener('click', () => {
        goto('bills');
        setTimeout(() => {
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
