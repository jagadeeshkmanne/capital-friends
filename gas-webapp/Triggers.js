/**
 * ============================================================================
 * TRIGGERS.GS - Event Triggers for Capital Friends V2
 * ============================================================================
 */

/**
 * Manual trigger installer — run from Script Editor.
 * Sets spreadsheet context automatically before installing triggers.
 */
function manualInstallTriggers() {
  var email = Session.getEffectiveUser().getEmail();
  var userRecord = findUserByEmail(email);
  if (!userRecord) {
    Logger.log('User not found: ' + email);
    return;
  }
  _currentUserSpreadsheetId = userRecord.spreadsheetId;
  Logger.log('Context set for: ' + email + ' → ' + userRecord.spreadsheetId);
  installTriggers();
}

/**
 * Install all required triggers programmatically
 * Called automatically during ONE-CLICK SETUP
 * Can also be run manually via manualInstallTriggers()
 */
function installTriggers(showMessage = true) {
  // First, remove any existing onEdit triggers to avoid duplicates
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onEdit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Install onEdit trigger (requires spreadsheet context)
  // In webapp mode, use _currentUserSpreadsheetId; skip if no context available
  var ssId = _currentUserSpreadsheetId;
  if (ssId) {
    try {
      var ss = SpreadsheetApp.openById(ssId);
      ScriptApp.newTrigger('onEdit')
        .forSpreadsheet(ss)
        .onEdit()
        .create();
    } catch (e) {
      Logger.log('Could not install onEdit trigger: ' + e.message);
    }
  } else {
    Logger.log('Skipping onEdit trigger — no spreadsheet context (webapp mode)');
  }

  // Install email schedule trigger if configured
  installEmailScheduleTrigger();

  // Install reminder notification trigger (daily check at 8 AM)
  installReminderTrigger();

  // Install screener triggers (email + hourly checks + daily paper trades)
  installScreenerEmailTrigger();
  installHourlyPriceCheckTrigger();
  installDailyScreenerTrigger();

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
      'ScreenerEmailHour',
      'HourlyPriceCheck'
    ];

    // If an email setting was changed, reinstall the trigger
    if (emailSettings.includes(settingName)) {
      Logger.log('Email setting changed: ' + settingName + ', updating triggers...');
      Utilities.sleep(100);
      installEmailScheduleTrigger();
      Logger.log('Email trigger updated successfully');
    }

    // If a screener setting was changed, reinstall screener triggers
    if (screenerSettings.includes(settingName)) {
      Logger.log('Screener setting changed: ' + settingName + ', updating triggers...');
      Utilities.sleep(100);
      installScreenerEmailTrigger();
      installHourlyPriceCheckTrigger();
      Logger.log('Screener triggers updated successfully');
    }
  } catch (error) {
    Logger.log('Error handling settings edit: ' + error.toString());
  }
}

// ============================================================================
// DAILY SCREENER TRIGGER — runs signal generation + paper trade execution
// ============================================================================

/**
 * Install daily screener trigger at 9:30 AM IST.
 * Generates signals and auto-executes paper trades.
 * Runs independently of email trigger.
 */
function installDailyScreenerTrigger() {
  try {
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'dailyScreenerRun') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    ScriptApp.newTrigger('dailyScreenerRun')
      .timeBased()
      .everyDays(1)
      .atHour(9)
      .nearMinute(30)
      .create();

    Logger.log('Daily screener trigger installed for 9:30 AM');
  } catch (error) {
    Logger.log('Error installing daily screener trigger: ' + error.toString());
  }
}

/**
 * Daily screener run — generates signals, executes paper trades, tracks outcomes.
 * Runs at 9:30 AM IST regardless of email settings.
 */
