/**
 * main.js
 * 
 * The central bootstrapper and entry script for the client application.
 * 
 * Scope:
 * 1. Attaches event listeners to persistent top bar navigation links.
 * 2. Manages hamburger toggling and responsive mobile side-menus.
 * 3. Handles profile UI renders on the top navigation bar.
 * 4. Triggers developer menu setups (demo toggles and API URL adjustments).
 * 5. Runs the startup script to auto-authenticate users with stored sessions.
 */

import { store, logout } from './store.js';
import { apiFetch } from './api.js';
import { goto } from './router.js';
import { isDemoMode, setDemoMode, showMyQrModal, showChangePinModal, showEditProfileModal } from './utils.js';
import { 
  updateNotificationBadge, 
  renderNotificationsList, 
  markAsRead, 
  clearNotifications,
  getNotifications,
  addNotification
} from './notifications.js';

// Navbar templates for standard users and administrators
const USER_DESKTOP_NAV = `
  <button id="nav-dashboard" class="nav-btn">
    <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
    <span>Dashboard</span>
  </button>
  <button id="nav-send" class="nav-btn">
    <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
    <span>Send</span>
  </button>
  <button id="nav-topup" class="nav-btn">
    <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
    <span>Top Up</span>
  </button>
  <button id="nav-upload" class="nav-btn">
    <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg>
    <span>Scan & Pay</span>
  </button>
  <button id="nav-bills" class="nav-btn">
    <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M19 4v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
    <span>Bills</span>
  </button>
  <button id="nav-history" class="nav-btn">
    <svg class="nav-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
    <span>History</span>
  </button>
`;

const ADMIN_DESKTOP_NAV = `
  <button id="nav-admin-users" class="nav-btn">
    <span style="font-size: 14px; margin-right: 6px; display: inline-block;">👥</span>
    <span>Users</span>
  </button>
  <button id="nav-admin-providers" class="nav-btn">
    <span style="font-size: 14px; margin-right: 6px; display: inline-block;">⚡</span>
    <span>Providers</span>
  </button>
  <button id="nav-admin-transactions" class="nav-btn">
    <span style="font-size: 14px; margin-right: 6px; display: inline-block;">📋</span>
    <span>Logs</span>
  </button>
  <button id="nav-admin-settings" class="nav-btn">
    <span style="font-size: 14px; margin-right: 6px; display: inline-block;">⚙️</span>
    <span>Settings</span>
  </button>
`;

const USER_MOBILE_NAV = `
  <button id="m-nav-dashboard" class="m-nav-btn">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
    <span>Home</span>
  </button>
  <button id="m-nav-send" class="m-nav-btn">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
    <span>Send</span>
  </button>
  <button id="m-nav-upload" class="m-nav-btn scan-pay-btn">
    <div class="scan-btn-inner">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="7" y="7" width="3" height="3"></rect><rect x="14" y="7" width="3" height="3"></rect><rect x="7" y="14" width="3" height="3"></rect><rect x="14" y="14" width="3" height="3"></rect></svg>
    </div>
    <span>Scan & Pay</span>
  </button>
  <button id="m-nav-bills" class="m-nav-btn">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M19 4v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
    <span>Bills</span>
  </button>
  <button id="m-nav-history" class="m-nav-btn">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
    <span>History</span>
  </button>
`;

const ADMIN_MOBILE_NAV = `
  <button id="m-nav-admin-users" class="m-nav-btn">
    <span style="font-size: 18px; display: block; margin-bottom: 2px;">👥</span>
    <span>Users</span>
  </button>
  <button id="m-nav-admin-providers" class="m-nav-btn">
    <span style="font-size: 18px; display: block; margin-bottom: 2px;">⚡</span>
    <span>Providers</span>
  </button>
  <button id="m-nav-admin-transactions" class="m-nav-btn">
    <span style="font-size: 18px; display: block; margin-bottom: 2px;">📋</span>
    <span>Logs</span>
  </button>
  <button id="m-nav-admin-settings" class="m-nav-btn">
    <span style="font-size: 18px; display: block; margin-bottom: 2px;">⚙️</span>
    <span>Settings</span>
  </button>
`;

