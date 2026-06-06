/**
 * router.js
 * 
 * Provides client-side navigation (routing) logic for the e-wallet SPA application.
 * 
 * Routing features:
 * 1. Checks user authorization rules before rendering secure panels (`authGuard`).
 * 2. Dynamically loads view templates (using dynamic ES imports) only when requested,
 *    minimizing application startup load times.
 * 3. Handles scroll resets and mobile drop-down menu cleanups on route transitions.
 * 4. Manages in-app back navigation history stack.
 * 5. Shows a double-press exit confirmation when user presses back on the root page.
 */

import { store, logout } from './store.js';
import { apiFetch } from './api.js';

// ---------------------------------------------------------------------------
// Navigation History Stack
// ---------------------------------------------------------------------------

/**
 * Internal navigation history stack.
 * Each entry is { route, params } pushed every time goto() is called.
 */
const _navHistory = [];

/**
 * Tracks whether the user pressed back once already (for exit double-confirm).
 * Resets after 2 seconds.
 */
let _backPressedOnce = false;
let _backPressTimer = null;

/**
 * Set to true while goto() is running so the pushState inside goto()
 * does not re-trigger the popstate handler in an unexpected way.
 */
let _suppressPopstate = false;

/** Root routes where pressing back should trigger the exit prompt. */
const ROOT_ROUTES = new Set(['login', 'register', 'dashboard']);

/**
 * Shows a toast message at the bottom of the screen.
 * Used for the "Press back again to exit" notification.
 */
function showExitToast(message) {
  const existing = document.getElementById('exit-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'exit-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = message;

  Object.assign(toast.style, {
    position: 'fixed',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(30, 30, 40, 0.95)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '24px',
    fontSize: '14px',
    fontWeight: '500',
    zIndex: '99999',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.12)',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.2s ease',
    whiteSpace: 'nowrap',
  });

  document.body.appendChild(toast);

  // Double rAF to ensure the opacity transition actually plays
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
  });

  // Animate out after 2 seconds then remove
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 2000);
}

/**
 * Attempts to close the PWA / browser tab.
 * window.close() is blocked in standalone PWA; falls back to
 * collapsing the entire history stack (works in Android TWA / custom tabs).
 */
function exitApp() {
  try { window.close(); } catch (_) {}
  setTimeout(() => {
    try { history.go(-(history.length + 1)); } catch (_) {}
  }, 80);
}

/**
 * Handles the system/browser back button or gesture.
 *
 * Priority:
 *  1. Dismiss any open overlay (profile sheet, modal, notifications).
 *  2. Navigate to the previous in-app route.
 *  3. On a root page: first press shows a toast; second press exits the app.
 *
 * After each interception a new history entry is pushed so the NEXT
 * back press also fires popstate instead of letting the browser navigate away.
 */
function handleBackPress() {
  // ── 1. Dismiss open overlays ─────────────────────────────────────────────
  const profileSheet = document.getElementById('profile-sheet-mob');
  if (profileSheet && !profileSheet.classList.contains('hidden')) {
    profileSheet.classList.add('hidden');
    history.pushState({ _app: true }, '');
    return;
  }

  const notifDropdown = document.getElementById('notifications-dropdown');
  if (notifDropdown && !notifDropdown.classList.contains('hidden')) {
    notifDropdown.classList.add('hidden');
    history.pushState({ _app: true }, '');
    return;
  }

  const openModal = document.querySelector('.modal-overlay:not(.hidden)');
  if (openModal) {
    const closeBtn = openModal.querySelector('[id*="close"], [id*="cancel"], .modal-close, .btn-close');
    if (closeBtn) closeBtn.click();
    else openModal.classList.add('hidden');
    history.pushState({ _app: true }, '');
    return;
  }

  // ── 2. Navigate back in in-app history ───────────────────────────────────
  if (_navHistory.length > 1) {
    _navHistory.pop();                        // remove current
    const prev = _navHistory[_navHistory.length - 1];
    _navHistory.pop();                        // goto() will re-push it
    goto(prev.route, prev.params);            // goto sets _suppressPopstate
    return;
  }

  // ── 3. Already on root page — double-press exit ──────────────────────────
  const currentRoute = (_navHistory[0] && _navHistory[0].route) || 'login';
  if (ROOT_ROUTES.has(currentRoute)) {
    if (_backPressedOnce) {
      clearTimeout(_backPressTimer);
      _backPressedOnce = false;
      exitApp();
    } else {
      _backPressedOnce = true;
      showExitToast('Press back again to exit');
      // Keep an entry in browser history so next back press fires popstate
      history.pushState({ _app: true }, '');
      _backPressTimer = setTimeout(() => { _backPressedOnce = false; }, 2000);
    }
  }
}

// ---------------------------------------------------------------------------
// Replace the very first (page-load) history entry with our sentinel.
// Without this, pressing back from the FIRST goto() entry would pop to the
// browser's original null-state entry and popstate would have e.state === null,
// causing the handler to silently skip it and the browser to navigate away.
// ---------------------------------------------------------------------------
history.replaceState({ _app: true }, '');

// Intercept ALL popstate events (back button / swipe gesture)
window.addEventListener('popstate', () => {
  if (_suppressPopstate) return;
  handleBackPress();
});

/**
 * Route controller. Clears mobile menus, resets page scroll, and loads the respective
 * view renderer based on the path keyword string.
 * 
 * @param {string} route - The target path name ('login', 'dashboard', 'send', etc.).
 */
