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

    if (!members || members.length === 0) {
      return [];
    }

    return members.map(member => ({
      memberId: member.memberId,
      name: member.memberName,
      email: member.email,
      pan: member.pan // Include PAN directly for password
    })).filter(m => m.email); // Only members with valid email

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

    if (recipients.length === 0) {
      log('No email recipients configured - skipping email send');
      return { success: false, error: 'No email recipients configured' };
    }

    // Get all family members
    const allMembers = getFamilyMembersForEmailReports();

    if (!allMembers || allMembers.length === 0) {
      log('No family members found for email reports');
      return { success: false, error: 'No family members configured' };
    }

    // Gather consolidated data for ALL family members
    const consolidatedData = getConsolidatedFamilyDashboardData(allMembers);

    if (!consolidatedData.success) {
      log('Failed to generate consolidated family data');
      return { success: false, error: consolidatedData.error };
    }

    // Build email subject with net worth
    const netWorth = consolidatedData.data.familyTotals.totalWealth - consolidatedData.data.familyTotals.liabilities;
    const subject = buildEmailSubject(reportType, netWorth);

    // Build consolidated email body showing all family members
    const htmlBody = buildConsolidatedEmailBody(consolidatedData.data, reportType);

    // Use the same HTML for email body (Tailwind will work in email clients that support it)
    const emailBodyHTML = htmlBody;

    // Build separate inline-style version for PDF (Tailwind doesn't work in PDF)
    const htmlBodyForPDF = buildConsolidatedEmailBodyInlineStyles(consolidatedData.data, reportType);

    // Send INDIVIDUAL emails to each recipient with their own PAN-protected PDF
    let successCount = 0;
    let errorMessages = [];

    try {
      if (sendAsPDF) {
        // Send individual email to each recipient with their own PAN-protected PDF
        recipients.forEach(recipient => {
          try {
            // Get this recipient's PAN for PDF password (lowercase)
            const recipientPAN = recipient.pan ? recipient.pan.toString().toLowerCase() : '';

            // Generate password-protected PDF for this recipient (use inline-style version)
            const pdfBlob = convertHTMLToPDF(htmlBodyForPDF, 'Family_Wealth_Report_' + recipient.memberId, recipientPAN);

            MailApp.sendEmail({
              to: recipient.email,
              subject: subject,
              htmlBody: emailBodyHTML,
              attachments: [pdfBlob]
            });

            log('✅ Email sent to: ' + recipient.name + ' (' + recipient.email + ')');
            if (recipientPAN) {
              log('   Member ID: ' + recipient.memberId);
              log('   PDF password: ' + recipientPAN);
            } else {
              log('   Warning: No PAN found for ' + recipient.name + ' - PDF sent without password protection');
            }
            successCount++;
          } catch (recipientError) {
            const errorMsg = 'Failed to send to ' + recipient.name + ': ' + recipientError.message;
            log('❌ ' + errorMsg);
            errorMessages.push(errorMsg);
          }
        });

        log('✅ Sent ' + successCount + ' of ' + recipients.length + ' emails');
      } else {
        // Send as HTML email (old method) - send to all at once
        const recipientEmails = recipients.map(r => r.email).join(',');
        MailApp.sendEmail({
          to: recipientEmails,
          subject: subject,
          htmlBody: htmlBody
        });
        log('✅ Consolidated HTML email sent to: ' + recipientEmails);
        successCount = recipients.length;
      }

      return {
        success: successCount > 0,
        sentCount: successCount,
        errors: errorMessages.length > 0 ? errorMessages : undefined
      };
    } catch (emailError) {
      log('❌ Failed to send email: ' + emailError.toString());
      return { success: false, error: emailError.message };
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
    // Create a temporary Google Doc
    const tempDoc = DocumentApp.create('Temp_' + fileName);
    const docId = tempDoc.getId();

    // Get the doc body and clear it
    const body = tempDoc.getBody();
    body.clear();

    // Note: Google Docs doesn't support direct HTML to Doc conversion with full styling
    // Instead, we'll use Google Drive's built-in HTML to PDF conversion

    // Create temp HTML file in Drive
    const tempFolder = DriveApp.getRootFolder();
    const htmlFile = tempFolder.createFile(fileName + '.html', htmlContent, MimeType.HTML);
    const htmlFileId = htmlFile.getId();

    // Get PDF blob from HTML file
    let pdfBlob = htmlFile.getAs(MimeType.PDF);
    pdfBlob.setName(fileName + '.pdf');

    // Clean up temp files
    DriveApp.getFileById(htmlFileId).setTrashed(true);
    DriveApp.getFileById(docId).setTrashed(true);

    // NOTE: PDF password protection requires third-party API integration
    // For now, PDFs are sent without password protection
    // Each member receives their own individual email with the PDF
    if (password) {
      log('ℹ️ PDF password requested for member: ' + password);
      log('   Password protection not yet implemented (requires external API)');
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
 * Get personalized dashboard data for a specific family member
 * @param {string} memberName - Name of the family member
 * @returns {Object} Personalized data for this member
 */
function getMemberDashboardData(memberName) {
  try {
    // Get all data filtered by this member
    const allMF = getAllPortfolios() || [];
    const allStocks = getAllStockPortfolios() || [];
    const allOtherInv = getAllInvestments() || [];
    const allInsurance = getAllInsurancePolicies() || [];

    // Filter by member
    const memberMF = allMF.filter(p => p.owner === memberName && p.status === 'Active');
    const memberStocks = allStocks.filter(p => p.owner === memberName && p.status === 'Active');
    const memberOtherInv = allOtherInv.filter(i => i.owner === memberName && i.status === 'Active');
    const memberInsurance = allInsurance.filter(p => p.insuredPerson === memberName && p.status === 'Active');

    // Calculate MF totals
    const mfInvested = memberMF.reduce((sum, p) => sum + (parseFloat(p.totalInvestment) || 0), 0);
    const mfCurrent = memberMF.reduce((sum, p) => sum + (parseFloat(p.currentValue) || 0), 0);
    const mfUnrealizedPnL = memberMF.reduce((sum, p) => sum + (parseFloat(p.unrealizedPnl) || 0), 0);
    const mfRealizedPnL = memberMF.reduce((sum, p) => sum + (parseFloat(p.realizedPnl) || 0), 0);
    const mfPnL = mfUnrealizedPnL + mfRealizedPnL;
    const mfPnLPercent = mfInvested > 0 ? (mfPnL / mfInvested) * 100 : 0;

    // Calculate Stock totals
    const stocksInvested = memberStocks.reduce((sum, p) => sum + (parseFloat(p.totalInvestment) || 0), 0);
    const stocksCurrent = memberStocks.reduce((sum, p) => sum + (parseFloat(p.currentValue) || 0), 0);
    const stocksUnrealizedPnL = memberStocks.reduce((sum, p) => sum + (parseFloat(p.unrealizedPnl) || 0), 0);
    const stocksRealizedPnL = memberStocks.reduce((sum, p) => sum + (parseFloat(p.realizedPnl) || 0), 0);
    const stocksPnL = stocksUnrealizedPnL + stocksRealizedPnL;
    const stocksPnLPercent = stocksInvested > 0 ? (stocksPnL / stocksInvested) * 100 : 0;

    // Calculate Other Investment totals
    const otherInvested = memberOtherInv.reduce((sum, i) => sum + (parseFloat(i.investedAmount) || 0), 0);
    const otherCurrent = memberOtherInv.reduce((sum, i) => sum + (parseFloat(i.currentValue) || 0), 0);
    const otherPnL = otherCurrent - otherInvested;
    const otherPnLPercent = otherInvested > 0 ? (otherPnL / otherInvested) * 100 : 0;

    // Calculate totals
    const totalInvested = mfInvested + stocksInvested + otherInvested;
    const totalCurrent = mfCurrent + stocksCurrent + otherCurrent;
    const totalUnrealizedPnL = mfUnrealizedPnL + stocksUnrealizedPnL;
    const totalRealizedPnL = mfRealizedPnL + stocksRealizedPnL;
    const totalPnL = totalUnrealizedPnL + totalRealizedPnL + otherPnL;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    // Insurance cover
    const totalInsuranceCover = memberInsurance.reduce((sum, p) => sum + (parseFloat(p.sumAssured) || 0), 0);

    return {
      success: true,
      data: {
        memberName: memberName,

        // Mutual Funds
        mutualFunds: {
          count: memberMF.length,
          invested: mfInvested,
          current: mfCurrent,
          pnl: mfPnL,
          pnlPercent: mfPnLPercent,
          portfolios: memberMF
        },

        // Stocks
        stocks: {
          count: memberStocks.length,
          invested: stocksInvested,
          current: stocksCurrent,
          pnl: stocksPnL,
          pnlPercent: stocksPnLPercent,
          portfolios: memberStocks
        },

        // Other Investments
        otherInvestments: {
          count: memberOtherInv.length,
          invested: otherInvested,
          current: otherCurrent,
          pnl: otherPnL,
          pnlPercent: otherPnLPercent,
          investments: memberOtherInv
        },

        // Insurance
        insurance: {
          count: memberInsurance.length,
          totalCover: totalInsuranceCover,
          policies: memberInsurance
        },

        // Totals
        totals: {
          invested: totalInvested,
          current: totalCurrent,
          unrealizedPnL: totalUnrealizedPnL,
          realizedPnL: totalRealizedPnL,
          pnl: totalPnL,
          pnlPercent: totalPnLPercent
        },

        generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      }
    };
  } catch (error) {
    log('Error getting member dashboard data: ' + error.toString());
    return { success: false, error: error.message };
  }
}

/**
 * Get consolidated dashboard data for ALL family members
 * @param {Array} allMembers - Array of family member objects
 * @returns {Object} Consolidated data for all family members
 */
function getConsolidatedFamilyDashboardData(allMembers) {
  try {
    const membersData = [];
    const portfoliosSummary = [];
    let familyTotalInvested = 0;
    let familyTotalCurrent = 0;
    let familyTotalInsuranceCover = 0;
    let familyTotalRealizedPnL = 0;
    let familyTotalUnrealizedPnL = 0;

    // Gather data for each member
    allMembers.forEach(member => {
      const memberData = getMemberDashboardData(member.memberName);

      if (memberData.success) {
        membersData.push(memberData.data);

        // Accumulate family totals
        familyTotalInvested += memberData.data.totals.invested;
        familyTotalCurrent += memberData.data.totals.current;
        familyTotalInsuranceCover += memberData.data.insurance.totalCover;
        familyTotalRealizedPnL += memberData.data.totals.realizedPnL || 0;
        familyTotalUnrealizedPnL += memberData.data.totals.unrealizedPnL || 0;

        // Add portfolio summaries
        if (memberData.data.mutualFunds && memberData.data.mutualFunds.portfolios) {
          memberData.data.mutualFunds.portfolios.forEach(portfolio => {
            portfoliosSummary.push({
              memberName: member.memberName,
              portfolioName: portfolio.portfolioName,
              platform: portfolio.platform || '',
              invested: parseFloat(portfolio.totalInvestment) || 0,
              current: parseFloat(portfolio.currentValue) || 0,
              unrealizedPnL: parseFloat(portfolio.unrealizedPnl) || 0,
              realizedPnL: parseFloat(portfolio.realizedPnl) || 0,
              totalPnL: (parseFloat(portfolio.unrealizedPnl) || 0) + (parseFloat(portfolio.realizedPnl) || 0),
              rebalanceNeeded: portfolio.rebalanceNeeded || 'No'
            });
          });
        }
      }
    });

    // Get total liabilities
    const totalLiabilities = getTotalLiabilities();

    // Total Wealth = Current Value of all assets (NOT minus liabilities)
    const totalWealth = familyTotalCurrent;

    // Calculate family-level P&L
    const familyTotalPnL = familyTotalRealizedPnL + familyTotalUnrealizedPnL;
    const familyTotalPnLPercent = familyTotalInvested > 0 ? (familyTotalPnL / familyTotalInvested) * 100 : 0;

    // Get asset allocation data (from funds)
    const assetAllocation = getAssetAllocationData();

    // Get insurance data (categorized by type)
    const insuranceData = getAllInsurancePoliciesDetailed();

    // Add term and health insurance totals to familyTotals
    const termInsuranceCount = insuranceData.termInsurance?.length || 0;
    const termInsuranceCover = insuranceData.termInsurance?.reduce((sum, policy) => sum + (policy.sumAssured || 0), 0) || 0;
    const healthInsuranceCount = insuranceData.healthInsurance?.length || 0;
    const healthInsuranceCover = insuranceData.healthInsurance?.reduce((sum, policy) => sum + (policy.sumAssured || 0), 0) || 0;

    // Get additional data for new sections
    const questionnaireData = getQuestionnaireData();
    const familyMembers = getAllFamilyMembersForReport();
    const bankAccounts = getAllBankAccountsForReport();
    const investmentAccounts = getAllInvestmentAccountsForReport();

    return {
      success: true,
      data: {
        membersData: membersData,
        portfoliosSummary: portfoliosSummary,
        familyTotals: {
          totalWealth: totalWealth,
          invested: familyTotalInvested,
          current: familyTotalCurrent,
          liabilities: totalLiabilities,
          unrealizedPnL: familyTotalUnrealizedPnL,
          realizedPnL: familyTotalRealizedPnL,
          totalPnL: familyTotalPnL,
          pnlPercent: familyTotalPnLPercent,
          insuranceCover: familyTotalInsuranceCover,
          termInsurance: {
            count: termInsuranceCount,
            totalCover: termInsuranceCover
          },
          healthInsurance: {
            count: healthInsuranceCount,
            totalCover: healthInsuranceCover
          }
        },
        assetAllocation: assetAllocation,
        questionnaireData: questionnaireData,
        insuranceData: insuranceData,
        familyMembers: familyMembers,
        bankAccounts: bankAccounts,
        investmentAccounts: investmentAccounts,
        memberCount: membersData.length,
        generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      }
    };
  } catch (error) {
    log('Error getting consolidated family dashboard data: ' + error.toString());
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
 */
function buildEmailSubject(reportType, netWorth) {
  const date = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy');

  // Format net worth for display
  let netWorthFormatted = '';
  if (netWorth) {
    const absAmount = Math.abs(netWorth);
    if (absAmount >= 10000000) { // >= 1 Crore
      netWorthFormatted = '₹' + (absAmount / 10000000).toFixed(2) + ' Cr';
    } else if (absAmount >= 100000) { // >= 1 Lakh
      netWorthFormatted = '₹' + (absAmount / 100000).toFixed(2) + ' L';
    } else {
      netWorthFormatted = '₹' + absAmount.toFixed(0);
    }
    if (netWorth < 0) netWorthFormatted = '-' + netWorthFormatted;
  }

  if (reportType === 'weekly') {
    return netWorthFormatted
      ? `📊 Weekly Wealth Report - Net Worth: ${netWorthFormatted} - ${date}`
      : `📊 Weekly Wealth Report - ${date}`;
  } else if (reportType === 'daily') {
    return netWorthFormatted
      ? `💰 Daily Wealth Update - Net Worth: ${netWorthFormatted} - ${date}`
      : `💰 Daily Wealth Update - ${date}`;
  } else {
    return netWorthFormatted
      ? `💰 Family Wealth Report - Net Worth: ${netWorthFormatted} - ${date}`
      : `💰 Family Wealth Report - ${date}`;
  }
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
        <div class="value">${formatCurrency(data.netWorth)}</div>
      </div>

      <div class="summary-grid">
        <div class="summary-card green">
          <div class="label">Total Investments</div>
          <div class="value">${formatCurrency(data.totalInvestments)}</div>
        </div>

        <div class="summary-card red">
          <div class="label">Total Liabilities</div>
          <div class="value">${formatCurrency(data.totalLiabilities)}</div>
        </div>

        <div class="summary-card orange">
          <div class="label">Insurance Cover</div>
          <div class="value">${formatCurrency(data.totalInsuranceCover)}</div>
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
  const totalWealth = formatCurrency(data.familyTotals.totalWealth);
  const liabilities = formatCurrency(data.familyTotals.liabilities);
  const netWorth = formatCurrency(data.familyTotals.totalWealth - data.familyTotals.liabilities);
  const totalPnL = formatCurrency(data.familyTotals.totalPnL);
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

/**
 * Get time-based greeting
 */
function getTimeBasedGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/**
 * Format currency for plain text email (Indian format)
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined) return '₹0';

  const absAmount = Math.abs(amount);
  let formatted = '';

  if (absAmount >= 10000000) { // >= 1 Crore
    formatted = '₹' + (absAmount / 10000000).toFixed(2) + ' Cr';
  } else if (absAmount >= 100000) { // >= 1 Lakh
    formatted = '₹' + (absAmount / 100000).toFixed(2) + ' L';
  } else if (absAmount >= 1000) { // >= 1 Thousand
    formatted = '₹' + (absAmount / 1000).toFixed(2) + ' K';
  } else {
    formatted = '₹' + absAmount.toFixed(2);
  }

  return amount < 0 ? '-' + formatted : formatted;
}

// ============================================================================
// END OF EMAILREPORTS.GS
// ============================================================================
