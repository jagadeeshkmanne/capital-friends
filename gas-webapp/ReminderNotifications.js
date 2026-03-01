/**
 * ============================================================================
 * REMINDER NOTIFICATIONS - Email notifications for upcoming reminders
 * ============================================================================
 *
 * Daily trigger checks all active reminders and sends email notifications
 * within the advance notice window (notifyDate <= today <= dueDate).
 * No overdue emails — once due date passes, we stop notifying.
 *
 * Integrates with existing trigger system (installTriggers → installReminderTrigger).
 * Uses same email recipients as wealth report (FamilyMembers with Include in Reports = Yes).
 */

// ============================================================================
// MAIN: Check and Send Reminder Notifications
// ============================================================================

/**
 * Called by daily time-based trigger.
 * Checks all active reminders and sends notification emails for ones
 * within their advance notice window (not past due date).
 */
function checkAndSendReminders() {
  try {
    Logger.log('=== REMINDER CHECK STARTED at ' + new Date().toLocaleTimeString('en-IN') + ' ===');

    var sheet = getSheet(CONFIG.remindersSheet);
    if (!sheet) {
      Logger.log('Reminders sheet not found, skipping');
      return;
    }

    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      Logger.log('No reminders found, skipping');
      return;
    }

    var data = sheet.getRange(3, 1, lastRow - 2, 16).getValues();
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var dueReminders = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var reminderId = row[0];
      var title = row[3];
      var dueDate = row[5];
      var advanceNoticeDays = parseInt(row[6]) || 7;
      var frequency = row[7] || 'One-time';
      var recurrenceEndDate = row[8];
      var priority = row[9] || 'Medium';
      var status = row[10] || '';
      var lastSentDate = row[12];
      var isActive = row[15];

      // Skip inactive, cancelled, or completed reminders
      if (!reminderId || !title) continue;
      if (isActive === false || isActive === 'No' || isActive === 'FALSE') continue;
      if (status === 'Cancelled' || status === 'Completed') continue;

      // Parse due date
      if (!dueDate) continue;
      var due = new Date(dueDate);
      if (isNaN(due.getTime())) continue;
      due.setHours(0, 0, 0, 0);

      // Skip if past due date — no overdue emails
      if (today > due) {
        // For recurring reminders past due, auto-advance the due date
        if (frequency !== 'One-time') {
          var nextDue = calculateNextDueDate(due, frequency);
          if (nextDue) {
            // Check recurrence end date
            if (recurrenceEndDate) {
              var endDate = new Date(recurrenceEndDate);
              if (!isNaN(endDate.getTime()) && nextDue > endDate) continue;
            }
            // Update due date in sheet
            sheet.getRange(i + 3, 6).setValue(nextDue);
            due = nextDue;
          } else {
            continue;
          }
        } else {
          // One-time reminder past due, mark completed and skip
          sheet.getRange(i + 3, 11).setValue('Completed');
          continue;
        }
      }

      // Calculate notification date (due date minus advance notice days)
      var notifyDate = new Date(due);
      notifyDate.setDate(notifyDate.getDate() - advanceNoticeDays);

      // Only notify within the window: notifyDate <= today <= dueDate
      if (today < notifyDate) continue;

      // Check if already sent today
      if (lastSentDate) {
        var lastSent = new Date(lastSentDate);
        lastSent.setHours(0, 0, 0, 0);
        if (lastSent.getTime() === today.getTime()) continue;
      }

      // For recurring reminders, check if past recurrence end date
      if (recurrenceEndDate) {
        var endDate = new Date(recurrenceEndDate);
        if (!isNaN(endDate.getTime()) && today > endDate) continue;
      }

      // Calculate days until due
      var daysUntilDue = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      dueReminders.push({
        reminderId: reminderId,
        type: row[1] || '',
        familyMember: row[2] || '',
        title: title,
        description: row[4] || '',
        dueDate: due,
        dueDateStr: formatDateForEmail(due),
        daysUntilDue: daysUntilDue,
        frequency: frequency,
        priority: priority,
        recipientEmail: row[11] || '',
        rowIndex: i + 3
      });
    }

    if (dueReminders.length === 0) {
      Logger.log('No reminders due within notification window, skipping email');
      return;
    }

    Logger.log('Found ' + dueReminders.length + ' reminder(s) in notification window, sending...');

    // Sort by due date ascending (due today first, then upcoming)
    dueReminders.sort(function(a, b) {
      return a.daysUntilDue - b.daysUntilDue;
    });

    // Build and send email
    var htmlBody = buildReminderEmailHTML(dueReminders);
    var recipients = getEmailRecipients();

    // Fallback to sheet owner if no configured recipients
    if (!recipients || recipients.length === 0) {
      try {
        var ownerEmail = getSpreadsheet().getOwner().getEmail();
        if (ownerEmail) recipients = [ownerEmail];
      } catch (e) {}
    }

    if (!recipients || recipients.length === 0) {
      Logger.log('No email recipients found for reminder notifications');
      return;
    }

    // Build subject
    var todayCount = dueReminders.filter(function(r) { return r.daysUntilDue === 0; }).length;
    var upcomingCount = dueReminders.filter(function(r) { return r.daysUntilDue > 0; }).length;

    var subjectParts = [];
    if (todayCount > 0) subjectParts.push(todayCount + ' due today');
    if (upcomingCount > 0) subjectParts.push(upcomingCount + ' upcoming');
    var subject = 'Capital Friends - Reminders: ' + subjectParts.join(', ');

    var fromEmail = getFromEmailAddress();

    GmailApp.sendEmail(
      recipients.join(','),
      subject,
      'You have ' + dueReminders.length + ' reminder(s) that need attention. Please enable HTML to view.',
      {
        htmlBody: htmlBody,
        name: 'Capital Friends - Reminders',
        replyTo: fromEmail || ''
      }
    );

    Logger.log('Reminder email sent to: ' + recipients.join(', '));

    // Update Last Sent Date in sheet
    for (var j = 0; j < dueReminders.length; j++) {
      var rem = dueReminders[j];
      sheet.getRange(rem.rowIndex, 13).setValue(new Date());
    }

    Logger.log('=== REMINDER CHECK COMPLETED ===');

  } catch (error) {
    Logger.log('Error in checkAndSendReminders: ' + error.toString());
  }
}

