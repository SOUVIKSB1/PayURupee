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

import { store } from './store.js';
import { apiFetch } from './api.js';

/**
 * Route controller. Clears mobile menus, resets page scroll, and loads the respective
 * view renderer based on the path keyword string.
 * 
 * @param {string} route - The target path name ('login', 'dashboard', 'send', etc.).
 */
export function goto(route) {
  // Reset window scroll offset to the top
  window.scrollTo(0, 0);
  
  // Collapse navigation bar menus if open (useful on mobile sizing)
  closeMobileMenu();
  
  // Switch case mapping path names to view files
  switch (route) {
    case 'login':
      import('./views/login.js').then(m => m.renderLogin());
      break;
    case 'register':
      import('./views/register.js').then(m => m.renderRegister());
      break;
    case 'send':
      authGuard(() => import('./views/send.js').then(m => m.renderSend()));
      break;
    case 'topup':
      authGuard(() => import('./views/topup.js').then(m => m.renderTopUp()));
      break;
    case 'upload':
      authGuard(() => import('./views/upload.js').then(m => m.renderUpload()));
      break;
    case 'bills':
      authGuard(() => import('./views/bills.js').then(m => m.renderBills()));
      break;
    case 'history':
      authGuard(() => import('./views/history.js').then(m => m.renderHistory()));
      break;
    case 'admin':
      authGuard(() => import('./views/admin.js').then(m => m.renderAdmin()));
      break;
    default:
      // Redirect undefined paths back to user dashboard panel
      authGuard(() => import('./views/dashboard.js').then(m => m.renderDashboard()));
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
 */
export function authGuard(renderFn) {
  if (!store.token) {
    import('./views/login.js').then(m => m.renderLogin());
    return;
  }
  
  // Re-verify auth status by retrieving the profile metadata from the Backend
  apiFetch('/users/me').then(json => {
    // Save updated credentials to store & localStorage
    store.user = json.user;
    localStorage.setItem('ewallet_user', JSON.stringify(store.user));
    
    // Notify Topbar components to update profile view
    if (window.__onAuthChange) window.__onAuthChange();
    
    // Proceed to rendering the authenticated page layout
    renderFn();
  }).catch(err => {
    console.warn('profile fetch failed', err);
    // Force redirect to login screen on profile fetch rejection
    import('./views/login.js').then(m => m.renderLogin());
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
