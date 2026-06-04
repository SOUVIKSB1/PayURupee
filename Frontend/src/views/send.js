import { apiFetch } from '../api.js';
import { store, setAuth } from '../store.js';
import { goto } from '../router.js';
import { isDemoMode, showStatusOverlay } from '../utils.js';

export function renderSend() {
  const main = document.getElementById('main');
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

  // Populate QR prefill values if they exist
  try {
    if (store.qrPrefill) {
      const toEl = document.querySelector('input[name="toEmail"]');
      const amtEl = document.querySelector('input[name="amount"]');
      const noteEl = document.querySelector('input[name="note"]');
      if (toEl && store.qrPrefill.toEmail) toEl.value = store.qrPrefill.toEmail;
      if (amtEl && store.qrPrefill.amount) amtEl.value = store.qrPrefill.amount;
      if (noteEl && store.qrPrefill.note) noteEl.value = store.qrPrefill.note;
      delete store.qrPrefill;
    }
  } catch (e) {
    console.warn('prefill failed', e);
  }

  document.getElementById('send-back').addEventListener('click', () => goto('dashboard'));
  document.getElementById('form-send').addEventListener('submit', async (e) => {
    e.preventDefault();
    const toEmail = e.target.toEmail.value.trim();
    const amount = Number(e.target.amount.value);
    const note = e.target.note.value.trim();
    const msg = document.getElementById('send-msg');
    
    msg.textContent = 'Sending...';
    msg.className = '';
    
    try {
      if (amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (!toEmail) {
        throw new Error('Please enter recipient email');
      }
      
      const demoMode = isDemoMode();
      
      // Send request directly to /wallet/send
      const json = await apiFetch('/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail, amount, note, demoMode })
      });
      
      const successMsg = demoMode ? 'Payment sent (demo mode)' : 'Payment sent successfully';
      msg.textContent = successMsg;
      msg.className = 'ok';
      showStatusOverlay({ type: 'success', message: successMsg });
      
      if (json.balance !== undefined && store.user) {
        store.user.balance = json.balance;
        localStorage.setItem('ewallet_user', JSON.stringify(store.user));
        if (window.__onAuthChange) window.__onAuthChange();
      }
      
      try {
        const p = await apiFetch('/users/me');
        store.user = p.user;
        localStorage.setItem('ewallet_user', JSON.stringify(store.user));
        if (window.__onAuthChange) window.__onAuthChange();
      } catch (_) {}
      
      e.target.reset();
    } catch (err) {
      console.error('Send money error:', err);
      const raw = (err && err.message) ? String(err.message).toLowerCase() : '';
      
      if (isDemoMode()) {
        msg.textContent = err.message || 'Demo payment failed';
        msg.className = 'err';
        showStatusOverlay({ type: 'error', message: err.message || 'Demo payment failed' });
      } else {
        const isInsufficient = /insufficient|not enough|negative|low balance|insuff/i.test(raw);
        const isNotFound = /not found|404|recipient/i.test(raw);
        let text = err.message || 'Payment failed';
        if (isInsufficient) {
          text = 'Insufficient balance';
        } else if (isNotFound) {
          text = 'Recipient not found. Please check the email address.';
        }
        msg.textContent = text;
        msg.className = 'err';
        showStatusOverlay({ type: 'error', message: text });
      }
    }
  });
}
