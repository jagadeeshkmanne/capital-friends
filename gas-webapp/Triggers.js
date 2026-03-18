/**
 * ============================================================================
 * TRIGGERS.GS - Event Triggers for Capital Friends V2
 * ============================================================================
 */

/**
 * Install all required triggers programmatically
 * Called automatically during ONE-CLICK SETUP
 * Can also be run manually from menu if needed
 */
function installTriggers(showMessage = true) {
  // First, remove any existing triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Install onEdit trigger
  ScriptApp.newTrigger('onEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();

  // Install email schedule trigger if configured
  installEmailScheduleTrigger();

  // Install reminder notification trigger (daily check at 8 AM)
  installReminderTrigger();

  // Install screener email trigger (daily at 10 AM IST — after Master DB runs at 9:30)
  installScreenerEmailTrigger();

  // Only show message if called manually from menu
  if (showMessage) {
    showSuccess('Triggers installed successfully! You can now click "✏️ Edit" buttons in sheets.');
  }
}

/**
 * Install email report trigger based on Settings
 * Supports Daily, Weekly, and Monthly frequencies
 */
function installEmailScheduleTrigger() {
  try {
    // Remove any existing email triggers first
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendScheduledDailyEmail') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Check if email is configured
    const emailConfigured = getSetting('EmailConfigured');

    if (!emailConfigured || emailConfigured.toString().toUpperCase() !== 'TRUE') {
      Logger.log('Email not configured, skipping email trigger installation');
      return;
    }

    // Get frequency setting (default to Daily)
    const frequency = getSetting('EmailFrequency') || 'Daily';

    // Get time settings (defaults: 9 AM)
    const emailHour = parseInt(getSetting('EmailHour') || '9');
    const emailMinute = parseInt(getSetting('EmailMinute') || '0');

    let trigger = null;

    if (frequency === 'Daily') {
      // Create daily trigger at specified time
      trigger = ScriptApp.newTrigger('sendScheduledDailyEmail')
        .timeBased()
        .everyDays(1)
        .atHour(emailHour)
        .nearMinute(emailMinute)
        .create();

      Logger.log('Daily email trigger installed for ' + emailHour + ':' + (emailMinute < 10 ? '0' + emailMinute : emailMinute));

    } else if (frequency === 'Weekly') {
      // Get day of week (0 = Sunday, 6 = Saturday)
      const dayOfWeek = parseInt(getSetting('EmailDayOfWeek') || '0');

      // Map to ScriptApp day constants
      const days = [
        ScriptApp.WeekDay.SUNDAY,
        ScriptApp.WeekDay.MONDAY,
        ScriptApp.WeekDay.TUESDAY,
        ScriptApp.WeekDay.WEDNESDAY,
        ScriptApp.WeekDay.THURSDAY,
        ScriptApp.WeekDay.FRIDAY,
        ScriptApp.WeekDay.SATURDAY
      ];

      trigger = ScriptApp.newTrigger('sendScheduledDailyEmail')
        .timeBased()
        .onWeekDay(days[dayOfWeek])
        .atHour(emailHour)
        .nearMinute(emailMinute)
        .create();

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      Logger.log('Weekly email trigger installed for ' + dayNames[dayOfWeek] + ' at ' + emailHour + ':' + (emailMinute < 10 ? '0' + emailMinute : emailMinute));

    } else if (frequency === 'Monthly') {
      // Get day of month (1-28)
      const dayOfMonth = parseInt(getSetting('EmailDayOfMonth') || '1');

      trigger = ScriptApp.newTrigger('sendScheduledDailyEmail')
        .timeBased()
        .onMonthDay(dayOfMonth)
        .atHour(emailHour)
        .nearMinute(emailMinute)
        .create();

      Logger.log('Monthly email trigger installed for day ' + dayOfMonth + ' at ' + emailHour + ':' + (emailMinute < 10 ? '0' + emailMinute : emailMinute));
    }

  } catch (error) {
    Logger.log('Error installing email schedule trigger: ' + error.toString());
  }
}

/**
 * Remove daily email report trigger
 */
function removeEmailScheduleTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'sendScheduledDailyEmail') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    Logger.log('Daily email trigger removed');
  } catch (error) {
    Logger.log('Error removing email schedule trigger: ' + error.toString());
  }
}

