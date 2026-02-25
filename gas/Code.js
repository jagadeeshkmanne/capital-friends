/**
 * ============================================================================
 * CAPITAL FRIENDS V2 - Portfolio Management System
 * ============================================================================
 *
 * A comprehensive family portfolio management system for tracking investments,
 * bank accounts, insurance, loans, and generating detailed reports.
 *
 * Developer: Jagadeesh Manne
 * Email: jagadeesh.k.manne@gmail.com
 * UPI: jagadeeshmanne.hdfc@kphdfc
 * Version: 2.0
 *
 * ============================================================================
 */

// ============================================================================
// GLOBAL CONFIGURATION
// ============================================================================

const CONFIG = {
  // Sheet Names
  familyMembersSheet: 'FamilyMembers',
  bankAccountsSheet: 'BankAccounts',
  investmentAccountsSheet: 'InvestmentAccounts',
  portfolioMetadataSheet: 'AllPortfolios',
  assetAllocationsSheet: 'AssetAllocations',
  mutualFundDataSheet: 'MutualFundData',
  transactionHistorySheet: 'TransactionHistory',
  otherInvestmentsSheet: 'OtherInvestments',
  investmentTypesSheet: 'InvestmentTypes',
  insuranceSheet: 'Insurance',
  // ✅ REMOVED: loansSheet - now unified into liabilitiesSheet
  liabilitiesSheet: 'Liabilities',
  liabilityTypesSheet: 'LiabilityTypes',
  // Stock-related sheets
  stockPortfoliosSheet: 'StockPortfolios',
  stockTransactionsSheet: 'StockTransactions',
  stockHoldingsSheet: 'StockHoldings',
  stockMasterDataSheet: 'StockMasterData',
  // Goals-related sheets
  goalsSheet: 'Goals',
  goalPortfolioMappingSheet: 'GoalPortfolioMapping',
  remindersSheet: 'Reminders',
  settingsSheet: 'Settings',
  questionnaireSheet: 'Questionnaire',
  // ATH data sheet (imported from master DB)
  mfATHDataSheet: 'MF_ATH_Data',

  // App Settings
  appName: 'Capital Friends',
  appVersion: '2.0',

  // Default Values
  defaultCurrency: '₹',
  defaultDateFormat: 'dd/MM/yyyy',

  // Email Settings
  emailEnabled: true,

  // Color Scheme
  colors: {
    primary: '#6366f1',      // Indigo
    secondary: '#7c3aed',    // Purple
    success: '#10b981',      // Green
    warning: '#f59e0b',      // Amber
    danger: '#ef4444',       // Red
    info: '#3b82f6',         // Blue
    gray: '#6b7280'          // Gray
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Runs when spreadsheet is opened
 * Creates custom menu and checks for first-time email configuration
 */
function onOpen() {
  // Call the menu creation function from Menu.gs
  createCustomMenu();

  // ✅ REMOVED: Auto-refresh dashboard - now using HTML dashboard only
  // Dashboard data is loaded on-demand when user opens the HTML dashboard dialog

  // Pre-warm fund cache in background for instant search
  try {
    prewarmFundCache();
  } catch (error) {
    // Silently fail - don't interrupt user if caching fails
    console.log('Fund cache pre-warm failed:', error);
  }

  // Check if user needs to configure email settings (first-time setup)
  // Note: Email configuration is now done through Settings menu
}

// ============================================================================
// GLOBAL HELPER FUNCTIONS
// ============================================================================

/**
 * Get the active spreadsheet
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Get a sheet by name
 */
function getSheet(sheetName) {
  const spreadsheet = getSpreadsheet();
  return spreadsheet.getSheetByName(sheetName);
}

/**
 * Check if a sheet exists
 */
function sheetExists(sheetName) {
  const spreadsheet = getSpreadsheet();
  return spreadsheet.getSheetByName(sheetName) !== null;
}

/**
 * Get current timestamp
 */
function getCurrentTimestamp() {
  return new Date();
}

/**
 * Format date for display
 */
function formatDate(date, format) {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  return Utilities.formatDate(d, Session.getScriptTimeZone(), format || CONFIG.defaultDateFormat);
}

/**
 * Format currency for display
 */
function formatCurrency(amount) {
  if (amount === null || amount === undefined || amount === '') return '';

  const num = parseFloat(amount);
  if (isNaN(num)) return '';

  return CONFIG.defaultCurrency + ' ' + num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Generate unique ID with prefix
 */
function generateId(prefix, existingIds) {
  let maxId = 0;

  for (let i = 0; i < existingIds.length; i++) {
    const id = existingIds[i];
    if (id && id.toString().startsWith(prefix + '-')) {
      const num = parseInt(id.split('-')[1]);
      if (!isNaN(num) && num > maxId) {
        maxId = num;
      }
    }
  }

  return `${prefix}-${String(maxId + 1).padStart(3, '0')}`;
}

/**
 * Show success toast message
 */
function showSuccess(message) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, ' Success', 3);
}

/**
 * Show error toast message
 */
function showError(message) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, 'L Error', 5);
}