// DOM Nav Elements Reference Hooks
const mainNav = document.getElementById('main-nav');
const mobileBottomNav = document.getElementById('mobile-bottom-nav');

// DOM Auth Layout Elements
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');

if (btnLogin) btnLogin.addEventListener('click', () => goto('login'));
if (btnRegister) btnRegister.addEventListener('click', () => goto('register'));
if (btnLogout) btnLogout.addEventListener('click', logout);

// Event delegation for desktop nav
if (mainNav) {
  mainNav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    const id = btn.id;
    if (id === 'nav-dashboard') goto('dashboard');
    else if (id === 'nav-send') goto('send');
    else if (id === 'nav-topup') goto('topup');
    else if (id === 'nav-upload') goto('upload');
    else if (id === 'nav-bills') goto('bills');
    else if (id === 'nav-history') goto('history');
    else if (id === 'nav-admin-users') {
      window.__currentAdminTab = 'users';
      goto('admin', { tab: 'users' });
    }
    else if (id === 'nav-admin-providers') {
      window.__currentAdminTab = 'providers';
      goto('admin', { tab: 'providers' });
    }
    else if (id === 'nav-admin-transactions') {
      window.__currentAdminTab = 'transactions';
      goto('admin', { tab: 'transactions' });
    }
    else if (id === 'nav-admin-settings') {
      window.__currentAdminTab = 'settings';
      goto('admin', { tab: 'settings' });
    }
  });
}

// Event delegation for mobile bottom nav
if (mobileBottomNav) {
  mobileBottomNav.addEventListener('click', (e) => {
    const btn = e.target.closest('.m-nav-btn');
    if (!btn) return;
    const id = btn.id;
    if (id === 'm-nav-dashboard') goto('dashboard');
    else if (id === 'm-nav-send') goto('send');
    else if (id === 'm-nav-upload') goto('upload');
    else if (id === 'm-nav-bills') goto('bills');
    else if (id === 'm-nav-history') goto('history');
    else if (id === 'm-nav-admin-users') {
      window.__currentAdminTab = 'users';
      goto('admin', { tab: 'users' });
    }
    else if (id === 'm-nav-admin-providers') {
      window.__currentAdminTab = 'providers';
      goto('admin', { tab: 'providers' });
    }
    else if (id === 'm-nav-admin-transactions') {
      window.__currentAdminTab = 'transactions';
      goto('admin', { tab: 'transactions' });
    }
    else if (id === 'm-nav-admin-settings') {
      window.__currentAdminTab = 'settings';
      goto('admin', { tab: 'settings' });
    }
  });
}

// Mobile Profile / Settings Sheet Drawer Interaction bindings
const userAvatarMob = document.getElementById('user-avatar-mob');
const profileSheetMob = document.getElementById('profile-sheet-mob');
const btnCloseProfileSheet = document.getElementById('btn-close-profile-sheet');
const sheetDevModeToggle = document.getElementById('sheet-dev-mode-toggle');
const sheetApiSettingsBtn = document.getElementById('sheet-api-settings-btn');
const sheetNavAdmin = document.getElementById('sheet-nav-admin');
const sheetBtnLogout = document.getElementById('sheet-btn-logout');

const sheetShowMyQr = document.getElementById('sheet-show-my-qr');

if (sheetShowMyQr) {
  sheetShowMyQr.addEventListener('click', () => {
    if (profileSheetMob) profileSheetMob.classList.add('hidden');
    showMyQrModal();
  });
}

const sheetEditProfile = document.getElementById('sheet-edit-profile');
if (sheetEditProfile) {
  sheetEditProfile.addEventListener('click', () => {
    if (profileSheetMob) profileSheetMob.classList.add('hidden');
    showEditProfileModal().catch(() => {});
  });
}

