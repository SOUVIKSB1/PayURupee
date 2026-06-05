import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, formatCurrency, showToast } from '../utils.js';

// Inject Card-specific styles
function injectCardStyles() {
  if (document.getElementById('card-page-styles')) return;
  const style = document.createElement('style');
  style.id = 'card-page-styles';
  style.textContent = `
    .card-sandbox-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 24px 16px 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    
    /* 3D Container */
    .card-3d-scene {
      perspective: 1000px;
      width: 340px;
      height: 215px;
      margin: 32px 0;
    }
    .card-3d-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      transform-style: preserve-3d;
      transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      cursor: pointer;
    }
    .card-3d-wrapper.flipped {
      transform: rotateY(180deg);
    }
    
    /* Card Faces */
    .card-face {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 20px;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      padding: 24px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    
    /* Front styling */
    .card-front {
      background: linear-gradient(135deg, rgba(25, 27, 38, 0.85) 0%, rgba(10, 11, 15, 0.95) 100%);
      backdrop-filter: blur(15px);
      -webkit-backdrop-filter: blur(15px);
      transform: translateZ(1px);
    }
    .card-front::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255, 126, 95, 0.08) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    
    /* Back styling */
    .card-back {
      background: linear-gradient(135deg, rgba(10, 11, 15, 0.95) 0%, rgba(20, 21, 28, 0.9) 100%);
      transform: rotateY(180deg) translateZ(1px);
      padding: 20px 0;
    }
    
    /* Elements */
    .card-chip {
      width: 44px;
      height: 32px;
      background: linear-gradient(135deg, #ffd700 0%, #b8860b 100%);
      border-radius: 6px;
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(0,0,0,0.2);
    }
    .card-chip::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg"><path d="M10 0v32M22 0v32M34 0v32M0 16h44" stroke="rgba(0,0,0,0.15)" stroke-width="1"/></svg>');
    }
    .card-logo {
      font-size: 15px;
      font-weight: 800;
      color: #fff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card-number {
      font-size: 19px;
      font-family: 'Courier New', Courier, monospace;
      color: #fff;
      letter-spacing: 2px;
      margin: 20px 0 10px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }
    .card-holder-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .card-label {
      font-size: 8px;
      color: var(--muted, #8a8e9e);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 3px;
    }
    .card-value {
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      text-transform: uppercase;
      white-space: nowrap;
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    /* Back Details */
    .card-mag-strip {
      width: 100%;
      height: 40px;
      background: #000;
      margin-top: 10px;
    }
    .card-sig-panel {
      margin: 20px 24px;
      background: #fff;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 12px;
      border-radius: 4px;
    }
    .card-cvv {
      font-family: 'Courier New', Courier, monospace;
      font-size: 14px;
      font-weight: 700;
      font-style: italic;
      color: #000;
      letter-spacing: 1.5px;
    }
    
    /* Frost Overlay */
    .card-frost-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(135, 206, 250, 0.12);
      backdrop-filter: blur(14px) saturate(120%);
      -webkit-backdrop-filter: blur(14px) saturate(120%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: all 0.5s ease;
      z-index: 5;
      border-radius: 20px;
      transform: translateZ(2px);
    }
    .card-3d-wrapper.frozen .card-frost-overlay {
      opacity: 1;
      visibility: visible;
      transform: translateZ(2px);
    }
    .frost-text {
      color: #b0e2ff;
      font-weight: 800;
      font-size: 18px;
      letter-spacing: 2px;
      text-transform: uppercase;
      text-shadow: 0 0 10px rgba(0, 162, 255, 0.8), 0 0 2px #fff;
      animation: pulse-ice 2s infinite alternate;
    }
    @keyframes pulse-ice {
      0% { transform: scale(0.95); opacity: 0.8; }
      100% { transform: scale(1.05); opacity: 1; }
    }
    
    /* Freeze Ice Border Glow */
    .card-3d-wrapper.frozen .card-face {
      border-color: rgba(0, 191, 255, 0.4);
      box-shadow: 0 0 25px rgba(0, 191, 255, 0.3);
    }
  `;
  document.head.appendChild(style);
}

// Generate card number deterministically from name and email
function generateCardDetails() {
  const name = store.user?.name || 'Valued Customer';
  const email = store.user?.email || 'user@payurupee.com';
  
  // Hash function to make 8 numbers
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  const part3 = Math.abs((hash >> 16) % 10000).toString().padStart(4, '7');
  const part4 = Math.abs(hash % 10000).toString().padStart(4, '2');
  const cardNum = `4216 8802 ${part3} ${part4}`;

  // Deterministic CVV
  const cvv = Math.abs((hash ^ 999) % 1000).toString().padStart(3, '5');

  return { cardNum, cvv, name };
}

