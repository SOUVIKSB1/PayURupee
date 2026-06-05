import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { formatCurrency, escapeHtml, showStatusOverlay, showVerifyPinModal } from '../utils.js';

export function renderCheckout() {
  const main = document.getElementById('main');
  const paramsStr = localStorage.getItem('checkout_params');
  
  if (!paramsStr) {
    main.innerHTML = `<div class="card err" style="max-width:500px;margin:24px auto;text-align:center">No checkout session active.</div>`;
    setTimeout(() => goto('dashboard'), 2000);
    return;
  }
  
  const params = JSON.parse(paramsStr);
  const user = store.user || { balance: 0 };
  const requestedAmt = Number(params.amount);
  const hasFunds = user.balance >= requestedAmt;
  
  main.innerHTML = `
    <div class="card fade-in" style="max-width: 520px; margin: 32px auto; padding: 28px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 56px; height: 56px; background: rgba(255,122,0,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; border: 1px solid rgba(255,122,0,0.2);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent1)" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
        </div>
        <h2 style="margin: 0; font-size: 22px; font-weight: 800; background: linear-gradient(135deg, #ffffff, #a1a1aa); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Secure Checkout</h2>
        <p class="smallmuted" style="margin-top: 4px;">Confirm your payment through PayU₹upee wallet</p>
      </div>

      <!-- Merchant bill overview card -->
      <div style="padding: 20px; background: rgba(255,255,255,0.01); border: 1px dashed rgba(255,255,255,0.08); border-radius: 16px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 12px;">
          <span class="smallmuted">Pay To Merchant:</span>
          <strong style="color: #fff;">${escapeHtml(params.merchantEmail)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 12px;">
          <span class="smallmuted">Order ID:</span>
          <strong style="color: #fff; font-family: monospace;">${escapeHtml(params.orderId)}</strong>
        </div>
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 12px 0;" />
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="smallmuted" style="font-weight: 700; font-size: 14px;">Total Amount:</span>
          <strong style="color: var(--accent1); font-size: 20px;">${formatCurrency(requestedAmt)}</strong>
        </div>
      </div>

      <!-- User funds / Balance validation card -->
      <div style="padding: 16px; border-radius: 14px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; ${hasFunds ? 'background: rgba(0,210,106,0.04); border: 1px solid rgba(0,210,106,0.12);' : 'background: rgba(255,92,108,0.04); border: 1px solid rgba(255,92,108,0.12);'}">
        <div>
          <div style="font-size: 11px; color: var(--muted); font-weight: 700;">YOUR BALANCE</div>
          <div style="font-size: 16px; font-weight: 800; color: #fff; margin-top: 2px;">${formatCurrency(user.balance)}</div>
        </div>
        <div style="text-align: right;">
          ${hasFunds ? `
            <span style="font-size: 11px; font-weight: 700; color: #00d26a; background: rgba(0,210,106,0.1); padding: 4px 8px; border-radius: 6px;">AVAILABLE FUNDS</span>
          ` : `
            <span style="font-size: 11px; font-weight: 700; color: #ff5c6c; background: rgba(255,92,108,0.1); padding: 4px 8px; border-radius: 6px;">INSUFFICIENT BALANCE</span>
          `}
        </div>
      </div>

      <!-- Actions -->
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="btn-confirm-checkout" class="btn primary" style="width: 100%; padding: 14px; font-weight: 700; border-radius: 12px; font-size: 15px;" ${hasFunds ? '' : 'disabled'}>Confirm Payment</button>
        <button id="btn-cancel-checkout" class="btn ghost" style="width: 100%; padding: 14px; font-weight: 600; border-radius: 12px; border-color: rgba(255,255,255,0.08); color: #fff;">Cancel Checkout</button>
      </div>

      <div id="checkout-msg" style="margin-top: 14px; text-align: center; font-size: 13px;"></div>
    </div>
  `;

  document.getElementById('btn-cancel-checkout').addEventListener('click', () => {
    localStorage.removeItem('checkout_params');
    if (params.callbackUrl) {
      try {
        const target = new URL(params.callbackUrl);
        target.searchParams.set('status', 'cancelled');
        target.searchParams.set('orderId', params.orderId);
        window.location.href = target.toString();
      } catch (err) {
        // Fallback for relative or invalid URL formats
        window.location.href = `${params.callbackUrl}?status=cancelled&orderId=${encodeURIComponent(params.orderId)}`;
      }
    } else {
      goto('dashboard');
    }
  });

  document.getElementById('btn-confirm-checkout').addEventListener('click', async () => {
    const btn = document.getElementById('btn-confirm-checkout');
    const msg = document.getElementById('checkout-msg');
    
    let upiPin;
    try {
      upiPin = await showVerifyPinModal();
    } catch (cancelErr) {
      msg.textContent = 'Payment cancelled';
      msg.className = 'smallmuted';
      return;
    }

    btn.disabled = true;
    msg.innerHTML = '<span class="spinner"></span>Processing payment...';
    msg.className = '';
    
    try {
      const note = `Merchant Order: ${params.orderId}`;
      const sendRes = await apiFetch('/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          toEmail: params.merchantEmail, 
          amount: requestedAmt, 
          note,
          upiPin
        })
      });

      msg.textContent = 'Payment successful! Redirecting...';
      msg.className = 'ok';
      showStatusOverlay({ type: 'success', message: 'Payment Sent Successfully!' });
      
      // Update local wallet balance
      if (sendRes && sendRes.user) {
        store.user = sendRes.user;
        localStorage.setItem('ewallet_user', JSON.stringify(store.user));
        if (window.__onAuthChange) window.__onAuthChange();
      }

      localStorage.removeItem('checkout_params');

      setTimeout(() => {
        if (params.callbackUrl) {
          try {
            const target = new URL(params.callbackUrl);
            target.searchParams.set('status', 'success');
            target.searchParams.set('transactionId', sendRes.transaction?._id || sendRes.transactionId || 'N/A');
            target.searchParams.set('orderId', params.orderId);
            target.searchParams.set('amount', String(requestedAmt));
            window.location.href = target.toString();
          } catch (err) {
            // Fallback for relative paths
            window.location.href = `${params.callbackUrl}?status=success&transactionId=${encodeURIComponent(sendRes.transaction?._id || 'N/A')}&orderId=${encodeURIComponent(params.orderId)}&amount=${requestedAmt}`;
          }
        } else {
          goto('dashboard');
        }
      }, 1500);
      
    } catch (err) {
      console.error('Checkout payment failed', err);
      msg.textContent = err.message || 'Payment failed';
      msg.className = 'err';
      btn.disabled = false;
    }
  });
}
