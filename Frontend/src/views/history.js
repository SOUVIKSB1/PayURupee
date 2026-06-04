import { apiFetch } from '../api.js';
import { escapeHtml, formatCurrency } from '../utils.js';

export async function renderHistory() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card fade-in" style="max-width:900px;margin:12px auto">
      <h2>Transactions</h2>
      <p class="smallmuted">Recent activity</p>
      <div id="tx-list" style="margin-top:12px">Loading...</div>
    </div>
  `;
  try {
    const json = await apiFetch('/wallet/history');
    const data = json.data || [];
    const container = document.getElementById('tx-list');
    if (data.length === 0) {
      container.innerHTML = `<div class="smallmuted">No transactions yet</div>`;
      return;
    }
    const html = `
      <table class="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Details</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(tx => {
            const dt = new Date(tx.createdAt).toLocaleString();
            const type = escapeHtml(tx.type);
            const details = escapeHtml(tx.meta?.note || tx.meta?.provider || tx._id || '');
            const amt = (tx.type === 'send' ? '-' : '') + formatCurrency(tx.amount);
            return `<tr><td>${dt}</td><td>${type}</td><td>${details}</td><td><strong>${amt}</strong></td></tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
    container.innerHTML = html;
  } catch (err) {
    document.getElementById('tx-list').innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
  }
}