function dailyScreenerRun() {
  try {
    Logger.log('=== DAILY SCREENER RUN at ' + new Date().toLocaleTimeString('en-IN') + ' ===');

    var email = Session.getEffectiveUser().getEmail();
    if (!email) return;
    var userRecord = findUserByEmail(email);
    if (!userRecord || userRecord.status !== 'Active') return;
    _currentUserSpreadsheetId = userRecord.spreadsheetId;

    // 1. Generate signals
    var result = generateUserSignals();
    Logger.log('Signals generated: ' + (result.signals || []).length + ' pending');

    // 2. Auto-execute paper trades
    var config = readScreenerConfig();
    if (config.PAPER_TRADING) {
      var ptResult = executePaperTrades();
      Logger.log('Paper trades auto-executed: ' + (ptResult.executed || 0));
    }

    // 3. Track signal outcomes (7D/14D/30D)
    trackSignalOutcomes();

    Logger.log('=== DAILY SCREENER RUN COMPLETE ===');
  } catch (error) {
    Logger.log('Error in daily screener run: ' + error.toString());
  }
}

// ============================================================================
// HOURLY PRICE CHECK TRIGGER
// ============================================================================

/**
 * Install hourly trigger for exit signal checks during market hours.
 * Runs every hour (GAS minimum interval) — hourlyPriceCheck() filters to market hours.
 * Also runs: paper trade auto-execution, signal outcome tracking.
 */
function installHourlyPriceCheckTrigger() {
  try {
    // Remove existing hourly triggers
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'hourlyPriceCheck') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Check if hourly check is enabled
    var enabled = getSetting('HourlyPriceCheck');
    if (enabled && enabled.toString().toUpperCase() === 'FALSE') {
      Logger.log('Hourly price check disabled, skipping trigger');
      return;
    }

    ScriptApp.newTrigger('hourlyPriceCheck')
      .timeBased()
      .everyHours(1)
      .create();

    Logger.log('Hourly price check trigger installed');
  } catch (error) {
    Logger.log('Error installing hourly price check trigger: ' + error.toString());
  }
}

// ============================================================================
// SCREENER EMAIL TRIGGER
// ============================================================================

/**
 * Install daily screener email trigger (EOD summary).
 * Sends at configured hour (default 3:30 PM — after market close).
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

    // Read existing signals (generated by dailyScreenerRun at 9:30 AM)
    var signals = getScreenerSignals('PENDING');
    var niftyData = readNiftyDataFromMasterDB();
    var config = readScreenerConfig();

    // Email 1: Screener Signals (only if there are pending signals)
    if (signals.length > 0) {
      var subject = '[Capital Friends] ' + signals.length + ' Stock Screener Signal' + (signals.length > 1 ? 's' : '');
      var htmlBody = _buildScreenerEmailHTML(signals, niftyData);
      GmailApp.sendEmail(email, subject, '', { htmlBody: htmlBody });
      Logger.log('Screener signal email sent with ' + signals.length + ' signals');
    }

    // Email 2: Paper Trading Report (separate email)
    if (config.PAPER_TRADING) {
      try {
        var paperPerf = getPaperPerformance();
        var paperPortfolio = getPaperPortfolio();
        if (paperPortfolio && (paperPortfolio.holdings.length > 0 || paperPerf.totalTrades > 0)) {
          var ptSubject = '[Capital Friends] Paper Trading Report';
          if (paperPortfolio.summary && paperPortfolio.summary.totalPnl !== 0) {
            var pnlSign = paperPortfolio.summary.totalPnl >= 0 ? '+' : '';
            ptSubject += ' — P&L: ' + pnlSign + '₹' + Math.abs(paperPortfolio.summary.totalPnl).toLocaleString('en-IN');
          }
          var ptHtml = _buildPaperTradingEmailHTML(paperPerf, paperPortfolio, niftyData);
          GmailApp.sendEmail(email, ptSubject, '', { htmlBody: ptHtml });
          Logger.log('Paper trading email sent');
        }
      } catch (e) { Logger.log('Paper trading email error (non-blocking): ' + e.message); }
    }

    Logger.log('Scheduled screener email complete');

  } catch (error) {
    Logger.log('Error in scheduled screener email: ' + error.toString());
  }
}

/**
 * Build professional HTML email for screener signals.
 * Matches the reminder email design language (dark theme, table-based, email-client safe).
 */
