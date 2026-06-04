import { logout } from '../store.js';

export function renderMaintenance() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="fade-in" style="max-width: 480px; margin: 80px auto; padding: 0 16px; text-align: center;">
      <div class="card" style="padding: 40px 24px; display: flex; flex-direction: column; align-items: center; gap: 20px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);">
        <div style="font-size: 64px; animation: giftWobble 2s infinite; display: inline-block;">🛠️</div>
        <h2 style="font-size: 24px; font-weight: 800; color: #fff; margin: 0; background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Under Maintenance</h2>
        <p class="smallmuted" style="font-size: 14px; line-height: 1.6; margin: 0;">
          PayU₹upee is currently undergoing scheduled systems upgrades. We will be back online shortly. Thank you for your patience!
        </p>
        <button id="btn-maintenance-logout" class="btn ghost" style="margin-top: 12px; border-color: rgba(255,255,255,0.08); color: #fff; width: 100%; padding: 12px; font-weight: 600;">Sign Out</button>
      </div>
    </div>
  `;

  document.getElementById('btn-maintenance-logout').addEventListener('click', () => {
    logout();
  });
}
