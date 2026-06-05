import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, formatCurrency, showVerifyPinModal, showToast } from '../utils.js';

// Append Jars-specific CSS styles dynamically
function injectJarsStyles() {
  if (document.getElementById('jars-styles')) return;
  const style = document.createElement('style');
  style.id = 'jars-styles';
  style.textContent = `
    .jars-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px 16px 100px;
    }
    .jars-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }
    .jars-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 24px;
    }
    .jar-card {
      background: rgba(20, 21, 28, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 24px;
      position: relative;
      height: 310px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.3s ease;
    }
    .jar-card:hover {
      transform: translateY(-5px);
      border-color: rgba(255, 126, 95, 0.3);
    }
    .jar-create-card {
      border: 2px dashed rgba(255, 255, 255, 0.15);
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      min-height: 310px;
      transition: all 0.3s ease;
    }
    .jar-create-card:hover {
      background: rgba(255, 255, 255, 0.02);
      border-color: var(--accent1, #ff7e5f);
    }
    .jar-create-icon {
      font-size: 36px;
      margin-bottom: 12px;
      color: rgba(255, 255, 255, 0.4);
      transition: transform 0.3s ease;
    }
    .jar-create-card:hover .jar-create-icon {
      transform: scale(1.1);
      color: var(--accent1, #ff7e5f);
    }
    
    /* Liquid Wave Animations */
    .jar-liquid-container {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: var(--fill-height, 0%);
      background: var(--liquid-color, linear-gradient(180deg, #ff7e5f 0%, #feb47b 100%));
      opacity: 0.25;
      transition: height 1s cubic-bezier(0.4, 0, 0.2, 1);
      z-index: 1;
      pointer-events: none;
    }
    .jar-liquid-wave {
      position: absolute;
      top: -20px;
      left: 0;
      width: 200%;
      height: 22px;
      background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 120 28" xmlns="http://www.w3.org/2000/svg"><path d="M0 15 Q 30 0, 60 15 T 120 15 L 120 28 L 0 28 Z" fill="%23ff7e5f"/></svg>') repeat-x;
      background-size: 50% 100%;
      animation: wave-slide 8s linear infinite;
    }
    .jar-liquid-wave.wave2 {
      top: -16px;
      opacity: 0.5;
      animation: wave-slide 5s linear infinite reverse;
    }
    @keyframes wave-slide {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    /* Goal Details */
    .jar-info {
      position: relative;
      z-index: 2;
    }
    .jar-cat-badge {
      font-size: 24px;
      background: rgba(255, 255, 255, 0.05);
      width: 48px;
      height: 48px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .jar-title {
      font-size: 18px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .jar-category {
      font-size: 11px;
      color: var(--muted, #8a8e9e);
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
    
    .jar-progress-wrap {
      position: relative;
      z-index: 2;
      margin: 20px 0;
    }
    .jar-progress-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
    }
    .jar-amount-current {
      font-size: 22px;
      font-weight: 800;
      color: #fff;
    }
    .jar-amount-target {
      font-size: 13px;
      color: var(--muted, #8a8e9e);
    }
    .jar-percentage {
      font-size: 14px;
      font-weight: 700;
      color: var(--accent1, #ff7e5f);
    }

    .jar-actions {
      position: relative;
      z-index: 2;
      display: flex;
      gap: 12px;
    }
    .jar-actions button {
      flex: 1;
      padding: 10px;
      font-size: 12px;
      font-weight: 700;
    }
    
    /* Category Colors */
    .jar-card[data-cat="travel"] { --liquid-color: linear-gradient(180deg, #36d1dc 0%, #5b86e5 100%); }
    .jar-card[data-cat="tech"] { --liquid-color: linear-gradient(180deg, #b3cdd1 0%, #9fa5d5 100%); }
    .jar-card[data-cat="gift"] { --liquid-color: linear-gradient(180deg, #ff9a9e 0%, #fecfef 100%); }
    .jar-card[data-cat="home"] { --liquid-color: linear-gradient(180deg, #11998e 0%, #38ef7d 100%); }
    .jar-card[data-cat="other"] { --liquid-color: linear-gradient(180deg, #ff7e5f 0%, #feb47b 100%); }

    /* Modal Form Inputs Improvements */
    .jar-modal-input {
      width: 100%;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.04) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 12px !important;
      padding: 12px 14px !important;
      color: #fff !important;
      font-size: 14px !important;
      outline: none !important;
      transition: all 0.3s ease !important;
    }
    .jar-modal-input:focus {
      border-color: var(--accent1, #ff7e5f) !important;
      box-shadow: 0 0 10px rgba(255, 126, 95, 0.2) !important;
      background: rgba(255, 255, 255, 0.08) !important;
    }
    .jar-modal-label {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 700;
      color: var(--muted, #8a8e9e);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Premium Back Button style */
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

export async function renderJars() {
  injectJarsStyles();
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="jars-container fade-in">
      <div class="back-navigation-row">
        <button class="back-pill-btn" id="btn-jars-back">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div class="jars-header">
        <div>
          <h2 style="margin: 0; color: #fff;">Piggy Jars</h2>
          <p class="smallmuted" style="margin: 4px 0 0;">Create glassmorphic goals and save automatically</p>
        </div>
        <button class="small-btn solid" id="btn-create-jar-header">
          <span>+ Create Goal</span>
        </button>
      </div>
      
      <div class="jars-grid" id="jars-list-grid">
        <div class="smallmuted" style="grid-column: span 3; text-align: center; padding: 40px 0;">Loading savings goals...</div>
      </div>
    </div>
  `;

  // Register Header buttons
  document.getElementById('btn-jars-back').addEventListener('click', () => goto('dashboard'));
  document.getElementById('btn-create-jar-header').addEventListener('click', showCreateGoalModal);

  // Fetch jars list
  await fetchAndRenderJarsList();
}