/**
 * Show info toast message
 */
function showInfo(message) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, '9 Info', 3);
}

/**
 * Show warning alert dialog
 */
function showWarning(message) {
  SpreadsheetApp.getUi().alert('⚠️ Warning', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Log message
 */
function log(message) {
  Logger.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Include HTML partial for templating
 * Used in HTML files with <?!= include('FileName'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Include common styles
 * Used in HTML files with <?!= includeStyles(); ?>
 */
function includeStyles() {
  return HtmlService.createHtmlOutputFromFile('Styles').getContent();
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate email format
 */
function isValidEmail(email) {
  if (!email) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate phone number (10 digits)
 */
function isValidPhone(phone) {
  if (!phone) return false;
  const re = /^\d{10}$/;
  return re.test(phone.toString().replace(/\D/g, ''));
}

/**
 * Validate PAN number
 */
function isValidPAN(pan) {
  if (!pan) return false;
  const re = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return re.test(pan.toUpperCase());
}

/**
 * Validate Aadhar number (12 digits)
 */
function isValidAadhar(aadhar) {
  if (!aadhar) return false;
  const re = /^\d{12}$/;
  return re.test(aadhar.toString().replace(/\D/g, ''));
}

/**
 * Validate required field
 */
function isRequired(value, fieldName) {
  if (!value || value.toString().trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
  return true;
}

// ============================================================================
// DEVELOPER CREDIT
// ============================================================================

/**
 * Add developer credit to sheet
 */
function addDeveloperCredit(sheet, columnCount) {
  // Add credit row
  sheet.appendRow(['']);
  const creditCell = sheet.getRange(1, 1, 1, columnCount);
  creditCell.merge();
  creditCell.setValue('Developed by Jagadeesh Manne | 📧 jagadeesh.k.manne@gmail.com | 💰 UPI: jagadeeshmanne.hdfc@kphdfc');
  creditCell.setFontSize(9);
  creditCell.setFontColor('#6b7280');
  creditCell.setFontWeight('bold');
  creditCell.setHorizontalAlignment('center');
  creditCell.setBackground('#f5f5f5');

  // Protect credit row
  const protection = creditCell.protect().setDescription('Developer Credit - Do not delete');
  protection.setWarningOnly(true);

  return sheet;
}

/**
 * Format sheet header row
 */
function formatHeaderRow(sheet, headerRange, rowHeight) {
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4a5568');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontSize(10);
  headerRange.setWrap(true);
  headerRange.setVerticalAlignment('middle');
  headerRange.setBorder(true, true, true, true, true, true, '#2d3748', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  if (rowHeight) {
    sheet.setRowHeight(2, rowHeight || 40);
  }

  return sheet;
}

/**
 * Apply standard sheet formatting
 */
function applyStandardFormatting(sheet) {
  // Freeze header rows (watermark + header)
  sheet.setFrozenRows(2);

  // Set font size to 9 for entire sheet
  const maxRows = sheet.getMaxRows();
  const maxCols = sheet.getMaxColumns();
  sheet.getRange(1, 1, maxRows, maxCols).setFontSize(9);

  return sheet;
}

/**
 * Apply data row formatting (borders only, no background colors)
 * Call this after adding data to format rows 3 onwards
 * Note: Does not apply background colors to preserve P&L color indicators
 */
function applyDataRowFormatting(sheet, startRow, endRow, numCols) {
  if (!sheet || startRow < 3) return sheet;

  const rowCount = endRow - startRow + 1;
  if (rowCount <= 0) return sheet;

  try {
    // Get the data range (starting from row 3, which is first data row)
    const dataRange = sheet.getRange(startRow, 1, rowCount, numCols);

    // Apply borders to all data cells with dark black color
    dataRange.setBorder(
      true, true, true, true, true, true,  // top, left, bottom, right, vertical, horizontal
      '#000000',  // Black border color
      SpreadsheetApp.BorderStyle.SOLID
    );

    // Center align all data cells vertically
    dataRange.setVerticalAlignment('middle');

    // NO background colors applied - keeps default white background
    // This ensures profit/loss color indicators (green/red) remain fully visible
    // If you want alternating backgrounds, uncomment the code below:

    /*
    // Apply very subtle alternating row backgrounds
    for (let i = 0; i < rowCount; i++) {
      const currentRow = startRow + i;
      const rowRange = sheet.getRange(currentRow, 1, 1, numCols);

      if (i % 2 === 0) {
        rowRange.setBackground('#ffffff');  // Pure white for even rows
      } else {
        rowRange.setBackground('#fafafa');  // Extremely light gray for odd rows
      }
    }
    */

    log(`Formatted rows ${startRow} to ${endRow} in sheet ${sheet.getName()}`);

  } catch (error) {
    log(`Error formatting rows in ${sheet.getName()}: ${error.toString()}`);
  }

  return sheet;
}

// ============================================================================
// ABOUT & INFO
// ============================================================================

/**
 * Show About dialog
 */
function showAboutDialog() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <base target="_top">
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            line-height: 1.6;
          }
          h2 {
            color: #6366f1;
            margin-top: 0;
          }
          .info {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin: 10px 0;
          }
          .version {
            color: #6b7280;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <h2>=� Capital Friends V2</h2>
        <p class="version">Version ${CONFIG.appVersion}</p>

        <div class="info">
          <p><strong>Comprehensive Family Portfolio Management System</strong></p>
          <p>Manage investments, bank accounts, insurance, loans, and track your complete financial portfolio in one place.</p>
        </div>

        <div class="info">
          <p><strong>Developer:</strong> Jagadeesh Manne</p>
          <p><strong>Email:</strong> jagadeesh.k.manne@gmail.com</p>
          <p><strong>UPI:</strong> jagadeeshmanne.hdfc@kphdfc</p>
        </div>

        <div class="info">
          <p><strong>Features:</strong></p>
          <ul>
            <li>Family member management with dynamic fields</li>
            <li>Bank account tracking</li>
            <li>Investment account management</li>
            <li>Mutual fund portfolio tracking</li>
            <li>Other investments (FD, Bonds, etc.)</li>
            <li>Insurance policy management</li>
            <li>Loan tracking</li>
            <li>Automated email reports</li>
          </ul>
        </div>

        <p style="text-align: center; margin-top: 20px;">
          <button onclick="google.script.host.close()" style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer;">Close</button>
        </p>
      </body>
    </html>
  `;

  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(500)
    .setHeight(450);

  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'About Capital Friends');
}

// ============================================================================
// END OF CODE.GS
// ============================================================================
