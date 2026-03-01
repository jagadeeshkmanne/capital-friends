/**
 * ============================================================================
 * EMAILREPORTS.GS - Email Scheduling and Sending Functions (REDESIGNED)
 * ============================================================================
 * Handles sending dashboard reports via email and managing email schedules
 *
 * KEY FEATURES:
 * - Emails sent to family members with "Include in Email Reports" = Yes
 * - Time selection from 9 AM to 11 PM (after mutual fund refresh at 7 AM)
 * - Default: Daily email at 9 AM during first-time setup
 * - No "Smart Schedule" - only Daily, Weekly, or None
 */

/**
 * Get email recipients from FamilyMembers sheet
 * Returns family members with "Include in Email Reports" = Yes
 */
function getEmailRecipients() {
  try {
    const members = getFamilyMembersForEmailReports();
    log('Email report members found: ' + (members ? members.length : 0));

    if (!members || members.length === 0) {
      return [];
    }

    // Log each member's data for debugging
    members.forEach(m => {
      log('  Member: id=' + m.memberId + ', name=' + m.memberName + ', email=' + m.email + ', emailType=' + typeof m.email);
    });

    const recipients = members.map(member => ({
      memberId: member.memberId,
      name: member.memberName || 'Unknown',
      email: (member.email || '').toString().trim(),
      pan: member.pan // Include PAN directly for password
    })).filter(m => m.email && m.email.includes('@')); // Only members with valid email containing @

    log('Valid email recipients: ' + recipients.length);
    return recipients;

  } catch (error) {
    log('Error getting email recipients: ' + error.toString());
    return [];
  }
}

/**
 * Get current email schedule status
 * Returns object with schedule type, hour, and details
 */
function getCurrentEmailSchedule() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const dailyTrigger = triggers.find(t => t.getHandlerFunction() === 'sendDailyEmailReport');
    const weeklyTrigger = triggers.find(t => t.getHandlerFunction() === 'sendWeeklyEmailReport');

    let scheduleType = 'none';
    let scheduleHour = 9; // default
    let details = '';

    if (dailyTrigger) {
      scheduleType = 'daily';
      scheduleHour = dailyTrigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK
        ? getHourFromTrigger(dailyTrigger)
        : 9;
      details = `Daily reports at ${formatHour(scheduleHour)}`;
    } else if (weeklyTrigger) {
      scheduleType = 'weekly';
      scheduleHour = weeklyTrigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK
        ? getHourFromTrigger(weeklyTrigger)
        : 18;
      details = `Weekly summary every Sunday at ${formatHour(scheduleHour)}`;
    } else {
      scheduleType = 'none';
      scheduleHour = 9;
      details = 'No scheduled email reports';
    }

    return {
      success: true,
      scheduleType: scheduleType,
      scheduleHour: scheduleHour,
      details: details
    };
  } catch (error) {
    log('Error getting email schedule: ' + error.toString());
    return {
      success: false,
      error: error.message,
      scheduleType: 'none',
      scheduleHour: 9,
      details: 'Error checking schedule'
    };
  }
}

/**
 * Get hour from trigger (helper function)
 */
function getHourFromTrigger(trigger) {
  try {
    // Apps Script doesn't provide direct API to get hour from trigger
    // We'll store it in Settings sheet instead
    return getStoredEmailHour();
  } catch (error) {
    return 9; // default
  }
}

/**
 * Get stored email hour from Settings sheet
 */
function getStoredEmailHour() {
  try {
    const settingsSheet = getSheet(CONFIG.settingsSheet);
    if (!settingsSheet) return 9;

    const data = settingsSheet.getDataRange().getValues();
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] === 'EmailHour') {
        return parseInt(data[i][1]) || 9;
      }
    }
    return 9;
  } catch (error) {
    return 9;
  }
}

/**
 * Store email hour in Settings sheet
 */
function storeEmailHour(hour) {
  try {
    const settingsSheet = getSheet(CONFIG.settingsSheet);
    if (!settingsSheet) return;

    const data = settingsSheet.getDataRange().getValues();
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] === 'EmailHour') {
        settingsSheet.getRange(i + 1, 2).setValue(hour);
        return;
      }
    }

    // If not found, add it
    settingsSheet.appendRow(['EmailHour', hour, 'Hour for email reports (9-23)']);
  } catch (error) {
    log('Error storing email hour: ' + error.toString());
  }
}

/**
 * Format hour for display
 */
function formatHour(hour) {
  if (hour === 12) return '12:00 PM';
  if (hour < 12) return hour + ':00 AM';
  return (hour - 12) + ':00 PM';
}

/**
 * Update email schedule based on user selection
 * @param {string} scheduleType - 'daily', 'weekly', or 'none'
 * @param {number} scheduleHour - Hour (9-23)
 */
function updateEmailSchedule(scheduleType, scheduleHour) {
  try {
    log('Updating email schedule to: ' + scheduleType + ' at hour: ' + scheduleHour);

    // Validate hour range
    if ((scheduleType === 'daily' || scheduleType === 'weekly') && (scheduleHour < 9 || scheduleHour > 23)) {
      return {
        success: false,
        error: 'Invalid time. Please select between 9:00 AM and 11:00 PM'
      };
    }

    // First, remove all existing email triggers
    removeAllEmailTriggers();

    // Store the hour preference
    if (scheduleType !== 'none') {
      storeEmailHour(scheduleHour);
    }

    // Create new triggers based on selection
    if (scheduleType === 'daily') {
      createDailyEmailTrigger(scheduleHour);
    } else if (scheduleType === 'weekly') {
      createWeeklyEmailTrigger(scheduleHour);
    }
    // If 'none', we just removed all triggers above

    // Mark email as configured (user has seen and configured settings)
    markEmailAsConfigured();

    log('Email schedule updated successfully to: ' + scheduleType + ' at ' + formatHour(scheduleHour));

    return {
      success: true,
      message: getScheduleUpdateMessage(scheduleType, scheduleHour),
      scheduleType: scheduleType,
      scheduleHour: scheduleHour
    };
  } catch (error) {
    log('Error updating email schedule: ' + error.toString());
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Remove all email-related triggers
 */
function removeAllEmailTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    const funcName = trigger.getHandlerFunction();
    if (funcName === 'sendDailyEmailReport' || funcName === 'sendWeeklyEmailReport') {
      ScriptApp.deleteTrigger(trigger);
      log('Deleted trigger: ' + funcName);
    }
  });
}

/**
 * Create daily email trigger at specified hour
 */
function createDailyEmailTrigger(hour) {
  ScriptApp.newTrigger('sendDailyEmailReport')
    .timeBased()
    .atHour(hour)
    .everyDays(1)
    .create();
  log('Created daily email trigger at ' + formatHour(hour));
}

/**
 * Create weekly email trigger (Sunday at specified hour)
 */