const sheetChangePin = document.getElementById('sheet-change-pin');
if (sheetChangePin) {
  sheetChangePin.addEventListener('click', () => {
    if (profileSheetMob) profileSheetMob.classList.add('hidden');
    showChangePinModal().catch(() => {});
  });
}

const userAvatar = document.getElementById('user-avatar');

const openProfileSheet = (e) => {
  e.stopPropagation();
  profileSheetMob.classList.remove('hidden');
  
  if (sheetDevModeToggle) {
    sheetDevModeToggle.textContent = isDemoMode() ? 'Demo Mode: ON' : 'Demo Mode: OFF';
  }
};

if (userAvatar && profileSheetMob) {
  userAvatar.addEventListener('click', openProfileSheet);
}
if (userAvatarMob && profileSheetMob) {
  userAvatarMob.addEventListener('click', openProfileSheet);
}

if (btnCloseProfileSheet && profileSheetMob) {
  btnCloseProfileSheet.addEventListener('click', () => {
    profileSheetMob.classList.add('hidden');
  });
}

if (profileSheetMob) {
  profileSheetMob.addEventListener('click', (e) => {
    if (e.target === profileSheetMob) {
      profileSheetMob.classList.add('hidden');
    }
  });
}

if (sheetDevModeToggle) {
  sheetDevModeToggle.addEventListener('click', () => {
    const current = isDemoMode();
    setDemoMode(!current);
    sheetDevModeToggle.textContent = !current ? 'Demo Mode: ON' : 'Demo Mode: OFF';
  });
}

if (sheetApiSettingsBtn) {
  sheetApiSettingsBtn.addEventListener('click', () => {
    const current = localStorage.getItem('API_BASE_URL') || (window.__API_BASE__ || 'http://localhost:4000/api');
    const next = prompt('Enter Backend API Base URL:\n(e.g., https://your-backend.onrender.com/api)', current);
    if (next !== null) {
      const trimmed = next.trim().replace(/\/$/, '');
      if (trimmed) {
        localStorage.setItem('API_BASE_URL', trimmed);
        alert(`API URL set to: ${trimmed}\nReloading page...`);
        window.location.reload();
      } else {
        localStorage.removeItem('API_BASE_URL');
        alert('API URL reset to default.\nReloading page...');
        window.location.reload();
      }
    }
  });
}

if (sheetNavAdmin) {
  sheetNavAdmin.addEventListener('click', () => {
    if (profileSheetMob) profileSheetMob.classList.add('hidden');
    goto('admin');
  });
}

if (sheetBtnLogout) {
  sheetBtnLogout.addEventListener('click', () => {
    if (profileSheetMob) profileSheetMob.classList.add('hidden');
    logout();
  });
}

// Notifications click & dropdown handling
const btnNotifications = document.getElementById('btn-notifications');
const notificationsDropdown = document.getElementById('notifications-dropdown');
const btnClearNotifications = document.getElementById('btn-clear-notifications');

if (btnNotifications && notificationsDropdown) {
  btnNotifications.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = notificationsDropdown.classList.toggle('hidden');
    if (!isHidden) {
      markAsRead();
      renderNotificationsList();
    }
  });
}

if (btnClearNotifications) {
  btnClearNotifications.addEventListener('click', (e) => {
    e.stopPropagation();
    clearNotifications();
  });
}

// Click outside to close notifications dropdown
document.addEventListener('click', (e) => {
  if (notificationsDropdown && !notificationsDropdown.classList.contains('hidden')) {
    const wrapper = document.querySelector('.notifications-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      notificationsDropdown.classList.add('hidden');
    }
  }
});

/**
 * Updates the user credentials display on the persistent topbar navigation header.
 * Shows name/role details and hides auth action buttons dynamically.
 */
