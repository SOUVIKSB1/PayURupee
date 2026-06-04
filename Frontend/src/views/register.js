import { apiFetch } from '../api.js';
import { setAuth } from '../store.js';
import { goto } from '../router.js';

export function renderRegister() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card center fade-in" style="max-width:540px;margin:24px auto">
      <h2>Create account</h2>
      <p class="smallmuted">Register a new user</p>
      <form id="form-register" style="width:100%;margin-top:12px">
        <input name="name" required placeholder="Full name" class="input" />
        <input name="email" required placeholder="Email" class="input" />
        <input name="password" required type="password" placeholder="Password" class="input" />
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn" type="submit">Create account</button>
          <button type="button" class="btn ghost" id="to-login">Back to login</button>
        </div>
        <div id="reg-msg" class="smallmuted" style="margin-top:8px"></div>
      </form>
    </div>
  `;
  
  document.getElementById('to-login').addEventListener('click', () => goto('login'));
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const email = e.target.email.value.trim();
    const password = e.target.password.value;
    const msg = document.getElementById('reg-msg');
    msg.textContent = 'Creating...';
    msg.className = 'smallmuted';
    try {
      const json = await apiFetch('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      setAuth(json.token, json.user);
      msg.textContent = 'Account created';
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
  document.querySelector('input[name="name"]')?.focus();
}
