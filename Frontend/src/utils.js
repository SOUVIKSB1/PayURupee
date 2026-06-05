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
      // Play completion chime sound for the sender
      playChimeSound();
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

/**
 * Play a synthesized, dual-frequency high-fidelity double chime sound (sender completion feedback).
 */
export function playChimeSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // First high note (A5 - 880Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Second higher note (E6 - 1320Hz) starting slightly later
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.001, ctx.currentTime);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);
    
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.45);
  } catch (err) {
    console.warn('Failed to play chime sound:', err);
  }
}

/**
 * Play a synthesized series of metallic coin drop impact sounds.
 */
export function playCoinSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Series of clinks with decreasing volume and variable timing
    const clinks = [
      { time: 0, freq: 2100, dur: 0.1, vol: 0.15 },
      { time: 0.05, freq: 2400, dur: 0.08, vol: 0.1 },
      { time: 0.12, freq: 1900, dur: 0.12, vol: 0.15 },
      { time: 0.18, freq: 2200, dur: 0.07, vol: 0.08 },
      { time: 0.25, freq: 2000, dur: 0.15, vol: 0.12 },
      { time: 0.35, freq: 2150, dur: 0.1, vol: 0.05 }
    ];
    
    clinks.forEach(clink => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(clink.freq, ctx.currentTime + clink.time);
      osc.frequency.exponentialRampToValueAtTime(clink.freq * 0.88, ctx.currentTime + clink.time + clink.dur);
      
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.setValueAtTime(clink.vol, ctx.currentTime + clink.time);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + clink.time + clink.dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + clink.time);
      osc.stop(ctx.currentTime + clink.time + clink.dur);
    });
  } catch (err) {
    console.warn('Failed to play coin sound:', err);
  }
}

/**
 * Play a short high beep (QR scanning success confirmation).
 */
export function playScanBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch (err) {
    console.warn('Failed to play scan beep sound:', err);
  }
}

/**
 * Draw a full screen canvas falling coin rain animation overlay.
 */
export function triggerCoinRain() {
  try {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    const coins = [];
    const coinCount = 45;
    
    for (let i = 0; i < coinCount; i++) {
      coins.push({
        x: Math.random() * canvas.width,
        y: -50 - Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 4,
        vy: 4 + Math.random() * 6,
        radius: 12 + Math.random() * 8,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        scaleY: Math.random() * Math.PI,
        scaleYSpeed: 0.04 + Math.random() * 0.08
      });
    }
    
    let active = true;
    
    function update() {
      if (!active) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let coinsStillVisible = false;
      
      coins.forEach(c => {
        c.x += c.vx;
        c.y += c.vy;
        c.rotation += c.rotationSpeed;
        c.scaleY += c.scaleYSpeed;
        
        const mappedScaleY = Math.abs(Math.sin(c.scaleY));
        
        if (c.y < canvas.height + 50) {
          coinsStillVisible = true;
          
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.rotate(c.rotation);
          ctx.scale(1, mappedScaleY);
          
          // Outer Gold Ring
          ctx.beginPath();
          ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#FFD700';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetY = 2;
          ctx.fill();
          
          // Inner Ring
          ctx.beginPath();
          ctx.arc(0, 0, c.radius * 0.8, 0, Math.PI * 2);
          ctx.fillStyle = '#FFC72C';
          ctx.fill();
          
          // Rupee Text
          ctx.font = `bold ${c.radius * 1.0}px Arial, sans-serif`;
          ctx.fillStyle = '#D4AF37';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('₹', 0, 0);
          
          ctx.restore();
        }
      });
      
      if (coinsStillVisible) {
        requestAnimationFrame(update);
      } else {
        active = false;
        window.removeEventListener('resize', resize);
        canvas.remove();
      }
    }
    
    // Play the metallic drop audio loop alongside animation start
    playCoinSound();
    
    requestAnimationFrame(update);
  } catch (err) {
    console.error('Coin rain animation failed', err);
  }
}

/**
 * Display a personalized UPI receiving QR Code Dialog.
 */
export function showMyQrModal() {
  if (!store.user) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'my-qr-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal qr-generator-modal';
  modal.style.maxWidth = '370px';
  modal.style.textAlign = 'center';
  
  modal.innerHTML = `
    <div class="header" style="border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 20px;">
      <h3 style="margin: 0; color: #fff; font-size: 18px; font-weight: 700;">Receive Money</h3>
      <button class="close" id="my-qr-close">✕</button>
    </div>
    
    <div class="qr-modal-body" style="padding: 0;">
      <!-- Google Pay-style White QR Card -->
      <div class="gpay-qr-card" style="background: #ffffff; border-radius: 20px; width: 100%; max-width: 320px; margin: 0 auto 20px; box-shadow: 0 12px 36px rgba(0,0,0,0.5); overflow: hidden; position: relative;">
        <!-- Card Blue Header -->
        <div style="background: #00a2ff; padding: 20px; color: #ffffff; text-align: center;">
          <div style="font-weight: 850; font-size: 19px; letter-spacing: 0.5px;">PayU₹upee</div>
          <div style="font-size: 10px; opacity: 0.85; text-transform: uppercase; font-weight: 700; margin-top: 2px; letter-spacing: 0.5px;">Secure UPI QR</div>
        </div>
        
        <!-- Avatar overlapping header -->
        <div style="width: 54px; height: 54px; border-radius: 50%; background: #ff7a00; border: 3px solid #ffffff; margin: -27px auto 0; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 20px; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
          ${escapeHtml(store.user.name.charAt(0).toUpperCase())}
        </div>
        
        <!-- Profile details -->
        <div style="text-align: center; margin-top: 10px; padding: 0 16px;">
          <div style="color: #0f172a; font-weight: 800; font-size: 16px;">${escapeHtml(store.user.name)}</div>
          <div style="color: #64748b; font-size: 11.5px; font-weight: 600; margin-top: 2px; word-break: break-all;">UPI ID: ${escapeHtml(store.user.email)}</div>
        </div>
        
        <!-- QR Code container with relative center badge -->
        <div style="position: relative; width: 190px; height: 190px; margin: 18px auto; background: #ffffff; padding: 4px; box-sizing: border-box;">
          <img id="my-qr-image" src="" alt="UPI QR Code" style="width: 100%; height: 100%; display: block;" />
          <!-- Logo badge in center of QR -->
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 34px; height: 34px; border-radius: 50%; background: #ff7a00; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
            ₹
          </div>
        </div>
        
        <!-- Call to Action -->
        <div style="text-align: center; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 6px;">
          Scan with any UPI app to pay
        </div>
        
        <!-- UPI Apps Footer Row -->
        <div style="display: flex; gap: 8px; justify-content: center; align-items: center; padding-bottom: 20px;">
          <span style="font-size: 8px; padding: 3px 6px; border-radius: 4px; background: #005b8a; color: #fff; font-weight: 800;">BHIM</span>
          <span style="font-size: 8px; padding: 3px 6px; border-radius: 4px; background: #ea4335; color: #fff; font-weight: 800;">GPay</span>
          <span style="font-size: 8px; padding: 3px 6px; border-radius: 4px; background: #5f259f; color: #fff; font-weight: 800;">PhonePe</span>
          <span style="font-size: 8px; padding: 3px 6px; border-radius: 4px; background: #002e7e; color: #fff; font-weight: 800;">Paytm</span>
        </div>
      </div>
      
      <!-- Specific Amount Request Selector -->
      <div class="qr-amount-selector" style="text-align: left; width: 100%; max-width: 320px; margin: 0 auto 16px;">
        <label class="qr-label" style="font-size: 11.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; display: block; margin-bottom: 8px; letter-spacing: 0.4px;">Request Specific Amount (Optional)</label>
        <input type="number" id="my-qr-amount" class="input" placeholder="Enter amount to receive (e.g. 500)" style="width: 100%; margin-bottom: 0;" />
      </div>
    </div>
    
    <div class="qr-actions" style="width: 100%; max-width: 320px; margin: 0 auto;">
      <button class="btn" id="my-qr-download" style="width: 100%; background: #00a2ff; border: none; font-weight: 700; color: #fff; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 12px; cursor: pointer;">Download QR Code</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  const qrImg = modal.querySelector('#my-qr-image');
  const amtInput = modal.querySelector('#my-qr-amount');
  const downloadBtn = modal.querySelector('#my-qr-download');
  
  function updateQrCode() {
    const amount = amtInput.value.trim();
    let link = `upi://pay?pa=${encodeURIComponent(store.user.email)}&pn=${encodeURIComponent(store.user.name)}`;
    if (amount && !isNaN(amount) && Number(amount) > 0) {
      link += `&am=${encodeURIComponent(amount)}`;
    }
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=${encodeURIComponent(link)}`;
  }
  
  // Initial load
  updateQrCode();
  
  // Listen for amount updates
  amtInput.addEventListener('input', updateQrCode);
  
  // Close buttons
  modal.querySelector('#my-qr-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  
  // Download QR code option
  downloadBtn.addEventListener('click', async () => {
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Generating...';
    try {
      // Create offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 840;
      const ctx = canvas.getContext('2d');
      
      // Draw canvas outer background frame
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, '#0a0b0e');
      grad.addColorStop(1, '#14151b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw ambient light reflection top left
      ctx.fillStyle = 'rgba(0, 162, 255, 0.08)';
      ctx.beginPath();
      ctx.arc(0, 0, 250, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 122, 0, 0.05)';
      ctx.beginPath();
      ctx.arc(canvas.width, canvas.height, 300, 0, Math.PI * 2);
      ctx.fill();

      // Card container coordinates
      const cardX = 60;
      const cardY = 80;
      const cardW = 480;
      const cardH = 680;
      const cardR = 28;
      
      // Draw card white container
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = 36;
      ctx.shadowOffsetY = 16;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, cardH, cardR);
      ctx.fill();
      ctx.shadowColor = 'transparent'; // reset shadow
      
      // Draw GPay-style Blue Card Header Bar
      const headerH = 110;
      ctx.fillStyle = '#00a2ff'; 
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardW, headerH, [cardR, cardR, 0, 0]);
      ctx.fill();
      
      // Header brand text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PayU₹upee', cardX + cardW / 2, cardY + 46);
      
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('SECURE UPI PAYMENTS', cardX + cardW / 2, cardY + 74);
      
      // Draw User Avatar Circle on header line
      const avatarR = 36;
      const avatarX = cardX + cardW / 2;
      const avatarY = cardY + headerH;
      
      ctx.fillStyle = '#ff7a00';
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
      ctx.fill();
      
      // Border around avatar
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Initial letter in avatar
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(store.user.name.charAt(0).toUpperCase(), avatarX, avatarY + 10);
      
      // Draw User Profile Details below avatar
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText(store.user.name, cardX + cardW / 2, avatarY + avatarR + 32);
      
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`UPI ID: ${store.user.email}`, cardX + cardW / 2, avatarY + avatarR + 56);
      
      // Draw QR Code Image
      const qrSize = 250;
      const qrX = cardX + (cardW - qrSize) / 2;
      const qrY = avatarY + avatarR + 85;
      
      const qrImage = new Image();
      qrImage.crossOrigin = 'anonymous';
      qrImage.src = qrImg.src;
      
      await new Promise((resImg, rejImg) => {
        qrImage.onload = resImg;
        qrImage.onerror = rejImg;
      });
      
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      
      // Draw Page Logo badge in the center of QR code
      const badgeSize = 46;
      const badgeX = qrX + (qrSize - badgeSize) / 2;
      const badgeY = qrY + (qrSize - badgeSize) / 2;
      
      // Orange rounded badge background
      ctx.fillStyle = '#ff7a00';
      ctx.beginPath();
      ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
      ctx.fill();
      
      // White border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Rupee symbol "₹" inside badge
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('₹', badgeX + badgeSize/2, badgeY + badgeSize/2 + 8);
      
      // Footer: scan instructions & accepted app logos
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('Scan with any UPI app to pay', cardX + cardW / 2, qrY + qrSize + 36);
      
      // Draw BHIM, GPay, PhonePe, Paytm logos at bottom
      const logoY = qrY + qrSize + 60;
      const logoSpacing = 68;
      const startX = cardX + cardW / 2 - (logoSpacing * 1.5);
      
      const apps = [
        { name: 'BHIM', color: '#005b8a' },
        { name: 'GPay', color: '#ea4335' },
        { name: 'PhonePe', color: '#5f259f' },
        { name: 'Paytm', color: '#002e7e' }
      ];
      
      apps.forEach((app, idx) => {
        const x = startX + idx * logoSpacing;
        
        ctx.fillStyle = app.color;
        ctx.beginPath();
        ctx.roundRect(x - 20, logoY, 40, 24, 6);
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(app.name, x, logoY + 15);
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `payurupee-qr-${store.user.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to draw QR card canvas', err);
      // Fallback: download raw QR code image
      try {
        const response = await fetch(qrImg.src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payurupee-qr-raw-${store.user.name.toLowerCase().replace(/\s+/g, '-')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err2) {
        window.open(qrImg.src, '_blank');
      }
    } finally {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Download QR Code';
    }
  });
}

