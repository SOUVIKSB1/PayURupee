import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, showStatusOverlay } from '../utils.js';
import { addNotification } from '../notifications.js';

export async function renderBills() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card fade-in" style="max-width:720px;margin:24px auto; padding: 28px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 24px;">
      <h2>Pay Utility Bill</h2>
      <p class="smallmuted" style="margin-bottom: 20px;">Choose provider category, select operator and settle dues</p>
      
      <!-- Interactive Category Chips -->
      <div style="margin-bottom: 20px;">
        <span class="smallmuted" style="font-size: 11px; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 8px;">CHOOSE UTILITY CATEGORY</span>
        <div id="category-chips-container" style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="btn category-chip active" data-category="all" style="padding: 8px 14px; font-size: 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; background: var(--accent1); color: #000; border: none; font-weight: 700;">🌐 All Utilities</button>
          <button type="button" class="btn category-chip ghost" data-category="electricity" style="padding: 8px 14px; font-size: 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; border-color: rgba(255,255,255,0.08); color: #fff;">💡 Electricity</button>
          <button type="button" class="btn category-chip ghost" data-category="water" style="padding: 8px 14px; font-size: 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; border-color: rgba(255,255,255,0.08); color: #fff;">🚰 Water</button>
          <button type="button" class="btn category-chip ghost" data-category="gas" style="padding: 8px 14px; font-size: 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; border-color: rgba(255,255,255,0.08); color: #fff;">Gas</button>
          <button type="button" class="btn category-chip ghost" data-category="broadband" style="padding: 8px 14px; font-size: 12px; border-radius: 20px; display: flex; align-items: center; gap: 6px; border-color: rgba(255,255,255,0.08); color: #fff;">📶 Broadband</button>
        </div>
      </div>

      <form id="form-bill" style="display: flex; flex-direction: column; gap: 14px;">
        <div>
          <select name="providerCode" class="input" style="width: 100%;"><option value="">Loading providers...</option></select>
        </div>
        
        <!-- Interactive Provider info card (hidden initially) -->
        <div id="provider-info-card" style="display: none; padding: 14px 16px; border-radius: 12px; background: rgba(255,122,0,0.03); border: 1px solid rgba(255,122,0,0.1); flex-direction: column; gap: 4px; transition: all 0.2s ease;">
          <div style="font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
            <span id="info-provider-icon">ℹ️</span> <span id="info-provider-name">Provider Operator</span>
          </div>
          <div class="smallmuted" style="font-size: 11px;">Format guide: <span id="info-provider-format" style="color: #fff; font-family: monospace;">Enter 10-12 digits ID</span></div>
          <div class="smallmuted" style="font-size: 11px;">Settlement time: <span style="color: #00d26a; font-weight: 600;">Instant</span></div>
        </div>

        <div>
          <input name="consumerNumber" required placeholder="Consumer/account number" class="input" style="width: 100%;" />
        </div>

        <div>
          <input name="amount" required placeholder="Amount" type="number" step="0.01" class="input" style="width: 100%; margin-bottom: 6px;" />
          <!-- Amount Preset Chips -->
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn amount-preset-btn ghost" data-value="100" style="padding: 6px 12px; font-size: 11px; border-radius: 8px; border-color: rgba(255,255,255,0.06); color: #fff;">+₹100</button>
            <button type="button" class="btn amount-preset-btn ghost" data-value="500" style="padding: 6px 12px; font-size: 11px; border-radius: 8px; border-color: rgba(255,255,255,0.06); color: #fff;">+₹500</button>
            <button type="button" class="btn amount-preset-btn ghost" data-value="1000" style="padding: 6px 12px; font-size: 11px; border-radius: 8px; border-color: rgba(255,255,255,0.06); color: #fff;">+₹1000</button>
            <button type="button" class="btn amount-preset-btn ghost" data-value="5000" style="padding: 6px 12px; font-size: 11px; border-radius: 8px; border-color: rgba(255,255,255,0.06); color: #fff;">+₹5000</button>
          </div>
        </div>

        <div style="margin-top: 6px; display: flex; gap: 8px;">
          <button class="btn primary" type="submit" style="flex: 1; padding: 13px; font-weight: 700; border-radius: 12px;">Pay Bill</button>
          <button type="button" class="btn ghost" id="bills-back" style="flex: 0.4; padding: 13px; font-weight: 600; border-radius: 12px; border-color: rgba(255,255,255,0.08); color: #fff;">Back</button>
        </div>
        <div id="bill-msg" style="margin-top: 4px; text-align: center;"></div>
      </form>

      <!-- Interactive Quick Pay section -->
      <div id="quick-pay-section" style="display: none; border-top: 1px dashed rgba(255,255,255,0.08); margin-top: 24px; padding-top: 20px;">
        <span class="smallmuted" style="font-size: 11px; font-weight: 700; letter-spacing: 0.5px; display: block; margin-bottom: 12px;">RECENTLY PAID ACCOUNTS</span>
        <div id="quick-pay-chips" style="display: flex; flex-direction: column; gap: 10px;"></div>
      </div>
    </div>
  `;

  document.getElementById('bills-back').addEventListener('click', () => goto('dashboard'));

  const sel = document.querySelector('select[name="providerCode"]');
  sel.innerHTML = `<option value="">Loading operators...</option>`;
  
  let allProviders = [];

  function getProviderCategory(provider) {
    const code = String(provider.code).toLowerCase();
    const name = String(provider.name).toLowerCase();
    if (code.includes('elec') || name.includes('electricity') || name.includes('power')) return 'electricity';
    if (code.includes('water') || name.includes('water') || name.includes('board')) return 'water';
    if (code.includes('gas') || name.includes('gas') || name.includes('indane') || name.includes('hp')) return 'gas';
    if (code.includes('broadband') || code.includes('net') || name.includes('telecom') || name.includes('airtel') || name.includes('jio') || name.includes('broadband') || name.includes('internet')) return 'broadband';
    return 'others';
  }

  function updateProvidersSelect(category) {
    let filtered = allProviders;
    if (category !== 'all') {
      filtered = allProviders.filter(p => getProviderCategory(p) === category);
    }
    
    if (filtered.length === 0) {
      sel.innerHTML = `<option value="">No operators found in this category</option>`;
      return;
    }
    
    sel.innerHTML = `<option value="">Select operator</option>` + 
      filtered.map(p => `<option value="${escapeHtml(p.code)}">${escapeHtml(p.name)} (${escapeHtml(p.code)})</option>`).join('');
  }

  try {
    const json = await apiFetch('/bills/providers');
    allProviders = json.providers || [];
    updateProvidersSelect('all');
  } catch (err) {
    sel.innerHTML = `<option value="">Failed to load operators</option>`;
  }

  // Hook Category Chips click events
  const chips = document.querySelectorAll('.category-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => {
        c.classList.remove('active');
        c.classList.add('ghost');
        c.style.background = 'transparent';
        c.style.color = '#fff';
        c.style.border = '1px solid rgba(255,255,255,0.08)';
        c.style.fontWeight = '500';
      });
      chip.classList.remove('ghost');
      chip.classList.add('active');
      chip.style.background = 'var(--accent1)';
      chip.style.color = '#000';
      chip.style.border = 'none';
      chip.style.fontWeight = '700';
      
      const cat = chip.getAttribute('data-category');
      updateProvidersSelect(cat);
      document.getElementById('provider-info-card').style.display = 'none';
    });
  });

  // Hook Operator change event
  sel.addEventListener('change', () => {
    const val = sel.value;
    const infoCard = document.getElementById('provider-info-card');
    if (!val) {
      infoCard.style.display = 'none';
      return;
    }
    const prov = allProviders.find(p => p.code === val);
    if (prov) {
      infoCard.style.display = 'flex';
      document.getElementById('info-provider-name').textContent = prov.name;
      
      const cat = getProviderCategory(prov);
      let emoji = 'ℹ️';
      let format = 'Usually a 10 to 12 digit numeric ID';
      
      if (cat === 'electricity') {
        emoji = '💡';
        format = '12-digit Consumer Number (printed on bill)';
      } else if (cat === 'water') {
        emoji = '🚰';
        format = '10-digit Account Key or Consumer Connection ID';
      } else if (cat === 'gas') {
        emoji = '⛽';
        format = '17-digit LPG Customer ID';
      } else if (cat === 'broadband') {
        emoji = '📶';
        format = 'Account Number / Fixedline ID (e.g., STD code + Number)';
      }
      
      document.getElementById('info-provider-icon').textContent = emoji;
      document.getElementById('info-provider-format').textContent = format;
    } else {
      infoCard.style.display = 'none';
    }
  });

  // Hook Amount Presets
  const amountPresets = document.querySelectorAll('.amount-preset-btn');
  amountPresets.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.getAttribute('data-value'));
      const amtInput = document.querySelector('input[name="amount"]');
      if (amtInput) {
        const cur = Number(amtInput.value) || 0;
        amtInput.value = (cur + val).toFixed(2);
      }
    });
  });

  // Load Quick Pays from History
  try {
    const historyJson = await apiFetch('/wallet/history');
    const txs = historyJson.data || [];
    const billsTxs = txs.filter(tx => tx.type === 'bill' && tx.meta?.provider && tx.meta?.consumerNumber);
    
    const uniqueSaved = [];
    const seen = new Set();
    
    billsTxs.forEach(tx => {
      const key = `${tx.meta.provider}:${tx.meta.consumerNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSaved.push({
          providerCode: tx.meta.provider,
          consumerNumber: tx.meta.consumerNumber,
          amount: tx.amount
        });
      }
    });
    
    if (uniqueSaved.length > 0) {
      const quickSection = document.getElementById('quick-pay-section');
      const quickContainer = document.getElementById('quick-pay-chips');
      quickSection.style.display = 'block';
      quickContainer.innerHTML = uniqueSaved.slice(0, 3).map((item, index) => {
        return `
          <div class="quick-bill-item" data-index="${index}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; cursor: pointer; transition: all 0.2s ease;">
            <div>
              <div style="font-size: 12.5px; font-weight: 700; color: #fff;">${escapeHtml(item.providerCode)}</div>
              <div class="smallmuted" style="font-size: 11px; margin-top: 2px;">Consumer No: ${escapeHtml(item.consumerNumber)}</div>
            </div>
            <div style="font-size: 13px; font-weight: 700; color: var(--accent1);">
              ₹${item.amount.toFixed(2)}
            </div>
          </div>
        `;
      }).join('');
      
      quickContainer.querySelectorAll('.quick-bill-item').forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.getAttribute('data-index'));
          const item = uniqueSaved[idx];
          if (item) {
            const provSel = document.querySelector('select[name="providerCode"]');
            const consInput = document.querySelector('input[name="consumerNumber"]');
            const amtInput = document.querySelector('input[name="amount"]');
            
            if (provSel) {
              const allChip = document.querySelector('.category-chip[data-category="all"]');
              if (allChip) {
                chips.forEach(c => {
                  c.classList.remove('active');
                  c.classList.add('ghost');
                  c.style.background = 'transparent';
                  c.style.color = '#fff';
                  c.style.border = '1px solid rgba(255,255,255,0.08)';
                  c.style.fontWeight = '500';
                });
                allChip.classList.remove('ghost');
                allChip.classList.add('active');
                allChip.style.background = 'var(--accent1)';
                allChip.style.color = '#000';
                allChip.style.border = 'none';
                allChip.style.fontWeight = '700';
              }
              
              updateProvidersSelect('all');
              provSel.value = item.providerCode;
              provSel.dispatchEvent(new Event('change'));
            }
            if (consInput) consInput.value = item.consumerNumber;
            if (amtInput) {
              amtInput.value = item.amount.toFixed(2);
              amtInput.focus();
            }
          }
        });

        el.addEventListener('mouseenter', () => {
          el.style.background = 'rgba(255,255,255,0.025)';
          el.style.borderColor = 'var(--accent1)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.background = 'rgba(255,255,255,0.01)';
          el.style.borderColor = 'rgba(255,255,255,0.04)';
        });
      });
    }
  } catch (err) {
    console.warn('Failed to load saved bills', err);
  }

  // Handle Form Submission
  document.getElementById('form-bill').addEventListener('submit', async (e) => {
    e.preventDefault();
    const providerCode = e.target.providerCode.value;
    const consumerNumber = e.target.consumerNumber.value.trim();
    const amount = Number(e.target.amount.value);
    const msg = document.getElementById('bill-msg');

    if (!providerCode) {
      msg.textContent = 'Please select a provider';
      msg.className = 'err';
      return;
    }
    if (!consumerNumber) {
      msg.textContent = 'Please enter consumer/account number';
      msg.className = 'err';
      return;
    }
    if (amount <= 0 || isNaN(amount)) {
      msg.textContent = 'Amount must be a positive number';
      msg.className = 'err';
      return;
    }

    msg.textContent = 'Processing...';
    msg.className = '';
    try {
      const json = await apiFetch('/bills/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerCode, consumerNumber, amount })
      });
      msg.textContent = 'Bill paid';
      showStatusOverlay({ type: 'success', message: 'Bill paid successfully' });
      addNotification(`Successfully paid ₹${amount.toFixed(2)} to provider ${providerCode}`, 'success');
      
      if (json.user) {
        store.user = json.user;
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
        goto('receipt', { transaction: json.transaction, providerCode, consumerNumber, amount });
      }, 1200);
    } catch (err) {
      const raw = (err && err.message) ? String(err.message).toLowerCase() : '';
      const isInsufficient = /insufficient|not enough|negative|low balance|insuff/i.test(raw);
      const text = isInsufficient ? 'Insufficient balance' : (err.message || 'Payment failed');
      msg.textContent = text;
      msg.className = 'err';
      showStatusOverlay({ type: 'error', message: text });
    }
  });

  // Set initial focus to selection list
  document.querySelector('select[name="providerCode"]')?.focus();
}