function createWeeklyEmailTrigger(hour) {
  ScriptApp.newTrigger('sendWeeklyEmailReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(hour)
    .create();
  log('Created weekly email trigger on Sunday at ' + formatHour(hour));
}

/**
 * Get success message based on schedule type
 */
function getScheduleUpdateMessage(scheduleType, hour) {
  switch(scheduleType) {
    case 'daily':
      return 'Daily email reports scheduled at ' + formatHour(hour);
    case 'weekly':
      return 'Weekly email reports scheduled for Sunday at ' + formatHour(hour);
    case 'none':
      return 'All scheduled email reports have been cancelled';
    default:
      return 'Email schedule updated';
  }
}

// ============================================================================
// EMAIL SENDING FUNCTIONS
// ============================================================================

/**
 * Send daily email report (triggered by schedule)
 */
function sendDailyEmailReport() {
  try {
    log('sendDailyEmailReport triggered');
    sendDashboardEmailReport('daily');
  } catch (error) {
    log('Error in sendDailyEmailReport: ' + error.toString());
  }
}

/**
 * Send weekly email report (triggered by schedule)
 */
function sendWeeklyEmailReport() {
  try {
    log('sendWeeklyEmailReport triggered');
    sendDashboardEmailReport('weekly');
  } catch (error) {
    log('Error in sendWeeklyEmailReport: ' + error.toString());
  }
}

/**
 * Manual send report (from menu)
 */
function sendDashboardEmailWrapper() {
  const ui = SpreadsheetApp.getUi();

  // Get email recipients
  const recipients = getEmailRecipients();

  if (recipients.length === 0) {
    ui.alert(
      '⚠️ No Recipients',
      'No family members are configured to receive email reports.\n\n' +
      'Please add family members and enable "Include in Email Reports" option.',
      ui.ButtonSet.OK
    );
    return;
  }

  const emailList = recipients.map(r => r.name + ' (' + r.email + ')').join('\n');

  const response = ui.alert(
    '📧 Send Report Email',
    'Send your family wealth report to:\n\n' + emailList + '\n\nContinue?',
    ui.ButtonSet.YES_NO
  );

  if (response === ui.Button.YES) {
    try {
      const result = sendDashboardEmailReport('manual');

      if (result.success) {
        ui.alert(
          '✅ Email Sent!',
          'Your family wealth report has been sent to:\n' + emailList,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert(
          '❌ Error',
          'Failed to send email: ' + (result.error || 'Unknown error'),
          ui.ButtonSet.OK
        );
      }
    } catch (error) {
      ui.alert(
        '❌ Error',
        'Failed to send email: ' + error.message,
        ui.ButtonSet.OK
      );
    }
  }
}

/**
 * Core function to send dashboard email report
 * @param {string} reportType - 'daily', 'weekly', or 'manual'
 * @param {boolean} sendAsPDF - If true, sends as PDF attachment instead of HTML
 */
function sendDashboardEmailReport(reportType, sendAsPDF = true) {
  try {
    // Get email recipients
    const recipients = getEmailRecipients();

    // DEBUG: Always include recipient details in response
    const recipientDebug = recipients.map(r => ({
      name: r.name, nameType: typeof r.name,
      email: r.email, emailType: typeof r.email, emailLen: r.email ? r.email.length : 0,
      memberId: r.memberId
    }));

    if (recipients.length === 0) {
      // Return diagnostic info to help debug
      const rawMembers = getFamilyMembersForEmailReports();
      const sheet = getSheet(CONFIG.familyMembersSheet);
      const diag = {
        sheetExists: !!sheet,
        sheetName: CONFIG.familyMembersSheet,
        rawMemberCount: rawMembers ? rawMembers.length : 0,
        rawMembers: rawMembers ? rawMembers.map(m => ({
          id: m.memberId,
          name: m.memberName,
          email: m.email,
          emailType: typeof m.email,
          includeInEmail: m.includeInEmailReports,
          status: m.status
        })) : []
      };
      if (sheet && sheet.getLastRow() >= 3) {
        const firstRow = sheet.getRange(3, 1, 1, 12).getValues()[0];
        diag.rawFirstRow = firstRow.map((v, i) => 'Col' + (i+1) + '=' + String(v).substring(0, 30));
        const headers = sheet.getRange(2, 1, 1, 12).getValues()[0];
        diag.headers = headers.map(String);
      }
      log('No email recipients configured - skipping email send');
      return { success: false, error: 'No email recipients configured', debug: diag };
    }

    // Gather dashboard data using the same functions as React loadAllData()
    log('Building dashboard report data...');
    const dashData = buildDashboardReportData();

    if (!dashData) {
      log('Failed to build dashboard report data');
      return { success: false, error: 'Failed to gather report data' };
    }

    log('Dashboard data built: netWorth=' + dashData.netWorth + ', members=' + dashData.memberCount);

    // Find family head (relationship = "Self") for subject line
    const familyHead = (dashData.familyMembers || []).find(function(m) {
      return m.relationship === 'Self';
    });
    const familyHeadName = familyHead ? familyHead.memberName : '';

    // Build email subject with family name
    const subject = buildEmailSubject(reportType, dashData.netWorth, familyHeadName);

    // Build simple email summary (greeting + key metrics)
    const summaryBody = buildSimpleEmailBody('', dashData, familyHeadName);

    // Build the full dashboard HTML report (matches ref.html design)
    const dashboardHTML = buildDashboardPDFHTML(dashData);

    // Combine: summary on top, full dashboard below in one email
    // Strip HTML/body tags from dashboard to embed inside summary
    var dashContent = dashboardHTML.replace(/^<!DOCTYPE html>[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>\s*<\/html>\s*$/i, '');
    var fullEmailHTML = summaryBody.replace('</body></html>', '') +
      '<div style="margin:24px auto 0;padding:0 40px 40px;">' + dashContent + '</div></body></html>';

    // Send INDIVIDUAL emails to each recipient as HTML body (no PDF)
    let successCount = 0;
    let errorMessages = [];

    try {
      recipients.forEach(function(recipient) {
        try {
          GmailApp.sendEmail(recipient.email, subject, '', {
            htmlBody: fullEmailHTML
          });

          log('Email sent to: ' + recipient.name + ' (' + recipient.email + ')');
          successCount++;
        } catch (recipientError) {
          const errorMsg = 'Failed to send to ' + recipient.name + ' <' + recipient.email + '>: ' + recipientError.message;
          log(errorMsg);
          errorMessages.push(errorMsg);
        }
      });

      log('Sent ' + successCount + ' of ' + recipients.length + ' emails');

      return {
        success: successCount > 0,
        sentCount: successCount,
        errors: errorMessages.length > 0 ? errorMessages : undefined,
        _debug: recipientDebug
      };
    } catch (emailError) {
      log('Failed to send email: ' + emailError.toString());
      return { success: false, error: emailError.message, _debug: recipientDebug };
    }
  } catch (error) {
    log('Error sending email reports: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Convert HTML to PDF with optional password protection
 * @param {string} htmlContent - The HTML content to convert
 * @param {string} fileName - Name for the PDF file (without .pdf extension)
 * @param {string} password - Optional password for PDF protection
 * @returns {Blob} PDF blob to attach to email
 */
function convertHTMLToPDF(htmlContent, fileName, password) {
  try {
    // Create temp HTML file in Drive and convert to PDF
    const htmlFile = DriveApp.getRootFolder().createFile(fileName + '.html', htmlContent, MimeType.HTML);

    // Get PDF blob from HTML file
    const pdfBlob = htmlFile.getAs(MimeType.PDF);
    pdfBlob.setName(fileName + '.pdf');

    // Clean up temp HTML file
    htmlFile.setTrashed(true);

    if (password) {
      log('ℹ️ PDF password requested for member (not yet implemented server-side)');
    }

    log('✅ PDF generated successfully: ' + fileName + '.pdf');
    return pdfBlob;
  } catch (error) {
    log('❌ Error converting HTML to PDF: ' + error.toString());
    throw new Error('Failed to generate PDF: ' + error.message);
  }
}

// ============================================================================
// PDF PASSWORD PROTECTION - FUTURE FEATURE
// ============================================================================
// NOTE: PDF password protection is disabled to avoid requiring user configuration.
// To implement in the future, you would need to integrate with a third-party PDF API
// like PDF.co, PDFMonkey, or DocRaptor.
//
// For now, individual emails are sent to each family member without password protection.
// This still provides privacy as each member only receives their own email.
// ============================================================================

/**
 * ============================================================================
 * buildDashboardReportData()
 * ============================================================================
 * Replaces the broken getMemberDashboardData() and getConsolidatedFamilyDashboardData().
 *
 * The old code filtered by `p.owner === memberName` but getAllPortfolios() never
 * resolves owner — it's always empty string, so ALL data showed as zero.
 *
 * This function uses the same data functions as the React loadAllData(), enriches
 * MF and stock portfolios with owner info via investment accounts, and computes
 * all derived data exactly like the React Dashboard.jsx.
 *
 * @returns {Object} Complete dashboard report data (see return shape below)
 */
function buildDashboardReportData() {
  try {
    log('buildDashboardReportData() started');

    // ── 1. Fetch all raw data (same functions React loadAllData() uses) ──
    const allMembers = getAllFamilyMembers() || [];
    const allInvestmentAccounts = getAllInvestmentAccounts() || [];
    const allMFPortfolios = getAllPortfolios() || [];
    const allMFHoldings = getAllMFHoldings() || [];
    const allStockPortfolios = getAllStockPortfolios() || [];
    const allStockHoldings = getAllStockHoldingsData() || [];
    const allOtherInv = getAllInvestments() || [];
    const allLiabilities = getAllLiabilities() || [];
    const allInsurance = getAllInsurancePolicies() || [];
    const allGoals = getAllGoals() || [];
    const allReminders = getAllReminders() || [];
    const allBankAccounts = getAllBankAccounts() || [];
    const allAssetAllocations = getAllAssetAllocationsData() || [];

    log('Data fetched: ' + allMembers.length + ' members, ' +
        allMFPortfolios.length + ' MF portfolios, ' +
        allMFHoldings.length + ' MF holdings, ' +
        allStockPortfolios.length + ' stock portfolios, ' +
        allStockHoldings.length + ' stock holdings, ' +
        allOtherInv.length + ' other investments');

    // ── 2. Build investment account lookup for owner enrichment ──
    const iaMap = {};
    allInvestmentAccounts.forEach(function(a) {
      iaMap[String(a.accountId).trim()] = a;
    });

    // ── 3. Enrich MF portfolios with owner info from investment accounts ──
    const enrichedMFPortfolios = allMFPortfolios.map(function(p) {
      const ia = iaMap[String(p.investmentAccountId || '').trim()];
      return {
        portfolioId: p.portfolioId,
        portfolioName: p.portfolioName,
        investmentAccountId: p.investmentAccountId,
        investmentAccountName: ia ? ia.accountName : '',
        ownerId: ia ? ia.memberId : '',
        ownerName: ia ? ia.memberName : '',
        platformBroker: ia ? ia.platformBroker : '',
        totalInvestment: parseFloat(p.totalInvestment) || 0,
        currentValue: parseFloat(p.currentValue) || 0,
        rebalanceThreshold: parseFloat(p.rebalanceThreshold) || 0.05,
        unrealizedPL: parseFloat(p.unrealizedPL) || 0,
        unrealizedPLPct: parseFloat(p.unrealizedPLPct) || 0,
        realizedPL: parseFloat(p.realizedPL) || 0,
        realizedPLPct: parseFloat(p.realizedPLPct) || 0,
        totalPL: parseFloat(p.totalPL) || 0,
        totalPLPct: parseFloat(p.totalPLPct) || 0,
        status: p.status
      };
    });

    // ── 4. Enrich stock portfolios with owner info from investment accounts ──
    const enrichedStockPortfolios = allStockPortfolios.map(function(p) {
      const ia = iaMap[String(p.investmentAccountId || '').trim()];
      // Stock portfolios may have ownerId directly; fall back to investment account
      const ownerId = p.ownerId || (ia ? ia.memberId : '');
      const ownerName = p.ownerName || (ia ? ia.memberName : '');
      return {
        portfolioId: p.portfolioId,
        portfolioName: p.portfolioName,
        investmentAccountId: p.investmentAccountId,
        investmentAccountName: ia ? ia.accountName : '',
        ownerId: ownerId,
        ownerName: ownerName,
        platformBroker: ia ? ia.platformBroker : '',
        totalInvestment: parseFloat(p.totalInvestment) || 0,
        currentValue: parseFloat(p.currentValue) || 0,
        unrealizedPL: parseFloat(p.unrealizedPL) || 0,
        unrealizedPLPct: parseFloat(p.unrealizedPLPct) || 0,
        realizedPL: parseFloat(p.realizedPL) || 0,
        realizedPLPct: parseFloat(p.realizedPLPct) || 0,
        totalPL: parseFloat(p.totalPL) || 0,
        totalPLPct: parseFloat(p.totalPLPct) || 0,
        status: p.status
      };
    });

    // ── 5. Filter active items ──
    const activeMFPortfolios = enrichedMFPortfolios.filter(function(p) { return p.status === 'Active'; });
    const mfPortfolioIds = {};
    activeMFPortfolios.forEach(function(p) { mfPortfolioIds[p.portfolioId] = true; });
    const activeMFHoldings = allMFHoldings.filter(function(h) {
      return mfPortfolioIds[h.portfolioId] && (parseFloat(h.units) || 0) > 0;
    });

    const activeStockPortfolios = enrichedStockPortfolios.filter(function(p) { return p.status === 'Active'; });
    const stkPortfolioIds = {};
    activeStockPortfolios.forEach(function(p) { stkPortfolioIds[p.portfolioId] = true; });
    const activeStockHoldings = allStockHoldings.filter(function(h) {
      return stkPortfolioIds[h.portfolioId];
    });

    const activeOther = allOtherInv.filter(function(i) { return i.status === 'Active'; });
    const activeLiabilities = allLiabilities.filter(function(l) { return l.status === 'Active'; });
    const activeInsurance = allInsurance.filter(function(p) { return p.status === 'Active'; });
    const activeGoals = allGoals.filter(function(g) { return g.isActive !== false; });
    const activeReminders = allReminders.filter(function(r) { return r.isActive !== false && r.status !== 'Completed'; });
    const activeMembers = allMembers.filter(function(m) { return m.status === 'Active'; });
    const activeBanks = allBankAccounts.filter(function(b) { return b.status === 'Active'; });
    const activeInvAccounts = allInvestmentAccounts.filter(function(a) { return a.status === 'Active'; });

    // ── 6. Compute investment totals (from holdings, like React) ──
    // MF totals from holdings (not portfolio-level, which may be stale)
    const mfInvested = activeMFHoldings.reduce(function(s, h) { return s + (parseFloat(h.investment) || 0); }, 0);
    const mfCurrentValue = activeMFHoldings.reduce(function(s, h) { return s + (parseFloat(h.currentValue) || 0); }, 0);
    const mfPL = mfCurrentValue - mfInvested;

    // Stock totals from holdings
    const stkInvested = activeStockHoldings.reduce(function(s, h) { return s + (parseFloat(h.totalInvestment) || 0); }, 0);
    const stkCurrentValue = activeStockHoldings.reduce(function(s, h) { return s + (parseFloat(h.currentValue) || 0); }, 0);
    const stkPL = stkCurrentValue - stkInvested;

    // Other investment totals
    const otherInvested = activeOther.reduce(function(s, i) { return s + (parseFloat(i.investedAmount) || 0); }, 0);
    const otherCurrentValue = activeOther.reduce(function(s, i) { return s + (parseFloat(i.currentValue) || 0); }, 0);
    const otherPL = otherCurrentValue - otherInvested;

    // Liability totals
    const totalLiabilities = activeLiabilities.reduce(function(s, l) { return s + (parseFloat(l.outstandingBalance) || 0); }, 0);
    const totalEMI = activeLiabilities.reduce(function(s, l) { return s + (parseFloat(l.emiAmount) || 0); }, 0);

    // Insurance totals
    const lifeCover = activeInsurance.filter(function(p) { return p.policyType === 'Term Life'; })
      .reduce(function(s, p) { return s + (parseFloat(p.sumAssured) || 0); }, 0);
    const healthCover = activeInsurance.filter(function(p) { return p.policyType === 'Health'; })
      .reduce(function(s, p) { return s + (parseFloat(p.sumAssured) || 0); }, 0);
    const totalPremium = activeInsurance.reduce(function(s, p) { return s + (parseFloat(p.premium) || 0); }, 0);

    // Grand totals
    const totalAssets = mfCurrentValue + stkCurrentValue + otherCurrentValue;
    const totalInvested = mfInvested + stkInvested + otherInvested;
    const totalPL = totalAssets - totalInvested;
    const plPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
    const netWorth = totalAssets - totalLiabilities;

    log('Totals: assets=' + totalAssets + ', invested=' + totalInvested +
        ', PL=' + totalPL + ', liabilities=' + totalLiabilities + ', netWorth=' + netWorth);

    // ── 7. Asset class breakdown (Equity/Debt/Gold/Hybrid/etc.) ──
    const allocMap = {};
    allAssetAllocations.forEach(function(a) {
      if (a.assetAllocation) allocMap[a.fundCode] = a.assetAllocation;
    });

    const ASSET_CLASS_HEX = {
      Equity: '#8b5cf6', Debt: '#60a5fa', Gold: '#fbbf24', Commodities: '#eab308',
      'Real Estate': '#f97316', Hybrid: '#818cf8', Cash: '#94a3b8', Other: '#94a3b8'
    };

    const assetClasses = { Equity: 0, Debt: 0, Gold: 0, Hybrid: 0, Commodities: 0, 'Real Estate': 0, Cash: 0, Other: 0 };

    activeMFHoldings.forEach(function(h) {
      const fundCode = h.schemeCode || h.fundCode || '';
      const cv = parseFloat(h.currentValue) || 0;
      const detailed = allocMap[fundCode];

      if (detailed) {
        // Use fund-level asset allocation percentages
        const keys = Object.keys(detailed);
        for (let k = 0; k < keys.length; k++) {
          const cls = keys[k];
          const pct = parseFloat(detailed[cls]) || 0;
          if (assetClasses.hasOwnProperty(cls)) {
            assetClasses[cls] += cv * (pct / 100);
          } else {
            assetClasses.Other += cv * (pct / 100);
          }
        }
      } else {
        // Infer category from fund name (same logic as React inferCategory)
        let cat = h.category || '';
        if (!cat || cat === 'Other') cat = _inferCategory(h.fundName);

        if (cat === 'Equity' || cat === 'ELSS' || cat === 'Index') {
          assetClasses.Equity += cv;
        } else if (cat === 'Debt' || cat === 'Gilt') {
          assetClasses.Debt += cv;
        } else if (cat === 'Liquid') {
          assetClasses.Cash += cv;
        } else if (cat === 'Commodity') {
          assetClasses.Commodities += cv;
        } else if (cat === 'Multi-Asset') {
          assetClasses.Equity += cv * 0.50;
          assetClasses.Debt += cv * 0.30;
          assetClasses.Commodities += cv * 0.20;
        } else if (cat === 'Hybrid' || cat === 'FoF') {
          assetClasses.Equity += cv * 0.65;
          assetClasses.Debt += cv * 0.35;
        } else {
          assetClasses.Other += cv;
        }
      }
    });

    // Stocks are 100% Equity
    assetClasses.Equity += stkCurrentValue;

    // Other investments: classify by investmentType
    activeOther.forEach(function(inv) {
      const t = (inv.investmentType || '').toLowerCase();
      const cv = parseFloat(inv.currentValue) || 0;
      if (t.includes('gold') || t.includes('sgb') || t.includes('sovereign gold')) {
        assetClasses.Gold += cv;
      } else if (t.includes('silver') || t.includes('commodity')) {
        assetClasses.Commodities += cv;
      } else if (t.includes('fd') || t.includes('fixed') || t.includes('bond') || t.includes('ppf') ||
                 t.includes('epf') || t.includes('nps') || t.includes('rd') || t.includes('nsc') || t.includes('ssy')) {
        assetClasses.Debt += cv;
      } else if (t.includes('real estate') || t.includes('property')) {
        assetClasses['Real Estate'] += cv;
      } else {
        assetClasses.Other += cv;
      }
    });

    // Build sorted asset class list (filter out zeroes)
    const assetClassList = [];
    const acKeys = Object.keys(assetClasses);
    for (let i = 0; i < acKeys.length; i++) {
      const cls = acKeys[i];
      const val = assetClasses[cls];
      if (val > 0) {
        assetClassList.push({
          name: cls,
          value: val,
          pct: totalAssets > 0 ? (val / totalAssets) * 100 : 0,
          color: ASSET_CLASS_HEX[cls] || '#94a3b8'
        });
      }
    }
    assetClassList.sort(function(a, b) { return b.value - a.value; });

    // ── 8. Allocation by investment type (for donut chart) ──
    const ALLOC_TYPE_COLORS = [
      '#f97316', '#8b5cf6', '#fbbf24', '#f59e0b', '#34d399', '#ec4899', '#60a5fa', '#3b82f6',
      '#06b6d4', '#10b981', '#ef4444', '#a855f7'
    ];

    const typeMap = {};
    if (mfCurrentValue > 0) typeMap['Mutual Funds'] = mfCurrentValue;
    if (stkCurrentValue > 0) typeMap['Stocks'] = stkCurrentValue;
    activeOther.forEach(function(inv) {
      const t = inv.investmentType || 'Other';
      typeMap[t] = (typeMap[t] || 0) + (parseFloat(inv.currentValue) || 0);
    });

    const allocByType = [];
    const typeKeys = Object.keys(typeMap);
    // Sort by value descending
    typeKeys.sort(function(a, b) { return typeMap[b] - typeMap[a]; });
    for (let i = 0; i < typeKeys.length; i++) {
      const name = typeKeys[i];
      const value = typeMap[name];
      if (value > 0) {
        allocByType.push({
          name: name,
          value: value,
          pct: totalAssets > 0 ? (value / totalAssets) * 100 : 0,
          color: ALLOC_TYPE_COLORS[i % ALLOC_TYPE_COLORS.length]
        });
      }
    }

    // ── 9. Buy opportunities (MF holdings 5%+ below ATH) ──
    const buyOpportunities = [];
    activeMFPortfolios.forEach(function(p) {
      const pHoldings = activeMFHoldings.filter(function(h) { return h.portfolioId === p.portfolioId; });
      pHoldings.forEach(function(h) {
        const athNav = parseFloat(h.athNav) || 0;
        const belowATHPct = parseFloat(h.belowATHPct) || 0;
        if (athNav > 0 && belowATHPct >= 5) {
          buyOpportunities.push({
            fundName: _splitFundName(h.fundName),
            portfolioName: p.portfolioName,
            ownerName: p.ownerName,
            belowATHPct: belowATHPct,
            isStrongBuy: belowATHPct >= 10
          });
        }
      });
    });
    buyOpportunities.sort(function(a, b) { return b.belowATHPct - a.belowATHPct; });

    // ── 10. Rebalance items (MF holdings with allocation drift beyond threshold) ──
    const rebalanceItems = [];
    activeMFPortfolios.forEach(function(p) {
      const pHoldings = activeMFHoldings.filter(function(h) { return h.portfolioId === p.portfolioId; });
      const pValue = pHoldings.reduce(function(s, h) { return s + (parseFloat(h.currentValue) || 0); }, 0);
      const threshold = (p.rebalanceThreshold || 0.05) * 100;
      pHoldings.forEach(function(h) {
        const targetPct = parseFloat(h.targetAllocationPct) || 0;
        if (targetPct > 0 && pValue > 0) {
          const currentPct = ((parseFloat(h.currentValue) || 0) / pValue) * 100;
          const drift = currentPct - targetPct;
          if (Math.abs(drift) > threshold) {
            rebalanceItems.push({
              fundName: _splitFundName(h.fundName),
              portfolioName: p.portfolioName,
              ownerName: p.ownerName,
              currentPct: Math.round(currentPct),
              targetPct: Math.round(targetPct),
              drift: Math.round(drift)
            });
          }
        }
      });
    });
    rebalanceItems.sort(function(a, b) { return Math.abs(b.drift) - Math.abs(a.drift); });

    // ── 11. Investment rows table (grouped by type, like React) ──
    const investmentRows = [];

    // MF row
    if (mfCurrentValue > 0) {
      const mfOwnerSet = {};
      const mfPlatformSet = {};
      activeMFPortfolios.forEach(function(p) {
        if (p.ownerName) mfOwnerSet[p.ownerName] = true;
        const platform = p.platformBroker || p.investmentAccountName || '';
        if (platform) mfPlatformSet[platform] = true;
      });
      investmentRows.push({
        type: 'Mutual Funds',
        platform: Object.keys(mfPlatformSet).join(', '),
        owner: Object.keys(mfOwnerSet).join(', '),
        invested: mfInvested,
        current: mfCurrentValue,
        pl: mfPL
      });
    }

    // Stocks row
    if (stkCurrentValue > 0) {
      const stkOwnerSet = {};
      const stkPlatformSet = {};
      activeStockPortfolios.forEach(function(p) {
        if (p.ownerName) stkOwnerSet[p.ownerName] = true;
        const platform = p.platformBroker || p.investmentAccountName || '';
        if (platform) stkPlatformSet[platform] = true;
      });
      investmentRows.push({
        type: 'Stocks',
        platform: Object.keys(stkPlatformSet).join(', '),
        owner: Object.keys(stkOwnerSet).join(', '),
        invested: stkInvested,
        current: stkCurrentValue,
        pl: stkPL
      });
    }

    // Other investments grouped by type
    const otherByType = {};
    activeOther.forEach(function(inv) {
      const t = inv.investmentType || 'Other';
      if (!otherByType[t]) {
        otherByType[t] = { invested: 0, current: 0, owners: {}, platforms: {} };
      }
      otherByType[t].invested += parseFloat(inv.investedAmount) || 0;
      otherByType[t].current += parseFloat(inv.currentValue) || 0;
      if (inv.familyMemberName) otherByType[t].owners[inv.familyMemberName] = true;
      if (inv.investmentName) otherByType[t].platforms[inv.investmentName] = true;
    });
    const otherTypeKeys = Object.keys(otherByType);
    for (let i = 0; i < otherTypeKeys.length; i++) {
      const type = otherTypeKeys[i];
      const d = otherByType[type];
      const platformList = Object.keys(d.platforms);
      const pl = d.current - d.invested;
      investmentRows.push({
        type: type,
        platform: platformList.length <= 2 ? platformList.join(', ') : platformList.length + ' investments',
        owner: Object.keys(d.owners).join(', '),
        invested: d.invested,
        current: d.current,
        pl: d.invested > 0 ? pl : null
      });
    }

    // ── 12. Per-member net worth ──
    const memberNetWorth = {};

    // MF by owner (from holdings)
    activeMFPortfolios.forEach(function(p) {
      const ph = activeMFHoldings.filter(function(h) { return h.portfolioId === p.portfolioId; });
      const val = ph.reduce(function(s, h) { return s + (parseFloat(h.currentValue) || 0); }, 0);
      if (p.ownerId) {
        memberNetWorth[p.ownerId] = (memberNetWorth[p.ownerId] || 0) + val;
      }
    });

    // Stocks by owner (from holdings)
    activeStockPortfolios.forEach(function(p) {
      const ph = activeStockHoldings.filter(function(h) { return h.portfolioId === p.portfolioId; });
      const val = ph.reduce(function(s, h) { return s + (parseFloat(h.currentValue) || 0); }, 0);
      if (p.ownerId) {
        memberNetWorth[p.ownerId] = (memberNetWorth[p.ownerId] || 0) + val;
      }
    });

    // Other investments by member
    activeOther.forEach(function(inv) {
      if (inv.familyMemberId) {
        memberNetWorth[inv.familyMemberId] = (memberNetWorth[inv.familyMemberId] || 0) + (parseFloat(inv.currentValue) || 0);
      }
    });

    // Subtract liabilities
    activeLiabilities.forEach(function(l) {
      if (l.familyMemberId) {
        memberNetWorth[l.familyMemberId] = (memberNetWorth[l.familyMemberId] || 0) - (parseFloat(l.outstandingBalance) || 0);
      }
    });

    // ── 13. Action items (computed from insurance, goals, reminders - same as React) ──
    const actionItems = [];
    const now = new Date();

    // Check term life insurance
    const hasTermLife = activeInsurance.some(function(p) { return p.policyType === 'Term Life'; });
    if (!hasTermLife) {
      actionItems.push({
        type: 'critical',
        title: 'No Term Life Insurance',
        description: 'Family loses its sole income source if primary earner passes away. Get 10-15x annual income cover.'
      });
    }

    // Check health insurance
    if (healthCover === 0) {
      actionItems.push({
        type: 'critical',
        title: 'No Health Insurance',
        description: 'Medical emergencies without cover can wipe out years of savings. Get minimum 10L family cover.'
      });
    } else if (healthCover < 500000) {
      actionItems.push({
        type: 'warning',
        title: 'Inadequate Health Insurance',
        description: 'Current cover may not cover a single hospital stay. Consider upgrading.'
      });
    }

    // Emergency fund goals
    activeGoals.forEach(function(g) {
      if (g.goalType === 'Emergency Fund') {
        const targetAmt = parseFloat(g.targetAmount) || 0;
        const currentVal = parseFloat(g.currentValue) || 0;
        const pct = targetAmt > 0 ? (currentVal / targetAmt) * 100 : 0;
        if (pct < 100) {
          actionItems.push({
            type: 'warning',
            title: 'Emergency Fund at ' + pct.toFixed(0) + '%',
            description: 'Job loss or medical emergency forces debt. More needed for full cushion.'
          });
        }
      }
    });

    // Overdue reminders
    activeReminders.forEach(function(r) {
      const dueDate = new Date(r.dueDate);
      if (dueDate < now) {
        const days = Math.ceil((now - dueDate) / (24 * 60 * 60 * 1000));
        actionItems.push({
          type: 'critical',
          title: r.title,
          description: days + ' day' + (days !== 1 ? 's' : '') + ' overdue. ' + (r.description || '')
        });
      }
    });

    // Goals needing attention
    activeGoals.forEach(function(g) {
      if (g.status === 'Needs Attention') {
        actionItems.push({
          type: 'warning',
          title: (g.goalName || 'Goal') + ' needs attention',
          description: 'Progress is behind schedule. Consider increasing monthly investment.'
        });
      }
    });

    // Limit to top 6 action items
    const topActionItems = actionItems.slice(0, 6);

    // ── 14. Upcoming reminders (sorted by due date, future only) ──
    const upcomingReminders = [];
    activeReminders.forEach(function(r) {
      const dueDate = new Date(r.dueDate);
      const diff = dueDate - now;
      const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
      if (days >= 0) {
        upcomingReminders.push({
          reminderId: r.reminderId,
          type: r.type,
          title: r.title,
          description: r.description,
          dueDate: r.dueDate,
          days: days,
          priority: r.priority
        });
      }
    });
    upcomingReminders.sort(function(a, b) { return a.days - b.days; });

    // ── 15. Get questionnaire data for backward compat with email template ──
    const questionnaireData = getQuestionnaireData();

    // ── 16. Insurance data (categorized by type for email template) ──
    const insuranceData = getAllInsurancePoliciesDetailed();

    // ── 17. Build the result ──
    const generatedAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const result = {
      // Totals
      netWorth: netWorth,
      totalAssets: totalAssets,
      totalInvested: totalInvested,
      totalPL: totalPL,
      plPct: plPct,
      totalLiabilities: totalLiabilities,
      totalEMI: totalEMI,
      lifeCover: lifeCover,
      healthCover: healthCover,
      totalPremium: totalPremium,

      // Per-asset-class totals (for summary email metrics)
      mfInvested: mfInvested,
      mfCurrentValue: mfCurrentValue,
      stkInvested: stkInvested,
      stkCurrentValue: stkCurrentValue,
      otherInvested: otherInvested,
      otherCurrentValue: otherCurrentValue,

      // Asset class breakdown for bar chart
      assetClassList: assetClassList,

      // Allocation by investment type for donut
      allocByType: allocByType,

      // Action items
      actionItems: topActionItems,

      // Buy opportunities
      buyOpportunities: buyOpportunities,

      // Rebalance items
      rebalanceItems: rebalanceItems,

      // Investments table
      investmentRows: investmentRows,

      // Lists
      activeLiabilities: activeLiabilities,
      activeInsurance: activeInsurance,
      activeGoals: activeGoals,
      upcomingReminders: upcomingReminders.slice(0, 10),

      // Bottom tables
      filteredMembers: activeMembers,
      filteredBanks: activeBanks,
      filteredInvAccounts: activeInvAccounts,

      // Per-member net worth
      memberNetWorth: memberNetWorth,

      // Meta
      generatedAt: generatedAt,
      memberCount: activeMembers.length,

      // ── Backward-compatible fields for email template ──
      // The email template (_buildEmailHTML) reads data.familyTotals, data.assetAllocation,
      // data.questionnaireData, data.insuranceData, data.membersData, etc.
      familyTotals: {
        totalWealth: totalAssets,
        invested: totalInvested,
        current: totalAssets,
        liabilities: totalLiabilities,
        unrealizedPnL: mfCurrentValue - mfInvested + stkCurrentValue - stkInvested,
        realizedPnL: 0,
        totalPnL: totalPL,
        pnlPercent: plPct,
        insuranceCover: lifeCover + healthCover,
        termInsurance: {
          count: activeInsurance.filter(function(p) { return p.policyType === 'Term Life'; }).length,
          totalCover: lifeCover
        },
        healthInsurance: {
          count: activeInsurance.filter(function(p) { return p.policyType === 'Health'; }).length,
          totalCover: healthCover
        }
      },

      assetAllocation: {
        total: totalAssets,
        breakdown: assetClassList.map(function(item) {
          return { assetClass: item.name, value: item.value, percentage: item.pct };
        })
      },

      questionnaireData: questionnaireData,
      insuranceData: insuranceData,

      familyMembers: activeMembers.map(function(m) {
        return {
          memberId: m.memberId,
          memberName: m.memberName,
          relationship: m.relationship,
          dob: m.dateOfBirth || '',
          pan: m.pan || '',
          aadhar: m.aadhar || '',
          mobile: m.phoneNumber || '',
          email: m.email || ''
        };
      }),

      bankAccounts: activeBanks.map(function(b) {
        return {
          accountId: b.accountId,
          member: b.memberName,
          bankName: b.bankName,
          accountNumber: b.accountNumber,
          accountType: b.accountType,
          branch: b.branchName || ''
        };
      }),

      investmentAccounts: activeInvAccounts.map(function(a) {
        return {
          accountId: a.accountId,
          member: a.memberName,
          platform: a.platformBroker,
          accountType: a.accountType,
          clientId: a.accountClientId || '',
          email: a.registeredEmail || '',
          phone: a.registeredPhone || ''
        };
      }),

      // Flat portfolio arrays for email template (all portfolios with funds/holdings, regardless of owner matching)
      allMFPortfoliosFlat: activeMFPortfolios.map(function(p) {
        var pHoldings = activeMFHoldings.filter(function(h) { return h.portfolioId === p.portfolioId; });
        return {
          portfolioId: p.portfolioId,
          portfolioName: p.portfolioName,
          investmentAccountId: p.investmentAccountId,
          ownerId: p.ownerId || '',
          ownerName: p.ownerName || '',
          platformBroker: p.platformBroker || '',
          totalInvestment: p.totalInvestment,
          currentValue: p.currentValue,
          unrealizedPL: p.unrealizedPL || 0,
          unrealizedPLPct: parseFloat(p.unrealizedPLPct) || 0,
          realizedPL: p.realizedPL || 0,
          realizedPLPct: parseFloat(p.realizedPLPct) || 0,
          totalPL: p.totalPL || 0,
          totalPLPct: parseFloat(p.totalPLPct) || 0,
          funds: pHoldings.map(function(h) {
            return {
              fundCode: h.fundCode,
              fundName: h.fundName,
              units: h.units,
              avgNav: h.avgNav || 0,
              currentNav: h.currentNav || 0,
              investment: h.investment,
              currentValue: h.currentValue,
              currentAllocationPct: h.currentAllocationPct || 0,
              targetAllocationPct: h.targetAllocationPct || 0,
              rebalanceSIP: h.rebalanceSIP || 0,
              rebalanceLumpsum: h.rebalanceLumpsum || 0,
              buySell: h.buySell || 0,
              pl: h.pl || 0,
              athNav: h.athNav,
              belowATHPct: h.belowATHPct
            };
          })
        };
      }),

      allStockPortfoliosFlat: activeStockPortfolios.map(function(p) {
        var pHoldings = activeStockHoldings.filter(function(h) { return h.portfolioId === p.portfolioId; });
        return {
          portfolioId: p.portfolioId,
          portfolioName: p.portfolioName,
          investmentAccountId: p.investmentAccountId,
          ownerId: p.ownerId || '',
          ownerName: p.ownerName || '',
          platformBroker: p.platformBroker || '',
          totalInvestment: p.totalInvestment,
          currentValue: p.currentValue,
          holdings: pHoldings.map(function(h) {
            return {
              symbol: h.symbol,
              companyName: h.companyName,
              exchange: h.exchange,
              quantity: h.quantity,
              avgBuyPrice: h.avgBuyPrice,
              totalInvestment: h.totalInvestment,
              currentPrice: h.currentPrice,
              currentValue: h.currentValue,
              unrealizedPL: h.unrealizedPL,
              unrealizedPLPct: h.unrealizedPLPct
            };
          })
        };
      }),

      allOtherInvestments: activeOther,

      // membersData: backward-compat array the email template iterates for buy opps, rebalance, investments
      membersData: _buildMembersDataCompat(activeMembers, activeMFPortfolios, activeMFHoldings,
        activeStockPortfolios, activeStockHoldings, activeOther, activeInsurance)
    };

    log('buildDashboardReportData() completed successfully');
    return result;

  } catch (error) {
    log('ERROR in buildDashboardReportData: ' + error.toString());
    log('Stack trace: ' + (error.stack || 'N/A'));
    throw error;
  }
}

/**
 * Build backward-compatible membersData array for the email template.
 * The template iterates data.membersData[].mutualFunds.portfolios[].funds[] etc.
 */
function _buildMembersDataCompat(activeMembers, mfPortfolios, mfHoldings, stkPortfolios, stkHoldings, otherInv, insurance) {
  const membersData = [];

  activeMembers.forEach(function(member) {
    const memberId = member.memberId;

    // MF portfolios for this member
    const memberMFPortfolios = mfPortfolios.filter(function(p) { return p.ownerId === memberId; });
    const memberMFHoldings = [];
    memberMFPortfolios.forEach(function(p) {
      const pHoldings = mfHoldings.filter(function(h) { return h.portfolioId === p.portfolioId; });
      pHoldings.forEach(function(h) { memberMFHoldings.push(h); });
    });

    const mfInvested = memberMFHoldings.reduce(function(s, h) { return s + (parseFloat(h.investment) || 0); }, 0);
    const mfCurrent = memberMFHoldings.reduce(function(s, h) { return s + (parseFloat(h.currentValue) || 0); }, 0);

    // Build portfolio entries with funds for buy opp / rebalance template
    const mfPortfolioEntries = memberMFPortfolios.map(function(p) {
      const pHoldings = mfHoldings.filter(function(h) { return h.portfolioId === p.portfolioId; });
      return {
        portfolioId: p.portfolioId,
        portfolioName: p.portfolioName,
        platform: p.platformBroker || '',
        investmentAccountId: p.investmentAccountId || '',
        invested: p.totalInvestment,
        totalInvestment: p.totalInvestment,
        current: p.currentValue,
        currentValue: p.currentValue,
        rebalanceThreshold: p.rebalanceThreshold,
        funds: pHoldings.map(function(h) {
          return {
            fundCode: h.fundCode,
            fundName: h.fundName,
            schemeName: h.fundName,
            units: h.units,
            investment: h.investment,
            currentValue: h.currentValue,
            currentAllocationPct: h.currentAllocationPct,
            targetAllocationPct: h.targetAllocationPct,
            athNav: h.athNav,
            belowATHPct: h.belowATHPct
          };
        })
      };
    });

    // Stock portfolios for this member (with individual holdings)
    const memberStkPortfolios = stkPortfolios.filter(function(p) { return p.ownerId === memberId; });
    const stkPortfolioEntries = memberStkPortfolios.map(function(p) {
      const pHoldings = stkHoldings.filter(function(h) { return h.portfolioId === p.portfolioId; });
      return {
        portfolioId: p.portfolioId,
        portfolioName: p.portfolioName,
        investmentAccountId: p.investmentAccountId || '',
        platformBroker: p.platformBroker || '',
        totalInvestment: p.totalInvestment,
        currentValue: p.currentValue,
        holdings: pHoldings.map(function(h) {
          return {
            symbol: h.symbol,
            companyName: h.companyName,
            exchange: h.exchange,
            quantity: h.quantity,
            avgBuyPrice: h.avgBuyPrice,
            totalInvestment: h.totalInvestment,
            currentPrice: h.currentPrice,
            currentValue: h.currentValue,
            unrealizedPL: h.unrealizedPL,
            unrealizedPLPct: h.unrealizedPLPct,
            sector: h.sector
          };
        })
      };
    });
    const stkInvested = memberStkPortfolios.reduce(function(s, p) { return s + p.totalInvestment; }, 0);
    const stkCurrent = memberStkPortfolios.reduce(function(s, p) { return s + p.currentValue; }, 0);

    // Other investments for this member
    const memberOther = otherInv.filter(function(i) { return i.familyMemberId === memberId; });
    const otherInvestedAmt = memberOther.reduce(function(s, i) { return s + (parseFloat(i.investedAmount) || 0); }, 0);
    const otherCurrentAmt = memberOther.reduce(function(s, i) { return s + (parseFloat(i.currentValue) || 0); }, 0);

    // Insurance for this member
    const memberInsurance = insurance.filter(function(p) { return p.memberId === memberId; });
    const insuranceCover = memberInsurance.reduce(function(s, p) { return s + (parseFloat(p.sumAssured) || 0); }, 0);

    const totalInvested = mfInvested + stkInvested + otherInvestedAmt;
    const totalCurrent = mfCurrent + stkCurrent + otherCurrentAmt;

    membersData.push({
      memberName: member.memberName,
      mutualFunds: {
        count: memberMFPortfolios.length,
        invested: mfInvested,
        current: mfCurrent,
        pnl: mfCurrent - mfInvested,
        portfolios: mfPortfolioEntries
      },
      stocks: {
        count: memberStkPortfolios.length,
        invested: stkInvested,
        current: stkCurrent,
        pnl: stkCurrent - stkInvested,
        portfolios: stkPortfolioEntries
      },
      otherInvestments: {
        count: memberOther.length,
        invested: otherInvestedAmt,
        current: otherCurrentAmt,
        pnl: otherCurrentAmt - otherInvestedAmt,
        investments: memberOther
      },
      insurance: {
        count: memberInsurance.length,
        totalCover: insuranceCover,
        policies: memberInsurance
      },
      totals: {
        invested: totalInvested,
        current: totalCurrent,
        pnl: totalCurrent - totalInvested
      }
    });
  });

  return membersData;
}

/**
 * Infer asset category from fund name (server-side equivalent of React inferCategory)
 * @param {string} name - Fund name
 * @returns {string} Category
 */
function _inferCategory(name) {
  if (!name) return 'Other';
  const n = name.toLowerCase();
  if (n.includes('gold') || n.includes('silver') || n.includes('commodity')) return 'Commodity';
  if (n.includes('liquid') || n.includes('money market') || n.includes('overnight')) return 'Liquid';
  if (n.includes('gilt') || n.includes('government securities') || n.includes('constant maturity')) return 'Gilt';
  if (n.includes('elss') || n.includes('tax saver')) return 'ELSS';
  if (n.includes('debt') || n.includes('bond') || n.includes('income fund') || n.includes('corporate bond') ||
      n.includes('banking & psu') || n.includes('short duration') || n.includes('medium duration') ||
      n.includes('long duration') || n.includes('short term') || n.includes('medium term') ||
      n.includes('floater') || n.includes('floating rate') || n.includes('credit') ||
      n.includes('accrual') || n.includes('savings fund') || n.includes('ultra short')) return 'Debt';
  if (n.includes('multi asset')) return 'Multi-Asset';
  if (n.includes('hybrid') || n.includes('balanced') || n.includes('dynamic asset') ||
      n.includes('arbitrage') || n.includes('retirement') ||
      n.includes('children') || n.includes('pension')) return 'Hybrid';
  if (n.includes('equity') || n.includes('flexi cap') || n.includes('large cap') || n.includes('mid cap') ||
      n.includes('small cap') || n.includes('multi cap') || n.includes('focused') || n.includes('contra') ||
      n.includes('value fund') || n.includes('thematic') || n.includes('sectoral') ||
      n.includes('consumption') || n.includes('infrastructure') || n.includes('pharma') ||
      n.includes('healthcare') || n.includes('technology') || n.includes('fmcg') ||
      n.includes('mnc') || n.includes('opportunities fund') || n.includes('midcap') ||
      n.includes('smallcap') || n.includes('largecap') || n.includes('large & mid')) return 'Equity';
  if (n.includes('index') || n.includes('etf') || n.includes('nifty') || n.includes('sensex')) return 'Index';
  if (n.includes('fund of fund') || n.includes('fof')) return 'Hybrid';
  if (n.includes('aggressive') || n.includes('conservative')) return 'Hybrid';
  return 'Other';
}

/**
 * Split fund name to extract main name (strip Direct/Regular/Growth suffix)
 * Server-side equivalent of React splitFundName
 * @param {string} name - Full fund name
 * @returns {string} Main fund name
 */
function _splitFundName(name) {
  if (!name) return '';
  const match = name.match(/ ?-\s+(Direct|Regular|Growth)\b/i);
  if (match) {
    return name.slice(0, match.index).trim();
  }
  return name;
}

/**
 * Wrapper: get consolidated family dashboard data using the new buildDashboardReportData().
 * Maintains backward compatibility with sendDashboardEmailReport() which calls this.
 * @param {Array} allMembers - Array of family member objects (ignored, data is fetched internally)
 * @returns {Object} { success, data } matching the old return shape
 */
function getConsolidatedFamilyDashboardData(allMembers) {
  try {
    const data = buildDashboardReportData();
    return { success: true, data: data };
  } catch (error) {
    log('Error in getConsolidatedFamilyDashboardData wrapper: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Get total liabilities for the family
 * @returns {number} Total outstanding balance across all liabilities
 */
function getTotalLiabilities() {
  try {
    const liabilitiesSheet = getSheet(CONFIG.liabilitiesSheet);
    if (!liabilitiesSheet) return 0;

    const data = liabilitiesSheet.getDataRange().getValues();
    let total = 0;

    for (let i = 2; i < data.length; i++) {
      const status = data[i][7]; // Column H - Status
      if (status === 'Active') {
        const outstandingBalance = parseFloat(data[i][4]) || 0; // Column E - OutstandingBalance
        total += outstandingBalance;
      }
    }

    return total;
  } catch (error) {
    log('Error getting total liabilities: ' + error.toString());
    return 0;
  }
}

/**
 * Get asset allocation data from fund-level allocations and OtherInvestments
 * Reads AssetAllocations sheet to get each fund's breakdown, then calculates weighted allocation
 * @returns {Object} Asset allocation breakdown
 */
function getAssetAllocationData() {
  try {
    const assetClasses = {
      'Equity': 0,
      'Debt': 0,
      'Commodities': 0,
      'Real Estate': 0,
      'Crypto': 0,
      'Other': 0
    };

    // Load AssetAllocations sheet (fund-level allocation data)
    // Column A = Fund Code, Column B = Fund Name, Column C = Asset Allocation JSON, Column D = Equity Allocation JSON
    const allocSheet = getSheet(CONFIG.assetAllocationsSheet);
    const fundAllocations = new Map();

    if (allocSheet) {
      const allocData = allocSheet.getDataRange().getValues();
      // Row 1 = Watermark, Row 2 = Headers, Row 3+ = Data
      for (let i = 2; i < allocData.length; i++) {
        const fundCode = allocData[i][0];
        const assetAllocationJSON = allocData[i][2];

        if (fundCode && assetAllocationJSON) {
          try {
            const allocation = JSON.parse(assetAllocationJSON);
            // Convert to lowercase keys to match the old structure
            const normalizedAllocation = {
              equity: allocation.Equity || 0,
              debt: allocation.Debt || 0,
              cash: allocation.Cash || 0,
              realEstate: allocation['Real Estate'] || 0,
              commodities: allocation.Commodities || 0
            };
            fundAllocations.set(fundCode.toString(), normalizedAllocation);
          } catch (e) {
            log('Error parsing allocation for fund ' + fundCode + ': ' + e.toString());
          }
        }
      }
    }

    // Get all portfolios and calculate weighted allocation
    const portfolios = getAllPortfolios();

    portfolios.forEach(portfolio => {
      if (portfolio.status !== 'Active') return;

      try {
        const portfolioSheet = getSheet(portfolio.sheetName);
        if (!portfolioSheet) return;

        const lastRow = portfolioSheet.getLastRow();
        if (lastRow < 3) return; // No data rows

        // Read holdings data (skip header rows 1-2)
        const holdingsData = portfolioSheet.getRange(3, 1, lastRow - 2, 12).getValues();

        holdingsData.forEach(row => {
          // Skip empty rows
          if (!row[0]) return;

          const schemeCode = row[0].toString(); // Column A - Scheme Code
          const currentValue = parseFloat(row[8]) || 0; // Column I - CurrentValue

          if (currentValue === 0) return;

          // Check if we have asset allocation data for this fund
          const fundAllocation = fundAllocations.get(schemeCode);

          if (fundAllocation) {
            // Use fund-level allocation percentages to calculate weighted values
            assetClasses['Equity'] += currentValue * (fundAllocation.equity || 0) / 100;
            assetClasses['Debt'] += currentValue * (fundAllocation.debt || 0) / 100;
            assetClasses['Commodities'] += currentValue * ((fundAllocation.cash || 0) + (fundAllocation.commodities || 0)) / 100;
            assetClasses['Real Estate'] += currentValue * (fundAllocation.realEstate || 0) / 100;

            // If allocation doesn't add up to 100%, put remainder in Other
            const totalAlloc = (fundAllocation.equity || 0) + (fundAllocation.debt || 0) + (fundAllocation.cash || 0) +
                              (fundAllocation.commodities || 0) + (fundAllocation.realEstate || 0);
            if (totalAlloc < 100) {
              assetClasses['Other'] += currentValue * (100 - totalAlloc) / 100;
            }
          } else {
            // No allocation data found - categorize as Other
            assetClasses['Other'] += currentValue;
          }
        });
      } catch (error) {
        log('Error reading portfolio ' + portfolio.portfolioName + ': ' + error.toString());
      }
    });

    // Get OtherInvestments data
    const otherInvSheet = getSheet(CONFIG.otherInvestmentsSheet);
    if (otherInvSheet) {
      const otherInvData = otherInvSheet.getDataRange().getValues();

      for (let i = 2; i < otherInvData.length; i++) {
        const status = otherInvData[i][12]; // Column M - Status
        if (status !== 'Active') continue;

        let assetClass = otherInvData[i][2] || 'Commodities'; // Column C - Investment Category
        const currentValue = parseFloat(otherInvData[i][8]) || 0; // Column I - CurrentValue

        // Map legacy categories to the 6 main categories
        if (assetClass === 'Gold' || assetClass === 'Hybrid' || assetClass === 'Cash') {
          assetClass = 'Commodities';
        } else if (assetClass === 'Alternative') {
          assetClass = 'Other';
        }

        if (assetClasses.hasOwnProperty(assetClass)) {
          assetClasses[assetClass] += currentValue;
        } else {
          assetClasses['Other'] += currentValue;
        }
      }
    }

    // Calculate total and percentages
    const total = Object.values(assetClasses).reduce((sum, val) => sum + val, 0);

    const assetAllocationArray = Object.keys(assetClasses).map(assetClass => ({
      assetClass: assetClass,
      value: assetClasses[assetClass],
      percentage: total > 0 ? (assetClasses[assetClass] / total) * 100 : 0
    })).filter(item => item.value > 0) // Only include non-zero allocations
      .sort((a, b) => b.value - a.value); // Sort by value descending

    return {
      total: total,
      breakdown: assetAllocationArray
    };
  } catch (error) {
    log('Error getting asset allocation data: ' + error.toString());
    return {
      total: 0,
      breakdown: []
    };
  }
}

/**
 * Build email subject based on report type
 * @param {string} reportType - 'daily', 'weekly', or 'manual'
 * @param {number} netWorth - Family net worth to include in subject
 * @param {string} familyHeadName - Full name of the family head (e.g. 'Jagadeesh Manne')
 */
function buildEmailSubject(reportType, netWorth, familyHeadName) {
  const date = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy');

  // Extract family surname (last word of the name) — e.g. "Jagadeesh Manne" → "Manne"
  var familyLabel = 'Family';
  if (familyHeadName) {
    var parts = familyHeadName.trim().split(/\s+/);
    var surname = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    familyLabel = surname + ' Family';
  }

  // Format net worth for display
  let netWorthFormatted = '';
  if (netWorth) {
    const absAmount = Math.abs(netWorth);
    if (absAmount >= 10000000) {
      netWorthFormatted = '\u20B9' + (absAmount / 10000000).toFixed(2) + ' Cr';
    } else if (absAmount >= 100000) {
      netWorthFormatted = '\u20B9' + (absAmount / 100000).toFixed(2) + ' L';
    } else {
      netWorthFormatted = '\u20B9' + absAmount.toFixed(0);
    }
    if (netWorth < 0) netWorthFormatted = '-' + netWorthFormatted;
  }

  // Subject: "Manne Family — Financial Summary | ₹X.XX Cr — 01 Mar 2026"
  var subject = familyLabel + ' \u2014 Financial Summary';
  if (netWorthFormatted) subject += ' | ' + netWorthFormatted;
  subject += ' \u2014 ' + date;
  return subject;
}

/**
 * Build HTML email body
 */
function buildEmailBody(data, reportType) {
  const formatCurrency = (value) => {
    return '₹' + value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const netWorthColor = data.netWorth >= 0 ? '#10b981' : '#ef4444';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f3f4f6; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .header p { margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }
    .content { padding: 30px 20px; }
    .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
    .summary-card { background: #f9fafb; border-radius: 8px; padding: 15px; border-left: 4px solid #3b82f6; }
    .summary-card.green { border-left-color: #10b981; }
    .summary-card.red { border-left-color: #ef4444; }
    .summary-card.orange { border-left-color: #f59e0b; }
    .summary-card .label { font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600; margin-bottom: 5px; }
    .summary-card .value { font-size: 20px; font-weight: 700; color: #0f172a; }
    .net-worth { background: ${netWorthColor}; color: white; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
    .net-worth .label { font-size: 14px; opacity: 0.9; margin-bottom: 5px; }
    .net-worth .value { font-size: 32px; font-weight: 700; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
    .footer a { color: #0284c7; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💰 Capital Friends</h1>
      <p>Family Wealth Report</p>
    </div>

    <div class="content">
      <p style="color: #6b7280; margin-bottom: 20px;">Generated on ${data.generatedAt}</p>

      <div class="net-worth">
        <div class="label">NET WORTH</div>
        <div class="value">${formatEmailCurrency(data.netWorth)}</div>
      </div>

      <div class="summary-grid">
        <div class="summary-card green">
          <div class="label">Total Investments</div>
          <div class="value">${formatEmailCurrency(data.totalInvestments)}</div>
        </div>

        <div class="summary-card red">
          <div class="label">Total Liabilities</div>
          <div class="value">${formatEmailCurrency(data.totalLiabilities)}</div>
        </div>

        <div class="summary-card orange">
          <div class="label">Insurance Cover</div>
          <div class="value">${formatEmailCurrency(data.totalInsuranceCover)}</div>
        </div>

        <div class="summary-card">
          <div class="label">Family Members</div>
          <div class="value">${data.familyMembers}</div>
        </div>
      </div>

      <div style="background: #f9fafb; border-radius: 8px; padding: 15px; margin-top: 20px;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">PORTFOLIO BREAKDOWN</h3>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280; font-size: 14px;">💼 Investments</span>
          <span style="font-weight: 600; color: #0f172a;">${data.investments}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280; font-size: 14px;">💳 Liabilities</span>
          <span style="font-weight: 600; color: #0f172a;">${data.liabilities}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #6b7280; font-size: 14px;">🛡️ Insurance Policies</span>
          <span style="font-weight: 600; color: #0f172a;">${data.insurance}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #6b7280; font-size: 14px;">🏦 Bank Accounts</span>
          <span style="font-weight: 600; color: #0f172a;">${data.bankAccounts}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      <p style="margin: 0 0 5px 0;">Generated by <strong>Capital Friends V2</strong></p>
      <p style="margin: 0;">Track your family wealth with confidence 💚</p>
    </div>
  </div>
</body>
</html>
  `;
}

// ============================================================================
// MENU INTEGRATION FUNCTION
// ============================================================================

/**
 * Show Email Settings Dialog
 * Called from menu
 */
function showEmailSettingsDialog() {
  try {
    const template = HtmlService.createTemplateFromFile('EmailSettings');
    const htmlOutput = template.evaluate()
      .setWidth(650)
      .setHeight(700);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, '📧 Email Settings');
  } catch (error) {
    log('Error showing email settings dialog: ' + error.toString());
    showError('Error opening Email Settings: ' + error.message);
  }
}

// ============================================================================
// SETTINGS HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user has configured email settings
 * @returns {boolean} True if email has been configured
 */
function isEmailConfigured() {
  try {
    const settingsSheet = getSheet(CONFIG.settingsSheet);
    if (!settingsSheet) {
      return false;
    }

    // Find EmailConfigured setting
    const data = settingsSheet.getDataRange().getValues();
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] === 'EmailConfigured') {
        return data[i][1] === 'TRUE' || data[i][1] === true;
      }
    }

    // If setting doesn't exist, email is not configured
    return false;
  } catch (error) {
    log('Error checking email configuration: ' + error.toString());
    return false;
  }
}

/**
 * Mark email as configured
 */
function markEmailAsConfigured() {
  try {
    const settingsSheet = getSheet(CONFIG.settingsSheet);
    if (!settingsSheet) {
      return;
    }

    // Find EmailConfigured setting and update it
    const data = settingsSheet.getDataRange().getValues();
    for (let i = 2; i < data.length; i++) {
      if (data[i][0] === 'EmailConfigured') {
        settingsSheet.getRange(i + 1, 2).setValue('TRUE');
        log('Marked email as configured');
        return;
      }
    }

    // If setting doesn't exist, add it
    settingsSheet.appendRow(['EmailConfigured', 'TRUE', 'Whether user has configured email settings (TRUE/FALSE)']);
    log('Added EmailConfigured setting');
  } catch (error) {
    log('Error marking email as configured: ' + error.toString());
  }
}

/**
 * Show first-time email configuration dialog
 * Auto-configures Daily 9 AM schedule by default
 */
function showFirstTimeEmailSetup() {
  const ui = SpreadsheetApp.getUi();

  // Auto-configure to Daily 9 AM
  const result = updateEmailSchedule('daily', 9);

  if (result.success) {
    ui.alert(
      '✅ Email Reports Configured!',
      'Your family wealth reports have been configured:\n\n' +
      '📧 Daily emails at 9:00 AM\n\n' +
      'Reports will be sent to family members with "Include in Email Reports" enabled.\n\n' +
      'You can change these settings anytime from:\n' +
      'Menu → Capital Friends → Email Settings',
      ui.ButtonSet.OK
    );
  } else {
    ui.alert(
      '⚠️ Email Configuration',
      'Email reports have been set up, but you can configure them from:\n' +
      'Menu → Capital Friends → Email Settings',
      ui.ButtonSet.OK
    );
  }
}

/**
 * Check email configuration on spreadsheet open
 * Called by time-delayed trigger from onOpen()
 */
function checkEmailConfigurationOnOpen() {
  try {
    // Delete this one-time trigger first
    deleteThisTrigger();

    // Check if email has been configured
    if (!isEmailConfigured()) {
      log('First-time user detected - auto-configuring email to Daily 9 AM');
      showFirstTimeEmailSetup();
    } else {
      log('Email already configured - skipping first-time setup');
    }
  } catch (error) {
    log('Error in checkEmailConfigurationOnOpen: ' + error.toString());
  }
}

/**
 * Delete the current trigger (for one-time triggers)
 */
function deleteThisTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'checkEmailConfigurationOnOpen') {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  } catch (error) {
    log('Error deleting trigger: ' + error.toString());
  }
}

// ============================================================================
// DEBUG & TESTING FUNCTIONS
// ============================================================================

// ============================================================================
// DATA GATHERING FUNCTIONS FOR ADDITIONAL EMAIL SECTIONS
// ============================================================================

/**
 * Get questionnaire data for Action Items section
 * @returns {Object} Questionnaire answers with question texts
 */
function getQuestionnaireData() {
  try {
    const sheet = getSheet(CONFIG.questionnaireSheet);
    if (!sheet) {
      log('Questionnaire sheet not found');
      return { hasData: false, answers: [], yesCount: 0, noCount: 0 };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      log('No questionnaire data found');
      return { hasData: false, answers: [], yesCount: 0, noCount: 0 };
    }

    // Read questionnaire data (Row 3 onwards: Question #, Question Text, Answer)
    const data = sheet.getRange(3, 1, lastRow - 2, 3).getValues();

    const answers = [];
    let yesCount = 0;
    let noCount = 0;

    data.forEach(row => {
      if (row[0]) { // If question number exists
        const answer = {
          questionNumber: row[0],
          questionText: row[1],
          answer: row[2]
        };

        answers.push(answer);

        if (row[2] === 'Yes') yesCount++;
        if (row[2] === 'No') noCount++;
      }
    });

    return {
      hasData: true,
      answers: answers,
      yesCount: yesCount,
      noCount: noCount,
      totalQuestions: answers.length
    };
  } catch (error) {
    log('Error getting questionnaire data: ' + error.toString());
    return { hasData: false, answers: [], yesCount: 0, noCount: 0 };
  }
}

/**
 * Get all insurance policies with detailed information for email report
 * @returns {Object} Insurance policies grouped by type
 */
function getAllInsurancePoliciesDetailed() {
  try {
    const allPolicies = getAllInsurancePolicies() || [];

    // Group policies by type
    const termInsurance = [];
    const healthInsurance = [];
    const otherInsurance = [];

    allPolicies.forEach(policy => {
      // Parse dynamic fields to get premium and dates
      let premium = '';
      let maturityDate = '';
      let renewalDate = '';

      try {
        if (policy.dynamicFields) {
          const dynamic = typeof policy.dynamicFields === 'string'
            ? JSON.parse(policy.dynamicFields)
            : policy.dynamicFields;

          premium = dynamic.premium || '';
          maturityDate = dynamic.maturityDate || '';
          renewalDate = dynamic.renewalDate || '';
        }
      } catch (e) {
        log('Error parsing dynamic fields for policy: ' + policy.policyId);
      }

      const policyDetail = {
        member: policy.insuredMember,
        provider: policy.company,
        policyNumber: policy.policyNumber,
        policyType: policy.policyName,
        sumAssured: policy.sumAssured,
        premium: premium,
        maturityDate: maturityDate,
        renewalDate: renewalDate,
        status: policy.status
      };

      // Categorize by policy type
      const type = (policy.policyType || '').toLowerCase();
      if (type.includes('term') || type.includes('life')) {
        termInsurance.push(policyDetail);
      } else if (type.includes('health') || type.includes('medical')) {
        healthInsurance.push(policyDetail);
      } else {
        otherInsurance.push(policyDetail);
      }
    });

    return {
      termInsurance: termInsurance,
      healthInsurance: healthInsurance,
      otherInsurance: otherInsurance,
      totalPolicies: allPolicies.length
    };
  } catch (error) {
    log('Error getting detailed insurance policies: ' + error.toString());
    return {
      termInsurance: [],
      healthInsurance: [],
      otherInsurance: [],
      totalPolicies: 0
    };
  }
}

/**
 * Get all family members for Family Member Details section
 * @returns {Array} Array of family member objects
 */
function getAllFamilyMembersForReport() {
  try {
    const sheet = getSheet(CONFIG.familyMembersSheet);
    if (!sheet) {
      log('FamilyMembers sheet not found');
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return [];
    }

    // FamilyMembers structure: A=Member ID, B=Name, C=Relationship, D=DOB, E=Aadhar, F=PAN, G=Mobile, H=Email, ...
    const data = sheet.getRange(3, 1, lastRow - 2, 8).getValues();

    const members = [];
    data.forEach(row => {
      if (row[0]) { // If Member ID exists
        members.push({
          memberId: row[0],
          memberName: row[1],
          relationship: row[2],
          dob: row[3] ? Utilities.formatDate(new Date(row[3]), 'Asia/Kolkata', 'dd MMM yyyy') : '',
          aadhar: row[4] || '',
          pan: row[5] || '',
          mobile: row[6] || '',
          email: row[7] || ''
        });
      }
    });

    return members;
  } catch (error) {
    log('Error getting family members: ' + error.toString());
    return [];
  }
}

/**
 * Get all bank accounts for Account Summary section
 * @returns {Array} Array of bank account objects
 */
function getAllBankAccountsForReport() {
  try {
    const sheet = getSheet(CONFIG.bankAccountsSheet);
    if (!sheet) {
      log('BankAccounts sheet not found');
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return [];
    }

    // BankAccounts structure: A=Account ID, B=Member, C=Bank Name, D=Account Number, E=Account Type, F=Branch, G=IFSC, ...
    const data = sheet.getRange(3, 1, lastRow - 2, 6).getValues();

    const accounts = [];
    data.forEach(row => {
      if (row[0]) { // If Account ID exists
        accounts.push({
          accountId: row[0],
          member: row[1],
          bankName: row[2],
          accountNumber: row[3],
          accountType: row[4],
          branch: row[5]
        });
      }
    });

    return accounts;
  } catch (error) {
    log('Error getting bank accounts: ' + error.toString());
    return [];
  }
}

/**
 * Get all investment accounts for Account Summary section
 * @returns {Array} Array of investment account objects
 */
function getAllInvestmentAccountsForReport() {
  try {
    const sheet = getSheet(CONFIG.investmentAccountsSheet);
    if (!sheet) {
      log('InvestmentAccounts sheet not found');
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      return [];
    }

    // InvestmentAccounts structure: A=Account ID, B=Member, C=Platform, D=Account Type, E=Client ID, F=Email, G=Phone, ...
    const data = sheet.getRange(3, 1, lastRow - 2, 7).getValues();

    const accounts = [];
    data.forEach(row => {
      if (row[0]) { // If Account ID exists
        accounts.push({
          accountId: row[0],
          member: row[1],
          platform: row[2],
          accountType: row[3],
          clientId: row[4],
          email: row[5],
          phone: row[6]
        });
      }
    });

    return accounts;
  } catch (error) {
    log('Error getting investment accounts: ' + error.toString());
    return [];
  }
}

/**
 * Build meaningful email body HTML with logo, dashboard, and action items
 * @param {Object} data - Consolidated family dashboard data
 * @returns {string} HTML email body
 */
function buildEmailBodyHTML(data) {
  const greeting = getTimeBasedGreeting();
  const date = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy, hh:mm a');

  // Format totals
  const totalWealth = formatEmailCurrency(data.familyTotals.totalWealth);
  const liabilities = formatEmailCurrency(data.familyTotals.liabilities);
  const netWorth = formatEmailCurrency(data.familyTotals.totalWealth - data.familyTotals.liabilities);
  const totalPnL = formatEmailCurrency(data.familyTotals.totalPnL);
  const pnlColor = data.familyTotals.totalPnL >= 0 ? '#10b981' : '#ef4444';

  // Get action items count
  const actionItemsCount = data.questionnaireData?.noCount || 0;

  // Build action items summary
  let actionItemsHTML = '';
  if (actionItemsCount > 0) {
    const actionItems = data.questionnaireData.answers.filter(item => item.answer === 'No');
    const actionList = actionItems.map(item => `      <li style="margin-bottom: 8px;">${item.questionText}</li>`).join('\n');

    actionItemsHTML = `
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #92400e;">⚠️ Action Items Required (${actionItemsCount})</h3>
      <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px;">
${actionList}
      </ul>
    </div>
    `;
  } else if (data.questionnaireData?.hasData) {
    actionItemsHTML = `
    <div style="background-color: #d1fae5; border-left: 4px solid: #10b981; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 14px; color: #065f46;">✅ <strong>Excellent!</strong> All financial health checks completed.</p>
    </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <!-- Header with Logo -->
    <div style="background-color: white; border-left: 4px solid #6366f1; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <h1 style="margin: 0; font-size: 24px; color: #1f2937;">💰 Capital Friends</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; color: #6b7280;">Family Wealth Report</p>
        </div>
        <div style="text-align: right;">
          <p style="margin: 0; font-size: 14px; color: #1f2937; font-weight: 600;">Jagadeesh Manne</p>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">💰 UPI: jagadeeshmanne.hdfc@kphdfc</p>
        </div>
      </div>
      <p style="margin: 16px 0 0 0; font-size: 13px; color: #6b7280; text-align: center;">${greeting} · ${date}</p>
    </div>

    <!-- Dashboard Summary -->
    <div style="background-color: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #1f2937;">📊 Wealth Dashboard</h2>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Total Wealth</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #10b981;">${totalWealth}</p>
        </div>
        <div style="background-color: #f9fafb; padding: 12px; border-radius: 6px;">
          <p style="margin: 0 0 4px 0; font-size: 11px; color: #6b7280; text-transform: uppercase;">Liabilities</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ef4444;">${liabilities}</p>
        </div>
      </div>

      <div style="background-color: #f0f9ff; border: 2px solid #0ea5e9; padding: 16px; border-radius: 6px;">
        <p style="margin: 0 0 4px 0; font-size: 12px; color: #0c4a6e; text-transform: uppercase; font-weight: 600;">Net Worth</p>
        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #0369a1;">${netWorth}</p>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: ${pnlColor}; font-weight: 600;">Total P&L: ${totalPnL}</p>
      </div>
    </div>

    ${actionItemsHTML}

    <!-- PDF Attachment Notice -->
    <div style="background-color: #ede9fe; border-left: 4px solid #8b5cf6; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
      <p style="margin: 0; font-size: 14px; color: #5b21b6;">
        📎 <strong>Detailed Report Attached</strong><br>
        Please find your complete family wealth report attached as a PDF.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color: white; border-radius: 8px; padding: 16px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
        🔒 This report is auto-generated from your Google Sheets.<br>
        Keep your financial data secure.
      </p>
      <p style="margin: 0; font-size: 13px; color: #1f2937;">
        Made with ❤️ in India by <strong>Jagadeesh Manne</strong><br>
        💝 Donate via UPI: <strong>jagadeeshmanne.hdfc@kphdfc</strong>
      </p>
    </div>

  </div>
</body>
</html>
  `.trim();
}

// getTimeBasedGreeting() — defined in EmailTemplate.js (single source of truth)
// formatEmailCurrency() — use formatEmailCurrency() from EmailTemplate.js instead

// ============================================================================
// END OF EMAILREPORTS.GS
// ============================================================================
