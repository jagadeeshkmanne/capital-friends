/**
 * ============================================================================
 * CAPITAL FRIENDS V2 - Web App API (Standalone GAS Project)
 * ============================================================================
 *
 * This is the standalone web app version of Capital Friends.
 * It serves as a REST API for the React frontend.
 * Each user gets their own spreadsheet — privacy by isolation.
 *
 * Developer: Jagadeesh Manne
 * Email: jagadeesh.k.manne@gmail.com
 * UPI: jagadeeshmanne.hdfc@kphdfc
 * Version: 2.0-webapp
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

  // Master Database (public reference data — must be shared as "Anyone with the link can view")
  masterDbId: '1pSvGDFTgcCkW6Fk9P2mZ5FSpROVClz7Vu0sW9JnPz9s',
  masterMFDataSheet: 'MF_Data',        // Mutual fund NAVs (~8,500+ funds)
  masterATHSheet: 'MF_ATH',            // All-Time High NAV data
  masterStockDataSheet: 'Stock_Data',   // Stock data (~5,292 NSE stocks)

  // App Settings
  appName: 'Capital Friends',
  appVersion: '2.0-webapp',

  // Default Values
  defaultCurrency: '\u20B9',
  defaultDateFormat: 'dd/MM/yyyy',

  // Email Settings
  emailEnabled: true,

  // Color Scheme
  colors: {
    primary: '#6366f1',
    secondary: '#7c3aed',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    gray: '#6b7280'
  }
};

// ============================================================================
// WEB APP CONTEXT
// ============================================================================

/**
 * Global variable set by WebApp.js before routing to any business logic function.
 * This is the spreadsheet ID for the currently authenticated user.
 */
var _currentUserSpreadsheetId = null;

// ============================================================================
// GLOBAL HELPER FUNCTIONS
// ============================================================================

/**
 * Get the user's spreadsheet (context-aware)
 * In web app mode, opens user's spreadsheet by ID (set by WebApp.js doPost)
 */
function getSpreadsheet() {
  if (_currentUserSpreadsheetId) {
    return SpreadsheetApp.openById(_currentUserSpreadsheetId);
  }
  throw new Error('No spreadsheet context. Call must come through WebApp doPost.');
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
  return prefix + '-' + String(maxId + 1).padStart(3, '0');
}

/**
 * Toast/UI functions — no-ops in web app mode (no spreadsheet UI)
 * These exist so business logic files that call them don't break.
 */
function showSuccess(message) { log('SUCCESS: ' + message); }
function showError(message) { log('ERROR: ' + message); }
function showInfo(message) { log('INFO: ' + message); }
function showWarning(message) { log('WARNING: ' + message); }

/**
 * Log message
 */
function log(message) {
  Logger.log('[' + new Date().toISOString() + '] ' + message);
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

function isValidEmail(email) {
  if (!email) return false;
  var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function isValidPhone(phone) {
  if (!phone) return false;
  var re = /^\d{10}$/;
  return re.test(phone.toString().replace(/\D/g, ''));
}

function isValidPAN(pan) {
  if (!pan) return false;
  var re = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return re.test(pan.toUpperCase());
}

function isValidAadhar(aadhar) {
  if (!aadhar) return false;
  var re = /^\d{12}$/;
  return re.test(aadhar.toString().replace(/\D/g, ''));
}

function isRequired(value, fieldName) {
  if (!value || value.toString().trim() === '') {
    throw new Error(fieldName + ' is required');
  }
  return true;
}

// ============================================================================
// SHEET FORMATTING (used by Setup.js when creating template sheets)
// ============================================================================

function addDeveloperCredit(sheet, columnCount) {
  sheet.appendRow(['']);
  var creditCell = sheet.getRange(1, 1, 1, columnCount);
  creditCell.merge();
  creditCell.setValue('Developed by Jagadeesh Manne | jagadeesh.k.manne@gmail.com | UPI: jagadeeshmanne.hdfc@kphdfc');
  creditCell.setFontSize(9);
  creditCell.setFontColor('#6b7280');
  creditCell.setFontWeight('bold');
  creditCell.setHorizontalAlignment('center');
  creditCell.setBackground('#f5f5f5');
  var protection = creditCell.protect().setDescription('Developer Credit - Do not delete');
  protection.setWarningOnly(true);
  return sheet;
}

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

function applyStandardFormatting(sheet) {
  sheet.setFrozenRows(2);
  var maxRows = sheet.getMaxRows();
  var maxCols = sheet.getMaxColumns();
  sheet.getRange(1, 1, maxRows, maxCols).setFontSize(9);
  return sheet;
}

function applyDataRowFormatting(sheet, startRow, endRow, numCols) {
  if (!sheet || startRow < 3) return sheet;
  var rowCount = endRow - startRow + 1;
  if (rowCount <= 0) return sheet;
  try {
    var dataRange = sheet.getRange(startRow, 1, rowCount, numCols);
    dataRange.setBorder(true, true, true, true, true, true, '#000000', SpreadsheetApp.BorderStyle.SOLID);
    dataRange.setVerticalAlignment('middle');
    log('Formatted rows ' + startRow + ' to ' + endRow + ' in sheet ' + sheet.getName());
  } catch (error) {
    log('Error formatting rows in ' + sheet.getName() + ': ' + error.toString());
  }
  return sheet;
}

// ============================================================================
// END OF CODE.JS (Web App Version)
// ============================================================================
