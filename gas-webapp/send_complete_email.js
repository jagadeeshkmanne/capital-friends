/**
 * Send Complete Family Wealth Report Email
 * - Dynamically reads data from Google Sheets
 * - All sections included with real portfolio data
 * - Table-based responsive layout for email compatibility
 */

/**
 * Get setting value from Settings sheet
 */
function getSetting(settingName) {
  try {
    const sheet = getSheet(CONFIG.settingsSheet);

    if (!sheet) {
      Logger.log('Settings sheet not found');
      return null;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      Logger.log('No settings found');
      return null;
    }

    // Get all settings data (columns A-B)
    const data = sheet.getRange(3, 1, lastRow - 2, 2).getValues();

    // Find the setting
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === settingName) {
        return data[i][1];
      }
    }

    return null;

  } catch (error) {
    Logger.log('Error getting setting ' + settingName + ': ' + error.toString());
    return null;
  }
}

/**
 * Update setting value in Settings sheet
 */
function updateSetting(settingName, value) {
  try {
    const sheet = getSheet(CONFIG.settingsSheet);

    if (!sheet) {
      Logger.log('Settings sheet not found');
      return false;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      Logger.log('No settings found');
      return false;
    }

    // Get all settings data (columns A-B)
    const data = sheet.getRange(3, 1, lastRow - 2, 2).getValues();

    // Find and update the setting
    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === settingName) {
        sheet.getRange(i + 3, 2).setValue(value);
        return true;
      }
    }

    // Setting not found, add new row
    sheet.appendRow([settingName, value, '']);
    return true;

  } catch (error) {
    Logger.log('Error updating setting ' + settingName + ': ' + error.toString());
    return false;
  }
}

/**
 * Get the 'from' email address for sending emails
 * Priority order:
 * 1. Sheet owner's email (Google account that owns the spreadsheet)
 * 2. Self account email (Relationship = "Self" in FamilyMembers sheet)
 * 3. First active family member email
 * @returns {string|null} - Email address or null if none found
 */
function getFromEmailAddress() {
  try {
    // First, try to get sheet owner's email
    try {
      const ownerEmail = getSpreadsheet().getOwner().getEmail();
      if (ownerEmail) {
        Logger.log('From email address: ' + ownerEmail + ' (Sheet owner)');
        return ownerEmail;
      }
    } catch (ownerError) {
      Logger.log('Could not get sheet owner email: ' + ownerError.toString());
    }

    // Second, try to get Self account email from FamilyMembers sheet
    const sheet = getSheet(CONFIG.familyMembersSheet);
    let selfEmail = null;
    let fallbackEmail = null;

    if (sheet && sheet.getLastRow() > 2) {
      // Get all data (columns A-L)
      // Column B = Member Name, Column C = Relationship, Column F = Email, Column I = Status
      const data = sheet.getRange(3, 1, sheet.getLastRow() - 2, 12).getValues();

      data.forEach(row => {
        const relationship = row[2]; // Column C: Relationship
        const email = row[5]; // Column F: Email
        const status = row[8]; // Column I: Status

        // Only consider active members with email
        if (email && status && status.toString().toLowerCase() === 'active') {
          const emailStr = email.toString().trim();

          // Check if this is the "Self" account
          if (relationship && relationship.toString().toLowerCase() === 'self') {
            selfEmail = emailStr;
          }

          // Keep first active email as fallback
          if (!fallbackEmail) {
            fallbackEmail = emailStr;
          }
        }
      });
    }

    // If Self email found, use it
    if (selfEmail) {
      Logger.log('From email address: ' + selfEmail + ' (Self account)');
      return selfEmail;
    }

    // Fall back to first active family member email
    if (fallbackEmail) {
      Logger.log('From email address: ' + fallbackEmail + ' (First active member)');
      return fallbackEmail;
    }

    Logger.log('No valid from email address found');
    return null;

  } catch (error) {
    Logger.log('Error getting from email address: ' + error.toString());
    return null;
  }
}

/**
 * Get family members who should receive email reports
 * Returns array of email addresses for members with "Include in Email Reports" = "Yes"
 */
function getEmailRecipients() {
  try {
    const sheet = getSheet(CONFIG.familyMembersSheet);

    if (!sheet) {
      Logger.log('FamilyMembers sheet not found');
      return [];
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      Logger.log('No family members found');
      return [];
    }

    // Get all data (columns A-L)
    // Column F = Email, Column H = Include in Email Reports, Column I = Status
    const data = sheet.getRange(3, 1, lastRow - 2, 12).getValues();

    const recipients = [];

    data.forEach(row => {
      const email = row[5]; // Column F: Email
      const includeInReports = row[7]; // Column H: Include in Email Reports
      const status = row[8]; // Column I: Status

      // Only include if:
      // - Email is provided
      // - Include in Email Reports = "Yes"
      // - Status = "Active"
      if (email &&
          includeInReports && includeInReports.toString().toLowerCase() === 'yes' &&
          status && status.toString().toLowerCase() === 'active') {
        recipients.push(email.toString().trim());
      }
    });

    return recipients;

  } catch (error) {
    Logger.log('Error getting email recipients: ' + error.toString());
    return [];
  }
}

/**
 * Send email report to specified recipients
 * If no recipients provided, uses family members with "Include in Email Reports" = Yes
 */
function sendCompleteWealthReportEmail(customRecipients) {
  const startTime = new Date();
  Logger.log('=== EMAIL GENERATION STARTED at ' + startTime.toLocaleTimeString('en-IN') + ' ===');

  try {
    // Get recipients
    let recipients = customRecipients;

    if (!recipients || recipients.length === 0) {
      recipients = getEmailRecipients();
    }

    // If still no recipients, try to get sheet owner's email
    if (!recipients || recipients.length === 0) {
      try {
        const ownerEmail = getSpreadsheet().getOwner().getEmail();
        if (ownerEmail) {
          Logger.log('No configured recipients, using sheet owner email: ' + ownerEmail);
          recipients = [ownerEmail];
        }
      } catch (ownerError) {
        Logger.log('Could not get sheet owner email: ' + ownerError.toString());
      }
    }

    if (!recipients || recipients.length === 0) {
      const errorMsg = 'No email recipients found. Please ensure family members have email addresses, "Include in Email Reports" is set to "Yes", and member status is "Active", or the spreadsheet has a valid owner email.';
      Logger.log('ERROR: ' + errorMsg);
      return { success: false, error: 'No recipients' };
    }

    // Clear portfolio holdings cache at start of email generation
    Logger.log('Step 1: Clearing portfolio cache...');
    clearPortfolioHoldingsCache();

    Logger.log('Step 2: Generating HTML content...');
    const htmlContent = getCompleteWealthReportHTML();
    Logger.log('Step 3: HTML content generated successfully (length: ' + htmlContent.length + ' chars)');

    Logger.log('Step 4: Getting from email address...');
    const fromEmail = getFromEmailAddress();

    if (!fromEmail) {
      const errorMsg = 'No valid from email address found. Please ensure at least one family member has an email address, set Relationship = "Self" for the primary account holder, or ensure spreadsheet owner has email configured.';
      Logger.log('ERROR: ' + errorMsg);
      return { success: false, error: 'No from email address' };
    }

    Logger.log('Step 5: Sending email to ' + recipients.length + ' recipient(s)...');

    // Get email frequency from settings for subject line
    const emailFrequency = getSetting('EmailFrequency') || 'Daily';
    const subject = `Capital Friends - ${emailFrequency} Financial Statement`;

    // Send email to all recipients
    const recipientList = recipients.join(',');

    GmailApp.sendEmail(
      recipientList,
      subject,
      'This email contains your complete wealth report. Please enable HTML viewing.',
      {
        htmlBody: htmlContent,
        name: 'Capital Friends - Wealth Management',
        replyTo: fromEmail
      }
    );

    const endTime = new Date();
    const duration = (endTime - startTime) / 1000;
    Logger.log('SUCCESS! Complete report sent to: ' + recipientList);
    Logger.log('=== EMAIL GENERATION COMPLETED in ' + duration + ' seconds ===');
    Logger.log('=== FUNCTION ENDING NOW ===');

    return { success: true, recipients: recipients, duration: duration };

  } catch (error) {
    Logger.log('ERROR sending email: ' + error.toString());
    Logger.log('Stack trace: ' + error.stack);
    Logger.log('=== FUNCTION ENDING WITH ERROR ===');

    return { success: false, error: error.message };
  } finally {
    Logger.log('=== FUNCTION sendCompleteWealthReportEmail() FINISHED ===');
  }
}

/**
 * Get email report data from Google Sheets
 * Returns all data needed for the email report
 */