export async function renderCard() {
  injectCardStyles();
  const main = document.getElementById('main');
  
  const { cardNum, cvv, name } = generateCardDetails();

  // Load freeze state from localStorage
  const userId = store.user?._id || 'guest';
  const localFreezeKey = `payurupee_card_frozen_${userId}`;
  let isFrozen = localStorage.getItem(localFreezeKey) === 'true';

  main.innerHTML = `
    <div class="card-sandbox-container fade-in">
      <div class="back-navigation-row">
        <button class="back-pill-btn" id="btn-card-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div style="text-align: center; margin-bottom: 16px;">
        <h2 style="margin: 0; color: #fff;">Virtual Platinum Card</h2>
        <p class="smallmuted" style="margin: 4px 0 0;">Interactive 3D Virtual Card Sandbox</p>
      </div>

      <!-- Card Scene -->
      <div class="card-3d-scene" id="card-scene-container">
        <div class="card-3d-wrapper ${isFrozen ? 'frozen' : ''}" id="card-3d-wrapper">
          
          <!-- Frosted Ice Overlay -->
          <div class="card-frost-overlay">
            <span style="font-size: 32px; margin-bottom: 8px;">❄️</span>
            <span class="frost-text">CARD FROZEN</span>
          </div>

          <!-- Front Face -->
          <div class="card-face card-front">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <div class="card-logo">
                <span style="font-size: 16px;">🟠</span>
                <span>PayU₹upee</span>
              </div>
              <span class="smallmuted" style="font-weight: 800; font-size: 9px; letter-spacing: 1.5px; color: #FFD700;">PLATINUM</span>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 14px;">
              <div class="card-chip"></div>
              <!-- Contactless Wave Icon -->
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12a7 7 0 0 1 7-7M2 12a10 10 0 0 1 10-10M8 12a4 4 0 0 1 4-4M11 12a1 1 0 0 1 1-1"></path></svg>
            </div>

            <div class="card-number" id="display-card-number">${cardNum}</div>

            <div class="card-holder-row">
              <div>
                <div class="card-label">Card Holder</div>
                <div class="card-value">${escapeHtml(name)}</div>
              </div>
              <div style="text-align: right;">
                <div class="card-label">Expires</div>
                <div class="card-value">12/31</div>
              </div>
            </div>
          </div>

          <!-- Back Face -->
          <div class="card-face card-back">
            <div class="card-mag-strip"></div>
            
            <div style="width: 100%;">
              <div class="card-label" style="margin-left: 24px;">Security Code</div>
              <div class="card-sig-panel">
                <span class="card-cvv">${cvv}</span>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0 24px; box-sizing: border-box;">
              <span class="smallmuted" style="font-size: 7px; max-width: 180px; text-align: left; line-height: 1.3;">
                This sandbox card is for visualization purposes only. Do not share credentials.
              </span>
              <span style="font-size: 18px; opacity: 0.7;">🔒</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Action panel -->
      <div style="display: flex; flex-direction: column; width: 340px; gap: 12px; margin-top: 10px;">
        <button class="btn" id="btn-toggle-freeze" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; background: ${isFrozen ? 'rgba(0,191,255,0.15)' : ''}; border-color: ${isFrozen ? '#00bfff' : ''};">
          <span>${isFrozen ? '❄️ Unfreeze Card' : '❄️ Freeze Card'}</span>
        </button>
        
        <div style="display: flex; gap: 10px; width: 100%;">
          <button class="btn ghost" id="btn-copy-card" style="flex: 1; font-size: 12px; padding: 10px;">📋 Copy Number</button>
          <button class="btn ghost" id="btn-flip-card" style="flex: 1; font-size: 12px; padding: 10px;">🔄 Flip Card</button>
        </div>
      </div>
    </div>
  `;

  // DOM Elements
  const btnBack = document.getElementById('btn-card-back');
  const scene = document.getElementById('card-scene-container');
  const wrapper = document.getElementById('card-3d-wrapper');
  const btnFreeze = document.getElementById('btn-toggle-freeze');
  const btnCopy = document.getElementById('btn-copy-card');
  const btnFlip = document.getElementById('btn-flip-card');

  // Back navigation
  btnBack.addEventListener('click', () => goto('dashboard'));

  // 3D Tilt rotation event
  scene.addEventListener('mousemove', (e) => {
    // If card is flipped or device doesn't support mouse hover (touchscreens), disable tilt to prevent jitter
    if (wrapper.classList.contains('flipped')) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    const rect = scene.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    // Maximum 15 degree rotation
    const tiltX = (y / (rect.height / 2)) * -18;
    const tiltY = (x / (rect.width / 2)) * 18;

    wrapper.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  });

  scene.addEventListener('mouseleave', () => {
    if (wrapper.classList.contains('flipped')) {
      wrapper.style.transform = 'rotateY(180deg)';
    } else {
      wrapper.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }
  });

  // Flip triggers (clicking wrapper, or Flip button)
  const toggleFlip = () => {
    const isFlipped = wrapper.classList.toggle('flipped');
    if (isFlipped) {
      wrapper.style.transform = 'rotateY(180deg)';
    } else {
      wrapper.style.transform = 'rotateX(0deg) rotateY(0deg)';
    }
  };

  wrapper.addEventListener('click', toggleFlip);
  btnFlip.addEventListener('click', toggleFlip);

  // Freeze action
  btnFreeze.addEventListener('click', () => {
    isFrozen = !isFrozen;
    localStorage.setItem(localFreezeKey, isFrozen);

    if (isFrozen) {
      wrapper.classList.add('frozen');
      btnFreeze.textContent = '❄️ Unfreeze Card';
      btnFreeze.style.background = 'rgba(0,191,255,0.15)';
      btnFreeze.style.borderColor = '#00bfff';
      showToast('Card frozen successfully!', 'success');
    } else {
      wrapper.classList.remove('frozen');
      btnFreeze.textContent = '❄️ Freeze Card';
      btnFreeze.style.background = '';
      btnFreeze.style.borderColor = '';
      showToast('Card activated successfully!', 'success');
    }
  });

  // Copy card number to clipboard
  btnCopy.addEventListener('click', (e) => {
    e.stopPropagation();
    const cleanNum = cardNum.replace(/\s/g, '');
    navigator.clipboard.writeText(cleanNum).then(() => {
      showToast('Card number copied to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy card number', 'error');
    });
  });
}
