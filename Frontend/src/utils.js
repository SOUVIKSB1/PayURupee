/**
 * utils.js
 * 
 * Provides generic visual, data validation, and helper utilities.
 * 
 * Utilities include:
 * 1. `formatCurrency`: Standardize number representation into Indian Rupees (INR).
 * 2. `escapeHtml`: Sanitize inputs to prevent Cross-Site Scripting (XSS).
 * 3. `showToast`: Trigger overlay toast alerts.
 * 4. `showStatusOverlay`: Visual checkmark/error overlay popup.
 * 5. `parseQrPayload`: Extracts email, amount, note, and name from parsed QR values.
 * 6. `showAuthAnimation`: Implements the bank OTP authorization check fingerprint animation.
 * 7. `isDemoMode` / `setDemoMode`: Manage dev simulation configurations.
 */

import { apiFetch } from './api.js';
import { store } from './store.js';

/**
 * Format numeric value to standard Indian Currency symbol display format (e.g. ₹10,000.00).
 * 
 * @param {number|string} n - Amount to format.
 * @returns {string} - Formatted currency string.
 */
export function formatCurrency(n) {
  const val = Number(n || 0);
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
}

/**
 * Escape unsafe markup elements in dynamic text strings to avoid HTML injection/XSS.
 * 
 * @param {string} s - Raw input text.
 * @returns {string} - Sanitized string.
 */
export function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/**
 * Display a temporary self-dismissing notification banner (toast) in the corner of the screen.
 * 
 * @param {string} text - Message text.
 * @param {string} type - 'ok' (green success styling) or 'err' (red alert styling).
 * @param {number} ms - Banner visibility duration.
 */
export function showToast(text, type = 'ok', ms = 3800) {
  try {
    let container = document.querySelector('.toast-container');
    // Create container element if not already present in the DOM
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'err' ? 'err' : 'ok');
    t.textContent = text;
    container.appendChild(t);
    
    // Smooth transition animations: fade out near completion
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(8px)';
    }, ms - 400);
    setTimeout(() => {
      try {
        t.remove();
      } catch (e) {}
    }, ms);
  } catch (e) {
    console.warn('toast failed', e);
  }
}

/**
 * Read demo mode setting from local storage.
 * 
 * @returns {boolean} - True if demo mode is enabled.
 */
export function isDemoMode() {
  const v = localStorage.getItem('ewallet_demo_mode');
  if (v === null) return true; // default to demo mode ON for local sandbox safety
  return v === '1' || v === 'true';
}

/**
 * Update and toggle demo mode setting.
 * 
 * @param {boolean} enabled - True to toggle demo mode active.
 */
export function setDemoMode(enabled) {
  localStorage.setItem('ewallet_demo_mode', enabled ? '1' : '0');
  const btn = document.getElementById('dev-mode-toggle');
  if (btn) btn.textContent = enabled ? 'Demo: ON' : 'Demo: OFF';
}

/**
 * Parses raw text payload extracted from a scanned QR image.
 * Supports standard UPI deep links (upi://pay?pa=recipient&pn=name&am=amount),
 * raw JSON objects, key-value configurations, and fallback regex patterns.
 * 
 * @param {string} s - Decoded QR string data.
 * @returns {object|null} - Parsed recipient details, or null.
 */