function getEmailReportData() {
  try {
    // Get family wealth data
    const familyData = getFamilyWealthData();

    if (!familyData.success) {
      Logger.log('getFamilyWealthData() failed: ' + (familyData.error || 'Unknown error'));
      // Use dummy data if sheet data fails
      return getDummyReportData();
    }

    const data = familyData.data;

    // Calculate overall asset allocation
    const assetAllocation = calculateFamilyAssetAllocation(data);

    // Calculate total life insurance cover
    const totalLifeCover = calculateTotalLifeCover();

    // Get questionnaire data
    const questionnaireData = getQuestionnaireData();

    return {
      totalWealth: data.totalAssets,
      liabilities: data.totalLiabilities,
      netWorth: data.totalAssets - data.totalLiabilities,
      assetAllocation: assetAllocation,
      totalLifeCover: totalLifeCover,
      questionnaire: questionnaireData,
      familyMembers: data.members
    };

  } catch (error) {
    Logger.log('Error getting email report data: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    return getDummyReportData();
  }
}

/**
 * Fallback logError function if Utilities.gs doesn't have it
 */
function logError(functionName, error) {
  Logger.log(`ERROR in ${functionName}: ${error.toString()}`);
  if (error.stack) {
    Logger.log(`Stack trace: ${error.stack}`);
  }
}

/**
 * Calculate family-level asset allocation from member data
 * Calculates from actual holdings:
 * - Mutual funds: Read from AssetAllocations sheet
 * - Stocks: 100% equity
 * - Other investments: Based on investment type/category
 */
function calculateFamilyAssetAllocation(familyData) {
  try {
    const assetTotals = { equity: 0, debt: 0, gold: 0, commodities: 0, realEstate: 0, crypto: 0, cash: 0, other: 0 };

    // Get AssetAllocations sheet for mutual fund allocations
    const spreadsheet = getSpreadsheet();
    const assetAllocSheet = spreadsheet.getSheetByName(CONFIG.assetAllocationsSheet);
    let fundAllocations = {};

    if (assetAllocSheet) {
      const allocData = assetAllocSheet.getDataRange().getValues();
      // Row 1 = Developer credit, Row 2 = Headers, Row 3+ = Data
      // Columns: A=Fund Code, B=Fund Name, C=Asset Allocation JSON
      for (let i = 2; i < allocData.length; i++) {
        const fundCode = allocData[i][0] ? allocData[i][0].toString() : '';
        const assetJSON = allocData[i][2];
        if (fundCode && assetJSON) {
          try {
            fundAllocations[fundCode] = JSON.parse(assetJSON);
          } catch (e) {
            Logger.log('Error parsing allocation for fund ' + fundCode);
          }
        }
      }
    }

    // Process each family member
    familyData.members.forEach(member => {
      // 1. MUTUAL FUNDS - Read allocation from sheet
      if (member.portfolios && member.portfolios.length > 0) {
        member.portfolios.forEach(portfolio => {
          const holdings = getPortfolioHoldings(portfolio.portfolioId, portfolio.portfolioName);

          holdings.forEach(holding => {
            const allocation = fundAllocations[holding.schemeCode];
            if (allocation) {
              // Apply fund allocation weighted by holding value
              assetTotals.equity += (allocation.Equity || 0) * holding.currentValue / 100;
              assetTotals.debt += (allocation.Debt || 0) * holding.currentValue / 100;
              assetTotals.gold += (allocation.Gold || 0) * holding.currentValue / 100;
              assetTotals.commodities += (allocation.Commodities || 0) * holding.currentValue / 100;
              assetTotals.cash += (allocation.Cash || 0) * holding.currentValue / 100;
            } else {
              // If no allocation data, assume it's an equity fund
              assetTotals.equity += holding.currentValue;
            }
          });
        });
      }

      // 2. STOCKS - 100% equity
      const allStockPortfolios = getAllStockPortfolios();
      const memberStockPortfolios = allStockPortfolios.filter(
        sp => sp.ownerId === member.memberId && sp.status === 'Active'
      );

      memberStockPortfolios.forEach(portfolio => {
        assetTotals.equity += portfolio.currentValue || 0;
      });

      // 3. OTHER INVESTMENTS - Based on type/category
      const allInvestments = getAllInvestments();
      const memberInvestments = allInvestments.filter(
        inv => inv.familyMemberId === member.memberId && inv.status === 'Active'
      );

      memberInvestments.forEach(inv => {
        const value = inv.currentValue || 0;
        const type = (inv.investmentType || '').toLowerCase();
        const category = (inv.investmentCategory || '').toLowerCase();

        // Map investment types to asset classes
        if (type.includes('real estate') || category.includes('real estate') || category.includes('property')) {
          assetTotals.realEstate += value;
        } else if (type.includes('gold') || category.includes('gold') || type.includes('commodity') || category.includes('commodity')) {
          assetTotals.gold += value;
        } else if (type.includes('crypto') || category.includes('crypto') || category.includes('bitcoin')) {
          assetTotals.crypto += value;
        } else if (type.includes('fd') || type.includes('fixed deposit') || category.includes('debt') || type.includes('bond')) {
          assetTotals.debt += value;
        } else if (type.includes('ppf') || type.includes('nps') || type.includes('epf')) {
          assetTotals.debt += value;
        } else if (type.includes('cash') || type.includes('savings')) {
          assetTotals.cash += value;
        } else {
          // Default unknown types to "other"
          assetTotals.other += value;
        }
      });
    });

    // Calculate total
    const totalAssets = Object.values(assetTotals).reduce((sum, val) => sum + val, 0);

    // If no assets found, return zero allocation
    if (totalAssets === 0) {
      return {
        equity: { percentage: 0, value: 0, label: 'Equity' },
        debt: { percentage: 0, value: 0, label: 'Debt' },
        commodities: { percentage: 0, value: 0, label: 'Commodities' },
        realEstate: { percentage: 0, value: 0, label: 'Real Estate' },
        crypto: { percentage: 0, value: 0, label: 'Crypto' }
      };
    }

    // Calculate percentages for main categories
    const equityPct = (assetTotals.equity / totalAssets) * 100;
    const debtPct = (assetTotals.debt / totalAssets) * 100;
    const commoditiesPct = ((assetTotals.gold + assetTotals.commodities) / totalAssets) * 100;
    const realEstatePct = (assetTotals.realEstate / totalAssets) * 100;

    // Calculate Others as remainder to ensure total = 100%
    const othersPct = 100 - (equityPct + debtPct + commoditiesPct + realEstatePct);
    const othersValue = assetTotals.crypto + assetTotals.cash + assetTotals.other;

    return {
      equity: {
        percentage: equityPct,
        value: assetTotals.equity,
        label: 'Equity'
      },
      debt: {
        percentage: debtPct,
        value: assetTotals.debt,
        label: 'Debt'
      },
      commodities: {
        percentage: commoditiesPct,
        value: assetTotals.gold + assetTotals.commodities,
        label: 'Commodities'
      },
      realEstate: {
        percentage: realEstatePct,
        value: assetTotals.realEstate,
        label: 'Real Estate'
      },
      crypto: {
        percentage: othersPct,
        value: othersValue,
        label: 'Others'
      }
    };

  } catch (error) {
    Logger.log('Error calculating family asset allocation: ' + error.toString());
    // Return zero allocation on error
    return {
      equity: { percentage: 0, value: 0, label: 'Equity' },
      debt: { percentage: 0, value: 0, label: 'Debt' },
      commodities: { percentage: 0, value: 0, label: 'Commodities' },
      realEstate: { percentage: 0, value: 0, label: 'Real Estate' },
      crypto: { percentage: 0, value: 0, label: 'Others' }
    };
  }
}

/**
 * Calculate total life insurance cover from term insurance policies
 * Returns the sum of all active term insurance policies
 */
function calculateTotalLifeCover() {
  try {
    const sheet = getSheet(CONFIG.insuranceSheet);

    if (!sheet) {
      Logger.log('Insurance sheet not found');
      return 0;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 2) {
      // No data rows (only header)
      return 0;
    }

    // Get all data (13 columns: A-M after adding Member ID column)
    // A=Policy ID, B=Policy Type, H=Sum Assured (moved from G), J=Status (moved from I)
    const data = sheet.getRange(3, 1, lastRow - 2, 13).getValues();

    let totalLifeCover = 0;

    data.forEach(row => {
      const policyType = row[1]; // Column B: Policy Type
      const sumAssured = row[7]; // Column H: Sum Assured (updated from G after adding Member ID)
      const status = row[9];     // Column J: Policy Status (updated from I after adding Member ID)

      // Only count Term insurance policies that are Active
      if (policyType && policyType.toString().toLowerCase().includes('term') &&
          status && status.toString().toLowerCase() === 'active' &&
          sumAssured && !isNaN(sumAssured)) {
        totalLifeCover += Number(sumAssured);
      }
    });

    return totalLifeCover;

  } catch (error) {
    Logger.log('Error calculating total life cover: ' + error.toString());
    return 0;
  }
}

/**
 * Get Questionnaire data from Questionnaire sheet
 * Returns object with Yes/No values for each question
 */
function getQuestionnaireData() {
  try {
    const sheet = getSheet(CONFIG.questionnaireSheet);

    if (!sheet) {
      Logger.log('Questionnaire sheet not found');
      return null;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 3) {
      Logger.log('No questionnaire data found');
      return null;
    }

    // Get last row (columns A-J: Date, Q1-Q7, Score, Total)
    const data = sheet.getRange(lastRow, 1, 1, 10).getValues()[0];

    return {
      date: data[0] ? data[0].toString() : '',
      healthInsurance: (data[1] || '').toString().trim(),       // Column B
      termInsurance: (data[2] || '').toString().trim(),         // Column C
      emergencyFund: (data[3] || '').toString().trim(),         // Column D
      familyAwareness: (data[4] || '').toString().trim(),       // Column E
      will: (data[5] || '').toString().trim(),                  // Column F
      nominees: (data[6] || '').toString().trim(),              // Column G
      goals: (data[7] || '').toString().trim(),                 // Column H
      score: parseInt(data[8]) || 0,                            // Column I
      total: parseInt(data[9]) || 7                             // Column J
    };

  } catch (error) {
    Logger.log('Error getting questionnaire data: ' + error.toString());
    return null;
  }
}

/**
 * Build Action Items section dynamically based on Questionnaire data
 * Only shows action items for questions answered "No"
 */
function buildActionItemsHTML(questionnaireData) {
  // If no questionnaire data, show all action items
  if (!questionnaireData) {
    Logger.log('No questionnaire data - showing all action items');
    return buildAllActionItemsHTML(0, 7);
  }

  let actionItemsHTML = '';
  let itemCount = 0;

  // Check each question and add action item if answer is not "Yes"
  const isNo = (value) => value.toLowerCase() !== 'yes';

  // 1. Health Insurance
  if (isNo(questionnaireData.healthInsurance)) {
    itemCount++;
    actionItemsHTML += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fff7ed; border-left: 4px solid #f97316; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #7c2d12; margin-bottom: 6px;">Inadequate Health Insurance</div>
                    <div style="font-size: 12px; color: #9a3412; margin-bottom: 8px; line-height: 1.5;">Health insurance coverage is missing or insufficient for medical emergencies.</div>
                    <div style="font-size: 11px; color: #7c2d12; background: #fed7aa; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Get minimum Rs.5L coverage per family member (Rs.10L+ recommended)
                    </div>
                  </td>
                </tr>
              </table>`;
  }

  // 3. Term Insurance
  if (isNo(questionnaireData.termInsurance)) {
    itemCount++;
    actionItemsHTML += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #7f1d1d; margin-bottom: 6px;">Missing Term Life Insurance</div>
                    <div style="font-size: 12px; color: #991b1b; margin-bottom: 8px; line-height: 1.5;">You don't have term life insurance to protect your family's financial future.</div>
                    <div style="font-size: 11px; color: #7f1d1d; background: #fecaca; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Get coverage worth 10-15x of your annual income (Recommended: Rs.1-2 Cr minimum)
                    </div>
                  </td>
                </tr>
              </table>`;
  }

  // 3. Emergency Fund
  if (isNo(questionnaireData.emergencyFund)) {
    itemCount++;
    actionItemsHTML += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #78350f; margin-bottom: 6px;">Emergency Fund Missing</div>
                    <div style="font-size: 12px; color: #92400e; margin-bottom: 8px; line-height: 1.5;">You don't have 6 months of expenses saved for emergencies. One job loss or medical bill can force you to sell investments at a loss.</div>
                    <div style="font-size: 11px; color: #78350f; background: #fde68a; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Keep 6 months of household expenses in a savings account or liquid fund.
                    </div>
                  </td>
                </tr>
              </table>`;
  }

  // 4. Family Awareness
  if (isNo(questionnaireData.familyAwareness)) {
    itemCount++;
    actionItemsHTML += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin-bottom: 6px;">Family Doesn't Know Where Assets Are</div>
                    <div style="font-size: 12px; color: #1e40af; margin-bottom: 8px; line-height: 1.5;">If something happens to you, your family will struggle to find accounts, insurance, and investments. Capital Friends email reports solve this automatically.</div>
                    <div style="font-size: 11px; color: #1e3a8a; background: #bfdbfe; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Add all accounts in Capital Friends and set up automated email reports for your family.
                    </div>
                  </td>
                </tr>
              </table>`;
  }

  // 5. Will
  if (isNo(questionnaireData.will)) {
    itemCount++;
    actionItemsHTML += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fefce8; border-left: 4px solid #eab308; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #713f12; margin-bottom: 6px;">Registered Will Not Created</div>
                    <div style="font-size: 12px; color: #854d0e; margin-bottom: 8px; line-height: 1.5;">Without a registered Will, your family may need 1-3 years in court before they can access any account or property.</div>
                    <div style="font-size: 11px; color: #713f12; background: #fef08a; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Create a registered Will. Costs Rs.5,000-10,000 one time. Consult a lawyer this month.
                    </div>
                  </td>
                </tr>
              </table>`;
  }

  // 6. Nominees
  if (isNo(questionnaireData.nominees)) {
    itemCount++;
    actionItemsHTML += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fefce8; border-left: 4px solid #eab308; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #713f12; margin-bottom: 6px;">Nominees Not Updated</div>
                    <div style="font-size: 12px; color: #854d0e; margin-bottom: 8px; line-height: 1.5;">Old nominees (parents before marriage, spouse before kids) may still be on your accounts. Money goes to whoever is listed there.</div>
                    <div style="font-size: 11px; color: #713f12; background: #fef08a; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Update nominees on all bank accounts, investments, insurance, PF, and PPF. Takes 5 minutes each.
                    </div>
                  </td>
                </tr>
              </table>`;
  }

  // 7. Goals
  if (isNo(questionnaireData.goals)) {
    itemCount++;
    actionItemsHTML += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #14532d; margin-bottom: 6px;">No Clear Financial Goals</div>
                    <div style="font-size: 12px; color: #166534; margin-bottom: 8px; line-height: 1.5;">Without a goal and a plan, you don't know how much to invest each month. You could be investing too little and not realize it until it's too late.</div>
                    <div style="font-size: 11px; color: #14532d; background: #bbf7d0; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Use the Goal Planner in Capital Friends — enter what you want, when you need it, get the exact SIP amount.
                    </div>
                  </td>
                </tr>
              </table>`;
  }

  // If all items are "Yes", show success message
  if (itemCount === 0) {
    actionItemsHTML = `
              <div style="background: #f0fdf4; border: 2px solid #bbf7d0; border-radius: 8px; padding: 20px; text-align: center;">
                <div style="font-size: 16px; font-weight: 700; color: #15803d; margin-bottom: 8px;">🎉 Excellent Financial Health!</div>
                <div style="font-size: 13px; color: #166534; line-height: 1.6;">
                  You have completed all recommended financial planning steps. Your family's financial security is well protected. Keep reviewing and updating your plans regularly.
                </div>
              </div>`;
  }

  // Build footer
  const footerHTML = `
              <div style="border-top: 1px solid #d1d5db; padding-top: 12px;">
                <div style="font-size: 12px; color: #6b7280;">
                  <strong>Financial Health Score: ${questionnaireData.score}/${questionnaireData.total}</strong> - ${itemCount > 0 ? 'Complete these actions to improve your score' : 'Perfect score! 🎯'}
                </div>
              </div>`;

  return actionItemsHTML + footerHTML;
}

/**
 * Build all action items (fallback when no questionnaire data)
 */
function buildAllActionItemsHTML(score, total) {
  return `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fff7ed; border-left: 4px solid #f97316; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #7c2d12; margin-bottom: 6px;">Health Insurance Missing or Insufficient</div>
                    <div style="font-size: 12px; color: #9a3412; margin-bottom: 8px; line-height: 1.5;">One big hospital bill can wipe out years of savings. Health insurance protects everything you have built.</div>
                    <div style="font-size: 11px; color: #7c2d12; background: #fed7aa; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Get good health insurance for all family members. Get it young — it gets expensive later.
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #7f1d1d; margin-bottom: 6px;">Term Life Insurance Missing</div>
                    <div style="font-size: 12px; color: #991b1b; margin-bottom: 8px; line-height: 1.5;">If something happens to you, your family needs financial support. Term insurance gives them that security for a very small monthly cost.</div>
                    <div style="font-size: 11px; color: #7f1d1d; background: #fecaca; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Get coverage worth 10-15x of your annual income (Rs.1-2 Cr minimum recommended).
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #78350f; margin-bottom: 6px;">Emergency Fund Missing</div>
                    <div style="font-size: 12px; color: #92400e; margin-bottom: 8px; line-height: 1.5;">Without an emergency fund, one job loss or medical bill can force you to sell investments at a loss.</div>
                    <div style="font-size: 11px; color: #78350f; background: #fde68a; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Keep 6 months of household expenses in a savings account or liquid fund.
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #1e3a8a; margin-bottom: 6px;">Family Doesn't Know Where Assets Are</div>
                    <div style="font-size: 12px; color: #1e40af; margin-bottom: 8px; line-height: 1.5;">If something happens to you, your family will struggle to find accounts, insurance, and investments. Capital Friends email reports solve this automatically.</div>
                    <div style="font-size: 11px; color: #1e3a8a; background: #bfdbfe; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Add all accounts in Capital Friends and set up automated email reports for your family.
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fefce8; border-left: 4px solid #eab308; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #713f12; margin-bottom: 6px;">Registered Will Not Created</div>
                    <div style="font-size: 12px; color: #854d0e; margin-bottom: 8px; line-height: 1.5;">Without a registered Will, your family may need 1-3 years in court before they can access any account or property.</div>
                    <div style="font-size: 11px; color: #713f12; background: #fef08a; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Create a registered Will. Costs Rs.5,000-10,000 one time. Consult a lawyer this month.
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 10px;">
                <tr>
                  <td style="background: #fefce8; border-left: 4px solid #eab308; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #713f12; margin-bottom: 6px;">Nominees Not Updated</div>
                    <div style="font-size: 12px; color: #854d0e; margin-bottom: 8px; line-height: 1.5;">Old nominees may still be on your accounts. Money goes to whoever is listed — check and update now.</div>
                    <div style="font-size: 11px; color: #713f12; background: #fef08a; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Update nominees on all bank accounts, investments, insurance, PF, and PPF. Takes 5 minutes each.
                    </div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="background: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 6px; padding: 14px;">
                    <div style="font-size: 14px; font-weight: 700; color: #14532d; margin-bottom: 6px;">No Clear Financial Goals</div>
                    <div style="font-size: 12px; color: #166534; margin-bottom: 8px; line-height: 1.5;">Without a goal, you don't know how much to invest each month. You could be investing too little without realizing it.</div>
                    <div style="font-size: 11px; color: #14532d; background: #bbf7d0; display: inline-block; padding: 6px 10px; border-radius: 4px;">
                      <strong>Action:</strong> Use the Goal Planner in Capital Friends — enter what you want, when you need it, get the exact SIP amount.
                    </div>
                  </td>
                </tr>
              </table>

              <div style="border-top: 1px solid #d1d5db; padding-top: 12px;">
                <div style="font-size: 12px; color: #6b7280;">
                  <strong>Financial Health Score: ${score}/${total}</strong> - Complete these actions to improve your score
                </div>
              </div>`;
}

/**
 * Get dummy data for testing
 * IMPORTANT: This is only used if getFamilyWealthData() fails
 */
function getDummyReportData() {
  return {
    totalWealth: 15300000, // Rs. 1.53 Cr
    liabilities: 680000,    // Rs. 6.80 L
    netWorth: 14620000,     // Rs. 1.46 Cr
    assetAllocation: {
      equity: { percentage: 65.2, value: 10000000, label: 'Equity' },
      debt: { percentage: 22.3, value: 3400000, label: 'Debt' },
      commodities: { percentage: 8.5, value: 1300000, label: 'Commodities' },
      realEstate: { percentage: 3.2, value: 490000, label: 'Real Estate' },
      crypto: { percentage: 0.8, value: 122000, label: 'Crypto' }
    },
    totalLifeCover: 10000000, // Rs. 1.00 Cr (for testing with life cover)
    // totalLifeCover: 0,      // Uncomment to test NO life cover warning
    familyMembers: [
      {
        memberId: 'FM-001',
        memberName: 'John Doe (DUMMY DATA)',
        totalAssets: 10000000,
        netWorth: 9500000,
        portfolios: [
          {
            portfolioId: 'PF-001',
            portfolioName: 'Test Portfolio 1',
            investmentAccount: 'IA-001',
            platformBroker: 'Zerodha',
            currentValue: 5000000,
            totalInvested: 4000000,
            totalPL: 1000000,
            percentPL: 25.0
          }
        ]
      }
    ]
  };
}

/**
 * Format currency in Indian format for EMAIL ONLY
 * This function is specifically for email reports to avoid conflicts with other formatCurrency functions
 */
function formatCurrencyForEmail(amount) {
  // Ensure amount is a number and round to 2 decimal places to avoid floating point issues
  const numAmount = Number(amount);
  if (isNaN(numAmount)) return 'Rs.0';

  const roundedAmount = Math.round(numAmount * 100) / 100;

  if (roundedAmount >= 10000000) {
    return 'Rs.' + (roundedAmount / 10000000).toFixed(2) + ' Cr';
  } else if (roundedAmount >= 100000) {
    return 'Rs.' + (roundedAmount / 100000).toFixed(2) + ' L';
  } else if (roundedAmount >= 1000) {
    return 'Rs.' + (roundedAmount / 1000).toFixed(2) + 'K';
  } else {
    return 'Rs.' + roundedAmount.toFixed(2);
  }
}

/**
 * Minify HTML by removing unnecessary whitespace while preserving content
 * This helps keep email size under Gmail's 102KB clipping threshold
 */
function minifyHTML(html) {
  return html
    .replace(/\n\s+/g, '\n')
    .replace(/\n+/g, '\n')
    .replace(/>\s+</g, '><')
    .trim();
}

function getCompleteWealthReportHTML() {
  // Get dynamic data from sheets (or dummy data)
  const reportData = getEmailReportData();

  const currentDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Format values for display
  const totalWealth = formatCurrencyForEmail(reportData.totalWealth);
  const liabilities = formatCurrencyForEmail(reportData.liabilities);
  const netWorth = formatCurrencyForEmail(reportData.netWorth);

  const assetAlloc = reportData.assetAllocation;

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #fafafa;">

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fafafa;">
    <tr>
      <td style="padding: 24px;">

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: linear-gradient(90deg, #EEF2FF 0%, #F3E8FF 50%, #FCE7F3 100%); border-left: 4px solid #6366f1; border-top: 1px solid #d1d5db; border-right: 1px solid #d1d5db; border-bottom: 1px solid #d1d5db; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align: middle; width: 220px; padding-right: 15px;">
                    <img src="https://raw.githubusercontent.com/jagadeeshkmanne/capital-friends/refs/heads/main/logo-main.png" alt="Capital Friends Logo" style="display: block; border: 0; max-width: 200px; height: auto; max-height: 100px;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'font-size: 60px; line-height: 80px;\\'>💰</div>';">
                  </td>
                  <td align="right" style="vertical-align: top; padding-left: 15px;">
                    <div style="font-size: 11px; color: #4b5563; margin-bottom: 8px;">
                      This report is auto-generated from your Google Sheets. Keep your financial data secure.
                    </div>
                    <div style="font-size: 13px; color: #374151; font-weight: 600; margin-bottom: 10px;">
                      Made with ❤️ in India by <strong>Jagadeesh Manne</strong> · Donate via UPI: <strong>jagadeeshmanne.hdfc@kphdfc</strong>
                    </div>
                    <div>
                      <a href="${getSpreadsheet().getUrl()}" style="display: inline-block; padding: 8px 16px; background: #10b981; color: white; text-decoration: none; font-size: 12px; font-weight: 600; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">&#128202; Open Google Sheet</a>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid #818cf8; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px;">
                <tr>
                  <td style="font-size: 18px; font-weight: 700; color: #111827;">
                    Family Wealth Dashboard
                  </td>
                  <td align="right" style="font-size: 12px; color: #6b7280; vertical-align: bottom;">
                    Generated on: ${currentDate}
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr style="height: 100%;">
                  <td style="width: 48%; vertical-align: top; padding-right: 12px; height: 100%;">

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="height: 100%;">
                      <tr>
                        <td style="vertical-align: top;">

                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 2px solid #e5e7eb; border-radius: 12px; background: white; margin-bottom: 20px;">
                            <tr>
                              <td style="padding: 24px;">

                                <div style="font-size: 13px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">Net Worth Breakdown</div>

                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                  <tr>
                                    <td style="width: 50%; vertical-align: middle; padding-right: 14px;">

                                      <div style="margin-bottom: 18px;">
                                        <div style="font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Total Wealth</div>
                                        <div style="font-size: 22px; font-weight: 700; color: #10b981; line-height: 1.2;">${totalWealth}</div>
                                        <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">All assets combined</div>
                                      </div>

                                      <div>
                                        <div style="font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Liabilities</div>
                                        <div style="font-size: 22px; font-weight: 700; color: #ef4444; line-height: 1.2;">${liabilities}</div>
                                        <div style="font-size: 10px; color: #6b7280; margin-top: 4px;">Outstanding debt</div>
                                      </div>

                                    </td>

                                    <td style="width: 50%; vertical-align: middle; padding-left: 14px; border-left: 2px solid #3b82f6; text-align: center;">
                                      <div style="font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.9px; margin-bottom: 10px;">Your Net Worth</div>
                                      <div style="font-size: 36px; font-weight: 800; color: #3b82f6; line-height: 1; white-space: nowrap;">${netWorth}</div>
                                      <div style="font-size: 10px; color: #6b7280; margin-top: 10px;">Wealth minus liabilities</div>
                                    </td>
                                  </tr>
                                </table>

                              </td>
                            </tr>
                          </table>

                          ${(reportData.questionnaire && reportData.questionnaire.termInsurance.toLowerCase() === 'yes') ? `
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 2px solid #e5e7eb; border-radius: 12px; background: white;">
                            <tr>
                              <td style="padding: 20px; text-align: center;">
                                <div style="font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.9px; margin-bottom: 8px;">Total Life Cover</div>
                                <div style="font-size: 30px; font-weight: 800; color: #8b5cf6; line-height: 1; white-space: nowrap;">${formatCurrencyForEmail(reportData.totalLifeCover)}</div>
                                <div style="font-size: 10px; color: #059669; margin-top: 8px; font-weight: 600;">✓ Your family is protected</div>
                              </td>
                            </tr>
                          </table>
                          ` : `
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 2px solid #dc2626; border-radius: 12px; background: #fef2f2;">
                            <tr>
                              <td style="padding: 16px; text-align: center;">
                                <div style="font-size: 14px; color: #dc2626; font-weight: 800; margin-bottom: 6px;">⚠️ CRITICAL WARNING</div>
                                <div style="font-size: 11px; color: #991b1b; line-height: 1.4; font-weight: 600;">Your investments are at risk!</div>
                                <div style="font-size: 10px; color: #7f1d1d; margin-top: 6px; line-height: 1.3;">You have NO life insurance cover. Your family's financial security is unprotected.</div>
                                <div style="margin-top: 10px; padding: 7px 14px; background: #dc2626; color: white; font-size: 10px; font-weight: 700; border-radius: 6px; display: inline-block;">GET TERM INSURANCE NOW</div>
                              </td>
                            </tr>
                          </table>
                          `}

                        </td>
                      </tr>
                    </table>

                  </td>

                  <td style="width: 48%; vertical-align: top; padding-left: 12px; height: 100%;">

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 2px solid #e5e7eb; border-radius: 12px; background: white; height: 100%;">
                      <tr>
                        <td style="padding: 24px;">

                          <div style="font-size: 14px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb;">Asset Allocation</div>

                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">

                            <tr>
                              <td style="padding: 12px 0;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                  <tr>
                                    <td style="padding-left: 0px; vertical-align: middle; width: 80px;">
                                      <div style="font-size: 11px; color: #6b7280; font-weight: 600;">Equity</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle; width: 60px; padding-right: 10px;">
                                      <div style="font-size: 13px; font-weight: 700; color: #1f2937;">${assetAlloc.equity.percentage.toFixed(1)}%</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle;">
                                      <div style="font-size: 12px; color: #6b7280;">${formatCurrencyForEmail(assetAlloc.equity.value)}</div>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td colspan="3" style="padding-top: 6px;">
                                      <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; position: relative;">
                                        <div style="position: absolute; left: 0; top: 0; width: 12px; height: 100%; background: #10b981; border-radius: 4px 0 0 4px;"></div>
                                        <div style="width: ${assetAlloc.equity.percentage}%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #059669 100%); border-radius: 4px;"></div>
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>

                            <tr>
                              <td style="padding: 12px 0;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                  <tr>
                                    <td style="padding-left: 0px; vertical-align: middle; width: 80px;">
                                      <div style="font-size: 11px; color: #6b7280; font-weight: 600;">Debt</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle; width: 60px; padding-right: 10px;">
                                      <div style="font-size: 13px; font-weight: 700; color: #1f2937;">${assetAlloc.debt.percentage.toFixed(1)}%</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle;">
                                      <div style="font-size: 12px; color: #6b7280;">${formatCurrencyForEmail(assetAlloc.debt.value)}</div>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td colspan="3" style="padding-top: 6px;">
                                      <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; position: relative;">
                                        <div style="position: absolute; left: 0; top: 0; width: 12px; height: 100%; background: #3b82f6; border-radius: 4px 0 0 4px;"></div>
                                        <div style="width: ${assetAlloc.debt.percentage}%; height: 100%; background: linear-gradient(90deg, #3b82f6 0%, #2563eb 100%); border-radius: 4px;"></div>
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>

                            <tr>
                              <td style="padding: 12px 0;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                  <tr>
                                    <td style="padding-left: 0px; vertical-align: middle; width: 80px;">
                                      <div style="font-size: 11px; color: #6b7280; font-weight: 600;">Gold</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle; width: 60px; padding-right: 10px;">
                                      <div style="font-size: 13px; font-weight: 700; color: #1f2937;">${assetAlloc.commodities.percentage.toFixed(1)}%</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle;">
                                      <div style="font-size: 12px; color: #6b7280;">${formatCurrencyForEmail(assetAlloc.commodities.value)}</div>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td colspan="3" style="padding-top: 6px;">
                                      <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; position: relative;">
                                        <div style="position: absolute; left: 0; top: 0; width: 12px; height: 100%; background: #f59e0b; border-radius: 4px 0 0 4px;"></div>
                                        <div style="width: ${assetAlloc.commodities.percentage}%; height: 100%; background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%); border-radius: 4px;"></div>
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>

                            <tr>
                              <td style="padding: 12px 0;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                  <tr>
                                    <td style="padding-left: 0px; vertical-align: middle; width: 80px;">
                                      <div style="font-size: 11px; color: #6b7280; font-weight: 600;">Real Estate</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle; width: 60px; padding-right: 10px;">
                                      <div style="font-size: 13px; font-weight: 700; color: #1f2937;">${assetAlloc.realEstate.percentage.toFixed(1)}%</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle;">
                                      <div style="font-size: 12px; color: #6b7280;">${formatCurrencyForEmail(assetAlloc.realEstate.value)}</div>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td colspan="3" style="padding-top: 6px;">
                                      <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; position: relative;">
                                        <div style="position: absolute; left: 0; top: 0; width: 12px; height: 100%; background: #f97316; border-radius: 4px 0 0 4px;"></div>
                                        <div style="width: ${assetAlloc.realEstate.percentage}%; height: 100%; background: linear-gradient(90deg, #f97316 0%, #ea580c 100%); border-radius: 4px;"></div>
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>

                            <tr>
                              <td style="padding: 12px 0;">
                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                  <tr>
                                    <td style="padding-left: 0px; vertical-align: middle; width: 80px;">
                                      <div style="font-size: 11px; color: #6b7280; font-weight: 600;">Others</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle; width: 60px; padding-right: 10px;">
                                      <div style="font-size: 13px; font-weight: 700; color: #1f2937;">${assetAlloc.crypto.percentage.toFixed(1)}%</div>
                                    </td>
                                    <td align="right" style="vertical-align: middle;">
                                      <div style="font-size: 12px; color: #6b7280;">${formatCurrencyForEmail(assetAlloc.crypto.value)}</div>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td colspan="3" style="padding-top: 6px;">
                                      <div style="width: 100%; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; position: relative;">
                                        <div style="position: absolute; left: 0; top: 0; width: 12px; height: 100%; background: #8b5cf6; border-radius: 4px 0 0 4px;"></div>
                                        <div style="width: ${assetAlloc.crypto.percentage}%; height: 100%; background: linear-gradient(90deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 4px;"></div>
                                      </div>
                                    </td>
                                  </tr>
                                </table>
                              </td>
                            </tr>

                          </table>

                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid #fbbf24; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px;">Action Items & Recommendations</div>

              ${buildActionItemsHTML(reportData.questionnaire)}

            </td>
          </tr>
        </table>

        ${buildFamilyInsuranceSectionHTML(reportData.familyMembers)}

        ${buildAllMemberSectionsHTML(reportData.familyMembers)}

        ${buildBankAccountsSectionHTML(reportData.familyMembers)}

        ${buildInvestmentAccountsSectionHTML(reportData.familyMembers)}

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid #6366f1; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 20px; text-align: center;">
              <div style="font-size: 12px; color: #6b7280; margin-bottom: 8px;">
                This report is auto-generated from your Google Sheets. Keep your financial data secure.
              </div>
              <div style="font-size: 14px; color: #374151; font-weight: 600;">
                Made with ❤️ in India by <strong>Jagadeesh Manne</strong> · Donate via UPI: <strong>jagadeeshmanne.hdfc@kphdfc</strong>
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;

  // Minify HTML to reduce size and avoid Gmail clipping
  return minifyHTML(htmlContent);
}

/**
 * Helper function to parse numbers that may contain commas and currency symbols
 * Handles both number and string formats with commas, rupee symbols, spaces
 */
function parseNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    // Remove currency symbols (₹, Rs, Rs.), commas, and spaces
    // Keep the decimal point for proper parsing
    const cleaned = value.replace(/[₹\s]/g, '')  // Remove rupee symbol and spaces
                         .replace(/Rs\.?/gi, '') // Remove Rs or Rs.
                         .replace(/,/g, '');      // Remove commas
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

// Cache for portfolio holdings to avoid reading the same sheet multiple times
const portfolioHoldingsCache = {};

/**
 * Clear portfolio holdings cache (call at start of email generation)
 */
function clearPortfolioHoldingsCache() {
  Object.keys(portfolioHoldingsCache).forEach(key => delete portfolioHoldingsCache[key]);
}

/**
 * Get portfolio holdings with fund details (CACHED)
 * Returns array of holdings for a specific portfolio with all meaningful columns
 * Column structure from sheet:
 * A=Scheme Code, B=Fund, C=Units, D=Avg NAV, E=Current NAV, F=Investment,
 * G=Current Allocation %, H=Current Value, I=Target Allocation %, J=Target Value,
 * K=Ongoing SIP (Target %), L=Rebalance SIP (Smart), M=Target Lumpsum (Target %),
 * N=Rebalance Lumpsum (Smart), O=Buy/Sell, P=P&L
 */
function getPortfolioHoldings(portfolioId, portfolioName) {
  // Check cache first
  const cacheKey = portfolioId + '_' + portfolioName;
  if (portfolioHoldingsCache[cacheKey]) {
    return portfolioHoldingsCache[cacheKey];
  }
  try {
    const spreadsheet = getSpreadsheet();
    // Sheet tab name = portfolioId
    const portfolioSheet = spreadsheet.getSheetByName(portfolioId);

    if (!portfolioSheet) {
      Logger.log(`Portfolio sheet not found: ${portfolioId}`);
      return [];
    }

    const data = portfolioSheet.getDataRange().getValues();

    // Row 1 = Developer credit
    // Row 2 = Group headers
    // Row 3 = Column headers
    // Row 4+ = Data

    const holdings = [];

    // Start from row 4 (index 3)
    for (let i = 3; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows (check fund name in column B)
      if (!row[1]) continue;

      // Skip zero-holding funds (units = 0)
      const units = parseNumber(row[2]);
      if (units === 0) continue;

      const investment = parseNumber(row[5]);
      const currentValue = parseNumber(row[7]);
      const pl = parseNumber(row[15]);
      const plPercent = investment > 0 ? (pl / investment) * 100 : 0;

      holdings.push({
        schemeCode: row[0] || '',                    // A: Scheme Code
        fundName: row[1] || '',                      // B: Fund
        units: units,                                // C: Units
        avgNav: parseNumber(row[3]),                 // D: Avg NAV
        currentNav: parseNumber(row[4]),             // E: Current NAV
        investment: investment,                      // F: Investment
        currentAllocationPercent: parseNumber(row[6]), // G: Current Allocation %
        currentValue: currentValue,                  // H: Current Value
        targetAllocationPercent: parseNumber(row[8]), // I: Target Allocation %
        targetValue: parseNumber(row[9]),            // J: Target Value
        ongoingSIP: parseNumber(row[10]),            // K: Ongoing SIP (Target %)
        rebalanceSIP: parseNumber(row[11]),          // L: Rebalance SIP (Smart)
        targetLumpsum: parseNumber(row[12]),         // M: Target Lumpsum (Target %)
        rebalanceLumpsum: parseNumber(row[13]),      // N: Rebalance Lumpsum (Smart)
        buySell: parseNumber(row[14]),               // O: Buy/Sell
        pl: pl,                                      // P: P&L
        plPercent: plPercent,                        // Calculated
        athNav: parseNumber(row[17]),                // R: ATH NAV ₹ (col 18, index 17)
        belowATH: parseNumber(row[18])               // S: % Below ATH (col 19, index 18)
      });
    }

    // Cache the result before returning
    portfolioHoldingsCache[cacheKey] = holdings;
    return holdings;

  } catch (error) {
    Logger.log(`Error getting portfolio holdings for ${portfolioName}: ` + error.toString());
    portfolioHoldingsCache[cacheKey] = []; // Cache empty result to avoid retrying
    return [];
  }
}

/**
 * Build mutual funds portfolio summary HTML for a member
 * Shows portfolio-level summary (removed Platform column as it shows in details)
 */
function buildMemberMutualFundsHTML(memberData) {
  if (!memberData.portfolios || memberData.portfolios.length === 0) {
    return '<div style="font-size: 12px; color: #6b7280; font-style: italic;">No mutual fund portfolios</div>';
  }

  let html = `
  <div style="margin-bottom: 20px;">
    <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">Mutual Funds Portfolios</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px;">
      <tr style="background: #f3f4f6;">
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Portfolio Name</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Invested</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Current Value</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Unrealized P&L</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Realized P&L</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Total P&L</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Returns %</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: center;">Funds</th>
      </tr>`;

  let totalInvested = 0;
  let totalCurrentValue = 0;
  let totalUnrealizedPL = 0;
  let totalRealizedPL = 0;
  let totalPL = 0;
  let totalFunds = 0;

  memberData.portfolios.forEach(portfolio => {
    totalInvested += portfolio.totalInvested;
    totalCurrentValue += portfolio.currentValue;
    totalUnrealizedPL += portfolio.unrealizedPL || 0;
    totalRealizedPL += portfolio.realizedPL || 0;
    totalPL += portfolio.totalPL;

    // Get fund count for this portfolio
    const holdings = getPortfolioHoldings(portfolio.portfolioId, portfolio.portfolioName);
    const fundCount = holdings.length;
    totalFunds += fundCount;

    const unrealizedPLColor = (portfolio.unrealizedPL || 0) >= 0 ? '#3b82f6' : '#ef4444';
    const unrealizedPLSign = (portfolio.unrealizedPL || 0) >= 0 ? '+' : '';
    const unrealizedPLPercent = portfolio.totalInvested > 0 ? ((portfolio.unrealizedPL || 0) / portfolio.totalInvested) * 100 : 0;

    const realizedPLColor = (portfolio.realizedPL || 0) >= 0 ? '#34d399' : '#ef4444';
    const realizedPLSign = (portfolio.realizedPL || 0) >= 0 ? '+' : '';
    const realizedPLPercent = portfolio.totalInvested > 0 ? ((portfolio.realizedPL || 0) / portfolio.totalInvested) * 100 : 0;

    const totalPLColor = portfolio.totalPL >= 0 ? '#10b981' : '#ef4444';
    const totalPLSign = portfolio.totalPL >= 0 ? '+' : '';

    html += `
      <tr style="border-bottom: 1px solid #d1d5db;">
        <td style="padding: 8px; font-size: 12px; font-weight: 600; color: #111827;">${portfolio.portfolioName}</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: right;">${formatCurrencyForEmail(portfolio.totalInvested)}</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 600; color: #111827; text-align: right;">${formatCurrencyForEmail(portfolio.currentValue)}</td>
        <td style="padding: 8px; font-size: 11px; color: ${unrealizedPLColor}; text-align: right;">${unrealizedPLSign}${formatCurrencyForEmail(portfolio.unrealizedPL || 0)}<br><span style="font-size: 10px;">${unrealizedPLSign}${unrealizedPLPercent.toFixed(1)}%</span></td>
        <td style="padding: 8px; font-size: 11px; color: ${realizedPLColor}; text-align: right;">${realizedPLSign}${formatCurrencyForEmail(portfolio.realizedPL || 0)}<br><span style="font-size: 10px;">${realizedPLSign}${realizedPLPercent.toFixed(1)}%</span></td>
        <td style="padding: 8px; font-size: 12px; color: ${totalPLColor}; text-align: right;">${totalPLSign}${formatCurrencyForEmail(portfolio.totalPL)}</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 700; color: ${totalPLColor}; text-align: right;">${totalPLSign}${portfolio.percentPL.toFixed(1)}%</td>
        <td style="padding: 8px; font-size: 12px; color: #4b5563; text-align: center;">${fundCount}</td>
      </tr>`;
  });

  const totalUnrealizedPLColor = totalUnrealizedPL >= 0 ? '#3b82f6' : '#ef4444';
  const totalUnrealizedPLSign = totalUnrealizedPL >= 0 ? '+' : '';
  const totalUnrealizedPLPercent = totalInvested > 0 ? (totalUnrealizedPL / totalInvested) * 100 : 0;

  const totalRealizedPLColor = totalRealizedPL >= 0 ? '#34d399' : '#ef4444';
  const totalRealizedPLSign = totalRealizedPL >= 0 ? '+' : '';
  const totalRealizedPLPercent = totalInvested > 0 ? (totalRealizedPL / totalInvested) * 100 : 0;

  const totalPLColor = totalPL >= 0 ? '#10b981' : '#ef4444';
  const totalPLSign = totalPL >= 0 ? '+' : '';
  const totalPLPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

  html += `
      <tr style="background: #f9fafb; font-weight: 600; border-top: 2px solid #d1d5db;">
        <td style="padding: 8px; font-size: 12px; color: #111827;">Total Mutual Funds</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: right;">${formatCurrencyForEmail(totalInvested)}</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: right;">${formatCurrencyForEmail(totalCurrentValue)}</td>
        <td style="padding: 8px; font-size: 11px; color: ${totalUnrealizedPLColor}; text-align: right;">${totalUnrealizedPLSign}${formatCurrencyForEmail(totalUnrealizedPL)}<br><span style="font-size: 10px;">${totalUnrealizedPLSign}${totalUnrealizedPLPercent.toFixed(1)}%</span></td>
        <td style="padding: 8px; font-size: 11px; color: ${totalRealizedPLColor}; text-align: right;">${totalRealizedPLSign}${formatCurrencyForEmail(totalRealizedPL)}<br><span style="font-size: 10px;">${totalRealizedPLSign}${totalRealizedPLPercent.toFixed(1)}%</span></td>
        <td style="padding: 8px; font-size: 12px; color: ${totalPLColor}; text-align: right;">${totalPLSign}${formatCurrencyForEmail(totalPL)}</td>
        <td style="padding: 8px; font-size: 12px; color: ${totalPLColor}; text-align: right;">${totalPLSign}${totalPLPercent.toFixed(1)}%</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: center;">${totalFunds}</td>
      </tr>
    </table>
  </div>`;

  return html;
}

/**
 * Build Family Insurance Section HTML (Top Level)
 * Shows all insurance policies grouped by type across all family members
 */
function buildFamilyInsuranceSectionHTML(familyMembers) {
  try {
    const allPolicies = getActiveInsurancePolicies();

    if (!allPolicies || allPolicies.length === 0) {
      return `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid #fbbf24; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px;">Insurance Policies</div>
              <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 14px; text-align: center;">
                <div style="font-size: 14px; color: #92400e; font-weight: 600;">⚠️ No insurance policies found</div>
                <div style="font-size: 12px; color: #92400e; margin-top: 8px;">Add insurance policies to protect your family's financial future</div>
              </div>
            </td>
          </tr>
        </table>`;
    }

    // Group policies by type
    const policyTypes = {};
    allPolicies.forEach(policy => {
      const type = policy.policyType || 'Other';
      if (!policyTypes[type]) {
        policyTypes[type] = [];
      }

      // Get member name - use memberId field for matching, or fall back to insuredMember if already a name
      let memberName = policy.insuredMember || 'Unknown'; // Default to stored name
      if (policy.memberId) {
        // If memberId exists, use it to find the member name
        const foundMember = familyMembers.find(m => m.memberId === policy.memberId);
        if (foundMember) {
          memberName = foundMember.memberName;
        }
      }

      policyTypes[type].push({
        ...policy,
        memberName: memberName
      });
    });

    let html = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid #8b5cf6; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px;">Insurance Policies</div>`;

    // Build table for each policy type
    Object.keys(policyTypes).sort().forEach((type, typeIndex) => {
      const policies = policyTypes[type];
      const isLast = typeIndex === Object.keys(policyTypes).length - 1;
      const marginBottom = isLast ? '' : 'margin-bottom: 20px;';

      // Color code by type
      let typeColor = '#6b7280';
      if (type === 'Term Insurance') typeColor = '#7c3aed';
      else if (type === 'Health Insurance') typeColor = '#10b981';
      else if (type === 'Life Insurance') typeColor = '#3b82f6';

      html += `
              <div style="${marginBottom}">
                <div style="font-size: 14px; font-weight: 600; color: ${typeColor}; margin-bottom: 12px;">${type}</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px;">
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Member</th>
                    <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Policy Name</th>
                    <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Provider</th>
                    <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Policy Number</th>
                    <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Sum Assured</th>
                    <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Nominee</th>
                  </tr>`;

      let totalCover = 0;
      policies.forEach((policy, index) => {
        const isLastRow = index === policies.length - 1;
        const borderStyle = isLastRow ? '' : 'border-bottom: 1px solid #d1d5db;';
        totalCover += policy.sumAssured || 0;

        html += `
                  <tr style="${borderStyle}">
                    <td style="padding: 8px; font-size: 12px; color: #111827;">${policy.memberName}</td>
                    <td style="padding: 8px; font-size: 12px; color: #374151;">${policy.policyName || 'N/A'}</td>
                    <td style="padding: 8px; font-size: 12px; color: #111827;">${policy.company || 'N/A'}</td>
                    <td style="padding: 8px; font-size: 11px; font-family: monospace; color: #374151;">${policy.policyNumber || 'N/A'}</td>
                    <td style="padding: 8px; font-size: 12px; font-weight: 600; color: #111827; text-align: right;">${formatCurrencyForEmail(policy.sumAssured || 0)}</td>
                    <td style="padding: 8px; font-size: 12px; color: #374151;">${policy.nominee || 'N/A'}</td>
                  </tr>`;
      });

      html += `
                  <tr style="background: #f9fafb; font-weight: 600; border-top: 2px solid #d1d5db;">
                    <td colspan="4" style="padding: 8px; font-size: 12px; color: #111827;">Total ${type} Coverage</td>
                    <td style="padding: 8px; font-size: 12px; font-weight: 700; color: ${typeColor}; text-align: right;">${formatCurrencyForEmail(totalCover)}</td>
                    <td style="padding: 8px; font-size: 11px; color: #6b7280;">${policies.length} polic${policies.length === 1 ? 'y' : 'ies'}</td>
                  </tr>
                </table>
              </div>`;
    });

    html += `
            </td>
          </tr>
        </table>`;

    return html;

  } catch (error) {
    Logger.log('Error building family insurance section: ' + error.toString());
    return '';
  }
}

/**
 * Build all member sections for the email
 * Generates member summary cards with mutual funds portfolios, stocks, other investments, and liabilities
 */
function buildAllMemberSectionsHTML(familyMembers) {
  let html = '';

  const memberColors = ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  familyMembers.forEach((member, index) => {
    const borderColor = memberColors[index % memberColors.length];

    html += `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid ${borderColor}; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #d1d5db;">
                <tr>
                  <td style="font-size: 20px; font-weight: 700; color: ${borderColor};">${member.memberName}</td>
                  <td align="right" style="font-size: 14px; font-weight: 500; color: #4b5563; vertical-align: bottom;">Financial Summary</td>
                </tr>
              </table>

              ${buildMemberFinancialSummaryCard(member, borderColor)}

              ${buildMemberMutualFundsHTML(member)}

              ${buildMemberStocksHTML(member)}

              ${buildMemberOtherInvestmentsHTML(member)}

              ${buildMemberLiabilitiesHTML(member)}

            </td>
          </tr>
        </table>
`;
  });

  // Add Detailed Portfolio Holdings section AFTER all member summaries
  html += buildDetailedPortfolioHoldingsHTML(familyMembers);

  return html;
}

/**
 * Build Financial Summary Card for a member
 * Two-column layout: Financial Summary (left) and Personal Details (right)
 */
function buildMemberFinancialSummaryCard(memberData, borderColor) {
  const liabilities = memberData.totalAssets - memberData.netWorth;
  const netWorthColor = memberData.netWorth >= 0 ? '#3b82f6' : '#ef4444';

  // Get member personal details
  const memberDetails = getFamilyMemberById(memberData.memberId);
  const relationshipColor = getRelationshipColor(memberDetails ? memberDetails.relationship : '');

  // Calculate term insurance cover for this member
  const allPolicies = getActiveInsurancePolicies();
  const memberTermPolicies = allPolicies.filter(p =>
    p.insuredMember === memberData.memberId &&
    p.policyType === 'Term Insurance'
  );
  const totalTermCover = memberTermPolicies.reduce((sum, p) => sum + (p.sumAssured || 0), 0);

  return `
  <div style="margin-bottom: 20px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 2px solid #e5e7eb; border-radius: 8px; background: linear-gradient(135deg, #f9fafb 0%, #ffffff 100%);">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 16px;">
                <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">Financial Summary</div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="width: 50%; vertical-align: middle; padding-right: 10px;">

                      <div style="margin-bottom: 12px;">
                        <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Total Assets</div>
                        <div style="font-size: 16px; font-weight: 700; color: #10b981; line-height: 1.2;">${formatCurrencyForEmail(memberData.totalAssets)}</div>
                      </div>

                      <div style="margin-bottom: 12px;">
                        <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Liabilities</div>
                        <div style="font-size: 16px; font-weight: 700; color: #ef4444; line-height: 1.2;">${formatCurrencyForEmail(liabilities)}</div>
                      </div>

                      <div>
                        <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;">Term Cover</div>
                        <div style="font-size: 16px; font-weight: 700; color: #8b5cf6; line-height: 1.2;">${totalTermCover > 0 ? formatCurrencyForEmail(totalTermCover) : '<span style="color: #6b7280; font-style: italic;">None</span>'}</div>
                      </div>

                    </td>

                    <td style="width: 50%; vertical-align: middle; padding-left: 10px; border-left: 2px solid #3b82f6; text-align: center;">
                      <div style="font-size: 9px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 6px;">Net Worth</div>
                      <div style="font-size: 22px; font-weight: 800; color: ${netWorthColor}; line-height: 1; white-space: nowrap;">${formatCurrencyForEmail(memberData.netWorth)}</div>
                      <div style="font-size: 9px; color: #6b7280; margin-top: 6px;">${memberData.portfolios ? memberData.portfolios.length : 0} Portfolio${(memberData.portfolios && memberData.portfolios.length !== 1) ? 's' : ''}</div>
                    </td>
                  </tr>
                </table>

              </td>

              <td style="width: 50%; vertical-align: top; padding-left: 16px; border-left: 2px solid #d1d5db;">
                <div style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Personal Details</div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="width: 50%; vertical-align: top; padding-right: 8px;">

                      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                        <div style="font-size: 9px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Email</div>
                        <div style="font-size: 11px; color: #111827; font-weight: 600; word-break: break-all; line-height: 1.3;">${memberDetails ? (memberDetails.email || 'N/A') : 'N/A'}</div>
                      </div>

                      <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                        <div style="font-size: 9px; color: #78350f; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">PAN</div>
                        <div style="font-size: 13px; color: #78350f; font-family: monospace; font-weight: 700; letter-spacing: 2px;">${memberDetails ? maskPAN(memberDetails.pan) : 'N/A'}</div>
                      </div>

                      ${memberDetails && memberDetails.dob ? `
                      <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 10px;">
                        <div style="font-size: 9px; color: #075985; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Date of Birth</div>
                        <div style="font-size: 12px; color: #075985; font-weight: 700;">${memberDetails.dob}</div>
                      </div>
                      ` : ''}

                    </td>

                    <td style="width: 50%; vertical-align: top; padding-left: 8px;">

                      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; margin-bottom: 10px;">
                        <div style="font-size: 9px; color: #14532d; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Mobile</div>
                        <div style="font-size: 13px; color: #14532d; font-family: monospace; font-weight: 700;">${memberDetails ? (memberDetails.mobile || 'N/A') : 'N/A'}</div>
                      </div>

                      <div style="background: #fae8ff; border: 1px solid #f0abfc; border-radius: 6px; padding: 10px;">
                        <div style="font-size: 9px; color: #581c87; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Aadhar</div>
                        <div style="font-size: 12px; color: #581c87; font-family: monospace; font-weight: 700; letter-spacing: 1px;">${memberDetails ? (memberDetails.aadhar ? maskAadhar(memberDetails.aadhar) : 'N/A') : 'N/A'}</div>
                      </div>

                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

/**
 * Build Stock Portfolios summary HTML for a member
 */
function buildMemberStocksHTML(memberData) {
  try {
    const allStockPortfolios = getAllStockPortfolios();
    const memberStockPortfolios = allStockPortfolios.filter(
      sp => sp.ownerId === memberData.memberId && sp.status === 'Active'
    );

    if (!memberStockPortfolios || memberStockPortfolios.length === 0) {
      return '';
    }

    let html = `
  <div style="margin-bottom: 20px;">
    <div style="font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 12px;">Stock Portfolios</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px;">
      <tr style="background: #f3f4f6;">
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Platform</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Client ID</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Invested</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Current Value</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">P&L</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Returns %</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: center;">Stocks</th>
      </tr>`;

    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalPL = 0;
    let totalStocks = 0;

    memberStockPortfolios.forEach((portfolio, index) => {
      const isLastRow = index === memberStockPortfolios.length - 1;
      const borderStyle = isLastRow ? '' : 'border-bottom: 1px solid #d1d5db;';

      totalInvested += portfolio.totalInvestment || 0;
      totalCurrentValue += portfolio.currentValue || 0;
      totalPL += portfolio.totalPL || 0;

      const holdings = getStockHoldingsByPortfolio(portfolio.portfolioId);
      const stockCount = holdings.length;
      totalStocks += stockCount;

      const plColor = portfolio.totalPL >= 0 ? '#10b981' : '#ef4444';
      const plSign = portfolio.totalPL >= 0 ? '+' : '';
      const returnsPercent = portfolio.totalInvestment > 0 ? (portfolio.totalPL / portfolio.totalInvestment) * 100 : 0;

      // Get investment account details
      const account = getInvestmentAccountById(portfolio.investmentAccountId);
      const clientId = account ? (account.accountClientId || 'N/A') : 'N/A';
      const platform = account ? (account.platformBroker || 'N/A') : 'N/A';

      html += `
      <tr style="${borderStyle}">
        <td style="padding: 8px; font-size: 12px; font-weight: 600; color: #111827;">${platform}</td>
        <td style="padding: 8px; font-size: 11px; font-family: monospace; color: #374151;">${clientId}</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: right;">${formatCurrencyForEmail(portfolio.totalInvestment || 0)}</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 600; color: #111827; text-align: right;">${formatCurrencyForEmail(portfolio.currentValue || 0)}</td>
        <td style="padding: 8px; font-size: 12px; color: ${plColor}; text-align: right;">${plSign}${formatCurrencyForEmail(portfolio.totalPL || 0)}</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 700; color: ${plColor}; text-align: right;">${plSign}${returnsPercent.toFixed(1)}%</td>
        <td style="padding: 8px; font-size: 12px; color: #4b5563; text-align: center;">${stockCount}</td>
      </tr>`;
    });

    const totalPLColor = totalPL >= 0 ? '#10b981' : '#ef4444';
    const totalPLSign = totalPL >= 0 ? '+' : '';
    const totalReturnsPercent = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;

    html += `
      <tr style="background: #f9fafb; font-weight: 600; border-top: 2px solid #d1d5db;">
        <td colspan="2" style="padding: 8px; font-size: 12px; color: #111827;">Total Stocks</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: right;">${formatCurrencyForEmail(totalInvested)}</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: right;">${formatCurrencyForEmail(totalCurrentValue)}</td>
        <td style="padding: 8px; font-size: 12px; color: ${totalPLColor}; text-align: right;">${totalPLSign}${formatCurrencyForEmail(totalPL)}</td>
        <td style="padding: 8px; font-size: 12px; color: ${totalPLColor}; text-align: right;">${totalPLSign}${totalReturnsPercent.toFixed(1)}%</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: center;">${totalStocks}</td>
      </tr>
    </table>
  </div>`;

    return html;

  } catch (error) {
    Logger.log('Error building member stocks HTML: ' + error.toString());
    return '';
  }
}

/**
 * Build Other Investments HTML for a member
 */
function buildMemberOtherInvestmentsHTML(memberData) {
  try {
    const allInvestments = getAllInvestments();
    const memberInvestments = allInvestments.filter(
      inv => inv.familyMemberId === memberData.memberId && inv.status === 'Active'
    );

    if (!memberInvestments || memberInvestments.length === 0) {
      return '';
    }

    let html = `
  <div style="margin-bottom: 20px;">
    <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 12px;">Other Investments</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px;">
      <tr style="background: #f3f4f6;">
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Type</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Name</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Invested</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Current Value</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Returns</th>
      </tr>`;

    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalCurrentValueForKnownInvestments = 0;

    memberInvestments.forEach((investment, index) => {
      const isLastRow = index === memberInvestments.length - 1;
      const borderStyle = isLastRow ? '' : 'border-bottom: 1px solid #d1d5db;';

      const invested = investment.investedAmount || 0;
      const current = investment.currentValue || 0;

      // Always add current value to total
      totalCurrentValue += current;

      // Only calculate returns if invested amount is known (> 0)
      let returnsDisplay = '';
      if (invested > 0) {
        const returns = current - invested;
        const returnsColor = returns >= 0 ? '#10b981' : '#ef4444';
        const returnsSign = returns >= 0 ? '+' : '';
        returnsDisplay = `<td style="padding: 8px; font-size: 12px; color: ${returnsColor}; text-align: right;">${returnsSign}${formatCurrencyForEmail(Math.abs(returns))}</td>`;

        // Include invested amount and current value in totals for known investments
        totalInvested += invested;
        totalCurrentValueForKnownInvestments += current;
      } else {
        // If invested is 0, show N/A for returns
        returnsDisplay = `<td style="padding: 8px; font-size: 12px; color: #6b7280; text-align: right; font-style: italic;">N/A</td>`;
      }

      // Check if dynamic fields exist and have data
      let dynamicFieldsHTML = '';
      if (investment.dynamicFields && Object.keys(investment.dynamicFields).length > 0) {
        const fields = [];
        Object.keys(investment.dynamicFields).forEach(key => {
          const value = investment.dynamicFields[key];
          if (value) {
            fields.push(`<strong>${key}:</strong> ${value}`);
          }
        });
        if (fields.length > 0) {
          dynamicFieldsHTML = `<div style="font-size: 10px; color: #6b7280; margin-top: 4px;">${fields.join(' • ')}</div>`;
        }
      }

      html += `
      <tr style="${borderStyle}">
        <td style="padding: 8px; font-size: 12px; color: #111827;">${investment.investmentType || 'N/A'}</td>
        <td style="padding: 8px; font-size: 12px; color: #374151;">
          <div>${investment.investmentName || 'N/A'}</div>
          ${dynamicFieldsHTML}
        </td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: right;">${invested > 0 ? formatCurrencyForEmail(invested) : '<span style="font-style: italic; color: #6b7280;">Unknown</span>'}</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 600; color: #111827; text-align: right;">${formatCurrencyForEmail(current)}</td>
        ${returnsDisplay}
      </tr>`;
    });

    // Calculate total returns only from investments with known invested amounts
    let totalReturnsDisplay = '';
    if (totalInvested > 0) {
      const totalReturns = totalCurrentValueForKnownInvestments - totalInvested;
      const totalReturnsColor = totalReturns >= 0 ? '#10b981' : '#ef4444';
      const totalReturnsSign = totalReturns >= 0 ? '+' : '';
      totalReturnsDisplay = `<td style="padding: 8px; font-size: 12px; color: ${totalReturnsColor}; text-align: right;">${totalReturnsSign}${formatCurrencyForEmail(Math.abs(totalReturns))}</td>`;
    } else {
      totalReturnsDisplay = `<td style="padding: 8px; font-size: 12px; color: #6b7280; text-align: right; font-style: italic;">N/A</td>`;
    }

    html += `
      <tr style="background: #f9fafb; font-weight: 600; border-top: 2px solid #d1d5db;">
        <td colspan="2" style="padding: 8px; font-size: 12px; color: #111827;">Total Other Investments</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: right;">${totalInvested > 0 ? formatCurrencyForEmail(totalInvested) : '<span style="font-style: italic; color: #6b7280;">Unknown</span>'}</td>
        <td style="padding: 8px; font-size: 12px; color: #111827; text-align: right;">${formatCurrencyForEmail(totalCurrentValue)}</td>
        ${totalReturnsDisplay}
      </tr>
    </table>
  </div>`;

    return html;

  } catch (error) {
    Logger.log('Error building member other investments HTML: ' + error.toString());
    return '';
  }
}

/**
 * Build Liabilities HTML for a member
 */
function buildMemberLiabilitiesHTML(memberData) {
  try {
    const allLiabilities = getAllLiabilities();
    const memberLiabilities = allLiabilities.filter(
      liab => liab.familyMemberId === memberData.memberId && liab.status === 'Active'
    );

    if (!memberLiabilities || memberLiabilities.length === 0) {
      return '';
    }

    let html = `
  <div>
    <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 12px;">Liabilities</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px;">
      <tr style="background: #f3f4f6;">
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Type</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Lender</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Outstanding Balance</th>
      </tr>`;

    let totalOutstanding = 0;

    memberLiabilities.forEach((liability, index) => {
      const isLastRow = index === memberLiabilities.length - 1;
      const borderStyle = isLastRow ? '' : 'border-bottom: 1px solid #d1d5db;';

      const outstanding = liability.outstandingBalance || 0;
      totalOutstanding += outstanding;

      html += `
      <tr style="${borderStyle}">
        <td style="padding: 8px; font-size: 12px; color: #111827;">${liability.liabilityType || 'N/A'}</td>
        <td style="padding: 8px; font-size: 12px; color: #374151;">${liability.lenderName || 'N/A'}</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 600; color: #ef4444; text-align: right;">${formatCurrencyForEmail(outstanding)}</td>
      </tr>`;
    });

    html += `
      <tr style="background: #f9fafb; font-weight: 600; border-top: 2px solid #d1d5db;">
        <td colspan="2" style="padding: 8px; font-size: 12px; color: #111827;">Total Outstanding</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 700; color: #ef4444; text-align: right;">${formatCurrencyForEmail(totalOutstanding)}</td>
      </tr>
    </table>
  </div>`;

    return html;

  } catch (error) {
    Logger.log('Error building member liabilities HTML: ' + error.toString());
    return '';
  }
}

/**
 * Build Insurance Policies HTML for a member
 */
function buildMemberInsuranceHTML(memberData) {
  try {
    const allPolicies = getActiveInsurancePolicies();
    const memberPolicies = allPolicies.filter(
      policy => policy.insuredMember === memberData.memberId
    );

    if (!memberPolicies || memberPolicies.length === 0) {
      return '';
    }

    let html = `
  <div style="margin-bottom: 20px;">
    <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 12px;">Insurance Policies</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px;">
      <tr style="background: #f3f4f6;">
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Type</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Policy Name</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Insurer</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: right;">Cover Amount</th>
        <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Nominee</th>
      </tr>`;

    let totalCover = 0;
    let totalTermCover = 0;

    memberPolicies.forEach((policy, index) => {
      const isLastRow = index === memberPolicies.length - 1;
      const borderStyle = isLastRow ? '' : 'border-bottom: 1px solid #d1d5db;';

      const cover = policy.sumAssured || 0;
      totalCover += cover;
      if (policy.policyType === 'Term Insurance') {
        totalTermCover += cover;
      }

      // Color code by policy type
      let typeColor = '#111827';
      if (policy.policyType === 'Term Insurance') typeColor = '#7c3aed';
      else if (policy.policyType === 'Health Insurance') typeColor = '#10b981';
      else if (policy.policyType === 'Life Insurance') typeColor = '#3b82f6';

      html += `
      <tr style="${borderStyle}">
        <td style="padding: 8px; font-size: 12px; color: ${typeColor}; font-weight: 600;">${policy.policyType || 'N/A'}</td>
        <td style="padding: 8px; font-size: 12px; color: #374151;">${policy.policyName || 'N/A'}</td>
        <td style="padding: 8px; font-size: 12px; color: #6b7280;">${policy.company || 'N/A'}</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 600; color: #111827; text-align: right;">${formatCurrencyForEmail(cover)}</td>
        <td style="padding: 8px; font-size: 12px; color: #6b7280;">${policy.nominee || 'N/A'}</td>
      </tr>`;
    });

    html += `
      <tr style="background: #f9fafb; font-weight: 600; border-top: 2px solid #d1d5db;">
        <td colspan="3" style="padding: 8px; font-size: 12px; color: #111827;">Total Coverage</td>
        <td style="padding: 8px; font-size: 12px; font-weight: 700; color: #8b5cf6; text-align: right;">${formatCurrencyForEmail(totalCover)}</td>
        <td style="padding: 8px; font-size: 11px; color: #6b7280; font-style: italic;">Term: ${formatCurrencyForEmail(totalTermCover)}</td>
      </tr>
    </table>
  </div>`;

    return html;

  } catch (error) {
    Logger.log('Error building member insurance HTML: ' + error.toString());
    return '';
  }
}

/**
 * Build Detailed Portfolio Holdings Section HTML
 * Separate section showing individual fund/stock details for all members
 */
function buildDetailedPortfolioHoldingsHTML(familyMembers) {
  let html = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid #818cf8; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px;">Detailed Portfolio Holdings</div>

              <div style="margin-bottom: 24px;">
                <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 12px;">Mutual Funds - Individual Fund Details</div>
`;

  // Add detailed holdings for each member's portfolios
  familyMembers.forEach(member => {
    html += buildPortfolioHoldingsHTML(member);
  });

  html += `
              </div>

              <div>
                <div style="font-size: 14px; font-weight: 700; color: #1f2937; margin-bottom: 12px;">Stocks - Individual Stock Details</div>
`;

  // Add detailed stock holdings for each member's stock portfolios
  familyMembers.forEach(member => {
    html += buildStockHoldingsHTML(member);
  });

  html += `
              </div>

            </td>
          </tr>
        </table>
`;

  return html;
}

/**
 * Calculate portfolio asset allocation from holdings
 * Reads AssetAllocations sheet to get fund-level allocation, then aggregates
 */
function calculatePortfolioAssetAllocation(holdings, portfolioValue) {
  try {
    const spreadsheet = getSpreadsheet();
    const assetAllocSheet = spreadsheet.getSheetByName(CONFIG.assetAllocationsSheet);

    if (!assetAllocSheet || holdings.length === 0 || portfolioValue === 0) {
      return null;
    }

    const allocData = assetAllocSheet.getDataRange().getValues();

    // Row 1 = Developer credit, Row 2 = Headers, Row 3+ = Data
    // Columns: A=Fund Code, B=Fund Name, C=Asset Allocation JSON, D=Equity Allocation JSON

    const assetTotals = { equity: 0, debt: 0, gold: 0, commodities: 0, cash: 0 };
    const capTotals = { large: 0, mid: 0, small: 0 };

    holdings.forEach(holding => {
      // Find this fund's allocation data
      for (let i = 2; i < allocData.length; i++) {
        const fundCode = allocData[i][0] ? allocData[i][0].toString() : '';

        if (fundCode === holding.schemeCode.toString()) {
          // Parse asset allocation JSON
          try {
            const assetJSON = allocData[i][2]; // Column C
            if (assetJSON) {
              const assetAlloc = JSON.parse(assetJSON);
              const fundWeight = holding.currentValue / portfolioValue;

              // Aggregate asset allocation
              assetTotals.equity += (assetAlloc.Equity || 0) * fundWeight;
              assetTotals.debt += (assetAlloc.Debt || 0) * fundWeight;
              assetTotals.gold += (assetAlloc.Gold || 0) * fundWeight;
              assetTotals.commodities += (assetAlloc.Commodities || 0) * fundWeight;
              assetTotals.cash += (assetAlloc.Cash || 0) * fundWeight;
            }

            // Parse equity allocation JSON for market cap
            const equityJSON = allocData[i][3]; // Column D
            if (equityJSON) {
              const equityAlloc = JSON.parse(equityJSON);
              const fundWeight = holding.currentValue / portfolioValue;

              capTotals.large += (equityAlloc.Large || 0) * fundWeight;
              capTotals.mid += (equityAlloc.Mid || 0) * fundWeight;
              capTotals.small += (equityAlloc.Small || 0) * fundWeight;
            }
          } catch (parseError) {
            Logger.log(`Error parsing allocation for ${holding.fundName}: ` + parseError.toString());
          }
          break;
        }
      }
    });

    return {
      asset: assetTotals,
      cap: capTotals
    };

  } catch (error) {
    Logger.log('Error calculating portfolio asset allocation: ' + error.toString());
    return null;
  }
}

/**
 * Build detailed portfolio holdings HTML
 * Shows individual fund holdings with meaningful columns from the sheet
 */
function buildPortfolioHoldingsHTML(memberData) {
  if (!memberData.portfolios || memberData.portfolios.length === 0) {
    return '';
  }

  let html = '';

  memberData.portfolios.forEach(portfolio => {
    const holdings = getPortfolioHoldings(portfolio.portfolioId, portfolio.portfolioName);

    if (holdings.length === 0) return;

    // DEBUG: Log portfolio object fields
    console.log('DEBUG send_complete_email - Portfolio:', portfolio.portfolioName);
    console.log('DEBUG - portfolio.platformBroker:', portfolio.platformBroker);
    console.log('DEBUG - portfolio.accountClientId:', portfolio.accountClientId);
    console.log('DEBUG - portfolio.registeredEmail:', portfolio.registeredEmail);
    console.log('DEBUG - portfolio.registeredPhone:', portfolio.registeredPhone);

    // Get investment account details from portfolio object (already populated in DashboardData.js)
    const accountDetails = {
      platform: portfolio.platformBroker || 'N/A',
      clientId: portfolio.accountClientId || 'N/A',
      email: portfolio.registeredEmail || 'N/A',
      mobile: portfolio.registeredPhone || 'N/A'
    };

    // DEBUG: Log final accountDetails
    console.log('DEBUG - accountDetails:', accountDetails);

    // Calculate portfolio-level asset allocation
    const allocation = calculatePortfolioAssetAllocation(holdings, portfolio.currentValue);

    // Portfolio header with summary
    const plColor = portfolio.totalPL >= 0 ? '#10b981' : '#ef4444';
    const plSign = portfolio.totalPL >= 0 ? '+' : '';

    // Build asset allocation text
    let assetText = '';
    let capText = '';

    if (allocation) {
      const asset = allocation.asset;
      const cap = allocation.cap;

      // Build asset allocation line
      const assetParts = [];
      if (asset.equity > 0.1) {
        assetParts.push(`Equity <strong style="color: #10b981;">${asset.equity.toFixed(1)}%</strong> <span style="color: #6b7280;">(${formatCurrencyForEmail(portfolio.currentValue * asset.equity / 100)})</span>`);
      }
      if (asset.debt > 0.1) {
        assetParts.push(`Debt <strong style="color: #3b82f6;">${asset.debt.toFixed(1)}%</strong> <span style="color: #6b7280;">(${formatCurrencyForEmail(portfolio.currentValue * asset.debt / 100)})</span>`);
      }
      if (asset.gold > 0.1) {
        assetParts.push(`Gold <strong style="color: #f59e0b;">${asset.gold.toFixed(1)}%</strong> <span style="color: #6b7280;">(${formatCurrencyForEmail(portfolio.currentValue * asset.gold / 100)})</span>`);
      }
      if (asset.commodities > 0.1) {
        assetParts.push(`Commodities <strong style="color: #f59e0b;">${asset.commodities.toFixed(1)}%</strong>`);
      }
      if (asset.cash > 0.1) {
        assetParts.push(`Cash <strong style="color: #6b7280;">${asset.cash.toFixed(1)}%</strong>`);
      }
      assetText = assetParts.join(' • ');

      // Build market cap line
      const capParts = [];
      if (cap.large > 0.1) {
        capParts.push(`Large <strong style="color: #10b981;">${cap.large.toFixed(0)}%</strong>`);
      }
      if (cap.mid > 0.1) {
        capParts.push(`Mid <strong style="color: #3b82f6;">${cap.mid.toFixed(0)}%</strong>`);
      }
      if (cap.small > 0.1) {
        capParts.push(`Small <strong style="color: #f59e0b;">${cap.small.toFixed(0)}%</strong>`);
      }
      capText = capParts.join(' • ');
    }

    html += `
    <div style="background: #f9fafb; border-left: 4px solid #9ca3af; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="vertical-align: top;">
            <div style="font-size: 14px; font-weight: 700; color: #111827;">${memberData.memberName} - ${portfolio.portfolioName}</div>
            <div style="font-size: 11px; color: #4b5563; margin-top: 4px;">
              <strong>Platform:</strong> ${accountDetails.platform} | <strong>Client ID:</strong> ${accountDetails.clientId} | <strong>Email:</strong> ${accountDetails.email} | <strong>Mobile:</strong> ${accountDetails.mobile}
            </div>
          </td>
          <td align="right" style="vertical-align: top;">
            <div style="font-size: 11px; color: #4b5563;">Portfolio Value</div>
            <div style="font-size: 18px; font-weight: 700; color: ${plColor};">${formatCurrencyForEmail(portfolio.currentValue)}</div>
            <div style="font-size: 11px; color: ${plColor}; font-weight: 600;">${plSign}${portfolio.percentPL.toFixed(1)}% returns</div>
          </td>
        </tr>
      </table>
      ${assetText || capText ? `<div style="padding-top: 8px; border-top: 1px solid #d1d5db; margin-top: 8px; font-size: 11px;">
        ${assetText ? `<strong style="color: #4b5563;">Asset:</strong> ${assetText}<br>` : ''}
        ${capText ? `<strong style="color: #4b5563;">Cap:</strong> ${capText}` : ''}
      </div>` : ''}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px; margin-bottom: 20px; font-size: 11px;">
      <tr style="background: #f3f4f6;">
        <th style="padding: 6px 8px; font-size: 10px; font-weight: 600; color: #1f2937; text-align: left;">Fund Name</th>
        <th style="padding: 6px 8px; font-size: 10px; font-weight: 600; color: #1f2937; text-align: right;">Units</th>
        <th style="padding: 6px 8px; font-size: 10px; text-align: right; border-left: 2px solid #d1d5db;">
          <div style="font-weight: 700; color: #1f2937;">NAV</div>
          <div style="font-size: 8px; font-weight: 500; color: #6b7280;">Current / Avg</div>
        </th>
        <th style="padding: 6px 8px; font-size: 10px; text-align: right; border-left: 2px solid #d1d5db;">
          <div style="font-weight: 700; color: #1f2937;">Allocation %</div>
          <div style="font-size: 8px; font-weight: 500; color: #6b7280;">Current / Target</div>
        </th>
        <th style="padding: 6px 8px; font-size: 10px; text-align: right; border-left: 2px solid #d1d5db;">
          <div style="font-weight: 700; color: #1f2937;">Amount</div>
          <div style="font-size: 8px; font-weight: 500; color: #6b7280;">Current / Invested</div>
        </th>
        <th style="padding: 6px 8px; font-size: 10px; font-weight: 600; color: #1f2937; text-align: center; border-left: 2px solid #d1d5db;">Rebalance<br>via SIP</th>
        <th style="padding: 6px 8px; font-size: 10px; font-weight: 600; color: #1f2937; text-align: center; border-left: 2px solid #d1d5db;">Rebalance<br>via Buy/Sell</th>
        <th style="padding: 6px 8px; font-size: 10px; text-align: right; border-left: 2px solid #d1d5db;">
          <div style="font-weight: 700; color: #1f2937;">P&L</div>
          <div style="font-size: 8px; font-weight: 500; color: #6b7280;">Amount / %</div>
        </th>
      </tr>`;

    holdings.forEach((holding, index) => {
      const isLastRow = index === holdings.length - 1;
      const borderStyle = isLastRow ? '' : 'border-bottom: 1px solid #d1d5db;';

      const holdingPLColor = holding.pl >= 0 ? '#10b981' : '#ef4444';
      const holdingPLSign = holding.pl >= 0 ? '+' : '';

      // ATH info line (shown below NAV when fund is below ATH)
      let athLine = '';
      if (holding.athNav > 0 && holding.belowATH > 0) {
        let athColor = '#b8860b';  // Default: dark goldenrod (1-5%)
        let athWeight = 'normal';
        if (holding.belowATH >= 20) {
          athColor = '#c62828'; athWeight = 'bold';   // 20%+: strong red
        } else if (holding.belowATH >= 10) {
          athColor = '#d84315'; athWeight = 'bold';   // 10-20%: deep orange
        } else if (holding.belowATH >= 5) {
          athColor = '#e67e00'; athWeight = 'normal';  // 5-10%: orange
        }
        athLine = `<div style="font-size: 9px; color: ${athColor}; font-weight: ${athWeight};">ATH ₹${holding.athNav.toFixed(2)} ↓${holding.belowATH.toFixed(1)}%</div>`;
      }

      // Color code for Buy/Sell suggestion
      let buySellColor = '#6b7280';
      let buySellText = formatCurrencyForEmail(Math.abs(holding.buySell));
      if (holding.buySell > 0) {
        buySellColor = '#10b981';
        buySellText = 'Buy ' + buySellText;
      } else if (holding.buySell < 0) {
        buySellColor = '#ef4444';
        buySellText = 'Sell ' + buySellText;
      } else {
        buySellText = '-';
      }

      html += `
      <tr style="${borderStyle}">
        <td style="padding: 6px 8px; font-size: 11px; color: #111827; max-width: 200px;">${holding.fundName}</td>
        <td style="padding: 6px 8px; font-size: 11px; color: #374151; text-align: right;">${holding.units.toFixed(2)}</td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-left: 2px solid #e5e7eb;">
          <div style="font-weight: 700; color: #111827;">₹${holding.currentNav.toFixed(2)}</div>
          <div style="font-size: 10px; color: #6b7280;">₹${holding.avgNav.toFixed(2)}</div>
          ${athLine}
        </td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-left: 2px solid #e5e7eb;">
          <div style="font-weight: 700; color: #111827;">${holding.currentAllocationPercent.toFixed(1)}%</div>
          <div style="font-size: 10px; color: #6b7280;">${holding.targetAllocationPercent.toFixed(1)}%</div>
        </td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-left: 2px solid #e5e7eb;">
          <div style="font-weight: 700; color: #111827;">${formatCurrencyForEmail(holding.currentValue)}</div>
          <div style="font-size: 10px; color: #6b7280;">${formatCurrencyForEmail(holding.investment)}</div>
        </td>
        <td style="padding: 6px 8px; font-size: 11px; color: #3b82f6; font-weight: 600; text-align: center; border-left: 2px solid #e5e7eb;">${holding.rebalanceSIP > 0 ? formatCurrencyForEmail(holding.rebalanceSIP) : '-'}</td>
        <td style="padding: 6px 8px; font-size: 11px; font-weight: 600; color: ${buySellColor}; text-align: center; border-left: 2px solid #e5e7eb;">${buySellText}</td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-left: 2px solid #e5e7eb;">
          <div style="font-weight: 700; color: ${holdingPLColor};">${holdingPLSign}${formatCurrencyForEmail(holding.pl)}</div>
          <div style="font-size: 8px; font-weight: 700; color: ${holdingPLColor};">${holdingPLSign}${holding.plPercent.toFixed(1)}%</div>
        </td>
      </tr>`;
    });

    html += `
    </table>`;
  });

  return html;
}

/**
 * Build detailed stock holdings HTML for a member
 * Shows individual stock holdings with meaningful columns
 */
function buildStockHoldingsHTML(memberData) {
  if (!memberData) {
    return '';
  }

  try {
    const allStockPortfolios = getAllStockPortfolios();
    const memberStockPortfolios = allStockPortfolios.filter(
      sp => sp.ownerId === memberData.memberId && sp.status === 'Active'
    );

    if (!memberStockPortfolios || memberStockPortfolios.length === 0) {
      return '';
    }

    let html = '';

    memberStockPortfolios.forEach(portfolio => {
      const holdings = getStockHoldingsByPortfolio(portfolio.portfolioId);

      if (holdings.length === 0) return;

      // Get investment account details
      const account = getInvestmentAccountById(portfolio.investmentAccountId);

      // DEBUG: Log stock portfolio account details
      console.log('DEBUG buildStockHoldingsHTML - Portfolio:', portfolio.portfolioName);
      console.log('DEBUG - portfolio.investmentAccountId:', portfolio.investmentAccountId);
      console.log('DEBUG - account found:', account);
      if (account) {
        console.log('DEBUG - account.platformBroker:', account.platformBroker);
        console.log('DEBUG - account.accountClientId:', account.accountClientId);
        console.log('DEBUG - account.registeredEmail:', account.registeredEmail);
        console.log('DEBUG - account.registeredPhone:', account.registeredPhone);
      }

      const accountDetails = {
        platform: (account && account.platformBroker) || 'N/A',
        clientId: (account && account.accountClientId) || 'N/A',
        email: (account && account.registeredEmail) || 'N/A',
        mobile: (account && account.registeredPhone) || 'N/A'
      };

      // DEBUG: Log final accountDetails for stocks
      console.log('DEBUG - stock accountDetails:', accountDetails);

      // Portfolio header with summary
      const plColor = portfolio.totalPL >= 0 ? '#10b981' : '#ef4444';
      const plSign = portfolio.totalPL >= 0 ? '+' : '';

      html += `
    <div style="background: #f9fafb; border-left: 4px solid #9ca3af; border-radius: 6px; padding: 12px; margin-bottom: 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="vertical-align: top;">
            <div style="font-size: 14px; font-weight: 700; color: #111827;">${memberData.memberName} - ${portfolio.portfolioName}</div>
            <div style="font-size: 11px; color: #4b5563; margin-top: 4px;">
              <strong>Platform:</strong> ${accountDetails.platform} | <strong>Client ID:</strong> ${accountDetails.clientId} | <strong>Email:</strong> ${accountDetails.email} | <strong>Mobile:</strong> ${accountDetails.mobile}
            </div>
          </td>
          <td align="right" style="vertical-align: top;">
            <div style="font-size: 11px; color: #4b5563;">Portfolio Value</div>
            <div style="font-size: 18px; font-weight: 700; color: ${plColor};">${formatCurrencyForEmail(portfolio.currentValue)}</div>
            <div style="font-size: 11px; color: ${plColor}; font-weight: 600;">${plSign}${portfolio.totalPLPct.toFixed(1)}% returns</div>
          </td>
        </tr>
      </table>
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px; margin-bottom: 20px; font-size: 11px;">
      <tr style="background: #f3f4f6;">
        <th style="padding: 6px 8px; font-size: 10px; font-weight: 600; color: #1f2937; text-align: left;">Stock</th>
        <th style="padding: 6px 8px; font-size: 10px; font-weight: 600; color: #1f2937; text-align: left;">Symbol</th>
        <th style="padding: 6px 8px; font-size: 10px; font-weight: 600; color: #1f2937; text-align: right;">Quantity</th>
        <th style="padding: 6px 8px; font-size: 10px; text-align: right; border-left: 2px solid #d1d5db;">
          <div style="font-weight: 700; color: #1f2937;">Price</div>
          <div style="font-size: 8px; font-weight: 500; color: #6b7280;">Current / Avg</div>
        </th>
        <th style="padding: 6px 8px; font-size: 10px; text-align: right; border-left: 2px solid #d1d5db;">
          <div style="font-weight: 700; color: #1f2937;">Investment</div>
          <div style="font-size: 8px; font-weight: 500; color: #6b7280;">Total Invested</div>
        </th>
        <th style="padding: 6px 8px; font-size: 10px; text-align: right; border-left: 2px solid #d1d5db;">
          <div style="font-weight: 700; color: #1f2937;">Current Value</div>
        </th>
        <th style="padding: 6px 8px; font-size: 10px; text-align: right; border-left: 2px solid #d1d5db;">
          <div style="font-weight: 700; color: #1f2937;">P&L</div>
          <div style="font-size: 8px; font-weight: 500; color: #6b7280;">Amount / %</div>
        </th>
      </tr>`;

      holdings.forEach((holding, index) => {
        const isLastRow = index === holdings.length - 1;
        const borderStyle = isLastRow ? '' : 'border-bottom: 1px solid #d1d5db;';

        const holdingPLColor = holding.unrealizedPL >= 0 ? '#10b981' : '#ef4444';
        const holdingPLSign = holding.unrealizedPL >= 0 ? '+' : '';

        html += `
      <tr style="${borderStyle}">
        <td style="padding: 6px 8px; font-size: 11px; color: #111827;">${holding.companyName}</td>
        <td style="padding: 6px 8px; font-size: 11px; font-family: monospace; color: #374151;">${holding.symbol}</td>
        <td style="padding: 6px 8px; font-size: 11px; color: #374151; text-align: right;">${holding.quantity}</td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-left: 2px solid #e5e7eb;">
          <div style="font-weight: 700; color: #111827;">₹${holding.currentPrice.toFixed(2)}</div>
          <div style="font-size: 10px; color: #6b7280;">₹${holding.avgBuyPrice.toFixed(2)}</div>
        </td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-left: 2px solid #e5e7eb;">
          <div style="font-weight: 700; color: #111827;">${formatCurrencyForEmail(holding.totalInvestment)}</div>
        </td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-left: 2px solid #e5e7eb;">
          <div style="font-weight: 700; color: #111827;">${formatCurrencyForEmail(holding.currentValue)}</div>
        </td>
        <td style="padding: 6px 8px; font-size: 11px; text-align: right; border-left: 2px solid #e5e7eb;">
          <div style="font-weight: 700; color: ${holdingPLColor};">${holdingPLSign}${formatCurrencyForEmail(Math.abs(holding.unrealizedPL))}</div>
          <div style="font-size: 8px; font-weight: 700; color: ${holdingPLColor};">${holdingPLSign}${holding.unrealizedPLPct.toFixed(1)}%</div>
        </td>
      </tr>`;
      });

      html += `
    </table>`;
    });

    return html;

  } catch (error) {
    Logger.log('Error building stock holdings HTML: ' + error.toString());
    return '';
  }
}

/**
 * Build Family Members Section HTML
 * Two-column layout: Financial Summary (left) and Member Details (right)
 */
function buildFamilyMembersSectionHTML(familyMembers) {
  if (!familyMembers || familyMembers.length === 0) {
    return '';
  }

  let html = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid #8b5cf6; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px;">Family Members</div>`;

  // Loop through each member and create a two-column card
  familyMembers.forEach((member, index) => {
    const memberDetails = getFamilyMemberById(member.memberId);
    const relationshipColor = getRelationshipColor(memberDetails ? memberDetails.relationship : '');
    const netWorthColor = member.netWorth >= 0 ? '#3b82f6' : '#ef4444';
    const liabilities = member.totalAssets - member.netWorth;
    const isLastMember = index === familyMembers.length - 1;
    const marginBottom = isLastMember ? '' : 'margin-bottom: 16px;';

    html += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 2px solid #e5e7eb; border-radius: 8px; background: white; ${marginBottom}">
                <tr>
                  <td style="padding: 16px;">
                    <div style="margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb;">
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="vertical-align: middle;">
                            <div style="font-size: 16px; font-weight: 700; color: #111827;">${member.memberName}</div>
                          </td>
                          <td align="right" style="vertical-align: middle;">
                            <div style="font-size: 12px; font-weight: 600; color: ${relationshipColor}; background: ${relationshipColor}15; padding: 4px 10px; border-radius: 4px; display: inline-block;">${memberDetails ? memberDetails.relationship : 'N/A'}</div>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="width: 50%; vertical-align: top; padding-right: 12px;">
                          <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Financial Summary</div>

                          <div style="margin-bottom: 10px;">
                            <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px;">Total Assets</div>
                            <div style="font-size: 16px; font-weight: 700; color: #10b981; line-height: 1.2;">${formatCurrencyForEmail(member.totalAssets)}</div>
                          </div>

                          <div style="margin-bottom: 10px;">
                            <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px;">Liabilities</div>
                            <div style="font-size: 16px; font-weight: 700; color: #ef4444; line-height: 1.2;">${formatCurrencyForEmail(liabilities)}</div>
                          </div>

                          <div style="padding-top: 10px; border-top: 1px solid #e5e7eb;">
                            <div style="font-size: 9px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px;">Net Worth</div>
                            <div style="font-size: 20px; font-weight: 800; color: ${netWorthColor}; line-height: 1.1;">${formatCurrencyForEmail(member.netWorth)}</div>
                          </div>

                          <div style="margin-top: 10px; font-size: 10px; color: #6b7280;">
                            <strong>${member.portfolios ? member.portfolios.length : 0}</strong> Portfolio${(member.portfolios && member.portfolios.length !== 1) ? 's' : ''}
                          </div>
                        </td>

                        <td style="width: 50%; vertical-align: top; padding-left: 12px; border-left: 1px solid #e5e7eb;">
                          <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">Personal Details</div>

                          <div style="margin-bottom: 8px;">
                            <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">Email</div>
                            <div style="font-size: 11px; color: #374151; word-break: break-all;">${memberDetails ? (memberDetails.email || 'N/A') : 'N/A'}</div>
                          </div>

                          <div style="margin-bottom: 8px;">
                            <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">Mobile</div>
                            <div style="font-size: 11px; color: #374151; font-family: monospace;">${memberDetails ? (memberDetails.mobile || 'N/A') : 'N/A'}</div>
                          </div>

                          <div style="margin-bottom: 8px;">
                            <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">PAN</div>
                            <div style="font-size: 11px; color: #6b7280; font-family: monospace; font-weight: 600;">${memberDetails ? maskPAN(memberDetails.pan) : 'N/A'}</div>
                          </div>

                          <div style="margin-bottom: 8px;">
                            <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">Aadhar</div>
                            <div style="font-size: 11px; color: #6b7280; font-family: monospace; font-weight: 600;">${memberDetails ? (memberDetails.aadhar ? maskAadhar(memberDetails.aadhar) : 'N/A') : 'N/A'}</div>
                          </div>

                          ${memberDetails && memberDetails.dob ? `
                          <div>
                            <div style="font-size: 9px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2px;">Date of Birth</div>
                            <div style="font-size: 11px; color: #374151;">${memberDetails.dob}</div>
                          </div>
                          ` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
  });

  html += `
            </td>
          </tr>
        </table>`;

  return html;
}

/**
 * Get color based on relationship type
 */
function getRelationshipColor(relationship) {
  const rel = relationship.toLowerCase();
  if (rel.includes('self') || rel.includes('head')) return '#8b5cf6';
  if (rel.includes('spouse') || rel.includes('wife') || rel.includes('husband')) return '#ec4899';
  if (rel.includes('son') || rel.includes('daughter') || rel.includes('child')) return '#3b82f6';
  if (rel.includes('father') || rel.includes('mother') || rel.includes('parent')) return '#f59e0b';
  return '#6b7280';
}

/**
 * Mask Aadhar number (show only last 4 digits)
 */
function maskAadhar(aadhar) {
  if (!aadhar) return 'N/A';
  const aadharStr = aadhar.toString();
  if (aadharStr.length >= 4) {
    return 'XXXX-XXXX-' + aadharStr.slice(-4);
  }
  return aadharStr;
}

/**
 * Mask PAN number (show only last 4 characters)
 */
function maskPAN(pan) {
  if (!pan) return 'N/A';
  const panStr = pan.toString().trim();
  if (panStr.length >= 4) {
    return 'XXXXXX' + panStr.slice(-4);
  }
  return panStr;
}

/**
 * Build Bank Accounts Section HTML
 * Displays all bank accounts across all family members
 */
function buildBankAccountsSectionHTML(familyMembers) {
  if (!familyMembers || familyMembers.length === 0) {
    return '';
  }

  const bankAccountsList = [];
  const allBankAccounts = getAllBankAccounts();

  // Collect all bank accounts for active family members
  familyMembers.forEach(member => {
    const memberBankAccounts = allBankAccounts.filter(
      ba => ba.memberId === member.memberId && ba.status === 'Active'
    );

    memberBankAccounts.forEach(account => {
      bankAccountsList.push({
        memberName: member.memberName,
        bankName: account.bankName || 'N/A',
        accountNumber: account.accountNumber ? maskAccountNumber(account.accountNumber) : 'N/A',
        accountType: account.accountType || 'N/A',
        branch: account.branchName || 'N/A'
      });
    });
  });

  if (bankAccountsList.length === 0) {
    return '';
  }

  let html = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid #2dd4bf; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px;">Bank Accounts</div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px;">
                <tr style="background: #f3f4f6;">
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Member</th>
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Bank Name</th>
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Account Number</th>
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Account Type</th>
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Branch</th>
                </tr>`;

  bankAccountsList.forEach((account, index) => {
    const isLastRow = index === bankAccountsList.length - 1;
    const borderStyle = isLastRow ? '' : 'border-bottom: 1px solid #d1d5db;';

    html += `
                <tr style="${borderStyle}">
                  <td style="padding: 8px; font-size: 12px; color: #111827;">${account.memberName}</td>
                  <td style="padding: 8px; font-size: 12px; color: #111827;">${account.bankName}</td>
                  <td style="padding: 8px; font-size: 11px; font-family: monospace; color: #374151;">${account.accountNumber}</td>
                  <td style="padding: 8px; font-size: 12px; color: #374151;">${account.accountType}</td>
                  <td style="padding: 8px; font-size: 12px; color: #374151;">${account.branch}</td>
                </tr>`;
  });

  html += `
              </table>
            </td>
          </tr>
        </table>`;

  return html;
}

/**
 * Build Investment Accounts Section HTML
 * Displays all investment accounts (for mutual funds/stocks) across all family members
 */
function buildInvestmentAccountsSectionHTML(familyMembers) {
  if (!familyMembers || familyMembers.length === 0) {
    return '';
  }

  const investmentAccountsList = [];
  const processedAccounts = new Set();

  // Collect all unique investment accounts
  familyMembers.forEach(member => {
    if (member.portfolios && member.portfolios.length > 0) {
      member.portfolios.forEach(portfolio => {
        const accountId = portfolio.investmentAccountId;

        // Skip if we've already processed this account
        if (processedAccounts.has(accountId)) {
          return;
        }

        const account = getInvestmentAccountById(accountId);
        if (account && account.status === 'Active') {
          investmentAccountsList.push({
            memberName: member.memberName,
            platform: account.platformBroker || 'N/A',
            accountType: account.accountType || 'N/A',
            accountId: account.accountClientId || 'N/A',
            email: account.registeredEmail || 'N/A',
            phone: account.registeredPhone ? formatPhoneForEmail(account.registeredPhone) : 'N/A'
          });

          processedAccounts.add(accountId);
        }
      });
    }
  });

  if (investmentAccountsList.length === 0) {
    return '';
  }

  let html = `
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: white; border-left: 4px solid #818cf8; border-top: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); margin-bottom: 24px;">
          <tr>
            <td style="padding: 20px;">
              <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 16px;">Investment Accounts</div>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border: 1px solid #d1d5db; border-radius: 8px;">
                <tr style="background: #f3f4f6;">
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Member</th>
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Platform</th>
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Account Type</th>
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Account ID</th>
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Email</th>
                  <th style="padding: 8px; font-size: 11px; font-weight: 600; color: #1f2937; text-align: left;">Phone</th>
                </tr>`;

  investmentAccountsList.forEach((account, index) => {
    const isLastRow = index === investmentAccountsList.length - 1;
    const borderStyle = isLastRow ? '' : 'border-bottom: 1px solid #d1d5db;';

    html += `
                <tr style="${borderStyle}">
                  <td style="padding: 8px; font-size: 12px; color: #111827;">${account.memberName}</td>
                  <td style="padding: 8px; font-size: 12px; color: #111827;">${account.platform}</td>
                  <td style="padding: 8px; font-size: 12px; color: #374151;">${account.accountType}</td>
                  <td style="padding: 8px; font-size: 11px; font-family: monospace; color: #374151;">${account.accountId}</td>
                  <td style="padding: 8px; font-size: 12px; color: #374151;">${account.email}</td>
                  <td style="padding: 8px; font-size: 11px; font-family: monospace; color: #374151;">${account.phone}</td>
                </tr>`;
  });

  html += `
              </table>
            </td>
          </tr>
        </table>`;

  return html;
}

/**
 * Mask account number (show only last 4 digits)
 */
function maskAccountNumber(accountNumber) {
  if (!accountNumber) return 'N/A';
  const accStr = accountNumber.toString().replace(/\s/g, '');
  if (accStr.length >= 4) {
    return 'XXXX-XXXX-' + accStr.slice(-4);
  }
  return accStr;
}

/**
 * Format phone number for email display
 */
function formatPhoneForEmail(phone) {
  if (!phone) return 'N/A';
  const phoneStr = phone.toString().replace(/\D/g, '');
  if (phoneStr.length === 10) {
    return '+91 ' + phoneStr.slice(0, 5) + ' ' + phoneStr.slice(5);
  }
  return phone;
}
