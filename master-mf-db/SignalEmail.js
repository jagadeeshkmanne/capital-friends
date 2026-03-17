/**
 * ============================================================================
 * SIGNAL EMAIL — Format and send signal notification emails
 * ============================================================================
 */

/**
 * Send email notifications for all PENDING signals that haven't been emailed yet
 */
function sendSignalEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SCREENER_CONFIG.sheets.signals);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 16).getValues();
  const pendingSignals = [];

  for (let i = 0; i < data.length; i++) {
    const status = String(data[i][11]).trim(); // col L
    const emailSent = String(data[i][14]).trim(); // col O

    if (status === 'PENDING' && emailSent !== 'YES') {
      pendingSignals.push({
        row: i + 2,
        signalId: data[i][0],
        date: data[i][1],
        type: String(data[i][2]),
        priority: data[i][3],
        symbol: String(data[i][4]),
        name: String(data[i][5]),
        action: String(data[i][6]),
        amount: data[i][7],
        shares: data[i][8],
        triggerDetail: String(data[i][9]),
        fundamentals: String(data[i][10])
      });
    }
  }

  if (pendingSignals.length === 0) {
    Logger.log('No pending signals to email');
    return;
  }

  // Sort by priority (1 = highest)
  pendingSignals.sort(function(a, b) { return a.priority - b.priority; });

  // Build email
  const isPaper = getScreenerConfigValue('PAPER_TRADING');
  const subject = (isPaper ? '📝 [PAPER] ' : '') + 'Stock Screener: ' +
    pendingSignals.length + ' signal(s) — ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd MMM yyyy');

  let html = '<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">';

  if (isPaper) {
    html += '<div style="background: #fff3cd; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px;">';
    html += '<strong>📝 PAPER TRADING MODE</strong> — No real money. Review signals for learning.';
    html += '</div>';
  }

  for (let i = 0; i < pendingSignals.length; i++) {
    const sig = pendingSignals[i];
    html += _buildSignalCard(sig);
  }

  html += '<div style="color: #888; font-size: 12px; margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee;">';
  html += 'Capital Friends Stock Screener v3.1 | ';
  html += '<a href="https://capitalfriends.in">Open Dashboard</a>';
  html += '</div>';
  html += '</div>';

  // Send
  try {
    const email = Session.getEffectiveUser().getEmail();
    if (email) {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: html
      });

      // Mark all as emailed
      for (let i = 0; i < pendingSignals.length; i++) {
        sheet.getRange(pendingSignals[i].row, 15).setValue('YES'); // col O: Email Sent
      }

      Logger.log('Sent signal email with ' + pendingSignals.length + ' signals to ' + email);
    }
  } catch (e) {
    Logger.log('Error sending signal email: ' + e.message);
  }
}

/**
 * Build HTML card for a single signal
 */
function _buildSignalCard(sig) {
  const colors = {
    BUY_STARTER: { bg: '#d4edda', border: '#28a745', icon: '🟢', label: 'BUY STARTER' },
    ADD1: { bg: '#d4edda', border: '#28a745', icon: '📈', label: 'ADD #1' },
    ADD2: { bg: '#d4edda', border: '#28a745', icon: '📈', label: 'ADD #2 (FULL POSITION)' },
    DIP_BUY: { bg: '#fff3cd', border: '#ffc107', icon: '📉', label: 'DIP BUY' },
    TRAILING_STOP: { bg: '#fff3cd', border: '#ffc107', icon: '🟡', label: 'TRAILING STOP' },
    HARD_EXIT: { bg: '#f8d7da', border: '#dc3545', icon: '🔴', label: 'HARD EXIT' },
    SOFT_EXIT: { bg: '#fff3cd', border: '#ffc107', icon: '🟡', label: 'SOFT EXIT — Review' },
    REBALANCE: { bg: '#d1ecf1', border: '#17a2b8', icon: '⚖️', label: 'REBALANCE' },
    LTCG_ALERT: { bg: '#d1ecf1', border: '#17a2b8', icon: '📅', label: 'LTCG ALERT' },
    SECTOR_ALERT: { bg: '#fff3cd', border: '#ffc107', icon: '⚠️', label: 'SECTOR ALERT' },
    FREEZE: { bg: '#f8d7da', border: '#dc3545', icon: '🔴', label: 'PORTFOLIO FREEZE' },
    CRASH_ALERT: { bg: '#fff3cd', border: '#ffc107', icon: '🟡', label: 'CRASH ALERT' },
    SYSTEMIC_EXIT: { bg: '#f8d7da', border: '#dc3545', icon: '🔴', label: 'SYSTEMIC EXIT' },
    MANUAL_REVIEW: { bg: '#d1ecf1', border: '#17a2b8', icon: '👁️', label: 'MANUAL REVIEW' }
  };

  const style = colors[sig.type] || { bg: '#f8f9fa', border: '#6c757d', icon: '📋', label: sig.type };

  let html = '<div style="background: ' + style.bg + '; border-left: 4px solid ' + style.border +
    '; padding: 15px; margin: 10px 0; border-radius: 0 8px 8px 0;">';

  html += '<div style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">';
  html += style.icon + ' ' + style.label + ': ' + sig.symbol;
  if (sig.name) html += ' — ' + sig.name;
  html += '</div>';

  html += '<div style="font-size: 14px; margin-bottom: 8px; font-weight: bold;">';
  html += sig.action;
  html += '</div>';

  if (sig.amount) {
    html += '<div style="font-size: 13px; color: #555;">Amount: ₹' + Math.round(sig.amount).toLocaleString() + '</div>';
  }

  if (sig.triggerDetail) {
    html += '<div style="font-size: 12px; color: #666; margin-top: 8px; padding: 8px; background: rgba(255,255,255,0.5); border-radius: 4px;">';
    html += sig.triggerDetail;
    html += '</div>';
  }

  html += '<div style="font-size: 11px; color: #999; margin-top: 6px;">Signal: ' + sig.signalId + '</div>';
  html += '</div>';

  return html;
}