function _buildScreenerEmailHTML(signals, niftyData) {
  var currentDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  var logoUrl = 'https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/refs/heads/main/react-app/public/logo-new.png';

  // Group signals by category
  var exitSignals = signals.filter(function(s) { return s.type === 'HARD_EXIT' || s.type === 'TRAILING_STOP' || s.type === 'SYSTEMIC_EXIT'; });
  var warningSignals = signals.filter(function(s) { return s.type === 'FREEZE' || s.type === 'CRASH_ALERT' || s.type === 'SOFT_EXIT'; });
  var buySignals = signals.filter(function(s) { return s.type === 'BUY_STARTER'; });
  var addSignals = signals.filter(function(s) { return s.type === 'ADD1' || s.type === 'ADD2' || s.type === 'DIP_BUY'; });
  var infoSignals = signals.filter(function(s) { return s.type === 'REBALANCE' || s.type === 'LTCG_ALERT' || s.type === 'SECTOR_ALERT'; });

  var html = '';
  html += '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>';
  html += '<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;background-color:#0c1222;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0c1222;"><tr><td align="center" style="padding:24px 12px;">';

  // Container
  html += '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">';

  // Main card
  html += '<tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#141e36;border-radius:14px;border:1px solid #1e2d4a;">';

  // ── Header: Logo + App Name | Developer ──
  html += '<tr><td style="padding:20px 24px;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>';
  html += '<td style="vertical-align:middle;width:50%;">';
  html += '<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>';
  html += '<td style="vertical-align:middle;padding-right:10px;"><img src="' + logoUrl + '" alt="CF" style="display:block;border:0;height:32px;width:auto;"></td>';
  html += '<td style="vertical-align:middle;white-space:nowrap;"><div style="font-size:15px;font-weight:600;color:#b0bdd0;letter-spacing:-0.3px;">Capital <span style="color:#4ade80;">Friends</span></div></td>';
  html += '</tr></table></td>';
  html += '<td align="right" style="vertical-align:middle;white-space:nowrap;"><div style="font-size:11px;color:#7a8ba5;">by <span style="color:#a78bfa;font-weight:500;">Jagadeesh Manne</span></div></td>';
  html += '</tr></table></td></tr>';

  // Divider
  html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';

  // ── Title + Summary ──
  html += '<tr><td style="padding:18px 24px 16px;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>';
  html += '<td style="font-size:14px;font-weight:600;color:#b0bdd0;letter-spacing:-0.2px;">Stock Screener Signals</td>';
  html += '<td align="right" style="font-size:11px;color:#506080;">' + currentDate + '</td>';
  html += '</tr></table>';

  // Summary dots
  html += '<div style="font-size:11px;color:#506080;margin-top:8px;">';
  if (exitSignals.length > 0) {
    html += '<span style="display:inline-block;width:6px;height:6px;background:#d87070;border-radius:50%;vertical-align:middle;margin-right:3px;"></span><span style="vertical-align:middle;">' + exitSignals.length + ' exit</span>&nbsp; &middot; &nbsp;';
  }
  if (buySignals.length > 0) {
    html += '<span style="display:inline-block;width:6px;height:6px;background:#40b890;border-radius:50%;vertical-align:middle;margin-right:3px;"></span><span style="vertical-align:middle;">' + buySignals.length + ' buy</span>&nbsp; &middot; &nbsp;';
  }
  if (addSignals.length > 0) {
    html += '<span style="display:inline-block;width:6px;height:6px;background:#4882cc;border-radius:50%;vertical-align:middle;margin-right:3px;"></span><span style="vertical-align:middle;">' + addSignals.length + ' add</span>&nbsp; &middot; &nbsp;';
  }
  if (warningSignals.length + infoSignals.length > 0) {
    html += '<span style="display:inline-block;width:6px;height:6px;background:#c9a430;border-radius:50%;vertical-align:middle;margin-right:3px;"></span><span style="vertical-align:middle;">' + (warningSignals.length + infoSignals.length) + ' alerts</span>';
  }
  html += '</div></td></tr>';

  // ── Nifty Market Bar ──
  if (niftyData && niftyData.price) {
    html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
    var nBg = niftyData.aboveDMA200 ? '#0d2818' : '#2a1215';
    var nBorder = niftyData.aboveDMA200 ? '#1a4030' : '#3d1f22';
    var nColor = niftyData.aboveDMA200 ? '#40b890' : '#d87070';
    html += '<tr><td style="padding:12px 20px;">';
    html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:' + nBg + ';border:1px solid ' + nBorder + ';border-radius:8px;">';
    html += '<tr><td style="padding:10px 14px;">';
    html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>';
    html += '<td style="font-size:12px;color:' + nColor + ';font-weight:500;">Nifty 50: &#8377;' + Math.round(niftyData.price).toLocaleString('en-IN') + '</td>';
    html += '<td style="font-size:11px;color:' + nColor + ';text-align:center;">200DMA: &#8377;' + Math.round(niftyData.dma200 || 0).toLocaleString('en-IN') + '</td>';
    html += '<td align="right" style="font-size:11px;color:' + nColor + ';font-weight:600;">' + (niftyData.aboveDMA200 ? '&#9650; Above' : '&#9660; Below') + ' 200DMA</td>';
    html += '</tr></table></td></tr></table></td></tr>';
  }

  // Divider
  html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';

  // ── Signal Sections ──
  var sections = [
    { signals: exitSignals, label: 'Exit Signals', labelColor: '#d87070', cardBg: '#1c1616', cardBorder: '#2d1e1e', titleColor: '#d0a0a0', detailColor: '#806060' },
    { signals: warningSignals, label: 'Warnings', labelColor: '#c9a430', cardBg: '#1c1b16', cardBorder: '#2d2a1e', titleColor: '#bfb8a0', detailColor: '#6b6555' },
    { signals: addSignals, label: 'Add to Position', labelColor: '#4882cc', cardBg: '#141a28', cardBorder: '#1e2840', titleColor: '#a0b0cc', detailColor: '#506078' },
    { signals: buySignals, label: 'New Buys', labelColor: '#40b890', cardBg: '#0d1f18', cardBorder: '#1a3028', titleColor: '#a0d0b8', detailColor: '#507060' },
    { signals: infoSignals, label: 'Alerts', labelColor: '#7a8ba5', cardBg: '#141a28', cardBorder: '#1e2840', titleColor: '#a0b0cc', detailColor: '#506078' }
  ];

  var typeLabels = {
    HARD_EXIT: 'HARD EXIT', TRAILING_STOP: 'TRAILING STOP', BUY_STARTER: 'BUY',
    ADD1: 'ADD #1', ADD2: 'ADD #2', DIP_BUY: 'DIP BUY', FREEZE: 'FREEZE',
    CRASH_ALERT: 'CRASH', SOFT_EXIT: 'SOFT EXIT', REBALANCE: 'REBALANCE',
    LTCG_ALERT: 'LTCG', SECTOR_ALERT: 'SECTOR', SYSTEMIC_EXIT: 'SYSTEMIC'
  };

  var typeBadgeColors = {
    HARD_EXIT: '#d87070', TRAILING_STOP: '#d4a847', BUY_STARTER: '#40b890',
    ADD1: '#4882cc', ADD2: '#4882cc', DIP_BUY: '#6ba8e0', FREEZE: '#d87070',
    CRASH_ALERT: '#d4a847', SOFT_EXIT: '#d4a847', REBALANCE: '#7a8ba5',
    LTCG_ALERT: '#7a8ba5', SECTOR_ALERT: '#d4a847', SYSTEMIC_EXIT: '#d87070'
  };

  for (var sec = 0; sec < sections.length; sec++) {
    var section = sections[sec];
    if (section.signals.length === 0) continue;

    // Section label
    html += '<tr><td style="padding:18px 24px 10px;"><div style="font-size:10px;font-weight:600;color:' + section.labelColor + ';text-transform:uppercase;letter-spacing:1.2px;">' + section.label + '</div></td></tr>';

    // Signal cards
    for (var i = 0; i < section.signals.length; i++) {
      var s = section.signals[i];
      var isLast = (i === section.signals.length - 1);
      var bottomPad = isLast ? '16' : '6';
      var badgeColor = typeBadgeColors[s.type] || '#7a8ba5';

      html += '<tr><td style="padding:0 20px ' + bottomPad + 'px;">';
      html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:' + section.cardBg + ';border:1px solid ' + section.cardBorder + ';border-radius:10px;">';
      html += '<tr><td style="padding:14px 16px;">';

      // Row 1: Symbol + Type badge
      html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>';
      html += '<td><div style="font-size:13px;font-weight:600;color:' + section.titleColor + ';">' + escapeHtml(s.symbol) + '</div>';
      if (s.name && s.name !== s.symbol) {
        html += '<div style="font-size:11px;color:' + section.detailColor + ';margin-top:1px;">' + escapeHtml(s.name) + '</div>';
      }
      html += '</td>';
      html += '<td align="right" style="vertical-align:top;"><span style="display:inline-block;padding:2px 8px;background:' + section.cardBorder + ';color:' + badgeColor + ';font-size:9px;font-weight:600;border-radius:4px;text-transform:uppercase;letter-spacing:0.3px;">' + (typeLabels[s.type] || s.type) + '</span></td>';
      html += '</tr></table>';

      // Row 2: Action text
      if (s.action) {
        html += '<div style="font-size:12px;color:' + section.titleColor + ';margin-top:8px;">' + escapeHtml(s.action) + '</div>';
      }

      // Row 3: Trigger detail
      if (s.triggerDetail) {
        html += '<div style="font-size:11px;color:' + section.detailColor + ';margin-top:4px;line-height:1.4;">' + escapeHtml(s.triggerDetail) + '</div>';
      }

      // Row 4: Amount + Shares
      if (s.amount > 0 || s.shares > 0) {
        html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px;"><tr>';
        if (s.amount > 0) {
          html += '<td style="font-size:11px;color:' + section.detailColor + ';">Amount: <span style="color:' + section.titleColor + ';font-weight:500;">&#8377;' + Math.round(s.amount).toLocaleString('en-IN') + '</span></td>';
        }
        if (s.shares > 0) {
          html += '<td align="right" style="font-size:11px;color:' + section.detailColor + ';">Shares: <span style="color:' + section.titleColor + ';font-weight:500;">' + s.shares + '</span></td>';
        }
        html += '</tr></table>';
      }

      html += '</td></tr></table></td></tr>';
    }

    // Section divider (unless last section)
    if (sec < sections.length - 1) {
      var hasMore = false;
      for (var ns = sec + 1; ns < sections.length; ns++) {
        if (sections[ns].signals.length > 0) { hasMore = true; break; }
      }
      if (hasMore) {
        html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
      }
    }
  }

  // ── CTA Button ──
  html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
  html += '<tr><td style="padding:16px 24px;text-align:center;">';
  html += '<a href="https://capitalfriends.in/#/investments/screener" style="display:inline-block;padding:10px 28px;background:#6366f1;color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">Open Screener</a>';
  html += '</td></tr>';

  // ── Donate Footer ──
  html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
  html += '<tr><td style="padding:14px 24px 16px;text-align:center;">';
  html += '<div style="font-size:11px;color:#7a8ba5;">If Capital Friends helps your family, consider supporting the developer</div>';
  html += '<div style="font-size:11px;color:#b0bdd0;margin-top:6px;">&#10084;&#65039; Donate via UPI: <span style="color:#e888aa;font-weight:500;">jagadeeshmanne.hdfc@kphdfc</span></div>';
  html += '</td></tr>';

  // Close main card
  html += '</table></td></tr>';
  // Close container
  html += '</table>';
  html += '</td></tr></table>';
  html += '</body></html>';

  return html;
}