async function fetchAndRenderJarsList() {
  const grid = document.getElementById('jars-list-grid');
  if (!grid) return;

  try {
    const data = await apiFetch('/jars');
    grid.innerHTML = '';

    // Add Create Goal Card
    const createCard = document.createElement('div');
    createCard.className = 'jar-card jar-create-card';
    createCard.innerHTML = `
      <div class="jar-create-icon">🎯</div>
      <span style="font-weight: 700; color: #fff; font-size: 14px;">Create New Jar</span>
      <span class="smallmuted" style="font-size: 11px; margin-top: 4px;">Set aside money for targets</span>
    `;
    createCard.addEventListener('click', showCreateGoalModal);
    grid.appendChild(createCard);

    if (data.jars && data.jars.length > 0) {
      data.jars.forEach(jar => {
        const percent = Math.min(Math.round((jar.currentAmount / jar.targetAmount) * 100), 100);
        
        // Match emoji by category
        let emoji = '🔮';
        if (jar.category === 'travel') emoji = '✈️';
        else if (jar.category === 'tech') emoji = '💻';
        else if (jar.category === 'gift') emoji = '🎁';
        else if (jar.category === 'home') emoji = '🏠';

        const jarCard = document.createElement('div');
        jarCard.className = 'jar-card';
        jarCard.setAttribute('data-cat', jar.category);
        jarCard.style.setProperty('--fill-height', `${percent}%`);

        // Apply custom inline svg liquid wave colored accordingly
        let waveColor = '%23ff7e5f'; // default orange
        if (jar.category === 'travel') waveColor = '%2336d1dc';
        else if (jar.category === 'tech') waveColor = '%239fa5d5';
        else if (jar.category === 'gift') waveColor = '%23ff9a9e';
        else if (jar.category === 'home') waveColor = '%2338ef7d';

        jarCard.innerHTML = `
          <!-- Liquid wave representation -->
          <div class="jar-liquid-container">
            <div class="jar-liquid-wave" style="background-image: url('data:image/svg+xml;utf8,<svg viewBox=&quot;0 0 120 28&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;><path d=&quot;M0 15 Q 30 0, 60 15 T 120 15 L 120 28 L 0 28 Z&quot; fill=&quot;${waveColor}&quot;/></svg>');"></div>
            <div class="jar-liquid-wave wave2" style="background-image: url('data:image/svg+xml;utf8,<svg viewBox=&quot;0 0 120 28&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;><path d=&quot;M0 15 Q 30 0, 60 15 T 120 15 L 120 28 L 0 28 Z&quot; fill=&quot;${waveColor}&quot;/></svg>');"></div>
          </div>

          <div class="jar-info">
            <div class="jar-cat-badge">${emoji}</div>
            <h3 class="jar-title">${escapeHtml(jar.title)}</h3>
            <span class="jar-category">${jar.category}</span>
          </div>

          <div class="jar-progress-wrap">
            <div class="jar-progress-row">
              <span class="jar-amount-current">${formatCurrency(jar.currentAmount)}</span>
              <span class="jar-percentage">${percent}%</span>
            </div>
            <div class="jar-progress-row" style="margin-bottom: 0;">
              <span class="jar-amount-target">Target: ${formatCurrency(jar.targetAmount)}</span>
            </div>
          </div>

          <div class="jar-actions">
            <button class="small-btn solid" data-action="deposit" data-id="${jar._id}">Save</button>
            <button class="small-btn ghost" data-action="withdraw" data-id="${jar._id}">Withdraw</button>
          </div>
        `;

        // Action bindings
        jarCard.querySelector('button[data-action="deposit"]').addEventListener('click', (e) => {
          e.stopPropagation();
          showDepositModal(jar);
        });
        jarCard.querySelector('button[data-action="withdraw"]').addEventListener('click', (e) => {
          e.stopPropagation();
          showWithdrawModal(jar);
        });

        grid.appendChild(jarCard);
      });
    }
  } catch (err) {
    console.error('Failed to load jars:', err);
    grid.innerHTML = `<div class="error" style="grid-column: span 3; text-align: center; padding: 40px 0;">Failed to load Jars: ${err.message}</div>`;
  }
}

function showCreateGoalModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'create-jar-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '400px';

  modal.innerHTML = `
    <div class="header">
      <h3 style="margin: 0; color: #fff;">New Savings Goal</h3>
      <button class="close" id="btn-close-create-jar">✕</button>
    </div>
    <form id="create-jar-form" style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px;">
      <div class="form-group">
        <label class="jar-modal-label">Goal Name</label>
        <input type="text" id="jar-title" class="jar-modal-input" placeholder="e.g. New Gaming PC, Bali Trip" required>
      </div>
      <div class="form-group">
        <label class="jar-modal-label">Target Amount (₹)</label>
        <input type="number" id="jar-target" class="jar-modal-input" min="10" placeholder="e.g. 5000" required>
      </div>
      <div class="form-group">
        <label class="jar-modal-label">Category</label>
        <select id="jar-category" class="jar-modal-input">
          <option value="other">🔮 General / Other</option>
          <option value="travel">✈️ Travel & Holiday</option>
          <option value="tech">💻 Electronics & Gadgets</option>
          <option value="gift">🎁 Gifts & Celebration</option>
          <option value="home">🏠 Home Improvement</option>
        </select>
      </div>
      <button type="submit" class="btn" style="width: 100%; margin-top: 8px;">Create Jar</button>
    </form>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeBtn = modal.querySelector('#btn-close-create-jar');
  const form = modal.querySelector('#create-jar-form');

  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('jar-title').value;
    const targetAmount = parseFloat(document.getElementById('jar-target').value);
    const category = document.getElementById('jar-category').value;

    try {
      await apiFetch('/jars/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, targetAmount, category })
      });
      showToast('Savings goal created successfully!', 'success');
      overlay.remove();
      await fetchAndRenderJarsList();
    } catch (err) {
      showToast(err.message || 'Failed to create goal', 'error');
    }
  });
}

function showDepositModal(jar) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'deposit-jar-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '360px';

  modal.innerHTML = `
    <div class="header">
      <h3 style="margin: 0; color: #fff;">Save to Goal</h3>
      <button class="close" id="btn-close-deposit-jar">✕</button>
    </div>
    <div style="margin-top: 12px; text-align: center;">
      <p style="font-size: 14px; margin-bottom: 20px;">Deposit wallet funds into <strong style="color: var(--accent1);">${escapeHtml(jar.title)}</strong>.</p>
    </div>
    <form id="deposit-jar-form" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="form-group">
        <label class="jar-modal-label">Amount (₹)</label>
        <input type="number" id="deposit-amount" class="jar-modal-input" min="1" step="any" placeholder="Enter amount to save" required>
        <span class="smallmuted" style="display:block; margin-top: 6px;">Available balance: ${formatCurrency(store.user?.balance || 0)}</span>
      </div>
      <button type="submit" class="btn" style="width: 100%; margin-top: 8px;">Confirm Deposit</button>
    </form>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeBtn = modal.querySelector('#btn-close-deposit-jar');
  const form = modal.querySelector('#deposit-jar-form');

  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    if (isNaN(amount) || amount <= 0) return;

    if ((store.user?.balance || 0) < amount) {
      showToast('Insufficient wallet balance', 'error');
      return;
    }

    // Verify UPI PIN before transfer
    let upiPin;
    try {
      upiPin = await showVerifyPinModal();
    } catch (_) {
      showToast('Deposit cancelled', 'info');
      return;
    }

    try {
      const result = await apiFetch('/jars/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jarId: jar._id, amount, upiPin })
      });
      
      // Update local wallet store
      store.user = result.user;
      localStorage.setItem('ewallet_user', JSON.stringify(store.user));

      showToast(`Saved ${formatCurrency(amount)} into ${jar.title}!`, 'success');
      overlay.remove();
      await fetchAndRenderJarsList();
    } catch (err) {
      showToast(err.message || 'Failed to deposit', 'error');
    }
  });
}