/**
 * Scheduled daily email function
 * Called automatically by time-based trigger
 */
function sendScheduledDailyEmail() {
  try {
    Logger.log('=== SCHEDULED EMAIL STARTED at ' + new Date().toLocaleTimeString('en-IN') + ' ===');

    // Time-based triggers run without spreadsheet context.
    // We must look up the trigger owner's spreadsheet first.
    var email = Session.getEffectiveUser().getEmail();
    if (!email) {
      Logger.log('sendScheduledDailyEmail: No user email available from trigger');
      return;
    }

    var userRecord = findUserByEmail(email);
    if (!userRecord || userRecord.status !== 'Active') {
      Logger.log('sendScheduledDailyEmail: User not found or not active: ' + email);
      return;
    }

    // Set spreadsheet context so all business logic functions can access the user's sheets
    _currentUserSpreadsheetId = userRecord.spreadsheetId;
    Logger.log('Spreadsheet context set for: ' + email + ' (' + userRecord.spreadsheetId + ')');

    // Use the unified dashboard email report (same as manual send from React Settings)
    const result = sendDashboardEmailReport('daily', true);

    if (result && result.success) {
      Logger.log('Scheduled email sent successfully to ' + (result.sentCount || 0) + ' recipients');
    } else {
      Logger.log('Scheduled email failed: ' + (result ? result.error : 'Unknown error'));
    }

  } catch (error) {
    Logger.log('Error in scheduled email: ' + error.toString());
  }
}

/**
 * onEdit trigger - handles clicks on action buttons in sheets
 */
function onEdit(e) {
  if (!e) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const row = e.range.getRow();
  const col = e.range.getColumn();

  // Handle FamilyMembers sheet actions
  if (sheetName === CONFIG.familyMembersSheet) {
    handleFamilyMemberEdit(sheet, row, col);
  }

  // Handle Settings sheet changes - auto-update email triggers
  if (sheetName === CONFIG.settingsSheet) {
    handleSettingsEdit(sheet, row, col);
  }

  // Handle BankAccounts sheet actions (future)
  // if (sheetName === CONFIG.bankAccountsSheet) {
  //   handleBankAccountEdit(sheet, row, col);
  // }

  // Handle InvestmentAccounts sheet actions (future)
  // if (sheetName === CONFIG.investmentAccountsSheet) {
  //   handleInvestmentAccountEdit(sheet, row, col);
  // }
}

/**
 * Handle clicks on FamilyMembers sheet
 */
function handleFamilyMemberEdit(sheet, row, col) {
  // Column A (1) is the Actions column
  if (col === 1 && row >= 3) {
    const memberId = sheet.getRange(row, 2).getValue(); // Column B has Member ID

    if (memberId) {
      // Open edit dialog
      showEditFamilyMemberDialog(memberId);
    }
  }
}

/**
 * Handle edits on Settings sheet
 * Auto-updates email triggers when email-related settings change
 */
function handleSettingsEdit(sheet, row, col) {
  // Only respond to edits in the Value column (Column B = 2)
  if (col !== 2 || row < 3) return;

  try {
    // Get the setting name from Column A
    const settingName = sheet.getRange(row, 1).getValue();

    // Email-related settings that require trigger updates
    const emailSettings = [
      'EmailConfigured',
      'EmailFrequency',
      'EmailHour',
      'EmailMinute',
      'EmailDayOfWeek',
      'EmailDayOfMonth'
    ];

    const screenerSettings = [
      'ScreenerEmailEnabled',
      'ScreenerEmailHour'
    ];

    // If an email setting was changed, reinstall the trigger
    if (emailSettings.includes(settingName)) {
      Logger.log('Email setting changed: ' + settingName + ', updating triggers...');
      Utilities.sleep(100);
      installEmailScheduleTrigger();
      Logger.log('Email trigger updated successfully');
    }

    // If a screener email setting was changed, reinstall screener trigger
    if (screenerSettings.includes(settingName)) {
      Logger.log('Screener email setting changed: ' + settingName + ', updating triggers...');
      Utilities.sleep(100);
      installScreenerEmailTrigger();
      Logger.log('Screener email trigger updated successfully');
    }
  } catch (error) {
    Logger.log('Error handling settings edit: ' + error.toString());
  }
}