export function renderTopbar() {
  const profileWrap = document.getElementById('user-profile-wrap');
  const profileWrapMob = document.getElementById('user-profile-wrap-mob');
  const userAvatar = document.getElementById('user-avatar');
  const userAvatarMob = document.getElementById('user-avatar-mob');
  const notificationsBtn = document.getElementById('btn-notifications');
  const notificationsDropdown = document.getElementById('notifications-dropdown');
  const mobileBottomNav = document.getElementById('mobile-bottom-nav');

  if (store.user) {
    // If logged in, show username and profile role context
    if (userInfo) userInfo.textContent = `${store.user.name} (${store.user.role})`;
    
    // Dynamically render desktop navbar and mobile bottom nav based on role
    if (mainNav) {
      mainNav.innerHTML = store.user.role === 'admin' ? ADMIN_DESKTOP_NAV : USER_DESKTOP_NAV;
    }
    if (mobileBottomNav) {
      mobileBottomNav.innerHTML = store.user.role === 'admin' ? ADMIN_MOBILE_NAV : USER_MOBILE_NAV;
    }
    
    // Display initials in user avatar container (both desktop and mobile)
    const nameParts = String(store.user.name || 'User').split(' ');
    const initials = nameParts.map(n => n[0]).join('').slice(0, 2).toUpperCase();
    if (userAvatar) userAvatar.textContent = initials;
    if (userAvatarMob) userAvatarMob.textContent = initials;
    
    // Update the profile sheet contents too
    const sheetAvatar = document.getElementById('sheet-avatar');
    const sheetUserName = document.getElementById('sheet-user-name');
    const sheetUserRole = document.getElementById('sheet-user-role');
    const sheetNavAdmin = document.getElementById('sheet-nav-admin');
    
    if (sheetAvatar) sheetAvatar.textContent = initials;
    if (sheetUserName) sheetUserName.textContent = store.user.name;
    if (sheetUserRole) sheetUserRole.textContent = `Role: ${store.user.role.toUpperCase()}`;
    if (sheetNavAdmin) {
      if (store.user.role === 'admin') {
        sheetNavAdmin.classList.remove('hidden');
      } else {
        sheetNavAdmin.classList.add('hidden');
      }
    }

    if (profileWrap) profileWrap.classList.remove('hidden');
    if (profileWrapMob) profileWrapMob.classList.remove('hidden');
    if (mobileBottomNav) mobileBottomNav.classList.remove('hidden');
    
    if (notificationsBtn) {
      notificationsBtn.classList.remove('hidden');
      // Seed default notifications if empty on login
      if (getNotifications().length === 0) {
        addNotification("Welcome to Pay U ₹upee! Setup your profile and make your first payment.", "info");
        addNotification("Try adding test funds instantly via the Top Up menu.", "info");
      }
      updateNotificationBadge();
      renderNotificationsList();
    }
    
    btnLogin.classList.add('hidden');
    btnRegister.classList.add('hidden');
    btnLogout.classList.remove('hidden');
  } else {
    // Clean topbar status if logged out
    if (userInfo) userInfo.textContent = '';
    if (profileWrap) profileWrap.classList.add('hidden');
    if (profileWrapMob) profileWrapMob.classList.add('hidden');
    if (mobileBottomNav) {
      mobileBottomNav.classList.add('hidden');
      mobileBottomNav.innerHTML = '';
    }
    if (mainNav) {
      mainNav.innerHTML = '';
    }
    
    if (notificationsBtn) notificationsBtn.classList.add('hidden');
    if (notificationsDropdown) notificationsDropdown.classList.add('hidden');
    
    btnLogin.classList.remove('hidden');
    btnRegister.classList.remove('hidden');
    btnLogout.classList.add('hidden');
  }
}

// Global hook for topbar rendering when authentication state updates
window.__onAuthChange = renderTopbar;

// Initial navigation top bar rendering
renderTopbar();

/**
 * Initializes developer sandbox configurations.
 * Binds actions to demo toggle indicators and server endpoint setting dialog options.
 */
