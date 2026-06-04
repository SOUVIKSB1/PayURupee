import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, showStatusOverlay } from '../utils.js';

export async function renderBills() {
  const main = document.getElementById('main');
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

  document.getElementById('bills-back').addEventListener('click', () => goto('dashboard'));

  const sel = document.querySelector('select[name="providerCode"]');
  sel.innerHTML = `<option value="">Loading...</option>`;
  try {
    const json = await apiFetch('/bills/providers');
    const providers = json.providers || [];
    sel.innerHTML = `<option value="">Select provider</option>` + 
      providers.map(p => `<option value="${escapeHtml(p.code)}">${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`).join('');
  } catch (err) {
    sel.innerHTML = `<option value="">Failed to load</option>`;
  }

  document.getElementById('form-bill').addEventListener('submit', async (e) => {
    e.preventDefault();
    const providerCode = e.target.providerCode.value;
    const consumerNumber = e.target.consumerNumber.value.trim();
    const amount = Number(e.target.amount.value);
    const msg = document.getElementById('bill-msg');

    if (!providerCode) {
      msg.textContent = 'Please select a provider';
      msg.className = 'err';
      return;
    }
    if (!consumerNumber) {
      msg.textContent = 'Please enter consumer/account number';
      msg.className = 'err';
      return;
    }
    if (amount <= 0 || isNaN(amount)) {
      msg.textContent = 'Amount must be a positive number';
      msg.className = 'err';
      return;
    }

    msg.textContent = 'Processing...';
    msg.className = '';
    try {
      const json = await apiFetch('/bills/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerCode, consumerNumber, amount })
      });
      msg.textContent = 'Bill paid';
      msg.className = 'ok';
      showStatusOverlay({ type: 'success', message: 'Bill paid successfully' });
      
      try {
        const p = await apiFetch('/users/me');
        store.user = p.user;
        localStorage.setItem('ewallet_user', JSON.stringify(store.user));
        if (window.__onAuthChange) window.__onAuthChange();
      } catch (_) {}
    } catch (err) {
      const raw = (err && err.message) ? String(err.message).toLowerCase() : '';
      const isInsufficient = /insufficient|not enough|negative|low balance|insuff/i.test(raw);
      const text = isInsufficient ? 'Insufficient balance' : (err.message || 'Payment failed');
      msg.textContent = text;
      msg.className = 'err';
      showStatusOverlay({ type: 'error', message: text });
    }
  });
}
