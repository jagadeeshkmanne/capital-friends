/**
 * ============================================================================
 * WEBAPP ADAPTERS - Bridge between API router and business logic functions
 * ============================================================================
 *
 * Some business logic files (copied from the add-on) use positional parameters
 * or have different function names than what the API router expects.
 * This file provides adapter/wrapper functions.
 *
 * Also contains Reminders CRUD (not present in original add-on).
 *
 * ============================================================================
 */

// ============================================================================
// LIABILITIES ADAPTERS
// ============================================================================

/**
 * Adapter: API router calls addLiability(params) but file has processAddLiability(data)
 * React sends familyMemberId, emiAmount, interestRate as top-level fields;
 * GAS expects familyMember and dynamicFields JSON.
 */
function addLiability(data) {
  data = _mapLiabilityFields(data);
  return processAddLiability(data);
}

/**
 * Adapter: API router calls updateLiability(params) but file has processEditLiability(data)
 */
function updateLiability(data) {
  data = _mapLiabilityFields(data);
  return processEditLiability(data);
}

/**
 * Map React liability field names to GAS expected names
 */
function _mapLiabilityFields(data) {
  // React sends familyMemberId, GAS expects familyMember
  if (data.familyMemberId && !data.familyMember) {
    data.familyMember = data.familyMemberId;
  }
  // Merge top-level emiAmount/interestRate into dynamicFields JSON
  var df = data.dynamicFields || {};
  if (data.emiAmount != null) df.emiAmount = data.emiAmount;
  if (data.interestRate != null) df.interestRate = data.interestRate;
  data.dynamicFields = df;
  return data;
}

// ============================================================================
// STOCK PORTFOLIO ADAPTERS
// ============================================================================

/**
 * Adapter: API router calls processAddStockPortfolio(params)
 * Original: createStockPortfolio(portfolioName, investmentAccount, owner)
 */
function processAddStockPortfolio(params) {
  return createStockPortfolio(
    params.portfolioName,
    params.investmentAccount || params.investmentAccountId || params.broker || '',
    params.owner || params.ownerId || params.memberName || params.memberId || ''
  );
}

/**
 * Edit a stock portfolio (update name, account, owner, status)
 * Original codebase had no edit function — creating one.
 */
function processEditStockPortfolio(params) {
  try {
    isRequired(params.portfolioId, 'Portfolio ID');

    var sheet = getSheet(CONFIG.stockPortfoliosSheet);
    if (!sheet) throw new Error('StockPortfolios sheet not found');

    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) throw new Error('No portfolios found');

    var data = sheet.getRange(3, 1, lastRow - 2, 14).getValues();
    var rowIndex = -1;

    for (var i = 0; i < data.length; i++) {
      if (data[i][0] === params.portfolioId) {
        rowIndex = i + 3;
        break;
      }
    }

    if (rowIndex === -1) throw new Error('Portfolio not found: ' + params.portfolioId);

    // Update editable fields (keep formulas in E-L intact)
    if (params.portfolioName) sheet.getRange(rowIndex, 2).setValue(params.portfolioName);
    if (params.investmentAccount || params.investmentAccountId || params.broker) sheet.getRange(rowIndex, 3).setValue(params.investmentAccount || params.investmentAccountId || params.broker);
    if (params.owner || params.ownerId || params.memberName) sheet.getRange(rowIndex, 4).setValue(params.owner || params.ownerId || params.memberName);
    if (params.status) sheet.getRange(rowIndex, 13).setValue(params.status);

    log('Stock portfolio updated: ' + params.portfolioId);

    return {
      success: true,
      message: 'Stock portfolio updated successfully'
    };
  } catch (error) {
    log('Error updating stock portfolio: ' + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Delete a stock portfolio (set status to Inactive)
 * Original codebase had no delete function — creating one.
 */
function deleteStockPortfolio(portfolioId) {
  try {
    isRequired(portfolioId, 'Portfolio ID');

    var sheet = getSheet(CONFIG.stockPortfoliosSheet);
    if (!sheet) throw new Error('StockPortfolios sheet not found');

    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) throw new Error('No portfolios found');

    var ids = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    var rowIndex = -1;
    var portfolioName = '';

    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === portfolioId) {
        rowIndex = i + 3;
        portfolioName = sheet.getRange(rowIndex, 2).getValue();
        break;
      }
    }

    if (rowIndex === -1) throw new Error('Portfolio not found: ' + portfolioId);

    // Set status to Inactive (column M = 13)
    sheet.getRange(rowIndex, 13).setValue('Inactive');

    log('Stock portfolio deleted (Inactive): ' + portfolioId);

    return {
      success: true,
      message: 'Stock portfolio "' + portfolioName + '" deleted successfully'
    };
  } catch (error) {
    log('Error deleting stock portfolio: ' + error.toString());
    return { success: false, message: error.message };
  }
}