/**
 * Build professional HTML email for Paper Trading report.
 * Completely separate from the signal email.
 * Shows: portfolio summary, CAGR, realized/unrealized P&L, open positions, recent trades.
 */
function _buildPaperTradingEmailHTML(perf, portfolio, niftyData) {
  var currentDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  var logoUrl = 'https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/refs/heads/main/react-app/public/logo-new.png';

  var html = '';
  html += '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>';
  html += '<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;background-color:#0c1222;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#0c1222;"><tr><td align="center" style="padding:24px 12px;">';
  html += '<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">';
  html += '<tr><td><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#141e36;border-radius:14px;border:1px solid #1e2d4a;">';

  // Header
  html += '<tr><td style="padding:20px 24px;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>';
  html += '<td style="vertical-align:middle;width:50%;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>';
  html += '<td style="vertical-align:middle;padding-right:10px;"><img src="' + logoUrl + '" alt="CF" style="display:block;border:0;height:32px;width:auto;"></td>';
  html += '<td style="vertical-align:middle;white-space:nowrap;"><div style="font-size:15px;font-weight:600;color:#b0bdd0;letter-spacing:-0.3px;">Capital <span style="color:#4ade80;">Friends</span></div></td>';
  html += '</tr></table></td>';
  html += '<td align="right" style="vertical-align:middle;white-space:nowrap;"><div style="font-size:11px;color:#7a8ba5;">by <span style="color:#a78bfa;font-weight:500;">Jagadeesh Manne</span></div></td>';
  html += '</tr></table></td></tr>';
  html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';

  // Title
  html += '<tr><td style="padding:18px 24px 10px;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>';
  html += '<td style="font-size:14px;font-weight:600;color:#f59e0b;letter-spacing:-0.2px;">&#128200; Paper Trading Report</td>';
  html += '<td align="right" style="font-size:11px;color:#506080;">' + currentDate + '</td>';
  html += '</tr></table>';
  if (perf.firstTradeDate) {
    html += '<div style="font-size:10px;color:#506080;margin-top:4px;">Running since ' + perf.firstTradeDate + '</div>';
  }
  html += '</td></tr>';

  // ── P&L Summary Card ──
  html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
  var ps = portfolio.summary || {};
  var totalColor = (ps.totalPnl || 0) >= 0 ? '#40b890' : '#d87070';
  var totalSign = (ps.totalPnl || 0) >= 0 ? '+' : '';

  html += '<tr><td style="padding:14px 20px;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d1f18;border:1px solid #1a3028;border-radius:10px;">';
  html += '<tr><td style="padding:16px;">';

  // Row 1: Total P&L big number
  html += '<div style="text-align:center;margin-bottom:12px;">';
  html += '<div style="font-size:10px;color:#506080;text-transform:uppercase;letter-spacing:1px;">Total P&L</div>';
  html += '<div style="font-size:24px;font-weight:700;color:' + totalColor + ';margin-top:4px;">' + totalSign + '&#8377;' + Math.abs(perf.totalPnl || 0).toLocaleString('en-IN') + '</div>';
  html += '<div style="font-size:12px;color:' + totalColor + ';">' + totalSign + (perf.totalPnlPct || 0) + '%</div>';
  html += '</div>';

  // Row 2: Invested | Current | CAGR
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">';
  html += '<tr>';
  html += '<td style="font-size:10px;color:#506080;text-align:center;">Invested<br><span style="color:#a0d0b8;font-weight:600;font-size:12px;">&#8377;' + Math.round(ps.totalInvested || 0).toLocaleString('en-IN') + '</span></td>';
  html += '<td style="font-size:10px;color:#506080;text-align:center;">Current<br><span style="color:#a0d0b8;font-weight:600;font-size:12px;">&#8377;' + Math.round(ps.totalCurrentValue || 0).toLocaleString('en-IN') + '</span></td>';
  var cagrColor = (perf.cagr || 0) >= 0 ? '#40b890' : '#d87070';
  html += '<td style="font-size:10px;color:#506080;text-align:center;">CAGR<br><span style="color:' + cagrColor + ';font-weight:700;font-size:14px;">' + (perf.cagr || 0) + '%</span></td>';
  html += '</tr></table>';

  html += '</td></tr></table></td></tr>';

  // ── Realized vs Unrealized ──
  html += '<tr><td style="padding:4px 20px;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">';
  var rColor = (perf.realizedPnl || 0) >= 0 ? '#40b890' : '#d87070';
  var uColor = (perf.unrealizedPnl || 0) >= 0 ? '#40b890' : '#d87070';
  html += '<tr>';
  html += '<td style="font-size:11px;color:#506080;padding:6px 12px;background:#141a28;border-radius:8px 0 0 8px;border:1px solid #1e2840;">Realized<br><span style="color:' + rColor + ';font-weight:600;">&#8377;' + Math.abs(perf.realizedPnl || 0).toLocaleString('en-IN') + '</span></td>';
  html += '<td style="font-size:11px;color:#506080;padding:6px 12px;background:#141a28;border:1px solid #1e2840;">Unrealized<br><span style="color:' + uColor + ';font-weight:600;">&#8377;' + Math.abs(perf.unrealizedPnl || 0).toLocaleString('en-IN') + '</span></td>';
  html += '<td style="font-size:11px;color:#506080;padding:6px 12px;background:#141a28;border-radius:0 8px 8px 0;border:1px solid #1e2840;">Win Rate<br><span style="color:#bfb8a0;font-weight:600;">' + (perf.winRate || 0) + '% (' + (perf.winners || 0) + '/' + (perf.totalTrades || 0) + ')</span></td>';
  html += '</tr></table></td></tr>';

  // ── Open Positions ──
  var holdings = portfolio.holdings || [];
  if (holdings.length > 0) {
    html += '<tr><td style="padding:0 24px;margin-top:8px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
    html += '<tr><td style="padding:14px 24px 6px;"><div style="font-size:10px;font-weight:600;color:#f59e0b;text-transform:uppercase;letter-spacing:1.2px;">Open Positions (' + holdings.length + ')</div></td></tr>';

    for (var i = 0; i < Math.min(holdings.length, 10); i++) {
      var h = holdings[i];
      var hColor = h.pnl >= 0 ? '#40b890' : '#d87070';
      var hSign = h.pnl >= 0 ? '+' : '';
      var lockIcon = h.isLocked ? '&#128274; ' : '';
      var lockText = h.isLocked ? ' <span style="font-size:9px;color:#f59e0b;">(' + h.lockDaysRemaining + 'd lock)</span>' : '';

      html += '<tr><td style="padding:2px 20px;">';
      html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#141a28;border:1px solid #1e2840;border-radius:8px;">';
      html += '<tr><td style="padding:8px 12px;">';
      html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>';
      html += '<td><div style="font-size:12px;font-weight:600;color:#a0b0cc;">' + lockIcon + escapeHtml(h.symbol) + lockText + '</div>';
      html += '<div style="font-size:10px;color:#506080;">' + h.shares + ' shares @ &#8377;' + Math.round(h.entryPrice) + ' | ' + h.daysHeld + 'd</div></td>';
      html += '<td align="right"><div style="font-size:12px;font-weight:700;color:' + hColor + ';">' + hSign + '&#8377;' + Math.abs(h.pnl).toLocaleString('en-IN') + '</div>';
      html += '<div style="font-size:10px;color:' + hColor + ';">' + hSign + h.pnlPct + '%</div></td>';
      html += '</tr></table></td></tr></table></td></tr>';
    }
  }

  // ── Recent Closed Trades ──
  var recentTrades = perf.recentTrades || [];
  if (recentTrades.length > 0) {
    html += '<tr><td style="padding:0 24px;margin-top:8px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
    html += '<tr><td style="padding:14px 24px 6px;"><div style="font-size:10px;font-weight:600;color:#7a8ba5;text-transform:uppercase;letter-spacing:1.2px;">Recent Closed Trades</div></td></tr>';

    for (var j = 0; j < Math.min(recentTrades.length, 5); j++) {
      var t = recentTrades[j];
      var tColor = t.pnl >= 0 ? '#40b890' : '#d87070';
      var tSign = t.pnl >= 0 ? '+' : '';

      html += '<tr><td style="padding:1px 20px;">';
      html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>';
      html += '<td style="font-size:11px;color:#a0b0cc;padding:4px 0;">' + escapeHtml(t.symbol) + ' <span style="color:#506080;">(' + t.holdingDays + 'd)</span></td>';
      html += '<td align="right" style="font-size:11px;font-weight:600;color:' + tColor + ';padding:4px 0;">' + tSign + t.pnlPct + '% (' + tSign + '&#8377;' + Math.abs(t.pnl).toLocaleString('en-IN') + ')</td>';
      html += '</tr></table></td></tr>';
    }
  }

  // ── CTA Button ──
  html += '<tr><td style="padding:4px 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
  html += '<tr><td style="padding:16px 24px;text-align:center;">';
  html += '<a href="https://capitalfriends.in/#/investments/screener" style="display:inline-block;padding:10px 28px;background:#f59e0b;color:#000000;font-size:12px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">View Paper Portfolio</a>';
  html += '</td></tr>';

  // Footer
  html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
  html += '<tr><td style="padding:14px 24px 16px;text-align:center;">';
  html += '<div style="font-size:10px;color:#506080;">Paper trading — no real money. Validating screener signals.</div>';
  html += '<div style="font-size:11px;color:#7a8ba5;margin-top:6px;">&#10084;&#65039; Donate via UPI: <span style="color:#e888aa;font-weight:500;">jagadeeshmanne.hdfc@kphdfc</span></div>';
  html += '</td></tr>';

  html += '</table></td></tr></table>';
  html += '</td></tr></table></body></html>';
  return html;
}

