import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, formatCurrency, showToast, triggerConfetti } from '../utils.js';

// Inject Rewards-specific CSS styles
function injectRewardsStyles() {
  if (document.getElementById('rewards-page-styles')) return;
  const style = document.createElement('style');
  style.id = 'rewards-page-styles';
  style.textContent = `
    .rewards-arena-container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px 16px;
    }
    .rewards-split-layout {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 28px;
    }
    @media (max-width: 768px) {
      .rewards-split-layout {
        grid-template-columns: 1fr;
      }
    }
    .wheel-card {
      background: rgba(20, 21, 28, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      position: relative;
    }
    .wheel-container {
      position: relative;
      width: 280px;
      height: 280px;
      margin: 20px 0;
    }
    .wheel-canvas {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      box-shadow: 0 0 25px rgba(255, 126, 95, 0.4), 0 0 2px rgba(255, 255, 255, 0.3);
      transition: transform 6s cubic-bezier(0.1, 0.8, 0.1, 1);
    }
    .wheel-pointer {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 15px solid transparent;
      border-right: 15px solid transparent;
      border-top: 25px solid #FFD700;
      filter: drop-shadow(0 2px 5px rgba(0,0,0,0.5));
      z-index: 10;
    }
    .wheel-spin-btn {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #fff;
      color: #0d0e12;
      border: 4px solid #FFD700;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255,255,255,0.4);
      z-index: 11;
      transition: transform 0.2s ease;
    }
    .wheel-spin-btn:hover {
      transform: translate(-50%, -50%) scale(1.05);
    }
    .wheel-spin-btn:disabled {
      background: #888;
      border-color: #555;
      cursor: not-allowed;
      transform: translate(-50%, -50%);
    }

    .rewards-list-card {
      background: rgba(20, 21, 28, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 20px;
      padding: 20px;
    }
    .reward-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.04);
      margin-bottom: 8px;
    }
    .reward-item.pending {
      border-color: rgba(255, 126, 95, 0.2);
      background: rgba(255, 126, 95, 0.03);
      cursor: pointer;
    }
    .reward-item.pending:hover {
      background: rgba(255, 126, 95, 0.06);
    }
    .reward-icon {
      font-size: 20px;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }
    .reward-item.pending .reward-icon {
      background: rgba(255, 126, 95, 0.15);
      color: #ff7e5f;
    }
    .reward-info {
      flex: 1;
      min-width: 0;
    }
    .reward-title {
      font-size: 13px;
      font-weight: 700;
      color: #fff;
      margin: 0;
    }
    .reward-date {
      font-size: 11px;
      color: var(--muted, #8a8e9e);
    }
    .reward-amount {
      font-size: 15px;
      font-weight: 800;
      color: #FFD700;
    }
    .back-navigation-row {
      display: flex;
      align-items: center;
      width: 100%;
      margin-bottom: 24px;
    }
    .back-pill-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 30px;
      padding: 8px 16px;
      color: var(--muted, #8a8e9e);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      outline: none;
    }
    .back-pill-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--accent1, #ff7e5f);
      color: #fff;
      transform: translateX(-4px);
      box-shadow: 0 4px 15px rgba(255, 126, 95, 0.15);
    }
    .back-pill-btn svg {
      transition: transform 0.3s ease;
    }
    .back-pill-btn:hover svg {
      transform: translateX(-2px);
    }
  `;
  document.head.appendChild(style);
}

// Segments for the wheel
const WHEEL_SEGMENTS = [
  { amount: 5, label: "₹5 Cash", color: "#e74c3c" },
  { amount: 10, label: "₹10 Cash", color: "#3498db" },
  { amount: 50, label: "₹50 Cash", color: "#9b59b6" },
  { amount: 100, label: "₹100 Jackpot", color: "#f1c40f" },
  { amount: 15, label: "₹15 Cash", color: "#2ecc71" },
  { amount: 20, label: "₹20 Cash", color: "#1abc9c" },
  { amount: 25, label: "₹25 Cash", color: "#e67e22" },
  { amount: 1000, label: "₹1000 Mega", color: "#FFD700" }
];