// ============================================================================
// SCREENER EMAIL TRIGGER
// ============================================================================

/**
 * Install daily screener email trigger.
 * Runs at 10 AM IST (after Master DB daily check at 9:30 AM).
 * Generates signals and emails any new PENDING signals to the user.
 */
function installScreenerEmailTrigger() {
  try {
    // Remove existing screener email triggers
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'sendScheduledScreenerEmail') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Check if screener emails are enabled (default: false — user must opt in)
    var enabled = getSetting('ScreenerEmailEnabled');
    if (!enabled || enabled.toString().toUpperCase() !== 'TRUE') {
      Logger.log('Screener email not enabled, skipping trigger installation');
      return;
    }

    var hour = parseInt(getSetting('ScreenerEmailHour') || '10');

    ScriptApp.newTrigger('sendScheduledScreenerEmail')
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .nearMinute(0)
      .create();

    Logger.log('Screener email trigger installed for ' + hour + ':00');
  } catch (error) {
    Logger.log('Error installing screener email trigger: ' + error.toString());
  }
}

/**
 * Scheduled screener email — called by daily time-based trigger.
 * Generates signals and sends email summary for any new pending signals.
 */
function sendScheduledScreenerEmail() {
  try {
    Logger.log('=== SCHEDULED SCREENER EMAIL STARTED at ' + new Date().toLocaleTimeString('en-IN') + ' ===');

    // Time-based triggers have no spreadsheet context — look up the user
    var email = Session.getEffectiveUser().getEmail();
    if (!email) {
      Logger.log('sendScheduledScreenerEmail: No user email available');
      return;
    }

    var userRecord = findUserByEmail(email);
    if (!userRecord || userRecord.status !== 'Active') {
      Logger.log('sendScheduledScreenerEmail: User not found or not active: ' + email);
      return;
    }

    // Set spreadsheet context
    _currentUserSpreadsheetId = userRecord.spreadsheetId;
    Logger.log('Spreadsheet context set for: ' + email);

    // Generate signals (reads Master DB + user holdings)
    var result = generateUserSignals();
    var signals = result.signals || [];

    // Filter to only PENDING signals
    var pending = signals.filter(function(s) { return s.status === 'PENDING'; });

    if (pending.length === 0) {
      Logger.log('No pending screener signals — skipping email');
      return;
    }

    // Build and send email
    var subject = '[Capital Friends] ' + pending.length + ' Stock Screener Signal' + (pending.length > 1 ? 's' : '');
    var htmlBody = _buildScreenerEmailHTML(pending, result.niftyData);

    GmailApp.sendEmail(email, subject, '', { htmlBody: htmlBody });
    Logger.log('Screener email sent to ' + email + ' with ' + pending.length + ' signals');

  } catch (error) {
    Logger.log('Error in scheduled screener email: ' + error.toString());
  }
}

/**
 * Build HTML email body for screener signals
 */
