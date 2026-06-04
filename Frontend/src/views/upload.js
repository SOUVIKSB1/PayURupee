import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, parseQrPayload, playScanBeepSound, showMyQrModal } from '../utils.js';

export function renderUpload() {
  const main = document.getElementById('main');
  
  // Inject custom CSS styling specifically for modern-classic elements
  const styleId = 'scan-pay-custom-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.innerHTML = `
      #qr-drag-drop:hover {
        background: rgba(255, 255, 255, 0.025) !important;
        border-color: var(--accent1) !important;
      }
      .scanner-bracket {
        position: absolute;
        width: 24px;
        height: 24px;
        border-color: var(--accent1);
        border-style: solid;
        pointer-events: none;
        z-index: 10;
        opacity: 0.8;
        transition: all 0.3s ease;
      }
      .camera-viewport:hover .scanner-bracket {
        width: 28px;
        height: 28px;
        opacity: 1;
      }
      @media (max-width: 440px) {
        .modal-actions-preview {
          flex-direction: column;
          gap: 8px !important;
        }
        .modal-actions-preview button {
          width: 100% !important;
          flex: 1 1 auto !important;
        }
      }
    `;
    document.head.appendChild(styleEl);
  }

  main.innerHTML = `
    <div class="card fade-in scan-card">
      
      <!-- Header -->
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="margin: 0; font-size: 26px; font-weight: 800; background: linear-gradient(135deg, #ffffff, #a1a1aa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: -0.5px;">Scan & Pay</h2>
        <p class="smallmuted" style="margin-top: 4px; font-size: 13px;">Hold QR code in front of the camera or upload an image</p>
      </div>
      
      <!-- Video Live Camera Scanner container -->
      <div id="camera-viewport" class="camera-viewport" style="position: relative; width: 100%; aspect-ratio: 1; max-height: 380px; background: #000; border-radius: 20px; overflow: hidden; border: 1.5px solid rgba(255,255,255,0.08); box-shadow: inset 0 0 40px rgba(0,0,0,0.8), 0 8px 32px rgba(0,0,0,0.4); margin-bottom: 24px;">
        
        <!-- Video element -->
        <video id="preview-video" style="display: none; position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" playsinline></video>
        <canvas id="preview-canvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; z-index: 2;" fill-style="cover"></canvas>
        
        <!-- Scanner cutout overlay (GPay style) -->
        <div id="scanner-cutout" style="display: none; position: absolute; inset: 0; margin: auto; width: min(220px, 60%); height: min(220px, 60%); border-radius: 16px; box-shadow: 0 0 0 9999px rgba(8, 8, 10, 0.7); z-index: 3; pointer-events: none; border: 1px solid rgba(255,255,255,0.15);">
          <!-- Brackets relative to cutout -->
          <div class="scanner-bracket" style="top: -2px; left: -2px; border-width: 4px 0 0 4px; border-top-left-radius: 8px;"></div>
          <div class="scanner-bracket" style="top: -2px; right: -2px; border-width: 4px 4px 0 0; border-top-right-radius: 8px;"></div>
          <div class="scanner-bracket" style="bottom: -2px; left: -2px; border-width: 0 0 4px 4px; border-bottom-left-radius: 8px;"></div>
          <div class="scanner-bracket" style="bottom: -2px; right: -2px; border-width: 0 4px 4px 0; border-bottom-right-radius: 8px;"></div>
          
          <!-- Scanner Laser Sweep animation line -->
          <div id="scanner-laser" class="scanner-laser hidden" style="position: absolute; height: 3px; left: 10px; right: 10px; background: linear-gradient(90deg, transparent, var(--accent1), transparent); box-shadow: 0 0 15px var(--accent1); pointer-events: none; z-index: 5;"></div>
        </div>

        <!-- Scan successful camera flash overlay -->
        <div id="scan-flash" class="scan-flash" style="position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; transition: opacity 0.15s ease-out; z-index: 12;"></div>
        
        <!-- Placeholder when camera is inactive -->
        <div id="camera-placeholder" style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--muted); background: radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%); z-index: 4;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 18px; border-radius: 50%; margin-bottom: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </div>
          <div style="font-size: 13px; font-weight: 500; letter-spacing: 0.5px;">CAMERA INTERFACE OFFLINE</div>
        </div>
      </div>
      
      <!-- Camera control actions -->
      <div class="camera-actions" style="margin-bottom: 24px; display: flex; gap: 12px;">
        <button type="button" class="btn primary" id="btn-toggle-camera" style="flex: 1; padding: 14px; font-weight: 700; border-radius: 12px; box-shadow: 0 4px 12px rgba(255,122,0,0.15);">Start Camera Scan</button>
        <button type="button" class="btn ghost" id="scan-my-qr" style="flex: 1; padding: 14px; font-weight: 600; border-radius: 12px; border-color: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; gap: 8px; color: #fff;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg>
          Show My QR
        </button>
      </div>

      <!-- Upload Section Title Separator -->
      <div style="text-align: center; position: relative; margin-bottom: 24px;">
        <span style="background: #08080a; padding: 0 14px; color: var(--muted); font-size: 11px; font-weight: 700; letter-spacing: 1px; position: relative; z-index: 2;">OR UPLOAD DIRECTLY</span>
        <hr style="position: absolute; top: 50%; left: 0; right: 0; border: none; border-top: 1px dashed rgba(255,255,255,0.08); margin: 0; z-index: 1;" />
      </div>

      <!-- Image Decode Upload -->
      <form id="form-qr" style="display: flex; flex-direction: column; gap: 14px;">
        <div id="qr-drag-drop" style="border: 2px dashed rgba(255,255,255,0.1); background: rgba(255,255,255,0.01); border-radius: 14px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s ease;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 8px; opacity: 0.7;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <div style="font-size: 13px; font-weight: 600; color: #fff;">Choose QR code image</div>
          <div class="smallmuted" style="font-size: 11px; margin-top: 4px;">Supports PNG, JPG, JPEG</div>
          <input type="file" name="qr" id="file-qr-input" accept="image/*" style="display: none;" />
        </div>

        <div class="form-actions" style="display: flex; gap: 10px;">
          <button class="btn primary" type="submit" style="flex: 1; padding: 13px; border-radius: 12px; font-weight: 700;">Decode & Proceed</button>
          <button type="button" class="btn ghost" id="qr-back" style="flex: 0.4; padding: 13px; border-radius: 12px; border-color: rgba(255,255,255,0.08); color: #fff;">Back</button>
        </div>
        <div id="qr-msg" style="margin-top: 4px; font-size: 13px; text-align: center;"></div>
      </form>
    </div>
  `;
  
  let stream = null;
  let animFrameId = null;
  let videoEl = document.getElementById('preview-video');
  let canvasEl = document.getElementById('preview-canvas');
  let ctx = canvasEl ? canvasEl.getContext('2d') : null;
  
  const placeholder = document.getElementById('camera-placeholder');
  const laser = document.getElementById('scanner-laser');
  const flash = document.getElementById('scan-flash');
  const toggleCamBtn = document.getElementById('btn-toggle-camera');
  const msg = document.getElementById('qr-msg');
  const showMyQrBtn = document.getElementById('scan-my-qr');
  const dragDropArea = document.getElementById('qr-drag-drop');
  const fileInput = document.getElementById('file-qr-input');
  
  showMyQrBtn.addEventListener('click', () => {
    stopCamera();
    showMyQrModal();
  });

  if (dragDropArea && fileInput) {
    dragDropArea.addEventListener('click', () => {
      fileInput.click();
    });
    
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        const name = fileInput.files[0].name;
        const infoEl = dragDropArea.querySelector('div:nth-of-type(2)');
        if (infoEl) infoEl.textContent = `Selected: ${name}`;
      }
    });
  }
  
  async function startCamera() {
    try {
      msg.textContent = '';
      msg.className = '';
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
      const cutout = document.getElementById('scanner-cutout');
      if (cutout) cutout.style.display = 'block';
      if (laser) laser.classList.remove('hidden');
      if (toggleCamBtn) {
        toggleCamBtn.textContent = 'Stop Camera';
        toggleCamBtn.className = 'btn danger';
        toggleCamBtn.style.boxShadow = 'none';
      }
      
      if (videoEl) {
        await videoEl.play();
        animFrameId = requestAnimationFrame(tick);
      }
    } catch (err) {
      console.error('Camera access failed', err);
      msg.textContent = 'Failed to access camera. Check browser permissions.';
      msg.className = 'err';
      stopCamera();
    }
  }
  
  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (videoEl) {
      videoEl.pause();
      videoEl.srcObject = null;
      videoEl.style.display = 'none';
    }
    if (placeholder) placeholder.style.display = 'flex';
    const cutout = document.getElementById('scanner-cutout');
    if (cutout) cutout.style.display = 'none';
    if (laser) laser.classList.add('hidden');
    if (toggleCamBtn) {
      toggleCamBtn.textContent = 'Start Camera Scan';
      toggleCamBtn.className = 'btn primary';
      toggleCamBtn.style.boxShadow = '0 4px 12px rgba(255,122,0,0.15)';
    }
    if (canvasEl && ctx) {
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    }
  }
  
  function drawLine(begin, end, color) {
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(begin.x, begin.y);
    ctx.lineTo(end.x, end.y);
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
  
  function drawRect(location, color) {
    drawLine(location.topLeftCorner, location.topRightCorner, color);
    drawLine(location.topRightCorner, location.bottomRightCorner, color);
    drawLine(location.bottomRightCorner, location.bottomLeftCorner, color);
    drawLine(location.bottomLeftCorner, location.topLeftCorner, color);
  }
  
  function tick() {
    try {
      if (videoEl && videoEl.readyState === videoEl.HAVE_ENOUGH_DATA && canvasEl && ctx) {
        if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          canvasEl.width = videoEl.videoWidth;
          canvasEl.height = videoEl.videoHeight;
          ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
          
          const imgData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
          const code = window.jsQR ? window.jsQR(imgData.data, canvasEl.width, canvasEl.height) : null;
          
          if (code) {
            drawRect(code.location, '#00d26a');
            
            if (code.data) {
              playScanBeepSound();
              if (flash) flash.classList.add('active');
              
              cancelAnimationFrame(animFrameId);
              animFrameId = null;
              
              if (stream) {
                stream.getVideoTracks().forEach(track => track.enabled = false);
              }
              
              if (laser) laser.classList.add('hidden');
              
              setTimeout(() => {
                const parsed = parseQrPayload(code.data);
                stopCamera();
                if (flash) flash.classList.remove('active');
                showQrPreview(parsed || {}, null, code.data, null);
              }, 350);
              return;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error in scanner tick:', e);
    }
    
    if (stream) {
      animFrameId = requestAnimationFrame(tick);
    }
  }
  
  toggleCamBtn.addEventListener('click', () => {
    if (stream) {
      stopCamera();
    } else {
      startCamera();
    }
  });

  document.getElementById('qr-back').addEventListener('click', () => {
    stopCamera();
    goto('dashboard');
  });

  document.getElementById('form-qr').addEventListener('submit', async (e) => {
    e.preventDefault();
    stopCamera();
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
        msg.textContent = 'No QR code detected in image';
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

  window.__currentViewCleanup = () => {
    stopCamera();
  };
}

function showQrPreview(parsed, file, raw, dataUrl) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const modal = document.createElement('div');
  
  modal.className = 'modal fade-in';
  modal.style.background = '#08080a';
  modal.style.border = '1px solid rgba(255,255,255,0.08)';
  modal.style.borderRadius = '20px';
  modal.style.padding = 'min(24px, 5vw)';
  modal.style.width = '90%';
  modal.style.maxWidth = '460px';
  modal.style.boxShadow = '0 24px 64px rgba(0,0,0,0.8)';
  modal.style.boxSizing = 'border-box';
  
  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.08); padding-bottom: 14px; margin-bottom: 18px;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 800; color: #fff;">QR Payment Preview</h3>
      <button id="qr-close" style="background: none; border: none; color: var(--muted); font-size: 18px; cursor: pointer; padding: 4px;">✕</button>
    </div>
    
    <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 8px;">
        <span class="smallmuted" style="font-size: 12.5px;">Recipient Name:</span>
        <strong style="color: #fff; font-size: 13px;">${escapeHtml(parsed.name || '—')}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 8px;">
        <span class="smallmuted" style="font-size: 12.5px;">UPI ID / Email:</span>
        <strong style="color: var(--accent1); font-size: 13px;">${escapeHtml(parsed.email || '—')}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.02); padding-bottom: 8px;">
        <span class="smallmuted" style="font-size: 12.5px;">Amount to Pay:</span>
        <strong style="color: #00d26a; font-size: 15px;">${parsed.amount ? ('₹' + Number(parsed.amount).toFixed(2)) : '—'}</strong>
      </div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        <span class="smallmuted" style="font-size: 11px;">Scanned QR Contents:</span>
        <span style="font-family: monospace; font-size: 10px; color: var(--muted); background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); padding: 8px; border-radius: 8px; word-break: break-all; max-height: 60px; overflow-y: auto;">${escapeHtml(String(raw || '—'))}</span>
      </div>
    </div>
    
    <div class="modal-actions-preview" style="display: flex; gap: 8px;">
      <button class="btn primary" id="qr-accept" style="flex: 1.2; padding: 12px; font-weight: 700; border-radius: 10px;">Accept & Pay</button>
      <button class="btn ghost" id="qr-edit" style="flex: 0.8; padding: 12px; font-weight: 600; border-radius: 10px; border-color: rgba(255,255,255,0.08); color: #fff;">Edit</button>
      <button class="btn ghost" id="qr-cancel" style="flex: 0.8; padding: 12px; font-weight: 600; border-radius: 10px; border-color: rgba(255,255,255,0.08); color: #fff;">Cancel</button>
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
    msgEl.style.fontSize = '13px';
    msgEl.style.color = '#fff';
    modal.appendChild(msgEl);
    btn.disabled = true;
    
    try {
      if (parsed.email && parsed.amount) {
        msgEl.innerHTML = '<span class="spinner"></span>Sending payment...';
        const toEmail = parsed.email;
        const amount = Number(parsed.amount);
        const note = parsed.name ? `Payment for ${parsed.name}` : '';
        
        const sendRes = await apiFetch('/wallet/send', {
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
        
        if (sendRes && sendRes.user) {
          store.user = sendRes.user;
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
        
        setTimeout(() => {
          cleanup();
          goto('dashboard');
        }, 1100);
        return;
      }

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
      em.style.marginTop = '10px';
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
