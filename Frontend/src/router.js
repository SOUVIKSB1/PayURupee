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
 */

import { store, logout } from './store.js';
import { apiFetch } from './api.js';

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