/**
 * Trigger a physics-based particle confetti explosion at the center of the screen.
 */
export function triggerConfetti() {
  try {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '10000';
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    
    const particles = [];
    const colors = ['#FFD700', '#00a2ff', '#ff7a00', '#00d26a', '#ff5c6c', '#7c5cff'];
    
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: canvas.width / 2,
        y: canvas.height / 2 - 50,
        vx: (Math.random() - 0.5) * 12,
        vy: -4 - Math.random() * 12,
        radius: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        gravity: 0.35,
        alpha: 1,
        decay: 0.015 + Math.random() * 0.015
      });
    }
    
    let active = true;
    
    function update() {
      if (!active) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let particlesLeft = false;
      
      particles.forEach(p => {
        p.vx *= 0.98;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        
        if (p.alpha > 0) {
          particlesLeft = true;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.restore();
        }
      });
      
      if (particlesLeft) {
        requestAnimationFrame(update);
      } else {
        active = false;
        window.removeEventListener('resize', resize);
        canvas.remove();
      }
    }
    
    requestAnimationFrame(update);
  } catch (err) {
    console.error('Confetti animation failed', err);
  }
}

/**
 * Display a GPay-style interactive Scratch Card modal (awarding cashback).
 */
export function showScratchCardModal(reward) {
  if (!store.user || !reward) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'scratch-card-overlay';
  
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '320px';
  modal.style.textAlign = 'center';
  modal.style.padding = '20px';
  
  modal.innerHTML = `
    <div class="header">
      <h3 style="margin: 0; color: #fff;">Scratch & Win</h3>
      <button class="close" id="scratch-close">✕</button>
    </div>
    <div style="padding: 15px 0; display: flex; flex-direction: column; align-items: center;">
      <p class="smallmuted" style="margin-bottom: 15px; font-size: 13px;">Scratch the silver card to reveal your cashback reward!</p>
      
      <div id="scratch-container" style="position: relative; width: 220px; height: 220px; background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 36px rgba(0,0,0,0.4);">
        <!-- Underlying cashback message -->
        <div id="scratch-reward-content" style="display: none; text-align: center; animation: popIn 0.3s ease;">
          <div style="font-size: 40px; margin-bottom: 8px;">🎉</div>
          <div style="font-size: 14px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">Cashback Won!</div>
          <div id="scratch-reward-amount" style="font-size: 32px; font-weight: 800; color: #FFD700; text-shadow: 0 4px 10px rgba(255,215,0,0.25); margin-top: 4px;">₹0.00</div>
          <div id="scratch-reward-msg" class="smallmuted" style="font-size: 12px; margin-top: 6px; color: #fff; font-weight: 600;"></div>
        </div>
        
        <canvas id="scratch-canvas" width="220" height="220" style="position: absolute; top: 0; left: 0; cursor: crosshair; touch-action: none; border-radius: 16px;"></canvas>
      </div>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  const canvas = modal.querySelector('#scratch-canvas');
  const ctx = canvas.getContext('2d');
  const rewardContent = modal.querySelector('#scratch-reward-content');
  const rewardAmountNode = modal.querySelector('#scratch-reward-amount');
  const rewardMsgNode = modal.querySelector('#scratch-reward-msg');
  
  // Set amount and custom message safely
  const amtVal = Number(reward.amount ?? 0);
  rewardAmountNode.textContent = `₹${amtVal.toFixed(2)}`;
  rewardMsgNode.textContent = reward.message || 'Thank you for using PayURupee!';
  
  // Draw silver overlay
  ctx.fillStyle = '#a0a5b5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw premium gold card background pattern
  ctx.fillStyle = '#8a8e9e';
  ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);
  
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.fillStyle = '#444855';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PayU₹upee Rewards', canvas.width / 2, canvas.height / 2 - 15);
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.fillStyle = '#555a6a';
  ctx.fillText('SCRATCH HERE TO WIN', canvas.width / 2, canvas.height / 2 + 15);
  
  let isDrawing = false;
  let scratched = false;
  
  function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }
  
  function scratch(e) {
    if (!isDrawing || scratched) return;
    const pos = getMousePos(e);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
    ctx.fill();
    
    // Check scratched percentage periodically
    checkScratchProgress();
  }
  
  function checkScratchProgress() {
    if (scratched) return;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;
    let transparent = 0;
    
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) {
        transparent++;
      }
    }
    
    const percentage = (transparent / (canvas.width * canvas.height)) * 100;
    
    if (percentage >= 50) {
      scratched = true;
      claimReward();
    }
  }
  
  async function claimReward() {
    // Fade out canvas
    canvas.style.transition = 'opacity 0.4s ease';
    canvas.style.opacity = '0';
    rewardContent.style.display = 'block';
    
    setTimeout(() => {
      canvas.remove();
    }, 400);
    
    // Confetti explosion
    triggerConfetti();
    playChimeSound();
    
    try {
      // Actually claim on backend
      const res = await apiFetch('/users/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: reward._id })
      });
      
      // Update local store with updated user document containing balance/rewards status
      if (res && res.user) {
        store.user = res.user;
        localStorage.setItem('ewallet_user', JSON.stringify(store.user));
        if (window.__onAuthChange) window.__onAuthChange();
      }
      
      // Trigger canvas rupee rain
      setTimeout(() => {
        triggerCoinRain();
      }, 500);
    } catch (err) {
      console.warn('Failed to claim reward from backend', err);
    }
  }
  
  canvas.addEventListener('mousedown', (e) => { isDrawing = true; scratch(e); });
  canvas.addEventListener('mousemove', scratch);
  window.addEventListener('mouseup', () => { isDrawing = false; });
  
  canvas.addEventListener('touchstart', (e) => { isDrawing = true; scratch(e); });
  canvas.addEventListener('touchmove', scratch);
  window.addEventListener('touchend', () => { isDrawing = false; });
  
  // Close button handler
  const closeBtn = modal.querySelector('#scratch-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      overlay.remove();
    });
  }
  
  // Click outside modal to dismiss
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
}

export async function showContactDrawer(contact, color = '#ff7a00') {
  if (!store.user) return;

  const overlay = document.createElement('div');
  overlay.className = 'bottom-sheet-drawer';
  
  const drawer = document.createElement('div');
  drawer.className = 'bottom-sheet-content';
  
  const initial = String(contact.name || contact.email || '?').charAt(0).toUpperCase();
  
  drawer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:12px; margin-bottom:16px;">
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="width: 44px; height: 44px; border-radius: 50%; background: ${color}22; border: 1.5px solid ${color}; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 800;">
          ${initial}
        </div>
        <div>
          <h3 style="margin:0; font-size:16px; color:#fff;">${escapeHtml(contact.name || 'PayU₹upee Contact')}</h3>
          <p class="smallmuted" style="margin:2px 0 0; font-size:12px;">${escapeHtml(contact.email)}</p>
        </div>
      </div>
      <button id="drawer-close" class="close-btn" style="background:none; border:none; color:var(--muted); font-size:24px; cursor:pointer;">&times;</button>
    </div>

    <!-- Quick Action Section -->
    <div style="display:flex; gap:8px; margin-bottom:16px;">
      <button class="btn primary" id="drawer-btn-send" style="flex:1; padding:10px; font-weight:700; border-radius:10px; font-size:13px;">Send Money</button>
      <button class="btn ghost" id="drawer-btn-request" style="flex:1; padding:10px; font-weight:700; border-radius:10px; border-color:rgba(255,255,255,0.08); color:#fff; font-size:13px;">Request</button>
      <button class="btn ghost" id="drawer-btn-schedule" style="flex:0 0 auto; padding:10px 12px; font-weight:700; border-radius:10px; border-color:rgba(255,255,255,0.08); color:#fff; font-size:13px;" title="Schedule Payment">⏰</button>
    </div>

    <!-- Send money panel inside drawer (collapsible) -->
    <div id="drawer-send-panel" style="display:none; background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.04); border-radius:12px; padding:12px; margin-bottom:16px;">
      <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
        <input type="number" id="drawer-send-amount" class="input" placeholder="Amount (₹)" style="margin-bottom:0; flex:1;" />
        <input type="text" id="drawer-send-note" class="input" placeholder="Note" style="margin-bottom:0; flex:1.5;" />
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn ghost" id="drawer-send-cancel" style="padding:6px 12px; font-size:12px; border-radius:8px; color:#fff; border-color:rgba(255,255,255,0.08);">Cancel</button>
        <button class="btn primary" id="drawer-send-pay" style="padding:6px 16px; font-size:12px; font-weight:700; border-radius:8px;">Pay Now</button>
      </div>
    </div>

    <!-- Request money panel inside drawer (collapsible) -->
    <div id="drawer-request-panel" style="display:none; background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.04); border-radius:12px; padding:12px; margin-bottom:16px;">
      <div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">
        <input type="number" id="drawer-req-amount" class="input" placeholder="Request Amount (₹)" style="margin-bottom:0; flex:1;" />
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="btn ghost" id="drawer-req-cancel" style="padding:6px 12px; font-size:12px; border-radius:8px; color:#fff; border-color:rgba(255,255,255,0.08);">Cancel</button>
        <button class="btn solid-blue" id="drawer-req-submit" style="padding:6px 16px; font-size:12px; font-weight:700; border-radius:8px; background:var(--accent2); color:#fff; border:none;">Request</button>
      </div>
    </div>

    <!-- Chat / Recent Activity Thread -->
    <div style="flex:1; display:flex; flex-direction:column; min-height:180px; background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.04); border-radius:14px; overflow:hidden; margin-bottom:16px;">
      <div style="padding:8px 12px; border-bottom:1px solid rgba(255,255,255,0.04); font-size:11px; font-weight:700; color:var(--muted);">CHAT & ACTIVITY</div>
      <div id="drawer-chat-list" style="flex:1; padding:12px; overflow-y:auto; display:flex; flex-direction:column; gap:10px; max-height:220px;">
        <!-- Filled dynamically -->
      </div>
    </div>

    <!-- Message Send Input bar -->
    <div style="display:flex; gap:8px; align-items:center;">
      <input type="text" id="drawer-msg-input" class="input" placeholder="Type a message..." style="margin-bottom:0; flex:1;" />
      <button class="btn primary" id="drawer-btn-send-msg" style="padding:12px; border-radius:12px; width:44px; height:44px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </div>
  `;

  overlay.appendChild(drawer);
  document.body.appendChild(overlay);

  const isMobileScreen = window.innerWidth <= 850;

  const msgInput = drawer.querySelector('#drawer-msg-input');
  if (msgInput && !isMobileScreen) msgInput.focus();

  let refreshInterval = setInterval(() => {
    if (document.body.contains(overlay)) {
      loadChatHistory();
    } else {
      clearInterval(refreshInterval);
    }
  }, 2500);

  const closeBtn = drawer.querySelector('#drawer-close');
  closeBtn.addEventListener('click', () => {
    clearInterval(refreshInterval);
    overlay.remove();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      clearInterval(refreshInterval);
      overlay.remove();
    }
  });

  const sendPanel = drawer.querySelector('#drawer-send-panel');
  const reqPanel = drawer.querySelector('#drawer-request-panel');
  const btnSend = drawer.querySelector('#drawer-btn-send');
  const btnRequest = drawer.querySelector('#drawer-btn-request');

  btnSend.addEventListener('click', () => {
    reqPanel.style.display = 'none';
    sendPanel.style.display = sendPanel.style.display === 'none' ? 'block' : 'none';
    if (sendPanel.style.display === 'block' && !isMobileScreen) {
      drawer.querySelector('#drawer-send-amount').focus();
    }
  });

  btnRequest.addEventListener('click', () => {
    sendPanel.style.display = 'none';
    reqPanel.style.display = reqPanel.style.display === 'none' ? 'block' : 'none';
    if (reqPanel.style.display === 'block' && !isMobileScreen) {
      drawer.querySelector('#drawer-req-amount').focus();
    }
  });

  // Feature 2: Schedule Payment button in drawer
  const btnSchedule = drawer.querySelector('#drawer-btn-schedule');
  if (btnSchedule) {
    btnSchedule.addEventListener('click', () => {
      overlay.remove();
      clearInterval(refreshInterval);
      showSchedulePaymentModal(contact, color);
    });
  }

  drawer.querySelector('#drawer-send-cancel').addEventListener('click', () => {
    sendPanel.style.display = 'none';
  });

  drawer.querySelector('#drawer-req-cancel').addEventListener('click', () => {
    reqPanel.style.display = 'none';
  });

  const payBtn = drawer.querySelector('#drawer-send-pay');
  payBtn.addEventListener('click', async () => {
    const amtInput = drawer.querySelector('#drawer-send-amount');
    const noteInput = drawer.querySelector('#drawer-send-note');
    const amount = Number(amtInput.value);
    const note = noteInput.value.trim();

    if (!amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    let upiPin;
    try {
      upiPin = await showVerifyPinModal();
    } catch (cancelErr) {
      showToast('Payment cancelled', 'info');
      return;
    }

    payBtn.disabled = true;
    payBtn.textContent = 'Paying...';

    try {
      const result = await apiFetch('/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: contact.email, amount, note, upiPin })
      });

      showToast(`Successfully paid ₹${amount.toFixed(2)} to ${contact.name || contact.email}`, 'success');
      
      if (result && result.user) {
        store.user = result.user;
        localStorage.setItem('ewallet_user', JSON.stringify(store.user));
        if (window.__onAuthChange) window.__onAuthChange();
      }

      amtInput.value = '';
      noteInput.value = '';
      sendPanel.style.display = 'none';

      await loadChatHistory();
    } catch (err) {
      showToast(err.message || 'Payment failed', 'error');
    } finally {
      payBtn.disabled = false;
      payBtn.textContent = 'Pay Now';
    }
  });

  const submitReqBtn = drawer.querySelector('#drawer-req-submit');
  submitReqBtn.addEventListener('click', async () => {
    const amtInput = drawer.querySelector('#drawer-req-amount');
    const amount = Number(amtInput.value);
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    const msg = `Requested ₹${amount.toFixed(2)}`;
    await saveLocalMessage(msg, true, amount);
    
    amtInput.value = '';
    reqPanel.style.display = 'none';
    showToast(`Request of ₹${amount.toFixed(2)} sent to ${contact.name || contact.email}`, 'success');
    await loadChatHistory();
  });

  const msgSendBtn = drawer.querySelector('#drawer-btn-send-msg');
  msgSendBtn.addEventListener('click', async () => {
    const text = msgInput.value.trim();
    if (!text) return;
    
    await saveLocalMessage(text, false);
    msgInput.value = '';
    await loadChatHistory();
  });

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      msgSendBtn.click();
    }
  });

  async function saveLocalMessage(text, isRequest = false, amount = 0) {
    try {
      await apiFetch('/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: contact.email,
          text,
          isRequest,
          amount
        })
      });
    } catch (err) {
      showToast(err.message || 'Failed to send message', 'error');
    }
  }

  const chatListEl = drawer.querySelector('#drawer-chat-list');
  async function loadChatHistory() {
    try {
      const txRes = await apiFetch('/wallet/history');
      const allTx = txRes.data || [];
      const matchedTx = allTx.filter(tx => {
        const toEmail = tx.to?.email || tx.meta?.toEmail || tx.meta?.recipientEmail;
        const fromEmail = tx.from?.email;
        return toEmail === contact.email || fromEmail === contact.email;
      });

      const chatRes = await apiFetch(`/chat/history?contactEmail=${encodeURIComponent(contact.email)}`);
      const dbMsgs = chatRes.data || [];

      const timeline = [];
      matchedTx.forEach(tx => {
        timeline.push({
          type: 'tx',
          date: new Date(tx.createdAt),
          data: tx
        });
      });
      dbMsgs.forEach(msg => {
        timeline.push({
          type: 'msg',
          date: new Date(msg.timestamp || msg.createdAt),
          data: msg
        });
      });

      timeline.sort((a, b) => a.date - b.date);

      if (timeline.length === 0) {
        chatListEl.innerHTML = '<div class="smallmuted" style="text-align:center; padding:20px; font-size:12px;">No activity yet. Send a payment or a message!</div>';
        return;
      }

      chatListEl.innerHTML = '';
      timeline.forEach(item => {
        const dateStr = item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (item.type === 'tx') {
          const tx = item.data;
          const isDebit = tx.from?.email === store.user.email || tx.from === store.user._id;
          const amtStr = (isDebit ? '-' : '+') + formatCurrency(tx.amount);
          const color = isDebit ? '#ff5c6c' : '#00d26a';
          
          const bubble = document.createElement('div');
          bubble.style.alignSelf = isDebit ? 'flex-end' : 'flex-start';
          bubble.style.background = isDebit ? 'rgba(255, 122, 0, 0.08)' : 'rgba(0, 162, 255, 0.08)';
          bubble.style.border = isDebit ? '1px solid rgba(255, 122, 0, 0.15)' : '1px solid rgba(0, 162, 255, 0.15)';
          bubble.style.padding = '8px 12px';
          bubble.style.borderRadius = isDebit ? '14px 14px 2px 14px' : '14px 14px 14px 2px';
          bubble.style.maxWidth = '80%';
          bubble.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
          
          bubble.innerHTML = `
            <div style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; margin-bottom:4px;">${isDebit ? 'Sent Payment' : 'Received Payment'}</div>
            <div style="font-size:15px; font-weight:800; color:${color};">${amtStr}</div>
            ${tx.meta?.note ? `<div style="font-size:11.5px; color:#fff; margin-top:4px;">${escapeHtml(tx.meta.note)}</div>` : ''}
            <div style="font-size:9.5px; color:var(--muted); text-align:right; margin-top:4px;">${dateStr}</div>
          `;
          chatListEl.appendChild(bubble);
        } else {
          const msg = item.data;
          const isMine = msg.sender === store.user.email;
          const isRecvRequest = msg.isRequest && !isMine;
          
          const bubble = document.createElement('div');
          bubble.style.alignSelf = isMine ? 'flex-end' : 'flex-start';
          bubble.style.background = msg.isRequest 
            ? 'rgba(124, 92, 255, 0.1)' 
            : (isMine ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)');
          bubble.style.border = msg.isRequest 
            ? '1px solid rgba(124, 92, 255, 0.2)' 
            : '1px solid rgba(255, 255, 255, 0.06)';
          bubble.style.padding = '8px 12px';
          bubble.style.borderRadius = isMine ? '14px 14px 2px 14px' : '14px 14px 14px 2px';
          bubble.style.maxWidth = '80%';
          
          bubble.innerHTML = `
            ${msg.isRequest ? `<div style="font-size:10px; font-weight:700; color:#7c5cff; margin-bottom:2px;">MONEY REQUEST</div>` : ''}
            <div style="font-size:12.5px; color:#fff; word-break:break-word;">${escapeHtml(msg.text)}</div>
            ${isRecvRequest ? `
              <div style="margin-top: 8px;">
                <button class="btn btn-pay-request" data-amount="${msg.amount || 0}" style="padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #ff7a00; color: #fff; border: none; cursor: pointer;">Pay Now</button>
              </div>
            ` : ''}
            <div style="font-size:9.5px; color:var(--muted); text-align:right; margin-top:4px;">${dateStr}</div>
          `;
          
          if (isRecvRequest) {
            const payRequestBtn = bubble.querySelector('.btn-pay-request');
            payRequestBtn.addEventListener('click', () => {
              // Hide request panel if open
              reqPanel.style.display = 'none';
              // Open send panel
              sendPanel.style.display = 'block';
              // Populate inputs
              const amtInput = drawer.querySelector('#drawer-send-amount');
              const noteInput = drawer.querySelector('#drawer-send-note');
              amtInput.value = msg.amount || '';
              noteInput.value = `Paying request: ${msg.text}`;
              // Focus
              if (!isMobileScreen) {
                amtInput.focus();
              }
            });
          }
          
          chatListEl.appendChild(bubble);
        }
      });

      setTimeout(() => {
        chatListEl.scrollTop = chatListEl.scrollHeight;
      }, 50);
      
    } catch (err) {
      chatListEl.innerHTML = `<div class="err" style="text-align:center; padding:12px;">Failed to load timeline</div>`;
    }
  }

  await loadChatHistory();
}

