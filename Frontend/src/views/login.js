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
        <div id="login-msg" class="${errorMsg ? 'smallmuted err' : 'smallmuted'}" style="margin-top:8px">${errorMsg ? escapeHtml(errorMsg) : ''}</div>
      </form>
    </div>
  `;

  document.getElementById('to-register').addEventListener('click', () => goto('register'));
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
