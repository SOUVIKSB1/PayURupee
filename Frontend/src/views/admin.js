import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, formatCurrency } from '../utils.js';

export async function renderAdmin() {
  if (!store.user || store.user.role !== 'admin') {
    goto('dashboard');
    return;
  }
  
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card fade-in" style="max-width:1100px;margin:12px auto">
      <h2>Admin Panel</h2>
      <p class="smallmuted">Manage users and view transactions</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
        <div id="admin-users">Loading users...</div>
        <div id="admin-tx">Loading transactions...</div>
      </div>
    </div>
  `;

  try {
    const [ujson, tjson] = await Promise.all([apiFetch('/admin/users'), apiFetch('/admin/transactions')]);
    const users = ujson.users || [];
    const tx = tjson.data || [];

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
      try {
        const recently = new Date(u.updatedAt || u.createdAt);
        const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
        return (Number(u.balance || 0) > 0) || (recently.getTime() >= cutoff);
      } catch (e) {
        return Boolean(Number(u.balance || 0) > 0);
      }
    };

    const renderUserList = (onlyActive = false) => {
      const listEl = document.getElementById('user-list');
      const items = onlyActive ? users.filter(isActive) : users.slice(0, 200);
      if (!items || items.length === 0) {
        listEl.innerHTML = `<div class="smallmuted">No users</div>`;
        return;
      }
      listEl.innerHTML = items.map(u => {
        const badge = isActive(u) ? '<span class="badge" style="background:linear-gradient(90deg,#b9f6ca,#7ef0a9);color:#053214;margin-left:8px">ACTIVE</span>' : '';
        return `<div style="padding:8px;border-bottom:1px solid rgba(0,0,0,0.04)">
                  <strong>${escapeHtml(u.name || u.email)}</strong>
                  <div class="smallmuted">${escapeHtml(u.email)} • ${escapeHtml(u.role)}</div>
                  <div style="margin-top:6px"><strong>${formatCurrency(u.balance)}</strong> ${badge}</div>
                </div>`;
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
      const items = onlyForce ? tx.filter(t => t.meta && t.meta.force) : tx.slice(0, 40);
      if (!items || items.length === 0) {
        listEl.innerHTML = `<div class="smallmuted">No transactions</div>`;
        return;
      }
      listEl.innerHTML = items.map(t => {
        const dt = new Date(t.createdAt).toLocaleString();
        const type = escapeHtml(t.type);
        const details = escapeHtml((t.meta && (t.meta.provider || t.meta.note)) || '');
        const amt = (t.type === 'send' ? '-' : '') + formatCurrency(t.amount);
        const badge = (t.meta && t.meta.force) ? '<span class="badge" style="background:linear-gradient(90deg,#ffd2a8,#ffc07a);color:#06101a;margin-left:8px">DEMO</span>' : '';
        return `<div style="padding:8px;border-bottom:1px solid rgba(0,0,0,0.04)">
                  <div style="font-size:13px">${type} • ${details} ${badge}</div>
                  <div class="smallmuted">${dt}</div>
                  <div style="margin-top:6px"><strong>${amt}</strong></div>
                </div>`;
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
