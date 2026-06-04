import { goto } from '../router.js';
import { formatCurrency, escapeHtml } from '../utils.js';

export function renderReceipt(tx, providerCode, consumerNumber, amount, type = 'bill', toEmail = '', note = '') {
  const main = document.getElementById('main');
  const txId = tx ? tx._id : 'N/A';
  const dateStr = tx ? new Date(tx.createdAt).toLocaleString() : new Date().toLocaleString();

  const titleText = type === 'send' ? 'Transfer Successful' : 'Payment Successful';
  const subtitleText = type === 'send' ? 'Your funds have been transferred' : 'Your utility bill has been processed';
  const cardTitle = type === 'send' ? 'PayU₹upee TRANSFER RECEIPT' : 'PayU₹upee BILL RECEIPT';

  // Build rows dynamically based on receipt type
  let rowsHtml = '';
  if (type === 'send') {
    rowsHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
        <span class="smallmuted">Transaction ID:</span>
        <strong style="color: #fff; font-family: monospace;">${escapeHtml(txId)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
        <span class="smallmuted">Date & Time:</span>
        <span style="color: #fff;">${escapeHtml(dateStr)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
        <span class="smallmuted">Sent To:</span>
        <strong style="color: var(--accent1);">${escapeHtml(toEmail)}</strong>
      </div>
      ${note ? `
      <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
        <span class="smallmuted">Note / Message:</span>
        <span style="color: #fff;">"${escapeHtml(note)}"</span>
      </div>
      ` : ''}
      <div style="display: flex; justify-content: space-between; font-size: 12.5px; border-top: 1.5px dashed rgba(255,255,255,0.08); padding-top: 12px; margin-top: 4px;">
        <span class="smallmuted" style="font-weight: 700; font-size: 14px;">Total Sent:</span>
        <strong style="color: #00d26a; font-size: 16px;">${formatCurrency(amount)}</strong>
      </div>
    `;
  } else {
    rowsHtml = `
      <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
        <span class="smallmuted">Transaction ID:</span>
        <strong style="color: #fff; font-family: monospace;">${escapeHtml(txId)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
        <span class="smallmuted">Date & Time:</span>
        <span style="color: #fff;">${escapeHtml(dateStr)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
        <span class="smallmuted">Provider Code:</span>
        <strong style="color: var(--accent1);">${escapeHtml(providerCode)}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12.5px;">
        <span class="smallmuted">Consumer Number:</span>
        <span style="color: #fff; font-family: monospace;">${escapeHtml(consumerNumber)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12.5px; border-top: 1.5px dashed rgba(255,255,255,0.08); padding-top: 12px; margin-top: 4px;">
        <span class="smallmuted" style="font-weight: 700; font-size: 14px;">Total Paid:</span>
        <strong style="color: #00d26a; font-size: 16px;">${formatCurrency(amount)}</strong>
      </div>
    `;
  }

  main.innerHTML = `
    <div class="card fade-in" style="max-width: 480px; margin: 32px auto; padding: 24px; text-align: center;">
      <div style="font-size: 48px; color: #00d26a; margin-bottom: 8px;">✓</div>
      <h2 style="font-size: 20px; font-weight: 800; color: #fff; margin: 0; background: linear-gradient(135deg, #fff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${titleText}</h2>
      <p class="smallmuted" style="margin-top: 4px; font-size: 13px;">${subtitleText}</p>

      <!-- Receipt Slip Card -->
      <div id="receipt-slip" class="card" style="margin: 24px 0; padding: 20px; background: rgba(255,255,255,0.015); border: 1.5px dashed rgba(255,255,255,0.08); border-radius: 12px; text-align: left; position: relative;">
        <div style="text-align: center; border-bottom: 1px dashed rgba(255,255,255,0.08); padding-bottom: 16px; margin-bottom: 16px;">
          <div style="font-weight: 800; font-size: 16px; color: #fff; letter-spacing: 0.5px;">${cardTitle}</div>
          <div class="smallmuted" style="font-size: 11px; margin-top: 2px;">Thank you for using PayU₹upee</div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${rowsHtml}
        </div>

        <!-- Visual Barcode representation -->
        <div style="margin-top: 24px; text-align: center; opacity: 0.4;">
          <div style="font-family: monospace; font-size: 10px; letter-spacing: 2px; color: #fff; background: linear-gradient(90deg, #fff 2px, transparent 2px, transparent 4px, #fff 4px, #fff 8px, transparent 8px, transparent 10px, #fff 10px, #fff 11px, transparent 11px, transparent 14px, #fff 14px, #fff 18px) repeat-x; height: 32px; width: 180px; margin: 0 auto 4px;"></div>
          <div style="font-size: 9px; letter-spacing: 1px; color: var(--muted); font-weight: 500;">*${escapeHtml(txId.slice(-8).toUpperCase())}*</div>
        </div>
      </div>

      <div style="display: flex; gap: 8px;">
        <button id="btn-download-receipt" class="btn primary" style="flex: 1; padding: 12px; font-weight: 600;">Download Receipt</button>
        <button id="btn-receipt-done" class="btn ghost" style="flex: 1; padding: 12px; border-color: rgba(255,255,255,0.08); color: #fff;">Back to Home</button>
      </div>
    </div>
  `;

  document.getElementById('btn-receipt-done').addEventListener('click', () => {
    goto('dashboard');
  });

  document.getElementById('btn-download-receipt').addEventListener('click', () => {
    downloadAsImage(txId, dateStr, providerCode, consumerNumber, amount, type, toEmail, note);
  });
}

function downloadAsImage(txId, dateStr, providerCode, consumerNumber, amount, type, toEmail, note) {
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#08080a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Card boundary border
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Top branding
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PayU₹upee', canvas.width / 2, 50);

  ctx.fillStyle = '#888888';
  ctx.font = '11px sans-serif';
  ctx.fillText(type === 'send' ? 'TRANSFER RECEIPT' : 'BILL RECEIPT', canvas.width / 2, 72);

  // Draw Success badge
  ctx.fillStyle = 'rgba(0, 210, 106, 0.1)';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(canvas.width / 2 - 60, 95, 120, 26, 6);
  } else {
    ctx.rect(canvas.width / 2 - 60, 95, 120, 26);
  }
  ctx.fill();

  ctx.fillStyle = '#00d26a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('SUCCESS', canvas.width / 2, 112);

  // Separator line
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(30, 145);
  ctx.lineTo(canvas.width - 30, 145);
  ctx.stroke();

  // Draw Receipt Details
  ctx.setLineDash([]);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#888888';
  ctx.font = '13px sans-serif';

  const drawRow = (label, value, y, valueColor = '#ffffff') => {
    ctx.fillStyle = '#888888';
    ctx.fillText(label, 30, y);
    ctx.fillStyle = valueColor;
    ctx.textAlign = 'right';
    ctx.fillText(value, canvas.width - 30, y);
    ctx.textAlign = 'left'; // reset
  };

  drawRow('Transaction ID:', txId, 185);
  drawRow('Date & Time:', dateStr, 225);
  drawRow('Payment Mode:', 'Wallet Debit', 265);

  if (type === 'send') {
    drawRow('Recipient:', toEmail, 305, '#ff7a00');
    if (note) {
      drawRow('Note:', `"${note}"`, 345);
    }
  } else {
    drawRow('Provider Code:', providerCode, 305, '#ff7a00');
    drawRow('Consumer No:', consumerNumber, 345);
  }

  // Second separator
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(30, 385);
  ctx.lineTo(canvas.width - 30, 385);
  ctx.stroke();

  // Total Paid
  ctx.setLineDash([]);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(type === 'send' ? 'Total Sent:' : 'Total Paid:', 30, 425);
  
  ctx.fillStyle = '#00d26a';
  ctx.font = 'bold 18px sans-serif';
  const totalStr = '₹' + amount.toFixed(2);
  ctx.textAlign = 'right';
  ctx.fillText(totalStr, canvas.width - 30, 425);
  ctx.textAlign = 'left';

  // Thank you message
  ctx.fillStyle = '#666666';
  ctx.font = 'italic 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Thank you for choosing PayU₹upee!', canvas.width / 2, 475);

  // Trigger download
  const link = document.createElement('a');
  link.download = `PayURupee-Receipt-${txId.slice(-8)}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
