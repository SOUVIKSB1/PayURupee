import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { isDemoMode, showAuthAnimation, showToast, attemptForceDeposit, formatCurrency, escapeHtml } from '../utils.js';
import { addNotification } from '../notifications.js';

export function renderTopUp() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card fade-in" style="max-width:640px;margin:12px auto">
      <h2>Top up wallet</h2>
      <p class="smallmuted">Add money to your wallet using card (Stripe test mode)</p>
      <form id="form-topup" style="margin-top:12px">
         <input name="amount" required placeholder="Amount (e.g., 500)" type="number" step="0.01" class="input" />
        <div id="card-element" style="margin-bottom:14px;padding:14px;border:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);border-radius:12px"></div>
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
  
  let stripe = null;
  let card = null;
  
  if (isDemoMode()) {
    // Hide Card Element input since we use simulate endpoints in Demo mode
    const cardEl = document.getElementById('card-element');
    if (cardEl) {
      cardEl.style.display = 'none';
    }
  } else {
    if (!publishable) {
      msg.innerHTML = '<div class="err">Missing Stripe publishable key. Set window.__STRIPE_PUBLISHABLE_KEY__ in your page (test key)</div>';
      return;
    }

    // Initialize Stripe and mount the Card element with custom dark theme styling rules
    stripe = Stripe(publishable);
    const elements = stripe.elements();
    card = elements.create('card', {
      style: {
        base: {
          color: '#ffffff',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '14px',
          iconColor: '#ff7a00',
          '::placeholder': {
            color: '#8e96a3'
          }
        },
        invalid: {
          color: '#ff5c6c',
          iconColor: '#ff5c6c'
        }
      }
    });
    card.mount('#card-element');
  }

  document.getElementById('form-topup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(e.target.amount.value);
    if (!amount || amount <= 0) {
      msg.textContent = 'Enter a valid amount';
      msg.className = 'err';
      return;
    }
    
    msg.textContent = 'Preparing payment...';
    msg.className = '';

    try {
      // DEMO MODE: Bypass Stripe processing completely
      if (isDemoMode()) {
        msg.textContent = 'Processing payment securely...';
        try {
          await showAuthAnimation(amount);
        } catch (e) {
          console.warn('auth animation interrupted', e);
        }
        msg.textContent = 'Completing transaction...';
        try {
          const res = await attemptForceDeposit(amount, 'Topup payment');
          if (res && typeof res.balance !== 'undefined') {
            if (store.user) {
              store.user.balance = res.balance;
              localStorage.setItem('ewallet_user', JSON.stringify(store.user));
              if (window.__onAuthChange) window.__onAuthChange();
            }
            showToast('Top Up completed successfully!', 'ok');
            addNotification(`Successfully topped up ₹${amount.toFixed(2)}`, 'success');
            msg.textContent = 'Top up completed successfully';
            msg.className = 'ok';
            setTimeout(() => goto('dashboard'), 1200);
            return;
          }
          throw new Error('Unexpected response');
        } catch (e) {
          console.warn('Force deposit persistence failed', e);
          const errMsg = e.message || 'Transaction failed — please try again';
          
          let maxRemaining = 5000;
          try {
            const historyRes = await apiFetch('/wallet/history');
            const txs = historyRes.history || historyRes.data || [];
            const dayStart = new Date();
            dayStart.setHours(0,0,0,0);
            
            const todayTopups = txs
              .filter(tx => tx.type === 'topup' && new Date(tx.createdAt) >= dayStart)
              .reduce((sum, tx) => sum + Number(tx.amount), 0);
            
            maxRemaining = Math.max(0, 5000 - todayTopups);
          } catch (historyErr) {
            console.error('Failed to calculate remaining limit:', historyErr);
          }

          showToast(errMsg, 'err');
          msg.innerHTML = `
            <div style="color: #ff5c6c; font-weight: 700; line-height: 1.4;">
              ${escapeHtml(errMsg)}
              <div style="margin-top: 8px; font-size: 13px; color: var(--accent1); background: rgba(255, 122, 0, 0.08); border: 1px solid rgba(255, 122, 0, 0.2); border-radius: 8px; padding: 8px 12px; display: inline-block;">
                Remaining top-up allowance today: <strong>₹${maxRemaining.toFixed(2)}</strong>
              </div>
            </div>
          `;
          return;
        }
      }

      // REAL MODE: Contact backend to create Stripe PaymentIntent
      const json = await apiFetch('/wallet/deposit/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        msg.className = 'err';
        return;
      }
      
      if (result.paymentIntent && result.paymentIntent.status === 'succeeded') {
        msg.textContent = 'Performing bank authorization...';
        try {
          await showAuthAnimation(amount);
        } catch (e) {
          console.warn('auth animation interrupted', e);
        }

        // Finalize transaction with Backend
        msg.textContent = 'Finalizing top up...';
        try {
          const confirmRes = await apiFetch('/wallet/deposit/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentIntentId })
          });
          msg.textContent = 'Top up successful';
          msg.className = 'ok';
          
          if (confirmRes && confirmRes.user) {
            store.user = confirmRes.user;
            localStorage.setItem('ewallet_user', JSON.stringify(store.user));
            if (window.__onAuthChange) window.__onAuthChange();
          } else {
            try {
              const p = await apiFetch('/users/me');
              store.user = p.user;
              localStorage.setItem('ewallet_user', JSON.stringify(store.user));
              if (window.__onAuthChange) window.__onAuthChange();
            } catch (_) {}
          }
          
          addNotification(`Successfully topped up ₹${amount.toFixed(2)}`, 'success');
          setTimeout(() => goto('dashboard'), 1200);
        } catch (e) {
          msg.textContent = e.message || 'Finalize failed';
          msg.className = 'err';
        }
      } else {
        msg.textContent = 'Payment not completed';
        msg.className = 'err';
      }
    } catch (err) {
      msg.textContent = err.message || 'Payment failed';
      msg.className = 'err';
    }
  });

  // Set initial focus to the first input field
  document.querySelector('input[name="amount"]')?.focus();
}
