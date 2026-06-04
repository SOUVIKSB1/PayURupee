import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { isDemoMode, showAuthAnimation, showToast, attemptForceDeposit } from '../utils.js';

export function renderTopUp() {
  const main = document.getElementById('main');
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

  // Initialize Stripe and mount the Card element
  const stripe = Stripe(publishable);
  const elements = stripe.elements();
  const card = elements.create('card');
  card.mount('#card-element');

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
        msg.textContent = 'Demo mode: simulating payment...';
        try {
          await showAuthAnimation(amount);
        } catch (e) {
          console.warn('auth animation interrupted', e);
        }
        msg.textContent = 'Persisting demo deposit...';
        try {
          const res = await attemptForceDeposit(amount, 'Demo topup (client)');
          if (res && typeof res.balance !== 'undefined') {
            if (store.user) {
              store.user.balance = res.balance;
              localStorage.setItem('ewallet_user', JSON.stringify(store.user));
              if (window.__onAuthChange) window.__onAuthChange();
            }
            showToast('Demo deposit persisted', 'ok');
            msg.textContent = 'Top up successful (demo)';
            msg.className = 'ok';
            setTimeout(() => goto('dashboard'), 1200);
            return;
          }
          throw new Error('Unexpected response');
        } catch (e) {
          console.warn('Force deposit persistence failed', e);
          showToast('Demo persistence failed (server)', 'err');
          msg.textContent = 'Demo persistence failed — try again';
          msg.className = 'err';
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
          await apiFetch('/wallet/deposit/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentIntentId })
          });
          msg.textContent = 'Top up successful';
          msg.className = 'ok';
          
          try {
            const p = await apiFetch('/users/me');
            store.user = p.user;
            localStorage.setItem('ewallet_user', JSON.stringify(store.user));
            if (window.__onAuthChange) window.__onAuthChange();
          } catch (_) {}
          
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
}
