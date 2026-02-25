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

    // Send email to configured recipients
    const result = sendCompleteWealthReportEmail();

    if (result && result.success) {
      Logger.log('Scheduled email sent successfully to: ' + result.recipients.join(', '));
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

    // If an email setting was changed, reinstall the trigger
    if (emailSettings.includes(settingName)) {
      Logger.log('Email setting changed: ' + settingName + ', updating triggers...');

      // Small delay to ensure the setting is saved
      Utilities.sleep(100);

      // Reinstall email trigger with new settings
      installEmailScheduleTrigger();

      Logger.log('Email trigger updated successfully');
    }
  } catch (error) {
    Logger.log('Error handling settings edit: ' + error.toString());
  }
}

// ============================================================================
// END OF TRIGGERS.GS
// ============================================================================