// ============================================================================
// NEXT DUE DATE CALCULATION
// ============================================================================

/**
 * Calculate the next due date for recurring reminders
 */
function calculateNextDueDate(currentDueDate, frequency) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var next = new Date(currentDueDate);

  switch (frequency) {
    case 'Daily':
      while (next <= today) { next.setDate(next.getDate() + 1); }
      return next;
    case 'Weekly':
      while (next <= today) { next.setDate(next.getDate() + 7); }
      return next;
    case 'Monthly':
      while (next <= today) { next.setMonth(next.getMonth() + 1); }
      return next;
    case 'Yearly':
      while (next <= today) { next.setFullYear(next.getFullYear() + 1); }
      return next;
    case 'One-time':
    default:
      return null;
  }
}

// ============================================================================
// EMAIL HTML BUILDER — matches approved dark navy design
// ============================================================================

/**
 * Build reminder notification email HTML.
 * Single-card dark theme matching the app.
 */
function buildReminderEmailHTML(reminders) {
  var currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  var logoUrl = 'https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/refs/heads/main/react-app/public/logo-new.png';

  // Group: due today vs upcoming (no overdue)
  var dueToday = reminders.filter(function(r) { return r.daysUntilDue === 0; });
  var upcoming = reminders.filter(function(r) { return r.daysUntilDue > 0; });

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
  html += '<td style="font-size:14px;font-weight:600;color:#b0bdd0;letter-spacing:-0.2px;">Reminders</td>';
  html += '<td align="right" style="font-size:11px;color:#506080;">' + currentDate + '</td>';
  html += '</tr></table>';
  html += '<div style="font-size:11px;color:#506080;margin-top:8px;">';
  if (dueToday.length > 0) {
    html += '<span style="display:inline-block;width:6px;height:6px;background:#c9a430;border-radius:50%;vertical-align:middle;margin-right:3px;"></span><span style="vertical-align:middle;">' + dueToday.length + ' due today</span>';
    if (upcoming.length > 0) html += '<span style="vertical-align:middle;">&nbsp; &middot; &nbsp;</span>';
  }
  if (upcoming.length > 0) {
    html += '<span style="display:inline-block;width:6px;height:6px;background:#4882cc;border-radius:50%;vertical-align:middle;margin-right:3px;"></span><span style="vertical-align:middle;">' + upcoming.length + ' upcoming</span>';
  }
  html += '</div></td></tr>';

  // Divider
  html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';

  // ── Due Today Section ──
  if (dueToday.length > 0) {
    html += '<tr><td style="padding:18px 24px 10px;"><div style="font-size:10px;font-weight:600;color:#c9a430;text-transform:uppercase;letter-spacing:1.2px;">Due Today</div></td></tr>';
    for (var i = 0; i < dueToday.length; i++) {
      var isLast = (i === dueToday.length - 1) && upcoming.length === 0;
      html += buildReminderCard(dueToday[i], 'today', isLast);
    }
    if (upcoming.length > 0) {
      html += '<tr><td style="padding:0 24px;"><div style="height:1px;background:#1e2d4a;"></div></td></tr>';
    }
  }

  // ── Upcoming Section ──
  if (upcoming.length > 0) {
    html += '<tr><td style="padding:18px 24px 10px;"><div style="font-size:10px;font-weight:600;color:#4882cc;text-transform:uppercase;letter-spacing:1.2px;">Upcoming</div></td></tr>';
    for (var i = 0; i < upcoming.length; i++) {
      var isLast = (i === upcoming.length - 1);
      html += buildReminderCard(upcoming[i], 'upcoming', isLast);
    }
  }

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
 * Build a single reminder card
 */
function buildReminderCard(rem, type, isLast) {
  // Card colors based on type
  var cardBg, cardBorder, titleColor, descColor, metaColor, metaDimColor;
  if (type === 'today') {
    cardBg = '#1c1b16'; cardBorder = '#2d2a1e';
    titleColor = '#bfb8a0'; descColor = '#6b6555';
    metaColor = '#7a7560'; metaDimColor = '#5a5545';
  } else {
    cardBg = '#141a28'; cardBorder = '#1e2840';
    titleColor = '#a0b0cc'; descColor = '#506078';
    metaColor = '#607090'; metaDimColor = '#455570';
  }

  // Priority badge
  var priBg, priColor;
  if (rem.priority === 'High') {
    priBg = type === 'today' ? '#2d2a1e' : '#1e2840';
    priColor = '#d87070';
  } else if (rem.priority === 'Medium') {
    priBg = type === 'today' ? '#2d2a1e' : '#1e2840';
    priColor = '#d4a847';
  } else {
    priBg = type === 'today' ? '#2d2a1e' : '#1e2840';
    priColor = '#40b890';
  }

  // Due label
  var dueLabel;
  if (rem.daysUntilDue === 0) {
    dueLabel = '<span style="color:#d4b860;font-weight:500;">Due today</span>';
  } else {
    dueLabel = '<span style="color:#7aace0;font-weight:500;">' + rem.daysUntilDue + ' day' + (rem.daysUntilDue !== 1 ? 's' : '') + ' left</span>';
  }

  // Meta info
  var meta = [];
  if (rem.type) meta.push(escapeHtml(rem.type));
  if (rem.familyMember) meta.push(escapeHtml(rem.familyMember));
  if (rem.frequency && rem.frequency !== 'One-time') meta.push(escapeHtml(rem.frequency));

  var bottomPad = isLast ? '22' : '6';

  var html = '';
  html += '<tr><td style="padding:0 20px ' + bottomPad + 'px;">';
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:' + cardBg + ';border:1px solid ' + cardBorder + ';border-radius:10px;">';
  html += '<tr><td style="padding:14px 16px;">';

  // Title + priority
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>';
  html += '<td><div style="font-size:13px;font-weight:500;color:' + titleColor + ';">' + escapeHtml(rem.title) + '</div></td>';
  html += '<td align="right" style="vertical-align:top;"><span style="display:inline-block;padding:2px 8px;background:' + priBg + ';color:' + priColor + ';font-size:9px;font-weight:600;border-radius:4px;text-transform:uppercase;letter-spacing:0.3px;">' + escapeHtml(rem.priority) + '</span></td>';
  html += '</tr></table>';

  // Description
  if (rem.description) {
    html += '<div style="font-size:11px;color:' + descColor + ';margin-top:4px;">' + escapeHtml(rem.description) + '</div>';
  }

  // Meta row
  html += '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:10px;"><tr>';
  html += '<td style="font-size:11px;color:' + metaColor + ';">' + rem.dueDateStr + ' &nbsp;&middot;&nbsp; ' + dueLabel + '</td>';
  html += '<td align="right" style="font-size:10px;color:' + metaDimColor + ';">' + meta.join(' &middot; ') + '</td>';
  html += '</tr></table>';

  html += '</td></tr></table></td></tr>';
  return html;
}

// ============================================================================
// TRIGGER MANAGEMENT
// ============================================================================

/**
 * Install daily reminder check trigger.
 * Called from installTriggers() during ONE-CLICK SETUP.
 * Runs daily at 8 AM to check and send reminder notifications.
 */
function installReminderTrigger() {
  try {
    // Remove any existing reminder triggers first
    var triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === 'checkAndSendReminders') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // Check if reminders notification is enabled (default: true)
    var reminderEnabled = getSetting('ReminderNotificationsEnabled');
    if (reminderEnabled !== null && reminderEnabled.toString().toUpperCase() === 'FALSE') {
      Logger.log('Reminder notifications disabled, skipping trigger installation');
      return;
    }

    // Get reminder check hour (default: 8 AM)
    var reminderHour = parseInt(getSetting('ReminderCheckHour') || '8');

    // Install daily trigger
    ScriptApp.newTrigger('checkAndSendReminders')
      .timeBased()
      .everyDays(1)
      .atHour(reminderHour)
      .nearMinute(0)
      .create();

    Logger.log('Reminder trigger installed for daily check at ' + reminderHour + ':00');

  } catch (error) {
    Logger.log('Error installing reminder trigger: ' + error.toString());
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format date for email display
 */
function formatDateForEmail(date) {
  if (!date || !(date instanceof Date)) return '';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// TEST FUNCTION
// ============================================================================

/**
 * Test reminder email by sending a sample to the sheet owner.
 */
function testReminderEmail() {
  try {
    Logger.log('=== TEST REMINDER EMAIL ===');

    var sheet = getSheet(CONFIG.remindersSheet);
    var testReminders = [];

    if (sheet && sheet.getLastRow() > 2) {
      var data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 16).getValues();
      var today = new Date();
      today.setHours(0, 0, 0, 0);

      for (var i = 0; i < data.length; i++) {
        var row = data[i];
        if (!row[0] || !row[3]) continue;
        if (row[15] === 'No' || row[10] === 'Cancelled' || row[10] === 'Completed') continue;

        var dueDate = row[5] ? new Date(row[5]) : new Date();
        dueDate.setHours(0, 0, 0, 0);
        var daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Only include non-overdue for test (matching real logic)
        if (daysUntilDue < 0) continue;

        testReminders.push({
          reminderId: row[0],
          type: row[1] || '',
          familyMember: row[2] || '',
          title: row[3],
          description: row[4] || '',
          dueDate: dueDate,
          dueDateStr: formatDateForEmail(dueDate),
          daysUntilDue: daysUntilDue,
          frequency: row[7] || 'One-time',
          priority: row[9] || 'Medium',
          recipientEmail: row[11] || ''
        });
      }
    }

    // If no real reminders, create sample data
    if (testReminders.length === 0) {
      var today = new Date();
      testReminders = [
        { title: 'SIP Due - HDFC Flexicap', description: 'Monthly SIP payment of \u20B910,000', type: 'SIP', familyMember: 'Jagadeesh', dueDate: today, dueDateStr: formatDateForEmail(today), daysUntilDue: 0, frequency: 'Monthly', priority: 'High' },
        { title: 'Term Insurance Renewal - HDFC Click2Protect', description: 'Annual premium payment due, \u20B915,200', type: 'Insurance', familyMember: 'Jagadeesh', dueDate: new Date(today.getTime() + 5 * 86400000), dueDateStr: formatDateForEmail(new Date(today.getTime() + 5 * 86400000)), daysUntilDue: 5, frequency: 'Yearly', priority: 'High' },
        { title: 'PPF Deposit - Min \u20B9500', description: 'Annual minimum deposit before March 31', type: 'Investment', familyMember: 'Family', dueDate: new Date(today.getTime() + 15 * 86400000), dueDateStr: formatDateForEmail(new Date(today.getTime() + 15 * 86400000)), daysUntilDue: 15, frequency: 'One-time', priority: 'Low' }
      ];
    }

    testReminders.sort(function(a, b) { return a.daysUntilDue - b.daysUntilDue; });

    var htmlBody = buildReminderEmailHTML(testReminders);

    // Send to sheet owner
    var ownerEmail = Session.getActiveUser().getEmail();
    if (!ownerEmail) {
      ownerEmail = getSpreadsheet().getOwner().getEmail();
    }

    GmailApp.sendEmail(
      ownerEmail,
      'Capital Friends - Test Reminder Email',
      'Test reminder email. Please enable HTML to view.',
      {
        htmlBody: htmlBody,
        name: 'Capital Friends - Reminders (TEST)'
      }
    );

    Logger.log('Test reminder email sent to: ' + ownerEmail);
    return { success: true, message: 'Test reminder email sent to ' + ownerEmail, count: testReminders.length };

  } catch (error) {
    Logger.log('Error sending test reminder email: ' + error.toString());
    return { success: false, error: error.message };
  }
}

// ============================================================================
// END OF REMINDERNOTIFICATIONS.JS
// ============================================================================
