import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, formatCurrency, showToast } from '../utils.js';

export async function renderAdmin(tab = 'users') {
  if (!store.user || store.user.role !== 'admin') {
    goto('dashboard');
    return;
  }

  // Set current active admin tab tracking
  window.__currentAdminTab = tab;
  if (window.__onAuthChange) window.__onAuthChange();

  const styleId = 'admin-custom-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      .user-row-card:hover {
        background: rgba(255, 255, 255, 0.045) !important;
        border-color: rgba(255, 255, 255, 0.1) !important;
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.3);
      }
      @media (max-width: 600px) {
        .user-row-card {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 16px !important;
        }
        .user-row-card > div:last-child {
          width: 100% !important;
          grid-template-columns: 1fr 1fr 1fr 1fr !important;
        }
        .user-row-card > div:last-child > div {
          display: none !important;
        }
        .user-row-card > div:last-child button {
          width: 100% !important;
          font-size: 10px !important;
          padding: 6px 4px !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="fade-in" style="max-width: 1200px; margin: 24px auto; padding: 0 16px;">
      <!-- Title Header Section -->
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 26px; font-weight: 800; color: #fff; margin: 0; background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Admin Console</h2>
        <p class="smallmuted" style="margin-top: 4px; font-size: 13px;" id="admin-subtitle">Manage system accounts, create utility providers, and view transaction history</p>
      </div>

      <!-- Sub-view Content Wrapper -->
      <div id="admin-tab-content"></div>
    </div>
  `;

  // Switch sub-view dynamically
  if (tab === 'users') {
    await renderUsersTab();
  } else if (tab === 'providers') {
    await renderProvidersTab();
  } else if (tab === 'transactions') {
    await renderTransactionsTab();
  } else if (tab === 'settings') {
    await renderSettingsTab();
  }
}

// Sub-renderers
async function renderUsersTab() {
  const content = document.getElementById('admin-tab-content');
  document.getElementById('admin-subtitle').textContent = "Manage system accounts, block/unblock, adjust balances, and send scratch cards";

  content.innerHTML = `
    <!-- Quick Metrics Row -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px;">
      <div class="card" style="padding: 16px; background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; gap: 16px;">
        <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(0, 162, 255, 0.1); border: 1.5px dashed rgba(0, 162, 255, 0.25); display: flex; align-items: center; justify-content: center; font-size: 20px;">👥</div>
        <div>
          <div class="smallmuted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Total Users</div>
          <strong id="metric-users" style="font-size: 20px; color: #fff; font-weight: 800;">-</strong>
        </div>
      </div>
      <div class="card" style="padding: 16px; background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; gap: 16px;">
        <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(0, 210, 106, 0.1); border: 1.5px dashed rgba(0, 210, 106, 0.25); display: flex; align-items: center; justify-content: center; font-size: 20px;">⚡</div>
        <div>
          <div class="smallmuted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Active Accounts</div>
          <strong id="metric-active" style="font-size: 20px; color: #00d26a; font-weight: 800;">-</strong>
        </div>
      </div>
      <div class="card" style="padding: 16px; background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; gap: 16px;">
        <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(255, 122, 0, 0.1); border: 1.5px dashed rgba(255, 122, 0, 0.25); display: flex; align-items: center; justify-content: center; font-size: 20px;">💸</div>
        <div>
          <div class="smallmuted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">System Volume</div>
          <strong id="metric-volume" style="font-size: 20px; color: var(--accent1); font-weight: 800;">-</strong>
        </div>
      </div>
      <div class="card" style="padding: 16px; background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.04); display: flex; align-items: center; gap: 16px;">
        <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(162, 0, 255, 0.1); border: 1.5px dashed rgba(162, 0, 255, 0.25); display: flex; align-items: center; justify-content: center; font-size: 20px;">🎁</div>
        <div>
          <div class="smallmuted" style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Total Rewards</div>
          <strong id="metric-rewards" style="font-size: 20px; color: #a200ff; font-weight: 800;">-</strong>
        </div>
      </div>
    </div>

    <!-- User Accounts List Card -->
    <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
        <h3 style="margin: 0; font-size: 16px; color: #fff;">User Accounts</h3>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <input type="text" id="user-search-input" class="input" placeholder="Search accounts..." style="padding: 6px 12px; font-size: 12px; width: 180px;" />
          <button id="user-filter-toggle" class="small ghost small-btn" style="padding: 6px 10px; font-size: 11px;">Active Only: OFF</button>
        </div>
      </div>
      <div id="user-list" style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto; padding-right: 4px;">
        <div class="smallmuted" style="text-align: center; padding: 24px 0;">Loading accounts list...</div>
      </div>
    </div>
  `;

  try {
    const [ujson, tjson] = await Promise.all([
      apiFetch('/admin/users'),
      apiFetch('/admin/transactions')
    ]);
    const users = ujson.users || [];
    const tx = tjson.data || [];

    const isActive = (u) => {
      try {
        const recently = new Date(u.updatedAt || u.createdAt);
        const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);
        return (Number(u.balance || 0) > 0) || (recently.getTime() >= cutoff);
      } catch (e) {
        return Boolean(Number(u.balance || 0) > 0);
      }
    };

    // Calculate metrics
    const totalVolume = users.reduce((acc, u) => acc + (u.balance || 0), 0);
    const totalRewards = users.reduce((acc, u) => {
      return acc + (u.rewards || []).reduce((sum, r) => sum + (r.amount || 0), 0);
    }, 0);

    // Update Metrics
    document.getElementById('metric-users').textContent = users.length;
    document.getElementById('metric-active').textContent = users.filter(isActive).length;
    document.getElementById('metric-volume').textContent = formatCurrency(totalVolume);
    document.getElementById('metric-rewards').textContent = formatCurrency(totalRewards);

    let onlyActive = false;
    let searchQuery = '';

    const renderUserList = () => {
      const listEl = document.getElementById('user-list');
      let filtered = users;
      
      if (onlyActive) {
        filtered = filtered.filter(isActive);
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(u => 
          (u.name && u.name.toLowerCase().includes(query)) || 
          (u.email && u.email.toLowerCase().includes(query))
        );
      }

      if (filtered.length === 0) {
        listEl.innerHTML = `<div class="smallmuted" style="text-align:center;padding:24px 0">No matching users</div>`;
        return;
      }

      listEl.innerHTML = filtered.map(u => {
        const badge = isActive(u) ? '<span class="badge" style="background:rgba(0, 210, 106, 0.15);color:#00d26a;margin-left:8px;font-size:10px">ACTIVE</span>' : '';
        const blockBadge = u.isBlocked ? '<span class="badge" style="background:rgba(255, 92, 108, 0.15);color:var(--danger);margin-left:8px;font-size:10px">BLOCKED</span>' : '';
        const roleColor = u.role === 'admin' ? 'var(--accent1)' : 'var(--accent2)';
        
        return `
          <div class="user-row-card" style="padding: 16px 20px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; transition: all 0.2s ease;">
            <div style="flex: 1; min-width: 200px;">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <strong style="color: #fff; font-size: 14.5px; letter-spacing: -0.2px;">${escapeHtml(u.name || u.email)}</strong>
                ${badge}
                ${blockBadge}
              </div>
              <div class="smallmuted" style="font-size: 11.5px; margin-top: 4px; opacity: 0.7;">
                ${escapeHtml(u.email)} • <span style="color: ${roleColor}; font-weight: 600;">${u.role.toUpperCase()}</span>
              </div>
              <div style="margin-top: 8px; font-weight: 800; font-size: 15px; color: #fff; background: linear-gradient(135deg, #fff, #e2e8f0); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${formatCurrency(u.balance)}</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(4, 110px); gap: 8px; align-items: center; flex-shrink: 0;">
              <button class="small-btn solid btn-award-reward" data-user-id="${u._id}" data-user-name="${escapeHtml(u.name || u.email)}" style="padding: 6px 12px; font-size: 11.5px; font-weight: 600; width: 110px; border-radius: 8px;">Award Reward</button>
              <button class="small-btn ghost btn-adjust-balance" data-user-id="${u._id}" data-user-name="${escapeHtml(u.name || u.email)}" style="padding: 6px 12px; font-size: 11.5px; font-weight: 600; border-color: rgba(255,255,255,0.08); color: var(--accent2); width: 110px; border-radius: 8px;">Adjust Bal</button>
              ${u.role !== 'admin' ? `
                <button class="small-btn ghost btn-toggle-block" data-user-id="${u._id}" data-blocked="${u.isBlocked || false}" style="padding: 6px 12px; font-size: 11.5px; width: 110px; border-radius: 8px; border-color: rgba(255,255,255,0.08); color: ${u.isBlocked ? '#00d26a' : 'var(--danger)'}; font-weight: 600;">
                  ${u.isBlocked ? 'Unblock' : 'Block'}
                </button>
                <button class="small-btn solid btn-delete-user" data-user-id="${u._id}" data-user-email="${escapeHtml(u.email)}" style="padding: 6px 12px; font-size: 11.5px; width: 110px; border-radius: 8px; background: var(--danger); border: none; color: #fff; font-weight: 600;">
                  Delete
                </button>
              ` : `<div style="grid-column: span 2;"></div>`}
            </div>
          </div>
        `;
      }).join('');
      
      // Bind toggle block actions
      listEl.querySelectorAll('.btn-toggle-block').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const userId = e.target.getAttribute('data-user-id');
          const isBlockedStr = e.target.getAttribute('data-blocked');
          const actionWord = isBlockedStr === 'true' ? 'unblock' : 'block';
          if (confirm(`Are you sure you want to ${actionWord} this user account?`)) {
            try {
              await apiFetch(`/admin/users/${userId}/block`, { method: 'POST' });
              showToast(`User ${actionWord}ed successfully`, 'ok');
              renderUsersTab();
            } catch (err) {
              showToast(err.message || 'Action failed', 'err');
            }
          }
        });
      });

      // Bind delete actions
      listEl.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const userId = e.target.getAttribute('data-user-id');
          const email = e.target.getAttribute('data-user-email');
          if (confirm(`CRITICAL WARNING:\nAre you sure you want to permanently DELETE the user account '${email}'?\nThis action cannot be undone.`)) {
            try {
              await apiFetch(`/admin/users/${userId}`, { method: 'DELETE' });
              showToast('User deleted successfully', 'ok');
              renderUsersTab();
            } catch (err) {
              showToast(err.message || 'Deletion failed', 'err');
            }
          }
        });
      });
    };

    renderUserList();

    const searchInput = document.getElementById('user-search-input');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderUserList();
    });

    const userToggle = document.getElementById('user-filter-toggle');
    userToggle.addEventListener('click', () => {
      onlyActive = !onlyActive;
      userToggle.textContent = onlyActive ? 'Active Only: ON' : 'Active Only: OFF';
      userToggle.classList.toggle('ghost', !onlyActive);
      renderUserList();
    });

    bindModalEvents();
  } catch (err) {
    document.getElementById('user-list').innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
  }
}

async function renderProvidersTab() {
  const content = document.getElementById('admin-tab-content');
  document.getElementById('admin-subtitle').textContent = "Register and manage system utility billing providers";

  content.innerHTML = `
    <div class="admin-layout-grid">
      <!-- Register Form -->
      <div class="card" style="padding: 20px; align-self: start;">
        <h3 style="margin-top: 0; margin-bottom: 12px; font-size: 16px; color: #fff;">Register Utility Provider</h3>
        <form id="provider-creation-form" style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label class="smallmuted" style="display: block; font-size: 11px; margin-bottom: 4px;">Provider Name</label>
            <input type="text" id="prov-name" class="input" placeholder="e.g. Apex Power" style="width: 100%;" required />
          </div>
          <div>
            <label class="smallmuted" style="display: block; font-size: 11px; margin-bottom: 4px;">Provider Code</label>
            <input type="text" id="prov-code" class="input" placeholder="e.g. APEX_POW" style="width: 100%;" required />
          </div>
          <div>
            <label class="smallmuted" style="display: block; font-size: 11px; margin-bottom: 4px;">Description / Details</label>
            <input type="text" id="prov-desc" class="input" placeholder="Electricity/Water/Gas services" style="width: 100%;" required />
          </div>
          <button type="submit" class="btn primary" style="width: 100%; margin-top: 6px; padding: 10px;">Create Provider</button>
        </form>
      </div>

      <!-- Active Providers List -->
      <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 12px;">
        <h3 style="margin-top: 0; margin-bottom: 4px; font-size: 16px; color: #fff;">Registered Providers</h3>
        <p class="smallmuted" style="font-size: 12px; margin-bottom: 12px;">List of utility providers available for billing</p>
        <div id="providers-list-container" style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto; padding-right: 4px;">
          <div class="smallmuted" style="text-align: center; padding: 24px 0;">Loading providers...</div>
        </div>
      </div>
    </div>
  `;

  const loadProviders = async () => {
    const listEl = document.getElementById('providers-list-container');
    try {
      const res = await apiFetch('/bills/providers');
      const providers = res.providers || [];
      if (providers.length === 0) {
        listEl.innerHTML = `<div class="smallmuted" style="text-align:center;padding:24px 0">No providers registered yet</div>`;
        return;
      }

      listEl.innerHTML = providers.map(p => `
        <div style="padding: 12px; background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.03); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 140px;">
            <strong style="color: #fff; font-size: 13.5px;">${escapeHtml(p.name)}</strong>
            <span style="background: rgba(255, 122, 0, 0.15); color: var(--accent1); font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">${escapeHtml(p.code)}</span>
            <div class="smallmuted" style="font-size: 11.5px; margin-top: 4px;">${escapeHtml(p.description || '')}</div>
          </div>
          <button class="small-btn ghost btn-delete-provider" data-id="${p._id}" style="padding: 5px 10px; border-color: rgba(255, 92, 108, 0.2); color: var(--danger); font-size: 11px; flex-shrink: 0; width: 90px;">Deregister</button>
        </div>
      `).join('');

      listEl.querySelectorAll('.btn-delete-provider').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.getAttribute('data-id');
          if (confirm('Are you sure you want to deregister this utility provider?')) {
            try {
              await apiFetch(`/admin/provider/${id}`, { method: 'DELETE' });
              showToast('Provider removed successfully', 'ok');
              loadProviders();
            } catch (err) {
              showToast(err.message || 'Failed to remove provider', 'err');
            }
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
    }
  };

  loadProviders();

  const form = document.getElementById('provider-creation-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.target.style.pointerEvents = 'none';
    const name = document.getElementById('prov-name').value.trim();
    const code = document.getElementById('prov-code').value.trim().toUpperCase();
    const description = document.getElementById('prov-desc').value.trim();

    try {
      await apiFetch('/admin/provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, description })
      });
      showToast(`Utility provider ${code} registered successfully!`, 'ok');
      form.reset();
      loadProviders();
    } catch (err) {
      showToast(err.message || 'Failed to register provider', 'err');
    } finally {
      e.target.style.pointerEvents = 'auto';
    }
  });
}

async function renderTransactionsTab() {
  const content = document.getElementById('admin-tab-content');
  document.getElementById('admin-subtitle').textContent = "Full ledger and audit trail of transactions";

  content.innerHTML = `
    <!-- Inner sub-navigation buttons -->
    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      <button id="btn-toggle-view-tx" class="btn primary small-btn" style="padding: 8px 16px; font-size: 12.5px;">Transaction Ledger</button>
      <button id="btn-toggle-view-audit" class="btn ghost small-btn" style="padding: 8px 16px; font-size: 12.5px; border-color: rgba(255,255,255,0.08); color: #fff;">Admin Audit Trail</button>
    </div>

    <!-- Dynamic Log Content -->
    <div id="logs-view-panel"></div>
  `;

  const logsPanel = document.getElementById('logs-view-panel');

  const showTransactionsSubView = async () => {
    logsPanel.innerHTML = `
      <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
          <h3 style="margin: 0; font-size: 16px; color: #fff;">Transaction Ledger</h3>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <select id="tx-type-filter" class="input" style="padding: 6px 12px; font-size: 12px; width: 140px; background: #1a1b23; border: 1px solid rgba(255,255,255,0.08); color: #fff; border-radius: 8px;">
              <option value="all">All Types</option>
              <option value="send">Transfer</option>
              <option value="topup">Top-up</option>
              <option value="bill">Bill Pay</option>
              <option value="admin_adjust">Admin Adjust</option>
              <option value="deposit">Deposit/Claim</option>
            </select>
            <button id="tx-demo-toggle" class="small ghost small-btn" style="padding: 6px 10px; font-size: 11px;">Demo Only: OFF</button>
          </div>
        </div>
        <div id="transactions-list-container" style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto; padding-right: 4px;">
          <div class="smallmuted" style="text-align: center; padding: 24px 0;">Loading ledger...</div>
        </div>
      </div>
    `;

    try {
      const res = await apiFetch('/admin/transactions');
      const tx = res.data || [];
      let onlyForce = false;
      let typeFilter = 'all';

      const renderList = () => {
        const listEl = document.getElementById('transactions-list-container');
        let filtered = tx;
        if (onlyForce) filtered = filtered.filter(t => t.meta && t.meta.force);
        if (typeFilter !== 'all') filtered = filtered.filter(t => t.type === typeFilter);

        if (filtered.length === 0) {
          listEl.innerHTML = `<div class="smallmuted" style="text-align:center;padding:24px 0">No transactions match filters</div>`;
          return;
        }

        listEl.innerHTML = filtered.map(t => {
          const dt = new Date(t.createdAt).toLocaleString();
          const type = escapeHtml(t.type.toUpperCase());
          const details = escapeHtml((t.meta && (t.meta.provider || t.meta.note)) || 'Direct Wallet Action');
          const amt = (t.type === 'send' || t.type === 'bill' ? '-' : '+') + formatCurrency(t.amount);
          const isDebit = t.type === 'send' || t.type === 'bill';
          const color = isDebit ? '#ff5c6c' : '#00d26a';
          const badge = (t.meta && t.meta.force) ? '<span class="badge" style="background:rgba(255, 122, 0, 0.15);color:var(--accent1);margin-left:8px;font-size:9px">DEMO</span>' : '';
          
          return `
            <div style="padding: 12px; background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.03); border-radius: 10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <span style="font-size:13px; font-weight:700; color:#fff;">${type} ${badge}</span>
                <strong style="color: ${color}; font-size:13.5px;">${amt}</strong>
              </div>
              <div class="smallmuted" style="font-size:11.5px; margin-top:4px;">${details}</div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px; font-size:10px;" class="smallmuted">
                <span>Tx ID: ${t._id}</span>
                <span>${dt}</span>
              </div>
            </div>
          `;
        }).join('');
      };

      renderList();

      document.getElementById('tx-type-filter').addEventListener('change', (e) => {
        typeFilter = e.target.value;
        renderList();
      });

      const demoToggle = document.getElementById('tx-demo-toggle');
      demoToggle.addEventListener('click', () => {
        onlyForce = !onlyForce;
        demoToggle.textContent = onlyForce ? 'Demo Only: ON' : 'Demo Only: OFF';
        demoToggle.classList.toggle('ghost', !onlyForce);
        renderList();
      });

    } catch (err) {
      document.getElementById('transactions-list-container').innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
    }
  };

  const showAuditSubView = async () => {
    logsPanel.innerHTML = `
      <div class="card" style="padding: 20px; display: flex; flex-direction: column; gap: 16px;">
        <h3 style="margin: 0; font-size: 16px; color: #fff;">Administrative Audit Logs</h3>
        <div id="audit-list-container" style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto; padding-right: 4px;">
          <div class="smallmuted" style="text-align: center; padding: 24px 0;">Loading audit history...</div>
        </div>
      </div>
    `;

    try {
      const res = await apiFetch('/admin/audit-logs');
      const logs = res.logs || [];

      const listEl = document.getElementById('audit-list-container');
      if (logs.length === 0) {
        listEl.innerHTML = `<div class="smallmuted" style="text-align:center;padding:24px 0">No administrative logs recorded</div>`;
        return;
      }

      listEl.innerHTML = logs.map(l => {
        const dt = new Date(l.createdAt).toLocaleString();
        return `
          <div style="padding: 12px; background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.03); border-radius: 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom: 4px;">
              <span style="font-size:12px; font-weight:700; color:var(--accent1);">${escapeHtml(l.action)}</span>
              <span class="smallmuted" style="font-size:11px;">By: ${escapeHtml(l.adminEmail)}</span>
            </div>
            <p style="margin: 4px 0 6px; font-size: 12px; color: #fff; line-height: 1.4;">${escapeHtml(l.details)}</p>
            <div class="smallmuted" style="font-size: 9.5px; text-align: right;">${dt}</div>
          </div>
        `;
      }).join('');

    } catch (err) {
      document.getElementById('audit-list-container').innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
    }
  };

  // Initial render
  await showTransactionsSubView();

  // Navigation handlers
  const btnTx = document.getElementById('btn-toggle-view-tx');
  const btnAudit = document.getElementById('btn-toggle-view-audit');

  btnTx.addEventListener('click', async () => {
    btnTx.className = 'btn primary small-btn';
    btnAudit.className = 'btn ghost small-btn';
    btnAudit.style.borderColor = 'rgba(255,255,255,0.08)';
    await showTransactionsSubView();
  });

  btnAudit.addEventListener('click', async () => {
    btnTx.className = 'btn ghost small-btn';
    btnTx.style.borderColor = 'rgba(255,255,255,0.08)';
    btnAudit.className = 'btn primary small-btn';
    btnAudit.style.borderColor = '';
    await showAuditSubView();
  });
}

async function renderSettingsTab() {
  const content = document.getElementById('admin-tab-content');
  document.getElementById('admin-subtitle').textContent = "Configure global reward rates and e-wallet system parameters";

  content.innerHTML = `
    <div style="max-width: 540px; margin: 0 auto;">
      <div class="card" style="padding: 24px;">
        <h3 style="margin-top: 0; margin-bottom: 8px; font-size: 16px; color: #fff;">System Control & Range</h3>
        <p class="smallmuted" style="font-size: 12px; margin-bottom: 20px;">Configure the minimum/maximum possible cashback rewards and toggle system maintenance status.</p>
        
        <form id="settings-config-form" style="display: flex; flex-direction: column; gap: 16px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label class="smallmuted" style="display: block; font-size: 11px; margin-bottom: 6px;">Min Reward (₹)</label>
              <input type="number" id="setting-min-reward" class="input" style="width: 100%; font-size: 13px;" min="1" required />
            </div>
            <div>
              <label class="smallmuted" style="display: block; font-size: 11px; margin-bottom: 6px;">Max Reward (₹)</label>
              <input type="number" id="setting-max-reward" class="input" style="width: 100%; font-size: 13px;" min="1" required />
            </div>
          </div>
          
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: rgba(255, 92, 108, 0.05); border: 1px dashed rgba(255, 92, 108, 0.25); border-radius: 12px; margin-top: 8px;">
            <div>
              <strong style="color: #fff; font-size: 13px; display: block;">Enable Maintenance Mode</strong>
              <span class="smallmuted" style="font-size: 11px;">Blocks standard users from performing transactions</span>
            </div>
            <input type="checkbox" id="setting-maintenance" style="width: 20px; height: 20px; cursor: pointer;" />
          </div>

          <button type="submit" class="btn primary" style="width: 100%; padding: 12px; margin-top: 8px;">Save Settings</button>
        </form>
      </div>
    </div>
  `;

  // Fetch current settings
  try {
    const res = await apiFetch('/admin/settings');
    const config = res.settings || { minReward: 5, maxReward: 25, maintenanceMode: false };
    document.getElementById('setting-min-reward').value = config.minReward;
    document.getElementById('setting-max-reward').value = config.maxReward;
    document.getElementById('setting-maintenance').checked = config.maintenanceMode || false;
  } catch (err) {
    showToast('Failed to load system settings', 'err');
  }

  const form = document.getElementById('settings-config-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const minReward = parseFloat(document.getElementById('setting-min-reward').value);
    const maxReward = parseFloat(document.getElementById('setting-max-reward').value);
    const maintenanceMode = document.getElementById('setting-maintenance').checked;

    if (minReward <= 0 || maxReward <= 0) {
      showToast('Amounts must be positive', 'err');
      return;
    }

    try {
      e.target.style.pointerEvents = 'none';
      await apiFetch('/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minReward, maxReward, maintenanceMode })
      });
      showToast('Settings saved successfully', 'ok');
    } catch (err) {
      showToast(err.message || 'Failed to save settings', 'err');
    } finally {
      e.target.style.pointerEvents = 'auto';
    }
  });
}

function bindModalEvents() {
  const userList = document.getElementById('user-list');
  if (!userList) return;

  // Handle Award Reward button clicks
  userList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-award-reward');
    if (!btn) return;
    const userId = btn.getAttribute('data-user-id');
    const userName = btn.getAttribute('data-user-name');
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'award-reward-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '360px';
    modal.style.padding = '20px';
    
    modal.innerHTML = `
      <div class="header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
        <h3 style="margin:0;color:#fff">Award Reward</h3>
        <button class="close" id="award-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer">✕</button>
      </div>
      <p class="smallmuted" style="margin-bottom:15px;font-size:13px">Send a scratch card reward to <strong>${userName}</strong>.</p>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="smallmuted" style="display:block;margin-bottom:4px;font-size:12px">Amount (₹)</label>
          <input type="number" id="award-amount" class="input" style="width:100%" placeholder="e.g. 50" min="1" step="any" required />
        </div>
        <div>
          <label class="smallmuted" style="display:block;margin-bottom:4px;font-size:12px">Message / Note</label>
          <input type="text" id="award-message" class="input" style="width:100%" placeholder="e.g. Cashback for active use" required />
        </div>
        <button id="award-submit-btn" class="btn primary" style="width:100%;margin-top:8px">Send Reward</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const closeBtn = modal.querySelector('#award-close');
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) overlay.remove();
    });
    
    const submitBtn = modal.querySelector('#award-submit-btn');
    submitBtn.addEventListener('click', async () => {
      const amountInput = modal.querySelector('#award-amount');
      const messageInput = modal.querySelector('#award-message');
      const amount = parseFloat(amountInput.value);
      const message = messageInput.value.trim();
      
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid positive amount.');
        return;
      }
      if (!message) {
        alert('Please enter a custom message.');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      
      try {
        await apiFetch('/admin/award-reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount, message })
        });
        overlay.remove();
        showToast('Reward scratch card sent successfully!', 'ok');
        renderUsersTab();
      } catch (err) {
        alert(err.message || 'Failed to send reward');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reward';
      }
    });
  });

  // Handle Adjust Balance button clicks
  userList.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-adjust-balance');
    if (!btn) return;
    const userId = btn.getAttribute('data-user-id');
    const userName = btn.getAttribute('data-user-name');
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'adjust-balance-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '360px';
    modal.style.padding = '20px';
    
    modal.innerHTML = `
      <div class="header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
        <h3 style="margin:0;color:#fff">Adjust Balance</h3>
        <button class="close" id="adjust-close" style="background:none;border:none;color:#fff;font-size:16px;cursor:pointer">✕</button>
      </div>
      <p class="smallmuted" style="margin-bottom:15px;font-size:13px">Adjust the wallet balance for <strong>${userName}</strong>.</p>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div>
          <label class="smallmuted" style="display:block;margin-bottom:4px;font-size:12px">Adjustment Type</label>
          <select id="adjust-type" class="input" style="width:100%; background: #1a1b23; border: 1px solid rgba(255,255,255,0.08); color: #fff; padding: 8px; border-radius: 8px;">
            <option value="credit">Credit (Add Funds)</option>
            <option value="debit">Debit (Deduct Funds)</option>
          </select>
        </div>
        <div>
          <label class="smallmuted" style="display:block;margin-bottom:4px;font-size:12px">Amount (₹)</label>
          <input type="number" id="adjust-amount" class="input" style="width:100%" placeholder="e.g. 100" min="1" step="any" required />
        </div>
        <button id="adjust-submit-btn" class="btn primary" style="width:100%;margin-top:8px">Apply Adjustment</button>
      </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const closeBtn = modal.querySelector('#adjust-close');
    closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) overlay.remove();
    });
    
    const submitBtn = modal.querySelector('#adjust-submit-btn');
    submitBtn.addEventListener('click', async () => {
      const typeSelect = modal.querySelector('#adjust-type');
      const amountInput = modal.querySelector('#adjust-amount');
      const amount = parseFloat(amountInput.value);
      const type = typeSelect.value;
      
      if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid positive amount.');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Applying...';
      
      try {
        await apiFetch('/admin/adjust-balance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, amount, type })
        });
        overlay.remove();
        showToast('Balance adjusted successfully!', 'ok');
        renderUsersTab();
      } catch (err) {
        alert(err.message || 'Failed to adjust balance');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Apply Adjustment';
      }
    });
  });
}