export function showSetPinModal() {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'set-pin-overlay';
    overlay.className = 'bottom-sheet-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(4, 4, 6, 0.9); display: flex; align-items: flex-end;
      justify-content: center; z-index: 999999;
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'bottom-sheet-modal set-pin-modal';
    modal.style.cssText = `
      background: #0d0e12; border-top: 3px solid #ff7a00;
      width: 100%; max-width: 480px; border-radius: 24px 24px 0 0;
      padding: 32px 24px calc(32px + env(safe-area-inset-bottom, 12px)); box-sizing: border-box;
      box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
      transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column; align-items: center; text-align: center;
      max-height: 90vh; overflow-y: auto;
    `;

    // Contents
    modal.innerHTML = `
      <div style="font-size: 40px; margin-bottom: 16px;">🛡️</div>
      <h3 id="pin-modal-title" style="margin: 0 0 8px; color: #fff; font-size: 20px; font-weight: 800;">Set UPI PIN</h3>
      <p id="pin-modal-subtitle" style="margin: 0 0 24px; color: var(--muted); font-size: 13.5px;">Choose a secure 6-digit PIN to authorize payments</p>
      
      <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 24px;">
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
      </div>

      <div id="pin-modal-error" style="color: #ff5c6c; font-size: 13px; font-weight: 600; min-height: 18px; margin-bottom: 16px;"></div>

      <button id="btn-pin-submit" class="pay-now-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; opacity: 0.5; pointer-events: none;">
        <span>Continue</span>
      </button>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Trigger slide up
    setTimeout(() => {
      modal.style.transform = 'translateY(0)';
    }, 10);

    const titleEl = modal.querySelector('#pin-modal-title');
    const subtitleEl = modal.querySelector('#pin-modal-subtitle');
    const errorEl = modal.querySelector('#pin-modal-error');
    const submitBtn = modal.querySelector('#btn-pin-submit');
    const inputs = Array.from(modal.querySelectorAll('.pin-digit-input'));

    let step = 1; // 1: choose, 2: confirm
    let chosenPin = '';

    const focusInput = (index) => {
      inputs.forEach((inp, idx) => {
        inp.disabled = idx !== index;
      });
      if (inputs[index]) {
        inputs[index].focus();
      }
    };

    inputs.forEach((inp, idx) => {
      // Glow style on focus
      inp.addEventListener('focus', () => {
        inp.style.borderColor = '#ff7a00';
        inp.style.boxShadow = '0 0 10px rgba(255, 122, 0, 0.3)';
        inp.style.background = 'rgba(255, 122, 0, 0.05)';
      });
      inp.addEventListener('blur', () => {
        inp.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        inp.style.boxShadow = 'none';
        inp.style.background = 'rgba(255, 255, 255, 0.03)';
      });

      inp.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        inp.value = val;
        
        if (val) {
          if (idx < 5) {
            focusInput(idx + 1);
          } else {
            // Reached last input
            inp.blur();
            submitBtn.style.opacity = '1';
            submitBtn.style.pointerEvents = 'auto';
            submitBtn.focus();
          }
        }
        checkSubmitState();
      });

      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!inp.value && idx > 0) {
            inputs[idx - 1].value = '';
            focusInput(idx - 1);
          } else {
            inp.value = '';
          }
          checkSubmitState();
        }
      });
    });

    const checkSubmitState = () => {
      const allFilled = inputs.every(inp => inp.value !== '');
      if (allFilled) {
        submitBtn.style.opacity = '1';
        submitBtn.style.pointerEvents = 'auto';
      } else {
        submitBtn.style.opacity = '0.5';
        submitBtn.style.pointerEvents = 'none';
      }
    };

    // Auto-focus first input
    focusInput(0);

    submitBtn.addEventListener('click', async () => {
      const pinVal = inputs.map(inp => inp.value).join('');
      if (pinVal.length !== 6) return;

      errorEl.textContent = '';

      if (step === 1) {
        chosenPin = pinVal;
        step = 2;
        
        // Reset inputs
        inputs.forEach(inp => inp.value = '');
        titleEl.textContent = 'Confirm UPI PIN';
        subtitleEl.textContent = 'Re-enter your 6-digit PIN to confirm';
        submitBtn.querySelector('span').textContent = 'Confirm & Save';
        checkSubmitState();
        focusInput(0);
      } else {
        if (pinVal !== chosenPin) {
          errorEl.textContent = 'PINs do not match. Please start again.';
          step = 1;
          chosenPin = '';
          inputs.forEach(inp => inp.value = '');
          titleEl.textContent = 'Set UPI PIN';
          subtitleEl.textContent = 'Choose a secure 6-digit PIN to authorize payments';
          submitBtn.querySelector('span').textContent = 'Continue';
          checkSubmitState();
          focusInput(0);
          return;
        }

        // Call set-pin API
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.querySelector('span').textContent = 'Saving...';
        
        try {
          const res = await apiFetch('/users/set-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pinVal })
          });
          
          if (res && res.message) {
            showToast('UPI PIN set successfully!', 'success');
            if (store.user) {
              store.user.hasUpiPin = true;
              localStorage.setItem('ewallet_user', JSON.stringify(store.user));
            }
            
            // Slide down and remove
            modal.style.transform = 'translateY(100%)';
            setTimeout(() => {
              overlay.remove();
              resolve(true);
            }, 300);
          } else {
            throw new Error('Failed to set PIN');
          }
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.querySelector('span').textContent = 'Confirm & Save';
          errorEl.textContent = err.message || 'Server error. Please try again.';
        }
      }
    });
  });
}

export function showVerifyPinModal() {
  return new Promise((resolve, reject) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'verify-pin-overlay';
    overlay.className = 'bottom-sheet-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(4, 4, 6, 0.85); display: flex; align-items: flex-end;
      justify-content: center; z-index: 999999;
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'bottom-sheet-modal verify-pin-modal';
    modal.style.cssText = `
      background: #0d0e12; border-top: 3px solid #ff7a00;
      width: 100%; max-width: 480px; border-radius: 24px 24px 0 0;
      padding: 32px 24px calc(32px + env(safe-area-inset-bottom, 12px)); box-sizing: border-box;
      box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
      transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column; align-items: center; text-align: center;
      position: relative; max-height: 90vh; overflow-y: auto;
    `;

    // Contents
    modal.innerHTML = `
      <button id="btn-pin-cancel-top" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: var(--muted); font-size: 20px; cursor: pointer; padding: 4px;">✕</button>
      <div style="font-size: 40px; margin-bottom: 16px;">🔑</div>
      <h3 style="margin: 0 0 8px; color: #fff; font-size: 20px; font-weight: 800;">Enter UPI PIN</h3>
      <p style="margin: 0 0 24px; color: var(--muted); font-size: 13.5px;">Enter your 6-digit PIN to authorize this payment</p>
      
      <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 24px;">
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input-verify" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input-verify" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input-verify" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input-verify" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input-verify" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="pin-digit-input-verify" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
      </div>

      <div style="display: flex; gap: 12px; width: 100%;">
        <button id="btn-pin-cancel" class="cancel-btn" style="flex: 1; padding: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-weight: 700; cursor: pointer;">Cancel</button>
        <button id="btn-pin-confirm" class="pay-now-btn" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; opacity: 0.5; pointer-events: none;">
          <span>Submit</span>
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Trigger slide up
    setTimeout(() => {
      modal.style.transform = 'translateY(0)';
    }, 10);

    const submitBtn = modal.querySelector('#btn-pin-confirm');
    const cancelBtn = modal.querySelector('#btn-pin-cancel');
    const cancelTopBtn = modal.querySelector('#btn-pin-cancel-top');
    const inputs = Array.from(modal.querySelectorAll('.pin-digit-input-verify'));

    const handleDismiss = () => {
      modal.style.transform = 'translateY(100%)';
      setTimeout(() => {
        overlay.remove();
        reject(new Error('User cancelled PIN verification'));
      }, 300);
    };

    cancelBtn.addEventListener('click', handleDismiss);
    cancelTopBtn.addEventListener('click', handleDismiss);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleDismiss();
    });

    const focusInput = (index) => {
      inputs.forEach((inp, idx) => {
        inp.disabled = idx !== index;
      });
      if (inputs[index]) {
        inputs[index].focus();
      }
    };

    inputs.forEach((inp, idx) => {
      // Glow style on focus
      inp.addEventListener('focus', () => {
        inp.style.borderColor = '#ff7a00';
        inp.style.boxShadow = '0 0 10px rgba(255, 122, 0, 0.3)';
        inp.style.background = 'rgba(255, 122, 0, 0.05)';
      });
      inp.addEventListener('blur', () => {
        inp.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        inp.style.boxShadow = 'none';
        inp.style.background = 'rgba(255, 255, 255, 0.03)';
      });

      inp.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        inp.value = val;
        
        if (val) {
          if (idx < 5) {
            focusInput(idx + 1);
          } else {
            // Reached last input
            inp.blur();
            submitBtn.style.opacity = '1';
            submitBtn.style.pointerEvents = 'auto';
            submitBtn.focus();
            
            // Auto submit like standard UPI flow
            setTimeout(() => {
              submitBtn.click();
            }, 100);
          }
        }
        checkSubmitState();
      });

      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!inp.value && idx > 0) {
            inputs[idx - 1].value = '';
            focusInput(idx - 1);
          } else {
            inp.value = '';
          }
          checkSubmitState();
        }
      });
    });

    const checkSubmitState = () => {
      const allFilled = inputs.every(inp => inp.value !== '');
      if (allFilled) {
        submitBtn.style.opacity = '1';
        submitBtn.style.pointerEvents = 'auto';
      } else {
        submitBtn.style.opacity = '0.5';
        submitBtn.style.pointerEvents = 'none';
      }
    };

    // Auto-focus first input
    focusInput(0);

    submitBtn.addEventListener('click', () => {
      const pinVal = inputs.map(inp => inp.value).join('');
      if (pinVal.length !== 6) return;

      // Disable cancel / buttons during verification
      if (cancelBtn) cancelBtn.disabled = true;
      if (cancelTopBtn) cancelTopBtn.disabled = true;
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.5';
      submitBtn.querySelector('span').textContent = 'Verifying...';

      // Insert verification progress overlay inside the modal card
      const progressOverlay = document.createElement('div');
      progressOverlay.style.cssText = `
        position: absolute; inset: 0; background: #0d0e12;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; border-radius: 24px 24px 0 0;
        z-index: 10; padding: 24px; text-align: center;
      `;
      progressOverlay.innerHTML = `
        <div class="spinner" style="width: 48px; height: 48px; border: 4px solid rgba(255,122,0,0.15); border-top-color: #ff7a00; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
        <h4 style="margin: 0 0 8px; color: #fff; font-size: 18px; font-weight: 700;">Verification in Progress</h4>
        <p style="margin: 0; color: var(--muted); font-size: 13px;">Authorizing payment session securely...</p>
        <style>
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      `;
      modal.appendChild(progressOverlay);

      // Short delay to let the user see the premium authorization transition, then resolve and slide down
      setTimeout(() => {
        modal.style.transform = 'translateY(100%)';
        setTimeout(() => {
          overlay.remove();
          resolve(pinVal);
        }, 300);
      }, 1200);
    });
  });
}