function _buildScreenerEmailHTML(signals, niftyData) {
  var html = '<div style="font-family:system-ui,-apple-system,sans-serif; max-width:600px; margin:0 auto; background:#1a1a2e; color:#e0e0e0; border-radius:12px; overflow:hidden;">';

  // Header
  html += '<div style="background:linear-gradient(135deg,#6366f1,#7c3aed); padding:20px 24px;">';
  html += '<h2 style="margin:0; color:#fff; font-size:18px;">Stock Screener Signals</h2>';
  html += '<p style="margin:6px 0 0; color:rgba(255,255,255,0.8); font-size:12px;">' + new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</p>';
  html += '</div>';

  // Nifty bar
  if (niftyData && niftyData.price) {
    var niftyColor = niftyData.aboveDMA200 ? '#10b981' : '#ef4444';
    html += '<div style="padding:12px 24px; background:' + (niftyData.aboveDMA200 ? '#064e3b' : '#450a0a') + '; font-size:12px;">';
    html += '<span style="color:' + niftyColor + ';">Nifty 50: ₹' + niftyData.price + '</span>';
    html += ' &nbsp;|&nbsp; <span style="color:' + niftyColor + ';">200DMA: ₹' + (niftyData.dma200 || 'N/A') + '</span>';
    html += ' &nbsp;|&nbsp; <span style="color:' + niftyColor + ';">' + (niftyData.aboveDMA200 ? '▲ Above 200DMA' : '▼ Below 200DMA') + '</span>';
    html += '</div>';
  }

  // Signal cards
  html += '<div style="padding:16px 24px;">';

  var typeColors = {
    HARD_EXIT: '#ef4444', SYSTEMIC_EXIT: '#ef4444', FREEZE: '#ef4444',
    TRAILING_STOP: '#f59e0b', CRASH_ALERT: '#f59e0b', SOFT_EXIT: '#f59e0b',
    BUY_STARTER: '#10b981', ADD1: '#3b82f6', ADD2: '#3b82f6', DIP_BUY: '#3b82f6',
    REBALANCE: '#6b7280', LTCG_ALERT: '#6b7280', SECTOR_ALERT: '#6b7280'
  };

  var typeLabels = {
    HARD_EXIT: 'HARD EXIT', TRAILING_STOP: 'TRAILING STOP', BUY_STARTER: 'BUY',
    ADD1: 'ADD #1', ADD2: 'ADD #2', DIP_BUY: 'DIP BUY', FREEZE: 'FREEZE',
    CRASH_ALERT: 'CRASH ALERT', SOFT_EXIT: 'SOFT EXIT', REBALANCE: 'REBALANCE',
    LTCG_ALERT: 'LTCG ALERT', SECTOR_ALERT: 'SECTOR ALERT', SYSTEMIC_EXIT: 'SYSTEMIC EXIT'
  };

  for (var i = 0; i < signals.length; i++) {
    var s = signals[i];
    var color = typeColors[s.type] || '#6b7280';
    var label = typeLabels[s.type] || s.type;

    html += '<div style="background:#16213e; border-left:3px solid ' + color + '; border-radius:8px; padding:12px 16px; margin-bottom:10px;">';
    html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">';
    html += '<span style="font-size:11px; font-weight:700; color:' + color + '; text-transform:uppercase;">' + label + '</span>';
    html += '<span style="font-size:13px; font-weight:600; color:#fff;">' + (s.symbol || '') + '</span>';
    html += '</div>';
    if (s.action) html += '<div style="font-size:13px; color:#e0e0e0; margin-bottom:4px;">' + s.action + '</div>';
    if (s.triggerDetail) html += '<div style="font-size:11px; color:#9ca3af;">' + s.triggerDetail + '</div>';
    if (s.amount > 0) html += '<div style="font-size:12px; color:#e0e0e0; margin-top:4px;">Amount: <strong>₹' + s.amount.toLocaleString('en-IN') + '</strong></div>';
    html += '</div>';
  }

  html += '</div>';

  // Footer
  html += '<div style="padding:12px 24px; text-align:center; font-size:11px; color:#6b7280; border-top:1px solid #2d3748;">';
  html += 'Open <a href="https://capitalfriends.in/#/investments/screener" style="color:#6366f1;">Screener</a> to execute signals';
  html += '</div>';

  html += '</div>';
  return html;
}

// ============================================================================
// END OF TRIGGERS.GS
// ============================================================================
