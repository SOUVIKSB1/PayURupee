import { apiFetch } from '../api.js';
import { setAuth } from '../store.js';
import { goto } from '../router.js';
import { escapeHtml } from '../utils.js';

export function renderLogin(errorMsg = '') {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card center fade-in" style="max-width:460px;margin:24px auto">
      <h2>Sign in</h2>
      <p class="smallmuted">Use your email and password</p>
      
      <form id="form-login" style="width:100%;margin-top:12px">
        <input name="email" required placeholder="Email" class="input" />
        <input name="password" required type="password" placeholder="Password" class="input" />
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn" type="submit">Sign in</button>
          <button type="button" class="btn ghost" id="to-register">Create account</button>
        </div>
        <div style="margin-top: 15px; text-align: center;">
          <a href="#" id="to-reset" class="smallmuted" style="text-decoration: underline; cursor: pointer; font-size: 0.9rem;">Forgot password?</a>
        </div>
        <div id="login-msg" class="${errorMsg ? 'smallmuted err' : 'smallmuted'}" style="margin-top:8px">${errorMsg ? escapeHtml(errorMsg) : ''}</div>
      </form>
    </div>
  `;

  document.getElementById('to-register').addEventListener('click', () => goto('register'));
  document.getElementById('to-reset').addEventListener('click', (e) => {
    e.preventDefault();
    renderResetForm();
  });
  
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const msg = document.getElementById('login-msg');
    msg.textContent = 'Signing in...';
    msg.className = 'smallmuted';
    try {
      const json = await apiFetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      setAuth(json.token, json.user);
      msg.textContent = 'Welcome, ' + json.user.name;
      if (localStorage.getItem('checkout_params')) {
        goto('checkout');
      } else {
        goto('dashboard');
      }
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add('err');
    }
  });
  
  // Set initial focus to the first input field
  document.querySelector('input[name="email"]')?.focus();
}

function renderResetForm() {
  const card = document.querySelector('.card');
  card.innerHTML = `
    <h2>Reset Password</h2>
    <p class="smallmuted">Enter your email and new password</p>
    
    <form id="form-reset" style="width:100%;margin-top:12px">
      <input name="email" required placeholder="Email" class="input" />
      <input name="password" required type="password" placeholder="New Password" class="input" />
      <input name="confirmPassword" required type="password" placeholder="Confirm Password" class="input" />
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn" type="submit">Reset password</button>
        <button type="button" class="btn ghost" id="back-to-login">Back to login</button>
      </div>
      <div id="reset-msg" class="smallmuted" style="margin-top:8px"></div>
    </form>
  `;
  
  document.getElementById('back-to-login').addEventListener('click', () => {
    renderLogin();
  });
  
  document.getElementById('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const confirmPassword = e.target.confirmPassword.value;
    const msg = document.getElementById('reset-msg');
    
    if (password !== confirmPassword) {
      msg.textContent = 'Passwords do not match';
      msg.className = 'smallmuted err';
      return;
    }
    
    msg.textContent = 'Resetting password...';
    msg.className = 'smallmuted';
    
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword })
      });
      
      msg.textContent = 'Password reset successful! Redirecting to login...';
      msg.className = 'smallmuted success';
      setTimeout(() => {
        renderLogin();
      }, 1500);
    } catch (err) {
      msg.textContent = err.message;
      msg.className = 'smallmuted err';
    }
  });
  
  document.querySelector('input[name="email"]')?.focus();
}