export function showChangePinModal() {
  return new Promise((resolve, reject) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'change-pin-overlay';
    overlay.className = 'bottom-sheet-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(4, 4, 6, 0.85); display: flex; align-items: flex-end;
      justify-content: center; z-index: 999999;
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'bottom-sheet-modal change-pin-modal';
    modal.style.cssText = `
      background: #0d0e12; border-top: 3px solid #ff7a00;
      width: 100%; max-width: 480px; border-radius: 24px 24px 0 0;
      padding: 32px 24px calc(32px + env(safe-area-inset-bottom, 12px)); box-sizing: border-box;
      box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
      transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column; align-items: center; text-align: center;
      position: relative; max-height: 90vh; overflow-y: auto;
    `;

    // Contents
    modal.innerHTML = `
      <button id="btn-change-pin-cancel-top" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: var(--muted); font-size: 20px; cursor: pointer; padding: 4px;">✕</button>
      <div style="font-size: 40px; margin-bottom: 16px;">🔐</div>
      <h3 id="change-pin-title" style="margin: 0 0 8px; color: #fff; font-size: 20px; font-weight: 800;">Change UPI PIN</h3>
      <p id="change-pin-subtitle" style="margin: 0 0 24px; color: var(--muted); font-size: 13.5px;">Enter your current 6-digit UPI PIN</p>
      
      <div style="display: flex; gap: 8px; justify-content: center; margin-bottom: 24px;">
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="change-pin-digit" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="change-pin-digit" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="change-pin-digit" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="change-pin-digit" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="change-pin-digit" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
        <input type="password" inputmode="numeric" pattern="[0-9]*" maxlength="1" class="change-pin-digit" style="width: 46px; height: 52px; text-align: center; font-size: 24px; font-weight: 800; border: 2px solid rgba(255,255,255,0.12); border-radius: 12px; background: rgba(255,255,255,0.03); color: #fff; outline: none; transition: all 0.2s;" disabled />
      </div>

      <div id="change-pin-error" style="color: #ff5c6c; font-size: 13px; font-weight: 600; min-height: 18px; margin-bottom: 16px;"></div>

      <div style="display: flex; gap: 12px; width: 100%;">
        <button id="btn-change-pin-cancel" class="cancel-btn" style="flex: 1; padding: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-weight: 700; cursor: pointer;">Cancel</button>
        <button id="btn-change-pin-submit" class="pay-now-btn" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; opacity: 0.5; pointer-events: none;">
          <span>Continue</span>
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Trigger slide up
    setTimeout(() => {
      modal.style.transform = 'translateY(0)';
    }, 10);

    const titleEl = modal.querySelector('#change-pin-title');
    const subtitleEl = modal.querySelector('#change-pin-subtitle');
    const errorEl = modal.querySelector('#change-pin-error');
    const submitBtn = modal.querySelector('#btn-change-pin-submit');
    const cancelBtn = modal.querySelector('#btn-change-pin-cancel');
    const cancelTopBtn = modal.querySelector('#btn-change-pin-cancel-top');
    const inputs = Array.from(modal.querySelectorAll('.change-pin-digit'));

    let step = 1; // 1: enter current, 2: enter new, 3: confirm new
    let currentPinVal = '';
    let newPinVal = '';

    const handleDismiss = () => {
      modal.style.transform = 'translateY(100%)';
      setTimeout(() => {
        overlay.remove();
        reject(new Error('User cancelled PIN change'));
      }, 300);
    };

    cancelBtn.addEventListener('click', handleDismiss);
    cancelTopBtn.addEventListener('click', handleDismiss);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleDismiss();
    });

    const focusInput = (index) => {
      inputs.forEach((inp, idx) => {
        inp.disabled = idx !== index;
      });
      if (inputs[index]) {
        inputs[index].focus();
      }
    };

    inputs.forEach((inp, idx) => {
      inp.addEventListener('focus', () => {
        inp.style.borderColor = '#ff7a00';
        inp.style.boxShadow = '0 0 10px rgba(255, 122, 0, 0.3)';
        inp.style.background = 'rgba(255, 122, 0, 0.05)';
      });
      inp.addEventListener('blur', () => {
        inp.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        inp.style.boxShadow = 'none';
        inp.style.background = 'rgba(255, 255, 255, 0.03)';
      });

      inp.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        inp.value = val;
        
        if (val) {
          if (idx < 5) {
            focusInput(idx + 1);
          } else {
            inp.blur();
            submitBtn.style.opacity = '1';
            submitBtn.style.pointerEvents = 'auto';
            submitBtn.focus();
          }
        }
        checkSubmitState();
      });

      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!inp.value && idx > 0) {
            inputs[idx - 1].value = '';
            focusInput(idx - 1);
          } else {
            inp.value = '';
          }
          checkSubmitState();
        }
      });
    });

    const checkSubmitState = () => {
      const allFilled = inputs.every(inp => inp.value !== '');
      if (allFilled) {
        submitBtn.style.opacity = '1';
        submitBtn.style.pointerEvents = 'auto';
      } else {
        submitBtn.style.opacity = '0.5';
        submitBtn.style.pointerEvents = 'none';
      }
    };

    focusInput(0);

    submitBtn.addEventListener('click', async () => {
      const pinVal = inputs.map(inp => inp.value).join('');
      if (pinVal.length !== 6) return;

      errorEl.textContent = '';

      if (step === 1) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.querySelector('span').textContent = 'Verifying...';
        
        try {
          await apiFetch('/users/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: pinVal })
          });
          
          currentPinVal = pinVal;
          step = 2;
          inputs.forEach(inp => inp.value = '');
          titleEl.textContent = 'Enter New PIN';
          subtitleEl.textContent = 'Choose a new 6-digit UPI PIN';
          submitBtn.querySelector('span').textContent = 'Continue';
          submitBtn.disabled = false;
          checkSubmitState();
          focusInput(0);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.querySelector('span').textContent = 'Continue';
          errorEl.textContent = err.message || 'Current UPI PIN is incorrect';
          inputs.forEach(inp => inp.value = '');
          checkSubmitState();
          focusInput(0);
        }
      } else if (step === 2) {
        newPinVal = pinVal;
        step = 3;
        inputs.forEach(inp => inp.value = '');
        titleEl.textContent = 'Confirm New PIN';
        subtitleEl.textContent = 'Re-enter your new 6-digit PIN to confirm';
        submitBtn.querySelector('span').textContent = 'Confirm & Change';
        checkSubmitState();
        focusInput(0);
      } else {
        if (pinVal !== newPinVal) {
          errorEl.textContent = 'New PINs do not match. Please start again.';
          step = 2;
          newPinVal = '';
          inputs.forEach(inp => inp.value = '');
          titleEl.textContent = 'Enter New PIN';
          subtitleEl.textContent = 'Choose a new 6-digit UPI PIN';
          submitBtn.querySelector('span').textContent = 'Continue';
          checkSubmitState();
          focusInput(0);
          return;
        }

        // Call change-pin API
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
        submitBtn.querySelector('span').textContent = 'Updating...';
        
        try {
          const res = await apiFetch('/users/change-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPin: currentPinVal, newPin: newPinVal })
          });
          
          if (res && res.message) {
            showToast('UPI PIN changed successfully!', 'success');
            modal.style.transform = 'translateY(100%)';
            setTimeout(() => {
              overlay.remove();
              resolve(true);
            }, 300);
          } else {
            throw new Error('Failed to change PIN');
          }
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.querySelector('span').textContent = 'Confirm & Change';
          errorEl.textContent = err.message || 'Error changing PIN. Please try again.';
          
          // Reset to step 1
          step = 1;
          currentPinVal = '';
          newPinVal = '';
          inputs.forEach(inp => inp.value = '');
          titleEl.textContent = 'Change UPI PIN';
          subtitleEl.textContent = 'Enter your current 6-digit UPI PIN';
          submitBtn.querySelector('span').textContent = 'Continue';
          checkSubmitState();
          focusInput(0);
        }
      }
    });
  });
}

export function showEditProfileModal() {
  return new Promise((resolve) => {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'edit-profile-overlay';
    overlay.className = 'bottom-sheet-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(4, 4, 6, 0.85); display: flex; align-items: flex-end;
      justify-content: center; z-index: 999999;
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'bottom-sheet-modal edit-profile-modal';
    modal.style.cssText = `
      background: #0d0e12; border-top: 3px solid #00a2ff;
      width: 100%; max-width: 480px; border-radius: 24px 24px 0 0;
      padding: 32px 24px calc(32px + env(safe-area-inset-bottom, 12px)); box-sizing: border-box;
      box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
      transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column; align-items: center; text-align: center;
      position: relative; max-height: 90vh; overflow-y: auto;
    `;

    // Contents
    modal.innerHTML = `
      <button id="btn-edit-profile-cancel-top" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: var(--muted); font-size: 20px; cursor: pointer; padding: 4px;">✕</button>
      <div style="font-size: 40px; margin-bottom: 16px;">👤</div>
      <h3 style="margin: 0 0 8px; color: #fff; font-size: 20px; font-weight: 800;">Edit Profile</h3>
      <p style="margin: 0 0 24px; color: var(--muted); font-size: 13.5px;">Update your account personal name</p>
      
      <div style="width: 100%; text-align: left; margin-bottom: 24px;">
        <label style="display: block; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px;">Full Name</label>
        <input type="text" id="edit-profile-name-input" class="input" style="width: 100%; margin-bottom: 0;" />
        <div id="edit-profile-error" style="color: #ff5c6c; font-size: 13px; font-weight: 600; min-height: 18px; margin-top: 8px;"></div>
      </div>

      <div style="display: flex; gap: 12px; width: 100%;">
        <button id="btn-edit-profile-cancel" class="cancel-btn" style="flex: 1; padding: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #fff; font-weight: 700; cursor: pointer;">Cancel</button>
        <button id="btn-edit-profile-submit" class="pay-now-btn" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; background: #00a2ff; border: none; opacity: 1; pointer-events: auto;">
          <span>Save Changes</span>
        </button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Trigger slide up
    setTimeout(() => {
      modal.style.transform = 'translateY(0)';
    }, 10);

    const nameInput = modal.querySelector('#edit-profile-name-input');
    const submitBtn = modal.querySelector('#btn-edit-profile-submit');
    const cancelBtn = modal.querySelector('#btn-edit-profile-cancel');
    const cancelTopBtn = modal.querySelector('#btn-edit-profile-cancel-top');
    const errorEl = modal.querySelector('#edit-profile-error');

    if (store.user && store.user.name) {
      nameInput.value = store.user.name;
    }
    
    // Focus only if desktop screen width
    const isMobileScreen = window.innerWidth <= 850;
    if (!isMobileScreen) {
      nameInput.focus();
    }

    const handleDismiss = () => {
      modal.style.transform = 'translateY(100%)';
      setTimeout(() => {
        overlay.remove();
        resolve(false);
      }, 300);
    };

    cancelBtn.addEventListener('click', handleDismiss);
    cancelTopBtn.addEventListener('click', handleDismiss);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleDismiss();
    });

    submitBtn.addEventListener('click', async () => {
      const newName = nameInput.value.trim();
      if (!newName) {
        errorEl.textContent = 'Name cannot be empty';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.5';
      submitBtn.querySelector('span').textContent = 'Saving...';

      try {
        const res = await apiFetch('/users/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        });

        if (res && res.user) {
          store.user = res.user;
          localStorage.setItem('ewallet_user', JSON.stringify(store.user));
          if (window.__onAuthChange) window.__onAuthChange();
          showToast('Profile updated successfully!', 'success');
          
          modal.style.transform = 'translateY(100%)';
          setTimeout(() => {
            overlay.remove();
            resolve(true);
          }, 300);
        } else {
          throw new Error('Failed to update profile');
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.querySelector('span').textContent = 'Save Changes';
        errorEl.textContent = err.message || 'Error updating profile. Please try again.';
      }
    });
  });
}