export function parseQrPayload(s) {
  if (!s) return null;
  const rawStr = String(s).trim();
  
  // 1. UPI Payment Link format parser
  try {
    if (/^upi:\/\//i.test(rawStr)) {
      try {
        const u = new URL(rawStr);
        const pa = u.searchParams.get('pa');
        const am = u.searchParams.get('am') || u.searchParams.get('amount');
        const pn = u.searchParams.get('pn');
        return {
          name: pn ? decodeURIComponent(pn) : undefined,
          email: pa ? decodeURIComponent(pa) : undefined,
          amount: am ? decodeURIComponent(am) : undefined
        };
      } catch (err) {
        // Simple manual split query parser fallback
        const q = rawStr.split('?')[1] || '';
        const parts = q.split('&').map(p => p.split('='));
        const obj = {};
        parts.forEach(p => {
          if (p[0]) obj[p[0]] = decodeURIComponent(p[1] || '');
        });
        return { name: obj.pn, email: obj.pa, amount: obj.am || obj.amount };
      }
    }
  } catch (err) {}

  // 2. Structured JSON format parser
  try {
    const j = JSON.parse(s);
    return { name: j.name || j.fullName || j.username, email: j.email, amount: j.amount || j.amt };
  } catch (err) {}

  // 3. Key-Value format split parser (e.g. email: user@domain, amount: 200)
  const str = rawStr;
  const obj = {};
  const parts = str.split(/\r?\n|,/).map(p => p.trim()).filter(Boolean);
  parts.forEach(p => {
    const m = p.match(/^\s*([^:=]+)\s*[:=]\s*(.+)\s*$/);
    if (m) {
      const k = m[1].toLowerCase();
      const v = m[2].trim();
      obj[k] = v;
    }
  });
  if (obj.email || obj.amount || obj.name) {
    return {
      name: obj.name || obj.fullname || obj.full_name,
      email: obj.email,
      amount: obj.amount || obj.amt
    };
  }

  // 4. Fallback: Parse details using standard regex checks
  const emailMatch = str.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const amountMatch = str.match(/(?:amount|amt|rupees|rs)?\s*[:=]?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  const nameMatch = str.match(/name\s*[:=]\s*([^,\n]+)/i);
  return {
    name: nameMatch ? nameMatch[1].trim() : undefined,
    email: emailMatch ? emailMatch[0] : undefined,
    amount: amountMatch ? amountMatch[1] : undefined
  };
}

/**
 * Triggers a visual loading overlay showing bank authentication sequence.
 * Renders fingerprint animation and simulated progress bars.
 * 
 * @param {number} amount - Transaction amount for context.
 * @returns {Promise<void>} - Resolves once the animations successfully conclude.
 */
export function showAuthAnimation(amount) {
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
    
    // List of simulated loading steps
    const steps = [
      { t: 'Contacting bank', dur: 700 },
      { t: 'Authenticating', dur: 900 },
      { t: 'Finalizing', dur: 700 }
    ];
    let idx = 0;

    function step() {
      // If all steps are complete, render tick and exit overlay
      if (idx >= steps.length) {
        msg.textContent = 'Authorized';
        const wrap = document.createElement('div');
        wrap.className = 'checkmark-wrapper';
        wrap.innerHTML = `<div class="checkmark"><svg viewBox="0 0 52 52" aria-hidden="true"><circle class="circle" cx="26" cy="26" r="24"></circle><path class="tick" d="M14 27l7 7 17-17"/></svg></div>`;
        box.appendChild(wrap);
        setTimeout(() => {
          try {
            overlay.remove();
          } catch (e) {}
          resolve();
        }, 900);
        return;
      }
      
      // Update label and progress duration for the current step
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

/**
 * Show full screen success checkmark or error crossing status overlay card.
 * 
 * @param {string} type - 'success' or 'error'.
 * @param {string} message - Text information.
 */
export function showStatusOverlay({ type = 'success', message = '' } = {}) {
  try {
    const overlay = document.getElementById('status-overlay');
    const icon = document.getElementById('status-icon');
    const msg = document.getElementById('status-message');
    if (!overlay || !icon || !msg) return;
    
    icon.className = 'icon';
    if (type === 'success') {
      icon.classList.add('success');
      icon.innerHTML = `<svg viewBox="0 0 52 52" aria-hidden="true"><path class="tick" d="M14 27l7 7 17-17"/></svg>`;
    } else {
      icon.classList.add('error');
      icon.innerHTML = `<svg viewBox="0 0 52 52" aria-hidden="true"><path class="cross-line" d="M16 16 L36 36"/><path class="cross-line" d="M36 16 L16 36"/></svg>`;
    }
    msg.textContent = message || (type === 'success' ? 'Payment successful' : 'Payment failed');
    overlay.classList.remove('hidden');
    
    // Auto dismissal timer
    clearTimeout(window.__statusTimer);
    window.__statusTimer = setTimeout(() => {
      try {
        overlay.classList.add('hidden');
      } catch (_) {}
    }, type === 'success' ? 1600 : 2000);
  } catch (e) {
    console.warn('status overlay failed', e);
  }
}

/**
 * Wrapper helper for posting top-up requests in demo mode.
 * Retries network attempts with exponential backoff configurations on failure.
 * 
 * @param {number} amount - Deposit amount.
 * @param {string} note - Metadata details note.
 * @param {number} retries - Number of retry attempts.
 * @param {number} initialDelay - Wait ms before first retry.
 */
export async function attemptForceDeposit(amount, note = '', retries = 3, initialDelay = 600) {
  let attempt = 0;
  let lastErr;
  while (attempt < retries) {
    try {
      if (attempt > 0) {
        showToast(`Retrying demo persistence (attempt ${attempt + 1}/${retries})`, 'err', 1400);
      }
      const res = await apiFetch('/wallet/deposit/force', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