// ============================================================================
// STOCK TRANSACTION ADAPTERS
// ============================================================================

/**
 * Adapter: API router calls processBuyStock(params)
 * Original: buyStock(portfolioId, stockSymbol, quantity, pricePerShare, transactionDate, brokerage, notes)
 */
function processBuyStock(params) {
  return buyStock(
    params.portfolioId,
    params.stockSymbol || params.symbol,
    params.quantity,
    params.pricePerShare || params.price,
    params.transactionDate || params.date,
    params.brokerage || 0,
    params.notes || ''
  );
}

/**
 * Adapter: API router calls processSellStock(params)
 * Original: sellStock(portfolioId, stockSymbol, quantity, pricePerShare, transactionDate, brokerage, notes)
 */
function processSellStock(params) {
  return sellStock(
    params.portfolioId,
    params.stockSymbol || params.symbol,
    params.quantity,
    params.pricePerShare || params.price,
    params.transactionDate || params.date,
    params.brokerage || 0,
    params.notes || ''
  );
}

/**
 * Adapter: API router calls getStockHoldings(portfolioId)
 * Original: getStockHoldingsByPortfolio(portfolioId)
 */
function getStockHoldings(portfolioId) {
  return getStockHoldingsByPortfolio(portfolioId);
}

/**
 * Get stock transactions for a specific portfolio
 * Original codebase had no per-portfolio transaction getter — creating one.
 */
function getStockTransactions(portfolioId) {
  try {
    var sheet = getSheet(CONFIG.stockTransactionsSheet);
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) return [];

    var data = sheet.getRange(3, 1, lastRow - 2, sheet.getLastColumn()).getValues();
    var transactions = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue;
      // Filter by portfolioId if provided
      if (portfolioId && row[1] !== portfolioId) continue;

      transactions.push({
        transactionId: row[0],       // A
        portfolioId: row[1],         // B
        portfolioName: row[2] || '', // C
        symbol: row[3] || '',        // D
        companyName: row[4] || '',   // E
        exchange: row[5] || '',      // F
        gfSymbol: row[6] || '',      // G
        type: row[7] || '',          // H
        date: row[8] ? formatDate(row[8]) : '', // I
        quantity: parseFloat(row[9]) || 0,       // J
        pricePerShare: parseFloat(row[10]) || 0, // K
        totalAmount: parseFloat(row[11]) || 0,   // L
        brokerage: parseFloat(row[12]) || 0,     // M
        netAmount: parseFloat(row[13]) || 0,     // N
        notes: row[14] || '',                    // O
        realizedPL: parseFloat(row[15]) || 0     // P
      });
    }

    return transactions;
  } catch (error) {
    log('Error getting stock transactions: ' + error.toString());
    return [];
  }
}

// ============================================================================
// GOALS ADAPTER
// ============================================================================

/**
 * Adapter: API router calls updateGoalPortfolioMappings(goalId, mappings)
 * Original: mapPortfoliosToGoal(goalId, portfolioMappings)
 */
function updateGoalPortfolioMappings(goalId, mappings) {
  return mapPortfoliosToGoal(goalId, mappings);
}

// ============================================================================
// REMINDERS CRUD (new — not in original add-on)
// ============================================================================

/**
 * Get all reminders
 * Reminders sheet: Row 1=Watermark, Row 2=Headers, Row 3+=Data
 * 16 columns: ReminderID, Type, FamilyMember, Title, Description, DueDate,
 *   AdvanceNotice, Frequency, RecurrenceEnd, Priority, Status, RecipientEmail,
 *   LastSentDate, NextSendDate, CreatedDate, IsActive
 */
function getAllReminders() {
  try {
    var sheet = getSheet(CONFIG.remindersSheet);
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) return [];

    var data = sheet.getRange(3, 1, lastRow - 2, 16).getValues();
    var reminders = [];

    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      if (!row[0]) continue; // Skip empty rows

      reminders.push({
        reminderId: row[0],
        type: row[1] || '',
        familyMember: row[2] || '',
        title: row[3] || '',
        description: row[4] || '',
        dueDate: row[5] ? formatDate(row[5]) : '',
        advanceNoticeDays: parseInt(row[6]) || 7,
        frequency: row[7] || 'One-time',
        recurrenceEndDate: row[8] ? formatDate(row[8]) : '',
        priority: row[9] || 'Medium',
        status: row[10] || 'Pending',
        recipientEmail: row[11] || '',
        lastSentDate: row[12] ? formatDate(row[12]) : '',
        nextSendDate: row[13] ? formatDate(row[13]) : '',
        createdDate: row[14] ? row[14].toString() : '',
        isActive: row[15] !== false && row[15] !== 'No' && row[15] !== 'FALSE'
      });
    }

    return reminders;
  } catch (error) {
    log('Error getting reminders: ' + error.toString());
    return [];
  }
}