/**
 * Test screener email — sends a sample to the current user.
 * Run from Script Editor to preview the email template.
 */
function testScreenerEmail() {
  try {
    Logger.log('=== TEST SCREENER EMAIL ===');

    // Set spreadsheet context (needed when running from Script Editor)
    var email = Session.getEffectiveUser().getEmail();
    var userRecord = findUserByEmail(email);
    if (userRecord && userRecord.spreadsheetId) {
      _currentUserSpreadsheetId = userRecord.spreadsheetId;
      Logger.log('Spreadsheet context set for: ' + email);
    }

    // Generate real signals or use samples
    var result = null;
    try { result = generateUserSignals(); } catch (e) { Logger.log('Signal generation failed: ' + e.message + ', using sample data'); }

    var signals = result && result.signals ? result.signals.filter(function(s) { return s.status === 'PENDING'; }) : [];
    var niftyData = result ? result.niftyData : null;

    // If no real signals, create sample data
    if (signals.length === 0) {
      signals = [
        { type: 'HARD_EXIT', symbol: 'XYZSTOCK', name: 'XYZ Industries', action: 'SELL all 50 shares of XYZSTOCK', amount: 125000, shares: 50, triggerDetail: 'Hard stop: -32% from entry ₹5000', status: 'PENDING' },
        { type: 'BUY_STARTER', symbol: 'ESABINDIA', name: 'Esab India', action: 'Buy 2 shares of ESABINDIA @ ~₹5445', amount: 10890, shares: 2, triggerDetail: 'Screeners: 1, RSI: 44.82, Golden Cross: YES, Conviction: MEDIUM', status: 'PENDING' },
        { type: 'BUY_STARTER', symbol: 'CANTABIL', name: 'Cantabil Retail', action: 'Buy 36 shares of CANTABIL @ ~₹255', amount: 9180, shares: 36, triggerDetail: 'Screeners: 1, RSI: 33.8, Golden Cross: YES, Conviction: MEDIUM', status: 'PENDING' },
        { type: 'ADD1', symbol: 'TORNTPHARM', name: 'Torrent Pharma', action: 'Add 5 shares of TORNTPHARM @ ~₹4274', amount: 21370, shares: 5, triggerDetail: 'Gain: +19%, 45 days since entry, Screeners: 4', status: 'PENDING' },
        { type: 'SECTOR_ALERT', symbol: 'IT', name: 'SECTOR ALERT: IT', action: 'SECTOR_ALERT: IT', amount: 0, shares: 0, triggerDetail: 'IT at 42% of portfolio (limit: 35%).', status: 'PENDING' }
      ];
      niftyData = niftyData || { price: 22450, dma200: 23100, aboveDMA200: false, return1m: -3.2, return6m: -5.1 };
    }

    var htmlBody = _buildScreenerEmailHTML(signals, niftyData);

    var ownerEmail = Session.getActiveUser().getEmail();
    if (!ownerEmail) ownerEmail = getSpreadsheet().getOwner().getEmail();

    GmailApp.sendEmail(ownerEmail, '[Capital Friends] Test - Stock Screener Signals', '', {
      htmlBody: htmlBody,
      name: 'Capital Friends - Screener (TEST)'
    });

    Logger.log('Test screener email sent to: ' + ownerEmail);
    return { success: true, message: 'Test email sent to ' + ownerEmail, count: signals.length };
  } catch (error) {
    Logger.log('Error sending test screener email: ' + error.toString());
    return { success: false, error: error.message };
  }
}

// ============================================================================
// END OF TRIGGERS.GS
// ============================================================================
