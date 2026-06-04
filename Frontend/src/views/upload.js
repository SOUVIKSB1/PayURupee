import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, parseQrPayload } from '../utils.js';

export function renderUpload() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card upload fade-in" style="max-width:640px;margin:12px auto">
      <h2>Upload QR</h2>
      <p class="smallmuted">Upload a QR image from your device</p>
      <form id="form-qr" style="margin-top:12px">
        <input type="file" name="qr" accept="image/*" class="input" />
        <div style="margin-top:10px;display:flex;gap:8px">
          <button class="btn" type="submit">Upload</button>
          <button type="button" class="btn ghost" id="qr-back">Back</button>
        </div>
        <div id="qr-msg" style="margin-top:8px"></div>
      </form>
    </div>
  `;
  
  document.getElementById('qr-back').addEventListener('click', () => goto('dashboard'));
  document.getElementById('form-qr').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = e.target.qr;
    const msg = document.getElementById('qr-msg');
    if (!fileInput.files || fileInput.files.length === 0) {
      msg.textContent = 'Choose an image file';
      msg.className = 'err';
      return;
    }
    const file = fileInput.files[0];
    msg.innerHTML = '<span class="spinner"></span>Reading image...';
    msg.className = '';
    
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result);
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = dataUrl;
      });
      
      const maxDim = 1600;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        const scale = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      const qr = window.jsQR ? jsQR(imageData.data, w, h) : null;
      if (!qr || !qr.data) {
        msg.textContent = 'No QR code detected in image (client-side)';
        msg.className = 'err';
        return;
      }
      const raw = qr.data;
      msg.innerHTML = '<span class="spinner"></span>QR detected — previewing...';
      msg.className = 'ok';
      
      const parsed = parseQrPayload(raw);
      try {
        msg.innerHTML = '';
      } catch (_) {}
      
      showQrPreview(parsed || {}, file, raw, dataUrl);
    } catch (err) {
      console.error('QR client decode error', err);
      msg.textContent = 'Failed to read or decode image';
      msg.className = 'err';
    }
  });
}

function showQrPreview(parsed, file, raw, dataUrl) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="header"><h3>QR Preview</h3><button class="close" id="qr-close">✕</button></div>
    <div style="display:block;gap:12px;align-items:center">
      <div>
        <div class="row"><div class="label">Name</div><div class="value">${escapeHtml(parsed.name || '—')}</div></div>
        <div class="row"><div class="label">Email / UPI</div><div class="value">${escapeHtml(parsed.email || '—')}</div></div>
        <div class="row"><div class="label">Amount</div><div class="value">${escapeHtml(parsed.amount || '—')}</div></div>
        <div class="row"><div class="label">Raw</div><div class="value smallmuted">${escapeHtml(String(raw || '—')).slice(0, 200)}</div></div>
      </div>
    </div>
    <div class="actions">
      <button class="btn" id="qr-accept">Accept</button>
      <button class="btn ghost" id="qr-edit">Edit</button>
      <button class="btn ghost" id="qr-cancel">Cancel</button>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function cleanup() {
    try {
      overlay.remove();
    } catch (_) {}
  }

  document.getElementById('qr-cancel').addEventListener('click', () => {
    cleanup();
    const msg = document.getElementById('qr-msg');
    if (msg) msg.textContent = 'QR preview canceled';
  });

  document.getElementById('qr-close').addEventListener('click', () => {
    cleanup();
  });

  document.getElementById('qr-accept').addEventListener('click', async () => {
    const btn = document.getElementById('qr-accept');
    const msgEl = document.createElement('div');
    msgEl.style.marginTop = '10px';
    modal.appendChild(msgEl);
    btn.disabled = true;
    
    try {
      if (parsed.email && parsed.amount) {
        msgEl.innerHTML = '<span class="spinner"></span>Sending payment...';
        const toEmail = parsed.email;
        const amount = Number(parsed.amount);
        const note = parsed.name ? `Payment for ${parsed.name}` : '';
        
        await apiFetch('/wallet/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ toEmail, amount, note })
        });

        msgEl.innerHTML = '';
        const successWrap = document.createElement('div');
        successWrap.className = 'checkmark-wrapper';
        successWrap.innerHTML = `<div class="checkmark"><svg viewBox="0 0 52 52" aria-hidden="true"><circle class="circle" cx="26" cy="26" r="24"></circle><path class="tick" d="M14 27l7 7 17-17"/></svg></div><div class="modal success-msg">Payment sent</div>`;
        modal.appendChild(successWrap);
        
        msgEl.textContent = 'Saving QR...';
        if (file) {
          const fd = new FormData();
          fd.append('qr', file);
          try {
            await apiFetch('/users/upload-qr', { method: 'POST', body: fd });
            msgEl.textContent = 'Payment sent and QR saved';
          } catch (uerr) {
            console.warn('QR upload failed after send', uerr);
            msgEl.textContent = 'Payment sent (QR save failed)';
          }
        }
        
        try {
          const p = await apiFetch('/users/me');
          store.user = p.user;
          localStorage.setItem('ewallet_user', JSON.stringify(store.user));
          if (window.__onAuthChange) window.__onAuthChange();
        } catch (_) {}
        
        setTimeout(() => {
          cleanup();
          goto('dashboard');
        }, 1100);
        return;
      }

      // If missing parameters, redirect to send page with prefill
      store.qrPrefill = {
        toEmail: parsed.email,
        amount: parsed.amount,
        note: parsed.name ? `Payment for ${parsed.name}` : undefined
      };
      cleanup();
      goto('send');
    } catch (err) {
      console.error('Auto-send failed', err);
      const em = document.createElement('div');
      em.className = 'err';
      em.textContent = err.message || 'Payment failed';
      modal.appendChild(em);
      btn.disabled = false;
    }
  });

  document.getElementById('qr-edit').addEventListener('click', () => {
    store.qrPrefill = {
      toEmail: parsed.email,
      amount: parsed.amount,
      note: parsed.name ? `Payment for ${parsed.name}` : undefined
    };
    cleanup();
    goto('send');
  });
}
