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
  modal.style.maxWidth = '360px';
  modal.style.textAlign = 'center';
  
  modal.innerHTML = `
    <div class="header">
      <h3>My UPI QR Code</h3>
      <button class="close" id="my-qr-close">✕</button>
    </div>
    
    <div class="qr-modal-body">
      <div class="qr-user-details">
        <div class="qr-user-name">${escapeHtml(store.user.name)}</div>
        <div class="qr-user-upi">UPI ID: ${escapeHtml(store.user.email)}</div>
      </div>
      
      <div class="qr-card">
        <div class="qr-card-brand">PayU₹upee</div>
        <div class="qr-code-frame">
          <img id="my-qr-image" src="" alt="UPI QR Code" />
        </div>
        <div class="qr-card-footer">Scan & Pay Securely</div>
      </div>
      
      <div class="qr-amount-selector">
        <label class="qr-label">Request Specific Amount (Optional)</label>
        <input type="number" id="my-qr-amount" class="input" placeholder="Enter amount to receive (e.g. 500)" />
      </div>
    </div>
    
    <div class="qr-actions">
      <button class="btn solid-blue" id="my-qr-download">Download QR Code</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  const qrImg = modal.querySelector('#my-qr-image');
  const amtInput = modal.querySelector('#my-qr-amount');
  
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
  modal.querySelector('#my-qr-download').addEventListener('click', async () => {
    try {
      const response = await fetch(qrImg.src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payurupee-qr-${store.user.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download QR code image', err);
      // Fallback: Open in new tab
      window.open(qrImg.src, '_blank');
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
    <div style="display:flex; gap:12px; margin-bottom:16px;">
      <button class="btn primary" id="drawer-btn-send" style="flex:1; padding:10px; font-weight:700; border-radius:10px; font-size:13px;">Send Money</button>
      <button class="btn ghost" id="drawer-btn-request" style="flex:1; padding:10px; font-weight:700; border-radius:10px; border-color:rgba(255,255,255,0.08); color:#fff; font-size:13px;">Request</button>
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

  const msgInput = drawer.querySelector('#drawer-msg-input');
  if (msgInput) msgInput.focus();

  const closeBtn = drawer.querySelector('#drawer-close');
  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  const sendPanel = drawer.querySelector('#drawer-send-panel');
  const reqPanel = drawer.querySelector('#drawer-request-panel');
  const btnSend = drawer.querySelector('#drawer-btn-send');
  const btnRequest = drawer.querySelector('#drawer-btn-request');

  btnSend.addEventListener('click', () => {
    reqPanel.style.display = 'none';
    sendPanel.style.display = sendPanel.style.display === 'none' ? 'block' : 'none';
    if (sendPanel.style.display === 'block') {
      drawer.querySelector('#drawer-send-amount').focus();
    }
  });

  btnRequest.addEventListener('click', () => {
    sendPanel.style.display = 'none';
    reqPanel.style.display = reqPanel.style.display === 'none' ? 'block' : 'none';
    if (reqPanel.style.display === 'block') {
      drawer.querySelector('#drawer-req-amount').focus();
    }
  });

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

    payBtn.disabled = true;
    payBtn.textContent = 'Paying...';

    try {
      const result = await apiFetch('/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toEmail: contact.email, amount, note })
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
  submitReqBtn.addEventListener('click', () => {
    const amtInput = drawer.querySelector('#drawer-req-amount');
    const amount = Number(amtInput.value);
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }

    const msg = `Requested ₹${amount.toFixed(2)}`;
    saveLocalMessage(msg, true);
    
    amtInput.value = '';
    reqPanel.style.display = 'none';
    showToast(`Request of ₹${amount.toFixed(2)} sent to ${contact.name || contact.email}`, 'success');
    loadChatHistory();
  });

  const msgSendBtn = drawer.querySelector('#drawer-btn-send-msg');
  msgSendBtn.addEventListener('click', () => {
    const text = msgInput.value.trim();
    if (!text) return;
    
    saveLocalMessage(text, false);
    msgInput.value = '';
    loadChatHistory();
  });

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      msgSendBtn.click();
    }
  });

  const msgKey = `chat_msg_${store.user._id}_${contact.email}`;
  function saveLocalMessage(text, isRequest = false) {
    const history = JSON.parse(localStorage.getItem(msgKey) || '[]');
    history.push({
      id: 'msg_' + Date.now(),
      text,
      isRequest,
      sender: store.user.email,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem(msgKey, JSON.stringify(history));
  }

  const chatListEl = drawer.querySelector('#drawer-chat-list');
  async function loadChatHistory() {
    chatListEl.innerHTML = '<div class="smallmuted" style="text-align:center; padding:12px;">Loading activity...</div>';
    
    try {
      const txRes = await apiFetch('/wallet/history');
      const allTx = txRes.data || [];
      const matchedTx = allTx.filter(tx => {
        const toEmail = tx.to?.email || tx.meta?.toEmail || tx.meta?.recipientEmail;
        const fromEmail = tx.from?.email;
        return toEmail === contact.email || fromEmail === contact.email;
      });

      const stashedMsgs = JSON.parse(localStorage.getItem(msgKey) || '[]');

      const timeline = [];
      matchedTx.forEach(tx => {
        timeline.push({
          type: 'tx',
          date: new Date(tx.createdAt),
          data: tx
        });
      });
      stashedMsgs.forEach(msg => {
        timeline.push({
          type: 'msg',
          date: new Date(msg.timestamp),
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
            <div style="font-size:9.5px; color:var(--muted); text-align:right; margin-top:4px;">${dateStr}</div>
          `;
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
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(4, 4, 6, 0.9); display: flex; align-items: flex-end;
      justify-content: center; z-index: 99999;
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #0d0e12; border-top: 3px solid #ff7a00;
      width: 100%; max-width: 480px; border-radius: 24px 24px 0 0;
      padding: 32px 24px; box-sizing: border-box;
      box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
      transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column; align-items: center; text-align: center;
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
            body: JSON.stringify({ pin: pinVal })
          });
          
          if (res && res.message) {
            showToast('UPI PIN set successfully!', 'success');
            if (store.user) store.user.hasUpiPin = true;
            
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
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(4, 4, 6, 0.85); display: flex; align-items: flex-end;
      justify-content: center; z-index: 99999;
    `;

    // Create modal container
    const modal = document.createElement('div');
    modal.style.cssText = `
      background: #0d0e12; border-top: 3px solid #ff7a00;
      width: 100%; max-width: 480px; border-radius: 24px 24px 0 0;
      padding: 32px 24px; box-sizing: border-box;
      box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
      transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      display: flex; flex-direction: column; align-items: center; text-align: center;
      position: relative;
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

      modal.style.transform = 'translateY(100%)';
      setTimeout(() => {
        overlay.remove();
        resolve(pinVal);
      }, 300);
    });
  });
}


