import { apiFetch } from '../api.js';
import { escapeHtml, formatCurrency } from '../utils.js';
import { goto } from '../router.js';

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
      <div class="table-responsive" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;">
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
            ${data.map((tx, idx) => {
              const dt = new Date(tx.createdAt).toLocaleString();
              const type = escapeHtml(tx.type === 'send' ? 'Sent Money' : tx.type === 'bill' ? 'Bill Payment' : tx.type === 'topup' ? 'Added Money' : tx.type);
              
              let detailText = '';
              if (tx.type === 'send') {
                detailText = `To: ${tx.to?.email || tx.meta?.toEmail || tx.meta?.recipientEmail || 'N/A'}`;
              } else if (tx.type === 'receive') {
                detailText = `From: ${tx.from?.email || 'N/A'}`;
              } else if (tx.type === 'bill') {
                detailText = `Provider: ${tx.meta?.provider || 'N/A'}`;
              } else {
                detailText = tx.meta?.note || '';
              }
              
              const isDebit = tx.type === 'send' || tx.type === 'bill';
              const amt = (isDebit ? '-' : '+') + formatCurrency(tx.amount);
              const amtColor = isDebit ? '#ff5c6c' : '#00d26a';
              return `<tr class="tx-row" data-index="${idx}" style="cursor: pointer;">
                <td style="white-space: nowrap;">${dt}</td>
                <td>${type}</td>
                <td style="min-width: 150px;">${escapeHtml(detailText)}</td>
                <td><strong style="color: ${amtColor}">${amt}</strong></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = html;

    container.querySelectorAll('.tx-row').forEach(row => {
      row.addEventListener('click', () => {
        const idx = parseInt(row.getAttribute('data-index'));
        const tx = data[idx];
        if (tx) {
          let providerCode = '';
          let consumerNumber = '';
          let toEmail = '';
          let note = tx.meta?.note || '';
          
          if (tx.type === 'bill') {
            providerCode = tx.meta?.provider || '';
            consumerNumber = tx.meta?.consumerNumber || tx.meta?.consumerNo || '';
          } else if (tx.type === 'send') {
            toEmail = tx.to?.email || tx.meta?.toEmail || tx.meta?.recipientEmail || '';
          }
          
          goto('receipt', {
            transaction: tx,
            providerCode,
            consumerNumber,
            amount: tx.amount,
            type: tx.type === 'send' ? 'send' : 'bill',
            toEmail,
            note
          });
        }
      });
    });
  } catch (err) {
    document.getElementById('tx-list').innerHTML = `<div class="err">${escapeHtml(err.message)}</div>`;
  }
}