/* ═══════════════════════════════════════════════════════════════
   FEATURE 1 ── Smart Spending Insights
   Renders an animated financial health card on the dashboard.
   ═══════════════════════════════════════════════════════════════ */
export function renderSpendingInsights(txList, containerId = 'spending-insights-container') {
  const el = document.getElementById(containerId);
  if (!el || !txList || txList.length === 0) return;

  const userId = store.user?._id || store.user?.id;
  const userEmail = store.user?.email;

  // ── Calculate spending breakdown ──
  let totalSent = 0, totalReceived = 0, totalBills = 0;
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);
  const twoWeeksAgo = new Date(now - 14 * 86400000);
  let thisWeekSpent = 0, lastWeekSpent = 0;

  // Streak calculation
  const txDays = new Set();
  txList.forEach(tx => {
    const d = new Date(tx.createdAt);
    txDays.add(d.toDateString());
    const fromId = tx.from && typeof tx.from === 'object' ? tx.from._id : tx.from;
    const isSender = String(fromId) === String(userId);
    const isDebit = tx.type === 'bill' || (tx.type === 'send' && isSender);
    const isCredit = !isSender && tx.type === 'send';

    if (tx.type === 'bill') {
      totalBills += tx.amount;
      if (d >= weekAgo) thisWeekSpent += tx.amount;
      if (d >= twoWeeksAgo && d < weekAgo) lastWeekSpent += tx.amount;
    } else if (tx.type === 'send' && isSender) {
      totalSent += tx.amount;
      if (d >= weekAgo) thisWeekSpent += tx.amount;
      if (d >= twoWeeksAgo && d < weekAgo) lastWeekSpent += tx.amount;
    } else if (!isSender && (tx.type === 'send' || tx.type === 'topup' || tx.type === 'deposit')) {
      totalReceived += tx.amount;
    }
  });

  const total = totalSent + totalReceived + totalBills || 1;
  const sentPct  = Math.round((totalSent  / total) * 100);
  const recvPct  = Math.round((totalReceived / total) * 100);
  const billsPct = Math.round((totalBills / total) * 100);

  // Week comparison
  const weekDiff = lastWeekSpent > 0
    ? Math.round(((thisWeekSpent - lastWeekSpent) / lastWeekSpent) * 100)
    : null;
  const weekLabel = weekDiff === null ? 'First week of data'
    : weekDiff > 0 ? `↑ ${weekDiff}% more spent this week`
    : weekDiff < 0 ? `↓ ${Math.abs(weekDiff)}% less spent this week`
    : '= Same as last week';
  const weekColor = weekDiff > 0 ? '#ff5c6c' : '#00d26a';

  // Streak
  let streak = 0;
  let d = new Date();
  d.setHours(0,0,0,0);
  while (txDays.has(d.toDateString())) {
    streak++;
    d = new Date(d - 86400000);
  }

  // Dominant category
  const dominant = totalSent >= totalBills && totalSent >= totalReceived ? { label: '📤 Transfers', color: '#ff7a00' }
    : totalBills >= totalReceived ? { label: '⚡ Bills', color: '#7c5cff' }
    : { label: '📥 Received', color: '#00d26a' };

  // Conic gradient for ring chart
  const s = sentPct, b = billsPct, r = 100 - s - b;
  const conicGrad = `conic-gradient(#ff7a00 0% ${s}%, #7c5cff ${s}% ${s + b}%, #00d26a ${s + b}% 100%)`;

  el.innerHTML = `
    <div class="insights-card" id="insights-card-inner">
      <div class="insights-header">
        <div>
          <div class="insights-title">💡 Spending Insights</div>
          <div class="insights-subtitle">${txList.length} transactions analysed</div>
        </div>
        <div class="insights-streak">
          🔥 <span class="insights-streak-num">${streak}</span>
          <span class="insights-streak-label">day streak</span>
        </div>
      </div>

      <div class="insights-body">
        <!-- Donut Chart & Overview Section -->
        <div class="insights-chart-section">
          <div class="insights-ring-wrap">
            <div class="insights-ring" style="background: ${conicGrad}">
              <div class="insights-ring-inner">
                <span class="insights-ring-title">Spent</span>
                <span class="insights-ring-value">${formatCurrency(totalSent + totalBills)}</span>
              </div>
            </div>
          </div>
          <div class="insights-quick-summary">
            <div class="insights-dominant-badge" style="background: ${dominant.color}15; color: ${dominant.color}">
              Dominant: ${dominant.label}
            </div>
            <div class="insights-week-compare" style="color: ${weekColor}">
              ${weekLabel}
            </div>
          </div>
        </div>

        <!-- Vertical Category Bars -->
        <div class="insights-categories-list">
          <!-- Sent Category -->
          <div class="insights-cat-row">
            <div class="insights-cat-info">
              <span class="insights-cat-dot" style="background: #ff7a00"></span>
              <span class="insights-cat-name">Sent</span>
            </div>
            <div class="insights-progress-wrapper">
              <div class="insights-progress-bar" style="width: ${sentPct}%; background: #ff7a00;"></div>
            </div>
            <div class="insights-cat-values">
              <span class="insights-cat-amount">${formatCurrency(totalSent)}</span>
              <span class="insights-cat-pct">${sentPct}%</span>
            </div>
          </div>

          <!-- Bills Category -->
          <div class="insights-cat-row">
            <div class="insights-cat-info">
              <span class="insights-cat-dot" style="background: #7c5cff"></span>
              <span class="insights-cat-name">Bills</span>
            </div>
            <div class="insights-progress-wrapper">
              <div class="insights-progress-bar" style="width: ${billsPct}%; background: #7c5cff;"></div>
            </div>
            <div class="insights-cat-values">
              <span class="insights-cat-amount">${formatCurrency(totalBills)}</span>
              <span class="insights-cat-pct">${billsPct}%</span>
            </div>
          </div>

          <!-- Received Category -->
          <div class="insights-cat-row">
            <div class="insights-cat-info">
              <span class="insights-cat-dot" style="background: #00d26a"></span>
              <span class="insights-cat-name">Received</span>
            </div>
            <div class="insights-progress-wrapper">
              <div class="insights-progress-bar" style="width: ${recvPct}%; background: #00d26a;"></div>
            </div>
            <div class="insights-cat-values">
              <span class="insights-cat-amount">${formatCurrency(totalReceived)}</span>
              <span class="insights-cat-pct">${recvPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}


/* ═══════════════════════════════════════════════════════════════
   FEATURE 2 ── Schedule a Payment
   Shows a modal to schedule a future/recurring transfer.
   ═══════════════════════════════════════════════════════════════ */
export function showSchedulePaymentModal(contact, color = '#ff7a00') {
  // Remove existing
  document.getElementById('schedule-modal-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'schedule-modal-overlay';
  overlay.className = 'bottom-sheet-overlay';

  const modal = document.createElement('div');
  modal.className = 'bottom-sheet-modal schedule-modal';

  const initial = String(contact.name || contact.email || '?').charAt(0).toUpperCase();
  const minDate = new Date(Date.now() + 60000).toISOString().slice(0, 16); // at least 1 min from now

  modal.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="width:38px;height:38px;border-radius:50%;background:${color}22;border:1.5px solid ${color};color:${color};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;">${initial}</div>
        <div>
          <div style="font-weight:700;color:#fff;font-size:15px;">Schedule Payment</div>
          <div style="font-size:11px;color:var(--muted);">${escapeHtml(contact.name || contact.email)}</div>
        </div>
      </div>
      <button id="sch-close" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;">&times;</button>
    </div>

    <!-- Type toggle -->
    <div class="sch-type-row">
      <button class="sch-type-btn active" id="sch-type-once">⏰ One-Time</button>
      <button class="sch-type-btn" id="sch-type-weekly">🔁 Weekly</button>
      <button class="sch-type-btn" id="sch-type-monthly">📅 Monthly</button>
    </div>

    <!-- Amount + Note -->
    <div style="display:flex;gap:10px;margin:16px 0 10px;">
      <input type="number" id="sch-amount" class="input" placeholder="Amount (₹)" style="flex:1;margin:0;" min="1" />
      <input type="text"   id="sch-note"   class="input" placeholder="Note (optional)" style="flex:1.5;margin:0;" />
    </div>

    <!-- Date/time picker (for one-time) -->
    <div id="sch-date-wrap" style="margin-bottom:10px;">
      <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;">SCHEDULE DATE & TIME</label>
      <input type="datetime-local" id="sch-datetime" class="input" style="margin:0;width:100%;" min="${minDate}" />
    </div>

    <!-- Day picker (for recurring) -->
    <div id="sch-day-wrap" style="display:none;margin-bottom:10px;">
      <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;">DAY OF WEEK / MONTH</label>
      <input type="number" id="sch-day" class="input" placeholder="e.g. 1 = Monday / 1st of month" style="margin:0;width:100%;" min="1" max="31" />
    </div>

    <div id="sch-error" style="color:#ff5c6c;font-size:12px;min-height:16px;margin-bottom:8px;"></div>

    <button class="btn primary" id="sch-submit" style="width:100%;padding:13px;font-weight:700;font-size:14px;">
      <span>Schedule Payment</span>
    </button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => { modal.style.transform = 'translateY(0)'; modal.style.opacity = '1'; });

  const errorEl  = modal.querySelector('#sch-error');
  const dateWrap = modal.querySelector('#sch-date-wrap');
  const dayWrap  = modal.querySelector('#sch-day-wrap');
  let scheduleType = 'once';

  // Close
  const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 250); };
  modal.querySelector('#sch-close').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Type toggle
  modal.querySelectorAll('.sch-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.sch-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      scheduleType = btn.id === 'sch-type-once' ? 'once' : btn.id === 'sch-type-weekly' ? 'weekly' : 'monthly';
      dateWrap.style.display = scheduleType === 'once'  ? 'block' : 'none';
      dayWrap.style.display  = scheduleType !== 'once' ? 'block' : 'none';
      modal.querySelector('#sch-day').placeholder = scheduleType === 'weekly'
        ? '1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat 7=Sun'
        : '1–31 (day of month)';
    });
  });

  // Submit
  modal.querySelector('#sch-submit').addEventListener('click', () => {
    const amount = Number(modal.querySelector('#sch-amount').value);
    const note   = modal.querySelector('#sch-note').value.trim();
    errorEl.textContent = '';

    if (!amount || amount <= 0) { errorEl.textContent = 'Enter a valid amount'; return; }

    let executeAt = null;
    let dayValue  = null;

    if (scheduleType === 'once') {
      const dtVal = modal.querySelector('#sch-datetime').value;
      if (!dtVal) { errorEl.textContent = 'Pick a date and time'; return; }
      executeAt = new Date(dtVal).toISOString();
      if (new Date(executeAt) <= new Date()) { errorEl.textContent = 'Pick a future date'; return; }
    } else {
      dayValue = Number(modal.querySelector('#sch-day').value);
      if (!dayValue || dayValue < 1) { errorEl.textContent = 'Enter a valid day'; return; }
      if (scheduleType === 'weekly' && dayValue > 7) { errorEl.textContent = '1–7 for weekly'; return; }
      if (scheduleType === 'monthly' && dayValue > 31) { errorEl.textContent = '1–31 for monthly'; return; }
    }

    // Persist to localStorage
    const userId = store.user?._id || store.user?.id || store.user?.email;
    const key = `payurupee_scheduled_${userId}`;
    const scheduled = JSON.parse(localStorage.getItem(key) || '[]');
    const entry = {
      id: Date.now().toString(),
      contactEmail: contact.email,
      contactName: contact.name || contact.email,
      amount,
      note,
      type: scheduleType,
      executeAt,
      dayValue,
      color,
      createdAt: new Date().toISOString(),
      lastExecuted: null
    };
    scheduled.push(entry);
    localStorage.setItem(key, JSON.stringify(scheduled));

    showToast(`Payment scheduled for ${contact.name || contact.email}`, 'ok');
    close();

    // Refresh upcoming payments card
    renderUpcomingPaymentsCard();
  });
}

/**
 * Check all scheduled payments and execute any that are due.
 * Called from the dashboard poll interval every 8s.
 */
export async function checkScheduledPayments() {
  if (!store.user) return;
  const userId = store.user?._id || store.user?.id || store.user?.email;
  const key = `payurupee_scheduled_${userId}`;
  const scheduled = JSON.parse(localStorage.getItem(key) || '[]');
  if (scheduled.length === 0) return;

  const now = new Date();
  let changed = false;

  for (const entry of scheduled) {
    let isDue = false;
    if (entry.type === 'once') {
      isDue = entry.executeAt && !entry.lastExecuted && new Date(entry.executeAt) <= now;
    } else if (entry.type === 'weekly') {
      // 1=Mon … 7=Sun, JS: 0=Sun…6=Sat
      const jsDay = now.getDay() || 7; // convert 0→7
      const todayStr = now.toDateString();
      isDue = jsDay === entry.dayValue && entry.lastExecuted !== todayStr;
    } else if (entry.type === 'monthly') {
      const todayStr = now.toDateString();
      isDue = now.getDate() === entry.dayValue && entry.lastExecuted !== todayStr;
    }

    if (!isDue) continue;

    try {
      const pin = store.user?.upiPin; // won't have pin here — skip auto if pin required
      // Execute via API
      const res = await apiFetch('/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: entry.contactEmail,
          amount: entry.amount,
          note: entry.note || 'Scheduled payment',
          upiPin: store._scheduledPin || ''
        })
      });
      changed = true;
      entry.lastExecuted = entry.type === 'once' ? 'done' : now.toDateString();
      showToast(`⏰ Scheduled payment of ${formatCurrency(entry.amount)} sent to ${entry.contactName}`, 'ok');

      // Fire notification
      const { addNotification } = await import('./notifications.js');
      addNotification(`⏰ Scheduled payment of ${formatCurrency(entry.amount)} sent to ${entry.contactName}`, 'info');
    } catch (err) {
      // If UPI pin needed, mark pending and notify user
      if (err.message && err.message.toLowerCase().includes('pin')) {
        showToast(`⏰ Scheduled payment to ${entry.contactName} needs your UPI PIN — pay manually`, 'err');
      }
    }
  }

  // Remove completed one-time entries
  const remaining = scheduled.filter(e => !(e.type === 'once' && e.lastExecuted === 'done'));
  if (changed || remaining.length !== scheduled.length) {
    localStorage.setItem(key, JSON.stringify(remaining));
    renderUpcomingPaymentsCard();
  }
}

/** Render the upcoming scheduled payments mini-card on the dashboard */
export function renderUpcomingPaymentsCard() {
  const el = document.getElementById('upcoming-payments-card');
  if (!el) return;
  const userId = store.user?._id || store.user?.id || store.user?.email;
  const key = `payurupee_scheduled_${userId}`;
  const scheduled = JSON.parse(localStorage.getItem(key) || '[]');

  if (scheduled.length === 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'block';

  const now = new Date();
  const rows = scheduled.map(e => {
    let whenStr = '';
    if (e.type === 'once') {
      const dt = new Date(e.executeAt);
      const diff = dt - now;
      if (diff > 0) {
        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        whenStr = hrs > 48 ? dt.toLocaleDateString() : hrs > 0 ? `in ${hrs}h ${mins}m` : `in ${mins}m`;
      } else { whenStr = 'Executing...'; }
    } else if (e.type === 'weekly') {
      const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      whenStr = `Every ${days[(e.dayValue - 1) % 7]}`;
    } else {
      whenStr = `Every ${e.dayValue}${e.dayValue === 1 ? 'st' : e.dayValue === 2 ? 'nd' : e.dayValue === 3 ? 'rd' : 'th'}`;
    }

    return `
      <div class="upcoming-payment-row">
        <div class="upcoming-payment-info">
          <div class="upcoming-payment-avatar" style="background:${e.color}22;border-color:${e.color};color:${e.color};">
            ${String(e.contactName || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="upcoming-payment-name">${escapeHtml(e.contactName)}</div>
            <div class="upcoming-payment-when">${whenStr}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="upcoming-payment-amount">${formatCurrency(e.amount)}</div>
          <button class="upcoming-cancel-btn" data-id="${e.id}" title="Cancel">✕</button>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div class="paytm-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h3 style="margin:0;">⏰ Upcoming Payments</h3>
        <span class="upcoming-count-badge">${scheduled.length}</span>
      </div>
      <div id="upcoming-payment-list">${rows}</div>
    </div>
  `;

  // Cancel buttons
  el.querySelectorAll('.upcoming-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const key2 = `payurupee_scheduled_${userId}`;
      const list = JSON.parse(localStorage.getItem(key2) || '[]').filter(e => e.id !== id);
      localStorage.setItem(key2, JSON.stringify(list));
      renderUpcomingPaymentsCard();
      showToast('Scheduled payment cancelled', 'ok');
    });
  });
}


/* ═══════════════════════════════════════════════════════════════
   FEATURE 3 ── Split Bill with Group
   Modal to split a total amount across multiple contacts.
   ═══════════════════════════════════════════════════════════════ */
export function showSplitBillModal(allContacts = []) {
  document.getElementById('split-bill-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'split-bill-overlay';
  overlay.className = 'bottom-sheet-overlay';

  const modal = document.createElement('div');
  modal.className = 'bottom-sheet-modal split-bill-modal';

  const colors = ['#ff7a00','#00a2ff','#00d26a','#7c5cff','#e60072','#ffbc00'];

  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
      <div>
        <div style="font-weight:800;color:#fff;font-size:18px;">🎯 Split Bill</div>
        <div style="font-size:12px;color:var(--muted);">Request money from multiple people at once</div>
      </div>
      <button id="split-close" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;">&times;</button>
    </div>

    <!-- Total amount + note -->
    <div style="display:flex;gap:10px;margin-bottom:14px;">
      <div style="flex:1;">
        <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;">TOTAL AMOUNT (₹)</label>
        <input type="number" id="split-total" class="input" placeholder="e.g. 1500" style="margin:0;width:100%;" min="1"/>
      </div>
      <div style="flex:1.5;">
        <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;">NOTE</label>
        <input type="text" id="split-note" class="input" placeholder="e.g. Dinner at La Piazza" style="margin:0;width:100%;"/>
      </div>
    </div>

    <!-- Split type -->
    <div class="sch-type-row" style="margin-bottom:14px;">
      <button class="sch-type-btn active" id="split-equal">⚖️ Equal Split</button>
      <button class="sch-type-btn" id="split-custom">✏️ Custom</button>
    </div>

    <!-- Contact picker -->
    <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:8px;">SELECT PEOPLE</label>
    <div id="split-contact-grid" class="split-contact-grid">
      ${allContacts.map((c, i) => {
        const init = String(c.name || c.email || '?').charAt(0).toUpperCase();
        const col = colors[i % colors.length];
        return `
          <div class="split-contact-chip" data-email="${escapeHtml(c.email)}" data-name="${escapeHtml(c.name || c.email)}" data-color="${col}">
            <div class="split-chip-avatar" style="background:${col}22;border-color:${col};color:${col};">${init}</div>
            <div class="split-chip-name">${escapeHtml(c.name ? c.name.split(' ')[0] : c.email.split('@')[0])}</div>
            <div class="split-chip-check">✓</div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Selected pills + per-person amount preview -->
    <div id="split-selected-area" style="margin-top:14px;"></div>

    <div id="split-error" style="color:#ff5c6c;font-size:12px;min-height:16px;margin:8px 0;"></div>

    <button class="btn primary" id="split-submit" style="width:100%;padding:13px;font-weight:700;font-size:14px;margin-top:4px;">
      <span>Send Requests</span>
    </button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { modal.style.transform = 'translateY(0)'; modal.style.opacity = '1'; });

  const errorEl = modal.querySelector('#split-error');
  let selectedEmails = new Set();
  let customAmounts  = {}; // email -> amount
  let isCustom = false;

  const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 250); };
  modal.querySelector('#split-close').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  // Split type toggle
  modal.querySelector('#split-equal').addEventListener('click', () => {
    modal.querySelector('#split-equal').classList.add('active');
    modal.querySelector('#split-custom').classList.remove('active');
    isCustom = false;
    updateSelectedArea();
  });
  modal.querySelector('#split-custom').addEventListener('click', () => {
    modal.querySelector('#split-custom').classList.add('active');
    modal.querySelector('#split-equal').classList.remove('active');
    isCustom = true;
    updateSelectedArea();
  });

  // Contact chip toggle
  modal.querySelectorAll('.split-contact-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const email = chip.dataset.email;
      if (selectedEmails.has(email)) {
        selectedEmails.delete(email);
        chip.classList.remove('selected');
      } else {
        selectedEmails.add(email);
        chip.classList.add('selected');
      }
      updateSelectedArea();
    });
  });

  function getPerPerson() {
    const total = Number(modal.querySelector('#split-total').value) || 0;
    const count = selectedEmails.size;
    return count > 0 ? Math.round((total / count) * 100) / 100 : 0;
  }

  function updateSelectedArea() {
    const area = modal.querySelector('#split-selected-area');
    const total = Number(modal.querySelector('#split-total').value) || 0;
    const perPerson = getPerPerson();
    const contacts = allContacts.filter(c => selectedEmails.has(c.email));

    if (contacts.length === 0) {
      area.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;">Select at least one person</div>';
      return;
    }

    const pillsHtml = contacts.map(c => {
      const col = colors[allContacts.indexOf(c) % colors.length];
      const amt = isCustom ? (customAmounts[c.email] || '') : perPerson;
      return `
        <div class="split-selected-pill">
          <span class="split-pill-dot" style="background:${col};"></span>
          <span class="split-pill-name">${escapeHtml(c.name ? c.name.split(' ')[0] : c.email.split('@')[0])}</span>
          ${isCustom
            ? `<input type="number" class="split-custom-input" data-email="${c.email}" placeholder="₹" value="${customAmounts[c.email] || ''}" min="1" />`
            : `<span class="split-pill-amount">${formatCurrency(perPerson)}</span>`
          }
          <button class="split-pill-remove" data-email="${c.email}">✕</button>
        </div>
      `;
    }).join('');

    area.innerHTML = `
      <div class="split-pills-wrap">${pillsHtml}</div>
      ${!isCustom && total > 0 ? `<div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center;">Each person owes <strong style="color:#fff;">${formatCurrency(perPerson)}</strong></div>` : ''}
    `;

    // Custom amount inputs
    area.querySelectorAll('.split-custom-input').forEach(inp => {
      inp.addEventListener('input', () => {
        customAmounts[inp.dataset.email] = Number(inp.value);
      });
    });

    // Remove pills
    area.querySelectorAll('.split-pill-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.dataset.email;
        selectedEmails.delete(email);
        modal.querySelectorAll(`.split-contact-chip[data-email="${email}"]`).forEach(c => c.classList.remove('selected'));
        delete customAmounts[email];
        updateSelectedArea();
      });
    });
  }

  // Re-compute when amount changes
  modal.querySelector('#split-total').addEventListener('input', updateSelectedArea);

  // Submit
  modal.querySelector('#split-submit').addEventListener('click', async () => {
    errorEl.textContent = '';
    const total = Number(modal.querySelector('#split-total').value);
    const note  = modal.querySelector('#split-note').value.trim();

    if (!total || total <= 0) { errorEl.textContent = 'Enter a total amount'; return; }
    if (selectedEmails.size === 0) { errorEl.textContent = 'Select at least one person'; return; }

    const btn = modal.querySelector('#split-submit');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Sending requests…';

    try {
      const recipients = [...selectedEmails];
      const splitAmounts = {};

      if (isCustom) {
        let customTotal = 0;
        for (const email of recipients) {
          const amt = Number(customAmounts[email] || 0);
          if (!amt) { errorEl.textContent = `Enter amount for ${email}`; btn.disabled = false; btn.querySelector('span').textContent = 'Send Requests'; return; }
          splitAmounts[email] = amt;
          customTotal += amt;
        }
      } else {
        const pp = Math.round((total / recipients.length) * 100) / 100;
        recipients.forEach(e => splitAmounts[e] = pp);
      }

      // Send one bulk request per unique amount (group by amount)
      // For simplicity, send each as individual
      let successCount = 0;
      for (const email of recipients) {
        const perAmt = isCustom ? splitAmounts[email] : Math.round((total / recipients.length) * 100) / 100;
        const contactName = allContacts.find(c => c.email === email)?.name || email;
        const msgText = note ? `Split: ${note} — your share` : `Split bill — your share`;

        try {
          await apiFetch('/chat/send-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipients: [email],
              text: msgText,
              amount: perAmt
            })
          });
          successCount++;
        } catch (e) { /* silent per-contact */ }
      }

      close();
      showToast(`💸 Split request sent to ${successCount} ${successCount === 1 ? 'person' : 'people'}!`, 'ok');
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to send requests';
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Send Requests';
    }
  });
}

