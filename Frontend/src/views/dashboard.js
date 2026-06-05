import { apiFetch } from '../api.js';
import { store } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml, formatCurrency, showMyQrModal, triggerCoinRain, showScratchCardModal, showToast, showContactDrawer, showSetPinModal } from '../utils.js';
import { addNotification } from '../notifications.js';

// Live count-up animation helper function
function animateCounter(element, start, end, duration = 1100) {
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing: easeOutExpo (starts fast, slows down smoothly)
    const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    
    const currentValue = start + (end - start) * easeProgress;
    element.textContent = formatCurrency(currentValue);
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = formatCurrency(end);
    }
  }
  
  requestAnimationFrame(update);
}

export async function renderDashboard() {
  const main = document.getElementById('main');
  
  main.innerHTML = `
    <div id="dashboard-wrapper" class="dashboard-grid fade-in">
      
      <!-- Split Hero Cards Row (Full Width at Top on Desktop) -->
      <div class="dashboard-hero-row">
        <!-- Left: Wallet Balance Card -->
        <div class="paytm-hero-card wallet-card-split">
          <div>
            <div class="paytm-balance-title">PayU₹upee Wallet</div>
            <div id="balance" class="paytm-balance-value">₹0.00</div>
          </div>
          <button class="small-btn solid" id="hero-topup" style="margin-top: 14px; width: 100%;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
            Add Money to Wallet
          </button>
        </div>
        
        <!-- Right: Profile / Quick Actions Card -->
        <div class="paytm-hero-card action-card-split">
          <div class="profile-card-header">
            <div class="smallmuted" style="font-weight: 600;">Account Profile</div>
            <div class="profile-user-name">${escapeHtml((store.user && store.user.name) || 'User')}</div>
          </div>
          
          <div class="paytm-quick-actions split-actions">
            <button class="paytm-item" id="hero-scan">
              <div class="paytm-icon-wrapper">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg>
              </div>
              <span>Scan & Pay</span>
            </button>
            
            <button class="paytm-item" id="hero-send">
              <div class="paytm-icon-wrapper">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </div>
              <span>Send</span>
            </button>

            <button class="paytm-item" id="hero-my-qr">
              <div class="paytm-icon-wrapper">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg>
              </div>
              <span>My QR</span>
            </button>
            
            <button class="paytm-item" id="hero-passbook">
              <div class="paytm-icon-wrapper">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <span>History</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- Columns section below the top hero split row -->
      <div class="dashboard-columns-row">
        <!-- Left Column: Primary Actions -->
        <div class="dashboard-main-col">
          <!-- Rewards Scratch Card Banner -->
          <!-- Rewards Scratch Card Banner -->
          <div id="rewards-banner-wrapper"></div>

          <!-- UPI Money Transfer Section -->
          <div class="paytm-section">
            <h3>UPI Money Transfer</h3>
            <div class="paytm-grid">
              <button class="paytm-item" id="upi-to-mobile">
                <div class="paytm-icon-wrapper">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                </div>
                <span>To Mobile</span>
              </button>
              
              <button class="paytm-item" id="upi-to-bank">
                <div class="paytm-icon-wrapper">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"></path></svg>
                </div>
                <span>To Bank A/c</span>
              </button>
              
              <button class="paytm-item" id="upi-to-self">
                <div class="paytm-icon-wrapper">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <span>To Self</span>
              </button>
              
              <button class="paytm-item" id="upi-scan">
                <div class="paytm-icon-wrapper">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                </div>
                <span>Scan QR</span>
              </button>
            </div>
          </div>
          
          <!-- People & Contacts (GPay Style) -->
          <div class="paytm-section" id="contacts-section" style="display: none;">
            <h3>People</h3>
            <div id="contacts-grid" style="display: flex; gap: 16px; overflow-x: auto; padding: 8px 4px 12px; scrollbar-width: none; -ms-overflow-style: none;">
              <!-- Loaded dynamically -->
            </div>
          </div>
          
          <!-- Recharge & Bill Payments Section -->
          <div class="paytm-section">
            <h3>Recharge & Bill Payments</h3>
            <div id="bill-providers-grid" class="paytm-grid">
              <div class="smallmuted" style="grid-column: span 4; padding: 12px 0;">Loading utilities...</div>
            </div>
          </div>
        </div>
        
        <!-- Right Column: Sidebar summaries -->
        <div class="dashboard-side-col">
          <!-- Admin Panel Section (Only visible to admin) -->
          <div id="admin-section-container"></div>
          
          <!-- Recent Transactions Section -->
          <div class="paytm-section">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 style="margin: 0;">Recent Transactions</h3>
              <button class="small-btn ghost" id="btn-view-all-tx" style="padding: 4px 8px; font-size: 11px;">View All</button>
            </div>
            <div id="recent-transactions-list" style="display: flex; flex-direction: column; gap: 10px;">
              <div class="smallmuted" style="text-align: center; padding: 12px 0;">Loading transactions...</div>
            </div>
        </div>
      </div>
    </div>
  `;

  // Bind Actions
  document.getElementById('hero-scan').addEventListener('click', () => goto('upload'));
  document.getElementById('hero-send').addEventListener('click', () => goto('send'));
  document.getElementById('hero-topup').addEventListener('click', () => goto('topup'));
  document.getElementById('hero-passbook').addEventListener('click', () => goto('history'));
  document.getElementById('hero-my-qr').addEventListener('click', () => showMyQrModal());
  const updateRewardsBanner = () => {
    const wrapper = document.getElementById('rewards-banner-wrapper');
    if (!wrapper) return;
    
    const pendingReward = (store.user && Array.isArray(store.user.rewards)) ? store.user.rewards.find(r => !r.scratched) : null;
    if (pendingReward) {
      wrapper.innerHTML = `
        <div class="rewards-banner" id="btn-dashboard-rewards" data-has-reward="true" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            <span class="rewards-gift-icon" style="flex-shrink: 0;">🎁</span>
            <div style="flex: 1; min-width: 0;">
              <h4 style="margin: 0; color: #fff; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Claim Your Cashback Rewards</h4>
              <p class="smallmuted" style="margin: 2px 0 0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(pendingReward.message || 'You have a pending scratch card! Tap to reveal.')}</p>
            </div>
          </div>
          <button class="small-btn solid" style="padding: 6px 12px; font-size: 11px; pointer-events: none; flex-shrink: 0;">Claim Now</button>
        </div>
      `;
    } else {
      wrapper.innerHTML = `
        <div class="rewards-banner" id="btn-dashboard-rewards" data-has-reward="false" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
            <span class="rewards-gift-icon" style="flex-shrink: 0;">🎁</span>
            <div style="flex: 1; min-width: 0;">
              <h4 style="margin: 0; color: #fff; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Pay Bills or Send Money to Earn Rewards</h4>
              <p class="smallmuted" style="margin: 2px 0 0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Exclusively for PayURupee active users</p>
            </div>
          </div>
          <button class="small-btn solid" style="padding: 6px 12px; font-size: 11px; pointer-events: none; flex-shrink: 0;">Learn More</button>
        </div>
      `;
    }
    
    // Bind click handler
    const btn = document.getElementById('btn-dashboard-rewards');
    if (btn) {
      btn.onclick = () => {
        const hasReward = btn.getAttribute('data-has-reward') === 'true';
        if (hasReward) {
          const currentPending = (store.user && Array.isArray(store.user.rewards)) ? store.user.rewards.find(r => !r.scratched) : null;
          if (currentPending) {
            showScratchCardModal(currentPending);
          }
        } else {
          showToast('Send money or pay utility bills to unlock cashback scratch cards!', 'info');
        }
      };
    }
  };

  // Initial draw of rewards banner
  updateRewardsBanner();
  
  document.getElementById('upi-to-mobile').addEventListener('click', () => goto('send'));
  document.getElementById('upi-to-bank').addEventListener('click', () => goto('send'));
  document.getElementById('upi-to-self').addEventListener('click', () => goto('topup'));
  document.getElementById('upi-scan').addEventListener('click', () => goto('upload'));
  
  document.getElementById('btn-view-all-tx').addEventListener('click', () => goto('history'));

  // Admin section inject
  if (store.user && store.user.role === 'admin') {
    const adminContainer = document.getElementById('admin-section-container');
    adminContainer.innerHTML = `
      <div class="paytm-section">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h3 style="margin: 0; color: var(--accent1);">🛡 Admin Controls</h3>
          <button id="btn-dashboard-admin" class="small-btn solid" style="padding: 4px 10px; font-size: 11px;">Open Panel</button>
        </div>
        <div id="admin-quick-summary" class="smallmuted">Loading statistics summary...</div>
      </div>
    `;
    document.getElementById('btn-dashboard-admin').addEventListener('click', () => goto('admin'));

    // Fetch Admin statistics
    (async () => {
      try {
        const [ujson, tjson] = await Promise.all([
          apiFetch('/admin/users'),
          apiFetch('/admin/transactions')
        ]);
        const users = ujson.users || [];
        const tx = tjson.data || [];
        const demoCount = tx.filter(t => t.meta && t.meta.force).length;
        const summaryEl = document.getElementById('admin-quick-summary');
        if (summaryEl) {
          summaryEl.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #e2e8f0; margin-top: 4px;">
              <div>Users: <strong style="color: var(--accent2);">${users.length}</strong></div>
              <div>Demo Deposits: <strong style="color: var(--accent1);">${demoCount}</strong></div>
              <div>Total Transactions: <strong>${tx.length}</strong></div>
            </div>
          `;
        }
      } catch (err) {
        console.warn('Failed to load admin stats', err);
        const summaryEl = document.getElementById('admin-quick-summary');
        if (summaryEl) summaryEl.textContent = 'Failed to load statistics summary';
      }
    })();
  }

  // Fetch Wallet Balance, Providers list, and Transactions in parallel
  const balEl = document.getElementById('balance');
  try {
    const [profile, providersJson, historyJson, contactsJson] = await Promise.all([
      apiFetch('/users/me'),
      apiFetch('/bills/providers'),
      apiFetch('/wallet/history'),
      apiFetch('/users/contacts').catch(() => ({ contacts: [] }))
    ]);
    
    // Live Counter Animation to count up from 0 to the actual balance
    const balanceAmount = profile.user.balance ?? 0;
    animateCounter(balEl, 0, balanceAmount, 900);
    
    let lastKnownBalance = balanceAmount;
    
    if (store.user && profile.user) {
      store.user = profile.user;
      localStorage.setItem('ewallet_user', JSON.stringify(store.user));
      updateRewardsBanner();
      if (!store.user.hasUpiPin) {
        showSetPinModal();
      }
    }
    
    // Shared unread state — hoisted here so the poll interval can access it
    let lastUnreadSenders = new Set();
    let updateUnreadDots = null; // will be assigned when contacts render
    let contactNameMap = {};     // email -> display name, filled when contacts render

    // Periodically poll balance state to capture live incoming peer transactions
    const pollInterval = setInterval(async () => {
      try {
        const [p, unreadRes] = await Promise.all([
          apiFetch('/users/me'),
          apiFetch('/chat/unread').catch(() => ({ unread: [], totalUnread: 0 }))
        ]);
        const nextBal = p.user.balance ?? 0;
        
        if (store.user && p.user) {
          store.user = p.user;
          localStorage.setItem('ewallet_user', JSON.stringify(store.user));
          updateRewardsBanner();
        }
        
        if (nextBal > lastKnownBalance) {
          console.log(`Balance update detected: ₹${lastKnownBalance} -> ₹${nextBal}. Triggering coin rain.`);
          const balNode = document.getElementById('balance');
          if (balNode) {
            animateCounter(balNode, lastKnownBalance, nextBal, 900);
          }
          triggerCoinRain();
        } else if (nextBal < lastKnownBalance) {
          const balNode = document.getElementById('balance');
          if (balNode) balNode.textContent = formatCurrency(nextBal);
        }
        
        lastKnownBalance = nextBal;

        // Handle unread chat message notifications
        const unreadList = unreadRes.unread || [];
        const currentSenders = new Set(unreadList.map(u => u.senderEmail));

        // Fire notification only for genuinely NEW senders not seen in last poll
        unreadList.forEach(u => {
          if (!lastUnreadSenders.has(u.senderEmail)) {
            // Resolve display name from the pre-built map (not fragile DOM querying)
            const name = contactNameMap[u.senderEmail] || u.senderEmail;
            if (u.isRequest) {
              // Money request notification
              const amt = u.latestAmount ? `₹${Number(u.latestAmount).toFixed(2)}` : '';
              addNotification(`💸 Money Request from ${name}${amt ? ': ' + amt : ''}`, 'info');
            } else {
              // Regular chat message notification
              const preview = u.latestText.substring(0, 45) + (u.latestText.length > 45 ? '…' : '');
              addNotification(`💬 New message from ${name}: "${preview}"`, 'info');
            }
          }
        });

        lastUnreadSenders = currentSenders;

        // Update avatar dots
        if (typeof updateUnreadDots === 'function') {
          updateUnreadDots(unreadList);
        }
      } catch (err) {
        console.warn('Dashboard poll cycle failed', err);
      }
    }, 8000);

    // Register cleanup to release interval on view navigate-away transitions
    window.__currentViewCleanup = () => {
      clearInterval(pollInterval);
    };
    
    // Render Providers
    const providersGrid = document.getElementById('bill-providers-grid');
    providersGrid.innerHTML = '';
    const providers = (providersJson.providers || []).slice(0, 4);
    
    if (providers.length === 0) {
      providersGrid.innerHTML = '<div class="smallmuted" style="grid-column: span 4; padding: 12px 0;">No utility providers available</div>';
    } else {
      providers.forEach(p => {
        const item = document.createElement('button');
        item.className = 'paytm-item';
        item.innerHTML = `
          <div class="paytm-icon-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M19 4v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <span>${escapeHtml(p.name)}</span>
        `;
        item.addEventListener('click', () => {
          goto('bills');
          setTimeout(() => {
            const sel = document.querySelector('select[name="providerCode"]');
            if (sel) sel.value = p.code;
          }, 200);
        });
        providersGrid.appendChild(item);
      });
    }

    // Render GPay Style Contacts List
    const contactsSection = document.getElementById('contacts-section');
    const contactsGrid = document.getElementById('contacts-grid');
    const contacts = contactsJson.contacts || [];
    
    if (contacts.length > 0 && contactsGrid) {
      contactsSection.style.display = 'block';
      contactsGrid.innerHTML = '';
      
      const colors = ['#ff7a00', '#00a2ff', '#00d26a', '#7c5cff', '#e60072', '#ffbc00'];
      
      // Map from contact email -> item DOM element for dot updates
      const contactItemMap = {};
      // contactNameMap is outer-scoped (let), fill it here

      contacts.forEach((contact, idx) => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'center';
        item.style.cursor = 'pointer';
        item.style.minWidth = '64px';
        item.style.textAlign = 'center';
        item.style.position = 'relative';
        item.dataset.contactEmail = contact.email;
        
        const initial = String(contact.name || contact.email || '?').charAt(0).toUpperCase();
        const color = colors[idx % colors.length];
        
        item.innerHTML = `
          <div style="position:relative; width:52px; height:52px;">
            <div style="width: 52px; height: 52px; border-radius: 50%; background: ${color}22; border: 1.5px solid ${color}; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; box-shadow: 0 4px 12px ${color}11; transition: all 0.2s ease;" class="contact-avatar">
              ${initial}
            </div>
            <span class="contact-unread-dot" style="display:none; position:absolute; top:1px; right:1px; width:13px; height:13px; background:#ff3b5c; border-radius:50%; border:2px solid #08080a; z-index:2; animation: msgDotPulse 1.4s infinite;"></span>
          </div>
          <span style="font-size: 11.5px; font-weight: 600; color: #fff; margin-top: 8px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(contact.name ? contact.name.split(' ')[0] : contact.email.split('@')[0])}
          </span>
        `;
        
        item.addEventListener('click', async () => {
          // Clear the dot immediately on click
          const dot = item.querySelector('.contact-unread-dot');
          if (dot) dot.style.display = 'none';
          // Mark messages from this contact as read on backend
          try {
            await apiFetch('/chat/mark-read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ senderEmail: contact.email })
            });
          } catch (e) { /* silent */ }
          showContactDrawer(contact, color);
        });
        
        const avatar = item.querySelector('.contact-avatar');
        item.style.transition = 'all 0.2s ease';
        
        item.addEventListener('mouseenter', () => {
          avatar.style.transform = 'scale(1.1)';
          avatar.style.boxShadow = `0 6px 16px ${color}33`;
        });
        item.addEventListener('mouseleave', () => {
          avatar.style.transform = 'scale(1)';
          avatar.style.boxShadow = `0 4px 12px ${color}11`;
        });
        
        contactsGrid.appendChild(item);
        contactItemMap[contact.email] = item;
        // Store display name for use in notifications (no DOM querying needed)
        contactNameMap[contact.email] = contact.name
          ? contact.name.split(' ')[0]
          : contact.email.split('@')[0];
      });

      // Helper: refresh unread dots on contact avatars (assigned to outer-scope var)
      updateUnreadDots = function(unreadList) {
        // unreadList: [{ senderEmail, count, latestText }]
        const unreadEmails = new Set(unreadList.map(u => u.senderEmail));
        Object.entries(contactItemMap).forEach(([email, el]) => {
          const dot = el.querySelector('.contact-unread-dot');
          if (!dot) return;
          dot.style.display = unreadEmails.has(email) ? 'block' : 'none';
        });
      };

      // Initial unread fetch (lastUnreadSenders is outer-scoped)
      try {
        const initUnread = await apiFetch('/chat/unread');
        const initList = initUnread.unread || [];
        updateUnreadDots(initList);
        initList.forEach(u => lastUnreadSenders.add(u.senderEmail));
      } catch (e) { /* silent */ }
    }

    // Render Recent Transactions (Max 5)
    const transactionsList = document.getElementById('recent-transactions-list');
    transactionsList.innerHTML = '';
    const history = (historyJson.data || historyJson.history || []).slice(0, 5);
    
    if (history.length === 0) {
      transactionsList.innerHTML = '<div class="smallmuted" style="text-align: center; padding: 12px 0;">No recent transactions</div>';
    } else {
      history.forEach(tx => {
        const fromId = (tx.from && typeof tx.from === 'object') ? tx.from._id : tx.from;
        const isSender = (tx.type === 'send' || tx.type === 'transfer') && String(fromId) === String(store.user?.id || store.user?._id);
        
        let isDebit = false;
        if (tx.type === 'bill') {
          isDebit = true;
        } else if (tx.type === 'topup' || tx.type === 'deposit') {
          isDebit = false;
        } else {
          isDebit = isSender;
        }

        const typeLabel = (tx.type === 'deposit' || tx.type === 'topup') ? 'Added Money' : 
                          (tx.type === 'bill' ? 'Bill Payment' : 
                          (isSender ? 'Sent Money' : 'Received Money'));

        const fromEmail = (tx.from && typeof tx.from === 'object') ? tx.from.email : (tx.fromUser ? tx.fromUser.email : '');
        const toEmail = (tx.to && typeof tx.to === 'object') ? tx.to.email : (tx.toUser ? tx.toUser.email : '');
        const partnerEmail = isSender ? toEmail : fromEmail;

        const metaInfo = (tx.type === 'deposit' || tx.type === 'topup') ? (tx.meta?.note || 'Wallet') : 
                         (tx.type === 'bill' ? (tx.meta?.provider || 'Bill Payment') :
                         (partnerEmail || tx.meta?.note || 'Secure Transfer'));

        const amountFormatted = (isDebit ? '-' : '+') + formatCurrency(tx.amount);
        const amountColor = isDebit ? '#ff5c6c' : '#00d26a';
        
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.padding = '12px 14px';
        row.style.background = 'rgba(255, 255, 255, 0.01)';
        row.style.border = '1px solid rgba(255, 255, 255, 0.03)';
        row.style.borderRadius = '10px';
        row.style.cursor = 'pointer';
        
        row.innerHTML = `
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #fff;">${escapeHtml(typeLabel)}</div>
            <div class="smallmuted" style="font-size: 11px; margin-top: 2px;">${escapeHtml(metaInfo)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; font-weight: 700; color: ${amountColor};">${amountFormatted}</div>
            <div class="smallmuted" style="font-size: 10px; margin-top: 2px;">${new Date(tx.createdAt).toLocaleDateString()}</div>
          </div>
        `;

        row.addEventListener('click', () => {
          let providerCode = '';
          let consumerNumber = '';
          let toEmail = '';
          let note = tx.meta?.note || '';
          
          if (tx.type === 'bill') {
            providerCode = tx.meta?.provider || '';
            consumerNumber = tx.meta?.consumerNumber || tx.meta?.consumerNo || '';
          } else if (tx.type === 'send') {
            toEmail = tx.to?.email || tx.meta?.toEmail || tx.meta?.recipientEmail || '';
          }
          
          goto('receipt', {
            transaction: tx,
            providerCode,
            consumerNumber,
            amount: tx.amount,
            type: tx.type === 'send' ? 'send' : 'bill',
            toEmail,
            note
          });
        });

        transactionsList.appendChild(row);
      });
    }

  } catch (err) {
    balEl.textContent = '₹—';
    console.warn('Dashboard rendering fetch failed', err);
    const providersGrid = document.getElementById('bill-providers-grid');
    if (providersGrid) providersGrid.innerHTML = '<div class="smallmuted" style="grid-column: span 4; padding: 12px 0;">Failed to load details</div>';
    const transactionsList = document.getElementById('recent-transactions-list');
    if (transactionsList) transactionsList.innerHTML = '<div class="smallmuted" style="text-align: center; padding: 12px 0;">Failed to load transactions</div>';
  }
}
