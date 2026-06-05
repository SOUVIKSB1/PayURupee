import { apiFetch } from '../api.js';
import { store, setAuth } from '../store.js';
import { goto } from '../router.js';
import { isDemoMode, showStatusOverlay, showVerifyPinModal, escapeHtml } from '../utils.js';
import { addNotification } from '../notifications.js';

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
        <div class="smallmuted" style="margin-top:6px; margin-bottom:12px">You can paste an email (user@domain) or a UPI id (alice@oksbi) from QR scans</div>
        <input name="note" placeholder="Note (optional)" class="input" />
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" type="submit">Send</button>
          <button type="button" class="btn ghost" id="send-back">Back</button>
        </div>
        <div id="send-msg" style="margin-top:8px"></div>
      </form>

      <!-- GPay Quick contacts in Send Money page -->
      <div id="quick-contacts-section" style="display: none; border-top: 1px dashed rgba(255,255,255,0.08); margin-top: 24px; padding-top: 18px;">
        <span class="smallmuted" style="font-size: 11px; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 12px;">SELECT A CONTACT TO SEND MONEY</span>
        <div id="quick-contacts-container" style="display: flex; gap: 14px; overflow-x: auto; padding-bottom: 8px; scrollbar-width: none; -ms-overflow-style: none;"></div>
      </div>
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
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      if (!toEmail) {
        throw new Error('Please enter recipient email');
      }
      
      const demoMode = isDemoMode();
      
      let upiPin;
      try {
        upiPin = await showVerifyPinModal();
      } catch (cancelErr) {
        msg.textContent = 'Payment cancelled';
        msg.className = 'smallmuted';
        return;
      }

      // Send request directly to /wallet/send
      const json = await apiFetch('/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail, amount, note, demoMode, upiPin })
      });
      
      const successMsg = 'Payment sent successfully';
      msg.textContent = successMsg;
      msg.className = 'ok';
      showStatusOverlay({ type: 'success', message: successMsg });
      
      if (json.user) {
        store.user = json.user;
        localStorage.setItem('ewallet_user', JSON.stringify(store.user));
        if (window.__onAuthChange) window.__onAuthChange();
      } else if (json.balance !== undefined && store.user) {
        store.user.balance = json.balance;
        localStorage.setItem('ewallet_user', JSON.stringify(store.user));
        if (window.__onAuthChange) window.__onAuthChange();
      }
      
      addNotification(`Sent ₹${amount.toFixed(2)} to ${toEmail}`, 'success');
      
      setTimeout(() => {
        goto('receipt', { transaction: json.transaction, toEmail, amount, note, type: 'send' });
      }, 1200);
    } catch (err) {
      console.error('Send money error:', err);
      const raw = (err && err.message) ? String(err.message).toLowerCase() : '';
      
      if (isDemoMode()) {
        msg.textContent = err.message || 'Payment failed';
        msg.className = 'err';
        showStatusOverlay({ type: 'error', message: err.message || 'Payment failed' });
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

  // Load Quick Contacts from database
  apiFetch('/users/contacts').then(json => {
    const contacts = json.contacts || [];
    const container = document.getElementById('quick-contacts-container');
    const section = document.getElementById('quick-contacts-section');
    
    if (contacts.length > 0 && container) {
      section.style.display = 'block';
      container.innerHTML = '';
      
      const colors = ['#ff7a00', '#00a2ff', '#00d26a', '#7c5cff', '#e60072', '#ffbc00'];
      
      contacts.forEach((contact, idx) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'center';
        item.style.cursor = 'pointer';
        item.style.minWidth = '60px';
        
        const initial = String(contact.name || contact.email || '?').charAt(0).toUpperCase();
        const color = colors[idx % colors.length];
        
        item.innerHTML = `
          <div style="width: 46px; height: 46px; border-radius: 50%; background: ${color}20; border: 1.5px solid ${color}; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800; transition: all 0.2s ease;" class="contact-avatar">
            ${initial}
          </div>
          <span style="font-size: 11px; font-weight: 600; color: #fff; margin-top: 6px; max-width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;">
            ${escapeHtml(contact.name ? contact.name.split(' ')[0] : contact.email.split('@')[0])}
          </span>
        `;
        
        item.addEventListener('click', () => {
          const toEl = document.querySelector('input[name="toEmail"]');
          const amtEl = document.querySelector('input[name="amount"]');
          if (toEl) {
            toEl.value = contact.email;
            const isMobileScreen = window.innerWidth <= 850;
            if (amtEl && !isMobileScreen) amtEl.focus();
          }
        });
        
        const avatar = item.querySelector('.contact-avatar');
        item.addEventListener('mouseenter', () => {
          avatar.style.transform = 'scale(1.1)';
          avatar.style.boxShadow = `0 4px 12px ${color}33`;
        });
        item.addEventListener('mouseleave', () => {
          avatar.style.transform = 'scale(1)';
          avatar.style.boxShadow = 'none';
        });
        
        container.appendChild(item);
      });
    }
  }).catch(err => {
    console.warn('Failed to load contacts for send view', err);
  });

  // Set initial focus to the first input field on desktop only
  const isMobileScreen = window.innerWidth <= 850;
  if (!isMobileScreen) {
    document.querySelector('input[name="toEmail"]')?.focus();
  }
}