/**
 * Add a new reminder
 */
function addReminder(data) {
  try {
    isRequired(data.title, 'Title');

    var sheet = getSheet(CONFIG.remindersSheet);
    if (!sheet) throw new Error('Reminders sheet not found. Please run setup first.');

    // Generate ID
    var existingData = sheet.getLastRow() > 2
      ? sheet.getRange(3, 1, sheet.getLastRow() - 2, 1).getValues().map(function(r) { return r[0]; })
      : [];
    var reminderId = generateId('REM', existingData);

    var now = getCurrentTimestamp();

    sheet.appendRow([
      reminderId,                       // A: Reminder ID
      data.type || data.category || '', // B: Type
      data.familyMember || '',          // C: Family Member
      data.title,                       // D: Title
      data.description || '',           // E: Description
      data.dueDate || '',               // F: Due Date
      data.advanceNoticeDays || 7,      // G: Advance Notice (Days)
      data.frequency || 'One-time',     // H: Frequency
      data.recurrenceEndDate || '',     // I: Recurrence End Date
      data.priority || 'Medium',        // J: Priority
      'Pending',                        // K: Status
      data.recipientEmail || '',        // L: Recipient Email
      '',                               // M: Last Sent Date
      '',                               // N: Next Send Date
      now,                              // O: Created Date
      'Yes'                             // P: Is Active
    ]);

    // Apply formatting
    var newRow = sheet.getLastRow();
    applyDataRowFormatting(sheet, newRow, newRow, 16);

    log('Reminder added: ' + reminderId + ' - ' + data.title);

    return {
      success: true,
      message: 'Reminder "' + data.title + '" added successfully!',
      reminderId: reminderId
    };
  } catch (error) {
    log('Error adding reminder: ' + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Update an existing reminder
 */
function updateReminder(data) {
  try {
    isRequired(data.reminderId, 'Reminder ID');
    isRequired(data.title, 'Title');

    var sheet = getSheet(CONFIG.remindersSheet);
    if (!sheet) throw new Error('Reminders sheet not found');

    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) throw new Error('No reminders found');

    var ids = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    var rowIndex = -1;

    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === data.reminderId) {
        rowIndex = i + 3;
        break;
      }
    }

    if (rowIndex === -1) throw new Error('Reminder not found: ' + data.reminderId);

    // Keep original created date
    var createdDate = sheet.getRange(rowIndex, 15).getValue();

    sheet.getRange(rowIndex, 1, 1, 16).setValues([[
      data.reminderId,
      data.type || data.category || '',
      data.familyMember || '',
      data.title,
      data.description || '',
      data.dueDate || '',
      data.advanceNoticeDays || 7,
      data.frequency || 'One-time',
      data.recurrenceEndDate || '',
      data.priority || 'Medium',
      data.status || 'Pending',
      data.recipientEmail || '',
      data.lastSentDate || '',
      data.nextSendDate || '',
      createdDate,
      data.isActive !== false ? 'Yes' : 'No'
    ]]);

    log('Reminder updated: ' + data.reminderId);

    return {
      success: true,
      message: 'Reminder "' + data.title + '" updated successfully!'
    };
  } catch (error) {
    log('Error updating reminder: ' + error.toString());
    return { success: false, message: error.message };
  }
}

/**
 * Delete a reminder (set status to Cancelled and IsActive to No)
 */
function deleteReminder(reminderId) {
  try {
    isRequired(reminderId, 'Reminder ID');

    var sheet = getSheet(CONFIG.remindersSheet);
    if (!sheet) throw new Error('Reminders sheet not found');

    var lastRow = sheet.getLastRow();
    if (lastRow <= 2) throw new Error('No reminders found');

    var ids = sheet.getRange(3, 1, lastRow - 2, 1).getValues();
    var rowIndex = -1;
    var title = '';

    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0] === reminderId) {
        rowIndex = i + 3;
        title = sheet.getRange(rowIndex, 4).getValue();
        break;
      }
    }

    if (rowIndex === -1) throw new Error('Reminder not found: ' + reminderId);

    // Set status to Cancelled (K=11) and IsActive to No (P=16)
    sheet.getRange(rowIndex, 11).setValue('Cancelled');
    sheet.getRange(rowIndex, 16).setValue('No');

    log('Reminder deleted: ' + reminderId + ' - ' + title);

    return {
      success: true,
      message: 'Reminder "' + title + '" deleted successfully!'
    };
  } catch (error) {
    log('Error deleting reminder: ' + error.toString());
    return { success: false, message: error.message };
  }
}

// ============================================================================
// END OF WEBAPPADAPTERS.JS
// ============================================================================