export async function renderRewards() {
  injectRewardsStyles();
  const main = document.getElementById('main');

  const rewards = (store.user && Array.isArray(store.user.rewards)) ? store.user.rewards : [];
  const pending = rewards.filter(r => !r.scratched);
  const claimed = rewards.filter(r => r.scratched).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  main.innerHTML = `
    <div class="rewards-arena-container fade-in">
      <div class="back-navigation-row">
        <button class="back-pill-btn" id="btn-rewards-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="margin: 0; color: #fff;">Reward Arena</h2>
        <p class="smallmuted" style="margin: 4px 0 0;">Spin the Fortune Wheel to claim your cashback rewards!</p>
      </div>

      <div class="rewards-split-layout">
        <!-- Left: Spin Wheel Console -->
        <div class="wheel-card" id="wheel-console-card">
          ${pending.length > 0 ? `
            <h3 style="margin: 0; color: #fff;">You have ${pending.length} Spin(s) pending!</h3>
            <p class="smallmuted" style="margin-top: 4px; font-size: 12px;">Select a reward from the sidebar or click Spin to claim: <strong>${escapeHtml(pending[0].message)}</strong></p>
            
            <div class="wheel-container">
              <div class="wheel-pointer"></div>
              <canvas class="wheel-canvas" id="canvas-wheel" width="500" height="500"></canvas>
              <button class="wheel-spin-btn" id="btn-spin-wheel">SPIN</button>
            </div>
            
            <div id="wheel-result-banner" style="margin-top: 10px; font-size: 16px; font-weight: 700; color: #FFD700; min-height: 24px;"></div>
          ` : `
            <div style="padding: 60px 20px;">
              <span style="font-size: 60px; display: block; margin-bottom: 16px;">🎡</span>
              <h3 style="margin: 0; color: #fff;">No Pending Spins</h3>
              <p class="smallmuted" style="margin-top: 8px; font-size: 13px; max-width: 300px; margin-left: auto; margin-right: auto;">
                Make money transfers or pay utility bills to earn digital scratch rewards and wheel spins!
              </p>
            </div>
          `}
        </div>

        <!-- Right: Rewards Summary & Claimed list -->
        <div class="rewards-list-card">
          <h3 style="margin: 0 0 16px; color: #fff; font-size: 16px;">My Rewards Log</h3>
          
          <div style="margin-bottom: 20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom: 6px;">
              <span class="smallmuted" style="font-size:12px;">Total Earned</span>
              <strong style="color: #FFD700; font-size:16px;">
                ${formatCurrency(claimed.reduce((sum, r) => sum + r.amount, 0))}
              </strong>
            </div>
          </div>

          <div style="max-height: 380px; overflow-y: auto; padding-right: 4px;">
            ${pending.length > 0 ? `
              <div style="margin-bottom: 16px;">
                <h4 class="smallmuted" style="margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Pending Spins</h4>
                <div id="pending-rewards-list">
                  ${pending.map(r => `
                    <div class="reward-item pending" data-id="${r._id}">
                      <div style="display: flex; align-items: center;">
                        <span class="reward-icon">🎁</span>
                        <div class="reward-info">
                          <h4 class="reward-title">${escapeHtml(r.message || 'Cashback Reward')}</h4>
                          <span class="reward-date">${new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <span class="reward-amount" style="color: var(--accent1);">Spin 🎡</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <div>
              <h4 class="smallmuted" style="margin: 0 0 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Claimed History</h4>
              ${claimed.length > 0 ? claimed.map(r => `
                <div class="reward-item">
                  <div style="display: flex; align-items: center;">
                    <span class="reward-icon">🎉</span>
                    <div class="reward-info">
                      <h4 class="reward-title">${escapeHtml(r.message || 'Cashback Reward')}</h4>
                      <span class="reward-date">${new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <span class="reward-amount">+${formatCurrency(r.amount)}</span>
                </div>
              `).join('') : `
                <div class="smallmuted" style="text-align: center; padding: 20px 0; font-size: 12px;">No rewards claimed yet.</div>
              `}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Bind back button
  const btnBack = document.getElementById('btn-rewards-back');
  if (btnBack) {
    btnBack.addEventListener('click', () => goto('dashboard'));
  }

  // Draw the wheel if canvas exists
  const canvas = document.getElementById('canvas-wheel');
  if (canvas) {
    drawWheel(canvas);
    
    // Bind spin click
    const btnSpin = document.getElementById('btn-spin-wheel');
    btnSpin.addEventListener('click', () => spinWheel(pending[0]));

    // Bind sidebar clicks to switch active reward to spin
    const pendingItems = document.querySelectorAll('#pending-rewards-list .reward-item');
    pendingItems.forEach((item, index) => {
      item.addEventListener('click', () => {
        // Swap selected item to index 0 of pending logic
        const clickedReward = pending[index];
        spinWheel(clickedReward);
      });
    });
  }
}

function drawWheel(canvas) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = width / 2 - 10;

  ctx.clearRect(0, 0, width, height);

  const angleStep = (Math.PI * 2) / WHEEL_SEGMENTS.length;

  for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
    const angle = i * angleStep;
    
    // Draw segment slice
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle, angle + angleStep);
    ctx.closePath();
    ctx.fillStyle = WHEEL_SEGMENTS[i].color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.stroke();

    // Draw text label inside segment
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(angle + angleStep / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px Montserrat, Arial, sans-serif";
    ctx.fillText(WHEEL_SEGMENTS[i].label, radius - 30, 8);
    ctx.restore();
  }

  // Draw outer rim
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#fff';
  ctx.stroke();

  // Draw center node
  ctx.beginPath();
  ctx.arc(centerX, centerY, 30, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD700';
  ctx.fill();
  ctx.stroke();
}

let isSpinning = false;
async function spinWheel(reward) {
  if (isSpinning || !reward) return;
  isSpinning = true;

  const btnSpin = document.getElementById('btn-spin-wheel');
  const canvas = document.getElementById('canvas-wheel');
  const resultBanner = document.getElementById('wheel-result-banner');
  if (btnSpin) btnSpin.disabled = true;
  if (resultBanner) resultBanner.textContent = "Spinning...";

  // Determine which segment index corresponds to the reward amount (fallback to segment 0 if none)
  let targetSegmentIndex = WHEEL_SEGMENTS.findIndex(s => s.amount === reward.amount);
  if (targetSegmentIndex === -1) {
    // If not in standard list, customize segment 0 dynamically
    WHEEL_SEGMENTS[0] = { amount: reward.amount, label: `₹${reward.amount} Cash`, color: "#e74c3c" };
    drawWheel(canvas);
    targetSegmentIndex = 0;
  }

  // Calculate final angle to land pointer at target segment
  // Pointer is at -90 degrees (top of circle, 3 * Math.PI / 2).
  // Segment index i is at angle range [i * angleStep, (i+1) * angleStep].
  // To align target segment with top pointer, the rotation angle should end on:
  const angleStep = 360 / WHEEL_SEGMENTS.length;
  // Segment mid-angle in degrees:
  const targetSegmentMid = (targetSegmentIndex * angleStep) + (angleStep / 2);
  // Total angle rotation (e.g. 5 full rotations + distance to land segment mid under pointer at 270 degrees)
  const fullRotations = 5;
  const finalRotation = 360 * fullRotations + (270 - targetSegmentMid);

  // Apply CSS transition/rotation
  canvas.style.transform = `rotate(${finalRotation}deg)`;

  // Play a ticking sound effect dynamically
  let clickCount = 0;
  const clickInterval = setInterval(() => {
    if (clickCount < 30) {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600 - clickCount * 10, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      } catch (_) {}
      clickCount++;
    } else {
      clearInterval(clickInterval);
    }
  }, 180);

  // Wait for animation to finish (6 seconds transition matches style rule)
  setTimeout(async () => {
    clearInterval(clickInterval);
    isSpinning = false;
    
    // Claim reward on backend
    try {
      const response = await apiFetch('/users/claim-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId: reward._id })
      });

      // Update local store balance & user objects
      store.user = response.user;
      localStorage.setItem('ewallet_user', JSON.stringify(store.user));

      if (resultBanner) {
        resultBanner.innerHTML = `🎉 Won ${formatCurrency(reward.amount)}! Added to wallet balance.`;
      }
      showToast(`Claimed ${formatCurrency(reward.amount)} cashback!`, 'success');
      
      triggerConfetti();

      // Refresh page after a brief delay
      setTimeout(() => {
        renderRewards();
      }, 3000);
    } catch (err) {
      showToast(err.message || 'Error claiming spin', 'error');
      if (btnSpin) btnSpin.disabled = false;
    }
  }, 6200);
}