function showWithdrawModal(jar) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'withdraw-jar-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.maxWidth = '360px';

  modal.innerHTML = `
    <div class="header">
      <h3 style="margin: 0; color: #fff;">Withdraw from Goal</h3>
      <button class="close" id="btn-close-withdraw-jar">✕</button>
    </div>
    <div style="margin-top: 12px; text-align: center;">
      <p style="font-size: 14px; margin-bottom: 20px;">Move funds from <strong style="color: var(--accent1);">${escapeHtml(jar.title)}</strong> back to your wallet.</p>
    </div>
    <form id="withdraw-jar-form" style="display: flex; flex-direction: column; gap: 16px;">
      <div class="form-group">
        <label class="jar-modal-label">Amount (₹)</label>
        <input type="number" id="withdraw-amount" class="jar-modal-input" min="1" max="${jar.currentAmount}" step="any" placeholder="Enter amount to withdraw" required>
        <span class="smallmuted" style="display:block; margin-top: 6px;">Goal balance: ${formatCurrency(jar.currentAmount)}</span>
      </div>
      <button type="submit" class="btn" style="width: 100%; margin-top: 8px;">Confirm Withdrawal</button>
    </form>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeBtn = modal.querySelector('#btn-close-withdraw-jar');
  const form = modal.querySelector('#withdraw-jar-form');

  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    if (isNaN(amount) || amount <= 0) return;

    if (jar.currentAmount < amount) {
      showToast('Amount exceeds goal balance', 'error');
      return;
    }

    try {
      const result = await apiFetch('/jars/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jarId: jar._id, amount })
      });
      
      // Update local wallet store
      store.user = result.user;
      localStorage.setItem('ewallet_user', JSON.stringify(store.user));

      showToast(`Withdrew ${formatCurrency(amount)} from ${jar.title}`, 'success');
      overlay.remove();
      await fetchAndRenderJarsList();
    } catch (err) {
      showToast(err.message || 'Failed to withdraw', 'error');
    }
  });
}
