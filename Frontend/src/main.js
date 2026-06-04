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
import { isDemoMode, setDemoMode } from './utils.js';

// DOM Nav Elements Reference Hooks
const navDashboard = document.getElementById('nav-dashboard');
const navSend = document.getElementById('nav-send');
const navTopup = document.getElementById('nav-topup');
const navUpload = document.getElementById('nav-upload');
const navBills = document.getElementById('nav-bills');
const navHistory = document.getElementById('nav-history');
const navAdmin = document.getElementById('nav-admin');
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

// DOM Auth Layout Elements
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const btnLogout = document.getElementById('btn-logout');
const userInfo = document.getElementById('user-info');

// Bind actions to navigation buttons
navDashboard.addEventListener('click', () => goto('dashboard'));
navSend.addEventListener('click', () => goto('send'));
if (navTopup) navTopup.addEventListener('click', () => goto('topup'));
navUpload.addEventListener('click', () => goto('upload'));
navBills.addEventListener('click', () => goto('bills'));
navHistory.addEventListener('click', () => goto('history'));
navAdmin.addEventListener('click', () => goto('admin'));

// Hamburger mobile menu toggle action click binding
if (navToggle && mainNav) {
  navToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

// Authentication trigger events binding
btnLogin.addEventListener('click', () => goto('login'));
btnRegister.addEventListener('click', () => goto('register'));
btnLogout.addEventListener('click', logout);

/**
 * Updates the user credentials display on the persistent topbar navigation header.
 * Shows name/role details and hides auth action buttons dynamically.
 */
export function renderTopbar() {
  if (store.user) {
    // If logged in, show username and profile role context
    userInfo.textContent = `${store.user.name} (${store.user.role})`;
    btnLogin.classList.add('hidden');
    btnRegister.classList.add('hidden');
    btnLogout.classList.remove('hidden');
    
    // Toggle Admin Panel button context visibility based on role access
    if (store.user.role === 'admin') {
      navAdmin.classList.remove('hidden');
    } else {
      navAdmin.classList.add('hidden');
    }
  } else {
    // Clean topbar status if logged out
    userInfo.textContent = '';
    btnLogin.classList.remove('hidden');
    btnRegister.classList.remove('hidden');
    btnLogout.classList.add('hidden');
    navAdmin.classList.add('hidden');
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

// --- Startup session check sequence ---
if (store.token) {
  // If user has a token, attempt profile validation checks before displaying the dashboard panel
  apiFetch('/users/me').then(json => {
    store.user = json.user;
    localStorage.setItem('ewallet_user', JSON.stringify(store.user));
    renderTopbar();
    goto('dashboard');
  }).catch(err => {
    console.warn('autologin failed', err);
    logout();
  });
} else {
  // Otherwise, default to user login page panel
  goto('login');
}