export function goto(route, params = {}) {
  // Reset window scroll offset to the top
  window.scrollTo(0, 0);

  // Clean up previous view resources (e.g. camera streams, intervals)
  if (window.__currentViewCleanup) {
    try {
      window.__currentViewCleanup();
    } catch (e) {
      console.warn('View cleanup error:', e);
    }
    window.__currentViewCleanup = null;
  }

  // Push route onto in-app history stack
  _navHistory.push({ route, params });

  // Push a browser history state entry so popstate fires on back button/gesture.
  // Suppress the popstate listener while we do this so it doesn't self-trigger.
  _suppressPopstate = true;
  history.pushState({ _app: true, route }, '');
  _suppressPopstate = false;

  // Collapse navigation bar menus if open (useful on mobile sizing)
  closeMobileMenu();
  
  // Highlight active navbar link
  updateActiveNavLink(route);
  
  // Switch case mapping path names to view files
  switch (route) {
    case 'login':
      import('./views/login.js').then(m => m.renderLogin());
      break;
    case 'register':
      import('./views/register.js').then(m => m.renderRegister());
      break;
    case 'send':
      authGuard(() => import('./views/send.js').then(m => m.renderSend()), 'send');
      break;
    case 'topup':
      authGuard(() => import('./views/topup.js').then(m => m.renderTopUp()), 'topup');
      break;
    case 'upload':
      authGuard(() => import('./views/upload.js').then(m => m.renderUpload()), 'upload');
      break;
    case 'bills':
      authGuard(() => import('./views/bills.js').then(m => m.renderBills()), 'bills');
      break;
    case 'jars':
      authGuard(() => import('./views/jars.js').then(m => m.renderJars()), 'jars');
      break;
    case 'rewards':
      authGuard(() => import('./views/rewards.js').then(m => m.renderRewards()), 'rewards');
      break;
    case 'card':
      authGuard(() => import('./views/card.js').then(m => m.renderCard()), 'card');
      break;
    case 'history':
      authGuard(() => import('./views/history.js').then(m => m.renderHistory()), 'history');
      break;
    case 'admin':
      authGuard(() => import('./views/admin.js').then(m => m.renderAdmin(params.tab || 'users')), 'admin');
      break;
    case 'checkout':
      authGuard(() => import('./views/checkout.js').then(m => m.renderCheckout()), 'checkout');
      break;
    case 'receipt':
      authGuard(() => import('./views/receipt.js').then(m => m.renderReceipt(params.transaction, params.providerCode, params.consumerNumber, params.amount, params.type, params.toEmail, params.note)), 'receipt');
      break;
    default:
      // Redirect undefined paths back to user dashboard panel
      authGuard(() => import('./views/dashboard.js').then(m => m.renderDashboard()), 'dashboard');
  }
}

/**
 * Secures routing access. If the user doesn't possess a valid session token,
 * redirects them immediately to the login view.
 * 
 * If they do, fetches their latest profile metadata details from the backend,
 * updates the local store credentials, and fires the corresponding render view function.
 * 
 * @param {Function} renderFn - Callback renderer execution block.
 * @param {string} targetRoute - The route name being requested.
 */
export function authGuard(renderFn, targetRoute = '') {
  if (!store.token) {
    import('./views/login.js').then(m => m.renderLogin());
    return;
  }

  // Optimize page loading: render immediately if user metadata exists in local storage
  if (store.user) {
    if (store.user.role === 'admin' && targetRoute !== 'admin') {
      import('./views/admin.js').then(m => m.renderAdmin(window.__currentAdminTab || 'users'));
    } else {
      renderFn();
    }
  }

  // Refresh profile details from backend in the background to keep balance/status synced
  apiFetch('/users/me').then(json => {
    const isFirstLoad = !store.user;
    store.user = json.user;
    localStorage.setItem('ewallet_user', JSON.stringify(store.user));
    
    if (window.__onAuthChange) window.__onAuthChange();
    
    // If we skipped initial rendering due to first time login (no local cache), render it now
    if (isFirstLoad) {
      if (store.user.role === 'admin' && targetRoute !== 'admin') {
        import('./views/admin.js').then(m => m.renderAdmin(window.__currentAdminTab || 'users'));
      } else {
        renderFn();
      }
    }
  }).catch(err => {
    console.warn('profile background verification failed', err);
    if (!store.user) {
      if (err.message && err.message.includes('maintenance')) {
        import('./views/maintenance.js').then(m => m.renderMaintenance());
      } else {
        logout();
        import('./views/login.js').then(m => m.renderLogin('Session expired — please login again'));
      }
    }
  });
}

/**
 * Utility helper to close the hamburger drop-down list navigation on small screens
 * during transition phases.
 */
function closeMobileMenu() {
  try {
    const mainNav = document.getElementById('main-nav');
    const navToggle = document.getElementById('nav-toggle');
    if (mainNav) mainNav.classList.remove('open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  } catch (_) {}
}

/**
 * Highlights the active page navigation button and resolves fallbacks.
 */
function updateActiveNavLink(route) {
  try {
    const targetRoute = (route === 'login' || route === 'register') ? '' : route;
    const buttons = document.querySelectorAll('#main-nav .nav-btn, #mobile-bottom-nav .m-nav-btn');
    buttons.forEach(btn => {
      btn.classList.remove('active');
      if (targetRoute === 'admin') {
        const activeTab = window.__currentAdminTab || 'users';
        if (btn.id === `nav-admin-${activeTab}` || btn.id === `m-nav-admin-${activeTab}`) {
          btn.classList.add('active');
        }
      } else {
        if (btn.id === `nav-${targetRoute}` || btn.id === `m-nav-${targetRoute}`) {
          btn.classList.add('active');
        }
      }
    });
  } catch (err) {
    console.warn('Failed to update active link styling', err);
  }
}