const initUI = () => {
  const btn = document.getElementById('dev-mode-toggle');
  if (btn) {
    // Set UI label to reflect active storage state
    setDemoMode(isDemoMode());
    btn.addEventListener('click', () => {
      // Toggle value in storage on click
      setDemoMode(!isDemoMode());
    });
  }

  const apiBtn = document.getElementById('api-settings-btn');
  if (apiBtn) {
    apiBtn.addEventListener('click', () => {
      const current = localStorage.getItem('API_BASE_URL') || (window.__API_BASE__ || 'http://localhost:4000/api');
      const next = prompt('Enter Backend API Base URL:\n(e.g., https://your-backend.onrender.com/api)', current);
      if (next !== null) {
        const trimmed = next.trim().replace(/\/$/, '');
        if (trimmed) {
          localStorage.setItem('API_BASE_URL', trimmed);
          alert(`API URL set to: ${trimmed}\nReloading page...`);
          window.location.reload();
        } else {
          // Clear localStorage custom API value if prompt is blank (resets to defaults)
          localStorage.removeItem('API_BASE_URL');
          alert('API URL reset to default.\nReloading page...');
          window.location.reload();
        }
      }
    });
  }
};

// Bind developer controls initialization to DOM load lifecycle stages
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

// --- Parse external checkout parameters on startup ---
try {
  const urlParams = new URLSearchParams(window.location.search);
  const merchantEmail = urlParams.get('merchantEmail') || urlParams.get('merchant');
  const amount = urlParams.get('amount');
  const orderId = urlParams.get('orderId') || urlParams.get('reference');
  const callbackUrl = urlParams.get('callbackUrl') || urlParams.get('callback');
  
  if (merchantEmail && amount) {
    localStorage.setItem('checkout_params', JSON.stringify({
      merchantEmail,
      amount: Number(amount),
      orderId: orderId || 'N/A',
      callbackUrl: callbackUrl || ''
    }));
    // Clean URL query parameters from browser bar
    window.history.replaceState({}, document.title, window.location.pathname);
  }
} catch (e) {
  console.warn('Failed to parse query params', e);
}

// --- Startup session check sequence ---
const stashedCheckout = localStorage.getItem('checkout_params');
if (store.token) {
  // If user has a token, attempt profile validation checks before displaying the dashboard panel
  apiFetch('/users/me').then(json => {
    store.user = json.user;
    localStorage.setItem('ewallet_user', JSON.stringify(store.user));
    renderTopbar();
    if (stashedCheckout) {
      goto('checkout');
    } else {
      goto('dashboard');
    }
  }).catch(err => {
    console.warn('autologin failed', err);
    logout();
  });
} else {
  // Otherwise, default to user login page panel
  goto('login');
}

// Track click coordinates to feed macOS-style screen zoom origin points
document.addEventListener('click', (e) => {
  const main = document.getElementById('main');
  if (main) {
    const rect = main.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    main.style.setProperty('--zoom-origin-x', `${x}px`);
    main.style.setProperty('--zoom-origin-y', `${y}px`);
  }
});

// Dynamic Scroll Reveal Fallback for browsers lacking native Scroll-Driven animations support (Firefox / older Safari)
if (!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
  const scrollObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      }
    },
    { threshold: 0.05 }
  );

  const initRevealOnElements = () => {
    document.querySelectorAll('.card:not(.reveal-observed), .paytm-hero-card:not(.reveal-observed)').forEach((el) => {
      el.classList.add('reveal-observed', 'scroll-reveal');
      scrollObserver.observe(el);
    });
  };

  // Observe dynamically loaded router views / components
  const pageMutationObserver = new MutationObserver(initRevealOnElements);
  pageMutationObserver.observe(document.body, { childList: true, subtree: true });

  // Initial check
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRevealOnElements);
  } else {
    initRevealOnElements();
  }
}

